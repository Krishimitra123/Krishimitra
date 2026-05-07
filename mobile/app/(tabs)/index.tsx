/**
 * Home Screen — Voice-first, premium design for KrishiMitra.
 * India's finest farming AI — for uneducated farmers who can't read or write.
 */

import React, { useState, useCallback, useEffect, useRef } from 'react';
import {
  View, Text, StyleSheet, ScrollView,
  TouchableOpacity, Animated, ActivityIndicator, Dimensions,
  StatusBar,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { Colors, FontSize, Spacing, BorderRadius, Shadows } from '@/constants/theme';
import { useUserStore } from '@/stores/useUserStore';
import { useSessionStore } from '@/stores/useSessionStore';
import { useAudioStore } from '@/stores/useAudioStore';
import { startRecording, stopRecordingAndGetBase64, playBase64Audio, stopPlayback, speakText } from '@/services/voiceService';
import { sendVoiceQuery, sendTextQuery } from '@/services/queryService';
import { getWeather, getWeatherDescription, type WeatherResponse } from '@/services/weatherService';
import { getMarketPrices, formatPrice, type MarketResponse } from '@/services/marketService';

const { width } = Dimensions.get('window');

// Quick actions with vector icons
const QUICK_ACTIONS = [
  { key: 'jeeva', icon: 'flask-outline' as const, labelKn: 'ಜೀವಾಮೃತ', query: 'ಜೀವಾಮೃತ ತಯಾರಿಸುವ ವಿಧಾನ ಹೇಳಿ' },
  { key: 'mulch', icon: 'grass' as const, labelKn: 'ಮಲ್ಚಿಂಗ್', query: 'ಮಲ್ಚಿಂಗ್ ಹೇಗೆ ಮಾಡಬೇಕು' },
  { key: 'soil', icon: 'earth' as const, labelKn: 'ಮಣ್ಣು', query: 'ಮಣ್ಣಿನ ಆರೋಗ್ಯ ಸುಧಾರಿಸುವ ವಿಧಾನ' },
  { key: 'worm', icon: 'bug-outline' as const, labelKn: 'ಗೊಬ್ಬರ', query: 'ಎರೆಹುಳು ಗೊಬ್ಬರ ತಯಾರಿಕೆ ಹೇಗೆ' },
];

// Waveform bars for recording indicator
function WaveformIndicator({ active, color = '#fff' }: { active: boolean; color?: string }) {
  const bars = useRef(Array.from({ length: 5 }, () => new Animated.Value(0.3))).current;
  useEffect(() => {
    if (!active) { bars.forEach(b => b.setValue(0.3)); return; }
    const loops = bars.map((bar, i) =>
      Animated.loop(Animated.sequence([
        Animated.timing(bar, { toValue: 1, duration: 300 + i * 60, useNativeDriver: true }),
        Animated.timing(bar, { toValue: 0.3, duration: 300 + i * 60, useNativeDriver: true }),
      ]))
    );
    const timers = loops.map((l, i) => setTimeout(() => l.start(), i * 60));
    return () => { loops.forEach(l => l.stop()); timers.forEach(t => clearTimeout(t)); };
  }, [active]);
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4, height: 28 }}>
      {bars.map((bar, i) => (
        <Animated.View key={i} style={{ width: 4, height: 20, borderRadius: 2, backgroundColor: color, transform: [{ scaleY: bar }] }} />
      ))}
    </View>
  );
}

