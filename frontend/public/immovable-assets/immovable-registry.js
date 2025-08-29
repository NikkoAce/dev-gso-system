// FILE: frontend/public/immovable-assets/immovable-registry.js
import { getCurrentUser, gsoLogout } from '../js/auth.js';
import { fetchWithAuth } from '../js/api.js';
import { createUIManager } from '../js/ui.js';

document.addEventListener('DOMContentLoaded', async () => {
    try {
        const user = await getCurrentUser();
        if (!user) return;

        if (!user.permissions || !user.permissions.includes('immovable:read')) {
            window.location.href = '../dashboard/dashboard.html';
            return;
        }
        initializeLayout(user, gsoLogout);
        initializeRegistryPage(user);
    } catch (error) {
        console.error("Authentication failed on immovable asset registry page:", error);
    }
});

function initializeRegistryPage(user) {
    const API_ENDPOINT = 'immovable-assets';
    const { renderPagination, showToast, showConfirmationModal } = createUIManager();

    // --- STATE ---
    let currentPage = 1;
    let currentSort = { field: 'propertyIndexNumber', order: 'asc' };
    let searchTimeout;

    // --- DOM ELEMENTS ---
    const tableBody = document.getElementById('asset-table-body');
    const searchInput = document.getElementById('search-input');
    const typeFilter = document.getElementById('type-filter');
    const statusFilter = document.getElementById('status-filter');
    const paginationControls = document.getElementById('pagination-controls');
    const exportCsvBtn = document.getElementById('export-csv-btn');

    // --- UTILITY ---
    const formatCurrency = (value) => new Intl.NumberFormat('en-PH', { style: 'currency', currency: 'PHP' }).format(value || 0);

    // --- RENDERING ---
    function renderTable(assets) {
        tableBody.innerHTML = '';
        if (!assets || assets.length === 0) {
            tableBody.innerHTML = `<tr><td colspan="7" class="text-center py-8 text-gray-500">No immovable assets found for the selected criteria.</td></tr>`;
            return;
        }
        const statusMap = {
            'In Use': 'badge-success',
            'Under Construction': 'badge-info',
            'Idle': 'badge-warning',
            'For Disposal': 'badge-error',
            'Disposed': 'badge-ghost'
        };

        assets.forEach(asset => {
            // Conditionally create the Ledger Card link for depreciable assets
            const ledgerCardLink = ['Building', 'Other Structures'].includes(asset.type)
                ? `<li><a href="./ledger-card.html?id=${asset._id}" class="flex items-center gap-2"><i data-lucide="book-down" class="h-4 w-4"></i> Ledger Card (Depreciation)</a></li>`
                : '';

            const statusBadge = `<span class="badge ${statusMap[asset.status] || 'badge-ghost'} badge-sm">${asset.status}</span>`;
            const tr = document.createElement('tr');
            tr.innerHTML = `
                <td class="font-mono">${asset.propertyIndexNumber}</td>
                <td>${asset.name}</td>
                <td>${asset.type}</td>
                <td>${asset.location}</td>
                <td class="text-right">${formatCurrency(asset.assessedValue)}</td>
                <td class="text-center">${statusBadge}</td>
                <td class="text-center non-printable">
                     <div class="dropdown dropdown-end">
                        <label tabindex="0" class="btn btn-ghost btn-xs m-1"><i data-lucide="more-vertical"></i></label>
                        <ul tabindex="0" class="dropdown-content z-[1] menu p-2 shadow bg-base-100 rounded-box w-52">
                            <li><a href="./immovable-form.html?id=${asset._id}" class="flex items-center gap-2"><i data-lucide="edit" class="h-4 w-4"></i> Edit</a></li>
                            <li><a href="./property-card.html?id=${asset._id}" class="flex items-center gap-2"><i data-lucide="book-user" class="h-4 w-4"></i> Property Card (History)</a></li>
                            ${ledgerCardLink}
                            <div class="divider my-1"></div>
                            <li><button class="delete-asset-btn text-red-500 flex items-center gap-2" data-id="${asset._id}" title="Delete Asset"><i data-lucide="trash-2" class="h-4 w-4"></i> Delete</button></li>
                        </ul>
                    </div>
                </td>
            `;
            tableBody.appendChild(tr);
        });
        lucide.createIcons();
    }

    // --- CORE LOGIC ---
    async function fetchAndRenderAssets(page = 1) {
        currentPage = page;
        tableBody.innerHTML = `<tr><td colspan="7" class="text-center p-8"><i data-lucide="loader-2" class="animate-spin h-8 w-8 mx-auto text-gray-500"></i></td></tr>`;
        lucide.createIcons();

        const params = new URLSearchParams({
            page: currentPage,
            limit: 15, // Items per page
            sort: currentSort.field,
            order: currentSort.order,
            search: searchInput.value,
            type: typeFilter.value,
            status: statusFilter.value
        });

        try {
            const data = await fetchWithAuth(`${API_ENDPOINT}?${params.toString()}`);
            renderTable(data.docs);
            renderPagination(paginationControls, {
                currentPage: data.page,
                totalPages: data.totalPages,
                totalDocs: data.totalDocs,
                itemsPerPage: data.limit
            });
        } catch (error) {
            console.error('Failed to fetch assets:', error);
            tableBody.innerHTML = `<tr><td colspan="7" class="text-center p-8 text-red-500">Error loading assets. Please try again.</td></tr>`;
        }
    }

    // --- NEW: CSV Export Logic ---
    function convertToCSV(assets) {
        const headers = [
            'Property Index Number', 'Name', 'Type', 'Location', 'Latitude', 'Longitude',
            'Date Acquired', 'Assessed Value', 'Status', 'Condition', 'Remarks',
            'Fund Source', 'Account Code', 'Acquisition Method', 'Impairment Losses',
            'Land Lot Number', 'Land Title Number', 'Land Area (sqm)',
            'Building Floors', 'Building Floor Area (sqm)', 'Building Construction Date', 'Building Useful Life (Yrs)', 'Building Salvage Value'
        ];

        const rows = assets.map(asset => {
            const landDetails = asset.landDetails || {};
            const buildingDetails = asset.buildingAndStructureDetails || {};
            // Helper to safely format strings for CSV
            const escapeCSV = (str) => `"${(str || '').toString().replace(/"/g, '""')}"`;

            return [
                escapeCSV(asset.propertyIndexNumber),
                escapeCSV(asset.name),
                escapeCSV(asset.type),
                escapeCSV(asset.location),
                asset.latitude || '',
                asset.longitude || '',
                asset.dateAcquired ? new Date(asset.dateAcquired).toISOString().split('T')[0] : '',
                asset.assessedValue || 0,
                escapeCSV(asset.status),
                escapeCSV(asset.condition),
                escapeCSV(asset.remarks),
                escapeCSV(asset.fundSource),
                escapeCSV(asset.accountCode),
                escapeCSV(asset.acquisitionMethod),
                asset.impairmentLosses || 0,
                escapeCSV(landDetails.lotNumber),
                escapeCSV(landDetails.titleNumber),
                landDetails.areaSqm || '',
                buildingDetails.numberOfFloors || '',
                buildingDetails.floorArea || '',
                buildingDetails.constructionDate ? new Date(buildingDetails.constructionDate).toISOString().split('T')[0] : '',
                buildingDetails.estimatedUsefulLife || '',
                buildingDetails.salvageValue || 0
            ].join(',');
        });

        return [headers.join(','), ...rows].join('\n');
    }

    function downloadCSV(csvContent, fileName) {
        const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
        const link = document.createElement('a');
        const url = URL.createObjectURL(blob);
        link.setAttribute('href', url);
        link.setAttribute('download', fileName);
        link.style.visibility = 'hidden';
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        URL.revokeObjectURL(url);
    }

    async function handleExportCSV() {
        exportCsvBtn.disabled = true;
        exportCsvBtn.innerHTML = `<i data-lucide="loader-2" class="animate-spin"></i> Exporting...`;
        lucide.createIcons();

        const params = new URLSearchParams({
            sort: currentSort.field, order: currentSort.order,
            search: searchInput.value, type: typeFilter.value, status: statusFilter.value
        });

        try {
            const allAssets = await fetchWithAuth(`${API_ENDPOINT}?${params.toString()}`);
            if (!allAssets || allAssets.length === 0) {
                showToast('No assets to export for the current filters.', 'warning');
                return;
            }
            const csvContent = convertToCSV(allAssets);
            downloadCSV(csvContent, `immovable-assets-export-${new Date().toISOString().split('T')[0]}.csv`);
            showToast('Export successful!', 'success');
        } catch (error) {
            console.error('Failed to export assets:', error);
            showToast(`Error exporting assets: ${error.message}`, 'error');
        } finally {
            exportCsvBtn.disabled = false;
            exportCsvBtn.innerHTML = `<i data-lucide="download"></i> Export to CSV`;
            lucide.createIcons();
        }
    }

    async function handleDeleteAsset(assetId) {
        try {
            await fetchWithAuth(`${API_ENDPOINT}/${assetId}`, { method: 'DELETE' });
            showToast('Asset marked as disposed successfully.', 'success');
            fetchAndRenderAssets(currentPage); // Refresh the current page
        } catch (error) {
            console.error('Failed to delete asset:', error);
            showToast(`Error: ${error.message}`, 'error');
        }
    }

    // --- EVENT LISTENERS ---
    [typeFilter, statusFilter].forEach(el => {
        el.addEventListener('change', () => fetchAndRenderAssets(1));
    });

    searchInput.addEventListener('input', () => {
        clearTimeout(searchTimeout);
        searchTimeout = setTimeout(() => {
            fetchAndRenderAssets(1);
        }, 300); // Debounce search input
    });

    paginationControls.addEventListener('click', (e) => {
        if (e.target && e.target.id === 'prev-page-btn') {
            fetchAndRenderAssets(currentPage - 1);
        }
        if (e.target && e.target.id === 'next-page-btn') {
            fetchAndRenderAssets(currentPage + 1);
        }
    });

    tableBody.addEventListener('click', (e) => {
        const deleteButton = e.target.closest('.delete-asset-btn');
        if (deleteButton) {
            const assetId = deleteButton.dataset.id;
            showConfirmationModal(
                'Mark as Disposed',
                'Are you sure you want to mark this asset as disposed? This action can be reversed by editing the asset.',
                () => handleDeleteAsset(assetId)
            );
        }
    });

    exportCsvBtn.addEventListener('click', handleExportCSV);

    // --- INITIALIZATION ---
    fetchAndRenderAssets();
}
