// FILE: backend/controllers/requisitionController.js
const Requisition = require('../models/Requisition');
const asyncHandler = require('express-async-handler');
const StockItem = require('../models/StockItem');
const mongoose = require('mongoose');

/**
 * Generates the next sequential RIS number for the current year.
 * Example: RIS-2024-0001
 */
async function getNextRisNumber() {
    const year = new Date().getFullYear();
    const startOfYear = new Date(year, 0, 1);

    const lastRequisition = await Requisition.findOne({
        createdAt: { $gte: startOfYear }
    }).sort({ createdAt: -1 });

    let sequence = 1;
    if (lastRequisition && lastRequisition.risNumber) {
        const lastSequence = parseInt(lastRequisition.risNumber.split('-').pop(), 10);
        if (!isNaN(lastSequence)) {
            sequence = lastSequence + 1;
        }
    }
    return `RIS-${year}-${String(sequence).padStart(4, '0')}`;
}

/**
 * Generates the next sequential SAI number for the current year.
 * Example: SAI-2024-0001
 * @param {mongoose.ClientSession} session - The mongoose session for the transaction.
 */
async function getNextSaiNumber(session) {
    const year = new Date().getFullYear();
    const startOfYear = new Date(year, 0, 1);

    // Find the last requisition that has an SAI number
    const lastRequisitionWithSai = await Requisition.findOne({
        saiNumber: { $exists: true, $ne: null },
        createdAt: { $gte: startOfYear }
    }).sort({ createdAt: -1 }).session(session);

    let sequence = 1;
    if (lastRequisitionWithSai && lastRequisitionWithSai.saiNumber) {
        const lastSequence = parseInt(lastRequisitionWithSai.saiNumber.split('-').pop(), 10);
        if (!isNaN(lastSequence)) { sequence = lastSequence + 1; }
    }
    return `SAI-${year}-${String(sequence).padStart(4, '0')}`;
}

// @desc    Create a new requisition
// @route   POST /api/requisitions
// @access  Private
const createRequisition = asyncHandler(async (req, res) => {
    const { purpose, items } = req.body;
    // Get user info from the token via middleware. The 'id' property holds the user's MongoDB _id.
    const { office, id } = req.user; 

    if (!items || items.length === 0) {
        res.status(400);
        throw new Error('Requisition must have at least one item.');
    }

    const risNumber = await getNextRisNumber();
    const newRequisition = new Requisition({
        risNumber,
        purpose,
        requestingOffice: office,
        requestingUser: id, // Use the correct 'id' from the token payload
        items,
    });

    const savedRequisition = await newRequisition.save();
    res.status(201).json(savedRequisition);
});

// @desc    Get all requisitions
// @route   GET /api/requisitions
// @access  Private
const getAllRequisitions = asyncHandler(async (req, res) => {
    const { page = 1, limit = 15, sort = 'dateRequested', order = 'desc', search = '', status = '' } = req.query;

    const query = {};
    if (search) {
        const searchRegex = new RegExp(search, 'i');
        query.$or = [
            { risNumber: searchRegex },
            { requestingOffice: searchRegex },
            { purpose: searchRegex }
        ];
    }
    if (status) {
        query.status = status;
    }

    const pageNum = parseInt(page, 10);
    const limitNum = parseInt(limit, 10);
    const skip = (pageNum - 1) * limitNum;
    const sortOptions = { [sort]: order === 'asc' ? 1 : -1 };

    const [docs, totalDocs] = await Promise.all([
        Requisition.find(query)
            .populate('items.stockItem', 'stockNumber unitOfMeasure')
            .populate('requestingUser', 'name office')
            .sort(sortOptions)
            .skip(skip)
            .limit(limitNum)
            .lean(),
        Requisition.countDocuments(query)
    ]);

    res.json({ docs, totalDocs, limit: limitNum, totalPages: Math.ceil(totalDocs / limitNum), page: pageNum });
});

