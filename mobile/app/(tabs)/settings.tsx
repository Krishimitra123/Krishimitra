/**
 * Settings Screen — Profile editing, multi-language TTS, logout.
 * Supports all Sarvam TTS languages.
 */

import React, { useState, useEffect } from 'react';
import {
  View, Text, StyleSheet, TextInput, TouchableOpacity,
  ScrollView, Alert, Platform,
} from 'react-native';
import { NivettiHeader } from '@/components/NivettiHeader';
import { Colors, FontSize, Spacing, BorderRadius, Shadows } from '@/constants/theme';
import { useUserStore } from '@/stores/useUserStore';
import { DISTRICTS } from '@/constants/districts';
import { CROPS } from '@/constants/crops';

const LANGUAGES = [
  { code: 'kn', label: 'ಕನ್ನಡ', flag: '🇮🇳' },
  { code: 'en', label: 'English', flag: '🇬🇧' },
  { code: 'hi', label: 'हिंदी', flag: '🇮🇳' },
  { code: 'ta', label: 'தமிழ்', flag: '🇮🇳' },
  { code: 'te', label: 'తెలుగు', flag: '🇮🇳' },
  { code: 'ml', label: 'മലയാളം', flag: '🇮🇳' },
  { code: 'mr', label: 'मराठी', flag: '🇮🇳' },
  { code: 'bn', label: 'বাংলা', flag: '🇮🇳' },
  { code: 'gu', label: 'ગુજરાતી', flag: '🇮🇳' },
  { code: 'pa', label: 'ਪੰਜਾਬੀ', flag: '🇮🇳' },
  { code: 'od', label: 'ଓଡ଼ିଆ', flag: '🇮🇳' },
];

