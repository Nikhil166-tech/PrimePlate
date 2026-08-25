import api from '../api';
import { renderNavbar, attachNavbarEvents } from '../components/navbar';
import { renderFooter, attachFooterEvents } from '../components/footer';

export function renderForgotPassword() {
  const container = document.getElementById('app')!;

  let isLoading = false;
  let successMessage = '';
  let errorMessage = '';

  const render = () => {
    container.innerHTML = `
      ${renderNavbar()}
      <main class="main-content" style="padding-top: 88px; padding-bottom: 60px;">
        <div style="max-width: 440px; width: 100%; margin: 20px auto; padding: 0 16px; box-sizing: border-box;">
          <div style="background: #fff; border: 1px solid var(--color-neutral-200); border-radius: 24px; padding: 24px; box-shadow: 0 10px 30px rgba(0,0,0,0.06); text-align: center; box-sizing: border-radius;">
            
            <div class="nav-brand-logo" style="width: 48px; height: 48px; margin: 0 auto 16px; font-size: 20px; display: flex; align-items: center; justify-content: center;">
              <i class="fa-solid fa-key"></i>
            </div>
            
            <h2 class="font-display" style="font-size: 26px; font-weight: 800; color: var(--color-neutral-900); margin-bottom: 6px;">
              Forgot Password
            </h2>
            <p style="color: var(--color-neutral-500); font-size: 14px; margin-bottom: 24px;">
              Enter your email address and we'll send you a password reset link.
            </p>

            ${
              successMessage
                ? `<div id="statusSuccess" style="background: #f0fdf4; border: 1px solid #bbf7d0; color: #166534; padding: 14px 16px; border-radius: 12px; font-size: 14px; text-align: left; margin-bottom: 20px; line-height: 1.5;">
                    <i class="fa-solid fa-circle-check" style="margin-right: 8px;"></i>${successMessage}
                  </div>`
                : ''
            }

            ${
              errorMessage
                ? `<div id="statusError" style="background: #fef2f2; border: 1px solid #fecaca; color: #991b1b; padding: 14px 16px; border-radius: 12px; font-size: 14px; text-align: left; margin-bottom: 20px; line-height: 1.5;">
                    <i class="fa-solid fa-triangle-exclamation" style="margin-right: 8px;"></i>${errorMessage}
                  </div>`
                : ''
            }

            <form id="forgotPasswordForm">
              <div style="text-align: left; margin-bottom: 20px;">
                <label style="font-size: 13px; font-weight: 600; color: var(--color-neutral-700); display: block; margin-bottom: 6px;">Email Address</label>
                <input 
                  type="email" 
                  id="forgotEmail" 
                  class="btn-outline-action" 
                  style="width: 100%; text-align: left; background: #fff; box-sizing: border-box;" 
                  placeholder="Enter your email" 
                  required 
                  ${isLoading ? 'disabled' : ''}
                />
              </div>

              <button 
                type="submit" 
                id="sendResetBtn"
                class="btn-primary-action" 
                style="width: 100%; justify-content: center; padding: 12px; box-sizing: border-box; cursor: pointer;"
                ${isLoading ? 'disabled' : ''}
              >
                <i class="fa-solid ${isLoading ? 'fa-spinner fa-spin' : 'fa-paper-plane'}"></i>
                <span>${isLoading ? 'Sending reset link...' : 'Send Reset Link'}</span>
              </button>
            </form>

            <div style="margin-top: 24px; text-align: center; border-top: 1px solid var(--color-neutral-200); padding-top: 16px;">
              <a href="#/login" style="font-size: 14px; font-weight: 600; color: var(--color-neutral-600); text-decoration: none; display: inline-flex; align-items: center; gap: 6px;">
                <i class="fa-solid fa-arrow-left"></i>
                <span>Back to Login</span>
              </a>
            </div>
          </div>
        </div>
      </main>

      ${renderFooter()}
    `;

    attachNavbarEvents();
    attachFooterEvents();

    const form = document.getElementById('forgotPasswordForm') as HTMLFormElement;
    if (form) {
      form.addEventListener('submit', async (e) => {
        e.preventDefault();
        const emailInput = document.getElementById('forgotEmail') as HTMLInputElement;
        const email = emailInput?.value ? emailInput.value.trim() : '';

        if (!email) return;

        isLoading = true;
        successMessage = '';
        errorMessage = '';
        render();

        try {
          const res: any = await api.post('/auth/forgot-password', { email });
          const msg =
            res?.message ||
            'If an account exists for this email, a password reset link has been sent.';
          successMessage = msg;
        } catch (_) {
          errorMessage = 'Unable to process your request. Please try again.';
        } finally {
          isLoading = false;
          render();
        }
      });
    }
  };

  render();
}
