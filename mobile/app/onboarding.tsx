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
import { startRecording, stopRecordingAndGetBase64, speakText } from '@/services/voiceService';
import { DISTRICTS } from '@/constants/districts';
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
const P: Record<string, { name: string; loc: string; mode: string; crop: string; welcome: string; tapMic: string; single: string; multiple: string; done: string }> = {
  kn: { name: 'ನಿಮ್ಮ ಹೆಸರು ಏನು?', loc: 'ದಯವಿಟ್ಟು ನಿಮ್ಮ ಜಿಲ್ಲೆ ಹೇಳಿ', mode: 'ನೀವು ಒಂದೇ ಬೆಳೆ ಬೆಳೆಯುತ್ತೀರಾ ಅಥವಾ ಹಲವು ಬೆಳೆಗಳಾ?', crop: 'ಈಗ ನಿಮ್ಮ ಬೆಳೆಗಳನ್ನು ಹೇಳಿ', welcome: 'ಸ್ವಾಗತ', tapMic: 'ಮೈಕ್ ಒತ್ತಿ ಮಾತನಾಡಿ', single: 'ಒಂದೇ ಬೆಳೆ', multiple: 'ಹಲವು ಬೆಳೆಗಳು', done: 'ಮುಗಿದಿತು' },
  hi: { name: 'आपका नाम क्या है?', loc: 'कृपया अपना जिला बताइए', mode: 'क्या आप एक फसल उगाते हैं या कई?', crop: 'अब अपनी फसलें बताइए', welcome: 'स्वागत है', tapMic: 'माइक दबाकर बोलें', single: 'एक फसल', multiple: 'कई फसलें', done: 'हो गया' },
  ta: { name: 'உங்கள் பெயர் என்ன?', loc: 'தயவுசெய்து உங்கள் மாவட்டத்தை சொல்லுங்கள்', mode: 'ஒரே பயிரா அல்லது பல பயிர்களா?', crop: 'இப்போது உங்கள் பயிர்களைச் சொல்லுங்கள்', welcome: 'வரவேற்கிறோம்', tapMic: 'மைக்கை அழுத்தி பேசுங்கள்', single: 'ஒரே பயிர்', multiple: 'பல பயிர்கள்', done: 'முடிந்தது' },
  te: { name: 'మీ పేరు ఏమిటి?', loc: 'దయచేసి మీ జిల్లాను చెప్పండి', mode: 'ఒకే పంటా లేదా అనేక పంటలనా?', crop: 'ఇప్పుడు మీ పంటలను చెప్పండి', welcome: 'స్వాగతం', tapMic: 'మైక్ నొక్కి మాట్లాడండి', single: 'ఒకే పంట', multiple: 'అనేక పంటలు', done: 'పూర్తి' },
  ml: { name: 'നിങ്ങളുടെ പേര്?', loc: 'ദയവായി നിങ്ങളുടെ ജില്ല പറയൂ', mode: 'ഒറ്റ വിളയോ പല വിളകളോ?', crop: 'ഇപ്പോൾ നിങ്ങളുടെ വിളകൾ പറയൂ', welcome: 'സ്വാഗതം', tapMic: 'മൈക്ക് അമർത്തി സംസാരിക്കൂ', single: 'ഒറ്റ വിള', multiple: 'പല വിളകൾ', done: 'തീർന്നു' },
  mr: { name: 'तुमचे नाव काय?', loc: 'कृपया तुमचा जिल्हा सांगा', mode: 'एक पीक की अनेक पीके?', crop: 'आता तुमची पिके सांगा', welcome: 'स्वागत', tapMic: 'मायक दाबून बोला', single: 'एक पीक', multiple: 'अनेक पीके', done: 'झाले' },
  bn: { name: 'আপনার নাম কি?', loc: 'দয়া করে আপনার জেলা বলুন', mode: 'একটি ফসল নাকি অনেক ফসল?', crop: 'এখন আপনার ফসলগুলো বলুন', welcome: 'স্বাগতম', tapMic: 'মাইক চাপুন এবং বলুন', single: 'একটি ফসল', multiple: 'একাধিক ফসল', done: 'শেষ' },
  gu: { name: 'તમારું નામ શું છે?', loc: 'કૃપા કરીને તમારો જિલ્લો કહો', mode: 'એક પાક કે ઘણા પાક?', crop: 'હવે તમારા પાકો કહો', welcome: 'સ્વાગત', tapMic: 'માઇક દબાવી બોલો', single: 'એક પાક', multiple: 'ઘણા પાક', done: 'પૂર્ણ' },
  pa: { name: 'ਤੁਹਾਡਾ ਨਾਂ ਕੀ ਹੈ?', loc: 'ਕਿਰਪਾ ਕਰਕੇ ਆਪਣਾ ਜ਼ਿਲ੍ਹਾ ਦੱਸੋ', mode: 'ਇੱਕ ਫ਼ਸਲ ਜਾਂ ਕਈ ਫ਼ਸਲਾਂ?', crop: 'ਹੁਣ ਆਪਣੀਆਂ ਫ਼ਸਲਾਂ ਦੱਸੋ', welcome: 'ਜੀ ਆਇਆਂ', tapMic: 'ਮਾਈਕ ਦਬਾਓ ਅਤੇ ਬੋਲੋ', single: 'ਇੱਕ ਫ਼ਸਲ', multiple: 'ਕਈ ਫ਼ਸਲਾਂ', done: 'ਮੁਕ ਗਿਆ' },
  od: { name: 'ଆପଣଙ୍କ ନାମ?', loc: 'ଦୟାକରି ଆପଣଙ୍କ ଜିଲ୍ଲା କୁହନ୍ତୁ', mode: 'ଗୋଟିଏ ଚାଷ କି ଅନେକ ଚାଷ?', crop: 'ଏବେ ଆପଣଙ୍କ ଚାଷ କୁହନ୍ତୁ', welcome: 'ସ୍ୱାଗତ', tapMic: 'ମାଇକ୍ ଦବାଇ କୁହନ୍ତୁ', single: 'ଗୋଟିଏ ଚାଷ', multiple: 'ଅନେକ ଚାଷ', done: 'ସମାପ୍ତ' },
  en: { name: 'What is your name?', loc: 'Please say your district', mode: 'Do you grow one crop or many crops?', crop: 'Now say your crops', welcome: 'Welcome', tapMic: 'Tap mic and speak', single: 'One crop', multiple: 'Many crops', done: 'Done' },
};

