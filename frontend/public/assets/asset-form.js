// FILE: frontend/public/assets/asset-form.js
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
        console.error("Authentication failed on asset form page:", error);
    }
});

function initializeForm() {
    const API_ENDPOINT = 'assets';
    const { showToast } = createUIManager();

    // --- STATE ---
    const urlParams = new URLSearchParams(window.location.search);
    const assetId = urlParams.get('id');
    const isEditMode = !!assetId;
    let employeesData = [];

    // --- DOM ELEMENTS ---
    const form = document.getElementById('asset-form');
    const formTitle = document.getElementById('form-title');
    const submitButton = document.getElementById('submit-button');
    const categorySelect = document.getElementById('category');
    const officeSelect = document.getElementById('office');
    const custodianNameSelect = document.getElementById('custodianName');
    const custodianDesignationInput = document.getElementById('custodianDesignation');
    const specificationsContainer = document.getElementById('specifications-container');
    const addSpecBtn = document.getElementById('add-spec-btn');
    const formTabs = document.getElementById('form-tabs');
    const detailsTab = document.getElementById('details-tab');
    const historyTab = document.getElementById('history-tab');
    const detailsPanel = document.getElementById('details-panel');
    const historyPanel = document.getElementById('history-panel');
    const historyContainer = document.getElementById('history-container');

    // --- UI LOGIC ---
    function populateDropdown(selectEl, data, valueField, textField, placeholder) {
        selectEl.innerHTML = `<option value="">${placeholder}</option>`;
        data.forEach(item => {
            const option = document.createElement('option');
            option.value = item[valueField];
            option.textContent = item[textField];
            selectEl.appendChild(option);
        });
    }

    function renderSpecification(spec = { key: '', value: '' }) {
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

    function renderHistory(history = []) {
        historyContainer.innerHTML = '';
        if (history.length === 0) {
            historyContainer.innerHTML = '<li>No history records found.</li>';
            return;
        }
        const sortedHistory = [...history].sort((a, b) => new Date(b.date) - new Date(a.date));
        sortedHistory.forEach((entry, index) => {
            const li = document.createElement('li');
            const formattedDate = new Date(entry.date).toLocaleString('en-US', { year: 'numeric', month: 'long', day: 'numeric', hour: '2-digit', minute: '2-digit' });
            const iconMap = { 'Created': 'plus', 'Updated': 'edit-3', 'Transfer': 'arrow-right-left', 'Physical Count': 'clipboard-check', 'Assignment': 'user-plus', 'Disposed': 'trash-2' };
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

    function populateForm(asset) {
        Object.keys(asset).forEach(key => {
            if (key === 'custodian') {
                custodianNameSelect.value = asset.custodian.name;
                custodianDesignationInput.value = asset.custodian.designation;
            } else {
                const field = form.elements[key];
                if (field) {
                    if (field.type === 'date' && asset[key]) {
                        field.value = new Date(asset[key]).toISOString().split('T')[0];
                    } else {
                        field.value = asset[key];
                    }
                }
            }
        });

        if (asset.specifications && asset.specifications.length > 0) {
            specificationsContainer.innerHTML = '';
            asset.specifications.forEach(spec => renderSpecification(spec));
        }

        if (asset.history) {
            renderHistory(asset.history);
        }
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
            populateDropdown(categorySelect, categories, 'name', 'name', 'Select a category');
            populateDropdown(officeSelect, offices, 'name', 'name', 'Select an office');
            populateDropdown(custodianNameSelect, employees, 'name', 'name', 'Select a custodian');

            if (isEditMode) {
                formTitle.textContent = 'Edit Asset';
                await loadAssetForEditing();
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

    async function handleFormSubmit(event) {
        event.preventDefault();
        submitButton.disabled = true;
        submitButton.innerHTML = `<i data-lucide="loader-2" class="animate-spin"></i> Saving...`;
        lucide.createIcons();

        const formData = new FormData(form);
        const assetData = Object.fromEntries(formData.entries());

        // Manually construct nested custodian object
        assetData.custodian = {
            name: formData.get('custodian.name'),
            designation: formData.get('custodian.designation'),
            office: formData.get('office') // Custodian office is the same as asset office
        };

        // Manually gather specifications
        assetData.specifications = [];
        const specRows = specificationsContainer.querySelectorAll('.spec-row');
        specRows.forEach(row => {
            const key = row.querySelector('.spec-key').value.trim();
            const value = row.querySelector('.spec-value').value.trim();
            if (key && value) {
                assetData.specifications.push({ key, value });
            }
        });

        try {
            const endpoint = isEditMode ? `${API_ENDPOINT}/${assetId}` : API_ENDPOINT;
            const method = isEditMode ? 'PUT' : 'POST';
            await fetchWithAuth(endpoint, { method, body: assetData });
            showToast(`Asset ${isEditMode ? 'updated' : 'created'} successfully!`, 'success');
            setTimeout(() => window.location.href = './asset-registry.html', 1500);
        } catch (error) {
            showToast(`Error: ${error.message}`, 'error');
            submitButton.disabled = false;
            submitButton.innerHTML = `<i data-lucide="save"></i> Save Asset`;
            lucide.createIcons();
        }
    }

    // --- EVENT LISTENERS ---
    custodianNameSelect.addEventListener('change', (e) => {
        const selectedEmployee = employeesData.find(emp => emp.name === e.target.value);
        custodianDesignationInput.value = selectedEmployee ? selectedEmployee.designation : '';
    });

    addSpecBtn.addEventListener('click', () => renderSpecification());
    specificationsContainer.addEventListener('click', (e) => {
        if (e.target.closest('.remove-spec-btn')) {
            e.target.closest('.spec-row').remove();
        }
    });

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

    // --- INITIALIZATION ---
    loadInitialData();
}
