// FILE: backend/routes/stockItemRoutes.js
const express = require('express');
const router = express.Router();
const {
    getAllStockItems,
    getStockItemById,
    createStockItem,
    updateStockItem,
    deleteStockItem
} = require('../controllers/stockItemController');
const { protect, gso } = require('../middlewares/authMiddleware.js');

// @route   GET & POST /api/stock-items
router.route('/')
    .get(protect, getAllStockItems)
    .post(protect, gso, createStockItem);

// @route   GET, PUT, DELETE /api/stock-items/:id
router.route('/:id')
    .get(protect, getStockItemById)
    .put(protect, gso, updateStockItem)
    .delete(protect, gso, deleteStockItem);

module.exports = router;