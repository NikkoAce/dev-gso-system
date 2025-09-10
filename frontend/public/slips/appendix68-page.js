import { getCurrentUser, gsoLogout } from '../js/auth.js';
import { initializeSlipPage } from '../js/slip-page-common.js';

document.addEventListener('DOMContentLoaded', async () => {
    try {
        const user = await getCurrentUser();
        if (!user) return;

        if (!user.permissions?.includes('slip:generate')) {
            window.location.href = '../dashboard/dashboard.html';
            return;
        }

        initializeLayout(user, gsoLogout);

        const config = {
            slipType: 'A68',
            slipTitle: 'Report of Waste Materials',
            apiEndpoint: 'appendix68',
            numberProperty: 'appendixNumber',
            localStorageKeys: {
                create: 'assetsForA68', // This key is set in registry.js
                reprint: 'reprintA68'
            },
            domIds: {
                pageTitle: 'page-title',
                formContainer: 'form-container',
                backButton: 'back-button',
                saveButton: 'save-button',
                reprintButton: 'reprint-button',
                issuedDateInput: 'issued-date', // Only one date for this slip
                receivedDateInput: 'issued-date' // Map to the same input
            },
            backUrls: {
                create: '../assets/asset-registry.html',
                reprint: '../slips/slip-history.html'
            },
            populateFormFn: (slipData) => {
                document.getElementById('appendix-number').textContent = slipData.appendixNumber;
                document.getElementById('issued-date').value = new Date(slipData.date || Date.now()).toISOString().split('T')[0];
                document.getElementById('signatory-1-name').textContent = slipData.user?.name || user.name;

                const assetList = document.getElementById('asset-list');
                let totalAmount = 0;
                assetList.innerHTML = slipData.assets.map((asset, index) => {
                    // In a real scenario, sales data would come from the slipData. For now, it's blank.
                    return `
                    <tr>
                        <td class="border border-black p-1 text-center">${index + 1}</td>
                        <td class="border border-black p-1 text-center">${asset.quantity || 1}</td>
                        <td class="border border-black p-1 text-center">${asset.unit || 'unit'}</td>
                        <td class="border border-black p-1">${asset.description}</td>
                        <td class="border border-black p-1"></td> <!-- OR No. -->
                        <td class="border border-black p-1"></td> <!-- Date -->
                        <td class="border border-black p-1"></td> <!-- Amount -->
                    </tr>
                `}).join('');
                document.getElementById('total-amount').textContent = new Intl.NumberFormat('en-PH', { style: 'currency', currency: 'PHP' }).format(totalAmount);
            },
            checkFundSource: false // No fund source check needed for this slip
        };

        initializeSlipPage(config, user);

    } catch (error) {
        console.error("Initialization failed:", error);
    }
});