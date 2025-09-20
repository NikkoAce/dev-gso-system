const asyncHandler = require('express-async-handler');
const Setting = require('../models/Setting');

/**
 * @desc    Get all signatory settings
 * @route   GET /api/signatories
 * @access  Private (settings:read)
 */
const getSignatorySettings = asyncHandler(async (req, res) => {
    // For now, we fetch all settings. This could be refined later if more setting types are added.
    const settings = await Setting.find({}).lean();
    res.status(200).json(settings);
});

/**
 * @desc    Update or create signatory settings
 * @route   POST /api/signatories
 * @access  Private (settings:manage)
 */
const updateSignatorySettings = asyncHandler(async (req, res) => {
    const settingsToSave = req.body;

    if (!Array.isArray(settingsToSave)) {
        res.status(400);
        throw new Error('Invalid data format. Expected an array of settings.');
    }

    const operations = settingsToSave.map(setting => ({
        updateOne: {
            filter: { key: setting.key },
            update: { $set: { value: setting.value } },
            upsert: true,
        }
    }));

    if (operations.length > 0) {
        await Setting.bulkWrite(operations);
    }

    res.status(200).json({ message: 'Settings updated successfully.' });
});

module.exports = {
    getSignatorySettings,
    updateSignatorySettings,
};