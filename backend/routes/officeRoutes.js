const express = require('express');
const router = express.Router();
const { getOffices, createOffice, updateOffice, deleteOffice } = require('../controllers/officeController.js');
const { protect } = require('../middlewares/authMiddleware.js');


router.route('/').get(getOffices).post(protect, createOffice);
router.route('/:id').put(protect, updateOffice).delete(protect, deleteOffice);

module.exports = router;