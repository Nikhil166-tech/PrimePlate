import { navigate, getCurrentPath } from '../router';
import { openMealScanner } from './meal-scanner';
import { escapeHtml } from '../utils/sanitize';

/**
 * Checks whether the given route path belongs to the authenticated student portal.
 * The mobile bottom navigation MUST ONLY appear inside the student portal.
 * It is strictly suppressed on public home, login, auth pages, provider, and admin portals.
 */
export function isStudentPortalRoute(path: string): boolean {
  const clean = path ? path.trim() : '';

  // Explicitly forbidden public or non-student routes
  if (
    clean === '' ||
    clean === '/' ||
    clean === '/home' ||
    clean === '/login' ||
    clean === '/forgot-password' ||
    clean === '/reset-password' ||
    clean.startsWith('/owner') ||
    clean.startsWith('/admin')
  ) {
    return false;
  }

  // Allowed student portal routes
  if (
    clean.startsWith('/student/dashboard') ||
    clean === '/dashboard' ||
    clean.startsWith('/student/transactions') ||
    clean.startsWith('/providers') ||
    clean.startsWith('/checkout')
  ) {
    return true;
  }

  return false;
}

/**
 * Renders the HTML for the student mobile bottom navigation and its More drawer.
 */
export function renderStudentBottomNav(currentPath: string): string {
  const token = localStorage.getItem('accessToken');
  const role = (localStorage.getItem('userRole') || 'STUDENT').toUpperCase();

  // Role safety: Render strictly for logged-in students inside the student portal
  if (!token || role !== 'STUDENT' || !isStudentPortalRoute(currentPath)) {
    return '';
  }

  const searchParams = new URLSearchParams(window.location.search);
  const tabParam = searchParams.get('tab');

  const isDashboard = currentPath === '/student/dashboard' || currentPath === '/dashboard';
  const isMyMealsActive = isDashboard && (tabParam === 'meals' || tabParam === 'meal-history');
  const isHomeActive = isDashboard && !isMyMealsActive;
  const isMessesActive = currentPath.startsWith('/providers');
  const isTransactionsActive = currentPath.startsWith('/student/transactions');

  const userEmail = localStorage.getItem('userEmail') || 'Student';
  const userName = localStorage.getItem('userName') || userEmail.split('@')[0];
  const userPhone = localStorage.getItem('userPhone') || '';
  const initial = (userName.charAt(0) || 'S').toUpperCase();

  return `
    <!-- PrimePlate Mobile Bottom Navigation (Visible <= 768px) -->
    <nav id="studentBottomNav" class="student-bottom-nav" aria-label="Student Mobile Navigation">
      <div class="student-bottom-nav-inner">
        <!-- 1. Home -->
        <a href="/student/dashboard" 
           class="bottom-nav-item ${isHomeActive ? 'active' : ''}" 
           id="bottomNavHomeBtn" 
           data-nav="home" 
           aria-label="Home"
           aria-current="${isHomeActive ? 'page' : 'false'}">
          <span class="bottom-nav-icon-wrap">
            <i class="fa-solid fa-house bottom-nav-icon"></i>
            ${isHomeActive ? '<span class="bottom-nav-indicator"></span>' : ''}
          </span>
          <span class="bottom-nav-label">Home</span>
        </a>

        <!-- 2. Messes -->
        <a href="/providers" 
           class="bottom-nav-item ${isMessesActive ? 'active' : ''}" 
           id="bottomNavMessesBtn" 
           data-nav="messes" 
           aria-label="Messes"
           aria-current="${isMessesActive ? 'page' : 'false'}">
          <span class="bottom-nav-icon-wrap">
            <i class="fa-solid fa-store bottom-nav-icon"></i>
            ${isMessesActive ? '<span class="bottom-nav-indicator"></span>' : ''}
          </span>
          <span class="bottom-nav-label">Messes</span>
        </a>

        <!-- 3. Center Action — Scan Meal -->
        <button type="button" 
                class="bottom-nav-item bottom-nav-scan-item" 
                id="bottomNavScanBtn" 
                data-nav="scan" 
                aria-label="Scan Meal QR Code"
                title="Scan Meal QR">
          <div class="bottom-nav-scan-circle">
            <i class="fa-solid fa-qrcode bottom-nav-scan-icon"></i>
          </div>
          <span class="bottom-nav-label bottom-nav-scan-label">Scan</span>
        </button>

        <!-- 4. My Meals -->
        <a href="/student/dashboard?tab=meals" 
           class="bottom-nav-item ${isMyMealsActive ? 'active' : ''}" 
           id="bottomNavMyMealsBtn" 
           data-nav="my-meals" 
           aria-label="My Meals"
           aria-current="${isMyMealsActive ? 'page' : 'false'}">
          <span class="bottom-nav-icon-wrap">
            <i class="fa-solid fa-calendar-check bottom-nav-icon"></i>
            ${isMyMealsActive ? '<span class="bottom-nav-indicator"></span>' : ''}
          </span>
          <span class="bottom-nav-label">My Meals</span>
        </a>

        <!-- 5. More -->
        <button type="button" 
                class="bottom-nav-item ${isTransactionsActive ? 'active' : ''}" 
                id="bottomNavMoreBtn" 
                data-nav="more" 
                aria-label="More Options" 
                aria-haspopup="dialog"
                aria-expanded="false" 
                aria-controls="studentMoreSheet">
          <span class="bottom-nav-icon-wrap">
            <i class="fa-solid fa-bars bottom-nav-icon"></i>
            ${isTransactionsActive ? '<span class="bottom-nav-indicator"></span>' : ''}
          </span>
          <span class="bottom-nav-label">More</span>
        </button>
      </div>
    </nav>

    <!-- More Bottom Sheet Backdrop -->
    <div id="studentMoreBackdrop" class="student-more-backdrop" style="display: none;" aria-hidden="true"></div>

    <!-- More Bottom Sheet Drawer -->
    <div id="studentMoreSheet" 
         class="student-more-sheet" 
         role="dialog" 
         aria-modal="true" 
         aria-label="Secondary Navigation Options" 
         style="display: none;">
      <div class="student-more-sheet-handle"></div>
      
      <div class="student-more-header">
        <div class="student-more-header-title">
          <span class="student-more-title-text">Account & Tools</span>
        </div>
        <button type="button" 
                id="closeMoreSheetBtn" 
                class="student-more-close-btn" 
                aria-label="Close menu">
          <i class="fa-solid fa-xmark"></i>
        </button>
      </div>

      <!-- Student Profile Card -->
      <div class="student-more-profile-card">
        <div class="student-profile-avatar">${escapeHtml(initial)}</div>
        <div class="student-profile-info">
          <div class="student-profile-name-row">
            <strong class="student-profile-name">${escapeHtml(userName)}</strong>
            <span class="student-role-badge">Student</span>
          </div>
          <span class="student-profile-email">${escapeHtml(userEmail)}</span>
          ${userPhone ? `<span class="student-profile-phone"><i class="fa-solid fa-phone" style="font-size: 10px;"></i> ${escapeHtml(userPhone)}</span>` : ''}
        </div>
      </div>

      <!-- Secondary Links List -->
      <div class="student-more-menu-list">
        <!-- Transactions -->
        <a href="/student/transactions" class="student-more-item" id="moreItemTransactions">
          <div class="more-item-icon-box" style="background: #eff6ff; color: #2563eb;">
            <i class="fa-solid fa-receipt"></i>
          </div>
          <div class="more-item-text">
            <strong class="more-item-title">Transactions</strong>
            <span class="more-item-desc">Payment history, receipts & invoices</span>
          </div>
          <i class="fa-solid fa-chevron-right more-item-arrow"></i>
        </a>

        <!-- Support -->
        <button type="button" class="student-more-item" id="moreItemSupport">
          <div class="more-item-icon-box" style="background: #f0fdf4; color: #16a34a;">
            <i class="fa-solid fa-headset"></i>
          </div>
          <div class="more-item-text">
            <strong class="more-item-title">Help & Support</strong>
            <span class="more-item-desc">WhatsApp, Email & payment issues</span>
          </div>
          <i class="fa-solid fa-chevron-right more-item-arrow"></i>
        </button>

        <!-- Change Password / Security -->
        <a href="/forgot-password" class="student-more-item" id="moreItemSettings">
          <div class="more-item-icon-box" style="background: #faf5ff; color: #9333ea;">
            <i class="fa-solid fa-key"></i>
          </div>
          <div class="more-item-text">
            <strong class="more-item-title">Security & Password</strong>
            <span class="more-item-desc">Reset password & account security</span>
          </div>
          <i class="fa-solid fa-chevron-right more-item-arrow"></i>
        </a>

        <!-- Sign Out -->
        <button type="button" class="student-more-item student-more-logout logoutBtnAction" id="moreItemLogout">
          <div class="more-item-icon-box" style="background: #fef2f2; color: #dc2626;">
            <i class="fa-solid fa-right-from-bracket"></i>
          </div>
          <div class="more-item-text">
            <strong class="more-item-title" style="color: #dc2626;">Sign Out</strong>
            <span class="more-item-desc">Safely exit your student session</span>
          </div>
          <i class="fa-solid fa-chevron-right more-item-arrow" style="color: #f87171;"></i>
        </button>
      </div>
    </div>

    <!-- Quick Support Options Modal -->
    <div id="studentSupportModal" class="student-support-modal" style="display: none;" aria-hidden="true">
      <div class="student-support-dialog">
        <div class="student-support-header">
          <div style="display: flex; align-items: center; gap: 10px;">
            <div style="width: 36px; height: 36px; border-radius: 10px; background: #dcfce7; color: #166534; display: flex; align-items: center; justify-content: center; font-size: 16px;">
              <i class="fa-solid fa-headset"></i>
            </div>
            <h4 style="margin: 0; font-size: 16px; font-weight: 800; color: var(--color-neutral-900);">PrimePlate Support</h4>
          </div>
          <button type="button" id="closeSupportModalBtn" class="student-more-close-btn">&times;</button>
        </div>
        <p style="font-size: 13px; color: var(--color-neutral-600); margin: 0 0 16px 0;">
          Need assistance with your meal pass, meal recovery, or payment? Our support team is here to help!
        </p>
        <div style="display: flex; flex-direction: column; gap: 10px;">
          <a href="https://wa.me/919999999999?text=Hello%20PrimePlate%20Support,%20I%20need%20help%20with%20my%20meal%20subscription" 
             target="_blank" 
             rel="noopener noreferrer" 
             class="support-channel-card" 
             style="display: flex; align-items: center; gap: 12px; padding: 12px 16px; border: 1px solid #bbf7d0; background: #f0fdf4; border-radius: 12px; text-decoration: none; color: #166534;">
            <i class="fa-brands fa-whatsapp" style="font-size: 22px; color: #16a34a;"></i>
            <div style="flex: 1;">
              <strong style="font-size: 13px; display: block;">WhatsApp Chat Support</strong>
              <span style="font-size: 11px; color: #15803d;">Instant response • Mon-Sat 9am-9pm</span>
            </div>
            <i class="fa-solid fa-arrow-up-right-from-square" style="font-size: 12px;"></i>
          </a>

          <a href="mailto:infoprimeplate@gmail.com?subject=PrimePlate%20Student%20Support%20Request" 
             class="support-channel-card" 
             style="display: flex; align-items: center; gap: 12px; padding: 12px 16px; border: 1px solid var(--color-neutral-200); background: #ffffff; border-radius: 12px; text-decoration: none; color: var(--color-neutral-800);">
            <i class="fa-solid fa-envelope" style="font-size: 20px; color: #ea580c;"></i>
            <div style="flex: 1;">
              <strong style="font-size: 13px; display: block;">Email Support</strong>
              <span style="font-size: 11px; color: var(--color-neutral-500);">infoprimeplate@gmail.com</span>
            </div>
            <i class="fa-solid fa-arrow-up-right-from-square" style="font-size: 12px;"></i>
          </a>

          <button type="button" 
                  id="supportReportIssueBtn" 
                  class="support-channel-card" 
                  style="display: flex; align-items: center; gap: 12px; padding: 12px 16px; border: 1px solid #fed7aa; background: #fff7ed; border-radius: 12px; text-align: left; cursor: pointer; color: #9a3412;">
            <i class="fa-solid fa-triangle-exclamation" style="font-size: 20px; color: #ea580c;"></i>
            <div style="flex: 1;">
              <strong style="font-size: 13px; display: block;">Report Payment Issue</strong>
              <span style="font-size: 11px; color: #c2410c;">Submit ticket for failed or pending payment</span>
            </div>
            <i class="fa-solid fa-chevron-right" style="font-size: 12px;"></i>
          </button>
        </div>
      </div>
    </div>
  `;
}

