const express = require('express');
const router = express.Router();
const { createReceivingReport, getReceivingReports } = require('../controllers/receivingReportController');
const { protect, checkPermission } = require('../middlewares/authMiddleware');
const PERMISSIONS = require('../config/permissions');

router.route('/')
    .post(protect, checkPermission(PERMISSIONS.STOCK_MANAGE), createReceivingReport)
    .get(protect, checkPermission(PERMISSIONS.STOCK_MANAGE), getReceivingReports);

module.exports = router;