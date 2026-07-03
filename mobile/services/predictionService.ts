/**
 * Prediction Service — Lightweight on-device ML prediction engine.
 * Uses simple statistical models: linear regression, weighted scoring,
 * moving averages. When backend ML APIs are ready, swap these functions
 * to call the API instead.
 */

import {
  PRICE_HISTORY,
  YIELD_HISTORY,
  SEASONAL_PERFORMANCE,
  DISEASE_RISKS,
  CROP_FACTORS,
  DASHBOARD_CROPS,
  PRICE_YEARS,
  YIELD_YEARS,
  getCurrentMonth,
  getCurrentSeason,
  type CropInfo,
  type CropFactor,
} from '@/constants/agricultureData';

// ── Types ─────────────────────────────────────────────────────

export interface PricePrediction {
  currentPrice: number;
  lastYearPrice: number;
  predictedPrice: number;
  predictedPeak: number;
  confidence: number;      // 0–1
  trend: 'up' | 'down' | 'stable';
  changePercent: number;
  monthlyForecast: number[];  // Next 6 months
}

export interface YieldPrediction {
  currentYield: number;       // Latest year quintal/hectare
  predictedYield: number;     // Next year prediction
  bestYear: number;           // Year with highest yield
  bestYield: number;          // Highest yield value
  avgYield: number;           // 5-year average
  trend: 'improving' | 'declining' | 'stable';
}

export interface DiseaseRiskResult {
  overallRisk: number;        // 0–100
  riskLevel: 'low' | 'medium' | 'high' | 'critical';
  diseases: { name: string; name_kn: string; risk: number }[];
}

export interface CropComparison {
  cropId: string;
  name_en: string;
  name_kn: string;
  icon: string;
  color: string;
  profitScore: number;        // 0–100
  riskScore: number;          // 0–100
  overallScore: number;       // 0–100
  bubbleSize: number;         // For bubble chart
  avgProfit: number;
}

export interface RevenueEstimate {
  estimatedRevenue: number;
  estimatedCost: number;
  estimatedProfit: number;
  profitMargin: number;       // percentage
  bestHarvestYear: number;
}

// ── Linear Regression ─────────────────────────────────────────

function linearRegression(data: number[]): { slope: number; intercept: number; r2: number } {
  const n = data.length;
  const x = Array.from({ length: n }, (_, i) => i);
  const sumX = x.reduce((a, b) => a + b, 0);
  const sumY = data.reduce((a, b) => a + b, 0);
  const sumXY = x.reduce((a, xi, i) => a + xi * data[i], 0);
  const sumX2 = x.reduce((a, xi) => a + xi * xi, 0);

  const slope = (n * sumXY - sumX * sumY) / (n * sumX2 - sumX * sumX);
  const intercept = (sumY - slope * sumX) / n;

  // R² calculation
  const meanY = sumY / n;
  const ssTotal = data.reduce((a, yi) => a + (yi - meanY) ** 2, 0);
  const ssResidual = data.reduce((a, yi, i) => a + (yi - (slope * i + intercept)) ** 2, 0);
  const r2 = ssTotal > 0 ? 1 - ssResidual / ssTotal : 0;

  return { slope, intercept, r2 };
}

function movingAverage(data: number[], window: number = 3): number[] {
  return data.map((_, i) => {
    const start = Math.max(0, i - window + 1);
    const slice = data.slice(start, i + 1);
    return slice.reduce((a, b) => a + b, 0) / slice.length;
  });
}

// ── Price Prediction ──────────────────────────────────────────

