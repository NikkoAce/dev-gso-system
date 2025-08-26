const express = require('express');
const router = express.Router();
const { createPAR, getPARs } = require('../controllers/parController.js');
const { protect, checkPermission } = require('../middlewares/authMiddleware.js');

router.route('/').post(protect, checkPermission('slip:generate'), createPAR).get(protect, checkPermission('slip:read'), getPARs);

module.exports = router;