type Step = 'lang' | 'name' | 'loc' | 'mode' | 'crop' | 'done';
type CropMode = 'single' | 'multiple';

function resolveDistrict(raw: string): string {
  const value = raw.trim();
  if (!value) return '';

  const lower = value.toLowerCase();
  const exact = DISTRICTS.find((district) =>
    district.name_en.toLowerCase() === lower || district.name_kn === value
  );
  if (exact) return exact.name_en;

  const partial = DISTRICTS.find((district) =>
    lower.includes(district.name_en.toLowerCase()) || value.includes(district.name_kn)
  );
  return partial ? partial.name_en : value;
}

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
  const [cropMode, setCropMode] = useState<CropMode>('single');
  const [cropText, setCropText] = useState('');
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
      await speakText(text, sarvam);
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

  function finishOnboarding() {
    store.completeOnboarding();
    setStep('done');
    setTimeout(() => router.replace('/(tabs)/'), 1500);
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
    const t = transcript.trim();
    // Speak back what we heard so the user gets immediate confirmation
    try {
      await speakText(t, sarvam);
    } catch {}

    if (step === 'name') {
      const n = transcript.split(' ').slice(0, 4).join(' ');
      setName(n);
      store.setProfile({ farmer_name: n });
      setStep('loc');
      await speakQuestion(prompt.loc);
    } else if (step === 'loc') {
      const district = resolveDistrict(transcript);
      setLoc(district);
      store.setProfile({ district });
      setStep('mode');
      await speakQuestion(prompt.mode);
    } else if (step === 'mode') {
      const lower = transcript.toLowerCase();
      const multipleHints = ['many', 'multiple', 'ಹಲವು', 'ಬಹು', 'aneka', 'anek', 'ഒട്ടേറെ', 'অনেক', 'ઘણા', 'అనేక'];
      setCropMode(multipleHints.some((hint) => lower.includes(hint)) ? 'multiple' : 'single');
      setCropText('');
      setStep('crop');
      await speakQuestion(prompt.crop);
    } else if (step === 'crop') {
      const fallback = transcript
        .split(/,|and|ಮತ್ತು|और|மற்றும்|మరియు|ഒപ്പം|आणि|এবং|અને|ਅਤੇ|ଓ/)
        .map((c) => c.trim())
        .filter(Boolean);
      const chosen = fallback.length > 0 ? fallback : [transcript.trim()];
      if (cropMode === 'single') {
        store.setProfile({ crops: [chosen[0] ?? transcript], primary_crop: chosen[0] ?? transcript });
        finishOnboarding();
        return;
      }
      const cleaned = Array.from(new Set(chosen.filter(Boolean)));
      setCropText(cleaned.join(', '));
      store.setProfile({ crops: cleaned, primary_crop: cleaned[0] ?? transcript });
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

  const stepIcon = step === 'name' ? 'account' : step === 'loc' ? 'map-marker' : step === 'mode' ? 'shape' : 'sprout';
  const question = step === 'name' ? prompt.name : step === 'loc' ? prompt.loc : step === 'mode' ? prompt.mode : prompt.crop;
  const stepNum = step === 'name' ? 1 : step === 'loc' ? 2 : step === 'mode' ? 3 : 4;

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
      {(step === 'mode') && (
        <View style={styles.modeRow}>
          <TouchableOpacity style={[styles.modeBtn, cropMode === 'single' && styles.modeBtnActive]} onPress={() => setCropMode('single')}>
            <Text style={[styles.modeText, cropMode === 'single' && styles.modeTextActive]}>{prompt.single}</Text>
          </TouchableOpacity>
          <TouchableOpacity style={[styles.modeBtn, cropMode === 'multiple' && styles.modeBtnActive]} onPress={() => setCropMode('multiple')}>
            <Text style={[styles.modeText, cropMode === 'multiple' && styles.modeTextActive]}>{prompt.multiple}</Text>
          </TouchableOpacity>
        </View>
      )}
      {step === 'crop' && <Text style={styles.preview}>{cropText || prompt.crop}</Text>}

      {step === 'crop' && cropMode === 'multiple' && (
        <TouchableOpacity style={styles.doneBtn} onPress={finishOnboarding} activeOpacity={0.8}>
          <Text style={styles.doneBtnText}>{prompt.done}</Text>
        </TouchableOpacity>
      )}

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
  modeRow: { flexDirection: 'row', gap: Spacing.sm, marginBottom: Spacing.sm, flexWrap: 'wrap', justifyContent: 'center' },
  modeBtn: {
    paddingVertical: Spacing.sm,
    paddingHorizontal: Spacing.md,
    borderRadius: BorderRadius.md,
    backgroundColor: 'rgba(255,255,255,0.14)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.25)',
  },
  modeBtnActive: { backgroundColor: 'rgba(255,255,255,0.24)', borderColor: '#fff' },
  modeText: { color: 'rgba(255,255,255,0.8)', fontWeight: '700' },
  modeTextActive: { color: '#fff' },

  doneBtn: {
    marginBottom: Spacing.sm,
    backgroundColor: 'rgba(255,255,255,0.16)',
    paddingVertical: Spacing.sm,
    paddingHorizontal: Spacing.lg,
    borderRadius: BorderRadius.md,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.35)',
  },
  doneBtnText: { color: '#fff', fontWeight: '800' },

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
