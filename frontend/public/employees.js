// FILE: frontend/public/employees.js
import { fetchWithAuth } from './api.js';

document.addEventListener('DOMContentLoaded', async () => {
    try {
        const user = await getCurrentUser();
        if (!user) return;

        initializeLayout(user);
        initializeEmployeesPage(user);
    } catch (error) {
        console.error("Authentication failed on employees page:", error);
    }
});

function initializeEmployeesPage(currentUser) {
    const API_ENDPOINT = 'employees';
    let allEmployees = [];

    const employeeList = document.getElementById('employee-list');
    const addEmployeeForm = document.getElementById('add-employee-form');
    const employeeIdInput = document.getElementById('employee-id');
    const newEmployeeNameInput = document.getElementById('new-employee-name');
    const newEmployeeDesignationInput = document.getElementById('new-employee-designation');
    const formTitle = document.getElementById('employee-form-title');
    const submitBtn = document.getElementById('submit-employee-btn');
    const cancelBtn = document.getElementById('cancel-edit-btn');

    // Modal DOM elements
    const confirmationModal = document.getElementById('confirmation-modal');
    const modalTitle = document.getElementById('modal-title-text');
    const modalBody = document.getElementById('modal-body-text');
    const modalConfirmBtn = document.getElementById('modal-confirm-btn');

    // --- DATA FETCHING & RENDERING ---
    async function fetchAndRenderEmployees() {
        try {
            // No need for auth headers here, fetchWithAuth handles it
            allEmployees = await fetchWithAuth(API_ENDPOINT);
            renderEmployeeList();
        } catch (error) {
            console.error(error);
            employeeList.innerHTML = `<tr><td colspan="3" class="p-4 text-center text-red-500">Error loading employees.</td></tr>`;
        }
    }

    function renderEmployeeList() {
        employeeList.innerHTML = '';
        if (allEmployees.length === 0) {
            employeeList.innerHTML = `<tr><td colspan="3" class="p-4 text-center text-gray-500">No employees found.</td></tr>`;
            return;
        }
        allEmployees.forEach(employee => {
            const tr = document.createElement('tr');
            const isDeletable = employee.assetCount === 0;
            const deleteButtonHTML = isDeletable
                ? `<button class="delete-employee-btn btn btn-ghost btn-xs text-red-500" data-id="${employee._id}" title="Delete Employee"><i data-lucide="trash-2" class="h-4 w-4"></i></button>`
                : `<div class="tooltip" data-tip="Cannot delete: Employee is a custodian for ${employee.assetCount} asset(s).">
                       <button class="btn btn-ghost btn-xs" disabled><i data-lucide="trash-2" class="h-4 w-4"></i></button>
                   </div>`;
            tr.innerHTML = `
                <td>${employee.name}</td>
                <td>${employee.designation}</td>
                <td class="text-center">
                    <div class="flex justify-center items-center gap-1">
                        <button class="edit-employee-btn btn btn-ghost btn-xs" data-id="${employee._id}" title="Edit Employee"><i data-lucide="edit" class="h-4 w-4"></i></button>
                        ${deleteButtonHTML}
                    </div>
                </td>
            `;
            employeeList.appendChild(tr);
        });
        lucide.createIcons();
    }

    // --- FORM STATE ---
    function resetForm() {
        addEmployeeForm.reset();
        employeeIdInput.value = '';
        formTitle.textContent = 'Add New Employee';
        submitBtn.textContent = 'Add Employee';
        cancelBtn.classList.add('hidden');
    }

    // --- EVENT LISTENERS ---
    addEmployeeForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        const name = newEmployeeNameInput.value.trim();
        const designation = newEmployeeDesignationInput.value.trim();
        const employeeId = employeeIdInput.value;
        
        if (!name || !designation) {
            alert('Employee name and designation are required.');
            return;
        }

        const method = employeeId ? 'PUT' : 'POST';
        const endpoint = employeeId ? `${API_ENDPOINT}/${employeeId}` : API_ENDPOINT;

        submitBtn.classList.add("loading");
        submitBtn.disabled = true;

        try {
            await fetchWithAuth(endpoint, {
                method: method,
                body: JSON.stringify({ name, designation })
            });
            resetForm();
            fetchAndRenderEmployees();
        } catch (error) {
            alert(`Error: ${error.message}`);
        } finally {
            submitBtn.classList.remove("loading");
            submitBtn.disabled = false;
        }
    });

    employeeList.addEventListener('click', async (e) => {
        const editButton = e.target.closest('.edit-employee-btn');
        if (editButton) {
            const employeeId = editButton.dataset.id;
            const employee = allEmployees.find(emp => emp._id === employeeId);
            if (employee) {
                employeeIdInput.value = employee._id;
                newEmployeeNameInput.value = employee.name;
                newEmployeeDesignationInput.value = employee.designation;
                formTitle.textContent = 'Edit Employee';
                submitBtn.textContent = 'Save Changes';
                cancelBtn.classList.remove('hidden');
            }
        }

        const deleteButton = e.target.closest('.delete-employee-btn');
        if (deleteButton) {
            const employeeId = deleteButton.dataset.id;
            const employee = allEmployees.find(emp => emp._id === employeeId);
            showConfirmationModal(
                `Delete Employee: ${employee.name}`,
                `Are you sure you want to permanently delete this employee? This action cannot be undone.`,
                async () => {
                    deleteButton.disabled = true;
                    try {
                        await fetchWithAuth(`${API_ENDPOINT}/${employeeId}`, { method: 'DELETE' });
                        fetchAndRenderEmployees();
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
    fetchAndRenderEmployees();
}
