/**
 * Diagnose Screen — Crop disease image diagnosis.
 * Upload/capture crop photo → optional text → send to M4 → show DiagnosisCard.
 */

import React, { useState, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Image,
  TextInput,
  ActivityIndicator,
  Alert,
} from 'react-native';
import { NivettiHeader } from '@/components/NivettiHeader';
import { DiagnosisCard } from '@/components/DiagnosisCard';
import { Colors, FontSize, Spacing, BorderRadius, Shadows } from '@/constants/theme';
import { captureImageWithUri, pickImageWithUri } from '@/services/diagnosisService';
import { sendDiagnosis } from '@/services/queryService';
import { playBase64Audio } from '@/services/voiceService';
import { useAudioStore } from '@/stores/useAudioStore';

export default function DiagnoseScreen() {
  const [imageUri, setImageUri] = useState<string | null>(null);
  const [imageBase64, setImageBase64] = useState<string | null>(null);
  const [imageMimeType, setImageMimeType] = useState<string>('image/jpeg');
  const [description, setDescription] = useState('');
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [result, setResult] = useState<any>(null);
  const [answerAudio, setAnswerAudio] = useState<string | null>(null);

  const audioStore = useAudioStore();

  // ── Camera Capture ────────────────────────────────────────────
  const handleCamera = useCallback(async () => {
    try {
      const img = await captureImageWithUri();
      if (img) {
        setImageUri(img.uri);
        setImageBase64(img.base64);
        setImageMimeType(img.mimeType);
        setResult(null);
      }
    } catch (err: any) {
      Alert.alert('ಕ್ಯಾಮೆರಾ ದೋಷ', err.message);
    }
  }, []);

  // ── Gallery Pick ──────────────────────────────────────────────
  const handleGallery = useCallback(async () => {
    try {
      const img = await pickImageWithUri();
      if (img) {
        setImageUri(img.uri);
        setImageBase64(img.base64);
        setImageMimeType(img.mimeType);
        setResult(null);
      }
    } catch (err: any) {
      Alert.alert('ಗ್ಯಾಲರಿ ದೋಷ', err.message);
    }
  }, []);

  // ── Diagnose ──────────────────────────────────────────────────
  const handleDiagnose = useCallback(async () => {
    if (!imageBase64) {
      Alert.alert('ಫೋಟೋ ಅಗತ್ಯ', 'ದಯವಿಟ್ಟು ಮೊದಲು ಫೋಟೋ ತೆಗೆಯಿರಿ');
      return;
    }

    setIsAnalyzing(true);
    setResult(null);
    setAnswerAudio(null);

    try {
      console.log('[Diagnose] Sending diagnosis request...');
      const finding = await sendDiagnosis(
        imageBase64,
        imageMimeType,
        description || undefined
      );
      console.log('[Diagnose] Finding received:', finding.disease_name, finding.confidence_pct + '%');
      setResult(finding);

      // Store and auto-play the Kannada TTS audio if available
      if ((finding as any).audio_base64) {
        const audioB64 = (finding as any).audio_base64;
        setAnswerAudio(audioB64);
        try {
          audioStore.setState('PLAYING');
          await playBase64Audio(audioB64);
        } catch (ttsErr) {
          console.warn('[Diagnose] TTS playback failed (non-fatal):', ttsErr);
        } finally {
          audioStore.setState('IDLE');
        }
      }
    } catch (err: any) {
      console.error('[Diagnose] Error:', err.message, err.response?.data);
      const errorMsg = err.response?.data?.detail
        || err.response?.data?.message
        || 'ದಯವಿಟ್ಟು ಮತ್ತೊಮ್ಮೆ ಪ್ರಯತ್ನಿಸಿ';
      Alert.alert('ವಿಶ್ಲೇಷಣೆ ದೋಷ', errorMsg);
    }

    setIsAnalyzing(false);
  }, [imageBase64, imageMimeType, description]);

  // ── Play Audio ────────────────────────────────────────────────
  const handlePlayAudio = useCallback(async () => {
    if (answerAudio) {
      try {
        audioStore.setState('PLAYING');
        await playBase64Audio(answerAudio);
        audioStore.setState('IDLE');
      } catch {
        audioStore.setState('IDLE');
      }
    }
  }, [answerAudio]);

  // ── Clear ─────────────────────────────────────────────────────
  const handleClear = () => {
    setImageUri(null);
    setImageBase64(null);
    setImageMimeType('image/jpeg');
    setDescription('');
    setResult(null);
    setAnswerAudio(null);
  };

  return (
    <View style={styles.container}>
      <NivettiHeader title="ಬೆಳೆ ರೋಗ ಪತ್ತೆ" />

      <ScrollView
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {/* Image Upload Zone */}
        <TouchableOpacity
          style={[
            styles.imageZone,
            imageUri && styles.imageZoneWithImage,
          ]}
          onPress={handleCamera}
          activeOpacity={0.8}
        >
          {imageUri ? (
            <Image source={{ uri: imageUri }} style={styles.previewImage} />
          ) : (
            <View style={styles.imagePlaceholder}>
              <Text style={styles.cameraIcon}>📸</Text>
              <Text style={styles.uploadText}>
                ಫೋಟೋ ತೆಗೆಯಿರಿ ಅಥವಾ ಆಯ್ಕೆ ಮಾಡಿ
              </Text>
              <Text style={styles.uploadHint}>
                ಎಲೆ, ಕಾಂಡ ಅಥವಾ ಹಣ್ಣಿನ ಸ್ಪಷ್ಟ ಫೋಟೋ
              </Text>
            </View>
          )}
        </TouchableOpacity>

        {/* Camera / Gallery Buttons */}
        <View style={styles.actionRow}>
          <TouchableOpacity style={[styles.actionBtn, Shadows.sm]} onPress={handleCamera}>
            <Text style={styles.actionIcon}>📷</Text>
            <Text style={styles.actionLabel}>ಕ್ಯಾಮೆರಾ</Text>
          </TouchableOpacity>
          <TouchableOpacity style={[styles.actionBtn, Shadows.sm]} onPress={handleGallery}>
            <Text style={styles.actionIcon}>🖼️</Text>
            <Text style={styles.actionLabel}>ಗ್ಯಾಲರಿ</Text>
          </TouchableOpacity>
          {imageUri && (
            <TouchableOpacity style={[styles.actionBtn, styles.clearBtn]} onPress={handleClear}>
              <Text style={styles.actionIcon}>🗑️</Text>
              <Text style={[styles.actionLabel, { color: Colors.error }]}>ಅಳಿಸಿ</Text>
            </TouchableOpacity>
          )}
        </View>

        {/* Optional Description */}
        <View style={styles.inputSection}>
          <Text style={styles.inputLabel}>ಹೆಚ್ಚಿನ ವಿವರಣೆ ನೀಡಿ (ಐಚ್ಛಿಕ)</Text>
          <TextInput
            style={styles.textInput}
            placeholder="ಎಲೆ ಹಳದಿ ಆಗಿದೆ, ಚುಕ್ಕಿ ಇದೆ..."
            placeholderTextColor={Colors.textMuted}
            value={description}
            onChangeText={setDescription}
            multiline
            numberOfLines={2}
          />
        </View>

        {/* Diagnose Button */}
        <TouchableOpacity
          style={[
            styles.diagnoseBtn,
            (!imageBase64 || isAnalyzing) && styles.diagnoseBtnDisabled,
          ]}
          onPress={handleDiagnose}
          disabled={!imageBase64 || isAnalyzing}
          activeOpacity={0.7}
        >
          {isAnalyzing ? (
            <View style={styles.loadingRow}>
              <ActivityIndicator size="small" color={Colors.textOnPrimary} />
              <Text style={styles.diagnoseBtnText}>ವಿಶ್ಲೇಷಿಸಲಾಗುತ್ತಿದೆ...</Text>
            </View>
          ) : (
            <Text style={styles.diagnoseBtnText}>🔍 ರೋಗ ಪತ್ತೆ ಮಾಡಿ</Text>
          )}
        </TouchableOpacity>

        {/* Results */}
        {result && (
          <View style={styles.resultSection}>
            <Text style={styles.resultHeader}>ಫಲಿತಾಂಶ</Text>

            {/* Kannada Summary */}
            {result.summary_kn && (
              <View style={[styles.summaryCard, Shadows.sm]}>
                <Text style={styles.summaryText}>{result.summary_kn}</Text>
                {answerAudio && (
                  <TouchableOpacity onPress={handlePlayAudio} style={styles.playAgainBtn}>
                    <Text style={styles.playAgainText}>🔊 ಮತ್ತೊಮ್ಮೆ ಕೇಳಿ</Text>
                  </TouchableOpacity>
                )}
              </View>
            )}

            {result.disease_name ? (
              <DiagnosisCard
                finding={result}
                onPlayAudio={answerAudio ? handlePlayAudio : undefined}
              />
            ) : (
              <View style={[styles.resultCard, Shadows.sm]}>
                <Text style={styles.resultText}>
                  {'ಫೋಟೋ ಮತ್ತೊಮ್ಮೆ ತೆಗೆಯಿರಿ — ಸ್ಪಷ್ಟ ಬೆಳಕಿನಲ್ಲಿ ತೆಗೆಯಿರಿ.'}
                </Text>
              </View>
            )}
          </View>
        )}

        {/* Tips Section */}
        <View style={styles.tipsSection}>
          <Text style={styles.tipsTitle}>📌 ಉತ್ತಮ ಫೋಟೋ ಸಲಹೆಗಳು</Text>
          <Text style={styles.tipItem}>• ನೈಸರ್ಗಿಕ ಬೆಳಕಿನಲ್ಲಿ ಫೋಟೋ ತೆಗೆಯಿರಿ</Text>
          <Text style={styles.tipItem}>• ರೋಗಪೀಡಿತ ಭಾಗವನ್ನು ಹತ್ತಿರದಿಂದ ತೋರಿಸಿ</Text>
          <Text style={styles.tipItem}>• ಸ್ಪಷ್ಟ ಮತ್ತು ಮಸುಕಿಲ್ಲದ ಫೋಟೋ ಅಗತ್ಯ</Text>
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
  scrollContent: {
    padding: Spacing.md,
    paddingBottom: Spacing.xxl,
  },
  imageZone: {
    height: 224,
    borderRadius: BorderRadius.lg,
    borderWidth: 2,
    borderColor: Colors.primary,
    borderStyle: 'dashed',
    overflow: 'hidden',
    marginBottom: Spacing.md,
  },
  imageZoneWithImage: {
    borderStyle: 'solid',
    borderColor: Colors.primary,
  },
  imagePlaceholder: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: Colors.primarySoft,
  },
  cameraIcon: {
    fontSize: 48,
    marginBottom: Spacing.sm,
  },
  uploadText: {
    fontSize: FontSize.md,
    color: Colors.primary,
    fontWeight: '600',
  },
  uploadHint: {
    fontSize: FontSize.sm,
    color: Colors.textMuted,
    marginTop: 4,
  },
  previewImage: {
    width: '100%',
    height: '100%',
    resizeMode: 'cover',
  },
  actionRow: {
    flexDirection: 'row',
    gap: Spacing.sm,
    marginBottom: Spacing.lg,
  },
  actionBtn: {
    flex: 1,
    backgroundColor: Colors.surface,
    borderRadius: BorderRadius.md,
    padding: Spacing.md,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: Colors.border,
  },
  clearBtn: {
    borderColor: Colors.error + '40',
    backgroundColor: '#FFF5F5',
  },
  actionIcon: {
    fontSize: 24,
    marginBottom: 4,
  },
  actionLabel: {
    fontSize: FontSize.sm,
    color: Colors.textSecondary,
    fontWeight: '600',
  },
  inputSection: {
    marginBottom: Spacing.lg,
  },
  inputLabel: {
    fontSize: FontSize.md,
    color: Colors.textSecondary,
    fontWeight: '600',
    marginBottom: Spacing.xs,
  },
  textInput: {
    backgroundColor: Colors.surface,
    borderRadius: BorderRadius.md,
    padding: Spacing.md,
    fontSize: FontSize.md,
    color: Colors.textPrimary,
    borderWidth: 1,
    borderColor: Colors.border,
    minHeight: 60,
    textAlignVertical: 'top',
  },
  diagnoseBtn: {
    backgroundColor: Colors.primary,
    borderRadius: BorderRadius.full,
    paddingVertical: Spacing.md,
    alignItems: 'center',
    marginBottom: Spacing.lg,
  },
  diagnoseBtnDisabled: {
    backgroundColor: Colors.disabled,
  },
  diagnoseBtnText: {
    fontSize: FontSize.lg,
    color: Colors.textOnPrimary,
    fontWeight: '700',
  },
  loadingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
  },
  resultSection: {
    marginBottom: Spacing.lg,
  },
  resultHeader: {
    fontSize: FontSize.lg,
    fontWeight: '700',
    color: Colors.textPrimary,
    marginBottom: Spacing.sm,
  },
  resultCard: {
    backgroundColor: Colors.surface,
    borderRadius: BorderRadius.lg,
    padding: Spacing.md,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  resultText: {
    fontSize: FontSize.md,
    color: Colors.textPrimary,
    lineHeight: 24,
  },
  tipsSection: {
    backgroundColor: Colors.accentSoft,
    borderRadius: BorderRadius.lg,
    padding: Spacing.md,
    borderLeftWidth: 3,
    borderLeftColor: Colors.accent,
  },
  tipsTitle: {
    fontSize: FontSize.md,
    fontWeight: '700',
    color: Colors.earth,
    marginBottom: Spacing.sm,
  },
  tipItem: {
    fontSize: FontSize.sm,
    color: Colors.textSecondary,
    marginBottom: 4,
    lineHeight: 20,
  },
  summaryCard: {
    backgroundColor: '#F0F8F0',
    borderRadius: BorderRadius.lg,
    padding: Spacing.md,
    marginBottom: Spacing.sm,
    borderWidth: 1,
    borderColor: Colors.primary + '30',
  },
  summaryText: {
    fontSize: FontSize.md,
    color: Colors.textPrimary,
    lineHeight: 26,
  },
  playAgainBtn: {
    marginTop: Spacing.sm,
    alignSelf: 'flex-start',
    backgroundColor: Colors.primarySoft,
    paddingVertical: 6,
    paddingHorizontal: Spacing.md,
    borderRadius: BorderRadius.full,
  },
  playAgainText: {
    fontSize: FontSize.sm,
    color: Colors.primary,
    fontWeight: '600',
  },
});
