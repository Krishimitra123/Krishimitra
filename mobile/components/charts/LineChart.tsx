/**
 * LineChart — Custom SVG line chart using react-native-svg.
 * Renders multiple data series as colored lines with labels and grid.
 * Expo Go compatible.
 */

import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import Svg, { Path, Circle, Line, Text as SvgText, Defs, LinearGradient as SvgGradient, Stop } from 'react-native-svg';
import { Colors, FontSize } from '@/constants/theme';

export interface LineSeries {
  label: string;
  color: string;
  data: number[];
}

interface LineChartProps {
  series: LineSeries[];
  labels: string[];        // X-axis labels
  title?: string;
  height?: number;
  showDots?: boolean;
  showGrid?: boolean;
}

export default function LineChart({
  series,
  labels,
  title,
  height = 220,
  showDots = true,
  showGrid = true,
}: LineChartProps) {
  const padding = { top: 20, right: 16, bottom: 36, left: 48 };
  const chartWidth = 340;
  const chartHeight = height;
  const innerW = chartWidth - padding.left - padding.right;
  const innerH = chartHeight - padding.top - padding.bottom;

  // Find global min/max across all series
  const allValues = series.flatMap(s => s.data);
  const minVal = Math.min(...allValues) * 0.9;
  const maxVal = Math.max(...allValues) * 1.1;
  const range = maxVal - minVal || 1;

  const xScale = (i: number) => padding.left + (i / (labels.length - 1)) * innerW;
  const yScale = (v: number) => padding.top + innerH - ((v - minVal) / range) * innerH;

  // Y-axis ticks
  const yTicks = 5;
  const yTickValues = Array.from({ length: yTicks }, (_, i) =>
    Math.round(minVal + (range / (yTicks - 1)) * i)
  );

  return (
    <View style={styles.container}>
      {title && <Text style={styles.title}>{title}</Text>}
      <Svg width={chartWidth} height={chartHeight} viewBox={`0 0 ${chartWidth} ${chartHeight}`}>
        {/* Grid lines */}
        {showGrid && yTickValues.map((v, i) => (
          <Line
            key={`grid-${i}`}
            x1={padding.left}
            y1={yScale(v)}
            x2={chartWidth - padding.right}
            y2={yScale(v)}
            stroke={Colors.border}
            strokeWidth={0.5}
            strokeDasharray="4,4"
          />
        ))}

        {/* Y-axis labels */}
        {yTickValues.map((v, i) => (
          <SvgText
            key={`ylabel-${i}`}
            x={padding.left - 6}
            y={yScale(v) + 4}
            fontSize={9}
            fill={Colors.textMuted}
            textAnchor="end"
          >
            {v >= 1000 ? `${(v / 1000).toFixed(0)}k` : v}
          </SvgText>
        ))}

        {/* X-axis labels */}
        {labels.map((label, i) => {
          // Show every nth label to avoid crowding
          const showEvery = labels.length > 8 ? 2 : 1;
          if (i % showEvery !== 0 && i !== labels.length - 1) return null;
          return (
            <SvgText
              key={`xlabel-${i}`}
              x={xScale(i)}
              y={chartHeight - 6}
              fontSize={9}
              fill={Colors.textMuted}
              textAnchor="middle"
            >
              {label}
            </SvgText>
          );
        })}

        {/* Lines and dots */}
        {series.map((s, si) => {
          const pathData = s.data
            .map((v, i) => `${i === 0 ? 'M' : 'L'} ${xScale(i)} ${yScale(v)}`)
            .join(' ');

          return (
            <React.Fragment key={`series-${si}`}>
              <Path
                d={pathData}
                fill="none"
                stroke={s.color}
                strokeWidth={2.5}
                strokeLinecap="round"
                strokeLinejoin="round"
              />
              {showDots && s.data.map((v, i) => (
                <Circle
                  key={`dot-${si}-${i}`}
                  cx={xScale(i)}
                  cy={yScale(v)}
                  r={3}
                  fill={s.color}
                  stroke="#fff"
                  strokeWidth={1.5}
                />
              ))}
            </React.Fragment>
          );
        })}
      </Svg>

      {/* Legend */}
      {series.length > 1 && (
        <View style={styles.legend}>
          {series.map((s, i) => (
            <View key={i} style={styles.legendItem}>
              <View style={[styles.legendDot, { backgroundColor: s.color }]} />
              <Text style={styles.legendText}>{s.label}</Text>
            </View>
          ))}
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { alignItems: 'center' },
  title: {
    fontSize: FontSize.sm,
    fontWeight: '700',
    color: Colors.textPrimary,
    marginBottom: 8,
    alignSelf: 'flex-start',
  },
  legend: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
    marginTop: 8,
    justifyContent: 'center',
  },
  legendItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  legendDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  legendText: {
    fontSize: 10,
    color: Colors.textSecondary,
    fontWeight: '600',
  },
});
