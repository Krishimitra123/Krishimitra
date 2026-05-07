/**
 * Voice Onboarding — KrishiMitra
 * AI-driven voice conversation flow. No forms, no reading required.
 *
 * Flow:
 *   LANGUAGE → farmer taps language button (each plays audio sample)
 *   NAME     → AI asks name, farmer speaks
 *   LOCATION → AI asks district/village, farmer speaks
 *   CROP     → AI asks crop, farmer speaks
 *   DONE     → AI welcomes farmer, navigates to tabs
 */

import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity,
  Animated, ActivityIndicator, SafeAreaView, Dimensions,
} from 'react-native';
import { useRouter } from 'expo-router';
import { LinearGradient } from 'expo-linear-gradient';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { Colors, FontSize, Spacing, BorderRadius, Shadows } from '@/constants/theme';
import { useUserStore } from '@/stores/useUserStore';
import { DISTRICTS } from '@/constants/districts';
import { CROPS } from '@/constants/crops';
import {
  startRecording, stopRecordingAndGetBase64,
  speakText, stopPlayback,
} from '@/services/voiceService';
import { sendVoiceQuery } from '@/services/queryService';

const { width, height } = Dimensions.get('window');

type OnboardingStep = 'LANGUAGE' | 'NAME' | 'LOCATION' | 'CROP' | 'DONE';

// ── Language config ───────────────────────────────────────────────
const LANGUAGES = [
  {
    code: 'kn',
    sttCode: 'kn-IN',
    label: 'ಕನ್ನಡ',
    sublabel: 'Kannada',
    greeting: 'ನಮಸ್ಕಾರ! ನಾನು ಕೃಷಿ ಮಿತ್ರ. ನಿಮ್ಮ ಭಾಷೆ ಕನ್ನಡ ಆಗಿದೆ.',
    nameQ: 'ನಿಮ್ಮ ಹೆಸರು ಏನು?',
    locationQ: 'ನೀವು ಯಾವ ಜಿಲ್ಲೆಯಲ್ಲಿ ಇದ್ದೀರಿ?',
    cropQ: 'ನೀವು ಯಾವ ಬೆಳೆ ಬೆಳೆಯುತ್ತೀರಿ?',
    welcomeQ: (name: string) => `ಸ್ವಾಗತ ${name}! ಕೃಷಿ ಮಿತ್ರ ಸಿದ್ಧ.`,
    color: '#1B5E20',
  },
  {
    code: 'hi',
    sttCode: 'hi-IN',
    label: 'हिंदी',
    sublabel: 'Hindi',
    greeting: 'नमस्कार! मैं कृषि मित्र हूँ। आपकी भाषा हिंदी है।',
    nameQ: 'आपका नाम क्या है?',
    locationQ: 'आप किस जिले में रहते हैं?',
    cropQ: 'आप कौन सी फसल उगाते हैं?',
    welcomeQ: (name: string) => `स्वागत ${name}! कृषि मित्र तैयार है।`,
    color: '#FF6F00',
  },
  {
    code: 'ta',
    sttCode: 'ta-IN',
    label: 'தமிழ்',
    sublabel: 'Tamil',
    greeting: 'வணக்கம்! நான் கிருஷி மித்ரா. உங்கள் மொழி தமிழ்.',
    nameQ: 'உங்கள் பெயர் என்ன?',
    locationQ: 'நீங்கள் எந்த மாவட்டத்தில் இருக்கிறீர்கள்?',
    cropQ: 'நீங்கள் என்ன பயிர் பயிரிடுகிறீர்கள்?',
    welcomeQ: (name: string) => `வரவேற்கிறோம் ${name}! கிருஷி மித்ரா தயார்.`,
    color: '#1565C0',
  },
  {
    code: 'te',
    sttCode: 'te-IN',
    label: 'తెలుగు',
    sublabel: 'Telugu',
    greeting: 'నమస్కారం! నేను కృషి మిత్ర. మీ భాష తెలుగు.',
    nameQ: 'మీ పేరు ఏమిటి?',
    locationQ: 'మీరు ఏ జిల్లాలో ఉన్నారు?',
    cropQ: 'మీరు ఏ పంట పండిస్తారు?',
    welcomeQ: (name: string) => `స్వాగతం ${name}! కృషి మిత్ర సిద్ధంగా ఉంది.`,
    color: '#4A148C',
  },
];

