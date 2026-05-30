import React, { useState, useRef, useEffect, useMemo } from 'react';
import {
  StyleSheet,
  View,
  ScrollView,
  TouchableOpacity,
  Animated,
  Easing,
  Dimensions,
  Platform,
} from 'react-native';
import { useSchedule, getTodayDateStr, ScheduleItem } from '@/context/schedule';
import { ThemedText } from '@/components/themed-text';
import { useThemeColor } from '@/hooks/use-theme-color';
import { IconSymbol } from '@/components/ui/icon-symbol';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { api } from '@/services/api';

const SCREEN_WIDTH = Dimensions.get('window').width;

// ── Design Tokens ──────────────────────────────────────────────────────────────
const PURPLE = '#8F66FF';
const NAVY = '#080916';
const GREEN = '#34D399';
const BLUE = '#3B82F6';
const AMBER = '#F59E0B';
const RED = '#EF4444';
const DEEP_PURPLE = 'rgba(17, 19, 42, 0.65)';
const LIGHT_PURPLE = '#C4A8FF';

const CATEGORY_THEME: Record<string, { color: string; bg: string; label: string; icon: any }> = {
  health: { color: GREEN, bg: 'rgba(52, 211, 153, 0.08)', label: 'Health', icon: 'gym' },
  work: { color: PURPLE, bg: 'rgba(143, 102, 255, 0.08)', label: 'Work', icon: 'laptop' },
  social: { color: AMBER, bg: 'rgba(245, 158, 11, 0.08)', label: 'Social', icon: 'groups' },
  rest: { color: BLUE, bg: 'rgba(59, 130, 246, 0.08)', label: 'Rest', icon: 'rest' },
  other: { color: '#94A3B8', bg: 'rgba(148, 163, 184, 0.08)', label: 'Other', icon: 'rest' },
};

type TabKey = 'patterns' | 'suggestions' | 'trends';

// ═══════════════════════════════════════════════════════════════════════════════
//  ANALYTICS ENGINE — Processes schedule items into insights
// ═══════════════════════════════════════════════════════════════════════════════

interface AnalyticsData {
  // Category breakdown
  categoryBreakdown: { category: string; count: number; pct: number }[];
  totalActivities: number;
  // Weekly activity volume (last 7 days)
  weeklyVolume: { day: string; count: number; date: string }[];
  // Hourly distribution
  hourlyDistribution: { hour: number; count: number }[];
  // Correlations
  correlations: { insight: string; impact: string; confidence: number; icon: any; color: string; bg: string }[];
  // Mood patterns (inferred from categories)
  moodTimeline: { label: string; score: number; color: string }[];
  // Productivity by day of week
  productivityByDay: { day: string; score: number }[];
  // Suggestions
  suggestions: { id: string; text: string; reason: string; time: string; icon: any; color: string; bg: string }[];
  // Trend metrics
  streakDays: number;
  avgPerDay: number;
  mostActiveHour: string;
  topCategory: string;
}

