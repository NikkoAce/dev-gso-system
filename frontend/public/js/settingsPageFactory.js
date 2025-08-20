// FILE: frontend/public/js/settingsPageFactory.js
import { fetchWithAuth } from '../api.js';
import { createUIManager } from './ui.js';

/**
 * Creates a generic settings page with CRUD functionality.
 * @param {object} config - The configuration object for the specific settings page.
 */
export function createSettingsPage(config) {
    let allItems = [];
    const { showToast } = createUIManager();

    // --- DOM CACHE ---
    const listContainer = document.getElementById(config.list.containerId);
    const form = document.getElementById(config.form.id);
    const idInput = document.getElementById(config.form.idInput);
    const formTitle = document.getElementById(config.form.titleId);
    const submitBtn = document.getElementById(config.form.submitBtnId);
    const cancelBtn = document.getElementById(config.form.cancelBtnId);
    const searchInput = document.getElementById('search-input');
    const confirmationModal = document.getElementById('confirmation-modal');
    const modalTitle = document.getElementById('modal-title-text');
    const modalBody = document.getElementById('modal-body-text');
    const modalConfirmBtn = document.getElementById('modal-confirm-btn');

    // --- DATA & RENDERING ---
    async function fetchAndRender() {
        try {
            allItems = await fetchWithAuth(config.apiEndpoint);
            renderList();
        } catch (error) {
            console.error(error);
            const colSpan = config.list.columns.length + 1;
            listContainer.innerHTML = `<tr><td colspan="${colSpan}" class="p-4 text-center text-red-500">Error loading ${config.entityNamePlural}.</td></tr>`;
        }
    }

    function renderList() {
        const searchTerm = searchInput.value.toLowerCase();
        const filteredItems = allItems.filter(item =>
            config.list.searchKeys.some(key =>
                item[key]?.toString().toLowerCase().includes(searchTerm)
            )
        );

        listContainer.innerHTML = '';
        if (filteredItems.length === 0) {
            const message = allItems.length === 0 ? `No ${config.entityNamePlural.toLowerCase()} found.` : 'No items match your search.';
            const colSpan = config.list.columns.length + 1;
            listContainer.innerHTML = `<tr><td colspan="${colSpan}" class="p-4 text-center text-base-content/70">${message}</td></tr>`;
            return;
        }

        filteredItems.forEach(item => {
            const tr = document.createElement('tr');
            tr.innerHTML = config.list.renderRow(item);
            listContainer.appendChild(tr);
        });
        lucide.createIcons();
    }

    // --- FORM STATE ---
    function resetForm() {
        form.reset();
        idInput.value = '';
        formTitle.textContent = `Add New ${config.entityName}`;
        submitBtn.textContent = `Add ${config.entityName}`;
        cancelBtn.classList.add('hidden');
    }

    function populateFormForEdit(itemId) {
        const item = allItems.find(i => i._id === itemId);
        if (item) {
            idInput.value = item._id;
            config.form.fields.forEach(field => {
                document.getElementById(field.id).value = item[field.key] || '';
            });
            formTitle.textContent = `Edit ${config.entityName}`;
            submitBtn.textContent = 'Save Changes';
            cancelBtn.classList.remove('hidden');
            window.scrollTo(0, 0);
        }
    }

    // --- EVENT LISTENERS ---
    form.addEventListener('submit', async (e) => {
        e.preventDefault();
        const itemId = idInput.value;
        const body = {};
        let isValid = true;

        config.form.fields.forEach(field => {
            const input = document.getElementById(field.id);
            const value = input.value.trim();
            if (field.required && !value) {
                isValid = false;
            }
            body[field.key] = value;
        });

        if (!isValid) {
            const requiredLabels = config.form.fields.filter(f => f.required).map(f => f.label).join(', ');
            showToast(`${requiredLabels} are required.`, 'error');
            return;
        }

        const method = itemId ? 'PUT' : 'POST';
        const endpoint = itemId ? `${config.apiEndpoint}/${itemId}` : config.apiEndpoint;

        submitBtn.classList.add("loading");
        submitBtn.disabled = true;

        try {
            await fetchWithAuth(endpoint, { method, body: JSON.stringify(body) });
            resetForm();
            showToast(`${config.entityName} ${itemId ? 'updated' : 'added'} successfully.`, 'success');
            fetchAndRender();
        } catch (error) {
            showToast(`Error: ${error.message}`, 'error');
        } finally {
            submitBtn.classList.remove("loading");
            submitBtn.disabled = false;
        }
    });

    listContainer.addEventListener('click', (e) => {
        const editButton = e.target.closest('.edit-btn');
        if (editButton) {
            populateFormForEdit(editButton.dataset.id);
            return;
        }

        const deleteButton = e.target.closest('.delete-btn');
        if (deleteButton) {
            const itemId = deleteButton.dataset.id;
            const item = allItems.find(i => i._id === itemId);
            const displayName = item[config.list.searchKeys[0]];

            showConfirmationModal(
                `Delete ${config.entityName}: ${displayName}`,
                `Are you sure you want to permanently delete this ${config.entityName.toLowerCase()}? This action cannot be undone.`,
                async () => {
                    try {
                        await fetchWithAuth(`${config.apiEndpoint}/${itemId}`, { method: 'DELETE' });
                        showToast(`${config.entityName} deleted successfully.`, 'success');
                        fetchAndRender();
                    } catch (error) {
                        showToast(`Error: ${error.message}`, 'error');
                    }
                }
            );
        }
    });

    function showConfirmationModal(title, body, onConfirm) {
        modalTitle.textContent = title;
        modalBody.textContent = body;
        
        const newConfirmBtn = modalConfirmBtn.cloneNode(true);
        modalConfirmBtn.parentNode.replaceChild(newConfirmBtn, modalConfirmBtn);
        newConfirmBtn.addEventListener('click', () => {
            onConfirm();
            confirmationModal.close();
        }, { once: true });

        confirmationModal.showModal();
        document.getElementById('modal-cancel-btn').onclick = () => confirmationModal.close();
    }

    cancelBtn.addEventListener('click', resetForm);
    searchInput.addEventListener('input', renderList);

    // --- INITIALIZATION ---
    fetchAndRender();
}