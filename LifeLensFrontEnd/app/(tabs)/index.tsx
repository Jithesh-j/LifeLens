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
  Platform,
  AppState,
  RefreshControl,
} from 'react-native';
import { useRouter, useNavigation } from 'expo-router';
import * as SecureStore from 'expo-secure-store';
import { useAuth } from '@/context/auth';
import { useSchedule, getTodayDateStr, ScheduleItem } from '@/context/schedule';
import { ThemedText } from '@/components/themed-text';
import { IconSymbol } from '@/components/ui/icon-symbol';
import { api } from '@/services/api';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import * as Location from 'expo-location';

const SCREEN_WIDTH = Dimensions.get('window').width;

import { SPACING, TYPOGRAPHY, COLORS } from '@/constants/design-system';

// ── Premium Dark-Mode Colors ────────────────────────────────────────────────
const PURPLE = COLORS.primary;
const LIGHT_PURPLE = COLORS.mood;
const DARK_BG = COLORS.bg;
const CARD_BG = COLORS.surfaceCard;
const GLASS_BORDER = COLORS.surfaceBorder;
const GREEN = COLORS.health;
const BLUE = COLORS.sleep;
const AMBER = COLORS.food;
const RED = '#EF4444';

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
  weather?: {
    temperature_c: number;
    temperature_f: number;
    condition: string;
    windSpeed: number;
    humidity: number;
  };
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
  run: 'figure.run',
  swim: 'figure.pool.swim',
  play: 'sportscourt.fill',
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
  orange: '#FF8A65',
  blue: BLUE,
  red: RED,
};

const getWeatherEmoji = (condition?: string) => {
  switch (condition?.toLowerCase()) {
    case 'sunny': return '☀️';
    case 'clear': return '🌙';
    case 'cloudy': return '🌥';
    case 'foggy': return '🌫️';
    case 'rainy': return '🌧️';
    case 'snowy': return '❄️';
    case 'stormy': return '⛈️';
    default: return '🌡️';
  }
};

function mergeEvents(
  localItems: ScheduleItem[],
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
        weather: item.weather,
        _sortKey: sortKey,
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
  icon: 'walk' | 'run' | 'swim' | 'play' | 'laptop' | 'groups' | 'phone' | 'gym' | 'rest';
  color: 'green' | 'purple' | 'yellow' | 'gray' | 'orange' | 'blue' | 'red';
} {
  const lower = title.toLowerCase();
  if (/\b(run|jog|running|jogging)\b/i.test(lower)) {
    return { category: 'health', icon: 'run', color: 'orange' };
  }
  if (lower.includes('swim')) {
    return { category: 'health', icon: 'swim', color: 'blue' };
  }
  if (lower.includes('play') || lower.includes('sport') || lower.includes('tennis') || lower.includes('basketball') || lower.includes('soccer') || lower.includes('football') || lower.includes('cricket')) {
    return { category: 'health', icon: 'play', color: 'yellow' };
  }
  if (lower.includes('walk') || lower.includes('hike')) {
    return { category: 'health', icon: 'walk', color: 'green' };
  }
  if (lower.includes('gym') || lower.includes('workout') || lower.includes('exercise')) {
    return { category: 'health', icon: 'gym', color: 'red' };
  }
  if (lower.includes('code') || lower.includes('work') || lower.includes('laptop') || lower.includes('meeting') || lower.includes('call') || lower.includes('presentation')) {
    return { category: 'work', icon: 'laptop', color: 'purple' };
  }
  if (lower.includes('coffee') || lower.includes('social') || lower.includes('lunch') || lower.includes('dinner') || lower.includes('party') || lower.includes('brunch')) {
    return { category: 'social', icon: 'groups', color: 'yellow' };
  }
  return { category: 'rest', icon: 'rest', color: 'gray' };
}

