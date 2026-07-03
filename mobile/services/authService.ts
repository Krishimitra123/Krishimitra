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
  const res = await apiClient.post('/api/auth/send-otp', params, { timeout: 15000 });
  return res.data;
}

/**
 * Verify the 6-digit OTP.
 */
export async function verifyOTP(params: { email?: string; phone?: string; otp: string }): Promise<VerifyOTPResponse> {
  const res = await apiClient.post('/api/auth/verify-otp', params, { timeout: 10000 });
  return res.data;
}
