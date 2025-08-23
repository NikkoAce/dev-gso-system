// FILE: frontend/public/ics-page.js
import { initializeSlipPage, formatCurrency, formatDate } from '../js/slip-page-common.js';

document.addEventListener('DOMContentLoaded', async () => {
    try {
        const user = await getCurrentUser();
        if (!user) return;

        initializeLayout(user);

        // The populateIcsForm function is passed as a callback to the shared initializer.
        // It contains only the logic specific to rendering the ICS form itself.
        const populateIcsForm = (icsData) => {
            const icsContainer = document.getElementById('ics-form-container');
            let assetsHTML = '';
            let totalAmount = 0;

            icsData.assets.forEach(asset => {
                totalAmount += asset.acquisitionCost;
                let icsDescription = `<div>${asset.description}</div>`;
                if (asset.specifications && asset.specifications.length > 0) {
                    asset.specifications.forEach(spec => {
                        icsDescription += `<div class="text-xs text-gray-600">${spec.key}: ${spec.value}</div>`;
                    });
                }
                assetsHTML += `
                    <tr>
                        <td class="border border-gray-400 p-2 text-center">1</td>
                        <td class="border border-gray-400 p-2 text-center">unit</td>
                        <td class="border border-gray-400 p-2">${icsDescription}</td>
                        <td class="border border-gray-400 p-2 text-right">${formatCurrency(asset.acquisitionCost)}</td>
                        <td class="border border-gray-400 p-2 text-center">${asset.usefulLife} years</td>
                    </tr>
                `;
            });

            for (let i = icsData.assets.length; i < 5; i++) {
                assetsHTML += `<tr><td class="border border-gray-400 p-2 h-8" colspan="5"></td></tr>`;
            }
            
            const footerHTML = `
                <tr class="font-bold bg-gray-50">
                    <td class="border border-gray-400 p-2 text-right" colspan="3">TOTAL</td>
                    <td class="border border-gray-400 p-2 text-right">${formatCurrency(totalAmount)}</td>
                    <td class="border border-gray-400 p-2"></td>
                </tr>
            `;

            icsContainer.innerHTML = `
                <div class="text-center mb-6">
                    <h2 class="text-xl font-bold">INVENTORY CUSTODIAN SLIP</h2>
                    <h3 class="font-semibold">LGU Daet, Camarines Norte</h3>
                    <p class="text-sm">Fund: <span class="font-semibold">${(icsData.assets && icsData.assets.length > 0) ? icsData.assets[0].fundSource : 'N/A'}</span></p>
                </div>
                <div class="flex justify-between mb-4 text-sm">
                    <span>Entity Name: LGU Daet</span>
                    <span class="font-bold">ICS No: <span id="ics-no">${icsData.icsNumber || icsData.number}</span></span>
                </div>
                <table class="w-full border-collapse border border-gray-400 text-sm">
                    <thead>
                        <tr class="bg-gray-100">
                            <th class="border border-gray-400 p-2 text-center" width="10%">Quantity</th>
                            <th class="border border-gray-400 p-2 text-center" width="10%">Unit</th>
                            <th class="border border-gray-400 p-2 text-left">Description</th>
                            <th class="border border-gray-400 p-2 text-right" width="15%">Unit Cost</th>
                            <th class="border border-gray-400 p-2 text-center" width="20%">Est. Useful Life</th>
                        </tr>
                    </thead>
                    <tbody>${assetsHTML}</tbody>
                    <tfoot>${footerHTML}</tfoot>
                </table>
                <div class="grid grid-cols-2 gap-4 mt-8 pt-4 border-t-2 border-black">
                    <div class="text-sm">
                        <p class="font-bold">Received from:</p>
                        <div class="mt-12 text-center">
                            <p class="font-bold uppercase border-b border-black">DR. RAYCHEL B. VALENCIA</p>
                            <p>(Signature Over Printed Name)</p>
                        </div>
                        <div class="mt-4 text-center">
                            <p class="border-b border-black">Municipal Administrator/OIC GSO</p>
                            <p>(Position/Office)</p>
                        </div>
                        <div class="mt-4 text-center">
                            <input type="date" id="ics-issued-date-input" class="border-b border-black text-center w-full" value="${formatDate(icsData.issuedDate)}">
                            <p>(Date)</p>
                        </div>
                    </div>
                    <div class="text-sm">
                        <p class="font-bold">Received by:</p>
                        <div class="mt-12 text-center">
                            <p class="font-bold uppercase border-b border-black">${icsData.custodian.name}</p>
                            <p>(Signature Over Printed Name)</p>
                        </div>
                        <div class="mt-4 text-center">
                            <p class="border-b border-black">${icsData.custodian.designation || ''}, ${icsData.custodian.office || ''}</p>
                            <p>(Position/Office)</p>
                        </div>
                        <div class="mt-4 text-center">
                            <input type="date" id="ics-received-date-input" class="border-b border-black text-center w-full" value="${formatDate(icsData.receivedDate)}">
                            <p>(Date)</p>
                        </div>
                    </div>
                </div>
            `;
        }

        // Configuration object that tells the common initializer how to behave for an ICS.
        const icsConfig = {
            slipType: 'ICS',
            slipTitle: 'Inventory Custodian Slip',
            apiEndpoint: 'ics',
            numberProperty: 'icsNumber',
            checkFundSource: false, // ICS does not require same fund source
            localStorageKeys: {
                create: 'assetsForICS',
                reprint: 'icsToReprint'
            },
            domIds: {
                pageTitle: 'ics-page-title',
                saveButton: 'save-and-print-ics',
                reprintButton: 'reprint-ics-button',
                backButton: 'back-button',
                formContainer: 'ics-form-container',
                issuedDateInput: 'ics-issued-date-input',
                receivedDateInput: 'ics-received-date-input'
            },
            backUrls: {
                create: '../assets/asset-registry.html',
                reprint: './slip-history.html'
            },
            populateFormFn: populateIcsForm
        };

        // Initialize the page with the common logic
        initializeSlipPage(icsConfig, user);

    } catch (error) {
        console.error("Authentication failed on ICS page:", error);
    }
});
