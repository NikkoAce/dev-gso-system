// FILE: backend/routes/stockItemRoutes.js
const express = require('express');
const router = express.Router();
const {
    getAllStockItems,
    getStockItemById,
    createStockItem,
    updateStockItem,
    deleteStockItem,
    getStockItemLedger
} = require('../controllers/stockItemController');
const { protect, checkPermission } = require('../middlewares/authMiddleware');
const PERMISSIONS = require('../config/permissions');

// @route   GET & POST /api/stock-items
router.route('/')
    .get(protect, checkPermission(PERMISSIONS.STOCK_READ), getAllStockItems)
    .post(protect, checkPermission(PERMISSIONS.STOCK_MANAGE), createStockItem);

// IMPORTANT: Routes with specific sub-paths like '/:id/ledger' must be defined
// BEFORE the general '/:id' route to ensure they are matched correctly.
router.get('/:id/ledger', protect, checkPermission(PERMISSIONS.STOCK_MANAGE), getStockItemLedger);

// @route   GET, PUT, DELETE /api/stock-items/:id
router.route('/:id')
    .get(protect, checkPermission(PERMISSIONS.STOCK_READ), getStockItemById)
    .put(protect, checkPermission(PERMISSIONS.STOCK_MANAGE), updateStockItem)
    .delete(protect, checkPermission(PERMISSIONS.STOCK_MANAGE), deleteStockItem);

module.exports = router;