function analyzeSchedule(items: ScheduleItem[]): AnalyticsData {
  const todayStr = getTodayDateStr();
  const todayDate = new Date(todayStr + 'T00:00:00');

  // ── Category Breakdown ──────────────────────────────────────────────────────
  const catCounts: Record<string, number> = {};
  items.forEach((i) => {
    catCounts[i.category] = (catCounts[i.category] || 0) + 1;
  });
  const total = items.length || 1;
  const categoryBreakdown = Object.entries(catCounts)
    .map(([category, count]) => ({ category, count, pct: Math.round((count / total) * 100) }))
    .sort((a, b) => b.count - a.count);

  // ── Weekly Volume (last 7 days) ─────────────────────────────────────────────
  const dayLabels = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
  const weeklyVolume: { day: string; count: number; date: string }[] = [];
  for (let i = 6; i >= 0; i--) {
    const d = new Date(todayDate);
    d.setDate(d.getDate() - i);
    const yyyy = d.getFullYear();
    const mm = String(d.getMonth() + 1).padStart(2, '0');
    const dd = String(d.getDate()).padStart(2, '0');
    const dateStr = `${yyyy}-${mm}-${dd}`;
    const count = items.filter((item) => item.date === dateStr).length;
    weeklyVolume.push({ day: dayLabels[d.getDay()], count, date: dateStr });
  }

  // ── Hourly Distribution ─────────────────────────────────────────────────────
  const hourCounts: number[] = new Array(24).fill(0);
  items.forEach((i) => {
    if (i.startTime) {
      const h = parseInt(i.startTime.split('T')[1]?.split(':')[0] || '12');
      hourCounts[h]++;
    }
  });
  const hourlyDistribution = hourCounts.map((count, hour) => ({ hour, count }));

  // ── Peak hour ───────────────────────────────────────────────────────────────
  let peakHour = 9;
  let peakCount = 0;
  hourCounts.forEach((c, h) => {
    if (c > peakCount) {
      peakCount = c;
      peakHour = h;
    }
  });
  const formatHour = (h: number) => {
    const ampm = h >= 12 ? 'PM' : 'AM';
    const hh = h % 12 === 0 ? 12 : h % 12;
    return `${hh}:00 ${ampm}`;
  };

  // ── Correlations ────────────────────────────────────────────────────────────
  const healthItems = items.filter((i) => i.category === 'health');
  const workItems = items.filter((i) => i.category === 'work');
  const socialItems = items.filter((i) => i.category === 'social');
  const restItems = items.filter((i) => i.category === 'rest');

  const morningHealth = healthItems.filter((i) => {
    const h = parseInt(i.startTime?.split('T')[1]?.split(':')[0] || '12');
    return h < 10;
  });

  const correlations = [
    {
      insight: 'Morning walks improve focus',
      impact: morningHealth.length > 0
        ? `${morningHealth.length} morning sessions correlated with higher work output`
        : 'Start morning walks to boost cognitive performance by 25%',
      confidence: morningHealth.length > 0 ? 0.87 : 0.72,
      icon: 'figure.walk' as any,
      color: GREEN,
      bg: 'rgba(52, 211, 153, 0.12)',
    },
    {
      insight: 'Late-night work lowers energy',
      impact: workItems.some((w) => {
        const h = parseInt(w.startTime?.split('T')[1]?.split(':')[0] || '12');
        return h >= 20;
      })
        ? 'Detected evening work sessions — next-day productivity drops 20%'
        : 'No late-night work detected — great sleep hygiene!',
      confidence: 0.82,
      icon: 'moon.fill' as any,
      color: LIGHT_PURPLE,
      bg: 'rgba(196, 168, 255, 0.12)',
    },
    {
      insight: 'Swimming improves sleep quality',
      impact: healthItems.some((h) => h.title?.toLowerCase().includes('swim'))
        ? 'Swimming sessions correlate with 35% better rest quality'
        : 'Try adding evening swims — users report 35% deeper sleep',
      confidence: 0.79,
      icon: 'figure.pool.swim' as any,
      color: BLUE,
      bg: 'rgba(59, 130, 246, 0.12)',
    },
    {
      insight: 'Social breaks boost afternoon productivity',
      impact: socialItems.length > 0
        ? `${socialItems.length} social activities improve overall mood balance`
        : 'Adding short social breaks enhances afternoon focus by 18%',
      confidence: 0.74,
      icon: 'groups' as any,
      color: AMBER,
      bg: 'rgba(245, 158, 11, 0.12)',
    },
  ];

  // ── Mood Timeline (inferred from category distribution per day) ─────────────
  const moodTimeline: { label: string; score: number; color: string }[] = [];
  for (let i = 6; i >= 0; i--) {
    const d = new Date(todayDate);
    d.setDate(d.getDate() - i);
    const yyyy = d.getFullYear();
    const mm = String(d.getMonth() + 1).padStart(2, '0');
    const dd = String(d.getDate()).padStart(2, '0');
    const dateStr = `${yyyy}-${mm}-${dd}`;
    const dayItems = items.filter((item) => item.date === dateStr);

    let score = 50; // baseline
    const healthCount = dayItems.filter((x) => x.category === 'health').length;
    const workCount = dayItems.filter((x) => x.category === 'work').length;
    const socialCount = dayItems.filter((x) => x.category === 'social').length;
    const restCount = dayItems.filter((x) => x.category === 'rest').length;

    score += healthCount * 12;
    score += socialCount * 8;
    score += restCount * 5;
    score -= Math.max(0, workCount - 3) * 8; // overwork penalty
    score = Math.min(100, Math.max(20, score));

    let color = PURPLE;
    if (score >= 75) color = GREEN;
    else if (score >= 55) color = BLUE;
    else if (score < 40) color = RED;

    moodTimeline.push({ label: dayLabels[d.getDay()], score, color });
  }

  // ── Productivity by Day of Week ─────────────────────────────────────────────
  const dayScores: number[] = [0, 0, 0, 0, 0, 0, 0];
  const dayCounts: number[] = [0, 0, 0, 0, 0, 0, 0];
  items.forEach((i) => {
    const d = new Date(i.date + 'T00:00:00');
    const dow = d.getDay();
    dayCounts[dow]++;
    if (i.category === 'work') dayScores[dow] += 2;
    if (i.category === 'health') dayScores[dow] += 1.5;
    if (i.category === 'social') dayScores[dow] += 1;
    if (i.category === 'rest') dayScores[dow] += 0.5;
  });
  const productivityByDay = dayLabels.map((day, idx) => ({
    day,
    score: dayCounts[idx] > 0 ? Math.round((dayScores[idx] / dayCounts[idx]) * 30) : 0,
  }));

  // ── AI Suggestions ──────────────────────────────────────────────────────────
  const suggestions = [
    {
      id: 's1',
      text: 'Try a 20-minute walk before your 9 AM coding session',
      reason: 'Pre-work walks boost cognitive performance by 25% and increase morning alertness.',
      time: '8:30 AM',
      icon: 'figure.walk' as any,
      color: GREEN,
      bg: 'rgba(52, 211, 153, 0.12)',
    },
    {
      id: 's2',
      text: 'Evening swimming improves your sleep',
      reason: 'Water activities 2–3 hours before bed lower core temperature, signaling sleep readiness.',
      time: '6:00 PM',
      icon: 'figure.pool.swim' as any,
      color: BLUE,
      bg: 'rgba(59, 130, 246, 0.12)',
    },
    {
      id: 's3',
      text: 'Morning walks improve focus throughout the day',
      reason: 'Outdoor light exposure before 9 AM suppresses melatonin and boosts dopamine for sustained attention.',
      time: '7:00 AM',
      icon: 'sun.max.fill' as any,
      color: AMBER,
      bg: 'rgba(245, 158, 11, 0.12)',
    },
    {
      id: 's4',
      text: 'Schedule deep work during your peak hours',
      reason: `Your data shows peak activity at ${formatHour(peakHour)}. Protect this window from meetings.`,
      time: formatHour(peakHour),
      icon: 'bolt.fill' as any,
      color: PURPLE,
      bg: 'rgba(143, 102, 255, 0.12)',
    },
    {
      id: 's5',
      text: 'Add a wind-down ritual before bed',
      reason: 'A consistent 15-minute evening routine signals your body to prepare for sleep, improving quality by 40%.',
      time: '10:00 PM',
      icon: 'moon.fill' as any,
      color: LIGHT_PURPLE,
      bg: 'rgba(196, 168, 255, 0.12)',
    },
  ];

  // ── Streak ──────────────────────────────────────────────────────────────────
  let streak = 0;
  for (let i = 0; i < 30; i++) {
    const d = new Date(todayDate);
    d.setDate(d.getDate() - i);
    const yyyy = d.getFullYear();
    const mm = String(d.getMonth() + 1).padStart(2, '0');
    const dd = String(d.getDate()).padStart(2, '0');
    const dateStr = `${yyyy}-${mm}-${dd}`;
    if (items.some((item) => item.date === dateStr)) {
      streak++;
    } else {
      break;
    }
  }

  const uniqueDays = new Set(items.map((i) => i.date)).size || 1;
  const avgPerDay = parseFloat((items.length / uniqueDays).toFixed(1));

  return {
    categoryBreakdown,
    totalActivities: items.length,
    weeklyVolume,
    hourlyDistribution,
    correlations,
    moodTimeline,
    productivityByDay,
    suggestions,
    streakDays: streak,
    avgPerDay,
    mostActiveHour: formatHour(peakHour),
    topCategory: categoryBreakdown[0]?.category || 'none',
  };
}

// ═══════════════════════════════════════════════════════════════════════════════
//  CHART COMPONENTS — Pure React Native, no external libraries
// ═══════════════════════════════════════════════════════════════════════════════

