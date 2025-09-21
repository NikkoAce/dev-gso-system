// FILE: frontend/public/inventory.js
import { fetchWithAuth } from '../js/api.js';
import { createAuthenticatedPage } from '../js/page-loader.js';
import { createUIManager } from '../js/ui.js';

createAuthenticatedPage({
    permission: 'stock:manage',
    pageInitializer: initializeInventoryPage,
    pageName: 'Manage Supplies Inventory'
});

function initializeInventoryPage(user) {
    const API_ENDPOINT = 'stock-items';
    let allStockItems = []; // For dropdowns and lookups
    let currentPageItems = []; // For the paginated table view
    let receivedItems = []; // For the new modal

    // NEW: State for pagination and sorting
    let currentPage = 1;
    let totalPages = 1;
    const itemsPerPage = 10;
    let sortKey = 'description';
    let sortDirection = 'asc';
    let searchTimeout;

    // NEW: UI Manager
    const { renderPagination, setLoading, showToast, showConfirmationModal } = createUIManager();

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
    const tableHeader = itemList.parentElement.querySelector('thead');
    const paginationControls = document.getElementById('pagination-controls');
    const searchInput = document.getElementById('search-input');
    // New Modal DOM Cache
    const openReceiveModalBtn = document.getElementById('open-receive-stock-modal-btn');
    const receiveStockModal = document.getElementById('receive-stock-modal');
    const receiveStockForm = document.getElementById('receive-stock-form');
    const cancelReceiveBtn = document.getElementById('cancel-receive-stock-btn');
    const supplierInput = document.getElementById('supplier-input');
    const dateReceivedInput = document.getElementById('date-received-input');
    const itemSelectForReceiving = document.getElementById('stock-item-select-for-receiving');
    const receivedQuantityInput = document.getElementById('received-quantity-input');
    const unitCostInput = document.getElementById('unit-cost-input');
    const addReceivedItemBtn = document.getElementById('add-received-item-btn');
    const receivedItemsList = document.getElementById('received-items-list');

    // --- DATA FETCHING & RENDERING ---
    async function loadItems() {
        const colSpan = tableHeader.querySelector('tr').children.length;
        setLoading(true, itemList, { colSpan });

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
            renderItemList(data.docs);
            renderPagination(paginationControls, data);
            updateSortIndicators();
        } catch (error) {
            console.error(error);
            itemList.innerHTML = `<tr><td colspan="${colSpan}" class="p-4 text-center text-red-500">Error loading stock items.</td></tr>`;
        } finally {
            setLoading(false, itemList);
        }
    }

    function renderItemList(items) {
        itemList.innerHTML = '';
        const colSpan = tableHeader.querySelector('tr').children.length;
        if (items.length === 0) {
            itemList.innerHTML = `<tr><td colspan="${colSpan}" class="p-4 text-center text-gray-500">No stock items found.</td></tr>`;
            return;
        }
        items.forEach(item => {
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
                        <a href="../supplies/stock-ledger-card.html?id=${item._id}" class="btn btn-ghost btn-xs" title="View Ledger Card">
                            <i data-lucide="history" class="h-4 w-4"></i>
                        </a>
                        <button class="edit-item-btn btn btn-ghost btn-xs" data-id="${item._id}" title="Edit Item"><i data-lucide="edit" class="h-4 w-4"></i></button>
                        <button class="delete-item-btn btn btn-ghost btn-xs text-red-500" data-id="${item._id}" title="Delete Item"><i data-lucide="trash-2" class="h-4 w-4"></i></button>
                    </div>
                </td>
            `;
            itemList.appendChild(tr);
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

    // --- FORM STATE & LOGIC ---
    function resetForm() {
        itemForm.reset();
        itemIdInput.value = '';
        formTitle.textContent = 'Add New Stock Item';
        submitBtn.textContent = 'Add Item';
        cancelBtn.classList.add('hidden');
    }

    function populateForm(itemId) {
        const item = currentPageItems.find(i => i._id === itemId);
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

    // --- RECEIVE STOCK MODAL LOGIC ---
    function openReceiveModal() {
        receiveStockForm.reset();
        receivedItems = [];
        renderReceivedItemsTable();
        populateItemSelectForReceiving();
        dateReceivedInput.value = new Date().toISOString().split('T')[0];
        receiveStockModal.showModal();
    }

    function closeReceiveModal() {
        receiveStockModal.close();
    }

    function populateItemSelectForReceiving() {
        itemSelectForReceiving.innerHTML = '<option value="">-- Select an item --</option>';
        // This uses the master list of all items fetched on page load
        allStockItems.forEach(item => {
            const option = document.createElement('option');
            option.value = item._id;
            option.textContent = `${item.description} (${item.stockNumber})`;
            itemSelectForReceiving.appendChild(option);
        });
    }

    function handleAddReceivedItem() {
        const stockItemId = itemSelectForReceiving.value;
        const quantity = parseInt(receivedQuantityInput.value, 10);
        const unitCost = parseFloat(unitCostInput.value);

        if (!stockItemId || !quantity || quantity < 1 || unitCost < 0) {
            showToast('Please select an item and enter a valid quantity and unit cost.', 'warning');
            return;
        }

        const stockItem = allStockItems.find(i => i._id === stockItemId);
        if (receivedItems.some(i => i.stockItem === stockItemId)) {
            showToast('This item is already in the report. You can remove it and add it again.', 'info');
            return;
        }

        receivedItems.push({
            stockItem: stockItem._id,
            description: stockItem.description,
            quantityReceived: quantity,
            unitCost: unitCost
        });

        renderReceivedItemsTable();
        itemSelectForReceiving.value = '';
        receivedQuantityInput.value = '1';
        unitCostInput.value = '0';
    }

    function renderReceivedItemsTable() {
        receivedItemsList.innerHTML = '';
        if (receivedItems.length === 0) {
            receivedItemsList.innerHTML = `<tr><td colspan="5" class="p-4 text-center text-gray-500">No items added yet.</td></tr>`;
            return;
        }
        receivedItems.forEach((item, index) => {
            const tr = document.createElement('tr');
            const totalCost = item.quantityReceived * item.unitCost;
            tr.innerHTML = `
                <td>${item.description}</td>
                <td class="text-center">${item.quantityReceived}</td>
                <td class="text-right">${new Intl.NumberFormat('en-PH', { style: 'currency', currency: 'PHP' }).format(item.unitCost)}</td>
                <td class="text-right font-semibold">${new Intl.NumberFormat('en-PH', { style: 'currency', currency: 'PHP' }).format(totalCost)}</td>
                <td class="text-center">
                    <button type="button" class="remove-received-item-btn btn btn-ghost btn-xs text-red-500" data-index="${index}"><i data-lucide="x"></i></button>
                </td>
            `;
            receivedItemsList.appendChild(tr);
        });
        lucide.createIcons();
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
            await loadItems();
        } catch (error) {
            showToast(`Error: ${error.message}`, 'error');
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
            showConfirmationModal(
                'Delete Stock Item',
                'Are you sure you want to delete this stock item?',
                async () => {
                    try {
                        await fetchWithAuth(`${API_ENDPOINT}/${id}`, { method: 'DELETE' });
                        await loadItems();
                    } catch (error) {
                        showToast(`Error: ${error.message}`, 'error');
                    }
                });
        }
    });

    openReceiveModalBtn.addEventListener('click', openReceiveModal);
    cancelReceiveBtn.addEventListener('click', closeReceiveModal);

    searchInput.addEventListener('input', () => {
        clearTimeout(searchTimeout);
        searchTimeout = setTimeout(() => {
            currentPage = 1;
            loadItems();
        }, 300);
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

    paginationControls.addEventListener('click', (e) => {
        const target = e.target.closest('button');
        if (!target) return;
        if (target.id === 'prev-page-btn' && currentPage > 1) { currentPage--; loadItems(); }
        else if (target.id === 'next-page-btn' && currentPage < totalPages) { currentPage++; loadItems(); }
        else if (target.classList.contains('page-btn')) { const page = parseInt(target.dataset.page, 10); if (page !== currentPage) { currentPage = page; loadItems(); } }
    });

    addReceivedItemBtn.addEventListener('click', handleAddReceivedItem);

    receivedItemsList.addEventListener('click', (e) => {
        const removeBtn = e.target.closest('.remove-received-item-btn');
        if (removeBtn) {
            const index = parseInt(removeBtn.dataset.index, 10);
            receivedItems.splice(index, 1);
            renderReceivedItemsTable();
        }
    });

    receiveStockForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        if (receivedItems.length === 0) {
            showToast('Please add at least one item to the report.', 'warning');
            return;
        }

        const payload = {
            supplier: supplierInput.value,
            dateReceived: dateReceivedInput.value,
            items: receivedItems,
            remarks: '' // Can add a remarks field later if needed
        };

        try {
            await fetchWithAuth('receiving-reports', {
                method: 'POST',
                body: JSON.stringify(payload)
            });
            closeReceiveModal();
            showToast('Stock received and inventory updated successfully!', 'success');
            await loadItems();
        } catch (error) {
            showToast(`Error submitting report: ${error.message}`, 'error');
        }
    });

    // --- INITIALIZATION ---
    async function initialize() {
        try {
            // Fetch all items once for dropdowns and other lookups
            allStockItems = await fetchWithAuth(API_ENDPOINT);
            // Then load the first page for the table
            await loadItems();
        } catch (error) {
            console.error("Initialization failed:", error);
            itemList.innerHTML = `<tr><td colspan="7" class="p-4 text-center text-red-500">Failed to initialize page.</td></tr>`;
        }
    }
    initialize();
}
    