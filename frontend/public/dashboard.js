import { fetchWithAuth } from './api.js';

document.addEventListener('DOMContentLoaded', async () => {
    try {
        const user = await getCurrentUser();
        if (!user) return;

        initializeLayout(user);
        
        // If the user is not from GSO, redirect them to the view-only page
        if (user.office !== 'GSO') {
            window.location.href = 'view-assets.html';
            return;
        }

        // If they are GSO, load the dashboard content
        initializeDashboard();

    } catch (error) {
        console.error("Authentication failed on dashboard page:", error);
    }
});

function initializeDashboard() {
    const API_ENDPOINT = 'assets';
    let myChart = null;

    const formatCurrency = (value) => new Intl.NumberFormat('en-PH', { style: 'currency', currency: 'PHP' }).format(value || 0);

    async function fetchAndRenderDashboard() {
        try {
            const allAssets = await fetchWithAuth(API_ENDPOINT);
            
            const totalValue = allAssets.reduce((sum, asset) => sum + asset.acquisitionCost, 0);
            const forRepair = allAssets.filter(a => a.status === 'For Repair').length;
            
            document.getElementById('stat-total-value').textContent = formatCurrency(totalValue);
            document.getElementById('stat-total-assets').textContent = allAssets.length;
            document.getElementById('stat-for-repair').textContent = forRepair;

            const ctx = document.getElementById('assetsByCategoryChart').getContext('2d');
            const categoryCounts = allAssets.reduce((acc, asset) => {
                acc[asset.category] = (acc[asset.category] || 0) + 1;
                return acc;
            }, {});

            if (myChart) myChart.destroy();
            
            myChart = new Chart(ctx, {
                type: 'bar',
                data: {
                    labels: Object.keys(categoryCounts),
                    datasets: [{
                        label: '# of Assets',
                        data: Object.values(categoryCounts),
                        backgroundColor: 'rgba(37, 99, 235, 0.6)',
                        borderColor: 'rgba(29, 78, 216, 1)',
                        borderWidth: 1,
                        borderRadius: 4
                    }]
                },
                options: { 
                    responsive: true,
                    plugins: { legend: { display: false } },
                    scales: { 
                        y: { beginAtZero: true },
                        x: { grid: { display: false } }
                    } 
                }
            });

        } catch (error) {
            console.error('Failed to fetch dashboard data:', error);
            document.getElementById('stat-total-value').textContent = 'Error';
            document.getElementById('stat-total-assets').textContent = 'Error';
            document.getElementById('stat-for-repair').textContent = 'Error';
        }
    }

    fetchAndRenderDashboard();
}
