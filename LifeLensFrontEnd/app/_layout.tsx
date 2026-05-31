import Constants from 'expo-constants';
if (Constants.executionEnvironment === 'storeClient') {
  (Constants as any).appOwnership = 'expo';
}

import React, { useState, useEffect, useCallback } from 'react';
import { DarkTheme, DefaultTheme, ThemeProvider } from '@react-navigation/native';
import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import * as SplashScreen from 'expo-splash-screen';
import 'react-native-reanimated';
import '@/services/background-location';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { View, StyleSheet } from 'react-native';
import * as Notifications from 'expo-notifications';
import * as SecureStore from 'expo-secure-store';

import { useColorScheme } from '@/hooks/use-color-scheme';
import { AuthProvider } from '@/context/auth';
import { ScheduleProvider } from '@/context/schedule';
import { CalendarUIProvider } from '@/context/calendar-ui';
import AnimatedSplash from '@/components/AnimatedSplash';

// Hold the native splash until we're ready to show our animated one
SplashScreen.preventAutoHideAsync().catch(() => {});

export const unstable_settings = {
  anchor: '(tabs)',
};

export default function RootLayout() {
  const colorScheme = useColorScheme();
  const [nativeSplashHidden, setNativeSplashHidden] = useState(false);
  const [splashAnimDone, setSplashAnimDone] = useState(false);

  // Listen for native mobile push notifications actions
  useEffect(() => {
    // Pre-register interactive categories on iOS
    import('@/services/notifications').then(({ registerNotificationCategories }) => {
      registerNotificationCategories().catch(err => console.warn('Failed to pre-register categories:', err));
    });

    const subscription = Notifications.addNotificationResponseReceivedListener(async (response) => {
      const actionIdentifier = response.actionIdentifier;
      const notificationData = response.notification.request.content.data;
      
      console.log('🔔 [RootLayout] Notification response received:', actionIdentifier, notificationData);
      
      try {
        const storedUser = await SecureStore.getItemAsync('lifelens_user');
        if (storedUser) {
          const user = JSON.parse(storedUser);
          const pendingActionKey = `${user.id}_pending_notification_action`;
          
          if (actionIdentifier === 'add-timeline') {
            await SecureStore.setItemAsync(pendingActionKey, JSON.stringify({
              action: 'add-timeline',
              data: notificationData,
              timestamp: Date.now(),
            }));
            console.log('🔔 [RootLayout] Saved pending add-timeline action for user:', user.id);
          } else if (actionIdentifier === 'add-event' || actionIdentifier === Notifications.DEFAULT_ACTION_IDENTIFIER) {
            // Clicking the 'Add to Event' button or the general notification body will trigger the Quick Add sheet prefilled
            await SecureStore.setItemAsync(pendingActionKey, JSON.stringify({
              action: 'add-event',
              data: notificationData,
              timestamp: Date.now(),
            }));
            console.log('🔔 [RootLayout] Saved pending add-event action for user:', user.id);
          }
        }
      } catch (err) {
        console.warn('Failed to handle notification tap in RootLayout:', err);
      }
    });

    return () => subscription.remove();
  }, []);

  // Hide the native splash as soon as the component mounts (JS is loaded)
  // Then our AnimatedSplash takes over visually
  useEffect(() => {
    const hide = async () => {
      try {
        await SplashScreen.hideAsync();
      } catch (e) {
        // ignore — splash may already be hidden
      }
      setNativeSplashHidden(true);
    };
    // Small delay to ensure layout has rendered behind the splash
    const timer = setTimeout(hide, 150);
    return () => clearTimeout(timer);
  }, []);

  const handleSplashFinish = useCallback(() => {
    setSplashAnimDone(true);
  }, []);

  return (
    <SafeAreaProvider>
      <AuthProvider>
        <ScheduleProvider>
          <CalendarUIProvider>
            <ThemeProvider value={colorScheme === 'dark' ? DarkTheme : DefaultTheme}>
              <View style={styles.root}>
                <Stack>
                  <Stack.Screen name="(auth)" options={{ headerShown: false }} />
                  <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
                  <Stack.Screen name="modal" options={{ presentation: 'modal', headerShown: false }} />
                </Stack>
                <StatusBar style="auto" />

                {/* Cinematic animated splash overlay — covers everything until done */}
                {nativeSplashHidden && !splashAnimDone && (
                  <AnimatedSplash onFinish={handleSplashFinish} />
                )}
              </View>
            </ThemeProvider>
          </CalendarUIProvider>
        </ScheduleProvider>
      </AuthProvider>
    </SafeAreaProvider>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
  },
});
