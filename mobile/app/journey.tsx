/**
 * Farmer Journey Screen — Visual step-by-step workflow.
 * Register → Crop Details → AI Analysis → Recommendation → Better Yield
 */

import React, { useEffect, useRef } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity,
  Animated, StatusBar, Dimensions,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { Colors, FontSize, Spacing, BorderRadius, Shadows } from '@/constants/theme';
import { useUserStore } from '@/stores/useUserStore';
import { t } from '@/constants/i18n';

const { width } = Dimensions.get('window');

interface JourneyStep {
  icon: string;
  title_en: string;
  title_kn: string;
  desc_en: string;
  desc_kn: string;
  color: string;
  gradient: [string, string];
  route?: string;
}

const JOURNEY_STEPS: JourneyStep[] = [
  {
    icon: 'account-plus',
    title_en: 'Registration',
    title_kn: 'ನೋಂದಣಿ',
    desc_en: 'Farmer registers with name, phone, district, and preferred language. Simple OTP-based login.',
    desc_kn: 'ರೈತರು ಹೆಸರು, ಫೋನ್, ಜಿಲ್ಲೆ ಮತ್ತು ಭಾಷೆಯೊಂದಿಗೆ ನೋಂದಾಯಿಸುತ್ತಾರೆ.',
    color: '#1565C0',
    gradient: ['#1565C0', '#1976D2'],
    route: '/login',
  },
  {
    icon: 'sprout',
    title_en: 'Crop Details',
    title_kn: 'ಬೆಳೆ ವಿವರಗಳು',
    desc_en: 'Select your crops, soil type, and farming area. The app personalizes everything for your farm.',
    desc_kn: 'ನಿಮ್ಮ ಬೆಳೆಗಳು, ಮಣ್ಣಿನ ಪ್ರಕಾರ ಮತ್ತು ಕೃಷಿ ಪ್ರದೇಶವನ್ನು ಆಯ್ಕೆಮಾಡಿ.',
    color: '#2E7D32',
    gradient: ['#2E7D32', '#43A047'],
    route: '/onboarding',
  },
  {
    icon: 'brain',
    title_en: 'AI Analysis',
    title_kn: 'AI ವಿಶ್ಲೇಷಣೆ',
    desc_en: 'AI analyzes weather, soil, market prices, and disease patterns for your specific location and crops.',
    desc_kn: 'AI ನಿಮ್ಮ ಸ್ಥಳ ಮತ್ತು ಬೆಳೆಗಳಿಗೆ ಹವಾಮಾನ, ಮಣ್ಣು, ಮಾರುಕಟ್ಟೆ ಬೆಲೆ ವಿಶ್ಲೇಷಿಸುತ್ತದೆ.',
    color: '#6A1B9A',
    gradient: ['#6A1B9A', '#7B1FA2'],
    route: '/(tabs)/dashboard',
  },
  {
    icon: 'lightbulb-on',
    title_en: 'Recommendation',
    title_kn: 'ಶಿಫಾರಸು',
    desc_en: 'Get personalized advice: when to irrigate, spray, harvest, and sell. Voice answers in your language.',
    desc_kn: 'ವೈಯಕ್ತಿಕ ಸಲಹೆ ಪಡೆಯಿರಿ: ಯಾವಾಗ ನೀರು, ಔಷಧಿ, ಕೊಯ್ಲು ಮತ್ತು ಮಾರಾಟ.',
    color: '#E65100',
    gradient: ['#E65100', '#EF6C00'],
    route: '/(tabs)/chat',
  },
  {
    icon: 'chart-line',
    title_en: 'Better Yield',
    title_kn: 'ಉತ್ತಮ ಇಳುವರಿ',
    desc_en: 'Follow AI advice → higher production, better prices, increased profit. Track your progress over time.',
    desc_kn: 'AI ಸಲಹೆ ಅನುಸರಿಸಿ → ಹೆಚ್ಚಿನ ಉತ್ಪಾದನೆ, ಉತ್ತಮ ಬೆಲೆ, ಹೆಚ್ಚಿನ ಲಾಭ.',
    color: '#1B5E20',
    gradient: ['#1B5E20', '#2E7D32'],
    route: '/(tabs)/analytics',
  },
];

