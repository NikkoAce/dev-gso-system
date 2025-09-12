const asyncHandler = require('express-async-handler');
const Asset = require('../models/Asset');
const ImmovableAsset = require('../models/immovableAsset');
const mongoose = require('mongoose');

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
const exportDatabase = asyncHandler(async (req, res) => {
    const db = mongoose.connection.db;
    const collections = await db.listCollections().toArray();
    const collectionNames = collections.map(c => c.name).filter(name => !name.startsWith('system.'));

    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const fileName = `gso-database-backup-${timestamp}.json`;

    res.setHeader('Content-Type', 'application/json');
    res.setHeader('Content-Disposition', `attachment; filename="${fileName}"`);

    // Start the JSON object
    res.write('{\n');

    for (let i = 0; i < collectionNames.length; i++) {
        const collectionName = collectionNames[i];
        res.write(`  "${collectionName}": [\n`);

        const cursor = db.collection(collectionName).find();
        let firstDoc = true;

        // Stream documents from the collection
        for await (const doc of cursor) {
            if (!firstDoc) {
                res.write(',\n');
            }
            res.write('    ' + JSON.stringify(doc));
            firstDoc = false;
        }

        res.write('\n  ]');
        if (i < collectionNames.length - 1) {
            res.write(',\n');
        } else {
            res.write('\n');
        }
    }

    // End the JSON object and the response
    res.write('}\n');
    res.end();
});

module.exports = { migrateAssetConditions, exportDatabase };