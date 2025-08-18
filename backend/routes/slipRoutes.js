const express = require('express');
const router = express.Router();
const { getSlips } = require('../controllers/slipController.js');
const { protect } = require('../middlewares/authMiddleware.js');


router.route('/').get(protect, getSlips);

module.exports = router;