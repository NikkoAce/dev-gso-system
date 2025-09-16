const express = require('express');
const router = express.Router();
const { protect, checkPermission } = require('../middlewares/authMiddleware.js');
const PERMISSIONS = require('../config/permissions.js');
const {
    updatePhysicalCount,
    verifyAssetForPhysicalCount,
    exportPhysicalCountResults
} = require('../controllers/physicalCountController.js');

// Route for submitting bulk updates from the physical count page
router.put('/', protect, checkPermission(PERMISSIONS.ASSET_UPDATE), updatePhysicalCount);

// Route for verifying a single asset during physical count
router.put('/:id/verify', protect, checkPermission(PERMISSIONS.ASSET_UPDATE), verifyAssetForPhysicalCount);

// Route for exporting physical count results for a specific office
router.get('/export', protect, checkPermission(PERMISSIONS.ASSET_EXPORT), exportPhysicalCountResults);

module.exports = router;