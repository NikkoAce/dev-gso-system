const axios = require('axios');
const jwt = require('jsonwebtoken');
const User = require('../models/User'); // GSO's internal User model
const asyncHandler = require('express-async-handler');
const PERMISSIONS = require('../config/permissions');

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
        if (gsoUserRecord.role === 'GSO Admin') { // Directly assign the canonical list of permissions to ensure admins are always up-to-date.
            // This fixes the issue where existing admins might not have newly added permissions.
            gsoUserRecord.permissions = [
                PERMISSIONS.DASHBOARD_VIEW, PERMISSIONS.ASSET_CREATE, PERMISSIONS.ASSET_READ, PERMISSIONS.ASSET_READ_OWN_OFFICE,
                PERMISSIONS.ASSET_UPDATE, PERMISSIONS.ASSET_DELETE, PERMISSIONS.ASSET_EXPORT, PERMISSIONS.ASSET_TRANSFER,
                PERMISSIONS.IMMOVABLE_CREATE, PERMISSIONS.IMMOVABLE_READ, PERMISSIONS.IMMOVABLE_UPDATE, PERMISSIONS.IMMOVABLE_DELETE,
                PERMISSIONS.SLIP_GENERATE, PERMISSIONS.SLIP_READ,
                PERMISSIONS.STOCK_READ, PERMISSIONS.STOCK_MANAGE,
                PERMISSIONS.REQUISITION_CREATE, PERMISSIONS.REQUISITION_READ_OWN_OFFICE, PERMISSIONS.REQUISITION_READ_ALL, PERMISSIONS.REQUISITION_FULFILL,
                PERMISSIONS.REPORT_GENERATE,
                PERMISSIONS.SETTINGS_READ, PERMISSIONS.SETTINGS_MANAGE,
                PERMISSIONS.USER_READ, PERMISSIONS.USER_MANAGE
            ];
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
            gsoRole = 'GSO Admin'; // Admins should be able to read and manage users
            permissions = [
                PERMISSIONS.DASHBOARD_VIEW, PERMISSIONS.ASSET_CREATE, PERMISSIONS.ASSET_READ, PERMISSIONS.ASSET_READ_OWN_OFFICE,
                PERMISSIONS.ASSET_UPDATE, PERMISSIONS.ASSET_DELETE, PERMISSIONS.ASSET_EXPORT, PERMISSIONS.ASSET_TRANSFER,
                PERMISSIONS.IMMOVABLE_CREATE, PERMISSIONS.IMMOVABLE_READ, PERMISSIONS.IMMOVABLE_UPDATE, PERMISSIONS.IMMOVABLE_DELETE,
                PERMISSIONS.SLIP_GENERATE, PERMISSIONS.SLIP_READ,
                PERMISSIONS.STOCK_READ, PERMISSIONS.STOCK_MANAGE,
                PERMISSIONS.REQUISITION_CREATE, PERMISSIONS.REQUISITION_READ_OWN_OFFICE, PERMISSIONS.REQUISITION_READ_ALL, PERMISSIONS.REQUISITION_FULFILL,
                PERMISSIONS.REPORT_GENERATE,
                PERMISSIONS.SETTINGS_READ, PERMISSIONS.SETTINGS_MANAGE,
                PERMISSIONS.USER_READ, PERMISSIONS.USER_MANAGE
            ];
        } else {
            gsoRole = lguUser.role === 'Department Head' ? 'Department Head' : 'Employee';
            permissions = [
                PERMISSIONS.DASHBOARD_VIEW,
                PERMISSIONS.ASSET_READ_OWN_OFFICE,
                PERMISSIONS.REQUISITION_CREATE,
                PERMISSIONS.REQUISITION_READ_OWN_OFFICE
            ];
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