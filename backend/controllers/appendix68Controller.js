const Appendix68 = require('../models/Appendix68');
const Asset = require('../models/Asset');
const mongoose = require('mongoose');

async function getNextAppendix68Number() {
    const year = new Date().getFullYear();
    const startOfYear = new Date(year, 0, 1);

    const lastSlip = await Appendix68.findOne({
        createdAt: { $gte: startOfYear }
    }).sort({ createdAt: -1 });

    let sequence = 1;
    if (lastSlip && lastSlip.appendixNumber) {
        const lastSequence = parseInt(lastSlip.appendixNumber.split('-').pop(), 10);
        if (!isNaN(lastSequence)) {
            sequence = lastSequence + 1;
        }
    }
    return `A68-${year}-${String(sequence).padStart(4, '0')}`;
}

const createAppendix68 = async (req, res) => {
    const { assetIds } = req.body;
    const { name, office } = req.user;

    if (!assetIds || assetIds.length === 0) {
        return res.status(400).json({ message: 'Must contain at least one asset.' });
    }

    const session = await mongoose.startSession();
    session.startTransaction();

    try {
        const assets = await Asset.find({ _id: { $in: assetIds }, status: { $ne: 'Disposed' } }).session(session);
        if (assets.length !== assetIds.length) {
            throw new Error('One or more selected assets are not found or have already been disposed.');
        }

        const appendixNumber = await getNextAppendix68Number();
        
        const newAppendix68 = new Appendix68({
            appendixNumber,
            date: new Date(),
            assets: assets.map(a => ({ propertyNumber: a.propertyNumber, description: a.description })),
            user: { name, office }
        });

        const savedSlip = await newAppendix68.save({ session });

        const historyEntry = { event: 'Certified as Waste', details: `Included in Report of Waste Materials (Appendix 68) #${appendixNumber}.`, user: name };
        await Asset.updateMany({ _id: { $in: assetIds } }, { $set: { status: 'Waste' }, $push: { history: historyEntry } }, { session });

        await session.commitTransaction();
        res.status(201).json(savedSlip);
    } catch (error) {
        await session.abortTransaction();
        console.error("Error creating Appendix 68:", error);
        res.status(400).json({ message: 'Failed to create Appendix 68 slip.', error: error.message });
    } finally {
        session.endSession();
    }
};

module.exports = { createAppendix68 };