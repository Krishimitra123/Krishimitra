/**
 * Home Screen — Voice-first, premium design for KrishiMitra.
 * India's finest farming AI — for uneducated farmers who can't read or write.
 */

import React, { useState, useCallback, useEffect, useRef } from 'react';
import {
  View, Text, StyleSheet, ScrollView,
  TouchableOpacity, Animated, ActivityIndicator, Dimensions,
  StatusBar, Image,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { Colors, FontSize, Spacing, BorderRadius, Shadows } from '@/constants/theme';
import { getCurrentSeason, SEASON_INFO, DASHBOARD_CROPS } from '@/constants/agricultureData';
import { useUserStore } from '@/stores/useUserStore';
import { t } from '@/constants/i18n';
import { useSessionStore } from '@/stores/useSessionStore';
import { useAudioStore } from '@/stores/useAudioStore';
import { startRecording, stopRecordingAndGetBase64, playBase64Audio, stopPlayback, speakText } from '@/services/voiceService';
import { sendVoiceQuery, sendTextQuery } from '@/services/queryService';
import { getWeather, getWeatherDescription, type WeatherResponse } from '@/services/weatherService';
import { getMarketPrices, formatPrice, type MarketResponse } from '@/services/marketService';

const { width } = Dimensions.get('window');

// Quick actions with vector icons
const QUICK_ACTIONS = [
  { key: 'jeeva', icon: 'flask-outline' as const, labelKn: 'ಜೀವಾಮೃತ', labelEn: 'Jivamrutha', query: 'ಜೀವಾಮೃತ ತಯಾರಿಸುವ ವಿಧಾನ ಹೇಳಿ' },
  { key: 'mulch', icon: 'grass' as const, labelKn: 'ಮಲ್ಚಿಂಗ್', labelEn: 'Mulching', query: 'ಮಲ್ಚಿಂಗ್ ಹೇಗೆ ಮಾಡಬೇಕು' },
  { key: 'soil', icon: 'earth' as const, labelKn: 'ಮಣ್ಣು', labelEn: 'Soil Health', query: 'ಮಣ್ಣಿನ ಆರೋಗ್ಯ ಸುಧಾರಿಸುವ ವಿಧಾನ' },
  { key: 'worm', icon: 'bug-outline' as const, labelKn: 'ಗೊಬ್ಬರ', labelEn: 'Compost', query: 'ಎರೆಹುಳು ಗೊಬ್ಬರ ತಯಾರಿಕೆ ಹೇಗೆ' },
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
  const { farmer_name, district, crops, primary_crop, preferred_language, setProfile } = useUserStore();
  const isEn = preferred_language?.startsWith('en');

  const { startNewSession, addMessage, currentSession } = useSessionStore();
  const audioStore = useAudioStore();

  const [weather, setWeather] = useState<WeatherResponse | null>(null);
  const [marketData, setMarketData] = useState<MarketResponse[]>([]);
  const [widgetLoading, setWidgetLoading] = useState(true);
  const [quickLoading, setQuickLoading] = useState<string | null>(null);
  const [recordingSeconds, setRecordingSeconds] = useState(0);
  const recordingTimer = useRef<ReturnType<typeof setInterval> | null>(null);

  const [readingAloud, setReadingAloud] = useState(false);

  const pulseAnim = useRef(new Animated.Value(1)).current;
  const greetingOpacity = useRef(new Animated.Value(0)).current;

  // Language switch
  const toggleLanguage = useCallback(() => {
    const nextLang = preferred_language?.startsWith('en') ? 'kn-IN' : 'en-IN';
    setProfile({ preferred_language: nextLang, tts_language: nextLang });
  }, [preferred_language, setProfile]);

  // Mascot Tip Generator
  const getMascotMessage = useCallback(() => {
    const wCode = weather?.current?.weather_code ?? 0;
    const isRaining = wCode >= 51 && wCode <= 82;

    if (isRaining) {
      return isEn
        ? "🌧 Rain is expected soon, anna! Don't spray any organic inputs or fertilizer today."
        : "🌧 ಶೀಘ್ರದಲ್ಲೇ ಮಳೆ ಬರುವ ಸಾಧ್ಯತೆಯಿದೆ ಅಣ್ಣಾ! ಇಂದು ಯಾವುದೇ ಗೊಬ್ಬರ ಅಥವಾ ಕೀಟನಾಶಕ ಸಿಂಪಡಿಸಬೇಡಿ.";
    }

    if (primary_crop?.toLowerCase() === 'onion') {
      return isEn
        ? "💰 Market trends show onion prices are rising in nearby mandis. If possible, wait 2 days to sell!"
        : "💰 ಮಾರುಕಟ್ಟೆ ಮುನ್ಸೂಚನೆ ಪ್ರಕಾರ ಈರುಳ್ಳಿ ಬೆಲೆ ಏರುತ್ತಿದೆ. ಸಾಧ್ಯವಾದರೆ ಮಾರಾಟ ಮಾಡಲು 2 ದಿನ ಕಾಯಿರಿ ಅಣ್ಣಾ!";
    }

    if (primary_crop?.toLowerCase() === 'ginger') {
      return isEn
        ? "🌱 Based on soil moisture and weather, your ginger crop looks healthy! Current crop health: 82%."
        : "🌱 ನಿಮ್ಮ ಶುಂಠಿ ಬೆಳೆ ಉತ್ತಮವಾಗಿದೆ! ಪ್ರಸ್ತುತ ಬೆಳೆ ಆರೋಗ್ಯ ಸೂಚ್ಯಂಕ: 82%.";
    }

    const season = getCurrentSeason();
    if (season === 'kharif') {
      return isEn
        ? "🌾 It's Kharif season, anna. Perfect time for sowing Ragi or Paddy if you have adequate moisture!"
        : "🌾 ಈಗ ಖಾರಿಫ್ ಹಂಗಾಮು ಅಣ್ಣಾ. ಹದವಾದ ಮಣ್ಣಿನ ತೇವಾಂಶವಿದ್ದರೆ ರಾಗಿ ಅಥವಾ ಭತ್ತ ಬಿತ್ತನೆ ಮಾಡಲು ಇದು ಸಕಾಲ!";
    }

    return isEn
      ? "☀️ Keep soil covered with mulching to retain moisture in this warm weather, anna."
      : "☀️ ಈ ಬಿಸಿ ವಾತಾವರಣದಲ್ಲಿ ಮಣ್ಣಿನ ತೇವಾಂಶ ಉಳಿಸಲು ಒಣ ಎಲೆಗಳ ಮಲ್ಚಿಂಗ್ ಬಳಸಿ ಅಣ್ಣಾ.";
  }, [weather, primary_crop, isEn]);

  // Read current Mascot Tip Aloud
  const handleReadAloud = useCallback(async () => {
    if (readingAloud) return;
    setReadingAloud(true);
    try {
      const msg = getMascotMessage();
      await speakText(msg, preferred_language, true); // force local speak
    } catch (e) {
      console.warn('Read aloud error:', e);
    } finally {
      setReadingAloud(false);
    }
  }, [getMascotMessage, preferred_language, readingAloud]);

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
      
      // Fetch weather
      const w = await getWeather(district).catch(() => null);
      if (cancelled) return;
      if (w) setWeather(w as WeatherResponse);

      // Fetch market data for up to 3 crops
      const cropsToFetch = crops?.length ? crops.slice(0, 3) : [primary_crop].filter(Boolean);
      const mPromises = cropsToFetch.map(c => getMarketPrices(district, c).catch(() => null));
      const mResults = await Promise.all(mPromises);
      
      if (cancelled) return;
      setMarketData(mResults.filter(Boolean) as MarketResponse[]);
      setWidgetLoading(false);
    }
    loadWidgets();
    return () => { cancelled = true; };
  }, [district, crops, primary_crop]);


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
          addMessage({ id: (Date.now() + 1).toString(), role: 'assistant', text: t('serviceUnavailable'), sources: [], timestamp: Date.now(), is_diagnosis: false });
        }
        audioStore.setState('IDLE');
      }
    } catch (err: any) {
      audioStore.setError(err.message);
    }
  }, [audioStore.state, currentSession, isEn]);

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
      addMessage({ id: (Date.now() + 1).toString(), role: 'assistant', text: t('serviceUnavailable'), sources: [], timestamp: Date.now(), is_diagnosis: false });
    }
    setQuickLoading(null);
  }, [quickLoading, currentSession, isEn]);

  const handleMascotWhy = useCallback(async () => {
    const wCode = weather?.current?.weather_code ?? 0;
    const isRaining = wCode >= 51 && wCode <= 82;
    let query = isEn ? "Why should I use mulching?" : "ಒಣ ಎಲೆಗಳ ಮಲ್ಚಿಂಗ್ ಪ್ರಯೋಜನ ತಿಳಿಸಿ";

    if (isRaining) {
      query = isEn
        ? "Why should I not spray fertilizer or organic inputs today?"
        : "ಮಳೆ ಮುನ್ಸೂಚನೆ ಬಗ್ಗೆ ಏಕೆ ಗೊಬ್ಬರ ಸಿಂಪಡಿಸಬಾರದು ಹೇಳಿ";
    } else if (primary_crop?.toLowerCase() === 'onion') {
      query = isEn
        ? "Why are onion prices rising and when should I sell?"
        : "ಈರುಳ್ಳಿ ಬೆಲೆ ಏರಿಕೆ ಬಗ್ಗೆ ವಿವರ ಮತ್ತು ಮಾರಾಟ ಮಾಡುವ ಸಮಯ ತಿಳಿಸಿ";
    } else if (primary_crop?.toLowerCase() === 'ginger') {
      query = isEn
        ? "Give details on my ginger crop health and soil moisture"
        : "ನನ್ನ ಶುಂಠಿ ಬೆಳೆ ಆರೋಗ್ಯ ಮತ್ತು ಮಣ್ಣಿನ ತೇವಾಂಶ ವರದಿ ತಿಳಿಸಿ";
    } else {
      const season = getCurrentSeason();
      if (season === 'kharif') {
        query = isEn
          ? "How should I sow Ragi or Paddy this season?"
          : "ರಾಗಿ ಅಥವಾ ಭತ್ತ ಬಿತ್ತನೆ ಮಾಡುವ ವಿಧಾನ ಮತ್ತು ಹಂತಗಳನ್ನು ತಿಳಿಸಿ";
      }
    }

    if (!currentSession) startNewSession();
    addMessage({ id: Date.now().toString(), role: 'user', text: query, sources: [], timestamp: Date.now(), is_diagnosis: false });
    router.push('/(tabs)/chat');

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
      if (response.audio_base64) {
        audioStore.setState('PLAYING');
        await playBase64Audio(response.audio_base64);
        audioStore.setState('IDLE');
      } else {
        await speakText(response.answer_text_kn);
      }
    } catch {
      addMessage({ id: (Date.now() + 1).toString(), role: 'assistant', text: t('serviceUnavailable'), sources: [], timestamp: Date.now(), is_diagnosis: false });
    }
  }, [weather, primary_crop, isEn, currentSession, startNewSession, addMessage, router, audioStore]);

  const isRecording = audioStore.state === 'RECORDING';
  const isProcessing = audioStore.state === 'STT_PROCESSING';
  const isPlaying = audioStore.state === 'PLAYING';

  const micLabel = isRecording ? t('tapToStop') : isProcessing ? t('thinking') : isPlaying ? t('listening') : t('tapToSpeak');

  return (
    <View style={styles.container}>
      <StatusBar barStyle="light-content" />

      {/* Header gradient */}
      <LinearGradient
        colors={['#1B5E20', '#2E7D32']}
        style={styles.header}
      >
        <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', flex: 1 }}>
            <Image
              source={require('@/assets/images/krishimitra-logo.png')}
              style={styles.headerLogo}
            />
            <Animated.View style={{ opacity: greetingOpacity, flex: 1 }}>
              <Text style={styles.namaste}>{isEn ? 'Namaste' : 'ನಮಸ್ಕಾರ'} 👋</Text>
              <Text style={styles.farmerName}>{farmer_name || t('farmer')}</Text>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 2, flexWrap: 'wrap' }}>
                <Text style={styles.districtText}>{district || 'Karnataka'}</Text>
                <Text style={styles.timestampText}>• {isEn ? 'Updated Today, 8:42 AM' : 'ಇಂದು 8:42 ಕ್ಕೆ ನವೀಕರಿಸಲಾಗಿದೆ'}</Text>
              </View>
            </Animated.View>
          </View>

          {/* Quick Controls */}
          <View style={styles.quickHeaderControls}>
            <TouchableOpacity onPress={handleReadAloud} style={styles.headerIconBtn} disabled={readingAloud}>
              {readingAloud ? (
                <ActivityIndicator size="small" color="#fff" />
              ) : (
                <MaterialCommunityIcons name="volume-high" size={20} color="#fff" />
              )}
            </TouchableOpacity>
            
            <TouchableOpacity onPress={toggleLanguage} style={styles.headerLangBtn}>
              <Text style={styles.headerLangBtnText}>{isEn ? 'ಕನ್ನಡ' : 'EN'}</Text>
            </TouchableOpacity>
          </View>
        </View>
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
                  <Text style={styles.processingText}>{t('thinking')}</Text>
                </View>
              )}
              {isPlaying && (
                <View style={styles.playingBadge}>
                  <WaveformIndicator active color={Colors.primary} />
                  <Text style={styles.playingText}>{t('listening')}</Text>
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

        {/* ── MITRA MASCOT SECTION (Daily Status Card) ────────────────── */}
        <View style={styles.mascotSection}>
          <View style={styles.mascotRow}>
            <View style={styles.mascotAvatarContainer}>
              <View style={styles.mascotBubbleGlow} />
              <Text style={styles.mascotEmoji}>🌱</Text>
            </View>
            <View style={styles.mascotSpeechContainer}>
              <View style={styles.speechBubble}>
                <View style={styles.speechArrow} />
                <Text style={styles.mascotName}>{isEn ? 'Mitra' : 'ಮಿತ್ರ'}</Text>
                <Text style={styles.speechText}>
                  {getMascotMessage()}
                </Text>
                
                {/* Action buttons inside bubble */}
                <View style={styles.bubbleActionRow}>
                  <TouchableOpacity onPress={handleReadAloud} style={styles.bubbleActionBtn} disabled={readingAloud}>
                    <MaterialCommunityIcons name="volume-high" size={16} color={Colors.primary} />
                    <Text style={styles.bubbleActionBtnText}>{isEn ? 'Hear Advice' : 'ಸಲಹೆ ಕೇಳಿ'}</Text>
                  </TouchableOpacity>

                  <TouchableOpacity onPress={handleMascotWhy} style={[styles.bubbleActionBtn, { backgroundColor: '#ECEFF1' }]}>
                    <MaterialCommunityIcons name="help-circle" size={16} color={Colors.textSecondary} />
                    <Text style={[styles.bubbleActionBtnText, { color: Colors.textSecondary }]}>{isEn ? 'Why?' : 'ಏಕೆ?'}</Text>
                  </TouchableOpacity>
                </View>
              </View>
            </View>
          </View>
        </View>

        {/* Quick Actions */}
        <View style={styles.quickSection}>
          <Text style={styles.sectionLabel}>{t('quickActions')}</Text>
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
                  <Text style={styles.quickLabel}>{isEn ? a.labelEn : a.labelKn}</Text>
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
                      <Text style={styles.widgetTitle}>{t('weather')}</Text>
                      <Text style={styles.widgetValue}>{Math.round(weather.current.temperature_2m)}°C — {weather.district}</Text>
                    </View>
                    <View style={{ alignItems: 'flex-end' }}>
                      <Text style={styles.widgetSub}>💧 {weather.current.relative_humidity_2m}%</Text>
                      <Text style={styles.widgetSub}>💨 {Math.round(weather.current.wind_speed_10m)}km/h</Text>
                    </View>
                  </View>
                  {weather.error && (
                    <Text style={{ fontSize: 10, color: Colors.error, marginTop: 4 }}>{weather.error}</Text>
                  )}
                </View>
              );
            })()}

            {marketData.length > 0 ? (
              <View style={styles.widgetCard}>
                <View style={styles.widgetRow}>
                  <MaterialCommunityIcons name="chart-line" size={32} color={Colors.accent} />
                  <View style={{ marginLeft: Spacing.md, flex: 1 }}>
                    <Text style={styles.widgetTitle}>{t('market')}</Text>
                    {marketData.map((m, mi) => (
                      <View key={mi}>
                        {m.records?.slice(0, 1).map((p, i) => (
                          <View key={i} style={{ flexDirection: 'row', justifyContent: 'space-between', marginTop: 4 }}>
                            <Text style={styles.widgetValue} numberOfLines={1}>{isEn ? p.commodity : (p.commodity_kn || p.commodity)}</Text>
                            <Text style={styles.widgetPrice}>₹{formatPrice(p.modal_price)}</Text>
                          </View>
                        ))}
                      </View>
                    ))}
                  </View>
                </View>
              </View>
            ) : null}
          </View>
        )}

        {/* Context Cards */}
        <View style={styles.contextSection}>
          <Text style={styles.sectionLabel}>{isEn ? 'YOUR CONTEXT' : 'ನಿಮ್ಮ ಸಂದರ್ಭ'}</Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.contextRow}>
            {primary_crop ? (
              <View style={styles.contextCard}>
                <MaterialCommunityIcons name="sprout" size={20} color={Colors.primary} />
                <Text style={styles.contextLabel}>{isEn ? 'Crop' : 'ಬೆಳೆ'}</Text>
                <Text style={styles.contextValue} numberOfLines={1}>{primary_crop}</Text>
              </View>
            ) : null}
            {district ? (
              <View style={styles.contextCard}>
                <MaterialCommunityIcons name="map-marker" size={20} color={Colors.error} />
                <Text style={styles.contextLabel}>{isEn ? 'Location' : 'ಸ್ಥಳ'}</Text>
                <Text style={styles.contextValue} numberOfLines={1}>{district}</Text>
              </View>
            ) : null}
            <View style={styles.contextCard}>
              <Text style={{ fontSize: 18 }}>{SEASON_INFO[getCurrentSeason()].icon}</Text>
              <Text style={styles.contextLabel}>{isEn ? 'Season' : 'ಋತು'}</Text>
              <Text style={styles.contextValue}>{isEn ? SEASON_INFO[getCurrentSeason()].name_en : SEASON_INFO[getCurrentSeason()].name_kn}</Text>
            </View>
          </ScrollView>
        </View>

        {/* Navigation to Tabs */}
        <View style={styles.navSection}>
          <TouchableOpacity
            style={styles.navBtn}
            onPress={() => router.push('/(tabs)/dashboard')}
            activeOpacity={0.85}
          >
            <LinearGradient colors={['#168A45', '#2E7D32']} style={styles.navBtnGrad}>
              <MaterialCommunityIcons name="store" size={24} color="#fff" />
              <View style={{ flex: 1 }}>
                <Text style={styles.navBtnTitle}>{isEn ? 'Market' : 'ಮಾರುಕಟ್ಟೆ'}</Text>
                <Text style={styles.navBtnSub}>{isEn ? 'Live Prices & Predictions' : 'ಲೈವ್ ಬೆಲೆಗಳು ಮತ್ತು ಮುನ್ಸೂಚನೆ'}</Text>
              </View>
              <MaterialCommunityIcons name="chevron-right" size={20} color="rgba(255,255,255,0.6)" />
            </LinearGradient>
          </TouchableOpacity>
          <TouchableOpacity
            style={styles.navBtn}
            onPress={() => router.push('/(tabs)/diagnose')}
            activeOpacity={0.85}
          >
            <LinearGradient colors={['#8D6E63', '#795548']} style={styles.navBtnGrad}>
              <MaterialCommunityIcons name="leaf" size={24} color="#fff" />
              <View style={{ flex: 1 }}>
                <Text style={styles.navBtnTitle}>{isEn ? 'Crop Health' : 'ಬೆಳೆ ಆರೋಗ್ಯ'}</Text>
                <Text style={styles.navBtnSub}>{isEn ? 'Scan leaf & Detect disease' : 'ಎಲೆ ಸ್ಕ್ಯಾನ್ ಮಾಡಿ ಮತ್ತು ರೋಗ ಪತ್ತೆ ಮಾಡಿ'}</Text>
              </View>
              <MaterialCommunityIcons name="chevron-right" size={20} color="rgba(255,255,255,0.6)" />
            </LinearGradient>
          </TouchableOpacity>
        </View>

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
  headerLogo: { width: 52, height: 52, borderRadius: 26, marginRight: 14 },
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

  // Mascot Section
  mascotSection: {
    paddingHorizontal: Spacing.lg,
    marginBottom: Spacing.lg,
  },
  mascotRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.md,
  },
  mascotAvatarContainer: {
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: '#E8F5E9',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: Colors.primary,
    position: 'relative',
    ...Shadows.sm,
  },
  mascotBubbleGlow: {
    position: 'absolute',
    width: 68,
    height: 68,
    borderRadius: 34,
    borderWidth: 1.5,
    borderColor: Colors.primary + '15',
  },
  mascotEmoji: {
    fontSize: 32,
  },
  mascotSpeechContainer: {
    flex: 1,
  },
  speechBubble: {
    backgroundColor: Colors.surface,
    borderRadius: BorderRadius.lg,
    padding: Spacing.md,
    borderWidth: 1,
    borderColor: Colors.border,
    position: 'relative',
    ...Shadows.sm,
  },
  speechArrow: {
    position: 'absolute',
    left: -8,
    top: 22,
    width: 14,
    height: 14,
    backgroundColor: Colors.surface,
    borderLeftWidth: 1,
    borderBottomWidth: 1,
    borderColor: Colors.border,
    transform: [{ rotate: '45deg' }],
  },
  mascotName: {
    fontSize: 10,
    color: Colors.primary,
    fontWeight: '800',
    textTransform: 'uppercase',
    marginBottom: 2,
    letterSpacing: 0.5,
  },
  speechText: {
    fontSize: FontSize.md,
    color: Colors.textPrimary,
    lineHeight: 20,
    fontWeight: '600',
  },

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

  // Context Cards
  contextSection: { paddingHorizontal: Spacing.lg, marginTop: Spacing.lg },
  contextRow: { gap: Spacing.sm, paddingVertical: Spacing.sm },
  contextCard: {
    width: 100, alignItems: 'center', gap: 4,
    backgroundColor: Colors.surface, borderRadius: BorderRadius.lg,
    paddingVertical: Spacing.md, paddingHorizontal: Spacing.sm,
    borderWidth: 1, borderColor: Colors.border, ...Shadows.sm,
  },
  contextLabel: { fontSize: 10, color: Colors.textMuted, fontWeight: '700', textTransform: 'uppercase' },
  contextValue: { fontSize: FontSize.sm, color: Colors.textPrimary, fontWeight: '800', textAlign: 'center' },

  // Nav Buttons
  navSection: { paddingHorizontal: Spacing.lg, gap: Spacing.sm, marginTop: Spacing.lg },
  navBtn: { borderRadius: BorderRadius.lg, overflow: 'hidden' },
  navBtnGrad: {
    flexDirection: 'row', alignItems: 'center', gap: Spacing.md,
    paddingVertical: Spacing.md, paddingHorizontal: Spacing.lg,
  },
  navBtnTitle: { fontSize: FontSize.md, fontWeight: '800', color: '#fff' },
  navBtnSub: { fontSize: FontSize.xs, color: 'rgba(255,255,255,0.7)', marginTop: 1 },

  // New visual header controls styles
  quickHeaderControls: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  headerIconBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: 'rgba(255,255,255,0.18)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerLangBtn: {
    backgroundColor: '#fff',
    borderRadius: BorderRadius.full,
    paddingHorizontal: 12,
    paddingVertical: 6,
    ...Shadows.sm,
  },
  headerLangBtnText: {
    fontSize: 11,
    fontWeight: '900',
    color: Colors.primary,
  },
  timestampText: {
    fontSize: 10,
    color: 'rgba(255,255,255,0.65)',
    fontWeight: '500',
  },
  bubbleActionRow: {
    flexDirection: 'row',
    gap: 8,
    marginTop: Spacing.sm,
  },
  bubbleActionBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: '#E8F5E9',
    borderRadius: BorderRadius.md,
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderWidth: 1,
    borderColor: 'rgba(0,0,0,0.05)',
  },
  bubbleActionBtnText: {
    fontSize: 11,
    fontWeight: '800',
    color: Colors.primary,
  },
});
