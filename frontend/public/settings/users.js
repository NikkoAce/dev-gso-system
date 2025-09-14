import { fetchWithAuth } from '../js/api.js';
import { createUIManager } from '../js/ui.js';
import { getCurrentUser, gsoLogout } from '../js/auth.js';
 
let currentPageUsers = [];
let metadata = { roles: [], permissions: [] };
let currentPage = 1;
let totalPages = 1;
const itemsPerPage = 15;
let sortKey = 'name';
let sortDirection = 'asc';
 
const { showToast, renderPagination, setLoading } = createUIManager();
 
document.addEventListener('DOMContentLoaded', async () => {
    try {
        const user = await getCurrentUser();
        if (!user) {
            // If no user is found, auth.js will handle the redirect.
            return;
        }

        // Page-level permission check
        if (!user.permissions || !user.permissions.includes('user:read')) {
            window.location.href = '../dashboard/dashboard.html';
            return;
        }

        initializeLayout(user, gsoLogout);
 
        metadata = await fetchWithAuth('users/meta');
        await loadUsers();
        setupEventListeners();
    } catch (error) {
        console.error('Error initializing user management page:', error);
        showToast('Failed to load user data. Please try again.', 'error');
        document.getElementById('user-list').innerHTML = `<tr><td colspan="4" class="text-center text-error">Could not load users.</td></tr>`;
    }
});

async function loadUsers() {
    const tableBody = document.getElementById('user-list');
    setLoading(true, tableBody, { colSpan: 4 });

    const searchInput = document.getElementById('search-input');
    const params = new URLSearchParams({
        page: currentPage,
        limit: itemsPerPage,
        sort: sortKey,
        order: sortDirection,
        search: searchInput.value,
    });

    try {
        const data = await fetchWithAuth(`users?${params.toString()}`);
        currentPageUsers = data.docs;
        totalPages = data.totalPages;
        renderUsersTable(data.docs);
        renderPagination(document.getElementById('pagination-controls'), data);
        updateSortIndicators();
    } catch (error) {
        console.error('Failed to load users:', error);
        tableBody.innerHTML = `<tr><td colspan="4" class="text-center text-error">Could not load users.</td></tr>`;
    } finally {
        setLoading(false, tableBody);
    }
}

function setupEventListeners() {
    const searchInput = document.getElementById('search-input');
    searchInput.addEventListener('input', (e) => {
        currentPage = 1;
        loadUsers();
    });

    const editForm = document.getElementById('edit-user-form');
    editForm.addEventListener('submit', handleSaveChanges);

    const paginationControls = document.getElementById('pagination-controls');
    paginationControls.addEventListener('click', (e) => {
        const target = e.target.closest('button');
        if (!target) return;

        if (target.id === 'prev-page-btn' && currentPage > 1) {
            currentPage--; loadUsers();
        } else if (target.id === 'next-page-btn' && currentPage < totalPages) {
            currentPage++; loadUsers();
        } else if (target.classList.contains('page-btn')) {
            const page = parseInt(target.dataset.page, 10);
            if (page !== currentPage) { currentPage = page; loadUsers(); }
        }
    });

    const tableHeader = document.querySelector('#user-list').parentElement.querySelector('thead');
    tableHeader.addEventListener('click', (e) => {
        const th = e.target.closest('th[data-sort-key]');
        if (th) {
            const key = th.dataset.sortKey;
            sortDirection = (sortKey === key && sortDirection === 'asc') ? 'desc' : 'asc';
            sortKey = key;
            loadUsers();
        }
    });

    const roleSelect = document.getElementById('edit-role');
    roleSelect.addEventListener('change', handleRoleChange);

    document.getElementById('modal-cancel-btn').addEventListener('click', () => {
        document.getElementById('edit-user-modal').close();
    });
}

