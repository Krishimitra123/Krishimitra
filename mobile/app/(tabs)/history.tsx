/**
 * History Screen — Past session list with preview and delete.
 */

import React, { useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  Alert,
} from 'react-native';
import { NivettiHeader } from '@/components/NivettiHeader';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { Colors, FontSize, Spacing, BorderRadius, Shadows } from '@/constants/theme';
import { useSessionStore, Session } from '@/stores/useSessionStore';
import { useUserStore } from '@/stores/useUserStore';

export default function HistoryScreen() {
  const { pastSessions, clearHistory, deleteSession } = useSessionStore();
  const isEn = useUserStore((s) => s.preferred_language)?.startsWith('en');

  const handleClear = useCallback(() => {
    Alert.alert(
      isEn ? 'Clear History' : 'ಇತಿಹಾಸ ಅಳಿಸಿ',
      isEn ? 'Delete all past conversations?' : 'ಎಲ್ಲಾ ಹಿಂದಿನ ಸಂಭಾಷಣೆಗಳನ್ನು ಅಳಿಸಬೇಕೇ?',
      [
        { text: isEn ? 'Cancel' : 'ರದ್ದುಮಾಡಿ', style: 'cancel' },
        { text: isEn ? 'Delete' : 'ಅಳಿಸಿ', style: 'destructive', onPress: clearHistory },
      ]
    );
  }, [isEn]);

  const handleDelete = useCallback((id: string) => {
    Alert.alert(
      isEn ? 'Delete' : 'ಅಳಿಸಿ',
      isEn ? 'Delete this conversation?' : 'ಈ ಸಂಭಾಷಣೆಯನ್ನು ಅಳಿಸಬೇಕೇ?',
      [
        { text: isEn ? 'Cancel' : 'ರದ್ದುಮಾಡಿ', style: 'cancel' },
        { text: isEn ? 'Delete' : 'ಅಳಿಸಿ', style: 'destructive', onPress: () => deleteSession(id) },
      ]
    );
  }, [isEn]);

  const renderSession = ({ item }: { item: Session }) => {
    const messageCount = item.messages.length;
    const lastMsg = item.messages[item.messages.length - 1];
    const date = new Date(item.started_at);

    return (
      <TouchableOpacity
        style={[styles.sessionCard, Shadows.sm]}
        activeOpacity={0.7}
        onLongPress={() => handleDelete(item.id)}
      >
        <View style={styles.sessionHeader}>
          <View style={styles.sessionIcon}>
            <MaterialCommunityIcons name="microphone" size={18} color={Colors.primary} />
          </View>
          <View style={styles.sessionInfo}>
            <Text style={styles.sessionTitle} numberOfLines={1}>
              {item.title || (isEn ? 'Conversation' : 'ಸಂಭಾಷಣೆ')}
            </Text>
            <Text style={styles.sessionMeta}>
              {messageCount} {isEn ? 'messages' : 'ಸಂದೇಶಗಳು'} • {date.toLocaleDateString(isEn ? 'en-IN' : 'kn-IN')}
            </Text>
          </View>
          <Text style={styles.sessionTime}>
            {date.toLocaleTimeString(isEn ? 'en-IN' : 'kn-IN', { hour: '2-digit', minute: '2-digit' })}
          </Text>
        </View>

        {lastMsg && (
          <View style={styles.previewRow}>
            <MaterialCommunityIcons name={lastMsg.role === 'user' ? 'account' : 'robot'} size={16} color={lastMsg.role === 'user' ? Colors.textMuted : Colors.primary} style={{ marginRight: 4 }} />
            <Text style={styles.previewText} numberOfLines={2}>
              {lastMsg.text}
            </Text>
          </View>
        )}

        {/* Source count badge */}
        {lastMsg?.sources?.length > 0 && (
          <View style={styles.sourceBadge}>
            <MaterialCommunityIcons name="file-document-outline" size={11} color={Colors.earth} />
            <Text style={styles.sourceBadgeText}>
              {lastMsg.sources.length} {isEn ? 'sources' : 'ಮೂಲಗಳು'}
            </Text>
          </View>
        )}
      </TouchableOpacity>
    );
  };

  return (
    <View style={styles.container}>
      <NivettiHeader
        title={isEn ? 'History' : 'ಇತಿಹಾಸ'}
        rightAction={
          pastSessions.length > 0 ? (
            <TouchableOpacity onPress={handleClear} style={styles.clearAllBtn}>
              <Text style={styles.clearAllText}>{isEn ? 'Clear' : 'ಅಳಿಸಿ'}</Text>
            </TouchableOpacity>
          ) : null
        }
      />

      <FlatList
        data={pastSessions}
        keyExtractor={(item) => item.id}
        renderItem={renderSession}
        contentContainerStyle={[
          styles.list,
          pastSessions.length === 0 && styles.emptyList,
        ]}
        ListEmptyComponent={
          <View style={styles.emptyContainer}>
            <View style={styles.emptyIconCircle}>
              <MaterialCommunityIcons name="history" size={48} color={Colors.primary} />
            </View>
            <Text style={styles.emptyTitle}>{isEn ? 'History Empty' : 'ಇತಿಹಾಸ ಖಾಲಿ'}</Text>
            <Text style={styles.emptySubtitle}>
              {isEn ? 'Ask your first question — it will appear here' : 'ನಿಮ್ಮ ಮೊದಲ ಪ್ರಶ್ನೆ ಕೇಳಿ — ಇಲ್ಲಿ ಕಾಣಿಸುತ್ತದೆ'}
            </Text>
          </View>
        }
        showsVerticalScrollIndicator={false}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  list: {
    padding: Spacing.md,
    paddingBottom: Spacing.xxl,
  },
  emptyList: {
    flex: 1,
  },
  clearAllBtn: {
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.xs,
    backgroundColor: 'rgba(255,255,255,0.2)',
    borderRadius: BorderRadius.full,
  },
  clearAllText: {
    fontSize: FontSize.sm,
    color: Colors.textOnPrimary,
    fontWeight: '600',
  },
  sessionCard: {
    backgroundColor: Colors.surface,
    borderRadius: BorderRadius.lg,
    padding: Spacing.md,
    marginBottom: Spacing.sm,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  sessionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: Spacing.sm,
  },
  sessionIcon: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: Colors.primarySoft,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: Spacing.sm,
  },
  iconEmoji: {
    fontSize: 18,
  },
  sessionInfo: {
    flex: 1,
  },
  sessionTitle: {
    fontSize: FontSize.md,
    fontWeight: '700',
    color: Colors.textPrimary,
  },
  sessionMeta: {
    fontSize: FontSize.xs,
    color: Colors.textMuted,
    marginTop: 2,
  },
  sessionTime: {
    fontSize: FontSize.xs,
    color: Colors.textMuted,
  },
  previewRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    backgroundColor: Colors.background,
    padding: Spacing.sm,
    borderRadius: BorderRadius.sm,
  },
  previewRole: {
    fontSize: 14,
    marginRight: Spacing.xs,
  },
  previewText: {
    fontSize: FontSize.sm,
    color: Colors.textSecondary,
    flex: 1,
    lineHeight: 20,
  },
  sourceBadge: {
    marginTop: Spacing.xs,
    alignSelf: 'flex-start',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    backgroundColor: Colors.sourceBg,
    paddingHorizontal: Spacing.sm,
    paddingVertical: 2,
    borderRadius: BorderRadius.full,
  },
  sourceBadgeText: {
    fontSize: 11,
    color: Colors.earth,
  },
  emptyContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: Spacing.xl,
  },
  emptyIconCircle: {
    width: 96, height: 96, borderRadius: 48,
    backgroundColor: Colors.primarySoft,
    alignItems: 'center', justifyContent: 'center',
    marginBottom: Spacing.lg,
  },
  emptyIcon: {
    fontSize: 56,
    marginBottom: Spacing.md,
  },
  emptyTitle: {
    fontSize: FontSize.xl,
    fontWeight: '700',
    color: Colors.textSecondary,
    marginBottom: Spacing.xs,
  },
  emptySubtitle: {
    fontSize: FontSize.md,
    color: Colors.textMuted,
    textAlign: 'center',
  },
});
