/**
 * KrishiMitra Design Theme
 * Nivetti Systems branding — earthy organic farming palette
 */

export const Colors = {
  // ── Primary Brand Colors ──────────────────────────────────
  primary:       '#2E7D32',   // Deep organic green
  primaryLight:  '#4CAF50',   // Vibrant green
  primaryDark:   '#1B5E20',   // Forest green
  primarySoft:   '#E8F5E9',   // Very light green bg

  // ── Accent ────────────────────────────────────────────────
  accent:        '#FF8F00',   // Warm amber/orange (harvest)
  accentLight:   '#FFB300',   // Light amber
  accentSoft:    '#FFF8E1',   // Cream

  // ── Soil / Earth Tones ────────────────────────────────────
  earth:         '#795548',   // Soil brown
  earthLight:    '#A1887F',   // Light brown
  earthDark:     '#4E342E',   // Dark soil

  // ── Semantic Colors ───────────────────────────────────────
  success:       '#43A047',   // Green success
  warning:       '#FFA726',   // Orange warning
  error:         '#E53935',   // Red error
  info:          '#1E88E5',   // Blue info

  // ── Backgrounds ───────────────────────────────────────────
  background:    '#FAFAF5',   // Warm off-white (like parchment)
  surface:       '#FFFFFF',   // Card surface
  surfaceAlt:    '#F0F9F4',   // Slight green tint surface
  overlay:       'rgba(0,0,0,0.5)',

  // ── Text ──────────────────────────────────────────────────
  textPrimary:   '#1A1A1A',   // Near-black
  textSecondary: '#555555',   // Dark grey
  textMuted:     '#888888',   // Medium grey
  textOnPrimary: '#FFFFFF',   // White on green
  textOnAccent:  '#1A1A1A',   // Dark on amber

  // ── Chat Bubbles ──────────────────────────────────────────
  userBubble:    '#DCF8C6',   // WhatsApp-style green
  aiBubble:      '#F0F9F4',   // Soft green
  sourceBg:      '#FFF3E0',   // Source citation background

  // ── Misc ──────────────────────────────────────────────────
  border:        '#E0E0E0',
  divider:       '#EEEEEE',
  disabled:      '#BDBDBD',
  recording:     '#F44336',   // Red for recording
  shadow:        'rgba(0,0,0,0.08)',
};

export const Spacing = {
  xs: 4,
  sm: 8,
  md: 16,
  lg: 24,
  xl: 32,
  xxl: 48,
};

export const FontSize = {
  xs:    12,
  sm:    14,
  md:    16,   // Minimum for accessibility (elderly farmers)
  lg:    18,
  xl:    22,
  xxl:   28,
  hero:  34,
};

export const BorderRadius = {
  sm:    8,
  md:    12,
  lg:    16,
  xl:    24,
  full:  9999,
};

export const Shadows = {
  sm: {
    shadowColor: Colors.shadow,
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 1,
    shadowRadius: 3,
    elevation: 2,
  },
  md: {
    shadowColor: Colors.shadow,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 1,
    shadowRadius: 8,
    elevation: 4,
  },
  lg: {
    shadowColor: Colors.shadow,
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 1,
    shadowRadius: 16,
    elevation: 8,
  },
};
