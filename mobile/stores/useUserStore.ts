/**
 * User Profile Store — Zustand with AsyncStorage persistence.
 * Stores farmer name, district, crops (multiple), and onboarding status.
 */

import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { getZoneForDistrict } from '@/constants/districts';

interface UserProfile {
  farmer_name:   string;
  district:      string;
  primary_crop:  string;
  crops:         string[];
  agro_zone:     number | null;
  is_onboarded:  boolean;
}

interface UserStore extends UserProfile {
  setProfile: (profile: Partial<UserProfile>) => void;
  completeOnboarding: () => void;
  reset: () => void;
}

export const useUserStore = create<UserStore>()(
  persist(
    (set) => ({
      farmer_name: '',
      district: '',
      primary_crop: '',
      crops: [],
      agro_zone: null,
      is_onboarded: false,

      setProfile: (p) =>
        set((s) => {
          const updated = { ...s, ...p };
          // Auto-derive zone when district changes
          if (p.district) {
            updated.agro_zone = getZoneForDistrict(p.district);
          }
          // Sync primary_crop with first crop in array
          if (p.crops && p.crops.length > 0 && !p.primary_crop) {
            updated.primary_crop = p.crops[0];
          }
          return updated;
        }),

      completeOnboarding: () => set({ is_onboarded: true }),

      reset: () =>
        set({
          farmer_name: '',
          district: '',
          primary_crop: '',
          crops: [],
          agro_zone: null,
          is_onboarded: false,
        }),
    }),
    {
      name: 'krishimitra-user',
      storage: createJSONStorage(() => AsyncStorage),
    }
  )
);
