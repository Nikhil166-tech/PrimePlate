import api from '../api';
import { navigate } from '../router';
import { showToast } from '../components/toast';
import { renderNavbar, attachNavbarEvents } from '../components/navbar';
import { escapeHtml } from '../utils/sanitize';

function loadRazorpayScript(): Promise<boolean> {
  return new Promise((resolve) => {
    if ((window as any).Razorpay) {
      resolve(true);
      return;
    }
    const script = document.createElement('script');
    script.src = 'https://checkout.razorpay.com/v1/checkout.js';
    script.onload = () => resolve(true);
    script.onerror = () => resolve(false);
    document.body.appendChild(script);
  });
}

export async function renderCheckout(planId: string) {
  const container = document.getElementById('app')!;
  const token = localStorage.getItem('accessToken');

  if (!token) {
    localStorage.setItem('redirectAfterAuth', window.location.hash);
    navigate('#/login');
    return;
  }

  let selectedPlan: { id: string; title: string; price: number; duration: string; providerName?: string } | null = null;
  let actualPlanId = planId;
  let planFetchError: string | null = null;

  try {
    const fetched: any = await api.get(`/meal-plans/${planId}`);
    if (fetched && fetched.title) {
      actualPlanId = fetched.id;
      const priceNum = Number(fetched.pricePerMonth);
      if (!isNaN(priceNum) && priceNum > 0) {
        selectedPlan = {
          id: fetched.id,
          title: fetched.title,
          price: priceNum,
          duration: 'Monthly (30 Days)',
          providerName: fetched.provider?.name || 'PrimePlate Partner Kitchen',
        };
      } else {
        planFetchError = 'Unable to load plan price.';
      }
    } else {
      planFetchError = 'Meal plan unavailable.';
    }
  } catch (err: any) {
    planFetchError = err.message || 'Meal plan unavailable.';
  }

  if (!selectedPlan || planFetchError) {
    container.innerHTML = `
      ${renderNavbar()}
      <main class="main-content" style="padding-top: 88px; padding-bottom: 60px;">
        <div style="max-width: 580px; margin: 40px auto; padding: 0 24px;">
          <div style="background: #fff; border: 1px solid #fee2e2; border-radius: 24px; padding: 40px; text-align: center;">
            <i class="fa-solid fa-triangle-exclamation" style="font-size: 44px; color: #dc2626; margin-bottom: 16px;"></i>
            <h2 class="font-display" style="font-size: 22px; font-weight: 700; color: var(--color-neutral-900); margin-bottom: 8px;">Invalid Meal Plan</h2>
            <p style="color: var(--color-neutral-600); margin-bottom: 24px;">${escapeHtml(planFetchError || 'The requested meal plan does not exist or is currently unavailable.')}</p>
            <button id="checkoutBackBtn" class="btn-primary-action" style="padding: 12px 24px;">
              <i class="fa-solid fa-arrow-left"></i> Return to Kitchen Listings
            </button>
          </div>
        </div>
      </main>
    `;
    attachNavbarEvents();
    document.getElementById('checkoutBackBtn')?.addEventListener('click', () => navigate('#/providers'));
    return;
  }

  container.innerHTML = `
    ${renderNavbar()}
    <main class="main-content" style="padding-top: 88px; padding-bottom: 60px;">
      <div style="max-width: 580px; margin: 40px auto; padding: 0 24px;">
        <div style="background: #fff; border: 1px solid var(--color-neutral-200); border-radius: 24px; padding: 36px; box-shadow: 0 10px 30px rgba(0,0,0,0.06);">
          <div style="text-align: center; margin-bottom: 24px;">
            <span style="font-size: 12px; font-weight: 700; color: var(--color-success-600); background: var(--color-success-50); padding: 4px 12px; border-radius: 999px; display: inline-block; margin-bottom: 12px;">
              <i class="fa-solid fa-shield-halved"></i> Official Razorpay Secure Checkout
            </span>
            <h1 class="font-display" style="font-size: 28px; font-weight: 800; color: var(--color-neutral-900); margin-bottom: 6px;">Order Summary & Payment</h1>
            <p style="color: var(--color-neutral-500); font-size: 14px;">Confirm your selected meal plan subscription to activate your digital mess card</p>
          </div>

          <div id="checkoutPlanDetails" style="background: var(--color-neutral-50); border: 1px solid var(--color-neutral-200); border-radius: 16px; padding: 24px; margin-bottom: 28px;">
            <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 12px; border-bottom: 1px solid var(--color-neutral-200); padding-bottom: 12px;">
              <div>
                <span style="font-size: 11px; text-transform: uppercase; font-weight: 700; color: var(--color-neutral-500);">Kitchen Provider</span>
                <h3 id="providerName" class="font-display" style="font-size: 18px; font-weight: 700; color: var(--color-neutral-900);">${escapeHtml(selectedPlan.providerName || '')}</h3>
              </div>
            </div>

            <div style="display: flex; justify-content: space-between; font-size: 14px; color: var(--color-neutral-600); margin-bottom: 8px;">
              <span>Selected Meal Plan:</span>
              <span style="font-weight: 700; color: var(--color-neutral-900);">${escapeHtml(selectedPlan.title)}</span>
            </div>
            <div style="display: flex; justify-content: space-between; font-size: 14px; color: var(--color-neutral-600); margin-bottom: 16px;">
              <span>Duration:</span>
              <span style="font-weight: 600; color: var(--color-neutral-900);">${escapeHtml(selectedPlan.duration)}</span>
            </div>

            <div style="display: flex; justify-content: space-between; align-items: center; border-top: 1px dashed var(--color-neutral-300); padding-top: 16px;">
              <span style="font-weight: 700; font-size: 16px; color: var(--color-neutral-900);">Total Amount Payable:</span>
              <span id="planPriceDisplay" class="price-text" style="font-size: 26px; color: var(--color-primary-600);">₹${selectedPlan.price.toLocaleString('en-IN')}</span>
            </div>
          </div>

          <button id="payBtn" class="btn-primary-action" style="width: 100%; justify-content: center; padding: 14px; font-size: 16px; box-shadow: 0 4px 16px rgba(234, 88, 12, 0.3);">
            <i class="fa-solid fa-lock"></i>
            <span>Pay with Razorpay (₹${selectedPlan.price.toLocaleString('en-IN')})</span>
          </button>
        </div>
      </div>
    </main>

    <footer class="footer">
      © ${new Date().getFullYear()} PrimePlate. Premium Meal Subscription Platform.
    </footer>
  `;

  attachNavbarEvents();

  const payBtn = document.getElementById('payBtn') as HTMLButtonElement;

  payBtn.addEventListener('click', async () => {
    if (payBtn.hasAttribute('disabled')) return;

    payBtn.innerHTML = `<i class="fa-solid fa-spinner fa-spin"></i> Initializing Payment...`;
    payBtn.setAttribute('disabled', 'true');

    try {
      // 1. Create Razorpay order via backend
      const order: any = await api.post('/payments/create-order', { mealPlanId: actualPlanId });

      // 2. Ensure Razorpay Checkout script is loaded
      const isLoaded = await loadRazorpayScript();
      if (!isLoaded || !(window as any).Razorpay) {
        showToast('Failed to load Razorpay Checkout SDK. Check internet connection.', 'error');
        payBtn.innerHTML = `<i class="fa-solid fa-lock"></i> Pay with Razorpay (₹${selectedPlan.price.toLocaleString('en-IN')})`;
        payBtn.removeAttribute('disabled');
        return;
      }

      // 3. Configure Razorpay Popup options
      const userEmail = localStorage.getItem('userEmail') || '';
      const keyId = order.key_id || import.meta.env.VITE_RAZORPAY_KEY_ID;
      if (!keyId) {
        showToast('Razorpay payment Key ID is missing in configuration. Payment cancelled.', 'error');
        payBtn.innerHTML = `<i class="fa-solid fa-lock"></i> Pay with Razorpay (₹${selectedPlan.price.toLocaleString('en-IN')})`;
        payBtn.removeAttribute('disabled');
        return;
      }
      const options = {
        key: keyId,
        amount: order.amount,
        currency: 'INR',
        name: 'PrimePlate Subscription',
        description: selectedPlan.title,
        order_id: order.id,
        prefill: {
          email: userEmail,
        },
        theme: {
          color: '#ea580c',
        },
        handler: async function (response: any) {
          payBtn.innerHTML = `<i class="fa-solid fa-spinner fa-spin"></i> Verifying Payment...`;
          try {
            // 4. Verify payment signature on backend & activate subscription
            const result: any = await api.post('/payments/verify', {
              razorpay_payment_id: response.razorpay_payment_id,
              razorpay_order_id: response.razorpay_order_id,
              razorpay_signature: response.razorpay_signature,
              mealPlanId: actualPlanId,
            });

            const isVerified = result && result.success === true && result.verified === true && Boolean(result.subscription || result.payment);

            if (isVerified) {
              showToast('Payment verified successfully! Your subscription is now ACTIVE 🎉', 'success');
              navigate('#/student/dashboard');
            } else {
              showToast('Payment verification failed on server. Subscription was not activated.', 'error');
              payBtn.innerHTML = `<i class="fa-solid fa-lock"></i> Pay with Razorpay (₹${selectedPlan.price.toLocaleString('en-IN')})`;
              payBtn.removeAttribute('disabled');
            }
          } catch (verifyErr: any) {
            showToast(verifyErr.message || 'Payment verification failed. Subscription was not activated.', 'error');
            payBtn.innerHTML = `<i class="fa-solid fa-lock"></i> Pay with Razorpay (₹${selectedPlan.price.toLocaleString('en-IN')})`;
            payBtn.removeAttribute('disabled');
          }
        },
        modal: {
          ondismiss: function () {
            showToast('Payment window closed.', 'info');
            payBtn.innerHTML = `<i class="fa-solid fa-lock"></i> Pay with Razorpay (₹${selectedPlan.price.toLocaleString('en-IN')})`;
            payBtn.removeAttribute('disabled');
          },
        },
      };

      const rzp = new (window as any).Razorpay(options);
      rzp.open();
    } catch (err: any) {
      showToast(err.message || 'Failed to initiate payment', 'error');
      payBtn.innerHTML = `<i class="fa-solid fa-lock"></i> Pay with Razorpay (₹${selectedPlan.price.toLocaleString('en-IN')})`;
      payBtn.removeAttribute('disabled');
    }
  });
}
