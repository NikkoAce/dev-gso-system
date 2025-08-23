const express = require('express');
const router = express.Router();
const { getCategories, createCategory, updateCategory, deleteCategory } = require('../controllers/categoryController.js');
const { protect, gso } = require('../middlewares/authMiddleware.js');

router.route('/').get(protect, getCategories).post(protect, gso, createCategory);
router.route('/:id').put(protect, gso, updateCategory).delete(protect, gso, deleteCategory);

module.exports = router;