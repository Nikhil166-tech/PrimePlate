import {
  getAdminProviderEarningsSummaryAndList,
  getAdminProviderEarningsDetail,
  markAdminProviderEarningPaid,
} from '../api';
import { navigate, getPathSegments } from '../router';
import { showToast } from '../components/toast';
import { renderNavbar, attachNavbarEvents } from '../components/navbar';
import { renderFooter, attachFooterEvents } from '../components/footer';
import { escapeHtml } from '../utils/sanitize';

interface EarningsSummary {
  totalCollected: number;
  totalProviderEarnings: number;
  totalPaid: number;
  totalPending: number;
}

interface ProviderItem {
  providerId: string;
  providerName: string;
  city: string;
  totalEarned: number;
  paid: number;
  pending: number;
  lastPaymentDate: string | null;
  earningCount: number;
  pendingCount: number;
}

interface EarningDetail {
  id: string;
  orderReference: string;
  mealPlanTitle: string;
  grossAmount: number;
  platformFee: number;
  providerAmount: number;
  status: string;
  earnedAt: string;
  paidAt: string | null;
  settlementReference: string | null;
  student: {
    id: string;
    name: string;
  };
}

export async function renderAdminEarnings(selectedProviderId?: string) {
  const container = document.getElementById('app')!;
  const token = localStorage.getItem('accessToken');
  const role = (localStorage.getItem('userRole') || '').toUpperCase();

  if (!token || role !== 'ADMIN') {
    showToast('Admin authorization required', 'error');
    navigate('/login');
    return;
  }

  // Detect if providerId is passed or in URL
  const pathParts = getPathSegments();
  const activeProviderId = selectedProviderId || (pathParts[1] === 'earnings' && pathParts[2] ? pathParts[2] : null);

  container.innerHTML = `
    ${renderNavbar()}
    <main class="main-content" style="padding-top: 88px; padding-bottom: 60px; min-height: 85vh; background: var(--color-neutral-50, #f8fafc);">
      <div style="max-width: 1280px; margin: 0 auto; padding: 0 16px;">
        
        <!-- Header -->
        <div style="display: flex; justify-content: space-between; align-items: flex-end; margin-bottom: 20px; flex-wrap: wrap; gap: 16px;">
          <div>
            <div style="display: flex; align-items: center; gap: 8px; flex-wrap: wrap;">
              <span style="font-size: 12px; font-weight: 700; color: #dc2626; background: #fee2e2; padding: 4px 12px; border-radius: 999px;">
                Admin Settlement Control
              </span>
              <span style="font-size: 12px; font-weight: 600; color: #475569; background: #f1f5f9; padding: 4px 10px; border-radius: 999px;">
                Manual External Payout Ledger
              </span>
            </div>
            <h1 class="font-display" style="font-size: clamp(1.75rem, 4vw, 2.25rem); font-weight: 800; color: var(--color-neutral-900); margin-top: 8px; margin-bottom: 4px;">
              Provider Earnings & Settlements
            </h1>
            <p style="color: var(--color-neutral-600); font-size: clamp(0.875rem, 2vw, 0.95rem); margin: 0;">
              View provider balances, inspect transaction-level gross & commission breakdowns, and record settled payouts.
            </p>
          </div>
        </div>

        <!-- Navigation Tabs -->
        <div style="display: flex; gap: 8px; margin-bottom: 24px; border-bottom: 1px solid var(--color-neutral-200); padding-bottom: 12px; overflow-x: auto;">
          <a href="/admin" class="btn-outline-action" style="font-size: 13px; text-decoration: none; padding: 8px 16px; border-radius: 999px; white-space: nowrap;">
            <i class="fa-solid fa-shield-halved"></i> Provider Approvals
          </a>
          <a href="/admin/earnings" class="btn-primary-action" style="font-size: 13px; text-decoration: none; padding: 8px 16px; border-radius: 999px; white-space: nowrap; background: var(--color-primary-600);">
            <i class="fa-solid fa-wallet"></i> Provider Earnings
          </a>
          <a href="/admin/settings" class="btn-outline-action" style="font-size: 13px; text-decoration: none; padding: 8px 16px; border-radius: 999px; white-space: nowrap;">
            <i class="fa-solid fa-sliders"></i> Platform & Fee Settings
          </a>
        </div>

        <!-- Compact Financial Overview Cards -->
        <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(220px, 1fr)); gap: 16px; margin-bottom: 28px;">
          
          <div style="background: #fff; border: 1px solid var(--color-neutral-200); border-radius: 20px; padding: 20px; box-shadow: 0 4px 12px rgba(0,0,0,0.03);">
            <div style="display: flex; align-items: center; gap: 12px; margin-bottom: 8px;">
              <div style="width: 40px; height: 40px; border-radius: 12px; background: #eff6ff; color: #2563eb; display: flex; align-items: center; justify-content: center; font-size: 18px;">
                <i class="fa-solid fa-receipt"></i>
              </div>
              <div>
                <span style="color: var(--color-neutral-500); font-size: 12px; font-weight: 600; text-transform: uppercase; letter-spacing: 0.5px;">Total Collected</span>
                <p style="font-size: 11px; color: var(--color-neutral-400); margin: 0;">Student gross payments</p>
              </div>
            </div>
            <p id="sumTotalCollected" class="font-display" style="font-size: clamp(1.5rem, 3vw, 1.85rem); font-weight: 800; color: #1e293b; margin: 8px 0 0 0;">
              <i class="fa-solid fa-spinner fa-spin" style="font-size: 18px;"></i>
            </p>
          </div>

          <div style="background: #fff; border: 1px solid var(--color-neutral-200); border-radius: 20px; padding: 20px; box-shadow: 0 4px 12px rgba(0,0,0,0.03);">
            <div style="display: flex; align-items: center; gap: 12px; margin-bottom: 8px;">
              <div style="width: 40px; height: 40px; border-radius: 12px; background: #faf5ff; color: #9333ea; display: flex; align-items: center; justify-content: center; font-size: 18px;">
                <i class="fa-solid fa-coins"></i>
              </div>
              <div>
                <span style="color: var(--color-neutral-500); font-size: 12px; font-weight: 600; text-transform: uppercase; letter-spacing: 0.5px;">Total Provider Earnings</span>
                <p style="font-size: 11px; color: var(--color-neutral-400); margin: 0;">Total owed to mess kitchens</p>
              </div>
            </div>
            <p id="sumTotalEarnings" class="font-display" style="font-size: clamp(1.5rem, 3vw, 1.85rem); font-weight: 800; color: #1e293b; margin: 8px 0 0 0;">
              <i class="fa-solid fa-spinner fa-spin" style="font-size: 18px;"></i>
            </p>
          </div>

          <div style="background: #fff; border: 1px solid var(--color-neutral-200); border-radius: 20px; padding: 20px; box-shadow: 0 4px 12px rgba(0,0,0,0.03);">
            <div style="display: flex; align-items: center; gap: 12px; margin-bottom: 8px;">
              <div style="width: 40px; height: 40px; border-radius: 12px; background: #ecfdf5; color: #059669; display: flex; align-items: center; justify-content: center; font-size: 18px;">
                <i class="fa-solid fa-circle-check"></i>
              </div>
              <div>
                <span style="color: var(--color-neutral-500); font-size: 12px; font-weight: 600; text-transform: uppercase; letter-spacing: 0.5px;">Total Paid</span>
                <p style="font-size: 11px; color: var(--color-neutral-400); margin: 0;">Settled provider payouts</p>
              </div>
            </div>
            <p id="sumTotalPaid" class="font-display" style="font-size: clamp(1.5rem, 3vw, 1.85rem); font-weight: 800; color: #059669; margin: 8px 0 0 0;">
              <i class="fa-solid fa-spinner fa-spin" style="font-size: 18px;"></i>
            </p>
          </div>

          <div style="background: #fff; border: 1px solid var(--color-neutral-200); border-radius: 20px; padding: 20px; box-shadow: 0 4px 12px rgba(0,0,0,0.03);">
            <div style="display: flex; align-items: center; gap: 12px; margin-bottom: 8px;">
              <div style="width: 40px; height: 40px; border-radius: 12px; background: #fffbeb; color: #d97706; display: flex; align-items: center; justify-content: center; font-size: 18px;">
                <i class="fa-solid fa-hourglass-half"></i>
              </div>
              <div>
                <span style="color: var(--color-neutral-500); font-size: 12px; font-weight: 600; text-transform: uppercase; letter-spacing: 0.5px;">Total Pending</span>
                <p style="font-size: 11px; color: var(--color-neutral-400); margin: 0;">Awaiting external settlement</p>
              </div>
            </div>
            <p id="sumTotalPending" class="font-display" style="font-size: clamp(1.5rem, 3vw, 1.85rem); font-weight: 800; color: #d97706; margin: 8px 0 0 0;">
              <i class="fa-solid fa-spinner fa-spin" style="font-size: 18px;"></i>
            </p>
          </div>

        </div>

        <!-- Main Dynamic Area: Provider Detail OR Provider List -->
        <div id="adminEarningsContent">
          <div style="padding: 40px 0; text-align: center; color: var(--color-neutral-500);">
            <i class="fa-solid fa-spinner fa-spin fa-2x"></i>
            <p style="margin-top: 12px; font-size: 14px;">Loading provider earnings data...</p>
          </div>
        </div>

      </div>
    </main>

    <!-- Confirmation Modal Container -->
    <div id="settlementModalContainer"></div>

    ${renderFooter()}
  `;

  attachNavbarEvents();
  attachFooterEvents();

  if (activeProviderId) {
    await renderProviderDetailView(activeProviderId);
  } else {
    await renderProvidersListView();
  }
}

