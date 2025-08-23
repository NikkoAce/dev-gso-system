// FILE: frontend/public/js/api.js

// Centralized base URL for the API
export const BASE_URL = 'https://dev-gso-system.onrender.com/api';

/**
 * A generic fetch wrapper that includes authentication and improved error handling.
 * @param {string} endpoint The API endpoint to fetch from (e.g., 'assets').
 * @param {object} options Standard fetch options object.
 * @returns {Promise<any>} The JSON response.
 * @throws {Error} Throws an error with a detailed message on failure.
 */
export async function fetchWithAuth(endpoint, options = {}) {
    const token = localStorage.getItem('portalAuthToken');
    if (!token) {
        // This case is handled by security.js, but it's good practice to have it here.
        throw new Error('Authentication token not found. Please log in again.');
    }

    const headers = {
        // Default to JSON content type, but allow it to be overridden
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`,
        ...options.headers,
    };

    // If body is a plain object, stringify it. If it's FormData, let fetch handle it.
    const body = (options.body && typeof options.body === 'object' && !(options.body instanceof FormData))
        ? JSON.stringify(options.body)
        : options.body;
    
    // If body is FormData, remove the Content-Type header to let the browser set it with the boundary.
    if (body instanceof FormData) {
        delete headers['Content-Type'];
    }

    const config = {
        ...options,
        headers,
        body,
    };

    try {
        const response = await fetch(`${BASE_URL}/${endpoint}`, config);

        if (!response.ok) {
            let errorData = { message: `Request failed with status ${response.status} (${response.statusText})` };
            // Try to parse a JSON error response from the server, but don't fail if it's not JSON.
            try {
                const serverError = await response.json();
                errorData.message = serverError.message || errorData.message;
            } catch (e) {
                // The server did not return JSON, the statusText is the best we have.
            }
            throw new Error(errorData.message);
        }

        return response.status === 204 ? null : response.json();
    } catch (error) {
        console.error(`API Error (${endpoint}):`, error);
        // Re-throw the error so the calling function's catch block can handle it for the UI.
        throw error;
    }
}