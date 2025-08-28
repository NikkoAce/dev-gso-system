// FILE: frontend/public/slips/movable-ledger-card.js
import { getCurrentUser, gsoLogout } from '../js/auth.js';
import { fetchWithAuth } from '../js/api.js';

document.addEventListener('DOMContentLoaded', async () => {
    try {
        const user = await getCurrentUser();
        if (!user) return;

        if (!user.permissions || !user.permissions.includes('asset:read')) {
            window.location.href = '../dashboard/dashboard.html';
            return;
        }
        initializeLayout(user, gsoLogout);
        initializeLedgerCardPage();
    } catch (error) {
        console.error("Authentication failed on ledger card page:", error);
    }
});

function initializeLedgerCardPage() {
    // --- STATE & CONFIG ---
    const urlParams = new URLSearchParams(window.location.search);
    const assetId = urlParams.get('id');
    const API_ENDPOINT = `assets/${assetId}/ledger-card`;

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

    // --- UTILITY FUNCTIONS ---
    const formatCurrency = (value) => new Intl.NumberFormat('en-PH', { style: 'currency', currency: 'PHP' }).format(value || 0);
    const formatDate = (dateString) => dateString ? new Date(dateString).toLocaleDateString('en-CA') : 'N/A';

    // --- RENDERING FUNCTIONS ---
    function renderLedgerHeader(asset) {
        ledgerFund.textContent = asset.fundSource || 'General Fund';
        ledgerEquipmentName.textContent = asset.category;
        ledgerAccountCode.textContent = asset.accountCode || 'N/A'; // Assuming account code might be added later
        ledgerDescription.textContent = asset.description;
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

    // --- EVENT LISTENERS ---
    printReportBtn.addEventListener('click', () => window.print());

    // --- INITIALIZATION ---
    loadLedgerCard();
}
        if (!assetId) {
            cardContainer.innerHTML = '<p class="text-center text-red-500">No asset ID provided.</p>';
            return;
        }

        try {
            const asset = await fetchWithAuth(`assets/${assetId}`);
            renderPropertyCard(asset);
        } catch (error) {
            console.error('Error loading property card:', error);
            cardContainer.innerHTML = `<p class="text-center text-red-500">Error loading asset data: ${error.message}</p>`;
        }
    }

    function renderPropertyCard(asset) {
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

        const cardHTML = `
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
                <p><strong>Custodian:</strong> ${asset.custodian.name}</p>
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

        cardContainer.innerHTML = cardHTML;
    }

    if (printBtn) {
        printBtn.addEventListener('click', () => {
            window.print();
        });
    }

    loadPropertyCard();
}