/**
 * Attaches interactive event listeners to the student mobile bottom navigation and More sheet.
 */
export function attachStudentBottomNavEvents(): void {
  const nav = document.getElementById('studentBottomNav');
  if (!nav) {
    document.body.classList.remove('has-student-bottom-nav');
    return;
  }

  // Add body class for mobile bottom safe-area offset
  document.body.classList.add('has-student-bottom-nav');

  const moreBtn = document.getElementById('bottomNavMoreBtn');
  const sheet = document.getElementById('studentMoreSheet');
  const backdrop = document.getElementById('studentMoreBackdrop');
  const closeBtn = document.getElementById('closeMoreSheetBtn');
  const scanBtn = document.getElementById('bottomNavScanBtn');
  const homeBtn = document.getElementById('bottomNavHomeBtn');
  const myMealsBtn = document.getElementById('bottomNavMyMealsBtn');

  const supportModal = document.getElementById('studentSupportModal');
  const moreItemSupport = document.getElementById('moreItemSupport');
  const closeSupportBtn = document.getElementById('closeSupportModalBtn');
  const supportReportIssueBtn = document.getElementById('supportReportIssueBtn');

  const openSheet = () => {
    if (sheet && backdrop) {
      sheet.style.display = 'flex';
      backdrop.style.display = 'block';
      requestAnimationFrame(() => {
        sheet.classList.add('open');
        backdrop.classList.add('open');
      });
      moreBtn?.setAttribute('aria-expanded', 'true');
      document.body.style.overflow = 'hidden';
    }
  };

  const closeSheet = () => {
    if (sheet && backdrop) {
      sheet.classList.remove('open');
      backdrop.classList.remove('open');
      setTimeout(() => {
        sheet.style.display = 'none';
        backdrop.style.display = 'none';
      }, 250);
      moreBtn?.setAttribute('aria-expanded', 'false');
      document.body.style.overflow = '';
    }
  };

  const openSupportModal = () => {
    closeSheet();
    if (supportModal) {
      supportModal.style.display = 'flex';
      requestAnimationFrame(() => {
        supportModal.classList.add('open');
      });
      document.body.style.overflow = 'hidden';
    }
  };

  const closeSupportModal = () => {
    if (supportModal) {
      supportModal.classList.remove('open');
      setTimeout(() => {
        supportModal.style.display = 'none';
      }, 200);
      document.body.style.overflow = '';
    }
  };

  moreBtn?.addEventListener('click', (e) => {
    e.preventDefault();
    const isOpen = sheet?.classList.contains('open');
    if (isOpen) {
      closeSheet();
    } else {
      openSheet();
    }
  });

  closeBtn?.addEventListener('click', closeSheet);
  backdrop?.addEventListener('click', closeSheet);

  // Close when pressing Escape key (preventing listener accumulation)
  const handleKeyDown = (e: KeyboardEvent) => {
    if (e.key === 'Escape') {
      if (supportModal?.classList.contains('open')) {
        closeSupportModal();
      } else if (sheet?.classList.contains('open')) {
        closeSheet();
      }
    }
  };
  if ((window as any).__bottomNavKeydownHandler) {
    document.removeEventListener('keydown', (window as any).__bottomNavKeydownHandler);
  }
  (window as any).__bottomNavKeydownHandler = handleKeyDown;
  document.addEventListener('keydown', handleKeyDown);

  // Center action: Scan Meal QR
  scanBtn?.addEventListener('click', (e) => {
    e.preventDefault();
    closeSheet();
    openMealScanner(() => {
      // Callback after successful check-in
      if (window.location.pathname.includes('/dashboard')) {
        window.location.reload();
      } else {
        navigate('/student/dashboard');
      }
    });
  });

  // Home navigation with instant tab focus if already on dashboard
  homeBtn?.addEventListener('click', (e) => {
    const currentPath = getCurrentPath();
    if (currentPath === '/student/dashboard' || currentPath === '/dashboard') {
      e.preventDefault();
      closeSheet();
      // Inform dashboard to switch to passes overview
      window.dispatchEvent(new CustomEvent('primeplate:switch-tab', { detail: { tab: 'PASSES' } }));
      window.scrollTo({ top: 0, behavior: 'smooth' });
    }
  });

  // My Meals navigation with instant tab focus if already on dashboard
  myMealsBtn?.addEventListener('click', (e) => {
    const currentPath = getCurrentPath();
    if (currentPath === '/student/dashboard' || currentPath === '/dashboard') {
      e.preventDefault();
      closeSheet();
      // Inform dashboard to switch to meal history
      window.dispatchEvent(new CustomEvent('primeplate:switch-tab', { detail: { tab: 'MEAL_HISTORY' } }));
      const mealsAnchor = document.getElementById('tabMealChecklist') || document.getElementById('subsGrid');
      if (mealsAnchor) {
        mealsAnchor.scrollIntoView({ behavior: 'smooth', block: 'start' });
      }
    }
  });

  // Close sheet when navigating to transactions or settings
  document.getElementById('moreItemTransactions')?.addEventListener('click', closeSheet);
  document.getElementById('moreItemSettings')?.addEventListener('click', closeSheet);

  // Support options
  moreItemSupport?.addEventListener('click', openSupportModal);
  closeSupportBtn?.addEventListener('click', closeSupportModal);
  supportModal?.addEventListener('click', (e) => {
    if (e.target === supportModal) {
      closeSupportModal();
    }
  });

  supportReportIssueBtn?.addEventListener('click', () => {
    closeSupportModal();
    navigate('/student/transactions');
  });
}

