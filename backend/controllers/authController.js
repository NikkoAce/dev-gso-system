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
    // The frontend now sends 'ssoToken' based on our previous changes.
    const { ssoToken: portalToken } = req.body;

    if (!portalToken) {
        res.status(400);
        throw new Error('No SSO token provided.');
    }

    let lguUser;
    try {
        // Step 1: Verify the temporary SSO token directly using the shared JWT secret.
        // This is much faster and more secure than making a separate API call.
        const decoded = jwt.verify(portalToken, process.env.JWT_SECRET);

        // The payload from the portal token is nested under a 'user' property.
        lguUser = decoded.user;

        if (!lguUser || !lguUser.id) {
            throw new Error('Invalid SSO token payload.');
        }
    } catch (error) {
        console.error('SSO Login Error:', error.message);
        res.status(401);
        throw new Error('Not authorized. The single sign-on link may have expired or is invalid.');
    }

    // Step 2: Find or Create the user in the GSO system.
    let gsoUserRecord = await User.findOne({ externalId: lguUser.id });

    if (gsoUserRecord) {
        // --- USER EXISTS ---
        // Always sync basic details from the portal.
        gsoUserRecord.name = lguUser.name;
        gsoUserRecord.office = lguUser.office;

        // IMPORTANT: Do not downgrade a GSO Admin. Their role is managed within the GSO system.
        // For all other users, we resync their role and permissions from the portal to ensure consistency.
        if (gsoUserRecord.role !== 'GSO Admin') {
            let targetGsoRoleName;
            let permissionsForRole;

            // Determine role and permissions based on the incoming portal role
            if (lguUser.role === 'Department Head') {
                targetGsoRoleName = 'Department Head';
                permissionsForRole = [
                    PERMISSIONS.ASSET_READ_OWN_OFFICE,
                    PERMISSIONS.STOCK_READ,
                    PERMISSIONS.REQUISITION_CREATE,
                    PERMISSIONS.REQUISITION_READ_OWN_OFFICE,
                    PERMISSIONS.ASSET_EXPORT,
                ];
            } else { // Default for 'Employee', 'ICTO Staff', 'ICTO Head', etc.
                targetGsoRoleName = 'Employee';
                permissionsForRole = [
                    PERMISSIONS.ASSET_READ_OWN_OFFICE,
                    PERMISSIONS.STOCK_READ,
                    PERMISSIONS.REQUISITION_CREATE,
                    PERMISSIONS.REQUISITION_READ_OWN_OFFICE,
                ];
            }
            // Update the role and permissions to reflect the portal's source of truth.
            gsoUserRecord.role = targetGsoRoleName;
            gsoUserRecord.permissions = permissionsForRole;
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
                PERMISSIONS.ASSET_EXPORT, // Allow department heads to export their own data
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
            externalId: lguUser.id,
            name: lguUser.name,
            office: lguUser.office,
            role: targetGsoRoleName,
            permissions: permissionsForNewUser,
        });
    }

    // Step 3: Generate and send back the GSO-specific token
    // The gsoUserRecord now has the most up-to-date permissions.
    const gsoToken = generateGsoToken(gsoUserRecord);
    // Send back the token AND the user object to prevent an extra API call on the frontend.
    res.status(200).json({
        token: gsoToken,
        user: {
            name: gsoUserRecord.name,
            office: gsoUserRecord.office,
            role: gsoUserRecord.role,
            permissions: gsoUserRecord.permissions
        }
    });
});