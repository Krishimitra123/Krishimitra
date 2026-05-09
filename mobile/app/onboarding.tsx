/**
 * Onboarding — Voice-first, all 11 languages.
 * Steps: Language → Name → Location → Done
 * Includes text input fallback + better error feedback.
 */
import React, { useState, useRef, useEffect } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity, ScrollView, TextInput,
  Animated, ActivityIndicator, Alert, KeyboardAvoidingView, Platform,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { useUserStore } from '@/stores/useUserStore';
import { transcribeAudio } from '@/services/queryService';
import { startRecording, stopRecordingAndGetBase64, speakText } from '@/services/voiceService';
import { DISTRICTS } from '@/constants/districts';
import { Colors, Spacing, FontSize, BorderRadius, Shadows } from '@/constants/theme';

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

const P: Record<string, { name: string; loc: string; welcome: string; tapMic: string; noHear: string; typeName: string; typeLoc: string }> = {
  kn: { name: 'ನಿಮ್ಮ ಹೆಸರು ಏನು?', loc: 'ದಯವಿಟ್ಟು ನಿಮ್ಮ ಜಿಲ್ಲೆ ಹೇಳಿ', welcome: 'ಸ್ವಾಗತ', tapMic: 'ಮೈಕ್ ಒತ್ತಿ ಮಾತನಾಡಿ', noHear: 'ಕೇಳಲಿಲ್ಲ. ಮತ್ತೆ ಪ್ರಯತ್ನಿಸಿ ಅಥವಾ ಟೈಪ್ ಮಾಡಿ', typeName: 'ಹೆಸರು ಟೈಪ್ ಮಾಡಿ', typeLoc: 'ಜಿಲ್ಲೆ ಟೈಪ್ ಮಾಡಿ' },
  hi: { name: 'आपका नाम क्या है?', loc: 'कृपया अपना जिला बताइए', welcome: 'स्वागत है', tapMic: 'माइक दबाकर बोलें', noHear: 'सुनाई नहीं दिया। फिर बोलें या टाइप करें', typeName: 'नाम टाइप करें', typeLoc: 'जिला टाइप करें' },
  ta: { name: 'உங்கள் பெயர் என்ன?', loc: 'தயவுசெய்து உங்கள் மாவட்டத்தை சொல்லுங்கள்', welcome: 'வரவேற்கிறோம்', tapMic: 'மைக்கை அழுத்தி பேசுங்கள்', noHear: 'கேட்கவில்லை. மீண்டும் முயற்சிக்கவும்', typeName: 'பெயர் டைப் செய்யவும்', typeLoc: 'மாவட்டம் டைப் செய்யவும்' },
  te: { name: 'మీ పేరు ఏమిటి?', loc: 'దయచేసి మీ జిల్లాను చెప్పండి', welcome: 'స్వాగతం', tapMic: 'మైక్ నొక్కి మాట్లాడండి', noHear: 'వినపడలేదు. మళ్ళీ ప్రయత్నించండి', typeName: 'పేరు టైప్ చేయండి', typeLoc: 'జిల్లా టైప్ చేయండి' },
  ml: { name: 'നിങ്ങളുടെ പേര്?', loc: 'ദയവായി നിങ്ങളുടെ ജില്ല പറയൂ', welcome: 'സ്വാഗതം', tapMic: 'മൈക്ക് അമർത്തി സംസാരിക്കൂ', noHear: 'കേട്ടില്ല. വീണ്ടും ശ്രമിക്കൂ', typeName: 'പേര് ടൈപ്പ് ചെയ്യൂ', typeLoc: 'ജില്ല ടൈപ്പ് ചെയ്യൂ' },
  mr: { name: 'तुमचे नाव काय?', loc: 'कृपया तुमचा जिल्हा सांगा', welcome: 'स्वागत', tapMic: 'मायक दाबून बोला', noHear: 'ऐकू आले नाही. पुन्हा बोला', typeName: 'नाव टाइप करा', typeLoc: 'जिल्हा टाइप करा' },
  bn: { name: 'আপনার নাম কি?', loc: 'দয়া করে আপনার জেলা বলুন', welcome: 'স্বাগতম', tapMic: 'মাইক চাপুন এবং বলুন', noHear: 'শোনা যায়নি। আবার চেষ্টা করুন', typeName: 'নাম টাইপ করুন', typeLoc: 'জেলা টাইপ করুন' },
  gu: { name: 'તમારું નામ શું છે?', loc: 'કૃપા કરીને તમારો જિલ્લો કહો', welcome: 'સ્વાગત', tapMic: 'માઇક દબાવી બોલો', noHear: 'સાંભળ્યું નહીં. ફરી બોલો', typeName: 'નામ ટાઈપ કરો', typeLoc: 'જિલ્લો ટાઈપ કરો' },
  pa: { name: 'ਤੁਹਾਡਾ ਨਾਂ ਕੀ ਹੈ?', loc: 'ਕਿਰਪਾ ਕਰਕੇ ਆਪਣਾ ਜ਼ਿਲ੍ਹਾ ਦੱਸੋ', welcome: 'ਜੀ ਆਇਆਂ', tapMic: 'ਮਾਈਕ ਦਬਾਓ ਅਤੇ ਬੋਲੋ', noHear: 'ਸੁਣਿਆ ਨਹੀਂ। ਦੁਬਾਰਾ ਬੋਲੋ', typeName: 'ਨਾਂ ਟਾਈਪ ਕਰੋ', typeLoc: 'ਜ਼ਿਲ੍ਹਾ ਟਾਈਪ ਕਰੋ' },
  od: { name: 'ଆପଣଙ୍କ ନାମ?', loc: 'ଦୟାକରି ଆପଣଙ୍କ ଜିଲ୍ଲା କୁହନ୍ତୁ', welcome: 'ସ୍ୱାଗତ', tapMic: 'ମାଇକ୍ ଦବାଇ କୁହନ୍ତୁ', noHear: 'ଶୁଣିଲି ନାହିଁ। ପୁଣି ଚେଷ୍ଟା କରନ୍ତୁ', typeName: 'ନାମ ଟାଇପ୍ କରନ୍ତୁ', typeLoc: 'ଜିଲ୍ଲା ଟାଇପ୍ କରନ୍ତୁ' },
  en: { name: 'What is your name?', loc: 'Please say your district', welcome: 'Welcome', tapMic: 'Tap mic and speak', noHear: "Couldn't hear you. Try again or type below", typeName: 'Type your name', typeLoc: 'Type your district' },
};

