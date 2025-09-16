import { fetchWithAuth } from '../js/api.js';
import { createUIManager } from '../js/ui.js';
import { createAuthenticatedPage } from '../js/page-loader.js';

createAuthenticatedPage({
    permission: 'report:generate',
    pageInitializer: initializeReportPage,
    pageName: 'Appendix 68 Waste Report'
});

function initializeReportPage(user) {
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
    const signatory2Name = document.getElementById('signatory-2-name');
    const signatory3Name = document.getElementById('signatory-3-name');

    // Set default date to today
    asAtDateInput.value = new Date().toISOString().split('T')[0];

    // --- EVENT LISTENERS ---
    generateBtn.addEventListener('click', handleGenerateReport);
    printBtn.addEventListener('click', () => window.print());

    // --- LOGIC ---
    function populateSignatories() {
        // In a real app, this might come from a config or API.
        const signatories = {
            propertyOfficer: { name: user.name }, // Use the current user as the property officer
            inspector: { name: '________________________' },
            coaRep: { name: '________________________' },
        };
        signatory1Name.textContent = signatories.propertyOfficer.name;
        signatory2Name.textContent = signatories.inspector.name;
        signatory3Name.textContent = signatories.coaRep.name;
    }

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
            const data = await fetchWithAuth(`assets/reports/appendix68-waste?${params.toString()}`);
            
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
                reportContainer.classList.remove('hidden');
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
        tableHead.innerHTML = `<tr>${headers.map(h => `<th class="border border-black p-1">${h}</th>`).join('')}</tr>`;
        tableBody.innerHTML = rows.map(row => 
            `<tr>${row.map(cell => `<td class="border border-black p-1">${cell}</td>`).join('')}</tr>`
        ).join('');
    }
}