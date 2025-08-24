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
    const formTabs = document.getElementById('form-tabs');
    const detailsTab = document.getElementById('details-tab');
    const historyTab = document.getElementById('history-tab');
    const detailsPanel = document.getElementById('details-panel');
    const historyPanel = document.getElementById('history-panel');
    const historyContainer = document.getElementById('history-container');
    const attachmentsInput = document.getElementById('attachments');
    const existingAttachmentsContainer = document.getElementById('existing-attachments-container');
    const existingAttachmentsList = document.getElementById('existing-attachments-list');

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

    function renderHistory(history = []) {
        historyContainer.innerHTML = '';
        if (history.length === 0) {
            historyContainer.innerHTML = '<li>No history records found.</li>';
            return;
        }

        const sortedHistory = [...history].sort((a, b) => new Date(b.date) - new Date(a.date));

        sortedHistory.forEach((entry, index) => {
            const li = document.createElement('li');
            const formattedDate = new Date(entry.date).toLocaleString('en-US', {
                year: 'numeric', month: 'long', day: 'numeric', hour: '2-digit', minute: '2-digit'
            });

            const iconMap = { 'Created': 'plus', 'Updated': 'edit-3', 'Disposed': 'trash-2', 'Asset Created': 'plus' };
            const icon = iconMap[entry.event] || 'history';

            li.innerHTML = `
                <div class="timeline-middle"><i data-lucide="${icon}" class="h-5 w-5"></i></div>
                <div class="timeline-end timeline-box">
                    <time class="font-mono italic text-xs">${formattedDate}</time>
                    <div class="text-lg font-black">${entry.event}</div>
                    <p class="text-sm">${entry.details}</p>
                    <p class="text-xs text-base-content/70 mt-1">by ${entry.user}</p>
                </div>
                ${index < sortedHistory.length - 1 ? '<hr/>' : ''}
            `;
            historyContainer.appendChild(li);
        });
        lucide.createIcons();
    }

    function renderAttachments(attachments = []) {
        if (attachments.length > 0) {
            existingAttachmentsContainer.classList.remove('hidden');
            existingAttachmentsList.innerHTML = '';
            attachments.forEach(att => {
                const li = document.createElement('li');
                li.className = 'flex items-center justify-between text-sm';
                li.innerHTML = `
                    <a href="${att.url}" target="_blank" class="link link-primary hover:underline">${att.originalName}</a>
                    <button type="button" class="btn btn-xs btn-ghost text-red-500 remove-attachment-btn" data-key="${att.key}" title="Delete Attachment">
                        <i data-lucide="x" class="h-4 w-4"></i>
                    </button>
                `;
                existingAttachmentsList.appendChild(li);
            });
            lucide.createIcons();
        } else {
            existingAttachmentsContainer.classList.add('hidden');
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

        // Populate components
        if (asset.components && asset.components.length > 0) {
            componentsContainer.innerHTML = ''; // Clear any empty rows
            asset.components.forEach(comp => renderComponent(comp));
        }

        // Populate history tab
        if (asset.history) {
            renderHistory(asset.history);
        }

        // Populate attachments
        if (asset.attachments) {
            renderAttachments(asset.attachments);
        }

        toggleTypeSpecificFields(asset.type);
    }

    // --- CORE LOGIC ---
    async function loadAssetForEditing() {
        try {
            const asset = await fetchWithAuth(`${API_ENDPOINT}/${assetId}`);
            populateForm(asset);
            formTabs.classList.remove('hidden'); // Show tabs only in edit mode
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

        const formData = new FormData();
        const formElements = form.elements;
        const assetData = {}; // To hold structured data before appending

        // 1. Structure the data from form fields
        for (const element of formElements) {
            if (!element.name || element.type === 'file') continue;
            const keys = key.split('.');
            let current = assetData;
            keys.forEach((k, i) => {
                if (i === keys.length - 1) {
                    current[k] = element.value === '' ? null : element.value;
                } else {
                    current[k] = current[k] || {};
                    current = current[k];
                }
            });
        }

        // 2. Stringify nested objects and append to FormData
        Object.keys(assetData).forEach(key => {
            if (typeof assetData[key] === 'object' && assetData[key] !== null) {
                formData.append(key, JSON.stringify(assetData[key]));
            } else if (assetData[key] !== null && assetData[key] !== undefined) {
                formData.append(key, assetData[key]);
            }
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
        formData.append('components', JSON.stringify(assetData.components));

        // Append new files to be uploaded
        for (const file of attachmentsInput.files) {
            formData.append('attachments', file);
        }

        try {
            const endpoint = isEditMode ? `${API_ENDPOINT}/${assetId}` : API_ENDPOINT;
            const method = isEditMode ? 'PUT' : 'POST';
            // fetchWithAuth is already configured to handle FormData
            await fetchWithAuth(endpoint, { method, body: formData });
            showToast(`Asset ${isEditMode ? 'updated' : 'created'} successfully!`, 'success');
            setTimeout(() => window.location.href = './immovable-registry.html', 1500);
        } catch (error) {
            showToast(`Error: ${error.message}`, 'error');
            submitButton.disabled = false;
            submitButton.innerHTML = `<i data-lucide="save"></i> Save Asset`;
            lucide.createIcons();
        }
    }

    async function handleAttachmentDelete(e) {
        const deleteButton = e.target.closest('.remove-attachment-btn');
        if (!deleteButton) return;

        const attachmentKey = deleteButton.dataset.key;
        if (!assetId || !attachmentKey) return;

        if (confirm('Are you sure you want to permanently delete this file?')) {
            try {
                await fetchWithAuth(`${API_ENDPOINT}/${assetId}/attachments/${encodeURIComponent(attachmentKey)}`, { method: 'DELETE' });
                showToast('Attachment deleted successfully.', 'success');
                loadAssetForEditing(); // Reload the form to show the updated list
            } catch (error) {
                showToast(`Error deleting attachment: ${error.message}`, 'error');
            }
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

    existingAttachmentsList.addEventListener('click', handleAttachmentDelete);

    detailsTab.addEventListener('click', () => {
        detailsTab.classList.add('tab-active');
        historyTab.classList.remove('tab-active');
        detailsPanel.classList.remove('hidden');
        historyPanel.classList.add('hidden');
        submitButton.classList.remove('hidden');
    });

    historyTab.addEventListener('click', () => {
        historyTab.classList.add('tab-active');
        detailsTab.classList.remove('tab-active');
        historyPanel.classList.remove('hidden');
        detailsPanel.classList.add('hidden');
        submitButton.classList.add('hidden');
    });

    form.addEventListener('submit', handleFormSubmit);
}
