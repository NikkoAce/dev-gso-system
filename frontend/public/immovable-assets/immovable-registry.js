// FILE: frontend/public/immovable-assets/immovable-registry.js
import { getCurrentUser, gsoLogout } from '../js/auth.js';
import { fetchWithAuth } from '../js/api.js';
import { createUIManager } from '../js/ui.js';

document.addEventListener('DOMContentLoaded', async () => {
    try {
        const user = await getCurrentUser();
        if (!user || user.office !== 'GSO') {
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
    const { renderPagination, showToast, openConfirmationModal } = createUIManager();

    // --- STATE ---
    let allAssets = [];
    let currentPage = 1;
    const itemsPerPage = 15;

    // --- DOM ELEMENTS ---
    const tableBody = document.getElementById('asset-table-body');
    const searchInput = document.getElementById('search-input');
    const typeFilter = document.getElementById('type-filter');
    const statusFilter = document.getElementById('status-filter');
    const paginationControls = document.getElementById('pagination-controls');

    // --- UTILITY ---
    const formatCurrency = (value) => new Intl.NumberFormat('en-PH', { style: 'currency', currency: 'PHP' }).format(value || 0);

    // --- RENDERING ---
    function renderTable(assets, pagination) {
        tableBody.innerHTML = '';
        if (assets.length === 0) {
            tableBody.innerHTML = `<tr><td colspan="7" class="text-center py-8 text-gray-500">No immovable assets found.</td></tr>`;
            renderPagination(paginationControls, { currentPage: 1, totalPages: 0, totalDocs: 0, itemsPerPage });
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
                    <div class="flex justify-center items-center gap-1">
                        <a href="./immovable-form.html?id=${asset._id}" class="btn btn-ghost btn-xs" title="Edit Asset"><i data-lucide="edit" class="h-4 w-4"></i></a>
                        <button class="delete-asset-btn btn btn-ghost btn-xs text-red-500" data-id="${asset._id}" title="Delete Asset"><i data-lucide="trash-2" class="h-4 w-4"></i></button>
                    </div>
                </td>
            `;
            tableBody.appendChild(tr);
        });
        lucide.createIcons();
        renderPagination(paginationControls, pagination);
    }

    // --- CORE LOGIC ---
    function applyFiltersAndRender() {
        const searchTerm = searchInput.value.toLowerCase();
        const type = typeFilter.value;
        const status = statusFilter.value;

        const filteredAssets = allAssets.filter(asset => {
            const searchMatch = !searchTerm ||
                asset.name.toLowerCase().includes(searchTerm) ||
                asset.propertyIndexNumber.toLowerCase().includes(searchTerm);
            const typeMatch = !type || asset.type === type;
            const statusMatch = !status || asset.status === status;
            return searchMatch && typeMatch && statusMatch;
        });

        const totalDocs = filteredAssets.length;
        const totalPages = Math.ceil(totalDocs / itemsPerPage);
        if (currentPage > totalPages) {
            currentPage = totalPages || 1;
        }
        const startIndex = (currentPage - 1) * itemsPerPage;
        const paginatedAssets = filteredAssets.slice(startIndex, startIndex + itemsPerPage);

        const paginationData = { totalDocs, totalPages, currentPage, itemsPerPage };
        renderTable(paginatedAssets, paginationData);
    }

    async function loadInitialData() {
        tableBody.innerHTML = `<tr><td colspan="7" class="text-center p-8"><i data-lucide="loader-2" class="animate-spin h-8 w-8 mx-auto text-gray-500"></i></td></tr>`;
        lucide.createIcons();
        try {
            allAssets = await fetchWithAuth(API_ENDPOINT);
            currentPage = 1;
            applyFiltersAndRender();
        } catch (error) {
            console.error('Failed to fetch assets:', error);
            tableBody.innerHTML = `<tr><td colspan="7" class="text-center p-8 text-red-500">Error loading assets.</td></tr>`;
        }
    }

    async function handleDeleteAsset(assetId) {
        try {
            await fetchWithAuth(`${API_ENDPOINT}/${assetId}`, { method: 'DELETE' });
            showToast('Asset deleted successfully.', 'success');
            // Refresh data
            allAssets = allAssets.filter(asset => asset._id !== assetId);
            applyFiltersAndRender();
        } catch (error) {
            console.error('Failed to delete asset:', error);
            showToast(`Error: ${error.message}`, 'error');
        }
    }

    // --- EVENT LISTENERS ---
    [searchInput, typeFilter, statusFilter].forEach(el => {
        el.addEventListener('input', () => {
            currentPage = 1;
            applyFiltersAndRender();
        });
    });

    paginationControls.addEventListener('click', (e) => {
        const paginationData = JSON.parse(e.currentTarget.dataset.pagination || '{}');
        if (e.target && e.target.id === 'prev-page-btn') {
            if (currentPage > 1) {
                currentPage--;
                applyFiltersAndRender();
            }
        }
        if (e.target && e.target.id === 'next-page-btn') {
            if (currentPage < paginationData.totalPages) {
                currentPage++;
                applyFiltersAndRender();
            }
        }
    });

    tableBody.addEventListener('click', (e) => {
        const deleteButton = e.target.closest('.delete-asset-btn');
        if (deleteButton) {
            const assetId = deleteButton.dataset.id;
            openConfirmationModal(
                'Delete Asset',
                'Are you sure you want to delete this immovable asset? This action cannot be undone.',
                () => handleDeleteAsset(assetId)
            );
        }
    });

    // --- INITIALIZATION ---
    loadInitialData();
}
