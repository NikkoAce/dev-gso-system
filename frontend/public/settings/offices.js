// FILE: frontend/public/offices.js
import { createSettingsPage } from '../js/settingsPageFactory.js';

document.addEventListener('DOMContentLoaded', async () => {
    try {
        const user = await getCurrentUser();
        if (!user) return;
        initializeLayout(user);

        createSettingsPage({
            apiEndpoint: 'offices',
            entityName: 'Office',
            entityNamePlural: 'Offices',
            list: {
                containerId: 'office-list',
                searchKeys: ['name', 'code'],
                columns: [
                    { header: 'Office Name', key: 'name' },
                    { header: 'Code', key: 'code' }
                ],
                renderRow: (item) => {
                    const isDeletable = item.assetCount === 0;
                    const deleteButtonHTML = isDeletable
                        ? `<button class="delete-btn btn btn-ghost btn-xs text-red-500" data-id="${item._id}" title="Delete Office"><i data-lucide="trash-2" class="h-4 w-4"></i></button>`
                        : `<div class="tooltip" data-tip="Cannot delete: Office is in use by ${item.assetCount} asset(s).">
                               <button class="btn btn-ghost btn-xs" disabled><i data-lucide="trash-2" class="h-4 w-4"></i></button>
                           </div>`;
                    return `
                        <td>${item.name}</td>
                        <td>${item.code}</td>
                        <td class="text-center">
                            <div class="flex justify-center items-center gap-1">
                                <button class="edit-btn btn btn-ghost btn-xs" data-id="${item._id}" title="Edit Office"><i data-lucide="edit" class="h-4 w-4"></i></button>
                                ${deleteButtonHTML}
                            </div>
                        </td>
                    `;
                }
            },
            form: {
                id: 'add-office-form',
                idInput: 'office-id',
                titleId: 'office-form-title',
                submitBtnId: 'submit-office-btn',
                cancelBtnId: 'cancel-edit-btn',
                fields: [
                    { id: 'new-office-name', key: 'name', label: 'Office Name', required: true },
                    { id: 'new-office-code', key: 'code', label: '2-Digit Code', required: true }
                ]
            }
        });
    } catch (error) {
        console.error("Authentication failed on offices page:", error);
    }
});
