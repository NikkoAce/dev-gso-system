const asyncHandler = require('express-async-handler');
// NOTE: This assumes you have a User model that is shared or synced from your LGU Portal.
// It should include fields like name, email, office, role, and permissions.
const User = require('../models/userModel');

// In a production system, these could be stored in a database.
// For now, a static list provides a clear and manageable source of truth.
const GSO_ROLES = ['GSO Admin', 'Department Head', 'Employee'];
const GSO_PERMISSIONS = [
    'dashboard:view',
    'asset:read',
    'asset:manage',
    'asset:transfer',
    'asset:dispose',
    'slip:create',
    'slip:read',
    'supply:read',
    'supply:manage',
    'requisition:create',
    'requisition:approve',
    'report:generate',
    'settings:manage',
    'user:read',
    'user:manage'
];

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
 * @desc    Get available roles and permissions for the UI
 * @route   GET /api/users/meta
 * @access  Private/Admin (Requires 'user:read' permission)
 */
const getRolesAndPermissions = asyncHandler(async (req, res) => {
    res.json({
        roles: GSO_ROLES,
        permissions: GSO_PERMISSIONS.sort(),
    });
});

module.exports = { getUsers, updateUser, getRolesAndPermissions };