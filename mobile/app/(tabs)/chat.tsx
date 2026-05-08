/**
 * Chat Screen — Voice-first, premium design.
 * Voice is primary. Text is secondary. Auto-plays every AI response.
 */

import React, { useState, useCallback, useRef, useEffect } from 'react';
import {
  View, Text, StyleSheet, FlatList, TextInput, TouchableOpacity,
  ActivityIndicator, KeyboardAvoidingView, Platform, Alert, Animated,
  Dimensions,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { Colors, FontSize, Spacing, BorderRadius, Shadows } from '@/constants/theme';
import { t } from '@/constants/i18n';
import { useSessionStore, Message } from '@/stores/useSessionStore';
import { useAudioStore } from '@/stores/useAudioStore';
import { useUserStore } from '@/stores/useUserStore';
import { startRecording, stopRecordingAndGetBase64, playBase64Audio, speakText, stopPlayback } from '@/services/voiceService';
import { sendVoiceQuery, sendTextQuery, ConversationTurn } from '@/services/queryService';

const { width } = Dimensions.get('window');

function WaveformBars({ active, color = Colors.primary }: { active: boolean; color?: string }) {
  const bars = useRef(Array.from({ length: 5 }, () => new Animated.Value(0.3))).current;
  useEffect(() => {
    if (!active) { bars.forEach(b => b.setValue(0.3)); return; }
    const loops = bars.map((bar, i) =>
      Animated.loop(Animated.sequence([
        Animated.timing(bar, { toValue: 1, duration: 280 + i * 70, useNativeDriver: true }),
        Animated.timing(bar, { toValue: 0.3, duration: 280 + i * 70, useNativeDriver: true }),
      ]))
    );
    const timers = loops.map((l, i) => setTimeout(() => l.start(), i * 55));
    return () => { loops.forEach(l => l.stop()); timers.forEach(t => clearTimeout(t)); };
  }, [active]);
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 3, height: 20 }}>
      {bars.map((bar, i) => (
        <Animated.View key={i} style={{ width: 3, height: 16, borderRadius: 2, backgroundColor: color, transform: [{ scaleY: bar }] }} />
      ))}
    </View>
  );
}

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
  const preferred_language = useUserStore((s) => s.preferred_language);
  const isEn = preferred_language?.startsWith('en');
  const farmerName = useUserStore((s) => s.farmer_name) || t('farmer');

  useEffect(() => {
    if (currentSession?.messages.length) {
      setTimeout(() => flatListRef.current?.scrollToEnd({ animated: true }), 200);
    }
  }, [currentSession?.messages.length]);

  useEffect(() => { if (!currentSession) startNewSession(); }, []);

  useEffect(() => {
    if (audioStore.state === 'RECORDING') {
      setRecordingSeconds(0);
      recordingTimer.current = setInterval(() => setRecordingSeconds(s => s + 1), 1000);
      const pulse = Animated.loop(Animated.sequence([
        Animated.timing(pulseAnim, { toValue: 1.2, duration: 500, useNativeDriver: true }),
        Animated.timing(pulseAnim, { toValue: 1, duration: 500, useNativeDriver: true }),
      ]));
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

  const handleMicPress = useCallback(async () => {
    try {
      if (audioStore.state === 'PLAYING') {
        await stopPlayback(); audioStore.setState('IDLE');
        await new Promise(r => setTimeout(r, 200));
      }
      if (audioStore.state === 'IDLE' || audioStore.state === 'ERROR') {
        Animated.spring(scaleAnim, { toValue: 1.15, useNativeDriver: true }).start();
        audioStore.setState('RECORDING');
        await startRecording();
      } else if (audioStore.state === 'RECORDING') {
        Animated.spring(scaleAnim, { toValue: 1, useNativeDriver: true }).start();
        audioStore.setState('STT_PROCESSING');
        let audioResult: { base64: string; mimeType: string };
        try {
          audioResult = await stopRecordingAndGetBase64();
        } catch {
          audioStore.setState('IDLE'); setLoading(false);
          Alert.alert(t('error'), t('tryAgain'));
          return;
        }
        const userMsgId = Date.now().toString();
        addMessage({ id: userMsgId, role: 'user', text: '🎙️ ...', sources: [], timestamp: Date.now(), is_diagnosis: false });
        setLoading(true);
        try {
          const response = await sendVoiceQuery(audioResult.base64, audioResult.mimeType, conversationHistory);
          const transcript = response.transcript?.trim() || (isEn ? '🎙️ Voice' : '🎙️ ಧ್ವನಿ');
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
          if (response.audio_base64) {
            try { audioStore.setState('PLAYING'); await playBase64Audio(response.audio_base64); }
            catch {} finally { audioStore.setState('IDLE'); }
          } else {
            await speakText(response.answer_text_kn);
          }
        } catch (e: any) {
          const errorMsg = e.response?.data?.detail || t('serviceUnavailable');
          addMessage({ id: (Date.now() + 1).toString(), role: 'assistant', text: errorMsg, sources: [], timestamp: Date.now(), is_diagnosis: false });
        }
        setLoading(false); audioStore.setState('IDLE');
      }
    } catch (err: any) {
      audioStore.setError(err.message); setLoading(false);
    }
  }, [audioStore.state, conversationHistory, isEn]);

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
        timestamp: Date.now(), is_diagnosis: false, audio_base64: response.audio_base64 || undefined,
      });
      setConversationHistory(prev => [...prev, { role: 'user' as const, content: query }, { role: 'assistant' as const, content: response.answer_text_kn }].slice(-12));
      if (response.audio_base64) {
        try { audioStore.setState('PLAYING'); await playBase64Audio(response.audio_base64); }
        catch {} finally { audioStore.setState('IDLE'); }
      } else { await speakText(response.answer_text_kn); }
    } catch {
      addMessage({ id: (Date.now() + 1).toString(), role: 'assistant', text: t('serviceUnavailable'), sources: [], timestamp: Date.now(), is_diagnosis: false });
    }
    setLoading(false);
  }, [textInput, isLoading, conversationHistory, isEn]);

  const handlePlayAudio = useCallback(async (audioB64: string) => {
    try { audioStore.setState('PLAYING'); await playBase64Audio(audioB64); audioStore.setState('IDLE'); }
    catch { audioStore.setState('IDLE'); }
  }, []);

  const messages = currentSession?.messages || [];
  const isRecording = audioStore.state === 'RECORDING';
  const isProcessing = audioStore.state === 'STT_PROCESSING';
  const isPlayingAudio = audioStore.state === 'PLAYING';

  const renderMessage = ({ item }: { item: Message }) => {
    const isUser = item.role === 'user';
    return (
      <View style={[styles.bubbleWrapper, isUser ? styles.bubbleRight : styles.bubbleLeft]}>
        {!isUser && (
          <View style={styles.aiAvatar}>
            <MaterialCommunityIcons name="robot" size={16} color={Colors.primary} />
          </View>
        )}
        <View style={[styles.bubble, isUser ? styles.userBubble : styles.aiBubble]}>
          <Text style={[styles.bubbleText, isUser && styles.userBubbleText]}>
            {item.text}
          </Text>
          {!isUser && item.sources && item.sources.length > 0 && (
            <View style={styles.sourceRow}>
              <MaterialCommunityIcons name="book-open-variant" size={11} color={Colors.textMuted} />
              <Text style={styles.sourceText}>{item.sources.join(' • ')}</Text>
            </View>
          )}
          {!isUser && item.audio_base64 && (
            <TouchableOpacity onPress={() => handlePlayAudio(item.audio_base64!)} style={styles.replayBtn}>
              <MaterialCommunityIcons name="volume-high" size={14} color={Colors.primary} />
              <Text style={styles.replayTxt}>{t('listenAgain')}</Text>
            </TouchableOpacity>
          )}
        </View>
      </View>
    );
  };

  const renderEmpty = () => (
    <View style={styles.emptyContainer}>
      <View style={styles.emptyIconCircle}>
        <MaterialCommunityIcons name="sprout" size={48} color={Colors.primary} />
      </View>
      <Text style={styles.emptyGreeting}>{t('namaste').replace(' 🙏', '')} {farmerName}!</Text>
      <Text style={styles.emptyHint}>{t('micTapSpeak')}</Text>
    </View>
  );

  return (
    <View style={styles.container}>
      {/* Header */}
      <LinearGradient colors={['#1B5E20', '#2E7D32']} style={styles.header}>
        <View style={styles.headerRow}>
          <View style={styles.headerLeft}>
            <MaterialCommunityIcons name="sprout" size={22} color="#fff" />
            <Text style={styles.headerTitle}>{t('krishiMitra')}</Text>
          </View>
          <TouchableOpacity onPress={handleNewChat} style={styles.newChatBtn}>
            <MaterialCommunityIcons name="plus" size={16} color="#fff" />
            <Text style={styles.newChatText}>{t('newChat')}</Text>
          </TouchableOpacity>
        </View>
      </LinearGradient>

      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={styles.flex}>
        <FlatList
          ref={flatListRef} data={messages} keyExtractor={(item) => item.id}
          renderItem={renderMessage}
          contentContainerStyle={[styles.messageList, messages.length === 0 && styles.emptyList]}
          ListEmptyComponent={renderEmpty}
          showsVerticalScrollIndicator={false}
        />

        {isLoading && (
          <View style={styles.typingRow}>
            <View style={styles.typingDots}>
              <WaveformBars active />
              <Text style={styles.typingText}>{t('thinking')}</Text>
            </View>
          </View>
        )}

        {isPlayingAudio && (
          <TouchableOpacity style={styles.playingBar} onPress={handleStopPlayback}>
            <WaveformBars active color="#fff" />
            <Text style={styles.playingBarText}>{t('tapToStop')}</Text>
            <MaterialCommunityIcons name="stop" size={18} color="#fff" />
          </TouchableOpacity>
        )}

        {(isRecording || isProcessing) && (
          <View style={styles.recordingBar}>
            {isRecording ? (
              <View style={styles.recordingRow}>
                <View style={styles.recDot} />
                <Text style={styles.recordingTime}>{Math.floor(recordingSeconds / 60)}:{(recordingSeconds % 60).toString().padStart(2, '0')}</Text>
                <WaveformBars active color={Colors.error} />
                <Text style={styles.recordingLabel}>{t('listening')}</Text>
              </View>
            ) : (
              <View style={styles.recordingRow}>
                <ActivityIndicator size="small" color={Colors.primary} />
                <Text style={styles.processingLabel}>{t('processing')}</Text>
              </View>
            )}
          </View>
        )}

        {/* Input bar */}
        <View style={styles.inputBar}>
          <TouchableOpacity onPress={() => setShowTextInput(!showTextInput)} style={styles.toggleBtn}>
            <MaterialCommunityIcons
              name={showTextInput ? 'microphone' : 'keyboard'}
              size={22}
              color={Colors.textSecondary}
            />
          </TouchableOpacity>

          {showTextInput ? (
            <>
              <TextInput
                style={styles.textInput}
                placeholder={t('typeHere')}
                placeholderTextColor={Colors.textMuted}
                value={textInput}
                onChangeText={setTextInput}
                onSubmitEditing={handleTextSubmit}
                returnKeyType="send"
              />
              <TouchableOpacity
                onPress={handleTextSubmit}
                disabled={!textInput.trim() || isLoading}
                style={[styles.sendBtn, (!textInput.trim() || isLoading) && styles.sendBtnOff]}
              >
                <MaterialCommunityIcons name="send" size={20} color="#fff" />
              </TouchableOpacity>
            </>
          ) : (
            <View style={styles.micCenter}>
              <Animated.View style={{ transform: [{ scale: Animated.multiply(pulseAnim, scaleAnim) }] }}>
                <TouchableOpacity
                  onPress={handleMicPress}
                  style={[styles.bigMic, isRecording && styles.bigMicRec]}
                  activeOpacity={0.8}
                >
                  <MaterialCommunityIcons
                    name={isRecording ? 'stop' : 'microphone'}
                    size={30}
                    color="#fff"
                  />
                </TouchableOpacity>
              </Animated.View>
              <Text style={styles.micHint}>{isRecording ? t('tapToStop') : t('tapToSpeak')}</Text>
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
  header: { paddingTop: 52, paddingBottom: Spacing.md, paddingHorizontal: Spacing.lg },
  headerRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  headerLeft: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm },
  headerTitle: { fontSize: FontSize.xl, fontWeight: '800', color: '#fff' },
  newChatBtn: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: Spacing.md, paddingVertical: 6, backgroundColor: 'rgba(255,255,255,0.2)', borderRadius: BorderRadius.full },
  newChatText: { fontSize: FontSize.sm, color: '#fff', fontWeight: '700' },

  messageList: { paddingVertical: Spacing.md, paddingHorizontal: Spacing.sm, paddingBottom: Spacing.lg },
  emptyList: { flex: 1 },
  emptyContainer: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingTop: 80 },
  emptyIconCircle: { width: 96, height: 96, borderRadius: 48, backgroundColor: Colors.primarySoft, alignItems: 'center', justifyContent: 'center', marginBottom: Spacing.lg },
  emptyGreeting: { fontSize: FontSize.xxl, fontWeight: '800', color: Colors.primary, marginBottom: Spacing.sm },
  emptyHint: { fontSize: FontSize.lg, color: Colors.textMuted, fontWeight: '500' },

  bubbleWrapper: { flexDirection: 'row', alignItems: 'flex-end', marginVertical: 4, paddingHorizontal: Spacing.sm },
  bubbleRight: { justifyContent: 'flex-end' },
  bubbleLeft: { justifyContent: 'flex-start' },
  aiAvatar: { width: 28, height: 28, borderRadius: 14, backgroundColor: Colors.primarySoft, alignItems: 'center', justifyContent: 'center', marginRight: 6, marginBottom: 2 },
  bubble: { maxWidth: '80%', paddingHorizontal: Spacing.md, paddingVertical: Spacing.sm, borderRadius: BorderRadius.lg },
  userBubble: { backgroundColor: Colors.userBubble, borderBottomRightRadius: 4 },
  aiBubble: { backgroundColor: Colors.surface, borderBottomLeftRadius: 4, borderWidth: 1, borderColor: Colors.primary + '18', ...Shadows.sm },
  bubbleText: { fontSize: FontSize.md, color: Colors.textPrimary, lineHeight: 24 },
  userBubbleText: { color: Colors.textPrimary },
  replayBtn: { flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 6, backgroundColor: Colors.primarySoft, paddingVertical: 4, paddingHorizontal: Spacing.sm, borderRadius: BorderRadius.full, alignSelf: 'flex-start' },
  replayTxt: { fontSize: FontSize.xs, color: Colors.primary, fontWeight: '700' },
  sourceRow: { flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 6, paddingTop: 4, borderTopWidth: 1, borderTopColor: Colors.border },
  sourceText: { fontSize: 10, color: Colors.textMuted, flex: 1 },

  typingRow: { paddingHorizontal: Spacing.md, paddingBottom: Spacing.sm },
  typingDots: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm, backgroundColor: Colors.primarySoft, paddingVertical: 8, paddingHorizontal: Spacing.md, borderRadius: BorderRadius.full, alignSelf: 'flex-start' },
  typingText: { fontSize: FontSize.sm, color: Colors.primary, fontWeight: '600' },

  playingBar: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm, paddingVertical: Spacing.sm, paddingHorizontal: Spacing.md, backgroundColor: Colors.primary, justifyContent: 'center' },
  playingBarText: { fontSize: FontSize.md, color: '#fff', fontWeight: '700' },

  recordingBar: { paddingVertical: Spacing.sm, paddingHorizontal: Spacing.md, backgroundColor: '#FFF8F0', borderTopWidth: 1, borderTopColor: Colors.accent + '30' },
  recordingRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm },
  recDot: { width: 10, height: 10, borderRadius: 5, backgroundColor: Colors.error },
  recordingTime: { fontSize: FontSize.lg, fontWeight: '800', color: Colors.error, fontVariant: ['tabular-nums'] },
  recordingLabel: { fontSize: FontSize.md, color: Colors.error, fontWeight: '600' },
  processingLabel: { fontSize: FontSize.md, color: Colors.primary, fontWeight: '600' },

  inputBar: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: Spacing.sm, paddingVertical: Spacing.sm, paddingBottom: Platform.OS === 'ios' ? Spacing.xl : Spacing.sm, backgroundColor: Colors.surface, borderTopWidth: 1, borderTopColor: Colors.border, gap: Spacing.sm, ...Shadows.md },
  toggleBtn: { width: 44, height: 44, borderRadius: 22, backgroundColor: Colors.background, alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: Colors.border },
  textInput: { flex: 1, fontSize: FontSize.md, color: Colors.textPrimary, backgroundColor: Colors.background, borderRadius: BorderRadius.full, paddingHorizontal: Spacing.md, paddingVertical: Spacing.sm, borderWidth: 1, borderColor: Colors.border },
  sendBtn: { width: 44, height: 44, borderRadius: 22, backgroundColor: Colors.primary, alignItems: 'center', justifyContent: 'center' },
  sendBtnOff: { backgroundColor: Colors.disabled },
  micCenter: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  bigMic: { width: 68, height: 68, borderRadius: 34, backgroundColor: Colors.primary, alignItems: 'center', justifyContent: 'center', shadowColor: Colors.primary, shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.4, shadowRadius: 10, elevation: 8 },
  bigMicRec: { backgroundColor: Colors.error, shadowColor: Colors.error },
  micHint: { fontSize: FontSize.xs, color: Colors.textMuted, marginTop: 4 },
});
