// FILE: backend/controllers/stockItemController.js
const StockItem = require('../models/StockItem');
const Requisition = require('../models/Requisition');
const ReceivingReport = require('../models/ReceivingReport');
const asyncHandler = require('express-async-handler');

// @desc    Get all stock items
// @route   GET /api/stock-items
// @access  Private
const getAllStockItems = asyncHandler(async (req, res) => {
    const { page, limit, sort = 'description', order = 'asc', search = '' } = req.query;

    // If no pagination is requested, return all items (for dropdowns, etc.)
    if (!page || !limit) {
        const allItems = await StockItem.find().sort({ description: 1 });
        return res.json(allItems);
    }

    const query = {};
    if (search) {
        const searchRegex = new RegExp(search, 'i');
        query.$or = [
            { description: searchRegex },
            { stockNumber: searchRegex },
            { category: searchRegex }
        ];
    }

    const pageNum = parseInt(page, 10);
    const limitNum = parseInt(limit, 10);
    const skip = (pageNum - 1) * limitNum;
    const sortOptions = { [sort]: order === 'asc' ? 1 : -1 };

    const [docs, totalDocs] = await Promise.all([
        StockItem.find(query).sort(sortOptions).skip(skip).limit(limitNum).lean(),
        StockItem.countDocuments(query)
    ]);

    res.json({
        docs,
        totalDocs,
        limit: limitNum,
        totalPages: Math.ceil(totalDocs / limitNum),
        page: pageNum,
    });
});

// @desc    Get single stock item by ID
// @route   GET /api/stock-items/:id
// @access  Private
const getStockItemById = asyncHandler(async (req, res) => {
    try {
        const stockItem = await StockItem.findById(req.params.id);
        if (!stockItem) {
            return res.status(404).json({ msg: 'Stock item not found' });
        }
        res.json(stockItem);
    } catch (err) {
        console.error(err.message);
        if (err.kind === 'ObjectId') {
            return res.status(404).json({ msg: 'Stock item not found' });
        }
        res.status(500).send('Server Error');
    }
});

// @desc    Create a stock item
// @route   POST /api/stock-items
// @access  Private (GSO)
const createStockItem = asyncHandler(async (req, res) => {
    const { stockNumber, description, unitOfMeasure, quantity, reorderPoint, category } = req.body;

    let stockItem = await StockItem.findOne({ stockNumber });
    if (stockItem) {
        res.status(400);
        throw new Error('Stock item with this number already exists');
    }

    stockItem = new StockItem({
        stockNumber,
        description,
        unitOfMeasure,
        quantity,
        reorderPoint,
        category
    });

    const createdStockItem = await stockItem.save();
    res.status(201).json(createdStockItem);
});

// @desc    Update a stock item
// @route   PUT /api/stock-items/:id
// @access  Private (GSO)
const updateStockItem = asyncHandler(async (req, res) => {
    const { stockNumber, description, unitOfMeasure, quantity, reorderPoint, category } = req.body;

    let stockItem = await StockItem.findById(req.params.id);
    if (!stockItem) {
        res.status(404);
        throw new Error('Stock item not found');
    }

    if (stockNumber && stockNumber !== stockItem.stockNumber) {
        const existingItem = await StockItem.findOne({ stockNumber });
        if (existingItem) {
            res.status(400);
            throw new Error('Stock number is already in use by another item.');
        }
    }

    stockItem.set(req.body);
    const updatedStockItem = await stockItem.save();
    res.json(updatedStockItem);
});

// @desc    Delete a stock item
// @route   DELETE /api/stock-items/:id
// @access  Private (GSO)
const deleteStockItem = asyncHandler(async (req, res) => {
    const stockItem = await StockItem.findById(req.params.id);
    if (!stockItem) {
        res.status(404);
        throw new Error('Stock item not found');
    }

    const requisitionCount = await Requisition.countDocuments({ 'items.stockItem': req.params.id });
    if (requisitionCount > 0) {
        res.status(400);
        throw new Error('Cannot delete stock item. It is used in existing requisitions.');
    }

    await stockItem.deleteOne();
    res.json({ msg: 'Stock item removed' });
});

// @desc    Get transaction ledger for a single stock item
// @route   GET /api/stock-items/:id/ledger
// @access  Private (GSO)
const getStockItemLedger = asyncHandler(async (req, res) => {
    const stockItemId = req.params.id;

    const stockItem = await StockItem.findById(stockItemId).lean();
    if (!stockItem) {
        res.status(404);
        throw new Error('Stock item not found');
    }

    // Fetch stock-in transactions (from Receiving Reports)
    const stockInTransactions = await ReceivingReport.find({ 'items.stockItem': stockItemId }).lean();

    // Fetch stock-out transactions (from issued/received Requisitions)
    const stockOutTransactions = await Requisition.find({
        'items.stockItem': stockItemId,
        status: { $in: ['Issued', 'Received'] }
    }).lean();

    // Format transactions into a unified ledger format
    let ledger = [];

    stockInTransactions.forEach(report => {
        const item = report.items.find(i => i.stockItem.equals(stockItemId));
        if (item) {
            ledger.push({
                date: report.dateReceived,
                type: 'Stock-In',
                reference: report.rrNumber,
                details: `From Supplier: ${report.supplier}`,
                quantityIn: item.quantityReceived,
                quantityOut: 0,
            });
        }
    });

    stockOutTransactions.forEach(req => {
        const item = req.items.find(i => i.stockItem.equals(stockItemId));
        if (item && item.quantityIssued > 0) {
            ledger.push({
                date: req.dateReceivedByEndUser || req.updatedAt, // Prefer received date, fallback to issued date
                type: 'Stock-Out',
                reference: req.risNumber,
                details: `To Office: ${req.requestingOffice}`,
                quantityIn: 0,
                quantityOut: item.quantityIssued,
            });
        }
    });

    // Sort all transactions by date
    ledger.sort((a, b) => new Date(a.date) - new Date(b.date));

    // Calculate running balance
    let balance = 0;
    const ledgerWithBalance = ledger.map(entry => {
        balance += entry.quantityIn - entry.quantityOut;
        return { ...entry, balance };
    });

    res.json({
        stockItem,
        ledger: ledgerWithBalance
    });
});

module.exports = {
    getAllStockItems,
    getStockItemById,
    createStockItem,
    updateStockItem,
    deleteStockItem,
    getStockItemLedger
};