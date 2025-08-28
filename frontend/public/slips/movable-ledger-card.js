// FILE: frontend/public/slips/movable-ledger-card.js
import { getCurrentUser, gsoLogout } from '../js/auth.js';
import { fetchWithAuth } from '../js/api.js';
import { formatCurrency, formatDate } from './slip-page-common.js';

document.addEventListener('DOMContentLoaded', async () => {
    try {
        const user = await getCurrentUser();
        if (!user) return;

        initializeLayout(user, gsoLogout);
        initializePropertyCardPage();
    } catch (error) {
        console.error("Authentication failed on property card page:", error);
    }
});

function initializePropertyCardPage() {
    const cardContainer = document.getElementById('property-card-container');
    const printBtn = document.getElementById('print-card-btn');

    async function loadPropertyCard() {
        const urlParams = new URLSearchParams(window.location.search);
        const assetId = urlParams.get('id');

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