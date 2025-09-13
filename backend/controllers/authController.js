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

    // Step 2: Find or Create the user in the GSO system.
    let gsoUserRecord = await User.findOne({ externalId: lguUser._id });

    if (gsoUserRecord) {
        // --- USER EXISTS ---
        // Sync basic details from the portal.
        gsoUserRecord.name = lguUser.name;
        gsoUserRecord.office = lguUser.office;

        // IMPORTANT FIX: Re-sync permissions from the user's assigned role.
        // This ensures that any changes made in Role Management are applied on the next login.
        const userRole = await Role.findOne({ name: gsoUserRecord.role });
        if (userRole) {
            // If the user's role is "GSO Admin", grant them ALL available permissions.
            if (userRole.name === 'GSO Admin') {
                gsoUserRecord.permissions = Object.values(PERMISSIONS);
            } else {
                // For other roles, use the permissions defined in the database for that role.
                gsoUserRecord.permissions = userRole.permissions;
            }
        }

        await gsoUserRecord.save();
    } else {
        // --- NEW USER LOGIC ---
        // Determine the role and permissions for a new user based on their portal role.
        let targetGsoRoleName;
        let permissionsForNewUser;

        // Check if the user is an admin from the portal.
        if (lguUser.role === 'Admin' || lguUser.role === 'GSO Admin') {
            targetGsoRoleName = 'GSO Admin';
            // GSO Admins get all available permissions.
            permissionsForNewUser = Object.values(PERMISSIONS);
        } else if (lguUser.role === 'Department Head') {
            targetGsoRoleName = 'Department Head';
            // Department Heads get a specific set of permissions.
            permissionsForNewUser = [
                PERMISSIONS.ASSET_READ_OWN_OFFICE,
                PERMISSIONS.STOCK_READ,
                PERMISSIONS.REQUISITION_CREATE,
                PERMISSIONS.REQUISITION_READ_OWN_OFFICE,
            ];
        } else {
            targetGsoRoleName = 'Employee';
            // Employees get a default, limited set of permissions.
            permissionsForNewUser = [
                PERMISSIONS.ASSET_READ_OWN_OFFICE,
                PERMISSIONS.STOCK_READ,
                PERMISSIONS.REQUISITION_CREATE,
                PERMISSIONS.REQUISITION_READ_OWN_OFFICE,
            ];
        }

        // Ensure the role exists in the database before assigning it to the user.
        // If it doesn't exist, create it with the correct set of permissions.
        await Role.findOneAndUpdate(
            { name: targetGsoRoleName },
            { $setOnInsert: { name: targetGsoRoleName, permissions: permissionsForNewUser } },
            { upsert: true }
        );

        // Create the new user with the role's permissions.
        gsoUserRecord = await User.create({
            externalId: lguUser._id,
            name: lguUser.name,
            office: lguUser.office,
            role: targetGsoRoleName,
            permissions: permissionsForNewUser,
        });
    }

    // Step 3: Generate and send back the GSO-specific token
    // The gsoUserRecord now has the most up-to-date permissions.
    const gsoToken = generateGsoToken(gsoUserRecord);
    res.status(200).json({ token: gsoToken });
});