export function predictPrice(cropId: string, forecastMonths: number = 6): PricePrediction {
  const history = PRICE_HISTORY[cropId];
  if (!history || history.length < 2) {
    return {
      currentPrice: 0, lastYearPrice: 0, predictedPrice: 0,
      predictedPeak: 0, confidence: 0, trend: 'stable',
      changePercent: 0, monthlyForecast: [],
    };
  }

  const currentPrice = history[history.length - 1];
  const lastYearPrice = history[history.length - 2];
  const { slope, intercept, r2 } = linearRegression(history);
  const n = history.length;

  // Predict next value
  const predictedPrice = Math.round(slope * n + intercept);

  // Generate monthly forecast with seasonal variation
  const monthlyForecast: number[] = [];
  const seasonalFactors = SEASONAL_PERFORMANCE[cropId] || Array(12).fill(50);
  const currentMonth = getCurrentMonth();

  for (let m = 0; m < forecastMonths; m++) {
    const monthIndex = (currentMonth + m + 1) % 12;
    const seasonFactor = seasonalFactors[monthIndex] / 75; // Normalize around 1.0
    const trendValue = slope * (n + (m + 1) / 12) + intercept;
    // Add some noise for realism
    const noise = 1 + (Math.sin(m * 1.5) * 0.05);
    monthlyForecast.push(Math.round(trendValue * seasonFactor * noise));
  }

  const predictedPeak = Math.max(...monthlyForecast);
  const changePercent = currentPrice > 0
    ? Math.round(((predictedPrice - currentPrice) / currentPrice) * 100)
    : 0;

  return {
    currentPrice,
    lastYearPrice,
    predictedPrice,
    predictedPeak,
    confidence: Math.min(Math.max(r2, 0.3), 0.95),
    trend: changePercent > 3 ? 'up' : changePercent < -3 ? 'down' : 'stable',
    changePercent,
    monthlyForecast,
  };
}

// ── Yield Prediction ──────────────────────────────────────────

export function predictYield(cropId: string): YieldPrediction {
  const history = YIELD_HISTORY[cropId];
  if (!history || history.length < 2) {
    return {
      currentYield: 0, predictedYield: 0,
      bestYear: 0, bestYield: 0, avgYield: 0, trend: 'stable',
    };
  }

  const currentYield = history[history.length - 1];
  const { slope, intercept } = linearRegression(history);
  const n = history.length;

  const predictedYield = Math.round(slope * n + intercept);

  // Best year
  const maxYield = Math.max(...history);
  const bestYearIndex = history.indexOf(maxYield);
  const bestYear = YIELD_YEARS[bestYearIndex];

  // 5-year average
  const last5 = history.slice(-5);
  const avgYield = Math.round(last5.reduce((a, b) => a + b, 0) / last5.length);

  // Trend based on slope relative to mean
  const mean = history.reduce((a, b) => a + b, 0) / n;
  const trendStrength = (slope / mean) * 100;

  return {
    currentYield,
    predictedYield,
    bestYear,
    bestYield: maxYield,
    avgYield,
    trend: trendStrength > 1 ? 'improving' : trendStrength < -1 ? 'declining' : 'stable',
  };
}

// ── Disease Risk Scoring ──────────────────────────────────────

export function scoreDiseaseRisk(
  cropId: string,
  humidity: number = 65,     // percentage
  temperature: number = 28,  // celsius
  rainfall: number = 50,     // mm
): DiseaseRiskResult {
  const cropRisks = DISEASE_RISKS.find(d => d.cropId === cropId);
  if (!cropRisks) {
    return { overallRisk: 20, riskLevel: 'low', diseases: [] };
  }

  // Normalize weather factors to 0–1 scale
  const humidityNorm = Math.min(humidity / 100, 1);
  const tempNorm = Math.min(Math.max((temperature - 15) / 25, 0), 1);
  const rainNorm = Math.min(rainfall / 200, 1);

  const diseases = cropRisks.baseDiseases.map(d => {
    const weatherImpact =
      d.humidityFactor * humidityNorm +
      d.tempFactor * tempNorm +
      d.rainFactor * rainNorm;

    // Risk = base × (1 + weather_impact) / 2, clamped to 0–100
    const risk = Math.min(Math.round(d.baseRisk * (1 + weatherImpact) / 1.5), 100);

    return { name: d.name, name_kn: d.name_kn, risk };
  }).sort((a, b) => b.risk - a.risk);

  const overallRisk = Math.round(diseases.reduce((a, d) => a + d.risk, 0) / diseases.length);

  return {
    overallRisk,
    riskLevel: overallRisk >= 70 ? 'critical' : overallRisk >= 50 ? 'high' : overallRisk >= 30 ? 'medium' : 'low',
    diseases,
  };
}

// ── Crop Comparison ───────────────────────────────────────────

