import React, { createContext, useContext, useState, useEffect } from 'react';
import * as SecureStore from 'expo-secure-store';
import { api } from '@/services/api';
import { useAuth } from '@/context/auth';

export interface ScheduleItem {
  id: string;
  title: string;
  timeRange: string;
  duration?: string;
  category: 'health' | 'work' | 'social' | 'rest' | 'other';
  icon: 'walk' | 'laptop' | 'groups' | 'phone' | 'gym' | 'rest';
  color: 'green' | 'purple' | 'yellow' | 'gray';
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
}

interface ScheduleContextType {
  scheduleItems: ScheduleItem[];
  addNoteAndExtract: (
    text: string, 
    dateStr?: string, 
    approvedEvents?: ScheduleItem[],
    audioDetails?: { audioUri: string; durationSeconds: number; createdAt: string }
  ) => void;
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
    let icon: 'walk' | 'laptop' | 'groups' | 'phone' | 'gym' | 'rest' = 'rest';
    let color: 'green' | 'purple' | 'yellow' | 'gray' = 'gray';
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
      color = 'green';
      defaultDurationMinutes = 60;
    } else if (lower.includes('run') || lower.includes('running')) {
      title = 'Running';
      category = 'health';
      icon = 'walk';
      color = 'green';
      defaultDurationMinutes = 30;
    } else if (lower.includes('swim') || lower.includes('swimming')) {
      title = 'Swimming';
      category = 'health';
      icon = 'gym';
      color = 'green';
      defaultDurationMinutes = 45;
    } else if (lower.includes('hike') || lower.includes('hiking')) {
      title = 'Hiking';
      category = 'health';
      icon = 'walk';
      color = 'green';
      defaultDurationMinutes = 120;
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
      (u) => u.title.toLowerCase() === ev.title.toLowerCase() && u.startTime === ev.startTime
    );
    if (!isDuplicate) {
      uniqueEvents.push(ev);
    }
  });

  return uniqueEvents;
}

export function ScheduleProvider({ children }: { children: React.ReactNode }) {
  const [scheduleItems, setScheduleItems] = useState<ScheduleItem[]>([]);
  const { token } = useAuth();

  // Load offline local backup on mount
  useEffect(() => {
    async function loadLocalBackup() {
      try {
        const backupStr = await SecureStore.getItemAsync('local_activities_backup');
        if (backupStr) {
          const backupItems = JSON.parse(backupStr) as ScheduleItem[];
          console.log('💾 [Offline Backup] Loaded local backup:', backupItems.length, 'items');
          setScheduleItems((prev) => {
            const merged = [...prev];
            backupItems.forEach((backup) => {
              const exists = merged.some(
                (item) => item.date === backup.date && item.title.toLowerCase() === backup.title.toLowerCase() && item.startTime === backup.startTime
              );
              if (!exists) {
                merged.push(backup);
              }
            });
            return merged;
          });
        }
      } catch (err) {
        console.error('Failed to load local backup from SecureStore:', err);
      }
    }
    loadLocalBackup();
  }, []);

  const fetchUserSchedule = async () => {
    if (!token) {
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
          (u) => u.title.toLowerCase() === ev.title.toLowerCase() && u.startTime === ev.startTime && u.date === ev.date
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
            (item) => item.date === fe.date && item.title.toLowerCase() === fe.title.toLowerCase() && item.startTime === fe.startTime
          );
          if (!exists) {
            merged.push(fe);
          }
        });

        // Sync consolidated list back to local backup
        SecureStore.setItemAsync('local_activities_backup', JSON.stringify(merged)).catch((err) => {
          console.error('Failed to save local backup from merge:', err);
        });

        return merged;
      });
    } catch (e) {
      console.error('Failed to fetch user schedule', e);
    }
  };

  useEffect(() => {
    fetchUserSchedule();
  }, [token]);

  const approveSuggestion = (id: string) => {
    setScheduleItems((prev) => {
      const updated = prev.map((item) => {
        if (item.id === id) {
          const cleanTitle = item.title.replace('Suggested: ', '');
          return { ...item, title: cleanTitle, isApproved: true };
        }
        return item;
      });

      SecureStore.setItemAsync('local_activities_backup', JSON.stringify(updated)).catch((err) => {
        console.error('Failed to save local backup:', err);
      });

      return updated;
    });
  };

  const addNoteAndExtract = (
    text: string, 
    dateStr = getTodayDateStr(), 
    approvedEvents?: ScheduleItem[],
    audioDetails?: { audioUri: string; durationSeconds: number; createdAt: string }
  ) => {
    const eventsToAdd = approvedEvents && approvedEvents.length > 0
      ? approvedEvents
      : parseNotesToEvents(text, dateStr);

    const eventsWithAudio = eventsToAdd.map((ev) => ({
      ...ev,
      audioDetails: audioDetails || ev.audioDetails,
    }));

    setScheduleItems((prev) => {
      // Remove any items in the existing list that have the same date, title, and startTime as the new events, to prevent duplicates
      const cleanedPrev = prev.filter(
        (item) => !eventsWithAudio.some(
          (n) => n.date === item.date && n.title.toLowerCase() === item.title.toLowerCase() && n.startTime === item.startTime
        )
      );
      const updated = [...eventsWithAudio, ...cleanedPrev];

      // Save local backup to SecureStore
      SecureStore.setItemAsync('local_activities_backup', JSON.stringify(updated)).catch((err) => {
        console.error('Failed to save local activities backup:', err);
      });

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
