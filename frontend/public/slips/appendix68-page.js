import { fetchWithAuth } from '../js/api.js';
import { createAuthenticatedPage } from '../js/page-loader.js';

createAuthenticatedPage({
    permission: 'slip:generate',
    pageInitializer: (user) => {
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
                const slipDate = slipData.date || slipData.issuedDate || Date.now();
                document.getElementById('issued-date').value = new Date(slipDate).toISOString().split('T')[0];
                document.getElementById('signatory-1-name').textContent = slipData.user?.name || user.name;

                // Populate fields for reprint mode
                if (slipData.placeOfStorage) {
                    document.getElementById('place-of-storage').value = slipData.placeOfStorage;
                }
                if (slipData.disposalApprovedBy) {
                    document.getElementById('disposal-approved-by').value = slipData.disposalApprovedBy;
                }
                if (slipData.certifiedByInspector) {
                    document.getElementById('certified-by-inspector').value = slipData.certifiedByInspector;
                }
                if (slipData.witnessToDisposal) {
                    document.getElementById('witness-to-disposal').value = slipData.witnessToDisposal;
                }
                if (slipData.inspectionCertificate) {
                    document.getElementById('inspection-destroyed').checked = slipData.inspectionCertificate.isDestroyed;
                    document.getElementById('inspection-sold-private').checked = slipData.inspectionCertificate.isSoldPrivate;
                    document.getElementById('inspection-sold-public').checked = slipData.inspectionCertificate.isSoldPublic;
                    document.getElementById('inspection-transferred').checked = slipData.inspectionCertificate.isTransferred;
                    document.getElementById('inspection-transferred-to').value = slipData.inspectionCertificate.transferredTo || '';
                }

                const assetList = document.getElementById('asset-list');
                let totalAmount = 0;
                assetList.innerHTML = slipData.assets.map((asset, index) => {
                    // In a real scenario, sales data would come from the slipData. For now, it's blank.
                    return `
                    <tr>
                        <td class="border border-black p-1 text-center">${index + 1}</td>
                        <td class="border border-black p-1 text-center">${asset.quantity || 1}</td>
                        <td class="border border-black p-1 text-center">${asset.unit || 'unit'}</td>
                        <td class="border border-black p-1">${asset.description}</td>
                        <td class="border border-black p-1"></td> <!-- OR No. -->
                        <td class="border border-black p-1"></td> <!-- Date -->
                        <td class="border border-black p-1"></td> <!-- Amount -->
                    </tr>
                `}).join('');
                document.getElementById('total-amount').textContent = new Intl.NumberFormat('en-PH', { style: 'currency', currency: 'PHP' }).format(totalAmount);
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

                reprintButton.addEventListener('click', () => window.print());

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

    } catch (error) {
        console.error("Initialization failed:", error);
    }
});