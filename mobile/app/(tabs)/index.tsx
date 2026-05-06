/**
 * Home Screen — VOICE-FIRST design per Master Prompt v4.0.
 * Big mic center. AI greeting on open. Quick action icons. Minimal text.
 */

import React, { useState, useCallback, useEffect, useRef } from 'react';
import {
  View, Text, StyleSheet, ScrollView,
  TouchableOpacity, Animated, ActivityIndicator,
} from 'react-native';
import { useRouter } from 'expo-router';
import { NivettiHeader } from '@/components/NivettiHeader';
import { Colors, FontSize, Spacing, BorderRadius, Shadows } from '@/constants/theme';
import { useUserStore } from '@/stores/useUserStore';
import { useSessionStore } from '@/stores/useSessionStore';
import { useAudioStore } from '@/stores/useAudioStore';
import { startRecording, stopRecordingAndGetBase64, playBase64Audio, stopPlayback } from '@/services/voiceService';
import { sendVoiceQuery, sendTextQuery } from '@/services/queryService';
import { getWeather, getWeatherDescription, type WeatherResponse } from '@/services/weatherService';
import { getMarketPrices, formatPrice, type MarketResponse } from '@/services/marketService';

export default function HomeScreen() {
  const router = useRouter();
  const { farmer_name, district, primary_crop, tts_language } = useUserStore();
  const { startNewSession, addMessage, currentSession } = useSessionStore();
  const audioStore = useAudioStore();

  const [weather, setWeather] = useState<WeatherResponse | null>(null);
  const [market, setMarket] = useState<MarketResponse | null>(null);
  const [widgetLoading, setWidgetLoading] = useState(true);
  const [quickLoading, setQuickLoading] = useState<string | null>(null);
  const [recordingSeconds, setRecordingSeconds] = useState(0);
  const recordingTimer = useRef<ReturnType<typeof setInterval> | null>(null);

  // Animations
  const pulseAnim = useRef(new Animated.Value(1)).current;
  const scaleAnim = useRef(new Animated.Value(1)).current;
  const greetingOpacity = useRef(new Animated.Value(0)).current;

  // ── AI greeting on every open ─────────────────────────────────
  useEffect(() => {
    Animated.timing(greetingOpacity, { toValue: 1, duration: 800, useNativeDriver: true }).start();
    // Placeholder: auto-play TTS greeting when endpoint is ready
  }, []);

  // Load widgets
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

  // Recording timer + pulse
  useEffect(() => {
    if (audioStore.state === 'RECORDING') {
      setRecordingSeconds(0);
      recordingTimer.current = setInterval(() => setRecordingSeconds(s => s + 1), 1000);
      const pulse = Animated.loop(
        Animated.sequence([
          Animated.timing(pulseAnim, { toValue: 1.15, duration: 700, useNativeDriver: true }),
          Animated.timing(pulseAnim, { toValue: 1, duration: 700, useNativeDriver: true }),
        ])
      );
      pulse.start();
      return () => { pulse.stop(); pulseAnim.setValue(1); };
    } else {
      if (recordingTimer.current) { clearInterval(recordingTimer.current); recordingTimer.current = null; }
    }
  }, [audioStore.state]);

  // ── Voice Handler — Big Mic ──────────────────────────────────
  const handleMicPress = useCallback(async () => {
    try {
      if (audioStore.state === 'PLAYING') {
        await stopPlayback(); audioStore.setState('IDLE');
        await new Promise(r => setTimeout(r, 200));
      }

      if (audioStore.state === 'IDLE' || audioStore.state === 'ERROR') {
        Animated.spring(scaleAnim, { toValue: 1.1, useNativeDriver: true }).start();
        audioStore.setState('RECORDING');
        await startRecording();
      } else if (audioStore.state === 'RECORDING') {
        Animated.spring(scaleAnim, { toValue: 1, useNativeDriver: true }).start();
        audioStore.setState('STT_PROCESSING');

        let audioResult: { base64: string; mimeType: string };
        try {
          audioResult = await stopRecordingAndGetBase64();
          console.log('[HomeScreen] Recording stopped, got audio');
        } catch (err: any) {
          console.error('[HomeScreen] Recording error:', err.message);
          audioStore.setState('IDLE');
          return;
        }

        if (!currentSession) startNewSession();
        addMessage({ id: Date.now().toString(), role: 'user', text: '🎙️ ...', sources: [], timestamp: Date.now(), is_diagnosis: false });
        router.push('/(tabs)/chat');

        try {
          console.log('[HomeScreen] Sending voice query to backend...');
          const response = await sendVoiceQuery(audioResult.base64, audioResult.mimeType);
          console.log('[HomeScreen] Got response from backend ✓');
          
          addMessage({
            id: (Date.now() + 1).toString(), role: 'assistant',
            text: response.answer_text_kn, sources: response.sources || [],
            timestamp: Date.now(), is_diagnosis: false,
            audio_base64: response.audio_base64 || undefined,
          });
          
          if (response.audio_base64) {
            try {
              console.log('[HomeScreen] Playing TTS audio...');
              audioStore.setState('PLAYING');
              await playBase64Audio(response.audio_base64);
              console.log('[HomeScreen] TTS playback finished ✓');
            } catch (playErr) {
              console.error('[HomeScreen] TTS playback error:', playErr);
            } finally {
              audioStore.setState('IDLE');
            }
          } else {
            console.warn('[HomeScreen] No audio in response');
            audioStore.setState('IDLE');
          }
        } catch (e: any) {
          console.error('[HomeScreen] Query error:', {
            message: e.message,
            code: e.code,
            response: e.response?.status,
          });
          addMessage({
            id: (Date.now() + 1).toString(),
            role: 'assistant',
            text: `ಸೇವೆ ಲಭ್ಯವಿಲ್ಲ: ${e.message || 'ಅಜ್ಞಾತ ದೋಷ'}`,
            sources: [],
            timestamp: Date.now(),
            is_diagnosis: false,
          });
          audioStore.setState('IDLE');
        }
      }
    } catch (err: any) {
      console.error('[HomeScreen] Unexpected error:', err.message);
      audioStore.setError(err.message);
    }
  }, [audioStore.state, currentSession]);

  // ── Quick Action Handler — sends query + auto-plays ─────────
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
        try { audioStore.setState('PLAYING'); await playBase64Audio(response.audio_base64); }
        catch {} finally { audioStore.setState('IDLE'); }
      }
    } catch {
      addMessage({ id: (Date.now() + 1).toString(), role: 'assistant', text: 'ಸೇವೆ ಲಭ್ಯವಿಲ್ಲ', sources: [], timestamp: Date.now(), is_diagnosis: false });
    }
    setQuickLoading(null);
  }, [quickLoading, currentSession]);

  const isRecording = audioStore.state === 'RECORDING';
  const isProcessing = audioStore.state === 'STT_PROCESSING';

  // ── Quick Actions (icon-only, no labels per Master Prompt) ──
  const quickActions = [
    { key: 'jeeva', icon: '🧪', query: 'ಜೀವಾಮೃತ ತಯಾರಿಸುವ ವಿಧಾನ ಹೇಳಿ' },
    { key: 'mulch', icon: '🌿', query: 'ಮಲ್ಚಿಂಗ್ ಹೇಗೆ ಮಾಡಬೇಕು' },
    { key: 'soil', icon: '🌍', query: 'ಮಣ್ಣಿನ ಆರೋಗ್ಯ ಸುಧಾರಿಸುವ ವಿಧಾನ' },
    { key: 'worm', icon: '🪱', query: 'ಎರೆಹುಳು ಗೊಬ್ಬರ ತಯಾರಿಕೆ ಹೇಗೆ' },
  ];

  // ── Weather mini widget ────────────────────────────────────────
  const renderWeatherMini = () => {
    if (!weather?.current) return null;
    const w = getWeatherDescription(weather.current.weather_code);
    return (
      <View style={[styles.weatherCard, Shadows.sm]}>
        <Text style={styles.weatherIcon}>{w.icon}</Text>
        <View>
          <Text style={styles.weatherTemp}>{Math.round(weather.current.temperature_2m)}°C</Text>
          <Text style={styles.weatherDesc}>{weather.district}</Text>
        </View>
        <View style={styles.weatherRight}>
          <Text style={styles.weatherDetail}>💧 {weather.current.relative_humidity_2m}%</Text>
          <Text style={styles.weatherDetail}>💨 {Math.round(weather.current.wind_speed_10m)}km/h</Text>
        </View>
      </View>
    );
  };

  // ── Market mini widget ─────────────────────────────────────────
  const renderMarketMini = () => {
    if (!market?.records?.length) return null;
    return (
      <View style={[styles.marketCard, Shadows.sm]}>
        <Text style={styles.cardIcon}>📊</Text>
        <View style={styles.marketInfo}>
          {market.records.slice(0, 2).map((p, i) => (
            <View key={i} style={styles.marketRow}>
              <Text style={styles.marketName} numberOfLines={1}>{p.commodity_kn || p.commodity}</Text>
              <Text style={styles.marketPrice}>₹{formatPrice(p.modal_price)}</Text>
            </View>
          ))}
        </View>
      </View>
    );
  };

  return (
    <View style={styles.container}>
      <NivettiHeader />

      <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
        {/* Farmer Greeting — only text on screen */}
        <Animated.View style={[styles.greetingRow, { opacity: greetingOpacity }]}>
          <Text style={styles.greeting}>🙏 ನಮಸ್ಕಾರ</Text>
          <Text style={styles.farmerName}>{farmer_name || 'ರೈತರೇ'}</Text>
        </Animated.View>

        {/* BIG MIC — Center Stage */}
        <View style={styles.micSection}>
          {isRecording && (
            <View style={styles.recordingInfo}>
              <View style={styles.recordingDot} />
              <Text style={styles.recordingTime}>
                {Math.floor(recordingSeconds / 60)}:{(recordingSeconds % 60).toString().padStart(2, '0')}
              </Text>
            </View>
          )}
          {isProcessing && (
            <View style={styles.recordingInfo}>
              <ActivityIndicator size="small" color={Colors.primary} />
              <Text style={styles.processingText}>ಯೋಚಿಸುತ್ತಿದೆ...</Text>
            </View>
          )}

          <Animated.View style={{ transform: [{ scale: Animated.multiply(pulseAnim, scaleAnim) }] }}>
            <TouchableOpacity
              onPress={handleMicPress}
              style={[styles.bigMic, isRecording && styles.bigMicRec]}
              activeOpacity={0.7}
              disabled={isProcessing}
            >
              <Text style={styles.bigMicIcon}>{isRecording ? '⏹' : '🎙️'}</Text>
            </TouchableOpacity>
          </Animated.View>

          <Text style={styles.micHint}>
            {isRecording ? 'ಮತ್ತೊಮ್ಮೆ ಒತ್ತಿ ನಿಲ್ಲಿಸಿ' : 'ಒತ್ತಿ ಮಾತನಾಡಿ'}
          </Text>
        </View>

        {/* Quick Actions — 4 icon buttons, NO labels */}
        <View style={styles.quickRow}>
          {quickActions.map((a) => (
            <TouchableOpacity
              key={a.key}
              style={[styles.quickBtn, Shadows.sm]}
              onPress={() => handleQuickAction(a.query, a.key)}
              disabled={!!quickLoading}
              activeOpacity={0.7}
            >
              {quickLoading === a.key ? (
                <ActivityIndicator size="small" color={Colors.primary} />
              ) : (
                <Text style={styles.quickIcon}>{a.icon}</Text>
              )}
            </TouchableOpacity>
          ))}
        </View>

        {/* Compact Widgets */}
        {widgetLoading && district ? (
          <ActivityIndicator size="small" color={Colors.primary} style={{ marginTop: Spacing.lg }} />
        ) : (
          <>
            {renderWeatherMini()}
            {renderMarketMini()}
          </>
        )}

        <View style={styles.footer}>
          <Text style={styles.footerText}>⚡ Nivetti Systems</Text>
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background },
  scroll: { paddingBottom: Spacing.xxl },
  // Greeting
  greetingRow: { alignItems: 'center', paddingTop: Spacing.xl, paddingBottom: Spacing.md },
  greeting: { fontSize: FontSize.xl, color: Colors.textSecondary },
  farmerName: { fontSize: 32, fontWeight: '900', color: Colors.primary, marginTop: 4 },
  // Big Mic
  micSection: { alignItems: 'center', paddingVertical: Spacing.xl },
  bigMic: {
    width: 100, height: 100, borderRadius: 50,
    backgroundColor: Colors.primary, alignItems: 'center', justifyContent: 'center',
    elevation: 8,
    shadowColor: Colors.primary, shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.35, shadowRadius: 12,
  },
  bigMicRec: { backgroundColor: '#E53935' },
  bigMicIcon: { fontSize: 40 },
  micHint: { fontSize: FontSize.sm, color: Colors.textMuted, marginTop: Spacing.sm },
  recordingInfo: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm, marginBottom: Spacing.md },
  recordingDot: { width: 12, height: 12, borderRadius: 6, backgroundColor: '#E53935' },
  recordingTime: { fontSize: FontSize.lg, fontWeight: '700', color: '#D84315', fontVariant: ['tabular-nums'] },
  processingText: { fontSize: FontSize.md, color: Colors.primary, fontWeight: '600' },
  // Quick Actions
  quickRow: { flexDirection: 'row', justifyContent: 'center', gap: Spacing.lg, paddingHorizontal: Spacing.xl, marginBottom: Spacing.xl },
  quickBtn: {
    width: 56, height: 56, borderRadius: 28,
    backgroundColor: Colors.surface, alignItems: 'center', justifyContent: 'center',
    borderWidth: 1, borderColor: Colors.border,
  },
  quickIcon: { fontSize: 26 },
  // Weather mini
  weatherCard: { flexDirection: 'row', alignItems: 'center', backgroundColor: Colors.surface, marginHorizontal: Spacing.md, marginBottom: Spacing.sm, borderRadius: BorderRadius.lg, padding: Spacing.md, borderWidth: 1, borderColor: Colors.border, gap: Spacing.md },
  weatherIcon: { fontSize: 36 },
  weatherTemp: { fontSize: FontSize.xl, fontWeight: '800', color: Colors.primaryDark },
  weatherDesc: { fontSize: FontSize.xs, color: Colors.textMuted },
  weatherRight: { marginLeft: 'auto' as any },
  weatherDetail: { fontSize: FontSize.xs, color: Colors.textSecondary },
  // Market mini
  marketCard: { flexDirection: 'row', alignItems: 'center', backgroundColor: Colors.surface, marginHorizontal: Spacing.md, marginBottom: Spacing.sm, borderRadius: BorderRadius.lg, padding: Spacing.md, borderWidth: 1, borderColor: Colors.border, gap: Spacing.md },
  cardIcon: { fontSize: 28 },
  marketInfo: { flex: 1, gap: 2 },
  marketRow: { flexDirection: 'row', justifyContent: 'space-between' },
  marketName: { fontSize: FontSize.sm, color: Colors.textPrimary, flex: 1 },
  marketPrice: { fontSize: FontSize.sm, fontWeight: '700', color: Colors.primary },
  // Footer
  footer: { alignItems: 'center', paddingVertical: Spacing.xl, marginTop: Spacing.md },
  footerText: { fontSize: FontSize.xs, color: Colors.textMuted },
});
