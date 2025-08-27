const express = require('express');
const router = express.Router();
const {
    getUsers,
    updateUser,
    getRolesAndPermissions
} = require('../controllers/userController');
const { protect, checkPermission } = require('../middlewares/authMiddleware.js');

// @desc    Get metadata (roles, permissions) for building the UI
// @route   GET /api/users/meta
router.route('/meta').get(protect, checkPermission('user:read'), getRolesAndPermissions);

// @desc    Get all users
// @route   GET /api/users
router.route('/')
    .get(protect, checkPermission('user:read'), getUsers);

// @desc    Update a single user
// @route   PUT /api/users/:id
router.route('/:id').put(protect, checkPermission('user:manage'), updateUser);

module.exports = router;