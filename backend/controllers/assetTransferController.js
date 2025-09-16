const asyncHandler = require('express-async-handler');
const mongoose = require('mongoose');
const Asset = require('../models/Asset');
const PTR = require('../models/PTR');

/**
 * Generates the next sequential PTR number for the current year.
 * Example: PTR-2024-0001
 * @param {mongoose.ClientSession} session - The mongoose session for the transaction.
 */
async function getNextPtrNumber(session) {
    const year = new Date().getFullYear();
    const startOfYear = new Date(year, 0, 1);

    const lastPTR = await PTR.findOne({
        createdAt: { $gte: startOfYear }
    }).sort({ createdAt: -1 }).session(session);

    let sequence = 1;
    if (lastPTR && lastPTR.ptrNumber) {
        const lastSequence = parseInt(lastPTR.ptrNumber.split('-').pop(), 10);
        if (!isNaN(lastSequence)) {
            sequence = lastSequence + 1;
        }
    }
    return `PTR-${year}-${String(sequence).padStart(4, '0')}`;
}

/**
 * @desc    Create a Property Transfer Report (PTR) and transfer assets
 * @route   POST /api/asset-transfers/ptr
 * @access  Private (Requires 'asset:transfer' permission)
 */
const createPtrAndTransferAssets = asyncHandler(async (req, res) => {
    const { assetIds, newOffice, newCustodian, transferDate } = req.body;

    if (!assetIds || !Array.isArray(assetIds) || assetIds.length === 0) {
        return res.status(400).json({ message: 'Asset IDs must be provided as an array.' });
    }
    if (!newOffice || !newCustodian || !newCustodian.name) {
        return res.status(400).json({ message: 'New office and custodian are required.' });
    }
    if (!transferDate) {
        return res.status(400).json({ message: 'Transfer date is required.' });
    }

    const session = await mongoose.startSession();
    session.startTransaction();

    try {
        const assetsToTransfer = await Asset.find({ '_id': { $in: assetIds } }).session(session);
        if (assetsToTransfer.length !== assetIds.length) {
            throw new Error('One or more assets not found.');
        }

        const fromCustodian = assetsToTransfer[0].custodian;
        if (assetsToTransfer.some(a => a.custodian.name !== fromCustodian.name || a.custodian.office !== fromCustodian.office)) {
            throw new Error('All selected assets must have the same current custodian and office.');
        }

        const ptrNumber = await getNextPtrNumber(session);
        const toCustodian = { name: newCustodian.name, designation: newCustodian.designation || '', office: newOffice };

        const newPTR = new PTR({
            ptrNumber,
            from: fromCustodian,
            to: toCustodian,
            assets: assetsToTransfer.map(a => ({ propertyNumber: a.propertyNumber, description: a.description, acquisitionCost: a.acquisitionCost, remarks: '' })),
            date: new Date(transferDate),
            user: req.user.name
        });
        await newPTR.save({ session });

        for (const asset of assetsToTransfer) {
            asset.custodian = toCustodian;
            asset._user = req.user; // For history hook
            await asset.save({ session });
        }

        await session.commitTransaction();
        res.status(200).json({ message: 'Assets transferred successfully.', ptr: newPTR });
    } finally {
        session.endSession();
    }
});

module.exports = { createPtrAndTransferAssets };
