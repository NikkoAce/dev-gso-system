const express = require('express');
const router = express.Router();
const { createICS, getICSs } = require('../controllers/icsController.js');
const { protect, checkPermission } = require('../middlewares/authMiddleware.js');

router.route('/').post(protect, checkPermission('slip:generate'), createICS).get(protect, checkPermission('slip:read'), getICSs);

module.exports = router;