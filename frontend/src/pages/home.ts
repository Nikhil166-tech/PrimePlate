import { navigate } from '../router';
import { renderNavbar, attachNavbarEvents } from '../components/navbar';
import api from '../api';
import { escapeHtml, getSafeImageUrl } from '../utils/sanitize';
import { showToast } from '../components/toast';

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
            <div class="hero-btn-group" style="display: flex; gap: 12px; flex-wrap: wrap;">
              <button id="heroFindNearMeBtn" class="btn-primary-action" style="padding: 12px 24px; font-size: 15px; border-radius: 12px; background: var(--color-primary-600);">
                <i class="fa-solid fa-crosshairs"></i> 📍 Find Messes Near Me
              </button>
              <button id="heroBrowseBtn" class="btn-outline-action" style="padding: 12px 24px; font-size: 15px; border-radius: 12px;">
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
            <p class="why-hero-sub">
              Cooking every day costs more than groceries. <span style="font-weight: 700; color: var(--color-neutral-900);">It costs your time, energy, and attention.</span>
            </p>
            <p class="why-hero-highlight">
              PrimePlate makes your everyday meals simple.
            </p>
          </div>

          <!-- Comparison Grid -->
          <div id="comparison" style="max-width: 1150px; margin: 0 auto;">
            <div class="why-comparison-grid">
              
              <!-- LEFT CARD: COOK IT YOURSELF -->
              <div class="why-card-cooking why-card-shadow">
                <div class="why-card-tag-light">The Hard Way</div>

                <div>
                  <div style="display: flex; align-items: center; gap: 12px; margin-bottom: 20px;">
                    <div style="width: 44px; height: 44px; border-radius: 14px; background: #fff7ed; color: #d97706; display: flex; align-items: center; justify-content: center; font-size: 20px;">
                      🍳
                    </div>
                    <div>
                      <h3 class="font-display" style="font-size: 18px; font-weight: 700; color: var(--color-neutral-900);">Cook It Yourself</h3>
                      <p style="font-size: 12px; color: var(--color-neutral-500);">In your rented room or PG kitchen</p>
                    </div>
                  </div>

                  <div style="margin-bottom: 20px;">
                    <div style="font-size: 11px; font-weight: 700; color: var(--color-neutral-400); text-transform: uppercase; letter-spacing: 0.5px; margin-bottom: 8px;">Estimated Monthly Breakdown</div>
                    
                    <div style="font-size: 13px;">
                      <div class="why-cost-row-light">
                        <span style="color: var(--color-neutral-600); font-weight: 500;">Groceries</span>
                        <span style="font-weight: 700; color: var(--color-neutral-800);">₹3,500 – ₹4,500</span>
                      </div>
                      <div class="why-cost-row-light">
                        <span style="color: var(--color-neutral-600); font-weight: 500;">Gas / Electricity</span>
                        <span style="font-weight: 700; color: var(--color-neutral-800);">₹300 – ₹600</span>
                      </div>
                      <div class="why-cost-row-light">
                        <span style="color: var(--color-neutral-600); font-weight: 500;">Oil / Spices / Essentials</span>
                        <span style="font-weight: 700; color: var(--color-neutral-800);">₹300 – ₹500</span>
                      </div>
                      <div class="why-cost-row-light">
                        <span style="color: var(--color-neutral-600); font-weight: 500;">Wastage / Miscellaneous</span>
                        <span style="font-weight: 700; color: var(--color-neutral-800);">₹200 – ₹400</span>
                      </div>
                    </div>

                    <div class="why-total-box-light">
                      <div>
                        <span style="font-size: 11px; font-weight: 700; color: var(--color-neutral-500); display: block; text-transform: uppercase;">Estimated Total</span>
                        <span style="font-size: 10px; color: var(--color-neutral-400);">*Illustrative range</span>
                      </div>
                      <div class="font-display" style="font-size: 18px; font-weight: 800; color: var(--color-neutral-900);">
                        ₹4,500 – ₹6,000 <span style="font-size: 12px; font-weight: 400; color: var(--color-neutral-500);">/mo</span>
                      </div>
                    </div>
                  </div>

                  <div style="padding-top: 12px; border-top: 1px solid var(--color-neutral-100);">
                    <div style="font-size: 11px; font-weight: 700; color: var(--color-neutral-400); text-transform: uppercase; letter-spacing: 0.5px; margin-bottom: 8px;">Daily Hidden Effort</div>
                    <div style="display: grid; grid-template-columns: repeat(2, 1fr); gap: 8px;">
                      <div class="why-effort-pill">
                        <span>🛒</span><span>Grocery trips</span>
                      </div>
                      <div class="why-effort-pill">
                        <span>🍳</span><span>Cooking daily</span>
                      </div>
                      <div class="why-effort-pill">
                        <span>🍽</span><span>Cleaning utensils</span>
                      </div>
                      <div class="why-effort-pill">
                        <span>📅</span><span>Daily menu planning</span>
                      </div>
                    </div>
                  </div>
                </div>

                <div style="margin-top: 20px; padding-top: 12px; border-top: 1px solid var(--color-neutral-100); display: flex; align-items: center; font-size: 12px; color: var(--color-neutral-500); font-weight: 500;">
                  <span style="display: inline-block; width: 8px; height: 8px; border-radius: 50%; background: #f59e0b; margin-right: 8px;"></span>
                  Time consumed: ~45–60 minutes every single day.
                </div>
              </div>

              <!-- RIGHT CARD: PRIMEPLATE -->
              <div class="why-card-primeplate why-prime-glow">
                <div class="why-card-tag-brand">The Smart Way</div>

                <div>
                  <div style="display: flex; align-items: center; gap: 12px; margin-bottom: 20px;">
                    <div style="width: 44px; height: 44px; border-radius: 14px; background: rgba(255,255,255,0.12); color: var(--color-primary-200); display: flex; align-items: center; justify-content: center; font-size: 20px; border: 1px solid rgba(255,255,255,0.2);">
                      🍱
                    </div>
                    <div>
                      <h3 class="font-display" style="font-size: 18px; font-weight: 700; color: #ffffff;">PrimePlate</h3>
                      <p style="font-size: 12px; color: var(--color-primary-100);">One simple meal subscription experience</p>
                    </div>
                  </div>

                  <div style="margin-bottom: 20px;">
                    <div style="font-size: 11px; font-weight: 700; color: var(--color-primary-200); text-transform: uppercase; letter-spacing: 0.5px; margin-bottom: 8px;">Estimated Monthly Spending</div>
                    
                    <div style="font-size: 13px;">
                      <div class="why-cost-row-dark">
                        <span style="color: rgba(255,255,255,0.85); font-weight: 500;">Mess Subscription (Local Providers)</span>
                        <span style="font-weight: 700; color: #ffffff;">₹3,000 – ₹4,500</span>
                      </div>
                      <div class="why-cost-row-dark">
                        <span style="color: rgba(255,255,255,0.85); font-weight: 500;">Gas / Electricity / Spices</span>
                        <span style="font-weight: 700; color: var(--color-primary-200);">₹0 (Included)</span>
                      </div>
                      <div class="why-cost-row-dark">
                        <span style="color: rgba(255,255,255,0.85); font-weight: 500;">Wastage / Miscellaneous</span>
                        <span style="font-weight: 700; color: var(--color-primary-200);">₹0 (Zero waste)</span>
                      </div>
                    </div>

                    <div class="why-total-box-dark">
                      <div>
                        <span style="font-size: 11px; font-weight: 700; color: var(--color-primary-200); display: block; text-transform: uppercase;">Estimated Total Spend</span>
                        <span style="font-size: 10px; color: rgba(255,255,255,0.7);">*Varies by local provider plan</span>
                      </div>
                      <div class="font-display" style="font-size: 18px; font-weight: 800; color: #ffffff;">
                        ₹3,000 – ₹4,500 <span style="font-size: 12px; font-weight: 400; color: rgba(255,255,255,0.7);">/mo</span>
                      </div>
                    </div>
                  </div>

                  <div style="padding-top: 12px; border-top: 1px solid rgba(255,255,255,0.15);">
                    <div style="font-size: 11px; font-weight: 700; color: var(--color-primary-200); text-transform: uppercase; letter-spacing: 0.5px; margin-bottom: 8px;">What You Never Do Again</div>
                    <div style="display: grid; grid-template-columns: repeat(2, 1fr); gap: 8px;">
                      <div class="why-effort-pill-dark">
                        <span style="color: var(--color-primary-300); font-weight: 700;">✓</span><span>No grocery shopping</span>
                      </div>
                      <div class="why-effort-pill-dark">
                        <span style="color: var(--color-primary-300); font-weight: 700;">✓</span><span>No daily cooking</span>
                      </div>
                      <div class="why-effort-pill-dark">
                        <span style="color: var(--color-primary-300); font-weight: 700;">✓</span><span>No utensil cleaning</span>
                      </div>
                      <div class="why-effort-pill-dark">
                        <span style="color: var(--color-primary-300); font-weight: 700;">✓</span><span>Digital meal pass</span>
                      </div>
                    </div>
                  </div>
                </div>

                <div style="margin-top: 20px; padding-top: 12px; border-top: 1px solid rgba(255,255,255,0.15); display: flex; items-center: center; justify-content: space-between; flex-wrap: wrap; gap: 8px;">
                  <span style="font-size: 12px; color: var(--color-primary-100); font-weight: 500;">Zero stress, transparent local pricing</span>
                  <button id="whyViewPlansBtn" class="btn-primary-action" style="padding: 8px 16px; font-size: 13px; background: var(--color-primary-500); border-radius: 10px;">
                    View Plans →
                  </button>
                </div>
              </div>

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

  document.getElementById('heroFindNearMeBtn')?.addEventListener('click', () => {
    if (!navigator.geolocation) {
      showToast('Location services are not supported by your browser.', 'error');
      return;
    }

    const btn = document.getElementById('heroFindNearMeBtn') as HTMLButtonElement;
    if (btn) {
      btn.disabled = true;
      btn.innerHTML = `<i class="fa-solid fa-spinner fa-spin"></i> Detecting location...`;
    }

    navigator.geolocation.getCurrentPosition(
      async (pos) => {
        try {
          const lat = pos.coords.latitude;
          const lng = pos.coords.longitude;
          const data: any = await api.get(`/providers/nearby?lat=${lat}&lng=${lng}&radius=5`);
          const items = Array.isArray(data) ? data : [];
          
          if (btn) {
            btn.disabled = false;
            btn.innerHTML = `<i class="fa-solid fa-crosshairs"></i> 📍 Find Messes Near Me`;
          }

          if (items.length === 0) {
            showToast('No approved messes found within 5 km of your location.', 'info');
            grid.innerHTML = `
              <div style="grid-column: 1 / -1; background: #fff; border: 1px solid var(--color-neutral-200); border-radius: 20px; padding: 48px; text-align: center;">
                <i class="fa-solid fa-location-dot" style="font-size: 40px; color: var(--color-neutral-400); margin-bottom: 16px;"></i>
                <h3 class="font-display" style="font-size: 18px; font-weight: 700; color: var(--color-neutral-900); margin-bottom: 8px;">No Approved Messes Found Near You (Within 5 km)</h3>
                <p style="color: var(--color-neutral-500); font-size: 14px; margin-bottom: 20px;">Try searching by city or area in the marketplace.</p>
                <button id="browseAllFallBtn" class="btn-primary-action" style="padding: 10px 20px;">
                  Browse All Messes
                </button>
              </div>
            `;
            document.getElementById('browseAllFallBtn')?.addEventListener('click', () => navigate('#/providers'));
          } else {
            showToast(`Found ${items.length} approved mess provider(s) near your location!`, 'success');
            grid.innerHTML = items
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
                        <span style="background: rgba(255,255,255,0.25); color: #fff; padding: 2px 8px; border-radius: 999px; font-size: 11px; font-weight: 700; margin-left: 6px;"><i class="fa-solid fa-location-arrow"></i> 📍 ${Number(h.distanceKm).toFixed(1)} km away</span>
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
          }

          document.getElementById('homeHostelsGrid')?.scrollIntoView({ behavior: 'smooth' });
        } catch (err: any) {
          if (btn) {
            btn.disabled = false;
            btn.innerHTML = `<i class="fa-solid fa-crosshairs"></i> 📍 Find Messes Near Me`;
          }
          showToast('Unable to load nearby messes. Please try searching manually.', 'error');
        }
      },
      (err) => {
        if (btn) {
          btn.disabled = false;
          btn.innerHTML = `<i class="fa-solid fa-crosshairs"></i> 📍 Find Messes Near Me`;
        }
        let userMsg = "We couldn't access your location. You can search by city or area below.";
        if (err.code === err.PERMISSION_DENIED) {
          userMsg = "Location permission denied. You can search by city or area below.";
        }
        showToast(userMsg, 'error');
        document.getElementById('homeHostelsGrid')?.scrollIntoView({ behavior: 'smooth' });
      },
      { enableHighAccuracy: true, timeout: 10000, maximumAge: 0 }
    );
  });

  document.getElementById('heroBrowseBtn')?.addEventListener('click', () => navigate('#/providers'));
  document.getElementById('heroSignUpBtn')?.addEventListener('click', () => navigate('#/login'));
  document.getElementById('viewAllBtn')?.addEventListener('click', () => navigate('#/providers'));
  document.getElementById('ctaFindMessBtn')?.addEventListener('click', () => navigate('#/providers'));
  document.getElementById('whyViewPlansBtn')?.addEventListener('click', () => navigate('#/providers'));
  document.getElementById('whyCtaFindPlanBtn')?.addEventListener('click', () => navigate('#/providers'));
  document.getElementById('whyCtaExploreOptionsBtn')?.addEventListener('click', () => navigate('#/providers'));

  if (window.location.hash.includes('why-primeplate')) {
    setTimeout(() => {
      document.getElementById('why-primeplate')?.scrollIntoView({ behavior: 'smooth' });
    }, 100);
  }
}
