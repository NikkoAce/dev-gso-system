const express = require('express');
const router = express.Router();
const { createPAR, getPARs } = require('../controllers/parController.js');
const { protect, checkPermission } = require('../middlewares/authMiddleware.js');
const PERMISSIONS = require('../config/permissions.js');

router.route('/').post(protect, checkPermission(PERMISSIONS.SLIP_GENERATE), createPAR).get(protect, checkPermission(PERMISSIONS.SLIP_READ), getPARs);

module.exports = router;