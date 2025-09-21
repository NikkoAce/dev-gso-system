import { fetchWithAuth } from '../js/api.js';
import { createAuthenticatedPage } from '../js/page-loader.js';
import { createUIManager } from '../js/ui.js';

createAuthenticatedPage({
    permission: 'stock:manage',
    pageInitializer: initializeLedgerPage,
    pageName: 'Stock Ledger Card'
});

function initializeLedgerPage(user) {
    const { showToast } = createUIManager();
    // DOM Cache
    const loadingState = document.getElementById('loading-state');
    const errorState = document.getElementById('error-state');
    const errorMessage = document.getElementById('error-message');
    const reportOutput = document.getElementById('report-output');
    const itemDetailsContainer = document.getElementById('item-details');
    const ledgerTableBody = document.getElementById('ledger-table-body');
    const printButton = document.getElementById('print-btn');

    const formatDate = (dateString) => dateString ? new Date(dateString).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) : 'N/A';

    async function loadLedger() {
        const urlParams = new URLSearchParams(window.location.search);
        const stockItemId = urlParams.get('id');

        if (!stockItemId) {
            showError('No stock item ID provided.');
            return;
        }

        try {
            const { stockItem, ledger } = await fetchWithAuth(`stock-items/${stockItemId}/ledger`);
            renderItemDetails(stockItem);
            renderLedgerTable(ledger);
            showContent();
        } catch (error) {
            console.error('Failed to load stock ledger:', error);
            showToast(`Error loading ledger: ${error.message}`, 'error');
        }
    }

    function renderItemDetails(item) {
        itemDetailsContainer.innerHTML = `
            <div class="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div><strong>Item:</strong> ${item.description}</div>
                <div><strong>Stock No:</strong> ${item.stockNumber}</div>
                <div><strong>Unit:</strong> ${item.unitOfMeasure}</div>
                <div><strong>Category:</strong> ${item.category || 'N/A'}</div>
                <div><strong>Re-order Point:</strong> ${item.reorderPoint}</div>
                <div class="font-bold text-lg"><strong>Current Quantity:</strong> ${item.quantity}</div>
            </div>
        `;
    }

    function renderLedgerTable(ledger) {
        ledgerTableBody.innerHTML = '';
        if (ledger.length === 0) {
            ledgerTableBody.innerHTML = `<tr><td colspan="7" class="text-center p-4">No transactions found for this item.</td></tr>`;
            return;
        }

        ledger.forEach(entry => {
            const tr = document.createElement('tr');
            const quantityIn = entry.quantityIn > 0 ? entry.quantityIn : '';
            const quantityOut = entry.quantityOut > 0 ? entry.quantityOut : '';
            const typeClass = entry.type === 'Stock-In' ? 'text-success' : 'text-error';

            tr.innerHTML = `
                <td class="text-center">${formatDate(entry.date)}</td>
                <td class="text-center font-semibold ${typeClass}">${entry.type}</td>
                <td class="text-center font-mono">${entry.reference}</td>
                <td>${entry.details}</td>
                <td class="text-center font-bold text-success">${quantityIn}</td>
                <td class="text-center font-bold text-error">${quantityOut}</td>
                <td class="text-center font-bold">${entry.balance}</td>
            `;
            ledgerTableBody.appendChild(tr);
        });
    }

    function showError(message) {
        loadingState.classList.add('hidden');
        errorMessage.textContent = `Error: ${message}`;
        errorState.classList.remove('hidden');
    }

    function showContent() {
        loadingState.classList.add('hidden');
        reportOutput.classList.remove('hidden');
    }

    printButton.addEventListener('click', () => window.print());

    loadLedger();
}