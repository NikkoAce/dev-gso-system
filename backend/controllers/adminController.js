const asyncHandler = require('express-async-handler');
const Asset = require('../models/Asset');
const ImmovableAsset = require('../models/immovableAsset');
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

module.exports = { migrateAssetConditions, exportDatabase };