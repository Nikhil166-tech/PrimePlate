import api, {
  createSubscriptionBreak,
  getMySubscriptionBreaks,
} from '../api';
import { navigate } from '../router';
import { showToast } from '../components/toast';
import { renderNavbar, attachNavbarEvents } from '../components/navbar';
import { renderFooter, attachFooterEvents } from '../components/footer';
import { escapeHtml } from '../utils/sanitize';

export function calculateInclusiveDays(fromDateStr: string, toDateStr: string): number {
  if (!fromDateStr || !toDateStr) return 1;
  const from = new Date(fromDateStr + 'T00:00:00Z');
  const to = new Date(toDateStr + 'T00:00:00Z');
  const diffTime = to.getTime() - from.getTime();
  if (isNaN(diffTime) || diffTime < 0) return 1;
  return Math.round(diffTime / (1000 * 60 * 60 * 24)) + 1;
}

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
      subscriptionBreaksEnabled?: boolean;
    };
  };
  provider?: {
    id?: string;
    name?: string;
    city?: string;
    address?: string;
    contactPhone?: string;
    subscriptionBreaksEnabled?: boolean;
  };
  status?: string;
  startDate?: string;
  endDate?: string;
  createdAt?: string;
}

export async function renderDashboard() {
  const container = document.getElementById('app')!;
  const token = localStorage.getItem('accessToken');
  const userEmail = localStorage.getItem('userEmail') || 'PrimeMate';
  const userName = localStorage.getItem('userName') || userEmail.split('@')[0];
  const userPhone = localStorage.getItem('userPhone') || 'Not available';

  if (!token) {
    navigate('#/login');
    return;
  }

  let activeTab: 'PASSES' | 'HISTORY' = 'PASSES';
  let loadedSubs: any[] = [];
  let loadedBreakRequests: any[] = [];
  let selectedSubForDetails: any = null;
  let activeModal: 'NONE' | 'TAKE_BREAK' = 'NONE';
  let modalTargetSub: any = null;
  const todayStr = new Date().toISOString().split('T')[0];
  let modalFromDate = todayStr;
  let modalToDate = todayStr;
  let modalReason = 'Going home';

  const calculateInclusiveDays = (fromStr: string, toStr: string): number => {
    if (!fromStr || !toStr || toStr < fromStr) return 0;
    const from = new Date(fromStr + 'T00:00:00Z');
    const to = new Date(toStr + 'T00:00:00Z');
    const diff = to.getTime() - from.getTime();
    return Math.round(diff / (1000 * 60 * 60 * 24)) + 1;
  };

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
              <button id="dashNewSubBtn" class="btn-primary-action" style="padding: 10px 20px;">
                <i class="fa-solid fa-plus"></i> New Subscription
              </button>
            </div>
          </div>

          <!-- Tab Navigation Bar -->
          <div style="display: flex; gap: 12px; margin-bottom: 24px; border-bottom: 2px solid var(--color-neutral-200); padding-bottom: 12px; overflow-x: auto;">
            <button id="tabActivePasses" class="btn-outline-action" style="font-weight: 700; padding: 10px 20px; border-radius: 12px; background: ${activeTab === 'PASSES' ? 'var(--color-primary-600)' : '#fff'}; color: ${activeTab === 'PASSES' ? '#fff' : 'var(--color-neutral-700)'}; border-color: ${activeTab === 'PASSES' ? 'var(--color-primary-600)' : 'var(--color-neutral-300)'};">
              <i class="fa-solid fa-qrcode"></i> My Active Passes
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

            <div class="dashboard-metric-card meal-credits">
              <div class="dashboard-metric-header">
                <div class="dashboard-metric-icon">
                  <i class="fa-solid fa-plane-departure"></i>
                </div>
                <span class="dashboard-metric-label">Subscription Breaks</span>
              </div>
              <div>
                <p id="breakSummaryText" class="dashboard-metric-value" style="color: var(--color-primary-700); font-size: 22px;">Max 4 Days</p>
                <span style="font-size: 11px; color: var(--color-neutral-600);">Available for 1-Month Subscriptions</span>
              </div>
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

      <!-- Take a Subscription Break Modal -->
      <div id="takeBreakModal" style="display: ${activeModal === 'TAKE_BREAK' && modalTargetSub ? 'flex' : 'none'}; position: fixed; inset: 0; background: rgba(0,0,0,0.55); align-items: center; justify-content: center; z-index: 1000; padding: 20px;">
        ${activeModal === 'TAKE_BREAK' && modalTargetSub ? `
          <div style="background: #fff; border-radius: 24px; max-width: 460px; width: 100%; padding: 28px; box-shadow: 0 20px 40px rgba(0,0,0,0.25);">
            <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 16px;">
              <h3 class="font-display" style="font-size: 20px; font-weight: 800; color: var(--color-neutral-900); margin: 0;">
                <i class="fa-solid fa-plane-departure" style="color: var(--color-primary-600);"></i> Take a Subscription Break
              </h3>
              <button id="closeBreakModalBtn" style="background: none; border: none; font-size: 24px; cursor: pointer; color: var(--color-neutral-500);">&times;</button>
            </div>

            <p style="color: var(--color-neutral-600); font-size: 14px; line-height: 1.5; margin-bottom: 20px;">
              Temporarily pause your subscription while away from <strong>${escapeHtml(modalTargetSub.messName)}</strong>. Approved break days extend your subscription end date by the exact break duration.
            </p>

            <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 12px; margin-bottom: 16px;">
              <div>
                <label style="font-size: 12px; font-weight: 700; color: var(--color-neutral-700); display: block; margin-bottom: 4px;">From Date *</label>
                <input type="date" id="breakFromDateInput" value="${modalFromDate}" min="${todayStr}" max="${modalTargetSub.endDate || ''}" style="width: 100%; padding: 10px; border: 1px solid var(--color-neutral-300); border-radius: 10px; font-size: 13px;">
              </div>
              <div>
                <label style="font-size: 12px; font-weight: 700; color: var(--color-neutral-700); display: block; margin-bottom: 4px;">To Date *</label>
                <input type="date" id="breakToDateInput" value="${modalToDate}" min="${modalFromDate}" max="${modalTargetSub.endDate || ''}" style="width: 100%; padding: 10px; border: 1px solid var(--color-neutral-300); border-radius: 10px; font-size: 13px;">
              </div>
            </div>

            <div style="background: var(--color-neutral-50); border: 1px solid var(--color-neutral-200); border-radius: 12px; padding: 12px; margin-bottom: 16px; display: flex; justify-content: space-between; align-items: center;">
              <div>
                <span style="font-size: 12px; color: var(--color-neutral-500); font-weight: 600; display: block;">Calculated Duration</span>
                <strong id="calcDurationText" style="font-size: 16px; color: var(--color-primary-700);">${calculateInclusiveDays(modalFromDate, modalToDate)} Day(s)</strong>
              </div>
              <span style="font-size: 11px; font-weight: 700; background: #ffedd5; color: #c2410c; padding: 4px 10px; border-radius: 20px;">
                Max 4 Days Limit
              </span>
            </div>

            <div style="margin-bottom: 24px;">
              <label style="font-size: 12px; font-weight: 700; color: var(--color-neutral-700); display: block; margin-bottom: 4px;">Reason (Optional)</label>
              <select id="breakReasonSelect" style="width: 100%; padding: 10px; border: 1px solid var(--color-neutral-300); border-radius: 10px; font-size: 13px; background: #fff;">
                <option value="Going home" ${modalReason === 'Going home' ? 'selected' : ''}>Going home</option>
                <option value="Travel" ${modalReason === 'Travel' ? 'selected' : ''}>Travel</option>
                <option value="College holidays" ${modalReason === 'College holidays' ? 'selected' : ''}>College holidays</option>
                <option value="Work travel" ${modalReason === 'Work travel' ? 'selected' : ''}>Work travel</option>
                <option value="Personal" ${modalReason === 'Personal' ? 'selected' : ''}>Personal</option>
                <option value="Other" ${modalReason === 'Other' ? 'selected' : ''}>Other</option>
              </select>
            </div>

            <div style="display: flex; gap: 12px; justify-content: flex-end;">
              <button id="cancelBreakModalBtn" class="btn-outline-action" style="padding: 10px 18px;">Cancel</button>
              <button id="confirmBreakModalBtn" class="btn-primary-action" style="padding: 10px 20px;">
                <i class="fa-solid fa-paper-plane"></i> Send Request
              </button>
            </div>
          </div>
        ` : ''}
      </div>

      ${renderFooter()}
    `;

    attachNavbarEvents();
    attachFooterEvents();

    document.getElementById('dashNewSubBtn')?.addEventListener('click', () => navigate('#/providers'));

    document.getElementById('tabActivePasses')?.addEventListener('click', () => {
      activeTab = 'PASSES';
      renderPage();
      updateContentDisplay();
    });

    document.getElementById('tabSubHistory')?.addEventListener('click', () => {
      activeTab = 'HISTORY';
      renderPage();
      updateContentDisplay();
    });

    const closeModal = () => {
      activeModal = 'NONE';
      modalTargetSub = null;
      selectedSubForDetails = null;
      renderPage();
      updateContentDisplay();
    };

    document.getElementById('closeDetailsModalBtn')?.addEventListener('click', closeModal);
    document.getElementById('closeDetailsModalBtn2')?.addEventListener('click', closeModal);
    document.getElementById('closeBreakModalBtn')?.addEventListener('click', closeModal);
    document.getElementById('cancelBreakModalBtn')?.addEventListener('click', closeModal);

    const fromInput = document.getElementById('breakFromDateInput') as HTMLInputElement;
    const toInput = document.getElementById('breakToDateInput') as HTMLInputElement;
    if (fromInput && toInput) {
      fromInput.addEventListener('change', (e) => {
        modalFromDate = (e.target as HTMLInputElement).value;
        if (modalToDate < modalFromDate) modalToDate = modalFromDate;
        const durEl = document.getElementById('calcDurationText');
        if (durEl) durEl.innerText = `${calculateInclusiveDays(modalFromDate, modalToDate)} Day(s)`;
      });
      toInput.addEventListener('change', (e) => {
        modalToDate = (e.target as HTMLInputElement).value;
        const durEl = document.getElementById('calcDurationText');
        if (durEl) durEl.innerText = `${calculateInclusiveDays(modalFromDate, modalToDate)} Day(s)`;
      });
    }

    document.getElementById('confirmBreakModalBtn')?.addEventListener('click', async () => {
      if (!modalTargetSub) return;
      const fInput = (document.getElementById('breakFromDateInput') as HTMLInputElement)?.value || modalFromDate;
      const tInput = (document.getElementById('breakToDateInput') as HTMLInputElement)?.value || modalToDate;
      const rInput = (document.getElementById('breakReasonSelect') as HTMLSelectElement)?.value || modalReason;

      const breakDays = calculateInclusiveDays(fInput, tInput);
      if (breakDays < 1 || breakDays > 4) {
        showToast('Break duration must be between 1 and 4 days.', 'error');
        return;
      }

      try {
        await createSubscriptionBreak(modalTargetSub.id, fInput, tInput, rInput);
        showToast('Break request sent. Waiting for provider approval.', 'info');
        activeModal = 'NONE';
        modalTargetSub = null;
        await fetchSubs();
      } catch (err: any) {
        showToast(err?.message || 'Unable to submit break request', 'error');
      }
    });
  };

  const updateContentDisplay = () => {
    const subsGrid = document.getElementById('subsGrid');
    if (!subsGrid) return;

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
      totalSpentEl.innerText = validPaidSubs.length > 0 ? `₹${totalSpent.toLocaleString('en-IN')}` : 'Amount unavailable';
    }

    const totalSubsEl = document.getElementById('totalSubsCount');
    if (totalSubsEl) totalSubsEl.innerText = `${subs.length}`;

    if (activeTab === 'PASSES') {
      if (activeSubs.length === 0) {
        subsGrid.innerHTML = `
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
        document.getElementById('emptyBrowseBtn')?.addEventListener('click', () => navigate('#/providers'));
        return;
      }

      subsGrid.innerHTML = activeSubs
        .map((s) => {
          // Check if this subscription is a 1-MONTH subscription
          const startDateObj = new Date(s.startDate);
          const endDateObj = new Date(s.endDate || s.startDate);
          const totalInitialDays = Math.round((endDateObj.getTime() - startDateObj.getTime()) / (1000 * 60 * 60 * 24)) + 1;
          const planTitleLower = (s.planType || '').toLowerCase();
          const isHalfMonth = planTitleLower.includes('15 day') || planTitleLower.includes('half-month') || planTitleLower.includes('half month');
          const isOneDay = planTitleLower.includes('1 day') || planTitleLower.includes('one day') || totalInitialDays <= 3;
          const isOneWeek = planTitleLower.includes('1 week') || planTitleLower.includes('one week') || planTitleLower.includes('7 day');
          const isOneMonthSub = (s.status || '').toUpperCase() === 'ACTIVE' &&
            !isHalfMonth && !isOneDay && !isOneWeek &&
            (totalInitialDays >= 25 || planTitleLower.includes('1 month') || planTitleLower.includes('one month') || (planTitleLower.includes('month') && !planTitleLower.includes('half')));

          // Calculate break requests for this subscription
          const subBreaks = loadedBreakRequests.filter((r) => r.subscriptionId === s.id);
          const usedBreakDays = subBreaks.filter((r) => r.status === 'APPROVED').reduce((sum, r) => sum + Number(r.breakDays || 0), 0);
          const availableBreakDays = Math.max(0, 4 - usedBreakDays);
          const isProviderBreakEnabled = s.subscriptionBreaksEnabled === true || s.mealPlan?.provider?.subscriptionBreaksEnabled === true || s.provider?.subscriptionBreaksEnabled === true;

          let breakSectionHtml = '';
          // Show Subscription Break section ONLY for eligible active 1-MONTH subscriptions with break enabled
          if (isOneMonthSub && isProviderBreakEnabled) {
            if (usedBreakDays >= 4) {
              breakSectionHtml = `
                <div class="meal-skip-card" style="background: #fef2f2; border-color: #fee2e2; margin-top: 14px;">
                  <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 6px;">
                    <span class="meal-skip-title"><i class="fa-solid fa-plane-departure" style="color: var(--color-primary-600);"></i> Subscription Break</span>
                    <span class="meal-skip-counter">4 / 4 Days Used</span>
                  </div>
                  <div style="font-size: 12px; font-weight: 600; color: #dc2626;">
                    <i class="fa-solid fa-circle-exclamation"></i> You've used all 4 break days for this subscription.
                  </div>
                </div>`;
            } else {
              breakSectionHtml = `
                <div class="meal-skip-card" style="margin-top: 14px;">
                  <div class="meal-skip-card-header">
                    <div>
                      <span class="meal-skip-title"><i class="fa-solid fa-plane-departure" style="color: var(--color-primary-600);"></i> Subscription Break</span>
                      <span style="font-size: 11px; color: var(--color-neutral-500); display: block; margin-top: 2px;">Used: <strong>${usedBreakDays} / 4 days</strong> • Available: <strong>${availableBreakDays} days</strong></span>
                    </div>
                    <button class="take-break-btn btn-outline-action" data-sub-id="${escapeHtml(s.id)}" style="padding: 6px 14px; font-size: 12px; font-weight: 700; border-color: var(--color-primary-600); color: var(--color-primary-600);">
                      <i class="fa-solid fa-calendar-plus"></i> Take a Break
                    </button>
                  </div>

                  ${subBreaks.length > 0 ? `
                    <div class="meal-skip-list">
                      ${subBreaks.map((r) => {
                        let badgeClass = 'pending';
                        let statusText = 'Break request sent. Waiting for provider approval.';
                        if (r.status === 'APPROVED') {
                          badgeClass = 'approved';
                          statusText = `✅ Break approved — Subscription extended by ${r.breakDays} days`;
                        } else if (r.status === 'REJECTED') {
                          badgeClass = 'rejected';
                          statusText = 'Break request rejected — No subscription extension';
                        }

                        return `
                          <div class="meal-skip-item">
                            <div>
                              <span style="font-weight: 700; font-size: 13px; color: var(--color-neutral-900); display: block;">${escapeHtml(r.fromDate)} → ${escapeHtml(r.toDate)} (${r.breakDays} days)</span>
                              <span style="font-size: 11px; color: var(--color-neutral-500);">${escapeHtml(statusText)}</span>
                            </div>
                            <span class="meal-skip-badge ${badgeClass}">${escapeHtml(r.status)}</span>
                          </div>
                        `;
                      }).join('')}
                    </div>
                  ` : '<p style="font-size: 12px; color: var(--color-neutral-500); margin: 6px 0 0 0;">No subscription breaks requested yet.</p>'}
                </div>`;
            }
          }

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

              <!-- Subscription Break Section (Rendered only for 1-Month Subscriptions) -->
              ${breakSectionHtml}

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

      subsGrid.querySelectorAll('.view-kitchen-btn').forEach((btn) => {
        btn.addEventListener('click', (e) => {
          const pId = (e.currentTarget as HTMLElement).getAttribute('data-prov-id');
          if (pId) navigate(`#/providers/${pId}`);
        });
      });

      subsGrid.querySelectorAll('.renew-plan-btn').forEach((btn) => {
        btn.addEventListener('click', (e) => {
          const planId = (e.currentTarget as HTMLElement).getAttribute('data-plan-id');
          const provId = (e.currentTarget as HTMLElement).getAttribute('data-prov-id');
          if (planId) {
            navigate(`#/checkout/${planId}`);
          } else if (provId) {
            navigate(`#/providers/${provId}`);
          }
        });
      });

      subsGrid.querySelectorAll('.take-break-btn').forEach((btn) => {
        btn.addEventListener('click', (e) => {
          const subId = (e.currentTarget as HTMLElement).getAttribute('data-sub-id');
          const sub = loadedSubs.find((s) => s.id === subId);
          if (sub) {
            modalTargetSub = sub;
            modalFromDate = todayStr;
            modalToDate = todayStr;
            activeModal = 'TAKE_BREAK';
            renderPage();
            updateContentDisplay();
          }
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
        document.getElementById('historyEmptyBrowseBtn')?.addEventListener('click', () => navigate('#/providers'));
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
      const breakData: any = await getMySubscriptionBreaks();
      if (breakData && typeof breakData === 'object') {
        loadedBreakRequests = Array.isArray(breakData.requests) ? breakData.requests : [];
      }
    } catch (_) {
      loadedBreakRequests = [];
    }

    loadedSubs = rawSubs.map((s) => {
      const provider = s.mealPlan?.provider || s.provider || {};
      const plan = s.mealPlan || {};
      const messName = provider.name || 'Kitchen Provider';
      const city = provider.city || '';
      const area = provider.address || provider.city || 'Location not recorded';
      const phone = provider.contactPhone || '';
      const planType = plan.title || 'Meal Subscription Plan';
      const subscriptionBreaksEnabled = provider.subscriptionBreaksEnabled ?? false;

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
        const endMs = new Date(endDate).getTime();
        const diffMs = endMs - Date.now();
        daysLeft = Math.max(0, Math.ceil(diffMs / (1000 * 60 * 60 * 24)));
      }

      if (rawStatus === 'ACTIVE' && (daysLeft <= 0 || (endDate && endDate < todayStr))) {
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
        subscriptionBreaksEnabled,
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
      } catch (_) {
        // Keep pending order ID for user manual check
      }
    }
  };

  renderPage();
  fetchSubs().then(() => checkPendingOrderOnDashboard());
}
