import { getCurrentUser, gsoLogout } from '../js/auth.js';
import { fetchWithAuth } from '../js/api.js';
import { exportToPDF, togglePreviewMode } from '../js/report-utils.js';

document.addEventListener('DOMContentLoaded', async () => {
    try {
        const user = await getCurrentUser();
        if (!user) return;

        if (!user.permissions || !user.permissions.includes('asset:read')) {
            window.location.href = '../dashboard/dashboard.html';
            return;
        }
        initializeLayout(user, gsoLogout);
        initializePropertyCardPage();
    } catch (error) {
        console.error("Authentication failed on property card page:", error);
    }
});

function initializePropertyCardPage() {
    // --- STATE & CONFIG ---
    const urlParams = new URLSearchParams(window.location.search);
    const assetId = urlParams.get('id');
    let currentAsset = null;
    const API_ENDPOINT = `assets/${assetId}/property-card`;

    // --- DOM ELEMENTS ---
    const loadingState = document.getElementById('loading-state');
    const errorState = document.getElementById('error-state');
    const errorMessage = document.getElementById('error-message');
    const reportContent = document.getElementById('report-content');
    const assetDetailsContainer = document.getElementById('asset-details-container');
    const historyTableContainer = document.getElementById('history-table-container');
    const printReportBtn = document.getElementById('print-report-btn');
    const exportPdfBtn = document.getElementById('export-pdf-btn');
    const previewBtn = document.getElementById('preview-btn');
    const exitPreviewBtn = document.getElementById('exit-preview-btn');

    // --- UTILITY FUNCTIONS ---
    const formatCurrency = (value) => new Intl.NumberFormat('en-PH', { style: 'currency', currency: 'PHP' }).format(value || 0);
    const formatDate = (dateString) => dateString ? new Date(dateString).toLocaleDateString('en-CA') : 'N/A';

    // --- RENDERING FUNCTIONS ---
    function renderAssetDetails(asset) {
        let detailsHtml = `
            <div class="grid grid-cols-2 md:grid-cols-3 gap-x-4 gap-y-2 border p-2">
                <div class="font-bold">Description:</div>
                <div class="md:col-span-2">${asset.description}</div>
                
                <div class="font-bold">Property No.:</div>
                <div>${asset.propertyNumber}</div>
                
                <div class="font-bold">Category:</div>
                <div>${asset.category}</div>

                <div class="font-bold">Custodian:</div>
                <div>${asset.custodian?.name || 'N/A'}</div>

                <div class="font-bold">Acquisition Date:</div>
                <div>${formatDate(asset.acquisitionDate)}</div>

                <div class="font-bold">Acquisition Cost:</div>
                <div>${formatCurrency(asset.acquisitionCost)}</div>
            </div>
        `;
        assetDetailsContainer.innerHTML = detailsHtml;
    }

    function renderHistoryTable(history) {
        if (!history || history.length === 0) {
            historyTableContainer.innerHTML = '<p>No history records found.</p>';
            return;
        }

        const sortedHistory = [...history].sort((a, b) => new Date(b.date) - new Date(a.date));

        const table = document.createElement('table');
        table.className = 'w-full text-xs border-collapse border border-black';
        table.innerHTML = `
            <thead class="bg-gray-100">
                <tr>
                    <th class="border border-black p-1">Date</th>
                    <th class="border border-black p-1">Event</th>
                    <th class="border border-black p-1">Details</th>
                    <th class="border border-black p-1">User</th>
                </tr>
            </thead>
            <tbody>
                ${sortedHistory.map(entry => `
                    <tr class="border-b">
                        <td class="border border-black p-1">${formatDate(entry.date)}</td>
                        <td class="border border-black p-1">${entry.event}</td>
                        <td class="border border-black p-1">${entry.details}</td>
                        <td class="border border-black p-1">${entry.user}</td>
                    </tr>
                `).join('')}
            </tbody>
        `;
        historyTableContainer.innerHTML = '';
        historyTableContainer.appendChild(table);
    }

    // --- CORE LOGIC ---
    async function loadPropertyCard() {
        if (!assetId) {
            loadingState.classList.add('hidden');
            errorMessage.textContent = 'No Asset ID provided. Please return to the registry and select an asset.';
            errorState.classList.remove('hidden');
            return;
        }

        try {
            const assetData = await fetchWithAuth(API_ENDPOINT);
            currentAsset = assetData;
            
            renderAssetDetails(assetData);
            renderHistoryTable(assetData.history);

            loadingState.classList.add('hidden');
            reportContent.classList.remove('hidden');
            lucide.createIcons();

        } catch (error) {
            console.error('Error fetching property card data:', error);
            loadingState.classList.add('hidden');
            errorMessage.textContent = `Error: ${error.message}`;
            errorState.classList.remove('hidden');
        }
    }

    function handleExportPDF() {
        const fileName = `Movable-Property-Card-${currentAsset?.propertyNumber || 'report'}.pdf`;
        exportToPDF({
            reportElementId: 'report-output',
            fileName: fileName,
            buttonElement: exportPdfBtn,
            orientation: 'portrait',
            format: 'a4'
        });
    }

    function handleTogglePreview() {
        togglePreviewMode({
            orientation: 'portrait',
            exitButtonId: 'exit-preview-btn'
        });
    }

    // --- EVENT LISTENERS ---
    printReportBtn.addEventListener('click', () => window.print());
    exportPdfBtn.addEventListener('click', handleExportPDF);
    previewBtn.addEventListener('click', handleTogglePreview);
    exitPreviewBtn.addEventListener('click', handleTogglePreview);

    // --- INITIALIZATION ---
    loadPropertyCard();
}