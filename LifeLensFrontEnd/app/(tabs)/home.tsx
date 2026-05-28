import React, { useMemo, useRef, useEffect, useState } from 'react';
import {
  StyleSheet,
  View,
  ScrollView,
  TouchableOpacity,
  Animated,
  Easing,
  Dimensions,
  Modal,
  TextInput,
  ActivityIndicator,
} from 'react-native';
import { useRouter } from 'expo-router';
import { useAuth } from '@/context/auth';
import { useSchedule, getTodayDateStr, ScheduleItem } from '@/context/schedule';
import { useGoogleCalendar, GoogleCalendarEvent } from '@/context/google-calendar';
import { ThemedText } from '@/components/themed-text';
import { IconSymbol } from '@/components/ui/icon-symbol';

const SCREEN_WIDTH = Dimensions.get('window').width;

// ── Premium Dark-Mode Colors ────────────────────────────────────────────────
const PURPLE = '#8F66FF';
const LIGHT_PURPLE = '#C4A8FF';
const DARK_BG = '#0A0C1B';
const CARD_BG = '#161932';
const GLASS_BORDER = 'rgba(255, 255, 255, 0.14)';
const GREEN = '#81C784';
const BLUE = '#64B5F6';
const AMBER = '#FFB74D';
const RED = '#E57373';

// ── Time-Based Greeting ─────────────────────────────────────────────────────
function getGreeting(): { text: string; emoji: string; icon: 'sun.max.fill' | 'bolt.fill' | 'moon.fill' } {
  const hour = new Date().getHours();
  if (hour >= 5 && hour < 12) return { text: 'Good Morning', emoji: '☀️', icon: 'sun.max.fill' };
  if (hour >= 12 && hour < 17) return { text: 'Good Afternoon', emoji: '🌤️', icon: 'bolt.fill' };
  return { text: 'Good Evening', emoji: '🌙', icon: 'moon.fill' };
}

function getFormattedDate(): string {
  const now = new Date();
  return now.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' });
}

function getFirstName(fullName?: string): string {
  if (!fullName) return 'Journaler';
  return fullName.split(' ')[0];
}

// ── Merge & Sort Events Helper ──────────────────────────────────────────────
interface UnifiedEvent {
  id: string;
  title: string;
  time: string;
  icon: any;
  color: string;
  source: 'local' | 'google';
}

function formatTime12h(isoOrTime: string): string {
  try {
    if (isoOrTime.includes('T')) {
      const d = new Date(isoOrTime);
      const h = d.getHours();
      const m = d.getMinutes();
      const ampm = h >= 12 ? 'PM' : 'AM';
      const hh = h % 12 === 0 ? 12 : h % 12;
      return `${hh}:${String(m).padStart(2, '0')} ${ampm}`;
    }
    return isoOrTime;
  } catch {
    return isoOrTime;
  }
}

function getSortKey(isoOrTime: string): number {
  try {
    if (isoOrTime.includes('T')) {
      return new Date(isoOrTime).getTime();
    }
    return 0;
  } catch {
    return 0;
  }
}

const ICON_MAP: Record<string, any> = {
  walk: 'figure.walk',
  laptop: 'laptop',
  groups: 'groups',
  phone: 'phone',
  gym: 'gym',
  rest: 'rest',
};

const COLOR_MAP: Record<string, string> = {
  green: GREEN,
  purple: PURPLE,
  yellow: AMBER,
  gray: BLUE,
};

function mergeEvents(
  localItems: ScheduleItem[],
  googleEvents: GoogleCalendarEvent[],
  todayStr: string,
): UnifiedEvent[] {
  const events: (UnifiedEvent & { _sortKey: number })[] = [];
  const nowMs = Date.now();

  // Local events
  localItems
    .filter((i) => i.date === todayStr)
    .forEach((item) => {
      const rawTime = item.startTime || '';
      const sortKey = getSortKey(rawTime);

      // Filter out past local events (older than 30 minutes ago)
      if (sortKey > 0 && sortKey < nowMs - 30 * 60 * 1000) {
        return;
      }

      events.push({
        id: item.id,
        title: item.title,
        time: formatTime12h(rawTime),
        icon: ICON_MAP[item.icon] || 'calendar',
        color: COLOR_MAP[item.color] || PURPLE,
        source: 'local',
        _sortKey: sortKey,
      });
    });

  // Google events
  googleEvents.forEach((ge) => {
    const startMs = ge.isAllDay ? -1 : getSortKey(ge.startTime);
    const endMs = ge.isAllDay ? -1 : getSortKey(ge.endTime);

    // Filter out past Google events (keep if all day, or if end time is in the future)
    if (!ge.isAllDay && endMs > 0 && endMs < nowMs) {
      return;
    }

    events.push({
      id: ge.id,
      title: ge.title,
      time: ge.isAllDay ? 'All Day' : formatTime12h(ge.startTime),
      icon: 'calendar',
      color: BLUE,
      source: 'google',
      _sortKey: startMs,
    });
  });

  events.sort((a, b) => a._sortKey - b._sortKey);
  return events.map(({ _sortKey, ...rest }) => rest);
}

// ── Simple Analytics for Home ───────────────────────────────────────────────
interface HomeAnalytics {
  moodLabel: string;
  moodColor: string;
  productivityLabel: string;
  productivityColor: string;
  energyLabel: string;
  energyColor: string;
  bestSuggestion: {
    text: string;
    reason: string;
    icon: any;
    color: string;
    confidenceScore: number;
    evidenceCount: number;
  } | null;
}

