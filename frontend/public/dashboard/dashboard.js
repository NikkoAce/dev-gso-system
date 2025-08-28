// FILE: frontend/public/dashboard/dashboard.js
import { fetchWithAuth } from '../js/api.js';
import { getCurrentUser, gsoLogout } from '../js/auth.js';

let userPreferences = {};
const allComponents = {};
const DEFAULT_PREFERENCES = {
    visibleComponents: [
        'totalPortfolioValue', 'totalAssets', 'immovableAssets', 'forRepair', 'disposed', 'pendingRequisitions', 'lowStockItems', 'filters',
        'monthlyAcquisitions', 'assetsByOffice', 'assetStatus', 'recentAssets', 'recentRequisitions'
    ],
    cardOrder: ['totalPortfolioValue', 'totalAssets', 'immovableAssets', 'forRepair', 'disposed', 'pendingRequisitions', 'lowStockItems', 'filters'],
    chartOrder: ['monthlyAcquisitions', 'assetsByOffice', 'assetStatus'],
    tableOrder: ['recentAssets', 'recentRequisitions']
};

document.addEventListener('DOMContentLoaded', async () => {
    try {
        const user = await getCurrentUser();
        if (!user) return;

        // Check if the user has any saved preferences. If not, use the default layout.
        const hasPreferences = user.dashboardPreferences && user.dashboardPreferences.visibleComponents && user.dashboardPreferences.visibleComponents.length > 0;
        userPreferences = hasPreferences ? user.dashboardPreferences : DEFAULT_PREFERENCES;

        if (!user.permissions || !user.permissions.includes('dashboard:view')) {
            window.location.href = '../assets/asset-registry.html';
            return;
        }

        // Store original component HTML and order
        document.querySelectorAll('.dashboard-component').forEach(el => {
            allComponents[el.dataset.id] = {
                id: el.dataset.id,
                html: el.outerHTML,
                title: el.querySelector('.stat-title, .card-title')?.textContent || el.dataset.id,
                containerId: el.parentElement.id,
                type: el.dataset.type || 'card' // Identify component type
            };
        });

        initializeLayout(user, gsoLogout);
        initializeDashboard(user);
    } catch (error) {
        console.error("Authentication failed on dashboard:", error);
    }
});

function applyPreferences() {
    // Hide all components first
    Object.keys(allComponents).forEach(id => {
        const el = document.querySelector(`[data-id="${id}"]`);
        if (el) el.style.display = 'none';
    });

    // Show and order visible components
    userPreferences.visibleComponents.forEach(id => {
        const el = document.querySelector(`[data-id="${id}"]`);
        if (el) el.style.display = '';
    });

    const orderAndRender = (orderKey, containerId) => {
        const container = document.getElementById(containerId);
        if (!container) return;

        const orderedIds = userPreferences[orderKey] || [];
        orderedIds.forEach(id => {
            const component = document.querySelector(`[data-id="${id}"]`);
            if (component && component.parentElement === container) {
                container.appendChild(component);
            }
        });
    };

    orderAndRender('cardOrder', 'stats-container');
    orderAndRender('chartOrder', 'main-content-grid');
    orderAndRender('tableOrder', 'main-content-grid');
}

function populateCustomizeModal() {
    const container = document.getElementById('component-list-container');
    container.innerHTML = '';

    const allComponentIds = Object.keys(allComponents);

    allComponentIds.forEach(id => {
        const component = allComponents[id];
        const isVisible = userPreferences.visibleComponents.includes(id);
        // We only show the visibility toggle now, not the drag handle
        const itemHTML = `
            <div class="flex items-center justify-between p-2 border rounded-lg bg-base-200" data-id="${id}">
                <div class="form-control">
                    <label class="label cursor-pointer gap-2">
                        <input type="checkbox" class="checkbox checkbox-sm component-visibility-toggle" data-id="${id}" ${isVisible ? 'checked' : ''}>
                        <span class="label-text">${component.title}</span>
                    </label>
                </div>
            </div>
        `;
        container.insertAdjacentHTML('beforeend', itemHTML);
    });
}

