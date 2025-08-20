// FILE: frontend/public/js/ui.js

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

    return { showToast };
}