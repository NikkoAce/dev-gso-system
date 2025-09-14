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
    let totalPages = 1;
    let currentSort = { field: 'propertyIndexNumber', order: 'asc' };
    let searchTimeout;

    // --- DOM ELEMENTS ---
    const tableBody = document.getElementById('asset-table-body');
    const tableHeader = tableBody.parentElement.querySelector('thead');
    const tableFooter = document.getElementById('asset-table-footer');
    const searchInput = document.getElementById('search-input');
    const toggleFiltersBtn = document.getElementById('toggle-filters-btn');
    const filtersGrid = document.getElementById('filters-grid');
    const typeFilter = document.getElementById('type-filter');
    const statusFilter = document.getElementById('status-filter');
    const conditionFilter = document.getElementById('condition-filter');
    const startDateFilter = document.getElementById('start-date-filter');
    const endDateFilter = document.getElementById('end-date-filter');
    const paginationControls = document.getElementById('pagination-controls');
    const exportCsvBtn = document.getElementById('export-csv-btn');
    const addAssetBtn = document.getElementById('add-asset-btn');

    // --- UTILITY ---
    const formatCurrency = (value) => new Intl.NumberFormat('en-PH', { style: 'currency', currency: 'PHP' }).format(value || 0);

    // --- RENDERING ---
    function renderTable(assets) {
        tableBody.innerHTML = '';
        if (!assets || assets.length === 0) {
            tableBody.innerHTML = `<tr><td colspan="9" class="text-center py-8 text-gray-500">No immovable assets found for the selected criteria.</td></tr>`;
            return;
        }
        const statusMap = {
            'In Use': 'badge-success',
            'Under Construction': 'badge-info',
            'Idle': 'badge-warning',
            'For Disposal': 'badge-error',
            'Disposed': 'badge-ghost',
        };
        const statusIconMap = {
            'In Use': 'check-circle',
            'Under Construction': 'construction',
            'Idle': 'pause-circle',
            'For Disposal': 'alert-triangle',
            'Disposed': 'x-circle',
        };

        assets.forEach(asset => {
            const canUpdate = user.permissions.includes('immovable:update');
            const canDelete = user.permissions.includes('immovable:delete');

            const editLink = canUpdate ? `<li><a href="./immovable-form.html?id=${asset._id}"><i data-lucide="edit" class="h-4 w-4"></i> Edit</a></li>` : '';
            const deleteButton = canDelete ? `<li><button class="delete-asset-btn text-red-500" data-id="${asset._id}" title="Delete Asset"><i data-lucide="trash-2" class="h-4 w-4"></i> Delete</button></li>` : '';
            // Conditionally create the Ledger Card link for depreciable assets
            const ledgerCardLink = ['Building', 'Other Structures'].includes(asset.type)
                ? `<li><a href="./ledger-card.html?id=${asset._id}"><i data-lucide="book-down" class="h-4 w-4"></i> Ledger Card (Depreciation)</a></li>`
                : '';

            const parentAssetInfo = asset.parentAsset
                ? `<a href="./immovable-form.html?id=${asset.parentAsset._id}" class="link link-hover text-xs">${asset.parentAsset.name}</a>`
                : '<span class="text-xs text-gray-400">None</span>';

            const divider = (editLink || ledgerCardLink) && deleteButton ? `<div class="divider my-1"></div>` : '';

            const icon = statusIconMap[asset.status] || 'help-circle';
            const statusBadge = `<span class="badge ${statusMap[asset.status] || 'badge-ghost'} badge-sm gap-2">
                                    <i data-lucide="${icon}" class="h-3 w-3"></i>
                                    ${asset.status}
                                 </span>`;
            const tr = document.createElement('tr');
            tr.innerHTML = `
                <td data-label="PIN" class="font-mono">${asset.propertyIndexNumber}</td>
                <td data-label="Name">${asset.name}</td>
                <td data-label="Type">${asset.type}</td>
                <td data-label="Location">${asset.location}</td>
                <td data-label="Parent Asset">${parentAssetInfo}</td>
                <td data-label="Assessed Value" class="text-right">${formatCurrency(asset.assessedValue)}</td>
                <td data-label="Book Value" class="text-right font-semibold">${formatCurrency(asset.totalBookValue)}</td>
                <td data-label="Status" class="text-center">${statusBadge}</td>
                <td data-label="Actions" class="text-center non-printable">
                     <div class="dropdown dropdown-end">
                        <label tabindex="0" class="btn btn-ghost btn-xs m-1"><i data-lucide="more-vertical"></i></label>
                        <ul tabindex="0" class="dropdown-content z-[1] menu p-2 shadow bg-base-100 rounded-box w-52">
                            ${editLink}
                            <li><a href="./property-card.html?id=${asset._id}" class="flex items-center gap-2"><i data-lucide="book-user" class="h-4 w-4"></i> Property Card (History)</a></li>
                            ${ledgerCardLink}
                            ${divider}
                            ${deleteButton}
                        </ul>
                    </div>
                </td>
            `;
            tableBody.appendChild(tr);
        });
        lucide.createIcons();
    }

    function renderSummary(totalAssessedValue, totalBookValue) {
        if (totalAssessedValue > 0 || totalBookValue > 0) {
            tableFooter.innerHTML = `
                <tr>
                    <td colspan="5" class="text-right font-bold">Total (All Filtered Pages):</td>
                    <td class="text-right font-bold">${formatCurrency(totalAssessedValue)}</td>
                    <td class="text-right font-bold">${formatCurrency(totalBookValue)}</td>
                    <td colspan="2"></td>
                </tr>
            `;
        } else {
            tableFooter.innerHTML = '';
        }
    }

    // --- CORE LOGIC ---
    async function fetchAndRenderAssets(page = 1) {
        currentPage = page;
        tableBody.innerHTML = `<tr><td colspan="9" class="text-center p-8"><i data-lucide="loader-2" class="animate-spin h-8 w-8 mx-auto text-gray-500"></i></td></tr>`;
        tableFooter.innerHTML = ''; // Clear footer while loading
        lucide.createIcons();

        const params = new URLSearchParams({
            page: currentPage,
            limit: 15, // Items per page
            sort: currentSort.field,
            order: currentSort.order,
            search: searchInput.value,
            type: typeFilter.value,
            status: statusFilter.value,
            condition: conditionFilter.value,
            startDate: startDateFilter.value,
            endDate: endDateFilter.value
        });

        try {
            const data = await fetchWithAuth(`${API_ENDPOINT}?${params.toString()}`);
            totalPages = data.totalPages;
            renderTable(data.docs);
            renderSummary(data.totalValue, data.totalBookValue);
            renderPagination(paginationControls, {
                currentPage: data.page,
                totalPages: data.totalPages,
                totalDocs: data.totalDocs,
                itemsPerPage: data.limit
            });
        } catch (error) {
            console.error('Failed to fetch assets:', error);
            tableBody.innerHTML = `<tr><td colspan="9" class="text-center p-8 text-red-500">Error loading assets. Please try again.</td></tr>`;
            tableFooter.innerHTML = ''; // Clear footer on error
        }
    }

    // --- NEW: CSV Export Logic ---
    function convertToCSV(assets) {
        const headers = [
            'Property Index Number', 'Name', 'Type', 'Location', 'Latitude', 'Longitude',
            'Date Acquired', 'Assessed Value', 'Total Book Value', 'Status', 'Condition', 'Remarks',
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
                asset.assessedValue || '0',
                asset.totalBookValue || asset.assessedValue || '0',
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
                buildingDetails.salvageValue || '0'
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
            search: searchInput.value, type: typeFilter.value, status: statusFilter.value,
            condition: conditionFilter.value, startDate: startDateFilter.value, endDate: endDateFilter.value
        });

        try {
            const response = await fetchWithAuth(`${API_ENDPOINT}?${params.toString()}`);
            const allAssets = response.docs; // Use the 'docs' property
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

    /**
     * Reads filters from the URL query string, populates the filter inputs,
     * and then triggers a data fetch to apply them.
     */
    function applyUrlFiltersAndFetch() {
        const params = new URLSearchParams(window.location.search);
        let hasUrlFilters = false;

        const filterMap = {
            startDate: startDateFilter,
            endDate: endDateFilter,
            status: statusFilter,
            condition: conditionFilter
        };

        for (const [param, element] of Object.entries(filterMap)) {
            if (params.has(param) && element) {
                element.value = params.get(param);
                hasUrlFilters = true;
            }
        }

        // Clean the URL to avoid confusion on subsequent manual filtering
        if (hasUrlFilters) {
            window.history.replaceState({}, document.title, window.location.pathname);
        }
    }

    // --- EVENT LISTENERS ---
    [typeFilter, statusFilter, conditionFilter, startDateFilter, endDateFilter].forEach(el => {
        el.addEventListener('change', () => fetchAndRenderAssets(1));
    });

    searchInput.addEventListener('input', () => {
        clearTimeout(searchTimeout);
        searchTimeout = setTimeout(() => {
            fetchAndRenderAssets(1);
        }, 300); // Debounce search input
    });

    tableHeader.addEventListener('click', (e) => {
        const th = e.target.closest('th[data-sort-key]');
        if (!th) return;

        const key = th.dataset.sortKey;
        // If it's a new key, default to 'asc'. If same key, toggle direction.
        const order = (currentSort.field === key && currentSort.order === 'asc') ? 'desc' : 'asc';
        currentSort = { field: key, order };
        fetchAndRenderAssets(1);
    });

    toggleFiltersBtn.addEventListener('click', () => {
        filtersGrid.classList.toggle('hidden');
    });

    paginationControls.addEventListener('click', (e) => {
        const target = e.target.closest('button');
        if (!target) return;

        if (target.id === 'prev-page-btn' && currentPage > 1) {
            fetchAndRenderAssets(currentPage - 1);
        } else if (target.id === 'next-page-btn' && currentPage < totalPages) {
            fetchAndRenderAssets(currentPage + 1);
        } else if (target.classList.contains('page-btn')) {
            const page = parseInt(target.dataset.page, 10);
            if (page !== currentPage) fetchAndRenderAssets(page);
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
    // Hide "Add" button if user doesn't have create permission
    if (!user.permissions.includes('immovable:create')) {
        addAssetBtn.classList.add('hidden');
    }

    applyUrlFiltersAndFetch();
    fetchAndRenderAssets();
}
