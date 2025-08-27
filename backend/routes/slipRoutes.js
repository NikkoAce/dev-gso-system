const express = require('express');
const router = express.Router();
const { getSlips, getSlipById } = require('../controllers/slipController');
const { protect, checkPermission } = require('../middlewares/authMiddleware.js');
const PERMISSIONS = require('../config/permissions.js');

router.route('/').get(protect, checkPermission(PERMISSIONS.SLIP_READ), getSlips);

// This new route will handle GET requests like /api/slips/some-id-here
router.route('/:id').get(protect, checkPermission(PERMISSIONS.SLIP_READ), getSlipById);

module.exports = router;