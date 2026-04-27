/**
 * DiagnosisCard — Displays crop disease diagnosis result.
 * Shows: disease name (Kannada), confidence bar, treatments, sources.
 */

import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { Colors, FontSize, Spacing, BorderRadius, Shadows } from '@/constants/theme';

interface DiagnosisFinding {
  disease_name:       string;
  disease_name_kn:    string;
  confidence_pct:     number;
  visual_symptoms:    string[];
  probable_cause:     string;
  organic_treatments: string[];
  prevention_measures:string[];
  sources:            string[];
  is_reliable:        boolean;
  needs_retake:       boolean;
}

interface DiagnosisCardProps {
  finding: DiagnosisFinding;
  onPlayAudio?: () => void;
}

export function DiagnosisCard({ finding, onPlayAudio }: DiagnosisCardProps) {
  if (finding.needs_retake) {
    return (
      <View style={[styles.container, styles.retakeContainer]}>
        <Text style={styles.retakeIcon}>📸</Text>
        <Text style={styles.retakeText}>
          ದಯವಿಟ್ಟು ಸ್ಪಷ್ಟ ಬೆಳಕಿನಲ್ಲಿ ಫೋಟೋ ತೆಗೆದು ಮತ್ತೊಮ್ಮೆ ಅಪ್ಲೋಡ್ ಮಾಡಿ.
        </Text>
      </View>
    );
  }

  const confidenceColor =
    finding.confidence_pct >= 70
      ? Colors.success
      : finding.confidence_pct >= 50
      ? Colors.warning
      : Colors.error;

  return (
    <View style={[styles.container, Shadows.md]}>
      {/* Disease Header */}
      <View style={styles.header}>
        <Text style={styles.diseaseIcon}>🦠</Text>
        <View style={styles.headerText}>
          <Text style={styles.diseaseName}>
            {finding.disease_name_kn || finding.disease_name}
          </Text>
          {finding.disease_name && finding.disease_name_kn && (
            <Text style={styles.diseaseNameEn}>({finding.disease_name})</Text>
          )}
        </View>
      </View>

      {/* Confidence Bar */}
      <View style={styles.confidenceSection}>
        <Text style={styles.confidenceLabel}>ವಿಶ್ವಾಸ ಮಟ್ಟ</Text>
        <View style={styles.confidenceBar}>
          <View
            style={[
              styles.confidenceFill,
              {
                width: `${finding.confidence_pct}%`,
                backgroundColor: confidenceColor,
              },
            ]}
          />
        </View>
        <Text style={[styles.confidencePct, { color: confidenceColor }]}>
          {finding.confidence_pct}%
        </Text>
      </View>

      {/* Reliability Warning */}
      {!finding.is_reliable && (
        <View style={styles.warningBox}>
          <Text style={styles.warningText}>
            ⚠️ ಕಡಿಮೆ ವಿಶ್ವಾಸ — ದಯವಿಟ್ಟು KVK ತಜ್ಞರನ್ನು ಸಂಪರ್ಕಿಸಿ
          </Text>
        </View>
      )}

      {/* Probable Cause */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>ಕಾರಣ:</Text>
        <Text style={styles.sectionText}>{finding.probable_cause}</Text>
      </View>

      {/* Organic Treatments */}
      {finding.organic_treatments.length > 0 && (
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>🌱 ಜೈವಿಕ ಉಪಾಯ:</Text>
          {finding.organic_treatments.map((treatment, i) => (
            <View key={i} style={styles.treatmentRow}>
              <Text style={styles.treatmentNum}>{i + 1}.</Text>
              <Text style={styles.treatmentText}>{treatment}</Text>
            </View>
          ))}
        </View>
      )}

      {/* Sources */}
      {finding.sources.length > 0 && (
        <View style={styles.sourceSection}>
          {finding.sources.map((source, i) => (
            <Text key={i} style={styles.sourceText}>
              📄 ಮೂಲ: {source}
            </Text>
          ))}
        </View>
      )}

      {/* Play Audio */}
      {onPlayAudio && (
        <TouchableOpacity onPress={onPlayAudio} style={styles.audioBtn}>
          <Text style={styles.audioBtnText}>🔊 ಕೇಳಿ</Text>
        </TouchableOpacity>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    backgroundColor: Colors.surface,
    borderRadius: BorderRadius.lg,
    padding: Spacing.md,
    marginVertical: Spacing.sm,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  retakeContainer: {
    alignItems: 'center',
    padding: Spacing.xl,
    backgroundColor: Colors.accentSoft,
    borderColor: Colors.accent,
  },
  retakeIcon: {
    fontSize: 40,
    marginBottom: Spacing.sm,
  },
  retakeText: {
    fontSize: FontSize.md,
    color: Colors.earth,
    textAlign: 'center',
    lineHeight: 24,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: Spacing.md,
  },
  diseaseIcon: {
    fontSize: 28,
    marginRight: Spacing.sm,
  },
  headerText: {
    flex: 1,
  },
  diseaseName: {
    fontSize: FontSize.lg,
    fontWeight: '700',
    color: Colors.textPrimary,
  },
  diseaseNameEn: {
    fontSize: FontSize.sm,
    color: Colors.textMuted,
  },
  confidenceSection: {
    marginBottom: Spacing.md,
  },
  confidenceLabel: {
    fontSize: FontSize.sm,
    color: Colors.textSecondary,
    marginBottom: 4,
  },
  confidenceBar: {
    height: 10,
    backgroundColor: Colors.divider,
    borderRadius: 5,
    overflow: 'hidden',
  },
  confidenceFill: {
    height: '100%',
    borderRadius: 5,
  },
  confidencePct: {
    fontSize: FontSize.sm,
    fontWeight: '700',
    marginTop: 4,
    textAlign: 'right',
  },
  warningBox: {
    backgroundColor: '#FFF3E0',
    padding: Spacing.sm,
    borderRadius: BorderRadius.sm,
    marginBottom: Spacing.md,
  },
  warningText: {
    fontSize: FontSize.sm,
    color: '#E65100',
  },
  section: {
    marginBottom: Spacing.md,
  },
  sectionTitle: {
    fontSize: FontSize.md,
    fontWeight: '700',
    color: Colors.primary,
    marginBottom: 4,
  },
  sectionText: {
    fontSize: FontSize.md,
    color: Colors.textPrimary,
  },
  treatmentRow: {
    flexDirection: 'row',
    marginTop: 4,
    paddingLeft: 4,
  },
  treatmentNum: {
    fontSize: FontSize.md,
    fontWeight: '600',
    color: Colors.primary,
    marginRight: 6,
    width: 20,
  },
  treatmentText: {
    fontSize: FontSize.md,
    color: Colors.textPrimary,
    flex: 1,
    lineHeight: 22,
  },
  sourceSection: {
    borderTopWidth: 1,
    borderTopColor: Colors.divider,
    paddingTop: Spacing.sm,
  },
  sourceText: {
    fontSize: FontSize.sm,
    color: Colors.textMuted,
    fontStyle: 'italic',
    marginTop: 2,
  },
  audioBtn: {
    marginTop: Spacing.md,
    backgroundColor: Colors.primarySoft,
    paddingVertical: Spacing.sm,
    paddingHorizontal: Spacing.lg,
    borderRadius: BorderRadius.full,
    alignSelf: 'center',
  },
  audioBtnText: {
    fontSize: FontSize.md,
    color: Colors.primary,
    fontWeight: '700',
  },
});
