const express = require('express');
const router = express.Router();
const { getCategories, createCategory, updateCategory, deleteCategory } = require('../controllers/categoryController.js');
const { protect } = require('../middlewares/authMiddleware.js');

router.route('/').get(getCategories) .post(protect, createCategory);
router.route('/:id').put(protect, updateCategory).delete(protect, deleteCategory);

module.exports = router;