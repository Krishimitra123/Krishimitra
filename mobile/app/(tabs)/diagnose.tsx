/**
 * Diagnose Screen — Voice-first crop disease detection.
 * Shows FULL diagnosis result card with remedies on this screen.
 * Auto-plays voice advisory with disease + remedies.
 * Sources shown in text (not spoken).
 */

import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity, ScrollView,
  Image, ActivityIndicator, Alert, Animated, Dimensions,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { Colors, FontSize, Spacing, BorderRadius, Shadows } from '@/constants/theme';
import { t } from '@/constants/i18n';
import { captureImageWithUri } from '@/services/diagnosisService';
import { playBase64Audio, startRecording, stopRecordingAndGetBase64, stopPlayback } from '@/services/voiceService';
import { sendDiagnosis, sendVoiceQuery, ConversationTurn, DiagnosisResponse } from '@/services/queryService';
import { useAudioStore } from '@/stores/useAudioStore';
import { useSessionStore } from '@/stores/useSessionStore';
import { useUserStore } from '@/stores/useUserStore';

const { width, height } = Dimensions.get('window');

type OverlayMode = 'idle' | 'analyzing' | 'recording' | 'processing' | 'speaking';

function cleanDiseaseName(value?: string | null): string {
  if (!value) return '';
  return value.split('(')[0].trim();
}

function buildConversationHistory(messages: Array<{ role: 'user' | 'assistant'; text: string }>): ConversationTurn[] {
  return messages.filter((m) => m.text.trim().length > 0).slice(-6).map((m) => ({ role: m.role, content: m.text }));
}

function WaveformBars({ active, color = '#fff' }: { active: boolean; color?: string }) {
  const bars = useRef(Array.from({ length: 7 }, () => new Animated.Value(0.3))).current;
  useEffect(() => {
    if (!active) { bars.forEach(b => b.setValue(0.3)); return; }
    const loops = bars.map((bar, i) =>
      Animated.loop(Animated.sequence([
        Animated.timing(bar, { toValue: 1, duration: 380 + i * 50, useNativeDriver: true }),
        Animated.timing(bar, { toValue: 0.3, duration: 380 + i * 50, useNativeDriver: true }),
      ]))
    );
    const timers = loops.map((l, i) => setTimeout(() => l.start(), i * 70));
    return () => { loops.forEach(l => l.stop()); timers.forEach(t => clearTimeout(t)); };
  }, [active]);
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 5, height: 52 }}>
      {bars.map((bar, i) => (
        <Animated.View key={i} style={{ width: 5, height: 40, borderRadius: 3, backgroundColor: color, transform: [{ scaleY: bar }] }} />
      ))}
    </View>
  );
}

