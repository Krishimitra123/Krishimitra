/**
 * Settings Screen — Clean, professional. No emoji UI.
 */

import React, { useState, useEffect } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity,
  ScrollView, Alert, TextInput,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { Colors, FontSize, Spacing, BorderRadius, Shadows } from '@/constants/theme';
import { useUserStore } from '@/stores/useUserStore';
import { CROPS } from '@/constants/crops';
import { t } from '@/constants/i18n';

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
  const langCode = (store.tts_language || 'kn').split('-')[0]; // normalise 'kn-IN' → 'kn'
  const [ttsLanguage, setTtsLanguage] = useState(langCode);
  const [newCrop, setNewCrop] = useState('');
  
  const isEn = store.preferred_language?.startsWith('en');

  useEffect(() => {
    setTtsLanguage((store.tts_language || 'kn').split('-')[0]);
  }, [store.tts_language]);

  const handleLanguageSelect = (code: string) => {
    setTtsLanguage(code);
    const fullCode = code === 'en' ? 'en-IN' : code === 'hi' ? 'hi-IN' : code === 'ta' ? 'ta-IN' : code === 'te' ? 'te-IN' : code === 'ml' ? 'ml-IN' : code === 'mr' ? 'mr-IN' : code === 'bn' ? 'bn-IN' : code === 'gu' ? 'gu-IN' : code === 'pa' ? 'pa-IN' : code === 'od' ? 'or-IN' : 'kn-IN';
    store.setProfile({ tts_language: fullCode, preferred_language: fullCode });
  };

  const addCrop = () => {
    const c = newCrop.trim();
    if (!c) return;
    const updated = Array.from(new Set([...(store.crops || []), c]));
    store.setProfile({ crops: updated, primary_crop: updated[0] });
    setNewCrop('');
  };

  const quickAddCrop = (cropName: string) => {
    const updated = Array.from(new Set([...(store.crops || []), cropName]));
    store.setProfile({ crops: updated, primary_crop: updated[0] || cropName });
  };

  const removeCrop = (idx: number) => {
    const updated = (store.crops || []).filter((_, i) => i !== idx);
    store.setProfile({ crops: updated, primary_crop: updated[0] ?? '' });
  };

  const handleLogout = () => {
    Alert.alert(isEn ? 'Logout' : 'ಲಾಗ್ ಔಟ್', isEn ? 'Are you sure?' : 'ಖಚಿತಪಡಿಸಿ?', [
      { text: isEn ? 'Cancel' : 'ಬೇಡ', style: 'cancel' },
      { text: isEn ? 'Yes' : 'ಹೌದು', style: 'destructive', onPress: () => store.reset() },
    ]);
  };

  return (
    <View style={styles.container}>
      {/* Header */}
      <LinearGradient colors={['#1B5E20', '#2E7D32']} style={styles.header}>
        <View style={styles.headerRow}>
          <MaterialCommunityIcons name="cog" size={22} color="#fff" />
          <Text style={styles.headerTitle}>{t('settings')}</Text>
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
            <Text style={styles.profileMeta}>{store.district || t('noDistrict')}</Text>
            {store.crops?.length > 0 && (
              <View style={styles.cropRow}>
                {store.crops.map((c, i) => (
                  <View key={i} style={styles.cropTag}>
                    <Text style={styles.cropTagTxt}>{formatCropLabel(c, isEn)}</Text>
                  </View>
                ))}
              </View>
            )}
            {!store.crops?.length && store.primary_crop ? (
              <View style={styles.cropRow}>
                <View style={styles.cropTag}>
                  <Text style={styles.cropTagTxt}>{formatCropLabel(store.primary_crop, isEn)}</Text>
                </View>
              </View>
            ) : null}
          </View>
        </View>

        {/* Language Selection */}
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <MaterialCommunityIcons name="volume-high" size={20} color={Colors.primary} />
            <Text style={styles.sectionTitle}>{t('voiceLang')}</Text>
          </View>
          <Text style={styles.sectionHint}>{t('whichLang')}</Text>
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

        {/* Crops Section */}
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <MaterialCommunityIcons name="sprout" size={20} color={Colors.primary} />
            <Text style={styles.sectionTitle}>{t('crops')}</Text>
          </View>
          <Text style={styles.sectionHint}>{t('tapCrop')}</Text>
          <View style={styles.cropEditRow}>
            {(store.crops || []).map((c, i) => (
              <View key={i} style={styles.cropEditTag}>
                <Text style={styles.cropEditTxt}>{formatCropLabel(c, isEn)}</Text>
                <TouchableOpacity onPress={() => removeCrop(i)}>
                  <MaterialCommunityIcons name="close-circle" size={16} color={Colors.error} />
                </TouchableOpacity>
              </View>
            ))}
          </View>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.quickCropRow}>
            {CROPS.map((crop) => (
              <TouchableOpacity key={crop.name_en} style={styles.quickCropBtn} onPress={() => quickAddCrop(crop.name_en)} activeOpacity={0.8}>
                <Text style={styles.quickCropIcon}>{crop.icon}</Text>
                <Text style={styles.quickCropText}>{isEn ? crop.name_en : crop.name_kn}</Text>
              </TouchableOpacity>
            ))}
          </ScrollView>
          <View style={styles.addCropRow}>
            <TextInput
              style={styles.cropInput}
              value={newCrop}
              onChangeText={setNewCrop}
              placeholder="Add crop..."
              placeholderTextColor={Colors.textMuted}
              onSubmitEditing={addCrop}
              returnKeyType="done"
            />
            <TouchableOpacity style={styles.addCropBtn} onPress={addCrop}>
              <MaterialCommunityIcons name="plus" size={20} color="#fff" />
            </TouchableOpacity>
          </View>
        </View>

        {/* App Info */}
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <MaterialCommunityIcons name="information-outline" size={20} color={Colors.primary} />
            <Text style={styles.sectionTitle}>{t('app')}</Text>
          </View>
          <InfoRow icon="tag-outline" label={t('version')} value="v2.0.0" />
          <InfoRow icon="robot-outline" label="AI" value="Gemini + Sarvam" />
          <InfoRow icon="office-building" label={t('builtBy')} value="Nivetti Systems" />
        </View>

        {/* Logout */}
        <TouchableOpacity style={styles.logoutBtn} onPress={handleLogout} activeOpacity={0.8}>
          <MaterialCommunityIcons name="logout" size={20} color={Colors.error} />
          <Text style={styles.logoutTxt}>{t('logout')}</Text>
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

