// FILE: frontend/public/par-page.js
import { initializeSlipPage, formatCurrency, formatDate } from '../js/slip-page-common.js';
import { exportToPDF, togglePreviewMode } from '../js/report-utils.js';
import { createAuthenticatedPage } from '../js/page-loader.js';

createAuthenticatedPage({
    permission: ['slip:generate', 'slip:read'],
    pageInitializer: (user) => {
        let currentParData = null; // Variable to hold slip data for export

        // The populateParForm function is passed as a callback to the shared initializer.
        // It contains only the logic specific to rendering the PAR form itself.
        const populateParForm = (parData) => {
            currentParData = parData; // Store the data for export functions
            const parFormContainer = document.getElementById('par-form-container');
            parFormContainer.innerHTML = ''; // Clear previous content

            const assets = parData.assets || [];
            // --- Smart Chunking Logic with different capacities for each page type ---
            const FIRST_PAGE_CAPACITY = { items: 15, lines: 40 }; // Smaller capacity due to header
            const INTERMEDIATE_PAGE_CAPACITY = { items: 20, lines: 55 }; // Largest capacity
            const FINAL_PAGE_CAPACITY = { items: 10, lines: 25 };      // Smaller capacity for signatures and totals

            const pages = [];

            if (assets.length > 0) {
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
                            isFirstPageOfBlock = false;
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
            } else {
                pages.push([]);
            }

            pages.forEach((pageAssets, pageIndex) => {
                const totalPages = pages.length;
                const isLastPage = pageIndex === totalPages - 1;
                const isFirstPage = pageIndex === 0;

                let maxItemsForThisPage;
                if (isLastPage) {
                    maxItemsForThisPage = (totalPages === 1) ? FIRST_PAGE_CAPACITY.items : FINAL_PAGE_CAPACITY.items;
                } else if (isFirstPage) {
                    maxItemsForThisPage = FIRST_PAGE_CAPACITY.items;
                } else {
                    maxItemsForThisPage = INTERMEDIATE_PAGE_CAPACITY.items;
                }

                let assetsHTML = '';
                pageAssets.forEach(asset => {
                    let parDescription = `<div>${asset.description}</div>`;
                    if (asset.specifications && asset.specifications.length > 0) {
                        asset.specifications.forEach(spec => {
                            parDescription += `<div class="text-xs text-gray-600">${spec.key}: ${spec.value}</div>`;
                        });
                    }
                    assetsHTML += `
                        <tr>
                            <td class="border border-gray-400 p-2 text-center">1</td>
                            <td class="border border-gray-400 p-2 text-center">unit</td>
                            <td class="border border-gray-400 p-2">${parDescription}</td>
                            <td class="border border-gray-400 p-2 text-center">${asset.propertyNumber}</td>
                            <td class="border border-gray-400 p-2 text-center">${formatDate(asset.acquisitionDate)}</td>
                            <td class="border border-gray-400 p-2 text-right">${formatCurrency(asset.acquisitionCost)}</td>
                        </tr>
                    `;
                });

                const remainingRows = maxItemsForThisPage - pageAssets.length;
                for (let i = 0; i < remainingRows; i++) {
                    assetsHTML += `<tr><td class="border border-gray-400 p-2 h-8" colspan="6"></td></tr>`;
                }

                let footerHTML = '';
                if (isLastPage) {
                    const grandTotalAmount = assets.reduce((sum, asset) => sum + asset.acquisitionCost, 0);
                    footerHTML = `
                        <tr class="font-bold bg-gray-50">
                            <td class="border border-gray-400 p-2 text-right" colspan="5">GRAND TOTAL</td>
                            <td class="border border-gray-400 p-2 text-right">${formatCurrency(grandTotalAmount)}</td>
                        </tr>
                    `;
                }

                const pageDiv = document.createElement('div');
                pageDiv.className = (pageIndex < totalPages - 1) ? 'printable-page page-break-after' : 'printable-page';

                let signatoryBlockHTML = '';
                if (isLastPage) {
                    const issuedDateInputId = `id="${parConfig.domIds.issuedDateInput}"`;
                    const receivedDateInputId = `id="${parConfig.domIds.receivedDateInput}"`;
                    signatoryBlockHTML = `
                        <div class="grid grid-cols-2 gap-4 mt-8 pt-4 border-t-2 border-black">
                            <div class="text-sm">
                                <p class="font-bold">Received by:</p>
                                <div class="mt-12 text-center">
                                    <p class="font-bold uppercase border-b border-black">${parData.custodian.name}</p>
                                    <p>(Signature Over Printed Name of End User)</p>
                                </div>
                                <div class="mt-4 text-center">
                                    <p class="border-b border-black">${parData.custodian.designation || ''}</p>
                                    <p>(Position/Office)</p>
                                </div>
                                <div class="mt-4 text-center">
                                    <input type="date" ${receivedDateInputId} class="border-b border-black text-center w-full" value="${formatDate(parData.receivedDate)}">
                                    <p>(Date)</p>
                                </div>
                            </div>
                            <div class="text-sm">
                                <p class="font-bold">Issued by:</p>
                                <div class="mt-12 text-center">
                                    <p class="font-bold uppercase border-b border-black">DR. RAYCHEL B. VALENCIA</p>
                                    <p>(Signature Over Printed Name of Supply Officer)</p>
                                </div>
                                <div class="mt-4 text-center">
                                    <p class="border-b border-black">Municipal Administrator/OIC GSO</p>
                                    <p>(Position/Office)</p>
                                </div>
                                <div class="mt-4 text-center">
                                    <input type="date" ${issuedDateInputId} class="border-b border-black text-center w-full" value="${formatDate(parData.issuedDate)}">
                                    <p>(Date)</p>
                                </div>
                            </div>
                        </div>
                    `;
                }

                const pageFooterHTML = `
                    <div class="text-right text-xs italic mt-8 pt-2 border-t border-dashed">
                        Page ${pageIndex + 1} of ${totalPages}
                    </div>
                `;

                const logoHeader = pageIndex === 0 ? `
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
                        <h2 class="text-xl font-bold">PROPERTY ACKNOWLEDGMENT RECEIPT</h2>
                        <h3 class="font-semibold">LGU Daet, Camarines Norte</h3>
                        <p class="text-sm">Fund: <span id="par-fund-source" class="font-semibold">${(parData.assets && parData.assets.length > 0) ? parData.assets[0].fundSource : ''}</span></p>
                    </div>
                    <div class="flex justify-between mb-4 text-sm">
                        <span>Entity Name: LGU Daet</span>
                        <span class="font-bold">PAR No: <span id="par-no">${parData.parNumber || parData.number}</span></span>
                    </div>
                    <div class="overflow-x-auto">
                        <table class="w-full border-collapse border border-gray-400 text-sm">
                            <thead>
                                <tr class="bg-gray-100">
                                    <th class="border border-gray-400 p-2 text-center" width="10%">Quantity</th>
                                    <th class="border border-gray-400 p-2 text-center" width="10%">Unit</th>
                                    <th class="border border-gray-400 p-2 text-left">Description</th>
                                    <th class="border border-gray-400 p-2 text-center" width="20%">Property Number</th>
                                    <th class="border border-gray-400 p-2 text-center" width="15%">Date Acquired</th>
                                    <th class="border border-gray-400 p-2 text-right" width="15%">Amount</th>
                                </tr>
                            </thead>
                            <tbody>${assetsHTML}</tbody>
                            <tfoot>${footerHTML}</tfoot>
                        </table>
                    </div>
                    ${signatoryBlockHTML}
                    ${pageFooterHTML}
                `;
                parFormContainer.appendChild(pageDiv);
            });
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

        // --- EXPORT AND PREVIEW LOGIC ---
        const exportPdfBtn = document.getElementById('export-pdf-btn');
        const previewBtn = document.getElementById('preview-btn');
        const exitPreviewBtn = document.getElementById('exit-preview-btn');

        function handleExportPDF() {
            const fileName = `PAR-${currentParData?.number || currentParData?.parNumber || 'report'}.pdf`;
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

        exportPdfBtn.addEventListener('click', handleExportPDF);
        previewBtn.addEventListener('click', handleTogglePreview);
        exitPreviewBtn.addEventListener('click', handleTogglePreview);

    },
    pageName: 'Property Acknowledgment Receipt'
});
