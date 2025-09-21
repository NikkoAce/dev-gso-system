// FILE: frontend/public/gso-requisitions.js
import { fetchWithAuth } from '../js/api.js';
import { createAuthenticatedPage } from '../js/page-loader.js';
import { createUIManager } from '../js/ui.js';

createAuthenticatedPage({
    permission: 'requisition:read:all',
    pageInitializer: initializeGsoRequisitionsPage,
    pageName: 'Manage Supply Requisitions'
});

function initializeGsoRequisitionsPage(user) {
    const API_ENDPOINT = 'requisitions';

    // State
    let statusFilter = 'For Availability Check'; // Default to the new first step
    let currentPage = 1;
    let totalPages = 1;
    const itemsPerPage = 15;
    let sortKey = 'dateRequested';
    let sortDirection = 'desc';
    let searchTimeout;

    // UI Manager
    const { renderPagination, setLoading, showToast } = createUIManager();

    // DOM Cache
    const requisitionsList = document.getElementById('requisitions-list');
    const modal = document.getElementById('requisition-modal');
    const modalTitle = document.getElementById('modal-title');
    const modalContent = document.getElementById('modal-content');
    const statusTabs = document.getElementById('status-tabs');
    const searchInput = document.getElementById('search-input');
    const tableHeader = requisitionsList.parentElement.querySelector('thead');
    const paginationControls = document.getElementById('pagination-controls');

    const statusMap = {
        'Pending': 'badge-warning',
        'For Availability Check': 'badge-primary',
        'Issued': 'badge-info',
        'Received': 'badge-success',
        'Rejected': 'badge-error',
        'Cancelled': 'badge-ghost'
    };

    const formatDate = (dateString) => dateString ? new Date(dateString).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) : 'N/A';

    // --- DATA FETCHING & RENDERING ---
    async function loadRequisitions() {
        const colSpan = tableHeader.querySelector('tr').children.length;
        setLoading(true, requisitionsList, { colSpan });

        const params = new URLSearchParams({
            page: currentPage,
            limit: itemsPerPage,
            sort: sortKey,
            order: sortDirection,
            search: searchInput.value,
            status: statusFilter,
        });

        try {
            const data = await fetchWithAuth(`${API_ENDPOINT}?${params.toString()}`);
            totalPages = data.totalPages;
            renderRequisitionsTable(data.docs);
            renderPagination(paginationControls, data);
            updateSortIndicators();
        } catch (error) {
            console.error(error);
            requisitionsList.innerHTML = `<tr><td colspan="${colSpan}" class="p-4 text-center text-red-500">Error loading requisitions.</td></tr>`;
        } finally {
            setLoading(false, requisitionsList);
        }
    }

    function renderRequisitionsTable(requisitions) {
        requisitionsList.innerHTML = '';
        const colSpan = tableHeader.querySelector('tr').children.length;
        if (requisitions.length === 0) {
            requisitionsList.innerHTML = `<tr><td colspan="${colSpan}" class="p-4 text-center text-base-content/70">No requisitions found.</td></tr>`;
            return;
        }

        requisitions.forEach(req => {
            const tr = document.createElement('tr');
            tr.innerHTML = `
                <td data-label="RIS No." class="font-mono">${req.risNumber}</td>
                <td data-label="Office">${req.requestingOffice}</td>
                <td data-label="Date">${formatDate(req.dateRequested)}</td>
                <td data-label="Purpose" class="truncate max-w-xs">${req.purpose}</td>
                <td data-label="Status" class="text-center">
                    <span class="badge ${statusMap[req.status] || 'badge-ghost'} badge-sm">${req.status}</span>
                </td>
                <td data-label="Actions" class="text-center">
                    <button class="view-req-btn btn btn-ghost btn-xs" data-id="${req._id}" title="View Details">
                        <i data-lucide="eye" class="h-4 w-4"></i>
                    </button>
                </td>
            `;
            requisitionsList.appendChild(tr);
        });
        lucide.createIcons();
    }

    function updateSortIndicators() {
        tableHeader.querySelectorAll('th[data-sort-key]').forEach(th => {
            th.querySelector('i[data-lucide]')?.remove();
            if (th.dataset.sortKey === sortKey) {
                th.insertAdjacentHTML('beforeend', `<i data-lucide="${sortDirection === 'asc' ? 'arrow-up' : 'arrow-down'}" class="inline-block ml-1 h-4 w-4"></i>`);
            }
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
            showToast(`Error: ${error.message}`, 'error');
        }
    }

    function renderModalContent(req) {
        modalTitle.textContent = `Requisition Details: ${req.risNumber}`;
        const isForChecking = req.status === 'For Availability Check';
        const isActionable = req.status === 'Pending';

        const itemsHTML = req.items.map(item => `
                <tr class="border-b">
                    <td>${item.stockItem?.stockNumber || 'N/A'}</td>
                    <td>${item.description}</td>
                    <td class="text-center">${item.quantityRequested}</td>
                    <td class="text-center">
                        <input type="number" class="issued-qty-input input input-bordered input-sm w-24 text-center" data-stock-id="${item.stockItem._id}" data-description="${item.description}" value="${isActionable ? item.quantityRequested : (item.quantityIssued || 0)}" min="0" max="${item.quantityRequested}" ${!isActionable ? 'readonly class="bg-base-200"' : ''}>
                    </td>
                    <td class="text-center">${item.quantityIssued || 0}</td>
                </tr>
            `).join('');

        let footerHTML = '';
        if (isActionable) {
            footerHTML = `
                <div class="form-control pt-4 border-t">
                    <label for="remarks-input" class="label"><span class="label-text">Remarks</span></label>
                    <textarea id="remarks-input" rows="2" class="textarea textarea-bordered" placeholder="Add remarks for approval or rejection..."></textarea>
                </div>
                <div class="modal-action mt-4">
                    <button id="close-modal-btn" class="btn">Cancel</button>
                    <button id="reject-btn" class="btn btn-error" data-id="${req._id}">Reject</button>
                    <button id="issue-btn" class="btn btn-success" data-id="${req._id}">Issue Items & Approve</button>
                </div>
            `;
        } else if (isForChecking) {
            footerHTML = `
                <div class="form-control pt-4 border-t">
                    <label for="remarks-input" class="label"><span class="label-text">Remarks</span></label>
                    <textarea id="remarks-input" rows="2" class="textarea textarea-bordered" placeholder="Add remarks for availability confirmation..."></textarea>
                </div>
                <div class="modal-action mt-4 justify-between">
                    <div>
                        <a href="../slips/sai-page.html?id=${req._id}" target="_blank" class="btn btn-info btn-sm">
                            <i data-lucide="printer" class="h-4 w-4"></i> Print SAI
                        </a>
                    </div>
                    <div class="flex gap-2">
                        <button id="close-modal-btn" class="btn">Cancel</button>
                        <button id="reject-btn" class="btn btn-error" data-id="${req._id}">Mark Unavailable</button>
                        <button id="confirm-availability-btn" class="btn btn-accent" data-id="${req._id}">Confirm Availability</button>
                    </div>
                </div>
            `;
        } else {
            let printButtonHTML = '';
            if (req.status === 'Issued' || req.status === 'Received') {
                printButtonHTML = `<a href="../slips/ris-page.html?id=${req._id}" target="_blank" class="btn btn-info">
                    <i data-lucide="printer" class="h-4 w-4"></i> Print RIS (Appendix 48)
                </a>`;
            }

            let receivedByInfo = '';
            if (req.status === 'Received') {
                receivedByInfo = `<p class="text-sm text-success font-semibold">Received by ${req.receivedByUser?.name || 'N/A'} on ${formatDate(req.dateReceivedByEndUser)}.</p>`;
            }

            footerHTML = `
                <div class="flex justify-between items-center pt-4 border-t">
                    <div class="flex flex-col gap-1">
                        <p class="font-semibold text-base-content/70">This requisition is ${req.status} and cannot be modified.</p>
                        ${receivedByInfo}
                    </div>
                    ${printButtonHTML}
                </div>
                ${req.remarks ? `<div class="mt-2 p-2 bg-base-200 rounded-box text-sm"><strong>Remarks:</strong> ${req.remarks}</div>` : ''}
                <div class="modal-action mt-4">
                    <button id="close-modal-btn" class="btn">Close</button>
                </div>
            `;
        }

        modalContent.innerHTML = `
            <div class="space-y-4">
                <div class="grid grid-cols-1 md:grid-cols-3 gap-4 text-sm">
                    <div><strong>Office:</strong> ${req.requestingOffice || 'N/A'}</div>
                    <div><strong>Requested By:</strong> ${req.requestingUser?.name || 'N/A'}</div>
                    <div><strong>Date Requested:</strong> ${formatDate(req.dateRequested)}</div>
                </div>
                <p class="text-sm"><strong>Purpose:</strong> ${req.purpose}</p>
                
                <div class="divider">Items Requested</div>
                <div class="overflow-x-auto">
                    <table class="table table-zebra w-full text-sm">
                        <thead>
                            <tr>
                                <th>Stock No.</th>
                                <th>Description</th>
                                <th class="text-center">Requested</th>
                                <th class="text-center">To Issue</th>
                                <th class="text-center">Previously Issued</th>
                            </tr>
                        </thead>
                        <tbody>
                            ${itemsHTML}
                        </tbody>
                    </table>
                </div>
                
                ${footerHTML}
            </div>
        `;
        lucide.createIcons();
    }

    async function handleModalAction(e) {
        const target = e.target;

        if (target.closest('#close-modal-btn')) {
            closeModal();
            return;
        }

        const confirmBtn = target.closest('#confirm-availability-btn');
        const actionBtn = target.closest('#issue-btn') || target.closest('#reject-btn');
        if (!actionBtn && !confirmBtn) return;

        const button = actionBtn || confirmBtn;
        const requisitionId = button.dataset.id;
        const remarks = document.getElementById('remarks-input')?.value || '';
        let newStatus;

        const itemsToUpdate = [];
        if (confirmBtn) {
            newStatus = 'Pending'; // This triggers backend to add SAI number
        } else if (actionBtn) {
            newStatus = actionBtn.id === 'issue-btn' ? 'Issued' : 'Rejected';
        }
        if (actionBtn && actionBtn.id === 'issue-btn') {
            document.querySelectorAll('.issued-qty-input').forEach(input => {
                itemsToUpdate.push({
                    stockItem: input.dataset.stockId,
                    description: input.dataset.description,
                    quantityIssued: parseInt(input.value, 10) || 0
                });
            });
        }

        const payload = { status: newStatus, remarks, items: itemsToUpdate };

        button.disabled = true;
        button.innerHTML = `<span class="loading loading-spinner loading-xs"></span> Processing...`;

        try {
            await fetchWithAuth(`${API_ENDPOINT}/${requisitionId}`, {
                method: 'PUT',
                body: JSON.stringify(payload)
            });

            closeModal();
            await loadRequisitions();
        } catch (error) {
            showToast(`Error: ${error.message}`, 'error');
            button.disabled = false;
            if (confirmBtn) button.textContent = 'Confirm Availability';
            else button.textContent = newStatus === 'Issued' ? 'Issue Items & Approve' : 'Reject';
        }
    }

    // --- EVENT BINDING ---
    statusTabs.addEventListener('click', (e) => {
        const tab = e.target.closest('.tab');
        if (tab && !tab.classList.contains('tab-active')) {
            statusTabs.querySelector('.tab-active')?.classList.remove('tab-active');
            tab.classList.add('tab-active');
            statusFilter = tab.dataset.statusFilter;
            currentPage = 1;
            loadRequisitions();
        }
    });

    searchInput.addEventListener('input', () => {
        clearTimeout(searchTimeout);
        searchTimeout = setTimeout(() => {
            currentPage = 1;
            loadRequisitions();
        }, 300);
    });

    tableHeader.addEventListener('click', (e) => {
        const th = e.target.closest('th[data-sort-key]');
        if (th) {
            const key = th.dataset.sortKey;
            sortDirection = (sortKey === key && sortDirection === 'asc') ? 'desc' : 'asc';
            sortKey = key;
            loadRequisitions();
        }
    });

    paginationControls.addEventListener('click', (e) => {
        const target = e.target.closest('button');
        if (!target) return;
        if (target.id === 'prev-page-btn' && currentPage > 1) { currentPage--; loadRequisitions(); } else if (target.id === 'next-page-btn' && currentPage < totalPages) { currentPage++; loadRequisitions(); } else if (target.classList.contains('page-btn')) { const page = parseInt(target.dataset.page, 10); if (page !== currentPage) { currentPage = page; loadRequisitions(); } }
    });

    // --- EVENT BINDING ---
    requisitionsList.addEventListener('click', (e) => {
        const viewBtn = e.target.closest('.view-req-btn');
        if (viewBtn) openModal(viewBtn.dataset.id);
    });

    // The modal itself can be clicked to close (for backdrop clicks)
    modal.addEventListener('click', (e) => {
        if (e.target === modal) {
            closeModal();
        }
    });

    // Use event delegation for actions inside the modal's content area
    modalContent.addEventListener('click', handleModalAction);

    // --- INITIALIZATION ---
    loadRequisitions();
}