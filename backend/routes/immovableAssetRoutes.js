const express = require('express');
const router = express.Router();
const { protect, checkPermission } = require('../middlewares/authMiddleware.js');
const {
    getImmovableAssets,
    getImmovableAssetById,
    createImmovableAsset,
    updateImmovableAsset,
    deleteImmovableAsset,
    deleteImmovableAssetAttachment
} = require('../controllers/immovableAssetController.js');
const PERMISSIONS = require('../config/permissions.js');
const { upload } = require('../middlewares/multer.js');

router.route('/')
    .post(protect, checkPermission(PERMISSIONS.IMMOVABLE_CREATE), upload.array('attachments'), createImmovableAsset)
    .get(protect, checkPermission(PERMISSIONS.IMMOVABLE_READ), getImmovableAssets);

router.route('/:id')
    .get(protect, checkPermission(PERMISSIONS.IMMOVABLE_READ), getImmovableAssetById)
    .put(protect, checkPermission(PERMISSIONS.IMMOVABLE_UPDATE), upload.array('attachments'), updateImmovableAsset)
    .delete(protect, checkPermission(PERMISSIONS.IMMOVABLE_DELETE), deleteImmovableAsset);

// New route for deleting a specific attachment
router.route('/:id/attachments/:attachmentKey').delete(protect, checkPermission(PERMISSIONS.IMMOVABLE_UPDATE), deleteImmovableAssetAttachment);

module.exports = router;