/**
 * Onboarding Screen — Premium, farmer-friendly, non-voice onboarding flow.
 * Steps: Language Selection → Name Input → Location Permission → Crop Selection → Complete
 */

import React, { useState, useRef, useEffect } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity, ScrollView, TextInput,
  Animated, ActivityIndicator, Alert, KeyboardAvoidingView, Platform, Dimensions,
} from 'react-native';

const { width } = Dimensions.get('window');
import { LinearGradient } from 'expo-linear-gradient';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { Colors, Spacing, FontSize, BorderRadius, Shadows } from '@/constants/theme';
import { useUserStore } from '@/stores/useUserStore';
import { speakText } from '@/services/voiceService';

// Available districts
const DISTRICTS = [
  'Bengaluru Rural',
  'Dakshina Kannada',
  'Belagavi',
  'Shimoga',
  'Chikkamagaluru',
  'Hassan',
  'Mandya',
  'Mysuru',
  'Kolar',
  'Tumakuru'
];

const LANGUAGES = [
  { code: 'kn', label: 'ಕನ್ನಡ', sub: 'Kannada', locale: 'kn-IN', sample: 'ನಮಸ್ಕಾರ, ನಾನು ಕೃಷಿಮಿತ್ರ.' },
  { code: 'en', label: 'English', sub: 'English', locale: 'en-IN', sample: 'Hello, I am KrishiMitra.' },
  { code: 'hi', label: 'हिंदी', sub: 'Hindi', locale: 'hi-IN', sample: 'नमस्ते, मैं कृषि मित्र हूँ।' },
  { code: 'ta', label: 'தமிழ்', sub: 'Tamil', locale: 'ta-IN', sample: 'வணக்கம், நான் கிருஷி மித்ரா.' },
  { code: 'te', label: 'తెలుగు', sub: 'Telugu', locale: 'te-IN', sample: 'నమస్కారం, నేను కృషి మిత్ర.' },
  { code: 'ml', label: 'മലയാളം', sub: 'Malayalam', locale: 'ml-IN', sample: 'നമസ്കാരം, ഞാൻ കൃഷി মിത്ര.' },
  { code: 'mr', label: 'मराठी', sub: 'Marathi', locale: 'mr-IN', sample: 'नमस्कार, मी कृषी मित्र आहे.' },
];

const CROPS = [
  { id: 'potato', emoji: '🥔', labelEn: 'Potato', labelKn: 'ಆಲೂಗಡ್ಡೆ', tagEn: 'Good for cool climates', tagKn: 'ತಂಪಾದ ಹವಾಮಾನಕ್ಕೆ ಸೂಕ್ತ' },
  { id: 'ginger', emoji: '🌱', labelEn: 'Ginger', labelKn: 'ಶುಂಠಿ', tagEn: 'Good for monsoon areas', tagKn: 'ಮಳೆಗಾಲದ ಪ್ರದೇಶಗಳಿಗೆ ಸೂಕ್ತ' },
  { id: 'sugarcane', emoji: '🎋', labelEn: 'Sugarcane', labelKn: 'ಕಬ್ಬು', tagEn: 'High water requirement', tagKn: 'ಹೆಚ್ಚಿನ ನೀರಿನ ಅವಶ್ಯಕತೆ' },
  { id: 'ragi', emoji: '🌾', labelEn: 'Ragi', labelKn: 'ರಾಗಿ', tagEn: 'Drought resistant crop', tagKn: 'ಬರ ನಿರೋಧಕ ಬೆಳೆ' },
  { id: 'tomato', emoji: '🍅', labelEn: 'Tomato', labelKn: 'ಟೊಮೆಟೊ', tagEn: 'Needs regular monitoring', tagKn: 'ನಿಯಮಿತ ಮೇಲ್ವಿಚಾರಣೆ ಅಗತ್ಯ' },
  { id: 'onion', emoji: '🧅', labelEn: 'Onion', labelKn: 'ಈರುಳ್ಳಿ', tagEn: 'Requires good drainage', tagKn: 'ಉತ್ತಮ ನೀರು ಹರಿವು ಅಗತ್ಯ' },
  { id: 'arecanut', emoji: '🌴', labelEn: 'Arecanut', labelKn: 'ಅಡಿಕೆ', tagEn: 'Long-term commercial crop', tagKn: 'ದೀರ್ಘಾವಧಿಯ ವಾಣಿಜ್ಯ ಬೆಳೆ' },
  { id: 'paddy', emoji: '🌾', labelEn: 'Paddy', labelKn: 'ಭತ್ತ', tagEn: 'Requires flooded soil', tagKn: 'ನಿರಂತರ ನೀರಿನ ಆಶ್ರಯ ಬೇಕು' },
];

