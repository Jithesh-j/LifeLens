import React, { useState } from 'react';
import { StyleSheet, View, ScrollView, TouchableOpacity } from 'react-native';
import { useRouter } from 'expo-router';
import { useSchedule, getTodayDateStr } from '@/context/schedule';
import { useCalendarUI } from '@/context/calendar-ui';
import { ThemedText } from '@/components/themed-text';
import { useThemeColor } from '@/hooks/use-theme-color';
import { IconSymbol } from '@/components/ui/icon-symbol';

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

  // Themes & Styling Mappings
  const primaryColor = '#7C4DFF';
  const headerNavy = '#0F101D';
  const accentGreen = '#4CAF50';
  const cardBg = useThemeColor({ light: '#F2F2F7', dark: '#1C1C1E' }, 'background');

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

  // Time Slots for Timeline Display in Collapsed Mode (sorted chronologically)
  const timeSlots = [
    { label: '7:00 AM', hourKey: '7' },
    { label: '9:00 AM', hourKey: '9' },
    { label: '11:30 AM', hourKey: '11' },
    { label: '12:00 PM', hourKey: '12' },
    { label: '1:00 PM', hourKey: '13' },
    { label: '2:00 PM', hourKey: '14' },
    { label: '4:00 PM', hourKey: '16' },
    { label: '5:00 PM', hourKey: '17' },
    { label: '6:00 PM', hourKey: '18' },
  ];

  // Card Color Theme builder
  const getCardStyles = (color: string) => {
    switch (color) {
      case 'green':
        return { bg: '#E8F5E9', border: '#4CAF50', text: '#2E7D32' };
      case 'purple':
        return { bg: '#F3E5F5', border: '#7C4DFF', text: '#6A1B9A' };
      case 'yellow':
        return { bg: '#FFFDE7', border: '#FBC02D', text: '#F57F17' };
      default:
        return { bg: '#ECEFF1', border: '#78909C', text: '#37474F' };
    }
  };

  return (
    <View style={styles.container}>
      {calendarExpanded ? (
        <View style={{ flex: 1 }}>
          <View style={[styles.headerSection, { backgroundColor: headerNavy }]}>
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
                        <ThemedText style={[styles.cardDuration, { color: theme.text + '90' }]}>{event.timeRange}</ThemedText>
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
          <View style={[styles.headerSection, { backgroundColor: headerNavy }]}>
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
              <View style={[styles.suggestionBanner, { backgroundColor: '#E8F5E9' }]}>
                <View style={styles.suggestionLeft}>
                  <IconSymbol size={22} name="gym" color={accentGreen} style={{ marginRight: 8 }} />
                  <View style={{ flex: 1 }}>
                    <ThemedText style={[styles.suggestionTitle, { color: '#2E7D32' }]}>{pendingSuggestion.title}</ThemedText>
                    <ThemedText style={[styles.suggestionDesc, { color: '#2E7D3290' }]}>{pendingSuggestion.timeRange} • {pendingSuggestion.duration}</ThemedText>
                  </View>
                </View>
                <TouchableOpacity onPress={() => approveSuggestion(pendingSuggestion.id)} style={[styles.addSuggestionBtn, { backgroundColor: accentGreen }]}>
                  <ThemedText style={styles.addSuggestionText}>+ Add</ThemedText>
                </TouchableOpacity>
              </View>
            )}

            <ThemedText style={styles.timelineSectionTitle}>Upcoming Schedule</ThemedText>

            {timeSlots.map((slot, index) => {
              const matchedEvents = filteredEvents.filter((item) => {
                const startStr = item.timeRange.split(' - ')[0];
                if (slot.label === '7:00 AM') return startStr.startsWith('7:') && startStr.includes('AM');
                if (slot.label === '9:00 AM') return startStr.startsWith('9:') && startStr.includes('AM');
                if (slot.label === '11:30 AM') return startStr.startsWith('11:30') && startStr.includes('AM');
                if (slot.label === '12:00 PM') return startStr.startsWith('12:') && startStr.includes('PM');
                if (slot.label === '1:00 PM') return startStr.startsWith('1:') && startStr.includes('PM');
                if (slot.label === '2:00 PM') return startStr.startsWith('2:') && startStr.includes('PM');
                if (slot.label === '4:00 PM') return startStr.startsWith('4:') && startStr.includes('PM');
                if (slot.label === '5:00 PM') return startStr.startsWith('5:') && startStr.includes('PM');
                if (slot.label === '6:00 PM') return startStr.startsWith('6:') && startStr.includes('PM');
                return false;
              });

              return (
                <View key={index} style={styles.timelineRow}>
                  <View style={styles.timeLabelContainer}>
                    <ThemedText style={styles.timeLabel}>{slot.label}</ThemedText>
                  </View>
                  <View style={styles.nodeContainer}>
                    <View style={[styles.nodeDot, { borderColor: primaryColor }]} />
                    {index < timeSlots.length - 1 && <View style={[styles.nodeLine, { backgroundColor: primaryColor + '20' }]} />}
                  </View>
                  <View style={styles.cardsContainer}>
                    {matchedEvents.length > 0 ? (
                      matchedEvents.map((event) => {
                        const theme = getCardStyles(event.color);
                        return (
                          <View key={event.id} style={[styles.eventCardTimeline, { backgroundColor: theme.bg, borderLeftColor: theme.border }]}>
                            <View style={styles.cardContent}>
                              <View style={{ flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap', gap: 6, marginBottom: 4 }}>
                                <ThemedText style={[styles.cardTitleTimeline, { color: theme.text }]}>{event.title}</ThemedText>
                                {event.isAiExtracted && (
                                  <View style={[styles.aiBadge, { backgroundColor: primaryColor + '12' }]}>
                                    <ThemedText style={{ fontSize: 9, fontWeight: '700', color: primaryColor }}>AI</ThemedText>
                                  </View>
                                )}
                              </View>
                              <ThemedText style={[styles.cardTimeTimeline, { color: theme.text + '90', marginTop: 0 }]}>
                                {event.timeRange} {event.duration && `• ${event.duration}`}
                              </ThemedText>
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

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#fff' },
  headerSection: { paddingTop: 60, paddingHorizontal: 20, paddingBottom: 22, borderBottomLeftRadius: 32, borderBottomRightRadius: 32 },
  headerTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 },
  headerTitle: { color: '#fff', fontSize: 24, fontWeight: '800' },
  menuIcon: { padding: 6 },
  weekdayRow: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 10 },
  weekdayText: { width: 40, textAlign: 'center', fontSize: 13, color: '#B0B0C4', fontWeight: '700' },
  gridContainer: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between' },
  gridCell: { width: 40, height: 40, justifyContent: 'center', alignItems: 'center', marginVertical: 4, borderRadius: 20 },
  selectedCell: { shadowColor: '#000', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.15, shadowRadius: 6, elevation: 3 },
  dayText: { fontSize: 15, color: '#fff', fontWeight: '600' },
  selectedDayText: { color: '#fff', fontWeight: '700' },
  eventDot: { width: 4, height: 4, borderRadius: 2, marginTop: 2 },
  eventsPanel: { flex: 1, paddingTop: 16, paddingHorizontal: 20 },
  panelHeader: { flexDirection: 'row', justifyContent: 'flex-start', marginBottom: 14 },
  dropdownButton: { flexDirection: 'row', alignItems: 'center', paddingVertical: 8, paddingHorizontal: 16, borderRadius: 14, gap: 8 },
  dropdownText: { fontSize: 14, fontWeight: '700', opacity: 0.7 },
  eventsScroll: { paddingBottom: 30, gap: 12 },
  eventCard: { flexDirection: 'row', borderRadius: 18, paddingVertical: 14, paddingHorizontal: 16, borderLeftWidth: 4.5, alignItems: 'center', shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.05, shadowRadius: 4, elevation: 1 },
  cardHeaderBox: { width: 75, alignItems: 'flex-start' },
  timeBadge: { fontSize: 13, fontWeight: '700', color: '#8E8E93' },
  connector: { width: 2, height: 12, backgroundColor: '#8E8E9330', marginLeft: 14, marginTop: 4 },
  cardContent: { flex: 1, paddingLeft: 10 },
  cardTitle: { fontSize: 14, fontWeight: '700' },
  cardDuration: { fontSize: 12, opacity: 0.6, marginTop: 2 },
  emptyContainer: { alignItems: 'center', paddingTop: 60, gap: 10 },
  emptyText: { color: '#8E8E93', fontSize: 15, fontWeight: '600' },
  badgeContainer: { paddingHorizontal: 12, paddingVertical: 5, borderRadius: 12, alignSelf: 'flex-start', marginBottom: 6 },
  calendarStrip: { flexDirection: 'row', justifyContent: 'space-between', marginTop: 6 },
  dayCard: { width: 44, height: 64, borderRadius: 14, justifyContent: 'center', alignItems: 'center', backgroundColor: '#FFFFFF10' },
  selectedDayCard: { shadowColor: '#000', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.15, shadowRadius: 6, elevation: 3 },
  dayName: { fontSize: 12, color: '#B0B0C4', fontWeight: '600' },
  dayNum: { fontSize: 16, color: '#fff', fontWeight: '700', marginTop: 4 },
  timelineScroll: { paddingHorizontal: 20, paddingTop: 20, paddingBottom: 40 },
  todayHeaderBox: { marginBottom: 16 },
  todayTitle: { fontSize: 22, fontWeight: '800' },
  todayDateSub: { fontSize: 14, opacity: 0.5, marginTop: 2 },
  suggestionBanner: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', padding: 16, borderRadius: 18, marginBottom: 20, borderWidth: 1, borderColor: '#4CAF5020' },
  suggestionLeft: { flexDirection: 'row', alignItems: 'center', flex: 1 },
  suggestionTitle: { fontSize: 15, fontWeight: '700' },
  suggestionDesc: { fontSize: 12, marginTop: 2 },
  addSuggestionBtn: { paddingHorizontal: 16, paddingVertical: 8, borderRadius: 12 },
  addSuggestionText: { color: '#fff', fontSize: 13, fontWeight: '700' },
  timelineSectionTitle: { fontSize: 16, fontWeight: '700', opacity: 0.6, marginBottom: 16, textTransform: 'uppercase', letterSpacing: 0.5 },
  timelineRow: { flexDirection: 'row', minHeight: 88 },
  timeLabelContainer: { width: 70, alignItems: 'flex-end', paddingRight: 10, paddingTop: 2 },
  timeLabel: { fontSize: 13, fontWeight: '700', color: '#8E8E93' },
  nodeContainer: { width: 20, alignItems: 'center', paddingTop: 6 },
  nodeDot: { width: 10, height: 10, borderRadius: 5, borderWidth: 2, backgroundColor: '#fff', zIndex: 1 },
  nodeLine: { width: 2, position: 'absolute', top: 16, bottom: -16 },
  cardsContainer: { flex: 1, paddingLeft: 12, paddingBottom: 16, gap: 8 },
  eventCardTimeline: { flexDirection: 'row', borderRadius: 16, paddingVertical: 14, paddingHorizontal: 16, borderLeftWidth: 4.5, alignItems: 'center', justifyContent: 'space-between', shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.05, shadowRadius: 4, elevation: 1 },
  cardTitleTimeline: { fontSize: 15, fontWeight: '700' },
  cardTimeTimeline: { fontSize: 13, marginTop: 4, fontWeight: '500' },
  emptySlotCard: { height: 48 },
  aiBadge: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 6, paddingVertical: 2, borderRadius: 6 },
  aiBadgeText: { fontSize: 9, fontWeight: '800' },
});
