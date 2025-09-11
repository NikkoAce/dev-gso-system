const asyncHandler = require('express-async-handler');
const Asset = require('../models/Asset');
const Requisition = require('../models/Requisition');
const ImmovableAsset = require('../models/immovableAsset');
const StockItem = require('../models/StockItem');
const PTR = require('../models/PTR'); // Import the PTR model
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
        status,
        condition
    } = req.query;

    // --- 1. Define Date Filters ---
    const end = endDate ? new Date(endDate) : new Date();
    end.setUTCHours(23, 59, 59, 999);

    const startOfYear = new Date(end.getFullYear(), 0, 1); // Start of the current year
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
    if (condition) {
        interactiveFilter['condition'] = condition;
    }

    // Helper to build a match stage, ensuring it's always an array with a $match operator
    const buildMatchStage = (filterObj) => {
        if (Object.keys(filterObj).length === 0) {
            return [{ $match: {} }]; // Match all documents if no specific filters
        }
        return [{ $match: filterObj }];
    };

    const matchStage = buildMatchStage(interactiveFilter);

    // Create a separate filter for immovable assets that excludes the 'custodian.office' filter,
    // as that field does not exist on the ImmovableAsset model.
    const { 'custodian.office': officeToExclude, ...immovableFilter } = interactiveFilter;
    const immovableMatchStage = buildMatchStage(immovableFilter);


    // --- 2. Define Combined Aggregation Pipelines for Performance ---
    const movableAssetPipeline = Asset.aggregate([
        ...matchStage, // Apply interactive filters at the very beginning for max efficiency
        {
            $facet: {
                currentPeriodStats: [
                    { $match: { acquisitionDate: { $lte: end }, status: { $ne: 'Disposed' } } },
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
                    { $match: { acquisitionDate: { $lte: start }, status: { $ne: 'Disposed' } } },
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
                    { $match: { acquisitionDate: { $lte: end } } },
                    { $group: { _id: '$status', count: { $sum: 1 } } }
                ],
                assetsByOffice: [
                    { $match: { acquisitionDate: { $lte: end } } },
                    { $group: { _id: '$custodian.office', count: { $sum: 1 } } }
                ],
                assetsByCondition: [
                    {
                        $match: { acquisitionDate: { $lte: end } }
                    },
                    {
                        $group: {
                            _id: {
                                // Coalesce null and empty strings into a single "Not Set" category
                                $cond: { if: { $in: ["$condition", [null, ""]] }, then: "Not Set", else: "$condition" }
                            },
                            count: { $sum: 1 }
                        }
                    }
                ],
                recentAssets: [
                    { $match: { acquisitionDate: { $lte: end } } },
                    { $sort: { acquisitionDate: -1, createdAt: -1 } },
                    { $limit: 5 },
                    { $project: { propertyNumber: 1, description: 1, 'custodian.office': 1, acquisitionDate: 1, name: 1, createdAt: 1 } }
                ],
                unassignedAssetsCount: [
                    { $match: { acquisitionDate: { $lte: end }, assignedPAR: { $in: [null, ""] }, assignedICS: { $in: [null, ""] } } },
                    { $count: "count" }
                ]
            }
        }
    ]);

    const immovableAssetPipeline = ImmovableAsset.aggregate([
        ...immovableMatchStage, // Apply filters for status and condition
        {
            $facet: {
                currentImmovableStats: [ { $match: { dateAcquired: { $lte: end }, status: { $ne: 'Disposed' } } }, { $group: { _id: null, totalValue: { $sum: '$assessedValue' } } } ],
                previousImmovableStats: [ { $match: { dateAcquired: { $lte: start }, status: { $ne: 'Disposed' } } }, { $group: { _id: null, totalValue: { $sum: '$assessedValue' } } } ],
                currentImmovableCount: [ { $match: { dateAcquired: { $lte: end }, status: { $ne: 'Disposed' } } }, { $count: 'count' } ],
                previousImmovableCount: [ { $match: { dateAcquired: { $lte: start }, status: { $ne: 'Disposed' } } }, { $count: 'count' } ]
            }
        }
    ]);

    const requisitionPipeline = Requisition.aggregate([
        {
            $facet: {
                currentPendingReqs: [ { $match: { status: 'Pending', dateRequested: { $lte: end } } }, { $count: 'count' } ],
                previousPendingReqs: [ { $match: { status: 'Pending', dateRequested: { $lt: start } } }, { $count: 'count' } ],
                recentRequisitions: [
                    { $match: { dateRequested: { $lte: end } } },
                    { $sort: { dateRequested: -1, createdAt: -1 } },
                    { $limit: 5 },
                    { $project: { risNumber: 1, requestingOffice: 1, status: 1 } }
                ]
            }
        }
    ]);

    const lowStockCountPipeline = StockItem.countDocuments({
        $expr: { $lte: ["$quantity", "$reorderPoint"] }
    });

    // NEW: Pipeline for Recent Transfers
    const recentTransfersPipeline = PTR.aggregate([
        { $match: { date: { $lte: end } } }, // Filter by end date
        { $sort: { date: -1, createdAt: -1 } }, // Sort by transfer date, most recent first
        { $limit: 5 }, // Get the top 5 recent transfers
        { $project: { ptrNumber: 1, date: 1, 'from.name': 1, 'from.office': 1, 'to.name': 1, 'to.office': 1, assets: 1 } }
    ]);

    // NEW: Pipeline for Recent Immovable Assets
    const recentImmovableAssetsPipeline = ImmovableAsset.aggregate([
        { $match: { dateAcquired: { $lte: end } } }, // Filter by end date
        { $sort: { dateAcquired: -1, createdAt: -1 } }, // Sort by acquisition date, then creation date
        { $limit: 5 }, // Get the top 5 recent immovable assets
        { $project: { propertyIndexNumber: 1, name: 1, type: 1, location: 1, dateAcquired: 1 } }
    ]);



    // NEW: Pipeline for Total Depreciation (Year-to-Date)
    const totalDepreciationPipeline = Asset.aggregate([
        ...matchStage,
        { $match: { acquisitionDate: { $lte: end } } },
        {
            $addFields: {
                depreciableCost: { $subtract: ["$acquisitionCost", { $ifNull: ["$salvageValue", 0] }] },
                annualDepreciation: {
                    $cond: {
                        if: { $gt: ["$usefulLife", 0] },
                        then: { $divide: [{ $subtract: ["$acquisitionCost", { $ifNull: ["$salvageValue", 0] }] }, "$usefulLife"] },
                        else: 0
                    }
                }
            }
        },
        {
            $group: {
                _id: null,
                totalDepreciationYTD: {
                    $sum: {
                        $min: ["$depreciableCost", { $multiply: ["$annualDepreciation", { $divide: [{ $subtract: [end, { $max: ["$acquisitionDate", startOfYear] }] }, 1000 * 60 * 60 * 24 * 365.25] }] }]
                    }
                }
            }
        }
    ]);

    // NEW: Pipeline for Assets Nearing End of Life (within the next year)
    const oneYearFromNow = new Date(end);
    oneYearFromNow.setFullYear(end.getFullYear() + 1);

    const nearingEndOfLifeCountPipeline = Asset.aggregate([
        ...matchStage,
        {
            $match: {
                acquisitionDate: { $lte: end }, // Asset must exist as of the report date
                status: { $in: ['In Use', 'In Storage'] },
                usefulLife: { $gt: 0 }
            }
        },
        {
            $addFields: {
                endOfLifeDate: { $dateAdd: { startDate: "$acquisitionDate", unit: "year", amount: "$usefulLife" } }
            }
        },
        {
            $match: {
                endOfLifeDate: { $lte: oneYearFromNow, $gt: end }
            }
        },
        { $count: "count" }
    ]);

    // NEW: Pipeline for Top 5 Requested Supplies (last 90 days)
    const ninetyDaysAgo = new Date(end);
    ninetyDaysAgo.setDate(end.getDate() - 90);

    const topSuppliesPipeline = Requisition.aggregate([
        {
            $match: {
                status: 'Issued',
                // Using dateRequested as the filter date. A dedicated `dateIssued` would be more accurate if available.
                dateRequested: { $gte: ninetyDaysAgo, $lte: end }
            }
        },
        { $unwind: '$items' },
        {
            $match: {
                'items.quantityIssued': { $gt: 0 } // Only consider items that were actually issued
            }
        },
        {
            $group: {
                _id: '$items.stockItem',
                totalIssued: { $sum: '$items.quantityIssued' }
            }
        },
        { $sort: { totalIssued: -1 } },
        { $limit: 5 },
        {
            $lookup: {
                from: 'stockitems', // The collection name for StockItem model
                localField: '_id',
                foreignField: '_id',
                as: 'stockItemInfo'
            }
        },
        { $unwind: { path: '$stockItemInfo', preserveNullAndEmptyArrays: true } }, // Use preserve to not lose items if stock item is deleted
        { $project: { _id: 0, description: { $ifNull: ['$stockItemInfo.description', 'Unknown Item'] }, stockNumber: { $ifNull: ['$stockItemInfo.stockNumber', 'N/A'] }, totalIssued: '$totalIssued' } }
    ]);

    // NEW: Pipeline for Average Requisition Fulfillment Time
    const avgFulfillmentTimePipeline = Requisition.aggregate([
        {
            $match: {
                status: 'Issued',
                // Filter by when the requisition was fulfilled (i.e., when its status was updated to 'Issued')
                updatedAt: { $gte: start, $lte: end }
            }
        },
        {
            $project: {
                fulfillmentTime: { $subtract: ["$updatedAt", "$dateRequested"] }
            }
        },
        {
            $group: {
                _id: null,
                avgTime: { $avg: "$fulfillmentTime" }
            }
        }
    ]);

    // NEW: Pipeline for Sparkline Data (last 30 days)
    const thirtyDaysAgo = new Date(end);
    thirtyDaysAgo.setDate(end.getDate() - 30);

    const sparklineDataPipeline = Asset.aggregate([
        ...matchStage,
        { $match: { acquisitionDate: { $lte: end } } },
        {
            $facet: {
                initialTotals: [
                    { $match: { acquisitionDate: { $lt: thirtyDaysAgo } } },
                    {
                        $group: {
                            _id: null,
                            assetCount: { $sum: 1 },
                            portfolioValue: { $sum: '$acquisitionCost' }
                        }
                    }
                ],
                dailyChanges: [
                    { $match: { acquisitionDate: { $gte: thirtyDaysAgo, $lte: end } } },
                    {
                        $group: {
                            _id: { $dateToString: { format: "%Y-%m-%d", date: "$acquisitionDate" } },
                            assetCount: { $sum: 1 },
                            portfolioValue: { $sum: '$acquisitionCost' }
                        }
                    },
                    { $sort: { _id: 1 } }
                ]
            }
        }
    ]);

    // --- 3. Execute all queries concurrently ---
    const [
        movableAssetResults,
        immovableAssetResults,
        requisitionResults,
        lowStockCount,
        totalDepreciationResult,
        nearingEndOfLifeResult,
        recentTransfersResult, // Existing
        recentImmovableAssetsResult, // NEW
        topSuppliesResult,
        avgFulfillmentTimeResult, // NEW
        sparklineDataResult // NEW
    ] = await Promise.all([
        movableAssetPipeline,
        immovableAssetPipeline,
        requisitionPipeline,
        lowStockCountPipeline,
        totalDepreciationPipeline,
        nearingEndOfLifeCountPipeline,
        recentTransfersPipeline, // Existing
        recentImmovableAssetsPipeline, // NEW
        topSuppliesPipeline,
        avgFulfillmentTimePipeline, // NEW
        sparklineDataPipeline // NEW
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
    const unassignedAssetsCount = ma.unassignedAssetsCount?.[0]?.count || 0;

    const currentImmovableStats = ia.currentImmovableStats || [];
    const previousImmovableStats = ia.previousImmovableStats || [];
    const currentImmovableCount = ia.currentImmovableCount?.[0]?.count || 0;
    const previousImmovableCount = ia.previousImmovableCount?.[0]?.count || 0;

    const currentPendingReqs = rq.currentPendingReqs?.[0]?.count || 0;
    const previousPendingReqs = rq.previousPendingReqs?.[0]?.count || 0;
    const recentRequisitions = rq.recentRequisitions || [];

    const totalDepreciationYTD = totalDepreciationResult[0]?.totalDepreciationYTD || 0;
    const nearingEndOfLifeCount = nearingEndOfLifeResult[0]?.count || 0;
    const recentTransfers = recentTransfersResult || [];
    const recentImmovableAssets = recentImmovableAssetsResult || []; // NEW
    const topSupplies = topSuppliesResult || [];
    
    // NEW: Calculate average fulfillment time in days
    const avgTimeInMs = avgFulfillmentTimeResult[0]?.avgTime || 0;
    const avgFulfillmentTimeInDays = avgTimeInMs > 0 ? (avgTimeInMs / (1000 * 60 * 60 * 24)) : 0;

    // NEW: Process sparkline data
    const sparklineResults = sparklineDataResult[0] || {};
    const initialTotals = sparklineResults.initialTotals?.[0] || { assetCount: 0, portfolioValue: 0 };
    const dailyChangesMap = new Map(
        (sparklineResults.dailyChanges || []).map(d => [d._id, { assetCount: d.assetCount, portfolioValue: d.portfolioValue }])
    );

    let currentAssetTotal = initialTotals.assetCount;
    let currentPortfolioValue = initialTotals.portfolioValue;
    const assetSparkline = [];
    const portfolioSparkline = [];

    for (let i = 0; i < 30; i++) {
        const date = new Date(end);
        date.setDate(end.getDate() - (29 - i));
        const dateString = date.toISOString().split('T')[0];
        const dailyChange = dailyChangesMap.get(dateString);
        if (dailyChange) {
            currentAssetTotal += dailyChange.assetCount;
            currentPortfolioValue += dailyChange.portfolioValue;
        }
        assetSparkline.push(currentAssetTotal);
        portfolioSparkline.push(currentPortfolioValue);
    }
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
            trend: calculateTrend(totalPortfolioValueCurrent, totalPortfolioValuePrevious),
            sparkline: portfolioSparkline // NEW
        },
        movableAssetsValue: {
            current: currentMovableValue,
            trend: calculateTrend(currentMovableValue, previousMovableValue)
        },
        immovableAssetsValue: {
            current: currentImmovableValue,
            trend: calculateTrend(currentImmovableValue, previousImmovableValue)
        },
        lowStockItems: {
            current: lowStockCount,
            trend: 0
        },
        totalAssets: {
            current: currentStats.totalAssets || 0,
            trend: calculateTrend(currentStats.totalAssets || 0, previousStats.totalAssets || 0),
            sparkline: assetSparkline // NEW
        },
        pendingRequisitions: {
            current: currentPendingReqs,
            trend: calculateTrend(currentPendingReqs, previousPendingReqs)
        },
        immovableAssets: {
            current: currentImmovableCount,
            trend: calculateTrend(currentImmovableCount, previousImmovableCount)
        },
        unassignedAssets: { // NEW
            current: unassignedAssetsCount,
            trend: 0 // No trend calculation for this yet, can be added later if needed
        },
        totalDepreciationYTD: {
            current: totalDepreciationYTD,
            trend: 0
        },
        nearingEndOfLife: {
            current: nearingEndOfLifeCount,
            trend: 0
        },
        avgFulfillmentTime: { // NEW
            current: avgFulfillmentTimeInDays,
            trend: 0 // No trend for this KPI yet
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
        recentAssets,
        recentRequisitions,
        recentTransfers,
        recentImmovableAssets, // NEW
        topSupplies
    });
});