/**
 * Checks whether the given route path belongs to the authenticated provider portal.
 * The provider mobile bottom navigation MUST ONLY appear inside the provider portal.
 * It is strictly suppressed on public home, login, auth pages, student, and admin portals.
 */
export function isProviderPortalRoute(path: string): boolean {
  const clean = path ? path.trim() : '';
  return clean.startsWith('/owner');
}

/**
 * Renders the HTML for the provider mobile bottom navigation and its More drawer.
 */
export function renderProviderBottomNav(currentPath: string): string {
  const token = localStorage.getItem('accessToken');
  const role = (localStorage.getItem('userRole') || '').toUpperCase();

  // Role safety: Render strictly for logged-in providers inside the provider portal
  if (!token || (role !== 'PROVIDER' && role !== 'MEAL_PROVIDER') || !isProviderPortalRoute(currentPath)) {
    return '';
  }

  const userEmail = localStorage.getItem('userEmail') || 'Provider';
  const userName = localStorage.getItem('userName') || userEmail.split('@')[0];
  const userPhone = localStorage.getItem('userPhone') || '';
  const initial = (userName.charAt(0) || 'P').toUpperCase();

  return `
    <!-- PrimePlate Provider Mobile Bottom Navigation (Visible <= 768px) -->
    <nav id="providerBottomNav" class="provider-bottom-nav" aria-label="Provider Mobile Navigation">
      <div class="provider-bottom-nav-inner">
        <!-- 1. Home -->
        <button type="button" 
                class="bottom-nav-item active" 
                id="providerNavHomeBtn" 
                data-nav="home" 
                aria-label="Provider Home"
                aria-current="page">
          <span class="bottom-nav-icon-wrap">
            <i class="fa-solid fa-house bottom-nav-icon"></i>
            <span class="bottom-nav-indicator"></span>
          </span>
          <span class="bottom-nav-label">Home</span>
        </button>

        <!-- 2. Subscribers -->
        <button type="button" 
                class="bottom-nav-item" 
                id="providerNavSubscribersBtn" 
                data-nav="subscribers" 
                aria-label="Subscribers"
                aria-current="false">
          <span class="bottom-nav-icon-wrap">
            <i class="fa-solid fa-users bottom-nav-icon"></i>
          </span>
          <span class="bottom-nav-label">Subscribers</span>
        </button>

        <!-- 3. Plans -->
        <button type="button" 
                class="bottom-nav-item" 
                id="providerNavPlansBtn" 
                data-nav="plans" 
                aria-label="Meal Plans"
                aria-current="false">
          <span class="bottom-nav-icon-wrap">
            <i class="fa-solid fa-utensils bottom-nav-icon"></i>
          </span>
          <span class="bottom-nav-label">Plans</span>
        </button>

        <!-- 4. QR -->
        <button type="button" 
                class="bottom-nav-item" 
                id="providerNavQrBtn" 
                data-nav="qr" 
                aria-label="Provider QR"
                aria-current="false">
          <span class="bottom-nav-icon-wrap">
            <i class="fa-solid fa-qrcode bottom-nav-icon"></i>
          </span>
          <span class="bottom-nav-label">QR</span>
        </button>

        <!-- 5. More -->
        <button type="button" 
                class="bottom-nav-item" 
                id="providerNavMoreBtn" 
                data-nav="more" 
                aria-label="More Options" 
                aria-haspopup="dialog"
                aria-expanded="false" 
                aria-controls="providerMoreSheet">
          <span class="bottom-nav-icon-wrap">
            <i class="fa-solid fa-ellipsis bottom-nav-icon"></i>
          </span>
          <span class="bottom-nav-label">More</span>
        </button>
      </div>
    </nav>

    <!-- Provider More Bottom Sheet Backdrop -->
    <div id="providerMoreBackdrop" class="provider-more-backdrop" style="display: none;" aria-hidden="true"></div>

    <!-- Provider More Bottom Sheet Drawer -->
    <div id="providerMoreSheet" 
         class="provider-more-sheet" 
         role="dialog" 
         aria-modal="true" 
         aria-label="More Operations & Settings" 
         style="display: none;">
      <div class="provider-more-sheet-handle"></div>
      
      <div class="provider-more-header">
        <div class="provider-more-header-title">
          <span class="provider-more-title-text">More</span>
        </div>
        <button type="button" 
                id="closeProviderMoreSheetBtn" 
                class="provider-more-close-btn" 
                aria-label="Close menu">
          <i class="fa-solid fa-xmark"></i>
        </button>
      </div>

      <!-- Provider Profile Card -->
      <div class="provider-more-profile-card">
        <div class="provider-profile-avatar">${escapeHtml(initial)}</div>
        <div class="provider-profile-info">
          <div class="provider-profile-name-row">
            <strong class="provider-profile-name">${escapeHtml(userName)}</strong>
            <span class="provider-role-badge">Kitchen Provider</span>
          </div>
          <span class="provider-profile-email">${escapeHtml(userEmail)}</span>
          ${userPhone ? `<span class="provider-profile-phone"><i class="fa-solid fa-phone" style="font-size: 10px;"></i> ${escapeHtml(userPhone)}</span>` : ''}
        </div>
      </div>

      <!-- Secondary Links List -->
      <div class="provider-more-menu-list">
        <!-- 💰 Earnings -->
        <button type="button" class="provider-more-item" id="providerMoreEarningsBtn">
          <div class="more-item-icon-box" style="background: #fef3c7; color: #d97706;">
            <i class="fa-solid fa-wallet"></i>
          </div>
          <div class="more-item-text">
            <strong class="more-item-title">Earnings</strong>
            <span class="more-item-desc">Total earnings & payout ledger</span>
          </div>
          <i class="fa-solid fa-chevron-right more-item-arrow"></i>
        </button>

        <!-- 🎁 Meal Recovery -->
        <button type="button" class="provider-more-item" id="providerMoreRecoveryBtn">
          <div class="more-item-icon-box" style="background: #ecfdf5; color: #059669;">
            <i class="fa-solid fa-shield-halved"></i>
          </div>
          <div class="more-item-text">
            <strong class="more-item-title">Meal Recovery</strong>
            <span class="more-item-desc">Policy percentage & recovery statistics</span>
          </div>
          <i class="fa-solid fa-chevron-right more-item-arrow"></i>
        </button>

        <!-- ⚙ Recovery Settings -->
        <button type="button" class="provider-more-item" id="providerMoreRecoverySettingsBtn">
          <div class="more-item-icon-box" style="background: #f0fdf4; color: #16a34a;">
            <i class="fa-solid fa-sliders"></i>
          </div>
          <div class="more-item-text">
            <strong class="more-item-title">Recovery Settings</strong>
            <span class="more-item-desc">Adjust policy rate (50% – 100%)</span>
          </div>
          <i class="fa-solid fa-chevron-right more-item-arrow"></i>
        </button>

        <!-- 🍱 Menu -->
        <button type="button" class="provider-more-item" id="providerMoreMenuBtn">
          <div class="more-item-icon-box" style="background: #eff6ff; color: #2563eb;">
            <i class="fa-solid fa-calendar-week"></i>
          </div>
          <div class="more-item-text">
            <strong class="more-item-title">Menu</strong>
            <span class="more-item-desc">Weekly meal menu schedules</span>
          </div>
          <i class="fa-solid fa-chevron-right more-item-arrow"></i>
        </button>

        <!-- 🎧 Support -->
        <button type="button" class="provider-more-item" id="providerMoreSupportBtn">
          <div class="more-item-icon-box" style="background: #f0fdf4; color: #15803d;">
            <i class="fa-solid fa-headset"></i>
          </div>
          <div class="more-item-text">
            <strong class="more-item-title">Support</strong>
            <span class="more-item-desc">WhatsApp helpdesk & partner support</span>
          </div>
          <i class="fa-solid fa-chevron-right more-item-arrow"></i>
        </button>

        <!-- 👤 Profile -->
        <button type="button" class="provider-more-item" id="providerMoreProfileBtn">
          <div class="more-item-icon-box" style="background: #faf5ff; color: #9333ea;">
            <i class="fa-solid fa-store"></i>
          </div>
          <div class="more-item-text">
            <strong class="more-item-title">Profile</strong>
            <span class="more-item-desc">Kitchen details, photos & amenities</span>
          </div>
          <i class="fa-solid fa-chevron-right more-item-arrow"></i>
        </button>

        <!-- ⚙ Settings -->
        <button type="button" class="provider-more-item" id="providerMoreSettingsBtn">
          <div class="more-item-icon-box" style="background: #f1f5f9; color: #475569;">
            <i class="fa-solid fa-gear"></i>
          </div>
          <div class="more-item-text">
            <strong class="more-item-title">Settings</strong>
            <span class="more-item-desc">Kitchen open/close status & capacity</span>
          </div>
          <i class="fa-solid fa-chevron-right more-item-arrow"></i>
        </button>

        <!-- 🚪 Sign Out -->
        <button type="button" class="provider-more-item provider-more-logout logoutBtnAction" id="providerMoreLogoutBtn">
          <div class="more-item-icon-box" style="background: #fef2f2; color: #dc2626;">
            <i class="fa-solid fa-right-from-bracket"></i>
          </div>
          <div class="more-item-text">
            <strong class="more-item-title" style="color: #dc2626;">Sign Out</strong>
            <span class="more-item-desc">Safely exit provider portal</span>
          </div>
          <i class="fa-solid fa-chevron-right more-item-arrow" style="color: #f87171;"></i>
        </button>
      </div>
    </div>

    <!-- Quick Provider Support Options Modal -->
    <div id="providerSupportModal" class="provider-support-modal" style="display: none;" aria-hidden="true">
      <div class="provider-support-dialog">
        <div class="provider-support-header">
          <div style="display: flex; align-items: center; gap: 10px;">
            <div style="width: 36px; height: 36px; border-radius: 10px; background: #dcfce7; color: #166534; display: flex; align-items: center; justify-content: center; font-size: 16px;">
              <i class="fa-solid fa-headset"></i>
            </div>
            <h4 style="margin: 0; font-size: 16px; font-weight: 800; color: var(--color-neutral-900);">Partner Provider Support</h4>
          </div>
          <button type="button" id="closeProviderSupportModalBtn" class="provider-more-close-btn">&times;</button>
        </div>
        <p style="font-size: 13px; color: var(--color-neutral-600); margin: 0 0 16px 0;">
          Need assistance with mess operations, scanner issues, payouts, or menu settings? Our partner team is here to assist.
        </p>
        <div style="display: flex; flex-direction: column; gap: 10px;">
          <a href="https://wa.me/919999999999?text=Hello%20PrimePlate%20Support,%20I%20am%20a%20mess%20provider%20needing%20assistance" 
             target="_blank" 
             rel="noopener noreferrer" 
             class="support-channel-card" 
             style="display: flex; align-items: center; gap: 12px; padding: 12px 16px; border: 1px solid #bbf7d0; background: #f0fdf4; border-radius: 12px; text-decoration: none; color: #166534;">
            <i class="fa-brands fa-whatsapp" style="font-size: 22px; color: #16a34a;"></i>
            <div style="flex: 1;">
              <strong style="font-size: 13px; display: block;">WhatsApp Partner Support</strong>
              <span style="font-size: 11px; color: #15803d;">Instant response • Priority Partner Desk</span>
            </div>
            <i class="fa-solid fa-arrow-up-right-from-square" style="font-size: 12px;"></i>
          </a>

          <a href="mailto:infoprimeplate@gmail.com?subject=PrimePlate%20Provider%20Support%20Request" 
             class="support-channel-card" 
             style="display: flex; align-items: center; gap: 12px; padding: 12px 16px; border: 1px solid var(--color-neutral-200); background: #ffffff; border-radius: 12px; text-decoration: none; color: var(--color-neutral-800);">
            <i class="fa-solid fa-envelope" style="font-size: 20px; color: #ea580c;"></i>
            <div style="flex: 1;">
              <strong style="font-size: 13px; display: block;">Email Support</strong>
              <span style="font-size: 11px; color: var(--color-neutral-500);">infoprimeplate@gmail.com</span>
            </div>
            <i class="fa-solid fa-arrow-up-right-from-square" style="font-size: 12px;"></i>
          </a>
        </div>
      </div>
    </div>
  `;
}

