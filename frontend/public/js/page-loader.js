import { getCurrentUser, gsoLogout } from './auth.js';

/**
 * A higher-order function to bootstrap authenticated pages, handling user fetching,
 * permission checks, and layout initialization.
 * @param {object} options
 * @param {string|string[]|null} options.permission - A single permission string, an array of permissions (user must have at least one), or null if no permission is required.
 * @param {function(object): void} options.pageInitializer - The main function to run for the page, which receives the user object.
 * @param {string} [options.pageName='this page'] - A descriptive name for the page for error logging.
 */
export function createAuthenticatedPage({ permission, pageInitializer, pageName = 'this page' }) {
    document.addEventListener('DOMContentLoaded', async () => {
        try {
            const user = await getCurrentUser();
            if (!user) return; // getCurrentUser handles redirect if no token

            let hasPermission = true;
            if (permission) {
                const userPermissions = user.permissions || [];
                if (Array.isArray(permission)) {
                    // User must have at least one of the permissions in the array
                    hasPermission = permission.some(p => userPermissions.includes(p));
                } else {
                    // User must have the single required permission
                    hasPermission = userPermissions.includes(permission);
                }
            }

            if (!hasPermission) {
                console.warn(`User does not have required permission ('${permission}') for ${pageName}. Redirecting.`);
                window.location.href = '../dashboard/dashboard.html'; // Redirect to a safe default page
                return;
            }

            // Assumes initializeLayout is globally available from layout.js
            initializeLayout(user, gsoLogout);
            pageInitializer(user);

        } catch (error) {
            console.error(`Authentication or initialization failed on ${pageName}:`, error);
        }
    });
}