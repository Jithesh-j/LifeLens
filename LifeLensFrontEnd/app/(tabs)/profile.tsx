import React, { useState, useEffect } from 'react';
import {
  StyleSheet,
  View,
  TouchableOpacity,
  ScrollView,
  Alert,
  Switch,
  TextInput,
  Dimensions,
  ActivityIndicator,
  Platform,
} from 'react-native';
import * as SecureStore from 'expo-secure-store';
import * as Location from 'expo-location';
import { useAuth } from '@/context/auth';
import { useSchedule, getTodayDateStr } from '@/context/schedule';
import { ThemedText } from '@/components/themed-text';
import { useThemeColor } from '@/hooks/use-theme-color';
import { IconSymbol } from '@/components/ui/icon-symbol';
import { api } from '@/services/api';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

const SCREEN_HEIGHT = Dimensions.get('window').height;

// ── Premium Dark-Mode Colors (Matching Home Screen) ──────────────────────────
const PURPLE = '#8F66FF';
const LIGHT_PURPLE = '#C4A8FF';
const DARK_BG = '#080916';
const CARD_BG = 'rgba(17, 19, 42, 0.65)';
const GLASS_BORDER = 'rgba(255, 255, 255, 0.09)';
const GREEN = '#34D399';
const BLUE = '#3B82F6';
const AMBER = '#F59E0B';
const RED = '#EF4444';

