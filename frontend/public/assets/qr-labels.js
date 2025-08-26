import { getCurrentUser, gsoLogout } from '../js/auth.js';
import { fetchWithAuth } from '../js/api.js';
import { createUIManager } from '../js/ui.js';

document.addEventListener('DOMContentLoaded', async () => {
    try {
        const user = await getCurrentUser();
        if (!user) return;

        initializeLayout(user,gsoLogout);
        initializeQrLabelsPage(user);
    } catch (error) {
         console.error("Authentication or layout initialization failed:", error);
    }
});

function initializeQrLabelsPage(user) {
 
    
    const assetTableBody = document.getElementById('asset-selection-table-body');

    const searchInput = document.getElementById('search-input');
    const officeFilter = document.getElementById('office-filter');
    const categoryFilter = document.getElementById('category-filter');
    const printBtn = document.getElementById('print-labels-btn');
    const selectAllCheckbox = document.getElementById('select-all-assets');

     // Early exit if essential elements are missing to prevent runtime errors
    if (!assetTableBody || !officeFilter || !categoryFilter || !printBtn || !selectAllCheckbox) {
        console.error('One or more essential elements for the QR labels page are missing from the DOM.');
        return;
    }

    // --- STATE ---
    const API_ENDPOINT = 'assets';
    let allAssets = [];
    let selectedAssetIds = new Set();
    const { populateFilters, setLoading } = createUIManager();

    // --- UTILITY FUNCTIONS ---
    const formatDate = (dateString) => dateString ? new Date(dateString).toLocaleDateString('en-CA') : 'N/A';
    const formatCurrency = (value) => new Intl.NumberFormat('en-PH', { style: 'currency', currency: 'PHP' }).format(value || 0);

    // --- DATA FETCHING & RENDERING ---
    async function initializePage() {
        setLoading(true, assetTableBody, { colSpan: 4 });
        try {
            const [offices, categories] = await Promise.all([
                fetchWithAuth('offices'),
                fetchWithAuth('categories')
            ]);
            populateFilters({ offices, categories }, { officeFilter, categoryFilter });
            await loadAssets();
        } catch (error) {
            console.error('Failed to initialize page:', error);
            assetTableBody.innerHTML = `<tr><td colspan="4" class="p-4 text-center text-red-500">Error loading initial data.</td></tr>`;
        } finally {
            setLoading(false, assetTableBody);
        }
    }

    async function loadAssets() {
        setLoading(true, assetTableBody, { colSpan: 4 });
        try {
             const params = new URLSearchParams({
                search: searchInput.value,
                office: officeFilter.value,
                category: categoryFilter.value,
                limit: 1000 // Consider adding pagination for very large datasets
            });          
            const data = await fetchWithAuth(`${API_ENDPOINT}?${params}`);
            allAssets = data.docs || (Array.isArray(data) ? data : []);
            renderAssetSelectionTable();
        } catch (error) {
            console.error('Failed to fetch assets:', error);
            assetTableBody.innerHTML = `<tr><td colspan="4" class="p-4 text-center text-red-500">Error loading assets: ${error.message}</td></tr>`;
        } finally {
            setLoading(false, assetTableBody);
        }
    }

    function renderAssetSelectionTable() {
        assetTableBody.innerHTML = '';
        if (allAssets.length === 0) {
            assetTableBody.innerHTML = `<tr><td colspan="4" class="p-4 text-center text-gray-500">No assets found for the selected criteria.</td></tr>`;
            return;
        }

        allAssets.forEach(asset => {
            const tr = document.createElement('tr');
            const isChecked = selectedAssetIds.has(asset._id);
            
            let custodianDisplay = 'N/A';
            if (asset.custodian && asset.custodian.name) {
                custodianDisplay = `
                    <div class="font-medium">${asset.custodian.name}</div>
                    <div class="text-xs opacity-70">${asset.custodian.office || ''}</div>
                `;
            }

            tr.innerHTML = `
                <td><input type="checkbox" class="asset-checkbox checkbox checkbox-sm" data-id="${asset._id}" ${isChecked ? 'checked' : ''}></td>
                <td class="font-mono">${asset.propertyNumber}</td>
                <td>${asset.description}</td>
                <td>${custodianDisplay}</td>
            `;
            assetTableBody.appendChild(tr);
        });
    }

   function handlePrint() {
        if (selectedAssetIds.size === 0) {
            alert('Please select at least one asset to print.');
            return;
        }

        const printContainer = document.getElementById('print-container');
        const labelGrid = document.createElement('div');
        labelGrid.className = 'label-grid-print';

        const assetsToPrint = allAssets.filter(asset => selectedAssetIds.has(asset._id));

        assetsToPrint.forEach(asset => {
            const labelDiv = document.createElement('div');
            labelDiv.className = 'label-print text-center p-2';

            // Generate QR
            const qr = qrcode(0, 'M');
            qr.addData(asset.propertyNumber);
            qr.make();
            const qrImgTag = qr.createImgTag(4, 4);

            const acquisitionDateFormatted = asset.acquisitionDate ?
                new Date(asset.acquisitionDate).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' }) : '';

            const acquisitionCostFormatted = asset.acquisitionCost ?
                new Intl.NumberFormat('en-PH', { style: 'currency', currency: 'PHP' }).format(asset.acquisitionCost) :
                '';

            const slipNumber = asset.assignedPAR || asset.assignedICS || '';

            // Build HTML - **FIXED**: Added closing backtick
            labelDiv.innerHTML = `
                <div class="grid grid-cols-[40%_60%] h-full">
                    <!-- Left column: Full QR -->
                    <div class="flex items-center justify-center p-1">
                        ${qrImgTag}
                    </div>
                    
                    <!-- Right column: Details with watermark -->
                    <div class="relative flex flex-col justify-center p-1 overflow-hidden">
                        <!-- Watermark -->
                        <img src="../LGU-DAET-LOGO.png" alt="Logo Watermark" 
                             class="absolute inset-0 w-full h-full opacity-10 object-contain pointer-events-none">
                        
                        <!-- Foreground content -->
                        <div class="relative text-left z-10">
                            <p class="text-[10px] font-bold uppercase tracking-wide">Property of LGU Daet</p>
                            <p class="text-sm font-bold font-mono">${slipNumber}</p>
                            <p class="text-sm font-bold font-mono">${asset.propertyNumber}</p>
                            <p class="text-[10px] text-gray-800 leading-tight">Description: ${asset.description}</p>
                            <p class="text-[10px] text-gray-800 leading-tight">Acquisition Date: ${acquisitionDateFormatted}</p>
                            <p class="text-[10px] text-gray-800 leading-tight">Acquisition Cost: ${acquisitionCostFormatted}</p>
                            ${asset.custodian ? `<p class="text-[10px] text-gray-800">Property Custodian: ${asset.custodian.name}</p>` : ''}
                        </div>
                    </div>
                </div>
            `;
            labelGrid.appendChild(labelDiv);
        });

        printContainer.innerHTML = '';
        printContainer.appendChild(labelGrid);

        // Wait for all images to load before printing
        const images = printContainer.querySelectorAll('img');
        let loadedImages = 0;
        const totalImages = images.length;

        if (totalImages === 0) {
            window.print();
            return;
        }

        images.forEach(img => {
            img.onload = () => {
                loadedImages++;
                if (loadedImages === totalImages) {
                    setTimeout(() => window.print(), 100); // small delay for rendering
                }
            };
            img.onerror = () => {
                loadedImages++;
                if (loadedImages === totalImages) {
                    setTimeout(() => window.print(), 100);
                }
            };
        });
    }

    if (printBtn) {
        printBtn.addEventListener('click', handlePrint);
    }

    if (selectAllCheckbox) {
        selectAllCheckbox.addEventListener('change', (e) => {
            const checkboxes = document.querySelectorAll('.asset-checkbox');
            checkboxes.forEach(checkbox => {
                checkbox.checked = e.target.checked;
                const assetId = checkbox.dataset.id;
                if (e.target.checked) {
                    selectedAssetIds.add(assetId);
                } else {
                    selectedAssetIds.delete(assetId);
                }
            });
        });
    }

    if (assetTableBody) {
        assetTableBody.addEventListener('change', (e) => {
            if (e.target.classList.contains('asset-checkbox')) {
                const assetId = e.target.dataset.id;
                if (e.target.checked) {
                    selectedAssetIds.add(assetId);
                } else {
                    selectedAssetIds.delete(assetId);
                }
            }
        });
    }

    [searchInput, officeFilter, categoryFilter].forEach(el => {
        if (el) {
            // Use 'change' for select and 'input' for search for better UX
            const eventType = el.tagName === 'SELECT' ? 'change' : 'input';
            el.addEventListener(eventType, loadAssets);
        }
    });
    

    // --- INITIALIZATION ---
    initializePage();
}
