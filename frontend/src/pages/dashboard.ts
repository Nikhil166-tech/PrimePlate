import api, {
  getMyMealHistory,
  getMyRecoveryBalance,
} from '../api';
import { openMealScanner } from '../components/meal-scanner';
import { navigate } from '../router';
import { showToast } from '../components/toast';
import { renderNavbar, attachNavbarEvents } from '../components/navbar';
import { renderFooter, attachFooterEvents } from '../components/footer';
import { escapeHtml } from '../utils/sanitize';
import { mountMealCalendar } from '../components/MealCalendar';

interface SubscriptionRecord {
  id?: string;
  amountPaid?: number | string | null;
  payment?: { amount?: number | string | null };
  razorpayOrderId?: string | null;
  razorpayPaymentId?: string | null;
  paymentStatus?: string | null;
  paymentDate?: string | null;
  student?: { id?: string; name?: string; email?: string; phone?: string };
  mealPlan?: {
    id?: string;
    title?: string;
    durationDays?: number;
    pricePerMonth?: number | string | null;
    provider?: {
      id?: string;
      name?: string;
      city?: string;
      address?: string;
      contactPhone?: string;
    };
  };
  provider?: {
    id?: string;
    name?: string;
    city?: string;
    address?: string;
    contactPhone?: string;
  };
  status?: string;
  startDate?: string;
  endDate?: string;
  recoveryDaysApplied?: number;
  createdAt?: string;
}

