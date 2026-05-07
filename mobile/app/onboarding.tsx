/**
 * Onboarding — Text-first with optional voice.
 * Steps: Language → Name → Location → Crops → Home
 * Text inputs work without backend. Voice is optional bonus.
 */
import React, { useState, useRef, useEffect } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity, ScrollView,
  Animated, TextInput, Alert, KeyboardAvoidingView, Platform,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { useUserStore } from '@/stores/useUserStore';
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

// ── Localised prompts ─────────────────────────────────────────────
const P: Record<string, { name: string; namePlaceholder: string; loc: string; locPlaceholder: string; crop: string; cropPlaceholder: string; welcome: string; next: string; done: string }> = {
  kn: { name: 'ನಿಮ್ಮ ಹೆಸರು ಏನು?', namePlaceholder: 'ನಿಮ್ಮ ಹೆಸರು ಟೈಪ್ ಮಾಡಿ', loc: 'ನಿಮ್ಮ ಜಿಲ್ಲೆ ಯಾವುದು?', locPlaceholder: 'ಉದಾ: ಬೆಂಗಳೂರು', crop: 'ನೀವು ಯಾವ ಬೆಳೆಗಳನ್ನು ಬೆಳೆಯುತ್ತೀರಿ?', cropPlaceholder: 'ಉದಾ: ರಾಗಿ, ಭತ್ತ', welcome: 'ಸ್ವಾಗತ', next: 'ಮುಂದೆ →', done: 'ಪ್ರಾರಂಭಿಸಿ 🚀' },
  hi: { name: 'आपका नाम क्या है?', namePlaceholder: 'अपना नाम लिखें', loc: 'आपका जिला कौन सा है?', locPlaceholder: 'उदा: बेंगलुरु', crop: 'आप कौन सी फसलें उगाते हैं?', cropPlaceholder: 'उदा: रागी, चावल', welcome: 'स्वागत है', next: 'आगे →', done: 'शुरू करें 🚀' },
  ta: { name: 'உங்கள் பெயர் என்ன?', namePlaceholder: 'பெயர் தட்டச்சு செய்யவும்', loc: 'உங்கள் மாவட்டம்?', locPlaceholder: 'எ.கா: பெங்களூர்', crop: 'என்ன பயிர்கள் வளர்க்கிறீர்கள்?', cropPlaceholder: 'எ.கா: ராகி, நெல்', welcome: 'வரவேற்கிறோம்', next: 'அடுத்து →', done: 'தொடங்கு 🚀' },
  te: { name: 'మీ పేరు ఏమిటి?', namePlaceholder: 'మీ పేరు టైప్ చేయండి', loc: 'మీ జిల్లా?', locPlaceholder: 'ఉదా: బెంగళూరు', crop: 'మీరు ఏ పంటలు పండిస్తారు?', cropPlaceholder: 'ఉదా: రాగి, వరి', welcome: 'స్వాగతం', next: 'తదుపరి →', done: 'ప్రారంభించు 🚀' },
  ml: { name: 'നിങ്ങളുടെ പേര്?', namePlaceholder: 'പേര് ടൈപ്പ് ചെയ്യുക', loc: 'നിങ്ങളുടെ ജില്ല?', locPlaceholder: 'ഉദാ: ബെംഗളൂരു', crop: 'എന്ത് വിളകൾ കൃഷി ചെയ്യുന്നു?', cropPlaceholder: 'ഉദാ: റാഗി, നെല്ല്', welcome: 'സ്വാഗതം', next: 'അടുത്തത് →', done: 'ആരംഭിക്കൂ 🚀' },
  mr: { name: 'तुमचे नाव काय?', namePlaceholder: 'नाव टाइप करा', loc: 'तुमचा जिल्हा?', locPlaceholder: 'उदा: बेंगळुरू', crop: 'तुम्ही कोणती पिके घेता?', cropPlaceholder: 'उदा: नाचणी, भात', welcome: 'स्वागत', next: 'पुढे →', done: 'सुरू करा 🚀' },
  bn: { name: 'আপনার নাম কি?', namePlaceholder: 'নাম টাইপ করুন', loc: 'আপনার জেলা?', locPlaceholder: 'উদা: বেঙ্গালুরু', crop: 'কী ফসল করেন?', cropPlaceholder: 'উদা: রাগি, ধান', welcome: 'স্বাগতম', next: 'পরবর্তী →', done: 'শুরু করুন 🚀' },
  gu: { name: 'તમારું નામ શું છે?', namePlaceholder: 'નામ ટાઇપ કરો', loc: 'તમારો જિલ્લો?', locPlaceholder: 'ઉદા: બેંગલુરુ', crop: 'શું પાક ઉગાડો છો?', cropPlaceholder: 'ઉદા: રાગી, ચોખા', welcome: 'સ્વાગત', next: 'આગળ →', done: 'શરૂ કરો 🚀' },
  pa: { name: 'ਤੁਹਾਡਾ ਨਾਂ ਕੀ ਹੈ?', namePlaceholder: 'ਨਾਂ ਟਾਈਪ ਕਰੋ', loc: 'ਤੁਹਾਡਾ ਜ਼ਿਲ੍ਹਾ?', locPlaceholder: 'ਉਦਾ: ਬੈਂਗਲੁਰੂ', crop: 'ਕੀ ਫ਼ਸਲਾਂ ਉਗਾਉਂਦੇ ਹੋ?', cropPlaceholder: 'ਉਦਾ: ਰਾਗੀ, ਚੌਲ', welcome: 'ਜੀ ਆਇਆਂ', next: 'ਅੱਗੇ →', done: 'ਸ਼ੁਰੂ ਕਰੋ 🚀' },
  od: { name: 'ଆପଣଙ୍କ ନାମ?', namePlaceholder: 'ନାମ ଟାଇପ୍ କରନ୍ତୁ', loc: 'ଆପଣଙ୍କ ଜିଲ୍ଲା?', locPlaceholder: 'ଉଦା: ବେଙ୍ଗାଲୁରୁ', crop: 'କଣ ଚାଷ କରନ୍ତି?', cropPlaceholder: 'ଉଦା: ରାଗି, ଧାନ', welcome: 'ସ୍ୱାଗତ', next: 'ପରବର୍ତ୍ତୀ →', done: 'ଆରମ୍ଭ କରନ୍ତୁ 🚀' },
  en: { name: 'What is your name?', namePlaceholder: 'Type your name', loc: 'What is your district?', locPlaceholder: 'e.g. Bengaluru Rural', crop: 'What crops do you grow?', cropPlaceholder: 'e.g. Ragi, Rice, Tomato', welcome: 'Welcome', next: 'Next →', done: 'Get Started 🚀' },
};

