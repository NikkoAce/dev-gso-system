const express = require('express');
console.log('--- userRoutes.js file is being loaded ---');
const router = express.Router();
const {
    getUsers,
    updateUser,
    getRolesAndPermissions,
    updateUserDashboardPreferences,
    getUserProfile
} = require('../controllers/userController');
const { protect, checkPermission } = require('../middlewares/authMiddleware');
const PERMISSIONS = require('../config/permissions');

// @desc    Get metadata (roles, permissions) for building the UI
// @route   GET /api/users/meta
router.route('/meta').get(protect, checkPermission(PERMISSIONS.USER_READ), getRolesAndPermissions);

// @desc    Get the currently logged-in user's full profile
// @route   GET /api/users/profile
router.route('/profile').get(protect, getUserProfile);

// --- NEW ROUTE ---
// This route allows a logged-in user to update their own preferences.
// It must be defined BEFORE the '/:id' route to be matched correctly.
router.route('/preferences')
    .put(protect, updateUserDashboardPreferences);

// @desc    Get all users
// @route   GET /api/users
router.route('/')
    .get(protect, checkPermission(PERMISSIONS.USER_READ), getUsers);

// @desc    Update a single user
// @route   PUT /api/users/:id (This is a generic route, so it comes last)
router.route('/:id').put(protect, checkPermission(PERMISSIONS.USER_MANAGE), updateUser);

module.exports = router;