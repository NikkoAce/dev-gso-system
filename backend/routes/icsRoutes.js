const express = require('express');
const router = express.Router();
const { createICS, getICSs } = require('../controllers/icsController.js');
const { protect, checkPermission } = require('../middlewares/authMiddleware.js');
const PERMISSIONS = require('../config/permissions.js');

router.route('/').post(protect, checkPermission(PERMISSIONS.SLIP_GENERATE), createICS).get(protect, checkPermission(PERMISSIONS.SLIP_READ), getICSs);

module.exports = router;