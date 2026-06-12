// Design System Tokens for LifeLens

export const SPACING = {
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 24,
  xxl: 32,
};

export const TYPOGRAPHY = {
  title: {
    fontSize: 20,
    fontWeight: '700' as const,
    lineHeight: 26,
  },
  header: {
    fontSize: 15,
    fontWeight: '600' as const,
    lineHeight: 20,
  },
  body: {
    fontSize: 13.5,
    fontWeight: '400' as const,
    lineHeight: 18,
  },
  metadata: {
    fontSize: 11.5,
    fontWeight: '500' as const,
    lineHeight: 15,
    color: 'rgba(255, 255, 255, 0.45)',
  },
};

import { useColorScheme } from '@/hooks/use-color-scheme';

export const LIGHT_COLORS = {
  bg: '#F8FAFC',                       // Light slate-grey background
  surface: 'rgba(0, 0, 0, 0.02)',       // Elevated surface card background
  surfaceCard: '#FFFFFF',               // Pure white card surface
  surfaceBorder: 'rgba(0, 0, 0, 0.08)', // Soft visible border
  primary: '#0D9488',                  // Natural brand teal primary
  primaryBg: 'rgba(13, 148, 136, 0.08)', // Muted brand teal background
  text: '#0F172A',                      // Deep slate text
  textMuted: 'rgba(15, 23, 42, 0.60)',  // Muted slate text
  
  // Semantic colors - natural and organic
  health: '#10B981',                   // Organic Emerald
  mood: '#8B5CF6',                     // Deep Lavender (light mode high contrast)
  productivity: '#0D9488',             // Brand Teal
  sleep: '#3B82F6',                    // Rich Slate Blue
  food: '#D97706',                     // Rich Amber
  
  healthBg: 'rgba(16, 185, 129, 0.08)',
  moodBg: 'rgba(139, 92, 246, 0.08)',
  productivityBg: 'rgba(13, 148, 136, 0.08)',
  sleepBg: 'rgba(59, 130, 246, 0.08)',
  foodBg: 'rgba(217, 119, 6, 0.08)',
};

export const DARK_COLORS = {
  bg: '#080A0F',                       // Dark neutral near black (Obsidian Charcoal)
  surface: 'rgba(255, 255, 255, 0.03)', // Elevated surface card background
  surfaceCard: 'rgba(22, 28, 38, 0.70)', // Sophisticated slate-obsidian surface
  surfaceBorder: 'rgba(255, 255, 255, 0.05)', // Ultra low contrast border
  primary: '#0D9488',                  // Natural brand teal primary
  primaryBg: 'rgba(13, 148, 136, 0.10)', // Muted brand teal background
  text: '#FFFFFF',
  textMuted: 'rgba(255, 255, 255, 0.45)',
  
  // Semantic colors - natural and organic
  health: '#10B981',                   // Organic Emerald
  mood: '#A78BFA',                     // Calming Soft Lavender
  productivity: '#14B8A6',             // Mint Teal
  sleep: '#60A5FA',                    // Soft Slate Blue
  food: '#F59E0B',                     // Warm Amber
  
  healthBg: 'rgba(16, 185, 129, 0.08)',
  moodBg: 'rgba(167, 139, 250, 0.08)',
  productivityBg: 'rgba(20, 184, 166, 0.08)',
  sleepBg: 'rgba(96, 165, 250, 0.08)',
  foodBg: 'rgba(245, 158, 11, 0.08)',
};

export const COLORS = DARK_COLORS;

export function useThemeColors() {
  const scheme = useColorScheme();
  return scheme === 'dark' ? DARK_COLORS : LIGHT_COLORS;
}
