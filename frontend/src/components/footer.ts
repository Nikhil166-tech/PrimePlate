export function renderFooter(): string {
  const year = new Date().getFullYear();

  return `
    <footer class="footer">
      <div class="footer-accent-line"></div>
      <div class="footer-container">
        <!-- Trust Highlights Bar -->
        <div class="footer-trust-bar">
          <div class="footer-trust-item">
            <i class="fa-solid fa-qrcode footer-trust-icon"></i>
            <span>Digital Mess Cards</span>
          </div>
          <div class="footer-trust-item">
            <i class="fa-solid fa-bolt footer-trust-icon"></i>
            <span>Instant Validation</span>
          </div>
          <div class="footer-trust-item">
            <i class="fa-solid fa-shield-halved footer-trust-icon"></i>
            <span>100% Verified Messes</span>
          </div>
          <div class="footer-trust-item">
            <i class="fa-solid fa-lock footer-trust-icon"></i>
            <span>Razorpay Secure</span>
          </div>
        </div>

        <!-- Main Footer Grid -->
        <div class="footer-grid">
          <!-- Brand Column -->
          <div class="footer-brand-col">
            <a href="#/home" class="footer-brand" aria-label="PrimePlate Home">
              <div class="footer-brand-logo">
                <i class="fa-solid fa-utensils"></i>
              </div>
              <span class="footer-brand-text">PrimePlate</span>
            </a>
            <p class="footer-tagline">Good Food. More Time. PrimePlate.</p>
            <p class="footer-description">
              Find nearby messes, compare meal plans, and manage your food subscription in one place.
            </p>
          </div>

          <!-- Quick Links -->
          <div class="footer-col">
            <h4 class="footer-col-title">Quick Links</h4>
            <ul class="footer-links">
              <li><a href="#/home" class="footer-link"><i class="fa-solid fa-chevron-right footer-link-arrow"></i> Home</a></li>
              <li><a href="#/providers" class="footer-link"><i class="fa-solid fa-chevron-right footer-link-arrow"></i> Browse Mess</a></li>
              <li><a href="#/home#why-primeplate" class="footer-link"><i class="fa-solid fa-chevron-right footer-link-arrow"></i> Why Choose Us</a></li>
              <li><a href="#/home#faq" class="footer-link footer-faq-link"><i class="fa-solid fa-chevron-right footer-link-arrow"></i> FAQs</a></li>
            </ul>
          </div>

          <!-- For PrimeMates -->
          <div class="footer-col">
            <h4 class="footer-col-title">For PrimeMates</h4>
            <ul class="footer-links">
              <li><a href="#/providers" class="footer-link"><i class="fa-solid fa-chevron-right footer-link-arrow"></i> Find Messes</a></li>
              <li><a href="#/dashboard" class="footer-link"><i class="fa-solid fa-chevron-right footer-link-arrow"></i> PrimeMate Dashboard</a></li>
            </ul>
          </div>

          <!-- For Providers -->
          <div class="footer-col">
            <h4 class="footer-col-title">For Providers</h4>
            <ul class="footer-links">
              <li><a href="#/owner" class="footer-link"><i class="fa-solid fa-chevron-right footer-link-arrow"></i> Provider Portal</a></li>
            </ul>
          </div>

          <!-- Contact Us -->
          <div class="footer-col">
            <h4 class="footer-col-title">Contact Us</h4>
            <div class="footer-support-group">
              <a
                href="https://wa.me/918639296593?text=Hi%20PrimePlate%2C%20I%20need%20help%20with%20your%20platform."
                target="_blank"
                rel="noopener noreferrer"
                class="footer-support-item footer-support-wa"
                aria-label="Contact PrimePlate on WhatsApp"
              >
                <i class="fa-brands fa-whatsapp footer-support-icon"></i>
                <div class="footer-support-text">
                  <span class="footer-support-title">WhatsApp Support</span>
                  <span class="footer-support-detail">+91 8639296593</span>
                </div>
              </a>

              <a
                href="mailto:support.primeplate@gmail.com?subject=PrimePlate%20Support%20Request"
                class="footer-support-item footer-support-mail"
                aria-label="Email PrimePlate support"
              >
                <i class="fa-solid fa-envelope footer-support-icon"></i>
                <div class="footer-support-text">
                  <span class="footer-support-title">Email Support</span>
                  <span class="footer-support-detail">support.primeplate@gmail.com</span>
                </div>
              </a>
            </div>
          </div>

          <!-- Connect Column -->
          <div class="footer-col">
            <h4 class="footer-col-title">Connect</h4>
            <div class="footer-social-row">
              <a
                href="https://www.instagram.com/primeplate0.01/"
                target="_blank"
                rel="noopener noreferrer"
                class="footer-social-icon-btn footer-social-ig"
                aria-label="PrimePlate Instagram"
                title="Instagram"
              >
                <i class="fa-brands fa-instagram"></i>
              </a>
              <a
                href="https://www.youtube.com/@primeplate"
                target="_blank"
                rel="noopener noreferrer"
                class="footer-social-icon-btn footer-social-yt"
                aria-label="PrimePlate YouTube"
                title="YouTube"
              >
                <i class="fa-brands fa-youtube"></i>
              </a>
            </div>
          </div>
        </div>

        <!-- Footer CTA Card -->
        <div class="footer-cta-banner">
          <div class="footer-cta-content">
            <h3 class="footer-cta-title">Ready to find your next meal plan?</h3>
            <p class="footer-cta-subtitle">Discover top-rated messes and fresh thali options near your location.</p>
          </div>
          <div class="footer-cta-actions">
            <a href="#/providers" class="btn-primary-action footer-cta-btn">
              <i class="fa-solid fa-magnifying-glass"></i> Find a Meal Plan
            </a>
            <a href="#/owner" class="btn-outline-action footer-cta-btn footer-cta-btn-outline">
              <i class="fa-solid fa-store"></i> Provider Portal
            </a>
          </div>
        </div>

        <!-- Bottom Copyright Bar -->
        <div class="footer-bottom">
          <p class="footer-copyright">
            © ${year} PrimePlate. All rights reserved.
          </p>
          <div class="footer-bottom-badge">
            <i class="fa-solid fa-circle" style="font-size: 8px; color: #22c55e;"></i> Platform Active
          </div>
        </div>
      </div>
    </footer>
  `;
}

export function attachFooterEvents() {
  document.querySelectorAll('a[href*="why-primeplate"]').forEach((link) => {
    link.addEventListener('click', () => {
      const el = document.getElementById('why-primeplate');
      if (el) {
        setTimeout(() => {
          el.scrollIntoView({ behavior: 'smooth' });
        }, 50);
      }
    });
  });

  document.querySelectorAll('.footer-faq-link').forEach((link) => {
    link.addEventListener('click', () => {
      const faqEl = document.getElementById('faq');
      if (faqEl) {
        setTimeout(() => {
          faqEl.scrollIntoView({ behavior: 'smooth' });
        }, 50);
      }
    });
  });
}
