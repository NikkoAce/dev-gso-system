const asyncHandler = require('express-async-handler');
// NOTE: This assumes you have a User model that is shared or synced from your LGU Portal.
// It should include fields like name, email, office, role, and permissions.
const User = require('../models/User');
const Role = require('../models/Role');

// This remains the canonical source of all possible permissions in the system.
const GSO_PERMISSIONS = [
    // Dashboard
    'dashboard:view',
    // Movable Assets
    'asset:create',
    'asset:read',
    'asset:read:own_office',
    'asset:update',
    'asset:delete',
    'asset:export',
    'asset:transfer',
    // Immovable Assets
    'immovable:create', 'immovable:read', 'immovable:update', 'immovable:delete',
    // Slips (PAR, ICS, PTR)
    'slip:generate',
    'slip:read',
    // Supplies & Requisitions
    'stock:read', 'stock:manage',
    'requisition:create', 'requisition:read:own_office', 'requisition:read:all', 'requisition:fulfill',
    // Other Modules
    'report:generate',
    'settings:read', 'settings:manage',
    'user:read', 'user:manage'
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
    const roles = await Role.find({}).select('name').sort({ name: 1 });

    res.json({
        roles: roles.map(r => r.name),
        permissions: GSO_PERMISSIONS.sort(),
    });
});

module.exports = { getUsers, updateUser, getRolesAndPermissions };