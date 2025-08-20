import { fetchWithAuth } from './api.js';

document.addEventListener('DOMContentLoaded', async () => {
    try {
        const user = await getCurrentUser();
        if (!user) return;

        initializeLayout(user);
        initializeAssetForm(user);
    } catch (error) {
        console.error("Authentication failed on asset form page:", error);
    }
});

/**
 * Initializes the entire asset form page, breaking down logic into smaller,
 * more manageable modules.
 * @param {object} currentUser - The currently logged-in user.
 */
function initializeAssetForm(currentUser) {
    // --- MODULE: STATE MANAGEMENT ---
    const state = {
        allAssets: [],
        allCategories: [],
        allOffices: [],
        allEmployees: [],
        isEditMode: false,
        assetId: null,
        tomSelectInstances: {}, // To hold TomSelect instances
    };

    // --- MODULE: DOM ELEMENT CACHE ---
    const DOM = {
        assetForm: document.getElementById('asset-form'),
        formTitle: document.getElementById('form-title'),
        assetIdField: document.getElementById('assetId'),
        specsContainer: document.getElementById('specifications-container'),
        quantityInput: document.getElementById('quantity'),
        propertyNumberInput: document.getElementById('propertyNumber'),
        propertyNumberLabel: document.getElementById('propertyNumberLabel'),
        descriptionInput: document.getElementById('description'),
        categorySelect: document.getElementById('category'),
        officeSelect: document.getElementById('office'),
        custodianNameSelect: document.getElementById('custodian-name'),
        custodianOfficeSelect: document.getElementById('custodian-office'),
        acquisitionDateInput: document.getElementById('acquisitionDate'),
        fundSourceInput: document.getElementById('fundSource'),
        acquisitionCostInput: document.getElementById('acquisitionCost'),
        usefulLifeInput: document.getElementById('usefulLife'),
        salvageValueInput: document.getElementById('salvageValue'),
        statusSelect: document.getElementById('status'),
        addSpecBtn: document.getElementById('add-spec-btn'),
        cancelBtn: document.getElementById('cancel-asset-form'),
        submitBtn: document.getElementById('submit-asset-btn'),
    };

    // --- MODULE: API SERVICE ---
    const apiService = {
        async fetchInitialData() {
            [state.allCategories, state.allOffices, state.allEmployees, state.allAssets] = await Promise.all([
                fetchWithAuth('categories'),
                fetchWithAuth('offices'),
                fetchWithAuth('employees'),
                fetchWithAuth('assets')
            ]);
        },
        async getAssetById(id) {
            return fetchWithAuth(`assets/${id}`);
        },
        async getNextPropertyNumber(year, subMajorGroup, glAccount, officeCode) {
            const params = new URLSearchParams({ year, subMajorGroup, glAccount, officeCode }).toString();
            return fetchWithAuth(`assets/next-number?${params}`);
        },
        async saveBulkAssets(assetData, quantity, startNumber) {
             return fetchWithAuth('assets/bulk', {
                method: 'POST',
                body: JSON.stringify({ assetData, quantity, startNumber })
            });
        }
    };

    // --- MODULE: UTILITIES ---
    const formatDate = (dateString) => dateString ? new Date(dateString).toISOString().split('T')[0] : '';

    // --- MODULE: SPECIFICATIONS MANAGER ---
    const specificationsManager = {
        add(key = '', value = '') {
            const div = document.createElement('div');
            div.className = 'spec-row flex items-center gap-2';
            div.innerHTML = `
                <input type="text" placeholder="Specification Name (e.g., Color)" value="${key}" class="spec-key w-1/3 border-gray-300 rounded-md shadow-sm text-sm p-2">
                <input type="text" placeholder="Value (e.g., Blue)" value="${value}" class="spec-value flex-grow border-gray-300 rounded-md shadow-sm text-sm p-2">
                <button type="button" class="remove-spec-btn text-red-500 hover:text-red-700"><i data-lucide="x-circle" class="h-5 w-5"></i></button>
            `;
            DOM.specsContainer.appendChild(div);
            lucide.createIcons();
        },
        get() {
            const specs = [];
            DOM.specsContainer.querySelectorAll('.spec-row').forEach(row => {
                const key = row.querySelector('.spec-key').value.trim();
                const value = row.querySelector('.spec-value').value.trim();
                if (key && value) specs.push({ key, value });
            });
            return specs;
        },
        clear() {
            DOM.specsContainer.innerHTML = '';
        },
        remove(element) {
            element.closest('.spec-row').remove();
        }
    };

    // --- MODULE: FORM UI & POPULATION ---
    const formUI = {
        initializeSearchableDropdowns() {
            const tomSelectSettings = {
                create: false,
                sortField: {
                    field: "text",
                    direction: "asc"
                }
            };
            // Store instances for later use (e.g., setting values programmatically)
            state.tomSelectInstances.category = new TomSelect(DOM.categorySelect, tomSelectSettings);
            state.tomSelectInstances.office = new TomSelect(DOM.officeSelect, tomSelectSettings);
            state.tomSelectInstances.custodianName = new TomSelect(DOM.custodianNameSelect, tomSelectSettings);
            state.tomSelectInstances.custodianOffice = new TomSelect(DOM.custodianOfficeSelect, tomSelectSettings);
        },
        populateDropdowns() {
            const createOption = (value, text) => `<option value="${value}">${text}</option>`;
            DOM.categorySelect.innerHTML = '<option value="">Select a category...</option>' + state.allCategories.map(c => createOption(c.name, c.name)).join('');
            DOM.officeSelect.innerHTML = '<option value="">Select an office...</option>' + state.allOffices.map(o => createOption(o.name, o.name)).join('');
            DOM.custodianNameSelect.innerHTML = '<option value="">Select a custodian...</option>' + state.allEmployees.map(e => createOption(e.name, e.name)).join('');
            DOM.custodianOfficeSelect.innerHTML = '<option value="">Select an office...</option>' + state.allOffices.map(o => createOption(o.name, o.name)).join('');
        },
        setFormMode(mode, asset = null) {
            state.isEditMode = mode === 'edit';
            DOM.formTitle.textContent = state.isEditMode ? 'Edit Asset' : 'Add New Asset';
            DOM.quantityInput.disabled = state.isEditMode;
            DOM.propertyNumberInput.readOnly = state.isEditMode;
            DOM.propertyNumberInput.classList.toggle('bg-gray-100', state.isEditMode);

            if (state.isEditMode && asset) {
                this.populateForm(asset);
            } else {
                this.resetForm();
            }
        },
        populateForm(asset) {
            DOM.assetIdField.value = asset._id;
            DOM.propertyNumberInput.value = asset.propertyNumber;
            DOM.descriptionInput.value = asset.description;
            DOM.quantityInput.value = 1;
            DOM.acquisitionDateInput.value = formatDate(asset.acquisitionDate);
            DOM.acquisitionCostInput.value = asset.acquisitionCost;
            DOM.usefulLifeInput.value = asset.usefulLife;
            DOM.salvageValueInput.value = asset.salvageValue;
            DOM.fundSourceInput.value = asset.fundSource;
            DOM.statusSelect.value = asset.status;

            // Set values using TomSelect API. The `true` flag prevents firing 'change' events.
            state.tomSelectInstances.category.setValue(asset.category, true);
            state.tomSelectInstances.office.setValue(asset.office, true);
            state.tomSelectInstances.custodianName.setValue(asset.custodian.name, true);
            state.tomSelectInstances.custodianOffice.setValue(asset.custodian.office, true);

            specificationsManager.clear();
            if (asset.specifications && asset.specifications.length > 0) {
                asset.specifications.forEach(spec => specificationsManager.add(spec.key, spec.value));
            } else {
                specificationsManager.add('Model Number', '');
                specificationsManager.add('Serial Number', '');
            }
        },
        resetForm() {
            DOM.assetForm.reset();
            DOM.assetIdField.value = '';

            // Clear TomSelect instances
            Object.values(state.tomSelectInstances).forEach(instance => instance.clear());

            specificationsManager.clear();
            specificationsManager.add('Model Number', '');
            specificationsManager.add('Serial Number', '');
            // Set to today's date in the user's local timezone to avoid off-by-one day errors.
            const today = new Date();
            const localDate = new Date(today.getTime() - (today.getTimezoneOffset() * 60000));
            DOM.acquisitionDateInput.value = localDate.toISOString().split('T')[0];
            formLogic.generatePropertyNumber();
        },
        async determineFormMode() {
            const urlParams = new URLSearchParams(window.location.search);
            state.assetId = urlParams.get('id');
            if (state.assetId) {
                try {
                    const asset = await apiService.getAssetById(state.assetId);
                    this.setFormMode('edit', asset);
                } catch (error) {
                    alert(error.message);
                    window.location.href = 'asset-registry.html';
                }
            } else {
                this.setFormMode('add');
            }
        }
    };

    // --- MODULE: FORM LOGIC & EVENT HANDLING ---
    const formLogic = {
        async generatePropertyNumber() {
            if (state.isEditMode) return;

            const year = new Date(DOM.acquisitionDateInput.value).getFullYear();
            const category = state.allCategories.find(c => c.name === DOM.categorySelect.value);
            const office = state.allOffices.find(o => o.name === DOM.officeSelect.value);

            if (!year || !category || !office) {
                DOM.propertyNumberInput.value = 'Select Date, Category, and Office to generate...';
                return;
            }

            try {
                DOM.propertyNumberInput.value = 'Generating...';
                const data = await apiService.getNextPropertyNumber(year, category.subMajorGroup, category.glAccount, office.code);
                DOM.propertyNumberInput.value = data.nextPropertyNumber;
            } catch (error) {
                console.error(error);
                DOM.propertyNumberInput.value = 'Error generating number.';
            }
        },
        calculateSalvageValue() {
            const cost = parseFloat(DOM.acquisitionCostInput.value);
            DOM.salvageValueInput.value = (!isNaN(cost) && cost > 0) ? (cost * 0.05).toFixed(2) : '';
        },
        validateForm(data) {
            if (state.allAssets.some(asset => asset.propertyNumber === data.propertyNumber && asset._id !== state.assetId)) {
                alert('Error: Property Number already exists.');
                return false;
            }
            return true;
        },
        async handleFormSubmit(e) {
            e.preventDefault();
            const quantity = parseInt(DOM.quantityInput.value, 10);
            const selectedEmployee = state.allEmployees.find(emp => emp.name === DOM.custodianNameSelect.value);

            // Adjust date to prevent timezone issues. By setting the time to noon UTC,
            // we ensure that timezone conversions won't shift the date to a different day.
            const localDate = DOM.acquisitionDateInput.value;
            const acquisitionDateUTC = localDate ? new Date(`${localDate}T12:00:00.000Z`) : null;

            const assetData = {
                user: { name: currentUser.name, office: currentUser.office },
                description: DOM.descriptionInput.value,
                specifications: specificationsManager.get(),
                category: DOM.categorySelect.value,
                fundSource: DOM.fundSourceInput.value,
                office: DOM.officeSelect.value,
                custodian: {
                    name: DOM.custodianNameSelect.value,
                    designation: selectedEmployee ? selectedEmployee.designation : '',
                    office: DOM.custodianOfficeSelect.value
                },
                acquisitionDate: acquisitionDateUTC,
                acquisitionCost: parseFloat(DOM.acquisitionCostInput.value),
                usefulLife: parseInt(DOM.usefulLifeInput.value),
                salvageValue: parseFloat(DOM.salvageValueInput.value) || 0,
                status: DOM.statusSelect.value,
            };

            if (quantity > 1 && !state.isEditMode) {
                // BULK CREATE
                const startNumber = DOM.propertyNumberInput.value;
                try {
                    await apiService.saveBulkAssets(assetData, quantity, startNumber);
                    alert(`${quantity} assets created successfully!`);
                    window.location.href = 'asset-registry.html';
                } catch (error) {
                    alert(`Error: ${error.message}`);
                }
            } else {
                // SINGLE CREATE / UPDATE
                assetData.propertyNumber = DOM.propertyNumberInput.value;
                if (!formLogic.validateForm(assetData)) return;

                const method = state.isEditMode ? 'PUT' : 'POST';
                const endpoint = state.isEditMode ? `assets/${state.assetId}` : 'assets';

                try {
                    await fetchWithAuth(endpoint, {
                        method: method,
                        body: JSON.stringify(assetData)
                    });
                    alert(`Asset ${state.isEditMode ? 'updated' : 'added'} successfully!`);
                    window.location.href = 'asset-registry.html';
                } catch (error) {
                    alert(`Error: ${error.message}`);
                }
            }
        },
        setupEventListeners() {
            DOM.assetForm.addEventListener('submit', this.handleFormSubmit);
            DOM.addSpecBtn.addEventListener('click', () => specificationsManager.add());
            DOM.specsContainer.addEventListener('click', (e) => {
                const removeBtn = e.target.closest('.remove-spec-btn');
                if (removeBtn) {
                    specificationsManager.remove(removeBtn);
                }
            });
            DOM.cancelBtn.addEventListener('click', () => {
                window.location.href = 'asset-registry.html';
            });
            DOM.quantityInput.addEventListener('input', () => {
                const quantity = parseInt(DOM.quantityInput.value, 10);
                DOM.propertyNumberLabel.textContent = quantity > 1 ? 'Starting Property Number *' : 'Property Number *';
            });
            [DOM.acquisitionDateInput, DOM.categorySelect, DOM.officeSelect].forEach(el => {
                el.addEventListener('change', () => this.generatePropertyNumber());
            });
            DOM.acquisitionCostInput.addEventListener('input', () => this.calculateSalvageValue());
        }
    };

    // --- INITIALIZATION ORCHESTRATOR ---
    async function main() {
        try {
            await apiService.fetchInitialData();
            formUI.populateDropdowns();
            formUI.initializeSearchableDropdowns();
            await formUI.determineFormMode();
            formLogic.setupEventListeners();
        } catch (error) {
            console.error("Failed to initialize form:", error);
            alert("Error: Could not initialize the asset form. Please try again later.");
        }
    }

    main();
}