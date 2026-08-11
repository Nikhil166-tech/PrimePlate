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
    const provider: any = await api.get(`/providers/${providerId}`);
    if (!provider || !provider.id) {
      renderError('Provider not found or unavailable.');
      return;
    }

    let mealPlans: any[] = [];
    try {
      const plansData: any = await api.get(`/meal-plans/provider/${providerId}`);
      mealPlans = Array.isArray(plansData) ? plansData : [];
    } catch (_) {
      mealPlans = [];
    }

    let weeklyMenus: any[] = [];
    try {
      const menuData: any = await api.get(`/weekly-menus/provider/${providerId}`);
      weeklyMenus = Array.isArray(menuData) ? menuData : [];
    } catch (_) {
      weeklyMenus = [];
    }

    let reviews: any[] = [];
    try {
      const revData: any = await api.get(`/reviews/provider/${providerId}`);
      reviews = Array.isArray(revData) ? revData : [];
    } catch (_) {
      reviews = [];
    }

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
        const breakfast = dayItems.find((m: any) => m.mealType === 'Breakfast')?.menuItems || 'No menu available';
        const lunch = dayItems.find((m: any) => m.mealType === 'Lunch')?.menuItems || 'No menu available';
        const dinner = dayItems.find((m: any) => m.mealType === 'Dinner')?.menuItems || 'No menu available';

        return `
          <div style="background: #fff; border: 1px solid var(--color-neutral-200); border-radius: 16px; padding: 16px; box-shadow: 0 2px 6px rgba(0,0,0,0.02);">
            <div style="font-weight: 800; font-size: 15px; color: var(--color-primary-700); margin-bottom: 10px; border-bottom: 2px solid var(--color-primary-100); padding-bottom: 6px;">
              ${dayName}
            </div>
            <div style="font-size: 13px; color: var(--color-neutral-700); space-y: 6px;">
              <p style="margin-bottom: 4px;"><strong>🌅 Breakfast:</strong> ${escapeHtml(breakfast)}</p>
              <p style="margin-bottom: 4px;"><strong>☀️ Lunch:</strong> ${escapeHtml(lunch)}</p>
              <p style="margin-bottom: 0;"><strong>🌙 Dinner:</strong> ${escapeHtml(dinner)}</p>
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

    const plansHtml = mealPlans.length > 0
      ? mealPlans
          .map(
            (p: any, idx: number) => {
              const pPrice = p.pricePerMonth && !isNaN(Number(p.pricePerMonth)) && Number(p.pricePerMonth) > 0 ? Number(p.pricePerMonth) : null;
              const priceText = pPrice !== null ? `₹${pPrice.toLocaleString('en-IN')}` : 'Price unavailable';
              const isDisabled = pPrice === null;
              return `
              <label style="display: flex; align-items: center; justify-content: space-between; border: ${idx === 0 && !isDisabled ? '2px solid var(--color-primary-500)' : '1px solid var(--color-neutral-200)'}; background: ${idx === 0 && !isDisabled ? 'var(--color-primary-50)' : '#fff'}; border-radius: 12px; padding: 12px; margin-bottom: 10px; cursor: ${isDisabled ? 'not-allowed' : 'pointer'}; opacity: ${isDisabled ? '0.6' : '1'};">
                <div style="display: flex; align-items: center; gap: 10px;">
                  <input type="radio" name="planSelect" value="${p.id}" ${idx === 0 && !isDisabled ? 'checked' : ''} ${isDisabled ? 'disabled' : ''} />
                  <div>
                    <strong style="font-size: 14px; color: var(--color-neutral-900);">${escapeHtml(p.title)}</strong>
                    <p style="font-size: 12px; color: var(--color-neutral-500);">${escapeHtml(p.description || 'Monthly subscription plan')}</p>
                  </div>
                </div>
                <span style="font-weight: 700; color: ${isDisabled ? 'var(--color-neutral-500)' : 'var(--color-primary-600)'}; font-size: 14px;">${priceText}</span>
              </label>
            `;
            },
          )
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
                <span style="font-weight: 700; font-size: 15px; color: var(--color-neutral-900);">${escapeHtml(r.student?.name || r.student?.email || 'Student Customer')}</span>
                <span style="color: var(--color-accent-500); font-size: 14px; font-weight: 700;">
                  <i class="fa-solid fa-star"></i> ${r.rating}.0
                </span>
              </div>
              <p style="color: var(--color-neutral-600); font-size: 14px; line-height: 1.5; margin-bottom: 12px;">${escapeHtml(r.comment)}</p>
              ${
                r.providerReply
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
                    : `<span style="background: #22c55e; color: #fff; padding: 4px 12px; border-radius: 8px; font-size: 12px; font-weight: 700;">● ACCEPTING SUBSCRIPTIONS ${remainingCap !== null ? `(${remainingCap} seats left)` : ''}</span>`
                }
              </div>

              <h1 class="font-display" style="font-size: clamp(1.75rem, 4vw, 2.25rem); font-weight: 800; color: #fff; margin-bottom: 4px;">${escapeHtml(provider.name)}</h1>
              <p style="font-size: 14px; color: rgba(255,255,255,0.9); margin-bottom: 4px;">
                <i class="fa-solid fa-location-dot"></i> ${escapeHtml(provider.address || provider.city || '')}
              </p>
            </div>
          </div>
        </div>

        <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(280px, 1fr)); gap: 24px;">
          <!-- Left Column Content -->
          <div style="display: flex; flex-direction: column; gap: 32px;">
            <!-- About Mess -->
            <div style="background: #fff; border: 1px solid var(--color-neutral-200); border-radius: 20px; padding: 28px; box-shadow: 0 4px 12px rgba(0,0,0,0.03);">
              <h2 class="font-display" style="font-size: 20px; font-weight: 700; margin-bottom: 12px;">About this Kitchen</h2>
              <p style="color: var(--color-neutral-600); font-size: 15px; line-height: 1.6; margin-bottom: 20px;">${escapeHtml(provider.description || 'No description available.')}</p>
              
              <h3 style="font-size: 15px; font-weight: 700; margin-bottom: 10px; color: var(--color-neutral-900);">Hostel Amenities & Facilities</h3>
              <div style="display: flex; gap: 10px; flex-wrap: wrap;">${amenitiesHtml}</div>
            </div>

            <!-- Capacity Progress Info Card -->
            <div style="background: #fff; border: 1px solid var(--color-neutral-200); border-radius: 20px; padding: 24px; box-shadow: 0 4px 12px rgba(0,0,0,0.03);">
              <h3 class="font-display" style="font-size: 18px; font-weight: 700; margin-bottom: 12px;">Kitchen Subscription Capacity</h3>
              <div style="display: flex; justify-content: space-between; font-size: 14px; margin-bottom: 8px;">
                <span>Total Capacity: <strong>${totalCap ?? 'Unspecified'}</strong></span>
                <span>Active Subscribers: <strong>${currentSubs}</strong></span>
                <span>Seats Available: <strong style="color: ${remainingCap !== null && remainingCap > 0 ? '#059669' : '#dc2626'};">${remainingCap ?? 'N/A'}</strong></span>
              </div>
              <div style="width: 100%; height: 8px; background: var(--color-neutral-200); border-radius: 999px; overflow: hidden;">
                <div style="width: ${totalCap && totalCap > 0 ? Math.min(100, Math.round((currentSubs / totalCap) * 100)) : 0}%; height: 100%; background: ${remainingCap !== null && remainingCap > 0 ? 'var(--color-primary-600)' : '#dc2626'};"></div>
              </div>
            </div>

            <!-- Weekly Menu Grid -->
            <div style="background: #fff; border: 1px solid var(--color-neutral-200); border-radius: 24px; padding: 28px; box-shadow: 0 4px 12px rgba(0,0,0,0.03);">
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

            <!-- Customer Reviews Section -->
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

          <!-- Right Sidebar Subscription Pricing Card -->
          <div>
            <div style="position: sticky; top: 100px; background: #fff; border: 1px solid var(--color-neutral-200); border-radius: 24px; padding: 28px; box-shadow: 0 10px 30px rgba(0,0,0,0.06);">
              <h3 style="font-size: 16px; font-weight: 700; color: var(--color-neutral-900); margin-bottom: 14px;">Select Meal Plan</h3>
              <div style="margin-bottom: 20px;">${plansHtml}</div>

              ${
                canSubscribe && mealPlans.length > 0
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
    `;

    document.getElementById('backBtn')?.addEventListener('click', () => navigate('#/providers'));

    document.getElementById('sidebarSubscribeBtn')?.addEventListener('click', () => {
      const selectedPlanRadio = document.querySelector('input[name="planSelect"]:checked') as HTMLInputElement;
      const targetPlanId = selectedPlanRadio?.value || (mealPlans[0] ? mealPlans[0].id : providerId);
      navigate(`#/checkout/${targetPlanId}`);
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
