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

    const statusMap = {
        'Pending': 'badge-warning',
        'Issued': 'badge-success',
        'Rejected': 'badge-error',
        'Cancelled': 'badge-ghost'
    };

    const formatDate = (dateString) => dateString ? new Date(dateString).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) : 'N/A';

    // --- DATA FETCHING & RENDERING ---
    async function fetchAndRenderRequisitions() {
        try {
            requisitionsList.innerHTML = `<tr><td colspan="6" class="p-4 text-center text-base-content/70">Loading requisitions...</td></tr>`;
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
            requisitionsList.innerHTML = `<tr><td colspan="6" class="p-4 text-center text-base-content/70">No requisitions found.</td></tr>`;
            return;
        }
        allRequisitions.forEach(req => {
            const tr = document.createElement('tr');
            tr.innerHTML = `
                <td class="font-mono">${req.risNumber}</td>
                <td>${req.requestingOffice}</td>
                <td>${formatDate(req.dateRequested)}</td>
                <td class="truncate max-w-xs">${req.purpose}</td>
                <td class="text-center">
                    <span class="badge ${statusMap[req.status] || 'badge-ghost'} badge-sm">${req.status}</span>
                </td>
                <td class="text-center">
                    <button class="view-req-btn btn btn-ghost btn-xs" data-id="${req._id}" title="View Details">
                        <i data-lucide="eye" class="h-4 w-4"></i>
                    </button>
                </td>
            `;
            requisitionsList.appendChild(tr);
        });
        lucide.createIcons();
    }

    // --- MODAL LOGIC ---
    function closeModal() {
        modal.close();
    }

    async function openModal(requisitionId) {
        try {
            const requisition = await fetchWithAuth(`${API_ENDPOINT}/${requisitionId}`);
            renderModalContent(requisition);
            modal.showModal();
        } catch (error) {
            alert(`Error: ${error.message}`);
        }
    }

    function renderModalContent(req) {
        modalTitle.textContent = `Requisition Details: ${req.risNumber}`;
        const isActionable = !['Issued', 'Rejected', 'Cancelled'].includes(req.status);

        const itemsHTML = req.items.map(item => `
                <tr class="border-b">
                    <td>${item.stockItem?.stockNumber || 'N/A'}</td>
                    <td>${item.description}</td>
                    <td class="text-center">${item.quantityRequested}</td>
                    <td class="text-center">
                        <input type="number" class="issued-qty-input input input-bordered input-sm w-24 text-center"
                               data-stock-id="${item.stockItem._id}"
                               data-description="${item.description}"
                               value="${isActionable ? item.quantityRequested : item.quantityIssued}"
                               min="0" max="${item.quantityRequested}" ${!isActionable ? 'readonly class="bg-base-200"' : ''}>
                    </td>
                    <td class="text-center">${item.quantityIssued}</td>
                </tr>
            `).join('');

        let footerHTML = '';
        if (isActionable) {
            footerHTML = `
                <div class="form-control pt-4 border-t">
                    <label for="remarks-input" class="label"><span class="label-text">Remarks</span></label>
                    <textarea id="remarks-input" rows="2" class="textarea textarea-bordered" placeholder="Add remarks for
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
                
                <div class="divider">Items Requested</div>
                <div class="overflow-x-auto">
                    <table class="table table-zebra w-full text-sm">
                        <thead>
                            <tr>
                                <th>Stock No.</th>
                
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