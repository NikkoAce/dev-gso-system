import { createAuthenticatedPage } from '../js/page-loader.js';
import { fetchWithAuth } from '../js/api.js';

createAuthenticatedPage({
    permission: 'asset:read:own_office',
    pageInitializer: initializeViewPage,
    pageName: 'View My Assets'
});

function initializeViewPage(user) {
    const API_ENDPOINT = 'assets/my-assets'; // More secure endpoint
    const tableBody = document.getElementById('asset-table-body');

    async function fetchAndRenderAssets() {
        try {
            // Fetch only the assets relevant to the user's office from the backend
            const myOfficeAssets = await fetchWithAuth(API_ENDPOINT);
            tableBody.innerHTML = '';
            if (myOfficeAssets.length === 0) {
                tableBody.innerHTML = `<tr><td colspan="5" class="text-center py-8 text-base-content/70">No assets found for your office.</td></tr>`;
                return;
            }

            let rowsHTML = '';
            myOfficeAssets.forEach(asset => {
                let custodianDisplay = asset.custodian ? `${asset.custodian.name}` : 'N/A';
                const statusMap = {
                    'In Use': 'badge-success',
                    'In Storage': 'badge-info',
                    'For Repair': 'badge-warning',
                    'Disposed': 'badge-error'
                };
                const statusBadge = `<span class="badge ${statusMap[asset.status] || 'badge-ghost'} badge-sm">${asset.status}</span>`;

                rowsHTML += `
                    <tr>
                        <td data-label="Property No." class="font-medium">${asset.propertyNumber}</td>
                        <td data-label="Description">${asset.description}</td>
                        <td data-label="Category">${asset.category}</td>
                        <td data-label="Custodian">${custodianDisplay}</td>
                        <td data-label="Status">${statusBadge}</td>
                    </tr>
                `;
            });
            tableBody.innerHTML = rowsHTML;

        } catch (error) {
            console.error('Failed to fetch assets:', error);
            tableBody.innerHTML = `<tr><td colspan="5" class="text-center p-8 text-error">Error loading assets: ${error.message}</td></tr>`;
        }
    }

    fetchAndRenderAssets();
}