type Step = 'lang' | 'name' | 'loc' | 'crops' | 'done';

export default function OnboardingScreen() {
  const router = useRouter();
  const store = useUserStore();

  const [step, setStep] = useState<Step>('lang');
  const [selectedLang, setSelectedLang] = useState('kn');
  const [name, setName] = useState('');
  const [district, setDistrict] = useState('Dakshina Kannada');
  const [selectedCrops, setSelectedCrops] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);
  const [playingCode, setPlayingCode] = useState<string | null>(null);

  const isEn = selectedLang === 'en';

  const handlePlaySample = async (code: string, locale: string, sampleText: string, e: any) => {
    e.stopPropagation(); // Prevent card selection
    try {
      setPlayingCode(code);
      await speakText(sampleText, locale, true); // Force local speech engine
    } catch (err) {
      console.warn('[Onboarding] Play sample failed', err);
    } finally {
      setPlayingCode(null);
    }
  };

  const handleLanguageSelect = (code: string, locale: string) => {
    setSelectedLang(code);
    store.setLanguage(locale);
    setStep('name');
  };

  const handleNameSubmit = () => {
    const trimmed = name.trim();
    if (!trimmed) {
      Alert.alert(
        isEn ? 'Enter Name' : 'ಹೆಸರು ನಮೂದಿಸಿ',
        isEn ? 'Please type your name to continue.' : 'ಮುಂದುವರೆಯಲು ದಯವಿಟ್ಟು ನಿಮ್ಮ ಹೆಸರು ಬರೆಯಿರಿ.'
      );
      return;
    }
    if (trimmed.length > 40) {
      Alert.alert(isEn ? 'Too Long' : 'ಹೆಚ್ಚು ಅಕ್ಷರಗಳು', isEn ? 'Name must be under 40 characters' : 'ಹೆಸರು 40 ಅಕ್ಷರಗಳಿಗಿಂತ ಕಡಿಮೆ ಇರಬೇಕು');
      return;
    }
    store.setProfile({ farmer_name: trimmed });
    setStep('loc');
  };

  const handleLocationAllow = () => {
    setLoading(true);
    // Simulate reverse geocoding location permission
    setTimeout(() => {
      setDistrict('Dakshina Kannada');
      store.setProfile({ district: 'Dakshina Kannada' });
      setLoading(false);
      setStep('crops');
    }, 1000);
  };

  const handleManualDistrict = (selected: string) => {
    setDistrict(selected);
    store.setProfile({ district: selected });
    setStep('crops');
  };

  const handleToggleCrop = (cropId: string) => {
    setSelectedCrops(prev =>
      prev.includes(cropId) ? prev.filter(id => id !== cropId) : [...prev, cropId]
    );
  };

  const handleCropsSubmit = () => {
    if (selectedCrops.length === 0) {
      Alert.alert(
        isEn ? 'Select Crops' : 'ಬೆಳೆಗಳನ್ನು ಆರಿಸಿ',
        isEn ? 'Please select at least one crop.' : 'ದಯವಿಟ್ಟು ಕನಿಷ್ಠ ಒಂದು ಬೆಳೆಯನ್ನು ಆಯ್ಕೆ ಮಾಡಿ.'
      );
      return;
    }
    store.setProfile({
      crops: selectedCrops,
      primary_crop: selectedCrops[0],
    });
    setStep('done');
  };

  const handleComplete = () => {
    store.completeOnboarding();
    router.replace('/(tabs)');
  };

  // 1. Language Selection Screen
  if (step === 'lang') {
    return (
      <LinearGradient colors={[Colors.primaryDark, Colors.primary]} style={styles.root}>
        <View style={styles.header}>
          <Text style={styles.logoIcon}>🌱</Text>
          <Text style={styles.title}>KrishiMitra</Text>
          <Text style={styles.sub}>Choose your language / ನಿಮ್ಮ ಭಾಷೆ ಆಯ್ಕೆ ಮಾಡಿ</Text>
        </View>
        <ScrollView contentContainerStyle={styles.scrollGrid} showsVerticalScrollIndicator={false}>
          {LANGUAGES.map(l => (
            <TouchableOpacity
              key={l.code}
              style={[styles.langCard, selectedLang === l.code && styles.activeCard]}
              onPress={() => handleLanguageSelect(l.code, l.locale)}
              activeOpacity={0.8}
            >
              <View style={styles.langInfo}>
                <Text style={styles.langLabel}>{l.label}</Text>
                <Text style={styles.langSubLabel}>{l.sub}</Text>
              </View>
              <TouchableOpacity
                onPress={(e) => handlePlaySample(l.code, l.locale, l.sample, e)}
                style={styles.speakerBtn}
              >
                {playingCode === l.code ? (
                  <ActivityIndicator size="small" color={Colors.primary} />
                ) : (
                  <MaterialCommunityIcons name="volume-high" size={24} color={Colors.primary} />
                )}
              </TouchableOpacity>
            </TouchableOpacity>
          ))}
        </ScrollView>
      </LinearGradient>
    );
  }

  // 2. Name Input Screen
  if (step === 'name') {
    return (
      <LinearGradient colors={[Colors.primaryDark, Colors.primary]} style={styles.root}>
        <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={styles.centerWrapper}>
          <View style={styles.card}>
            <Text style={styles.cardTitle}>{isEn ? 'What should we call you?' : 'ನಿಮ್ಮ ಹೆಸರೇನು?'}</Text>
            <Text style={styles.cardSub}>
              {isEn 
                ? 'This name will be used by Mitra to greet you. (Hindi, Kannada, English, etc.)' 
                : 'ಮಿತ್ರನು ನಿಮ್ಮನ್ನು ಮಾತನಾಡಿಸಲು ಈ ಹೆಸರನ್ನು ಬಳಸುತ್ತಾನೆ.'}
            </Text>
            
            <TextInput
              style={styles.textInput}
              placeholder={isEn ? 'Type your name' : 'ನಿಮ್ಮ ಹೆಸರು ಟೈಪ್ ಮಾಡಿ'}
              placeholderTextColor={Colors.textMuted}
              value={name}
              onChangeText={setName}
              maxLength={40}
              autoFocus
            />

            <TouchableOpacity style={styles.primaryBtn} onPress={handleNameSubmit}>
              <Text style={styles.primaryBtnText}>{isEn ? 'Continue →' : 'ಮುಂದುವರೆಯಿರಿ →'}</Text>
            </TouchableOpacity>
          </View>
        </KeyboardAvoidingView>
      </LinearGradient>
    );
  }

  // 3. Location Permission Screen
  if (step === 'loc') {
    return (
      <LinearGradient colors={[Colors.primaryDark, Colors.primary]} style={styles.root}>
        <View style={styles.centerWrapper}>
          <View style={styles.card}>
            <View style={styles.locIconContainer}>
              <MaterialCommunityIcons name="map-marker-radius" size={48} color={Colors.primary} />
            </View>
            <Text style={styles.cardTitle}>{isEn ? 'Find your farm area' : 'ನಿಮ್ಮ ಕೃಷಿ ವಲಯ ಪತ್ತೆ ಮಾಡಿ'}</Text>
            <Text style={styles.cardSub}>
              {isEn 
                ? 'We use your location to show local weather, nearby market prices, and pest warnings.' 
                : 'ಸ್ಥಳೀಯ ಹವಾಮಾನ, ಹತ್ತಿರದ ಮಾರುಕಟ್ಟೆ ಧಾರಣೆ ಮತ್ತು ಕೀಟಗಳ ಎಚ್ಚರಿಕೆಯನ್ನು ನೀಡಲು ನಾವು ನಿಮ್ಮ ಸ್ಥಳವನ್ನು ಬಳಸುತ್ತೇವೆ.'}
            </Text>

            {loading ? (
              <ActivityIndicator size="large" color={Colors.primary} style={{ marginVertical: Spacing.md }} />
            ) : (
              <>
                <TouchableOpacity style={styles.primaryBtn} onPress={handleLocationAllow}>
                  <Text style={styles.primaryBtnText}>{isEn ? 'Allow Location' : 'ಸ್ಥಳ ಪ್ರವೇಶ ಅನುಮತಿಸಿ'}</Text>
                </TouchableOpacity>

                <Text style={styles.orText}>{isEn ? '— OR SELECT MANUALLY —' : '— ಅಥವಾ ಹಸ್ತಚಾಲಿತವಾಗಿ ಆಯ್ಕೆ ಮಾಡಿ —'}</Text>

                <ScrollView style={styles.districtList} nestedScrollEnabled>
                  {DISTRICTS.map(d => (
                    <TouchableOpacity key={d} style={styles.districtItem} onPress={() => handleManualDistrict(d)}>
                      <Text style={styles.districtText}>📍 {d}</Text>
                    </TouchableOpacity>
                  ))}
                </ScrollView>
              </>
            )}
          </View>
        </View>
      </LinearGradient>
    );
  }

  // 4. Crop Selection Screen
  if (step === 'crops') {
    return (
      <LinearGradient colors={[Colors.primaryDark, Colors.primary]} style={styles.root}>
        <View style={styles.header}>
          <Text style={styles.cardTitleWhite}>{isEn ? 'What are you growing?' : 'ನೀವು ಏನು ಬೆಳೆಯುತ್ತಿದ್ದೀರಿ?'}</Text>
          <Text style={styles.cardSubWhite}>{isEn ? 'Select one or more crops' : 'ಒಂದು ಅಥವಾ ಹೆಚ್ಚಿನ ಬೆಳೆಗಳನ್ನು ಆಯ್ಕೆ ಮಾಡಿ'}</Text>
        </View>

        <ScrollView contentContainerStyle={styles.cropsGrid} showsVerticalScrollIndicator={false}>
          {CROPS.map(c => {
            const active = selectedCrops.includes(c.id);
            return (
              <TouchableOpacity
                key={c.id}
                style={[styles.cropCard, active && styles.activeCropCard]}
                onPress={() => handleToggleCrop(c.id)}
                activeOpacity={0.8}
              >
                <View style={styles.cropIconRow}>
                  <Text style={styles.cropEmoji}>{c.emoji}</Text>
                  {active && (
                    <MaterialCommunityIcons name="check-circle" size={24} color={Colors.primary} />
                  )}
                </View>
                <Text style={styles.cropTitle}>{isEn ? c.labelEn : c.labelKn}</Text>
                <Text style={styles.cropTag}>{isEn ? c.tagEn : c.tagKn}</Text>
              </TouchableOpacity>
            );
          })}
        </ScrollView>

        <View style={styles.bottomBar}>
          <TouchableOpacity style={styles.primaryBtn} onPress={handleCropsSubmit}>
            <Text style={styles.primaryBtnText}>
              {isEn ? `Continue with ${selectedCrops.length} Crops` : `${selectedCrops.length} ಬೆಳೆಗಳೊಂದಿಗೆ ಮುಂದುವರೆಯಿರಿ`}
            </Text>
          </TouchableOpacity>
        </View>
      </LinearGradient>
    );
  }

  // 5. Complete Screen
  return (
    <LinearGradient colors={[Colors.primaryDark, Colors.primary]} style={styles.root}>
      <View style={[styles.centerWrapper, { padding: Spacing.xl }]}>
        <View style={styles.completeCard}>
          <View style={styles.mascotCircle}>
            <Text style={styles.mascotEmoji}>🌱</Text>
          </View>
          
          <Text style={styles.completeGreeting}>
            {isEn ? `Ready, ${name} anna! 👋` : `ಸಿದ್ಧವಾಗಿದೆ, ${name} ಅಣ್ಣಾ! 👋`}
          </Text>
          
          <Text style={styles.completeDescription}>
            {isEn 
              ? 'KrishiMitra is ready to guide your farm daily with smart voice advice and price forecasts.'
              : 'ಕೃಷಿಮಿತ್ರನು ನಿಮ್ಮ ತೋಟಕ್ಕೆ ಸ್ಮಾರ್ಟ್ ಧ್ವನಿ ಸಲಹೆ ಹಾಗೂ ಮಾರುಕಟ್ಟೆ ಮುನ್ಸೂಚನೆ ನೀಡಲು ಸಿದ್ಧನಾಗಿದ್ದಾನೆ.'}
          </Text>

          <TouchableOpacity style={styles.completeBtn} onPress={handleComplete}>
            <Text style={styles.completeBtnText}>{isEn ? 'Go to Home' : 'ಮುಖಪುಟಕ್ಕೆ ಹೋಗಿ'}</Text>
          </TouchableOpacity>
        </View>
      </View>
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  header: { alignItems: 'center', paddingTop: 60, paddingBottom: Spacing.md, paddingHorizontal: Spacing.lg },
  logoIcon: { fontSize: 52 },
  title: { fontSize: 32, fontWeight: '900', color: '#fff', marginTop: Spacing.xs },
  sub: { fontSize: FontSize.sm, color: 'rgba(255,255,255,0.8)', marginTop: 4, textAlign: 'center', fontWeight: '500' },
  
  scrollGrid: { paddingHorizontal: Spacing.lg, paddingBottom: 40, gap: Spacing.md },
  langCard: {
    backgroundColor: '#fff',
    borderRadius: BorderRadius.lg,
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.md,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    ...Shadows.sm,
  },
  activeCard: {
    borderWidth: 2,
    borderColor: Colors.accent,
    backgroundColor: '#F0F9F4',
  },
  langInfo: { flex: 1 },
  langLabel: { fontSize: FontSize.lg, fontWeight: '800', color: Colors.textPrimary },
  langSubLabel: { fontSize: FontSize.xs, color: Colors.textSecondary, marginTop: 2 },
  speakerBtn: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: '#E8F5E9',
    alignItems: 'center',
    justifyContent: 'center',
  },

  centerWrapper: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: Spacing.lg },
  card: {
    backgroundColor: '#fff',
    borderRadius: BorderRadius.xl,
    padding: Spacing.xl,
    width: '100%',
    ...Shadows.lg,
  },
  cardTitle: { fontSize: 22, fontWeight: '900', color: Colors.textPrimary, textAlign: 'center' },
  cardTitleWhite: { fontSize: 22, fontWeight: '900', color: '#fff', textAlign: 'center' },
  cardSub: { fontSize: FontSize.sm, color: Colors.textSecondary, textAlign: 'center', marginTop: Spacing.xs, marginBottom: Spacing.lg, lineHeight: 20 },
  cardSubWhite: { fontSize: FontSize.sm, color: 'rgba(255,255,255,0.8)', textAlign: 'center', marginTop: Spacing.xs, marginBottom: Spacing.md },
  
  textInput: {
    borderWidth: 1.5,
    borderColor: Colors.border,
    borderRadius: BorderRadius.lg,
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.md,
    fontSize: FontSize.lg,
    color: Colors.textPrimary,
    fontWeight: '700',
    marginBottom: Spacing.lg,
    backgroundColor: '#FAFAF5',
  },
  primaryBtn: {
    backgroundColor: Colors.accent,
    borderRadius: BorderRadius.lg,
    paddingVertical: Spacing.md,
    alignItems: 'center',
    ...Shadows.sm,
  },
  primaryBtnText: {
    fontSize: FontSize.md,
    fontWeight: '800',
    color: '#fff',
  },

  locIconContainer: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: '#E8F5E9',
    alignItems: 'center',
    justifyContent: 'center',
    alignSelf: 'center',
    marginBottom: Spacing.md,
  },
  orText: {
    fontSize: FontSize.xs,
    color: Colors.textMuted,
    fontWeight: '700',
    textAlign: 'center',
    marginVertical: Spacing.md,
    letterSpacing: 1,
  },
  districtList: {
    maxHeight: 140,
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: BorderRadius.lg,
  },
  districtItem: {
    paddingVertical: Spacing.sm,
    paddingHorizontal: Spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: Colors.divider,
  },
  districtText: {
    fontSize: FontSize.sm,
    color: Colors.textPrimary,
    fontWeight: '600',
  },

  cropsGrid: {
    paddingHorizontal: Spacing.md,
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.sm,
    paddingBottom: 100,
  },
  cropCard: {
    backgroundColor: '#fff',
    borderRadius: BorderRadius.lg,
    padding: Spacing.md,
    width: (width - Spacing.md * 2 - Spacing.sm) / 2,
    borderWidth: 1.5,
    borderColor: Colors.border,
    ...Shadows.sm,
  },
  activeCropCard: {
    borderColor: Colors.primary,
    backgroundColor: '#F0F9F4',
  },
  cropIconRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: Spacing.xs,
  },
  cropEmoji: { fontSize: 32 },
  cropTitle: { fontSize: FontSize.md, fontWeight: '800', color: Colors.textPrimary },
  cropTag: { fontSize: 10, color: Colors.textMuted, marginTop: 2 },
  bottomBar: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: '#fff',
    padding: Spacing.md,
    borderTopWidth: 1,
    borderTopColor: Colors.border,
  },

  completeCard: {
    backgroundColor: '#fff',
    borderRadius: BorderRadius.xl,
    padding: Spacing.xl,
    alignItems: 'center',
    width: '100%',
    ...Shadows.lg,
  },
  mascotCircle: {
    width: 100,
    height: 100,
    borderRadius: 50,
    backgroundColor: '#E8F5E9',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 3,
    borderColor: Colors.primary,
    marginBottom: Spacing.lg,
  },
  mascotEmoji: { fontSize: 52 },
  completeGreeting: { fontSize: 24, fontWeight: '900', color: Colors.primary, textAlign: 'center', marginBottom: Spacing.sm },
  completeDescription: { fontSize: FontSize.md, color: Colors.textSecondary, textAlign: 'center', lineHeight: 22, marginBottom: Spacing.xl, paddingHorizontal: Spacing.xs },
  completeBtn: {
    backgroundColor: Colors.primary,
    borderRadius: BorderRadius.lg,
    paddingVertical: Spacing.md,
    paddingHorizontal: Spacing.xl,
    width: '100%',
    alignItems: 'center',
    ...Shadows.md,
  },
  completeBtnText: {
    fontSize: FontSize.md,
    fontWeight: '800',
    color: '#fff',
  },
});