function initializeDashboard(user) {
    const charts = {}; // To hold chart instances for updates

    const formatCurrency = (value) => new Intl.NumberFormat('en-PH', { style: 'currency', currency: 'PHP' }).format(value || 0);

    async function fetchDashboardData(startDate = '', endDate = '') {
        try {
            const params = new URLSearchParams({ startDate, endDate }).toString();
            const data = await fetchWithAuth(`dashboard/stats?${params}`);
            renderStatCards(data.stats);
            applyPreferences(); // Apply layout after data is fetched
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

    function setupDashboardInteractivity() {
        const modal = document.getElementById('customize-modal');
        const visibilityBtn = document.getElementById('visibility-settings-btn');
        const saveBtn = document.getElementById('save-preferences-btn');
        const editLayoutBtn = document.getElementById('edit-layout-btn');
        const saveLayoutBtn = document.getElementById('save-layout-btn');
        const cancelLayoutBtn = document.getElementById('cancel-layout-btn');
        const grids = document.querySelectorAll('.dashboard-grid');
        let sortableInstances = [];

        // Defensive check: if the main buttons don't exist, we can't proceed.
        if (!editLayoutBtn || !visibilityBtn || !saveLayoutBtn || !cancelLayoutBtn || !saveBtn) {
            console.warn('Dashboard customization buttons not found. Interactivity will be disabled.');
            return;
        }

        const enterEditMode = () => {
            editLayoutBtn.classList.add('hidden');
            visibilityBtn.classList.add('hidden');
            saveLayoutBtn.classList.remove('hidden');
            cancelLayoutBtn.classList.remove('hidden');
            grids.forEach(grid => grid.classList.add('is-editing'));

            sortableInstances = Array.from(grids).map(grid => {
                return new Sortable(grid, {
                    animation: 150,
                    handle: '.drag-handle',
                    ghostClass: 'sortable-ghost'
                });
            });
        };

        const exitEditMode = (revert = false) => {
            if (revert) {
                applyPreferences(); // Re-apply last saved preferences to revert changes
            }
            editLayoutBtn.classList.remove('hidden');
            visibilityBtn.classList.remove('hidden');
            saveLayoutBtn.classList.add('hidden');
            cancelLayoutBtn.classList.add('hidden');
            grids.forEach(grid => grid.classList.remove('is-editing'));
            sortableInstances.forEach(instance => instance.destroy());
            sortableInstances = [];
        };

        const saveLayout = async () => {
            const newPreferences = {
                ...userPreferences, // Start with existing visibility settings
                cardOrder: [],
                chartOrder: [],
                tableOrder: []
            };

            document.querySelectorAll('#stats-container .dashboard-component').forEach(el => newPreferences.cardOrder.push(el.dataset.id));
            document.querySelectorAll('#main-content-grid .dashboard-component').forEach(el => {
                if (el.dataset.type === 'chart') newPreferences.chartOrder.push(el.dataset.id);
                if (el.dataset.type === 'table') newPreferences.tableOrder.push(el.dataset.id);
            });

            userPreferences = newPreferences;
            try {
                await fetchWithAuth('users/preferences', { method: 'PUT', body: newPreferences });
                exitEditMode();
            } catch (error) {
                console.error("Failed to save layout:", error);
                alert("Could not save your layout changes. Please try again.");
            }
        };

        const saveVisibility = async () => {
            const newVisible = [];
            document.querySelectorAll('.component-visibility-toggle:checked').forEach(chk => {
                newVisible.push(chk.dataset.id);
            });
            userPreferences.visibleComponents = newVisible;
            try {
                await fetchWithAuth('users/preferences', { method: 'PUT', body: userPreferences });
                applyPreferences();
                if (modal) modal.close();
            } catch (error) {
                console.error("Failed to save visibility settings:", error);
                alert("Could not save your widget visibility changes. Please try again.");
            }
        };

        editLayoutBtn.addEventListener('click', enterEditMode);
        cancelLayoutBtn.addEventListener('click', () => exitEditMode(true));
        visibilityBtn.addEventListener('click', () => {
            populateCustomizeModal();
            if (modal) modal.showModal();
        });
        saveLayoutBtn.addEventListener('click', saveLayout);
        saveBtn.addEventListener('click', saveVisibility);
    }

    // --- INITIALIZATION ---
    const endDate = new Date().toISOString().split('T')[0];
    fetchDashboardData('', endDate); // Initial load with no start date and today as end date
    setupEventListeners();
    setupDashboardInteractivity();
}