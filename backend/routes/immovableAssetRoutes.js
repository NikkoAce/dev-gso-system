const express = require('express');
const router = express.Router();
const {
    createImmovableAsset,
    getImmovableAssets,
    getImmovableAssetById,
    updateImmovableAsset,
    deleteImmovableAsset
} = require('../controllers/immovableAssetController');
const { protect, gso } = require('../middlewares/authMiddleware.js');

// Apply the 'protect' and 'gso' middleware to all routes in this file.
router.use(protect, gso);

router.route('/')
    .post(createImmovableAsset)
    .get(getImmovableAssets);

router.route('/:id')
    .get(getImmovableAssetById)
    .put(updateImmovableAsset)
    .delete(deleteImmovableAsset);

module.exports = router;