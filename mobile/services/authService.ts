/**
 * Auth Service — OTP Login via Fast2SMS / Supabase backend.
 */

import { apiClient } from './api';

export interface SendOTPResponse {
  success: boolean;
  message: string;
  dev_otp?: string | null;
}

export interface VerifyOTPResponse {
  success: boolean;
  message: string;
  token: string | null;
}

/**
 * Send OTP to an email address or mobile number.
 */
export async function sendOTP(params: { email?: string; phone?: string }): Promise<SendOTPResponse> {
  try {
    // 70s timeout — Render free plan cold start takes up to 60s
    const res = await apiClient.post('/api/auth/send-otp', params, { timeout: 70000 });
    return res.data;
  } catch (err: any) {
    // If server returned a structured error (4xx), surface it gracefully
    if (err?.response?.data?.message) {
      return { success: false, message: err.response.data.message };
    }
    if (err?.response?.data?.detail) {
      const detail = err.response.data.detail;
      const msg = typeof detail === 'string' ? detail : 'Authentication error. Please try again.';
      return { success: false, message: msg };
    }
    throw err; // real network error — let login.tsx catch it
  }
}

/**
 * Verify the 6-digit OTP.
 */
export async function verifyOTP(params: { email?: string; phone?: string; otp: string }): Promise<VerifyOTPResponse> {
  try {
    const res = await apiClient.post('/api/auth/verify-otp', params, { timeout: 15000 });
    return res.data;
  } catch (err: any) {
    if (err?.response?.data?.message) {
      return { success: false, message: err.response.data.message, token: null };
    }
    throw err;
  }
}
