// FILE: frontend/public/categories.js
import { createAuthenticatedPage } from '../js/page-loader.js';
import { createSettingsPage } from '../js/settingsPageFactory.js';

createAuthenticatedPage({
    permission: 'settings:manage',
    pageInitializer: async (user) => {
        const config = {
            apiEndpoint: 'categories',
            entityName: 'Category',
            entityNamePlural: 'Categories',
            addNewBtnId: 'add-new-btn', // NEW
            modal: { // NEW
                id: 'settings-modal'
            },
            list: {
                containerId: 'category-list',
                searchKeys: ['name', 'subMajorGroup', 'glAccount'],
                defaultSortKey: 'name',
                renderRow: (item) => {
                    const isDeletable = item.assetCount === 0;
                    const deleteButtonHTML = isDeletable
                        ? `<button class="delete-btn btn btn-ghost btn-xs text-red-500" data-id="${item._id}" title="Delete Category"><i data-lucide="trash-2" class="h-4 w-4"></i></button>`
                        : `<div class="tooltip" data-tip="Cannot delete: Category is in use by ${item.assetCount} asset(s)."><button class="btn btn-ghost btn-xs" disabled><i data-lucide="trash-2" class="h-4 w-4"></i></button></div>`;
                    return `
                        <tr id="item-row-${item._id}">
                            <td data-label="Category Name">${item.name}</td>
                            <td data-label="Account Group">${item.accountGroup || 'N/A'}</td>
                            <td data-label="Major Account">${item.majorAccountGroup || 'N/A'}</td>
                            <td data-label="Sub-Major Group">${item.subMajorGroup}</td>
                            <td data-label="GL Account">${item.glAccount}</td>
                            <td data-label="Actions" class="text-center">
                                <div class="flex justify-center items-center gap-1">
                                    <button class="edit-btn btn btn-ghost btn-xs" data-id="${item._id}" title="Edit Category"><i data-lucide="edit" class="h-4 w-4"></i></button>
                                    ${deleteButtonHTML}
                                </div>
                            </td>
                        </tr>
                    `;
                }
            },
            form: {
                id: 'add-category-form',
                titleId: 'category-form-title',
                idInput: 'category-id',
                submitBtnId: 'submit-category-btn',
                cancelBtnId: 'cancel-edit-btn',
                fields: [
                    { id: 'new-category-name', key: 'name', required: true, label: 'Category Name' },
                    { id: 'new-account-group', key: 'accountGroup' },
                    { id: 'new-major-account-group', key: 'majorAccountGroup' },
                    { id: 'new-sub-major-group', key: 'subMajorGroup', required: true, label: 'Sub-Major Group' },
                    { id: 'new-gl-account', key: 'glAccount', required: true, label: 'GL Account' },
                ]
            }
        };
        createSettingsPage(config);
    },
    pageName: 'Manage Categories'
});
