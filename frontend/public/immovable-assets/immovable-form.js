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
    const componentsContainer = document.getElementById('components-container');
    const addComponentBtn = document.getElementById('add-component-btn');

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

    function renderComponent(component = { name: '', description: '' }) {
        const div = document.createElement('div');
        div.className = 'grid grid-cols-[1fr_2fr_auto] gap-2 items-center component-row';
        div.innerHTML = `
            <input type="text" placeholder="Component Name" class="input input-bordered input-sm component-name" value="${component.name || ''}" required>
            <input type="text" placeholder="Description / Details" class="input input-bordered input-sm component-description" value="${component.description || ''}">
            <button type="button" class="btn btn-sm btn-ghost text-red-500 remove-component-btn"><i data-lucide="x" class="h-4 w-4"></i></button>
        `;
        componentsContainer.appendChild(div);
        lucide.createIcons();
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

        // Populate components
        if (asset.components && asset.components.length > 0) {
            componentsContainer.innerHTML = ''; // Clear any empty rows
            asset.components.forEach(comp => renderComponent(comp));
        }

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

        // Manually gather components, as they are dynamic
        assetData.components = [];
        const componentRows = componentsContainer.querySelectorAll('.component-row');
        componentRows.forEach(row => {
            const name = row.querySelector('.component-name').value.trim();
            const description = row.querySelector('.component-description').value.trim();
            if (name) { // Only add if name is not empty
                assetData.components.push({ name, description });
            }
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
    addComponentBtn.addEventListener('click', () => {
        renderComponent();
    });
    componentsContainer.addEventListener('click', (e) => {
        if (e.target.closest('.remove-component-btn')) {
            e.target.closest('.component-row').remove();
        }
    });
    form.addEventListener('submit', handleFormSubmit);
}
