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
    const { populateFilters, showToast, setLoading } = createUIManager();

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

    // --- UTILITY FUNCTIONS ---
    const formatCurrency = (value) => new Intl.NumberFormat('en-PH', { style: 'currency', currency: 'PHP' }).format(value || 0);
    const formatDate = (dateString) => dateString ? new Date(dateString).toLocaleDateString('en-CA') : 'N/A';

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
            showToast('Could not load initial data for reports.', 'error');
        }
    }

    function setReportLoading(isLoading, message = 'Loading...') {
        const reportOutput = document.getElementById('report-output');
        const reportTitle = document.getElementById('report-title');
        const container = document.getElementById('report-table-container');
        const reportHeader = document.getElementById('report-header');
        const reportFooter = document.getElementById('report-footer');

        if (isLoading) {
            reportTitle.textContent = message;
            setLoading(true, container, { isTable: false });
            reportHeader.classList.add('hidden');
            reportFooter.classList.add('hidden');
            reportOutput.classList.remove('hidden');
        } else {
            if (container.innerHTML.includes('loader-2')) {
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
        document.getElementById('signatory-1-name').textContent = signatories.certifier.name;
        document.getElementById('signatory-2-name').textContent = signatories.approver.name;
        document.getElementById('signatory-3-name').textContent = signatories.verifier.name;
    }

    // --- REPORT GENERATION ---
    function generateReportTable(title, headers, rows, fundSource, reportHeaderTitle, asAtDate) {
        const reportOutput = document.getElementById('report-output');
        const reportTitle = document.getElementById('report-title');
        const reportHeader = document.getElementById('report-header');
        const reportFooter = document.getElementById('report-footer');
        const container = document.getElementById('report-table-container');
        
        reportTitle.textContent = title;
        document.getElementById('report-header-title').textContent = reportHeaderTitle;
        document.getElementById('report-fund-source').textContent = fundSource.toUpperCase();
        document.getElementById('report-as-at-date').textContent = formatDate(asAtDate);
        
        let tableHTML = `<table class="w-full text-xs border-collapse border border-black">
            <thead class="bg-gray-100">
                <tr>${headers.map(h => `<th class="border border-black p-1">${h}</th>`).join('')}</tr>
            </thead>
            <tbody>
                ${rows.map(row => `
                    <tr class="border-b">${row.map(cell => `<td class="border border-black p-1 align-top">${cell}</td>`).join('')}</tr>
                `).join('')}
            </tbody>
        </table>`;
        
        container.innerHTML = tableHTML;
        populateSignatories();
        reportHeader.classList.remove('hidden');
        reportFooter.classList.remove('hidden');
        reportOutput.classList.remove('hidden');
        lucide.createIcons();
    }

    function generateLedgerCard(asset) {
        const reportOutput = document.getElementById('report-output');
        const reportTitle = document.getElementById('report-title');
        const reportHeader = document.getElementById('report-header');
        const reportFooter = document.getElementById('report-footer');
        const container = document.getElementById('report-table-container');
        
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

        container.innerHTML = tableHTML;
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

    // --- EVENT LISTENERS ---
    async function generateRpcppeReport() {
        const selectedFundSource = fundSourceFilter.value;
        const selectedCategory = categoryFilter.value;
        const asAtDate = asAtDateInput.value;

        if (!selectedFundSource || !asAtDate) {
            showToast('Please select a Fund Source and an "As at Date" for the report.', 'warning');
            return;
        }

        setReportLoading(true, 'Generating RPCPPE Report...');
        generateRpcppeBtn.disabled = true;

        try {
            const params = new URLSearchParams({
                fundSource: selectedFundSource,
                category: selectedCategory,
                asAtDate: asAtDate,
            });

            // This would be a new backend endpoint that handles filtering and data preparation.
            const reportData = await fetchWithAuth(`reports/rpcppe?${params}`);
            if (reportData.rows.length === 0) {
                showToast('No assets found for the selected criteria.', 'info');
                return;
            }

            generateReportTable(
                'RPCPPE Report',
                reportData.headers,
                reportData.rows,
                selectedFundSource,
                'REPORT ON THE PHYSICAL COUNT OF PROPERTY, PLANT AND EQUIPMENT',
                asAtDate
            );
        } catch (error) {
            console.error('Error generating RPCPPE:', error);
            showToast(`Error: ${error.message}`, 'error');
        } finally {
            setReportLoading(false);
            generateRpcppeBtn.disabled = false;
        }
    }

    async function generateDepreciationReport() {
        const selectedFundSource = fundSourceFilter.value;
        const selectedCategory = categoryFilter.value;
        const asAtDate = asAtDateInput.value;

        if (!selectedFundSource || !asAtDate) {
            showToast('Please select a Fund Source and an "As at Date" for the report.', 'warning');
            return;
        }

        setReportLoading(true, 'Generating Depreciation Report...');
        generateDepreciationBtn.disabled = true;

        try {
            const params = new URLSearchParams({
                fundSource: selectedFundSource,
                category: selectedCategory,
                asAtDate: asAtDate,
            });

            // This would be a new backend endpoint that handles all depreciation calculations.
            const reportData = await fetchWithAuth(`reports/depreciation?${params}`);
            if (reportData.rows.length === 0) {
                showToast('No assets found for the selected criteria.', 'info');
                return;
            }

            generateReportTable(
                'Depreciation Report',
                reportData.headers,
                reportData.rows, // Assuming backend sends pre-formatted rows
                selectedFundSource,
                'SCHEDULE ON THE LAPSARIAN OF PROPERTY, PLANT AND EQUIPMENT',
                asAtDate
            );
        } catch (error) {
            console.error('Error generating Depreciation Report:', error);
            showToast(`Error: ${error.message}`, 'error');
        } finally {
            setReportLoading(false);
            generateDepreciationBtn.disabled = false;
        }
    }

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

    generateRpcppeBtn.addEventListener('click', generateRpcppeReport);
    generateDepreciationBtn.addEventListener('click', generateDepreciationReport);
    generateLedgerCardBtn.addEventListener('click', handleGenerateLedger);

    assetSearchInput.addEventListener('input', renderAssetSearchResults);
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
