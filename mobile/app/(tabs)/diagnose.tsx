/**
 * Diagnose Screen — Voice-first crop disease detection.
 * Take photo → AI analyzes → speaks the result. Minimal text.
 */

import React, { useState, useCallback } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity,
  Image, TextInput, ActivityIndicator, Alert,
} from 'react-native';
import { NivettiHeader } from '@/components/NivettiHeader';
import { Colors, FontSize, Spacing, BorderRadius, Shadows } from '@/constants/theme';
import { captureImageWithUri, pickImageWithUri } from '@/services/diagnosisService';
import { sendDiagnosis } from '@/services/queryService';
import { playBase64Audio, stopPlayback } from '@/services/voiceService';
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

  const handleCamera = useCallback(async () => {
    try {
      const img = await captureImageWithUri();
      if (img) { setImageUri(img.uri); setImageBase64(img.base64); setImageMimeType(img.mimeType); setResult(null); setAnswerAudio(null); }
    } catch (err: any) { Alert.alert('ದೋಷ', err.message); }
  }, []);

  const handleGallery = useCallback(async () => {
    try {
      const img = await pickImageWithUri();
      if (img) { setImageUri(img.uri); setImageBase64(img.base64); setImageMimeType(img.mimeType); setResult(null); setAnswerAudio(null); }
    } catch (err: any) { Alert.alert('ದೋಷ', err.message); }
  }, []);

  const handleDiagnose = useCallback(async () => {
    if (!imageBase64) { Alert.alert('', 'ಮೊದಲು ಫೋಟೋ ತೆಗೆಯಿರಿ'); return; }

    setIsAnalyzing(true); setResult(null); setAnswerAudio(null);

    try {
      const finding = await sendDiagnosis(imageBase64, imageMimeType, description || undefined);
      setResult(finding);

      // Auto-play the voice result
      if ((finding as any).audio_base64) {
        const audioB64 = (finding as any).audio_base64;
        setAnswerAudio(audioB64);
        try {
          audioStore.setState('PLAYING');
          await playBase64Audio(audioB64);
        } catch {} finally { audioStore.setState('IDLE'); }
      }
    } catch (err: any) {
      Alert.alert('ದೋಷ', err.response?.data?.detail || 'ಮತ್ತೊಮ್ಮೆ ಪ್ರಯತ್ನಿಸಿ');
    }
    setIsAnalyzing(false);
  }, [imageBase64, imageMimeType, description]);

  const handlePlayAudio = useCallback(async () => {
    if (answerAudio) {
      try { audioStore.setState('PLAYING'); await playBase64Audio(answerAudio); }
      catch {} finally { audioStore.setState('IDLE'); }
    }
  }, [answerAudio]);

  const handleStopAudio = useCallback(async () => {
    await stopPlayback(); audioStore.setState('IDLE');
  }, []);

  const handleClear = () => {
    setImageUri(null); setImageBase64(null); setDescription(''); setResult(null); setAnswerAudio(null);
  };

  const isPlaying = audioStore.state === 'PLAYING';

  return (
    <View style={styles.container}>
      <NivettiHeader title="📸 ರೋಗ ಪತ್ತೆ" />

      <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
        {/* Image Zone */}
        <TouchableOpacity style={[styles.imageZone, imageUri && styles.imageZoneActive]} onPress={handleCamera} activeOpacity={0.8}>
          {imageUri ? (
            <Image source={{ uri: imageUri }} style={styles.preview} />
          ) : (
            <View style={styles.placeholder}>
              <Text style={styles.camIcon}>📸</Text>
              <Text style={styles.camText}>ಫೋಟೋ ತೆಗೆಯಿರಿ</Text>
            </View>
          )}
        </TouchableOpacity>

        {/* Action Buttons */}
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
        <TextInput
          style={styles.descInput}
          placeholder="ಹೆಚ್ಚಿನ ವಿವರ (ಐಚ್ಛಿಕ)..."
          placeholderTextColor={Colors.textMuted}
          value={description} onChangeText={setDescription}
          multiline numberOfLines={1}
        />

        {/* Diagnose Button */}
        <TouchableOpacity
          style={[styles.diagnoseBtn, (!imageBase64 || isAnalyzing) && styles.diagnoseBtnOff]}
          onPress={handleDiagnose} disabled={!imageBase64 || isAnalyzing} activeOpacity={0.7}
        >
          {isAnalyzing ? (
            <View style={styles.loadRow}>
              <ActivityIndicator size="small" color="#fff" />
              <Text style={styles.diagnoseTxt}>ವಿಶ್ಲೇಷಿಸಲಾಗುತ್ತಿದೆ...</Text>
            </View>
          ) : (
            <Text style={styles.diagnoseTxt}>🔍 ರೋಗ ಪತ್ತೆ</Text>
          )}
        </TouchableOpacity>

        {/* RESULT — Voice-first, minimal text */}
        {result && (
          <View style={[styles.resultCard, Shadows.sm]}>
            {/* Status badge */}
            <View style={[styles.statusBadge, result.is_reliable ? styles.badgeGreen : styles.badgeOrange]}>
              <Text style={styles.statusIcon}>{result.is_reliable ? '✅' : '⚠️'}</Text>
              <Text style={styles.statusText}>
                {result.disease_name_kn || result.disease_name || 'ಫಲಿತಾಂಶ'}
              </Text>
            </View>

            {/* Confidence */}
            {result.confidence_pct > 0 && (
              <Text style={styles.confidence}>{result.confidence_pct}% ವಿಶ್ವಾಸ</Text>
            )}

            {/* Play / Stop Audio — PRIMARY action */}
            {answerAudio && (
              <TouchableOpacity
                style={[styles.playBtn, isPlaying && styles.playBtnStop]}
                onPress={isPlaying ? handleStopAudio : handlePlayAudio}
              >
                <Text style={styles.playIcon}>{isPlaying ? '⏹' : '🔊'}</Text>
                <Text style={styles.playTxt}>
                  {isPlaying ? 'ನಿಲ್ಲಿಸಿ' : 'ಉತ್ತರ ಕೇಳಿ'}
                </Text>
              </TouchableOpacity>
            )}

            {/* Collapsed text — only shows if no audio */}
            {!answerAudio && result.summary_kn && (
              <Text style={styles.summaryTxt}>{result.summary_kn}</Text>
            )}
          </View>
        )}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background },
  scroll: { padding: Spacing.md, paddingBottom: Spacing.xxl },
  imageZone: { height: 200, borderRadius: BorderRadius.lg, borderWidth: 2, borderColor: Colors.primary, borderStyle: 'dashed', overflow: 'hidden', marginBottom: Spacing.md },
  imageZoneActive: { borderStyle: 'solid' },
  placeholder: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: Colors.primarySoft },
  camIcon: { fontSize: 48, marginBottom: Spacing.xs },
  camText: { fontSize: FontSize.md, color: Colors.primary, fontWeight: '600' },
  preview: { width: '100%', height: '100%', resizeMode: 'cover' },
  actionRow: { flexDirection: 'row', gap: Spacing.sm, marginBottom: Spacing.md },
  actionBtn: { flex: 1, backgroundColor: Colors.surface, borderRadius: BorderRadius.md, padding: Spacing.sm, alignItems: 'center', borderWidth: 1, borderColor: Colors.border },
  clearBtn: { borderColor: Colors.error + '40', backgroundColor: '#FFF5F5' },
  actionIcon: { fontSize: 24, marginBottom: 2 },
  actionLabel: { fontSize: FontSize.xs, color: Colors.textSecondary, fontWeight: '600' },
  descInput: { backgroundColor: Colors.surface, borderRadius: BorderRadius.md, padding: Spacing.md, fontSize: FontSize.md, color: Colors.textPrimary, borderWidth: 1, borderColor: Colors.border, marginBottom: Spacing.md, minHeight: 44 },
  diagnoseBtn: { backgroundColor: Colors.primary, borderRadius: BorderRadius.full, paddingVertical: Spacing.md, alignItems: 'center', marginBottom: Spacing.lg },
  diagnoseBtnOff: { backgroundColor: Colors.disabled },
  diagnoseTxt: { fontSize: FontSize.lg, color: '#fff', fontWeight: '700' },
  loadRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm },
  // Result
  resultCard: { backgroundColor: Colors.surface, borderRadius: BorderRadius.lg, padding: Spacing.lg, borderWidth: 1, borderColor: Colors.primary + '30' },
  statusBadge: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm, paddingVertical: Spacing.sm, paddingHorizontal: Spacing.md, borderRadius: BorderRadius.full, alignSelf: 'flex-start', marginBottom: Spacing.md },
  badgeGreen: { backgroundColor: '#E8F5E9' },
  badgeOrange: { backgroundColor: '#FFF3E0' },
  statusIcon: { fontSize: 20 },
  statusText: { fontSize: FontSize.lg, fontWeight: '700', color: Colors.textPrimary },
  confidence: { fontSize: FontSize.sm, color: Colors.textMuted, marginBottom: Spacing.md },
  playBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: Spacing.sm, backgroundColor: Colors.primary, borderRadius: BorderRadius.full, paddingVertical: Spacing.md, paddingHorizontal: Spacing.xl },
  playBtnStop: { backgroundColor: '#E65100' },
  playIcon: { fontSize: 24 },
  playTxt: { fontSize: FontSize.lg, color: '#fff', fontWeight: '700' },
  summaryTxt: { fontSize: FontSize.md, color: Colors.textPrimary, lineHeight: 24, marginTop: Spacing.sm },
});
