const GSO_MAIN_NAV = `
  <li><a href="dashboard.html" class="nav-link"><i data-lucide="layout-dashboard"></i> Dashboard</a></li>
  <li><a href="reports.html" class="nav-link"><i data-lucide="file-text"></i> Reports</a></li>
`;

const GSO_ASSETS_NAV = `
  <li>
    <details open>
      <summary><i data-lucide="archive"></i> Assets</summary>
      <ul class="text-sm">
        <li><a href="asset-registry.html" class="nav-link"><i data-lucide="list"></i> Asset Registry</a></li>
        <li><a href="asset-form.html" class="nav-link"><i data-lucide="plus-square"></i> Add New Asset</a></li>
        <li><a href="slip-history.html" class="nav-link"><i data-lucide="history"></i> Slip History</a></li>
        <li><a href="physical-count.html" class="nav-link"><i data-lucide="clipboard-check"></i> Physical Count</a></li>
        <li><a href="scanner.html" class="nav-link"><i data-lucide="scan-line"></i> Scanner</a></li>
        <li><a href="qr-labels.html" class="nav-link"><i data-lucide="qr-code"></i> Print QR Labels</a></li>
      </ul>
    </details>
  </li>
`;

const GSO_SUPPLIES_NAV = `
  <li>
    <details>
      <summary><i data-lucide="boxes"></i> Supplies</summary>
      <ul class="text-sm">
        <li><a href="gso-requisitions.html" class="nav-link"><i data-lucide="clipboard-list"></i> Supply Requisitions</a></li>
        <li><a href="inventory.html" class="nav-link"><i data-lucide="boxes"></i> Supplies Inventory</a></li>
      </ul>
    </details>
  </li>
`;

const GSO_SETTINGS_NAV = `
  <li>
    <details>
      <summary><i data-lucide="settings"></i> Settings</summary>
      <ul class="text-sm">
        <li><a href="categories.html" class="nav-link"><i data-lucide="tags"></i> Categories</a></li>
        <li><a href="offices.html" class="nav-link"><i data-lucide="map-pin"></i> Offices</a></li>
        <li><a href="employees.html" class="nav-link"><i data-lucide="users"></i> Employees</a></li>
      </ul>
    </details>
  </li>
`;

const VIEW_ONLY_NAV = `
  <li><a href="https://lgu-employee-portal.netlify.app/dashboard.html" class="nav-link"><i data-lucide="arrow-left"></i> Back to Portal</a></li>
  <li><a href="view-assets.html" class="nav-link"><i data-lucide="list"></i> View My Assets</a></li>
  <li><a href="requisition.html" class="nav-link"><i data-lucide="shopping-cart"></i> Request Supplies</a></li>
  <li><a href="my-requisitions.html" class="nav-link"><i data-lucide="history"></i> Requisition History</a></li>
`;

function getSidebarHTML(user) {
  const isGSO = user.office === "GSO";
  let navLinks;
  if (isGSO) {
    navLinks = `
      ${GSO_MAIN_NAV}
      ${GSO_ASSETS_NAV}
      ${GSO_SUPPLIES_NAV}
      ${GSO_SETTINGS_NAV}
    `;
  } else {
    navLinks = VIEW_ONLY_NAV;
  }
  const logoutButton = isGSO
    ? `<button id="logout-button" class="btn btn-error btn-xs mt-2">Logout</button>`
    : "";
  const userInitial = user.name ? user.name.charAt(0).toUpperCase() : "U";

  return `
    <!-- Header -->
    <div class="p-6 border-b border-base-300">
      <h1 class="text-xl font-bold">LGU Daet</h1>
      <p class="text-sm text-gray-500">GSO System</p>
    </div>

    <!-- Navigation -->
    <nav class="flex-grow overflow-y-auto">
      <ul class="menu menu-lg p-4">${navLinks}</ul>
    </nav>

    <!-- Footer / User Info -->
    <div class="p-4 border-t border-base-300 space-y-4">
      <div class="flex items-center gap-3">
        <div class="avatar placeholder">
          <div class="bg-neutral-focus text-neutral-content rounded-full w-10">
            <span>${userInitial}</span>
          </div>
        </div>
        <div>
          <p id="user-name" class="font-semibold text-sm">${user.name}</p>
          <p id="user-office" class="text-xs text-gray-500">${user.office}</p>
          ${logoutButton}
        </div>
      </div>
      <!-- NEW: Theme Switcher -->
      <div class="form-control">
        <label for="theme-switcher" class="label py-0"><span class="label-text text-xs">Theme</span></label>
        <select id="theme-switcher" class="select select-bordered select-xs font-normal">
          <!-- Options will be populated by JS -->
        </select>
      </div>
    </div>
  `;
}

