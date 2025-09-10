const express = require('express');
const router = express.Router();
const { createAppendix68 } = require('../controllers/appendix68Controller.js');
const { protect, checkPermission } = require('../middlewares/authMiddleware.js');
const PERMISSIONS = require('../config/permissions.js');

router.route('/').post(protect, checkPermission(PERMISSIONS.SLIP_GENERATE), createAppendix68);

module.exports = router;