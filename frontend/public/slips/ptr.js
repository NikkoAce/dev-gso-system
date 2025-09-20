// FILE: frontend/public/ptr.js
import { exportToPDF, togglePreviewMode } from '../js/report-utils.js';
import { createAuthenticatedPage } from '../js/page-loader.js';

createAuthenticatedPage({
    permission: ['asset:transfer', 'slip:read'],
    pageInitializer: initializePtrPage,
    pageName: 'Property Transfer Report'
});

function initializePtrPage(user) {
    const ptrContainer = document.getElementById('ptr-container');
    const printButton = document.getElementById('print-btn');
    const exportPdfBtn = document.getElementById('export-pdf-btn');
    const previewBtn = document.getElementById('preview-btn');
    const exitPreviewBtn = document.getElementById('exit-preview-btn');
    let currentPtrData = null;

    const formatCurrency = (value) => new Intl.NumberFormat('en-PH', { style: 'currency', currency: 'PHP' }).format(value || 0);
    const formatDate = (dateString) => dateString ? new Date(dateString).toLocaleDateString('en-CA') : 'N/A';

    // Check for reprint data first, then for new transfer data
    function renderPTR() {
        let ptrData = null;
        const reprintDataString = localStorage.getItem('ptrToReprint');
        const transferDataString = localStorage.getItem('transferData');

        if (reprintDataString) {
            ptrData = JSON.parse(reprintDataString);
            localStorage.removeItem('ptrToReprint'); // Clean up after use
        } else if (transferDataString) {
            const responseData = JSON.parse(transferDataString);
            // Make it robust: handle cases where the whole response is stored
            // or just the transferDetails object.
            ptrData = responseData.transferDetails ? responseData.transferDetails : responseData;
            localStorage.removeItem('transferData'); // Clean up after use
        }

        if (!ptrData) {
            ptrContainer.innerHTML = `<p class="text-center text-red-500">No transfer data found. Please initiate a transfer from the Asset Registry.</p>`;
            return;
        }
        currentPtrData = ptrData; // Store for export
        const { from, to, assets, date, ptrNumber } = ptrData;
        ptrContainer.innerHTML = ''; // Clear previous content
        
        const SINGLE_PAGE_CAPACITY = 6;
        const FIRST_PAGE_CAPACITY = 12; // Smaller capacity due to large header
        const INTERMEDIATE_PAGE_CAPACITY = 25; // More items on pages without it
        const FINAL_PAGE_CAPACITY = 6; // Fewer items for the large signatory block
        const pages = [];

        if (assets.length > 0) {
            if (assets.length <= SINGLE_PAGE_CAPACITY) {
                pages.push(assets);
            } else {
                // Step 1: Work backwards to determine which assets belong on the final page.
                const assetsForFinalPage = [];
                let splitIndex = assets.length;
                
                for (let i = assets.length - 1; i >= 0; i--) {
                    if (assetsForFinalPage.length < FINAL_PAGE_CAPACITY) {
                        assetsForFinalPage.unshift(assets[i]);
                        splitIndex = i;
                    } else {
                        break;
                    }
                }
                
                // Step 2: Chunk the remaining assets for the first and intermediate pages.
                const assetsForDistribution = assets.slice(0, splitIndex);
                if (assetsForDistribution.length > 0) {
                    let currentPageAssets = [];
                    let isFirstPageOfBlock = true;

                    assetsForDistribution.forEach(asset => {
                        const capacity = isFirstPageOfBlock ? FIRST_PAGE_CAPACITY : INTERMEDIATE_PAGE_CAPACITY;
                        if (currentPageAssets.length >= capacity) {
                            pages.push(currentPageAssets);
                            currentPageAssets = [];
                            isFirstPageOfBlock = false;
                        }
                        currentPageAssets.push(asset);
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
        }
        if (pages.length === 0) pages.push([]); // Ensure at least one page is rendered
        const totalPages = pages.length;

        for (let i = 0; i < totalPages; i++) {
            const pageAssets = pages[i];
            const isLastPage = i === totalPages - 1;
            const isFirstPage = i === 0;

            let assetRows = '';
            pageAssets.forEach(asset => {
                assetRows += `
                    <tr class="text-center">
                        <td class="border border-black p-1">1</td>
                        <td class="border border-black p-1">unit</td>
                        <td class="border border-black p-1 text-left">${asset.description}</td>
                        <td class="border border-black p-1">${asset.propertyNumber}</td>
                        <td class="border border-black p-1 text-right">${formatCurrency(asset.acquisitionCost)}</td>
                        <td class="border border-black p-1">${asset.remarks || ''}</td>
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
                assetRows += `<tr><td class="border border-black h-6" colspan="6"></td></tr>`;
            }

            let signatoryBlockHTML = '';
            if (isLastPage) {
                signatoryBlockHTML = `
                    <div class="grid grid-cols-2 gap-8 mt-4 text-sm">
                        <div>
                            <p><strong>Reason for Transfer:</strong></p>
                            <div class="border-b border-black h-8"></div>
                        </div>
                        <div></div>
                    </div>
                    <div class="grid grid-cols-2 gap-8 mt-8 text-sm">
                        <div>
                            <p>Approved by:</p>
                            <div class="mt-12 text-center">
                                <p class="font-bold uppercase border-b border-black">&nbsp;</p>
                                <p>Signature over Printed Name of Head of Agency/Entity or his/her Authorized Representative</p>
                            </div>
                        </div>
                        <div>
                            <p>Released/Issued by:</p>
                            <div class="mt-12 text-center">
                                <p class="font-bold uppercase border-b border-black">${from.name}</p>
                                <p>Signature over Printed Name of Accountable Officer</p>
                            </div>
                        </div>
                    </div>
                    <div class="grid grid-cols-2 gap-8 mt-8 text-sm">
                        <div>
                            <p>Received by:</p>
                            <div class="mt-12 text-center">
                                <p class="font-bold uppercase border-b border-black">${to.name}</p>
                                <p>Signature over Printed Name of Accountable Officer</p>
                            </div>
                        </div>
                        <div>
                            <p>Date:</p>
                            <div class="mt-12 text-center">
                                <p class="font-bold uppercase border-b border-black">${formatDate(date)}</p>
                            </div>
                        </div>
                    </div>
                `;
            }

            const pageDiv = document.createElement('div');
            pageDiv.className = isLastPage ? 'printable-page' : 'printable-page page-break-after';
            
            const logoHeader = i === 0 ? `
                <div class="flex flex-col items-center mb-8">
                    <img src="/LGU-DAET-LOGO.png" alt="LGU Daet Logo" class="h-20 w-20">
                    <div class="text-center mt-4">
                        <p>Republic of the Philippines</p>
                        <p class="font-bold">PROVINCE OF CAMARINES NORTE</p>
                        <p class="font-bold">MUNICIPALITY OF DAET</p>
                    </div>
                </div>` : '';

            pageDiv.innerHTML = `
                ${logoHeader}
                <div class="text-center mb-4">
                    <h2 class="text-xl font-bold">PROPERTY TRANSFER REPORT</h2>
                </div>
                <div class="text-sm mb-4">
                    <p><strong>Entity Name:</strong> LGU of Daet</p>
                    <p><strong>PTR No.:</strong> <span class="font-semibold">${ptrNumber || 'Pending...'}</span></p>
                </div>
                <div class="grid grid-cols-2 gap-4 text-sm mb-4 border-t border-b border-black py-2">
                    <div>
                        <p><strong>From Accountable Officer/Agency/Fund Cluster:</strong></p>
                        <p class="font-semibold pl-4">${from.name}</p>
                    </div>
                    <div>
                        <p><strong>To Accountable Officer/Agency/Fund Cluster:</strong></p>
                        <p class="font-semibold pl-4">${to.name}</p>
                    </div>
                </div>
                <p class="text-sm mb-2"><strong>Transfer Type:</strong> (check one)</p>
                <div class="flex items-center gap-8 text-sm mb-4">
                    <div><input type="checkbox" disabled> Donation</div>
                    <div><input type="checkbox" disabled> Relocate</div>
                    <div><input type="checkbox" disabled> Reassign</div>
                    <div><input type="checkbox" checked> Others (Specify) <span class="underline">Internal Transfer</span></div>
                </div>

                <table class="w-full text-xs border-collapse border border-black">
                    <thead class="bg-gray-100">
                        <tr class="text-center">
                            <th class="border border-black p-1">Quantity</th>
                            <th class="border border-black p-1">Unit</th>
                            <th class="border border-black p-1">Description</th>
                            <th class="border border-black p-1">Property No.</th>
                            <th class="border border-black p-1">Amount</th>
                            <th class="border border-black p-1">Remarks</th>
                        </tr>
                    </thead>
                    <tbody>
                        ${assetRows}
                    </tbody>
                </table>
                ${signatoryBlockHTML}
                <div class="text-right text-xs italic mt-8 pt-2 border-t border-dashed">
                    Page ${i + 1} of ${totalPages}
                </div>
            `;
            ptrContainer.appendChild(pageDiv);
        }
    }

    function handleExportPDF() {
        const fileName = `PTR-${currentPtrData?.ptrNumber || 'report'}.pdf`;
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

    printButton.addEventListener('click', () => {
        window.print();
    });
    exportPdfBtn.addEventListener('click', handleExportPDF);
    previewBtn.addEventListener('click', handleTogglePreview);
    exitPreviewBtn.addEventListener('click', handleTogglePreview);

    renderPTR();
}
