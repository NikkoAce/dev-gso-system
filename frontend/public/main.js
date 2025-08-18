// FILE: frontend/public/main.js
document.addEventListener('DOMContentLoaded', () => {
    const API_URL = 'http://localhost:5001/api/assets';
    const PAR_API_URL = 'http://localhost:5001/api/pars';
    let allAssets = [];
    let allPars = [];
    let selectedAssetIds = [];
    let currentParData = {};
    let myChart = null;

    // --- UTILITY FUNCTIONS ---
    const formatCurrency = (value) => new Intl.NumberFormat('en-PH', { style: 'currency', currency: 'PHP' }).format(value || 0);
    const formatDate = (dateString) => dateString ? new Date(dateString).toLocaleDateString('en-CA') : 'N/A';

    // --- DOM ELEMENTS ---
    const pages = document.querySelectorAll('.page');
    const navLinks = document.querySelectorAll('.nav-link');
    const assetForm = document.getElementById('asset-form');
    const formTitle = document.getElementById('form-title');
    const assetIdField = document.getElementById('assetId');
    const specsContainer = document.getElementById('specifications-container');
    const parDetailsModal = document.getElementById('par-details-modal');

    // --- ROUTING ---
    function showPage(pageId) {
        pages.forEach(page => page.classList.toggle('active', page.id === pageId));
        navLinks.forEach(link => {
            const linkPageId = link.getAttribute('href').substring(1);
            link.classList.toggle('active', linkPageId === pageId);
        });
        
        lucide.createIcons();
        
        switch(pageId) {
            case 'dashboard': loadDashboard(); break;
            case 'asset-registry': loadAssetRegistry(); break;
            case 'par-history': loadParHistory(); break;
        }
    }

    // --- DATA FETCHING ---
    async function fetchAllAssets() {
        try {
            const response = await fetch(API_URL);
            if (!response.ok) throw new Error('Network response was not ok');
            allAssets = await response.json();
        } catch (error) {
            console.error('Failed to fetch assets:', error);
            alert('Could not load asset data.');
        }
    }

    async function loadParHistory() {
        try {
            const response = await fetch(PAR_API_URL);
            if (!response.ok) throw new Error('Failed to fetch PAR history');
            allPars = await response.json();
            
            const tableBody = document.getElementById('par-history-table-body');
            tableBody.innerHTML = '';
            if (allPars.length === 0) {
                tableBody.innerHTML = `<tr><td colspan="6" class="text-center py-8 text-gray-500">No PARs have been saved.</td></tr>`;
                return;
            }

            allPars.forEach(par => {
                const row = `
                    <tr class="bg-white border-b hover:bg-gray-50">
                        <td class="px-6 py-4 font-medium text-gray-900">${par.parNumber}</td>
                        <td class="px-6 py-4">${par.custodian}</td>
                        <td class="px-6 py-4">${par.assets.length}</td>
                        <td class="px-6 py-4">${formatDate(par.issuedDate)}</td>
                        <td class="px-6 py-4">${formatDate(par.receivedDate)}</td>
                        <td class="px-6 py-4 text-center">
                            <div class="flex justify-center items-center space-x-3">
                                <button class="view-par-btn text-blue-600 hover:text-blue-800" data-id="${par._id}" title="View Details"><i data-lucide="eye" class="h-5 w-5"></i></button>
                                <button class="reprint-par-btn text-gray-600 hover:text-gray-800" data-id="${par._id}" title="Reprint PAR"><i data-lucide="printer" class="h-5 w-5"></i></button>
                            </div>
                        </td>
                    </tr>
                `;
                tableBody.innerHTML += row;
            });
            lucide.createIcons();

        } catch (error) {
            alert(error.message);
        }
    }

    // --- RENDERING ---
    function loadDashboard() {
        if (!allAssets || allAssets.length === 0) return;

        const totalValue = allAssets.reduce((sum, asset) => sum + asset.acquisitionCost, 0);
        const forRepair = allAssets.filter(a => a.status === 'For Repair').length;
        
        document.getElementById('stat-total-value').textContent = formatCurrency(totalValue);
        document.getElementById('stat-total-assets').textContent = allAssets.length;
        document.getElementById('stat-for-repair').textContent = forRepair;
        
        const ctx = document.getElementById('assetsByCategoryChart').getContext('2d');
        const categoryCounts = allAssets.reduce((acc, asset) => {
            acc[asset.category] = (acc[asset.category] || 0) + 1;
            return acc;
        }, {});

        if (myChart) myChart.destroy();
        
        myChart = new Chart(ctx, {
            type: 'bar',
            data: {
                labels: Object.keys(categoryCounts),
                datasets: [{
                    label: '# of Assets',
                    data: Object.values(categoryCounts),
                    backgroundColor: 'rgba(37, 99, 235, 0.6)',
                    borderColor: 'rgba(29, 78, 216, 1)',
                    borderWidth: 1,
                    borderRadius: 4
                }]
            },
            options: { 
                responsive: true,
                plugins: { legend: { display: false } },
                scales: { 
                    y: { beginAtZero: true },
                    x: { grid: { display: false } }
                } 
            }
        });
    }

    function loadAssetRegistry() {
        const tableBody = document.getElementById('asset-table-body');
        tableBody.innerHTML = '';
        if (allAssets.length === 0) {
            tableBody.innerHTML = `<tr><td colspan="8" class="text-center py-8 text-gray-500">No assets found.</td></tr>`;
            return;
        }

        let rowsHTML = '';
        allAssets.forEach(asset => {
            const statusMap = {
                'In Use': 'bg-green-100 text-green-800',
                'For Repair': 'bg-yellow-100 text-yellow-800',
                'In Storage': 'bg-blue-100 text-blue-800',
                'Disposed': 'bg-red-100 text-red-800'
            };
            const statusClass = statusMap[asset.status] || 'bg-gray-100 text-gray-800';
            
            let fullDescription = `<div class="font-medium text-gray-900">${asset.description}</div>`;
            if (asset.specifications && asset.specifications.length > 0) {
                asset.specifications.forEach(spec => {
                    fullDescription += `<div class="text-gray-500 text-xs">${spec.key}: ${spec.value}</div>`;
                });
            }
            
            const isAssigned = !!asset.assignedPAR;
            const checkboxHTML = `<input type="checkbox" class="asset-checkbox" data-id="${asset._id}" ${isAssigned ? 'disabled' : ''}>`;
            const rowClass = isAssigned ? "bg-gray-50 text-gray-500" : "bg-white hover:bg-gray-50";
            const assignedIndicator = isAssigned ? `<span class="text-xs text-blue-600 block font-normal">Assigned: ${asset.assignedPAR}</span>` : '';

            rowsHTML += `
                <tr class="${rowClass}">
                    <td class="px-4 py-4">${checkboxHTML}</td>
                    <td class="px-6 py-4 font-medium">${asset.propertyNumber}${assignedIndicator}</td>
                    <td class="px-6 py-4">${fullDescription}</td>
                    <td class="px-6 py-4">${asset.category}</td>
                    <td class="px-6 py-4">${asset.custodian}</td>
                    <td class="px-6 py-4"><span class="px-3 py-1 text-xs font-semibold rounded-full ${statusClass}">${asset.status}</span></td>
                    <td class="px-6 py-4 text-center">
                        <div class="flex justify-center items-center space-x-3">
                            <button class="edit-btn text-blue-600 hover:text-blue-800" title="Edit" data-id="${asset._id}"><i data-lucide="edit" class="h-4 w-4"></i></button>
                            <button class="delete-btn text-red-600 hover:text-red-800" title="Delete" data-id="${asset._id}"><i data-lucide="trash-2" class="h-4 w-4"></i></button>
                        </div>
                    </td>
                </tr>
            `;
        });
        tableBody.innerHTML = rowsHTML;
        lucide.createIcons();
        updateSlipButtonVisibility();
    }
    
    // --- FORM HANDLING ---
    function resetAssetForm() {
        assetForm.reset();
        assetIdField.value = '';
        formTitle.textContent = 'Add New Asset';
        specsContainer.innerHTML = '';
        addSpecificationField('Model Number', '');
        addSpecificationField('Serial Number', '');
        document.getElementById('acquisitionDate').value = new Date().toISOString().split('T')[0];
    }

    // --- DYNAMIC SPECIFICATIONS ---
    function addSpecificationField(key = '', value = '') {
        const div = document.createElement('div');
        div.className = 'spec-row flex items-center gap-2';
        div.innerHTML = `
            <input type="text" placeholder="Specification Name (e.g., Color)" value="${key}" class="spec-key w-1/3 border-gray-300 rounded-md shadow-sm text-sm">
            <input type="text" placeholder="Value (e.g., Blue)" value="${value}" class="spec-value flex-grow border-gray-300 rounded-md shadow-sm text-sm">
            <button type="button" class="remove-spec-btn text-red-500 hover:text-red-700"><i data-lucide="x-circle" class="h-5 w-5"></i></button>
        `;
        specsContainer.appendChild(div);
        lucide.createIcons();
    }

    // --- UI Update Functions ---
    function updateSlipButtonVisibility() {
        const parBtn = document.getElementById('generate-par-selected');
        const icsBtn = document.getElementById('generate-ics-selected');
        if (selectedAssetIds.length > 0) {
            parBtn.classList.remove('hidden');
            icsBtn.classList.remove('hidden');
        } else {
            parBtn.classList.add('hidden');
            icsBtn.classList.add('hidden');
        }
    }

    // --- SLIP Functionality (PAR & ICS) ---
    function populateParForm(parData) {
        const parTableBody = document.getElementById('par-table-body');
        parTableBody.innerHTML = '';

        parData.assets.forEach(asset => {
            let parDescription = `<div>${asset.description}</div>`;
            if (asset.specifications && asset.specifications.length > 0) {
                asset.specifications.forEach(spec => {
                     parDescription += `<div class="text-xs text-gray-600">${spec.key}: ${spec.value}</div>`;
                });
            }

            const row = `
                <tr>
                    <td class="border border-gray-400 p-2 text-center">1</td>
                    <td class="border border-gray-400 p-2 text-center">unit</td>
                    <td class="border border-gray-400 p-2">${parDescription}</td>
                    <td class="border border-gray-400 p-2 text-center">${asset.propertyNumber}</td>
                    <td class="border border-gray-400 p-2 text-center">${formatDate(asset.acquisitionDate)}</td>
                    <td class="border border-gray-400 p-2 text-right">${formatCurrency(asset.acquisitionCost)}</td>
                </tr>
            `;
            parTableBody.innerHTML += row;
        });
        
        for (let i = parData.assets.length; i < 5; i++) {
             parTableBody.innerHTML += `<tr><td class="border border-gray-400 p-2 h-8" colspan="6"></td></tr>`;
        }
        
        document.getElementById('par-no').textContent = parData.parNumber;
        document.getElementById('par-custodian-signature').textContent = parData.custodian;
        document.getElementById('par-custodian-position').textContent = parData.custodian;
        document.getElementById('par-custodian-date-input').value = formatDate(parData.receivedDate);
        document.getElementById('par-issued-date-input').value = formatDate(parData.issuedDate);
    }
    
    function generatePAR(assetIds) {
        const selectedAssets = allAssets.filter(a => assetIds.includes(a._id));
        if (selectedAssets.length === 0) return;
        
        const firstCustodian = selectedAssets[0].custodian;
        if (!selectedAssets.every(a => a.custodian === firstCustodian)) {
            alert('Error: All selected assets must belong to the same custodian.');
            return;
        }

        const today = new Date().toLocaleDateString('en-CA');
        const parNumber = `PAR-${today.replace(/-/g, '')}-${Math.floor(Math.random() * 1000)}`;
        
        const parDataForDisplay = {
            parNumber: parNumber,
            custodian: firstCustodian,
            assets: selectedAssets,
            receivedDate: today,
            issuedDate: today
        };
        
        populateParForm(parDataForDisplay);
        
        currentParData = {
            parNumber: parNumber,
            custodian: firstCustodian,
            assets: selectedAssets.map(a => a._id)
        };

        document.getElementById('par-page-title').textContent = "Generate Property Acknowledgment Receipt";
        document.getElementById('save-and-print-par').classList.remove('hidden');
        document.getElementById('reprint-par-button').classList.add('hidden');
        
        window.location.hash = '#par-page';
    }

function generateICS(assetIds) {
        const selectedAssets = allAssets.filter(a => assetIds.includes(a._id));
        if (selectedAssets.length === 0) return;
        
        const firstCustodian = selectedAssets[0].custodian;
        if (!selectedAssets.every(a => a.custodian === firstCustodian)) {
            alert('Error: All selected assets must belong to the same custodian.');
            return;
        }

        const today = new Date().toLocaleDateString('en-CA');
        const icsTableBody = document.getElementById('ics-table-body');
        icsTableBody.innerHTML = '';

        selectedAssets.forEach(asset => {
            let icsDescription = `<div>${asset.description}</div>`;
            if (asset.specifications && asset.specifications.length > 0) {
                asset.specifications.forEach(spec => {
                     icsDescription += `<div class="text-xs text-gray-600">${spec.key}: ${spec.value}</div>`;
                });
            }

            const row = `
                <tr>
                    <td class="border border-gray-400 p-2 text-center">1</td>
                    <td class="border border-gray-400 p-2 text-center">unit</td>
                    <td class="border border-gray-400 p-2">${icsDescription}</td>
                    <td class="border border-gray-400 p-2 text-right">${formatCurrency(asset.acquisitionCost)}</td>
                    <td class="border border-gray-400 p-2 text-center">${asset.usefulLife} years</td>
                </tr>
            `;
            icsTableBody.innerHTML += row;
        });

        for (let i = selectedAssets.length; i < 5; i++) {
             icsTableBody.innerHTML += `<tr><td class="border border-gray-400 p-2 h-8" colspan="5"></td></tr>`;
        }
        
        document.getElementById('ics-no').textContent = `ICS-${today.replace(/-/g, '')}-${Math.floor(Math.random() * 1000)}`;
        document.getElementById('ics-custodian-signature').textContent = firstCustodian;
        document.getElementById('ics-custodian-position').textContent = firstCustodian;
        document.getElementById('ics-custodian-date').textContent = today;
        document.getElementById('ics-issued-date').textContent = today;
        
        window.location.hash = '#ics-page';
    }
    
    
    // --- REPORTS ---
  function generateReportTable(title, headers, rows) {
        const container = document.getElementById('report-table-container');
        document.getElementById('report-title').textContent = title;
        
        let tableHTML = `<table class="w-full text-sm text-left text-gray-600">
            <thead class="text-xs text-gray-700 uppercase bg-gray-50">
                <tr>${headers.map(h => `<th class="px-4 py-2 border">${h}</th>`).join('')}</tr>
            </thead>
            <tbody>
                ${rows.map(row => `
                    <tr class="border-b">${row.map(cell => `<td class="px-4 py-2 border">${cell}</td>`).join('')}</tr>
                `).join('')}
            </tbody>
        </table>`;
        
        container.innerHTML = tableHTML;
        document.getElementById('report-output').classList.remove('hidden');
    }


    // --- MODAL Functionality ---
    function showParDetails(parId) {
        const par = allPars.find(p => p._id === parId);
        if (!par) return;

        document.getElementById('modal-par-number').textContent = par.parNumber;
        document.getElementById('modal-par-custodian').textContent = par.custodian;
        document.getElementById('modal-par-issued').textContent = formatDate(par.issuedDate);
        document.getElementById('modal-par-received').textContent = formatDate(par.receivedDate);

        const assetsTableBody = document.getElementById('modal-par-assets-table');
        assetsTableBody.innerHTML = '';
        par.assets.forEach(asset => {
            let desc = asset.description;
            if(asset.specifications && asset.specifications.length > 0) {
                const specs = asset.specifications.map(s => `${s.key}: ${s.value}`).join(', ');
                desc += ` (${specs})`;
            }
            const row = `
                <tr class="border-b">
                    <td class="p-4">${asset.propertyNumber}</td>
                    <td class="p-4">${desc}</td>
                    <td class="p-4 text-right">${formatCurrency(asset.acquisitionCost)}</td>
                </tr>
            `;
            assetsTableBody.innerHTML += row;
        });

        parDetailsModal.classList.remove('hidden');
    }

    // --- PRINTING ---
    function handlePrint(printableAreaId) {
        const printContainer = document.getElementById('print-container');
        const sourceArea = document.getElementById(printableAreaId);

        if (sourceArea && printContainer) {
            printContainer.innerHTML = sourceArea.innerHTML;
            window.print();
            printContainer.innerHTML = ''; // Clean up after printing
        } else {
            console.error('Printable area not found:', printableAreaId);
            alert('Error: Could not prepare document for printing.');
        }
    }

    // --- INITIALIZATION & EVENT LISTENERS ---
    function setupEventListeners() {
        assetForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            
            const assetId = assetIdField.value;
            const specifications = [];
            const specRows = specsContainer.querySelectorAll('.spec-row');
            specRows.forEach(row => {
                const key = row.querySelector('.spec-key').value.trim();
                const value = row.querySelector('.spec-value').value.trim();
                if (key && value) {
                    specifications.push({ key, value });
                }
            });

            const assetData = {
                propertyNumber: document.getElementById('propertyNumber').value,
                description: document.getElementById('description').value,
                specifications: specifications,
                category: document.getElementById('category').value,
                acquisitionDate: document.getElementById('acquisitionDate').value,
                acquisitionCost: parseFloat(document.getElementById('acquisitionCost').value),
                usefulLife: parseInt(document.getElementById('usefulLife').value),
                salvageValue: parseFloat(document.getElementById('salvageValue').value) || 0,
                custodian: document.getElementById('custodian').value,
                status: document.getElementById('status').value,
            };

            const isDuplicate = allAssets.some(asset => 
                asset.propertyNumber === assetData.propertyNumber && asset._id !== assetId
            );

            if (isDuplicate) {
                alert('Error: Property Number already exists.');
                return;
            }
            
            const method = assetId ? 'PUT' : 'POST';
            const url = assetId ? `${API_URL}/${assetId}` : API_URL;

            try {
                const response = await fetch(url, {
                    method: method,
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(assetData)
                });

                if (!response.ok) {
                    const errData = await response.json();
                    throw new Error(errData.message || `Failed to ${assetId ? 'update' : 'create'} asset`);
                }

                alert(`Asset ${assetId ? 'updated' : 'added'} successfully!`);
                await fetchAllAssets();
                window.location.hash = '#asset-registry';
            } catch (error) {
                alert(`Error: ${error.message}`);
            }
        });

        // Use event delegation for all click events
        document.body.addEventListener('click', async (e) => {
            const addSpecBtn = e.target.closest('#add-spec-btn');
            if (addSpecBtn) {
                addSpecificationField();
                return;
            }

            const removeSpecBtn = e.target.closest('.remove-spec-btn');
            if (removeSpecBtn) {
                removeSpecBtn.closest('.spec-row').remove();
                return;
            }

            const editButton = e.target.closest('.edit-btn');
            if (editButton) {
                const id = editButton.dataset.id;
                const asset = allAssets.find(a => a._id === id);
                if (asset) {
                    formTitle.textContent = 'Edit Asset';
                    assetIdField.value = asset._id;
                    document.getElementById('propertyNumber').value = asset.propertyNumber;
                    document.getElementById('description').value = asset.description;
                    
                    specsContainer.innerHTML = '';
                    if (asset.specifications && asset.specifications.length > 0) {
                        asset.specifications.forEach(spec => addSpecificationField(spec.key, spec.value));
                    } else {
                        addSpecificationField('Model Number', '');
                        addSpecificationField('Serial Number', '');
                    }

                    document.getElementById('category').value = asset.category;
                    document.getElementById('acquisitionDate').value = formatDate(asset.acquisitionDate);
                    document.getElementById('acquisitionCost').value = asset.acquisitionCost;
                    document.getElementById('usefulLife').value = asset.usefulLife;
                    document.getElementById('salvageValue').value = asset.salvageValue;
                    document.getElementById('custodian').value = asset.custodian;
                    document.getElementById('status').value = asset.status;
                    window.location.hash = '#add-asset';
                }
                return;
            }

            const deleteButton = e.target.closest('.delete-btn');
            if (deleteButton) {
                const id = deleteButton.dataset.id;
                if (confirm('Are you sure you want to delete this asset?')) {
                    fetch(`${API_URL}/${id}`, { method: 'DELETE' })
                        .then(res => {
                            if (!res.ok) throw new Error('Failed to delete asset');
                            alert('Asset deleted successfully.');
                            return fetchAllAssets();
                        })
                        .then(() => loadAssetRegistry())
                        .catch(err => alert(err.message));
                }
                return;
            }

            const viewParButton = e.target.closest('.view-par-btn');
            if (viewParButton) {
                const parId = viewParButton.dataset.id;
                showParDetails(parId);
                return;
            }

            const reprintParButton = e.target.closest('.reprint-par-btn');
            if (reprintParButton) {
                const parId = reprintParButton.dataset.id;
                const parToReprint = allPars.find(p => p._id === parId);
                if (parToReprint) {
                    populateParForm(parToReprint);
                    document.getElementById('par-page-title').textContent = "Reprint Property Acknowledgment Receipt";
                    document.getElementById('save-and-print-par').classList.add('hidden');
                    document.getElementById('reprint-par-button').classList.remove('hidden');
                    window.location.hash = '#par-page';
                }
                return;
            }
            
            if (e.target.closest('#reprint-par-button') || e.target.closest('#print-ics')) {
                handlePrint('par-form-container');
                return;
            }

            if (e.target.closest('#close-par-modal')) {
                parDetailsModal.classList.add('hidden');
                return;
            }

            if (e.target.closest('#cancel-asset-form') || e.target.closest('#back-from-par') || e.target.closest('#back-from-ics')) {
                window.location.hash = '#asset-registry';
                return;
            }
            
            if (e.target.closest('#generate-par-selected')) {
                generatePAR(selectedAssetIds);
                return;
            }

            if (e.target.closest('#generate-ics-selected')) {
                generateICS(selectedAssetIds);
                return;
            }

            if (e.target.closest('#save-and-print-par')) {
                currentParData.issuedDate = document.getElementById('par-issued-date-input').value;
                currentParData.receivedDate = document.getElementById('par-custodian-date-input').value;

                try {
                    const response = await fetch(PAR_API_URL, {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify(currentParData)
                    });

                    if (!response.ok) {
                        const errData = await response.json();
                        throw new Error(errData.message || 'Failed to save PAR');
                    }

                    alert('PAR saved successfully!');
                    handlePrint('par-form-container');

                    await fetchAllAssets();
                    window.location.hash = '#asset-registry';
                } catch (error) {
                    alert(`Error: ${error.message}`);
                }
                return;
            }

            if (e.target.closest('#generate-rpcppe') || e.target.closest('#generate-depreciation')) {
                const isRpcppe = !!e.target.closest('#generate-rpcppe');
                if (isRpcppe) {
                    const headers = ['Property No.', 'Description', 'Acquisition Date', 'Unit Cost', 'Custodian', 'Status'];
                    const rows = allAssets.map(a => [a.propertyNumber, a.description, formatDate(a.acquisitionDate), formatCurrency(a.acquisitionCost), a.custodian, a.status]);
                    generateReportTable('Report on the Physical Count of PPE (RPCPPE)', headers, rows);
                } else {
                    alert('Depreciation report generation is a complex feature and is not fully implemented in this demo.');
                }
                return;
            }

            if (e.target.closest('#mobile-menu-button')) {
                 document.getElementById('sidebar').classList.toggle('hidden');
                 document.getElementById('sidebar').classList.toggle('flex');
                 return;
            }

            const navLink = e.target.closest('.nav-link');
            if(navLink) {
                e.preventDefault();
                const targetPage = navLink.getAttribute('href');
                if (targetPage === '#add-asset') {
                    resetAssetForm();
                }
                window.location.hash = targetPage;
            }
        });

        // Handle non-click events separately
        document.getElementById('asset-table-body').addEventListener('change', (e) => {
             if (e.target.classList.contains('asset-checkbox')) {
                const assetId = e.target.dataset.id;
                if (e.target.checked) {
                    if (!selectedAssetIds.includes(assetId)) selectedAssetIds.push(assetId);
                } else {
                    selectedAssetIds = selectedAssetIds.filter(id => id !== assetId);
                }
                updateSlipButtonVisibility();
            }
        });

        document.getElementById('select-all-assets').addEventListener('change', (e) => {
            const checkboxes = document.querySelectorAll('.asset-checkbox');
            selectedAssetIds = [];
            checkboxes.forEach(checkbox => {
                checkbox.checked = e.target.checked;
                if (e.target.checked) {
                    selectedAssetIds.push(checkbox.dataset.id);
                }
            });
            updateSlipButtonVisibility();
        });
        
        window.addEventListener('hashchange', () => showPage(window.location.hash.substring(1) || 'dashboard'));
    }

    async function init() {
        setupEventListeners();
        await fetchAllAssets();
        showPage(window.location.hash.substring(1) || 'dashboard');
    }

    init();
});
