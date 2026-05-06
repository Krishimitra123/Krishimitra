/**
 * User Profile Store — Zustand with AsyncStorage persistence.
 * Stores farmer name, phone, district, crops (multiple), auth + onboarding status.
 */

import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { getZoneForDistrict } from '@/constants/districts';

interface UserProfile {
  farmer_name:   string;
  phone:         string;
  district:      string;
  primary_crop:  string;
  crops:         string[];
  agro_zone:     number | null;
  preferred_language: string;  // 'kn-IN', 'hi-IN', 'ta-IN', etc.
  tts_language:  string;  // 'kn','en','hi','ta','te','ml','mr','bn','gu','pa','od'
  is_authenticated: boolean;
  auth_token:    string;
  is_onboarded:  boolean;
}

interface UserStore extends UserProfile {
  setProfile: (profile: Partial<UserProfile>) => void;
  setLanguage: (lang: string) => void;
  setAuthenticated: (phone: string, token: string) => void;
  completeOnboarding: () => void;
  logout: () => void;
  reset: () => void;
}

export const useUserStore = create<UserStore>()(
  persist(
    (set) => ({
      farmer_name: '',
      phone: '',
      district: '',
      primary_crop: '',
      crops: [],
      agro_zone: null,
      preferred_language: 'kn-IN',
      tts_language: 'kn-IN',
      is_authenticated: false,
      auth_token: '',
      is_onboarded: false,

      setProfile: (p) =>
        set((s) => {
          const updated = { ...s, ...p };
          // Auto-derive zone when district changes
          if (p.district) {
            updated.agro_zone = getZoneForDistrict(p.district);
          }
          if (p.preferred_language) {
            updated.tts_language = p.preferred_language;
          }
          if (p.tts_language) {
            updated.preferred_language = p.tts_language;
          }
          // Sync primary_crop with first crop in array
          if (p.crops && p.crops.length > 0 && !p.primary_crop) {
            updated.primary_crop = p.crops[0];
          }
          return updated;
        }),

      setLanguage: (lang) =>
        set({ preferred_language: lang, tts_language: lang }),

      setAuthenticated: (phone, token) =>
        set({ phone, auth_token: token, is_authenticated: true }),

      completeOnboarding: () => set({ is_onboarded: true }),

      logout: () =>
        set({
          is_authenticated: false,
          auth_token: '',
          phone: '',
        }),

      reset: () =>
        set({
          farmer_name: '',
          phone: '',
          district: '',
          primary_crop: '',
          crops: [],
          agro_zone: null,
          preferred_language: 'kn-IN',
          tts_language: 'kn-IN',
          is_authenticated: false,
          auth_token: '',
          is_onboarded: false,
        }),
    }),
    {
      name: 'krishimitra-user',
      storage: createJSONStorage(() => AsyncStorage),
    }
  )
);
