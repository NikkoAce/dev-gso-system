const express = require('express');
const router = express.Router();
const { protect, checkPermission } = require('../middlewares/authMiddleware.js');
const PERMISSIONS = require('../config/permissions.js');
const { createPtrAndTransferAssets } = require('../controllers/assetTransferController.js');

// Route for creating a PTR and transferring assets
router.post('/ptr', protect, checkPermission(PERMISSIONS.ASSET_TRANSFER), createPtrAndTransferAssets);

module.exports = router;
