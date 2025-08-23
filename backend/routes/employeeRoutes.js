const express = require('express');
const router = express.Router();
const { getEmployees, createEmployee, updateEmployee, deleteEmployee } = require('../controllers/employeeController.js');
const { protect, gso } = require('../middlewares/authMiddleware.js');

router.route('/').get(protect, getEmployees).post(protect, gso, createEmployee);
router.route('/:id').put(protect, gso, updateEmployee).delete(protect, gso, deleteEmployee);

module.exports = router;