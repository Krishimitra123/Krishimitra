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
  const isEn = useUserStore((s) => s.preferred_language)?.startsWith('en');

  const [step, setStep] = useState<'EMAIL' | 'OTP'>('EMAIL');
  const [email, setEmail] = useState('');
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

  const handleSendLink = async () => {
    const trimmed = email.trim();
    if (!trimmed || !trimmed.includes('@')) {
      Alert.alert(isEn ? 'Error' : 'ದೋಷ', isEn ? 'Please enter a valid email address' : 'ದಯವಿಟ್ಟು ಮಾನ್ಯ ಇಮೇಲ್ ವಿಳಾಸ ನಮೂದಿಸಿ');
      return;
    }

    setLoading(true);
    setMessage('');
    
    try {
      const res = await sendOTP({ email: trimmed });
      if (res.success) {
        setStep('OTP');
        setCountdown(60);
        setMessage(res.message);
        if (res.dev_otp) {
          setOtp(res.dev_otp);
        }
      } else {
        Alert.alert(isEn ? 'Error' : 'ದೋಷ', res.message);
      }
    } catch (err: any) {
      Alert.alert(
        isEn ? 'Connection Error' : 'ಸಂಪರ್ಕ ದೋಷ',
        isEn ? 'Could not reach server. Please check your internet connection.' : 'ಸರ್ವರ್ ಸಂಪರ್ಕ ವಿಫಲವಾಗಿದೆ. ನೆಟ್‌ವರ್ಕ್ ಪರಿಶೀಲಿಸಿ.'
      );
    } finally {
      setLoading(false);
    }
  };

  const handleVerifyLink = async () => {
    if (otp.length !== 6) {
      Alert.alert(isEn ? 'Error' : 'ದೋಷ', isEn ? 'Please enter 6-digit OTP' : 'ದಯವಿಟ್ಟು 6 ಅಂಕಿಯ OTP ನಮೂದಿಸಿ');
      return;
    }

    setLoading(true);
    setMessage('');
    
    try {
      const res = await verifyOTP({ email: email.trim(), otp });
      if (res.success && res.token) {
        setAuthenticated(email.trim(), res.token);
        setMessage('✅ ' + (isEn ? 'Login Successful' : 'ಲಾಗಿನ್ ಯಶಸ್ವಿಯಾಗಿದೆ'));
        
        setTimeout(() => {
          const isOnboarded = useUserStore.getState().is_onboarded;
          if (isOnboarded) {
            router.replace('/(tabs)');
          } else {
            router.replace('/onboarding');
          }
        }, 500);
      } else {
        Alert.alert(isEn ? 'Invalid Code' : 'ತಪ್ಪಾದ ಕೋಡ್', res.message);
      }
    } catch (err: any) {
      Alert.alert(
        isEn ? 'Verification Error' : 'ಪರಿಶೀಲನೆ ದೋಷ',
        isEn ? 'Failed to verify code. Please try again.' : 'ಕೋಡ್ ಪರಿಶೀಲನೆ ವಿಫಲವಾಗಿದೆ. ದಯವಿಟ್ಟು ಮತ್ತೆ ಪ್ರಯತ್ನಿಸಿ.'
      );
    } finally {
      setLoading(false);
    }
  };

  const handleResend = async () => {
    if (countdown > 0) return;
    setOtp('');
    await handleSendLink();
  };

  return (
    <LinearGradient colors={[Colors.primaryDark, Colors.primary, Colors.primarySoft]} style={styles.container}>
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={styles.flex}>
        <Animated.View style={[styles.content, { opacity: fadeAnim, transform: [{ translateY: slideAnim }] }]}>

          {/* Logo */}
          <View style={styles.logoSection}>
            <Text style={styles.logoIcon}>🌱</Text>
            <Text style={styles.logoText}>{isEn ? 'KrishiMitra' : 'ಕೃಷಿ ಮಿತ್ರ'}</Text>
            <Text style={styles.logoSubtext}>{isEn ? 'Your smart farming friend' : 'ನಿಮ್ಮ ಜೈವಿಕ ಕೃಷಿ ಸಹಾಯಕ'}</Text>
            <Text style={styles.tagline}>{isEn ? 'Organic Farming & Intelligence' : 'ಜೈವಿಕ ಕೃಷಿ ಮತ್ತು ಬುದ್ಧಿವಂತಿಕೆ'}</Text>
          </View>

          {/* Card */}
          <View style={[styles.card, Shadows.lg]}>
            {step === 'EMAIL' ? (
              <>
                <Text style={styles.cardTitle}>{isEn ? 'Login to save your farm' : 'ಲಾಗಿನ್ ಮಾಡಿ'}</Text>
                <Text style={styles.cardSubtitle}>{isEn ? 'We use this to save your farm details securely.' : 'ನಿಮ್ಮ ತೋಟದ ವಿವರಗಳನ್ನು ಸುರಕ್ಷಿತವಾಗಿ ಉಳಿಸಲು ಇದನ್ನು ಬಳಸುತ್ತೇವೆ.'}</Text>

                <View style={styles.phoneInputRow}>
                  <View style={styles.countryCode}>
                    <Text style={styles.countryCodeText}>✉️</Text>
                  </View>
                  <TextInput
                    style={styles.phoneInput}
                    placeholder="Rameshanna@gmail.com"
                    placeholderTextColor={Colors.textMuted}
                    value={email}
                    onChangeText={setEmail}
                    keyboardType="email-address"
                    autoCapitalize="none"
                    autoCorrect={false}
                    autoFocus
                  />
                </View>

                <TouchableOpacity
                  style={[styles.primaryBtn, loading && styles.btnDisabled]}
                  onPress={handleSendLink}
                  disabled={loading}
                >
                  {loading ? (
                    <ActivityIndicator color="#fff" />
                  ) : (
                    <Text style={styles.primaryBtnText}>{isEn ? 'Send Login Link →' : 'ಲಾಗಿನ್ ಲಿಂಕ್ ಕಳುಹಿಸಿ →'}</Text>
                  )}
                </TouchableOpacity>
              </>
            ) : (
              <>
                <Text style={styles.cardTitle}>{isEn ? 'Verify your login' : 'ಲಾಗಿನ್ ಪರಿಶೀಲಿಸಿ'}</Text>
                <Text style={styles.cardSubtitle}>
                  {isEn ? `We sent a secure link / OTP code to ${email}` : `${email} ಗೆ ಸುರಕ್ಷಿತ ಲಿಂಕ್ ಅಥವಾ OTP ಕಳುಹಿಸಲಾಗಿದೆ`}
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
                  onPress={handleVerifyLink}
                  disabled={loading}
                >
                  {loading ? (
                    <ActivityIndicator color="#fff" />
                  ) : (
                    <Text style={styles.primaryBtnText}>{isEn ? 'Verify ✓' : 'ಪರಿಶೀಲಿಸಿ ✓'}</Text>
                  )}
                </TouchableOpacity>

                <TouchableOpacity
                  onPress={handleResend}
                  disabled={countdown > 0}
                  style={styles.resendBtn}
                >
                  <Text style={[styles.resendText, countdown > 0 && styles.resendDisabled]}>
                    {countdown > 0
                      ? (isEn ? `Resend (${countdown}s)` : `ಮತ್ತೆ ಕಳುಹಿಸಿ (${countdown}s)`)
                      : (isEn ? 'Resend Link' : 'ಲಿಂಕ್ ಮತ್ತೆ ಕಳುಹಿಸಿ')}
                  </Text>
                </TouchableOpacity>

                <TouchableOpacity onPress={() => { setStep('EMAIL'); setOtp(''); setMessage(''); }}>
                  <Text style={styles.changePhoneText}>{isEn ? '← Use a different email' : '← ಬೇರೆ ಇಮೇಲ್ ಬಳಸಿ'}</Text>
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
