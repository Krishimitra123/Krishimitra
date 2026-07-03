/**
 * BubbleChart — Custom SVG bubble chart using react-native-svg.
 * Shows crop comparison with bubble size proportional to a value.
 * Expo Go compatible.
 */

import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import Svg, { Circle, Text as SvgText, Line } from 'react-native-svg';
import { Colors, FontSize } from '@/constants/theme';

export interface BubbleData {
  label: string;
  icon: string;
  x: number;        // X-axis value (e.g., risk score 0–100)
  y: number;        // Y-axis value (e.g., profit score 0–100)
  size: number;     // Bubble radius factor (20–80)
  color: string;
}

interface BubbleChartProps {
  data: BubbleData[];
  title?: string;
  xLabel?: string;
  yLabel?: string;
  height?: number;
}

export default function BubbleChart({
  data,
  title,
  xLabel = 'Risk',
  yLabel = 'Profit',
  height = 260,
}: BubbleChartProps) {
  const padding = { top: 20, right: 20, bottom: 40, left: 48 };
  const chartWidth = 340;
  const chartHeight = height;
  const innerW = chartWidth - padding.left - padding.right;
  const innerH = chartHeight - padding.top - padding.bottom;

  const xScale = (v: number) => padding.left + (v / 100) * innerW;
  const yScale = (v: number) => padding.top + innerH - (v / 100) * innerH;

  return (
    <View style={styles.container}>
      {title && <Text style={styles.title}>{title}</Text>}
      <Svg width={chartWidth} height={chartHeight} viewBox={`0 0 ${chartWidth} ${chartHeight}`}>
        {/* Grid */}
        {[0, 25, 50, 75, 100].map(v => (
          <React.Fragment key={`grid-${v}`}>
            <Line
              x1={padding.left} y1={yScale(v)}
              x2={chartWidth - padding.right} y2={yScale(v)}
              stroke={Colors.border} strokeWidth={0.5} strokeDasharray="3,3"
            />
            <SvgText x={padding.left - 6} y={yScale(v) + 3} fontSize={9} fill={Colors.textMuted} textAnchor="end">
              {v}
            </SvgText>
          </React.Fragment>
        ))}

        {/* X-axis labels */}
        {[0, 25, 50, 75, 100].map(v => (
          <SvgText key={`x-${v}`} x={xScale(v)} y={chartHeight - 8} fontSize={9} fill={Colors.textMuted} textAnchor="middle">
            {v}
          </SvgText>
        ))}

        {/* Axis labels */}
        <SvgText x={chartWidth / 2} y={chartHeight - 0} fontSize={10} fill={Colors.textSecondary} textAnchor="middle" fontWeight="600">
          {xLabel} →
        </SvgText>
        <SvgText x={12} y={chartHeight / 2} fontSize={10} fill={Colors.textSecondary} textAnchor="middle" fontWeight="600" rotation="-90" origin={`12, ${chartHeight / 2}`}>
          {yLabel} →
        </SvgText>

        {/* Bubbles */}
        {data.map((d, i) => {
          const cx = xScale(d.x);
          const cy = yScale(d.y);
          const r = Math.max(12, d.size * 0.5);

          return (
            <React.Fragment key={i}>
              {/* Shadow circle */}
              <Circle cx={cx + 1} cy={cy + 1} r={r} fill="rgba(0,0,0,0.08)" />
              {/* Main bubble */}
              <Circle cx={cx} cy={cy} r={r} fill={d.color} opacity={0.75} stroke={d.color} strokeWidth={1.5} />
              {/* Label */}
              <SvgText x={cx} y={cy + 3} fontSize={r > 20 ? 14 : 10} fill="#fff" textAnchor="middle" fontWeight="700">
                {d.icon}
              </SvgText>
              {/* Name below */}
              <SvgText x={cx} y={cy + r + 12} fontSize={9} fill={Colors.textSecondary} textAnchor="middle" fontWeight="600">
                {d.label}
              </SvgText>
            </React.Fragment>
          );
        })}
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
