// FILE: frontend/public/employees.js
import { getCurrentUser, gsoLogout } from '../js/auth.js';
import { createSettingsPage } from '../js/settingsPageFactory.js';

document.addEventListener('DOMContentLoaded', async () => {
    try {
        const user = await getCurrentUser();
        if (!user || user.office !== 'GSO') {
            window.location.href = '../dashboard/dashboard.html';
            return;
        }

        initializeLayout(user, gsoLogout);

        createSettingsPage({
            apiEndpoint: 'employees',
            entityName: 'Employee',
            entityNamePlural: 'Employees',
            list: {
                containerId: 'employee-list',
                searchKeys: ['name', 'designation'],
                columns: [
                    { header: 'Name', key: 'name' },
                    { header: 'Designation', key: 'designation' }
                ],
                renderRow: (item) => {
                    const isDeletable = item.assetCount === 0;
                    const deleteButtonHTML = isDeletable
                        ? `<button class="delete-btn btn btn-ghost btn-xs text-red-500" data-id="${item._id}" title="Delete Employee"><i data-lucide="trash-2" class="h-4 w-4"></i></button>`
                        : `<div class="tooltip" data-tip="Cannot delete: Employee is a custodian for ${item.assetCount} asset(s).">
                               <button class="btn btn-ghost btn-xs" disabled><i data-lucide="trash-2" class="h-4 w-4"></i></button>
                           </div>`;
                    return `
                        <td>${item.name}</td>
                        <td>${item.designation}</td>
                        <td class="text-center">
                            <div class="flex justify-center items-center gap-1">
                                <button class="edit-btn btn btn-ghost btn-xs" data-id="${item._id}" title="Edit Employee"><i data-lucide="edit" class="h-4 w-4"></i></button>
                                ${deleteButtonHTML}
                            </div>
                        </td>
                    `;
                }
            },
            form: {
                id: 'add-employee-form',
                idInput: 'employee-id',
                titleId: 'employee-form-title',
                submitBtnId: 'submit-employee-btn',
                cancelBtnId: 'cancel-edit-btn',
                fields: [
                    { id: 'new-employee-name', key: 'name', label: 'Full Name', required: true },
                    { id: 'new-employee-designation', key: 'designation', label: 'Designation', required: true }
                ]
            }
        });
    } catch (error) {
        console.error("Authentication failed on employees page:", error);
    }
});
