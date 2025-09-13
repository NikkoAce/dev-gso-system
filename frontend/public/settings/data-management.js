import { getCurrentUser, gsoLogout, getGsoToken } from '../js/auth.js';
import { fetchWithAuth, BASE_URL } from '../js/api.js';
import { createUIManager } from '../js/ui.js';

document.addEventListener('DOMContentLoaded', async () => {
    try {
        const user = await getCurrentUser();
        if (!user) return;

        if (!user.permissions || !user.permissions.includes('admin:data:read')) {
            window.location.href = '../dashboard/dashboard.html';
            return;
        }
        initializeLayout(user, gsoLogout);
        initializePage(user);
    } catch (error) {
        console.error("Authentication failed:", error);
    }
});

function initializePage(user) {
    const { showToast, showConfirmationModal } = createUIManager();
    const userPermissions = user.permissions || [];

    // --- DOM Elements ---
    const migrateBtn = document.getElementById('migrate-conditions-btn');
    const migrationContainer = document.getElementById('migration-container');
    const resultsContainer = document.getElementById('migration-results');
    const resultsPre = document.getElementById('results-pre');
    const exportDbBtn = document.getElementById('export-db-btn');
    const backupContainer = document.getElementById('backup-container');
    const healthCheckContainer = document.getElementById('health-check-container');
    const runHealthCheckBtn = document.getElementById('run-health-check-btn');
    const healthCheckResultsContainer = document.getElementById('health-check-results-container');
    const healthCheckResultsContent = document.getElementById('health-check-results-content');

    // --- Permission-based UI visibility ---
    if (userPermissions.includes('admin:data:migrate') && migrationContainer) {
        migrationContainer.classList.remove('hidden');
        migrationContainer.classList.add('flex');
    }
    if (userPermissions.includes('admin:database:export') && backupContainer) {
        backupContainer.classList.remove('hidden');
        backupContainer.classList.add('flex');
    }
    if (userPermissions.includes('admin:data:read') && healthCheckContainer) {
        healthCheckContainer.classList.remove('hidden');
        healthCheckContainer.classList.add('flex');
    }

    // --- Event Listeners ---
    if (migrateBtn) {
        migrateBtn.addEventListener('click', () => {
            showConfirmationModal(
                'Confirm Data Migration',
                'Are you sure you want to run this migration? This will permanently alter asset condition data. It is highly recommended to back up the database first.',
                async () => {
                    migrateBtn.disabled = true;
                    migrateBtn.innerHTML = `<span class="loading loading-spinner loading-xs"></span> Migrating...`;
                    resultsContainer.classList.add('hidden');

                    try {
                        const result = await fetchWithAuth('admin/migrate-conditions', {
                            method: 'POST',
                        });
                        
                        resultsPre.textContent = JSON.stringify(result, null, 2);
                        resultsContainer.classList.remove('hidden');
                        showToast('Migration completed successfully!', 'success');

                    } catch (error) {
                        resultsPre.textContent = `Error: ${error.message}\n\n${error.stack || ''}`;
                        resultsContainer.classList.remove('hidden');
                        showToast(`Migration failed: ${error.message}`, 'error');
                    } finally {
                        migrateBtn.disabled = false;
                        migrateBtn.innerHTML = `<i data-lucide="database"></i> Run Migration`;
                        lucide.createIcons();
                    }
                }
            );
        });
    }

    if (exportDbBtn) {
        exportDbBtn.addEventListener('click', () => {
            showConfirmationModal(
                'Confirm Database Export',
                'This will generate and download a complete backup of the database. This process can be resource-intensive. Do you want to continue?',
                async () => {
                    exportDbBtn.disabled = true;
                    exportDbBtn.innerHTML = `<span class="loading loading-spinner loading-xs"></span> Exporting...`;

                    try {
                        const token = getGsoToken();
                        const response = await fetch(`${BASE_URL}/admin/export-database`, {
                            method: 'POST',
                            headers: { 'Authorization': `Bearer ${token}` }
                        });

                        if (!response.ok) throw new Error(`Server responded with status ${response.status}`);

                        const blob = await response.blob();
                        const header = response.headers.get('Content-Disposition');
                        const filename = header ? header.match(/filename="(.+)"/)[1] : `gso-backup-${new Date().toISOString().split('T')[0]}.gz`;

                        const url = window.URL.createObjectURL(blob);
                        const a = document.createElement('a');
                        a.style.display = 'none';
                        a.href = url;
                        a.download = filename;
                        document.body.appendChild(a);
                        a.click();
                        window.URL.revokeObjectURL(url);
                        a.remove();
                        showToast('Database export started successfully.', 'success');
                    } catch (error) {
                        showToast(`Export failed: ${error.message}`, 'error');
                    } finally {
                        exportDbBtn.disabled = false;
                        exportDbBtn.innerHTML = `<i data-lucide="download-cloud"></i> Download Backup`;
                        lucide.createIcons();
                    }
                }
            );
        });
    }

    if (runHealthCheckBtn) {
        runHealthCheckBtn.addEventListener('click', () => {
            showConfirmationModal(
                'Confirm Data Health Check',
                'This will scan the database for inconsistencies. This is a read-only operation and will not change any data. Do you want to continue?',
                async () => {
                    runHealthCheckBtn.disabled = true;
                    runHealthCheckBtn.innerHTML = `<span class="loading loading-spinner loading-xs"></span> Checking...`;
                    healthCheckResultsContainer.classList.add('hidden');

                    try {
                        const result = await fetchWithAuth('admin/health-check');
                        renderHealthCheckReport(result.report, healthCheckResultsContent);
                        healthCheckResultsContainer.classList.remove('hidden');
                        showToast('Health check completed.', 'success');
                    } catch (error) {
                        healthCheckResultsContent.textContent = `Error: ${error.message}\n\n${error.stack || ''}`;
                        healthCheckResultsContainer.classList.remove('hidden');
                        showToast(`Health check failed: ${error.message}`, 'error');
                    } finally {
                        runHealthCheckBtn.disabled = false;
                        runHealthCheckBtn.innerHTML = `<i data-lucide="shield-check"></i> Run Check`;
                        lucide.createIcons();
                    }
                },
                'btn-info' // Use a different color for non-destructive actions
            );
        });
    }
}

