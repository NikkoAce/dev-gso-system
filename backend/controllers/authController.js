const axios = require('axios');
const jwt = require('jsonwebtoken');
const User = require('../models/User'); // GSO's internal User model
const Role = require('../models/Role'); // Import the Role model
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
        // Add a timeout to prevent the request from hanging indefinitely if the portal is slow to respond.
        const response = await axios.get(`${LGU_PORTAL_API_URL}/users/me`, {
            headers: { 'Authorization': `Bearer ${portalToken}` },
            timeout: 15000 // 15 seconds
        });
        lguUser = response.data;
    } catch (error) {
        if (error.code === 'ECONNABORTED') {
            console.error('LGU Portal API timed out.');
            res.status(504); // Gateway Timeout
            throw new Error('The authentication service is not responding. Please try again in a few moments.');
        }
        console.error('Error verifying portal token with LGU Portal:', error.response ? error.response.data : error.message);
        res.status(401);
        const errorMessage = error.response?.data?.message || 'Invalid or expired portal token. Please log in again through the LGU Portal.';
        throw new Error(errorMessage);
    }

    // Step 2: Determine the user's GSO role and permissions based on portal data.
    // This makes the logic consistent for both new and existing users.
    let targetGsoRoleName;
    const adminOfficeNames = ['GSO', 'General Service Office', 'IT'];
    const adminRoleNames = ['IT'];
    
    if (adminOfficeNames.includes(lguUser.office) || adminRoleNames.includes(lguUser.role)) {
        targetGsoRoleName = 'GSO Admin';
    } else if (lguUser.role === 'GSO Admin') { // NEW: Explicitly check for 'GSO Admin' role from portal
        targetGsoRoleName = 'GSO Admin';
    } else if (lguUser.role === 'Department Head') {
        targetGsoRoleName = 'Department Head';
    } else {
        targetGsoRoleName = 'Employee';
    }

    // Fetch the permissions for the determined role from the database.
    const roleData = await Role.findOne({ name: targetGsoRoleName }).lean();
    if (!roleData) {
        // This is a critical configuration error. A role defined in the logic doesn't exist in the DB.
        console.error(`CRITICAL: The role "${targetGsoRoleName}" does not exist in the database. Cannot assign permissions.`);
        res.status(500);
        throw new Error('User role configuration error. Please contact the administrator.');
    }
    const targetPermissions = roleData.permissions;

    // Step 3: Find or Create the user in the GSO system.
    let gsoUserRecord = await User.findOne({ externalId: lguUser._id });

    if (gsoUserRecord) {
        // --- USER EXISTS ---
        // Update the user's details, including their role and permissions, to keep them in sync with the portal and role definitions.
        gsoUserRecord.name = lguUser.name;
        gsoUserRecord.office = lguUser.office;
        gsoUserRecord.role = targetGsoRoleName;
        gsoUserRecord.permissions = targetPermissions;
        await gsoUserRecord.save();
    } else {
        // --- NEW USER ---
        // Create a new user record with the determined role and permissions.
        gsoUserRecord = await User.create({
            externalId: lguUser._id,
            name: lguUser.name,
            office: lguUser.office,
            role: targetGsoRoleName,
            permissions: targetPermissions,
        });
    }

    // Step 4: Generate and send back the GSO-specific token
    const gsoToken = generateGsoToken(gsoUserRecord);
    res.status(200).json({ token: gsoToken });
});