const express = require('express');
const router = express.Router();
const { protect, checkPermission } = require('../middlewares/authMiddleware.js');
const { upload } = require('../middlewares/multer.js');
const PERMISSIONS = require('../config/permissions.js');
const {
    getAssets,
    getAssetById,
    createAsset,
    deleteAssetAttachment,
    updateAsset,
    deleteAsset,
    getNextPropertyNumber,
    createBulkAssets,
    getMyOfficeAssets,
    addRepairRecord,
    deleteRepairRecord
} = require('../controllers/assetController');

router.get('/my-assets', protect, checkPermission(PERMISSIONS.ASSET_READ_OWN_OFFICE), getMyOfficeAssets);

// Route for getting the next property number
router.get('/next-number', protect, checkPermission(PERMISSIONS.ASSET_CREATE), getNextPropertyNumber);

// Route for bulk asset creation
router.post('/bulk', protect, checkPermission(PERMISSIONS.ASSET_CREATE), createBulkAssets);

// Routes for managing repairs on a specific asset
router.route('/:id/repairs')
    .post(protect, checkPermission(PERMISSIONS.ASSET_UPDATE), addRepairRecord);
router.route('/:id/repairs/:repairId')
    .delete(protect, checkPermission(PERMISSIONS.ASSET_UPDATE), deleteRepairRecord);

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