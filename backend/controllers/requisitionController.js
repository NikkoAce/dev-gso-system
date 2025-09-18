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
const getAllRequisitions = async (req, res) => {
    try {
        const requisitions = await Requisition.find()
            .populate('items.stockItem', 'stockNumber unitOfMeasure')
            .sort({ dateRequested: -1 });
        res.json(requisitions);
    } catch (err) {
        console.error(err.message);
        res.status(500).send('Server Error');
    }
};

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
        if (['Issued', 'Rejected', 'Cancelled'].includes(requisition.status)) {
            throw new Error(`Cannot update a requisition that is already ${requisition.status}.`);
        }

        requisition.status = status || requisition.status;
        requisition.remarks = remarks || requisition.remarks;

        if (status === 'Issued') {
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

module.exports = {
    createRequisition,
    getAllRequisitions,
    getRequisitionById,
    updateRequisition,
    getMyOfficeRequisitions,
};