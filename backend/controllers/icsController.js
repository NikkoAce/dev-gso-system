const ICS = require('../models/ICS');
const Asset = require('../models/Asset');
const mongoose = require('mongoose');

const createICS = async (req, res) => {
    const { icsNumber, custodian, assets, issuedDate, receivedDate } = req.body;

    if (!assets || assets.length === 0) {
        return res.status(400).json({ message: 'ICS must contain at least one asset.' });
    }

    try {
        const ics = new ICS({
            icsNumber,
            custodian,
            assets,
            issuedDate,
            receivedDate
        });

        const createdICS = await ics.save();

        // Create the history entry
        const historyEntry = {
            event: 'Assignment',
            details: `Assigned to ${custodian.name} via ICS #${icsNumber}.`,
            user: req.user ? req.user.name : 'System'
        };

        // FIX: Explicitly convert the array of string IDs into ObjectIDs
        const assetObjectIds = assets.map(id => new mongoose.Types.ObjectId(id));

        await Asset.updateMany(
            { _id: { $in: assetObjectIds } },
            { $set: { assignedICS: icsNumber, status: 'In Use' }, $push: { history: historyEntry } }
        );

        res.status(201).json(createdICS);
    } catch (error) {
        console.error("Error creating ICS:", error);
        res.status(400).json({ message: 'Invalid ICS data', error: error.message });
    }
};

const getICSs = async (req, res) => {
    try {
        const icsList = await ICS.find({}).populate('assets').sort({ createdAt: -1 });
        res.json(icsList);
    } catch (error) {
        res.status(500).json({ message: 'Server Error' });
    }
};

module.exports = { createICS, getICSs };