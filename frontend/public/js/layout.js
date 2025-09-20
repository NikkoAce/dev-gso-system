// Data-driven navigation configuration for the GSO Admin sidebar.
// Each item can have a `permission` property to control its visibility.
const GSO_NAV_CONFIG = [
  { href: '../dashboard/dashboard.html', icon: 'layout-dashboard', text: 'Dashboard', permission: 'dashboard:view' },
  {
    icon: 'file-text', text: 'Reports', permission: 'report:generate',
    children: [
      { href: '../reports/reports.html', icon: 'archive', text: 'Movable Assets', permission: 'report:generate' },
      { href: '../reports/immovable-reports.html', icon: 'file-text', text: 'Immovable Assets', permission: 'report:generate' }
    ]
  },
  {
    icon: 'archive', text: 'Assets', permission: 'asset:read',
    children: [
      { href: '../assets/asset-registry.html', icon: 'list', text: 'Asset Registry', permission: 'asset:read' },
      { href: '../assets/asset-form.html', icon: 'plus-square', text: 'Add New Asset', permission: 'asset:create' },
      { href: '../slips/slip-history.html', icon: 'history', text: 'Slip History', permission: 'slip:read' },
      { href: '../assets/physical-count.html', icon: 'clipboard-check', text: 'Physical Count', permission: 'asset:update' },
      { href: '../assets/qr-labels.html', icon: 'qr-code', text: 'Print QR Labels', permission: 'asset:read' },
    ]
  },
  {
    icon: 'land-plot', text: 'Immovable Assets', permission: 'immovable:read',
    children: [
      { href: '../immovable-assets/immovable-registry.html', icon: 'list', text: 'Registry', permission: 'immovable:read' },
      { href: '../immovable-assets/immovable-map.html', icon: 'map', text: 'Asset Map', permission: 'immovable:read' },
      { href: '../immovable-assets/immovable-form.html', icon: 'plus-square', text: 'Add New', permission: 'immovable:create' },
    ]
  },
  {
    icon: 'boxes', text: 'Supplies', permission: 'stock:read',
    children: [
      { href: '../supplies/gso-requisitions.html', icon: 'clipboard-list', text: 'Supply Requisitions', permission: 'requisition:read:all' },
      { href: '../supplies/inventory.html', icon: 'boxes', text: 'Supplies Inventory', permission: 'stock:manage' },
    ]
  },
  {
    icon: 'settings', text: 'Settings', permission: 'settings:read',
    children: [
      { href: '../settings/categories.html', icon: 'tags', text: 'Categories', permission: 'settings:manage' },
      { href: '../settings/offices.html', icon: 'map-pin', text: 'Offices', permission: 'settings:manage' },
      { href: '../settings/employees.html', icon: 'users', text: 'Employees', permission: 'settings:manage' },
      { href: '../settings/users.html', icon: 'user-cog', text: 'User Management', permission: 'user:read' },
      { href: '../settings/signatories.html', icon: 'pen-square', text: 'Signatories', permission: 'settings:manage' },
      { href: '../settings/roles.html', icon: 'shield-check', text: 'Role Management', permission: 'user:manage' },
      { href: '../settings/data-management.html', icon: 'database', text: 'Data Management', permission: 'admin:data:read' },
    ]
  }
];

// Data-driven navigation for the employee-facing portal view.
const VIEW_ONLY_NAV_CONFIG = [
    { href: 'https://lgu-employee-portal.netlify.app/dashboard.html', icon: 'arrow-left', text: 'Back to Portal' },
    { href: '../portal/view-assets.html', icon: 'list', text: 'View My Assets', permission: 'asset:read:own_office' },
    { href: '../portal/requisition.html', icon: 'shopping-cart', text: 'Request Supplies', permission: 'requisition:create' },
    { href: '../portal/my-requisitions.html', icon: 'history', text: 'Requisition History', permission: 'requisition:read:own_office' },
];

/**
 * Recursively builds the navigation HTML from a configuration object,
 * checking user permissions at each level.
 * @param {Array} navConfig - The navigation configuration array.
 * @param {Array<string>} userPermissions - The permissions of the current user.
 * @returns {string} The generated HTML for the navigation.
 */
function buildNav(navConfig, userPermissions) {
  let navHtml = '';
  navConfig.forEach(item => {
    // If an item requires a permission, check if the user has it.
    // If no permission is specified (like 'Back to Portal'), always show it.
    if (item.permission && !userPermissions.includes(item.permission)) {
      return; // Skip this item if permission is missing
    }

    if (item.children) {
      // Build submenu and only render the parent if there are visible children
      const childrenHtml = buildNav(item.children, userPermissions);
      if (childrenHtml) {
        navHtml += `
          <li class="tooltip tooltip-right" data-tip="${item.text}">
            <details class="nav-details">
              <summary><i data-lucide="${item.icon}"></i><span class="nav-text">${item.text}</span></summary>
              <ul class="text-sm">${childrenHtml}</ul>
            </details>
          </li>
        `;
      }
    } else {
      // Build a single link
      navHtml += `<li class="tooltip tooltip-right" data-tip="${item.text}"><a href="${item.href}" class="nav-link"><i data-lucide="${item.icon}"></i><span class="nav-text">${item.text}</span></a></li>`;
    }
  });
  return navHtml;
}