export default function HomeScreen() {
  const router = useRouter();
  const { farmer_name, district, primary_crop } = useUserStore();
  const { startNewSession, addMessage, currentSession } = useSessionStore();
  const audioStore = useAudioStore();

  const [weather, setWeather] = useState<WeatherResponse | null>(null);
  const [market, setMarket] = useState<MarketResponse | null>(null);
  const [widgetLoading, setWidgetLoading] = useState(true);
  const [quickLoading, setQuickLoading] = useState<string | null>(null);
  const [recordingSeconds, setRecordingSeconds] = useState(0);
  const recordingTimer = useRef<ReturnType<typeof setInterval> | null>(null);

  const pulseAnim = useRef(new Animated.Value(1)).current;
  const greetingOpacity = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.sequence([
      Animated.delay(300),
      Animated.timing(greetingOpacity, { toValue: 1, duration: 900, useNativeDriver: true }),
    ]).start();
  }, []);

  useEffect(() => {
    if (!district) { setWidgetLoading(false); return; }
    let cancelled = false;
    async function loadWidgets() {
      setWidgetLoading(true);
      const [w, m] = await Promise.all([
        getWeather(district).catch(() => null),
        getMarketPrices(district, primary_crop || undefined).catch(() => null),
      ]);
      if (cancelled) return;
      if (w) setWeather(w as WeatherResponse);
      if (m) setMarket(m as MarketResponse);
      setWidgetLoading(false);
    }
    loadWidgets();
    return () => { cancelled = true; };
  }, [district, primary_crop]);

  useEffect(() => {
    if (audioStore.state === 'RECORDING') {
      setRecordingSeconds(0);
      recordingTimer.current = setInterval(() => setRecordingSeconds(s => s + 1), 1000);
      const pulse = Animated.loop(
        Animated.sequence([
          Animated.timing(pulseAnim, { toValue: 1.18, duration: 600, useNativeDriver: true }),
          Animated.timing(pulseAnim, { toValue: 1, duration: 600, useNativeDriver: true }),
        ])
      );
      pulse.start();
      return () => { pulse.stop(); pulseAnim.setValue(1); };
    } else {
      if (recordingTimer.current) { clearInterval(recordingTimer.current); recordingTimer.current = null; }
    }
  }, [audioStore.state]);

  const handleMicPress = useCallback(async () => {
    try {
      if (audioStore.state === 'PLAYING') {
        await stopPlayback(); audioStore.setState('IDLE');
        await new Promise(r => setTimeout(r, 200));
      }
      if (audioStore.state === 'IDLE' || audioStore.state === 'ERROR') {
        audioStore.setState('RECORDING');
        await startRecording();
      } else if (audioStore.state === 'RECORDING') {
        audioStore.setState('STT_PROCESSING');
        let audioResult: { base64: string; mimeType: string };
        try {
          audioResult = await stopRecordingAndGetBase64();
        } catch (err: any) {
          audioStore.setState('IDLE'); return;
        }
        if (!currentSession) startNewSession();
        addMessage({ id: Date.now().toString(), role: 'user', text: '🎙️ ...', sources: [], timestamp: Date.now(), is_diagnosis: false });
        router.push('/(tabs)/chat');
        try {
          const response = await sendVoiceQuery(audioResult.base64, audioResult.mimeType);
          addMessage({
            id: (Date.now() + 1).toString(), role: 'assistant',
            text: response.answer_text_kn, sources: response.sources || [],
            timestamp: Date.now(), is_diagnosis: false,
            audio_base64: response.audio_base64 || undefined,
          });
          if (response.audio_base64) {
            audioStore.setState('PLAYING');
            await playBase64Audio(response.audio_base64);
          } else {
            await speakText(response.answer_text_kn);
          }
        } catch (e: any) {
          addMessage({ id: (Date.now() + 1).toString(), role: 'assistant', text: 'ಸೇವೆ ಲಭ್ಯವಿಲ್ಲ', sources: [], timestamp: Date.now(), is_diagnosis: false });
        }
        audioStore.setState('IDLE');
      }
    } catch (err: any) {
      audioStore.setError(err.message);
    }
  }, [audioStore.state, currentSession]);

  const handleQuickAction = useCallback(async (query: string, key: string) => {
    if (quickLoading) return;
    setQuickLoading(key);
    if (!currentSession) startNewSession();
    addMessage({ id: Date.now().toString(), role: 'user', text: query, sources: [], timestamp: Date.now(), is_diagnosis: false });
    router.push('/(tabs)/chat');
    try {
      const response = await sendTextQuery(query);
      addMessage({
        id: (Date.now() + 1).toString(), role: 'assistant',
        text: response.answer_text_kn, sources: response.sources || [],
        timestamp: Date.now(), is_diagnosis: false,
        audio_base64: response.audio_base64 || undefined,
      });
      if (response.audio_base64) {
        audioStore.setState('PLAYING');
        await playBase64Audio(response.audio_base64);
        audioStore.setState('IDLE');
      } else {
        await speakText(response.answer_text_kn);
      }
    } catch {
      addMessage({ id: (Date.now() + 1).toString(), role: 'assistant', text: 'ಸೇವೆ ಲಭ್ಯವಿಲ್ಲ', sources: [], timestamp: Date.now(), is_diagnosis: false });
    }
    setQuickLoading(null);
  }, [quickLoading, currentSession]);

  const isRecording = audioStore.state === 'RECORDING';
  const isProcessing = audioStore.state === 'STT_PROCESSING';
  const isPlaying = audioStore.state === 'PLAYING';

  const micLabel = isRecording ? 'ನಿಲ್ಲಿಸಲು ಒತ್ತಿ' : isProcessing ? 'ಯೋಚಿಸುತ್ತಿದೆ...' : isPlaying ? 'ಕೇಳಿ...' : 'ಒತ್ತಿ ಮಾತನಾಡಿ';

  return (
    <View style={styles.container}>
      <StatusBar barStyle="light-content" />

      {/* Header gradient */}
      <LinearGradient
        colors={['#1B5E20', '#2E7D32']}
        style={styles.header}
      >
        <Animated.View style={{ opacity: greetingOpacity }}>
          <Text style={styles.namaste}>ನಮಸ್ಕಾರ 🙏</Text>
          <Text style={styles.farmerName}>{farmer_name || 'ರೈತರೇ'}</Text>
          {district ? <Text style={styles.districtText}>{district}</Text> : null}
        </Animated.View>
      </LinearGradient>

      <ScrollView
        contentContainerStyle={styles.scroll}
        showsVerticalScrollIndicator={false}
      >
        {/* BIG MIC — Center Stage */}
        <View style={styles.micSection}>
          {(isRecording || isProcessing || isPlaying) && (
            <View style={styles.statusIndicator}>
              {isRecording && (
                <View style={styles.recordingBadge}>
                  <View style={styles.redDot} />
                  <Text style={styles.recordingTime}>
                    {Math.floor(recordingSeconds / 60)}:{(recordingSeconds % 60).toString().padStart(2, '0')}
                  </Text>
                  <WaveformIndicator active color={Colors.error} />
                </View>
              )}
              {isProcessing && (
                <View style={styles.processingBadge}>
                  <ActivityIndicator size="small" color={Colors.primary} />
                  <Text style={styles.processingText}>ಯೋಚಿಸುತ್ತಿದೆ...</Text>
                </View>
              )}
              {isPlaying && (
                <View style={styles.playingBadge}>
                  <WaveformIndicator active color={Colors.primary} />
                  <Text style={styles.playingText}>ಕೇಳಿ...</Text>
                </View>
              )}
            </View>
          )}

          <Animated.View style={{ transform: [{ scale: pulseAnim }] }}>
            <TouchableOpacity
              onPress={handleMicPress}
              style={[
                styles.bigMic,
                isRecording && styles.bigMicRec,
                isPlaying && styles.bigMicPlaying,
              ]}
              activeOpacity={0.85}
              disabled={isProcessing}
            >
              {isProcessing ? (
                <ActivityIndicator size="large" color="#fff" />
              ) : (
                <MaterialCommunityIcons
                  name={isRecording ? 'stop' : isPlaying ? 'volume-high' : 'microphone'}
                  size={52}
                  color="#fff"
                />
              )}
            </TouchableOpacity>
          </Animated.View>

          <Text style={styles.micHint}>{micLabel}</Text>
        </View>

        {/* Quick Actions */}
        <View style={styles.quickSection}>
          <Text style={styles.sectionLabel}>ತ್ವರಿತ ಸಹಾಯ</Text>
          <View style={styles.quickRow}>
            {QUICK_ACTIONS.map((a) => (
              <TouchableOpacity
                key={a.key}
                style={styles.quickBtn}
                onPress={() => handleQuickAction(a.query, a.key)}
                disabled={!!quickLoading}
                activeOpacity={0.75}
              >
                <LinearGradient
                  colors={['rgba(46,125,50,0.12)', 'rgba(46,125,50,0.06)']}
                  style={styles.quickBtnInner}
                >
                  {quickLoading === a.key ? (
                    <ActivityIndicator size="small" color={Colors.primary} />
                  ) : (
                    <MaterialCommunityIcons name={a.icon} size={28} color={Colors.primary} />
                  )}
                  <Text style={styles.quickLabel}>{a.labelKn}</Text>
                </LinearGradient>
              </TouchableOpacity>
            ))}
          </View>
        </View>

        {/* Widgets */}
        {widgetLoading && district ? (
          <ActivityIndicator color={Colors.primary} style={{ marginTop: Spacing.lg }} />
        ) : (
          <View style={styles.widgetSection}>
            {weather?.current && (() => {
              const w = getWeatherDescription(weather.current.weather_code);
              return (
                <View style={styles.widgetCard}>
                  <View style={styles.widgetRow}>
                    <MaterialCommunityIcons name="weather-sunny" size={32} color={Colors.accent} />
                    <View style={{ marginLeft: Spacing.md, flex: 1 }}>
                      <Text style={styles.widgetTitle}>ಹವಾಮಾನ</Text>
                      <Text style={styles.widgetValue}>{Math.round(weather.current.temperature_2m)}°C — {weather.district}</Text>
                    </View>
                    <View style={{ alignItems: 'flex-end' }}>
                      <Text style={styles.widgetSub}>💧 {weather.current.relative_humidity_2m}%</Text>
                      <Text style={styles.widgetSub}>💨 {Math.round(weather.current.wind_speed_10m)}km/h</Text>
                    </View>
                  </View>
                </View>
              );
            })()}

            {market?.records?.length ? (
              <View style={styles.widgetCard}>
                <View style={styles.widgetRow}>
                  <MaterialCommunityIcons name="chart-line" size={32} color={Colors.accent} />
                  <View style={{ marginLeft: Spacing.md, flex: 1 }}>
                    <Text style={styles.widgetTitle}>ಮಾರುಕಟ್ಟೆ ಬೆಲೆ</Text>
                    {market.records.slice(0, 2).map((p, i) => (
                      <View key={i} style={{ flexDirection: 'row', justifyContent: 'space-between', marginTop: 2 }}>
                        <Text style={styles.widgetValue} numberOfLines={1}>{p.commodity_kn || p.commodity}</Text>
                        <Text style={styles.widgetPrice}>₹{formatPrice(p.modal_price)}</Text>
                      </View>
                    ))}
                  </View>
                </View>
              </View>
            ) : null}
          </View>
        )}

        <Text style={styles.footerText}>Nivetti Systems</Text>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background },
  header: {
    paddingTop: 56,
    paddingBottom: Spacing.xl,
    paddingHorizontal: Spacing.xl,
  },
  namaste: { fontSize: FontSize.lg, color: 'rgba(255,255,255,0.8)', fontWeight: '500' },
  farmerName: { fontSize: 36, fontWeight: '900', color: '#fff', marginTop: 2 },
  districtText: { fontSize: FontSize.sm, color: 'rgba(255,255,255,0.65)', marginTop: 4 },

  scroll: { paddingBottom: 100 },

  // Mic section
  micSection: { alignItems: 'center', paddingTop: Spacing.xl, paddingBottom: Spacing.xl },
  statusIndicator: { marginBottom: Spacing.md, alignItems: 'center' },
  recordingBadge: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm, backgroundColor: '#FFF3F3', paddingVertical: 8, paddingHorizontal: Spacing.md, borderRadius: BorderRadius.full, borderWidth: 1, borderColor: Colors.error + '30' },
  redDot: { width: 10, height: 10, borderRadius: 5, backgroundColor: Colors.error },
  recordingTime: { fontSize: FontSize.lg, fontWeight: '800', color: Colors.error, fontVariant: ['tabular-nums'] },
  processingBadge: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm, backgroundColor: Colors.primarySoft, paddingVertical: 8, paddingHorizontal: Spacing.md, borderRadius: BorderRadius.full },
  processingText: { fontSize: FontSize.md, color: Colors.primary, fontWeight: '600' },
  playingBadge: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm, backgroundColor: Colors.primarySoft, paddingVertical: 8, paddingHorizontal: Spacing.md, borderRadius: BorderRadius.full },
  playingText: { fontSize: FontSize.md, color: Colors.primary, fontWeight: '600' },

  bigMic: {
    width: 110, height: 110, borderRadius: 55,
    backgroundColor: Colors.primary,
    alignItems: 'center', justifyContent: 'center',
    shadowColor: Colors.primary,
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.5, shadowRadius: 20, elevation: 14,
    borderWidth: 4, borderColor: 'rgba(255,255,255,0.3)',
  },
  bigMicRec: { backgroundColor: Colors.error, shadowColor: Colors.error },
  bigMicPlaying: { backgroundColor: Colors.accent, shadowColor: Colors.accent },
  micHint: { fontSize: FontSize.md, color: Colors.textMuted, marginTop: Spacing.md, fontWeight: '500' },

  // Quick actions
  quickSection: { paddingHorizontal: Spacing.lg, marginBottom: Spacing.lg },
  sectionLabel: { fontSize: FontSize.sm, color: Colors.textMuted, fontWeight: '700', marginBottom: Spacing.md, textTransform: 'uppercase', letterSpacing: 1 },
  quickRow: { flexDirection: 'row', gap: Spacing.md },
  quickBtn: { flex: 1 },
  quickBtnInner: {
    alignItems: 'center', justifyContent: 'center',
    paddingVertical: Spacing.md,
    borderRadius: BorderRadius.lg,
    borderWidth: 1, borderColor: Colors.primary + '25',
    gap: 6,
  },
  quickLabel: { fontSize: FontSize.xs, color: Colors.primary, fontWeight: '700' },

  // Widgets
  widgetSection: { paddingHorizontal: Spacing.lg, gap: Spacing.sm },
  widgetCard: {
    backgroundColor: Colors.surface,
    borderRadius: BorderRadius.lg,
    padding: Spacing.md,
    borderWidth: 1, borderColor: Colors.border,
    ...Shadows.sm,
  },
  widgetRow: { flexDirection: 'row', alignItems: 'center' },
  widgetTitle: { fontSize: FontSize.xs, color: Colors.textMuted, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 0.5 },
  widgetValue: { fontSize: FontSize.md, color: Colors.textPrimary, fontWeight: '600', marginTop: 2 },
  widgetSub: { fontSize: FontSize.xs, color: Colors.textSecondary },
  widgetPrice: { fontSize: FontSize.md, color: Colors.primary, fontWeight: '800' },

  footerText: { fontSize: FontSize.xs, color: Colors.textMuted, textAlign: 'center', marginTop: Spacing.xxl, fontStyle: 'italic' },
});
