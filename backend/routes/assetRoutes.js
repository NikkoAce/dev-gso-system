const express = require('express');
const router = express.Router();
const { protect, checkPermission } = require('../middlewares/authMiddleware.js');
const { upload } = require('../middlewares/multer.js');
const PERMISSIONS = require('../config/permissions.js');
const {
    getAssets,
    getAssetById,
    createAsset,
    createBulkAssets,
    deleteAssetAttachment,
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

router.get('/my-assets', protect, checkPermission(PERMISSIONS.ASSET_READ_OWN_OFFICE), getMyOfficeAssets);

// Route for dashboard stats - Changed from /stats to /dashboard/summary
router.get('/dashboard/summary', protect, checkPermission(PERMISSIONS.DASHBOARD_VIEW), getDashboardStats);

// Route for getting the next property number
router.get('/next-number', protect, checkPermission(PERMISSIONS.ASSET_CREATE), getNextPropertyNumber);

// Route for exporting assets to CSV
router.get('/export', protect, checkPermission(PERMISSIONS.ASSET_EXPORT), exportAssetsToCsv);

// Route for bulk asset creation
router.post('/bulk', protect, checkPermission(PERMISSIONS.ASSET_CREATE), createBulkAssets);

// Route for bulk asset transfer
router.post('/bulk-transfer', protect, checkPermission(PERMISSIONS.ASSET_TRANSFER), bulkTransferAssets);

// Route for updating physical count
router.put('/physical-count', protect, checkPermission(PERMISSIONS.ASSET_UPDATE), updatePhysicalCount);

// Route for updating from scanner
router.post('/scan', protect, checkPermission(PERMISSIONS.ASSET_UPDATE), updateScanResults);

// Standard CRUD routes for assets
router.route('/')
    .get(protect, checkPermission(PERMISSIONS.ASSET_READ), getAssets)
    .post(protect, checkPermission(PERMISSIONS.ASSET_CREATE), upload.array('attachments'), createAsset);

router.route('/:id')
    .get(protect, checkPermission(PERMISSIONS.ASSET_READ), getAssetById)
    .put(protect, checkPermission(PERMISSIONS.ASSET_UPDATE), upload.array('attachments'), updateAsset)
    .delete(protect, checkPermission(PERMISSIONS.ASSET_DELETE), deleteAsset);

// Route for deleting a specific attachment
router.route('/:id/attachments/:attachmentKey').delete(protect, checkPermission(PERMISSIONS.ASSET_UPDATE), deleteAssetAttachment);

module.exports = router;