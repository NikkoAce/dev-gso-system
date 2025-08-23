const express = require('express');
const router = express.Router();
const { getEmployees, createEmployee, updateEmployee, deleteEmployee } = require('../controllers/employeeController.js');
const { protect, gsoOnly } = require('../middleware/authMiddleware.js');

router.route('/').get(protect, getEmployees).post(protect, gsoOnly, createEmployee);
router.route('/:id').put(protect, gsoOnly, updateEmployee).delete(protect, gsoOnly, deleteEmployee);

module.exports = router;