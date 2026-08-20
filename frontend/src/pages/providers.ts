import api from '../api';
import { navigate } from '../router';
import { renderNavbar, attachNavbarEvents } from '../components/navbar';
import { escapeHtml, getSafeImageUrl } from '../utils/sanitize';
import { showToast } from '../components/toast';

export async function renderProviders() {
  const container = document.getElementById('app')!;

  container.innerHTML = `
    ${renderNavbar()}
    <main class="main-content" style="padding-top: 88px; padding-bottom: 60px;">
      <div style="max-width: 1280px; margin: 0 auto; padding: 0 16px;">
        <div style="margin-bottom: 24px;">
          <h1 class="font-display" style="font-size: clamp(1.75rem, 4vw, 2.25rem); font-weight: 800; color: var(--color-neutral-900); margin-bottom: 8px;">Browse Hostels & Messes</h1>
          <p style="color: var(--color-neutral-600); font-size: clamp(0.9rem, 2vw, 1rem);">Find verified meal subscriptions near your location with daily fresh delivery</p>
        </div>

        <div class="filter-container">
          <div style="display: flex; flex-wrap: wrap; gap: 12px; align-items: center;">
            <div style="flex: 2 1 200px;">
              <input type="text" id="searchInput" class="btn-outline-action" style="width: 100%; text-align: left; background: #fff;" placeholder="🔍 Search mess by name, city, or area..." />
            </div>
            <div style="flex: 1 1 130px;">
              <select id="citySelect" class="btn-outline-action" style="width: 100%; text-align: left; background: #fff;">
                <option value="">All Cities</option>
                <option value="Bangalore">Bangalore</option>
                <option value="Hyderabad">Hyderabad</option>
                <option value="Delhi NCR">Delhi NCR</option>
              </select>
            </div>
            <div style="flex: 1 1 130px;">
              <select id="typeSelect" class="btn-outline-action" style="width: 100%; text-align: left; background: #fff;">
                <option value="">All Food Types</option>
                <option value="Veg">Veg</option>
                <option value="Non Veg">Non Veg</option>
                <option value="South Indian">South Indian</option>
                <option value="North Indian">North Indian</option>
              </select>
            </div>
            <div style="display: flex; gap: 8px; flex: 1.5 1 220px;">
              <button id="findNearMeBtn" class="btn-primary-action" style="padding: 10px 14px; font-size: 13px; font-weight: 700; background: var(--color-primary-600); border-radius: 10px; flex: 1; display: inline-flex; align-items: center; justify-content: center; gap: 6px; white-space: nowrap;">
                <i class="fa-solid fa-crosshairs"></i> 📍 Find Near Me
              </button>
              <select id="radiusSelect" class="btn-outline-action" style="background: #fff; padding: 10px 8px; font-size: 13px; border-radius: 10px; width: 90px;" title="Search Radius">
                <option value="5">5 km</option>
                <option value="10">10 km</option>
                <option value="15">15 km</option>
                <option value="25">25 km</option>
              </select>
            </div>
          </div>
        </div>

        <div id="browseGrid" style="display: grid; grid-template-columns: repeat(auto-fill, minmax(280px, 1fr)); gap: 20px;">
          <div style="grid-column: 1/-1; text-align: center; padding: 60px;">
            <i class="fa-solid fa-spinner fa-spin fa-2x" style="color: var(--color-primary-600);"></i>
            <p style="margin-top: 12px; color: var(--color-neutral-600);">Loading partner messes...</p>
          </div>
        </div>
      </div>
    </main>

    <footer class="footer">
      © ${new Date().getFullYear()} PrimePlate. Premium Meal Subscription Platform.
    </footer>
  `;

  attachNavbarEvents();

  const grid = document.getElementById('browseGrid')!;
  const searchInput = document.getElementById('searchInput') as HTMLInputElement;
  const citySelect = document.getElementById('citySelect') as HTMLSelectElement;
  const typeSelect = document.getElementById('typeSelect') as HTMLSelectElement;

  let hostels: any[] = [];

  const renderCards = (items: any[]) => {
    if (!items || items.length === 0) {
      grid.innerHTML = `
        <div style="grid-column: 1/-1; background: #fff; border: 1px solid var(--color-neutral-200); border-radius: 24px; text-align: center; padding: 60px;">
          <i class="fa-solid fa-utensils" style="font-size: 44px; color: var(--color-neutral-400); margin-bottom: 16px;"></i>
          <h3 class="font-display" style="font-size: 20px; font-weight: 700; margin-bottom: 8px;">No Approved Mess Found</h3>
          <p style="color: var(--color-neutral-500);">No verified kitchen providers match your search filters.</p>
        </div>`;
      return;
    }

    grid.innerHTML = items
      .map((h) => {
        const isClosed = h.acceptingSubscriptions === false;
        const totalCap = h.totalCapacity !== undefined && h.totalCapacity !== null ? Number(h.totalCapacity) : null;
        const currentSubs = Number(h.currentSubscribers) || 0;
        const remainingCap = h.remainingCapacity !== undefined && h.remainingCapacity !== null
          ? Number(h.remainingCapacity)
          : (totalCap !== null ? Math.max(0, totalCap - currentSubs) : null);
        const isFullyBooked = remainingCap !== null && remainingCap <= 0;

        let statusBadge = `<span style="background: #d1fae5; color: #059669; font-size: 11px; font-weight: 700; padding: 2px 8px; border-radius: 999px;">
                            <i class="fa-solid fa-circle-check"></i> ACCEPTING SUBSCRIPTIONS ${remainingCap !== null ? `(${remainingCap} seats left)` : ''}
                           </span>`;
        if (isClosed) {
          statusBadge = `<span style="background: #fee2e2; color: #dc2626; font-size: 11px; font-weight: 700; padding: 2px 8px; border-radius: 999px;">
                          <i class="fa-solid fa-door-closed"></i> CURRENTLY CLOSED
                         </span>`;
        } else if (isFullyBooked) {
          statusBadge = `<span style="background: #fef3c7; color: #d97706; font-size: 11px; font-weight: 700; padding: 2px 8px; border-radius: 999px;">
                          <i class="fa-solid fa-users-slash"></i> FULLY BOOKED
                         </span>`;
        }

        const priceDisplay = h.monthlyPrice !== undefined && h.monthlyPrice !== null
          ? `₹${Number(h.monthlyPrice).toLocaleString('en-IN')}`
          : 'Price Unavailable';

        const ratingDisplay = (h.rating ?? 0) > 0 ? Number(h.rating).toFixed(1) : 'New';

        return `
        <div class="hostel-card" data-id="${h.id}">
          <div class="hostel-card-image">
            <img src="${getSafeImageUrl(h.imageUrl)}" alt="${escapeHtml(h.name)}" />
            <div class="hostel-badge-rating">
              <i class="fa-solid fa-star" style="color: var(--color-accent-500);"></i>
              <span>${ratingDisplay}</span>
            </div>
            <div class="hostel-badge-tag">${escapeHtml(h.category || h.mealType || 'Veg / Non-Veg')}</div>
            <div class="hostel-card-overlay">
              <h3 class="font-display" style="font-size: 18px; font-weight: 700; color: #fff;">${escapeHtml(h.name)}</h3>
              <p style="font-size: 13px; color: rgba(255,255,255,0.85);">
                <i class="fa-solid fa-location-dot"></i> ${escapeHtml(h.address || h.city || '')}
                ${h.distanceKm !== undefined && h.distanceKm !== null ? `<span style="background: rgba(255,255,255,0.25); color: #fff; padding: 2px 8px; border-radius: 999px; font-size: 11px; font-weight: 700; margin-left: 6px;"><i class="fa-solid fa-location-arrow"></i> 📍 ${Number(h.distanceKm).toFixed(1)} km away</span>` : ''}
              </p>
            </div>
          </div>
          <div class="hostel-card-body">
            <div style="margin-bottom: 8px;">
              ${statusBadge}
            </div>
            <p style="font-size: 14px; color: var(--color-neutral-600); margin-bottom: 16px; line-height: 1.5;">${escapeHtml(h.description || 'No description available.')}</p>
            <div style="display: flex; justify-content: space-between; align-items: flex-end; border-top: 1px solid var(--color-neutral-100); padding-top: 16px;">
              <div>
                <span class="price-text">${priceDisplay}</span>
                ${h.monthlyPrice !== undefined && h.monthlyPrice !== null ? '<span style="font-size: 13px; color: var(--color-neutral-500);">/month</span>' : ''}
              </div>
              <button class="btn-primary-action" style="padding: 8px 16px; font-size: 13px;">
                View Details <i class="fa-solid fa-arrow-right"></i>
              </button>
            </div>
          </div>
        </div>
      `;
      })
      .join('');

    grid.querySelectorAll('.hostel-card').forEach((card) => {
      card.addEventListener('click', (e) => {
        const id = (e.currentTarget as HTMLElement).getAttribute('data-id');
        if (id) navigate(`#/providers/${id}`);
      });
    });
  };

  const renderError = (errMsg: string) => {
    grid.innerHTML = `
      <div style="grid-column: 1/-1; background: #fff; border: 1px solid #fee2e2; border-radius: 24px; text-align: center; padding: 60px;">
        <i class="fa-solid fa-triangle-exclamation" style="font-size: 44px; color: #dc2626; margin-bottom: 16px;"></i>
        <h3 class="font-display" style="font-size: 20px; font-weight: 700; color: var(--color-neutral-900); margin-bottom: 8px;">Failed to Load Kitchen Providers</h3>
        <p style="color: var(--color-neutral-600); margin-bottom: 20px; max-width: 460px; margin-left: auto; margin-right: auto;">${escapeHtml(errMsg)}</p>
        <button id="retryProvidersBtn" class="btn-primary-action" style="padding: 10px 24px;">
          <i class="fa-solid fa-rotate-right"></i> Retry Loading
        </button>
      </div>`;

    document.getElementById('retryProvidersBtn')?.addEventListener('click', () => {
      grid.innerHTML = `
        <div style="grid-column: 1/-1; text-align: center; padding: 60px;">
          <i class="fa-solid fa-spinner fa-spin fa-2x" style="color: var(--color-primary-600);"></i>
          <p style="margin-top: 12px; color: var(--color-neutral-600);">Retrying partner messes...</p>
        </div>`;
      fetchHostels();
    });
  };

  const fetchHostels = async () => {
    try {
      const data: any = await api.get('/providers');
      if (Array.isArray(data)) {
        hostels = data;
        renderCards(hostels);
      } else {
        renderError('Unable to parse server response.');
      }
    } catch (err: any) {
      renderError(err.message || 'Server network error while loading provider listings.');
    }
  };

  await fetchHostels();

  const filterAction = () => {
    const query = searchInput.value.toLowerCase().trim();
    const city = citySelect.value;
    const type = typeSelect.value;

    const filtered = hostels.filter((h) => {
      const matchesQuery = !query || h.name?.toLowerCase().includes(query) || (h.city && h.city.toLowerCase().includes(query)) || (h.address && h.address.toLowerCase().includes(query));
      const matchesCity = !city || h.city === city;
      const matchesType = !type || h.category === type || h.mealType === type;
      return matchesQuery && matchesCity && matchesType;
    });

    renderCards(filtered);
  };

  searchInput.addEventListener('input', filterAction);
  citySelect.addEventListener('change', filterAction);
  typeSelect.addEventListener('change', filterAction);

  const findNearMeBtn = document.getElementById('findNearMeBtn') as HTMLButtonElement;
  const radiusSelect = document.getElementById('radiusSelect') as HTMLSelectElement;

  if (findNearMeBtn) {
    findNearMeBtn.addEventListener('click', () => {
      if (!navigator.geolocation) {
        showToast('Location services are not supported by your browser.', 'error');
        return;
      }

      const radVal = radiusSelect ? parseFloat(radiusSelect.value) || 5 : 5;
      findNearMeBtn.disabled = true;
      findNearMeBtn.innerHTML = `<i class="fa-solid fa-spinner fa-spin"></i> Locating...`;

      navigator.geolocation.getCurrentPosition(
        async (pos) => {
          try {
            const lat = pos.coords.latitude;
            const lng = pos.coords.longitude;
            const data: any = await api.get(`/providers/nearby?lat=${lat}&lng=${lng}&radius=${radVal}`);
            const items = Array.isArray(data) ? data : [];
            findNearMeBtn.disabled = false;
            findNearMeBtn.innerHTML = `<i class="fa-solid fa-crosshairs"></i> 📍 Find Near Me`;

            hostels = items;
            renderCards(hostels);
            showToast(`Found ${items.length} approved mess provider(s) within ${radVal} km`, 'success');
          } catch (err: any) {
            findNearMeBtn.disabled = false;
            findNearMeBtn.innerHTML = `<i class="fa-solid fa-crosshairs"></i> 📍 Find Near Me`;
            showToast('Unable to fetch nearby messes. Please try manual search.', 'error');
          }
        },
        (err) => {
          findNearMeBtn.disabled = false;
          findNearMeBtn.innerHTML = `<i class="fa-solid fa-crosshairs"></i> 📍 Find Near Me`;
          let userMsg = "We couldn't access your location. You can search by city or area below.";
          if (err.code === err.PERMISSION_DENIED) {
            userMsg = "Location permission denied. You can search by city or area below.";
          }
          showToast(userMsg, 'error');
        },
        { enableHighAccuracy: true, timeout: 10000, maximumAge: 0 }
      );
    });
  }
}
