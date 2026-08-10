import { navigate } from '../router';

export function renderNavbar(): string {
  const token = localStorage.getItem('accessToken');
  const role = (localStorage.getItem('userRole') || 'STUDENT').toUpperCase();
  const currentHash = window.location.hash || '#/home';

  const isStudent = role === 'STUDENT';
  const isProvider = role === 'PROVIDER' || role === 'MEAL_PROVIDER';
  const isAdmin = role === 'ADMIN';

  return `
    <nav class="navbar">
      <div class="navbar-container">
        <a href="#/home" class="nav-brand">
          <div class="nav-brand-logo">
            <i class="fa-solid fa-utensils"></i>
          </div>
          <span class="nav-brand-text">PrimePlate</span>
        </a>

        <div style="display: flex; align-items: center; gap: 4px; flex-wrap: wrap;">
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
        </div>

        <div style="display: flex; align-items: center; gap: 12px;">
          ${
            token
              ? `<button id="logoutBtn" class="btn-outline-action" style="color: #dc2626; border-color: #fee2e2; background: #fef2f2;">
                  <i class="fa-solid fa-right-from-bracket"></i> Sign Out
                </button>`
              : `<a href="#/login" class="btn-primary-action">
                  <i class="fa-solid fa-user"></i> Sign In
                </a>`
          }
        </div>
      </div>
    </nav>
  `;
}

export function attachNavbarEvents() {
  const logoutBtn = document.getElementById('logoutBtn');
  if (logoutBtn) {
    logoutBtn.addEventListener('click', () => {
      localStorage.removeItem('accessToken');
      localStorage.removeItem('refreshToken');
      localStorage.removeItem('userRole');
      localStorage.removeItem('userEmail');
      navigate('#/login');
    });
  }
}
