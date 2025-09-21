// FILE: frontend/public/offices.js
import { createAuthenticatedPage } from '../js/page-loader.js';
import { createSettingsPage } from '../js/settingsPageFactory.js';

createAuthenticatedPage({
    permission: 'settings:manage',
    pageInitializer: async (user) => {
        const config = {
            apiEndpoint: 'offices',
            entityName: 'Office',
            entityNamePlural: 'Offices',
            addNewBtnId: 'add-new-btn',
            modal: {
                id: 'settings-modal'
            },
            list: {
                containerId: 'office-list',
                searchKeys: ['name', 'code'],
                defaultSortKey: 'name',
                renderRow: (item) => {
                    const isDeletable = item.assetCount === 0;
                    const deleteButtonHTML = isDeletable
                        ? `<button class="delete-btn btn btn-ghost btn-xs text-red-500" data-id="${item._id}" title="Delete Office"><i data-lucide="trash-2" class="h-4 w-4"></i></button>`
                        : `<div class="tooltip" data-tip="Cannot delete: Office is in use by ${item.assetCount} asset(s)."><button class="btn btn-ghost btn-xs" disabled><i data-lucide="trash-2" class="h-4 w-4"></i></button></div>`;
                    return `
                        <tr id="item-row-${item._id}">
                            <td data-label="Office Name">${item.name}</td>
                            <td data-label="Code">${item.code}</td>
                            <td data-label="Actions" class="text-center">
                                <div class="flex justify-center items-center gap-1">
                                    <button class="edit-btn btn btn-ghost btn-xs" data-id="${item._id}" title="Edit Office"><i data-lucide="edit" class="h-4 w-4"></i></button>
                                    ${deleteButtonHTML}
                                </div>
                            </td>
                        </tr>
                    `;
                }
            },
            form: {
                id: 'add-office-form',
                titleId: 'office-form-title',
                idInput: 'office-id',
                submitBtnId: 'submit-office-btn',
                cancelBtnId: 'cancel-edit-btn',
                fields: [
                    { id: 'new-office-name', key: 'name', required: true, label: 'Office Name' },
                    { id: 'new-office-code', key: 'code', required: true, label: 'Code' },
                ]
            }
        };
        createSettingsPage(config);
    },
    pageName: 'Manage Offices'
});