// @desc    Get a single requisition by ID
// @route   GET /api/requisitions/:id
// @access  Private
const getRequisitionById = async (req, res) => {
    try {
        const requisition = await Requisition.findById(req.params.id)
            .populate('items.stockItem', 'stockNumber unitOfMeasure quantity')
            .populate('requestingUser', 'name office');

        if (!requisition) {
            return res.status(404).json({ message: 'Requisition not found' });
        }

        res.json(requisition);
    } catch (err) {
        console.error(err.message);
        res.status(500).send('Server Error');
    }
};

// @desc    Update a requisition (status, items issued, etc.)
// @route   PUT /api/requisitions/:id
// @access  Private (GSO only)
const updateRequisition = async (req, res) => {
    const { status, items, remarks } = req.body;

    const session = await mongoose.startSession();
    session.startTransaction();

    try {
        const requisition = await Requisition.findById(req.params.id).session(session);
        if (!requisition) throw new Error('Requisition not found');

        const originalStatus = requisition.status;

        // Prevent illegal status transitions
        if (['Issued', 'Rejected', 'Cancelled'].includes(originalStatus)) {
            throw new Error(`Cannot update a requisition that is already ${originalStatus}.`);
        }

        // If transitioning from 'For Availability Check' to 'Pending', assign SAI number.
        if (originalStatus === 'For Availability Check' && status === 'Pending') {
            requisition.saiNumber = await getNextSaiNumber(session);
        }

        requisition.status = status || originalStatus;
        requisition.remarks = remarks || requisition.remarks;

        if (status === 'Issued') {
            if (originalStatus !== 'Pending') {
                throw new Error('Can only issue items for requisitions that are pending approval.');
            }
            for (const reqItem of items) {
                const stockItem = await StockItem.findById(reqItem.stockItem).session(session);
                if (!stockItem) throw new Error(`Stock item ${reqItem.description} not found.`);
                if (stockItem.quantity < reqItem.quantityIssued) throw new Error(`Not enough stock for ${stockItem.description}.`);
                stockItem.quantity -= reqItem.quantityIssued;
                await stockItem.save({ session });
                const itemInRequisition = requisition.items.find(it => it.stockItem.equals(reqItem.stockItem));
                if (itemInRequisition) itemInRequisition.quantityIssued = reqItem.quantityIssued;
            }
        }

        const updatedRequisition = await requisition.save({ session });
        await session.commitTransaction();
        res.json(updatedRequisition);
    } catch (err) {
        await session.abortTransaction();
        console.error(err.message);
        res.status(400).json({ message: err.message });
    } finally {
        session.endSession();
    }
};

const getMyOfficeRequisitions = asyncHandler(async (req, res) => {
    // req.user is attached by the 'protect' middleware
    if (!req.user || !req.user.office) {
        res.status(400);
        throw new Error('User office not found in token');
    }

    const requisitions = await Requisition.find({ requestingOffice: req.user.office })
        .populate('items.stockItem')
        .populate('requestingUser')
        .sort({ dateRequested: -1 });

    res.json(requisitions);
});

/**
 * @desc    Get a single requisition by ID, but only if it belongs to the user's office.
 * @route   GET /api/requisitions/my-office/:id
 * @access  Private (Requires 'requisition:read:own_office')
 */
const getMyOfficeRequisitionById = asyncHandler(async (req, res) => {
    const requisition = await Requisition.findById(req.params.id)
        .populate('items.stockItem', 'stockNumber unitOfMeasure quantity')
        .populate('requestingUser', 'name office');

    if (!requisition) {
        res.status(404);
        throw new Error('Requisition not found');
    }

    // Security Check: Ensure the requisition belongs to the user's office
    if (requisition.requestingOffice !== req.user.office) {
        res.status(403);
        throw new Error('Forbidden: You do not have permission to view this requisition.');
    }

    res.json(requisition);
});

module.exports = {
    createRequisition,
    getAllRequisitions,
    getRequisitionById,
    updateRequisition,
    getMyOfficeRequisitions,
    getMyOfficeRequisitionById,
};