function computeHomeAnalytics(items: ScheduleItem[], todayStr: string): HomeAnalytics {
  const todayItems = items.filter((i) => i.date === todayStr);
  const healthCount = todayItems.filter((x) => x.category === 'health').length;
  const workCount = todayItems.filter((x) => x.category === 'work').length;
  const socialCount = todayItems.filter((x) => x.category === 'social').length;
  const restCount = todayItems.filter((x) => x.category === 'rest').length;
  const totalToday = todayItems.length;

  // Mood
  let moodLabel = 'Neutral';
  let moodColor = BLUE;
  if (healthCount >= 2 && socialCount >= 1) { moodLabel = 'Great'; moodColor = GREEN; }
  else if (healthCount >= 1) { moodLabel = 'Good'; moodColor = GREEN; }
  else if (workCount >= 3) { moodLabel = 'Focused'; moodColor = PURPLE; }
  else if (totalToday === 0) { moodLabel = 'Awaiting data'; moodColor = 'rgba(255,255,255,0.3)'; }

  // Productivity
  let productivityLabel = 'Low';
  let productivityColor = AMBER;
  if (workCount >= 3) { productivityLabel = 'High'; productivityColor = GREEN; }
  else if (workCount >= 1) { productivityLabel = 'Moderate'; productivityColor = BLUE; }
  else if (totalToday === 0) { productivityLabel = '—'; productivityColor = 'rgba(255,255,255,0.3)'; }

  // Energy
  let energyLabel = 'Stable';
  let energyColor = BLUE;
  if (healthCount >= 2) { energyLabel = 'Improving'; energyColor = GREEN; }
  else if (workCount >= 4 && healthCount === 0) { energyLabel = 'Declining'; energyColor = RED; }
  else if (totalToday === 0) { energyLabel = '—'; energyColor = 'rgba(255,255,255,0.3)'; }

  // Best suggestion from all-time patterns
  const uniqueDates = Array.from(new Set(items.map((i) => i.date)));
  const dailyScores: Record<string, number> = {};

  const getDailyScore = (dayItems: ScheduleItem[]) => {
    let score = 50;
    score += dayItems.filter((x) => x.category === 'health').length * 15;
    score += dayItems.filter((x) => x.category === 'social').length * 10;
    score += dayItems.filter((x) => x.category === 'rest').length * 5;
    score -= Math.max(0, dayItems.filter((x) => x.category === 'work').length - 3) * 10;
    return Math.min(100, Math.max(10, score));
  };

  uniqueDates.forEach((date) => {
    dailyScores[date] = getDailyScore(items.filter((i) => i.date === date));
  });

  // Compute patterns for top suggestion
  const uniqueTitles = Array.from(new Set(items.map((i) => i.title?.trim()).filter(Boolean)));
  let bestSuggestion: HomeAnalytics['bestSuggestion'] = null;
  let bestConfidence = 0;

  uniqueTitles.forEach((rawTitle) => {
    const titleLower = rawTitle.toLowerCase();
    const occurrences = items.filter((i) => i.title?.trim().toLowerCase() === titleLower).length;
    if (occurrences < 1) return;

    const daysWithActivity = uniqueDates.filter((date) => 
      items.some((i) => i.date === date && i.title?.trim().toLowerCase() === titleLower)
    );
    const daysWithoutActivity = uniqueDates.filter((d) => !daysWithActivity.includes(d));

    const avgWith = daysWithActivity.reduce((a, d) => a + dailyScores[d], 0) / daysWithActivity.length;
    const avgWithout = daysWithoutActivity.length > 0
      ? daysWithoutActivity.reduce((a, d) => a + dailyScores[d], 0) / daysWithoutActivity.length
      : 50;

    const difference = avgWith - avgWithout;
    if (difference > 0) {
      const confidence = parseFloat(Math.min(0.99, 0.5 + occurrences * 0.1).toFixed(2));
      if (confidence > bestConfidence) {
        bestConfidence = confidence;
        const formattedTitle = rawTitle.trim().split(/\s+/).map(w => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase()).join(' ');
        
        let effectDesc = 'improved your wellbeing';
        if (titleLower.includes('walk') || titleLower.includes('morning')) effectDesc = 'improved your focus';
        else if (titleLower.includes('swim')) effectDesc = 'improved your sleep';
        else if (titleLower.includes('gym') || titleLower.includes('workout')) effectDesc = 'increased your energy';
        else if (titleLower.includes('coffee') || titleLower.includes('social')) effectDesc = 'improved your mood';

        let icon: any = 'sparkles';
        if (titleLower.includes('walk')) icon = 'figure.walk';
        else if (titleLower.includes('gym') || titleLower.includes('workout')) icon = 'gym';
        else if (titleLower.includes('swim')) icon = 'figure.pool.swim';
        else if (titleLower.includes('run')) icon = 'figure.run';

        bestSuggestion = {
          text: `${formattedTitle} ${effectDesc} in ${occurrences} recent logs.`,
          reason: `Your data shows a +${Math.round(difference)}% wellbeing boost on days with this activity.`,
          icon,
          color: GREEN,
          confidenceScore: confidence,
          evidenceCount: occurrences,
        };
      }
    }
  });

  return { moodLabel, moodColor, productivityLabel, productivityColor, energyLabel, energyColor, bestSuggestion };
}

// ── Fade-Slide Animation ────────────────────────────────────────────────────
function FadeSlide({ index, children }: { index: number; children: React.ReactNode }) {
  const slide = useRef(new Animated.Value(20)).current;
  const fade = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.parallel([
      Animated.timing(slide, { toValue: 0, duration: 380, delay: index * 60, easing: Easing.out(Easing.quad), useNativeDriver: true }),
      Animated.timing(fade, { toValue: 1, duration: 350, delay: index * 60, useNativeDriver: true }),
    ]).start();
  }, []);

  return (
    <Animated.View style={{ transform: [{ translateY: slide }], opacity: fade }}>
      {children}
    </Animated.View>
  );
}

// ── ISO Date Time Helpers for Direct Calendar Creation ────────────────────────
const getISOString = (dateStr: string, hourStr: string, minStr: string, ampm: string) => {
  let hour = parseInt(hourStr);
  const min = parseInt(minStr || '0');
  if (ampm === 'PM' && hour < 12) hour += 12;
  if (ampm === 'AM' && hour === 12) hour = 0;
  return `${dateStr}T${String(hour).padStart(2, '0')}:${String(min).padStart(2, '0')}:00`;
};

