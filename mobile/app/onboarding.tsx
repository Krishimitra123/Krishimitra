/**
 * Onboarding — Streamlined single-step profile setup.
 * Name + District + Crop. No tutorial. Goes straight to app.
 */

import React, { useState } from 'react';
import {
  View, Text, StyleSheet, TextInput, TouchableOpacity,
  ScrollView, Alert, Image,
} from 'react-native';
import { useRouter } from 'expo-router';
import { LinearGradient } from 'expo-linear-gradient';
import { Colors, FontSize, Spacing, BorderRadius, Shadows } from '@/constants/theme';
import { useUserStore } from '@/stores/useUserStore';
import { DISTRICTS } from '@/constants/districts';
import { CROPS } from '@/constants/crops';

export default function OnboardingScreen() {
  const router = useRouter();
  const { setProfile, completeOnboarding } = useUserStore();

  const [step, setStep] = useState<'WELCOME' | 'PROFILE'>('WELCOME');
  const [name, setName] = useState('');
  const [selectedDistrict, setSelectedDistrict] = useState('');
  const [selectedCrops, setSelectedCrops] = useState<string[]>([]);
  const [districtSearch, setDistrictSearch] = useState('');
  const [cropSearch, setCropSearch] = useState('');

  const filteredDistricts = DISTRICTS.filter(
    (d) => d.name_en.toLowerCase().includes(districtSearch.toLowerCase()) || d.name_kn.includes(districtSearch)
  );
  const filteredCrops = CROPS.filter(
    (c) => c.name_en.toLowerCase().includes(cropSearch.toLowerCase()) || c.name_kn.includes(cropSearch)
  );

  const handleFinish = () => {
    if (!name.trim()) { Alert.alert('', 'ಹೆಸರು ನಮೂದಿಸಿ'); return; }
    if (!selectedDistrict) { Alert.alert('', 'ಜಿಲ್ಲೆ ಆಯ್ಕೆ ಮಾಡಿ'); return; }
    if (selectedCrops.length === 0) { Alert.alert('', 'ಒಂದು ಬೆಳೆ ಆಯ್ಕೆ ಮಾಡಿ'); return; }

    setProfile({
      farmer_name: name.trim(),
      district: selectedDistrict,
      primary_crop: selectedCrops[0],
      crops: selectedCrops,
    });
    completeOnboarding();
    router.replace('/(tabs)');
  };

  // ── WELCOME ──────────────────────────────────────────────────
  if (step === 'WELCOME') {
    return (
      <LinearGradient colors={[Colors.primaryDark, Colors.primary, Colors.primaryLight]} style={styles.fullScreen}>
        <View style={styles.welcomeCenter}>
          <View style={styles.logoCircle}>
            <Image source={require('@/assets/images/nivetti-logo.png')} style={styles.logo} resizeMode="contain" />
          </View>
          <Text style={styles.welcomeTitle}>ನಮಸ್ಕಾರ!</Text>
          <Text style={styles.welcomeSub}>KrishiMitra ಗೆ ಸ್ವಾಗತ</Text>
          <Text style={styles.welcomeDesc}>ನಿಮ್ಮ ಜೈವಿಕ ಕೃಷಿ ಸಹಾಯಕ</Text>
          <Text style={styles.branding}>by Nivetti Systems</Text>

          <TouchableOpacity style={styles.startBtn} onPress={() => setStep('PROFILE')}>
            <Text style={styles.startBtnText}>ಮುಂದೆ →</Text>
          </TouchableOpacity>
        </View>
      </LinearGradient>
    );
  }

  // ── PROFILE ──────────────────────────────────────────────────
  return (
    <View style={styles.profileScreen}>
      <View style={styles.header}>
        <Text style={styles.headerTitle}>ನಿಮ್ಮ ವಿವರಗಳು</Text>
      </View>

      <ScrollView contentContainerStyle={styles.form} showsVerticalScrollIndicator={false}>
        {/* Name */}
        <Text style={styles.label}>🧑‍🌾 ಹೆಸರು</Text>
        <TextInput style={styles.input} placeholder="ನಿಮ್ಮ ಹೆಸರು..." placeholderTextColor={Colors.textMuted} value={name} onChangeText={setName} autoCapitalize="words" />

        {/* District */}
        <Text style={styles.label}>📍 ಜಿಲ್ಲೆ</Text>
        <TextInput style={styles.input} placeholder="ಜಿಲ್ಲೆ ಹುಡುಕಿ..." placeholderTextColor={Colors.textMuted} value={districtSearch} onChangeText={setDistrictSearch} />
        <View style={styles.chipGrid}>
          {filteredDistricts.slice(0, 12).map((d) => (
            <TouchableOpacity key={d.name_en} style={[styles.chip, selectedDistrict === d.name_en && styles.chipSel]} onPress={() => { setSelectedDistrict(d.name_en); setDistrictSearch(''); }}>
              <Text style={[styles.chipTxt, selectedDistrict === d.name_en && styles.chipTxtSel]}>{d.name_kn}</Text>
            </TouchableOpacity>
          ))}
        </View>
        {selectedDistrict ? <Text style={styles.badge}>✅ {selectedDistrict}</Text> : null}

        {/* Crops */}
        <Text style={[styles.label, { marginTop: Spacing.lg }]}>🌾 ಬೆಳೆಗಳು</Text>
        <TextInput style={styles.input} placeholder="ಬೆಳೆ ಹುಡುಕಿ..." placeholderTextColor={Colors.textMuted} value={cropSearch} onChangeText={setCropSearch} />
        <View style={styles.chipGrid}>
          {filteredCrops.slice(0, 15).map((c) => {
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
        {selectedCrops.length > 0 && <Text style={styles.badge}>✅ {selectedCrops.join(', ')}</Text>}
      </ScrollView>

      <View style={styles.bottomBar}>
        <TouchableOpacity onPress={() => setStep('WELCOME')}>
          <Text style={styles.backText}>← ಹಿಂದೆ</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.saveBtn} onPress={handleFinish}>
          <Text style={styles.saveBtnText}>🚀 ಪ್ರಾರಂಭಿಸಿ</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  fullScreen: { flex: 1 },
  welcomeCenter: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: Spacing.xl },
  logoCircle: { width: 100, height: 100, borderRadius: 50, backgroundColor: 'rgba(255,255,255,0.2)', alignItems: 'center', justifyContent: 'center', marginBottom: Spacing.lg },
  logo: { width: 80, height: 80 },
  welcomeTitle: { fontSize: 42, fontWeight: '800', color: '#fff', marginBottom: Spacing.xs },
  welcomeSub: { fontSize: FontSize.xxl, fontWeight: '600', color: 'rgba(255,255,255,0.9)', textAlign: 'center' },
  welcomeDesc: { fontSize: FontSize.md, color: 'rgba(255,255,255,0.7)', textAlign: 'center', marginTop: Spacing.xs },
  branding: { fontSize: FontSize.sm, color: 'rgba(255,255,255,0.4)', fontStyle: 'italic', marginTop: Spacing.lg },
  startBtn: { backgroundColor: '#fff', paddingVertical: Spacing.md, paddingHorizontal: Spacing.xl, borderRadius: BorderRadius.full, marginTop: Spacing.xxl },
  startBtnText: { fontSize: FontSize.lg, fontWeight: '700', color: Colors.primary },
  profileScreen: { flex: 1, backgroundColor: Colors.background },
  header: { backgroundColor: Colors.primary, paddingTop: Spacing.xxl + Spacing.md, paddingBottom: Spacing.lg, paddingHorizontal: Spacing.lg },
  headerTitle: { fontSize: FontSize.xxl, fontWeight: '800', color: '#fff' },
  form: { padding: Spacing.md, paddingBottom: 120 },
  label: { fontSize: FontSize.lg, fontWeight: '700', color: Colors.textPrimary, marginBottom: Spacing.sm },
  input: { backgroundColor: Colors.surface, borderRadius: BorderRadius.md, padding: Spacing.md, fontSize: FontSize.md, color: Colors.textPrimary, borderWidth: 1, borderColor: Colors.border, marginBottom: Spacing.sm },
  chipGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.xs },
  chip: { backgroundColor: Colors.surface, borderRadius: BorderRadius.full, paddingVertical: Spacing.xs, paddingHorizontal: Spacing.md, borderWidth: 1, borderColor: Colors.border },
  chipSel: { backgroundColor: Colors.primary, borderColor: Colors.primary },
  chipTxt: { fontSize: FontSize.sm, color: Colors.textPrimary },
  chipTxtSel: { color: '#fff', fontWeight: '700' },
  badge: { fontSize: FontSize.md, color: Colors.primary, fontWeight: '700', marginTop: Spacing.sm },
  bottomBar: { position: 'absolute', bottom: 0, left: 0, right: 0, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: Spacing.md, paddingBottom: Spacing.xl, backgroundColor: Colors.surface, borderTopWidth: 1, borderTopColor: Colors.border },
  backText: { fontSize: FontSize.md, color: Colors.textSecondary, fontWeight: '600' },
  saveBtn: { backgroundColor: Colors.primary, paddingVertical: Spacing.md, paddingHorizontal: Spacing.xl, borderRadius: BorderRadius.full },
  saveBtnText: { fontSize: FontSize.lg, fontWeight: '700', color: '#fff' },
});