type Step = 'lang' | 'name' | 'loc' | 'done';

function resolveDistrict(raw: string): string {
  const value = raw.trim();
  if (!value) return '';
  const lower = value.toLowerCase();
  const exact = DISTRICTS.find((d) => d.name_en.toLowerCase() === lower || d.name_kn === value);
  if (exact) return exact.name_en;
  const partial = DISTRICTS.find((d) => lower.includes(d.name_en.toLowerCase()) || value.includes(d.name_kn));
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
  const [showTextInput, setShowTextInput] = useState(false);
  const [textValue, setTextValue] = useState('');
  const pulseAnim = useRef(new Animated.Value(1)).current;

  const prompt = P[langCode] ?? P['kn'];

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

  async function speakQuestion(text: string) {
    try { setBusy(true); setStatus('🔊'); await speakText(text, sarvam); }
    catch {} finally { setBusy(false); setStatus(prompt.tapMic); }
  }

  async function onSelectLanguage(code: string, sv: string) {
    setLangCode(code); setSarvam(sv); store.setLanguage(sv);
    setStep('name');
    setShowTextInput(false);
    setTextValue('');
    await speakQuestion(P[code]?.name ?? P['kn'].name);
  }

  function finishOnboarding() {
    store.completeOnboarding();
    setStep('done');
    setTimeout(() => router.replace('/(tabs)'), 1500);
  }

  function saveAndAdvance(value: string) {
    if (!value.trim()) return;

    if (step === 'name') {
      const n = value.trim().split(' ').slice(0, 4).join(' ');
      setName(n);
      store.setProfile({ farmer_name: n });
      setStep('loc');
      setShowTextInput(false);
      setTextValue('');
      speakQuestion(prompt.loc);
    } else if (step === 'loc') {
      const district = resolveDistrict(value);
      setLoc(district);
      store.setProfile({ district });
      finishOnboarding();
    }
  }

  async function handleRecord() {
    if (recording) {
      try {
        setRecording(false); setBusy(true); setStatus('...');
        const audio = await stopRecordingAndGetBase64();
        const result = await transcribeAudio(audio.base64, audio.mimeType, sarvam);
        const transcript = result.transcript.trim();

        if (!transcript) {
          // STT returned empty — show feedback and enable text fallback
          setStatus(prompt.noHear);
          setShowTextInput(true);
          setBusy(false);
          return;
        }

        // Show what we heard
        setStatus(`✓ ${transcript}`);
        saveAndAdvance(transcript);
      } catch (e: any) {
        console.error('[Onboarding] Record error:', e.message);
        setStatus(prompt.noHear);
        setShowTextInput(true);
      } finally { setBusy(false); }
    } else {
      try { await startRecording(); setRecording(true); setStatus('🎙️ ...'); }
      catch (e: any) {
        Alert.alert(
          langCode === 'en' ? 'Permission Denied' : 'ಅನುಮತಿ ನಿರಾಕರಿಸಲಾಗಿದೆ',
          langCode === 'en' ? 'Please allow microphone access.' : 'ದಯವಿಟ್ಟು ಮೈಕ್ರೊಫೋನ್ ಅನುಮತಿ ನೀಡಿ.'
        );
      }
    }
  }

  function handleTextSubmit() {
    if (!textValue.trim()) return;
    saveAndAdvance(textValue);
  }

  // ── Language selection screen ──
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
            <TouchableOpacity key={l.code} style={styles.langCard}
              onPress={() => onSelectLanguage(l.code, l.sarvam)} activeOpacity={0.75}>
              <Text style={styles.langCardLabel}>{l.label}</Text>
              <Text style={styles.langCardSub}>{l.sub}</Text>
            </TouchableOpacity>
          ))}
        </ScrollView>
      </LinearGradient>
    );
  }

  // ── Done screen ──
  if (step === 'done') {
    return (
      <LinearGradient colors={['#1B5E20', '#2E7D32']} style={[styles.root, styles.center]}>
        <MaterialCommunityIcons name="check-circle" size={80} color="#fff" />
        <Text style={styles.doneText}>{prompt.welcome}, {name || ''}!</Text>
      </LinearGradient>
    );
  }

  // ── Name / Location input screen ──
  const stepIcon = step === 'name' ? 'account' : 'map-marker';
  const question = step === 'name' ? prompt.name : prompt.loc;
  const stepNum = step === 'name' ? 1 : 2;
  const placeholder = step === 'name' ? prompt.typeName : prompt.typeLoc;

  return (
    <LinearGradient colors={['#1B5E20', '#2E7D32', '#388E3C']} style={[styles.root, styles.center]}>
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={styles.center}>
        <View style={styles.stepRow}>
          {[1, 2].map(n => (
            <View key={n} style={[styles.stepDot, n === stepNum && styles.stepDotActive]} />
          ))}
        </View>
        <View style={styles.iconCircle}>
          <MaterialCommunityIcons name={stepIcon as any} size={40} color="#fff" />
        </View>
        <Text style={styles.question}>{question}</Text>
        {(step === 'name' && name) && <Text style={styles.preview}>✓ {name}</Text>}
        {(step === 'loc' && loc) && <Text style={styles.preview}>✓ {loc}</Text>}
        <Text style={styles.statusText}>{busy ? '...' : status || prompt.tapMic}</Text>

        {/* Mic button */}
        <TouchableOpacity onPress={handleRecord} disabled={busy} activeOpacity={0.8}>
          <Animated.View style={[styles.micBtn, recording && styles.micBtnActive, { transform: [{ scale: pulseAnim }] }]}>
            {busy ? <ActivityIndicator size="large" color="#fff" />
              : <MaterialCommunityIcons name={recording ? 'stop' : 'microphone'} size={44} color="#fff" />}
          </Animated.View>
        </TouchableOpacity>
        <Text style={styles.hint}>
          {recording ? '🔴 Recording...' : prompt.tapMic}
        </Text>

        {/* Text input fallback — always visible with a toggle */}
        <TouchableOpacity onPress={() => setShowTextInput(!showTextInput)} style={styles.typeToggle}>
          <MaterialCommunityIcons name="keyboard" size={16} color="rgba(255,255,255,0.7)" />
          <Text style={styles.typeToggleText}>
            {showTextInput ? (langCode === 'en' ? 'Hide keyboard' : 'ಕೀಬೋರ್ಡ್ ಮುಚ್ಚಿ') : (langCode === 'en' ? 'Or type instead' : 'ಅಥವಾ ಟೈಪ್ ಮಾಡಿ')}
          </Text>
        </TouchableOpacity>

        {showTextInput && (
          <View style={styles.textRow}>
            <TextInput
              style={styles.textInput}
              placeholder={placeholder}
              placeholderTextColor="rgba(255,255,255,0.4)"
              value={textValue}
              onChangeText={setTextValue}
              returnKeyType="done"
              onSubmitEditing={handleTextSubmit}
              autoFocus
            />
            <TouchableOpacity
              onPress={handleTextSubmit}
              disabled={!textValue.trim()}
              style={[styles.submitBtn, !textValue.trim() && styles.submitBtnOff]}
            >
              <MaterialCommunityIcons name="check" size={22} color="#fff" />
            </TouchableOpacity>
          </View>
        )}
      </KeyboardAvoidingView>
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: Spacing.xl },
  langHeader: { alignItems: 'center', paddingTop: 60, paddingBottom: Spacing.lg },
  langTitle: { fontSize: 28, fontWeight: '900', color: '#fff', marginTop: Spacing.sm },
  langSub: { fontSize: 14, color: 'rgba(255,255,255,0.75)', marginTop: 4, textAlign: 'center' },
  langGrid: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'center', gap: 12, paddingHorizontal: Spacing.lg, paddingBottom: 40 },
  langCard: { backgroundColor: 'rgba(255,255,255,0.15)', borderRadius: BorderRadius.lg, borderWidth: 1.5, borderColor: 'rgba(255,255,255,0.3)', paddingVertical: 14, paddingHorizontal: 18, minWidth: '40%', alignItems: 'center' },
  langCardLabel: { fontSize: 20, color: '#fff', fontWeight: '700' },
  langCardSub: { fontSize: 12, color: 'rgba(255,255,255,0.7)', marginTop: 2 },
  stepRow: { flexDirection: 'row', gap: 8, marginBottom: Spacing.xl },
  stepDot: { width: 8, height: 8, borderRadius: 4, backgroundColor: 'rgba(255,255,255,0.35)' },
  stepDotActive: { backgroundColor: '#fff', width: 24 },
  iconCircle: { width: 90, height: 90, borderRadius: 45, backgroundColor: 'rgba(255,255,255,0.15)', alignItems: 'center', justifyContent: 'center', marginBottom: Spacing.lg, borderWidth: 2, borderColor: 'rgba(255,255,255,0.3)' },
  question: { fontSize: 24, fontWeight: '800', color: '#fff', textAlign: 'center', lineHeight: 34, marginBottom: Spacing.sm },
  preview: { fontSize: 18, color: '#A5D6A7', fontWeight: '600', textAlign: 'center', marginBottom: Spacing.sm },
  statusText: { fontSize: 14, color: 'rgba(255,255,255,0.7)', marginBottom: Spacing.lg, textAlign: 'center', paddingHorizontal: Spacing.md },
  micBtn: { width: 110, height: 110, borderRadius: 55, backgroundColor: 'rgba(255,255,255,0.2)', alignItems: 'center', justifyContent: 'center', borderWidth: 3, borderColor: 'rgba(255,255,255,0.5)', ...Shadows.md },
  micBtnActive: { backgroundColor: 'rgba(244,67,54,0.7)', borderColor: '#EF9A9A' },
  hint: { fontSize: 13, color: 'rgba(255,255,255,0.6)', marginTop: Spacing.md },
  doneText: { fontSize: 28, fontWeight: '900', color: '#fff', marginTop: Spacing.lg, textAlign: 'center' },
  typeToggle: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: Spacing.xl, paddingVertical: 8, paddingHorizontal: 16, backgroundColor: 'rgba(255,255,255,0.1)', borderRadius: BorderRadius.full },
  typeToggleText: { fontSize: 13, color: 'rgba(255,255,255,0.7)' },
  textRow: { flexDirection: 'row', gap: 8, marginTop: Spacing.md, width: '100%' },
  textInput: { flex: 1, backgroundColor: 'rgba(255,255,255,0.15)', borderRadius: BorderRadius.lg, paddingHorizontal: Spacing.md, paddingVertical: 12, fontSize: 16, color: '#fff', borderWidth: 1, borderColor: 'rgba(255,255,255,0.3)' },
  submitBtn: { width: 48, height: 48, borderRadius: 24, backgroundColor: '#4CAF50', alignItems: 'center', justifyContent: 'center' },
  submitBtnOff: { backgroundColor: 'rgba(255,255,255,0.15)' },
});
