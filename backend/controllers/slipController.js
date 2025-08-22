const asyncHandler = require('express-async-handler');
const PAR = require('../models/PAR');
const ICS = require('../models/ICS');

const getSlips = asyncHandler(async (req, res) => {
    const pars = await PAR.find({}).populate('assets').lean();
    const ics = await ICS.find({}).populate('assets').lean();

    const formattedPars = pars.map(p => ({ ...p, slipType: 'PAR', number: p.parNumber }));
    const formattedIcs = ics.map(i => ({ ...i, slipType: 'ICS', number: i.icsNumber }));

    const allSlips = [...formattedPars, ...formattedIcs];

    allSlips.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));

    res.json(allSlips);
});

/**
 * @desc    Get a single slip by its ID
 * @route   GET /api/slips/:id
 * @access  Private
 */
const getSlipById = asyncHandler(async (req, res) => {
    const { id } = req.params;

    // Try to find the document in the PAR collection
    let slip = await PAR.findById(id).populate('assets').lean();
    if (slip) {
        return res.json({ ...slip, slipType: 'PAR', number: slip.parNumber });
    }

    // If not in PAR, try to find it in the ICS collection
    slip = await ICS.findById(id).populate('assets').lean();
    if (slip) {
        return res.json({ ...slip, slipType: 'ICS', number: slip.icsNumber });
    }

    // If not found in either collection, send a 404 error
    res.status(404);
    throw new Error('Slip not found');
});

module.exports = { getSlips, getSlipById };