function renderUsersTable(users) {
    const userList = document.getElementById('user-list');
    if (users.length === 0) {
        userList.innerHTML = `<tr><td colspan="4" class="text-center">No users found.</td></tr>`;
        return;
    }

    userList.innerHTML = users.map(user => `
        <tr id="user-row-${user._id}">
            <td data-label="Name">
                <div class="font-bold">${user.name}</div>
                <div class="text-sm opacity-70">${user.email}</div>
            </td>
            <td data-label="Office">${user.office}</td>
            <td data-label="Role"><span class="badge badge-ghost">${user.role}</span></td>
            <td data-label="Actions" class="text-center">
                <button class="btn btn-sm btn-ghost edit-btn" data-user-id="${user._id}">
                    <i data-lucide="edit" class="h-4 w-4"></i> Edit
                </button>
            </td>
        </tr>
    `).join('');

    // Add event listeners to the new edit buttons
    document.querySelectorAll('.edit-btn').forEach(button => {
        button.addEventListener('click', (e) => {
            const userId = e.currentTarget.dataset.userId;
            const user = currentPageUsers.find(u => u._id === userId);
            openEditModal(user);
        });
    });
    lucide.createIcons();
}

function updateSortIndicators() {
    const tableHeader = document.querySelector('#user-list').parentElement.querySelector('thead');
    const headers = tableHeader.querySelectorAll('th[data-sort-key]');
    headers.forEach(th => {
        const existingIcon = th.querySelector('i[data-lucide]');
        if (existingIcon) {
            existingIcon.remove();
        }

        if (th.dataset.sortKey === sortKey) {
            const iconHTML = `<i data-lucide="${sortDirection === 'asc' ? 'arrow-up' : 'arrow-down'}" class="inline-block ml-1 h-4 w-4"></i>`;
            th.insertAdjacentHTML('beforeend', iconHTML);
        }
    });
    lucide.createIcons();
}

function openEditModal(user) {
    const modal = document.getElementById('edit-user-modal');
    document.getElementById('modal-title').textContent = `Edit User: ${user.name}`;
    document.getElementById('edit-user-id').value = user._id;

    // Populate roles dropdown
    const roleSelect = document.getElementById('edit-role');
    roleSelect.innerHTML = metadata.roles.map(role => // role is an object { name, permissions }
        `<option value="${role.name}" ${user.role === role.name ? 'selected' : ''}>${role.name}</option>`
    ).join('');

    // Populate permissions checkboxes
    const permissionsContainer = document.getElementById('edit-permissions-container');
    permissionsContainer.innerHTML = metadata.permissions.map(permission => `
        <label class="label cursor-pointer justify-start gap-2">
            <input type="checkbox" class="checkbox checkbox-sm" value="${permission}" 
                   ${user.permissions.includes(permission) ? 'checked' : ''}>
            <span class="label-text">${permission}</span>
        </label>
    `).join('');

    modal.showModal();
}

/**
 * When a new role is selected in the modal, this function automatically
 * checks the permissions associated with that role.
 */
function handleRoleChange() {
    const roleSelect = document.getElementById('edit-role');
    const selectedRoleName = roleSelect.value;
    const selectedRole = metadata.roles.find(r => r.name === selectedRoleName);

    if (selectedRole) {
        document.querySelectorAll('#edit-permissions-container input[type="checkbox"]').forEach(checkbox => {
            checkbox.checked = selectedRole.permissions.includes(checkbox.value);
        });
    }
}

async function handleSaveChanges(event) {
    event.preventDefault();
    const userId = document.getElementById('edit-user-id').value;
    const saveButton = document.getElementById('modal-save-btn');

    const updatedRole = document.getElementById('edit-role').value;
    const updatedPermissions = Array.from(document.querySelectorAll('#edit-permissions-container input:checked'))
        .map(checkbox => checkbox.value);

    const updatedData = {
        role: updatedRole,
        permissions: updatedPermissions
    };

    saveButton.classList.add('loading');
    saveButton.disabled = true;

    try {
        await fetchWithAuth(`users/${userId}`, {
            method: 'PUT',
            body: JSON.stringify(updatedData)
        });
        await loadUsers(); // Re-fetch the current page to show changes
        document.getElementById('edit-user-modal').close();
        showToast('User updated successfully!', 'success');
    } catch (error) {
        console.error('Failed to update user:', error);
        showToast(`Error: ${error.message}`, 'error');
    } finally {
        saveButton.classList.remove('loading');
        saveButton.disabled = false;
    }
}