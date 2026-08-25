import api from '../api';
import { renderNavbar, attachNavbarEvents } from '../components/navbar';
import { renderFooter, attachFooterEvents } from '../components/footer';

function getResetTokenFromUrl(): string {
  // 1. Check window.location.search (e.g. http://localhost:5173/?token=XYZ#/reset-password)
  const searchParams = new URLSearchParams(window.location.search);
  const searchToken = searchParams.get('token');
  if (searchToken) return searchToken;

  // 2. Check window.location.hash (e.g. http://localhost:5173/#/reset-password?token=XYZ)
  const hash = window.location.hash || '';
  const qIdx = hash.indexOf('?');
  if (qIdx !== -1) {
    const queryString = hash.substring(qIdx + 1);
    const hashParams = new URLSearchParams(queryString);
    const hashToken = hashParams.get('token');
    if (hashToken) return hashToken;
  }

  return '';
}

export function renderResetPassword() {
  const container = document.getElementById('app')!;
  const token = getResetTokenFromUrl();

  let isLoading = false;
  let isSuccess = false;
  let errorMessage = '';

  const render = () => {
    container.innerHTML = `
      ${renderNavbar()}
      <main class="main-content" style="padding-top: 88px; padding-bottom: 60px;">
        <div style="max-width: 440px; width: 100%; margin: 20px auto; padding: 0 16px; box-sizing: border-box;">
          <div style="background: #fff; border: 1px solid var(--color-neutral-200); border-radius: 24px; padding: 24px; box-shadow: 0 10px 30px rgba(0,0,0,0.06); text-align: center; box-sizing: border-box;">
            
            <div class="nav-brand-logo" style="width: 48px; height: 48px; margin: 0 auto 16px; font-size: 20px; display: flex; align-items: center; justify-content: center;">
              <i class="fa-solid fa-lock"></i>
            </div>
            
            <h2 class="font-display" style="font-size: 26px; font-weight: 800; color: var(--color-neutral-900); margin-bottom: 6px;">
              Reset Password
            </h2>
            <p style="color: var(--color-neutral-500); font-size: 14px; margin-bottom: 24px;">
              Please enter your new password below.
            </p>

            ${
              !token && !isSuccess
                ? `<div style="background: #fef2f2; border: 1px solid #fecaca; color: #991b1b; padding: 14px 16px; border-radius: 12px; font-size: 14px; text-align: left; margin-bottom: 20px; line-height: 1.5;">
                    <i class="fa-solid fa-circle-exclamation" style="margin-right: 8px;"></i>Invalid or missing password reset token. Please request a new link.
                  </div>`
                : ''
            }

            ${
              errorMessage
                ? `<div style="background: #fef2f2; border: 1px solid #fecaca; color: #991b1b; padding: 14px 16px; border-radius: 12px; font-size: 14px; text-align: left; margin-bottom: 20px; line-height: 1.5;">
                    <i class="fa-solid fa-triangle-exclamation" style="margin-right: 8px;"></i>${errorMessage}
                  </div>`
                : ''
            }

            ${
              isSuccess
                ? `
                  <div style="background: #f0fdf4; border: 1px solid #bbf7d0; color: #166534; padding: 16px; border-radius: 12px; font-size: 15px; font-weight: 600; margin-bottom: 24px; text-align: center;">
                    <i class="fa-solid fa-circle-check" style="margin-right: 8px; font-size: 18px;"></i>Password reset successfully.
                  </div>

                  <a 
                    href="#/login" 
                    class="btn-primary-action" 
                    style="width: 100%; justify-content: center; padding: 12px; text-decoration: none; box-sizing: border-box; display: inline-flex;"
                  >
                    <i class="fa-solid fa-right-to-bracket"></i>
                    <span>Back to Login</span>
                  </a>
                `
                : `
                  <form id="resetPasswordForm">
                    <div style="text-align: left; margin-bottom: 16px;">
                      <label style="font-size: 13px; font-weight: 600; color: var(--color-neutral-700); display: block; margin-bottom: 6px;">New Password</label>
                      <div style="position: relative;">
                        <input 
                          type="password" 
                          id="newPassword" 
                          class="btn-outline-action" 
                          style="width: 100%; text-align: left; background: #fff; padding-right: 40px; box-sizing: border-box;" 
                          placeholder="••••••••" 
                          required 
                          ${!token || isLoading ? 'disabled' : ''}
                        />
                        <button type="button" id="toggleNewPasswordBtn" style="position: absolute; right: 12px; top: 50%; transform: translateY(-50%); background: none; border: none; color: var(--color-neutral-500); cursor: pointer; padding: 4px; display: flex; align-items: center; justify-content: center;" aria-label="Toggle new password visibility">
                          <i class="fa-solid fa-eye" id="toggleNewPasswordIcon"></i>
                        </button>
                      </div>
                      <p style="font-size: 11px; color: var(--color-neutral-500); margin-top: 4px;">
                        Must be 8+ characters with uppercase, lowercase, number & symbol (e.g. @, #, $)
                      </p>
                    </div>

                    <div style="text-align: left; margin-bottom: 20px;">
                      <label style="font-size: 13px; font-weight: 600; color: var(--color-neutral-700); display: block; margin-bottom: 6px;">Confirm New Password</label>
                      <div style="position: relative;">
                        <input 
                          type="password" 
                          id="confirmPassword" 
                          class="btn-outline-action" 
                          style="width: 100%; text-align: left; background: #fff; padding-right: 40px; box-sizing: border-box;" 
                          placeholder="••••••••" 
                          required 
                          ${!token || isLoading ? 'disabled' : ''}
                        />
                        <button type="button" id="toggleConfirmPasswordBtn" style="position: absolute; right: 12px; top: 50%; transform: translateY(-50%); background: none; border: none; color: var(--color-neutral-500); cursor: pointer; padding: 4px; display: flex; align-items: center; justify-content: center;" aria-label="Toggle confirm password visibility">
                          <i class="fa-solid fa-eye" id="toggleConfirmPasswordIcon"></i>
                        </button>
                      </div>
                    </div>

                    <button 
                      type="submit" 
                      id="resetPasswordBtn"
                      class="btn-primary-action" 
                      style="width: 100%; justify-content: center; padding: 12px; box-sizing: border-box; cursor: pointer;"
                      ${!token || isLoading ? 'disabled' : ''}
                    >
                      <i class="fa-solid ${isLoading ? 'fa-spinner fa-spin' : 'fa-check'}"></i>
                      <span>${isLoading ? 'Updating Password...' : 'Reset Password'}</span>
                    </button>
                  </form>

                  <div style="margin-top: 24px; text-align: center; border-top: 1px solid var(--color-neutral-200); padding-top: 16px;">
                    <a href="#/login" style="font-size: 14px; font-weight: 600; color: var(--color-neutral-600); text-decoration: none; display: inline-flex; align-items: center; gap: 6px;">
                      <i class="fa-solid fa-arrow-left"></i>
                      <span>Back to Login</span>
                    </a>
                  </div>
                `
            }
          </div>
        </div>
      </main>

      ${renderFooter()}
    `;

    attachNavbarEvents();
    attachFooterEvents();

    const toggleNewPasswordBtn = document.getElementById('toggleNewPasswordBtn');
    const newPasswordInput = document.getElementById('newPassword') as HTMLInputElement;
    const toggleNewPasswordIcon = document.getElementById('toggleNewPasswordIcon');

    if (toggleNewPasswordBtn && newPasswordInput && toggleNewPasswordIcon) {
      toggleNewPasswordBtn.addEventListener('click', () => {
        const isPassword = newPasswordInput.type === 'password';
        newPasswordInput.type = isPassword ? 'text' : 'password';
        toggleNewPasswordIcon.className = `fa-solid ${isPassword ? 'fa-eye-slash' : 'fa-eye'}`;
      });
    }

    const toggleConfirmPasswordBtn = document.getElementById('toggleConfirmPasswordBtn');
    const confirmPasswordInput = document.getElementById('confirmPassword') as HTMLInputElement;
    const toggleConfirmPasswordIcon = document.getElementById('toggleConfirmPasswordIcon');

    if (toggleConfirmPasswordBtn && confirmPasswordInput && toggleConfirmPasswordIcon) {
      toggleConfirmPasswordBtn.addEventListener('click', () => {
        const isPassword = confirmPasswordInput.type === 'password';
        confirmPasswordInput.type = isPassword ? 'text' : 'password';
        toggleConfirmPasswordIcon.className = `fa-solid ${isPassword ? 'fa-eye-slash' : 'fa-eye'}`;
      });
    }

    const form = document.getElementById('resetPasswordForm') as HTMLFormElement;
    if (form) {
      form.addEventListener('submit', async (e) => {
        e.preventDefault();
        const newPasswordInput = document.getElementById('newPassword') as HTMLInputElement;
        const confirmPasswordInput = document.getElementById('confirmPassword') as HTMLInputElement;

        const newPassword = newPasswordInput?.value || '';
        const confirmPassword = confirmPasswordInput?.value || '';

        errorMessage = '';

        if (!token) {
          errorMessage = 'Missing reset token.';
          render();
          return;
        }

        if (
          newPassword.length < 8 ||
          !/[a-z]/.test(newPassword) ||
          !/[A-Z]/.test(newPassword) ||
          !/\d/.test(newPassword) ||
          !/[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>/?~`]/.test(newPassword)
        ) {
          errorMessage = 'Password must be at least 8 characters long and include an uppercase letter, lowercase letter, number, and special character.';
          render();
          return;
        }

        if (newPassword !== confirmPassword) {
          errorMessage = 'Passwords do not match.';
          render();
          return;
        }

        isLoading = true;
        render();

        try {
          await api.post('/auth/reset-password', {
            token,
            newPassword,
          });
          isSuccess = true;
        } catch (err: any) {
          errorMessage = err.message || 'Failed to reset password. The link may have expired or already been used.';
        } finally {
          isLoading = false;
          render();
        }
      });
    }
  };

  render();
}
