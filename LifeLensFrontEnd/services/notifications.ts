import { Platform } from 'react-native';
import * as Notifications from 'expo-notifications';
import * as SecureStore from 'expo-secure-store';
import { api } from './api';

// Configure how notifications are displayed when the app is in the foreground
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldBadge: false,
    shouldShowBanner: true,
    shouldShowList: true,
    shouldSetBadge: false,
  } as any),
});

/**
 * Register notification categories for iOS/Android interactive actions.
 * Creates 'activity-detection' category with three options:
 * - 'add-timeline': Logs directly and closes the alert
 * - 'add-event': Opens quick add overlay modal
 * - 'dismiss': Dismisses the alert
 */
export async function registerNotificationCategories() {
  if (Platform.OS === 'web') return;

  await Notifications.setNotificationCategoryAsync('activity-detection', [
    {
      identifier: 'add-timeline',
      buttonTitle: 'Add to Timeline',
      options: {
        opensAppToForeground: true, // Wake up the app to handle timeline log
      },
    },
    {
      identifier: 'add-event',
      buttonTitle: 'Add to Event',
      options: {
        opensAppToForeground: true, // Wake up the app to display sheet prefilled
      },
    },
    {
      identifier: 'dismiss',
      buttonTitle: 'Dismiss',
      options: {
        opensAppToForeground: false,
        isDestructive: true,
      },
    },
  ]);
  console.log('🔔 [Notifications] Registered "activity-detection" interactive categories successfully.');
}

/**
 * Request system permissions for push notifications
 */
export async function requestNotificationPermissions(): Promise<boolean> {
  if (Platform.OS === 'web') return false;

  try {
    const { status: existingStatus } = await Notifications.getPermissionsAsync() as any;
    let finalStatus = existingStatus;

    if (existingStatus !== 'granted') {
      const { status } = await Notifications.requestPermissionsAsync() as any;
      finalStatus = status;
    }

    const granted = finalStatus === 'granted';
    console.log(`🔔 [Notifications] Native push permission status: ${finalStatus} (${granted ? '🟢 Granted' : '🔴 Denied'})`);
    return granted;
  } catch (err) {
    console.warn('Failed to request native notification permissions:', err);
    return false;
  }
}

/**
 * Queries the device push token and registers/persists it.
 * Falls back to secure simulated tokens in developer simulators or standard failures.
 */
export async function registerForPushNotificationsAsync(userId: string): Promise<string> {
  if (Platform.OS === 'web') return '';

  const hasPerm = await requestNotificationPermissions();
  if (!hasPerm) {
    console.log('🔔 [Notifications] Permission not granted. Skipping push token registration.');
    return '';
  }

  let token = '';
  try {
    // Attempt standard device token query
    const deviceTokenData = await Notifications.getDevicePushTokenAsync();
    token = deviceTokenData.data;
    console.log('📡 [Notifications] Acquired device token:', token);
  } catch (err) {
    // Simulator fallback
    token = `apns-simulated-${userId.substring(0, 8)}-${Date.now()}`;
    console.log('📡 [Notifications] Running in simulator or non-provisioned profile. Generated mock token:', token);
  }

  if (token) {
    try {
      // 1. Cache locally
      await SecureStore.setItemAsync(`${userId}_device_push_token`, token);
      
      // 2. Synchronize to backend settings
      await api.updateUserSettings({
        device_token: token,
      } as any);
      console.log('📡 [Notifications] Token successfully registered to backend.');
    } catch (saveErr) {
      console.warn('Failed to save device token in backend or SecureStore:', saveErr);
    }
  }

  return token;
}

interface ActivityNotificationPayload {
  placeName: string;
  durationMinutes: number;
  inferredActivity: string;
  category: string;
  icon: string;
  color: string;
  timeOfDay: string;
  date: string;
  latitude?: number;
  longitude?: number;
  title: string;
  message: string;
}

/**
 * Immediately triggers a native iOS / Android alert banner on the lockscreen or background.
 */
export async function scheduleActivityNotification(payload: ActivityNotificationPayload) {
  if (Platform.OS === 'web') return;

  const {
    placeName,
    durationMinutes,
    inferredActivity,
    category,
    icon,
    color,
    timeOfDay,
    date,
    latitude = 34.05,
    longitude = -118.24,
    title,
    message,
  } = payload;

  console.log('🔔 [Notifications] Scheduling native geofence push stay alert for:', placeName);

  // Register interactive actions prior to scheduling
  await registerNotificationCategories();

  // Fire local native notification with category
  await Notifications.scheduleNotificationAsync({
    content: {
      title: title || 'Activity Detected',
      body: message || `You spent ${durationMinutes} minutes at ${placeName}. Add a ${inferredActivity} activity?`,
      data: {
        placeName,
        durationMinutes,
        inferredActivity,
        category,
        icon,
        color,
        timeOfDay,
        date,
        latitude,
        longitude,
      },
      categoryIdentifier: 'activity-detection',
      sound: true,
    },
    trigger: null, // null triggers immediately
  });
}
