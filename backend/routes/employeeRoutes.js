const express = require('express');
const router = express.Router();
const { getEmployees, createEmployee, updateEmployee, deleteEmployee } = require('../controllers/employeeController.js');
const { protect, checkPermission } = require('../middlewares/authMiddleware.js');

router.route('/').get(protect, checkPermission('settings:read'), getEmployees).post(protect, checkPermission('settings:manage'), createEmployee);
router.route('/:id').put(protect, checkPermission('settings:manage'), updateEmployee).delete(protect, checkPermission('settings:manage'), deleteEmployee);

module.exports = router;