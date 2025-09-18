import { fetchWithAuth } from '../js/api.js';
import { createAuthenticatedPage } from '../js/page-loader.js';

createAuthenticatedPage({
    permission: 'requisition:read:all',
    pageInitializer: initializeRisPage,
    pageName: 'Appendix 48 - RIS'
});

function initializeRisPage(user) {
    const risContainer = document.getElementById('ris-container');
    const printButton = document.getElementById('print-btn');

    const formatDate = (dateString) => dateString ? new Date(dateString).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) : '';

    async function fetchAndRenderRIS() {
        const urlParams = new URLSearchParams(window.location.search);
        const requisitionId = urlParams.get('id');

        if (!requisitionId) {
            risContainer.innerHTML = `<p class="text-center text-red-500">No Requisition ID provided.</p>`;
            return;
        }

        try {
            const requisition = await fetchWithAuth(`requisitions/${requisitionId}`);
            renderRIS(requisition);
        } catch (error) {
            console.error('Failed to fetch RIS data:', error);
            risContainer.innerHTML = `<p class="text-center text-red-500">Error loading RIS: ${error.message}</p>`;
        }
    }

    function renderRIS(req) {
        let itemsHTML = '';
        const totalRows = 6; // Standard number of rows on this form part

        req.items.forEach(item => {
            itemsHTML += `
                <tr class="text-center">
                    <td class="border border-black p-1">${item.stockItem?.stockNumber || 'N/A'}</td>
                    <td class="border border-black p-1">${item.stockItem?.unitOfMeasure || 'N/A'}</td>
                    <td class="border border-black p-1 text-left">${item.description}</td>
                    <td class="border border-black p-1">${item.quantityRequested}</td>
                    <td class="border border-black p-1">${item.quantityIssued || ''}</td>
                    <td class="border border-black p-1">${req.remarks || ''}</td>
                </tr>
            `;
        });

        // Add empty rows to fill the page
        for (let i = req.items.length; i < totalRows; i++) {
            itemsHTML += `
                <tr class="text-center">
                    <td class="border border-black p-1 h-6"></td>
                    <td class="border border-black p-1"></td>
                    <td class="border border-black p-1"></td>
                    <td class="border border-black p-1"></td>
                    <td class="border-black p-1"></td>
                    <td class="border border-black p-1"></td>
                </tr>
            `;
        }

        risContainer.innerHTML = `
            <div class="flex justify-between items-start mb-2">
                <div class="font-bold text-lg">REQUISITION AND ISSUE SLIP</div>
                <div class="text-right text-sm">
                    <div>Appendix 48</div>
                </div>
            </div>
            <div class="border-2 border-black">
                <div class="flex justify-between text-sm p-1 border-b-2 border-black">
                    <span>Entity Name: LGU-DAET</span>
                    <span>Fund Cluster: 01</span>
                </div>
                <div class="grid grid-cols-2 text-sm">
                    <div class="p-1 border-r-2 border-black">
                        <strong>Division:</strong> <span class="underline">${req.requestingOffice}</span><br>
                        <strong>Responsibility Center Code:</strong> <span class="underline"></span>
                    </div>
                    <div class="p-1">
                        <strong>RIS No.:</strong> <span class="underline">${req.risNumber}</span><br>
                        <strong>SAI No.:</strong> <span class="underline">${req.saiNumber || ''}</span> &nbsp;&nbsp; <strong>Date:</strong> <span class="underline">${req.saiNumber ? formatDate(req.updatedAt) : ''}</span>
                    </div>
                </div>
                <table class="w-full border-collapse border-t-2 border-black text-xs">
                    <thead>
                        <tr class="text-center font-bold">
                            <td class="border-r-2 border-black p-1" colspan="3">Requisition</td>
                            <td class="border-r-2 border-black p-1" colspan="2">Issuance</td>
                            <td rowspan="2" class="p-1">Remarks</td>
                        </tr>
                        <tr class="text-center font-bold">
                            <td class="border-t-2 border-r border-black p-1">Stock No.</td>
                            <td class="border-t-2 border-r border-black p-1">Unit</td>
                            <td class="border-t-2 border-r-2 border-black p-1 w-2/5">Description</td>
                            <td class="border-t-2 border-r border-black p-1">Quantity</td>
                            <td class="border-t-2 border-r-2 border-black p-1">Quantity</td>
                        </tr>
                    </thead>
                    <tbody>${itemsHTML}</tbody>
                </table>
                <div class="text-sm p-1 border-t-2 border-black">
                    <strong>Purpose:</strong> ${req.purpose}
                </div>
                <table class="w-full text-xs mt-2 border-t-2 border-black">
                    <thead class="font-bold">
                        <tr>
                            <td class="p-1 w-[15%]"></td>
                            <td class="p-1 w-[21.25%]">Requested by:</td>
                            <td class="p-1 w-[21.25%]">Approved by:</td>
                            <td class="p-1 w-[21.25%]">Issued by:</td>
                            <td class="p-1 w-[21.25%]">Received by:</td>
                        </tr>
                    </thead>
                    <tbody>
                        <tr class="text-center">
                            <td class="text-left font-bold p-1">Signature:</td><td class="border-b border-black h-8"></td><td class="border-b border-black h-8"></td><td class="border-b border-black h-8"></td><td class="border-b border-black h-8"></td>
                        </tr>
                        <tr class="text-center">
                            <td class="text-left font-bold p-1">Printed Name:</td><td class="border-b border-black p-1 font-bold uppercase">${req.requestingUser?.name || 'N/A'}</td><td class="border-b border-black p-1 font-bold uppercase">MAYOR</td><td class="border-b border-black p-1 font-bold uppercase">GSO</td><td class="border-b border-black p-1"></td>
                        </tr>
                        <tr class="text-center">
                            <td class="text-left font-bold p-1">Designation:</td><td class="border-b border-black p-1">${req.requestingUser?.office || 'N/A'}</td><td class="border-b border-black p-1">Municipal Mayor</td><td class="border-b border-black p-1">General Services Officer</td><td class="border-b border-black p-1"></td>
                        </tr>
                        <tr class="text-center">
                            <td class="text-left font-bold p-1">Date:</td><td class="border-b border-black p-1">${formatDate(req.dateRequested)}</td><td class="border-b border-black p-1"></td><td class="border-b border-black p-1"></td><td class="border-b border-black p-1"></td>
                        </tr>
                    </tbody>
                </table>
            </div>
        `;
    }

    printButton.addEventListener('click', () => window.print());

    fetchAndRenderRIS();
}