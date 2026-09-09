import { Html5Qrcode, Html5QrcodeSupportedFormats } from 'html5-qrcode';
import { scanMealCheckIn } from '../api';
import { escapeHtml } from '../utils/sanitize';

let activeScanner: Html5Qrcode | null = null;
let isScanning = false;

/**
 * Opens the interactive camera modal to scan a mess provider's meal QR code.
 */
export async function openMealScanner(onSuccess?: () => void): Promise<void> {
  // Remove existing modal if any
  const existingModal = document.getElementById('primeMealScannerModal');
  if (existingModal) {
    existingModal.remove();
  }

  const modal = document.createElement('div');
  modal.id = 'primeMealScannerModal';
  modal.style.cssText = `
    position: fixed;
    top: 0;
    left: 0;
    right: 0;
    bottom: 0;
    background: rgba(15, 23, 42, 0.85);
    backdrop-filter: blur(8px);
    z-index: 99999;
    display: flex;
    align-items: center;
    justify-content: center;
    padding: 16px;
    animation: scannerFadeIn 0.2s ease-out;
  `;

  modal.innerHTML = `
    <div id="scannerCard" style="
      background: #ffffff;
      border-radius: 28px;
      max-width: 440px;
      width: 100%;
      overflow: hidden;
      box-shadow: 0 25px 50px -12px rgba(0, 0, 0, 0.35);
      display: flex;
      flex-direction: column;
      position: relative;
    ">
      <!-- Modal Header -->
      <div style="
        display: flex;
        justify-content: space-between;
        align-items: center;
        padding: 20px 24px 16px;
        border-bottom: 1px solid var(--color-neutral-100);
      ">
        <div style="display: flex; align-items: center; gap: 10px;">
          <div style="
            width: 40px;
            height: 40px;
            border-radius: 12px;
            background: var(--color-primary-50);
            color: var(--color-primary-600);
            display: flex;
            align-items: center;
            justify-content: center;
            font-size: 18px;
          ">
            <i class="fa-solid fa-camera"></i>
          </div>
          <div>
            <h3 style="font-size: 18px; font-weight: 800; color: var(--color-neutral-900); margin: 0;">Scan Meal QR</h3>
            <span style="font-size: 12px; color: var(--color-neutral-500);">PrimePlate Daily Check-in</span>
          </div>
        </div>
        <button id="closeScannerModalBtn" type="button" style="
          background: var(--color-neutral-100);
          border: none;
          width: 36px;
          height: 36px;
          border-radius: 50%;
          font-size: 16px;
          color: var(--color-neutral-600);
          cursor: pointer;
          display: flex;
          align-items: center;
          justify-content: center;
          transition: background 0.15s ease;
        " aria-label="Close Scanner">
          <i class="fa-solid fa-xmark"></i>
        </button>
      </div>

      <!-- Main Body View Container -->
      <div id="scannerModalBody" style="padding: 20px 24px 24px; display: flex; flex-direction: column; align-items: center;">
        
        <!-- Instructions -->
        <p id="scannerInstructionText" style="
          font-size: 13px;
          color: var(--color-neutral-600);
          text-align: center;
          margin: 0 0 16px 0;
        ">
          Point your camera at the provider's physical QR code displayed at the mess.
        </p>

        <!-- Viewfinder Viewport -->
        <div id="scannerReaderWrapper" style="
          position: relative;
          width: 100%;
          aspect-ratio: 1;
          max-width: 320px;
          border-radius: 20px;
          overflow: hidden;
          background: #0f172a;
          box-shadow: inset 0 0 20px rgba(0,0,0,0.5);
          display: flex;
          align-items: center;
          justify-content: center;
        ">
          <div id="html5qr-reader" style="width: 100%; height: 100%;"></div>

          <!-- Scanner Reticle Corners -->
          <div id="scannerReticle" style="
            position: absolute;
            top: 20px; left: 20px; right: 20px; bottom: 20px;
            border: 2px dashed rgba(234, 88, 12, 0.75);
            border-radius: 16px;
            pointer-events: none;
            box-shadow: 0 0 0 9999px rgba(0, 0, 0, 0.25);
          "></div>
        </div>

        <!-- Camera Status / Error Alert Container -->
        <div id="scannerStatusBox" style="width: 100%; margin-top: 16px; display: none;"></div>
      </div>
    </div>
  `;

  document.body.appendChild(modal);

  const cleanupScanner = async () => {
    if (activeScanner && isScanning) {
      try {
        await activeScanner.stop();
        activeScanner.clear();
      } catch (_) {
        // Safe tear down
      }
    }
    activeScanner = null;
    isScanning = false;
    modal.remove();
  };

  document.getElementById('closeScannerModalBtn')?.addEventListener('click', cleanupScanner);
  modal.addEventListener('click', (e) => {
    if (e.target === modal) cleanupScanner();
  });

  // Start Scanner Engine
  await initCameraScanner(cleanupScanner, onSuccess);
}

