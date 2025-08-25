const express = require('express');
const router = express.Router();
const { getSlips, getSlipById } = require('../controllers/slipController');
const { protect, gso } = require('../middlewares/authMiddleware.js');

router.route('/').get(protect, gso, getSlips);

// This new route will handle GET requests like /api/slips/some-id-here
router.route('/:id').get(protect, gso, getSlipById);

module.exports = router;