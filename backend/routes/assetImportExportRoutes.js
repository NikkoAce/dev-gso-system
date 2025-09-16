const express = require('express');
const router = express.Router();
const { protect, checkPermission } = require('../middlewares/authMiddleware.js');
const { upload } = require('../middlewares/multer.js');
const PERMISSIONS = require('../config/permissions.js');
const {
    exportAssetsToCsv,
    importAssetsFromCsv,
    downloadCsvTemplate
} = require('../controllers/assetImportExportController.js');

// Route for exporting assets to CSV
router.get('/export', protect, checkPermission(PERMISSIONS.ASSET_EXPORT), exportAssetsToCsv);

router.get('/import/template', protect, checkPermission(PERMISSIONS.ASSET_CREATE), downloadCsvTemplate);
router.post('/import', protect, checkPermission(PERMISSIONS.ASSET_CREATE), upload.single('csvfile'), importAssetsFromCsv);

module.exports = router;
