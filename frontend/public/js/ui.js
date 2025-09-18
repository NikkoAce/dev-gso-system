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
        const { page: currentPage, totalPages, totalDocs, limit: itemsPerPage } = pagination;

        if (totalPages <= 1) {
            if (totalDocs > 0) {
                container.innerHTML = `
                    <span class="text-sm text-base-content/70">
                        Showing <span class="font-semibold">1</span>
                        to <span class="font-semibold">${totalDocs}</span>
                        of <span class="font-semibold">${totalDocs}</span> Results
                    </span>
                `;
            }
            return;
        }

        const startItem = (currentPage - 1) * itemsPerPage + 1;
        const endItem = Math.min(currentPage * itemsPerPage, totalDocs);

        const createPageButton = (page) => {
            if (page === '...') return `<button class="btn btn-sm btn-disabled">...</button>`;
            const isActive = page === currentPage ? 'btn-active' : '';
            return `<button class="btn btn-sm page-btn ${isActive}" data-page="${page}">${page}</button>`;
        };

        let paginationHTML = `
            <span class="text-sm text-base-content/70">
                Showing <span class="font-semibold">${startItem}</span>
                to <span class="font-semibold">${endItem}</span>
                of <span class="font-semibold">${totalDocs}</span> Results
            </span>
            <div class="btn-group">
        `;

        paginationHTML += `<button id="prev-page-btn" class="btn btn-sm" ${currentPage === 1 ? 'disabled' : ''}>«</button>`;

        const pages = [];
        const pagesToShow = 1;
        pages.push(1);
        if (currentPage > pagesToShow + 2) pages.push('...');
        for (let i = Math.max(2, currentPage - pagesToShow); i <= Math.min(totalPages - 1, currentPage + pagesToShow); i++) {
            pages.push(i);
        }
        if (currentPage < totalPages - pagesToShow - 1) pages.push('...');
        if (totalPages > 1) pages.push(totalPages);

        const uniquePages = [...new Set(pages)];
        uniquePages.forEach(p => { paginationHTML += createPageButton(p); });

        paginationHTML += `<button id="next-page-btn" class="btn btn-sm" ${currentPage === totalPages ? 'disabled' : ''}>»</button>`;
        paginationHTML += `</div>`;
        container.innerHTML = paginationHTML;
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
    function renderAssetTable(assets, domElements, user) {
        const { tableBody } = domElements;
        tableBody.innerHTML = '';

        if (assets.length === 0) {
            tableBody.innerHTML = `<tr><td colspan="9" class="text-center py-8 text-base-content/70">No assets found for the selected criteria.</td></tr>`;
            return;
        }

        const userPermissions = user?.permissions || [];
        const canUpdate = userPermissions.includes('asset:update');
        const canDelete = userPermissions.includes('asset:delete');
        const canTransfer = userPermissions.includes('asset:transfer');

        const statusMap = {
            'In Use': 'badge-success', // green
            'In Storage': 'badge-info', // blue
            'For Repair': 'badge-warning',
            'Missing': 'badge-error',
            'Waste': 'badge-error',
            'Disposed': 'badge-ghost', // gray
        };
        const statusIconMap = {
            'In Use': 'check-circle',
            'In Storage': 'archive',
            'For Repair': 'wrench',
            'Missing': 'alert-triangle',
            'Waste': 'trash-2',
            'Disposed': 'x-circle',
        };
        const formatDate = (dateString) => dateString ? new Date(dateString).toLocaleDateString('en-CA') : 'N/A';

        assets.forEach(asset => {
            const tr = document.createElement('tr');
            const isAssigned = asset.assignedPAR || asset.assignedICS;
            const assignedTo = isAssigned ? (asset.assignedPAR || asset.assignedICS) : '';
            const assignedIndicator = isAssigned ? `<span class="text-xs text-blue-600 block font-normal">Assigned: ${assignedTo}</span>` : '';
            const icon = statusIconMap[asset.status] || 'help-circle';

            let fullDescription = `<div class="font-medium text-gray-900">${asset.description}</div>`;
            if (asset.specifications && asset.specifications.length > 0) {
                const specsHtml = asset.specifications.map(spec => 
                    `<li><span class="font-semibold">${spec.key}:</span> ${spec.value}</li>`
                ).join('');
                fullDescription += `
                    <div class="collapse collapse-arrow bg-base-200/50 mt-2 rounded-md text-xs">
                        <input type="checkbox" class="min-h-0" /> 
                        <div class="collapse-title min-h-0 py-1 px-3 font-medium">
                            View Specifications
                        </div>
                        <div class="collapse-content px-3">
                            <ul class="mt-1 space-y-1 list-disc list-inside">
                                ${specsHtml}
                            </ul>
                        </div>
                    </div>
                `;
            }
            const statusBadge = `<span class="badge ${statusMap[asset.status] || 'badge-ghost'} badge-sm w-full gap-2">
                                    <i data-lucide="${icon}" class="h-3 w-3"></i>
                                    ${asset.status}
                                 </span>`;

            const editButton = canUpdate ? `<li><button class="edit-btn" data-id="${asset._id}"><i data-lucide="edit"></i> Edit</button></li>` : '';
            const transferButton = canTransfer ? `<li><button class="transfer-btn" data-id="${asset._id}"><i data-lucide="arrow-right-left"></i> Transfer</button></li>` : '';
            const deleteButton = canDelete ? `<li><button class="delete-btn text-red-500" data-id="${asset._id}"><i data-lucide="trash-2"></i> Delete</button></li>` : '';
            const divider = (editButton || transferButton) && deleteButton ? `<div class="divider my-1"></div>` : '';

            tr.innerHTML = `
                <td data-label="Select" class="non-printable"><input type="checkbox" class="asset-checkbox checkbox checkbox-sm" data-id="${asset._id}" data-cost="${asset.acquisitionCost}"></td>
                <td data-label="Property No."><div class="font-mono">${asset.propertyNumber}</div>${assignedIndicator}</td>
                <td data-label="Description">${fullDescription}</td>
                <td data-label="Category">${asset.category}</td>
                <td data-label="Custodian">
                    <div>${asset.custodian.name}</div>
                    <div class="text-xs opacity-70">${asset.custodian.office}</div>
                </td>
                <td data-label="Date Acquired">${formatDate(asset.acquisitionDate)}</td>
                <td data-label="Status">${statusBadge}</td>
                <td data-label="Date Created">${formatDate(asset.createdAt)}</td>
                <td data-label="Actions" class="text-center non-printable">
                    <div class="dropdown dropdown-end">
                        <label tabindex="0" class="btn btn-ghost btn-xs m-1"><i data-lucide="more-vertical"></i></label>
                        <ul tabindex="0" class="dropdown-content z-[1] menu p-2 shadow bg-base-100 rounded-box w-52">
                            ${editButton}
                            <li><a href="../slips/movable-property-card.html?id=${asset._id}" class="property-card-btn flex items-center"><i data-lucide="book-user"></i> Property Card (History)</a></li>
                            <li><a href="../slips/movable-ledger-card.html?id=${asset._id}" class="ledger-card-btn flex items-center"><i data-lucide="book-down"></i> Ledger Card (Depreciation)</a></li>
                            ${transferButton}
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

    /**
     * Shows or hides the action buttons based on selection.
     * @param {Array<object>} selectedAssets - Array of selected asset objects, e.g., [{id, cost}].
     * @param {object} domElements - The DOM elements for the buttons.
     */
    function updateSlipButtonVisibility(selectedAssets, domElements) {
        const { generateParBtn, generateIcsBtn, transferSelectedBtn, transferTooltipWrapper, generateAppendix68Btn, generateIIRUPBtn } = domElements;
        const selectionCount = selectedAssets.length; // selectedAssets now contains full asset objects

        // If nothing is selected, hide all buttons
        if (selectionCount === 0) {
            generateParBtn.classList.add('hidden');
            generateIcsBtn.classList.add('hidden');
            transferSelectedBtn.classList.add('hidden');
            generateAppendix68Btn.classList.add('hidden');
            if (generateIIRUPBtn) generateIIRUPBtn.classList.add('hidden');
            return;
        }

        // --- Transfer Button Logic ---
        const firstAsset = selectedAssets[0];
        const firstCustodian = firstAsset.custodian;

        // Check if all selected assets have the same, non-null custodian.
        const allHaveSameCustodian = firstCustodian && selectedAssets.every(asset =>
            asset.custodian &&
            asset.custodian.name === firstCustodian.name &&
            asset.custodian.office === firstCustodian.office
        );

        transferSelectedBtn.classList.remove('hidden');
        if (allHaveSameCustodian) {
            transferTooltipWrapper.classList.remove('tooltip');
            transferTooltipWrapper.removeAttribute('data-tip');
            transferSelectedBtn.disabled = false;
        } else {
            transferTooltipWrapper.classList.add('tooltip');
            transferTooltipWrapper.dataset.tip = 'Select assets with the same custodian to transfer.';
            transferSelectedBtn.disabled = true;
        }

        const PAR_THRESHOLD = 50000;
        const allAreForPAR = selectedAssets.every(asset => asset.acquisitionCost >= PAR_THRESHOLD);
        const allAreForICS = selectedAssets.every(asset => asset.acquisitionCost < PAR_THRESHOLD);

        // Show PAR button only if ALL selected items are eligible for PAR
        generateParBtn.classList.toggle('hidden', !allAreForPAR);

        // Show ICS button only if ALL selected items are eligible for ICS
        generateIcsBtn.classList.toggle('hidden', !allAreForICS);

        // --- Appendix 68 Button Logic ---
        // Show if any selected assets are candidates for being declared waste.
        const anyAreCandidatesForWaste = selectedAssets.some(asset => ['In Storage', 'For Repair'].includes(asset.status));
        generateAppendix68Btn.classList.toggle('hidden', !anyAreCandidatesForWaste);

        // --- IIRUP Button Logic ---
        if (generateIIRUPBtn) {
            // IIRUP is now for disposing of items that are already declared as waste.
            const anyAreForIIRUP = selectedAssets.some(asset => asset.status === 'Waste');
            generateIIRUPBtn.classList.toggle('hidden', !anyAreForIIRUP);
        }
    }

    return { showToast, populateFilters, setLoading, showConfirmationModal, renderPagination, renderAssetTable, updateSlipButtonVisibility };
}

/**
 * Formats the value of a given input element to include commas for thousands separators.
 * @param {HTMLInputElement} inputElement The input element to format.
 */
export function formatNumberOnInput(inputElement) {
    if (!inputElement) return;

    const originalValue = inputElement.value;
    const originalCursorPos = inputElement.selectionStart;
    const numCommasBefore = (originalValue.match(/,/g) || []).length;

    let value = originalValue.replace(/[^0-9.]/g, '');
    const parts = value.split('.');
    parts[0] = parts[0].replace(/\B(?=(\d{3})+(?!\d))/g, ',');
    if (parts.length > 2) {
        parts.splice(2);
    }
    const formattedValue = parts.join('.');
    const numCommasAfter = (formattedValue.match(/,/g) || []).length;

    inputElement.value = formattedValue;

    const cursorOffset = numCommasAfter - numCommasBefore;
    const newCursorPos = originalCursorPos + cursorOffset;
    if (newCursorPos >= 0) {
        inputElement.setSelectionRange(newCursorPos, newCursorPos);
    }
}

/**
 * Renders a history timeline into a given container.
 * @param {HTMLElement} container - The <ul> element to render the history into.
 * @param {Array<object>} history - The array of history event objects.
 */
export function renderHistory(container, history = []) {
    container.innerHTML = '';
    // Filter out any null or undefined entries in the history array to prevent errors.
    const validHistory = history.filter(Boolean);

    if (validHistory.length === 0) {
        container.innerHTML = '<li>No history records found.</li>';
        return;
    }

    const sortedHistory = [...validHistory].sort((a, b) => new Date(b.date) - new Date(a.date));
    sortedHistory.forEach((entry, index) => {
        const li = document.createElement('li');
        const formattedDate = new Date(entry.date).toLocaleString('en-US', { year: 'numeric', month: 'long', day: 'numeric', hour: '2-digit', minute: '2-digit' });
        const iconMap = {
            'Created': 'plus-circle', 'Updated': 'edit-3', 'Transfer': 'arrow-right-left',
            'Physical Count': 'clipboard-check', 'Assignment': 'user-plus', 'Disposed': 'trash-2',
            'Certified as Waste': 'shield-alert', 'Improvement Added': 'trending-up',
            'Improvement Removed': 'trending-down', 'Repair Added': 'wrench', 'Repair Removed': 'x-circle',
        };
        const icon = iconMap[entry.event] || 'history';
        const alignmentClass = index % 2 === 0 ? 'timeline-start md:text-end' : 'timeline-end';

        li.innerHTML = `
            <div class="timeline-middle"><i data-lucide="${icon}" class="h-5 w-5"></i></div>
            <div class="${alignmentClass} timeline-box">
                <time class="font-mono italic text-xs">${formattedDate}</time>
                <div class="text-lg font-black">${entry.event}</div>
                <p class="text-sm">${entry.details}</p>
                <p class="text-xs text-base-content/70 mt-1">by ${entry.user}</p>
            </div>
            ${index < sortedHistory.length - 1 ? '<hr/>' : ''}
        `;
        container.appendChild(li);
    });
    lucide.createIcons();
}

/**
 * Renders a new row for adding an attachment.
 * @param {HTMLElement} container - The container element to append the new row to.
 */
export function renderNewAttachmentRow(container) {
    const div = document.createElement('div');
    div.className = 'grid grid-cols-[1fr_1fr_auto] gap-2 items-center new-attachment-row';
    div.innerHTML = `
        <input type="file" class="file-input file-input-bordered file-input-sm new-attachment-file" required>
        <input type="text" placeholder="Document Title (required)" class="input input-bordered input-sm new-attachment-title" required>
        <button type="button" class="btn btn-sm btn-ghost text-red-500 remove-new-attachment-btn" title="Remove this attachment"><i data-lucide="x" class="h-4 w-4"></i></button>
    `;
    container.appendChild(div);
    lucide.createIcons();
}

/**
 * Renders the list of existing attachments.
 * @param {object} containers - An object containing the DOM elements.
 * @param {HTMLElement} containers.existingAttachmentsContainer - The main container for the list.
 * @param {HTMLElement} containers.existingAttachmentsList - The <ul> element for the list items.
 * @param {Array<object>} attachments - The array of attachment objects.
 */
export function renderAttachments({ existingAttachmentsContainer, existingAttachmentsList }, attachments = []) {
    if (attachments.length > 0) {
        existingAttachmentsContainer.classList.remove('hidden');
        existingAttachmentsList.innerHTML = '';
        attachments.forEach(att => {
            const li = document.createElement('li');
            li.className = 'flex items-center justify-between text-sm';
            li.innerHTML = `
                <a href="${att.url}" target="_blank" class="link link-primary hover:underline">${att.title || att.originalName}</a>
                <button type="button" class="btn btn-xs btn-ghost text-red-500 remove-attachment-btn" data-key="${att.key}" title="Delete Attachment">
                    <i data-lucide="x" class="h-4 w-4"></i>
                </button>
            `;
            existingAttachmentsList.appendChild(li);
        });
        lucide.createIcons();
    } else {
        existingAttachmentsContainer.classList.add('hidden');
        existingAttachmentsList.innerHTML = '';
    }
}

/**
 * Renders a single repair record row.
 * @param {HTMLElement} container - The container element to append the new row to.
 * @param {object} repair - The repair object to render.
 */
export function renderRepairRow(container, repair) {
    if (!repair) { // Defensive check to prevent errors if a null/undefined repair record is passed.
        console.warn("Attempted to render an undefined or null repair record.");
        return;
    }
    const div = document.createElement('div');
    div.className = 'repair-row p-2 border-b text-sm flex flex-col sm:flex-row justify-between items-start sm:items-center gap-2';
    const repairDate = repair.date ? new Date(repair.date).toISOString().split('T')[0] : '';
    div.innerHTML = `
        <div class="flex-grow">
            <p class="font-semibold">${repair.natureOfRepair}</p>
            <p class="text-xs text-base-content/70">${repairDate}</p>
        </div>
        <div class="flex items-center gap-4 w-full sm:w-auto">
            <p class="text-right flex-grow sm:flex-grow-0 font-semibold">${new Intl.NumberFormat('en-PH', { style: 'currency', currency: 'PHP' }).format(repair.amount)}</p>
            <button type="button" class="btn btn-xs btn-ghost text-red-500 remove-repair-btn" data-repair-id="${repair._id}"><i data-lucide="x" class="h-4 w-4"></i></button>
        </div>
    `;
    container.appendChild(div);
    lucide.createIcons();
}