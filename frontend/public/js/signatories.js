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
    const API_ENDPOINT = 'settings/signatories';

    // --- DOM ELEMENTS ---
    const form = document.getElementById('signatories-form');
    const container = document.getElementById('signatories-container');
    const saveBtn = document.getElementById('save-signatories-btn');

    // --- CONFIGURATION for the form fields ---
    const SIGNATORY_CONFIG = [
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
            key: 'par_ics_issued_by',
            label: 'PAR/ICS - Issued By',
            defaultName: 'DR. RAYCHEL B. VALENCIA',
            defaultTitle: 'Municipal Administrator/OIC GSO'
        },
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
        },
    ];

    // --- RENDERING ---
    function renderForm(settings) {
        container.innerHTML = '';
        SIGNATORY_CONFIG.forEach(config => {
            const setting = settings.find(s => s.key === config.key) || {};
            const name = setting.value?.name || config.defaultName;
            const title = setting.value?.title || config.defaultTitle;

            const fieldset = document.createElement('fieldset');
            fieldset.className = 'border p-4 rounded-lg';
            fieldset.innerHTML = `
                <legend class="font-semibold px-2">${config.label}</legend>
                <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <label class="form-control">
                        <div class="label"><span class="label-text">Printed Name</span></div>
                        <input type="text" id="${config.key}_name" value="${name}" class="input input-bordered w-full">
                    </label>
                    <label class="form-control">
                        <div class="label"><span class="label-text">Designation / Title</span></div>
                        <input type="text" id="${config.key}_title" value="${title}" class="input input-bordered w-full">
                    </label>
                </div>
            `;
            container.appendChild(fieldset);
        });
    }

    // --- DATA HANDLING ---
    async function loadSignatories() {
        try {
            const settings = await fetchWithAuth(API_ENDPOINT);
            renderForm(settings);
        } catch (error) {
            showToast(`Error loading settings: ${error.message}`, 'error');
            container.innerHTML = `<p class="text-error text-center">Could not load signatory settings.</p>`;
        }
    }

    async function handleSave(e) {
        e.preventDefault();
        saveBtn.disabled = true;
        saveBtn.innerHTML = `<span class="loading loading-spinner"></span> Saving...`;

        const settingsToSave = SIGNATORY_CONFIG.map(config => ({
            key: config.key,
            value: {
                name: document.getElementById(`${config.key}_name`).value,
                title: document.getElementById(`${config.key}_title`).value,
            }
        }));

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