// FILE: frontend/public/categories.js
import { getCurrentUser, gsoLogout } from '../js/auth.js';
import { createSettingsPage } from '../js/settingsPageFactory.js';

document.addEventListener('DOMContentLoaded', async () => {
    try {
        const user = await getCurrentUser();
        if (!user) return;

        if (!user.permissions || !user.permissions.includes('settings:manage')) {
            window.location.href = '../dashboard/dashboard.html';
            return;
        }

        initializeLayout(user, gsoLogout);

        createSettingsPage({
            apiEndpoint: 'categories',
            entityName: 'Category',
            entityNamePlural: 'Categories',
            list: {
                containerId: 'category-list',
                searchKeys: ['name'],
                columns: [
                    { header: 'Category Name', key: 'name' },
                    { header: 'Account Group', key: 'accountGroup' },
                    { header: 'Major Account', key: 'majorAccountGroup' },
                    { header: 'Sub-Major Group', key: 'subMajorGroup' },
                    { header: 'GL Account', key: 'glAccount' }
                ],
                renderRow: (item) => {
                    const isDeletable = item.assetCount === 0;
                    const deleteButtonHTML = isDeletable
                        ? `<button class="delete-btn btn btn-ghost btn-xs text-red-500" data-id="${item._id}" title="Delete Category"><i data-lucide="trash-2" class="h-4 w-4"></i></button>`
                        : `<div class="tooltip" data-tip="Cannot delete: Category is in use by ${item.assetCount} asset(s).">
                               <button class="btn btn-ghost btn-xs" disabled><i data-lucide="trash-2" class="h-4 w-4"></i></button>
                           </div>`;
                    return `
                        <td>${item.name}</td>
                        <td>${item.accountGroup || 'N/A'}</td>
                        <td>${item.majorAccountGroup || 'N/A'}</td>
                        <td>${item.subMajorGroup}</td>
                        <td>${item.glAccount}</td>
                        <td class="text-center">
                            <div class="flex justify-center items-center gap-1">
                                <button class="edit-btn btn btn-ghost btn-xs" data-id="${item._id}" title="Edit Category"><i data-lucide="edit" class="h-4 w-4"></i></button>
                                ${deleteButtonHTML}
                            </div>
                        </td>
                    `;
                }
            },
            form: {
                id: 'add-category-form',
                idInput: 'category-id',
                titleId: 'category-form-title',
                submitBtnId: 'submit-category-btn',
                cancelBtnId: 'cancel-edit-btn',
                fields: [
                    { id: 'new-category-name', key: 'name', label: 'Category Name', required: true },
                    { id: 'new-account-group', key: 'accountGroup', label: 'Account Group', required: false },
                    { id: 'new-major-account-group', key: 'majorAccountGroup', label: 'Major Account Group', required: false },
                    { id: 'new-sub-major-group', key: 'subMajorGroup', label: 'Sub-Major Group Code', required: true },
                    { id: 'new-gl-account', key: 'glAccount', label: 'GL Account Code', required: true }
                ]
            }
        });
    } catch (error) {
        console.error("Authentication failed on categories page:", error);
    }
});
