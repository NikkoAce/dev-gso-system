// FILE: frontend/public/offices.js
import { fetchWithAuth } from '../js/api.js';
import { createUIManager } from '../js/ui.js';
import { createAuthenticatedPage } from '../js/page-loader.js';

const API_ENDPOINT = 'offices';
const ENTITY_NAME = 'Office';

let currentPageItems = [];
let currentPage = 1;
let totalPages = 1;
const itemsPerPage = 15;
let sortKey = 'name';
let sortDirection = 'asc';

const { showToast, showConfirmationModal, renderPagination, setLoading } = createUIManager();

// --- DOM CACHE ---
const form = document.getElementById('add-office-form');
const formTitle = document.getElementById('office-form-title');
const itemIdInput = document.getElementById('office-id');
const submitBtn = document.getElementById('submit-office-btn');
const cancelBtn = document.getElementById('cancel-edit-btn');
const listContainer = document.getElementById('office-list');
const searchInput = document.getElementById('search-input');
const paginationControls = document.getElementById('pagination-controls');
const tableHeader = listContainer.parentElement.querySelector('thead');

createAuthenticatedPage({
    permission: 'settings:manage',
    pageInitializer: async (user) => {
        await loadItems();
        setupEventListeners();
    },
    pageName: 'Manage Offices'
});

async function loadItems() {
    setLoading(true, listContainer, { colSpan: 3 });
    const params = new URLSearchParams({
        page: currentPage,
        limit: itemsPerPage,
        sort: sortKey,
        order: sortDirection,
        search: searchInput.value,
    });

    try {
        const data = await fetchWithAuth(`${API_ENDPOINT}?${params.toString()}`);
        currentPageItems = data.docs;
        totalPages = data.totalPages;
        renderTable(data.docs);
        renderPagination(paginationControls, data);
        updateSortIndicators();
    } catch (error) {
        console.error(`Error fetching ${ENTITY_NAME}s:`, error);
        listContainer.innerHTML = `<tr><td colspan="3" class="text-center text-error">Could not load ${ENTITY_NAME}s.</td></tr>`;
    } finally {
        setLoading(false, listContainer);
    }
}

function renderTable(items) {
    listContainer.innerHTML = '';
    if (items.length === 0) {
        listContainer.innerHTML = `<tr><td colspan="3" class="text-center">No ${ENTITY_NAME}s found.</td></tr>`;
        return;
    }
    items.forEach(item => {
        const isDeletable = item.assetCount === 0;
        const deleteButtonHTML = isDeletable
            ? `<button class="delete-btn btn btn-ghost btn-xs text-red-500" data-id="${item._id}" title="Delete ${ENTITY_NAME}"><i data-lucide="trash-2" class="h-4 w-4"></i></button>`
            : `<div class="tooltip" data-tip="Cannot delete: ${ENTITY_NAME} is in use by ${item.assetCount} asset(s).">
                   <button class="btn btn-ghost btn-xs" disabled><i data-lucide="trash-2" class="h-4 w-4"></i></button>
               </div>`;
        const row = `
            <tr id="item-row-${item._id}">
                <td data-label="Office Name">${item.name}</td>
                <td data-label="Code">${item.code}</td>
                <td data-label="Actions" class="text-center">
                    <div class="flex justify-center items-center gap-1">
                        <button class="edit-btn btn btn-ghost btn-xs" data-id="${item._id}" title="Edit ${ENTITY_NAME}"><i data-lucide="edit" class="h-4 w-4"></i></button>
                        ${deleteButtonHTML}
                    </div>
                </td>
            </tr>
        `;
        listContainer.insertAdjacentHTML('beforeend', row);
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
        if (editBtn) populateFormForEdit(currentPageItems.find(item => item._id === editBtn.dataset.id));
        const deleteBtn = e.target.closest('.delete-btn');
        if (deleteBtn) handleDelete(currentPageItems.find(item => item._id === deleteBtn.dataset.id));
    });
}

function resetForm() {
    form.reset();
    itemIdInput.value = '';
    formTitle.textContent = `Add New ${ENTITY_NAME}`;
    submitBtn.textContent = `Add ${ENTITY_NAME}`;
    cancelBtn.classList.add('hidden');
}

function populateFormForEdit(item) {
    itemIdInput.value = item._id;
    formTitle.textContent = `Edit ${ENTITY_NAME}: ${item.name}`;
    submitBtn.textContent = 'Save Changes';
    cancelBtn.classList.remove('hidden');
    document.getElementById('new-office-name').value = item.name;
    document.getElementById('new-office-code').value = item.code;
    window.scrollTo({ top: 0, behavior: 'smooth' });
}

async function handleSave(e) {
    e.preventDefault();
    const itemId = itemIdInput.value;
    const body = {
        name: document.getElementById('new-office-name').value.trim(),
        code: document.getElementById('new-office-code').value.trim(),
    };

    if (!body.name || !body.code) {
        showToast('Office Name and Code are required.', 'error');
        return;
    }

    const method = itemId ? 'PUT' : 'POST';
    const endpoint = itemId ? `${API_ENDPOINT}/${itemId}` : API_ENDPOINT;

    submitBtn.classList.add('loading');
    submitBtn.disabled = true;

    try {
        await fetchWithAuth(endpoint, { method, body: JSON.stringify(body) });
        showToast(`${ENTITY_NAME} ${itemId ? 'updated' : 'created'} successfully!`, 'success');
        resetForm();
        await loadItems();
    } catch (error) {
        showToast(`Error: ${error.message}`, 'error');
    } finally {
        submitBtn.classList.remove('loading');
        submitBtn.disabled = false;
    }
}

function handleDelete(item) {
    showConfirmationModal(
        `Delete ${ENTITY_NAME}: ${item.name}`,
        `Are you sure you want to delete this ${ENTITY_NAME}? This cannot be undone.`,
        async () => {
            try {
                await fetchWithAuth(`${API_ENDPOINT}/${item._id}`, { method: 'DELETE' });
                showToast(`${ENTITY_NAME} deleted successfully.`, 'success');
                resetForm();
                await loadItems();
            } catch (error) {
                showToast(`Error: ${error.message}`, 'error');
            }
        }
    );
}
