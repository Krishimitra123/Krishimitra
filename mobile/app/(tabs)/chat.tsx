/**
 * Chat Screen — Conversation interface with message list, mic + text input bar.
 * Shows chat bubbles with source citations and audio playback.
 */

import React, { useState, useCallback, useRef, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TextInput,
  TouchableOpacity,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  Alert,
} from 'react-native';
import { NivettiHeader } from '@/components/NivettiHeader';
import { ChatBubble } from '@/components/ChatBubble';
import { MicButton } from '@/components/MicButton';
import { Colors, FontSize, Spacing, BorderRadius, Shadows } from '@/constants/theme';
import { useSessionStore, Message } from '@/stores/useSessionStore';
import { useAudioStore } from '@/stores/useAudioStore';
import { startRecording, stopRecordingAndGetBase64, playBase64Audio } from '@/services/voiceService';
import { sendVoiceQuery, sendTextQuery } from '@/services/queryService';

export default function ChatScreen() {
  const [textInput, setTextInput] = useState('');
  const flatListRef = useRef<FlatList>(null);

  const {
    currentSession,
    addMessage,
    startNewSession,
    isLoading,
    setLoading,
    setError,
  } = useSessionStore();

  const audioStore = useAudioStore();

  // Auto-scroll to bottom on new messages
  useEffect(() => {
    if (currentSession?.messages.length) {
      setTimeout(() => {
        flatListRef.current?.scrollToEnd({ animated: true });
      }, 200);
    }
  }, [currentSession?.messages.length]);

  // Ensure session exists
  useEffect(() => {
    if (!currentSession) {
      startNewSession();
    }
  }, []);

  // ── Voice Handler ────────────────────────────────────────────
  const handleMicPress = useCallback(async () => {
    try {
      if (audioStore.state === 'IDLE' || audioStore.state === 'ERROR') {
        audioStore.setState('RECORDING');
        await startRecording();
      } else if (audioStore.state === 'RECORDING') {
        audioStore.setState('STT_PROCESSING');

        let audioBase64: string;
        try {
          audioBase64 = await stopRecordingAndGetBase64();
        } catch (recErr: any) {
          console.error('[Chat] Recording stop failed:', recErr.message);
          audioStore.setState('IDLE');
          setLoading(false);
          Alert.alert('ರೆಕಾರ್ಡಿಂಗ್ ದೋಷ', 'ಧ್ವನಿ ರೆಕಾರ್ಡ್ ಆಗಲಿಲ್ಲ. ಮತ್ತೊಮ್ಮೆ ಪ್ರಯತ್ನಿಸಿ.');
          return;
        }

        if (!audioBase64 || audioBase64.length < 100) {
          console.warn('[Chat] Audio too short, discarding');
          audioStore.setState('IDLE');
          Alert.alert('ಧ್ವನಿ ತುಂಬಾ ಚಿಕ್ಕದು', 'ದಯವಿಟ್ಟು ಹೆಚ್ಚು ಸಮಯ ಮಾತನಾಡಿ.');
          return;
        }

        console.log(`[Chat] Audio recorded, base64 length: ${audioBase64.length}`);

        addMessage({
          id: Date.now().toString(),
          role: 'user',
          text: '🎙️ ಧ್ವನಿ ಸಂದೇಶ...',
          sources: [],
          timestamp: Date.now(),
          is_diagnosis: false,
        });

        setLoading(true);
        try {
          const response = await sendVoiceQuery(audioBase64);
          console.log('[Chat] Voice response received:', response.transcript?.slice(0, 50));

          addMessage({
            id: (Date.now() + 1).toString(),
            role: 'assistant',
            text: response.answer_text_kn,
            sources: response.sources || [],
            timestamp: Date.now(),
            is_diagnosis: !!response.diagnosis,
            audio_base64: response.audio_base64 || undefined,
          });

          // Auto-play TTS response if available
          if (response.audio_base64) {
            try {
              await playBase64Audio(response.audio_base64);
            } catch {
              // Non-fatal: text response still shown
            }
          }
        } catch (e: any) {
          console.error('[Chat] Voice query error:', e.message, e.response?.data);
          const errorMsg = e.response?.data?.answer_text_kn
            || 'ಸೇವೆ ಲಭ್ಯವಿಲ್ಲ. ದಯವಿಟ್ಟು ಮತ್ತೊಮ್ಮೆ ಪ್ರಯತ್ನಿಸಿ.';
          addMessage({
            id: (Date.now() + 1).toString(),
            role: 'assistant',
            text: errorMsg,
            sources: [],
            timestamp: Date.now(),
            is_diagnosis: false,
          });
        }
        setLoading(false);
        audioStore.setState('IDLE');
      }
    } catch (err: any) {
      console.error('[Chat] Mic handler error:', err.message);
      audioStore.setError(err.message);
      setLoading(false);
    }
  }, [audioStore.state]);

  // ── Text Handler ─────────────────────────────────────────────
  const handleTextSubmit = useCallback(async () => {
    if (!textInput.trim() || isLoading) return;

    const query = textInput.trim();
    setTextInput('');

    addMessage({
      id: Date.now().toString(),
      role: 'user',
      text: query,
      sources: [],
      timestamp: Date.now(),
      is_diagnosis: false,
    });

    setLoading(true);
    try {
      const response = await sendTextQuery(query);
      console.log('[Chat] Text response received');

      addMessage({
        id: (Date.now() + 1).toString(),
        role: 'assistant',
        text: response.answer_text_kn,
        sources: response.sources || [],
        timestamp: Date.now(),
        is_diagnosis: !!response.diagnosis,
        audio_base64: response.audio_base64 || undefined,
      });

      // Auto-play TTS response
      if (response.audio_base64) {
        try {
          await playBase64Audio(response.audio_base64);
        } catch {
          // Non-fatal: text response still shown
        }
      }
    } catch (e: any) {
      console.error('[Chat] Text query error:', e.message, e.response?.data);
      const errorMsg = e.response?.data?.answer_text_kn
        || 'ಸೇವೆ ಲಭ್ಯವಿಲ್ಲ. ದಯವಿಟ್ಟು ಮತ್ತೊಮ್ಮೆ ಪ್ರಯತ್ನಿಸಿ.';
      addMessage({
        id: (Date.now() + 1).toString(),
        role: 'assistant',
        text: errorMsg,
        sources: [],
        timestamp: Date.now(),
        is_diagnosis: false,
      });
    }
    setLoading(false);
  }, [textInput, isLoading]);

  // ── Audio Playback ────────────────────────────────────────────
  const handlePlayAudio = useCallback(async (audioB64: string) => {
    try {
      audioStore.setState('PLAYING');
      await playBase64Audio(audioB64);
      audioStore.setState('IDLE');
    } catch (err) {
      audioStore.setState('IDLE');
    }
  }, []);

  const messages = currentSession?.messages || [];

  // ── Empty State ───────────────────────────────────────────────
  const renderEmptyChat = () => (
    <View style={styles.emptyContainer}>
      <Text style={styles.emptyIcon}>🌿</Text>
      <Text style={styles.emptyTitle}>KrishiMitra</Text>
      <Text style={styles.emptySubtitle}>
        ನಿಮ್ಮ ಜೈವಿಕ ಕೃಷಿ ಪ್ರಶ್ನೆಗಳನ್ನು ಕೇಳಿ
      </Text>
      <View style={styles.emptySuggestions}>
        {[
          'ಜೀವಾಮೃತ ತಯಾರಿಸುವ ವಿಧಾನ',
          'ರಾಗಿ ಬೆಳೆಗೆ ಮಣ್ಣು ಪರೀಕ್ಷೆ',
          'ಟೊಮ್ಯಾಟೊ ಎಲೆ ಹಳದಿ ಕಾರಣ',
        ].map((suggestion, i) => (
          <TouchableOpacity
            key={i}
            style={styles.suggestionBtn}
            onPress={() => setTextInput(suggestion)}
          >
            <Text style={styles.suggestionText}>{suggestion}</Text>
          </TouchableOpacity>
        ))}
      </View>
    </View>
  );

  return (
    <View style={styles.container}>
      <NivettiHeader title="KrishiMitra Chat" />

      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        style={styles.flex}
        keyboardVerticalOffset={0}
      >
        {/* Messages */}
        <FlatList
          ref={flatListRef}
          data={messages}
          keyExtractor={(item) => item.id}
          renderItem={({ item }) => (
            <ChatBubble
              message={item}
              onPlayAudio={item.audio_base64 ? handlePlayAudio : undefined}
            />
          )}
          contentContainerStyle={[
            styles.messageList,
            messages.length === 0 && styles.emptyList,
          ]}
          ListEmptyComponent={renderEmptyChat}
          showsVerticalScrollIndicator={false}
        />

        {/* Loading Indicator */}
        {isLoading && (
          <View style={styles.loadingRow}>
            <View style={styles.loadingBubble}>
              <ActivityIndicator size="small" color={Colors.primary} />
              <Text style={styles.loadingText}>ಯೋಚಿಸುತ್ತಿದೆ...</Text>
            </View>
          </View>
        )}

        {/* Input Bar */}
        <View style={[styles.inputBar, Shadows.md]}>
          <View style={styles.micSmall}>
            <MicButton onPress={handleMicPress} size={44} />
          </View>
          <TextInput
            style={styles.textInput}
            placeholder="ಟೈಪ್ ಮಾಡಿ..."
            placeholderTextColor={Colors.textMuted}
            value={textInput}
            onChangeText={setTextInput}
            onSubmitEditing={handleTextSubmit}
            returnKeyType="send"
            multiline={false}
          />
          <TouchableOpacity
            onPress={handleTextSubmit}
            disabled={!textInput.trim() || isLoading}
            style={[
              styles.sendBtn,
              (!textInput.trim() || isLoading) && styles.sendBtnDisabled,
            ]}
          >
            <Text style={styles.sendBtnText}>→</Text>
          </TouchableOpacity>
        </View>
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
  messageList: {
    paddingVertical: Spacing.md,
    paddingBottom: Spacing.lg,
  },
  emptyList: {
    flex: 1,
  },
  emptyContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: Spacing.xl,
  },
  emptyIcon: {
    fontSize: 56,
    marginBottom: Spacing.md,
  },
  emptyTitle: {
    fontSize: FontSize.xxl,
    fontWeight: '800',
    color: Colors.primary,
    marginBottom: Spacing.xs,
  },
  emptySubtitle: {
    fontSize: FontSize.md,
    color: Colors.textSecondary,
    textAlign: 'center',
    marginBottom: Spacing.lg,
  },
  emptySuggestions: {
    gap: Spacing.sm,
    width: '100%',
  },
  suggestionBtn: {
    backgroundColor: Colors.primarySoft,
    padding: Spacing.md,
    borderRadius: BorderRadius.full,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: Colors.primary + '30',
  },
  suggestionText: {
    fontSize: FontSize.md,
    color: Colors.primary,
    fontWeight: '600',
  },
  loadingRow: {
    paddingHorizontal: Spacing.md,
    paddingBottom: Spacing.sm,
  },
  loadingBubble: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.aiBubble,
    padding: Spacing.md,
    borderRadius: BorderRadius.lg,
    alignSelf: 'flex-start',
    gap: Spacing.sm,
  },
  loadingText: {
    fontSize: FontSize.sm,
    color: Colors.textMuted,
  },
  inputBar: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: Spacing.sm,
    paddingBottom: Platform.OS === 'ios' ? Spacing.lg : Spacing.sm,
    backgroundColor: Colors.surface,
    borderTopWidth: 1,
    borderTopColor: Colors.border,
    gap: Spacing.sm,
  },
  micSmall: {
    marginLeft: 4,
  },
  textInput: {
    flex: 1,
    fontSize: FontSize.md,
    color: Colors.textPrimary,
    backgroundColor: Colors.background,
    borderRadius: BorderRadius.full,
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
    borderWidth: 1,
    borderColor: Colors.border,
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
    fontSize: FontSize.lg,
    color: Colors.textOnPrimary,
    fontWeight: '700',
  },
});