export default function DiagnoseScreen() {
  const [imageUri, setImageUri] = useState<string | null>(null);
  const [imageBase64, setImageBase64] = useState<string | null>(null);
  const [imageMimeType, setImageMimeType] = useState<string>('image/jpeg');
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [result, setResult] = useState<DiagnosisResponse | null>(null);
  const [canAskFollowUp, setCanAskFollowUp] = useState(false);
  const [followUpText, setFollowUpText] = useState<string | null>(null);

  const audioStore = useAudioStore();
  const { addMessage, currentSession } = useSessionStore();
  const preferred_language = useUserStore((s) => s.preferred_language);

  const pulseAnim = useRef(new Animated.Value(1)).current;
  const resultSlide = useRef(new Animated.Value(height)).current;

  const overlayMode: OverlayMode = useMemo(() => {
    if (audioStore.state === 'PLAYING') return 'speaking';
    if (audioStore.state === 'RECORDING') return 'recording';
    if (audioStore.state === 'STT_PROCESSING') return 'processing';
    if (isAnalyzing) return 'analyzing';
    return 'idle';
  }, [audioStore.state, isAnalyzing]);

  useEffect(() => {
    if (overlayMode === 'idle') { pulseAnim.setValue(1); return; }
    const pulse = Animated.loop(Animated.sequence([
      Animated.timing(pulseAnim, { toValue: 1.1, duration: 700, useNativeDriver: true }),
      Animated.timing(pulseAnim, { toValue: 1, duration: 700, useNativeDriver: true }),
    ]));
    pulse.start();
    return () => { pulse.stop(); };
  }, [overlayMode]);

  // Slide result card up when result arrives
  useEffect(() => {
    if (result && !result.needs_retake) {
      Animated.spring(resultSlide, { toValue: 0, useNativeDriver: true, tension: 40, friction: 8 }).start();
    } else {
      resultSlide.setValue(height);
    }
  }, [result]);

  const playDiagnosisAudio = useCallback(async (audioBase64?: string | null) => {
    if (!audioBase64) return;
    try { audioStore.setState('PLAYING'); await playBase64Audio(audioBase64); }
    catch (e) { console.error('[Diagnose] Audio error:', e); }
    finally { audioStore.setState('IDLE'); }
  }, [audioStore]);

  const captureAndDiagnose = useCallback(async () => {
    if (isAnalyzing || overlayMode !== 'idle') return;
    try {
      const image = await captureImageWithUri();
      if (!image) return;
      setImageUri(image.uri);
      setImageBase64(image.base64);
      setImageMimeType(image.mimeType);
      setResult(null);
      setCanAskFollowUp(false);
      setFollowUpText(null);
      setIsAnalyzing(true);

      const finding = await sendDiagnosis(image.base64, image.mimeType);
      setResult(finding);

      const diseaseName = cleanDiseaseName(finding.disease_name_kn || finding.disease_name);
      addMessage({
        id: Date.now().toString(), role: 'assistant',
        text: finding.summary_kn || diseaseName || t('diagnose'),
        sources: finding.sources || [], timestamp: Date.now(), is_diagnosis: true,
        audio_base64: finding.audio_base64 || undefined,
      });

      // Auto-play full diagnosis audio (disease + remedies)
      await playDiagnosisAudio(finding.audio_base64);
      setCanAskFollowUp(true);
    } catch (error: any) {
      console.error('[Diagnose] Error:', error);
      Alert.alert(t('error'), error?.response?.data?.detail || error?.message || t('tryAgain'));
    } finally {
      setIsAnalyzing(false);
      audioStore.setState('IDLE');
    }
  }, [addMessage, audioStore, isAnalyzing, overlayMode, playDiagnosisAudio]);

  const handleFollowUpQuestion = useCallback(async () => {
    try {
      if (audioStore.state === 'IDLE' || audioStore.state === 'ERROR') {
        audioStore.setState('RECORDING');
        await startRecording();
        return;
      }
      if (audioStore.state !== 'RECORDING') return;
      audioStore.setState('STT_PROCESSING');
      const recordedAudio = await stopRecordingAndGetBase64();
      const history = buildConversationHistory(currentSession?.messages ?? []);
      addMessage({ id: Date.now().toString(), role: 'user', text: '🎙️ ...', sources: [], timestamp: Date.now(), is_diagnosis: true });
      const response = await sendVoiceQuery(recordedAudio.base64, recordedAudio.mimeType, history);
      setFollowUpText(response.answer_text_kn);
      addMessage({
        id: (Date.now() + 1).toString(), role: 'assistant',
        text: response.answer_text_kn, sources: response.sources || [],
        timestamp: Date.now(), is_diagnosis: true, audio_base64: response.audio_base64 || undefined,
      });
      await playDiagnosisAudio(response.audio_base64);
    } catch (error: any) {
      Alert.alert(t('error'), error?.response?.data?.detail || error?.message || t('tryAgain'));
    } finally {
      audioStore.setState('IDLE');
    }
  }, [addMessage, audioStore, currentSession?.messages, playDiagnosisAudio]);

  const resetDiagnosis = useCallback(async () => {
    await stopPlayback();
    setImageUri(null);
    setImageBase64(null);
    setImageMimeType('image/jpeg');
    setResult(null);
    setCanAskFollowUp(false);
    setFollowUpText(null);
    audioStore.setState('IDLE');
  }, [audioStore]);

  const handlePrimaryPress = useCallback(async () => {
    if (overlayMode === 'analyzing' || overlayMode === 'processing') return;
    if (overlayMode === 'speaking') {
      await stopPlayback();
      audioStore.setState('IDLE');
      return;
    }
    if (canAskFollowUp) { await handleFollowUpQuestion(); return; }
    await captureAndDiagnose();
  }, [canAskFollowUp, captureAndDiagnose, handleFollowUpQuestion, overlayMode, audioStore]);

  const primaryButtonDisabled = overlayMode === 'analyzing' || overlayMode === 'processing';
  const micIcon = overlayMode === 'recording' ? 'stop' : overlayMode === 'speaking' ? 'stop' : canAskFollowUp ? 'microphone' : 'camera';

  // Confidence color
  const confColor = (result?.confidence_pct ?? 0) >= 60 ? '#4CAF50' : (result?.confidence_pct ?? 0) >= 30 ? '#FF9800' : '#F44336';

  return (
    <View style={styles.container}>
      {/* Camera / Image zone */}
      <TouchableOpacity
        style={styles.cameraZone}
        onPress={result && canAskFollowUp ? resetDiagnosis : undefined}
        activeOpacity={canAskFollowUp ? 0.8 : 1}
      >
        {imageUri ? (
          <Image source={{ uri: imageUri }} style={styles.previewImage} />
        ) : (
          <LinearGradient colors={['#0d1f0f', '#1B3A1E', '#0d1f0f']} style={styles.cameraPlaceholder}>
            <View style={styles.scanFrame}>
              <View style={[styles.corner, styles.cornerTL]} />
              <View style={[styles.corner, styles.cornerTR]} />
              <View style={[styles.corner, styles.cornerBL]} />
              <View style={[styles.corner, styles.cornerBR]} />
              <MaterialCommunityIcons name="leaf-circle-outline" size={64} color="rgba(76,175,80,0.5)" />
            </View>
            <Text style={styles.cameraHint}>{t('takePhoto')}</Text>
          </LinearGradient>
        )}

        {/* Processing overlay */}
        {overlayMode !== 'idle' && (
          <View style={styles.loadingOverlay}>
            <Animated.View style={[styles.orbContainer, { transform: [{ scale: pulseAnim }] }]}>
              <LinearGradient colors={['rgba(46,125,50,0.9)', 'rgba(27,94,32,0.9)']} style={styles.orb}>
                <MaterialCommunityIcons
                  name={overlayMode === 'recording' ? 'microphone' : overlayMode === 'speaking' ? 'volume-high' : 'leaf'}
                  size={40}
                  color="#fff"
                />
              </LinearGradient>
            </Animated.View>
            <WaveformBars active />
            <Text style={styles.overlayStatus}>
              {overlayMode === 'analyzing' ? t('analyzing') :
               overlayMode === 'recording' ? t('listening') :
               overlayMode === 'processing' ? t('thinking') :
               overlayMode === 'speaking' ? t('speaking') : ''}
            </Text>
          </View>
        )}

        {/* Retake button */}
        {imageUri && result && canAskFollowUp && overlayMode === 'idle' && (
          <TouchableOpacity style={styles.retakeButton} onPress={resetDiagnosis} activeOpacity={0.85}>
            <MaterialCommunityIcons name="camera-retake" size={20} color="#fff" />
          </TouchableOpacity>
        )}
      </TouchableOpacity>

      {/* ── RESULT CARD — shows diagnosis details right here ── */}
      {result && !result.needs_retake && overlayMode === 'idle' && (
        <Animated.View style={[styles.resultCard, { transform: [{ translateY: resultSlide }] }]}>
          <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 90 }}>
            {/* Disease name + confidence */}
            <View style={styles.resultHeader}>
              <MaterialCommunityIcons
                name={result.plant_health_status?.toLowerCase()?.includes('health') ? 'check-circle' : 'alert-circle'}
                size={24}
                color={result.plant_health_status?.toLowerCase()?.includes('health') ? '#4CAF50' : '#F44336'}
              />
              <View style={{ flex: 1, marginLeft: 10 }}>
                <Text style={styles.diseaseName}>
                  {cleanDiseaseName(result.disease_name_kn) || cleanDiseaseName(result.disease_name) || t('diagnose')}
                </Text>
                {result.disease_name && result.disease_name_kn && (
                  <Text style={styles.diseaseNameEn}>{cleanDiseaseName(result.disease_name)}</Text>
                )}
              </View>
              <View style={[styles.confBadge, { backgroundColor: confColor + '20' }]}>
                <Text style={[styles.confText, { color: confColor }]}>{Math.round(result.confidence_pct)}%</Text>
              </View>
            </View>

            {/* Cause */}
            {result.probable_cause && result.probable_cause.toLowerCase() !== 'unknown' && (
              <View style={styles.resultSection}>
                <Text style={styles.sectionLabel}>🔍 {t('diagnose')}</Text>
                <Text style={styles.sectionText}>{result.probable_cause}</Text>
              </View>
            )}

            {/* Organic Treatments */}
            {result.organic_treatments && result.organic_treatments.length > 0 && (
              <View style={styles.resultSection}>
                <Text style={styles.sectionLabel}>🌿 Organic Remedies</Text>
                {result.organic_treatments.map((tr, i) => (
                  <View key={i} style={styles.treatmentRow}>
                    <Text style={styles.treatmentNum}>{i + 1}</Text>
                    <Text style={styles.treatmentText}>{tr}</Text>
                  </View>
                ))}
              </View>
            )}

            {/* Prevention */}
            {result.prevention_measures && result.prevention_measures.length > 0 && (
              <View style={styles.resultSection}>
                <Text style={styles.sectionLabel}>🛡️ Prevention</Text>
                {result.prevention_measures.map((p, i) => (
                  <Text key={i} style={styles.sectionText}>• {p}</Text>
                ))}
              </View>
            )}

            {/* Sources — shown but NOT spoken */}
            {result.sources && result.sources.length > 0 && (
              <View style={styles.sourcesRow}>
                <MaterialCommunityIcons name="book-open-variant" size={14} color={Colors.textMuted} />
                <Text style={styles.sourcesText}>{result.sources.join(' • ')}</Text>
              </View>
            )}

            {/* Listen Again */}
            {result.audio_base64 && (
              <TouchableOpacity style={styles.listenBtn} onPress={() => playDiagnosisAudio(result.audio_base64)}>
                <MaterialCommunityIcons name="volume-high" size={18} color={Colors.primary} />
                <Text style={styles.listenBtnText}>{t('listenAgain')}</Text>
              </TouchableOpacity>
            )}

            {/* Follow-up answer */}
            {followUpText && (
              <View style={styles.followUpCard}>
                <MaterialCommunityIcons name="robot" size={16} color={Colors.primary} />
                <Text style={styles.followUpText}>{followUpText}</Text>
              </View>
            )}
          </ScrollView>
        </Animated.View>
      )}

      {/* Bottom bar */}
      <LinearGradient colors={[Colors.surface, Colors.background]} style={styles.bottomBar}>
        {result && canAskFollowUp && overlayMode === 'idle' && (
          <TouchableOpacity style={styles.newPhotoBtn} onPress={resetDiagnosis} activeOpacity={0.8}>
            <MaterialCommunityIcons name="camera-retake" size={20} color="#fff" />
            <Text style={styles.newPhotoBtnText}>{t('newPhoto')}</Text>
          </TouchableOpacity>
        )}
        {result && canAskFollowUp && overlayMode === 'idle' && (
          <Text style={styles.followUpHint}>{t('askFollowUp')}</Text>
        )}

        {/* Stop playback bar */}
        {overlayMode === 'speaking' && (
          <TouchableOpacity style={styles.stopBar} onPress={async () => { await stopPlayback(); audioStore.setState('IDLE'); }}>
            <WaveformBars active color={Colors.error} />
            <Text style={styles.stopBarText}>{t('tapToStop')}</Text>
            <MaterialCommunityIcons name="stop" size={20} color={Colors.error} />
          </TouchableOpacity>
        )}

        <TouchableOpacity
          style={[
            styles.primaryButton,
            canAskFollowUp && styles.primaryButtonFollowUp,
            overlayMode === 'recording' && styles.primaryButtonRecording,
            primaryButtonDisabled && styles.primaryButtonDisabled,
          ]}
          onPress={handlePrimaryPress}
          disabled={primaryButtonDisabled}
          activeOpacity={0.85}
        >
          {overlayMode === 'analyzing' || overlayMode === 'processing' ? (
            <ActivityIndicator size="large" color="#fff" />
          ) : (
            <MaterialCommunityIcons name={micIcon} size={36} color="#fff" />
          )}
        </TouchableOpacity>
        <Text style={styles.bottomHint}>
          {overlayMode === 'speaking' ? t('tapToStop') : canAskFollowUp ? t('askFollowUp') : t('diagnose')}
        </Text>
      </LinearGradient>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0d1f0f' },
  cameraZone: { flex: 0.45, position: 'relative', overflow: 'hidden' },
  cameraPlaceholder: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  scanFrame: { width: 220, height: 220, alignItems: 'center', justifyContent: 'center', position: 'relative' },
  corner: { position: 'absolute', width: 28, height: 28, borderColor: 'rgba(76,175,80,0.8)', borderWidth: 3 },
  cornerTL: { top: 0, left: 0, borderRightWidth: 0, borderBottomWidth: 0 },
  cornerTR: { top: 0, right: 0, borderLeftWidth: 0, borderBottomWidth: 0 },
  cornerBL: { bottom: 0, left: 0, borderRightWidth: 0, borderTopWidth: 0 },
  cornerBR: { bottom: 0, right: 0, borderLeftWidth: 0, borderTopWidth: 0 },
  previewImage: { width: '100%', height: '100%', resizeMode: 'cover' },
  cameraHint: { fontSize: FontSize.md, color: 'rgba(255,255,255,0.5)', marginTop: Spacing.lg, textAlign: 'center' },

  loadingOverlay: { ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(0,0,0,0.7)', alignItems: 'center', justifyContent: 'center' },
  orbContainer: { marginBottom: Spacing.md },
  orb: { width: 80, height: 80, borderRadius: 40, alignItems: 'center', justifyContent: 'center' },
  overlayStatus: { fontSize: FontSize.lg, color: '#fff', fontWeight: '700', marginTop: Spacing.sm },

  retakeButton: { position: 'absolute', top: 50, right: 16, width: 44, height: 44, borderRadius: 22, backgroundColor: 'rgba(0,0,0,0.6)', alignItems: 'center', justifyContent: 'center' },

  // Result card
  resultCard: { flex: 0.55, backgroundColor: Colors.background, borderTopLeftRadius: 24, borderTopRightRadius: 24, marginTop: -20, paddingHorizontal: Spacing.md, paddingTop: Spacing.md },
  resultHeader: { flexDirection: 'row', alignItems: 'center', paddingBottom: Spacing.sm, borderBottomWidth: 1, borderBottomColor: Colors.border },
  diseaseName: { fontSize: 18, fontWeight: '800', color: Colors.textPrimary },
  diseaseNameEn: { fontSize: 13, color: Colors.textMuted, marginTop: 2 },
  confBadge: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 12 },
  confText: { fontSize: 14, fontWeight: '800' },
  resultSection: { marginTop: Spacing.md },
  sectionLabel: { fontSize: 14, fontWeight: '700', color: Colors.primary, marginBottom: 6 },
  sectionText: { fontSize: 14, color: Colors.textSecondary, lineHeight: 22 },
  treatmentRow: { flexDirection: 'row', alignItems: 'flex-start', marginBottom: 6 },
  treatmentNum: { width: 22, height: 22, borderRadius: 11, backgroundColor: Colors.primarySoft, textAlign: 'center', lineHeight: 22, fontSize: 12, fontWeight: '700', color: Colors.primary, marginRight: 8 },
  treatmentText: { flex: 1, fontSize: 14, color: Colors.textSecondary, lineHeight: 22 },
  sourcesRow: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: Spacing.md, paddingTop: Spacing.sm, borderTopWidth: 1, borderTopColor: Colors.border },
  sourcesText: { fontSize: 11, color: Colors.textMuted, flex: 1 },
  listenBtn: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: Spacing.md, alignSelf: 'flex-start', backgroundColor: Colors.primarySoft, paddingHorizontal: 14, paddingVertical: 8, borderRadius: BorderRadius.full },
  listenBtnText: { fontSize: 13, color: Colors.primary, fontWeight: '700' },
  followUpCard: { flexDirection: 'row', backgroundColor: Colors.surface, borderRadius: BorderRadius.lg, padding: Spacing.md, marginTop: Spacing.md, gap: 8, borderWidth: 1, borderColor: Colors.primary + '20' },
  followUpText: { flex: 1, fontSize: 14, color: Colors.textPrimary, lineHeight: 22 },

  // Bottom bar
  bottomBar: { paddingHorizontal: Spacing.md, paddingBottom: 28, paddingTop: Spacing.sm, alignItems: 'center' },
  newPhotoBtn: { flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: Colors.primary, paddingHorizontal: 16, paddingVertical: 8, borderRadius: BorderRadius.full, marginBottom: 6 },
  newPhotoBtnText: { fontSize: 13, color: '#fff', fontWeight: '700' },
  followUpHint: { fontSize: 12, color: Colors.textMuted, marginBottom: 6 },
  stopBar: { flexDirection: 'row', alignItems: 'center', gap: 10, backgroundColor: '#FFF0F0', paddingHorizontal: 16, paddingVertical: 8, borderRadius: BorderRadius.full, marginBottom: 8 },
  stopBarText: { fontSize: 14, fontWeight: '700', color: Colors.error },
  primaryButton: { width: 72, height: 72, borderRadius: 36, backgroundColor: Colors.primary, alignItems: 'center', justifyContent: 'center', ...Shadows.lg },
  primaryButtonFollowUp: { backgroundColor: '#2196F3' },
  primaryButtonRecording: { backgroundColor: Colors.error },
  primaryButtonDisabled: { backgroundColor: Colors.disabled },
  bottomHint: { fontSize: 12, color: Colors.textMuted, marginTop: 6 },
});
