const express = require('express');
const router = express.Router();
const { generateRpcppeReport, generateDepreciationReport, generateImmovableReport, testReportRoute } = require('../controllers/reportController.js');
const { protect, gso } = require('../middlewares/authMiddleware.js');

router.get('/rpcppe', protect, gso, generateRpcppeReport);
router.get('/depreciation', protect, gso, generateDepreciationReport);
router.get('/immovable', protect, gso, generateImmovableReport);
router.get('/test', protect, gso, testReportRoute);

module.exports = router;
  