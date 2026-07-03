/**
 * Market Screen — Market Opportunity & Crop-centric Earning Intelligence.
 * Premium Swiggy/Zomato-style cards showing clear profit-making advice for farmers.
 */

import React, { useState, useMemo, useRef, useEffect } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity,
  Animated, Dimensions, StatusBar, ActivityIndicator,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { Colors, FontSize, Spacing, BorderRadius, Shadows } from '@/constants/theme';
import { useUserStore } from '@/stores/useUserStore';
import { t } from '@/constants/i18n';
import {
  DASHBOARD_CROPS,
  getCurrentSeason,
  SEASON_INFO,
} from '@/constants/agricultureData';
import {
  getDashboardData,
  type DashboardData,
} from '@/services/predictionService';
import { speakText } from '@/services/voiceService';

const { width } = Dimensions.get('window');

function formatCurrency(v: number): string {
  return `₹${v.toLocaleString('en-IN')}`;
}

export default function MarketScreen() {
  const [selectedCrop, setSelectedCrop] = useState<string>(DASHBOARD_CROPS[0].id);
  const [speaking, setSpeaking] = useState(false);
  const router = useRouter();
  const { district, preferred_language, farmer_name } = useUserStore();
  const isEn = preferred_language?.startsWith('en');
  const fadeAnim = useRef(new Animated.Value(1)).current;

  const season = getCurrentSeason();
  const seasonInfo = SEASON_INFO[season];

  const data = useMemo<DashboardData | null>(() => {
    return getDashboardData(selectedCrop);
  }, [selectedCrop]);

  const handleCropChange = (cropId: string) => {
    Animated.sequence([
      Animated.timing(fadeAnim, { toValue: 0.3, duration: 150, useNativeDriver: true }),
      Animated.timing(fadeAnim, { toValue: 1, duration: 300, useNativeDriver: true }),
    ]).start();
    setSelectedCrop(cropId);
  };

  if (!data) return null;

  const cropName = isEn ? data.crop.name_en : data.crop.name_kn;
  
  // Calculate simulated yield & revenues for the cards
  // Base yield is around 10-15 quintals per acre
  const expectedYield = 12; // 12 quintals total for default farm size
  const revenueToday = data.price.currentPrice * expectedYield;
  const revenueWait = data.price.predictedPrice * expectedYield;
  const extraEarning = revenueWait - revenueToday;
  const priceChangePercent = data.price.changePercent;

  // Determine mandi and transport details based on district
  const localMandi = district ? `${district} APMC` : 'Moodbidri Mandi';
  const distance = district ? '12 km' : '4 km';
  const transportCost = expectedYield * 120; // 120 Rs per quintal

  const handleHearReport = async () => {
    if (speaking) return;
    setSpeaking(true);

    const nameToUse = farmer_name ? (isEn ? `${farmer_name}` : `${farmer_name} ಅಣ್ಣಾ`) : (isEn ? 'anna' : 'ಅಣ್ಣಾ');
    const waitAdvice = priceChangePercent > 0 ? (isEn ? 'wait a few days' : 'ಕೆಲವು ದಿನ ಕಾಯಿರಿ') : (isEn ? 'sell today' : 'ಇಂದೇ ಮಾರಿ');

    // Short, punchy Mitra-style text — keeps Sarvam under 4s response time for consistent voice
    const reportEn = `${nameToUse}, ${data.crop.name_en} is at ${formatCurrency(data.price.currentPrice)} per quintal today. If you ${waitAdvice}, you can earn ${formatCurrency(extraEarning)} extra. Best market nearby is ${localMandi}.`;

    const reportKn = `${nameToUse}, ಇಂದು ${data.crop.name_kn} ಕ್ವಿಂಟಾಲ್‌ಗೆ ${formatCurrency(data.price.currentPrice)} ಇದೆ. ${waitAdvice} ${formatCurrency(extraEarning)} ಹೆಚ್ಚು ಗಳಿಸಬಹುದು. ಹತ್ತಿರದ ಮಾರುಕಟ್ಟೆ ${localMandi}.`;

    try {
      await speakText(isEn ? reportEn : reportKn, isEn ? 'en-IN' : 'kn-IN');
    } catch (e) {
      console.warn('Speech error:', e);
    } finally {
      setSpeaking(false);
    }
  };

  return (
    <View style={styles.container}>
      <StatusBar barStyle="light-content" />

      {/* Header */}
      <LinearGradient colors={['#168A45', '#2E7D32']} style={styles.header}>
        <View style={styles.headerRow}>
          <View style={styles.headerLeft}>
            <MaterialCommunityIcons name="store" size={24} color="#fff" />
            <Text style={styles.headerTitle}>{isEn ? 'Market Opportunity' : 'ಮಾರುಕಟ್ಟೆ ಅವಕಾಶ'}</Text>
          </View>
          <TouchableOpacity
            style={styles.analyticsBtn}
            onPress={() => router.push('/(tabs)/analytics')}
          >
            <MaterialCommunityIcons name="chart-areaspline" size={16} color="#fff" />
            <Text style={styles.analyticsBtnText}>{t('analytics')}</Text>
          </TouchableOpacity>
        </View>

        {/* Season & Location */}
        <View style={styles.seasonBadge}>
          <Text style={styles.seasonIcon}>{seasonInfo.icon}</Text>
          <Text style={styles.seasonText}>
            {isEn ? seasonInfo.name_en : seasonInfo.name_kn} • {seasonInfo.months}
          </Text>
          {district ? <Text style={styles.seasonDistrict}>📍 {district}</Text> : null}
        </View>
      </LinearGradient>

      <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
        {/* Horizontal Crop Selector */}
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.cropSelector}
        >
          {DASHBOARD_CROPS.map((crop) => {
            const active = crop.id === selectedCrop;
            return (
              <TouchableOpacity
                key={crop.id}
                style={[styles.cropChip, active && styles.cropChipActive]}
                onPress={() => handleCropChange(crop.id)}
                activeOpacity={0.8}
              >
                <Text style={styles.cropIcon}>{crop.icon}</Text>
                <Text style={[styles.cropChipText, active && styles.cropChipTextActive]}>
                  {isEn ? crop.name_en : crop.name_kn}
                </Text>
              </TouchableOpacity>
            );
          })}
        </ScrollView>

        <Animated.View style={{ opacity: fadeAnim, paddingHorizontal: Spacing.md }}>
          {/* Mitra Mascot Speech Bubble */}
          <View style={styles.mascotSection}>
            <View style={styles.mascotRow}>
              <View style={styles.mascotAvatarContainer}>
                <Text style={styles.mascotEmoji}>🌱</Text>
              </View>
              <View style={styles.mascotSpeechContainer}>
                <View style={styles.speechBubble}>
                  <View style={styles.speechArrow} />
                  <Text style={styles.mascotName}>{isEn ? 'Mitra' : 'ಮಿತ್ರ'}</Text>
                  <Text style={styles.speechText}>
                    {extraEarning > 0
                      ? (isEn
                          ? `💰 Good news, anna! Prices are moving up. Waiting 3 days can earn you an extra ${formatCurrency(extraEarning)}!`
                          : `💰 ಸಿಹಿ ಸುದ್ದಿ ಅಣ್ಣಾ! ಬೆಲೆಗಳು ಹೆಚ್ಚಾಗುತ್ತಿವೆ. 3 ದಿನ ಕಾಯ್ದರೆ ನಿಮಗೆ ${formatCurrency(extraEarning)} ಹೆಚ್ಚುವರಿ ಲಾಭ ಸಿಗಬಹುದು!`)
                      : (isEn
                          ? `⚠️ Market trends are fluctuating. It is safer to sell today to avoid price drops.`
                          : `⚠️ ಮಾರುಕಟ್ಟೆ ಬೆಲೆಗಳಲ್ಲಿ ಏರಿಳಿತವಿದೆ. ನಷ್ಟ ತಪ್ಪಿಸಲು ಇಂದೇ ಮಾರಾಟ ಮಾಡುವುದು ಸುರಕ್ಷಿತ ಅಣ್ಣಾ.`)}
                  </Text>
                </View>
              </View>
            </View>
          </View>

          {/* Earning Possibilities Card — High Energy Swiggy-Style */}
          <LinearGradient colors={['#102A43', '#1F3A52']} style={styles.earningCard}>
            <View style={styles.earningRow}>
              <View style={{ flex: 1 }}>
                <Text style={styles.earningLabel}>{isEn ? 'IF YOU SELL TODAY' : 'ಇಂದು ಮಾರಾಟ ಮಾಡಿದರೆ'}</Text>
                <Text style={styles.earningVal}>{formatCurrency(revenueToday)}</Text>
                <Text style={styles.earningSub}>
                  {isEn ? `Est: ${expectedYield} quintals @ ${formatCurrency(data.price.currentPrice)}/q` : `ಅಂದಾಜು ${expectedYield} ಕ್ವಿಂಟಾಲ್ @ ${formatCurrency(data.price.currentPrice)}/ಕ್ವಿಂ`}
                </Text>
              </View>
              <View style={styles.earningDivider} />
              <View style={{ flex: 1, paddingLeft: Spacing.md }}>
                <Text style={styles.earningLabel}>{isEn ? 'IF YOU WAIT 3 DAYS' : '3 ದಿನ ಕಾಯ್ದು ಮಾರಿದರೆ'}</Text>
                <Text style={[styles.earningVal, { color: Colors.accent }]}>{formatCurrency(revenueWait)}</Text>
                <Text style={styles.earningSub}>
                  {isEn ? `Est: ${expectedYield} quintals @ ${formatCurrency(data.price.predictedPrice)}/q` : `ಅಂದಾಜು ${expectedYield} ಕ್ವಿಂಟಾಲ್ @ ${formatCurrency(data.price.predictedPrice)}/ಕ್ವಿಂ`}
                </Text>
              </View>
            </View>

            {extraEarning > 0 && (
              <View style={styles.extraEarningBadge}>
                <MaterialCommunityIcons name="gift" size={16} color="#FFF" />
                <Text style={styles.extraEarningText}>
                  {isEn
                    ? `Extra profit chance: +${formatCurrency(extraEarning)}`
                    : `ಹೆಚ್ಚುವರಿ ಲಾಭದ ಅವಕಾಶ: +${formatCurrency(extraEarning)}`}
                </Text>
              </View>
            )}
          </LinearGradient>

          {/* Main 4 Visual Cards */}
          <Text style={styles.sectionLabel}>{isEn ? 'MARKET INSIGHTS' : 'ಮಾರುಕಟ್ಟೆ ಒಳನೋಟಗಳು'}</Text>
          <View style={styles.insightsGrid}>
            {/* Card 1: Sell Today */}
            <View style={styles.insightCard}>
              <View style={[styles.iconCircle, { backgroundColor: '#E8F5E9' }]}>
                <MaterialCommunityIcons name="cash-register" size={24} color={Colors.primary} />
              </View>
              <Text style={styles.cardHeader}>{isEn ? 'Sell Today' : 'ಇಂದಿನ ಮಾರಾಟ'}</Text>
              <Text style={styles.cardVal}>{formatCurrency(data.price.currentPrice)}</Text>
              <Text style={styles.cardSub}>{isEn ? 'per quintal' : 'ಪ್ರತಿ ಕ್ವಿಂಟಾಲ್‌ಗೆ'}</Text>
            </View>

            {/* Card 2: Wait */}
            <View style={styles.insightCard}>
              <View style={[styles.iconCircle, { backgroundColor: '#FFF8E1' }]}>
                <MaterialCommunityIcons
                  name={priceChangePercent >= 0 ? 'trending-up' : 'trending-down'}
                  size={24}
                  color={priceChangePercent >= 0 ? Colors.success : Colors.error}
                />
              </View>
              <Text style={styles.cardHeader}>{isEn ? 'Wait & Sell' : 'ಕಾಯ್ದು ಮಾರಾಟ'}</Text>
              <Text style={[styles.cardVal, { color: priceChangePercent >= 0 ? Colors.success : Colors.error }]}>
                {formatCurrency(data.price.predictedPrice)}
              </Text>
              <Text style={styles.cardSub}>
                {priceChangePercent >= 0 ? `+${priceChangePercent}%` : `${priceChangePercent}%`} {isEn ? 'estimated' : 'ಅಂದಾಜು'}
              </Text>
            </View>

            {/* Card 3: Best Nearby Market */}
            <View style={styles.insightCard}>
              <View style={[styles.iconCircle, { backgroundColor: '#E1F5FE' }]}>
                <MaterialCommunityIcons name="truck-delivery" size={24} color="#0288D1" />
              </View>
              <Text style={styles.cardHeader}>{isEn ? 'Best Mandi' : 'ಉತ್ತಮ ಮಾರುಕಟ್ಟೆ'}</Text>
              <Text style={styles.cardValText} numberOfLines={1}>{localMandi}</Text>
              <Text style={styles.cardSub}>{isEn ? `Dist: ${distance} • Transport: ₹${transportCost}` : `ದೂರ: ${distance} • ಸಾಗಣಿಕೆ ವೆಚ್ಚ: ₹${transportCost}`}</Text>
            </View>

            {/* Card 4: Risk */}
            <View style={styles.insightCard}>
              <View style={[styles.iconCircle, { backgroundColor: '#FFEBEE' }]}>
                <MaterialCommunityIcons name="alert-circle-outline" size={24} color={Colors.error} />
              </View>
              <Text style={styles.cardHeader}>{isEn ? 'Market Risk' : 'ಮಾರುಕಟ್ಟೆ ಅಪಾಯ'}</Text>
              <Text style={styles.cardValText}>{isEn ? 'Low Risk' : 'ಕಡಿಮೆ ಅಪಾಯ'}</Text>
              <Text style={styles.cardSub}>
                {isEn ? 'Low rain forecast: safe transport roads' : 'ಕಡಿಮೆ ಮಳೆ ಮುನ್ಸೂಚನೆ: ಸುರಕ್ಷಿತ ರಸ್ತೆ'}
              </Text>
            </View>
          </View>

          {/* Tone Disclaimer */}
          <Text style={styles.disclaimerText}>
            {isEn
              ? '💡 Waiting may help, but price can change. Check again tomorrow.'
              : '💡 ಕಾಯುವುದು ಉತ್ತಮ ಆದರೆ ಬೆಲೆ ಬದಲಾಗಬಹುದು. ನಾಳೆ ಮತ್ತೊಮ್ಮೆ ಪರಿಶೀಲಿಸಿ.'}
          </Text>

          {/* Hear advice button */}
          <TouchableOpacity
            style={[styles.speakReportBtn, speaking && styles.speakReportBtnDisabled]}
            onPress={handleHearReport}
            disabled={speaking}
          >
            {speaking ? (
              <ActivityIndicator color="#fff" size="small" />
            ) : (
              <>
                <MaterialCommunityIcons name="volume-high" size={22} color="#fff" style={{ marginRight: 8 }} />
                <Text style={styles.speakReportText}>
                  {isEn ? 'Hear Market Report' : 'ಮಾರುಕಟ್ಟೆ ವರದಿ ಕೇಳಿ'}
                </Text>
              </>
            )}
          </TouchableOpacity>

          {/* Quick Navigation to Farmer Journey */}
          <TouchableOpacity
            style={styles.journeyBtn}
            onPress={() => router.push('/journey')}
          >
            <MaterialCommunityIcons name="map-marker-path" size={20} color={Colors.primary} style={{ marginRight: 6 }} />
            <Text style={styles.journeyBtnText}>
              {isEn ? 'View My Farmer Journey' : 'ನನ್ನ ರೈತ ಪ್ರಯಾಣ ವೀಕ್ಷಿಸಿ'}
            </Text>
          </TouchableOpacity>

        </Animated.View>

        <Text style={styles.footer}>Nivetti Systems • ML Market Opportunities</Text>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background },
  header: { paddingTop: 52, paddingBottom: Spacing.md, paddingHorizontal: Spacing.lg },
  headerRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  headerLeft: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm },
  headerTitle: { fontSize: FontSize.xl, fontWeight: '900', color: '#fff' },
  analyticsBtn: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: Spacing.md, paddingVertical: 6, backgroundColor: 'rgba(255,255,255,0.2)', borderRadius: BorderRadius.full },
  analyticsBtnText: { fontSize: FontSize.sm, color: '#fff', fontWeight: '700' },

  seasonBadge: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm, marginTop: Spacing.sm, backgroundColor: 'rgba(255,255,255,0.12)', paddingVertical: 6, paddingHorizontal: Spacing.md, borderRadius: BorderRadius.full, alignSelf: 'flex-start' },
  seasonIcon: { fontSize: 14 },
  seasonText: { fontSize: FontSize.sm, color: 'rgba(255,255,255,0.9)', fontWeight: '600' },
  seasonDistrict: { fontSize: FontSize.sm, color: 'rgba(255,255,255,0.7)' },

  scroll: { paddingBottom: 100 },

  // Crop Selector
  cropSelector: { paddingHorizontal: Spacing.md, paddingVertical: Spacing.md, gap: Spacing.sm },
  cropChip: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    paddingVertical: 10, paddingHorizontal: 14,
    borderRadius: BorderRadius.full,
    backgroundColor: Colors.surface,
    borderWidth: 1.5, borderColor: Colors.border,
    ...Shadows.sm,
  },
  cropChipActive: { borderColor: Colors.primary, backgroundColor: Colors.primarySoft },
  cropIcon: { fontSize: 18 },
  cropChipText: { fontSize: FontSize.sm, color: Colors.textSecondary, fontWeight: '600' },
  cropChipTextActive: { color: Colors.primary, fontWeight: '800' },

  // Mascot Section
  mascotSection: { marginBottom: Spacing.md },
  mascotRow: { flexDirection: 'row', gap: Spacing.sm },
  mascotAvatarContainer: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: '#E8F5E9',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1.5,
    borderColor: Colors.primary,
  },
  mascotEmoji: { fontSize: 24 },
  mascotSpeechContainer: { flex: 1 },
  speechBubble: {
    backgroundColor: '#FFF',
    borderWidth: 1.5,
    borderColor: '#E2E8F0',
    borderRadius: BorderRadius.lg,
    padding: Spacing.md,
    ...Shadows.sm,
  },
  speechArrow: {
    position: 'absolute',
    left: -8,
    top: 14,
    width: 0,
    height: 0,
    borderTopWidth: 6,
    borderTopColor: 'transparent',
    borderBottomWidth: 6,
    borderBottomColor: 'transparent',
    borderRightWidth: 8,
    borderRightColor: '#FFF',
  },
  mascotName: { fontSize: FontSize.xs, fontWeight: '800', color: Colors.primary, marginBottom: 2 },
  speechText: { fontSize: FontSize.sm, color: Colors.textPrimary, lineHeight: 18 },

  // Earning Card
  earningCard: {
    borderRadius: BorderRadius.xl,
    padding: Spacing.lg,
    marginBottom: Spacing.md,
    ...Shadows.md,
  },
  earningRow: { flexDirection: 'row', justifyContent: 'space-between' },
  earningLabel: { fontSize: 10, color: 'rgba(255,255,255,0.6)', fontWeight: '700', letterSpacing: 0.5 },
  earningVal: { fontSize: FontSize.xl, fontWeight: '900', color: '#fff', marginTop: 4 },
  earningSub: { fontSize: 10, color: 'rgba(255,255,255,0.5)', marginTop: 2 },
  earningDivider: { width: 1, backgroundColor: 'rgba(255,255,255,0.15)', marginVertical: 4 },
  extraEarningBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    backgroundColor: '#FF8F00',
    borderRadius: BorderRadius.md,
    paddingVertical: 6,
    marginTop: Spacing.md,
  },
  extraEarningText: { fontSize: FontSize.xs, color: '#fff', fontWeight: '800' },

  // Grid
  sectionLabel: { fontSize: FontSize.xs, color: Colors.textMuted, fontWeight: '800', letterSpacing: 0.5, marginBottom: Spacing.sm },
  insightsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.sm,
  },
  insightCard: {
    width: (width - Spacing.md * 2 - Spacing.sm) / 2 - 1,
    backgroundColor: Colors.surface,
    borderRadius: BorderRadius.lg,
    padding: Spacing.md,
    borderWidth: 1,
    borderColor: Colors.border,
    ...Shadows.sm,
  },
  iconCircle: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: Spacing.sm,
  },
  cardHeader: { fontSize: FontSize.xs, color: Colors.textMuted, fontWeight: '700' },
  cardVal: { fontSize: FontSize.lg, fontWeight: '900', color: Colors.textPrimary, marginTop: 2 },
  cardValText: { fontSize: FontSize.sm, fontWeight: '800', color: Colors.textPrimary, marginTop: 4 },
  cardSub: { fontSize: 10, color: Colors.textMuted, marginTop: 2 },

  disclaimerText: {
    fontSize: FontSize.xs,
    color: Colors.textSecondary,
    fontStyle: 'italic',
    textAlign: 'center',
    marginVertical: Spacing.md,
    fontWeight: '500',
  },

  speakReportBtn: {
    backgroundColor: Colors.primary,
    borderRadius: BorderRadius.lg,
    paddingVertical: 14,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    ...Shadows.md,
  },
  speakReportBtnDisabled: { opacity: 0.6 },
  speakReportText: { fontSize: FontSize.md, fontWeight: '800', color: '#fff' },

  journeyBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 12,
    marginTop: Spacing.sm,
    backgroundColor: 'rgba(22, 138, 69, 0.08)',
    borderRadius: BorderRadius.lg,
  },
  journeyBtnText: { fontSize: FontSize.sm, color: Colors.primary, fontWeight: '700' },

  footer: { fontSize: FontSize.xs, color: Colors.textMuted, textAlign: 'center', marginTop: Spacing.xl, fontStyle: 'italic' },
});
