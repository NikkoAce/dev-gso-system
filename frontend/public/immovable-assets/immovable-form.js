// FILE: frontend/public/immovable-assets/immovable-form.js
import { fetchWithAuth } from '../js/api.js';
import { createUIManager } from '../js/ui.js';

document.addEventListener('DOMContentLoaded', async () => {
    try {
        const user = await getCurrentUser();
        if (!user || user.office !== 'GSO') {
            window.location.href = '../dashboard/dashboard.html';
            return;
        }
        initializeLayout(user);
        initializeForm();
    } catch (error) {
        console.error("Authentication failed on immovable asset form page:", error);
    }
});

function initializeForm() {
    const API_ENDPOINT = 'immovable-assets';
    const { showToast } = createUIManager();

    // --- STATE ---
    const urlParams = new URLSearchParams(window.location.search);
    const assetId = urlParams.get('id');
    const isEditMode = !!assetId;

    // --- DOM ELEMENTS ---
    const form = document.getElementById('asset-form');
    const formTitle = document.getElementById('form-title');
    const submitButton = document.getElementById('submit-button');
    const typeSelect = document.getElementById('type');

    const detailSections = {
        'Land': document.getElementById('land-details-section'),
        'Building': document.getElementById('building-details-section'),
        'Other Structures': document.getElementById('building-details-section'), // Uses the same form as Building
        'Road Network': document.getElementById('road-details-section'),
        'Other Public Infrastructure': document.getElementById('infra-details-section'),
    };

    // --- UI LOGIC ---
    function toggleTypeSpecificFields(selectedType) {
        Object.values(detailSections).forEach(section => section.classList.add('hidden'));
        if (detailSections[selectedType]) {
            detailSections[selectedType].classList.remove('hidden');
        }
    }

    function populateForm(asset) {
        // Populate core fields
        Object.keys(asset).forEach(key => {
            const field = form.elements[key];
            if (field) {
                if (field.type === 'date' && asset[key]) {
                    field.value = new Date(asset[key]).toISOString().split('T')[0];
                } else {
                    field.value = asset[key];
                }
            }
        });

        // Populate nested detail fields
        Object.keys(detailSections).forEach(sectionKey => {
            const detailsKey = sectionKey.charAt(0).toLowerCase() + sectionKey.slice(1).replace(/\s+/g, '') + 'Details';
            if (asset[detailsKey]) {
                Object.keys(asset[detailsKey]).forEach(detailKey => {
                    const nestedObj = asset[detailsKey];
                    if (typeof nestedObj[detailKey] === 'object' && nestedObj[detailKey] !== null) {
                        // Handle third-level nesting (e.g., boundaries)
                        Object.keys(nestedObj[detailKey]).forEach(subKey => {
                            const fieldName = `${detailsKey}.${detailKey}.${subKey}`;
                            const field = form.elements[fieldName];
                            if (field) field.value = nestedObj[detailKey][subKey];
                        });
                    } else {
                        const fieldName = `${detailsKey}.${detailKey}`;
                        const field = form.elements[fieldName];
                        if (field) {
                             if (field.type === 'date' && nestedObj[detailKey]) {
                                field.value = new Date(nestedObj[detailKey]).toISOString().split('T')[0];
                            } else {
                                field.value = nestedObj[detailKey];
                            }
                        }
                    }
                });
            }
        });

        toggleTypeSpecificFields(asset.type);
    }

    // --- CORE LOGIC ---
    async function loadAssetForEditing() {
        try {
            const asset = await fetchWithAuth(`${API_ENDPOINT}/${assetId}`);
            populateForm(asset);
        } catch (error) {
            showToast(`Error loading asset: ${error.message}`, 'error');
            setTimeout(() => window.location.href = './immovable-registry.html', 2000);
        }
    }

    async function handleFormSubmit(event) {
        event.preventDefault();
        submitButton.disabled = true;
        submitButton.innerHTML = `<i data-lucide="loader-2" class="animate-spin"></i> Saving...`;
        lucide.createIcons();

        const formData = new FormData(form);
        const assetData = {};

        // Convert FormData to a nested object
        formData.forEach((value, key) => {
            // Handle nested properties like 'landDetails.lotNumber'
            const keys = key.split('.');
            let current = assetData;
            keys.forEach((k, i) => {
                if (i === keys.length - 1) {
                    current[k] = value === '' ? null : value;
                } else {
                    current[k] = current[k] || {};
                    current = current[k];
                }
            });
        });

        try {
            const endpoint = isEditMode ? `${API_ENDPOINT}/${assetId}` : API_ENDPOINT;
            const method = isEditMode ? 'PUT' : 'POST';
            await fetchWithAuth(endpoint, { method, body: assetData });
            showToast(`Asset ${isEditMode ? 'updated' : 'created'} successfully!`, 'success');
            setTimeout(() => window.location.href = './immovable-registry.html', 1500);
        } catch (error) {
            showToast(`Error: ${error.message}`, 'error');
            submitButton.disabled = false;
            submitButton.innerHTML = `<i data-lucide="save"></i> Save Asset`;
            lucide.createIcons();
        }
    }

    // --- INITIALIZATION ---
    if (isEditMode) {
        formTitle.textContent = 'Edit Immovable Asset';
        loadAssetForEditing();
    } else {
        toggleTypeSpecificFields(typeSelect.value); // Show default section
    }

    typeSelect.addEventListener('change', (e) => toggleTypeSpecificFields(e.target.value));
    form.addEventListener('submit', handleFormSubmit);
}
