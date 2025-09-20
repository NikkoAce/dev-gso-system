import { fetchWithAuth } from '../js/api.js';
import { createAuthenticatedPage } from '../js/page-loader.js';
import { exportToPDF, togglePreviewMode } from '../js/report-utils.js';

createAuthenticatedPage({
    permission: 'requisition:read:own_office', // Allow users to print their own slips
    pageInitializer: initializeSaiPage,
    pageName: 'Supplies Availability Inquiry'
});

function initializeSaiPage(user) {
    const saiContainer = document.getElementById('sai-container');
    const printButton = document.getElementById('print-btn');
    const exportPdfBtn = document.getElementById('export-pdf-btn');
    const previewBtn = document.getElementById('preview-btn');
    const exitPreviewBtn = document.getElementById('exit-preview-btn');
    let currentRequisition = null;

    const formatDate = (dateString) => dateString ? new Date(dateString).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' }) : '';

    async function fetchAndRenderSAI() {
        const urlParams = new URLSearchParams(window.location.search);
        const requisitionId = urlParams.get('id');

        if (!requisitionId) {
            saiContainer.innerHTML = `<p class="text-center text-red-500">No Requisition ID provided.</p>`;
            return;
        }

        try {
            // Determine which endpoint to use based on user permissions for security and correctness.
            const endpoint = user.permissions.includes('requisition:read:all')
                ? `requisitions/${requisitionId}`
                : `requisitions/my-office/${requisitionId}`;
            const requisition = await fetchWithAuth(endpoint);
            currentRequisition = requisition;
            renderSAI(requisition);
        } catch (error) {
            console.error('Failed to fetch SAI data:', error);
            saiContainer.innerHTML = `<p class="text-center text-red-500">Error loading SAI: ${error.message}</p>`;
        }
    }

    function renderSAI(req) {
        let itemsHTML = '';
        const totalRows = 15; // Standard number of rows on a physical form

        req.items.forEach(item => {
            itemsHTML += `
                <tr class="text-center">
                    <td class="border border-black p-1">${item.stockItem?.stockNumber || 'N/A'}</td>
                    <td class="border border-black p-1 text-left">${item.description}</td>
                    <td class="border border-black p-1">${item.stockItem?.unitOfMeasure || 'N/A'}</td>
                    <td class="border border-black p-1">${item.quantityRequested}</td>
                    <td class="border border-black p-1 h-8"></td>
                </tr>
            `;
        });

        // Add empty rows to fill the page
        for (let i = req.items.length; i < totalRows; i++) {
            itemsHTML += `
                <tr class="text-center">
                    <td class="border border-black p-1 h-8"></td>
                    <td class="border border-black p-1"></td>
                    <td class="border border-black p-1"></td>
                    <td class="border border-black p-1"></td>
                    <td class="border border-black p-1"></td>
                </tr>
            `;
        }

        saiContainer.innerHTML = `
            <div class="text-center mb-4">
                <h2 class="text-xl font-bold">SUPPLIES AVAILABILITY INQUIRY</h2>
            </div>
            <div class="grid grid-cols-[40%_60%] text-sm mb-4">
                <div>
                    <p><strong>Department:</strong> <span class="underline">${req.requestingOffice || 'N/A'}</span></p>
                </div>
                <div class="text-right">
                    <p><strong>SAI No.:</strong> <span class="underline">${req.saiNumber || '________________'}</span></p>
                    <p><strong>Date:</strong> <span class="underline">${req.saiNumber ? formatDate(req.updatedAt) : '________________'}</span></p>
                </div>
            </div>

            <table class="w-full border-collapse border border-black text-xs">
                <thead>
                    <tr class="text-center font-bold">
                        <th class="border border-black p-1">Stock No.</th>
                        <th class="border border-black p-1 w-2/5">Description</th>
                        <th class="border border-black p-1">Unit</th>
                        <th class="border border-black p-1">Quantity Requested</th>
                        <th class="border border-black p-1">Availability (Y/N)</th>
                    </tr>
                </thead>
                <tbody>${itemsHTML}</tbody>
            </table>
            <div class="text-sm mt-2 py-1">
                <strong>Purpose:</strong> ${req.purpose}
            </div>
            
            <div class="grid grid-cols-2 gap-8 mt-8 text-sm">
                <div>
                    <p>Requested by:</p>
                    <div class="mt-12 text-center">
                        <p class="font-bold uppercase border-b border-black">${req.requestingUser?.name || 'N/A'}</p>
                        <p>Signature over Printed Name</p>
                    </div>
                </div>
                <div>
                    <p>Availability Certified by:</p>
                    <div class="mt-12 text-center">
                        <p class="font-bold uppercase border-b border-black">&nbsp;</p>
                        <p>Signature over Printed Name of GSO</p>
                    </div>
                </div>
            </div>
        `;
    }

    function handleExportPDF() {
        if (!currentRequisition) return;
        const fileName = `SAI-${currentRequisition.saiNumber || currentRequisition.risNumber || 'report'}.pdf`;
        exportToPDF({
            reportElementId: 'report-output',
            fileName: fileName,
            buttonElement: exportPdfBtn,
            orientation: 'portrait',
            format: 'a4'
        });
    }

    function handleTogglePreview() {
        togglePreviewMode({
            reportElementId: 'report-output',
            orientation: 'portrait',
            exitButtonId: 'exit-preview-btn'
        });
    }

    printButton.addEventListener('click', () => window.print());
    exportPdfBtn.addEventListener('click', handleExportPDF);
    previewBtn.addEventListener('click', handleTogglePreview);
    exitPreviewBtn.addEventListener('click', handleTogglePreview);

    fetchAndRenderSAI();
}