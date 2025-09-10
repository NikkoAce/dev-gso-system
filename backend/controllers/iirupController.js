const IIRUP = require('../models/IIRUP');
const Asset = require('../models/Asset');
const mongoose = require('mongoose');

async function getNextIIRUPNumber() {
    const year = new Date().getFullYear();
    const startOfYear = new Date(year, 0, 1);

    const lastSlip = await IIRUP.findOne({
        createdAt: { $gte: startOfYear }
    }).sort({ createdAt: -1 });

    let sequence = 1;
    if (lastSlip && lastSlip.iirupNumber) {
        const lastSequence = parseInt(lastSlip.iirupNumber.split('-').pop(), 10);
        if (!isNaN(lastSequence)) {
            sequence = lastSequence + 1;
        }
    }
    return `IIRUP-${year}-${String(sequence).padStart(4, '0')}`;
}

const createIIRUP = async (req, res) => {
    const { assetIds } = req.body;
    const { name, office } = req.user;

    if (!assetIds || assetIds.length === 0) {
        return res.status(400).json({ message: 'Must contain at least one asset.' });
    }

    const session = await mongoose.startSession();
    session.startTransaction();

    try {
        const assets = await Asset.find({ _id: { $in: assetIds } }).session(session);
        if (assets.length !== assetIds.length) {
            throw new Error('One or more selected assets are not found.');
        }

        const iirupNumber = await getNextIIRUPNumber();
        
        const newIIRUP = new IIRUP({
            iirupNumber,
            date: new Date(),
            assets: assets.map(a => ({ propertyNumber: a.propertyNumber, description: a.description, acquisitionCost: a.acquisitionCost, remarks: a.condition })),
            user: { name, office }
        });

        await newIIRUP.save({ session });
        const historyEntry = { event: 'Inspection', details: `Included in IIRUP #${iirupNumber}.`, user: name };
        await Asset.updateMany({ _id: { $in: assetIds } }, { $push: { history: historyEntry } }, { session });

        await session.commitTransaction();
        res.status(201).json(newIIRUP);
    } catch (error) {
        await session.abortTransaction();
        res.status(400).json({ message: 'Failed to create IIRUP slip.', error: error.message });
    } finally {
        session.endSession();
    }
};

module.exports = { createIIRUP };