// ── Parsers ────────────────────────────────────────────────────────
function parseNameFromTranscript(transcript: string): string {
  // Remove common filler words and extract name
  const cleaned = transcript
    .replace(/my name is|i am|mera naam|naam|nanna hesaru|nanu|nasaru|ನನ್ನ ಹೆಸರು|ನಾನು/gi, '')
    .replace(/[^\u0C00-\u0C7F\u0900-\u097F\u0B80-\u0BFF\u0C00-\u0C7F\u0B00-\u0B7F\u0A80-\u0AFF\u0A00-\u0A7F\u0080-\u00FF\w\s]/g, '')
    .trim();
  const words = cleaned.split(/\s+/).filter(w => w.length > 1);
  return words[0] || transcript.trim().split(' ')[0] || 'Farmer';
}

function parseDistrictFromTranscript(transcript: string): string {
  const t = transcript.toLowerCase();
  // Try exact match first
  for (const d of DISTRICTS) {
    if (t.includes(d.name_en.toLowerCase())) return d.name_en;
    if (d.name_kn && t.includes(d.name_kn)) return d.name_en;
  }
  // Fuzzy: partial match (first 5 chars)
  for (const d of DISTRICTS) {
    const key = d.name_en.toLowerCase().slice(0, 5);
    if (t.includes(key)) return d.name_en;
  }
  return transcript.trim().split(/\s+/).slice(-1)[0] || 'Karnataka';
}

function parseCropFromTranscript(transcript: string): string {
  const t = transcript.toLowerCase();
  for (const c of CROPS) {
    if (t.includes(c.name_en.toLowerCase())) return c.name_en;
    if (c.name_kn && t.includes(c.name_kn)) return c.name_en;
  }
  return transcript.trim().split(/\s+/).slice(-1)[0] || 'Paddy';
}

// ── Waveform component ─────────────────────────────────────────────
function VoiceWaveform({ active }: { active: boolean }) {
  const bars = useRef(Array.from({ length: 7 }, () => new Animated.Value(0.3))).current;

  useEffect(() => {
    if (!active) {
      bars.forEach(b => b.setValue(0.3));
      return;
    }
    const loops = bars.map((bar, i) =>
      Animated.loop(
        Animated.sequence([
          Animated.timing(bar, { toValue: 1, duration: 350 + i * 60, useNativeDriver: true }),
          Animated.timing(bar, { toValue: 0.3, duration: 350 + i * 60, useNativeDriver: true }),
        ])
      )
    );
    const timers = loops.map((loop, i) => setTimeout(() => loop.start(), i * 70));
    return () => { loops.forEach(l => l.stop()); timers.forEach(t => clearTimeout(t)); };
  }, [active]);

  return (
    <View style={waveStyles.container}>
      {bars.map((bar, i) => (
        <Animated.View
          key={i}
          style={[waveStyles.bar, { transform: [{ scaleY: bar }] }]}
        />
      ))}
    </View>
  );
}

const waveStyles = StyleSheet.create({
  container: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    gap: 5, height: 56,
  },
  bar: {
    width: 6, height: 40, borderRadius: 3, backgroundColor: 'rgba(255,255,255,0.8)',
  },
});

// ── Progress dots ──────────────────────────────────────────────────
const STEPS: OnboardingStep[] = ['LANGUAGE', 'NAME', 'LOCATION', 'CROP'];

function ProgressDots({ current }: { current: OnboardingStep }) {
  const idx = STEPS.indexOf(current);
  return (
    <View style={dotStyles.row}>
      {STEPS.map((_, i) => (
        <View
          key={i}
          style={[dotStyles.dot, i <= idx && dotStyles.dotActive]}
        />
      ))}
    </View>
  );
}

const dotStyles = StyleSheet.create({
  row: { flexDirection: 'row', gap: 8, justifyContent: 'center' },
  dot: { width: 8, height: 8, borderRadius: 4, backgroundColor: 'rgba(255,255,255,0.3)' },
  dotActive: { backgroundColor: '#fff', width: 20 },
});

