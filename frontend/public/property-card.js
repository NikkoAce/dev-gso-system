// FILE: frontend/public/property-card.js
import { fetchWithAuth } from './api.js';

document.addEventListener('DOMContentLoaded', async () => {
    try {
        const user = await getCurrentUser();
        if (!user) return;

        initializeLayout(user);
        initializePropertyCardPage(user);
    } catch (error) {
        console.error("Authentication failed on property card page:", error);
    }
});

function initializePropertyCardPage(currentUser) {
    const cardContainer = document.getElementById('property-card-container');
    const printButton = document.getElementById('print-card-btn');

    const formatCurrency = (value) => new Intl.NumberFormat('en-PH', { style: 'currency', currency: 'PHP' }).format(value || 0);
    const formatDate = (dateString) => dateString ? new Date(dateString).toLocaleDateString('en-CA') : 'N/A';

    async function fetchAndRenderCard() {
        const urlParams = new URLSearchParams(window.location.search);
        const assetId = urlParams.get('id');

        if (!assetId) {
            cardContainer.innerHTML = `<p class="text-center text-red-500">No asset ID provided.</p>`;
            return;
        }

        try {
            const asset = await fetchWithAuth(`assets/${assetId}`);
            renderCard(asset);
        } catch (error) {
            console.error('Failed to fetch property card data:', error);
            cardContainer.innerHTML = `<p class="text-center text-red-500">Error loading property card: ${error.message}</p>`;
        }
    }

    function renderCard(asset) {
        let historyRows = '';
        if (asset.history && asset.history.length > 0) {
            // Sort history from newest to oldest for better readability
            const sortedHistory = asset.history.sort((a, b) => new Date(b.date) - new Date(a.date));

            sortedHistory.forEach(entry => {
                historyRows += `
                    <tr class="border-b">
                        <td class="border border-black p-1 text-center">${formatDate(entry.date)}</td>
                        <td class="border border-black p-1">${entry.event}</td>
                        <td class="border border-black p-1">${entry.from || ''}</td>
                        <td class="border border-black p-1">${entry.to || ''}</td>
                        <td class="border border-black p-1">${entry.details || ''}</td>
                        <td class="border border-black p-1">${entry.user || 'System'}</td>
                    </tr>
                `;
            });
        } else {
            historyRows = `<tr><td colspan="6" class="p-2 text-center text-gray-500">No history recorded.</td></tr>`;
        }

        // Add empty rows for a consistent printed look
        for (let i = (asset.history?.length || 0); i < 10; i++) {
            historyRows += `<tr><td class="border border-black p-2 h-8" colspan="6"></td></tr>`;
        }

        cardContainer.innerHTML = `
            <div class="text-center mb-4">
                <h2 class="text-xl font-bold">PROPERTY CARD</h2>
                <h3 class="font-semibold">LGU Daet, Camarines Norte</h3>
            </div>
            <div class="grid grid-cols-4 gap-x-4 text-sm mb-4 border-t border-b py-2">
                <div><strong>Property, Plant & Equipment:</strong></div>
                <div class="col-span-3 font-semibold">${asset.category}</div>
                <div><strong>Description:</strong></div>
                <div class="col-span-3 font-semibold">${asset.description}</div>
            </div>
            <div class="grid grid-cols-4 gap-x-4 text-sm mb-4 border-b pb-2">
                <div><strong>Property Number:</strong></div>
                <div class="font-semibold">${asset.propertyNumber}</div>
                <div><strong>Acquisition Cost:</strong></div>
                <div class="font-semibold">${formatCurrency(asset.acquisitionCost)}</div>
                <div><strong>Acquisition Date:</strong></div>
                <div class="font-semibold">${formatDate(asset.acquisitionDate)}</div>
                <div><strong>Fund Source:</strong></div>
                <div class="font-semibold">${asset.fundSource}</div>
            </div>

            <table class="w-full text-xs border-collapse border border-black">
                <thead class="bg-gray-100">
                    <tr>
                        <th class="border border-black p-1 w-[15%]">Date</th>
                        <th class="border border-black p-1 w-[12%]">Event</th>
                        <th class="border border-black p-1 w-[15%]">From</th>
                        <th class="border border-black p-1 w-[15%]">To</th>
                        <th class="border border-black p-1 w-[31%]">Details/Remarks</th>
                        <th class="border border-black p-1 w-[12%]">User</th>
                    </tr>
                </thead>
                <tbody>
                    ${historyRows}
                </tbody>
            </table>
        `;
    }

    printButton.addEventListener('click', () => {
        window.print();
    });

    fetchAndRenderCard();
}