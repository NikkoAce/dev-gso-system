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
    const { token: portalToken } = req.body; // Token from LGU Employee Portal

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

        lguUser = response.data; // This is the user object from the LGU Portal
    } catch (error) {
        console.error('Error verifying portal token with LGU Portal:', error.response ? error.response.data : error.message);
        res.status(401);
        throw new Error('Invalid or expired portal token. Please log in again through the LGU Portal.');
    }

    // Define GSO-specific roles and permissions based on LGU user's role/office
    let gsoRole = 'Employee'; // Default GSO role
    let permissions = [];

    // IMPORTANT: Customize these permission mappings based on your actual requirements
    if (lguUser.office === 'GSO') {
        gsoRole = 'GSO Admin';
        permissions = [
            'dashboard:view', 'asset:create', 'asset:read', 'asset:read:own_office', 'asset:update', 'asset:delete', 'asset:export', 'asset:transfer',
            'immovable:create', 'immovable:read', 'immovable:update', 'immovable:delete', 'slip:generate', 'slip:read', 'stock:read', 'stock:manage',
            'requisition:create', 'requisition:read:own_office', 'requisition:read:all', 'requisition:fulfill', 'report:generate', 'settings:read', 'settings:manage', 'user:manage'
        ];
    } else { // Regular Employee or Department Head
        gsoRole = lguUser.role === 'Department Head' ? 'Department Head' : 'Employee';
        permissions = ['dashboard:view', 'asset:read:own_office', 'requisition:create', 'requisition:read:own_office'];
    }

    // Step 2: Use findOneAndUpdate with upsert to atomically find and update, or create the user.
    // This is more robust than a separate find and create/update, preventing duplicate key errors.
    const gsoUserRecord = await User.findOneAndUpdate(
        { externalId: lguUser._id }, // Find user by their portal ID
        { // Data to set on update or insert
            name: lguUser.name,
            office: lguUser.office,
            role: gsoRole,
            permissions: permissions,
            externalId: lguUser._id
        },
        {
            new: true, // Return the modified document rather than the original
            upsert: true, // Create a new document if no matching document is found
            setDefaultsOnInsert: true
        }
    );

    // Step 3: Generate and send back the GSO-specific token
    const gsoToken = generateGsoToken(gsoUserRecord);
    res.status(200).json({ token: gsoToken });
});