const express = require('express');
const router = express.Router();
const { getCategories, createCategory, updateCategory, deleteCategory } = require('../controllers/categoryController.js');
const { protect, checkPermission } = require('../middlewares/authMiddleware.js');

router.route('/').get(protect, checkPermission('settings:read'), getCategories).post(protect, checkPermission('settings:manage'), createCategory);
router.route('/:id').put(protect, checkPermission('settings:manage'), updateCategory).delete(protect, checkPermission('settings:manage'), deleteCategory);

module.exports = router;