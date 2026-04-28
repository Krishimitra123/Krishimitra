/**
 * Onboarding Screen — 3-step first-launch flow.
 * Step 1: Welcome + Nivetti Systems branding
 * Step 2: Farmer profile (name, district, crop)
 * Step 3: Quick tutorial (3 swipeable cards)
 */

import React, { useState, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TextInput,
  TouchableOpacity,
  ScrollView,
  Dimensions,
  FlatList,
  Alert,
  Image,
} from 'react-native';
import { useRouter } from 'expo-router';
import { LinearGradient } from 'expo-linear-gradient';
import { Colors, FontSize, Spacing, BorderRadius, Shadows } from '@/constants/theme';
import { useUserStore } from '@/stores/useUserStore';
import { DISTRICTS } from '@/constants/districts';
import { CROPS } from '@/constants/crops';

const { width: SCREEN_WIDTH } = Dimensions.get('window');

export default function OnboardingScreen() {
  const router = useRouter();
  const [step, setStep] = useState(0);
  const { setProfile, completeOnboarding } = useUserStore();

  // Profile form state
  const [name, setName] = useState('');
  const [selectedDistrict, setSelectedDistrict] = useState('');
  const [selectedCrops, setSelectedCrops] = useState<string[]>([]);
  const [districtSearch, setDistrictSearch] = useState('');
  const [cropSearch, setCropSearch] = useState('');

  // ── Step Navigation ───────────────────────────────────────────
  const handleNext = () => {
    if (step === 1) {
      if (!name.trim()) {
        Alert.alert('ಹೆಸರು ಅಗತ್ಯ', 'ದಯವಿಟ್ಟು ನಿಮ್ಮ ಹೆಸರನ್ನು ನಮೂದಿಸಿ');
        return;
      }
      if (!selectedDistrict) {
        Alert.alert('ಜಿಲ್ಲೆ ಅಗತ್ಯ', 'ದಯವಿಟ್ಟು ನಿಮ್ಮ ಜಿಲ್ಲೆಯನ್ನು ಆಯ್ಕೆ ಮಾಡಿ');
        return;
      }
      if (selectedCrops.length === 0) {
        Alert.alert('ಬೆಳೆ ಅಗತ್ಯ', 'ದಯವಿಟ್ಟು ಕನಿಷ್ಠ ಒಂದು ಬೆಳೆಯನ್ನು ಆಯ್ಕೆ ಮಾಡಿ');
        return;
      }
      // Save profile
      setProfile({
        farmer_name: name.trim(),
        district: selectedDistrict,
        primary_crop: selectedCrops[0],
        crops: selectedCrops,
      });
    }
    if (step < 2) {
      setStep(step + 1);
    }
  };

  const handleFinish = () => {
    completeOnboarding();
    router.replace('/(tabs)');
  };

  // ── Filtered lists ─────────────────────────────────────────────
  const filteredDistricts = DISTRICTS.filter(
    (d) =>
      d.name_en.toLowerCase().includes(districtSearch.toLowerCase()) ||
      d.name_kn.includes(districtSearch)
  );

  const filteredCrops = CROPS.filter(
    (c) =>
      c.name_en.toLowerCase().includes(cropSearch.toLowerCase()) ||
      c.name_kn.includes(cropSearch)
  );

  // ── Tutorial Cards ─────────────────────────────────────────────
  const tutorialCards = [
    {
      icon: '🎙️',
      title: 'ಮೈಕ್ ಒತ್ತಿ ಮಾತನಾಡಿ',
      desc: 'ಕನ್ನಡದಲ್ಲಿ ನಿಮ್ಮ ಪ್ರಶ್ನೆ ಕೇಳಿ. AI ಉತ್ತರಿಸುತ್ತದೆ.',
    },
    {
      icon: '📸',
      title: 'ಬೆಳೆ ಫೋಟೋ ತೆಗೆದು ರೋಗ ಪತ್ತೆ',
      desc: 'ಎಲೆ ಅಥವಾ ಹಣ್ಣಿನ ಫೋಟೋ ತೆಗೆಯಿರಿ. ರೋಗ ಗುರುತಿಸುತ್ತೇವೆ.',
    },
    {
      icon: '🌿',
      title: 'Nivetti Systems ಮೂಲಕ ನಿರ್ಮಿಸಲಾಗಿದೆ',
      desc: 'ಎಲ್ಲಾ ಉತ್ತರಗಳು ಪರಿಶೀಲಿಸಿದ ICAR / NIPHM ಮೂಲಗಳಿಂದ.',
    },
  ];

  // ── Render Steps ──────────────────────────────────────────────

  // STEP 0: Welcome
  if (step === 0) {
    return (
      <LinearGradient
        colors={[Colors.primaryDark, Colors.primary, Colors.primaryLight]}
        style={styles.fullScreen}
      >
        <View style={styles.welcomeContainer}>
          <View style={styles.logoCircle}>
            <Image
              source={require('@/assets/images/nivetti-logo.png')}
              style={styles.welcomeLogo}
              resizeMode="contain"
            />
          </View>
          <Text style={styles.welcomeTitle}>ನಮಸ್ಕಾರ!</Text>
          <Text style={styles.welcomeSubtitle}>
            KrishiMitra ಗೆ ಸ್ವಾಗತ
          </Text>
          <Text style={styles.welcomeDesc}>
            ಕರ್ನಾಟಕ ಜೈವಿಕ ಕೃಷಿ ರೈತರಿಗಾಗಿ AI ಸಹಾಯಕ
          </Text>

          <View style={styles.brandingRow}>
            <Text style={styles.brandingText}>by Nivetti Systems</Text>
          </View>

          <TouchableOpacity style={styles.nextBtn} onPress={handleNext}>
            <Text style={styles.nextBtnText}>ಮುಂದೆ →</Text>
          </TouchableOpacity>
        </View>
      </LinearGradient>
    );
  }

  // STEP 1: Profile
  if (step === 1) {
    return (
      <View style={styles.profileScreen}>
        <View style={styles.profileHeader}>
          <Text style={styles.stepIndicator}>ಹಂತ 2/3</Text>
          <Text style={styles.profileTitle}>ನಿಮ್ಮ ವಿವರಗಳು</Text>
        </View>

        <ScrollView
          contentContainerStyle={styles.profileForm}
          showsVerticalScrollIndicator={false}
        >
          {/* Name Input */}
          <View style={styles.formGroup}>
            <Text style={styles.formLabel}>🧑‍🌾 ನಿಮ್ಮ ಹೆಸರು:</Text>
            <TextInput
              style={styles.formInput}
              placeholder="ಹೆಸರು ಬರೆಯಿರಿ..."
              placeholderTextColor={Colors.textMuted}
              value={name}
              onChangeText={setName}
              autoCapitalize="words"
            />
          </View>

          {/* District Picker */}
          <View style={styles.formGroup}>
            <Text style={styles.formLabel}>📍 ಜಿಲ್ಲೆ:</Text>
            <TextInput
              style={styles.formInput}
              placeholder="ಜಿಲ್ಲೆ ಹುಡುಕಿ..."
              placeholderTextColor={Colors.textMuted}
              value={districtSearch}
              onChangeText={setDistrictSearch}
            />
            <View style={styles.chipGrid}>
              {filteredDistricts.slice(0, 12).map((d) => (
                <TouchableOpacity
                  key={d.name_en}
                  style={[
                    styles.chip,
                    selectedDistrict === d.name_en && styles.chipSelected,
                  ]}
                  onPress={() => {
                    setSelectedDistrict(d.name_en);
                    setDistrictSearch('');
                  }}
                >
                  <Text
                    style={[
                      styles.chipText,
                      selectedDistrict === d.name_en && styles.chipTextSelected,
                    ]}
                    numberOfLines={1}
                  >
                    {d.name_kn}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
            {selectedDistrict ? (
              <Text style={styles.selectedBadge}>✅ {selectedDistrict}</Text>
            ) : null}
          </View>

          {/* Crop Picker — Multi Select */}
          <View style={styles.formGroup}>
            <Text style={styles.formLabel}>🌾 ನಿಮ್ಮ ಬೆಳೆಗಳು (ಒಂದು ಅಥವಾ ಹೆಚ್ಚು ಆಯ್ಕೆ ಮಾಡಿ):</Text>
            <TextInput
              style={styles.formInput}
              placeholder="ಬೆಳೆ ಹುಡುಕಿ..."
              placeholderTextColor={Colors.textMuted}
              value={cropSearch}
              onChangeText={setCropSearch}
            />
            <View style={styles.chipGrid}>
              {filteredCrops.slice(0, 15).map((c) => {
                const isSelected = selectedCrops.includes(c.name_en);
                return (
                  <TouchableOpacity
                    key={c.name_en}
                    style={[
                      styles.chip,
                      isSelected && styles.chipSelected,
                    ]}
                    onPress={() => {
                      if (isSelected) {
                        setSelectedCrops(selectedCrops.filter(cr => cr !== c.name_en));
                      } else {
                        setSelectedCrops([...selectedCrops, c.name_en]);
                      }
                      setCropSearch('');
                    }}
                  >
                    <Text
                      style={[
                        styles.chipText,
                        isSelected && styles.chipTextSelected,
                      ]}
                    >
                      {isSelected ? '✓ ' : ''}{c.icon} {c.name_kn}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </View>
            {selectedCrops.length > 0 ? (
              <Text style={styles.selectedBadge}>✅ {selectedCrops.join(', ')} ({selectedCrops.length} ಬೆಳೆ)</Text>
            ) : null}
          </View>
        </ScrollView>

        <View style={styles.bottomBar}>
          <TouchableOpacity
            style={styles.backBtn}
            onPress={() => setStep(0)}
          >
            <Text style={styles.backBtnText}>← ಹಿಂದೆ</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.nextBtn} onPress={handleNext}>
            <Text style={styles.nextBtnText}>ಸಂರಕ್ಷಿಸಿ →</Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  }

  // STEP 2: Tutorial
  return (
    <View style={styles.tutorialScreen}>
      <View style={styles.profileHeader}>
        <Text style={styles.stepIndicator}>ಹಂತ 3/3</Text>
        <Text style={styles.profileTitle}>ಹೇಗೆ ಬಳಸುವುದು</Text>
      </View>

      <View style={styles.tutorialContent}>
        {tutorialCards.map((card, i) => (
          <View key={i} style={[styles.tutorialCard, Shadows.md]}>
            <Text style={styles.tutorialIcon}>{card.icon}</Text>
            <Text style={styles.tutorialTitle}>{card.title}</Text>
            <Text style={styles.tutorialDesc}>{card.desc}</Text>
          </View>
        ))}
      </View>

      <View style={styles.bottomBar}>
        <TouchableOpacity style={styles.backBtn} onPress={() => setStep(1)}>
          <Text style={styles.backBtnText}>← ಹಿಂದೆ</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.nextBtn, { backgroundColor: Colors.accent }]}
          onPress={handleFinish}
        >
          <Text style={styles.nextBtnText}>🚀 ಪ್ರಾರಂಭಿಸಿ</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  fullScreen: {
    flex: 1,
  },
  welcomeContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: Spacing.xl,
  },
  logoCircle: {
    width: 100,
    height: 100,
    borderRadius: 50,
    backgroundColor: 'rgba(255,255,255,0.2)',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: Spacing.lg,
  },
  welcomeLogo: {
    width: 80,
    height: 80,
  },
  logoEmoji: {
    fontSize: 50,
  },
  welcomeTitle: {
    fontSize: 42,
    fontWeight: '800',
    color: Colors.textOnPrimary,
    marginBottom: Spacing.xs,
  },
  welcomeSubtitle: {
    fontSize: FontSize.xxl,
    fontWeight: '600',
    color: 'rgba(255,255,255,0.9)',
    marginBottom: Spacing.md,
    textAlign: 'center',
  },
  welcomeDesc: {
    fontSize: FontSize.md,
    color: 'rgba(255,255,255,0.7)',
    textAlign: 'center',
    marginBottom: Spacing.xl,
  },
  brandingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: Spacing.xxl,
  },
  brandingText: {
    fontSize: FontSize.sm,
    color: 'rgba(255,255,255,0.5)',
    fontStyle: 'italic',
  },
  nextBtn: {
    backgroundColor: Colors.surface,
    paddingVertical: Spacing.md,
    paddingHorizontal: Spacing.xl,
    borderRadius: BorderRadius.full,
    minWidth: 180,
    alignItems: 'center',
  },
  nextBtnText: {
    fontSize: FontSize.lg,
    fontWeight: '700',
    color: Colors.primary,
  },
  profileScreen: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  profileHeader: {
    backgroundColor: Colors.primary,
    paddingTop: Spacing.xxl + Spacing.md,
    paddingBottom: Spacing.lg,
    paddingHorizontal: Spacing.lg,
  },
  stepIndicator: {
    fontSize: FontSize.sm,
    color: 'rgba(255,255,255,0.6)',
    marginBottom: 4,
  },
  profileTitle: {
    fontSize: FontSize.xxl,
    fontWeight: '800',
    color: Colors.textOnPrimary,
  },
  profileForm: {
    padding: Spacing.md,
    paddingBottom: 100,
  },
  formGroup: {
    marginBottom: Spacing.lg,
  },
  formLabel: {
    fontSize: FontSize.lg,
    fontWeight: '700',
    color: Colors.textPrimary,
    marginBottom: Spacing.sm,
  },
  formInput: {
    backgroundColor: Colors.surface,
    borderRadius: BorderRadius.md,
    padding: Spacing.md,
    fontSize: FontSize.md,
    color: Colors.textPrimary,
    borderWidth: 1,
    borderColor: Colors.border,
    marginBottom: Spacing.sm,
  },
  chipGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.xs,
  },
  chip: {
    backgroundColor: Colors.surface,
    borderRadius: BorderRadius.full,
    paddingVertical: Spacing.xs,
    paddingHorizontal: Spacing.md,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  chipSelected: {
    backgroundColor: Colors.primary,
    borderColor: Colors.primary,
  },
  chipText: {
    fontSize: FontSize.sm,
    color: Colors.textPrimary,
  },
  chipTextSelected: {
    color: Colors.textOnPrimary,
    fontWeight: '700',
  },
  selectedBadge: {
    fontSize: FontSize.md,
    color: Colors.primary,
    fontWeight: '700',
    marginTop: Spacing.sm,
  },
  bottomBar: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    flexDirection: 'row',
    justifyContent: 'space-between',
    padding: Spacing.md,
    paddingBottom: Spacing.xl,
    backgroundColor: Colors.surface,
    borderTopWidth: 1,
    borderTopColor: Colors.border,
  },
  backBtn: {
    paddingVertical: Spacing.md,
    paddingHorizontal: Spacing.lg,
  },
  backBtnText: {
    fontSize: FontSize.md,
    color: Colors.textSecondary,
    fontWeight: '600',
  },
  tutorialScreen: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  tutorialContent: {
    flex: 1,
    padding: Spacing.md,
    justifyContent: 'center',
    gap: Spacing.md,
  },
  tutorialCard: {
    backgroundColor: Colors.surface,
    borderRadius: BorderRadius.lg,
    padding: Spacing.lg,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: Colors.border,
  },
  tutorialIcon: {
    fontSize: 40,
    marginBottom: Spacing.sm,
  },
  tutorialTitle: {
    fontSize: FontSize.lg,
    fontWeight: '700',
    color: Colors.textPrimary,
    textAlign: 'center',
    marginBottom: Spacing.xs,
  },
  tutorialDesc: {
    fontSize: FontSize.md,
    color: Colors.textSecondary,
    textAlign: 'center',
    lineHeight: 22,
  },
});
