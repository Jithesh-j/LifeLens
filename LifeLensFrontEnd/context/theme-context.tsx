import React, { createContext, useState, useEffect, useContext } from 'react';
import { useColorScheme as useRNColorScheme } from 'react-native';
import * as SecureStore from 'expo-secure-store';

export type ThemePreference = 'system' | 'light' | 'dark';

export interface ThemeContextType {
  themePreference: ThemePreference;
  setThemePreference: (pref: ThemePreference) => Promise<void>;
  colorScheme: 'light' | 'dark';
}

export const ThemeContext = createContext<ThemeContextType | null>(null);

export function useTheme() {
  const context = useContext(ThemeContext);
  if (!context) {
    throw new Error('useTheme must be used within a ThemeProvider');
  }
  return context;
}

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const systemScheme = useRNColorScheme();
  const [themePreference, setThemePreferenceState] = useState<ThemePreference>('system');

  useEffect(() => {
    SecureStore.getItemAsync('lifelens_theme_preference').then((pref) => {
      if (pref === 'light' || pref === 'dark' || pref === 'system') {
        setThemePreferenceState(pref as ThemePreference);
      }
    });
  }, []);

  const setThemePreference = async (pref: ThemePreference) => {
    setThemePreferenceState(pref);
    await SecureStore.setItemAsync('lifelens_theme_preference', pref);
  };

  const colorScheme = themePreference === 'system' 
    ? (systemScheme || 'dark') 
    : themePreference;

  return (
    <ThemeContext.Provider value={{ themePreference, setThemePreference, colorScheme }}>
      {children}
    </ThemeContext.Provider>
  );
}
