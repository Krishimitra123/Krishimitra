/**
 * Home Screen — Primary landing screen for KrishiMitra.
 * Shows: farmer context card, mic button (primary CTA), text input fallback,
 * quick action buttons, and last session preview.
 */

import React, { useState, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TextInput,
  TouchableOpacity,
  Alert,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { useRouter } from 'expo-router';
import { LinearGradient } from 'expo-linear-gradient';
import { NivettiHeader } from '@/components/NivettiHeader';
import { MicButton } from '@/components/MicButton';
import { Colors, FontSize, Spacing, BorderRadius, Shadows } from '@/constants/theme';
import { useUserStore } from '@/stores/useUserStore';
import { useSessionStore } from '@/stores/useSessionStore';
import { useAudioStore } from '@/stores/useAudioStore';
import { startRecording, stopRecordingAndGetBase64 } from '@/services/voiceService';
import { sendVoiceQuery, sendTextQuery } from '@/services/queryService';

export default function HomeScreen() {
  const router = useRouter();
  const [textInput, setTextInput] = useState('');
  const [isSending, setIsSending] = useState(false);

  const { farmer_name, district, primary_crop } = useUserStore();
  const { startNewSession, addMessage, currentSession, pastSessions } = useSessionStore();
  const audioStore = useAudioStore();

  // ── Voice Recording Handler ─────────────────────────────────
  const handleMicPress = useCallback(async () => {
    try {
      if (audioStore.state === 'IDLE' || audioStore.state === 'ERROR') {
        audioStore.setState('RECORDING');
        await startRecording();
      } else if (audioStore.state === 'RECORDING') {
        audioStore.setState('STT_PROCESSING');
        const audioBase64 = await stopRecordingAndGetBase64();

        // Start new session and navigate to chat
        if (!currentSession) startNewSession();

        addMessage({
          id: Date.now().toString(),
          role: 'user',
          text: '🎙️ ಧ್ವನಿ ಸಂದೇಶ...',
          sources: [],
          timestamp: Date.now(),
          is_diagnosis: false,
        });

        router.push('/chat');

        // Send to backend
        try {
          const response = await sendVoiceQuery(audioBase64);
          audioStore.setTranscript(response.transcript || '');

          addMessage({
            id: (Date.now() + 1).toString(),
            role: 'assistant',
            text: response.answer_text_kn,
            sources: response.sources || [],
            timestamp: Date.now(),
            is_diagnosis: false,
            audio_base64: response.audio_base64 || undefined,
          });
        } catch (e: any) {
          addMessage({
            id: (Date.now() + 1).toString(),
            role: 'assistant',
            text: 'ಸೇವೆ ಲಭ್ಯವಿಲ್ಲ. ದಯವಿಟ್ಟು ಮತ್ತೊಮ್ಮೆ ಪ್ರಯತ್ನಿಸಿ.',
            sources: [],
            timestamp: Date.now(),
            is_diagnosis: false,
          });
        }
        audioStore.setState('IDLE');
      }
    } catch (err: any) {
      audioStore.setError(err.message || 'Recording failed');
      Alert.alert('Error', err.message || 'Could not record audio');
    }
  }, [audioStore.state, currentSession]);

  // ── Text Query Handler ──────────────────────────────────────
  const handleTextSubmit = useCallback(async () => {
    if (!textInput.trim() || isSending) return;
    setIsSending(true);

    const query = textInput.trim();
    setTextInput('');

    if (!currentSession) startNewSession();

    addMessage({
      id: Date.now().toString(),
      role: 'user',
      text: query,
      sources: [],
      timestamp: Date.now(),
      is_diagnosis: false,
    });

    router.push('/chat');

    try {
      const response = await sendTextQuery(query);
      addMessage({
        id: (Date.now() + 1).toString(),
        role: 'assistant',
        text: response.answer_text_kn,
        sources: response.sources || [],
        timestamp: Date.now(),
        is_diagnosis: false,
        audio_base64: response.audio_base64 || undefined,
      });
    } catch (e) {
      addMessage({
        id: (Date.now() + 1).toString(),
        role: 'assistant',
        text: 'ಸೇವೆ ಲಭ್ಯವಿಲ್ಲ. ದಯವಿಟ್ಟು ಮತ್ತೊಮ್ಮೆ ಪ್ರಯತ್ನಿಸಿ.',
        sources: [],
        timestamp: Date.now(),
        is_diagnosis: false,
      });
    }
    setIsSending(false);
  }, [textInput, isSending, currentSession]);

  // ── Quick Actions ───────────────────────────────────────────
  const quickActions = [
    { icon: '📸', label: 'ಬೆಳೆ ರೋಗ ಪತ್ತೆ', route: '/diagnose' },
    { icon: '🌱', label: 'ಜೀವಾಮೃತ', query: 'ಜೀವಾಮೃತ ತಯಾಯಿಸುವ ವಿಧಾನ' },
    { icon: '🪱', label: 'ಮಣ್ಣು', query: 'ಮಣ್ಣಿನ ಫಲವತ್ತತೆ ಹೆಚ್ಚಿಸುವ ವಿಧಾನ' },
  ];

  const lastSession = pastSessions[0];

  return (
    <View style={styles.container}>
      <NivettiHeader />

      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        style={styles.flex}
      >
        <ScrollView
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
        >
          {/* Hero Section */}
          <LinearGradient
            colors={[Colors.primarySoft, Colors.background]}
            style={styles.heroSection}
          >
            <Text style={styles.heroTagline}>
              ಕೃಷಿ ಮಿತ್ರ — ನಿಮ್ಮ ಜೈವಿಕ ಕೃಷಿ ಸಹಾಯಕ
            </Text>
            <Text style={styles.heroSubtext}>
              ಮಾತನಾಡಿ ಅಥವಾ ಟೈಪ್ ಮಾಡಿ, ನಾವು ಸಹಾಯ ಮಾಡುತ್ತೇವೆ
            </Text>
          </LinearGradient>

          {/* Farmer Context Card */}
          <View style={[styles.contextCard, Shadows.sm]}>
            <Text style={styles.contextIcon}>🧑‍🌾</Text>
            <View style={styles.contextInfo}>
              <Text style={styles.contextName}>{farmer_name || 'ರೈತ'}</Text>
              <Text style={styles.contextDetail}>
                {district || 'ಕರ್ನಾಟಕ'} • {primary_crop || 'ಬೆಳೆ'}
              </Text>
            </View>
            <TouchableOpacity
              onPress={() => router.push('/onboarding')}
              style={styles.editBtn}
            >
              <Text style={styles.editBtnText}>✏️</Text>
            </TouchableOpacity>
          </View>

          {/* Mic Button — Primary CTA */}
          <View style={styles.micSection}>
            <MicButton onPress={handleMicPress} size={80} />
          </View>

          {/* Divider */}
          <View style={styles.dividerRow}>
            <View style={styles.dividerLine} />
            <Text style={styles.dividerText}>ಅಥವಾ ಟೈಪ್ ಮಾಡಿ</Text>
            <View style={styles.dividerLine} />
          </View>

          {/* Text Input */}
          <View style={styles.inputRow}>
            <TextInput
              style={styles.textInput}
              placeholder="ಪ್ರಶ್ನೆ ಟೈಪ್ ಮಾಡಿ..."
              placeholderTextColor={Colors.textMuted}
              value={textInput}
              onChangeText={setTextInput}
              onSubmitEditing={handleTextSubmit}
              returnKeyType="send"
              multiline={false}
            />
            <TouchableOpacity
              onPress={handleTextSubmit}
              style={[styles.sendBtn, (!textInput.trim() || isSending) && styles.sendBtnDisabled]}
              disabled={!textInput.trim() || isSending}
            >
              <Text style={styles.sendBtnText}>→</Text>
            </TouchableOpacity>
          </View>

          {/* Quick Actions */}
          <Text style={styles.sectionTitle}>ತ್ವರಿತ ಕ್ರಿಯೆಗಳು</Text>
          <View style={styles.quickActions}>
            {quickActions.map((action, i) => (
              <TouchableOpacity
                key={i}
                style={[styles.quickActionBtn, Shadows.sm]}
                onPress={() => {
                  if (action.route) {
                    router.push(action.route as any);
                  } else if (action.query) {
                    setTextInput(action.query);
                  }
                }}
              >
                <Text style={styles.quickActionIcon}>{action.icon}</Text>
                <Text style={styles.quickActionLabel}>{action.label}</Text>
              </TouchableOpacity>
            ))}
          </View>

          {/* Last Session Preview */}
          {lastSession && (
            <>
              <Text style={styles.sectionTitle}>ಇತ್ತೀಚಿನ ಪ್ರಶ್ನೆ</Text>
              <TouchableOpacity
                style={[styles.sessionPreview, Shadows.sm]}
                onPress={() => router.push('/history')}
              >
                <Text style={styles.sessionTitle} numberOfLines={1}>
                  💬 {lastSession.title || 'ಹಿಂದಿನ ಸಂಭಾಷಣೆ'}
                </Text>
                <Text style={styles.sessionMeta}>
                  {lastSession.messages.length} ಸಂದೇಶಗಳು •{' '}
                  {new Date(lastSession.started_at).toLocaleDateString('kn-IN')}
                </Text>
              </TouchableOpacity>
            </>
          )}

          {/* Footer */}
          <View style={styles.footer}>
            <Text style={styles.footerText}>
              ⚡ Powered by Nivetti Systems
            </Text>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  flex: {
    flex: 1,
  },
  scrollContent: {
    paddingBottom: Spacing.xxl,
  },
  heroSection: {
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.xl,
    alignItems: 'center',
  },
  heroTagline: {
    fontSize: FontSize.xl,
    fontWeight: '800',
    color: Colors.primaryDark,
    textAlign: 'center',
    letterSpacing: 0.5,
  },
  heroSubtext: {
    fontSize: FontSize.md,
    color: Colors.textSecondary,
    marginTop: Spacing.xs,
    textAlign: 'center',
  },
  contextCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.surface,
    marginHorizontal: Spacing.md,
    padding: Spacing.md,
    borderRadius: BorderRadius.lg,
    borderLeftWidth: 4,
    borderLeftColor: Colors.primary,
  },
  contextIcon: {
    fontSize: 28,
    marginRight: Spacing.sm,
  },
  contextInfo: {
    flex: 1,
  },
  contextName: {
    fontSize: FontSize.lg,
    fontWeight: '700',
    color: Colors.textPrimary,
  },
  contextDetail: {
    fontSize: FontSize.sm,
    color: Colors.textSecondary,
    marginTop: 2,
  },
  editBtn: {
    padding: Spacing.sm,
  },
  editBtnText: {
    fontSize: 18,
  },
  micSection: {
    alignItems: 'center',
    paddingVertical: Spacing.xl,
  },
  dividerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: Spacing.xl,
    marginBottom: Spacing.md,
  },
  dividerLine: {
    flex: 1,
    height: 1,
    backgroundColor: Colors.border,
  },
  dividerText: {
    fontSize: FontSize.sm,
    color: Colors.textMuted,
    marginHorizontal: Spacing.md,
  },
  inputRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginHorizontal: Spacing.md,
    backgroundColor: Colors.surface,
    borderRadius: BorderRadius.full,
    borderWidth: 1,
    borderColor: Colors.border,
    paddingHorizontal: Spacing.md,
    marginBottom: Spacing.lg,
  },
  textInput: {
    flex: 1,
    fontSize: FontSize.md,
    color: Colors.textPrimary,
    paddingVertical: Spacing.md,
  },
  sendBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: Colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  sendBtnDisabled: {
    backgroundColor: Colors.disabled,
  },
  sendBtnText: {
    fontSize: FontSize.xl,
    color: Colors.textOnPrimary,
    fontWeight: '700',
  },
  sectionTitle: {
    fontSize: FontSize.md,
    fontWeight: '700',
    color: Colors.textSecondary,
    marginHorizontal: Spacing.md,
    marginBottom: Spacing.sm,
    marginTop: Spacing.sm,
  },
  quickActions: {
    flexDirection: 'row',
    paddingHorizontal: Spacing.md,
    gap: Spacing.sm,
    marginBottom: Spacing.lg,
  },
  quickActionBtn: {
    flex: 1,
    backgroundColor: Colors.surface,
    borderRadius: BorderRadius.md,
    padding: Spacing.md,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: Colors.border,
  },
  quickActionIcon: {
    fontSize: 24,
    marginBottom: 4,
  },
  quickActionLabel: {
    fontSize: FontSize.xs,
    color: Colors.textSecondary,
    textAlign: 'center',
    fontWeight: '600',
  },
  sessionPreview: {
    backgroundColor: Colors.surface,
    marginHorizontal: Spacing.md,
    padding: Spacing.md,
    borderRadius: BorderRadius.md,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  sessionTitle: {
    fontSize: FontSize.md,
    color: Colors.textPrimary,
    fontWeight: '600',
  },
  sessionMeta: {
    fontSize: FontSize.sm,
    color: Colors.textMuted,
    marginTop: 4,
  },
  footer: {
    alignItems: 'center',
    paddingVertical: Spacing.xl,
    marginTop: Spacing.lg,
  },
  footerText: {
    fontSize: FontSize.xs,
    color: Colors.textMuted,
  },
});
