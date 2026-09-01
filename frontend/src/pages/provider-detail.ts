import api from '../api';
import { navigate } from '../router';
import { showToast } from '../components/toast';
import { renderNavbar, attachNavbarEvents } from '../components/navbar';
import { renderFooter, attachFooterEvents } from '../components/footer';
import { escapeHtml, getSafeImageUrl } from '../utils/sanitize';

function getCurrentUserId(): string | null {
  const token = localStorage.getItem('accessToken');
  if (!token) return null;
  try {
    const payload = JSON.parse(atob(token.split('.')[1]));
    return payload.userId || payload.sub || payload.id || null;
  } catch (_) {
    return null;
  }
}

export async function renderProviderDetail(providerId: string) {
  window.scrollTo(0, 0);
  const container = document.getElementById('app')!;

  container.innerHTML = `
    ${renderNavbar()}
    <main class="main-content" style="padding-top: 88px; padding-bottom: 60px; background: #f8fafc;">
      <div id="detailView" style="max-width: 1280px; margin: 0 auto; padding: 0 24px;">
        <div style="text-align: center; padding: 60px;">
          <i class="fa-solid fa-spinner fa-spin fa-2x" style="color: var(--color-primary-600);"></i>
          <p style="margin-top: 12px; color: var(--color-neutral-600);">Loading mess details...</p>
        </div>
      </div>
    </main>

    ${renderFooter()}
  `;

  attachNavbarEvents();
  attachFooterEvents();

  const detailView = document.getElementById('detailView')!;

  const renderError = (errMsg: string) => {
    detailView.innerHTML = `
      <div style="background: #fff; border: 1px solid #fee2e2; border-radius: 24px; text-align: center; padding: 60px; margin-top: 24px;">
        <i class="fa-solid fa-triangle-exclamation" style="font-size: 44px; color: #dc2626; margin-bottom: 16px;"></i>
        <h3 class="font-display" style="font-size: 22px; font-weight: 700; color: var(--color-neutral-900); margin-bottom: 8px;">Failed to Load Kitchen Details</h3>
        <p style="color: var(--color-neutral-600); margin-bottom: 24px; max-width: 480px; margin-left: auto; margin-right: auto;">${escapeHtml(errMsg)}</p>
        <div style="display: flex; gap: 12px; justify-content: center;">
          <button id="detailBackBtn" class="btn-outline-action" style="padding: 10px 20px;">
            <i class="fa-solid fa-arrow-left"></i> Back to Browse
          </button>
          <button id="retryDetailBtn" class="btn-primary-action" style="padding: 10px 24px;">
            <i class="fa-solid fa-rotate-right"></i> Retry Loading
          </button>
        </div>
      </div>`;

    document.getElementById('detailBackBtn')?.addEventListener('click', () => navigate('#/providers'));
    document.getElementById('retryDetailBtn')?.addEventListener('click', () => renderProviderDetail(providerId));
  };

  try {
    const token = localStorage.getItem('accessToken');
    const userRole = (localStorage.getItem('userRole') || '').toUpperCase();
    const currentUserId = getCurrentUserId();

    const [providerRes, plansRes, menuRes, revRes, subRes, imgRes] = await Promise.allSettled([
      api.get(`/providers/${providerId}`),
      api.get(`/meal-plans/provider/${providerId}`),
      api.get(`/weekly-menus/provider/${providerId}`),
      api.get(`/reviews/provider/${providerId}`),
      token && userRole === 'STUDENT' ? api.get('/subscriptions') : Promise.resolve([]),
      api.get(`/providers/${providerId}/images`),
    ]);

    const provider: any = providerRes.status === 'fulfilled' ? providerRes.value : null;
    if (!provider || !provider.id) {
      renderError('Provider not found or unavailable.');
      return;
    }

    const mealPlans: any[] = plansRes.status === 'fulfilled' && Array.isArray(plansRes.value) ? plansRes.value : [];
    const weeklyMenus: any[] = menuRes.status === 'fulfilled' && Array.isArray(menuRes.value) ? menuRes.value : [];
    const reviews: any[] = revRes.status === 'fulfilled' && Array.isArray(revRes.value) ? revRes.value : [];
    const userSubs: any[] = subRes.status === 'fulfilled' && Array.isArray(subRes.value) ? subRes.value : [];
    const hostelImages: any[] =
      imgRes.status === 'fulfilled' && Array.isArray(imgRes.value)
        ? imgRes.value
        : Array.isArray(provider.images)
          ? provider.images
          : [];

    const isSubscribed = userSubs.some((s: any) => s.mealPlan?.provider?.id === providerId);
    const myReview = currentUserId ? reviews.find((r: any) => r.student?.id === currentUserId) : null;

    const amenitiesList = Array.isArray(provider.amenities) ? provider.amenities : [];
    const totalCap = provider.totalCapacity !== undefined && provider.totalCapacity !== null ? Number(provider.totalCapacity) : null;
    const currentSubs = Number(provider.currentSubscribers) || 0;
    const remainingCap = provider.remainingCapacity !== undefined && provider.remainingCapacity !== null
      ? Number(provider.remainingCapacity)
      : (totalCap !== null ? Math.max(0, totalCap - currentSubs) : null);
    const isClosed = provider.acceptingSubscriptions === false;
    const isFullyBooked = remainingCap !== null && remainingCap <= 0;
    const canSubscribe = !isClosed && !isFullyBooked;

    const daysOfWeek = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];

    const weeklyMenuGrid = daysOfWeek
      .map((dayName, index) => {
        const dayItems = weeklyMenus.filter((m: any) => Number(m.dayOfWeek) === index);
        const breakfast = dayItems.find((m: any) => String(m.mealType).toLowerCase() === 'breakfast')?.menuItems || 'No menu available';
        const lunch = dayItems.find((m: any) => String(m.mealType).toLowerCase() === 'lunch')?.menuItems || 'No menu available';
        const dinner = dayItems.find((m: any) => String(m.mealType).toLowerCase() === 'dinner')?.menuItems || 'No menu available';

        return `
          <div style="background: #fff; border: 1px solid var(--color-neutral-200); border-radius: 16px; padding: 16px; box-shadow: 0 2px 6px rgba(0,0,0,0.02);">
            <div style="font-weight: 800; font-size: 15px; color: var(--color-primary-700); margin-bottom: 10px; border-bottom: 2px solid var(--color-primary-100); padding-bottom: 6px;">
              ${dayName}
            </div>
            <div style="font-size: 13px; color: var(--color-neutral-700); display: flex; flex-direction: column; gap: 8px;">
              <p style="margin: 0; line-height: 1.4;"><strong style="color: #d97706;">🌅 Breakfast:</strong> ${escapeHtml(breakfast)}</p>
              <p style="margin: 0; line-height: 1.4;"><strong style="color: var(--color-primary-600);">☀️ Lunch:</strong> ${escapeHtml(lunch)}</p>
              <p style="margin: 0; line-height: 1.4;"><strong style="color: #8b5cf6;">🌙 Dinner:</strong> ${escapeHtml(dinner)}</p>
            </div>
          </div>
        `;
      })
      .join('');

    const amenitiesHtml = amenitiesList.length > 0
      ? amenitiesList
        .map(
          (a: string) => `
            <span style="background: var(--color-neutral-100); color: var(--color-neutral-800); font-weight: 600; font-size: 13px; padding: 6px 14px; border-radius: 999px; display: inline-flex; align-items: center; gap: 6px;">
              <i class="fa-solid fa-check-circle" style="color: var(--color-success-600);"></i> ${escapeHtml(a)}
            </span>
          `,
        )
        .join('')
      : `<span style="font-size: 13px; color: var(--color-neutral-500);">No amenities listed.</span>`;

    const primaryPlan = mealPlans[0];
    const baseMonthlyPrice = (primaryPlan && primaryPlan.pricePerMonth && !isNaN(Number(primaryPlan.pricePerMonth)))
      ? Number(primaryPlan.pricePerMonth)
      : (provider.monthlyPrice && !isNaN(Number(provider.monthlyPrice)) ? Number(provider.monthlyPrice) : null);

    const durationOptions = [
      {
        days: 1,
        title: '1 Day Plan',
        description: primaryPlan?.description || 'Daily fresh 4 Roti, Rice, Dal & 2 Sabzi',
        isDefault: false,
      },
      {
        days: 7,
        title: '1 Week Plan (7 Days)',
        description: '7 days daily fresh meals subscription',
        isDefault: false,
      },
      {
        days: 15,
        title: '15 Days Plan',
        description: '15 days half-month meal subscription',
        isDefault: false,
      },
      {
        days: 30,
        title: '1 Month Plan (30 Days)',
        description: 'Full 30 days monthly meal subscription',
        isDefault: true,
      },
    ];

    const plansHtml = baseMonthlyPrice !== null
      ? durationOptions
          .map((opt) => {
            const calculatedPrice = Math.max(1, Math.round(baseMonthlyPrice * (opt.days / 30)));
            const priceText = `₹${calculatedPrice.toLocaleString('en-IN')}`;
            return `
              <label class="duration-plan-card" style="display: flex; align-items: center; justify-content: space-between; border: ${opt.isDefault ? '2px solid #f97316' : '1px solid #e5e7eb'}; background: ${opt.isDefault ? '#fff8f0' : '#ffffff'}; border-radius: 14px; padding: 14px 16px; margin-bottom: 12px; cursor: pointer; transition: all 0.2s ease-in-out;">
                <div style="display: flex; align-items: center; gap: 12px;">
                  <input type="radio" name="durationPlanSelect" value="${opt.days}" ${opt.isDefault ? 'checked' : ''} style="width: 18px; height: 18px; accent-color: #ea580c; cursor: pointer;" />
                  <div>
                    <strong style="font-size: 15px; font-weight: 700; color: #111827; display: block; margin-bottom: 2px;">${escapeHtml(opt.title)}</strong>
                    <p style="font-size: 13px; color: #6b7280; margin: 0; line-height: 1.4;">${escapeHtml(opt.description)}</p>
                  </div>
                </div>
                <span style="font-weight: 800; color: #ea580c; font-size: 17px; white-space: nowrap; margin-left: 12px;">${priceText}</span>
              </label>
            `;
          })
          .join('')
      : `
        <div style="border: 1px dashed var(--color-neutral-300); border-radius: 12px; padding: 16px; margin-bottom: 16px; text-align: center; color: var(--color-neutral-500);">
          <i class="fa-solid fa-info-circle"></i> No meal plans currently available for this provider.
        </div>
      `;

    const avgRatingVal = reviews.length > 0
      ? (reviews.reduce((sum: number, r: any) => sum + Number(r.rating || 0), 0) / reviews.length).toFixed(1)
      : (provider.rating && Number(provider.rating) > 0 ? Number(provider.rating).toFixed(1) : 'New');

    const reviewCards = reviews.length > 0
      ? reviews
        .map((r: any) => {
          const isOwner = currentUserId && r.student?.id === currentUserId;
          const formattedDate = r.createdAt
            ? new Date(r.createdAt).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })
            : '';
          const starStr = '★'.repeat(r.rating) + '☆'.repeat(5 - r.rating);

          return `
            <div style="background: #fff; border: 1px solid var(--color-neutral-200); border-radius: 16px; padding: 20px; margin-bottom: 16px; overflow-wrap: anywhere; word-break: break-word;">
              <div style="display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 8px; flex-wrap: wrap; gap: 8px;">
                <div>
                  <span style="font-weight: 700; font-size: 15px; color: var(--color-neutral-900); display: block;">${escapeHtml(r.student?.name || 'PrimeMate')}</span>
                  <span style="font-size: 12px; color: var(--color-neutral-500);">${escapeHtml(formattedDate)}</span>
                </div>
                <div style="display: flex; align-items: center; gap: 12px;">
                  <span style="color: #f59e0b; font-size: 15px; font-weight: 700; letter-spacing: 2px;">
                    ${starStr}
                  </span>
                  ${
                    isOwner
                      ? `<div style="display: flex; gap: 6px;">
                          <button class="editReviewBtn btn-outline-action" data-id="${r.id}" style="padding: 4px 10px; font-size: 12px; font-weight: 700;">
                            <i class="fa-solid fa-pen"></i> Edit
                          </button>
                          <button class="deleteReviewBtn btn-outline-action" data-id="${r.id}" style="padding: 4px 10px; font-size: 12px; font-weight: 700; color: #dc2626; border-color: #fca5a5;">
                            <i class="fa-solid fa-trash"></i> Delete
                          </button>
                         </div>`
                      : ''
                  }
                </div>
              </div>
              <p style="color: var(--color-neutral-700); font-size: 14px; line-height: 1.5; margin: 8px 0 0 0;">${escapeHtml(r.comment)}</p>
            </div>
          `;
        })
        .join('')
      : `<p style="color: var(--color-neutral-500); font-size: 14px;">No customer reviews written yet for this provider.</p>`;

    const mobilePlansHtml = baseMonthlyPrice !== null
      ? durationOptions
          .map((opt) => {
            const calculatedPrice = Math.max(1, Math.round(baseMonthlyPrice * (opt.days / 30)));
            const priceText = `₹${calculatedPrice.toLocaleString('en-IN')}`;
            return `
              <label class="mobile-duration-plan-card" style="display: flex; align-items: center; justify-content: space-between; border: ${opt.isDefault ? '2px solid #f97316' : '1px solid #e5e7eb'}; background: ${opt.isDefault ? '#fff8f0' : '#ffffff'}; border-radius: 14px; padding: 14px 16px; margin-bottom: 12px; cursor: pointer; transition: all 0.2s ease-in-out;">
                <div style="display: flex; align-items: center; gap: 12px;">
                  <input type="radio" name="mobileDurationPlanSelect" value="${opt.days}" ${opt.isDefault ? 'checked' : ''} style="width: 18px; height: 18px; accent-color: #ea580c; cursor: pointer;" />
                  <div>
                    <strong style="font-size: 15px; font-weight: 700; color: #111827; display: block; margin-bottom: 2px;">${escapeHtml(opt.title)}</strong>
                    <p style="font-size: 13px; color: #6b7280; margin: 0; line-height: 1.4;">${escapeHtml(opt.description)}</p>
                  </div>
                </div>
                <span style="font-weight: 800; color: #ea580c; font-size: 17px; white-space: nowrap; margin-left: 12px;">${priceText}</span>
              </label>
            `;
          })
          .join('')
      : `
        <div style="border: 1px dashed var(--color-neutral-300); border-radius: 12px; padding: 16px; margin-bottom: 16px; text-align: center; color: var(--color-neutral-500);">
          <i class="fa-solid fa-info-circle"></i> No meal plans currently available for this provider.
        </div>
      `;

    let reviewActionAreaHtml = '';
    if (userRole === 'STUDENT') {
      if (isSubscribed) {
        if (myReview) {
          reviewActionAreaHtml = `
            <div style="background: var(--color-primary-50); border: 1px solid var(--color-primary-200); border-radius: 16px; padding: 16px 20px; margin-bottom: 24px; display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: 12px;">
              <div>
                <strong style="font-size: 14px; color: var(--color-primary-800); display: block; margin-bottom: 2px;">You reviewed this mess</strong>
                <span style="font-size: 13px; color: var(--color-primary-700);">Rating: ${'★'.repeat(myReview.rating)} • "${escapeHtml(myReview.comment)}"</span>
              </div>
              <div style="display: flex; gap: 8px;">
                <button id="openEditMyReviewBtn" class="btn-outline-action" style="padding: 8px 16px; font-size: 13px; font-weight: 700; background: #fff;">
                  <i class="fa-solid fa-pen-to-square"></i> Edit Review
                </button>
                <button id="deleteMyReviewBtn" class="btn-outline-action" style="padding: 8px 16px; font-size: 13px; font-weight: 700; background: #fff; color: #dc2626; border-color: #fca5a5;">
                  <i class="fa-solid fa-trash"></i> Delete
                </button>
              </div>
            </div>
          `;
        } else {
          reviewActionAreaHtml = `
            <div style="background: var(--color-neutral-50); border: 1px solid var(--color-neutral-200); border-radius: 16px; padding: 20px; margin-bottom: 24px;">
              <p style="font-size: 14px; font-weight: 600; color: var(--color-neutral-700); margin: 0 0 12px 0;">You haven't reviewed this mess yet.</p>
              <form id="createReviewForm">
                <div style="display: flex; gap: 16px; margin-bottom: 12px; flex-wrap: wrap;">
                  <div>
                    <label style="font-size: 12px; font-weight: 700; display: block; margin-bottom: 4px; color: var(--color-neutral-800);">Rating *</label>
                    <select id="reviewRatingSelect" class="btn-outline-action" style="background: #fff; padding: 8px 12px;" required>
                      <option value="5">⭐⭐⭐⭐⭐ 5 Stars</option>
                      <option value="4">⭐⭐⭐⭐ 4 Stars</option>
                      <option value="3">⭐⭐⭐ 3 Stars</option>
                      <option value="2">⭐⭐ 2 Stars</option>
                      <option value="1">⭐ 1 Star</option>
                    </select>
                  </div>
                </div>
                <div style="margin-bottom: 12px;">
                  <label style="font-size: 12px; font-weight: 700; display: block; margin-bottom: 4px; color: var(--color-neutral-800);">Comment *</label>
                  <textarea id="reviewCommentText" class="btn-outline-action" style="width: 100%; background: #fff; height: 80px; padding: 10px; resize: vertical;" placeholder="Write your experience with food quality, menu, hygiene..." required></textarea>
                </div>
                <button type="submit" class="btn-primary-action" style="padding: 10px 24px; font-size: 14px;">
                  <i class="fa-solid fa-paper-plane"></i> Submit Review
                </button>
              </form>
            </div>
          `;
        }
      } else {
        reviewActionAreaHtml = `
          <div style="background: var(--color-neutral-50); border: 1px dashed var(--color-neutral-300); border-radius: 16px; padding: 16px; margin-bottom: 24px; text-align: center; color: var(--color-neutral-600); font-size: 13px;">
            <i class="fa-solid fa-lock" style="margin-right: 6px;"></i> Subscribed PrimeMates can leave a review for this kitchen.
          </div>
        `;
      }
    }

    const hostelImagesHtml = hostelImages.length > 0
      ? `
        <div id="hostel-gallery-container" style="display: flex; flex-direction: column; gap: 14px;">
          <!-- Main Selected Image -->
          <div id="galleryMainImageWrapper" style="position: relative; width: 100%; aspect-ratio: 16/9; max-height: 420px; border-radius: 18px; overflow: hidden; background: #0f172a; cursor: pointer; border: 1px solid var(--color-neutral-200); box-shadow: 0 4px 14px rgba(0,0,0,0.06);">
            <img id="galleryMainImage" src="${getSafeImageUrl(hostelImages[0].imageUrl)}" alt="Hostel photo" style="width: 100%; height: 100%; object-fit: cover; transition: opacity 0.2s ease;" />
            <div style="position: absolute; bottom: 12px; right: 12px; background: rgba(0,0,0,0.7); color: #fff; padding: 4px 12px; border-radius: 999px; font-size: 12px; font-weight: 700; display: inline-flex; align-items: center; gap: 6px; backdrop-filter: blur(4px);">
              <i class="fa-solid fa-expand"></i> Click to enlarge
            </div>
            <span id="galleryCounterBadge" style="position: absolute; top: 12px; left: 12px; background: rgba(0,0,0,0.7); color: #fff; padding: 4px 10px; border-radius: 999px; font-size: 11px; font-weight: 700; backdrop-filter: blur(4px);">
              1 / ${hostelImages.length}
            </span>
          </div>

          <!-- Horizontal Thumbnails Strip (Scrollable on mobile & desktop) -->
          <div id="galleryThumbnailsStrip" style="display: flex; gap: 10px; overflow-x: auto; padding-bottom: 6px; scrollbar-width: thin; -webkit-overflow-scrolling: touch;">
            ${hostelImages
              .map(
                (img, idx) => `
              <button type="button" class="gallery-thumb-btn" data-img-idx="${idx}" style="flex-shrink: 0; width: 80px; height: 60px; border-radius: 10px; overflow: hidden; border: ${idx === 0 ? '2px solid var(--color-primary-600)' : '2px solid transparent'}; padding: 0; background: var(--color-neutral-100); cursor: pointer; transition: all 0.2s ease;">
                <img src="${getSafeImageUrl(img.imageUrl)}" alt="Thumbnail ${idx + 1}" style="width: 100%; height: 100%; object-fit: cover;" />
              </button>
            `,
              )
              .join('')}
          </div>
        </div>
      `
      : `
        <div style="text-align: center; padding: 24px; background: var(--color-neutral-50); border: 1px dashed var(--color-neutral-300); border-radius: 16px; color: var(--color-neutral-500); font-size: 14px;">
          <i class="fa-solid fa-images" style="font-size: 24px; color: var(--color-neutral-400); margin-bottom: 6px; display: block;"></i>
          No hostel images available.
        </div>
      `;

    detailView.innerHTML = `
      <div>
        <button id="backBtn" class="btn-outline-action" style="margin-bottom: 24px; padding: 8px 16px;">
          <i class="fa-solid fa-arrow-left"></i> Back to Browse Mess
        </button>

        <!-- Hero Header -->
        <div style="position: relative; border-radius: 24px; overflow: hidden; min-height: 260px; margin-bottom: 24px; box-shadow: 0 12px 30px rgba(0,0,0,0.1);">
          <img src="${getSafeImageUrl(provider.imageUrl)}" alt="${escapeHtml(provider.name)}" style="width: 100%; height: 100%; position: absolute; inset: 0; object-fit: cover;" />
          <div style="position: absolute; inset: 0; background: linear-gradient(to top, rgba(0,0,0,0.85) 0%, transparent 60%);"></div>
          
          <div style="position: relative; padding: 24px; color: #fff; display: flex; align-items: flex-end; gap: 16px; min-height: 260px; flex-wrap: wrap;">
            <div style="width: 60px; height: 60px; border-radius: 16px; background: var(--color-primary-600); color: #fff; display: flex; align-items: center; justify-content: center; font-size: 26px; box-shadow: 0 8px 20px rgba(0,0,0,0.3); border: 3px solid #fff; flex-shrink: 0;">
              <i class="fa-solid fa-utensils"></i>
            </div>

            <div>
              <div style="display: flex; gap: 8px; margin-bottom: 8px; flex-wrap: wrap;">
                <span style="background: rgba(255,255,255,0.9); color: #000; padding: 4px 12px; border-radius: 8px; font-size: 12px; font-weight: 700;">
                  <i class="fa-solid fa-star" style="color: var(--color-accent-500);"></i> ${avgRatingVal}
                </span>
                <span style="background: var(--color-primary-500); color: #fff; padding: 4px 12px; border-radius: 8px; font-size: 12px; font-weight: 700;">
                  ${escapeHtml(provider.category || provider.mealType || 'Veg & Non-Veg')}
                </span>
                ${
                  isClosed
                    ? `<span style="background: #ef4444; color: #fff; padding: 4px 12px; border-radius: 8px; font-size: 12px; font-weight: 700;">● CURRENTLY CLOSED</span>`
                    : isFullyBooked
                    ? `<span style="background: #f59e0b; color: #fff; padding: 4px 12px; border-radius: 8px; font-size: 12px; font-weight: 700;">● FULLY BOOKED</span>`
                    : `<span style="background: #22c55e; color: #fff; padding: 4px 12px; border-radius: 8px; font-size: 12px; font-weight: 700;">● SLOTS AVAILABLE</span>`
                }
              </div>

              <h1 class="font-display" style="font-size: clamp(1.75rem, 4vw, 2.25rem); font-weight: 800; color: #fff; margin-bottom: 4px;">${escapeHtml(provider.name)}</h1>
              <p style="font-size: 14px; color: rgba(255,255,255,0.9); margin-bottom: 4px;">
                <i class="fa-solid fa-location-dot"></i> ${escapeHtml(provider.address || provider.city || '')}
              </p>
            </div>
          </div>
        </div>

        <div class="provider-detail-grid">
          <!-- Left Main Column -->
          <div style="display: flex; flex-direction: column; gap: 24px;">
            <!-- Hostel Images Gallery (Student Read-Only) -->
            <div id="hostelImagesSection" style="background: #fff; border: 1px solid var(--color-neutral-200); border-radius: 20px; padding: 24px; box-shadow: 0 4px 12px rgba(0,0,0,0.03);">
              <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 16px; flex-wrap: wrap; gap: 8px;">
                <h2 class="font-display" style="font-size: 20px; font-weight: 700; color: var(--color-neutral-900); margin: 0;">
                  <i class="fa-solid fa-images" style="color: var(--color-primary-600); margin-right: 6px;"></i> Hostel Images
                </h2>
                ${hostelImages.length > 0 ? `<span style="font-size: 13px; font-weight: 700; color: var(--color-primary-700); background: var(--color-primary-50); padding: 4px 12px; border-radius: 999px;">${hostelImages.length} Photos</span>` : ''}
              </div>
              ${hostelImagesHtml}
            </div>

            <!-- 1. About Mess -->
            <div style="background: #fff; border: 1px solid var(--color-neutral-200); border-radius: 20px; padding: 28px; box-shadow: 0 4px 12px rgba(0,0,0,0.03);">
              <h2 class="font-display" style="font-size: 20px; font-weight: 700; margin-bottom: 12px;">About this Kitchen</h2>
              <p style="color: var(--color-neutral-600); font-size: 15px; line-height: 1.6; margin-bottom: 20px;">${escapeHtml(provider.description || 'No description available.')}</p>
              
              <h3 style="font-size: 15px; font-weight: 700; margin-bottom: 10px; color: var(--color-neutral-900);">Hostel Amenities & Facilities</h3>
              <div style="display: flex; gap: 10px; flex-wrap: wrap;">${amenitiesHtml}</div>
            </div>

            <!-- 2. Mobile Subscription Section -->
            <div class="mobile-subscription-section" style="background: #fff; border: 1px solid var(--color-neutral-200); border-radius: 20px; padding: 24px; box-shadow: 0 4px 12px rgba(0,0,0,0.03);">
              <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 14px; flex-wrap: wrap; gap: 8px;">
                <h3 style="font-size: 18px; font-weight: 700; color: var(--color-neutral-900); margin: 0;">Select Meal Plan</h3>
                <button class="openMenuModalBtn btn-outline-action" style="padding: 6px 14px; font-size: 13px; gap: 6px; border-radius: 999px; background: var(--color-primary-50); color: var(--color-primary-600); border-color: var(--color-primary-500); font-weight: 700; cursor: pointer;">
                  <i class="fa-solid fa-utensils"></i> See Menu
                </button>
              </div>
              <div style="margin-bottom: 20px;">${mobilePlansHtml}</div>

              ${
                canSubscribe && baseMonthlyPrice !== null
                  ? `<button id="mobileSubscribeBtn" class="btn-primary-action" style="width: 100%; justify-content: center; padding: 14px; font-size: 16px; border-radius: 14px; box-shadow: 0 4px 16px rgba(234, 88, 12, 0.3);">
                      <i class="fa-solid fa-credit-card"></i> Subscribe Now
                    </button>`
                  : `<button disabled class="btn-outline-action" style="width: 100%; justify-content: center; padding: 14px; font-size: 16px; border-radius: 14px; background: var(--color-neutral-100); color: var(--color-neutral-400); cursor: not-allowed; border-color: var(--color-neutral-300);">
                      <i class="fa-solid fa-ban"></i> ${isClosed ? 'Currently Closed' : isFullyBooked ? 'Fully Booked' : 'No Plans Available'}
                    </button>`
              }
            </div>

            <!-- 3. Desktop Weekly Menu Grid -->
            <div id="weekly-menu-section" class="desktop-menu-section" style="background: #fff; border: 1px solid var(--color-neutral-200); border-radius: 24px; padding: 28px; box-shadow: 0 4px 12px rgba(0,0,0,0.03);">
              <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 20px;">
                <h2 class="font-display" style="font-size: 22px; font-weight: 700; color: var(--color-neutral-900);">Weekly Meal Menu (Mon - Sun)</h2>
                <span style="font-size: 13px; font-weight: 600; color: var(--color-primary-600); background: var(--color-primary-50); padding: 4px 12px; border-radius: 999px;">
                  <i class="fa-solid fa-utensils"></i> Fresh Daily Cooked
                </span>
              </div>
              <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(240px, 1fr)); gap: 16px;">
                ${weeklyMenuGrid}
              </div>
            </div>

            <!-- 4. Customer Reviews Section -->
            <div style="background: #fff; border: 1px solid var(--color-neutral-200); border-radius: 24px; padding: 28px; box-shadow: 0 4px 12px rgba(0,0,0,0.03);">
              <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 20px; flex-wrap: wrap; gap: 12px;">
                <h2 class="font-display" style="font-size: 22px; font-weight: 700; color: var(--color-neutral-900); margin: 0;">Reviews & Ratings</h2>
                <div style="display: flex; align-items: center; gap: 8px;">
                  <span style="font-size: 14px; font-weight: 700; color: var(--color-accent-500);">
                    <i class="fa-solid fa-star"></i> ${avgRatingVal} / 5.0
                  </span>
                  <span style="font-size: 13px; color: var(--color-neutral-500);">(${reviews.length} ${reviews.length === 1 ? 'review' : 'reviews'})</span>
                </div>
              </div>

              ${reviewActionAreaHtml}

              <div>${reviewCards}</div>
            </div>
          </div>

          <!-- Desktop Right Sidebar Subscription Pricing Card -->
          <div class="desktop-subscription-sidebar">
            <div style="position: sticky; top: 100px; background: #fff; border: 1px solid var(--color-neutral-200); border-radius: 24px; padding: 28px; box-shadow: 0 10px 30px rgba(0,0,0,0.06);">
              <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 14px; flex-wrap: wrap; gap: 8px;">
                <h3 style="font-size: 16px; font-weight: 700; color: var(--color-neutral-900); margin: 0;">Select Meal Plan</h3>
                <button class="openMenuModalBtn btn-outline-action" style="padding: 6px 14px; font-size: 12px; gap: 6px; border-radius: 999px; background: var(--color-primary-50); color: var(--color-primary-600); border-color: var(--color-primary-500); font-weight: 700; cursor: pointer;">
                  <i class="fa-solid fa-utensils"></i> See Menu
                </button>
              </div>
              <div style="margin-bottom: 20px;">${plansHtml}</div>

              ${
                canSubscribe && baseMonthlyPrice !== null
                  ? `<button id="sidebarSubscribeBtn" class="btn-primary-action" style="width: 100%; justify-content: center; padding: 14px; font-size: 16px; border-radius: 14px; box-shadow: 0 4px 16px rgba(234, 88, 12, 0.3);">
                      <i class="fa-solid fa-credit-card"></i> Subscribe Now
                    </button>`
                  : `<button disabled class="btn-outline-action" style="width: 100%; justify-content: center; padding: 14px; font-size: 16px; border-radius: 14px; background: var(--color-neutral-100); color: var(--color-neutral-400); cursor: not-allowed; border-color: var(--color-neutral-300);">
                      <i class="fa-solid fa-ban"></i> ${isClosed ? 'Currently Closed' : isFullyBooked ? 'Fully Booked' : 'No Plans Available'}
                    </button>`
              }
            </div>
          </div>
        </div>
      </div>

      <!-- Edit Review Modal Overlay -->
      <div id="editReviewModal" style="display: none; position: fixed; inset: 0; background: rgba(0,0,0,0.6); z-index: 9999; align-items: center; justify-content: center; padding: 16px; backdrop-filter: blur(4px);">
        <div style="background: #fff; border-radius: 24px; max-width: 500px; width: 100%; padding: 28px; box-shadow: 0 20px 50px rgba(0,0,0,0.25);">
          <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 16px;">
            <h3 class="font-display" style="font-size: 18px; font-weight: 800; color: var(--color-neutral-900); margin: 0;">Edit Your Review</h3>
            <button id="closeEditReviewModalBtn" style="background: none; border: none; font-size: 20px; cursor: pointer; color: var(--color-neutral-500);">&times;</button>
          </div>
          <form id="editReviewForm">
            <input type="hidden" id="editReviewIdInput" value="${myReview?.id || ''}" />
            <div style="margin-bottom: 14px;">
              <label style="font-size: 12px; font-weight: 700; display: block; margin-bottom: 4px; color: var(--color-neutral-800);">Rating *</label>
              <select id="editReviewRatingSelect" class="btn-outline-action" style="width: 100%; background: #fff; padding: 10px 14px;" required>
                <option value="5" ${myReview?.rating === 5 ? 'selected' : ''}>⭐⭐⭐⭐⭐ 5 Stars</option>
                <option value="4" ${myReview?.rating === 4 ? 'selected' : ''}>⭐⭐⭐⭐ 4 Stars</option>
                <option value="3" ${myReview?.rating === 3 ? 'selected' : ''}>⭐⭐⭐ 3 Stars</option>
                <option value="2" ${myReview?.rating === 2 ? 'selected' : ''}>⭐⭐ 2 Stars</option>
                <option value="1" ${myReview?.rating === 1 ? 'selected' : ''}>⭐ 1 Star</option>
              </select>
            </div>
            <div style="margin-bottom: 20px;">
              <label style="font-size: 12px; font-weight: 700; display: block; margin-bottom: 4px; color: var(--color-neutral-800);">Comment *</label>
              <textarea id="editReviewCommentText" class="btn-outline-action" style="width: 100%; background: #fff; height: 90px; padding: 10px; resize: vertical;" required>${escapeHtml(myReview?.comment || '')}</textarea>
            </div>
            <div style="display: flex; justify-content: flex-end; gap: 12px;">
              <button type="button" id="cancelEditReviewModalBtn" class="btn-outline-action" style="padding: 8px 18px; font-size: 14px;">Cancel</button>
              <button type="submit" class="btn-primary-action" style="padding: 8px 22px; font-size: 14px;">Save Changes</button>
            </div>
          </form>
        </div>
      </div>

      <!-- Delete Confirmation Modal Overlay -->
      <div id="deleteReviewModal" style="display: none; position: fixed; inset: 0; background: rgba(0,0,0,0.6); z-index: 9999; align-items: center; justify-content: center; padding: 16px; backdrop-filter: blur(4px);">
        <div style="background: #fff; border-radius: 24px; max-width: 420px; width: 100%; padding: 28px; box-shadow: 0 20px 50px rgba(0,0,0,0.25); text-align: center;">
          <div style="width: 56px; height: 56px; border-radius: 50%; background: #fee2e2; color: #dc2626; display: flex; align-items: center; justify-content: center; font-size: 24px; margin: 0 auto 16px;">
            <i class="fa-solid fa-triangle-exclamation"></i>
          </div>
          <h3 class="font-display" style="font-size: 18px; font-weight: 800; color: var(--color-neutral-900); margin: 0 0 8px 0;">Delete this review?</h3>
          <p style="font-size: 14px; color: var(--color-neutral-600); margin: 0 0 24px 0;">This action cannot be undone. Your rating and comment will be removed permanently.</p>
          <div style="display: flex; justify-content: center; gap: 12px;">
            <button id="cancelDeleteReviewModalBtn" class="btn-outline-action" style="padding: 10px 20px; font-size: 14px;">Cancel</button>
            <button id="confirmDeleteReviewBtn" class="btn-primary-action" style="padding: 10px 22px; font-size: 14px; background: #dc2626; border-color: #dc2626;">Delete</button>
          </div>
        </div>
      </div>

      <!-- Weekly Menu Modal -->
      <div id="weeklyMenuModal" style="display: none; position: fixed; inset: 0; background: rgba(0,0,0,0.6); z-index: 9999; align-items: center; justify-content: center; padding: 16px; backdrop-filter: blur(4px);">
        <div style="background: #fff; border-radius: 24px; max-width: 600px; width: 100%; max-height: 85vh; display: flex; flex-direction: column; overflow: hidden; box-shadow: 0 20px 50px rgba(0,0,0,0.25);">
          <div style="padding: 20px 24px; border-bottom: 1px solid var(--color-neutral-200); display: flex; align-items: center; justify-content: space-between; background: var(--color-neutral-50);">
            <div>
              <h3 class="font-display" style="font-size: 18px; font-weight: 800; color: var(--color-neutral-900); margin: 0; display: flex; align-items: center; gap: 8px;">
                <i class="fa-solid fa-utensils" style="color: var(--color-primary-600);"></i> Weekly Meal Menu
              </h3>
              <p style="font-size: 13px; color: var(--color-neutral-500); margin: 2px 0 0 0;">Freshly cooked daily schedule (Mon - Sun)</p>
            </div>
            <button id="closeMenuModalBtn" style="background: var(--color-neutral-200); border: none; width: 32px; height: 32px; border-radius: 50%; font-size: 16px; color: var(--color-neutral-700); cursor: pointer; display: flex; align-items: center; justify-content: center;">✕</button>
          </div>
          <div style="padding: 20px 24px; overflow-y: auto; display: flex; flex-direction: column; gap: 16px;">
            <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(220px, 1fr)); gap: 14px;">
              ${weeklyMenuGrid}
            </div>
          </div>
        </div>
      </div>

      <!-- Image Lightbox Viewer Modal (Student Read-Only) -->
      <div id="imageLightboxModal" style="display: none; position: fixed; inset: 0; background: rgba(0,0,0,0.92); z-index: 99999; align-items: center; justify-content: center; padding: 16px; backdrop-filter: blur(8px);">
        <button id="closeLightboxBtn" style="position: absolute; top: 20px; right: 20px; background: rgba(255,255,255,0.2); border: none; color: #fff; width: 44px; height: 44px; border-radius: 50%; font-size: 22px; cursor: pointer; display: flex; align-items: center; justify-content: center; transition: background 0.2s;">
          <i class="fa-solid fa-xmark"></i>
        </button>
        <div style="max-width: 90vw; max-height: 85vh; display: flex; flex-direction: column; align-items: center; justify-content: center;">
          <img id="lightboxImage" src="" alt="Hostel photo enlarged" style="max-width: 100%; max-height: 80vh; object-fit: contain; border-radius: 12px; box-shadow: 0 20px 50px rgba(0,0,0,0.5);" />
          <span id="lightboxCaption" style="color: rgba(255,255,255,0.85); font-size: 14px; font-weight: 600; margin-top: 14px;"></span>
        </div>
      </div>
    `;

    document.getElementById('backBtn')?.addEventListener('click', () => navigate('#/providers'));

    // Gallery Thumbnail & Lightbox View Handlers (Read-Only)
    let currentGalleryIdx = 0;
    const updateGalleryMain = (idx: number) => {
      if (!hostelImages[idx]) return;
      currentGalleryIdx = idx;
      const mainImg = document.getElementById('galleryMainImage') as HTMLImageElement;
      if (mainImg) {
        mainImg.src = getSafeImageUrl(hostelImages[idx].imageUrl);
      }
      const counterBadge = document.getElementById('galleryCounterBadge');
      if (counterBadge) {
        counterBadge.innerText = `${idx + 1} / ${hostelImages.length}`;
      }
      document.querySelectorAll('.gallery-thumb-btn').forEach((btn) => {
        const btnIdx = Number(btn.getAttribute('data-img-idx'));
        if (btnIdx === idx) {
          (btn as HTMLElement).style.border = '2px solid var(--color-primary-600)';
        } else {
          (btn as HTMLElement).style.border = '2px solid transparent';
        }
      });
    };

    document.querySelectorAll('.gallery-thumb-btn').forEach((btn) => {
      btn.addEventListener('click', (e) => {
        const idx = Number((e.currentTarget as HTMLElement).getAttribute('data-img-idx'));
        updateGalleryMain(idx);
      });
    });

    const lightboxModal = document.getElementById('imageLightboxModal');
    const lightboxImg = document.getElementById('lightboxImage') as HTMLImageElement;
    const lightboxCaption = document.getElementById('lightboxCaption');

    const openLightbox = (idx: number) => {
      if (!hostelImages[idx] || !lightboxModal || !lightboxImg) return;
      lightboxImg.src = getSafeImageUrl(hostelImages[idx].imageUrl);
      if (lightboxCaption) {
        lightboxCaption.innerText = `Photo ${idx + 1} of ${hostelImages.length}`;
      }
      lightboxModal.style.display = 'flex';
      document.body.style.overflow = 'hidden';
    };

    const closeLightbox = () => {
      if (lightboxModal) {
        lightboxModal.style.display = 'none';
        document.body.style.overflow = '';
      }
    };

    document.getElementById('galleryMainImageWrapper')?.addEventListener('click', () => {
      openLightbox(currentGalleryIdx);
    });

    document.getElementById('closeLightboxBtn')?.addEventListener('click', closeLightbox);
    lightboxModal?.addEventListener('click', (e) => {
      if (e.target === lightboxModal) closeLightbox();
    });
    window.addEventListener('keydown', (e) => {
      if (e.key === 'Escape' && lightboxModal && lightboxModal.style.display === 'flex') {
        closeLightbox();
      }
    });

    // See Menu Modal Toggle & Smooth Scroll Handlers
    const menuModal = document.getElementById('weeklyMenuModal');
    const menuSection = document.getElementById('weekly-menu-section');

    const closeMenuModal = () => {
      if (menuModal) {
        menuModal.style.display = 'none';
        document.body.style.overflow = '';
      }
    };

    document.querySelectorAll('.openMenuModalBtn').forEach((btn) => {
      btn.addEventListener('click', (e) => {
        e.preventDefault();
        e.stopPropagation();
        if (window.innerWidth > 768 && menuSection) {
          menuSection.scrollIntoView({ behavior: 'smooth', block: 'start' });
        } else if (menuModal) {
          menuModal.style.display = 'flex';
          document.body.style.overflow = 'hidden';
        }
      });
    });

    document.getElementById('closeMenuModalBtn')?.addEventListener('click', closeMenuModal);
    menuModal?.addEventListener('click', (e) => {
      if (e.target === menuModal) closeMenuModal();
    });

    // Desktop Subscribe Button
    document.getElementById('sidebarSubscribeBtn')?.addEventListener('click', () => {
      const selectedRadio = document.querySelector('input[name="durationPlanSelect"]:checked') as HTMLInputElement;
      const selectedDays = selectedRadio ? Number(selectedRadio.value) : 30;
      const targetPlanId = mealPlans[0] ? mealPlans[0].id : providerId;
      navigate(`#/checkout/${targetPlanId}?days=${selectedDays}`);
    });

    // Mobile Subscribe Button
    document.getElementById('mobileSubscribeBtn')?.addEventListener('click', () => {
      const selectedRadio = document.querySelector('input[name="mobileDurationPlanSelect"]:checked') as HTMLInputElement;
      const selectedDays = selectedRadio ? Number(selectedRadio.value) : 30;
      const targetPlanId = mealPlans[0] ? mealPlans[0].id : providerId;
      navigate(`#/checkout/${targetPlanId}?days=${selectedDays}`);
    });

    // Create Review Form Listener
    const createReviewForm = document.getElementById('createReviewForm') as HTMLFormElement;
    if (createReviewForm) {
      createReviewForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        const rating = parseInt((document.getElementById('reviewRatingSelect') as HTMLSelectElement).value);
        const comment = (document.getElementById('reviewCommentText') as HTMLTextAreaElement).value.trim();

        if (!comment) {
          showToast('Please enter a review comment', 'error');
          return;
        }

        try {
          await api.post('/reviews', { providerId, rating, comment });
          showToast('Review submitted successfully!', 'success');
          renderProviderDetail(providerId);
        } catch (err: any) {
          showToast(err.message || 'Failed to submit review', 'error');
        }
      });
    }

    // Edit Review Modal Handlers
    const editReviewModal = document.getElementById('editReviewModal');
    const openEditModal = (revId: string) => {
      const rev = reviews.find((r: any) => r.id === revId);
      if (rev) {
        (document.getElementById('editReviewIdInput') as HTMLInputElement).value = rev.id;
        (document.getElementById('editReviewRatingSelect') as HTMLSelectElement).value = String(rev.rating);
        (document.getElementById('editReviewCommentText') as HTMLTextAreaElement).value = rev.comment || '';
        if (editReviewModal) {
          editReviewModal.style.display = 'flex';
          document.body.style.overflow = 'hidden';
        }
      }
    };

    document.getElementById('openEditMyReviewBtn')?.addEventListener('click', () => {
      if (myReview) openEditModal(myReview.id);
    });

    document.querySelectorAll('.editReviewBtn').forEach((btn) => {
      btn.addEventListener('click', (e) => {
        const revId = (e.currentTarget as HTMLElement).getAttribute('data-id');
        if (revId) openEditModal(revId);
      });
    });

    const closeEditModal = () => {
      if (editReviewModal) {
        editReviewModal.style.display = 'none';
        document.body.style.overflow = '';
      }
    };
    document.getElementById('closeEditReviewModalBtn')?.addEventListener('click', closeEditModal);
    document.getElementById('cancelEditReviewModalBtn')?.addEventListener('click', closeEditModal);

    const editReviewForm = document.getElementById('editReviewForm') as HTMLFormElement;
    if (editReviewForm) {
      editReviewForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        const revId = (document.getElementById('editReviewIdInput') as HTMLInputElement).value;
        const rating = parseInt((document.getElementById('editReviewRatingSelect') as HTMLSelectElement).value);
        const comment = (document.getElementById('editReviewCommentText') as HTMLTextAreaElement).value.trim();

        if (!comment) {
          showToast('Please enter a review comment', 'error');
          return;
        }

        try {
          await api.patch(`/reviews/${revId}`, { rating, comment });
          showToast('Review updated successfully!', 'success');
          closeEditModal();
          renderProviderDetail(providerId);
        } catch (err: any) {
          showToast(err.message || 'Failed to update review', 'error');
        }
      });
    }

    // Delete Review Modal Handlers
    let targetDeleteId: string | null = null;
    const deleteReviewModal = document.getElementById('deleteReviewModal');
    const openDeleteModal = (revId: string) => {
      targetDeleteId = revId;
      if (deleteReviewModal) {
        deleteReviewModal.style.display = 'flex';
        document.body.style.overflow = 'hidden';
      }
    };

    document.getElementById('deleteMyReviewBtn')?.addEventListener('click', () => {
      if (myReview) openDeleteModal(myReview.id);
    });

    document.querySelectorAll('.deleteReviewBtn').forEach((btn) => {
      btn.addEventListener('click', (e) => {
        const revId = (e.currentTarget as HTMLElement).getAttribute('data-id');
        if (revId) openDeleteModal(revId);
      });
    });

    const closeDeleteModal = () => {
      targetDeleteId = null;
      if (deleteReviewModal) {
        deleteReviewModal.style.display = 'none';
        document.body.style.overflow = '';
      }
    };
    document.getElementById('cancelDeleteReviewModalBtn')?.addEventListener('click', closeDeleteModal);

    document.getElementById('confirmDeleteReviewBtn')?.addEventListener('click', async () => {
      if (!targetDeleteId) return;
      try {
        await api.delete(`/reviews/${targetDeleteId}`);
        showToast('Review deleted successfully!', 'success');
        closeDeleteModal();
        renderProviderDetail(providerId);
      } catch (err: any) {
        showToast(err.message || 'Failed to delete review', 'error');
      }
    });

  } catch (err: any) {
    renderError(err.message || 'Server error while fetching kitchen details.');
  }
}
