/**
 * NivettiHeader — Branded header component with KrishiMitra logo.
 * Shows on all screens — Nivetti Systems branding requirement.
 */

import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { Colors, FontSize, Spacing, BorderRadius } from '@/constants/theme';

interface NivettiHeaderProps {
  title?: string;
  showBack?: boolean;
  onBack?: () => void;
  rightAction?: React.ReactNode;
}

export function NivettiHeader({
  title = 'KrishiMitra',
  showBack = false,
  onBack,
  rightAction,
}: NivettiHeaderProps) {
  return (
    <View style={styles.container}>
      <View style={styles.left}>
        {showBack && (
          <TouchableOpacity onPress={onBack} style={styles.backBtn}>
            <Text style={styles.backIcon}>←</Text>
          </TouchableOpacity>
        )}
        <View style={styles.logoContainer}>
          <Text style={styles.logoIcon}>🌿</Text>
        </View>
        <View>
          <Text style={styles.title}>{title}</Text>
          <Text style={styles.subtitle}>by Nivetti Systems</Text>
        </View>
      </View>
      {rightAction && <View style={styles.right}>{rightAction}</View>}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
    paddingTop: Spacing.xl,
    backgroundColor: Colors.primary,
  },
  left: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
  },
  right: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  backBtn: {
    padding: Spacing.xs,
    marginRight: Spacing.xs,
  },
  backIcon: {
    fontSize: FontSize.xl,
    color: Colors.textOnPrimary,
    fontWeight: '700',
  },
  logoContainer: {
    width: 40,
    height: 40,
    borderRadius: BorderRadius.full,
    backgroundColor: 'rgba(255,255,255,0.2)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  logoIcon: {
    fontSize: 22,
  },
  title: {
    fontSize: FontSize.lg,
    fontWeight: '700',
    color: Colors.textOnPrimary,
    letterSpacing: 0.5,
  },
  subtitle: {
    fontSize: FontSize.xs,
    color: 'rgba(255,255,255,0.7)',
    marginTop: -2,
  },
});
