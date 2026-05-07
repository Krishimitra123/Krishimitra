/**
 * NivettiHeader — Premium branded header. No emojis, vector icons only.
 * Used on History screen only (other screens have inline gradient headers).
 */

import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { MaterialCommunityIcons } from '@expo/vector-icons';
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
    <LinearGradient colors={['#1B5E20', '#2E7D32']} style={styles.container}>
      <View style={styles.left}>
        {showBack && (
          <TouchableOpacity onPress={onBack} style={styles.backBtn}>
            <MaterialCommunityIcons name="arrow-left" size={22} color="#fff" />
          </TouchableOpacity>
        )}
        <View style={styles.logoCircle}>
          <MaterialCommunityIcons name="sprout" size={20} color="#fff" />
        </View>
        <View>
          <Text style={styles.title}>{title}</Text>
          <Text style={styles.subtitle}>Nivetti Systems</Text>
        </View>
      </View>
      {rightAction && <View style={styles.right}>{rightAction}</View>}
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: Spacing.lg,
    paddingTop: 52,
    paddingBottom: Spacing.md,
  },
  left: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm },
  right: { flexDirection: 'row', alignItems: 'center' },
  backBtn: { padding: Spacing.xs, marginRight: Spacing.xs },
  logoCircle: {
    width: 36, height: 36, borderRadius: 18,
    backgroundColor: 'rgba(255,255,255,0.2)',
    alignItems: 'center', justifyContent: 'center',
    borderWidth: 1, borderColor: 'rgba(255,255,255,0.3)',
  },
  title: { fontSize: FontSize.xl, fontWeight: '800', color: '#fff', letterSpacing: 0.3 },
  subtitle: { fontSize: FontSize.xs, color: 'rgba(255,255,255,0.65)', marginTop: -1 },
});
