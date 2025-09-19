import { getGsoToken } from '../js/auth.js';
import { fetchWithAuth, BASE_URL } from '../js/api.js';
import { createUIManager } from '../js/ui.js';
import { createAuthenticatedPage } from '../js/page-loader.js';

createAuthenticatedPage({
    permission: 'admin:data:read',
    pageInitializer: initializePage,
    pageName: 'Data Management'
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

    // --- Reusable Functions ---
    async function performHealthCheck() {
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
                performHealthCheck,
                'btn-info' // Use a different color for non-destructive actions
            );
        });
    }

    // Add event listener for the dynamically created "Fix All" button
    healthCheckResultsContent.addEventListener('click', async (e) => {
        const fixMismatchedBtn = e.target.closest('#fix-designations-btn');
        if (fixMismatchedBtn) {
            showConfirmationModal(
                'Fix Mismatched Designations',
                'This will update the designation on all listed assets to match the official designation in the Employees database. This action cannot be undone. Continue?',
                async () => {
                    fixMismatchedBtn.disabled = true;
                    fixMismatchedBtn.innerHTML = `<span class="loading loading-spinner loading-xs"></span> Fixing...`;

                    try {
                        const result = await fetchWithAuth('admin/health-check/fix-designations', { method: 'POST' });
                        showToast(result.message, 'success');
                        await performHealthCheck(); // Re-run the health check to show the updated results
                    } catch (error) {
                        showToast(`Error fixing designations: ${error.message}`, 'error');
                        fixMismatchedBtn.disabled = false;
                        fixMismatchedBtn.innerHTML = `<i data-lucide="wrench" class="h-4 w-4"></i> Fix All`;
                        lucide.createIcons();
                    }
                },
                'btn-secondary'
            );
            return; // Stop further execution
        }

        const fixMissingBtn = e.target.closest('#fix-missing-designations-btn');
        if (fixMissingBtn) {
            showConfirmationModal(
                'Fix Missing Designations',
                'This will look up and populate the designation for all listed assets from the Employees database. This action cannot be undone. Continue?',
                async () => {
                    fixMissingBtn.disabled = true;
                    fixMissingBtn.innerHTML = `<span class="loading loading-spinner loading-xs"></span> Fixing...`;

                    try {
                        const result = await fetchWithAuth('admin/health-check/fix-missing-designations', { method: 'POST' });
                        showToast(result.message, 'success');
                        await performHealthCheck(); // Re-run the health check
                    } catch (error) {
                        showToast(`Error fixing designations: ${error.message}`, 'error');
                        fixMissingBtn.disabled = false;
                        fixMissingBtn.innerHTML = `<i data-lucide="wrench" class="h-4 w-4"></i> Fix All`;
                        lucide.createIcons();
                    }
                },
                'btn-secondary'
            );
        }
    });
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

            // Add the "Fix All" button specifically for the designation mismatch section
            if (title === 'Assets with Mismatched Custodian Designations' && items.length > 0) {
                html += `<button id="fix-designations-btn" class="btn btn-secondary btn-sm mt-2"><i data-lucide="wrench" class="h-4 w-4"></i> Fix All (${items.length})</button>`;
            }

            // Add the "Fix All" button specifically for the missing designation section
            if (title === 'Assets with Missing Custodian Designations' && items.length > 0) {
                html += `<button id="fix-missing-designations-btn" class="btn btn-secondary btn-sm mt-2"><i data-lucide="wrench" class="h-4 w-4"></i> Fix All (${items.length})</button>`;
            }
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

    renderSection(
        'Assets with Mismatched Custodian Designations',
        report.mismatchedCustodianDesignations,
        [
            { label: 'Property No.', path: 'propertyNumber' },
            { label: 'Custodian', path: 'custodian.name' },
            { label: 'Asset Designation', path: 'assetDesignation' },
            { label: 'Correct Designation', path: 'correctDesignation' }
        ]
    );

    renderSection(
        'Assets with Missing Custodian Designations',
        report.missingCustodianDesignations,
        [
            { label: 'Property No.', path: 'propertyNumber' },
            { label: 'Description', path: 'description' },
            { label: 'Custodian', path: 'custodian.name' }
        ]
    );

    renderSection(
        'Assets with Missing Custodian Designations',
        report.missingCustodianDesignations,
        [
            { label: 'Property No.', path: 'propertyNumber' },
            { label: 'Description', path: 'description' },
            { label: 'Custodian', path: 'custodian.name' }
        ]
    );

    container.innerHTML = html;
    lucide.createIcons(); // Ensure new icons (like the wrench) are rendered
}
