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
    const {
        startDate,
        endDate,
        // New interactive filters from chart clicks
        office,
        status
    } = req.query;

    // --- 1. Define Date Filters ---
    const end = endDate ? new Date(endDate) : new Date();
    end.setUTCHours(23, 59, 59, 999);

    const start = startDate ? new Date(startDate) : new Date(new Date(end).setDate(end.getDate() - 30));
    start.setUTCHours(0, 0, 0, 0);

    // --- NEW: Build the interactive filter match stage ---
    // This will be applied to the main asset pipeline to filter all stats and charts.
    const interactiveFilter = {};
    if (office) {
        interactiveFilter['custodian.office'] = office;
    }
    if (status) {
        interactiveFilter['status'] = status;
    }

    const matchStage = Object.keys(interactiveFilter).length > 0 ? [{ $match: interactiveFilter }] : [];

    // --- 2. Define Combined Aggregation Pipelines for Performance ---
    const movableAssetPipeline = Asset.aggregate([
        ...matchStage, // Apply interactive filters at the very beginning for max efficiency
        {
            $facet: {
                currentPeriodStats: [
                    { $match: { acquisitionDate: { $lte: end } } },
                    {
                        $group: {
                            _id: null,
                            totalValue: { $sum: '$acquisitionCost' },
                            totalAssets: { $sum: 1 },
                            forRepair: { $sum: { $cond: [{ $eq: ['$status', 'For Repair'] }, 1, 0] } },
                            disposed: { $sum: { $cond: [{ $eq: ['$status', 'Disposed'] }, 1, 0] } }
                        }
                    }
                ],
                previousPeriodStats: [
                    { $match: { acquisitionDate: { $lte: start } } },
                    {
                        $group: {
                            _id: null,
                            totalValue: { $sum: '$acquisitionCost' },
                            totalAssets: { $sum: 1 },
                            forRepair: { $sum: { $cond: [{ $eq: ['$status', 'For Repair'] }, 1, 0] } },
                            disposed: { $sum: { $cond: [{ $eq: ['$status', 'Disposed'] }, 1, 0] } }
                        }
                    }
                ],
                monthlyAcquisitions: [
                    { $match: { acquisitionDate: { $gte: start, $lte: end } } },
                    { $group: { _id: { $dateToString: { format: "%Y-%m", date: "$acquisitionDate" } }, totalValue: { $sum: '$acquisitionCost' } } },
                    { $sort: { _id: 1 } }
                ],
                assetsByStatus: [
                    { $group: { _id: '$status', count: { $sum: 1 } } }
                ],
                assetsByOffice: [
                    { $group: { _id: '$custodian.office', count: { $sum: 1 } } }
                ],
                assetsByCondition: [
                    { $group: { _id: '$condition', count: { $sum: 1 } } }
                ],
                recentAssets: [
                    { $match: { acquisitionDate: { $lte: end } } },
                    { $sort: { acquisitionDate: -1 } },
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
                currentImmovableCount: [ { $match: { dateAcquired: { $lte: end } } }, { $count: 'count' } ],
                previousImmovableCount: [ { $match: { dateAcquired: { $lte: start } } }, { $count: 'count' } ]
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

    // Unpack results from the combined pipelines
    const ma = movableAssetResults[0] || {};
    const ia = immovableAssetResults[0] || {};
    const rq = requisitionResults[0] || {};

    const currentStats = ma.currentPeriodStats?.[0] || {};
    const previousStats = ma.previousPeriodStats?.[0] || {};
    const monthlyAcquisitions = ma.monthlyAcquisitions || [];
    const assetsByStatus = ma.assetsByStatus || [];
    const assetsByOffice = ma.assetsByOffice || [];
    const assetsByCondition = ma.assetsByCondition || [];
    const recentAssets = ma.recentAssets || [];

    const currentImmovableStats = ia.currentImmovableStats || [];
    const previousImmovableStats = ia.previousImmovableStats || [];
    const currentImmovableCount = ia.currentImmovableCount?.[0]?.count || 0;
    const previousImmovableCount = ia.previousImmovableCount?.[0]?.count || 0;

    const currentPendingReqs = rq.currentPendingReqs?.[0]?.count || 0;
    const previousPendingReqs = rq.previousPendingReqs?.[0]?.count || 0;
    const recentRequisitions = rq.recentRequisitions || [];

    const currentImmovable = currentImmovableStats[0] || { totalValue: 0 };
    const previousImmovable = previousImmovableStats[0] || { totalValue: 0 };

    // --- 4. Format Data & Calculate Trends (No changes needed here) ---
    const calculateTrend = (currentVal, previousVal) => {
        if (previousVal === 0) return currentVal > 0 ? 100 : 0;
        if (currentVal === 0 && previousVal > 0) return -100;
        if (currentVal === previousVal) return 0;
        return parseFloat((((currentVal - previousVal) / previousVal) * 100).toFixed(1));
    };

    const currentMovableValue = currentStats.totalValue || 0;
    const previousMovableValue = previousStats.totalValue || 0;
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
            current: currentStats.totalAssets || 0,
            trend: calculateTrend(currentStats.totalAssets || 0, previousStats.totalAssets || 0)
        },
        forRepair: {
            current: currentStats.forRepair || 0,
            trend: calculateTrend(currentStats.forRepair || 0, previousStats.forRepair || 0)
        },
        disposed: {
            current: currentStats.disposed || 0,
            trend: calculateTrend(currentStats.disposed || 0, previousStats.disposed || 0)
        },
        pendingRequisitions: {
            current: currentPendingReqs,
            trend: calculateTrend(currentPendingReqs, previousPendingReqs)
        },
        immovableAssets: {
            current: currentImmovableCount,
            trend: calculateTrend(currentImmovableCount, previousImmovableCount)
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
            labels: assetsByOffice.map(o => o._id || 'Unassigned'),
            datasets: [{
                label: 'Assets by Office',
                data: assetsByOffice.map(o => o.count)
            }]
        },
        assetStatus: {
            labels: assetsByStatus.map(s => s._id),
            datasets: [{
                label: 'Asset Status',
                data: assetsByStatus.map(s => s.count)
            }]
        },
        assetCondition: {
            labels: assetsByCondition.map(c => c._id || 'Not Set'),
            datasets: [{
                label: 'Assets by Condition',
                data: assetsByCondition.map(c => c.count)
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