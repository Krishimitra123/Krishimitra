/**
 * Karnataka Agriculture Data — Realistic dataset for ML predictions.
 * Covers 8 major crops with historical prices, yields, seasonal patterns.
 * Data patterns based on Karnataka agriculture statistics.
 */

// ── Crop Metadata ─────────────────────────────────────────────
export interface CropInfo {
  id: string;
  name_en: string;
  name_kn: string;
  icon: string;
  category: string;
  color: string;           // Chart line color
  season: 'kharif' | 'rabi' | 'both';
  growingMonths: number;   // Months from sowing to harvest
  waterNeed: 'low' | 'medium' | 'high';
}

export const DASHBOARD_CROPS: CropInfo[] = [
  { id: 'potato',    name_en: 'Potato',     name_kn: 'ಆಲೂಗಡ್ಡೆ',      icon: '🥔', category: 'vegetable',    color: '#8B4513', season: 'rabi',   growingMonths: 4, waterNeed: 'medium' },
  { id: 'ginger',    name_en: 'Ginger',     name_kn: 'ಶುಂಠಿ',         icon: '🫚', category: 'spice',        color: '#DAA520', season: 'kharif', growingMonths: 8, waterNeed: 'high' },
  { id: 'sugarcane', name_en: 'Sugarcane',   name_kn: 'ಕಬ್ಬು',          icon: '🎋', category: 'commercial',   color: '#228B22', season: 'both',   growingMonths: 12, waterNeed: 'high' },
  { id: 'ragi',      name_en: 'Ragi',       name_kn: 'ರಾಗಿ',          icon: '🌾', category: 'cereal',       color: '#CD853F', season: 'kharif', growingMonths: 4, waterNeed: 'low' },
  { id: 'tomato',    name_en: 'Tomato',     name_kn: 'ಟೊಮ್ಯಾಟೊ',       icon: '🍅', category: 'vegetable',    color: '#DC143C', season: 'both',   growingMonths: 3, waterNeed: 'medium' },
  { id: 'onion',     name_en: 'Onion',      name_kn: 'ಈರುಳ್ಳಿ',        icon: '🧅', category: 'vegetable',    color: '#B22222', season: 'rabi',   growingMonths: 5, waterNeed: 'medium' },
  { id: 'arecanut',  name_en: 'Areca Nut',  name_kn: 'ಅಡಿಕೆ',         icon: '🌴', category: 'plantation',   color: '#2E8B57', season: 'both',   growingMonths: 48, waterNeed: 'high' },
  { id: 'paddy',     name_en: 'Paddy',      name_kn: 'ಭತ್ತ',          icon: '🌾', category: 'cereal',       color: '#6B8E23', season: 'kharif', growingMonths: 5, waterNeed: 'high' },
];

// ── Historical Price Data (₹ per quintal, 2018–2025) ──────────
// Realistic price ranges for Karnataka mandis
export const PRICE_HISTORY: Record<string, number[]> = {
  // Year:    2018    2019    2020    2021    2022    2023    2024    2025
  potato:    [1200,  1450,   980,   1680,  1520,  1890,  2100,  1950],
  ginger:    [8500,  12000, 15000, 11000, 18000, 22000, 19500, 24000],
  sugarcane: [2750,  2900,  3100,  3200,  3400,  3550,  3700,  3850],
  ragi:      [2897,  3150,  3295,  3377,  3578,  3846,  4050,  4290],
  tomato:    [800,   1200,  2500,  1800,  3200,  1500,  2800,  2200],
  onion:     [1000,  2800,  1200,  1800,  2400,  3500,  1600,  2900],
  arecanut:  [32000, 35000, 38000, 42000, 45000, 48000, 52000, 55000],
  paddy:     [1750,  1815,  1868,  1940,  2040,  2183,  2300,  2420],
};

