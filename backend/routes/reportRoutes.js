const express = require('express');
const router = express.Router();
const { generateRpcppeReport, generateDepreciationReport, generateImmovableReport, testReportRoute } = require('../controllers/reportController.js');
const { protect, checkPermission } = require('../middlewares/authMiddleware.js');

router.get('/rpcppe', protect, checkPermission('report:generate'), generateRpcppeReport);
router.get('/depreciation', protect, checkPermission('report:generate'), generateDepreciationReport);
router.get('/immovable', protect, checkPermission('report:generate'), generateImmovableReport);
router.get('/test', protect, checkPermission('report:generate'), testReportRoute);

module.exports = router;
  