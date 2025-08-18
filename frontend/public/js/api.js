// FILE: frontend/public/js/registry/api.js

const BASE_URL = 'https://lgu-gso-system.onrender.com/api';

/**
 * A generic fetch wrapper.
 * @param {string} endpoint The API endpoint to fetch from.
 * @returns {Promise<any>} The JSON response.
 */
async function fetchData(endpoint) {
    const response = await fetch(`${BASE_URL}/${endpoint}`);
    if (!response.ok) throw new Error(`Failed to fetch ${endpoint}`);
    return response.json();
}

/**
 * A service object for all asset-related API calls for the registry page.
 * This service is stateless and does not depend on the DOM.
 */
export const apiService = {
    /**
     * Fetches all static data needed for the registry page filters.
     * @returns {Promise<[Array, Array, Array]>} A promise that resolves to [categories, offices, employees].
     */
    fetchStaticData: async function() {
        return Promise.all([
            fetchData('categories'),
            fetchData('offices'),
            fetchData('employees')
        ]);
    },

    /**
     * Fetches a paginated and filtered list of assets.
     * @param {object} params - The filter and pagination parameters.
     * @returns {Promise<object>} The API response containing asset documents and pagination info.
     */
    fetchAssets: async function(params) {
        const queryParams = new URLSearchParams({
            page: params.currentPage,
            limit: params.assetsPerPage,
            sort: params.sortKey,
            order: params.sortDirection,
            search: params.search,
            category: params.category,
            status: params.status,
            office: params.office,
            fundSource: params.fundSource,
            startDate: params.startDate,
            endDate: params.endDate
        });

        // Filter out empty parameters to create a clean URL
        const cleanParams = Array.from(queryParams.entries()).filter(([, value]) => value).map(e => e.join('=')).join('&');
        
        const response = await fetch(`${BASE_URL}/assets?${cleanParams}`);
        if (!response.ok) throw new Error('Failed to fetch assets');
        return response.json();
    },

    /**
     * Deletes a single asset by its ID.
     * @param {string} assetId - The ID of the asset to delete.
     */
    deleteAsset: async function(assetId) {
        const response = await fetch(`${BASE_URL}/assets/${assetId}`, { method: 'DELETE' });
        if (!response.ok) throw new Error('Failed to delete asset');
    },

    /**
     * Transfers multiple assets to a new custodian and office.
     * @param {object} payload - The transfer details.
     * @returns {Promise<object>} The result of the transfer operation.
     */
    bulkTransfer: async function(payload) {
        const response = await fetch(`${BASE_URL}/assets/bulk-transfer`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
        });
        if (!response.ok) {
            const errData = await response.json();
            throw new Error(errData.message || 'Bulk transfer failed');
        }
        return response.json();
    }
};

