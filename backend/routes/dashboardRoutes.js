const express = require('express');
const router = express.Router();
const {
    getDashboardStats,
    getPendingRequisitionsDetails,
    getLowStockItemsDetails,
    getUnassignedAssetsDetails,
    getNearingEOLDetails
} = require('../controllers/dashboardController.js');
const { protect, checkPermission } = require('../middlewares/authMiddleware.js');
const PERMISSIONS = require('../config/permissions.js');

// @desc    Get all dashboard statistics
// @route   GET /api/dashboard/stats
// @access  Private/Admin
router.route('/stats').get(protect, checkPermission(PERMISSIONS.DASHBOARD_VIEW), getDashboardStats);

// @desc    Get details for drill-down modals
// @route   GET /api/dashboard/details/:type
// @access  Private/Admin
router.route('/details/pending-requisitions').get(protect, checkPermission(PERMISSIONS.DASHBOARD_VIEW), getPendingRequisitionsDetails);
router.route('/details/low-stock-items').get(protect, checkPermission(PERMISSIONS.DASHBOARD_VIEW), getLowStockItemsDetails);
router.route('/details/unassigned-assets').get(protect, checkPermission(PERMISSIONS.DASHBOARD_VIEW), getUnassignedAssetsDetails);
router.route('/details/nearing-eol').get(protect, checkPermission(PERMISSIONS.DASHBOARD_VIEW), getNearingEOLDetails);


module.exports = router;