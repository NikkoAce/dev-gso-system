import { initializeSlipPage, formatCurrency, formatDate } from '../js/slip-page-common.js';
import { fetchWithAuth } from '../js/api.js';
import { createAuthenticatedPage } from '../js/page-loader.js';

createAuthenticatedPage({
    permission: 'slip:generate',
    pageInitializer: (user) => {
        const config = {
            slipType: 'IIRUP',
            slipTitle: 'Inventory and Inspection Report of Unserviceable Property',
            apiEndpoint: 'iirups',
            numberProperty: 'iirupNumber',
            localStorageKeys: {
                create: 'assetsForIIRUP', // This key is set in registry.js
                reprint: 'reprintIIRUP'
            },
            domIds: {
                pageTitle: 'page-title',
                formContainer: 'form-container',
                backButton: 'back-button',
                saveButton: 'save-button',
                reprintButton: 'reprint-button',
                // IIRUP doesn't have a single date input, it's part of the footer.
                // We can ignore these for this slip type by pointing to a dummy ID.
                issuedDateInput: 'page-title',
                receivedDateInput: 'page-title'
            },
            backUrls: {
                create: '../assets/asset-registry.html',
                reprint: '../slips/slip-history.html'
            },
            populateFormFn: (slipData) => {
                // The slip number is part of the footer in IIRUP, but we can add it here if needed.
                // For now, we'll rely on the title.
                document.getElementById('signatory-1-name').textContent = slipData.user?.name || user.name;

                const assetList = document.getElementById('asset-list');
                let totalCost = 0;
                assetList.innerHTML = slipData.assets.map(asset => {
                    totalCost += asset.acquisitionCost;
                    // For IIRUP, we need more details than just description.
                    // In create mode, we have the full asset object.
                    // In reprint mode, we have what was saved in the IIRUP model.
                    const depreciation = 0; // Placeholder, calculation is complex
                    const impairment = asset.impairmentLosses || 0;
                    const bookValue = asset.acquisitionCost - depreciation - impairment;

                    return `
                        <tr class="text-center">
                            <td class="border border-black p-1">${formatDate(asset.acquisitionDate)}</td>
                            <td class="border border-black p-1">${asset.propertyNumber}</td>
                            <td class="border border-black p-1 text-left">${asset.description}</td>
                            <td class="border border-black p-1">1</td>
                            <td class="border border-black p-1 text-right">${formatCurrency(asset.acquisitionCost)}</td>
                            <td class="border border-black p-1 text-right">${formatCurrency(asset.acquisitionCost)}</td>
                            <td class="border border-black p-1 text-right">${formatCurrency(depreciation)}</td>
                            <td class="border border-black p-1 text-right">${formatCurrency(impairment)}</td>
                            <td class="border border-black p-1 text-right">${formatCurrency(bookValue)}</td>
                            <td class="border border-black p-1 text-left">${asset.remarks || asset.condition || ''}</td>
                        </tr>
                    `;
                }).join('');
                
                // Add empty rows for a consistent look
                for (let i = slipData.assets.length; i < 10; i++) {
                    assetList.innerHTML += `<tr><td class="border border-black h-6" colspan="10"></td></tr>`;
                }

                document.getElementById('grand-total-cost').textContent = formatCurrency(totalCost);
            },
            checkFundSource: false // No fund source check needed for this slip
        };

        // Custom initializer to override save behavior for IIRUP, which has no date inputs
        function customInitializeSlipPage(config, currentUser) {
            initializeSlipPage(config, currentUser); // Run the original setup

            const saveButton = document.getElementById(config.domIds.saveButton);
            if (saveButton) {
                // We need to get the original data prepared by the common function
                const createDataString = localStorage.getItem(config.localStorageKeys.create);
                if (createDataString) {
                    const selectedAssets = JSON.parse(createDataString);

                    const dataToSave = {
                        assetIds: selectedAssets.map(a => a._id)
                        // The controller will generate the number and date
                    };

                    // Replace the event listener to avoid trying to read date inputs
                    const newSaveButton = saveButton.cloneNode(true);
                    saveButton.parentNode.replaceChild(newSaveButton, saveButton);

                    newSaveButton.addEventListener('click', async () => {
                        try {
                            const savedSlip = await fetchWithAuth(config.apiEndpoint, {
                                method: 'POST',
                                body: JSON.stringify(dataToSave)
                            });
                            alert(`${config.slipType} saved successfully!`);
                            localStorage.setItem(config.localStorageKeys.reprint, JSON.stringify(savedSlip));
                            window.print();
                            window.location.href = config.backUrls.create;
                        } catch (error) {
                            alert(`Error: ${error.message}`);
                        }
                    });
                }
            }
        }

        customInitializeSlipPage(config, user);

    },
    pageName: 'IIRUP Slip'
});