const express = require('express');
const router = express.Router();
const { getOffices, createOffice, updateOffice, deleteOffice } = require('../controllers/officeController.js');
const { protect, checkPermission } = require('../middlewares/authMiddleware.js');

router.route('/').get(protect, checkPermission('settings:read'), getOffices).post(protect, checkPermission('settings:manage'), createOffice);
router.route('/:id').put(protect, checkPermission('settings:manage'), updateOffice).delete(protect, checkPermission('settings:manage'), deleteOffice);

module.exports = router;