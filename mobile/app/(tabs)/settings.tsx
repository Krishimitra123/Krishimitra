/**
 * Settings Screen — Clean, professional. No emoji UI.
 */

import React, { useState, useEffect } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity,
  ScrollView, Alert,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { Colors, FontSize, Spacing, BorderRadius, Shadows } from '@/constants/theme';
import { useUserStore } from '@/stores/useUserStore';

const LANGUAGES = [
  { code: 'kn', label: 'ಕನ್ನಡ', sub: 'Kannada' },
  { code: 'en', label: 'English', sub: 'English' },
  { code: 'hi', label: 'हिंदी', sub: 'Hindi' },
  { code: 'ta', label: 'தமிழ்', sub: 'Tamil' },
  { code: 'te', label: 'తెలుగు', sub: 'Telugu' },
  { code: 'ml', label: 'മലയാളം', sub: 'Malayalam' },
  { code: 'mr', label: 'मराठी', sub: 'Marathi' },
  { code: 'bn', label: 'বাংলা', sub: 'Bengali' },
  { code: 'gu', label: 'ગુજરાતી', sub: 'Gujarati' },
  { code: 'pa', label: 'ਪੰਜਾਬੀ', sub: 'Punjabi' },
  { code: 'od', label: 'ଓଡ଼ିଆ', sub: 'Odia' },
];

export default function SettingsScreen() {
  const store = useUserStore();
  const [ttsLanguage, setTtsLanguage] = useState(store.tts_language || 'kn');

  useEffect(() => {
    setTtsLanguage(store.tts_language || 'kn');
  }, [store.tts_language]);

  const handleLanguageSelect = (code: string) => {
    setTtsLanguage(code);
    store.setProfile({ tts_language: code as any });
  };

  const handleLogout = () => {
    Alert.alert('ಲಾಗ್ ಔಟ್', 'ಖಚಿತಪಡಿಸಿ?', [
      { text: 'ಬೇಡ', style: 'cancel' },
      { text: 'ಹೌದು', style: 'destructive', onPress: () => store.reset() },
    ]);
  };

  return (
    <View style={styles.container}>
      {/* Header */}
      <LinearGradient colors={['#1B5E20', '#2E7D32']} style={styles.header}>
        <View style={styles.headerRow}>
          <MaterialCommunityIcons name="cog" size={22} color="#fff" />
          <Text style={styles.headerTitle}>ಸೆಟ್ಟಿಂಗ್ಸ್</Text>
        </View>
      </LinearGradient>

      <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>

        {/* Profile Card */}
        <View style={styles.profileCard}>
          <View style={styles.profileAvatar}>
            <MaterialCommunityIcons name="account-circle" size={52} color={Colors.primary} />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={styles.profileName}>{store.farmer_name || '—'}</Text>
            <Text style={styles.profilePhone}>{store.phone ? `+91 ${store.phone}` : '—'}</Text>
            <Text style={styles.profileMeta}>{store.district || ''}{store.crops.length ? ` · ${store.crops[0]}` : ''}</Text>
          </View>
        </View>

        {/* Language Selection */}
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <MaterialCommunityIcons name="volume-high" size={20} color={Colors.primary} />
            <Text style={styles.sectionTitle}>ಧ್ವನಿ ಭಾಷೆ</Text>
          </View>
          <Text style={styles.sectionHint}>AI ಯಾವ ಭಾಷೆಯಲ್ಲಿ ಮಾತನಾಡಬೇಕು?</Text>
          <View style={styles.langGrid}>
            {LANGUAGES.map((lang) => {
              const active = ttsLanguage === lang.code;
              return (
                <TouchableOpacity
                  key={lang.code}
                  style={[styles.langBtn, active && styles.langBtnActive]}
                  onPress={() => handleLanguageSelect(lang.code)}
                  activeOpacity={0.75}
                >
                  <Text style={[styles.langLabel, active && styles.langLabelActive]}>{lang.label}</Text>
                  <Text style={[styles.langSub, active && styles.langSubActive]}>{lang.sub}</Text>
                  {active && (
                    <View style={styles.langCheck}>
                      <MaterialCommunityIcons name="check" size={14} color={Colors.primary} />
                    </View>
                  )}
                </TouchableOpacity>
              );
            })}
          </View>
        </View>

        {/* App Info */}
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <MaterialCommunityIcons name="information-outline" size={20} color={Colors.primary} />
            <Text style={styles.sectionTitle}>ಅಪ್ಲಿಕೇಶನ್</Text>
          </View>
          <InfoRow icon="tag-outline" label="ಆವೃತ್ತಿ" value="v2.0.0" />
          <InfoRow icon="robot-outline" label="AI" value="Gemini + Sarvam" />
          <InfoRow icon="office-building" label="ನಿರ್ಮಾಣ" value="Nivetti Systems" />
        </View>

        {/* Logout */}
        <TouchableOpacity style={styles.logoutBtn} onPress={handleLogout} activeOpacity={0.8}>
          <MaterialCommunityIcons name="logout" size={20} color={Colors.error} />
          <Text style={styles.logoutTxt}>ಲಾಗ್ ಔಟ್</Text>
        </TouchableOpacity>

      </ScrollView>
    </View>
  );
}

