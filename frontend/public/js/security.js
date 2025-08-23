// FILE: frontend/public/js/security.js
const LOGIN_URL = 'https://lgu-employee-portal.netlify.app/index.html'; // IMPORTANT: Update with your actual deployed login portal URL

let currentUser = null; // This will hold the user's data after it's fetched.

/**
 * Handles authentication errors by clearing the token and redirecting to the login page.
 * @param {string} message - The error message to log to the console.
 */
function handleAuthError(message) {
    console.error(message);
    localStorage.removeItem('portalAuthToken');
    alert('Your session has expired or is invalid. Please log in again.'); // A more user-friendly modal/toast is recommended over alert().
    window.location.href = LOGIN_URL;
}

/**
 * Retrieves the JWT from the URL parameters or localStorage.
 * @returns {string|null} The authentication token or null if not found.
 */
function getToken() {
    const urlParams = new URLSearchParams(window.location.search);
    let token = urlParams.get('token');

    if (token) {
        // If token is in the URL, save it and clean the URL.
        localStorage.setItem('portalAuthToken', token);
        const newUrl = window.location.pathname + window.location.hash; // Preserve hash for SPA routing
        window.history.replaceState({}, document.title, newUrl);
    } else {
        // Otherwise, try to get it from localStorage.
        token = localStorage.getItem('portalAuthToken');
    }
    return token;
}

/**
 * Gets the current user by decoding a JWT. It memoizes the result.
 * It also checks for token expiration.
 * @returns {Promise<object>} A promise that resolves with the user object.
 * @throws {Error} If the token is missing, invalid, or expired.
 */
async function getCurrentUser() {
    // If user is already fetched, return it immediately to avoid re-checking.
    if (currentUser) {
        return currentUser;
    }

    const token = getToken();

    if (!token) {
        handleAuthError('Authentication error: No token found.');
        // Throw an error to stop further execution in the calling function's try/catch block.
        throw new Error('No token found');
    }

    try {
        const payload = JSON.parse(atob(token.split('.')[1]));

        // --- SECURITY IMPROVEMENT: Check token expiration ---
        // The 'exp' claim is a UNIX timestamp (in seconds).
        if (payload.exp && (payload.exp * 1000) < Date.now()) {
            handleAuthError('Authentication error: Token has expired.');
            throw new Error('Token has expired');
        }

        currentUser = payload.user; // Cache the user object
        return currentUser;
    } catch (e) {
        handleAuthError(`Authentication error: Invalid token. ${e.message}`);
        throw new Error('Invalid token');
    }
}