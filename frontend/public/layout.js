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
    <div class="p-4 border-t border-base-300">
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
    </div>
  `;
}

function initializeLayout(user) {
  if (!user) return;

  const sidebarContainer = document.getElementById("sidebar-container");
  if (sidebarContainer) {
    // Set the correct classes for the DaisyUI sidebar layout
    sidebarContainer.className = 'w-64 bg-base-200 h-screen flex flex-col border-r hidden md:flex non-printable';
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

    // Initialize Lucide
    lucide.createIcons();
  }
}
