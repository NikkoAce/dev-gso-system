const express = require('express');
const router = express.Router();
const { getEmployees, createEmployee, updateEmployee, deleteEmployee } = require('../controllers/employeeController.js');
const { protect } = require('../middlewares/authMiddleware.js');

router.route('/').get(getEmployees).post(protect, createEmployee);
router.route('/:id').put(updateEmployee) .delete(protect, deleteEmployee);

module.exports = router;