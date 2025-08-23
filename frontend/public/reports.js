// FILE: frontend/public/reports.js
import { fetchWithAuth } from './api.js';
import { createUIManager } from './js/ui.js';

document.addEventListener('DOMContentLoaded', async () => {
    try {
        const user = await getCurrentUser();
        if (!user) return;

        initializeLayout(user);
        initializeReportsPage(user);
    } catch (error) {
        console.error("Authentication failed on reports page:", error);
    }
});

function initializeReportsPage(currentUser) {
    let allAssets = [];
    const { populateFilters, showToast } = createUIManager();

    // --- DOM ELEMENTS ---
    const fundSourceFilter = document.getElementById('fund-source-filter');
    const categoryFilter = document.getElementById('category-filter');
    const assetSearchInput = document.getElementById('asset-search-input');
    const assetSearchResults = document.getElementById('asset-search-results');
    const selectedAssetIdInput = document.getElementById('selected-asset-id');
    const generateRpcppeBtn = document.getElementById('generate-rpcppe');
    const generateDepreciationBtn = document.getElementById('generate-depreciation');
    const generateLedgerCardBtn = document.getElementById('generate-ledger-card');
    const asAtDateInput = document.getElementById('as-at-date');
    const printReportBtn = document.getElementById('print-report-btn');
    const reportOutput = document.getElementById('report-output');
    const reportTitle = document.getElementById('report-title');
    const reportTableContainer = document.getElementById('report-table-container');
    const reportHeader = document.getElementById('report-header');
    const reportFooter = document.getElementById('report-footer');
    const reportHeaderTitleEl = document.getElementById('report-header-title');
    const reportFundSourceEl = document.getElementById('report-fund-source');
    const reportAsAtDateEl = document.getElementById('report-as-at-date');
    const signatory1Name = document.getElementById('signatory-1-name');
    const signatory1Title = document.getElementById('signatory-1-title');
    const signatory2Name = document.getElementById('signatory-2-name');
    const signatory2Title = document.getElementById('signatory-2-title');
    const signatory3Name = document.getElementById('signatory-3-name');
    const signatory3Title = document.getElementById('signatory-3-title');

    // --- UTILITY FUNCTIONS ---
    const formatCurrency = (value) => new Intl.NumberFormat('en-PH', { style: 'currency', currency: 'PHP' }).format(value || 0);
    const formatDate = (dateString) => dateString ? new Date(dateString).toLocaleDateString('en-CA') : 'N/A';
    const debounce = (func, delay) => {
        let timeoutId;
        return (...args) => {
            clearTimeout(timeoutId);
            timeoutId = setTimeout(() => {
                func.apply(this, args);
            }, delay);
        };
    };

    // --- DATA FETCHING ---
    async function initializePage() {
        try {
            const [fetchedAssets, categories] = await Promise.all([
                fetchWithAuth('assets'),
                fetchWithAuth('categories')
            ]);
            
            allAssets = fetchedAssets;
            populateFilters({ categories }, { categoryFilter });
            asAtDateInput.value = new Date().toISOString().split('T')[0]; // Set default date to today
        } catch (error) {
            console.error('Failed to initialize page:', error);
            showToast('Could not load data for reports.', 'error');
        }
    }

    function setReportLoading(isLoading, message = 'Loading...') {
        if (isLoading) {
            reportTitle.textContent = message;
            reportTableContainer.innerHTML = `<div class="flex justify-center items-center p-8"><i data-lucide="loader-2" class="animate-spin h-8 w-8 mx-auto text-gray-500"></i></div>`;
            reportHeader.classList.add('hidden');
            reportFooter.classList.add('hidden');
            reportOutput.classList.remove('hidden');
            lucide.createIcons();
        } else {
            if (reportTableContainer.innerHTML.includes('loader-2')) {
                reportOutput.classList.add('hidden');
            }
        }
    }

    function populateSignatories() {
        // In a real app, this might come from a config or API
        const signatories = {
            certifier: { name: 'INVENTORY COMMITTEE CHAIR', title: 'Signature over Printed Name' },
            approver: { name: 'HEAD OF AGENCY/ENTITY', title: 'Signature over Printed Name' },
            verifier: { name: 'COA REPRESENTATIVE', title: 'Signature over Printed Name' }
        };
        signatory1Name.textContent = signatories.certifier.name;
        signatory1Title.textContent = signatories.certifier.title;
        signatory2Name.textContent = signatories.approver.name;
        signatory2Title.textContent = signatories.approver.title;
        signatory3Name.textContent = signatories.verifier.name;
        signatory3Title.textContent = signatories.verifier.title;
    }

    // --- REPORT GENERATION ---
    function generateReportTable(title, headers, rows, fundSource, reportHeaderTitle, asAtDate, columnFormatters = {}) {
        reportTitle.textContent = title;
        reportHeaderTitleEl.textContent = reportHeaderTitle;
        reportFundSourceEl.textContent = fundSource.toUpperCase();
        reportAsAtDateEl.textContent = formatDate(asAtDate);
        
        // Clear previous content
        reportTableContainer.innerHTML = '';

        const table = document.createElement('table');
        table.className = 'w-full text-xs border-collapse border border-black';

        const thead = table.createTHead();
        thead.className = 'bg-gray-100';
        const headerRow = thead.insertRow();
        headers.forEach(headerText => {
            const th = document.createElement('th');
            th.className = 'border border-black p-1';
            th.textContent = headerText;
            headerRow.appendChild(th);
        });

        const tbody = table.createTBody();
        rows.forEach(rowData => {
            const row = tbody.insertRow();
            row.className = 'border-b';
            rowData.forEach((cellData, index) => {
                const cell = row.insertCell();
                cell.className = 'border border-black p-1 align-top';
                // Apply formatter if it exists for the current column index
                if (columnFormatters[index]) {
                    cell.textContent = columnFormattersindex;
                } else {
                    cell.textContent = cellData;
                }
            });
        });
        
        reportTableContainer.appendChild(table);
        populateSignatories();
        reportHeader.classList.remove('hidden');
        reportFooter.classList.remove('hidden');
        reportOutput.classList.remove('hidden');
    }

    function generateLedgerCard(asset) {
        reportTitle.textContent = `PPE Ledger Card`;
        reportHeader.classList.add('hidden'); // Hide the standard header
        reportFooter.classList.add('hidden'); // Hide the standard footer
    
        const depreciableCost = asset.acquisitionCost - (asset.salvageValue || 0);
        const annualDepreciation = asset.usefulLife > 0 ? depreciableCost / asset.usefulLife : 0;
        
        let rowsHTML = '';
        let accumulatedDepreciation = 0;
    
        for (let i = 1; i <= asset.usefulLife; i++) {
            accumulatedDepreciation += annualDepreciation;
            const bookValue = asset.acquisitionCost - accumulatedDepreciation;
            rowsHTML += `
                <tr class="border-b">
                    <td class="border border-black p-1 text-center">${i}</td>
                    <td class="border border-black p-1 text-right">${formatCurrency(annualDepreciation)}</td>
                    <td class="border border-black p-1 text-right">${formatCurrency(accumulatedDepreciation)}</td>
                    <td class="border border-black p-1 text-right">${formatCurrency(bookValue)}</td>
                </tr>
            `;
        }
    
        let tableHTML = `
            <div class="text-center mb-4">
                <h3 class="font-bold">PROPERTY, PLANT AND EQUIPMENT LEDGER CARD</h3>
                <p class="text-sm">${asset.category}</p>
            </div>
            <div class="grid grid-cols-2 gap-x-4 text-sm mb-4">
                <p><strong>Description:</strong> ${asset.description}</p>
                <p><strong>Property No.:</strong> ${asset.propertyNumber}</p>
                <p><strong>Acquisition Cost:</strong> ${formatCurrency(asset.acquisitionCost)}</p>
                <p><strong>Acquisition Date:</strong> ${formatDate(asset.acquisitionDate)}</p>
                <p><strong>Est. Useful Life:</strong> ${asset.usefulLife} years</p>
            </div>
            <table class="w-full text-xs border-collapse border border-black">
                <thead class="bg-gray-100">
                    <tr>
                        <th class="border border-black p-1">Year</th>
                        <th class="border border-black p-1">Depreciation</th>
                        <th class="border border-black p-1">Accum. Dep.</th>
                        <th class="border border-black p-1">Book Value</th>
                    </tr>
                </thead>
                <tbody>${rowsHTML}</tbody>
            </table>
        `;
    
        reportTableContainer.innerHTML = tableHTML;
        reportOutput.classList.remove('hidden');
    }

    // --- ASSET SEARCH COMBOBOX LOGIC ---
    function renderAssetSearchResults() {
        const searchTerm = assetSearchInput.value.toLowerCase();
        if (searchTerm.length < 2) {
            assetSearchResults.classList.add('hidden');
            return;
        }

        const filteredAssets = allAssets.filter(asset => 
            asset.propertyNumber.toLowerCase().includes(searchTerm) ||
            asset.description.toLowerCase().includes(searchTerm)
        );

        assetSearchResults.innerHTML = '';
        if (filteredAssets.length > 0) {
            filteredAssets.forEach(asset => {
                const div = document.createElement('div');
                div.className = 'p-2 hover:bg-blue-100 cursor-pointer';
                div.textContent = `${asset.propertyNumber} - ${asset.description}`;
                div.dataset.id = asset._id;
                assetSearchResults.appendChild(div);
            });
            assetSearchResults.classList.remove('hidden');
        } else {
            const div = document.createElement('div');
            div.className = 'p-2 text-gray-500';
            div.textContent = 'No assets found.';
            assetSearchResults.appendChild(div);
            assetSearchResults.classList.remove('hidden');
        }
    }

    async function handleGenerateReport(config) {
        const {
            button,
            endpoint,
            loadingMessage,
            reportTitle,
            reportHeaderTitle,
            fundSourceRequired = true,
            columnFormatters
        } = config;

        const selectedFundSource = fundSourceFilter.value;
        const selectedCategory = categoryFilter.value;
        const asAtDate = asAtDateInput.value;

        if ((fundSourceRequired && !selectedFundSource) || !asAtDate) {
            showToast(`Please select a Fund Source and an "As at Date" for the report.`, 'warning');
            return;
        }

        setReportLoading(true, loadingMessage);
        button.disabled = true;

        try {
            const params = new URLSearchParams({
                fundSource: selectedFundSource,
                category: selectedCategory,
                asAtDate: asAtDate
            });

            const reportData = await fetchWithAuth(`reports/${endpoint}?${params}`);
            if (reportData.rows.length === 0) {
                showToast('No assets found for the selected criteria.', 'info');
                setReportLoading(false);
                return;
            }

            generateReportTable(
                reportTitle,
                reportData.headers,
                reportData.rows,
                selectedFundSource,
                reportHeaderTitle,
                asAtDate,
                columnFormatters
            );
        } catch (error) {
            console.error(`Error generating ${reportTitle}:`, error);
            showToast(`Error: ${error.message}`, 'error');
            setReportLoading(false);
        } finally {
            button.disabled = false;
        }
    }

    // --- EVENT LISTENERS ---

    function handleGenerateLedger() {
        const selectedAssetId = selectedAssetIdInput.value;
        if (!selectedAssetId) {
            showToast('Please select an asset to generate a ledger card.', 'warning');
            return;
        }
        const selectedAsset = allAssets.find(asset => asset._id === selectedAssetId);
        if (selectedAsset) {
            generateLedgerCard(selectedAsset);
        }
    }

    generateRpcppeBtn.addEventListener('click', () => handleGenerateReport({
        button: generateRpcppeBtn,
        endpoint: 'rpcppe',
        loadingMessage: 'Generating RPCPPE Report...',
        reportTitle: 'RPCPPE Report',
        reportHeaderTitle: 'REPORT ON THE PHYSICAL COUNT OF PROPERTY, PLANT AND EQUIPMENT',
        columnFormatters: {
            3: (data) => formatCurrency(data) // Unit Cost
        }
    }));

    generateDepreciationBtn.addEventListener('click', () => handleGenerateReport({
        button: generateDepreciationBtn,
        endpoint: 'depreciation',
        loadingMessage: 'Generating Depreciation Report...',
        reportTitle: 'Depreciation Report',
        reportHeaderTitle: 'DEPRECIATION SCHEDULE FOR PROPERTY, PLANT AND EQUIPMENT',
        columnFormatters: {
            2: (data) => formatCurrency(data),      // Acq. Cost
            3: (data) => formatDate(data),          // Acq. Date
            4: (data) => data ? `${data} yrs` : 'N/A', // Est. Life
            5: (data) => formatCurrency(data),      // Accum. Dep., Beg.
            6: (data) => formatCurrency(data),      // Dep. for the Period
            7: (data) => formatCurrency(data),      // Accum. Dep., End
            8: (data) => formatCurrency(data)       // Book Value, End
        }
    }));

    generateLedgerCardBtn.addEventListener('click', handleGenerateLedger);

    const debouncedRenderAssetSearchResults = debounce(renderAssetSearchResults, 300);
    assetSearchInput.addEventListener('input', debouncedRenderAssetSearchResults);
    assetSearchInput.addEventListener('focus', renderAssetSearchResults);

    assetSearchResults.addEventListener('click', (e) => {
        if (e.target && e.target.dataset.id) {
            const selectedAssetId = e.target.dataset.id;
            const selectedAsset = allAssets.find(asset => asset._id === selectedAssetId);
            if (selectedAsset) {
                assetSearchInput.value = `${selectedAsset.propertyNumber} - ${selectedAsset.description}`;
                selectedAssetIdInput.value = selectedAssetId;
                assetSearchResults.classList.add('hidden');
            }
        }
    });

    document.addEventListener('click', (e) => {
        if (!assetSearchInput.contains(e.target) && !assetSearchResults.contains(e.target)) {
            assetSearchResults.classList.add('hidden');
        }
    });

    if (printReportBtn) {
        printReportBtn.addEventListener('click', () => {
            window.print();
        });
    }

    // --- INITIALIZATION ---
    initializePage();
}
