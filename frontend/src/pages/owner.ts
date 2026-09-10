import api, {
  getProviderEarningsSummary,
  getProviderEarningsHistory,
  uploadProviderHostelImage,
  replaceProviderHostelImage,
  getMyHostelImages,
  deleteProviderHostelImage,
  getProviderMealQr,
  getProviderTodayCheckIns,
  getProviderSubscriberAttendanceHistory,
  correctProviderCheckIn,
  getProviderRecoveryStats,
  processSubscriptionRecovery,
  updateProviderRecoveryPercentage,
} from '../api';
import { navigate } from '../router';
import { showToast } from '../components/toast';
import { renderNavbar, attachNavbarEvents } from '../components/navbar';
import { renderFooter, attachFooterEvents } from '../components/footer';
import { escapeHtml, getSafeImageUrl } from '../utils/sanitize';
import { mountMealCalendar } from '../components/MealCalendar';

const DAYS_OF_WEEK = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];

interface ImageQueueItem {
  id: string;
  file: File;
  previewUrl: string;
  name: string;
  size: number;
  category: string;
  status: 'WAITING' | 'UPLOADING' | 'SUCCESS' | 'ERROR';
  progress: number;
  errorMessage?: string;
}

export async function renderOwnerPortal() {
  const container = document.getElementById('app')!;
  const token = localStorage.getItem('accessToken');
  const userRole = (localStorage.getItem('userRole') || '').toUpperCase();

  if (!token || (userRole !== 'PROVIDER' && userRole !== 'MEAL_PROVIDER')) {
    showToast('Provider workspace authorization required', 'error');
    navigate('/login');
    return;
  }

  // Render instant loading state so screen never stays static on login form
  container.innerHTML = `
    ${renderNavbar()}
    <main class="main-content" style="padding-top: 88px; min-height: 80vh; display: flex; align-items: center; justify-content: center; background: var(--color-neutral-50);">
      <div style="text-align: center; padding: 48px; background: #fff; border: 1px solid var(--color-neutral-200); border-radius: 24px; box-shadow: 0 10px 30px rgba(0,0,0,0.05); max-width: 420px; width: 90%;">
        <div style="width: 56px; height: 56px; border-radius: 16px; background: var(--color-primary-50); color: var(--color-primary-600); display: flex; align-items: center; justify-content: center; margin: 0 auto 16px; font-size: 24px;">
          <i class="fa-solid fa-spinner fa-spin"></i>
        </div>
        <h3 class="font-display" style="font-size: 18px; font-weight: 700; color: var(--color-neutral-900); margin-bottom: 6px;">Loading Provider Portal...</h3>
        <p style="color: var(--color-neutral-500); font-size: 13px; margin: 0;">Preparing your kitchen dashboard and subscribers.</p>
      </div>
    </main>
  `;
  attachNavbarEvents();

  let hostels: any[] = [];
  let selectedHostel: any = null;
  let showModal = false;
  let showEditPriceModal = false;
  let showEditLocationModal = false;
  let showEditProfileModal = false;
  let showSubscriberDetailsModal = false;
  let selectedSubscriberForDetails: any = null;
  let subscriberAttendanceLoading = false;
  let subscriberAttendanceData: any = null;
  let subscriberAttendanceError: string | null = null;
  let subscriberCalendarUnmount: (() => void) | null = null;
  let showManagePanel = false;
  let mobileSheet: 'NONE' | 'MANAGE_PG' | 'SUBSCRIBERS' | 'WEEKLY_MENU' | 'REVIEWS' | 'EARNINGS_HISTORY' | 'HOSTEL_IMAGES' | 'MEAL_QR' | 'TODAYS_CHECKINS' | 'MEAL_RECOVERY' = 'NONE';
  let recoveryStats: {
    providerId?: string;
    providerName?: string;
    recoveryPercentage?: number;
    missedMealDays?: number;
    recoveryDaysGranted?: number;
    recoveryDaysUsed?: number;
    recoveryDaysRemaining?: number;
    totalRecords?: number;
  } | null = null;
  let recoveryLoading = false;
  let isUpdatingRecoveryPercentage = false;
  let processingRecoverySubId: string | null = null;
  let recoveryProcessResult: { message: string; type: 'success' | 'info' | 'error' } | null = null;
  let mealQrData: { providerId: string; providerName: string; qrToken: string; qrCodeDataUrl: string } | null = null;
  let mealQrLoading = false;
  let todayCheckInsData: {
    today: string;
    summary: { todayCheckIns: number; activeSubscribers: number; notCheckedIn: number };
    subscribers: any[];
  } | null = null;
  let todayCheckInsLoading = false;
  let showCorrectionModal = false;
  let correctionSubTarget: any = null;
  let correctionReasonInput = '';
  let isSubmittingCorrection = false;
  let hostelImages: any[] = [];
  let imagesLoading = false;
  let uploadQueue: ImageQueueItem[] = [];
  let isQueueUploading = false;
  let carouselActiveIndex = 0;
  let lightboxImage: any | null = null;
  let imageToReplace: any | null = null;
  let replaceFile: File | null = null;
  let replacePreviewUrl: string | null = null;
  let replaceCategory: string = 'Hostel';
  let isReplacingImage = false;
  let replaceProgress = 0;
  let replaceErrorMessage: string | null = null;
  let imageToDelete: any | null = null;
  let isDeletingImage = false;
  let editingMenu: { dayIdx: number; mealType: string } | null = null;
  let editingMenuValue = '';
  let modalEditLat: number | null = null;
  let modalEditLng: number | null = null;
  const COMMON_AMENITIES = ['WIFI', 'TV', 'HOT WATER', 'PARKING', 'GYM', 'COOL WATER'];

  const createCustomAmenityRow = (containerId: string, initialValue = '') => {
    const container = document.getElementById(containerId);
    if (!container) return;
    const row = document.createElement('div');
    row.className = 'custom-amenity-row';
    row.style.cssText = 'display: flex; gap: 8px; align-items: center;';
    row.innerHTML = `
      <input type="text" class="custom-amenity-input btn-outline-action" style="flex: 1; background: #fff; padding: 10px 14px; font-size: 13px; min-width: 0;" placeholder="e.g. 24/7 Security" maxlength="50" value="${escapeHtml(initialValue)}" />
      <button type="button" class="remove-amenity-btn btn-outline-action" style="padding: 10px 14px; font-size: 12px; font-weight: 700; color: #dc2626; border-color: #fca5a5; background: #fff; white-space: nowrap;">
        <i class="fa-solid fa-trash"></i> Remove
      </button>
    `;
    row.querySelector('.remove-amenity-btn')?.addEventListener('click', () => {
      row.remove();
    });
    container.appendChild(row);
  };

  const collectAmenitiesFromForm = (formElement: HTMLElement, checkboxName: string, customContainerId: string): string[] => {
    const selected: string[] = [];
    const seen = new Set<string>();

    const checkboxes = formElement.querySelectorAll<HTMLInputElement>(`input[name="${checkboxName}"]:checked`);
    checkboxes.forEach((cb) => {
      const val = cb.value.trim();
      if (val && !seen.has(val.toLowerCase())) {
        seen.add(val.toLowerCase());
        selected.push(val);
      }
    });

    const customInputs = formElement.querySelectorAll<HTMLInputElement>(`#${customContainerId} .custom-amenity-input`);
    customInputs.forEach((inp) => {
      const val = inp.value.trim();
      if (val && !seen.has(val.toLowerCase())) {
        seen.add(val.toLowerCase());
        selected.push(val);
      }
    });

    return selected;
  };
  let earningsSummary: any = {
    totalGross: 0,
    platformFees: 0,
    totalProviderEarnings: 0,
    pendingAmount: 0,
    paidAmount: 0,
    refundedAmount: 0,
  };
  let earningsHistory: any[] = [];
  let earningsLoading = false;

  const fetchHostels = async () => {
    try {
      const data: any = await api.get('/providers/my');
      hostels = Array.isArray(data) ? data : [];
      if (hostels.length > 0) {
        if (!selectedHostel || !hostels.some((h: any) => h.id === selectedHostel.id)) {
          selectedHostel = hostels[0];
        } else {
          selectedHostel = hostels.find((h: any) => h.id === selectedHostel.id) || hostels[0];
        }
      } else {
        selectedHostel = null;
      }
    } catch (err: any) {
      hostels = [];
      selectedHostel = null;
    }
  };

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
    if (!selectedHostel) {
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


  const fetchEarningsData = async () => {
    earningsLoading = true;
    try {
      const [sumData, histData]: any[] = await Promise.all([
        getProviderEarningsSummary(),
        getProviderEarningsHistory(),
      ]);
      earningsSummary = sumData || earningsSummary;
      earningsHistory = Array.isArray(histData) ? histData : [];
    } catch (_) {
      // fallback if not authenticated or error
    } finally {
      earningsLoading = false;
    }
  };

  const fetchHostelImages = async () => {
    if (!selectedHostel) {
      hostelImages = [];
      imagesLoading = false;
      carouselActiveIndex = 0;
      return;
    }
    imagesLoading = true;
    try {
      const data: any = await getMyHostelImages(selectedHostel.id);
      hostelImages = Array.isArray(data) ? data : [];
      if (carouselActiveIndex >= hostelImages.length) {
        carouselActiveIndex = Math.max(0, hostelImages.length - 1);
      }
    } catch (_) {
      hostelImages = [];
      carouselActiveIndex = 0;
    } finally {
      imagesLoading = false;
    }
  };

  const fetchMealQr = async () => {
    if (!selectedHostel) {
      mealQrData = null;
      mealQrLoading = false;
      return;
    }
    mealQrLoading = true;
    try {
      const data: any = await getProviderMealQr(selectedHostel.id);
      mealQrData = data && data.qrToken ? data : null;
    } catch (_) {
      mealQrData = null;
    } finally {
      mealQrLoading = false;
    }
  };

  const fetchTodayCheckIns = async () => {
    if (!selectedHostel) {
      todayCheckInsData = null;
      todayCheckInsLoading = false;
      return;
    }
    todayCheckInsLoading = true;
    try {
      const data: any = await getProviderTodayCheckIns(selectedHostel.id);
      todayCheckInsData = data;
    } catch (_) {
      todayCheckInsData = null;
    } finally {
      todayCheckInsLoading = false;
    }
  };

  const fetchRecoveryStats = async () => {
    if (!selectedHostel) {
      recoveryStats = null;
      recoveryLoading = false;
      return;
    }
    recoveryLoading = true;
    try {
      const data: any = await getProviderRecoveryStats(selectedHostel.id);
      recoveryStats = data?.data !== undefined ? data.data : data;
    } catch (_) {
      recoveryStats = null;
    } finally {
      recoveryLoading = false;
    }
  };

  const fetchSubscriberAttendance = async (subscriptionId: string) => {
    if (!subscriptionId) return;
    subscriberAttendanceLoading = true;
    subscriberAttendanceError = null;
    subscriberAttendanceData = null;
    render();
    try {
      const res: any = await getProviderSubscriberAttendanceHistory(
        subscriptionId,
        selectedHostel?.id,
      );
      subscriberAttendanceData = res.data || res;
    } catch (err: any) {
      subscriberAttendanceError =
        err.response?.data?.message || err.message || 'Unable to load attendance records.';
    } finally {
      subscriberAttendanceLoading = false;
      render();
    }
  };

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

    const formatSubscriberDate = (dateStr?: string | null): string => {
      if (!dateStr) return 'Not available';
      const d = new Date(dateStr);
      if (isNaN(d.getTime())) return escapeHtml(dateStr);
      return d.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });
    };

    const getSubscriberAmount = (sub: any): string => {
      if (!sub) return 'Amount unavailable';
      const rawPaid = sub.amountPaid !== undefined && sub.amountPaid !== null
        ? sub.amountPaid
        : (sub.payment?.amount !== undefined && sub.payment?.amount !== null ? sub.payment.amount : null);

      if (rawPaid !== null && rawPaid !== undefined && !isNaN(Number(rawPaid))) {
        return `₹${Number(rawPaid).toLocaleString('en-IN')}`;
      }
      return 'Amount unavailable';
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
            <span style="font-size: 11px; font-weight: 700; color: var(--color-neutral-500); text-transform: uppercase; display: block; margin-bottom: 2px;">Kitchen Description & Amenities</span>
            <span style="font-size: 13px; font-weight: 600; color: var(--color-neutral-800);">${(selectedHostel?.amenities?.length || 0)} Amenities · ${selectedHostel?.description ? 'Description set' : 'No description'}</span>
          </div>
          <button type="button" class="open-edit-profile-btn btn-outline-action" style="padding: 8px 14px; font-size: 12px; font-weight: 700; background: #fff; border-radius: 8px; min-height: 40px; cursor: pointer;">
            <i class="fa-solid fa-pen-to-square"></i> Edit Profile & Amenities
          </button>
        </div>

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
            <span style="font-size: 13px; font-weight: 600; color: var(--color-neutral-800);">👥 ${totalSubscribersCount} / ${selectedHostel.totalCapacity ?? 50} students</span>
          </div>
          <button type="button" class="edit-capacity-btn btn-outline-action" style="padding: 8px 14px; font-size: 12px; font-weight: 700; background: #fff; border-radius: 8px; min-height: 40px; cursor: pointer;">
            <i class="fa-solid fa-users-gear"></i> Manage Capacity
          </button>
        </div>

        <div style="display: flex; justify-content: space-between; align-items: center; gap: 10px; padding: 12px 14px; background: var(--color-neutral-50); border: 1px solid var(--color-neutral-200); border-radius: 14px; flex-wrap: wrap;">
          <div>
            <span style="font-size: 11px; font-weight: 700; color: var(--color-neutral-500); text-transform: uppercase; display: block; margin-bottom: 2px;">Kitchen Status</span>
            <span style="font-size: 13px; font-weight: 700; color: ${selectedHostel.acceptingSubscriptions !== false ? '#059669' : '#dc2626'};">
              ${selectedHostel.acceptingSubscriptions !== false ? '🟢 Kitchen OPEN' : '🔴 Kitchen CLOSED'}
            </span>
          </div>
          <button type="button" class="toggle-open-btn btn-outline-action" style="padding: 8px 14px; font-size: 12px; font-weight: 700; background: #fff; border-radius: 8px; min-height: 40px; cursor: pointer;">
            <i class="fa-solid ${selectedHostel.acceptingSubscriptions !== false ? 'fa-door-closed' : 'fa-door-open'}"></i> ${selectedHostel.acceptingSubscriptions !== false ? 'Close Kitchen' : 'Open Kitchen'}
          </button>
        </div>

        <!-- Meal Recovery Policy Settings Card -->
        <div style="display: flex; flex-direction: column; gap: 10px; padding: 14px; background: var(--color-neutral-50); border: 1px solid var(--color-neutral-200); border-radius: 14px;">
          <div style="display: flex; justify-content: space-between; align-items: flex-start; flex-wrap: wrap; gap: 8px;">
            <div>
              <span style="font-size: 11px; font-weight: 700; color: var(--color-neutral-500); text-transform: uppercase; display: block; margin-bottom: 2px;">
                Meal Recovery Policy
              </span>
              <span style="font-size: 14px; font-weight: 800; color: var(--color-neutral-900);">
                Current Rate: <strong style="color: var(--color-primary-600); font-size: 16px;">${selectedHostel?.recoveryPercentage ?? recoveryStats?.recoveryPercentage ?? 80}%</strong>
              </span>
            </div>
            <span style="font-size: 11px; font-weight: 700; padding: 3px 8px; border-radius: 999px; background: #ecfdf5; color: #047857; display: inline-flex; align-items: center; gap: 4px;">
              <i class="fa-solid fa-shield-halved"></i> Active Policy
            </span>
          </div>

          <p style="font-size: 12px; color: var(--color-neutral-600); margin: 0; line-height: 1.4;">
            Students will receive <strong>${selectedHostel?.recoveryPercentage ?? recoveryStats?.recoveryPercentage ?? 80}%</strong> of their unattended meal days as recovery days added to their next subscription at your mess.
          </p>

          <div style="display: flex; flex-direction: column; gap: 6px; margin-top: 4px;">
            <span style="font-size: 11px; font-weight: 700; color: var(--color-neutral-500); text-transform: uppercase;">Select Recovery Percentage:</span>
            <div style="display: flex; gap: 8px; flex-wrap: wrap;" class="recovery-percentage-button-group">
              ${[50, 60, 70, 80, 90, 100].map((pct) => {
                const currentPct = selectedHostel?.recoveryPercentage ?? recoveryStats?.recoveryPercentage ?? 80;
                const isActive = currentPct === pct;
                return `
                  <button type="button" class="set-recovery-pct-btn btn-outline-action" data-pct="${pct}" style="padding: 6px 14px; font-size: 12px; font-weight: 800; border-radius: 8px; cursor: pointer; transition: all 0.15s ease; ${
                    isActive
                      ? 'background: var(--color-primary-600); color: #fff; border-color: var(--color-primary-600); box-shadow: 0 2px 6px rgba(234, 88, 12, 0.25);'
                      : 'background: #fff; color: var(--color-neutral-700); border-color: var(--color-neutral-300);'
                  }">
                    ${pct}%
                  </button>
                `;
              }).join('')}
            </div>
          </div>
        </div>
      </div>
    `;

    const renderSubscribersContent = () => `
      <div style="margin-bottom: 14px;">
        <input type="text" class="subscriber-search-input btn-outline-action" style="width: 100%; background: #fff; padding: 10px 14px; font-size: 13px; border-radius: 10px;" placeholder="Search subscribers by name or phone..." value="${escapeHtml(subscriberSearchQuery)}" />
      </div>
      ${subscribersLoading
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
                const amountPaidDisplay = getSubscriberAmount(sub);

                return `
                    <div class="subscriber-card-item" data-sub-id="${escapeHtml(sub.id)}" style="background: var(--color-neutral-50); border-radius: 14px; padding: 12px 14px; border: 1px solid var(--color-neutral-200); font-size: 13px; cursor: pointer; transition: all 0.2s ease;">
                      <div style="display: flex; justify-content: space-between; align-items: flex-start; gap: 8px; margin-bottom: 6px;">
                        <div>
                          <strong style="font-size: 14px; color: var(--color-neutral-900); display: block;">${studentName}</strong>
                          <span style="font-size: 12px; color: var(--color-neutral-500);"><i class="fa-solid fa-phone"></i> ${studentPhone}</span>
                        </div>
                        <span style="font-size: 11px; font-weight: 700; padding: 2px 8px; border-radius: 999px; ${statusBadgeStyle}">${statusUpper}</span>
                      </div>
                      <div style="display: flex; justify-content: space-between; align-items: center; font-size: 12px; color: var(--color-neutral-600);">
                        <span>${planTitle}</span>
                        <div style="display: flex; align-items: center; gap: 6px;">
                          <strong style="color: var(--color-primary-600);">${escapeHtml(amountPaidDisplay)}</strong>
                          <i class="fa-solid fa-chevron-right" style="font-size: 10px; color: var(--color-neutral-400);"></i>
                        </div>
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
                        <input type="text" class="menu-inline-input" value="${escapeHtml(editingMenuValue)}" placeholder="Enter menu items..." autoFocus />
                        <button class="save-inline-menu-btn btn-icon-save" title="Save"><i class="fa-solid fa-check"></i></button>
                        <button class="cancel-inline-menu-btn btn-icon-cancel" title="Cancel"><i class="fa-solid fa-xmark"></i></button>
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
      ${providerReviews.length === 0
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



    const renderEarningsSummaryContent = () => `
      <div style="background: #fff; border: 1px solid var(--color-neutral-200); border-radius: 20px; padding: 20px; box-shadow: 0 4px 12px rgba(0,0,0,0.03);">
        <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 16px; flex-wrap: wrap; gap: 10px;">
          <h3 class="font-display" style="font-size: 18px; font-weight: 800; color: var(--color-neutral-900); margin: 0;">
            <i class="fa-solid fa-wallet" style="color: var(--color-primary-600); margin-right: 8px;"></i> Earnings Ledger Overview
          </h3>
          <div style="display: inline-flex; align-items: center; gap: 6px; background: #fef3c7; color: #d97706; padding: 4px 12px; border-radius: 999px; font-size: 12px; font-weight: 700; border: 1px solid #fde68a;">
            <i class="fa-solid fa-circle-info"></i> Payout Status: Not connected <span style="font-size: 11px; opacity: 0.85; margin-left: 2px;">[ Coming Soon ]</span>
          </div>
        </div>

        <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(130px, 1fr)); gap: 12px; margin-bottom: 16px;">
          <div style="background: var(--color-neutral-50); border: 1px solid var(--color-neutral-200); border-radius: 14px; padding: 14px;">
            <span style="font-size: 11px; font-weight: 700; color: var(--color-neutral-500); text-transform: uppercase; display: block; margin-bottom: 4px;">Total Earnings</span>
            <span style="font-size: 20px; font-weight: 800; color: var(--color-neutral-900);">₹${Number(earningsSummary.totalProviderEarnings || 0).toLocaleString('en-IN')}</span>
          </div>
          <div style="background: var(--color-neutral-50); border: 1px solid var(--color-neutral-200); border-radius: 14px; padding: 14px;">
            <span style="font-size: 11px; font-weight: 700; color: #d97706; text-transform: uppercase; display: block; margin-bottom: 4px;">Pending</span>
            <span style="font-size: 20px; font-weight: 800; color: #d97706;">₹${Number(earningsSummary.pendingAmount || 0).toLocaleString('en-IN')}</span>
          </div>
          <div style="background: var(--color-neutral-50); border: 1px solid var(--color-neutral-200); border-radius: 14px; padding: 14px;">
            <span style="font-size: 11px; font-weight: 700; color: #059669; text-transform: uppercase; display: block; margin-bottom: 4px;">Paid</span>
            <span style="font-size: 20px; font-weight: 800; color: #059669;">₹${Number(earningsSummary.paidAmount || 0).toLocaleString('en-IN')}</span>
          </div>
          <div style="background: var(--color-neutral-50); border: 1px solid var(--color-neutral-200); border-radius: 14px; padding: 14px;">
            <span style="font-size: 11px; font-weight: 700; color: var(--color-neutral-500); text-transform: uppercase; display: block; margin-bottom: 4px;">Platform Fee</span>
            <span style="font-size: 20px; font-weight: 800; color: var(--color-neutral-700);">₹${Number(earningsSummary.platformFees || 0).toLocaleString('en-IN')}</span>
          </div>
        </div>

        <div style="font-size: 12px; color: var(--color-neutral-600); background: #f8fafc; padding: 10px 14px; border-radius: 10px; border: 1px solid var(--color-neutral-200);">
          <i class="fa-solid fa-shield-halved" style="color: var(--color-primary-600); margin-right: 4px;"></i> PrimePlate 0% commission model. All payments recorded in immutable ledger.
        </div>
      </div>
    `;

    const renderEarningsHistoryContent = () => `
      <div style="display: flex; flex-direction: column; gap: 10px; max-height: 480px; overflow-y: auto;">
        ${earningsLoading
          ? `<div style="text-align: center; padding: 36px;"><i class="fa-solid fa-spinner fa-spin" style="font-size: 24px; color: var(--color-primary-600);"></i></div>`
          : earningsHistory.length === 0
            ? `<div style="text-align: center; padding: 32px; background: var(--color-neutral-50); border: 1px dashed var(--color-neutral-300); border-radius: 16px;">
                <i class="fa-solid fa-receipt" style="font-size: 28px; color: var(--color-neutral-400); margin-bottom: 8px;"></i>
                <p style="font-size: 13px; color: var(--color-neutral-500); margin: 0;">No provider earning records found in ledger.</p>
              </div>`
            : earningsHistory.map((item) => {
                const dateStr = item.date ? new Date(item.date).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' }) : 'Recent';
                const planText = item.subscription?.planTitle || `${item.subscription?.durationDays || 30} Day Subscription`;
                const providerAmt = Number(item.providerAmount || 0);
                const statusUpper = (item.status || 'PENDING').toUpperCase();

                let badgeStyle = 'background: #fef3c7; color: #d97706; border: 1px solid #fde68a;';
                if (statusUpper === 'PAID') {
                  badgeStyle = 'background: #dcfce7; color: #15803d; border: 1px solid #bbf7d0;';
                } else if (statusUpper === 'REFUNDED' || statusUpper === 'REVERSED') {
                  badgeStyle = 'background: #fee2e2; color: #b91c1c; border: 1px solid #fca5a5;';
                }

                return `
                  <div style="background: var(--color-neutral-50); border: 1px solid var(--color-neutral-200); border-radius: 14px; padding: 14px; display: flex; justify-content: space-between; align-items: center; gap: 12px; flex-wrap: wrap;">
                    <div>
                      <div style="display: flex; align-items: center; gap: 8px; margin-bottom: 4px;">
                        <span style="font-size: 12px; font-weight: 700; color: var(--color-neutral-600);">${dateStr}</span>
                        <span style="font-size: 11px; font-weight: 700; padding: 2px 8px; border-radius: 999px; ${badgeStyle}">${statusUpper}</span>
                      </div>
                      <strong style="font-size: 14px; color: var(--color-neutral-900); display: block;">${escapeHtml(planText)}</strong>
                      <span style="font-size: 11px; color: var(--color-neutral-500);">Ref: ${escapeHtml(String(item.paymentReference || ''))}</span>
                    </div>
                    <div style="text-align: right;">
                      <span style="font-size: 16px; font-weight: 800; color: var(--color-primary-700);">₹${providerAmt.toLocaleString('en-IN')}</span>
                      <span style="font-size: 11px; color: var(--color-neutral-500); display: block;">Fee: ₹${Number(item.platformFee || 0)}</span>
                    </div>
                  </div>
                `;
              }).join('')
        }
      </div>
    `;

    const renderHostelImagesContent = () => `
      <div style="display: flex; flex-direction: column; gap: 20px;">
        <!-- Header & Stats -->
        <div style="display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: 12px;">
          <div>
            <span style="font-size: 13px; font-weight: 700; background: var(--color-primary-50); color: var(--color-primary-700); padding: 6px 14px; border-radius: 999px; display: inline-flex; align-items: center; gap: 6px; border: 1px solid var(--color-primary-200);">
              <i class="fa-solid fa-camera"></i> ${hostelImages.length} / 10 Photos Uploaded
            </span>
          </div>
          ${hostelImages.length >= 10
            ? `<span style="font-size: 12px; font-weight: 700; color: #d97706; background: #fef3c7; padding: 6px 14px; border-radius: 8px; border: 1px solid #fde68a; display: inline-flex; align-items: center; gap: 6px;">
                 <i class="fa-solid fa-circle-exclamation"></i> Maximum 10 photos limit reached
               </span>`
            : ''
          }
        </div>

        ${hostelImages.length < 10 ? `
          <!-- Desktop & Mobile Upload Interface -->
          <div style="display: flex; flex-direction: column; gap: 14px;">
            <!-- Mobile Quick Buttons (Only visible on mobile devices <769px) -->
            <div class="mobile-only-section">
              <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 12px;">
                <button type="button" class="mobile-take-photo-btn btn-primary-action" style="padding: 14px 16px; font-size: 14px; font-weight: 700; border-radius: 14px; justify-content: center; background: linear-gradient(135deg, var(--color-primary-600), var(--color-primary-700)); box-shadow: 0 4px 12px rgba(234, 88, 12, 0.2); cursor: pointer; display: flex; align-items: center; gap: 8px;">
                  <i class="fa-solid fa-camera" style="font-size: 16px;"></i> 📷 Take Photo
                </button>
                <button type="button" class="mobile-gallery-btn btn-outline-action" style="padding: 14px 16px; font-size: 14px; font-weight: 700; border-radius: 14px; justify-content: center; background: #fff; border: 2px solid var(--color-primary-600); color: var(--color-primary-700); cursor: pointer; display: flex; align-items: center; gap: 8px;">
                  <i class="fa-solid fa-images" style="font-size: 16px;"></i> 🖼️ Choose from Gallery
                </button>
              </div>
            </div>

            <!-- Desktop Drag & Drop Zone -->
            <div class="hostel-dropzone" style="border: 2px dashed var(--color-neutral-300); border-radius: 16px; padding: 28px 20px; text-align: center; background: #fff; cursor: pointer; transition: all 0.2s ease; position: relative;">
              <div style="width: 52px; height: 52px; border-radius: 50%; background: var(--color-primary-50); color: var(--color-primary-600); display: flex; align-items: center; justify-content: center; margin: 0 auto 12px; font-size: 22px;">
                <i class="fa-solid fa-cloud-arrow-up"></i>
              </div>
              <h4 style="font-size: 15px; font-weight: 700; color: var(--color-neutral-800); margin: 0 0 6px 0;">
                Drag & drop hostel photos here, or <span style="color: var(--color-primary-600); text-decoration: underline;">Browse files</span>
              </h4>
              <p style="font-size: 12px; color: var(--color-neutral-500); margin: 0;">
                Supports JPG, PNG, WebP • Max 10MB per image
              </p>
            </div>
          </div>
        ` : ''}

        <!-- Upload Queue Section (If items are queued) -->
        ${uploadQueue.length > 0 ? `
          <div style="background: var(--color-neutral-50); border: 1px solid var(--color-neutral-200); border-radius: 16px; padding: 16px;">
            <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 12px; flex-wrap: wrap; gap: 8px;">
              <h4 style="font-size: 14px; font-weight: 700; color: var(--color-neutral-900); margin: 0; display: flex; align-items: center; gap: 6px;">
                <i class="fa-solid fa-layer-group" style="color: var(--color-primary-600);"></i> Upload Queue (${uploadQueue.length} ${uploadQueue.length === 1 ? 'image' : 'images'})
              </h4>
              <div style="display: flex; gap: 8px;">
                <button type="button" class="clear-queue-btn btn-outline-action" style="padding: 6px 12px; font-size: 12px; font-weight: 700; border-radius: 8px;" ${isQueueUploading ? 'disabled' : ''}>
                  Clear All
                </button>
                <button type="button" class="start-upload-queue-btn btn-primary-action" style="padding: 6px 16px; font-size: 12px; font-weight: 700; border-radius: 8px;" ${isQueueUploading ? 'disabled' : ''}>
                  ${isQueueUploading ? '<i class="fa-solid fa-spinner fa-spin"></i> Uploading...' : '<i class="fa-solid fa-cloud-arrow-up"></i> Upload Queue'}
                </button>
              </div>
            </div>

            <div style="display: flex; flex-direction: column; gap: 10px;">
              ${uploadQueue.map((item) => `
                <div style="background: #fff; border: 1px solid var(--color-neutral-200); border-radius: 12px; padding: 12px; display: flex; align-items: center; gap: 12px; flex-wrap: wrap; box-shadow: 0 1px 3px rgba(0,0,0,0.02);">
                  <!-- Thumbnail -->
                  <div style="width: 52px; height: 52px; border-radius: 8px; overflow: hidden; background: #000; flex-shrink: 0; border: 1px solid var(--color-neutral-200);">
                    <img src="${item.previewUrl}" alt="Queue preview" style="width: 100%; height: 100%; object-fit: cover;" />
                  </div>

                  <!-- Details -->
                  <div style="flex: 1; min-width: 160px;">
                    <div style="display: flex; justify-content: space-between; align-items: center; gap: 8px; margin-bottom: 4px;">
                      <span style="font-size: 13px; font-weight: 700; color: var(--color-neutral-900); overflow: hidden; text-overflow: ellipsis; white-space: nowrap; max-width: 220px;" title="${escapeHtml(item.name)}">
                        ${escapeHtml(item.name)}
                      </span>
                      <span style="font-size: 11px; font-weight: 600; color: var(--color-neutral-500); flex-shrink: 0;">
                        ${(item.size / (1024 * 1024)).toFixed(2)} MB
                      </span>
                    </div>

                    <!-- Status Badge -->
                    <div style="display: flex; align-items: center; gap: 8px;">
                      ${item.status === 'WAITING'
                        ? `<span style="font-size: 11px; font-weight: 700; background: #f1f5f9; color: #475569; padding: 2px 8px; border-radius: 999px;">Waiting in queue</span>`
                        : item.status === 'UPLOADING'
                          ? `<span style="font-size: 11px; font-weight: 700; background: #e0f2fe; color: #0284c7; padding: 2px 8px; border-radius: 999px; display: inline-flex; align-items: center; gap: 4px;">
                               <i class="fa-solid fa-spinner fa-spin"></i> <span id="progress-text-${item.id}">Uploading ${item.progress}%</span>
                             </span>`
                          : item.status === 'SUCCESS'
                            ? `<span style="font-size: 11px; font-weight: 700; background: #dcfce7; color: #16a34a; padding: 2px 8px; border-radius: 999px; display: inline-flex; align-items: center; gap: 4px;">
                                 <i class="fa-solid fa-check"></i> Uploaded ✓
                               </span>`
                            : `<span style="font-size: 11px; font-weight: 700; background: #fee2e2; color: #dc2626; padding: 2px 8px; border-radius: 999px; display: inline-flex; align-items: center; gap: 4px;">
                                 <i class="fa-solid fa-triangle-exclamation"></i> Upload Failed ❌
                               </span>`
                      }
                    </div>

                    <!-- Progress Bar (Visible when uploading) -->
                    ${item.status === 'UPLOADING' ? `
                      <div style="width: 100%; height: 6px; background: #e2e8f0; border-radius: 999px; overflow: hidden; margin-top: 6px;">
                        <div id="progress-bar-${item.id}" style="width: ${item.progress}%; height: 100%; background: linear-gradient(90deg, var(--color-primary-500), var(--color-primary-600)); transition: width 0.2s ease;"></div>
                      </div>
                    ` : ''}

                    <!-- Error Text if Failed -->
                    ${item.errorMessage ? `
                      <span style="font-size: 11px; color: #dc2626; font-weight: 600; display: block; margin-top: 4px;">
                        ${escapeHtml(item.errorMessage)}
                      </span>
                    ` : ''}
                  </div>

                  <!-- Actions -->
                  <div style="display: flex; align-items: center; gap: 6px; flex-shrink: 0;">
                    ${item.status === 'ERROR' ? `
                      <button type="button" class="retry-queue-item-btn btn-outline-action" data-id="${item.id}" style="padding: 6px 10px; font-size: 12px; font-weight: 700; border-radius: 8px; background: #fff; color: var(--color-primary-700); border-color: var(--color-primary-300);" ${isQueueUploading ? 'disabled' : ''}>
                        <i class="fa-solid fa-rotate-right"></i> Retry
                      </button>
                    ` : ''}
                    ${item.status !== 'UPLOADING' && item.status !== 'SUCCESS' ? `
                      <button type="button" class="remove-queue-item-btn" data-id="${item.id}" style="background: none; border: none; font-size: 16px; color: var(--color-neutral-400); cursor: pointer; padding: 6px;" title="Remove from queue" ${isQueueUploading ? 'disabled' : ''}>
                        <i class="fa-solid fa-xmark"></i>
                      </button>
                    ` : ''}
                  </div>
                </div>
              `).join('')}
            </div>
          </div>
        ` : ''}

        <!-- Carousel Gallery Section -->
        <div>
          ${imagesLoading
            ? `<div style="text-align: center; padding: 36px;"><i class="fa-solid fa-spinner fa-spin" style="font-size: 24px; color: var(--color-primary-600);"></i></div>`
            : hostelImages.length === 0 && uploadQueue.length === 0
              ? `<div style="text-align: center; padding: 36px 20px; background: var(--color-neutral-50); border: 1px dashed var(--color-neutral-300); border-radius: 16px;">
                   <div style="width: 56px; height: 56px; border-radius: 16px; background: #fff; display: flex; align-items: center; justify-content: center; margin: 0 auto 12px; box-shadow: 0 2px 8px rgba(0,0,0,0.05); color: var(--color-neutral-400); font-size: 24px;">
                     <i class="fa-solid fa-images"></i>
                   </div>
                   <h4 style="font-size: 15px; font-weight: 700; color: var(--color-neutral-800); margin: 0 0 4px 0;">No hostel photos added yet.</h4>
                   <p style="font-size: 13px; color: var(--color-neutral-500); margin: 0;">
                     Upload photos of your front entrance, rooms, dining hall, and facilities to showcase to students.
                   </p>
                 </div>`
              : hostelImages.length > 0 ? `
                <div style="background: #fff; border: 1px solid var(--color-neutral-200); border-radius: 20px; padding: 18px; box-shadow: 0 4px 14px rgba(0,0,0,0.03); max-width: 620px; margin: 0 auto; width: 100%;">
                  <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 14px; flex-wrap: wrap; gap: 8px;">
                    <h4 style="font-size: 15px; font-weight: 700; color: var(--color-neutral-900); margin: 0; display: flex; align-items: center; gap: 6px;">
                      <i class="fa-solid fa-images" style="color: var(--color-primary-600);"></i> Hostel Photos (${hostelImages.length})
                    </h4>
                    <span style="font-size: 12px; font-weight: 700; background: var(--color-neutral-100); color: var(--color-neutral-700); padding: 4px 10px; border-radius: 999px;">
                      Photo ${carouselActiveIndex + 1} of ${hostelImages.length}
                    </span>
                  </div>

                  <!-- Main Carousel Slide (Normal proportions) -->
                  <div style="position: relative; width: 100%; height: 340px; border-radius: 16px; overflow: hidden; background: #0f172a; display: flex; align-items: center; justify-content: center; box-shadow: 0 8px 24px rgba(0,0,0,0.12);">
                    <img src="${getSafeImageUrl(hostelImages[carouselActiveIndex]?.imageUrl)}" alt="Hostel Photo ${carouselActiveIndex + 1}" style="width: 100%; height: 100%; object-fit: contain; background: #0f172a;" />
                    
                    <!-- Index Tag -->
                    <span style="position: absolute; top: 12px; left: 12px; font-size: 11px; font-weight: 800; background: rgba(0,0,0,0.65); color: #fff; padding: 4px 10px; border-radius: 8px; backdrop-filter: blur(4px);">
                      #${carouselActiveIndex + 1}
                    </span>

                    <!-- Slide Action Triggers -->
                    <div style="position: absolute; top: 12px; right: 12px; display: flex; gap: 6px; z-index: 6; flex-wrap: wrap; justify-content: flex-end;">
                      <button type="button" class="slide-take-photo-btn" data-img-id="${escapeHtml(hostelImages[carouselActiveIndex]?.id)}" style="background: rgba(234, 88, 12, 0.9); color: #fff; border: none; padding: 6px 10px; border-radius: 8px; font-size: 11px; font-weight: 700; cursor: pointer; backdrop-filter: blur(4px); display: inline-flex; align-items: center; gap: 4px;" title="Take new photo with camera">
                        <i class="fa-solid fa-camera"></i> Camera
                      </button>
                      <button type="button" class="slide-choose-gallery-btn" data-img-id="${escapeHtml(hostelImages[carouselActiveIndex]?.id)}" style="background: rgba(255, 255, 255, 0.9); color: #1e293b; border: none; padding: 6px 10px; border-radius: 8px; font-size: 11px; font-weight: 700; cursor: pointer; backdrop-filter: blur(4px); display: inline-flex; align-items: center; gap: 4px;" title="Choose replacement from gallery">
                        <i class="fa-solid fa-images"></i> Gallery
                      </button>
                      <button type="button" class="gallery-photo-click" data-img-id="${escapeHtml(hostelImages[carouselActiveIndex]?.id)}" style="background: rgba(0,0,0,0.65); color: #fff; border: none; padding: 6px 10px; border-radius: 8px; font-size: 11px; font-weight: 700; cursor: pointer; backdrop-filter: blur(4px); display: inline-flex; align-items: center; gap: 4px;" title="Enlarge photo">
                        <i class="fa-solid fa-expand"></i> Enlarge
                      </button>
                      <button type="button" class="delete-hostel-image-btn" data-img-id="${escapeHtml(hostelImages[carouselActiveIndex]?.id)}" style="background: rgba(220, 38, 38, 0.9); color: #fff; border: none; padding: 6px 10px; border-radius: 8px; font-size: 11px; font-weight: 700; cursor: pointer; backdrop-filter: blur(4px); display: inline-flex; align-items: center; gap: 4px;" title="Delete this photo">
                        <i class="fa-solid fa-trash-can"></i> Delete
                      </button>
                    </div>

                    <!-- Navigation Arrow: Previous -->
                    ${hostelImages.length > 1 ? `
                      <button type="button" class="carousel-prev-btn" style="position: absolute; left: 12px; top: 50%; transform: translateY(-50%); width: 40px; height: 40px; border-radius: 50%; background: rgba(255,255,255,0.92); border: none; color: var(--color-neutral-900); font-size: 15px; display: flex; align-items: center; justify-content: center; cursor: pointer; box-shadow: 0 4px 12px rgba(0,0,0,0.25); z-index: 5; transition: transform 0.15s ease;">
                        <i class="fa-solid fa-chevron-left"></i>
                      </button>
                      <button type="button" class="carousel-next-btn" style="position: absolute; right: 12px; top: 50%; transform: translateY(-50%); width: 40px; height: 40px; border-radius: 50%; background: rgba(255,255,255,0.92); border: none; color: var(--color-neutral-900); font-size: 15px; display: flex; align-items: center; justify-content: center; cursor: pointer; box-shadow: 0 4px 12px rgba(0,0,0,0.25); z-index: 5; transition: transform 0.15s ease;">
                        <i class="fa-solid fa-chevron-right"></i>
                      </button>
                    ` : ''}

                    <!-- Bottom Indicator Dots -->
                    ${hostelImages.length > 1 ? `
                      <div style="position: absolute; bottom: 12px; left: 50%; transform: translateX(-50%); display: flex; gap: 6px; z-index: 5; background: rgba(0,0,0,0.45); padding: 4px 10px; border-radius: 999px; backdrop-filter: blur(4px);">
                        ${hostelImages.map((_, idx) => `
                          <button type="button" class="carousel-dot-btn" data-slide-idx="${idx}" style="width: ${idx === carouselActiveIndex ? '20px' : '7px'}; height: 7px; border-radius: 999px; background: ${idx === carouselActiveIndex ? 'var(--color-primary-500)' : 'rgba(255,255,255,0.6)'}; border: none; padding: 0; cursor: pointer; transition: all 0.2s ease;"></button>
                        `).join('')}
                      </div>
                    ` : ''}
                  </div>

                  <!-- Management Controls for Active Carousel Photo -->
                  <div style="display: flex; justify-content: space-between; align-items: center; margin-top: 14px; padding: 12px 14px; background: var(--color-neutral-50); border: 1px solid var(--color-neutral-200); border-radius: 14px; flex-wrap: wrap; gap: 10px;">
                    <div>
                      <span style="font-size: 13px; font-weight: 700; color: var(--color-neutral-800); display: block;">
                        ${escapeHtml(hostelImages[carouselActiveIndex]?.originalFileName || `Photo #${carouselActiveIndex + 1}`)}
                      </span>
                      <span style="font-size: 11px; color: var(--color-neutral-500);">
                        Visible in public mess showcase
                      </span>
                    </div>
                    <div style="display: flex; gap: 8px; flex-wrap: wrap;">
                      <button type="button" class="slide-take-photo-btn btn-primary-action" data-img-id="${escapeHtml(hostelImages[carouselActiveIndex]?.id)}" style="padding: 8px 12px; font-size: 12px; font-weight: 700; border-radius: 10px;">
                        <i class="fa-solid fa-camera"></i> 📷 Take Photo
                      </button>
                      <button type="button" class="slide-choose-gallery-btn btn-outline-action" data-img-id="${escapeHtml(hostelImages[carouselActiveIndex]?.id)}" style="padding: 8px 12px; font-size: 12px; font-weight: 700; border-radius: 10px; background: #fff;">
                        <i class="fa-solid fa-images"></i> 🖼️ From Gallery
                      </button>
                      <button type="button" class="delete-hostel-image-btn" data-img-id="${escapeHtml(hostelImages[carouselActiveIndex]?.id)}" style="background: #fee2e2; color: #dc2626; border: 1px solid #fca5a5; font-size: 12px; font-weight: 700; padding: 8px 12px; border-radius: 10px; cursor: pointer; display: inline-flex; align-items: center; gap: 6px;">
                        <i class="fa-solid fa-trash-can"></i> Delete
                      </button>
                    </div>
                  </div>

                  <!-- Horizontal Scrollable Thumbnail Strip -->
                  ${hostelImages.length > 1 ? `
                    <div style="margin-top: 14px;">
                      <span style="font-size: 12px; font-weight: 700; color: var(--color-neutral-600); margin-bottom: 8px; display: block;">All Photos (${hostelImages.length}):</span>
                      <div style="display: flex; gap: 10px; overflow-x: auto; padding-bottom: 6px; scrollbar-width: thin; -webkit-overflow-scrolling: touch;">
                        ${hostelImages.map((img, idx) => `
                          <button type="button" class="carousel-thumb-btn" data-slide-idx="${idx}" style="flex-shrink: 0; width: 80px; height: 56px; border-radius: 10px; overflow: hidden; border: ${idx === carouselActiveIndex ? '3px solid var(--color-primary-600)' : '2px solid transparent'}; box-shadow: ${idx === carouselActiveIndex ? '0 0 8px rgba(234, 88, 12, 0.4)' : 'none'}; padding: 0; background: var(--color-neutral-100); cursor: pointer; transition: all 0.2s ease; position: relative;">
                            <img src="${getSafeImageUrl(img.imageUrl)}" alt="Thumb ${idx + 1}" style="width: 100%; height: 100%; object-fit: cover;" />
                            <span style="position: absolute; bottom: 2px; right: 2px; font-size: 9px; font-weight: 800; background: rgba(0,0,0,0.7); color: #fff; padding: 1px 4px; border-radius: 4px;">#${idx + 1}</span>
                          </button>
                        `).join('')}
                      </div>
                    </div>
                  ` : ''}
                </div>
              ` : ''
          }
        </div>
      </div>
    `;

    const renderMealQrContent = () => `
      <div style="display: flex; flex-direction: column; align-items: center; text-align: center; padding: 12px 0;">
        <p style="font-size: 14px; color: var(--color-neutral-600); max-width: 480px; margin: 0 0 20px 0; line-height: 1.5;">
          Show this QR at your mess so students can check in. Each student scans once per calendar day.
        </p>

        ${mealQrLoading ? `
          <div style="padding: 48px; text-align: center;">
            <i class="fa-solid fa-spinner fa-spin" style="font-size: 32px; color: var(--color-primary-600);"></i>
            <p style="font-size: 13px; color: var(--color-neutral-500); margin-top: 12px;">Loading permanent QR code...</p>
          </div>
        ` : mealQrData && mealQrData.qrCodeDataUrl ? `
          <!-- Printable Standee Container -->
          <div id="printableStandeeCard" style="
            background: #ffffff;
            border: 2px solid var(--color-neutral-200);
            border-radius: 24px;
            padding: 28px 24px;
            box-shadow: 0 10px 30px rgba(0,0,0,0.06);
            max-width: 360px;
            width: 100%;
            display: flex;
            flex-direction: column;
            align-items: center;
            margin-bottom: 24px;
          ">
            <div style="display: inline-flex; align-items: center; gap: 6px; font-size: 11px; font-weight: 800; text-transform: uppercase; letter-spacing: 1px; color: var(--color-primary-600); margin-bottom: 8px;">
              <i class="fa-solid fa-utensils"></i> PrimePlate Official Mess QR
            </div>
            <h3 class="font-display" style="font-size: 20px; font-weight: 800; color: var(--color-neutral-900); margin: 0 0 4px 0; text-align: center;">
              ${escapeHtml(selectedHostel?.name || mealQrData.providerName)}
            </h3>
            <p style="font-size: 12px; color: var(--color-neutral-500); margin: 0 0 16px 0;">
              ${escapeHtml(selectedHostel?.address || selectedHostel?.city || 'Verified Mess Kitchen')}
            </p>

            <!-- Large Scannable QR Code -->
            <div style="
              background: #ffffff;
              padding: 12px;
              border-radius: 20px;
              border: 2px solid var(--color-neutral-900);
              box-shadow: 0 4px 16px rgba(0,0,0,0.08);
              margin-bottom: 16px;
              width: 240px;
              height: 240px;
              display: flex;
              align-items: center;
              justify-content: center;
            ">
              <img src="${mealQrData.qrCodeDataUrl}" alt="Mess Check-in QR Code" style="width: 100%; height: 100%; object-fit: contain; display: block;" />
            </div>

            <p style="font-size: 13px; font-weight: 700; color: var(--color-neutral-800); margin: 0 0 4px 0;">
              Scan with PrimePlate App
            </p>
            <span style="font-size: 11px; color: var(--color-neutral-500);">
              1 meal check-in per student per calendar day
            </span>
          </div>

          <!-- Action Buttons -->
          <div style="display: flex; gap: 12px; justify-content: center; flex-wrap: wrap;">
            <button type="button" class="print-meal-qr-btn btn-primary-action" style="padding: 10px 24px; font-size: 14px; font-weight: 700; border-radius: 12px;">
              <i class="fa-solid fa-print"></i> Print QR
            </button>
            <button type="button" class="download-meal-qr-btn btn-outline-action" style="padding: 10px 24px; font-size: 14px; font-weight: 700; border-radius: 12px; background: #fff; cursor: pointer; display: inline-flex; align-items: center; gap: 8px;">
              <i class="fa-solid fa-download"></i> Download QR
            </button>
          </div>
        ` : `
          <div style="padding: 32px; text-align: center; background: var(--color-neutral-50); border: 1px dashed var(--color-neutral-300); border-radius: 16px; width: 100%; max-width: 400px;">
            <p style="font-size: 14px; color: var(--color-neutral-600); margin-bottom: 12px;">Permanent QR token ready to initialize.</p>
            <button type="button" class="refresh-meal-qr-btn btn-primary-action" style="padding: 10px 20px;">
              <i class="fa-solid fa-qrcode"></i> Load My Meal QR
            </button>
          </div>
        `}
      </div>
    `;

    const renderTodayCheckInsContent = () => {
      const summary = todayCheckInsData?.summary || { todayCheckIns: 0, activeSubscribers: 0, notCheckedIn: 0 };
      const subscribers = todayCheckInsData?.subscribers || [];

      return `
        <div>
          <!-- 3 Operational Summary Stat Cards -->
          <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(180px, 1fr)); gap: 14px; margin-bottom: 24px;">
            <div style="background: var(--color-success-50); border: 1px solid #bbf7d0; border-radius: 16px; padding: 16px;">
              <div style="display: flex; align-items: center; gap: 8px; color: #15803d; font-size: 13px; font-weight: 700; margin-bottom: 4px;">
                <i class="fa-solid fa-circle-check"></i> Today's Check-ins
              </div>
              <p style="font-size: 28px; font-weight: 800; color: #166534; margin: 0;">${summary.todayCheckIns}</p>
              <span style="font-size: 11px; color: #15803d;">Recorded today</span>
            </div>

            <div style="background: var(--color-primary-50); border: 1px solid var(--color-primary-200); border-radius: 16px; padding: 16px;">
              <div style="display: flex; align-items: center; gap: 8px; color: var(--color-primary-700); font-size: 13px; font-weight: 700; margin-bottom: 4px;">
                <i class="fa-solid fa-users"></i> Active Subscribers
              </div>
              <p style="font-size: 28px; font-weight: 800; color: var(--color-primary-800); margin: 0;">${summary.activeSubscribers}</p>
              <span style="font-size: 11px; color: var(--color-primary-600);">Eligible for meals today</span>
            </div>

            <div style="background: #fffbeb; border: 1px solid #fde68a; border-radius: 16px; padding: 16px;">
              <div style="display: flex; align-items: center; gap: 8px; color: #b45309; font-size: 13px; font-weight: 700; margin-bottom: 4px;">
                <i class="fa-solid fa-clock"></i> Not Checked In
              </div>
              <p style="font-size: 28px; font-weight: 800; color: #92400e; margin: 0;">${summary.notCheckedIn}</p>
              <span style="font-size: 11px; color: #b45309;">Awaiting meal check-in</span>
            </div>
          </div>

          <!-- Subscriber Attendance Roster -->
          <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 14px; flex-wrap: wrap; gap: 8px;">
            <h4 style="font-size: 15px; font-weight: 700; color: var(--color-neutral-900); margin: 0;">
              Subscriber Attendance (${subscribers.length})
            </h4>
            <button type="button" class="refresh-today-checkins-btn btn-outline-action" style="padding: 6px 12px; font-size: 12px; font-weight: 700; border-radius: 8px; background: #fff;">
              <i class="fa-solid fa-rotate-right"></i> Refresh
            </button>
          </div>

          ${todayCheckInsLoading ? `
            <div style="text-align: center; padding: 36px;"><i class="fa-solid fa-spinner fa-spin" style="font-size: 24px; color: var(--color-primary-600);"></i></div>
          ` : subscribers.length === 0 ? `
            <div style="text-align: center; padding: 36px 20px; background: var(--color-neutral-50); border: 1px dashed var(--color-neutral-300); border-radius: 16px;">
              <div style="width: 48px; height: 48px; border-radius: 14px; background: #fff; display: flex; align-items: center; justify-content: center; margin: 0 auto 10px; color: var(--color-neutral-400); font-size: 20px;">
                <i class="fa-solid fa-user-xmark"></i>
              </div>
              <h4 style="font-size: 14px; font-weight: 700; color: var(--color-neutral-800); margin: 0 0 4px 0;">No active subscribers today</h4>
              <p style="font-size: 12px; color: var(--color-neutral-500); margin: 0;">Active subscribers will appear here when subscribed to your kitchen.</p>
            </div>
          ` : `
            <div style="overflow-x: auto; border: 1px solid var(--color-neutral-200); border-radius: 16px;">
              <table style="width: 100%; border-collapse: collapse; text-align: left; font-size: 13px;">
                <thead>
                  <tr style="background: var(--color-neutral-50); border-bottom: 1px solid var(--color-neutral-200); color: var(--color-neutral-700); font-weight: 700; font-size: 12px;">
                    <th style="padding: 12px 16px;">Student</th>
                    <th style="padding: 12px 16px;">Plan</th>
                    <th style="padding: 12px 16px;">Attendance Status</th>
                    <th style="padding: 12px 16px;">Time</th>
                    <th style="padding: 12px 16px; text-align: right;">Action</th>
                  </tr>
                </thead>
                <tbody>
                  ${subscribers.map((sub: any) => `
                    <tr style="border-bottom: 1px solid var(--color-neutral-100); transition: background 0.1s ease;">
                      <td style="padding: 12px 16px;">
                        <strong style="color: var(--color-neutral-900); display: block;">${escapeHtml(sub.studentName)}</strong>
                        <span style="font-size: 11px; color: var(--color-neutral-500);">${escapeHtml(sub.studentPhone || sub.studentEmail)}</span>
                      </td>
                      <td style="padding: 12px 16px; color: var(--color-neutral-700);">
                        ${escapeHtml(sub.planTitle)}
                      </td>
                      <td style="padding: 12px 16px;">
                        ${sub.checkedIn ? `
                          <div style="display: flex; align-items: center; gap: 6px; flex-wrap: wrap;">
                            <span style="font-size: 11px; font-weight: 700; padding: 3px 10px; border-radius: 999px; background: #dcfce7; color: #166534; display: inline-flex; align-items: center; gap: 4px;">
                              <i class="fa-solid fa-circle-check"></i> Checked In
                            </span>
                            ${sub.source === 'PROVIDER_CORRECTION' ? `
                              <span style="font-size: 10px; font-weight: 700; background: #fef3c7; color: #92400e; padding: 2px 6px; border-radius: 4px;" title="${escapeHtml(sub.correctionReason || 'Manual correction')}">
                                Audited Correction
                              </span>
                            ` : ''}
                          </div>
                        ` : `
                          <span style="font-size: 11px; font-weight: 600; color: var(--color-neutral-500); display: inline-flex; align-items: center; gap: 4px;">
                            <i class="fa-solid fa-minus"></i> Not Checked In
                          </span>
                        `}
                      </td>
                      <td style="padding: 12px 16px; color: var(--color-neutral-600);">
                        ${sub.time ? escapeHtml(sub.time) : '<span style="color: var(--color-neutral-400);">—</span>'}
                      </td>
                      <td style="padding: 12px 16px; text-align: right;">
                        ${!sub.checkedIn ? `
                          <button type="button" class="open-correction-modal-btn btn-outline-action" data-sub-id="${escapeHtml(sub.subscriptionId)}" data-student-name="${escapeHtml(sub.studentName)}" style="padding: 6px 12px; font-size: 11px; font-weight: 700; border-radius: 8px; background: #fff; color: var(--color-primary-700); border-color: var(--color-primary-300);">
                            <i class="fa-solid fa-wrench"></i> Correct Check-in
                          </button>
                        ` : `
                          <span style="font-size: 11px; color: #16a34a; font-weight: 700;">Recorded</span>
                        `}
                      </td>
                    </tr>
                  `).join('')}
                </tbody>
              </table>
            </div>
          `}
        </div>
      `;
    };

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

            ${!isNewProvider
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
                        <option value="Andhra Meals">Andhra Meals</option>
                        <option value="Healthy">Healthy</option>
                        <option value="Budget">Budget</option>
                      </select>
                    </div>
                  </div>

                  <div>
                    <label for="cDescription" style="font-size: 13px; font-weight: 700; color: var(--color-neutral-800); display: block; margin-bottom: 6px;">About This Kitchen / Mess</label>
                    <textarea id="cDescription" rows="4" maxlength="1000" class="btn-outline-action" style="width: 100%; background: #fff; padding: 12px 16px; font-size: 14px; resize: vertical; min-height: 90px; text-align: left;" placeholder="Tell students about your hostel/mess, food quality, timings, dining environment, and anything else they should know."></textarea>
                    <div style="display: flex; justify-content: flex-end; margin-top: 4px;">
                      <span id="cDescriptionCount" style="font-size: 11px; color: var(--color-neutral-400);">0 / 1000 characters</span>
                    </div>
                  </div>

                  <div>
                    <label style="font-size: 13px; font-weight: 700; color: var(--color-neutral-800); display: block; margin-bottom: 6px;">Hostel Amenities & Facilities</label>
                    <p style="font-size: 12px; color: var(--color-neutral-500); margin: 0 0 10px 0;">Select common amenities or add custom facilities provided at your mess/hostel:</p>
                    <div style="display: grid; grid-template-columns: repeat(auto-fill, minmax(130px, 1fr)); gap: 8px; margin-bottom: 12px;">
                      ${COMMON_AMENITIES.map((amenity, idx) => `
                        <label for="cAmenity_${idx}" style="display: flex; align-items: center; gap: 8px; padding: 8px 12px; border: 1px solid var(--color-neutral-200); border-radius: 10px; cursor: pointer; background: #fff; font-size: 13px; font-weight: 600; color: var(--color-neutral-800);">
                          <input type="checkbox" id="cAmenity_${idx}" name="cAmenities" value="${escapeHtml(amenity)}" style="width: 16px; height: 16px; accent-color: var(--color-primary-600); cursor: pointer;" />
                          <span>${escapeHtml(amenity)}</span>
                        </label>
                      `).join('')}
                    </div>

                    <div style="margin-top: 8px;">
                      <span style="font-size: 12px; font-weight: 700; color: var(--color-neutral-700); display: block; margin-bottom: 6px;">Custom Amenities</span>
                      <div id="cCustomAmenitiesList" style="display: flex; flex-direction: column; gap: 8px; margin-bottom: 8px;"></div>
                      <button type="button" id="cAddCustomAmenityBtn" class="btn-outline-action" style="font-size: 13px; font-weight: 700; padding: 8px 14px; background: #fff; border-radius: 8px;">
                        <i class="fa-solid fa-plus"></i> Add Another Amenity
                      </button>
                    </div>
                  </div>

                  <button type="submit" class="btn-primary-action" style="width: 100%; justify-content: center; padding: 14px; font-size: 16px; margin-top: 8px;">
                    Submit Kitchen Registration
                  </button>
                </form>
              </div>
            `
        : `
              ${isPending ? `
                <div style="background: #fefce8; border: 1px solid #fef08a; border-radius: 18px; padding: 18px 24px; margin-bottom: 24px; display: flex; align-items: center; justify-content: space-between; gap: 16px; flex-wrap: wrap; box-shadow: 0 4px 12px rgba(202, 138, 4, 0.08);">
                  <div style="display: flex; align-items: center; gap: 14px;">
                    <div style="width: 44px; height: 44px; border-radius: 12px; background: #fef9c3; color: #ca8a04; display: flex; align-items: center; justify-content: center; font-size: 22px; flex-shrink: 0;">
                      <i class="fa-solid fa-clock"></i>
                    </div>
                    <div>
                      <h4 style="font-size: 16px; font-weight: 800; color: #854d0e; margin: 0 0 2px 0;">Kitchen Listing Under Review (Approval Pending)</h4>
                      <p style="font-size: 13px; color: #a16207; margin: 0;">Your listing for <strong>${escapeHtml(selectedHostel.name)}</strong> is under review by PrimePlate Admin. You can configure your weekly menu, capacity, and settings below.</p>
                    </div>
                  </div>
                  <button id="refreshStatusBtn" class="btn-outline-action" style="background: #fff; font-size: 13px; font-weight: 700; border-color: #fde047; color: #854d0e; padding: 8px 16px;">
                    <i class="fa-solid fa-arrows-rotate"></i> Check Status
                  </button>
                </div>
              ` : ''}

              <!-- Hostels Switcher Bar -->
              ${hostels.length > 1
            ? `<div style="display: flex; gap: 8px; overflow-x: auto; margin-bottom: 20px; padding-bottom: 4px;">
                    ${hostels.map((h) => `
                      <button class="select-hostel-tab-btn btn-outline-action" data-id="${h.id}" style="font-weight: 700; padding: 8px 16px; border-radius: 999px; font-size: 13px; background: ${selectedHostel.id === h.id ? 'var(--color-primary-600)' : '#fff'}; color: ${selectedHostel.id === h.id ? '#fff' : 'var(--color-neutral-700)'}; border-color: ${selectedHostel.id === h.id ? 'var(--color-primary-600)' : 'var(--color-neutral-300)'};">
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
                  <p class="owner-stat-value">${activeSubscribersCount} / ${selectedHostel.totalCapacity ?? 50}</p>
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
                  <p class="owner-stat-value">${(selectedHostel.rating ?? 0) > 0 ? Number(selectedHostel.rating).toFixed(1) : '0.0'}</p>
                </div>
              </div>

              <!-- ==========================================================
                   1. MOBILE COMPACT DASHBOARD VIEW (<=768px)
                   ========================================================== -->
              ${(() => {
                const effectiveMainImage = (hostelImages && hostelImages.length > 0)
                  ? (hostelImages[0]?.imageUrl || selectedHostel?.imageUrl)
                  : (selectedHostel?.imageUrl || '');
                return `
                  <div class="mobile-only-section" style="margin-bottom: 24px;">
                    <!-- Primary PG Card -->
                    <div style="background: #fff; border: 1px solid var(--color-neutral-200); border-radius: 20px; padding: 18px; margin-bottom: 16px; box-shadow: 0 4px 12px rgba(0,0,0,0.03);">
                      <div style="display: flex; align-items: flex-start; gap: 12px; margin-bottom: 14px;">
                        <div style="position: relative; width: 64px; height: 64px; flex-shrink: 0; cursor: pointer;" class="change-main-hostel-image-btn" title="Click to Replace Hostel Main Photo">
                          <img src="${getSafeImageUrl(effectiveMainImage)}" alt="${escapeHtml(selectedHostel.name)}" style="width: 64px; height: 64px; border-radius: 12px; object-fit: cover; border: 1px solid var(--color-neutral-200);" />
                          <div style="position: absolute; bottom: -2px; right: -2px; width: 22px; height: 22px; border-radius: 50%; background: var(--color-primary-600); color: #fff; border: 2px solid #fff; font-size: 10px; display: flex; align-items: center; justify-content: center; box-shadow: 0 2px 6px rgba(0,0,0,0.25);">
                            <i class="fa-solid fa-camera"></i>
                          </div>
                        </div>
                        <div style="flex: 1; min-width: 0;">
                          <h2 class="font-display" style="font-size: 18px; font-weight: 800; color: var(--color-neutral-900); margin: 0 0 2px 0;">${escapeHtml(selectedHostel.name)}</h2>
                          <p style="font-size: 12px; color: var(--color-neutral-600); margin: 0 0 2px 0;"><i class="fa-solid fa-location-dot" style="color: var(--color-primary-600);"></i> ${escapeHtml(selectedHostel.address || selectedHostel.city || 'Location not set')}</p>
                          <p style="font-size: 12px; color: var(--color-neutral-500); margin: 0;"><i class="fa-solid fa-phone"></i> ${escapeHtml(selectedHostel.contactPhone || 'No phone')}</p>
                        </div>
                      </div>
                `;
              })()}

                  <div style="background: var(--color-neutral-50); border: 1px solid var(--color-neutral-200); border-radius: 14px; padding: 10px 14px; margin-bottom: 14px; display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: 8px;">
                    <div>
                      <span style="font-size: 16px; font-weight: 800; color: var(--color-neutral-900);">₹${monthlyPriceNum.toLocaleString('en-IN')}</span>
                      <span style="font-size: 12px; color: var(--color-neutral-500);">/ mo</span>
                    </div>
                    <span style="font-size: 12px; font-weight: 700; padding: 3px 10px; border-radius: 999px; background: ${selectedHostel.acceptingSubscriptions !== false ? '#d1fae5' : '#fee2e2'}; color: ${selectedHostel.acceptingSubscriptions !== false ? '#047857' : '#b91c1c'};">
                      ${selectedHostel.acceptingSubscriptions !== false ? '🟢 Kitchen OPEN' : '🔴 Kitchen CLOSED'}
                    </span>
                    <span style="font-size: 12px; font-weight: 600; color: var(--color-neutral-700);">👥 ${totalSubscribersCount} / ${selectedHostel.totalCapacity ?? 50}</span>
                  </div>

                  <div style="margin-bottom: 14px; padding-top: 10px; border-top: 1px solid var(--color-neutral-100);">
                    <h4 style="font-size: 13px; font-weight: 700; color: var(--color-neutral-900); margin: 0 0 4px 0;">About This Kitchen</h4>
                    <p style="color: var(--color-neutral-700); font-size: 13px; line-height: 1.5; margin: 0 0 10px 0;">${selectedHostel.description ? escapeHtml(selectedHostel.description) : '<span style="color: var(--color-neutral-400); font-style: italic;">No description added yet.</span>'}</p>

                    <h4 style="font-size: 13px; font-weight: 700; color: var(--color-neutral-900); margin: 0 0 6px 0;">Hostel Amenities & Facilities</h4>
                    <div style="display: flex; gap: 6px; flex-wrap: wrap;">
                      ${selectedHostel.amenities && selectedHostel.amenities.length > 0
                        ? selectedHostel.amenities.map((a: string) => `<span style="background: var(--color-neutral-100); color: var(--color-neutral-800); border: 1px solid var(--color-neutral-200); font-size: 11px; font-weight: 700; padding: 3px 10px; border-radius: 999px; display: inline-flex; align-items: center; gap: 4px;"><i class="fa-solid fa-circle-check" style="color: var(--color-primary-600); font-size: 10px;"></i> ${escapeHtml(a)}</span>`).join('')
                        : '<span style="color: var(--color-neutral-400); font-size: 12px; font-style: italic;">No amenities added yet.</span>'
                      }
                    </div>
                  </div>

                  <button class="open-manage-pg-sheet-btn btn-primary-action" style="width: 100%; justify-content: center; padding: 12px; font-size: 14px; font-weight: 700; border-radius: 12px; min-height: 44px;">
                    <i class="fa-solid fa-sliders"></i> Manage PG
                  </button>
                </div>

                <!-- Compact Mobile Earnings Card (Section 15 & 23 Requirements) -->
                <div style="background: #fff; border: 1px solid var(--color-neutral-200); border-radius: 20px; padding: 18px; margin-bottom: 16px; box-shadow: 0 4px 12px rgba(0,0,0,0.03);">
                  <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 12px; flex-wrap: wrap; gap: 8px;">
                    <span style="font-size: 15px; font-weight: 800; color: var(--color-neutral-900); display: flex; align-items: center; gap: 6px;">
                      <i class="fa-solid fa-wallet" style="color: var(--color-primary-600);"></i> Earnings
                    </span>
                    <span style="font-size: 11px; font-weight: 700; padding: 3px 8px; border-radius: 999px; background: #fef3c7; color: #d97706; border: 1px solid #fde68a;">
                      Payout Status: Not connected
                    </span>
                  </div>

                  <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 10px; margin-bottom: 14px;">
                    <div style="background: var(--color-neutral-50); border: 1px solid var(--color-neutral-200); border-radius: 12px; padding: 12px;">
                      <span style="font-size: 11px; font-weight: 700; color: var(--color-neutral-500); text-transform: uppercase; display: block; margin-bottom: 2px;">Earnings</span>
                      <span style="font-size: 18px; font-weight: 800; color: var(--color-neutral-900);">₹${Number(earningsSummary.totalProviderEarnings || 0).toLocaleString('en-IN')}</span>
                    </div>
                    <div style="background: var(--color-neutral-50); border: 1px solid var(--color-neutral-200); border-radius: 12px; padding: 12px;">
                      <span style="font-size: 11px; font-weight: 700; color: #d97706; text-transform: uppercase; display: block; margin-bottom: 2px;">Pending</span>
                      <span style="font-size: 18px; font-weight: 800; color: #d97706;">₹${Number(earningsSummary.pendingAmount || 0).toLocaleString('en-IN')}</span>
                    </div>
                  </div>

                  <button class="open-earnings-sheet-btn btn-primary-action" style="width: 100%; justify-content: center; padding: 12px; font-size: 14px; font-weight: 700; border-radius: 12px; min-height: 44px;">
                    <i class="fa-solid fa-receipt"></i> View Earnings
                  </button>
                </div>

                <!-- Operational Action Cards -->
                <h4 style="font-size: 12px; font-weight: 700; color: var(--color-neutral-500); text-transform: uppercase; letter-spacing: 0.5px; margin: 0 0 10px 4px;">Pending Actions & Operations</h4>

                <div style="display: flex; flex-direction: column; gap: 10px;">
                  <div class="compact-action-card">
                    <div>
                      <span style="font-size: 14px; font-weight: 700; color: var(--color-neutral-900); display: block;"><i class="fa-solid fa-camera" style="color: var(--color-primary-600); margin-right: 6px;"></i> Hostel Images</span>
                      <span style="font-size: 12px; font-weight: 600; color: var(--color-neutral-600);">${hostelImages.length} / 10 Photos Uploaded</span>
                    </div>
                    <button class="open-hostel-images-sheet-btn btn-outline-action" style="padding: 8px 14px; font-size: 12px; font-weight: 700; border-radius: 10px; min-height: 40px; background: #fff;">
                      Manage Photos
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
                      <span style="font-size: 14px; font-weight: 700; color: var(--color-neutral-900); display: block;"><i class="fa-solid fa-qrcode" style="color: var(--color-primary-600); margin-right: 6px;"></i> My Meal QR</span>
                      <span style="font-size: 12px; font-weight: 600; color: var(--color-neutral-600);">Display & Print Mess QR</span>
                    </div>
                    <button class="open-meal-qr-sheet-btn btn-outline-action" style="padding: 8px 14px; font-size: 12px; font-weight: 700; border-radius: 10px; min-height: 40px; background: #fff;">
                      View Meal QR
                    </button>
                  </div>

                  <div class="compact-action-card">
                    <div>
                      <span style="font-size: 14px; font-weight: 700; color: var(--color-neutral-900); display: block;"><i class="fa-solid fa-clipboard-check" style="color: #0284c7; margin-right: 6px;"></i> Today's Check-ins</span>
                      <span style="font-size: 12px; font-weight: 600; color: var(--color-neutral-600);">${todayCheckInsData?.summary?.todayCheckIns ?? 0} Checked In Today</span>
                    </div>
                    <button class="open-todays-checkins-sheet-btn btn-outline-action" style="padding: 8px 14px; font-size: 12px; font-weight: 700; border-radius: 10px; min-height: 40px; background: #fff;">
                      View Check-ins
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
                      <span style="font-size: 12px; font-weight: 600; color: var(--color-neutral-600);">⭐ ${(selectedHostel.rating ?? 0) > 0 ? Number(selectedHostel.rating).toFixed(1) : '0.0'} · ${providerReviews.length} reviews</span>
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
                    <div style="position: relative; width: 80px; height: 80px; flex-shrink: 0; cursor: pointer;" class="change-main-hostel-image-btn" title="Click to Replace Hostel Main Photo">
                      <img src="${getSafeImageUrl((hostelImages && hostelImages.length > 0) ? (hostelImages[0]?.imageUrl || selectedHostel?.imageUrl) : (selectedHostel?.imageUrl || ''))}" alt="${escapeHtml(selectedHostel.name)}" style="width: 80px; height: 80px; border-radius: 14px; object-fit: cover; border: 1px solid var(--color-neutral-200);" />
                      <div style="position: absolute; bottom: -2px; right: -2px; width: 26px; height: 26px; border-radius: 50%; background: var(--color-primary-600); color: #fff; border: 2px solid #fff; font-size: 11px; display: flex; align-items: center; justify-content: center; box-shadow: 0 2px 6px rgba(0,0,0,0.25);">
                        <i class="fa-solid fa-camera"></i>
                      </div>
                    </div>
                    <div style="flex: 1; min-width: 0;">
                      <h2 class="font-display" style="font-size: 20px; font-weight: 800; color: var(--color-neutral-900); margin: 0 0 4px 0;">${escapeHtml(selectedHostel.name)}</h2>
                      <p style="font-size: 13px; color: var(--color-neutral-700); margin: 0 0 4px 0;"><i class="fa-solid fa-location-dot" style="color: var(--color-primary-600);"></i> ${escapeHtml(selectedHostel.address || selectedHostel.city || 'Location not specified')}</p>
                      <p style="font-size: 13px; color: var(--color-neutral-600); margin: 0;"><i class="fa-solid fa-phone"></i> ${escapeHtml(selectedHostel.contactPhone || 'No phone')}</p>
                    </div>
                  </div>

                  <div style="background: var(--color-neutral-50); border: 1px solid var(--color-neutral-200); border-radius: 16px; padding: 14px; margin-bottom: 16px;">
                    <div style="display: flex; justify-content: space-between; align-items: center; gap: 10px; margin-bottom: 10px; flex-wrap: wrap;">
                      <div>
                        <span style="font-size: 18px; font-weight: 800; color: var(--color-neutral-900);">₹${monthlyPriceNum.toLocaleString('en-IN')}</span>
                        <span style="font-size: 13px; color: var(--color-neutral-500);">/ month</span>
                      </div>
                      <div style="display: inline-flex; align-items: center; gap: 6px; padding: 4px 12px; border-radius: 999px; font-size: 12px; font-weight: 700; background: ${selectedHostel.acceptingSubscriptions !== false ? '#d1fae5' : '#fee2e2'}; color: ${selectedHostel.acceptingSubscriptions !== false ? '#047857' : '#b91c1c'}; border: 1px solid ${selectedHostel.acceptingSubscriptions !== false ? '#a7f3d0' : '#fca5a5'};">
                        <span>${selectedHostel.acceptingSubscriptions !== false ? 'Kitchen OPEN' : 'Kitchen CLOSED'}</span>
                      </div>
                    </div>
                  </div>

                  <div style="margin-bottom: 16px; padding: 14px 0; border-top: 1px solid var(--color-neutral-100); border-bottom: 1px solid var(--color-neutral-100);">
                    <h3 class="font-display" style="font-size: 15px; font-weight: 700; color: var(--color-neutral-900); margin: 0 0 6px 0;">About This Kitchen</h3>
                    <p style="color: var(--color-neutral-700); font-size: 14px; line-height: 1.6; margin: 0 0 12px 0;">${selectedHostel.description ? escapeHtml(selectedHostel.description) : '<span style="color: var(--color-neutral-400); font-style: italic;">No description added yet.</span>'}</p>

                    <h3 class="font-display" style="font-size: 15px; font-weight: 700; color: var(--color-neutral-900); margin: 0 0 8px 0;">Hostel Amenities & Facilities</h3>
                    <div style="display: flex; gap: 8px; flex-wrap: wrap;">
                      ${selectedHostel.amenities && selectedHostel.amenities.length > 0
                        ? selectedHostel.amenities.map((a: string) => `<span style="background: var(--color-neutral-100); color: var(--color-neutral-800); border: 1px solid var(--color-neutral-200); font-size: 12px; font-weight: 700; padding: 5px 12px; border-radius: 999px; display: inline-flex; align-items: center; gap: 6px;"><i class="fa-solid fa-circle-check" style="color: var(--color-primary-600); font-size: 11px;"></i> ${escapeHtml(a)}</span>`).join('')
                        : '<span style="color: var(--color-neutral-400); font-size: 13px; font-style: italic;">No amenities added yet.</span>'
                      }
                    </div>
                  </div>

                  <button id="toggleManagePgBtn" class="btn-primary-action" style="width: 100%; justify-content: center; padding: 12px; font-size: 14px; font-weight: 700; border-radius: 12px; min-height: 44px;">
                    <i class="fa-solid ${showManagePanel ? 'fa-chevron-up' : 'fa-sliders'}"></i> ${showManagePanel ? 'Close Management Panel' : 'Manage PG'}
                  </button>

                  <div id="secondaryManagePanel" style="display: ${showManagePanel ? 'flex' : 'none'}; flex-direction: column; gap: 12px; margin-top: 16px; padding-top: 16px; border-top: 1px solid var(--color-neutral-200);">
                    ${renderManagePgContent()}
                  </div>
                </div>

                <!-- Hostel Images Section Card -->
                <div id="hostelImagesSection" style="background: #fff; border: 1px solid var(--color-neutral-200); border-radius: 20px; padding: 20px; margin-bottom: 24px; box-shadow: 0 4px 12px rgba(0,0,0,0.03);">
                  <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 16px;">
                    <h3 class="font-display" style="font-size: 18px; font-weight: 700; color: var(--color-neutral-900); margin: 0;">
                      <i class="fa-solid fa-images" style="color: var(--color-primary-600);"></i> Hostel Images
                    </h3>
                  </div>
                  ${renderHostelImagesContent()}
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

                <!-- Provider Earnings Ledger Summary Section -->
                <div id="earningsOverviewSection" style="margin-bottom: 24px;">
                  ${renderEarningsSummaryContent()}
                </div>

                <!-- Provider Earnings History Section -->
                <div id="earningsHistorySection" style="background: #fff; border: 1px solid var(--color-neutral-200); border-radius: 24px; padding: 24px; margin-bottom: 24px; box-shadow: 0 4px 12px rgba(0,0,0,0.03);">
                  <h3 class="font-display" style="font-size: 18px; font-weight: 700; color: var(--color-neutral-900); margin-bottom: 16px;"><i class="fa-solid fa-history" style="color: var(--color-primary-600);"></i> Earnings History</h3>
                  ${renderEarningsHistoryContent()}
                </div>

                <!-- Reviews Section -->
                <div id="providerReviewsSection" style="background: #fff; border: 1px solid var(--color-neutral-200); border-radius: 24px; padding: 24px; box-shadow: 0 4px 12px rgba(0,0,0,0.03);">
                  <h3 class="font-display" style="font-size: 18px; font-weight: 700; color: var(--color-neutral-900); margin-bottom: 16px;"><i class="fa-solid fa-star" style="color: #f59e0b;"></i> Provider Reviews</h3>
                  ${renderReviewsContent()}
                </div>

                <!-- My Meal QR Section Card -->
                <div id="mealQrSection" style="background: #fff; border: 1px solid var(--color-neutral-200); border-radius: 24px; padding: 24px; margin-bottom: 24px; box-shadow: 0 4px 12px rgba(0,0,0,0.03);">
                  <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 16px; border-bottom: 1px solid var(--color-neutral-100); padding-bottom: 14px;">
                    <div>
                      <h3 class="font-display" style="font-size: 18px; font-weight: 700; color: var(--color-neutral-900); margin: 0 0 2px 0;">
                        <i class="fa-solid fa-qrcode" style="color: var(--color-primary-600); margin-right: 6px;"></i> My Meal QR
                      </h3>
                      <span style="font-size: 12px; color: var(--color-neutral-500);">Printable mess counter attendance QR code</span>
                    </div>
                  </div>
                  ${renderMealQrContent()}
                </div>

                <!-- Today's Meal Check-ins Section Card -->
                <div id="todaysCheckInsSection" style="background: #fff; border: 1px solid var(--color-neutral-200); border-radius: 24px; padding: 24px; margin-bottom: 24px; box-shadow: 0 4px 12px rgba(0,0,0,0.03);">
                <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 16px; border-bottom: 1px solid var(--color-neutral-100); padding-bottom: 14px;">
                    <div>
                      <h3 class="font-display" style="font-size: 18px; font-weight: 700; color: var(--color-neutral-900); margin: 0 0 2px 0;">
                        <i class="fa-solid fa-clipboard-check" style="color: var(--color-primary-600); margin-right: 6px;"></i> Today's Meal Check-ins
                      </h3>
                      <span style="font-size: 12px; color: var(--color-neutral-500);">Live attendance tracking for today</span>
                    </div>
                  </div>
                  ${renderTodayCheckInsContent()}
                </div>

                <!-- Meal Recovery Stats Section -->
                <div id="recoveryStatsSection" style="background: #fff; border: 1px solid var(--color-neutral-200); border-radius: 24px; padding: 24px; margin-bottom: 24px; box-shadow: 0 4px 12px rgba(0,0,0,0.03);">
                  <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 16px; border-bottom: 1px solid var(--color-neutral-100); padding-bottom: 14px; flex-wrap: wrap; gap: 8px;">
                    <div>
                      <h3 class="font-display" style="font-size: 18px; font-weight: 700; color: var(--color-neutral-900); margin: 0 0 2px 0;">
                        <i class="fa-solid fa-shield-halved" style="color: #047857; margin-right: 6px;"></i> Meal Recovery Stats
                      </h3>
                      <span style="font-size: 12px; color: var(--color-neutral-500);">Cumulative recovery data across all subscribers</span>
                    </div>
                  </div>
                  ${recoveryLoading ? `
                    <div style="text-align: center; padding: 28px;"><i class="fa-solid fa-spinner fa-spin" style="font-size: 22px; color: var(--color-primary-600);"></i></div>
                  ` : recoveryStats ? `
                    <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(150px, 1fr)); gap: 12px;">
                      <div style="background: #f0fdf4; border: 1px solid #bbf7d0; border-radius: 14px; padding: 14px;">
                        <span style="font-size: 11px; font-weight: 700; color: #15803d; text-transform: uppercase; display: block; margin-bottom: 4px;">Recovery Rate</span>
                        <p style="font-size: 26px; font-weight: 800; color: #166534; margin: 0;">${recoveryStats.recoveryPercentage ?? 80}%</p>
                        <span style="font-size: 11px; color: #15803d;">Current policy</span>
                      </div>
                      <div style="background: #fffbeb; border: 1px solid #fde68a; border-radius: 14px; padding: 14px;">
                        <span style="font-size: 11px; font-weight: 700; color: #92400e; text-transform: uppercase; display: block; margin-bottom: 4px;">Missed Days</span>
                        <p style="font-size: 26px; font-weight: 800; color: #78350f; margin: 0;">${recoveryStats.missedMealDays ?? 0}</p>
                        <span style="font-size: 11px; color: #92400e;">Across all subs</span>
                      </div>
                      <div style="background: #eff6ff; border: 1px solid #bfdbfe; border-radius: 14px; padding: 14px;">
                        <span style="font-size: 11px; font-weight: 700; color: #1d4ed8; text-transform: uppercase; display: block; margin-bottom: 4px;">Granted</span>
                        <p style="font-size: 26px; font-weight: 800; color: #1e40af; margin: 0;">${recoveryStats.recoveryDaysGranted ?? 0}</p>
                        <span style="font-size: 11px; color: #1d4ed8;">Total granted</span>
                      </div>
                      <div style="background: #fdf4ff; border: 1px solid #e9d5ff; border-radius: 14px; padding: 14px;">
                        <span style="font-size: 11px; font-weight: 700; color: #7e22ce; text-transform: uppercase; display: block; margin-bottom: 4px;">Used</span>
                        <p style="font-size: 26px; font-weight: 800; color: #6b21a8; margin: 0;">${recoveryStats.recoveryDaysUsed ?? 0}</p>
                        <span style="font-size: 11px; color: #7e22ce;">Consumed</span>
                      </div>
                      <div style="background: #f0fdf4; border: 1px solid #86efac; border-radius: 14px; padding: 14px;">
                        <span style="font-size: 11px; font-weight: 700; color: #15803d; text-transform: uppercase; display: block; margin-bottom: 4px;">Remaining</span>
                        <p style="font-size: 26px; font-weight: 800; color: #166534; margin: 0;">${recoveryStats.recoveryDaysRemaining ?? 0}</p>
                        <span style="font-size: 11px; color: #15803d;">Pending use</span>
                      </div>
                    </div>
                  ` : `
                    <div style="text-align: center; padding: 28px; background: var(--color-neutral-50); border: 1px dashed var(--color-neutral-300); border-radius: 16px;">
                      <p style="font-size: 13px; color: var(--color-neutral-500); margin: 0;">No recovery records yet. Process a subscription to generate recovery data.</p>
                    </div>
                  `}
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
          mobileSheet === 'HOSTEL_IMAGES' ? 'Hostel Images' :
          mobileSheet === 'MEAL_QR' ? 'My Meal QR' :
          mobileSheet === 'TODAYS_CHECKINS' ? "Today's Meal Check-ins" :
            mobileSheet === 'SUBSCRIBERS' ? 'Subscribers' :
              mobileSheet === 'WEEKLY_MENU' ? 'Weekly Menu Editor' :
                mobileSheet === 'REVIEWS' ? 'Provider Reviews' :
                  mobileSheet === 'EARNINGS_HISTORY' ? 'Provider Earnings History' :
                    'Details'}
              </h3>
              <button class="close-mobile-sheet-btn" style="background: none; border: none; font-size: 24px; cursor: pointer; color: var(--color-neutral-500); padding: 4px 8px;">&times;</button>
            </div>
            ${mobileSheet === 'MANAGE_PG' ? renderManagePgContent() :
          mobileSheet === 'HOSTEL_IMAGES' ? renderHostelImagesContent() :
          mobileSheet === 'MEAL_QR' ? renderMealQrContent() :
          mobileSheet === 'TODAYS_CHECKINS' ? renderTodayCheckInsContent() :
            mobileSheet === 'SUBSCRIBERS' ? renderSubscribersContent() :
              mobileSheet === 'WEEKLY_MENU' ? renderWeeklyMenuContent() :
                mobileSheet === 'REVIEWS' ? renderReviewsContent() :
                  mobileSheet === 'EARNINGS_HISTORY' ? `
                    <div style="display: flex; flex-direction: column; gap: 16px;">
                      ${renderEarningsSummaryContent()}
                      <div>
                        <h4 style="font-size: 14px; font-weight: 700; color: var(--color-neutral-900); margin-bottom: 10px; display: flex; align-items: center; gap: 6px;">
                          <i class="fa-solid fa-history" style="color: var(--color-primary-600);"></i> Earnings History
                        </h4>
                        ${renderEarningsHistoryContent()}
                      </div>
                    </div>
                  ` :
                    renderManagePgContent()
        }
          </div>
        </div>
      ` : ''}

      <!-- Modal: Controlled Check-in Correction -->
      <div id="correctionModal" style="display: ${showCorrectionModal ? 'flex' : 'none'}; position: fixed; inset: 0; background: rgba(0,0,0,0.6); backdrop-filter: blur(4px); align-items: center; justify-content: center; z-index: 2100; padding: 16px;">
        <div style="background: #fff; border-radius: 24px; max-width: 480px; width: 100%; padding: 28px; box-shadow: 0 20px 50px rgba(0,0,0,0.25);">
          <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 16px;">
            <div style="display: flex; align-items: center; gap: 8px;">
              <div style="width: 36px; height: 36px; border-radius: 10px; background: var(--color-primary-50); color: var(--color-primary-600); display: flex; align-items: center; justify-content: center; font-size: 16px;">
                <i class="fa-solid fa-wrench"></i>
              </div>
              <h3 class="font-display" style="font-size: 18px; font-weight: 800; color: var(--color-neutral-900); margin: 0;">Correct Meal Check-in</h3>
            </div>
            <button id="closeCorrectionModalBtn" type="button" style="background: none; border: none; font-size: 20px; cursor: pointer; color: var(--color-neutral-400);">&times;</button>
          </div>

          <p style="font-size: 13px; color: var(--color-neutral-600); line-height: 1.5; margin-bottom: 16px;">
            Use this controlled correction if a genuine scanner or network glitch prevented the student's check-in from recording. An audited record will be preserved.
          </p>

          <div style="background: var(--color-neutral-50); border: 1px solid var(--color-neutral-200); border-radius: 12px; padding: 12px; margin-bottom: 16px;">
            <div style="font-size: 12px; color: var(--color-neutral-500); margin-bottom: 2px;">Subscriber</div>
            <strong style="font-size: 14px; color: var(--color-neutral-900);">${escapeHtml(correctionSubTarget?.studentName || 'Subscriber')}</strong>
          </div>

          <form id="correctionForm">
            <div style="margin-bottom: 20px;">
              <label style="font-size: 12px; font-weight: 700; color: var(--color-neutral-700); display: block; margin-bottom: 6px;">
                Justification Reason (Mandatory) *
              </label>
              <textarea id="correctionReasonInput" rows="3" required placeholder="e.g. Camera scanner glitch reported by student at lunch counter" style="width: 100%; padding: 10px 12px; border: 1px solid var(--color-neutral-300); border-radius: 10px; font-size: 13px; resize: vertical; box-sizing: border-box;">${escapeHtml(correctionReasonInput)}</textarea>
              <span style="font-size: 11px; color: var(--color-neutral-500); margin-top: 4px; display: block;">
                Minimum 5 characters. This reason is logged to the immutable audit trail.
              </span>
            </div>

            <div style="display: flex; gap: 10px; justify-content: flex-end;">
              <button type="button" id="cancelCorrectionModalBtn" class="btn-outline-action" style="padding: 10px 16px;">Cancel</button>
              <button type="submit" id="submitCorrectionBtn" class="btn-primary-action" style="padding: 10px 20px;" ${isSubmittingCorrection ? 'disabled' : ''}>
                ${isSubmittingCorrection ? '<i class="fa-solid fa-spinner fa-spin"></i> Saving...' : '<i class="fa-solid fa-circle-check"></i> Record Audited Correction'}
              </button>
            </div>
          </form>
        </div>
      </div>

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

            <div>
              <label for="hDescription" style="font-size: 12px; font-weight: 700; display: block; margin-bottom: 4px;">About This Kitchen / Description</label>
              <textarea id="hDescription" rows="3" maxlength="1000" class="btn-outline-action" style="width: 100%; background: #fff; padding: 10px 14px; font-size: 13px; resize: vertical; min-height: 80px; text-align: left;" placeholder="Tell students about your hostel/mess..."></textarea>
              <div style="display: flex; justify-content: flex-end; margin-top: 2px;">
                <span id="hDescriptionCount" style="font-size: 11px; color: var(--color-neutral-400);">0 / 1000 characters</span>
              </div>
            </div>

            <div>
              <label style="font-size: 12px; font-weight: 700; display: block; margin-bottom: 4px;">Hostel Amenities & Facilities</label>
              <div style="display: grid; grid-template-columns: repeat(auto-fill, minmax(130px, 1fr)); gap: 6px; margin-bottom: 8px;">
                ${COMMON_AMENITIES.map((amenity, idx) => `
                  <label for="hAmenity_${idx}" style="display: flex; align-items: center; gap: 6px; padding: 6px 10px; border: 1px solid var(--color-neutral-200); border-radius: 8px; cursor: pointer; background: #fff; font-size: 12px; font-weight: 600; color: var(--color-neutral-800);">
                    <input type="checkbox" id="hAmenity_${idx}" name="hAmenities" value="${escapeHtml(amenity)}" style="width: 15px; height: 15px; accent-color: var(--color-primary-600); cursor: pointer;" />
                    <span>${escapeHtml(amenity)}</span>
                  </label>
                `).join('')}
              </div>

              <div style="margin-top: 6px;">
                <span style="font-size: 11px; font-weight: 700; color: var(--color-neutral-700); display: block; margin-bottom: 4px;">Custom Amenities</span>
                <div id="hCustomAmenitiesList" style="display: flex; flex-direction: column; gap: 6px; margin-bottom: 6px;"></div>
                <button type="button" id="hAddCustomAmenityBtn" class="btn-outline-action" style="font-size: 12px; font-weight: 700; padding: 6px 12px; background: #fff; border-radius: 8px;">
                  <i class="fa-solid fa-plus"></i> Add Another Amenity
                </button>
              </div>
            </div>

            <button type="submit" class="btn-primary-action" style="width: 100%; justify-content: center; padding: 12px; font-size: 15px; margin-top: 8px;">
              Submit for Admin Approval
            </button>
          </form>
        </div>
      </div>

      <!-- Modal: Edit Mess Profile & Amenities -->
      <div id="editProfileModal" style="display: ${showEditProfileModal ? 'flex' : 'none'}; position: fixed; inset: 0; background: rgba(0,0,0,0.55); align-items: center; justify-content: center; z-index: 2000; padding: 20px;">
        <div style="background: #fff; border-radius: 24px; max-width: 560px; width: 100%; padding: 28px; box-shadow: 0 20px 40px rgba(0,0,0,0.2); max-height: 90vh; overflow-y: auto;">
          <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 20px;">
            <h3 class="font-display" style="font-size: 20px; font-weight: 800; color: var(--color-neutral-900);">Edit Kitchen Profile & Amenities</h3>
            <button id="closeEditProfileModalBtn" style="background: none; border: none; font-size: 22px; cursor: pointer; color: var(--color-neutral-500);">&times;</button>
          </div>

          <form id="editProfileForm" style="display: flex; flex-direction: column; gap: 16px;">
            <div>
              <label for="editProfileDescription" style="font-size: 13px; font-weight: 700; color: var(--color-neutral-800); display: block; margin-bottom: 6px;">About This Kitchen / Description</label>
              <textarea id="editProfileDescription" rows="4" maxlength="1000" class="btn-outline-action" style="width: 100%; background: #fff; padding: 12px 16px; font-size: 14px; resize: vertical; min-height: 90px; text-align: left;" placeholder="Tell students about your hostel/mess, food quality, timings, dining environment, and anything else they should know.">${escapeHtml(selectedHostel?.description || '')}</textarea>
              <div style="display: flex; justify-content: flex-end; margin-top: 4px;">
                <span id="editProfileDescriptionCount" style="font-size: 11px; color: var(--color-neutral-400);">${(selectedHostel?.description || '').length} / 1000 characters</span>
              </div>
            </div>

            <div>
              <label style="font-size: 13px; font-weight: 700; color: var(--color-neutral-800); display: block; margin-bottom: 6px;">Hostel Amenities & Facilities</label>
              <div style="display: grid; grid-template-columns: repeat(auto-fill, minmax(130px, 1fr)); gap: 8px; margin-bottom: 12px;">
                ${COMMON_AMENITIES.map((amenity, idx) => {
                  const isChecked = (selectedHostel?.amenities || []).some((a: string) => a.trim().toLowerCase() === amenity.toLowerCase());
                  return `
                    <label for="editAmenity_${idx}" style="display: flex; align-items: center; gap: 8px; padding: 8px 12px; border: 1px solid var(--color-neutral-200); border-radius: 10px; cursor: pointer; background: #fff; font-size: 13px; font-weight: 600; color: var(--color-neutral-800);">
                      <input type="checkbox" id="editAmenity_${idx}" name="editAmenities" value="${escapeHtml(amenity)}" ${isChecked ? 'checked' : ''} style="width: 16px; height: 16px; accent-color: var(--color-primary-600); cursor: pointer;" />
                      <span>${escapeHtml(amenity)}</span>
                    </label>
                  `;
                }).join('')}
              </div>

              <div style="margin-top: 8px;">
                <span style="font-size: 12px; font-weight: 700; color: var(--color-neutral-700); display: block; margin-bottom: 6px;">Custom Amenities</span>
                <div id="editProfileCustomAmenitiesList" style="display: flex; flex-direction: column; gap: 8px; margin-bottom: 8px;"></div>
                <button type="button" id="editProfileAddCustomAmenityBtn" class="btn-outline-action" style="font-size: 13px; font-weight: 700; padding: 8px 14px; background: #fff; border-radius: 8px;">
                  <i class="fa-solid fa-plus"></i> Add Another Amenity
                </button>
              </div>
            </div>

            <div style="display: flex; justify-content: flex-end; gap: 12px; margin-top: 12px;">
              <button type="button" id="cancelEditProfileBtn" class="btn-outline-action" style="padding: 10px 18px; font-size: 14px;">Cancel</button>
              <button type="submit" class="btn-primary-action" style="padding: 10px 20px; font-size: 14px;">Save Changes</button>
            </div>
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

      <!-- Modal: Subscriber Details Popup -->
      <div id="subscriberDetailsModal" class="subscriber-details-modal-overlay" style="display: ${showSubscriberDetailsModal && selectedSubscriberForDetails ? 'flex' : 'none'}; position: fixed; inset: 0; background: rgba(0,0,0,0.55); align-items: center; justify-content: center; z-index: 2100; padding: 16px; box-sizing: border-box;">
        <div id="subscriberDetailsCard" class="subscriber-details-card" style="background: #fff; border-radius: 24px; max-width: 640px; width: 100%; padding: 24px; box-shadow: 0 20px 40px rgba(0,0,0,0.25); max-height: 90vh; overflow-y: auto; display: flex; flex-direction: column; gap: 18px; box-sizing: border-box;">
          <div style="display: flex; justify-content: space-between; align-items: center; border-bottom: 1px solid var(--color-neutral-200); padding-bottom: 14px;">
            <div style="display: flex; align-items: center; gap: 10px;">
              <div style="width: 36px; height: 36px; border-radius: 10px; background: var(--color-primary-50); color: var(--color-primary-600); display: flex; align-items: center; justify-content: center; font-size: 16px;">
                <i class="fa-solid fa-id-card"></i>
              </div>
              <h3 class="font-display" style="font-size: 18px; font-weight: 800; color: var(--color-neutral-900); margin: 0;">Subscriber Details</h3>
            </div>
            <button id="closeSubscriberDetailsXBtn" style="background: none; border: none; font-size: 24px; cursor: pointer; color: var(--color-neutral-500); padding: 4px 8px; line-height: 1;">&times;</button>
          </div>

          ${selectedSubscriberForDetails ? `
            <div style="display: flex; flex-direction: column; gap: 14px; font-size: 13px;">
              <!-- Student Name & Phone -->
              <div style="background: var(--color-neutral-50); border: 1px solid var(--color-neutral-200); border-radius: 14px; padding: 14px; display: flex; flex-direction: column; gap: 8px;">
                <div>
                  <span style="font-size: 11px; font-weight: 700; color: var(--color-neutral-500); text-transform: uppercase; letter-spacing: 0.5px; display: block; margin-bottom: 2px;">Student Name</span>
                  <strong style="font-size: 15px; color: var(--color-neutral-900); word-break: break-word;">${escapeHtml(selectedSubscriberForDetails.student?.name || selectedSubscriberForDetails.student?.email || 'Not available')}</strong>
                </div>
                <div>
                  <span style="font-size: 11px; font-weight: 700; color: var(--color-neutral-500); text-transform: uppercase; letter-spacing: 0.5px; display: block; margin-bottom: 2px;">Phone Number</span>
                  <span style="font-size: 14px; color: var(--color-neutral-800); font-weight: 600; word-break: break-word;">
                    <i class="fa-solid fa-phone" style="color: var(--color-primary-600); margin-right: 4px;"></i> ${escapeHtml(selectedSubscriberForDetails.student?.phone || 'Not available')}
                  </span>
                </div>
              </div>

              <!-- Plan & Amount -->
              <div class="subscriber-details-grid-2" style="display: grid; grid-template-columns: 1fr 1fr; gap: 10px;">
                <div style="background: var(--color-neutral-50); border: 1px solid var(--color-neutral-200); border-radius: 12px; padding: 12px;">
                  <span style="font-size: 11px; font-weight: 700; color: var(--color-neutral-500); text-transform: uppercase; letter-spacing: 0.5px; display: block; margin-bottom: 2px;">Subscription Plan</span>
                  <strong style="font-size: 13px; color: var(--color-neutral-900); word-break: break-word;">${escapeHtml(selectedSubscriberForDetails.mealPlan?.title || selectedSubscriberForDetails.planType || 'Not available')}</strong>
                </div>
                <div style="background: var(--color-neutral-50); border: 1px solid var(--color-neutral-200); border-radius: 12px; padding: 12px;">
                  <span style="font-size: 11px; font-weight: 700; color: var(--color-neutral-500); text-transform: uppercase; letter-spacing: 0.5px; display: block; margin-bottom: 2px;">Amount Paid</span>
                  <strong style="font-size: 14px; color: var(--color-primary-600); word-break: break-word;">${escapeHtml(getSubscriberAmount(selectedSubscriberForDetails))}</strong>
                </div>
              </div>

              <!-- Payment & Subscription Status -->
              <div class="subscriber-details-grid-2" style="display: grid; grid-template-columns: 1fr 1fr; gap: 10px;">
                <div style="background: var(--color-neutral-50); border: 1px solid var(--color-neutral-200); border-radius: 12px; padding: 12px;">
                  <span style="font-size: 11px; font-weight: 700; color: var(--color-neutral-500); text-transform: uppercase; letter-spacing: 0.5px; display: block; margin-bottom: 4px;">Payment Status</span>
                  <span style="font-size: 11px; font-weight: 800; padding: 3px 8px; border-radius: 999px; display: inline-block; ${selectedSubscriberForDetails.paymentStatus === 'PAID' ? 'background: #d1fae5; color: #047857;' : 'background: #fee2e2; color: #dc2626;'}">
                    ${escapeHtml(selectedSubscriberForDetails.paymentStatus || (selectedSubscriberForDetails.amountPaid ? 'PAID' : 'Not available'))}
                  </span>
                </div>
                <div style="background: var(--color-neutral-50); border: 1px solid var(--color-neutral-200); border-radius: 12px; padding: 12px;">
                  <span style="font-size: 11px; font-weight: 700; color: var(--color-neutral-500); text-transform: uppercase; letter-spacing: 0.5px; display: block; margin-bottom: 4px;">Subscription Status</span>
                  <span style="font-size: 11px; font-weight: 800; padding: 3px 8px; border-radius: 999px; display: inline-block; ${getSubStatusStyle((selectedSubscriberForDetails.status || 'UNKNOWN').toUpperCase())}">
                    ${escapeHtml((selectedSubscriberForDetails.status || 'UNKNOWN').toUpperCase())}
                  </span>
                </div>
              </div>

              <!-- Dates -->
              <div style="background: var(--color-neutral-50); border: 1px solid var(--color-neutral-200); border-radius: 12px; padding: 12px; display: flex; flex-direction: column; gap: 6px;">
                <div style="display: flex; justify-content: space-between; align-items: center;">
                  <span style="color: var(--color-neutral-500); font-weight: 600;">Start Date:</span>
                  <strong style="color: var(--color-neutral-900);">${formatSubscriberDate(selectedSubscriberForDetails.startDate)}</strong>
                </div>
                <div style="display: flex; justify-content: space-between; align-items: center;">
                  <span style="color: var(--color-neutral-500); font-weight: 600;">End Date:</span>
                  <strong style="color: var(--color-neutral-900);">${formatSubscriberDate(selectedSubscriberForDetails.endDate)}</strong>
                </div>
              </div>

              <!-- Meal Recovery — Process Button -->
              <div style="background: linear-gradient(135deg, #f0fdf4, #ecfdf5); border: 1px solid #bbf7d0; border-radius: 14px; padding: 14px; display: flex; flex-direction: column; gap: 10px;">
                <div style="display: flex; justify-content: space-between; align-items: flex-start; flex-wrap: wrap; gap: 8px;">
                  <div style="display: flex; align-items: center; gap: 8px;">
                    <div style="width: 28px; height: 28px; border-radius: 8px; background: #d1fae5; color: #047857; display: flex; align-items: center; justify-content: center; font-size: 13px;">
                      <i class="fa-solid fa-shield-halved"></i>
                    </div>
                    <div>
                      <h4 style="font-size: 14px; font-weight: 800; color: var(--color-neutral-900); margin: 0;">Meal Recovery</h4>
                      <span style="font-size: 11px; color: var(--color-neutral-500);">Calculate &amp; grant recovery days for missed meals</span>
                    </div>
                  </div>
                  <button
                    type="button"
                    class="process-recovery-btn btn-outline-action"
                    data-sub-id="${escapeHtml(selectedSubscriberForDetails.id)}"
                    style="padding: 7px 14px; font-size: 12px; font-weight: 800; border-radius: 10px; background: #fff; color: #047857; border-color: #86efac; cursor: pointer; white-space: nowrap;"
                    ${processingRecoverySubId === selectedSubscriberForDetails.id ? 'disabled' : ''}
                  >
                    <i class="fa-solid fa-shield-halved"></i>
                    ${processingRecoverySubId === selectedSubscriberForDetails.id ? '<i class="fa-solid fa-spinner fa-spin"></i> Processing...' : 'Process Recovery'}
                  </button>
                </div>
                ${recoveryProcessResult ? `
                  <div style="font-size: 12px; font-weight: 700; padding: 8px 12px; border-radius: 10px; background: ${
                    recoveryProcessResult.type === 'success' ? '#d1fae5' : recoveryProcessResult.type === 'info' ? '#dbeafe' : '#fee2e2'
                  }; color: ${
                    recoveryProcessResult.type === 'success' ? '#047857' : recoveryProcessResult.type === 'info' ? '#1d4ed8' : '#dc2626'
                  };">
                    ${escapeHtml(recoveryProcessResult.message)}
                  </div>
                ` : ''}
              </div>

              <!-- Whole Month Attendance Section -->
              <div style="border-top: 1px solid var(--color-neutral-200); padding-top: 16px; display: flex; flex-direction: column; gap: 12px;">
                <div style="display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: 8px;">
                  <div style="display: flex; align-items: center; gap: 8px;">
                    <div style="width: 30px; height: 30px; border-radius: 8px; background: var(--color-primary-50); color: var(--color-primary-600); display: flex; align-items: center; justify-content: center; font-size: 13px;">
                      <i class="fa-solid fa-calendar-check"></i>
                    </div>
                    <div>
                      <h4 style="font-size: 15px; font-weight: 700; color: var(--color-neutral-900); margin: 0;">
                        Monthly Attendance History
                      </h4>
                      <span style="font-size: 11px; color: var(--color-neutral-500);">Full subscription check-in roster</span>
                    </div>
                  </div>
                  ${subscriberAttendanceData ? `
                    <span style="font-size: 12px; font-weight: 800; color: var(--color-primary-700); background: var(--color-primary-50); padding: 4px 10px; border-radius: 999px; border: 1px solid var(--color-primary-200); display: inline-flex; align-items: center; gap: 5px;">
                      <i class="fa-solid fa-chart-pie" style="font-size: 11px;"></i> ${subscriberAttendanceData.attendanceRate}% Attendance Rate
                    </span>
                  ` : ''}
                </div>

                ${subscriberAttendanceLoading ? `
                  <div style="text-align: center; padding: 32px; background: var(--color-neutral-50); border-radius: 16px; border: 1px dashed var(--color-neutral-300);">
                    <i class="fa-solid fa-spinner fa-spin" style="font-size: 22px; color: var(--color-primary-600); margin-bottom: 8px; display: block;"></i>
                    <span style="font-size: 12px; color: var(--color-neutral-600); font-weight: 600;">Loading subscriber attendance history...</span>
                  </div>
                ` : subscriberAttendanceError ? `
                  <div style="text-align: center; padding: 20px; background: #fef2f2; border: 1px solid #fecaca; border-radius: 14px;">
                    <p style="color: #dc2626; font-size: 12px; margin: 0 0 8px 0; font-weight: 600;">${escapeHtml(subscriberAttendanceError)}</p>
                    <button type="button" class="retry-sub-attendance-btn btn-outline-action" data-sub-id="${escapeHtml(selectedSubscriberForDetails.id)}" style="padding: 5px 14px; font-size: 11px; font-weight: 700; border-radius: 8px; background: #fff;">
                      <i class="fa-solid fa-rotate-right"></i> Retry
                    </button>
                  </div>
                ` : !subscriberAttendanceData || !subscriberAttendanceData.days || subscriberAttendanceData.days.length === 0 ? `
                  <div style="text-align: center; padding: 24px; background: var(--color-neutral-50); border: 1px dashed var(--color-neutral-300); border-radius: 14px;">
                    <p style="font-size: 12px; color: var(--color-neutral-500); margin: 0;">No attendance records found for this subscription cycle.</p>
                  </div>
                ` : `
                  <!-- Compact DayPicker Meal Calendar -->
                  <div id="subscriber-meal-calendar-mount" style="width: 100%; display: flex; justify-content: center; margin-top: 8px;"></div>
                `}
              </div>
            </div>
          ` : ''}

          <div style="display: flex; justify-content: flex-end; padding-top: 8px; border-top: 1px solid var(--color-neutral-200);">
            <button type="button" id="closeSubscriberDetailsBtn" class="btn-primary-action" style="padding: 10px 24px; font-size: 14px; justify-content: center; width: 100%;">
              Close
            </button>
          </div>
        </div>
      </div>

      <!-- Hidden Inputs for Native Mobile Camera, Gallery, and Replacement Pickers -->
      <input type="file" id="hostelCameraInput" accept="image/*" capture="environment" style="display: none;" />
      <input type="file" id="hostelGalleryInput" accept="image/*" multiple style="display: none;" />
      <input type="file" id="hostelReplaceCameraInput" accept="image/*" capture="environment" style="display: none;" />
      <input type="file" id="hostelReplaceGalleryInput" accept="image/*" style="display: none;" />
      <!-- HTML5 Live Camera Viewfinder Modal (Desktop WebCam) -->
      <div id="liveCameraModal" style="display: none; position: fixed; inset: 0; background: rgba(0,0,0,0.85); align-items: center; justify-content: center; z-index: 3000; padding: 16px;">
        <div style="background: #111827; border-radius: 24px; max-width: 500px; width: 100%; overflow: hidden; box-shadow: 0 25px 50px -12px rgba(0,0,0,0.5); border: 1px solid #374151; display: flex; flex-direction: column;">
          <div style="padding: 16px 20px; display: flex; justify-content: space-between; align-items: center; background: #1f2937; border-bottom: 1px solid #374151;">
            <h3 style="margin: 0; color: #fff; font-size: 16px; font-weight: 700; display: flex; align-items: center; gap: 8px;">
              <i class="fa-solid fa-camera" style="color: #f97316;"></i> Camera Viewfinder
            </h3>
            <button id="closeLiveCameraBtn" type="button" style="background: none; border: none; color: #9ca3af; font-size: 24px; cursor: pointer; padding: 0 4px;">&times;</button>
          </div>
          
          <div style="position: relative; width: 100%; aspect-ratio: 4/3; background: #000; display: flex; align-items: center; justify-content: center; overflow: hidden;">
            <video id="liveCameraVideo" autoplay playsinline muted style="width: 100%; height: 100%; object-fit: cover;"></video>
            <canvas id="liveCameraCanvas" style="display: none;"></canvas>
            <div id="cameraLoadingSpinner" style="position: absolute; color: #fff; font-size: 14px; font-weight: 600; display: flex; flex-direction: column; align-items: center; gap: 8px;">
              <i class="fa-solid fa-spinner fa-spin" style="font-size: 28px; color: #f97316;"></i>
              Starting Camera...
            </div>
          </div>
          
          <div style="padding: 16px 20px; background: #1f2937; display: flex; justify-content: space-around; align-items: center;">
            <button id="snapCameraButton" type="button" style="background: #ea580c; border: none; color: #fff; width: 60px; height: 60px; border-radius: 50%; font-size: 22px; cursor: pointer; display: flex; align-items: center; justify-content: center; box-shadow: 0 0 0 4px rgba(234,88,12,0.3);" title="Take photo">
              <i class="fa-solid fa-camera"></i>
            </button>
            <button id="cancelLiveCameraBtn" type="button" style="background: #374151; border: none; color: #fff; padding: 10px 20px; border-radius: 12px; font-size: 13px; font-weight: 600; cursor: pointer;">
              Cancel
            </button>
          </div>
        </div>
      </div>
      <!-- Modal: Replace Hostel Image -->
      <div id="replaceImageModal" style="display: ${imageToReplace ? 'flex' : 'none'}; position: fixed; inset: 0; background: rgba(0,0,0,0.65); align-items: center; justify-content: center; z-index: 2200; padding: 16px;">
        <div style="background: #fff; border-radius: 24px; max-width: 460px; width: 100%; padding: 24px; box-shadow: 0 20px 40px rgba(0,0,0,0.3); max-height: 90vh; overflow-y: auto;">
          <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 16px; border-bottom: 1px solid var(--color-neutral-200); padding-bottom: 12px;">
            <h3 class="font-display" style="font-size: 18px; font-weight: 800; color: var(--color-neutral-900); margin: 0; display: flex; align-items: center; gap: 8px;">
              <i class="fa-solid fa-arrows-rotate" style="color: var(--color-primary-600);"></i> Replace Hostel Photo
            </h3>
            <button class="cancel-replace-x-btn" style="background: none; border: none; font-size: 24px; cursor: pointer; color: var(--color-neutral-500); padding: 4px 8px;">&times;</button>
          </div>

          <!-- Current Photo vs New Photo Comparison -->
          <div style="display: grid; grid-template-columns: ${replacePreviewUrl ? '1fr 1fr' : '1fr'}; gap: 12px; margin-bottom: 16px;">
            <div>
              <span style="font-size: 11px; font-weight: 700; color: var(--color-neutral-500); display: block; margin-bottom: 4px;">CURRENT PHOTO</span>
              <div style="width: 100%; aspect-ratio: 4/3; border-radius: 12px; overflow: hidden; background: #000; border: 1px solid var(--color-neutral-200);">
                <img src="${getSafeImageUrl(imageToReplace?.imageUrl)}" alt="Current photo" style="width: 100%; height: 100%; object-fit: cover;" />
              </div>
            </div>
            ${replacePreviewUrl ? `
              <div>
                <span style="font-size: 11px; font-weight: 700; color: var(--color-primary-600); display: block; margin-bottom: 4px;">NEW PHOTO PREVIEW</span>
                <div style="width: 100%; aspect-ratio: 4/3; border-radius: 12px; overflow: hidden; background: #000; border: 2px solid var(--color-primary-500);">
                  <img src="${replacePreviewUrl}" alt="New replacement preview" style="width: 100%; height: 100%; object-fit: cover;" />
                </div>
              </div>
            ` : ''}
          </div>

          <!-- Action Buttons to Choose / Take New Photo -->
          <div class="mobile-only-section" style="margin-bottom: 16px;">
            <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 10px;">
              <button type="button" class="replace-take-photo-btn btn-primary-action" style="padding: 10px; font-size: 13px; font-weight: 700; border-radius: 12px; justify-content: center; cursor: pointer; display: flex; align-items: center; gap: 6px;">
                <i class="fa-solid fa-camera"></i> 📷 Take Photo
              </button>
              <button type="button" class="replace-gallery-btn btn-outline-action" style="padding: 10px; font-size: 13px; font-weight: 700; border-radius: 12px; justify-content: center; background: #fff; cursor: pointer; display: flex; align-items: center; gap: 6px;">
                <i class="fa-solid fa-images"></i> 🖼️ From Gallery
              </button>
            </div>
          </div>
          <div class="desktop-only-section" style="margin-bottom: 16px;">
            <button type="button" class="replace-gallery-btn btn-primary-action" style="width: 100%; padding: 12px; font-size: 13px; font-weight: 700; border-radius: 12px; justify-content: center; cursor: pointer; display: flex; align-items: center; gap: 8px;">
              <i class="fa-solid fa-cloud-arrow-up"></i> Choose Replacement Image
            </button>
          </div>

          ${replaceFile ? `
            <!-- Replacement File Details -->
            <div style="background: var(--color-neutral-50); border: 1px solid var(--color-neutral-200); border-radius: 12px; padding: 12px; margin-bottom: 16px;">
              <div style="display: flex; justify-content: space-between; align-items: center; font-size: 12px;">
                <span style="font-weight: 700; color: var(--color-neutral-800); overflow: hidden; text-overflow: ellipsis; white-space: nowrap; max-width: 260px;">
                  <i class="fa-solid fa-file-image" style="color: var(--color-primary-600); margin-right: 4px;"></i> ${escapeHtml(replaceFile.name)}
                </span>
                <span style="font-weight: 600; color: var(--color-neutral-500);">
                  ${(replaceFile.size / (1024 * 1024)).toFixed(2)} MB
                </span>
              </div>
            </div>
          ` : ''}

          <!-- Progress Bar if Uploading Replacement -->
          ${isReplacingImage ? `
            <div style="margin-bottom: 16px;">
              <div style="display: flex; justify-content: space-between; font-size: 12px; font-weight: 700; margin-bottom: 4px; color: var(--color-primary-700);">
                <span>Uploading replacement photo...</span>
                <span>${replaceProgress}%</span>
              </div>
              <div style="width: 100%; height: 8px; background: #e2e8f0; border-radius: 999px; overflow: hidden;">
                <div id="replaceProgressBar" style="width: ${replaceProgress}%; height: 100%; background: var(--color-primary-600); transition: width 0.2s ease;"></div>
              </div>
            </div>
          ` : ''}

          ${replaceErrorMessage ? `
            <div style="background: #fee2e2; border: 1px solid #fca5a5; color: #dc2626; padding: 8px 12px; border-radius: 10px; font-size: 12px; font-weight: 600; margin-bottom: 14px;">
              ${escapeHtml(replaceErrorMessage)}
            </div>
          ` : ''}

          <div style="display: flex; justify-content: flex-end; gap: 10px;">
            <button type="button" class="cancel-replace-image-btn btn-outline-action" style="padding: 10px 18px; font-size: 13px;" ${isReplacingImage ? 'disabled' : ''}>
              Cancel
            </button>
            <button type="button" class="confirm-replace-image-btn btn-primary-action" style="padding: 10px 24px; font-size: 13px;" ${!replaceFile || isReplacingImage ? 'disabled' : ''}>
              ${isReplacingImage ? '<i class="fa-solid fa-spinner fa-spin"></i> Replacing...' : '<i class="fa-solid fa-cloud-arrow-up"></i> Upload Replacement'}
            </button>
          </div>
        </div>
      </div>

      <!-- Modal: Delete Image Confirmation -->
      <div id="deleteImageModal" style="display: ${imageToDelete ? 'flex' : 'none'}; position: fixed; inset: 0; background: rgba(0,0,0,0.65); align-items: center; justify-content: center; z-index: 2200; padding: 16px;">
        <div style="background: #fff; border-radius: 24px; max-width: 400px; width: 100%; padding: 24px; box-shadow: 0 20px 40px rgba(0,0,0,0.3); text-align: center;">
          <div style="width: 52px; height: 52px; border-radius: 50%; background: #fee2e2; color: #dc2626; display: flex; align-items: center; justify-content: center; font-size: 24px; margin: 0 auto 16px;">
            <i class="fa-solid fa-trash-can"></i>
          </div>
          <h3 class="font-display" style="font-size: 18px; font-weight: 800; color: var(--color-neutral-900); margin: 0 0 8px 0;">Delete this hostel photo?</h3>
          <p style="font-size: 13px; color: var(--color-neutral-600); margin: 0 0 16px 0;">
            This photo will be permanently removed from your hostel listing.
          </p>
          ${imageToDelete?.imageUrl ? `
            <div style="width: 140px; height: 105px; margin: 0 auto 18px; border-radius: 12px; overflow: hidden; border: 1px solid var(--color-neutral-200); position: relative;">
              <img src="${getSafeImageUrl(imageToDelete.imageUrl)}" alt="Delete preview" style="width: 100%; height: 100%; object-fit: cover;" />
              <span style="position: absolute; bottom: 4px; left: 4px; font-size: 9px; font-weight: 800; background: rgba(0,0,0,0.7); color: #fff; padding: 2px 6px; border-radius: 4px;">
                ${escapeHtml(imageToDelete.imageCategory || 'Photo')}
              </span>
            </div>
          ` : ''}
          <div style="display: flex; justify-content: center; gap: 12px;">
            <button type="button" class="cancel-delete-image-btn btn-outline-action" style="padding: 10px 18px; font-size: 14px;" ${isDeletingImage ? 'disabled' : ''}>
              Cancel
            </button>
            <button type="button" class="confirm-delete-image-btn btn-primary-action" style="padding: 10px 24px; font-size: 14px; background: #dc2626; border-color: #dc2626;" ${isDeletingImage ? 'disabled' : ''}>
              ${isDeletingImage ? '<i class="fa-solid fa-spinner fa-spin"></i> Deleting...' : '<i class="fa-solid fa-trash-can"></i> Delete'}
            </button>
          </div>
        </div>
      </div>

      <!-- Modal: Full-Screen Lightbox View -->
      <div id="lightboxModal" style="display: ${lightboxImage ? 'flex' : 'none'}; position: fixed; inset: 0; background: rgba(0,0,0,0.88); align-items: center; justify-content: center; z-index: 2300; padding: 20px;">
        <div style="position: relative; max-width: 90vw; max-height: 90vh; display: flex; flex-direction: column; align-items: center;">
          <button id="closeLightboxBtn" style="position: absolute; top: -40px; right: 0; background: none; border: none; color: #fff; font-size: 32px; cursor: pointer; padding: 4px 8px;">&times;</button>
          <img src="${getSafeImageUrl(lightboxImage?.imageUrl)}" alt="Full preview" style="max-width: 100%; max-height: 80vh; object-fit: contain; border-radius: 12px; box-shadow: 0 20px 50px rgba(0,0,0,0.5);" />
          <div style="margin-top: 12px; display: flex; align-items: center; gap: 10px;">
            <span style="font-size: 13px; font-weight: 700; color: #fff; background: var(--color-primary-600); padding: 4px 14px; border-radius: 999px;">
              ${escapeHtml(lightboxImage?.imageCategory || 'Hostel Photo')}
            </span>
            ${lightboxImage?.originalFileName ? `
              <span style="font-size: 12px; color: rgba(255,255,255,0.8);">
                ${escapeHtml(lightboxImage.originalFileName)}
              </span>
            ` : ''}
          </div>
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
          await fetchHostelImages();
          await fetchMealQr();
          await fetchTodayCheckIns();
          await fetchRecoveryStats();
          render();
        }
      });
    });

    // Mobile Sheet Open Triggers
    document.querySelectorAll('.open-meal-qr-sheet-btn').forEach((btn) => {
      btn.addEventListener('click', () => {
        mobileSheet = 'MEAL_QR';
        render();
      });
    });

    document.querySelectorAll('.open-todays-checkins-sheet-btn').forEach((btn) => {
      btn.addEventListener('click', () => {
        mobileSheet = 'TODAYS_CHECKINS';
        render();
      });
    });

    // Meal QR Actions: Print and Refresh
    document.querySelectorAll('.print-meal-qr-btn').forEach((btn) => {
      btn.addEventListener('click', () => {
        if (!mealQrData?.qrCodeDataUrl) {
          showToast('No QR code available to print.', 'error');
          return;
        }
        const printWin = window.open('', '_blank', 'width=700,height=800');
        if (!printWin) {
          showToast('Pop-up blocked. Please allow pop-ups to print the QR code.', 'error');
          return;
        }
        const messName = escapeHtml(mealQrData.providerName || selectedHostel?.name || 'PrimePlate Mess');
        printWin.document.write(`
          <!DOCTYPE html>
          <html>
            <head>
              <title>PrimePlate Mess Counter QR - ${messName}</title>
              <style>
                @page { size: A4 portrait; margin: 20mm; }
                body {
                  font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
                  text-align: center;
                  padding: 40px 20px;
                  color: #111827;
                }
                .container {
                  max-width: 500px;
                  margin: 0 auto;
                  border: 3px solid #ea580c;
                  border-radius: 24px;
                  padding: 36px 24px;
                }
                .brand {
                  font-size: 26px;
                  font-weight: 800;
                  color: #ea580c;
                  margin-bottom: 8px;
                  letter-spacing: -0.5px;
                }
                .mess-name {
                  font-size: 22px;
                  font-weight: 700;
                  margin-bottom: 24px;
                  color: #1f2937;
                }
                .qr-img {
                  width: 320px;
                  height: 320px;
                  margin: 0 auto 20px auto;
                  display: block;
                  border-radius: 16px;
                  border: 1px solid #e5e7eb;
                  padding: 10px;
                }
                .instructions {
                  font-size: 15px;
                  font-weight: 600;
                  color: #374151;
                  margin-top: 16px;
                  line-height: 1.5;
                }
                .notice {
                  font-size: 12px;
                  color: #6b7280;
                  margin-top: 14px;
                }
              </style>
            </head>
            <body>
              <div class="container">
                <div class="brand">🍽️ PrimePlate</div>
                <div class="mess-name">${messName}</div>
                <img class="qr-img" src="${mealQrData.qrCodeDataUrl}" alt="PrimePlate Mess QR Code" />
                <div class="instructions">
                  <strong>Scan with PrimePlate to Check In</strong><br />
                  Students: Open PrimePlate and tap "Scan Meal QR" to record today's meal.
                </div>
                <div class="notice">
                  Official Mess Counter Standee • One check-in per student per calendar day
                </div>
              </div>
              <script>
                window.onload = function() {
                  window.focus();
                  window.print();
                };
              </script>
            </body>
          </html>
        `);
        printWin.document.close();
      });
    });

    // Download QR
    document.querySelectorAll('.download-meal-qr-btn').forEach((btn) => {
      btn.addEventListener('click', (e) => {
        e.preventDefault();
        e.stopPropagation();
        if (!mealQrData?.qrCodeDataUrl) {
          showToast('No QR code available to download.', 'error');
          return;
        }
        const fileName = `${(selectedHostel?.name || 'Mess').replace(/\s+/g, '_')}_Meal_QR.png`;
        const a = document.createElement('a');
        a.href = mealQrData.qrCodeDataUrl;
        a.download = fileName;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        showToast('Meal QR downloaded successfully!', 'success');
      });
    });

    document.querySelectorAll('.refresh-meal-qr-btn').forEach((btn) => {
      btn.addEventListener('click', async () => {
        await fetchMealQr();
        render();
        showToast('Meal QR refreshed', 'info');
      });
    });

    // Today's Check-ins Actions: Refresh and Correct
    document.querySelectorAll('.refresh-today-checkins-btn').forEach((btn) => {
      btn.addEventListener('click', async () => {
        await fetchTodayCheckIns();
        render();
        showToast("Today's check-ins refreshed", 'info');
      });
    });

    document.querySelectorAll('.open-correction-modal-btn').forEach((btn) => {
      btn.addEventListener('click', (e) => {
        const target = e.currentTarget as HTMLElement;
        const subscriptionId = target.getAttribute('data-sub-id') || '';
        const studentName = target.getAttribute('data-student-name') || 'Subscriber';
        correctionSubTarget = { subscriptionId, studentName };
        correctionReasonInput = '';
        showCorrectionModal = true;
        render();
      });
    });

    document.getElementById('closeCorrectionModalBtn')?.addEventListener('click', () => {
      showCorrectionModal = false;
      correctionSubTarget = null;
      correctionReasonInput = '';
      render();
    });

    document.getElementById('cancelCorrectionModalBtn')?.addEventListener('click', () => {
      showCorrectionModal = false;
      correctionSubTarget = null;
      correctionReasonInput = '';
      render();
    });

    const correctionForm = document.getElementById('correctionForm') as HTMLFormElement;
    if (correctionForm) {
      correctionForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        if (!selectedHostel || !correctionSubTarget?.subscriptionId) return;
        const reason = (document.getElementById('correctionReasonInput') as HTMLTextAreaElement)?.value?.trim();
        if (!reason || reason.length < 5) {
          showToast('Please provide a meaningful justification reason (at least 5 characters).', 'error');
          return;
        }

        isSubmittingCorrection = true;
        render();

        try {
          await correctProviderCheckIn(selectedHostel.id, correctionSubTarget.subscriptionId, reason);
          showToast(`Audited check-in recorded for ${correctionSubTarget.studentName}!`, 'success');
          showCorrectionModal = false;
          correctionSubTarget = null;
          correctionReasonInput = '';
          await fetchTodayCheckIns();
        } catch (err: any) {
          showToast(err.message || 'Failed to record correction', 'error');
        } finally {
          isSubmittingCorrection = false;
          render();
        }
      });
    }

    document.querySelectorAll('.open-hostel-images-sheet-btn').forEach((btn) => {
      btn.addEventListener('click', () => {
        mobileSheet = 'HOSTEL_IMAGES';
        render();
      });
    });

    document.querySelectorAll('.open-manage-pg-sheet-btn').forEach((btn) => {
      btn.addEventListener('click', () => {
        mobileSheet = 'MANAGE_PG';
        render();
      });
    });

    document.querySelectorAll('.open-earnings-sheet-btn').forEach((btn) => {
      btn.addEventListener('click', () => {
        mobileSheet = 'EARNINGS_HISTORY';
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

    // --- Complete Production-Ready Hostel Image Upload & Management Handlers ---

    const validateImageFile = (file: File): string | null => {
      const validTypes = ['image/jpeg', 'image/png', 'image/webp'];
      const isExtValid = /\.(jpe?g|png|webp)$/i.test(file.name);
      if (!validTypes.includes(file.type) && !isExtValid) {
        return 'Please upload a JPG, PNG, or WebP image.';
      }
      const maxSize = 10 * 1024 * 1024; // 10 MB
      if (file.size > maxSize) {
        return 'Image size must be less than 10 MB.';
      }
      return null;
    };

    const addFilesToQueue = (files: FileList | File[]) => {
      const currentCount = hostelImages.length + uploadQueue.filter((q) => q.status !== 'ERROR').length;
      let added = 0;

      for (let i = 0; i < files.length; i++) {
        const file = files[i];
        if (currentCount + added >= 10) {
          showToast('Maximum 10 photos allowed per hostel.', 'info');
          break;
        }

        const errorMsg = validateImageFile(file);
        if (errorMsg) {
          showToast(`${file.name}: ${errorMsg}`, 'error');
          continue;
        }

        const previewUrl = URL.createObjectURL(file);
        uploadQueue.push({
          id: 'q_' + Math.random().toString(36).substring(2, 9),
          file,
          previewUrl,
          name: file.name,
          size: file.size,
          category: 'Hostel',
          status: 'WAITING',
          progress: 0,
        });
        added++;
      }

      if (added > 0) {
        render();
        processUploadQueue();
      }
    };

    const processUploadQueue = async () => {
      if (isQueueUploading || !selectedHostel) return;
      const pending = uploadQueue.filter((item) => item.status === 'WAITING' || item.status === 'ERROR');
      if (pending.length === 0) return;

      isQueueUploading = true;
      render();

      for (const item of pending) {
        if (hostelImages.length >= 10) {
          item.status = 'ERROR';
          item.errorMessage = 'Limit reached: Maximum 10 photos per hostel.';
          render();
          continue;
        }

        item.status = 'UPLOADING';
        item.progress = 8;
        item.errorMessage = undefined;
        render();

        try {
          const formData = new FormData();
          formData.append('file', item.file);
          formData.append('providerId', selectedHostel.id);
          formData.append('imageCategory', item.category);

          await uploadProviderHostelImage(formData, selectedHostel.id, (progressEvent) => {
            if (progressEvent.total) {
              const percent = Math.round((progressEvent.loaded * 100) / progressEvent.total);
              item.progress = Math.min(99, Math.max(8, percent));
              const bar = document.getElementById(`progress-bar-${item.id}`);
              if (bar) bar.style.width = `${item.progress}%`;
              const txt = document.getElementById(`progress-text-${item.id}`);
              if (txt) txt.textContent = `Uploading ${item.progress}%`;
            }
          });

          item.status = 'SUCCESS';
          item.progress = 100;
          await fetchHostelImages();
          render();
        } catch (err: any) {
          item.status = 'ERROR';
          item.errorMessage = err.message || 'Upload interrupted. Check connection and try again.';
          render();
        }
      }

      // Cleanup successful queue items after brief delay
      setTimeout(() => {
        uploadQueue = uploadQueue.filter((item) => item.status !== 'SUCCESS');
        isQueueUploading = false;
        render();
      }, 1000);
    };

    let currentCameraStream: MediaStream | null = null;
    let targetCameraQueueCallback: ((file: File) => void) | null = null;

    const stopCameraStream = () => {
      if (currentCameraStream) {
        currentCameraStream.getTracks().forEach((track) => track.stop());
        currentCameraStream = null;
      }
      const modal = document.getElementById('liveCameraModal');
      if (modal) modal.style.display = 'none';
    };

    const openLiveCameraView = async (onPhotoCaptured: (file: File) => void) => {
      targetCameraQueueCallback = onPhotoCaptured;
      const modal = document.getElementById('liveCameraModal');
      const video = document.getElementById('liveCameraVideo') as HTMLVideoElement;
      const spinner = document.getElementById('cameraLoadingSpinner');

      const getUserMediaFn =
        navigator.mediaDevices && navigator.mediaDevices.getUserMedia
          ? (c: MediaStreamConstraints) => navigator.mediaDevices.getUserMedia(c)
          : (navigator as any).webkitGetUserMedia || (navigator as any).mozGetUserMedia;

      if (!getUserMediaFn) {
        showToast('Camera is not supported on this browser. Please select from Gallery.', 'info');
        return;
      }

      if (modal) modal.style.display = 'flex';
      if (spinner) spinner.style.display = 'flex';

      try {
        if (currentCameraStream) {
          currentCameraStream.getTracks().forEach((t) => t.stop());
        }

        try {
          currentCameraStream = await getUserMediaFn.call(
            navigator.mediaDevices || navigator,
            { video: { facingMode: { ideal: 'environment' } }, audio: false },
          );
        } catch (_) {
          currentCameraStream = await getUserMediaFn.call(
            navigator.mediaDevices || navigator,
            { video: true, audio: false },
          );
        }

        if (video) {
          video.srcObject = currentCameraStream;
          video.muted = true;
          video.setAttribute('playsinline', 'true');
          await video.play();
        }
        if (spinner) spinner.style.display = 'none';
      } catch (err: any) {
        console.warn('Camera stream error:', err);
        stopCameraStream();
        showToast('Camera access blocked or unavailable. Please check camera permissions in your browser.', 'error');
      }
    };

    const snapPhotoFromCamera = () => {
      const video = document.getElementById('liveCameraVideo') as HTMLVideoElement;
      const canvas = document.getElementById('liveCameraCanvas') as HTMLCanvasElement;
      if (!video || !canvas || !video.videoWidth) return;

      canvas.width = video.videoWidth;
      canvas.height = video.videoHeight;
      const ctx = canvas.getContext('2d');
      if (!ctx) return;

      ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
      canvas.toBlob(
        (blob) => {
          if (blob && targetCameraQueueCallback) {
            const photoFile = new File([blob], `photo_${Date.now()}.jpg`, { type: 'image/jpeg' });
            targetCameraQueueCallback(photoFile);
          }
          stopCameraStream();
          showToast('Photo captured successfully! 📸', 'success');
        },
        'image/jpeg',
        0.9,
      );
    };

    document.getElementById('closeLiveCameraBtn')?.addEventListener('click', stopCameraStream);
    document.getElementById('cancelLiveCameraBtn')?.addEventListener('click', stopCameraStream);
    document.getElementById('snapCameraButton')?.addEventListener('click', snapPhotoFromCamera);

    // Mobile & Desktop Take Photo trigger
    document.querySelectorAll('.mobile-take-photo-btn').forEach((btn) => {
      btn.addEventListener('click', (e) => {
        e.preventDefault();
        e.stopPropagation();
        openLiveCameraView((file) => addFilesToQueue([file]));
      });
    });

    document.querySelectorAll('.mobile-gallery-btn').forEach((btn) => {
      btn.addEventListener('click', (e) => {
        e.preventDefault();
        e.stopPropagation();
        const galleryInput = document.getElementById('hostelGalleryInput') as HTMLInputElement;
        if (galleryInput) {
          galleryInput.value = '';
          galleryInput.click();
        }
      });
    });

    // Carousel Slider Navigation Handlers
    document.querySelectorAll('.carousel-prev-btn').forEach((btn) => {
      btn.addEventListener('click', (e) => {
        e.preventDefault();
        e.stopPropagation();
        if (hostelImages.length > 0) {
          carouselActiveIndex = (carouselActiveIndex - 1 + hostelImages.length) % hostelImages.length;
          render();
        }
      });
    });

    document.querySelectorAll('.carousel-next-btn').forEach((btn) => {
      btn.addEventListener('click', (e) => {
        e.preventDefault();
        e.stopPropagation();
        if (hostelImages.length > 0) {
          carouselActiveIndex = (carouselActiveIndex + 1) % hostelImages.length;
          render();
        }
      });
    });

    document.querySelectorAll('.carousel-dot-btn').forEach((btn) => {
      btn.addEventListener('click', (e) => {
        e.preventDefault();
        e.stopPropagation();
        const idx = Number((e.currentTarget as HTMLElement).getAttribute('data-slide-idx')) || 0;
        carouselActiveIndex = Math.max(0, Math.min(idx, hostelImages.length - 1));
        render();
      });
    });

    document.querySelectorAll('.carousel-thumb-btn').forEach((btn) => {
      btn.addEventListener('click', (e) => {
        e.preventDefault();
        e.stopPropagation();
        const idx = Number((e.currentTarget as HTMLElement).getAttribute('data-slide-idx')) || 0;
        carouselActiveIndex = Math.max(0, Math.min(idx, hostelImages.length - 1));
        render();
      });
    });

    // File input changes
    const cameraInput = document.getElementById('hostelCameraInput') as HTMLInputElement;
    if (cameraInput) {
      cameraInput.addEventListener('change', (e) => {
        const files = (e.target as HTMLInputElement).files;
        if (files && files.length > 0) {
          addFilesToQueue(files);
        }
      });
    }

    const galleryInput = document.getElementById('hostelGalleryInput') as HTMLInputElement;
    if (galleryInput) {
      galleryInput.addEventListener('change', (e) => {
        const files = (e.target as HTMLInputElement).files;
        if (files && files.length > 0) {
          addFilesToQueue(files);
        }
      });
    }

    // Drag and Drop Zone Handlers
    document.querySelectorAll('.hostel-dropzone').forEach((dropzone) => {
      dropzone.addEventListener('click', (e) => {
        e.preventDefault();
        const input = document.getElementById('hostelGalleryInput') as HTMLInputElement;
        if (input) {
          input.value = '';
          input.click();
        }
      });

      dropzone.addEventListener('dragover', (e) => {
        e.preventDefault();
        e.stopPropagation();
        (dropzone as HTMLElement).style.borderColor = 'var(--color-primary-500)';
        (dropzone as HTMLElement).style.backgroundColor = 'var(--color-primary-50)';
      });

      dropzone.addEventListener('dragleave', (e) => {
        e.preventDefault();
        e.stopPropagation();
        (dropzone as HTMLElement).style.borderColor = 'var(--color-neutral-300)';
        (dropzone as HTMLElement).style.backgroundColor = '#fff';
      });

      dropzone.addEventListener('drop', (e) => {
        e.preventDefault();
        e.stopPropagation();
        (dropzone as HTMLElement).style.borderColor = 'var(--color-neutral-300)';
        (dropzone as HTMLElement).style.backgroundColor = '#fff';
        const dt = (e as DragEvent).dataTransfer;
        if (dt && dt.files && dt.files.length > 0) {
          addFilesToQueue(dt.files);
        }
      });
    });

    // Queue actions: Upload All, Clear All, Remove Item, Retry Item
    document.querySelectorAll('.start-upload-queue-btn').forEach((btn) => {
      btn.addEventListener('click', () => {
        processUploadQueue();
      });
    });

    document.querySelectorAll('.clear-queue-btn').forEach((btn) => {
      btn.addEventListener('click', () => {
        if (isQueueUploading) return;
        uploadQueue = [];
        render();
      });
    });

    document.querySelectorAll('.remove-queue-item-btn').forEach((btn) => {
      btn.addEventListener('click', (e) => {
        const id = (e.currentTarget as HTMLElement).getAttribute('data-id');
        uploadQueue = uploadQueue.filter((q) => q.id !== id);
        render();
      });
    });

    document.querySelectorAll('.retry-queue-item-btn').forEach((btn) => {
      btn.addEventListener('click', (e) => {
        const id = (e.currentTarget as HTMLElement).getAttribute('data-id');
        const item = uploadQueue.find((q) => q.id === id);
        if (item) {
          item.status = 'WAITING';
          item.progress = 0;
          item.errorMessage = undefined;
          processUploadQueue();
        }
      });
    });

    // Lightbox Modal
    document.querySelectorAll('.gallery-photo-click').forEach((el) => {
      el.addEventListener('click', (e) => {
        const imgId = (e.currentTarget as HTMLElement).getAttribute('data-img-id');
        const found = hostelImages.find((img) => img.id === imgId);
        if (found) {
          lightboxImage = found;
          render();
        }
      });
    });

    document.querySelectorAll('.slide-take-photo-btn').forEach((btn) => {
      btn.addEventListener('click', (e) => {
        e.preventDefault();
        e.stopPropagation();
        const imgId = (e.currentTarget as HTMLElement).getAttribute('data-img-id');
        const found = hostelImages.find((img) => img.id === imgId);
        if (found) {
          imageToReplace = found;
          replaceFile = null;
          replacePreviewUrl = null;
          replaceCategory = found.imageCategory || 'Hostel';
          isReplacingImage = false;
          replaceProgress = 0;
          replaceErrorMessage = null;
          openLiveCameraView((file) => onReplaceFileSelected(file));
        }
      });
    });

    document.querySelectorAll('.slide-choose-gallery-btn').forEach((btn) => {
      btn.addEventListener('click', (e) => {
        e.preventDefault();
        e.stopPropagation();
        const imgId = (e.currentTarget as HTMLElement).getAttribute('data-img-id');
        const found = hostelImages.find((img) => img.id === imgId);
        if (found) {
          imageToReplace = found;
          replaceFile = null;
          replacePreviewUrl = null;
          replaceCategory = found.imageCategory || 'Hostel';
          isReplacingImage = false;
          replaceProgress = 0;
          replaceErrorMessage = null;
          render();
          const replaceInput = document.getElementById('hostelReplaceGalleryInput') as HTMLInputElement;
          if (replaceInput) {
            replaceInput.value = '';
            replaceInput.click();
          }
        }
      });
    });

    document.querySelectorAll('.change-main-hostel-image-btn').forEach((btn) => {
      btn.addEventListener('click', (e) => {
        e.preventDefault();
        e.stopPropagation();
        if (hostelImages && hostelImages.length > 0) {
          imageToReplace = hostelImages[0];
          replaceFile = null;
          replacePreviewUrl = null;
          replaceCategory = hostelImages[0].imageCategory || 'Hostel';
          isReplacingImage = false;
          replaceProgress = 0;
          replaceErrorMessage = null;
          showEditProfileModal = false;
          render();
          openLiveCameraView((file) => onReplaceFileSelected(file));
        } else {
          openLiveCameraView((file) => addFilesToQueue([file]));
        }
      });
    });

    document.getElementById('closeLightboxBtn')?.addEventListener('click', () => {
      lightboxImage = null;
      render();
    });

    document.getElementById('lightboxModal')?.addEventListener('click', (e) => {
      if (e.target === document.getElementById('lightboxModal')) {
        lightboxImage = null;
        render();
      }
    });

    // Replace Image Modal Handlers
    document.querySelectorAll('.replace-hostel-image-btn').forEach((btn) => {
      btn.addEventListener('click', (e) => {
        const imgId = (e.currentTarget as HTMLElement).getAttribute('data-img-id');
        const found = hostelImages.find((img) => img.id === imgId);
        if (found) {
          imageToReplace = found;
          replaceFile = null;
          replacePreviewUrl = null;
          replaceCategory = found.imageCategory || 'Hostel';
          isReplacingImage = false;
          replaceProgress = 0;
          replaceErrorMessage = null;
          render();
        }
      });
    });

    const closeReplaceModal = () => {
      if (isReplacingImage) return;
      imageToReplace = null;
      replaceFile = null;
      replacePreviewUrl = null;
      isReplacingImage = false;
      replaceProgress = 0;
      replaceErrorMessage = null;
      render();
    };

    document.querySelectorAll('.cancel-replace-image-btn').forEach((btn) => {
      btn.addEventListener('click', closeReplaceModal);
    });
    document.querySelectorAll('.cancel-replace-x-btn').forEach((btn) => {
      btn.addEventListener('click', closeReplaceModal);
    });

    document.querySelectorAll('.replace-take-photo-btn').forEach((btn) => {
      btn.addEventListener('click', (e) => {
        e.preventDefault();
        e.stopPropagation();
        openLiveCameraView((file) => onReplaceFileSelected(file));
      });
    });

    document.querySelectorAll('.replace-gallery-btn').forEach((btn) => {
      btn.addEventListener('click', () => {
        const input = document.getElementById('hostelReplaceGalleryInput') as HTMLInputElement;
        if (input) {
          input.value = '';
          input.click();
        }
      });
    });

    const onReplaceFileSelected = async (file: File) => {
      const err = validateImageFile(file);
      if (err) {
        showToast(err, 'error');
        return;
      }
      replaceFile = file;
      replacePreviewUrl = URL.createObjectURL(file);
      replaceErrorMessage = null;

      if (imageToReplace) {
        isReplacingImage = true;
        replaceProgress = 15;
        render();

        try {
          const formData = new FormData();
          formData.append('file', replaceFile);
          formData.append('imageCategory', replaceCategory || 'Hostel');

          const res: any = await replaceProviderHostelImage(imageToReplace.id, formData, (progressEvent) => {
            if (progressEvent.total) {
              const percent = Math.round((progressEvent.loaded * 100) / progressEvent.total);
              replaceProgress = Math.min(99, Math.max(15, percent));
              const bar = document.getElementById('replaceProgressBar');
              if (bar) bar.style.width = `${replaceProgress}%`;
            }
          });

          showToast('Hostel photo updated successfully! 📸', 'success');
          imageToReplace = null;
          replaceFile = null;
          replacePreviewUrl = null;
          isReplacingImage = false;
          await fetchHostelImages();
          if (res && res.imageUrl && selectedHostel) {
            selectedHostel.imageUrl = res.imageUrl;
          }
          render();
        } catch (uploadErr: any) {
          isReplacingImage = false;
          replaceErrorMessage = uploadErr.message || 'Failed to replace image. Please try again.';
          showToast(replaceErrorMessage || 'Failed to replace image', 'error');
          render();
        }
      } else {
        render();
      }
    };

    const replaceCameraInput = document.getElementById('hostelReplaceCameraInput') as HTMLInputElement;
    if (replaceCameraInput) {
      replaceCameraInput.addEventListener('change', (e) => {
        const file = (e.target as HTMLInputElement).files?.[0];
        if (file) onReplaceFileSelected(file);
      });
    }

    const replaceGalleryInput = document.getElementById('hostelReplaceGalleryInput') as HTMLInputElement;
    if (replaceGalleryInput) {
      replaceGalleryInput.addEventListener('change', (e) => {
        const file = (e.target as HTMLInputElement).files?.[0];
        if (file) onReplaceFileSelected(file);
      });
    }

    document.querySelectorAll('.confirm-replace-image-btn').forEach((btn) => {
      btn.addEventListener('click', async () => {
        if (!imageToReplace || !replaceFile) return;
        isReplacingImage = true;
        replaceProgress = 10;
        replaceErrorMessage = null;
        render();

        try {
          const formData = new FormData();
          formData.append('file', replaceFile);
          formData.append('imageCategory', replaceCategory);

          await replaceProviderHostelImage(imageToReplace.id, formData, (progressEvent) => {
            if (progressEvent.total) {
              const percent = Math.round((progressEvent.loaded * 100) / progressEvent.total);
              replaceProgress = Math.min(99, Math.max(10, percent));
              const bar = document.getElementById('replaceProgressBar');
              if (bar) bar.style.width = `${replaceProgress}%`;
            }
          });

          showToast('Hostel photo replaced successfully!', 'success');
          imageToReplace = null;
          replaceFile = null;
          replacePreviewUrl = null;
          isReplacingImage = false;
          await fetchHostelImages();
          render();
        } catch (err: any) {
          isReplacingImage = false;
          replaceErrorMessage = err.message || 'Failed to replace image. Please try again.';
          showToast(replaceErrorMessage || 'Failed to replace image', 'error');
          render();
        }
      });
    });

    // Delete Image Modal Handlers
    document.querySelectorAll('.delete-hostel-image-btn').forEach((btn) => {
      btn.addEventListener('click', (e) => {
        const imgId = (e.currentTarget as HTMLElement).getAttribute('data-img-id');
        const img = hostelImages.find((i) => i.id === imgId);
        if (img) {
          imageToDelete = img;
          render();
        }
      });
    });

    document.querySelectorAll('.cancel-delete-image-btn').forEach((btn) => {
      btn.addEventListener('click', () => {
        imageToDelete = null;
        isDeletingImage = false;
        render();
      });
    });

    document.querySelectorAll('.confirm-delete-image-btn').forEach((btn) => {
      btn.addEventListener('click', async () => {
        if (!imageToDelete) return;
        isDeletingImage = true;
        render();

        try {
          await deleteProviderHostelImage(imageToDelete.id);
          showToast('Hostel photo deleted successfully.', 'info');
          imageToDelete = null;
          isDeletingImage = false;
          await fetchHostelImages();
          render();
        } catch (err: any) {
          isDeletingImage = false;
          showToast(err.message || 'Failed to delete hostel image', 'error');
          render();
        }
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
            latitude: modalEditLat ?? selectedHostel.latitude,
            longitude: modalEditLng ?? selectedHostel.longitude,
          });
          if (modalEditLat) selectedHostel.latitude = modalEditLat;
          if (modalEditLng) selectedHostel.longitude = modalEditLng;
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

    // Subscriber Search Listener
    document.querySelectorAll('.subscriber-search-input').forEach((input) => {
      input.addEventListener('input', (e) => {
        subscriberSearchQuery = (e.target as HTMLInputElement).value;
        render();
      });
    });

    // Subscriber Card Click -> Open Subscriber Details Modal
    document.querySelectorAll('.subscriber-card-item').forEach((item) => {
      item.addEventListener('click', (e) => {
        const subId = (e.currentTarget as HTMLElement).getAttribute('data-sub-id');
        const sub = liveSubs.find((s) => s.id === subId);
        if (sub) {
          selectedSubscriberForDetails = sub;
          showSubscriberDetailsModal = true;
          render();
          fetchSubscriberAttendance(sub.id);
        }
      });
    });

    // Retry Subscriber Attendance Fetch
    document.querySelectorAll('.retry-sub-attendance-btn').forEach((btn) => {
      btn.addEventListener('click', (e) => {
        const subId = (e.currentTarget as HTMLElement).getAttribute('data-sub-id');
        if (subId) {
          fetchSubscriberAttendance(subId);
        }
      });
    });

    // Mount DayPicker MealCalendar in Subscriber Details Modal if open and data loaded
    const subCalMount = document.getElementById('subscriber-meal-calendar-mount');
    if (subCalMount && subscriberAttendanceData && subscriberAttendanceData.days) {
      if (subscriberCalendarUnmount) {
        try { subscriberCalendarUnmount(); } catch (_) {}
        subscriberCalendarUnmount = null;
      }

      const usageByDate: Record<string, 'checked-in' | 'missed'> = {};
      const detailsByDate: Record<string, { time?: string | null; source?: string | null }> = {};

      subscriberAttendanceData.days.forEach((d: any) => {
        if (d.status === 'CHECKED_IN' || d.checkedIn) {
          usageByDate[d.date] = 'checked-in';
        } else if (d.status === 'NOT_CHECKED_IN') {
          usageByDate[d.date] = 'missed';
        }
        if (d.time || d.source || d.correctionReason) {
          detailsByDate[d.date] = { time: d.time, source: d.source };
        }
      });

      subscriberCalendarUnmount = mountMealCalendar(subCalMount, {
        usageByDate,
        startDate: subscriberAttendanceData.startDate,
        endDate: subscriberAttendanceData.endDate,
        detailsByDate,
        title: 'Monthly Attendance Roster',
        subtitle: `${subscriberAttendanceData.attendedDays} of ${subscriberAttendanceData.totalDays} days attended (${subscriberAttendanceData.attendanceRate}%)`,
      });
    }

    const closeSubscriberModal = () => {
      if (subscriberCalendarUnmount) {
        try { subscriberCalendarUnmount(); } catch (_) {}
        subscriberCalendarUnmount = null;
      }
      showSubscriberDetailsModal = false;
      selectedSubscriberForDetails = null;
      subscriberAttendanceData = null;
      subscriberAttendanceError = null;
      subscriberAttendanceLoading = false;
      recoveryProcessResult = null;
      render();
    };

    document.getElementById('closeSubscriberDetailsBtn')?.addEventListener('click', closeSubscriberModal);
    document.getElementById('closeSubscriberDetailsXBtn')?.addEventListener('click', closeSubscriberModal);

    const subscriberModalOverlay = document.getElementById('subscriberDetailsModal');
    if (subscriberModalOverlay) {
      subscriberModalOverlay.addEventListener('click', (e) => {
        if (e.target === subscriberModalOverlay) {
          closeSubscriberModal();
        }
      });
    }

    if (showSubscriberDetailsModal) {
      const handleEscapeKey = (e: KeyboardEvent) => {
        if (e.key === 'Escape' && showSubscriberDetailsModal) {
          window.removeEventListener('keydown', handleEscapeKey);
          closeSubscriberModal();
        }
      };
      window.addEventListener('keydown', handleEscapeKey, { once: true });
    }

    // Recovery Percentage Buttons — update provider's recovery policy
    document.querySelectorAll('.set-recovery-pct-btn').forEach((btn) => {
      btn.addEventListener('click', async (e) => {
        if (!selectedHostel) return;
        const pct = parseInt((e.currentTarget as HTMLElement).getAttribute('data-pct') || '80', 10);
        if (isUpdatingRecoveryPercentage) return;
        isUpdatingRecoveryPercentage = true;
        try {
          await updateProviderRecoveryPercentage(selectedHostel.id, pct);
          selectedHostel.recoveryPercentage = pct;
          if (recoveryStats) recoveryStats.recoveryPercentage = pct;
          showToast(`Recovery rate updated to ${pct}%`, 'success');
          render();
        } catch (err: any) {
          showToast(err.message || 'Failed to update recovery rate', 'error');
        } finally {
          isUpdatingRecoveryPercentage = false;
        }
      });
    });

    // Process Recovery Button — calculate & grant recovery days for a subscriber
    document.querySelectorAll('.process-recovery-btn').forEach((btn) => {
      btn.addEventListener('click', async (e) => {
        const subId = (e.currentTarget as HTMLElement).getAttribute('data-sub-id');
        if (!subId || processingRecoverySubId === subId) return;
        processingRecoverySubId = subId;
        recoveryProcessResult = null;
        render();
        try {
          const result: any = await processSubscriptionRecovery(subId, selectedHostel?.id);
          const r = result?.data !== undefined ? result.data : result;
          if (r?.alreadyProcessed) {
            recoveryProcessResult = {
              message: `Already processed: ${r.recoveredDays ?? 0} recovery day(s) granted (${r.missedDays ?? 0} missed @ ${r.recoveryRate ?? 80}%)`,
              type: 'info',
            };
          } else if (r?.processed && (r?.recoveredDays ?? 0) > 0) {
            recoveryProcessResult = {
              message: `✓ Recovery granted: ${r.recoveredDays} day(s) from ${r.missedDays} missed meals at ${r.recoveryRate}%`,
              type: 'success',
            };
            await fetchRecoveryStats();
          } else {
            recoveryProcessResult = {
              message: `No recovery days generated (${r?.missedDays ?? 0} missed days @ ${r?.recoveryRate ?? 80}% = 0 days)`,
              type: 'info',
            };
          }
        } catch (err: any) {
          recoveryProcessResult = {
            message: err.message || 'Failed to process recovery',
            type: 'error',
          };
        } finally {
          processingRecoverySubId = null;
          render();
        }
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

    document.querySelectorAll('.cancel-inline-menu-btn').forEach((btn) => {
      btn.addEventListener('click', () => {
        editingMenu = null;
        editingMenuValue = '';
        render();
      });
    });

    const handleSaveMenu = async (inputElement?: HTMLInputElement | null) => {
      if (!selectedHostel || !editingMenu) return;
      const newVal = inputElement?.value?.trim() ?? editingMenuValue.trim();
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
    };

    document.querySelectorAll('.save-inline-menu-btn').forEach((btn) => {
      btn.addEventListener('click', (e) => {
        const card = (e.currentTarget as HTMLElement).closest('.menu-meal-card');
        const input = card?.querySelector('.menu-inline-input') as HTMLInputElement;
        handleSaveMenu(input);
      });
    });

    document.querySelectorAll('.menu-inline-input').forEach((input) => {
      input.addEventListener('keydown', (e) => {
        const keyEvent = e as KeyboardEvent;
        if (keyEvent.key === 'Enter') {
          keyEvent.preventDefault();
          handleSaveMenu(input as HTMLInputElement);
        } else if (keyEvent.key === 'Escape') {
          editingMenu = null;
          editingMenuValue = '';
          render();
        }
      });
    });

    // Character counter helper
    const setupCharCounter = (textareaId: string, counterId: string, maxLen = 1000) => {
      const ta = document.getElementById(textareaId) as HTMLTextAreaElement;
      const cnt = document.getElementById(counterId);
      if (ta && cnt) {
        const update = () => {
          cnt.textContent = `${ta.value.length} / ${maxLen} characters`;
        };
        ta.addEventListener('input', update);
        update();
      }
    };
    setupCharCounter('cDescription', 'cDescriptionCount');
    setupCharCounter('hDescription', 'hDescriptionCount');
    setupCharCounter('editProfileDescription', 'editProfileDescriptionCount');

    // Add Custom Amenity Button Listeners
    document.getElementById('cAddCustomAmenityBtn')?.addEventListener('click', () => {
      createCustomAmenityRow('cCustomAmenitiesList');
    });
    document.getElementById('hAddCustomAmenityBtn')?.addEventListener('click', () => {
      createCustomAmenityRow('hCustomAmenitiesList');
    });
    document.getElementById('editProfileAddCustomAmenityBtn')?.addEventListener('click', () => {
      createCustomAmenityRow('editProfileCustomAmenitiesList');
    });

    // Center Hostel Registration Form Submit (for first-time providers)
    const centerHostelForm = document.getElementById('centerHostelForm') as HTMLFormElement;
    if (centerHostelForm) {
      centerHostelForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        const name = (centerHostelForm.querySelector('#cName') as HTMLInputElement)?.value?.trim();
        const city = (centerHostelForm.querySelector('#cCity') as HTMLInputElement)?.value?.trim();
        const area = (centerHostelForm.querySelector('#cArea') as HTMLInputElement)?.value?.trim();
        const address = (centerHostelForm.querySelector('#cAddress') as HTMLInputElement)?.value?.trim();
        const price = parseFloat((centerHostelForm.querySelector('#cPrice') as HTMLInputElement)?.value) || 0;
        const capacity = parseInt((centerHostelForm.querySelector('#cCapacity') as HTMLInputElement)?.value, 10) || 50;
        const phone = (centerHostelForm.querySelector('#cPhone') as HTMLInputElement)?.value?.trim();
        const category = (centerHostelForm.querySelector('#cCategory') as HTMLSelectElement)?.value || 'Veg';
        const description = (centerHostelForm.querySelector('#cDescription') as HTMLTextAreaElement)?.value?.trim() || undefined;
        const amenities = collectAmenitiesFromForm(centerHostelForm, 'cAmenities', 'cCustomAmenitiesList');

        if (!name || !city || !address || !phone) {
          showToast('Please fill in all required fields.', 'error');
          return;
        }

        try {
          await api.post('/providers', {
            name,
            city,
            address: area ? `${address}, ${area}` : address,
            monthlyPrice: price,
            totalCapacity: capacity,
            contactPhone: phone,
            category,
            description,
            amenities,
          });
          showToast('Kitchen registered successfully! Welcome to your provider portal.', 'success');
          await fetchHostels();
          await fetchLiveSubs();
          await fetchWeeklyMenus();
          await fetchProviderReviews();
          await fetchEarningsData();
          render();
        } catch (err: any) {
          showToast(err.message || 'Failed to submit kitchen registration', 'error');
        }
      });
    }

    // Refresh Status Button
    document.getElementById('refreshStatusBtn')?.addEventListener('click', async () => {
      showToast('Checking approval status...', 'info');
      await fetchHostels();
      await fetchLiveSubs();
      await fetchWeeklyMenus();
      render();
    });

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
        const description = (addHostelForm.querySelector('#hDescription') as HTMLTextAreaElement)?.value?.trim() || undefined;
        const amenities = collectAmenitiesFromForm(addHostelForm, 'hAmenities', 'hCustomAmenitiesList');

        try {
          await api.post('/providers', {
            name,
            city,
            address: `${address}, ${area}`,
            monthlyPrice: price,
            totalCapacity: capacity,
            contactPhone: phone,
            description,
            amenities,
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

    // Edit Mess Profile & Amenities Modal Triggers & Form
    document.querySelectorAll('.open-edit-profile-btn').forEach((btn) => {
      btn.addEventListener('click', () => {
        showEditProfileModal = true;
        render();

        // Populate custom amenities container with non-common amenities
        const customAmenities = (selectedHostel?.amenities || []).filter(
          (a: string) => !COMMON_AMENITIES.some((ca) => ca.toLowerCase() === a.trim().toLowerCase())
        );
        const customContainer = document.getElementById('editProfileCustomAmenitiesList');
        if (customContainer) {
          customContainer.innerHTML = '';
          customAmenities.forEach((ca: string) => {
            createCustomAmenityRow('editProfileCustomAmenitiesList', ca);
          });
        }
      });
    });

    document.getElementById('closeEditProfileModalBtn')?.addEventListener('click', () => {
      showEditProfileModal = false;
      render();
    });

    document.getElementById('cancelEditProfileBtn')?.addEventListener('click', () => {
      showEditProfileModal = false;
      render();
    });

    const editProfileForm = document.getElementById('editProfileForm') as HTMLFormElement;
    if (editProfileForm) {
      editProfileForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        if (!selectedHostel) return;
        const descVal = (editProfileForm.querySelector('#editProfileDescription') as HTMLTextAreaElement)?.value?.trim();
        const amenities = collectAmenitiesFromForm(editProfileForm, 'editAmenities', 'editProfileCustomAmenitiesList');

        try {
          const updated: any = await api.put(`/providers/${selectedHostel.id}`, {
            description: descVal || '',
            amenities,
          });
          selectedHostel.description = updated.description !== undefined ? updated.description : (descVal || '');
          selectedHostel.amenities = updated.amenities !== undefined ? updated.amenities : amenities;
          showToast('Kitchen profile & amenities updated successfully!', 'success');
          showEditProfileModal = false;
          await fetchHostels();
          render();
        } catch (err: any) {
          showToast(err.message || 'Failed to update kitchen profile', 'error');
        }
      });
    }
  };

  const loadInitialData = async () => {
    try {
      await fetchHostels();
      if (selectedHostel) {
        await Promise.allSettled([
          fetchLiveSubs(),
          fetchWeeklyMenus(),
          fetchProviderReviews(),
          fetchEarningsData(),
          fetchHostelImages(),
          fetchMealQr(),
          fetchTodayCheckIns(),
          fetchRecoveryStats(),
        ]);
      } else {
        await fetchEarningsData().catch(() => {});
      }
    } catch (err) {
      console.error('Initial data load error:', err);
    } finally {
      render();
    }
  };

  await loadInitialData();
}