/**
 * @desc    Get detailed list of pending requisitions
 * @route   GET /api/dashboard/details/pending-requisitions
 * @access  Private/Admin
 */
const getPendingRequisitionsDetails = asyncHandler(async (req, res) => {
    const requisitions = await Requisition.find({ status: 'Pending' })
        .sort({ dateRequested: -1 })
        .select('risNumber requestingOffice dateRequested status items')
        .populate('items.stockItem', 'description unitOfMeasure')
        .lean();
    res.json(requisitions);
});

/**
 * @desc    Get detailed list of low stock items
 * @route   GET /api/dashboard/details/low-stock-items
 * @access  Private/Admin
 */
const getLowStockItemsDetails = asyncHandler(async (req, res) => {
    const lowStockItems = await StockItem.find({
        $expr: { $lte: ["$quantity", "$reorderPoint"] }
    })
    .sort({ description: 1 })
    .select('stockNumber description quantity reorderPoint unitOfMeasure')
    .lean();
    res.json(lowStockItems);
});

/**
 * @desc    Get detailed list of unassigned assets
 * @route   GET /api/dashboard/details/unassigned-assets
 * @access  Private/Admin
 */
const getUnassignedAssetsDetails = asyncHandler(async (req, res) => {
    const unassignedAssets = await Asset.find({
        assignedPAR: { $in: [null, ""] },
        assignedICS: { $in: [null, ""] }
    })
    .sort({ createdAt: -1 })
    .select('propertyNumber description acquisitionCost acquisitionDate')
    .lean();
    res.json(unassignedAssets);
});

/**
 * @desc    Get detailed list of assets nearing end of life
 * @route   GET /api/dashboard/details/nearing-eol
 * @access  Private/Admin
 */
const getNearingEOLDetails = asyncHandler(async (req, res) => {
    const oneYearFromNow = new Date();
    oneYearFromNow.setFullYear(new Date().getFullYear() + 1);

    const assets = await Asset.aggregate([
        { $match: { status: { $in: ['In Use', 'In Storage'] }, usefulLife: { $gt: 0 } } },
        { $addFields: { endOfLifeDate: { $dateAdd: { startDate: "$acquisitionDate", unit: "year", amount: "$usefulLife" } } } },
        { $match: { endOfLifeDate: { $lte: oneYearFromNow, $gt: new Date() } } },
        { $sort: { endOfLifeDate: 1 } },
        { $project: { propertyNumber: 1, description: 1, endOfLifeDate: 1, acquisitionDate: 1, 'custodian.name': 1 } }
    ]);
    res.json(assets);
});

module.exports = { getDashboardStats, getPendingRequisitionsDetails, getLowStockItemsDetails, getUnassignedAssetsDetails, getNearingEOLDetails };
