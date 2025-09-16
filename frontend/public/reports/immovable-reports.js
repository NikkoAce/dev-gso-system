import { fetchWithAuth } from '../js/api.js';
import { createAuthenticatedPage } from '../js/page-loader.js';

createAuthenticatedPage({
    permission: 'report:generate',
    pageInitializer: initializeImmovableReportsPage,
    pageName: 'Immovable Asset Reports'
});

function initializeImmovableReportsPage(user) {
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
    // New footer elements
    const reportFooter = document.getElementById('report-footer');
    const signatory1Name = document.getElementById('signatory-1-name');
    const signatory1Title = document.getElementById('signatory-1-title');
    const signatory2Name = document.getElementById('signatory-2-name');
    const signatory2Title = document.getElementById('signatory-2-title');
    const signatory3Name = document.getElementById('signatory-3-name');
    const signatory3Title = document.getElementById('signatory-3-title');

    // --- UTILITY ---
    const formatDate = (dateString) => {
        if (!dateString) return 'N/A';
        // Appending T00:00:00 forces the date to be parsed in the user's local timezone,
        // preventing it from shifting to the previous day in some timezones.
        return new Date(`${dateString}T00:00:00`).toLocaleDateString('en-CA');
    };


    // --- REPORT GENERATION ---
    async function generateReport() {
        const type = typeFilter.value;
        const status = statusFilter.value;
        const startDate = startDateInput.value;
        const endDate = endDateInput.value;

        const params = new URLSearchParams();
        if (type) params.append('type', type);
        if (status) params.append('status', status);
        if (startDate) params.append('startDate', startDate);
        if (endDate) params.append('endDate', endDate);

        const queryString = params.toString();
        const url = `immovable-assets/report${queryString ? `?${queryString}` : ''}`;

        setReportLoading(true, 'Generating Immovable Asset Report...');

        try {
            const reportData = await fetchWithAuth(url);

            renderReportTable(reportData.headers, reportData.rows);
            
            // Update report headers and footers
            const reportName = 'REPORT ON THE PHYSICAL COUNT OF IMMOVABLE PROPERTIES';
            reportTitle.textContent = reportName;
            reportHeaderTitleEl.textContent = reportName;
            reportStartDateEl.textContent = startDate ? formatDate(startDate) : 'Beginning';
            reportEndDateEl.textContent = endDate ? formatDate(endDate) : 'As of Today';
            
            populateSignatories();

            reportHeader.classList.remove('hidden');
            reportFooter.classList.remove('hidden');
            reportOutput.classList.remove('hidden');

        } catch (error) {
            console.error('Error generating report:', error);
            reportTableContainer.innerHTML = `<p class="text-red-500">Error generating report: ${error.message}</p>`;
            reportOutput.classList.remove('hidden');
            reportHeader.classList.add('hidden');
            reportFooter.classList.add('hidden');
        } finally {
            setReportLoading(false);
        }
    }

    // --- UI FUNCTIONS ---
    function setReportLoading(isLoading, message = 'Loading...') {
        if (isLoading) {
            generateReportBtn.disabled = true;
            generateReportBtn.innerHTML = `<i data-lucide="loader-2" class="animate-spin"></i> Generating...`;
            lucide.createIcons();

            reportTitle.textContent = message;
            reportTableContainer.innerHTML = `<div class="flex justify-center items-center p-8"><i data-lucide="loader-2" class="animate-spin h-8 w-8 mx-auto text-gray-500"></i></div>`;
            reportHeader.classList.add('hidden');
            reportFooter.classList.add('hidden');
            reportOutput.classList.remove('hidden');
            lucide.createIcons();
        } else {
            generateReportBtn.disabled = false;
            generateReportBtn.innerHTML = `<i data-lucide="file-text"></i> Generate Report`;
            lucide.createIcons();
            if (reportTableContainer.innerHTML.includes('loader-2')) {
                reportOutput.classList.add('hidden');
            }
        }
    }

    function populateSignatories() {
        // In a real app, this might come from a config or API. For now, using placeholders.
        const signatories = {
            certifier: { name: 'INVENTORY COMMITTEE CHAIR', title: 'Signature over Printed Name' },
            approver: { name: 'HEAD OF AGENCY/ENTITY', title: 'Signature over Printed Name' },
            verifier: { name: 'COA REPRESENTATIVE', title: 'Signature over Printed Name' }
        };
        signatory1Name.textContent = signatories.certifier.name;
        signatory1Title.textContent = signatories.certifier.title;
        signatory2Name.textContent = signatories.approver.name;
        signatory2Title.textContent = signatories.approver.title;
        signatory3Name.textContent = signatories.verifier.name;
        signatory3Title.textContent = signatories.verifier.title;
    }

    function renderReportTable(headers, rows) {
        reportTableContainer.innerHTML = ''; // Clear previous content

        const table = document.createElement('table');
        table.className = 'w-full text-xs border-collapse border border-black';

        const thead = table.createTHead();
        thead.className = 'bg-gray-100';
        const headerRow = thead.insertRow();
        headers.forEach(headerText => {
            const th = document.createElement('th');
            th.className = 'border border-black p-1';
            th.textContent = headerText;
            headerRow.appendChild(th);
        });

        const tbody = table.createTBody();
        if (rows.length === 0) {
            tbody.innerHTML = `<tr><td colspan="${headers.length}" class="text-center p-4">No data found for the selected criteria.</td></tr>`;
        } else {
            rows.forEach(rowData => {
                const row = tbody.insertRow();
                row.className = 'border-b';
                rowData.forEach((cellData, index) => {
                    const cell = row.insertCell();
                    cell.className = 'border border-black p-1 align-top';
                    // The 7th column (index 6) is Assessed Value, which is already formatted by the backend
                    if (index === 6) {
                        cell.classList.add('text-right');
                    }
                    cell.textContent = cellData;
                });
            });
        }
        
        reportTableContainer.appendChild(table);
    }

    // --- EVENT LISTENERS ---
    generateReportBtn.addEventListener('click', generateReport);

    printReportBtn.addEventListener('click', () => {
        window.print();
    });
}