export default function SettingsScreen() {
  const store = useUserStore();

  const [name, setName] = useState(store.farmer_name);
  const [selectedDistrict, setSelectedDistrict] = useState(store.district);
  const [selectedCrops, setSelectedCrops] = useState<string[]>(store.crops);
  const [ttsLanguage, setTtsLanguage] = useState(store.tts_language || 'kn');
  const [districtSearch, setDistrictSearch] = useState('');
  const [cropSearch, setCropSearch] = useState('');
  const [editMode, setEditMode] = useState(false);

  useEffect(() => {
    setName(store.farmer_name);
    setSelectedDistrict(store.district);
    setSelectedCrops(store.crops);
    setTtsLanguage(store.tts_language || 'kn');
  }, [store.farmer_name, store.district, store.crops, store.tts_language]);

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

  const handleSave = () => {
    if (!name.trim()) { Alert.alert('ದೋಷ', 'ಹೆಸರು ಅಗತ್ಯ'); return; }
    if (!selectedDistrict) { Alert.alert('ದೋಷ', 'ಜಿಲ್ಲೆ ಆಯ್ಕೆ ಮಾಡಿ'); return; }
    store.setProfile({
      farmer_name: name.trim(),
      district: selectedDistrict,
      primary_crop: selectedCrops[0] || '',
      crops: selectedCrops,
    });
    setEditMode(false);
    Alert.alert('✅', 'ಉಳಿಸಲಾಗಿದೆ');
  };

  const handleLanguageSelect = (code: string) => {
    setTtsLanguage(code);
    store.setProfile({ tts_language: code as any });
  };

  const handleLogout = () => {
    Alert.alert('ಲಾಗ್ಔಟ್', 'ಖಚಿತವಾಗಿ?', [
      { text: 'ಬೇಡ', style: 'cancel' },
      { text: 'ಹೌದು', style: 'destructive', onPress: () => store.reset() },
    ]);
  };

  return (
    <View style={styles.container}>
      <NivettiHeader title="⚙️ ಸೆಟ್ಟಿಂಗ್ಸ್" />
      <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>

        {/* Profile */}
        <View style={[styles.card, Shadows.sm]}>
          <View style={styles.cardHeader}>
            <Text style={styles.cardTitle}>👤 ಪ್ರೊಫೈಲ್</Text>
            {!editMode && (
              <TouchableOpacity onPress={() => setEditMode(true)}>
                <Text style={styles.editBtn}>✏️ ಬದಲಾಯಿಸಿ</Text>
              </TouchableOpacity>
            )}
          </View>

          {editMode ? (
            <>
              <Text style={styles.label}>ಹೆಸರು</Text>
              <TextInput style={styles.input} value={name} onChangeText={setName} placeholder="ನಿಮ್ಮ ಹೆಸರು" placeholderTextColor={Colors.textMuted} />

              <Text style={styles.label}>ಜಿಲ್ಲೆ</Text>
              <TextInput style={styles.input} value={districtSearch} onChangeText={setDistrictSearch} placeholder="ಜಿಲ್ಲೆ ಹುಡುಕಿ..." placeholderTextColor={Colors.textMuted} />
              <View style={styles.chipGrid}>
                {filteredDistricts.slice(0, 10).map((d) => (
                  <TouchableOpacity key={d.name_en} style={[styles.chip, selectedDistrict === d.name_en && styles.chipSel]} onPress={() => { setSelectedDistrict(d.name_en); setDistrictSearch(''); }}>
                    <Text style={[styles.chipTxt, selectedDistrict === d.name_en && styles.chipTxtSel]}>{d.name_kn}</Text>
                  </TouchableOpacity>
                ))}
              </View>
              {selectedDistrict ? <Text style={styles.badge}>✅ {selectedDistrict}</Text> : null}

              <Text style={[styles.label, { marginTop: Spacing.md }]}>ಬೆಳೆಗಳು</Text>
              <TextInput style={styles.input} value={cropSearch} onChangeText={setCropSearch} placeholder="ಬೆಳೆ ಹುಡುಕಿ..." placeholderTextColor={Colors.textMuted} />
              <View style={styles.chipGrid}>
                {filteredCrops.slice(0, 12).map((c) => {
                  const sel = selectedCrops.includes(c.name_en);
                  return (
                    <TouchableOpacity key={c.name_en} style={[styles.chip, sel && styles.chipSel]} onPress={() => {
                      sel ? setSelectedCrops(selectedCrops.filter(cr => cr !== c.name_en)) : setSelectedCrops([...selectedCrops, c.name_en]);
                      setCropSearch('');
                    }}>
                      <Text style={[styles.chipTxt, sel && styles.chipTxtSel]}>{sel ? '✓ ' : ''}{c.icon} {c.name_kn}</Text>
                    </TouchableOpacity>
                  );
                })}
              </View>

              <View style={styles.btnRow}>
                <TouchableOpacity style={styles.cancelBtn} onPress={() => { setEditMode(false); setName(store.farmer_name); setSelectedDistrict(store.district); setSelectedCrops(store.crops); }}>
                  <Text style={styles.cancelTxt}>← ರದ್ದು</Text>
                </TouchableOpacity>
                <TouchableOpacity style={styles.saveBtn} onPress={handleSave}>
                  <Text style={styles.saveTxt}>💾 ಉಳಿಸಿ</Text>
                </TouchableOpacity>
              </View>
            </>
          ) : (
            <View style={styles.infoList}>
              <InfoRow label="ಹೆಸರು" value={store.farmer_name || '—'} />
              <InfoRow label="ಫೋನ್" value={store.phone ? `+91 ${store.phone}` : '—'} />
              <InfoRow label="ಜಿಲ್ಲೆ" value={store.district || '—'} />
              <InfoRow label="ಬೆಳೆಗಳು" value={store.crops.join(', ') || '—'} />
            </View>
          )}
        </View>

        {/* Language Selection */}
        <View style={[styles.card, Shadows.sm]}>
          <Text style={styles.cardTitle}>🔊 ಧ್ವನಿ ಭಾಷೆ</Text>
          <Text style={styles.langHint}>AI ಉತ್ತರ ಯಾವ ಭಾಷೆಯಲ್ಲಿ ಕೇಳಬೇಕು?</Text>
          <View style={styles.langGrid}>
            {LANGUAGES.map((lang) => (
              <TouchableOpacity
                key={lang.code}
                style={[styles.langBtn, ttsLanguage === lang.code && styles.langBtnActive]}
                onPress={() => handleLanguageSelect(lang.code)}
              >
                <Text style={styles.langFlag}>{lang.flag}</Text>
                <Text style={[styles.langLabel, ttsLanguage === lang.code && styles.langLabelActive]}>
                  {lang.label}
                </Text>
                {ttsLanguage === lang.code && <Text style={styles.langCheck}>✓</Text>}
              </TouchableOpacity>
            ))}
          </View>
        </View>

        {/* App Info */}
        <View style={[styles.card, Shadows.sm]}>
          <Text style={styles.cardTitle}>ℹ️ ಅಪ್ಲಿಕೇಶನ್</Text>
          <InfoRow label="ಆವೃತ್ತಿ" value="v2.0.0" />
          <InfoRow label="AI" value="Gemini + Mistral + Sarvam" />
          <InfoRow label="ನಿರ್ಮಾಣ" value="Nivetti Systems" />
        </View>

        <TouchableOpacity style={styles.logoutBtn} onPress={handleLogout}>
          <Text style={styles.logoutTxt}>🚪 ಲಾಗ್ಔಟ್</Text>
        </TouchableOpacity>
      </ScrollView>
    </View>
  );
}

