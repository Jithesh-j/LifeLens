import React, { useState } from 'react';
import { StyleSheet, View, ScrollView, TouchableOpacity, Platform } from 'react-native';
import { useRouter } from 'expo-router';
import { useSchedule, getTodayDateStr } from '@/context/schedule';
import { useCalendarUI } from '@/context/calendar-ui';
import { ThemedText } from '@/components/themed-text';
import { useThemeColor } from '@/hooks/use-theme-color';
import { IconSymbol } from '@/components/ui/icon-symbol';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { SPACING, TYPOGRAPHY, useThemeColors } from '@/constants/design-system';

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

// Helper to get 7 days of the week containing a target date string
const getDaysOfWeek = (targetDateStr: string) => {
  const targetDate = new Date(targetDateStr + 'T00:00:00');
  const dayOfWeek = targetDate.getDay(); // 0-6
  const sunday = new Date(targetDate);
  sunday.setDate(targetDate.getDate() - dayOfWeek);

  const days = [];
  const weekdayLabels = ['S', 'M', 'T', 'W', 'T', 'F', 'S'];

  for (let i = 0; i < 7; i++) {
    const day = new Date(sunday);
    day.setDate(sunday.getDate() + i);
    const yyyy = day.getFullYear();
    const mm = String(day.getMonth() + 1).padStart(2, '0');
    const dd = String(day.getDate()).padStart(2, '0');
    days.push({
      day: weekdayLabels[i],
      dateNum: String(day.getDate()),
      dateStr: `${yyyy}-${mm}-${dd}`,
    });
  }
  return days;
};

// Helper to format Month and Year (e.g., "May 2026")
const getMonthYearLabel = (dateStr: string) => {
  const d = new Date(dateStr + 'T00:00:00');
  return d.toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
};

// Helper to format short Timeline header (e.g., "Timeline • May 26")
const getTimelineHeaderLabel = (dateStr: string) => {
  const d = new Date(dateStr + 'T00:00:00');
  return `Timeline • ${d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}`;
};

// Helper for human-readable labels: Today, Yesterday, Tomorrow or day name
const getDayLabel = (dateStr: string) => {
  const todayStr = getTodayDateStr();
  if (dateStr === todayStr) {
    return 'Today';
  }
  const today = new Date(todayStr + 'T00:00:00');
  const target = new Date(dateStr + 'T00:00:00');
  const diffTime = target.getTime() - today.getTime();
  const diffDays = Math.round(diffTime / (1000 * 60 * 60 * 24));
  if (diffDays === -1) {
    return 'Yesterday';
  } else if (diffDays === 1) {
    return 'Tomorrow';
  }
  return target.toLocaleDateString('en-US', { weekday: 'long' });
};

const getFullDateLabel = (dateStr: string) => {
  const d = new Date(dateStr + 'T00:00:00');
  return d.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' });
};