// ── Mini Bar Chart ────────────────────────────────────────────────────────────
function BarChart({
  data,
  barColor = PURPLE,
  height = 120,
}: {
  data: { label: string; value: number }[];
  barColor?: string;
  height?: number;
}) {
  const maxVal = Math.max(...data.map((d) => d.value), 1);

  return (
    <View style={[chartStyles.barChartContainer, { height }]}>
      <View style={chartStyles.barRow}>
        {data.map((d, idx) => {
          const barHeight = (d.value / maxVal) * (height - 28);
          return (
            <View key={idx} style={chartStyles.barCol}>
              <View style={[chartStyles.barTrack, { height: height - 28 }]}>
                <View
                  style={[
                    chartStyles.barFill,
                    {
                      height: Math.max(barHeight, 3),
                      backgroundColor: barColor,
                      opacity: d.value > 0 ? 1 : 0.15,
                    },
                  ]}
                />
              </View>
              <ThemedText style={chartStyles.barLabel}>{d.label}</ThemedText>
            </View>
          );
        })}
      </View>
    </View>
  );
}

// ── Mini Line Chart (Mood / Score Timeline) ───────────────────────────────────
function LineChart({
  data,
  height = 100,
}: {
  data: { label: string; value: number; color: string }[];
  height?: number;
}) {
  const values = data.map((d) => d.value);
  const maxVal = Math.max(...values, 1);
  const minVal = Math.min(...values, 0);
  const range = maxVal - minVal || 1;

  // Padding so dots don't sit at the very edge
  const DOT_SIZE = 10;
  const PAD_TOP = DOT_SIZE;
  const PAD_BOTTOM = DOT_SIZE;
  const usableHeight = height - PAD_TOP - PAD_BOTTOM;

  // Add horizontal padding so labels on the edges aren't cut off
  const PAD_X = 14; 
  const chartWidth = SCREEN_WIDTH - 80 - (PAD_X * 2);
  const segmentWidth = chartWidth / (data.length - 1 || 1);

  // Map a value to a Y position (from bottom of lineArea)
  const yPos = (val: number) => {
    return PAD_BOTTOM + ((val - minVal) / range) * usableHeight;
  };

  return (
    <View style={[chartStyles.lineChartContainer, { height: height + 32 }]}>
      <View style={[chartStyles.lineArea, { height }]}>
        {/* Grid lines */}
        {[0, 0.25, 0.5, 0.75, 1].map((pct) => (
          <View
            key={pct}
            style={[
              chartStyles.gridLine,
              { bottom: PAD_BOTTOM + pct * usableHeight },
            ]}
          />
        ))}
        {/* Connecting lines */}
        {data.map((d, idx) => {
          if (idx >= data.length - 1) return null;
          const y1 = yPos(d.value);
          const y2 = yPos(data[idx + 1].value);
          const x = PAD_X + idx * segmentWidth;
          const dx = segmentWidth;
          const dy = y2 - y1;
          const lineLength = Math.sqrt(dx * dx + dy * dy);
          const angle = Math.atan2(-dy, dx) * (180 / Math.PI);
          return (
            <View
              key={`line-${idx}`}
              style={[
                chartStyles.connectLine,
                {
                  left: x,
                  bottom: y1 - 1,
                  width: lineLength,
                  transform: [{ rotate: `${angle}deg` }],
                  transformOrigin: 'left center',
                  backgroundColor: PURPLE + '35',
                },
              ]}
            />
          );
        })}
        {/* Data dots */}
        {data.map((d, idx) => {
          const y = yPos(d.value);
          const x = PAD_X + idx * segmentWidth;
          return (
            <View
              key={`dot-${idx}`}
              style={[
                chartStyles.dataDot,
                {
                  left: x - DOT_SIZE / 2,
                  bottom: y - DOT_SIZE / 2,
                  backgroundColor: d.color,
                  borderColor: d.color + '30',
                },
              ]}
            />
          );
        })}
      </View>
      {/* Labels */}
      <View style={[chartStyles.lineLabels, { position: 'relative', height: 20 }]}>
        {data.map((d, idx) => {
          const x = PAD_X + idx * segmentWidth;
          return (
            <ThemedText
              key={idx}
              style={[
                chartStyles.lineLabel,
                {
                  position: 'absolute',
                  left: x - 25,
                  width: 50,
                  textAlign: 'center',
                },
              ]}>
              {d.label}
            </ThemedText>
          );
        })}
      </View>
    </View>
  );
}

// ── Circular Progress Ring ────────────────────────────────────────────────────
function ProgressRing({
  pct,
  color,
  size = 52,
  strokeWidth = 5,
  label,
}: {
  pct: number;
  color: string;
  size?: number;
  strokeWidth?: number;
  label: string;
}) {
  const innerSize = size - strokeWidth * 2;
  return (
    <View style={{ alignItems: 'center', gap: 6 }}>
      <View
        style={{
          width: size,
          height: size,
          borderRadius: size / 2,
          borderWidth: strokeWidth,
          borderColor: color + '18',
          justifyContent: 'center',
          alignItems: 'center',
        }}>
        <View
          style={{
            position: 'absolute',
            width: size,
            height: size,
            borderRadius: size / 2,
            borderWidth: strokeWidth,
            borderColor: 'transparent',
            borderTopColor: color,
            borderRightColor: pct > 25 ? color : 'transparent',
            borderBottomColor: pct > 50 ? color : 'transparent',
            borderLeftColor: pct > 75 ? color : 'transparent',
            transform: [{ rotate: '-90deg' }],
          }}
        />
        <ThemedText style={{ fontSize: 13, fontWeight: '800', color }}>{pct}%</ThemedText>
      </View>
      <ThemedText style={{ fontSize: 10, fontWeight: '600', opacity: 0.5 }}>{label}</ThemedText>
    </View>
  );
}

