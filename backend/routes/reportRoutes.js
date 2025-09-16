const express = require('express');
const router = express.Router();
const { generateRpcppeReport, generateDepreciationReport, generateImmovableReport, testReportRoute, generateMovableLedgerCard } = require('../controllers/reportController.js');
const { protect, checkPermission } = require('../middlewares/authMiddleware.js');
const PERMISSIONS = require('../config/permissions.js');

router.get('/rpcppe', protect, checkPermission(PERMISSIONS.REPORT_GENERATE), generateRpcppeReport);
router.get('/depreciation', protect, checkPermission(PERMISSIONS.REPORT_GENERATE), generateDepreciationReport);
router.get('/immovable', protect, checkPermission(PERMISSIONS.REPORT_GENERATE), generateImmovableReport);

// Route for generating a Ledger Card for a specific movable asset (shows depreciation)
router.get('/movable-ledger-card/:id', protect, checkPermission(PERMISSIONS.REPORT_GENERATE), generateMovableLedgerCard);

module.exports = router;
  