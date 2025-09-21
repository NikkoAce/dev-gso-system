// FILE: frontend/public/employees.js
import { createAuthenticatedPage } from '../js/page-loader.js';
import { createSettingsPage } from '../js/settingsPageFactory.js';

createAuthenticatedPage({
    permission: 'settings:manage',
    pageInitializer: async (user) => {
        const config = {
            apiEndpoint: 'employees',
            entityName: 'Employee',
            entityNamePlural: 'Employees',
            addNewBtnId: 'add-new-btn',
            modal: {
                id: 'settings-modal'
            },
            list: {
                containerId: 'employee-list',
                searchKeys: ['name', 'designation'],
                defaultSortKey: 'name',
                renderRow: (item) => {
                    const isDeletable = item.assetCount === 0;
                    const deleteButtonHTML = isDeletable
                        ? `<button class="delete-btn btn btn-ghost btn-xs text-red-500" data-id="${item._id}" title="Delete Employee"><i data-lucide="trash-2" class="h-4 w-4"></i></button>`
                        : `<div class="tooltip" data-tip="Cannot delete: Employee is a custodian for ${item.assetCount} asset(s)."><button class="btn btn-ghost btn-xs" disabled><i data-lucide="trash-2" class="h-4 w-4"></i></button></div>`;
                    return `
                        <tr id="item-row-${item._id}">
                            <td data-label="Name">${item.name}</td>
                            <td data-label="Designation">${item.designation}</td>
                            <td data-label="Actions" class="text-center">
                                <div class="flex justify-center items-center gap-1">
                                    <button class="edit-btn btn btn-ghost btn-xs" data-id="${item._id}" title="Edit Employee"><i data-lucide="edit" class="h-4 w-4"></i></button>
                                    ${deleteButtonHTML}
                                </div>
                            </td>
                        </tr>
                    `;
                }
            },
            form: {
                id: 'add-employee-form',
                titleId: 'employee-form-title',
                idInput: 'employee-id',
                submitBtnId: 'submit-employee-btn',
                cancelBtnId: 'cancel-edit-btn',
                fields: [
                    { id: 'new-employee-name', key: 'name', required: true, label: 'Full Name' },
                    { id: 'new-employee-designation', key: 'designation', required: true, label: 'Designation' },
                ]
            }
        };
        createSettingsPage(config);
    },
    pageName: 'Manage Employees'
});
