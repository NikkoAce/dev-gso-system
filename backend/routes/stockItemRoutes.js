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
    .get(protect, getAllStockItems) // Any authenticated user can view the list of items
    .post(protect, checkPermission('stock:manage'), createStockItem);

// @route   GET, PUT, DELETE /api/stock-items/:id
router.route('/:id')
    .get(protect, getStockItemById) // Any authenticated user can view a single item
    .put(protect, checkPermission('stock:manage'), updateStockItem)
    .delete(protect, checkPermission('stock:manage'), deleteStockItem);

module.exports = router;