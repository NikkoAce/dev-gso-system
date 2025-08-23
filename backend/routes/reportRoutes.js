const express = require('express');
const router = express.Router();
const { generateRpcppeReport, generateDepreciationReport, testReportRoute } = require('../controllers/reportController.js');
const { protect, gsoOnly } = require('../middleware/authMiddleware.js');

router.get('/rpcppe', protect, gsoOnly, generateRpcppeReport);
router.get('/depreciation', protect, gsoOnly, generateDepreciationReport);
router.get('/test', protect, gsoOnly, testReportRoute);

module.exports = router;
  