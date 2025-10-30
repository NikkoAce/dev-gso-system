const ICS = require('../models/ICS');
const Asset = require('../models/Asset');
const mongoose = require('mongoose');

const createICS = async (req, res) => {
    const { icsNumber, custodian, assets, issuedDate, receivedDate } = req.body;

    if (!assets || assets.length === 0) {
        return res.status(400).json({ message: 'ICS must contain at least one asset.' });
    }

    // --- VALIDATION: Check if any assets are already assigned ---
    const assetObjectIds = assets.map(id => new mongoose.Types.ObjectId(id));
    const alreadyAssigned = await Asset.find({
        _id: { $in: assetObjectIds },
        $or: [
            { assignedPAR: { $nin: [null, ''] } },
            { assignedICS: { $nin: [null, ''] } }
        ]
    }).select('propertyNumber assignedPAR assignedICS');

    if (alreadyAssigned.length > 0) {
        const assignedDetails = alreadyAssigned.map(a => `${a.propertyNumber} (assigned to ${a.assignedPAR || a.assignedICS})`).join(', ');
        return res.status(400).json({ message: `Cannot create ICS. The following assets are already assigned: ${assignedDetails}` });
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