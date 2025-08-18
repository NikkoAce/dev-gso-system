const express = require('express');
const router = express.Router();
const { createPAR, getPARs } = require('../controllers/parController.js');
const { protect } = require('../middlewares/authMiddleware.js');

router.route('/').post(protect, createPAR).get(protect, getPARs);

module.exports = router;