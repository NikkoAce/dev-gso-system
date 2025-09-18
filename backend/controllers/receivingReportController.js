const ReceivingReport = require('../models/ReceivingReport');
const StockItem = require('../models/StockItem');
const asyncHandler = require('express-async-handler');
const mongoose = require('mongoose');

// Helper to generate next report number
async function getNextReportNumber(session) {
    const year = new Date().getFullYear();
    const startOfYear = new Date(year, 0, 1);
    const lastReport = await ReceivingReport.findOne({ createdAt: { $gte: startOfYear } }).sort({ createdAt: -1 }).session(session);
    let sequence = 1;
    if (lastReport && lastReport.reportNumber) {
        const lastSequence = parseInt(lastReport.reportNumber.split('-').pop(), 10);
        if (!isNaN(lastSequence)) sequence = lastSequence + 1;
    }
    return `RR-${year}-${String(sequence).padStart(4, '0')}`;
}

// @desc    Create a new receiving report and update stock
// @route   POST /api/receiving-reports
// @access  Private (stock:manage)
const createReceivingReport = asyncHandler(async (req, res) => {
    const { supplier, dateReceived, items, remarks } = req.body;
    const receivedBy = req.user.id; // Correctly get the user ID from the token payload

    if (!supplier || !dateReceived || !items || items.length === 0) {
        res.status(400);
        throw new Error('Supplier, date, and at least one item are required.');
    }

    const session = await mongoose.startSession();
    session.startTransaction();

    try {
        const reportNumber = await getNextReportNumber(session);

        const newReport = new ReceivingReport({
            reportNumber,
            supplier,
            dateReceived,
            items,
            remarks,
            receivedBy
        });

        // Update stock quantities
        for (const item of items) {
            await StockItem.findByIdAndUpdate(
                item.stockItem,
                { $inc: { quantity: item.quantityReceived } },
                { session, runValidators: true }
            );
        }

        const savedReport = await newReport.save({ session });
        await session.commitTransaction();
        res.status(201).json(savedReport);

    } catch (error) {
        await session.abortTransaction();
        res.status(400);
        throw new Error(`Failed to create receiving report: ${error.message}`);
    } finally {
        session.endSession();
    }
});

// @desc    Get all receiving reports
// @route   GET /api/receiving-reports
// @access  Private (stock:manage)
const getReceivingReports = asyncHandler(async (req, res) => {
    const reports = await ReceivingReport.find()
        .populate('receivedBy', 'name')
        .sort({ dateReceived: -1 });
    res.json(reports);
});

module.exports = { createReceivingReport, getReceivingReports };