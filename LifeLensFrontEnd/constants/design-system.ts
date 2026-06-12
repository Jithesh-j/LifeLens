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

export const COLORS = {
  bg: '#060713',                       // Dark neutral near black
  surface: 'rgba(255, 255, 255, 0.03)', // Elevated surface card background
  surfaceCard: 'rgba(20, 22, 45, 0.65)', // Dedicated surface card
  surfaceBorder: 'rgba(255, 255, 255, 0.06)', // Low contrast border
  primary: '#8F66FF',                  // Brand primary accent
  primaryBg: 'rgba(143, 102, 255, 0.12)', // Muted primary accent background
  text: '#FFFFFF',
  textMuted: 'rgba(255, 255, 255, 0.45)',
  
  // Semantic colors - muted and clean
  health: '#34D399',
  mood: '#C4A8FF',
  productivity: '#8F66FF',
  sleep: '#3B82F6',
  food: '#F59E0B',
  
  healthBg: 'rgba(52, 211, 153, 0.08)',
  moodBg: 'rgba(196, 168, 255, 0.08)',
  productivityBg: 'rgba(143, 102, 255, 0.08)',
  sleepBg: 'rgba(59, 130, 246, 0.08)',
  foodBg: 'rgba(245, 158, 11, 0.08)',
};
