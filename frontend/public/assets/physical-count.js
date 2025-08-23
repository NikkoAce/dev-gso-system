// FILE: frontend/public/physical-count.js
import { fetchWithAuth } from '../js/api.js';
import { createUIManager } from '../js/ui.js';

document.addEventListener('DOMContentLoaded', async () => {
    try {
        const user = await getCurrentUser();
        if (!user) return;

        initializeLayout(user);
        initializePhysicalCountPage(user);
    } catch (error) {
        console.error("Authentication failed on physical count page:", error);
    }
});

function initializePhysicalCountPage(currentUser) {
    let currentPage = 1;
    const itemsPerPage = 20;
    const { populateFilters, setLoading, showToast, renderPagination } = createUIManager();

    // --- DOM ELEMENTS ---
    const searchInput = document.getElementById('search-input');
    const officeFilter = document.getElementById('office-filter');
    const paginationControls = document.getElementById('pagination-controls');
    const tableBody = document.getElementById('physical-count-table-body');

    // --- DATA FETCHING & RENDERING ---
    async function initializePage() {
        try {
            const offices = await fetchWithAuth('offices');
            populateFilters({ offices }, { officeFilter });
            await loadAssets();
        } catch (error)
        {
            console.error('Failed to initialize page:', error);
            tableBody.innerHTML = `<tr><td colspan="5" class="text-center p-8 text-red-500">Error loading data.</td></tr>`;
        }
    }
    
    function renderTable(assets, pagination) {
        tableBody.innerHTML = '';
        if (assets.length === 0) {
            tableBody.innerHTML = `<tr><td colspan="5" class="text-center py-8 text-gray-500">No assets found.</td></tr>`;
            renderPagination(paginationControls, { currentPage: 1, totalPages: 0, totalDocs: 0, itemsPerPage });
            return;
        }

        assets.forEach(asset => {
            const tr = document.createElement('tr');
            // tr.className = 'bg-white border-b'; // This is handled by table-zebra
            tr.dataset.assetId = asset._id;

            let fullDescription = `<div class="font-medium text-gray-900">${asset.description}</div>`;
            if (asset.specifications && asset.specifications.length > 0) {
                asset.specifications.forEach(spec => {
                    fullDescription += `<div class="text-gray-500 text-xs">${spec.key}: ${spec.value}</div>`;
                });
            }

            let custodianDisplay = '';
            if (asset.custodian) {
                custodianDisplay = `
                    <div class="font-medium text-gray-900">${asset.custodian.name}</div>
                    <div class="text-gray-500 text-xs">${asset.custodian.office}</div>
                `;
            }

            const conditionOptions = [
                'Very Good (VG)', 'Good Condition (G)', 'Fair Condition (F)', 
                'Poor Condition (P)', 'Scrap Condition (S)'
            ];

            const selectHTML = `
                <select class="condition-input select select-bordered select-sm w-full font-normal">
                    <option value="">Select...</option>
                    ${conditionOptions.map(opt => `<option value="${opt}" ${asset.condition === opt ? 'selected' : ''}>${opt}</option>`).join('')}
                </select>
            `;

            tr.innerHTML = `
                <td class="font-medium">${asset.propertyNumber}</td>
                <td>${fullDescription}</td>
                <td>${custodianDisplay}</td>
                <td>${selectHTML}</td>
                <td>
                    <input type="text" class="remarks-input input input-bordered input-sm w-full" value="${asset.remarks || ''}">
                </td>
            `;
            tableBody.appendChild(tr);
        });
        renderPagination(paginationControls, pagination);
    }

    async function loadAssets() {
        setLoading(true, tableBody, { colSpan: 5 });
        try {
            const params = new URLSearchParams({
                page: currentPage,
                limit: itemsPerPage,
                search: searchInput.value,
                office: officeFilter.value,
                physicalCount: true, // Tell backend to only get relevant assets
            });
            const data = await fetchWithAuth(`assets?${params}`);

            // Defensive check to handle both paginated (object) and non-paginated (array) responses
            const assets = data?.docs ?? (Array.isArray(data) ? data : []);
            const pagination = data?.docs ? data : {
                docs: assets,
                totalDocs: assets.length,
                totalPages: Math.ceil(assets.length / itemsPerPage),
                currentPage: 1,
                itemsPerPage
            };
            renderTable(assets, pagination);
        } catch (error) {
            console.error('Failed to load assets:', error);
            tableBody.innerHTML = `<tr><td colspan="5" class="text-center p-8 text-red-500">Error loading assets: ${error.message}</td></tr>`;
        }
    }

    // --- EVENT LISTENERS ---
    [searchInput, officeFilter].forEach(el => {
        el.addEventListener('input', () => {
            currentPage = 1;
            loadAssets();
        });
    });

    paginationControls.addEventListener('click', (e) => {
        if (e.target && e.target.id === 'prev-page-btn') {
            if (currentPage > 1) {
                currentPage--;
                loadAssets();
            }
        }
        if (e.target && e.target.id === 'next-page-btn') {
            currentPage++;
            loadAssets();
        }
    });

    document.getElementById('save-count-btn').addEventListener('click', async () => {
        const updates = [];
        const rows = document.querySelectorAll('#physical-count-table-body tr');
        
        rows.forEach(row => {
            if(row.dataset.assetId) {
                const id = row.dataset.assetId;
                const condition = row.querySelector('.condition-input').value;
                const remarks = row.querySelector('.remarks-input').value;
                updates.push({ id, condition, remarks });
            }
        });

        if (updates.length === 0) {
            showToast('No assets to update.', 'warning');
            return;
        }

        try {
            await fetchWithAuth('assets/physical-count', {
                method: 'PUT',
                body: JSON.stringify({
                    updates: updates,
                    user: { name: currentUser.name }
                })
            });

            showToast('Physical count data saved successfully!', 'success');
            await loadAssets(); // Re-fetch current page data
        } catch (error) {
            showToast(`Error: ${error.message}`, 'error');
        }
    });

    // --- INITIALIZATION ---
    initializePage();
}
