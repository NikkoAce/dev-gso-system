const express = require('express');
const router = express.Router();
const { protect, checkPermission } = require('../middlewares/authMiddleware.js');
const {
    getImmovableAssets,
    getImmovableAssetById,
    createImmovableAsset,
    updateImmovableAsset,
    deleteImmovableAsset,
    deleteImmovableAssetAttachment,
    generateImmovableAssetReport,
    generatePropertyCardReport,
    generateImmovableLedgerCard
} = require('../controllers/immovableAssetController.js');
const PERMISSIONS = require('../config/permissions.js');
const { upload } = require('../middlewares/multer.js');

router.route('/')
    .post(protect, checkPermission(PERMISSIONS.IMMOVABLE_CREATE), upload.array('attachments'), createImmovableAsset)
    .get(protect, checkPermission(PERMISSIONS.IMMOVABLE_READ), getImmovableAssets);

// Route for generating an Immovable Asset Report
router.get('/report', protect, checkPermission(PERMISSIONS.REPORT_GENERATE), generateImmovableAssetReport);

// Route for generating a Real Property Card for a specific asset
router.get('/:id/property-card', protect, checkPermission(PERMISSIONS.REPORT_GENERATE), generatePropertyCardReport);

// Route for generating a Real Property Ledger Card for a specific asset
router.get('/:id/ledger-card', protect, checkPermission(PERMISSIONS.REPORT_GENERATE), generateImmovableLedgerCard);

router.route('/:id')
    .get(protect, checkPermission(PERMISSIONS.IMMOVABLE_READ), getImmovableAssetById)
    .put(protect, checkPermission(PERMISSIONS.IMMOVABLE_UPDATE), upload.array('attachments'), updateImmovableAsset)
    .delete(protect, checkPermission(PERMISSIONS.IMMOVABLE_DELETE), deleteImmovableAsset);

// New route for deleting a specific attachment
router.route('/:id/attachments/:attachmentKey').delete(protect, checkPermission(PERMISSIONS.IMMOVABLE_UPDATE), deleteImmovableAssetAttachment);

module.exports = router;