type Step = 'lang' | 'name' | 'loc' | 'crop' | 'done';

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
  const [name, setName] = useState('');
  const [loc, setLoc] = useState('');
  const [cropText, setCropText] = useState('');
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const slideAnim = useRef(new Animated.Value(40)).current;

  const prompt = P[langCode] ?? P['en'];

  useEffect(() => {
    fadeAnim.setValue(0);
    slideAnim.setValue(40);
    Animated.parallel([
      Animated.timing(fadeAnim, { toValue: 1, duration: 500, useNativeDriver: true }),
      Animated.timing(slideAnim, { toValue: 0, duration: 500, useNativeDriver: true }),
    ]).start();
  }, [step]);

  function onSelectLanguage(code: string, sv: string) {
    setLangCode(code);
    setSarvam(sv);
    store.setLanguage(sv);
    setStep('name');
  }

  function handleNameNext() {
    const n = name.trim();
    if (!n) {
      Alert.alert('', langCode === 'en' ? 'Please enter your name' : 'ದಯವಿಟ್ಟು ನಿಮ್ಮ ಹೆಸರನ್ನು ನಮೂದಿಸಿ');
      return;
    }
    store.setProfile({ farmer_name: n });
    setStep('loc');
  }

  function handleLocNext() {
    const d = loc.trim();
    if (!d) {
      Alert.alert('', langCode === 'en' ? 'Please enter your district' : 'ದಯವಿಟ್ಟು ನಿಮ್ಮ ಜಿಲ್ಲೆ ನಮೂದಿಸಿ');
      return;
    }
    const district = resolveDistrict(d);
    store.setProfile({ district });
    setStep('crop');
  }

  function handleCropDone() {
    const raw = cropText.trim();
    if (!raw) {
      Alert.alert('', langCode === 'en' ? 'Please enter at least one crop' : 'ದಯವಿಟ್ಟು ಕನಿಷ್ಠ ಒಂದು ಬೆಳೆ ನಮೂದಿಸಿ');
      return;
    }
    const crops = raw.split(/[,،、]/).map((c) => c.trim()).filter(Boolean);
    const unique = Array.from(new Set(crops));
    store.setProfile({ crops: unique, primary_crop: unique[0] });
    store.completeOnboarding();
    setStep('done');
    setTimeout(() => router.replace('/(tabs)/'), 1200);
  }

  // ── LANGUAGE SELECT ──────────────────────────────────────────────
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

  // ── DONE ─────────────────────────────────────────────────────────
  if (step === 'done') {
    return (
      <LinearGradient colors={['#1B5E20', '#2E7D32']} style={[styles.root, styles.center]}>
        <MaterialCommunityIcons name="check-circle" size={80} color="#fff" />
        <Text style={styles.doneText}>{prompt.welcome}, {name}!</Text>
      </LinearGradient>
    );
  }

  // ── STEPS: name / loc / crop ─────────────────────────────────────
  const stepIcon = step === 'name' ? 'account' : step === 'loc' ? 'map-marker' : 'sprout';
  const question = step === 'name' ? prompt.name : step === 'loc' ? prompt.loc : prompt.crop;
  const stepNum = step === 'name' ? 1 : step === 'loc' ? 2 : 3;

  return (
    <LinearGradient colors={['#1B5E20', '#2E7D32', '#388E3C']} style={[styles.root, styles.center]}>
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={styles.kav}>
        <Animated.View style={[styles.innerContent, { opacity: fadeAnim, transform: [{ translateY: slideAnim }] }]}>
          {/* Step indicator */}
          <View style={styles.stepRow}>
            {[1, 2, 3].map(n => (
              <View key={n} style={[styles.stepDot, n <= stepNum && styles.stepDotActive]} />
            ))}
          </View>

          {/* Icon */}
          <View style={styles.iconCircle}>
            <MaterialCommunityIcons name={stepIcon as any} size={40} color="#fff" />
          </View>

          {/* Question */}
          <Text style={styles.question}>{question}</Text>

          {/* Text Input */}
          {step === 'name' && (
            <TextInput
              style={styles.textInput}
              placeholder={prompt.namePlaceholder}
              placeholderTextColor="rgba(255,255,255,0.5)"
              value={name}
              onChangeText={setName}
              autoFocus
              returnKeyType="next"
              onSubmitEditing={handleNameNext}
            />
          )}
          {step === 'loc' && (
            <TextInput
              style={styles.textInput}
              placeholder={prompt.locPlaceholder}
              placeholderTextColor="rgba(255,255,255,0.5)"
              value={loc}
              onChangeText={setLoc}
              autoFocus
              returnKeyType="next"
              onSubmitEditing={handleLocNext}
            />
          )}
          {step === 'crop' && (
            <TextInput
              style={styles.textInput}
              placeholder={prompt.cropPlaceholder}
              placeholderTextColor="rgba(255,255,255,0.5)"
              value={cropText}
              onChangeText={setCropText}
              autoFocus
              returnKeyType="done"
              onSubmitEditing={handleCropDone}
            />
          )}

          {/* Next / Done Button */}
          <TouchableOpacity
            style={styles.nextBtn}
            onPress={step === 'name' ? handleNameNext : step === 'loc' ? handleLocNext : handleCropDone}
            activeOpacity={0.8}
          >
            <Text style={styles.nextBtnText}>
              {step === 'crop' ? prompt.done : prompt.next}
            </Text>
          </TouchableOpacity>
        </Animated.View>
      </KeyboardAvoidingView>
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  center: { alignItems: 'center', justifyContent: 'center' },
  kav: { flex: 1, width: '100%', alignItems: 'center', justifyContent: 'center', paddingHorizontal: Spacing.xl },

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

  innerContent: { width: '100%', alignItems: 'center' },

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

  question: { fontSize: 24, fontWeight: '800', color: '#fff', textAlign: 'center', lineHeight: 34, marginBottom: Spacing.lg },

  textInput: {
    width: '100%',
    fontSize: 20,
    fontWeight: '600',
    color: '#fff',
    borderWidth: 2,
    borderColor: 'rgba(255,255,255,0.4)',
    borderRadius: BorderRadius.lg,
    paddingVertical: Spacing.md,
    paddingHorizontal: Spacing.lg,
    backgroundColor: 'rgba(255,255,255,0.1)',
    textAlign: 'center',
    marginBottom: Spacing.lg,
  },

  nextBtn: {
    width: '100%',
    backgroundColor: '#fff',
    borderRadius: BorderRadius.lg,
    paddingVertical: Spacing.md,
    alignItems: 'center',
    ...Shadows.md,
  },
  nextBtnText: { fontSize: 18, fontWeight: '800', color: '#1B5E20' },

  doneText: { fontSize: 28, fontWeight: '900', color: '#fff', marginTop: Spacing.lg, textAlign: 'center' },
});
