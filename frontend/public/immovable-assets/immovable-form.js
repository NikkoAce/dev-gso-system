// FILE: frontend/public/immovable-assets/immovable-form.js
import { fetchWithAuth } from '../js/api.js';
import { createUIManager, formatNumberOnInput, renderHistory, renderAttachments, renderNewAttachmentRow, renderRepairRow } from '../js/ui.js';
import { createAuthenticatedPage } from '../js/page-loader.js';
import { area as turfArea, length as turfLength } from 'https://cdn.jsdelivr.net/npm/@turf/turf@6.5.0/+esm';

createAuthenticatedPage({
    // A user can access this form if they can either create OR update immovable assets.
    permission: ['immovable:create', 'immovable:update'],
    pageInitializer: initializeForm,
    pageName: 'Immovable Asset Form'
});

function initializeForm(user) {
    const API_ENDPOINT = 'immovable-assets';
    const { showToast } = createUIManager();

    // --- STATE ---
    const urlParams = new URLSearchParams(window.location.search);
    const assetId = urlParams.get('id');
    const isEditMode = !!assetId;

    // --- DOM ELEMENTS ---
    const form = document.getElementById('asset-form');
    const formTitle = document.getElementById('form-title');
    const submitButton = document.getElementById('submit-button');
    const typeSelect = document.getElementById('type');
    const componentsContainer = document.getElementById('components-container');
    const addComponentBtn = document.getElementById('add-component-btn');
    const formTabs = document.getElementById('form-tabs');
    const detailsTab = document.getElementById('details-tab');
    const improvementsTab = document.getElementById('improvements-tab');
    const repairsTab = document.getElementById('repairs-tab');
    const historyTab = document.getElementById('history-tab');
    const detailsPanel = document.getElementById('details-panel');
    const improvementsPanel = document.getElementById('improvements-panel');
    const repairsPanel = document.getElementById('repairs-panel');
    const historyPanel = document.getElementById('history-panel');
    const historyContainer = document.getElementById('history-container');
    const addAttachmentBtn = document.getElementById('add-attachment-btn');
    const newAttachmentsContainer = document.getElementById('new-attachments-container');
    const existingAttachmentsContainer = document.getElementById('existing-attachments-container');
    const existingAttachmentsList = document.getElementById('existing-attachments-list');
    const repairsContainer = document.getElementById('repairs-container');
    const repairForm = document.getElementById('repair-form');
    const improvementsContainer = document.getElementById('improvements-container');
    const improvementForm = document.getElementById('improvement-form');
    // --- NEW: GIS Elements ---
    const assessedValueInput = document.getElementById('assessedValue');
    const totalBookValueInput = document.getElementById('totalBookValue');
    const buildingSalvageValueInput = document.getElementById('salvageValue');
    const impairmentLossesInput = document.getElementById('impairmentLosses');
    const newRepairAmountInput = document.getElementById('new-repair-amount');
    const childAssetsSection = document.getElementById('child-assets-section');
    const childAssetsList = document.getElementById('child-assets-list');
    const parentAssetSelect = document.getElementById('parentAsset');
    const mapContainer = document.getElementById('map');
    const latitudeInput = document.getElementById('latitude');
    const longitudeInput = document.getElementById('longitude');
    // NEW: Measurement display elements
    const measurementDisplay = document.getElementById('measurement-display');
    const measurementValue = document.getElementById('measurement-value');
    const measurementUnit = document.getElementById('measurement-unit');
    const newImprovementCostInput = document.getElementById('new-improvement-cost');

    const detailSections = {
        'Land': document.getElementById('land-details-section'),
        'Building': document.getElementById('building-details-section'),
        'Other Structures': document.getElementById('building-details-section'), // Uses the same form as Building
        'Road Network': document.getElementById('road-details-section'),
        'Other Public Infrastructure': document.getElementById('infra-details-section'),
    };

    // --- NEW: GIS LOGIC ---
    let map = null;
    let marker = null;
    let assetGeometry = null; // To store GeoJSON geometry
    let drawnItems = null; // To hold the feature group for drawing

    function calculateAndDisplayMeasurement(layer) {
        if (!layer) {
            measurementDisplay.classList.add('hidden');
            return;
        }

        const geojson = layer.toGeoJSON();
        let value = 0;
        let unit = '';
        let formattedValue = '';

        if (geojson.geometry.type === 'Polygon') {
            value = turfArea(geojson); // Area in square meters
            if (value > 10000) { // If larger than 1 hectare
                formattedValue = (value / 10000).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 4 });
                unit = 'hectares';
            } else {
                formattedValue = value.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });
                unit = 'sq. meters';
            }
        } else if (geojson.geometry.type === 'LineString') {
            value = turfLength(geojson, { units: 'kilometers' }); // Length in kilometers
            formattedValue = value.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 3 });
            unit = 'km';
        }

        if (unit) {
            measurementValue.textContent = formattedValue;
            measurementUnit.textContent = unit;
            measurementDisplay.classList.remove('hidden');
        } else {
            // Hide for markers or other types
            measurementDisplay.classList.add('hidden');
        }
    }

    function initializeMap(lat = 14.1155, lng = 122.9550) {
        if (map) return; // Already initialized

        // 1. Define Base Layers
        const osmLayer = L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
            attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
        });

        const satelliteLayer = L.tileLayer('https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}', {
            attribution: 'Tiles &copy; Esri'
        });

        const topoLayer = L.tileLayer('https://{s}.tile.opentopomap.org/{z}/{x}/{y}.png', {
            attribution: 'Map data: &copy; <a href="https://opentopomap.org">OpenTopoMap</a>'
        });

        const baseLayers = {
            "Street": osmLayer,
            "Satellite": satelliteLayer,
            "Topographic": topoLayer
        };

        // NEW: Define Overlay Layers container
        const overlayMaps = {};

        // NEW: Add a feature group for drawn items
        drawnItems = new L.FeatureGroup();


        // 2. Initialize Map
        map = L.map(mapContainer, {
            center: [lat, lng],
            zoom: 14,
            layers: [osmLayer]
        });

        map.addLayer(drawnItems);

        // NEW: Asynchronously load and add overlay layers
        const addOverlayLayers = async () => {
            try {
                const floodHazardResponse = await fetch('../gis-data/flood_hazard.geojson');
                if (floodHazardResponse.ok) {
                    const floodHazardData = await floodHazardResponse.json();
                    const floodHazardLayer = L.geoJSON(floodHazardData, {
                        style: function (feature) {
                            // Style polygons based on risk level property
                            switch (feature.properties.risk_level) {
                                case 'High': return { color: "#e53e3e", weight: 1, opacity: 0.7, fillOpacity: 0.4 };
                                case 'Medium': return { color: "#dd6b20", weight: 1, opacity: 0.7, fillOpacity: 0.4 };
                                default: return { color: "#38a169", weight: 1, opacity: 0.7, fillOpacity: 0.4 };
                            }
                        },
                        onEachFeature: function (feature, layer) {
                            if (feature.properties && feature.properties.description) {
                                layer.bindPopup(`<strong>Risk: ${feature.properties.risk_level}</strong><p>${feature.properties.description}</p>`);
                            }
                        }
                    });
                    overlayMaps["Flood Hazard Zones"] = floodHazardLayer;
                }
            } catch (e) {
                console.error("Could not load flood hazard data:", e);
            }
            // 3. (MODIFIED) Add Layer Control with Overlays
            L.control.layers(baseLayers, overlayMaps).addTo(map);
        };
        addOverlayLayers();

        // Add the fullscreen control from the plugin
        map.addControl(new L.Control.Fullscreen());

        // 4. NEW: Add Geosearch control
        const searchControl = new GeoSearch.GeoSearchControl({
            provider: new GeoSearch.OpenStreetMapProvider(),
            style: 'bar',
            showMarker: false, // We will manage our own marker
            autoClose: true,
        });
        map.addControl(searchControl);

        // NEW: Add draw controls
        const drawControl = new L.Control.Draw({
            edit: {
                featureGroup: drawnItems,
                remove: true
            },
            draw: {
                polygon: { allowIntersection: false, shapeOptions: { color: '#f06eaa' } },
                polyline: { shapeOptions: { color: '#f06eaa' } },
                rectangle: { shapeOptions: { color: '#f06eaa' } },
                circle: false, // Circles are not standard GeoJSON
                circlemarker: false,
                marker: true // Keep marker for point locations
            }
        });
        map.addControl(drawControl);

        // NEW: Handle draw events
        map.on(L.Draw.Event.CREATED, function (e) {
            const layer = e.layer;
            drawnItems.clearLayers(); // Only allow one shape at a time
            marker?.remove(); // Remove the old point marker if it exists
            marker = null;
            drawnItems.addLayer(layer);
            assetGeometry = layer.toGeoJSON().geometry;
            updateLatLngFromGeometry(layer);
            calculateAndDisplayMeasurement(layer);
        });

        map.on(L.Draw.Event.EDITED, function (e) {
            const layers = e.layers;
            layers.eachLayer(function (layer) {
                assetGeometry = layer.toGeoJSON().geometry;
                updateLatLngFromGeometry(layer);
                calculateAndDisplayMeasurement(layer);
            });
        });

        map.on(L.Draw.Event.DELETED, function () {
            assetGeometry = null;
            latitudeInput.value = '';
            longitudeInput.value = '';
            calculateAndDisplayMeasurement(null);
        });

        // 5. NEW: Listen for search results to update our marker and inputs
        map.on('geosearch/showlocation', (result) => {
            updateMarkerAndInputs(result.location.y, result.location.x);
        });

        // Only add the default marker if no geometry will be loaded
        if (!isEditMode) {
            marker = L.marker([lat, lng], { draggable: true }).addTo(map);
            map.on('click', (e) => {
                if (drawnItems.getLayers().length === 0) { // Only respond to clicks if no shape is drawn
                    const { lat, lng } = e.latlng;
                    updateMarkerAndInputs(lat, lng);
                }
            });
            marker.on('dragend', (e) => {
                const { lat, lng } = e.target.getLatLng();
                updateMarkerAndInputs(lat, lng);
            });
        }
    }

    function updateMarkerAndInputs(lat, lng) {
        if (marker) {
            marker.setLatLng([lat, lng]);
        }
        if (map) {
            map.panTo([lat, lng]);
        }
        latitudeInput.value = lat.toFixed(6);
        longitudeInput.value = lng.toFixed(6);
    }

    function updateLatLngFromGeometry(layer) {
        let lat, lng;
        if (layer.getLatLng) { // It's a marker
            ({ lat, lng } = layer.getLatLng());
        } else { // It's a polygon or polyline
            const center = layer.getBounds().getCenter();
            lat = center.lat;
            lng = center.lng;
        }
        latitudeInput.value = lat.toFixed(6);
        longitudeInput.value = lng.toFixed(6);
    }

    // --- NEW: Parent Asset Logic ---
    async function loadPotentialParents(currentAssetType) {
        // A 'Land' asset cannot be a child, so disable the dropdown.
        if (currentAssetType === 'Land') {
            parentAssetSelect.innerHTML = '<option value="">None (Land cannot be a child asset)</option>';
            parentAssetSelect.disabled = true;
            parentAssetSelect.value = ''; // Ensure value is cleared
            return;
        }

        parentAssetSelect.disabled = false;
        parentAssetSelect.innerHTML = '<option value="">Loading parents...</option>';

        try {
            // Fetch only 'Land' assets, as only they can be parents.
            const response = await fetchWithAuth(`${API_ENDPOINT}?type=Land`);
            const potentialParents = response.docs;
            
            parentAssetSelect.innerHTML = '<option value="">None</option>'; // Start with a "None" option
            
            potentialParents.forEach(parent => {
                // In edit mode, don't allow an asset to be its own parent
                if (isEditMode && parent._id === assetId) return;

                const option = document.createElement('option');
                option.value = parent._id;
                option.textContent = `${parent.name} (PIN: ${parent.propertyIndexNumber})`;
                parentAssetSelect.appendChild(option);
            });
        } catch (error) {
            showToast(`Could not load parent assets: ${error.message}`, 'error');
        }
    }

    function renderChildAssets(childAssets = []) {
        if (childAssets.length > 0) {
            childAssetsSection.classList.remove('hidden');
            childAssetsList.innerHTML = '';
            childAssets.forEach(child => {
                const tr = document.createElement('tr');
                tr.innerHTML = `
                    <td>${child.name}</td>
                    <td><span class="font-mono text-xs">${child.propertyIndexNumber}</span></td>
                    <td><span class="badge badge-ghost badge-sm">${child.type}</span></td>
                    <td><span class="badge badge-ghost badge-sm">${child.status}</span></td>
                    <td class="text-right"><a href="./immovable-form.html?id=${child._id}" class="btn btn-xs btn-ghost" title="View/Edit Child Asset"><i data-lucide="arrow-up-right"></i></a></td>
                `;
                childAssetsList.appendChild(tr);
            });
            lucide.createIcons();
        } else {
            childAssetsSection.classList.add('hidden');
        }
    }
    // --- UI LOGIC ---
    function toggleTypeSpecificFields(selectedType) {
        Object.values(detailSections).forEach(section => section.classList.add('hidden'));
        if (detailSections[selectedType]) {
            detailSections[selectedType].classList.remove('hidden');
        }
    }

    function renderComponent(component = { name: '', description: '' }) {
        const div = document.createElement('div');
        div.className = 'grid grid-cols-[1fr_2fr_auto] gap-2 items-center component-row';
        div.innerHTML = `
            <input type="text" placeholder="Component Name" class="input input-bordered input-sm component-name" value="${component.name || ''}" required>
            <input type="text" placeholder="Description / Details" class="input input-bordered input-sm component-description" value="${component.description || ''}">
            <button type="button" class="btn btn-sm btn-ghost text-red-500 remove-component-btn"><i data-lucide="x" class="h-4 w-4"></i></button>
        `;
        componentsContainer.appendChild(div);
        lucide.createIcons();
    }

    function renderImprovementRow(improvement) {
        const div = document.createElement('div');
        div.className = 'grid grid-cols-[1fr_2fr_1fr_1fr_auto] gap-4 items-center improvement-row p-2 border-b text-sm';
        const improvementDate = improvement.date ? new Date(improvement.date).toISOString().split('T')[0] : '';
        div.innerHTML = `
            <span>${improvementDate}</span>
            <span>${improvement.description}</span>
            <span class="text-right">${new Intl.NumberFormat('en-PH', { style: 'currency', currency: 'PHP' }).format(improvement.cost)}</span>
            <span>${improvement.fundSource || 'N/A'}</span>
            <button type="button" class="btn btn-xs btn-ghost text-red-500 remove-improvement-btn" data-improvement-id="${improvement._id}"><i data-lucide="x" class="h-4 w-4"></i></button>
        `;
        improvementsContainer.appendChild(div);
        lucide.createIcons();
    }

    function populateForm(asset) {
        // Helper to set value on a form element, including nested ones
        const setFieldValue = (name, value) => {
            const field = form.querySelector(`[name="${name}"]`);
            if (field) {
                if (field.type === 'date' && value) {
                    field.value = new Date(value).toISOString().split('T')[0];
                } else if (['assessedValue', 'impairmentLosses', 'buildingAndStructureDetails.salvageValue'].includes(name) && value != null && !isNaN(parseFloat(value))) {
                    // Format currency fields on load using Intl.NumberFormat for robustness.
                    field.value = new Intl.NumberFormat('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(parseFloat(value));
                } else {
                    // Use empty string for null/undefined to clear the field
                    field.value = value || '';
                }
            }
        };

        // Populate all fields by iterating through the asset object
        Object.keys(asset).forEach(key => {
            const value = asset[key];
            if (typeof value === 'object' && value !== null && !Array.isArray(value)) {
                // Handle nested objects (e.g., landDetails, buildingAndStructureDetails)
                Object.keys(value).forEach(nestedKey => {
                    const nestedValue = value[nestedKey];
                    if (typeof nestedValue === 'object' && nestedValue !== null && !Array.isArray(nestedValue)) {
                        // Handle third-level nesting (e.g., boundaries)
                        Object.keys(nestedValue).forEach(subKey => {
                            const fieldName = `${key}.${nestedKey}.${subKey}`;
                            setFieldValue(fieldName, nestedValue[subKey]);
                        });
                    } else {
                        const fieldName = `${key}.${nestedKey}`;
                        setFieldValue(fieldName, nestedValue);
                    }
                });
            } else if (!Array.isArray(value)) {
                // Handle top-level fields
                setFieldValue(key, value);
            }
        });

        // --- REVISED: Populate GIS fields and map, prioritizing drawn geometry ---
        if (asset.geometry && drawnItems) {
            assetGeometry = asset.geometry;
            // When creating a GeoJSON layer, Leaflet creates a FeatureGroup.
            // For a Point, it contains a Marker. For a Polygon, it contains a Polygon layer.
            // We use pointToLayer to ensure any Point geometry creates a draggable marker.
            const geoJsonLayer = L.geoJSON(asset.geometry, {
                pointToLayer: function (feature, latlng) {
                    return L.marker(latlng, { draggable: true });
                },
                style: { color: '#f06eaa' }
            });
            drawnItems.clearLayers();
            marker?.remove(); // Remove any old point marker
            marker = null;

            const mainLayer = geoJsonLayer.getLayers()[0]; // Get the actual layer
            if (mainLayer) {
                // Check if the layer is a shape with bounds (Polygon, LineString)
                if (typeof mainLayer.getBounds === 'function') {
                    drawnItems.addLayer(mainLayer);
                    map.fitBounds(mainLayer.getBounds());
                    calculateAndDisplayMeasurement(mainLayer);
                }
                // Or if it's a point marker, which does not have .getBounds()
                else if (typeof mainLayer.getLatLng === 'function') {
                    marker = mainLayer;
                    marker.addTo(map);
                    map.setView(marker.getLatLng(), 16); // Center map on the marker
                    marker.on('dragend', (e) => {
                        const { lat, lng } = e.target.getLatLng();
                        updateMarkerAndInputs(lat, lng);
                    });
                    calculateAndDisplayMeasurement(null); // Hide measurement for point markers
                }
                updateLatLngFromGeometry(mainLayer);
            }
        } else if (asset.latitude && asset.longitude) {
            // Map is already initialized and centered. We just need to ensure a marker exists for editing.
            if (!marker) {
                marker = L.marker([asset.latitude, asset.longitude], { draggable: true }).addTo(map);
                marker.on('dragend', (e) => {
                    const { lat, lng } = e.target.getLatLng();
                    updateMarkerAndInputs(lat, lng);
                });
            }
            updateMarkerAndInputs(asset.latitude, asset.longitude);
            calculateAndDisplayMeasurement(null); // Hide measurement for point markers
        }

        // Bind a popup to the marker to show asset details on the form map
        if (isEditMode && marker) {
            const popupContent = `
                <div class="font-bold">${asset.name}</div>
                <div class="text-xs font-mono text-gray-500">${asset.propertyIndexNumber}</div>
            `;
            marker.bindPopup(popupContent).openPopup();
        }

        // Populate parent asset dropdown
        if (asset.parentAsset) {
            parentAssetSelect.value = asset.parentAsset._id || asset.parentAsset;
        }

        // Populate Child Assets
        if (asset.childAssets) {
            renderChildAssets(asset.childAssets);
        }

        // Calculate and display Total Book Value
        const assessedValue = parseFloat(String(asset.assessedValue || '0').replace(/,/g, ''));
        const totalImprovementsCost = (asset.capitalImprovements || []).reduce((sum, imp) => sum + (imp.cost || 0), 0);
        const totalBookValue = assessedValue + totalImprovementsCost;
        totalBookValueInput.value = new Intl.NumberFormat('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(totalBookValue);

        // Populate improvements tab
        if (asset.capitalImprovements && asset.capitalImprovements.length > 0) {
            improvementsContainer.innerHTML = ''; // Clear
            asset.capitalImprovements.forEach(imp => renderImprovementRow(imp));
        } else {
            improvementsContainer.innerHTML = '<p class="text-sm text-center text-base-content/70 p-4">No capital improvements recorded.</p>';
        }

        // Populate components
        if (asset.components && asset.components.length > 0) {
            componentsContainer.innerHTML = ''; // Clear any empty rows
            asset.components.forEach(comp => renderComponent(comp));
        } else {
            componentsContainer.innerHTML = ''; // Ensure it's clear if no components
        }

        // Populate history tab
        if (asset.history) {
            renderHistory(historyContainer, asset.history);
        }

        // Populate attachments
        if (asset.attachments) {
            renderAttachments({ existingAttachmentsContainer, existingAttachmentsList }, asset.attachments);
        }

        // Populate repair history tab
        if (asset.repairHistory && asset.repairHistory.length > 0) {
            repairsContainer.innerHTML = ''; // Clear any empty rows
            asset.repairHistory.forEach(repair => renderRepairRow(repair));
        } else {
            repairsContainer.innerHTML = '<p class="text-sm text-center text-base-content/70 p-4">No repair records found.</p>';
        }

        // Show the correct details section based on the asset type
        toggleTypeSpecificFields(asset.type);
    }

    // --- CORE LOGIC ---
    async function loadAssetForEditing() {
        try {
            const asset = await fetchWithAuth(`${API_ENDPOINT}/${assetId}`);
            // Initialize map with asset's location if available, otherwise default.
            initializeMap(asset.latitude, asset.longitude);

            // Load potential parents first and wait for it to complete.
            await loadPotentialParents(asset.type);

            // Now populate the form. This ensures the parent asset dropdown
            // is ready to be set with the correct value.
            populateForm(asset);

            formTabs.classList.remove('hidden'); // Show tabs only in edit mode
        } catch (error) {
            showToast(`Error loading asset: ${error.message}`, 'error');
            setTimeout(() => window.location.href = './immovable-registry.html', 2000);
        }
    }

    async function handleFormSubmit(event) {
        event.preventDefault();
        submitButton.disabled = true;
        submitButton.innerHTML = `<i data-lucide="loader-2" class="animate-spin"></i> Saving...`;
        lucide.createIcons();

        const formData = new FormData();
        const formElements = form.elements;
        const assetData = {}; // To hold structured data before appending

        // 1. Structure the data from form fields
        for (const element of formElements) {
            if (!element.name || element.type === 'file') continue;

            let value = element.value;
            // Un-format currency fields before sending
            if (['assessedValue', 'impairmentLosses', 'buildingAndStructureDetails.salvageValue'].includes(element.name) && typeof value === 'string') {
                value = value.replace(/,/g, '');
            }

            const keys = element.name.split('.');
            let current = assetData;
            keys.forEach((k, i) => {
                if (i === keys.length - 1) {
                    current[k] = value === '' ? null : value;
                } else {
                    current[k] = current[k] || {};
                    current = current[k];
                }
            });
        }

        // Manually gather components, as they are dynamic
        assetData.components = []; // Initialize/reset components
        const componentRows = componentsContainer.querySelectorAll('.component-row');
        componentRows.forEach(row => {
            const name = row.querySelector('.component-name').value.trim();
            const description = row.querySelector('.component-description').value.trim();
            if (name) { // Only add if name is not empty
                assetData.components.push({ name, description }); // Push to the correct array
            }
        });

        // Add geometry data to the main assetData object if it exists
        if (assetGeometry) {
            assetData.geometry = assetGeometry;
        }

        // 2. (REVISED) Append all structured data to FormData
        Object.keys(assetData).forEach(key => {
            const value = assetData[key];
            if (typeof value === 'object' && value !== null) {
                formData.append(key, JSON.stringify(value));
            } else if (value !== null && value !== undefined) {
                // Only append non-null, non-undefined primitive values
                formData.append(key, value);
            }
        });

        // 3. Append new files and their titles
        const attachmentTitles = [];
        const newAttachmentRows = newAttachmentsContainer.querySelectorAll('.new-attachment-row');
        newAttachmentRows.forEach(row => {
            const fileInput = row.querySelector('.new-attachment-file');
            const titleInput = row.querySelector('.new-attachment-title');
            if (fileInput.files.length > 0) {
                formData.append('attachments', fileInput.files[0]);
                // Push the corresponding title. Use filename as a fallback.
                attachmentTitles.push(titleInput.value.trim() || fileInput.files[0].name);
            }
        });

        // Only append the titles array if at least one file was appended.
        if (formData.has('attachments')) {
            formData.append('attachmentTitles', JSON.stringify(attachmentTitles));
        }

        try {
            const endpoint = isEditMode ? `${API_ENDPOINT}/${assetId}` : API_ENDPOINT;
            const method = isEditMode ? 'PUT' : 'POST';
            // fetchWithAuth is already configured to handle FormData
            await fetchWithAuth(endpoint, { method, body: formData });
            showToast(`Asset ${isEditMode ? 'updated' : 'created'} successfully!`, 'success');
            setTimeout(() => window.location.href = './immovable-registry.html', 1500);
        } catch (error) {
            showToast(`Error: ${error.message}`, 'error');
            submitButton.disabled = false;
            submitButton.innerHTML = `<i data-lucide="save"></i> Save Asset`;
            lucide.createIcons();
        }
    }

    async function handleAttachmentDelete(e) {
        const deleteButton = e.target.closest('.remove-attachment-btn');
        if (!deleteButton) return;

        const attachmentKey = deleteButton.dataset.key;
        if (!assetId || !attachmentKey) return;

        if (confirm('Are you sure you want to permanently delete this file?')) {
            try {
                await fetchWithAuth(`${API_ENDPOINT}/${assetId}/attachments/${encodeURIComponent(attachmentKey)}`, { method: 'DELETE' });
                showToast('Attachment deleted successfully.', 'success');
                loadAssetForEditing(); // Reload the form to show the updated list
            } catch (error) {
                showToast(`Error deleting attachment: ${error.message}`, 'error');
            }
        }
    }
    // --- INITIALIZATION ---
    if (isEditMode) {
        formTitle.textContent = 'Edit Immovable Asset';
        loadAssetForEditing(); // This now initializes the map as well
    } else {
        initializeMap(); // Initialize map for new asset
        toggleTypeSpecificFields(typeSelect.value); // Show default section
        loadPotentialParents(typeSelect.value); // Load parents for the default type
    }

    // Add listeners for currency formatting as the user types
    assessedValueInput.addEventListener('input', (e) => formatNumberOnInput(e.target));
    buildingSalvageValueInput.addEventListener('input', (e) => formatNumberOnInput(e.target));
    impairmentLossesInput.addEventListener('input', (e) => formatNumberOnInput(e.target));
    newImprovementCostInput.addEventListener('input', (e) => formatNumberOnInput(e.target));
    newRepairAmountInput.addEventListener('input', (e) => formatNumberOnInput(e.target));
    
    addAttachmentBtn.addEventListener('click', () => renderNewAttachmentRow(newAttachmentsContainer));
    typeSelect.addEventListener('change', (e) => {
        toggleTypeSpecificFields(e.target.value);
        // Reload the list of potential parents when the asset type changes.
        loadPotentialParents(e.target.value);
    });
    addComponentBtn.addEventListener('click', () => {
        renderComponent();
    });

    newAttachmentsContainer.addEventListener('click', (e) => {
        const removeBtn = e.target.closest('.remove-new-attachment-btn');
        if (removeBtn) {
            removeBtn.closest('.new-attachment-row').remove();
        }
    });

    componentsContainer.addEventListener('click', (e) => {
        if (e.target.closest('.remove-component-btn')) {
            e.target.closest('.component-row').remove();
        }
    });

    existingAttachmentsList.addEventListener('click', handleAttachmentDelete);

    // --- Tab Switching Logic ---
    const tabs = [detailsTab, improvementsTab, repairsTab, historyTab];
    const panels = [detailsPanel, improvementsPanel, repairsPanel, historyPanel];

    function switchTab(activeIndex) {
        tabs.forEach((tab, index) => {
            tab.classList.toggle('tab-active', index === activeIndex);
        });
        panels.forEach((panel, index) => {
            panel.classList.toggle('hidden', index !== activeIndex);
        });
        // Show/hide main save button based on which tab is active
        submitButton.classList.toggle('hidden', activeIndex !== 0);

        // If the details tab is being shown, the map might need its size invalidated.
        // This fixes issues where the map was hidden and its container size was not updated,
        // causing rendering glitches or interaction errors.
        if (activeIndex === 0 && map) {
            // A small delay ensures the container is visible before invalidating.
            setTimeout(() => map.invalidateSize(), 10);
        }
    }

    detailsTab.addEventListener('click', () => {
        switchTab(0);
    });

    improvementsTab.addEventListener('click', () => {
        switchTab(1);
    });

    repairsTab.addEventListener('click', () => {
        switchTab(2);
    });

    historyTab.addEventListener('click', () => {
        switchTab(3);
    });

    form.addEventListener('submit', handleFormSubmit);

    // --- Improvement Form Logic ---
    improvementForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        const improvementData = {
            date: document.getElementById('new-improvement-date').value,
            description: document.getElementById('new-improvement-description').value,
            cost: document.getElementById('new-improvement-cost').value.replace(/,/g, ''),
            fundSource: document.getElementById('new-improvement-fund').value,
            remarks: document.getElementById('new-improvement-remarks').value,
        };

        if (!improvementData.date || !improvementData.description || !improvementData.cost) {
            showToast('Please fill out Date, Description, and Cost for the improvement.', 'error');
            return;
        }

        try {
            await fetchWithAuth(`${API_ENDPOINT}/${assetId}/improvements`, {
                method: 'POST',
                body: JSON.stringify(improvementData)
            });
            showToast('Improvement record added successfully.', 'success');
            improvementForm.reset();
            loadAssetForEditing(); // Reload to refresh all tabs and total value
        } catch (error) {
            showToast(`Error adding improvement: ${error.message}`, 'error');
        }
    });

    improvementsContainer.addEventListener('click', async (e) => {
        const removeBtn = e.target.closest('.remove-improvement-btn');
        if (removeBtn) {
            const improvementId = removeBtn.dataset.improvementId;
            if (confirm('Are you sure you want to delete this improvement record?')) {
                try {
                    await fetchWithAuth(`${API_ENDPOINT}/${assetId}/improvements/${improvementId}`, {
                        method: 'DELETE'
                    });
                    showToast('Improvement record deleted.', 'success');
                    loadAssetForEditing(); // Reload to refresh
                } catch (error) {
                    showToast(`Error deleting improvement: ${error.message}`, 'error');
                }
            }
        }
    });

    // --- Repair Form Logic ---
    repairForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        const repairData = {
            date: document.getElementById('new-repair-date').value,
            natureOfRepair: document.getElementById('new-repair-nature').value,
            amount: document.getElementById('new-repair-amount').value.replace(/,/g, ''),
        };

        if (!repairData.date || !repairData.natureOfRepair || !repairData.amount) {
            showToast('Please fill out all repair fields.', 'error');
            return;
        }

        try {
            await fetchWithAuth(`${API_ENDPOINT}/${assetId}/repairs`, {
                method: 'POST',
                body: JSON.stringify(repairData)
            });
            showToast('Repair record added successfully.', 'success');
            repairForm.reset();
            loadAssetForEditing(); // Reload to refresh all tabs
        } catch (error) {
            showToast(`Error adding repair: ${error.message}`, 'error');
        }
    });

    repairsContainer.addEventListener('click', async (e) => {
        const removeBtn = e.target.closest('.remove-repair-btn');
        if (removeBtn) {
            const repairId = removeBtn.dataset.repairId;
            if (confirm('Are you sure you want to delete this repair record?')) {
                try {
                    await fetchWithAuth(`${API_ENDPOINT}/${assetId}/repairs/${repairId}`, {
                        method: 'DELETE'
                    });
                    showToast('Repair record deleted.', 'success');
                    loadAssetForEditing(); // Reload to refresh
                } catch (error) {
                    showToast(`Error deleting repair: ${error.message}`, 'error');
                }
            }
        }
    });
}