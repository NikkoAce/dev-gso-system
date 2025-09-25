import { API_ROOT_URL } from './api.js';

document.addEventListener('DOMContentLoaded', () => {
    const urlInput = document.getElementById('url-input');
    const getTokenBtn = document.getElementById('get-token-btn');
    const messageContainer = document.getElementById('message-container');

    // Check if we are in development mode. If not, redirect away.
    const isProduction = window.location.hostname === 'lgudaet-gso-system.netlify.app';
    if (isProduction) {
        window.location.href = 'dashboard/dashboard.html';
        return;
    }

    getTokenBtn.addEventListener('click', async () => {
        const fullUrl = urlInput.value.trim();
        if (!fullUrl) {
            messageContainer.innerHTML = `<div class="alert alert-warning">Please paste the URL.</div>`;
            return;
        }

        try {
            const url = new URL(fullUrl);
            const portalToken = url.searchParams.get('sso_token'); // Align with auth.js

            if (!portalToken) {
                messageContainer.innerHTML = `<div class="alert alert-error">No 'sso_token' found in the provided URL.</div>`;
                return;
            }

            messageContainer.innerHTML = `<div class="alert alert-info">Found SSO token. Attempting to log in...</div>`;
            getTokenBtn.classList.add('loading');
            getTokenBtn.disabled = true;

            const response = await fetch(`${API_ROOT_URL}/api/auth/sso-login`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ ssoToken: portalToken }) // Align with auth.js
            });

            const data = await response.json();
            if (!response.ok) {
                throw new Error(data.message || 'SSO Login Failed');
            }

            const gsoToken = data.token;
            localStorage.setItem('gsoAuthToken', gsoToken);

            messageContainer.innerHTML = `<div class="alert alert-success">Login successful! Redirecting to dashboard...</div>`;
            
            setTimeout(() => {
                window.location.href = 'dashboard/dashboard.html';
            }, 1000);

        } catch (error) {
            messageContainer.innerHTML = `<div class="alert alert-error">Error: ${error.message}</div>`;
            getTokenBtn.classList.remove('loading');
            getTokenBtn.disabled = false;
        }
    });
});
