/**
 * Future Expansion Screen — Upcoming feature cards.
 * Shows what KrishiMitra will become: a complete farming ecosystem.
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

interface FutureFeature {
  icon: string;
  title_en: string;
  title_kn: string;
  desc_en: string;
  desc_kn: string;
  color: string;
  gradient: [string, string];
  status: 'planned' | 'in-progress' | 'research';
}

const FEATURES: FutureFeature[] = [
  {
    icon: 'drone',
    title_en: 'Drone Integration',
    title_kn: 'ಡ್ರೋನ್ ಸಂಯೋಜನೆ',
    desc_en: 'Aerial crop monitoring, precision spraying, and field mapping with drone technology.',
    desc_kn: 'ಡ್ರೋನ್ ತಂತ್ರಜ್ಞಾನದೊಂದಿಗೆ ವೈಮಾನಿಕ ಬೆಳೆ ಮೇಲ್ವಿಚಾರಣೆ, ನಿಖರ ಸಿಂಪಡಣೆ.',
    color: '#1565C0',
    gradient: ['#0D47A1', '#1565C0'],
    status: 'research',
  },
  {
    icon: 'bug',
    title_en: 'Advanced Pest Detection',
    title_kn: 'ಸುಧಾರಿತ ಕೀಟ ಪತ್ತೆ',
    desc_en: 'AI-powered real-time pest identification from camera photos with instant organic remedies.',
    desc_kn: 'ಕ್ಯಾಮೆರಾ ಫೋಟೋಗಳಿಂದ AI-ಚಾಲಿತ ನೈಜ-ಸಮಯ ಕೀಟ ಗುರುತಿಸುವಿಕೆ.',
    color: '#E65100',
    gradient: ['#BF360C', '#E65100'],
    status: 'in-progress',
  },
  {
    icon: 'account-group',
    title_en: 'Community Support',
    title_kn: 'ಸಮುದಾಯ ಬೆಂಬಲ',
    desc_en: 'Connect with nearby farmers, share experiences, and learn from successful organic practices.',
    desc_kn: 'ಹತ್ತಿರದ ರೈತರೊಂದಿಗೆ ಸಂಪರ್ಕಿಸಿ, ಅನುಭವಗಳನ್ನು ಹಂಚಿಕೊಳ್ಳಿ.',
    color: '#6A1B9A',
    gradient: ['#4A148C', '#6A1B9A'],
    status: 'planned',
  },
  {
    icon: 'water-pump',
    title_en: 'Irrigation Automation',
    title_kn: 'ನೀರಾವರಿ ಸ್ವಯಂಚಾಲನೆ',
    desc_en: 'Smart irrigation scheduling based on soil moisture, weather forecast, and crop water needs.',
    desc_kn: 'ಮಣ್ಣಿನ ತೇವಾಂಶ, ಹವಾಮಾನ ಮುನ್ಸೂಚನೆ ಆಧಾರಿತ ಸ್ಮಾರ್ಟ್ ನೀರಾವರಿ.',
    color: '#00838F',
    gradient: ['#006064', '#00838F'],
    status: 'planned',
  },
  {
    icon: 'cash-multiple',
    title_en: 'Digital Payments',
    title_kn: 'ಡಿಜಿಟಲ್ ಪಾವತಿ',
    desc_en: 'In-app payments for seeds, fertilizers, and direct market sales with UPI integration.',
    desc_kn: 'ಬೀಜ, ಗೊಬ್ಬರ ಮತ್ತು ನೇರ ಮಾರುಕಟ್ಟೆ ಮಾರಾಟಕ್ಕೆ UPI ಪಾವತಿ.',
    color: '#2E7D32',
    gradient: ['#1B5E20', '#2E7D32'],
    status: 'planned',
  },
  {
    icon: 'robot',
    title_en: 'Advanced AI Assistant',
    title_kn: 'ಸುಧಾರಿತ AI ಸಹಾಯಕ',
    desc_en: 'Proactive alerts, seasonal planning, government scheme notifications, and crop calendar.',
    desc_kn: 'ಸಕ್ರಿಯ ಎಚ್ಚರಿಕೆಗಳು, ಋತು ಯೋಜನೆ, ಸರ್ಕಾರಿ ಯೋಜನೆ ಸೂಚನೆಗಳು.',
    color: '#AD1457',
    gradient: ['#880E4F', '#AD1457'],
    status: 'in-progress',
  },
];

const STATUS_LABELS: Record<string, { en: string; kn: string; color: string; bg: string }> = {
  'planned':     { en: 'Planned',      kn: 'ಯೋಜಿತ',        color: '#1565C0', bg: '#E3F2FD' },
  'in-progress': { en: 'In Progress',  kn: 'ಪ್ರಗತಿಯಲ್ಲಿ',   color: '#E65100', bg: '#FFF3E0' },
  'research':    { en: 'Research',     kn: 'ಸಂಶೋಧನೆ',      color: '#6A1B9A', bg: '#F3E5F5' },
};

function FeatureCard({
  feature,
  index,
  isEn,
}: {
  feature: FutureFeature;
  index: number;
  isEn: boolean;
}) {
  const slideAnim = useRef(new Animated.Value(60)).current;
  const opacityAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.parallel([
      Animated.timing(slideAnim, {
        toValue: 0,
        duration: 500,
        delay: index * 100,
        useNativeDriver: true,
      }),
      Animated.timing(opacityAnim, {
        toValue: 1,
        duration: 500,
        delay: index * 100,
        useNativeDriver: true,
      }),
    ]).start();
  }, []);

  const status = STATUS_LABELS[feature.status];

  return (
    <Animated.View
      style={[
        styles.featureCard,
        {
          transform: [{ translateY: slideAnim }],
          opacity: opacityAnim,
        },
      ]}
    >
      <LinearGradient
        colors={feature.gradient}
        style={styles.featureIcon}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
      >
        <MaterialCommunityIcons name={feature.icon as any} size={32} color="#fff" />
      </LinearGradient>

      <View style={styles.featureContent}>
        <View style={styles.featureTitleRow}>
          <Text style={styles.featureTitle}>{isEn ? feature.title_en : feature.title_kn}</Text>
          <View style={[styles.statusBadge, { backgroundColor: status.bg }]}>
            <Text style={[styles.statusText, { color: status.color }]}>
              {isEn ? status.en : status.kn}
            </Text>
          </View>
        </View>
        <Text style={styles.featureDesc}>{isEn ? feature.desc_en : feature.desc_kn}</Text>
      </View>
    </Animated.View>
  );
}

export default function FutureScreen() {
  const router = useRouter();
  const { preferred_language } = useUserStore();
  const isEn = preferred_language?.startsWith('en');

  return (
    <View style={styles.container}>
      <StatusBar barStyle="light-content" />

      {/* Header */}
      <LinearGradient colors={['#0D47A1', '#1565C0']} style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
          <MaterialCommunityIcons name="arrow-left" size={24} color="#fff" />
        </TouchableOpacity>
        <View>
          <Text style={styles.headerTitle}>{t('futureFeatures')}</Text>
          <Text style={styles.headerSub}>
            {isEn
              ? 'KrishiMitra is becoming a complete farming ecosystem'
              : 'ಕೃಷಿ ಮಿತ್ರ ಸಂಪೂರ್ಣ ಕೃಷಿ ಪರಿಸರ ವ್ಯವಸ್ಥೆಯಾಗುತ್ತಿದೆ'}
          </Text>
        </View>
      </LinearGradient>

      <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
        {/* Vision Card */}
        <View style={styles.visionCard}>
          <MaterialCommunityIcons name="rocket-launch" size={36} color={Colors.primary} />
          <Text style={styles.visionTitle}>
            {isEn ? 'Our Vision' : 'ನಮ್ಮ ದೃಷ್ಟಿ'}
          </Text>
          <Text style={styles.visionText}>
            {isEn
              ? 'Beyond just an app — KrishiMitra aims to be a complete digital farming companion. From AI advice to drone monitoring, every tool a farmer needs in one place.'
              : 'ಕೇವಲ ಅಪ್ಲಿಕೇಶನ್ ಮೀರಿ — ಕೃಷಿ ಮಿತ್ರ ಸಂಪೂರ್ಣ ಡಿಜಿಟಲ್ ಕೃಷಿ ಸಂಗಾತಿಯಾಗಲು ಗುರಿ ಹೊಂದಿದೆ.'}
          </Text>
        </View>

        {/* Feature Cards */}
        {FEATURES.map((feature, i) => (
          <FeatureCard key={i} feature={feature} index={i} isEn={!!isEn} />
        ))}

        {/* Architecture Card */}
        <View style={styles.archCard}>
          <Text style={styles.archTitle}>
            {isEn ? '⚡ Tech Architecture' : '⚡ ತಂತ್ರಜ್ಞಾನ ವಾಸ್ತುಶಿಲ್ಪ'}
          </Text>
          <View style={styles.archFlow}>
            {[
              { label: 'React Native', icon: '📱' },
              { label: 'FastAPI', icon: '⚡' },
              { label: 'Supabase', icon: '🗄️' },
              { label: 'ML Models', icon: '🧠' },
              { label: 'Mistral AI', icon: '🤖' },
            ].map((item, i) => (
              <React.Fragment key={i}>
                <View style={styles.archNode}>
                  <Text style={styles.archEmoji}>{item.icon}</Text>
                  <Text style={styles.archLabel}>{item.label}</Text>
                </View>
                {i < 4 && <MaterialCommunityIcons name="arrow-down" size={16} color={Colors.textMuted} />}
              </React.Fragment>
            ))}
          </View>
        </View>

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

  // Vision Card
  visionCard: {
    margin: Spacing.md,
    backgroundColor: Colors.surface,
    borderRadius: BorderRadius.lg,
    padding: Spacing.lg,
    borderWidth: 1, borderColor: Colors.primary + '25',
    alignItems: 'center',
    ...Shadows.sm,
  },
  visionTitle: { fontSize: FontSize.xl, fontWeight: '900', color: Colors.primary, marginTop: Spacing.sm },
  visionText: { fontSize: FontSize.sm, color: Colors.textSecondary, textAlign: 'center', lineHeight: 20, marginTop: Spacing.sm },

  // Feature Cards
  featureCard: {
    flexDirection: 'row',
    marginHorizontal: Spacing.md,
    marginBottom: Spacing.sm,
    backgroundColor: Colors.surface,
    borderRadius: BorderRadius.lg,
    padding: Spacing.md,
    borderWidth: 1, borderColor: Colors.border,
    gap: Spacing.md,
    ...Shadows.sm,
  },
  featureIcon: {
    width: 56, height: 56, borderRadius: 16,
    alignItems: 'center', justifyContent: 'center',
  },
  featureContent: { flex: 1 },
  featureTitleRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 4, gap: 8 },
  featureTitle: { fontSize: FontSize.md, fontWeight: '800', color: Colors.textPrimary, flex: 1 },
  featureDesc: { fontSize: FontSize.sm, color: Colors.textSecondary, lineHeight: 19 },

  // Status Badge
  statusBadge: {
    paddingVertical: 2, paddingHorizontal: 8,
    borderRadius: BorderRadius.full,
  },
  statusText: { fontSize: 9, fontWeight: '800', letterSpacing: 0.3 },

  // Architecture Card
  archCard: {
    margin: Spacing.md, marginTop: Spacing.lg,
    backgroundColor: Colors.surface,
    borderRadius: BorderRadius.lg,
    padding: Spacing.lg,
    borderWidth: 1, borderColor: Colors.border,
    ...Shadows.sm,
  },
  archTitle: { fontSize: FontSize.md, fontWeight: '800', color: Colors.textPrimary, marginBottom: Spacing.md },
  archFlow: { alignItems: 'center', gap: 4 },
  archNode: {
    flexDirection: 'row', alignItems: 'center', gap: Spacing.sm,
    backgroundColor: Colors.primarySoft,
    paddingVertical: 8, paddingHorizontal: Spacing.md,
    borderRadius: BorderRadius.md,
    width: '80%',
  },
  archEmoji: { fontSize: 18 },
  archLabel: { fontSize: FontSize.sm, fontWeight: '700', color: Colors.primary },

  footer: { fontSize: FontSize.xs, color: Colors.textMuted, textAlign: 'center', marginTop: Spacing.xxl, fontStyle: 'italic' },
});
