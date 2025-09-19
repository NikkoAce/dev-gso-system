const express = require('express');
const router = express.Router();
const { migrateAssetConditions, exportDatabase, runHealthCheck, fixMismatchedDesignations, fixMissingDesignations } = require('../controllers/adminController');
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

// @desc    Fix mismatched custodian designations found by the health check
// @route   POST /api/admin/health-check/fix-designations
// @access  Private/Admin
router.post('/health-check/fix-designations', protect, checkPermission(PERMISSIONS.ADMIN_DATA_MIGRATE), fixMismatchedDesignations);

// @desc    Fix missing custodian designations found by the health check
// @route   POST /api/admin/health-check/fix-missing-designations
// @access  Private/Admin
router.post('/health-check/fix-missing-designations', protect, checkPermission(PERMISSIONS.ADMIN_DATA_MIGRATE), fixMissingDesignations);


module.exports = router;