const getEndISOString = (dateStr: string, startHour: string, startMin: string, ampm: string, durationMin: number) => {
  let hour = parseInt(startHour);
  const min = parseInt(startMin || '0');
  if (ampm === 'PM' && hour < 12) hour += 12;
  if (ampm === 'AM' && hour === 12) hour = 0;

  const date = new Date(`${dateStr}T${String(hour).padStart(2, '0')}:${String(min).padStart(2, '0')}:00`);
  date.setMinutes(date.getMinutes() + durationMin);

  const endH = date.getHours();
  const endM = date.getMinutes();
  return `${dateStr}T${String(endH).padStart(2, '0')}:${String(endM).padStart(2, '0')}:00`;
};

function getLocalEventDetails(title: string): {
  category: 'health' | 'work' | 'social' | 'rest' | 'other';
  icon: 'walk' | 'laptop' | 'groups' | 'phone' | 'gym' | 'rest';
  color: 'green' | 'purple' | 'yellow' | 'gray';
} {
  const lower = title.toLowerCase();
  if (lower.includes('walk') || lower.includes('run') || lower.includes('swim') || lower.includes('hike')) {
    return { category: 'health', icon: 'walk', color: 'green' };
  }
  if (lower.includes('gym') || lower.includes('workout') || lower.includes('exercise')) {
    return { category: 'health', icon: 'gym', color: 'green' };
  }
  if (lower.includes('code') || lower.includes('work') || lower.includes('laptop') || lower.includes('meeting') || lower.includes('call') || lower.includes('presentation')) {
    return { category: 'work', icon: 'laptop', color: 'purple' };
  }
  if (lower.includes('coffee') || lower.includes('social') || lower.includes('lunch') || lower.includes('dinner') || lower.includes('party')) {
    return { category: 'social', icon: 'groups', color: 'yellow' };
  }
  return { category: 'rest', icon: 'rest', color: 'gray' };
}

