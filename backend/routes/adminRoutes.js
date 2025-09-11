const express = require('express');
const router = express.Router();
const { migrateAssetConditions } = require('../controllers/adminController');
const { protect, admin } = require('../middleware/authMiddleware'); // Assuming this middleware exists

// @desc    Trigger a data migration for asset conditions
// @route   POST /api/admin/migrate-conditions
// @access  Private/Admin
router.post('/migrate-conditions', protect, admin, migrateAssetConditions);

module.exports = router;