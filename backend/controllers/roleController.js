const asyncHandler = require('express-async-handler');
const Role = require('../models/Role');
const User = require('../models/User');

/**
 * @desc    Get all roles
 * @route   GET /api/roles
 * @access  Private/Admin (Requires 'user:manage')
 */
const getRoles = asyncHandler(async (req, res) => {
    const roles = await Role.find({}).sort({ name: 1 });
    res.status(200).json(roles);
});

/**
 * @desc    Create a new role
 * @route   POST /api/roles
 * @access  Private/Admin (Requires 'user:manage')
 */
const createRole = asyncHandler(async (req, res) => {
    const { name, permissions } = req.body;

    if (!name) {
        res.status(400);
        throw new Error('Role name is required.');
    }

    const roleExists = await Role.findOne({ name });
    if (roleExists) {
        res.status(400);
        throw new Error('A role with this name already exists.');
    }

    const role = await Role.create({ name, permissions: permissions || [] });
    res.status(201).json(role);
});

/**
 * @desc    Update a role
 * @route   PUT /api/roles/:id
 * @access  Private/Admin (Requires 'user:manage')
 */
const updateRole = asyncHandler(async (req, res) => {
    const { name, permissions } = req.body;
    const role = await Role.findById(req.params.id);

    if (!role) {
        res.status(404);
        throw new Error('Role not found.');
    }

    role.name = name || role.name;
    role.permissions = permissions ?? role.permissions;

    const updatedRole = await role.save();
    res.status(200).json(updatedRole);
});

/**
 * @desc    Delete a role
 * @route   DELETE /api/roles/:id
 * @access  Private/Admin (Requires 'user:manage')
 */
const deleteRole = asyncHandler(async (req, res) => {
    const role = await Role.findById(req.params.id);

    if (!role) {
        res.status(404);
        throw new Error('Role not found.');
    }

    // Prevent deletion if the role is assigned to any users
    const userCount = await User.countDocuments({ role: role.name });
    if (userCount > 0) {
        res.status(400);
        throw new Error(`Cannot delete role. It is currently assigned to ${userCount} user(s).`);
    }

    await role.deleteOne();
    res.status(200).json({ message: 'Role removed successfully.' });
});

module.exports = { getRoles, createRole, updateRole, deleteRole };