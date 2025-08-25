const asyncHandler = require('express-async-handler');
const PAR = require('../models/PAR');
const ICS = require('../models/ICS');
const PTR = require('../models/PTR');

const getSlips = asyncHandler(async (req, res) => {
    // Since this is an admin-only page, we fetch all slips.
    const pars = await PAR.find({}).populate('assets').lean();
    const ics = await ICS.find({}).populate('assets').lean();
    const ptrs = await PTR.find({}).lean();

    const formattedPars = pars.map(p => ({ ...p, slipType: 'PAR', number: p.parNumber }));
    const formattedIcs = ics.map(i => ({ ...i, slipType: 'ICS', number: i.icsNumber }));
    const formattedPtrs = ptrs.map(ptr => ({ ...ptr, slipType: 'PTR', number: ptr.ptrNumber, custodian: {name: ptr.from.name, office: ptr.from.office}}));

    const allSlips = [...formattedPars, ...formattedIcs, ...formattedPtrs];

    allSlips.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));

    res.status(200).json(allSlips);
});

/**
 * @desc    Get a single slip by its ID
 * @route   GET /api/slips/:id
 * @access  Private
 */
const getSlipById = asyncHandler(async (req, res) => {
    const slipId = req.params.id;

    // Query all three collections in parallel for better performance
    const [parSlip, icsSlip, ptrSlip] = await Promise.all([
        PAR.findById(slipId).populate('assets').lean(),
        ICS.findById(slipId).populate('assets').lean(),
        PTR.findById(slipId).lean() // PTR assets are embedded, no need to populate
    ]);

    let slipData = null;
    let slipType = null;
    let slipNumber = null;

    if (parSlip) { // Found in PAR
        slipData = parSlip;
        slipType = 'PAR';
        slipNumber = parSlip.parNumber;
    } else if (icsSlip) { // Found in ICS
        slipData = icsSlip;
        slipType = 'ICS';
        slipNumber = icsSlip.icsNumber;
    } else if (ptrSlip) { // Found in PTR
        slipData = ptrSlip;
        slipType = 'PTR';
        slipNumber = ptrSlip.ptrNumber;
    }

    if (!slipData) {
        res.status(404);
        throw new Error('Slip not found');
    }

    res.status(200).json({ ...slipData, slipType, number: slipNumber });
});

module.exports = { getSlips, getSlipById };