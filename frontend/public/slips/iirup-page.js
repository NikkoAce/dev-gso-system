import { initializeSlipPage, formatCurrency, formatDate } from '../js/slip-page-common.js';
import { fetchWithAuth } from '../js/api.js';
import { createAuthenticatedPage } from '../js/page-loader.js';
import { createUIManager } from '../js/ui.js';
import { exportToPDF, togglePreviewMode } from '../js/report-utils.js';

createAuthenticatedPage({
    permission: 'slip:generate',
    pageInitializer: (user) => {
        const { showToast } = createUIManager();
        let currentSlipData = null;
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
                pageTitle: 'page-title', // The main H1 title of the page
                formContainer: 'form-container', // The main container for the slip content
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
            populateFormFn: async (slipData) => {
                currentSlipData = slipData;

                let settingsMap = {};
                try {
                    const settings = await fetchWithAuth('signatories');
                    settingsMap = settings.reduce((acc, setting) => {
                        acc[setting.key] = setting.value;
                        return acc;
                    }, {});
                } catch (error) {
                    console.warn('Could not load signatory settings, using defaults.', error);
                }

                const inspectionOfficer = settingsMap.iirup_inspection_officer || { name: '________________________', title: 'Inspection Officer' };

                const formContainer = document.getElementById(config.domIds.formContainer);

                // Get the footer template HTML *before* clearing the container.
                const headerTemplateHTML = document.getElementById('iirup-header-content')?.innerHTML;
                const footerTemplateHTML = document.getElementById('iirup-footer-content')?.innerHTML;
                if (!footerTemplateHTML || !headerTemplateHTML) {
                    formContainer.innerHTML = '<p class="text-center text-red-500">Error: Report header or footer template not found.</p>';
                    return;
                }
                formContainer.innerHTML = ''; // Now clear the container.

                const assets = slipData.assets || [];
                const SINGLE_PAGE_CAPACITY = 6; // For pages with both header and footer
                const FIRST_PAGE_CAPACITY = 12; // For the first page of a multi-page report
                const FINAL_PAGE_CAPACITY = 6; // For the last page of a multi-page report
                const INTERMEDIATE_PAGE_CAPACITY = 15; // More items on pages without the footer
                const pages = [];

                let remainingAssets = [...assets];

                if (assets.length === 0) {
                    pages.push([]);
                } else if (assets.length <= SINGLE_PAGE_CAPACITY) {
                    pages.push(assets);
                } else {
                    // Step 1: Fill the first page
                    pages.push(remainingAssets.splice(0, FIRST_PAGE_CAPACITY));

                    // Step 2: Fill intermediate pages, leaving enough for the final page
                    while (remainingAssets.length > FINAL_PAGE_CAPACITY) {
                        pages.push(remainingAssets.splice(0, INTERMEDIATE_PAGE_CAPACITY));
                    }

                    // Step 3: Add the final page with whatever is left
                    if (remainingAssets.length > 0) {
                        pages.push(remainingAssets);
                    }
                }

                const totalPages = pages.length;

                for (let i = 0; i < totalPages; i++) {
                    const pageAssets = pages[i];
                    const isLastPage = i === totalPages - 1;
                    const isFirstPage = i === 0;

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

                    // Determine max items for padding rows
                    let maxItemsForThisPage;
                    if (totalPages === 1) {
                        maxItemsForThisPage = SINGLE_PAGE_CAPACITY;
                    } else if (isLastPage) {
                        maxItemsForThisPage = FINAL_PAGE_CAPACITY;
                    } else if (isFirstPage) {
                        maxItemsForThisPage = FIRST_PAGE_CAPACITY;
                    } else {
                        maxItemsForThisPage = INTERMEDIATE_PAGE_CAPACITY;
                    }
                    const remainingRows = Math.max(0, maxItemsForThisPage - pageAssets.length);
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

                    const logoHeader = isFirstPage ? headerTemplateHTML : '';

                    pageDiv.innerHTML = `
                        ${logoHeader}
                        <div class="text-center mb-4 mt-4">
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
                            <tbody>${assetRows}</tbody>
                            <tfoot>${footerHTML}</tfoot>
                        </table>
                        ${isLastPage ? footerTemplateHTML : ''}
                        <div class="text-right text-xs italic mt-8 pt-2 border-t border-dashed">
                            Page ${i + 1} of ${totalPages}
                        </div>
                    `;

                    // If it's the last page, populate the unique footer fields.
                    if (isLastPage) {
                        const signatoryNameEl = pageDiv.querySelector('#signatory-1-name');
                        if (signatoryNameEl) {
                            signatoryNameEl.textContent = slipData.user?.name || user.name;
                        }
                        // Populate inspection officer from settings
                        const inspectionOfficerNameEl = pageDiv.querySelector('#inspection-officer-name');
                        if (inspectionOfficerNameEl) {
                            inspectionOfficerNameEl.textContent = inspectionOfficer.name;
                        }
                        const inspectionOfficerTitleEl = pageDiv.querySelector('#inspection-officer-title');
                        if (inspectionOfficerTitleEl) {
                            inspectionOfficerTitleEl.textContent = inspectionOfficer.title;
                        }
                    }
                    formContainer.appendChild(pageDiv);
                }
            },
            checkFundSource: false // No fund source check needed for this slip
        };

        // Custom initializer to override save behavior for IIRUP, which has no date inputs
        function customInitializeSlipPage(config, currentUser) {
            // We need to get the original data before the common initializer clears it from localStorage.
            const createDataString = localStorage.getItem(config.localStorageKeys.create);
            let selectedAssets = [];
            if (createDataString) {
                selectedAssets = JSON.parse(createDataString);
            }

            // Now, run the common setup which will populate the form and also clear localStorage.
            initializeSlipPage(config, currentUser);

            const saveButton = document.getElementById(config.domIds.saveButton);
            if (saveButton && selectedAssets.length > 0) {
                // Replace the default event listener to avoid trying to read date inputs
                const newSaveButton = saveButton.cloneNode(true);
                saveButton.parentNode.replaceChild(newSaveButton, saveButton);

                newSaveButton.addEventListener('click', async () => {
                    try {
                        const dataToSave = { assetIds: selectedAssets.map(a => a._id) };
                        const savedSlip = await fetchWithAuth(config.apiEndpoint, { method: 'POST', body: JSON.stringify(dataToSave) });
                        showToast(`${config.slipType} saved successfully!`, 'success');
                        localStorage.setItem(config.localStorageKeys.reprint, JSON.stringify(savedSlip));
                        window.print();
                        window.location.href = config.backUrls.create;
                    } catch (error) {
                        showToast(`Error: ${error.message}`, 'error');
                    }
                });
            }
        }

        customInitializeSlipPage(config, user);

        // --- EXPORT AND PREVIEW LOGIC ---
        const exportPdfBtn = document.getElementById('export-pdf-btn');
        const previewBtn = document.getElementById('preview-btn');
        const exitPreviewBtn = document.querySelector('#exit-preview-btn') || document.createElement('button'); // Fallback

        function handleExportPDF() {
            if (!currentSlipData) return;
            const fileName = `IIRUP-${currentSlipData?.iirupNumber || 'report'}.pdf`;
            exportToPDF({
                reportElementId: 'report-output',
                fileName: fileName,
                buttonElement: exportPdfBtn,
                orientation: 'landscape',
                format: 'legal'
            });
        }

        function handleTogglePreview() {
            if (document.activeElement) document.activeElement.blur();
            setTimeout(() => {
                togglePreviewMode({
                    orientation: 'landscape',
                    exitButtonId: 'exit-preview-btn'
                });
            }, 50);
        }

        if (exportPdfBtn) exportPdfBtn.addEventListener('click', handleExportPDF);
        if (previewBtn) previewBtn.addEventListener('click', handleTogglePreview);
        if (exitPreviewBtn) exitPreviewBtn.addEventListener('click', handleTogglePreview);
    },
    pageName: 'IIRUP Slip'
});