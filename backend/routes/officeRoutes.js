const express = require('express');
const router = express.Router();
const { getOffices, createOffice, updateOffice, deleteOffice } = require('../controllers/officeController.js');
const { protect, checkPermission } = require('../middlewares/authMiddleware.js');
const PERMISSIONS = require('../config/permissions.js');

// @desc    Get a public list of all offices for dropdowns
// @route   GET /api/offices/public
router.route('/public').get(getOffices);

router.route('/').get(protect, checkPermission(PERMISSIONS.SETTINGS_READ), getOffices).post(protect, checkPermission(PERMISSIONS.SETTINGS_MANAGE), createOffice);
router.route('/:id').put(protect, checkPermission(PERMISSIONS.SETTINGS_MANAGE), updateOffice).delete(protect, checkPermission(PERMISSIONS.SETTINGS_MANAGE), deleteOffice);

module.exports = router;