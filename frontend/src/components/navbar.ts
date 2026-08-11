import { navigate } from '../router';

export function renderNavbar(): string {
  const token = localStorage.getItem('accessToken');
  const role = (localStorage.getItem('userRole') || 'STUDENT').toUpperCase();
  const currentHash = window.location.hash || '#/home';

  const isStudent = role === 'STUDENT';
  const isProvider = role === 'PROVIDER' || role === 'MEAL_PROVIDER';
  const isAdmin = role === 'ADMIN';

  const navLinksHtml = `
    <a href="#/home" class="nav-item-btn ${currentHash === '#/home' || currentHash === '' ? 'active' : ''}">
      <i class="fa-solid fa-house"></i> Home
    </a>
    <a href="#/providers" class="nav-item-btn ${currentHash.startsWith('#/providers') ? 'active' : ''}">
      <i class="fa-solid fa-store"></i> Browse Mess
    </a>
    ${
      token && isStudent
        ? `<a href="#/dashboard" class="nav-item-btn ${currentHash === '#/dashboard' ? 'active' : ''}">
            <i class="fa-solid fa-qrcode"></i> My Mess Card
          </a>`
        : ''
    }
    ${
      token && isProvider
        ? `<a href="#/owner" class="nav-item-btn ${currentHash === '#/owner' ? 'active' : ''}">
            <i class="fa-solid fa-building-user"></i> Provider Portal
          </a>`
        : ''
    }
    ${
      token && isAdmin
        ? `<a href="#/admin" class="nav-item-btn ${currentHash === '#/admin' ? 'active' : ''}">
            <i class="fa-solid fa-user-shield"></i> Admin Portal
          </a>`
        : ''
    }
  `;

  const authBtnHtml = token
    ? `<button class="logoutBtnAction btn-outline-action" style="color: #dc2626; border-color: #fee2e2; background: #fef2f2;">
        <i class="fa-solid fa-right-from-bracket"></i> Sign Out
      </button>`
    : `<a href="#/login" class="btn-primary-action">
        <i class="fa-solid fa-user"></i> Sign In
      </a>`;

  return `
    <nav class="navbar">
      <div class="navbar-container">
        <a href="#/home" class="nav-brand">
          <div class="nav-brand-logo">
            <i class="fa-solid fa-utensils"></i>
          </div>
          <span class="nav-brand-text">PrimePlate</span>
        </a>

        <!-- Desktop Menu -->
        <div class="desktop-nav-menu" style="display: flex; align-items: center; gap: 4px;">
          ${navLinksHtml}
        </div>

        <div class="desktop-nav-menu" style="display: flex; align-items: center; gap: 12px;">
          ${authBtnHtml}
        </div>

        <!-- Mobile Toggle Button -->
        <button id="mobileNavToggleBtn" class="mobile-nav-toggle" aria-label="Toggle navigation">
          <i class="fa-solid fa-bars" id="mobileNavToggleIcon"></i>
        </button>
      </div>

      <!-- Mobile Dropdown Drawer -->
      <div id="mobileMenuDrawer" class="mobile-menu-drawer">
        <div style="display: flex; flex-direction: column; gap: 8px;">
          ${navLinksHtml}
        </div>
        <div style="margin-top: 8px; border-top: 1px solid var(--color-neutral-200); padding-top: 12px;">
          ${authBtnHtml}
        </div>
      </div>
    </nav>
  `;
}

export function attachNavbarEvents() {
  const handleLogout = () => {
    localStorage.removeItem('accessToken');
    localStorage.removeItem('refreshToken');
    localStorage.removeItem('userRole');
    localStorage.removeItem('userEmail');
    navigate('#/login');
  };

  document.querySelectorAll('.logoutBtnAction').forEach((btn) => {
    btn.addEventListener('click', handleLogout);
  });

  const toggleBtn = document.getElementById('mobileNavToggleBtn');
  const drawer = document.getElementById('mobileMenuDrawer');
  const icon = document.getElementById('mobileNavToggleIcon');

  if (toggleBtn && drawer && icon) {
    if ((toggleBtn as any)._hasNavListener) {
      return;
    }
    (toggleBtn as any)._hasNavListener = true;

    toggleBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      const isOpen = drawer.classList.contains('open');
      if (isOpen) {
        drawer.classList.remove('open');
        icon.className = 'fa-solid fa-bars';
      } else {
        drawer.classList.add('open');
        icon.className = 'fa-solid fa-xmark';
      }
    });

    drawer.querySelectorAll('a').forEach((link) => {
      link.addEventListener('click', () => {
        drawer.classList.remove('open');
        icon.className = 'fa-solid fa-bars';
      });
    });

    document.addEventListener('click', (e) => {
      if (drawer.classList.contains('open') && !drawer.contains(e.target as Node) && !toggleBtn.contains(e.target as Node)) {
        drawer.classList.remove('open');
        icon.className = 'fa-solid fa-bars';
      }
    });
  }
}


