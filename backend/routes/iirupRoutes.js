const express = require('express');
const router = express.Router();
const { createIIRUP } = require('../controllers/iirupController.js');
const { protect, checkPermission } = require('../middlewares/authMiddleware.js');
const PERMISSIONS = require('../config/permissions.js');

router.route('/').post(protect, checkPermission(PERMISSIONS.SLIP_GENERATE), createIIRUP);

module.exports = router;
