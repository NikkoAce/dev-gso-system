const express = require('express');
const router = express.Router();
const { getOffices, createOffice, updateOffice, deleteOffice } = require('../controllers/officeController.js');
const { protect, gso } = require('../middlewares/authMiddleware.js');

router.route('/').get(protect, getOffices).post(protect, gso, createOffice);
router.route('/:id').put(protect, gso, updateOffice).delete(protect, gso, deleteOffice);

module.exports = router;