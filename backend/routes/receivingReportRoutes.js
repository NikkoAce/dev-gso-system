const express = require('express');
const router = express.Router();
const { createReceivingReport, getReceivingReports } = require('../controllers/receivingReportController');
const { protect, hasPermission } = require('../middleware/authMiddleware');

router.route('/')
    .post(protect, hasPermission('stock:manage'), createReceivingReport)
    .get(protect, hasPermission('stock:manage'), getReceivingReports);

module.exports = router;