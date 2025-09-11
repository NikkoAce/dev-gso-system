import { getCurrentUser, gsoLogout } from '../js/auth.js';
import { fetchWithAuth } from '../js/api.js';
import { createUIManager } from '../js/ui.js';

document.addEventListener('DOMContentLoaded', async () => {
    try {
        const user = await getCurrentUser();
        if (!user) return;

        if (!user.permissions || !user.permissions.includes('settings:manage')) {
            window.location.href = '../dashboard/dashboard.html';
            return;
        }
        initializeLayout(user, gsoLogout);
        initializePage();
    } catch (error) {
        console.error("Authentication failed:", error);
    }
});

function initializePage() {
    const { showToast, showConfirmationModal } = createUIManager();

    const migrateBtn = document.getElementById('migrate-conditions-btn');
    const resultsContainer = document.getElementById('migration-results');
    const resultsPre = document.getElementById('results-pre');

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