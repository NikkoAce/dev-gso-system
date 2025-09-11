const express = require('express');
const router = express.Router();
const { migrateAssetConditions } = require('../controllers/adminController');
const { protect, checkPermission } = require('../middleware/authMiddleware');
const PERMISSIONS = require('../config/permissions');

// @desc    Trigger a data migration for asset conditions
// @route   POST /api/admin/migrate-conditions
// @access  Private/Admin
router.post('/migrate-conditions', protect, checkPermission(PERMISSIONS.ADMIN_DATA_MIGRATE), migrateAssetConditions);

module.exports = router;