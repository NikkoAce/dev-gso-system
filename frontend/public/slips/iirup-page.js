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

                const formContainer = document.getElementById('form-container');

                // Get the footer template HTML *before* clearing the container.
                const footerTemplateHTML = document.getElementById('iirup-footer-content')?.innerHTML;
                if (!footerTemplateHTML) {
                    formContainer.innerHTML = '<p class="text-center text-red-500">Error: Report footer template not found.</p>';
                    return;
                }
                formContainer.innerHTML = ''; // Now clear the container.

                const assets = slipData.assets || [];
                const ITEMS_PER_PAGE = 10;
                const totalPages = Math.ceil(assets.length / ITEMS_PER_PAGE) || 1;

                for (let i = 0; i < totalPages; i++) {
                    const pageAssets = assets.slice(i * ITEMS_PER_PAGE, (i + 1) * ITEMS_PER_PAGE);
                    const isLastPage = i === totalPages - 1;

                    let assetRows = '';
                    pageAssets.forEach(asset => {
                        const depreciation = 0; // Placeholder
                        const impairment = asset.impairmentLosses || 0;
                        const bookValue = asset.acquisitionCost - depreciation - impairment;
                        assetRows += `
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
                    });

                    const remainingRows = ITEMS_PER_PAGE - pageAssets.length;
                    for (let j = 0; j < remainingRows; j++) {
                        assetRows += `<tr><td class="border border-black h-6" colspan="10"></td></tr>`;
                    }

                    let footerHTML = '';
                    if (isLastPage) {
                        const grandTotalCost = assets.reduce((sum, asset) => sum + asset.acquisitionCost, 0);
                        footerHTML = `
                            <tr class="font-bold">
                                <td colspan="5" class="border border-black p-1 text-center">TOTAL</td>
                                <td class="border border-black p-1 text-right">${formatCurrency(grandTotalCost)}</td>
                                <td colspan="3" class="border border-black p-1"></td>
                                <td class="border border-black p-1"></td>
                            </tr>
                        `;
                    }

                    const pageDiv = document.createElement('div');
                    pageDiv.className = isLastPage ? 'printable-page' : 'printable-page page-break-after';
                    pageDiv.innerHTML = `
                        <div class="text-center mb-4">
                            <h3 class="font-bold text-lg">INVENTORY AND INSPECTION REPORT OF UNSERVICEABLE PROPERTY</h3>
                            <p class="text-sm">(IIRUP)</p>
                        </div>
                        <div class="flex justify-between items-end mt-4 text-sm">
                            <span>Entity Name: <span class="font-semibold">LGU of Daet</span></span>
                            <span>Fund Cluster: <span class="font-semibold">01</span></span>
                        </div>
                        <table class="w-full text-xs border-collapse border border-black mt-4">
                            <thead>
                                <tr class="bg-gray-100 text-center">
                                    <th rowspan="2" class="border border-black p-1">Date Acquired</th>
                                    <th rowspan="2" class="border border-black p-1">Property No.</th>
                                    <th rowspan="2" class="border border-black p-1">Description</th>
                                    <th rowspan="2" class="border border-black p-1">Qty.</th>
                                    <th rowspan="2" class="border border-black p-1">Unit Cost</th>
                                    <th rowspan="2" class="border border-black p-1">Total Cost</th>
                                    <th colspan="2" class="border border-black p-1">Accumulated</th>
                                    <th rowspan="2" class="border border-black p-1">Book Value</th>
                                    <th rowspan="2" class="border border-black p-1">Remarks</th>
                                </tr>
                                <tr class="bg-gray-100 text-center">
                                    <th class="border border-black p-1">Depreciation</th>
                                    <th class="border border-black p-1">Impairment</th>
                                </tr>
                            </thead>
                            <tbody id="asset-list">${assetRows}</tbody>
                            <tfoot>${footerHTML}</tfoot>
                        </table>
                        ${isLastPage ? footerTemplateHTML : ''}
                        <div class="text-right text-xs italic mt-8 pt-2 border-t border-dashed">
                            Page ${i + 1} of ${totalPages}
                        </div>
                    `;
                    formContainer.appendChild(pageDiv);
                }
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