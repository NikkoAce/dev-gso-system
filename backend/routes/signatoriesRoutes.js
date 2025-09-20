const express = require('express');
const router = express.Router();
const { getSignatorySettings, updateSignatorySettings } = require('../controllers/signatoriesController');
const { protect, checkPermission } = require('../middlewares/authMiddleware');
const PERMISSIONS = require('../config/permissions');

// All routes in this file are related to signatories.

router.route('/')
    .get(protect, checkPermission(PERMISSIONS.SETTINGS_READ), getSignatorySettings)
    .post(protect, checkPermission(PERMISSIONS.SETTINGS_MANAGE), updateSignatorySettings);

module.exports = router;