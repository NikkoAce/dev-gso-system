// This script handles the entire authentication flow for the GSO System.
// It should be included in every HTML page of this application.

const GSO_API_BASE_URL = 'https://dev-gso-system.onrender.com'; // IMPORTANT: Replace with your GSO backend's deployed URL
const PORTAL_LOGIN_URL = 'https://lgu-employee-portal.netlify.app/index.html'; // IMPORTANT: Replace with your Portal's login page URL

/**
 * Exchanges the portal token for a GSO-specific token.
 * @param {string} portalToken - The token received from the LGU Employee Portal.
 * @returns {Promise<string>} The new GSO-specific token.
 */
async function exchangeToken(portalToken) {
    try {
        const response = await fetch(`${GSO_API_BASE_URL}/api/auth/sso-login`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ token: portalToken })
        });

        const result = await response.json();
        if (!response.ok) {
            throw new Error(result.message || 'Token exchange failed.');
        }
        return result.token;
    } catch (error) {
        console.error('SSO Token Exchange Error:', error);
        // If exchange fails, clear any potentially bad tokens and redirect to portal
        localStorage.removeItem('gsoAuthToken');
        window.location.href = PORTAL_LOGIN_URL;
    }
}

/**
 * The main function to secure the page and handle SSO.
 */
async function handleSsoLogin() {
    const urlParams = new URLSearchParams(window.location.search);
    const portalToken = urlParams.get('token');

    if (portalToken) {
        // A new login attempt from the portal. Exchange the token.
        const gsoToken = await exchangeToken(portalToken);
        localStorage.setItem('gsoAuthToken', gsoToken);

        // Clean the token from the URL for security and to prevent reuse.
        window.history.replaceState({}, document.title, window.location.pathname);
    }

    // Now, check for the GSO token in local storage.
    const gsoToken = localStorage.getItem('gsoAuthToken');
    if (!gsoToken) {
        // If no token exists after checking URL and storage, the user is not authenticated.
        // Redirect them back to the central login page.
        window.location.href = PORTAL_LOGIN_URL;
    }
    // If we reach here, the user has a valid GSO token and can view the page.
}

// --- Exportable Helper Functions for other scripts ---

/**
 * Safely decodes a JWT payload. Handles Base64Url encoding.
 * @param {string} token The JWT string.
 * @returns {object|null} The decoded payload object or null if decoding fails.
 */
function parseJwt(token) {
    try {
        const base64Url = token.split('.')[1];
        if (!base64Url) return null;
        const base64 = base64Url.replace(/-/g, '+').replace(/_/g, '/');
        const jsonPayload = decodeURIComponent(atob(base64).split('').map(function(c) {
            return '%' + ('00' + c.charCodeAt(0).toString(16)).slice(-2);
        }).join(''));
        return JSON.parse(jsonPayload);
    } catch (e) {
        console.error("Error decoding JWT:", e);
        return null;
    }
}

/**
 * Gets the current user by decoding the GSO JWT.
 * @returns {Promise<object>} A promise that resolves with the user object.
 */
export async function getCurrentUser() {
    const token = getGsoToken();
    if (!token) {
        handleSsoLogin(); // Re-run the auth check which will redirect if needed
        throw new Error('No GSO token found.');
    }
    const payload = parseJwt(token);
    if (!payload || !payload.user) {
        localStorage.removeItem('gsoAuthToken');
        window.location.href = PORTAL_LOGIN_URL;
        throw new Error('Invalid GSO token payload.');
    }
    return payload.user;
}

/**
 * Gets the stored GSO authentication token.
 * @returns {string|null} The token or null if not found.
 */
export function getGsoToken() {
    return localStorage.getItem('gsoAuthToken');
}

/**
 * Logs the user out by removing the GSO token and redirecting to the portal.
 */
export function gsoLogout() {
    localStorage.removeItem('gsoAuthToken');
    window.location.href = PORTAL_LOGIN_URL;
}

// Run the authentication check as soon as the script loads.
handleSsoLogin();
