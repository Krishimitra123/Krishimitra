/**
 * Onboarding — Voice-first, all 11 languages.
 * Steps: Language → Name → Location → Crops → Home
 * Uses /api/transcribe (not /api/query) — no 422 errors.
 */
import React, { useState, useRef, useEffect } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity, ScrollView,
  Animated, ActivityIndicator, Alert,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { useUserStore } from '@/stores/useUserStore';
import { transcribeAudio } from '@/services/queryService';
import { startRecording, stopRecordingAndGetBase64, playBase64Audio } from '@/services/voiceService';
import { apiClient } from '@/services/api';
import { Colors, Spacing, FontSize, BorderRadius, Shadows } from '@/constants/theme';

// ── Language definitions ───────────────────────────────────────────
const LANGUAGES = [
  { code: 'kn', label: 'ಕನ್ನಡ',    sub: 'Kannada',   sarvam: 'kn-IN' },
  { code: 'hi', label: 'हिंदी',     sub: 'Hindi',     sarvam: 'hi-IN' },
  { code: 'ta', label: 'தமிழ்',    sub: 'Tamil',     sarvam: 'ta-IN' },
  { code: 'te', label: 'తెలుగు',   sub: 'Telugu',    sarvam: 'te-IN' },
  { code: 'ml', label: 'മലയാളം',   sub: 'Malayalam', sarvam: 'ml-IN' },
  { code: 'mr', label: 'मराठी',    sub: 'Marathi',   sarvam: 'mr-IN' },
  { code: 'bn', label: 'বাংলা',    sub: 'Bengali',   sarvam: 'bn-IN' },
  { code: 'gu', label: 'ગુજરાતી',  sub: 'Gujarati',  sarvam: 'gu-IN' },
  { code: 'pa', label: 'ਪੰਜਾਬੀ',   sub: 'Punjabi',   sarvam: 'pa-IN' },
  { code: 'od', label: 'ଓଡ଼ିଆ',    sub: 'Odia',      sarvam: 'or-IN' },
  { code: 'en', label: 'English',   sub: 'English',   sarvam: 'en-IN' },
];

// ── Localised prompts for each language ───────────────────────────
const P: Record<string, { name: string; loc: string; crop: string; welcome: string; tapMic: string }> = {
  kn: { name: 'ನಿಮ್ಮ ಹೆಸರು ಏನು?', loc: 'ನೀವು ಯಾವ ಜಿಲ್ಲೆಯಲ್ಲಿ ಇದ್ದೀರಿ?', crop: 'ನೀವು ಯಾವ ಬೆಳೆ ಬೆಳೆಯುತ್ತೀರಿ?', welcome: 'ಸ್ವಾಗತ', tapMic: 'ಮೈಕ್ ಒತ್ತಿ ಮಾತನಾಡಿ' },
  hi: { name: 'आपका नाम क्या है?', loc: 'आप किस जिले में रहते हैं?', crop: 'आप कौन सी फसल उगाते हैं?', welcome: 'स्वागत है', tapMic: 'माइक दबाकर बोलें' },
  ta: { name: 'உங்கள் பெயர் என்ன?', loc: 'நீங்கள் எந்த மாவட்டத்தில்?', crop: 'என்ன பயிர் வளர்க்கிறீர்கள்?', welcome: 'வரவேற்கிறோம்', tapMic: 'மைக்கை அழுத்தி பேசுங்கள்' },
  te: { name: 'మీ పేరు ఏమిటి?', loc: 'మీరు ఏ జిల్లాలో ఉన్నారు?', crop: 'మీరు ఏ పంటలు పండిస్తున్నారు?', welcome: 'స్వాగతం', tapMic: 'మైక్ నొక్కి మాట్లాడండి' },
  ml: { name: 'നിങ്ങളുടെ പേര്?', loc: 'ഏത് ജില്ലയിൽ ഉണ്ട്?', crop: 'ഏത് വിള കൃഷി ചെയ്യുന്നു?', welcome: 'സ്വാഗതം', tapMic: 'മൈക്ക് അമർത്തി സംസാരിക്കൂ' },
  mr: { name: 'तुमचे नाव काय?', loc: 'कोणत्या जिल्ह्यात राहता?', crop: 'कोणते पीक घेता?', welcome: 'स्वागत', tapMic: 'मायक दाबून बोला' },
  bn: { name: 'আপনার নাম কি?', loc: 'আপনি কোন জেলায় থাকেন?', crop: 'কি ফসল চাষ করেন?', welcome: 'স্বাগতম', tapMic: 'মাইক চাপুন এবং বলুন' },
  gu: { name: 'તમારું નામ શું છે?', loc: 'તમે કયા જિલ્લામાં?', crop: 'કઈ ખેતી કરો?', welcome: 'સ્વાગત', tapMic: 'માઇક દબાવી બોલો' },
  pa: { name: 'ਤੁਹਾਡਾ ਨਾਂ ਕੀ ਹੈ?', loc: 'ਕਿਸ ਜ਼ਿਲ੍ਹੇ ਵਿੱਚ ਹੋ?', crop: 'ਕਿਹੜੀ ਫ਼ਸਲ ਉਗਾਉਂਦੇ ਹੋ?', welcome: 'ਜੀ ਆਇਆਂ', tapMic: 'ਮਾਈਕ ਦਬਾਓ ਅਤੇ ਬੋਲੋ' },
  od: { name: 'ଆପଣଙ୍କ ନାମ?', loc: 'କେଉଁ ଜିଲ୍ଲାରେ ଅଛନ୍ତି?', crop: 'କ\'ଣ ଚାଷ କରୁଛନ୍ତି?', welcome: 'ସ୍ୱାଗତ', tapMic: 'ମାଇକ୍ ଦବାଇ କୁହନ୍ତୁ' },
  en: { name: 'What is your name?', loc: 'Which district are you from?', crop: 'What crops do you grow?', welcome: 'Welcome', tapMic: 'Tap mic and speak' },
};