export async function renderDashboard() {
  const container = document.getElementById('app')!;
  const token = localStorage.getItem('accessToken');
  const userEmail = localStorage.getItem('userEmail') || 'PrimeMate';
  const userName = localStorage.getItem('userName') || userEmail.split('@')[0];
  const userPhone = localStorage.getItem('userPhone') || 'Not available';

  if (!token) {
    navigate('/login');
    return;
  }

  let activeTab: 'PASSES' | 'HISTORY' | 'MEAL_HISTORY' = 'PASSES';
  let loadedSubs: any[] = [];
  let loadedMealHistory: any[] = [];
  let loadedRecoveryBalances: any[] = [];
  let calendarUnmountFns: (() => void)[] = [];
  let selectedSubForDetails: any = null;
  const todayStr = new Date().toISOString().split('T')[0];

  const renderPage = () => {
    container.innerHTML = `
      ${renderNavbar()}
      <main class="main-content" style="padding-top: 88px; padding-bottom: 60px; background: #f8fafc;">
        <div style="max-width: 1280px; margin: 0 auto; padding: 0 16px;">
          
          <!-- Header -->
          <div style="display: flex; justify-content: space-between; align-items: flex-end; margin-bottom: 24px; flex-wrap: wrap; gap: 16px;">
            <div>
              <h1 class="font-display" style="font-size: clamp(1.75rem, 4vw, 2.25rem); font-weight: 800; color: var(--color-neutral-900); margin-bottom: 4px;">PrimeMate Dashboard</h1>
              <p style="color: var(--color-neutral-600); font-size: clamp(0.875rem, 2vw, 0.95rem);">Welcome back, <strong>${escapeHtml(userName)}</strong> 👋 • Phone: <strong>${escapeHtml(userPhone)}</strong> (${escapeHtml(userEmail)})</p>
            </div>
            <div style="display: flex; gap: 10px; flex-wrap: wrap;">
              <button id="dashScanQrBtn" class="btn-primary-action" style="padding: 10px 20px; background: linear-gradient(135deg, var(--color-primary-600), var(--color-primary-700)); font-weight: 700; box-shadow: 0 4px 14px rgba(234, 88, 12, 0.25);">
                <i class="fa-solid fa-camera"></i> Scan Meal QR
              </button>
              <button id="dashNewSubBtn" class="btn-outline-action" style="padding: 10px 20px; background: #fff;">
                <i class="fa-solid fa-plus"></i> New Subscription
              </button>
            </div>
          </div>

          <!-- Tab Navigation Bar -->
          <div style="display: flex; gap: 12px; margin-bottom: 24px; border-bottom: 2px solid var(--color-neutral-200); padding-bottom: 12px; overflow-x: auto;">
            <button id="tabActivePasses" class="btn-outline-action" style="font-weight: 700; padding: 10px 20px; border-radius: 12px; background: ${activeTab === 'PASSES' ? 'var(--color-primary-600)' : '#fff'}; color: ${activeTab === 'PASSES' ? '#fff' : 'var(--color-neutral-700)'}; border-color: ${activeTab === 'PASSES' ? 'var(--color-primary-600)' : 'var(--color-neutral-300)'};">
              <i class="fa-solid fa-qrcode"></i> My Active Passes
            </button>
            <button id="tabMealChecklist" class="btn-outline-action" style="font-weight: 700; padding: 10px 20px; border-radius: 12px; background: ${activeTab === 'MEAL_HISTORY' ? 'var(--color-primary-600)' : '#fff'}; color: ${activeTab === 'MEAL_HISTORY' ? '#fff' : 'var(--color-neutral-700)'}; border-color: ${activeTab === 'MEAL_HISTORY' ? 'var(--color-primary-600)' : 'var(--color-neutral-300)'};">
              <i class="fa-solid fa-calendar-check"></i> My Meal History
            </button>
            <button id="tabSubHistory" class="btn-outline-action" style="font-weight: 700; padding: 10px 20px; border-radius: 12px; background: ${activeTab === 'HISTORY' ? 'var(--color-primary-600)' : '#fff'}; color: ${activeTab === 'HISTORY' ? '#fff' : 'var(--color-neutral-700)'}; border-color: ${activeTab === 'HISTORY' ? 'var(--color-primary-600)' : 'var(--color-neutral-300)'};">
              <i class="fa-solid fa-clock-rotate-left"></i> Subscription History
            </button>
          </div>

          <!-- 4-Metrics Overview Grid -->
          <div class="dashboard-metrics-grid" style="grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); margin-bottom: 24px;">
            <div class="dashboard-metric-card active-pass">
              <div class="dashboard-metric-header">
                <div class="dashboard-metric-icon">
                  <i class="fa-solid fa-id-card"></i>
                </div>
                <span class="dashboard-metric-label">Active Cards</span>
              </div>
              <p id="activeCardsCount" class="dashboard-metric-value">0</p>
            </div>



            <div class="dashboard-metric-card total-spent">
              <div class="dashboard-metric-header">
                <div class="dashboard-metric-icon">
                  <i class="fa-solid fa-indian-rupee-sign"></i>
                </div>
                <span class="dashboard-metric-label">Total Spent</span>
              </div>
              <p id="totalSpentAmount" class="dashboard-metric-value">--</p>
            </div>

            <div class="dashboard-metric-card total-subs">
              <div class="dashboard-metric-header">
                <div class="dashboard-metric-icon">
                  <i class="fa-solid fa-utensils"></i>
                </div>
                <span class="dashboard-metric-label">Total Subscriptions</span>
              </div>
              <p id="totalSubsCount" class="dashboard-metric-value">0</p>
            </div>
          </div>

          <!-- Main Grid Display -->
          <div id="subsGrid" style="display: grid; grid-template-columns: repeat(auto-fit, minmax(320px, 1fr)); gap: 20px;">
            <div style="grid-column: 1/-1; text-align: center; padding: 48px;">
              <i class="fa-solid fa-spinner fa-spin" style="font-size: 28px; color: var(--color-primary-600);"></i>
              <p style="margin-top: 12px; color: var(--color-neutral-600);">Loading subscription data...</p>
            </div>
          </div>
        </div>
      </main>

      <!-- View Details Modal -->
      <div id="subDetailsModal" style="display: ${selectedSubForDetails ? 'flex' : 'none'}; position: fixed; inset: 0; background: rgba(0,0,0,0.5); align-items: center; justify-content: center; z-index: 1000; padding: 20px;">
        ${selectedSubForDetails ? `
          <div style="background: #fff; border-radius: 24px; max-width: 480px; width: 100%; padding: 28px; box-shadow: 0 20px 40px rgba(0,0,0,0.2); max-height: 90vh; overflow-y: auto;">
            <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 20px; border-bottom: 1px solid var(--color-neutral-200); padding-bottom: 12px;">
              <h3 class="font-display" style="font-size: 20px; font-weight: 800; color: var(--color-neutral-900); margin: 0;">Subscription Details</h3>
              <button id="closeDetailsModalBtn" style="background: none; border: none; font-size: 24px; cursor: pointer; color: var(--color-neutral-500);">&times;</button>
            </div>

            <div style="display: flex; flex-direction: column; gap: 14px; font-size: 14px;">
              <div>
                <span style="font-size: 12px; color: var(--color-neutral-500); text-transform: uppercase; font-weight: 700; display: block; margin-bottom: 2px;">PG / Hostel / Mess</span>
                <strong style="font-size: 16px; color: var(--color-neutral-900); display: block;">${escapeHtml(selectedSubForDetails.messName)}</strong>
                <span style="font-size: 13px; color: var(--color-neutral-600);"><i class="fa-solid fa-location-dot"></i> ${escapeHtml(selectedSubForDetails.area)}${selectedSubForDetails.city ? ', ' + escapeHtml(selectedSubForDetails.city) : ''}</span>
              </div>

              <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 12px; background: var(--color-neutral-50); padding: 14px; border-radius: 12px;">
                <div>
                  <span style="font-size: 12px; color: var(--color-neutral-500); font-weight: 600; display: block;">Plan</span>
                  <strong style="color: var(--color-neutral-900);">${escapeHtml(selectedSubForDetails.planType)}</strong>
                </div>
                <div>
                  <span style="font-size: 12px; color: var(--color-neutral-500); font-weight: 600; display: block;">Amount Paid</span>
                  <strong style="color: var(--color-primary-600); font-size: 16px;">${escapeHtml(selectedSubForDetails.amountPaidDisplay)}</strong>
                </div>
              </div>

              <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 12px;">
                <div>
                  <span style="font-size: 12px; color: var(--color-neutral-500); font-weight: 600; display: block;">Payment Status</span>
                  <span style="font-size: 12px; font-weight: 700; padding: 3px 8px; border-radius: 6px; background: ${selectedSubForDetails.paymentStatus === 'PAID' ? 'var(--color-success-50)' : '#fee2e2'}; color: ${selectedSubForDetails.paymentStatus === 'PAID' ? 'var(--color-success-600)' : '#dc2626'}; inline-block;">
                    ${escapeHtml(selectedSubForDetails.paymentStatus)}
                  </span>
                </div>
                <div>
                  <span style="font-size: 12px; color: var(--color-neutral-500); font-weight: 600; display: block;">Subscription Status</span>
                  <span style="font-size: 12px; font-weight: 700; padding: 3px 8px; border-radius: 6px; background: ${selectedSubForDetails.status === 'ACTIVE' ? 'var(--color-success-50)' : 'var(--color-neutral-100)'}; color: ${selectedSubForDetails.status === 'ACTIVE' ? 'var(--color-success-600)' : 'var(--color-neutral-600)'}; inline-block;">
                    ${escapeHtml(selectedSubForDetails.status)}
                  </span>
                </div>
              </div>

              <div style="border-top: 1px solid var(--color-neutral-200); padding-top: 12px; display: flex; flex-direction: column; gap: 8px;">
                <div style="display: flex; justify-content: space-between;">
                  <span style="color: var(--color-neutral-500);">Payment Date:</span>
                  <span style="font-weight: 600; color: var(--color-neutral-800);">${escapeHtml(selectedSubForDetails.paymentDateFormatted)}</span>
                </div>
                <div style="display: flex; justify-content: space-between;">
                  <span style="color: var(--color-neutral-500);">Start Date:</span>
                  <span style="font-weight: 600; color: var(--color-neutral-800);">${escapeHtml(selectedSubForDetails.startDate)}</span>
                </div>
                <div style="display: flex; justify-content: space-between;">
                  <span style="color: var(--color-neutral-500);">End Date:</span>
                  <span style="font-weight: 600; color: var(--color-neutral-800);">${escapeHtml(selectedSubForDetails.endDate)}</span>
                </div>
                <div style="display: flex; justify-content: space-between;">
                  <span style="color: var(--color-neutral-500);">Payment Reference:</span>
                  <span style="font-family: monospace; font-size: 12px; color: var(--color-neutral-700);">${escapeHtml(selectedSubForDetails.safeRef)}</span>
                </div>
              </div>

              <button id="closeDetailsModalBtn2" class="btn-primary-action" style="width: 100%; margin-top: 12px; padding: 12px; justify-content: center;">
                Close Details
              </button>
            </div>
          </div>
        ` : ''}
      </div>

      </div>

      ${renderFooter()}
    `;

    attachNavbarEvents();
    attachFooterEvents();

    document.getElementById('dashNewSubBtn')?.addEventListener('click', () => navigate('/providers'));

    document.getElementById('dashScanQrBtn')?.addEventListener('click', () => {
      openMealScanner(async () => {
        await fetchSubs();
      });
    });

    document.getElementById('tabActivePasses')?.addEventListener('click', () => {
      activeTab = 'PASSES';
      renderPage();
      updateContentDisplay();
    });

    document.getElementById('tabMealChecklist')?.addEventListener('click', () => {
      activeTab = 'MEAL_HISTORY';
      renderPage();
      updateContentDisplay();
    });

    document.getElementById('tabSubHistory')?.addEventListener('click', () => {
      activeTab = 'HISTORY';
      renderPage();
      updateContentDisplay();
    });

    const closeModal = () => {
      selectedSubForDetails = null;
      renderPage();
      updateContentDisplay();
    };

    document.getElementById('closeDetailsModalBtn')?.addEventListener('click', closeModal);
    document.getElementById('closeDetailsModalBtn2')?.addEventListener('click', closeModal);
  };

  const updateContentDisplay = () => {
    const subsGrid = document.getElementById('subsGrid');
    if (!subsGrid) return;

    // Cleanly unmount previously mounted React calendars to avoid leaks
    calendarUnmountFns.forEach((unmount) => {
      try {
        unmount();
      } catch (_) {}
    });
    calendarUnmountFns = [];

    const subs = loadedSubs;
    const activeSubs = subs.filter((s) => {
      const isStatusActive = (s.status || '').toUpperCase() === 'ACTIVE' && (s.paymentStatus || 'PAID').toUpperCase() === 'PAID';
      if (!isStatusActive) return false;
      if (s.daysLeft !== undefined && s.daysLeft <= 0) return false;
      if (s.endDate && s.endDate < todayStr) return false;
      return true;
    });
    const validPaidSubs = subs.filter((s) => s.parsedPaid !== null && s.paymentStatus === 'PAID');
    const totalSpent = validPaidSubs.reduce((sum, s) => sum + (s.parsedPaid ?? 0), 0);

    const activeCardsEl = document.getElementById('activeCardsCount');
    if (activeCardsEl) activeCardsEl.innerText = `${activeSubs.length}`;

    const totalSpentEl = document.getElementById('totalSpentAmount');
    if (totalSpentEl) {
      totalSpentEl.innerText = `₹${totalSpent.toLocaleString('en-IN')}`;
    }

    const totalSubsEl = document.getElementById('totalSubsCount');
    if (totalSubsEl) totalSubsEl.innerText = `${subs.length}`;

    const activeBalances = loadedRecoveryBalances.filter((b: any) => (b.remainingDays || 0) > 0);

    const renderActiveRecoveryBanners = () => {
      if (activeBalances.length === 0) return '';
      return `
        <div class="active-recoveries-container" style="grid-column: 1/-1; display: flex; flex-direction: column; gap: 14px; margin-bottom: 20px;">
          ${activeBalances.map((b: any) => `
            <div class="active-recovery-banner" style="background: linear-gradient(135deg, #f0fdf4, #ecfdf5); border: 1.5px solid #86efac; border-radius: 20px; padding: 20px; box-shadow: 0 4px 16px rgba(34, 197, 94, 0.08); display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: 16px;">
              <div style="display: flex; align-items: center; gap: 14px;">
                <div style="width: 48px; height: 48px; border-radius: 16px; background: #d1fae5; color: #047857; display: flex; align-items: center; justify-content: center; font-size: 24px; flex-shrink: 0;">
                  🎁
                </div>
                <div>
                  <div style="display: flex; align-items: center; gap: 8px; flex-wrap: wrap;">
                    <h3 class="font-display" style="font-size: 18px; font-weight: 800; color: #166534; margin: 0;">Meal Recovery</h3>
                    <span style="background: #15803d; color: #fff; font-size: 12px; font-weight: 800; padding: 2px 10px; border-radius: 999px;">
                      ${b.remainingDays} days available
                    </span>
                  </div>
                  <p style="font-size: 13px; color: #15803d; margin: 4px 0 0 0;">
                    You earned <strong>${b.remainingDays} recovery days</strong> from missed meals at <strong>${escapeHtml(b.providerName)}</strong>.
                  </p>
                </div>
              </div>
              <button class="use-recovery-plan-btn btn-primary-action" data-prov-id="${escapeHtml(b.providerId)}" style="padding: 10px 20px; font-size: 13px; font-weight: 700; background: #15803d; border-color: #15803d; cursor: pointer; white-space: nowrap;">
                Use on your next plan →
              </button>
            </div>
          `).join('')}
        </div>
      `;
    };

    if (activeTab === 'PASSES') {
      if (activeSubs.length === 0) {
        subsGrid.innerHTML = `
          ${renderActiveRecoveryBanners()}
          <div style="grid-column: 1/-1; background: #fff; border: 1px solid var(--color-neutral-200); border-radius: 24px; padding: 60px; text-align: center;">
            <div style="width: 72px; height: 72px; border-radius: 999px; background: var(--color-neutral-100); display: flex; align-items: center; justify-content: center; font-size: 32px; color: var(--color-neutral-400); margin: 0 auto 16px;">
              <i class="fa-solid fa-qrcode"></i>
            </div>
            <h3 class="font-display" style="font-size: 22px; font-weight: 700; margin-bottom: 8px;">No active mess cards yet</h3>
            <p style="color: var(--color-neutral-500); margin-bottom: 24px; max-width: 440px; margin-left: auto; margin-right: auto;">You haven't subscribed to any mess yet. Browse hostels and PGs near you and get your first digital mess card.</p>
            <button id="emptyBrowseBtn" class="btn-primary-action">
              <i class="fa-solid fa-utensils"></i> Browse Mess
            </button>
          </div>`;
        document.getElementById('emptyBrowseBtn')?.addEventListener('click', () => navigate('/providers'));
        subsGrid.querySelectorAll('.use-recovery-plan-btn').forEach((btn) => {
          btn.addEventListener('click', (e) => {
            const pId = (e.currentTarget as HTMLElement).getAttribute('data-prov-id');
            if (pId) navigate(`/providers/${pId}`);
          });
        });
        return;
      }

      subsGrid.innerHTML = renderActiveRecoveryBanners() + activeSubs
        .map((s) => {
          const recoveryBadgeHtml = s.recoveryDaysApplied > 0
            ? `
              <div style="background: linear-gradient(135deg, #f0fdf4, #ecfdf5); border: 1px solid #bbf7d0; border-radius: 12px; padding: 12px 14px; margin-bottom: 12px;">
                <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 4px;">
                  <span style="font-size: 11px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.5px; color: #166534;">
                    <i class="fa-solid fa-gift"></i> Meal Recovery Applied
                  </span>
                  <span style="font-size: 11px; font-weight: 800; color: #15803d; background: #dcfce7; padding: 2px 8px; border-radius: 999px;">
                    +${s.recoveryDaysApplied} Days
                  </span>
                </div>
                <div style="font-size: 13px; font-weight: 700; color: #15803d;">
                  ${s.durationDays}-day plan + ${s.recoveryDaysApplied} recovery days = ${s.durationDays + s.recoveryDaysApplied} meal days
                </div>
                <div style="display: flex; justify-content: space-between; font-size: 11px; color: #166534; margin-top: 6px; padding-top: 4px; border-top: 1px dashed #bbf7d0;">
                  <span>Recovery used: <strong>${s.recoveryDaysApplied} days</strong></span>
                  <span>Remaining: <strong>0 days</strong></span>
                </div>
              </div>
            `
            : `
              <div style="font-size: 11px; color: var(--color-neutral-600); background: var(--color-neutral-50); border: 1px dashed var(--color-neutral-200); border-radius: 10px; padding: 8px 12px; margin-bottom: 12px; display: flex; align-items: center; gap: 6px;">
                <i class="fa-solid fa-clock-rotate-left" style="color: var(--color-primary-600);"></i>
                <span><strong>Meal Recovery:</strong> Your eligible missed meal days will be calculated after your subscription period ends.</span>
              </div>
            `;

          return `
          <div style="background: #fff; border: 1px solid var(--color-neutral-200); border-radius: 24px; overflow: hidden; box-shadow: 0 4px 16px rgba(0,0,0,0.04);">
            <div style="background: linear-gradient(135deg, var(--color-primary-600), var(--color-primary-700)); padding: 24px; color: #fff;">
              <div style="display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 20px;">
                <div>
                  <p style="font-size: 11px; text-transform: uppercase; letter-spacing: 1px; opacity: 0.85;">MessCard</p>
                  <h3 class="font-display" style="font-size: 20px; font-weight: 800; color: #fff;">${escapeHtml(s.messName)}</h3>
                  <p style="font-size: 12px; opacity: 0.85; margin-top: 4px;">
                    <i class="fa-solid fa-location-dot"></i> ${escapeHtml(s.area)}${s.city ? ', ' + escapeHtml(s.city) : ''}
                  </p>
                </div>
                <div style="background: rgba(255,255,255,0.95); padding: 8px; border-radius: 12px; box-shadow: 0 4px 12px rgba(0,0,0,0.15);">
                  <i class="fa-solid fa-qrcode" style="font-size: 36px; color: var(--color-neutral-900);"></i>
                </div>
              </div>

              <div style="display: flex; flex-direction: column; gap: 6px; font-size: 13px;">
                <div style="display: flex; justify-content: space-between;">
                  <span style="opacity: 0.8;">Subscriber</span>
                  <span style="font-weight: 600;">${escapeHtml(s.subscriber_name)}</span>
                </div>
                <div style="display: flex; justify-content: space-between;">
                  <span style="opacity: 0.8;">Plan</span>
                  <span style="font-weight: 600;">${escapeHtml(s.planType)}</span>
                </div>
                <div style="display: flex; justify-content: space-between;">
                  <span style="opacity: 0.8;">Status</span>
                  <span style="font-weight: 700; color: #86efac;">${escapeHtml(s.status)}</span>
                </div>
              </div>
            </div>

            <div style="padding: 20px;">
              <div style="display: flex; justify-content: space-between; align-items: center; font-size: 13px; color: var(--color-neutral-600); margin-bottom: 8px;">
                <span>Amount Paid:</span>
                <span style="font-weight: 700; color: var(--color-neutral-900);">${escapeHtml(s.amountPaidDisplay)}</span>
              </div>

              <div style="display: flex; justify-content: space-between; align-items: center; font-size: 13px; color: var(--color-neutral-600); margin-bottom: 12px;">
                <span>Valid Period:</span>
                <span style="font-weight: 600; color: var(--color-neutral-900);">${escapeHtml(s.startDate)} ${s.endDate ? 'to ' + escapeHtml(s.endDate) : ''}</span>
              </div>

              <div style="display: flex; justify-content: space-between; align-items: center; font-size: 13px; color: var(--color-neutral-600); margin-bottom: 12px;">
                <span>Remaining Days:</span>
                <span style="font-weight: 700; color: var(--color-primary-600);">${s.daysLeft} Days</span>
              </div>

              ${recoveryBadgeHtml}

              <div style="display: flex; gap: 8px; margin-top: 16px;">
                <button class="btn-outline-action view-kitchen-btn" data-prov-id="${escapeHtml(s.providerId)}" style="flex: 1; padding: 10px; font-size: 13px;">
                  <i class="fa-solid fa-store"></i> View Kitchen
                </button>
                <button class="btn-primary-action renew-plan-btn" data-plan-id="${escapeHtml(s.planId || '')}" data-prov-id="${escapeHtml(s.providerId || '')}" style="flex: 1; padding: 10px; font-size: 13px; justify-content: center;">
                  <i class="fa-solid fa-arrows-rotate"></i> Renew Plan
                </button>
              </div>
            </div>
          </div>
        `;
        }).join('');

      subsGrid.querySelectorAll('.use-recovery-plan-btn').forEach((btn) => {
        btn.addEventListener('click', (e) => {
          const pId = (e.currentTarget as HTMLElement).getAttribute('data-prov-id');
          if (pId) navigate(`/providers/${pId}`);
        });
      });

      subsGrid.querySelectorAll('.view-kitchen-btn').forEach((btn) => {
        btn.addEventListener('click', (e) => {
          const pId = (e.currentTarget as HTMLElement).getAttribute('data-prov-id');
          if (pId) navigate(`/providers/${pId}`);
        });
      });

      subsGrid.querySelectorAll('.renew-plan-btn').forEach((btn) => {
        btn.addEventListener('click', (e) => {
          const planId = (e.currentTarget as HTMLElement).getAttribute('data-plan-id');
          const provId = (e.currentTarget as HTMLElement).getAttribute('data-prov-id');
          if (planId) {
            navigate(`/checkout/${planId}`);
          } else if (provId) {
            navigate(`/providers/${provId}`);
          }
        });
      });
    } else if (activeTab === 'MEAL_HISTORY') {
      const renderRecoverySection = () => {
        const activeBalances = loadedRecoveryBalances.filter((b: any) => (b.remainingDays || 0) > 0);
        return `
          <div id="studentMealRecoverySection" class="student-meal-recovery-card" style="grid-column: 1/-1; background: #fff; border: 1px solid var(--color-neutral-200); border-radius: 24px; padding: 24px; box-shadow: 0 4px 16px rgba(0,0,0,0.03); margin-top: 8px; box-sizing: border-box;">
            <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 16px; border-bottom: 1px solid var(--color-neutral-100); padding-bottom: 14px; flex-wrap: wrap; gap: 8px;">
              <div style="display: flex; align-items: center; gap: 10px;">
                <div style="width: 38px; height: 38px; border-radius: 12px; background: linear-gradient(135deg, #ecfdf5, #d1fae5); color: #047857; display: flex; align-items: center; justify-content: center; font-size: 17px;">
                  <i class="fa-solid fa-shield-halved"></i>
                </div>
                <div>
                  <h3 class="font-display" style="font-size: 18px; font-weight: 800; color: var(--color-neutral-900); margin: 0;">Meal Recovery</h3>
                  <span style="font-size: 12px; color: var(--color-neutral-500);">Unattended meals automatically recovered for future subscriptions</span>
                </div>
              </div>
            </div>

            ${activeBalances.length > 0 ? `
              <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(280px, 1fr)); gap: 14px;">
                ${activeBalances.map((b: any) => `
                  <div style="background: linear-gradient(135deg, #f0fdf4, #ffffff); border: 1px solid #bbf7d0; border-radius: 16px; padding: 18px; display: flex; flex-direction: column; gap: 8px; box-shadow: 0 2px 8px rgba(34, 197, 94, 0.05);">
                    <div style="display: flex; justify-content: space-between; align-items: flex-start; gap: 8px;">
                      <strong style="font-size: 15px; color: var(--color-neutral-900); word-break: break-word;">${escapeHtml(b.providerName)}</strong>
                      <span style="background: #15803d; color: #fff; font-size: 12px; font-weight: 800; padding: 4px 10px; border-radius: 999px; white-space: nowrap;">
                        ${b.remainingDays} Recovery Day${b.remainingDays === 1 ? '' : 's'} Available
                      </span>
                    </div>
                    <p style="font-size: 13px; color: #166534; margin: 0; line-height: 1.4; display: flex; align-items: center; gap: 6px;">
                      <i class="fa-solid fa-circle-check" style="color: #22c55e;"></i> Automatically extends your next subscription at ${escapeHtml(b.providerName)}
                    </p>
                    <div style="display: flex; justify-content: space-between; font-size: 11px; color: var(--color-neutral-500); margin-top: 4px; padding-top: 6px; border-top: 1px dashed #dcfce7;">
                      <span>Total Recovered: ${b.totalRecoveredDays || b.remainingDays} day(s)</span>
                      <span>Used: ${b.usedDays || 0} day(s)</span>
                    </div>
                    <button class="use-recovery-plan-btn btn-primary-action" data-prov-id="${escapeHtml(b.providerId)}" style="margin-top: 6px; padding: 8px 14px; font-size: 12px; font-weight: 700; background: #15803d; border-color: #15803d; width: 100%; justify-content: center; cursor: pointer;">
                      Use on your next plan →
                    </button>
                  </div>
                `).join('')}
              </div>
            ` : `
              <div style="text-align: center; padding: 28px 16px; background: var(--color-neutral-50); border: 1px dashed var(--color-neutral-300); border-radius: 16px;">
                <div style="width: 44px; height: 44px; border-radius: 999px; background: var(--color-neutral-100); color: var(--color-neutral-400); display: flex; align-items: center; justify-content: center; font-size: 20px; margin: 0 auto 10px;">
                  <i class="fa-solid fa-shield-halved"></i>
                </div>
                <p style="font-size: 14px; font-weight: 700; color: var(--color-neutral-800); margin: 0 0 4px 0;">
                  Meal Recovery
                </p>
                <p style="font-size: 12px; color: var(--color-neutral-500); margin: 0; max-width: 440px; margin-left: auto; margin-right: auto;">
                  Your eligible missed meal days will be calculated after your subscription period ends.
                </p>
              </div>
            `}
          </div>
        `;
      };

      if (loadedMealHistory.length === 0) {
        subsGrid.innerHTML = `
          <div style="grid-column: 1/-1; background: #fff; border: 1px solid var(--color-neutral-200); border-radius: 24px; padding: 60px; text-align: center;">
            <div style="width: 72px; height: 72px; border-radius: 999px; background: var(--color-primary-50); color: var(--color-primary-600); display: flex; align-items: center; justify-content: center; font-size: 32px; margin: 0 auto 16px;">
              <i class="fa-solid fa-calendar-check"></i>
            </div>
            <h3 class="font-display" style="font-size: 22px; font-weight: 700; margin-bottom: 8px;">No Meal History Yet</h3>
            <p style="color: var(--color-neutral-500); margin-bottom: 24px; max-width: 440px; margin-left: auto; margin-right: auto;">
              Once you subscribe to a mess and scan their QR code at mealtime, your daily attendance checklist will appear here.
            </p>
            <div style="display: flex; gap: 12px; justify-content: center; flex-wrap: wrap;">
              <button id="historyScanQrBtn" class="btn-primary-action">
                <i class="fa-solid fa-camera"></i> Scan Meal QR
              </button>
              <button id="mealHistBrowseBtn" class="btn-outline-action" style="background: #fff;">
                <i class="fa-solid fa-utensils"></i> Browse Mess
              </button>
            </div>
          </div>
          ${renderRecoverySection()}`;
        document.getElementById('mealHistBrowseBtn')?.addEventListener('click', () => navigate('/providers'));
        document.getElementById('historyScanQrBtn')?.addEventListener('click', () => {
          openMealScanner(async () => {
            await fetchSubs();
          });
        });
        return;
      }

      subsGrid.innerHTML = loadedMealHistory
        .map((subHist) => {
          const days = subHist.days || [];
          const usedDaysCount = subHist.totalUsedCount ?? days.filter((d: any) => d.status === 'USED').length;

          return `
            <div class="meal-history-subscription-card" style="grid-column: 1/-1; background: #fff; border: 1px solid var(--color-neutral-200); border-radius: 24px; padding: 24px; box-shadow: 0 4px 16px rgba(0,0,0,0.03); margin-bottom: 24px; box-sizing: border-box;">
              <!-- Subscription Header -->
              <div class="meal-history-sub-header" style="display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 20px; flex-wrap: wrap; gap: 16px; border-bottom: 1px solid var(--color-neutral-100); padding-bottom: 16px;">
                <div>
                  <div style="display: inline-flex; align-items: center; gap: 6px; font-size: 11px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.5px; color: var(--color-primary-700); background: var(--color-primary-50); padding: 4px 10px; border-radius: 999px; margin-bottom: 6px;">
                    <i class="fa-solid fa-utensils"></i> ${escapeHtml(subHist.planTitle)}
                  </div>
                  <h2 class="font-display" style="font-size: 20px; font-weight: 800; color: var(--color-neutral-900); margin: 0 0 4px 0;">
                    ${escapeHtml(subHist.providerName)}
                  </h2>
                  ${subHist.providerArea ? `
                    <p style="font-size: 13px; color: var(--color-neutral-500); margin: 0;">
                      <i class="fa-solid fa-location-dot" style="color: var(--color-primary-600);"></i> ${escapeHtml(subHist.providerArea)}
                    </p>
                  ` : ''}
                </div>

                <div class="meal-history-sub-actions" style="display: flex; align-items: center; gap: 12px; flex-wrap: wrap;">
                  <div style="background: var(--color-neutral-50); border: 1px solid var(--color-neutral-200); border-radius: 14px; padding: 8px 16px; text-align: right;">
                    <span style="font-size: 11px; color: var(--color-neutral-500); font-weight: 600; display: block;">Meals Checked In</span>
                    <strong style="font-size: 16px; color: var(--color-primary-700);">${usedDaysCount} Day(s)</strong>
                  </div>
                  <button class="open-scanner-sub-btn btn-primary-action" style="padding: 10px 16px; font-size: 13px; font-weight: 700; border-radius: 12px;">
                    <i class="fa-solid fa-camera"></i> Scan Today's Meal
                  </button>
                </div>
              </div>

              <!-- Compact DayPicker Meal Calendar -->
              <div id="meal-calendar-mount-${escapeHtml(subHist.subscriptionId)}" class="meal-calendar-mount-point" style="width: 100%; display: flex; justify-content: center; margin-top: 20px;"></div>
            </div>
          `;
        })
        .join('') + renderRecoverySection();

      // Mount DayPicker MealCalendar for each subscription
      loadedMealHistory.forEach((subHist) => {
        const mountContainer = document.getElementById(`meal-calendar-mount-${subHist.subscriptionId}`);
        if (!mountContainer) return;

        const usageByDate: Record<string, 'checked-in' | 'missed'> = {};
        const detailsByDate: Record<string, { time?: string | null; source?: string | null }> = {};

        (subHist.days || []).forEach((d: any) => {
          if (d.status === 'USED' || d.checkedIn) {
            usageByDate[d.date] = 'checked-in';
          } else if (d.status === 'NOT_CHECKED_IN' || d.status === 'MISSED' || d.status === 'missed') {
            usageByDate[d.date] = 'missed';
          }
          if (d.time || d.source) {
            detailsByDate[d.date] = { time: d.time, source: d.source };
          }
        });

        const unmount = mountMealCalendar(mountContainer, {
          usageByDate,
          startDate: subHist.startDate,
          endDate: subHist.endDate,
          detailsByDate,
          title: 'Meal History',
          subtitle: 'Track your daily meal usage',
        });
        calendarUnmountFns.push(unmount);
      });

      subsGrid.querySelectorAll('.open-scanner-sub-btn').forEach((btn) => {
        btn.addEventListener('click', () => {
          openMealScanner(async () => {
            await fetchSubs();
          });
        });
      });
    } else {
      // SUBSCRIPTION HISTORY TAB
      if (subs.length === 0) {
        subsGrid.innerHTML = `
          <div style="grid-column: 1/-1; background: #fff; border: 1px solid var(--color-neutral-200); border-radius: 24px; padding: 60px; text-align: center;">
            <div style="width: 72px; height: 72px; border-radius: 999px; background: var(--color-neutral-100); display: flex; align-items: center; justify-content: center; font-size: 32px; color: var(--color-neutral-400); margin: 0 auto 16px;">
              <i class="fa-solid fa-receipt"></i>
            </div>
            <h3 class="font-display" style="font-size: 22px; font-weight: 700; margin-bottom: 8px;">No Subscription History</h3>
            <p style="color: var(--color-neutral-500); margin-bottom: 24px; max-width: 440px; margin-left: auto; margin-right: auto;">You haven't purchased a meal subscription yet.</p>
            <button id="historyEmptyBrowseBtn" class="btn-primary-action">
              <i class="fa-solid fa-utensils"></i> Browse Mess
            </button>
          </div>`;
        document.getElementById('historyEmptyBrowseBtn')?.addEventListener('click', () => navigate('/providers'));
        return;
      }

      subsGrid.innerHTML = subs
        .map((s, idx) => {
          const isActive = s.status === 'ACTIVE';
          const isCancelled = s.status === 'CANCELLED';
          const isExpired = s.status === 'EXPIRED';

          let statusBadgeBg = 'var(--color-neutral-100)';
          let statusBadgeColor = 'var(--color-neutral-600)';
          if (isActive) {
            statusBadgeBg = 'var(--color-success-50)';
            statusBadgeColor = 'var(--color-success-600)';
          } else if (isCancelled) {
            statusBadgeBg = '#fee2e2';
            statusBadgeColor = '#dc2626';
          } else if (isExpired) {
            statusBadgeBg = '#f1f5f9';
            statusBadgeColor = '#64748b';
          }

          return `
          <div style="background: #fff; border: 1px solid var(--color-neutral-200); border-radius: 20px; padding: 20px; box-shadow: 0 4px 12px rgba(0,0,0,0.03); display: flex; flex-direction: column; justify-content: space-between;">
            <div>
              <div style="display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 12px; gap: 8px;">
                <div>
                  <h3 class="font-display" style="font-size: 18px; font-weight: 800; color: var(--color-neutral-900); margin: 0 0 2px 0;">${escapeHtml(s.messName)}</h3>
                  <p style="font-size: 12px; color: var(--color-neutral-500); margin: 0;">
                    <i class="fa-solid fa-location-dot"></i> ${escapeHtml(s.area)}${s.city ? ', ' + escapeHtml(s.city) : ''}
                  </p>
                </div>
                <span style="font-size: 11px; font-weight: 700; padding: 4px 10px; border-radius: 6px; background: ${statusBadgeBg}; color: ${statusBadgeColor}; text-transform: uppercase;">
                  ${escapeHtml(s.status)}
                </span>
              </div>

              <div style="background: var(--color-neutral-50); border: 1px solid var(--color-neutral-200); border-radius: 12px; padding: 14px; margin-bottom: 16px;">
                <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 6px;">
                  <span style="font-size: 12px; color: var(--color-neutral-500); font-weight: 600;">Plan</span>
                  <span style="font-size: 14px; font-weight: 700; color: var(--color-neutral-900);">${escapeHtml(s.planType)}</span>
                </div>
                <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 6px;">
                  <span style="font-size: 12px; color: var(--color-neutral-500); font-weight: 600;">Amount Paid</span>
                  <span style="font-size: 16px; font-weight: 800; color: var(--color-primary-600);">${escapeHtml(s.amountPaidDisplay)}</span>
                </div>
                <div style="display: flex; justify-content: space-between; align-items: center;">
                  <span style="font-size: 12px; color: var(--color-neutral-500); font-weight: 600;">Payment Status</span>
                  <span style="font-size: 11px; font-weight: 700; color: ${s.paymentStatus === 'PAID' ? 'var(--color-success-600)' : '#dc2626'};">
                    <i class="fa-solid ${s.paymentStatus === 'PAID' ? 'fa-circle-check' : 'fa-circle-exclamation'}"></i> ${escapeHtml(s.paymentStatus)}
                  </span>
                </div>
              </div>

              <div style="display: flex; flex-direction: column; gap: 6px; font-size: 12px; color: var(--color-neutral-600); margin-bottom: 16px;">
                <div style="display: flex; justify-content: space-between;">
                  <span>Payment Date:</span>
                  <span style="font-weight: 600; color: var(--color-neutral-800);">${escapeHtml(s.paymentDateFormatted)}</span>
                </div>
                <div style="display: flex; justify-content: space-between;">
                  <span>Valid Period:</span>
                  <span style="font-weight: 600; color: var(--color-neutral-800);">${escapeHtml(s.startDate)} → ${escapeHtml(s.endDate || 'Active')}</span>
                </div>
              </div>
            </div>

            <button class="view-sub-details-btn btn-outline-action" data-idx="${idx}" style="width: 100%; padding: 10px; font-size: 13px; font-weight: 600;">
              <i class="fa-solid fa-circle-info"></i> View Details
            </button>
          </div>
        `;
        })
        .join('');

      subsGrid.querySelectorAll('.view-sub-details-btn').forEach((btn) => {
        btn.addEventListener('click', (e) => {
          const idx = Number((e.currentTarget as HTMLElement).getAttribute('data-idx'));
          selectedSubForDetails = loadedSubs[idx];
          renderPage();
          updateContentDisplay();
        });
      });
    }
  };

  const fetchSubs = async () => {
    let rawSubs: SubscriptionRecord[] = [];
    try {
      const data: any = await api.get('/subscriptions/history');
      rawSubs = Array.isArray(data) ? data : [];
    } catch (err: any) {
      const subsGrid = document.getElementById('subsGrid');
      if (subsGrid) {
        subsGrid.innerHTML = `
          <div style="grid-column: 1/-1; background: #fff; border: 1px solid #fee2e2; border-radius: 24px; padding: 48px; text-align: center;">
            <i class="fa-solid fa-triangle-exclamation" style="font-size: 36px; color: #dc2626; margin-bottom: 12px;"></i>
            <h3 class="font-display" style="font-size: 20px; font-weight: 700; color: var(--color-neutral-900); margin-bottom: 8px;">Unable to load subscription history.</h3>
            <p style="color: var(--color-neutral-600); margin-bottom: 20px;">${escapeHtml(err.message || 'Server error while fetching your subscription history.')}</p>
            <button id="retrySubsBtn" class="btn-primary-action" style="padding: 10px 24px;">
              <i class="fa-solid fa-rotate-right"></i> Try Again
            </button>
          </div>`;
        document.getElementById('retrySubsBtn')?.addEventListener('click', fetchSubs);
      }
      return;
    }

    try {
      const [mealHistData, recoveryData]: any[] = await Promise.all([
        getMyMealHistory().catch(() => []),
        getMyRecoveryBalance().catch(() => []),
      ]);
      loadedMealHistory = Array.isArray(mealHistData) ? mealHistData : [];
      loadedRecoveryBalances = Array.isArray(recoveryData) ? recoveryData : [];
    } catch (_) {
      loadedMealHistory = [];
      loadedRecoveryBalances = [];
    }

    loadedSubs = rawSubs.map((s) => {
      const provider = s.mealPlan?.provider || s.provider || {};
      const plan = s.mealPlan || {};
      const messName = provider.name || 'Kitchen Provider';
      const city = provider.city || '';
      const area = provider.address || provider.city || 'Location not recorded';
      const phone = provider.contactPhone || '';
      const planType = plan.title || 'Meal Subscription Plan';

      const rawPaid = s.amountPaid !== undefined && s.amountPaid !== null
        ? s.amountPaid
        : (s.payment?.amount !== undefined && s.payment?.amount !== null ? s.payment.amount : null);

      const parsedPaid = rawPaid !== null && rawPaid !== undefined && !isNaN(Number(rawPaid))
        ? Number(rawPaid)
        : null;

      const amountPaidDisplay = parsedPaid !== null ? `₹${parsedPaid.toLocaleString('en-IN')}` : 'Amount unavailable';

      let rawStatus = (s.status || 'ACTIVE').toUpperCase();
      const startDate = s.startDate || (s.createdAt ? new Date(s.createdAt).toISOString().split('T')[0] : '');
      const endDate = s.endDate || '';

      const pDate = s.paymentDate || s.createdAt || new Date();
      const paymentDateFormatted = new Date(pDate).toLocaleDateString('en-IN', {
        day: 'numeric',
        month: 'short',
        year: 'numeric',
      });

      let daysLeft = 0;
      if (endDate) {
        const [y, m, d] = endDate.split('-').map(Number);
        const endMs = new Date(y, (m || 1) - 1, d || 1, 23, 59, 59, 999).getTime();
        const diffMs = endMs - Date.now();
        daysLeft = Math.max(0, Math.ceil(diffMs / (1000 * 60 * 60 * 24)));
      }

      if (rawStatus === 'ACTIVE' && endDate && endDate < todayStr) {
        rawStatus = 'EXPIRED';
      }

      const safeRef = s.razorpayOrderId || s.razorpayPaymentId || s.id || 'REF-ACTIVE';

      return {
        id: s.id || '',
        subscriber_name: s.student?.name || s.student?.email || userEmail.split('@')[0],
        messName,
        city,
        area,
        contact_phone: phone,
        planType,
        startDate,
        endDate,
        paymentDateFormatted,
        daysLeft,
        status: rawStatus,
        paymentStatus: (s.paymentStatus || 'PAID').toUpperCase(),
        parsedPaid,
        amountPaidDisplay,
        safeRef,
        planId: plan.id || '',
        providerId: provider.id || '',
        recoveryDaysApplied: Number(s.recoveryDaysApplied || 0),
        durationDays: Number(plan.durationDays || 30),
      };
    });

    updateContentDisplay();
  };

  const checkPendingOrderOnDashboard = async () => {
    const pendingOrderId = sessionStorage.getItem('pendingPaymentOrderId');
    if (pendingOrderId) {
      console.log(`PAYMENT_PENDING_ORDER orderId=${pendingOrderId}`);
      try {
        const res: any = await api.get(`/payments/${pendingOrderId}/status`);
        console.log(`PAYMENT_STATUS_CHECK orderId=${pendingOrderId} status=${res?.status}`);
        if (res && res.status === 'SUCCESS') {
          sessionStorage.removeItem('pendingPaymentOrderId');
          showToast('Payment verified! Your subscription is now ACTIVE 🎉', 'success');
          await fetchSubs();
        } else if (res && res.status === 'FAILED') {
          sessionStorage.removeItem('pendingPaymentOrderId');
          showToast(res.message || 'Previous payment attempt failed.', 'info');
        }
      } catch (err: any) {
        const isAuthOrNotFound =
          err?.response?.status === 403 ||
          err?.status === 403 ||
          err?.response?.status === 404 ||
          err?.status === 404;
        if (isAuthOrNotFound) {
          sessionStorage.removeItem('pendingPaymentOrderId');
          sessionStorage.removeItem('pendingPaymentPlanId');
        }
      }
    }
  };

  renderPage();
  fetchSubs().then(() => checkPendingOrderOnDashboard());
}
