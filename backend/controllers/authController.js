const axios = require('axios');
const jwt = require('jsonwebtoken');
const User = require('../models/User'); // GSO's internal User model
const asyncHandler = require('express-async-handler');

// Define the URL of the LGU Employee Portal's backend
// IMPORTANT: Ensure this matches your deployed LGU Portal backend URL
const LGU_PORTAL_API_URL = process.env.PORTAL_API_URL || 'https://lgu-helpdesk-copy.onrender.com/api';

// Helper function to generate a GSO JWT
const generateGsoToken = (gsoUserRecord) => {
    // The payload for the GSO token should directly contain the user object
    // with the GSO-specific permissions, as expected by GSO's authMiddleware.
    const payload = {
        user: { // This 'user' object will be assigned to req.user in GSO's protect middleware
            id: gsoUserRecord._id, // GSO's internal user ID
            externalId: gsoUserRecord.externalId, // LGU Portal's user ID
            name: gsoUserRecord.name,
            office: gsoUserRecord.office,
            role: gsoUserRecord.role, // GSO-specific role
            permissions: gsoUserRecord.permissions // GSO-specific permissions array
        }
    };
    return jwt.sign(payload, process.env.JWT_SECRET, {
        expiresIn: '1h' // GSO token expiration
    });
};

/**
 * Handles the Single Sign-On (SSO) login process.
 * @desc    Handle SSO login from LGU Employee Portal
 * @route   POST /api/auth/sso-login
 * @access  Public (initially, then verified by LGU Portal)
 */
exports.ssoLogin = asyncHandler(async (req, res) => {
    const { token: portalToken } = req.body;

    if (!portalToken) {
        res.status(400);
        throw new Error('No portal token provided.');
    }

    let lguUser;
    try {
        // Step 1: Verify the external token by calling the Portal's /me endpoint
        const response = await axios.get(`${LGU_PORTAL_API_URL}/users/me`, {
            headers: { 'Authorization': `Bearer ${portalToken}` }
        });
        lguUser = response.data;
    } catch (error) {
        console.error('Error verifying portal token with LGU Portal:', error.response ? error.response.data : error.message);
        res.status(401);
        throw new Error('Invalid or expired portal token. Please log in again through the LGU Portal.');
    }

    // Step 2: Find if the user already exists in the GSO system
    let gsoUserRecord = await User.findOne({ externalId: lguUser._id });

    if (gsoUserRecord) {
        // --- USER EXISTS ---
        // The user already has a profile in the GSO system.
        // We only update their name and office from the portal to keep it in sync.
        // We DO NOT overwrite their role and permissions, preserving any manual changes.
        gsoUserRecord.name = lguUser.name;
        gsoUserRecord.office = lguUser.office;

        // --- PERMISSION SYNC FOR ADMINS ---
        // This block ensures existing admins get the latest permissions.
        // It merges the current default admin permissions with any the user already has.
        if (gsoUserRecord.role === 'GSO Admin') {
            const defaultAdminPermissions = [
                'dashboard:view', 'asset:create', 'asset:read', 'asset:read:own_office', 'asset:update', 'asset:delete', 'asset:export', 'asset:transfer',
                'immovable:create', 'immovable:read', 'immovable:update', 'immovable:delete', 'slip:generate', 'slip:read', 'stock:read', 'stock:manage',
                'requisition:create', 'requisition:read:own_office', 'requisition:read:all', 'requisition:fulfill', 'report:generate', 'settings:read', 'settings:manage',
                'user:read', 'user:manage'
            ];
            // Use a Set to merge permissions, ensuring no duplicates.
            gsoUserRecord.permissions = [...new Set([...gsoUserRecord.permissions, ...defaultAdminPermissions])];
        }

        await gsoUserRecord.save();
    } else {
        // --- NEW USER ---
        // This is the user's first time logging into the GSO system.
        // We create a new record for them with default roles and permissions.
        let gsoRole = 'Employee';
        let permissions = [];

        const adminOfficeNames = ['GSO', 'General Service Office', 'IT'];
        const adminRoleNames = ['IT'];

        if (adminOfficeNames.includes(lguUser.office) || adminRoleNames.includes(lguUser.role)) {
            gsoRole = 'GSO Admin';
            permissions = [
                'dashboard:view', 'asset:create', 'asset:read', 'asset:read:own_office', 'asset:update', 'asset:delete', 'asset:export', 'asset:transfer',
                'immovable:create', 'immovable:read', 'immovable:update', 'immovable:delete', 'slip:generate', 'slip:read', 'stock:read', 'stock:manage',
                'requisition:create', 'requisition:read:own_office', 'requisition:read:all', 'requisition:fulfill', 'report:generate', 'settings:read', 'settings:manage',
                'user:read', 'user:manage' // Admins should be able to read and manage users
            ];
        } else {
            gsoRole = lguUser.role === 'Department Head' ? 'Department Head' : 'Employee';
            permissions = ['dashboard:view', 'asset:read:own_office', 'requisition:create', 'requisition:read:own_office'];
        }

        gsoUserRecord = await User.create({
            externalId: lguUser._id,
            name: lguUser.name,
            office: lguUser.office,
            role: gsoRole,
            permissions: permissions,
        });
    }

    // Step 3: Generate and send back the GSO-specific token
    const gsoToken = generateGsoToken(gsoUserRecord);
    res.status(200).json({ token: gsoToken });
});