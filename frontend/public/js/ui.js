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
     * Shows a confirmation modal.
     * @param {string} title - The title of the modal.
     * @param {string} body - The body text of the modal.
     * @param {function} onConfirm - The callback function to execute on confirmation.
     */
    function showConfirmationModal(title, body, onConfirm) {
        const modal = document.getElementById('confirmation-modal');
        if (!modal) return;

        const modalTitle = document.getElementById('modal-title-text');
        const modalBody = document.getElementById('modal-body-text');
        const modalConfirmBtn = document.getElementById('modal-confirm-btn');
        const modalCancelBtn = document.getElementById('modal-cancel-btn');

        modalTitle.textContent = title;
        modalBody.textContent = body;

        // Clone and replace the button to remove old event listeners
        const newConfirmBtn = modalConfirmBtn.cloneNode(true);
        modalConfirmBtn.parentNode.replaceChild(newConfirmBtn, modalConfirmBtn);
        
        newConfirmBtn.addEventListener('click', () => {
            onConfirm();
            modal.close();
        }, { once: true });

        modalCancelBtn.onclick = () => modal.close();
        modal.showModal();
    }

    /**
     * Renders pagination controls.
     * @param {HTMLElement} container - The element to render the controls in.
     * @param {object} pagination - Pagination info { currentPage, totalPages, totalDocs, itemsPerPage }.
     */
    function renderPagination(container, pagination) {
        if (!container) return;
        container.innerHTML = '';
        const { currentPage, totalPages, totalDocs, itemsPerPage } = pagination;

        if (totalPages <= 1) return;

        const startItem = (currentPage - 1) * itemsPerPage + 1;
        const endItem = Math.min(currentPage * itemsPerPage, totalDocs);

        container.innerHTML = `
            <span class="text-sm text-base-content/70">
                Showing <span class="font-semibold">${startItem}</span>
                to <span class="font-semibold">${endItem}</span>
                of <span class="font-semibold">${totalDocs}</span> Results
            </span>
            <div class="btn-group">
                ${currentPage > 1 ? `<button id="prev-page-btn" class="btn btn-sm">Prev</button>` : ''}
                ${currentPage < totalPages ? `<button id="next-page-btn" class="btn btn-sm">Next</button>` : ''}
            </div>
        `;
    }

    /**
     * Displays a loading spinner inside a container.
     * @param {boolean} isLoading - Whether to show or hide the loader.
     * @param {HTMLElement} container - The element to display the loader in.
     * @param {object} options - Configuration options.
     * @param {boolean} [options.isTable=true] - Whether the container is a <tbody>.
     * @param {number} [options.colSpan=1] - The colspan for the table cell if isTable is true.
     */
    function setLoading(isLoading, container, options = {}) {
        const { isTable = true, colSpan = 1 } = options;
        if (!container) return;
        if (isLoading) {
            const loaderHTML = `<div class="flex justify-center items-center p-8"><i data-lucide="loader-2" class="animate-spin h-8 w-8 text-gray-500"></i></div>`;
            container.innerHTML = isTable ? `<tr><td colspan="${colSpan}">${loaderHTML}</td></tr>` : loaderHTML;
            lucide.createIcons();
        }
        // No 'else' case needed, as the container will be overwritten with data.
    }

    /**
     * Renders the main asset table.
     * @param {Array<object>} assets - The array of asset objects for the current page.
     * @param {object} domElements - The DOM elements to update { tableBody }.
     */
    function renderAssetTable(assets, domElements) {
        const { tableBody } = domElements;
        tableBody.innerHTML = '';

        if (assets.length === 0) {
            tableBody.innerHTML = `<tr><td colspan="8" class="text-center py-8 text-base-content/70">No assets found for the selected criteria.</td></tr>`;
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
                <td class="non-printable"><input type="checkbox" class="asset-checkbox checkbox checkbox-sm" data-id="${asset._id}" data-cost="${asset.acquisitionCost}" ${isAssigned ? 'disabled' : ''}></td>
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
    }

    /**
     * Shows or hides the action buttons based on selection.
     * @param {Array<object>} selectedAssets - Array of selected asset objects, e.g., [{id, cost}].
     * @param {object} domElements - The DOM elements for the buttons.
     */
    function updateSlipButtonVisibility(selectedAssets, domElements) {
        const { generateParBtn, generateIcsBtn, transferSelectedBtn } = domElements;
        const selectionCount = selectedAssets.length;

        // If nothing is selected, hide all buttons
        if (selectionCount === 0) {
            generateParBtn.classList.add('hidden');
            generateIcsBtn.classList.add('hidden');
            transferSelectedBtn.classList.add('hidden');
            return;
        }

        // Transfer button is always visible when there's a selection
        transferSelectedBtn.classList.remove('hidden');

        const PAR_THRESHOLD = 50000;
        const allAreForPAR = selectedAssets.every(asset => asset.cost >= PAR_THRESHOLD);
        const allAreForICS = selectedAssets.every(asset => asset.cost < PAR_THRESHOLD);

        // Show PAR button only if ALL selected items are eligible for PAR
        generateParBtn.classList.toggle('hidden', !allAreForPAR);

        // Show ICS button only if ALL selected items are eligible for ICS
        generateIcsBtn.classList.toggle('hidden', !allAreForICS);
    }

    return { showToast, populateFilters, setLoading, showConfirmationModal, renderPagination, renderAssetTable, updateSlipButtonVisibility };
}