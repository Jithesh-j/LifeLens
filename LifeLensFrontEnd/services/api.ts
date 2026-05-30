import { Platform } from 'react-native';
import * as SecureStore from 'expo-secure-store';
import Constants from 'expo-constants';

// Helper to determine API URL
// In Android emulator, localhost is 10.0.2.2. In iOS, it is localhost.
const getBaseUrl = () => {
  if (Platform.OS === 'web' && typeof window !== 'undefined') {
    // Dynamically match the web browser's hostname (e.g. localhost or local IP)
    return `http://${window.location.hostname}:8000`;
  }
  
  // For native (iOS/Android), try to get the host machine's IP dynamically from Metro's hostUri
  const hostUri = Constants.expoConfig?.hostUri; // e.g. "10.0.0.142:8081"
  if (hostUri) {
    const ip = hostUri.split(':')[0];
    console.log('📡 [API] Resolved Host IP from Expo Constants:', ip);
    return `http://${ip}:8000`;
  }
  
  // Hardcoded fallback for the user's specific development machine IP if Metro is offline
  const fallbackIp = '10.0.0.142'; 
  console.log('📡 [API] Metro hostUri not found. Using development IP fallback:', fallbackIp);
  
  if (Platform.OS === 'android') {
    return 'http://10.0.2.2:8000'; // Standard Android emulator loopback
  }
  return `http://${fallbackIp}:8000`;
};

const BASE_URL = getBaseUrl();

export interface UserResponse {
  id: string;
  full_name: string;
  email: string;
  created_at: string;
}

export interface UserSettingsResponse {
  id: string;
  user_id: string;
  location_enabled: boolean;
  smart_activity_detection: boolean;
  smart_notifications: boolean;
  weather_on_timeline: boolean;
  notification_frequency: string;
  created_at: string;
  updated_at: string;
}

export interface UserSettingsUpdate {
  location_enabled?: boolean;
  smart_activity_detection?: boolean;
  smart_notifications?: boolean;
  weather_on_timeline?: boolean;
  notification_frequency?: string;
}

export interface LoginResponse {
  access_token: string;
  token_type: string;
}

const getErrorMessage = (errData: any, defaultMsg: string): string => {
  if (!errData || !errData.detail) return defaultMsg;
  if (typeof errData.detail === 'string') return errData.detail;
  if (Array.isArray(errData.detail)) {
    return errData.detail.map((err: any) => `${err.loc?.[err.loc.length - 1] || 'field'}: ${err.msg}`).join(', ');
  }
  return JSON.stringify(errData.detail);
};

export interface ActivityResponse {
  id: string;
  content: string;
  category: string | null;
  mood: string | null;
  tags: string | null;
  logged_at: string;
  created_at: string;
}

export interface ActivityListResponse {
  activities: ActivityResponse[];
  total: number;
  page: number;
  page_size: number;
}

