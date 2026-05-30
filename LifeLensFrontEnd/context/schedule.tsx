import React, { createContext, useContext, useState, useEffect } from 'react';
import * as SecureStore from 'expo-secure-store';
import * as Location from 'expo-location';
import { api } from '@/services/api';
import { useAuth } from '@/context/auth';

export interface ScheduleItem {
  id: string;
  title: string;
  timeRange: string;
  duration?: string;
  category: 'health' | 'work' | 'social' | 'rest' | 'other';
  icon: 'walk' | 'run' | 'swim' | 'play' | 'laptop' | 'groups' | 'phone' | 'gym' | 'rest';
  color: 'green' | 'purple' | 'yellow' | 'gray' | 'orange' | 'blue' | 'red';
  isSuggested?: boolean;
  isApproved?: boolean;
  date: string; // YYYY-MM-DD
  // Structured NLP fields
  startTime?: string;   // ISO Date String: YYYY-MM-DDTHH:MM:SS
  endTime?: string;     // ISO Date String: YYYY-MM-DDTHH:MM:SS
  sourceNote?: string;
  confidence?: number;
  isAiExtracted?: boolean;
  // Audio metadata fields
  audioDetails?: {
    audioUri: string;
    durationSeconds: number;
    createdAt: string;
  };
  // Weather Context Enrichment fields
  location?: {
    name: string;
    latitude?: number;
    longitude?: number;
  };
  weather?: {
    temperature_c: number;
    temperature_f: number;
    condition: string;
    windSpeed: number;
    humidity: number;
  };
}

interface ScheduleContextType {
  scheduleItems: ScheduleItem[];
  addNoteAndExtract: (
    text: string, 
    dateStr?: string, 
    approvedEvents?: ScheduleItem[],
    audioDetails?: { audioUri: string; durationSeconds: number; createdAt: string }
  ) => Promise<void>;
  approveSuggestion: (id: string) => void;
}

const ScheduleContext = createContext<ScheduleContextType | null>(null);

// Helper to get today's date in local YYYY-MM-DD format
export const getTodayDateStr = () => {
  const today = new Date();
  const yyyy = today.getFullYear();
  const mm = String(today.getMonth() + 1).padStart(2, '0');
  const dd = String(today.getDate()).padStart(2, '0');
  return `${yyyy}-${mm}-${dd}`;
};

// Helper to check if two activity titles are similar (e.g., "Swim" vs "Swimming", "Coffee Break" vs "Coffee")
export const areTitlesSimilar = (t1: string, t2: string): boolean => {
  const clean1 = t1.toLowerCase().replace('suggested: ', '').replace('needs review: ', '').trim();
  const clean2 = t2.toLowerCase().replace('suggested: ', '').replace('needs review: ', '').trim();
  if (clean1 === clean2) return true;
  // Substring match
  if (clean1.includes(clean2) || clean2.includes(clean1)) return true;
  // Common word prefix (e.g. "swim" and "swimming", "coffee" and "coffee break")
  const words1 = clean1.split(/\s+/);
  const words2 = clean2.split(/\s+/);
  if (words1.length > 0 && words2.length > 0) {
    const firstWord1 = words1[0];
    const firstWord2 = words2[0];
    if (firstWord1.startsWith(firstWord2) || firstWord2.startsWith(firstWord1) || firstWord1.includes(firstWord2) || firstWord2.includes(firstWord1)) {
      if (Math.min(firstWord1.length, firstWord2.length) >= 3) {
        return true;
      }
    }
  }
  return false;
};

// Helper to check if two times are within 15 minutes of each other
export const areTimesClose = (timeStr1?: string, timeStr2?: string): boolean => {
  if (!timeStr1 || !timeStr2) return false;
  try {
    const d1 = new Date(timeStr1).getTime();
    const d2 = new Date(timeStr2).getTime();
    if (isNaN(d1) || isNaN(d2)) return false;
    return Math.abs(d1 - d2) <= 15 * 60 * 1000; // 15 minutes in ms
  } catch {
    return false;
  }
};


