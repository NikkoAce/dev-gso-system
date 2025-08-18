// FILE: frontend/public/categories.js
import { fetchWithAuth } from './api.js';

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
    const newCategoryNameInput = document.getElementById('new-category-name');
    const newAccountGroupInput = document.getElementById('new-account-group');
    const newMajorAccountGroupInput = document.getElementById('new-major-account-group');
    const newSubMajorGroupInput = document.getElementById('new-sub-major-group');
    const newGlAccountInput = document.getElementById('new-gl-account');

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
        categoryList.innerHTML = '';
        if (allCategories.length === 0) {
            categoryList.innerHTML = `<tr><td colspan="6" class="p-4 text-center text-gray-500">No categories found.</td></tr>`;
            return;
        }
        allCategories.forEach(category => {
            const tr = document.createElement('tr');
            tr.innerHTML = `
                <td class="p-4">${category.name}</td>
                <td class="p-4">${category.accountGroup || 'N/A'}</td>
                <td class="p-4">${category.majorAccountGroup || 'N/A'}</td>
                <td class="p-4">${category.subMajorGroup}</td>
                <td class="p-4">${category.glAccount}</td>
                <td class="p-4 text-center">
                    <button class="delete-category-btn text-red-500 hover:text-red-700" data-id="${category._id}" title="Delete Category">
                        <i data-lucide="trash-2" class="h-5 w-5"></i>
                    </button>
                </td>
            `;
            categoryList.appendChild(tr);
        });
        lucide.createIcons();
    }

    // --- EVENT LISTENERS ---
    addCategoryForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        const name = newCategoryNameInput.value.trim();
        const subMajorGroup = newSubMajorGroupInput.value.trim();
        const glAccount = newGlAccountInput.value.trim();
        const accountGroup = newAccountGroupInput.value.trim();
        const majorAccountGroup = newMajorAccountGroupInput.value.trim();
        
        if (!name || !subMajorGroup || !glAccount) {
            alert('Category Name, Sub-Major Group, and GL Account are required.');
            return;
        }

        try {
            await fetchWithAuth(API_ENDPOINT, {
                method: 'POST',
                body: JSON.stringify({ name, subMajorGroup, glAccount, accountGroup, majorAccountGroup })
            });
            addCategoryForm.reset();
            fetchAndRenderCategories(); // Refresh list
        } catch (error) {
            alert(`Error: ${error.message}`);
        }
    });

    categoryList.addEventListener('click', async (e) => {
        const deleteButton = e.target.closest('.delete-category-btn');
        if (deleteButton) {
            const categoryId = deleteButton.dataset.id;
            if (confirm('Are you sure you want to delete this category?')) {
                try {
                    await fetchWithAuth(`${API_ENDPOINT}/${categoryId}`, { method: 'DELETE' });
                    fetchAndRenderCategories(); // Refresh list
                } catch (error) {
                    alert(`Error: ${error.message}`);
                }
            }
        }
    });

    // --- INITIALIZATION ---
    fetchAndRenderCategories();
}
