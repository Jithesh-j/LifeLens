import React, { createContext, useContext, useState } from 'react';

// Helper to get today's date in local YYYY-MM-DD format
const getTodayDateStr = () => {
  const today = new Date();
  const yyyy = today.getFullYear();
  const mm = String(today.getMonth() + 1).padStart(2, '0');
  const dd = String(today.getDate()).padStart(2, '0');
  return `${yyyy}-${mm}-${dd}`;
};

interface CalendarUIContextType {
  calendarExpanded: boolean;
  setCalendarExpanded: (expanded: boolean) => void;
  selectedDate: string;
  setSelectedDate: (date: string) => void;
}

const CalendarUIContext = createContext<CalendarUIContextType | null>(null);

export function CalendarUIProvider({ children }: { children: React.ReactNode }) {
  const [calendarExpanded, setCalendarExpanded] = useState(true);
  const [selectedDate, setSelectedDate] = useState(() => getTodayDateStr());

  return (
    <CalendarUIContext.Provider value={{ calendarExpanded, setCalendarExpanded, selectedDate, setSelectedDate }}>
      {children}
    </CalendarUIContext.Provider>
  );
}

export function useCalendarUI() {
  const context = useContext(CalendarUIContext);
  if (!context) {
    throw new Error('useCalendarUI must be used within a CalendarUIProvider');
  }
  return context;
}