// ── Historical Yield Data (quintals/hectare, 2014–2024) ───────
export const YIELD_HISTORY: Record<string, number[]> = {
  // Year:    2014   2015   2016   2017   2018   2019   2020   2021   2022   2023   2024
  potato:    [180,   195,   210,   185,   220,   205,   230,   240,   225,   250,   245],
  ginger:    [45,    52,    48,    55,    58,    50,    62,    65,    60,    68,    72],
  sugarcane: [780,   820,   850,   810,   870,   900,   880,   920,   950,   940,   970],
  ragi:      [18,    20,    22,    19,    24,    21,    25,    27,    23,    28,    30],
  tomato:    [250,   280,   260,   300,   270,   310,   290,   320,   340,   330,   350],
  onion:     [160,   175,   165,   180,   190,   170,   200,   195,   210,   205,   220],
  arecanut:  [15,    16,    17,    16,    18,    19,    18,    20,    21,    20,    22],
  paddy:     [35,    38,    40,    37,    42,    39,    44,    43,    46,    45,    48],
};

// ── Monthly Seasonal Performance (0–100 score per month) ──────
// Used for heatmap: how well each crop performs if planted/active in that month
export const SEASONAL_PERFORMANCE: Record<string, number[]> = {
  // Month:    Jan  Feb  Mar  Apr  May  Jun  Jul  Aug  Sep  Oct  Nov  Dec
  potato:    [ 75,  80,  60,  30,  15,  20,  40,  55,  85,  90,  88,  82],
  ginger:    [ 20,  25,  30,  45,  70,  90,  95,  85,  75,  60,  40,  25],
  sugarcane: [ 70,  75,  80,  65,  55,  60,  70,  75,  80,  85,  80,  72],
  ragi:      [ 25,  20,  15,  30,  60,  85,  95,  90,  80,  65,  35,  20],
  tomato:    [ 80,  85,  70,  45,  30,  35,  50,  65,  80,  90,  88,  82],
  onion:     [ 85,  90,  80,  55,  25,  15,  20,  30,  50,  70,  80,  85],
  arecanut:  [ 65,  60,  55,  60,  70,  80,  85,  90,  85,  75,  70,  65],
  paddy:     [ 20,  15,  10,  25,  50,  80,  95,  90,  85,  70,  40,  25],
};

// ── Disease Risk Factors ──────────────────────────────────────
// Base risk (0–100) adjusted by weather conditions
export interface DiseaseRisk {
  cropId: string;
  baseDiseases: { name: string; name_kn: string; baseRisk: number; humidityFactor: number; tempFactor: number; rainFactor: number }[];
}

