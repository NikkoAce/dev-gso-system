const GSO_NAV = `
    <li><a href="dashboard.html" class="nav-link flex items-center p-3 rounded-lg text-gray-700 hover:bg-gray-100"><i data-lucide="layout-dashboard" class="mr-3 h-5 w-5"></i>Dashboard</a></li>
    <li><a href="asset-registry.html" class="nav-link flex items-center p-3 rounded-lg text-gray-700 hover:bg-gray-100"><i data-lucide="list" class="mr-3 h-5 w-5"></i>Asset Registry</a></li>
    <li><a href="gso-requisitions.html" class="nav-link flex items-center p-3 rounded-lg text-gray-700 hover:bg-gray-100"><i data-lucide="clipboard-list" class="mr-3 h-5 w-5"></i>Supply Requisitions</a></li>
    <li><a href="inventory.html" class="nav-link flex items-center p-3 rounded-lg text-gray-700 hover:bg-gray-100"><i data-lucide="boxes" class="mr-3 h-5 w-5"></i>Supplies Inventory</a></li>
    <li><a href="asset-form.html" class="nav-link flex items-center p-3 rounded-lg text-gray-700 hover:bg-gray-100"><i data-lucide="plus-square" class="mr-3 h-5 w-5"></i>Add New Asset</a></li>
    <li><a href="slip-history.html" class="nav-link flex items-center p-3 rounded-lg text-gray-700 hover:bg-gray-100"><i data-lucide="history" class="mr-3 h-5 w-5"></i>Slip History</a></li>
    <li><a href="physical-count.html" class="nav-link flex items-center p-3 rounded-lg text-gray-700 hover:bg-gray-100"><i data-lucide="clipboard-check" class="mr-3 h-5 w-5"></i>Physical Count</a></li>
    <li><a href="scanner.html" class="nav-link flex items-center p-3 rounded-lg text-gray-700 hover:bg-gray-100"><i data-lucide="scan-line" class="mr-3 h-5 w-5"></i>Scanner</a></li>
    <li><a href="reports.html" class="nav-link flex items-center p-3 rounded-lg text-gray-700 hover:bg-gray-100"><i data-lucide="file-text" class="mr-3 h-5 w-5"></i>Reports</a></li>
`;

const GSO_SETTINGS = `
    <div class="mt-6">
        <h3 class="px-3 text-xs font-semibold text-gray-500 uppercase tracking-wider">Settings & Tools</h3>
        <ul class="mt-2 space-y-2">
            <li><a href="categories.html" class="nav-link flex items-center p-3 rounded-lg text-gray-700 hover:bg-gray-100"><i data-lucide="tags" class="mr-3 h-5 w-5"></i>Categories</a></li>
            <li><a href="offices.html" class="nav-link flex items-center p-3 rounded-lg text-gray-700 hover:bg-gray-100"><i data-lucide="map-pin" class="mr-3 h-5 w-5"></i>Offices</a></li>
            <li><a href="employees.html" class="nav-link flex items-center p-3 rounded-lg text-gray-700 hover:bg-gray-100"><i data-lucide="users" class="mr-3 h-5 w-5"></i>Employees</a></li>
            <li><a href="qr-labels.html" class="nav-link flex items-center p-3 rounded-lg text-gray-700 hover:bg-gray-100"><i data-lucide="qr-code" class="mr-3 h-5 w-5"></i>Print QR Labels</a></li>
        </ul>
    </div>
`;

const VIEW_ONLY_NAV = `
    <li><a href="https://lgu-employee-portal.netlify.app/dashboard.html" class="nav-link flex items-center p-3 rounded-lg text-gray-700 hover:bg-gray-100"><i data-lucide="arrow-left" class="mr-3 h-5 w-5"></i>Back to Portal</a></li>
    <li><a href="view-assets.html" class="nav-link flex items-center p-3 rounded-lg text-gray-700 hover:bg-gray-100"><i data-lucide="list" class="mr-3 h-5 w-5"></i>View My Assets</a></li>
    <li><a href="requisition.html" class="nav-link flex items-center p-3 rounded-lg text-gray-700 hover:bg-gray-100"><i data-lucide="shopping-cart" class="mr-3 h-5 w-5"></i>Request Supplies</a></li>
    <li><a href="my-requisitions.html" class="nav-link flex items-center p-3 rounded-lg text-gray-700 hover:bg-gray-100"><i data-lucide="history" class="mr-3 h-5 w-5"></i>Requisition History</a></li>
`;

function getSidebarHTML(user) {
    const isGSO = user.office === 'GSO';
    const navLinks = isGSO ? GSO_NAV : VIEW_ONLY_NAV;
    const settings = isGSO ? GSO_SETTINGS : '';
    const logoutButton = isGSO ? `<a href="#" id="logout-button" class="text-xs text-red-500 hover:underline">Logout</a>` : '';
    const userInitial = user.name ? user.name.charAt(0).toUpperCase() : 'U';

    return `
        <div class="p-6 border-b">
            <h1 class="text-xl font-bold text-gray-800">LGU Daet</h1>
            <p class="text-sm text-gray-500">GSO System</p>
        </div>
        <nav class="flex-grow p-4">
            <ul class="space-y-2" id="nav-links">${navLinks}</ul>
            ${settings}
        </nav>
        <div class="p-4 border-t">
            <div class="flex items-center">
                <img src="https://placehold.co/40x40/E2E8F0/4A5568?text=${userInitial}" alt="User" class="rounded-full">
                <div class="ml-3">
                    <p id="user-name" class="font-semibold text-sm">${user.name}</p>
                    <p id="user-office" class="text-xs text-gray-500">${user.office}</p>
                    ${logoutButton}
                </div>
            </div>
        </div>
    `;
}

function initializeLayout(user) {
    if (!user) return;

    const sidebarContainer = document.getElementById('sidebar-container');
    if (sidebarContainer) {
        // Generate the HTML directly, no more fetching
        sidebarContainer.innerHTML = getSidebarHTML(user);

        // Add logout functionality if the button exists
        const logoutButton = document.getElementById('logout-button');
        if (logoutButton) {
            logoutButton.addEventListener('click', (e) => {
                e.preventDefault();
                localStorage.removeItem('portalAuthToken');
                // IMPORTANT: Replace with the URL of your deployed login portal
                window.location.href = 'https://lgu-employee-portal.netlify.app/index.html';
            });
        }

        // Highlight the active nav link
        const currentPage = window.location.pathname.split('/').pop();
        const navLinks = sidebarContainer.querySelectorAll('.nav-link');
        navLinks.forEach(link => {
            if (link.getAttribute('href') === currentPage) {
                link.classList.add('active');
            }
        });
        lucide.createIcons();
    }
}