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
    const {
        page = 1,
        limit = 20,
        sort = 'name',
        order = 'asc',
        search = ''
    } = req.query;

    const query = {};
    if (search) {
        const searchRegex = new RegExp(search, 'i');
        query.$or = [
            { name: searchRegex },
            { email: searchRegex },
            { office: searchRegex }
        ];
    }

    const sortOptions = { [sort]: order === 'asc' ? 1 : -1 };
    const pageNum = parseInt(page, 10);
    const limitNum = parseInt(limit, 10);
    const skip = (pageNum - 1) * limitNum;

    const [users, totalDocs] = await Promise.all([
        User.find(query).select('-password').sort(sortOptions).skip(skip).limit(limitNum).lean(),
        User.countDocuments(query)
    ]);

    res.json({
        docs: users,
        totalDocs,
        limit: limitNum,
        totalPages: Math.ceil(totalDocs / limitNum),
        page: pageNum,
    });
});

/**
 * @desc    Update a user's role and permissions
 * @route   PUT /api/users/:id
 * @access  Private/Admin (Requires 'user:manage' permission)
 */
const updateUser = asyncHandler(async (req, res) => {
    const { role: roleName, permissions } = req.body;

    const user = await User.findById(req.params.id);

    if (user) {
        // If the role is being changed, fetch the permissions for that role
        // and apply them to the user, overwriting any individual permissions.
        if (roleName && roleName !== user.role) {
            const roleData = await Role.findOne({ name: roleName });
            if (roleData) {
                user.permissions = roleData.permissions;
            }
        }

        user.role = roleName ?? user.role;
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
 * @desc    Get the current user's profile
 * @route   GET /api/users/profile
 * @access  Private
 */
const getUserProfile = asyncHandler(async (req, res) => {
    // req.user is attached by the protect middleware and contains the user's ID from the token
    const user = await User.findById(req.user.id).select('-password'); // Exclude password just in case
    if (user) {
        res.json(user);
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

module.exports = { getUsers, updateUser, getRolesAndPermissions, updateUserDashboardPreferences, getUserProfile };