// ═════════════════════════════════════════════════════════════════════════════
//  MAIN HOME SCREEN
// ═════════════════════════════════════════════════════════════════════════════
export default function HomeScreen() {
  const { user } = useAuth();
  const insets = useSafeAreaInsets();
  const { scheduleItems, fetchUserSchedule } = useSchedule();
  const router = useRouter();
  const navigation = useNavigation();

  // Location Suggestion states
  const [locEnabled, setLocEnabled] = useState(false);
  const [smartNotifs, setSmartNotifs] = useState(false);
  const [pendingLocationSugg, setPendingLocationSugg] = useState<any | null>(null);

  // Lightweight Quick Add Event Modal states
  const [showQuickAddSheet, setShowQuickAddSheet] = useState(false);
  const [quickAddActivityName, setQuickAddActivityName] = useState('');
  const [quickAddDate, setQuickAddDate] = useState('');
  const [quickAddTime, setQuickAddTime] = useState('');
  const [quickAddNotes, setQuickAddNotes] = useState('');
  const [weatherOnTimeline, setWeatherOnTimeline] = useState(false);
  const [isSavingQuickAdd, setIsSavingQuickAdd] = useState(false);

  // Notification History states
  const [showNotifHistory, setShowNotifHistory] = useState(false);
  const [notifHistory, setNotifHistory] = useState<any[]>([]);

  // Weather states
  const [weatherText, setWeatherText] = useState<string | null>(null);
  const [weatherLoading, setWeatherLoading] = useState(false);

  const fetchWeather = async () => {
    if (!user) return;
    setWeatherLoading(true);
    try {
      let lat: number | null = null;
      let lon: number | null = null;

      // 1. Fetch user-specific settings to honor Location Intelligence preferences
      const settings = await api.getUserSettings();
      const isLocationIntelEnabled = settings.location_enabled;

      if (isLocationIntelEnabled) {
        // Request location permission before calling weather API
        const { status } = await Location.requestForegroundPermissionsAsync();
        if (status === 'granted') {
          // Try getting last known location first (instant cached response)
          const lastKnown = await Location.getLastKnownPositionAsync({});
          if (lastKnown) {
            lat = lastKnown.coords.latitude;
            lon = lastKnown.coords.longitude;
          }

          // Then retrieve balanced accuracy current position (extremely fast and accurate)
          try {
            const location = await Location.getCurrentPositionAsync({
              accuracy: Location.Accuracy.Balanced,
            });
            lat = location.coords.latitude;
            lon = location.coords.longitude;
          } catch (e) {
            console.warn('getCurrentPositionAsync failed, keeping last known:', e);
          }
        }
      }

      // 2. Request weather from our user-isolated backend API
      const timestamp = new Date().toISOString();
      const weather = await api.getWeather(lat, lon, timestamp);

      if (weather.status === 'location_unavailable' || weather.temperature_c === undefined || weather.temperature_f === undefined || weather.weathercode === undefined) {
        setWeatherText('Location Unavailable');
        return;
      }

      const tempC = weather.temperature_c;
      const tempF = weather.temperature_f;
      const code = weather.weathercode;

      // Map weathercode to emoji
      const curHour = new Date().getHours();
      const isNight = curHour < 6 || curHour >= 18;

      let emoji = '🌡️';
      if (code === 0) emoji = isNight ? '🌙' : '☀️';
      else if (code >= 1 && code <= 3) emoji = '⛅';
      else if (code === 45 || code === 48) emoji = '🌫️';
      else if ((code >= 51 && code <= 57) || (code >= 61 && code <= 67) || (code >= 80 && code <= 82)) emoji = '🌧️';
      else if ((code >= 71 && code <= 77) || (code >= 85 && code <= 86)) emoji = '❄️';
      else if (code >= 95 && code <= 99) emoji = '⛈️';

      setWeatherText(`${emoji} ${tempF}°F / ${Math.round(tempC)}°C`);
    } catch (err) {
      console.warn('Failed to fetch user-isolated weather:', err);
      setWeatherText('Location Unavailable');
    } finally {
      setWeatherLoading(false);
    }
  };

  // Edit suggested activity states
  const [showLocEditModal, setShowLocEditModal] = useState(false);
  const [locEditTitle, setLocEditTitle] = useState('');
  const [locEditDuration, setLocEditDuration] = useState('');
  const [locEditActivity, setLocEditActivity] = useState('');

  const loadLocationSuggestion = async () => {
    if (!user) return;
    try {
      const settings = await api.getUserSettings();
      const locEnabled = settings.location_enabled;
      const smartEnabled = settings.smart_activity_detection;
      const notifsEnabled = settings.smart_notifications;
      const weatherTimelineEnabled = settings.weather_on_timeline || false;

      const simActiveKey = `${user.id}_simulated_suggestion_active`;
      const simDataKey = `${user.id}_simulated_suggestion_data`;
      const simActive = await SecureStore.getItemAsync(simActiveKey);
      const simData = await SecureStore.getItemAsync(simDataKey);

      setLocEnabled(locEnabled);
      setSmartNotifs(locEnabled && smartEnabled && notifsEnabled);
      setWeatherOnTimeline(weatherTimelineEnabled);

      if (locEnabled && smartEnabled && notifsEnabled && simActive === 'true' && simData) {
        setPendingLocationSugg(JSON.parse(simData));
      } else {
        setPendingLocationSugg(null);
      }
    } catch (err) {
      console.warn('Failed to load location suggestions on home focus:', err);
    }
  };

  // 1. Refresh weather every 10 minutes (600,000 ms) while mounted
  useEffect(() => {
    fetchWeather(); // Fetch immediately on mount or user change
    const interval = setInterval(() => {
      console.log('⏰ [Weather] Auto-refreshing weather conditions...');
      fetchWeather();
    }, 600000);
    return () => clearInterval(interval);
  }, [user]);

  // 2. Watch for physical location changes to trigger rapid refresh
  useEffect(() => {
    if (!user) return;
    let subscription: any = null;

    async function startWatchingLocation() {
      try {
        const settings = await api.getUserSettings();
        if (!settings.location_enabled) {
          console.log('📡 [Location Watcher] Location Intelligence is disabled. Skipping GPS watch.');
          return;
        }

        const { status } = await Location.requestForegroundPermissionsAsync();
        if (status === 'granted') {
          subscription = await Location.watchPositionAsync(
            {
              accuracy: Location.Accuracy.Balanced,
              timeInterval: 30000,   // Check every 30 seconds
              distanceInterval: 100,  // Or when moved more than 100 meters
            },
            (pos) => {
              console.log('📡 [Location Shift] Device moved, refreshing weather context...');
              fetchWeather();
            }
          );
        }
      } catch (err) {
        console.warn('Location change watching failed:', err);
      }
    }

    startWatchingLocation();
    return () => {
      if (subscription) {
        subscription.remove();
      }
    };
  }, [user]);

  // 3. Refresh weather on app mount & screen focus
  useEffect(() => {
    if (user) {
      loadLocationSuggestion();
      loadNotifHistory();
    }
    const unsubscribe = navigation.addListener('focus', () => {
      fetchWeather();
      if (user) {
        loadLocationSuggestion();
        checkPendingNotificationActions();
        loadNotifHistory();
      }
    });
    return unsubscribe;
  }, [navigation, user]);

  // AppState listener to capture foreground shifts from push notifications
  useEffect(() => {
    if (!user) return;
    
    // Check once immediately on user load
    checkPendingNotificationActions();
    loadNotifHistory();

    const subscription = AppState.addEventListener('change', (nextState) => {
      if (nextState === 'active') {
        console.log('📱 [AppState] App became active. Checking for pending push notification taps...');
        checkPendingNotificationActions();
        loadNotifHistory();
      }
    });

    return () => {
      subscription.remove();
    };
  }, [user]);

  const loadNotifHistory = async () => {
    if (!user) return;
    try {
      const histKey = `${user.id}_notification_history`;
      const stored = await SecureStore.getItemAsync(histKey);
      if (stored) {
        setNotifHistory(JSON.parse(stored));
      } else {
        setNotifHistory([]);
      }
    } catch (err) {
      console.warn('Failed to load notification history:', err);
    }
  };

  const handleClearNotifHistory = async () => {
    if (!user) return;
    try {
      const histKey = `${user.id}_notification_history`;
      await SecureStore.deleteItemAsync(histKey);
      setNotifHistory([]);
      showToast('Notification history cleared');
    } catch (err) {
      console.warn('Failed to clear notification history:', err);
    }
  };

  const handleLogHistoryItem = async (item: any) => {
    try {
      // 1. Log to timeline
      await handleAddLocationToTimelineDirect(item);
      
      // 2. Mark this item as logged in our history list
      const histKey = `${user?.id}_notification_history`;
      const stored = await SecureStore.getItemAsync(histKey);
      const histArray = stored ? JSON.parse(stored) : [];
      const updated = histArray.map((h: any) => {
        if (h.id === item.id) {
          return { ...h, logged: true };
        }
        return h;
      });
      setNotifHistory(updated);
      await SecureStore.setItemAsync(histKey, JSON.stringify(updated));
    } catch (err) {
      console.error('Failed to log historical item:', err);
    }
  };

  const checkPendingNotificationActions = async () => {
    if (!user) return;
    try {
      const key = `${user.id}_pending_notification_action`;
      const actionDataStr = await SecureStore.getItemAsync(key);
      if (actionDataStr) {
        await SecureStore.deleteItemAsync(key);
        const { action, data, timestamp } = JSON.parse(actionDataStr);
        
        // Cooldown check to ignore ancient actions (older than 1 hour)
        if (Date.now() - timestamp > 60 * 60 * 1000) {
          console.log('🔔 [Notifications] Ignoring stale tapped notification action:', action);
          return;
        }

        console.log('🔔 [Notifications] Pending tapped action detected:', action, data);
        
        // Establish the suggestion state
        setPendingLocationSugg(data);

        if (action === 'add-timeline') {
          // Add to timeline instantly with a small delay for UI processing
          setTimeout(async () => {
            await handleAddLocationToTimelineDirect(data);
          }, 300);
        } else if (action === 'add-event') {
          // Open the Event modal overlay prefilled
          setQuickAddActivityName(data.inferredActivity);
          setQuickAddDate(data.date);
          setQuickAddTime(data.timeOfDay);
          setQuickAddNotes('');
          setShowQuickAddSheet(true);
        }
      }
    } catch (err) {
      console.warn('Failed to process pending notification actions:', err);
    }
  };

  const clearLocationSuggestion = async () => {
    setPendingLocationSugg(null);
    if (user) {
      await SecureStore.deleteItemAsync(`${user.id}_simulated_suggestion_active`);
      await SecureStore.deleteItemAsync(`${user.id}_simulated_suggestion_data`);
    }
  };

  const handleAddLocationToTimelineDirect = async (sugg: any) => {
    try {
      const sentence = `Spent ${sugg.durationMinutes} minutes at ${sugg.placeName} (${sugg.inferredActivity})`;
      
      // Parse 12h time to 24h format for ISO string construction
      const timePart = sugg.timeOfDay.split(' ')[0] || '';
      const ampm = sugg.timeOfDay.split(' ')[1] || 'AM';
      let h = parseInt(timePart.split(':')[0]) || 12;
      const m = parseInt(timePart.split(':')[1]) || 0;
      if (ampm.toUpperCase() === 'PM' && h < 12) h += 12;
      if (ampm.toUpperCase() === 'AM' && h === 12) h = 0;
      const startTime24h = `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}:00`;
      
      const startISO = `${sugg.date}T${startTime24h}`;

      let weatherData = undefined;
      if (weatherOnTimeline) {
        try {
          const lat = sugg.latitude || 34.05;
          const lon = sugg.longitude || -118.24;
          const weather = await api.getWeather(lat, lon, startISO);
          if (weather.status === 'ok' && weather.temperature_c !== undefined && weather.temperature_f !== undefined && weather.weathercode !== undefined) {
            const code = weather.weathercode;
            const isNight = h < 6 || h >= 18;
            let condition = 'Clear';
            if (code === 0) {
              condition = isNight ? 'Clear' : 'Sunny';
            } else if (code >= 1 && code <= 3) {
              condition = 'Cloudy';
            } else if (code === 45 || code === 48) {
              condition = 'Foggy';
            } else if ((code >= 51 && code <= 57) || (code >= 61 && code <= 67) || (code >= 80 && code <= 82)) {
              condition = 'Rainy';
            } else if ((code >= 71 && code <= 77) || (code >= 85 && code <= 86)) {
              condition = 'Snowy';
            } else if (code >= 95 && code <= 99) {
              condition = 'Stormy';
            }
            weatherData = {
              temperature_c: weather.temperature_c,
              temperature_f: weather.temperature_f,
              condition,
              windSpeed: weather.wind_speed || 5.0,
              humidity: weather.humidity || 50.0,
            };
          }
        } catch (weaErr) {
          console.warn('Weather snapshot enrichment failed in handleAddLocationToTimelineDirect:', weaErr);
        }
      }

      const newLocalItem: any = {
        id: Math.random().toString(),
        title: sugg.inferredActivity,
        timeRange: sugg.timeOfDay,
        category: sugg.category,
        icon: sugg.icon,
        color: sugg.color,
        date: sugg.date,
        startTime: startISO,
        isAiExtracted: false,
        location: {
          name: sugg.placeName,
          latitude: sugg.latitude || 34.05,
          longitude: sugg.longitude || -118.24,
        },
        weather: weatherData,
      };

      // Save to backend database
      await api.createActivity(sentence, `${sugg.date}T12:00:00`);
      // Extract and save to local schedule
      await addNoteAndExtract(sentence, sugg.date, [newLocalItem]);

      showToast('Added to Timeline');
      await clearLocationSuggestion();
    } catch (err) {
      console.error(err);
      showToast('Failed to log activity');
    }
  };

  const handleAddLocationToTimeline = async () => {
    if (!pendingLocationSugg) return;
    await handleAddLocationToTimelineDirect(pendingLocationSugg);
  };

  const handleAddLocationToEvents = () => {
    if (!pendingLocationSugg) return;
    setQuickAddActivityName(pendingLocationSugg.inferredActivity);
    setQuickAddDate(pendingLocationSugg.date);
    setQuickAddTime(pendingLocationSugg.timeOfDay);
    setQuickAddNotes('');
    setShowQuickAddSheet(true);
  };

  const handleSaveQuickAddEvent = async () => {
    if (!pendingLocationSugg) return;
    setIsSavingQuickAdd(true);
    try {
      const sentence = `${quickAddActivityName} (${pendingLocationSugg.placeName}) at ${quickAddTime} on ${quickAddDate}. Notes: ${quickAddNotes || 'None'}`;
      
      // Parse 12h time to 24h format for ISO string construction
      const timePart = quickAddTime.split(' ')[0] || '';
      const ampm = quickAddTime.split(' ')[1] || 'AM';
      let h = parseInt(timePart.split(':')[0]) || 12;
      const m = parseInt(timePart.split(':')[1]) || 0;
      if (ampm.toUpperCase() === 'PM' && h < 12) h += 12;
      if (ampm.toUpperCase() === 'AM' && h === 12) h = 0;
      const startTime24h = `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}:00`;
      
      const startISO = `${quickAddDate}T${startTime24h}`;
      
      // Calculate end time based on duration
      const startDate = new Date(startISO);
      startDate.setMinutes(startDate.getMinutes() + pendingLocationSugg.durationMinutes);
      const yyyy = startDate.getFullYear();
      const mm = String(startDate.getMonth() + 1).padStart(2, '0');
      const dd = String(startDate.getDate()).padStart(2, '0');
      const hh = String(startDate.getHours()).padStart(2, '0');
      const min = String(startDate.getMinutes()).padStart(2, '0');
      const endISO = `${yyyy}-${mm}-${dd}T${hh}:${min}:00`;

      const ampmEnd = startDate.getHours() >= 12 ? 'PM' : 'AM';
      const displayHourEnd = startDate.getHours() % 12 === 0 ? 12 : startDate.getHours() % 12;
      const displayMinEnd = String(startDate.getMinutes()).padStart(2, '0');
      const timeRangeStr = `${quickAddTime} - ${displayHourEnd}:${displayMinEnd} ${ampmEnd}`;

      const newEvent: any = {
        id: Math.random().toString(),
        title: `${quickAddActivityName} (${pendingLocationSugg.placeName})`,
        timeRange: timeRangeStr,
        duration: `${pendingLocationSugg.durationMinutes} min`,
        category: pendingLocationSugg.category,
        icon: pendingLocationSugg.icon,
        color: pendingLocationSugg.color,
        date: quickAddDate,
        startTime: startISO,
        endTime: endISO,
        notes: quickAddNotes || undefined,
        isAiExtracted: false,
      };

      // Save to database
      await api.createActivity(sentence, `${quickAddDate}T12:00:00`);
      // Save event structure to calendar schedule
      await addNoteAndExtract(sentence, quickAddDate, [newEvent]);

      showToast('Event added successfully');
      setShowQuickAddSheet(false);
      await clearLocationSuggestion();
    } catch (err) {
      console.error(err);
      showToast('Failed to schedule calendar event');
    } finally {
      setIsSavingQuickAdd(false);
    }
  };

  const handleOpenLocEdit = () => {
    if (!pendingLocationSugg) return;
    setLocEditTitle(pendingLocationSugg.placeName);
    setLocEditDuration(String(pendingLocationSugg.durationMinutes));
    setLocEditActivity(pendingLocationSugg.inferredActivity);
    setShowLocEditModal(true);
  };

  const handleSaveLocEdit = async () => {
    if (!pendingLocationSugg) return;
    
    let category: 'health' | 'work' | 'social' | 'rest' | 'other' = 'other';
    let icon: 'walk' | 'run' | 'swim' | 'play' | 'laptop' | 'groups' | 'phone' | 'gym' | 'rest' = 'rest';
    let color: 'green' | 'purple' | 'yellow' | 'gray' | 'orange' | 'blue' | 'red' = 'gray';
    const lower = locEditActivity.toLowerCase();

    if (/\b(run|jog|running|jogging)\b/i.test(lower)) {
      category = 'health';
      icon = 'run';
      color = 'orange';
    } else if (lower.includes('swim')) {
      category = 'health';
      icon = 'swim';
      color = 'blue';
    } else if (lower.includes('play') || lower.includes('sport') || lower.includes('tennis') || lower.includes('basketball') || lower.includes('soccer') || lower.includes('football') || lower.includes('cricket')) {
      category = 'health';
      icon = 'play';
      color = 'yellow';
    } else if (lower.includes('walk') || lower.includes('hike')) {
      category = 'health';
      icon = 'walk';
      color = 'green';
    } else if (lower.includes('gym') || lower.includes('workout') || lower.includes('exercise')) {
      category = 'health';
      icon = 'gym';
      color = 'red';
    } else if (lower.includes('work') || lower.includes('study') || lower.includes('code') || lower.includes('meeting')) {
      category = 'work';
      icon = 'laptop';
      color = 'purple';
    } else if (lower.includes('cafe') || lower.includes('coffee') || lower.includes('lunch') || lower.includes('dinner') || lower.includes('brunch')) {
      category = 'social';
      icon = 'groups';
      color = 'yellow';
    }

    const updated = {
      ...pendingLocationSugg,
      placeName: locEditTitle,
      durationMinutes: parseInt(locEditDuration) || 30,
      inferredActivity: locEditActivity,
      category,
      icon,
      color,
    };

    setPendingLocationSugg(updated);
    if (user) {
      await SecureStore.setItemAsync(`${user.id}_simulated_suggestion_data`, JSON.stringify(updated));
    }
    setShowLocEditModal(false);
    showToast('Activity Inferences Updated');
  };

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
    setTargetCalendar('local');
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
    setTargetCalendar('local');
    setIsModalOpen(true);
  };

  const { addNoteAndExtract } = useSchedule();

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
      
      // Construct a natural language sentence so it parses back perfectly from the database
      const sentence = `${eventTitle} at ${selectedHour}:${selectedMin} ${selectedAmPm} for ${selectedDuration} minutes`;

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

      try {
        await api.createActivity(sentence, `${todayStr}T12:00:00`);
        console.log('Successfully saved local event to backend database!');
      } catch (err) {
        console.error('Failed to save event to backend:', err);
      }

      addNoteAndExtract(sentence, todayStr, [newLocalItem]);
      showToast('Event added successfully');
      setIsModalOpen(false);
    } catch (e) {
      console.error(e);
      showToast('Error scheduling event');
    } finally {
      setEventCreating(false);
    }
  };
  const firstName = useMemo(() => getFirstName(user?.full_name), [user?.full_name]);

  const [lastRefreshTime, setLastRefreshTime] = useState(Date.now());
  const [refreshing, setRefreshing] = useState(false);

  const handleRefresh = async () => {
    setRefreshing(true);
    try {
      console.log('🔄 [Home] Manual refresh triggered. Loading fresh schedule & weather...');
      await Promise.all([
        fetchUserSchedule(),
        fetchWeather(),
        loadLocationSuggestion(),
      ]);
      setLastRefreshTime(Date.now());
      showToast('Dashboard updated');
    } catch (err) {
      console.error('Failed manual refresh:', err);
    } finally {
      setRefreshing(false);
    }
  };

  // Force suggestion & analytics recalculation/refresh every hour (3,600,000 ms)
  useEffect(() => {
    const timer = setInterval(() => {
      console.log('⏰ [Analytics] Hourly refresh triggered. Fetching user schedule & regenerating AI suggestions...');
      fetchUserSchedule().catch((err) => console.warn('Failed to fetch schedule in hourly timer:', err));
      setLastRefreshTime(Date.now());
    }, 3600000); // 1 hour
    return () => clearInterval(timer);
  }, [fetchUserSchedule]);

  const analytics = useMemo(() => computeHomeAnalytics(scheduleItems, todayStr), [scheduleItems, todayStr, lastRefreshTime]);
  const mergedEvents = useMemo(() => mergeEvents(scheduleItems, todayStr), [scheduleItems, todayStr]);

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
      <View style={s.glowCircle3} />

      <ScrollView 
        contentContainerStyle={[
          s.scrollContent, 
          { paddingTop: insets.top > 0 ? insets.top + 32 : 80 }
        ]} 
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={handleRefresh}
            tintColor={PURPLE}
            colors={[PURPLE]}
          />
        }
      >
        {/* ── Greeting Header ──────────────────────────────────────────── */}
        <FadeSlide index={0}>
          <View style={s.greetingSection}>
            <View style={s.greetingTopRow}>
              <View style={{ flex: 1 }}>
                <ThemedText style={s.greetingText}>
                  {greeting.text}, {firstName} {greeting.emoji}
                </ThemedText>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 4 }}>
                  <ThemedText style={s.dateLabel}>
                    {dateLabel}
                  </ThemedText>
                  {weatherLoading ? (
                    <ActivityIndicator size="small" color={LIGHT_PURPLE} style={{ opacity: 0.8 }} />
                  ) : weatherText ? (
                    <ThemedText style={s.weatherLabel}>
                      •  {weatherText}
                    </ThemedText>
                  ) : null}
                </View>
              </View>
              <TouchableOpacity 
                style={s.notifBadge} 
                onPress={async () => {
                  await loadNotifHistory();
                  setShowNotifHistory(true);
                }}
              >
                <IconSymbol size={22} name="bell.fill" color={LIGHT_PURPLE} />
                {notifHistory.some(item => !item.logged) && (
                  <View style={s.redDotBadge} />
                )}
              </TouchableOpacity>
            </View>
          </View>
        </FadeSlide>

        {/* ── LOCATION INTELLIGENCE AMBIENT SUGGESTION CARD ─────────────── */}
        {pendingLocationSugg && (
          <FadeSlide index={0.5}>
            <View style={s.locSuggestionCard}>
              <View style={s.locNotifHeader}>
                <IconSymbol size={20} name="location.fill" color={PURPLE} />
                <ThemedText style={s.locNotifTitle}>📍 {pendingLocationSugg.title || 'Activity Detected'}</ThemedText>
                <TouchableOpacity onPress={clearLocationSuggestion} style={s.locNotifClose}>
                  <IconSymbol size={18} name="xmark" color="#FFF" style={{ opacity: 0.5 }} />
                </TouchableOpacity>
              </View>

              <ThemedText style={s.locNotifMsg}>
                {pendingLocationSugg.message || `We noticed you spent ${pendingLocationSugg.durationMinutes} minutes at ${pendingLocationSugg.placeName}. Add this activity?`}
              </ThemedText>

              <View style={s.locNotifMetaRow}>
                <ThemedText style={s.locNotifMetaLabel}>
                  Suggested Activity: <ThemedText style={{ fontWeight: '700', color: GREEN }}>{pendingLocationSugg.inferredActivity}</ThemedText>
                </ThemedText>
              </View>

              {/* Actions Grid (Add to Timeline, Add to Event) */}
              <View style={s.locActionsGrid}>
                <TouchableOpacity style={s.locActionBtn} onPress={handleAddLocationToTimeline}>
                  <IconSymbol size={14} name="paperplane.fill" color={BLUE} />
                  <ThemedText style={s.locActionBtnText}>Add Timeline</ThemedText>
                </TouchableOpacity>

                <TouchableOpacity style={s.locActionBtn} onPress={handleAddLocationToEvents}>
                  <IconSymbol size={14} name="calendar" color={GREEN} />
                  <ThemedText style={s.locActionBtnText}>Add Event</ThemedText>
                </TouchableOpacity>
              </View>

              <View style={s.locActionsGrid2}>
                <TouchableOpacity style={s.locActionBtnSmall} onPress={handleOpenLocEdit}>
                  <ThemedText style={s.locActionBtnTextSmall}>Edit Activity</ThemedText>
                </TouchableOpacity>

                <TouchableOpacity style={s.locActionBtnSmall} onPress={clearLocationSuggestion}>
                  <ThemedText style={[s.locActionBtnTextSmall, { color: RED }]}>Dismiss</ThemedText>
                </TouchableOpacity>
              </View>
            </View>
          </FadeSlide>
        )}

        {/* ── AI Suggestion Card ───────────────────────────────────────── */}
        <FadeSlide index={1}>
          <View style={s.suggestionCard}>
            <View style={s.suggestionHeader}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                <IconSymbol size={18} name="sparkles" color={PURPLE} />
                <View>
                  <ThemedText style={s.suggestionHeaderText}>AI Suggestion</ThemedText>
                  <ThemedText style={{ fontSize: 10, color: 'rgba(255,255,255,0.35)', fontWeight: '600', marginTop: 1 }}>
                    ⏱️ Hourly auto-refresh active
                  </ThemedText>
                </View>
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
                    onPress={() => analytics.bestSuggestion && handleAiSuggestionClick(analytics.bestSuggestion.text)}>
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
            <TouchableOpacity onPress={() => router.push('/(tabs)/calendar')}>
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
                  <View style={{ flex: 1, marginHorizontal: 12 }}>
                    <ThemedText style={[s.scheduleTitle, { flex: 0 }]} numberOfLines={1}>
                      {ev.title}
                    </ThemedText>
                    {ev.weather && (
                      <ThemedText style={{ fontSize: 11, color: 'rgba(255, 255, 255, 0.5)', marginTop: 2 }}>
                        {getWeatherEmoji(ev.weather.condition)} {ev.weather.condition} • {Math.round(ev.weather.temperature_c)}°C / {Math.round(ev.weather.temperature_f)}°F
                      </ThemedText>
                    )}
                  </View>
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

      {/* ── Location intelligence edit activity modal overlay ────────────────── */}
      {showLocEditModal && (
        <View style={s.locEditBg}>
          <View style={s.locEditCard}>
            <View style={s.locEditHeader}>
              <ThemedText style={s.locEditTitle}>Edit Location Activity</ThemedText>
              <TouchableOpacity onPress={() => setShowLocEditModal(false)}>
                <IconSymbol size={24} name="xmark" color="#FFF" />
              </TouchableOpacity>
            </View>

            <View style={s.locEditBody}>
              <ThemedText style={s.locInputLabel}>Place Name</ThemedText>
              <TextInput
                style={s.locTextInput}
                value={locEditTitle}
                onChangeText={setLocEditTitle}
                placeholder="e.g. Discovery Park"
                placeholderTextColor="rgba(255,255,255,0.4)"
              />

              <ThemedText style={s.locInputLabel}>Inferred Activity Type</ThemedText>
              <TextInput
                style={s.locTextInput}
                value={locEditActivity}
                onChangeText={setLocEditActivity}
                placeholder="e.g. Walking / Jogging"
                placeholderTextColor="rgba(255,255,255,0.4)"
              />

              <ThemedText style={s.locInputLabel}>Stay Duration (Minutes)</ThemedText>
              <TextInput
                style={s.locTextInput}
                value={locEditDuration}
                onChangeText={setLocEditDuration}
                keyboardType="numeric"
                placeholder="80"
                placeholderTextColor="rgba(255,255,255,0.4)"
              />

              <TouchableOpacity style={s.locSaveEditBtn} onPress={handleSaveLocEdit}>
                <ThemedText style={s.locSaveEditBtnText}>Apply Inferred Settings</ThemedText>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      )}

      {/* ── Location intelligence lightweight quick add event modal overlay ────── */}
      {showQuickAddSheet && (
        <View style={s.locEditBg}>
          <View style={s.locEditCard}>
            <View style={s.locEditHeader}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                <IconSymbol size={20} name="calendar" color={PURPLE} />
                <ThemedText style={s.locEditTitle}>Quick Add Event</ThemedText>
              </View>
              <TouchableOpacity onPress={() => setShowQuickAddSheet(false)}>
                <IconSymbol size={24} name="xmark" color="#FFF" />
              </TouchableOpacity>
            </View>

            <View style={s.locEditBody}>
              <ThemedText style={s.locInputLabel}>Activity Name</ThemedText>
              <TextInput
                style={s.locTextInput}
                value={quickAddActivityName}
                onChangeText={setQuickAddActivityName}
                placeholder="e.g. Walking"
                placeholderTextColor="rgba(255,255,255,0.4)"
              />

              <ThemedText style={s.locInputLabel}>Date</ThemedText>
              <TextInput
                style={s.locTextInput}
                value={quickAddDate}
                onChangeText={setQuickAddDate}
                placeholder="YYYY-MM-DD"
                placeholderTextColor="rgba(255,255,255,0.4)"
              />

              <ThemedText style={s.locInputLabel}>Time</ThemedText>
              <TextInput
                style={s.locTextInput}
                value={quickAddTime}
                onChangeText={setQuickAddTime}
                placeholder="e.g. 10:30 AM"
                placeholderTextColor="rgba(255,255,255,0.4)"
              />

              <ThemedText style={s.locInputLabel}>Notes (Optional)</ThemedText>
              <TextInput
                style={[s.locTextInput, { height: 60, textAlignVertical: 'top' }]}
                value={quickAddNotes}
                onChangeText={setQuickAddNotes}
                multiline={true}
                placeholder="Add notes..."
                placeholderTextColor="rgba(255,255,255,0.4)"
              />

              <TouchableOpacity style={s.locSaveEditBtn} onPress={handleSaveQuickAddEvent} disabled={isSavingQuickAdd}>
                {isSavingQuickAdd ? (
                  <ActivityIndicator size="small" color="#0A0C1B" />
                ) : (
                  <ThemedText style={s.locSaveEditBtnText}>Save Event Directly</ThemedText>
                )}
              </TouchableOpacity>
            </View>
          </View>
        </View>
      )}

      {/* ── Notification History Modal Overlay ────── */}
      {showNotifHistory && (
        <View style={s.locEditBg}>
          <View style={[s.locEditCard, { maxHeight: 520 }]}>
            <View style={s.locEditHeader}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                <IconSymbol size={22} name="bell.fill" color={PURPLE} />
                <ThemedText style={s.locEditTitle}>Notification Center</ThemedText>
              </View>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 14 }}>
                {notifHistory.length > 0 && (
                  <TouchableOpacity onPress={handleClearNotifHistory}>
                    <ThemedText style={{ color: RED, fontSize: 13, fontWeight: '700' }}>Clear All</ThemedText>
                  </TouchableOpacity>
                )}
                <TouchableOpacity onPress={() => setShowNotifHistory(false)}>
                  <IconSymbol size={24} name="xmark" color="#FFF" />
                </TouchableOpacity>
              </View>
            </View>

            <ScrollView style={{ marginTop: 14 }} contentContainerStyle={{ gap: 12, paddingBottom: 24 }} showsVerticalScrollIndicator={false}>
              {notifHistory.length === 0 ? (
                <View style={{ alignItems: 'center', justifyContent: 'center', paddingVertical: 60, gap: 12 }}>
                  <IconSymbol size={48} name="bell.fill" color="rgba(255,255,255,0.15)" />
                  <ThemedText style={{ color: 'rgba(255,255,255,0.4)', fontSize: 14, fontWeight: '600' }}>
                    No notifications yet.
                  </ThemedText>
                  <ThemedText style={{ color: 'rgba(255,255,255,0.25)', fontSize: 12, textAlign: 'center', paddingHorizontal: 40 }}>
                    Enable Location Services, Push Notifications, and trigger geofence simulator stay test alerts under Profile settings to see them logged here.
                  </ThemedText>
                </View>
              ) : (
                notifHistory.map((item: any, idx: number) => {
                  // Determine HSL styling for category
                  const color = item.color === 'green' ? GREEN : item.color === 'yellow' ? AMBER : item.color === 'purple' ? PURPLE : BLUE;
                  
                  return (
                    <View key={item.id || idx} style={s.historyCard}>
                      <View style={{ flexDirection: 'row', gap: 12, alignItems: 'flex-start' }}>
                        <View style={[s.historyIconCircle, { backgroundColor: color + '15' }]}>
                          <IconSymbol size={20} name={item.icon || 'location.fill'} color={color} />
                        </View>
                        <View style={{ flex: 1, gap: 2 }}>
                          <ThemedText style={s.historyPlaceName}>{item.placeName}</ThemedText>
                          <ThemedText style={s.historyActivityDesc}>
                            {item.inferredActivity} • {item.durationMinutes} mins
                          </ThemedText>
                          <ThemedText style={s.historyTimeText}>
                            {item.timeOfDay} • {new Date(item.timestamp).toLocaleDateString()}
                          </ThemedText>
                        </View>

                        {item.logged ? (
                          <View style={s.loggedChip}>
                            <ThemedText style={s.loggedChipText}>Logged ✓</ThemedText>
                          </View>
                        ) : (
                          <TouchableOpacity style={s.logItemBtn} onPress={() => handleLogHistoryItem(item)}>
                            <ThemedText style={s.logItemBtnText}>Log</ThemedText>
                          </TouchableOpacity>
                        )}
                      </View>
                    </View>
                  );
                })
              )}
            </ScrollView>
          </View>
        </View>
      )}
    </View>
  );
}

