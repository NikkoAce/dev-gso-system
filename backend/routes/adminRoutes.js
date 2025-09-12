const express = require('express');
const router = express.Router();
const { migrateAssetConditions, exportDatabase } = require('../controllers/adminController');
const { protect, checkPermission } = require('../middlewares/authMiddleware');
const PERMISSIONS = require('../config/permissions');

// @desc    Trigger a data migration for asset conditions
// @route   POST /api/admin/migrate-conditions
// @access  Private/Admin
router.post('/migrate-conditions', protect, checkPermission(PERMISSIONS.ADMIN_DATA_MIGRATE), migrateAssetConditions);

// @desc    Export the entire database as a compressed archive
// @route   POST /api/admin/export-database
// @access  Private/Admin
router.post('/export-database', protect, checkPermission(PERMISSIONS.ADMIN_DATABASE_EXPORT), exportDatabase);

module.exports = router;