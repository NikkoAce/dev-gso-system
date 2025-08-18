// FILE: frontend/public/gso-requisitions.js
import { fetchWithAuth } from './api.js';

document.addEventListener('DOMContentLoaded', async () => {
    try {
        const user = await getCurrentUser();
        if (!user || user.office !== 'GSO') {
            // Redirect non-GSO users or show an error
            window.location.href = 'dashboard.html';
            return;
        }

        initializeLayout(user);
        initializeGsoRequisitionsPage(user);
    } catch (error) {
        console.error("Authentication failed on GSO requisitions page:", error);
    }
});

function initializeGsoRequisitionsPage(currentUser) {
    const API_ENDPOINT = 'requisitions';
    let allRequisitions = [];

    // DOM Cache
    const requisitionsList = document.getElementById('requisitions-list');
    const modal = document.getElementById('requisition-modal');
    const modalTitle = document.getElementById('modal-title');
    const modalContent = document.getElementById('modal-content');
    const closeModalBtn = document.getElementById('close-modal-btn');

    const statusMap = {
        'Pending': 'bg-yellow-100 text-yellow-800',
        'Approved': 'bg-blue-100 text-blue-800',
        'Issued': 'bg-green-100 text-green-800',
        'Rejected': 'bg-red-100 text-red-800',
        'Cancelled': 'bg-gray-100 text-gray-800'
    };

    const formatDate = (dateString) => dateString ? new Date(dateString).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) : 'N/A';

    // --- DATA FETCHING & RENDERING ---
    async function fetchAndRenderRequisitions() {
        try {
            requisitionsList.innerHTML = `<tr><td colspan="6" class="p-4 text-center text-gray-500">Loading requisitions...</td></tr>`;
            // No auth headers needed, fetchWithAuth handles it.
            allRequisitions = await fetchWithAuth(API_ENDPOINT);
            renderRequisitionsTable();
        } catch (error) {
            console.error(error);
            requisitionsList.innerHTML = `<tr><td colspan="6" class="p-4 text-center text-red-500">Error loading requisitions.</td></tr>`;
        }
    }

    function renderRequisitionsTable() {
        requisitionsList.innerHTML = '';
        if (allRequisitions.length === 0) {
            requisitionsList.innerHTML = `<tr><td colspan="6" class="p-4 text-center text-gray-500">No requisitions found.</td></tr>`;
            return;
        }
        allRequisitions.forEach(req => {
            const tr = document.createElement('tr');
            tr.innerHTML = `
                <td class="p-4 font-mono">${req.risNumber}</td>
                <td class="p-4">${req.requestingOffice}</td>
                <td class="p-4">${formatDate(req.dateRequested)}</td>
                <td class="p-4 truncate max-w-xs">${req.purpose}</td>
                <td class="p-4 text-center">
                    <span class="px-3 py-1 text-xs font-semibold rounded-full ${statusMap[req.status] || 'bg-gray-100'}">${req.status}</span>
                </td>
                <td class="p-4 text-center">
                    <button class="view-req-btn text-blue-600 hover:text-blue-800" data-id="${req._id}" title="View Details">
                        <i data-lucide="eye" class="h-5 w-5"></i>
                    </button>
                </td>
            `;
            requisitionsList.appendChild(tr);
        });
        lucide.createIcons();
    }

    // --- MODAL LOGIC ---
    function closeModal() {
        modal.classList.add('hidden');
    }

    async function openModal(requisitionId) {
        try {
            const requisition = await fetchWithAuth(`${API_ENDPOINT}/${requisitionId}`);
            renderModalContent(requisition);
            modal.classList.remove('hidden');
        } catch (error) {
            alert(`Error: ${error.message}`);
        }
    }

    function renderModalContent(req) {
        modalTitle.textContent = `Requisition Details: ${req.risNumber}`;
        const isActionable = !['Issued', 'Rejected', 'Cancelled'].includes(req.status);

        const itemsHTML = req.items.map(item => `
                <tr class="border-b">
                    <td class="p-2">${item.stockItem?.stockNumber || 'N/A'}</td>
                    <td class="p-2">${item.description}</td>
                    <td class="p-2 text-center">${item.quantityRequested}</td>
                    <td class="p-2 text-center">
                        <input type="number" class="issued-qty-input w-20 text-center border-gray-300 rounded-md shadow-sm"
                               data-stock-id="${item.stockItem._id}"
                               data-description="${item.description}"
                               value="${isActionable ? item.quantityRequested : item.quantityIssued}" 
                               min="0" max="${item.quantityRequested}" ${!isActionable ? 'readonly' : ''}>
                    </td>
                    <td class="p-2 text-center">${item.quantityIssued}</td>
                </tr>
            `).join('');

        let footerHTML = '';
        if (isActionable) {
            footerHTML = `
                <div class="pt-4 border-t">
                    <label for="remarks-input" class="block text-sm font-medium text-gray-700">Remarks</label>
                    <textarea id="remarks-input" rows="2" class="mt-1 block w-full border-gray-300 rounded-md shadow-sm" placeholder="Add remarks for rejection or partial issuance...">${req.remarks || ''}</textarea>
                </div>
                <div class="flex justify-end space-x-3 pt-4">
                    <button id="reject-btn" data-id="${req._id}" class="bg-red-600 text-white px-4 py-2 rounded-lg hover:bg-red-700">Reject</button>
                    <button id="issue-btn" data-id="${req._id}" class="bg-green-600 text-white px-4 py-2 rounded-lg hover:bg-green-700">Issue Items & Approve</button>
                </div>
            `;
        } else {
            let printButtonHTML = '';
            if (req.status === 'Issued') {
                printButtonHTML = `<a href="ris-page.html?id=${req._id}" target="_blank" class="print-ris-btn bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 flex items-center gap-2">
                    <i data-lucide="printer" class="h-5 w-5"></i> Print RIS
                </a>`;
            }
            footerHTML = `
                <div class="flex justify-between items-center pt-4 border-t">
                    <p class="font-semibold text-gray-600">This requisition is already ${req.status} and cannot be modified.</p>
                    ${printButtonHTML}
                </div>
                ${req.remarks ? `<div class="mt-2 p-2 bg-gray-50 rounded-md text-sm"><strong>Remarks:</strong> ${req.remarks}</div>` : ''}
            `;
        }

        modalContent.innerHTML = `
            <div class="space-y-4">
                <div class="grid grid-cols-1 md:grid-cols-3 gap-4 text-sm">
                    <div><strong>Requesting Office:</strong> ${req.requestingOffice}</div>
                    <div><strong>Requested By:</strong> ${req.requestingUser.name}</div>
                    <div><strong>Date Requested:</strong> ${formatDate(req.dateRequested)}</div>
                </div>
                <p class="text-sm"><strong>Purpose:</strong> ${req.purpose}</p>
                
                <h4 class="font-semibold pt-2 border-t">Items Requested</h4>
                <table class="w-full text-sm">
                    <thead class="bg-gray-50">
                        <tr>
                            <th class="p-2 text-left">Stock No.</th>
                            <th class="p-2 text-left">Description</th>
                            <th class="p-2 text-center">Qty Requested</th>
                            <th class="p-2 text-center">Qty to Issue</th>
                            <th class="p-2 text-center">Previously Issued</th>
                        </tr>
                    </thead>
                    <tbody>${itemsHTML}</tbody>
                </table>
                
                ${footerHTML}
            </div>
        `;
        lucide.createIcons();
    }

    async function handleModalAction(e) {
        const target = e.target;
        const actionBtn = target.closest('#issue-btn') || target.closest('#reject-btn');
        if (!actionBtn) return;

        const requisitionId = actionBtn.dataset.id;
        const remarks = document.getElementById('remarks-input')?.value || '';
        const newStatus = actionBtn.id === 'issue-btn' ? 'Issued' : 'Rejected';

        const itemsToUpdate = [];
        if (newStatus === 'Issued') {
            document.querySelectorAll('.issued-qty-input').forEach(input => {
                itemsToUpdate.push({
                    stockItem: input.dataset.stockId,
                    description: input.dataset.description,
                    quantityIssued: parseInt(input.value, 10) || 0
                });
            });
        }

        const payload = { status: newStatus, remarks, items: itemsToUpdate };

        actionBtn.disabled = true;
        actionBtn.textContent = 'Processing...';

        try {
            await fetchWithAuth(`${API_ENDPOINT}/${requisitionId}`, {
                method: 'PUT',
                body: JSON.stringify(payload)
            });

            closeModal();
            await fetchAndRenderRequisitions();
        } catch (error) {
            alert(`Error: ${error.message}`);
            actionBtn.disabled = false;
            actionBtn.textContent = newStatus === 'Issued' ? 'Issue Items & Approve' : 'Reject';
        }
    }

    // --- EVENT BINDING ---
    requisitionsList.addEventListener('click', (e) => {
        const viewBtn = e.target.closest('.view-req-btn');
        if (viewBtn) openModal(viewBtn.dataset.id);
    });
    closeModalBtn.addEventListener('click', closeModal);
    modal.addEventListener('click', (e) => e.target === modal && closeModal());
    modalContent.addEventListener('click', handleModalAction);

    // --- INITIALIZATION ---
    fetchAndRenderRequisitions();
}