const express = require('express');
const router = express.Router();
const { createPAR, getPARs } = require('../controllers/parController.js');
const { protect, gso } = require('../middlewares/authMiddleware.js');

router.route('/').post(protect, gso, createPAR).get(protect, gso, getPARs);

module.exports = router;