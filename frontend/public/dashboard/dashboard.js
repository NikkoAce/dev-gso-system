// FILE: frontend/public/dashboard/dashboard.js
import { fetchWithAuth } from '../js/api.js';
import { getCurrentUser, gsoLogout } from '../js/auth.js';

document.addEventListener('DOMContentLoaded', async () => {
    try {
        const user = await getCurrentUser();
        if (!user) return;

        if (!user.permissions || !user.permissions.includes('dashboard:view')) {
            window.location.href = '../assets/asset-registry.html';
            return;
        }

        initializeLayout(user, gsoLogout);
        initializeDashboard();
    } catch (error) {
        console.error("Authentication failed on dashboard:", error);
    }
});

function initializeDashboard() {
    const charts = {}; // To hold chart instances for updates

    const formatCurrency = (value) => new Intl.NumberFormat('en-PH', { style: 'currency', currency: 'PHP' }).format(value || 0);

    async function fetchDashboardData(startDate = '', endDate = '') {
        try {
            const params = new URLSearchParams({ startDate, endDate }).toString();
            const data = await fetchWithAuth(`dashboard/stats?${params}`);
            renderStatCards(data.stats);
            createOrUpdateCharts(data.charts);
            renderRecentTables(data.recent);
        } catch (error) {
            console.error('Error fetching dashboard data:', error);
            document.getElementById('stats-container').innerHTML = `<p class="text-red-500 col-span-full">Could not load dashboard data: ${error.message}</p>`;
        }
    }

    function renderStatCards(stats) {
        document.getElementById('stat-portfolio-value').textContent = formatCurrency(stats.totalPortfolioValue.current);
        document.getElementById('stat-total-assets').textContent = stats.totalAssets.current;
        document.getElementById('stat-for-repair').textContent = stats.forRepair.current;
        document.getElementById('stat-disposed').textContent = stats.disposed.current;
        document.getElementById('stat-pending-reqs').textContent = stats.pendingRequisitions.current;
        document.getElementById('stat-immovable-assets').textContent = stats.immovableAssets.current;
        document.getElementById('stat-low-stock').textContent = stats.lowStockItems.current;

        const renderTrend = (el, trend) => {
            if (trend > 0) {
                el.innerHTML = `<i data-lucide="trending-up" class="text-success"></i> +${trend}%`;
            } else if (trend < 0) {
                el.innerHTML = `<i data-lucide="trending-down" class="text-error"></i> ${trend}%`;
            } else {
                el.innerHTML = `No change`;
            }
        };

        renderTrend(document.getElementById('stat-portfolio-value-trend'), stats.totalPortfolioValue.trend);
        renderTrend(document.getElementById('stat-total-assets-trend'), stats.totalAssets.trend);
        renderTrend(document.getElementById('stat-for-repair-trend'), stats.forRepair.trend);
        renderTrend(document.getElementById('stat-disposed-trend'), stats.disposed.trend);
        renderTrend(document.getElementById('stat-pending-reqs-trend'), stats.pendingRequisitions.trend);
        renderTrend(document.getElementById('stat-immovable-assets-trend'), stats.immovableAssets.trend);
        lucide.createIcons();
    }

    function createOrUpdateCharts(chartData) {
        const chartConfigs = {
            monthlyAcquisitionChart: {
                type: 'line',
                data: chartData.monthlyAcquisitions,
                options: {
                    tension: 0.2,
                    scales: {
                        y: {
                            ticks: {
                                callback: function(value) {
                                    return '₱' + new Intl.NumberFormat('en-US', { notation: "compact", compactDisplay: "short" }).format(value);
                                }
                            }
                        }
                    },
                    plugins: {
                        tooltip: {
                            callbacks: {
                                label: function(context) {
                                    let label = context.dataset.label || '';
                                    if (label) {
                                        label += ': ';
                                    }
                                    if (context.parsed.y !== null) {
                                        label += formatCurrency(context.parsed.y);
                                    }
                                    return label;
                                }
                            }
                        }
                    }
                }
            },
            assetsByOfficeChart: {
                type: 'bar',
                data: chartData.assetsByOffice,
                options: {
                    indexAxis: 'y',
                },
                filterKey: 'office'
            },
            assetStatusChart: {
                type: 'pie',
                data: chartData.assetStatus,
                options: {},
                filterKey: 'status'
            }
        };

        for (const [id, config] of Object.entries(chartConfigs)) {
            const ctx = document.getElementById(id).getContext('2d');
            if (charts[id]) {
                charts[id].data = config.data;
                charts[id].update();
            } else {
                charts[id] = new Chart(ctx, {
                    type: config.type,
                    data: config.data,
                    options: {
                        responsive: true,
                        maintainAspectRatio: false,
                        plugins: { legend: { display: config.type !== 'line' } },
                        ...config.options,
                        onClick: (event) => {
                            if (config.filterKey) {
                                onChartClick(event, charts[id], config.filterKey);
                            }
                        }
                    }
                });
            }
        }
    }

    function onChartClick(event, chart, filterKey) {
        const points = chart.getElementsAtEventForMode(event, 'nearest', { intersect: true }, true);
        if (points.length) {
            const firstPoint = points[0];
            const label = chart.data.labels[firstPoint.index];
            const encodedLabel = encodeURIComponent(label);
            window.location.href = `../assets/asset-registry.html?${filterKey}=${encodedLabel}`;
        }
    }

    function renderRecentTables(recentData) {
        const recentAssetsBody = document.getElementById('recent-assets-table');
        recentAssetsBody.innerHTML = '';
        if (recentData.assets.length > 0) {
            recentData.assets.forEach(asset => {
                const row = `
                    <tr>
                        <td>
                            <div class="font-bold">${asset.name || asset.description}</div>
                            <div class="text-sm opacity-50">${asset.propertyNumber}</div>
                        </td>
                        <td>${asset.custodian?.office || 'N/A'}</td>
                        <td><span class="badge badge-ghost badge-sm">${new Date(asset.acquisitionDate).toLocaleDateString()}</span></td>
                    </tr>`;
                recentAssetsBody.insertAdjacentHTML('beforeend', row);
            });
        } else {
            recentAssetsBody.innerHTML = '<tr><td colspan="3" class="text-center text-gray-500 py-4">No recent assets.</td></tr>';
        }

        const recentReqsBody = document.getElementById('recent-requisitions-table');
        recentReqsBody.innerHTML = '';
        if (recentData.requisitions.length > 0) {
            recentData.requisitions.forEach(req => {
                const row = `
                    <tr>
                        <td>
                            <div class="font-bold">${req.requestingOffice}</div>
                            <div class="text-sm opacity-50">${req.risNumber}</div>
                        </td>
                        <td><span class="badge badge-ghost badge-sm">${req.status}</span></td>
                    </tr>`;
                recentReqsBody.insertAdjacentHTML('beforeend', row);
            });
        } else {
            recentReqsBody.innerHTML = '<tr><td colspan="3" class="text-center text-gray-500 py-4">No recent requisitions.</td></tr>';
        }
    }

    function setupEventListeners() {
        // Stat Card Click Handlers
        document.getElementById('stat-card-total-assets').addEventListener('click', () => {
            window.location.href = '../assets/asset-registry.html';
        });
        document.getElementById('stat-card-for-repair').addEventListener('click', () => {
            window.location.href = '../assets/asset-registry.html?status=For Repair';
        });
        document.getElementById('stat-card-disposed').addEventListener('click', () => {
            window.location.href = '../assets/asset-registry.html?status=Disposed';
        });
        document.getElementById('stat-card-low-stock').addEventListener('click', () => {
            window.location.href = '../supplies/stock-management.html?filter=low_stock';
        });
        document.getElementById('stat-card-immovable-assets').addEventListener('click', () => {
            window.location.href = '../immovable-assets/immovable-registry.html';
        });

        // Date Filter Handlers
        const startDateInput = document.getElementById('filter-start-date');
        const endDateInput = document.getElementById('filter-end-date');

        const applyDateFilters = () => {
            const startDate = startDateInput.value;
            const endDate = endDateInput.value;
            fetchDashboardData(startDate, endDate);
        };

        startDateInput.addEventListener('change', applyDateFilters);
        endDateInput.addEventListener('change', applyDateFilters);

        // Set default end date to today
        endDateInput.value = new Date().toISOString().split('T')[0];
    }

    // --- INITIALIZATION ---
    const endDate = new Date().toISOString().split('T')[0];
    fetchDashboardData('', endDate); // Initial load with no start date and today as end date
    setupEventListeners();
}