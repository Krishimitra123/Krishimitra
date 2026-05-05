/**
 * Login Screen — OTP-based phone authentication for KrishiMitra.
 * Uses Fast2SMS to send OTP to Indian mobile numbers.
 */

import React, { useState, useRef, useEffect } from 'react';
import {
  View, Text, StyleSheet, TextInput, TouchableOpacity,
  KeyboardAvoidingView, Platform, Alert, ActivityIndicator,
  Animated, Dimensions,
} from 'react-native';
import { useRouter } from 'expo-router';
import { LinearGradient } from 'expo-linear-gradient';
import { Colors, FontSize, Spacing, BorderRadius, Shadows } from '@/constants/theme';
import { useUserStore } from '@/stores/useUserStore';
import { sendOTP, verifyOTP } from '@/services/authService';

const { width } = Dimensions.get('window');

export default function LoginScreen() {
  const router = useRouter();
  const { setAuthenticated } = useUserStore();

  const [step, setStep] = useState<'PHONE' | 'OTP'>('PHONE');
  const [phone, setPhone] = useState('');
  const [otp, setOtp] = useState('');
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState('');
  const [countdown, setCountdown] = useState(0);

  // Animation
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const slideAnim = useRef(new Animated.Value(30)).current;

  useEffect(() => {
    Animated.parallel([
      Animated.timing(fadeAnim, { toValue: 1, duration: 600, useNativeDriver: true }),
      Animated.timing(slideAnim, { toValue: 0, duration: 600, useNativeDriver: true }),
    ]).start();
  }, [step]);

  // Countdown timer for resend
  useEffect(() => {
    if (countdown > 0) {
      const timer = setTimeout(() => setCountdown(countdown - 1), 1000);
      return () => clearTimeout(timer);
    }
  }, [countdown]);

  const handleSendOTP = async () => {
    const cleaned = phone.replace(/\D/g, '');
    if (cleaned.length !== 10) {
      Alert.alert('ದೋಷ', 'ದಯವಿಟ್ಟು 10 ಅಂಕಿಯ ಮೊಬೈಲ್ ಸಂಖ್ಯೆ ನಮೂದಿಸಿ');
      return;
    }

    setLoading(true);
    setMessage('');
    try {
      const result = await sendOTP(cleaned);
      if (result.success) {
        setStep('OTP');
        setCountdown(60);
        setMessage(result.message);
        // In dev mode, auto-fill OTP if returned by backend
        if (result.dev_otp) {
          setOtp(result.dev_otp);
        }
      } else {
        setMessage(result.message);
      }
    } catch (e: any) {
      const detail = e.response?.data?.detail || 'ಸೇವೆ ಲಭ್ಯವಿಲ್ಲ. ದಯವಿಟ್ಟು ಮತ್ತೆ ಪ್ರಯತ್ನಿಸಿ.';
      Alert.alert('ದೋಷ', detail);
    }
    setLoading(false);
  };

  const handleVerifyOTP = async () => {
    if (otp.length !== 6) {
      Alert.alert('ದೋಷ', 'ದಯವಿಟ್ಟು 6 ಅಂಕಿಯ OTP ನಮೂದಿಸಿ');
      return;
    }

    setLoading(true);
    setMessage('');
    try {
      const result = await verifyOTP(phone.replace(/\D/g, ''), otp);
      if (result.success && result.token) {
        setAuthenticated(phone.replace(/\D/g, ''), result.token);
        setMessage('✅ ' + result.message);
        // Navigate to onboarding or tabs
        setTimeout(() => {
          const isOnboarded = useUserStore.getState().is_onboarded;
          if (isOnboarded) {
            router.replace('/(tabs)');
          } else {
            router.replace('/onboarding');
          }
        }, 500);
      } else {
        setMessage(result.message);
      }
    } catch (e: any) {
      const detail = e.response?.data?.detail || 'ಪರಿಶೀಲನೆ ವಿಫಲ';
      Alert.alert('ದೋಷ', detail);
    }
    setLoading(false);
  };

  const handleResend = async () => {
    if (countdown > 0) return;
    setOtp('');
    await handleSendOTP();
  };

  return (
    <LinearGradient colors={[Colors.primaryDark, Colors.primary, Colors.primarySoft]} style={styles.container}>
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={styles.flex}>
        <Animated.View style={[styles.content, { opacity: fadeAnim, transform: [{ translateY: slideAnim }] }]}>

          {/* Logo */}
          <View style={styles.logoSection}>
            <Text style={styles.logoIcon}>🌾</Text>
            <Text style={styles.logoText}>ಕೃಷಿ ಮಿತ್ರ</Text>
            <Text style={styles.logoSubtext}>KrishiMitra</Text>
            <Text style={styles.tagline}>ನಿಮ್ಮ ಜೈವಿಕ ಕೃಷಿ ಸಹಾಯಕ</Text>
          </View>

          {/* Card */}
          <View style={[styles.card, Shadows.lg]}>
            {step === 'PHONE' ? (
              <>
                <Text style={styles.cardTitle}>ಲಾಗಿನ್ / ನೋಂದಣಿ</Text>
                <Text style={styles.cardSubtitle}>ನಿಮ್ಮ ಮೊಬೈಲ್ ಸಂಖ್ಯೆ ನಮೂದಿಸಿ</Text>

                <View style={styles.phoneInputRow}>
                  <View style={styles.countryCode}>
                    <Text style={styles.countryCodeText}>🇮🇳 +91</Text>
                  </View>
                  <TextInput
                    style={styles.phoneInput}
                    placeholder="9876543210"
                    placeholderTextColor={Colors.textMuted}
                    value={phone}
                    onChangeText={(t) => setPhone(t.replace(/\D/g, '').slice(0, 10))}
                    keyboardType="phone-pad"
                    maxLength={10}
                    autoFocus
                  />
                </View>

                <TouchableOpacity
                  style={[styles.primaryBtn, loading && styles.btnDisabled]}
                  onPress={handleSendOTP}
                  disabled={loading}
                >
                  {loading ? (
                    <ActivityIndicator color="#fff" />
                  ) : (
                    <Text style={styles.primaryBtnText}>OTP ಕಳುಹಿಸಿ →</Text>
                  )}
                </TouchableOpacity>
              </>
            ) : (
              <>
                <Text style={styles.cardTitle}>OTP ಪರಿಶೀಲನೆ</Text>
                <Text style={styles.cardSubtitle}>
                  +91 {phone} ಗೆ ಕಳುಹಿಸಲಾದ 6 ಅಂಕಿಯ OTP ನಮೂದಿಸಿ
                </Text>

                <TextInput
                  style={styles.otpInput}
                  placeholder="● ● ● ● ● ●"
                  placeholderTextColor={Colors.textMuted}
                  value={otp}
                  onChangeText={(t) => setOtp(t.replace(/\D/g, '').slice(0, 6))}
                  keyboardType="number-pad"
                  maxLength={6}
                  autoFocus
                  textAlign="center"
                />

                <TouchableOpacity
                  style={[styles.primaryBtn, loading && styles.btnDisabled]}
                  onPress={handleVerifyOTP}
                  disabled={loading}
                >
                  {loading ? (
                    <ActivityIndicator color="#fff" />
                  ) : (
                    <Text style={styles.primaryBtnText}>ಪರಿಶೀಲಿಸಿ ✓</Text>
                  )}
                </TouchableOpacity>

                <TouchableOpacity
                  onPress={handleResend}
                  disabled={countdown > 0}
                  style={styles.resendBtn}
                >
                  <Text style={[styles.resendText, countdown > 0 && styles.resendDisabled]}>
                    {countdown > 0
                      ? `ಮತ್ತೆ ಕಳುಹಿಸಿ (${countdown}s)`
                      : 'OTP ಮತ್ತೆ ಕಳುಹಿಸಿ'}
                  </Text>
                </TouchableOpacity>

                <TouchableOpacity onPress={() => { setStep('PHONE'); setOtp(''); setMessage(''); }}>
                  <Text style={styles.changePhoneText}>← ಬೇರೆ ಸಂಖ್ಯೆ ಬಳಸಿ</Text>
                </TouchableOpacity>
              </>
            )}

            {message ? (
              <Text style={[styles.messageText, message.includes('✅') && styles.successText]}>
                {message}
              </Text>
            ) : null}
          </View>

          {/* Footer */}
          <Text style={styles.footer}>⚡ Powered by Nivetti Systems</Text>
        </Animated.View>
      </KeyboardAvoidingView>
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  flex: { flex: 1 },
  content: { flex: 1, justifyContent: 'center', paddingHorizontal: Spacing.lg },
  logoSection: { alignItems: 'center', marginBottom: Spacing.xl },
  logoIcon: { fontSize: 64, marginBottom: Spacing.sm },
  logoText: { fontSize: 36, fontWeight: '900', color: '#fff', letterSpacing: 1 },
  logoSubtext: { fontSize: FontSize.lg, color: 'rgba(255,255,255,0.8)', fontWeight: '600', marginTop: 2 },
  tagline: { fontSize: FontSize.md, color: 'rgba(255,255,255,0.6)', marginTop: Spacing.xs },
  card: { backgroundColor: Colors.surface, borderRadius: BorderRadius.xl, padding: Spacing.xl },
  cardTitle: { fontSize: FontSize.xl, fontWeight: '800', color: Colors.textPrimary, textAlign: 'center' },
  cardSubtitle: { fontSize: FontSize.sm, color: Colors.textSecondary, textAlign: 'center', marginTop: Spacing.xs, marginBottom: Spacing.lg },
  phoneInputRow: { flexDirection: 'row', alignItems: 'center', borderWidth: 1.5, borderColor: Colors.border, borderRadius: BorderRadius.lg, overflow: 'hidden', marginBottom: Spacing.lg },
  countryCode: { backgroundColor: Colors.primarySoft, paddingHorizontal: Spacing.md, paddingVertical: Spacing.md, borderRightWidth: 1, borderRightColor: Colors.border },
  countryCodeText: { fontSize: FontSize.md, fontWeight: '700', color: Colors.primaryDark },
  phoneInput: { flex: 1, fontSize: FontSize.xl, fontWeight: '700', color: Colors.textPrimary, paddingHorizontal: Spacing.md, paddingVertical: Spacing.md, letterSpacing: 2 },
  otpInput: { fontSize: 32, fontWeight: '800', color: Colors.textPrimary, borderWidth: 1.5, borderColor: Colors.border, borderRadius: BorderRadius.lg, paddingVertical: Spacing.md, paddingHorizontal: Spacing.lg, letterSpacing: 8, marginBottom: Spacing.lg },
  primaryBtn: { backgroundColor: Colors.primary, borderRadius: BorderRadius.lg, paddingVertical: Spacing.md, alignItems: 'center' },
  btnDisabled: { opacity: 0.6 },
  primaryBtnText: { fontSize: FontSize.lg, fontWeight: '700', color: Colors.textOnPrimary },
  resendBtn: { alignItems: 'center', marginTop: Spacing.md },
  resendText: { fontSize: FontSize.md, color: Colors.primary, fontWeight: '600' },
  resendDisabled: { color: Colors.textMuted },
  changePhoneText: { fontSize: FontSize.sm, color: Colors.textSecondary, textAlign: 'center', marginTop: Spacing.sm },
  messageText: { fontSize: FontSize.sm, color: Colors.textSecondary, textAlign: 'center', marginTop: Spacing.md, fontWeight: '500' },
  successText: { color: Colors.primary },
  footer: { fontSize: FontSize.xs, color: 'rgba(255,255,255,0.5)', textAlign: 'center', marginTop: Spacing.xl },
});
