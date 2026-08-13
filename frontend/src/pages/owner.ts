import api from '../api';
import { navigate } from '../router';
import { showToast } from '../components/toast';
import { renderNavbar, attachNavbarEvents } from '../components/navbar';
import { escapeHtml, getSafeImageUrl } from '../utils/sanitize';

const DAYS_OF_WEEK = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];

export async function renderOwnerPortal() {
  const container = document.getElementById('app')!;
  const token = localStorage.getItem('accessToken');
  const userRole = (localStorage.getItem('userRole') || '').toUpperCase();

  if (!token || (userRole !== 'PROVIDER' && userRole !== 'MEAL_PROVIDER')) {
    showToast('Provider workspace authorization required', 'error');
    navigate('#/login');
    return;
  }

  let hostels: any[] = [];
  let selectedHostel: any = null;
  let showModal = false;
  let showEditPriceModal = false;
  let editingMenu: { dayIdx: number; mealType: string } | null = null;
  let editingMenuValue = '';

  const fetchHostels = async () => {
    try {
      const data: any = await api.get('/providers/my');
      hostels = Array.isArray(data) ? data : [];
      if (hostels.length > 0 && !selectedHostel) {
        selectedHostel = hostels[0];
      }
    } catch (err: any) {
      hostels = [];
    }
  };

  await fetchHostels();

  let liveSubs: any[] = [];
  let subscribersLoading = false;
  let subscribersError: string | null = null;
  let subscriberSearchQuery = '';

  const fetchLiveSubs = async () => {
    if (!selectedHostel || selectedHostel.approvalStatus !== 'APPROVED') {
      liveSubs = [];
      subscribersLoading = false;
      subscribersError = null;
      return;
    }
    subscribersLoading = true;
    subscribersError = null;
    try {
      const data: any = await api.get(`/subscriptions/provider/${selectedHostel.id}`);
      liveSubs = Array.isArray(data) ? data : [];
    } catch (err: any) {
      liveSubs = [];
      subscribersError = err.message || 'Unable to load subscribers.';
    } finally {
      subscribersLoading = false;
    }
  };

  let weeklyMenus: any[] = [];
  const fetchWeeklyMenus = async () => {
    if (!selectedHostel || selectedHostel.approvalStatus !== 'APPROVED') {
      weeklyMenus = [];
      return;
    }
    try {
      const data: any = await api.get(`/weekly-menus/provider/${selectedHostel.id}`);
      weeklyMenus = Array.isArray(data) ? data : [];
    } catch (_) {
      weeklyMenus = [];
    }
  };

  await fetchLiveSubs();
  await fetchWeeklyMenus();

  const render = () => {
    const totalSubscribersCount = liveSubs.length;
    const totalRevenue = liveSubs.reduce(
      (sum, s) => sum + Number(s.amountPaid || s.mealPlan?.pricePerMonth || selectedHostel?.monthlyPrice || 0),
      0,
    );
    const netEarnings = totalRevenue;
    const activeSubscribersCount = liveSubs.filter((s) => (s.status || '').toUpperCase() === 'ACTIVE').length;

    const subSearchQueryLower = subscriberSearchQuery.toLowerCase().trim();
    const filteredSubscribers = liveSubs.filter((sub) => {
      if (!subSearchQueryLower) return true;
      const name = (sub.student?.name || sub.student?.email || '').toLowerCase();
      const phone = (sub.student?.phone || '').toLowerCase();
      return name.includes(subSearchQueryLower) || phone.includes(subSearchQueryLower);
    });

    const getSubStatusStyle = (statusStr: string) => {
      switch (statusStr) {
        case 'ACTIVE':
          return 'background: var(--color-success-50); color: var(--color-success-600); border: 1px solid #bbf7d0;';
        case 'PAUSED':
          return 'background: #fef3c7; color: #d97706; border: 1px solid #fde68a;';
        case 'CANCELLED':
          return 'background: #fee2e2; color: #dc2626; border: 1px solid #fca5a5;';
        case 'EXPIRED':
          return 'background: var(--color-neutral-100); color: var(--color-neutral-600); border: 1px solid var(--color-neutral-300);';
        default:
          return 'background: var(--color-neutral-100); color: var(--color-neutral-600); border: 1px solid var(--color-neutral-300);';
      }
    };

    const monthlyPriceNum = selectedHostel?.monthlyPrice !== undefined && selectedHostel?.monthlyPrice !== null
      ? Number(selectedHostel.monthlyPrice)
      : 2999;

    const getMenuItem = (dayIdx: number, type: string) => {
      const found = weeklyMenus.find(
        (m: any) => Number(m.dayOfWeek) === dayIdx && String(m.mealType).toLowerCase() === type.toLowerCase(),
      );
      return found && found.menuItems ? found.menuItems : 'No menu available';
    };

    const isNewProvider = hostels.length === 0;
    const isPending = selectedHostel && selectedHostel.approvalStatus === 'PENDING';

    const userEmail = localStorage.getItem('userEmail') || 'Provider';
    const ownerName = localStorage.getItem('userName') || userEmail.split('@')[0];
    const ownerPhone = localStorage.getItem('userPhone') || 'Not available';

    container.innerHTML = `
      ${renderNavbar()}
      <main class="main-content" style="padding-top: 88px; padding-bottom: 60px; background: #f8fafc;">
        <div style="max-width: 1280px; margin: 0 auto; padding: 0 24px;">
          <!-- Workspace Header -->
          <div style="display: flex; justify-content: space-between; align-items: flex-end; margin-bottom: 28px; flex-wrap: wrap; gap: 16px;">
            <div>
              <div style="display: inline-flex; align-items: center; gap: 6px; background: var(--color-primary-50); color: var(--color-primary-700); padding: 4px 12px; border-radius: 999px; font-size: 12px; font-weight: 700; margin-bottom: 8px;">
                <i class="fa-solid fa-building-user"></i> Provider Owner Workspace
              </div>
              <h1 class="font-display" style="font-size: 32px; font-weight: 800; color: var(--color-neutral-900);">Hostel & Mess Management</h1>
              <p style="color: var(--color-neutral-600); font-size: 14px; margin-top: 4px;">Owner: <strong>${escapeHtml(ownerName)}</strong> • Phone: <strong>${escapeHtml(ownerPhone)}</strong> (${escapeHtml(userEmail)})</p>
            </div>

            ${!isNewProvider && !isPending
        ? `<button id="openHostelModalBtn" class="btn-primary-action" style="padding: 10px 20px; font-size: 14px;">
                    <i class="fa-solid fa-plus"></i> Add Another Hostel
                  </button>`
        : ''
      }
          </div>

          ${isNewProvider
        ? `
            <!-- STATE 1: NEW PROVIDER ONBOARDING HERO FORM -->
            <div style="max-width: 680px; margin: 20px auto; background: #fff; border: 1px solid var(--color-neutral-200); border-radius: 28px; padding: 40px; box-shadow: 0 12px 36px rgba(0,0,0,0.06); text-align: center;">
              <div style="width: 72px; height: 72px; border-radius: 20px; background: var(--color-primary-100); color: var(--color-primary-600); display: flex; align-items: center; justify-content: center; font-size: 32px; margin: 0 auto 20px;">
                <i class="fa-solid fa-store"></i>
              </div>

              <h2 class="font-display" style="font-size: 28px; font-weight: 800; color: var(--color-neutral-900); margin-bottom: 8px;">Register Your PG or Hostel Mess</h2>
              <p style="color: var(--color-neutral-600); font-size: 15px; margin-bottom: 28px; line-height: 1.6;">
                Welcome to PrimePlate! Submit your hostel kitchen details below to apply for verified provider listing. Admin will review and approve your kitchen.
              </p>

              <form id="centerHostelForm" style="text-align: left; display: flex; flex-direction: column; gap: 16px;">
                <div>
                  <label style="font-size: 13px; font-weight: 700; color: var(--color-neutral-800); display: block; margin-bottom: 6px;">Hostel / Mess Name *</label>
                  <input type="text" id="cName" class="btn-outline-action" style="width: 100%; background: #fff; padding: 12px 16px; font-size: 14px;" placeholder="e.g. Sri Lakshmi Deluxe PG & Mess" required />
                </div>

                <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 16px;">
                  <div>
                    <label style="font-size: 13px; font-weight: 700; color: var(--color-neutral-800); display: block; margin-bottom: 6px;">City *</label>
                    <input type="text" id="cCity" class="btn-outline-action" style="width: 100%; background: #fff; padding: 12px 16px; font-size: 14px;" placeholder="e.g. Bangalore" required />
                  </div>
                  <div>
                    <label style="font-size: 13px; font-weight: 700; color: var(--color-neutral-800); display: block; margin-bottom: 6px;">Area / Locality *</label>
                    <input type="text" id="cArea" class="btn-outline-action" style="width: 100%; background: #fff; padding: 12px 16px; font-size: 14px;" placeholder="e.g. Koramangala 5th Block" required />
                  </div>
                </div>

                <div>
                  <label style="font-size: 13px; font-weight: 700; color: var(--color-neutral-800); display: block; margin-bottom: 6px;">Full Address *</label>
                  <input type="text" id="cAddress" class="btn-outline-action" style="width: 100%; background: #fff; padding: 12px 16px; font-size: 14px;" placeholder="#124, 8th Main, near Sony World Signal" required />
                </div>

                <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 16px;">
                  <div>
                    <label style="font-size: 13px; font-weight: 700; color: var(--color-neutral-800); display: block; margin-bottom: 6px;">Monthly Subscription Price (₹) *</label>
                    <input type="number" id="cPrice" class="btn-outline-action" style="width: 100%; background: #fff; padding: 12px 16px; font-size: 14px;" placeholder="Monthly Price" required />
                  </div>
                  <div>
                    <label style="font-size: 13px; font-weight: 700; color: var(--color-neutral-800); display: block; margin-bottom: 6px;">Student Capacity *</label>
                    <input type="number" id="cCapacity" class="btn-outline-action" style="width: 100%; background: #fff; padding: 12px 16px; font-size: 14px;" placeholder="Capacity" required />
                  </div>
                </div>

                <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 16px;">
                  <div>
                    <label style="font-size: 13px; font-weight: 700; color: var(--color-neutral-800); display: block; margin-bottom: 6px;">Contact Phone *</label>
                    <input type="text" id="cPhone" class="btn-outline-action" style="width: 100%; background: #fff; padding: 12px 16px; font-size: 14px;" placeholder="+91 98765 43210" required />
                  </div>
                  <div>
                    <label style="font-size: 13px; font-weight: 700; color: var(--color-neutral-800); display: block; margin-bottom: 6px;">Food Category *</label>
                    <select id="cCategory" class="btn-outline-action" style="width: 100%; background: #fff; padding: 12px 16px; font-size: 14px;">
                      <option value="Veg">Veg</option>
                      <option value="Non Veg">Non Veg</option>
                      <option value="South Indian">South Indian</option>
                      <option value="North Indian">North Indian</option>
                    </select>
                  </div>
                </div>

                <button type="submit" class="btn-primary-action" style="width: 100%; justify-content: center; padding: 14px; font-size: 16px; margin-top: 8px; box-shadow: 0 4px 16px rgba(234, 88, 12, 0.3);">
                  <i class="fa-solid fa-paper-plane"></i> Submit Registration for Admin Approval
                </button>
              </form>
            </div>
          `
        : isPending
          ? `
            <!-- STATE 2: BROAD WAITING FOR ADMIN APPROVAL BANNER -->
            <div style="background: #fff; border: 2px dashed #f59e0b; border-radius: 28px; padding: 48px 32px; text-align: center; max-width: 800px; margin: 30px auto; box-shadow: 0 8px 24px rgba(245, 158, 11, 0.1);">
              <div style="width: 80px; height: 80px; border-radius: 999px; background: #fef3c7; color: #d97706; display: flex; align-items: center; justify-content: center; font-size: 36px; margin: 0 auto 24px;">
                <i class="fa-solid fa-clock-rotate-left"></i>
              </div>

              <span style="font-size: 12px; font-weight: 800; color: #d97706; background: #fef3c7; padding: 6px 16px; border-radius: 999px; text-transform: uppercase; letter-spacing: 1px; display: inline-block; margin-bottom: 16px;">
                Registration Pending Approval
              </span>

              <h2 class="font-display" style="font-size: 30px; font-weight: 800; color: var(--color-neutral-900); margin-bottom: 12px;">Application Submitted & Under Review</h2>
              
              <p style="color: var(--color-neutral-600); font-size: 16px; line-height: 1.6; max-width: 600px; margin: 0 auto 32px;">
                Thank you for registering <strong>${escapeHtml(selectedHostel.name)}</strong>! System Admin is currently reviewing your food safety & address verification details. Your mess listing will go live automatically once approved.
              </p>

              <!-- Submitted Details Summary Box -->
              <div style="background: #f8fafc; border: 1px solid var(--color-neutral-200); border-radius: 20px; padding: 24px; text-align: left; max-width: 640px; margin: 0 auto 32px;">
                <h4 style="font-size: 14px; font-weight: 700; color: var(--color-neutral-900); margin-bottom: 16px; border-bottom: 1px solid var(--color-neutral-200); padding-bottom: 8px;">
                  <i class="fa-solid fa-file-invoice"></i> Submitted Hostel Details
                </h4>

                <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 16px; font-size: 13px;">
                  <div>
                    <span style="color: var(--color-neutral-500); display: block;">Hostel Name:</span>
                    <strong style="color: var(--color-neutral-900);">${escapeHtml(selectedHostel.name)}</strong>
                  </div>
                  <div>
                    <span style="color: var(--color-neutral-500); display: block;">Location:</span>
                    <strong style="color: var(--color-neutral-900);">${escapeHtml(selectedHostel.city || 'Not specified')}</strong>
                  </div>
                  <div>
                    <span style="color: var(--color-neutral-500); display: block;">Monthly Plan Price:</span>
                    <strong style="color: var(--color-primary-600);">${selectedHostel.monthlyPrice ? '₹' + Number(selectedHostel.monthlyPrice).toLocaleString('en-IN') + ' / mo' : 'Price unavailable'}</strong>
                  </div>
                  <div>
                    <span style="color: var(--color-neutral-500); display: block;">Student Capacity:</span>
                    <strong style="color: var(--color-neutral-900);">${selectedHostel.totalCapacity ? selectedHostel.totalCapacity + ' Students' : 'Capacity unavailable'}</strong>
                  </div>
                  <div style="grid-column: 1 / -1;">
                    <span style="color: var(--color-neutral-500); display: block;">Address:</span>
                    <strong style="color: var(--color-neutral-900);">${escapeHtml(selectedHostel.address || 'Not specified')}</strong>
                  </div>
                </div>
              </div>

              <div style="display: flex; justify-content: center; gap: 16px; flex-wrap: wrap;">
                <button id="refreshStatusBtn" class="btn-primary-action" style="padding: 12px 28px; font-size: 15px; border-radius: 12px;">
                  <i class="fa-solid fa-rotate-right"></i> Refresh Approval Status
                </button>
              </div>
            </div>
          `
          : `
            <!-- STATE 3: APPROVED MEAL PROVIDER WORKSPACE -->

            <!-- Hostel Selector Tabs (if multiple) -->
            ${hostels.length > 1
            ? `
              <div style="display: flex; gap: 12px; margin-bottom: 24px; overflow-x: auto; padding-bottom: 4px;">
                ${hostels
              .map(
                (h) => `
                  <button class="hostel-tab-btn btn-outline-action" data-id="${h.id}" style="background: ${selectedHostel?.id === h.id ? 'var(--color-primary-50)' : '#fff'}; border-color: ${selectedHostel?.id === h.id ? 'var(--color-primary-500)' : 'var(--color-neutral-200)'}; color: ${selectedHostel?.id === h.id ? 'var(--color-primary-600)' : 'var(--color-neutral-700)'}; font-weight: 700;">
                    <i class="fa-solid fa-building-user"></i> ${escapeHtml(h.name)}
                  </button>
                `,
              )
              .join('')}
              </div>
            `
            : ''
          }

            <!-- 4-Metrics Stats Row (Responsive System Layout) -->
            <div class="owner-stats-grid">
              <div class="owner-stat-card subscribers">
                <div class="owner-stat-header">
                  <div class="owner-stat-icon">
                    <i class="fa-solid fa-users"></i>
                  </div>
                  <span class="owner-stat-label">Subscribers</span>
                </div>
                <p class="owner-stat-value">${totalSubscribersCount}</p>
              </div>

              <div class="owner-stat-card revenue">
                <div class="owner-stat-header">
                  <div class="owner-stat-icon">
                    <i class="fa-solid fa-chart-line"></i>
                  </div>
                  <span class="owner-stat-label">Total Revenue</span>
                </div>
                <p class="owner-stat-value">₹${totalRevenue.toLocaleString('en-IN')}</p>
              </div>

              <div class="owner-stat-card earnings">
                <div class="owner-stat-header">
                  <div class="owner-stat-icon">
                    <i class="fa-solid fa-wallet"></i>
                  </div>
                  <span class="owner-stat-label">Your Earnings</span>
                </div>
                <p class="owner-stat-value">₹${netEarnings.toLocaleString('en-IN')}</p>
              </div>

              <div class="owner-stat-card rating">
                <div class="owner-stat-header">
                  <div class="owner-stat-icon">
                    <i class="fa-solid fa-star"></i>
                  </div>
                  <span class="owner-stat-label">Rating</span>
                </div>
                <p class="owner-stat-value">${(selectedHostel.rating ?? 0) > 0 ? Number(selectedHostel.rating).toFixed(1) : '0.0'}</p>
              </div>
            </div>

            <!-- Workspace Quick Navigation Bar -->
            <div style="display: flex; gap: 10px; overflow-x: auto; margin-bottom: 24px; padding-bottom: 4px;">
              <button class="quick-nav-btn btn-outline-action" data-target="messProfileSection" style="font-size: 13px; font-weight: 700; padding: 8px 16px; border-radius: 999px; background: #fff; cursor: pointer;">
                <i class="fa-solid fa-store" style="color: var(--color-primary-600);"></i> Mess Profile
              </button>
              <button class="quick-nav-btn btn-outline-action" data-target="weeklyMenuEditorSection" style="font-size: 13px; font-weight: 700; padding: 8px 16px; border-radius: 999px; background: #fff; cursor: pointer;">
                <i class="fa-solid fa-calendar-week" style="color: #0ea5e9;"></i> Weekly Menu
              </button>
              <button class="quick-nav-btn btn-outline-action" data-target="todaysMenuSection" style="font-size: 13px; font-weight: 700; padding: 8px 16px; border-radius: 999px; background: #fff; cursor: pointer;">
                <i class="fa-solid fa-clock" style="color: #d97706;"></i> Today's Menu
              </button>
              <button class="quick-nav-btn btn-outline-action" data-target="subscribersSection" style="font-size: 13px; font-weight: 700; padding: 8px 16px; border-radius: 999px; background: #fff; cursor: pointer;">
                <i class="fa-solid fa-users" style="color: #22c55e;"></i> Subscribers
              </button>
            </div>

            <!-- SECTION 1: Hostel / Mess Profile Section (Clean Responsive System) -->
            <div id="messProfileSection" class="owner-section-card" style="background: #fff; border: 1px solid var(--color-neutral-200); border-radius: 20px; padding: 20px; margin-bottom: 24px; box-shadow: 0 4px 12px rgba(0,0,0,0.03);">
              <div style="display: flex; align-items: flex-start; gap: 14px; flex-wrap: wrap;">
                <img src="${getSafeImageUrl(selectedHostel.imageUrl)}" alt="${escapeHtml(selectedHostel.name)}" style="width: 80px; height: 80px; border-radius: 14px; object-fit: cover; flex-shrink: 0; border: 1px solid var(--color-neutral-200);" />
                
                <div style="flex: 1; min-width: 200px;">
                  <h2 class="font-display" style="font-size: 20px; font-weight: 800; color: var(--color-neutral-900); margin: 0 0 6px 0;">${escapeHtml(selectedHostel.name)}</h2>
                  
                  <p style="font-size: 13px; color: var(--color-neutral-600); display: flex; align-items: center; gap: 6px; margin: 0 0 4px 0;">
                    <i class="fa-solid fa-location-dot" style="font-size: 12px; color: var(--color-neutral-400);"></i> ${escapeHtml(selectedHostel.address || selectedHostel.city || 'Location not specified')}
                  </p>
                  
                  <p style="font-size: 13px; color: var(--color-neutral-600); display: flex; align-items: center; gap: 6px; margin: 0 0 10px 0;">
                    <i class="fa-solid fa-phone" style="font-size: 12px; color: var(--color-neutral-400);"></i> ${escapeHtml(selectedHostel.contactPhone || 'No phone recorded')}
                  </p>
                  
                  <div style="display: flex; flex-wrap: wrap; gap: 6px;">
                    <span style="font-size: 12px; font-weight: 700; background: var(--color-primary-50); color: var(--color-primary-700); padding: 4px 10px; border-radius: 8px;">
                      ${escapeHtml(selectedHostel.category || 'Veg & Non-Veg')}
                    </span>
                    <span style="font-size: 12px; font-weight: 600; background: var(--color-neutral-100); color: var(--color-neutral-700); padding: 4px 10px; border-radius: 8px;">
                      ₹${monthlyPriceNum.toLocaleString('en-IN')}/month
                    </span>
                    <span style="font-size: 12px; font-weight: 600; background: var(--color-neutral-100); color: var(--color-neutral-700); padding: 4px 10px; border-radius: 8px;">
                      ${totalSubscribersCount}/${selectedHostel.totalCapacity ?? 50} filled
                    </span>
                  </div>
                </div>
              </div>

              <!-- Hostel Actions Bar -->
              <div style="display: flex; gap: 10px; flex-wrap: wrap; margin-top: 16px; padding-top: 14px; border-top: 1px solid var(--color-neutral-100); align-items: center;">
                <button class="open-edit-price-btn btn-primary-action" style="font-size: 13px; padding: 8px 16px; border-radius: 10px; font-weight: 700;">
                  <i class="fa-solid fa-pen-to-square"></i> Change Price
                </button>
                <button id="toggleOpenBtn" class="btn-outline-action" style="font-size: 13px; padding: 8px 14px; border-radius: 10px; background: ${selectedHostel.acceptingSubscriptions !== false ? '#d1fae5' : '#fee2e2'}; color: ${selectedHostel.acceptingSubscriptions !== false ? '#059669' : '#dc2626'}; border: 1px solid ${selectedHostel.acceptingSubscriptions !== false ? '#a7f3d0' : '#fca5a5'}; font-weight: 700;">
                  <i class="fa-solid ${selectedHostel.acceptingSubscriptions !== false ? 'fa-door-open' : 'fa-door-closed'}"></i> ${selectedHostel.acceptingSubscriptions !== false ? 'Kitchen: OPEN' : 'Kitchen: CLOSED'}
                </button>
                <button id="editCapacityBtn" class="btn-outline-action" style="font-size: 13px; padding: 8px 14px; border-radius: 10px; font-weight: 600;">
                  <i class="fa-solid fa-users-gear"></i> Set Capacity (${selectedHostel.totalCapacity ?? 'Not set'})
                </button>
              </div>
            </div>

            <!-- Today's Menu Summary Highlight Card -->
            <div id="todaysMenuSection" style="background: #fff; border: 1px solid var(--color-neutral-200); border-radius: 20px; padding: 20px; margin-bottom: 24px; box-shadow: 0 4px 12px rgba(0,0,0,0.03);">
              <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 12px; flex-wrap: wrap; gap: 8px;">
                <h3 class="font-display" style="font-size: 16px; font-weight: 700; color: var(--color-neutral-900); margin: 0; display: flex; align-items: center; gap: 8px;">
                  <i class="fa-solid fa-calendar-day" style="color: var(--color-primary-600);"></i> Today's Menu (${DAYS_OF_WEEK[(new Date().getDay() + 6) % 7]})
                </h3>
                <span style="font-size: 12px; font-weight: 600; color: var(--color-neutral-500);">Auto-updated daily</span>
              </div>
              <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(180px, 1fr)); gap: 12px;">
                <div style="background: var(--color-neutral-50); border: 1px solid var(--color-neutral-200); border-radius: 12px; padding: 12px;">
                  <span style="color: #d97706; font-weight: 700; font-size: 12px; display: block; margin-bottom: 4px;">Breakfast</span>
                  <span style="font-size: 13px; color: var(--color-neutral-800); font-weight: 600;">${escapeHtml(getMenuItem((new Date().getDay() + 6) % 7, 'Breakfast'))}</span>
                </div>
                <div style="background: var(--color-neutral-50); border: 1px solid var(--color-neutral-200); border-radius: 12px; padding: 12px;">
                  <span style="color: var(--color-primary-600); font-weight: 700; font-size: 12px; display: block; margin-bottom: 4px;">Lunch</span>
                  <span style="font-size: 13px; color: var(--color-neutral-800); font-weight: 600;">${escapeHtml(getMenuItem((new Date().getDay() + 6) % 7, 'Lunch'))}</span>
                </div>
                <div style="background: var(--color-neutral-50); border: 1px solid var(--color-neutral-200); border-radius: 12px; padding: 12px;">
                  <span style="color: #8b5cf6; font-weight: 700; font-size: 12px; display: block; margin-bottom: 4px;">Dinner</span>
                  <span style="font-size: 13px; color: var(--color-neutral-800); font-weight: 600;">${escapeHtml(getMenuItem((new Date().getDay() + 6) % 7, 'Dinner'))}</span>
                </div>
              </div>
            </div>

            <!-- 2-Column Workspace Grid -->
            <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(280px, 1fr)); gap: 24px;">
              
              <!-- Column 1: Weekly Menu Editor -->
              <div id="weeklyMenuEditorSection" style="background: #fff; border: 1px solid var(--color-neutral-200); border-radius: 24px; padding: 24px; box-shadow: 0 4px 12px rgba(0,0,0,0.03);">
                <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 20px;">
                  <h3 class="font-display" style="font-size: 18px; font-weight: 700; color: var(--color-neutral-900); margin: 0;">
                    <i class="fa-solid fa-utensils" style="color: var(--color-primary-600);"></i> Weekly Menu
                  </h3>
                </div>

                <div style="display: flex; flex-direction: column; gap: 16px; max-height: 520px; overflow-y: auto; padding-right: 4px; margin-top: 16px;">
                  ${DAYS_OF_WEEK.map(
            (day, dayIdx) => `
                    <div style="border-bottom: 1px solid var(--color-neutral-100); padding-bottom: 12px;">
                      <strong style="font-size: 14px; color: var(--color-neutral-900); display: block; margin-bottom: 8px;">${day}</strong>
                      <div style="display: flex; flex-direction: column; gap: 8px;">
                        ${['Breakfast', 'Lunch', 'Dinner'].map((meal) => {
              const currentVal = getMenuItem(dayIdx, meal);
              const isEditing = editingMenu?.dayIdx === dayIdx && editingMenu?.mealType === meal;
              return `
                            <div class="menu-meal-card">
                              <div class="menu-meal-header">
                                <span class="menu-meal-title ${meal.toLowerCase()}">${meal}</span>
                                ${!isEditing ? `
                                  <button class="start-edit-menu-btn menu-icon-btn" data-day-idx="${dayIdx}" data-meal="${meal}" title="Edit ${day} ${meal}">
                                    <i class="fa-solid fa-pen-to-square"></i>
                                  </button>
                                ` : ''}
                              </div>
                              ${isEditing ? `
                                <div style="display: flex; gap: 6px; align-items: center; margin-top: 4px;">
                                  <input type="text" id="inlineMenuInput" class="menu-inline-input" value="${escapeHtml(editingMenuValue)}" placeholder="Enter menu items..." autoFocus />
                                  <button id="saveInlineMenuBtn" class="btn-icon-save" title="Save Menu"><i class="fa-solid fa-check"></i></button>
                                  <button id="cancelInlineMenuBtn" class="btn-icon-cancel" title="Cancel"><i class="fa-solid fa-xmark"></i></button>
                                </div>
                              ` : `
                                <p style="font-size: 13px; color: var(--color-neutral-700); line-height: 1.4; margin: 0;">
                                  ${currentVal === 'No menu available' ? '<span style="color: var(--color-neutral-400); font-style: italic;">Click edit to add</span>' : escapeHtml(currentVal)}
                                </p>
                              `}
                            </div>
                          `;
            }).join('')}
                      </div>
                    </div>
                  `,
          ).join('')}
                </div>
              </div>

              <!-- Column 2: Simplified Subscribers Section -->
              <div id="subscribersSection" style="background: #fff; border-radius: 24px; padding: 24px; border: 1px solid var(--color-neutral-200); box-shadow: 0 4px 12px rgba(0,0,0,0.03);">
                <!-- Header with Active Count -->
                <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 16px; flex-wrap: wrap; gap: 8px;">
                  <div style="display: flex; align-items: center; gap: 8px;">
                    <i class="fa-solid fa-users" style="color: var(--color-primary-600); font-size: 20px;"></i>
                    <h3 class="font-display" style="font-size: 18px; font-weight: 700; color: var(--color-neutral-900); margin: 0;">Subscribers</h3>
                  </div>
                  <span style="font-size: 12px; font-weight: 700; background: var(--color-success-50); color: var(--color-success-600); padding: 4px 12px; border-radius: 999px; border: 1px solid #bbf7d0;">
                    ${activeSubscribersCount} Active
                  </span>
                </div>

                <!-- Search Input -->
                <div style="margin-bottom: 16px;">
                  <input type="text" id="subscriberSearchInput" class="btn-outline-action" style="width: 100%; background: #fff; padding: 10px 14px; font-size: 13px; border-radius: 10px;" placeholder="Search subscribers..." value="${escapeHtml(subscriberSearchQuery)}" />
                </div>

                <!-- Content Area: Loading / Error / Empty / Subscriber List -->
                ${
                  subscribersLoading
                    ? `
                      <div style="text-align: center; padding: 48px 0;">
                        <i class="fa-solid fa-spinner fa-spin" style="font-size: 24px; color: var(--color-primary-600);"></i>
                        <p style="margin-top: 12px; font-size: 14px; color: var(--color-neutral-600);">Loading subscribers...</p>
                      </div>
                    `
                    : subscribersError
                    ? `
                      <div style="background: #fff; border: 1px solid #fee2e2; border-radius: 16px; padding: 24px; text-align: center;">
                        <i class="fa-solid fa-triangle-exclamation" style="font-size: 32px; color: #dc2626; margin-bottom: 12px;"></i>
                        <p style="color: var(--color-neutral-900); font-weight: 700; font-size: 15px; margin-bottom: 6px;">Unable to load subscribers.</p>
                        <p style="color: var(--color-neutral-500); font-size: 13px; margin-bottom: 16px;">${escapeHtml(subscribersError)}</p>
                        <button id="retrySubscribersBtn" class="btn-primary-action" style="padding: 8px 20px; font-size: 13px;">
                          <i class="fa-solid fa-rotate-right"></i> Retry
                        </button>
                      </div>
                    `
                    : filteredSubscribers.length === 0
                    ? `
                      <div style="text-align: center; padding: 40px 16px; background: var(--color-neutral-50); border: 1px dashed var(--color-neutral-300); border-radius: 16px;">
                        <div style="width: 48px; height: 48px; border-radius: 50%; background: var(--color-neutral-100); display: flex; align-items: center; justify-content: center; margin: 0 auto 12px; color: var(--color-neutral-400); font-size: 20px;">
                          <i class="fa-solid fa-users"></i>
                        </div>
                        <h4 style="font-size: 15px; font-weight: 700; color: var(--color-neutral-900); margin-bottom: 4px;">No Subscribers Yet</h4>
                        <p style="font-size: 13px; color: var(--color-neutral-500); margin: 0;">${subscriberSearchQuery ? 'No subscribers match your search filter.' : 'Once students subscribe to your meal plan, they will appear here.'}</p>
                      </div>
                    `
                    : `
                      <div style="display: flex; flex-direction: column; gap: 12px; max-height: 520px; overflow-y: auto; padding-right: 4px;">
                        ${filteredSubscribers
                          .map((sub: any) => {
                            const studentName = escapeHtml(sub.student?.name || sub.student?.email || 'Subscriber');
                            const studentPhone = escapeHtml(sub.student?.phone || 'Not recorded');
                            const planTitle = escapeHtml(sub.mealPlan?.title || sub.planType || 'Subscription Plan');
                            const statusUpper = sub.status ? String(sub.status).toUpperCase() : 'UNKNOWN';
                            const statusBadgeStyle = getSubStatusStyle(statusUpper);

                            let amountPaidDisplay = 'Amount unavailable';
                            if (sub.amountPaid !== undefined && sub.amountPaid !== null && !isNaN(Number(sub.amountPaid))) {
                              amountPaidDisplay = `₹${Number(sub.amountPaid).toLocaleString('en-IN')}`;
                            } else if (sub.payment?.amount !== undefined && sub.payment?.amount !== null && !isNaN(Number(sub.payment.amount))) {
                              amountPaidDisplay = `₹${Number(sub.payment.amount).toLocaleString('en-IN')}`;
                            } else if (sub.mealPlan?.pricePerMonth !== undefined && sub.mealPlan?.pricePerMonth !== null && !isNaN(Number(sub.mealPlan.pricePerMonth))) {
                              amountPaidDisplay = `₹${Number(sub.mealPlan.pricePerMonth).toLocaleString('en-IN')}`;
                            }

                            const startDateStr = sub.startDate ? escapeHtml(sub.startDate) : 'Not recorded';
                            const endDateStr = sub.endDate ? escapeHtml(sub.endDate) : 'Not recorded';

                            return `
                              <div style="background: var(--color-neutral-50); border-radius: 16px; padding: 14px; border: 1px solid var(--color-neutral-200); display: flex; flex-direction: column; gap: 10px;">
                                <div style="display: flex; justify-content: space-between; align-items: flex-start; gap: 8px;">
                                  <div style="min-width: 0; flex: 1;">
                                    <strong style="font-size: 14px; font-weight: 700; color: var(--color-neutral-900); display: block; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;" title="${studentName}">${studentName}</strong>
                                    <span style="font-size: 12px; color: var(--color-neutral-500); display: flex; align-items: center; gap: 5px; margin-top: 2px;">
                                      <i class="fa-solid fa-phone" style="font-size: 11px; color: var(--color-neutral-400);"></i> ${studentPhone}
                                    </span>
                                  </div>
                                  <span style="font-size: 11px; font-weight: 800; padding: 3px 10px; border-radius: 999px; white-space: nowrap; ${statusBadgeStyle}">
                                    ${statusUpper}
                                  </span>
                                </div>

                                <div style="background: #ffffff; border: 1px solid var(--color-neutral-200); border-radius: 12px; padding: 10px 12px; display: flex; flex-direction: column; gap: 6px;">
                                  <div style="display: flex; justify-content: space-between; align-items: center; gap: 8px;">
                                    <span style="font-size: 12px; color: var(--color-neutral-500); font-weight: 600; flex-shrink: 0;">Subscription Plan</span>
                                    <span style="font-size: 12px; font-weight: 700; color: var(--color-neutral-900); text-align: right; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;" title="${planTitle}">${planTitle}</span>
                                  </div>
                                  <div style="display: flex; justify-content: space-between; align-items: center; gap: 8px; border-top: 1px dashed var(--color-neutral-200); padding-top: 6px;">
                                    <span style="font-size: 12px; color: var(--color-neutral-500); font-weight: 600; flex-shrink: 0;">Amount Paid</span>
                                    <span style="font-size: 15px; font-weight: 800; color: var(--color-primary-600);">${amountPaidDisplay}</span>
                                  </div>
                                </div>

                                <div style="display: flex; justify-content: space-between; align-items: center; font-size: 12px; color: var(--color-neutral-600); border-top: 1px solid var(--color-neutral-200); padding-top: 8px; flex-wrap: wrap; gap: 6px;">
                                  <span><i class="fa-solid fa-calendar-day" style="color: var(--color-primary-500);"></i> Start: <strong style="color: var(--color-neutral-800);">${startDateStr}</strong></span>
                                  <span><i class="fa-solid fa-calendar-check" style="color: var(--color-success-600);"></i> End: <strong style="color: var(--color-neutral-800);">${endDateStr}</strong></span>
                                </div>
                              </div>
                            `;
                          })
                          .join('')}
                      </div>
                    `
                }
              </div>

            </div>
          `
      }
        </div>
      </main>

      <!-- Modal: Add New Hostel Listing -->
      <div id="hostelModal" style="display: ${showModal ? 'flex' : 'none'}; position: fixed; inset: 0; background: rgba(0,0,0,0.5); align-items: center; justify-content: center; z-index: 1000; padding: 20px;">
        <div style="background: #fff; border-radius: 24px; max-width: 540px; width: 100%; padding: 32px; box-shadow: 0 20px 40px rgba(0,0,0,0.2); max-height: 90vh; overflow-y: auto;">
          <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 20px;">
            <h3 class="font-display" style="font-size: 20px; font-weight: 800;">Register New Hostel Listing</h3>
            <button id="closeModalBtn" style="background: none; border: none; font-size: 20px; cursor: pointer; color: var(--color-neutral-500);">&times;</button>
          </div>

          <form id="addHostelForm" style="display: flex; flex-direction: column; gap: 14px;">
            <div>
              <label style="font-size: 12px; font-weight: 700; display: block; margin-bottom: 4px;">Hostel Name *</label>
              <input type="text" id="hName" class="btn-outline-action" style="width: 100%; background: #fff;" placeholder="Hostel Name" required />
            </div>

            <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 12px;">
              <div>
                <label style="font-size: 12px; font-weight: 700; display: block; margin-bottom: 4px;">City *</label>
                <input type="text" id="hCity" class="btn-outline-action" style="width: 100%; background: #fff;" placeholder="City" required />
              </div>
              <div>
                <label style="font-size: 12px; font-weight: 700; display: block; margin-bottom: 4px;">Area *</label>
                <input type="text" id="hArea" class="btn-outline-action" style="width: 100%; background: #fff;" placeholder="Area" required />
              </div>
            </div>

            <div>
              <label style="font-size: 12px; font-weight: 700; display: block; margin-bottom: 4px;">Address *</label>
              <input type="text" id="hAddress" class="btn-outline-action" style="width: 100%; background: #fff;" placeholder="Full Address" required />
            </div>

            <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 12px;">
              <div>
                <label style="font-size: 12px; font-weight: 700; display: block; margin-bottom: 4px;">Monthly Price (₹) *</label>
                <input type="number" id="hPrice" class="btn-outline-action" style="width: 100%; background: #fff;" placeholder="Price" required />
              </div>
              <div>
                <label style="font-size: 12px; font-weight: 700; display: block; margin-bottom: 4px;">Capacity *</label>
                <input type="number" id="hCapacity" class="btn-outline-action" style="width: 100%; background: #fff;" placeholder="Capacity" required />
              </div>
            </div>

            <div>
              <label style="font-size: 12px; font-weight: 700; display: block; margin-bottom: 4px;">Contact Phone *</label>
              <input type="text" id="hPhone" class="btn-outline-action" style="width: 100%; background: #fff;" placeholder="Phone" required />
            </div>

            <button type="submit" class="btn-primary-action" style="width: 100%; justify-content: center; padding: 12px; font-size: 15px; margin-top: 8px;">
              Submit for Admin Approval
            </button>
          </form>
        </div>
      </div>

      <!-- Modal: Edit Subscription Price -->
      <div id="editPriceModal" style="display: ${showEditPriceModal ? 'flex' : 'none'}; position: fixed; inset: 0; background: rgba(0,0,0,0.5); align-items: center; justify-content: center; z-index: 1000; padding: 20px;">
        <div style="background: #fff; border-radius: 24px; max-width: 440px; width: 100%; padding: 32px; box-shadow: 0 20px 40px rgba(0,0,0,0.2);">
          <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 20px;">
            <h3 class="font-display" style="font-size: 20px; font-weight: 800; color: var(--color-neutral-900);">Update Monthly Subscription</h3>
            <button id="closeEditPriceModalBtn" style="background: none; border: none; font-size: 20px; cursor: pointer; color: var(--color-neutral-500);">&times;</button>
          </div>

          <form id="editPriceForm" style="display: flex; flex-direction: column; gap: 16px;">
            <div>
              <label style="font-size: 13px; font-weight: 700; color: var(--color-neutral-800); display: block; margin-bottom: 6px;">Monthly Price (₹) *</label>
              <input type="number" id="mPriceInput" class="btn-outline-action" style="width: 100%; background: #fff; padding: 12px 16px; font-size: 15px;" value="${monthlyPriceNum}" placeholder="e.g. 2999" min="1" required />
              <span style="font-size: 11px; color: var(--color-neutral-500); margin-top: 4px; display: block;">Day, Week, and 15-Day prices will be automatically calculated.</span>
            </div>

            <div style="display: flex; justify-content: flex-end; gap: 12px; margin-top: 12px;">
              <button type="button" id="cancelEditPriceBtn" class="btn-outline-action" style="padding: 10px 18px; font-size: 14px;">Cancel</button>
              <button type="submit" class="btn-primary-action" style="padding: 10px 20px; font-size: 14px;">Save Changes</button>
            </div>
          </form>
        </div>
      </div>

      <footer class="footer">
        © ${new Date().getFullYear()} PrimePlate. Premium Meal Subscription Platform.
      </footer>
    `;

    attachNavbarEvents();

    // STATE 1 Form Listener: Centered Inline Registration
    const centerForm = document.getElementById('centerHostelForm') as HTMLFormElement;
    if (centerForm) {
      centerForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        const name = (centerForm.querySelector('#cName') as HTMLInputElement).value;
        const city = (centerForm.querySelector('#cCity') as HTMLInputElement).value;
        const area = (centerForm.querySelector('#cArea') as HTMLInputElement).value;
        const address = (centerForm.querySelector('#cAddress') as HTMLInputElement).value;
        const price = parseFloat((centerForm.querySelector('#cPrice') as HTMLInputElement).value) || 0;
        const capacity = parseInt((centerForm.querySelector('#cCapacity') as HTMLInputElement).value) || 0;
        const phone = (centerForm.querySelector('#cPhone') as HTMLInputElement).value;
        const category = (centerForm.querySelector('#cCategory') as HTMLSelectElement).value;

        try {
          await api.post('/providers', {
            name,
            city,
            address: `${address}, ${area}`,
            monthlyPrice: price,
            totalCapacity: capacity,
            contactPhone: phone,
            category,
            description: '',
          });
          showToast('Registration submitted! Pending Admin approval.', 'success');
          renderOwnerPortal();
        } catch (err: any) {
          showToast(err.message || 'Failed to submit registration', 'error');
        }
      });
    }

    // STATE 2 Listeners: Pending Approval Refresh
    document.getElementById('refreshStatusBtn')?.addEventListener('click', async () => {
      showToast('Checking latest approval status...', 'info');
      await renderOwnerPortal();
    });

    // STATE 3 Listeners: Approved Owner Workspace
    document.getElementById('openHostelModalBtn')?.addEventListener('click', () => {
      showModal = true;
      render();
    });

    document.querySelectorAll('.quick-nav-btn').forEach((btn) => {
      btn.addEventListener('click', (e) => {
        const targetId = (e.currentTarget as HTMLElement).getAttribute('data-target');
        if (targetId) {
          document.getElementById(targetId)?.scrollIntoView({ behavior: 'smooth' });
        }
      });
    });

    document.querySelectorAll('.open-edit-price-btn').forEach((btn) => {
      btn.addEventListener('click', () => {
        showEditPriceModal = true;
        render();
      });
    });

    document.getElementById('openEditPriceModalBtn')?.addEventListener('click', () => {
      showEditPriceModal = true;
      render();
    });

    document.getElementById('closeEditPriceModalBtn')?.addEventListener('click', () => {
      showEditPriceModal = false;
      render();
    });

    document.getElementById('cancelEditPriceBtn')?.addEventListener('click', () => {
      showEditPriceModal = false;
      render();
    });

    const editPriceForm = document.getElementById('editPriceForm') as HTMLFormElement;
    if (editPriceForm) {
      editPriceForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        if (!selectedHostel) return;

        const rawInput = (editPriceForm.querySelector('#mPriceInput') as HTMLInputElement).value;
        const priceVal = parseFloat(rawInput);

        if (isNaN(priceVal) || !isFinite(priceVal) || priceVal <= 0) {
          showToast('Monthly subscription price must be a valid number greater than 0', 'error');
          return;
        }

        try {
          await api.put(`/providers/${selectedHostel.id}`, { monthlyPrice: priceVal });
          selectedHostel.monthlyPrice = priceVal;
          showToast('Subscription price updated successfully!', 'success');
          showEditPriceModal = false;
          render();
        } catch (err: any) {
          showToast(err.message || 'Failed to update subscription price', 'error');
        }
      });
    }

    document.getElementById('manageWeeklyMenuBtn')?.addEventListener('click', () => {
      document.getElementById('weeklyMenuEditorSection')?.scrollIntoView({ behavior: 'smooth' });
    });

    document.querySelectorAll('.start-edit-menu-btn').forEach((btn) => {
      btn.addEventListener('click', (e) => {
        const dayIdx = Number((e.currentTarget as HTMLElement).getAttribute('data-day-idx'));
        const mealType = (e.currentTarget as HTMLElement).getAttribute('data-meal') || 'Breakfast';
        const currentVal = getMenuItem(dayIdx, mealType);
        editingMenu = { dayIdx, mealType };
        editingMenuValue = currentVal === 'No menu available' ? '' : currentVal;
        render();
      });
    });

    const inlineMenuInput = document.getElementById('inlineMenuInput') as HTMLInputElement;
    const saveInlineMenuBtn = document.getElementById('saveInlineMenuBtn');
    const cancelInlineMenuBtn = document.getElementById('cancelInlineMenuBtn');

    if (cancelInlineMenuBtn) {
      cancelInlineMenuBtn.addEventListener('click', () => {
        editingMenu = null;
        editingMenuValue = '';
        render();
      });
    }

    const saveInlineMenu = async () => {
      if (!selectedHostel || !editingMenu) return;
      const newVal = (document.getElementById('inlineMenuInput') as HTMLInputElement)?.value.trim() ?? '';
      try {
        await api.post('/weekly-menus', {
          providerId: selectedHostel.id,
          items: [
            {
              dayOfWeek: editingMenu.dayIdx,
              mealType: editingMenu.mealType,
              menuItems: newVal || 'No menu available',
            },
          ],
        });
        showToast('Menu updated successfully!', 'success');
        editingMenu = null;
        editingMenuValue = '';
        await fetchWeeklyMenus();
        render();
      } catch (err: any) {
        showToast(err.message || 'Failed to update menu item', 'error');
      }
    };

    saveInlineMenuBtn?.addEventListener('click', saveInlineMenu);
    inlineMenuInput?.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') {
        e.preventDefault();
        saveInlineMenu();
      } else if (e.key === 'Escape') {
        editingMenu = null;
        editingMenuValue = '';
        render();
      }
    });

    document.getElementById('closeModalBtn')?.addEventListener('click', () => {
      showModal = false;
      render();
    });

    const subSearchInput = document.getElementById('subscriberSearchInput') as HTMLInputElement;
    if (subSearchInput) {
      subSearchInput.addEventListener('input', (e) => {
        subscriberSearchQuery = (e.target as HTMLInputElement).value;
        render();
        const refreshedInput = document.getElementById('subscriberSearchInput') as HTMLInputElement;
        if (refreshedInput) {
          refreshedInput.focus();
          refreshedInput.setSelectionRange(subscriberSearchQuery.length, subscriberSearchQuery.length);
        }
      });
    }

    document.getElementById('retrySubscribersBtn')?.addEventListener('click', async () => {
      await fetchLiveSubs();
      render();
    });

    document.querySelectorAll('.hostel-tab-btn').forEach((btn) => {
      btn.addEventListener('click', async (e) => {
        const id = (e.currentTarget as HTMLElement).getAttribute('data-id');
        selectedHostel = hostels.find((h) => h.id === id) || selectedHostel;
        await fetchLiveSubs();
        await fetchWeeklyMenus();
        render();
      });
    });

    document.getElementById('toggleOpenBtn')?.addEventListener('click', async () => {
      if (!selectedHostel) return;
      const newStatus = selectedHostel.acceptingSubscriptions === false;
      try {
        await api.put(`/providers/${selectedHostel.id}`, { acceptingSubscriptions: newStatus });
        selectedHostel.acceptingSubscriptions = newStatus;
        showToast(`Kitchen status set to ${newStatus ? 'OPEN' : 'CLOSED'}`, 'info');
        render();
      } catch (err: any) {
        showToast(err.message || 'Failed to update status', 'error');
      }
    });

    document.getElementById('editCapacityBtn')?.addEventListener('click', async () => {
      if (!selectedHostel) return;
      const currentCapStr = selectedHostel.totalCapacity !== undefined && selectedHostel.totalCapacity !== null ? String(selectedHostel.totalCapacity) : '';
      const input = prompt('Enter new total student capacity:', currentCapStr);
      if (!input) return;
      const newCap = parseInt(input);
      if (isNaN(newCap) || newCap <= 0) {
        showToast('Invalid capacity number', 'error');
        return;
      }
      try {
        await api.put(`/providers/${selectedHostel.id}`, { totalCapacity: newCap });
        selectedHostel.totalCapacity = newCap;
        showToast(`Capacity updated to ${newCap} students`, 'success');
        render();
      } catch (err: any) {
        showToast(err.message || 'Failed to update capacity', 'error');
      }
    });

    const addHostelForm = document.getElementById('addHostelForm') as HTMLFormElement;
    if (addHostelForm) {
      addHostelForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        const name = (addHostelForm.querySelector('#hName') as HTMLInputElement).value;
        const city = (addHostelForm.querySelector('#hCity') as HTMLInputElement).value;
        const area = (addHostelForm.querySelector('#hArea') as HTMLInputElement).value;
        const address = (addHostelForm.querySelector('#hAddress') as HTMLInputElement).value;
        const price = parseFloat((addHostelForm.querySelector('#hPrice') as HTMLInputElement).value) || 0;
        const capacity = parseInt((addHostelForm.querySelector('#hCapacity') as HTMLInputElement).value) || 0;
        const phone = (addHostelForm.querySelector('#hPhone') as HTMLInputElement).value;

        try {
          await api.post('/providers', {
            name,
            city,
            address: `${address}, ${area}`,
            monthlyPrice: price,
            totalCapacity: capacity,
            contactPhone: phone,
          });
          showToast('New hostel listing submitted for Admin approval.', 'success');
          showModal = false;
          await fetchHostels();
          render();
        } catch (err: any) {
          showToast(err.message || 'Failed to add hostel', 'error');
        }
      });
    }
  };

  render();
}
