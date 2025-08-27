const express = require('express');
const router = express.Router();
const { getRoles, createRole, updateRole, deleteRole } = require('../controllers/roleController');
const { protect, checkPermission } = require('../middlewares/authMiddleware');
const PERMISSIONS = require('../config/permissions.js');

// All routes in this file require the user:manage permission.
router.use(protect, checkPermission(PERMISSIONS.USER_MANAGE));

router.route('/').get(getRoles).post(createRole);
router.route('/:id').put(updateRole).delete(deleteRole);

module.exports = router;