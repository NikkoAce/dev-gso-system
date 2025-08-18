const express = require('express');
const router = express.Router();
const { protect, gso } = require('../middlewares/authMiddleware'); // Correct path and import
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

// Route for dashboard stats
router.get('/stats', protect, gso, getDashboardStats);

// Route for getting the next property number
router.get('/next-property-number', protect, gso, getNextPropertyNumber);

// Route for exporting assets to CSV
router.get('/export', protect, gso, exportAssetsToCsv);

// Route for bulk asset creation
router.post('/bulk', protect, gso, createBulkAssets);

// Route for bulk asset transfer
router.post('/bulk-transfer', protect, gso, bulkTransferAssets);

// Route for updating physical count
router.put('/physical-count', protect, gso, updatePhysicalCount);

// Route for updating from scanner
router.post('/scan', protect, gso, updateScanResults);

// Standard CRUD routes for assets
router.route('/')
    .get(protect, getAssets)
    .post(protect, gso, createAsset);

router.route('/:id')
    .get(protect, getAssetById)
    .put(protect, gso, updateAsset)
    .delete(protect, gso, deleteAsset);

module.exports = router;