async function initCameraScanner(cleanup: () => Promise<void>, onSuccess?: () => void): Promise<void> {
  const readerElement = document.getElementById('html5qr-reader');
  if (!readerElement) return;

  try {
    const scanner = new Html5Qrcode('html5qr-reader', {
      formatsToSupport: [Html5QrcodeSupportedFormats.QR_CODE],
      verbose: false,
    });
    activeScanner = scanner;

    const qrCodeSuccessCallback = async (decodedText: string) => {
      if (!isScanning) return;
      isScanning = false;

      // Stop camera feed upon reading QR
      try {
        await scanner.stop();
      } catch (_) {}

      renderProcessingState();
      await handleScanSubmission(decodedText, cleanup, onSuccess);
    };

    const config = {
      fps: 10,
      qrbox: { width: 250, height: 250 },
      aspectRatio: 1.0,
    };

    // Prefer environment facing camera (mobile back camera)
    try {
      await scanner.start(
        { facingMode: 'environment' },
        config,
        qrCodeSuccessCallback,
        () => {}, // Ignore frame errors
      );
      isScanning = true;
    } catch (facingErr: any) {
      // Fallback to default available video device (e.g. desktop webcam)
      const cameras = await Html5Qrcode.getCameras();
      if (cameras && cameras.length > 0) {
        await scanner.start(
          cameras[0].id,
          config,
          qrCodeSuccessCallback,
          () => {},
        );
        isScanning = true;
      } else {
        throw facingErr;
      }
    }
  } catch (err: any) {
    isScanning = false;
    renderPermissionError(err?.message || 'Camera access error', cleanup, onSuccess);
  }
}

function renderPermissionError(errMsg: string, cleanup: () => Promise<void>, onSuccess?: () => void) {
  const modalBody = document.getElementById('scannerModalBody');
  if (!modalBody) return;

  const isDenied = errMsg.toLowerCase().includes('denied') || errMsg.toLowerCase().includes('notallowed');

  modalBody.innerHTML = `
    <div style="text-align: center; padding: 24px 8px;">
      <div style="
        width: 64px;
        height: 64px;
        border-radius: 20px;
        background: #fee2e2;
        color: #dc2626;
        display: flex;
        align-items: center;
        justify-content: center;
        font-size: 28px;
        margin: 0 auto 16px;
      ">
        <i class="fa-solid fa-video-slash"></i>
      </div>
      <h3 style="font-size: 18px; font-weight: 800; color: var(--color-neutral-900); margin: 0 0 8px 0;">
        ${isDenied ? 'Camera Access Denied' : 'Camera Unavailable'}
      </h3>
      <p style="font-size: 14px; color: var(--color-neutral-600); margin: 0 0 24px 0; line-height: 1.5;">
        Camera access is needed to scan the meal QR. Please allow camera permissions in your browser and try again.
      </p>
      <div style="display: flex; gap: 12px; justify-content: center;">
        <button id="closeErrBtn" class="btn-outline-action" style="padding: 10px 20px;">Close</button>
        <button id="retryCameraBtn" class="btn-primary-action" style="padding: 10px 24px;">
          <i class="fa-solid fa-arrows-rotate"></i> Try Again
        </button>
      </div>
    </div>
  `;

  document.getElementById('closeErrBtn')?.addEventListener('click', cleanup);
  document.getElementById('retryCameraBtn')?.addEventListener('click', () => {
    openMealScanner(onSuccess);
  });
}

