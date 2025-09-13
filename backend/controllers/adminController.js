const asyncHandler = require('express-async-handler');
const Asset = require('../models/Asset');
const ImmovableAsset = require('../models/immovableAsset');
const Employee = require('../models/Employee');
const Category = require('../models/Category');
const StockItem = require('../models/StockItem');
const Requisition = require('../models/Requisition');
const mongoose = require('mongoose');
const { spawn } = require('child_process');

/**
 * @desc    Migrate old asset condition values to the new standardized format.
 * @route   POST /api/admin/migrate-conditions
 * @access  Private/Admin
 */
const migrateAssetConditions = asyncHandler(async (req, res) => {
    // --- MOVABLE ASSETS MIGRATION ---
    const movableUpdatePipeline = [
        {
            $set: {
                condition: {
                    $switch: {
                        branches: [
                            { case: { $in: ['$condition', ['Good', 'good']] }, then: 'Good Condition (G)' },
                            { case: { $in: ['$condition', ['Fair', 'fair']] }, then: 'Fair Condition (F)' },
                            { case: { $in: ['$condition', ['Poor', 'poor', 'Needs Repair', 'needs repair']] }, then: 'Poor Condition (P)' },
                            { case: { $in: ['$condition', ['Scrap', 'scrap', 'For Disposal']] }, then: 'Scrap Condition (S)' },
                        ],
                        default: '$condition' // Keep the original value if no match
                    }
                }
            }
        }
    ];

    const movableResult = await Asset.updateMany(
        {
            condition: { $in: ['Good', 'good', 'Fair', 'fair', 'Poor', 'poor', 'Needs Repair', 'needs repair', 'Scrap', 'scrap', 'For Disposal'] }
        },
        movableUpdatePipeline
    );

    // --- IMMOVABLE ASSETS MIGRATION ---
    const immovableUpdatePipeline = [
        {
            $set: {
                condition: {
                    $switch: {
                        branches: [
                            { case: { $in: ['$condition', ['Good', 'good']] }, then: 'Good Condition (G)' },
                            { case: { $in: ['$condition', ['Fair', 'fair']] }, then: 'Fair Condition (F)' },
                            { case: { $in: ['$condition', ['Poor', 'poor', 'Needs Major Repair']] }, then: 'Poor Condition (P)' },
                            { case: { $in: ['$condition', ['Condemned', 'condemned']] }, then: 'Scrap Condition (S)' },
                        ],
                        default: '$condition'
                    }
                }
            }
        }
    ];

    const immovableResult = await ImmovableAsset.updateMany(
        { condition: { $in: ['Good', 'good', 'Fair', 'fair', 'Poor', 'poor', 'Needs Major Repair', 'Condemned', 'condemned'] } },
        immovableUpdatePipeline
    );

    res.status(200).json({
        message: 'Condition data migration completed successfully.',
        movableAssets: { matched: movableResult.matchedCount, modified: movableResult.modifiedCount },
        immovableAssets: { matched: immovableResult.matchedCount, modified: immovableResult.modifiedCount }
    });
});

/**
 * @desc    Export the entire database to a compressed archive
 * @route   POST /api/admin/export-database
 * @access  Private/Admin
 */
const exportDatabase = (req, res) => {
    const mongoUri = process.env.MONGO_URI;
    if (!mongoUri) {
        // Since this isn't in asyncHandler, we manually send the response.
        return res.status(500).json({ message: 'Database connection string (MONGO_URI) is not configured.' });
    }

    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const filename = `gso-database-backup-${timestamp}.gz`;

    res.setHeader('Content-Type', 'application/gzip');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);

    const mongodump = spawn('mongodump', [
        `--uri=${mongoUri}`,
        '--archive',
        '--gzip'
    ]);

    // Pipe the standard output of mongodump directly to the response stream
    mongodump.stdout.pipe(res);

    // Handle errors from the mongodump process
    mongodump.stderr.on('data', (data) => {
        console.error(`mongodump stderr: ${data}`);
    });

    // If the client closes the connection (e.g., cancels download), kill the mongodump process
    req.on('close', () => {
        mongodump.kill();
    });
};

/**
 * @desc    Runs a data integrity check across multiple collections.
 * @route   GET /api/admin/health-check
 * @access  Private/Admin
 */
const runHealthCheck = asyncHandler(async (req, res) => {
    const [
        orphanedMovableAssetsByCustodian,
        orphanedMovableAssetsByCategory,
        orphanedRequisitionItems,
        orphanedImmovableChildren
    ] = await Promise.all([
        // Check 1: Movable assets with custodians not in the employees collection
        Asset.aggregate([
            { $match: { 'custodian.name': { $exists: true, $ne: 'Unassigned', $ne: null, $ne: '' } } },
            { $lookup: { from: 'employees', localField: 'custodian.name', foreignField: 'name', as: 'custodianEmployee' } },
            { $match: { custodianEmployee: { $eq: [] } } },
            { $project: { propertyNumber: 1, description: 1, 'custodian.name': 1, _id: 0 } }
        ]),

        // Check 2: Movable assets with categories not in the categories collection
        Asset.aggregate([
            { $match: { category: { $exists: true, $ne: null, $ne: '' } } },
            { $lookup: { from: 'categories', localField: 'category', foreignField: 'name', as: 'assetCategory' } },
            { $match: { assetCategory: { $eq: [] } } },
            { $project: { propertyNumber: 1, description: 1, category: 1, _id: 0 } }
        ]),

        // Check 3: Requisition items pointing to non-existent stock items
        Requisition.aggregate([
            { $unwind: '$items' },
            { $lookup: { from: 'stockitems', localField: 'items.stockItem', foreignField: '_id', as: 'stockItemDetail' } },
            { $match: { stockItemDetail: { $eq: [] } } },
            { $project: { risNumber: 1, 'items.description': 1, 'items.stockItem': 1, _id: 0 } }
        ]),

        // Check 4: Immovable assets with a parentAsset ID that doesn't exist
        ImmovableAsset.aggregate([
            { $match: { parentAsset: { $exists: true, $ne: null } } },
            { $lookup: { from: 'immovableassets', localField: 'parentAsset', foreignField: '_id', as: 'parentDetails' } },
            { $match: { parentDetails: { $eq: [] } } },
            { $project: { propertyIndexNumber: 1, name: 1, parentAsset: 1, _id: 0 } }
        ])
    ]);

    res.status(200).json({
        message: 'Data health check completed.',
        report: {
            orphanedMovableAssetsByCustodian,
            orphanedMovableAssetsByCategory,
            orphanedRequisitionItems,
            orphanedImmovableChildren
        }
    });
});

module.exports = { migrateAssetConditions, exportDatabase, runHealthCheck };