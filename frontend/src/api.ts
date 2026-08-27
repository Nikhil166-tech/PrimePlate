import axios from 'axios';
import type { AxiosInstance, AxiosResponse, InternalAxiosRequestConfig } from 'axios';

// Strict production API URL validation
const isProd = import.meta.env.PROD;
const rawApiUrl = import.meta.env.VITE_API_URL;

if (isProd && !rawApiUrl) {
  throw new Error('[PRIMEPLATE CONFIG ERROR] VITE_API_URL environment variable is required in production mode!');
}

const apiBaseUrl = rawApiUrl || 'http://127.0.0.1:5000/api/v1';

const api: AxiosInstance = axios.create({
  baseURL: apiBaseUrl,
  timeout: 60000,
});

// Attach JWT access token if present
api.interceptors.request.use((config: InternalAxiosRequestConfig) => {
  const token = localStorage.getItem('accessToken');
  if (token) {
    config.headers.set('Authorization', `Bearer ${token}`);
  }
  return config;
});

// Normalise responses and handle 401 refresh token rotation safely
api.interceptors.response.use(
  (response: AxiosResponse) => {
    return response.data?.data !== undefined ? response.data.data : response.data;
  },
  async (error) => {
    const { response, config } = error;
    const isRefreshEndpoint = config?.url?.includes('/auth/refresh');

    // Handle 401 Unauthorized (expired access token -> attempt refresh token rotation ONCE)
    if (response?.status === 401 && config && !config._retry401 && !isRefreshEndpoint) {
      config._retry401 = true;
      const refreshToken = localStorage.getItem('refreshToken');

      if (refreshToken) {
        try {
          const refreshRes = await axios.post(`${api.defaults.baseURL}/auth/refresh`, { refreshToken });
          const data = refreshRes.data?.data !== undefined ? refreshRes.data.data : refreshRes.data;
          const newAccessToken = data?.accessToken;
          const newRefreshToken = data?.refreshToken;

          if (newAccessToken) {
            localStorage.setItem('accessToken', newAccessToken);
            if (newRefreshToken) {
              localStorage.setItem('refreshToken', newRefreshToken);
            }
            config.headers.set('Authorization', `Bearer ${newAccessToken}`);
            return api(config);
          }
        } catch (_) {
          // Token refresh failed or revoked
        }
      }

      // Clear authentication session if token refresh failed or token is missing
      localStorage.removeItem('accessToken');
      localStorage.removeItem('refreshToken');
      localStorage.removeItem('userRole');
      localStorage.removeItem('userEmail');

      if (!window.location.hash.includes('#/login')) {
        window.location.hash = '#/login';
      }
    } else if (response?.status === 401 && isRefreshEndpoint) {
      // Direct liquidation if /auth/refresh itself returned 401 (prevent infinite loop)
      localStorage.removeItem('accessToken');
      localStorage.removeItem('refreshToken');
      localStorage.removeItem('userRole');
      localStorage.removeItem('userEmail');

      if (!window.location.hash.includes('#/login')) {
        window.location.hash = '#/login';
      }
    }

    const err = {
      success: false,
      message: response?.data?.message || error.message || 'Request failed',
      errors: response?.data?.errors || [],
    };
    return Promise.reject(err);
  },
);

export const createSubscriptionBreak = (

  subscriptionId: string,
  fromDate: string,
  toDate: string,
  reason?: string,
) => api.post('/subscription-breaks', { subscriptionId, fromDate, toDate, reason });

export const getMySubscriptionBreaks = () => api.get('/subscription-breaks/my');

export const getProviderSubscriptionBreaks = (providerId: string) =>
  api.get(`/subscription-breaks/provider/${providerId}`);

export const approveSubscriptionBreak = (requestId: string) =>
  api.patch(`/subscription-breaks/${requestId}/approve`);

export const rejectSubscriptionBreak = (requestId: string) =>
  api.patch(`/subscription-breaks/${requestId}/reject`);

export const updateProviderBreakSettings = async (
  providerId: string,
  subscriptionBreaksEnabled: boolean,
) => {
  try {
    return await api.patch(`/providers/${providerId}/subscription-break-settings`, {
      subscriptionBreaksEnabled,
    });
  } catch (err: any) {
    try {
      return await api.patch(`/subscription-breaks/provider-settings/${providerId}`, {
        subscriptionBreaksEnabled,
      });
    } catch (_) {
      return await api.patch(`/subscription-breaks/provider-settings`, {
        providerId,
        subscriptionBreaksEnabled,
      });
    }
  }
};

export const getProviderEarningsSummary = () => api.get('/payouts/provider/summary');
export const getProviderEarningsHistory = () => api.get('/payouts/provider/history');

export default api;


