// FILE: frontend/public/physical-count.js
import { fetchWithAuth } from './api.js';

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
    let allAssets = [];
    let currentPage = 1;
    const itemsPerPage = 20;

    // --- DOM ELEMENTS ---
    const searchInput = document.getElementById('search-input');
    const officeFilter = document.getElementById('office-filter');
    const paginationControls = document.getElementById('pagination-controls');
    const tableBody = document.getElementById('physical-count-table-body');

    // --- DATA FETCHING & RENDERING ---
    async function initializePage() {
        try {
            const [fetchedAssets, offices] = await Promise.all([
                fetchWithAuth('assets'),
                fetchWithAuth('offices')
            ]);

            allAssets = fetchedAssets;
            populateOfficeFilter(offices);
            renderTable();
        } catch (error)
        {
            console.error('Failed to initialize page:', error);
            tableBody.innerHTML = `<tr><td colspan="5" class="text-center p-8 text-red-500">Error loading data.</td></tr>`;
        }
    }

    function populateOfficeFilter(offices) {
        offices.forEach(office => {
            const option = document.createElement('option');
            option.value = office.name;
            option.textContent = office.name;
            officeFilter.appendChild(option);
        });
    }

    function renderTable() {
        const searchTerm = searchInput.value.toLowerCase();
        const selectedOffice = officeFilter.value;

        const filteredAssets = allAssets.filter(asset => {
            const matchesSearch = searchTerm === '' ||
                asset.propertyNumber.toLowerCase().includes(searchTerm) ||
                asset.description.toLowerCase().includes(searchTerm) ||
                (asset.custodian && asset.custodian.name.toLowerCase().includes(searchTerm));
            
            const matchesOffice = selectedOffice === '' || (asset.custodian && asset.custodian.office === selectedOffice);

            return matchesSearch && matchesOffice;
        });

        const totalPages = Math.ceil(filteredAssets.length / itemsPerPage);
        const startIndex = (currentPage - 1) * itemsPerPage;
        const endIndex = startIndex + itemsPerPage;
        const paginatedAssets = filteredAssets.slice(startIndex, endIndex);

        tableBody.innerHTML = '';
        if (paginatedAssets.length === 0) {
            tableBody.innerHTML = `<tr><td colspan="5" class="text-center py-8 text-gray-500">No assets found.</td></tr>`;
            renderPagination(0, 0);
            return;
        }

        paginatedAssets.forEach(asset => {
            const tr = document.createElement('tr');
            tr.className = 'bg-white border-b';
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
                <select class="condition-input w-full border-gray-300 rounded-md shadow-sm text-sm">
                    <option value="">Select...</option>
                    ${conditionOptions.map(opt => `<option value="${opt}" ${asset.condition === opt ? 'selected' : ''}>${opt}</option>`).join('')}
                </select>
            `;

            tr.innerHTML = `
                <td class="px-6 py-4 font-medium">${asset.propertyNumber}</td>
                <td class="px-6 py-4">${fullDescription}</td>
                <td class="px-6 py-4">${custodianDisplay}</td>
                <td class="px-6 py-4">${selectHTML}</td>
                <td class="px-6 py-4">
                    <input type="text" class="remarks-input w-full border-gray-300 rounded-md shadow-sm text-sm" value="${asset.remarks || ''}">
                </td>
            `;
            tableBody.appendChild(tr);
        });
        renderPagination(totalPages, filteredAssets.length);
    }
    
    function renderPagination(totalPages, totalItems) {
        paginationControls.innerHTML = '';
        if (totalPages <= 1) return;

        let paginationHTML = `
            <span class="text-sm text-gray-700">
                Showing <span class="font-semibold">${((currentPage - 1) * itemsPerPage) + 1}</span>
                to <span class="font-semibold">${Math.min(currentPage * itemsPerPage, totalItems)}</span>
                of <span class="font-semibold">${totalItems}</span> Results
            </span>
            <div class="inline-flex mt-2 xs:mt-0">
        `;
        
        if (currentPage > 1) {
            paginationHTML += `<button id="prev-page-btn" class="px-4 py-2 text-sm font-medium text-white bg-gray-800 rounded-l hover:bg-gray-900">Prev</button>`;
        }
        if (currentPage < totalPages) {
            paginationHTML += `<button id="next-page-btn" class="px-4 py-2 text-sm font-medium text-white bg-gray-800 border-0 border-l border-gray-700 rounded-r hover:bg-gray-900">Next</button>`;
        }
        
        paginationHTML += `</div>`;
        paginationControls.innerHTML = paginationHTML;
    }

    // --- EVENT LISTENERS ---
    [searchInput, officeFilter].forEach(el => {
        el.addEventListener('input', () => {
            currentPage = 1;
            renderTable();
        });
    });

    paginationControls.addEventListener('click', (e) => {
        if (e.target && e.target.id === 'prev-page-btn') {
            if (currentPage > 1) {
                currentPage--;
                renderTable();
            }
        }
        if (e.target && e.target.id === 'next-page-btn') {
            currentPage++;
            renderTable();
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
            alert('No assets to update.');
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

            alert('Physical count data saved successfully!');
            await initializePage(); // Re-fetch all assets to get the latest data
            renderTable(); // Re-render the table with the latest data
        } catch (error) {
            alert(`Error: ${error.message}`);
        }
    });

    // --- INITIALIZATION ---
    initializePage();
}
