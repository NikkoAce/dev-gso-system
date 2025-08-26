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
const { protect, checkPermission } = require('../middlewares/authMiddleware.js');

// @route   GET & POST /api/stock-items
router.route('/')
    .get(protect, checkPermission('stock:read'), getAllStockItems)
    .post(protect, checkPermission('stock:manage'), createStockItem);

// @route   GET, PUT, DELETE /api/stock-items/:id
router.route('/:id')
    .get(protect, checkPermission('stock:read'), getStockItemById)
    .put(protect, checkPermission('stock:manage'), updateStockItem)
    .delete(protect, checkPermission('stock:manage'), deleteStockItem);

module.exports = router;