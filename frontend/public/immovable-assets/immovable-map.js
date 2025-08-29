import { getCurrentUser, gsoLogout } from '../js/auth.js';
import { fetchWithAuth } from '../js/api.js';

document.addEventListener('DOMContentLoaded', async () => {
    try {
        const user = await getCurrentUser();
        if (!user) return;

        if (!user.permissions || !user.permissions.includes('immovable:read')) {
            window.location.href = '../dashboard/dashboard.html';
            return;
        }
        initializeLayout(user, gsoLogout);
        initializeAssetMap();
    } catch (error) {
        console.error("Authentication failed on asset map page:", error);
    }
});

async function initializeAssetMap() {
    const mapContainer = document.getElementById('asset-map');
    if (!mapContainer) return;

    // 1. Define Base Layers
    const osmLayer = L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
    });

    const satelliteLayer = L.tileLayer('https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}', {
        attribution: 'Tiles &copy; Esri &mdash; Source: Esri, i-cubed, USDA, USGS, AEX, GeoEye, Getmapping, Aerogrid, IGN, IGP, UPR-EGP, and the GIS User Community'
    });

    const topoLayer = L.tileLayer('https://{s}.tile.opentopomap.org/{z}/{x}/{y}.png', {
        attribution: 'Map data: &copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors, <a href="http://viewfinderpanoramas.org">SRTM</a> | Map style: &copy; <a href="https://opentopomap.org">OpenTopoMap</a> (<a href="https://creativecommons.org/licenses/by-sa/3.0/">CC-BY-SA</a>)'
    });

    const baseLayers = {
        "Street": osmLayer,
        "Satellite": satelliteLayer,
        "Topographic": topoLayer
    };

    // NEW: Define Overlay Layers container
    const overlayMaps = {};

    // 2. Initialize Map with default layer
    const map = L.map('asset-map', {
        center: [14.1155, 122.9550], // Default center to Daet, Camarines Norte
        zoom: 13,
        layers: [osmLayer] // Default layer
    });

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

    // 4. NEW: Add Geosearch control
    const searchControl = new GeoSearch.GeoSearchControl({
        provider: new GeoSearch.OpenStreetMapProvider(),
        style: 'bar', // 'bar' or 'button'
        showMarker: false, // We don't need a permanent marker for search results
        autoClose: true,
    });
    map.addControl(searchControl);

    // Add the fullscreen control
    map.addControl(new L.Control.Fullscreen());

    try {
        // The API now consistently returns a paginated object structure
        const response = await fetchWithAuth('immovable-assets');
        const assetsWithCoords = response.docs.filter(asset => asset.latitude && asset.longitude);

        if (assetsWithCoords.length === 0) {
            mapContainer.innerHTML = '<div class="flex items-center justify-center h-full text-gray-500">No assets with location data found.</div>';
            return;
        }

        const markers = L.markerClusterGroup();

        assetsWithCoords.forEach(asset => {
            const popupContent = `
                <div class="font-bold text-base">${asset.name}</div>
                <div class="text-sm text-gray-600">${asset.type}</div>
                <div class="text-xs font-mono text-gray-500">${asset.propertyIndexNumber}</div>
                <hr class="my-2">
                <a href="./immovable-form.html?id=${asset._id}" class="text-blue-600 hover:underline">View/Edit Details &rarr;</a>
            `;
            const marker = L.marker([asset.latitude, asset.longitude])
                .bindPopup(popupContent);
            markers.addLayer(marker);
        });

        map.addLayer(markers);
        // Fit map to show all markers
        if (markers.getBounds().isValid()) {
            map.fitBounds(markers.getBounds().pad(0.1));
        }
    } catch (error) {
        mapContainer.innerHTML = `<div class="flex items-center justify-center h-full text-red-500">Error loading asset data: ${error.message}</div>`;
    }
}