export default function CalendarScreen() {
  const router = useRouter();
  const { scheduleItems, approveSuggestion } = useSchedule();
  const { calendarExpanded, setCalendarExpanded, selectedDate, setSelectedDate } = useCalendarUI();
  const insets = useSafeAreaInsets();

  const COLORS = useThemeColors();
  // Themes & Styling Mappings
  const primaryColor = COLORS.primary;
  const headerNavy = COLORS.bg;
  const accentGreen = COLORS.health;
  const cardBg = COLORS.surfaceCard;
  const glassBorder = COLORS.surfaceBorder;

  const styles = React.useMemo(() => getStyles(COLORS), [COLORS]);

  // Dynamic monthly planner structure based on selected date's month
  const calendarDaysMonth = React.useMemo(() => {
    const dateObj = new Date(selectedDate + 'T00:00:00');
    const year = dateObj.getFullYear();
    const month = dateObj.getMonth();
    const firstDayIndex = new Date(year, month, 1).getDay();
    const totalDays = new Date(year, month + 1, 0).getDate();
    
    const days: (string | null)[] = [];
    for (let i = 0; i < firstDayIndex; i++) {
      days.push(null);
    }
    for (let day = 1; day <= totalDays; day++) {
      days.push(String(day));
    }
    return days;
  }, [selectedDate]);

  // Dynamic Collapsed Weekday Strip based on the week containing selected date
  const calendarDaysWeek = React.useMemo(() => {
    return getDaysOfWeek(selectedDate);
  }, [selectedDate]);

  const weekdayLabels = ['S', 'M', 'T', 'W', 'T', 'F', 'S'];

  // Helper to check if a monthly planner date cell has active events
  const dateHasEvents = (dayStr: string | null) => {
    if (!dayStr) return false;
    const dateObj = new Date(selectedDate + 'T00:00:00');
    const yyyy = dateObj.getFullYear();
    const mm = String(dateObj.getMonth() + 1).padStart(2, '0');
    const formattedDay = dayStr.padStart(2, '0');
    const fullDate = `${yyyy}-${mm}-${formattedDay}`;
    return scheduleItems.some(
      (item) => item.date === fullDate && (!item.isSuggested || item.isApproved)
    );
  };

  const handleDatePress = (dayStr: string | null) => {
    if (!dayStr) return;
    const dateObj = new Date(selectedDate + 'T00:00:00');
    const yyyy = dateObj.getFullYear();
    const mm = String(dateObj.getMonth() + 1).padStart(2, '0');
    const formattedDay = dayStr.padStart(2, '0');
    setSelectedDate(`${yyyy}-${mm}-${formattedDay}`);
  };

  // Filter and sort events chronologically by start_time ascending
  const filteredEvents = scheduleItems
    .filter((item) => item.date === selectedDate && (!item.isSuggested || item.isApproved))
    .sort((a, b) => {
      const timeA = a.startTime || `${a.date}T${a.timeRange.includes('AM') ? '00:00:00' : '12:00:00'}`;
      const timeB = b.startTime || `${b.date}T${b.timeRange.includes('AM') ? '00:00:00' : '12:00:00'}`;
      return timeA.localeCompare(timeB);
    });

  // Suggested item for today that is NOT yet approved
  const todayStr = getTodayDateStr();
  const pendingSuggestion = scheduleItems.find(
    (item) => item.date === todayStr && item.isSuggested && !item.isApproved
  );

  // Dynamic Time Slots generation for chronological Timeline Display (sorted chronologically)
  const dynamicTimeSlots = React.useMemo(() => {
    const baseSlots = [
      { label: '7:00 AM', hourKey: '7' },
      { label: '9:00 AM', hourKey: '9' },
      { label: '11:30 AM', hourKey: '11.5' },
      { label: '12:00 PM', hourKey: '12' },
      { label: '1:00 PM', hourKey: '13' },
      { label: '2:00 PM', hourKey: '14' },
      { label: '4:00 PM', hourKey: '16' },
      { label: '5:00 PM', hourKey: '17' },
      { label: '6:00 PM', hourKey: '18' },
    ];

    const slots = [...baseSlots];

    filteredEvents.forEach((event) => {
      const timeRange = event.timeRange || '';
      const startStr = timeRange.split(' - ')[0]?.trim();
      if (!startStr) return;

      const matchesExisting = slots.some(s => s.label.toLowerCase() === startStr.toLowerCase());
      if (!matchesExisting) {
        const timePart = startStr.split(' ')[0] || '';
        const ampm = startStr.split(' ')[1] || 'AM';
        const parts = timePart.split(':');
        let h = parseInt(parts[0]) || 0;
        const m = parseInt(parts[1]) || 0;
        if (ampm.toUpperCase() === 'PM' && h < 12) h += 12;
        if (ampm.toUpperCase() === 'AM' && h === 12) h = 0;
        const hourDecimal = h + (m / 60);

        slots.push({
          label: startStr,
          hourKey: String(hourDecimal),
        });
      }
    });

    slots.sort((a, b) => parseFloat(a.hourKey) - parseFloat(b.hourKey));
    return slots;
  }, [filteredEvents]);

  // Card Color Theme builder
  const getCardStyles = (color: string) => {
    switch (color) {
      case 'green':
        return { bg: 'rgba(52, 211, 153, 0.08)', border: '#34D399', text: '#34D399' };
      case 'purple':
        return { bg: 'rgba(13, 148, 136, 0.08)', border: '#0D9488', text: '#2DD4BF' };
      case 'yellow':
        return { bg: 'rgba(245, 158, 11, 0.08)', border: '#F59E0B', text: '#F59E0B' };
      case 'orange':
        return { bg: 'rgba(255, 138, 101, 0.08)', border: '#FF8A65', text: '#FF8A65' };
      case 'blue':
        return { bg: 'rgba(59, 130, 246, 0.08)', border: '#3B82F6', text: '#93C5FD' };
      case 'red':
        return { bg: 'rgba(239, 68, 68, 0.08)', border: '#EF4444', text: '#EF4444' };
      default:
        return { bg: 'rgba(59, 130, 246, 0.08)', border: '#3B82F6', text: '#93C5FD' };
    }
  };

  return (
    <View style={styles.container}>
      {/* Background Glow */}
      <View style={styles.glowCircle1} />
      <View style={styles.glowCircle2} />
      <View style={styles.glowCircle3} />

      {calendarExpanded ? (
        <View style={{ flex: 1 }}>
          <View style={[styles.headerSection, { backgroundColor: headerNavy, paddingTop: insets.top > 0 ? insets.top + 32 : 80 }]}>
            <View style={styles.headerTop}>
              <ThemedText style={styles.headerTitle}>{getMonthYearLabel(selectedDate)}</ThemedText>
              <TouchableOpacity style={styles.menuIcon} onPress={() => setCalendarExpanded(false)}>
                <IconSymbol size={22} name="minus.circle.fill" color="#fff" />
              </TouchableOpacity>
            </View>

            <View style={styles.weekdayRow}>
              {weekdayLabels.map((label, idx) => (
                <ThemedText key={idx} style={styles.weekdayText}>{label}</ThemedText>
              ))}
            </View>

            <View style={styles.gridContainer}>
              {calendarDaysMonth.map((day, idx) => {
                const formattedDay = day ? day.padStart(2, '0') : null;
                const dateObj = new Date(selectedDate + 'T00:00:00');
                const yyyy = dateObj.getFullYear();
                const mm = String(dateObj.getMonth() + 1).padStart(2, '0');
                const fullDate = formattedDay ? `${yyyy}-${mm}-${formattedDay}` : '';
                const isSelected = fullDate === selectedDate;
                const isToday = fullDate === todayStr;
                const hasEvents = dateHasEvents(day);

                return (
                  <TouchableOpacity
                    key={idx}
                    disabled={!day}
                    onPress={() => handleDatePress(day)}
                    style={[
                      styles.gridCell, 
                      isSelected && [styles.selectedCell, { backgroundColor: primaryColor }],
                      (!isSelected && isToday) && { borderWidth: 1.5, borderColor: primaryColor, borderRadius: 20 }
                    ]}>
                    {day ? (
                      <>
                        <ThemedText style={[
                          styles.dayText, 
                          isSelected && styles.selectedDayText,
                          (!isSelected && isToday) && { color: primaryColor, fontWeight: '800' }
                        ]}>{day}</ThemedText>
                      </>
                    ) : null}
                  </TouchableOpacity>
                );
              })}
            </View>
          </View>

          <View style={styles.eventsPanel}>
            <View style={styles.panelHeader}>
              <View style={[styles.dropdownButton, { backgroundColor: cardBg }]}>
                <ThemedText style={styles.dropdownText}>All Events</ThemedText>
                <IconSymbol size={16} name="chevron.right" color="#8E8E93" />
              </View>
            </View>

            <ScrollView contentContainerStyle={styles.eventsScroll} showsVerticalScrollIndicator={false}>
              {filteredEvents.length > 0 ? (
                filteredEvents.map((event) => {
                  const theme = getCardStyles(event.color);
                  return (
                    <View key={event.id} style={[styles.eventCard, { backgroundColor: theme.bg, borderLeftColor: theme.border }]}>
                      <View style={styles.cardHeaderBox}>
                        <ThemedText style={styles.timeBadge}>{event.timeRange.split(' - ')[0]}</ThemedText>
                        <View style={styles.connector} />
                      </View>

                      <View style={styles.cardContent}>
                        <View style={{ flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap', gap: 6, marginBottom: 4 }}>
                          <View style={[styles.badgeContainer, { backgroundColor: theme.border + '15', marginBottom: 0 }]}>
                            <ThemedText style={[styles.cardTitle, { color: theme.text }]}>{event.title}</ThemedText>
                          </View>
                          {event.isAiExtracted && (
                            <View style={[styles.aiBadge, { backgroundColor: primaryColor + '15' }]}>
                              <IconSymbol size={10} name="eyes" color={primaryColor} style={{ marginRight: 3 }} />
                              <ThemedText style={[styles.aiBadgeText, { color: primaryColor }]}>AI Extracted</ThemedText>
                            </View>
                          )}
                        </View>
                        <ThemedText style={[styles.cardDuration, { color: theme.text + '90' }]}>
                          {event.timeRange} {event.duration && `• ${event.duration}`}
                        </ThemedText>
                        {event.location?.name && (
                          <View style={{ flexDirection: 'row', alignItems: 'center', marginTop: 4 }}>
                            <IconSymbol size={12} name="location.fill" color={theme.border} style={{ marginRight: 4 }} />
                            <ThemedText style={{ fontSize: 12, color: theme.text + '80', fontWeight: '500' }}>
                              {event.location.name}
                            </ThemedText>
                          </View>
                        )}
                        {event.weather ? (
                          <ThemedText style={{ fontSize: 12, color: theme.text + '80', marginTop: 4, fontWeight: '500' }}>
                            {getWeatherEmoji(event.weather.condition)} {event.weather.condition} • {Math.round(event.weather.temperature_c)}°C / {Math.round(event.weather.temperature_f)}°F
                          </ThemedText>
                        ) : (
                          <ThemedText style={{ fontSize: 11, color: '#8E8E9380', marginTop: 4, fontWeight: '500', fontStyle: 'italic' }}>
                            🌡️ Weather Unavailable
                          </ThemedText>
                        )}
                      </View>
                    </View>
                  );
                })
              ) : (
                <View style={styles.emptyContainer}>
                  <IconSymbol size={44} name="clock.fill" color="#8E8E9350" />
                  <ThemedText style={styles.emptyText}>No events logged for this date</ThemedText>
                </View>
              )}
            </ScrollView>
          </View>
        </View>
      ) : (
        <View style={{ flex: 1 }}>
          <View style={[styles.headerSection, { backgroundColor: headerNavy, paddingTop: insets.top > 0 ? insets.top + 32 : 80 }]}>
            <View style={styles.headerTop}>
              <ThemedText style={styles.headerTitle}>{getTimelineHeaderLabel(selectedDate)}</ThemedText>
              <TouchableOpacity style={styles.menuIcon} onPress={() => setCalendarExpanded(true)}>
                <IconSymbol size={22} name="plus.circle.fill" color="#fff" />
              </TouchableOpacity>
            </View>

            <View style={styles.calendarStrip}>
              {calendarDaysWeek.map((item, idx) => {
                const isSelected = item.dateStr === selectedDate;
                const isToday = item.dateStr === todayStr;
                return (
                  <TouchableOpacity
                    key={idx}
                    style={[
                      styles.dayCard, 
                      isSelected && [styles.selectedDayCard, { backgroundColor: primaryColor }],
                      (!isSelected && isToday) && { borderWidth: 1.5, borderColor: primaryColor }
                    ]}
                    onPress={() => setSelectedDate(item.dateStr)}>
                    <ThemedText style={[
                      styles.dayName, 
                      isSelected && styles.selectedDayText,
                      (!isSelected && isToday) && { color: primaryColor, fontWeight: '700' }
                    ]}>{item.day}</ThemedText>
                    <ThemedText style={[
                      styles.dayNum, 
                      isSelected && styles.selectedDayText,
                      (!isSelected && isToday) && { color: primaryColor, fontWeight: '800' }
                    ]}>{item.dateNum}</ThemedText>
                  </TouchableOpacity>
                );
              })}
            </View>
          </View>

          <ScrollView contentContainerStyle={styles.timelineScroll} showsVerticalScrollIndicator={false}>
            <View style={styles.todayHeaderBox}>
              <ThemedText style={styles.todayTitle}>{getDayLabel(selectedDate)}</ThemedText>
              <ThemedText style={styles.todayDateSub}>{getFullDateLabel(selectedDate)}</ThemedText>
            </View>

            {selectedDate === todayStr && pendingSuggestion && (
              <View style={[styles.suggestionBanner, { backgroundColor: 'rgba(52, 211, 153, 0.08)', borderColor: 'rgba(52, 211, 153, 0.25)' }]}>
                <View style={styles.suggestionLeft}>
                  <IconSymbol size={22} name="gym" color={accentGreen} style={{ marginRight: 8 }} />
                  <View style={{ flex: 1 }}>
                    <ThemedText style={[styles.suggestionTitle, { color: '#34D399' }]}>{pendingSuggestion.title}</ThemedText>
                    <ThemedText style={[styles.suggestionDesc, { color: 'rgba(52, 211, 153, 0.7)' }]}>{pendingSuggestion.timeRange} • {pendingSuggestion.duration}</ThemedText>
                  </View>
                </View>
                <TouchableOpacity onPress={() => approveSuggestion(pendingSuggestion.id)} style={[styles.addSuggestionBtn, { backgroundColor: accentGreen }]}>
                  <ThemedText style={[styles.addSuggestionText, { color: COLORS.bg }]}>+ Add</ThemedText>
                </TouchableOpacity>
              </View>
            )}

            <ThemedText style={styles.timelineSectionTitle}>Upcoming Schedule</ThemedText>

            {dynamicTimeSlots.map((slot, index) => {
              const matchedEvents = filteredEvents.filter((item) => {
                const startStr = item.timeRange.split(' - ')[0]?.trim() || '';
                
                // If there's an exact match on label, use it!
                if (slot.label === startStr) return true;

                // Fallback for bucket matching of base slots:
                // e.g. if the slot is "7:00 AM" and the event start is "7:30 AM", AND there is no specific "7:30 AM" slot in the timeline.
                const isBaseSlot = ['7:00 AM', '9:00 AM', '11:30 AM', '12:00 PM', '1:00 PM', '2:00 PM', '4:00 PM', '5:00 PM', '6:00 PM'].includes(slot.label);
                if (isBaseSlot) {
                  // Check if there is an exact slot in dynamicTimeSlots for this event's startStr.
                  // If there is, let that exact slot handle it (return false here).
                  const hasExactSlot = dynamicTimeSlots.some(s => s.label === startStr);
                  if (hasExactSlot) return false;

                  // Otherwise, bucket match based on hour!
                  if (slot.label === '7:00 AM') return startStr.startsWith('7:') && startStr.includes('AM');
                  if (slot.label === '9:00 AM') return startStr.startsWith('9:') && startStr.includes('AM');
                  if (slot.label === '11:30 AM') return startStr.startsWith('11:30') && startStr.includes('AM');
                  if (slot.label === '12:00 PM') return startStr.startsWith('12:') && startStr.includes('PM');
                  if (slot.label === '1:00 PM') return startStr.startsWith('1:') && startStr.includes('PM');
                  if (slot.label === '2:00 PM') return startStr.startsWith('2:') && startStr.includes('PM');
                  if (slot.label === '4:00 PM') return startStr.startsWith('4:') && startStr.includes('PM');
                  if (slot.label === '5:00 PM') return startStr.startsWith('5:') && startStr.includes('PM');
                  if (slot.label === '6:00 PM') return startStr.startsWith('6:') && startStr.includes('PM');
                }

                return false;
              });

              return (
                <View key={index} style={styles.timelineRow}>
                  <View style={styles.timeLabelContainer}>
                    <ThemedText style={styles.timeLabel}>{slot.label}</ThemedText>
                  </View>
                  <View style={styles.nodeContainer}>
                    <View style={[styles.nodeDot, { borderColor: primaryColor }]} />
                    {index < dynamicTimeSlots.length - 1 && <View style={[styles.nodeLine, { backgroundColor: primaryColor + '20' }]} />}
                  </View>
                  <View style={styles.cardsContainer}>
                    {matchedEvents.length > 0 ? (
                      matchedEvents.map((event) => {
                        const theme = getCardStyles(event.color);
                        return (
                          <View key={event.id} style={[styles.eventCardTimeline, { backgroundColor: theme.bg, borderLeftColor: theme.border }]}>
                            <View style={styles.cardContent}>
                              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 4 }}>
                                <ThemedText style={[styles.cardTitleTimeline, { color: theme.text }]} numberOfLines={1}>
                                  {event.title}
                                </ThemedText>
                                {event.isAiExtracted && (
                                  <View style={[styles.aiBadge, { backgroundColor: primaryColor + '12' }]}>
                                    <ThemedText style={{ fontSize: 9, fontWeight: '700', color: primaryColor }}>AI</ThemedText>
                                  </View>
                                )}
                              </View>
                              <ThemedText style={[styles.cardTimeTimeline, { color: theme.text + '90', marginTop: 0 }]}>
                                {event.timeRange} {event.duration && `• ${event.duration}`}
                              </ThemedText>
                              {event.location?.name && (
                                <View style={{ flexDirection: 'row', alignItems: 'center', marginTop: 4 }}>
                                  <IconSymbol size={12} name="location.fill" color={theme.border} style={{ marginRight: 4 }} />
                                  <ThemedText style={{ fontSize: 12, color: theme.text + '80', fontWeight: '500' }}>
                                    {event.location.name}
                                  </ThemedText>
                                </View>
                              )}
                              {event.weather ? (
                                <ThemedText style={{ fontSize: 12, color: theme.text + '80', marginTop: 4, fontWeight: '500' }}>
                                  {getWeatherEmoji(event.weather.condition)} {event.weather.condition} • {Math.round(event.weather.temperature_c)}°C / {Math.round(event.weather.temperature_f)}°F
                                </ThemedText>
                              ) : (
                                <ThemedText style={{ fontSize: 11, color: '#8E8E9380', marginTop: 4, fontWeight: '500', fontStyle: 'italic' }}>
                                  🌡️ Weather Unavailable
                                </ThemedText>
                              )}
                            </View>
                            <IconSymbol size={20} name={event.icon} color={theme.border} />
                          </View>
                        );
                      })
                    ) : (
                      <View style={styles.emptySlotCard} />
                    )}
                  </View>
                </View>
              );
            })}
          </ScrollView>
        </View>
      )}
    </View>
  );
}

