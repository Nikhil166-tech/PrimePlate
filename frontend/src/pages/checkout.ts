import api from '../api';
import { navigate } from '../router';
import { showToast } from '../components/toast';
import { renderNavbar, attachNavbarEvents } from '../components/navbar';
import { renderFooter, attachFooterEvents } from '../components/footer';
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

  const hashStr = window.location.hash;
  let initialDays = 30;
  if (hashStr.includes('?')) {
    const queryPart = hashStr.split('?')[1];
    const params = new URLSearchParams(queryPart);
    const d = params.get('days');
    if (d && !isNaN(Number(d)) && Number(d) > 0) {
      initialDays = Number(d);
    }
  }

  let selectedPlan: { id: string; title: string; basePrice: number; providerName?: string; description?: string } | null = null;
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
          basePrice: priceNum,
          providerName: fetched.provider?.name || 'PrimePlate Partner Kitchen',
          description: fetched.description || 'Daily fresh meals',
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
      ${renderFooter()}
    `;
    attachNavbarEvents();
    attachFooterEvents();
    document.getElementById('checkoutBackBtn')?.addEventListener('click', () => navigate('#/providers'));
    return;
  }

  let selectedDays = initialDays;
  const calcPrice = (days: number) => Math.max(1, Math.round(selectedPlan!.basePrice * (days / 30)));

  const durationOptions = [
    { days: 1, title: '1 Day Pass', description: 'Daily fresh meal' },
    { days: 7, title: '7 Days Pass', description: '1 week subscription' },
    { days: 15, title: '15 Days Pass', description: 'Half-month subscription' },
    { days: 30, title: '1 Month Pass (30 Days)', description: 'Full month subscription' },
  ];

  const durationCardsHtml = durationOptions.map((opt) => {
    const isSelected = opt.days === selectedDays;
    const pVal = calcPrice(opt.days);
    return `
      <label class="co-duration-card" style="display: grid; grid-template-columns: auto 1fr auto; align-items: center; gap: 10px; border: ${isSelected ? '2px solid #f97316' : '1px solid #e5e7eb'}; background: ${isSelected ? '#fff8f0' : '#ffffff'}; border-radius: 14px; padding: 12px 14px; margin-bottom: 10px; cursor: pointer; min-width: 0; box-sizing: border-box;">
        <input type="radio" name="coDurationPlan" value="${opt.days}" ${isSelected ? 'checked' : ''} style="width: 18px; height: 18px; accent-color: #ea580c; cursor: pointer; flex-shrink: 0;" />
        <div style="min-width: 0; overflow: hidden;">
          <strong style="font-size: 14px; font-weight: 700; color: #111827; display: block; margin-bottom: 2px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis;">${escapeHtml(opt.title)}</strong>
          <p style="font-size: 12px; color: #6b7280; margin: 0; line-height: 1.3; white-space: nowrap; overflow: hidden; text-overflow: ellipsis;">${escapeHtml(opt.description)}</p>
        </div>
        <span style="font-weight: 800; color: #ea580c; font-size: 16px; white-space: nowrap; flex-shrink: 0; text-align: right;">₹${pVal.toLocaleString('en-IN')}</span>
      </label>
    `;
  }).join('');

  container.innerHTML = `
    ${renderNavbar()}
    <main class="main-content" style="padding-top: 88px; padding-bottom: 60px;">
      <div style="max-width: 580px; margin: 20px auto; padding: 0 16px;">
        <div style="background: #fff; border: 1px solid var(--color-neutral-200); border-radius: 24px; padding: 24px; box-shadow: 0 10px 30px rgba(0,0,0,0.06);">
          <div style="text-align: center; margin-bottom: 24px;">
            <span style="font-size: 12px; font-weight: 700; color: var(--color-success-600); background: var(--color-success-50); padding: 4px 12px; border-radius: 999px; display: inline-block; margin-bottom: 12px;">
              <i class="fa-solid fa-shield-halved"></i> Official Razorpay Secure Checkout
            </span>
            <h1 class="font-display" style="font-size: 28px; font-weight: 800; color: var(--color-neutral-900); margin-bottom: 6px;">Order Summary & Payment</h1>
            <p style="color: var(--color-neutral-500); font-size: 14px;">Confirm your selected meal plan subscription to activate your digital mess card</p>
          </div>

          <div id="checkoutPlanDetails" style="background: var(--color-neutral-50); border: 1px solid var(--color-neutral-200); border-radius: 16px; padding: 24px; margin-bottom: 28px;">
            <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 16px; border-bottom: 1px solid var(--color-neutral-200); padding-bottom: 12px;">
              <div>
                <span style="font-size: 11px; text-transform: uppercase; font-weight: 700; color: var(--color-neutral-500);">Kitchen Provider</span>
                <h3 id="providerName" class="font-display" style="font-size: 18px; font-weight: 700; color: var(--color-neutral-900);">${escapeHtml(selectedPlan.providerName || '')}</h3>
              </div>
            </div>

            <div style="margin-bottom: 16px;">
              <label style="font-size: 14px; font-weight: 700; color: var(--color-neutral-900); display: block; margin-bottom: 10px;">Select Plan Duration</label>
              ${durationCardsHtml}
            </div>

            <div style="display: flex; justify-content: space-between; align-items: center; border-top: 1px dashed var(--color-neutral-300); padding-top: 16px;">
              <span style="font-weight: 700; font-size: 16px; color: var(--color-neutral-900);">Total Amount Payable:</span>
              <span id="planPriceDisplay" class="price-text" style="font-size: 26px; color: var(--color-primary-600);">₹${calcPrice(selectedDays).toLocaleString('en-IN')}</span>
            </div>
          </div>

          <button id="payBtn" class="btn-primary-action" style="width: 100%; justify-content: center; padding: 14px; font-size: 16px; box-shadow: 0 4px 16px rgba(234, 88, 12, 0.3);">
            <i class="fa-solid fa-lock"></i>
            <span id="payBtnText">Pay with Razorpay (₹${calcPrice(selectedDays).toLocaleString('en-IN')})</span>
          </button>
        </div>
      </div>
    </main>

    ${renderFooter()}
  `;

  attachNavbarEvents();
  attachFooterEvents();

  document.querySelectorAll('input[name="coDurationPlan"]').forEach((radio) => {
    radio.addEventListener('change', (e) => {
      document.querySelectorAll('.co-duration-card').forEach((card) => {
        (card as HTMLElement).style.borderColor = '#e5e7eb';
        (card as HTMLElement).style.borderWidth = '1px';
        (card as HTMLElement).style.background = '#ffffff';
      });

      const targetRadio = e.currentTarget as HTMLInputElement;
      const cardLabel = targetRadio.closest('.co-duration-card') as HTMLElement;
      if (cardLabel) {
        cardLabel.style.borderColor = '#f97316';
        cardLabel.style.borderWidth = '2px';
        cardLabel.style.background = '#fff8f0';
      }

      selectedDays = Number(targetRadio.value) || 30;
      const currentPrice = calcPrice(selectedDays);
      const priceDisplay = document.getElementById('planPriceDisplay');
      const payBtnText = document.getElementById('payBtnText');
      if (priceDisplay) priceDisplay.textContent = `₹${currentPrice.toLocaleString('en-IN')}`;
      if (payBtnText) payBtnText.textContent = `Pay with Razorpay (₹${currentPrice.toLocaleString('en-IN')})`;
    });
  });

  const payBtn = document.getElementById('payBtn') as HTMLButtonElement;

  let pollingTimerId: any = null;

  const setConfirmationPendingState = (orderId: string, isMaxAttemptsReached = false) => {
    sessionStorage.setItem('pendingPaymentOrderId', orderId);
    sessionStorage.setItem('pendingPaymentPlanId', actualPlanId);
    console.log(`PAYMENT_PENDING_ORDER orderId=${orderId}`);

    if (payBtn) {
      payBtn.innerHTML = `<i class="fa-solid fa-clock-rotate-left"></i> <span>Check Payment Status</span>`;
      payBtn.removeAttribute('disabled');
      payBtn.className = 'btn-primary-action';
      payBtn.style.backgroundColor = '#d97706';
      payBtn.onclick = () => pollStatus(orderId, true);
    }

    const detailsBox = document.getElementById('checkoutPlanDetails');
    const existingNotice = document.getElementById('pendingRecoveryNotice');
    if (existingNotice) existingNotice.remove();

    if (detailsBox) {
      const notice = document.createElement('div');
      notice.id = 'pendingRecoveryNotice';
      notice.style.background = '#fffbeb';
      notice.style.border = '1px solid #fde68a';
      notice.style.borderRadius = '12px';
      notice.style.padding = '16px';
      notice.style.marginBottom = '16px';

      const noticeTitle = isMaxAttemptsReached
        ? 'Payment confirmation is taking longer than expected.'
        : 'Payment Confirmation Pending';
      const noticeDesc = isMaxAttemptsReached
        ? 'Please check your subscription status before trying to pay again.'
        : 'Your transaction was submitted. We\'re confirming the payment status with Razorpay. <strong>Please do not pay again</strong> while we reconcile your order.';

      notice.innerHTML = `
        <div style="display: flex; align-items: flex-start; gap: 12px;">
          <i class="fa-solid fa-hourglass-half" style="color: #d97706; font-size: 20px; margin-top: 2px;"></i>
          <div style="flex: 1;">
            <strong style="color: #92400e; font-size: 15px; display: block; margin-bottom: 4px;">${noticeTitle}</strong>
            <p style="color: #b45309; font-size: 13px; margin: 0 0 12px 0; line-height: 1.4;">${noticeDesc}</p>
            <button id="clearAndPayAgainBtn" type="button" class="btn-outline-action" style="padding: 6px 14px; font-size: 12px; font-weight: 700; color: #b45309; border-color: #fcd34d; background: #ffffff; cursor: pointer;">
              <i class="fa-solid fa-rotate-left"></i> Cancel Pending Check & Try New Payment
            </button>
          </div>
        </div>
      `;
      detailsBox.prepend(notice);

      document.getElementById('clearAndPayAgainBtn')?.addEventListener('click', () => {
        resetPayBtns();
        showToast('Pending check cleared. You can now place a new payment.', 'info');
      });
    }
  };

  const resetPayBtns = () => {
    if (pollingTimerId) clearTimeout(pollingTimerId);
    pollingTimerId = null;
    sessionStorage.removeItem('pendingPaymentOrderId');
    sessionStorage.removeItem('pendingPaymentPlanId');
    const notice = document.getElementById('pendingRecoveryNotice');
    if (notice) notice.remove();

    if (payBtn) {
      payBtn.innerHTML = `<i class="fa-solid fa-lock"></i> <span id="payBtnText">Pay with Razorpay (₹${calcPrice(selectedDays).toLocaleString('en-IN')})</span>`;
      payBtn.removeAttribute('disabled');
      payBtn.style.backgroundColor = '';
      payBtn.onclick = null;
    }
  };

  const pollStatus = async (orderId: string, manual = false) => {
    console.log(`PAYMENT_STATUS_CHECK orderId=${orderId}`);

    if (payBtn) {
      payBtn.innerHTML = `<i class="fa-solid fa-spinner fa-spin"></i> Checking Status...`;
      payBtn.setAttribute('disabled', 'true');
    }

    try {
      const res: any = await api.get(`/payments/${orderId}/status`);
      const status = res?.status;
      console.log(`PAYMENT_STATUS_CHECK orderId=${orderId} status=${status}`);

      if (status === 'SUCCESS') {
        if (pollingTimerId) clearTimeout(pollingTimerId);
        pollingTimerId = null;
        sessionStorage.removeItem('pendingPaymentOrderId');
        sessionStorage.removeItem('pendingPaymentPlanId');
        showToast('Payment verified successfully! Your subscription is now ACTIVE 🎉', 'success');
        navigate('#/student/dashboard');
        return 'SUCCESS';
      } else if (status === 'FAILED') {
        if (pollingTimerId) clearTimeout(pollingTimerId);
        pollingTimerId = null;
        sessionStorage.removeItem('pendingPaymentOrderId');
        sessionStorage.removeItem('pendingPaymentPlanId');
        showToast(res.message || 'Payment failed. You can try again.', 'error');
        resetPayBtns();
        return 'FAILED';
      } else {
        if (manual) {
          showToast('Payment confirmation is pending. Please check again shortly.', 'info');
        }
        setConfirmationPendingState(orderId, false);
        return 'PROCESSING';
      }
    } catch (err: any) {
      const isNotFound = err?.response?.status === 404 || err?.status === 404 || (err?.message && (err.message.includes('not found') || err.message.includes('404')));
      if (isNotFound) {
        console.log(`PAYMENT_STATUS_CHECK orderId=${orderId} status=NOT_FOUND`);
        if (pollingTimerId) clearTimeout(pollingTimerId);
        pollingTimerId = null;
        sessionStorage.removeItem('pendingPaymentOrderId');
        sessionStorage.removeItem('pendingPaymentPlanId');
        showToast('Order record not found on server. Please try placing your order again.', 'info');
        resetPayBtns();
        return 'FAILED';
      }
      if (manual) {
        showToast(err.message || 'Payment confirmation is pending. Please check again shortly.', 'info');
      }
      setConfirmationPendingState(orderId, false);
      return 'ERROR';
    }
  };

  const startBoundedStatusPolling = async (orderId: string) => {
    if (pollingTimerId) clearTimeout(pollingTimerId);
    setConfirmationPendingState(orderId, false);
    showToast('Checking payment confirmation with server...', 'info');

    let attempts = 0;
    const maxAttempts = 5;
    const intervals = [2000, 3000, 4000, 5000, 6000];

    const runPoll = async () => {
      if (attempts >= maxAttempts) {
        setConfirmationPendingState(orderId, true);
        return;
      }
      const delay = intervals[attempts] || 4000;
      attempts++;
      pollingTimerId = setTimeout(async () => {
        const result = await pollStatus(orderId, false);
        if (result === 'SUCCESS' || result === 'FAILED') {
          return;
        }
        if (attempts < maxAttempts) {
          runPoll();
        } else {
          setConfirmationPendingState(orderId, true);
        }
      }, delay);
    };

    runPoll();
  };

  // Check for unresolved pending order on page load / refresh
  const savedPendingOrderId = sessionStorage.getItem('pendingPaymentOrderId');
  const savedPendingPlanId = sessionStorage.getItem('pendingPaymentPlanId');
  if (savedPendingOrderId) {
    if (savedPendingPlanId && savedPendingPlanId !== actualPlanId) {
      // Pending order belongs to a different plan; do not block checkout for new plan
      sessionStorage.removeItem('pendingPaymentOrderId');
      sessionStorage.removeItem('pendingPaymentPlanId');
    } else {
      console.log(`PAYMENT_PENDING_ORDER orderId=${savedPendingOrderId}`);
      setConfirmationPendingState(savedPendingOrderId, false);
      startBoundedStatusPolling(savedPendingOrderId);
    }
  }

  payBtn.addEventListener('click', async () => {
    if (payBtn.hasAttribute('disabled')) return;

    const pendingId = sessionStorage.getItem('pendingPaymentOrderId');
    if (pendingId) {
      await pollStatus(pendingId, true);
      return;
    }

    payBtn.innerHTML = `<i class="fa-solid fa-spinner fa-spin"></i> Initializing Payment...`;
    payBtn.setAttribute('disabled', 'true');

    try {
      // 1. Create Razorpay order via backend
      const order: any = await api.post('/payments/create-order', {
        mealPlanId: actualPlanId,
        durationDays: selectedDays,
      });

      sessionStorage.setItem('pendingPaymentOrderId', order.id);
      let paymentAttempted = false;

      const userEmail = localStorage.getItem('userEmail') || '';
      const keyId = order.key_id || import.meta.env.VITE_RAZORPAY_KEY_ID;

      // 2. Ensure Razorpay Checkout script is loaded
      const isLoaded = await loadRazorpayScript();
      if (!isLoaded || !(window as any).Razorpay) {
        showToast('Razorpay Checkout SDK unreachable. Please check your connection.', 'error');
        resetPayBtns();
        return;
      }

      // 3. Configure Razorpay Popup options
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
          paymentAttempted = true;
          payBtn.innerHTML = `<i class="fa-solid fa-spinner fa-spin"></i> Verifying Payment...`;
          sessionStorage.setItem('pendingPaymentOrderId', response.razorpay_order_id);

          try {
            // 4. Verify payment signature on backend & activate subscription
            const result: any = await api.post('/payments/verify', {
              razorpay_payment_id: response.razorpay_payment_id,
              razorpay_order_id: response.razorpay_order_id,
              razorpay_signature: response.razorpay_signature,
              mealPlanId: actualPlanId,
              durationDays: selectedDays,
            });

            const isVerified = result && result.success === true && result.verified === true && Boolean(result.subscription || result.payment);

            if (isVerified) {
              sessionStorage.removeItem('pendingPaymentOrderId');
              showToast('Payment verified successfully! Your subscription is now ACTIVE 🎉', 'success');
              navigate('#/student/dashboard');
            } else {
              startBoundedStatusPolling(response.razorpay_order_id);
            }
          } catch (verifyErr: any) {
            startBoundedStatusPolling(response.razorpay_order_id);
          }
        },
        modal: {
          ondismiss: function () {
            if (!paymentAttempted) {
              showToast('Payment window closed.', 'info');
              resetPayBtns();
            } else {
              setConfirmationPendingState(order.id);
              pollStatus(order.id, false);
            }
          },
        },
      };

      try {
        const rzp = new (window as any).Razorpay(options);
        rzp.open();
      } catch (err: any) {
        showToast('Unable to open Razorpay payment window.', 'error');
        resetPayBtns();
      }
    } catch (err: any) {
      showToast(err.message || 'Failed to initiate payment', 'error');
      resetPayBtns();
    }
  });
}
