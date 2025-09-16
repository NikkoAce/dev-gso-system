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

// Group all detail routes under the same protection and permission check for conciseness
const detailsRouter = express.Router();
detailsRouter.use(protect, checkPermission(PERMISSIONS.DASHBOARD_VIEW));
detailsRouter.get('/pending-requisitions', getPendingRequisitionsDetails);
detailsRouter.get('/low-stock-items', getLowStockItemsDetails);
detailsRouter.get('/unassigned-assets', getUnassignedAssetsDetails);
detailsRouter.get('/nearing-eol', getNearingEOLDetails);
router.use('/details', detailsRouter);


module.exports = router;