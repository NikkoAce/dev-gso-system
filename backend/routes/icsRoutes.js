const express = require('express');
const router = express.Router();
const { createICS, getICSs } = require('../controllers/icsController.js');
const { protect, gsoOnly } = require('../middleware/authMiddleware.js');

router.route('/').post(protect, gsoOnly, createICS).get(protect, gsoOnly, getICSs);

module.exports = router;