// FILE: frontend/public/slip-page-common.js
import { fetchWithAuth } from './api.js';

// --- UTILITY FUNCTIONS ---
export const formatCurrency = (value) => new Intl.NumberFormat('en-PH', { style: 'currency', currency: 'PHP' }).format(value || 0);
export const formatDate = (dateString) => dateString ? new Date(dateString).toLocaleDateString('en-CA') : 'N/A';

// --- SHARED INITIALIZATION LOGIC ---
export function initializeSlipPage(config, currentUser) {
    let currentSlipData = {};

    function initializePage() {
        const reprintDataString = localStorage.getItem(config.localStorageKeys.reprint);
        const createDataString = localStorage.getItem(config.localStorageKeys.create);
        const backButton = document.getElementById(config.domIds.backButton);
        const formContainer = document.getElementById(config.domIds.formContainer);
        const saveButton = document.getElementById(config.domIds.saveButton);
        const reprintButton = document.getElementById(config.domIds.reprintButton);
        const pageTitle = document.getElementById(config.domIds.pageTitle);

        if (reprintDataString) {
            // REPRINT MODE
            const slipData = JSON.parse(reprintDataString);
            localStorage.removeItem(config.localStorageKeys.reprint);
            
            pageTitle.textContent = `Reprint ${config.slipTitle}`;
            saveButton.classList.add('hidden');
            reprintButton.classList.remove('hidden');
            backButton.href = config.backUrls.reprint;
            
            config.populateFormFn(slipData);

        } else if (createDataString) {
            // NEW SLIP MODE
            const selectedAssets = JSON.parse(createDataString);
            localStorage.removeItem(config.localStorageKeys.create);

            if (selectedAssets.length > 0) {
                const firstAsset = selectedAssets[0];
                
                if (config.checkFundSource) {
                    const allSameFundSource = selectedAssets.every(asset => asset.fundSource === firstAsset.fundSource);
                    if (!allSameFundSource) {
                        alert(`Error: All selected assets must have the same Fund Source to be included on a single ${config.slipType}.`);
                        window.location.href = config.backUrls.create;
                        return;
                    }
                }

                const today = new Date().toLocaleDateString('en-CA');
                const slipNumber = `${config.slipType}-${today.replace(/-/g, '')}-${Math.floor(Math.random() * 1000)}`;
                
                const slipDataForDisplay = {
                    [config.numberProperty]: slipNumber,
                    custodian: firstAsset.custodian,
                    assets: selectedAssets,
                    receivedDate: today,
                    issuedDate: today
                };
                
                config.populateFormFn(slipDataForDisplay);
                
                currentSlipData = {
                    [config.numberProperty]: slipNumber,
                    custodian: firstAsset.custodian,
                    assets: selectedAssets.map(a => a._id),
                    // The dates will be picked up from the input fields before saving
                };
                backButton.href = config.backUrls.create;

            } else {
                // No assets selected
                formContainer.innerHTML = 
                    `<p class="text-center text-red-500">No assets selected. Please go back to the <a href="${config.backUrls.create}" class="text-blue-600 hover:underline">Asset Registry</a> and select items to generate a ${config.slipType}.</p>`;
                saveButton.classList.add('hidden');
            }
        } else {
            // No data in localStorage, show an error or default state
            formContainer.innerHTML = 
                `<p class="text-center text-red-500">No data found to generate a slip. Please go back to the <a href="${config.backUrls.create}" class="text-blue-600 hover:underline">Asset Registry</a>.</p>`;
            saveButton.classList.add('hidden');
        }
    }

    // --- EVENT LISTENERS ---
    const saveButton = document.getElementById(config.domIds.saveButton);
    if (saveButton) {
        saveButton.addEventListener('click', async () => {
            // Update dates from the form just before saving
            currentSlipData.issuedDate = document.getElementById(config.domIds.issuedDateInput).value;
            currentSlipData.receivedDate = document.getElementById(config.domIds.receivedDateInput).value;
            currentSlipData.user = { name: currentUser.name, office: currentUser.office };

            try {
                await fetchWithAuth(config.apiEndpoint, {
                    method: 'POST',
                    body: JSON.stringify(currentSlipData)
                });

                alert(`${config.slipType} saved successfully!`);
                window.print();
                window.location.href = config.backUrls.create;
            } catch (error) {
                alert(`Error: ${error.message}`);
            }
        });
    }

    const reprintButton = document.getElementById(config.domIds.reprintButton);
    if (reprintButton) {
        reprintButton.addEventListener('click', () => {
            window.print();
        });
    }

    // --- INITIALIZATION ---
    initializePage();
}
