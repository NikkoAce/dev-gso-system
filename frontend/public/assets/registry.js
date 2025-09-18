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
        assetsToTransfer: [], // To hold asset objects for the modal
        selectedAssets: [], // Changed from selectedAssetIds to hold {id, cost} objects
        currentPage: 1,
        assetsPerPage: 20,
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
    };

    // --- MODULE: UI MANAGER ---
    const uiManager = createUIManager();

    function renderSummary(totalValue) {
        const formatCurrency = (value) => new Intl.NumberFormat('en-PH', { style: 'currency', currency: 'PHP' }).format(value || 0);
        if (totalValue > 0) {
            DOM.assetTableFooter.innerHTML = `
                <tr>
                    <td colspan="5" class="text-right font-bold">Total Value (All Filtered Pages):</td>
                    <td class="text-right font-bold">${formatCurrency(totalValue)}</td>
                    <td colspan="2"></td>
                </tr>
            `;
        } else {
            DOM.assetTableFooter.innerHTML = '';
        }
    }

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
        const eligibleAssets = state.selectedAssets.filter(a => ['In Storage', 'For Repair'].includes(a.status));
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
            if (state.selectedAssets.length === 0) {
                uiManager.showToast(`Please select at least one asset to generate a ${slipType}.`, 'warning');
                return;
            }

            // For PAR and ICS, all assets must belong to the same custodian and not be assigned to another slip.
            if (slipType === 'PAR' || slipType === 'ICS') {
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
            }

            // For IIRUP and Appendix 68, the custodian check is not needed as they are GSO-level documents.
            // The visibility logic in ui.js already ensures the correct assets are selected based on status.

            localStorage.setItem(`assetsFor${slipType}`, JSON.stringify(state.selectedAssets));
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
                transferTooltipWrapper: DOM.transferTooltipWrapper,
                generateAppendix68Btn: DOM.generateAppendix68Btn,
                generateIIRUPBtn: DOM.generateIIRUPBtn
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
                const userPayload = { name: user.name, office: user.office };
                const payload = {
                    assetIds: state.assetsToTransfer.map(a => a._id),
                    newOffice,
                    newCustodian,
                    transferDate,
                    user: userPayload
                };

                const transferResult = await fetchWithAuth('asset-transfers/ptr', {
                    method: 'POST',
                    body: JSON.stringify(payload)
                });

                localStorage.setItem('transferData', JSON.stringify(transferResult.ptr));
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
            DOM.confirmAppendix68Btn.textContent = 'Generating...';

            try {                
                // Get the full asset objects that are eligible
                const eligibleAssets = state.selectedAssets.filter(a => ['In Storage', 'For Repair'].includes(a.status));
                
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
            // programmatically update an input's value. The custom 'changeDate' event
            // can be less reliable depending on initialization order.
            const dateFilters = [DOM.startDateFilter, DOM.endDateFilter];
            dateFilters.forEach(el => el?.addEventListener('change', () => this.handleFilterChange()));

            // NEW: Collapsible filter panel
            DOM.toggleFiltersBtn?.addEventListener('click', () => {
                DOM.filtersGrid.classList.toggle('hidden');
            });
            DOM.paginationControls?.addEventListener('click', e => this.handlePaginationClick(e));
            DOM.resetFiltersBtn?.addEventListener('click', () => this.resetAllFilters());            
            DOM.tableBody?.parentElement.addEventListener('change', e => this.handleTableChange(e)); // Listen on table for tbody and thead changes
            DOM.tableBody?.addEventListener('click', e => this.handleTableClick(e)); // For edit, delete, etc.
            DOM.tableHeader?.addEventListener('click', (e) => this.handleSort(e));
            DOM.generateParBtn?.addEventListener('click', () => slipManager.prepareForSlipGeneration('PAR'));
            DOM.generateIcsBtn?.addEventListener('click', () => slipManager.prepareForSlipGeneration('ICS'));
            DOM.generateIIRUPBtn?.addEventListener('click', () => slipManager.prepareForSlipGeneration('IIRUP'));
            DOM.exportCsvBtn?.addEventListener('click', () => exportManager.exportToCsv());
            DOM.transferSelectedBtn?.addEventListener('click', () => openTransferModal(state.selectedAssets.map(a => a._id)));
            // Transfer Modal Listeners
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
            const domElements = { tableBody: DOM.tableBody, paginationControls: DOM.paginationControls };

            uiManager.renderAssetTable(assets, domElements, user);
            uiManager.renderPagination(DOM.paginationControls, paginationInfo);
            renderSummary(totalValue);
            eventManager.updateSelectionState(); // Update buttons for the new view
        } catch (error) {
            console.error('Failed to load assets:', error);
            DOM.tableBody.innerHTML = `<tr><td colspan="9" class="text-center p-8 text-red-500">Error loading assets: ${error.message}</td></tr>`;
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
       