function InfoRow({ icon, label, value }: { icon: string; label: string; value: string }) {
  return (
    <View style={styles.infoRow}>
      <MaterialCommunityIcons name={icon as any} size={16} color={Colors.textMuted} />
      <Text style={styles.infoLabel}>{label}</Text>
      <Text style={styles.infoValue}>{value}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background },
  header: { paddingTop: 52, paddingBottom: Spacing.md, paddingHorizontal: Spacing.lg },
  headerRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm },
  headerTitle: { fontSize: FontSize.xl, fontWeight: '800', color: '#fff' },

  scroll: { padding: Spacing.md, paddingBottom: 100 },

  profileCard: {
    flexDirection: 'row', alignItems: 'center', gap: Spacing.md,
    backgroundColor: Colors.surface, borderRadius: BorderRadius.lg,
    padding: Spacing.md, marginBottom: Spacing.md,
    borderWidth: 1, borderColor: Colors.border, ...Shadows.sm,
  },
  profileAvatar: { alignItems: 'center', justifyContent: 'center' },
  profileName: { fontSize: FontSize.xl, fontWeight: '800', color: Colors.textPrimary },
  profilePhone: { fontSize: FontSize.md, color: Colors.textSecondary, marginTop: 2 },
  profileMeta: { fontSize: FontSize.sm, color: Colors.textMuted, marginTop: 2 },

  section: {
    backgroundColor: Colors.surface, borderRadius: BorderRadius.lg,
    padding: Spacing.md, marginBottom: Spacing.md,
    borderWidth: 1, borderColor: Colors.border, ...Shadows.sm,
  },
  sectionHeader: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm, marginBottom: Spacing.xs },
  sectionTitle: { fontSize: FontSize.lg, fontWeight: '700', color: Colors.textPrimary },
  sectionHint: { fontSize: FontSize.sm, color: Colors.textMuted, marginBottom: Spacing.md },

  langGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.sm },
  langBtn: {
    paddingVertical: Spacing.sm, paddingHorizontal: Spacing.md,
    borderRadius: BorderRadius.md,
    borderWidth: 1.5, borderColor: Colors.border,
    backgroundColor: Colors.background, minWidth: '45%' as any,
    position: 'relative',
  },
  langBtnActive: { borderColor: Colors.primary, backgroundColor: Colors.primarySoft },
  langLabel: { fontSize: FontSize.md, color: Colors.textPrimary, fontWeight: '600' },
  langLabelActive: { color: Colors.primary, fontWeight: '800' },
  langSub: { fontSize: FontSize.xs, color: Colors.textMuted, marginTop: 2 },
  langSubActive: { color: Colors.primary },
  langCheck: { position: 'absolute', top: 6, right: 8 },

  infoRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm, paddingVertical: Spacing.sm, borderTopWidth: 1, borderTopColor: Colors.divider },
  infoLabel: { fontSize: FontSize.md, color: Colors.textMuted, flex: 1 },
  infoValue: { fontSize: FontSize.md, color: Colors.textPrimary, fontWeight: '600' },

  logoutBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    gap: Spacing.sm, paddingVertical: Spacing.md,
    backgroundColor: '#FFF5F5', borderRadius: BorderRadius.lg,
    borderWidth: 1, borderColor: Colors.error + '25',
    marginTop: Spacing.sm,
  },
  logoutTxt: { fontSize: FontSize.lg, color: Colors.error, fontWeight: '700' },
});
