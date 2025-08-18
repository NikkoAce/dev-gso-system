const express = require('express');
const router = express.Router();
const { generateRpcppeReport, generateDepreciationReport, testReportRoute } = require('../controllers/reportController.js');
const { protect } = require('../middlewares/authMiddleware.js');

router.get('/rpcppe', protect, generateRpcppeReport);
router.get('/depreciation', protect, generateDepreciationReport);
router.get('/test', protect, testReportRoute);

module.exports = router;
  