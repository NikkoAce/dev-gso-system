// FILE: frontend/public/dashboard/dashboard.js
import { fetchWithAuth } from '../js/api.js';
import { getCurrentUser, gsoLogout } from '../js/auth.js';

let viewOptions = {}; // NEW: To hold view-specific options like grouping
let dateRange = { start: null, end: null }; // NEW: To hold date range
const sparklines = {}; // To hold sparkline chart instances
let dashboardFilters = {};
let dashboardData = {}; // NEW: To store the full stats object
let userPreferences = {};
const allComponents = {};
const DEFAULT_PREFERENCES = {
    visibleComponents: [ // NEW: Added 'totalDepreciationYTD'
        'totalPortfolioValue', 'totalAssets', 'immovableAssets', 'pendingRequisitions', 'avgFulfillmentTime', 'lowStockItems', 'unassignedAssets', 'totalDepreciationYTD', 'nearingEndOfLife', 'assetCondition', // Cards
        'monthlyAcquisitions', 'assetsByOffice', 'assetDistribution', // Charts
        'recentActivity' // Tables
    ],
    cardOrder: ['totalPortfolioValue', 'totalAssets', 'immovableAssets', 'pendingRequisitions', 'avgFulfillmentTime', 'lowStockItems', 'unassignedAssets', 'totalDepreciationYTD', 'nearingEndOfLife'],
    chartOrder: ['monthlyAcquisitions', 'assetsByOffice', 'assetDistribution'],
    tableOrder: ['recentActivity']
};

