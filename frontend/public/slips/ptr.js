// FILE: frontend/public/ptr.js

document.addEventListener('DOMContentLoaded', async () => {
    try {
        const user = await getCurrentUser();
        if (!user) return;

        initializeLayout(user);
        initializePtrPage(user);
    } catch (error) {
        console.error("Authentication failed on PTR page:", error);
    }
});

function initializePtrPage(currentUser) {
    const ptrContainer = document.getElementById('ptr-container');
    const printButton = document.getElementById('print-btn');

    const formatCurrency = (value) => new Intl.NumberFormat('en-PH', { style: 'currency', currency: 'PHP' }).format(value || 0);
    const formatDate = (dateString) => dateString ? new Date(dateString).toLocaleDateString('en-CA') : 'N/A';

    // Check for reprint data first, then for new transfer data
    function renderPTR() {
        let ptrData = null;
        const reprintDataString = localStorage.getItem('ptrToReprint');
        const transferDataString = localStorage.getItem('transferData');

        if (reprintDataString) {
            ptrData = JSON.parse(reprintDataString);
            localStorage.removeItem('ptrToReprint'); // Clean up after use
        } else if (transferDataString) {
            ptrData = JSON.parse(transferDataString);
            localStorage.removeItem('transferData'); // Clean up after use
        }

        if (!ptrData) {
            ptrContainer.innerHTML = `<p class="text-center text-red-500">No transfer data found. Please initiate a transfer from the Asset Registry.</p>`;
            return;
        }
        const { from, to, assets, date, ptrNumber } = ptrData;

        let assetRows = '';
        let totalAmount = 0;
        assets.forEach(asset => {
            totalAmount += asset.acquisitionCost;
            assetRows += `
                <tr class="text-center">
                    <td class="border border-black p-1">1</td>
                    <td class="border border-black p-1">unit</td>
                    <td class="border border-black p-1 text-left">${asset.description}</td>
                    <td class="border border-black p-1">${asset.propertyNumber}</td>
                    <td class="border border-black p-1 text-right">${formatCurrency(asset.acquisitionCost)}</td>
                    <td class="border border-black p-1">${asset.remarks || ''}</td>
                </tr>
            `;
        });

        // Add empty rows for a consistent look
        for (let i = assets.length; i < 10; i++) {
            assetRows += `<tr><td class="border border-black h-6" colspan="6"></td></tr>`;
        }

        ptrContainer.innerHTML = `
            <div class="text-center mb-4">
                <h2 class="text-xl font-bold">PROPERTY TRANSFER REPORT</h2>
            </div>` + (ptrNumber ? `<div class="text-center mb-4 text-sm font-bold">PTR No: ${ptrNumber}</div>` : '') + `
            <div class="text-sm mb-4">
                <p><strong>Entity Name:</strong> LGU of Daet</p>
                <p><strong>PTR No.:</strong> <span class="font-semibold">PTR-${new Date(date).getFullYear()}-${String(Math.floor(Math.random() * 9000) + 1000).padStart(4, '0')}</span></p>
            </div>
            <div class="grid grid-cols-2 gap-4 text-sm mb-4 border-t border-b border-black py-2">
                <div>
                    <p><strong>From Accountable Officer/Agency/Fund Cluster:</strong></p>
                    <p class="font-semibold pl-4">${from.name}</p>
                </div>
                <div>
                    <p><strong>To Accountable Officer/Agency/Fund Cluster:</strong></p>
                    <p class="font-semibold pl-4">${to.name}</p>
                </div>
            </div>
            <p class="text-sm mb-2"><strong>Transfer Type:</strong> (check one)</p>
            <div class="flex items-center gap-8 text-sm mb-4">
                <div><input type="checkbox" disabled> Donation</div>
                <div><input type="checkbox" disabled> Relocate</div>
                <div><input type="checkbox" disabled> Reassign</div>
                <div><input type="checkbox" checked> Others (Specify) <span class="underline">Internal Transfer</span></div>
            </div>

            <table class="w-full text-xs border-collapse border border-black">
                <thead class="bg-gray-100">
                    <tr class="text-center">
                        <th class="border border-black p-1">Quantity</th>
                        <th class="border border-black p-1">Unit</th>
                        <th class="border border-black p-1">Description</th>
                        <th class="border border-black p-1">Property No.</th>
                        <th class="border border-black p-1">Amount</th>
                        <th class="border border-black p-1">Remarks</th>
                    </tr>
                </thead>
                <tbody>
                    
                </tbody>
            </table>

            <div class="grid grid-cols-2 gap-8 mt-4 text-sm">
                <div>
                    <p><strong>Reason for Transfer:</strong></p>
                    <div class="border-b border-black h-8"></div>
                </div>
                <div></div>
            </div>

            <div class="grid grid-cols-2 gap-8 mt-8 text-sm">
                <div>
                    <p>Approved by:</p>
                    <div class="mt-12 text-center">
                        <p class="font-bold uppercase border-b border-black">&nbsp;</p>
                        <p>Signature over Printed Name of Head of Agency/Entity or his/her Authorized Representative</p>
                    </div>
                </div>
                <div>
                    <p>Released/Issued by:</p>
                    <div class="mt-12 text-center">
                        <p class="font-bold uppercase border-b border-black">${from.name}</p>
                        <p>Signature over Printed Name of Accountable Officer</p>
                    </div>
                </div>
            </div>
            <div class="grid grid-cols-2 gap-8 mt-8 text-sm">
                <div>
                    <p>Received by:</p>
                    <div class="mt-12 text-center">
                        <p class="font-bold uppercase border-b border-black">${to.name}</p>
                        <p>Signature over Printed Name of Accountable Officer</p>
                    </div>
                </div>
                <div>
                    <p>Date:</p>
                    <div class="mt-12 text-center">
                        <p class="font-bold uppercase border-b border-black">${formatDate(date)}</p>
                    </div>
                </div>
            </div>
        `;
    }

    printButton.addEventListener('click', () => {
        window.print();
    });

    renderPTR();
}
