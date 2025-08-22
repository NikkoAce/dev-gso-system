const asyncHandler = require('express-async-handler');
const PAR = require('../models/PAR');
const ICS = require('../models/ICS');

const getSlips = asyncHandler(async (req, res) => {
    // Scope the queries to the logged-in user.
    // This assumes your PAR and ICS models have a 'user' field referencing the User model.
    const userFilter = { user: req.user.id };

    const pars = await PAR.find(userFilter).populate('assets').lean();
    const ics = await ICS.find(userFilter).populate('assets').lean();

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
    const slipId = req.params.id;
    const userId = req.user.id;

    // Query both collections in parallel for better performance
    const [parSlip, icsSlip] = await Promise.all([
        PAR.findById(slipId).populate('assets').lean(),
        ICS.findById(slipId).populate('assets').lean()
    ]);

    let slipData = null;
    let slipType = null;
    let slipNumber = null;

    if (parSlip) {
        slipData = parSlip;
        slipType = 'PAR';
        slipNumber = parSlip.parNumber;
    } else if (icsSlip) {
        slipData = icsSlip;
        slipType = 'ICS';
        slipNumber = icsSlip.icsNumber;
    }

    // If no slip was found in either collection
    if (!slipData) {
        res.status(404);
        throw new Error('Slip not found');
    }

    // Authorization check: Ensure the slip belongs to the requesting user.
    if (slipData.user && slipData.user.toString() !== userId) {
        res.status(403); // 403 Forbidden
        throw new Error('User not authorized to view this slip');
    }

    res.status(200).json({ ...slipData, slipType, number: slipNumber });
});

module.exports = { getSlips, getSlipById };