export const DISEASE_RISKS: DiseaseRisk[] = [
  {
    cropId: 'potato',
    baseDiseases: [
      { name: 'Late Blight',      name_kn: 'ತಡವಾದ ಅಂಗಮಾರಿ',   baseRisk: 35, humidityFactor: 0.8, tempFactor: -0.3, rainFactor: 0.7 },
      { name: 'Early Blight',     name_kn: 'ಮೊದಲ ಅಂಗಮಾರಿ',    baseRisk: 30, humidityFactor: 0.6, tempFactor: 0.4, rainFactor: 0.5 },
      { name: 'Black Scurf',      name_kn: 'ಕಪ್ಪು ಹುರುಪೆ',     baseRisk: 20, humidityFactor: 0.5, tempFactor: -0.2, rainFactor: 0.3 },
    ],
  },
  {
    cropId: 'ginger',
    baseDiseases: [
      { name: 'Soft Rot',         name_kn: 'ಮೃದು ಕೊಳೆ',       baseRisk: 40, humidityFactor: 0.9, tempFactor: 0.3, rainFactor: 0.8 },
      { name: 'Bacterial Wilt',   name_kn: 'ಬ್ಯಾಕ್ಟೀರಿಯಾ ಬಾಡು', baseRisk: 35, humidityFactor: 0.7, tempFactor: 0.5, rainFactor: 0.6 },
      { name: 'Leaf Spot',        name_kn: 'ಎಲೆ ಚುಕ್ಕೆ',       baseRisk: 25, humidityFactor: 0.6, tempFactor: 0.2, rainFactor: 0.4 },
    ],
  },
  {
    cropId: 'sugarcane',
    baseDiseases: [
      { name: 'Red Rot',          name_kn: 'ಕೆಂಪು ಕೊಳೆ',      baseRisk: 30, humidityFactor: 0.7, tempFactor: 0.3, rainFactor: 0.5 },
      { name: 'Smut',             name_kn: 'ಕಿಟ್ಟ ರೋಗ',       baseRisk: 25, humidityFactor: 0.5, tempFactor: 0.4, rainFactor: 0.3 },
      { name: 'Wilt',             name_kn: 'ಬಾಡು ರೋಗ',        baseRisk: 20, humidityFactor: 0.4, tempFactor: 0.5, rainFactor: 0.2 },
    ],
  },
  {
    cropId: 'ragi',
    baseDiseases: [
      { name: 'Blast',            name_kn: 'ಬ್ಲಾಸ್ಟ್ ರೋಗ',     baseRisk: 40, humidityFactor: 0.8, tempFactor: 0.2, rainFactor: 0.7 },
      { name: 'Banded Blight',    name_kn: 'ಪಟ್ಟಿ ಅಂಗಮಾರಿ',   baseRisk: 25, humidityFactor: 0.6, tempFactor: 0.3, rainFactor: 0.5 },
    ],
  },
  {
    cropId: 'tomato',
    baseDiseases: [
      { name: 'Early Blight',     name_kn: 'ಮೊದಲ ಅಂಗಮಾರಿ',    baseRisk: 35, humidityFactor: 0.7, tempFactor: 0.4, rainFactor: 0.5 },
      { name: 'Leaf Curl',        name_kn: 'ಎಲೆ ಮುರುಟು',      baseRisk: 30, humidityFactor: 0.5, tempFactor: 0.6, rainFactor: 0.3 },
      { name: 'Bacterial Wilt',   name_kn: 'ಬ್ಯಾಕ್ಟೀರಿಯಾ ಬಾಡು', baseRisk: 28, humidityFactor: 0.8, tempFactor: 0.4, rainFactor: 0.6 },
    ],
  },
  {
    cropId: 'onion',
    baseDiseases: [
      { name: 'Purple Blotch',    name_kn: 'ನೇರಳೆ ಚುಕ್ಕೆ',    baseRisk: 35, humidityFactor: 0.8, tempFactor: 0.3, rainFactor: 0.6 },
      { name: 'Downy Mildew',     name_kn: 'ಮೃದು ಬೂಷ್ಟು',     baseRisk: 30, humidityFactor: 0.9, tempFactor: -0.2, rainFactor: 0.7 },
    ],
  },
  {
    cropId: 'arecanut',
    baseDiseases: [
      { name: 'Koleroga',         name_kn: 'ಕೊಳೆರೋಗ',        baseRisk: 45, humidityFactor: 0.9, tempFactor: 0.1, rainFactor: 0.9 },
      { name: 'Yellow Leaf',      name_kn: 'ಹಳದಿ ಎಲೆ',       baseRisk: 30, humidityFactor: 0.5, tempFactor: 0.3, rainFactor: 0.4 },
    ],
  },
  {
    cropId: 'paddy',
    baseDiseases: [
      { name: 'Blast',            name_kn: 'ಬ್ಲಾಸ್ಟ್ ರೋಗ',     baseRisk: 38, humidityFactor: 0.8, tempFactor: 0.2, rainFactor: 0.7 },
      { name: 'Sheath Blight',    name_kn: 'ಒರೆ ಅಂಗಮಾರಿ',    baseRisk: 30, humidityFactor: 0.7, tempFactor: 0.4, rainFactor: 0.5 },
      { name: 'Brown Spot',       name_kn: 'ಕಂದು ಚುಕ್ಕೆ',     baseRisk: 25, humidityFactor: 0.6, tempFactor: 0.3, rainFactor: 0.4 },
    ],
  },
];

// ── Crop Comparison Factors ───────────────────────────────────
// Used for bubble chart and multi-factor comparison
export interface CropFactor {
  cropId: string;
  avgProfit: number;         // ₹ per hectare per year (approx)
  laborIntensity: number;    // 1–10
  waterRequirement: number;  // 1–10
  marketStability: number;   // 1–10 (higher = more stable)
  growthCycle: number;       // months
  riskLevel: number;         // 1–10 (higher = riskier)
}

