const express = require('express');
const router = express.Router();
const { migrateAssetConditions, exportDatabase, runHealthCheck } = require('../controllers/adminController');
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

// @desc    Run a data integrity health check
// @route   GET /api/admin/health-check
// @access  Private/Admin
router.get('/health-check', protect, checkPermission(PERMISSIONS.ADMIN_DATA_READ), runHealthCheck);

module.exports = router;