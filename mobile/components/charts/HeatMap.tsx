/**
 * HeatMap — Grid-based heatmap for seasonal crop performance.
 * Green = Excellent, Yellow = Average, Red = Poor.
 * Expo Go compatible (pure React Native, no SVG needed).
 */

import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { Colors, FontSize, BorderRadius, Spacing } from '@/constants/theme';

interface HeatMapProps {
  data: number[];           // 12 values (one per month), 0–100
  monthLabels: string[];    // 12 month abbreviations
  cropLabel?: string;
  title?: string;
  rows?: { label: string; data: number[] }[];  // Multiple rows for multi-crop
}

function getHeatColor(value: number): string {
  if (value >= 75) return '#2E7D32';      // Dark green — Excellent
  if (value >= 60) return '#66BB6A';      // Light green — Good
  if (value >= 45) return '#FDD835';      // Yellow — Average
  if (value >= 30) return '#FF8F00';      // Orange — Below average
  return '#E53935';                        // Red — Poor
}

function getTextColor(value: number): string {
  if (value >= 75 || value < 30) return '#fff';
  return '#333';
}

export default function HeatMap({
  data,
  monthLabels,
  cropLabel,
  title,
  rows,
}: HeatMapProps) {
  const renderRow = (values: number[], label?: string) => (
    <View style={styles.row} key={label || 'single'}>
      {label && (
        <View style={styles.rowLabel}>
          <Text style={styles.rowLabelText} numberOfLines={1}>{label}</Text>
        </View>
      )}
      <View style={styles.cells}>
        {values.map((v, i) => (
          <View
            key={i}
            style={[styles.cell, { backgroundColor: getHeatColor(v) }]}
          >
            <Text style={[styles.cellText, { color: getTextColor(v) }]}>{v}</Text>
          </View>
        ))}
      </View>
    </View>
  );

  return (
    <View style={styles.container}>
      {title && <Text style={styles.title}>{title}</Text>}

      {/* Month headers */}
      <View style={styles.headerRow}>
        {rows && <View style={styles.rowLabel} />}
        <View style={styles.cells}>
          {monthLabels.map((m, i) => (
            <View key={i} style={styles.headerCell}>
              <Text style={styles.headerText}>{m}</Text>
            </View>
          ))}
        </View>
      </View>

      {/* Data rows */}
      {rows
        ? rows.map(r => renderRow(r.data, r.label))
        : renderRow(data, cropLabel)
      }

      {/* Legend */}
      <View style={styles.legend}>
        <View style={styles.legendItem}>
          <View style={[styles.legendBox, { backgroundColor: '#E53935' }]} />
          <Text style={styles.legendText}>Poor</Text>
        </View>
        <View style={styles.legendItem}>
          <View style={[styles.legendBox, { backgroundColor: '#FF8F00' }]} />
          <Text style={styles.legendText}>Below Avg</Text>
        </View>
        <View style={styles.legendItem}>
          <View style={[styles.legendBox, { backgroundColor: '#FDD835' }]} />
          <Text style={styles.legendText}>Average</Text>
        </View>
        <View style={styles.legendItem}>
          <View style={[styles.legendBox, { backgroundColor: '#66BB6A' }]} />
          <Text style={styles.legendText}>Good</Text>
        </View>
        <View style={styles.legendItem}>
          <View style={[styles.legendBox, { backgroundColor: '#2E7D32' }]} />
          <Text style={styles.legendText}>Excellent</Text>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {},
  title: {
    fontSize: FontSize.sm,
    fontWeight: '700',
    color: Colors.textPrimary,
    marginBottom: 8,
  },
  headerRow: {
    flexDirection: 'row',
    marginBottom: 2,
  },
  headerCell: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: 2,
  },
  headerText: {
    fontSize: 8,
    color: Colors.textMuted,
    fontWeight: '700',
  },
  row: {
    flexDirection: 'row',
    marginBottom: 2,
  },
  rowLabel: {
    width: 60,
    justifyContent: 'center',
    paddingRight: 4,
  },
  rowLabelText: {
    fontSize: 9,
    color: Colors.textSecondary,
    fontWeight: '700',
  },
  cells: {
    flex: 1,
    flexDirection: 'row',
    gap: 2,
  },
  cell: {
    flex: 1,
    aspectRatio: 1,
    borderRadius: 4,
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 24,
  },
  cellText: {
    fontSize: 8,
    fontWeight: '800',
  },
  legend: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 8,
    marginTop: 10,
    flexWrap: 'wrap',
  },
  legendItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
  },
  legendBox: {
    width: 10,
    height: 10,
    borderRadius: 2,
  },
  legendText: {
    fontSize: 9,
    color: Colors.textMuted,
    fontWeight: '600',
  },
});
