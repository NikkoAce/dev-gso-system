// FILE: /_GSO MANAGEMENT SYSTEM dev/frontend/public/js/auth.js

// --- CONFIGURATION ---
const isProduction = window.location.hostname === 'lgudaet-gso-system.netlify.app';

// IMPORTANT: This must be the correct URL of your DEPLOYED PRODUCTION GSO backend.
const PROD_API_URL = 'https://lgu-gso-system.onrender.com';
const DEV_API_URL = 'https://dev-gso-system.onrender.com';

const API_BASE_URL = isProduction ? PROD_API_URL : DEV_API_URL;
const PORTAL_LOGIN_URL = 'https://lgu-employee-portal.netlify.app/index.html';

/**
 * Logs out the user by clearing the token and redirecting to the portal.
 */
export function gsoLogout() {
    localStorage.removeItem('gsoAuthToken');
    window.location.href = PORTAL_LOGIN_URL;
}

/**
 * Gets the current user. Handles the complete SSO flow by prioritizing a fresh login from the portal.
 * 1. Prioritizes portal token from URL for fresh sessions.
 * 2. Exchanges the portal token for a GSO token via the backend.
 * 3. Falls back to the GSO token in localStorage if no portal token is present.
 * 4. Stores the GSO token and cleans the URL.
 * 5. Decodes the token to return the user object.
 * 6. Handles token expiration and errors by logging out.
 * @returns {Promise<object|null>} The user object or null if not authenticated.
 */
export async function getCurrentUser() {
    const urlParams = new URLSearchParams(window.location.search);
    const portalToken = urlParams.get('token');
    let gsoToken;

    // If a portal token exists in the URL, it's a new login attempt from the portal.
    // This should always be prioritized to get a fresh GSO session and overwrite any old local token.
    if (portalToken) {
        try {
            const response = await fetch(`${API_BASE_URL}/api/auth/sso-login`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ token: portalToken })
            });
            const data = await response.json();
            if (!response.ok) {
                // Pass the specific error message from the backend
                throw new Error(data.message || 'SSO Login Failed');
            }
            
            gsoToken = data.token; // This is the new GSO token
            localStorage.setItem('gsoAuthToken', gsoToken);

            // Clean the token from the URL to prevent reuse
            window.history.replaceState({}, document.title, window.location.pathname);
        } catch (error) {
            // The backend error will be caught here.
            // We can alert the user with the specific message.
            alert(`Authentication Error: ${error.message}`);
            console.error('SSO login failed:', error);
            gsoLogout(); // Redirect to portal on failure
            return null;
        }
    } else {
        // If no portal token in URL, try to use the one from localStorage.
        gsoToken = localStorage.getItem('gsoAuthToken');
    }

    // If after all checks, there's still no token, the user is not authenticated.
    if (!gsoToken) {
        console.error("No GSO token available. Redirecting to portal.");
        gsoLogout();
        return null;
    }

    // Now, validate the GSO token we have.
    try {
        const payload = JSON.parse(atob(gsoToken.split('.')[1]));
        // Check for expiration
        if (payload.exp * 1000 < Date.now()) {
            console.log("GSO token expired. Logging out.");
            gsoLogout();
            return null;
        }
        return payload.user;
    } catch (e) {
        console.error('Failed to decode GSO token:', e);
        gsoLogout();
        return null;
    }
}

/**
 * Gets the stored GSO authentication token.
 * @returns {string|null} The token or null if not found.
 */
export function getGsoToken() {
    return localStorage.getItem('gsoAuthToken');
}