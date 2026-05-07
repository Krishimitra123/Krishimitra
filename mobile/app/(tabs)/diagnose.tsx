/**
 * Diagnose Screen — Voice-first crop disease detection.
 * Camera viewfinder, detect disease, auto-plays voice advisory.
 * Retake button always shown after detection.
 */

import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity,
  Image, ActivityIndicator, Alert, Animated, Dimensions,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { Colors, FontSize, Spacing, BorderRadius, Shadows } from '@/constants/theme';
import { captureImageWithUri } from '@/services/diagnosisService';
import { playBase64Audio, startRecording, stopRecordingAndGetBase64, stopPlayback } from '@/services/voiceService';
import { sendDiagnosis, sendVoiceQuery, ConversationTurn } from '@/services/queryService';
import { useAudioStore } from '@/stores/useAudioStore';
import { useSessionStore } from '@/stores/useSessionStore';

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
  const [result, setResult] = useState<any>(null);
  const [diseaseOverlay, setDiseaseOverlay] = useState<string | null>(null);
  const [canAskFollowUp, setCanAskFollowUp] = useState(false);

  const audioStore = useAudioStore();
  const { addMessage, currentSession } = useSessionStore();

  const diseaseOpacity = useRef(new Animated.Value(0)).current;
  const pulseAnim = useRef(new Animated.Value(1)).current;

  const overlayMode: OverlayMode = useMemo(() => {
    if (audioStore.state === 'PLAYING') return 'speaking';
    if (audioStore.state === 'RECORDING') return 'recording';
    if (audioStore.state === 'STT_PROCESSING') return 'processing';
    if (isAnalyzing) return 'analyzing';
    return 'idle';
  }, [audioStore.state, isAnalyzing]);

  useEffect(() => {
    if (!diseaseOverlay) { diseaseOpacity.setValue(0); return; }
    diseaseOpacity.setValue(0);
    Animated.timing(diseaseOpacity, { toValue: 1, duration: 300, useNativeDriver: true }).start();
    const hideTimer = setTimeout(() => {
      Animated.timing(diseaseOpacity, { toValue: 0, duration: 800, useNativeDriver: true }).start(({ finished }) => {
        if (finished) setDiseaseOverlay(null);
      });
    }, 5000);
    return () => clearTimeout(hideTimer);
  }, [diseaseOverlay]);

  useEffect(() => {
    if (overlayMode === 'idle') { pulseAnim.setValue(1); return; }
    const pulse = Animated.loop(Animated.sequence([
      Animated.timing(pulseAnim, { toValue: 1.1, duration: 700, useNativeDriver: true }),
      Animated.timing(pulseAnim, { toValue: 1, duration: 700, useNativeDriver: true }),
    ]));
    pulse.start();
    return () => { pulse.stop(); };
  }, [overlayMode]);

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
      setDiseaseOverlay(null);
      setIsAnalyzing(true);

      const finding = await sendDiagnosis(image.base64, image.mimeType);
      setResult(finding);

      const diseaseName = cleanDiseaseName(finding.disease_name_kn || finding.disease_name);
      if (diseaseName) setDiseaseOverlay(diseaseName);

      addMessage({
        id: Date.now().toString(), role: 'assistant',
        text: finding.summary_kn || diseaseName || 'ರೋಗ ಪತ್ತೆ ಪೂರ್ಣ',
        sources: finding.sources || [], timestamp: Date.now(), is_diagnosis: true,
        audio_base64: finding.audio_base64 || undefined,
      });

      await playDiagnosisAudio(finding.audio_base64);
      setCanAskFollowUp(true);
    } catch (error: any) {
      console.error('[Diagnose] Error:', error);
      Alert.alert('ದೋಷ', error?.response?.data?.detail || error?.message || 'ಮತ್ತೊಮ್ಮೆ ಪ್ರಯತ್ನಿಸಿ');
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
      addMessage({
        id: (Date.now() + 1).toString(), role: 'assistant',
        text: response.answer_text_kn, sources: response.sources || [],
        timestamp: Date.now(), is_diagnosis: true, audio_base64: response.audio_base64 || undefined,
      });
      await playDiagnosisAudio(response.audio_base64);
    } catch (error: any) {
      Alert.alert('ದೋಷ', error?.response?.data?.detail || error?.message || 'ಮತ್ತೊಮ್ಮೆ ಪ್ರಯತ್ನಿಸಿ');
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
    setDiseaseOverlay(null);
    audioStore.setState('IDLE');
  }, [audioStore]);

  const handlePrimaryPress = useCallback(async () => {
    if (overlayMode === 'analyzing' || overlayMode === 'processing' || overlayMode === 'speaking') return;
    if (canAskFollowUp) { await handleFollowUpQuestion(); return; }
    await captureAndDiagnose();
  }, [canAskFollowUp, captureAndDiagnose, handleFollowUpQuestion, overlayMode]);

  const primaryButtonDisabled = overlayMode === 'analyzing' || overlayMode === 'processing' || overlayMode === 'speaking';
  const micIcon = overlayMode === 'recording' ? 'stop' : canAskFollowUp ? 'microphone' : 'camera';

  return (
    <View style={styles.container}>
      {/* Camera / Image zone */}
      <View style={styles.cameraZone}>
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
            <Text style={styles.cameraHint}>ಎಲೆ ಅಥವಾ ಸಸ್ಯದ ಫೋಟೋ ತೆಗೆಯಿರಿ</Text>
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
              {overlayMode === 'analyzing' ? 'ವಿಶ್ಲೇಷಿಸುತ್ತಿದೆ...' :
               overlayMode === 'recording' ? 'ಕೇಳುತ್ತಿದೆ...' :
               overlayMode === 'processing' ? 'ಯೋಚಿಸುತ್ತಿದೆ...' :
               overlayMode === 'speaking' ? 'ಹೇಳುತ್ತಿದೆ...' : ''}
            </Text>
          </View>
        )}

        {/* Disease result overlay */}
        {diseaseOverlay && (
          <Animated.View style={[styles.diseaseOverlay, { opacity: diseaseOpacity }]}>
            <MaterialCommunityIcons name="alert-circle" size={20} color="#fff" style={{ marginBottom: 4 }} />
            <Text style={styles.diseaseNameText}>{diseaseOverlay}</Text>
          </Animated.View>
        )}

        {/* Retake button — always visible after image captured */}
        {imageUri && overlayMode !== 'analyzing' && overlayMode !== 'processing' && (
          <TouchableOpacity style={styles.retakeButton} onPress={resetDiagnosis} activeOpacity={0.85}>
            <MaterialCommunityIcons name="camera-retake" size={20} color="#fff" />
          </TouchableOpacity>
        )}
      </View>

      {/* Bottom bar */}
      <LinearGradient colors={[Colors.surface, Colors.background]} style={styles.bottomBar}>
        {result && canAskFollowUp && (
          <Text style={styles.followUpHint}>ಪ್ರಶ್ನೆ ಕೇಳಲು ಮೈಕ್ ಒತ್ತಿ</Text>
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
          {canAskFollowUp ? 'ಅಡ್ಡ ಪ್ರಶ್ನೆ' : 'ರೋಗ ಪತ್ತೆ'}
        </Text>
      </LinearGradient>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0d1f0f' },
  cameraZone: { flex: 0.78, position: 'relative', overflow: 'hidden' },
  cameraPlaceholder: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  scanFrame: { width: 220, height: 220, alignItems: 'center', justifyContent: 'center', position: 'relative' },
  corner: { position: 'absolute', width: 28, height: 28, borderColor: 'rgba(76,175,80,0.8)', borderWidth: 3 },
  cornerTL: { top: 0, left: 0, borderBottomWidth: 0, borderRightWidth: 0 },
  cornerTR: { top: 0, right: 0, borderBottomWidth: 0, borderLeftWidth: 0 },
  cornerBL: { bottom: 0, left: 0, borderTopWidth: 0, borderRightWidth: 0 },
  cornerBR: { bottom: 0, right: 0, borderTopWidth: 0, borderLeftWidth: 0 },
  cameraHint: { color: 'rgba(255,255,255,0.5)', fontSize: FontSize.sm, marginTop: Spacing.xl, textAlign: 'center' },
  previewImage: { width: '100%', height: '100%', resizeMode: 'cover' },

  loadingOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.75)',
    alignItems: 'center', justifyContent: 'center', gap: Spacing.md,
  },
  orbContainer: {},
  orb: { width: 100, height: 100, borderRadius: 50, alignItems: 'center', justifyContent: 'center', borderWidth: 2, borderColor: 'rgba(255,255,255,0.3)' },
  overlayStatus: { color: 'rgba(255,255,255,0.9)', fontSize: FontSize.lg, fontWeight: '700', marginTop: Spacing.sm },

  diseaseOverlay: {
    position: 'absolute', bottom: Spacing.lg,
    left: Spacing.md, right: Spacing.md,
    backgroundColor: 'rgba(0,0,0,0.85)',
    borderRadius: BorderRadius.lg,
    paddingVertical: Spacing.md, paddingHorizontal: Spacing.md,
    alignItems: 'center',
    borderWidth: 1, borderColor: 'rgba(255,255,255,0.15)',
  },
  diseaseNameText: { color: '#fff', fontSize: FontSize.xl, fontWeight: '800', textAlign: 'center' },

  retakeButton: {
    position: 'absolute', top: Spacing.xl + 12, right: Spacing.lg,
    width: 46, height: 46, borderRadius: 23,
    backgroundColor: 'rgba(0,0,0,0.65)',
    alignItems: 'center', justifyContent: 'center',
    borderWidth: 1.5, borderColor: 'rgba(255,255,255,0.4)',
  },

  bottomBar: {
    flex: 0.22, alignItems: 'center', justifyContent: 'center',
    paddingVertical: Spacing.lg, gap: Spacing.sm,
  },
  followUpHint: { fontSize: FontSize.sm, color: Colors.textMuted, fontWeight: '500' },
  primaryButton: {
    width: 82, height: 82, borderRadius: 41,
    backgroundColor: Colors.primary,
    alignItems: 'center', justifyContent: 'center',
    shadowColor: Colors.primary, shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.45, shadowRadius: 14, elevation: 10,
    borderWidth: 3, borderColor: 'rgba(255,255,255,0.5)',
  },
  primaryButtonFollowUp: { backgroundColor: Colors.accent, shadowColor: Colors.accent },
  primaryButtonRecording: { backgroundColor: Colors.error, shadowColor: Colors.error },
  primaryButtonDisabled: { opacity: 0.7 },
  bottomHint: { fontSize: FontSize.xs, color: Colors.textMuted, fontWeight: '600', textTransform: 'uppercase', letterSpacing: 0.5 },
});
