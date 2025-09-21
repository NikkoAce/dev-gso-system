const asyncHandler = require('express-async-handler');
const Asset = require('../models/Asset');
const { getIo } = require('../config/socket');

/**
 * @desc    Update multiple assets based on physical count data
 * @route   PUT /api/physical-count
 * @access  Private (Requires 'asset:update' permission)
 */
const updatePhysicalCount = asyncHandler(async (req, res) => {
    const { updates } = req.body;

    if (!Array.isArray(updates)) {
        return res.status(400).json({ message: 'Invalid data format. Expected an array of updates.' });
    }

    const updatePromises = updates.map(async (update) => {
        const asset = await Asset.findById(update.id);
        if (!asset) {
            console.warn(`Asset with ID ${update.id} not found during physical count. Skipping.`);
            return null;
        }

        asset.status = update.status;
        asset.condition = update.condition;
        asset.remarks = update.remarks;
        asset._user = req.user;
        asset._historyEvent = 'Physical Count';

        return asset.save();
    });

    const savedAssets = (await Promise.all(updatePromises)).filter(Boolean);
    const io = getIo();

    savedAssets.forEach(asset => {
        if (asset.custodian && asset.custodian.office) {
            const room = `office:${asset.custodian.office}`;
            io.to(room).emit('asset-updated', asset.toObject());
        }
    });

    res.json({ message: 'Physical count updated successfully.' });
});

/**
 * @desc    Update the verification status of a single asset
 * @route   PUT /api/physical-count/:id/verify
 * @access  Private (Requires 'asset:update' permission)
 */
const verifyAssetForPhysicalCount = asyncHandler(async (req, res) => {
    const { verified } = req.body;
    const asset = await Asset.findById(req.params.id);

    if (!asset) {
        res.status(404);
        throw new Error('Asset not found');
    }

    asset.physicalCountDetails = verified
        ? { verified: true, verifiedBy: req.user.name, verifiedAt: new Date() }
        : { verified: false, verifiedBy: null, verifiedAt: null };

    const updatedAsset = await asset.save();
    const io = getIo();

    if (updatedAsset.custodian && updatedAsset.custodian.office) {
        const room = `office:${updatedAsset.custodian.office}`;
        io.to(room).emit('asset-verified', updatedAsset.toObject());
    }

    res.status(200).json(updatedAsset.physicalCountDetails);
});

/**
 * @desc    Export physical count results for a specific office to CSV
 * @route   GET /api/physical-count/export
 * @access  Private (Requires 'asset:export' permission)
 */
const exportPhysicalCountResults = asyncHandler((req, res) => {
    const { office } = req.query;
    if (!office) return res.status(400).json({ message: 'Office parameter is required.' });

    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', `attachment; filename="physical_count_${office.replace(/\s+/g, '_')}.csv"`);

    const headers = ['Property Number', 'Description', 'Custodian', 'Status', 'Condition', 'Remarks', 'Verification Status', 'Verified By', 'Verified At'];
    res.write(headers.join(',') + '\n');

    const cursor = Asset.find({ 'custodian.office': office }).sort({ propertyNumber: 1 }).lean().cursor();

    cursor.on('data', (asset) => {
        const { verified, verifiedBy, verifiedAt } = asset.physicalCountDetails || {};
        const row = [asset.propertyNumber, `"${(asset.description || '').replace(/"/g, '""')}"`, asset.custodian?.name || '', asset.status || '', asset.condition || '', `"${(asset.remarks || '').replace(/"/g, '""')}"`, verified ? 'Verified' : 'Unverified', verifiedBy || '', verifiedAt ? new Date(verifiedAt).toLocaleDateString('en-CA') : ''];
        res.write(row.join(',') + '\n');
    });

    cursor.on('end', () => res.end());
    cursor.on('error', (error) => { console.error('Error streaming physical count export:', error); res.end(); });
});

/**
 * @desc    Get a single asset by its property number
 * @route   GET /api/physical-count/by-property-number/:propertyNumber
 * @access  Private (Requires 'asset:read' permission)
 */
const getAssetByPropertyNumber = asyncHandler(async (req, res) => {
    const { propertyNumber } = req.params;
    // Find one asset by its unique property number.
    const asset = await Asset.findOne({ propertyNumber: propertyNumber }).lean();

    if (asset) {
        res.json(asset);
    } else {
        res.status(404);
        throw new Error('Asset not found with the specified property number.');
    }
});

/**
 * @desc    Update a single asset's status, condition, and remarks during physical count
 * @route   PUT /api/physical-count/:id
 * @access  Private (Requires 'asset:update' permission)
 */
const updateSingleAssetPhysicalCount = asyncHandler(async (req, res) => {
    const { status, condition, remarks } = req.body;
    const asset = await Asset.findById(req.params.id);

    if (!asset) {
        res.status(404);
        throw new Error('Asset not found');
    }

    asset.status = status;
    asset.condition = condition;
    asset.remarks = remarks;
    asset._user = req.user;
    asset._historyEvent = 'Physical Count';

    const updatedAsset = await asset.save();
    const io = getIo();

    if (updatedAsset.custodian && updatedAsset.custodian.office) {
        const room = `office:${updatedAsset.custodian.office}`;
        io.to(room).emit('asset-updated', updatedAsset.toObject());
    }

    res.status(200).json(updatedAsset);
});

module.exports = {
    updatePhysicalCount,
    verifyAssetForPhysicalCount,
    exportPhysicalCountResults,
    getAssetByPropertyNumber,
    updateSingleAssetPhysicalCount
};