function setupThemeSwitcher() {
    const themeSwitcher = document.getElementById('theme-switcher');
    if (!themeSwitcher) return;

    const themes = ['light', 'dark', 'cupcake', 'synthwave', 'retro', 'cyberpunk', 'valentine', 'aqua', 'lofi', 'dracula', 'forest', 'business'];

    // Populate dropdown
    themes.forEach(theme => {
        const option = document.createElement('option');
        option.value = theme;
        option.textContent = theme.charAt(0).toUpperCase() + theme.slice(1);
        themeSwitcher.appendChild(option);
    });

    // Apply saved theme or default
    const savedTheme = localStorage.getItem('gso-theme') || 'light';
    document.documentElement.setAttribute('data-theme', savedTheme);
    themeSwitcher.value = savedTheme;

    // Add event listener
    themeSwitcher.addEventListener('change', (e) => {
        const selectedTheme = e.target.value;
        document.documentElement.setAttribute('data-theme', selectedTheme);
        localStorage.setItem('gso-theme', selectedTheme);
    });
}

function initializeLayout(user) {
  if (!user) return;

  const sidebarContainer = document.getElementById("sidebar-container");
  const mobileMenuButton = document.getElementById("mobile-menu-button");

  if (sidebarContainer) {
    // Updated classes for mobile-friendly slide-out behavior
    sidebarContainer.className = 'fixed inset-y-0 left-0 z-50 w-64 bg-base-200 h-screen flex flex-col border-r non-printable transform -translate-x-full transition-transform duration-300 ease-in-out md:relative md:translate-x-0';
    sidebarContainer.innerHTML = getSidebarHTML(user);

    // Logout
    const logoutButton = document.getElementById("logout-button");
    if (logoutButton) {
      logoutButton.addEventListener("click", (e) => {
        e.preventDefault();
        localStorage.removeItem("portalAuthToken");
        window.location.href =
          "https://lgu-employee-portal.netlify.app/index.html";
      });
    }

    // Highlight current page
    const currentPage = window.location.pathname.split("/").pop();
    const navLinks = sidebarContainer.querySelectorAll(".nav-link");
    navLinks.forEach((link) => {
      if (link.getAttribute("href") === currentPage) {
        // Just add the active class. The styling will be handled by our custom CSS rule.
        link.classList.add("active");

        // If the active link is inside a collapsible section, open it.
        const parentDetails = link.closest('details');
        if (parentDetails) {
            parentDetails.setAttribute('open', '');
        }
      }
    });

    setupThemeSwitcher();
    lucide.createIcons();
  }

  // --- Mobile Menu Logic ---
  if (mobileMenuButton && sidebarContainer) {
    // Create a backdrop overlay for mobile
    const backdrop = document.createElement('div');
    backdrop.className = 'fixed inset-0 bg-black bg-opacity-50 z-40 hidden md:hidden';
    document.body.appendChild(backdrop);

    const toggleSidebar = () => {
      // Check if the sidebar is currently open (i.e., it does NOT have the translate class)
      const isOpen = !sidebarContainer.classList.contains('-translate-x-full');
      // Add/remove the class to slide it in or out
      sidebarContainer.classList.toggle('-translate-x-full', isOpen);
      backdrop.classList.toggle('hidden', isOpen);
    };

    mobileMenuButton.addEventListener('click', toggleSidebar);
    backdrop.addEventListener('click', toggleSidebar);
  }
}
