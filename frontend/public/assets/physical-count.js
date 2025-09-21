// FILE: frontend/public/physical-count.js
import { getGsoToken } from '../js/auth.js';
import { fetchWithAuth, API_ROOT_URL } from '../js/api.js';
import { createUIManager } from '../js/ui.js';
import { createAuthenticatedPage } from '../js/page-loader.js';

createAuthenticatedPage({
    permission: 'asset:update',
    pageInitializer: initializePhysicalCountPage,
    pageName: 'Physical Count'
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
    const verifyVisibleBtn = document.getElementById('verify-visible-btn');
    const scanAssetBtn = document.getElementById('scan-asset-btn');
    const exportResultsBtn = document.getElementById('export-results-btn');
    const scannerModal = document.getElementById('scanner-modal');
    const scannerVideo = document.getElementById('scanner-video');
    const scannerCanvas = document.getElementById('scanner-canvas');
    const scannerCtx = scannerCanvas.getContext('2d');
    const closeScannerBtn = document.getElementById('close-scanner-btn');
    const continuousScanToggle = document.getElementById('continuous-scan-toggle');

    let videoStream = null;
    let currentSummary = {};
    let socket;
    let currentOfficeRoom = '';

    // --- DATA FETCHING & RENDERING ---
    async function initializePage() {
        try {
            const offices = await fetchWithAuth('offices');
            populateFilters({ offices }, { officeFilter });
            await loadAssets();

            // Initialize Socket.IO connection
            socket = io(API_ROOT_URL, {
                auth: { token: getGsoToken() }
            });
            setupSocketListeners();

        } catch (error)
        {
            console.error('Failed to initialize page:', error);
            tableBody.innerHTML = `<tr><td colspan="6" class="text-center p-8 text-red-500">Error loading data.</td></tr>`;
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
            tableBody.innerHTML = `<tr><td colspan="6" class="text-center py-8 text-gray-500">No assets found.</td></tr>`;
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
                <select class="condition-input select select-bordered select-sm flex-1 font-normal">
                    <option value="">Select...</option>
                    ${conditionOptions.map(opt => `<option value="${opt}" ${asset.condition === opt ? 'selected' : ''}>${opt}</option>`).join('')}
                </select>
            `;

            const statusSelectHTML = `
                <select class="status-input select select-bordered select-sm flex-1 font-normal">
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
                <td data-label="Status / Condition"> 
                    <div class="flex flex-row gap-2">
                        ${statusSelectHTML}
                        ${conditionSelectHTML}
                    </div>
                </td>
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
        setLoading(true, tableBody, { colSpan: 6 });
        const office = officeFilter.value;

        // Set loading state for dashboard
        if (office) {
            summaryDashboard.innerHTML = `
                <div class="card bg-base-100 border p-4 animate-pulse col-span-1 sm:col-span-2 lg:col-span-1"><div class="h-6 bg-gray-200 rounded w-3/4"></div><div class="h-10 bg-gray-200 rounded mt-2 w-1/2"></div></div>
                <div class="card bg-base-100 border p-4 animate-pulse col-span-1 sm:col-span-2 lg:col-span-1"><div class="h-6 bg-gray-200 rounded w-3/4"></div><div class="h-10 bg-gray-200 rounded mt-2 w-1/2"></div></div>
                <div class="card bg-base-100 border p-4 animate-pulse col-span-1 sm:col-span-2 lg:col-span-1"><div class="h-6 bg-gray-200 rounded w-3/4"></div><div class="h-10 bg-gray-200 rounded mt-2 w-1/2"></div></div>
                <div class="card bg-base-100 border p-4 animate-pulse col-span-1 sm:col-span-2 lg:col-span-1"><div class="h-6 bg-gray-200 rounded w-3/4"></div><div class="h-10 bg-gray-200 rounded mt-2 w-1/2"></div></div>
            `;
        } else {
            summaryDashboard.innerHTML = `
                <div class="card bg-base-100 border p-4 col-span-full text-center text-base-content/70">
                    Please select an office to view the physical count summary.
                </div>
            `;
        }

        try {
            const params = new URLSearchParams({
                page: currentPage,
                limit: itemsPerPage,
                search: searchInput.value,
                office: office,
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
            renderTable(assets, pagination);

            if (office && data.summaryStats) {
                currentSummary = data.summaryStats;
                renderSummaryDashboard(currentSummary);
            } else if (office) {
                summaryDashboard.innerHTML = `
                    <div class="card bg-base-100 border p-4 col-span-full text-center text-base-content/70">
                        No assets found for the selected office.
                    </div>
                `;
            }
        } catch (error) {
            console.error('Failed to load assets:', error);
            tableBody.innerHTML = `<tr><td colspan="6" class="text-center p-8 text-red-500">Error loading assets: ${error.message}</td></tr>`;
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

    async function handleVerifyVisible() {
        const itemRows = tableBody.querySelectorAll('tr[data-asset-id]');
        if (itemRows.length === 0) {
            showToast('No items visible to verify.', 'info');
            return;
        }

        verifyVisibleBtn.disabled = true;
        verifyVisibleBtn.innerHTML = `<span class="loading loading-spinner loading-xs"></span>`;

        const checkboxesToVerify = Array.from(itemRows)
            .map(row => row.querySelector('.verify-checkbox'))
            .filter(checkbox => checkbox && !checkbox.checked);

        if (checkboxesToVerify.length === 0) {
            showToast('All visible items are already verified.', 'success');
        } else {
            const verificationPromises = checkboxesToVerify.map(checkbox => {
                checkbox.checked = true;
                return handleVerificationChange(checkbox);
            });

            try {
                await Promise.all(verificationPromises);
                showToast(`${checkboxesToVerify.length} item(s) verified.`, 'success');
            } catch (error) {
                showToast('An error occurred while verifying items.', 'error');
            }
        }

        // Reset button state regardless of outcome
        verifyVisibleBtn.disabled = false;
        verifyVisibleBtn.innerHTML = `<i data-lucide="check-check"></i><span class="text-xs font-normal">Visible</span>`;
        lucide.createIcons({ nodes: [verifyVisibleBtn.querySelector('i')] });
        updateVerifyAllCheckboxState(); // Update the main checkbox state after all are done
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
            // The UI update is now handled by the socket listener to ensure real-time sync
            await fetchWithAuth(`physical-count/${assetId}/verify`, {
                method: 'PUT',
                body: JSON.stringify({ verified: isVerified })
            });
        } catch (error) {
            showToast(`Error updating verification: ${error.message}`, 'error');
            checkbox.checked = !isVerified; // Revert checkbox on API error
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

    // --- NEW SCANNER LOGIC WITH CONTINUOUS MODE ---

    function playFeedbackSound(isSuccess = true) {
        try {
            const audioContext = new (window.AudioContext || window.webkitAudioContext)();
            if (!audioContext) return;
            const oscillator = audioContext.createOscillator();
            const gainNode = audioContext.createGain();
            oscillator.connect(gainNode);
            gainNode.connect(audioContext.destination);

            if (isSuccess) {
                oscillator.type = 'sine';
                oscillator.frequency.setValueAtTime(800, audioContext.currentTime);
                gainNode.gain.setValueAtTime(0.1, audioContext.currentTime);
            } else {
                oscillator.type = 'square';
                oscillator.frequency.setValueAtTime(200, audioContext.currentTime);
                gainNode.gain.setValueAtTime(0.05, audioContext.currentTime);
            }
            oscillator.start();
            oscillator.stop(audioContext.currentTime + 0.1);
        } catch (e) {
            console.warn("Could not play feedback sound.", e);
        }
    }

    function showScannerFeedback(message, type = 'success') {
        const scannerContainer = document.getElementById('scanner-container');
        if (!scannerContainer) return;

        const existingFeedback = scannerContainer.querySelector('.scanner-feedback-overlay');
        if (existingFeedback) existingFeedback.remove();

        const feedbackDiv = document.createElement('div');
        feedbackDiv.className = `scanner-feedback-overlay absolute inset-0 flex items-center justify-center text-white font-bold text-2xl bg-black bg-opacity-50`;
        feedbackDiv.textContent = message;

        let borderColorClass = 'border-green-500';
        if (type === 'error') borderColorClass = 'border-red-500';
        else if (type === 'warning') borderColorClass = 'border-yellow-500';

        const borderDiv = scannerContainer.querySelector('.border-dashed');
        if (borderDiv) {
            borderDiv.classList.remove('border-green-500', 'border-red-500', 'border-yellow-500');
            borderDiv.classList.add(borderColorClass);
        }
        scannerContainer.appendChild(feedbackDiv);

        setTimeout(() => {
            feedbackDiv.remove();
            if (borderDiv) {
                borderDiv.classList.remove(borderColorClass);
                borderDiv.classList.add('border-green-500'); // Reset to default
            }
        }, 700);
    }

    function tick() {
        if (videoStream && scannerVideo.readyState === scannerVideo.HAVE_ENOUGH_DATA) {
            scannerCanvas.height = scannerVideo.videoHeight;
            scannerCanvas.width = scannerVideo.videoWidth;
            scannerCtx.drawImage(scannerVideo, 0, 0, scannerCanvas.width, scannerCanvas.height);
            const imageData = scannerCtx.getImageData(0, 0, scannerCanvas.width, scannerCanvas.height);
            const code = jsQR(imageData.data, imageData.width, imageData.height, { inversionAttempts: "dontInvert" });

            // Only process a new code if the video is not paused (i.e., not in the middle of handling a previous scan)
            if (code && !scannerVideo.paused) {
                handleScannedCode(code.data);
            }
        }
        if (videoStream) {
            requestAnimationFrame(tick);
        }
    }

    async function handleScannedCode(propertyNumber) {
        const isContinuous = continuousScanToggle.checked;

        if (isContinuous) {
            scannerVideo.pause();
        } else {
            stopScanner();
        }

        const row = tableBody.querySelector(`tr[data-property-number="${propertyNumber}"]`);

        if (!row) {
            playFeedbackSound(false);
            showScannerFeedback('Not Found', 'error');
            try {
                const asset = await fetchWithAuth(`physical-count/by-property-number/${propertyNumber}`);
                if (asset && asset.custodian && asset.custodian.office) {
                    showToast(`Asset ${propertyNumber} belongs to ${asset.custodian.office}. Please switch to that office to verify.`, 'error');
                } else {
                    showToast(`Asset ${propertyNumber} found, but has no assigned office.`, 'warning');
                }
            } catch (error) {
                showToast(`Asset with Property No. ${propertyNumber} does not exist in the system.`, 'error');
            }
            if (isContinuous) {
                setTimeout(() => scannerVideo.play(), 700); // Resume after feedback
            }
            return;
        }

        const checkbox = row.querySelector('.verify-checkbox');
        if (checkbox && !checkbox.checked) {
            playFeedbackSound(true);
            showScannerFeedback('Verified!', 'success');
            checkbox.checked = true;
            await handleVerificationChange(checkbox);
            updateVerifyAllCheckboxState();
        } else if (checkbox && checkbox.checked) {
            playFeedbackSound(false);
            showScannerFeedback('Already Verified', 'warning');
        }

        if (isContinuous) {
            setTimeout(() => scannerVideo.play(), 700); // Resume after feedback
        } else {
            row.scrollIntoView({ behavior: 'smooth', block: 'center' });
            showToast(`Asset ${propertyNumber} located and verified.`, 'success');
        }
    }

    // --- SOCKET.IO LOGIC ---
    function setupSocketListeners() {
        socket.on('connect', () => {
            console.log('Connected to WebSocket server.');
            // If an office is already selected on load, join its room
            if (officeFilter.value) {
                currentOfficeRoom = `office:${officeFilter.value}`;
                socket.emit('join-room', currentOfficeRoom);
            }
        });

        socket.on('asset-verified', (updatedAsset) => {
            const row = tableBody.querySelector(`tr[data-asset-id="${updatedAsset._id}"]`);
            if (!row) return; // Asset not on current page

            // --- ADD FLASH EFFECT ---
            row.classList.add('flash-success');
            setTimeout(() => {
                row.classList.remove('flash-success');
            }, 1000); // Flash for 1 second

            const checkbox = row.querySelector('.verify-checkbox');
            const wasVerified = checkbox.checked;
            const isNowVerified = updatedAsset.physicalCountDetails.verified;

            // Update summary dashboard based on the change
            if (isNowVerified && !wasVerified) {
                currentSummary.verifiedCount++;
            } else if (!isNowVerified && wasVerified) {
                currentSummary.verifiedCount--;
            }
            renderSummaryDashboard(currentSummary);

            // Update the row's UI
            checkbox.checked = isNowVerified;
            row.classList.toggle('unverified-row', !isNowVerified);

            const verifiedCell = row.querySelector('[data-label="Verified"]');
            let infoDiv = verifiedCell.querySelector('.verification-info');

            if (isNowVerified && updatedAsset.physicalCountDetails.verifiedBy) {
                if (!infoDiv) {
                    infoDiv = document.createElement('div');
                    infoDiv.className = 'text-xs text-success mt-1 verification-info';
                    verifiedCell.appendChild(infoDiv);
                }
                const verifiedDate = new Date(updatedAsset.physicalCountDetails.verifiedAt).toLocaleDateString();
                infoDiv.textContent = `by ${updatedAsset.physicalCountDetails.verifiedBy} on ${verifiedDate}`;
            } else {
                if (infoDiv) infoDiv.remove();
            }
            updateVerifyAllCheckboxState();
        });

        socket.on('asset-updated', (updatedAsset) => {
            const row = tableBody.querySelector(`tr[data-asset-id="${updatedAsset._id}"]`);
            if (!row) return;

            // --- ADD FLASH EFFECT ---
            row.classList.add('flash-update');
            setTimeout(() => {
                row.classList.remove('flash-update');
            }, 1000);

            const statusInput = row.querySelector('.status-input');
            const oldStatus = statusInput.value;
            const newStatus = updatedAsset.status;

            // Update summary dashboard if status changed
            if (oldStatus !== newStatus) {
                if (oldStatus === 'Missing') currentSummary.missingCount--;
                if (oldStatus === 'For Repair') currentSummary.forRepairCount--;
                if (newStatus === 'Missing') currentSummary.missingCount++;
                if (newStatus === 'For Repair') currentSummary.forRepairCount++;
                renderSummaryDashboard(currentSummary);
            }

            statusInput.value = newStatus;
            row.querySelector('.condition-input').value = updatedAsset.condition || '';
            row.querySelector('.remarks-input').value = updatedAsset.remarks || '';
        });

        socket.on('connect_error', (err) => {
            console.error('WebSocket connection error:', err.message);
            showToast('Real-time connection failed. Please refresh.', 'error');
        });
    }

    // --- EXPORT LOGIC ---
    async function exportResults() {
        const office = officeFilter.value;
        if (!office) {
            showToast('Please select an office to export results.', 'warning');
            return;
        }

        exportResultsBtn.disabled = true;
        exportResultsBtn.innerHTML = `<span class="loading loading-spinner loading-xs"></span> Exporting...`;
        lucide.createIcons();

        try {
            const params = new URLSearchParams({ office });
            // We can add other filters if needed, but office is the primary one.
            
            // The endpoint will stream a CSV file, so we handle it as a blob.
            const response = await fetch(`${API_ROOT_URL}/api/physical-count/export?${params}`, {
                headers: { 'Authorization': `Bearer ${getGsoToken()}` }
            });

            if (!response.ok) {
                let errorMessage = `Failed to export data. Status: ${response.status}`;
                try {
                    // Try to parse as JSON first, as that's the expected error format from our API
                    const errorData = await response.json();
                    errorMessage = errorData.message || errorMessage;
                } catch (e) {
                    // If JSON parsing fails, it might be a plain text or HTML error from a proxy/server
                    errorMessage = (await response.text()) || errorMessage;
                }
                throw new Error(errorMessage);
            }

            const blob = await response.blob();
            const url = window.URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.style.display = 'none';
            a.href = url;
            a.download = `physical_count_results_${office.replace(/\s+/g, '_')}.csv`;
            document.body.appendChild(a);
            a.click();
            window.URL.revokeObjectURL(url);
            a.remove();

        } catch (error) {
            showToast(`Export failed: ${error.message}`, 'error');
        } finally {
            exportResultsBtn.disabled = false;
            exportResultsBtn.innerHTML = `<i data-lucide="download"></i> Export Results`;
            lucide.createIcons();
        }
    }

    // --- EVENT LISTENERS ---
    [searchInput, officeFilter, verificationFilter].forEach(el => {
        el.addEventListener('input', () => {
            if (el.id === 'office-filter') {
                if (currentOfficeRoom) {
                    socket.emit('leave-room', currentOfficeRoom);
                }
                const newOffice = officeFilter.value;
                if (newOffice) {
                    currentOfficeRoom = `office:${newOffice}`;
                    socket.emit('join-room', currentOfficeRoom);
                } else {
                    currentOfficeRoom = '';
                }
            }
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

    verifyVisibleBtn.addEventListener('click', handleVerifyVisible);

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
    exportResultsBtn.addEventListener('click', exportResults);

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
            await fetchWithAuth('physical-count', {
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