/**
 * Renders the list of all providers with their financial status.
 */
async function renderProvidersListView() {
  const contentEl = document.getElementById('adminEarningsContent');
  if (!contentEl) return;

  let searchVal = '';
  let statusVal = 'ALL';

  const loadData = async () => {
    try {
      const resp: any = await getAdminProviderEarningsSummaryAndList({
        search: searchVal || undefined,
        status: statusVal !== 'ALL' ? statusVal : undefined,
      });

      const summary: EarningsSummary = resp.summary || {
        totalCollected: 0,
        totalProviderEarnings: 0,
        totalPaid: 0,
        totalPending: 0,
      };

      const providers: ProviderItem[] = resp.providers || [];

      // Update Summary Cards
      const elCol = document.getElementById('sumTotalCollected');
      const elEarn = document.getElementById('sumTotalEarnings');
      const elPaid = document.getElementById('sumTotalPaid');
      const elPend = document.getElementById('sumTotalPending');

      if (elCol) elCol.innerText = `₹${summary.totalCollected.toLocaleString('en-IN')}`;
      if (elEarn) elEarn.innerText = `₹${summary.totalProviderEarnings.toLocaleString('en-IN')}`;
      if (elPaid) elPaid.innerText = `₹${summary.totalPaid.toLocaleString('en-IN')}`;
      if (elPend) elPend.innerText = `₹${summary.totalPending.toLocaleString('en-IN')}`;

      // Render Providers Table / Stacked Cards
      contentEl.innerHTML = `
        <div style="background: #fff; border: 1px solid var(--color-neutral-200); border-radius: 24px; padding: 24px; box-shadow: 0 4px 16px rgba(0,0,0,0.03);">
          
          <!-- Filters Header -->
          <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 20px; flex-wrap: wrap; gap: 16px;">
            <div>
              <h2 class="font-display" style="font-size: 20px; font-weight: 700; margin: 0 0 4px 0;">
                Provider Accounts & Balances
              </h2>
              <p style="color: var(--color-neutral-600); font-size: 13px; margin: 0;">
                Select a mess kitchen to view individual earnings and execute manual settlement.
              </p>
            </div>

            <!-- Filters -->
            <div style="display: flex; gap: 10px; flex-wrap: wrap; align-items: center; width: 100%; max-width: 480px;">
              <div style="position: relative; flex: 1; min-width: 180px;">
                <i class="fa-solid fa-magnifying-glass" style="position: absolute; left: 12px; top: 50%; transform: translateY(-50%); color: var(--color-neutral-400); font-size: 13px;"></i>
                <input
                  id="providerSearchInput"
                  type="text"
                  placeholder="Search provider or city..."
                  value="${escapeHtml(searchVal)}"
                  style="width: 100%; padding: 8px 12px 8px 34px; border: 1px solid var(--color-neutral-300); border-radius: 12px; font-size: 13px;"
                />
              </div>

              <select id="statusFilterSelect" style="padding: 8px 12px; border: 1px solid var(--color-neutral-300); border-radius: 12px; font-size: 13px; background: #fff;">
                <option value="ALL" ${statusVal === 'ALL' ? 'selected' : ''}>All Statuses</option>
                <option value="PENDING" ${statusVal === 'PENDING' ? 'selected' : ''}>Pending Only</option>
                <option value="PAID" ${statusVal === 'PAID' ? 'selected' : ''}>Paid Only</option>
              </select>
            </div>
          </div>

          <!-- Content: Desktop Table & Mobile Cards -->
          ${providers.length === 0 ? `
            <div style="padding: 48px 16px; text-align: center; color: var(--color-neutral-500);">
              <i class="fa-solid fa-money-check-dollar" style="font-size: 32px; color: var(--color-neutral-300); margin-bottom: 12px;"></i>
              <p style="font-size: 15px; font-weight: 600; margin: 0 0 4px 0;">No provider earnings records found</p>
              <p style="font-size: 13px; color: var(--color-neutral-400); margin: 0;">Adjust search or filter parameters to see accounts.</p>
            </div>
          ` : `
            <!-- Responsive Desktop Table -->
            <div class="desktop-only" style="overflow-x: auto;">
              <table style="width: 100%; border-collapse: collapse; text-align: left; font-size: 14px;">
                <thead>
                  <tr style="border-bottom: 1px solid var(--color-neutral-200); color: var(--color-neutral-500); font-size: 12px; text-transform: uppercase; letter-spacing: 0.5px;">
                    <th style="padding: 12px 16px;">Provider</th>
                    <th style="padding: 12px 16px;">Total Earned</th>
                    <th style="padding: 12px 16px;">Paid</th>
                    <th style="padding: 12px 16px;">Pending</th>
                    <th style="padding: 12px 16px;">Last Settlement</th>
                    <th style="padding: 12px 16px; text-align: right;">Action</th>
                  </tr>
                </thead>
                <tbody>
                  ${providers.map((p) => `
                    <tr style="border-bottom: 1px solid var(--color-neutral-100); transition: background 0.15s;" onmouseover="this.style.background='#f8fafc'" onmouseout="this.style.background='transparent'">
                      <td style="padding: 14px 16px;">
                        <div style="font-weight: 700; color: var(--color-neutral-900); font-size: 14px;">${escapeHtml(p.providerName)}</div>
                        <div style="font-size: 12px; color: var(--color-neutral-500);"><i class="fa-solid fa-location-dot"></i> ${escapeHtml(p.city || 'Location not specified')}</div>
                      </td>
                      <td style="padding: 14px 16px; font-weight: 700; color: var(--color-neutral-800);">
                        ₹${p.totalEarned.toLocaleString('en-IN')}
                        <div style="font-size: 11px; font-weight: 400; color: var(--color-neutral-500);">${p.earningCount} record(s)</div>
                      </td>
                      <td style="padding: 14px 16px; font-weight: 600; color: #059669;">
                        ₹${p.paid.toLocaleString('en-IN')}
                      </td>
                      <td style="padding: 14px 16px;">
                        ${p.pending > 0 ? `
                          <span style="font-weight: 700; color: #d97706; background: #fef3c7; padding: 4px 10px; border-radius: 999px; font-size: 12px; display: inline-flex; align-items: center; gap: 4px;">
                            <i class="fa-solid fa-clock"></i> ₹${p.pending.toLocaleString('en-IN')}
                          </span>
                        ` : `
                          <span style="color: var(--color-neutral-400); font-size: 12px; font-weight: 500;">₹0</span>
                        `}
                      </td>
                      <td style="padding: 14px 16px; font-size: 13px; color: var(--color-neutral-600);">
                        ${p.lastPaymentDate ? new Date(p.lastPaymentDate).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' }) : '<span style="color: var(--color-neutral-400);">None yet</span>'}
                      </td>
                      <td style="padding: 14px 16px; text-align: right;">
                        <button class="btn-primary-action view-provider-btn" data-id="${escapeHtml(p.providerId)}" style="padding: 6px 14px; font-size: 13px; border-radius: 10px;">
                          View Details
                        </button>
                      </td>
                    </tr>
                  `).join('')}
                </tbody>
              </table>
            </div>

            <!-- Mobile Stacked Cards (Under 768px) -->
            <div class="mobile-only" style="display: flex; flex-direction: column; gap: 14px;">
              ${providers.map((p) => `
                <div style="background: var(--color-neutral-50, #f8fafc); border: 1px solid var(--color-neutral-200); border-radius: 16px; padding: 16px;">
                  <div style="display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 10px;">
                    <div>
                      <h3 style="font-size: 16px; font-weight: 700; margin: 0 0 2px 0; color: var(--color-neutral-900);">${escapeHtml(p.providerName)}</h3>
                      <p style="font-size: 12px; color: var(--color-neutral-500); margin: 0;"><i class="fa-solid fa-location-dot"></i> ${escapeHtml(p.city || 'City not specified')}</p>
                    </div>
                    ${p.pending > 0 ? `
                      <span style="font-size: 11px; font-weight: 700; color: #d97706; background: #fef3c7; padding: 2px 8px; border-radius: 6px;">
                        PENDING
                      </span>
                    ` : `
                      <span style="font-size: 11px; font-weight: 700; color: #059669; background: #ecfdf5; padding: 2px 8px; border-radius: 6px;">
                        SETTLED
                      </span>
                    `}
                  </div>

                  <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 8px; margin-bottom: 12px; font-size: 13px;">
                    <div style="background: #fff; padding: 8px 10px; border-radius: 10px; border: 1px solid var(--color-neutral-200);">
                      <div style="font-size: 11px; color: var(--color-neutral-500);">Total Earned</div>
                      <div style="font-weight: 700; color: var(--color-neutral-900);">₹${p.totalEarned.toLocaleString('en-IN')}</div>
                    </div>
                    <div style="background: #fff; padding: 8px 10px; border-radius: 10px; border: 1px solid var(--color-neutral-200);">
                      <div style="font-size: 11px; color: var(--color-neutral-500);">Pending</div>
                      <div style="font-weight: 700; color: #d97706;">₹${p.pending.toLocaleString('en-IN')}</div>
                    </div>
                  </div>

                  <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 12px; font-size: 12px; color: var(--color-neutral-500);">
                    <span>Paid: <strong style="color: #059669;">₹${p.paid.toLocaleString('en-IN')}</strong></span>
                    <span>Last: ${p.lastPaymentDate ? new Date(p.lastPaymentDate).toLocaleDateString('en-IN') : 'None'}</span>
                  </div>

                  <button class="btn-primary-action view-provider-btn" data-id="${escapeHtml(p.providerId)}" style="width: 100%; padding: 8px; font-size: 13px; justify-content: center;">
                    View Details
                  </button>
                </div>
              `).join('')}
            </div>
          `}

        </div>
      `;

      // Attach Search and Filter Events
      const searchInput = document.getElementById('providerSearchInput') as HTMLInputElement;
      if (searchInput) {
        let debounceTimer: any;
        searchInput.addEventListener('input', () => {
          clearTimeout(debounceTimer);
          debounceTimer = setTimeout(() => {
            searchVal = searchInput.value;
            loadData();
          }, 350);
        });
      }

      const statusSelect = document.getElementById('statusFilterSelect') as HTMLSelectElement;
      if (statusSelect) {
        statusSelect.addEventListener('change', () => {
          statusVal = statusSelect.value;
          loadData();
        });
      }

      // Attach View Details Click
      contentEl.querySelectorAll('.view-provider-btn').forEach((btn) => {
        btn.addEventListener('click', (e) => {
          const provId = (e.currentTarget as HTMLElement).getAttribute('data-id');
          if (provId) {
            navigate(`/admin/earnings/${provId}`);
          }
        });
      });

    } catch (err: any) {
      contentEl.innerHTML = `
        <div style="padding: 32px; background: #fff; border-radius: 16px; border: 1px solid #fee2e2; color: #dc2626; text-align: center;">
          <i class="fa-solid fa-triangle-exclamation fa-2x" style="margin-bottom: 12px;"></i>
          <p style="font-weight: 700; margin: 0 0 4px 0;">Failed to load provider earnings</p>
          <p style="font-size: 13px; margin: 0 0 16px 0;">${escapeHtml(err.message || 'Server error')}</p>
          <button class="btn-outline-action" onclick="window.location.reload()" style="font-size: 13px; padding: 6px 16px;">
            <i class="fa-solid fa-rotate-right"></i> Retry
          </button>
        </div>
      `;
    }
  };

  await loadData();
}

