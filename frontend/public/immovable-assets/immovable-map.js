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

    // Default center to Daet, Camarines Norte
    const map = L.map('asset-map').setView([14.1155, 122.9550], 13);

    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
    }).addTo(map);

    try {
        const assets = await fetchWithAuth('immovable-assets');
        const assetsWithCoords = assets.filter(asset => asset.latitude && asset.longitude);

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