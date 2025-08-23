// FILE: frontend/public/dashboard.js
import { fetchWithAuth } from '../js/api.js';

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
        pendingReqs: document.getElementById('stat-pending-reqs'),
    };

    const trendElements = {
        totalValue: document.getElementById('stat-total-value-trend'),
        totalAssets: document.getElementById('stat-total-assets-trend'),
        forRepair: document.getElementById('stat-for-repair-trend'),
        disposed: document.getElementById('stat-disposed-trend'),
        pendingReqs: document.getElementById('stat-pending-reqs-trend'),
    };

    let assetsByOfficeChartInstance = null;
    let assetStatusChartInstance = null;
    let monthlyAcquisitionChartInstance = null;
    
    const recentAssetsTable = document.getElementById('recent-assets-table');
    const recentRequisitionsTable = document.getElementById('recent-requisitions-table');

    async function fetchDashboardData() {
        try {
            const startDate = document.getElementById('filter-start-date').value;
            const endDate = document.getElementById('filter-end-date').value;

            const params = new URLSearchParams();
            if (startDate) params.append('startDate', startDate);
            if (endDate) params.append('endDate', endDate);

            const query = params.toString();
            const endpoint = `assets/dashboard/summary${query ? `?${query}` : ''}`;
            const summaryData = await fetchWithAuth(endpoint);
            
            updateStatCards(summaryData.stats);
            renderAssetsByOfficeChart(summaryData.charts.assetsByOffice);
            renderAssetStatusChart(summaryData.charts.assetStatus);
            renderMonthlyAcquisitionChart(summaryData.charts.monthlyAcquisitions);
            renderRecentAssetsTable(summaryData.tables.recentAssets);
            renderRecentRequisitionsTable(summaryData.tables.recentRequisitions);

        } catch (error) {
            console.error("Failed to fetch dashboard data:", error);
            Object.values(statElements).forEach(el => el.textContent = 'Error');
            Object.values(trendElements).forEach(el => el.textContent = '');
            recentAssetsTable.innerHTML = `<tr><td class="text-center text-error">Error loading data.</td></tr>`;
            recentRequisitionsTable.innerHTML = `<tr><td class="text-center text-error">Error loading data.</td></tr>`;
        }
    }

    function updateStatCards(stats) {
        statElements.totalValue.textContent = formatCurrency(stats.totalAssetValue);
        statElements.totalAssets.textContent = stats.totalAssets.toLocaleString();
        statElements.forRepair.textContent = stats.assetsForRepair.toLocaleString();
        statElements.disposed.textContent = stats.disposedAssets.toLocaleString();
        statElements.pendingReqs.textContent = stats.pendingRequisitions.toLocaleString();

        // Update trends
        updateTrend(trendElements.totalValue, stats.trends.totalAssetValue, true);
        updateTrend(trendElements.totalAssets, stats.trends.totalAssets, false);
        updateTrend(trendElements.forRepair, stats.trends.assetsForRepair, false);
        updateTrend(trendElements.disposed, stats.trends.disposedAssets, false);
        updateTrend(trendElements.pendingReqs, stats.trends.pendingRequisitions, false);
    }

    function updateTrend(element, trendData, isCurrency = false) {
        if (!element || typeof trendData?.percent !== 'number') {
            if(element) element.textContent = '';
            return;
        }

        const { percent, absolute } = trendData;
        const arrow = percent >= 0 ? '↗︎' : '↘︎';
        const sign = absolute >= 0 ? '+' : '';
        const formattedAbsolute = isCurrency 
            ? formatCurrency(absolute) 
            : absolute.toLocaleString();

        element.textContent = `${arrow} ${Math.abs(percent)}% (${sign}${formattedAbsolute}) vs last period`;
        element.className = `stat-desc ${percent >= 0 ? 'text-success' : 'text-error'}`;
    }

    function renderChart(canvasId, instance, chartConfig) {
        const ctx = document.getElementById(canvasId).getContext('2d');
        if (instance) {
            instance.destroy();
        }
        return new Chart(ctx, chartConfig);
    }

    function renderAssetsByOfficeChart(data) {
        assetsByOfficeChartInstance = renderChart('assetsByOfficeChart', assetsByOfficeChartInstance, {
            type: 'bar',
            data: {
                labels: data.map(d => d.office),
                datasets: [{
                    label: 'Assets by Office',
                    data: data.map(d => d.count),
                    backgroundColor: 'rgba(240, 0, 184, 0.6)',
                    borderColor: 'rgba(240, 0, 184, 1)',
                    borderWidth: 1
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                indexAxis: 'y', // Horizontal bar chart is good for long office names
                plugins: {
                    legend: {
                        display: false
                    }
                },
                scales: {
                    x: {
                        beginAtZero: true,
                        ticks: {
                            stepSize: 1
                        }
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
                maintainAspectRatio: false,
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
            type: 'line',
            data: {
                labels: data.map(d => d.month),
                datasets: [{
                    label: 'Acquisition Value',
                    data: data.map(d => d.totalValue),
                    backgroundColor: 'rgba(54, 162, 235, 0.2)',
                    borderColor: 'rgba(54, 162, 235, 1)',
                    borderWidth: 2,
                    fill: true,
                    tension: 0.4
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                scales: {
                    y: {
                        beginAtZero: true,
                        ticks: {
                            // Format y-axis labels as currency
                            callback: function(value, index, values) {
                                if (value >= 1000) {
                                    return '₱' + (value / 1000) + 'k';
                                }
                                return '₱' + value;
                            }
                        }
                    }
                },
                plugins: {
                    legend: { display: false },
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
        });
    }

    function renderRecentAssetsTable(assets) {
        recentAssetsTable.innerHTML = '';
        if (!assets || assets.length === 0) {
            recentAssetsTable.innerHTML = `<tr><td class="text-center text-base-content/70">No recent assets.</td></tr>`;
            return;
        }
        assets.forEach(asset => {
            const row = `
                <tr>
                    <td>
                        <div class="font-bold">${asset.description}</div>
                        <div class="text-xs opacity-70">${asset.propertyNumber}</div>
                    </td>
                    <td>
                        <div>${asset.custodian ? asset.custodian.name : 'N/A'}</div>
                        <div class="text-xs opacity-70">${asset.office || 'Unassigned'}</div>
                    </td>
                </tr>
            `;
            recentAssetsTable.innerHTML += row;
        });
    }

    function renderRecentRequisitionsTable(requisitions) {
        recentRequisitionsTable.innerHTML = '';
        if (!requisitions || requisitions.length === 0) {
            recentRequisitionsTable.innerHTML = `<tr><td class="text-center text-base-content/70">No recent requisitions.</td></tr>`;
            return;
        }
        const statusMap = {
            'Pending': 'badge-warning',
            'Issued': 'badge-success',
        };
        requisitions.forEach(req => {
            const row = `
                <tr>
                    <td>${req.requestingOffice}</td>
                    <td><span class="badge ${statusMap[req.status] || 'badge-ghost'} badge-sm">${req.status}</span></td>
                </tr>
            `;
            recentRequisitionsTable.innerHTML += row;
        });
    }

    function initializeFilters() {
        const startDateInput = document.getElementById('filter-start-date');
        const endDateInput = document.getElementById('filter-end-date');

        // Set default dates to the current year
        const today = new Date();
        const yearStart = new Date(today.getFullYear(), 0, 1);
        startDateInput.value = yearStart.toISOString().split('T')[0];
        endDateInput.value = today.toISOString().split('T')[0];

        const handleDateChange = () => {
            const startValue = startDateInput.value;
            const endValue = endDateInput.value;

            if (!startValue || !endValue) return; // Don't do anything if a date is cleared

            if (new Date(startValue) > new Date(endValue)) {
                alert('Start date cannot be after the end date. Adjusting start date.');
                startDateInput.value = endValue; // Auto-correct the start date
            }
            fetchDashboardData();
        };

        startDateInput.addEventListener('change', handleDateChange);
        endDateInput.addEventListener('change', handleDateChange);
    }

    initializeFilters();
    fetchDashboardData(); // Initial fetch with default dates
}