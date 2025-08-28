// FILE: frontend/public/slips/movable-ledger-card.js
import { getCurrentUser, gsoLogout } from '../js/auth.js';
import { fetchWithAuth } from '../js/api.js';

document.addEventListener('DOMContentLoaded', async () => {
    try {
        const user = await getCurrentUser();
        if (!user) return;

        if (!user.permissions || !user.permissions.includes('asset:read')) {
            window.location.href = '../dashboard/dashboard.html';
            return;
        }
        initializeLayout(user, gsoLogout);
        initializeLedgerCardPage();
    } catch (error) {
        console.error("Authentication failed on ledger card page:", error);
    }
});

function initializeLedgerCardPage() {
    // --- STATE & CONFIG ---
    const urlParams = new URLSearchParams(window.location.search);
    const assetId = urlParams.get('id');
    const API_ENDPOINT = `assets/${assetId}/ledger-card`;
    let currentAsset = null; // To store asset data for filename

    // --- DOM ELEMENTS ---
    const loadingState = document.getElementById('loading-state');
    const errorState = document.getElementById('error-state');
    const errorMessage = document.getElementById('error-message');
    const reportContent = document.getElementById('report-content');
    const ledgerFund = document.getElementById('ledger-fund');
    const ledgerEquipmentName = document.getElementById('ledger-equipment-name');
    const ledgerAccountCode = document.getElementById('ledger-account-code');
    const ledgerDescription = document.getElementById('ledger-description');
    const ledgerTableContainer = document.getElementById('ledger-table-container');
    const printReportBtn = document.getElementById('print-report-btn');
    const exportPdfBtn = document.getElementById('export-pdf-btn');

    // --- UTILITY FUNCTIONS ---
    const formatCurrency = (value) => new Intl.NumberFormat('en-PH', { style: 'currency', currency: 'PHP' }).format(value || 0);
    const formatDate = (dateString) => dateString ? new Date(dateString).toLocaleDateString('en-CA') : 'N/A';

    // --- RENDERING FUNCTIONS ---
    function renderLedgerHeader(asset) {
        ledgerFund.textContent = asset.fundSource || 'General Fund';
        ledgerEquipmentName.textContent = asset.category;
        ledgerAccountCode.textContent = asset.accountCode || 'N/A'; // Assuming account code might be added later
        ledgerDescription.textContent = asset.description;
    }

    function renderLedgerTable(ledgerRows) {
        if (!ledgerRows || ledgerRows.length === 0) {
            ledgerTableContainer.innerHTML = '<p>No ledger entries available for this asset.</p>';
            return;
        }

        const table = document.createElement('table');
        table.className = 'w-full text-xs border-collapse border border-black';
        table.innerHTML = `
            <thead class="bg-gray-100">
                <tr class="text-center">
                    <th class="border border-black p-1">Date</th>
                    <th class="border border-black p-1">Reference</th>
                    <th class="border border-black p-1">Particulars</th>
                    <th class="border border-black p-1">Property ID No.</th>
                    <th class="border border-black p-1">Cost</th>
                    <th class="border border-black p-1">Est. Useful Life</th>
                    <th class="border border-black p-1">Accum. Dep.</th>
                    <th class="border border-black p-1">Accum. Impairment Losses</th>
                    <th class="border border-black p-1">Adjusted Cost</th>
                    <th class="border border-black p-1" colspan="2">Repair History</th>
                    <th class="border border-black p-1">Remarks</th>
                </tr>
                <tr class="text-center">
                    <th class="border border-black p-1" colspan="9"></th>
                    <th class="border border-black p-1">Nature of Repair</th>
                    <th class="border border-black p-1">Amount</th>
                    <th class="border border-black p-1"></th>
                </tr>
            </thead>
            <tbody>
                ${ledgerRows.map(entry => `
                    <tr class="border-b">
                        <td class="border border-black p-1">${formatDate(entry.date)}</td>
                        <td class="border border-black p-1">${entry.reference}</td>
                        <td class="border border-black p-1">${entry.particulars}</td>
                        <td class="border border-black p-1">${entry.propertyId}</td>
                        <td class="border border-black p-1 text-right">${formatCurrency(entry.cost)}</td>
                        <td class="border border-black p-1 text-center">${entry.estimatedUsefulLife} yrs</td>
                        <td class="border border-black p-1 text-right">${formatCurrency(entry.accumulatedDepreciation)}</td>
                        <td class="border border-black p-1 text-right">${formatCurrency(entry.impairmentLosses)}</td>
                        <td class="border border-black p-1 text-right">${formatCurrency(entry.adjustedCost)}</td>
                        <td class="border border-black p-1">${entry.repairNature}</td>
                        <td class="border border-black p-1 text-right">${formatCurrency(entry.repairAmount)}</td>
                        <td class="border border-black p-1">${entry.remarks}</td>
                    </tr>
                `).join('')}
            </tbody>
        `;
        ledgerTableContainer.innerHTML = '';
        ledgerTableContainer.appendChild(table);
    }

    // --- CORE LOGIC ---
    async function loadLedgerCard() {
        if (!assetId) {
            loadingState.classList.add('hidden');
            errorMessage.textContent = 'No Asset ID provided.';
            errorState.classList.remove('hidden');
            return;
        }

        try {
            const { asset, ledgerRows } = await fetchWithAuth(API_ENDPOINT);
            currentAsset = asset; // Store asset for later use
            renderLedgerHeader(asset);
            renderLedgerTable(ledgerRows);
            loadingState.classList.add('hidden');
            reportContent.classList.remove('hidden');
        } catch (error) {
            console.error('Error fetching ledger card data:', error);
            loadingState.classList.add('hidden');
            errorMessage.textContent = `Error: ${error.message}`;
            errorState.classList.remove('hidden');
        }
    }

    // --- EXPORT FUNCTIONALITY ---
    function exportToPDF() {
        const { jsPDF } = window.jspdf;
        const reportElement = document.getElementById('report-output');
        
        // Temporarily remove the hidden class to ensure it's fully rendered for capture
        reportElement.classList.remove('hidden');
        
        // Show a temporary loading message
        exportPdfBtn.disabled = true;
        exportPdfBtn.innerHTML = `<i data-lucide="loader-2" class="animate-spin"></i> Exporting...`;
        lucide.createIcons();

        html2canvas(reportElement, {
            scale: 2, // Increase scale for better resolution
            useCORS: true,
            logging: false,
            onclone: (clonedDoc) => {
                // This is a workaround for html2canvas not supporting oklch() colors used by DaisyUI.
                // Step 1: Inject a style block with the hex/hsl fallback variables.
                // These are copied from the `@supports not (color: oklch(0% 0 0))` block in the CSS.
                const style = clonedDoc.createElement('style');
                style.textContent = `
                    :root {
                        --fallback-p: #491eff; --fallback-pc: #d4dbff;
                        --fallback-s: #ff41c7; --fallback-sc: #fff9fc;
                        --fallback-a: #00cfbd; --fallback-ac: #00100d;
                        --fallback-n: #2b3440; --fallback-nc: #d7dde4;
                        --fallback-b1: #ffffff; --fallback-b2: #e5e6e6;
                        --fallback-b3: #e5e6e6; --fallback-bc: #1f2937;
                        --fallback-in: #00b3f0; --fallback-inc: #000000;
                        --fallback-su: #00ca92; --fallback-suc: #000000;
                        --fallback-wa: #ffc22d; --fallback-wac: #000000;
                        --fallback-er: #ff6f70; --fallback-erc: #000000;
                    }
                `;
                clonedDoc.head.appendChild(style);

                // Step 2: Invalidate the oklch() function in the cloned document's stylesheets.
                // This forces the browser's CSS parser to use the fallback variables we just defined.
                for (const sheet of Array.from(clonedDoc.styleSheets)) {
                    try {
                        if (sheet.cssRules) {
                            for (const rule of Array.from(sheet.cssRules)) {
                                if (rule.style && rule.style.cssText.includes('oklch')) {
                                    rule.style.cssText = rule.style.cssText.replace(/oklch/g, 'ignore');
                                }
                            }
                        }
                    } catch (e) {
                        console.warn("Could not process stylesheet for PDF export:", e.message);
                    }
                }
            }
        }).then(canvas => {
            const imgData = canvas.toDataURL('image/png');
            const pdf = new jsPDF({
                orientation: 'landscape',
                unit: 'mm',
                format: 'legal' // Use legal size for more space
            });

            const pdfWidth = pdf.internal.pageSize.getWidth();
            const pdfHeight = pdf.internal.pageSize.getHeight();
            const canvasWidth = canvas.width;
            const canvasHeight = canvas.height;
            const ratio = canvasWidth / canvasHeight;
            
            let imgWidth = pdfWidth - 20; // with margin
            let imgHeight = imgWidth / ratio;

            // If the height is too large for the page, scale by height instead
            if (imgHeight > pdfHeight - 20) {
                imgHeight = pdfHeight - 20;
                imgWidth = imgHeight * ratio;
            }

            const x = (pdfWidth - imgWidth) / 2;
            const y = (pdfHeight - imgHeight) / 2;

            pdf.addImage(imgData, 'PNG', x, y, imgWidth, imgHeight);
            
            const fileName = `Movable-Ledger-Card-${currentAsset?.propertyNumber || 'report'}.pdf`;
            pdf.save(fileName);

            // Restore button state
            exportPdfBtn.disabled = false;
            exportPdfBtn.innerHTML = `<i data-lucide="file-type-2"></i> Export as PDF`;
            lucide.createIcons();
        }).catch(err => {
            console.error("Error exporting to PDF:", err);
            alert("An error occurred while exporting to PDF.");
            // Restore button state
            exportPdfBtn.disabled = false;
            exportPdfBtn.innerHTML = `<i data-lucide="file-type-2"></i> Export as PDF`;
            lucide.createIcons();
        });
    }

    // --- EVENT LISTENERS ---
    printReportBtn.addEventListener('click', () => window.print());
    exportPdfBtn.addEventListener('click', exportToPDF);

    // --- INITIALIZATION ---
    loadLedgerCard();
}