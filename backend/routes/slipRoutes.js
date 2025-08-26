const express = require('express');
const router = express.Router();
const { getSlips, getSlipById } = require('../controllers/slipController');
const { protect, checkPermission } = require('../middlewares/authMiddleware.js');

router.route('/').get(protect, checkPermission('slip:read'), getSlips);

// This new route will handle GET requests like /api/slips/some-id-here
router.route('/:id').get(protect, checkPermission('slip:read'), getSlipById);

module.exports = router;