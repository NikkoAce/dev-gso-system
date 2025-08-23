const asyncHandler = require('express-async-handler');
const ImmovableAsset = require('../models/immovableAsset');

/**
 * @desc    Get all immovable assets
 * @route   GET /api/immovable-assets
 * @access  Private (GSO)
 */
const getImmovableAssets = asyncHandler(async (req, res) => {
    // Fetch all assets and sort by the most recently created
    const assets = await ImmovableAsset.find({}).sort({ createdAt: -1 });
    res.status(200).json(assets);
});

/**
 * @desc    Create a new immovable asset
 * @route   POST /api/immovable-assets
 * @access  Private (GSO)
 */
const createImmovableAsset = asyncHandler(async (req, res) => {
    // Destructure all possible fields from the request body
    const {
        name, propertyIndexNumber, type, location, dateAcquired, assessedValue,
        status, acquisitionMethod, condition, remarks,
        landDetails, buildingAndStructureDetails, roadNetworkDetails, otherInfrastructureDetails
    } = req.body;

    // Basic validation for required fields
    if (!name || !propertyIndexNumber || !type || !location || !dateAcquired || !assessedValue) {
        res.status(400);
        throw new Error('Please provide all required core asset fields.');
    }

    // Check if an asset with the same Property Index Number (PIN) already exists
    const assetExists = await ImmovableAsset.findOne({ propertyIndexNumber });
    if (assetExists) {
        res.status(400);
        throw new Error('An asset with this Property Index Number (PIN) already exists.');
    }

    // Create a new asset instance
    const asset = new ImmovableAsset({
        name, propertyIndexNumber, type, location, dateAcquired, assessedValue,
        status, acquisitionMethod, condition, remarks,
        landDetails, buildingAndStructureDetails, roadNetworkDetails, otherInfrastructureDetails
    });

    // Add the initial history entry using the authenticated user's name
    asset.history.push({
        event: 'Asset Created',
        details: `Initial record for '${asset.name}' created.`,
        user: req.user.name
    });

    const createdAsset = await asset.save();
    res.status(201).json(createdAsset);
});

const getImmovableAssetById = asyncHandler(async (req, res) => {
    const asset = await ImmovableAsset.findById(req.params.id);
    if (asset) {
        res.json(asset);
    } else {
        res.status(404);
        throw new Error('Asset not found');
    }
});

const updateImmovableAsset = asyncHandler(async (req, res) => {
    const asset = await ImmovableAsset.findById(req.params.id);

    if (!asset) {
        res.status(404);
        throw new Error('Asset not found');
    }

    // Log the update event in the asset's history
    asset.history.push({
        event: 'Updated',
        details: 'Asset details were updated.',
        user: req.user.name
    });

    // Update fields from request body
    Object.assign(asset, req.body);

    const updatedAsset = await asset.save();
    res.json(updatedAsset);
});

const deleteImmovableAsset = asyncHandler(async (req, res) => {
    const asset = await ImmovableAsset.findById(req.params.id);
    if (asset) {
        // Perform a "soft delete" by changing the status, which is better for auditing.
        asset.status = 'Disposed';
        asset.history.push({
            event: 'Disposed',
            details: 'Asset marked as disposed.',
            user: req.user.name
        });
        await asset.save();
        res.json({ message: 'Asset marked as disposed' });
    } else {
        res.status(404);
        throw new Error('Asset not found');
    }
});

module.exports = {
    createImmovableAsset,
    getImmovableAssets,
    getImmovableAssetById,
    updateImmovableAsset,
    deleteImmovableAsset
};
