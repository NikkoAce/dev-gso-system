const asyncHandler = require('express-async-handler');
const Asset = require('../models/Asset');
const Requisition = require('../models/Requisition');
const ImmovableAsset = require('../models/immovableAsset');
const StockItem = require('../models/StockItem');
const mongoose = require('mongoose');

/**
 * @desc    Get dashboard statistics and chart data
 * @route   GET /api/dashboard/stats
 * @access  Private/Admin
 */
const getDashboardStats = asyncHandler(async (req, res) => {
    const { startDate, endDate } = req.query;

    // --- 1. Define Date Filters ---
    const end = endDate ? new Date(endDate) : new Date();
    end.setUTCHours(23, 59, 59, 999);

    const start = startDate ? new Date(startDate) : new Date(new Date(end).setDate(end.getDate() - 30));
    start.setUTCHours(0, 0, 0, 0);

    // --- 2. Define Combined Aggregation Pipelines for Performance ---
    const movableAssetPipeline = Asset.aggregate([
        {
            $facet: {
                currentPeriodStats: [
                    { $match: { acquisitionDate: { $lte: end } } },
                    { $facet: {
                        totalValue: [{ $group: { _id: null, total: { $sum: '$acquisitionCost' } } }],
                        totalAssets: [{ $count: 'count' }],
                        forRepair: [{ $match: { status: 'For Repair' } }, { $count: 'count' }],
                        disposed: [{ $match: { status: 'Disposed' } }, { $count: 'count' }]
                    }}
                ],
                previousPeriodStats: [
                    { $match: { acquisitionDate: { $lte: start } } },
                    { $facet: {
                        totalValue: [{ $group: { _id: null, total: { $sum: '$acquisitionCost' } } }],
                        totalAssets: [{ $count: 'count' }],
                        forRepair: [{ $match: { status: 'For Repair' } }, { $count: 'count' }],
                        disposed: [{ $match: { status: 'Disposed' } }, { $count: 'count' }]
                    }}
                ],
                monthlyAcquisitions: [
                    { $match: { acquisitionDate: { $gte: start, $lte: end } } },
                    { $group: { _id: { $dateToString: { format: "%Y-%m", date: "$acquisitionDate" } }, totalValue: { $sum: '$acquisitionCost' } } },
                    { $sort: { _id: 1 } }
                ],
                currentDistribution: [
                    { $facet: {
                        assetsByStatus: [{ $group: { _id: '$status', count: { $sum: 1 } } }],
                        assetsByOffice: [{ $group: { _id: '$custodian.office', count: { $sum: 1 } } }]
                    }}
                ],
                recentAssets: [
                    { $match: { acquisitionDate: { $lte: end } } },
                    { $sort: { createdAt: -1 } },
                    { $limit: 5 },
                    { $project: { propertyNumber: 1, description: 1, 'custodian.office': 1, acquisitionDate: 1, name: 1, createdAt: 1 } }
                ]
            }
        }
    ]);

    const immovableAssetPipeline = ImmovableAsset.aggregate([
        {
            $facet: {
                currentImmovableStats: [ { $match: { dateAcquired: { $lte: end } } }, { $group: { _id: null, totalValue: { $sum: '$assessedValue' } } } ],
                previousImmovableStats: [ { $match: { dateAcquired: { $lte: start } } }, { $group: { _id: null, totalValue: { $sum: '$assessedValue' } } } ],
                immovableAssetsCount: [ { $count: 'count' } ]
            }
        }
    ]);

    const requisitionPipeline = Requisition.aggregate([
        {
            $facet: {
                currentPendingReqs: [ { $match: { status: 'Pending', dateRequested: { $lte: end } } }, { $count: 'count' } ],
                previousPendingReqs: [ { $match: { status: 'Pending', dateRequested: { $lt: start } } }, { $count: 'count' } ],
                recentRequisitions: [
                    { $sort: { dateRequested: -1 } },
                    { $limit: 5 },
                    { $project: { risNumber: 1, requestingOffice: 1, status: 1 } }
                ]
            }
        }
    ]);

    const lowStockCountPipeline = StockItem.countDocuments({
        $expr: { $lte: ["$quantity", "$reorderPoint"] }
    });

    // --- 3. Execute all queries concurrently ---
    const [
        movableAssetResults,
        immovableAssetResults,
        requisitionResults,
        lowStockCount
    ] = await Promise.all([
        movableAssetPipeline,
        immovableAssetPipeline,
        requisitionPipeline,
        lowStockCountPipeline
    ]);

    // Define default structures to prevent errors when aggregations return no results (e.g., on a new database).
    const defaultStats = {
        totalValue: [],
        totalAssets: [],
        forRepair: [],
        disposed: []
    };
    const defaultDistribution = {
        assetsByStatus: [],
        assetsByOffice: []
    };

    // Unpack results from the combined pipelines
    const ma = movableAssetResults[0] || {};
    const ia = immovableAssetResults[0] || {};
    const rq = requisitionResults[0] || {};

    const currentPeriodStatsResult = ma.currentPeriodStats?.[0] || {};
    const previousPeriodStatsResult = ma.previousPeriodStats?.[0] || {};
    const monthlyAcquisitions = ma.monthlyAcquisitions || [];
    const currentDistributionResult = ma.currentDistribution?.[0] || {};
    const recentAssets = ma.recentAssets || [];

    const currentImmovableStats = ia.currentImmovableStats || [];
    const previousImmovableStats = ia.previousImmovableStats || [];
    const immovableAssetsCount = ia.immovableAssetsCount?.[0]?.count || 0;

    const currentPendingReqs = rq.currentPendingReqs?.[0]?.count || 0;
    const previousPendingReqs = rq.previousPendingReqs?.[0]?.count || 0;
    const recentRequisitions = rq.recentRequisitions || [];

    const current = Object.assign({}, defaultStats, currentPeriodStatsResult);
    const previous = Object.assign({}, defaultStats, previousPeriodStatsResult);
    const distribution = Object.assign({}, defaultDistribution, currentDistributionResult);
    const currentImmovable = currentImmovableStats[0] || { totalValue: 0 };
    const previousImmovable = previousImmovableStats[0] || { totalValue: 0 };

    // --- 4. Format Data & Calculate Trends (No changes needed here) ---
    const calculateTrend = (currentVal, previousVal) => {
        if (previousVal === 0) return currentVal > 0 ? 100 : 0;
        if (currentVal === 0 && previousVal > 0) return -100;
        if (currentVal === previousVal) return 0;
        return parseFloat((((currentVal - previousVal) / previousVal) * 100).toFixed(1));
    };

    const currentMovableValue = current.totalValue[0]?.total || 0;
    const previousMovableValue = previous.totalValue[0]?.total || 0;
    const currentImmovableValue = currentImmovable.totalValue || 0;
    const previousImmovableValue = previousImmovable.totalValue || 0;

    const totalPortfolioValueCurrent = currentMovableValue + currentImmovableValue;
    const totalPortfolioValuePrevious = previousMovableValue + previousImmovableValue;

    const formattedStats = {
        totalPortfolioValue: {
            current: totalPortfolioValueCurrent,
            trend: calculateTrend(totalPortfolioValueCurrent, totalPortfolioValuePrevious)
        },
        lowStockItems: {
            current: lowStockCount,
            trend: 0
        },
        totalAssets: {
            current: current.totalAssets[0]?.count || 0,
            trend: calculateTrend(current.totalAssets[0]?.count || 0, previous.totalAssets[0]?.count || 0)
        },
        forRepair: {
            current: current.forRepair[0]?.count || 0,
            trend: calculateTrend(current.forRepair[0]?.count || 0, previous.forRepair[0]?.count || 0)
        },
        disposed: {
            current: current.disposed[0]?.count || 0,
            trend: calculateTrend(current.disposed[0]?.count || 0, previous.disposed[0]?.count || 0)
        },
        pendingRequisitions: {
            current: currentPendingReqs,
            trend: calculateTrend(currentPendingReqs, previousPendingReqs)
        },
        immovableAssets: {
            current: immovableAssetsCount,
            trend: 0 // Trend calculation for immovable assets is not yet implemented
        }
    };

    const formattedCharts = {
        monthlyAcquisitions: {
            labels: monthlyAcquisitions.map(m => m._id),
            datasets: [{
                label: 'Acquisition Value',
                data: monthlyAcquisitions.map(m => m.totalValue),
                backgroundColor: 'rgba(75, 192, 192, 0.2)',
                borderColor: 'rgba(75, 192, 192, 1)',
                borderWidth: 1,
                tension: 0.1
            }]
        },
        assetsByOffice: {
            labels: distribution.assetsByOffice.map(o => o._id || 'Unassigned'),
            datasets: [{
                label: 'Assets by Office',
                data: distribution.assetsByOffice.map(o => o.count)
            }]
        },
        assetStatus: {
            labels: distribution.assetsByStatus.map(s => s._id),
            datasets: [{
                label: 'Asset Status',
                data: distribution.assetsByStatus.map(s => s.count)
            }]
        }
    };

    res.json({
        stats: formattedStats,
        charts: formattedCharts,
        recent: {
            assets: recentAssets,
            requisitions: recentRequisitions
        }
    });
});

module.exports = { getDashboardStats };