function formatCropLabel(crop: string, isEn: boolean): string {
  const match = CROPS.find((item) => item.name_en.toLowerCase() === crop.toLowerCase() || item.name_kn === crop);
  return match ? `${match.icon} ${isEn ? match.name_en : match.name_kn}` : crop;
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

  cropRow: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.sm, marginTop: Spacing.sm },
  cropTag: {
    paddingVertical: 6,
    paddingHorizontal: 10,
    borderRadius: BorderRadius.md,
    backgroundColor: Colors.primarySoft,
    borderWidth: 1,
    borderColor: Colors.primary + '25',
  },
  cropTagTxt: { fontSize: FontSize.sm, color: Colors.primary, fontWeight: '700' },
  cropEditRow: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.sm, marginBottom: Spacing.sm },
  cropEditTag: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    paddingVertical: 8, paddingHorizontal: 10,
    backgroundColor: Colors.primarySoft, borderRadius: BorderRadius.md,
  },
  cropEditTxt: { fontSize: FontSize.sm, color: Colors.primary, fontWeight: '700' },
  quickCropRow: { gap: Spacing.sm, paddingVertical: Spacing.sm, paddingBottom: Spacing.md },
  quickCropBtn: {
    width: 92,
    paddingVertical: Spacing.sm,
    paddingHorizontal: 8,
    borderRadius: BorderRadius.md,
    backgroundColor: Colors.background,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: Colors.border,
    marginRight: Spacing.sm,
  },
  quickCropIcon: { fontSize: 22, marginBottom: 4 },
  quickCropText: { fontSize: 11, color: Colors.textPrimary, fontWeight: '700', textAlign: 'center' },

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
