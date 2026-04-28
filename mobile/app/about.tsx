/**
 * About Screen — Nivetti Systems branding and app info.
 */

import React from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, Linking, Image } from 'react-native';
import { useRouter } from 'expo-router';
import { NivettiHeader } from '@/components/NivettiHeader';
import { Colors, FontSize, Spacing, BorderRadius, Shadows } from '@/constants/theme';

export default function AboutScreen() {
  const router = useRouter();

  return (
    <View style={styles.container}>
      <NivettiHeader title="ಕುರಿತು" />

      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        {/* App Identity */}
        <View style={styles.logoSection}>
          <Image
            source={require('@/assets/images/nivetti-logo.png')}
            style={styles.aboutLogo}
            resizeMode="contain"
          />
          <Text style={styles.appName}>KrishiMitra</Text>
          <Text style={styles.appTagline}>ಕೃಷಿ ಮಿತ್ರ — ನಿಮ್ಮ ಜೈವಿಕ ಕೃಷಿ ಸಹಾಯಕ</Text>
          <Text style={styles.version}>v3.0.0</Text>
        </View>

        {/* Company Card */}
        <View style={[styles.card, Shadows.sm]}>
          <View style={styles.companyHeader}>
            <Image
              source={require('@/assets/images/nivetti-logo.png')}
              style={styles.companyLogo}
              resizeMode="contain"
            />
            <Text style={styles.cardTitle}>Nivetti Systems</Text>
          </View>
          <Text style={styles.cardText}>
            Nivetti Systems ನಿಂದ ನಿರ್ಮಿಸಲಾಗಿದೆ. ಕರ್ನಾಟಕ ರೈತರ ಸೇವೆಗಾಗಿ ಸಮರ್ಪಿತ AI ತಂತ್ರಜ್ಞಾನ.
          </Text>
        </View>

        {/* Features */}
        <View style={[styles.card, Shadows.sm]}>
          <Text style={styles.cardTitle}>ವೈಶಿಷ್ಟ್ಯಗಳು</Text>
          <View style={styles.featureRow}>
            <Text style={styles.featureIcon}>🎙️</Text>
            <Text style={styles.featureText}>ಕನ್ನಡದಲ್ಲಿ ಧ್ವನಿ ಮೂಲಕ ಪ್ರಶ್ನೆ ಕೇಳಿ</Text>
          </View>
          <View style={styles.featureRow}>
            <Text style={styles.featureIcon}>📸</Text>
            <Text style={styles.featureText}>ಬೆಳೆ ಫೋಟೋ ಮೂಲಕ ರೋಗ ಪತ್ತೆ</Text>
          </View>
          <View style={styles.featureRow}>
            <Text style={styles.featureIcon}>🌱</Text>
            <Text style={styles.featureText}>ಸುಭಾಷ್ ಪಾಲೇಕರ್ ZBNF ಆಧಾರಿತ ಸಲಹೆ</Text>
          </View>
          <View style={styles.featureRow}>
            <Text style={styles.featureIcon}>🗣️</Text>
            <Text style={styles.featureText}>ಕನ್ನಡ TTS ಮೂಲಕ ಉತ್ತರ ಕೇಳಿ</Text>
          </View>
        </View>

        {/* Sources */}
        <View style={[styles.card, Shadows.sm]}>
          <Text style={styles.cardTitle}>ಮೂಲಗಳು</Text>
          <Text style={styles.sourceItem}>📖 ಸುಭಾಷ್ ಪಾಲೇಕರ್ — Zero Budget Natural Farming</Text>
          <Text style={styles.sourceItem}>📖 ICAR — ಸಾವಯವ ಕೃಷಿ ಸಂಶೋಧನೆ</Text>
          <Text style={styles.sourceItem}>📖 UAS ಧಾರವಾಡ — ಕರ್ನಾಟಕ ಕೃಷಿ ವಿಶ್ವವಿದ್ಯಾಲಯ</Text>
        </View>

        {/* Tech Stack */}
        <View style={[styles.card, Shadows.sm]}>
          <Text style={styles.cardTitle}>ತಂತ್ರಜ್ಞಾನ</Text>
          <Text style={styles.techItem}>🤖 Mistral AI — ಬುದ್ಧಿಮತ್ತೆ ಉತ್ತರಗಳು</Text>
          <Text style={styles.techItem}>👁️ Pixtral Vision — ರೋಗ ಗುರುತಿಸುವಿಕೆ</Text>
          <Text style={styles.techItem}>🔊 Sarvam AI — ಕನ್ನಡ ಧ್ವನಿ (STT/TTS)</Text>
          <Text style={styles.techItem}>⚡ FastAPI + React Native</Text>
        </View>

        {/* Footer */}
        <View style={styles.footer}>
          <Text style={styles.footerText}>© 2026 Nivetti Systems. ಎಲ್ಲ ಹಕ್ಕುಗಳು ಕಾಯ್ದಿರಿಸಲಾಗಿದೆ.</Text>
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  content: {
    padding: Spacing.md,
    paddingBottom: Spacing.xxl,
  },
  logoSection: {
    alignItems: 'center',
    paddingVertical: Spacing.xl,
  },
  aboutLogo: {
    width: 100,
    height: 100,
    marginBottom: Spacing.sm,
  },
  appName: {
    fontSize: 28,
    fontWeight: '800',
    color: Colors.primaryDark,
    letterSpacing: 1,
  },
  companyHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    marginBottom: Spacing.xs,
  },
  companyLogo: {
    width: 24,
    height: 24,
  },
  appTagline: {
    fontSize: FontSize.md,
    color: Colors.textSecondary,
    marginTop: 4,
    textAlign: 'center',
  },
  version: {
    fontSize: FontSize.sm,
    color: Colors.textMuted,
    marginTop: 8,
    backgroundColor: Colors.primarySoft,
    paddingHorizontal: Spacing.md,
    paddingVertical: 2,
    borderRadius: BorderRadius.full,
    overflow: 'hidden',
  },
  card: {
    backgroundColor: Colors.surface,
    borderRadius: BorderRadius.lg,
    padding: Spacing.md,
    marginBottom: Spacing.md,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  cardTitle: {
    fontSize: FontSize.lg,
    fontWeight: '700',
    color: Colors.primaryDark,
    marginBottom: Spacing.sm,
  },
  cardText: {
    fontSize: FontSize.md,
    color: Colors.textPrimary,
    lineHeight: 24,
  },
  featureRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 6,
    gap: Spacing.sm,
  },
  featureIcon: {
    fontSize: 20,
  },
  featureText: {
    fontSize: FontSize.md,
    color: Colors.textPrimary,
    flex: 1,
  },
  sourceItem: {
    fontSize: FontSize.sm,
    color: Colors.textSecondary,
    paddingVertical: 4,
    lineHeight: 22,
  },
  techItem: {
    fontSize: FontSize.sm,
    color: Colors.textSecondary,
    paddingVertical: 4,
    lineHeight: 22,
  },
  footer: {
    alignItems: 'center',
    paddingVertical: Spacing.xl,
  },
  footerText: {
    fontSize: FontSize.xs,
    color: Colors.textMuted,
    textAlign: 'center',
  },
});
