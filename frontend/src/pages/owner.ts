import api, {
  getProviderSubscriptionBreaks,
  approveSubscriptionBreak,
  rejectSubscriptionBreak,
  updateProviderBreakSettings,
} from '../api';
import { navigate } from '../router';
import { showToast } from '../components/toast';
import { renderNavbar, attachNavbarEvents } from '../components/navbar';
import { renderFooter, attachFooterEvents } from '../components/footer';
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
  let showEditLocationModal = false;
  let showManagePanel = false;
  let mobileSheet: 'NONE' | 'MANAGE_PG' | 'BREAK_REQUESTS' | 'SUBSCRIBERS' | 'WEEKLY_MENU' | 'REVIEWS' | 'BREAK_SETTINGS' = 'NONE';
  let editingMenu: { dayIdx: number; mealType: string } | null = null;
  let editingMenuValue = '';
  let modalEditLat: number | null = null;
  let modalEditLng: number | null = null;

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

  let providerReviews: any[] = [];
  const fetchProviderReviews = async () => {
    if (!selectedHostel || selectedHostel.approvalStatus !== 'APPROVED') {
      providerReviews = [];
      return;
    }
    try {
      const data: any = await api.get(`/reviews/provider/${selectedHostel.id}`);
      providerReviews = Array.isArray(data) ? data : [];
    } catch (_) {
      providerReviews = [];
    }
  };

  let providerBreakRequests: any[] = [];
  let breakRequestsLoading = false;

  const fetchProviderBreakRequests = async () => {
    if (!selectedHostel || selectedHostel.approvalStatus !== 'APPROVED') {
      providerBreakRequests = [];
      breakRequestsLoading = false;
      return;
    }
    breakRequestsLoading = true;
    try {
      const data: any = await getProviderSubscriptionBreaks(selectedHostel.id);
      providerBreakRequests = Array.isArray(data) ? data : [];
    } catch (_) {
      providerBreakRequests = [];
    } finally {
      breakRequestsLoading = false;
    }
  };

  await fetchLiveSubs();
  await fetchWeeklyMenus();
  await fetchProviderReviews();
  await fetchProviderBreakRequests();

  const render = () => {
    const totalSubscribersCount = liveSubs.length;
    const totalRevenue = liveSubs.reduce(
      (sum, s) => sum + (typeof s.amountPaid === 'number' && !isNaN(s.amountPaid) ? s.amountPaid : 0),
      0,
    );

    const netEarnings = totalRevenue;
    const activeSubscribersCount = liveSubs.filter((s) => (s.status || '').toUpperCase() === 'ACTIVE').length;

    const subSearchQueryLower = subscriberSearchQuery.toLowerCase().trim();
    const filteredSubscribers = liveSubs.filter((sub) => {
      if (!subSearchQueryLower) return true;
      const name = (sub.student?.name || sub.student?.email || '').toLowerCase();
      const phone = (sub.student?.phone || '').toLowerCase();
      const plan = (sub.mealPlan?.title || sub.planType || '').toLowerCase();
      return name.includes(subSearchQueryLower) || phone.includes(subSearchQueryLower) || plan.includes(subSearchQueryLower);
    });

    const getMenuItem = (dayIdx: number, mealType: string): string => {
      const found = weeklyMenus.find((m) => Number(m.dayOfWeek) === dayIdx && m.mealType === mealType);
      return found?.menuItems || 'No menu available';
    };

    const getSubStatusStyle = (status: string): string => {
      const st = (status || '').toUpperCase();
      if (st === 'ACTIVE') return 'background: var(--color-success-50); color: var(--color-success-600); border: 1px solid #bbf7d0;';
      if (st === 'PAUSED') return 'background: #fef3c7; color: #d97706; border: 1px solid #fde68a;';
      if (st === 'CANCELLED') return 'background: #fee2e2; color: #dc2626; border: 1px solid #fca5a5;';
      return 'background: var(--color-neutral-100); color: var(--color-neutral-600); border: 1px solid var(--color-neutral-200);';
    };

    const monthlyPriceNum = Number(selectedHostel?.monthlyPrice || 2999);

    const isNewProvider = hostels.length === 0;
    const isPending = selectedHostel && selectedHostel.approvalStatus === 'PENDING';

    const userEmail = localStorage.getItem('userEmail') || 'Provider';
    const ownerName = localStorage.getItem('userName') || userEmail.split('@')[0];
    const ownerPhone = localStorage.getItem('userPhone') || 'Not available';

    // Reusable Content Generators for Sections & Modals
    const renderManagePgContent = () => `
      <div style="display: flex; flex-direction: column; gap: 12px;">
        <div style="display: flex; justify-content: space-between; align-items: center; gap: 10px; padding: 12px 14px; background: var(--color-neutral-50); border: 1px solid var(--color-neutral-200); border-radius: 14px; flex-wrap: wrap;">
          <div>
            <span style="font-size: 11px; font-weight: 700; color: var(--color-neutral-500); text-transform: uppercase; display: block; margin-bottom: 2px;">GPS Location</span>
            <span style="font-size: 13px; font-weight: 600; color: #059669; display: inline-flex; align-items: center; gap: 4px;">
              <i class="fa-solid fa-circle-check"></i> ${selectedHostel?.latitude && selectedHostel?.longitude ? 'Location saved' : 'Location not set'}
            </span>
          </div>
          <button type="button" class="open-edit-location-modal-btn btn-outline-action" style="padding: 8px 14px; font-size: 12px; font-weight: 700; background: #fff; border-radius: 8px; min-height: 40px; cursor: pointer;">
            <i class="fa-solid fa-location-crosshairs"></i> Update Location
          </button>
        </div>

        <div style="display: flex; justify-content: space-between; align-items: center; gap: 10px; padding: 12px 14px; background: var(--color-neutral-50); border: 1px solid var(--color-neutral-200); border-radius: 14px; flex-wrap: wrap;">
          <div>
            <span style="font-size: 11px; font-weight: 700; color: var(--color-neutral-500); text-transform: uppercase; display: block; margin-bottom: 2px;">Subscription Price</span>
            <span style="font-size: 15px; font-weight: 800; color: var(--color-neutral-900);">₹${monthlyPriceNum.toLocaleString('en-IN')} / month</span>
          </div>
          <button type="button" class="open-edit-price-btn btn-outline-action" style="padding: 8px 14px; font-size: 12px; font-weight: 700; background: #fff; border-radius: 8px; min-height: 40px; cursor: pointer;">
            <i class="fa-solid fa-pen-to-square"></i> Change Price
          </button>
        </div>

        <div style="display: flex; justify-content: space-between; align-items: center; gap: 10px; padding: 12px 14px; background: var(--color-neutral-50); border: 1px solid var(--color-neutral-200); border-radius: 14px; flex-wrap: wrap;">
          <div>
            <span style="font-size: 11px; font-weight: 700; color: var(--color-neutral-500); text-transform: uppercase; display: block; margin-bottom: 2px;">Student Capacity</span>
            <span style="font-size: 13px; font-weight: 600; color: var(--color-neutral-800);">👥 ${totalSubscribersCount} / ${selectedHostel?.totalCapacity ?? 50} students</span>
          </div>
          <button type="button" class="edit-capacity-btn btn-outline-action" style="padding: 8px 14px; font-size: 12px; font-weight: 700; background: #fff; border-radius: 8px; min-height: 40px; cursor: pointer;">
            <i class="fa-solid fa-users-gear"></i> Manage Capacity
          </button>
        </div>

        <div style="display: flex; justify-content: space-between; align-items: center; gap: 10px; padding: 12px 14px; background: var(--color-neutral-50); border: 1px solid var(--color-neutral-200); border-radius: 14px; flex-wrap: wrap;">
          <div>
            <span style="font-size: 11px; font-weight: 700; color: var(--color-neutral-500); text-transform: uppercase; display: block; margin-bottom: 2px;">Kitchen Status</span>
            <span style="font-size: 13px; font-weight: 700; color: ${selectedHostel?.acceptingSubscriptions !== false ? '#059669' : '#dc2626'};">
              ${selectedHostel?.acceptingSubscriptions !== false ? '🟢 Kitchen OPEN' : '🔴 Kitchen CLOSED'}
            </span>
          </div>
          <button type="button" class="toggle-open-btn btn-outline-action" style="padding: 8px 14px; font-size: 12px; font-weight: 700; background: #fff; border-radius: 8px; min-height: 40px; cursor: pointer;">
            <i class="fa-solid ${selectedHostel?.acceptingSubscriptions !== false ? 'fa-door-closed' : 'fa-door-open'}"></i> ${selectedHostel?.acceptingSubscriptions !== false ? 'Close Kitchen' : 'Open Kitchen'}
          </button>
        </div>

        <div style="display: flex; justify-content: space-between; align-items: center; gap: 10px; padding: 12px 14px; background: #fff7ed; border: 1px solid #ffedd5; border-radius: 14px; flex-wrap: wrap;">
          <div>
            <span style="font-size: 11px; font-weight: 700; color: #c2410c; text-transform: uppercase; display: block; margin-bottom: 2px;">Subscription Breaks</span>
            <span style="font-size: 13px; font-weight: 700; color: ${selectedHostel?.subscriptionBreaksEnabled ? '#15803d' : '#64748b'};">
              ${selectedHostel?.subscriptionBreaksEnabled ? '● ENABLED (Max 4 Days)' : '● DISABLED'}
            </span>
          </div>
          <button type="button" class="open-break-settings-sheet-btn btn-outline-action" style="padding: 8px 14px; font-size: 12px; font-weight: 700; background: #fff; border-radius: 8px; min-height: 40px; cursor: pointer;">
            <i class="fa-solid fa-sliders"></i> Configure Settings
          </button>
        </div>
      </div>
    `;

    const renderBreakRequestsContent = () => `
      <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 14px;">
        <span style="font-size: 12px; font-weight: 700; background: #ffedd5; color: #c2410c; padding: 4px 12px; border-radius: 999px;">
          ${providerBreakRequests.filter((r) => r.status === 'PENDING').length} Pending Requests
        </span>
      </div>
      ${
        breakRequestsLoading
          ? `<div style="text-align: center; padding: 36px;"><i class="fa-solid fa-spinner fa-spin" style="font-size: 24px; color: var(--color-primary-600);"></i></div>`
          : providerBreakRequests.length === 0
          ? `<div style="text-align: center; padding: 32px; background: var(--color-neutral-50); border: 1px dashed var(--color-neutral-300); border-radius: 16px;">
              <i class="fa-solid fa-inbox" style="font-size: 28px; color: var(--color-neutral-400); margin-bottom: 8px;"></i>
              <p style="font-size: 14px; color: var(--color-neutral-600); margin: 0;">No subscription break requests submitted yet.</p>
            </div>`
          : `<div style="display: flex; flex-direction: column; gap: 12px;">
              ${providerBreakRequests
                .map((r) => {
                  const isPending = r.status === 'PENDING';
                  const isApproved = r.status === 'APPROVED';
                  const isRejected = r.status === 'REJECTED';

                  let statusBadgeHtml = '';
                  if (isPending) {
                    statusBadgeHtml = `<span style="font-size: 11px; font-weight: 700; padding: 3px 8px; border-radius: 6px; background: #fef3c7; color: #d97706;">PENDING</span>`;
                  } else if (isApproved) {
                    statusBadgeHtml = `<span style="font-size: 11px; font-weight: 700; padding: 3px 8px; border-radius: 6px; background: #dcfce7; color: #15803d;">Approved ✅</span>`;
                  } else if (isRejected) {
                    statusBadgeHtml = `<span style="font-size: 11px; font-weight: 700; padding: 3px 8px; border-radius: 6px; background: #fee2e2; color: #b91c1c;">Rejected</span>`;
                  }

                  return `
                    <div style="background: var(--color-neutral-50); border: 1px solid var(--color-neutral-200); border-radius: 14px; padding: 16px; display: flex; flex-direction: column; gap: 10px;">
                      <div style="display: flex; justify-content: space-between; align-items: flex-start; flex-wrap: wrap; gap: 8px;">
                        <div>
                          <div style="display: flex; align-items: center; gap: 8px; margin-bottom: 2px;">
                            <strong style="font-size: 15px; color: var(--color-neutral-900);">${escapeHtml(r.studentName)}</strong>
                            ${statusBadgeHtml}
                          </div>
                          <span style="font-size: 12px; color: var(--color-neutral-600);"><i class="fa-solid fa-bookmark"></i> ${escapeHtml(r.planTitle)}</span>
                        </div>
                        <span style="font-size: 12px; font-weight: 700; color: var(--color-primary-700); background: #ffedd5; padding: 3px 10px; border-radius: 20px;">
                          Approved Breaks: ${r.approvedBreakDaysCount || 0} / 4 Days
                        </span>
                      </div>

                      <div style="background: #ffffff; border: 1px solid var(--color-neutral-200); border-radius: 10px; padding: 10px 12px; font-size: 13px; display: flex; flex-direction: column; gap: 4px;">
                        <div style="display: flex; justify-content: space-between;">
                          <span style="color: var(--color-neutral-500);">Break Period:</span>
                          <strong style="color: var(--color-neutral-900);">${escapeHtml(r.fromDate)} → ${escapeHtml(r.toDate)} (${r.breakDays} days)</strong>
                        </div>
                        ${r.reason ? `
                          <div style="display: flex; justify-content: space-between;">
                            <span style="color: var(--color-neutral-500);">Reason:</span>
                            <span style="color: var(--color-neutral-800); font-weight: 600;">${escapeHtml(r.reason)}</span>
                          </div>
                        ` : ''}
                        <div style="display: flex; justify-content: space-between; border-top: 1px dashed var(--color-neutral-200); padding-top: 4px; margin-top: 2px;">
                          <span style="color: var(--color-neutral-500);">Subscription Extension:</span>
                          <span style="font-size: 12px;">
                            <span style="text-decoration: line-through; color: var(--color-neutral-400);">${escapeHtml(r.currentEndDate || '')}</span>
                            <i class="fa-solid fa-arrow-right" style="font-size: 10px; margin: 0 4px; color: var(--color-primary-600);"></i>
                            <strong style="color: var(--color-success-600);">${escapeHtml(r.calculatedNewEndDate || '')}</strong>
                          </span>
                        </div>
                      </div>

                      ${
                        isPending
                          ? `<div style="display: flex; gap: 8px; justify-content: flex-end;">
                              <button class="approve-break-btn btn-primary-action" data-req-id="${escapeHtml(r.id)}" style="padding: 8px 16px; font-size: 13px; background: #16a34a; border-color: #16a34a;">
                                <i class="fa-solid fa-check"></i> Approve Break
                              </button>
                              <button class="reject-break-btn btn-outline-action" data-req-id="${escapeHtml(r.id)}" style="padding: 8px 16px; font-size: 13px; color: #dc2626; border-color: #fca5a5; background: #fff;">
                                <i class="fa-solid fa-xmark"></i> Reject
                              </button>
                            </div>`
                          : ''
                      }
                    </div>
                  `;
                })
                .join('')}
            </div>`
      }
    `;

    const renderSubscribersContent = () => `
      <div style="margin-bottom: 14px;">
        <input type="text" class="subscriber-search-input btn-outline-action" style="width: 100%; background: #fff; padding: 10px 14px; font-size: 13px; border-radius: 10px;" placeholder="Search subscribers by name or phone..." value="${escapeHtml(subscriberSearchQuery)}" />
      </div>
      ${
        subscribersLoading
          ? `<div style="text-align: center; padding: 36px;"><i class="fa-solid fa-spinner fa-spin" style="font-size: 24px; color: var(--color-primary-600);"></i></div>`
          : subscribersError
          ? `<div style="text-align: center; padding: 24px;"><p style="color: #dc2626; font-size: 13px;">${escapeHtml(subscribersError)}</p></div>`
          : filteredSubscribers.length === 0
          ? `<div style="text-align: center; padding: 32px; background: var(--color-neutral-50); border: 1px dashed var(--color-neutral-300); border-radius: 16px;">
              <p style="font-size: 13px; color: var(--color-neutral-500); margin: 0;">${subscriberSearchQuery ? 'No subscribers match filter.' : 'No active subscribers.'}</p>
            </div>`
          : `<div style="display: flex; flex-direction: column; gap: 10px; max-height: 480px; overflow-y: auto;">
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

                  return `
                    <div style="background: var(--color-neutral-50); border-radius: 14px; padding: 12px; border: 1px solid var(--color-neutral-200); font-size: 13px;">
                      <div style="display: flex; justify-content: space-between; align-items: flex-start; gap: 8px; margin-bottom: 6px;">
                        <div>
                          <strong style="font-size: 14px; color: var(--color-neutral-900); display: block;">${studentName}</strong>
                          <span style="font-size: 12px; color: var(--color-neutral-500);"><i class="fa-solid fa-phone"></i> ${studentPhone}</span>
                        </div>
                        <span style="font-size: 11px; font-weight: 700; padding: 2px 8px; border-radius: 999px; ${statusBadgeStyle}">${statusUpper}</span>
                      </div>
                      <div style="display: flex; justify-content: space-between; font-size: 12px; color: var(--color-neutral-600);">
                        <span>${planTitle}</span>
                        <strong style="color: var(--color-primary-600);">${amountPaidDisplay}</strong>
                      </div>
                    </div>
                  `;
                })
                .join('')}
            </div>`
      }
    `;

    const renderWeeklyMenuContent = () => `
      <div style="display: flex; flex-direction: column; gap: 14px; max-height: 520px; overflow-y: auto;">
        ${DAYS_OF_WEEK.map(
          (day, dayIdx) => `
          <div style="border-bottom: 1px solid var(--color-neutral-100); padding-bottom: 10px;">
            <strong style="font-size: 13px; color: var(--color-neutral-900); display: block; margin-bottom: 6px;">${day}</strong>
            <div style="display: flex; flex-direction: column; gap: 6px;">
              ${['Breakfast', 'Lunch', 'Dinner'].map((meal) => {
                const currentVal = getMenuItem(dayIdx, meal);
                const isEditing = editingMenu?.dayIdx === dayIdx && editingMenu?.mealType === meal;
                return `
                  <div class="menu-meal-card" style="padding: 8px 10px;">
                    <div class="menu-meal-header">
                      <span class="menu-meal-title ${meal.toLowerCase()}" style="font-size: 11px;">${meal}</span>
                      ${!isEditing ? `
                        <button class="start-edit-menu-btn menu-icon-btn" data-day-idx="${dayIdx}" data-meal="${meal}" title="Edit ${day} ${meal}">
                          <i class="fa-solid fa-pen-to-square"></i>
                        </button>
                      ` : ''}
                    </div>
                    ${isEditing ? `
                      <div style="display: flex; gap: 6px; align-items: center; margin-top: 4px;">
                        <input type="text" id="inlineMenuInput" class="menu-inline-input" value="${escapeHtml(editingMenuValue)}" placeholder="Enter menu items..." autoFocus />
                        <button id="saveInlineMenuBtn" class="btn-icon-save"><i class="fa-solid fa-check"></i></button>
                        <button id="cancelInlineMenuBtn" class="btn-icon-cancel"><i class="fa-solid fa-xmark"></i></button>
                      </div>
                    ` : `
                      <p style="font-size: 12px; color: var(--color-neutral-700); margin: 0;">
                        ${currentVal === 'No menu available' ? '<span style="color: var(--color-neutral-400); font-style: italic;">Click edit to add</span>' : escapeHtml(currentVal)}
                      </p>
                    `}
                  </div>
                `;
              }).join('')}
            </div>
          </div>
        `).join('')}
      </div>
    `;

    const renderReviewsContent = () => `
      <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 14px;">
        <span style="font-size: 13px; font-weight: 700; color: #f59e0b;">
          ⭐ ${(selectedHostel?.rating && Number(selectedHostel.rating) > 0 ? Number(selectedHostel.rating).toFixed(1) : '0.0')} (${providerReviews.length} reviews)
        </span>
      </div>
      ${
        providerReviews.length === 0
          ? `<div style="text-align: center; padding: 32px; background: var(--color-neutral-50); border: 1px dashed var(--color-neutral-300); border-radius: 16px;"><p style="font-size: 13px; color: var(--color-neutral-500); margin: 0;">No reviews written yet.</p></div>`
          : `<div style="display: flex; flex-direction: column; gap: 10px; max-height: 480px; overflow-y: auto;">
              ${providerReviews
                .map((r: any) => `
                  <div style="background: var(--color-neutral-50); border: 1px solid var(--color-neutral-200); border-radius: 12px; padding: 12px;">
                    <div style="display: flex; justify-content: space-between; margin-bottom: 4px;">
                      <strong style="font-size: 13px; color: var(--color-neutral-900);">${escapeHtml(r.student?.name || 'Subscriber')}</strong>
                      <span style="color: #f59e0b; font-size: 12px;">${'★'.repeat(r.rating)}</span>
                    </div>
                    <p style="font-size: 13px; color: var(--color-neutral-700); margin: 0;">${escapeHtml(r.comment)}</p>
                  </div>
                `).join('')}
            </div>`
      }
    `;

    const renderBreakSettingsContent = () => `
      <div style="display: flex; flex-direction: column; gap: 14px;" class="break-settings-container">
        <div style="display: flex; justify-content: space-between; align-items: center; background: var(--color-neutral-50); padding: 14px; border-radius: 14px; border: 1px solid var(--color-neutral-200);">
          <div>
            <strong style="font-size: 14px; color: var(--color-neutral-900); display: block;">Enable Subscription Breaks</strong>
            <span style="font-size: 12px; color: var(--color-neutral-500);">Allow PrimeMates on 1-Month plans to request breaks (max 4 days)</span>
          </div>
          <label class="toggle-switch">
            <input type="checkbox" class="subscription-breaks-toggle-input" ${selectedHostel?.subscriptionBreaksEnabled ? 'checked' : ''} />
            <span class="toggle-slider"></span>
          </label>

        </div>

        <button class="save-break-settings-btn btn-primary-action" style="width: 100%; justify-content: center; padding: 12px; font-size: 14px;">
          <i class="fa-solid fa-floppy-disk"></i> Save Settings
        </button>
      </div>
    `;

    container.innerHTML = `
      ${renderNavbar()}
      <main class="main-content" style="padding-top: 88px; padding-bottom: 60px; background: #f8fafc;">
        <div style="max-width: 1280px; margin: 0 auto; padding: 0 24px;">
          <!-- Workspace Header -->
          <div style="display: flex; justify-content: space-between; align-items: flex-end; margin-bottom: 24px; flex-wrap: wrap; gap: 16px;">
            <div>
              <div style="display: inline-flex; align-items: center; gap: 6px; background: var(--color-primary-50); color: var(--color-primary-700); padding: 4px 12px; border-radius: 999px; font-size: 12px; font-weight: 700; margin-bottom: 8px;">
                <i class="fa-solid fa-building-user"></i> Provider Owner Workspace
              </div>
              <h1 class="font-display" style="font-size: 28px; font-weight: 800; color: var(--color-neutral-900);">Hostel & Mess Management</h1>
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
              <div style="max-width: 680px; margin: 20px auto; background: #fff; border: 1px solid var(--color-neutral-200); border-radius: 28px; padding: 40px; box-shadow: 0 12px 36px rgba(0,0,0,0.06); text-align: center;">
                <div style="width: 72px; height: 72px; border-radius: 20px; background: var(--color-primary-100); color: var(--color-primary-600); display: flex; align-items: center; justify-content: center; font-size: 32px; margin: 0 auto 20px;">
                  <i class="fa-solid fa-store"></i>
                </div>
                <h2 class="font-display" style="font-size: 28px; font-weight: 800; color: var(--color-neutral-900); margin-bottom: 8px;">Register Your PG or Hostel Mess</h2>
                <p style="color: var(--color-neutral-600); font-size: 15px; margin-bottom: 28px; line-height: 1.6;">
                  Welcome to PrimePlate! Submit your hostel kitchen details below to apply for verified provider listing.
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
                      <label style="font-size: 13px; font-weight: 700; color: var(--color-neutral-800); display: block; margin-bottom: 6px;">Subscriber Capacity *</label>
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

                  <button type="submit" class="btn-primary-action" style="width: 100%; justify-content: center; padding: 14px; font-size: 16px; margin-top: 8px;">
                    Submit Kitchen Registration
                  </button>
                </form>
              </div>
            `
            : isPending
            ? `
              <div style="max-width: 600px; margin: 40px auto; background: #fff; border: 1px solid #fef08a; border-radius: 28px; padding: 40px; text-align: center; box-shadow: 0 12px 36px rgba(0,0,0,0.04);">
                <div style="width: 64px; height: 64px; border-radius: 50%; background: #fef9c3; color: #ca8a04; display: flex; align-items: center; justify-content: center; font-size: 28px; margin: 0 auto 16px;">
                  <i class="fa-solid fa-clock"></i>
                </div>
                <h3 class="font-display" style="font-size: 24px; font-weight: 800; color: var(--color-neutral-900); margin-bottom: 8px;">Approval Pending</h3>
                <p style="color: var(--color-neutral-600); font-size: 14px; margin-bottom: 24px;">Your kitchen listing for <strong>${escapeHtml(selectedHostel?.name || 'Mess')}</strong> is under review by PrimePlate Admin.</p>
                <button id="refreshStatusBtn" class="btn-primary-action">Check Approval Status</button>
              </div>
            `
            : `
              <!-- Hostels Switcher Bar -->
              ${hostels.length > 1
                ? `<div style="display: flex; gap: 8px; overflow-x: auto; margin-bottom: 20px; padding-bottom: 4px;">
                    ${hostels.map((h) => `
                      <button class="select-hostel-tab-btn btn-outline-action" data-id="${h.id}" style="font-weight: 700; padding: 8px 16px; border-radius: 999px; font-size: 13px; background: ${selectedHostel?.id === h.id ? 'var(--color-primary-600)' : '#fff'}; color: ${selectedHostel?.id === h.id ? '#fff' : 'var(--color-neutral-700)'}; border-color: ${selectedHostel?.id === h.id ? 'var(--color-primary-600)' : 'var(--color-neutral-300)'};">
                        ${escapeHtml(h.name)}
                      </button>
                    `).join('')}
                  </div>`
                : ''
              }

              <!-- Overview Stat Cards -->
              <div class="owner-stats-grid" style="margin-bottom: 24px;">
                <div class="owner-stat-card subscribers">
                  <div class="owner-stat-header">
                    <div class="owner-stat-icon"><i class="fa-solid fa-users"></i></div>
                    <span class="owner-stat-label">Active Subscribers</span>
                  </div>
                  <p class="owner-stat-value">${activeSubscribersCount} / ${selectedHostel?.totalCapacity ?? 50}</p>
                </div>
                <div class="owner-stat-card revenue">
                  <div class="owner-stat-header">
                    <div class="owner-stat-icon"><i class="fa-solid fa-wallet"></i></div>
                    <span class="owner-stat-label">Earnings</span>
                  </div>
                  <p class="owner-stat-value">₹${netEarnings.toLocaleString('en-IN')}</p>
                </div>
                <div class="owner-stat-card rating">
                  <div class="owner-stat-header">
                    <div class="owner-stat-icon"><i class="fa-solid fa-star"></i></div>
                    <span class="owner-stat-label">Rating</span>
                  </div>
                  <p class="owner-stat-value">${(selectedHostel?.rating ?? 0) > 0 ? Number(selectedHostel?.rating).toFixed(1) : '0.0'}</p>
                </div>
              </div>

              <!-- ==========================================================
                   1. MOBILE COMPACT DASHBOARD VIEW (<=768px)
                   ========================================================== -->
              <div class="mobile-only-section" style="margin-bottom: 24px;">
                <!-- Primary PG Card -->
                <div style="background: #fff; border: 1px solid var(--color-neutral-200); border-radius: 20px; padding: 18px; margin-bottom: 16px; box-shadow: 0 4px 12px rgba(0,0,0,0.03);">
                  <div style="display: flex; align-items: flex-start; gap: 12px; margin-bottom: 14px;">
                    <img src="${getSafeImageUrl(selectedHostel?.imageUrl)}" alt="${escapeHtml(selectedHostel?.name || '')}" style="width: 64px; height: 64px; border-radius: 12px; object-fit: cover; flex-shrink: 0; border: 1px solid var(--color-neutral-200);" />
                    <div style="flex: 1; min-width: 0;">
                      <h2 class="font-display" style="font-size: 18px; font-weight: 800; color: var(--color-neutral-900); margin: 0 0 2px 0;">${escapeHtml(selectedHostel?.name || '')}</h2>
                      <p style="font-size: 12px; color: var(--color-neutral-600); margin: 0 0 2px 0;"><i class="fa-solid fa-location-dot" style="color: var(--color-primary-600);"></i> ${escapeHtml(selectedHostel?.address || selectedHostel?.city || 'Location not set')}</p>
                      <p style="font-size: 12px; color: var(--color-neutral-500); margin: 0;"><i class="fa-solid fa-phone"></i> ${escapeHtml(selectedHostel?.contactPhone || 'No phone')}</p>
                    </div>
                  </div>

                  <div style="background: var(--color-neutral-50); border: 1px solid var(--color-neutral-200); border-radius: 14px; padding: 10px 14px; margin-bottom: 14px; display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: 8px;">
                    <div>
                      <span style="font-size: 16px; font-weight: 800; color: var(--color-neutral-900);">₹${monthlyPriceNum.toLocaleString('en-IN')}</span>
                      <span style="font-size: 12px; color: var(--color-neutral-500);">/ mo</span>
                    </div>
                    <span style="font-size: 12px; font-weight: 700; padding: 3px 10px; border-radius: 999px; background: ${selectedHostel?.acceptingSubscriptions !== false ? '#d1fae5' : '#fee2e2'}; color: ${selectedHostel?.acceptingSubscriptions !== false ? '#047857' : '#b91c1c'};">
                      ${selectedHostel?.acceptingSubscriptions !== false ? '🟢 Kitchen OPEN' : '🔴 Kitchen CLOSED'}
                    </span>
                    <span style="font-size: 12px; font-weight: 600; color: var(--color-neutral-700);">👥 ${totalSubscribersCount} / ${selectedHostel?.totalCapacity ?? 50}</span>
                  </div>

                  <button class="open-manage-pg-sheet-btn btn-primary-action" style="width: 100%; justify-content: center; padding: 12px; font-size: 14px; font-weight: 700; border-radius: 12px; min-height: 44px;">
                    <i class="fa-solid fa-sliders"></i> Manage PG
                  </button>
                </div>

                <!-- Operational Action Cards -->
                <h4 style="font-size: 12px; font-weight: 700; color: var(--color-neutral-500); text-transform: uppercase; letter-spacing: 0.5px; margin: 0 0 10px 4px;">Pending Actions & Operations</h4>

                <div style="display: flex; flex-direction: column; gap: 10px;">
                  <div class="compact-action-card">
                    <div>
                      <span style="font-size: 14px; font-weight: 700; color: var(--color-neutral-900); display: block;"><i class="fa-solid fa-plane-departure" style="color: var(--color-primary-600); margin-right: 6px;"></i> Subscription Breaks</span>
                      <span style="font-size: 12px; font-weight: 600; color: ${providerBreakRequests.filter((r) => r.status === 'PENDING').length > 0 ? '#c2410c' : 'var(--color-neutral-500)'};">
                        ${providerBreakRequests.filter((r) => r.status === 'PENDING').length} Pending Requests
                      </span>
                    </div>
                    <button class="open-break-requests-sheet-btn btn-outline-action" style="padding: 8px 14px; font-size: 12px; font-weight: 700; border-radius: 10px; min-height: 40px; background: #fff;">
                      Review Break Requests
                    </button>
                  </div>

                  <div class="compact-action-card">
                    <div>
                      <span style="font-size: 14px; font-weight: 700; color: var(--color-neutral-900); display: block;"><i class="fa-solid fa-users" style="color: #22c55e; margin-right: 6px;"></i> Subscribers</span>
                      <span style="font-size: 12px; font-weight: 600; color: var(--color-neutral-600);">${activeSubscribersCount} Active Subscribers</span>
                    </div>
                    <button class="open-subscribers-sheet-btn btn-outline-action" style="padding: 8px 14px; font-size: 12px; font-weight: 700; border-radius: 10px; min-height: 40px; background: #fff;">
                      View Subscribers
                    </button>
                  </div>

                  <div class="compact-action-card">
                    <div>
                      <span style="font-size: 14px; font-weight: 700; color: var(--color-neutral-900); display: block;"><i class="fa-solid fa-calendar-week" style="color: #0ea5e9; margin-right: 6px;"></i> Weekly Menu</span>
                      <span style="font-size: 12px; font-weight: 600; color: var(--color-neutral-600);">✓ Menu items active</span>
                    </div>
                    <button class="open-weekly-menu-sheet-btn btn-outline-action" style="padding: 8px 14px; font-size: 12px; font-weight: 700; border-radius: 10px; min-height: 40px; background: #fff;">
                      View / Edit Menu
                    </button>
                  </div>

                  <div class="compact-action-card">
                    <div>
                      <span style="font-size: 14px; font-weight: 700; color: var(--color-neutral-900); display: block;"><i class="fa-solid fa-star" style="color: #f59e0b; margin-right: 6px;"></i> Reviews</span>
                      <span style="font-size: 12px; font-weight: 600; color: var(--color-neutral-600);">⭐ ${(selectedHostel?.rating ?? 0) > 0 ? Number(selectedHostel?.rating).toFixed(1) : '0.0'} · ${providerReviews.length} reviews</span>
                    </div>
                    <button class="open-reviews-sheet-btn btn-outline-action" style="padding: 8px 14px; font-size: 12px; font-weight: 700; border-radius: 10px; min-height: 40px; background: #fff;">
                      View Reviews
                    </button>
                  </div>
                </div>
              </div>

              <!-- ==========================================================
                   2. DESKTOP FULL WORKSPACE VIEW (>768px)
                   ========================================================== -->
              <div class="desktop-only-section">
                <!-- Mess Profile Management Card -->
                <div id="messProfileSection" class="owner-section-card" style="background: #fff; border: 1px solid var(--color-neutral-200); border-radius: 20px; padding: 20px; margin-bottom: 24px; box-shadow: 0 4px 12px rgba(0,0,0,0.03);">
                  <div style="display: flex; align-items: flex-start; gap: 14px; margin-bottom: 16px;">
                    <img src="${getSafeImageUrl(selectedHostel?.imageUrl)}" alt="${escapeHtml(selectedHostel?.name || '')}" style="width: 80px; height: 80px; border-radius: 14px; object-fit: cover; flex-shrink: 0; border: 1px solid var(--color-neutral-200);" />
                    <div style="flex: 1; min-width: 0;">
                      <h2 class="font-display" style="font-size: 20px; font-weight: 800; color: var(--color-neutral-900); margin: 0 0 4px 0;">${escapeHtml(selectedHostel?.name || '')}</h2>
                      <p style="font-size: 13px; color: var(--color-neutral-700); margin: 0 0 4px 0;"><i class="fa-solid fa-location-dot" style="color: var(--color-primary-600);"></i> ${escapeHtml(selectedHostel?.address || selectedHostel?.city || 'Location not specified')}</p>
                      <p style="font-size: 13px; color: var(--color-neutral-600); margin: 0;"><i class="fa-solid fa-phone"></i> ${escapeHtml(selectedHostel?.contactPhone || 'No phone')}</p>
                    </div>
                  </div>

                  <div style="background: var(--color-neutral-50); border: 1px solid var(--color-neutral-200); border-radius: 16px; padding: 14px; margin-bottom: 16px;">
                    <div style="display: flex; justify-content: space-between; align-items: center; gap: 10px; margin-bottom: 10px; flex-wrap: wrap;">
                      <div>
                        <span style="font-size: 18px; font-weight: 800; color: var(--color-neutral-900);">₹${monthlyPriceNum.toLocaleString('en-IN')}</span>
                        <span style="font-size: 13px; color: var(--color-neutral-500);">/ month</span>
                      </div>
                      <div style="display: inline-flex; align-items: center; gap: 6px; padding: 4px 12px; border-radius: 999px; font-size: 12px; font-weight: 700; background: ${selectedHostel?.acceptingSubscriptions !== false ? '#d1fae5' : '#fee2e2'}; color: ${selectedHostel?.acceptingSubscriptions !== false ? '#047857' : '#b91c1c'}; border: 1px solid ${selectedHostel?.acceptingSubscriptions !== false ? '#a7f3d0' : '#fca5a5'};">
                        <span>${selectedHostel?.acceptingSubscriptions !== false ? 'Kitchen OPEN' : 'Kitchen CLOSED'}</span>
                      </div>
                    </div>
                  </div>

                  <button id="toggleManagePgBtn" class="btn-primary-action" style="width: 100%; justify-content: center; padding: 12px; font-size: 14px; font-weight: 700; border-radius: 12px; min-height: 44px;">
                    <i class="fa-solid ${showManagePanel ? 'fa-chevron-up' : 'fa-sliders'}"></i> ${showManagePanel ? 'Close Management Panel' : 'Manage PG'}
                  </button>

                  <div id="secondaryManagePanel" style="display: ${showManagePanel ? 'flex' : 'none'}; flex-direction: column; gap: 12px; margin-top: 16px; padding-top: 16px; border-top: 1px solid var(--color-neutral-200);">
                    ${renderManagePgContent()}
                  </div>
                </div>

                <!-- Today's Menu Highlight Card -->
                <div id="todaysMenuSection" style="background: #fff; border: 1px solid var(--color-neutral-200); border-radius: 20px; padding: 20px; margin-bottom: 24px; box-shadow: 0 4px 12px rgba(0,0,0,0.03);">
                  <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 12px;">
                    <h3 class="font-display" style="font-size: 16px; font-weight: 700; color: var(--color-neutral-900); margin: 0;"><i class="fa-solid fa-calendar-day" style="color: var(--color-primary-600);"></i> Today's Menu (${DAYS_OF_WEEK[(new Date().getDay() + 6) % 7]})</h3>
                    <span style="font-size: 12px; color: var(--color-neutral-500);">Auto-updated</span>
                  </div>
                  <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(180px, 1fr)); gap: 12px;">
                    <div style="background: var(--color-neutral-50); border: 1px solid var(--color-neutral-200); border-radius: 12px; padding: 12px;">
                      <span style="color: #d97706; font-weight: 700; font-size: 12px; display: block;">Breakfast</span>
                      <span style="font-size: 13px; color: var(--color-neutral-800); font-weight: 600;">${escapeHtml(getMenuItem((new Date().getDay() + 6) % 7, 'Breakfast'))}</span>
                    </div>
                    <div style="background: var(--color-neutral-50); border: 1px solid var(--color-neutral-200); border-radius: 12px; padding: 12px;">
                      <span style="color: var(--color-primary-600); font-weight: 700; font-size: 12px; display: block;">Lunch</span>
                      <span style="font-size: 13px; color: var(--color-neutral-800); font-weight: 600;">${escapeHtml(getMenuItem((new Date().getDay() + 6) % 7, 'Lunch'))}</span>
                    </div>
                    <div style="background: var(--color-neutral-50); border: 1px solid var(--color-neutral-200); border-radius: 12px; padding: 12px;">
                      <span style="color: #8b5cf6; font-weight: 700; font-size: 12px; display: block;">Dinner</span>
                      <span style="font-size: 13px; color: var(--color-neutral-800); font-weight: 600;">${escapeHtml(getMenuItem((new Date().getDay() + 6) % 7, 'Dinner'))}</span>
                    </div>
                  </div>
                </div>

                <!-- Subscription Breaks Settings Card -->
                <div id="breakSettingsSection" style="background: #fff; border: 1px solid var(--color-neutral-200); border-radius: 20px; padding: 20px; margin-bottom: 24px; box-shadow: 0 4px 12px rgba(0,0,0,0.03);">
                  <h3 class="font-display" style="font-size: 18px; font-weight: 700; color: var(--color-neutral-900); margin-bottom: 16px;"><i class="fa-solid fa-plane-departure" style="color: var(--color-primary-600);"></i> Subscription Breaks Settings</h3>
                  ${renderBreakSettingsContent()}
                </div>

                <!-- Subscription Break Requests Queue -->
                <div id="breakRequestsSection" style="background: #fff; border-radius: 20px; padding: 20px; margin-bottom: 24px; border: 1px solid var(--color-neutral-200); box-shadow: 0 4px 12px rgba(0,0,0,0.03);">
                  <h3 class="font-display" style="font-size: 18px; font-weight: 700; color: var(--color-neutral-900); margin-bottom: 16px;"><i class="fa-solid fa-clock-rotate-left" style="color: var(--color-primary-600);"></i> Subscription Break Requests Queue</h3>
                  ${renderBreakRequestsContent()}
                </div>

                <!-- 2-Column Workspace Grid: Weekly Menu & Subscribers -->
                <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(320px, 1fr)); gap: 24px; margin-bottom: 24px;">
                  <div id="weeklyMenuEditorSection" style="background: #fff; border: 1px solid var(--color-neutral-200); border-radius: 24px; padding: 24px; box-shadow: 0 4px 12px rgba(0,0,0,0.03);">
                    <h3 class="font-display" style="font-size: 18px; font-weight: 700; color: var(--color-neutral-900); margin-bottom: 16px;"><i class="fa-solid fa-calendar-week" style="color: var(--color-primary-600);"></i> Weekly Menu</h3>
                    ${renderWeeklyMenuContent()}
                  </div>

                  <div id="subscribersSection" style="background: #fff; border-radius: 24px; padding: 24px; border: 1px solid var(--color-neutral-200); box-shadow: 0 4px 12px rgba(0,0,0,0.03);">
                    <h3 class="font-display" style="font-size: 18px; font-weight: 700; color: var(--color-neutral-900); margin-bottom: 16px;"><i class="fa-solid fa-users" style="color: var(--color-primary-600);"></i> Subscribers</h3>
                    ${renderSubscribersContent()}
                  </div>
                </div>

                <!-- Reviews Section -->
                <div id="providerReviewsSection" style="background: #fff; border: 1px solid var(--color-neutral-200); border-radius: 24px; padding: 24px; box-shadow: 0 4px 12px rgba(0,0,0,0.03);">
                  <h3 class="font-display" style="font-size: 18px; font-weight: 700; color: var(--color-neutral-900); margin-bottom: 16px;"><i class="fa-solid fa-star" style="color: #f59e0b;"></i> Provider Reviews</h3>
                  ${renderReviewsContent()}
                </div>
              </div>
            `
          }
        </div>
      </main>

      <!-- Mobile Bottom Sheet Overlays -->
      ${mobileSheet !== 'NONE' ? `
        <div class="mobile-bottom-sheet-overlay" id="mobileSheetOverlay">
          <div class="mobile-bottom-sheet-content">
            <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 18px; border-bottom: 1px solid var(--color-neutral-200); padding-bottom: 12px;">
              <h3 class="font-display" style="font-size: 20px; font-weight: 800; color: var(--color-neutral-900); margin: 0;">
                ${mobileSheet === 'MANAGE_PG' ? 'Manage PG' :
                  mobileSheet === 'BREAK_REQUESTS' ? 'Subscription Break Requests' :
                  mobileSheet === 'SUBSCRIBERS' ? 'Subscribers' :
                  mobileSheet === 'WEEKLY_MENU' ? 'Weekly Menu Editor' :
                  mobileSheet === 'REVIEWS' ? 'Provider Reviews' :
                  'Subscription Breaks Settings'}
              </h3>
              <button class="close-mobile-sheet-btn" style="background: none; border: none; font-size: 24px; cursor: pointer; color: var(--color-neutral-500); padding: 4px 8px;">&times;</button>
            </div>
            ${
              mobileSheet === 'MANAGE_PG' ? renderManagePgContent() :
              mobileSheet === 'BREAK_REQUESTS' ? renderBreakRequestsContent() :
              mobileSheet === 'SUBSCRIBERS' ? renderSubscribersContent() :
              mobileSheet === 'WEEKLY_MENU' ? renderWeeklyMenuContent() :
              mobileSheet === 'REVIEWS' ? renderReviewsContent() :
              renderBreakSettingsContent()
            }
          </div>
        </div>
      ` : ''}

      <!-- Modal: Add New Hostel Listing -->
      <div id="hostelModal" style="display: ${showModal ? 'flex' : 'none'}; position: fixed; inset: 0; background: rgba(0,0,0,0.5); align-items: center; justify-content: center; z-index: 2000; padding: 20px;">
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
      <div id="editPriceModal" style="display: ${showEditPriceModal ? 'flex' : 'none'}; position: fixed; inset: 0; background: rgba(0,0,0,0.55); align-items: center; justify-content: center; z-index: 2000; padding: 20px;">
        <div style="background: #fff; border-radius: 24px; max-width: 440px; width: 100%; padding: 32px; box-shadow: 0 20px 40px rgba(0,0,0,0.2);">
          <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 20px;">
            <h3 class="font-display" style="font-size: 20px; font-weight: 800; color: var(--color-neutral-900);">Update Monthly Subscription</h3>
            <button id="closeEditPriceModalBtn" style="background: none; border: none; font-size: 20px; cursor: pointer; color: var(--color-neutral-500);">&times;</button>
          </div>

          <form id="editPriceForm" style="display: flex; flex-direction: column; gap: 16px;">
            <div>
              <label style="font-size: 13px; font-weight: 700; color: var(--color-neutral-800); display: block; margin-bottom: 6px;">Monthly Price (₹) *</label>
              <input type="number" id="mPriceInput" class="btn-outline-action" style="width: 100%; background: #fff; padding: 12px 16px; font-size: 15px;" value="${monthlyPriceNum}" placeholder="e.g. 2999" min="1" required />
            </div>

            <div style="display: flex; justify-content: flex-end; gap: 12px; margin-top: 12px;">
              <button type="button" id="cancelEditPriceBtn" class="btn-outline-action" style="padding: 10px 18px; font-size: 14px;">Cancel</button>
              <button type="submit" class="btn-primary-action" style="padding: 10px 20px; font-size: 14px;">Save Changes</button>
            </div>
          </form>
        </div>
      </div>

      <!-- Modal: Update Location & GPS -->
      <div id="editLocationModal" style="display: ${showEditLocationModal ? 'flex' : 'none'}; position: fixed; inset: 0; background: rgba(0,0,0,0.55); align-items: center; justify-content: center; z-index: 2000; padding: 16px;">
        <div style="background: #fff; border-radius: 24px; max-width: 480px; width: 100%; padding: 24px; box-shadow: 0 20px 40px rgba(0,0,0,0.25); max-height: 90vh; overflow-y: auto;">
          <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 16px;">
            <h3 class="font-display" style="font-size: 18px; font-weight: 800; color: var(--color-neutral-900); margin: 0;">📍 Update PG Location & GPS</h3>
            <button id="closeEditLocationModalBtn" style="background: none; border: none; font-size: 24px; cursor: pointer; color: var(--color-neutral-500); padding: 4px;">&times;</button>
          </div>

          <form id="editLocationForm" style="display: flex; flex-direction: column; gap: 16px;">
            <div style="background: var(--color-neutral-50); border: 1px solid var(--color-neutral-200); border-radius: 16px; padding: 14px;">
              <label style="font-size: 12px; font-weight: 700; color: var(--color-neutral-800); display: block; margin-bottom: 4px;">GPS Coordinates</label>
              <div style="display: flex; align-items: center; gap: 10px; flex-wrap: wrap;">
                <button type="button" id="mLocationBtn" class="btn-outline-action" style="padding: 8px 14px; font-size: 13px; font-weight: 700; background: #fff;">
                  <i class="fa-solid fa-crosshairs" style="color: var(--color-primary-600);"></i> 📍 Use My Current Location
                </button>
                <span id="mLocationStatus" style="font-size: 12px; color: var(--color-neutral-500);">
                  ${selectedHostel?.latitude && selectedHostel?.longitude ? 'Current GPS: ' + Number(selectedHostel.latitude).toFixed(4) + ', ' + Number(selectedHostel.longitude).toFixed(4) : 'Location coordinates not set'}
                </span>

              </div>
            </div>

            <div style="display: flex; justify-content: flex-end; gap: 12px;">
              <button type="button" id="cancelEditLocationBtn" class="btn-outline-action" style="padding: 10px 18px;">Cancel</button>
              <button type="submit" class="btn-primary-action" style="padding: 10px 20px;">Save Location</button>
            </div>
          </form>
        </div>
      </div>

      ${renderFooter()}
    `;

    attachNavbarEvents();
    attachFooterEvents();

    // Hostels tab switcher
    document.querySelectorAll('.select-hostel-tab-btn').forEach((btn) => {
      btn.addEventListener('click', async (e) => {
        const id = (e.currentTarget as HTMLElement).getAttribute('data-id');
        const found = hostels.find((h) => h.id === id);
        if (found) {
          selectedHostel = found;
          showManagePanel = false;
          mobileSheet = 'NONE';
          await fetchLiveSubs();
          await fetchWeeklyMenus();
          await fetchProviderReviews();
          await fetchProviderBreakRequests();
          render();
        }
      });
    });

    // Mobile Sheet Open Triggers
    document.querySelectorAll('.open-manage-pg-sheet-btn').forEach((btn) => {
      btn.addEventListener('click', () => {
        mobileSheet = 'MANAGE_PG';
        render();
      });
    });

    document.querySelectorAll('.open-break-requests-sheet-btn').forEach((btn) => {
      btn.addEventListener('click', () => {
        mobileSheet = 'BREAK_REQUESTS';
        render();
      });
    });

    document.querySelectorAll('.open-subscribers-sheet-btn').forEach((btn) => {
      btn.addEventListener('click', () => {
        mobileSheet = 'SUBSCRIBERS';
        render();
      });
    });

    document.querySelectorAll('.open-weekly-menu-sheet-btn').forEach((btn) => {
      btn.addEventListener('click', () => {
        mobileSheet = 'WEEKLY_MENU';
        render();
      });
    });

    document.querySelectorAll('.open-reviews-sheet-btn').forEach((btn) => {
      btn.addEventListener('click', () => {
        mobileSheet = 'REVIEWS';
        render();
      });
    });

    document.querySelectorAll('.open-break-settings-sheet-btn').forEach((btn) => {
      btn.addEventListener('click', () => {
        mobileSheet = 'BREAK_SETTINGS';
        render();
      });
    });

    // Mobile Sheet Close Buttons & Overlay Backdrop
    document.querySelectorAll('.close-mobile-sheet-btn').forEach((btn) => {
      btn.addEventListener('click', () => {
        mobileSheet = 'NONE';
        render();
      });
    });

    document.getElementById('mobileSheetOverlay')?.addEventListener('click', (e) => {
      if (e.target === document.getElementById('mobileSheetOverlay')) {
        mobileSheet = 'NONE';
        render();
      }
    });

    // Desktop Toggle Manage PG
    document.getElementById('toggleManagePgBtn')?.addEventListener('click', () => {
      showManagePanel = !showManagePanel;
      render();
    });

    // Location Modal Triggers (Desktop + Mobile)
    document.querySelectorAll('.open-edit-location-modal-btn').forEach((btn) => {
      btn.addEventListener('click', () => {
        showEditLocationModal = true;
        render();
      });
    });

    document.getElementById('closeEditLocationModalBtn')?.addEventListener('click', () => {
      showEditLocationModal = false;
      render();
    });

    document.getElementById('cancelEditLocationBtn')?.addEventListener('click', () => {
      showEditLocationModal = false;
      render();
    });

    // Location Form Submit & GPS
    document.getElementById('mLocationBtn')?.addEventListener('click', () => {
      const statusEl = document.getElementById('mLocationStatus');
      if (statusEl) statusEl.innerText = 'Capturing current location...';
      navigator.geolocation.getCurrentPosition(
        (pos) => {
          modalEditLat = pos.coords.latitude;
          modalEditLng = pos.coords.longitude;
          if (statusEl) statusEl.innerText = `Captured: ${modalEditLat.toFixed(4)}, ${modalEditLng.toFixed(4)}`;
        },
        (err) => {
          if (statusEl) statusEl.innerText = `GPS Error: ${err.message}`;
        },
      );
    });

    const editLocationForm = document.getElementById('editLocationForm') as HTMLFormElement;
    if (editLocationForm) {
      editLocationForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        if (!selectedHostel) return;
        try {
          await api.put(`/providers/${selectedHostel.id}`, {
            latitude: modalEditLat ?? selectedHostel?.latitude,
            longitude: modalEditLng ?? selectedHostel?.longitude,
          });
          if (modalEditLat && selectedHostel) selectedHostel.latitude = modalEditLat;
          if (modalEditLng && selectedHostel) selectedHostel.longitude = modalEditLng;

          showToast('Location updated successfully!', 'success');
          showEditLocationModal = false;
          render();
        } catch (err: any) {
          showToast(err.message || 'Failed to update location', 'error');
        }
      });
    }

    // Price Modal Triggers (Desktop + Mobile)
    document.querySelectorAll('.open-edit-price-btn').forEach((btn) => {
      btn.addEventListener('click', () => {
        showEditPriceModal = true;
        render();
      });
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
        const priceVal = parseFloat((editPriceForm.querySelector('#mPriceInput') as HTMLInputElement).value);
        if (isNaN(priceVal) || priceVal <= 0) {
          showToast('Invalid price amount', 'error');
          return;
        }
        try {
          await api.put(`/providers/${selectedHostel.id}`, { monthlyPrice: priceVal });
          selectedHostel.monthlyPrice = priceVal;
          showToast('Subscription price updated successfully!', 'success');
          showEditPriceModal = false;
          render();
        } catch (err: any) {
          showToast(err.message || 'Failed to update price', 'error');
        }
      });
    }

    // Capacity Triggers (Desktop + Mobile)
    document.querySelectorAll('.edit-capacity-btn').forEach((btn) => {
      btn.addEventListener('click', async () => {
        if (!selectedHostel) return;
        const input = prompt('Enter new total student capacity:', String(selectedHostel.totalCapacity ?? 50));
        if (!input) return;
        const newCap = parseInt(input, 10);
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
    });

    // Kitchen Status Toggle Triggers (Desktop + Mobile)
    document.querySelectorAll('.toggle-open-btn').forEach((btn) => {
      btn.addEventListener('click', async () => {
        if (!selectedHostel) return;
        const nextStatus = selectedHostel.acceptingSubscriptions === false;
        try {
          await api.put(`/providers/${selectedHostel.id}`, { acceptingSubscriptions: nextStatus });
          selectedHostel.acceptingSubscriptions = nextStatus;
          showToast(`Kitchen status updated: ${nextStatus ? 'OPEN' : 'CLOSED'}`, 'info');
          render();
        } catch (err: any) {
          showToast(err.message || 'Failed to update kitchen status', 'error');
        }
      });
    });

    // Break Settings Listeners (Desktop + Mobile)
    document.querySelectorAll('.save-break-settings-btn').forEach((btn) => {
      btn.addEventListener('click', async (e) => {
        if (!selectedHostel) return;
        const parentContainer = (e.currentTarget as HTMLElement).closest('.break-settings-container') || document;
        const toggle = parentContainer.querySelector('.subscription-breaks-toggle-input') as HTMLInputElement;
        const enabled = toggle?.checked ?? false;

        try {
          await updateProviderBreakSettings(selectedHostel.id, enabled);
          selectedHostel.subscriptionBreaksEnabled = enabled;
          showToast(`Subscription Breaks updated (${enabled ? 'ENABLED' : 'DISABLED'})`, 'success');
          render();
        } catch (err: any) {
          showToast(err.message || 'Failed to update break settings', 'error');
        }
      });
    });

    // Subscription Break Approve/Reject Listeners
    document.querySelectorAll('.approve-break-btn').forEach((btn) => {
      btn.addEventListener('click', async (e) => {
        const reqId = (e.currentTarget as HTMLElement).getAttribute('data-req-id');
        if (!reqId) return;

        try {
          await approveSubscriptionBreak(reqId);
          showToast('Subscription break approved! End date extended.', 'success');
          await fetchProviderBreakRequests();
          await fetchLiveSubs();
          render();
        } catch (err: any) {
          showToast(err.message || 'Failed to approve break request', 'error');
        }
      });
    });

    document.querySelectorAll('.reject-break-btn').forEach((btn) => {
      btn.addEventListener('click', async (e) => {
        const reqId = (e.currentTarget as HTMLElement).getAttribute('data-req-id');
        if (!reqId) return;

        if (!confirm('Reject this subscription break request?')) return;

        try {
          await rejectSubscriptionBreak(reqId);
          showToast('Subscription break request rejected.', 'info');
          await fetchProviderBreakRequests();
          render();
        } catch (err: any) {
          showToast(err.message || 'Failed to reject break request', 'error');
        }
      });
    });

    // Subscriber Search Listener
    document.querySelectorAll('.subscriber-search-input').forEach((input) => {
      input.addEventListener('input', (e) => {
        subscriberSearchQuery = (e.target as HTMLInputElement).value;
        render();
      });
    });

    // Weekly Menu Inline Edit Listeners
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

    const cancelInlineMenuBtn = document.getElementById('cancelInlineMenuBtn');
    if (cancelInlineMenuBtn) {
      cancelInlineMenuBtn.addEventListener('click', () => {
        editingMenu = null;
        editingMenuValue = '';
        render();
      });
    }

    const saveInlineMenuBtn = document.getElementById('saveInlineMenuBtn');
    if (saveInlineMenuBtn) {
      saveInlineMenuBtn.addEventListener('click', async () => {
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
          showToast(err.message || 'Failed to update menu', 'error');
        }
      });
    }

    // Modal Triggers for Adding New Hostel
    document.getElementById('openHostelModalBtn')?.addEventListener('click', () => {
      showModal = true;
      render();
    });

    document.getElementById('closeModalBtn')?.addEventListener('click', () => {
      showModal = false;
      render();
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