/**
 * Renders the detail view for an individual provider with transaction-level ledger.
 */
async function renderProviderDetailView(providerId: string) {
  const contentEl = document.getElementById('adminEarningsContent');
  if (!contentEl) return;

  let statusFilter = 'ALL';

  const loadDetail = async () => {
    try {
      const data: any = await getAdminProviderEarningsDetail(providerId, {
        status: statusFilter !== 'ALL' ? statusFilter : undefined,
      });

      const provider = data.provider || { name: 'Unknown Provider', city: '' };
      const summary = data.summary || { totalEarned: 0, paid: 0, pending: 0 };
      const earnings: EarningDetail[] = data.earnings || [];

      contentEl.innerHTML = `
        <div style="background: #fff; border: 1px solid var(--color-neutral-200); border-radius: 24px; padding: 24px; box-shadow: 0 4px 16px rgba(0,0,0,0.03);">
          
          <!-- Back button & Provider header -->
          <div style="display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 24px; flex-wrap: wrap; gap: 16px;">
            <div>
              <button id="backToProvidersBtn" class="btn-outline-action" style="padding: 6px 14px; font-size: 13px; border-radius: 10px; margin-bottom: 12px; display: inline-flex; align-items: center; gap: 6px;">
                <i class="fa-solid fa-arrow-left"></i> All Providers
              </button>
              <h2 class="font-display" style="font-size: clamp(1.4rem, 3vw, 1.85rem); font-weight: 800; color: var(--color-neutral-900); margin: 0 0 4px 0;">
                ${escapeHtml(provider.name)}
              </h2>
              <p style="color: var(--color-neutral-500); font-size: 13px; margin: 0;">
                <i class="fa-solid fa-location-dot"></i> ${escapeHtml(provider.address || provider.city || 'Address on file')}
                ${provider.phone ? ` &nbsp;•&nbsp; <i class="fa-solid fa-phone"></i> ${escapeHtml(provider.phone)}` : ''}
              </p>
            </div>

            <!-- Provider Balance Badges -->
            <div style="display: flex; gap: 10px; flex-wrap: wrap;">
              <div style="background: var(--color-neutral-50); border: 1px solid var(--color-neutral-200); border-radius: 14px; padding: 10px 16px; text-align: right;">
                <div style="font-size: 11px; color: var(--color-neutral-500); text-transform: uppercase;">Total Earned</div>
                <div style="font-size: 18px; font-weight: 800; color: var(--color-neutral-900);">₹${summary.totalEarned.toLocaleString('en-IN')}</div>
              </div>
              <div style="background: #ecfdf5; border: 1px solid #a7f3d0; border-radius: 14px; padding: 10px 16px; text-align: right;">
                <div style="font-size: 11px; color: #065f46; text-transform: uppercase;">Already Paid</div>
                <div style="font-size: 18px; font-weight: 800; color: #059669;">₹${summary.paid.toLocaleString('en-IN')}</div>
              </div>
              <div style="background: #fffbeb; border: 1px solid #fde68a; border-radius: 14px; padding: 10px 16px; text-align: right;">
                <div style="font-size: 11px; color: #92400e; text-transform: uppercase;">Pending Settlement</div>
                <div style="font-size: 18px; font-weight: 800; color: #d97706;">₹${summary.pending.toLocaleString('en-IN')}</div>
              </div>
            </div>
          </div>

          <!-- Filter Sub-bar -->
          <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 16px; flex-wrap: wrap; gap: 12px; border-top: 1px solid var(--color-neutral-100); padding-top: 16px;">
            <div style="font-size: 14px; font-weight: 700; color: var(--color-neutral-800);">
              Transaction Earnings Ledger (${earnings.length})
            </div>
            
            <div style="display: flex; gap: 8px; align-items: center;">
              <span style="font-size: 12px; color: var(--color-neutral-500);">Filter Status:</span>
              <select id="detailStatusFilter" style="padding: 6px 10px; border: 1px solid var(--color-neutral-300); border-radius: 8px; font-size: 12px; background: #fff;">
                <option value="ALL" ${statusFilter === 'ALL' ? 'selected' : ''}>All</option>
                <option value="PENDING" ${statusFilter === 'PENDING' ? 'selected' : ''}>Pending</option>
                <option value="PAID" ${statusFilter === 'PAID' ? 'selected' : ''}>Paid</option>
              </select>
            </div>
          </div>

          <!-- Transaction List -->
          ${earnings.length === 0 ? `
            <div style="padding: 40px 16px; text-align: center; color: var(--color-neutral-500);">
              <p style="font-size: 14px; margin: 0;">No earning records matching filter.</p>
            </div>
          ` : `
            <!-- Desktop Table -->
            <div class="desktop-only" style="overflow-x: auto;">
              <table style="width: 100%; border-collapse: collapse; text-align: left; font-size: 13px;">
                <thead>
                  <tr style="border-bottom: 1px solid var(--color-neutral-200); color: var(--color-neutral-500); font-size: 11px; text-transform: uppercase;">
                    <th style="padding: 10px 14px;">Date</th>
                    <th style="padding: 10px 14px;">Reference</th>
                    <th style="padding: 10px 14px;">Meal Plan</th>
                    <th style="padding: 10px 14px;">Student</th>
                    <th style="padding: 10px 14px;">Gross</th>
                    <th style="padding: 10px 14px;">Commission</th>
                    <th style="padding: 10px 14px;">Provider Earning</th>
                    <th style="padding: 10px 14px;">Status</th>
                    <th style="padding: 10px 14px; text-align: right;">Action</th>
                  </tr>
                </thead>
                <tbody>
                  ${earnings.map((e) => {
                    const isPaid = (e.status || '').toUpperCase() === 'PAID';
                    const isPending = (e.status || '').toUpperCase() === 'PENDING' || (e.status || '').toUpperCase() === 'ELIGIBLE';
                    return `
                      <tr style="border-bottom: 1px solid var(--color-neutral-100);">
                        <td style="padding: 12px 14px; white-space: nowrap; color: var(--color-neutral-700);">
                          ${new Date(e.earnedAt).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })}
                        </td>
                        <td style="padding: 12px 14px; font-family: monospace; font-size: 11px; color: var(--color-neutral-600);">
                          ${escapeHtml(e.orderReference)}
                        </td>
                        <td style="padding: 12px 14px; font-weight: 600; color: var(--color-neutral-900);">
                          ${escapeHtml(e.mealPlanTitle)}
                        </td>
                        <td style="padding: 12px 14px; color: var(--color-neutral-700);">
                          ${escapeHtml(e.student.name)}
                        </td>
                        <td style="padding: 12px 14px; color: var(--color-neutral-800);">
                          ₹${e.grossAmount.toLocaleString('en-IN')}
                        </td>
                        <td style="padding: 12px 14px; color: var(--color-neutral-500);">
                          ₹${e.platformFee.toLocaleString('en-IN')}
                        </td>
                        <td style="padding: 12px 14px; font-weight: 700; color: #1e293b;">
                          ₹${e.providerAmount.toLocaleString('en-IN')}
                        </td>
                        <td style="padding: 12px 14px;">
                          ${isPaid ? `
                            <span style="font-size: 11px; font-weight: 700; color: #059669; background: #ecfdf5; padding: 2px 8px; border-radius: 6px; display: inline-block;">
                              PAID
                            </span>
                            ${e.paidAt ? `<div style="font-size: 10px; color: var(--color-neutral-400); margin-top: 2px;">${new Date(e.paidAt).toLocaleDateString('en-IN')}</div>` : ''}
                            ${e.settlementReference ? `<div style="font-size: 9px; font-family: monospace; color: var(--color-neutral-500); max-width: 120px; overflow: hidden; text-overflow: ellipsis;">${escapeHtml(e.settlementReference)}</div>` : ''}
                          ` : isPending ? `
                            <span style="font-size: 11px; font-weight: 700; color: #d97706; background: #fef3c7; padding: 2px 8px; border-radius: 6px; display: inline-block;">
                              PENDING
                            </span>
                          ` : `
                            <span style="font-size: 11px; font-weight: 600; color: var(--color-neutral-600); background: var(--color-neutral-100); padding: 2px 8px; border-radius: 6px;">
                              ${escapeHtml(e.status)}
                            </span>
                          `}
                        </td>
                        <td style="padding: 12px 14px; text-align: right; white-space: nowrap;">
                          ${isPending ? `
                            <button
                              class="btn-primary-action mark-paid-trigger-btn"
                              data-earning-id="${escapeHtml(e.id)}"
                              data-amount="${e.providerAmount}"
                              data-provider-name="${escapeHtml(provider.name)}"
                              style="padding: 5px 12px; font-size: 12px; background: #059669; border-radius: 8px;"
                            >
                              <i class="fa-solid fa-check"></i> Mark as Paid
                            </button>
                          ` : isPaid ? `
                            <span style="font-size: 12px; color: #059669; font-weight: 600;">
                              <i class="fa-solid fa-circle-check"></i> Settled
                            </span>
                          ` : `
                            <span style="font-size: 12px; color: var(--color-neutral-400);">-</span>
                          `}
                        </td>
                      </tr>
                    `;
                  }).join('')}
                </tbody>
              </table>
            </div>

            <!-- Mobile Cards Ledger (Under 768px) -->
            <div class="mobile-only" style="display: flex; flex-direction: column; gap: 12px;">
              ${earnings.map((e) => {
                const isPaid = (e.status || '').toUpperCase() === 'PAID';
                const isPending = (e.status || '').toUpperCase() === 'PENDING' || (e.status || '').toUpperCase() === 'ELIGIBLE';
                return `
                  <div style="background: var(--color-neutral-50, #f8fafc); border: 1px solid var(--color-neutral-200); border-radius: 14px; padding: 14px;">
                    <div style="display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 8px;">
                      <div>
                        <div style="font-weight: 700; font-size: 14px; color: var(--color-neutral-900);">${escapeHtml(e.mealPlanTitle)}</div>
                        <div style="font-size: 11px; color: var(--color-neutral-500);">Subscriber: ${escapeHtml(e.student.name)}</div>
                      </div>
                      ${isPaid ? `
                        <span style="font-size: 10px; font-weight: 700; color: #059669; background: #ecfdf5; padding: 2px 6px; border-radius: 4px;">PAID</span>
                      ` : isPending ? `
                        <span style="font-size: 10px; font-weight: 700; color: #d97706; background: #fef3c7; padding: 2px 6px; border-radius: 4px;">PENDING</span>
                      ` : `
                        <span style="font-size: 10px; font-weight: 600; color: var(--color-neutral-600); background: var(--color-neutral-100); padding: 2px 6px; border-radius: 4px;">${escapeHtml(e.status)}</span>
                      `}
                    </div>

                    <div style="display: grid; grid-template-columns: 1fr 1fr 1fr; gap: 6px; margin-bottom: 10px; font-size: 12px;">
                      <div style="background: #fff; padding: 6px; border-radius: 8px; border: 1px solid var(--color-neutral-200);">
                        <span style="font-size: 10px; color: var(--color-neutral-400);">Gross</span>
                        <div style="font-weight: 600;">₹${e.grossAmount}</div>
                      </div>
                      <div style="background: #fff; padding: 6px; border-radius: 8px; border: 1px solid var(--color-neutral-200);">
                        <span style="font-size: 10px; color: var(--color-neutral-400);">Fee</span>
                        <div style="font-weight: 600;">₹${e.platformFee}</div>
                      </div>
                      <div style="background: #fff; padding: 6px; border-radius: 8px; border: 1px solid var(--color-neutral-200);">
                        <span style="font-size: 10px; color: var(--color-neutral-400);">Payable</span>
                        <div style="font-weight: 700; color: #1e293b;">₹${e.providerAmount}</div>
                      </div>
                    </div>

                    <div style="display: flex; justify-content: space-between; align-items: center; font-size: 11px; color: var(--color-neutral-500); margin-bottom: 8px;">
                      <span>Date: ${new Date(e.earnedAt).toLocaleDateString('en-IN')}</span>
                      <span style="font-family: monospace;">${escapeHtml(e.orderReference.slice(0, 16))}...</span>
                    </div>

                    ${isPaid && e.settlementReference ? `
                      <div style="background: #f1f5f9; padding: 6px 10px; border-radius: 6px; font-size: 11px; color: var(--color-neutral-600); margin-bottom: 8px; word-break: break-all;">
                        <strong>Ref:</strong> ${escapeHtml(e.settlementReference)}
                      </div>
                    ` : ''}

                    ${isPending ? `
                      <button
                        class="btn-primary-action mark-paid-trigger-btn"
                        data-earning-id="${escapeHtml(e.id)}"
                        data-amount="${e.providerAmount}"
                        data-provider-name="${escapeHtml(provider.name)}"
                        style="width: 100%; padding: 8px; font-size: 12px; background: #059669; justify-content: center;"
                      >
                        <i class="fa-solid fa-check"></i> Mark as Paid (₹${e.providerAmount})
                      </button>
                    ` : ''}
                  </div>
                `;
              }).join('')}
            </div>
          `}

        </div>
      `;

      // Attach Back Button
      document.getElementById('backToProvidersBtn')?.addEventListener('click', () => {
        navigate('/admin/earnings');
      });

      // Attach Detail Status Filter
      document.getElementById('detailStatusFilter')?.addEventListener('change', (e) => {
        statusFilter = (e.target as HTMLSelectElement).value;
        loadDetail();
      });

      // Attach Mark as Paid Trigger Handlers
      contentEl.querySelectorAll('.mark-paid-trigger-btn').forEach((btn) => {
        btn.addEventListener('click', (e) => {
          const target = e.currentTarget as HTMLElement;
          const earningId = target.getAttribute('data-earning-id')!;
          const amount = Number(target.getAttribute('data-amount') || 0);
          const pName = target.getAttribute('data-provider-name') || provider.name;

          openSettlementConfirmationModal({
            earningId,
            amount,
            providerName: pName,
            onConfirm: async (customRef) => {
              await executeMarkPaid(earningId, customRef);
            },
          });
        });
      });

    } catch (err: any) {
      contentEl.innerHTML = `
        <div style="padding: 32px; background: #fff; border-radius: 16px; border: 1px solid #fee2e2; color: #dc2626; text-align: center;">
          <p style="font-weight: 700; margin: 0 0 4px 0;">Failed to load provider detail</p>
          <p style="font-size: 13px; margin: 0 0 16px 0;">${escapeHtml(err.message || 'Server error')}</p>
          <button class="btn-outline-action" onclick="window.history.back()" style="font-size: 13px; padding: 6px 16px;">
            Go Back
          </button>
        </div>
      `;
    }
  };

  await loadDetail();
}

