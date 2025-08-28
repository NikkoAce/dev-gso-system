const express = require('express');
console.log('--- userRoutes.js file is being loaded ---');
const router = express.Router();
const {
    getUsers,
    updateUser,
    getRolesAndPermissions,
    updateUserDashboardPreferences
} = require('../controllers/userController');
const { protect, checkPermission } = require('../middlewares/authMiddleware');
const PERMISSIONS = require('../config/permissions');

// @desc    Get metadata (roles, permissions) for building the UI
// @route   GET /api/users/meta
router.route('/meta').get(protect, checkPermission(PERMISSIONS.USER_READ), getRolesAndPermissions);

// @desc    Get all users
// @route   GET /api/users
router.route('/')
    .get(protect, checkPermission(PERMISSIONS.USER_READ), getUsers);

// @desc    Update a single user
// @route   PUT /api/users/:id
router.route('/:id').put(protect, checkPermission(PERMISSIONS.USER_MANAGE), updateUser);

// --- NEW ROUTE ---
// This route allows a logged-in user to update their own preferences.
// It doesn't need special permissions beyond being authenticated.
router.route('/preferences')
    .put(protect, updateUserDashboardPreferences);

module.exports = router;