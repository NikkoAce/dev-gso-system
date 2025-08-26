// FILE: frontend/public/par-page.js
import { getCurrentUser, gsoLogout } from '../js/auth.js';
import { initializeSlipPage, formatCurrency, formatDate } from '../js/slip-page-common.js';

document.addEventListener('DOMContentLoaded', async () => {
    try {
        const user = await getCurrentUser();
        if (!user || user.office !== 'GSO') {
            window.location.href = '../dashboard/dashboard.html';
            return;
        }

        initializeLayout(user, gsoLogout);

        // The populateParForm function is passed as a callback to the shared initializer.
        // It contains only the logic specific to rendering the PAR form itself.
        const populateParForm = (parData) => {
            const parTableBody = document.getElementById('par-table-body');
            const parTableFooter = document.getElementById('par-table-footer');
            parTableBody.innerHTML = '';
            parTableFooter.innerHTML = ''; // Clear footer
            let totalAmount = 0;

            parData.assets.forEach(asset => {
                totalAmount += asset.acquisitionCost;
                let parDescription = `<div>${asset.description}</div>`;
                if (asset.specifications && asset.specifications.length > 0) {
                    asset.specifications.forEach(spec => {
                        parDescription += `<div class="text-xs text-gray-600">${spec.key}: ${spec.value}</div>`;
                    });
                }
                const row = `
                    <tr>
                        <td class="border border-gray-400 p-2 text-center">1</td>
                        <td class="border border-gray-400 p-2 text-center">unit</td>
                        <td class="border border-gray-400 p-2">${parDescription}</td>
                        <td class="border border-gray-400 p-2 text-center">${asset.propertyNumber}</td>
                        <td class="border border-gray-400 p-2 text-center">${formatDate(asset.acquisitionDate)}</td>
                        <td class="border border-gray-400 p-2 text-right">${formatCurrency(asset.acquisitionCost)}</td>
                    </tr>
                `;
                parTableBody.innerHTML += row;
            });
            
            for (let i = parData.assets.length; i < 5; i++) {
                parTableBody.innerHTML += `<tr><td class="border border-gray-400 p-2 h-8" colspan="6"></td></tr>`;
            }
            
            parTableFooter.innerHTML = `
                <tr class="font-bold bg-gray-50">
                    <td class="border border-gray-400 p-2 text-right" colspan="5">TOTAL</td>
                        <td class="border border-gray-400 p-2 text-right">${formatCurrency(totalAmount)}</td>
                    </tr>
                `;
                
            document.getElementById('par-no').textContent = parData.parNumber || parData.number;
            if (parData.assets && parData.assets.length > 0) {
                document.getElementById('par-fund-source').textContent = parData.assets[0].fundSource;
            }
            document.getElementById('par-custodian-name').textContent = parData.custodian.name;
            document.getElementById('par-custodian-designation').textContent = parData.custodian.designation || '';
            document.getElementById('par-custodian-date-input').value = formatDate(parData.receivedDate);
            document.getElementById('par-issued-date-input').value = formatDate(parData.issuedDate);
        }

        // Configuration object that tells the common initializer how to behave for a PAR.
        const parConfig = {
            slipType: 'PAR',
            slipTitle: 'Property Acknowledgment Receipt',
            apiEndpoint: 'pars',
            numberProperty: 'parNumber',
            checkFundSource: true,
            localStorageKeys: {
                create: 'assetsForPAR',
                reprint: 'parToReprint'
            },
            domIds: {
                pageTitle: 'par-page-title',
                saveButton: 'save-and-print-par',
                reprintButton: 'reprint-par-button',
                backButton: 'back-from-par-btn',
                formContainer: 'par-form-container',
                issuedDateInput: 'par-issued-date-input',
                receivedDateInput: 'par-custodian-date-input'
            },
            backUrls: {
                create: '../assets/asset-registry.html',
                reprint: './slip-history.html'
            },
            populateFormFn: populateParForm
        };

        // Initialize the page with the common logic
        initializeSlipPage(parConfig, user);

    } catch (error) {
        console.error("Authentication failed on PAR page:", error);
    }
});
