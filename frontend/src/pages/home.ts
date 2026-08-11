import { navigate } from '../router';
import { renderNavbar, attachNavbarEvents } from '../components/navbar';
import api from '../api';
import { escapeHtml, getSafeImageUrl } from '../utils/sanitize';

export async function renderHome() {
  const container = document.getElementById('app')!;

  // Render full HTML skeleton immediately (0ms instant render)
  container.innerHTML = `
    ${renderNavbar()}
    <main class="main-content" style="padding-top: 64px;">
      <!-- Hero Section -->
      <section style="position: relative; padding: 48px 16px 64px; background: linear-gradient(135deg, #fff7ed 0%, #ffffff 50%, #f0f9ff 100%); overflow: hidden;">
        <div style="max-width: 1280px; margin: 0 auto; display: grid; grid-template-columns: repeat(auto-fit, minmax(280px, 1fr)); gap: 36px; align-items: center;">
          <div class="animate-fade-in-up">
            <div style="display: inline-flex; align-items: center; gap: 8px; background: var(--color-primary-100); color: var(--color-primary-700); padding: 6px 16px; border-radius: 999px; font-size: 14px; font-weight: 600; margin-bottom: 20px;">
              <i class="fa-solid fa-utensils"></i> Digital Mess Card Platform
            </div>
            <h1 class="font-display" style="font-size: clamp(2rem, 5vw, 3rem); font-weight: 800; color: var(--color-neutral-900); line-height: 1.15; margin-bottom: 20px;">
              No time to cook?<br />
              <span style="color: var(--color-primary-600);">Subscribe to a mess</span><br />near you.
            </h1>
            <p style="font-size: clamp(0.95rem, 2.5vw, 1.125rem); color: var(--color-neutral-600); line-height: 1.6; margin-bottom: 28px; max-width: 520px;">
              PrimePlate connects students and IT professionals with hostels and PGs that cook fresh food daily. Get a digital mess card and enjoy home-style meals without cooking.
            </p>
            <div style="display: flex; gap: 12px; flex-wrap: wrap;">
              <button id="heroBrowseBtn" class="btn-primary-action" style="padding: 12px 24px; font-size: 15px; border-radius: 12px;">
                Find a Mess Near You <i class="fa-solid fa-arrow-right"></i>
              </button>
              <button id="heroSignUpBtn" class="btn-outline-action" style="padding: 12px 24px; font-size: 15px; border-radius: 12px;">
                <i class="fa-solid fa-qrcode"></i> Sign Up Free
              </button>
            </div>
            <div style="display: flex; gap: 16px 24px; margin-top: 32px; border-top: 1px solid var(--color-neutral-200); padding-top: 20px; flex-wrap: wrap;">
              <div>
                <p id="statsProvidersCount" class="font-display" style="font-size: 22px; font-weight: 700; color: var(--color-neutral-900);">--</p>
                <p style="font-size: 12px; color: var(--color-neutral-500);">Verified Mess Providers</p>
              </div>
              <div style="border-left: 1px solid var(--color-neutral-200); padding-left: 16px;">
                <p id="statsStudentsCount" class="font-display" style="font-size: 22px; font-weight: 700; color: var(--color-neutral-900);">--</p>
                <p style="font-size: 12px; color: var(--color-neutral-500);">Registered Users</p>
              </div>
              <div style="border-left: 1px solid var(--color-neutral-200); padding-left: 16px;">
                <p class="font-display" style="font-size: 22px; font-weight: 700; color: var(--color-primary-600);">100%</p>
                <p style="font-size: 12px; color: var(--color-neutral-500);">Verified Approval</p>
              </div>
            </div>
          </div>

          <div style="position: relative; width: 100%;">
            <div style="border-radius: 24px; overflow: hidden; box-shadow: 0 20px 40px rgba(0,0,0,0.12);">
              <img src="https://images.pexels.com/photos/5775684/pexels-photo-5775684.jpeg?auto=compress&cs=tinysrgb&h=650&w=940" alt="Delicious Thali" style="width: 100%; height: auto; max-height: 380px; object-fit: cover;" />
            </div>
            
            <div style="position: relative; margin-top: -30px; margin-left: 12px; background: #fff; border-radius: 16px; padding: 14px; box-shadow: 0 12px 30px rgba(0,0,0,0.12); display: inline-flex; align-items: center; gap: 12px; max-width: 100%;">
              <div style="width: 40px; height: 40px; border-radius: 12px; background: var(--color-success-50); color: var(--color-success-600); display: flex; align-items: center; justify-content: center; font-size: 18px; flex-shrink: 0;">
                <i class="fa-solid fa-circle-check"></i>
              </div>
              <div>
                <p style="font-weight: 700; font-size: 13px; color: var(--color-neutral-900);">Digital Mess Card Pass</p>
                <p style="font-size: 11px; color: var(--color-neutral-500);">Instant QR Pass & Daily Meal Access</p>
              </div>
            </div>
          </div>
        </div>
      </section>

      <!-- How It Works Section -->
      <section style="padding: 60px 16px; background: #fff;">
        <div style="max-width: 1280px; margin: 0 auto; text-align: center;">
          <h2 class="font-display" style="font-size: clamp(1.5rem, 4vw, 2.25rem); font-weight: 700; color: var(--color-neutral-900); margin-bottom: 12px;">How It Works</h2>
          <p style="color: var(--color-neutral-600); font-size: clamp(0.9rem, 2vw, 1rem); margin-bottom: 36px;">Four simple steps from hungry to happy. No cooking, no cleaning, no hassle.</p>

          <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(240px, 1fr)); gap: 20px;">
            <div style="background: var(--color-neutral-50); border: 1px solid var(--color-neutral-200); border-radius: 20px; padding: 24px; text-align: left;">
              <div style="width: 48px; height: 48px; border-radius: 14px; background: #0ea5e9; color: #fff; display: flex; align-items: center; justify-content: center; font-size: 20px; margin-bottom: 16px;">
                <i class="fa-solid fa-magnifying-glass"></i>
              </div>
              <p style="color: var(--color-primary-600); font-weight: 700; font-size: 13px; margin-bottom: 6px;">Step 1</p>
              <h3 class="font-display" style="font-size: 17px; font-weight: 700; margin-bottom: 8px;">Browse & Discover</h3>
              <p style="font-size: 13px; color: var(--color-neutral-600); line-height: 1.5;">Find hostels and PGs near you that serve fresh daily meals. Compare menus, prices, and ratings.</p>
            </div>

            <div style="background: var(--color-neutral-50); border: 1px solid var(--color-neutral-200); border-radius: 20px; padding: 24px; text-align: left;">
              <div style="width: 48px; height: 48px; border-radius: 14px; background: var(--color-primary-500); color: #fff; display: flex; align-items: center; justify-content: center; font-size: 20px; margin-bottom: 16px;">
                <i class="fa-solid fa-calendar-days"></i>
              </div>
              <p style="color: var(--color-primary-600); font-weight: 700; font-size: 13px; margin-bottom: 6px;">Step 2</p>
              <h3 class="font-display" style="font-size: 17px; font-weight: 700; margin-bottom: 8px;">Subscribe Monthly</h3>
              <p style="font-size: 13px; color: var(--color-neutral-600); line-height: 1.5;">Pick a plan that fits your schedule — full meals, lunch & dinner, or single meals.</p>
            </div>

            <div style="background: var(--color-neutral-50); border: 1px solid var(--color-neutral-200); border-radius: 20px; padding: 24px; text-align: left;">
              <div style="width: 48px; height: 48px; border-radius: 14px; background: #22c55e; color: #fff; display: flex; align-items: center; justify-content: center; font-size: 20px; margin-bottom: 16px;">
                <i class="fa-solid fa-qrcode"></i>
              </div>
              <p style="color: var(--color-primary-600); font-weight: 700; font-size: 13px; margin-bottom: 6px;">Step 3</p>
              <h3 class="font-display" style="font-size: 17px; font-weight: 700; margin-bottom: 8px;">Digital Mess Card</h3>
              <p style="font-size: 13px; color: var(--color-neutral-600); line-height: 1.5;">Receive a digital mess card instantly. Show it at the mess counter and enjoy daily meals.</p>
            </div>

            <div style="background: var(--color-neutral-50); border: 1px solid var(--color-neutral-200); border-radius: 20px; padding: 24px; text-align: left;">
              <div style="width: 48px; height: 48px; border-radius: 14px; background: #eab308; color: #fff; display: flex; align-items: center; justify-content: center; font-size: 20px; margin-bottom: 16px;">
                <i class="fa-solid fa-bowl-food"></i>
              </div>
              <p style="color: var(--color-primary-600); font-weight: 700; font-size: 13px; margin-bottom: 6px;">Step 4</p>
              <h3 class="font-display" style="font-size: 17px; font-weight: 700; margin-bottom: 8px;">Eat Daily, Hassle-Free</h3>
              <p style="font-size: 13px; color: var(--color-neutral-600); line-height: 1.5;">Walk in for breakfast, lunch, or dinner. No cooking, no cleaning, no worries.</p>
            </div>
          </div>
        </div>
      </section>

      <!-- Top Rated Mess Grid -->
      <section style="padding: 60px 16px; background: #fff;">
        <div style="max-width: 1280px; margin: 0 auto;">
          <div style="display: flex; justify-content: space-between; align-items: flex-end; margin-bottom: 32px; flex-wrap: wrap; gap: 16px;">
            <div>
              <h2 class="font-display" style="font-size: clamp(1.5rem, 3.5vw, 2rem); font-weight: 700; color: var(--color-neutral-900); margin-bottom: 8px;">Approved Mess Providers Near You</h2>
              <p style="color: var(--color-neutral-600); font-size: 14px;">Discover verified hostels and PGs serving fresh daily meals.</p>
            </div>
            <button id="viewAllBtn" class="btn-outline-action">
              <span>View All Hostels & Messes</span> <i class="fa-solid fa-arrow-right"></i>
            </button>
          </div>

          <div id="homeHostelsGrid" style="display: grid; grid-template-columns: repeat(auto-fill, minmax(280px, 1fr)); gap: 20px;">
            <div style="grid-column: 1 / -1; text-align: center; padding: 48px; color: var(--color-neutral-500);">
              <i class="fa-solid fa-spinner fa-spin" style="font-size: 24px;"></i> Loading approved mess providers...
            </div>
          </div>
        </div>
      </section>

      <!-- Ready CTA Banner -->
      <section style="padding: 60px 16px; background: linear-gradient(135deg, var(--color-primary-600), var(--color-primary-700)); color: #fff; text-align: center;">
        <div style="max-width: 800px; margin: 0 auto;">
          <h2 class="font-display" style="font-size: clamp(1.5rem, 4vw, 2.25rem); font-weight: 800; margin-bottom: 16px;">Ready to stop cooking and start eating?</h2>
          <p style="font-size: clamp(0.95rem, 2.5vw, 1.125rem); opacity: 0.9; margin-bottom: 28px; line-height: 1.6;">
            Join PrimePlate today and get access to fresh, home-style meals from hostels and PGs near you. Your digital mess card is just a subscription away.
          </p>
          <button id="ctaFindMessBtn" class="btn-primary-action" style="background: #fff; color: var(--color-primary-700); padding: 14px 28px; font-size: 15px; border-radius: 14px; font-weight: 700;">
            Find Your Mess Now <i class="fa-solid fa-arrow-right"></i>
          </button>
        </div>
      </section>
    </main>

    <footer class="footer">
      <div style="max-width: 1280px; margin: 0 auto; display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: 16px;">
        <div style="display: flex; align-items: center; gap: 10px;">
          <div class="nav-brand-logo" style="width: 30px; height: 30px; font-size: 14px;">
            <i class="fa-solid fa-utensils"></i>
          </div>
          <span class="nav-brand-text" style="font-size: 16px;">PrimePlate</span>
        </div>
        <p>© ${new Date().getFullYear()} PrimePlate. Premium Meal Subscription Platform.</p>
      </div>
    </footer>
  `;

  attachNavbarEvents();

  // Asynchronously fetch stats
  api.get('/analytics/public-summary').then((summary: any) => {
    if (summary) {
      const pCount = document.getElementById('statsProvidersCount');
      const sCount = document.getElementById('statsStudentsCount');
      if (pCount && summary.approvedProviders) pCount.textContent = String(summary.approvedProviders);
      if (sCount && summary.happyStudents) sCount.textContent = String(summary.happyStudents);
    }
  }).catch(() => {});

  const grid = document.getElementById('homeHostelsGrid')!;

  const loadProviders = async () => {
    try {
      const data: any = await api.get('/providers');
      const items = Array.isArray(data) ? data : [];
      if (items.length === 0) {
        grid.innerHTML = `
          <div style="grid-column: 1 / -1; background: #fff; border: 1px solid var(--color-neutral-200); border-radius: 20px; padding: 48px; text-align: center;">
            <i class="fa-solid fa-building-circle-exclamation" style="font-size: 40px; color: var(--color-neutral-400); margin-bottom: 16px;"></i>
            <h3 class="font-display" style="font-size: 18px; font-weight: 700; color: var(--color-neutral-900); margin-bottom: 8px;">No Approved Mess Providers Yet</h3>
            <p style="color: var(--color-neutral-500); font-size: 14px; margin-bottom: 20px;">Check back soon as new verified kitchens are onboarded.</p>
          </div>
        `;
        return;
      }

      grid.innerHTML = items
        .slice(0, 6)
        .map(
          (h) => `
          <div class="hostel-card" data-id="${h.id}">
            <div class="hostel-card-image">
              <img src="${getSafeImageUrl(h.imageUrl)}" alt="${escapeHtml(h.name)}" />
              <div class="hostel-badge-rating">
                <i class="fa-solid fa-star" style="color: var(--color-accent-500);"></i>
                <span>${(h.rating ?? 0) > 0 ? Number(h.rating).toFixed(1) : 'New'}</span>
              </div>
              <div class="hostel-badge-tag">${escapeHtml(h.category || h.mealType || 'Veg / Non-Veg')}</div>
              <div class="hostel-card-overlay">
                <h3 class="font-display" style="font-size: 18px; font-weight: 700; color: #fff;">${escapeHtml(h.name)}</h3>
                <p style="font-size: 13px; color: rgba(255,255,255,0.85);"><i class="fa-solid fa-location-dot"></i> ${escapeHtml(h.area || h.address || '')}${h.city ? ', ' + escapeHtml(h.city) : ''}</p>
              </div>
            </div>
            <div class="hostel-card-body">
              <p style="font-size: 14px; color: var(--color-neutral-600); margin-bottom: 16px; line-height: 1.5;">${escapeHtml(h.description || 'No description available.')}</p>
              <div style="display: flex; justify-content: space-between; align-items: flex-end; border-top: 1px solid var(--color-neutral-100); padding-top: 16px;">
                <div>
                  <span class="price-text">${h.monthlyPrice ? '₹' + Number(h.monthlyPrice).toLocaleString('en-IN') : 'Price Unavailable'}</span>
                  ${h.monthlyPrice ? '<span style="font-size: 13px; color: var(--color-neutral-500);">/month</span>' : ''}
                </div>
                <button class="btn-primary-action" style="padding: 8px 16px; font-size: 13px;">
                  View Plan <i class="fa-solid fa-arrow-right"></i>
                </button>
              </div>
            </div>
          </div>
        `,
        )
        .join('');

      grid.querySelectorAll('.hostel-card').forEach((card) => {
        card.addEventListener('click', (e) => {
          const id = (e.currentTarget as HTMLElement).getAttribute('data-id');
          if (id) navigate(`#/providers/${id}`);
        });
      });
    } catch (err: any) {
      grid.innerHTML = `
        <div style="grid-column: 1 / -1; background: #fff; border: 1px solid #fee2e2; border-radius: 20px; padding: 48px; text-align: center;">
          <i class="fa-solid fa-triangle-exclamation" style="font-size: 40px; color: #dc2626; margin-bottom: 16px;"></i>
          <h3 class="font-display" style="font-size: 18px; font-weight: 700; color: var(--color-neutral-900); margin-bottom: 8px;">Unable to Load Approved Providers</h3>
          <p style="color: var(--color-neutral-600); font-size: 14px; margin-bottom: 20px;">${escapeHtml(err.message || 'Server connection error.')}</p>
          <button id="retryHomeBtn" class="btn-primary-action" style="padding: 10px 20px;">
            <i class="fa-solid fa-rotate-right"></i> Retry Loading
          </button>
        </div>
      `;
      document.getElementById('retryHomeBtn')?.addEventListener('click', () => loadProviders());
    }
  };

  await loadProviders();

  document.getElementById('heroBrowseBtn')?.addEventListener('click', () => navigate('#/providers'));
  document.getElementById('heroSignUpBtn')?.addEventListener('click', () => navigate('#/login'));
  document.getElementById('viewAllBtn')?.addEventListener('click', () => navigate('#/providers'));
  document.getElementById('ctaFindMessBtn')?.addEventListener('click', () => navigate('#/providers'));
}
