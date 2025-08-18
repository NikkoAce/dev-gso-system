const PAR = require('../models/PAR');
const Asset = require('../models/Asset');
const mongoose = require('mongoose');

const createPAR = async (req, res) => {
    const { parNumber, custodian, assets, issuedDate, receivedDate } = req.body;

    if (!assets || assets.length === 0) {
        return res.status(400).json({ message: 'PAR must contain at least one asset.' });
    }

    try {
        const par = new PAR({
            parNumber,
            custodian,
            assets,
            issuedDate,
            receivedDate
        });

        const createdPAR = await par.save();

        // Create the history entry
        const historyEntry = {
            event: 'Assignment',
            details: `Assigned to ${custodian.name} via PAR #${parNumber}.`,
            user: req.user ? req.user.name : 'System'
        };

        // Update all associated assets
        const assetObjectIds = assets.map(id => new mongoose.Types.ObjectId(id));
        await Asset.updateMany(
            { _id: { $in: assetObjectIds } },
            { $set: { assignedPAR: parNumber, status: 'In Use' }, $push: { history: historyEntry } }
        );

        res.status(201).json(createdPAR);
    } catch (error) {
        console.error("Error creating PAR:", error);
        res.status(400).json({ message: 'Invalid PAR data', error: error.message });
    }
};

const getPARs = async (req, res) => {
    try {
        const pars = await PAR.find({}).populate('assets').sort({ createdAt: -1 });
        res.json(pars);
    } catch (error) {
        res.status(500).json({ message: 'Server Error' });
    }
};

module.exports = { createPAR, getPARs };
