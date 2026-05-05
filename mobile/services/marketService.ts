/**
 * Market Service — API calls for Karnataka mandi prices.
 * Uses curated data (immediate) and Data.gov.in API (when key available).
 */

import { apiClient } from './api';

export interface MarketPrice {
  commodity: string;
  commodity_kn: string;
  variety: string;
  district: string;
  market: string;
  min_price: number;
  max_price: number;
  modal_price: number;
}

export interface MarketResponse {
  source: string;
  last_updated: string;
  count: number;
  records: MarketPrice[];
  note?: string;
}

/**
 * Fetch market prices for a district and/or commodity.
 */
export async function getMarketPrices(
  district?: string,
  commodity?: string,
): Promise<MarketResponse> {
  const params: Record<string, string> = {};
  if (district) params.district = district;
  if (commodity) params.commodity = commodity;

  const res = await apiClient.get('/api/market/prices', {
    params,
    timeout: 15000,
  });
  return res.data;
}

/**
 * Fetch list of available commodities.
 */
export async function getCommodities(): Promise<string[]> {
  const res = await apiClient.get('/api/market/commodities', { timeout: 10000 });
  return res.data.commodities || [];
}

/**
 * Format price for display (₹ with comma separator).
 */
export function formatPrice(price: number): string {
  return `₹${price.toLocaleString('en-IN')}`;
}