function InfoRow({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.infoRow}>
      <Text style={styles.infoLabel}>{label}</Text>
      <Text style={styles.infoValue}>{value}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background },
  scroll: { padding: Spacing.md, paddingBottom: Spacing.xxl },
  card: { backgroundColor: Colors.surface, borderRadius: BorderRadius.lg, padding: Spacing.md, marginBottom: Spacing.md, borderWidth: 1, borderColor: Colors.border },
  cardHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: Spacing.md },
  cardTitle: { fontSize: FontSize.lg, fontWeight: '700', color: Colors.textPrimary },
  editBtn: { fontSize: FontSize.md, color: Colors.primary, fontWeight: '600' },
  label: { fontSize: FontSize.md, fontWeight: '600', color: Colors.textSecondary, marginBottom: Spacing.xs, marginTop: Spacing.sm },
  input: { backgroundColor: Colors.background, borderRadius: BorderRadius.md, padding: Spacing.md, fontSize: FontSize.md, color: Colors.textPrimary, borderWidth: 1, borderColor: Colors.border, marginBottom: Spacing.sm },
  chipGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.xs },
  chip: { backgroundColor: Colors.background, borderRadius: BorderRadius.full, paddingVertical: Spacing.xs, paddingHorizontal: Spacing.md, borderWidth: 1, borderColor: Colors.border },
  chipSel: { backgroundColor: Colors.primary, borderColor: Colors.primary },
  chipTxt: { fontSize: FontSize.sm, color: Colors.textPrimary },
  chipTxtSel: { color: Colors.textOnPrimary, fontWeight: '700' },
  badge: { fontSize: FontSize.sm, color: Colors.primary, fontWeight: '700', marginTop: Spacing.xs },
  btnRow: { flexDirection: 'row', justifyContent: 'space-between', marginTop: Spacing.lg, gap: Spacing.md },
  cancelBtn: { flex: 1, paddingVertical: Spacing.md, alignItems: 'center', borderRadius: BorderRadius.md, borderWidth: 1, borderColor: Colors.border },
  cancelTxt: { fontSize: FontSize.md, color: Colors.textSecondary, fontWeight: '600' },
  saveBtn: { flex: 1, paddingVertical: Spacing.md, alignItems: 'center', borderRadius: BorderRadius.md, backgroundColor: Colors.primary },
  saveTxt: { fontSize: FontSize.md, color: Colors.textOnPrimary, fontWeight: '700' },
  infoList: { gap: Spacing.sm },
  infoRow: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: Spacing.xs },
  infoLabel: { fontSize: FontSize.md, color: Colors.textMuted },
  infoValue: { fontSize: FontSize.md, color: Colors.textPrimary, fontWeight: '600', flexShrink: 1, textAlign: 'right' },
  langHint: { fontSize: FontSize.sm, color: Colors.textMuted, marginTop: Spacing.xs, marginBottom: Spacing.md },
  langGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.sm },
  langBtn: { flexDirection: 'row', alignItems: 'center', paddingVertical: Spacing.sm, paddingHorizontal: Spacing.md, borderRadius: BorderRadius.md, borderWidth: 1.5, borderColor: Colors.border, backgroundColor: Colors.background, gap: Spacing.xs, minWidth: '45%' as any },
  langBtnActive: { borderColor: Colors.primary, backgroundColor: Colors.primarySoft },
  langFlag: { fontSize: 16 },
  langLabel: { fontSize: FontSize.md, color: Colors.textPrimary, fontWeight: '500' },
  langLabelActive: { color: Colors.primary, fontWeight: '700' },
  langCheck: { fontSize: FontSize.md, color: Colors.primary, fontWeight: '800', marginLeft: 'auto' as any },
  logoutBtn: { marginTop: Spacing.md, paddingVertical: Spacing.md, alignItems: 'center', borderRadius: BorderRadius.md, backgroundColor: '#FFF5F5', borderWidth: 1, borderColor: Colors.error + '30' },
  logoutTxt: { fontSize: FontSize.lg, color: Colors.error, fontWeight: '700' },
});
