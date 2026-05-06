/**
 * Chat Screen — VOICE-FIRST design.
 * Big mic button center stage. Minimal text. Auto-plays audio responses.
 * Farmers tap mic → speak → hear answer. Text is secondary.
 */

import React, { useState, useCallback, useRef, useEffect } from 'react';
import {
  View, Text, StyleSheet, FlatList, TextInput, TouchableOpacity,
  ActivityIndicator, KeyboardAvoidingView, Platform, Alert, Animated,
} from 'react-native';
import { NivettiHeader } from '@/components/NivettiHeader';
import { Colors, FontSize, Spacing, BorderRadius, Shadows } from '@/constants/theme';
import { useSessionStore, Message } from '@/stores/useSessionStore';
import { useAudioStore } from '@/stores/useAudioStore';
import { useUserStore } from '@/stores/useUserStore';
import { startRecording, stopRecordingAndGetBase64, playBase64Audio, speakText, stopPlayback } from '@/services/voiceService';
import { sendVoiceQuery, sendTextQuery, ConversationTurn } from '@/services/queryService';

export default function ChatScreen() {
  const [textInput, setTextInput] = useState('');
  const [conversationHistory, setConversationHistory] = useState<ConversationTurn[]>([]);
  const [recordingSeconds, setRecordingSeconds] = useState(0);
  const [showTextInput, setShowTextInput] = useState(false);
  const recordingTimer = useRef<ReturnType<typeof setInterval> | null>(null);
  const pulseAnim = useRef(new Animated.Value(1)).current;
  const scaleAnim = useRef(new Animated.Value(1)).current;
  const flatListRef = useRef<FlatList>(null);

  const { currentSession, addMessage, updateMessage, startNewSession, isLoading, setLoading } = useSessionStore();
  const audioStore = useAudioStore();
  const farmerName = useUserStore((s) => s.farmer_name) || 'ರೈತರೇ';

  useEffect(() => {
    if (currentSession?.messages.length) {
      setTimeout(() => flatListRef.current?.scrollToEnd({ animated: true }), 200);
    }
  }, [currentSession?.messages.length]);

  useEffect(() => {
    if (!currentSession) startNewSession();
  }, []);

  // Recording timer + pulse
  useEffect(() => {
    if (audioStore.state === 'RECORDING') {
      setRecordingSeconds(0);
      recordingTimer.current = setInterval(() => setRecordingSeconds(s => s + 1), 1000);
      const pulse = Animated.loop(
        Animated.sequence([
          Animated.timing(pulseAnim, { toValue: 0.3, duration: 600, useNativeDriver: true }),
          Animated.timing(pulseAnim, { toValue: 1, duration: 600, useNativeDriver: true }),
        ])
      );
      pulse.start();
      return () => { pulse.stop(); pulseAnim.setValue(1); };
    } else {
      if (recordingTimer.current) { clearInterval(recordingTimer.current); recordingTimer.current = null; }
    }
  }, [audioStore.state]);

  const handleNewChat = useCallback(() => {
    stopPlayback(); audioStore.setState('IDLE');
    startNewSession(); setConversationHistory([]); setTextInput(''); setLoading(false);
  }, []);

  const handleStopPlayback = useCallback(async () => {
    await stopPlayback(); audioStore.setState('IDLE');
  }, []);

  // ── VOICE HANDLER — the primary interaction ─────────────────
  const handleMicPress = useCallback(async () => {
    try {
      if (audioStore.state === 'PLAYING') {
        await stopPlayback(); audioStore.setState('IDLE');
        await new Promise(r => setTimeout(r, 200));
      }

      if (audioStore.state === 'IDLE' || audioStore.state === 'ERROR') {
        // Animate mic press
        Animated.spring(scaleAnim, { toValue: 1.2, useNativeDriver: true }).start();
        audioStore.setState('RECORDING');
        await startRecording();
      } else if (audioStore.state === 'RECORDING') {
        Animated.spring(scaleAnim, { toValue: 1, useNativeDriver: true }).start();
        audioStore.setState('STT_PROCESSING');

        let audioResult: { base64: string; mimeType: string };
        try {
          audioResult = await stopRecordingAndGetBase64();
        } catch (recErr: any) {
          audioStore.setState('IDLE'); setLoading(false);
          Alert.alert('ದೋಷ', 'ಧ್ವನಿ ರೆಕಾರ್ಡ್ ಆಗಲಿಲ್ಲ. ಮತ್ತೆ ಪ್ರಯತ್ನಿಸಿ.');
          return;
        }

        if (!audioResult.base64 || audioResult.base64.length < 100) {
          audioStore.setState('IDLE');
          Alert.alert('', 'ಹೆಚ್ಚು ಸಮಯ ಮಾತನಾಡಿ'); return;
        }

        const userMsgId = Date.now().toString();
        addMessage({ id: userMsgId, role: 'user', text: '🎙️ ...', sources: [], timestamp: Date.now(), is_diagnosis: false });

        setLoading(true);
        try {
          const response = await sendVoiceQuery(audioResult.base64, audioResult.mimeType, conversationHistory);
          const transcript = response.transcript?.trim() || '🎙️ ಧ್ವನಿ';
          updateMessage(userMsgId, { text: transcript });

          addMessage({
            id: (Date.now() + 1).toString(), role: 'assistant',
            text: response.answer_text_kn, sources: response.sources || [],
            timestamp: Date.now(), is_diagnosis: false,
            audio_base64: response.audio_base64 || undefined,
          });

          setConversationHistory(prev => [
            ...prev,
            { role: 'user' as const, content: transcript },
            { role: 'assistant' as const, content: response.answer_text_kn },
          ].slice(-12));

          // AUTO-PLAY the response audio
          if (response.audio_base64) {
            try {
              audioStore.setState('PLAYING');
              await playBase64Audio(response.audio_base64);
            } catch {} finally { audioStore.setState('IDLE'); }
          } else {
            await speakText(response.answer_text_kn);
          }
        } catch (e: any) {
          const errorMsg = e.response?.data?.detail || e.response?.data?.answer_text_kn || 'ಸೇವೆ ಲಭ್ಯವಿಲ್ಲ';
          addMessage({ id: (Date.now() + 1).toString(), role: 'assistant', text: errorMsg, sources: [], timestamp: Date.now(), is_diagnosis: false });
        }
        setLoading(false); audioStore.setState('IDLE');
      }
    } catch (err: any) {
      audioStore.setError(err.message); setLoading(false);
    }
  }, [audioStore.state]);

  // ── TEXT HANDLER ─────────────────────────────────────────────
  const handleTextSubmit = useCallback(async () => {
    if (!textInput.trim() || isLoading) return;
    await stopPlayback(); audioStore.setState('IDLE');
    const query = textInput.trim(); setTextInput('');

    addMessage({ id: Date.now().toString(), role: 'user', text: query, sources: [], timestamp: Date.now(), is_diagnosis: false });
    setLoading(true);
    try {
      const response = await sendTextQuery(query, conversationHistory);
      addMessage({
        id: (Date.now() + 1).toString(), role: 'assistant',
        text: response.answer_text_kn, sources: response.sources || [],
        timestamp: Date.now(), is_diagnosis: false,
        audio_base64: response.audio_base64 || undefined,
      });
      setConversationHistory(prev => [
        ...prev,
        { role: 'user' as const, content: query },
        { role: 'assistant' as const, content: response.answer_text_kn },
      ].slice(-12));

      if (response.audio_base64) {
        try { audioStore.setState('PLAYING'); await playBase64Audio(response.audio_base64); }
        catch {} finally { audioStore.setState('IDLE'); }
      } else {
        await speakText(response.answer_text_kn);
      }
    } catch (e: any) {
      addMessage({ id: (Date.now() + 1).toString(), role: 'assistant', text: 'ಸೇವೆ ಲಭ್ಯವಿಲ್ಲ', sources: [], timestamp: Date.now(), is_diagnosis: false });
    }
    setLoading(false);
  }, [textInput, isLoading]);

  const handlePlayAudio = useCallback(async (audioB64: string) => {
    try { audioStore.setState('PLAYING'); await playBase64Audio(audioB64); audioStore.setState('IDLE'); }
    catch { audioStore.setState('IDLE'); }
  }, []);

  const messages = currentSession?.messages || [];

  // ── MINIMAL BUBBLE ─────────────────────────────────────────
  const renderMessage = ({ item }: { item: Message }) => {
    const isUser = item.role === 'user';
    return (
      <View style={[styles.bubble, isUser ? styles.userBubble : styles.aiBubble]}>
        <Text style={[styles.bubbleText, isUser && styles.userBubbleText]} numberOfLines={isUser ? 2 : undefined}>
          {item.text}
        </Text>
        {!isUser && item.audio_base64 && (
          <TouchableOpacity onPress={() => handlePlayAudio(item.audio_base64!)} style={styles.replayBtn}>
            <Text style={styles.replayTxt}>🔊 ಮತ್ತೆ ಕೇಳಿ</Text>
          </TouchableOpacity>
        )}
      </View>
    );
  };

  // ── EMPTY STATE — Voice First ──────────────────────────────
  const renderEmpty = () => (
    <View style={styles.emptyContainer}>
      <Text style={styles.emptyIcon}>🌾</Text>
      <Text style={styles.emptyGreeting}>ನಮಸ್ಕಾರ {farmerName}!</Text>
      <Text style={styles.emptyHint}>🎙️ ಮೈಕ್ ಒತ್ತಿ ಮಾತನಾಡಿ</Text>
    </View>
  );

  const isRecording = audioStore.state === 'RECORDING';
  const isProcessing = audioStore.state === 'STT_PROCESSING';
  const isPlayingAudio = audioStore.state === 'PLAYING';

  return (
    <View style={styles.container}>
      <NivettiHeader
        title="🌾 KrishiMitra"
        rightAction={
          <TouchableOpacity onPress={handleNewChat} style={styles.newChatBtn}>
            <Text style={styles.newChatText}>+ ಹೊಸದು</Text>
          </TouchableOpacity>
        }
      />

      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={styles.flex}>
        <FlatList
          ref={flatListRef} data={messages} keyExtractor={(item) => item.id}
          renderItem={renderMessage}
          contentContainerStyle={[styles.messageList, messages.length === 0 && styles.emptyList]}
          ListEmptyComponent={renderEmpty}
          showsVerticalScrollIndicator={false}
        />

        {isLoading && (
          <View style={styles.loadingRow}>
            <ActivityIndicator size="small" color={Colors.primary} />
            <Text style={styles.loadingText}>ಯೋಚಿಸುತ್ತಿದೆ...</Text>
          </View>
        )}

        {/* Stop Playback */}
        {isPlayingAudio && (
          <TouchableOpacity style={styles.stopBar} onPress={handleStopPlayback}>
            <Text style={styles.stopTxt}>⏹ ನಿಲ್ಲಿಸಿ</Text>
          </TouchableOpacity>
        )}

        {/* Recording Indicator */}
        {(isRecording || isProcessing) && (
          <View style={styles.recordingBar}>
            {isRecording ? (
              <View style={styles.recordingRow}>
                <Animated.View style={[styles.recordingDot, { opacity: pulseAnim }]} />
                <Text style={styles.recordingTime}>{Math.floor(recordingSeconds / 60)}:{(recordingSeconds % 60).toString().padStart(2, '0')}</Text>
                <Text style={styles.recordingLabel}>ಕೇಳುತ್ತಿದೆ...</Text>
              </View>
            ) : (
              <View style={styles.recordingRow}>
                <ActivityIndicator size="small" color={Colors.primary} />
                <Text style={styles.processingLabel}>ಅನುವಾದಿಸುತ್ತಿದೆ...</Text>
              </View>
            )}
          </View>
        )}

        {/* INPUT BAR — Big Mic + optional text */}
        <View style={[styles.inputBar, Shadows.md]}>
          {/* Toggle text input */}
          <TouchableOpacity onPress={() => setShowTextInput(!showTextInput)} style={styles.kbdBtn}>
            <Text style={styles.kbdIcon}>{showTextInput ? '🎙️' : '⌨️'}</Text>
          </TouchableOpacity>

          {showTextInput ? (
            <>
              <TextInput
                style={styles.textInput} placeholder="ಟೈಪ್ ಮಾಡಿ..."
                placeholderTextColor={Colors.textMuted} value={textInput}
                onChangeText={setTextInput} onSubmitEditing={handleTextSubmit}
                returnKeyType="send"
              />
              <TouchableOpacity onPress={handleTextSubmit} disabled={!textInput.trim() || isLoading}
                style={[styles.sendBtn, (!textInput.trim() || isLoading) && styles.sendBtnOff]}>
                <Text style={styles.sendTxt}>→</Text>
              </TouchableOpacity>
            </>
          ) : (
            <View style={styles.micCenter}>
              <Animated.View style={{ transform: [{ scale: scaleAnim }] }}>
                <TouchableOpacity
                  onPress={handleMicPress}
                  style={[styles.bigMic, isRecording && styles.bigMicRec]}
                  activeOpacity={0.7}
                >
                  <Text style={styles.bigMicIcon}>{isRecording ? '⏹' : '🎙️'}</Text>
                </TouchableOpacity>
              </Animated.View>
              <Text style={styles.micHint}>
                {isRecording ? 'ಮತ್ತೊಮ್ಮೆ ಒತ್ತಿ ನಿಲ್ಲಿಸಿ' : 'ಒತ್ತಿ ಮಾತನಾಡಿ'}
              </Text>
            </View>
          )}
        </View>
      </KeyboardAvoidingView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background },
  flex: { flex: 1 },
  newChatBtn: { paddingHorizontal: Spacing.md, paddingVertical: Spacing.xs, backgroundColor: 'rgba(255,255,255,0.2)', borderRadius: BorderRadius.full },
  newChatText: { fontSize: FontSize.sm, color: Colors.textOnPrimary, fontWeight: '700' },
  messageList: { paddingVertical: Spacing.md, paddingHorizontal: Spacing.sm },
  emptyList: { flex: 1 },
  emptyContainer: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  emptyIcon: { fontSize: 64, marginBottom: Spacing.md },
  emptyGreeting: { fontSize: FontSize.xxl, fontWeight: '800', color: Colors.primary, marginBottom: Spacing.sm },
  emptyHint: { fontSize: FontSize.lg, color: Colors.textMuted },
  // Bubbles — compact
  bubble: { marginHorizontal: Spacing.sm, marginVertical: 3, paddingHorizontal: Spacing.md, paddingVertical: Spacing.sm, borderRadius: BorderRadius.lg, maxWidth: '85%' as any },
  userBubble: { backgroundColor: Colors.userBubble, alignSelf: 'flex-end' },
  aiBubble: { backgroundColor: Colors.aiBubble, alignSelf: 'flex-start', borderWidth: 1, borderColor: Colors.primary + '20' },
  bubbleText: { fontSize: FontSize.md, color: Colors.textPrimary, lineHeight: 24 },
  userBubbleText: { color: Colors.textPrimary },
  replayBtn: { marginTop: Spacing.xs, alignSelf: 'flex-start', backgroundColor: Colors.primarySoft, paddingVertical: 4, paddingHorizontal: Spacing.sm, borderRadius: BorderRadius.full },
  replayTxt: { fontSize: FontSize.sm, color: Colors.primary, fontWeight: '600' },
  // Loading
  loadingRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm, paddingHorizontal: Spacing.md, paddingBottom: Spacing.sm },
  loadingText: { fontSize: FontSize.sm, color: Colors.textMuted },
  // Stop
  stopBar: { paddingVertical: Spacing.sm, alignItems: 'center', backgroundColor: '#FFF3E0', borderTopWidth: 1, borderTopColor: '#FFB74D' },
  stopTxt: { fontSize: FontSize.md, fontWeight: '700', color: '#E65100' },
  // Recording
  recordingBar: { paddingVertical: Spacing.sm, paddingHorizontal: Spacing.md, backgroundColor: '#FFF3E0', borderTopWidth: 1, borderTopColor: '#FFB74D' },
  recordingRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm },
  recordingDot: { width: 12, height: 12, borderRadius: 6, backgroundColor: '#F44336' },
  recordingTime: { fontSize: FontSize.lg, fontWeight: '700', color: '#D84315', fontVariant: ['tabular-nums'] },
  recordingLabel: { fontSize: FontSize.md, color: '#E65100', fontWeight: '600' },
  processingLabel: { fontSize: FontSize.md, color: Colors.primary, fontWeight: '600' },
  // Input Bar
  inputBar: { flexDirection: 'row', alignItems: 'center', padding: Spacing.sm, paddingBottom: Platform.OS === 'ios' ? Spacing.lg : Spacing.sm, backgroundColor: Colors.surface, borderTopWidth: 1, borderTopColor: Colors.border, gap: Spacing.sm },
  kbdBtn: { width: 40, height: 40, borderRadius: 20, backgroundColor: Colors.background, alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: Colors.border },
  kbdIcon: { fontSize: 18 },
  textInput: { flex: 1, fontSize: FontSize.md, color: Colors.textPrimary, backgroundColor: Colors.background, borderRadius: BorderRadius.full, paddingHorizontal: Spacing.md, paddingVertical: Spacing.sm, borderWidth: 1, borderColor: Colors.border },
  sendBtn: { width: 40, height: 40, borderRadius: 20, backgroundColor: Colors.primary, alignItems: 'center', justifyContent: 'center' },
  sendBtnOff: { backgroundColor: Colors.disabled },
  sendTxt: { fontSize: FontSize.lg, color: Colors.textOnPrimary, fontWeight: '700' },
  // Big Mic
  micCenter: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  bigMic: { width: 64, height: 64, borderRadius: 32, backgroundColor: Colors.primary, alignItems: 'center', justifyContent: 'center', elevation: 6, shadowColor: Colors.primary, shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.3, shadowRadius: 8 },
  bigMicRec: { backgroundColor: '#F44336' },
  bigMicIcon: { fontSize: 28 },
  micHint: { fontSize: FontSize.xs, color: Colors.textMuted, marginTop: 4 },
});
