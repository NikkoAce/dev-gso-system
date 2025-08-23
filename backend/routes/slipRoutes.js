const express = require('express');
const router = express.Router();
const { getSlips, getSlipById } = require('../controllers/slipController.js');
const { protect, gsoOnly } = require('../middleware/authMiddleware.js');

router.route('/').get(protect, gsoOnly, getSlips);

// This new route will handle GET requests like /api/slips/some-id-here
router.route('/:id').get(protect, gsoOnly, getSlipById);

module.exports = router;