export default function ProfileScreen() {
  const { user, logout } = useAuth();
  const { addNoteAndExtract, scheduleItems } = useSchedule();
  const insets = useSafeAreaInsets();

  const primaryColor = PURPLE;
  const errorColor = RED;
  const cardBg = CARD_BG;

  // Settings States (stored in SecureStore)
  const [locationEnabled, setLocationEnabled] = useState(false);
  const [smartDetectionEnabled, setSmartDetectionEnabled] = useState(false);
  const [notificationsEnabled, setNotificationsEnabled] = useState(false);
  const [weatherOnTimeline, setWeatherOnTimeline] = useState(false);
  const [frequency, setFrequency] = useState<'instant' | 'daily' | 'weekly' | 'off'>('instant');

  // Sub-Overlay Displays
  const [activeModal, setActiveModal] = useState<string | null>(null); // 'account' | 'notifications' | 'integrations' | 'location' | 'privacy'
  const [showPermissionPrompt, setShowPermissionPrompt] = useState(false);
  const [isLocating, setIsLocating] = useState(false);

  // Simulation Suggestion states
  const [activeSimulation, setActiveSimulation] = useState<any | null>(null);
  const [showEditSheet, setShowEditSheet] = useState(false);
  const [editTitle, setEditTitle] = useState('');
  const [editDuration, setEditDuration] = useState('');
  const [editActivity, setEditActivity] = useState('');

  // Load Settings from Backend & Scoped SecureStore for Simulation
  useEffect(() => {
    if (!user) return;
    async function loadSettings() {
      if (!user) return;
      try {
        const settings = await api.getUserSettings();
        setLocationEnabled(settings.location_enabled);
        setSmartDetectionEnabled(settings.smart_activity_detection);
        setNotificationsEnabled(settings.smart_notifications);
        setWeatherOnTimeline(settings.weather_on_timeline || false);
        setFrequency(settings.notification_frequency as any);

        const simActiveKey = `${user.id}_simulated_suggestion_active`;
        const simDataKey = `${user.id}_simulated_suggestion_data`;
        const simActive = await SecureStore.getItemAsync(simActiveKey);
        const simData = await SecureStore.getItemAsync(simDataKey);

        if (simActive === 'true' && simData) {
          setActiveSimulation(JSON.parse(simData));
        } else {
          setActiveSimulation(null);
        }
      } catch (err) {
        console.warn('Failed to load location intelligence settings from backend:', err);
      }
    }
    loadSettings();
  }, [user]);

  const saveSetting = async (key: string, value: string) => {
    if (!user) return;
    try {
      const payload: any = {};
      if (key === 'location_services_enabled') {
        payload.location_enabled = value === 'true';
      } else if (key === 'smart_activity_detection_enabled') {
        payload.smart_activity_detection = value === 'true';
      } else if (key === 'smart_notifications_enabled') {
        payload.smart_notifications = value === 'true';
      } else if (key === 'weather_on_timeline') {
        payload.weather_on_timeline = value === 'true';
      } else if (key === 'notifications_frequency') {
        payload.notification_frequency = value;
      }
      await api.updateUserSettings(payload);
    } catch (err) {
      console.error(`Failed to save setting to backend for key ${key}:`, err);
    }
  };

  const handleToggleLocation = (value: boolean) => {
    if (value) {
      setShowPermissionPrompt(true);
    } else {
      setLocationEnabled(false);
      setSmartDetectionEnabled(false);
      setNotificationsEnabled(false);
      saveSetting('location_services_enabled', 'false');
      saveSetting('smart_activity_detection_enabled', 'false');
      saveSetting('smart_notifications_enabled', 'false');
      clearSimulatedSuggestion();
      Alert.alert('Location Services Disabled', 'All location-based activity suggestions and telemetry tracking have been stopped.');
    }
  };

  const acceptPermission = async () => {
    setShowPermissionPrompt(false);
    try {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status === 'granted') {
        setLocationEnabled(true);
        saveSetting('location_services_enabled', 'true');
      } else {
        setLocationEnabled(false);
        saveSetting('location_services_enabled', 'false');
        Alert.alert(
          'System Permission Denied',
          'AuraJournal requires system-level location permissions. Please open your iOS Settings -> Expo Go -> Location and select "While Using the App" or "Always" to allow coordinates access.'
        );
      }
    } catch (err) {
      console.error('Failed to request location permission:', err);
      setLocationEnabled(false);
      saveSetting('location_services_enabled', 'false');
    }
  };

  const rejectPermission = () => {
    setLocationEnabled(false);
    setShowPermissionPrompt(false);
    saveSetting('location_services_enabled', 'false');
  };

  const clearSimulatedSuggestion = async () => {
    setActiveSimulation(null);
    if (user) {
      await SecureStore.deleteItemAsync(`${user.id}_simulated_suggestion_active`);
      await SecureStore.deleteItemAsync(`${user.id}_simulated_suggestion_data`);
    }
  };

  const triggerTestDetection = async () => {
    if (!locationEnabled || !smartDetectionEnabled || !notificationsEnabled) {
      Alert.alert(
        'Setup Required',
        'Please ensure "Enable Location Services", "Smart Activity Detection", and "Smart Notifications" are all turned ON before running the simulator!'
      );
      return;
    }

    setIsLocating(true);
    try {
      // 1. Request foreground permission from the device
      let { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') {
        Alert.alert(
          'System Permission Denied',
          'AuraJournal requires system-level location access to query actual coordinates.\n\nPlease open your iOS Settings -> Expo Go -> Location and select "While Using the App" or "Always" to proceed.'
        );
        setIsLocating(false);
        return;
      }

      // 2. Query actual device coordinates
      const location = await Location.getCurrentPositionAsync({
        accuracy: Location.Accuracy.Balanced,
      });

      const { latitude, longitude } = location.coords;
      console.log('📡 [Location] Fetched coords:', latitude, longitude);

      // 3. Reverse geocode coordinates to find the actual place name
      const geocodedAddresses = await Location.reverseGeocodeAsync({
        latitude,
        longitude,
      });

      let resolvedPlace = 'Current Location';
      if (geocodedAddresses && geocodedAddresses.length > 0) {
        const addr = geocodedAddresses[0];
        // Formulate a beautiful place label from street, name, or city
        resolvedPlace = addr.name || addr.street || addr.district || addr.subregion || addr.city || 'Local Hub';
      }

      // 4. Infer stay properties dynamically based on local time
      const now = new Date();
      const currentHour = now.getHours();

      let inferredActivity = 'Workout';
      let category = 'health';
      let icon = 'gym';
      let color = 'green';
      let durationMinutes = 45;

      if (currentHour >= 5 && currentHour < 12) {
        inferredActivity = 'Morning Jog / Walk';
        category = 'health';
        icon = 'walk';
        color = 'green';
        durationMinutes = 50;
      } else if (currentHour >= 12 && currentHour < 17) {
        inferredActivity = 'Lunch Break';
        category = 'social';
        icon = 'rest';
        color = 'yellow';
        durationMinutes = 60;
      } else if (currentHour >= 17 && currentHour < 21) {
        inferredActivity = 'Work / Study Session';
        category = 'work';
        icon = 'laptop';
        color = 'purple';
        durationMinutes = 120;
      } else {
        inferredActivity = 'Evening Wind Down';
        category = 'rest';
        icon = 'rest';
        color = 'gray';
        durationMinutes = 90;
      }

      const displayHour = currentHour % 12 === 0 ? 12 : currentHour % 12;
      const displayMin = String(now.getMinutes()).padStart(2, '0');
      const ampm = currentHour >= 12 ? 'PM' : 'AM';
      const timeOfDayLabel = `${displayHour}:${displayMin} ${ampm}`;

      const mockSuggestion = {
        id: 'real-loc-' + Date.now(),
        placeName: resolvedPlace,
        durationMinutes: durationMinutes,
        inferredActivity: inferredActivity,
        category: category,
        icon: icon,
        color: color,
        timeOfDay: timeOfDayLabel,
        date: getTodayDateStr(),
        latitude,
        longitude,
      };

      setActiveSimulation(mockSuggestion);
      if (user) {
        await SecureStore.setItemAsync(`${user.id}_simulated_suggestion_active`, 'true');
        await SecureStore.setItemAsync(`${user.id}_simulated_suggestion_data`, JSON.stringify(mockSuggestion));
      }

      Alert.alert(
        'Real Location Detected!',
        `Your device GPS successfully resolved your current location as: "${resolvedPlace}".\nWe inferred a stay of ${durationMinutes} minutes starting at ${timeOfDayLabel}. Review the suggestion card below or on your Home screen!`
      );
    } catch (err) {
      console.warn('Failed to fetch live coordinates, falling back to simulated Discovery Park:', err);
      
      // Fallback
      const mockSuggestion = {
        id: 'mock-loc-' + Date.now(),
        placeName: 'Discovery Park',
        durationMinutes: 80,
        inferredActivity: 'Walking / Jogging',
        category: 'health',
        icon: 'walk',
        color: 'green',
        timeOfDay: '10:30 AM',
        date: getTodayDateStr(),
        latitude: 34.05,
        longitude: -118.24,
      };

      setActiveSimulation(mockSuggestion);
      if (user) {
        await SecureStore.setItemAsync(`${user.id}_simulated_suggestion_active`, 'true');
        await SecureStore.setItemAsync(`${user.id}_simulated_suggestion_data`, JSON.stringify(mockSuggestion));
      }

      Alert.alert(
        'Simulated Fallback Activated',
        'Could not fetch real-time GPS bounds (e.g. simulator without a custom location active). Toggled simulated stay at "Discovery Park" instead.'
      );
    } finally {
      setIsLocating(false);
    }
  };

  const handleDeleteAllLocationData = () => {
    Alert.alert(
      'Purge Location Telemetry?',
      'Are you absolutely sure you want to delete all cached location history, geofence logs, and custom simulation data? This action cannot be undone.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete All',
          style: 'destructive',
          onPress: async () => {
            setLocationEnabled(false);
            setSmartDetectionEnabled(false);
            setNotificationsEnabled(false);
            setFrequency('instant');
            try {
              await api.updateUserSettings({
                location_enabled: false,
                smart_activity_detection: false,
                smart_notifications: false,
                notification_frequency: 'instant'
              });
            } catch (err) {
              console.error('Failed to purge settings on backend:', err);
            }
            await clearSimulatedSuggestion();
            Alert.alert('Data Purged Successfully', 'All location profiles and telemetry data have been fully erased from offline SecureStore storage.');
          },
        },
      ]
    );
  };

  const handleAddLocationToTimeline = async () => {
    if (!activeSimulation) return;
    try {
      const sentence = `Spent ${activeSimulation.durationMinutes} minutes at ${activeSimulation.placeName} (${activeSimulation.inferredActivity})`;
      
      // Parse 12h time to 24h format for ISO string construction
      const timePart = activeSimulation.timeOfDay.split(' ')[0] || '';
      const ampm = activeSimulation.timeOfDay.split(' ')[1] || 'AM';
      let h = parseInt(timePart.split(':')[0]) || 12;
      const m = parseInt(timePart.split(':')[1]) || 0;
      if (ampm.toUpperCase() === 'PM' && h < 12) h += 12;
      if (ampm.toUpperCase() === 'AM' && h === 12) h = 0;
      const startTime24h = `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}:00`;
      
      const startISO = `${activeSimulation.date}T${startTime24h}`;

      const newLocalItem: any = {
        id: Math.random().toString(),
        title: activeSimulation.inferredActivity,
        timeRange: activeSimulation.timeOfDay,
        category: activeSimulation.category,
        icon: activeSimulation.icon,
        color: activeSimulation.color,
        date: activeSimulation.date,
        startTime: startISO,
        isAiExtracted: false,
        location: {
          name: activeSimulation.placeName,
          latitude: activeSimulation.latitude || 34.05,
          longitude: activeSimulation.longitude || -118.24,
        }
      };

      // Save to backend database
      await api.createActivity(sentence, `${activeSimulation.date}T12:00:00`);
      // Extract and save to local schedule
      await addNoteAndExtract(sentence, activeSimulation.date, [newLocalItem]);

      Alert.alert('Added to Timeline', 'Your visit was logged as an activity in your timeline logs.');
      await clearSimulatedSuggestion();
    } catch (err) {
      console.error(err);
      Alert.alert('Error', 'Failed to log location activity.');
    }
  };

  const handleAddLocationToEvents = async () => {
    if (!activeSimulation) return;
    try {
      const sentence = `${activeSimulation.inferredActivity} at ${activeSimulation.timeOfDay} for ${activeSimulation.durationMinutes} minutes`;
      
      // Construct a premium schedule item matching calendar requirements
      const startTimeISO = `${activeSimulation.date}T10:30:00`;
      const endTimeISO = `${activeSimulation.date}T11:50:00`; // 80 min duration

      const newEvent: any = {
        id: Math.random().toString(),
        title: `${activeSimulation.inferredActivity} (${activeSimulation.placeName})`,
        timeRange: `10:30 AM - 11:50 AM`,
        duration: `${activeSimulation.durationMinutes} min`,
        category: activeSimulation.category,
        icon: activeSimulation.icon,
        color: activeSimulation.color,
        date: activeSimulation.date,
        startTime: startTimeISO,
        endTime: endTimeISO,
        isAiExtracted: false,
      };

      // Save to database
      await api.createActivity(sentence, `${activeSimulation.date}T12:00:00`);
      // Save event structure to calendar schedule
      addNoteAndExtract(sentence, activeSimulation.date, [newEvent]);

      Alert.alert('Added to Calendar', 'The activity was added as a scheduled event in today’s calendar feed!');
      await clearSimulatedSuggestion();
    } catch (err) {
      console.error(err);
      Alert.alert('Error', 'Failed to schedule calendar event.');
    }
  };

  const handleOpenEditSheet = () => {
    if (!activeSimulation) return;
    setEditTitle(activeSimulation.placeName);
    setEditDuration(String(activeSimulation.durationMinutes));
    setEditActivity(activeSimulation.inferredActivity);
    setShowEditSheet(true);
  };

  const handleSaveEdit = async () => {
    if (!activeSimulation) return;
    
    // Inferred category mapping based on activity entered
    let category: 'health' | 'work' | 'social' | 'rest' | 'other' = 'other';
    let icon: 'walk' | 'run' | 'swim' | 'play' | 'laptop' | 'groups' | 'phone' | 'gym' | 'rest' = 'rest';
    let color: 'green' | 'purple' | 'yellow' | 'gray' | 'orange' | 'blue' | 'red' = 'gray';
    const lower = editActivity.toLowerCase();

    if (/\b(run|jog|running|jogging)\b/i.test(lower)) {
      category = 'health';
      icon = 'run';
      color = 'orange';
    } else if (lower.includes('swim')) {
      category = 'health';
      icon = 'swim';
      color = 'blue';
    } else if (lower.includes('play') || lower.includes('sport') || lower.includes('tennis') || lower.includes('basketball') || lower.includes('soccer') || lower.includes('football') || lower.includes('cricket')) {
      category = 'health';
      icon = 'play';
      color = 'yellow';
    } else if (lower.includes('walk') || lower.includes('hike')) {
      category = 'health';
      icon = 'walk';
      color = 'green';
    } else if (lower.includes('gym') || lower.includes('workout') || lower.includes('exercise')) {
      category = 'health';
      icon = 'gym';
      color = 'red';
    } else if (lower.includes('work') || lower.includes('study') || lower.includes('code') || lower.includes('meeting')) {
      category = 'work';
      icon = 'laptop';
      color = 'purple';
    } else if (lower.includes('cafe') || lower.includes('coffee') || lower.includes('lunch') || lower.includes('dinner') || lower.includes('brunch')) {
      category = 'social';
      icon = 'groups';
      color = 'yellow';
    }

    const updated = {
      ...activeSimulation,
      placeName: editTitle,
      durationMinutes: parseInt(editDuration) || 30,
      inferredActivity: editActivity,
      category,
      icon,
      color,
    };

    setActiveSimulation(updated);
    if (user) {
      await SecureStore.setItemAsync(`${user.id}_simulated_suggestion_data`, JSON.stringify(updated));
    }
    setShowEditSheet(false);
    Alert.alert('Activity Updated', 'The inferred details have been revised in simulation cache.');
  };

  const handleLogout = () => {
    Alert.alert(
      'Sign Out',
      'Are you sure you want to sign out of AuraJournal?',
      [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Sign Out', style: 'destructive', onPress: logout },
      ]
    );
  };

  const getInitials = (name?: string) => {
    if (!name) return 'U';
    return name.slice(0, 2).toUpperCase();
  };

  return (
    <View style={styles.outerContainer}>
      {/* Background Glow */}
      <View style={styles.glowCircle1} />
      <View style={styles.glowCircle2} />
      <View style={styles.glowCircle3} />

      <ScrollView 
        style={styles.container} 
        contentContainerStyle={[
          styles.content, 
          { paddingTop: insets.top > 0 ? insets.top + 32 : 80 }
        ]}
      >
        <View style={styles.header}>
          <ThemedText style={styles.headerTitle}>Profile & Settings</ThemedText>
        </View>

        {/* User Card */}
        <View style={styles.profileCard}>
          <View style={[styles.avatar, { backgroundColor: primaryColor }]}>
            <ThemedText style={styles.avatarText}>{getInitials(user?.full_name)}</ThemedText>
          </View>
          <View style={styles.userInfo}>
            <ThemedText style={styles.username}>{user?.full_name || 'Journaler'}</ThemedText>
            <ThemedText style={styles.email}>{user?.email || 'user@lifelens.com'}</ThemedText>
          </View>
        </View>

        {/* Streak Stats Grid */}
        <View style={styles.statsGrid}>
          <View style={styles.statBox}>
            <IconSymbol size={24} name="paperplane.fill" color={primaryColor} />
            <ThemedText style={styles.statVal}>{scheduleItems.length}</ThemedText>
            <ThemedText style={styles.statLabel}>Total Schedule Items</ThemedText>
          </View>
          <View style={styles.statBox}>
            <IconSymbol size={24} name="eyes" color={primaryColor} />
            <ThemedText style={styles.statVal}>Active</ThemedText>
            <ThemedText style={styles.statLabel}>Sync Status</ThemedText>
          </View>
        </View>

        {/* ── Settings Row Section ───────────────────────────────────────────── */}
        <ThemedText style={styles.sectionTitle}>Settings</ThemedText>
        <View style={styles.settingsList}>
          {/* Account settings */}
          <TouchableOpacity style={styles.settingsRow} onPress={() => setActiveModal('account')}>
            <IconSymbol size={22} name="person.crop.circle.fill" color={primaryColor} />
            <ThemedText style={styles.settingsLabel}>Account</ThemedText>
            <IconSymbol size={16} name="chevron.right" color="#FFF" style={{ opacity: 0.3 }} />
          </TouchableOpacity>
          <View style={styles.divider} />

          {/* Notifications settings */}
          <TouchableOpacity style={styles.settingsRow} onPress={() => setActiveModal('notifications')}>
            <IconSymbol size={22} name="bell.fill" color={primaryColor} />
            <ThemedText style={styles.settingsLabel}>Notifications</ThemedText>
            <IconSymbol size={16} name="chevron.right" color="#FFF" style={{ opacity: 0.3 }} />
          </TouchableOpacity>
          <View style={styles.divider} />



          {/* Location Intelligence (NEW) settings */}
          <TouchableOpacity style={styles.settingsRow} onPress={() => setActiveModal('location')}>
            <IconSymbol size={22} name="location.fill" color={primaryColor} />
            <View style={{ flex: 1 }}>
              <ThemedText style={styles.settingsLabel}>Location Intelligence</ThemedText>
              <ThemedText style={styles.settingsSubtitle}>
                {locationEnabled ? 'Active (Smart detection enabled)' : 'Disabled (Off-grid suggestions)'}
              </ThemedText>
            </View>
            <IconSymbol size={16} name="chevron.right" color="#FFF" style={{ opacity: 0.3 }} />
          </TouchableOpacity>
          <View style={styles.divider} />

          {/* Data & Privacy settings */}
          <TouchableOpacity style={styles.settingsRow} onPress={() => setActiveModal('privacy')}>
            <IconSymbol size={22} name="shield.fill" color={primaryColor} />
            <ThemedText style={styles.settingsLabel}>Data & Privacy</ThemedText>
            <IconSymbol size={16} name="chevron.right" color="#FFF" style={{ opacity: 0.3 }} />
          </TouchableOpacity>
        </View>

        {/* Actions */}
        <TouchableOpacity style={[styles.logoutBtn, { borderColor: errorColor }]} onPress={handleLogout}>
          <IconSymbol size={20} name="exclamationmark.circle.fill" color={errorColor} style={styles.logoutIcon} />
          <ThemedText style={[styles.logoutBtnText, { color: errorColor }]}>Sign Out</ThemedText>
        </TouchableOpacity>
      </ScrollView>

      {/* ── Sub-Overlays (Absolute positioned elements replacing native Modals) ── */}

      {/* 1. Account Details Overlay */}
      {activeModal === 'account' && (
        <View style={styles.absoluteOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <ThemedText style={styles.modalTitle}>Account Settings</ThemedText>
              <TouchableOpacity onPress={() => setActiveModal(null)}>
                <IconSymbol size={24} name="xmark" color="#FFF" />
              </TouchableOpacity>
            </View>
            <View style={styles.modalBody}>
              <View style={styles.detailRow}>
                <ThemedText style={styles.detailLabel}>Full Name</ThemedText>
                <ThemedText style={styles.detailValue}>{user?.full_name || 'Standard User'}</ThemedText>
              </View>
              <View style={styles.innerDivider} />
              <View style={styles.detailRow}>
                <ThemedText style={styles.detailLabel}>Email Address</ThemedText>
                <ThemedText style={styles.detailValue}>{user?.email || 'user@lifelens.com'}</ThemedText>
              </View>
              <View style={styles.innerDivider} />
              <View style={styles.detailRow}>
                <ThemedText style={styles.detailLabel}>Joined Date</ThemedText>
                <ThemedText style={styles.detailValue}>
                  {user?.created_at ? new Date(user.created_at).toLocaleDateString() : 'May 2026'}
                </ThemedText>
              </View>
              <View style={styles.innerDivider} />
              <View style={styles.detailRow}>
                <ThemedText style={styles.detailLabel}>Account Status</ThemedText>
                <ThemedText style={[styles.detailValue, { color: GREEN }]}>Premium Tier</ThemedText>
              </View>
            </View>
          </View>
        </View>
      )}

      {/* 2. Notifications Overlay */}
      {activeModal === 'notifications' && (
        <View style={styles.absoluteOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <ThemedText style={styles.modalTitle}>Notification Settings</ThemedText>
              <TouchableOpacity onPress={() => setActiveModal(null)}>
                <IconSymbol size={24} name="xmark" color="#FFF" />
              </TouchableOpacity>
            </View>
            <View style={styles.modalBody}>
              <View style={styles.switchRow}>
                <View style={{ flex: 1 }}>
                  <ThemedText style={styles.switchLabel}>Push Notifications</ThemedText>
                  <ThemedText style={styles.switchDesc}>Enable real-time ambient alerts</ThemedText>
                </View>
                <Switch value={true} trackColor={{ true: PURPLE }} />
              </View>
              <View style={styles.innerDivider} />
              <View style={styles.switchRow}>
                <View style={{ flex: 1 }}>
                  <ThemedText style={styles.switchLabel}>Daily Journal Summary</ThemedText>
                  <ThemedText style={styles.switchDesc}>Receive a daily review digest</ThemedText>
                </View>
                <Switch value={true} trackColor={{ true: PURPLE }} />
              </View>
            </View>
          </View>
        </View>
      )}



      {/* 4. Data & Privacy Overlay */}
      {activeModal === 'privacy' && (
        <View style={styles.absoluteOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <ThemedText style={styles.modalTitle}>Data & Privacy Policy</ThemedText>
              <TouchableOpacity onPress={() => setActiveModal(null)}>
                <IconSymbol size={24} name="xmark" color="#FFF" />
              </TouchableOpacity>
            </View>
            <ScrollView style={{ maxHeight: 400 }} contentContainerStyle={{ gap: 16, paddingBottom: 24 }}>
              <View style={styles.privacyCard}>
                <IconSymbol size={24} name="shield.fill" color={GREEN} />
                <ThemedText style={styles.privacyCardTitle}>100% On-Device Processing</ThemedText>
                <ThemedText style={styles.privacyCardText}>
                  Your raw location metrics and coordinates are processed strictly on your smartphone. We do not upload coordinates or trace profiles to external cloud logs.
                </ThemedText>
              </View>

              <View style={styles.privacyCard}>
                <IconSymbol size={24} name="lock.fill" color={PURPLE} />
                <ThemedText style={styles.privacyCardTitle}>Zero Third-Party Sharing</ThemedText>
                <ThemedText style={styles.privacyCardText}>
                  AuraJournal does not engage in advertising, and we never share, sell, or rent your geographical profile to any broker.
                </ThemedText>
              </View>

              <TouchableOpacity style={styles.dangerBtn} onPress={handleDeleteAllLocationData}>
                <IconSymbol size={18} name="trash.fill" color="#FFF" />
                <ThemedText style={styles.dangerBtnText}>Purge All Location History</ThemedText>
              </TouchableOpacity>
            </ScrollView>
          </View>
        </View>
      )}

      {/* 5. LOCATION INTELLIGENCE FEATURE OVERLAY (NEW) */}
      {activeModal === 'location' && (
        <View style={[styles.absoluteOverlayLarge, { paddingTop: insets.top > 0 ? insets.top + 32 : 80 }]}>
          <View style={styles.locationHeaderCard}>
            <View style={styles.modalHeader}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                <IconSymbol size={24} name="location.fill" color={PURPLE} />
                <ThemedText style={styles.modalTitle}>Location Intelligence</ThemedText>
              </View>
              <TouchableOpacity onPress={() => setActiveModal(null)}>
                <IconSymbol size={24} name="xmark" color="#FFF" />
              </TouchableOpacity>
            </View>
          </View>

          <ScrollView style={styles.locationScroll} contentContainerStyle={styles.locationBody}>
            
            {/* Feature Description */}
            <View style={styles.descCard}>
              <ThemedText style={styles.descText}>
                Enable optional, offline location intelligence to automatically detect place visits and geofence events. LifeLens will suggest logging visited spots to save manual entries.
              </ThemedText>
            </View>

            {/* TOGGLE 1: Enable Location Services */}
            <View style={styles.switchRowCard}>
              <View style={{ flex: 1, gap: 4 }}>
                <ThemedText style={styles.switchRowLabel}>Enable Location Services</ThemedText>
                <ThemedText style={styles.switchRowDesc}>
                  Allows ambient background coordinates monitoring using secure geofences.
                </ThemedText>
              </View>
              <Switch
                value={locationEnabled}
                onValueChange={handleToggleLocation}
                trackColor={{ true: PURPLE }}
              />
            </View>

            {/* TOGGLE 2: Smart Activity Detection */}
            <View style={[styles.switchRowCard, { opacity: locationEnabled ? 1 : 0.4 }]}>
              <View style={{ flex: 1, gap: 4 }}>
                <ThemedText style={styles.switchRowLabel}>Smart Activity Detection</ThemedText>
                <ThemedText style={styles.switchRowDesc}>
                  Infers possible activity type based on category, stay length, and time of day.
                </ThemedText>
              </View>
              <Switch
                value={smartDetectionEnabled}
                disabled={!locationEnabled}
                onValueChange={(val) => {
                  setSmartDetectionEnabled(val);
                  saveSetting('smart_activity_detection_enabled', String(val));
                }}
                trackColor={{ true: PURPLE }}
              />
            </View>

            {/* TOGGLE: Weather on Timeline */}
            <View style={[styles.switchRowCard, { opacity: locationEnabled ? 1 : 0.4 }]}>
              <View style={{ flex: 1, gap: 4 }}>
                <ThemedText style={styles.switchRowLabel}>Weather on Timeline</ThemedText>
                <ThemedText style={styles.switchRowDesc}>
                  Enrich timeline events with historical and forecasted weather conditions.
                </ThemedText>
              </View>
              <Switch
                value={weatherOnTimeline}
                disabled={!locationEnabled}
                onValueChange={(val) => {
                  setWeatherOnTimeline(val);
                  saveSetting('weather_on_timeline', String(val));
                }}
                trackColor={{ true: PURPLE }}
              />
            </View>

            {/* INFERRED LOGIC LIST (Only if Smart Detection is ON) */}
            {locationEnabled && smartDetectionEnabled && (
              <View style={styles.inferenceBox}>
                <ThemedText style={styles.inferenceTitle}>🎯 Detection Inferences Model</ThemedText>
                
                <View style={styles.inferenceItem}>
                  <ThemedText style={styles.inferenceIcon}>🏞️</ThemedText>
                  <View style={{ flex: 1 }}>
                    <ThemedText style={styles.inferenceLabel}>Park + 60 mins</ThemedText>
                    <ThemedText style={styles.inferenceResult}>Walking / Jogging</ThemedText>
                  </View>
                </View>
                <View style={styles.inferenceDivider} />

                <View style={styles.inferenceItem}>
                  <ThemedText style={styles.inferenceIcon}>🏋️</ThemedText>
                  <View style={{ flex: 1 }}>
                    <ThemedText style={styles.inferenceLabel}>Gym + 45 mins</ThemedText>
                    <ThemedText style={styles.inferenceResult}>Workout</ThemedText>
                  </View>
                </View>
                <View style={styles.inferenceDivider} />

                <View style={styles.inferenceItem}>
                  <ThemedText style={styles.inferenceIcon}>🥾</ThemedText>
                  <View style={{ flex: 1 }}>
                    <ThemedText style={styles.inferenceLabel}>Trail + Stay</ThemedText>
                    <ThemedText style={styles.inferenceResult}>Hiking</ThemedText>
                  </View>
                </View>
                <View style={styles.inferenceDivider} />

                <View style={styles.inferenceItem}>
                  <ThemedText style={styles.inferenceIcon}>☕</ThemedText>
                  <View style={{ flex: 1 }}>
                    <ThemedText style={styles.inferenceLabel}>Cafe + 2 hrs</ThemedText>
                    <ThemedText style={styles.inferenceResult}>Work / Study session</ThemedText>
                  </View>
                </View>
              </View>
            )}

            {/* TOGGLE 3: Smart Notifications */}
            <View style={[styles.switchRowCard, { opacity: (locationEnabled && smartDetectionEnabled) ? 1 : 0.4 }]}>
              <View style={{ flex: 1, gap: 4 }}>
                <ThemedText style={styles.switchRowLabel}>Smart Notifications</ThemedText>
                <ThemedText style={styles.switchRowDesc}>
                  Get notifications when AuraJournal recognizes spent stays at places.
                </ThemedText>
              </View>
              <Switch
                value={notificationsEnabled}
                disabled={!locationEnabled || !smartDetectionEnabled}
                onValueChange={(val) => {
                  setNotificationsEnabled(val);
                  saveSetting('smart_notifications_enabled', String(val));
                }}
                trackColor={{ true: PURPLE }}
              />
            </View>

            {/* Notification frequency picker */}
            {locationEnabled && smartDetectionEnabled && notificationsEnabled && (
              <View style={styles.frequencyCard}>
                <ThemedText style={styles.frequencyTitle}>Notification Frequency</ThemedText>
                <View style={styles.pillRow}>
                  {(['instant', 'daily', 'weekly', 'off'] as const).map((freqOption) => (
                    <TouchableOpacity
                      key={freqOption}
                      style={[
                        styles.freqPill,
                        frequency === freqOption && styles.freqPillSelected,
                      ]}
                      onPress={() => {
                        setFrequency(freqOption);
                        saveSetting('notifications_frequency', freqOption);
                      }}
                    >
                      <ThemedText
                        style={[
                          styles.freqPillText,
                          frequency === freqOption && styles.freqPillTextSelected,
                        ]}
                      >
                        {freqOption.toUpperCase()}
                      </ThemedText>
                    </TouchableOpacity>
                  ))}
                </View>
              </View>
            )}

            {/* Privacy Notice Box */}
            <View style={styles.privacyNoticeBox}>
              <IconSymbol size={20} name="shield.fill" color={GREEN} />
              <ThemedText style={styles.privacyNoticeText}>
                Your geofencing metrics are locked offline under device local keychain database security. No third-party trace sharing allowed.
              </ThemedText>
            </View>

            {/* ── SIMULATION ENGINE (Test Section) ─────────────────────────── */}
            <ThemedText style={styles.simulationHeader}>🧪 GEOFENCING TEST ENGINE</ThemedText>
            <View style={styles.simulationCard}>
              <ThemedText style={styles.simText}>
                Use this simulator to test and review the ambient Location Detection notification flow. Tapping the trigger will fetch your actual device GPS coordinates and reverse geocode them.
              </ThemedText>

              <TouchableOpacity
                style={[
                  styles.simulatorBtn,
                  (!locationEnabled || !smartDetectionEnabled || !notificationsEnabled || isLocating) && styles.simulatorBtnDisabled,
                ]}
                disabled={!locationEnabled || !smartDetectionEnabled || !notificationsEnabled || isLocating}
                onPress={triggerTestDetection}
              >
                {isLocating ? (
                  <ActivityIndicator size="small" color="#0A0C1B" />
                ) : (
                  <>
                    <IconSymbol size={18} name="map.fill" color="#0A0C1B" />
                    <ThemedText style={styles.simulatorBtnText}>Trigger Test Detection</ThemedText>
                  </>
                )}
              </TouchableOpacity>

              {/* Simulated Geofencing Card Notification (Bottom Sheet Mockup) */}
              {activeSimulation && (
                <View style={styles.mockNotificationCard}>
                  <View style={styles.mockNotifHeader}>
                    <IconSymbol size={18} name="location.fill" color={PURPLE} />
                    <ThemedText style={styles.mockNotifTitle}>📍 New Location Inferred</ThemedText>
                    <TouchableOpacity onPress={clearSimulatedSuggestion} style={styles.mockNotifClose}>
                      <IconSymbol size={16} name="xmark" color="#FFF" style={{ opacity: 0.5 }} />
                    </TouchableOpacity>
                  </View>

                  <ThemedText style={styles.mockNotifMsg}>
                    We noticed you spent <ThemedText style={{ fontWeight: 'bold', color: PURPLE }}>{activeSimulation.durationMinutes}m</ThemedText> at <ThemedText style={{ fontWeight: 'bold' }}>{activeSimulation.placeName}</ThemedText>. Would you like to add this as an activity?
                  </ThemedText>

                  <View style={styles.mockNotifMetaRow}>
                    <ThemedText style={styles.mockNotifMetaLabel}>
                      Inferred Activity: <ThemedText style={{ fontWeight: '700', color: GREEN }}>{activeSimulation.inferredActivity}</ThemedText>
                    </ThemedText>
                  </View>

                  {/* Actions */}
                  <View style={styles.mockActionsGrid}>
                    <TouchableOpacity style={styles.mockActionBtn} onPress={handleAddLocationToTimeline}>
                      <IconSymbol size={14} name="paperplane.fill" color={BLUE} />
                      <ThemedText style={styles.mockActionBtnText}>Add Timeline</ThemedText>
                    </TouchableOpacity>

                    <TouchableOpacity style={styles.mockActionBtn} onPress={handleAddLocationToEvents}>
                      <IconSymbol size={14} name="calendar" color={GREEN} />
                      <ThemedText style={styles.mockActionBtnText}>Add Calendar</ThemedText>
                    </TouchableOpacity>
                  </View>

                  <View style={styles.mockActionsGrid2}>
                    <TouchableOpacity style={styles.mockActionBtnSmall} onPress={handleOpenEditSheet}>
                      <ThemedText style={styles.mockActionBtnTextSmall}>Edit Activity</ThemedText>
                    </TouchableOpacity>

                    <TouchableOpacity style={styles.mockActionBtnSmall} onPress={clearSimulatedSuggestion}>
                      <ThemedText style={[styles.mockActionBtnTextSmall, { color: RED }]}>Ignore</ThemedText>
                    </TouchableOpacity>
                  </View>
                </View>
              )}
            </View>

            {/* Danger Zone */}
            <TouchableOpacity style={styles.dangerBtn} onPress={handleDeleteAllLocationData}>
              <IconSymbol size={18} name="trash.fill" color="#FFF" />
              <ThemedText style={styles.dangerBtnText}>Delete All Location Data</ThemedText>
            </TouchableOpacity>
          </ScrollView>
        </View>
      )}

      {/* 6. Permission Prompt Simulation Dialog */}
      {showPermissionPrompt && (
        <View style={styles.promptBg}>
          <View style={styles.promptBox}>
            <View style={styles.promptIconBg}>
              <IconSymbol size={36} name="location.fill" color={PURPLE} />
            </View>
            <ThemedText style={styles.promptTitle}>
              Allow "AuraJournal" to access your location?
            </ThemedText>
            <ThemedText style={styles.promptDesc}>
              AuraJournal uses your device geofences to automatically detect visited places (like gyms, parks, and cafes) to suggest timeline activities and event logs. Your location telemetry is processed locally offline and never shared.
            </ThemedText>

            <TouchableOpacity style={styles.promptActionBtn} onPress={acceptPermission}>
              <ThemedText style={styles.promptActionText}>Allow While Using App</ThemedText>
            </TouchableOpacity>

            <TouchableOpacity style={styles.promptActionBtn} onPress={acceptPermission}>
              <ThemedText style={styles.promptActionText}>Allow Once</ThemedText>
            </TouchableOpacity>

            <TouchableOpacity style={[styles.promptActionBtn, { borderBottomWidth: 0 }]} onPress={rejectPermission}>
              <ThemedText style={[styles.promptActionText, { color: RED, fontWeight: 'normal' }]}>Don't Allow</ThemedText>
            </TouchableOpacity>
          </View>
        </View>
      )}

      {/* 7. Edit Suggested Activity Sub-Sheet */}
      {showEditSheet && (
        <View style={styles.editBg}>
          <View style={styles.editCard}>
            <View style={styles.editHeader}>
              <ThemedText style={styles.editTitle}>Edit Location Activity</ThemedText>
              <TouchableOpacity onPress={() => setShowEditSheet(false)}>
                <IconSymbol size={24} name="xmark" color="#FFF" />
              </TouchableOpacity>
            </View>

            <View style={styles.editBody}>
              <ThemedText style={styles.inputLabel}>Place Name</ThemedText>
              <TextInput
                style={styles.textInput}
                value={editTitle}
                onChangeText={setEditTitle}
                placeholder="e.g. Discovery Park"
                placeholderTextColor="rgba(255,255,255,0.4)"
              />

              <ThemedText style={styles.inputLabel}>Inferred Activity Type</ThemedText>
              <TextInput
                style={styles.textInput}
                value={editActivity}
                onChangeText={setEditActivity}
                placeholder="e.g. Walking / Jogging"
                placeholderTextColor="rgba(255,255,255,0.4)"
              />

              <ThemedText style={styles.inputLabel}>Stay Duration (Minutes)</ThemedText>
              <TextInput
                style={styles.textInput}
                value={editDuration}
                onChangeText={setEditDuration}
                keyboardType="numeric"
                placeholder="80"
                placeholderTextColor="rgba(255,255,255,0.4)"
              />

              <TouchableOpacity style={styles.saveEditBtn} onPress={handleSaveEdit}>
                <ThemedText style={styles.saveEditBtnText}>Apply Inferred Settings</ThemedText>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  outerContainer: {
    flex: 1,
    backgroundColor: DARK_BG,
  },

  glowCircle1: { position: 'absolute', top: 40, left: -100, width: 360, height: 360, borderRadius: 180, backgroundColor: 'rgba(143, 102, 255, 0.10)', zIndex: 0 },
  glowCircle2: { position: 'absolute', bottom: 100, right: -120, width: 380, height: 380, borderRadius: 190, backgroundColor: 'rgba(59, 130, 246, 0.08)', zIndex: 0 },
  glowCircle3: { position: 'absolute', top: '40%', right: -80, width: 300, height: 300, borderRadius: 150, backgroundColor: 'rgba(6, 182, 212, 0.07)', zIndex: 0 },

  container: {
    flex: 1,
  },
  content: {
    paddingHorizontal: 20,
    paddingTop: 60,
    paddingBottom: 130,
    gap: 20,
  },
  header: {
    marginBottom: 10,
    zIndex: 1,
  },
  headerTitle: {
    fontSize: 28,
    fontWeight: '800',
    color: '#FFF',
    lineHeight: 36,
    paddingTop: 6,
  },
  profileCard: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 20,
    borderRadius: 20,
    backgroundColor: CARD_BG,
    borderWidth: 1,
    borderColor: GLASS_BORDER,
    gap: 16,
    shadowColor: '#8F66FF',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.05,
    shadowRadius: 16,
    elevation: 3,
    ...Platform.select({
      web: {
        backdropFilter: 'blur(20px)',
        // @ts-ignore
        experimental_backdropFilter: 'blur(20px)',
      },
      default: {},
    }),
  },
  avatar: {
    width: 68,
    height: 68,
    borderRadius: 34,
    justifyContent: 'center',
    alignItems: 'center',
  },
  avatarText: {
    color: '#fff',
    fontSize: 24,
    fontWeight: '700',
  },
  userInfo: {
    justifyContent: 'center',
    flex: 1,
  },
  username: {
    fontSize: 20,
    fontWeight: '700',
    color: '#FFF',
  },
  email: {
    fontSize: 14,
    opacity: 0.6,
    color: '#FFF',
    marginTop: 2,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '700',
    opacity: 0.6,
    color: '#FFF',
    marginTop: 15,
    marginBottom: 2,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    zIndex: 1,
  },
  statsGrid: {
    flexDirection: 'row',
    gap: 12,
  },
  statBox: {
    flex: 1,
    padding: 16,
    borderRadius: 18,
    backgroundColor: CARD_BG,
    borderWidth: 1,
    borderColor: GLASS_BORDER,
    alignItems: 'center',
    gap: 6,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.03,
    shadowRadius: 8,
    elevation: 1,
    ...Platform.select({
      web: {
        backdropFilter: 'blur(15px)',
        // @ts-ignore
        experimental_backdropFilter: 'blur(15px)',
      },
      default: {},
    }),
  },
  statVal: {
    fontSize: 18,
    fontWeight: '700',
    color: '#FFF',
  },
  statLabel: {
    fontSize: 12,
    opacity: 0.6,
    color: '#FFF',
  },
  settingsList: {
    borderRadius: 18,
    backgroundColor: CARD_BG,
    borderWidth: 1,
    borderColor: GLASS_BORDER,
    paddingHorizontal: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.04,
    shadowRadius: 12,
    elevation: 2,
    ...Platform.select({
      web: {
        backdropFilter: 'blur(20px)',
        // @ts-ignore
        experimental_backdropFilter: 'blur(20px)',
      },
      default: {},
    }),
  },
  settingsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 14,
    gap: 12,
  },
  settingsLabel: {
    fontSize: 16,
    fontWeight: '600',
    color: '#FFF',
    flex: 1,
  },
  settingsSubtitle: {
    fontSize: 12,
    opacity: 0.5,
    color: '#FFF',
    marginTop: 2,
  },
  divider: {
    height: 1,
    backgroundColor: 'rgba(255, 255, 255, 0.08)',
  },
  logoutBtn: {
    flexDirection: 'row',
    height: 52,
    borderWidth: 1.5,
    borderRadius: 14,
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: 10,
    gap: 8,
  },
  logoutIcon: {
    marginRight: 4,
  },
  logoutBtnText: {
    fontSize: 16,
    fontWeight: '700',
  },

  // Absolute Position Overlay Styles (Replacing Modals)
  absoluteOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(0, 0, 0, 0.82)',
    justifyContent: 'flex-end',
    zIndex: 9999,
  },
  absoluteOverlayLarge: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: DARK_BG,
    zIndex: 10000,
  },
  locationHeaderCard: {
    paddingHorizontal: 24,
    paddingBottom: 16,
    borderBottomWidth: 1,
    borderBottomColor: GLASS_BORDER,
    backgroundColor: DARK_BG,
  },
  promptBg: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(0,0,0,0.85)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 30,
    zIndex: 20000,
  },
  editBg: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(0,0,0,0.85)',
    justifyContent: 'center',
    padding: 20,
    zIndex: 21000,
  },

  modalContent: {
    backgroundColor: CARD_BG,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    borderWidth: 1,
    borderColor: GLASS_BORDER,
    padding: 24,
    gap: 20,
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: '800',
    color: '#FFF',
  },
  modalBody: {
    gap: 14,
  },
  detailRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 8,
  },
  detailLabel: {
    fontSize: 15,
    opacity: 0.6,
    color: '#FFF',
  },
  detailValue: {
    fontSize: 15,
    fontWeight: '600',
    color: '#FFF',
  },
  innerDivider: {
    height: 1,
    backgroundColor: 'rgba(255, 255, 255, 0.06)',
  },
  switchRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 6,
  },
  switchLabel: {
    fontSize: 16,
    fontWeight: '600',
    color: '#FFF',
  },
  switchDesc: {
    fontSize: 12,
    opacity: 0.5,
    color: '#FFF',
    marginTop: 2,
  },
  infoText: {
    fontSize: 14,
    opacity: 0.6,
    color: '#FFF',
    lineHeight: 20,
    marginTop: 4,
  },
  privacyCard: {
    padding: 16,
    borderRadius: 16,
    backgroundColor: 'rgba(255,255,255,0.03)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.06)',
    gap: 8,
  },
  privacyCardTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#FFF',
    marginTop: 4,
  },
  privacyCardText: {
    fontSize: 13,
    opacity: 0.6,
    color: '#FFF',
    lineHeight: 18,
  },

  // Location Intelligence Scroll styles
  locationScroll: {
    flex: 1,
    paddingHorizontal: 24,
  },
  locationBody: {
    gap: 16,
    paddingTop: 16,
    paddingBottom: 50,
  },
  descCard: {
    padding: 16,
    borderRadius: 16,
    backgroundColor: 'rgba(143, 102, 255, 0.05)',
    borderWidth: 1,
    borderColor: 'rgba(143, 102, 255, 0.12)',
  },
  descText: {
    fontSize: 14,
    color: LIGHT_PURPLE,
    lineHeight: 20,
  },
  switchRowCard: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 18,
    borderRadius: 18,
    backgroundColor: 'rgba(255,255,255,0.03)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.07)',
  },
  switchRowLabel: {
    fontSize: 16,
    fontWeight: '700',
    color: '#FFF',
  },
  switchRowDesc: {
    fontSize: 12,
    opacity: 0.5,
    color: '#FFF',
    lineHeight: 16,
    paddingRight: 10,
  },
  inferenceBox: {
    padding: 18,
    borderRadius: 18,
    backgroundColor: 'rgba(255,255,255,0.02)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.05)',
    gap: 12,
  },
  inferenceTitle: {
    fontSize: 14,
    fontWeight: '800',
    color: PURPLE,
    letterSpacing: 0.5,
    marginBottom: 4,
  },
  inferenceItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  inferenceIcon: {
    fontSize: 20,
  },
  inferenceLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: '#FFF',
  },
  inferenceResult: {
    fontSize: 12,
    opacity: 0.5,
    color: '#FFF',
  },
  inferenceDivider: {
    height: 1,
    backgroundColor: 'rgba(255,255,255,0.04)',
  },
  frequencyCard: {
    padding: 18,
    borderRadius: 18,
    backgroundColor: 'rgba(255,255,255,0.03)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.07)',
    gap: 12,
  },
  frequencyTitle: {
    fontSize: 15,
    fontWeight: '700',
    color: '#FFF',
  },
  pillRow: {
    flexDirection: 'row',
    backgroundColor: 'rgba(255,255,255,0.05)',
    borderRadius: 12,
    padding: 4,
    gap: 4,
  },
  freqPill: {
    flex: 1,
    paddingVertical: 10,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  freqPillSelected: {
    backgroundColor: PURPLE,
  },
  freqPillText: {
    fontSize: 11,
    fontWeight: '700',
    opacity: 0.5,
    color: '#FFF',
  },
  freqPillTextSelected: {
    opacity: 1,
  },
  privacyNoticeBox: {
    flexDirection: 'row',
    padding: 14,
    backgroundColor: 'rgba(129, 199, 132, 0.05)',
    borderWidth: 1,
    borderColor: 'rgba(129, 199, 132, 0.12)',
    borderRadius: 14,
    alignItems: 'center',
    gap: 10,
  },
  privacyNoticeText: {
    fontSize: 12,
    color: GREEN,
    flex: 1,
    lineHeight: 16,
  },

  // Simulation section styles
  simulationHeader: {
    fontSize: 14,
    fontWeight: '800',
    color: AMBER,
    marginTop: 20,
    marginBottom: 4,
    letterSpacing: 0.8,
  },
  simulationCard: {
    padding: 18,
    borderRadius: 18,
    backgroundColor: 'rgba(255,183,77,0.03)',
    borderWidth: 1,
    borderColor: 'rgba(255,183,77,0.12)',
    gap: 14,
  },
  simText: {
    fontSize: 13,
    color: '#FFF',
    opacity: 0.7,
    lineHeight: 18,
  },
  simulatorBtn: {
    flexDirection: 'row',
    height: 48,
    borderRadius: 12,
    backgroundColor: AMBER,
    justifyContent: 'center',
    alignItems: 'center',
    gap: 8,
  },
  simulatorBtnDisabled: {
    backgroundColor: 'rgba(255,255,255,0.08)',
    opacity: 0.4,
  },
  simulatorBtnText: {
    fontSize: 15,
    fontWeight: '700',
    color: '#0A0C1B',
  },

  // Mock Notification styles
  mockNotificationCard: {
    padding: 16,
    borderRadius: 16,
    backgroundColor: '#1E2142',
    borderWidth: 1.5,
    borderColor: 'rgba(143, 102, 255, 0.25)',
    gap: 12,
    marginTop: 4,
  },
  mockNotifHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  mockNotifTitle: {
    fontSize: 14,
    fontWeight: '800',
    color: LIGHT_PURPLE,
    flex: 1,
  },
  mockNotifClose: {
    padding: 4,
  },
  mockNotifMsg: {
    fontSize: 14,
    color: '#FFF',
    lineHeight: 20,
  },
  mockNotifMetaRow: {
    flexDirection: 'row',
  },
  mockNotifMetaLabel: {
    fontSize: 12,
    opacity: 0.6,
    color: '#FFF',
  },
  mockActionsGrid: {
    flexDirection: 'row',
    gap: 8,
    marginTop: 4,
  },
  mockActionsGrid2: {
    flexDirection: 'row',
    gap: 8,
  },
  mockActionBtn: {
    flex: 1,
    flexDirection: 'row',
    height: 38,
    borderRadius: 10,
    backgroundColor: 'rgba(255,255,255,0.05)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.1)',
    justifyContent: 'center',
    alignItems: 'center',
    gap: 6,
  },
  mockActionBtnText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#FFF',
  },
  mockActionBtnSmall: {
    flex: 1,
    height: 34,
    borderRadius: 8,
    backgroundColor: 'transparent',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.06)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  mockActionBtnTextSmall: {
    fontSize: 12,
    color: '#FFF',
    opacity: 0.6,
  },

  dangerBtn: {
    flexDirection: 'row',
    height: 50,
    borderRadius: 14,
    backgroundColor: RED,
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: 10,
    gap: 8,
  },
  dangerBtnText: {
    fontSize: 15,
    fontWeight: '700',
    color: '#FFF',
  },

  // Permission Prompt Dialog styles
  promptBox: {
    width: '100%',
    backgroundColor: '#1E1E2E',
    borderRadius: 20,
    borderWidth: 1,
    borderColor: GLASS_BORDER,
    padding: 24,
    alignItems: 'center',
  },
  promptIconBg: {
    width: 68,
    height: 68,
    borderRadius: 34,
    backgroundColor: 'rgba(143, 102, 255, 0.1)',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 16,
  },
  promptTitle: {
    fontSize: 18,
    fontWeight: '800',
    color: '#FFF',
    textAlign: 'center',
    marginBottom: 8,
    lineHeight: 24,
  },
  promptDesc: {
    fontSize: 13,
    opacity: 0.7,
    color: '#FFF',
    textAlign: 'center',
    lineHeight: 18,
    marginBottom: 24,
  },
  promptActionBtn: {
    width: '100%',
    paddingVertical: 14,
    borderTopWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
    alignItems: 'center',
  },
  promptActionText: {
    fontSize: 16,
    fontWeight: '700',
    color: PURPLE,
  },

  // Edit Card styles
  editCard: {
    backgroundColor: CARD_BG,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: GLASS_BORDER,
    padding: 20,
  },
  editHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  editTitle: {
    fontSize: 18,
    fontWeight: '800',
    color: '#FFF',
  },
  editBody: {
    gap: 12,
  },
  inputLabel: {
    fontSize: 13,
    fontWeight: '600',
    color: LIGHT_PURPLE,
  },
  textInput: {
    height: 46,
    borderRadius: 10,
    backgroundColor: 'rgba(255,255,255,0.05)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.1)',
    color: '#FFF',
    paddingHorizontal: 12,
    fontSize: 14,
  },
  saveEditBtn: {
    height: 48,
    borderRadius: 12,
    backgroundColor: PURPLE,
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: 10,
  },
  saveEditBtnText: {
    fontSize: 15,
    fontWeight: '700',
    color: '#FFF',
  },
});
