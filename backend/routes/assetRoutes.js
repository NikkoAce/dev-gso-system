const express = require('express');
const router = express.Router();
const { protect, gsoOnly } = require('../middleware/authMiddleware.js');
const {
    getAssets,
    getAssetById,
    createAsset,
    createBulkAssets,
    updateAsset,
    deleteAsset,
    getNextPropertyNumber,
    bulkTransferAssets,
    updatePhysicalCount,
    exportAssetsToCsv,
    getMyOfficeAssets,
    updateScanResults,
    getDashboardStats,
} = require('../controllers/assetController'); // Assuming a controller file

router.get('/my-assets', protect, getMyOfficeAssets);

// Route for dashboard stats - Changed from /stats to /dashboard/summary
router.get('/dashboard/summary', protect, gsoOnly, getDashboardStats);

// Route for getting the next property number
router.get('/next-number', protect, gsoOnly, getNextPropertyNumber);

// Route for exporting assets to CSV
router.get('/export', protect, gsoOnly, exportAssetsToCsv);

// Route for bulk asset creation
router.post('/bulk', protect, gsoOnly, createBulkAssets);

// Route for bulk asset transfer
router.post('/bulk-transfer', protect, gsoOnly, bulkTransferAssets);

// Route for updating physical count
router.put('/physical-count', protect, gsoOnly, updatePhysicalCount);

// Route for updating from scanner
router.post('/scan', protect, gsoOnly, updateScanResults);

// Standard CRUD routes for assets
router.route('/')
    .get(protect, getAssets)
    .post(protect, gsoOnly, createAsset);

router.route('/:id')
    .get(protect, getAssetById)
    .put(protect, gsoOnly, updateAsset)
    .delete(protect, gsoOnly, deleteAsset);

module.exports = router;