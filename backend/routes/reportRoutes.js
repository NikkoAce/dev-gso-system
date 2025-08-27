const express = require('express');
const router = express.Router();
const { generateRpcppeReport, generateDepreciationReport, generateImmovableReport, testReportRoute } = require('../controllers/reportController.js');
const { protect, checkPermission } = require('../middlewares/authMiddleware.js');
const PERMISSIONS = require('../config/permissions.js');

router.get('/rpcppe', protect, checkPermission(PERMISSIONS.REPORT_GENERATE), generateRpcppeReport);
router.get('/depreciation', protect, checkPermission(PERMISSIONS.REPORT_GENERATE), generateDepreciationReport);
router.get('/immovable', protect, checkPermission(PERMISSIONS.REPORT_GENERATE), generateImmovableReport);
router.get('/test', protect, checkPermission(PERMISSIONS.REPORT_GENERATE), testReportRoute);

module.exports = router;
  