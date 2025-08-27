import { fetchWithAuth } from '../js/api.js';
import { createUIManager } from '../js/ui.js';
import { getCurrentUser, gsoLogout } from '../js/auth.js';

let allRoles = [];
let allPermissions = [];
const { showToast, showConfirmationModal } = createUIManager();

// --- DOM CACHE ---
const form = document.getElementById('role-form');
const formTitle = document.getElementById('role-form-title');
const roleIdInput = document.getElementById('role-id');
const roleNameInput = document.getElementById('role-name');
const permissionsContainer = document.getElementById('permissions-container');
const submitBtn = document.getElementById('submit-role-btn');
const cancelBtn = document.getElementById('cancel-edit-btn');
const roleList = document.getElementById('role-list');
const searchInput = document.getElementById('search-input');

document.addEventListener('DOMContentLoaded', async () => {
    try {
        const user = await getCurrentUser();
        if (!user) return;
        initializeLayout(user, gsoLogout);
        await initializePage();
    } catch (error) {
        console.error("Initialization failed:", error);
        showToast('Failed to initialize page.', 'error');
    }
});

async function initializePage() {
    try {
        const meta = await fetchWithAuth('users/meta');
        allPermissions = meta.permissions;
        renderPermissionsCheckboxes(allPermissions);

        await fetchAndRenderRoles();
        setupEventListeners();
    } catch (error) {
        console.error('Error fetching initial data:', error);
        showToast('Could not load roles or permissions.', 'error');
    }
}

async function fetchAndRenderRoles() {
    try {
        allRoles = await fetchWithAuth('roles');
        renderRolesTable(allRoles);
    } catch (error) {
        console.error('Error fetching roles:', error);
        showToast('Failed to load roles.', 'error');
    }
}

function renderPermissionsCheckboxes(permissions, checkedPermissions = []) {
    permissionsContainer.innerHTML = permissions.map(permission => `
        <label class="label cursor-pointer justify-start gap-2">
            <input type="checkbox" class="checkbox checkbox-sm" value="${permission}" 
                   ${checkedPermissions.includes(permission) ? 'checked' : ''}>
            <span class="label-text text-xs">${permission}</span>
        </label>
    `).join('');
}

function renderRolesTable(roles) {
    if (roles.length === 0) {
        roleList.innerHTML = `<tr><td colspan="3" class="text-center">No roles found.</td></tr>`;
        return;
    }

    roleList.innerHTML = roles.map(role => `
        <tr id="role-row-${role._id}">
            <td><div class="font-bold">${role.name}</div></td>
            <td class="text-center"><span class="badge badge-ghost">${role.permissions.length}</span></td>
            <td class="text-center">
                <button class="btn btn-sm btn-ghost edit-btn" data-id="${role._id}"><i data-lucide="edit" class="h-4 w-4"></i></button>
                <button class="btn btn-sm btn-ghost delete-btn text-error" data-id="${role._id}"><i data-lucide="trash-2" class="h-4 w-4"></i></button>
            </td>
        </tr>
    `).join('');
    lucide.createIcons();
}

function setupEventListeners() {
    form.addEventListener('submit', handleSave);
    cancelBtn.addEventListener('click', resetForm);
    searchInput.addEventListener('input', () => {
        const searchTerm = searchInput.value.toLowerCase();
        const filtered = allRoles.filter(role => role.name.toLowerCase().includes(searchTerm));
        renderRolesTable(filtered);
    });

    roleList.addEventListener('click', e => {
        const editBtn = e.target.closest('.edit-btn');
        if (editBtn) {
            const role = allRoles.find(r => r._id === editBtn.dataset.id);
            populateFormForEdit(role);
        }

        const deleteBtn = e.target.closest('.delete-btn');
        if (deleteBtn) {
            const role = allRoles.find(r => r._id === deleteBtn.dataset.id);
            handleDelete(role);
        }
    });
}

function resetForm() {
    form.reset();
    roleIdInput.value = '';
    formTitle.textContent = 'Add New Role';
    submitBtn.textContent = 'Add Role';
    cancelBtn.classList.add('hidden');
    renderPermissionsCheckboxes(allPermissions); // Reset checkboxes
}

function populateFormForEdit(role) {
    roleIdInput.value = role._id;
    roleNameInput.value = role.name;
    formTitle.textContent = `Edit Role: ${role.name}`;
    submitBtn.textContent = 'Save Changes';
    cancelBtn.classList.remove('hidden');
    renderPermissionsCheckboxes(allPermissions, role.permissions);
    window.scrollTo({ top: 0, behavior: 'smooth' });
}

async function handleSave(e) {
    e.preventDefault();
    const roleId = roleIdInput.value;
    const name = roleNameInput.value.trim();
    const permissions = Array.from(permissionsContainer.querySelectorAll('input:checked')).map(cb => cb.value);

    if (!name) {
        showToast('Role name is required.', 'error');
        return;
    }

    const body = { name, permissions };
    const method = roleId ? 'PUT' : 'POST';
    const endpoint = roleId ? `roles/${roleId}` : 'roles';

    submitBtn.classList.add('loading');
    submitBtn.disabled = true;

    try {
        await fetchWithAuth(endpoint, { method, body: JSON.stringify(body) });
        showToast(`Role ${roleId ? 'updated' : 'created'} successfully!`, 'success');
        resetForm();
        await fetchAndRenderRoles();
    } catch (error) {
        showToast(`Error: ${error.message}`, 'error');
    } finally {
        submitBtn.classList.remove('loading');
        submitBtn.disabled = false;
    }
}

function handleDelete(role) {
    showConfirmationModal(
        `Delete Role: ${role.name}`,
        `Are you sure you want to delete this role? This cannot be undone.`,
        async () => {
            try {
                await fetchWithAuth(`roles/${role._id}`, { method: 'DELETE' });
                showToast('Role deleted successfully.', 'success');
                resetForm();
                await fetchAndRenderRoles();
            } catch (error) {
                showToast(`Error: ${error.message}`, 'error');
            }
        }
    );
}