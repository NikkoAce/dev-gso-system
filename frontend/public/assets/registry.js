import { getGsoToken } from '../js/auth.js';
import { fetchWithAuth, BASE_URL } from '../js/api.js';
import { createUIManager } from '../js/ui.js';
import { createAuthenticatedPage } from '../js/page-loader.js';

createAuthenticatedPage({
    permission: 'asset:read',
    pageInitializer: initializeRegistryPage,
    pageName: 'Asset Registry'
});

function initializeRegistryPage(user) {
    // --- MODULE: STATE MANAGEMENT ---
    const state = {
        currentPageAssets: [], // Holds only the assets for the current page
        totalAssets: 0,      // Total assets matching the current filter
        allCategories: [],
        allOffices: [],
        allEmployees: [],
        assetsToTransfer: [], // To hold asset objects for the transfer modal
        selectedAssets: new Map(), // Use a Map to persist selection across pages. Key: assetId, Value: asset object
        currentPage: 1,
        assetsPerPage: 50,
        sortKey: 'createdAt',
        sortDirection: 'desc',
        totalPages: 1,
    };

    // --- MODULE: DOM ELEMENT CACHE ---
    const DOM = {
        searchInput: document.getElementById('search-input'),
        toggleFiltersBtn: document.getElementById('toggle-filters-btn'),
        filtersGrid: document.getElementById('filters-grid'),
        categoryFilter: document.getElementById('category-filter'),
        statusFilter: document.getElementById('status-filter'),
        conditionFilter: document.getElementById('condition-filter'), // NEW
        officeFilter: document.getElementById('office-filter'),
        fundSourceFilter: document.getElementById('fund-source-filter'),
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
        addAssetBtn: document.getElementById('add-asset-btn'), // NEW
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
        generateAppendix68Btn: document.getElementById('generate-appendix68-btn'),
        generateIIRUPBtn: document.getElementById('generate-iirup-btn'),
        appendix68Modal: document.getElementById('appendix68-modal'),
        appendix68AssetListContainer: document.getElementById('appendix68-asset-list-container'),
        confirmAppendix68Btn: document.getElementById('confirm-appendix68-modal-btn'),
        cancelAppendix68Btn: document.getElementById('cancel-appendix68-modal-btn'),
        assetTableFooter: document.getElementById('asset-table-footer'),
        // Import Modal elements
        importModal: document.getElementById('import-modal'),
        importCsvBtn: document.getElementById('import-csv-btn'),
        cancelImportBtn: document.getElementById('cancel-import-btn'),
        confirmImportBtn: document.getElementById('confirm-import-btn'),
        csvFileInput: document.getElementById('csv-file-input'),
        importResultsContainer: document.getElementById('import-results-container'),
        importSummaryMessage: document.getElementById('import-summary-message'),
        importErrorList: document.getElementById('import-error-list'),
        downloadTemplateBtn: document.getElementById('download-template-btn'),
        selectionSummaryBar: document.getElementById('selection-summary-bar'),
        selectionCount: document.getElementById('selection-count'),
        selectionTotalValue: document.getElementById('selection-total-value'),
        clearSelectionBtn: document.getElementById('clear-selection-btn'),
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

    function openAppendix68Modal() {
        // The button is only visible if there are eligible assets.
        const eligibleAssets = Array.from(state.selectedAssets.values()).filter(a => ['In Storage', 'For Repair'].includes(a.status));
        if (eligibleAssets.length === 0) {
            uiManager.showToast('Please select at least one asset that is "In Storage" or "For Repair".', 'warning');
            return;
        }

        const listHTML = eligibleAssets.map(asset =>
            `<div class="text-xs p-1">${asset.propertyNumber} - ${asset.description}</div>`
        ).join('');

        DOM.appendix68AssetListContainer.innerHTML = `<p class="font-bold text-sm mb-1">Assets to be included:</p>${listHTML}`;
        DOM.appendix68Modal.showModal();
    }

    function closeAppendix68Modal() {
        DOM.appendix68Modal.close();
    }

    // --- MODULE: SLIP MANAGER ---
    const slipManager = {
        prepareForSlipGeneration(slipType) {
            const selectedAssetsArray = Array.from(state.selectedAssets.values());
            if (selectedAssetsArray.length === 0) {
                uiManager.showToast(`Please select at least one asset to generate a ${slipType}.`, 'warning');
                return;
            }

            // For PAR and ICS, all assets must belong to the same custodian and not be assigned to another slip.
            if (slipType === 'PAR' || slipType === 'ICS') {
                const alreadyAssignedAssets = selectedAssetsArray.filter(asset => asset.assignedPAR || asset.assignedICS);
                if (alreadyAssignedAssets.length > 0) {
                    const assignedNumbers = alreadyAssignedAssets.map(a => a.propertyNumber).join(', ');
                    uiManager.showToast(`Error: The following assets are already assigned to a slip and cannot be added to a new one: ${assignedNumbers}`, 'error');
                    return;
                }
                const firstCustodian = selectedAssetsArray[0].custodian.name;
                if (!selectedAssetsArray.every(asset => asset.custodian.name === firstCustodian)) {
                    uiManager.showToast(`Error: All selected assets must belong to the same custodian to be on one ${slipType}.`, 'error');
                    return;
                }
            }

            // For IIRUP and Appendix 68, the custodian check is not needed as they are GSO-level documents.
            // The visibility logic in ui.js already ensures the correct assets are selected based on status.
            localStorage.setItem(`assetsFor${slipType}`, JSON.stringify(selectedAssetsArray));
            window.location.href = `../slips/${slipType.toLowerCase()}-page.html`;
        }
    };

    // --- MODULE: EXPORT MANAGER ---
    const exportManager = {
        async exportToCsv() {
            DOM.exportCsvBtn.disabled = true;
            DOM.exportCsvBtn.innerHTML = `<span class="loading loading-spinner loading-xs"></span> Exporting...`;

            try {
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
                
                const token = getGsoToken();
                if (!token) {
                    throw new Error('Authentication token not found.');
                }

                const response = await fetch(exportUrl, {
                    headers: {
                        'Authorization': `Bearer ${token}`
                    }
                });

                if (!response.ok) {
                    const errorData = await response.json().catch(() => ({ message: `HTTP error! Status: ${response.status}` }));
                    throw new Error(errorData.message || `Failed to export data. Status: ${response.status}`);
                }

                const blob = await response.blob();
                const url = window.URL.createObjectURL(blob);
                const a = document.createElement('a');
                a.style.display = 'none';
                a.href = url;
                a.download = 'assets_export.csv';
                document.body.appendChild(a);
                a.click();
                window.URL.revokeObjectURL(url);
                a.remove();

            } catch (error) {
                uiManager.showToast(`Export failed: ${error.message}`, 'error');
            } finally {
                DOM.exportCsvBtn.disabled = false;
                DOM.exportCsvBtn.innerHTML = `<i data-lucide="download" class="h-5 w-5"></i> Export`;
                lucide.createIcons();
            }
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
            const target = e.target.closest('button');
            if (!target) return;

            const originalPage = state.currentPage;

            if (target.id === 'prev-page-btn' && state.currentPage > 1) {
                state.currentPage--;
            } else if (target.id === 'next-page-btn' && state.currentPage < state.totalPages) {
                state.currentPage++;
            } else if (target.classList.contains('page-btn')) {
                state.currentPage = parseInt(target.dataset.page, 10);
            }

            if (originalPage !== state.currentPage)
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
            // The ledger card is now a link, so it doesn't need a click handler here.
            // The browser will handle the navigation via the <a> tag in ui.js.
            if (e.target.closest('.ledger-card-btn')) {
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

        handleTableChange(e) { // For checkbox clicks
            const checkbox = e.target.closest('.asset-checkbox');
            if (checkbox) {
                const assetId = checkbox.dataset.id;
                const asset = state.currentPageAssets.find(a => a._id === assetId);
                if (checkbox.checked && asset) {
                    state.selectedAssets.set(assetId, asset);
                } else {
                    state.selectedAssets.delete(assetId);
                }
                this.updateSelectionState();
            }

            if (e.target.id === 'select-all-assets') {
                this.handleSelectAll(e.target.checked);
                this.updateSelectionState();
            }
        },

        updateSelectionState() {
        const selectedAssetsArray = Array.from(state.selectedAssets.values());

        // Update select-all checkbox state based on current page's assets
        const selectionCount = selectedAssetsArray.length;

        // NEW: Update summary bar
        const totalValue = selectedAssetsArray.reduce((sum, asset) => sum + (asset.acquisitionCost || 0), 0);
        DOM.selectionSummaryBar.classList.toggle('hidden', selectionCount === 0);
        DOM.clearSelectionBtn.classList.toggle('hidden', selectionCount === 0);
        if (selectionCount > 0) {
            DOM.selectionCount.textContent = selectionCount;
            DOM.selectionTotalValue.textContent = new Intl.NumberFormat('en-PH', { style: 'currency', currency: 'PHP' }).format(totalValue);
        }

        const allCheckboxesOnPage = DOM.tableBody.querySelectorAll('.asset-checkbox:not(:disabled)');
        const selectedOnPageCount = Array.from(allCheckboxesOnPage).filter(cb => state.selectedAssets.has(cb.dataset.id)).length;

        if (allCheckboxesOnPage.length > 0) {
            if (selectedOnPageCount === allCheckboxesOnPage.length) {
                DOM.selectAllCheckbox.checked = true;
                DOM.selectAllCheckbox.indeterminate = false;
            } else if (selectedOnPageCount > 0) {
                DOM.selectAllCheckbox.checked = false;
                DOM.selectAllCheckbox.indeterminate = true;
            } else {
                DOM.selectAllCheckbox.checked = false;
                DOM.selectAllCheckbox.indeterminate = false;
            }
        } else {
            DOM.selectAllCheckbox.checked = false;
            DOM.selectAllCheckbox.indeterminate = false;
        }

            // Pass the full asset objects to the UI manager
        uiManager.updateSlipButtonVisibility(selectedAssetsArray, {
                generateParBtn: DOM.generateParBtn,
                generateIcsBtn: DOM.generateIcsBtn,
                transferSelectedBtn: DOM.transferSelectedBtn,
                transferTooltipWrapper: DOM.transferTooltipWrapper,
                generateAppendix68Btn: DOM.generateAppendix68Btn,
                generateIIRUPBtn: DOM.generateIIRUPBtn
            });
        },

        handleSelectAll(isChecked) {
        const checkboxesOnPage = DOM.tableBody.querySelectorAll('.asset-checkbox:not(:disabled)');
        checkboxesOnPage.forEach(checkbox => {
            const assetId = checkbox.dataset.id;
            const asset = state.currentPageAssets.find(a => a._id === assetId);
            if (asset) {
                if (isChecked) {
                    checkbox.checked = true;
                    state.selectedAssets.set(assetId, asset);
                } else {
                    checkbox.checked = false;
                    state.selectedAssets.delete(assetId);
                }
            }
            });
        },

        clearSelection() {
            state.selectedAssets.clear();
            // Re-render the table to remove highlights and update checkbox states visually.
            // This is cleaner than manually manipulating row styles.
            renderAssetTable(state.currentPageAssets);
            // Update the UI state (hide buttons, summary bar, and update select-all checkbox).
            this.updateSelectionState();
        },


        async handleConfirmTransfer() {
            const newOffice = DOM.transferOfficeSelect.value;
            const newCustodianName = DOM.transferCustodianSelect.value;

            if (!newOffice || !newCustodianName) {
                uiManager.showToast('Please select a new office and custodian.', 'warning');
                return;
            }

            const selectedEmployee = state.allEmployees.find(emp => emp.name === newCustodianName);
            if (!selectedEmployee) {
                uiManager.showToast('Selected custodian not found.', 'error');
                return;
            }

            const fromCustodian = state.assetsToTransfer[0].custodian;

            const transferData = {
                assetsToDisplay: state.assetsToTransfer,
                fromCustodian: fromCustodian,
                newCustodian: { name: selectedEmployee.name, designation: selectedEmployee.designation },
                newOffice: newOffice
            };

            localStorage.setItem('transferData', JSON.stringify(transferData));
            try {
                window.location.href = '../slips/ptr.html';
                
            } catch (error) {
                uiManager.showToast(`Error: ${error.message}`, 'error');
            } finally {
                DOM.confirmTransferBtn.disabled = false;
                DOM.confirmTransferBtn.textContent = 'Confirm Transfer';
            }
        },

        async handleConfirmAppendix68() {
            DOM.confirmAppendix68Btn.disabled = true;
            DOM.confirmAppendix68Btn.innerHTML = `<span class="loading loading-spinner loading-xs"></span> Generating...`;

            try {                
                // Get the full asset objects that are eligible
                const eligibleAssets = Array.from(state.selectedAssets.values()).filter(a => ['In Storage', 'For Repair'].includes(a.status));
                
                if (eligibleAssets.length === 0) {
                    uiManager.showToast('No eligible assets selected for Appendix 68.', 'warning');
                    return;
                }
        
                // Use the 'create' flow, consistent with other slips, by passing the full asset objects.
                // The key 'assetsForA68' matches the config in appendix68-page.js
                localStorage.setItem('assetsForA68', JSON.stringify(eligibleAssets));
                window.location.href = '../slips/appendix68-page.html';

            } catch (error) {
                uiManager.showToast(`Error: ${error.message}`, 'error');
            } finally {
                DOM.confirmAppendix68Btn.disabled = false;
                DOM.confirmAppendix68Btn.textContent = 'Confirm & Generate';
            }
        },

        async handleDownloadTemplate() {
            const originalContent = DOM.downloadTemplateBtn.innerHTML;
            DOM.downloadTemplateBtn.classList.add('disabled'); // Using a class to prevent clicks
            DOM.downloadTemplateBtn.innerHTML = `<span class="loading loading-spinner loading-xs"></span> Downloading...`;
            try {
                const token = getGsoToken();
                if (!token) {
                    throw new Error('Authentication token not found.');
                }

                const response = await fetch(`${BASE_URL}/assets/import/template`, {
                    headers: { 'Authorization': `Bearer ${token}` }
                });

                if (!response.ok) {
                    throw new Error(`Failed to download template. Status: ${response.status}`);
                }

                const blob = await response.blob();
                const url = window.URL.createObjectURL(blob);
                const a = document.createElement('a');
                a.style.display = 'none';
                a.href = url;
                a.download = 'asset_import_template.csv';
                document.body.appendChild(a);
                a.click();
                window.URL.revokeObjectURL(url);
                a.remove();
            } catch (error) {
                uiManager.showToast(`Download failed: ${error.message}`, 'error');
            } finally {
                DOM.downloadTemplateBtn.classList.remove('disabled');
                DOM.downloadTemplateBtn.innerHTML = originalContent;
            }
        },

        async handleImportCsv() {
            const file = DOM.csvFileInput.files[0];
            if (!file) {
                uiManager.showToast('Please select a CSV file to import.', 'warning');
                return;
            }
        
            DOM.confirmImportBtn.disabled = true;
            DOM.confirmImportBtn.innerHTML = `<span class="loading loading-spinner loading-xs"></span> Importing...`;
            DOM.importResultsContainer.classList.add('hidden');
        
            const formData = new FormData();
            formData.append('csvfile', file);
        
            try {
                const result = await fetchWithAuth('assets/import', {
                    method: 'POST',
                    body: formData,
                });
        
                DOM.importResultsContainer.classList.remove('hidden');
                DOM.importSummaryMessage.textContent = result.message;
                DOM.importErrorList.innerHTML = ''; // Clear previous errors
        
                if (result.errors && result.errors.length > 0) {
                    DOM.importSummaryMessage.classList.add('text-error');
                    const errorHtml = result.errors.map(err => `<li>Row ${err.row}: ${err.message}</li>`).join('');
                    DOM.importErrorList.innerHTML = errorHtml;
                } else {
                    DOM.importSummaryMessage.classList.remove('text-error');
                    DOM.importSummaryMessage.classList.add('text-success');
                    setTimeout(() => {
                        DOM.importModal.close();
                        loadAssets(); // Reload the asset list
                    }, 2000);
                }
        
            } catch (error) {
                // Display detailed errors in the modal if available
                DOM.importResultsContainer.classList.remove('hidden');
                DOM.importSummaryMessage.textContent = error.message;
                DOM.importSummaryMessage.classList.remove('text-success');
                DOM.importSummaryMessage.classList.add('text-error');
                DOM.importErrorList.innerHTML = '';

                if (error.details && error.details.length > 0) {
                    const errorHtml = error.details.map(err => `<li>Row ${err.row}: ${err.message}</li>`).join('');
                    DOM.importErrorList.innerHTML = errorHtml;
                }
            } finally {
                DOM.confirmImportBtn.disabled = false;
                DOM.confirmImportBtn.innerHTML = 'Upload & Import';
            }
        },

        setupEventListeners() {
            // Standard input/select filters that trigger on 'input'
            const standardFilters = [DOM.searchInput, DOM.categoryFilter, DOM.statusFilter, DOM.conditionFilter, DOM.officeFilter, DOM.fundSourceFilter, DOM.assignmentFilter];
            standardFilters.forEach(el => el?.addEventListener('input', () => this.handleFilterChange()));

            // The standard 'change' event is more reliable for date pickers that
            // programmatically update an input's value.
            // can be less reliable depending on initialization order.
            const dateFilters = [DOM.startDateFilter, DOM.endDateFilter];
            dateFilters.forEach(el => el?.addEventListener('change', () => this.handleFilterChange()));

            // NEW: Collapsible filter panel
            DOM.toggleFiltersBtn?.addEventListener('click', () => {
                DOM.filtersGrid.classList.toggle('hidden');
            });
            DOM.paginationControls?.addEventListener('click', e => this.handlePaginationClick(e));
            DOM.resetFiltersBtn?.addEventListener('click', () => this.resetAllFilters());            
            DOM.tableBody?.parentElement.addEventListener('change', e => this.handleTableChange(e)); // Listen on table for checkbox changes
            DOM.tableBody?.addEventListener('click', e => this.handleTableClick(e)); // For edit, delete, etc.
            DOM.tableHeader?.addEventListener('click', (e) => this.handleSort(e));
            DOM.generateParBtn?.addEventListener('click', () => slipManager.prepareForSlipGeneration('PAR'));
            DOM.generateIcsBtn?.addEventListener('click', () => slipManager.prepareForSlipGeneration('ICS'));
            DOM.generateIIRUPBtn?.addEventListener('click', () => slipManager.prepareForSlipGeneration('IIRUP'));
            DOM.exportCsvBtn?.addEventListener('click', () => exportManager.exportToCsv());
            DOM.transferSelectedBtn?.addEventListener('click', () => openTransferModal(Array.from(state.selectedAssets.keys())));
            // Transfer Modal Listeners
            DOM.clearSelectionBtn?.addEventListener('click', () => this.clearSelection());
            DOM.confirmTransferBtn?.addEventListener('click', () => this.handleConfirmTransfer());
            DOM.cancelTransferBtn?.addEventListener('click', () => DOM.transferModal.close());
            // Appendix 68 Modal Listeners
            DOM.generateAppendix68Btn?.addEventListener('click', openAppendix68Modal);
            DOM.confirmAppendix68Btn?.addEventListener('click', () => this.handleConfirmAppendix68());
            DOM.cancelAppendix68Btn?.addEventListener('click', closeAppendix68Modal);
            // Import Modal Listeners
            DOM.importCsvBtn?.addEventListener('click', () => {
                DOM.importResultsContainer.classList.add('hidden');
                DOM.csvFileInput.value = ''; // Reset file input
                DOM.importModal.showModal();
            });
            DOM.cancelImportBtn?.addEventListener('click', () => DOM.importModal.close());
            DOM.confirmImportBtn?.addEventListener('click', () => this.handleImportCsv());
            DOM.downloadTemplateBtn?.addEventListener('click', (e) => { 
                e.preventDefault(); this.handleDownloadTemplate(); 
            });
        }
    };

    // --- DATA ORCHESTRATOR ---
    async function loadAssets() {
        uiManager.setLoading(true, DOM.tableBody, { colSpan: 9 });
        try {
            let endDateValue = DOM.endDateFilter?.value;
            if (endDateValue) {
                // Adjust end date to include the entire day for correct filtering
                const date = new Date(endDateValue);
                date.setUTCHours(23, 59, 59, 999);
                endDateValue = date.toISOString();
            }

            const params = {
                page: state.currentPage,
                limit: state.assetsPerPage,
                sort: state.sortKey,
                order: state.sortDirection,
                search: DOM.searchInput?.value,
                category: DOM.categoryFilter?.value,
                status: DOM.statusFilter?.value,
                condition: DOM.conditionFilter?.value, // NEW
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
            state.totalPages = (data && data.totalPages) ? data.totalPages : 1;
            const totalValue = data?.totalValue || 0;

            state.currentPageAssets = assets;
            state.totalAssets = totalDocs;
            const paginationInfo = {
                totalDocs,
                totalPages: state.totalPages,
                page: state.currentPage,
                limit: state.assetsPerPage
            };

            renderAssetTable(assets);
            uiManager.renderPagination(DOM.paginationControls, paginationInfo);
            renderSummary(totalValue);
            renderSummary(totalValue);
            eventManager.updateSelectionState(); // Update buttons for the new view
        } catch (error) {
            console.error('Failed to load assets:', error);
            DOM.tableBody.innerHTML = `<tr><td colspan="9" class="text-center p-8 text-red-500">Error loading assets: ${error.message}</td></tr>`;
        }
    }
    
    function renderAssetTable(assets) {
        DOM.tableBody.innerHTML = '';
        if (!assets || assets.length === 0) {
            DOM.tableBody.innerHTML = `<tr><td colspan="9" class="text-center py-8 text-gray-500">No assets found for the selected criteria.</td></tr>`;
            return;
        }
    
        // ADDED: Status and Icon maps for better visual cues
        const statusMap = {
            'In Use': 'badge-success', 'In Storage': 'badge-info', 'For Repair': 'badge-warning',
            'Missing': 'badge-error', 'Waste': 'badge-error', 'Disposed': 'badge-ghost',
        };
        const statusIconMap = {
            'In Use': 'check-circle', 'In Storage': 'archive', 'For Repair': 'wrench',
            'Missing': 'alert-triangle', 'Waste': 'trash-2', 'Disposed': 'x-circle',
        };

        const canUpdate = user.permissions.includes('asset:update');
        const canDelete = user.permissions.includes('asset:delete');
    
        assets.forEach(asset => {
            const isSelected = state.selectedAssets.has(asset._id);
            const tr = document.createElement('tr');
            if (isSelected) {
                tr.classList.add('bg-blue-50', 'hover:bg-blue-100');
            }

            // ADDED: Assigned slip indicator
            const isAssigned = asset.assignedPAR || asset.assignedICS;
            const assignedTo = isAssigned ? (asset.assignedPAR || asset.assignedICS) : '';
            const assignedIndicator = isAssigned ? `<span class="text-xs text-blue-600 block font-normal">Assigned: ${assignedTo}</span>` : '';
    
            const propertyCardLink = `<li><a href="../slips/movable-property-card.html?id=${asset._id}"><i data-lucide="book-user"></i>View Property Card</a></li>`;
            const ledgerCardLink = `<li><a href="../slips/movable-ledger-card.html?id=${asset._id}"><i data-lucide="book-open-check"></i>View Ledger Card</a></li>`;
            const editLink = canUpdate ? `<li><a href="./asset-form.html?id=${asset._id}" class="edit-btn"><i data-lucide="edit"></i>Edit</a></li>` : '';
            const transferButton = canUpdate ? `<li><button class="transfer-btn" data-id="${asset._id}"><i data-lucide="arrow-right-left"></i>Transfer</button></li>` : '';
            const deleteButton = canDelete ? `<div class="divider my-1"></div><li><button class="delete-btn text-error" data-id="${asset._id}"><i data-lucide="trash-2"></i>Delete</button></li>` : '';

            const dropdownActions = `
                <div class="dropdown dropdown-end">
                    <label tabindex="0" class="btn btn-ghost btn-xs">
                        <i data-lucide="more-vertical" class="h-4 w-4"></i>
                    </label>
                    <ul tabindex="0" class="dropdown-content z-[1] menu p-2 shadow bg-base-100 rounded-box w-52">
                        ${propertyCardLink}
                        ${ledgerCardLink}
                        ${editLink}
                        ${transferButton}
                        ${deleteButton}
                    </ul>
                </div>
            `;

            // ADDED: Collapsible specifications for a cleaner look
            let fullDescription = `<div class="font-medium text-gray-900">${asset.description}</div>`;
            if (asset.specifications && asset.specifications.length > 0) {
                const specsHtml = asset.specifications.map(spec => `<li><span class="font-semibold">${spec.key}:</span> ${spec.value}</li>`).join('');
                fullDescription += `
                    <div class="collapse collapse-arrow bg-base-200/50 mt-2 rounded-md text-xs">
                        <input type="checkbox" class="min-h-0" /> 
                        <div class="collapse-title min-h-0 py-1 px-3 font-medium">View Specifications</div>
                        <div class="collapse-content px-3"><ul class="mt-1 space-y-1 list-disc list-inside">${specsHtml}</ul></div>
                    </div>
                `;
            }

            // ADDED: Custodian with office for more context
            let custodianDisplay = 'N/A';
            if (asset.custodian && asset.custodian.name) {
                custodianDisplay = `
                    <div>${asset.custodian.name}</div>
                    <div class="text-xs opacity-70">${asset.custodian.office || ''}</div>
                `;
            }

            // ADDED: Status badge with icon for better visual distinction
            const icon = statusIconMap[asset.status] || 'help-circle';
            const statusBadge = `<span class="badge ${statusMap[asset.status] || 'badge-ghost'} badge-sm w-full gap-2">
                                    <i data-lucide="${icon}" class="h-3 w-3"></i>
                                    ${asset.status}
                                 </span>`;

            tr.innerHTML = `
                <td class="non-printable" data-label="Select"><input type="checkbox" class="asset-checkbox checkbox checkbox-sm" data-id="${asset._id}" ${isSelected ? 'checked' : ''}></td>
                <td data-label="Property No."><div class="font-mono">${asset.propertyNumber}</div>${assignedIndicator}</td>
                <td data-label="Description">${fullDescription}</td>
                <td data-label="Category">${asset.category}</td>
                <td data-label="Custodian">${custodianDisplay}</td>
                <td data-label="Date Acquired">${new Date(asset.acquisitionDate).toLocaleDateString()}</td>
                <td data-label="Status">${statusBadge}</td>
                <td data-label="Date Created">${new Date(asset.createdAt).toLocaleDateString()}</td>
                <td class="text-center non-printable" data-label="Actions">
                    ${dropdownActions}
                </td>
            `;
            DOM.tableBody.appendChild(tr);
        });
        lucide.createIcons();
    }

    function renderSummary(totalValue) {
        const formatCurrency = (value) => new Intl.NumberFormat('en-PH', { style: 'currency', currency: 'PHP' }).format(value || 0);
        if (totalValue > 0) {
            DOM.assetTableFooter.innerHTML = `<tr><td colspan="5" class="text-right font-bold">Total Value (All Filtered Pages):</td><td class="text-right font-bold">${formatCurrency(totalValue)}</td><td colspan="3"></td></tr>`;
        } else {
            DOM.assetTableFooter.innerHTML = '';
        }
    }

    /**
     * Checks for filter parameters in the URL, applies them to the filter controls,
     * and then cleans the URL. This enables drill-down from other pages.
     */
    function applyUrlFilters() {
        const urlParams = new URLSearchParams(window.location.search);
        let hasUrlFilters = false;

        const filterMap = {
            startDate: DOM.startDateFilter,
            endDate: DOM.endDateFilter,
            office: DOM.officeFilter,
            status: DOM.statusFilter,
            condition: DOM.conditionFilter
        };

        for (const [param, element] of Object.entries(filterMap)) {
            if (urlParams.has(param) && element) {
                element.value = urlParams.get(param);
                hasUrlFilters = true;
            }
        }
        // Clean the URL to avoid confusion on subsequent manual filtering
        if (hasUrlFilters) {
            window.history.replaceState({}, document.title, window.location.pathname);
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
            applyUrlFilters(); // Apply filters from URL before loading

            // NEW: Hide "Add" button if user doesn't have create permission
            if (!user.permissions.includes('asset:create')) {
                DOM.addAssetBtn.classList.add('hidden');
            }

            await loadAssets();
        } catch (error) {
            console.error('Failed to initialize page:', error);
            DOM.tableBody.innerHTML = `<tr><td colspan="7" class="text-center p-8 text-red-500">Error loading data. Please check the server connection and try again.</td></tr>`;
        }
    }

    main();
}
       