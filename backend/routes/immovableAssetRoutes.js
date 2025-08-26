const express = require('express');
const router = express.Router();
const { protect, checkPermission } = require('../middlewares/authMiddleware.js');
const {
    createImmovableAsset,
    getImmovableAssets,
    getImmovableAssetById,
    updateImmovableAsset,
    deleteImmovableAsset,
    deleteImmovableAssetAttachment
} = require('../controllers/immovableAssetController.js');
const { upload } = require('../middlewares/multer.js');

router.route('/')
    .post(protect, checkPermission('immovable:create'), upload.array('attachments'), createImmovableAsset)
    .get(protect, checkPermission('immovable:read'), getImmovableAssets);

router.route('/:id')
    .get(protect, checkPermission('immovable:read'), getImmovableAssetById)
    .put(protect, checkPermission('immovable:update'), upload.array('attachments'), updateImmovableAsset)
    .delete(protect, checkPermission('immovable:delete'), deleteImmovableAsset);

// New route for deleting a specific attachment
router.route('/:id/attachments/:attachmentKey').delete(protect, checkPermission('immovable:update'), deleteImmovableAssetAttachment);

module.exports = router;