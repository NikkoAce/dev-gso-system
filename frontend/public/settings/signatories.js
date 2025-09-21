import { fetchWithAuth } from '../js/api.js';
import { createUIManager } from '../js/ui.js';
import { createAuthenticatedPage } from '../js/page-loader.js';

createAuthenticatedPage({
    permission: 'settings:manage',
    pageInitializer: initializeSignatoriesPage,
    pageName: 'Manage Signatories'
});

function initializeSignatoriesPage(user) {
    const { showToast } = createUIManager();
    const API_ENDPOINT = 'signatories';

    // --- DOM ELEMENTS ---
    const form = document.getElementById('signatories-form');
    const container = document.getElementById('signatories-container');
    const saveBtn = document.getElementById('save-signatories-btn');

    // --- RESTRUCTURED CONFIGURATION for the form fields ---
    const SIGNATORY_GROUPS = [
        {
            title: 'Supply Requisition Forms (RIS, SAI)',
            signatories: [
                {
                    key: 'ris_approved_by',
                    label: 'RIS - Approved By',
                    defaultName: 'MAYOR',
                    defaultTitle: 'Municipal Mayor'
                },
                {
                    key: 'ris_issued_by',
                    label: 'RIS - Issued By',
                    defaultName: 'GSO',
                    defaultTitle: 'General Services Officer'
                },
                {
                    key: 'sai_certified_by',
                    label: 'SAI - Availability Certified By',
                    defaultName: 'GSO',
                    defaultTitle: 'General Services Officer'
                }
            ]
        },
        {
            title: 'Property Accountability Forms (PAR, ICS, PTR)',
            signatories: [
                {
                    key: 'par_ics_issued_by',
                    label: 'PAR/ICS - Issued By',
                    defaultName: 'DR. RAYCHEL B. VALENCIA',
                    defaultTitle: 'Municipal Administrator/OIC GSO'
                },
                {
                    key: 'ptr_approved_by',
                    label: 'PTR - Approved By',
                    defaultName: '________________________',
                    defaultTitle: 'Head of Agency/Entity or his/her Authorized Representative'
                }
            ]
        },
        {
            title: 'Disposal Forms (IIRUP, Appendix 68)',
            signatories: [
                {
                    key: 'iirup_inspection_officer',
                    label: 'IIRUP - Inspection Officer',
                    defaultName: '________________________',
                    defaultTitle: 'Inspection Officer'
                },
                {
                    key: 'a68_disposal_approved_by',
                    label: 'Appendix 68 - Disposal Approved By',
                    defaultName: '',
                    defaultTitle: 'Head of Agency/Entity'
                },
                {
                    key: 'a68_certified_by_inspector',
                    label: 'Appendix 68 - Certified by Inspector',
                    defaultName: '',
                    defaultTitle: 'Inspection Officer'
                },
                {
                    key: 'a68_witness_to_disposal',
                    label: 'Appendix 68 - Witness to Disposal',
                    defaultName: '',
                    defaultTitle: 'Witness'
                }
            ]
        }
    ];

    // --- RENDERING ---
    function renderForm(settings, employees) {
        container.innerHTML = '';
        // Loop through each group to create a card
        SIGNATORY_GROUPS.forEach(group => {
            const groupCard = document.createElement('div');
            groupCard.className = 'card bg-base-200/50 border';
            
            const cardBody = document.createElement('div');
            cardBody.className = 'card-body p-6 space-y-4';
            
            const groupTitle = document.createElement('h3');
            groupTitle.className = 'card-title text-lg';
            groupTitle.textContent = group.title;
            cardBody.appendChild(groupTitle);

            // Loop through signatories within the group
            group.signatories.forEach(config => {
                const setting = settings.find(s => s.key === config.key) || {};
                const name = setting.value?.name || config.defaultName;
                const title = setting.value?.title || config.defaultTitle;

                const employeeOptions = employees.map(emp => {
                    const escapedName = emp.name.replace(/"/g, '&quot;');
                    const isSelected = name === emp.name ? 'selected' : '';
                    return `<option value="${escapedName}" ${isSelected}>${emp.name}</option>`;
                }).join('');

                const nameSelectHTML = `
                    <select id="${config.key}_name" class="select select-bordered w-full font-normal">
                        <option value="">-- Select Employee --</option>
                        <option value="________________________" ${name === '________________________' ? 'selected' : ''}>-- Leave Blank --</option>
                        ${employeeOptions}
                    </select>
                `;

                const fieldset = document.createElement('fieldset');
                fieldset.className = 'border-t pt-4';
                fieldset.innerHTML = `
                    <legend class="font-semibold px-2 -mt-7 bg-base-200/0">${config.label}</legend>
                    <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <label class="form-control">
                            <div class="label"><span class="label-text">Printed Name</span></div>
                            ${nameSelectHTML}
                        </label>
                        <label class="form-control">
                            <div class="label"><span class="label-text">Designation / Title</span></div>
                            <input type="text" id="${config.key}_title" value="${title}" class="input input-bordered w-full">
                        </label>
                    </div>
                `;
                cardBody.appendChild(fieldset);

                // Find elements within the newly created fieldset, not the global document
                const nameSelect = fieldset.querySelector(`#${config.key}_name`);
                const titleInput = fieldset.querySelector(`#${config.key}_title`);
                if (nameSelect && titleInput) {
                    nameSelect.addEventListener('change', () => {
                        const selectedEmployee = employees.find(emp => emp.name === nameSelect.value);
                        if (selectedEmployee) {
                            titleInput.value = selectedEmployee.designation;
                        } else {
                            titleInput.value = config.defaultTitle;
                        }
                    });
                }
            });

            groupCard.appendChild(cardBody);
            container.appendChild(groupCard);
        });
    }

    // --- DATA HANDLING ---
    async function loadSignatories() {
        try {
            const [settings, employees] = await Promise.all([
                fetchWithAuth(API_ENDPOINT),
                fetchWithAuth('employees') // Fetch all employees for the dropdown
            ]);
            renderForm(settings, employees);
        } catch (error) {
            showToast(`Error loading settings: ${error.message}`, 'error');
            container.innerHTML = `<p class="text-error text-center">Could not load signatory settings.</p>`;
        }
    }

    async function handleSave(e) {
        e.preventDefault();
        saveBtn.disabled = true;
        saveBtn.innerHTML = `<span class="loading loading-spinner"></span> Saving...`;

        const settingsToSave = [];
        SIGNATORY_GROUPS.forEach(group => {
            group.signatories.forEach(config => {
                settingsToSave.push({
                    key: config.key,
                    value: {
                        name: document.getElementById(`${config.key}_name`).value,
                        title: document.getElementById(`${config.key}_title`).value,
                    }
                });
            });
        });

        try {
            await fetchWithAuth(API_ENDPOINT, { method: 'POST', body: JSON.stringify(settingsToSave) });
            showToast('Signatory settings saved successfully!', 'success');
        } catch (error) {
            showToast(`Error saving settings: ${error.message}`, 'error');
        } finally {
            saveBtn.disabled = false;
            saveBtn.innerHTML = `<i data-lucide="save"></i> Save Changes`;
            lucide.createIcons();
        }
    }

    // --- INITIALIZATION ---
    form.addEventListener('submit', handleSave);
    loadSignatories();
}