export const CROP_FACTORS: CropFactor[] = [
  { cropId: 'potato',    avgProfit: 85000,   laborIntensity: 6, waterRequirement: 5, marketStability: 5, growthCycle: 4,  riskLevel: 6 },
  { cropId: 'ginger',    avgProfit: 180000,  laborIntensity: 8, waterRequirement: 7, marketStability: 4, growthCycle: 8,  riskLevel: 7 },
  { cropId: 'sugarcane', avgProfit: 120000,  laborIntensity: 7, waterRequirement: 9, marketStability: 8, growthCycle: 12, riskLevel: 4 },
  { cropId: 'ragi',      avgProfit: 35000,   laborIntensity: 4, waterRequirement: 3, marketStability: 8, growthCycle: 4,  riskLevel: 3 },
  { cropId: 'tomato',    avgProfit: 150000,  laborIntensity: 7, waterRequirement: 6, marketStability: 2, growthCycle: 3,  riskLevel: 8 },
  { cropId: 'onion',     avgProfit: 95000,   laborIntensity: 6, waterRequirement: 5, marketStability: 3, growthCycle: 5,  riskLevel: 7 },
  { cropId: 'arecanut',  avgProfit: 250000,  laborIntensity: 5, waterRequirement: 8, marketStability: 7, growthCycle: 48, riskLevel: 5 },
  { cropId: 'paddy',     avgProfit: 45000,   laborIntensity: 7, waterRequirement: 9, marketStability: 9, growthCycle: 5,  riskLevel: 3 },
];

// ── Month Names ───────────────────────────────────────────────
export const MONTHS_EN = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
export const MONTHS_KN = ['ಜನ', 'ಫೆಬ್ರ', 'ಮಾರ್ಚ್', 'ಏಪ್ರಿ', 'ಮೇ', 'ಜೂನ್', 'ಜುಲೈ', 'ಆಗ', 'ಸೆಪ್ಟೆ', 'ಅಕ್ಟೋ', 'ನವೆ', 'ಡಿಸೆ'];

// ── Year Labels ───────────────────────────────────────────────
export const PRICE_YEARS = [2018, 2019, 2020, 2021, 2022, 2023, 2024, 2025];
export const YIELD_YEARS = [2014, 2015, 2016, 2017, 2018, 2019, 2020, 2021, 2022, 2023, 2024];

// ── Farming Seasons ───────────────────────────────────────────
export type FarmingSeason = 'kharif' | 'rabi' | 'summer';

export const SEASON_INFO: Record<FarmingSeason, { name_en: string; name_kn: string; months: string; icon: string }> = {
  kharif: { name_en: 'Kharif',  name_kn: 'ಖಾರಿಫ್',  months: 'Jun–Oct', icon: '🌧️' },
  rabi:   { name_en: 'Rabi',    name_kn: 'ರಬಿ',     months: 'Nov–Mar', icon: '❄️' },
  summer: { name_en: 'Summer',  name_kn: 'ಬೇಸಿಗೆ',   months: 'Mar–May', icon: '☀️' },
};

// ── Soil Types in Karnataka ───────────────────────────────────
export const SOIL_TYPES = [
  { id: 'red',     name_en: 'Red Soil',      name_kn: 'ಕೆಂಪು ಮಣ್ಣು',    icon: '🔴', suitableCrops: ['ragi', 'groundnut', 'potato'] },
  { id: 'black',   name_en: 'Black Soil',    name_kn: 'ಕಪ್ಪು ಮಣ್ಣು',    icon: '⚫', suitableCrops: ['sugarcane', 'cotton', 'onion'] },
  { id: 'laterite',name_en: 'Laterite Soil',  name_kn: 'ಜಂಬಿಟ್ಟಿ ಮಣ್ಣು', icon: '🟤', suitableCrops: ['arecanut', 'paddy', 'ginger'] },
  { id: 'alluvial',name_en: 'Alluvial Soil',  name_kn: 'ಮೆಕ್ಕಲು ಮಣ್ಣು',  icon: '🟡', suitableCrops: ['paddy', 'sugarcane', 'tomato'] },
  { id: 'sandy',   name_en: 'Sandy Soil',    name_kn: 'ಮರಳು ಮಣ್ಣು',    icon: '🏖️', suitableCrops: ['groundnut', 'potato', 'onion'] },
];

// Helper: get crop info by id
export function getCropById(id: string): CropInfo | undefined {
  return DASHBOARD_CROPS.find(c => c.id === id);
}

// Helper: get current month index (0-based)
export function getCurrentMonth(): number {
  return new Date().getMonth();
}

// Helper: get current season
export function getCurrentSeason(): FarmingSeason {
  const m = getCurrentMonth();
  if (m >= 5 && m <= 9) return 'kharif';   // Jun–Oct
  if (m >= 10 || m <= 2) return 'rabi';     // Nov–Mar
  return 'summer';                           // Mar–May
}
