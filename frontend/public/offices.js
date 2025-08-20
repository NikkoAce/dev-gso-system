// FILE: frontend/public/offices.js
import { fetchWithAuth } from './api.js';

document.addEventListener('DOMContentLoaded', async () => {
    try {
        const user = await getCurrentUser();
        if (!user) return;

        initializeLayout(user);
        initializeOfficesPage(user);
    } catch (error) {
        console.error("Authentication failed on offices page:", error);
    }
});

function initializeOfficesPage(currentUser) {
    const API_ENDPOINT = 'offices';
    let allOffices = [];

    const officeList = document.getElementById('office-list');
    const addOfficeForm = document.getElementById('add-office-form');
    const officeIdInput = document.getElementById('office-id');
    const newOfficeNameInput = document.getElementById('new-office-name');
    const newOfficeCodeInput = document.getElementById('new-office-code');
    const formTitle = document.getElementById('office-form-title');
    const submitBtn = document.getElementById('submit-office-btn');
    const cancelBtn = document.getElementById('cancel-edit-btn');
    
    // Modal DOM elements
    const confirmationModal = document.getElementById('confirmation-modal');
    const modalTitle = document.getElementById('modal-title-text');
    const modalBody = document.getElementById('modal-body-text');
    const modalConfirmBtn = document.getElementById('modal-confirm-btn');

    // --- DATA FETCHING & RENDERING ---
    async function fetchAndRenderOffices() {
        try {
            allOffices = await fetchWithAuth(API_ENDPOINT);
            renderOfficeList();
        } catch (error) {
            console.error(error);
            officeList.innerHTML = `<tr><td colspan="3" class="p-4 text-center text-red-500">Error loading offices.</td></tr>`;
        }
    }

    function renderOfficeList() {
        officeList.innerHTML = '';
        if (allOffices.length === 0) {
            officeList.innerHTML = `<tr><td colspan="3" class="p-4 text-center text-gray-500">No offices found.</td></tr>`;
            return;
        }
        allOffices.forEach(office => {
            const tr = document.createElement('tr');
            const isDeletable = office.assetCount === 0;
            const deleteButtonHTML = isDeletable
                ? `<button class="delete-office-btn btn btn-ghost btn-xs text-red-500" data-id="${office._id}" title="Delete Office"><i data-lucide="trash-2" class="h-4 w-4"></i></button>`
                : `<div class="tooltip" data-tip="Cannot delete: Office is in use by ${office.assetCount} asset(s).">
                       <button class="btn btn-ghost btn-xs" disabled><i data-lucide="trash-2" class="h-4 w-4"></i></button>
                   </div>`;

            tr.innerHTML = `
                <td>${office.name}</td>
                <td>${office.code}</td>
                <td class="text-center">
                    <div class="flex justify-center items-center gap-1">
                        <button class="edit-office-btn btn btn-ghost btn-xs" data-id="${office._id}" title="Edit Office"><i data-lucide="edit" class="h-4 w-4"></i></button>
                        ${deleteButtonHTML}
                    </div>
                </td>
            `;
            officeList.appendChild(tr);
        });
        lucide.createIcons();
    }

    // --- FORM STATE ---
    function resetForm() {
        addOfficeForm.reset();
        officeIdInput.value = '';
        formTitle.textContent = 'Add New Office';
        submitBtn.textContent = 'Add Office';
        cancelBtn.classList.add('hidden');
    }

    function populateFormForEdit(officeId) {
        const office = allOffices.find(loc => loc._id === officeId);
        if (office) {
            officeIdInput.value = office._id;
            newOfficeNameInput.value = office.name;
            newOfficeCodeInput.value = office.code;
            formTitle.textContent = 'Edit Office';
            submitBtn.textContent = 'Save Changes';
            cancelBtn.classList.remove('hidden');
            window.scrollTo(0, 0);
        }
    }

    // --- EVENT LISTENERS ---
    addOfficeForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        const name = newOfficeNameInput.value.trim();
        const code = newOfficeCodeInput.value.trim();
        const officeId = officeIdInput.value;
        
        if (!name || !code) {
            alert('Office name and code are required.');
            return;
        }

        const method = officeId ? 'PUT' : 'POST';
        const endpoint = officeId ? `${API_ENDPOINT}/${officeId}` : API_ENDPOINT;

        submitBtn.classList.add("loading");
        submitBtn.disabled = true;

        try {
            await fetchWithAuth(endpoint, {
                method: method,
                body: JSON.stringify({ name, code })
            });
            resetForm();
            fetchAndRenderOffices();
        } catch (error) {
            alert(`Error: ${error.message}`);
        } finally {
            submitBtn.classList.remove("loading");
            submitBtn.disabled = false;
        }
    });

    officeList.addEventListener('click', async (e) => {
        const editButton = e.target.closest('.edit-office-btn');
        if (editButton) {
            populateFormForEdit(editButton.dataset.id);
            return;
        }

        const deleteButton = e.target.closest('.delete-office-btn');
        if (deleteButton) {
            const officeId = deleteButton.dataset.id;
            const office = allOffices.find(off => off._id === officeId);
            showConfirmationModal(
                `Delete Office: ${office.name}`,
                `Are you sure you want to permanently delete this office? This action cannot be undone.`,
                async () => {
                    try {
                        await fetchWithAuth(`${API_ENDPOINT}/${officeId}`, { method: 'DELETE' });
                        fetchAndRenderOffices();
                    } catch (error) {
                        alert(`Error: ${error.message}`);
                    }
                }
            );
        }
    });

    function showConfirmationModal(title, body, onConfirm) {
        modalTitle.textContent = title;
        modalBody.textContent = body;
        
        // Clone and replace the button to remove old event listeners
        const newConfirmBtn = modalConfirmBtn.cloneNode(true);
        modalConfirmBtn.parentNode.replaceChild(newConfirmBtn, modalConfirmBtn);
        newConfirmBtn.addEventListener('click', () => {
            onConfirm();
            confirmationModal.close();
        }, { once: true });

        confirmationModal.showModal();
        document.getElementById('modal-cancel-btn').onclick = () => confirmationModal.close();
    }

    cancelBtn.addEventListener('click', resetForm);

    // --- INITIALIZATION ---
    fetchAndRenderOffices();
}
