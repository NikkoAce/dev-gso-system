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
const { protect } = require('../middlewares/authMiddleware.js');

// @route   GET & POST /api/stock-items
router.route('/')
    .get(protect, getAllStockItems)
    .post(protect, createStockItem);

// @route   GET, PUT, DELETE /api/stock-items/:id
router.route('/:id')
    .get(protect, getStockItemById)
    .put(protect, updateStockItem)
    .delete(protect, deleteStockItem);

module.exports = router;