/**
 * Attaches interactive event listeners to the provider mobile bottom navigation and More sheet.
 */
export function attachProviderBottomNavEvents(): void {
  const nav = document.getElementById('providerBottomNav');
  if (!nav) {
    document.body.classList.remove('has-provider-bottom-nav');
    return;
  }

  // Add body class for mobile bottom safe-area offset
  document.body.classList.add('has-provider-bottom-nav');

  const homeBtn = document.getElementById('providerNavHomeBtn');
  const subscribersBtn = document.getElementById('providerNavSubscribersBtn');
  const plansBtn = document.getElementById('providerNavPlansBtn');
  const qrBtn = document.getElementById('providerNavQrBtn');
  const moreBtn = document.getElementById('providerNavMoreBtn');

  const sheet = document.getElementById('providerMoreSheet');
  const backdrop = document.getElementById('providerMoreBackdrop');
  const closeBtn = document.getElementById('closeProviderMoreSheetBtn');

  const supportModal = document.getElementById('providerSupportModal');
  const closeSupportBtn = document.getElementById('closeProviderSupportModalBtn');

  const navItems = [
    { btn: homeBtn, name: 'home' },
    { btn: subscribersBtn, name: 'subscribers' },
    { btn: plansBtn, name: 'plans' },
    { btn: qrBtn, name: 'qr' },
    { btn: moreBtn, name: 'more' },
  ];

  const setActive = (targetName: string) => {
    navItems.forEach(({ btn, name }) => {
      if (!btn) return;
      const isTarget = name === targetName;
      if (isTarget) {
        btn.classList.add('active');
        btn.setAttribute('aria-current', 'page');
        const iconWrap = btn.querySelector('.bottom-nav-icon-wrap');
        if (iconWrap && !iconWrap.querySelector('.bottom-nav-indicator')) {
          const indicator = document.createElement('span');
          indicator.className = 'bottom-nav-indicator';
          iconWrap.appendChild(indicator);
        }
      } else {
        btn.classList.remove('active');
        btn.setAttribute('aria-current', 'false');
        btn.querySelector('.bottom-nav-indicator')?.remove();
      }
    });
  };

  const openSheet = () => {
    if (sheet && backdrop) {
      sheet.style.display = 'flex';
      backdrop.style.display = 'block';
      requestAnimationFrame(() => {
        sheet.classList.add('open');
        backdrop.classList.add('open');
      });
      moreBtn?.setAttribute('aria-expanded', 'true');
      document.body.style.overflow = 'hidden';
    }
  };

  const closeSheet = () => {
    if (sheet && backdrop) {
      sheet.classList.remove('open');
      backdrop.classList.remove('open');
      setTimeout(() => {
        sheet.style.display = 'none';
        backdrop.style.display = 'none';
      }, 250);
      moreBtn?.setAttribute('aria-expanded', 'false');
      document.body.style.overflow = '';
    }
  };

  const openSupportModal = () => {
    closeSheet();
    if (supportModal) {
      supportModal.style.display = 'flex';
      requestAnimationFrame(() => {
        supportModal.classList.add('open');
      });
      document.body.style.overflow = 'hidden';
    }
  };

  const closeSupportModal = () => {
    if (supportModal) {
      supportModal.classList.remove('open');
      setTimeout(() => {
        supportModal.style.display = 'none';
      }, 200);
      document.body.style.overflow = '';
    }
  };

  // Close any existing open full-screen mobile sheet overlay from owner.ts
  const closeOwnerMobileSheetOverlay = () => {
    const closeOverlayBtn = document.querySelector('.close-mobile-sheet-btn') as HTMLElement | null;
    if (closeOverlayBtn) {
      closeOverlayBtn.click();
    }
  };

  // 1. Home
  homeBtn?.addEventListener('click', (e) => {
    e.preventDefault();
    setActive('home');
    closeSheet();
    closeOwnerMobileSheetOverlay();
    window.scrollTo({ top: 0, behavior: 'smooth' });
  });

  // 2. Subscribers
  subscribersBtn?.addEventListener('click', (e) => {
    e.preventDefault();
    setActive('subscribers');
    closeSheet();
    const openSubsBtn = document.querySelector('.open-subscribers-sheet-btn') as HTMLElement | null;
    if (openSubsBtn) {
      openSubsBtn.click();
    } else {
      const subsSec = document.getElementById('subscribersSection');
      if (subsSec) {
        subsSec.scrollIntoView({ behavior: 'smooth', block: 'start' });
      }
    }
  });

  // 3. Plans
  plansBtn?.addEventListener('click', (e) => {
    e.preventDefault();
    setActive('plans');
    closeSheet();
    closeOwnerMobileSheetOverlay();

    const plansSec = document.getElementById('meal-plans-section') || document.getElementById('messProfileSection');
    if (plansSec) {
      plansSec.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }

    const openPriceBtn = document.querySelector('.open-edit-price-btn') as HTMLElement | null;
    if (openPriceBtn) {
      openPriceBtn.click();
    }
  });

  // 4. QR
  qrBtn?.addEventListener('click', (e) => {
    e.preventDefault();
    setActive('qr');
    closeSheet();
    const openQrBtn = document.querySelector('.open-meal-qr-sheet-btn') as HTMLElement | null;
    if (openQrBtn) {
      openQrBtn.click();
    } else {
      const qrSec = document.getElementById('mealQrSection');
      if (qrSec) {
        qrSec.scrollIntoView({ behavior: 'smooth', block: 'start' });
      }
    }
  });

  // 5. More
  moreBtn?.addEventListener('click', (e) => {
    e.preventDefault();
    const isOpen = sheet?.classList.contains('open');
    if (isOpen) {
      closeSheet();
    } else {
      openSheet();
    }
  });

  closeBtn?.addEventListener('click', closeSheet);
  backdrop?.addEventListener('click', closeSheet);

  // Keyboard Escape
  const handleKeyDown = (e: KeyboardEvent) => {
    if (e.key === 'Escape') {
      if (supportModal?.classList.contains('open')) {
        closeSupportModal();
      } else if (sheet?.classList.contains('open')) {
        closeSheet();
      }
    }
  };
  if ((window as any).__providerBottomNavKeydownHandler) {
    document.removeEventListener('keydown', (window as any).__providerBottomNavKeydownHandler);
  }
  (window as any).__providerBottomNavKeydownHandler = handleKeyDown;
  document.addEventListener('keydown', handleKeyDown);

  // More Sheet Secondary Options
  // 💰 Earnings
  document.getElementById('providerMoreEarningsBtn')?.addEventListener('click', () => {
    closeSheet();
    const openEarnBtn = document.querySelector('.open-earnings-sheet-btn') as HTMLElement | null;
    if (openEarnBtn) {
      openEarnBtn.click();
    } else {
      const earnSec = document.getElementById('earningsOverviewSection') || document.getElementById('earningsHistorySection');
      if (earnSec) {
        earnSec.scrollIntoView({ behavior: 'smooth', block: 'start' });
      }
    }
  });

  // 🎁 Meal Recovery
  document.getElementById('providerMoreRecoveryBtn')?.addEventListener('click', () => {
    closeSheet();
    closeOwnerMobileSheetOverlay();
    const recSec = document.getElementById('recoveryStatsSection');
    if (recSec) {
      recSec.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  });

  // ⚙ Recovery Settings
  document.getElementById('providerMoreRecoverySettingsBtn')?.addEventListener('click', () => {
    closeSheet();
    closeOwnerMobileSheetOverlay();
    const recSec = document.getElementById('recoveryStatsSection');
    if (recSec) {
      recSec.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  });

  // 🍱 Menu
  document.getElementById('providerMoreMenuBtn')?.addEventListener('click', () => {
    closeSheet();
    const openMenuBtn = document.querySelector('.open-weekly-menu-sheet-btn') as HTMLElement | null;
    if (openMenuBtn) {
      openMenuBtn.click();
    } else {
      const menuSec = document.getElementById('weeklyMenuEditorSection');
      if (menuSec) {
        menuSec.scrollIntoView({ behavior: 'smooth', block: 'start' });
      }
    }
  });

  // 🎧 Support
  document.getElementById('providerMoreSupportBtn')?.addEventListener('click', openSupportModal);
  closeSupportBtn?.addEventListener('click', closeSupportModal);
  supportModal?.addEventListener('click', (e) => {
    if (e.target === supportModal) {
      closeSupportModal();
    }
  });

  // 👤 Profile
  document.getElementById('providerMoreProfileBtn')?.addEventListener('click', () => {
    closeSheet();
    closeOwnerMobileSheetOverlay();
    const editProfBtn = document.querySelector('.open-edit-profile-btn') as HTMLElement | null;
    if (editProfBtn) {
      editProfBtn.click();
    } else {
      const profSec = document.getElementById('messProfileSection');
      if (profSec) {
        profSec.scrollIntoView({ behavior: 'smooth', block: 'start' });
      }
    }
  });

  // ⚙ Settings
  document.getElementById('providerMoreSettingsBtn')?.addEventListener('click', () => {
    closeSheet();
    const openManageBtn = document.querySelector('.open-manage-pg-sheet-btn') as HTMLElement | null;
    if (openManageBtn) {
      openManageBtn.click();
    } else {
      const toggleBtn = document.getElementById('toggleManagePgBtn');
      if (toggleBtn) {
        toggleBtn.click();
      }
    }
  });

  // 🚪 Sign Out
  document.getElementById('providerMoreLogoutBtn')?.addEventListener('click', () => {
    closeSheet();
    const logoutBtn = document.querySelector('.logoutBtnAction') as HTMLElement | null;
    if (logoutBtn) {
      logoutBtn.click();
    }
  });
}

