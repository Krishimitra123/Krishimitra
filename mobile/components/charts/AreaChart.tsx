/**
 * AreaChart — Custom SVG area chart with gradient fill.
 * Used for price forecast with confidence bands.
 * Expo Go compatible.
 */

import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import Svg, { Path, Line, Text as SvgText, Defs, LinearGradient as SvgGradient, Stop, Circle, Rect } from 'react-native-svg';
import { Colors, FontSize } from '@/constants/theme';

interface AreaChartProps {
  data: number[];
  labels: string[];
  title?: string;
  height?: number;
  color?: string;
  currentIndex?: number;      // Index where actual data ends and forecast begins
  unit?: string;
}

export default function AreaChart({
  data,
  labels,
  title,
  height = 220,
  color = Colors.primary,
  currentIndex,
  unit = '₹',
}: AreaChartProps) {
  const padding = { top: 24, right: 16, bottom: 36, left: 52 };
  const chartWidth = 340;
  const chartHeight = height;
  const innerW = chartWidth - padding.left - padding.right;
  const innerH = chartHeight - padding.top - padding.bottom;

  const minVal = Math.min(...data) * 0.85;
  const maxVal = Math.max(...data) * 1.1;
  const range = maxVal - minVal || 1;

  const xScale = (i: number) => padding.left + (i / Math.max(data.length - 1, 1)) * innerW;
  const yScale = (v: number) => padding.top + innerH - ((v - minVal) / range) * innerH;

  // Line path
  const linePath = data
    .map((v, i) => `${i === 0 ? 'M' : 'L'} ${xScale(i)} ${yScale(v)}`)
    .join(' ');

  // Area path (line + close at bottom)
  const areaPath = linePath +
    ` L ${xScale(data.length - 1)} ${padding.top + innerH}` +
    ` L ${xScale(0)} ${padding.top + innerH} Z`;

  // Y-axis ticks
  const yTicks = 5;
  const yTickValues = Array.from({ length: yTicks }, (_, i) =>
    Math.round(minVal + (range / (yTicks - 1)) * i)
  );

  // Find peak
  const peakVal = Math.max(...data);
  const peakIdx = data.indexOf(peakVal);

  // Divider line between actual and forecast
  const dividerIdx = currentIndex ?? Math.floor(data.length / 2);

  return (
    <View style={styles.container}>
      {title && <Text style={styles.title}>{title}</Text>}
      <Svg width={chartWidth} height={chartHeight} viewBox={`0 0 ${chartWidth} ${chartHeight}`}>
        <Defs>
          <SvgGradient id="areaGrad" x1="0" y1="0" x2="0" y2="1">
            <Stop offset="0" stopColor={color} stopOpacity="0.35" />
            <Stop offset="1" stopColor={color} stopOpacity="0.02" />
          </SvgGradient>
        </Defs>

        {/* Grid */}
        {yTickValues.map((v, i) => (
          <React.Fragment key={`grid-${i}`}>
            <Line
              x1={padding.left} y1={yScale(v)}
              x2={chartWidth - padding.right} y2={yScale(v)}
              stroke={Colors.border} strokeWidth={0.5} strokeDasharray="4,4"
            />
            <SvgText x={padding.left - 6} y={yScale(v) + 4} fontSize={9} fill={Colors.textMuted} textAnchor="end">
              {v >= 1000 ? `${(v / 1000).toFixed(1)}k` : v}
            </SvgText>
          </React.Fragment>
        ))}

        {/* X-axis labels */}
        {labels.map((label, i) => (
          <SvgText key={`x-${i}`} x={xScale(i)} y={chartHeight - 6} fontSize={9} fill={Colors.textMuted} textAnchor="middle">
            {label}
          </SvgText>
        ))}

        {/* Divider line (actual vs forecast) */}
        {currentIndex !== undefined && (
          <>
            <Line
              x1={xScale(dividerIdx)} y1={padding.top}
              x2={xScale(dividerIdx)} y2={padding.top + innerH}
              stroke={Colors.textMuted} strokeWidth={1} strokeDasharray="4,4"
            />
            <SvgText x={xScale(dividerIdx) - 4} y={padding.top - 4} fontSize={8} fill={Colors.textMuted} textAnchor="end" fontWeight="600">
              Now
            </SvgText>
            <SvgText x={xScale(dividerIdx) + 4} y={padding.top - 4} fontSize={8} fill={color} textAnchor="start" fontWeight="600">
              Forecast →
            </SvgText>
          </>
        )}

        {/* Area fill */}
        <Path d={areaPath} fill="url(#areaGrad)" />

        {/* Line */}
        <Path d={linePath} fill="none" stroke={color} strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round" />

        {/* Peak marker */}
        <Circle cx={xScale(peakIdx)} cy={yScale(peakVal)} r={5} fill={color} stroke="#fff" strokeWidth={2} />
        <Rect
          x={xScale(peakIdx) - 28}
          y={yScale(peakVal) - 22}
          width={56}
          height={16}
          rx={4}
          fill={color}
        />
        <SvgText
          x={xScale(peakIdx)}
          y={yScale(peakVal) - 10}
          fontSize={9}
          fill="#fff"
          textAnchor="middle"
          fontWeight="700"
        >
          {unit}{peakVal >= 1000 ? `${(peakVal / 1000).toFixed(1)}k` : peakVal}
        </SvgText>

        {/* Current value marker */}
        {currentIndex !== undefined && (
          <>
            <Circle cx={xScale(dividerIdx)} cy={yScale(data[dividerIdx])} r={4} fill="#fff" stroke={color} strokeWidth={2} />
          </>
        )}
      </Svg>
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
});
