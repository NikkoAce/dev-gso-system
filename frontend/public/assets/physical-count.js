// FILE: frontend/public/physical-count.js
import { getCurrentUser, gsoLogout } from '../js/auth.js';
import { fetchWithAuth } from '../js/api.js';
import { createUIManager } from '../js/ui.js';

document.addEventListener('DOMContentLoaded', async () => {
    try {
        const user = await getCurrentUser();
        if (!user) return;

        // Page-level permission check
        if (!user.permissions || !user.permissions.includes('asset:update')) {
            window.location.href = '../dashboard/dashboard.html';
            return;
        }

        initializeLayout(user, gsoLogout);
        initializePhysicalCountPage(user);
    } catch (error) {
        console.error("Authentication failed on physical count page:", error);
    }
});

function initializePhysicalCountPage(user) {
    let currentPage = 1;
    let totalPages = 1;
    const itemsPerPage = 20;
    const { populateFilters, setLoading, showToast, renderPagination } = createUIManager();

    // --- DOM ELEMENTS ---
    const searchInput = document.getElementById('search-input');
    const officeFilter = document.getElementById('office-filter');
    const verificationFilter = document.getElementById('verification-filter');
    const paginationControls = document.getElementById('pagination-controls');
    const summaryDashboard = document.getElementById('summary-dashboard');
    const tableBody = document.getElementById('physical-count-table-body');
    const verifyAllCheckbox = document.getElementById('verify-all-checkbox');
    const scanAssetBtn = document.getElementById('scan-asset-btn');
    const scannerModal = document.getElementById('scanner-modal');
    const scannerVideo = document.getElementById('scanner-video');
    const scannerCanvas = document.getElementById('scanner-canvas');
    const scannerCtx = scannerCanvas.getContext('2d');
    const closeScannerBtn = document.getElementById('close-scanner-btn');

    let videoStream = null;
    let currentSummary = {};

    // --- DATA FETCHING & RENDERING ---
    async function initializePage() {
        try {
            const offices = await fetchWithAuth('offices');
            populateFilters({ offices }, { officeFilter });
            await loadAssets();
        } catch (error)
        {
            console.error('Failed to initialize page:', error);
            tableBody.innerHTML = `<tr><td colspan="7" class="text-center p-8 text-red-500">Error loading data.</td></tr>`;
        }
    }
    
    function renderSummaryDashboard(summary) {
        if (!summaryDashboard || !summary) {
            summaryDashboard.innerHTML = ''; // Clear if no data
            return;
        }
    
        const { totalOfficeAssets = 0, verifiedCount = 0, missingCount = 0, forRepairCount = 0 } = summary;
        const unverifiedCount = totalOfficeAssets - verifiedCount;
        const verificationPercentage = totalOfficeAssets > 0 ? (verifiedCount / totalOfficeAssets) * 100 : 0;
    
        summaryDashboard.innerHTML = `
            <div class="card bg-base-100 border p-4">
                <div class="text-sm text-base-content/70">Total Assets</div>
                <div class="text-3xl font-bold">${totalOfficeAssets}</div>
            </div>
            <div class="card bg-base-100 border p-4">
                <div class="text-sm text-base-content/70">Verification Progress</div>
                <div class="text-3xl font-bold">${verifiedCount} <span class="text-lg font-normal">/ ${totalOfficeAssets}</span></div>
                <progress class="progress progress-success w-full mt-2" value="${verificationPercentage}" max="100"></progress>
            </div>
            <div class="card bg-base-100 border p-4">
                <div class="text-sm text-base-content/70">Unverified</div>
                <div class="text-3xl font-bold text-warning">${unverifiedCount}</div>
            </div>
            <div class="card bg-base-100 border p-4">
                <div class="text-sm text-base-content/70">Discrepancies Found</div>
                <div class="text-lg font-bold">
                    <span class="text-error">${missingCount}</span> Missing / 
                    <span class="text-accent">${forRepairCount}</span> For Repair
                </div>
            </div>
        `;
    }

    function renderTable(assets, pagination) {
        tableBody.innerHTML = '';
        if (assets.length === 0) {
            tableBody.innerHTML = `<tr><td colspan="7" class="text-center py-8 text-gray-500">No assets found.</td></tr>`;
            renderPagination(paginationControls, { currentPage: 1, totalPages: 0, totalDocs: 0, itemsPerPage });
            return;
        }

        assets.forEach(asset => {
            const tr = document.createElement('tr');
            const isVerified = asset.physicalCountDetails?.verified;
            if (!isVerified) {
                tr.classList.add('unverified-row');
            }
            tr.dataset.propertyNumber = asset.propertyNumber;
            tr.dataset.assetId = asset._id;

            let fullDescription = `<div class="font-medium text-gray-900">${asset.description}</div>`;
            if (asset.specifications && asset.specifications.length > 0) {
                const specsHtml = asset.specifications.map(spec => 
                    `<li><span class="font-semibold">${spec.key}:</span> ${spec.value}</li>`
                ).join('');

                fullDescription += `
                    <div class="collapse collapse-arrow bg-base-200/50 mt-2 rounded-md text-xs">
                        <input type="checkbox" class="min-h-0" /> 
                        <div class="collapse-title min-h-0 py-1 px-3 font-medium">
                            View Specifications
                        </div>
                        <div class="collapse-content px-3">
                            <ul class="mt-1 space-y-1 list-disc list-inside">
                                ${specsHtml}
                            </ul>
                        </div>
                    </div>
                `;
            }

            let custodianDisplay = '';
            if (asset.custodian) {
                custodianDisplay = `
                    <div class="font-medium text-gray-900">${asset.custodian.name}</div>
                    <div class="text-gray-500 text-xs">${asset.custodian.office}</div>
                `;
            }

            const conditionOptions = [
                'Very Good (VG)', 'Good Condition (G)', 'Fair Condition (F)', 
                'Poor Condition (P)', 'Scrap Condition (S)'
            ];

            const statusOptions = [
                'In Use', 'In Storage', 'For Repair', 'Missing', 'Waste', 'Disposed'
            ];

            const conditionSelectHTML = `
                <select class="condition-input select select-bordered select-sm w-full font-normal">
                    <option value="">Select...</option>
                    ${conditionOptions.map(opt => `<option value="${opt}" ${asset.condition === opt ? 'selected' : ''}>${opt}</option>`).join('')}
                </select>
            `;

            const statusSelectHTML = `
                <select class="status-input select select-bordered select-sm w-full font-normal">
                    ${statusOptions.map(opt => `<option value="${opt}" ${asset.status === opt ? 'selected' : ''}>${opt}</option>`).join('')}
                </select>
            `;

            let verificationDetailsHTML = '';
            if (isVerified && asset.physicalCountDetails.verifiedBy) {
                const verifiedDate = new Date(asset.physicalCountDetails.verifiedAt).toLocaleDateString();
                verificationDetailsHTML = `<div class="text-xs text-success mt-1 verification-info">by ${asset.physicalCountDetails.verifiedBy} on ${verifiedDate}</div>`;
            }

            const verifiedCheckboxHTML = `
                <input type="checkbox" class="verify-checkbox checkbox checkbox-success checkbox-sm" ${isVerified ? 'checked' : ''}>
            `;

            tr.innerHTML = `
                <td data-label="Property No." class="font-medium">${asset.propertyNumber}</td>
                <td data-label="Description">${fullDescription}</td>
                <td data-label="Custodian">${custodianDisplay}</td>
                <td data-label="Status">${statusSelectHTML}</td>
                <td data-label="Condition">${conditionSelectHTML}</td>
                <td data-label="Remarks">
                    <input type="text" class="remarks-input input input-bordered input-sm w-full" value="${asset.remarks || ''}">
                </td>
                <td data-label="Verified" class="text-center align-middle">
                    ${verifiedCheckboxHTML}
                    ${verificationDetailsHTML}
                </td>
            `;
            tableBody.appendChild(tr);
        });
        renderPagination(paginationControls, pagination);
        updateVerifyAllCheckboxState();
    }

    async function loadAssets() {
        setLoading(true, tableBody, { colSpan: 7 });
        // Set loading state for dashboard
        summaryDashboard.innerHTML = `
            <div class="card bg-base-100 border p-4 animate-pulse col-span-1 sm:col-span-2 lg:col-span-1"><div class="h-6 bg-gray-200 rounded w-3/4"></div><div class="h-10 bg-gray-200 rounded mt-2 w-1/2"></div></div>
            <div class="card bg-base-100 border p-4 animate-pulse col-span-1 sm:col-span-2 lg:col-span-1"><div class="h-6 bg-gray-200 rounded w-3/4"></div><div class="h-10 bg-gray-200 rounded mt-2 w-1/2"></div></div>
            <div class="card bg-base-100 border p-4 animate-pulse col-span-1 sm:col-span-2 lg:col-span-1"><div class="h-6 bg-gray-200 rounded w-3/4"></div><div class="h-10 bg-gray-200 rounded mt-2 w-1/2"></div></div>
            <div class="card bg-base-100 border p-4 animate-pulse col-span-1 sm:col-span-2 lg:col-span-1"><div class="h-6 bg-gray-200 rounded w-3/4"></div><div class="h-10 bg-gray-200 rounded mt-2 w-1/2"></div></div>
        `;
        try {
            const params = new URLSearchParams({
                page: currentPage,
                limit: itemsPerPage,
                search: searchInput.value,
                office: officeFilter.value,
                verified: verificationFilter.value,
                physicalCount: true, // Tell backend to only get relevant assets
            });
            const data = await fetchWithAuth(`assets?${params}`);

            // Defensive check to handle both paginated (object) and non-paginated (array) responses
            const assets = data?.docs ?? (Array.isArray(data) ? data : []);
            const pagination = data?.docs ? data : { // Fallback for non-paginated responses
                docs: assets,
                totalDocs: assets.length,
                totalPages: Math.ceil(assets.length / itemsPerPage),
                page: currentPage,
                limit: itemsPerPage
            };
            totalPages = pagination.totalPages; // Update total pages from the response
            renderTable(assets, pagination); // This line was missing
            currentSummary = data.summaryStats || {}; // Store the summary
            renderSummaryDashboard(currentSummary);
        } catch (error) {
            console.error('Failed to load assets:', error);
            tableBody.innerHTML = `<tr><td colspan="7" class="text-center p-8 text-red-500">Error loading assets: ${error.message}</td></tr>`;
            summaryDashboard.innerHTML = ''; // Clear dashboard on error
        }
    }

    function updateVerifyAllCheckboxState() {
        const allRowCheckboxes = tableBody.querySelectorAll('.verify-checkbox');
        const checkedCount = tableBody.querySelectorAll('.verify-checkbox:checked').length;

        if (allRowCheckboxes.length === 0) {
            verifyAllCheckbox.checked = false;
            verifyAllCheckbox.indeterminate = false;
            return;
        }

        if (checkedCount === 0) {
            verifyAllCheckbox.checked = false;
            verifyAllCheckbox.indeterminate = false;
        } else if (checkedCount === allRowCheckboxes.length) {
            verifyAllCheckbox.checked = true;
            verifyAllCheckbox.indeterminate = false;
        } else {
            verifyAllCheckbox.checked = false;
            verifyAllCheckbox.indeterminate = true;
        }
    }

    async function handleVerificationChange(checkbox) {
        const row = checkbox.closest('tr');
        if (!row || !row.dataset.assetId) return;

        const assetId = row.dataset.assetId;
        const isVerified = checkbox.checked;

        checkbox.disabled = true;
        const verifiedCell = row.querySelector('[data-label="Verified"]');
        let infoDiv = verifiedCell.querySelector('.verification-info');

        try {
            const updatedDetails = await fetchWithAuth(`assets/${assetId}/verify-physical-count`, {
                method: 'PUT',
                body: JSON.stringify({ verified: isVerified })
            });

            row.classList.toggle('unverified-row', !isVerified);

            if (isVerified && updatedDetails.verifiedBy) {
                if (!infoDiv) {
                    infoDiv = document.createElement('div');
                    infoDiv.className = 'text-xs text-success mt-1 verification-info';
                    verifiedCell.appendChild(infoDiv);
                }
                const verifiedDate = new Date(updatedDetails.verifiedAt).toLocaleDateString();
                infoDiv.textContent = `by ${updatedDetails.verifiedBy} on ${verifiedDate}`;
            } else {
                if (infoDiv) infoDiv.remove();
            }

            // Update summary dashboard in real-time
            if (isVerified) {
                currentSummary.verifiedCount++;
            } else {
                currentSummary.verifiedCount--;
            }
            renderSummaryDashboard(currentSummary);
        } catch (error) {
            showToast(`Error updating verification: ${error.message}`, 'error');
            checkbox.checked = !isVerified; // Revert on error
            row.classList.toggle('unverified-row', !isVerified); // Revert highlight on error
        } finally {
            checkbox.disabled = false;
        }
    }

    // --- SCANNER LOGIC ---
    async function startScanner() {
        if (videoStream) {
            stopScanner();
            return;
        }
        try {
            videoStream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: "environment" } });
            scannerVideo.srcObject = videoStream;
            scannerVideo.setAttribute("playsinline", true); // Required for iOS
            await scannerVideo.play();
            requestAnimationFrame(tick);
            scannerModal.showModal();
            scanAssetBtn.innerHTML = `<i data-lucide="camera-off"></i> Stop Scan`;
            lucide.createIcons();
        } catch (err) {
            console.error("Camera access error:", err);
            showToast("Could not access camera. Please grant permission.", 'error');
        }
    }

    function stopScanner() {
        if (videoStream) {
            videoStream.getTracks().forEach(track => track.stop());
        }
        videoStream = null;
        scannerModal.close();
        scanAssetBtn.innerHTML = `<i data-lucide="camera"></i> Scan Asset`;
        lucide.createIcons();
    }

    function tick() {
        if (videoStream && scannerVideo.readyState === scannerVideo.HAVE_ENOUGH_DATA) {
            scannerCanvas.height = scannerVideo.videoHeight;
            scannerCanvas.width = scannerVideo.videoWidth;
            scannerCtx.drawImage(scannerVideo, 0, 0, scannerCanvas.width, scannerCanvas.height);
            const imageData = scannerCtx.getImageData(0, 0, scannerCanvas.width, scannerCanvas.height);
            const code = jsQR(imageData.data, imageData.width, imageData.height, { inversionAttempts: "dontInvert" });

            if (code) {
                handleScannedCode(code.data);
            }
        }
        if (videoStream) {
            requestAnimationFrame(tick);
        }
    }

    async function handleScannedCode(propertyNumber) {
        stopScanner(); // Stop scanning immediately after a code is found
        const row = tableBody.querySelector(`tr[data-property-number="${propertyNumber}"]`);

        if (!row) {
            showToast(`Asset ${propertyNumber} not found on this page.`, 'warning');
            return;
        }

        const checkbox = row.querySelector('.verify-checkbox');
        if (checkbox && !checkbox.checked) {
            const audioContext = new (window.AudioContext || window.webkitAudioContext)();
            const oscillator = audioContext.createOscillator();
            oscillator.type = 'sine';
            oscillator.frequency.setValueAtTime(800, audioContext.currentTime);
            oscillator.connect(audioContext.destination);
            oscillator.start();
            oscillator.stop(audioContext.currentTime + 0.1);

            checkbox.checked = true;
            await handleVerificationChange(checkbox);
            updateVerifyAllCheckboxState();
        }

        row.scrollIntoView({ behavior: 'smooth', block: 'center' });
        showToast(`Asset ${propertyNumber} located and verified.`, 'success');
    }

    // --- EVENT LISTENERS ---
    [searchInput, officeFilter, verificationFilter].forEach(el => {
        el.addEventListener('input', () => {
            currentPage = 1;
            loadAssets();
        });
    });

    paginationControls.addEventListener('click', (e) => {
        const target = e.target.closest('button');
        if (!target) return;

        if (target.id === 'prev-page-btn' && currentPage > 1) {
            currentPage--;
            loadAssets();
        } else if (target.id === 'next-page-btn' && currentPage < totalPages) {
            currentPage++;
            loadAssets();
        } else if (target.classList.contains('page-btn')) {
            const page = parseInt(target.dataset.page, 10);
            if (page !== currentPage) {
                currentPage = page;
                loadAssets();
            }
        }
    });

    tableBody.addEventListener('change', async(e) => {
        if (e.target.classList.contains('verify-checkbox')) {
            await handleVerificationChange(e.target);
            updateVerifyAllCheckboxState();
        }
    });

    verifyAllCheckbox.addEventListener('change', async (e) => {
        const isChecked = e.target.checked;
        const allRowCheckboxes = Array.from(tableBody.querySelectorAll('.verify-checkbox'));

        verifyAllCheckbox.disabled = true;

        const promises = allRowCheckboxes
            .filter(checkbox => checkbox.checked !== isChecked)
            .map(checkbox => {
                checkbox.checked = isChecked;
                return handleVerificationChange(checkbox);
            });

        await Promise.all(promises);

        verifyAllCheckbox.disabled = false;
        updateVerifyAllCheckboxState();
    });

    scanAssetBtn.addEventListener('click', startScanner);
    closeScannerBtn.addEventListener('click', stopScanner);

    document.getElementById('save-count-btn').addEventListener('click', async () => {
        const updates = [];
        const rows = document.querySelectorAll('#physical-count-table-body tr');
        
        rows.forEach(row => {
            if(row.dataset.assetId) {
                const id = row.dataset.assetId;
                const status = row.querySelector('.status-input').value;
                const condition = row.querySelector('.condition-input').value;
                const remarks = row.querySelector('.remarks-input').value;
                updates.push({ id, status, condition, remarks });
            }
        });

        if (updates.length === 0) {
            showToast('No assets to update.', 'warning');
            return;
        }

        try {
            await fetchWithAuth('assets/physical-count', {
                method: 'PUT',
                body: JSON.stringify({
                    updates: updates,
                    user: { name: user.name }
                })
            });

            showToast('Physical count data saved successfully!', 'success');
            await loadAssets(); // Re-fetch current page data
        } catch (error) {
            showToast(`Error: ${error.message}`, 'error');
        }
    });

    // --- INITIALIZATION ---
    initializePage();
    
}
