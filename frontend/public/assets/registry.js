import { getCurrentUser, gsoLogout } from '../js/auth.js';
import { fetchWithAuth, BASE_URL } from '../js/api.js';
import { createUIManager } from '../js/ui.js';

document.addEventListener('DOMContentLoaded', async () => {
    try {
        const user = await getCurrentUser();
        if (!user) return;

        initializeLayout(user, gsoLogout);
        initializeRegistryPage(user);
    } catch (error) {
        console.error("Authentication failed on registry page:", error);
    }
});

function initializeRegistryPage(user) {
    // --- MODULE: STATE MANAGEMENT ---
    const state = {
        currentPageAssets: [], // Holds only the assets for the current page
        totalAssets: 0,      // Total assets matching the current filter
        allCategories: [],
        allOffices: [],
        allEmployees: [],
        assetsToTransfer: [], // To hold asset objects for the modal
        selectedAssets: [], // Changed from selectedAssetIds to hold {id, cost} objects
        currentPage: 1,
        assetsPerPage: 20,
        sortKey: 'createdAt',
        sortDirection: 'desc',
    };

    // --- MODULE: DOM ELEMENT CACHE ---
    const DOM = {
        searchInput: document.getElementById('search-input'),
        categoryFilter: document.getElementById('category-filter'),
        statusFilter: document.getElementById('status-filter'),
        officeFilter: document.getElementById('office-filter'),
        fundSourceFilter: document.getElementById('fund-source-filter'),
        moreFiltersBtn: document.getElementById('more-filters-btn'),
        advancedFilters: document.getElementById('advanced-filters'),
        resetFiltersBtn: document.getElementById('reset-filters-btn'),
        assignmentFilter: document.getElementById('assignment-filter'),
        startDateFilter: document.getElementById('start-date-filter'),
        endDateFilter: document.getElementById('end-date-filter'),
        paginationControls: document.getElementById('pagination-controls'),
        tableBody: document.getElementById('asset-table-body'),
        selectAllCheckbox: document.getElementById('select-all-assets'),
        tableHeader: document.querySelector('#asset-table-body').parentElement.querySelector('thead'),
        generateParBtn: document.getElementById('generate-par-selected'),
        generateIcsBtn: document.getElementById('generate-ics-selected'),
        transferSelectedBtn: document.getElementById('transfer-selected-btn'),
        transferTooltipWrapper: document.getElementById('transfer-tooltip-wrapper'),
        exportCsvBtn: document.getElementById('export-csv-btn'),
        // Modal elements
        transferModal: document.getElementById('transfer-modal'),
        transferModalTitle: document.getElementById('transfer-modal-title'),
        transferAssetInfo: document.getElementById('transfer-asset-info'),
        transferOfficeSelect: document.getElementById('transfer-modal-office-select'),
        transferCustodianSelect: document.getElementById('transfer-modal-custodian-select'),
        confirmTransferBtn: document.getElementById('confirm-transfer-modal-btn'),
        cancelTransferBtn: document.getElementById('cancel-transfer-modal-btn'),
        transferModalDate: document.getElementById('transfer-modal-date'),
        bulkTransferAssetListContainer: document.getElementById('bulk-transfer-asset-list-container'),
    };

    // --- MODULE: UI MANAGER ---
    const uiManager = createUIManager();

    // --- MODULE: MODAL LOGIC ---
    function openTransferModal(assetIds) {
        if (assetIds.length === 0) {
            uiManager.showToast('Please select at least one asset to transfer.', 'warning');
            return;
        }
        state.assetsToTransfer = state.currentPageAssets.filter(asset => assetIds.includes(asset._id));
        if (state.assetsToTransfer.length !== assetIds.length) {
            // This can happen if an asset is on another page. A more robust solution
            // would be to fetch asset details if not present in currentPageAssets.
            // For now, we'll keep it simple.
            uiManager.showToast('Some selected assets could not be found. Please refresh and try again.', 'error');
            return;
        }

        // Populate modal content based on single vs bulk transfer
        if (assetIds.length > 1) {
            // Bulk transfer
            DOM.transferAssetInfo.classList.add('hidden');
            DOM.bulkTransferAssetListContainer.classList.remove('hidden');
            DOM.transferModalTitle.textContent = `Transfer ${assetIds.length} Assets`;

            const listHTML = state.assetsToTransfer.map(asset =>
                `<div class="text-xs p-1">${asset.propertyNumber} - ${asset.description}</div>`
            ).join('');
            DOM.bulkTransferAssetListContainer.innerHTML = `<p class="font-bold text-sm mb-1">Assets to Transfer:</p>${listHTML}`;
        } else {
            // Single asset transfer
            const asset = state.assetsToTransfer[0];
            DOM.bulkTransferAssetListContainer.classList.add('hidden');
            DOM.transferAssetInfo.classList.remove('hidden');
            DOM.transferModalTitle.textContent = 'Transfer Asset';
            DOM.transferAssetInfo.innerHTML = `
                <strong>Property No:</strong> ${asset.propertyNumber}<br>
                <strong>Description:</strong> ${asset.description}<br>
                <strong>Current Custodian:</strong> ${asset.custodian.name} (${asset.custodian.office})
            `;
        }

        // Populate dropdowns
        DOM.transferOfficeSelect.innerHTML = '<option value="">Select new office...</option>' +
            state.allOffices.map(o => `<option value="${o.name}">${o.name}</option>`).join('');
        DOM.transferCustodianSelect.innerHTML = '<option value="">Select new custodian...</option>' +
            state.allEmployees.map(e => `<option value="${e.name}">${e.name}</option>`).join('');
        DOM.transferCustodianSelect.disabled = false;

        // Set today's date as the default for the transfer
        DOM.transferModalDate.value = new Date().toISOString().split('T')[0];
        DOM.transferModal.showModal();
    }

    // --- MODULE: SLIP MANAGER ---
    const slipManager = {
        prepareForSlipGeneration(slipType) {
            if (state.selectedAssets.length === 0) {
                uiManager.showToast(`Please select at least one asset to generate a ${slipType}.`, 'warning');
                return;
            }

            // NEW CHECK: Ensure selected assets are not already assigned to another slip.
            const alreadyAssignedAssets = state.selectedAssets.filter(asset => asset.assignedPAR || asset.assignedICS);
            if (alreadyAssignedAssets.length > 0) {
                const assignedNumbers = alreadyAssignedAssets.map(a => a.propertyNumber).join(', ');
                uiManager.showToast(`Error: The following assets are already assigned to a slip and cannot be added to a new one: ${assignedNumbers}`, 'error');
                return;
            }
            const firstCustodian = state.selectedAssets[0].custodian.name;
            if (!state.selectedAssets.every(asset => asset.custodian.name === firstCustodian)) {
                uiManager.showToast(`Error: All selected assets must belong to the same custodian to be on one ${slipType}.`, 'error');
                return;
            }
            localStorage.setItem(`assetsFor${slipType}`, JSON.stringify(state.selectedAssets));
            window.location.href = `../slips/${slipType.toLowerCase()}-page.html`;
        }
    };

    // --- MODULE: EXPORT MANAGER ---
    const exportManager = {
        exportToCsv() {
            // This should now trigger a backend download
            const params = new URLSearchParams({
                sort: state.sortKey,
                order: state.sortDirection,
                search: DOM.searchInput.value,
                category: DOM.categoryFilter.value,
                status: DOM.statusFilter.value,
                office: DOM.officeFilter.value,
                fundSource: DOM.fundSourceFilter?.value,
                assignment: DOM.assignmentFilter?.value,
                startDate: DOM.startDateFilter?.value,
                endDate: DOM.endDateFilter?.value
            });

            const exportUrl = `${BASE_URL}/assets/export?${Array.from(params.entries()).filter(([, value]) => value).map(e => e.join('=')).join('&')}`;
            
            // To trigger a download, we can create a temporary link or just navigate.
            // Navigating is simpler. Note: This method may not send auth headers. 
            // The backend must support auth via cookie or query param for this to work.
            window.location.href = exportUrl;
        }
    };

    // --- MODULE: EVENT MANAGER ---
    const eventManager = {
        async handleFilterChange() {
            state.currentPage = 1;
            await loadAssets();
        },

        resetAllFilters() {
            const container = document.getElementById('filter-container');
            if (!container) return;

            container.querySelectorAll('input[type="text"], input[type="date"], select').forEach(el => {
                if (el.tagName === 'SELECT') {
                    el.selectedIndex = 0;
                } else {
                    el.value = '';
                }
            });
            this.handleFilterChange();
        },

        async handlePaginationClick(e) {
            if (e.target.id === 'prev-page-btn' && state.currentPage > 1) state.currentPage--;
            if (e.target.id === 'next-page-btn') state.currentPage++;
            await loadAssets();
        },

        async handleSort(e) {
            const key = e.target.closest('th')?.dataset.sortKey;
            if (!key) return;

            state.sortDirection = (state.sortKey === key && state.sortDirection === 'asc') ? 'desc' : 'asc';
            state.sortKey = key;
            await loadAssets();
        },

        async handleTableClick(e) {
            const editButton = e.target.closest('.edit-btn');
            if (editButton) {
                window.location.href = `./asset-form.html?id=${editButton.dataset.id}`;
                return;
            }
            const propertyCardButton = e.target.closest('.property-card-btn');
            if (propertyCardButton) {
                window.location.href = `../slips/property-card.html?id=${propertyCardButton.dataset.id}`;
                return;
            }
            const transferButton = e.target.closest('.transfer-btn');
            if (transferButton) {
                const assetId = transferButton.dataset.id;
                openTransferModal([assetId]);
                return;
            }
            const deleteButton = e.target.closest('.delete-btn');
            if (deleteButton) {
                uiManager.showConfirmationModal(
                    'Delete Asset',
                    'Are you sure you want to permanently delete this asset?',
                    async () => {
                        try {
                            await fetchWithAuth(`assets/${deleteButton.dataset.id}`, { method: 'DELETE' });
                            uiManager.showToast('Asset deleted successfully.', 'success');
                            await loadAssets(); // Just reload the current view
                        } catch (err) {
                            uiManager.showToast(err.message, 'error');
                        }
                    }
                );
            }
        },

        handleTableChange(e) {
            // This function now delegates the main logic to updateSelectionState
            if (e.target.classList.contains('asset-checkbox')) {
                this.updateSelectionState();
            } else if (e.target.id === 'select-all-assets') {
                this.handleSelectAll(e.target.checked);
                this.updateSelectionState();
            }
        },

        updateSelectionState() {
            const selectedCheckboxes = DOM.tableBody.querySelectorAll('.asset-checkbox:checked');
            const selectedAssetIds = Array.from(selectedCheckboxes).map(cb => cb.dataset.id);

            // Get the full asset objects for the selected IDs and store them in the state
            state.selectedAssets = state.currentPageAssets.filter(asset => selectedAssetIds.includes(asset._id));

            const allCheckboxes = DOM.tableBody.querySelectorAll('.asset-checkbox:not(:disabled)');
            DOM.selectAllCheckbox.checked = allCheckboxes.length > 0 && selectedCheckboxes.length === allCheckboxes.length;

            // Pass the full asset objects to the UI manager
            uiManager.updateSlipButtonVisibility(state.selectedAssets, {
                generateParBtn: DOM.generateParBtn,
                generateIcsBtn: DOM.generateIcsBtn,
                transferSelectedBtn: DOM.transferSelectedBtn,
                transferTooltipWrapper: DOM.transferTooltipWrapper
            });
        },

        handleSelectAll(isChecked) {
            const checkboxes = DOM.tableBody.querySelectorAll('.asset-checkbox:not(:disabled)');
            checkboxes.forEach(checkbox => {
                checkbox.checked = isChecked;
            });
        },

        async handleConfirmTransfer() {
            DOM.confirmTransferBtn.disabled = true;
            DOM.confirmTransferBtn.textContent = 'Transferring...';

            try {
                const newOffice = DOM.transferOfficeSelect.value;
                const newCustodianName = DOM.transferCustodianSelect.value;
                const transferDate = DOM.transferModalDate.value;

                if (!newOffice || !newCustodianName || !transferDate) {
                    throw new Error('Please select a new office, custodian, and transfer date.');
                }

                const selectedEmployee = state.allEmployees.find(emp => emp.name === newCustodianName);
                const newCustodian = { name: newCustodianName, designation: selectedEmployee?.designation || '', office: newOffice };
                const user = { name: currentUser.name, office: currentUser.office };
                const payload = {
                    assetIds: state.assetsToTransfer.map(a => a._id),
                    newOffice,
                    newCustodian,
                    transferDate,
                    user
                };

                const transferResult = await fetchWithAuth('assets/bulk-transfer', {
                    method: 'POST',
                    body: JSON.stringify(payload)
                });

                localStorage.setItem('transferData', JSON.stringify(transferResult.transferDetails));
                window.location.href = '../slips/ptr.html';
                
            } catch (error) {
                uiManager.showToast(`Error: ${error.message}`, 'error');
            } finally {
                DOM.confirmTransferBtn.disabled = false;
                DOM.confirmTransferBtn.textContent = 'Confirm Transfer';
            }
        },

        setupEventListeners() {
            // Standard input/select filters that trigger on 'input'
            const standardFilters = [DOM.searchInput, DOM.categoryFilter, DOM.statusFilter, DOM.officeFilter, DOM.fundSourceFilter, DOM.assignmentFilter];
            standardFilters.forEach(el => el?.addEventListener('input', () => this.handleFilterChange()));

            // The standard 'change' event is more reliable for date pickers that
            // programmatically update an input's value. The custom 'changeDate' event
            // can be less reliable depending on initialization order.
            const dateFilters = [DOM.startDateFilter, DOM.endDateFilter];
            dateFilters.forEach(el => el?.addEventListener('change', () => this.handleFilterChange()));

            DOM.paginationControls?.addEventListener('click', e => this.handlePaginationClick(e));
            DOM.resetFiltersBtn?.addEventListener('click', () => this.resetAllFilters());            
            DOM.tableBody?.parentElement.addEventListener('change', e => this.handleTableChange(e)); // Listen on table for tbody and thead changes
            DOM.tableBody?.addEventListener('click', e => this.handleTableClick(e)); // For edit, delete, etc.
            DOM.tableHeader?.addEventListener('click', (e) => this.handleSort(e));
            DOM.generateParBtn?.addEventListener('click', () => slipManager.prepareForSlipGeneration('PAR'));
            DOM.generateIcsBtn?.addEventListener('click', () => slipManager.prepareForSlipGeneration('ICS'));
            DOM.exportCsvBtn?.addEventListener('click', () => exportManager.exportToCsv());
            DOM.transferSelectedBtn?.addEventListener('click', () => openTransferModal(state.selectedAssets.map(a => a._id)));
            DOM.moreFiltersBtn?.addEventListener('click', () => {
                DOM.advancedFilters.classList.toggle('hidden');
                const isVisible = !DOM.advancedFilters.classList.contains('hidden');
                DOM.moreFiltersBtn.setAttribute('aria-expanded', String(isVisible));
                const icon = DOM.moreFiltersBtn.querySelector('i');
                if (icon) {
                    icon.setAttribute('data-lucide', isVisible ? 'chevron-up' : 'chevron-down');
                    lucide.createIcons();
                }
            });
            // Transfer Modal Listeners
            DOM.confirmTransferBtn?.addEventListener('click', () => this.handleConfirmTransfer());
            DOM.cancelTransferBtn?.addEventListener('click', () => DOM.transferModal.close());
        }
    };

    // --- DATA ORCHESTRATOR ---
    async function loadAssets() {
        uiManager.setLoading(true, DOM.tableBody, { colSpan: 8 });
        DOM.selectAllCheckbox.checked = false;
        eventManager.updateSelectionState(); // Clear selection and update buttons
        try {
            let endDateValue = DOM.endDateFilter?.value;
            if (endDateValue) {
                // Adjust end date to include the entire day for correct filtering
                const date = new Date(endDateValue);
                date.setUTCHours(23, 59, 59, 999);
                endDateValue = date.toISOString();
            }

            const params = {
                currentPage: state.currentPage,
                assetsPerPage: state.assetsPerPage,
                sort: state.sortKey,
                order: state.sortDirection,
                search: DOM.searchInput?.value,
                category: DOM.categoryFilter?.value,
                status: DOM.statusFilter?.value,
                office: DOM.officeFilter?.value,
                fundSource: DOM.fundSourceFilter?.value,
                assignment: DOM.assignmentFilter?.value,
                startDate: DOM.startDateFilter?.value,
                endDate: endDateValue
            };
            
            const queryParams = new URLSearchParams(params);
            const cleanParams = Array.from(queryParams.entries()).filter(([, value]) => value).map(e => e.join('=')).join('&');
            
            const data = await fetchWithAuth(`assets?${cleanParams}`);

            // Defensive check to handle cases where the API might not return the expected pagination object.
            // This prevents errors if `data` is an empty array or an object without a `docs` property.
            const assets = (data && data.docs) ? data.docs : (Array.isArray(data) ? data : []);
            const totalDocs = (data && data.totalDocs) ? data.totalDocs : assets.length;
            const totalPages = (data && data.totalPages) ? data.totalPages : 1;

            state.currentPageAssets = assets;
            state.totalAssets = totalDocs;
            const paginationInfo = { totalDocs, totalPages, currentPage: state.currentPage, assetsPerPage: state.assetsPerPage };
            const domElements = { tableBody: DOM.tableBody, paginationControls: DOM.paginationControls };

            uiManager.renderAssetTable(assets, domElements);
            uiManager.renderPagination(DOM.paginationControls, paginationInfo);
            eventManager.updateSelectionState(); // Update buttons for the new view

            // --- FIX: Manage sort indicators correctly ---
            // This ensures only one sort arrow is visible and on the correct column.
            const headers = DOM.tableHeader.querySelectorAll('th[data-sort-key]');
            headers.forEach(th => {
                // 1. Remove any existing sort indicator icons.
                const existingIcon = th.querySelector('i[data-lucide]');
                if (existingIcon) {
                    existingIcon.remove();
                }

                // 2. Add the indicator to the currently sorted column.
                if (th.dataset.sortKey === state.sortKey) {
                    const iconHTML = `<i data-lucide="${state.sortDirection === 'asc' ? 'arrow-up' : 'arrow-down'}" class="inline-block ml-1 h-4 w-4"></i>`;
                    th.insertAdjacentHTML('beforeend', iconHTML);
                }
            });
            lucide.createIcons(); // Refresh all lucide icons on the page.
        } catch (error) {
            console.error('Failed to load assets:', error);
            DOM.tableBody.innerHTML = `<tr><td colspan="7" class="text-center p-8 text-red-500">Error loading assets: ${error.message}</td></tr>`;
        }
    }

    // --- INITIALIZATION ORCHESTRATOR ---
    async function main() {
        try {
            const [categories, offices, employees] = await Promise.all([
                fetchWithAuth('categories'),
                fetchWithAuth('offices'),
                fetchWithAuth('employees')
            ]);
            state.allCategories = categories;
            state.allOffices = offices;
            state.allEmployees = employees;

            uiManager.populateFilters({ categories, offices }, { categoryFilter: DOM.categoryFilter, officeFilter: DOM.officeFilter });
            eventManager.setupEventListeners();
            await loadAssets();
        } catch (error) {
            console.error('Failed to initialize page:', error);
            DOM.tableBody.innerHTML = `<tr><td colspan="7" class="text-center p-8 text-red-500">Error loading data. Please check the server connection and try again.</td></tr>`;
        }
    }

    main();
}
       