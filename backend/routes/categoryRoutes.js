const express = require('express');
const router = express.Router();
const { getCategories, createCategory, updateCategory, deleteCategory } = require('../controllers/categoryController.js');
const { protect, checkPermission } = require('../middlewares/authMiddleware.js');
const PERMISSIONS = require('../config/permissions.js');

router.route('/').get(protect, checkPermission(PERMISSIONS.SETTINGS_READ), getCategories).post(protect, checkPermission(PERMISSIONS.SETTINGS_MANAGE), createCategory);
router.route('/:id').put(protect, checkPermission(PERMISSIONS.SETTINGS_MANAGE), updateCategory).delete(protect, checkPermission(PERMISSIONS.SETTINGS_MANAGE), deleteCategory);

module.exports = router;