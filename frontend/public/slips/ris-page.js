// FILE: frontend/public/ris-page.js
import { fetchWithAuth } from '../js/api.js';
import { createAuthenticatedPage } from '../js/page-loader.js';

createAuthenticatedPage({
    permission: 'requisition:process', // Assuming a permission for GSO to process requisitions
    pageInitializer: initializeRisPage,
    pageName: 'Requisition and Issue Slip'
});

function initializeRisPage(user) {
    const risContainer = document.getElementById('ris-container');
    const printButton = document.getElementById('print-ris-btn');

    const formatDate = (dateString) => dateString ? new Date(dateString).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) : 'N/A';

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
        const totalRows = 15; // Standard number of rows on a physical form

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
                    <td class="border border-black p-1"></td>
                    <td class="border border-black p-1"></td>
                </tr>
            `;
        }

        risContainer.innerHTML = `
            <div class="flex flex-col items-center mb-8">
                <img src="../LGU-DAET-LOGO.png" alt="LGU Daet Logo" class="h-20 w-20">
                <div class="text-center mt-4">
                    <p>Republic of the Philippines</p>
                    <p class="font-bold">PROVINCE OF CAMARINES NORTE</p>
                    <p class="font-bold">MUNICIPALITY OF DAET</p>
                </div>
            </div>
            <div class="text-center mb-4">
                <h2 class="text-xl font-bold">REQUISITION AND ISSUE SLIP</h2>
                <h3 class="font-semibold">LGU Daet, Camarines Norte</h3>
            </div>
            <div class="flex justify-between mb-2 text-sm">
                <span>Entity Name: LGU Daet</span>
                <span class="font-bold">RIS No: <span class="underline">${req.risNumber}</span></span>
            </div>
            <div class="flex justify-between mb-2 text-sm">
                <span>Office: <span class="font-semibold underline">${req.requestingOffice}</span></span>
                <span>Fund Cluster: <span class="font-semibold underline">01</span></span>
            </div>
            <table class="w-full border-collapse border border-black text-xs">
                <thead>
                    <tr class="text-center font-bold">
                        <td rowspan="2" class="border border-black p-1">Stock No.</td>
                        <td rowspan="2" class="border border-black p-1">Unit</td>
                        <td rowspan="2" class="border border-black p-1 w-2/5">Description</td>
                        <td colspan="2" class="border border-black p-1">Quantity</td>
                        <td rowspan="2" class="border border-black p-1">Remarks</td>
                    </tr>
                    <tr class="text-center font-bold">
                        <td class="border border-black p-1">Requested</td>
                        <td class="border border-black p-1">Issued</td>
                    </tr>
                </thead>
                <tbody>${itemsHTML}</tbody>
            </table>
            <div class="text-sm mt-2 border-t border-b border-black py-1">
                <strong>Purpose:</strong> ${req.purpose}
            </div>
            <table class="w-full text-xs mt-2">
                <thead>
                    <tr>
                        <th></th>
                        <th class="font-bold p-1">Requested by:</th>
                        <th class="font-bold p-1">Approved by:</th>
                        <th class="font-bold p-1">Issued by:</th>
                        <th class="font-bold p-1">Received by:</th>
                    </tr>
                </thead>
                <tbody>
                    <tr class="text-center">
                        <td class="text-left font-bold p-1">Signature:</td>
                        <td class="border-b border-black h-8"></td>
                        <td class="border-b border-black h-8"></td>
                        <td class="border-b border-black h-8"></td>
                        <td class="border-b border-black h-8"></td>
                    </tr>
                    <tr class="text-center">
                        <td class="text-left font-bold p-1">Printed Name:</td>
                        <td class="border-b border-black p-1 font-bold uppercase">${req.requestingUser.name}</td>
                        <td class="border-b border-black p-1 font-bold uppercase">MAYOR</td>
                        <td class="border-b border-black p-1 font-bold uppercase">GSO</td>
                        <td class="border-b border-black p-1"></td>
                    </tr>
                    <tr class="text-center">
                        <td class="text-left font-bold p-1">Designation:</td>
                        <td class="border-b border-black p-1">${req.requestingUser.office}</td>
                        <td class="border-b border-black p-1">Municipal Mayor</td>
                        <td class="border-b border-black p-1">General Services Officer</td>
                        <td class="border-b border-black p-1"></td>
                    </tr>
                    <tr class="text-center">
                        <td class="text-left font-bold p-1">Date:</td>
                        <td class="border-b border-black p-1">${formatDate(req.dateRequested)}</td>
                        <td class="border-b border-black p-1"></td>
                        <td class="border-b border-black p-1"></td>
                        <td class="border-b border-black p-1"></td>
                    </tr>
                </tbody>
            </table>
        `;
    }

    printButton.addEventListener('click', () => {
        window.print();
    });

    fetchAndRenderRIS();
}