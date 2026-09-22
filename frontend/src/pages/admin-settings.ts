import {
  getAdminFeeSettings,
  updateAdminFeeSettings,
} from '../api';
import type { AdminFeeSettingsResponse } from '../api';
import { navigate } from '../router';
import { showToast } from '../components/toast';
import { renderNavbar, attachNavbarEvents } from '../components/navbar';
import { renderFooter, attachFooterEvents } from '../components/footer';
import { escapeHtml } from '../utils/sanitize';

export async function renderAdminSettings() {
  const container = document.getElementById('app')!;
  const token = localStorage.getItem('accessToken');
  const role = (localStorage.getItem('userRole') || '').toUpperCase();

  if (!token || role !== 'ADMIN') {
    showToast('Admin authorization required', 'error');
    navigate('/login');
    return;
  }

  container.innerHTML = `
    ${renderNavbar()}
    <main class="main-content" style="padding-top: 88px; padding-bottom: 60px; min-height: 85vh; background: var(--color-neutral-50, #f8fafc);">
      <div style="max-width: 1280px; margin: 0 auto; padding: 0 16px;">
        
        <!-- Header -->
        <div style="display: flex; justify-content: space-between; align-items: flex-end; margin-bottom: 20px; flex-wrap: wrap; gap: 16px;">
          <div>
            <div style="display: flex; align-items: center; gap: 8px; flex-wrap: wrap;">
              <span style="font-size: 12px; font-weight: 700; color: #dc2626; background: #fee2e2; padding: 4px 12px; border-radius: 999px;">
                Admin System Control Panel
              </span>
              <span style="font-size: 12px; font-weight: 600; color: #0284c7; background: #e0f2fe; padding: 4px 10px; border-radius: 999px;">
                Configurable Monetization
              </span>
            </div>
            <h1 class="font-display" style="font-size: clamp(1.75rem, 4vw, 2.25rem); font-weight: 800; color: var(--color-neutral-900); margin-top: 8px; margin-bottom: 4px;">
              Platform & Fee Settings
            </h1>
            <p style="color: var(--color-neutral-600); font-size: clamp(0.875rem, 2vw, 0.95rem); margin: 0;">
              Configure PrimePlate customer platform fees, monitor collected fee analytics, and review configuration audit history.
            </p>
          </div>
        </div>

        <!-- Navigation Tabs -->
        <div style="display: flex; gap: 8px; margin-bottom: 24px; border-bottom: 1px solid var(--color-neutral-200); padding-bottom: 12px; overflow-x: auto;">
          <a href="/admin" class="btn-outline-action" style="font-size: 13px; text-decoration: none; padding: 8px 16px; border-radius: 999px; white-space: nowrap;">
            <i class="fa-solid fa-shield-halved"></i> Provider Approvals
          </a>
          <a href="/admin/earnings" class="btn-outline-action" style="font-size: 13px; text-decoration: none; padding: 8px 16px; border-radius: 999px; white-space: nowrap;">
            <i class="fa-solid fa-wallet"></i> Provider Earnings
          </a>
          <a href="/admin/settings" class="btn-primary-action" style="font-size: 13px; text-decoration: none; padding: 8px 16px; border-radius: 999px; white-space: nowrap; background: var(--color-primary-600);">
            <i class="fa-solid fa-sliders"></i> Platform & Fee Settings
          </a>
        </div>

        <!-- Financial KPI Overview Cards -->
        <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(220px, 1fr)); gap: 16px; margin-bottom: 28px;">
          
          <div style="background: #fff; border: 1px solid var(--color-neutral-200); border-radius: 20px; padding: 20px; box-shadow: 0 4px 12px rgba(0,0,0,0.03);">
            <div style="display: flex; align-items: center; gap: 12px; margin-bottom: 8px;">
              <div style="width: 40px; height: 40px; border-radius: 12px; background: #ecfdf5; color: #059669; display: flex; align-items: center; justify-content: center; font-size: 18px;">
                <i class="fa-solid fa-coins"></i>
              </div>
              <div>
                <span style="color: var(--color-neutral-500); font-size: 12px; font-weight: 600; text-transform: uppercase; letter-spacing: 0.5px;">Platform Fees Collected</span>
                <p style="font-size: 11px; color: var(--color-neutral-400); margin: 0;">Total revenue retained</p>
              </div>
            </div>
            <p id="kpiTotalCollected" class="font-display" style="font-size: clamp(1.5rem, 3vw, 1.85rem); font-weight: 800; color: #1e293b; margin: 8px 0 0 0;">
              <i class="fa-solid fa-spinner fa-spin" style="font-size: 18px;"></i>
            </p>
          </div>

          <div style="background: #fff; border: 1px solid var(--color-neutral-200); border-radius: 20px; padding: 20px; box-shadow: 0 4px 12px rgba(0,0,0,0.03);">
            <div style="display: flex; align-items: center; gap: 12px; margin-bottom: 8px;">
              <div style="width: 40px; height: 40px; border-radius: 12px; background: #eff6ff; color: #2563eb; display: flex; align-items: center; justify-content: center; font-size: 18px;">
                <i class="fa-solid fa-calendar-check"></i>
              </div>
              <div>
                <span style="color: var(--color-neutral-500); font-size: 12px; font-weight: 600; text-transform: uppercase; letter-spacing: 0.5px;">This Month's Fees</span>
                <p style="font-size: 11px; color: var(--color-neutral-400); margin: 0;">Current billing cycle</p>
              </div>
            </div>
            <p id="kpiThisMonth" class="font-display" style="font-size: clamp(1.5rem, 3vw, 1.85rem); font-weight: 800; color: #1e293b; margin: 8px 0 0 0;">
              <i class="fa-solid fa-spinner fa-spin" style="font-size: 18px;"></i>
            </p>
          </div>

          <div style="background: #fff; border: 1px solid var(--color-neutral-200); border-radius: 20px; padding: 20px; box-shadow: 0 4px 12px rgba(0,0,0,0.03);">
            <div style="display: flex; align-items: center; gap: 12px; margin-bottom: 8px;">
              <div style="width: 40px; height: 40px; border-radius: 12px; background: #faf5ff; color: #9333ea; display: flex; align-items: center; justify-content: center; font-size: 18px;">
                <i class="fa-solid fa-receipt"></i>
              </div>
              <div>
                <span style="color: var(--color-neutral-500); font-size: 12px; font-weight: 600; text-transform: uppercase; letter-spacing: 0.5px;">Subscriptions With Fee</span>
                <p style="font-size: 11px; color: var(--color-neutral-400); margin: 0;">Transactions charged</p>
              </div>
            </div>
            <p id="kpiTransactionsCount" class="font-display" style="font-size: clamp(1.5rem, 3vw, 1.85rem); font-weight: 800; color: #1e293b; margin: 8px 0 0 0;">
              <i class="fa-solid fa-spinner fa-spin" style="font-size: 18px;"></i>
            </p>
          </div>

          <div style="background: #fff; border: 1px solid var(--color-neutral-200); border-radius: 20px; padding: 20px; box-shadow: 0 4px 12px rgba(0,0,0,0.03);">
            <div style="display: flex; align-items: center; gap: 12px; margin-bottom: 8px;">
              <div style="width: 40px; height: 40px; border-radius: 12px; background: #fff7ed; color: #ea580c; display: flex; align-items: center; justify-content: center; font-size: 18px;">
                <i class="fa-solid fa-chart-pie"></i>
              </div>
              <div>
                <span style="color: var(--color-neutral-500); font-size: 12px; font-weight: 600; text-transform: uppercase; letter-spacing: 0.5px;">Average Platform Fee</span>
                <p style="font-size: 11px; color: var(--color-neutral-400); margin: 0;">Per billed order</p>
              </div>
            </div>
            <p id="kpiAverageFee" class="font-display" style="font-size: clamp(1.5rem, 3vw, 1.85rem); font-weight: 800; color: #1e293b; margin: 8px 0 0 0;">
              <i class="fa-solid fa-spinner fa-spin" style="font-size: 18px;"></i>
            </p>
          </div>

        </div>

        <!-- Main Form & Live Preview Section -->
        <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(360px, 1fr)); gap: 24px; margin-bottom: 32px;">
          
          <!-- Configuration Card -->
          <div style="background: #fff; border: 1px solid var(--color-neutral-200); border-radius: 24px; padding: 28px; box-shadow: 0 4px 20px rgba(0,0,0,0.04);">
            <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 20px;">
              <div>
                <h2 class="font-display" style="font-size: 20px; font-weight: 800; color: var(--color-neutral-900); margin: 0;">
                  Customer Platform Fee
                </h2>
                <p style="font-size: 13px; color: var(--color-neutral-500); margin: 4px 0 0 0;">
                  PrimePlate platform fee applied directly to student checkout orders.
                </p>
              </div>
              <span id="feeStatusBadge" style="font-size: 12px; font-weight: 700; padding: 4px 12px; border-radius: 999px; background: #f1f5f9; color: #64748b;">
                Disabled
              </span>
            </div>

            <form id="feeSettingsForm" style="display: flex; flex-direction: column; gap: 20px;">
              
              <!-- Enable / Disable Switch -->
              <div style="background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 16px; padding: 18px; display: flex; align-items: center; justify-content: space-between;">
                <div>
                  <label for="feeToggleInput" style="font-size: 14px; font-weight: 700; color: #1e293b; cursor: pointer; display: block;">
                    Enable Platform Fee
                  </label>
                  <p style="font-size: 12px; color: #64748b; margin: 2px 0 0 0;">
                    When enabled, student checkouts add this flat fee. When off, no fee is charged.
                  </p>
                </div>
                <label style="position: relative; display: inline-block; width: 48px; height: 26px; cursor: pointer; flex-shrink: 0;">
                  <input type="checkbox" id="feeToggleInput" style="opacity: 0; width: 0; height: 0;">
                  <span id="feeToggleSlider" style="position: absolute; cursor: pointer; top: 0; left: 0; right: 0; bottom: 0; background-color: #cbd5e1; transition: .3s; border-radius: 26px;">
                    <span style="position: absolute; content: ''; height: 20px; width: 20px; left: 3px; bottom: 3px; background-color: white; transition: .3s; border-radius: 50%; box-shadow: 0 1px 3px rgba(0,0,0,0.2);"></span>
                  </span>
                </label>
              </div>

              <!-- Fee Type -->
              <div>
                <label style="font-size: 13px; font-weight: 700; color: #334155; display: block; margin-bottom: 6px;">
                  Fee Calculation Mode
                </label>
                <div style="display: flex; align-items: center; gap: 10px; background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 12px; padding: 10px 14px;">
                  <span style="font-size: 12px; font-weight: 800; background: #e0f2fe; color: #0369a1; padding: 3px 10px; border-radius: 6px;">
                    FLAT
                  </span>
                  <span style="font-size: 12px; color: #64748b;">
                    Fixed flat rupee amount per subscription order (predictable pricing for students).
                  </span>
                </div>
              </div>

              <!-- Fee Amount -->
              <div>
                <label for="feeAmountInput" style="font-size: 13px; font-weight: 700; color: #334155; display: block; margin-bottom: 6px;">
                  Fee Amount (₹) <span style="color: #ef4444;">*</span>
                </label>
                <div style="position: relative;">
                  <span style="position: absolute; left: 14px; top: 50%; transform: translateY(-50%); font-weight: 700; color: #64748b; font-size: 16px;">₹</span>
                  <input
                    type="number"
                    id="feeAmountInput"
                    min="0"
                    max="500"
                    step="1"
                    required
                    style="width: 100%; box-sizing: border-box; padding: 12px 14px 12px 32px; border: 1px solid #cbd5e1; border-radius: 12px; font-size: 15px; font-weight: 600; color: #1e293b; outline: none;"
                  />
                </div>
                <p style="font-size: 11px; color: #64748b; margin: 4px 0 0 0;">
                  Supported examples: ₹5, ₹10, ₹15. Cannot be negative.
                </p>
              </div>

              <!-- Display Label -->
              <div>
                <label for="feeLabelInput" style="font-size: 13px; font-weight: 700; color: #334155; display: block; margin-bottom: 6px;">
                  Customer Display Label <span style="color: #ef4444;">*</span>
                </label>
                <input
                  type="text"
                  id="feeLabelInput"
                  maxlength="60"
                  required
                  placeholder="PrimePlate Platform Fee"
                  style="width: 100%; box-sizing: border-box; padding: 12px 14px; border: 1px solid #cbd5e1; border-radius: 12px; font-size: 14px; color: #1e293b; outline: none;"
                />
                <p style="font-size: 11px; color: #64748b; margin: 4px 0 0 0;">
                  Customer-facing line item label shown on the checkout breakdown.
                </p>
              </div>

              <!-- Save Action -->
              <div style="display: flex; gap: 12px; align-items: center; margin-top: 8px;">
                <button
                  type="submit"
                  id="saveSettingsBtn"
                  class="btn-primary-action"
                  style="padding: 12px 24px; font-size: 14px; font-weight: 700; border-radius: 12px; display: inline-flex; align-items: center; gap: 8px;"
                >
                  <i class="fa-solid fa-floppy-disk"></i>
                  <span>Save Settings</span>
                </button>
                <span id="saveNotice" style="font-size: 12px; color: #16a34a; display: none;">
                  <i class="fa-solid fa-check"></i> Changes saved
                </span>
              </div>

            </form>
          </div>

          <!-- Live Checkout Preview Card -->
          <div style="background: #fff; border: 1px solid var(--color-neutral-200); border-radius: 24px; padding: 28px; box-shadow: 0 4px 20px rgba(0,0,0,0.04); display: flex; flex-direction: column;">
            <div style="margin-bottom: 16px;">
              <span style="font-size: 11px; font-weight: 700; text-transform: uppercase; color: #ea580c; background: #fff7ed; padding: 4px 10px; border-radius: 999px;">
                Student Experience
              </span>
              <h3 class="font-display" style="font-size: 18px; font-weight: 800; color: var(--color-neutral-900); margin: 8px 0 4px 0;">
                Live Checkout Breakdown Preview
              </h3>
              <p style="font-size: 12px; color: var(--color-neutral-500); margin: 0;">
                Real-time preview of how students will see their order summary based on your settings.
              </p>
            </div>

            <!-- Preview Mockup Box -->
            <div style="background: #f8fafc; border: 1.5px dashed #cbd5e1; border-radius: 16px; padding: 20px; flex: 1; display: flex; flex-direction: column; justify-content: space-between;">
              <div>
                <div style="display: flex; justify-content: space-between; align-items: center; border-bottom: 1px solid #e2e8f0; padding-bottom: 12px; margin-bottom: 12px;">
                  <div>
                    <strong style="font-size: 14px; color: #1e293b; display: block;">Annapurna Deluxe Mess</strong>
                    <span style="font-size: 12px; color: #64748b;">1 Month Pass (30 Days)</span>
                  </div>
                  <span style="font-size: 11px; background: #ffedd5; color: #c2410c; font-weight: 700; padding: 2px 8px; border-radius: 999px;">
                    Full Day
                  </span>
                </div>

                <!-- Breakdown Rows -->
                <div id="previewBreakdownRows" style="display: flex; flex-direction: column; gap: 8px; font-size: 14px;">
                  <!-- Dynamic preview inserted here -->
                </div>
              </div>

              <!-- Preview Pay Button -->
              <div style="margin-top: 20px; padding-top: 14px; border-top: 1px solid #e2e8f0;">
                <button
                  type="button"
                  disabled
                  id="previewPayBtn"
                  style="width: 100%; box-sizing: border-box; padding: 12px; border-radius: 12px; background: #ea580c; color: #fff; font-weight: 700; font-size: 14px; border: none; opacity: 0.9; cursor: not-allowed; display: flex; align-items: center; justify-content: center; gap: 8px;"
                >
                  <i class="fa-solid fa-lock"></i>
                  <span id="previewPayBtnText">Pay with Razorpay (₹2,400)</span>
                </button>
              </div>
            </div>

          </div>

        </div>

        <!-- Audit Log Section -->
        <div style="background: #fff; border: 1px solid var(--color-neutral-200); border-radius: 24px; padding: 28px; box-shadow: 0 4px 20px rgba(0,0,0,0.04);">
          <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 20px; flex-wrap: wrap; gap: 12px;">
            <div>
              <h2 class="font-display" style="font-size: 20px; font-weight: 800; color: var(--color-neutral-900); margin: 0;">
                Configuration Audit History
              </h2>
              <p style="font-size: 13px; color: var(--color-neutral-500); margin: 4px 0 0 0;">
                Track all administrative adjustments to fee toggles, amounts, and customer display labels.
              </p>
            </div>
            <button id="refreshAuditsBtn" class="btn-outline-action" style="font-size: 12px; padding: 6px 14px; border-radius: 8px;">
              <i class="fa-solid fa-rotate"></i> Refresh Audit Log
            </button>
          </div>

          <div style="overflow-x: auto;">
            <table style="width: 100%; border-collapse: collapse; text-align: left; font-size: 13px;">
              <thead>
                <tr style="border-bottom: 2px solid #e2e8f0; color: #64748b; text-transform: uppercase; font-size: 11px; letter-spacing: 0.5px;">
                  <th style="padding: 12px 14px;">Timestamp</th>
                  <th style="padding: 12px 14px;">Admin</th>
                  <th style="padding: 12px 14px;">Setting Key</th>
                  <th style="padding: 12px 14px;">Previous Value</th>
                  <th style="padding: 12px 14px;">New Value</th>
                </tr>
              </thead>
              <tbody id="auditTableBody">
                <tr>
                  <td colspan="5" style="text-align: center; padding: 24px; color: #94a3b8;">
                    <i class="fa-solid fa-spinner fa-spin"></i> Loading audit history...
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>

      </div>
    </main>
    ${renderFooter()}
  `;

  attachNavbarEvents();
  attachFooterEvents();

  // Elements
  const kpiTotalCollected = document.getElementById('kpiTotalCollected');
  const kpiThisMonth = document.getElementById('kpiThisMonth');
  const kpiTransactionsCount = document.getElementById('kpiTransactionsCount');
  const kpiAverageFee = document.getElementById('kpiAverageFee');

  const feeToggleInput = document.getElementById('feeToggleInput') as HTMLInputElement;
  const feeToggleSlider = document.getElementById('feeToggleSlider') as HTMLElement;
  const feeAmountInput = document.getElementById('feeAmountInput') as HTMLInputElement;
  const feeLabelInput = document.getElementById('feeLabelInput') as HTMLInputElement;
  const feeStatusBadge = document.getElementById('feeStatusBadge') as HTMLElement;

  const previewBreakdownRows = document.getElementById('previewBreakdownRows') as HTMLElement;
  const previewPayBtnText = document.getElementById('previewPayBtnText') as HTMLElement;

  const feeSettingsForm = document.getElementById('feeSettingsForm') as HTMLFormElement;
  const saveSettingsBtn = document.getElementById('saveSettingsBtn') as HTMLButtonElement;
  const saveNotice = document.getElementById('saveNotice') as HTMLElement;
  const auditTableBody = document.getElementById('auditTableBody') as HTMLElement;
  const refreshAuditsBtn = document.getElementById('refreshAuditsBtn') as HTMLButtonElement;

  // Update toggle slider visuals
  const updateToggleVisuals = (isChecked: boolean) => {
    if (isChecked) {
      feeToggleSlider.style.backgroundColor = '#16a34a';
      (feeToggleSlider.children[0] as HTMLElement).style.transform = 'translateX(22px)';
      feeStatusBadge.textContent = 'Active (Charging Fee)';
      feeStatusBadge.style.background = '#dcfce7';
      feeStatusBadge.style.color = '#15803d';
    } else {
      feeToggleSlider.style.backgroundColor = '#cbd5e1';
      (feeToggleSlider.children[0] as HTMLElement).style.transform = 'translateX(0px)';
      feeStatusBadge.textContent = 'Disabled (0 Fee)';
      feeStatusBadge.style.background = '#f1f5f9';
      feeStatusBadge.style.color = '#64748b';
    }
  };

  // Update the live preview mockup
  const updateLivePreview = () => {
    const isEnabled = feeToggleInput.checked;
    const amount = Math.max(0, Number(feeAmountInput.value) || 0);
    const label = feeLabelInput.value.trim() || 'PrimePlate Platform Fee';
    const sampleMealPrice = 2400;

    if (isEnabled && amount > 0) {
      const total = sampleMealPrice + amount;
      previewBreakdownRows.innerHTML = `
        <div style="display: flex; justify-content: space-between; align-items: center; color: #475569;">
          <span>Meal Plan Price:</span>
          <span style="font-weight: 600; color: #1e293b;">₹${sampleMealPrice.toLocaleString('en-IN')}</span>
        </div>
        <div style="display: flex; justify-content: space-between; align-items: center; color: #475569;">
          <div style="display: flex; align-items: center; gap: 6px;">
            <span>${escapeHtml(label)}:</span>
            <span style="font-size: 10px; background: #e0f2fe; color: #0284c7; font-weight: 700; padding: 1px 6px; border-radius: 4px;">Flat</span>
          </div>
          <span style="font-weight: 600; color: #1e293b;">+₹${amount.toLocaleString('en-IN')}</span>
        </div>
        <div style="display: flex; justify-content: space-between; align-items: center; border-top: 1px solid #cbd5e1; padding-top: 10px; margin-top: 4px;">
          <span style="font-weight: 800; font-size: 15px; color: #0f172a;">Total Payable:</span>
          <span style="font-weight: 800; font-size: 18px; color: #ea580c;">₹${total.toLocaleString('en-IN')}</span>
        </div>
      `;
      previewPayBtnText.textContent = `Pay with Razorpay (₹${total.toLocaleString('en-IN')})`;
    } else {
      previewBreakdownRows.innerHTML = `
        <div style="display: flex; justify-content: space-between; align-items: center; color: #475569;">
          <span>Meal Plan Price:</span>
          <span style="font-weight: 600; color: #1e293b;">₹${sampleMealPrice.toLocaleString('en-IN')}</span>
        </div>
        <div style="background: #f1f5f9; border-radius: 8px; padding: 8px 10px; font-size: 12px; color: #64748b; margin-top: 4px;">
          <i class="fa-solid fa-circle-info"></i> Platform Fee is currently disabled. PrimeMates pay only the meal plan price. No fee line is shown.
        </div>
        <div style="display: flex; justify-content: space-between; align-items: center; border-top: 1px solid #cbd5e1; padding-top: 10px; margin-top: 8px;">
          <span style="font-weight: 800; font-size: 15px; color: #0f172a;">You Pay:</span>
          <span style="font-weight: 800; font-size: 18px; color: #ea580c;">₹${sampleMealPrice.toLocaleString('en-IN')}</span>
        </div>
      `;
      previewPayBtnText.textContent = `Pay with Razorpay (₹${sampleMealPrice.toLocaleString('en-IN')})`;
    }
  };

  feeToggleInput.addEventListener('change', () => {
    updateToggleVisuals(feeToggleInput.checked);
    updateLivePreview();
  });

  feeAmountInput.addEventListener('input', updateLivePreview);
  feeLabelInput.addEventListener('input', updateLivePreview);

  // Load Admin Settings & Analytics
  const loadData = async () => {
    try {
      const data: AdminFeeSettingsResponse = await getAdminFeeSettings();
      if (!data) return;

      // KPIs
      const analytics = data.analytics || {};
      const totalCollected = analytics.platformFeesCollected ?? analytics.totalCollected ?? 0;
      const monthCollected = analytics.thisMonthPlatformFees ?? analytics.thisMonthCollected ?? 0;
      const countWithFee = analytics.subscriptionsWithFee ?? analytics.transactionsWithFeeCount ?? 0;
      const avgFee = analytics.averagePlatformFee ?? analytics.averageFee ?? 0;

      if (kpiTotalCollected) {
        kpiTotalCollected.textContent = `₹${totalCollected.toLocaleString('en-IN')}`;
      }
      if (kpiThisMonth) {
        kpiThisMonth.textContent = `₹${monthCollected.toLocaleString('en-IN')}`;
      }
      if (kpiTransactionsCount) {
        kpiTransactionsCount.textContent = `${countWithFee}`;
      }
      if (kpiAverageFee) {
        kpiAverageFee.textContent = `₹${Math.round(avgFee).toLocaleString('en-IN')}`;
      }

      // Settings
      const settings = data.settings || {};
      feeToggleInput.checked = Boolean(settings.enabled);
      feeAmountInput.value = String(settings.amount ?? 5);
      feeLabelInput.value = settings.label || 'PrimePlate Platform Fee';

      updateToggleVisuals(feeToggleInput.checked);
      updateLivePreview();

      // Render Audits
      renderAudits(data.audits || []);
    } catch (err: any) {
      showToast(err.message || 'Failed to load fee settings', 'error');
    }
  };

  const renderAudits = (audits: any[]) => {
    if (!audits || audits.length === 0) {
      auditTableBody.innerHTML = `
        <tr>
          <td colspan="5" style="text-align: center; padding: 24px; color: #94a3b8;">
            No configuration changes recorded yet. Default settings active.
          </td>
        </tr>
      `;
      return;
    }

    auditTableBody.innerHTML = audits.map((audit) => {
      const dateStr = audit.createdAt
        ? new Date(audit.createdAt).toLocaleString('en-IN', {
            dateStyle: 'medium',
            timeStyle: 'short',
          })
        : 'N/A';

      const keyLabel = audit.settingKey === 'subscriber_platform_fee_enabled'
        ? 'Fee Enabled'
        : audit.settingKey === 'subscriber_platform_fee_amount'
          ? 'Fee Amount'
          : audit.settingKey === 'subscriber_platform_fee_label'
            ? 'Display Label'
            : audit.settingKey;

      return `
        <tr style="border-bottom: 1px solid #f1f5f9;">
          <td style="padding: 12px 14px; color: #475569; font-weight: 500; white-space: nowrap;">${escapeHtml(dateStr)}</td>
          <td style="padding: 12px 14px; color: #1e293b; font-weight: 600;">${escapeHtml(audit.adminEmail || 'System Admin')}</td>
          <td style="padding: 12px 14px;">
            <span style="background: #f1f5f9; color: #334155; font-size: 11px; font-weight: 700; padding: 2px 8px; border-radius: 6px;">
              ${escapeHtml(keyLabel)}
            </span>
          </td>
          <td style="padding: 12px 14px; color: #94a3b8; font-family: monospace;">${escapeHtml(audit.previousValue ?? 'null')}</td>
          <td style="padding: 12px 14px; color: #16a34a; font-weight: 700; font-family: monospace;">${escapeHtml(audit.newValue ?? '')}</td>
        </tr>
      `;
    }).join('');
  };

  // Form Submit Handler
  feeSettingsForm.addEventListener('submit', async (e) => {
    e.preventDefault();

    const enabled = feeToggleInput.checked;
    const amount = Number(feeAmountInput.value);
    const label = feeLabelInput.value.trim();

    if (isNaN(amount) || amount < 0) {
      showToast('Fee amount must be a non-negative number.', 'error');
      return;
    }

    if (!label) {
      showToast('Customer display label cannot be empty.', 'error');
      return;
    }

    saveSettingsBtn.setAttribute('disabled', 'true');
    saveSettingsBtn.innerHTML = `<i class="fa-solid fa-spinner fa-spin"></i> Saving...`;

    try {
      await updateAdminFeeSettings({
        enabled,
        amount,
        label,
      });

      showToast('Platform fee configuration updated successfully!', 'success');
      saveNotice.style.display = 'inline';
      setTimeout(() => {
        saveNotice.style.display = 'none';
      }, 4000);

      // Reload fresh data and audit logs
      await loadData();
    } catch (err: any) {
      showToast(err.message || 'Failed to update settings', 'error');
    } finally {
      saveSettingsBtn.removeAttribute('disabled');
      saveSettingsBtn.innerHTML = `<i class="fa-solid fa-floppy-disk"></i> <span>Save Settings</span>`;
    }
  });

  refreshAuditsBtn.addEventListener('click', async () => {
    refreshAuditsBtn.innerHTML = `<i class="fa-solid fa-spinner fa-spin"></i> Refreshing...`;
    await loadData();
    refreshAuditsBtn.innerHTML = `<i class="fa-solid fa-rotate"></i> Refresh Audit Log`;
  });

  // Initial load
  loadData();
}