function renderHealthCheckReport(report, container) {
    let html = '';
    const renderSection = (title, items, fields) => {
        html += `<h4 class="font-bold text-sm mt-4 mb-2 text-base-content/80">${title} (${items.length})</h4>`;
        if (items.length === 0) {
            html += `<p class="text-success text-xs">No issues found in this category.</p>`;
        } else {
            html += `<div class="bg-base-100 p-2 rounded-md max-h-40 overflow-y-auto">`;
            html += `<ul class="space-y-2">`;
            items.forEach(item => {
                const details = fields.map(fieldInfo => {
                    const value = fieldInfo.path.split('.').reduce((o, i) => o ? o[i] : 'N/A', item);
                    return `<li><span class="font-semibold">${fieldInfo.label}:</span> ${value}</li>`;
                }).join('');
                html += `<li class="border-b border-base-300 pb-1 last:border-b-0"><ul>${details}</ul></li>`;
            });
            html += `</ul></div>`;
        }
    };

    renderSection(
        'Movable Assets with Missing Custodians',
        report.orphanedMovableAssetsByCustodian,
        [
            { label: 'Property No.', path: 'propertyNumber' },
            { label: 'Description', path: 'description' },
            { label: 'Orphaned Custodian', path: 'custodian.name' }
        ]
    );

    renderSection(
        'Movable Assets with Missing Categories',
        report.orphanedMovableAssetsByCategory,
        [
            { label: 'Property No.', path: 'propertyNumber' },
            { label: 'Description', path: 'description' },
            { label: 'Orphaned Category', path: 'category' }
        ]
    );

    renderSection(
        'Requisitions with Missing Stock Items',
        report.orphanedRequisitionItems,
        [
            { label: 'RIS No.', path: 'risNumber' },
            { label: 'Item Description', path: 'items.description' },
            { label: 'Missing Item ID', path: 'items.stockItem' }
        ]
    );

    renderSection(
        'Immovable Assets with Missing Parent Assets',
        report.orphanedImmovableChildren,
        [
            { label: 'PIN', path: 'propertyIndexNumber' },
            { label: 'Asset Name', path: 'name' },
            { label: 'Missing Parent ID', path: 'parentAsset' }
        ]
    );

    container.innerHTML = html;
}
