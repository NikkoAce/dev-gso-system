import { fetchWithAuth } from '../js/api.js';
import { exportToPDF, togglePreviewMode } from '../js/report-utils.js';
import { createAuthenticatedPage } from '../js/page-loader.js';

createAuthenticatedPage({
    permission: 'report:generate',
    pageInitializer: initializePropertyCardPage,
    pageName: 'Immovable Property Card'
});

function initializePropertyCardPage(user) {
    // --- STATE & CONFIG ---
    const urlParams = new URLSearchParams(window.location.search);
    const assetId = urlParams.get('id');
    let currentAsset = null;
    const API_ENDPOINT = `immovable-assets/${assetId}`;

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
            <div class="grid grid-cols-2 md:grid-cols-4 gap-x-4 gap-y-2 border p-2">
                <div class="font-bold">Asset Name:</div>
                <div class="md:col-span-3">${asset.name}</div>
                
                <div class="font-bold">Property Index No.:</div>
                <div>${asset.propertyIndexNumber}</div>
                
                <div class="font-bold">Type:</div>
                <div>${asset.type}</div>

                <div class="font-bold">Location:</div>
                <div class="md:col-span-3">${asset.location}</div>

                <div class="font-bold">Acquisition Date:</div>
                <div>${formatDate(asset.dateAcquired)}</div>

                <div class="font-bold">Assessed Value:</div>
                <div>${formatCurrency(asset.assessedValue)}</div>
            </div>
        `;
        assetDetailsContainer.innerHTML = detailsHtml;
    }

    function renderHistoryTable(history) {
        if (!history || history.length === 0) {
            historyTableContainer.innerHTML = '<p>No history records found.</p>';
            return;
        }

        const sortedHistory = [...history].sort((a, b) => new Date(a.date) - new Date(b.date));

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
        const fileName = `Immovable-Property-Card-${currentAsset?.propertyIndexNumber || 'report'}.pdf`;
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