const getStyles = (COLORS: any) => StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.bg },

  glowCircle1: { position: 'absolute', top: 40, left: -100, width: 360, height: 360, borderRadius: 180, backgroundColor: 'rgba(13, 148, 136, 0.03)', zIndex: 0 },
  glowCircle2: { position: 'absolute', bottom: 100, right: -120, width: 380, height: 380, borderRadius: 190, backgroundColor: 'rgba(59, 130, 246, 0.03)', zIndex: 0 },
  glowCircle3: { position: 'absolute', top: '40%', right: -80, width: 300, height: 300, borderRadius: 150, backgroundColor: 'rgba(6, 182, 212, 0.02)', zIndex: 0 },

  headerSection: {
    paddingHorizontal: SPACING.xl,
    paddingBottom: SPACING.lg,
    borderBottomLeftRadius: 24,
    borderBottomRightRadius: 24,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.surfaceBorder,
    backgroundColor: COLORS.bg,
  },
  headerTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: SPACING.lg, zIndex: 1 },
  headerTitle: { color: COLORS.text, ...TYPOGRAPHY.title, paddingTop: 4 },
  menuIcon: { padding: 6 },
  weekdayRow: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: SPACING.sm },
  weekdayText: { width: 40, textAlign: 'center', fontSize: 12, color: COLORS.textMuted, fontWeight: '700' },
  gridContainer: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between' },
  gridCell: { width: 40, height: 40, justifyContent: 'center', alignItems: 'center', marginVertical: 4, borderRadius: 20 },
  selectedCell: { shadowColor: '#000', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.15, shadowRadius: 6, elevation: 3 },
  dayText: { fontSize: 14, color: COLORS.text, fontWeight: '600' },
  selectedDayText: { color: '#fff', fontWeight: '700' },
  eventDot: { width: 4, height: 4, borderRadius: 2, marginTop: 2 },
  eventsPanel: { flex: 1, paddingTop: SPACING.lg, paddingHorizontal: SPACING.xl },
  panelHeader: { flexDirection: 'row', justifyContent: 'flex-start', marginBottom: SPACING.md },
  dropdownButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: SPACING.sm,
    paddingHorizontal: SPACING.lg,
    borderRadius: 12,
    gap: SPACING.sm,
    backgroundColor: COLORS.surfaceCard,
    borderWidth: 1,
    borderColor: COLORS.surfaceBorder,
  },
  dropdownText: { fontSize: 13.5, fontWeight: '700', color: COLORS.text, opacity: 0.8 },
  eventsScroll: { paddingBottom: 130, gap: SPACING.md },
  eventCard: {
    flexDirection: 'row',
    borderRadius: 14,
    paddingVertical: SPACING.md,
    paddingHorizontal: SPACING.lg,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: COLORS.surfaceBorder,
    backgroundColor: COLORS.surfaceCard,
  },
  cardHeaderBox: { width: 75, alignItems: 'flex-start' },
  timeBadge: { fontSize: 12.5, fontWeight: '700', color: COLORS.textMuted },
  connector: { width: 1.5, height: 10, backgroundColor: 'rgba(255, 255, 255, 0.05)', marginLeft: 14, marginTop: 4 },
  cardContent: { flex: 1, paddingLeft: 10 },
  cardTitle: { fontSize: 14, fontWeight: '700', color: COLORS.text },
  cardDuration: { fontSize: 12, opacity: 0.6, marginTop: 2, color: COLORS.textMuted },
  emptyContainer: { alignItems: 'center', paddingTop: 60, gap: 10 },
  emptyText: { color: COLORS.textMuted, fontSize: 14, fontWeight: '600' },
  badgeContainer: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 8, alignSelf: 'flex-start', marginBottom: 4 },
  calendarStrip: { flexDirection: 'row', justifyContent: 'space-between', marginTop: 6 },
  dayCard: {
    width: 42,
    height: 60,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'rgba(255,255,255,0.02)',
    borderWidth: 1,
    borderColor: COLORS.surfaceBorder,
  },
  selectedDayCard: { shadowColor: '#000', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.15, shadowRadius: 6, elevation: 3 },
  dayName: { fontSize: 11, color: COLORS.textMuted, fontWeight: '600' },
  dayNum: { fontSize: 15, color: COLORS.text, fontWeight: '700', marginTop: 2 },
  timelineScroll: { paddingHorizontal: SPACING.xl, paddingTop: SPACING.lg, paddingBottom: 130 },
  todayHeaderBox: { marginBottom: SPACING.md, zIndex: 1 },
  todayTitle: { fontSize: 20, fontWeight: '800', color: COLORS.text },
  todayDateSub: { fontSize: 13, opacity: 0.5, marginTop: 2, color: COLORS.textMuted },
  suggestionBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: SPACING.lg,
    borderRadius: 14,
    marginBottom: SPACING.lg,
    borderWidth: 1,
    borderColor: 'rgba(52, 211, 153, 0.18)',
    backgroundColor: 'rgba(52, 211, 153, 0.05)',
  },
  suggestionLeft: { flexDirection: 'row', alignItems: 'center', flex: 1 },
  suggestionTitle: { fontSize: 14, fontWeight: '700' },
  suggestionDesc: { fontSize: 11.5, marginTop: 2 },
  addSuggestionBtn: { paddingHorizontal: 14, paddingVertical: 6, borderRadius: 8 },
  addSuggestionText: { fontSize: 12.5, fontWeight: '700' },
  timelineSectionTitle: { fontSize: 11.5, fontWeight: '800', opacity: 0.5, marginBottom: SPACING.md, textTransform: 'uppercase', letterSpacing: 0.8, color: COLORS.textMuted, zIndex: 1 },
  timelineRow: { flexDirection: 'row', minHeight: 80 },
  timeLabelContainer: { width: 70, alignItems: 'flex-end', paddingRight: 10, paddingTop: 2 },
  timeLabel: { fontSize: 12, fontWeight: '700', color: COLORS.textMuted },
  nodeContainer: { width: 20, alignItems: 'center', paddingTop: 6 },
  nodeDot: { width: 8, height: 8, borderRadius: 4, borderWidth: 1.5, borderColor: COLORS.primary, backgroundColor: COLORS.bg, zIndex: 1 },
  nodeLine: { width: 1.5, position: 'absolute', top: 14, bottom: -14 },
  cardsContainer: { flex: 1, paddingLeft: 10, paddingBottom: SPACING.md, gap: SPACING.sm },
  eventCardTimeline: {
    flexDirection: 'row',
    borderRadius: 14,
    paddingVertical: SPACING.md,
    paddingHorizontal: SPACING.lg,
    alignItems: 'center',
    justifyContent: 'space-between',
    borderWidth: 1,
    borderColor: COLORS.surfaceBorder,
    backgroundColor: COLORS.surfaceCard,
  },
  cardTitleTimeline: { fontSize: 14, fontWeight: '700' },
  cardTimeTimeline: { fontSize: 12, marginTop: 2, fontWeight: '500' },
  emptySlotCard: { height: 40 },
  aiBadge: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 5, paddingVertical: 1.5, borderRadius: 4 },
  aiBadgeText: { fontSize: 8.5, fontWeight: '800' },
});
