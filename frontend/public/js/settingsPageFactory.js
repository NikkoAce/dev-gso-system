// FILE: frontend/public/js/settingsPageFactory.js
import { fetchWithAuth } from './api.js';
import { createUIManager } from './ui.js';

/**
 * Creates a generic settings page with CRUD functionality.
 * @param {object} config - The configuration object for the specific settings page.
 */
export function createSettingsPage(config) {
    // State
    let currentPageItems = [];
    let currentPage = 1;
    let totalPages = 1;
    const itemsPerPage = 15;
    let sortKey = config.list.defaultSortKey || 'name';
    let sortDirection = config.list.defaultSortDirection || 'asc';

    const { showToast, showConfirmationModal, renderPagination, setLoading } = createUIManager();

    // --- DOM CACHE ---
    const listContainer = document.getElementById(config.list.containerId);
    const tableHeader = listContainer.parentElement.querySelector('thead');
    const paginationControls = document.getElementById('pagination-controls');
    const searchInput = document.getElementById('search-input');
    const form = document.getElementById(config.form.id);
    const idInput = document.getElementById(config.form.idInput);
    const formTitle = document.getElementById(config.form.titleId);
    const submitBtn = document.getElementById(config.form.submitBtnId);
    const cancelBtn = document.getElementById(config.form.cancelBtnId);

    // --- DATA & RENDERING ---
    async function loadItems() {
        const colSpan = tableHeader.querySelector('tr').children.length;
        setLoading(true, listContainer, { colSpan });
        const params = new URLSearchParams({
            page: currentPage,
            limit: itemsPerPage,
            sort: sortKey,
            order: sortDirection,
            search: searchInput.value,
        });

        try {
            const data = await fetchWithAuth(`${config.apiEndpoint}?${params.toString()}`);
            currentPageItems = data.docs;
            totalPages = data.totalPages;
            renderTable(data.docs);
            renderPagination(paginationControls, data);
            updateSortIndicators();
        } catch (error) {
            console.error(`Error fetching ${config.entityNamePlural}:`, error);
            listContainer.innerHTML = `<tr><td colspan="${colSpan}" class="text-center text-error">Could not load ${config.entityNamePlural}.</td></tr>`;
        } finally {
            setLoading(false, listContainer);
        }
    }

    function renderTable(items) {
        listContainer.innerHTML = '';
        const colSpan = tableHeader.querySelector('tr').children.length;
        if (items.length === 0) {
            listContainer.innerHTML = `<tr><td colspan="${colSpan}" class="text-center">No ${config.entityNamePlural} found.</td></tr>`;
            return;
        }
        items.forEach(item => {
            const tr = document.createElement('tr');
            tr.id = `item-row-${item._id}`;
            tr.innerHTML = config.list.renderRow(item);
            listContainer.appendChild(tr);
        });
        lucide.createIcons();
    }

    function updateSortIndicators() {
        tableHeader.querySelectorAll('th[data-sort-key]').forEach(th => {
            th.querySelector('i[data-lucide]')?.remove();
            if (th.dataset.sortKey === sortKey) {
                th.insertAdjacentHTML('beforeend', `<i data-lucide="${sortDirection === 'asc' ? 'arrow-up' : 'arrow-down'}" class="inline-block ml-1 h-4 w-4"></i>`);
            }
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
        const item = currentPageItems.find(i => i._id === itemId);
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
    async function handleSave(e) {
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
            showToast(`${config.entityName} ${itemId ? 'updated' : 'created'} successfully!`, 'success');
            await loadItems();
        } catch (error) {
            showToast(`Error: ${error.message}`, 'error');
        } finally {
            submitBtn.classList.remove("loading");
            submitBtn.disabled = false;
        }
    }

    function handleDelete(item) {
        const displayName = item[config.list.searchKeys[0]];
        showConfirmationModal(
            `Delete ${config.entityName}: ${displayName}`,
            `Are you sure you want to permanently delete this ${config.entityName.toLowerCase()}? This action cannot be undone.`,
            async () => {
                try {
                    await fetchWithAuth(`${config.apiEndpoint}/${item._id}`, { method: 'DELETE' });
                    showToast(`${config.entityName} deleted successfully.`, 'success');
                    resetForm();
                    await loadItems();
                } catch (error) {
                    showToast(`Error: ${error.message}`, 'error');
                }
            }
        );
    }

    function setupEventListeners() {
        form.addEventListener('submit', handleSave);
        cancelBtn.addEventListener('click', resetForm);
        searchInput.addEventListener('input', () => { currentPage = 1; loadItems(); });

        paginationControls.addEventListener('click', (e) => {
            const target = e.target.closest('button');
            if (!target) return;

            if (target.id === 'prev-page-btn' && currentPage > 1) { currentPage--; loadItems(); }
            else if (target.id === 'next-page-btn' && currentPage < totalPages) { currentPage++; loadItems(); }
            else if (target.classList.contains('page-btn')) {
                const page = parseInt(target.dataset.page, 10);
                if (page !== currentPage) { currentPage = page; loadItems(); }
            }
        });

        tableHeader.addEventListener('click', (e) => {
            const th = e.target.closest('th[data-sort-key]');
            if (th) {
                const key = th.dataset.sortKey;
                sortDirection = (sortKey === key && sortDirection === 'asc') ? 'desc' : 'asc';
                sortKey = key;
                loadItems();
            }
        });

        listContainer.addEventListener('click', e => {
            const editBtn = e.target.closest('.edit-btn');
            if (editBtn) {
                const item = currentPageItems.find(i => i._id === editBtn.dataset.id);
                if (item) populateFormForEdit(item);
            }
            const deleteBtn = e.target.closest('.delete-btn');
            if (deleteBtn) {
                const item = currentPageItems.find(i => i._id === deleteBtn.dataset.id);
                if (item) handleDelete(item);
            }
        });
    }

    // --- INITIALIZATION ---
    loadItems();
    setupEventListeners();
}