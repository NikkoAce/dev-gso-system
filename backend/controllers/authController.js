const axios = require('axios');
const jwt = require('jsonwebtoken');
const User = require('../models/User'); // GSO User model
const Role = require('../models/Role'); // GSO Role model

// Helper function to generate the GSO-specific token with permissions
const generateGsoToken = (user) => {
    const payload = {
        user: {
            id: user._id,
            name: user.name,
            office: user.office,
            role: user.role.name, // Include role name for display
            permissions: user.role.permissions // **Crucially, embed the permissions**
        }
    };
    return jwt.sign(payload, process.env.JWT_SECRET, { expiresIn: '1d' });
};

/**
 * Handles the Single Sign-On (SSO) login process.
 * 1. Verifies the token from the LGU Employee Portal.
 * 2. Finds or creates a user in the GSO system (Just-In-Time Provisioning).
 * 3. Issues a new, GSO-specific JWT containing GSO roles and permissions.
 */
exports.ssoLogin = async (req, res) => {
    const { token: portalToken } = req.body;

    if (!portalToken) {
        return res.status(400).json({ message: 'Portal token is required.' });
    }

    try {
        // Step 1: Verify the external token by calling the Portal's /me endpoint
        const portalApiUrl = process.env.PORTAL_API_URL || 'https://lgu-helpdesk-copy.onrender.com/api';
        const response = await axios.get(`${portalApiUrl}/auth/me`, {
            headers: { 'Authorization': `Bearer ${portalToken}` }
        });

        const portalUser = response.data;
        if (!portalUser || !portalUser.employeeId) {
            return res.status(401).json({ message: 'Invalid user data received from portal.' });
        }

        // Step 2: Find or create a "shadow" user in the GSO database
        let gsoUser = await User.findOne({ externalId: portalUser.employeeId }).populate('role');

        if (!gsoUser) {
            // User is logging in for the first time. Provision with a default role.
            let defaultRole = await Role.findOne({ name: 'Department Viewer' });
            if (!defaultRole) {
                // If default role doesn't exist, create it with minimal permissions
                defaultRole = await Role.create({ name: 'Department Viewer', permissions: ['asset:read:own_office'] });
            }

            gsoUser = await User.create({ externalId: portalUser.employeeId, name: portalUser.name, office: portalUser.office, role: defaultRole._id });
            gsoUser = await gsoUser.populate('role'); // Populate the role for the new user
        }

        // Step 3: Generate and return the GSO-specific JWT
        const gsoToken = generateGsoToken(gsoUser);
        res.status(200).json({ message: 'GSO login successful', token: gsoToken });

    } catch (error) {
        console.error('SSO Login Error:', error.response ? error.response.data : error.message);
        res.status(401).json({ message: 'Authentication with portal failed. The token may be invalid or expired.' });
    }
};