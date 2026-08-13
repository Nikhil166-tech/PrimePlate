import api from '../api';
import { navigate } from '../router';
import { renderNavbar, attachNavbarEvents } from '../components/navbar';
import { escapeHtml } from '../utils/sanitize';

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
  createdAt?: string;
}

export async function renderDashboard() {
  const container = document.getElementById('app')!;
  const token = localStorage.getItem('accessToken');
  const userEmail = localStorage.getItem('userEmail') || 'Student';
  const userName = localStorage.getItem('userName') || userEmail.split('@')[0];
  const userPhone = localStorage.getItem('userPhone') || 'Not available';

  if (!token) {
    navigate('#/login');
    return;
  }

  let activeTab: 'PASSES' | 'HISTORY' = 'PASSES';
  let loadedSubs: any[] = [];
  let selectedSubForDetails: any = null;

  const renderPage = () => {
    container.innerHTML = `
      ${renderNavbar()}
      <main class="main-content" style="padding-top: 88px; padding-bottom: 60px; background: #f8fafc;">
        <div style="max-width: 1280px; margin: 0 auto; padding: 0 16px;">
          
          <!-- Header -->
          <div style="display: flex; justify-content: space-between; align-items: flex-end; margin-bottom: 28px; flex-wrap: wrap; gap: 16px;">
            <div>
              <h1 class="font-display" style="font-size: clamp(1.75rem, 4vw, 2.25rem); font-weight: 800; color: var(--color-neutral-900); margin-bottom: 4px;">Student Dashboard</h1>
              <p style="color: var(--color-neutral-600); font-size: clamp(0.875rem, 2vw, 0.95rem);">Welcome back, <strong>${escapeHtml(userName)}</strong> • Phone: <strong>${escapeHtml(userPhone)}</strong> (${escapeHtml(userEmail)})</p>
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

          <!-- 3-Metrics Overview Grid -->
          <div class="dashboard-metrics-grid">
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
          <div id="subsGrid" style="display: grid; grid-template-columns: repeat(auto-fit, minmax(280px, 1fr)); gap: 20px;">
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

      <footer class="footer">
        © ${new Date().getFullYear()} PrimePlate. Premium Meal Subscription Platform.
      </footer>
    `;

    attachNavbarEvents();

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

    const closeDetails = () => {
      selectedSubForDetails = null;
      renderPage();
      updateContentDisplay();
    };

    document.getElementById('closeDetailsModalBtn')?.addEventListener('click', closeDetails);
    document.getElementById('closeDetailsModalBtn2')?.addEventListener('click', closeDetails);
  };

  const updateContentDisplay = () => {
    const subsGrid = document.getElementById('subsGrid');
    if (!subsGrid) return;

    const subs = loadedSubs;
    const activeSubs = subs.filter((s) => s.status === 'ACTIVE');
    const validPaidSubs = subs.filter((s) => s.parsedPaid !== null);
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
        .map((s) => `
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

              <div style="display: flex; justify-content: space-between; align-items: center; font-size: 13px; color: var(--color-neutral-600); margin-bottom: 16px;">
                <span>Remaining Days:</span>
                <span style="font-weight: 700; color: var(--color-primary-600);">${s.daysLeft} Days</span>
              </div>

              <div style="display: flex; gap: 8px;">
                <button class="btn-outline-action view-kitchen-btn" data-prov-id="${escapeHtml(s.providerId)}" style="flex: 1; padding: 10px; font-size: 13px;">
                  <i class="fa-solid fa-store"></i> View Kitchen
                </button>
              </div>
            </div>
          </div>
        `).join('');

      subsGrid.querySelectorAll('.view-kitchen-btn').forEach((btn) => {
        btn.addEventListener('click', (e) => {
          const pId = (e.currentTarget as HTMLElement).getAttribute('data-prov-id');
          if (pId) navigate(`#/providers/${pId}`);
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

      const rawStatus = (s.status || 'ACTIVE').toUpperCase();
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
        providerId: provider.id || '',
      };
    });

    updateContentDisplay();
  };

  renderPage();
  fetchSubs();
}