/**
 * Executes mark-as-paid API request and handles idempotent responses gracefully.
 */
async function executeMarkPaid(earningId: string, customRef?: string) {
  try {
    const res: any = await markAdminProviderEarningPaid(earningId, {
      settlementReference: customRef || undefined,
    });

    if (res?.alreadyPaid) {
      showToast(res.message || 'These earnings have already been marked as paid.', 'info');
    } else {
      showToast('Provider earnings marked as paid.', 'success');
    }

    // Refresh page / view
    const pathParts = getPathSegments();
    const activeProviderId = pathParts[1] === 'earnings' && pathParts[2] ? pathParts[2] : null;
    if (activeProviderId) {
      await renderProviderDetailView(activeProviderId);
    } else {
      await renderProvidersListView();
    }
  } catch (err: any) {
    if (err?.response?.data?.message?.includes('already been marked as paid')) {
      showToast('These earnings have already been marked as paid.', 'info');
    } else {
      showToast(err.message || 'Failed to settle provider earning', 'error');
    }
  }
}

/**
 * Renders the mandatory confirmation dialog modal before settling any earning.
 */
function openSettlementConfirmationModal(opts: {
  earningId: string;
  amount: number;
  providerName: string;
  onConfirm: (settlementRef?: string) => Promise<void>;
}) {
  const modalContainer = document.getElementById('settlementModalContainer')!;
  
  modalContainer.innerHTML = `
    <div id="settlementModalOverlay" style="position: fixed; inset: 0; background: rgba(15, 23, 42, 0.6); backdrop-filter: blur(4px); display: flex; align-items: center; justify-content: center; z-index: 9999; padding: 16px;">
      <div style="background: #fff; border-radius: 20px; width: 100%; max-width: 480px; box-shadow: 0 20px 25px -5px rgba(0, 0, 0, 0.1), 0 10px 10px -5px rgba(0, 0, 0, 0.04); overflow: hidden; animation: modalIn 0.2s ease-out;">
        
        <!-- Modal Header -->
        <div style="padding: 20px 24px; border-bottom: 1px solid var(--color-neutral-200); display: flex; align-items: center; justify-content: space-between;">
          <div style="display: flex; align-items: center; gap: 10px;">
            <div style="width: 36px; height: 36px; border-radius: 10px; background: #ecfdf5; color: #059669; display: flex; align-items: center; justify-content: center; font-size: 16px;">
              <i class="fa-solid fa-money-bill-transfer"></i>
            </div>
            <h3 style="font-size: 18px; font-weight: 800; margin: 0; color: var(--color-neutral-900);">
              Confirm Settlement
            </h3>
          </div>
          <button id="modalCloseXBtn" style="background: none; border: none; font-size: 18px; color: var(--color-neutral-400); cursor: pointer;">
            <i class="fa-solid fa-xmark"></i>
          </button>
        </div>

        <!-- Modal Body -->
        <div style="padding: 24px;">
          <p style="font-size: 15px; font-weight: 600; color: var(--color-neutral-800); margin: 0 0 16px 0;">
            Mark provider earnings as paid?
          </p>

          <div style="background: var(--color-neutral-50); border: 1px solid var(--color-neutral-200); border-radius: 14px; padding: 16px; margin-bottom: 18px;">
            <div style="display: flex; justify-content: space-between; margin-bottom: 8px; font-size: 13px;">
              <span style="color: var(--color-neutral-500);">Provider:</span>
              <strong style="color: var(--color-neutral-900);">${escapeHtml(opts.providerName)}</strong>
            </div>
            <div style="display: flex; justify-content: space-between; font-size: 15px;">
              <span style="color: var(--color-neutral-500); font-weight: 500;">Payable Amount:</span>
              <strong style="color: #059669; font-size: 18px;">₹${opts.amount.toLocaleString('en-IN')}</strong>
            </div>
          </div>

          <div style="margin-bottom: 16px;">
            <label style="display: block; font-size: 12px; font-weight: 700; color: var(--color-neutral-700); margin-bottom: 6px;">
              Internal Settlement Reference (Optional)
            </label>
            <input
              id="modalInternalRefInput"
              type="text"
              placeholder="e.g. PRIMEPLATE-SETTLE-20260915-001"
              style="width: 100%; padding: 10px 12px; border: 1px solid var(--color-neutral-300); border-radius: 10px; font-size: 13px; font-family: monospace;"
            />
            <p style="font-size: 11px; color: var(--color-neutral-500); margin: 4px 0 0 0;">
              Leave blank to auto-generate an internal ledger reference.
            </p>
          </div>

          <!-- Non-automated disclaimer -->
          <div style="display: flex; gap: 8px; background: #eff6ff; border: 1px solid #bfdbfe; border-radius: 10px; padding: 10px; font-size: 12px; color: #1e40af; line-height: 1.4;">
            <i class="fa-solid fa-circle-info" style="margin-top: 2px;"></i>
            <div>
              This action updates PrimePlate's internal ledger to record that this earning has been settled externally. It does not initiate an automated bank/Razorpay transfer.
            </div>
          </div>
        </div>

        <!-- Modal Footer -->
        <div style="padding: 16px 24px; background: var(--color-neutral-50); border-top: 1px solid var(--color-neutral-200); display: flex; justify-content: flex-end; gap: 10px;">
          <button id="modalCancelBtn" class="btn-outline-action" style="padding: 8px 18px; font-size: 13px; border-radius: 10px;">
            Cancel
          </button>
          <button id="modalConfirmBtn" class="btn-primary-action" style="padding: 8px 20px; font-size: 13px; border-radius: 10px; background: #059669;">
            <i class="fa-solid fa-check"></i> Confirm Settlement
          </button>
        </div>

      </div>
    </div>
  `;

  const closeModal = () => {
    document.removeEventListener('keydown', handleEsc);
    modalContainer.innerHTML = '';
  };

  const handleEsc = (e: KeyboardEvent) => {
    if (e.key === 'Escape') closeModal();
  };

  document.addEventListener('keydown', handleEsc);
  document.getElementById('settlementModalOverlay')?.addEventListener('click', (e) => {
    if ((e.target as HTMLElement).id === 'settlementModalOverlay') {
      closeModal();
    }
  });

  document.getElementById('modalCloseXBtn')?.addEventListener('click', closeModal);
  document.getElementById('modalCancelBtn')?.addEventListener('click', closeModal);
  
  document.getElementById('modalConfirmBtn')?.addEventListener('click', async () => {
    const refInput = document.getElementById('modalInternalRefInput') as HTMLInputElement;
    const customRef = refInput?.value?.trim();
    
    const confirmBtn = document.getElementById('modalConfirmBtn') as HTMLButtonElement;
    if (confirmBtn) {
      confirmBtn.disabled = true;
      confirmBtn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Settling...';
    }

    try {
      await opts.onConfirm(customRef);
      closeModal();
    } catch (_) {
      if (confirmBtn) {
        confirmBtn.disabled = false;
        confirmBtn.innerHTML = '<i class="fa-solid fa-check"></i> Confirm Settlement';
      }
    }
  });
}
