// FILE: /_GSO MANAGEMENT SYSTEM dev/frontend/public/js/auth.js

// --- CONFIGURATION ---
// Use environment variables in a real-world scenario
const API_BASE_URL = 'https://dev-gso-system.onrender.com';
const PORTAL_LOGIN_URL = 'https://lgu-employee-portal.netlify.app/index.html';

/**
 * Logs out the user by clearing the token and redirecting to the portal.
 */
export function gsoLogout() {
    localStorage.removeItem('gsoAuthToken');
    window.location.href = PORTAL_LOGIN_URL;
}

/**
 * Gets the current user. Handles the complete SSO flow.
 * 1. Checks for an existing GSO token in localStorage.
 * 2. If not found, checks for a portal token in the URL.
 * 3. Exchanges the portal token for a GSO token via the backend.
 * 4. Stores the GSO token and cleans the URL.
 * 5. Decodes the token to return the user object.
 * 6. Handles token expiration and errors by logging out.
 * @returns {Promise<object|null>} The user object or null if not authenticated.
 */
export async function getCurrentUser() {
    let token = localStorage.getItem('gsoAuthToken');

    // If no GSO token, check for a portal token in the URL to initiate SSO
    if (!token) {
        const urlParams = new URLSearchParams(window.location.search);
        const portalToken = urlParams.get('token');

        if (portalToken) {
            try {
                const response = await fetch(`${API_BASE_URL}/api/auth/sso-login`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ token: portalToken })
                });
                const data = await response.json();
                if (!response.ok) throw new Error(data.message || 'SSO Login Failed');
                
                token = data.token; // This is the new GSO token
                localStorage.setItem('gsoAuthToken', token);

                // Clean the token from the URL to prevent reuse
                window.history.replaceState({}, document.title, window.location.pathname);
            } catch (error) {
                console.error('SSO login failed:', error);
                gsoLogout(); // Redirect to portal on failure
                return null;
            }
        }
    }

    if (!token) {
        // If after all checks, there's still no token, redirect to login.
        gsoLogout();
        return null;
    }

    try {
        const payload = JSON.parse(atob(token.split('.')[1]));
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
