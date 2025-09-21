const express = require('express');
const router = express.Router();
const { protect, checkPermission } = require('../middlewares/authMiddleware.js');
const PERMISSIONS = require('../config/permissions.js');
const {
    updatePhysicalCount,
    verifyAssetForPhysicalCount,
    exportPhysicalCountResults,
    getAssetByPropertyNumber,
    updateSingleAssetPhysicalCount
} = require('../controllers/physicalCountController.js');

// Route for submitting bulk updates from the physical count page
router.put('/', protect, checkPermission(PERMISSIONS.ASSET_UPDATE), updatePhysicalCount);

// Route for verifying a single asset during physical count
router.put('/:id/verify', protect, checkPermission(PERMISSIONS.ASSET_UPDATE), verifyAssetForPhysicalCount);

// Route for exporting physical count results for a specific office
router.get('/export', protect, checkPermission(PERMISSIONS.ASSET_EXPORT), exportPhysicalCountResults);

// Route for getting an asset by its property number (used by the scanner)
router.get('/by-property-number/:propertyNumber', protect, checkPermission(PERMISSIONS.ASSET_READ), getAssetByPropertyNumber);

// Route for updating a single asset's details during physical count (autosave)
router.put('/:id', protect, checkPermission(PERMISSIONS.ASSET_UPDATE), updateSingleAssetPhysicalCount);

module.exports = router;