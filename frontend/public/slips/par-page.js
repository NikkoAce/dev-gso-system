// FILE: frontend/public/par-page.js
import { getCurrentUser, gsoLogout } from '../js/auth.js';
import { initializeSlipPage, formatCurrency, formatDate } from '../js/slip-page-common.js';
import { exportToPDF, togglePreviewMode } from '../js/report-utils.js';

document.addEventListener('DOMContentLoaded', async () => {
    try {
        const user = await getCurrentUser();
        // A user needs permission to either generate or read slips to view this page.
        const canAccess = user.permissions.includes('slip:generate') || user.permissions.includes('slip:read');
        if (!user || !canAccess) {
            window.location.href = '../assets/asset-registry.html'; // Redirect to a safe page
            return;
        }

        initializeLayout(user, gsoLogout);

        let currentParData = null; // Variable to hold slip data for export

        // The populateParForm function is passed as a callback to the shared initializer.
        // It contains only the logic specific to rendering the PAR form itself.
        const populateParForm = (parData) => {
            currentParData = parData; // Store the data
            const parFormContainer = document.getElementById('par-form-container');
            parFormContainer.innerHTML = ''; // Clear previous content

            let assetsHTML = '';
            let totalAmount = 0;

            parData.assets.forEach(asset => {
                totalAmount += asset.acquisitionCost;
                let parDescription = `<div>${asset.description}</div>`;
                if (asset.specifications && asset.specifications.length > 0) {
                    asset.specifications.forEach(spec => {
                        parDescription += `<div class="text-xs text-gray-600">${spec.key}: ${spec.value}</div>`;
                    });
                }
                assetsHTML += `
                    <tr>
                        <td class="border border-gray-400 p-2 text-center">1</td>
                        <td class="border border-gray-400 p-2 text-center">unit</td>
                        <td class="border border-gray-400 p-2">${parDescription}</td>
                        <td class="border border-gray-400 p-2 text-center">${asset.propertyNumber}</td>
                        <td class="border border-gray-400 p-2 text-center">${formatDate(asset.acquisitionDate)}</td>
                        <td class="border border-gray-400 p-2 text-right">${formatCurrency(asset.acquisitionCost)}</td>
                    </tr>
                `;
            });
            
            for (let i = parData.assets.length; i < 5; i++) {
                assetsHTML += `<tr><td class="border border-gray-400 p-2 h-8" colspan="6"></td></tr>`;
            }
            
            const footerHTML = `
                <tr class="font-bold bg-gray-50">
                    <td class="border border-gray-400 p-2 text-right" colspan="5">TOTAL</td>
                    <td class="border border-gray-400 p-2 text-right">${formatCurrency(totalAmount)}</td>
                </tr>
            `;

            parFormContainer.innerHTML = `
                <div class="flex flex-col items-center mb-8">
                   <img src="../LGU-DAET-LOGO.png" alt="LGU Daet Logo" class="h-20 w-20">
                   <div class="text-center mt-4">
                       <p>Republic of the Philippines</p>
                       <p class="font-bold">PROVINCE OF CAMARINES NORTE</p>
                       <p class="font-bold">MUNICIPALITY OF DAET</p>
                   </div>
               </div>
                <div class="text-center mb-6">
                   <h2 class="text-xl font-bold">PROPERTY ACKNOWLEDGMENT RECEIPT</h2>
                   <h3 class="font-semibold">LGU Daet, Camarines Norte</h3>
                   <p class="text-sm">Fund: <span id="par-fund-source" class="font-semibold">${(parData.assets && parData.assets.length > 0) ? parData.assets[0].fundSource : ''}</span></p>
               </div>
               <div class="flex justify-between mb-4 text-sm">
                   <span>Entity Name: LGU Daet</span>
                   <span class="font-bold">PAR No: <span id="par-no">${parData.parNumber || parData.number}</span></span>
               </div>
               <table class="w-full border-collapse border border-gray-400 text-sm">
                   <thead>
                       <tr class="bg-gray-100">
                           <th class="border border-gray-400 p-2 text-center" width="10%">Quantity</th>
                           <th class="border border-gray-400 p-2 text-center" width="10%">Unit</th>
                           <th class="border border-gray-400 p-2 text-left">Description</th>
                           <th class="border border-gray-400 p-2 text-center" width="20%">Property Number</th>
                           <th class="border border-gray-400 p-2 text-center" width="15%">Date Acquired</th>
                           <th class="border border-gray-400 p-2 text-right" width="15%">Amount</th>
                       </tr>
                   </thead>
                   <tbody>${assetsHTML}</tbody>
                   <tfoot>${footerHTML}</tfoot>
               </table>
               <div class="grid grid-cols-2 gap-4 mt-8 pt-4 border-t-2 border-black">
                   <div class="text-sm">
                       <p class="font-bold">Received by:</p>
                       <div class="mt-12 text-center">
                           <p class="font-bold uppercase border-b border-black">${parData.custodian.name}</p>
                           <p>(Signature Over Printed Name of End User)</p>
                       </div>
                       <div class="mt-4 text-center">
                           <p class="border-b border-black">${parData.custodian.designation || ''}</p>
                           <p>(Position/Office)</p>
                       </div>
                       <div class="mt-4 text-center">
                            <input type="date" id="par-custodian-date-input" class="border-b border-black text-center w-full" value="${formatDate(parData.receivedDate)}">
                           <p>(Date)</p>
                       </div>
                   </div>
                   <div class="text-sm">
                       <p class="font-bold">Issued by:</p>
                       <div class="mt-12 text-center">
                           <p class="font-bold uppercase border-b border-black">DR. RAYCHEL B. VALENCIA</p>
                           <p>(Signature Over Printed Name of Supply Officer)</p>
                       </div>
                       <div class="mt-4 text-center">
                           <p class="border-b border-black">Municipal Administrator/OIC GSO</p>
                           <p>(Position/Office)</p>
                       </div>
                       <div class="mt-4 text-center">
                           <input type="date" id="par-issued-date-input" class="border-b border-black text-center w-full" value="${formatDate(parData.issuedDate)}">
                           <p>(Date)</p>
                       </div>
                   </div>
               </div>
            `;
        }

        // Configuration object that tells the common initializer how to behave for a PAR.
        const parConfig = {
            slipType: 'PAR',
            slipTitle: 'Property Acknowledgment Receipt',
            apiEndpoint: 'pars',
            numberProperty: 'parNumber',
            checkFundSource: true,
            localStorageKeys: {
                create: 'assetsForPAR',
                reprint: 'parToReprint'
            },
            domIds: {
                pageTitle: 'par-page-title',
                saveButton: 'save-and-print-par',
                reprintButton: 'reprint-par-button',
                backButton: 'back-from-par-btn',
                formContainer: 'par-form-container',
                issuedDateInput: 'par-issued-date-input',
                receivedDateInput: 'par-custodian-date-input'
            },
            backUrls: {
                create: '../assets/asset-registry.html',
                reprint: './slip-history.html'
            },
            populateFormFn: populateParForm
        };

        // Initialize the page with the common logic
        initializeSlipPage(parConfig, user);

        // --- EXPORT AND PREVIEW LOGIC ---
        const exportPdfBtn = document.getElementById('export-pdf-btn');
        const previewBtn = document.getElementById('preview-btn');
        const exitPreviewBtn = document.getElementById('exit-preview-btn');

        function handleExportPDF() {
            const fileName = `PAR-${currentParData?.number || currentParData?.parNumber || 'report'}.pdf`;
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
                orientation: 'portrait',
                exitButtonId: 'exit-preview-btn'
            });
        }

        exportPdfBtn.addEventListener('click', handleExportPDF);
        previewBtn.addEventListener('click', handleTogglePreview);
        exitPreviewBtn.addEventListener('click', handleTogglePreview);

    } catch (error) {
        console.error("Authentication failed on PAR page:", error);
    }
});