// ═════════════════════════════════════════════════════════════════════════════
//  MAIN HOME SCREEN
// ═════════════════════════════════════════════════════════════════════════════
export default function HomeScreen() {
  const { user } = useAuth();
  const { scheduleItems } = useSchedule();
  const { googleEvents, isSignedIn, signIn } = useGoogleCalendar();
  const router = useRouter();

  const todayStr = getTodayDateStr();
  const greeting = useMemo(() => getGreeting(), []);
  const dateLabel = useMemo(() => getFormattedDate(), []);

  // Quick Event Modal states
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [eventTitle, setEventTitle] = useState('');
  const [selectedHour, setSelectedHour] = useState('');
  const [selectedMin, setSelectedMin] = useState('00');
  const [selectedAmPm, setSelectedAmPm] = useState<'AM' | 'PM'>('AM');
  const [selectedDuration, setSelectedDuration] = useState(60); // minutes
  const [targetCalendar, setTargetCalendar] = useState<'local' | 'google'>('local');
  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const [eventCreating, setEventCreating] = useState(false);
  const toastOpacity = useRef(new Animated.Value(0)).current;

  const showToast = (msg: string) => {
    setToastMessage(msg);
    Animated.sequence([
      Animated.timing(toastOpacity, { toValue: 1, duration: 300, useNativeDriver: true }),
      Animated.delay(2000),
      Animated.timing(toastOpacity, { toValue: 0, duration: 400, useNativeDriver: true }),
    ]).start(() => {
      setToastMessage(null);
    });
  };

  const handleQuickAddClick = (activityLabel: string) => {
    setEventTitle(activityLabel);
    // Pre-fill time with the nearest upcoming hour
    const now = new Date();
    let nextHour = now.getHours() + 1;
    let ampm: 'AM' | 'PM' = 'AM';
    if (nextHour >= 12) {
      ampm = 'PM';
      if (nextHour > 12) nextHour -= 12;
    } else if (nextHour === 0) {
      nextHour = 12;
    }
    setSelectedHour(String(nextHour));
    setSelectedMin('00');
    setSelectedAmPm(ampm);
    setSelectedDuration(60);
    setTargetCalendar(isSignedIn ? 'google' : 'local');
    setIsModalOpen(true);
  };

  const handleAiSuggestionClick = (suggestionText: string) => {
    let title = 'Wellness Activity';
    const textLower = suggestionText.toLowerCase();
    
    if (textLower.includes('walk')) title = 'Morning Walk';
    else if (textLower.includes('gym') || textLower.includes('workout')) title = 'Gym Session';
    else if (textLower.includes('swim')) title = 'Swimming';
    else if (textLower.includes('run')) title = 'Running';
    else if (textLower.includes('coffee')) title = 'Coffee Break';
    else if (textLower.includes('rest')) title = 'Rest Period';
    else {
      const words = suggestionText.split(' ');
      if (words.length > 1) {
        title = words.slice(0, 2).map(w => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase()).join(' ');
      }
    }
    
    setEventTitle(title);
    setSelectedHour(''); // MANDATORY - force user to select time!
    setSelectedMin('00');
    setSelectedAmPm('AM');
    setSelectedDuration(45);
    setTargetCalendar(isSignedIn ? 'google' : 'local');
    setIsModalOpen(true);
  };

  const { addNoteAndExtract } = useSchedule();
  const { createEvent: createGoogleEvent } = useGoogleCalendar();

  const handleConfirmEvent = async () => {
    if (!selectedHour) {
      alert('Time Selection Required! Please select an hour to schedule this event.');
      return;
    }

    setEventCreating(true);
    try {
      const startISO = getISOString(todayStr, selectedHour, selectedMin, selectedAmPm);
      const endISO = getEndISOString(todayStr, selectedHour, selectedMin, selectedAmPm, selectedDuration);

      const timeRangeStr = `${selectedHour}:${selectedMin} ${selectedAmPm} - ${formatTime12h(endISO)}`;
      const details = getLocalEventDetails(eventTitle);

      if (targetCalendar === 'google') {
        const success = await createGoogleEvent(eventTitle, startISO, endISO);
        if (success) {
          showToast('Event added successfully');
          setIsModalOpen(false);
        } else {
          showToast('Failed to add to Google Calendar. Adding locally...');
          // Fallback to local
          const newLocalItem: ScheduleItem = {
            id: Math.random().toString(),
            title: eventTitle,
            timeRange: timeRangeStr,
            category: details.category,
            icon: details.icon,
            color: details.color,
            date: todayStr,
            startTime: startISO,
            endTime: endISO,
            isAiExtracted: false,
          };
          addNoteAndExtract(eventTitle, todayStr, [newLocalItem]);
          setIsModalOpen(false);
        }
      } else {
        const newLocalItem: ScheduleItem = {
          id: Math.random().toString(),
          title: eventTitle,
          timeRange: timeRangeStr,
          category: details.category,
          icon: details.icon,
          color: details.color,
          date: todayStr,
          startTime: startISO,
          endTime: endISO,
          isAiExtracted: false,
        };
        addNoteAndExtract(eventTitle, todayStr, [newLocalItem]);
        showToast('Event added successfully');
        setIsModalOpen(false);
      }
    } catch (e) {
      console.error(e);
      showToast('Error scheduling event');
    } finally {
      setEventCreating(false);
    }
  };
  const firstName = useMemo(() => getFirstName(user?.full_name), [user?.full_name]);

  const analytics = useMemo(() => computeHomeAnalytics(scheduleItems, todayStr), [scheduleItems, todayStr]);
  const mergedEvents = useMemo(() => mergeEvents(scheduleItems, googleEvents, todayStr), [scheduleItems, googleEvents, todayStr]);

  const quickAddActivities = [
    { label: 'Walk', icon: 'figure.walk' as const, color: GREEN, bg: 'rgba(129, 199, 132, 0.12)' },
    { label: 'Run', icon: 'figure.run' as const, color: '#FF8A65', bg: 'rgba(255, 138, 101, 0.12)' },
    { label: 'Swim', icon: 'figure.pool.swim' as const, color: BLUE, bg: 'rgba(100, 181, 246, 0.12)' },
    { label: 'Play', icon: 'sportscourt.fill' as const, color: AMBER, bg: 'rgba(255, 183, 77, 0.12)' },
    { label: 'Gym', icon: 'gym' as const, color: RED, bg: 'rgba(229, 115, 115, 0.12)' },
  ];

  return (
    <View style={s.container}>
      {/* Background Glow */}
      <View style={s.glowCircle1} />
      <View style={s.glowCircle2} />

      <ScrollView contentContainerStyle={s.scrollContent} showsVerticalScrollIndicator={false}>
        {/* ── Greeting Header ──────────────────────────────────────────── */}
        <FadeSlide index={0}>
          <View style={s.greetingSection}>
            <View style={s.greetingTopRow}>
              <View style={{ flex: 1 }}>
                <ThemedText style={s.greetingText}>
                  {greeting.text}, {firstName} {greeting.emoji}
                </ThemedText>
                <ThemedText style={s.dateLabel}>
                  {dateLabel}
                </ThemedText>
              </View>
              <TouchableOpacity style={s.notifBadge}>
                <IconSymbol size={22} name="bell.fill" color={LIGHT_PURPLE} />
              </TouchableOpacity>
            </View>
          </View>
        </FadeSlide>

        {/* ── AI Suggestion Card ───────────────────────────────────────── */}
        <FadeSlide index={1}>
          <View style={s.suggestionCard}>
            <View style={s.suggestionHeader}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                <IconSymbol size={18} name="sparkles" color={PURPLE} />
                <ThemedText style={s.suggestionHeaderText}>AI Suggestion</ThemedText>
              </View>
              <View style={s.bestForYouBadge}>
                <ThemedText style={s.bestForYouText}>BEST FOR YOU</ThemedText>
              </View>
            </View>

            {analytics.bestSuggestion ? (
              <>
                <View style={s.suggestionBody}>
                  <View style={[s.suggestionIconCircle, { backgroundColor: analytics.bestSuggestion.color + '18' }]}>
                    <IconSymbol size={28} name={analytics.bestSuggestion.icon} color={analytics.bestSuggestion.color} />
                  </View>
                  <View style={{ flex: 1 }}>
                    <ThemedText style={s.suggestionText}>
                      {analytics.bestSuggestion.text}
                    </ThemedText>
                    <ThemedText style={s.suggestionEvidence}>
                      {analytics.bestSuggestion.reason}
                    </ThemedText>
                    <View style={s.suggestionMetaRow}>
                      <View style={s.confidencePill}>
                        <ThemedText style={s.confidencePillText}>
                          {Math.round(analytics.bestSuggestion.confidenceScore * 100)}% Confidence
                        </ThemedText>
                      </View>
                      <ThemedText style={s.evidenceText}>
                        {analytics.bestSuggestion.evidenceCount} evidence days
                      </ThemedText>
                    </View>
                  </View>
                </View>
                <View style={s.suggestionActions}>
                  <TouchableOpacity
                    style={s.suggestionPrimaryBtn}
                    onPress={() => handleAiSuggestionClick(analytics.bestSuggestion.text)}>
                    <ThemedText style={s.suggestionPrimaryBtnText}>Add to Calendar</ThemedText>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={s.suggestionSecondaryBtn}
                    onPress={() => router.push('/(tabs)/suggestions')}>
                    <ThemedText style={s.suggestionSecondaryBtnText}>View all</ThemedText>
                  </TouchableOpacity>
                </View>
              </>
            ) : (
              <View style={s.emptySuggestion}>
                <IconSymbol size={28} name="sparkles" color="rgba(255,255,255,0.15)" />
                <ThemedText style={s.emptySuggestionText}>
                  Log more activities to unlock personalized suggestions.
                </ThemedText>
              </View>
            )}
          </View>
        </FadeSlide>

        {/* ── Today's Schedule ─────────────────────────────────────────── */}
        <FadeSlide index={2}>
          <View style={s.sectionHeaderRow}>
            <ThemedText style={s.sectionTitle}>Today's Schedule</ThemedText>
            <TouchableOpacity onPress={() => router.push('/(tabs)')}>
              <ThemedText style={s.sectionLink}>View calendar</ThemedText>
            </TouchableOpacity>
          </View>

          <View style={s.scheduleCard}>
            {mergedEvents.length > 0 ? (
              mergedEvents.slice(0, 3).map((ev, idx) => (
                <View
                  key={ev.id}
                  style={[s.scheduleRow, idx < Math.min(mergedEvents.length, 3) - 1 && s.scheduleRowBorder]}>
                  <ThemedText style={s.scheduleTime}>{ev.time}</ThemedText>
                  <ThemedText style={s.scheduleTitle} numberOfLines={1}>{ev.title}</ThemedText>
                  <View style={[s.scheduleIconCircle, { backgroundColor: ev.color + '15' }]}>
                    <IconSymbol size={16} name={ev.icon} color={ev.color} />
                  </View>
                </View>
              ))
            ) : (
              <View style={s.emptySchedule}>
                <IconSymbol size={24} name="calendar" color="rgba(255,255,255,0.15)" />
                <ThemedText style={s.emptyScheduleText}>No events scheduled for today</ThemedText>
              </View>
            )}
          </View>

          {!isSignedIn && (
            <TouchableOpacity style={s.connectGoogleBtn} onPress={signIn}>
              <IconSymbol size={16} name="link" color={PURPLE} style={{ marginRight: 8 }} />
              <ThemedText style={s.connectGoogleText}>Connect Google Calendar</ThemedText>
            </TouchableOpacity>
          )}
        </FadeSlide>

        {/* ── Daily Summary ────────────────────────────────────────────── */}
        <FadeSlide index={3}>
          <View style={s.sectionHeaderRow}>
            <ThemedText style={s.sectionTitle}>Daily Summary</ThemedText>
          </View>
          <View style={s.summaryStrip}>
            <View style={s.summaryCard}>
              <IconSymbol size={20} name="brain.head.profile" color={analytics.moodColor} />
              <ThemedText style={[s.summaryValue, { color: analytics.moodColor }]}>{analytics.moodLabel}</ThemedText>
              <ThemedText style={s.summaryLabel}>Mood</ThemedText>
            </View>
            <View style={s.summaryCard}>
              <IconSymbol size={20} name="bolt.fill" color={analytics.productivityColor} />
              <ThemedText style={[s.summaryValue, { color: analytics.productivityColor }]}>{analytics.productivityLabel}</ThemedText>
              <ThemedText style={s.summaryLabel}>Productivity</ThemedText>
            </View>
            <View style={s.summaryCard}>
              <IconSymbol size={20} name="chart.line.uptrend.xyaxis" color={analytics.energyColor} />
              <ThemedText style={[s.summaryValue, { color: analytics.energyColor }]}>{analytics.energyLabel}</ThemedText>
              <ThemedText style={s.summaryLabel}>Energy</ThemedText>
            </View>
          </View>
        </FadeSlide>

        {/* ── Quick Add Activity ───────────────────────────────────────── */}
        <FadeSlide index={4}>
          <View style={s.sectionHeaderRow}>
            <ThemedText style={s.sectionTitle}>Quick Add Activity</ThemedText>
            <TouchableOpacity onPress={() => router.push({ pathname: '/modal', params: { date: todayStr } })}>
              <ThemedText style={s.sectionLink}>See all</ThemedText>
            </TouchableOpacity>
          </View>
          <View style={s.quickAddStrip}>
            {quickAddActivities.map((act) => (
              <TouchableOpacity
                key={act.label}
                style={s.quickAddBtn}
                onPress={() => handleQuickAddClick(act.label)}>
                <View style={[s.quickAddCircle, { backgroundColor: act.bg }]}>
                  <IconSymbol size={24} name={act.icon} color={act.color} />
                </View>
                <ThemedText style={s.quickAddLabel}>{act.label}</ThemedText>
              </TouchableOpacity>
            ))}
          </View>
        </FadeSlide>

        {/* Footer */}
        <View style={s.footer}>
          <IconSymbol size={13} name="sparkles" color="rgba(255, 255, 255, 0.15)" style={{ marginRight: 5 }} />
          <ThemedText style={s.footerText}>
            AuraJournal — Your personal wellness companion
          </ThemedText>
        </View>
      </ScrollView>

      {/* ── Quick Event Modal ─────────────────────────────────────────── */}
      <Modal
        visible={isModalOpen}
        transparent={true}
        animationType="fade"
        onRequestClose={() => setIsModalOpen(false)}>
        <View style={s.modalOverlay}>
          <View style={s.modalContainer}>
            {/* Modal Title & Close */}
            <View style={s.modalHeader}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                <IconSymbol size={20} name="sparkles" color={PURPLE} />
                <ThemedText style={s.modalTitle}>At what time should I schedule this?</ThemedText>
              </View>
              <TouchableOpacity onPress={() => setIsModalOpen(false)} style={s.closeBtn}>
                <IconSymbol size={18} name="xmark" color="#fff" />
              </TouchableOpacity>
            </View>

            {/* Event Title Field */}
            <ThemedText style={s.modalSectionLabel}>Event Title</ThemedText>
            <TextInput
              style={s.modalInput}
              value={eventTitle}
              onChangeText={setEventTitle}
              placeholder="e.g. Morning Walk"
              placeholderTextColor="rgba(255, 255, 255, 0.4)"
            />

            {/* Time Selection (MANDATORY) */}
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: 14, marginBottom: 8 }}>
              <ThemedText style={s.modalSectionLabel}>
                Select Time <ThemedText style={{ color: RED }}>*</ThemedText>
              </ThemedText>
              {!selectedHour && (
                <ThemedText style={s.validationErrorText}>Please select an hour</ThemedText>
              )}
            </View>

            {/* Hours Grid */}
            <View style={s.hoursGrid}>
              {['1', '2', '3', '4', '5', '6', '7', '8', '9', '10', '11', '12'].map((h) => {
                const isSelected = selectedHour === h;
                return (
                  <TouchableOpacity
                    key={h}
                    style={[s.hourChip, isSelected && s.selectedHourChip]}
                    onPress={() => setSelectedHour(h)}>
                    <ThemedText style={[s.hourChipText, isSelected && s.selectedHourChipText]}>{h}</ThemedText>
                  </TouchableOpacity>
                );
              })}
            </View>

            {/* Minutes & AM/PM Selectors */}
            <View style={s.timeDetailRow}>
              {/* Minutes Selection */}
              <View style={{ flex: 2 }}>
                <ThemedText style={s.modalSubSectionLabel}>Minutes</ThemedText>
                <View style={s.minutesRow}>
                  {['00', '15', '30', '45'].map((m) => {
                    const isSelected = selectedMin === m;
                    return (
                      <TouchableOpacity
                        key={m}
                        style={[s.minuteChip, isSelected && s.selectedMinuteChip]}
                        onPress={() => setSelectedMin(m)}>
                        <ThemedText style={[s.minuteChipText, isSelected && s.selectedMinuteChipText]}>{m}</ThemedText>
                      </TouchableOpacity>
                    );
                  })}
                </View>
              </View>

              {/* AM/PM Toggle */}
              <View style={{ flex: 1 }}>
                <ThemedText style={s.modalSubSectionLabel}>Period</ThemedText>
                <View style={s.ampmContainer}>
                  {(['AM', 'PM'] as const).map((p) => {
                    const isSelected = selectedAmPm === p;
                    return (
                      <TouchableOpacity
                        key={p}
                        style={[s.ampmChip, isSelected && s.selectedAmpmChip]}
                        onPress={() => setSelectedAmPm(p)}>
                        <ThemedText style={[s.ampmChipText, isSelected && s.selectedAmpmChipText]}>{p}</ThemedText>
                      </TouchableOpacity>
                    );
                  })}
                </View>
              </View>
            </View>

            {/* Duration Selection */}
            <ThemedText style={[s.modalSectionLabel, { marginTop: 14 }]}>Duration</ThemedText>
            <View style={s.durationRow}>
              {[
                { label: '30 min', value: 30 },
                { label: '45 min', value: 45 },
                { label: '1 hr', value: 60 },
                { label: '1.5 hr', value: 90 },
                { label: '2 hr', value: 120 },
              ].map((d) => {
                const isSelected = selectedDuration === d.value;
                return (
                  <TouchableOpacity
                    key={d.label}
                    style={[s.durationChip, isSelected && s.selectedDurationChip]}
                    onPress={() => setSelectedDuration(d.value)}>
                    <ThemedText style={[s.durationChipText, isSelected && s.selectedDurationChipText]}>{d.label}</ThemedText>
                  </TouchableOpacity>
                );
              })}
            </View>

            {/* Calendar Destination Selection */}
            {isSignedIn && (
              <View style={{ marginTop: 14 }}>
                <ThemedText style={s.modalSectionLabel}>Save Destination</ThemedText>
                <View style={s.calendarSelectRow}>
                  <TouchableOpacity
                    style={[s.calendarOption, targetCalendar === 'local' && s.selectedCalendarOption]}
                    onPress={() => setTargetCalendar('local')}>
                    <IconSymbol size={16} name="calendar" color={targetCalendar === 'local' ? PURPLE : '#D2D2E6'} />
                    <ThemedText style={[s.calendarOptionText, targetCalendar === 'local' && s.selectedCalendarOptionText]}>
                      Local Calendar
                    </ThemedText>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={[s.calendarOption, targetCalendar === 'google' && s.selectedCalendarOption]}
                    onPress={() => setTargetCalendar('google')}>
                    <IconSymbol size={16} name="link" color={targetCalendar === 'google' ? PURPLE : '#D2D2E6'} />
                    <ThemedText style={[s.calendarOptionText, targetCalendar === 'google' && s.selectedCalendarOptionText]}>
                      Google Calendar
                    </ThemedText>
                  </TouchableOpacity>
                </View>
              </View>
            )}

            {/* Action Buttons */}
            <View style={s.modalActions}>
              <TouchableOpacity
                style={s.modalCancelBtn}
                onPress={() => setIsModalOpen(false)}>
                <ThemedText style={s.modalCancelBtnText}>Cancel</ThemedText>
              </TouchableOpacity>
              <TouchableOpacity
                style={[s.modalConfirmBtn, !selectedHour && s.modalConfirmBtnDisabled]}
                onPress={handleConfirmEvent}
                disabled={eventCreating || !selectedHour}>
                {eventCreating ? (
                  <ActivityIndicator size="small" color="#fff" />
                ) : (
                  <ThemedText style={s.modalConfirmBtnText}>Confirm</ThemedText>
                )}
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* ── Toast Success Message ──────────────────────────────────────── */}
      {toastMessage && (
        <Animated.View style={[s.toastContainer, { opacity: toastOpacity }]}>
          <View style={s.toastContent}>
            <View style={s.toastIconCircle}>
              <IconSymbol size={14} name="checkmark" color={GREEN} />
            </View>
            <ThemedText style={s.toastText}>{toastMessage}</ThemedText>
          </View>
        </Animated.View>
      )}
    </View>
  );
}

