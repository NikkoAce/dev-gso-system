// FILE: frontend/public/slip-history.js
import { fetchWithAuth } from './api.js';

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
    let allSlips = [];
    let currentPage = 1;
    const itemsPerPage = 20;

    const slipTypeFilter = document.getElementById('slip-type-filter');
    const searchInput = document.getElementById('slip-search-input');
    const paginationControls = document.getElementById('pagination-controls');
    const slipDetailsModal = document.getElementById('slip-details-modal');

    // --- UTILITY FUNCTIONS ---
    const formatDate = (dateString) => dateString ? new Date(dateString).toLocaleDateString('en-CA') : 'N/A';
    const formatCurrency = (value) => new Intl.NumberFormat('en-PH', { style: 'currency', currency: 'PHP' }).format(value || 0);

    // --- DATA FETCHING & RENDERING ---
    async function fetchAndRenderSlips() {
        try {
            allSlips = await fetchWithAuth(API_ENDPOINT);
            renderSlipTable();
        } catch (error) {
            console.error('Failed to fetch slip history:', error);
            const tableBody = document.getElementById('slip-history-table-body');
            tableBody.innerHTML = `<tr><td colspan="6" class="text-center p-8 text-red-500">Error loading slip history.</td></tr>`;
        }
    }

    function renderSlipTable() {
        const tableBody = document.getElementById('slip-history-table-body');
        const selectedType = slipTypeFilter.value;
        const searchTerm = searchInput.value.toLowerCase();

        const filteredSlips = allSlips.filter(slip => {
            const matchesType = selectedType === '' || slip.slipType === selectedType;
            const matchesSearch = searchTerm === '' ||
                slip.number.toLowerCase().includes(searchTerm) ||
                (slip.custodian && slip.custodian.name.toLowerCase().includes(searchTerm));
            return matchesType && matchesSearch;
        });

        const totalPages = Math.ceil(filteredSlips.length / itemsPerPage);
        const startIndex = (currentPage - 1) * itemsPerPage;
        const endIndex = startIndex + itemsPerPage;
        const paginatedSlips = filteredSlips.slice(startIndex, endIndex);

        tableBody.innerHTML = '';
        if (paginatedSlips.length === 0) {
            tableBody.innerHTML = `<tr><td colspan="6" class="text-center py-8 text-gray-500">No slips found for the selected criteria.</td></tr>`;
            renderPagination(0, 0);
            return;
        }

        let rowsHTML = '';
        paginatedSlips.forEach(slip => {
            let custodianDisplay = '';
            if (slip.custodian) {
                custodianDisplay = `
                    <div class="font-medium text-gray-900">${slip.custodian.name}</div>
                    <div class="text-gray-500 text-xs">${slip.custodian.office}</div>
                `;
            }
            
            const typeBadgeClass = slip.slipType === 'PAR' ? 'bg-green-100 text-green-800' : 'bg-blue-100 text-blue-800';

            rowsHTML += `
                <tr class="bg-white border-b hover:bg-gray-50">
                    <td class="px-6 py-4 font-medium text-gray-900">${slip.number}</td>
                    <td class="px-6 py-4"><span class="px-3 py-1 text-xs font-semibold rounded-full ${typeBadgeClass}">${slip.slipType}</span></td>
                    <td class="px-6 py-4">${custodianDisplay}</td>
                    <td class="px-6 py-4">${slip.assets.length}</td>
                    <td class="px-6 py-4">${formatDate(slip.issuedDate)}</td>
                    <td class="px-6 py-4 text-center non-printable">
                        <div class="flex justify-center items-center space-x-3">
                            <button class="view-slip-btn text-blue-600 hover:text-blue-800" data-id="${slip._id}" title="View Details"><i data-lucide="eye" class="h-5 w-5"></i></button>
                            <button class="reprint-btn text-gray-600 hover:text-gray-800" data-id="${slip._id}" data-type="${slip.slipType}" title="Reprint Slip"><i data-lucide="printer" class="h-5 w-5"></i></button>
                        </div>
                    </td>
                </tr>
            `;
        });
        tableBody.innerHTML = rowsHTML;
        lucide.createIcons();
        renderPagination(totalPages, filteredSlips.length);
    }
    
    function renderPagination(totalPages, totalItems) {
        paginationControls.innerHTML = '';
        if (totalPages <= 1) return;
        
        const startItem = (currentPage - 1) * itemsPerPage + 1;
        const endItem = Math.min(currentPage * itemsPerPage, totalItems);

        paginationControls.innerHTML = `
            <span class="text-sm text-gray-700">
                Showing <span class="font-semibold">${startItem}</span>
                to <span class="font-semibold">${endItem}</span>
                of <span class="font-semibold">${totalItems}</span> Results
            </span>
            <div class="inline-flex mt-2 xs:mt-0">
                ${currentPage > 1 ? `<button id="prev-page-btn" class="px-4 py-2 text-sm font-medium text-white bg-gray-800 rounded-l hover:bg-gray-900">Prev</button>` : ''}
                ${currentPage < totalPages ? `<button id="next-page-btn" class="px-4 py-2 text-sm font-medium text-white bg-gray-800 border-0 border-l border-gray-700 rounded-r hover:bg-gray-900">Next</button>` : ''}
            </div>
        `;
    }

    // --- MODAL Functionality ---
    function showSlipDetails(slipId) {
        const slip = allSlips.find(s => s._id === slipId);
        if (!slip) return;

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
                <tr class="border-b">
                    <td class="p-4">${asset.propertyNumber}</td>
                    <td class="p-4">${desc}</td>
                    <td class="p-4 text-right">${formatCurrency(asset.acquisitionCost)}</td>
                </tr>
            `;
            assetsTableBody.innerHTML += row;
        });

        slipDetailsModal.classList.remove('hidden');
    }

    // --- EVENT LISTENERS ---
    [slipTypeFilter, searchInput].forEach(el => {
        el.addEventListener('input', () => {
            currentPage = 1;
            renderSlipTable();
        });
    });
    
    paginationControls.addEventListener('click', (e) => {
        if (e.target && e.target.id === 'prev-page-btn') {
            if (currentPage > 1) {
                currentPage--;
                renderSlipTable();
            }
        }
        if (e.target && e.target.id === 'next-page-btn') {
            currentPage++;
            renderSlipTable();
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
            const slipType = reprintButton.dataset.type;
            const slipToReprint = allSlips.find(s => s._id === slipId);

            if (slipToReprint) {
                if (slipType === 'PAR') {
                    localStorage.setItem('parToReprint', JSON.stringify(slipToReprint));
                    window.location.href = 'par-page.html';
                } else if (slipType === 'ICS') {
                    localStorage.setItem('icsToReprint', JSON.stringify(slipToReprint));
                    window.location.href = 'ics-page.html';
                }
            }
        }
    });

    document.getElementById('close-slip-modal').addEventListener('click', () => {
        slipDetailsModal.classList.add('hidden');
    });

    // --- INITIALIZATION ---
    fetchAndRenderSlips();
}
