// FILE: frontend/public/inventory.js
import { fetchWithAuth } from './api.js';

document.addEventListener('DOMContentLoaded', async () => {
    try {
        const user = await getCurrentUser();
        if (!user) return;

        initializeLayout(user);
        initializeInventoryPage(user);
    } catch (error) {
        console.error("Authentication failed on inventory page:", error);
    }
});

function initializeInventoryPage(currentUser) {
    const API_ENDPOINT = 'stock-items';
    let allStockItems = [];

    // DOM Cache
    const itemList = document.getElementById('stock-item-list');
    const itemForm = document.getElementById('stock-item-form');
    const itemIdInput = document.getElementById('stock-item-id');
    const stockNumberInput = document.getElementById('stock-number');
    const descriptionInput = document.getElementById('description');
    const unitOfMeasureInput = document.getElementById('unit-of-measure');
    const quantityInput = document.getElementById('quantity');
    const reorderPointInput = document.getElementById('reorder-point');
    const categoryInput = document.getElementById('category');
    const formTitle = document.getElementById('stock-item-form-title');
    const submitBtn = document.getElementById('submit-stock-item-btn');
    const cancelBtn = document.getElementById('cancel-edit-btn');

    // --- DATA FETCHING & RENDERING ---
    async function fetchAndRenderItems() {
        try {
            allStockItems = await fetchWithAuth(API_ENDPOINT);
            renderItemList();
        } catch (error) {
            console.error(error);
            itemList.innerHTML = `<tr><td colspan="7" class="p-4 text-center text-red-500">Error loading stock items.</td></tr>`;
        }
    }

    function renderItemList() {
        itemList.innerHTML = '';
        if (allStockItems.length === 0) {
            itemList.innerHTML = `<tr><td colspan="7" class="p-4 text-center text-gray-500">No stock items found. Add one using the form above.</td></tr>`;
            return;
        }
        allStockItems.forEach(item => {
            const tr = document.createElement('tr');
            const quantityClass = item.quantity <= item.reorderPoint ? 'text-red-600 font-bold' : '';
            tr.innerHTML = `
                <td class="font-mono">${item.stockNumber}</td>
                <td>${item.description}</td>
                <td>${item.unitOfMeasure}</td>
                <td class="text-center ${quantityClass}">${item.quantity}</td>
                <td class="text-center">${item.reorderPoint}</td>
                <td>${item.category || 'N/A'}</td>
                <td class="text-center">
                    <div class="flex justify-center items-center gap-1">
                        <button class="edit-item-btn btn btn-ghost btn-xs" data-id="${item._id}" title="Edit Item"><i data-lucide="edit" class="h-4 w-4"></i></button>
                        <button class="delete-item-btn btn btn-ghost btn-xs text-red-500" data-id="${item._id}" title="Delete Item"><i data-lucide="trash-2" class="h-4 w-4"></i></button>
                    </div>
                </td>
            `;
            itemList.appendChild(tr);
        });
        lucide.createIcons();
    }

    // --- FORM STATE & LOGIC ---
    function resetForm() {
        itemForm.reset();
        itemIdInput.value = '';
        formTitle.textContent = 'Add New Stock Item';
        submitBtn.textContent = 'Add Item';
        cancelBtn.classList.add('hidden');
    }

    function populateForm(itemId) {
        const item = allStockItems.find(i => i._id === itemId);
        if (item) {
            itemIdInput.value = item._id;
            stockNumberInput.value = item.stockNumber;
            descriptionInput.value = item.description;
            unitOfMeasureInput.value = item.unitOfMeasure;
            quantityInput.value = item.quantity;
            reorderPointInput.value = item.reorderPoint;
            categoryInput.value = item.category || '';
            
            formTitle.textContent = 'Edit Stock Item';
            submitBtn.textContent = 'Save Changes';
            cancelBtn.classList.remove('hidden');
            window.scrollTo(0, 0);
        }
    }

    // --- EVENT LISTENERS ---
    itemForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        const id = itemIdInput.value;
        const method = id ? 'PUT' : 'POST';
        const endpoint = id ? `${API_ENDPOINT}/${id}` : API_ENDPOINT;

        const body = {
            stockNumber: stockNumberInput.value,
            description: descriptionInput.value,
            unitOfMeasure: unitOfMeasureInput.value,
            quantity: parseInt(quantityInput.value, 10),
            reorderPoint: parseInt(reorderPointInput.value, 10),
            category: categoryInput.value,
        };

        try {
            await fetchWithAuth(endpoint, {
                method,
                body: JSON.stringify(body)
            });
            resetForm();
            await fetchAndRenderItems();
        } catch (error) {
            alert(`Error: ${error.message}`);
        }
    });

    cancelBtn.addEventListener('click', resetForm);

    itemList.addEventListener('click', async (e) => {
        const editBtn = e.target.closest('.edit-item-btn');
        if (editBtn) {
            populateForm(editBtn.dataset.id);
            return;
        }

        const deleteBtn = e.target.closest('.delete-item-btn');
        if (deleteBtn) {
            const id = deleteBtn.dataset.id;
            if (confirm('Are you sure you want to delete this stock item?')) {
                try {
                    await fetchWithAuth(`${API_ENDPOINT}/${id}`, { method: 'DELETE' });
                    await fetchAndRenderItems();
                } catch (error) {
                    alert(`Error: ${error.message}`);
                }
            }
        }
    });

    // --- INITIALIZATION ---
    fetchAndRenderItems();
}
    