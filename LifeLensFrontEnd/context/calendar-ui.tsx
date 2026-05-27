import React, { createContext, useContext, useState } from 'react';

interface CalendarUIContextType {
  calendarExpanded: boolean;
  setCalendarExpanded: (expanded: boolean) => void;
}

const CalendarUIContext = createContext<CalendarUIContextType | null>(null);

export function CalendarUIProvider({ children }: { children: React.ReactNode }) {
  const [calendarExpanded, setCalendarExpanded] = useState(true);

  return (
    <CalendarUIContext.Provider value={{ calendarExpanded, setCalendarExpanded }}>
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
