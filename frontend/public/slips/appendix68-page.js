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
                currentSlipData = slipData;
                const formContainer = document.getElementById('form-container');

                // Get the template HTML *before* clearing the container to avoid a null reference.
                const templateHTML = document.getElementById('appendix68-template')?.innerHTML;
                if (!templateHTML) {
                    formContainer.innerHTML = '<p class="text-center text-red-500">Error: Report template not found.</p>';
                    return;
                }
                // Now clear the container.
                formContainer.innerHTML = '';

                const assets = slipData.assets || [];
                const ITEMS_PER_PAGE = 15;
                const totalPages = Math.ceil(assets.length / ITEMS_PER_PAGE) || 1;

                for (let i = 0; i < totalPages; i++) {
                    const pageAssets = assets.slice(i * ITEMS_PER_PAGE, (i + 1) * ITEMS_PER_PAGE);
                    const isLastPage = i === totalPages - 1;

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

                    const pageDiv = document.createElement('div');
                    pageDiv.className = isLastPage ? 'printable-page' : 'printable-page page-break-after';

                    // Use the original form content as a template
                    pageDiv.innerHTML = templateHTML;

                    // Populate the dynamic parts of the template
                    pageDiv.querySelector('#asset-list').innerHTML = assetRows;
                    pageDiv.querySelector('#signatory-1-name').textContent = slipData.user?.name || user.name;
                    
                    // Only show footer on the last page
                    if (!isLastPage) {
                        pageDiv.querySelector('footer').remove();
                    } else {
                        // Populate reprint data if available
                        if (slipData.placeOfStorage) pageDiv.querySelector('#place-of-storage').value = slipData.placeOfStorage;
                        if (slipData.disposalApprovedBy) pageDiv.querySelector('#disposal-approved-by').value = slipData.disposalApprovedBy;
                        if (slipData.certifiedByInspector) pageDiv.querySelector('#certified-by-inspector').value = slipData.certifiedByInspector;
                        if (slipData.witnessToDisposal) pageDiv.querySelector('#witness-to-disposal').value = slipData.witnessToDisposal;
                        if (slipData.inspectionCertificate) {
                            pageDiv.querySelector('#inspection-destroyed').checked = slipData.inspectionCertificate.isDestroyed;
                            pageDiv.querySelector('#inspection-sold-private').checked = slipData.inspectionCertificate.isSoldPrivate;
                            pageDiv.querySelector('#inspection-sold-public').checked = slipData.inspectionCertificate.isSoldPublic;
                            pageDiv.querySelector('#inspection-transferred').checked = slipData.inspectionCertificate.isTransferred;
                            pageDiv.querySelector('#inspection-transferred-to').value = slipData.inspectionCertificate.transferredTo || '';
                        }
                    }

                    // Set date and total amount
                    const slipDate = slipData.date || slipData.issuedDate || Date.now();
                    pageDiv.querySelector('#issued-date').value = new Date(slipDate).toISOString().split('T')[0];
                    pageDiv.querySelector('#total-amount').textContent = new Intl.NumberFormat('en-PH', { style: 'currency', currency: 'PHP' }).format(0); // Total is always 0 for waste

                    pageDiv.innerHTML += `<div class="text-right text-xs italic mt-8 pt-2 border-t border-dashed">Page ${i + 1} of ${totalPages}</div>`;
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