const asyncHandler = require('express-async-handler');
const Role = require('../models/Role');
const User = require('../models/User');

/**
 * @desc    Get all roles
 * @route   GET /api/roles
 * @access  Private/Admin (Requires 'user:manage')
 */
const getRoles = asyncHandler(async (req, res) => {
    const {
        page = 1,
        limit = 10, // Roles are fewer, so a smaller limit is fine
        sort = 'name',
        order = 'asc',
        search = ''
    } = req.query;

    const query = {};
    if (search) {
        query.name = { $regex: search, $options: 'i' };
    }

    const pageNum = parseInt(page, 10);
    const limitNum = parseInt(limit, 10);
    const skip = (pageNum - 1) * limitNum;

    // Use an aggregation pipeline to allow sorting by the number of permissions.
    const pipeline = [];

    // Match stage for searching
    if (Object.keys(query).length > 0) {
        pipeline.push({ $match: query });
    }

    // Add a field for the count of permissions
    pipeline.push({
        $addFields: {
            permissionsCount: { $size: "$permissions" }
        }
    });

    // Sort stage
    const sortOptions = { [sort]: order === 'asc' ? 1 : -1 };
    pipeline.push({ $sort: sortOptions });

    // Facet for pagination and total count
    pipeline.push({
        $facet: {
            docs: [{ $skip: skip }, { $limit: limitNum }],
            totalDocs: [{ $count: 'count' }]
        }
    });

    const results = await Role.aggregate(pipeline);
    const roles = results[0].docs;
    const totalDocs = results[0].totalDocs.length > 0 ? results[0].totalDocs[0].count : 0;

    res.json({ docs: roles, totalDocs, limit: limitNum, totalPages: Math.ceil(totalDocs / limitNum), page: pageNum });
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