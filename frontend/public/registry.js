import { fetchWithAuth, BASE_URL } from './api.js';
import { createUIManager } from './js/ui.js';

document.addEventListener('DOMContentLoaded', async () => {
    try {
        const user = await getCurrentUser();
        if (!user) return;

        initializeLayout(user);
        initializeRegistryPage(user);
    } catch (error) {
        console.error("Authentication failed on registry page:", error);
    }
});

function initializeRegistryPage(currentUser) {
    // --- MODULE: STATE MANAGEMENT ---
    const state = {
        currentPageAssets: [], // Holds only the assets for the current page
        totalAssets: 0,      // Total assets matching the current filter
        allCategories: [],
        allOffices: [],
        allEmployees: [],
        assetsToTransfer: [], // To hold asset objects for the modal
        selectedAssetIds: [],
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
        exportCsvBtn: document.getElementById('export-csv-btn'),
        // Modal elements
        transferModal: document.getElementById('transfer-modal'),
        transferModalTitle: document.getElementById('transfer-modal-title'),
        transferAssetInfo: document.getElementById('transfer-asset-info'),
        transferOfficeSelect: document.getElementById('transfer-modal-office-select'),
        transferCustodianSelect: document.getElementById('transfer-modal-custodian-select'),
        confirmTransferBtn: document.getElementById('confirm-transfer-modal-btn'),
        cancelTransferBtn: document.getElementById('cancel-transfer-modal-btn'),
        bulkTransferAssetListContainer: document.getElementById('bulk-transfer-asset-list-container'),
    };

    // --- MODULE: UI MANAGER ---
    const uiManager = createUIManager(state, DOM);

    // --- MODULE: SLIP MANAGER ---
    const slipManager = {
        prepareForSlipGeneration(slipType) {
            if (state.selectedAssetIds.length === 0) {
                alert(`Please select at least one asset to generate a ${slipType}.`);
                return;
            }
            const selectedAssets = state.currentPageAssets.filter(asset => state.selectedAssetIds.includes(asset._id));

            // NEW CHECK: Ensure selected assets are not already assigned to another slip.
            const alreadyAssignedAssets = selectedAssets.filter(asset => asset.assignedPAR || asset.assignedICS);
            if (alreadyAssignedAssets.length > 0) {
                const assignedNumbers = alreadyAssignedAssets.map(a => a.propertyNumber).join(', ');
                alert(`Error: The following assets are already assigned to a slip and cannot be added to a new one:\n${assignedNumbers}`);
                return;
            }
            const firstCustodian = selectedAssets[0].custodian.name;
            if (!selectedAssets.every(asset => asset.custodian.name === firstCustodian)) {
                alert(`Error: All selected assets must belong to the same custodian to be on one ${slipType}.`);
                return;
            }
            localStorage.setItem(`assetsFor${slipType}`, JSON.stringify(selectedAssets));
            window.location.href = `${slipType.toLowerCase()}-page.html`;
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
                fundSource: DOM.fundSourceFilter.value,
                startDate: DOM.startDateFilter.value,
                endDate: DOM.endDateFilter.value
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

        toggleAdvancedFilters() {
            const isHidden = DOM.advancedFilters.classList.toggle('hidden');
            DOM.moreFiltersBtn.setAttribute('aria-expanded', !isHidden);
            const icon = DOM.moreFiltersBtn.querySelector('i');
            icon.setAttribute('data-lucide', isHidden ? 'chevron-down' : 'chevron-up');
            lucide.createIcons();
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
                window.location.href = `asset-form.html?id=${editButton.dataset.id}`;
                return;
            }
            const propertyCardButton = e.target.closest('.property-card-btn');
            if (propertyCardButton) {
                window.location.href = `property-card.html?id=${propertyCardButton.dataset.id}`;
                return;
            }
            const transferButton = e.target.closest('.transfer-btn');
            if (transferButton) {
                const assetId = transferButton.dataset.id;
                uiManager.openTransferModal([assetId]);
                return;
            }
            const deleteButton = e.target.closest('.delete-btn');
            if (deleteButton) {
                if (confirm('Are you sure you want to delete this asset?')) {
                    try {
                        await fetchWithAuth(`assets/${deleteButton.dataset.id}`, { method: 'DELETE' });
                        alert('Asset deleted successfully.');
                        await loadAssets(); // Just reload the current view
                    } catch (err) {
                        alert(err.message);
                    }
                }
            }
        },

        handleTableChange(e) {
            if (e.target.classList.contains('asset-checkbox')) {
                const assetId = e.target.dataset.id;
                if (e.target.checked) {
                    state.selectedAssetIds.push(assetId);
                } else {
                    state.selectedAssetIds = state.selectedAssetIds.filter(id => id !== assetId);
                }
                uiManager.updateSlipButtonVisibility();
            }
            if (e.target.id === 'select-all-assets') {
                const checkboxes = DOM.tableBody.querySelectorAll('.asset-checkbox:not(:disabled)');
                state.selectedAssetIds = [];
                checkboxes.forEach(checkbox => {
                    checkbox.checked = e.target.checked;
                    if (e.target.checked) {
                        state.selectedAssetIds.push(checkbox.dataset.id);
                    }
                });
                uiManager.updateSlipButtonVisibility();
            }
        },

        async handleConfirmTransfer() {
            DOM.confirmTransferBtn.disabled = true;
            DOM.confirmTransferBtn.textContent = 'Transferring...';

            try {
                const newOffice = DOM.transferOfficeSelect.value;
                const newCustodianName = DOM.transferCustodianSelect.value;

                if (!newOffice || !newCustodianName) {
                    throw new Error('Please select a new office and custodian.');
                }

                const selectedEmployee = state.allEmployees.find(emp => emp.name === newCustodianName);
                const newCustodian = { name: newCustodianName, designation: selectedEmployee?.designation || '', office: newOffice };
                const user = { name: currentUser.name, office: currentUser.office };

                if (state.assetsToTransfer.length > 1) {
                    // --- BULK ASSET TRANSFER ---
                    const payload = {
                        assetIds: state.assetsToTransfer.map(a => a._id),
                        newOffice,
                        newCustodian,
                        user
                    };
                    const transferResult = await fetchWithAuth('assets/bulk-transfer', {
                        method: 'POST',
                        body: JSON.stringify(payload)
                    });
                    localStorage.setItem('transferData', JSON.stringify(transferResult.transferDetails));
                    window.location.href = 'ptr.html'; // Navigate to the printable PTR page
                } else {
                    // --- SINGLE ASSET TRANSFER ---
                    const assetId = state.assetsToTransfer[0]._id;
                    const payload = { office: newOffice, custodian: newCustodian, user };
                    await fetchWithAuth(`assets/${assetId}`, {
                        method: 'PUT',
                        body: JSON.stringify(payload)
                    });
                    alert('Asset transferred successfully!');
                    uiManager.closeTransferModal();
                    await loadAssets(); // Refresh current view
                }
            } catch (error) {
                alert(`Error: ${error.message}`);
            } finally {
                DOM.confirmTransferBtn.disabled = false;
                DOM.confirmTransferBtn.textContent = 'Confirm Transfer';
            }
        },

        setupEventListeners() {
            const filters = [DOM.searchInput, DOM.categoryFilter, DOM.statusFilter, DOM.officeFilter, DOM.fundSourceFilter, DOM.assignmentFilter, DOM.startDateFilter, DOM.endDateFilter];
            filters.forEach(el => el?.addEventListener('input', () => this.handleFilterChange()));
            DOM.paginationControls?.addEventListener('click', e => this.handlePaginationClick(e));
            DOM.moreFiltersBtn?.addEventListener('click', () => this.toggleAdvancedFilters());
            DOM.resetFiltersBtn?.addEventListener('click', () => this.resetAllFilters());            
            DOM.tableBody?.parentElement.addEventListener('change', e => this.handleTableChange(e)); // Listen on table for tbody and thead changes
            DOM.tableBody?.addEventListener('click', e => this.handleTableClick(e));
            DOM.tableHeader?.addEventListener('click', (e) => this.handleSort(e));
            DOM.generateParBtn?.addEventListener('click', () => slipManager.prepareForSlipGeneration('PAR'));
            DOM.generateIcsBtn?.addEventListener('click', () => slipManager.prepareForSlipGeneration('ICS'));
            DOM.exportCsvBtn?.addEventListener('click', () => exportManager.exportToCsv());
            DOM.transferSelectedBtn?.addEventListener('click', () => uiManager.openTransferModal(state.selectedAssetIds));
            // Transfer Modal Listeners
            DOM.confirmTransferBtn?.addEventListener('click', () => this.handleConfirmTransfer());
            DOM.cancelTransferBtn?.addEventListener('click', () => uiManager.closeTransferModal());
        }
    };

    // --- DATA ORCHESTRATOR ---
    async function loadAssets() {
        uiManager.setLoading(true);
        DOM.selectAllCheckbox.checked = false;
        state.selectedAssetIds = [];

        try {
            const params = {
                currentPage: state.currentPage,
                assetsPerPage: state.assetsPerPage,
            sort: state.sortKey,
            order: state.sortDirection,
                search: DOM.searchInput.value,
                category: DOM.categoryFilter.value,
                status: DOM.statusFilter.value,
                office: DOM.officeFilter.value,
                fundSource: DOM.fundSourceFilter.value,
                assignment: DOM.assignmentFilter.value,
                startDate: DOM.startDateFilter.value,
                endDate: DOM.endDateFilter.value
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
            uiManager.renderAssetTable(assets, totalDocs, totalPages);
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

            uiManager.populateFilters(categories, offices, employees);
            eventManager.setupEventListeners();
            await loadAssets();
        } catch (error) {
            console.error('Failed to initialize page:', error);
            DOM.tableBody.innerHTML = `<tr><td colspan="7" class="text-center p-8 text-red-500">Error loading data. Please check the server connection and try again.</td></tr>`;
        }
    }

    main();
}