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
            tr.innerHTML = `
                <td class="p-4">${office.name}</td>
                <td class="p-4">${office.code}</td>
                <td class="p-4 text-center">
                    <div class="flex justify-center items-center space-x-3">
                        <button class="edit-office-btn text-blue-600 hover:text-blue-800" data-id="${office._id}" title="Edit Office"><i data-lucide="edit" class="h-5 w-5"></i></button>
                        <button class="delete-office-btn text-red-500 hover:text-red-700" data-id="${office._id}" title="Delete Office"><i data-lucide="trash-2" class="h-5 w-5"></i></button>
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

        try {
            await fetchWithAuth(endpoint, {
                method: method,
                body: JSON.stringify({ name, code })
            });
            resetForm();
            fetchAndRenderOffices();
        } catch (error) {
            alert(`Error: ${error.message}`);
        }
    });

    officeList.addEventListener('click', async (e) => {
        const editButton = e.target.closest('.edit-office-btn');
        if (editButton) {
            const officeId = editButton.dataset.id;
            const office = allOffices.find(loc => loc._id === officeId);
            if (office) {
                officeIdInput.value = office._id;
                newOfficeNameInput.value = office.name;
                newOfficeCodeInput.value = office.code;
                formTitle.textContent = 'Edit Office';
                submitBtn.textContent = 'Save Changes';
                cancelBtn.classList.remove('hidden');
            }
        }

        const deleteButton = e.target.closest('.delete-office-btn');
        if (deleteButton) {
            const officeId = deleteButton.dataset.id;
            if (confirm('Are you sure you want to delete this office?')) {
                try {
                    await fetchWithAuth(`${API_ENDPOINT}/${officeId}`, { method: 'DELETE' });
                    fetchAndRenderOffices();
                } catch (error) {
                    alert(`Error: ${error.message}`);
                }
            }
        }
    });

    cancelBtn.addEventListener('click', resetForm);

    // --- INITIALIZATION ---
    fetchAndRenderOffices();
}
