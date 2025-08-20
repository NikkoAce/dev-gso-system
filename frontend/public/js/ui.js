// FILE: frontend/public/js/ui.js

/**
 * A reusable helper to populate a <select> element.
 * @param {HTMLSelectElement} selectElement - The dropdown element to populate.
 * @param {Array<object>} items - The array of items to add as options.
 * @param {string} placeholder - The text for the default, disabled option.
 */
function populateSelect(selectElement, items, placeholder) {
    if (!selectElement) return;
    selectElement.innerHTML = `<option value="">${placeholder}</option>`;
    items.forEach(item => {
        const option = document.createElement('option');
        option.value = item.name; // Assuming 'name' is the value for the option
        option.textContent = item.name;
        selectElement.appendChild(option);
    });
}
/**
 * Creates a UI manager with shared components like toast notifications.
 * @returns {{showToast: function}}
 */
export function createUIManager() {
    const toastContainer = document.getElementById('toast-container');

    /**
     * Displays a toast notification with a message, type, and icon.
     * @param {string} message - The message to display.
     * @param {'info'|'success'|'warning'|'error'} [type='info'] - The type of toast.
     */
    function showToast(message, type = 'info') {
        if (!toastContainer) return;

        const iconMap = {
            success: 'check-circle',
            error: 'x-circle',
            warning: 'alert-triangle',
            info: 'info',
        };

        const alertType = `alert-${type}`;
        const iconName = iconMap[type];

        const toast = document.createElement('div');
        toast.className = `alert ${alertType} shadow-lg flex transition-all duration-500 ease-in-out transform translate-y-[-20px] opacity-0`;
        toast.innerHTML = `
            <i data-lucide="${iconName}" class="h-6 w-6"></i>
            <span>${message}</span>
        `;

        toastContainer.appendChild(toast);
        lucide.createIcons();

        requestAnimationFrame(() => toast.classList.remove('translate-y-[-20px]', 'opacity-0'));
        setTimeout(() => toast.addEventListener('transitionend', () => toast.remove()), 3000);
        setTimeout(() => toast.classList.add('opacity-0'), 2700);
    }

    /**
     * Populates various filter dropdowns from a data object.
     * @param {object} data - An object containing arrays of data, e.g., { categories: [], offices: [] }.
     * @param {object} domElements - An object mapping filter types to their DOM elements.
     */
    function populateFilters(data, domElements) {
        if (domElements.categoryFilter && data.categories) {
            populateSelect(domElements.categoryFilter, data.categories, 'All Categories');
        }
        if (domElements.officeFilter && data.offices) {
            populateSelect(domElements.officeFilter, data.offices, 'All Offices');
        }
    }

    /**
     * Displays a loading spinner inside a table body.
     * @param {boolean} isLoading - Whether to show or hide the loader.
     * @param {HTMLElement} container - The table body element.
     * @param {number} colSpan - The number of columns the loader should span.
     */
    function setLoading(isLoading, container, colSpan) {
        if (!container) return;
        if (isLoading) {
            container.innerHTML = `<tr><td colspan="${colSpan}" class="text-center p-8"><i data-lucide="loader-2" class="animate-spin h-8 w-8 mx-auto text-gray-500"></i></td></tr>`;
            lucide.createIcons();
        }
        // No 'else' case needed, as the container will be overwritten with data.
    }

    return { showToast, populateFilters, setLoading };
}