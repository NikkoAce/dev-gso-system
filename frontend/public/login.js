import { BASE_URL } from './api.js';

document.addEventListener('DOMContentLoaded', () => {
    const loginForm = document.getElementById('login-form');
    const errorMessageDiv = document.getElementById('error-message');

    // If a user is already logged in, redirect them to the dashboard.
    // This prevents showing the login page to an authenticated user.
    if (localStorage.getItem('portalAuthToken')) {
        window.location.href = 'dashboard.html';
        return;
    }

    loginForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        errorMessageDiv.classList.add('hidden');
        errorMessageDiv.textContent = '';

        const email = document.getElementById('email-address').value;
        const password = document.getElementById('password').value;

        try {
            // NOTE: This assumes a backend endpoint at /api/users/login exists.
            // You will need to create this on your backend.
            const response = await fetch(`${BASE_URL}/api/users/login`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({ email, password }),
            });

            const data = await response.json();

            if (!response.ok) {
                throw new Error(data.message || 'Login failed');
            }

            if (data.token) {
                // The token is passed in the URL to be picked up by security.js on the next page.
                // This is consistent with the existing authentication flow.
                window.location.href = `dashboard.html?token=${data.token}`;
            } else {
                throw new Error('No token received from server.');
            }

        } catch (error) {
            errorMessageDiv.textContent = error.message;
            errorMessageDiv.classList.remove('hidden');
        }
    });
});