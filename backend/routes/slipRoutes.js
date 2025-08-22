const express = require('express');
const router = express.Router();
const { getSlips, getSlipById } = require('../controllers/slipController.js');
const { protect } = require('../middlewares/authMiddleware.js');


router.route('/').get(protect, getSlips);

// This new route will handle GET requests like /api/slips/some-id-here
router.route('/:id').get(protect, getSlipById);

module.exports = router;