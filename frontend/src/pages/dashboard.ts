import api from '../api';
import { navigate } from '../router';
import { renderNavbar, attachNavbarEvents } from '../components/navbar';
import { escapeHtml } from '../utils/sanitize';

interface SubscriptionRecord {
  id?: string;
  amountPaid?: number | string | null;
  payment?: { amount?: number | string | null };
  student?: { id?: string; name?: string; email?: string; phone?: string };
  mealPlan?: {
    id?: string;
    title?: string;
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

  if (!token) {
    navigate('#/login');
    return;
  }

  container.innerHTML = `
    ${renderNavbar()}
    <main class="main-content" style="padding-top: 88px; padding-bottom: 60px; background: #f8fafc;">
      <div style="max-width: 1280px; margin: 0 auto; padding: 0 24px;">
        <!-- Header -->
        <div style="display: flex; justify-content: space-between; align-items: flex-end; margin-bottom: 28px; flex-wrap: wrap; gap: 16px;">
          <div>
            <h1 class="font-display" style="font-size: 36px; font-weight: 800; color: var(--color-neutral-900); margin-bottom: 4px;">My Mess Card</h1>
            <p style="color: var(--color-neutral-600); font-size: 15px;">Welcome back, ${escapeHtml(userEmail.split('@')[0])}. Manage your digital mess passes and subscriptions.</p>
          </div>
          <button id="dashNewSubBtn" class="btn-primary-action" style="padding: 12px 24px;">
            <i class="fa-solid fa-plus"></i> New Subscription
          </button>
        </div>

        <!-- 3-Metrics Overview Grid -->
        <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(240px, 1fr)); gap: 20px; margin-bottom: 32px;">
          <div style="background: #fff; border: 1px solid var(--color-neutral-200); border-radius: 20px; padding: 20px; box-shadow: 0 4px 12px rgba(0,0,0,0.03);">
            <div style="display: flex; align-items: center; gap: 10px; color: var(--color-neutral-500); margin-bottom: 8px;">
              <div style="width: 40px; height: 40px; border-radius: 12px; background: var(--color-success-50); color: var(--color-success-600); display: flex; align-items: center; justify-content: center; font-size: 18px;">
                <i class="fa-solid fa-qrcode"></i>
              </div>
              <span style="font-size: 13px; font-weight: 600;">Active Cards</span>
            </div>
            <p id="activeCardsCount" class="font-display" style="font-size: 32px; font-weight: 800; color: var(--color-neutral-900);">0</p>
          </div>

          <div style="background: #fff; border: 1px solid var(--color-neutral-200); border-radius: 20px; padding: 20px; box-shadow: 0 4px 12px rgba(0,0,0,0.03);">
            <div style="display: flex; align-items: center; gap: 10px; color: var(--color-neutral-500); margin-bottom: 8px;">
              <div style="width: 40px; height: 40px; border-radius: 12px; background: var(--color-primary-50); color: var(--color-primary-600); display: flex; align-items: center; justify-content: center; font-size: 18px;">
                <i class="fa-solid fa-chart-line"></i>
              </div>
              <span style="font-size: 13px; font-weight: 600;">Total Spent</span>
            </div>
            <p id="totalSpentAmount" class="font-display" style="font-size: 32px; font-weight: 800; color: var(--color-neutral-900);">--</p>
          </div>

          <div style="background: #fff; border: 1px solid var(--color-neutral-200); border-radius: 20px; padding: 20px; box-shadow: 0 4px 12px rgba(0,0,0,0.03);">
            <div style="display: flex; align-items: center; gap: 10px; color: var(--color-neutral-500); margin-bottom: 8px;">
              <div style="width: 40px; height: 40px; border-radius: 12px; background: var(--color-secondary-50); color: var(--color-secondary-500); display: flex; align-items: center; justify-content: center; font-size: 18px;">
                <i class="fa-solid fa-utensils"></i>
              </div>
              <span style="font-size: 13px; font-weight: 600;">Total Subscriptions</span>
            </div>
            <p id="totalSubsCount" class="font-display" style="font-size: 32px; font-weight: 800; color: var(--color-neutral-900);">0</p>
          </div>
        </div>

        <!-- Cards List Container -->
        <div id="subsGrid" style="display: grid; grid-template-columns: repeat(auto-fit, minmax(360px, 1fr)); gap: 24px;"></div>
      </div>
    </main>

    <footer class="footer">
      © ${new Date().getFullYear()} PrimePlate. Premium Meal Subscription Platform.
    </footer>
  `;

  attachNavbarEvents();

  document.getElementById('dashNewSubBtn')?.addEventListener('click', () => navigate('#/providers'));

  const subsGrid = document.getElementById('subsGrid')!;

  const fetchSubs = async () => {
    let rawSubs: SubscriptionRecord[] = [];
    try {
      const data: any = await api.get('/subscriptions');
      rawSubs = Array.isArray(data) ? data : [];
    } catch (err: any) {
      subsGrid.innerHTML = `
        <div style="grid-column: 1/-1; background: #fff; border: 1px solid #fee2e2; border-radius: 24px; padding: 48px; text-align: center;">
          <i class="fa-solid fa-triangle-exclamation" style="font-size: 36px; color: #dc2626; margin-bottom: 12px;"></i>
          <h3 class="font-display" style="font-size: 20px; font-weight: 700; color: var(--color-neutral-900); margin-bottom: 8px;">Failed to Load Subscriptions</h3>
          <p style="color: var(--color-neutral-600); margin-bottom: 20px;">${escapeHtml(err.message || 'Server error while fetching your subscriptions.')}</p>
          <button id="retrySubsBtn" class="btn-primary-action" style="padding: 10px 24px;">
            <i class="fa-solid fa-rotate-right"></i> Retry Loading
          </button>
        </div>`;
      document.getElementById('retrySubsBtn')?.addEventListener('click', fetchSubs);
      return;
    }

    const subs = rawSubs.map((s) => {
      const provider = s.mealPlan?.provider || s.provider || {};
      const plan = s.mealPlan || {};
      const messName = provider.name || 'Kitchen Provider';
      const city = provider.city || '';
      const area = provider.address || provider.city || '';
      const phone = provider.contactPhone || '';
      const planType = plan.title || 'Meal Subscription Plan';

      // Authoritative Historical Amount Paid snapshot (s.amountPaid or s.payment.amount)
      const rawPaid = s.amountPaid !== undefined && s.amountPaid !== null
        ? s.amountPaid
        : (s.payment?.amount !== undefined && s.payment?.amount !== null ? s.payment.amount : null);

      const parsedPaid = rawPaid !== null && rawPaid !== undefined && !isNaN(Number(rawPaid))
        ? Number(rawPaid)
        : null;

      const amountPaidDisplay = parsedPaid !== null ? `₹${parsedPaid.toLocaleString('en-IN')}` : 'Amount unavailable';

      // Current Meal Plan Price (if updated by provider)
      const currentPlanPriceNum = plan.pricePerMonth && !isNaN(Number(plan.pricePerMonth))
        ? Number(plan.pricePerMonth)
        : null;
      const currentPlanPriceDisplay = currentPlanPriceNum !== null ? `₹${currentPlanPriceNum.toLocaleString('en-IN')}` : null;

      const status = (s.status || 'UNKNOWN').toUpperCase();
      const startDate = s.startDate || (s.createdAt ? new Date(s.createdAt).toISOString().split('T')[0] : '');
      const endDate = s.endDate || '';

      let daysLeft = 0;
      if (endDate) {
        const endMs = new Date(endDate).getTime();
        const diffMs = endMs - Date.now();
        daysLeft = Math.max(0, Math.ceil(diffMs / (1000 * 60 * 60 * 24)));
      }

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
        daysLeft,
        status,
        parsedPaid,
        amountPaidDisplay,
        currentPlanPriceDisplay,
        providerId: provider.id || '',
      };
    });

    const activeSubs = subs.filter((s) => s.status === 'ACTIVE');
    
    // Sum only valid historical amountPaid values (never assume ₹0 for missing values)
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

    if (subs.length === 0) {
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

    subsGrid.innerHTML = subs
      .map((s) => {
        const daysLeft = s.daysLeft;
        const isActive = s.status === 'ACTIVE';

        return `
        <div style="background: #fff; border: 1px solid var(--color-neutral-200); border-radius: 24px; overflow: hidden; box-shadow: 0 4px 16px rgba(0,0,0,0.04);">
          
          <!-- Top Digital Pass Banner -->
          <div style="background: ${isActive ? 'linear-gradient(135deg, var(--color-primary-600), var(--color-primary-700))' : 'linear-gradient(135deg, #64748b, #475569)'}; padding: 24px; color: #fff;">
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
                <span style="opacity: 0.8;">Card ID</span>
                <span style="font-family: monospace; font-size: 12px;">${escapeHtml(String(s.id).slice(0, 8).toUpperCase())}</span>
              </div>
              <div style="display: flex; justify-content: space-between;">
                <span style="opacity: 0.8;">Status</span>
                <span style="font-weight: 700; color: ${isActive ? '#86efac' : '#fca5a5'};">${escapeHtml(s.status)}</span>
              </div>
            </div>
          </div>

          <!-- Bottom Pass Body -->
          <div style="padding: 20px;">
            <div style="display: flex; justify-content: space-between; align-items: center; font-size: 13px; color: var(--color-neutral-600); margin-bottom: 8px;">
              <span>Amount Paid:</span>
              <span style="font-weight: 700; color: var(--color-neutral-900);">${escapeHtml(s.amountPaidDisplay)}</span>
            </div>

            ${
              s.currentPlanPriceDisplay && s.currentPlanPriceDisplay !== s.amountPaidDisplay
                ? `<div style="display: flex; justify-content: space-between; align-items: center; font-size: 12px; color: var(--color-neutral-500); margin-bottom: 8px;">
                    <span>Current Plan Price:</span>
                    <span>${escapeHtml(s.currentPlanPriceDisplay)}</span>
                   </div>`
                : ''
            }

            <div style="display: flex; justify-content: space-between; align-items: center; font-size: 13px; color: var(--color-neutral-600); margin-bottom: 12px;">
              <span>Valid Period:</span>
              <span style="font-weight: 600; color: var(--color-neutral-900);">${escapeHtml(s.startDate)} ${s.endDate ? 'to ' + escapeHtml(s.endDate) : ''}</span>
            </div>

            <div style="display: flex; justify-content: space-between; align-items: center; font-size: 13px; color: var(--color-neutral-600); margin-bottom: 16px;">
              <span>Remaining Days:</span>
              <span style="font-weight: 700; color: var(--color-primary-600);">${daysLeft} Days</span>
            </div>

            ${
              s.contact_phone
                ? `<p style="font-size: 12px; color: var(--color-neutral-500); margin-bottom: 16px;">
                    <i class="fa-solid fa-phone"></i> Provider Contact: <strong>${escapeHtml(s.contact_phone)}</strong>
                   </p>`
                : ''
            }

            <div style="display: flex; gap: 8px;">
              <button class="btn-outline-action view-kitchen-btn" data-prov-id="${escapeHtml(s.providerId)}" style="flex: 1; padding: 10px; font-size: 13px;">
                <i class="fa-solid fa-store"></i> View Kitchen
              </button>
            </div>
          </div>
        </div>
      `;
      })
      .join('');

    subsGrid.querySelectorAll('.view-kitchen-btn').forEach((btn) => {
      btn.addEventListener('click', (e) => {
        const pId = (e.currentTarget as HTMLElement).getAttribute('data-prov-id');
        if (pId) navigate(`#/providers/${pId}`);
      });
    });
  };

  fetchSubs();
}
