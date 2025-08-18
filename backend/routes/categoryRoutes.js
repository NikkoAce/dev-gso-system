const express = require('express');
const router = express.Router();
const { getCategories, createCategory, deleteCategory } = require('../controllers/categoryController.js');
const { protect } = require('../middlewares/authMiddleware.js');

router.route('/').get(getCategories) .post(protect, createCategory);
router.route('/:id').delete(protect, deleteCategory);

module.exports = router;