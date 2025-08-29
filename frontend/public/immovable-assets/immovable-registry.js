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

    // --- INITIALIZATION ---
    fetchAndRenderAssets();
}
