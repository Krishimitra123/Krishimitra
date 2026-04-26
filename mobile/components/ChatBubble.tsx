/**
 * ChatBubble — Message bubble for user and AI responses.
 * - User: right-aligned, green background
 * - AI: left-aligned, white/soft-green background
 * - AI: shows source citations and play audio button
 * - Min 16sp font for accessibility (elderly farmers)
 */

import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Image } from 'react-native';
import { Colors, FontSize, Spacing, BorderRadius, Shadows } from '@/constants/theme';
import { Message } from '@/stores/useSessionStore';

interface ChatBubbleProps {
  message: Message;
  onPlayAudio?: (audioB64: string) => void;
}

export function ChatBubble({ message, onPlayAudio }: ChatBubbleProps) {
  const isUser = message.role === 'user';

  return (
    <View style={[styles.row, isUser ? styles.rowUser : styles.rowAI]}>
      {!isUser && (
        <View style={styles.avatar}>
          <Text style={styles.avatarText}>🌿</Text>
        </View>
      )}

      <View
        style={[
          styles.bubble,
          isUser ? styles.bubbleUser : styles.bubbleAI,
          Shadows.sm,
        ]}
      >
        {/* Image preview for diagnosis messages */}
        {message.image_uri && (
          <Image source={{ uri: message.image_uri }} style={styles.imagePreview} />
        )}

        <Text style={[styles.text, isUser ? styles.textUser : styles.textAI]}>
          {message.text}
        </Text>

        {/* Source citations */}
        {!isUser && message.sources.length > 0 && (
          <View style={styles.sourceContainer}>
            <View style={styles.sourceDivider} />
            {message.sources.map((source, i) => (
              <View key={i} style={styles.sourceRow}>
                <Text style={styles.sourceIcon}>📄</Text>
                <Text style={styles.sourceText}>ಮೂಲ: {source}</Text>
              </View>
            ))}
          </View>
        )}

        {/* Play audio button */}
        {!isUser && message.audio_base64 && onPlayAudio && (
          <TouchableOpacity
            onPress={() => onPlayAudio(message.audio_base64!)}
            style={styles.audioBtn}
            activeOpacity={0.7}
          >
            <Text style={styles.audioBtnText}>🔊 ಕೇಳಿ</Text>
          </TouchableOpacity>
        )}

        {/* Timestamp */}
        <Text style={styles.timestamp}>
          {new Date(message.timestamp).toLocaleTimeString('kn-IN', {
            hour: '2-digit',
            minute: '2-digit',
          })}
        </Text>
      </View>

      {isUser && (
        <View style={styles.avatar}>
          <Text style={styles.avatarText}>🧑‍🌾</Text>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    marginVertical: Spacing.xs,
    paddingHorizontal: Spacing.sm,
    alignItems: 'flex-end',
  },
  rowUser: {
    justifyContent: 'flex-end',
  },
  rowAI: {
    justifyContent: 'flex-start',
  },
  avatar: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: Colors.primarySoft,
    alignItems: 'center',
    justifyContent: 'center',
    marginHorizontal: 4,
  },
  avatarText: {
    fontSize: 16,
  },
  bubble: {
    maxWidth: '75%',
    padding: Spacing.md,
    borderRadius: BorderRadius.lg,
  },
  bubbleUser: {
    backgroundColor: Colors.userBubble,
    borderBottomRightRadius: 4,
  },
  bubbleAI: {
    backgroundColor: Colors.aiBubble,
    borderBottomLeftRadius: 4,
  },
  text: {
    fontSize: FontSize.md,   // 16sp minimum for accessibility
    lineHeight: 24,
  },
  textUser: {
    color: Colors.textPrimary,
  },
  textAI: {
    color: Colors.textPrimary,
  },
  sourceContainer: {
    marginTop: Spacing.sm,
  },
  sourceDivider: {
    height: 1,
    backgroundColor: Colors.border,
    marginBottom: Spacing.xs,
  },
  sourceRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 2,
  },
  sourceIcon: {
    fontSize: 12,
    marginRight: 4,
  },
  sourceText: {
    fontSize: FontSize.sm,
    color: Colors.textMuted,
    fontStyle: 'italic',
  },
  audioBtn: {
    marginTop: Spacing.sm,
    backgroundColor: Colors.primarySoft,
    paddingVertical: Spacing.xs,
    paddingHorizontal: Spacing.md,
    borderRadius: BorderRadius.full,
    alignSelf: 'flex-start',
  },
  audioBtnText: {
    fontSize: FontSize.sm,
    color: Colors.primary,
    fontWeight: '600',
  },
  timestamp: {
    fontSize: 10,
    color: Colors.textMuted,
    marginTop: Spacing.xs,
    alignSelf: 'flex-end',
  },
  imagePreview: {
    width: '100%',
    height: 150,
    borderRadius: BorderRadius.sm,
    marginBottom: Spacing.sm,
    resizeMode: 'cover',
  },
});
