// FILE: frontend/public/slip-history.js
import { fetchWithAuth } from './api.js';
import { createUIManager } from './js/ui.js';

document.addEventListener('DOMContentLoaded', async () => {
    try {
        const user = await getCurrentUser();
        if (!user) return;

        initializeLayout(user);
        initializeSlipHistoryPage(user);
    } catch (error) {
        console.error("Authentication failed on slip history page:", error);
    }
});

function initializeSlipHistoryPage(currentUser) {
    const API_ENDPOINT = 'slips';
    let currentPage = 1;
    const itemsPerPage = 20;
    const { renderPagination } = createUIManager();

    const slipTypeFilter = document.getElementById('slip-type-filter');
    const searchInput = document.getElementById('slip-search-input');
    const paginationControls = document.getElementById('pagination-controls');
    const slipDetailsModal = document.getElementById('slip-details-modal');

    // --- UTILITY FUNCTIONS ---
    const formatDate = (dateString) => dateString ? new Date(dateString).toLocaleDateString('en-CA') : 'N/A';
    const formatCurrency = (value) => new Intl.NumberFormat('en-PH', { style: 'currency', currency: 'PHP' }).format(value || 0);

    function renderSlipTable(slips, pagination) {
        const tableBody = document.getElementById('slip-history-table-body');

        tableBody.innerHTML = '';
        if (slips.length === 0) {
            tableBody.innerHTML = `<tr><td colspan="6" class="text-center py-8 text-gray-500">No slips found for the selected criteria.</td></tr>`;
            renderPagination(paginationControls, { currentPage: 1, totalPages: 0, totalDocs: 0, itemsPerPage });
            return;
        }

        let rowsHTML = '';
        slips.forEach(slip => {
            let custodianDisplay = '';
            if (slip.custodian) {
                custodianDisplay = `
                    <div class="font-medium text-gray-900">${slip.custodian.name}</div>
                    <div class="text-gray-500 text-xs">${slip.custodian.office}</div>
                `;
            }
            
            const typeBadgeClass = slip.slipType === 'PAR' ? 'badge-success' : 'badge-info';

            rowsHTML += `
                <tr>
                    <td class="font-medium">${slip.number}</td>
                    <td><span class="badge ${typeBadgeClass} badge-sm">${slip.slipType}</span></td>
                    <td>${custodianDisplay}</td>
                    <td>${slip.assets.length}</td>
                    <td>${formatDate(slip.issuedDate)}</td>
                    <td class="text-center non-printable">
                        <div class="flex justify-center items-center gap-1">
                            <button class="view-slip-btn btn btn-ghost btn-xs" data-id="${slip._id}" title="View Details"><i data-lucide="eye" class="h-4 w-4"></i></button>
                            <button class="reprint-btn btn btn-ghost btn-xs" data-id="${slip._id}" data-type="${slip.slipType}" title="Reprint Slip"><i data-lucide="printer" class="h-4 w-4"></i></button>
                        </div>
                    </td>
                </tr>
            `;
        });
        tableBody.innerHTML = rowsHTML;
        lucide.createIcons();
        renderPagination(paginationControls, pagination);
    }

    async function loadSlips() {
        const tableBody = document.getElementById('slip-history-table-body');
        tableBody.innerHTML = `<tr><td colspan="6" class="text-center p-8"><i data-lucide="loader-2" class="animate-spin h-8 w-8 mx-auto text-gray-500"></i></td></tr>`;
        lucide.createIcons();
        try {
            const params = new URLSearchParams({
                page: currentPage,
                limit: itemsPerPage,
                search: searchInput.value,
                slipType: slipTypeFilter.value,
            });
            const data = await fetchWithAuth(`${API_ENDPOINT}?${params}`);
            renderSlipTable(data.docs, data);
        } catch (error) {
            console.error('Failed to fetch slip history:', error);
            tableBody.innerHTML = `<tr><td colspan="6" class="text-center p-8 text-red-500">Error loading slip history.</td></tr>`;
        }
    }

    // --- MODAL Functionality ---
    async function showSlipDetails(slipId) {
        const slip = await fetchWithAuth(`${API_ENDPOINT}/${slipId}`);
        document.getElementById('modal-title').textContent = `${slip.slipType} Details`;
        document.getElementById('modal-slip-number').textContent = slip.number;
        document.getElementById('modal-slip-custodian').textContent = slip.custodian.name;
        document.getElementById('modal-slip-issued').textContent = formatDate(slip.issuedDate);
        document.getElementById('modal-slip-received').textContent = formatDate(slip.receivedDate);

        const assetsTableBody = document.getElementById('modal-slip-assets-table');
        assetsTableBody.innerHTML = '';
        slip.assets.forEach(asset => {
            let desc = asset.description;
            if(asset.specifications && asset.specifications.length > 0) {
                const specs = asset.specifications.map(s => `${s.key}: ${s.value}`).join(', ');
                desc += ` (${specs})`;
            }
            const row = `
                <tr>
                    <td>${asset.propertyNumber}</td>
                    <td>${desc}</td>
                    <td class="text-right">${formatCurrency(asset.acquisitionCost)}</td>
                </tr>
            `;
            assetsTableBody.innerHTML += row;
        });

        slipDetailsModal.showModal();
    }

    // --- EVENT LISTENERS ---
    [slipTypeFilter, searchInput].forEach(el => {
        el.addEventListener('input', () => {
            currentPage = 1;
            loadSlips();
        });
    });
    
    paginationControls.addEventListener('click', (e) => {
        if (e.target && e.target.id === 'prev-page-btn') {
            if (currentPage > 1) {
                currentPage--;
                loadSlips();
            }
        }
        if (e.target && e.target.id === 'next-page-btn') {
            currentPage++;
            loadSlips();
        }
    });

    document.getElementById('slip-history-table-body').addEventListener('click', (e) => {
        const viewButton = e.target.closest('.view-slip-btn');
        if (viewButton) {
            const slipId = viewButton.dataset.id;
            showSlipDetails(slipId);
            return;
        }

        const reprintButton = e.target.closest('.reprint-btn');
        if (reprintButton) {
            const slipId = reprintButton.dataset.id;
            // We need to fetch the full slip details for reprinting
            fetchWithAuth(`${API_ENDPOINT}/${slipId}`).then(slipToReprint => {
                if (!slipToReprint) return;
                const slipType = slipToReprint.slipType;
                if (slipType === 'PAR') {
                    localStorage.setItem('parToReprint', JSON.stringify(slipToReprint));
                    window.location.href = 'par-page.html';
                } else if (slipType === 'ICS') {
                    localStorage.setItem('icsToReprint', JSON.stringify(slipToReprint));
                    window.location.href = 'ics-page.html';
                }
            });
        }
    });

    document.getElementById('close-slip-modal').addEventListener('click', () => {
        slipDetailsModal.close();
    });

    // --- INITIALIZATION ---
    loadSlips();
}