function getSidebarHTML(user) {
  const userPermissions = user.permissions || [];
  const isAdmin = user.role === 'GSO Admin';
  let navLinks;

  if (isAdmin) {
    // Build the admin navigation based on their specific permissions
    navLinks = buildNav(GSO_NAV_CONFIG, userPermissions);
  } else {
    // Build the employee-facing navigation
    navLinks = buildNav(VIEW_ONLY_NAV_CONFIG, userPermissions);
  }

  const logoutButton = isAdmin
    ? `<button id="logout-button" class="btn btn-error btn-xs mt-2">Logout</button>`
    : "";
  const userInitial = user.name ? user.name.charAt(0).toUpperCase() : "U";

  return `
    <!-- Header -->
    <div id="sidebar-header" class="relative p-4 border-b border-base-300 flex flex-col items-center justify-center gap-1 min-h-[140px]">
      <img src="../LGU-DAET-LOGO.png" alt="LGU Daet Logo" class="h-20 w-20 mb-1 sidebar-expanded-logo">
      <img src="../LGU-DAET-LOGO.png" alt="LGU Daet Logo" class="h-10 w-10 hidden sidebar-collapsed-logo">
      <div class="text-center sidebar-expanded-logo">
        <h1 class="text-lg font-bold leading-tight">LGU DAET</h1>
        <p class="text-xs text-gray-500">GSO Management System</p>
      </div>
      <!-- NEW: Moved and restyled toggle button -->
      <button id="sidebar-toggle-btn" class="btn btn-circle btn-sm absolute top-4 -right-4 bg-base-100 border border-base-300 hover:bg-base-200 hidden md:flex z-10" title="Collapse/Expand Sidebar">
            <i data-lucide="chevrons-left"></i>
      </button>
    </div>

    <!-- Navigation -->
    <nav class="flex-grow overflow-y-auto" id="sidebar-nav">
      <ul class="menu menu-lg p-4">${navLinks}</ul>
    </nav>

    <!-- Footer / User Info -->
    <div class="p-4 mt-auto border-t border-base-300 space-y-4">
      <div id="sidebar-user-info" class="flex items-center gap-3">
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
      <div class="form-control">
        <label for="theme-switcher" class="label py-0"><span class="label-text text-xs">Theme</span></label>
        <select id="theme-switcher" class="select select-bordered select-xs font-normal">
          <!-- Options will be populated by JS -->
        </select>
      </div>
    </div>
    <!-- Toggle button is now in the header -->
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

function initializeLayout(user, logoutFunction) {
  if (!user) return;

  const sidebarContainer = document.getElementById("sidebar-container");
  const mobileMenuButton = document.getElementById("mobile-menu-button");

  if (sidebarContainer) {
    sidebarContainer.className = 'fixed inset-y-0 left-0 z-50 w-64 bg-base-200 h-screen flex flex-col border-r non-printable hide-in-preview transform -translate-x-full transition-transform duration-300 ease-in-out md:relative md:translate-x-0';
    sidebarContainer.innerHTML = getSidebarHTML(user);

    // Attach the passed logout function to the button
    const logoutButton = document.getElementById("logout-button");
    if (logoutButton) {
      logoutButton.addEventListener("click", (e) => {
        e.preventDefault();
        if (typeof logoutFunction === 'function') {
            logoutFunction();
        }
      });
    }

    // Highlight current page
    const currentPage = window.location.pathname.substring(window.location.pathname.lastIndexOf('/') + 1);
    const navLinks = sidebarContainer.querySelectorAll(".nav-link");
    navLinks.forEach((link) => {
      const linkPage = link.getAttribute("href").substring(link.getAttribute("href").lastIndexOf('/') + 1);
      if (linkPage === currentPage) {
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

    // --- NEW: Desktop Sidebar Collapse Logic ---
    const sidebarToggleBtn = document.getElementById('sidebar-toggle-btn');
    const body = document.body;

    if (sidebarToggleBtn) {
        const applySidebarState = (isCollapsed) => {
            body.classList.toggle('sidebar-collapsed', isCollapsed);

            // When collapsing, close any open submenus
            if (isCollapsed) {
                const allDetails = sidebarContainer.querySelectorAll('.menu details[open]');
                allDetails.forEach(details => {
                    details.removeAttribute('open');
                });
            }
        };

        // Check localStorage on load and apply state
        const isCollapsed = localStorage.getItem('sidebar-collapsed') === 'true';
        applySidebarState(isCollapsed);

        sidebarToggleBtn.addEventListener('click', () => {
            const shouldCollapse = !body.classList.contains('sidebar-collapsed');
            localStorage.setItem('sidebar-collapsed', shouldCollapse);
            applySidebarState(shouldCollapse);
        });

        // --- NEW: Fly-out menu logic for collapsed sidebar ---
        const navDetails = sidebarContainer.querySelectorAll('.nav-details');
        navDetails.forEach(details => {
            const parentLi = details.parentElement;
            if (!parentLi) return;

            parentLi.addEventListener('mouseenter', () => {
                if (body.classList.contains('sidebar-collapsed')) {
                    details.setAttribute('open', '');
                }
            });
            parentLi.addEventListener('mouseleave', () => {
                if (body.classList.contains('sidebar-collapsed')) {
                    details.removeAttribute('open');
                }
            });
        });
    }

    lucide.createIcons();
  }

  // --- Mobile Menu Logic ---
  if (mobileMenuButton && sidebarContainer) {
    // Create a backdrop overlay for mobile
    const header = mobileMenuButton.parentElement;
    const h1 = header.querySelector('h1');

    // Add logo to mobile header if it doesn't exist to avoid duplication
    if (h1 && !header.querySelector('img')) {
        // Create a new container for the logo and title
        const logoTitleContainer = document.createElement('div');
        logoTitleContainer.className = 'flex items-center gap-3';
        logoTitleContainer.innerHTML = `
            <img src="../LGU-DAET-LOGO.png" alt="LGU Logo" class="h-8 w-8">
        `;
        // Move the original h1 into our new container
        logoTitleContainer.appendChild(h1);
        // Insert the new container before the menu button
        header.insertBefore(logoTitleContainer, mobileMenuButton);
    }

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
