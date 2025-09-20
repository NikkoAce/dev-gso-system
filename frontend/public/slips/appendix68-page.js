import { fetchWithAuth } from '../js/api.js';
import { createAuthenticatedPage } from '../js/page-loader.js';
import { exportToPDF, togglePreviewMode } from '../js/report-utils.js';

createAuthenticatedPage({
    permission: 'slip:generate',
    pageInitializer: (user) => {
        let currentSlipData = null;

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
                pageTitle: 'page-title', // The main H1 title of the page
                formContainer: 'form-container', // The main container for the slip content
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
                currentSlipData = slipData;
                const formContainer = document.getElementById(config.domIds.formContainer);
                
                // Get the footer template HTML *once* and then clear the container.
                const fullTemplate = document.getElementById('appendix68-template');
                const footerTemplateHTML = fullTemplate?.querySelector('footer')?.innerHTML;
                if (!footerTemplateHTML) {
                    formContainer.innerHTML = '<p class="text-center text-red-500">Error: Report template not found.</p>';
                    return;
                }
                formContainer.innerHTML = '';

                const assets = slipData.assets || [];
                const ITEMS_PER_PAGE = 15;
                const totalPages = Math.ceil(assets.length / ITEMS_PER_PAGE) || 1;
                const slipDate = new Date(slipData.date || slipData.issuedDate || Date.now()).toISOString().split('T')[0];

                for (let i = 0; i < totalPages; i++) {
                    const pageAssets = assets.slice(i * ITEMS_PER_PAGE, (i + 1) * ITEMS_PER_PAGE);
                    const isLastPage = i === totalPages - 1;
                    const isFirstPage = i === 0;

                    let assetRows = '';
                    pageAssets.forEach((asset, index) => {
                        assetRows += `
                            <tr>
                                <td class="border border-black p-1 text-center">${(i * ITEMS_PER_PAGE) + index + 1}</td>
                                <td class="border border-black p-1 text-center">${asset.quantity || 1}</td>
                                <td class="border border-black p-1 text-center">${asset.unit || 'unit'}</td>
                                <td class="border border-black p-1">${asset.description}</td>
                                <td class="border border-black p-1"></td> <!-- OR No. -->
                                <td class="border border-black p-1"></td> <!-- Date -->
                                <td class="border border-black p-1"></td> <!-- Amount -->
                            </tr>
                        `;
                    });

                    const remainingRows = ITEMS_PER_PAGE - pageAssets.length;
                    for (let j = 0; j < remainingRows; j++) {
                        assetRows += `<tr><td class="border border-black h-6" colspan="7"></td></tr>`;
                    }

                    const logoHeader = isFirstPage ? `
                        <div class="flex flex-col items-center mb-8">
                            <img src="/LGU-DAET-LOGO.png" alt="LGU Daet Logo" class="h-20 w-20">
                            <div class="text-center mt-4">
                                <p>Republic of the Philippines</p>
                                <p class="font-bold">PROVINCE OF CAMARINES NORTE</p>
                                <p class="font-bold">MUNICIPALITY OF DAET</p>
                            </div>
                        </div>
                    ` : '<div class="h-36"></div>'; // Placeholder to keep spacing consistent

                    const pageDiv = document.createElement('div');
                    pageDiv.className = isLastPage ? 'printable-page' : 'printable-page page-break-after';

                    // Build the page HTML from scratch to avoid duplicate IDs
                    pageDiv.innerHTML = `
                        ${logoHeader}
                        <div class="text-center mb-4">
                            <h3 class="font-bold text-lg">WASTE MATERIALS REPORT</h3>
                        </div>
                        <div class="grid grid-cols-2 gap-x-4 text-sm mb-4 items-end">
                            <span>LGU: <span class="font-semibold underline">LGU of Daet</span></span>
                            <span>Fund: <span class="font-semibold underline">General Fund</span></span>
                            <label class="form-control">
                                <div class="label py-0"><span class="label-text">Place of Storage</span></div>
                                <input type="text" id="place-of-storage" class="input input-bordered input-sm w-full" value="${slipData.placeOfStorage || 'GSO Warehouse'}" ${!isFirstPage ? 'disabled' : ''}>
                            </label>
                            <label class="form-control">
                                <div class="label py-0"><span class="label-text">Date</span></div>
                                <input type="date" id="issued-date" class="input input-bordered input-sm w-full" value="${slipDate}" ${!isFirstPage ? 'disabled' : ''}>
                            </label>
                        </div>
                        <table class="w-full text-xs border-collapse border border-black mt-4">
                            <thead>
                                <tr class="text-center">
                                    <th colspan="4" class="border border-black p-1 font-bold">ITEMS FOR DISPOSAL</th>
                                    <th colspan="3" class="border border-black p-1 font-bold">Record of Sales</th>
                                </tr>
                                <tr class="bg-gray-100 text-center">
                                    <th class="border border-black p-1 w-[5%]">Item</th>
                                    <th class="border border-black p-1 w-[10%]">Quantity</th>
                                    <th class="border border-black p-1 w-[10%]">Unit</th>
                                    <th class="border border-black p-1">Description</th>
                                    <th class="border border-black p-1 w-[15%]">Official Receipt No.</th>
                                    <th class="border border-black p-1 w-[10%]">Date</th>
                                    <th class="border border-black p-1 w-[10%]">Amount</th>
                                </tr>
                            </thead>
                            <tbody>${assetRows}</tbody>
                            <tfoot>
                                <tr class="font-bold">
                                    <td colspan="6" class="border border-black p-1 text-center">TOTAL</td>
                                    <td class="border border-black p-1 text-right">${new Intl.NumberFormat('en-PH', { style: 'currency', currency: 'PHP' }).format(0)}</td>
                                </tr>
                            </tfoot>
                        </table>
                        ${isLastPage ? `<footer class="mt-8 text-xs space-y-8">${footerTemplateHTML}</footer>` : ''}
                        <div class="text-right text-xs italic mt-8 pt-2 border-t border-dashed">Page ${i + 1} of ${totalPages}</div>
                    `;

                    // If it's the last page, populate the unique footer fields.
                    if (isLastPage) {
                        const footer = pageDiv.querySelector('footer');
                        if (footer) {
                            footer.querySelector('#signatory-1-name').textContent = slipData.user?.name || user.name;
                            if (slipData.disposalApprovedBy) footer.querySelector('#disposal-approved-by').value = slipData.disposalApprovedBy;
                            if (slipData.certifiedByInspector) footer.querySelector('#certified-by-inspector').value = slipData.certifiedByInspector;
                            if (slipData.witnessToDisposal) footer.querySelector('#witness-to-disposal').value = slipData.witnessToDisposal;
                            if (slipData.inspectionCertificate) {
                                footer.querySelector('#inspection-destroyed').checked = slipData.inspectionCertificate.isDestroyed;
                                footer.querySelector('#inspection-sold-private').checked = slipData.inspectionCertificate.isSoldPrivate;
                                footer.querySelector('#inspection-sold-public').checked = slipData.inspectionCertificate.isSoldPublic;
                                footer.querySelector('#inspection-transferred').checked = slipData.inspectionCertificate.isTransferred;
                                footer.querySelector('#inspection-transferred-to').value = slipData.inspectionCertificate.transferredTo || '';
                            }
                        }
                    }
                    formContainer.appendChild(pageDiv);
                }
            },
            checkFundSource: false // No fund source check needed for this slip
        };

        // This custom initializer handles the entire page logic for A68,
        // as it has different requirements than standard slips.
        function initializeA68Page(config, currentUser) {
            const createDataString = localStorage.getItem(config.localStorageKeys.create);
            const reprintDataString = localStorage.getItem(config.localStorageKeys.reprint);

            const pageTitle = document.getElementById(config.domIds.pageTitle);
            const backButton = document.getElementById(config.domIds.backButton);
            const saveButton = document.getElementById(config.domIds.saveButton);
            const reprintButton = document.getElementById(config.domIds.reprintButton);
            const formContainer = document.getElementById(config.domIds.formContainer);

            if (reprintDataString) {
                // --- REPRINT MODE ---
                const slipData = JSON.parse(reprintDataString);
                localStorage.removeItem(config.localStorageKeys.reprint);

                pageTitle.textContent = `Reprint ${config.slipTitle}`;
                saveButton.classList.add('hidden');
                reprintButton.classList.remove('hidden');
                backButton.href = config.backUrls.reprint;

                config.populateFormFn(slipData);

                reprintButton.addEventListener('click', () => {
                    // Blur active element to close dropdown before printing
                    if (document.activeElement) document.activeElement.blur();
                    window.print();
                });

            } else if (createDataString) {
                // --- CREATE MODE ---
                const selectedAssets = JSON.parse(createDataString);
                localStorage.removeItem(config.localStorageKeys.create);

                if (selectedAssets.length > 0) {
                    const slipDataForDisplay = { assets: selectedAssets, user: currentUser };
                    config.populateFormFn(slipDataForDisplay);
                    backButton.href = config.backUrls.create;

                    saveButton.addEventListener('click', async () => {
                        const dataToSave = {
                            assetIds: selectedAssets.map(a => a._id),
                            date: document.getElementById('issued-date').value,
                            placeOfStorage: document.getElementById('place-of-storage').value,
                            // New fields
                            disposalApprovedBy: document.getElementById('disposal-approved-by').value,
                            certifiedByInspector: document.getElementById('certified-by-inspector').value,
                            witnessToDisposal: document.getElementById('witness-to-disposal').value,
                            inspectionCertificate: {
                                isDestroyed: document.getElementById('inspection-destroyed').checked,
                                isSoldPrivate: document.getElementById('inspection-sold-private').checked,
                                isSoldPublic: document.getElementById('inspection-sold-public').checked,
                                isTransferred: document.getElementById('inspection-transferred').checked,
                                transferredTo: document.getElementById('inspection-transferred-to').value,
                            }
                        };

                        if (!dataToSave.date) {
                            alert('Please select a date for the report.'); return;
                        }

                        try {
                            const savedSlip = await fetchWithAuth(config.apiEndpoint, { method: 'POST', body: JSON.stringify(dataToSave) });
                            alert(`${config.slipType} saved successfully!`);
                            localStorage.setItem(config.localStorageKeys.reprint, JSON.stringify(savedSlip));
                            window.print();
                            window.location.href = config.backUrls.create;
                        } catch (error) { alert(`Error: ${error.message}`); }
                    });
                } else {
                    formContainer.innerHTML = `<p class="text-center text-red-500">No assets selected. Please go back to the <a href="${config.backUrls.create}" class="text-blue-600 hover:underline">Asset Registry</a>.</p>`;
                    saveButton.classList.add('hidden');
                }
            } else {
                formContainer.innerHTML = `<p class="text-center text-red-500">No data found. Please go back to the <a href="${config.backUrls.create}" class="text-blue-600 hover:underline">Asset Registry</a>.</p>`;
                saveButton.classList.add('hidden');
                reprintButton.classList.add('hidden');
            }
        }

        initializeA68Page(config, user);

        // --- EXPORT AND PREVIEW LOGIC ---
        const exportPdfBtn = document.getElementById('export-pdf-btn');
        const previewBtn = document.getElementById('preview-btn');
        const exitPreviewBtn = document.querySelector('#exit-preview-btn') || document.createElement('button');

        function handleExportPDF() {
            if (!currentSlipData) return;
            const fileName = `A68-${currentSlipData?.appendixNumber || 'report'}.pdf`;
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

        if (exportPdfBtn) exportPdfBtn.addEventListener('click', handleExportPDF);
        if (previewBtn) previewBtn.addEventListener('click', handleTogglePreview);
        if (exitPreviewBtn) exitPreviewBtn.addEventListener('click', handleTogglePreview);
    }
});