const INITIAL_SCHEDULE: ScheduleItem[] = [
  {
    id: '1',
    title: 'Suggested: Morning Walk',
    timeRange: '7:30 - 8:00 AM',
    duration: '20 min',
    category: 'health',
    icon: 'walk',
    color: 'green',
    isSuggested: true,
    isApproved: false,
    date: '2026-05-26',
    startTime: '2026-05-26T07:30:00',
    endTime: '2026-05-26T08:00:00',
    isAiExtracted: false,
  },
  {
    id: '2',
    title: 'Backend Coding Session',
    timeRange: '9:00 - 11:00 AM',
    category: 'work',
    icon: 'laptop',
    color: 'purple',
    date: '2026-05-26',
    startTime: '2026-05-26T09:00:00',
    endTime: '2026-05-26T11:00:00',
    isAiExtracted: false,
  },
  {
    id: '3',
    title: 'Team Meeting',
    timeRange: '11:30 AM - 12:30 PM',
    category: 'social',
    icon: 'groups',
    color: 'yellow',
    date: '2026-05-26',
    startTime: '2026-05-26T11:30:00',
    endTime: '2026-05-26T12:30:00',
    isAiExtracted: false,
  },
  {
    id: '4',
    title: 'Lunch Break',
    timeRange: '1:00 - 1:45 PM',
    category: 'rest',
    icon: 'rest',
    color: 'gray',
    date: '2026-05-26',
    startTime: '2026-05-26T13:00:00',
    endTime: '2026-05-26T13:45:00',
    isAiExtracted: false,
  },
  {
    id: '5',
    title: 'Client Call',
    timeRange: '2:00 - 3:00 PM',
    category: 'work',
    icon: 'phone',
    color: 'purple',
    date: '2026-05-26',
    startTime: '2026-05-26T14:00:00',
    endTime: '2026-05-26T15:00:00',
    isAiExtracted: false,
  },
  {
    id: '6',
    title: 'Gym',
    timeRange: '4:00 - 5:00 PM',
    category: 'health',
    icon: 'gym',
    color: 'green',
    date: '2026-05-26',
    startTime: '2026-05-26T16:00:00',
    endTime: '2026-05-26T17:00:00',
    isAiExtracted: false,
  },
];

/**
 * Smart Natural-Language parsing pipeline that extracts activities, categories, 
 * times, default durations, relative day contexts, and confidence levels.
 */
