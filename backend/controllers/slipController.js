const asyncHandler = require('express-async-handler');
const PAR = require('../models/PAR');
const ICS = require('../models/ICS');
const PTR = require('../models/PTR');
const Appendix68 = require('../models/Appendix68');
const IIRUP = require('../models/IIRUP');

const getSlips = asyncHandler(async (req, res) => {
    // Since this is an admin-only page, we fetch all slips.
    const [pars, ics, ptrs, a68s, iirups, requisitions] = await Promise.all([
        PAR.find({}).populate('assets').lean(),
        ICS.find({}).populate('assets').lean(),
        PTR.find({}).lean(),
        Appendix68.find({}).lean(),
        IIRUP.find({}).lean(),
        Requisition.find({ status: 'Issued' }).populate('requestingUser', 'name office').lean() // Fetch issued requisitions
    ]);

    const formattedPars = pars.map(p => ({ ...p, slipType: 'PAR', number: p.parNumber }));
    const formattedIcs = ics.map(i => ({ ...i, slipType: 'ICS', number: i.icsNumber }));
    const formattedPtrs = ptrs.map(ptr => ({ ...ptr, slipType: 'PTR', number: ptr.ptrNumber, issuedDate: ptr.date }));
    const formattedA68s = a68s.map(a => ({ ...a, slipType: 'A68', number: a.appendixNumber, issuedDate: a.date }));
    const formattedIIRUPs = iirups.map(i => ({ ...i, slipType: 'IIRUP', number: i.iirupNumber, issuedDate: i.date }));
    // NEW: Format requisitions to look like slips for the history page
    const formattedReqs = requisitions.map(r => ({
        _id: r._id,
        slipType: 'RIS', // Assign a type for the frontend to identify
        number: r.risNumber,
        custodian: r.requestingUser, // Use requestingUser as custodian for display
        assets: r.items, // The items array can stand in for assets for count
        issuedDate: r.updatedAt, // The date it was issued is the last update time
        createdAt: r.createdAt
    }));

    const allSlips = [...formattedPars, ...formattedIcs, ...formattedPtrs, ...formattedA68s, ...formattedIIRUPs, ...formattedReqs];

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
    const [parSlip, icsSlip, ptrSlip, a68Slip, iirupSlip, requisitionSlip] = await Promise.all([
        PAR.findById(slipId).populate('assets').lean(),
        ICS.findById(slipId).populate('assets').lean(),
        PTR.findById(slipId).lean(), // PTR assets are embedded, no need to populate
        Appendix68.findById(slipId).lean(),
        IIRUP.findById(slipId).lean(),
        Requisition.findById(slipId).populate('items.stockItem', 'stockNumber unitOfMeasure').populate('requestingUser', 'name office').lean()
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
    } else if (a68Slip) {
        slipData = a68Slip;
        slipType = 'A68';
        slipNumber = a68Slip.appendixNumber;
    } else if (iirupSlip) {
        slipData = iirupSlip;
        slipType = 'IIRUP';
        slipNumber = iirupSlip.iirupNumber;
    } else if (requisitionSlip) {
        slipData = requisitionSlip;
        slipType = 'RIS';
        slipNumber = requisitionSlip.risNumber;
    }

    if (slipType === 'RIS') {
        slipData.custodian = slipData.requestingUser;
        slipData.assets = slipData.items.map(item => ({
            propertyNumber: item.stockItem?.stockNumber || 'N/A',
            description: item.description,
            acquisitionCost: 0 // Not applicable for supplies in this context
        }));
    }

    if (!slipData) {
        res.status(404);
        throw new Error('Slip not found');
    }

    res.status(200).json({ ...slipData, slipType, number: slipNumber });
});

module.exports = { getSlips, getSlipById };