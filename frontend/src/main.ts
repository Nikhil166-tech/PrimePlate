import './style.css';
import { initRouter, registerRoute, navigate } from './router';
import { renderHome } from './pages/home';
import { renderLogin } from './pages/login';
import { renderProviders } from './pages/providers';
import { renderProviderDetail } from './pages/provider-detail';
import { renderCheckout } from './pages/checkout';
import { renderDashboard } from './pages/dashboard';
import { renderOwnerPortal } from './pages/owner';
import { renderAdminPortal } from './pages/admin';
import { renderForgotPassword } from './pages/forgot-password';
import { renderResetPassword } from './pages/reset-password';

// Auth & Role guard
function requireRole(allowedRoles: string[], callback: () => void) {
  const token = localStorage.getItem('accessToken');
  const role = (localStorage.getItem('userRole') || 'STUDENT').toUpperCase();

  if (!token) {
    // Save target route so visitor returns directly to checkout after login/register
    localStorage.setItem('redirectAfterAuth', window.location.hash);
    navigate('#/login');
    return;
  }

  if (allowedRoles.includes(role)) {
    callback();
  } else {
    // Redirect based on role if attempting to access forbidden route
    if (role === 'ADMIN') {
      navigate('#/admin');
    } else if (role === 'PROVIDER' || role === 'MEAL_PROVIDER') {
      navigate('#/owner');
    } else {
      navigate('#/student/dashboard');
    }
  }
}

// Register routes
registerRoute('#/home', renderHome);
registerRoute('#/login', renderLogin);
registerRoute('#/forgot-password', renderForgotPassword);
registerRoute('#/reset-password', renderResetPassword);
registerRoute('#/providers', renderProviders);
registerRoute('#/dashboard', () => requireRole(['STUDENT'], renderDashboard));
registerRoute('#/student/dashboard', () => requireRole(['STUDENT'], renderDashboard));
registerRoute('#/owner', () => requireRole(['PROVIDER', 'MEAL_PROVIDER'], renderOwnerPortal));
registerRoute('#/admin', () => requireRole(['ADMIN'], renderAdminPortal));
registerRoute('#/providers/:id', () => {
  const id = window.location.hash.split('/')[2];
  renderProviderDetail(id);
});
registerRoute('#/checkout/:planId', () => {
  const planId = window.location.hash.split('/')[2];
  requireRole(['STUDENT'], () => renderCheckout(planId));
});

// Initialize router
initRouter();
