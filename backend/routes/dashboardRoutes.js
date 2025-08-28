const express = require('express');
const router = express.Router();
const { getDashboardStats } = require('../controllers/dashboardController.js');
const { protect, admin } = require('../middlewares/authMiddleware.js');

// @desc    Get all dashboard statistics
// @route   GET /api/dashboard/stats
// @access  Private/Admin
router.route('/stats').get(protect, admin, getDashboardStats);

module.exports = router;