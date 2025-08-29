const express = require('express');
const router = express.Router();
const {
    getDashboardStats,
    getPendingRequisitionsDetails,
    getLowStockItemsDetails,
    getUnassignedAssetsDetails,
    getNearingEOLDetails
} = require('../controllers/dashboardController.js');
const { protect, admin } = require('../middlewares/authMiddleware.js');

// @desc    Get all dashboard statistics
// @route   GET /api/dashboard/stats
// @access  Private/Admin
router.route('/stats').get(protect, admin, getDashboardStats);

// @desc    Get details for drill-down modals
// @route   GET /api/dashboard/details/:type
// @access  Private/Admin
router.route('/details/pending-requisitions').get(protect, admin, getPendingRequisitionsDetails);
router.route('/details/low-stock-items').get(protect, admin, getLowStockItemsDetails);
router.route('/details/unassigned-assets').get(protect, admin, getUnassignedAssetsDetails);
router.route('/details/nearing-eol').get(protect, admin, getNearingEOLDetails);


module.exports = router;