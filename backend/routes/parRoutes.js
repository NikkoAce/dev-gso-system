const express = require('express');
const router = express.Router();
const { createPAR, getPARs } = require('../controllers/parController.js');
const { protect, gsoOnly } = require('../middleware/authMiddleware.js');

router.route('/').post(protect, gsoOnly, createPAR).get(protect, gsoOnly, getPARs);

module.exports = router;