type Step = 'lang' | 'name' | 'loc' | 'crop' | 'done';

export default function OnboardingScreen() {
  const store = useUserStore();
  const [step, setStep] = useState<Step>('lang');
  const [langCode, setLangCode] = useState('kn');
  const [sarvam, setSarvam] = useState('kn-IN');
  const [status, setStatus] = useState('');
  const [recording, setRecording] = useState(false);
  const [busy, setBusy] = useState(false);
  const [name, setName] = useState('');
  const [loc, setLoc] = useState('');
  const [crop, setCrop] = useState('');
  const pulseAnim = useRef(new Animated.Value(1)).current;

  const prompt = P[langCode] ?? P['kn'];

  // Pulse animation while recording
  useEffect(() => {
    if (recording) {
      Animated.loop(Animated.sequence([
        Animated.timing(pulseAnim, { toValue: 1.25, duration: 600, useNativeDriver: true }),
        Animated.timing(pulseAnim, { toValue: 1.0, duration: 600, useNativeDriver: true }),
      ])).start();
    } else {
      pulseAnim.stopAnimation();
      Animated.timing(pulseAnim, { toValue: 1.0, duration: 200, useNativeDriver: true }).start();
    }
  }, [recording]);

  // Speak a question via Sarvam TTS
  async function speakQuestion(text: string) {
    try {
      setBusy(true);
      setStatus('🔊');
      const res = await apiClient.post('/api/query', {
        text_query: text,
        tts_language: sarvam,
        preferred_language: sarvam,
        conversation_history: [],
      }, { timeout: 30000 });
      if (res.data?.audio_base64) {
        await playBase64Audio(res.data.audio_base64);
      }
    } catch {
      // Fallback: show text only
    } finally {
      setBusy(false);
      setStatus(prompt.tapMic);
    }
  }

  // After language is selected, speak the name question
  async function onSelectLanguage(code: string, sv: string) {
    setLangCode(code);
    setSarvam(sv);
    store.setLanguage(sv);
    setStep('name');
    await speakQuestion(P[code]?.name ?? P['kn'].name);
  }

  // Record and transcribe
  async function handleRecord() {
    if (recording) {
      // Stop recording
      try {
        setRecording(false);
        setBusy(true);
        setStatus('...');
        const audio = await stopRecordingAndGetBase64();
        const result = await transcribeAudio(audio.base64, audio.mimeType, sarvam);
        const transcript = result.transcript.trim();
        if (!transcript) {
          setStatus(prompt.tapMic);
          return;
        }
        await processTranscript(transcript);
      } catch (e: any) {
        setStatus(prompt.tapMic);
        Alert.alert('Error', e.message);
      } finally {
        setBusy(false);
      }
    } else {
      // Start recording
      try {
        await startRecording();
        setRecording(true);
        setStatus('🎙️ ...');
      } catch (e: any) {
        Alert.alert('Permission Denied', 'Please allow microphone access.');
      }
    }
  }

  async function processTranscript(transcript: string) {
    if (step === 'name') {
      const n = transcript.split(' ').slice(0, 4).join(' ');
      setName(n);
      store.setProfile({ farmer_name: n });
      setStep('loc');
      await speakQuestion(prompt.loc);
    } else if (step === 'loc') {
      setLoc(transcript);
      store.setProfile({ district: transcript });
      setStep('crop');
      await speakQuestion(prompt.crop);
    } else if (step === 'crop') {
      // Support multiple crops separated by common words
      const crops = transcript
        .split(/,|and|ಮತ್ತು|और|மற்றும்|మరియు|ഒപ്പം|आणि|এবং|અને|ਅਤੇ|ଓ/)
        .map(c => c.trim())
        .filter(Boolean);
      setCrop(crops[0] ?? transcript);
      store.setProfile({ crops, primary_crop: crops[0] ?? transcript });
      store.completeOnboarding();
      setStep('done');
      setTimeout(() => router.replace('/(tabs)/'), 1500);
    }
  }

  // ── RENDER ─────────────────────────────────────────────────────
  if (step === 'lang') {
    return (
      <LinearGradient colors={['#1B5E20', '#2E7D32', '#388E3C']} style={styles.root}>
        <View style={styles.langHeader}>
          <MaterialCommunityIcons name="sprout" size={32} color="#fff" />
          <Text style={styles.langTitle}>KrishiMitra</Text>
          <Text style={styles.langSub}>Select your language / ನಿಮ್ಮ ಭಾಷೆ ಆಯ್ಕೆ ಮಾಡಿ</Text>
        </View>
        <ScrollView contentContainerStyle={styles.langGrid} showsVerticalScrollIndicator={false}>
          {LANGUAGES.map(l => (
            <TouchableOpacity
              key={l.code}
              style={styles.langCard}
              onPress={() => onSelectLanguage(l.code, l.sarvam)}
              activeOpacity={0.75}
            >
              <Text style={styles.langCardLabel}>{l.label}</Text>
              <Text style={styles.langCardSub}>{l.sub}</Text>
            </TouchableOpacity>
          ))}
        </ScrollView>
      </LinearGradient>
    );
  }

  if (step === 'done') {
    return (
      <LinearGradient colors={['#1B5E20', '#2E7D32']} style={[styles.root, styles.center]}>
        <MaterialCommunityIcons name="check-circle" size={80} color="#fff" />
        <Text style={styles.doneText}>{prompt.welcome}!</Text>
      </LinearGradient>
    );
  }

  const stepIcon = step === 'name' ? 'account' : step === 'loc' ? 'map-marker' : 'sprout';
  const question = step === 'name' ? prompt.name : step === 'loc' ? prompt.loc : prompt.crop;
  const stepNum = step === 'name' ? 1 : step === 'loc' ? 2 : 3;

  return (
    <LinearGradient colors={['#1B5E20', '#2E7D32', '#388E3C']} style={[styles.root, styles.center]}>
      {/* Step indicator */}
      <View style={styles.stepRow}>
        {[1, 2, 3].map(n => (
          <View key={n} style={[styles.stepDot, n === stepNum && styles.stepDotActive]} />
        ))}
      </View>

      {/* Icon */}
      <View style={styles.iconCircle}>
        <MaterialCommunityIcons name={stepIcon as any} size={40} color="#fff" />
      </View>

      {/* Question */}
      <Text style={styles.question}>{question}</Text>

      {/* Transcript preview */}
      {(step === 'name' && name) && <Text style={styles.preview}>{name}</Text>}
      {(step === 'loc' && loc) && <Text style={styles.preview}>{loc}</Text>}
      {(step === 'crop' && crop) && <Text style={styles.preview}>{crop}</Text>}

      {/* Status */}
      <Text style={styles.statusText}>{busy ? '...' : status || prompt.tapMic}</Text>

      {/* Mic button */}
      <TouchableOpacity
        onPress={handleRecord}
        disabled={busy}
        activeOpacity={0.8}
      >
        <Animated.View style={[
          styles.micBtn,
          recording && styles.micBtnActive,
          { transform: [{ scale: pulseAnim }] },
        ]}>
          {busy
            ? <ActivityIndicator size="large" color="#fff" />
            : <MaterialCommunityIcons
                name={recording ? 'stop' : 'microphone'}
                size={44}
                color="#fff"
              />
          }
        </Animated.View>
      </TouchableOpacity>

      <Text style={styles.hint}>
        {recording ? '🔴 Recording...' : prompt.tapMic}
      </Text>
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  center: { alignItems: 'center', justifyContent: 'center', paddingHorizontal: Spacing.xl },

  langHeader: { alignItems: 'center', paddingTop: 60, paddingBottom: Spacing.lg },
  langTitle: { fontSize: 28, fontWeight: '900', color: '#fff', marginTop: Spacing.sm },
  langSub: { fontSize: 14, color: 'rgba(255,255,255,0.75)', marginTop: 4, textAlign: 'center' },

  langGrid: {
    flexDirection: 'row', flexWrap: 'wrap',
    justifyContent: 'center', gap: 12,
    paddingHorizontal: Spacing.lg, paddingBottom: 40,
  },
  langCard: {
    backgroundColor: 'rgba(255,255,255,0.15)',
    borderRadius: BorderRadius.lg, borderWidth: 1.5,
    borderColor: 'rgba(255,255,255,0.3)',
    paddingVertical: 14, paddingHorizontal: 18,
    minWidth: '40%', alignItems: 'center',
  },
  langCardLabel: { fontSize: 20, color: '#fff', fontWeight: '700' },
  langCardSub: { fontSize: 12, color: 'rgba(255,255,255,0.7)', marginTop: 2 },

  stepRow: { flexDirection: 'row', gap: 8, marginBottom: Spacing.xl },
  stepDot: { width: 8, height: 8, borderRadius: 4, backgroundColor: 'rgba(255,255,255,0.35)' },
  stepDotActive: { backgroundColor: '#fff', width: 24 },

  iconCircle: {
    width: 90, height: 90, borderRadius: 45,
    backgroundColor: 'rgba(255,255,255,0.15)',
    alignItems: 'center', justifyContent: 'center',
    marginBottom: Spacing.lg,
    borderWidth: 2, borderColor: 'rgba(255,255,255,0.3)',
  },

  question: { fontSize: 24, fontWeight: '800', color: '#fff', textAlign: 'center', lineHeight: 34, marginBottom: Spacing.sm },
  preview: { fontSize: 18, color: '#A5D6A7', fontWeight: '600', textAlign: 'center', marginBottom: Spacing.sm },
  statusText: { fontSize: 14, color: 'rgba(255,255,255,0.7)', marginBottom: Spacing.xl },

  micBtn: {
    width: 110, height: 110, borderRadius: 55,
    backgroundColor: 'rgba(255,255,255,0.2)',
    alignItems: 'center', justifyContent: 'center',
    borderWidth: 3, borderColor: 'rgba(255,255,255,0.5)',
    ...Shadows.md,
  },
  micBtnActive: {
    backgroundColor: 'rgba(244,67,54,0.7)',
    borderColor: '#EF9A9A',
  },

  hint: { fontSize: 13, color: 'rgba(255,255,255,0.6)', marginTop: Spacing.lg },
  doneText: { fontSize: 32, fontWeight: '900', color: '#fff', marginTop: Spacing.lg },
});
