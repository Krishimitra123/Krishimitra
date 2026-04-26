/**
 * MicButton — Primary voice recording button.
 * Pulses red while recording, shows spinner during STT processing.
 * States: IDLE (green) → RECORDING (red pulse) → STT_PROCESSING (grey spinner)
 */

import React, { useEffect, useRef } from 'react';
import {
  TouchableOpacity,
  Text,
  StyleSheet,
  Animated,
  ActivityIndicator,
  View,
} from 'react-native';
import { Colors, FontSize, Spacing, BorderRadius } from '@/constants/theme';
import { useAudioStore, AudioState } from '@/stores/useAudioStore';

interface MicButtonProps {
  onPress: () => void;
  size?: number;
}

export function MicButton({ onPress, size = 80 }: MicButtonProps) {
  const { state } = useAudioStore();
  const pulseAnim = useRef(new Animated.Value(1)).current;

  // Pulse animation during recording
  useEffect(() => {
    if (state === 'RECORDING') {
      const pulse = Animated.loop(
        Animated.sequence([
          Animated.timing(pulseAnim, {
            toValue: 1.15,
            duration: 600,
            useNativeDriver: true,
          }),
          Animated.timing(pulseAnim, {
            toValue: 1,
            duration: 600,
            useNativeDriver: true,
          }),
        ])
      );
      pulse.start();
      return () => pulse.stop();
    } else {
      pulseAnim.setValue(1);
    }
  }, [state]);

  const getButtonStyle = () => {
    switch (state) {
      case 'RECORDING':
        return { backgroundColor: Colors.recording };
      case 'STT_PROCESSING':
        return { backgroundColor: Colors.disabled };
      case 'ERROR':
        return { backgroundColor: Colors.warning };
      default:
        return { backgroundColor: Colors.primary };
    }
  };

  const getIcon = () => {
    switch (state) {
      case 'RECORDING':
        return '⏹️';
      case 'STT_PROCESSING':
        return '';
      case 'ERROR':
        return '🔄';
      default:
        return '🎙️';
    }
  };

  const getLabel = () => {
    switch (state) {
      case 'RECORDING':
        return 'ನಿಲ್ಲಿಸಿ';
      case 'STT_PROCESSING':
        return 'ಪ್ರಕ್ರಿಯೆ...';
      case 'ERROR':
        return 'ಮತ್ತೊಮ್ಮೆ';
      default:
        return 'ಒತ್ತಿ ಮಾತನಾಡಿ';
    }
  };

  const isDisabled = state === 'STT_PROCESSING';

  return (
    <View style={styles.wrapper}>
      {state === 'RECORDING' && (
        <Animated.View
          style={[
            styles.pulseRing,
            {
              width: size + 24,
              height: size + 24,
              borderRadius: (size + 24) / 2,
              transform: [{ scale: pulseAnim }],
            },
          ]}
        />
      )}
      <Animated.View
        style={[{ transform: [{ scale: state === 'RECORDING' ? pulseAnim : 1 }] }]}
      >
        <TouchableOpacity
          onPress={onPress}
          disabled={isDisabled}
          activeOpacity={0.7}
          style={[
            styles.button,
            getButtonStyle(),
            { width: size, height: size, borderRadius: size / 2 },
          ]}
        >
          {state === 'STT_PROCESSING' ? (
            <ActivityIndicator size="large" color={Colors.textOnPrimary} />
          ) : (
            <Text style={styles.icon}>{getIcon()}</Text>
          )}
        </TouchableOpacity>
      </Animated.View>
      <Text style={styles.label}>{getLabel()}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  wrapper: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  button: {
    alignItems: 'center',
    justifyContent: 'center',
    elevation: 6,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
  },
  icon: {
    fontSize: 32,
  },
  label: {
    fontSize: FontSize.md,
    color: Colors.textSecondary,
    marginTop: Spacing.sm,
    fontWeight: '600',
  },
  pulseRing: {
    position: 'absolute',
    backgroundColor: 'rgba(244, 67, 54, 0.2)',
  },
});