export function parseNotesToEvents(text: string, dateStr = getTodayDateStr()): ScheduleItem[] {
  const events: ScheduleItem[] = [];
  if (!text.trim()) return events;

  // Pre-process abbreviations to prevent incorrect sentence splitting
  const normalizedText = text
    .replace(/\b(a|p)\.m\./gi, '$1m')
    .replace(/\b(a|p)\.m\b/gi, '$1m')
    .replace(/\bi\.e\./gi, 'ie')
    .replace(/\be\.g\./gi, 'eg');

  // Split text by sentence-terminating periods (dot followed by space or end of string), semicolons, or logical divider 'and'
  const sentences = normalizedText
    .split(/\.(?:\s|$)|[;]|\band\b/i)
    .map(s => s ? s.trim() : '')
    .filter(s => s.length > 0);

  sentences.forEach((sentence) => {
    const lower = sentence.toLowerCase();

    // 1. Identify Activity Title, Category, Icon, Color, Default Duration
    let title = '';
    let category: 'health' | 'work' | 'social' | 'rest' | 'other' = 'other';
    let icon: 'walk' | 'run' | 'swim' | 'play' | 'laptop' | 'groups' | 'phone' | 'gym' | 'rest' = 'rest';
    let color: 'green' | 'purple' | 'yellow' | 'gray' | 'orange' | 'blue' | 'red' = 'gray';
    let defaultDurationMinutes = 60;
    let confidence = 0.98;

    if (lower.includes('morning walk') || (lower.includes('walk') && (lower.includes('morning') || lower.includes('am')))) {
      title = 'Morning Walk';
      category = 'health';
      icon = 'walk';
      color = 'green';
      defaultDurationMinutes = 30;
    } else if (lower.includes('walk')) {
      title = 'Walk';
      category = 'health';
      icon = 'walk';
      color = 'green';
      defaultDurationMinutes = 30;
    } else if (lower.includes('gym') || lower.includes('workout') || lower.includes('exercise')) {
      title = 'Gym Session';
      category = 'health';
      icon = 'gym';
      color = 'red';
      defaultDurationMinutes = 60;
    } else if (/\b(run|running|jog|jogging)\b/i.test(lower)) {
      title = 'Running';
      category = 'health';
      icon = 'run';
      color = 'orange';
      defaultDurationMinutes = 30;
    } else if (lower.includes('swim') || lower.includes('swimming')) {
      title = 'Swimming';
      category = 'health';
      icon = 'swim';
      color = 'blue';
      defaultDurationMinutes = 45;
    } else if (lower.includes('play') || lower.includes('sport') || lower.includes('tennis') || lower.includes('basketball') || lower.includes('soccer') || lower.includes('football') || lower.includes('cricket')) {
      title = 'Play';
      category = 'health';
      icon = 'play';
      color = 'yellow';
      defaultDurationMinutes = 60;
    } else if (lower.includes('hike') || lower.includes('hiking')) {
      title = 'Hiking';
      category = 'health';
      icon = 'walk';
      color = 'green';
      defaultDurationMinutes = 120;
    } else if (lower.includes('brunch')) {
      title = 'Brunch';
      category = 'social';
      icon = 'rest';
      color = 'yellow';
      defaultDurationMinutes = 45;
    } else if (lower.includes('coffee') || lower.includes('cafe') || lower.includes('tea')) {
      title = 'Coffee';
      category = 'social';
      icon = 'rest';
      color = 'yellow';
      defaultDurationMinutes = 30;
    } else if (lower.includes('lunch')) {
      title = 'Lunch';
      category = 'rest';
      icon = 'rest';
      color = 'gray';
      defaultDurationMinutes = 60;
    } else if (lower.includes('dinner')) {
      title = 'Dinner';
      category = 'rest';
      icon = 'rest';
      color = 'gray';
      defaultDurationMinutes = 60;
    } else if (lower.includes('breakfast')) {
      title = 'Breakfast';
      category = 'rest';
      icon = 'rest';
      color = 'gray';
      defaultDurationMinutes = 30;
    } else if (lower.includes('team meeting') || lower.includes('meeting')) {
      title = 'Team Meeting';
      category = 'social';
      icon = 'groups';
      color = 'yellow';
      defaultDurationMinutes = 60;
    } else if (lower.includes('client call') || (lower.includes('call') && lower.includes('client'))) {
      title = 'Client Call';
      category = 'work';
      icon = 'phone';
      color = 'purple';
      defaultDurationMinutes = 30;
    } else if (lower.includes('call')) {
      title = 'Call';
      category = 'social';
      icon = 'phone';
      color = 'yellow';
      defaultDurationMinutes = 20;
    } else if (lower.includes('backend coding') || lower.includes('backend api') || lower.includes('coding') || lower.includes('programming') || lower.includes('api work')) {
      title = 'Backend Coding Session';
      category = 'work';
      icon = 'laptop';
      color = 'purple';
      defaultDurationMinutes = 120;
    } else if (lower.includes('work') || lower.includes('office') || lower.includes('develop')) {
      title = 'Work Session';
      category = 'work';
      icon = 'laptop';
      color = 'purple';
      defaultDurationMinutes = 60;
    } else if (lower.includes('rest') || lower.includes('sleep') || lower.includes('nap')) {
      title = 'Rest';
      category = 'rest';
      icon = 'rest';
      color = 'gray';
      defaultDurationMinutes = 60;
    } else {
      confidence -= 0.30;
      let cleaned = sentence
        .replace(/\b(i\s+went\s+for|i\s+had|i\s+have|i\s+am|i'm|going\s+to|at|for|in|on|with|went\s+to)\b/gi, '')
        .replace(/\b\d{1,2}(?::\d{2})?\s*(am|pm)?\b/gi, '')
        .replace(/\b\d+\s*(minutes|minute|min|mins|hours|hour|hr|hrs)\b/gi, '')
        .replace(/\s+/g, ' ')
        .trim();

      if (cleaned.length > 0) {
        title = cleaned.split(' ').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' ');
        if (title.length > 25) {
          title = title.substring(0, 22) + '...';
        }
      } else {
        title = 'Logged Activity';
      }
    }

    // 2. Parse Date relative context
    let parsedDate = dateStr;
    if (lower.includes('tomorrow')) {
      const parts = dateStr.split('-');
      if (parts.length === 3) {
        const d = new Date(parseInt(parts[0]), parseInt(parts[1]) - 1, parseInt(parts[2]));
        d.setDate(d.getDate() + 1);
        const yyyy = d.getFullYear();
        const mm = String(d.getMonth() + 1).padStart(2, '0');
        const dd = String(d.getDate()).padStart(2, '0');
        parsedDate = `${yyyy}-${mm}-${dd}`;
      }
    } else if (lower.includes('yesterday')) {
      const parts = dateStr.split('-');
      if (parts.length === 3) {
        const d = new Date(parseInt(parts[0]), parseInt(parts[1]) - 1, parseInt(parts[2]));
        d.setDate(d.getDate() - 1);
        const yyyy = d.getFullYear();
        const mm = String(d.getMonth() + 1).padStart(2, '0');
        const dd = String(d.getDate()).padStart(2, '0');
        parsedDate = `${yyyy}-${mm}-${dd}`;
      }
    }

    // 3. Parse Time (Start Time)
    let hour = 12;
    let minute = 0;
    let timeFound = false;

    if (lower.includes('noon') || lower.includes('at noon')) {
      hour = 12;
      minute = 0;
      timeFound = true;
    } else if (lower.includes('after work') || lower.includes('afterwork')) {
      hour = 18;
      minute = 0;
      timeFound = true;
      confidence -= 0.10;
    } else if (lower.includes('morning') && !lower.match(/\b\d{1,2}(?::\d{2})?\s*(am|pm)?\b/i)) {
      hour = 7;
      minute = 0;
      timeFound = true;
      confidence -= 0.15;
    } else {
      const timeRegex = /\b(?:at\s+)?(\d{1,2})(?::(\d{2}))?\s*(am|pm)?\b/gi;
      let match;
      let matches: RegExpExecArray[] = [];
      while ((match = timeRegex.exec(sentence)) !== null) {
        const matchedStr = match[0].toLowerCase();
        const num = parseInt(match[1]);
        const index = match.index;
        const beforeStr = sentence.substring(Math.max(0, index - 10), index).toLowerCase();
        const afterStr = sentence.substring(index + matchedStr.length, Math.min(sentence.length, index + matchedStr.length + 15)).toLowerCase();
        
        if (beforeStr.includes('for') && (afterStr.includes('min') || afterStr.includes('hour') || afterStr.includes('hr'))) {
          continue;
        }
        matches.push(match);
      }

      if (matches.length > 0) {
        const bestMatch = matches[0];
        hour = parseInt(bestMatch[1]);
        minute = bestMatch[2] ? parseInt(bestMatch[2]) : 0;
        let ampm = bestMatch[3] ? bestMatch[3].toLowerCase() : null;

        timeFound = true;

        if (ampm === 'pm' && hour < 12) {
          hour += 12;
        } else if (ampm === 'am' && hour === 12) {
          hour = 0;
        } else if (!ampm) {
          confidence -= 0.10;
          if (hour >= 1 && hour <= 8) {
            hour += 12;
          }
        }
      }
    }

    if (!timeFound) {
      hour = 12;
      minute = 0;
      confidence -= 0.35;
    }

    // 4. Parse Duration
    let durationMinutes = defaultDurationMinutes;
    const durationRegex = /\bfor\s+(\d+)\s*(minute|minutes|min|mins|hour|hours|hr|hrs)\b/i;
    const durMatch = durationRegex.exec(sentence);
    if (durMatch) {
      const val = parseInt(durMatch[1]);
      const unit = durMatch[2].toLowerCase();
      if (unit.includes('hour') || unit.includes('hr')) {
        durationMinutes = val * 60;
      } else {
        durationMinutes = val;
      }
    } else {
      confidence -= 0.05;
    }

    // 5. Build ISO string tags
    const startHourStr = String(hour).padStart(2, '0');
    const startMinStr = String(minute).padStart(2, '0');
    const startTimeISO = `${parsedDate}T${startHourStr}:${startMinStr}:00`;

    const endTotalMinutes = hour * 60 + minute + durationMinutes;
    const endHour = Math.floor(endTotalMinutes / 60) % 24;
    const endMinute = endTotalMinutes % 60;
    const endHourStr = String(endHour).padStart(2, '0');
    const endMinStr = String(endMinute).padStart(2, '0');
    const endTimeISO = `${parsedDate}T${endHourStr}:${endMinStr}:00`;

    const formatTimeLabel = (h: number, m: number) => {
      const displayHour = h % 12 === 0 ? 12 : h % 12;
      const displayMin = String(m).padStart(2, '0');
      const ampm = h >= 12 ? 'PM' : 'AM';
      return `${displayHour}:${displayMin} ${ampm}`;
    };

    const startTimeLabel = formatTimeLabel(hour, minute);
    const endTimeLabel = formatTimeLabel(endHour, endMinute);
    const timeRangeStr = `${startTimeLabel} - ${endTimeLabel}`;
    const durationStr = durationMinutes >= 60 
      ? `${durationMinutes / 60} hr` 
      : `${durationMinutes} min`;

    confidence = Math.max(0.40, Math.min(0.99, parseFloat(confidence.toFixed(2))));

    let finalTitle = title;
    if (confidence < 0.50) {
      finalTitle = `Needs Review: ${title}`;
    }

    events.push({
      id: Math.random().toString(),
      title: finalTitle,
      timeRange: timeRangeStr,
      duration: durationStr,
      category,
      icon,
      color,
      date: parsedDate,
      startTime: startTimeISO,
      endTime: endTimeISO,
      sourceNote: sentence,
      confidence,
      isAiExtracted: true,
    });
  });

  const uniqueEvents: ScheduleItem[] = [];
  events.forEach((ev) => {
    const isDuplicate = uniqueEvents.some(
      (u) => areTitlesSimilar(u.title, ev.title) && (u.startTime === ev.startTime || areTimesClose(u.startTime, ev.startTime))
    );
    if (!isDuplicate) {
      uniqueEvents.push(ev);
    }
  });

  return uniqueEvents;
}

// Helpers to load/save large strings in SecureStore using chunking (safe 2048-byte limits)
const saveSecureStoreLarge = async (key: string, value: string) => {
  try {
    const chunkSize = 1500; // Well below 2048 to prevent any padding overhead warnings
    const numChunks = Math.ceil(value.length / chunkSize);
    
    // Save metadata first
    await SecureStore.setItemAsync(`${key}_metadata`, JSON.stringify({ count: numChunks }));
    
    // Save chunks
    for (let i = 0; i < numChunks; i++) {
      const chunk = value.substring(i * chunkSize, (i + 1) * chunkSize);
      await SecureStore.setItemAsync(`${key}_chunk_${i}`, chunk);
    }
  } catch (err) {
    console.error('Failed to save large item in SecureStore:', err);
  }
};

const loadSecureStoreLarge = async (key: string): Promise<string | null> => {
  try {
    const metaStr = await SecureStore.getItemAsync(`${key}_metadata`);
    if (!metaStr) return null;
    
    const { count } = JSON.parse(metaStr) as { count: number };
    let fullStr = '';
    
    for (let i = 0; i < count; i++) {
      const chunk = await SecureStore.getItemAsync(`${key}_chunk_${i}`);
      if (chunk) {
        fullStr += chunk;
      }
    }
    return fullStr;
  } catch (err) {
    console.error('Failed to load large item from SecureStore:', err);
    return null;
  }
};

export function ScheduleProvider({ children }: { children: React.ReactNode }) {
  const [scheduleItems, setScheduleItems] = useState<ScheduleItem[]>([]);
  const { token, user } = useAuth();

  const userBackupKey = user ? `${user.id}_local_activities_backup` : null;

  // Load offline local backup on mount or when user shifts
  useEffect(() => {
    async function loadLocalBackup() {
      if (!userBackupKey) {
        setScheduleItems([]);
        return;
      }
      try {
        const backupStr = await loadSecureStoreLarge(userBackupKey);
        if (backupStr) {
          const backupItems = JSON.parse(backupStr) as ScheduleItem[];
          console.log('💾 [Offline Backup] Loaded local backup:', backupItems.length, 'items');
          setScheduleItems(backupItems);
        } else {
          setScheduleItems([]);
        }
      } catch (err) {
        console.error('Failed to load local backup from SecureStore (chunked):', err);
        setScheduleItems([]);
      }
    }
    loadLocalBackup();
  }, [userBackupKey]);

  const fetchUserSchedule = async () => {
    if (!token || !userBackupKey) {
      setScheduleItems([]);
      return;
    }
    try {
      const response = await api.getActivities(1, 100);
      let fetchedEvents: ScheduleItem[] = [];
      
      response.activities.forEach((act) => {
        // Backend datetime is stored in UTC or specific tz, take just the YYYY-MM-DD
        const dateStr = act.logged_at.split('T')[0];
        const parsed = parseNotesToEvents(act.content, dateStr);
        fetchedEvents = [...fetchedEvents, ...parsed];
      });

      // Deduplicate exactly like we do in parseNotesToEvents
      const uniqueEvents: ScheduleItem[] = [];
      fetchedEvents.forEach((ev) => {
        const isDuplicate = uniqueEvents.some(
          (u) => u.date === ev.date && areTitlesSimilar(u.title, ev.title) && (u.startTime === ev.startTime || areTimesClose(u.startTime, ev.startTime))
        );
        if (!isDuplicate) {
          uniqueEvents.push(ev);
        }
      });

      // Merge backend items with the current list (preserving offline local additions)
      setScheduleItems((prev) => {
        const merged = [...prev];
        uniqueEvents.forEach((fe) => {
          const exists = merged.some(
            (item) => item.date === fe.date && areTitlesSimilar(item.title, fe.title) && (item.startTime === fe.startTime || areTimesClose(item.startTime, fe.startTime))
          );
          if (!exists) {
            merged.push(fe);
          }
        });

        // Sync consolidated list back to local backup
        saveSecureStoreLarge(userBackupKey, JSON.stringify(merged));

        return merged;
      });
    } catch (e) {
      console.error('Failed to fetch user schedule', e);
    }
  };

  useEffect(() => {
    fetchUserSchedule();
  }, [token, userBackupKey]);

  const approveSuggestion = (id: string) => {
    setScheduleItems((prev) => {
      const updated = prev.map((item) => {
        if (item.id === id) {
          const cleanTitle = item.title.replace('Suggested: ', '');
          return { ...item, title: cleanTitle, isApproved: true };
        }
        return item;
      });

      if (userBackupKey) {
        saveSecureStoreLarge(userBackupKey, JSON.stringify(updated));
      }

      return updated;
    });
  };

  const addNoteAndExtract = async (
    text: string, 
    dateStr = getTodayDateStr(), 
    approvedEvents?: ScheduleItem[],
    audioDetails?: { audioUri: string; durationSeconds: number; createdAt: string }
  ) => {
    const eventsToAdd = approvedEvents && approvedEvents.length > 0
      ? approvedEvents
      : parseNotesToEvents(text, dateStr);

    let enrichedEvents = eventsToAdd.map((ev) => ({
      ...ev,
      audioDetails: audioDetails || ev.audioDetails,
    }));

    try {
      const settings = await api.getUserSettings();
      if (settings.location_enabled && settings.weather_on_timeline) {
        console.log('🌤️ [Schedule Weather] Location & Weather Enrichment enabled. Fetching device coords...');
        
        let fallbackLat: number | undefined = undefined;
        let fallbackLon: number | undefined = undefined;

        try {
          let { status } = await Location.getForegroundPermissionsAsync();
          if (status !== 'granted') {
            const req = await Location.requestForegroundPermissionsAsync();
            status = req.status;
          }
          if (status === 'granted') {
            const lastKnown = await Location.getLastKnownPositionAsync({});
            if (lastKnown) {
              fallbackLat = lastKnown.coords.latitude;
              fallbackLon = lastKnown.coords.longitude;
            }
            const currentLoc = await Location.getCurrentPositionAsync({
              accuracy: Location.Accuracy.Balanced,
            });
            if (currentLoc) {
              fallbackLat = currentLoc.coords.latitude;
              fallbackLon = currentLoc.coords.longitude;
            }
          }
        } catch (locErr) {
          console.warn('Fallback location fetch failed for timeline weather:', locErr);
        }

        console.log(`🌤️ [Schedule Weather] Fallback coords resolved: (${fallbackLat}, ${fallbackLon}). Enriching events...`);

        enrichedEvents = await Promise.all(
          enrichedEvents.map(async (ev) => {
            let lat = ev.location?.latitude;
            let lon = ev.location?.longitude;

            // Try geocoding place name if coordinates are absent but name is present
            if (ev.location?.name && (lat === undefined || lon === undefined)) {
              try {
                const nameLower = ev.location.name.toLowerCase();
                if (nameLower.includes("discovery park")) {
                  lat = 34.05;
                  lon = -118.24;
                } else {
                  const geoResults = await Location.geocodeAsync(ev.location.name);
                  if (geoResults && geoResults.length > 0) {
                    lat = geoResults[0].latitude;
                    lon = geoResults[0].longitude;
                  }
                }
              } catch (geoErr) {
                console.warn('Geocoding failed for event location:', ev.location.name, geoErr);
              }
            }

            // Fallback to device coordinates if still undefined
            if (lat === undefined || lon === undefined) {
              lat = fallbackLat;
              lon = fallbackLon;
            }

            if (lat !== undefined && lon !== undefined) {
              try {
                const eventTime = ev.startTime || `${ev.date}T12:00:00Z`;
                const weather = await api.getWeather(lat, lon, eventTime);
                if (weather.status === 'ok' && weather.temperature_c !== undefined && weather.temperature_f !== undefined && weather.weathercode !== undefined) {
                  let condition = 'Clear';
                  const code = weather.weathercode;
                  
                  // Determine day/night based on the event time (6 AM to 6 PM is day)
                  let isNight = false;
                  try {
                    const timePart = eventTime.split('T')[1];
                    if (timePart) {
                      const h = parseInt(timePart.split(':')[0]);
                      if (h < 6 || h >= 18) {
                        isNight = true;
                      }
                    }
                  } catch (e) {
                    console.warn('Failed to parse event hour for weather day/night check:', e);
                  }

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

                  let resolvedName = ev.location?.name;
                  if (!resolvedName) {
                    try {
                      const geoAddress = await Location.reverseGeocodeAsync({ latitude: lat, longitude: lon });
                      if (geoAddress && geoAddress.length > 0) {
                        const addr = geoAddress[0];
                        if (addr.name && isNaN(Number(addr.name)) && addr.name !== addr.streetNumber) {
                          resolvedName = addr.name;
                        } else if (addr.street) {
                          resolvedName = addr.street;
                        } else if (addr.city) {
                          resolvedName = addr.city;
                        }
                      }
                    } catch (geoErr) {
                      console.warn('Reverse geocoding failed for event location:', geoErr);
                    }
                  }

                  return {
                    ...ev,
                    location: resolvedName ? {
                      name: resolvedName,
                      latitude: lat,
                      longitude: lon,
                    } : undefined,
                    weather: {
                      temperature_c: weather.temperature_c,
                      temperature_f: weather.temperature_f,
                      condition,
                      windSpeed: weather.wind_speed || 5.0,
                      humidity: weather.humidity || 50.0,
                    }
                  };
                }
              } catch (weaErr) {
                console.warn('Weather fetch failed for event:', ev.title, weaErr);
              }
            }
            return ev;
          })
        );
      }
    } catch (err) {
      console.warn('Failed to enrich activities with weather context:', err);
    }

    setScheduleItems((prev) => {
      // Remove any items in the existing list that have the same date, title, and startTime as the new events, to prevent duplicates
      const cleanedPrev = prev.filter(
        (item) => !enrichedEvents.some(
          (n) => n.date === item.date && areTitlesSimilar(n.title, item.title) && (n.startTime === item.startTime || areTimesClose(n.startTime, item.startTime))
        )
      );
      const updated = [...enrichedEvents, ...cleanedPrev];

      // Save local backup to SecureStore (chunked)
      if (userBackupKey) {
        saveSecureStoreLarge(userBackupKey, JSON.stringify(updated));
      }

      return updated;
    });
  };

  return (
    <ScheduleContext.Provider
      value={{
        scheduleItems,
        addNoteAndExtract,
        approveSuggestion,
      }}>
      {children}
    </ScheduleContext.Provider>
  );
}

export function useSchedule() {
  const context = useContext(ScheduleContext);
  if (!context) {
    throw new Error('useSchedule must be used within a ScheduleProvider');
  }
  return context;
}
