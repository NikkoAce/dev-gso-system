const express = require('express');
const router = express.Router();
const { protect, checkPermission } = require('../middlewares/authMiddleware.js');
const { upload } = require('../middlewares/multer.js');
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

router.get('/my-assets', protect, checkPermission('asset:read:own_office'), getMyOfficeAssets);

// Route for dashboard stats - Changed from /stats to /dashboard/summary
router.get('/dashboard/summary', protect, checkPermission('dashboard:view'), getDashboardStats);

// Route for getting the next property number
router.get('/next-number', protect, checkPermission('asset:create'), getNextPropertyNumber);

// Route for exporting assets to CSV
router.get('/export', protect, checkPermission('asset:export'), exportAssetsToCsv);

// Route for bulk asset creation
router.post('/bulk', protect, checkPermission('asset:create'), createBulkAssets);

// Route for bulk asset transfer
router.post('/bulk-transfer', protect, checkPermission('asset:transfer'), bulkTransferAssets);

// Route for updating physical count
router.put('/physical-count', protect, checkPermission('asset:update'), updatePhysicalCount);

// Route for updating from scanner
router.post('/scan', protect, checkPermission('asset:update'), updateScanResults);

// Standard CRUD routes for assets
router.route('/')
    .get(protect, checkPermission('asset:read'), getAssets)
    .post(protect, checkPermission('asset:create'), upload.array('attachments'), createAsset);

router.route('/:id')
    .get(protect, checkPermission('asset:read'), getAssetById)
    .put(protect, checkPermission('asset:update'), upload.array('attachments'), updateAsset)
    .delete(protect, checkPermission('asset:delete'), deleteAsset);

// Route for deleting a specific attachment
router.route('/:id/attachments/:attachmentKey').delete(protect, checkPermission('asset:update'), deleteAssetAttachment);

module.exports = router;