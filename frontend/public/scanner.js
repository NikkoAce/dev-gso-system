// FILE: frontend/public/scanner.js
import { fetchWithAuth } from './api.js';

document.addEventListener('DOMContentLoaded', async () => {
    try {
        const user = await getCurrentUser();
        if (!user) return;

        initializeLayout(user);
        initializeScannerPage(user);
    } catch (error) {
        console.error("Authentication failed on scanner page:", error);
    }
});

function initializeScannerPage(currentUser) {
    const API_ENDPOINT = 'assets';
    let allAssets = [];
    let foundAssets = new Map(); // Use a Map to store propertyNumber -> { condition, remarks }
    let videoStream = null;

    const startScanBtn = document.getElementById('start-scan-btn');
    const saveScanBtn = document.getElementById('save-scan-btn');
    const scannerContainer = document.getElementById('scanner-container');
    const video = document.getElementById('scanner-video');
    const canvas = document.getElementById('scanner-canvas');
    const ctx = canvas.getContext('2d');
    const assetList = document.getElementById('scanner-asset-list');
    const foundCountEl = document.getElementById('found-count');
    const totalCountEl = document.getElementById('total-count');

    // --- DATA FETCHING & RENDERING ---
    async function fetchAndRenderAssets() {
        try {
            allAssets = await fetchWithAuth(API_ENDPOINT);
            renderAssetList();
        } catch (error) {
            console.error('Failed to fetch assets:', error);
            assetList.innerHTML = `<li class="p-4 text-red-500">Error loading assets.</li>`;
        }
    }

    function renderAssetList() {
        assetList.innerHTML = '';
        totalCountEl.textContent = allAssets.length;
        foundCountEl.textContent = foundAssets.size;

        if (allAssets.length === 0) {
            assetList.innerHTML = `<tr><td colspan="2" class="p-4 text-center text-base-content/70">No assets found.</td></tr>`;
            return;
        }

        allAssets.forEach(asset => {
            const isFound = foundAssets.has(asset.propertyNumber);
            const tr = document.createElement('tr');
            tr.id = `asset-${asset.propertyNumber}`;
            tr.className = isFound ? 'active' : ''; // DaisyUI active class for highlight
            
            const conditionOptions = [
                'Very Good (VG)', 'Good Condition (G)', 'Fair Condition (F)', 
                'Poor Condition (P)', 'Scrap Condition (S)'
            ];
            
            let controlsHTML = `<i data-lucide="circle" class="text-base-content/40"></i>`;
            if (isFound) {
                const foundData = foundAssets.get(asset.propertyNumber);
                const conditionSelect = `
                    <select class="condition-select select select-bordered select-sm w-full max-w-xs font-normal" data-property-number="${asset.propertyNumber}">
                        ${conditionOptions.map(opt => `<option value="${opt}" ${foundData.condition === opt ? 'selected' : ''}>${opt}</option>`).join('')}
                    </select>
                `;
                const remarksInput = `
                    <input type="text" placeholder="Add remarks..." class="remarks-input input input-bordered input-sm w-full max-w-xs" data-property-number="${asset.propertyNumber}" value="${foundData.remarks || ''}">
                `;
                controlsHTML = `<div class="flex flex-col gap-2">${conditionSelect}${remarksInput}</div>`;
            }

            tr.innerHTML = `
                <td>
                    <p class="font-medium">${asset.propertyNumber}</p>
                    <p class="text-sm text-base-content/70">${asset.description}</p>
                </td>
                <td class="status-controls w-48">
                    ${controlsHTML}
                </td>
            `;
            assetList.appendChild(tr);
        });
        lucide.createIcons();
    }

    // --- SCANNER LOGIC ---
    function tick() {
        if (video.readyState === video.HAVE_ENOUGH_DATA) {
            canvas.height = video.videoHeight;
            canvas.width = video.videoWidth;
            ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
            const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
            const code = jsQR(imageData.data, imageData.width, imageData.height, {
                inversionAttempts: "dontInvert",
            });

            if (code) {
                handleScannedCode(code.data);
            }
        }
        if (videoStream) {
            requestAnimationFrame(tick);
        }
    }

    function handleScannedCode(propertyNumber) {
        if (!foundAssets.has(propertyNumber)) {
            const assetExists = allAssets.some(a => a.propertyNumber === propertyNumber);
            if (assetExists) {
                // Set a default condition when first scanned
                foundAssets.set(propertyNumber, {
                    condition: 'Very Good (VG)',
                    remarks: ''
                });
                renderAssetList(); // Re-render the whole list to show the dropdown
                
                const audioContext = new (window.AudioContext || window.webkitAudioContext)();
                const oscillator = audioContext.createOscillator();
                oscillator.type = 'sine';
                oscillator.frequency.setValueAtTime(800, audioContext.currentTime);
                oscillator.connect(audioContext.destination);
                oscillator.start();
                oscillator.stop(audioContext.currentTime + 0.1);
            }
        }
    }

    // --- EVENT LISTENERS ---
    if (startScanBtn) {
        startScanBtn.addEventListener('click', async () => {
            if (videoStream) {
                videoStream.getTracks().forEach(track => track.stop());
                videoStream = null;
                scannerContainer.classList.add('hidden');
                startScanBtn.innerHTML = `<i data-lucide="camera"></i> Start Scan`;
                lucide.createIcons();
                return;
            }

            try {
                videoStream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: "environment" } });
                video.srcObject = videoStream;
                video.setAttribute("playsinline", true);
                video.play();
                requestAnimationFrame(tick);
                scannerContainer.classList.remove('hidden');
                startScanBtn.innerHTML = `<i data-lucide="camera-off"></i> Stop Scan`;
                lucide.createIcons();
            } catch (err) {
                console.error("Camera access error:", err);
                alert("Could not access the camera. Please ensure you have a camera connected and have granted permission.");
            }
        });
    }

    if (saveScanBtn) {
        saveScanBtn.addEventListener('click', async () => {
            if (foundAssets.size === 0) {
                alert('No assets have been scanned yet.');
                return;
            }

            const today = new Date().toLocaleDateString('en-CA');
            const updates = [];
            
            foundAssets.forEach((data, propertyNumber) => {
                const asset = allAssets.find(a => a.propertyNumber === propertyNumber);
                if (asset) {
                    updates.push({
                        id: asset._id,
                        condition: data.condition,
                        remarks: data.remarks || `Verified via scanner on ${today}`
                    });
                }
            });

            try {
                await fetchWithAuth('assets/physical-count', {
                    method: 'PUT',
                    body: JSON.stringify({
                        updates: updates,
                        user: { name: currentUser.name }
                    })
                });

                alert('Scan results saved successfully!');
                foundAssets.clear();
                renderAssetList();

            } catch (error) {
                alert(`Error: ${error.message}`);
            }
        });
    }

    assetList.addEventListener('change', (e) => {
        if (e.target.classList.contains('condition-select')) {
            const propertyNumber = e.target.dataset.propertyNumber;
            const newCondition = e.target.value;
            if (foundAssets.has(propertyNumber)) {
                foundAssets.get(propertyNumber).condition = newCondition;
            }
        } else if (e.target.classList.contains('remarks-input')) {
            const propertyNumber = e.target.dataset.propertyNumber;
            const newRemarks = e.target.value;
            if (foundAssets.has(propertyNumber)) {
                foundAssets.get(propertyNumber).remarks = newRemarks;
            }
        }
    });

    // --- INITIALIZATION ---
    fetchAndRenderAssets();
}
