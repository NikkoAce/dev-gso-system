import { getCurrentUser, gsoLogout } from '../js/auth.js';
import { fetchWithAuth } from '../js/api.js';

document.addEventListener('DOMContentLoaded', async () => {
    try {
        const user = await getCurrentUser();
        if (!user) return;

        initializeLayout(user, gsoLogout);
        initializeImmovableReportsPage();
    } catch (error) {
        console.error("Authentication failed on reports page:", error);
    }
});

function initializeImmovableReportsPage() {
    // --- DOM ELEMENTS ---
    const typeFilter = document.getElementById('type-filter');
    const statusFilter = document.getElementById('status-filter');
    const startDateInput = document.getElementById('start-date');
    const endDateInput = document.getElementById('end-date');
    const generateReportBtn = document.getElementById('generate-report-btn');
    const reportOutput = document.getElementById('report-output');
    const reportTitle = document.getElementById('report-title');
    const reportTableContainer = document.getElementById('report-table-container');
    const reportHeader = document.getElementById('report-header');
    const reportHeaderTitleEl = document.getElementById('report-header-title');
    const reportStartDateEl = document.getElementById('report-start-date');
    const reportEndDateEl = document.getElementById('report-end-date');
    const printReportBtn = document.getElementById('print-report-btn');

    // --- REPORT GENERATION ---
    async function generateReport() {
        const type = typeFilter.value;
        const status = statusFilter.value;
        const startDate = startDateInput.value;
        const endDate = endDateInput.value;

        // Use URLSearchParams for robust query string construction.
        // This prevents issues like extra '&' at the end.
        const params = new URLSearchParams();
        if (type) params.append('type', type);
        if (status) params.append('status', status);
        if (startDate) params.append('startDate', startDate);
        if (endDate) params.append('endDate', endDate);

        const queryString = params.toString();
        // The endpoint should not start with a slash, as fetchWithAuth adds it.
        const url = `immovable-assets/report${queryString ? `?${queryString}` : ''}`;

        try {
            const reportData = await fetchWithAuth(url);

            if (reportData.rows.length === 0) {
                reportTableContainer.innerHTML = '<p>No data found for the selected criteria.</p>';
                reportOutput.classList.remove('hidden');
                reportHeader.classList.add('hidden');
                return;
            }

            // Clear previous content
            reportTableContainer.innerHTML = '';

            const table = document.createElement('table');
            table.className = 'table-auto w-full';

            // Create table header
            const thead = document.createElement('thead');
            const headerRow = document.createElement('tr');
            reportData.headers.forEach(headerText => {
                const th = document.createElement('th');
                th.textContent = headerText;
                headerRow.appendChild(th);
            });
            thead.appendChild(headerRow);
            table.appendChild(thead);

            // Create table body
            const tbody = document.createElement('tbody');
            reportData.rows.forEach(rowData => {
                const row = document.createElement('tr');
                rowData.forEach(cellData => {
                    const td = document.createElement('td');
                    td.textContent = cellData;
                    row.appendChild(td);
                });
                tbody.appendChild(row);
            });
            table.appendChild(tbody);

            reportTableContainer.appendChild(table);

            reportTitle.textContent = 'Immovable Asset Report';
            reportHeaderTitleEl.textContent = 'Immovable Asset Report';
            reportStartDateEl.textContent = startDate || 'N/A';
            reportEndDateEl.textContent = endDate || 'N/A';

            reportOutput.classList.remove('hidden');
            reportHeader.classList.remove('hidden');

        } catch (error) {
            console.error('Error generating report:', error);
            reportTableContainer.innerHTML = `<p class="text-red-500">Error generating report: ${error.message}</p>`;
            reportOutput.classList.remove('hidden');
            reportHeader.classList.add('hidden');
        }
    }

    // --- EVENT LISTENERS ---
    generateReportBtn.addEventListener('click', generateReport);

    printReportBtn.addEventListener('click', () => {
        window.print();
    });
}