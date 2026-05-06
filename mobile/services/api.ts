/**
 * API Service — Axios instance with user context interceptor.
 * All API calls to the KrishiMitra backend go through this client.
 */

import axios from 'axios';
import { useUserStore } from '@/stores/useUserStore';

const API_BASE = process.env.EXPO_PUBLIC_API_BASE_URL || 'http://localhost:8000';

console.log('[API] Base URL:', API_BASE);

export const apiClient = axios.create({
  baseURL: API_BASE,
  timeout: 120000,  // 120s to match backend 90s timeout + overhead
  headers: {
    'Content-Type': 'application/json',
    'Bypass-Tunnel-Reminder': 'true',  // Required for localtunnel
  },
});

// Interceptor: attach user context to every POST request (except auth endpoints)
apiClient.interceptors.request.use((config) => {
  if (config.method === 'post' && !config.url?.includes('/api/auth/')) {
    try {
      const user = useUserStore.getState();
      if (!config.data) config.data = {};
      const preferredLanguage = user.preferred_language || user.tts_language || 'kn-IN';
      config.data.user_context = {
        farmer_name:  user.farmer_name  || 'ರೈತ',
        district:     user.district     || 'Bengaluru Rural',
        primary_crop: user.primary_crop || 'Ragi',
        agro_zone:    user.agro_zone    || 'Southern Dry Zone',
        preferred_language: preferredLanguage,
      };
      // Keep legacy and new language fields in sync for all endpoints.
      if (!config.data.tts_language) {
        config.data.tts_language = preferredLanguage;
      }
      if (!config.data.preferred_language) {
        config.data.preferred_language = preferredLanguage;
      }
    } catch (e) {
      // User store not ready — continue without context
    }
  }
  return config;
});

// Response interceptor: log errors in development
apiClient.interceptors.response.use(
  (response) => response,
  (error) => {
    if (__DEV__) {
      if (error?.response) {
        // Server responded with error status
        console.error('[API Error]', {
          status: error.response.status,
          message: error.message,
          data: error.response.data,
        });
      } else if (error?.request) {
        // Request was made but no response received (network issue)
        console.error('[API NetworkError] No response from server:', {
          baseURL: error.config?.baseURL,
          url: error.config?.url,
          code: error.code,
          message: error.message,
        });
      } else {
        // Something else happened
        console.error('[API Error]', error?.message);
      }
    }
    return Promise.reject(error);
  }
);
