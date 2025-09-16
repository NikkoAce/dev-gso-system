import { fetchWithAuth } from '../js/api.js';
import { exportToPDF, togglePreviewMode } from '../js/report-utils.js';
import { createAuthenticatedPage } from '../js/page-loader.js';

createAuthenticatedPage({
    permission: 'report:generate',
    pageInitializer: initializeLedgerCardPage,
    pageName: 'Immovable Ledger Card'
});

function initializeLedgerCardPage(user) {
    // --- STATE & CONFIG ---
    const urlParams = new URLSearchParams(window.location.search);
    const assetId = urlParams.get('id');
    const API_ENDPOINT = `immovable-assets/${assetId}/ledger-card`;
    let currentAsset = null; // To store asset data for filename

    // --- DOM ELEMENTS ---
    const loadingState = document.getElementById('loading-state');
    const errorState = document.getElementById('error-state');
    const errorMessage = document.getElementById('error-message');
    const reportContent = document.getElementById('report-content');
    const ledgerFund = document.getElementById('ledger-fund');
    const ledgerEquipmentName = document.getElementById('ledger-equipment-name');
    const ledgerAccountCode = document.getElementById('ledger-account-code');
    const ledgerDescription = document.getElementById('ledger-description');
    const ledgerTableContainer = document.getElementById('ledger-table-container');
    const printReportBtn = document.getElementById('print-report-btn');
    const exportPdfBtn = document.getElementById('export-pdf-btn');
    const previewBtn = document.getElementById('preview-btn');
    const exitPreviewBtn = document.getElementById('exit-preview-btn');

    // --- UTILITY FUNCTIONS ---
    const formatCurrency = (value) => new Intl.NumberFormat('en-PH', { style: 'currency', currency: 'PHP' }).format(value || 0);
    const formatDate = (dateString) => dateString ? new Date(dateString).toLocaleDateString('en-CA') : 'N/A';

    // --- RENDERING FUNCTIONS ---
    function renderLedgerHeader(asset) {
        // NOTE: Fund and Account Code are populated from the asset model.
        ledgerFund.textContent = asset.fundSource || 'General Fund';
        ledgerEquipmentName.textContent = asset.name;
        ledgerAccountCode.textContent = asset.accountCode || 'N/A';
        ledgerDescription.textContent = asset.remarks || asset.name;
    }

    function renderLedgerTable(ledgerRows) {
        if (!ledgerRows || ledgerRows.length === 0) {
            ledgerTableContainer.innerHTML = '<p>No ledger entries available for this asset.</p>';
            return;
        }

        const table = document.createElement('table');
        table.className = 'w-full text-xs border-collapse border border-black';
        table.innerHTML = `
            <thead class="bg-gray-100">
                <tr class="text-center">
                    <th class="border border-black p-1">Date</th>
                    <th class="border border-black p-1">Reference</th>
                    <th class="border border-black p-1">Particulars</th>
                    <th class="border border-black p-1">Property ID No.</th>
                    <th class="border border-black p-1">Cost</th>
                    <th class="border border-black p-1">Est. Useful Life</th>
                    <th class="border border-black p-1">Accum. Dep.</th>
                    <th class="border border-black p-1">Accum. Impairment Losses</th>
                    <th class="border border-black p-1">Adjusted Cost</th>
                    <th class="border border-black p-1" colspan="2">Repair History</th>
                    <th class="border border-black p-1">Remarks</th>
                </tr>
                <tr class="text-center">
                    <th class="border border-black p-1" colspan="9"></th>
                    <th class="border border-black p-1">Nature of Repair</th>
                    <th class="border border-black p-1">Amount</th>
                    <th class="border border-black p-1"></th>
                </tr>
            </thead>
            <tbody>
                ${ledgerRows.map(entry => `
                    <tr class="border-b">
                        <td class="border border-black p-1">${formatDate(entry.date)}</td>
                        <td class="border border-black p-1">${entry.reference}</td>
                        <td class="border border-black p-1">${entry.particulars}</td>
                        <td class="border border-black p-1">${entry.propertyId}</td>
                        <td class="border border-black p-1 text-right">${formatCurrency(entry.cost)}</td>
                        <td class="border border-black p-1 text-center">${entry.estimatedUsefulLife} yrs</td>
                        <td class="border border-black p-1 text-right">${formatCurrency(entry.accumulatedDepreciation)}</td>
                        <td class="border border-black p-1 text-right">${formatCurrency(entry.impairmentLosses)}</td>
                        <td class="border border-black p-1 text-right">${formatCurrency(entry.adjustedCost)}</td>
                        <td class="border border-black p-1">${entry.repairNature}</td>
                        <td class="border border-black p-1 text-right">${formatCurrency(entry.repairAmount)}</td>
                        <td class="border border-black p-1">${entry.remarks}</td>
                    </tr>
                `).join('')}
            </tbody>
        `;
        ledgerTableContainer.innerHTML = '';
        ledgerTableContainer.appendChild(table);
    }

    // --- CORE LOGIC ---
    async function loadLedgerCard() {
        if (!assetId) {
            loadingState.classList.add('hidden');
            errorMessage.textContent = 'No Asset ID provided.';
            errorState.classList.remove('hidden');
            return;
        }

        try {
            const { asset, ledgerRows } = await fetchWithAuth(API_ENDPOINT);
            currentAsset = asset; // Store asset for later use
            renderLedgerHeader(asset);
            renderLedgerTable(ledgerRows);
            loadingState.classList.add('hidden');
            reportContent.classList.remove('hidden');
        } catch (error) {
            console.error('Error fetching ledger card data:', error);
            loadingState.classList.add('hidden');
            errorMessage.textContent = `Error: ${error.message}`;
            errorState.classList.remove('hidden');
        }
    }

    function handleExportPDF() {
        const fileName = `Immovable-Ledger-Card-${currentAsset?.propertyIndexNumber || 'report'}.pdf`;
        exportToPDF({
            reportElementId: 'report-output',
            fileName: fileName,
            buttonElement: exportPdfBtn
        });
    }

    function handleTogglePreview() {
        togglePreviewMode({
            orientation: 'landscape',
            exitButtonId: 'exit-preview-btn'
        });
    }

    // --- EVENT LISTENERS ---
    printReportBtn.addEventListener('click', () => window.print());
    exportPdfBtn.addEventListener('click', handleExportPDF);
    previewBtn.addEventListener('click', handleTogglePreview);
    exitPreviewBtn.addEventListener('click', handleTogglePreview);

    // --- INITIALIZATION ---
    loadLedgerCard();
}