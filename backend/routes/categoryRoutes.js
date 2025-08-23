const express = require('express');
const router = express.Router();
const { getCategories, createCategory, updateCategory, deleteCategory } = require('../controllers/categoryController.js');
const { protect, gsoOnly } = require('../middleware/authMiddleware.js');

router.route('/').get(protect, getCategories).post(protect, gsoOnly, createCategory);
router.route('/:id').put(protect, gsoOnly, updateCategory).delete(protect, gsoOnly, deleteCategory);

module.exports = router;