function renderProcessingState() {
  const modalBody = document.getElementById('scannerModalBody');
  if (!modalBody) return;

  modalBody.innerHTML = `
    <div style="text-align: center; padding: 48px 16px;">
      <div style="
        width: 60px;
        height: 60px;
        border-radius: 50%;
        background: var(--color-primary-50);
        color: var(--color-primary-600);
        display: flex;
        align-items: center;
        justify-content: center;
        font-size: 26px;
        margin: 0 auto 20px;
      ">
        <i class="fa-solid fa-spinner fa-spin"></i>
      </div>
      <h3 style="font-size: 18px; font-weight: 800; color: var(--color-neutral-900); margin: 0 0 6px 0;">
        Verifying Meal Pass...
      </h3>
      <p style="font-size: 13px; color: var(--color-neutral-500); margin: 0;">
        Checking active subscription with your mess.
      </p>
    </div>
  `;
}

async function handleScanSubmission(qrToken: string, cleanup: () => Promise<void>, onSuccess?: () => void) {
  const modalBody = document.getElementById('scannerModalBody');
  if (!modalBody) return;

  try {
    const res: any = await scanMealCheckIn(qrToken);

    if (res?.code === 'CHECKED_IN') {
      // 1. First scan success
      modalBody.innerHTML = `
        <div style="text-align: center; padding: 24px 8px;">
          <div style="
            width: 72px;
            height: 72px;
            border-radius: 24px;
            background: #dcfce7;
            color: #16a34a;
            display: flex;
            align-items: center;
            justify-content: center;
            font-size: 36px;
            margin: 0 auto 16px;
            box-shadow: 0 10px 25px -5px rgba(22, 163, 74, 0.3);
          ">
            🍱
          </div>
          <h3 style="font-size: 22px; font-weight: 800; color: var(--color-neutral-900); margin: 0 0 6px 0;">
            Meal Checked In!
          </h3>
          <p style="font-size: 14px; color: var(--color-neutral-600); margin: 0 0 20px 0;">
            Your meal for today has been recorded.
          </p>

          <div style="
            background: var(--color-neutral-50);
            border: 1px solid var(--color-neutral-200);
            border-radius: 16px;
            padding: 16px;
            margin-bottom: 20px;
            text-align: left;
            display: flex;
            flex-direction: column;
            gap: 10px;
          ">
            <div style="display: flex; justify-content: space-between; font-size: 13px;">
              <span style="color: var(--color-neutral-500);">Status:</span>
              <strong style="color: #16a34a;"><i class="fa-solid fa-circle-check"></i> Meal Used</strong>
            </div>
            <div style="display: flex; justify-content: space-between; font-size: 13px;">
              <span style="color: var(--color-neutral-500);">Checked in at:</span>
              <strong style="color: var(--color-neutral-900);">${escapeHtml(res.checkedInAt || 'Just now')}</strong>
            </div>
            ${res.providerName ? `
              <div style="display: flex; justify-content: space-between; font-size: 13px;">
                <span style="color: var(--color-neutral-500);">Mess:</span>
                <strong style="color: var(--color-neutral-900);">${escapeHtml(res.providerName)}</strong>
              </div>
            ` : ''}
          </div>

          <p style="font-size: 13px; color: var(--color-primary-700); font-weight: 600; margin: 0 0 24px 0;">
            You're all set for today. Enjoy your meal!
          </p>

          <button id="scannerSuccessDoneBtn" class="btn-primary-action" style="width: 100%; justify-content: center; padding: 12px; font-size: 15px; font-weight: 700;">
            Done
          </button>
        </div>
      `;

      document.getElementById('scannerSuccessDoneBtn')?.addEventListener('click', async () => {
        await cleanup();
        if (onSuccess) onSuccess();
      });

    } else if (res?.code === 'ALREADY_CHECKED_IN') {
      // 2. Already checked in today
      modalBody.innerHTML = `
        <div style="text-align: center; padding: 24px 8px;">
          <div style="
            width: 72px;
            height: 72px;
            border-radius: 24px;
            background: #e0f2fe;
            color: #0284c7;
            display: flex;
            align-items: center;
            justify-content: center;
            font-size: 34px;
            margin: 0 auto 16px;
          ">
            ✅
          </div>
          <h3 style="font-size: 22px; font-weight: 800; color: var(--color-neutral-900); margin: 0 0 6px 0;">
            Already Checked In
          </h3>
          <p style="font-size: 14px; color: var(--color-neutral-600); margin: 0 0 20px 0;">
            Your meal for today is already recorded.
          </p>

          <div style="
            background: var(--color-neutral-50);
            border: 1px solid var(--color-neutral-200);
            border-radius: 16px;
            padding: 16px;
            margin-bottom: 20px;
            text-align: left;
            display: flex;
            flex-direction: column;
            gap: 10px;
          ">
            <div style="display: flex; justify-content: space-between; font-size: 13px;">
              <span style="color: var(--color-neutral-500);">Checked in at:</span>
              <strong style="color: var(--color-neutral-900);">${escapeHtml(res.checkedInAt || 'Earlier today')}</strong>
            </div>
            ${res.providerName ? `
              <div style="display: flex; justify-content: space-between; font-size: 13px;">
                <span style="color: var(--color-neutral-500);">Mess:</span>
                <strong style="color: var(--color-neutral-900);">${escapeHtml(res.providerName)}</strong>
              </div>
            ` : ''}
          </div>

          <p style="font-size: 13px; color: var(--color-neutral-600); font-weight: 500; margin: 0 0 24px 0;">
            You're all set for today. Enjoy your meal! 🍱
          </p>

          <button id="scannerAlreadyCloseBtn" class="btn-primary-action" style="width: 100%; justify-content: center; padding: 12px; font-size: 15px; font-weight: 700; background: var(--color-neutral-800);">
            Close
          </button>
        </div>
      `;

      document.getElementById('scannerAlreadyCloseBtn')?.addEventListener('click', async () => {
        await cleanup();
        if (onSuccess) onSuccess();
      });
    }
  } catch (err: any) {
    const errorMsg = err?.message || 'We could not record your check-in. Please try again.';

    modalBody.innerHTML = `
      <div style="text-align: center; padding: 24px 8px;">
        <div style="
          width: 64px;
          height: 64px;
          border-radius: 20px;
          background: #fee2e2;
          color: #dc2626;
          display: flex;
          align-items: center;
          justify-content: center;
          font-size: 28px;
          margin: 0 auto 16px;
        ">
          <i class="fa-solid fa-triangle-exclamation"></i>
        </div>
        <h3 style="font-size: 18px; font-weight: 800; color: var(--color-neutral-900); margin: 0 0 8px 0;">
          Check-in Unsuccessful
        </h3>
        <p style="font-size: 14px; color: var(--color-neutral-700); margin: 0 0 24px 0; line-height: 1.5;">
          ${escapeHtml(errorMsg)}
        </p>

        <div style="display: flex; gap: 12px; justify-content: center;">
          <button id="scannerErrCloseBtn" class="btn-outline-action" style="padding: 10px 20px;">Close</button>
          <button id="scannerErrRetryBtn" class="btn-primary-action" style="padding: 10px 24px;">
            <i class="fa-solid fa-arrows-rotate"></i> Scan Again
          </button>
        </div>
      </div>
    `;

    document.getElementById('scannerErrCloseBtn')?.addEventListener('click', cleanup);
    document.getElementById('scannerErrRetryBtn')?.addEventListener('click', () => {
      openMealScanner(onSuccess);
    });
  }
}
