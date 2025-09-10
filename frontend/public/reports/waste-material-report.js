import { getCurrentUser, gsoLogout } from '../js/auth.js';
import { fetchWithAuth } from '../js/api.js';
import { createUIManager } from '../js/ui.js';

document.addEventListener('DOMContentLoaded', async () => {
    try {
        const user = await getCurrentUser();
        if (!user) return;

        if (!user.permissions?.includes('report:generate')) {
            window.location.href = '../dashboard/dashboard.html';
            return;
        }

        initializeLayout(user, gsoLogout);
        initializeReportPage();
    } catch (error) {
        console.error("Initialization failed:", error);
    }
});

function initializeReportPage() {
    const { showToast } = createUIManager();

    // --- DOM ELEMENTS ---
    const asAtDateInput = document.getElementById('as-at-date');
    const generateBtn = document.getElementById('generate-report-btn');
    const printBtn = document.getElementById('print-report-btn');
    const reportContainer = document.getElementById('report-container');
    const loadingContainer = document.getElementById('loading-container');
    const tableHead = document.getElementById('report-table-head');
    const tableBody = document.getElementById('report-table-body');
    const noDataMessage = document.getElementById('no-data-message');
    const reportHeader = document.getElementById('report-header');
    const reportFooter = document.getElementById('report-footer');
    const reportDateDisplay = document.getElementById('report-date-display');
    const signatory1Name = document.getElementById('signatory-1-name');
    const signatory1Title = document.getElementById('signatory-1-title');
    const signatory2Name = document.getElementById('signatory-2-name');
    const signatory2Title = document.getElementById('signatory-2-title');

    // Set default date to today
    asAtDateInput.value = new Date().toISOString().split('T')[0];

    // --- EVENT LISTENERS ---
    generateBtn.addEventListener('click', handleGenerateReport);
    printBtn.addEventListener('click', () => window.print());

    // --- LOGIC ---
    function populateSignatories() {
        // In a real app, this might come from a config or API.
        const signatories = {
            certifier: { name: 'INVENTORY COMMITTEE CHAIR', title: 'Signature over Printed Name' },
            approver: { name: 'HEAD OF AGENCY/ENTITY', title: 'Signature over Printed Name' },
        };
        signatory1Name.textContent = signatories.certifier.name;
        signatory1Title.textContent = signatories.certifier.title;
        signatory2Name.textContent = signatories.approver.name;
        signatory2Title.textContent = signatories.approver.title;
    }

    const formatCurrency = (value) => new Intl.NumberFormat('en-PH', { style: 'currency', currency: 'PHP' }).format(value || 0);

    async function handleGenerateReport() {
        const asAtDate = asAtDateInput.value;
        if (!asAtDate) {
            showToast('Please select an "As at Date".', 'error');
            return;
        }

        reportContainer.classList.add('hidden');
        noDataMessage.classList.add('hidden');
        loadingContainer.classList.remove('hidden');
        reportHeader.classList.add('hidden');
        reportFooter.classList.add('hidden');
        printBtn.classList.add('hidden');
        generateBtn.classList.add('loading');
        generateBtn.disabled = true;

        try {
            const params = new URLSearchParams({ asAtDate });
            const data = await fetchWithAuth(`assets/reports/waste-material?${params.toString()}`);
            
            reportDateDisplay.textContent = new Date(asAtDate).toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' });

            if (data.rows && data.rows.length > 0) {
                renderReportTable(data.headers, data.rows);
                populateSignatories();
                reportContainer.classList.remove('hidden');
                reportHeader.classList.remove('hidden');
                reportFooter.classList.remove('hidden');
                printBtn.classList.remove('hidden');
            } else {
                noDataMessage.textContent = data.message || 'No waste materials found for the selected date.';
                noDataMessage.classList.remove('hidden');
                reportContainer.classList.remove('hidden'); // Show container to display the message
                tableHead.innerHTML = '';
                tableBody.innerHTML = '';
            }
        } catch (error) {
            showToast(`Error generating report: ${error.message}`, 'error');
            reportContainer.classList.add('hidden');
        } finally {
            loadingContainer.classList.add('hidden');
            generateBtn.classList.remove('loading');
            generateBtn.disabled = false;
        }
    }

    function renderReportTable(headers, rows) {
        tableHead.innerHTML = `<tr>${headers.map(h => `<th>${h}</th>`).join('')}</tr>`;
        tableBody.innerHTML = rows.map(row => {
            const formattedRow = row.map((cell, index) => {
                // The 'Amount' column is at index 6, which needs currency formatting.
                if (index === 6) {
                    return `<td class="text-right">${formatCurrency(cell)}</td>`;
                }
                return `<td>${cell}</td>`;
            });
            return `<tr>${formattedRow.join('')}</tr>`;
        }).join('');
    }
}