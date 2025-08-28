const asyncHandler = require('express-async-handler');
const Asset = require('../models/Asset');
const Requisition = require('../models/Requisition');
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

    // If no start date, default to 30 days before the end date for trend calculation.
    const start = startDate ? new Date(startDate) : new Date(new Date(end).setDate(end.getDate() - 30));
    start.setUTCHours(0, 0, 0, 0);

    // --- 2. Define Aggregation Pipelines ---
    // This helper function gets stats for all assets acquired *up to* a certain date.
    const getStatsAtDate = (date) => Asset.aggregate([
        { $match: { acquisitionDate: { $lte: date } } },
        {
            $facet: {
                totalValue: [{ $group: { _id: null, total: { $sum: '$acquisitionCost' } } }],
                totalAssets: [{ $count: 'count' }],
                forRepair: [{ $match: { status: 'For Repair' } }, { $count: 'count' }],
                disposed: [{ $match: { status: 'Disposed' } }, { $count: 'count' }]
            }
        }
    ]);

    // This pipeline gets assets acquired *within* the date range for the chart.
    const monthlyAcquisitionsPipeline = [
        { $match: { acquisitionDate: { $gte: start, $lte: end } } },
        {
            $group: {
                _id: { $dateToString: { format: "%Y-%m", date: "$acquisitionDate" } },
                count: { $sum: 1 }
            }
        },
        { $sort: { _id: 1 } }
    ];

    // These pipelines get the *current* distribution of assets, regardless of date filters.
    const currentDistributionPipeline = [
        {
            $facet: {
                assetsByStatus: [{ $group: { _id: '$status', count: { $sum: 1 } } }],
                assetsByOffice: [{ $group: { _id: '$custodian.office', count: { $sum: 1 } } }]
            }
        }
    ];

    // --- 3. Execute all queries concurrently ---
    const [
        currentPeriodStatsResult,
        previousPeriodStatsResult,
        monthlyAcquisitions,
        currentDistributionResult,
        recentAssets,
        currentPendingReqs,
        previousPendingReqs
    ] = await Promise.all([
        getStatsAtDate(end),
        getStatsAtDate(start),
        Asset.aggregate(monthlyAcquisitionsPipeline),
        Asset.aggregate(currentDistributionPipeline),
        Asset.find({ acquisitionDate: { $lte: end } }).sort({ createdAt: -1 }).limit(5).populate('custodian', 'name office'),
        Requisition.countDocuments({ status: 'Pending', dateRequested: { $lte: end } }),
        Requisition.countDocuments({ status: 'Pending', dateRequested: { $lt: start } })
    ]);

    const current = currentPeriodStatsResult[0];
    const previous = previousPeriodStatsResult[0];
    const distribution = currentDistributionResult[0];

    // --- 4. Format Data & Calculate Trends ---
    const calculateTrend = (currentVal, previousVal) => {
        if (previousVal === 0) return currentVal > 0 ? 100 : 0;
        if (currentVal === 0 && previousVal > 0) return -100;
        if (currentVal === previousVal) return 0;
        return parseFloat((((currentVal - previousVal) / previousVal) * 100).toFixed(1));
    };

    const formattedStats = {
        totalValue: {
            current: current.totalValue[0]?.total || 0,
            trend: calculateTrend(current.totalValue[0]?.total || 0, previous.totalValue[0]?.total || 0)
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
        }
    };

    const formattedCharts = {
        monthlyAcquisitions: {
            labels: monthlyAcquisitions.map(m => m._id),
            datasets: [{
                label: 'Assets Acquired',
                data: monthlyAcquisitions.map(m => m.count),
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
            requisitions: [] // Placeholder for recent requisitions
        }
    });
});

module.exports = { getDashboardStats };