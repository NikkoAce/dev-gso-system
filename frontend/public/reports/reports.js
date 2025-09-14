// FILE: frontend/public/reports.js
import { getCurrentUser, gsoLogout } from '../js/auth.js';
import { fetchWithAuth } from '../js/api.js';
import { createUIManager } from '../js/ui.js';

document.addEventListener('DOMContentLoaded', async () => {
    try {
        const user = await getCurrentUser();
        if (!user) return;

        if (!user.permissions || !user.permissions.includes('report:generate')) {
            window.location.href = '../dashboard/dashboard.html';
            return;
        }
        initializeLayout(user, gsoLogout);
        initializeReportsPage(user);
    } catch (error) {
        console.error("Authentication failed on reports page:", error);
    }
});

function initializeReportsPage(user) {
    const { populateFilters, showToast } = createUIManager();

    // --- DOM ELEMENTS ---
    const fundSourceFilter = document.getElementById('fund-source-filter');
    const categoryFilter = document.getElementById('category-filter');
    const generateRpcppeBtn = document.getElementById('generate-rpcppe');
    const generateDepreciationBtn = document.getElementById('generate-depreciation');
    const asAtDateInput = document.getElementById('as-at-date');
    const printReportBtn = document.getElementById('print-report-btn');
    const reportOutput = document.getElementById('report-output');
    const reportTitle = document.getElementById('report-title');
    const reportTableContainer = document.getElementById('report-table-container');
    const reportHeader = document.getElementById('report-header');
    const reportFooter = document.getElementById('report-footer');
    const reportHeaderTitleEl = document.getElementById('report-header-title');
    const reportFundSourceEl = document.getElementById('report-fund-source');
    const reportAsAtDateEl = document.getElementById('report-as-at-date');
    const signatory1Name = document.getElementById('signatory-1-name');
    const signatory1Title = document.getElementById('signatory-1-title');
    const signatory2Name = document.getElementById('signatory-2-name');
    const signatory2Title = document.getElementById('signatory-2-title');
    const signatory3Name = document.getElementById('signatory-3-name');
    const signatory3Title = document.getElementById('signatory-3-title');

    // --- UTILITY FUNCTIONS ---
    const formatCurrency = (value) => new Intl.NumberFormat('en-PH', { style: 'currency', currency: 'PHP' }).format(value || 0);
    const formatDate = (dateString) => dateString ? new Date(dateString).toLocaleDateString('en-CA') : 'N/A';

    // --- DATA FETCHING ---
    async function initializePage() {
        try {
            const [categories] = await Promise.all([
                fetchWithAuth('categories')
            ]);
            
            populateFilters({ categories }, { categoryFilter });
            asAtDateInput.value = new Date().toISOString().split('T')[0]; // Set default date to today
        } catch (error) {
            console.error('Failed to initialize page:', error);
            showToast('Could not load data for reports.', 'error');
        }
    }

    function setReportLoading(isLoading, message = 'Loading...') {
        if (isLoading) {
            reportTitle.textContent = message;
            reportTableContainer.innerHTML = `<div class="flex justify-center items-center p-8"><i data-lucide="loader-2" class="animate-spin h-8 w-8 mx-auto text-gray-500"></i></div>`;
            reportHeader.classList.add('hidden');
            reportFooter.classList.add('hidden');
            reportOutput.classList.remove('hidden');
            lucide.createIcons();
        } else {
            if (reportTableContainer.innerHTML.includes('loader-2')) {
                reportOutput.classList.add('hidden');
            }
        }
    }

    function populateSignatories() {
        // In a real app, this might come from a config or API
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

    // --- REPORT GENERATION ---
    function generateReportTable(title, headers, rows, fundSource, reportHeaderTitle, asAtDate, columnFormatters = {}) {
        reportTitle.textContent = title;
        reportHeaderTitleEl.textContent = reportHeaderTitle;
        reportFundSourceEl.textContent = fundSource.toUpperCase();
        reportAsAtDateEl.textContent = formatDate(asAtDate);
        
        // Clear previous content
        reportTableContainer.innerHTML = '';

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
        rows.forEach(rowData => {
            const row = tbody.insertRow();
            row.className = 'border-b';
            rowData.forEach((cellData, index) => {
                const cell = row.insertCell();
                cell.className = 'border border-black p-1 align-top';
                // Apply formatter if it exists for the current column index
                if (columnFormatters[index]) {
                    cell.textContent = columnFormatters[index](cellData);
                } else {
                    cell.textContent = cellData;
                }
            });
        });
        
        reportTableContainer.appendChild(table);
        populateSignatories();
        reportHeader.classList.remove('hidden');
        reportFooter.classList.remove('hidden');
        reportOutput.classList.remove('hidden');
    }

    async function handleGenerateReport(config) {
        const {
            button,
            endpoint,
            loadingMessage,
            reportTitle,
            reportHeaderTitle,
            fundSourceRequired = true,
            columnFormatters
        } = config;

        const selectedFundSource = fundSourceFilter.value;
        const selectedCategory = categoryFilter.value;
        const asAtDate = asAtDateInput.value;

        if ((fundSourceRequired && !selectedFundSource) || !asAtDate) {
            showToast(`Please select a Fund Source and an "As at Date" for the report.`, 'warning');
            return;
        }

        setReportLoading(true, loadingMessage);
        button.disabled = true;

        try {
            const params = new URLSearchParams({
                fundSource: selectedFundSource,
                category: selectedCategory,
                asAtDate: asAtDate
            });

            const reportData = await fetchWithAuth(`reports/${endpoint}?${params}`);
            if (reportData.rows.length === 0) {
                showToast('No assets found for the selected criteria.', 'info');
                setReportLoading(false);
                return;
            }

            generateReportTable(
                reportTitle,
                reportData.headers,
                reportData.rows,
                selectedFundSource,
                reportHeaderTitle,
                asAtDate,
                columnFormatters
            );
        } catch (error) {
            console.error(`Error generating ${reportTitle}:`, error);
            showToast(`Error: ${error.message}`, 'error');
            setReportLoading(false);
        } finally {
            button.disabled = false;
        }
    }

    // --- EVENT LISTENERS ---

    generateRpcppeBtn.addEventListener('click', () => handleGenerateReport({
        button: generateRpcppeBtn,
        endpoint: 'rpcppe',
        loadingMessage: 'Generating RPCPPE Report...',
        reportTitle: 'RPCPPE Report',
        reportHeaderTitle: 'REPORT ON THE PHYSICAL COUNT OF PROPERTY, PLANT AND EQUIPMENT',
        columnFormatters: {
            3: (data) => formatCurrency(data) // Unit Cost
        }
    }));

    generateDepreciationBtn.addEventListener('click', () => handleGenerateReport({
        button: generateDepreciationBtn,
        endpoint: 'depreciation',
        loadingMessage: 'Generating Depreciation Report...',
        reportTitle: 'Depreciation Report',
        reportHeaderTitle: 'DEPRECIATION SCHEDULE FOR PROPERTY, PLANT AND EQUIPMENT',
        columnFormatters: {
            2: (data) => formatCurrency(data),      // Acq. Cost
            3: (data) => formatDate(data),          // Acq. Date
            4: (data) => data ? `${data} yrs` : 'N/A', // Est. Life
            5: (data) => formatCurrency(data),      // Accum. Dep., Beg.
            6: (data) => formatCurrency(data),      // Dep. for the Period
            7: (data) => formatCurrency(data),      // Accum. Dep., End
            8: (data) => formatCurrency(data)       // Book Value, End
        }
    }));

    if (printReportBtn) {
        printReportBtn.addEventListener('click', () => {
            window.print();
        });
    }

    // --- INITIALIZATION ---
    initializePage();
}
