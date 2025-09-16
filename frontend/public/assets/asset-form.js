// FILE: frontend/public/assets/asset-form.js
import { fetchWithAuth } from '../js/api.js';
import { createUIManager, formatNumberOnInput, renderHistory, renderAttachments, renderNewAttachmentRow, renderRepairRow } from '../js/ui.js';
import { createAuthenticatedPage } from '../js/page-loader.js';

createAuthenticatedPage({
    // A user can access this form if they can either create OR update assets.
    permission: ['asset:create', 'asset:update'],
    pageInitializer: initializeForm,
    pageName: 'Asset Form'
});

function initializeForm(user) {
    const API_ENDPOINT = 'assets';
    const { showToast } = createUIManager();

    // --- STATE ---
    const urlParams = new URLSearchParams(window.location.search);
    const assetId = urlParams.get('id');
    const isEditMode = !!assetId;
    let employeesData = [];
    let categoriesData = [];
    let officesData = [];

    // --- DOM ELEMENTS ---
    const form = document.getElementById('asset-form');
    const formTitle = document.getElementById('form-title');
    const submitButton = document.getElementById('submit-button');
    const categoryInput = document.getElementById('category');
    const officeInput = document.getElementById('office');
    const custodianNameInput = document.getElementById('custodianName');
    const custodianOfficeInput = document.getElementById('custodianOffice');
    const acquisitionCostInput = document.getElementById('acquisitionCost');
    const salvageValueInput = document.getElementById('salvageValue');
    const propertyNumberInput = document.getElementById('propertyNumber');
    const propertyNumberLabel = document.querySelector('#property-number-container .label-text');
    const impairmentLossesInput = document.getElementById('impairmentLosses');
    const generatePropertyNumberBtn = document.getElementById('generate-property-number-btn');
    const custodianDesignationInput = document.getElementById('custodianDesignation');
    const categoryList = document.getElementById('category-list');
    const officeList = document.getElementById('office-list');
    const custodianNameList = document.getElementById('custodianName-list');
    const custodianOfficeList = document.getElementById('custodianOffice-list');
    const specificationsContainer = document.getElementById('specifications-container');
    const addSpecBtn = document.getElementById('add-spec-btn');
    const formTabs = document.getElementById('form-tabs');
    const detailsTab = document.getElementById('details-tab');
    const repairsTab = document.getElementById('repairs-tab');
    const historyTab = document.getElementById('history-tab');
    const detailsPanel = document.getElementById('details-panel');
    const repairsPanel = document.getElementById('repairs-panel');
    const historyPanel = document.getElementById('history-panel');
    const historyContainer = document.getElementById('history-container');
    const addAttachmentBtn = document.getElementById('add-attachment-btn');
    const newAttachmentsContainer = document.getElementById('new-attachments-container');
    const existingAttachmentsContainer = document.getElementById('existing-attachments-container');
    const existingAttachmentsList = document.getElementById('existing-attachments-list');
    const bulkCreateCard = document.getElementById('bulk-create-card');
    const bulkCreateToggle = document.getElementById('bulk-create-toggle');
    const bulkCreateFields = document.getElementById('bulk-create-fields');
    const bulkQuantityInput = document.getElementById('bulk-quantity');
    const newRepairAmountInput = document.getElementById('new-repair-amount');
    const repairsContainer = document.getElementById('repairs-container');
    const repairForm = document.getElementById('repair-form');

    // --- UI LOGIC ---
    function populateDatalist(datalistEl, data, valueField) {
        datalistEl.innerHTML = '';
        data.forEach(item => {
            const option = document.createElement('option');
            option.value = item[valueField];
            datalistEl.appendChild(option);
        });
    }

    function populateForm(asset) {
        Object.keys(asset).forEach(key => {
            if (key === 'custodian') {
                custodianNameInput.value = asset.custodian.name;
                custodianDesignationInput.value = asset.custodian.designation;
                custodianOfficeInput.value = asset.custodian.office;
            } else {
                const field = form.elements[key];
                if (field) {
                    if (field.type === 'date' && asset[key]) {
                        field.value = new Date(asset[key]).toISOString().split('T')[0];
                    } else {
                        // Format number fields with commas on load
                        if (['acquisitionCost', 'salvageValue', 'impairmentLosses'].includes(key) && typeof asset[key] === 'number') {
                            field.value = new Intl.NumberFormat('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(asset[key]);
                            return; // Skip the default assignment below
                        }
                        field.value = asset[key];
                    }
                }
            }
        });

        if (asset.specifications && asset.specifications.length > 0) {
            specificationsContainer.innerHTML = '';
            asset.specifications.forEach(spec => renderSpecificationRow(spec));
        }

        if (asset.history) {
            renderHistory(historyContainer, asset.history);
        }

        if (asset.attachments) {
            renderAttachments({ existingAttachmentsContainer, existingAttachmentsList }, asset.attachments);
        }

        // Populate repair history tab
        if (asset.repairHistory && asset.repairHistory.length > 0) {
            repairsContainer.innerHTML = ''; // Clear any empty rows
            // Filter out any null/undefined entries before rendering to prevent errors from corrupted data.
            asset.repairHistory.filter(Boolean).forEach(repair => renderRepairRow(repairsContainer, repair));
        } else {
            repairsContainer.innerHTML = '<p class="text-sm text-center text-base-content/70 p-4">No repair records found.</p>';
        }
    }

    function renderSpecificationRow(spec = { key: '', value: '' }) {
        const div = document.createElement('div');
        div.className = 'grid grid-cols-[1fr_2fr_auto] gap-2 items-center spec-row';
        div.innerHTML = `
            <input type="text" placeholder="Specification Name" class="input input-bordered input-sm spec-key" value="${spec.key || ''}">
            <input type="text" placeholder="Value" class="input input-bordered input-sm spec-value" value="${spec.value || ''}">
            <button type="button" class="btn btn-sm btn-ghost text-red-500 remove-spec-btn"><i data-lucide="x" class="h-4 w-4"></i></button>
        `;
        specificationsContainer.appendChild(div);
        lucide.createIcons();
    }
    // --- CORE LOGIC ---
    async function loadInitialData() {
        try {
            const [categories, offices, employees] = await Promise.all([
                fetchWithAuth('categories'),
                fetchWithAuth('offices'),
                fetchWithAuth('employees')
            ]);
            employeesData = employees;
            categoriesData = categories;
            officesData = offices;
            populateDatalist(categoryList, categories, 'name');
            populateDatalist(officeList, offices, 'name');
            populateDatalist(custodianNameList, employees, 'name');
            populateDatalist(custodianOfficeList, offices, 'name');

            if (isEditMode) {
                formTitle.textContent = 'Edit Asset';
                await loadAssetForEditing();
                bulkCreateCard.classList.add('hidden'); // Hide bulk create in edit mode
            }
        } catch (error) {
            showToast(`Error loading form data: ${error.message}`, 'error');
        }
    }

    async function loadAssetForEditing() {
        try {
            const asset = await fetchWithAuth(`${API_ENDPOINT}/${assetId}`);
            populateForm(asset);
            formTabs.classList.remove('hidden');
        } catch (error) {
            showToast(`Error loading asset: ${error.message}`, 'error');
            setTimeout(() => window.location.href = './asset-registry.html', 2000);
        }
    }

    async function handleGeneratePropertyNumber() {
        const categoryName = categoryInput.value;
        const officeName = officeInput.value;
        const acquisitionDate = document.getElementById('acquisitionDate').value;

        if (!categoryName || !officeName || !acquisitionDate) {
            showToast('Please select a Category, Assigned Office, and Acquisition Date first.', 'warning');
            return;
        }

        const selectedCategory = categoriesData.find(c => c.name === categoryName);
        const selectedOffice = officesData.find(o => o.name === officeName);
        const year = new Date(acquisitionDate).getFullYear();

        if (!selectedCategory || !selectedOffice) {
            showToast('Could not find data for the selected category or office.', 'error');
            return;
        }

        const { subMajorGroup, glAccount } = selectedCategory;
        const { code: officeCode } = selectedOffice;

        if (!subMajorGroup || !glAccount || !officeCode) {
            showToast('The selected category or office is missing required code information.', 'error');
            return;
        }

        generatePropertyNumberBtn.disabled = true;
        generatePropertyNumberBtn.innerHTML = `<span class="loading loading-spinner loading-xs"></span>`;

        try {
            const queryParams = new URLSearchParams({ year, subMajorGroup, glAccount, officeCode });
            const data = await fetchWithAuth(`assets/next-number?${queryParams.toString()}`);
            propertyNumberInput.value = data.nextPropertyNumber;
            showToast('Property number generated!', 'success');
        } catch (error) {
            showToast(`Error generating number: ${error.message}`, 'error');
        } finally {
            generatePropertyNumberBtn.disabled = false;
            generatePropertyNumberBtn.textContent = 'Generate';
        }
    }

    async function handleFormSubmit(event) {
        event.preventDefault();
        submitButton.disabled = true;
        submitButton.innerHTML = `<i data-lucide="loader-2" class="animate-spin"></i> Saving...`;
        lucide.createIcons();
        
        const isBulkCreate = bulkCreateToggle.checked && !isEditMode;

        // --- GATHER COMMON ASSET DATA ---
        const assetData = {};
        for (const element of form.elements) {
            // Skip files, and propertyNumber if in bulk mode
            if (!element.name || element.type === 'file' || (isBulkCreate && element.name === 'propertyNumber')) continue;

            let value = element.value;
            // Un-format number fields before sending to backend
            if (['acquisitionCost', 'salvageValue', 'impairmentLosses'].includes(element.name) && typeof value === 'string') {
                value = value.replace(/,/g, '');
            }

            const keys = element.name.split('.');
            let current = assetData;
            keys.forEach((k, i) => {
                if (i === keys.length - 1) {
                    current[k] = value === '' ? null : value;
                } else {
                    current[k] = current[k] || {};
                    current = current[k];
                }
            });
        }

        // Gather specifications
        const specRows = specificationsContainer.querySelectorAll('.spec-row');
        assetData.specifications = Array.from(specRows).map(row => ({
            key: row.querySelector('.spec-key').value.trim(),
            value: row.querySelector('.spec-value').value.trim()
        })).filter(spec => spec.key);

        // --- HANDLE BULK vs SINGLE ---
        if (isBulkCreate) {
            // --- BULK CREATE ---
            const payload = {
                assetData: assetData,
                quantity: parseInt(bulkQuantityInput.value, 10),
                startNumber: propertyNumberInput.value.trim()
            };

            if (!payload.quantity || payload.quantity < 1 || !payload.startNumber) {
                showToast('Please provide a valid quantity and starting property number for bulk creation.', 'error');
                submitButton.disabled = false;
                submitButton.innerHTML = `<i data-lucide="save"></i> Save Asset`;
                lucide.createIcons();
                return;
            }

            try {
                await fetchWithAuth('assets/bulk', { method: 'POST', body: payload });
                showToast(`${payload.quantity} assets created successfully!`, 'success');
                setTimeout(() => window.location.href = './asset-registry.html', 1500);
            } catch (error) {
                showToast(`Error: ${error.message}`, 'error');
                submitButton.disabled = false;
                submitButton.innerHTML = `<i data-lucide="save"></i> Save Asset`;
                lucide.createIcons();
            }
        } else {
            // --- SINGLE CREATE / UPDATE ---
            const formData = new FormData();

            // Append structured data to FormData
            Object.keys(assetData).forEach(key => {
                if (typeof assetData[key] === 'object' && assetData[key] !== null) {
                    formData.append(key, JSON.stringify(assetData[key]));
                } else if (assetData[key] !== null && assetData[key] !== undefined) {
                    formData.append(key, assetData[key]);
                }
            });

            // Append new files and their titles
            const attachmentTitles = [];
            const newAttachmentRows = newAttachmentsContainer.querySelectorAll('.new-attachment-row');
            newAttachmentRows.forEach(row => {
                const fileInput = row.querySelector('.new-attachment-file');
                const titleInput = row.querySelector('.new-attachment-title');
                if (fileInput.files.length > 0) {
                    formData.append('attachments', fileInput.files[0]);
                    attachmentTitles.push(titleInput.value.trim() || fileInput.files[0].name);
                }
            });
            if (formData.has('attachments')) {
                formData.append('attachmentTitles', JSON.stringify(attachmentTitles));
            }

            try {
                const endpoint = isEditMode ? `${API_ENDPOINT}/${assetId}` : API_ENDPOINT;
                const method = isEditMode ? 'PUT' : 'POST';
                await fetchWithAuth(endpoint, { method, body: formData });
                showToast(`Asset ${isEditMode ? 'updated' : 'created'} successfully!`, 'success');
                setTimeout(() => window.location.href = './asset-registry.html', 1500);
            } catch (error) {
                showToast(`Error: ${error.message}`, 'error');
                submitButton.disabled = false;
                submitButton.innerHTML = `<i data-lucide="save"></i> Save Asset`;
                lucide.createIcons();
            }
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

    // --- EVENT LISTENERS ---
    bulkCreateToggle.addEventListener('change', (e) => {
        const isBulk = e.target.checked;
        bulkCreateFields.classList.toggle('hidden', !isBulk);

        // Change the label for the main property number input
        if (isBulk) {
            propertyNumberLabel.textContent = 'Starting Property Number';
        } else {
            propertyNumberLabel.textContent = 'Property Number';
        }
    });

    custodianNameInput.addEventListener('input', (e) => {
        const selectedEmployee = employeesData.find(emp => emp.name === e.target.value);
        custodianDesignationInput.value = selectedEmployee ? selectedEmployee.designation : '';
    });

    acquisitionCostInput.addEventListener('input', (e) => {
        formatNumberOnInput(e.target);
        const cost = parseFloat(e.target.value.replace(/,/g, ''));
        if (!isNaN(cost) && cost >= 0) {
            const salvageValue = (cost * 0.05).toFixed(2);
            salvageValueInput.value = salvageValue;
            formatNumberOnInput(salvageValueInput);
        } else {
            salvageValueInput.value = '';
        }
    });

    // Add listeners for direct input on other currency fields
    salvageValueInput.addEventListener('input', (e) => formatNumberOnInput(e.target));
    impairmentLossesInput.addEventListener('input', (e) => formatNumberOnInput(e.target));
    newRepairAmountInput.addEventListener('input', (e) => formatNumberOnInput(e.target));

    generatePropertyNumberBtn.addEventListener('click', handleGeneratePropertyNumber);

    addSpecBtn.addEventListener('click', () => renderSpecificationRow());
    specificationsContainer.addEventListener('click', (e) => {
        if (e.target.closest('.remove-spec-btn')) {
            e.target.closest('.spec-row').remove();
        }
    });

    addAttachmentBtn.addEventListener('click', () => renderNewAttachmentRow(newAttachmentsContainer));
    newAttachmentsContainer.addEventListener('click', (e) => {
        const removeBtn = e.target.closest('.remove-new-attachment-btn');
        if (removeBtn) {
            removeBtn.closest('.new-attachment-row').remove();
        }
    });
    existingAttachmentsList.addEventListener('click', handleAttachmentDelete);

    // --- Tab Switching Logic ---
    const tabs = [detailsTab, repairsTab, historyTab];
    const panels = [detailsPanel, repairsPanel, historyPanel];

    function switchTab(activeIndex) {
        tabs.forEach((tab, index) => {
            if (tab) tab.classList.toggle('tab-active', index === activeIndex);
        });
        panels.forEach((panel, index) => {
            if (panel) panel.classList.toggle('hidden', index !== activeIndex);
        });
        // Show/hide main save button based on which tab is active
        submitButton.classList.toggle('hidden', activeIndex !== 0);
    }

    detailsTab.addEventListener('click', () => {
        switchTab(0);
    });

    repairsTab.addEventListener('click', () => {
        switchTab(1);
    });

    historyTab.addEventListener('click', () => {
        switchTab(2);
    });

    form.addEventListener('submit', handleFormSubmit);

    // --- Repair Form Logic ---
    repairForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        const repairData = {
            date: document.getElementById('new-repair-date').value,
            natureOfRepair: document.getElementById('new-repair-nature').value,
            amount: document.getElementById('new-repair-amount').value.replace(/,/g, ''),
        };

        if (!repairData.date || !repairData.natureOfRepair || !repairData.amount) {
            showToast('Please fill out all repair fields.', 'error');
            return;
        }

        try {
            await fetchWithAuth(`${API_ENDPOINT}/${assetId}/repairs`, {
                method: 'POST',
                body: JSON.stringify(repairData)
            });
            showToast('Repair record added successfully.', 'success');
            repairForm.reset();
            loadAssetForEditing(); // Reload to refresh all tabs
        } catch (error) {
            showToast(`Error adding repair: ${error.message}`, 'error');
        }
    });

    repairsContainer.addEventListener('click', async (e) => {
        const removeBtn = e.target.closest('.remove-repair-btn');
        if (removeBtn) {
            const repairId = removeBtn.dataset.repairId;
            if (confirm('Are you sure you want to delete this repair record?')) {
                try {
                    await fetchWithAuth(`${API_ENDPOINT}/${assetId}/repairs/${repairId}`, {
                        method: 'DELETE'
                    });
                    showToast('Repair record deleted.', 'success');
                    loadAssetForEditing(); // Reload to refresh
                } catch (error) {
                    showToast(`Error deleting repair: ${error.message}`, 'error');
                }
            }
        }
    });

    // --- INITIALIZATION ---
    loadInitialData();
    console.log(`Page initialized for user: ${user.name}`);
}
