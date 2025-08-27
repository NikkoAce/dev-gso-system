const express = require('express');
const router = express.Router();
const { getEmployees, createEmployee, updateEmployee, deleteEmployee } = require('../controllers/employeeController.js');
const { protect, checkPermission } = require('../middlewares/authMiddleware.js');
const PERMISSIONS = require('../config/permissions.js');

router.route('/').get(protect, checkPermission(PERMISSIONS.SETTINGS_READ), getEmployees).post(protect, checkPermission(PERMISSIONS.SETTINGS_MANAGE), createEmployee);
router.route('/:id').put(protect, checkPermission(PERMISSIONS.SETTINGS_MANAGE), updateEmployee).delete(protect, checkPermission(PERMISSIONS.SETTINGS_MANAGE), deleteEmployee);

module.exports = router;