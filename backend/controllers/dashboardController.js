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

    // --- Build Date Filter ---
    const dateFilter = {};
    if (startDate) {
        dateFilter.$gte = new Date(startDate);
    }
    if (endDate) {
        // Set to the end of the selected day
        const endOfDay = new Date(endDate);
        endOfDay.setUTCHours(23, 59, 59, 999);
        dateFilter.$lte = endOfDay;
    }
    const hasDateFilter = Object.keys(dateFilter).length > 0;

    // --- Aggregations & Queries ---
    const assetStatsPipeline = [
        // Optional: Match by date if filters are provided
        ...(hasDateFilter ? [{ $match: { createdAt: dateFilter } }] : []),
        {
            $facet: {
                totalValue: [
                    { $group: { _id: null, total: { $sum: '$acquisitionCost' } } }
                ],
                totalAssets: [
                    { $count: 'count' }
                ],
                assetsByStatus: [
                    { $group: { _id: '$status', count: { $sum: 1 } } }
                ],
                assetsByOffice: [
                    { $group: { _id: '$custodian.office', count: { $sum: 1 } } }
                ],
                monthlyAcquisitions: [
                    {
                        $group: {
                            _id: { $dateToString: { format: "%Y-%m", date: "$acquisitionDate" } },
                            count: { $sum: 1 }
                        }
                    },
                    { $sort: { _id: 1 } }
                ]
            }
        }
    ];

    const [assetStatsResult, pendingRequisitions, recentAssets] = await Promise.all([
        Asset.aggregate(assetStatsPipeline),
        Requisition.countDocuments({ status: 'Pending' }),
        Asset.find(hasDateFilter ? { createdAt: dateFilter } : {}).sort({ createdAt: -1 }).limit(5).populate('custodian', 'name office')
    ]);

    const stats = assetStatsResult[0];

    // --- Format Data for Frontend ---
    const formattedStats = {
        totalValue: { current: stats.totalValue[0]?.total || 0, trend: 0 },
        totalAssets: { current: stats.totalAssets[0]?.count || 0, trend: 0 },
        forRepair: { current: stats.assetsByStatus.find(s => s._id === 'For Repair')?.count || 0, trend: 0 },
        disposed: { current: stats.assetsByStatus.find(s => s._id === 'Disposed')?.count || 0, trend: 0 },
        pendingRequisitions: { current: pendingRequisitions, trend: 0 }
    };

    const formattedCharts = {
        monthlyAcquisitions: {
            labels: stats.monthlyAcquisitions.map(m => m._id),
            datasets: [{
                label: 'Assets Acquired',
                data: stats.monthlyAcquisitions.map(m => m.count),
                backgroundColor: 'rgba(75, 192, 192, 0.2)',
                borderColor: 'rgba(75, 192, 192, 1)',
                borderWidth: 1,
                tension: 0.1
            }]
        },
        assetsByOffice: {
            labels: stats.assetsByOffice.map(o => o._id || 'Unassigned'),
            datasets: [{
                label: 'Assets by Office',
                data: stats.assetsByOffice.map(o => o.count)
            }]
        },
        assetStatus: {
            labels: stats.assetsByStatus.map(s => s._id),
            datasets: [{
                label: 'Asset Status',
                data: stats.assetsByStatus.map(s => s.count)
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