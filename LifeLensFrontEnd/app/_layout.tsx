import Constants from 'expo-constants';
if (Constants.executionEnvironment === 'storeClient') {
  (Constants as any).appOwnership = 'expo';
}

import { DarkTheme, DefaultTheme, ThemeProvider } from '@react-navigation/native';
import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import 'react-native-reanimated';

import { useColorScheme } from '@/hooks/use-color-scheme';
import { AuthProvider } from '@/context/auth';
import { ScheduleProvider } from '@/context/schedule';
import { CalendarUIProvider } from '@/context/calendar-ui';
import { GoogleCalendarProvider } from '@/context/google-calendar';

export const unstable_settings = {
  anchor: '(tabs)',
};

export default function RootLayout() {
  const colorScheme = useColorScheme();

  return (
    <AuthProvider>
      <ScheduleProvider>
        <GoogleCalendarProvider>
          <CalendarUIProvider>
            <ThemeProvider value={colorScheme === 'dark' ? DarkTheme : DefaultTheme}>
              <Stack>
                <Stack.Screen name="(auth)" options={{ headerShown: false }} />
                <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
                <Stack.Screen name="modal" options={{ presentation: 'modal', title: 'Modal' }} />
              </Stack>
              <StatusBar style="auto" />
            </ThemeProvider>
          </CalendarUIProvider>
        </GoogleCalendarProvider>
      </ScheduleProvider>
    </AuthProvider>
  );
}

