const asyncHandler = require('express-async-handler');
// NOTE: This assumes you have a User model that is shared or synced from your LGU Portal.
// It should include fields like name, email, office, role, and permissions.
const User = require('../models/User');
const Role = require('../models/Role');
const PERMISSIONS = require('../config/permissions');

/**
 * @desc    Get all users from the database
 * @route   GET /api/users
 * @access  Private/Admin (Requires 'user:read' permission)
 */
const getUsers = asyncHandler(async (req, res) => {
    const users = await User.find({}).select('-password').sort({ name: 1 });
    res.json(users);
});

/**
 * @desc    Update a user's role and permissions
 * @route   PUT /api/users/:id
 * @access  Private/Admin (Requires 'user:manage' permission)
 */
const updateUser = asyncHandler(async (req, res) => {
    const { role, permissions } = req.body;

    const user = await User.findById(req.params.id);

    if (user) {
        user.role = role ?? user.role;
        user.permissions = permissions ?? user.permissions;

        const updatedUser = await user.save();
        res.json({
            _id: updatedUser._id,
            name: updatedUser.name,
            email: updatedUser.email,
            office: updatedUser.office,
            role: updatedUser.role,
            permissions: updatedUser.permissions,
        });
    } else {
        res.status(404);
        throw new Error('User not found');
    }
});

/**
 * @desc    Update the current user's dashboard preferences
 * @route   PUT /api/users/preferences
 * @access  Private
 */
const updateUserDashboardPreferences = asyncHandler(async (req, res) => {
    // req.user.id is attached by the 'protect' middleware
    const user = await User.findById(req.user.id);

    if (user) {
        user.dashboardPreferences = req.body;
        const updatedUser = await user.save();
        res.status(200).json(updatedUser.dashboardPreferences);
    } else {
        res.status(404);
        throw new Error('User not found');
    }
});

/**
 * @desc    Get available roles and permissions for the UI
 * @route   GET /api/users/meta
 * @access  Private/Admin (Requires 'user:read' permission)
 */
const getRolesAndPermissions = asyncHandler(async (req, res) => {
    const roles = await Role.find({}).sort({ name: 1 }).lean();

    res.json({
        roles: roles, // Return the full role objects, not just names
        permissions: Object.values(PERMISSIONS).sort(),
    });
});

module.exports = { getUsers, updateUser, getRolesAndPermissions, updateUserDashboardPreferences };