function StepCard({
  step,
  index,
  isEn,
  isLast,
  onPress,
}: {
  step: JourneyStep;
  index: number;
  isEn: boolean;
  isLast: boolean;
  onPress: () => void;
}) {
  const slideAnim = useRef(new Animated.Value(50)).current;
  const opacityAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.parallel([
      Animated.timing(slideAnim, {
        toValue: 0,
        duration: 500,
        delay: index * 120,
        useNativeDriver: true,
      }),
      Animated.timing(opacityAnim, {
        toValue: 1,
        duration: 500,
        delay: index * 120,
        useNativeDriver: true,
      }),
    ]).start();
  }, []);

  return (
    <Animated.View
      style={{
        transform: [{ translateY: slideAnim }],
        opacity: opacityAnim,
      }}
    >
      <TouchableOpacity
        style={styles.stepCard}
        onPress={onPress}
        activeOpacity={0.85}
      >
        <View style={styles.stepLeft}>
          {/* Step number + connector */}
          <View style={styles.stepNumberContainer}>
            <LinearGradient colors={step.gradient} style={styles.stepNumber}>
              <Text style={styles.stepNumberText}>{index + 1}</Text>
            </LinearGradient>
            {!isLast && <View style={[styles.stepConnector, { backgroundColor: step.color + '40' }]} />}
          </View>
        </View>

        <View style={styles.stepContent}>
          <LinearGradient
            colors={[step.color + '08', step.color + '03']}
            style={styles.stepBody}
          >
            <View style={[styles.stepIconCircle, { backgroundColor: step.color + '15' }]}>
              <MaterialCommunityIcons name={step.icon as any} size={28} color={step.color} />
            </View>
            <Text style={[styles.stepTitle, { color: step.color }]}>
              {isEn ? step.title_en : step.title_kn}
            </Text>
            <Text style={styles.stepDesc}>
              {isEn ? step.desc_en : step.desc_kn}
            </Text>
            <View style={styles.stepArrow}>
              <MaterialCommunityIcons name="arrow-right-circle" size={20} color={step.color + '60'} />
            </View>
          </LinearGradient>
        </View>
      </TouchableOpacity>
    </Animated.View>
  );
}

