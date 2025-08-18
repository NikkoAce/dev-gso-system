const express = require('express');
const router = express.Router();
const { createICS, getICSs } = require('../controllers/icsController.js');
const { protect } = require('../middlewares/authMiddleware.js');


router.route('/').post(protect, createICS).get(protect, getICSs);

module.exports = router;