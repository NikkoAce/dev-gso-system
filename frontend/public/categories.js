// FILE: frontend/public/categories.js
import { fetchWithAuth } from './api.js';
import { createUIManager } from './js/ui.js';

document.addEventListener('DOMContentLoaded', async () => {
    try {
        const user = await getCurrentUser();
        if (!user) return;

        initializeLayout(user);
        initializeCategoriesPage(user);
    } catch (error) {
        console.error("Authentication failed on categories page:", error);
    }
});

function initializeCategoriesPage(currentUser) {
    const API_ENDPOINT = 'categories';
    let allCategories = [];

    const categoryList = document.getElementById('category-list');
    const addCategoryForm = document.getElementById('add-category-form');
    const categoryIdInput = document.getElementById('category-id');
    const newCategoryNameInput = document.getElementById('new-category-name');
    const newAccountGroupInput = document.getElementById('new-account-group');
    const newMajorAccountGroupInput = document.getElementById('new-major-account-group');
    const newSubMajorGroupInput = document.getElementById('new-sub-major-group');
    const newGlAccountInput = document.getElementById('new-gl-account');
    const formTitle = document.getElementById('category-form-title');
    const submitBtn = document.getElementById('submit-category-btn');
    const cancelBtn = document.getElementById('cancel-edit-btn');
    const searchInput = document.getElementById('search-input');
    const { showToast } = createUIManager();

    // Modal DOM elements
    const confirmationModal = document.getElementById('confirmation-modal');
    const modalTitle = document.getElementById('modal-title-text');
    const modalBody = document.getElementById('modal-body-text');
    const modalConfirmBtn = document.getElementById('modal-confirm-btn');

    // --- DATA FETCHING & RENDERING ---
    async function fetchAndRenderCategories() {
        try {
            allCategories = await fetchWithAuth(API_ENDPOINT);
            renderCategoryList();
        } catch (error) {
            console.error(error);
            categoryList.innerHTML = `<tr><td colspan="6" class="p-4 text-center text-red-500">Error loading categories.</td></tr>`;
        }
    }

    function renderCategoryList() {
        const searchTerm = searchInput.value.toLowerCase();
        const filteredCategories = allCategories.filter(category => 
            category.name.toLowerCase().includes(searchTerm)
        );

        categoryList.innerHTML = '';
        if (filteredCategories.length === 0) {
            const message = allCategories.length === 0 ? 'No categories found.' : 'No categories match your search.';
            categoryList.innerHTML = `<tr><td colspan="6" class="p-4 text-center text-base-content/70">${message}</td></tr>`;
            return;
        }

        filteredCategories.forEach(category => {
            const tr = document.createElement('tr');
            const isDeletable = category.assetCount === 0;
            const deleteButtonHTML = isDeletable
                ? `<button class="delete-category-btn btn btn-ghost btn-xs text-red-500" data-id="${category._id}" title="Delete Category"><i data-lucide="trash-2" class="h-4 w-4"></i></button>`
                : `<div class="tooltip" data-tip="Cannot delete: Category is in use by ${category.assetCount} asset(s).">
                       <button class="btn btn-ghost btn-xs" disabled><i data-lucide="trash-2" class="h-4 w-4"></i></button>
                   </div>`;
            tr.innerHTML = `
                <td>${category.name}</td>
                <td>${category.accountGroup || 'N/A'}</td>
                <td>${category.majorAccountGroup || 'N/A'}</td>
                <td>${category.subMajorGroup}</td>
                <td>${category.glAccount}</td>
                <td class="text-center">
                    <div class="flex justify-center items-center gap-1">
                        <button class="edit-category-btn btn btn-ghost btn-xs" data-id="${category._id}" title="Edit Category"><i data-lucide="edit" class="h-4 w-4"></i></button>
                        ${deleteButtonHTML}
                    </div>
                </td>
            `;
            categoryList.appendChild(tr);
        });
        lucide.createIcons();
    }

    // --- FORM STATE ---
    function resetForm() {
        addCategoryForm.reset();
        categoryIdInput.value = '';
        formTitle.textContent = 'Add New Category';
        submitBtn.textContent = 'Add Category';
        cancelBtn.classList.add('hidden');
    }

    function populateFormForEdit(category) {
        categoryIdInput.value = category._id;
        newCategoryNameInput.value = category.name;
        newAccountGroupInput.value = category.accountGroup || '';
        newMajorAccountGroupInput.value = category.majorAccountGroup || '';
        newSubMajorGroupInput.value = category.subMajorGroup;
        newGlAccountInput.value = category.glAccount;
        formTitle.textContent = 'Edit Category';
        submitBtn.textContent = 'Save Changes';
        cancelBtn.classList.remove('hidden');
        window.scrollTo(0, 0);
    }

    // --- EVENT LISTENERS ---
    addCategoryForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        const name = newCategoryNameInput.value.trim();
        const subMajorGroup = newSubMajorGroupInput.value.trim();
        const glAccount = newGlAccountInput.value.trim();
        const accountGroup = newAccountGroupInput.value.trim();
        const majorAccountGroup = newMajorAccountGroupInput.value.trim();
        const categoryId = categoryIdInput.value;
        
        if (!name || !subMajorGroup || !glAccount) {
            showToast('Category Name, Sub-Major Group, and GL Account are required.', 'error');
            return;
        }

        const method = categoryId ? 'PUT' : 'POST';
        const endpoint = categoryId ? `${API_ENDPOINT}/${categoryId}` : API_ENDPOINT;
        const body = { name, subMajorGroup, glAccount, accountGroup, majorAccountGroup };

        submitBtn.classList.add("loading");
        submitBtn.disabled = true;

        try {
            await fetchWithAuth(endpoint, {
                method: method,
                body: JSON.stringify(body)
            });
            resetForm();
            showToast(`Category ${categoryId ? 'updated' : 'added'} successfully.`, 'success');
            fetchAndRenderCategories(); // Refresh list
        } catch (error) {
            showToast(`Error: ${error.message}`, 'error');
        } finally {
            submitBtn.classList.remove("loading");
            submitBtn.disabled = false;
        }
    });

    categoryList.addEventListener('click', async (e) => {
        const editButton = e.target.closest('.edit-category-btn');
        if (editButton) {
            const categoryId = editButton.dataset.id;
            const category = allCategories.find(cat => cat._id === categoryId);
            if (category) {
                populateFormForEdit(category);
            }
            return;
        }

        const deleteButton = e.target.closest('.delete-category-btn');
        if (deleteButton) {
            const categoryId = deleteButton.dataset.id;
            const category = allCategories.find(cat => cat._id === categoryId);
            showConfirmationModal(
                `Delete Category: ${category.name}`,
                `Are you sure you want to permanently delete this category? This action cannot be undone.`,
                async () => {
                    deleteButton.disabled = true;
                    try {
                        await fetchWithAuth(`${API_ENDPOINT}/${categoryId}`, { method: 'DELETE' });
                        showToast('Category deleted successfully.', 'success');
                        fetchAndRenderCategories(); // Refresh list
                    } catch (error) {
                        showToast(`Error: ${error.message}`, 'error');
                    } finally {
                        // The button will be gone on re-render, so no need to re-enable.
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
    searchInput.addEventListener('input', renderCategoryList);

    // --- INITIALIZATION ---
    fetchAndRenderCategories();
}
