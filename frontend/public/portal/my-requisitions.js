// FILE: frontend/public/my-requisitions.js
import { fetchWithAuth } from '../js/api.js';
import { createAuthenticatedPage } from '../js/page-loader.js';

createAuthenticatedPage({
    permission: null, // Any authenticated user can view their own requisitions
    pageInitializer: initializeMyRequisitionsPage,
    pageName: 'My Requisitions'
});

function initializeMyRequisitionsPage(user) {
    const API_ENDPOINT = 'requisitions/my-office';
    const requisitionsList = document.getElementById('my-requisitions-list');

    const statusMap = {
        'Pending': 'badge-warning',
        'For Availability Check': 'badge-primary',
        // 'Approved' is a valid status but is skipped in the GSO workflow for now.
        'Issued': 'badge-success',
        'Rejected': 'badge-error',
        'Cancelled': 'badge-ghost'
    };

    const formatDate = (dateString) => dateString ? new Date(dateString).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) : 'N/A';

    async function fetchAndRenderMyRequisitions() {
        try {
            requisitionsList.innerHTML = `<tr><td colspan="5" class="p-4 text-center text-base-content/70">Loading your requisitions...</td></tr>`;
            const myRequisitions = await fetchWithAuth(API_ENDPOINT);
            renderTable(myRequisitions);
        } catch (error) {
            console.error(error);
            requisitionsList.innerHTML = `<tr><td colspan="5" class="p-4 text-center text-error">Error loading your requisitions.</td></tr>`;
        }
    }

    function renderTable(requisitions) {
        requisitionsList.innerHTML = '';
        if (requisitions.length === 0) {
            requisitionsList.innerHTML = `<tr><td colspan="5" class="p-4 text-center text-base-content/70">You have not made any requisitions yet.</td></tr>`;
            return;
        }

        requisitions.forEach(req => {
            const tr = document.createElement('tr');
            tr.innerHTML = `
                <td data-label="RIS No." class="font-mono">${req.risNumber}</td>
                <td data-label="Date">${formatDate(req.dateRequested)}</td>
                <td data-label="Purpose" class="truncate max-w-xs">${req.purpose}</td>
                <td data-label="Status" class="text-center">
                    <span class="badge ${statusMap[req.status] || 'badge-ghost'} badge-sm">${req.status}</span>
                </td>
                <td data-label="Actions" class="text-center">
                    <a href="../slips/sai-page.html?id=${req._id}" target="_blank" class="btn btn-ghost btn-xs" title="Print SAI">
                        <i data-lucide="printer" class="h-4 w-4"></i>
                    </a>
                </td>
            `;
            requisitionsList.appendChild(tr);
        });
        lucide.createIcons();
    }

    fetchAndRenderMyRequisitions();
}