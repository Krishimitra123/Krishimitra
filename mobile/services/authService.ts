/**
 * Auth Service — OTP Login via Fast2SMS backend.
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
 * Send OTP to a 10-digit Indian mobile number.
 */
export async function sendOTP(phone: string): Promise<SendOTPResponse> {
  const res = await apiClient.post('/api/auth/send-otp', { phone }, { timeout: 15000 });
  return res.data;
}

/**
 * Verify the 6-digit OTP.
 */
export async function verifyOTP(phone: string, otp: string): Promise<VerifyOTPResponse> {
  const res = await apiClient.post('/api/auth/verify-otp', { phone, otp }, { timeout: 10000 });
  return res.data;
}