export default function JourneyScreen() {
  const router = useRouter();
  const { preferred_language } = useUserStore();
  const isEn = preferred_language?.startsWith('en');

  return (
    <View style={styles.container}>
      <StatusBar barStyle="light-content" />

      {/* Header */}
      <LinearGradient colors={['#4A148C', '#6A1B9A']} style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
          <MaterialCommunityIcons name="arrow-left" size={24} color="#fff" />
        </TouchableOpacity>
        <View>
          <Text style={styles.headerTitle}>{t('farmerJourney')}</Text>
          <Text style={styles.headerSub}>
            {isEn ? 'Your path from registration to better harvest' : 'ನೋಂದಣಿಯಿಂದ ಉತ್ತಮ ಕೊಯ್ಲಿಗೆ ನಿಮ್ಮ ಹಾದಿ'}
          </Text>
        </View>
      </LinearGradient>

      <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
        {/* End-to-End Flow Diagram */}
        <View style={styles.flowCard}>
          <Text style={styles.flowTitle}>
            {isEn ? '🔄 End-to-End Flow' : '🔄 ಸಂಪೂರ್ಣ ಹರಿವು'}
          </Text>
          <View style={styles.flowDiagram}>
            {['🧑‍🌾', '📱', '🌾', '🧠', '💡', '📈'].map((emoji, i) => (
              <React.Fragment key={i}>
                <View style={styles.flowNode}>
                  <Text style={styles.flowEmoji}>{emoji}</Text>
                </View>
                {i < 5 && (
                  <MaterialCommunityIcons name="chevron-right" size={16} color={Colors.textMuted} />
                )}
              </React.Fragment>
            ))}
          </View>
          <Text style={styles.flowDesc}>
            {isEn
              ? 'Farmer → App → Crop Data → AI Analysis → Recommendation → Better Yield'
              : 'ರೈತ → ಅಪ್ಲಿಕೇಶನ್ → ಬೆಳೆ ಡೇಟಾ → AI ವಿಶ್ಲೇಷಣೆ → ಶಿಫಾರಸು → ಉತ್ತಮ ಇಳುವರಿ'}
          </Text>
        </View>

        {/* Journey Steps */}
        {JOURNEY_STEPS.map((step, i) => (
          <StepCard
            key={i}
            step={step}
            index={i}
            isEn={!!isEn}
            isLast={i === JOURNEY_STEPS.length - 1}
            onPress={() => step.route && router.push(step.route as any)}
          />
        ))}

        {/* Future CTA */}
        <TouchableOpacity
          style={styles.futureCta}
          onPress={() => router.push('/future' as any)}
          activeOpacity={0.85}
        >
          <LinearGradient colors={['#0D47A1', '#1565C0']} style={styles.futureCtaGrad}>
            <MaterialCommunityIcons name="rocket-launch" size={28} color="#fff" />
            <View style={{ flex: 1 }}>
              <Text style={styles.futureCtaTitle}>
                {isEn ? 'Explore Future Features' : 'ಭವಿಷ್ಯದ ವೈಶಿಷ್ಟ್ಯಗಳನ್ನು ಅನ್ವೇಷಿಸಿ'}
              </Text>
              <Text style={styles.futureCtaSub}>
                {isEn ? 'Drones, Pest AI, Digital Payments & more' : 'ಡ್ರೋನ್, ಕೀಟ AI, ಡಿಜಿಟಲ್ ಪಾವತಿ ಇನ್ನಷ್ಟು'}
              </Text>
            </View>
            <MaterialCommunityIcons name="chevron-right" size={24} color="rgba(255,255,255,0.6)" />
          </LinearGradient>
        </TouchableOpacity>

        <Text style={styles.footer}>KrishiMitra • Nivetti Systems</Text>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background },
  header: { paddingTop: 52, paddingBottom: Spacing.lg, paddingHorizontal: Spacing.lg },
  backBtn: { marginBottom: Spacing.sm },
  headerTitle: { fontSize: FontSize.xxl, fontWeight: '900', color: '#fff' },
  headerSub: { fontSize: FontSize.sm, color: 'rgba(255,255,255,0.7)', marginTop: 4, fontWeight: '500' },

  scroll: { paddingBottom: 100 },

  // Flow Diagram
  flowCard: {
    margin: Spacing.md,
    backgroundColor: Colors.surface,
    borderRadius: BorderRadius.lg,
    padding: Spacing.md,
    borderWidth: 1, borderColor: Colors.border,
    ...Shadows.sm,
  },
  flowTitle: { fontSize: FontSize.md, fontWeight: '800', color: Colors.textPrimary, marginBottom: Spacing.md },
  flowDiagram: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    gap: 4, marginBottom: Spacing.sm,
  },
  flowNode: {
    width: 36, height: 36, borderRadius: 18,
    backgroundColor: Colors.primarySoft,
    alignItems: 'center', justifyContent: 'center',
  },
  flowEmoji: { fontSize: 16 },
  flowDesc: { fontSize: FontSize.xs, color: Colors.textMuted, textAlign: 'center', fontWeight: '500' },

  // Step Cards
  stepCard: { flexDirection: 'row', paddingHorizontal: Spacing.md, marginBottom: 4 },
  stepLeft: { width: 48, alignItems: 'center' },
  stepNumberContainer: { alignItems: 'center' },
  stepNumber: {
    width: 32, height: 32, borderRadius: 16,
    alignItems: 'center', justifyContent: 'center',
    zIndex: 1,
  },
  stepNumberText: { color: '#fff', fontSize: FontSize.md, fontWeight: '900' },
  stepConnector: { width: 3, height: 80, marginTop: -2 },

  stepContent: { flex: 1, paddingBottom: Spacing.sm },
  stepBody: {
    borderRadius: BorderRadius.lg,
    padding: Spacing.md,
    borderWidth: 1, borderColor: Colors.border,
  },
  stepIconCircle: {
    width: 48, height: 48, borderRadius: 24,
    alignItems: 'center', justifyContent: 'center',
    marginBottom: Spacing.sm,
  },
  stepTitle: { fontSize: FontSize.lg, fontWeight: '800', marginBottom: 4 },
  stepDesc: { fontSize: FontSize.sm, color: Colors.textSecondary, lineHeight: 20 },
  stepArrow: { position: 'absolute', top: Spacing.md, right: Spacing.md },

  // Future CTA
  futureCta: { marginHorizontal: Spacing.md, marginTop: Spacing.md },
  futureCtaGrad: {
    flexDirection: 'row', alignItems: 'center', gap: Spacing.md,
    paddingVertical: Spacing.lg, paddingHorizontal: Spacing.lg,
    borderRadius: BorderRadius.lg,
  },
  futureCtaTitle: { fontSize: FontSize.md, fontWeight: '800', color: '#fff' },
  futureCtaSub: { fontSize: FontSize.xs, color: 'rgba(255,255,255,0.7)', marginTop: 2 },

  footer: { fontSize: FontSize.xs, color: Colors.textMuted, textAlign: 'center', marginTop: Spacing.xxl, fontStyle: 'italic' },
});