export const api = {
  // Common headers builder
  async getHeaders(includeAuth = true) {
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
    };

    if (includeAuth) {
      const token = await SecureStore.getItemAsync('user_token');
      if (token) {
        headers['Authorization'] = `Bearer ${token}`;
      }
    }

    return headers;
  },

  // Auth: Register
  async register(username: string, email: string, password: string): Promise<LoginResponse> {
    const response = await fetch(`${BASE_URL}/api/auth/register`, {
      method: 'POST',
      headers: await this.getHeaders(false),
      body: JSON.stringify({ email, password, full_name: username }),
    });

    if (!response.ok) {
      const errData = await response.json().catch(() => ({ detail: 'Registration failed' }));
      throw new Error(getErrorMessage(errData, 'Registration failed'));
    }

    return response.json();
  },

  // Auth: Login (uses OAuth2 Password flow / Form-urlencoded)
  async login(email: string, password: string): Promise<LoginResponse> {
    const response = await fetch(`${BASE_URL}/api/auth/login`, {
      method: 'POST',
      headers: await this.getHeaders(false),
      body: JSON.stringify({ email, password }),
    });

    if (!response.ok) {
      const errData = await response.json().catch(() => ({ detail: 'Invalid credentials' }));
      throw new Error(getErrorMessage(errData, 'Invalid credentials'));
    }

    return response.json();
  },

  // Get current user profile
  async getMe(): Promise<UserResponse> {
    const headers = await this.getHeaders(true);
    const response = await fetch(`${BASE_URL}/api/auth/me`, {
      method: 'GET',
      headers,
    });

    if (!response.ok) {
      throw new Error('Failed to fetch user profile');
    }

    return response.json();
  },

  // Get Activities
  async getActivities(page = 1, pageSize = 50): Promise<ActivityListResponse> {
    const headers = await this.getHeaders(true);
    const response = await fetch(`${BASE_URL}/api/activities?page=${page}&page_size=${pageSize}`, {
      method: 'GET',
      headers,
    });

    if (!response.ok) {
      throw new Error('Failed to fetch activities');
    }

    return response.json();
  },

  // Create / Log Activity
  async createActivity(content: string, logged_at?: string): Promise<ActivityResponse> {
    const headers = await this.getHeaders(true);
    const response = await fetch(`${BASE_URL}/api/activities`, {
      method: 'POST',
      headers,
      body: JSON.stringify({ content, logged_at }),
    });

    if (!response.ok) {
      const errData = await response.json().catch(() => ({ detail: 'Failed to create activity' }));
      throw new Error(getErrorMessage(errData, 'Failed to create activity'));
    }

    return response.json();
  },

  // Transcribe Audio using FormData
  async transcribeAudio(uri: string, filename = 'recording.mp4'): Promise<{ transcript: string }> {
    const headers = await this.getHeaders(true);
    
    // EXTREMELY IMPORTANT: In React Native, FormData requests require removing 
    // Content-Type from manual headers so the fetch engine automatically generates 
    // the correct boundary!
    delete headers['Content-Type'];

    const formData = new FormData();
    
    console.log('🎙️ --- API TRANSCRIBE AUDIO START ---');
    console.log('   Platform.OS:', Platform.OS);
    console.log('   Input URI:', uri);
    console.log('   Input Filename:', filename);

    if (Platform.OS === 'web') {
      try {
        console.log('   [Web] Fetching blob from local blob URI:', uri);
        const responseBlob = await fetch(uri);
        const blob = await responseBlob.blob();
        console.log('   [Web] Blob fetched successfully. Size:', blob.size, 'bytes. Type:', blob.type);
        
        // Append as a Blob with a filename
        formData.append('file', blob, filename);
      } catch (err) {
        console.error('   [Web] Error reading blob from URI:', err);
        throw new Error('Failed to read recorded audio blob on Web.');
      }
    } else {
      // In React Native, FormData is appended with an object containing uri, name, and type.
      // Ensure file:// prefix is handled correctly.
      // On some platforms, keeping file:// is required; on others, we might need to normalize it.
      let cleanUri = uri;
      if (Platform.OS === 'ios' && !cleanUri.startsWith('file://')) {
        cleanUri = `file://${cleanUri}`;
      }
      
      console.log('   [Native] Appending file to FormData. Clean URI:', cleanUri);
      
      // Determine file extension and MIME type
      const extension = cleanUri.split('.').pop() || 'mp4';
      let mimeType = 'audio/mp4';
      if (extension === 'm4a') mimeType = 'audio/m4a';
      else if (extension === 'wav') mimeType = 'audio/wav';
      else if (extension === '3gp') mimeType = 'audio/3gpp';
      else if (extension === 'caf') mimeType = 'audio/x-caf';
      
      formData.append('file', {
        uri: cleanUri,
        name: filename || `recording.${extension}`,
        type: mimeType,
      } as any);
    }

    console.log('📡 Sending request to backend transcribe API...');
    console.log('   BASE_URL:', BASE_URL);

    const response = await fetch(`${BASE_URL}/api/activities/transcribe`, {
      method: 'POST',
      headers,
      body: formData,
    });

    console.log('📡 Transcribe API Response Status:', response.status);

    if (!response.ok) {
      const errText = await response.text();
      console.error('❌ Transcribe API Error Response:', errText);
      let errData;
      try {
        errData = JSON.parse(errText);
      } catch (e) {
        errData = { detail: 'Failed to transcribe audio: ' + errText };
      }
      throw new Error(getErrorMessage(errData, 'Failed to transcribe audio'));
    }

    const result = await response.json();
    console.log('✅ Transcribe API Success:', result);
    return result;
  },

  // Get User Settings
  async getUserSettings(): Promise<UserSettingsResponse> {
    const headers = await this.getHeaders(true);
    const response = await fetch(`${BASE_URL}/api/settings`, {
      method: 'GET',
      headers,
    });

    if (!response.ok) {
      throw new Error('Failed to fetch user settings');
    }

    return response.json();
  },

  // Update User Settings
  async updateUserSettings(payload: UserSettingsUpdate): Promise<UserSettingsResponse> {
    const headers = await this.getHeaders(true);
    const response = await fetch(`${BASE_URL}/api/settings`, {
      method: 'PUT',
      headers,
      body: JSON.stringify(payload),
    });

    if (!response.ok) {
      const errData = await response.json().catch(() => ({ detail: 'Failed to update user settings' }));
      throw new Error(getErrorMessage(errData, 'Failed to update user settings'));
    }

    return response.json();
  },

  // Get User-Isolated Weather
  async getWeather(latitude: number | null, longitude: number | null, timestamp: string): Promise<{
    status: 'ok' | 'location_unavailable';
    latitude?: number;
    longitude?: number;
    temperature_c?: number;
    temperature_f?: number;
    weathercode?: number;
    wind_speed?: number;
    humidity?: number;
    timestamp?: string;
    user_id?: string;
    fetched_at?: string;
  }> {
    const headers = await this.getHeaders(true);
    let url = `${BASE_URL}/api/weather?timestamp=${encodeURIComponent(timestamp)}`;
    if (latitude !== null) url += `&latitude=${latitude}`;
    if (longitude !== null) url += `&longitude=${longitude}`;

    const response = await fetch(url, {
      method: 'GET',
      headers,
    });

    if (!response.ok) {
      throw new Error('Failed to fetch weather from backend');
    }

    return response.json();
  },

  // Get Suggestions
  async getSuggestions(scheduleItems: any[], forceRefresh = false): Promise<SuggestionsResponse> {
    const headers = await this.getHeaders(true);
    const response = await fetch(`${BASE_URL}/api/insights/suggestions?refresh=${forceRefresh}`, {
      method: 'POST',
      headers,
      body: JSON.stringify({
        schedule_items: scheduleItems.map((item) => ({
          title: item.title || '',
          timeRange: item.timeRange || '',
          category: item.category || 'other',
          date: item.date || '',
          startTime: item.startTime || '',
          endTime: item.endTime || '',
          location: item.location || null,
          weather: item.weather || null,
        })),
      }),
    });

    if (!response.ok) {
      const errData = await response.json().catch(() => ({ detail: 'Failed to fetch suggestions' }));
      throw new Error(getErrorMessage(errData, 'Failed to fetch suggestions'));
    }

    return response.json();
  },
};

export interface SuggestionItemResponse {
  id: string;
  title: string;
  recommendation: string;
  evidence: string;
  confidence: number;
  category: string;
  icon: string;
  suggested_time: string;
}

export interface SuggestionsResponse {
  suggestions: SuggestionItemResponse[];
}


