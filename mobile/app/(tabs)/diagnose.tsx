/**
 * Diagnose Screen — voice-first crop disease detection.
 * 80% camera viewfinder, one large bottom button, no on-screen response text.
 */

import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Image,
  ActivityIndicator,
  Alert,
  Animated,
} from 'react-native';
import { Colors, FontSize, Spacing, BorderRadius, Shadows } from '@/constants/theme';
import { captureImageWithUri } from '@/services/diagnosisService';
import { playBase64Audio, startRecording, stopRecordingAndGetBase64 } from '@/services/voiceService';
import { sendDiagnosis, sendVoiceQuery, ConversationTurn } from '@/services/queryService';
import { useAudioStore } from '@/stores/useAudioStore';
import { useSessionStore } from '@/stores/useSessionStore';

type OverlayMode = 'idle' | 'analyzing' | 'recording' | 'processing' | 'speaking';

function cleanDiseaseName(value?: string | null): string {
  if (!value) return '';
  return value.split('(')[0].trim();
}

function buildConversationHistory(messages: Array<{ role: 'user' | 'assistant'; text: string }>): ConversationTurn[] {
  return messages
    .filter((message) => message.text.trim().length > 0)
    .slice(-6)
    .map((message) => ({ role: message.role, content: message.text }));
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
  const waveformBars = useRef(Array.from({ length: 5 }, () => new Animated.Value(0.45))).current;

  const overlayMode: OverlayMode = useMemo(() => {
    if (audioStore.state === 'PLAYING') return 'speaking';
    if (audioStore.state === 'RECORDING') return 'recording';
    if (audioStore.state === 'STT_PROCESSING') return 'processing';
    if (isAnalyzing) return 'analyzing';
    return 'idle';
  }, [audioStore.state, isAnalyzing]);

  useEffect(() => {
    if (!diseaseOverlay) {
      diseaseOpacity.setValue(0);
      return;
    }

    diseaseOpacity.setValue(0);
    Animated.timing(diseaseOpacity, {
      toValue: 1,
      duration: 250,
      useNativeDriver: true,
    }).start();

    const hideTimer = setTimeout(() => {
      Animated.timing(diseaseOpacity, {
        toValue: 0,
        duration: 800,
        useNativeDriver: true,
      }).start(({ finished }) => {
        if (finished) {
          setDiseaseOverlay(null);
        }
      });
    }, 3000);

    return () => clearTimeout(hideTimer);
  }, [diseaseOverlay, diseaseOpacity]);

  useEffect(() => {
    if (overlayMode === 'idle') {
      pulseAnim.setValue(1);
      waveformBars.forEach((bar) => bar.setValue(0.45));
      return;
    }

    const pulse = Animated.loop(
      Animated.sequence([
        Animated.timing(pulseAnim, {
          toValue: 1.08,
          duration: 700,
          useNativeDriver: true,
        }),
        Animated.timing(pulseAnim, {
          toValue: 1,
          duration: 700,
          useNativeDriver: true,
        }),
      ])
    );
    pulse.start();

    const barLoops = waveformBars.map((bar, index) =>
      Animated.loop(
        Animated.sequence([
          Animated.timing(bar, {
            toValue: 1.15,
            duration: 420 + index * 40,
            useNativeDriver: true,
          }),
          Animated.timing(bar, {
            toValue: 0.45,
            duration: 420 + index * 40,
            useNativeDriver: true,
          }),
        ])
      )
    );

    const timers = barLoops.map((loop, index) =>
      setTimeout(() => loop.start(), index * 90)
    );

    return () => {
      pulse.stop();
      barLoops.forEach((loop) => loop.stop());
      timers.forEach((timer) => clearTimeout(timer));
    };
  }, [overlayMode, pulseAnim, waveformBars]);

  const playDiagnosisAudio = useCallback(
    async (audioBase64?: string | null) => {
      if (!audioBase64) {
        return;
      }

      try {
        audioStore.setState('PLAYING');
        await playBase64Audio(audioBase64);
      } catch (error) {
        console.error('[Diagnose] Audio playback error:', error);
      } finally {
        audioStore.setState('IDLE');
      }
    },
    [audioStore]
  );

  const captureAndDiagnose = useCallback(async () => {
    if (isAnalyzing || overlayMode !== 'idle') {
      return;
    }

    try {
      const image = await captureImageWithUri();
      if (!image) {
        return;
      }

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
      if (diseaseName) {
        setDiseaseOverlay(diseaseName);
      }

      addMessage({
        id: Date.now().toString(),
        role: 'assistant',
        text: finding.summary_kn || diseaseName || 'ರೋಗ ಪತ್ತೆ ಪೂರ್ಣವಾಗಿದೆ',
        sources: finding.sources || [],
        timestamp: Date.now(),
        is_diagnosis: true,
        audio_base64: finding.audio_base64 || undefined,
      });

      await playDiagnosisAudio(finding.audio_base64);
      setCanAskFollowUp(true);
    } catch (error: any) {
      console.error('[Diagnose] Diagnosis error:', error);
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

      if (audioStore.state !== 'RECORDING') {
        return;
      }

      audioStore.setState('STT_PROCESSING');
      const recordedAudio = await stopRecordingAndGetBase64();
      const history = buildConversationHistory(currentSession?.messages ?? []);

      addMessage({
        id: Date.now().toString(),
        role: 'user',
        text: '🎙️ ...',
        sources: [],
        timestamp: Date.now(),
        is_diagnosis: true,
      });

      const response = await sendVoiceQuery(
        recordedAudio.base64,
        recordedAudio.mimeType,
        history
      );

      addMessage({
        id: (Date.now() + 1).toString(),
        role: 'assistant',
        text: response.answer_text_kn,
        sources: response.sources || [],
        timestamp: Date.now(),
        is_diagnosis: true,
        audio_base64: response.audio_base64 || undefined,
      });

      await playDiagnosisAudio(response.audio_base64);
    } catch (error: any) {
      console.error('[Diagnose] Follow-up error:', error);
      Alert.alert('ದೋಷ', error?.response?.data?.detail || error?.message || 'ಮತ್ತೊಮ್ಮೆ ಪ್ರಯತ್ನಿಸಿ');
    } finally {
      audioStore.setState('IDLE');
    }
  }, [addMessage, audioStore, currentSession?.messages, playDiagnosisAudio]);

  const handlePrimaryPress = useCallback(async () => {
    if (overlayMode === 'analyzing' || overlayMode === 'processing' || overlayMode === 'speaking') {
      return;
    }

    if (canAskFollowUp) {
      await handleFollowUpQuestion();
      return;
    }

    await captureAndDiagnose();
  }, [canAskFollowUp, captureAndDiagnose, handleFollowUpQuestion, overlayMode]);

  const primaryButtonIcon = (() => {
    if (overlayMode === 'recording') return '⏹';
    if (canAskFollowUp) return '🎙️';
    return '📸';
  })();

  const primaryButtonDisabled = overlayMode === 'analyzing' || overlayMode === 'processing' || overlayMode === 'speaking';

  return (
    <View style={styles.container}>
      <TouchableOpacity
        style={styles.cameraZone}
        activeOpacity={0.92}
        onPress={handlePrimaryPress}
      >
        {imageUri ? (
          <Image source={{ uri: imageUri }} style={styles.previewImage} />
        ) : (
          <View style={styles.cameraPlaceholder}>
            <Text style={styles.cameraPlaceholderIcon}>📸</Text>
          </View>
        )}

        {overlayMode !== 'idle' && (
          <View style={styles.loadingOverlay}>
            <Animated.View style={[styles.logoContainer, { transform: [{ scale: pulseAnim }] }]}>
              <Text style={styles.logoText}>
                {overlayMode === 'recording' ? '🎙️' : overlayMode === 'speaking' ? '🔊' : '🌾'}
              </Text>
            </Animated.View>
            <View style={styles.waveform}>
              {waveformBars.map((bar, index) => (
                <Animated.View
                  key={index}
                  style={[
                    styles.waveBar,
                    {
                      transform: [{ scaleY: bar }],
                      opacity: overlayMode === 'speaking' ? 0.95 : 0.9,
                    },
                  ]}
                />
              ))}
            </View>
          </View>
        )}

        {diseaseOverlay && (
          <Animated.View style={[styles.diseaseOverlay, { opacity: diseaseOpacity }]}>
            <Text style={styles.diseaseNameText}>{diseaseOverlay}</Text>
          </Animated.View>
        )}
      </TouchableOpacity>

      <View style={styles.bottomBar}>
        <TouchableOpacity
          style={[
            styles.primaryButton,
            canAskFollowUp && styles.primaryButtonFollowUp,
            overlayMode === 'recording' && styles.primaryButtonRecording,
            overlayMode === 'analyzing' && styles.primaryButtonAnalyzing,
          ]}
          onPress={handlePrimaryPress}
          disabled={primaryButtonDisabled}
          activeOpacity={0.8}
        >
          {overlayMode === 'analyzing' || overlayMode === 'processing' ? (
            <ActivityIndicator size="small" color={Colors.textOnPrimary} />
          ) : (
            <Text style={styles.primaryButtonIcon}>{primaryButtonIcon}</Text>
          )}
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  cameraZone: {
    flex: 0.8,
    backgroundColor: '#000',
    position: 'relative',
    overflow: 'hidden',
  },
  cameraPlaceholder: {
    flex: 1,
    backgroundColor: '#111',
    justifyContent: 'center',
    alignItems: 'center',
  },
  cameraPlaceholderIcon: {
    fontSize: 72,
  },
  previewImage: {
    width: '100%',
    height: '100%',
    resizeMode: 'cover',
  },
  loadingOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.72)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  logoContainer: {
    width: 120,
    height: 120,
    borderRadius: 60,
    backgroundColor: 'rgba(255,255,255,0.08)',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: Spacing.lg,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.15)',
  },
  logoText: {
    fontSize: 56,
  },
  waveform: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    justifyContent: 'center',
    height: 64,
    gap: Spacing.sm,
  },
  waveBar: {
    width: 8,
    height: 48,
    borderRadius: 999,
    backgroundColor: Colors.primaryLight,
  },
  diseaseOverlay: {
    position: 'absolute',
    left: Spacing.md,
    right: Spacing.md,
    bottom: Spacing.lg,
    backgroundColor: 'rgba(0,0,0,0.82)',
    borderRadius: BorderRadius.lg,
    paddingVertical: Spacing.md,
    paddingHorizontal: Spacing.md,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.12)',
  },
  diseaseNameText: {
    color: '#fff',
    textAlign: 'center',
    fontSize: FontSize.xxl,
    fontWeight: '800',
  },
  bottomBar: {
    flex: 0.2,
    backgroundColor: Colors.background,
    justifyContent: 'center',
    alignItems: 'center',
  },
  primaryButton: {
    width: 78,
    height: 78,
    borderRadius: 39,
    backgroundColor: Colors.primary,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 3,
    borderColor: 'rgba(255,255,255,0.65)',
    ...Shadows.sm,
  },
  primaryButtonFollowUp: {
    backgroundColor: Colors.accent,
    borderColor: 'rgba(255,255,255,0.78)',
  },
  primaryButtonRecording: {
    backgroundColor: Colors.error,
  },
  primaryButtonAnalyzing: {
    transform: [{ scale: 1.03 }],
  },
  primaryButtonIcon: {
    fontSize: 34,
    color: '#fff',
  },
});
