/**
 * Analytics Screen — 4-chart analytics suite.
 * Yield Trend, Bubble Comparison, Seasonal Heatmap, Price Forecast.
 * All powered by predictionService + react-native-svg charts.
 */

import React, { useState, useMemo } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity,
  Dimensions, StatusBar,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { Colors, FontSize, Spacing, BorderRadius, Shadows } from '@/constants/theme';
import { useUserStore } from '@/stores/useUserStore';
import { t } from '@/constants/i18n';
import {
  DASHBOARD_CROPS,
  YIELD_HISTORY,
  YIELD_YEARS,
  SEASONAL_PERFORMANCE,
  MONTHS_EN,
  MONTHS_KN,
} from '@/constants/agricultureData';
import {
  predictPrice,
  compareCrops,
} from '@/services/predictionService';
import LineChart, { type LineSeries } from '@/components/charts/LineChart';
import BubbleChart, { type BubbleData } from '@/components/charts/BubbleChart';
import HeatMap from '@/components/charts/HeatMap';
import AreaChart from '@/components/charts/AreaChart';

import { useRouter } from 'expo-router';

const { width } = Dimensions.get('window');

export default function AnalyticsScreen() {
  const router = useRouter();
  const { preferred_language } = useUserStore();
  const isEn = preferred_language?.startsWith('en');
  const [selectedCrops, setSelectedCrops] = useState<string[]>(['potato', 'ragi', 'ginger', 'sugarcane']);
  const [forecastCrop, setForecastCrop] = useState<string>('potato');

  const months = isEn ? MONTHS_EN : MONTHS_KN;

  // ── 1. Yield Trend Data ─────────────────────────────────────
  const yieldSeries = useMemo<LineSeries[]>(() => {
    return selectedCrops
      .map(id => {
        const crop = DASHBOARD_CROPS.find(c => c.id === id);
        const data = YIELD_HISTORY[id];
        if (!crop || !data) return null;
        return {
          label: isEn ? crop.name_en : crop.name_kn,
          color: crop.color,
          data,
        };
      })
      .filter(Boolean) as LineSeries[];
  }, [selectedCrops, isEn]);

  const yieldLabels = YIELD_YEARS.map(y => `'${String(y).slice(2)}`);

  // ── 2. Bubble Comparison Data ───────────────────────────────
  const bubbleData = useMemo<BubbleData[]>(() => {
    const comparisons = compareCrops();
    return comparisons.map(c => ({
      label: isEn ? c.name_en : c.name_kn,
      icon: c.icon,
      x: c.riskScore,
      y: c.profitScore,
      size: c.bubbleSize,
      color: c.color,
    }));
  }, [isEn]);

  // ── 3. Heatmap Data ─────────────────────────────────────────
  const heatmapRows = useMemo(() => {
    return selectedCrops
      .map(id => {
        const crop = DASHBOARD_CROPS.find(c => c.id === id);
        const data = SEASONAL_PERFORMANCE[id];
        if (!crop || !data) return null;
        return {
          label: `${crop.icon} ${isEn ? crop.name_en : crop.name_kn}`,
          data,
        };
      })
      .filter(Boolean) as { label: string; data: number[] }[];
  }, [selectedCrops, isEn]);

  // ── 4. Price Forecast Data ──────────────────────────────────
  const forecastData = useMemo(() => {
    const pred = predictPrice(forecastCrop, 6);
    const crop = DASHBOARD_CROPS.find(c => c.id === forecastCrop);

    // Combine last 3 historical + 6 forecast
    const history = [pred.lastYearPrice, pred.currentPrice];
    const combined = [...history, ...pred.monthlyForecast];
    const labels = ['Last Yr', 'Now', '+1mo', '+2mo', '+3mo', '+4mo', '+5mo', '+6mo'];

    return {
      data: combined,
      labels,
      crop,
      prediction: pred,
      currentIndex: 1,  // "Now" position
    };
  }, [forecastCrop]);

  const toggleCrop = (id: string) => {
    setSelectedCrops(prev => {
      if (prev.includes(id)) {
        if (prev.length <= 1) return prev; // Keep at least 1
        return prev.filter(c => c !== id);
      }
      if (prev.length >= 5) return prev; // Max 5
      return [...prev, id];
    });
  };

  return (
    <View style={styles.container}>
      <StatusBar barStyle="light-content" />

      {/* Header */}
      <LinearGradient colors={['#0D47A1', '#1565C0']} style={styles.header}>
        <View style={styles.headerRow}>
          <TouchableOpacity onPress={() => router.back()} style={{ marginRight: 12 }}>
            <MaterialCommunityIcons name="arrow-left" size={24} color="#fff" />
          </TouchableOpacity>
          <MaterialCommunityIcons name="chart-areaspline" size={22} color="#fff" style={{ marginRight: 8 }} />
          <Text style={styles.headerTitle}>{t('analytics')}</Text>
        </View>
      </LinearGradient>

      <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
        {/* Crop Filter */}
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.cropFilter}>
          {DASHBOARD_CROPS.map(crop => {
            const active = selectedCrops.includes(crop.id);
            return (
              <TouchableOpacity
                key={crop.id}
                style={[styles.filterChip, active && styles.filterChipActive]}
                onPress={() => toggleCrop(crop.id)}
                activeOpacity={0.8}
              >
                <Text style={styles.filterIcon}>{crop.icon}</Text>
                <Text style={[styles.filterText, active && styles.filterTextActive]}>
                  {isEn ? crop.name_en : crop.name_kn}
                </Text>
              </TouchableOpacity>
            );
          })}
        </ScrollView>

        {/* Chart 1: Yield Trend */}
        <View style={styles.chartCard}>
          <View style={styles.chartHeader}>
            <MaterialCommunityIcons name="chart-line" size={20} color="#1565C0" />
            <Text style={styles.chartTitle}>{t('yieldTrend')}</Text>
          </View>
          <Text style={styles.chartSubtitle}>
            {isEn ? 'Quintals per hectare (2014–2024)' : 'ಕ್ವಿಂಟಾಲ್/ಹೆಕ್ಟೇರ್ (2014–2024)'}
          </Text>
          <LineChart
            series={yieldSeries}
            labels={yieldLabels}
            height={220}
            showDots
            showGrid
          />
        </View>

        {/* Chart 2: Bubble Comparison */}
        <View style={styles.chartCard}>
          <View style={styles.chartHeader}>
            <MaterialCommunityIcons name="chart-bubble" size={20} color="#6A1B9A" />
            <Text style={styles.chartTitle}>{t('cropComparison')}</Text>
          </View>
          <Text style={styles.chartSubtitle}>
            {isEn ? 'Bubble size = profit potential' : 'ಗುಳ್ಳೆ ಗಾತ್ರ = ಲಾಭ ಸಾಮರ್ಥ್ಯ'}
          </Text>
          <BubbleChart
            data={bubbleData}
            xLabel={isEn ? 'Risk Score →' : 'ಅಪಾಯ →'}
            yLabel={isEn ? 'Profit Score →' : 'ಲಾಭ →'}
            height={280}
          />
        </View>

        {/* Chart 3: Seasonal Heatmap */}
        <View style={styles.chartCard}>
          <View style={styles.chartHeader}>
            <MaterialCommunityIcons name="calendar-month" size={20} color="#E65100" />
            <Text style={styles.chartTitle}>{t('seasonalHeatmap')}</Text>
          </View>
          <Text style={styles.chartSubtitle}>
            {isEn ? 'Performance score by month (0–100)' : 'ತಿಂಗಳ ಅನುಸಾರ ಕಾರ್ಯಕ್ಷಮತೆ (0–100)'}
          </Text>
          <HeatMap
            data={[]}
            monthLabels={months}
            rows={heatmapRows}
          />
        </View>

        {/* Chart 4: Price Forecast */}
        <View style={styles.chartCard}>
          <View style={styles.chartHeader}>
            <MaterialCommunityIcons name="crystal-ball" size={20} color={Colors.success} />
            <Text style={styles.chartTitle}>{t('priceForecast')}</Text>
          </View>

          {/* Forecast crop selector */}
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.forecastCrops}>
            {DASHBOARD_CROPS.slice(0, 6).map(crop => (
              <TouchableOpacity
                key={crop.id}
                style={[styles.forecastChip, forecastCrop === crop.id && styles.forecastChipActive]}
                onPress={() => setForecastCrop(crop.id)}
              >
                <Text style={styles.forecastChipIcon}>{crop.icon}</Text>
                <Text style={[styles.forecastChipText, forecastCrop === crop.id && styles.forecastChipTextActive]}>
                  {isEn ? crop.name_en : crop.name_kn}
                </Text>
              </TouchableOpacity>
            ))}
          </ScrollView>

          <AreaChart
            data={forecastData.data}
            labels={forecastData.labels}
            height={220}
            color={forecastData.crop?.color || Colors.primary}
            currentIndex={forecastData.currentIndex}
            unit="₹"
          />

          {/* Forecast Summary */}
          <View style={styles.forecastSummary}>
            <View style={styles.forecastItem}>
              <Text style={styles.forecastLabel}>{isEn ? 'Current' : 'ಪ್ರಸ್ತುತ'}</Text>
              <Text style={styles.forecastValue}>₹{forecastData.prediction.currentPrice.toLocaleString('en-IN')}</Text>
            </View>
            <View style={styles.forecastDivider} />
            <View style={styles.forecastItem}>
              <Text style={styles.forecastLabel}>{isEn ? 'Predicted' : 'ಅಂದಾಜು'}</Text>
              <Text style={[styles.forecastValue, { color: Colors.primary }]}>
                ₹{forecastData.prediction.predictedPrice.toLocaleString('en-IN')}
              </Text>
            </View>
            <View style={styles.forecastDivider} />
            <View style={styles.forecastItem}>
              <Text style={styles.forecastLabel}>{isEn ? 'Peak' : 'ಗರಿಷ್ಠ'}</Text>
              <Text style={[styles.forecastValue, { color: Colors.success }]}>
                ₹{forecastData.prediction.predictedPeak.toLocaleString('en-IN')}
              </Text>
            </View>
          </View>
        </View>

        <Text style={styles.footer}>ML Predictions • Not Financial Advice</Text>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background },
  header: { paddingTop: 52, paddingBottom: Spacing.md, paddingHorizontal: Spacing.lg },
  headerRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm },
  headerTitle: { fontSize: FontSize.xl, fontWeight: '800', color: '#fff' },

  scroll: { paddingBottom: 100 },

  // Crop Filter
  cropFilter: { paddingHorizontal: Spacing.md, paddingVertical: Spacing.md, gap: 8 },
  filterChip: {
    flexDirection: 'row', alignItems: 'center', gap: 4,
    paddingVertical: 8, paddingHorizontal: 12,
    borderRadius: BorderRadius.full,
    backgroundColor: Colors.surface,
    borderWidth: 1.5, borderColor: Colors.border,
  },
  filterChipActive: { borderColor: Colors.primary, backgroundColor: Colors.primarySoft },
  filterIcon: { fontSize: 14 },
  filterText: { fontSize: 12, color: Colors.textMuted, fontWeight: '600' },
  filterTextActive: { color: Colors.primary, fontWeight: '800' },

  // Chart Cards
  chartCard: {
    marginHorizontal: Spacing.md, marginBottom: Spacing.md,
    backgroundColor: Colors.surface, borderRadius: BorderRadius.lg,
    padding: Spacing.md, borderWidth: 1, borderColor: Colors.border,
    ...Shadows.sm,
  },
  chartHeader: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm, marginBottom: 4 },
  chartTitle: { fontSize: FontSize.lg, fontWeight: '800', color: Colors.textPrimary },
  chartSubtitle: { fontSize: FontSize.xs, color: Colors.textMuted, marginBottom: Spacing.md, fontWeight: '500' },

  // Forecast crop selector
  forecastCrops: { gap: 6, marginBottom: Spacing.md },
  forecastChip: {
    flexDirection: 'row', alignItems: 'center', gap: 3,
    paddingVertical: 5, paddingHorizontal: 10,
    borderRadius: BorderRadius.full,
    backgroundColor: Colors.background,
    borderWidth: 1, borderColor: Colors.border,
  },
  forecastChipActive: { borderColor: Colors.success, backgroundColor: '#E8F5E9' },
  forecastChipIcon: { fontSize: 12 },
  forecastChipText: { fontSize: 11, color: Colors.textMuted, fontWeight: '600' },
  forecastChipTextActive: { color: Colors.success, fontWeight: '800' },

  // Forecast summary
  forecastSummary: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-around',
    marginTop: Spacing.md, paddingTop: Spacing.md,
    borderTopWidth: 1, borderTopColor: Colors.border,
  },
  forecastItem: { alignItems: 'center' },
  forecastLabel: { fontSize: FontSize.xs, color: Colors.textMuted, fontWeight: '600' },
  forecastValue: { fontSize: FontSize.lg, fontWeight: '900', color: Colors.textPrimary, marginTop: 2 },
  forecastDivider: { width: 1, height: 32, backgroundColor: Colors.border },

  footer: { fontSize: FontSize.xs, color: Colors.textMuted, textAlign: 'center', marginTop: Spacing.md, fontStyle: 'italic' },
});
