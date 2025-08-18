import { fetchWithAuth } from './api.js';

document.addEventListener('DOMContentLoaded', async () => {
    let currentUser;
    try {
        currentUser = await getCurrentUser();
        if (!currentUser) return;

        initializeLayout(currentUser);
        initializeViewPage(currentUser);
    } catch (error) {
        console.error("Authentication failed:", error);
    }
});

function initializeViewPage(currentUser) {
    const API_ENDPOINT = 'assets/my-assets'; // More secure endpoint
    const tableBody = document.getElementById('asset-table-body');

    async function fetchAndRenderAssets() {
        try {
            // Fetch only the assets relevant to the user's office from the backend
            const myOfficeAssets = await fetchWithAuth(API_ENDPOINT);
            tableBody.innerHTML = '';
            if (myOfficeAssets.length === 0) {
                tableBody.innerHTML = `<tr><td colspan="5" class="text-center py-8 text-gray-500">No assets found for your office.</td></tr>`;
                return;
            }

            let rowsHTML = '';
            myOfficeAssets.forEach(asset => {
                let custodianDisplay = asset.custodian ? `${asset.custodian.name}` : 'N/A';
                rowsHTML += `
                    <tr class="bg-white border-b">
                        <td class="px-6 py-4 font-medium">${asset.propertyNumber}</td>
                        <td class="px-6 py-4">${asset.description}</td>
                        <td class="px-6 py-4">${asset.category}</td>
                        <td class="px-6 py-4">${custodianDisplay}</td>
                        <td class="px-6 py-4">${asset.status}</td>
                    </tr>
                `;
            });
            tableBody.innerHTML = rowsHTML;

        } catch (error) {
            console.error('Failed to fetch assets:', error);
            tableBody.innerHTML = `<tr><td colspan="5" class="text-center p-8 text-red-500">Error loading assets: ${error.message}</td></tr>`;
        }
    }

    fetchAndRenderAssets();
}
