/**
 * VoicePipeline — Visual voice flow indicator.
 * Shows the active stage: Recording → Transcribing → AI Processing → Generating → Speaking
 * Each step animates as the pipeline progresses.
 */

import React, { useEffect, useRef } from 'react';
import { View, Text, StyleSheet, Animated } from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { Colors, FontSize, BorderRadius, Spacing } from '@/constants/theme';

type PipelineStage = 'idle' | 'recording' | 'transcribing' | 'thinking' | 'generating' | 'speaking';

interface VoicePipelineProps {
  stage: PipelineStage;
  compact?: boolean;
}

const STAGES: { key: PipelineStage; icon: string; label: string; label_kn: string }[] = [
  { key: 'recording',     icon: 'microphone',        label: 'Record',     label_kn: 'ರೆಕಾರ್ಡ್' },
  { key: 'transcribing',  icon: 'text-recognition',  label: 'Text',       label_kn: 'ಪಠ್ಯ' },
  { key: 'thinking',      icon: 'brain',             label: 'AI',         label_kn: 'AI' },
  { key: 'generating',    icon: 'message-text',      label: 'Answer',     label_kn: 'ಉತ್ತರ' },
  { key: 'speaking',      icon: 'volume-high',       label: 'Voice',      label_kn: 'ಧ್ವನಿ' },
];

function PipelineStep({
  icon,
  label,
  isActive,
  isComplete,
  isLast,
}: {
  icon: string;
  label: string;
  isActive: boolean;
  isComplete: boolean;
  isLast: boolean;
}) {
  const scaleAnim = useRef(new Animated.Value(1)).current;
  const opacityAnim = useRef(new Animated.Value(0.35)).current;

  useEffect(() => {
    if (isActive) {
      Animated.loop(
        Animated.sequence([
          Animated.timing(scaleAnim, { toValue: 1.15, duration: 500, useNativeDriver: true }),
          Animated.timing(scaleAnim, { toValue: 1, duration: 500, useNativeDriver: true }),
        ])
      ).start();
      Animated.timing(opacityAnim, { toValue: 1, duration: 300, useNativeDriver: true }).start();
    } else if (isComplete) {
      scaleAnim.setValue(1);
      opacityAnim.setValue(1);
    } else {
      scaleAnim.setValue(1);
      Animated.timing(opacityAnim, { toValue: 0.35, duration: 200, useNativeDriver: true }).start();
    }
  }, [isActive, isComplete]);

  const color = isActive ? Colors.primary : isComplete ? Colors.success : Colors.textMuted;

  return (
    <View style={styles.stepContainer}>
      <Animated.View
        style={[
          styles.stepCircle,
          {
            backgroundColor: isActive ? Colors.primarySoft : isComplete ? '#E8F5E9' : Colors.background,
            borderColor: color,
            transform: [{ scale: scaleAnim }],
            opacity: opacityAnim,
          },
        ]}
      >
        <MaterialCommunityIcons name={icon as any} size={16} color={color} />
      </Animated.View>
      <Animated.Text style={[styles.stepLabel, { color, opacity: opacityAnim }]}>{label}</Animated.Text>
      {!isLast && (
        <View style={styles.connector}>
          <View
            style={[
              styles.connectorLine,
              { backgroundColor: isComplete ? Colors.success : Colors.border },
            ]}
          />
          {isActive && (
            <Animated.View
              style={[styles.connectorDot, { backgroundColor: Colors.primary, opacity: opacityAnim }]}
            />
          )}
        </View>
      )}
    </View>
  );
}

export default function VoicePipeline({ stage, compact = false }: VoicePipelineProps) {
  if (stage === 'idle') return null;

  const activeIndex = STAGES.findIndex(s => s.key === stage);

  return (
    <View style={[styles.container, compact && styles.containerCompact]}>
      <View style={styles.pipeline}>
        {STAGES.map((s, i) => (
          <PipelineStep
            key={s.key}
            icon={s.icon}
            label={s.label}
            isActive={i === activeIndex}
            isComplete={i < activeIndex}
            isLast={i === STAGES.length - 1}
          />
        ))}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    backgroundColor: Colors.surface,
    borderRadius: BorderRadius.lg,
    padding: Spacing.md,
    borderWidth: 1,
    borderColor: Colors.primary + '20',
    marginHorizontal: Spacing.sm,
    marginVertical: Spacing.sm,
  },
  containerCompact: {
    padding: Spacing.sm,
    marginHorizontal: 0,
    marginVertical: 4,
  },
  pipeline: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
  stepContainer: {
    alignItems: 'center',
    flexDirection: 'row',
  },
  stepCircle: {
    width: 32,
    height: 32,
    borderRadius: 16,
    borderWidth: 2,
    alignItems: 'center',
    justifyContent: 'center',
  },
  stepLabel: {
    fontSize: 8,
    fontWeight: '700',
    position: 'absolute',
    bottom: -14,
    alignSelf: 'center',
    left: 0,
    right: 0,
    textAlign: 'center',
  },
  connector: {
    width: 20,
    height: 2,
    justifyContent: 'center',
    alignItems: 'center',
    marginHorizontal: 2,
  },
  connectorLine: {
    width: '100%',
    height: 2,
    borderRadius: 1,
  },
  connectorDot: {
    position: 'absolute',
    width: 6,
    height: 6,
    borderRadius: 3,
  },
});
