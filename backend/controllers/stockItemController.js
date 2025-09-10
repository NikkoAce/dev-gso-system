// FILE: backend/controllers/stockItemController.js
const StockItem = require('../models/StockItem');
const Requisition = require('../models/Requisition');
const asyncHandler = require('express-async-handler');

// @desc    Get all stock items
// @route   GET /api/stock-items
// @access  Private
const getAllStockItems = asyncHandler(async (req, res) => {
    try {
        const stockItems = await StockItem.find().sort({ description: 1 });
        res.json(stockItems);
    } catch (err) {
        console.error(err.message);
        res.status(500).send('Server Error');
    }
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

module.exports = {
    getAllStockItems,
    getStockItemById,
    createStockItem,
    updateStockItem,
    deleteStockItem
};