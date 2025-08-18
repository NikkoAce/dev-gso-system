// FILE: backend/controllers/stockItemController.js
const StockItem = require('../models/StockItem');
const Requisition = require('../models/Requisition');

// @desc    Get all stock items
// @route   GET /api/stock-items
// @access  Private
exports.getAllStockItems = async (req, res) => {
    try {
        const stockItems = await StockItem.find().sort({ description: 1 });
        res.json(stockItems);
    } catch (err) {
        console.error(err.message);
        res.status(500).send('Server Error');
    }
};

// @desc    Get single stock item by ID
// @route   GET /api/stock-items/:id
// @access  Private
exports.getStockItemById = async (req, res) => {
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
};

// @desc    Create a stock item
// @route   POST /api/stock-items
// @access  Private (GSO)
exports.createStockItem = async (req, res) => {
    const { stockNumber, description, unitOfMeasure, quantity, reorderPoint, category } = req.body;

    try {
        let stockItem = await StockItem.findOne({ stockNumber });
        if (stockItem) {
            return res.status(400).json({ msg: 'Stock item with this number already exists' });
        }

        stockItem = new StockItem({
            stockNumber,
            description,
            unitOfMeasure,
            quantity,
            reorderPoint,
            category
        });

        await stockItem.save();
        res.status(201).json(stockItem);
    } catch (err) {
        console.error(err.message);
        res.status(500).send('Server Error');
    }
};

// @desc    Update a stock item
// @route   PUT /api/stock-items/:id
// @access  Private (GSO)
exports.updateStockItem = async (req, res) => {
    const { stockNumber, description, unitOfMeasure, quantity, reorderPoint, category } = req.body;

    try {
        let stockItem = await StockItem.findById(req.params.id);
        if (!stockItem) {
            return res.status(404).json({ msg: 'Stock item not found' });
        }

        if (stockNumber && stockNumber !== stockItem.stockNumber) {
            const existingItem = await StockItem.findOne({ stockNumber });
            if (existingItem) {
                return res.status(400).json({ msg: 'Stock number is already in use by another item.' });
            }
        }

        stockItem.set(req.body);
        const updatedStockItem = await stockItem.save();
        res.json(updatedStockItem);
    } catch (err) {
        console.error(err.message);
        res.status(500).send('Server Error');
    }
};

// @desc    Delete a stock item
// @route   DELETE /api/stock-items/:id
// @access  Private (GSO)
exports.deleteStockItem = async (req, res) => {
    try {
        const stockItem = await StockItem.findById(req.params.id);
        if (!stockItem) {
            return res.status(404).json({ msg: 'Stock item not found' });
        }

        const requisitionCount = await Requisition.countDocuments({ 'items.stockItem': req.params.id });
        if (requisitionCount > 0) {
            return res.status(400).json({ msg: 'Cannot delete stock item. It is used in existing requisitions.' });
        }

        await stockItem.deleteOne();
        res.json({ msg: 'Stock item removed' });
    } catch (err) {
        console.error(err.message);
        res.status(500).send('Server Error');
    }
};