// ═════════════════════════════════════════════════════════════════════════════
//  STYLES
// ═════════════════════════════════════════════════════════════════════════════
const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: DARK_BG },

  glowCircle1: { position: 'absolute', top: 40, left: -100, width: 360, height: 360, borderRadius: 180, backgroundColor: 'rgba(143, 102, 255, 0.04)' },
  glowCircle2: { position: 'absolute', bottom: 100, right: -120, width: 380, height: 380, borderRadius: 190, backgroundColor: 'rgba(59, 130, 246, 0.03)' },
  glowCircle3: { position: 'absolute', top: '40%', right: -80, width: 300, height: 300, borderRadius: 150, backgroundColor: 'rgba(6, 182, 212, 0.02)' },

  scrollContent: { paddingHorizontal: SPACING.xl, paddingBottom: 130, gap: SPACING.lg },

  // Greeting
  greetingSection: { marginBottom: SPACING.xs },
  greetingTopRow: { flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between' },
  greetingText: { color: '#fff', fontSize: 20, fontWeight: '700', letterSpacing: -0.2, lineHeight: 26, paddingTop: 4 },
  dateLabel: { color: COLORS.textMuted, fontSize: 13, fontWeight: '600' },
  weatherLabel: { color: COLORS.primary, fontSize: 13, fontWeight: '600' },
  notifBadge: { width: 38, height: 38, borderRadius: 19, backgroundColor: 'rgba(255, 255, 255, 0.03)', borderWidth: 1, borderColor: GLASS_BORDER, justifyContent: 'center', alignItems: 'center', marginTop: 2 },

  // AI Suggestion Card
  suggestionCard: {
    borderRadius: 16,
    padding: SPACING.lg,
    backgroundColor: CARD_BG,
    borderWidth: 1,
    borderColor: GLASS_BORDER,
    overflow: 'hidden',
    ...Platform.select({
      web: {
        backdropFilter: 'blur(20px)',
        // @ts-ignore
        experimental_backdropFilter: 'blur(20px)',
      },
      default: {},
    }),
  },
  suggestionHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: SPACING.md },
  suggestionHeaderText: { color: '#fff', fontSize: 15, fontWeight: '700' },
  bestForYouBadge: { backgroundColor: 'rgba(143, 102, 255, 0.08)', paddingHorizontal: 8, paddingVertical: 4, borderRadius: 6 },
  bestForYouText: { color: PURPLE, fontSize: 9, fontWeight: '800', letterSpacing: 0.5 },
  suggestionBody: { flexDirection: 'row', gap: SPACING.md, marginBottom: SPACING.md },
  suggestionIconCircle: { width: 44, height: 44, borderRadius: 12, justifyContent: 'center', alignItems: 'center' },
  suggestionText: { color: '#fff', fontSize: 14, fontWeight: '700', lineHeight: 20, marginBottom: 4 },
  suggestionEvidence: { color: COLORS.textMuted, fontSize: 12, fontWeight: '500', lineHeight: 17, marginBottom: 8 },
  suggestionMetaRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  confidencePill: { backgroundColor: 'rgba(52, 211, 153, 0.08)', paddingHorizontal: 8, paddingVertical: 3, borderRadius: 6 },
  confidencePillText: { color: GREEN, fontSize: 10, fontWeight: '700' },
  evidenceText: { color: COLORS.textMuted, fontSize: 11, fontWeight: '600' },
  suggestionActions: { flexDirection: 'row', gap: SPACING.md },
  suggestionPrimaryBtn: { flex: 1, height: 38, borderRadius: 10, backgroundColor: PURPLE, justifyContent: 'center', alignItems: 'center' },
  suggestionPrimaryBtnText: { color: '#fff', fontSize: 13, fontWeight: '700' },
  suggestionSecondaryBtn: { flex: 1, height: 38, borderRadius: 10, borderWidth: 1, borderColor: PURPLE, justifyContent: 'center', alignItems: 'center' },
  suggestionSecondaryBtnText: { color: PURPLE, fontSize: 13, fontWeight: '700' },
  emptySuggestion: { alignItems: 'center', paddingVertical: 20, gap: 10 },
  emptySuggestionText: { color: COLORS.textMuted, fontSize: 13, fontWeight: '500', textAlign: 'center' },

  // Section Headers
  sectionHeaderRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: SPACING.sm },
  sectionTitle: { color: '#fff', fontSize: 15, fontWeight: '700' },
  sectionLink: { color: PURPLE, fontSize: 13, fontWeight: '600' },

  // Schedule Card
  scheduleCard: {
    borderRadius: 16,
    backgroundColor: CARD_BG,
    borderWidth: 1,
    borderColor: GLASS_BORDER,
    overflow: 'hidden',
    ...Platform.select({
      web: {
        backdropFilter: 'blur(20px)',
        // @ts-ignore
        experimental_backdropFilter: 'blur(20px)',
      },
      default: {},
    }),
  },
  scheduleRow: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: SPACING.lg, paddingVertical: SPACING.md, gap: SPACING.md },
  scheduleRowBorder: { borderBottomWidth: 1, borderBottomColor: 'rgba(255, 255, 255, 0.04)' },
  scheduleTime: { color: COLORS.primary, fontSize: 13, fontWeight: '700', width: 78 },
  scheduleTitle: { flex: 1, color: '#fff', fontSize: 13.5, fontWeight: '600' },
  scheduleIconCircle: { width: 30, height: 30, borderRadius: 8, justifyContent: 'center', alignItems: 'center' },
  emptySchedule: { alignItems: 'center', paddingVertical: 24, gap: 10 },
  emptyScheduleText: { color: COLORS.textMuted, fontSize: 13, fontWeight: '500' },

  // Connect Google
  connectGoogleBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', marginTop: 10, height: 40, borderRadius: 10, borderWidth: 1, borderColor: PURPLE, backgroundColor: 'rgba(143, 102, 255, 0.04)' },
  connectGoogleText: { color: PURPLE, fontSize: 13, fontWeight: '700' },

  // Daily Summary
  summaryStrip: { flexDirection: 'row', gap: SPACING.sm },
  summaryCard: {
    flex: 1,
    paddingVertical: SPACING.md,
    paddingHorizontal: SPACING.sm,
    borderRadius: 14,
    alignItems: 'center',
    gap: 6,
    backgroundColor: CARD_BG,
    borderWidth: 1,
    borderColor: GLASS_BORDER,
    ...Platform.select({
      web: {
        backdropFilter: 'blur(15px)',
        // @ts-ignore
        experimental_backdropFilter: 'blur(15px)',
      },
      default: {},
    }),
  },
  summaryValue: { fontSize: 13.5, fontWeight: '800' },
  summaryLabel: { fontSize: 10.5, fontWeight: '600', color: COLORS.textMuted },

  // Quick Add
  quickAddStrip: { flexDirection: 'row', justifyContent: 'space-between' },
  quickAddBtn: { alignItems: 'center', gap: 6, width: (SCREEN_WIDTH - 40) / 5 },
  quickAddCircle: { width: 44, height: 44, borderRadius: 22, justifyContent: 'center', alignItems: 'center' },
  quickAddLabel: { color: '#fff', fontSize: 11, fontWeight: '600', marginTop: 2 },

  // Footer
  footer: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', marginTop: 10, paddingVertical: 8 },
  footerText: { fontSize: 11.5, color: COLORS.text, fontWeight: '600', opacity: 0.35 },

  // ── Quick Event Modal & Toast Styles ───────────────────────────────────────
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(8, 9, 22, 0.80)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
    ...Platform.select({
      web: {
        backdropFilter: 'blur(8px)',
        // @ts-ignore
        experimental_backdropFilter: 'blur(8px)',
      },
      default: {},
    }),
  },
  modalContainer: {
    width: '100%',
    maxWidth: 400,
    backgroundColor: 'rgba(22, 25, 50, 0.75)',
    borderRadius: 24,
    borderWidth: 1.2,
    borderColor: 'rgba(255, 255, 255, 0.12)',
    padding: 22,
    gap: 12,
    shadowColor: '#8F66FF',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.15,
    shadowRadius: 24,
    elevation: 10,
    ...Platform.select({
      web: {
        backdropFilter: 'blur(30px)',
        // @ts-ignore
        experimental_backdropFilter: 'blur(30px)',
      },
      default: {},
    }),
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
  // Location Intelligence Suggestion styles
  locSuggestionCard: {
    borderRadius: 16,
    padding: SPACING.lg,
    backgroundColor: CARD_BG,
    borderWidth: 1,
    borderColor: GLASS_BORDER,
    gap: SPACING.md,
    marginBottom: SPACING.md,
  },
  locNotifHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  locNotifTitle: {
    fontSize: 14,
    fontWeight: '800',
    color: LIGHT_PURPLE,
    flex: 1,
  },
  locNotifClose: {
    padding: 4,
  },
  locNotifMsg: {
    fontSize: 14,
    color: '#FFF',
    lineHeight: 20,
  },
  locNotifMetaRow: {
    flexDirection: 'row',
  },
  locNotifMetaLabel: {
    fontSize: 12,
    opacity: 0.6,
    color: '#FFF',
  },
  locActionsGrid: {
    flexDirection: 'row',
    gap: 8,
    marginTop: 4,
  },
  locActionsGrid2: {
    flexDirection: 'row',
    gap: 8,
  },
  locActionBtn: {
    flex: 1,
    flexDirection: 'row',
    height: 38,
    borderRadius: 10,
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.1)',
    justifyContent: 'center',
    alignItems: 'center',
    gap: 6,
  },
  locActionBtnText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#FFF',
  },
  locActionBtnSmall: {
    flex: 1,
    height: 34,
    borderRadius: 8,
    backgroundColor: 'transparent',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.06)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  locActionBtnTextSmall: {
    fontSize: 12,
    color: '#FFF',
    opacity: 0.6,
  },
  // Location Suggestion Edit modal styles
  locEditBg: {
    position: 'absolute',
    top: 0,
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: 'rgba(8, 9, 22, 0.80)',
    justifyContent: 'center',
    padding: 20,
    zIndex: 99999,
    ...Platform.select({
      web: {
        backdropFilter: 'blur(8px)',
        // @ts-ignore
        experimental_backdropFilter: 'blur(8px)',
      },
      default: {},
    }),
  },
  locEditCard: {
    backgroundColor: CARD_BG,
    borderRadius: 20,
    borderWidth: 1.2,
    borderColor: GLASS_BORDER,
    padding: 20,
    shadowColor: '#8F66FF',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.15,
    shadowRadius: 24,
    elevation: 10,
    ...Platform.select({
      web: {
        backdropFilter: 'blur(30px)',
        // @ts-ignore
        experimental_backdropFilter: 'blur(30px)',
      },
      default: {},
    }),
  },
  locEditHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  locEditTitle: {
    fontSize: 18,
    fontWeight: '800',
    color: '#FFF',
  },
  locEditBody: {
    gap: 12,
  },
  locInputLabel: {
    fontSize: 13,
    fontWeight: '600',
    color: LIGHT_PURPLE,
  },
  locTextInput: {
    height: 46,
    borderRadius: 10,
    backgroundColor: 'rgba(255,255,255,0.05)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.1)',
    color: '#FFF',
    paddingHorizontal: 12,
    fontSize: 14,
  },
  locSaveEditBtn: {
    height: 48,
    borderRadius: 12,
    backgroundColor: PURPLE,
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: 10,
  },
  locSaveEditBtnText: {
    fontSize: 15,
    fontWeight: '700',
    color: '#FFF',
  },
  historyCard: {
    backgroundColor: 'rgba(255, 255, 255, 0.03)',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: GLASS_BORDER,
    padding: 14,
  },
  historyIconCircle: {
    width: 38,
    height: 38,
    borderRadius: 19,
    justifyContent: 'center',
    alignItems: 'center',
  },
  historyPlaceName: {
    fontSize: 15,
    fontWeight: '700',
    color: '#FFF',
  },
  historyActivityDesc: {
    fontSize: 13,
    fontWeight: '600',
    color: 'rgba(255, 255, 255, 0.6)',
  },
  historyTimeText: {
    fontSize: 11,
    color: 'rgba(255, 255, 255, 0.35)',
    marginTop: 2,
  },
  loggedChip: {
    alignSelf: 'center',
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: 'rgba(52, 211, 153, 0.2)',
    backgroundColor: 'rgba(52, 211, 153, 0.05)',
  },
  loggedChipText: {
    color: GREEN,
    fontSize: 11,
    fontWeight: '700',
  },
  logItemBtn: {
    alignSelf: 'center',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 12,
    backgroundColor: PURPLE,
  },
  logItemBtnText: {
    color: '#080916',
    fontSize: 12,
    fontWeight: '800',
  },
  redDotBadge: {
    position: 'absolute',
    top: -2,
    right: -2,
    width: 9,
    height: 9,
    borderRadius: 4.5,
    backgroundColor: RED,
    borderWidth: 1.5,
    borderColor: '#080916',
  },
});
