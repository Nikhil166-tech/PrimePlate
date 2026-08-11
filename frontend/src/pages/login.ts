import api from '../api';
import { navigate } from '../router';
import { showToast } from '../components/toast';
import { renderNavbar, attachNavbarEvents } from '../components/navbar';

export function renderLogin() {
  const container = document.getElementById('app')!;
  let isRegisterMode = false;

  const render = () => {
    container.innerHTML = `
      ${renderNavbar()}
      <main class="main-content" style="padding-top: 88px; padding-bottom: 60px;">
        <div style="max-width: 440px; margin: 20px auto; padding: 0 16px;">
          <div style="background: #fff; border: 1px solid var(--color-neutral-200); border-radius: 24px; padding: 24px; box-shadow: 0 10px 30px rgba(0,0,0,0.06); text-align: center;">
            
            <div class="nav-brand-logo" style="width: 48px; height: 48px; margin: 0 auto 16px; font-size: 20px;">
              <i class="fa-solid fa-utensils"></i>
            </div>
            
            <h2 class="font-display" style="font-size: 26px; font-weight: 800; color: var(--color-neutral-900); margin-bottom: 6px;">
              ${isRegisterMode ? 'Join PrimePlate' : 'Welcome Back'}
            </h2>
            <p style="color: var(--color-neutral-500); font-size: 14px; margin-bottom: 24px;">
              ${isRegisterMode ? 'Create an account to start daily subscriptions' : 'Sign in to access your digital mess card'}
            </p>

            <div style="display: flex; background: var(--color-neutral-100); padding: 4px; border-radius: 12px; margin-bottom: 24px;">
              <button id="tabLogin" class="btn-outline-action" style="flex: 1; border: none; background: ${!isRegisterMode ? '#fff' : 'transparent'}; color: ${!isRegisterMode ? 'var(--color-primary-600)' : 'var(--color-neutral-600)'}; box-shadow: ${!isRegisterMode ? '0 2px 8px rgba(0,0,0,0.08)' : 'none'}; border-radius: 8px;">
                Sign In
              </button>
              <button id="tabRegister" class="btn-outline-action" style="flex: 1; border: none; background: ${isRegisterMode ? '#fff' : 'transparent'}; color: ${isRegisterMode ? 'var(--color-primary-600)' : 'var(--color-neutral-600)'}; box-shadow: ${isRegisterMode ? '0 2px 8px rgba(0,0,0,0.08)' : 'none'}; border-radius: 8px;">
                Register
              </button>
            </div>

            <form id="authForm">
              <div style="text-align: left; margin-bottom: 16px;">
                <label style="font-size: 13px; font-weight: 600; color: var(--color-neutral-700); display: block; margin-bottom: 6px;">Email Address</label>
                <input type="email" id="email" class="btn-outline-action" style="width: 100%; text-align: left; background: #fff;" placeholder="student@university.edu" required />
              </div>

              <div style="text-align: left; margin-bottom: 20px;">
                <label style="font-size: 13px; font-weight: 600; color: var(--color-neutral-700); display: block; margin-bottom: 6px;">Password</label>
                <input type="password" id="password" class="btn-outline-action" style="width: 100%; text-align: left; background: #fff;" placeholder="••••••••" required />
              </div>

              ${
                isRegisterMode
                  ? `<div style="text-align: left; margin-bottom: 20px;">
                      <label style="font-size: 13px; font-weight: 600; color: var(--color-neutral-700); display: block; margin-bottom: 6px;">Account Role</label>
                      <select id="role" class="btn-outline-action" style="width: 100%; text-align: left; background: #fff;">
                        <option value="STUDENT">Student / Customer</option>
                        <option value="PROVIDER">Hostel / Mess Owner</option>
                      </select>
                    </div>`
                  : ''
              }

              <button type="submit" class="btn-primary-action" style="width: 100%; justify-content: center; padding: 12px;">
                <i class="fa-solid ${isRegisterMode ? 'fa-user-plus' : 'fa-right-to-bracket'}"></i>
                <span>${isRegisterMode ? 'Create Account' : 'Sign In'}</span>
              </button>
            </form>
          </div>
        </div>
      </main>

      <footer class="footer">
        © ${new Date().getFullYear()} PrimePlate. Premium Meal Subscription Platform.
      </footer>
    `;

    attachNavbarEvents();

    const tabLogin = document.getElementById('tabLogin')!;
    const tabRegister = document.getElementById('tabRegister')!;
    const form = document.getElementById('authForm') as HTMLFormElement;

    tabLogin.addEventListener('click', () => {
      if (isRegisterMode) {
        isRegisterMode = false;
        render();
      }
    });

    tabRegister.addEventListener('click', () => {
      if (!isRegisterMode) {
        isRegisterMode = true;
        render();
      }
    });

    form.addEventListener('submit', async (e) => {
      e.preventDefault();
      const email = (form.querySelector('#email') as HTMLInputElement).value;
      const password = (form.querySelector('#password') as HTMLInputElement).value;

      try {
        let res: any = null;
        if (isRegisterMode) {
          const role = (form.querySelector('#role') as HTMLSelectElement)?.value || 'STUDENT';
          try {
            res = await api.post('/auth/register', { email, password, role });
            showToast('Account created successfully!', 'success');
          } catch (regErr: any) {
            if (regErr.message?.includes('already exists')) {
              showToast('Account already exists! Signing you in...', 'info');
              res = await api.post('/auth/login', { email, password });
            } else {
              throw regErr;
            }
          }
        } else {
          res = await api.post('/auth/login', { email, password });
          showToast('Sign in successful!', 'success');
        }

        const accessToken = res?.accessToken || res?.data?.accessToken;
        const refreshToken = res?.refreshToken || res?.data?.refreshToken;
        const user = res?.user || res?.data?.user;

        if (accessToken) {
          localStorage.setItem('accessToken', accessToken);
        }
        if (refreshToken) {
          localStorage.setItem('refreshToken', refreshToken);
        }

        const role = (user?.role || 'STUDENT').toUpperCase();
        localStorage.setItem('userRole', role);
        localStorage.setItem('userEmail', user?.email || email);

        const pendingRedirect = localStorage.getItem('redirectAfterAuth');
        if (pendingRedirect && role === 'STUDENT') {
          localStorage.removeItem('redirectAfterAuth');
          navigate(pendingRedirect);
          return;
        }

        if (role === 'ADMIN') {
          navigate('#/admin');
        } else if (role === 'PROVIDER' || role === 'MEAL_PROVIDER') {
          navigate('#/owner');
        } else {
          navigate('#/student/dashboard');
        }
      } catch (err: any) {
        showToast(err.message || 'Authentication failed', 'error');
      }
    });
  };

  render();
}