document.addEventListener('DOMContentLoaded', async () => {
    try {
        let user = await getCurrentUser();
        if (!user) return;

        // --- FIX: Fetch the full, up-to-date user profile from the server ---
        // This ensures we always have the latest dashboard preferences,
        // instead of relying on potentially stale data from the JWT.
        const fullUser = await fetchWithAuth('users/profile');
        user = fullUser; // Replace the token-based user with the full user object

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

// Helper to sort components within their groups based on DEFAULT_PREFERENCES order
const sortComponentsByPreference = (components, orderArray) => {
    return components.sort((a, b) => {
        const indexA = orderArray.indexOf(a.id);
        const indexB = orderArray.indexOf(b.id);
        return indexA - indexB;
    });
};

function populateCustomizeModal() {
    const container = document.getElementById('component-list-container');
    container.innerHTML = '';

    const componentGroups = {
        'Stat Cards': [],
        'Charts': [],
        'Tables': []
    };

    // Categorize components
    Object.values(allComponents).forEach(component => {
        if (component.type === 'card') {
            componentGroups['Stat Cards'].push(component);
        } else if (component.type === 'chart') {
            componentGroups['Charts'].push(component);
        } else if (component.type === 'table') {
            componentGroups['Tables'].push(component);
        }
    });

    // Sort components within their groups
    componentGroups['Stat Cards'] = sortComponentsByPreference(componentGroups['Stat Cards'], DEFAULT_PREFERENCES.cardOrder);
    componentGroups['Charts'] = sortComponentsByPreference(componentGroups['Charts'], DEFAULT_PREFERENCES.chartOrder);
    componentGroups['Tables'] = sortComponentsByPreference(componentGroups['Tables'], DEFAULT_PREFERENCES.tableOrder);    

    // Render grouped components
    for (const groupName in componentGroups) {
        if (componentGroups[groupName].length > 0) {
            const groupHeader = `<h4 class="font-semibold text-lg mt-4 mb-2 text-base-content">${groupName}</h4>`;
            container.insertAdjacentHTML('beforeend', groupHeader);

            componentGroups[groupName].forEach(component => {
                const isVisible = userPreferences.visibleComponents.includes(component.id);
                const itemHTML = `
                    <div class="flex items-center justify-between p-2 border rounded-lg bg-base-200 mb-2" data-id="${component.id}">
                        <div class="form-control">
                            <label class="label cursor-pointer gap-2">
                                <input type="checkbox" class="checkbox checkbox-sm component-visibility-toggle" data-id="${component.id}" ${isVisible ? 'checked' : ''}>
                                <span class="label-text">${component.title}</span>
                            </label>
                        </div>
                    </div>
                `;
                container.insertAdjacentHTML('beforeend', itemHTML);
            });
        }
    }
}

function initializeDashboard(user) {
    const charts = {}; // To hold chart instances for updates

    const formatCurrency = (value) => new Intl.NumberFormat('en-PH', { style: 'currency', currency: 'PHP' }).format(value || 0);

    function renderSparkline(canvasId, data, color) {
        const ctx = document.getElementById(canvasId);
        if (!ctx) return;
    
        // Destroy existing chart if it exists to prevent memory leaks
        if (sparklines[canvasId]) {
            sparklines[canvasId].destroy();
        }
    
        const gradient = ctx.getContext('2d').createLinearGradient(0, 0, 0, 70);        
        // The color string is expected to be in a format like 'oklch(L C H)'.
        // We modify it to add the alpha channel for the gradient.
        const colorWithAlpha25 = color.replace(')', ' / 0.25)');
        const colorWithAlpha0 = color.replace(')', ' / 0)');
        gradient.addColorStop(0, colorWithAlpha25);
        gradient.addColorStop(1, colorWithAlpha0);
    
        sparklines[canvasId] = new Chart(ctx, {
            type: 'line',
            data: {
                labels: data.map((_, i) => i), // Dummy labels for 30 days
                datasets: [{
                    data: data,
                    borderColor: color,
                    borderWidth: 2,
                    fill: true,
                    backgroundColor: gradient,
                    tension: 0.4,
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                elements: { point: { radius: 0 } },
                plugins: {
                    legend: { display: false },
                    tooltip: { enabled: false }
                },
                scales: {
                    x: { display: false },
                    y: {
                        display: false,
                        beginAtZero: false // Allows chart to zoom into the data's range
                    }
                }
            }
        });
    }

    function renderActiveFilters() {
        const bar = document.getElementById('active-filters-bar');
        const container = document.getElementById('active-filters-container');

        if (!bar || !container) {
            console.error("Active filters bar or container not found.");
            return;
        }

        // Always clear the container first
        container.innerHTML = '';
        const hasFilters = Object.keys(dashboardFilters).length > 0;

        bar.classList.remove('hidden');
        container.innerHTML = '';

        for (const [key, value] of Object.entries(dashboardFilters)) {
            const filterPill = `
                <div class="badge badge-info gap-2">
                    <span class="font-normal capitalize">${key}:</span>
                    <span>${value}</span>
                    <button class="clear-filter-btn" data-filter-key="${key}"><i data-lucide="x" class="h-3 w-3"></i></button>
                </div>
            `;
            container.insertAdjacentHTML('beforeend', filterPill);
        }

        // Hide the entire bar if there are no filters
        bar.classList.toggle('hidden', !hasFilters);

        lucide.createIcons();
    }

    function setupFilterInteractivity() {
        const bar = document.getElementById('active-filters-bar');
        const clearAllBtn = document.getElementById('clear-filters-btn');

        if (!bar || !clearAllBtn) {
            console.error("Could not set up filter interactivity: buttons not found.");
            return;
        }

        // Use a single delegated event listener for all clear actions
        bar.addEventListener('click', (e) => {
            // Handle individual filter clear
            const clearButton = e.target.closest('.clear-filter-btn');
            if (clearButton) {
                const keyToRemove = clearButton.dataset.filterKey;
                if (dashboardFilters[keyToRemove]) {
                    delete dashboardFilters[keyToRemove];
                    renderActiveFilters();
                    fetchDashboardData();
                }
            }
            // Handle "Clear All" button
            if (e.target.closest('#clear-filters-btn')) {
                dashboardFilters = {};
                renderActiveFilters();
                fetchDashboardData();
            }
        });
    }

    async function showDetailsModal(detailsId, title) {
        const modal = document.getElementById('details-modal');
        const modalTitle = document.getElementById('details-modal-title');
        const modalContent = document.getElementById('details-modal-content');

        if (!modal || !modalTitle || !modalContent) return;

        modalTitle.textContent = title;
        modalContent.innerHTML = `<div class="flex justify-center items-center p-8"><i data-lucide="loader-2" class="animate-spin h-8 w-8 text-gray-500"></i></div>`;
        lucide.createIcons();
        modal.showModal();

        try {
            const data = await fetchWithAuth(`dashboard/details/${detailsId}`);
            renderDetailsTable(detailsId, data, modalContent);
        } catch (error) {
            modalContent.innerHTML = `<p class="text-red-500 text-center">Error loading details: ${error.message}</p>`;
        }
    }

    function renderDetailsTable(detailsId, data, container) {
        const formatDate = (dateString) => dateString ? new Date(dateString).toLocaleDateString('en-CA') : 'N/A';
        let tableHTML = '';

        if (!data || data.length === 0) {
            container.innerHTML = '<p class="text-center text-gray-500 py-4">No items to display.</p>';
            return;
        }

        switch (detailsId) {
            case 'pending-requisitions':
                tableHTML = `
                    <table class="table table-zebra table-sm w-full">
                        <thead><tr><th>RIS No.</th><th>Office</th><th>Date Requested</th><th>Items</th></tr></thead>
                        <tbody>
                            ${data.map(req => `
                                <tr>
                                    <td>${req.risNumber}</td>
                                    <td>${req.requestingOffice}</td>
                                    <td>${formatDate(req.dateRequested)}</td>
                                    <td>${req.items.map(item => `<div>- ${item.quantity} ${item.stockItem?.unitOfMeasure || ''} ${item.stockItem?.description || 'N/A'}</div>`).join('')}</td>
                                </tr>
                            `).join('')}
                        </tbody>
                    </table>`;
                break;
            case 'low-stock-items':
                tableHTML = `
                    <table class="table table-zebra table-sm w-full">
                        <thead><tr><th>Stock No.</th><th>Description</th><th class="text-right">Quantity</th><th class="text-right">Re-order Point</th><th>Unit</th></tr></thead>
                        <tbody>
                            ${data.map(item => `
                                <tr>
                                    <td>${item.stockNumber}</td>
                                    <td>${item.description}</td>
                                    <td class="text-right text-red-500 font-bold">${item.quantity}</td>
                                    <td class="text-right">${item.reorderPoint}</td>
                                    <td>${item.unitOfMeasure}</td>
                                </tr>
                            `).join('')}
                        </tbody>
                    </table>`;
                break;
            case 'unassigned-assets':
                tableHTML = `
                    <table class="table table-zebra table-sm w-full">
                        <thead><tr><th>Property No.</th><th>Description</th><th class="text-right">Cost</th><th>Acquisition Date</th></tr></thead>
                        <tbody>
                            ${data.map(asset => `
                                <tr>
                                    <td>${asset.propertyNumber}</td>
                                    <td>${asset.description}</td>
                                    <td class="text-right">${formatCurrency(asset.acquisitionCost)}</td>
                                    <td>${formatDate(asset.acquisitionDate)}</td>
                                </tr>
                            `).join('')}
                        </tbody>
                    </table>`;
                break;
            case 'nearing-eol':
                tableHTML = `
                    <table class="table table-zebra table-sm w-full">
                        <thead><tr><th>Property No.</th><th>Description</th><th>Custodian</th><th>End of Life Date</th></tr></thead>
                        <tbody>
                            ${data.map(asset => `
                                <tr>
                                    <td>${asset.propertyNumber}</td>
                                    <td>${asset.description}</td>
                                    <td>${asset.custodian?.name || 'N/A'}</td>
                                    <td class="text-red-500 font-bold">${formatDate(asset.endOfLifeDate)}</td>
                                </tr>
                            `).join('')}
                        </tbody>
                    </table>`;
                break;
            default:
                tableHTML = '<p>Details view not configured for this item.</p>';
        }
        container.innerHTML = `<div class="overflow-x-auto">${tableHTML}</div>`;
    }

    async function fetchDashboardData() {
        try {
            // NEW: Use the dateRange state object for filters
            const dateFilters = {
                startDate: dateRange.start ? dateRange.start.toISOString().split('T')[0] : '',
                endDate: dateRange.end ? dateRange.end.toISOString().split('T')[0] : ''
            };
            const allFilters = { ...dateFilters, ...dashboardFilters, ...viewOptions };

            // Build query params, excluding empty values to ensure clean requests
            const params = new URLSearchParams();
            for (const [key, value] of Object.entries(allFilters)) {
                if (value) { // Only append if value is not empty, null, or undefined
                    params.append(key, value);
                }
            }
            dashboardData = await fetchWithAuth(`dashboard/stats?${params.toString()}`);

            renderStatCards(dashboardData.stats);
            applyPreferences(); // Apply layout after data is fetched
            createOrUpdateCharts(dashboardData.charts);
            renderActiveActivityTable(); // NEW: Call the new main render function
        } catch (error) {
            console.error('Error fetching dashboard data:', error);
            document.getElementById('stats-container').innerHTML = `<p class="text-red-500 col-span-full">Could not load dashboard data: ${error.message}</p>`;
        }
    }

    function renderStatCards(stats) {
        document.getElementById('stat-portfolio-value').textContent = formatCurrency(stats.totalPortfolioValue?.current || 0);
        document.getElementById('stat-movable-value').textContent = formatCurrency(stats.movableAssetsValue?.current || 0);
        document.getElementById('stat-immovable-value').textContent = formatCurrency(stats.immovableAssetsValue?.current || 0);

        document.getElementById('stat-total-assets').textContent = stats.totalAssets?.current || 0;
        document.getElementById('stat-pending-reqs').textContent = stats.pendingRequisitions?.current || 0;
        document.getElementById('stat-immovable-assets').textContent = stats.immovableAssets?.current || 0;
        document.getElementById('stat-low-stock').textContent = stats.lowStockItems?.current || 0;
        document.getElementById('stat-unassigned-assets').textContent = stats.unassignedAssets?.current || 0;
        document.getElementById('stat-total-depreciation-ytd').textContent = formatCurrency(stats.totalDepreciationYTD?.current || 0);
        document.getElementById('stat-nearing-end-of-life').textContent = stats.nearingEndOfLife?.current || 0;
        const avgTime = stats.avgFulfillmentTime?.current || 0;
        document.getElementById('stat-avg-fulfillment-time').textContent = `${avgTime.toFixed(1)} days`;

        const renderTrend = (el, trend) => {
            if (trend > 0) {
                el.innerHTML = `<i data-lucide="trending-up" class="text-success"></i> +${trend}% from last month`;
            } else if (trend < 0) {
                el.innerHTML = `<i data-lucide="trending-down" class="text-error"></i> ${trend}% from last month`;
            } else {
                el.innerHTML = `No change from last month`;
            }
        };

        renderTrend(document.getElementById('stat-portfolio-value-trend'), stats.totalPortfolioValue?.trend || 0);
        renderTrend(document.getElementById('stat-total-assets-trend'), stats.totalAssets?.trend || 0);
        renderTrend(document.getElementById('stat-pending-reqs-trend'), stats.pendingRequisitions?.trend || 0);
        renderTrend(document.getElementById('stat-immovable-assets-trend'), stats.immovableAssets?.trend || 0);

        // NEW: Render sparklines
        const computedStyle = getComputedStyle(document.documentElement);
        const primaryColor = `oklch(${computedStyle.getPropertyValue('--p').trim()})`;
        const secondaryColor = `oklch(${computedStyle.getPropertyValue('--s').trim()})`;

        if (stats.totalPortfolioValue?.sparkline) {
            renderSparkline('sparkline-portfolio-value', stats.totalPortfolioValue.sparkline, primaryColor);
        }
        if (stats.totalAssets?.sparkline) {
            renderSparkline('sparkline-total-assets', stats.totalAssets.sparkline, secondaryColor);
        }
        lucide.createIcons();
    }

// NEW: Custom Chart.js plugin to generate a clear, two-column HTML legend for the donut chart.
const htmlLegendPlugin = {
    id: 'htmlLegend',
    afterUpdate(chart, args, options) {
        const legendContainer = document.getElementById(options.containerID);
        if (!legendContainer) return;

        // Clear old legend
        legendContainer.innerHTML = '';

        const { datasets } = chart.data;
        if (!datasets || datasets.length < 2) return;

        const createLegendList = (title, dataset, datasetIndex) => {
            const meta = chart.getDatasetMeta(datasetIndex);
            if (!meta) return '';

            let itemsHTML = dataset.labels.map((label, i) => {
                const value = dataset.data[i];
                const bgColor = dataset.backgroundColor[i];
                const isHidden = meta.data[i] && meta.data[i].hidden;

                return `
                    <li class="flex items-center justify-between cursor-pointer p-1 rounded hover:bg-base-200" 
                        data-dataset-index="${datasetIndex}" data-index="${i}"
                        style="${isHidden ? 'text-decoration: line-through; opacity: 0.6;' : ''}">
                        <div class="flex items-center gap-2">
                            <span class="h-3 w-3 rounded-full" style="background-color: ${bgColor}"></span>
                            <span class="text-sm">${label}</span>
                        </div>
                        <span class="text-sm font-semibold">${value}</span>
                    </li>
                `;
            }).join('');

            return `
                <div>
                    <h4 class="font-semibold mb-1 text-base-content/80">${title}</h4>
                    <ul class="space-y-1">
                        ${itemsHTML}
                    </ul>
                </div>
            `;
        };
        // Generate two separate sections that will stack vertically
        legendContainer.innerHTML = `
            <div class="space-y-4">
                ${createLegendList('Status', datasets[0], 0)}
                ${createLegendList('Condition', datasets[1], 1)}
            </div>
        `;

        // Add click handlers to make the new legend interactive
        legendContainer.querySelectorAll('li').forEach(item => {
            item.onclick = () => {
                const datasetIndex = parseInt(item.dataset.datasetIndex, 10);
                const index = parseInt(item.dataset.index, 10);
                chart.toggleDataVisibility(datasetIndex, index);
                chart.update();
            };
        });
    }
};

    function createOrUpdateCharts(chartData) {
        const chartConfigs = {
            // REVERTED: Simple line chart for acquisition value
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
                                    if (label) { label += ': '; }
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
                    plugins: {
                        tooltip: {
                            callbacks: {
                                label: function(context) {
                                    let label = context.dataset.label || '';
                                    if (label) {
                                        label += ': ';
                                    }
                                    if (context.parsed.x !== null) {
                                        // Check if we are in 'value' mode from the toggle's state
                                        const isValueMode = document.getElementById('office-group-by-toggle')?.checked;
                                        if (isValueMode) {
                                            label += formatCurrency(context.parsed.x);
                                        } else {
                                            label += context.parsed.x;
                                        }
                                    }
                                    return label;
                                }
                            }
                        }
                    },
                    indexAxis: 'y',
                },
                filterKey: 'office'
            },
            assetDistributionChart: {
                type: 'doughnut',
                data: chartData.assetDistribution, // This will be prepared by the backend
                options: {
                    // The onClick handler for filtering is now handled by the main chart config
                    plugins: {
                        legend: {
                            display: false // Disable the default canvas legend
                        },
                        // NEW: Register and configure the custom HTML legend plugin
                        htmlLegend: {
                            containerID: 'assetDistributionLegend'
                        },
                        tooltip: {
                            callbacks: {
                                label: function(context) {
                                    const dataset = context.chart.data.datasets[context.datasetIndex];
                                    const label = dataset.labels[context.dataIndex] || '';
                                    let labelString = '';
                                    if (label) {
                                        labelString += `${label}: `;
                                    }
                                    const value = context.parsed;
                                    const total = dataset.data.reduce((a, b) => a + b, 0);
                                    const percentage = total > 0 ? ((value / total) * 100).toFixed(1) + '%' : '0%';
                                    labelString += `${value} (${percentage})`;
                                    return labelString;
                                }
                            }
                        }
                    }
                },
                // Custom property to handle filtering for multiple datasets
                filterKeys: ['status', 'condition']
            }
        };

        for (const [id, config] of Object.entries(chartConfigs)) {
            const ctx = document.getElementById(id).getContext('2d');

            // NEW: Register the custom legend plugin globally for all charts
            // It will only activate if the options specify a `containerID`.
            const chartPlugins = [htmlLegendPlugin];

            // If the chart already exists, we might need to unregister plugins before re-registering
            if (Chart.getChart(ctx)) {
                Chart.getChart(ctx).destroy();
            }

            // Special color handling for the new assetDistributionChart
            if (id === 'assetDistributionChart' && config.data.datasets.length > 0) {
                const colorMap = {
                    // Status Colors
                    'In Use': '#22c55e',        // green-500
                    'In Storage': '#a8a29e',    // stone-400
                    'For Repair': '#f59e0b',    // amber-500
                    'Missing': '#ef4444',       // red-500
                    'Waste': '#f97316',         // orange-500
                    'Disposed': '#71717a',      // zinc-500
                    // Condition Colors
                    'Very Good (VG)': '#10b981', // emerald-500
                    'Good Condition (G)': '#84cc16', // lime-500
                    'Fair Condition (F)': '#eab308', // yellow-500
                    'Poor Condition (P)': '#f97316', // orange-500
                    'Scrap Condition (S)': '#ef4444', // red-500
                    'Not Set': '#9ca3af', // gray-400
                };
                // Assign colors to both datasets based on their respective labels
                config.data.datasets.forEach(dataset => {
                    dataset.backgroundColor = dataset.labels.map(label => colorMap[label] || '#6b7280');
                });
            }

            // Always create a new chart instance to ensure plugins are registered correctly
            // This also simplifies the logic by removing the if/else for chart existence.
                charts[id] = new Chart(ctx, {
                    type: config.type,
                    data: config.data,
                    plugins: chartPlugins, // Register our custom plugin
                    options: {
                        responsive: true,
                        maintainAspectRatio: false,
                        plugins: { legend: { display: config.type !== 'line' } },
                        ...config.options,
                        onClick: (event) => {
                            if (config.filterKey) { // For simple charts
                                onChartClick(event, charts[id], config.filterKey);
                            } else if (config.filterKeys) { // For multi-dataset chart
                                onMultiDatasetChartClick(event, charts[id], config.filterKeys);
                            }
                        }
                    }
                });
        }
    }

    function onChartClick(event, chart, filterKey) {
        const points = chart.getElementsAtEventForMode(event, 'nearest', { intersect: true }, true);
        if (points.length) {
            const firstPoint = points[0];
            const label = chart.data.labels[firstPoint.index];

            // Update the filter state
            dashboardFilters[filterKey] = label;

            // Re-render the active filters display
            renderActiveFilters();

            // Fetch new data with the applied filter
            fetchDashboardData();
        }
    }

    // NEW: Click handler for multi-dataset charts like the combined donut
    function onMultiDatasetChartClick(event, chart, filterKeys) {
        const points = chart.getElementsAtEventForMode(event, 'nearest', { intersect: true }, true);
        if (points.length) {
            const firstPoint = points[0];
            const datasetIndex = firstPoint.datasetIndex;
            const dataIndex = firstPoint.index;

            const filterKey = filterKeys[datasetIndex]; // e.g., 'status' or 'condition'
            
            // NEW: Correctly get the label from the specific dataset
            // The default `context.label` would be incorrect for a multi-dataset chart.
            const label = chart.data.datasets[datasetIndex].labels[dataIndex];

            dashboardFilters[filterKey] = label;
            renderActiveFilters();
            fetchDashboardData();
        }
    }

    // NEW: Custom toggle function for the legend plugin to handle multi-ring donuts
    Chart.prototype.toggleDataVisibility = function(datasetIndex, index) {
        const meta = this.getDatasetMeta(datasetIndex);
        if (meta && meta.data[index]) {
            meta.data[index].hidden = !meta.data[index].hidden;
        }
    };

    // --- NEW: REFACTORED RECENT ACTIVITY TABLE LOGIC ---

    function renderActivityTable(config) {
        const thead = document.getElementById('recent-activity-thead');
        const tbody = document.getElementById('recent-activity-tbody');

        if (!thead || !tbody) return;

        // Set Headers
        thead.innerHTML = config.headers ? `<tr>${config.headers.map(h => `<th>${h}</th>`).join('')}</tr>` : '';

        // Set Body
        const items = config.data;
        if (items && items.length > 0) {
            tbody.innerHTML = items.map(config.rowRenderer).join('');
        } else {
            tbody.innerHTML = `<tr><td colspan="${config.headers?.length || 1}" class="text-center text-gray-500 py-4">${config.noDataMessage}</td></tr>`;
        }
    }

    function renderActiveActivityTable(tableType) {
        if (!dashboardData) return; // Don't render if data isn't loaded

        // If tableType is not provided (e.g., on initial load), 
        // determine it from the currently checked tab.
        if (!tableType) {
            const activeTab = document.querySelector('input[name="activity_tabs"]:checked');
            tableType = activeTab ? activeTab.dataset.table : 'assets';
        }

        const tableConfigs = {
            assets: {
                headers: null, // No explicit header for this one
                data: dashboardData.recentAssets,
                noDataMessage: 'No recent assets.',
                rowRenderer: (asset) => `
                    <tr>
                        <td data-label="Asset">
                            <div class="flex-1 min-w-0 break-all text-right md:text-left">
                                <div class="font-bold">${asset.name || asset.description}</div>
                                <div class="text-sm opacity-50">${asset.propertyNumber}</div>
                            </div>
                        </td>
                        <td data-label="Office"><div class="flex-1 min-w-0 break-all text-right md:text-left">${asset.custodian?.office || 'N/A'}</div></td>
                        <td data-label="Date"><div class="flex-1 min-w-0 break-all text-right md:text-left"><span class="badge badge-ghost badge-sm">${new Date(asset.acquisitionDate).toLocaleDateString()}</span></div></td>
                    </tr>`
            },
            transfers: {
                headers: ['PTR No.', 'Date', 'From', 'To', 'Assets'],
                data: dashboardData.recentTransfers,
                noDataMessage: 'No recent transfers.',
                rowRenderer: (transfer) => `
                    <tr>
                        <td data-label="PTR No."><div class="flex-1 min-w-0 break-all text-right md:text-left">${transfer.ptrNumber}</div></td>
                        <td data-label="Date"><div class="flex-1 min-w-0 break-all text-right md:text-left">${new Date(transfer.date).toLocaleDateString()}</div></td>
                        <td data-label="From"><div class="flex-1 min-w-0 break-all text-right md:text-left">${transfer.from.name} (${transfer.from.office})</div></td>
                        <td data-label="To"><div class="flex-1 min-w-0 break-all text-right md:text-left">${transfer.to.name} (${transfer.to.office})</div></td>
                        <td data-label="Assets"><div class="flex-1 min-w-0 break-all text-right">${transfer.assets.length} asset(s)</div></td>
                    </tr>`
            },
            requisitions: {
                headers: null,
                data: dashboardData.recentRequisitions,
                noDataMessage: 'No recent requisitions.',
                rowRenderer: (req) => `
                    <tr>
                        <td data-label="Requisition">
                            <div class="flex-1 min-w-0 break-all text-right md:text-left">
                                <div class="font-bold">${req.requestingOffice}</div>
                                <div class="text-sm opacity-50">${req.risNumber}</div>
                            </div>
                        </td>
                        <td data-label="Status"><div class="flex-1 min-w-0 break-all text-right md:text-left"><span class="badge badge-ghost badge-sm">${req.status}</span></div></td>
                    </tr>`
            },
            supplies: {
                headers: ['Item', 'Total Issued'],
                data: dashboardData.topSupplies,
                noDataMessage: 'Not enough data for top supplies.',
                rowRenderer: (supply) => `
                    <tr>
                        <td data-label="Item">
                            <div class="flex-1 min-w-0 break-all text-right md:text-left">
                                <div class="font-bold">${supply.description}</div>
                                <div class="text-sm opacity-50">${supply.stockNumber}</div>
                            </div>
                        </td>
                        <td data-label="Total Issued" class="font-semibold"><div class="flex-1 min-w-0 break-all text-right">${supply.totalIssued}</div></td>
                    </tr>`
            },
            immovable: {
                headers: ['PIN', 'Name', 'Type', 'Location', 'Acq. Date'],
                data: dashboardData.recentImmovableAssets,
                noDataMessage: 'No recent immovable properties.',
                rowRenderer: (asset) => `
                    <tr>
                        <td data-label="PIN"><div class="flex-1 min-w-0 break-all text-right md:text-left">${asset.propertyIndexNumber}</div></td>
                        <td data-label="Name"><div class="flex-1 min-w-0 break-all text-right md:text-left">${asset.name}</div></td>
                        <td data-label="Type"><div class="flex-1 min-w-0 break-all text-right md:text-left">${asset.type}</div></td>
                        <td data-label="Location"><div class="flex-1 min-w-0 break-all text-right md:text-left">${asset.location}</div></td>
                        <td data-label="Acq. Date"><div class="flex-1 min-w-0 break-all text-right md:text-left">${new Date(asset.dateAcquired).toLocaleDateString()}</div></td>
                    </tr>`
            }
        };

        if (tableConfigs[tableType]) {
            renderActivityTable(tableConfigs[tableType]);
        }
    }

    function setupEventListeners() {
        const statsContainer = document.getElementById('stats-container');
        // Delegated event listener for all clickable stat cards
        statsContainer.addEventListener('click', (e) => {
            const card = e.target.closest('.dashboard-component[data-url], .dashboard-component[data-details-id], .sub-stat-link[data-url]');
            if (!card) return;

            const url = card.dataset.url;
            const detailsId = card.dataset.detailsId;
            const filterKey = card.dataset.filterKey;
            const filterValue = card.dataset.filterValue;

            if (detailsId) {
                const title = card.querySelector('.stat-title')?.textContent || 'Details';
                showDetailsModal(detailsId, title);
            } else if (url) {
                if (card.classList.contains('sub-stat-link')) {
                    // This is a sub-stat link, we need to pass all active dashboard filters to the registry page.
                    const params = new URLSearchParams();

                    // FIX: Use the dateRange state object instead of non-existent elements
                    if (dateRange.start) params.append('startDate', dateRange.start.toISOString().split('T')[0]);
                    if (dateRange.end) params.append('endDate', dateRange.end.toISOString().split('T')[0]);

                    // Add interactive filters (office, status, condition)
                    const isImmovable = url.includes('immovable-registry.html');
                    for (const [key, value] of Object.entries(dashboardFilters)) {
                        // The immovable registry doesn't have an 'office' filter, so don't pass it.
                        if (isImmovable && key === 'office') continue;
                        params.append(key, value);
                    }
                    
                    const queryString = params.toString();
                    window.location.href = `${url}${queryString ? `?${queryString}` : ''}`;
                } else {
                    window.location.href = url;
                }
            }
        });

        // NEW: Event listener for activity tabs
        const activityTabsContainer = document.getElementById('activity-tabs-container');
        if (activityTabsContainer) {
            // Use 'click' which is more reliable for radio inputs styled as buttons.
            activityTabsContainer.addEventListener('click', (e) => {
                // Ensure the clicked element is one of our tabs
                if (e.target.name === 'activity_tabs') {
                    // Get the table type directly from the clicked element's data attribute
                    const tableType = e.target.dataset.table;
                    renderActiveActivityTable(tableType);
                }
            });
        }

        // NEW: Event listener for the office chart group-by toggle
        const officeGroupByToggle = document.getElementById('office-group-by-toggle');
        if (officeGroupByToggle) {
            // Set initial state for viewOptions
            viewOptions.groupByOffice = officeGroupByToggle.checked ? 'value' : 'count';
            officeGroupByToggle.addEventListener('change', (e) => {
                viewOptions.groupByOffice = e.target.checked ? 'value' : 'count';
                fetchDashboardData();
            });
        }
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

    function initializeDateRangePicker() {
        const pickerInput = document.getElementById('date-range-picker');
        if (!pickerInput) return;

        const picker = new Litepicker({
            element: pickerInput,
            singleMode: false,
            format: 'MMM DD, YYYY',
            tooltipText: {
                one: 'day',
                other: 'days'
            },
            setup: (picker) => {
                picker.on('selected', (date1, date2) => {
                    // Update state and fetch data
                    dateRange.start = date1.dateInstance;
                    dateRange.end = date2.dateInstance;
                    fetchDashboardData();
                });
            }
        });

        // Set initial date range (last 30 days) and trigger initial load
        const endDate = new Date();
        const startDate = new Date();
        startDate.setDate(endDate.getDate() - 29);
        picker.setDateRange(startDate, endDate);
    }

    // --- INITIALIZATION ---
    initializeDateRangePicker(); // This will trigger the initial data load
    setupEventListeners();
    setupDashboardInteractivity();
    setupFilterInteractivity(); // Re-add the call to attach filter clear event listeners
}