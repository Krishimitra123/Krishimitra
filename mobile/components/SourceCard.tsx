/**
 * SourceCard — Displays RAG source citation in a styled card.
 */

import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { Colors, FontSize, Spacing, BorderRadius } from '@/constants/theme';

interface SourceCardProps {
  sources: string[];
}

export function SourceCard({ sources }: SourceCardProps) {
  if (sources.length === 0) return null;

  return (
    <View style={styles.container}>
      <Text style={styles.header}>📚 ಮೂಲಗಳು (Sources)</Text>
      {sources.map((source, i) => (
        <View key={i} style={styles.sourceItem}>
          <Text style={styles.bullet}>📄</Text>
          <Text style={styles.sourceText}>{source}</Text>
        </View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    backgroundColor: Colors.sourceBg,
    borderRadius: BorderRadius.md,
    padding: Spacing.md,
    marginTop: Spacing.sm,
    borderLeftWidth: 3,
    borderLeftColor: Colors.accent,
  },
  header: {
    fontSize: FontSize.sm,
    fontWeight: '700',
    color: Colors.earth,
    marginBottom: Spacing.xs,
  },
  sourceItem: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginTop: 4,
  },
  bullet: {
    fontSize: 12,
    marginRight: 6,
    marginTop: 2,
  },
  sourceText: {
    fontSize: FontSize.sm,
    color: Colors.textSecondary,
    flex: 1,
    lineHeight: 20,
  },
});
