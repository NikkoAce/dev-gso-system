// FILE: frontend/public/my-requisitions.js
import { fetchWithAuth } from './api.js';

document.addEventListener('DOMContentLoaded', async () => {
    try {
        const user = await getCurrentUser();
        if (!user) return;

        initializeLayout(user);
        initializeMyRequisitionsPage(user);
    } catch (error) {
        console.error("Authentication failed on my-requisitions page:", error);
    }
});

function initializeMyRequisitionsPage(currentUser) {
    const API_ENDPOINT = 'requisitions/my-office';
    const requisitionsList = document.getElementById('my-requisitions-list');

    const statusMap = {
        'Pending': 'bg-yellow-100 text-yellow-800',
        'Approved': 'bg-blue-100 text-blue-800',
        'Issued': 'bg-green-100 text-green-800',
        'Rejected': 'bg-red-100 text-red-800',
        'Cancelled': 'bg-gray-100 text-gray-800'
    };

    const formatDate = (dateString) => dateString ? new Date(dateString).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) : 'N/A';

    async function fetchAndRenderMyRequisitions() {
        try {
            requisitionsList.innerHTML = `<tr><td colspan="4" class="p-4 text-center text-gray-500">Loading your requisitions...</td></tr>`;
            const myRequisitions = await fetchWithAuth(API_ENDPOINT);
            renderTable(myRequisitions);
        } catch (error) {
            console.error(error);
            requisitionsList.innerHTML = `<tr><td colspan="4" class="p-4 text-center text-red-500">Error loading your requisitions.</td></tr>`;
        }
    }

    function renderTable(requisitions) {
        requisitionsList.innerHTML = '';
        if (requisitions.length === 0) {
            requisitionsList.innerHTML = `<tr><td colspan="4" class="p-4 text-center text-gray-500">You have not made any requisitions yet.</td></tr>`;
            return;
        }

        requisitions.forEach(req => {
            const tr = document.createElement('tr');
            tr.innerHTML = `
                <td class="p-4 font-mono">${req.risNumber}</td>
                <td class="p-4">${formatDate(req.dateRequested)}</td>
                <td class="p-4 truncate max-w-xs">${req.purpose}</td>
                <td class="p-4 text-center">
                    <span class="px-3 py-1 text-xs font-semibold rounded-full ${statusMap[req.status] || 'bg-gray-100'}">${req.status}</span>
                </td>
            `;
            requisitionsList.appendChild(tr);
        });
    }

    fetchAndRenderMyRequisitions();
}