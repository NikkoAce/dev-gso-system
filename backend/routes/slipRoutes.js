const express = require('express');
const router = express.Router();
const { getSlips, getSlipById, cancelSlip } = require('../controllers/slipController');
const { protect, checkPermission } = require('../middlewares/authMiddleware.js');
const PERMISSIONS = require('../config/permissions.js');

router.route('/').get(protect, checkPermission(PERMISSIONS.SLIP_READ), getSlips);

// This route handles GET requests like /api/slips/some-id-here
router.route('/:id').get(protect, checkPermission(PERMISSIONS.SLIP_READ), getSlipById);

// This new route handles PUT requests to cancel a slip
// It's a more specific route, so it should come after the general '/:id' GET route
// to avoid conflicts, though Express handles them by method.
// Assuming a 'slip:manage' permission exists for such actions.
router.route('/:id/cancel').put(protect, checkPermission(PERMISSIONS.SLIP_MANAGE), cancelSlip);

module.exports = router;