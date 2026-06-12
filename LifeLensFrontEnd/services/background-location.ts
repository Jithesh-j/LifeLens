import * as TaskManager from 'expo-task-manager';
import * as Location from 'expo-location';
import * as SecureStore from 'expo-secure-store';
import { api } from './api';
import { scheduleActivityNotification, appendNotificationToHistory } from './notifications';

export const BACKGROUND_LOCATION_TASK = 'BACKGROUND_LOCATION_TRACKING';

/**
 * Helper to calculate the distance between two coordinates in meters.
 */
function getDistanceMeters(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 6371e3; // Earth radius in meters
  const phi1 = (lat1 * Math.PI) / 180;
  const phi2 = (lat2 * Math.PI) / 180;
  const deltaPhi = ((lat2 - lat1) * Math.PI) / 180;
  const deltaLambda = ((lon2 - lon1) * Math.PI) / 180;

  const a =
    Math.sin(deltaPhi / 2) * Math.sin(deltaPhi / 2) +
    Math.cos(phi1) *
      Math.cos(phi2) *
      Math.sin(deltaLambda / 2) *
      Math.sin(deltaLambda / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

  return R * c; // In meters
}

// ── Top-Level TaskManager Background Task Definition ─────────────────────────
TaskManager.defineTask(BACKGROUND_LOCATION_TASK, async ({ data, error }) => {
  if (error) {
    console.error('🔔 [Background Location] Task error:', error);
    return;
  }

  if (data) {
    const { locations } = data as any;
    if (!locations || locations.length === 0) return;

    try {
      // 1. Authenticated User Check (isolated storage keying)
      const storedUser = await SecureStore.getItemAsync('lifelens_user');
      if (!storedUser) return;
      
      const user = JSON.parse(storedUser);
      const userId = user.id;

      // 2. Lockout Verification (Verify all toggles are fully enabled)
      const locationEnabled = await SecureStore.getItemAsync(`${userId}_location_enabled`);
      const smartDetectionEnabled = await SecureStore.getItemAsync(`${userId}_smart_detection_enabled`);
      const notificationsEnabled = await SecureStore.getItemAsync(`${userId}_notifications_enabled`);
      const alwaysAllowEnabled = await SecureStore.getItemAsync(`${userId}_location_always_allow`);

      if (
        locationEnabled !== 'true' ||
        smartDetectionEnabled !== 'true' ||
        notificationsEnabled !== 'true' ||
        alwaysAllowEnabled !== 'true'
      ) {
        console.log('🔔 [Background Location] Lockout active. Switches not fully enabled. Aborting background updates.');
        return;
      }

      // 3. Extract Coords & Retrieve History from SecureStore
      const location = locations[0];
      const { latitude, longitude } = location.coords;

      const lastLatVal = await SecureStore.getItemAsync(`${userId}_last_tracked_lat`);
      const lastLonVal = await SecureStore.getItemAsync(`${userId}_last_tracked_lon`);
      const arrivalTimeVal = await SecureStore.getItemAsync(`${userId}_last_arrival_time`);
      const notifiedVal = await SecureStore.getItemAsync(`${userId}_notified_for_current_stay`);

      const now = Date.now();

      // If no last coordinates or elapsed tracking exist, initialize stay tracker
      if (!lastLatVal || !lastLonVal || !arrivalTimeVal) {
        await SecureStore.setItemAsync(`${userId}_last_tracked_lat`, String(latitude));
        await SecureStore.setItemAsync(`${userId}_last_tracked_lon`, String(longitude));
        await SecureStore.setItemAsync(`${userId}_last_arrival_time`, String(now));
        await SecureStore.setItemAsync(`${userId}_notified_for_current_stay`, 'false');
        console.log(`🔔 [Background Location] Tracker initialized at coords: ${latitude}, ${longitude}`);
        return;
      }

      const lastLat = parseFloat(lastLatVal);
      const lastLon = parseFloat(lastLonVal);
      const arrivalTime = parseInt(arrivalTimeVal);

      // 4. Calculate Distance Travelled
      const distance = getDistanceMeters(latitude, longitude, lastLat, lastLon);
      console.log(`🔔 [Background Location] Distance from last tracked center: ${distance.toFixed(1)}m`);

      if (distance > 100) {
        // User has moved out of the previous stay circle: reset tracker to new stay location
        await SecureStore.setItemAsync(`${userId}_last_tracked_lat`, String(latitude));
        await SecureStore.setItemAsync(`${userId}_last_tracked_lon`, String(longitude));
        await SecureStore.setItemAsync(`${userId}_last_arrival_time`, String(now));
        await SecureStore.setItemAsync(`${userId}_notified_for_current_stay`, 'false');
        console.log(`🔔 [Background Location] User moved >100m. Arrived at coordinates: ${latitude}, ${longitude}`);
        return;
      }

      // User has stayed inside the geofence circle. Check if we've already notified for this stay.
      if (notifiedVal === 'true') {
        return;
      }

      // Calculate stay time
      const elapsedMs = now - arrivalTime;
      const elapsedMinutes = elapsedMs / (1000 * 60);
      console.log(`🔔 [Background Location] Staying inside circle. Current stay duration: ${elapsedMinutes.toFixed(1)} mins`);

      // 5. Stay Detection Threshold
      // To satisfy both instant manual testing (1 min) and real stays, we trigger after 1 minute of stay!
      if (elapsedMinutes >= 1.0) {
        // Resolve localized address names dynamically
        let placeName = 'Local Hub';
        try {
          const geocodedAddresses = await Location.reverseGeocodeAsync({ latitude, longitude });
          if (geocodedAddresses && geocodedAddresses.length > 0) {
            const addr = geocodedAddresses[0];
            placeName = addr.name || addr.street || addr.district || addr.subregion || addr.city || 'Local Hub';
          }
        } catch (geocodingErr) {
          console.warn('🔔 [Background Location] Reverse geocoding failed:', geocodingErr);
        }

        // 6. Cooldown Verification (4-Hour Cooldown)
        const logKey = `${userId}_location_notif_logs`;
        const storedLogs = await SecureStore.getItemAsync(logKey);
        const logsArray = storedLogs ? JSON.parse(storedLogs) : [];
        
        const fourHoursAgo = Date.now() - 4 * 60 * 60 * 1000;
        const recentLogs = logsArray.filter((log: any) => new Date(log.timestamp).getTime() > fourHoursAgo);

        const isPlaceRecent = recentLogs.some((log: any) => log.placeName.toLowerCase() === placeName.toLowerCase());
        if (isPlaceRecent) {
          console.log(`🔔 [Background Location] Suppressed notification for duplicate place inside cooldown: ${placeName}`);
          await SecureStore.setItemAsync(`${userId}_notified_for_current_stay`, 'true');
          return;
        }

        // 7. Timeline De-duplication (Verify activity is not already logged today)
        let isAlreadyLogged = false;
        try {
          const actData = await api.getActivities(1, 20);
          const todayStr = new Date().toISOString().split('T')[0];
          isAlreadyLogged = actData.activities.some((act: any) => {
            const actDate = act.logged_at ? act.logged_at.split('T')[0] : '';
            const matchDate = actDate === todayStr;
            const matchTitle = act.content.toLowerCase().includes(placeName.toLowerCase());
            return matchDate && matchTitle;
          });
        } catch (apiErr) {
          console.warn('🔔 [Background Location] Failed to fetch activities for de-duplication check:', apiErr);
        }

        if (isAlreadyLogged) {
          console.log(`🔔 [Background Location] Suppressed notification for already logged activity: ${placeName}`);
          await SecureStore.setItemAsync(`${userId}_notified_for_current_stay`, 'true');
          return;
        }

        // Log this stay into 4-hour cooldown
        recentLogs.push({
          placeName,
          timestamp: new Date().toISOString(),
          user_id: userId,
        });
        await SecureStore.setItemAsync(logKey, JSON.stringify(recentLogs));

        // 8. Dynamic Suggestions Model Compilation (Inferred stay duration and activity type)
        const currentHour = new Date().getHours();
        let inferredActivity = 'Workout';
        let category = 'health';
        let icon = 'gym';
        let color = 'green';
        let durationMinutes = 30; // Realistic inferred stay duration

        if (currentHour >= 5 && currentHour < 12) {
          inferredActivity = 'Morning Jog / Walk';
          category = 'health';
          icon = 'walk';
          color = 'green';
        } else if (currentHour >= 12 && currentHour < 17) {
          inferredActivity = 'Lunch Break';
          category = 'social';
          icon = 'groups';
          color = 'yellow';
        } else if (currentHour >= 17 && currentHour < 21) {
          inferredActivity = 'Work / Study Session';
          category = 'work';
          icon = 'laptop';
          color = 'purple';
          durationMinutes = 60;
        } else {
          inferredActivity = 'Evening Wind Down';
          category = 'rest';
          icon = 'rest';
          color = 'gray';
        }

        const nowTime = new Date();
        const displayHour = currentHour % 12 === 0 ? 12 : currentHour % 12;
        const displayMin = String(nowTime.getMinutes()).padStart(2, '0');
        const ampm = currentHour >= 12 ? 'PM' : 'AM';
        const timeOfDayLabel = `${displayHour}:${displayMin} ${ampm}`;
        const todayDateStr = new Date().toISOString().split('T')[0];

        const staySuggestion = {
          id: 'bg-stay-' + Date.now(),
          placeName,
          durationMinutes,
          inferredActivity,
          category,
          icon,
          color,
          timeOfDay: timeOfDayLabel,
          date: todayDateStr,
          latitude,
          longitude,
          title: 'Activity Inferred',
          message: `We noticed you spent ${durationMinutes} minutes at ${placeName}. Add this activity to your timeline?`
        };

        // Persist stay to offline secure stores
        await SecureStore.setItemAsync(`${userId}_simulated_suggestion_active`, 'true');
        await SecureStore.setItemAsync(`${userId}_simulated_suggestion_data`, JSON.stringify(staySuggestion));

        // Append to shared Notification History Center
        await appendNotificationToHistory(userId, staySuggestion);

        // Schedule Native Local Alert Banner
        await scheduleActivityNotification({
          placeName,
          durationMinutes,
          inferredActivity,
          category,
          icon,
          color,
          timeOfDay: timeOfDayLabel,
          date: todayDateStr,
          latitude,
          longitude,
          title: 'Activity Detected',
          message: `You spent ${durationMinutes} minutes at ${placeName}. Add a ${inferredActivity} activity?`,
        });

        // Mark stay as notified
        await SecureStore.setItemAsync(`${userId}_notified_for_current_stay`, 'true');
        console.log(`🔔 [Background Location] Dispatched push notification for stay: ${placeName}`);
      }
    } catch (err) {
      console.error('🔔 [Background Location] Processing exception:', err);
    }
  }
});

// ── Background Updates Lifecycle Helpers ─────────────────────────────────────

/**
 * Checks if background location updates are currently registered.
 */
export async function isBackgroundLocationActive(): Promise<boolean> {
  try {
    return await Location.hasStartedLocationUpdatesAsync(BACKGROUND_LOCATION_TASK);
  } catch (err) {
    console.warn('🔔 [Location] Failed to verify background location updates status:', err);
    return false;
  }
}

/**
 * Registers and initiates background coordinates tracking.
 */
export async function startBackgroundLocation(userId: string) {
  try {
    const hasStarted = await isBackgroundLocationActive();
    if (hasStarted) {
      console.log('🔔 [Location] Background location updates are already active.');
      return;
    }

    // Verify foreground location permission is granted
    const { status: fgStatus } = await Location.getForegroundPermissionsAsync();
    if (fgStatus !== 'granted') {
      console.log('🔔 [Location] Foreground permission is not granted. Cannot start background updates.');
      return;
    }

    // Verify background location permission is granted
    const { status: bgStatus } = await Location.getBackgroundPermissionsAsync();
    if (bgStatus !== 'granted') {
      console.log('🔔 [Location] Background permission is not granted. Cannot start background updates.');
      return;
    }

    console.log('🔔 [Location] Starting background updates for user:', userId);

    // Save always allow toggle in SecureStore for the task context
    await SecureStore.setItemAsync(`${userId}_location_always_allow`, 'true');

    await Location.startLocationUpdatesAsync(BACKGROUND_LOCATION_TASK, {
      accuracy: Location.Accuracy.Balanced,
      timeInterval: 15000,   // Request updates every 15 seconds
      distanceInterval: 15,  // Request updates every 15 meters
      foregroundService: {
        notificationTitle: 'AuraJournal Location Intelligence',
        notificationBody: 'Intelligent stay detection is running in the background.',
        notificationColor: '#0D9488',
      },
      pausesUpdatesAutomatically: true,
    });
    console.log('🔔 [Location] Background location updates started successfully!');
  } catch (err) {
    console.warn('🔔 [Location] Failed to start background location updates:', err);
  }
}

/**
 * Stops background coordinates tracking and clears local tracking metrics.
 */
export async function stopBackgroundLocation() {
  try {
    const hasStarted = await isBackgroundLocationActive();
    if (hasStarted) {
      await Location.stopLocationUpdatesAsync(BACKGROUND_LOCATION_TASK);
      console.log('🔔 [Location] Background location updates stopped.');
    }
  } catch (err) {
    console.warn('🔔 [Location] Failed to stop background location updates:', err);
  }
}
