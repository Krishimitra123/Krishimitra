/**
 * Diagnose Screen — Voice-first crop disease detection.
 * Shows FULL diagnosis result card with remedies on this screen.
 * Auto-plays voice advisory with disease + remedies.
 * Sources shown in text (not spoken).
 * Result card stays visible during playback and follow-up.
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
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4, height: 36 }}>
      {bars.map((bar, i) => (
        <Animated.View key={i} style={{ width: 4, height: 28, borderRadius: 2, backgroundColor: color, transform: [{ scaleY: bar }] }} />
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
  const { addMessage, currentSession, startNewSession } = useSessionStore();
  const preferred_language = useUserStore((s) => s.preferred_language);

  const pulseAnim = useRef(new Animated.Value(1)).current;
  const resultSlide = useRef(new Animated.Value(300)).current;

  const overlayMode: OverlayMode = useMemo(() => {
    if (audioStore.state === 'PLAYING') return 'speaking';
    if (audioStore.state === 'RECORDING') return 'recording';
    if (audioStore.state === 'STT_PROCESSING') return 'processing';
    if (isAnalyzing) return 'analyzing';
    return 'idle';
  }, [audioStore.state, isAnalyzing]);

  // Whether we have a valid diagnosis result (not a retake request)
  const hasResult = result && !result.needs_retake;

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
    if (hasResult) {
      Animated.spring(resultSlide, { toValue: 0, useNativeDriver: true, tension: 40, friction: 8 }).start();
    } else {
      resultSlide.setValue(300);
    }
  }, [hasResult]);

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
      setIsAnalyzing(false);

      // Ensure we have a session so follow-up history works
      if (!currentSession) startNewSession();

      const diseaseName = cleanDiseaseName(finding.disease_name_kn || finding.disease_name);
      addMessage({
        id: Date.now().toString(), role: 'assistant',
        text: finding.summary_kn || diseaseName || t('diagnose'),
        sources: finding.sources || [], timestamp: Date.now(), is_diagnosis: true,
        audio_base64: finding.audio_base64 || undefined,
      });

      // Auto-play full diagnosis audio (disease + remedies)
      // Result card is now visible DURING playback
      setCanAskFollowUp(true);
      await playDiagnosisAudio(finding.audio_base64);
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
      if (audioStore.state === 'PLAYING') {
        // Stop current playback first
        await stopPlayback();
        audioStore.setState('IDLE');
        return;
      }
      if (audioStore.state === 'IDLE' || audioStore.state === 'ERROR') {
        audioStore.setState('RECORDING');
        await startRecording();
        return;
      }
      if (audioStore.state !== 'RECORDING') return;
      audioStore.setState('STT_PROCESSING');
      const recordedAudio = await stopRecordingAndGetBase64();
      if (!currentSession) startNewSession();
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

  // Confidence color
  const confColor = (result?.confidence_pct ?? 0) >= 60 ? '#4CAF50' : (result?.confidence_pct ?? 0) >= 30 ? '#FF9800' : '#F44336';

  return (
    <View style={styles.container}>
      {/* ─── TOP SECTION: Camera placeholder OR captured image ─── */}
      {!hasResult ? (
        /* Full camera zone when no result yet */
        <TouchableOpacity
          style={styles.cameraZoneFull}
          onPress={overlayMode === 'idle' && !imageUri ? captureAndDiagnose : undefined}
          activeOpacity={0.9}
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

          {/* Processing overlay — only when no result yet */}
          {overlayMode !== 'idle' && (
            <View style={styles.loadingOverlay}>
              <Animated.View style={[styles.orbContainer, { transform: [{ scale: pulseAnim }] }]}>
                <LinearGradient colors={['rgba(46,125,50,0.9)', 'rgba(27,94,32,0.9)']} style={styles.orb}>
                  <MaterialCommunityIcons name="leaf" size={40} color="#fff" />
                </LinearGradient>
              </Animated.View>
              <WaveformBars active />
              <Text style={styles.overlayStatus}>
                {overlayMode === 'analyzing' ? t('analyzing') : overlayMode === 'processing' ? t('thinking') : ''}
              </Text>
            </View>
          )}
        </TouchableOpacity>
      ) : (
        /* Compact image strip when result is showing */
        <View style={styles.imageStrip}>
          {imageUri && <Image source={{ uri: imageUri }} style={styles.stripImage} />}
          <View style={styles.stripOverlay}>
            <TouchableOpacity style={styles.retakeChip} onPress={resetDiagnosis} activeOpacity={0.85}>
              <MaterialCommunityIcons name="camera-retake" size={16} color="#fff" />
              <Text style={styles.retakeChipText}>{t('newPhoto')}</Text>
            </TouchableOpacity>
          </View>
        </View>
      )}

      {/* ─── RESULT CARD — stays visible during speaking/recording ─── */}
      {hasResult && (
        <Animated.View style={[styles.resultCard, { transform: [{ translateY: resultSlide }] }]}>
          <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 140 }}>
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

            {/* Now Playing / Speaking indicator */}
            {overlayMode === 'speaking' && (
              <TouchableOpacity
                style={styles.nowPlayingBar}
                onPress={async () => { await stopPlayback(); audioStore.setState('IDLE'); }}
                activeOpacity={0.85}
              >
                <WaveformBars active color={Colors.primary} />
                <Text style={styles.nowPlayingText}>{t('speaking')}</Text>
                <MaterialCommunityIcons name="stop-circle" size={24} color={Colors.error} />
              </TouchableOpacity>
            )}

            {/* Recording indicator */}
            {(overlayMode === 'recording' || overlayMode === 'processing') && (
              <View style={styles.nowPlayingBar}>
                <WaveformBars active color={overlayMode === 'recording' ? Colors.error : Colors.primary} />
                <Text style={styles.nowPlayingText}>
                  {overlayMode === 'recording' ? t('listening') : t('thinking')}
                </Text>
                {overlayMode === 'processing' && <ActivityIndicator size="small" color={Colors.primary} />}
              </View>
            )}

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
            {result.audio_base64 && overlayMode === 'idle' && (
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

      {/* ─── BOTTOM ACTION BAR ─── */}
      <View style={styles.bottomBar}>
        {/* Follow-up hint */}
        {hasResult && canAskFollowUp && overlayMode === 'idle' && (
          <Text style={styles.followUpHint}>{t('askFollowUp')}</Text>
        )}

        {/* Primary Action Button */}
        {!hasResult ? (
          /* Camera / analyzing button */
          <TouchableOpacity
            style={[
              styles.primaryButton,
              (overlayMode === 'analyzing' || overlayMode === 'processing') && styles.primaryButtonDisabled,
            ]}
            onPress={captureAndDiagnose}
            disabled={overlayMode !== 'idle'}
            activeOpacity={0.85}
          >
            {overlayMode === 'analyzing' || overlayMode === 'processing' ? (
              <ActivityIndicator size="large" color="#fff" />
            ) : (
              <MaterialCommunityIcons name="camera" size={36} color="#fff" />
            )}
          </TouchableOpacity>
        ) : (
          /* Follow-up buttons when result exists */
          <View style={styles.followUpActions}>
            {overlayMode === 'speaking' ? (
              <TouchableOpacity
                style={[styles.primaryButton, { backgroundColor: Colors.error }]}
                onPress={async () => { await stopPlayback(); audioStore.setState('IDLE'); }}
                activeOpacity={0.85}
              >
                <MaterialCommunityIcons name="stop" size={36} color="#fff" />
              </TouchableOpacity>
            ) : overlayMode === 'recording' ? (
              <TouchableOpacity
                style={[styles.primaryButton, { backgroundColor: Colors.error }]}
                onPress={handleFollowUpQuestion}
                activeOpacity={0.85}
              >
                <MaterialCommunityIcons name="stop" size={36} color="#fff" />
              </TouchableOpacity>
            ) : overlayMode === 'processing' ? (
              <View style={[styles.primaryButton, styles.primaryButtonDisabled]}>
                <ActivityIndicator size="large" color="#fff" />
              </View>
            ) : (
              <TouchableOpacity
                style={[styles.primaryButton, { backgroundColor: '#2196F3' }]}
                onPress={handleFollowUpQuestion}
                activeOpacity={0.85}
              >
                <MaterialCommunityIcons name="microphone" size={36} color="#fff" />
              </TouchableOpacity>
            )}
          </View>
        )}

        <Text style={styles.bottomHint}>
          {!hasResult
            ? (overlayMode === 'analyzing' ? t('analyzing') : t('diagnose'))
            : overlayMode === 'speaking' ? t('tapToStop')
            : overlayMode === 'recording' ? t('listening')
            : overlayMode === 'processing' ? t('thinking')
            : t('askFollowUp')
          }
        </Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background },

  // ── Full camera zone (before result) ──
  cameraZoneFull: { flex: 0.55, position: 'relative', overflow: 'hidden' },
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

  // ── Compact image strip (after result) ──
  imageStrip: { height: 120, position: 'relative', overflow: 'hidden' },
  stripImage: { width: '100%', height: '100%', resizeMode: 'cover' },
  stripOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.35)',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'flex-end',
    paddingHorizontal: 16,
  },
  retakeChip: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    backgroundColor: 'rgba(0,0,0,0.6)', paddingHorizontal: 12, paddingVertical: 6,
    borderRadius: 20,
  },
  retakeChipText: { fontSize: 12, color: '#fff', fontWeight: '700' },

  // ── Result card ──
  resultCard: {
    flex: 1, backgroundColor: Colors.background,
    borderTopLeftRadius: 24, borderTopRightRadius: 24,
    marginTop: -16, paddingHorizontal: Spacing.md, paddingTop: Spacing.md,
  },
  resultHeader: { flexDirection: 'row', alignItems: 'center', paddingBottom: Spacing.sm, borderBottomWidth: 1, borderBottomColor: Colors.border },
  diseaseName: { fontSize: 18, fontWeight: '800', color: Colors.textPrimary },
  diseaseNameEn: { fontSize: 13, color: Colors.textMuted, marginTop: 2 },
  confBadge: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 12 },
  confText: { fontSize: 14, fontWeight: '800' },

  nowPlayingBar: {
    flexDirection: 'row', alignItems: 'center', gap: 10,
    backgroundColor: Colors.primarySoft, paddingHorizontal: 14, paddingVertical: 10,
    borderRadius: BorderRadius.lg, marginTop: Spacing.sm,
  },
  nowPlayingText: { flex: 1, fontSize: 14, fontWeight: '700', color: Colors.primary },

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

  // ── Bottom bar ──
  bottomBar: {
    position: 'absolute', bottom: 0, left: 0, right: 0,
    paddingBottom: 28, paddingTop: Spacing.sm, alignItems: 'center',
    backgroundColor: Colors.background + 'EE',
  },
  followUpHint: { fontSize: 12, color: Colors.textMuted, marginBottom: 6 },
  followUpActions: { flexDirection: 'row', alignItems: 'center', gap: 16 },
  primaryButton: { width: 72, height: 72, borderRadius: 36, backgroundColor: Colors.primary, alignItems: 'center', justifyContent: 'center', ...Shadows.lg },
  primaryButtonDisabled: { backgroundColor: Colors.disabled },
  bottomHint: { fontSize: 12, color: Colors.textMuted, marginTop: 6 },
});