// ── Main Component ─────────────────────────────────────────────────
export default function OnboardingScreen() {
  const router = useRouter();
  const { setProfile, setLanguage, completeOnboarding } = useUserStore();

  const [step, setStep] = useState<OnboardingStep>('LANGUAGE');
  const [selectedLang, setSelectedLang] = useState(LANGUAGES[0]);
  const [isAISpeaking, setIsAISpeaking] = useState(false);
  const [isRecording, setIsRecording] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [statusText, setStatusText] = useState('ಭಾಷೆ ಆಯ್ಕೆ ಮಾಡಿ');
  const [collectedName, setCollectedName] = useState('');
  const [collectedDistrict, setCollectedDistrict] = useState('');

  const pulseAnim = useRef(new Animated.Value(1)).current;
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const slideAnim = useRef(new Animated.Value(40)).current;

  // Fade in on step change
  useEffect(() => {
    fadeAnim.setValue(0);
    slideAnim.setValue(40);
    Animated.parallel([
      Animated.timing(fadeAnim, { toValue: 1, duration: 400, useNativeDriver: true }),
      Animated.timing(slideAnim, { toValue: 0, duration: 400, useNativeDriver: true }),
    ]).start();
  }, [step]);

  // Pulse when speaking
  useEffect(() => {
    if (isAISpeaking || isRecording) {
      const loop = Animated.loop(
        Animated.sequence([
          Animated.timing(pulseAnim, { toValue: 1.12, duration: 600, useNativeDriver: true }),
          Animated.timing(pulseAnim, { toValue: 1, duration: 600, useNativeDriver: true }),
        ])
      );
      loop.start();
      return () => { loop.stop(); pulseAnim.setValue(1); };
    }
  }, [isAISpeaking, isRecording]);

  // AI speak helper
  const aiSpeak = useCallback(async (text: string, langCode: string) => {
    setIsAISpeaking(true);
    try {
      await speakText(text, `${langCode}-IN`);
    } catch (e) {
      console.error('[Onboarding] AI speak error:', e);
    } finally {
      setIsAISpeaking(false);
    }
  }, []);

  // Handle language selection
  const handleLanguageSelect = useCallback(async (lang: typeof LANGUAGES[0]) => {
    setSelectedLang(lang);
    setLanguage(lang.code);
    setStatusText(lang.greeting);
    await aiSpeak(lang.greeting, lang.code);
    await new Promise(r => setTimeout(r, 400));
    setStep('NAME');
    setTimeout(() => askQuestion('NAME', lang), 500);
  }, []);

  // Ask question for a step
  const askQuestion = useCallback(async (s: OnboardingStep, lang: typeof LANGUAGES[0]) => {
    let question = '';
    if (s === 'NAME') { question = lang.nameQ; setStatusText(lang.nameQ); }
    else if (s === 'LOCATION') { question = lang.locationQ; setStatusText(lang.locationQ); }
    else if (s === 'CROP') { question = lang.cropQ; setStatusText(lang.cropQ); }
    if (question) await aiSpeak(question, lang.code);
  }, []);

  // Record farmer's response
  const handleMicPress = useCallback(async () => {
    if (isAISpeaking || isProcessing) return;

    if (!isRecording) {
      try {
        setIsRecording(true);
        setStatusText('ಮಾತನಾಡಿ...');
        await startRecording();
      } catch (e) {
        setIsRecording(false);
        setStatusText('ಮೈಕ್ ಅನುಮತಿ ಬೇಕು');
      }
      return;
    }

    // Stop recording and process
    setIsRecording(false);
    setIsProcessing(true);
    setStatusText('ಯೋಚಿಸುತ್ತಿದೆ...');

    try {
      const audio = await stopRecordingAndGetBase64();
      const response = await sendVoiceQuery(audio.base64, audio.mimeType);
      const transcript = response.transcript || '';

      if (step === 'NAME') {
        const name = parseNameFromTranscript(transcript);
        setCollectedName(name);
        setProfile({ farmer_name: name });
        setStatusText(selectedLang.locationQ);
        setIsProcessing(false);
        setStep('LOCATION');
        setTimeout(() => askQuestion('LOCATION', selectedLang), 500);

      } else if (step === 'LOCATION') {
        const district = parseDistrictFromTranscript(transcript);
        setCollectedDistrict(district);
        setProfile({ district });
        setStatusText(selectedLang.cropQ);
        setIsProcessing(false);
        setStep('CROP');
        setTimeout(() => askQuestion('CROP', selectedLang), 500);

      } else if (step === 'CROP') {
        const crop = parseCropFromTranscript(transcript);
        setProfile({ primary_crop: crop, crops: [crop] });
        setIsProcessing(false);
        setStep('DONE');
        const welcome = selectedLang.welcomeQ(collectedName);
        setStatusText(welcome);
        await aiSpeak(welcome, selectedLang.code);
        await new Promise(r => setTimeout(r, 600));
        completeOnboarding();
        router.replace('/(tabs)');
      }
    } catch (e: any) {
      console.error('[Onboarding] Voice processing error:', e);
      setIsProcessing(false);
      setStatusText('ಮತ್ತೆ ಪ್ರಯತ್ನಿಸಿ');
    }
  }, [isRecording, isAISpeaking, isProcessing, step, selectedLang, collectedName]);

  // Skip step
  const handleSkip = useCallback(async () => {
    await stopPlayback();
    if (step === 'NAME') {
      setCollectedName('Farmer');
      setProfile({ farmer_name: 'Farmer' });
      setStep('LOCATION');
      setTimeout(() => askQuestion('LOCATION', selectedLang), 300);
    } else if (step === 'LOCATION') {
      setCollectedDistrict('Bengaluru');
      setProfile({ district: 'Bengaluru' });
      setStep('CROP');
      setTimeout(() => askQuestion('CROP', selectedLang), 300);
    } else if (step === 'CROP') {
      setProfile({ primary_crop: 'Paddy', crops: ['Paddy'] });
      completeOnboarding();
      router.replace('/(tabs)');
    }
  }, [step, selectedLang]);

  // ── Language selection screen ──────────────────────────────────
  if (step === 'LANGUAGE') {
    return (
      <LinearGradient
        colors={['#1B5E20', '#2E7D32', '#388E3C']}
        style={styles.fullScreen}
      >
        <SafeAreaView style={styles.safeArea}>
          <Animated.View style={[styles.center, { opacity: fadeAnim, transform: [{ translateY: slideAnim }] }]}>
            {/* Logo */}
            <View style={styles.logoCircle}>
              <MaterialCommunityIcons name="sprout" size={52} color="#fff" />
            </View>
            <Text style={styles.appName}>ಕೃಷಿ ಮಿತ್ರ</Text>
            <Text style={styles.appSubname}>KrishiMitra</Text>
            <Text style={styles.langPrompt}>ನಿಮ್ಮ ಭಾಷೆ ಆಯ್ಕೆ ಮಾಡಿ</Text>
            <Text style={styles.langPromptSub}>Choose your language</Text>

            {/* Language buttons */}
            <View style={styles.langGrid}>
              {LANGUAGES.map((lang) => (
                <TouchableOpacity
                  key={lang.code}
                  style={[styles.langButton, { borderColor: lang.color }]}
                  onPress={() => handleLanguageSelect(lang)}
                  activeOpacity={0.8}
                >
                  <Text style={styles.langButtonText}>{lang.label}</Text>
                  <Text style={styles.langButtonSub}>{lang.sublabel}</Text>
                </TouchableOpacity>
              ))}
            </View>

            <Text style={styles.poweredBy}>Nivetti Systems</Text>
          </Animated.View>
        </SafeAreaView>
      </LinearGradient>
    );
  }

  // ── Voice conversation steps ───────────────────────────────────
  const micReady = !isAISpeaking && !isProcessing;
  const micColor = isRecording ? Colors.error : Colors.primary;

  return (
    <LinearGradient
      colors={['#1B5E20', '#2E7D32', '#43A047']}
      style={styles.fullScreen}
    >
      <SafeAreaView style={styles.safeArea}>
        <Animated.View style={[styles.voiceCenter, { opacity: fadeAnim }]}>

          {/* Progress */}
          <ProgressDots current={step} />

          {/* AI Speaking indicator */}
          <View style={styles.aiSection}>
            {isAISpeaking ? (
              <>
                <View style={styles.aiOrb}>
                  <MaterialCommunityIcons name="robot" size={36} color="#fff" />
                </View>
                <VoiceWaveform active />
              </>
            ) : (
              <View style={[styles.aiOrb, styles.aiOrbIdle]}>
                <MaterialCommunityIcons name="robot" size={36} color="rgba(255,255,255,0.5)" />
              </View>
            )}
          </View>

          {/* Status text */}
          <View style={styles.statusBox}>
            <Text style={styles.statusText}>{statusText}</Text>
          </View>

          {/* Big Mic */}
          <Animated.View style={{ transform: [{ scale: pulseAnim }], marginTop: Spacing.xl }}>
            <TouchableOpacity
              style={[
                styles.bigMic,
                isRecording && styles.bigMicRecording,
                !micReady && styles.bigMicDisabled,
              ]}
              onPress={handleMicPress}
              activeOpacity={0.8}
              disabled={isAISpeaking}
            >
              {isProcessing ? (
                <ActivityIndicator size="large" color="#fff" />
              ) : (
                <MaterialCommunityIcons
                  name={isRecording ? 'stop' : 'microphone'}
                  size={48}
                  color="#fff"
                />
              )}
            </TouchableOpacity>
          </Animated.View>

          <Text style={styles.micHint}>
            {isAISpeaking ? 'ಕೇಳಿ...' : isRecording ? 'ಮಾತನಾಡಿ — ನಿಲ್ಲಿಸಲು ಒತ್ತಿ' : isProcessing ? 'ಯೋಚಿಸುತ್ತಿದೆ...' : 'ಒತ್ತಿ ಮಾತನಾಡಿ'}
          </Text>

          {/* Skip button */}
          {!isAISpeaking && !isProcessing && step !== 'DONE' && (
            <TouchableOpacity style={styles.skipBtn} onPress={handleSkip}>
              <Text style={styles.skipText}>ಬಿಡಿ →</Text>
            </TouchableOpacity>
          )}

        </Animated.View>
      </SafeAreaView>
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  fullScreen: { flex: 1 },
  safeArea: { flex: 1 },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: Spacing.xl },
  logoCircle: {
    width: 96, height: 96, borderRadius: 48,
    backgroundColor: 'rgba(255,255,255,0.2)',
    alignItems: 'center', justifyContent: 'center',
    marginBottom: Spacing.md,
    borderWidth: 1, borderColor: 'rgba(255,255,255,0.3)',
  },
  appName: { fontSize: 36, fontWeight: '900', color: '#fff', letterSpacing: 1 },
  appSubname: { fontSize: FontSize.lg, color: 'rgba(255,255,255,0.7)', fontWeight: '600', marginTop: 2 },
  langPrompt: { fontSize: FontSize.xl, color: '#fff', fontWeight: '700', marginTop: Spacing.xl, textAlign: 'center' },
  langPromptSub: { fontSize: FontSize.md, color: 'rgba(255,255,255,0.6)', marginTop: 4, marginBottom: Spacing.xl },
  langGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.md, justifyContent: 'center', width: '100%' },
  langButton: {
    width: (width - 80) / 2,
    paddingVertical: Spacing.lg,
    borderRadius: BorderRadius.lg,
    alignItems: 'center', justifyContent: 'center',
    backgroundColor: 'rgba(255,255,255,0.15)',
    borderWidth: 1.5,
  },
  langButtonText: { fontSize: FontSize.xxl, fontWeight: '800', color: '#fff' },
  langButtonSub: { fontSize: FontSize.sm, color: 'rgba(255,255,255,0.7)', marginTop: 4 },
  poweredBy: { fontSize: FontSize.xs, color: 'rgba(255,255,255,0.35)', marginTop: Spacing.xxl, fontStyle: 'italic' },

  // Voice screen
  voiceCenter: { flex: 1, alignItems: 'center', justifyContent: 'space-around', paddingHorizontal: Spacing.xl, paddingVertical: Spacing.xxl },
  aiSection: { alignItems: 'center', gap: Spacing.md, minHeight: 120, justifyContent: 'center' },
  aiOrb: {
    width: 80, height: 80, borderRadius: 40,
    backgroundColor: 'rgba(255,255,255,0.25)',
    alignItems: 'center', justifyContent: 'center',
    borderWidth: 1, borderColor: 'rgba(255,255,255,0.4)',
  },
  aiOrbIdle: { backgroundColor: 'rgba(255,255,255,0.08)', borderColor: 'rgba(255,255,255,0.15)' },
  statusBox: {
    backgroundColor: 'rgba(0,0,0,0.25)',
    borderRadius: BorderRadius.lg,
    paddingVertical: Spacing.md, paddingHorizontal: Spacing.lg,
    maxWidth: width - 60,
  },
  statusText: { fontSize: FontSize.xl, color: '#fff', fontWeight: '700', textAlign: 'center', lineHeight: 32 },
  bigMic: {
    width: 120, height: 120, borderRadius: 60,
    backgroundColor: Colors.primary,
    alignItems: 'center', justifyContent: 'center',
    ...Shadows.lg,
    borderWidth: 3, borderColor: 'rgba(255,255,255,0.5)',
  },
  bigMicRecording: { backgroundColor: Colors.error },
  bigMicDisabled: { backgroundColor: 'rgba(255,255,255,0.2)' },
  micHint: { fontSize: FontSize.md, color: 'rgba(255,255,255,0.8)', marginTop: Spacing.md, fontWeight: '500' },
  skipBtn: {
    paddingVertical: Spacing.sm, paddingHorizontal: Spacing.xl,
    borderRadius: BorderRadius.full,
    backgroundColor: 'rgba(255,255,255,0.15)',
    borderWidth: 1, borderColor: 'rgba(255,255,255,0.3)',
  },
  skipText: { fontSize: FontSize.md, color: 'rgba(255,255,255,0.8)', fontWeight: '600' },
});
