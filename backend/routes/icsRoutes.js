const express = require('express');
const router = express.Router();
const { createICS, getICSs } = require('../controllers/icsController.js');
const { protect, gso } = require('../middlewares/authMiddleware.js');

router.route('/').post(protect, gso, createICS).get(protect, gso, getICSs);

module.exports = router;