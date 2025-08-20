// FILE: frontend/public/js/ui.js

/**
 * A reusable helper to populate a <select> element.
 * @param {HTMLSelectElement} selectElement - The dropdown element to populate.
 * @param {Array<object>} items - The array of items to add as options.
 * @param {string} placeholder - The text for the default, disabled option.
 */
function populateSelect(selectElement, items, placeholder) {
    if (!selectElement) return;
    selectElement.innerHTML = `<option value="">${placeholder}</option>`;
    items.forEach(item => {
        const option = document.createElement('option');
        option.value = item.name; // Assuming 'name' is the value for the option
        option.textContent = item.name;
        selectElement.appendChild(option);
    });
}
/**
 * Creates a UI manager with shared components like toast notifications.
 * @returns {{showToast: function}}
 */
export function createUIManager() {
    const toastContainer = document.getElementById('toast-container');

    /**
     * Displays a toast notification with a message, type, and icon.
     * @param {string} message - The message to display.
     * @param {'info'|'success'|'warning'|'error'} [type='info'] - The type of toast.
     */
    function showToast(message, type = 'info') {
        if (!toastContainer) return;

        const iconMap = {
            success: 'check-circle',
            error: 'x-circle',
            warning: 'alert-triangle',
            info: 'info',
        };

        const alertType = `alert-${type}`;
        const iconName = iconMap[type];

        const toast = document.createElement('div');
        toast.className = `alert ${alertType} shadow-lg flex transition-all duration-500 ease-in-out transform translate-y-[-20px] opacity-0`;
        toast.innerHTML = `
            <i data-lucide="${iconName}" class="h-6 w-6"></i>
            <span>${message}</span>
        `;

        toastContainer.appendChild(toast);
        lucide.createIcons();

        requestAnimationFrame(() => toast.classList.remove('translate-y-[-20px]', 'opacity-0'));
        setTimeout(() => toast.addEventListener('transitionend', () => toast.remove()), 3000);
        setTimeout(() => toast.classList.add('opacity-0'), 2700);
    }

    /**
     * Populates various filter dropdowns from a data object.
     * @param {object} data - An object containing arrays of data, e.g., { categories: [], offices: [] }.
     * @param {object} domElements - An object mapping filter types to their DOM elements.
     */
    function populateFilters(data, domElements) {
        if (domElements.categoryFilter && data.categories) {
            populateSelect(domElements.categoryFilter, data.categories, 'All Categories');
        }
        if (domElements.officeFilter && data.offices) {
            populateSelect(domElements.officeFilter, data.offices, 'All Offices');
        }
    }

    /**
     * Renders the main asset table and its pagination controls.
     * @param {Array<object>} assets - The array of asset objects for the current page.
     * @param {object} pagination - Pagination info { totalDocs, totalPages, currentPage, assetsPerPage }.
     * @param {object} domElements - The DOM elements to update { tableBody, paginationControls }.
     */
    function renderAssetTable(assets, pagination, domElements) {
        const { tableBody, paginationControls } = domElements;
        const { totalDocs, totalPages, currentPage, assetsPerPage } = pagination;

        tableBody.innerHTML = '';
        if (assets.length === 0) {
            tableBody.innerHTML = `<tr><td colspan="8" class="text-center py-8 text-base-content/70">No assets found for the selected criteria.</td></tr>`;
            renderPagination(0, 0, { paginationControls }); // Clear pagination
            return;
        }

        const statusMap = {
            'In Use': 'badge-success',
            'In Storage': 'badge-info',
            'For Repair': 'badge-warning',
            'Disposed': 'badge-error'
        };
        const formatDate = (dateString) => dateString ? new Date(dateString).toLocaleDateString('en-CA') : 'N/A';

        assets.forEach(asset => {
            const tr = document.createElement('tr');
            const isAssigned = asset.assignedPAR || asset.assignedICS;
            const assignedTo = isAssigned ? (asset.assignedPAR || asset.assignedICS) : '';
            const assignedIndicator = isAssigned ? `<span class="text-xs text-blue-600 block font-normal">Assigned: ${assignedTo}</span>` : '';
            const statusBadge = `<span class="badge ${statusMap[asset.status] || 'badge-ghost'} badge-sm">${asset.status}</span>`;

            tr.innerHTML = `
                <td class="non-printable"><input type="checkbox" class="asset-checkbox checkbox checkbox-sm" data-id="${asset._id}" ${isAssigned ? 'disabled' : ''}></td>
                <td><div class="font-mono">${asset.propertyNumber}</div>${assignedIndicator}</td>
                <td>${asset.description}</td>
                <td>${asset.category}</td>
                <td>
                    <div>${asset.custodian.name}</div>
                    <div class="text-xs opacity-70">${asset.custodian.office}</div>
                </td>
                <td>${statusBadge}</td>
                <td>${formatDate(asset.createdAt)}</td>
                <td class="text-center non-printable">
                    <div class="dropdown dropdown-end">
                        <label tabindex="0" class="btn btn-ghost btn-xs m-1"><i data-lucide="more-vertical"></i></label>
                        <ul tabindex="0" class="dropdown-content z-[1] menu p-2 shadow bg-base-100 rounded-box w-52">
                            <li><button class="edit-btn" data-id="${asset._id}"><i data-lucide="edit"></i> Edit</button></li>
                            <li><button class="property-card-btn" data-id="${asset._id}"><i data-lucide="book-user"></i> Property Card</button></li>
                            <li><button class="transfer-btn" data-id="${asset._id}"><i data-lucide="arrow-right-left"></i> Transfer</button></li>
                            <div class="divider my-1"></div>
                            <li><button class="delete-btn text-red-500" data-id="${asset._id}"><i data-lucide="trash-2"></i> Delete</button></li>
                        </ul>
                    </div>
                </td>
            `;
            tableBody.appendChild(tr);
        });

        renderPagination(totalPages, totalDocs, { currentPage, assetsPerPage, paginationControls });
    }

    function renderPagination(totalPages, totalItems, { currentPage, assetsPerPage, paginationControls }) {
        if (!paginationControls) return;
        paginationControls.innerHTML = '';
        if (totalPages <= 1) return;

        const startItem = (currentPage - 1) * assetsPerPage + 1;
        const endItem = Math.min(currentPage * assetsPerPage, totalItems);

        paginationControls.innerHTML = `
            <span class="text-sm text-base-content/70">
                Showing <span class="font-semibold">${startItem}</span>
                to <span class="font-semibold">${endItem}</span>
                of <span class="font-semibold">${totalItems}</span> Results
            </span>
            <div class="btn-group">
                ${currentPage > 1 ? `<button id="prev-page-btn" class="btn btn-sm">Prev</button>` : ''}
                ${currentPage < totalPages ? `<button id="next-page-btn" class="btn btn-sm">Next</button>` : ''}
            </div>
        `;
    }

    function updateSlipButtonVisibility(selectedIds, domElements) {
        const { generateParBtn, generateIcsBtn, transferSelectedBtn } = domElements;
        const hasSelection = selectedIds.length > 0;

        generateParBtn.classList.toggle('hidden', !hasSelection);
        generateIcsBtn.classList.toggle('hidden', !hasSelection);
        transferSelectedBtn.classList.toggle('hidden', !hasSelection);
    }

    return { showToast, populateFilters, setLoading, renderAssetTable, updateSlipButtonVisibility };
}