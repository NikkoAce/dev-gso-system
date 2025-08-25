const express = require('express');
const router = express.Router();
const { protect, gso } = require('../middlewares/authMiddleware.js');
const {
    createImmovableAsset,
    getImmovableAssets,
    getImmovableAssetById,
    updateImmovableAsset,
    deleteImmovableAsset,
    deleteImmovableAssetAttachment
} = require('../controllers/immovableAssetController.js');
const { upload } = require('../middlewares/uploadMiddleware.js');

// Apply the 'protect' and 'gso' middleware to all routes in this file.
router.use(protect, gso);

router.route('/')
    .post(upload.array('attachments'), createImmovableAsset)
    .get(getImmovableAssets);

router.route('/:id')
    .get(getImmovableAssetById)
    .put(upload.array('attachments'), updateImmovableAsset)
    .delete(deleteImmovableAsset);

// New route for deleting a specific attachment
router.route('/:id/attachments/:attachmentKey').delete(deleteImmovableAssetAttachment);

module.exports = router;