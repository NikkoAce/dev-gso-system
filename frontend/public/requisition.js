// FILE: frontend/public/requisition.js
import { fetchWithAuth } from './api.js';

document.addEventListener('DOMContentLoaded', async () => {
    try {
        const user = await getCurrentUser();
        if (!user) return;

        initializeLayout(user);
        initializeRequisitionPage(user);
    } catch (error) {
        console.error("Authentication failed on requisition page:", error);
    }
});

function initializeRequisitionPage(currentUser) {
    const STOCK_API_ENDPOINT = 'stock-items';
    const REQ_API_ENDPOINT = 'requisitions';
    let allStockItems = [];
    let requestedItems = [];

    // DOM Cache
    const form = document.getElementById('requisition-form');
    const requestingOfficeInput = document.getElementById('requesting-office');
    const purposeInput = document.getElementById('purpose');
    const stockItemSelect = document.getElementById('stock-item-select');
    const itemQuantityInput = document.getElementById('item-quantity');
    const addItemBtn = document.getElementById('add-item-btn');
    const requestedItemsList = document.getElementById('requested-items-list');
    const submitBtn = document.getElementById('submit-requisition-btn');

    // --- DATA FETCHING & INITIALIZATION ---
    async function initializePage() {
        requestingOfficeInput.value = currentUser.office;
        try {
            allStockItems = await fetchWithAuth(STOCK_API_ENDPOINT);
            populateStockItemSelect();
        } catch (error) {
            console.error(error);
            stockItemSelect.innerHTML = `<option value="">Error loading items</option>`;
        }
    }

    function populateStockItemSelect() {
        stockItemSelect.innerHTML = '<option value="">-- Select an item --</option>';
        allStockItems.forEach(item => {
            const option = document.createElement('option');
            option.value = item._id;
            option.textContent = `${item.description} (Stock: ${item.quantity})`;
            option.disabled = item.quantity === 0;
            stockItemSelect.appendChild(option);
        });
    }

    // --- UI RENDERING ---
    function renderRequestedItems() {
        requestedItemsList.innerHTML = '';
        if (requestedItems.length === 0) {
            requestedItemsList.innerHTML = `<tr><td colspan="5" class="p-4 text-center text-gray-500">No items added yet.</td></tr>`;
            return;
        }

        requestedItems.forEach((item, index) => {
            const tr = document.createElement('tr');
            tr.innerHTML = `
                <td class="font-mono">${item.stockNumber}</td>
                <td>${item.description}</td>
                <td>${item.unitOfMeasure}</td>
                <td class="text-center">${item.quantityRequested}</td>
                <td class="text-center">
                    <button type="button" class="remove-item-btn btn btn-ghost btn-xs text-red-500" data-index="${index}" title="Remove Item">
                        <i data-lucide="trash-2" class="h-4 w-4"></i>
                    </button>
                </td>
            `;
            requestedItemsList.appendChild(tr);
        });
        lucide.createIcons();
    }

    // --- EVENT HANDLERS ---
    function handleAddItem() {
        const selectedId = stockItemSelect.value;
        const quantity = parseInt(itemQuantityInput.value, 10);

        if (!selectedId || !quantity || quantity < 1) {
            alert('Please select an item and enter a valid quantity.');
            return;
        }

        const stockItem = allStockItems.find(item => item._id === selectedId);
        if (!stockItem) {
            alert('Selected item not found.');
            return;
        }

        if (quantity > stockItem.quantity) {
            alert(`Cannot request more than the available stock (${stockItem.quantity}).`);
            return;
        }

        const existingItem = requestedItems.find(item => item.stockItem === selectedId);
        if (existingItem) {
            alert('This item is already in your request list. You can remove it and add it again with a new quantity.');
            return;
        }

        requestedItems.push({
            stockItem: stockItem._id,
            stockNumber: stockItem.stockNumber,
            description: stockItem.description,
            unitOfMeasure: stockItem.unitOfMeasure,
            quantityRequested: quantity,
        });

        renderRequestedItems();
        stockItemSelect.value = '';
        itemQuantityInput.value = '1';
    }

    function handleRemoveItem(e) {
        const removeBtn = e.target.closest('.remove-item-btn');
        if (removeBtn) {
            const index = parseInt(removeBtn.dataset.index, 10);
            requestedItems.splice(index, 1);
            renderRequestedItems();
        }
    }

    async function handleSubmit(e) {
        e.preventDefault();
        const purpose = purposeInput.value.trim();

        if (!purpose) {
            return alert('Please enter a purpose for the requisition.');
        }

        if (requestedItems.length === 0) {
            return alert('Please add at least one item to the request.');
        }

        submitBtn.disabled = true;
        submitBtn.textContent = 'Submitting...';

        const payload = {
            purpose,
            requestingOffice: currentUser.office,
            requestingUser: { name: currentUser.name, office: currentUser.office },
            items: requestedItems.map(({ stockItem, description, quantityRequested }) => ({ stockItem, description, quantityRequested }))
        };

        try {
            await fetchWithAuth(REQ_API_ENDPOINT, {
                method: 'POST',
                body: JSON.stringify(payload)
            });

            alert('Requisition submitted successfully!');
            form.reset();
            requestedItems = [];
            renderRequestedItems();
            requestingOfficeInput.value = currentUser.office;
        } catch (error) {
            alert(`Error: ${error.message}`);
        } finally {
            submitBtn.disabled = false;
            submitBtn.textContent = 'Submit Requisition';
        }
    }

    // --- EVENT BINDING ---
    addItemBtn.addEventListener('click', handleAddItem);
    requestedItemsList.addEventListener('click', handleRemoveItem);
    form.addEventListener('submit', handleSubmit);

    // --- INITIALIZATION ---
    initializePage();
}