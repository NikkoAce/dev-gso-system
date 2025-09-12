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

    // --- Permission-based UI visibility ---
    if (userPermissions.includes('admin:data:migrate') && migrationContainer) {
        migrationContainer.classList.remove('hidden');
        migrationContainer.classList.add('flex');
    }
    if (userPermissions.includes('admin:database:export') && backupContainer) {
        backupContainer.classList.remove('hidden');
        backupContainer.classList.add('flex');
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
}