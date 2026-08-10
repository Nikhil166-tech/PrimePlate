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
  const fetchLiveSubs = async () => {
    if (!selectedHostel || selectedHostel.approvalStatus !== 'APPROVED') {
      liveSubs = [];
      return;
    }
    try {
      const data: any = await api.get(`/subscriptions/provider/${selectedHostel.id}`);
      liveSubs = Array.isArray(data) ? data : [];
    } catch (_) {
      liveSubs = [];
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
    const netEarnings = Math.round(totalRevenue * 0.9);

    const subscriberRows =
      liveSubs.length > 0
        ? liveSubs
            .map(
              (s) => `
          <tr style="border-bottom: 1px solid var(--color-neutral-100);">
            <td style="padding: 10px;">
              <strong style="display: block; color: var(--color-neutral-900);">${escapeHtml(s.student?.name || s.student?.email || 'Subscriber')}</strong>
              <span style="font-size: 11px; color: var(--color-neutral-500);">${escapeHtml(s.student?.phone || 'Not available')}</span>
            </td>
            <td style="padding: 10px; font-weight: 600;">${escapeHtml(s.mealPlan?.title || s.planType || 'Subscription Plan')}</td>
            <td style="padding: 10px;">${escapeHtml(s.endDate || 'Not available')}</td>
            <td style="padding: 10px;">
              <span style="background: var(--color-success-50); color: var(--color-success-600); font-size: 11px; font-weight: 700; padding: 2px 8px; border-radius: 999px;">
                ${escapeHtml(s.status ? String(s.status).toUpperCase() : 'UNKNOWN')}
              </span>
            </td>
          </tr>
        `,
            )
            .join('')
        : `
          <tr>
            <td colspan="4" style="text-align: center; padding: 32px; color: var(--color-neutral-500);">
              No active subscribers yet for this hostel listing.
            </td>
          </tr>
        `;

    const getMenuItem = (dayIdx: number, type: string) => {
      const found = weeklyMenus.find((m: any) => Number(m.dayOfWeek) === dayIdx && m.mealType === type);
      return found && found.menuItems ? found.menuItems : 'No menu available';
    };

    const isNewProvider = hostels.length === 0;
    const isPending = selectedHostel && selectedHostel.approvalStatus === 'PENDING';

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
            </div>

            ${
              !isNewProvider && !isPending
                ? `<button id="openHostelModalBtn" class="btn-primary-action" style="padding: 10px 20px; font-size: 14px;">
                    <i class="fa-solid fa-plus"></i> Add Another Hostel
                  </button>`
                : ''
            }
          </div>

          ${
            isNewProvider
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

                <div>
                  <label style="font-size: 13px; font-weight: 700; color: var(--color-neutral-800); display: block; margin-bottom: 6px;">Mess Description</label>
                  <textarea id="cDesc" class="btn-outline-action" style="width: 100%; background: #fff; padding: 12px 16px; font-size: 14px; height: 80px; resize: vertical;" placeholder="Describe meal menu, hygiene standards, daily timings..."></textarea>
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
            ${
              hostels.length > 1
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

            <!-- 4-Metrics Stats Row -->
            <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(220px, 1fr)); gap: 20px; margin-bottom: 28px;">
              <div style="background: #fff; border: 1px solid var(--color-neutral-200); border-radius: 20px; padding: 20px; box-shadow: 0 4px 12px rgba(0,0,0,0.03);">
                <div style="display: flex; align-items: center; gap: 10px; color: var(--color-neutral-500); margin-bottom: 8px;">
                  <i class="fa-solid fa-users" style="color: var(--color-primary-600); font-size: 18px;"></i>
                  <span style="font-size: 13px; font-weight: 600;">Active Subscribers</span>
                </div>
                <p class="font-display" style="font-size: 28px; font-weight: 800; color: var(--color-neutral-900);">${totalSubscribersCount}</p>
              </div>

              <div style="background: #fff; border: 1px solid var(--color-neutral-200); border-radius: 20px; padding: 20px; box-shadow: 0 4px 12px rgba(0,0,0,0.03);">
                <div style="display: flex; align-items: center; gap: 10px; color: var(--color-neutral-500); margin-bottom: 8px;">
                  <i class="fa-solid fa-chart-line" style="color: #0ea5e9; font-size: 18px;"></i>
                  <span style="font-size: 13px; font-weight: 600;">Total Revenue</span>
                </div>
                <p class="font-display" style="font-size: 28px; font-weight: 800; color: var(--color-neutral-900);">₹${totalRevenue.toLocaleString('en-IN')}</p>
              </div>

              <div style="background: #fff; border: 1px solid var(--color-neutral-200); border-radius: 20px; padding: 20px; box-shadow: 0 4px 12px rgba(0,0,0,0.03);">
                <div style="display: flex; align-items: center; gap: 10px; color: var(--color-neutral-500); margin-bottom: 8px;">
                  <i class="fa-solid fa-wallet" style="color: #22c55e; font-size: 18px;"></i>
                  <span style="font-size: 13px; font-weight: 600;">Your Earnings</span>
                </div>
                <p class="font-display" style="font-size: 28px; font-weight: 800; color: var(--color-neutral-900);">₹${netEarnings.toLocaleString('en-IN')}</p>
              </div>

              <div style="background: #fff; border: 1px solid var(--color-neutral-200); border-radius: 20px; padding: 20px; box-shadow: 0 4px 12px rgba(0,0,0,0.03);">
                <div style="display: flex; align-items: center; gap: 10px; color: var(--color-neutral-500); margin-bottom: 8px;">
                  <i class="fa-solid fa-star" style="color: var(--color-accent-500); font-size: 18px;"></i>
                  <span style="font-size: 13px; font-weight: 600;">Rating</span>
                </div>
                <p class="font-display" style="font-size: 28px; font-weight: 800; color: var(--color-neutral-900);">${(selectedHostel.rating ?? 0) > 0 ? Number(selectedHostel.rating).toFixed(1) : 'New'}</p>
              </div>
            </div>

            <!-- Hostel Info Header Card -->
            <div style="background: #fff; border: 1px solid var(--color-neutral-200); border-radius: 20px; padding: 24px; margin-bottom: 32px; display: flex; gap: 20px; align-items: center; flex-wrap: wrap;">
              <img src="${getSafeImageUrl(selectedHostel.imageUrl)}" alt="${escapeHtml(selectedHostel.name)}" style="width: 100px; height: 100px; border-radius: 16px; object-fit: cover;" />
              
              <div style="flex: 1; min-width: 240px;">
                <div style="display: flex; justify-content: space-between; align-items: flex-start; flex-wrap: wrap; gap: 8px;">
                  <div>
                    <h2 class="font-display" style="font-size: 22px; font-weight: 800; color: var(--color-neutral-900); margin-bottom: 4px;">${escapeHtml(selectedHostel.name)}</h2>
                    <p style="font-size: 14px; color: var(--color-neutral-500); margin-bottom: 4px;">
                      <i class="fa-solid fa-location-dot"></i> ${escapeHtml(selectedHostel.address || selectedHostel.city || '')}
                    </p>
                  </div>
                  <div style="display: flex; gap: 8px;">
                    <button id="toggleOpenBtn" class="btn-outline-action" style="font-size: 12px; padding: 6px 12px; background: ${selectedHostel.acceptingSubscriptions !== false ? '#d1fae5' : '#fee2e2'}; color: ${selectedHostel.acceptingSubscriptions !== false ? '#059669' : '#dc2626'}; border: none; font-weight: 700;">
                      <i class="fa-solid ${selectedHostel.acceptingSubscriptions !== false ? 'fa-door-open' : 'fa-door-closed'}"></i> ${selectedHostel.acceptingSubscriptions !== false ? 'Status: OPEN' : 'Status: CLOSED'}
                    </button>
                    <button id="editCapacityBtn" class="btn-outline-action" style="font-size: 12px; padding: 6px 12px;">
                      <i class="fa-solid fa-users-gear"></i> Set Capacity (${selectedHostel.totalCapacity ?? 'Not set'})
                    </button>
                  </div>
                </div>

                <div style="display: flex; gap: 8px; flex-wrap: wrap; margin-top: 12px;">
                  <span style="background: var(--color-primary-50); color: var(--color-primary-700); font-size: 12px; font-weight: 700; padding: 4px 10px; border-radius: 6px;">
                    ${escapeHtml(selectedHostel.category || 'Veg & Non-Veg')}
                  </span>
                  <span style="background: var(--color-neutral-100); color: var(--color-neutral-700); font-size: 12px; font-weight: 600; padding: 4px 10px; border-radius: 6px;">
                    Booked: ${totalSubscribersCount} / Total: ${selectedHostel.totalCapacity ?? 'Unspecified'}
                  </span>
                  <span style="background: ${Math.max(0, (selectedHostel.totalCapacity || 0) - totalSubscribersCount) > 0 ? '#d1fae5' : '#fee2e2'}; color: ${Math.max(0, (selectedHostel.totalCapacity || 0) - totalSubscribersCount) > 0 ? '#059669' : '#dc2626'}; font-size: 12px; font-weight: 700; padding: 4px 10px; border-radius: 6px;">
                    Available: ${Math.max(0, (selectedHostel.totalCapacity || 0) - totalSubscribersCount)}
                  </span>
                </div>
              </div>
            </div>

            <!-- 2-Column Workspace Grid -->
            <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(360px, 1fr)); gap: 28px;">
              
              <!-- Column 1: Weekly Menu Editor -->
              <div style="background: #fff; border: 1px solid var(--color-neutral-200); border-radius: 24px; padding: 28px; box-shadow: 0 4px 12px rgba(0,0,0,0.03);">
                <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 20px;">
                  <h3 class="font-display" style="font-size: 20px; font-weight: 700; color: var(--color-neutral-900);">
                    <i class="fa-solid fa-utensils" style="color: var(--color-primary-600);"></i> Weekly Menu Editor
                  </h3>
                </div>

                <div style="display: flex; flex-direction: column; gap: 16px; max-height: 520px; overflow-y: auto; padding-right: 4px;">
                  ${DAYS_OF_WEEK.map(
                    (day, dayIdx) => `
                    <div style="border-bottom: 1px solid var(--color-neutral-100); padding-bottom: 12px;">
                      <strong style="font-size: 14px; color: var(--color-neutral-900); display: block; margin-bottom: 8px;">${day}</strong>
                      <div style="display: grid; grid-template-columns: 1fr 1fr 1fr; gap: 8px;">
                        <button class="edit-menu-btn btn-outline-action" data-day-idx="${dayIdx}" data-day="${day}" data-meal="Breakfast" style="font-size: 12px; padding: 8px; text-align: left; background: var(--color-neutral-50);">
                          <span style="color: #d97706; font-weight: 700; display: block;">Breakfast</span>
                          <span style="color: var(--color-neutral-600); display: block; white-space: nowrap; overflow: hidden; text-overflow: ellipsis;">${escapeHtml(getMenuItem(dayIdx, 'Breakfast'))}</span>
                        </button>
                        <button class="edit-menu-btn btn-outline-action" data-day-idx="${dayIdx}" data-day="${day}" data-meal="Lunch" style="font-size: 12px; padding: 8px; text-align: left; background: var(--color-neutral-50);">
                          <span style="color: var(--color-primary-600); font-weight: 700; display: block;">Lunch</span>
                          <span style="color: var(--color-neutral-600); display: block; white-space: nowrap; overflow: hidden; text-overflow: ellipsis;">${escapeHtml(getMenuItem(dayIdx, 'Lunch'))}</span>
                        </button>
                        <button class="edit-menu-btn btn-outline-action" data-day-idx="${dayIdx}" data-day="${day}" data-meal="Dinner" style="font-size: 12px; padding: 8px; text-align: left; background: var(--color-neutral-50);">
                          <span style="color: #8b5cf6; font-weight: 700; display: block;">Dinner</span>
                          <span style="color: var(--color-neutral-600); display: block; white-space: nowrap; overflow: hidden; text-overflow: ellipsis;">${escapeHtml(getMenuItem(dayIdx, 'Dinner'))}</span>
                        </button>
                      </div>
                    </div>
                  `,
                  ).join('')}
                </div>
              </div>

              <!-- Column 2: Live Active Subscribers List Table -->
              <div style="background: #fff; border: 1px solid var(--color-neutral-200); border-radius: 24px; padding: 28px; box-shadow: 0 4px 12px rgba(0,0,0,0.03);">
                <h3 class="font-display" style="font-size: 20px; font-weight: 700; color: var(--color-neutral-900); margin-bottom: 20px;">
                  <i class="fa-solid fa-users-gear" style="color: var(--color-primary-600);"></i> Live Active Subscribers List
                </h3>

                <div style="overflow-x: auto;">
                  <table style="width: 100%; border-collapse: collapse; font-size: 13px;">
                    <thead>
                      <tr style="border-bottom: 2px solid var(--color-neutral-200); text-align: left; color: var(--color-neutral-500);">
                        <th style="padding: 10px;">Student</th>
                        <th style="padding: 10px;">Plan</th>
                        <th style="padding: 10px;">End Date</th>
                        <th style="padding: 10px;">Status</th>
                      </tr>
                    </thead>
                    <tbody>
                      ${subscriberRows}
                    </tbody>
                  </table>
                </div>
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
        const description = (centerForm.querySelector('#cDesc') as HTMLTextAreaElement).value;

        try {
          await api.post('/providers', {
            name,
            city,
            address: `${address}, ${area}`,
            monthlyPrice: price,
            totalCapacity: capacity,
            contactPhone: phone,
            category,
            description,
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

    document.getElementById('closeModalBtn')?.addEventListener('click', () => {
      showModal = false;
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
