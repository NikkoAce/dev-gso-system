const asyncHandler = require('express-async-handler');
const ImmovableAsset = require('../models/immovableAsset');

/**
 * Helper function to compare fields and generate history logs for immovable assets.
 * @param {object} original - The original asset object before updates.
 * @param {object} updates - The incoming update data from the request body.
 * @param {object} user - The authenticated user performing the action.
 * @returns {Array<object>} An array of history entry objects.
 */
const generateUpdateHistory = (original, updates, user) => {
    const historyEntries = [];
    const user_name = user.name;

    const format = (value, field) => {
        if (value instanceof Date) return value.toLocaleDateString('en-CA');
        if (field === 'assessedValue' && typeof value === 'number') {
            return new Intl.NumberFormat('en-PH', { style: 'currency', currency: 'PHP' }).format(value);
        }
        if (value === null || value === undefined || value === '') return 'empty';
        return `"${value}"`;
    };

    const compareAndLog = (field, fieldName) => {
        if (updates[field] === undefined) return;

        const originalValue = original[field];
        let updatedValue = updates[field];

        // Handle date comparison by comparing YYYY-MM-DD strings
        if (originalValue instanceof Date) {
            if (new Date(originalValue).toISOString().split('T')[0] !== new Date(updatedValue).toISOString().split('T')[0]) {
                historyEntries.push({ event: 'Updated', details: `${fieldName} changed from ${format(originalValue, field)} to ${format(new Date(updatedValue), field)}.`, user: user_name });
            }
            return;
        }

        // Handle numeric comparison
        if (typeof originalValue === 'number') {
            if (parseFloat(originalValue) !== parseFloat(updatedValue)) {
                historyEntries.push({ event: 'Updated', details: `${fieldName} changed from ${format(originalValue, field)} to ${format(parseFloat(updatedValue), field)}.`, user: user_name });
            }
            return;
        }

        // Default string comparison
        if (String(originalValue ?? '') !== String(updatedValue ?? '')) {
            historyEntries.push({ event: 'Updated', details: `${fieldName} changed from ${format(originalValue, field)} to ${format(updatedValue, field)}.`, user: user_name });
        }
    };

    // Compare core fields
    compareAndLog('name', 'Name');
    compareAndLog('type', 'Type');
    compareAndLog('location', 'Location');
    compareAndLog('dateAcquired', 'Date Acquired');
    compareAndLog('assessedValue', 'Assessed Value');
    compareAndLog('status', 'Status');
    compareAndLog('acquisitionMethod', 'Acquisition Method');
    compareAndLog('condition', 'Condition');
    compareAndLog('remarks', 'Remarks');

    return historyEntries;
};

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
        name, propertyIndexNumber, type, location, dateAcquired, assessedValue, // Core fields
        status, acquisitionMethod, condition, remarks, components,
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
        status, acquisitionMethod, condition, remarks, components,
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

    // Generate detailed history entries based on what changed
    const historyEntries = generateUpdateHistory(asset.toObject(), req.body, req.user);
    if (historyEntries.length > 0) {
        asset.history.push(...historyEntries);
    }

    // Use asset.set() to apply updates from the request body.
    // This is safer than Object.assign() as it respects schema paths.
    asset.set(req.body);

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
