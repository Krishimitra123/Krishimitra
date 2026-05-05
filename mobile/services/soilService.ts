/**
 * Soil Service — API calls for soil data.
 * Combines SoilGrids ISRIC (global) with Karnataka zone data (local).
 */

import { apiClient } from './api';

export interface SoilProperty {
  unit: string;
  depths: Record<string, number>;
}

export interface ZoneData {
  zone_id: number;
  zone_name: string;
  districts: string[];
  dominant_soil_type: string;
  soil_texture: string;
  typical_pH_range: { min: number; max: number };
  key_deficiencies: string[];
  primary_crops: string[];
  organic_matter_typical: string;
  notes: string;
}

export interface SoilResponse {
  district: string;
  latitude: number;
  longitude: number;
  soilgrids_data: Record<string, SoilProperty>;
  karnataka_zone: ZoneData | Record<string, never>;
  organic_recommendations: string[];
  source: string;
}

/**
 * Fetch soil data for a Karnataka district.
 */
export async function getSoilData(district: string): Promise<SoilResponse> {
  const res = await apiClient.get('/api/soil', {
    params: { district },
    timeout: 20000,
  });
  return res.data;
}

/**
 * Fetch zone data by zone ID.
 */
export async function getZoneData(zoneId: number): Promise<ZoneData> {
  const res = await apiClient.get(`/api/soil/zone/${zoneId}`, { timeout: 10000 });
  return res.data;
}

/**
 * Map deficiency codes to human-readable Kannada labels.
 */
export function getDeficiencyLabel(code: string): { en: string; kn: string; icon: string } {
  const map: Record<string, { en: string; kn: string; icon: string }> = {
    'N':  { en: 'Nitrogen',    kn: 'ಸಾರಜನಕ',   icon: '🌿' },
    'P':  { en: 'Phosphorus',  kn: 'ರಂಜಕ',      icon: '🔴' },
    'K':  { en: 'Potassium',   kn: 'ಪೊಟ್ಯಾಶಿಯಂ', icon: '🟡' },
    'Zn': { en: 'Zinc',        kn: 'ಸತುವು',     icon: '⚪' },
    'Fe': { en: 'Iron',        kn: 'ಕಬ್ಬಿಣ',     icon: '🟤' },
    'B':  { en: 'Boron',       kn: 'ಬೋರಾನ್',    icon: '🔵' },
    'S':  { en: 'Sulphur',     kn: 'ಗಂಧಕ',      icon: '🟠' },
    'Ca': { en: 'Calcium',     kn: 'ಕ್ಯಾಲ್ಸಿಯಂ', icon: '⬜' },
  };
  return map[code] || { en: code, kn: code, icon: '❓' };
}
