// FILE: frontend/public/ics-page.js
import { initializeSlipPage, formatCurrency, formatDate } from '../js/slip-page-common.js';
import { fetchWithAuth } from '../js/api.js';
import { createUIManager } from '../js/ui.js';
import { exportToPDF, togglePreviewMode } from '../js/report-utils.js';
import { createAuthenticatedPage } from '../js/page-loader.js';

createAuthenticatedPage({
    permission: ['slip:generate', 'slip:read'],
    pageInitializer: (user) => {
        const { showToast } = createUIManager();
        let currentIcsData = null; // Variable to hold slip data for export

        // The populateIcsForm function is passed as a callback to the shared initializer.
        // It contains only the logic specific to rendering the ICS form itself.
        const populateIcsForm = async (icsData) => {
            currentIcsData = icsData; // Store the data for export functions
            const icsContainer = document.getElementById('ics-form-container');
            icsContainer.innerHTML = ''; // Clear previous content

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

            const issuedBy = settingsMap.par_ics_issued_by || { name: 'DR. RAYCHEL B. VALENCIA', title: 'Municipal Administrator/OIC GSO' };

            const assets = icsData.assets || [];
            // --- REVISED: Smart Chunking Logic with different capacities for each page type ---
            const SINGLE_PAGE_CAPACITY = { items: 10, lines: 25 };       // Smallest capacity for pages with both header and footer
            const FIRST_PAGE_CAPACITY = { items: 15, lines: 40 };      // Smaller capacity due to header
            const INTERMEDIATE_PAGE_CAPACITY = { items: 20, lines: 55 }; // Largest capacity
            const FINAL_PAGE_CAPACITY = { items: 12, lines: 30 };      // Smaller capacity for signatures and totals

            const pages = [];

            if (assets.length > 0) {
                const totalLineCount = assets.reduce((sum, asset) => sum + 1 + (asset.specifications?.length || 0), 0);

                if (assets.length <= SINGLE_PAGE_CAPACITY.items && totalLineCount <= SINGLE_PAGE_CAPACITY.lines) {
                    // Case 1: Everything fits on a single page
                    pages.push(assets);
                } else {
                    // Case 2: Multi-page logic
                    // Step 1: Work backwards to determine which assets belong on the final page.
                    const assetsForFinalPage = [];
                    let linesOnFinalPage = 0;
                    let splitIndex = assets.length;

                    for (let i = assets.length - 1; i >= 0; i--) {
                        const asset = assets[i];
                        const assetLineCount = 1 + (asset.specifications?.length || 0);
                        if (assetsForFinalPage.length < FINAL_PAGE_CAPACITY.items && (linesOnFinalPage + assetLineCount) <= FINAL_PAGE_CAPACITY.lines) {
                            assetsForFinalPage.unshift(asset);
                            linesOnFinalPage += assetLineCount;
                            splitIndex = i;
                        } else {
                            break;
                        }
                    }

                    // Step 2: Chunk the remaining assets for the first and intermediate pages.
                    const assetsForDistribution = assets.slice(0, splitIndex);
                    if (assetsForDistribution.length > 0) {
                        let currentPageAssets = [];
                        let currentLineCount = 0;
                        let isFirstPageOfBlock = true;

                        assetsForDistribution.forEach(asset => {
                            const assetLineCount = 1 + (asset.specifications?.length || 0);
                            const capacity = isFirstPageOfBlock ? FIRST_PAGE_CAPACITY : INTERMEDIATE_PAGE_CAPACITY;

                            const pageIsFull = currentPageAssets.length > 0 &&
                                (currentPageAssets.length >= capacity.items || currentLineCount + assetLineCount > capacity.lines);

                            if (pageIsFull) {
                                pages.push(currentPageAssets);
                                currentPageAssets = [];
                                currentLineCount = 0;
                                isFirstPageOfBlock = false; // Subsequent pages are intermediate
                            }
                            currentPageAssets.push(asset);
                            currentLineCount += assetLineCount;
                        });

                        if (currentPageAssets.length > 0) {
                            pages.push(currentPageAssets);
                        }
                    }

                    // Step 3: Add the final page's assets.
                    if (assetsForFinalPage.length > 0) {
                        pages.push(assetsForFinalPage);
                    }
                }
            } else {
                pages.push([]);
            }

            pages.forEach((pageAssets, pageIndex) => {
                const totalPages = pages.length;
                const isLastPage = pageIndex === totalPages - 1;
                const isFirstPage = pageIndex === 0;

                let maxItemsForThisPage;
                if (totalPages === 1) {
                    maxItemsForThisPage = SINGLE_PAGE_CAPACITY.items;
                } else if (isLastPage) {
                    maxItemsForThisPage = FINAL_PAGE_CAPACITY.items;
                } else if (isFirstPage) {
                    maxItemsForThisPage = FIRST_PAGE_CAPACITY.items;
                } else {
                    maxItemsForThisPage = INTERMEDIATE_PAGE_CAPACITY.items;
                }

                let assetsHTML = '';
                let totalAmountOnPage = 0;

                pageAssets.forEach(asset => {
                    totalAmountOnPage += asset.acquisitionCost;
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

                // Fill remaining rows to ensure consistent page height
                const remainingRows = maxItemsForThisPage - pageAssets.length;
                for (let i = 0; i < remainingRows; i++) {
                    assetsHTML += `<tr><td class="border border-gray-400 p-2 h-8" colspan="5"></td></tr>`;
                }

                // --- NEW: Conditional Footer ---
                let footerHTML = '';
                if (isLastPage) {
                    const grandTotalAmount = assets.reduce((sum, asset) => sum + asset.acquisitionCost, 0);
                    footerHTML = `
                        <tr class="font-bold bg-gray-50">
                            <td class="border border-gray-400 p-2 text-right" colspan="3">GRAND TOTAL</td>
                            <td class="border border-gray-400 p-2 text-right">${formatCurrency(grandTotalAmount)}</td>
                            <td class="border border-gray-400 p-2"></td>
                        </tr>
                    `;
                }

                const pageDiv = document.createElement('div');
                pageDiv.className = (pageIndex < totalPages - 1) ? 'printable-page page-break-after' : 'printable-page';

                // --- NEW: Conditional Signatory Block ---
                let signatoryBlockHTML = '';
                if (isLastPage) {
                    // Only add the signatory block on the last page
                    const issuedDateInputId = `id="${icsConfig.domIds.issuedDateInput}"`;
                    const receivedDateInputId = `id="${icsConfig.domIds.receivedDateInput}"`;

                    signatoryBlockHTML = `
                        <div class="grid grid-cols-2 gap-4 mt-8 pt-4 border-t-2 border-black">
                            <div class="text-sm">
                                <p class="font-bold">Received from:</p>
                                <div class="mt-12 text-center">
                                    <p class="font-bold uppercase border-b border-black">${issuedBy.name}</p>
                                    <p>(Signature Over Printed Name)</p>
                                </div>
                                <div class="mt-4 text-center">
                                    <p class="border-b border-black">${issuedBy.title}</p>
                                    <p>(Position/Office)</p>
                                </div>
                                <div class="mt-4 text-center">
                                    <input type="date" ${issuedDateInputId} class="border-b border-black text-center w-full" value="${formatDate(icsData.issuedDate)}">
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
                                    <input type="date" ${receivedDateInputId} class="border-b border-black text-center w-full" value="${formatDate(icsData.receivedDate)}">
                                    <p>(Date)</p>
                                </div>
                            </div>
                        </div>
                    `;
                }

                // --- NEW: Page Footer ---
                const pageFooterHTML = `
                    <div class="text-right text-xs italic mt-8 pt-2 border-t border-dashed">
                        Page ${pageIndex + 1} of ${totalPages}
                    </div>
                `;

                const logoHeader = isFirstPage ? `
                    <div class="flex flex-col items-center mb-8">
                        <img src="/LGU-DAET-LOGO.png" alt="LGU Daet Logo" class="h-20 w-20">
                        <div class="text-center mt-4">
                            <p>Republic of the Philippines</p>
                            <p class="font-bold">PROVINCE OF CAMARINES NORTE</p>
                            <p class="font-bold">MUNICIPALITY OF DAET</p>
                        </div>
                    </div>
                ` : '';

                pageDiv.innerHTML = `
                    ${logoHeader}
                    <div class="text-center mb-6">
                        <h2 class="text-xl font-bold">INVENTORY CUSTODIAN SLIP</h2>
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
                    ${signatoryBlockHTML}
                    ${pageFooterHTML}
                `;
                icsContainer.appendChild(pageDiv);
            });
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

        // --- EXPORT AND PREVIEW LOGIC ---
        const exportPdfBtn = document.getElementById('export-pdf-btn');
        const previewBtn = document.getElementById('preview-btn');
        const exitPreviewBtn = document.getElementById('exit-preview-btn');

        function handleExportPDF() {
            const fileName = `ICS-${currentIcsData?.number || currentIcsData?.icsNumber || 'report'}.pdf`;
            exportToPDF({
                reportElementId: 'report-output',
                fileName: fileName,
                buttonElement: exportPdfBtn,
                orientation: 'portrait',
                format: 'a4'
            });
        }

        function handleTogglePreview() {
            if (document.activeElement) document.activeElement.blur();
            setTimeout(() => {
                togglePreviewMode({
                    orientation: 'portrait',
                    exitButtonId: 'exit-preview-btn'
                });
            }, 50);
        }

        exportPdfBtn.addEventListener('click', handleExportPDF);
        previewBtn.addEventListener('click', handleTogglePreview);
        exitPreviewBtn.addEventListener('click', handleTogglePreview);

    },
    pageName: 'Inventory Custodian Slip'
});