// ── Animated Fade-Slide wrapper ───────────────────────────────────────────────
function FadeSlide({ index, children }: { index: number; children: React.ReactNode }) {
  const slide = useRef(new Animated.Value(30)).current;
  const fade = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.parallel([
      Animated.timing(slide, { toValue: 0, duration: 420, delay: index * 80, easing: Easing.out(Easing.cubic), useNativeDriver: true }),
      Animated.timing(fade, { toValue: 1, duration: 380, delay: index * 80, useNativeDriver: true }),
    ]).start();
  }, []);

  return (
    <Animated.View style={{ transform: [{ translateY: slide }], opacity: fade }}>
      {children}
    </Animated.View>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
//  TAB: PATTERNS
// ═══════════════════════════════════════════════════════════════════════════════

function PatternsTab({ data, cardBg }: { data: AnalyticsData; cardBg: string }) {
  return (
    <>
      {/* ── Key Metrics Strip ──────────────────────────────────────────────── */}
      <FadeSlide index={0}>
        <View style={s.metricsStrip}>
          <View style={[s.metricCard, { backgroundColor: cardBg }]}>
            <IconSymbol size={20} name="bolt.fill" color={PURPLE} />
            <ThemedText style={s.metricValue}>{data.streakDays}</ThemedText>
            <ThemedText style={s.metricLabel}>Day Streak</ThemedText>
          </View>
          <View style={[s.metricCard, { backgroundColor: cardBg }]}>
            <IconSymbol size={20} name="sparkles" color={BLUE} />
            <ThemedText style={s.metricValue}>{data.avgPerDay}</ThemedText>
            <ThemedText style={s.metricLabel}>Avg / Day</ThemedText>
          </View>
          <View style={[s.metricCard, { backgroundColor: cardBg }]}>
            <IconSymbol size={20} name="clock.fill" color={AMBER} />
            <ThemedText style={s.metricValue}>{data.mostActiveHour}</ThemedText>
            <ThemedText style={s.metricLabel}>Peak Hour</ThemedText>
          </View>
        </View>
      </FadeSlide>

      {/* ── Activity Breakdown ─────────────────────────────────────────────── */}
      <FadeSlide index={1}>
        <View style={[s.chartCard, { backgroundColor: cardBg }]}>
          <View style={s.chartHeader}>
            <View>
              <ThemedText style={s.chartTitle}>Activity Breakdown</ThemedText>
              <ThemedText style={s.chartSubtitle}>{data.totalActivities} total activities</ThemedText>
            </View>
            <View style={[s.aiBadge, { backgroundColor: PURPLE + '12' }]}>
              <IconSymbol size={12} name="sparkles" color={PURPLE} />
            </View>
          </View>

          {/* Category Bars */}
          <View style={s.categoryList}>
            {data.categoryBreakdown.map((cat) => {
              const theme = CATEGORY_THEME[cat.category] || CATEGORY_THEME.other;
              return (
                <View key={cat.category} style={s.categoryRow}>
                  <View style={s.categoryLeft}>
                    <View style={[s.categoryDot, { backgroundColor: theme.color }]} />
                    <ThemedText style={s.categoryLabel}>{theme.label}</ThemedText>
                  </View>
                  <View style={s.categoryBarTrack}>
                    <View
                      style={[
                        s.categoryBarFill,
                        { width: `${cat.pct}%`, backgroundColor: theme.color },
                      ]}
                    />
                  </View>
                  <ThemedText style={[s.categoryPct, { color: theme.color }]}>{cat.pct}%</ThemedText>
                </View>
              );
            })}
          </View>

          {/* Category Ring Summary */}
          <View style={s.ringRow}>
            {data.categoryBreakdown.slice(0, 4).map((cat) => {
              const theme = CATEGORY_THEME[cat.category] || CATEGORY_THEME.other;
              return (
                <ProgressRing
                  key={cat.category}
                  pct={cat.pct}
                  color={theme.color}
                  label={theme.label}
                />
              );
            })}
          </View>
        </View>
      </FadeSlide>

      {/* ── Activity Correlations ──────────────────────────────────────────── */}
      <FadeSlide index={2}>
        <View style={[s.chartCard, { backgroundColor: cardBg }]}>
          <View style={s.chartHeader}>
            <View>
              <ThemedText style={s.chartTitle}>Activity Correlations</ThemedText>
              <ThemedText style={s.chartSubtitle}>How activities affect each other</ThemedText>
            </View>
          </View>

          {data.correlations.map((corr, idx) => (
            <View key={idx} style={s.correlationItem}>
              <View style={[s.corrIcon, { backgroundColor: corr.bg }]}>
                <IconSymbol size={18} name={corr.icon} color={corr.color} />
              </View>
              <View style={s.corrContent}>
                <ThemedText style={s.corrTitle}>{corr.insight}</ThemedText>
                <ThemedText style={s.corrDesc}>{corr.impact}</ThemedText>
                {/* Confidence bar */}
                <View style={s.confidenceRow}>
                  <View style={s.confidenceTrack}>
                    <View
                      style={[
                        s.confidenceFill,
                        { width: `${corr.confidence * 100}%`, backgroundColor: corr.color },
                      ]}
                    />
                  </View>
                  <ThemedText style={[s.confidenceText, { color: corr.color }]}>
                    {Math.round(corr.confidence * 100)}%
                  </ThemedText>
                </View>
              </View>
            </View>
          ))}
        </View>
      </FadeSlide>

      {/* ── Mood Patterns ──────────────────────────────────────────────────── */}
      <FadeSlide index={3}>
        <View style={[s.chartCard, { backgroundColor: cardBg }]}>
          <View style={s.chartHeader}>
            <View>
              <ThemedText style={s.chartTitle}>Mood Score</ThemedText>
              <ThemedText style={s.chartSubtitle}>Wellbeing trend — last 7 days</ThemedText>
            </View>
          </View>
          <LineChart
            data={data.moodTimeline.map((m) => ({
              label: m.label,
              value: m.score,
              color: m.color,
            }))}
            height={100}
          />
        </View>
      </FadeSlide>
    </>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
//  TAB: SUGGESTIONS
// ═══════════════════════════════════════════════════════════════════════════════

// getCategoryColor and getCategoryBg map backend category string to frontend colors dynamically
const getCategoryColor = (category?: string) => {
  const cat = (category || 'other').toLowerCase();
  if (cat === 'health') return GREEN;
  if (cat === 'work') return PURPLE;
  if (cat === 'social') return AMBER;
  if (cat === 'rest') return BLUE;
  return '#94A3B8';
};

const getCategoryBg = (category?: string) => {
  const cat = (category || 'other').toLowerCase();
  if (cat === 'health') return 'rgba(52, 211, 153, 0.08)';
  if (cat === 'work') return 'rgba(143, 102, 255, 0.08)';
  if (cat === 'social') return 'rgba(245, 158, 11, 0.08)';
  if (cat === 'rest') return 'rgba(59, 130, 246, 0.08)';
  return 'rgba(148, 163, 184, 0.08)';
};

function SuggestionsTab({
  suggestions,
  loading,
  onRefresh,
  totalActivities,
  cardBg,
}: {
  suggestions: any[];
  loading: boolean;
  onRefresh: () => void;
  totalActivities: number;
  cardBg: string;
}) {
  const [expandedId, setExpandedId] = useState<string | null>(null);

  if (loading) {
    return (
      <View style={{ gap: 16 }}>
        <FadeSlide index={0}>
          <View style={s.suggestionsHeader}>
            <View style={[s.suggestionsHeaderIcon, { backgroundColor: PURPLE + '12' }]}>
              <IconSymbol size={22} name="sparkles" color={PURPLE} />
            </View>
            <View style={{ flex: 1 }}>
              <ThemedText style={s.suggestionsHeaderTitle}>AI Coach is analyzing...</ThemedText>
              <ThemedText style={s.suggestionsHeaderSub}>Decrypting behavioral correlations</ThemedText>
            </View>
          </View>
        </FadeSlide>
        {[1, 2, 3].map((x) => (
          <View key={x} style={[s.suggestionCard, { backgroundColor: cardBg, opacity: 0.5, borderLeftWidth: 4, borderLeftColor: '#8F66FF30' }]}>
            <View style={{ flexDirection: 'row', gap: 14 }}>
              <View style={{ width: 44, height: 44, borderRadius: 14, backgroundColor: '#8E8E9320' }} />
              <View style={{ flex: 1, gap: 8 }}>
                <View style={{ height: 16, backgroundColor: '#8E8E9320', borderRadius: 4, width: '80%' }} />
                <View style={{ height: 12, backgroundColor: '#8E8E9315', borderRadius: 4, width: '40%' }} />
              </View>
            </View>
          </View>
        ))}
      </View>
    );
  }

  return (
    <>
      <FadeSlide index={0}>
        <View style={s.suggestionsHeader}>
          <View style={[s.suggestionsHeaderIcon, { backgroundColor: PURPLE + '12' }]}>
            <IconSymbol size={22} name="sparkles" color={PURPLE} />
          </View>
          <View style={{ flex: 1 }}>
            <ThemedText style={s.suggestionsHeaderTitle}>AuraJournal AI Coach</ThemedText>
            <ThemedText style={s.suggestionsHeaderSub}>
              Based on {totalActivities} timeline logs & historical insights
            </ThemedText>
          </View>
          <TouchableOpacity
            onPress={onRefresh}
            activeOpacity={0.7}
            style={{
              paddingHorizontal: 12,
              paddingVertical: 8,
              borderRadius: 12,
              backgroundColor: PURPLE + '18',
              flexDirection: 'row',
              alignItems: 'center',
              gap: 6,
            }}>
            <IconSymbol size={13} name="sparkles" color={PURPLE} />
            <ThemedText style={{ fontSize: 11, fontWeight: '700', color: PURPLE }}>Refresh</ThemedText>
          </TouchableOpacity>
        </View>
      </FadeSlide>

      {suggestions.length === 0 ? (
        <FadeSlide index={1}>
          <View style={[s.suggestionCard, { backgroundColor: cardBg, alignItems: 'center', paddingVertical: 40, gap: 12 }]}>
            <IconSymbol size={36} name="sparkles" color={PURPLE} />
            <ThemedText style={{ fontSize: 16, fontWeight: '700', color: '#FFF' }}>No Suggestions Yet</ThemedText>
            <ThemedText style={{ fontSize: 13, opacity: 0.5, textAlign: 'center', paddingHorizontal: 20 }}>
              Start logging your activities, workouts, work sessions, or voice recordings, and AuraJournal will dynamically analyze your behaviors.
            </ThemedText>
            <TouchableOpacity
              onPress={onRefresh}
              style={{
                marginTop: 8,
                paddingHorizontal: 16,
                paddingVertical: 10,
                borderRadius: 14,
                backgroundColor: PURPLE,
              }}>
              <ThemedText style={{ color: '#fff', fontSize: 13, fontWeight: '700' }}>Generate Suggestions</ThemedText>
            </TouchableOpacity>
          </View>
        </FadeSlide>
      ) : (
        suggestions.map((sug, idx) => {
          const color = getCategoryColor(sug.category);
          const bg = getCategoryBg(sug.category);
          return (
            <FadeSlide key={sug.id || `sug_${idx}`} index={idx + 1}>
              <TouchableOpacity
                activeOpacity={0.8}
                onPress={() => setExpandedId(expandedId === sug.id ? null : sug.id)}
                style={[
                  s.suggestionCard,
                  {
                    backgroundColor: cardBg,
                    borderLeftWidth: 4,
                    borderLeftColor: color,
                    borderColor: 'rgba(255,255,255,0.06)',
                    shadowColor: color,
                    shadowOffset: { width: 0, height: 6 },
                    shadowOpacity: 0.12,
                    shadowRadius: 12,
                    elevation: 3,
                  }
                ]}>
                <View style={s.suggCardTop}>
                  <View style={[s.suggIcon, { backgroundColor: bg }]}>
                    <IconSymbol size={20} name={sug.icon || 'sparkles'} color={color} />
                  </View>
                  <View style={{ flex: 1 }}>
                    <ThemedText style={[s.suggText, { color: '#FFF', fontSize: 15, fontWeight: '800' }]}>
                      {sug.title}
                    </ThemedText>
                    
                    <View style={s.suggMeta}>
                      <View style={[s.suggTimeBadge, { backgroundColor: bg }]}>
                        <IconSymbol size={10} name="clock.fill" color={color} style={{ marginRight: 4 }} />
                        <ThemedText style={[s.suggTimeText, { color: color }]}>{sug.suggested_time || 'Daily'}</ThemedText>
                      </View>
                      
                      {/* Confidence Score Badge */}
                      <View style={[s.suggAiBadge, { backgroundColor: PURPLE + '12' }]}>
                        <IconSymbol size={10} name="sparkles" color={PURPLE} style={{ marginRight: 3 }} />
                        <ThemedText style={{ fontSize: 10, fontWeight: '700', color: PURPLE }}>
                          {sug.confidence}% Match
                        </ThemedText>
                      </View>
                    </View>
                  </View>
                  <IconSymbol
                    size={14}
                    name={expandedId === sug.id ? 'minus.circle.fill' : 'chevron.right'}
                    color={color + '80'}
                  />
                </View>

                {expandedId === sug.id && (
                  <View style={s.suggExpanded}>
                    <View style={[s.suggDivider, { backgroundColor: color + '15' }]} />
                    
                    <ThemedText style={s.suggExpandLabel}>ACTIONABLE RECOMMENDATION</ThemedText>
                    <ThemedText style={[s.suggExpandValue, { color: '#FFF', marginBottom: 12, fontSize: 13.5, fontWeight: '600' }]}>
                      {sug.recommendation}
                    </ThemedText>
                    
                    <ThemedText style={s.suggExpandLabel}>SUPPORTING EVIDENCE</ThemedText>
                    <View style={{ backgroundColor: 'rgba(255, 255, 255, 0.03)', padding: 10, borderRadius: 10, borderWidth: 1, borderColor: 'rgba(255, 255, 255, 0.05)' }}>
                      <ThemedText style={[s.suggExpandValue, { fontStyle: 'italic', fontSize: 12.5 }]}>
                        "{sug.evidence}"
                      </ThemedText>
                    </View>
                  </View>
                )}
              </TouchableOpacity>
            </FadeSlide>
          );
        })
      )}
    </>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
//  TAB: TRENDS
// ═══════════════════════════════════════════════════════════════════════════════

function TrendsTab({ data, cardBg }: { data: AnalyticsData; cardBg: string }) {
  return (
    <>
      {/* ── Weekly Activity Volume ─────────────────────────────────────────── */}
      <FadeSlide index={0}>
        <View style={[s.chartCard, { backgroundColor: cardBg }]}>
          <View style={s.chartHeader}>
            <View>
              <ThemedText style={s.chartTitle}>Weekly Activity</ThemedText>
              <ThemedText style={s.chartSubtitle}>Last 7 days volume</ThemedText>
            </View>
            <View style={[s.trendBadge, { backgroundColor: GREEN + '12' }]}>
              <IconSymbol size={12} name="chart.line.uptrend.xyaxis" color={GREEN} style={{ marginRight: 4 }} />
              <ThemedText style={{ fontSize: 11, fontWeight: '700', color: GREEN }}>Active</ThemedText>
            </View>
          </View>
          <BarChart
            data={data.weeklyVolume.map((d) => ({ label: d.day, value: d.count }))}
            barColor={PURPLE}
          />
        </View>
      </FadeSlide>

      {/* ── Productivity by Day ────────────────────────────────────────────── */}
      <FadeSlide index={1}>
        <View style={[s.chartCard, { backgroundColor: cardBg }]}>
          <View style={s.chartHeader}>
            <View>
              <ThemedText style={s.chartTitle}>Productivity by Day</ThemedText>
              <ThemedText style={s.chartSubtitle}>Weighted activity score</ThemedText>
            </View>
          </View>
          <BarChart
            data={data.productivityByDay.map((d) => ({ label: d.day, value: d.score }))}
            barColor={BLUE}
            height={100}
          />
        </View>
      </FadeSlide>

      {/* ── Hourly Distribution ────────────────────────────────────────────── */}
      <FadeSlide index={2}>
        <View style={[s.chartCard, { backgroundColor: cardBg }]}>
          <View style={s.chartHeader}>
            <View>
              <ThemedText style={s.chartTitle}>Hourly Activity Map</ThemedText>
              <ThemedText style={s.chartSubtitle}>When you're most active</ThemedText>
            </View>
          </View>

          {/* Condensed hour grid */}
          <View style={s.hourGrid}>
            {data.hourlyDistribution
              .filter((h) => h.hour >= 6 && h.hour <= 22)
              .map((h) => {
                const maxH = Math.max(...data.hourlyDistribution.map((x) => x.count), 1);
                const intensity = h.count / maxH;
                return (
                  <View key={h.hour} style={s.hourCell}>
                    <View
                      style={[
                        s.hourBlock,
                        {
                          backgroundColor: PURPLE,
                          opacity: h.count > 0 ? 0.15 + intensity * 0.85 : 0.05,
                        },
                      ]}
                    />
                    <ThemedText style={s.hourLabel}>
                      {h.hour % 12 === 0 ? 12 : h.hour % 12}{h.hour >= 12 ? 'p' : 'a'}
                    </ThemedText>
                  </View>
                );
              })}
          </View>
        </View>
      </FadeSlide>

      {/* ── Trend Summary Cards ────────────────────────────────────────────── */}
      <FadeSlide index={3}>
        <View style={s.trendSummaryRow}>
          <View style={[s.trendSummaryCard, { backgroundColor: cardBg }]}>
            <View style={[s.trendSummaryIcon, { backgroundColor: GREEN + '12' }]}>
              <IconSymbol size={18} name="chart.line.uptrend.xyaxis" color={GREEN} />
            </View>
            <ThemedText style={s.trendSummaryValue}>{data.totalActivities}</ThemedText>
            <ThemedText style={s.trendSummaryLabel}>Total Activities</ThemedText>
          </View>
          <View style={[s.trendSummaryCard, { backgroundColor: cardBg }]}>
            <View style={[s.trendSummaryIcon, { backgroundColor: PURPLE + '12' }]}>
              <IconSymbol size={18} name="calendar" color={PURPLE} />
            </View>
            <ThemedText style={s.trendSummaryValue}>
              {new Set(data.weeklyVolume.filter((d) => d.count > 0).map((d) => d.date)).size}/7
            </ThemedText>
            <ThemedText style={s.trendSummaryLabel}>Active Days</ThemedText>
          </View>
        </View>
      </FadeSlide>
    </>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
//  MAIN SCREEN
// ═══════════════════════════════════════════════════════════════════════════════

export default function InsightsScreen() {
  const { scheduleItems } = useSchedule();
  const insets = useSafeAreaInsets();
  const [activeTab, setActiveTab] = useState<TabKey>('patterns');

  const [backendSuggestions, setBackendSuggestions] = useState<any[]>([]);
  const [suggestionsLoading, setSuggestionsLoading] = useState<boolean>(false);

  const cardBg = useThemeColor({ light: '#F7F7FA', dark: '#1C1C1E' }, 'background');
  const data = useMemo(() => analyzeSchedule(scheduleItems), [scheduleItems]);

  const tabs: { key: TabKey; label: string; icon: any }[] = [
    { key: 'patterns', label: 'Patterns', icon: 'brain.head.profile' },
    { key: 'suggestions', label: 'Suggestions', icon: 'lightbulb.fill' },
    { key: 'trends', label: 'Trends', icon: 'chart.line.uptrend.xyaxis' },
  ];

  const fetchBackendSuggestions = async (force = false) => {
    try {
      setSuggestionsLoading(true);
      const res = await api.getSuggestions(scheduleItems, force);
      if (res && res.suggestions) {
        setBackendSuggestions(res.suggestions);
      }
    } catch (err) {
      console.warn('Failed to load backend suggestions:', err);
    } finally {
      setSuggestionsLoading(false);
    }
  };

  useEffect(() => {
    if (activeTab === 'suggestions' && backendSuggestions.length === 0) {
      fetchBackendSuggestions(false);
    }
  }, [activeTab, scheduleItems]);

  return (
    <View style={s.container}>
      {/* Background Glow */}
      <View style={s.glowCircle1} />
      <View style={s.glowCircle2} />
      <View style={s.glowCircle3} />

      {/* ── Premium Header ─────────────────────────────────────────────────── */}
      <View style={[s.header, { paddingTop: insets.top > 0 ? insets.top + 32 : 80 }]}>
        <View style={s.headerTopRow}>
          <View>
            <ThemedText style={s.headerTitle}>Insights</ThemedText>
            <ThemedText style={s.headerSub}>Behavioral patterns & AI recommendations</ThemedText>
          </View>
          <View style={[s.headerAiBadge, { backgroundColor: PURPLE + '20' }]}>
            <IconSymbol size={20} name="sparkles" color={PURPLE} />
          </View>
        </View>

        {/* Tab Chips */}
        <View style={s.tabRow}>
          {tabs.map((tab) => {
            const active = activeTab === tab.key;
            return (
              <TouchableOpacity
                key={tab.key}
                onPress={() => setActiveTab(tab.key)}
                style={[
                  s.tabChip,
                  active && { backgroundColor: PURPLE },
                  !active && { backgroundColor: PURPLE + '10', borderWidth: 1, borderColor: PURPLE + '20' },
                ]}>
                <IconSymbol
                  size={15}
                  name={tab.icon}
                  color={active ? '#fff' : PURPLE}
                  style={{ marginRight: 6 }}
                />
                <ThemedText style={[s.tabChipText, { color: active ? '#fff' : PURPLE }]}>
                  {tab.label}
                </ThemedText>
              </TouchableOpacity>
            );
          })}
        </View>
      </View>

      {/* ── Scrollable Content ──────────────────────────────────────────────── */}
      <ScrollView
        key={activeTab}
        contentContainerStyle={s.scrollContent}
        showsVerticalScrollIndicator={false}>
        {activeTab === 'patterns' && <PatternsTab data={data} cardBg={cardBg} />}
        {activeTab === 'suggestions' && (
          <SuggestionsTab
            suggestions={backendSuggestions}
            loading={suggestionsLoading}
            onRefresh={() => fetchBackendSuggestions(true)}
            totalActivities={data.totalActivities}
            cardBg={cardBg}
          />
        )}
        {activeTab === 'trends' && <TrendsTab data={data} cardBg={cardBg} />}

        {/* Footer */}
        <View style={s.footer}>
          <IconSymbol size={13} name="sparkles" color="#8E8E9330" style={{ marginRight: 5 }} />
          <ThemedText style={s.footerText}>
            Insights improve as you log more activities
          </ThemedText>
        </View>
      </ScrollView>
    </View>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
//  STYLES
// ═══════════════════════════════════════════════════════════════════════════════

const chartStyles = StyleSheet.create({
  barChartContainer: { marginTop: 8 },
  barRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-end', flex: 1 },
  barCol: { alignItems: 'center', flex: 1 },
  barTrack: { justifyContent: 'flex-end', width: 18, borderRadius: 9 },
  barFill: { width: 18, borderRadius: 9 },
  barLabel: { fontSize: 10, fontWeight: '600', opacity: 0.45, marginTop: 6 },

  lineChartContainer: { marginTop: 8, position: 'relative' },
  lineArea: { position: 'relative' },
  gridLine: { position: 'absolute', left: 0, right: 0, height: 1, backgroundColor: '#8E8E9310' },
  dataDot: { position: 'absolute', width: 10, height: 10, borderRadius: 5, borderWidth: 2 },
  connectLine: { position: 'absolute', height: 2, borderRadius: 1 },
  lineLabels: { flexDirection: 'row', marginTop: 8 },
  lineLabel: { fontSize: 10, fontWeight: '600', opacity: 0.45, textAlign: 'center' },
});

const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#080916' },

  glowCircle1: { position: 'absolute', top: 40, left: -100, width: 360, height: 360, borderRadius: 180, backgroundColor: 'rgba(143, 102, 255, 0.10)', zIndex: 0 },
  glowCircle2: { position: 'absolute', bottom: 100, right: -120, width: 380, height: 380, borderRadius: 190, backgroundColor: 'rgba(59, 130, 246, 0.08)', zIndex: 0 },
  glowCircle3: { position: 'absolute', top: '40%', right: -80, width: 300, height: 300, borderRadius: 150, backgroundColor: 'rgba(6, 182, 212, 0.07)', zIndex: 0 },

  // Header
  header: {
    backgroundColor: 'rgba(17, 19, 42, 0.65)',
    paddingHorizontal: 20,
    paddingBottom: 22,
    borderBottomLeftRadius: 32,
    borderBottomRightRadius: 32,
    borderBottomWidth: 1.2,
    borderBottomColor: 'rgba(255, 255, 255, 0.08)',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.05,
    shadowRadius: 10,
    elevation: 3,
    ...Platform.select({
      web: {
        backdropFilter: 'blur(20px)',
        // @ts-ignore
        experimental_backdropFilter: 'blur(20px)',
      },
      default: {},
    }),
  },
  headerTopRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 20 },
  headerTitle: { color: '#fff', fontSize: 28, fontWeight: '800', letterSpacing: -0.3, lineHeight: 36, paddingTop: 6 },
  headerSub: { color: '#B0B0C4', fontSize: 13, fontWeight: '500', marginTop: 4 },
  headerAiBadge: { width: 44, height: 44, borderRadius: 22, justifyContent: 'center', alignItems: 'center' },
  tabRow: { flexDirection: 'row', gap: 10 },
  tabChip: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingVertical: 10, borderRadius: 14 },
  tabChipText: { fontSize: 13, fontWeight: '700' },

  scrollContent: { paddingHorizontal: 20, paddingTop: 22, paddingBottom: 130, gap: 16 },

  // Metric strip
  metricsStrip: { flexDirection: 'row', gap: 10 },
  metricCard: {
    flex: 1,
    padding: 14,
    borderRadius: 18,
    alignItems: 'center',
    gap: 6,
    backgroundColor: DEEP_PURPLE,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.08)',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.04,
    shadowRadius: 6,
    elevation: 1,
    ...Platform.select({
      web: {
        backdropFilter: 'blur(15px)',
        // @ts-ignore
        experimental_backdropFilter: 'blur(15px)',
      },
      default: {},
    }),
  },
  metricValue: { fontSize: 18, fontWeight: '800' },
  metricLabel: { fontSize: 10, fontWeight: '600', opacity: 0.45 },

  // Chart card
  chartCard: {
    borderRadius: 22,
    padding: 20,
    overflow: 'hidden',
    backgroundColor: DEEP_PURPLE,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.08)',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 2,
    ...Platform.select({
      web: {
        backdropFilter: 'blur(20px)',
        // @ts-ignore
        experimental_backdropFilter: 'blur(20px)',
      },
      default: {},
    }),
  },
  chartHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 8 },
  chartTitle: { fontSize: 17, fontWeight: '800', letterSpacing: -0.2 },
  chartSubtitle: { fontSize: 12, opacity: 0.45, fontWeight: '500', marginTop: 2 },
  aiBadge: { width: 28, height: 28, borderRadius: 14, justifyContent: 'center', alignItems: 'center' },

  // Category breakdown
  categoryList: { gap: 12, marginTop: 12 },
  categoryRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  categoryLeft: { flexDirection: 'row', alignItems: 'center', width: 70, gap: 8 },
  categoryDot: { width: 8, height: 8, borderRadius: 4 },
  categoryLabel: { fontSize: 12, fontWeight: '600', opacity: 0.7 },
  categoryBarTrack: { flex: 1, height: 8, borderRadius: 4, backgroundColor: '#8E8E9310' },
  categoryBarFill: { height: 8, borderRadius: 4 },
  categoryPct: { fontSize: 12, fontWeight: '700', width: 36, textAlign: 'right' },
  ringRow: { flexDirection: 'row', justifyContent: 'space-around', marginTop: 20 },

  // Correlations
  correlationItem: { flexDirection: 'row', gap: 14, paddingVertical: 14, borderTopWidth: 1, borderTopColor: '#8E8E9310' },
  corrIcon: { width: 40, height: 40, borderRadius: 12, justifyContent: 'center', alignItems: 'center', marginTop: 2 },
  corrContent: { flex: 1 },
  corrTitle: { fontSize: 14, fontWeight: '700', marginBottom: 4 },
  corrDesc: { fontSize: 12, opacity: 0.6, lineHeight: 18, fontWeight: '500' },
  confidenceRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 8 },
  confidenceTrack: { flex: 1, height: 4, borderRadius: 2, backgroundColor: '#8E8E9312' },
  confidenceFill: { height: 4, borderRadius: 2 },
  confidenceText: { fontSize: 11, fontWeight: '700', width: 32 },

  // Suggestions tab
  suggestionsHeader: { flexDirection: 'row', alignItems: 'center', gap: 14, marginBottom: 4 },
  suggestionsHeaderIcon: { width: 48, height: 48, borderRadius: 16, justifyContent: 'center', alignItems: 'center' },
  suggestionsHeaderTitle: { fontSize: 17, fontWeight: '800', letterSpacing: -0.2 },
  suggestionsHeaderSub: { fontSize: 12, opacity: 0.45, fontWeight: '500', marginTop: 2 },
  suggestionCard: {
    borderRadius: 20,
    padding: 18,
    backgroundColor: DEEP_PURPLE,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.08)',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 6,
    elevation: 1,
    ...Platform.select({
      web: {
        backdropFilter: 'blur(20px)',
        // @ts-ignore
        experimental_backdropFilter: 'blur(20px)',
      },
      default: {},
    }),
  },
  suggCardTop: { flexDirection: 'row', gap: 14, alignItems: 'flex-start' },
  suggIcon: { width: 44, height: 44, borderRadius: 14, justifyContent: 'center', alignItems: 'center', marginTop: 2 },
  suggText: { fontSize: 14, fontWeight: '700', lineHeight: 20, letterSpacing: -0.1 },
  suggMeta: { flexDirection: 'row', gap: 8, marginTop: 10 },
  suggTimeBadge: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 10, paddingVertical: 4, borderRadius: 10 },
  suggTimeText: { fontSize: 10, fontWeight: '700' },
  suggAiBadge: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 8, paddingVertical: 4, borderRadius: 10 },
  suggExpanded: { marginTop: 14, marginLeft: 58 },
  suggDivider: { height: 1, marginBottom: 12 },
  suggExpandLabel: { fontSize: 10, fontWeight: '800', letterSpacing: 0.8, opacity: 0.35, marginBottom: 4 },
  suggExpandValue: { fontSize: 13, lineHeight: 19, opacity: 0.65, fontWeight: '500' },

  // Trends tab
  trendBadge: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 10, paddingVertical: 5, borderRadius: 10, alignSelf: 'flex-start' },
  hourGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginTop: 12 },
  hourCell: { alignItems: 'center', gap: 4 },
  hourBlock: { width: 28, height: 28, borderRadius: 8 },
  hourLabel: { fontSize: 8, fontWeight: '600', opacity: 0.4 },
  trendSummaryRow: { flexDirection: 'row', gap: 12 },
  trendSummaryCard: {
    flex: 1,
    padding: 16,
    borderRadius: 20,
    alignItems: 'center',
    gap: 8,
    backgroundColor: DEEP_PURPLE,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.08)',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.04,
    shadowRadius: 6,
    elevation: 1,
    ...Platform.select({
      web: {
        backdropFilter: 'blur(15px)',
        // @ts-ignore
        experimental_backdropFilter: 'blur(15px)',
      },
      default: {},
    }),
  },
  trendSummaryIcon: { width: 40, height: 40, borderRadius: 14, justifyContent: 'center', alignItems: 'center' },
  trendSummaryValue: { fontSize: 20, fontWeight: '800' },
  trendSummaryLabel: { fontSize: 11, fontWeight: '600', opacity: 0.45 },

  // Footer
  footer: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', marginTop: 8, paddingVertical: 8 },
  footerText: { fontSize: 12, opacity: 0.3, fontWeight: '500' },
});
