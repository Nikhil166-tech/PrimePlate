import { navigate } from '../router';
import { renderNavbar, attachNavbarEvents } from '../components/navbar';
import { renderFooter, attachFooterEvents } from '../components/footer';
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
              Your Food.<br />
              Your Time.<br />
              <span style="color: var(--color-primary-600);">Your PrimePlate.</span>
            </h1>
            <p style="font-size: clamp(0.95rem, 2.5vw, 1.125rem); color: var(--color-neutral-600); line-height: 1.6; margin-bottom: 28px; max-width: 540px;">
              Find nearby messes, compare meal plans, view menus, and manage your subscription — all in one place.
            </p>
            <div class="hero-btn-group" style="display: flex; gap: 12px; flex-wrap: wrap;">
              <button id="heroBrowseBtn" class="btn-primary-action" style="padding: 12px 24px; font-size: 15px; border-radius: 12px; background: var(--color-primary-600);">
                Browse All Messes <i class="fa-solid fa-arrow-right"></i>
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

      <!-- Why Choose Us? / Why PrimePlate Section -->
      <section id="why-primeplate" class="why-primeplate-wrapper" style="padding: 64px 16px;">
        <div style="max-width: 1280px; margin: 0 auto;">
          
          <!-- Hero Header -->
          <div style="max-width: 800px; margin: 0 auto 48px; text-align: center;">
            <div class="why-badge">
              <i class="fa-solid fa-circle-check"></i> The Student Food Revolution
            </div>
            <h2 class="why-hero-title">
              YOUR TIME IS WORTH MORE<br class="hidden-xs" /> THAN YOUR KITCHEN.
            </h2>
            <p class="why-hero-sub" style="font-size: clamp(1rem, 2.5vw, 1.25rem); color: var(--color-neutral-600); line-height: 1.6; font-weight: 500; max-width: 720px; margin: 12px auto 0;">
              PrimePlate helps you save more than just money — <span style="font-weight: 700; color: var(--color-primary-600);">it helps you save time.</span>
            </p>
            <p style="font-size: clamp(0.9rem, 2vw, 1rem); color: var(--color-neutral-500); margin-top: 10px; line-height: 1.5;">
              Spend less time grocery shopping, cooking, cleaning, and planning meals, and more time on your studies, work, fitness, and life.
            </p>
          </div>

          <!-- Comparison Section Wrapper -->
          <div id="comparison" class="comp-wrapper" style="max-width: 1040px; margin: 0 auto;">
            <div class="comp-container">
              
              <!-- LEFT CARD: Students & IT Professionals -->
              <div class="comp-card comp-card-left">
                <div class="comp-card-header comp-header-left">
                  <div class="comp-header-title-row">
                    <div class="comp-header-icon comp-icon-red">
                      <i class="fa-solid fa-xmark"></i>
                    </div>
                    <div>
                      <h3 class="comp-card-title font-display">Students & IT Professionals</h3>
                      <p class="comp-card-subtitle">Cooking on their own every day</p>
                    </div>
                  </div>
                </div>

                <div class="comp-card-body">
                  <div class="comp-row">
                    <div class="comp-row-left">
                      <div class="comp-row-icon comp-icon-gray">₹</div>
                      <div>
                        <span class="comp-row-title">Monthly Cooking Cost</span>
                        <span class="comp-row-sub">groceries + takeout</span>
                      </div>
                    </div>
                    <span class="comp-val comp-val-red font-display">₹6,000</span>
                  </div>

                  <div class="comp-row">
                    <div class="comp-row-left">
                      <div class="comp-row-icon comp-icon-gray"><i class="fa-regular fa-clock"></i></div>
                      <div>
                        <span class="comp-row-title">Time Spent Cooking</span>
                        <span class="comp-row-sub">per week</span>
                      </div>
                    </div>
                    <span class="comp-val comp-val-red font-display">10 hrs</span>
                  </div>

                  <div class="comp-row">
                    <div class="comp-row-left">
                      <div class="comp-row-icon comp-icon-gray"><i class="fa-solid fa-brain"></i></div>
                      <div>
                        <span class="comp-row-title">Stress Level</span>
                        <span class="comp-row-sub">daily meal decisions</span>
                      </div>
                    </div>
                    <span class="comp-val comp-val-red font-display">High</span>
                  </div>

                  <div class="comp-row">
                    <div class="comp-row-left">
                      <div class="comp-row-icon comp-icon-gray"><i class="fa-solid fa-cart-shopping"></i></div>
                      <div>
                        <span class="comp-row-title">Grocery Trips</span>
                        <span class="comp-row-sub">every week</span>
                      </div>
                    </div>
                    <span class="comp-val comp-val-red font-display">3–4x</span>
                  </div>
                </div>
              </div>

              <!-- VS Badge -->
              <div class="comp-vs-badge font-display">VS</div>

              <!-- RIGHT CARD: PrimePlate -->
              <div class="comp-card comp-card-right">
                <div class="comp-card-header comp-header-right">
                  <div class="comp-header-title-row">
                    <div class="comp-header-icon comp-icon-green">
                      <i class="fa-solid fa-check"></i>
                    </div>
                    <div>
                      <h3 class="comp-card-title font-display">PrimePlate</h3>
                      <p class="comp-card-subtitle">Our website — subscribe and relax</p>
                    </div>
                  </div>
                  <span class="comp-recommended-pill font-display">Recommended</span>
                </div>

                <div class="comp-card-body">
                  <div class="comp-row">
                    <div class="comp-row-left">
                      <div class="comp-row-icon comp-icon-softgreen">₹</div>
                      <div>
                        <span class="comp-row-title">Monthly Cost</span>
                        <span class="comp-row-sub">all meals included</span>
                      </div>
                    </div>
                    <span class="comp-val comp-val-green font-display">₹3,200</span>
                  </div>

                  <div class="comp-row">
                    <div class="comp-row-left">
                      <div class="comp-row-icon comp-icon-softgreen"><i class="fa-regular fa-clock"></i></div>
                      <div>
                        <span class="comp-row-title">Time Spent Cooking</span>
                        <span class="comp-row-sub">we handle everything</span>
                      </div>
                    </div>
                    <span class="comp-val comp-val-green font-display">0 hrs</span>
                  </div>

                  <div class="comp-row">
                    <div class="comp-row-left">
                      <div class="comp-row-icon comp-icon-softgreen"><i class="fa-solid fa-brain"></i></div>
                      <div>
                        <span class="comp-row-title">Stress Level</span>
                        <span class="comp-row-sub">fully handled</span>
                      </div>
                    </div>
                    <span class="comp-val comp-val-green font-display">Minimal</span>
                  </div>

                  <div class="comp-row">
                    <div class="comp-row-left">
                      <div class="comp-row-icon comp-icon-softgreen"><i class="fa-regular fa-calendar-check"></i></div>
                      <div>
                        <span class="comp-row-title">Meals Planned</span>
                        <span class="comp-row-sub">never think about it</span>
                      </div>
                    </div>
                    <span class="comp-val comp-val-green font-display">Fully</span>
                  </div>
                </div>
              </div>

            </div>

            <!-- Bottom Metric Banner -->
            <div class="comp-banner">
              <div class="comp-banner-item">
                <div class="comp-banner-icon-pill">₹</div>
                <div class="comp-banner-text-box">
                  <span class="comp-banner-main font-display">Save ₹2,800</span>
                  <span class="comp-banner-sub">every month</span>
                </div>
              </div>

              <div class="comp-banner-divider"></div>

              <div class="comp-banner-item">
                <div class="comp-banner-icon-pill"><i class="fa-regular fa-clock"></i></div>
                <div class="comp-banner-text-box">
                  <span class="comp-banner-main font-display">Save 10 Hours</span>
                  <span class="comp-banner-sub">every week</span>
                </div>
              </div>

              <button id="whyViewPlansBtn" class="btn-primary-action comp-banner-btn">
                Browse Plans <i class="fa-solid fa-arrow-right"></i>
              </button>
            </div>
          </div>

          <!-- Equation Box -->
          <div style="max-width: 768px; margin: 32px auto 0; text-align: center;">
            <div style="background: #ffffff; border: 1px solid var(--color-neutral-200); border-radius: 20px; padding: 20px;" class="why-card-shadow">
              <div style="display: flex; flex-wrap: wrap; justify-content: center; align-items: center; gap: 8px; font-size: 13px; font-weight: 600; color: var(--color-neutral-600); margin-bottom: 12px;">
                <span style="background: var(--color-neutral-100); padding: 6px 12px; border-radius: 8px; color: var(--color-neutral-800);">₹₹₹ Money</span>
                <span style="color: var(--color-neutral-400);">+</span>
                <span style="background: var(--color-neutral-100); padding: 6px 12px; border-radius: 8px; color: var(--color-neutral-800);">⏱ Time</span>
                <span style="color: var(--color-neutral-400);">+</span>
                <span style="background: var(--color-neutral-100); padding: 6px 12px; border-radius: 8px; color: var(--color-neutral-800);">🛒 Groceries</span>
                <span style="color: var(--color-neutral-400);">+</span>
                <span style="background: var(--color-neutral-100); padding: 6px 12px; border-radius: 8px; color: var(--color-neutral-800);">🍳 Cooking</span>
                <span style="color: var(--color-neutral-400);">+</span>
                <span style="background: var(--color-neutral-100); padding: 6px 12px; border-radius: 8px; color: var(--color-neutral-800);">🍽 Cleaning</span>
              </div>
              
              <div style="color: var(--color-primary-600); font-weight: 900; font-size: 22px; margin: 6px 0;">↓</div>

              <div style="display: inline-block; background: var(--color-primary-50); color: var(--color-primary-800); font-weight: 800; font-size: 13px; padding: 8px 20px; border-radius: 12px; border: 1px solid var(--color-primary-200);">
                PRIMEPLATE — One Simple Meal Subscription
              </div>
            </div>
          </div>

          <!-- Value Stack Section -->
          <div id="value-stack" style="max-width: 1150px; margin: 56px auto 0;">
            <div style="text-align: center; max-width: 640px; margin: 0 auto 36px;">
              <span style="color: var(--color-primary-600); font-weight: 700; font-size: 11px; text-transform: uppercase; letter-spacing: 0.5px; display: block; margin-bottom: 4px;">Complete Control</span>
              <h2 class="font-display" style="font-size: clamp(1.5rem, 3.5vw, 2.125rem); font-weight: 800; color: var(--color-neutral-900);">
                With PrimePlate You Get
              </h2>
              <p style="color: var(--color-neutral-600); font-size: 14px; margin-top: 6px;">Everything you need to manage your mess subscription seamlessly in one place.</p>
            </div>

            <div class="why-value-grid">
              
              <div class="why-value-card">
                <div class="why-value-icon">🍱</div>
                <h3 class="why-value-title">Meal Subscription</h3>
                <p class="why-value-desc">Know exactly what you're subscribed to, plan duration, and active status.</p>
              </div>

              <div class="why-value-card">
                <div class="why-value-icon">📋</div>
                <h3 class="why-value-title">Menu Visibility</h3>
                <p class="why-value-desc">Know what's being served today and tomorrow before you step out.</p>
              </div>

              <div class="why-value-card">
                <div class="why-value-icon">💳</div>
                <h3 class="why-value-title">Payment History</h3>
                <p class="why-value-desc">Know exactly what you paid, download receipts, and track renewals securely.</p>
              </div>

              <div class="why-value-card">
                <div class="why-value-icon">🎫</div>
                <h3 class="why-value-title">Digital Meal Pass</h3>
                <p class="why-value-desc">Keep your subscription verification details instantly accessible on your phone.</p>
              </div>

              <div class="why-value-card">
                <div class="why-value-icon">🔎</div>
                <h3 class="why-value-title">Discover Other Messes</h3>
                <p class="why-value-desc">Easily compare and switch options when you move locations or change providers.</p>
              </div>

              <div class="why-value-card">
                <div class="why-value-icon">🔄</div>
                <h3 class="why-value-title">Meal Credits <span style="font-size: 10px; font-weight: 500; color: var(--color-neutral-400); font-style: italic; display: block; sm:inline;">(Provider specific)</span></h3>
                <p class="why-value-desc">If supported by your provider, eligible skipped days can become meal credits per their rules.</p>
              </div>

            </div>

            <div style="margin-top: 24px; background: var(--color-neutral-100); border-radius: 16px; padding: 16px; text-align: center; border: 1px solid var(--color-neutral-200); max-width: 600px; margin: 24px auto 0;">
              <p style="font-size: 12px; color: var(--color-neutral-600); font-weight: 500;">
                No complicated setup. No daily cooking. Just choose a plan and manage your meals in one place.
              </p>
            </div>
          </div>

          <!-- Section CTA -->
          <div id="cta" style="max-width: 900px; margin: 60px auto 0;" class="why-cta-banner">
            <h2 class="font-display" style="font-size: clamp(1.5rem, 3.5vw, 2.125rem); font-weight: 800; margin-bottom: 12px; color: #ffffff;">
              Ready to reclaim your time and meals?
            </h2>
            <p style="color: var(--color-primary-100); font-size: 14px; max-width: 560px; margin: 0 auto 24px; line-height: 1.5;">
              Find a plan that fits your budget, location, and food needs without the daily hassle of cooking.
            </p>

            <div style="display: flex; flex-wrap: wrap; items-center: center; justify-content: center; gap: 12px; margin-bottom: 24px;">
              <button id="whyCtaFindPlanBtn" class="btn-primary-action" style="background: #ffffff; color: var(--color-primary-700); font-weight: 700; padding: 12px 24px; font-size: 14px; border-radius: 12px;">
                Find Your Meal Plan <i class="fa-solid fa-arrow-right"></i>
              </button>
              <button id="whyCtaExploreOptionsBtn" class="btn-outline-action" style="background: rgba(255,255,255,0.1); color: #ffffff; border: 1px solid rgba(255,255,255,0.3); font-weight: 700; padding: 12px 24px; font-size: 14px; border-radius: 12px;">
                Explore Mess Options
              </button>
            </div>

            <p style="font-size: 11px; color: rgba(255,255,255,0.65); max-width: 540px; margin: 0 auto; line-height: 1.5;">
              *Illustrative comparison. Actual costs vary by location, food habits, provider, and plan. Meal-credit and pricing details depend on participating local providers.
            </p>
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

      <!-- FAQ Section -->
      <section id="faq" style="padding: 64px 16px; background: #f8fafc; border-top: 1px solid var(--color-neutral-200);">
        <div style="max-width: 840px; margin: 0 auto;">
          
          <div style="text-align: center; margin-bottom: 40px;">
            <span style="color: var(--color-primary-600); font-weight: 700; font-size: 11px; text-transform: uppercase; letter-spacing: 0.5px; display: block; margin-bottom: 6px;">Got Questions?</span>
            <h2 class="font-display" style="font-size: clamp(1.75rem, 4vw, 2.25rem); font-weight: 800; color: var(--color-neutral-900); margin-bottom: 8px;">Frequently Asked Questions</h2>
            <p style="color: var(--color-neutral-600); font-size: 15px;">Everything you need to know before choosing your meal plan.</p>
          </div>

          <div class="faq-container">
            
            <!-- FAQ Item 1 -->
            <div class="faq-item">
              <button class="faq-trigger font-display" aria-expanded="false" aria-controls="faq-ans-1" id="faq-q-1">
                <span>What is PrimePlate?</span>
                <i class="fa-solid fa-chevron-down faq-chevron"></i>
              </button>
              <div id="faq-ans-1" class="faq-answer" role="region" aria-labelledby="faq-q-1">
                <p>PrimePlate is a meal-subscription platform that helps college students, working professionals, and people living away from home find nearby PG and hostel messes, compare meal plans, view menus, and subscribe online. It helps PrimeMates spend less time on grocery shopping, cooking, cleaning, and meal planning while managing their food subscription, payments, and meal plans in one place. Depending on your location, eating habits, and cooking costs, a meal subscription may also be a practical and cost-effective alternative to preparing every meal yourself.</p>
              </div>
            </div>

            <!-- FAQ Item 2 -->
            <div class="faq-item">
              <button class="faq-trigger font-display" aria-expanded="false" aria-controls="faq-ans-2" id="faq-q-2">
                <span>Who can use PrimePlate?</span>
                <i class="fa-solid fa-chevron-down faq-chevron"></i>
              </button>
              <div id="faq-ans-2" class="faq-answer" role="region" aria-labelledby="faq-q-2">
                <p>PrimePlate is designed for college students, working professionals, and people living in PGs or hostels.</p>
              </div>
            </div>

            <!-- FAQ Item 3 -->
            <div class="faq-item">
              <button class="faq-trigger font-display" aria-expanded="false" aria-controls="faq-ans-3" id="faq-q-3">
                <span>How do I find a mess near me?</span>
                <i class="fa-solid fa-chevron-down faq-chevron"></i>
              </button>
              <div id="faq-ans-3" class="faq-answer" role="region" aria-labelledby="faq-q-3">
                <p>Use location search or browse by city and area. PrimePlate can show approved meal providers near your current location or in your target area.</p>
              </div>
            </div>

            <!-- FAQ Item 4 -->
            <div class="faq-item">
              <button class="faq-trigger font-display" aria-expanded="false" aria-controls="faq-ans-4" id="faq-q-4">
                <span>Can I see the menu before subscribing?</span>
                <i class="fa-solid fa-chevron-down faq-chevron"></i>
              </button>
              <div id="faq-ans-4" class="faq-answer" role="region" aria-labelledby="faq-q-4">
                <p>You can view the menu when the provider has added menu information to their PrimePlate listing.</p>
              </div>
            </div>

            <!-- FAQ Item 5 -->
            <div class="faq-item">
              <button class="faq-trigger font-display" aria-expanded="false" aria-controls="faq-ans-5" id="faq-q-5">
                <span>What subscription plans are available?</span>
                <i class="fa-solid fa-chevron-down faq-chevron"></i>
              </button>
              <div id="faq-ans-5" class="faq-answer" role="region" aria-labelledby="faq-q-5">
                <p>PrimePlate supports 1 Day, 1 Week, 15 Days, and 1 Month plans where offered by the provider.</p>
              </div>
            </div>

            <!-- FAQ Item 6 -->
            <div class="faq-item">
              <button class="faq-trigger font-display" aria-expanded="false" aria-controls="faq-ans-6" id="faq-q-6">
                <span>Who decides the subscription price?</span>
                <i class="fa-solid fa-chevron-down faq-chevron"></i>
              </button>
              <div id="faq-ans-6" class="faq-answer" role="region" aria-labelledby="faq-q-6">
                <p>The PG or mess provider sets the monthly subscription price. PrimePlate displays the plan and pricing provided by the provider.</p>
              </div>
            </div>

            <!-- FAQ Item 7 -->
            <div class="faq-item">
              <button class="faq-trigger font-display" aria-expanded="false" aria-controls="faq-ans-7" id="faq-q-7">
                <span>Can I get a refund if I don't eat a meal?</span>
                <i class="fa-solid fa-chevron-down faq-chevron"></i>
              </button>
              <div id="faq-ans-7" class="faq-answer" role="region" aria-labelledby="faq-q-7">
                <p>Refunds are not automatically guaranteed. Any meal-skip or meal-credit benefit depends on the participating provider's policy.</p>
              </div>
            </div>

            <!-- FAQ Item 8 -->
            <div class="faq-item">
              <button class="faq-trigger font-display" aria-expanded="false" aria-controls="faq-ans-8" id="faq-q-8">
                <span>Can I see my previous payments and subscriptions?</span>
                <i class="fa-solid fa-chevron-down faq-chevron"></i>
              </button>
              <div id="faq-ans-8" class="faq-answer" role="region" aria-labelledby="faq-q-8">
                <p>Yes. PrimeMates can view their subscription and payment history from the PrimeMate Dashboard.</p>
              </div>
            </div>

            <!-- FAQ Item 9 -->
            <div class="faq-item">
              <button class="faq-trigger font-display" aria-expanded="false" aria-controls="faq-ans-9" id="faq-q-9">
                <span>Can I change my PG or meal provider later?</span>
                <i class="fa-solid fa-chevron-down faq-chevron"></i>
              </button>
              <div id="faq-ans-9" class="faq-answer" role="region" aria-labelledby="faq-q-9">
                <p>You can explore other available providers on PrimePlate when you're ready to change your meal service. Existing subscriptions continue according to their applicable terms.</p>
              </div>
            </div>

            <!-- FAQ Item 10 -->
            <div class="faq-item">
              <button class="faq-trigger font-display" aria-expanded="false" aria-controls="faq-ans-10" id="faq-q-10">
                <span>How can I contact PrimePlate support?</span>
                <i class="fa-solid fa-chevron-down faq-chevron"></i>
              </button>
              <div id="faq-ans-10" class="faq-answer" role="region" aria-labelledby="faq-q-10">
                <p>You can contact PrimePlate through WhatsApp at +91 8639296593 or email support.primeplate@gmail.com.</p>
              </div>
            </div>

          </div>

          </div>

        </div>
      </section>
    </main>

    ${renderFooter()}
  `;

  attachNavbarEvents();
  attachFooterEvents();

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
                <p style="font-size: 13px; color: rgba(255,255,255,0.85);">
                  <i class="fa-solid fa-location-dot"></i> ${escapeHtml(h.area || h.address || '')}${h.city ? ', ' + escapeHtml(h.city) : ''}
                  ${h.distanceKm !== undefined && h.distanceKm !== null ? `<span style="background: rgba(255,255,255,0.25); color: #fff; padding: 2px 8px; border-radius: 999px; font-size: 11px; font-weight: 700; margin-left: 6px;"><i class="fa-solid fa-location-arrow"></i> 📍 ${Number(h.distanceKm).toFixed(1)} km away</span>` : ''}
                </p>
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
  document.getElementById('whyViewPlansBtn')?.addEventListener('click', () => navigate('#/providers'));
  document.getElementById('whyCtaFindPlanBtn')?.addEventListener('click', () => navigate('#/providers'));
  document.getElementById('whyCtaExploreOptionsBtn')?.addEventListener('click', () => navigate('#/providers'));

  // FAQ Accordion Handlers
  document.querySelectorAll('.faq-trigger').forEach((trigger) => {
    trigger.addEventListener('click', (e) => {
      const btn = e.currentTarget as HTMLButtonElement;
      const item = btn.closest('.faq-item') as HTMLElement;
      const isExpanded = btn.getAttribute('aria-expanded') === 'true';

      document.querySelectorAll('.faq-item').forEach((other) => {
        if (other !== item) {
          other.classList.remove('active');
          other.querySelector('.faq-trigger')?.setAttribute('aria-expanded', 'false');
        }
      });

      if (isExpanded) {
        item.classList.remove('active');
        btn.setAttribute('aria-expanded', 'false');
      } else {
        item.classList.add('active');
        btn.setAttribute('aria-expanded', 'true');
      }
    });
  });

  if (window.location.hash.includes('why-primeplate')) {
    setTimeout(() => {
      document.getElementById('why-primeplate')?.scrollIntoView({ behavior: 'smooth' });
    }, 100);
  } else if (window.location.hash.includes('faq')) {
    setTimeout(() => {
      document.getElementById('faq')?.scrollIntoView({ behavior: 'smooth' });
    }, 100);
  }
}
