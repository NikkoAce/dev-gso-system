// FILE: frontend/public/dashboard.js
import { fetchWithAuth } from './api.js';

document.addEventListener('DOMContentLoaded', async () => {
    try {
        const user = await getCurrentUser();
        if (!user) return;

        initializeLayout(user);
        if (user.office === 'GSO') {
            initializeDashboard();
        } else {
            // Non-GSO users might see a different dashboard or be redirected
            document.querySelector('main').innerHTML = `<h1 class="text-2xl">Welcome, ${user.name}!</h1>`;
        }
    } catch (error) {
        console.error("Authentication failed on dashboard:", error);
    }
});

function initializeDashboard() {
    const formatCurrency = (value) => new Intl.NumberFormat('en-PH', { style: 'currency', currency: 'PHP' }).format(value || 0);

    const statElements = {
        totalValue: document.getElementById('stat-total-value'),
        totalAssets: document.getElementById('stat-total-assets'),
        forRepair: document.getElementById('stat-for-repair'),
        disposed: document.getElementById('stat-disposed'),
        suppliesValue: document.getElementById('stat-supplies-value'),
        pendingReqs: document.getElementById('stat-pending-reqs'),
    };

    let assetsByCategoryChartInstance = null;
    let assetStatusChartInstance = null;
    let monthlyAcquisitionChartInstance = null;

    async function fetchDashboardData() {
        try {
            // In a real app, this would fetch from a dedicated summary endpoint
            // For now, we assume an endpoint 'dashboard/summary' exists.
            const summaryData = await fetchWithAuth('dashboard/summary');
            
            updateStatCards(summaryData.stats);
            renderAssetsByCategoryChart(summaryData.charts.assetsByCategory);
            renderAssetStatusChart(summaryData.charts.assetStatus);
            renderMonthlyAcquisitionChart(summaryData.charts.monthlyAcquisitions);

        } catch (error) {
            console.error("Failed to fetch dashboard data:", error);
            Object.values(statElements).forEach(el => el.textContent = 'Error');
        }
    }

    function updateStatCards(stats) {
        statElements.totalValue.textContent = formatCurrency(stats.totalAssetValue);
        statElements.totalAssets.textContent = stats.totalAssets.toLocaleString();
        statElements.forRepair.textContent = stats.assetsForRepair.toLocaleString();
        statElements.disposed.textContent = stats.disposedAssets.toLocaleString();
        statElements.suppliesValue.textContent = formatCurrency(stats.suppliesValue);
        statElements.pendingReqs.textContent = stats.pendingRequisitions.toLocaleString();
    }

    function renderChart(canvasId, instance, chartConfig) {
        const ctx = document.getElementById(canvasId).getContext('2d');
        if (instance) {
            instance.destroy();
        }
        return new Chart(ctx, chartConfig);
    }

    function renderAssetsByCategoryChart(data) {
        assetsByCategoryChartInstance = renderChart('assetsByCategoryChart', assetsByCategoryChartInstance, {
            type: 'doughnut',
            data: {
                labels: data.map(d => d.category),
                datasets: [{
                    label: 'Assets by Category',
                    data: data.map(d => d.count),
                    backgroundColor: ['#570df8', '#f000b8', '#37cdbe', '#fbbd23', '#3abff8', '#f87272'],
                    hoverOffset: 4
                }]
            },
            options: {
                responsive: true,
                plugins: {
                    legend: {
                        position: 'top',
                    }
                }
            }
        });
    }

    function renderAssetStatusChart(data) {
        assetStatusChartInstance = renderChart('assetStatusChart', assetStatusChartInstance, {
            type: 'pie',
            data: {
                labels: data.map(d => d.status),
                datasets: [{
                    label: 'Asset Status',
                    data: data.map(d => d.count),
                    backgroundColor: ['#37cdbe', '#fbbd23', '#f87272', '#6b7280'],
                    hoverOffset: 4
                }]
            },
            options: {
                responsive: true,
                plugins: {
                    legend: {
                        position: 'top',
                    }
                }
            }
        });
    }

    function renderMonthlyAcquisitionChart(data) {
        monthlyAcquisitionChartInstance = renderChart('monthlyAcquisitionChart', monthlyAcquisitionChartInstance, {
            type: 'bar',
            data: {
                labels: data.map(d => d.month), // e.g., ['Jan', 'Feb', ...]
                datasets: [{
                    label: 'Assets Acquired',
                    data: data.map(d => d.count),
                    backgroundColor: 'rgba(54, 162, 235, 0.6)',
                    borderColor: 'rgba(54, 162, 235, 1)',
                    borderWidth: 1
                }]
            },
            options: {
                responsive: true,
                scales: {
                    y: {
                        beginAtZero: true,
                        ticks: {
                            stepSize: 1
                        }
                    }
                },
                plugins: {
                    legend: {
                        display: false
                    }
                }
            }
        });
    }

    fetchDashboardData();
}