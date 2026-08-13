import api from '../api';
import { navigate } from '../router';
import { showToast } from '../components/toast';
import { renderNavbar, attachNavbarEvents } from '../components/navbar';
import { escapeHtml, getSafeImageUrl } from '../utils/sanitize';

export async function renderProviderDetail(providerId: string) {
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

    <footer class="footer">
      © ${new Date().getFullYear()} PrimePlate. Premium Meal Subscription Platform.
    </footer>
  `;

  attachNavbarEvents();

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
    const [providerRes, plansRes, menuRes, revRes] = await Promise.allSettled([
      api.get(`/providers/${providerId}`),
      api.get(`/meal-plans/provider/${providerId}`),
      api.get(`/weekly-menus/provider/${providerId}`),
      api.get(`/reviews/provider/${providerId}`),
    ]);

    const provider: any = providerRes.status === 'fulfilled' ? providerRes.value : null;
    if (!provider || !provider.id) {
      renderError('Provider not found or unavailable.');
      return;
    }

    const mealPlans: any[] = plansRes.status === 'fulfilled' && Array.isArray(plansRes.value) ? plansRes.value : [];
    const weeklyMenus: any[] = menuRes.status === 'fulfilled' && Array.isArray(menuRes.value) ? menuRes.value : [];
    const reviews: any[] = revRes.status === 'fulfilled' && Array.isArray(revRes.value) ? revRes.value : [];

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

    const ratingDisplay = (provider.rating ?? 0) > 0 ? Number(provider.rating).toFixed(1) : 'New';

    const reviewCards = reviews.length > 0
      ? reviews
        .map(
          (r: any) => `
            <div style="background: #fff; border: 1px solid var(--color-neutral-200); border-radius: 16px; padding: 20px; margin-bottom: 16px;">
              <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 8px;">
                <span style="font-weight: 700; font-size: 15px; color: var(--color-neutral-900);">${escapeHtml(r.student?.name || 'Student Customer')}</span>
                <span style="color: var(--color-accent-500); font-size: 14px; font-weight: 700;">
                  <i class="fa-solid fa-star"></i> ${r.rating}.0
                </span>
              </div>
              <p style="color: var(--color-neutral-600); font-size: 14px; line-height: 1.5; margin-bottom: 12px;">${escapeHtml(r.comment)}</p>
              ${r.providerReply
              ? `<div style="background: var(--color-primary-50); border-left: 3px solid var(--color-primary-600); padding: 12px 16px; border-radius: 8px; font-size: 13px;">
                      <strong style="color: var(--color-primary-700); display: block; margin-bottom: 4px;">Kitchen Owner Reply:</strong>
                      <span style="color: var(--color-neutral-700);">${escapeHtml(r.providerReply)}</span>
                     </div>`
              : ''
            }
            </div>
          `,
        )
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
                  <i class="fa-solid fa-star" style="color: var(--color-accent-500);"></i> ${ratingDisplay}
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
          <!-- Left Main Column (Order: About -> Mobile Subscription Options -> Mobile See Menu Trigger -> Desktop Weekly Menu -> Reviews) -->
          <div style="display: flex; flex-direction: column; gap: 24px;">
            <!-- 1. About Mess -->
            <div style="background: #fff; border: 1px solid var(--color-neutral-200); border-radius: 20px; padding: 28px; box-shadow: 0 4px 12px rgba(0,0,0,0.03);">
              <h2 class="font-display" style="font-size: 20px; font-weight: 700; margin-bottom: 12px;">About this Kitchen</h2>
              <p style="color: var(--color-neutral-600); font-size: 15px; line-height: 1.6; margin-bottom: 20px;">${escapeHtml(provider.description || 'No description available.')}</p>
              
              <h3 style="font-size: 15px; font-weight: 700; margin-bottom: 10px; color: var(--color-neutral-900);">Hostel Amenities & Facilities</h3>
              <div style="display: flex; gap: 10px; flex-wrap: wrap;">${amenitiesHtml}</div>
            </div>

            <!-- 2. Mobile-Only Subscription Section -->
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
            <div class="desktop-menu-section" style="background: #fff; border: 1px solid var(--color-neutral-200); border-radius: 24px; padding: 28px; box-shadow: 0 4px 12px rgba(0,0,0,0.03);">
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
              <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 20px;">
                <h2 class="font-display" style="font-size: 22px; font-weight: 700; color: var(--color-neutral-900);">Reviews & Ratings</h2>
                <span style="font-size: 14px; font-weight: 700; color: var(--color-accent-500);">
                  <i class="fa-solid fa-star"></i> ${ratingDisplay} / 5.0
                </span>
              </div>

              <form id="reviewForm" style="background: var(--color-neutral-50); border: 1px solid var(--color-neutral-200); border-radius: 16px; padding: 20px; margin-bottom: 24px;">
                <h3 style="font-size: 15px; font-weight: 700; margin-bottom: 12px;">Write a Review</h3>
                <div style="display: flex; gap: 16px; margin-bottom: 12px;">
                  <select id="reviewRating" class="btn-outline-action" style="background: #fff;">
                    <option value="5">⭐⭐⭐⭐⭐ 5 Stars</option>
                    <option value="4">⭐⭐⭐⭐ 4 Stars</option>
                    <option value="3">⭐⭐⭐ 3 Stars</option>
                  </select>
                </div>
                <textarea id="reviewComment" class="btn-outline-action" style="width: 100%; background: #fff; height: 70px; margin-bottom: 12px; resize: vertical;" placeholder="Share your experience..." required></textarea>
                <button type="submit" class="btn-primary-action" style="padding: 8px 20px; font-size: 13px;">Submit Review</button>
              </form>

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

      <!-- Mobile See Menu Modal Overlay -->
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
    `;

    document.getElementById('backBtn')?.addEventListener('click', () => navigate('#/providers'));

    // See Menu Modal Toggle Handlers
    const menuModal = document.getElementById('weeklyMenuModal');
    document.querySelectorAll('.openMenuModalBtn').forEach((btn) => {
      btn.addEventListener('click', () => {
        if (menuModal) menuModal.style.display = 'flex';
      });
    });
    document.getElementById('closeMenuModalBtn')?.addEventListener('click', () => {
      if (menuModal) menuModal.style.display = 'none';
    });
    menuModal?.addEventListener('click', (e) => {
      if (e.target === menuModal) menuModal.style.display = 'none';
    });

    // Desktop Plan Radio Toggle
    document.querySelectorAll('input[name="durationPlanSelect"]').forEach((radio) => {
      radio.addEventListener('change', () => {
        document.querySelectorAll('.duration-plan-card').forEach((card) => {
          (card as HTMLElement).style.borderColor = '#e5e7eb';
          (card as HTMLElement).style.borderWidth = '1px';
          (card as HTMLElement).style.background = '#ffffff';
        });
        const checkedRadio = document.querySelector('input[name="durationPlanSelect"]:checked') as HTMLInputElement;
        if (checkedRadio) {
          const cardLabel = checkedRadio.closest('.duration-plan-card') as HTMLElement;
          if (cardLabel) {
            cardLabel.style.borderColor = '#f97316';
            cardLabel.style.borderWidth = '2px';
            cardLabel.style.background = '#fff8f0';
          }
        }
      });
    });

    // Mobile Plan Radio Toggle
    document.querySelectorAll('input[name="mobileDurationPlanSelect"]').forEach((radio) => {
      radio.addEventListener('change', () => {
        document.querySelectorAll('.mobile-duration-plan-card').forEach((card) => {
          (card as HTMLElement).style.borderColor = '#e5e7eb';
          (card as HTMLElement).style.borderWidth = '1px';
          (card as HTMLElement).style.background = '#ffffff';
        });
        const checkedRadio = document.querySelector('input[name="mobileDurationPlanSelect"]:checked') as HTMLInputElement;
        if (checkedRadio) {
          const cardLabel = checkedRadio.closest('.mobile-duration-plan-card') as HTMLElement;
          if (cardLabel) {
            cardLabel.style.borderColor = '#f97316';
            cardLabel.style.borderWidth = '2px';
            cardLabel.style.background = '#fff8f0';
          }
        }
      });
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

    const reviewForm = document.getElementById('reviewForm') as HTMLFormElement;
    reviewForm?.addEventListener('submit', async (e) => {
      e.preventDefault();
      const rating = parseInt((document.getElementById('reviewRating') as HTMLSelectElement).value);
      const comment = (document.getElementById('reviewComment') as HTMLTextAreaElement).value;

      try {
        await api.post('/reviews', { providerId, rating, comment });
        showToast('Review submitted successfully!', 'success');
        renderProviderDetail(providerId);
      } catch (err: any) {
        showToast(err.message || 'Failed to submit review', 'error');
      }
    });
  } catch (err: any) {
    renderError(err.message || 'Server error while fetching kitchen details.');
  }
}
