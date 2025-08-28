import { getCurrentUser, gsoLogout } from '../js/auth.js';
import { fetchWithAuth } from '../js/api.js';

document.addEventListener('DOMContentLoaded', async () => {
    try {
        const user = await getCurrentUser();
        if (!user) return;

        if (!user.permissions || !user.permissions.includes('report:generate')) {
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
    const API_ENDPOINT = `immovable-assets/${assetId}/ledger-card`;

    // --- DOM ELEMENTS ---
    const loadingState = document.getElementById('loading-state');
    const errorState = document.getElementById('error-state');
    const errorMessage = document.getElementById('error-message');
    const reportContent = document.getElementById('report-content');
    const assetDetailsContainer = document.getElementById('asset-details-container');
    const depreciationTableContainer = document.getElementById('depreciation-table-container');
    const printReportBtn = document.getElementById('print-report-btn');

    // --- UTILITY FUNCTIONS ---
    const formatCurrency = (value) => new Intl.NumberFormat('en-PH', { style: 'currency', currency: 'PHP' }).format(value || 0);
    const formatDate = (dateString) => dateString ? new Date(dateString).toLocaleDateString('en-CA') : 'N/A';

    // --- RENDERING FUNCTIONS ---
    function renderAssetDetails(asset) {
        const details = asset.buildingAndStructureDetails || {};
        let detailsHtml = `
            <div class="grid grid-cols-2 md:grid-cols-3 gap-x-4 gap-y-2 border p-2">
                <div class="font-bold">Asset Name:</div>
                <div class="md:col-span-2">${asset.name}</div>
                
                <div class="font-bold">Property Index No.:</div>
                <div>${asset.propertyIndexNumber}</div>
                
                <div class="font-bold">Type:</div>
                <div>${asset.type}</div>

                <div class="font-bold">Acquisition Date:</div>
                <div>${formatDate(asset.dateAcquired)}</div>

                <div class="font-bold">Assessed Value:</div>
                <div>${formatCurrency(asset.assessedValue)}</div>

                <div class="font-bold">Est. Useful Life:</div>
                <div>${details.estimatedUsefulLife || 'N/A'} years</div>
            </div>
        `;
        assetDetailsContainer.innerHTML = detailsHtml;
    }

    function renderDepreciationTable(schedule) {
        if (!schedule || schedule.length === 0) {
            depreciationTableContainer.innerHTML = '<p>No depreciation schedule available for this asset.</p>';
            return;
        }

        const table = document.createElement('table');
        table.className = 'w-full text-xs border-collapse border border-black';
        table.innerHTML = `
            <thead class="bg-gray-100">
                <tr>
                    <th class="border border-black p-1">Year</th>
                    <th class="border border-black p-1">Depreciation</th>
                    <th class="border border-black p-1">Accum. Depreciation</th>
                    <th class="border border-black p-1">Book Value</th>
                </tr>
            </thead>
            <tbody>
                ${schedule.map(entry => `
                    <tr class="border-b">
                        <td class="border border-black p-1 text-center">${entry.year}</td>
                        <td class="border border-black p-1 text-right">${formatCurrency(entry.depreciation)}</td>
                        <td class="border border-black p-1 text-right">${formatCurrency(entry.accumulatedDepreciation)}</td>
                        <td class="border border-black p-1 text-right">${formatCurrency(entry.bookValue)}</td>
                    </tr>
                `).join('')}
            </tbody>
        `;
        depreciationTableContainer.innerHTML = '';
        depreciationTableContainer.appendChild(table);
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
            const { asset, schedule } = await fetchWithAuth(API_ENDPOINT);
            renderAssetDetails(asset);
            renderDepreciationTable(schedule);
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