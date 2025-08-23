const express = require('express');
const router = express.Router();
const { getOffices, createOffice, updateOffice, deleteOffice } = require('../controllers/officeController.js');
const { protect, gsoOnly } = require('../middleware/authMiddleware.js');

router.route('/').get(protect, getOffices).post(protect, gsoOnly, createOffice);
router.route('/:id').put(protect, gsoOnly, updateOffice).delete(protect, gsoOnly, deleteOffice);

module.exports = router;