// ═════════════════════════════════════════════════════════════════════════════
//  STYLES
// ═════════════════════════════════════════════════════════════════════════════
const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: DARK_BG },

  glowCircle1: { position: 'absolute', top: 80, left: -60, width: 220, height: 220, borderRadius: 110, backgroundColor: 'rgba(143, 102, 255, 0.05)' },
  glowCircle2: { position: 'absolute', bottom: 120, right: -50, width: 240, height: 240, borderRadius: 120, backgroundColor: 'rgba(100, 181, 246, 0.04)' },

  scrollContent: { paddingTop: 60, paddingHorizontal: 20, paddingBottom: 40, gap: 20 },

  // Greeting
  greetingSection: { marginBottom: 4 },
  greetingTopRow: { flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between' },
  greetingText: { color: '#fff', fontSize: 24, fontWeight: '800', letterSpacing: -0.3 },
  dateLabel: { color: '#D2D2E6', fontSize: 14, fontWeight: '600', marginTop: 4 },
  notifBadge: { width: 42, height: 42, borderRadius: 21, backgroundColor: 'rgba(143, 102, 255, 0.12)', justifyContent: 'center', alignItems: 'center', marginTop: 2 },

  // AI Suggestion Card
  suggestionCard: { borderRadius: 24, padding: 20, backgroundColor: CARD_BG, borderWidth: 1, borderColor: GLASS_BORDER, overflow: 'hidden' },
  suggestionHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 },
  suggestionHeaderText: { color: '#fff', fontSize: 16, fontWeight: '800' },
  bestForYouBadge: { backgroundColor: 'rgba(143, 102, 255, 0.15)', paddingHorizontal: 10, paddingVertical: 4, borderRadius: 8 },
  bestForYouText: { color: PURPLE, fontSize: 10, fontWeight: '900', letterSpacing: 0.5 },
  suggestionBody: { flexDirection: 'row', gap: 14, marginBottom: 16 },
  suggestionIconCircle: { width: 52, height: 52, borderRadius: 16, justifyContent: 'center', alignItems: 'center' },
  suggestionText: { color: '#fff', fontSize: 14, fontWeight: '700', lineHeight: 20, marginBottom: 4 },
  suggestionEvidence: { color: '#D2D2E6', fontSize: 12, fontWeight: '600', lineHeight: 17, marginBottom: 8 },
  suggestionMetaRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  confidencePill: { backgroundColor: 'rgba(129, 199, 132, 0.15)', paddingHorizontal: 8, paddingVertical: 3, borderRadius: 6 },
  confidencePillText: { color: GREEN, fontSize: 10, fontWeight: '800' },
  evidenceText: { color: '#D2D2E6', fontSize: 11, fontWeight: '700' },
  suggestionActions: { flexDirection: 'row', gap: 12 },
  suggestionPrimaryBtn: { flex: 1, height: 42, borderRadius: 12, backgroundColor: PURPLE, justifyContent: 'center', alignItems: 'center' },
  suggestionPrimaryBtnText: { color: '#fff', fontSize: 14, fontWeight: '800' },
  suggestionSecondaryBtn: { flex: 1, height: 42, borderRadius: 12, borderWidth: 1.5, borderColor: PURPLE, justifyContent: 'center', alignItems: 'center' },
  suggestionSecondaryBtnText: { color: PURPLE, fontSize: 14, fontWeight: '800' },
  emptySuggestion: { alignItems: 'center', paddingVertical: 20, gap: 10 },
  emptySuggestionText: { color: '#D2D2E6', fontSize: 13, fontWeight: '600', textAlign: 'center' },

  // Section Headers
  sectionHeaderRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 },
  sectionTitle: { color: '#fff', fontSize: 18, fontWeight: '800' },
  sectionLink: { color: PURPLE, fontSize: 13, fontWeight: '700' },

  // Schedule Card
  scheduleCard: { borderRadius: 20, backgroundColor: CARD_BG, borderWidth: 1, borderColor: GLASS_BORDER, overflow: 'hidden' },
  scheduleRow: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingVertical: 14, gap: 14 },
  scheduleRowBorder: { borderBottomWidth: 1, borderBottomColor: 'rgba(255, 255, 255, 0.06)' },
  scheduleTime: { color: LIGHT_PURPLE, fontSize: 13, fontWeight: '800', width: 78 },
  scheduleTitle: { flex: 1, color: '#fff', fontSize: 14, fontWeight: '700' },
  scheduleIconCircle: { width: 34, height: 34, borderRadius: 10, justifyContent: 'center', alignItems: 'center' },
  emptySchedule: { alignItems: 'center', paddingVertical: 28, gap: 10 },
  emptyScheduleText: { color: '#D2D2E6', fontSize: 13, fontWeight: '600' },

  // Connect Google
  connectGoogleBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', marginTop: 10, height: 44, borderRadius: 14, borderWidth: 1.5, borderColor: PURPLE, backgroundColor: 'rgba(143, 102, 255, 0.06)' },
  connectGoogleText: { color: PURPLE, fontSize: 14, fontWeight: '700' },

  // Daily Summary
  summaryStrip: { flexDirection: 'row', gap: 10 },
  summaryCard: { flex: 1, paddingVertical: 16, paddingHorizontal: 8, borderRadius: 18, alignItems: 'center', gap: 6, backgroundColor: CARD_BG, borderWidth: 1, borderColor: GLASS_BORDER },
  summaryValue: { fontSize: 14, fontWeight: '900' },
  summaryLabel: { fontSize: 11, fontWeight: '800', color: LIGHT_PURPLE },

  // Quick Add
  quickAddStrip: { flexDirection: 'row', justifyContent: 'space-between' },
  quickAddBtn: { alignItems: 'center', gap: 6, width: (SCREEN_WIDTH - 40) / 5 },
  quickAddCircle: { width: 52, height: 52, borderRadius: 26, justifyContent: 'center', alignItems: 'center' },
  quickAddLabel: { color: '#D2D2E6', fontSize: 12, fontWeight: '700' },

  // Footer
  footer: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', marginTop: 10, paddingVertical: 8 },
  footerText: { fontSize: 12, color: '#C4A8FF', fontWeight: '700', opacity: 0.8 },

  // ── Quick Event Modal & Toast Styles ───────────────────────────────────────
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(10, 12, 27, 0.85)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  modalContainer: {
    width: '100%',
    maxWidth: 400,
    backgroundColor: '#161932',
    borderRadius: 24,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.14)',
    padding: 22,
    gap: 12,
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  modalTitle: {
    fontSize: 16,
    fontWeight: '800',
    color: '#fff',
  },
  closeBtn: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: 'rgba(255, 255, 255, 0.08)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalSectionLabel: {
    fontSize: 13,
    fontWeight: '800',
    color: '#C4A8FF',
    marginBottom: 4,
  },
  validationErrorText: {
    fontSize: 12,
    fontWeight: '700',
    color: RED,
  },
  modalSubSectionLabel: {
    fontSize: 11,
    fontWeight: '800',
    color: 'rgba(255, 255, 255, 0.5)',
    marginBottom: 6,
  },
  modalInput: {
    height: 48,
    borderRadius: 12,
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.1)',
    color: '#fff',
    fontSize: 15,
    fontWeight: '700',
    paddingHorizontal: 16,
  },
  hoursGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    justifyContent: 'space-between',
  },
  hourChip: {
    width: (SCREEN_WIDTH - 84 - 24) / 6,
    height: 38,
    borderRadius: 10,
    backgroundColor: 'rgba(255, 255, 255, 0.04)',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.06)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  selectedHourChip: {
    backgroundColor: PURPLE,
    borderColor: LIGHT_PURPLE,
  },
  hourChipText: {
    color: '#D2D2E6',
    fontSize: 13,
    fontWeight: '700',
  },
  selectedHourChipText: {
    color: '#fff',
    fontWeight: '800',
  },
  timeDetailRow: {
    flexDirection: 'row',
    gap: 16,
    marginTop: 6,
  },
  minutesRow: {
    flexDirection: 'row',
    gap: 6,
  },
  minuteChip: {
    flex: 1,
    height: 36,
    borderRadius: 9,
    backgroundColor: 'rgba(255, 255, 255, 0.04)',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.06)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  selectedMinuteChip: {
    backgroundColor: PURPLE,
    borderColor: LIGHT_PURPLE,
  },
  minuteChipText: {
    color: '#D2D2E6',
    fontSize: 12,
    fontWeight: '700',
  },
  selectedMinuteChipText: {
    color: '#fff',
    fontWeight: '800',
  },
  ampmContainer: {
    flexDirection: 'row',
    height: 36,
    borderRadius: 9,
    backgroundColor: 'rgba(255, 255, 255, 0.04)',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.06)',
    overflow: 'hidden',
  },
  ampmChip: {
    flex: 1,
    height: '100%',
    justifyContent: 'center',
    alignItems: 'center',
  },
  selectedAmpmChip: {
    backgroundColor: PURPLE,
  },
  ampmChipText: {
    color: '#D2D2E6',
    fontSize: 12,
    fontWeight: '800',
  },
  selectedAmpmChipText: {
    color: '#fff',
  },
  durationRow: {
    flexDirection: 'row',
    gap: 6,
  },
  durationChip: {
    flex: 1,
    height: 36,
    borderRadius: 9,
    backgroundColor: 'rgba(255, 255, 255, 0.04)',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.06)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  selectedDurationChip: {
    backgroundColor: PURPLE,
    borderColor: LIGHT_PURPLE,
  },
  durationChipText: {
    color: '#D2D2E6',
    fontSize: 11,
    fontWeight: '700',
  },
  selectedDurationChipText: {
    color: '#fff',
    fontWeight: '800',
  },
  calendarSelectRow: {
    flexDirection: 'row',
    gap: 10,
  },
  calendarOption: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    height: 38,
    borderRadius: 10,
    backgroundColor: 'rgba(255, 255, 255, 0.04)',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.06)',
  },
  selectedCalendarOption: {
    borderColor: PURPLE,
    backgroundColor: 'rgba(143, 102, 255, 0.08)',
  },
  calendarOptionText: {
    color: '#D2D2E6',
    fontSize: 12,
    fontWeight: '700',
  },
  selectedCalendarOptionText: {
    color: PURPLE,
    fontWeight: '800',
  },
  modalActions: {
    flexDirection: 'row',
    gap: 12,
    marginTop: 16,
  },
  modalCancelBtn: {
    flex: 1,
    height: 46,
    borderRadius: 14,
    borderWidth: 1.5,
    borderColor: 'rgba(255, 255, 255, 0.15)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalCancelBtnText: {
    color: '#D2D2E6',
    fontSize: 14,
    fontWeight: '800',
  },
  modalConfirmBtn: {
    flex: 1,
    height: 46,
    borderRadius: 14,
    backgroundColor: PURPLE,
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalConfirmBtnDisabled: {
    backgroundColor: 'rgba(143, 102, 255, 0.4)',
  },
  modalConfirmBtnText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '800',
  },
  toastContainer: {
    position: 'absolute',
    bottom: 40,
    left: 20,
    right: 20,
    alignItems: 'center',
    zIndex: 9999,
  },
  toastContent: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#161932',
    borderWidth: 1.5,
    borderColor: GLASS_BORDER,
    paddingVertical: 12,
    paddingHorizontal: 20,
    borderRadius: 99,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 10,
    elevation: 6,
    gap: 10,
  },
  toastIconCircle: {
    width: 20,
    height: 20,
    borderRadius: 10,
    backgroundColor: 'rgba(129, 199, 132, 0.15)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  toastText: {
    color: '#fff',
    fontSize: 13,
    fontWeight: '800',
  },
});