export function compareCrops(cropIds?: string[]): CropComparison[] {
  const ids = cropIds || DASHBOARD_CROPS.map(c => c.id);
  const maxProfit = Math.max(...CROP_FACTORS.map(f => f.avgProfit));

  return ids.map(id => {
    const crop = DASHBOARD_CROPS.find(c => c.id === id);
    const factors = CROP_FACTORS.find(f => f.cropId === id);
    if (!crop || !factors) return null;

    const profitScore = Math.round((factors.avgProfit / maxProfit) * 100);
    const riskScore = Math.round(factors.riskLevel * 10);
    const stabilityScore = factors.marketStability * 10;

    // Overall = 50% profit + 30% stability - 20% risk
    const overallScore = Math.round(
      profitScore * 0.5 + stabilityScore * 0.3 - riskScore * 0.2 + 20
    );

    // Bubble size proportional to profit
    const bubbleSize = Math.max(20, Math.round((factors.avgProfit / maxProfit) * 80));

    return {
      cropId: id,
      name_en: crop.name_en,
      name_kn: crop.name_kn,
      icon: crop.icon,
      color: crop.color,
      profitScore,
      riskScore,
      overallScore: Math.min(overallScore, 100),
      bubbleSize,
      avgProfit: factors.avgProfit,
    };
  }).filter(Boolean) as CropComparison[];
}

// ── Revenue Estimation ────────────────────────────────────────

export function estimateRevenue(cropId: string, hectares: number = 1): RevenueEstimate {
  const price = predictPrice(cropId);
  const yieldPred = predictYield(cropId);
  const factors = CROP_FACTORS.find(f => f.cropId === cropId);

  const estimatedRevenue = Math.round(price.currentPrice * yieldPred.currentYield * hectares);
  // Cost is approximately 40–60% of revenue depending on crop
  const costFactor = factors ? (0.3 + factors.laborIntensity * 0.03 + factors.waterRequirement * 0.02) : 0.5;
  const estimatedCost = Math.round(estimatedRevenue * costFactor);
  const estimatedProfit = estimatedRevenue - estimatedCost;
  const profitMargin = estimatedRevenue > 0 ? Math.round((estimatedProfit / estimatedRevenue) * 100) : 0;

  // Best harvest year based on price × yield
  const priceHist = PRICE_HISTORY[cropId] || [];
  const yieldHist = YIELD_HISTORY[cropId] || [];
  let bestRevenue = 0;
  let bestYear = PRICE_YEARS[PRICE_YEARS.length - 1];

  // Compare overlapping years
  const startYear = Math.max(PRICE_YEARS[0], YIELD_YEARS[0]);
  const endYear = Math.min(PRICE_YEARS[PRICE_YEARS.length - 1], YIELD_YEARS[YIELD_YEARS.length - 1]);

  for (let y = startYear; y <= endYear; y++) {
    const pi = PRICE_YEARS.indexOf(y);
    const yi = YIELD_YEARS.indexOf(y);
    if (pi >= 0 && yi >= 0) {
      const rev = priceHist[pi] * yieldHist[yi];
      if (rev > bestRevenue) {
        bestRevenue = rev;
        bestYear = y;
      }
    }
  }

  return {
    estimatedRevenue,
    estimatedCost,
    estimatedProfit,
    profitMargin,
    bestHarvestYear: bestYear,
  };
}

// ── Get All Dashboard Data ────────────────────────────────────

export interface DashboardData {
  crop: CropInfo;
  price: PricePrediction;
  yield: YieldPrediction;
  diseaseRisk: DiseaseRiskResult;
  revenue: RevenueEstimate;
}

export function getDashboardData(
  cropId: string,
  weather?: { humidity?: number; temperature?: number; rainfall?: number },
): DashboardData | null {
  const crop = DASHBOARD_CROPS.find(c => c.id === cropId);
  if (!crop) return null;

  return {
    crop,
    price: predictPrice(cropId),
    yield: predictYield(cropId),
    diseaseRisk: scoreDiseaseRisk(
      cropId,
      weather?.humidity ?? 65,
      weather?.temperature ?? 28,
      weather?.rainfall ?? 50,
    ),
    revenue: estimateRevenue(cropId),
  };
}
