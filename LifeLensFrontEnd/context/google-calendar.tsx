import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import * as AuthSession from 'expo-auth-session';
import * as WebBrowser from 'expo-web-browser';
import { Platform } from 'react-native';
import * as SecureStore from 'expo-secure-store';
import Constants from 'expo-constants';
import { useAuth } from '@/context/auth';

WebBrowser.maybeCompleteAuthSession();

// Google OAuth configuration
// NOTE: Google blocks iOS Client IDs from being used in Expo Go or Web environments.
// - If running in Expo Go or Web, we MUST use a "Web Client ID" with redirect URI https://auth.expo.io
// - If running in a standalone native build, use your "iOS Client ID".
const GOOGLE_IOS_CLIENT_ID = '1084654255171-t5jics8ngc7l6ipvq6todt63hsnhif9a.apps.googleusercontent.com';
const GOOGLE_WEB_CLIENT_ID = '1084654255171-js0kpcdqe52pv4jq9fs5389dfk92uhdl.apps.googleusercontent.com';

const GOOGLE_CLIENT_ID = Platform.select({
  ios: Constants.executionEnvironment === 'storeClient' || Constants.appOwnership === 'expo' ? GOOGLE_WEB_CLIENT_ID : GOOGLE_IOS_CLIENT_ID,
  default: GOOGLE_WEB_CLIENT_ID,
});

const discovery = {
  authorizationEndpoint: 'https://accounts.google.com/o/oauth2/v2/auth',
  tokenEndpoint: 'https://oauth2.googleapis.com/token',
  revocationEndpoint: 'https://oauth2.googleapis.com/revoke',
};

export interface GoogleCalendarEvent {
  id: string;
  title: string;
  startTime: string; // ISO string
  endTime: string;   // ISO string
  location?: string;
  isAllDay: boolean;
  source: 'google';
}

interface GoogleCalendarContextType {
  googleEvents: GoogleCalendarEvent[];
  isSignedIn: boolean;
  isLoading: boolean;
  signIn: () => Promise<void>;
  signOut: () => Promise<void>;
  refreshEvents: () => Promise<void>;
  createEvent: (title: string, startTime: string, endTime: string) => Promise<boolean>;
}

const GoogleCalendarContext = createContext<GoogleCalendarContextType | null>(null);

const GOOGLE_TOKEN_KEY = 'google_calendar_token';

// Helper to get today's date boundaries in ISO format
function getTodayBounds() {
  const now = new Date();
  const startOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const endOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1);
  return {
    timeMin: startOfDay.toISOString(),
    timeMax: endOfDay.toISOString(),
  };
}

// Parse Google Calendar API events response
function parseGoogleEvents(items: any[]): GoogleCalendarEvent[] {
  if (!items || !Array.isArray(items)) return [];
  
  return items
    .filter((item: any) => item.status !== 'cancelled')
    .map((item: any) => {
      const isAllDay = !!item.start?.date;
      const startTime = item.start?.dateTime || `${item.start?.date}T00:00:00`;
      const endTime = item.end?.dateTime || `${item.end?.date}T23:59:59`;

      return {
        id: item.id || String(Math.random()),
        title: item.summary || 'Untitled Event',
        startTime,
        endTime,
        location: item.location,
        isAllDay,
        source: 'google' as const,
      };
    })
    .sort((a, b) => new Date(a.startTime).getTime() - new Date(b.startTime).getTime());
}

export function GoogleCalendarProvider({ children }: { children: React.ReactNode }) {
  const [googleEvents, setGoogleEvents] = useState<GoogleCalendarEvent[]>([]);
  const [accessToken, setAccessToken] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const { user } = useAuth();

  const userTokenKey = user ? `${user.id}_google_calendar_token` : null;

  const owner = Constants.expoConfig?.owner || 'anonymous';
  const slug = Constants.expoConfig?.slug || 'LifeLens';

  const redirectUri = Constants.executionEnvironment === 'storeClient' || Constants.appOwnership === 'expo'
    ? `https://auth.expo.io/@${owner}/${slug}`
    : AuthSession.makeRedirectUri({
        scheme: 'lifelens',
      });

  useEffect(() => {
    console.log("🔗 [Google Calendar] Dynamic Redirect URI:", redirectUri);
  }, [redirectUri]);

  const [request, response, promptAsync] = AuthSession.useAuthRequest(
    {
      clientId: GOOGLE_CLIENT_ID,
      scopes: ['https://www.googleapis.com/auth/calendar.readonly'],
      redirectUri,
      responseType: AuthSession.ResponseType.Code,
    },
    discovery,
  );

  // Load cached token on mount or when user shifts
  useEffect(() => {
    async function loadToken() {
      if (!userTokenKey) {
        setAccessToken(null);
        setGoogleEvents([]);
        return;
      }
      try {
        const cachedToken = await SecureStore.getItemAsync(userTokenKey);
        if (cachedToken) {
          setAccessToken(cachedToken);
        } else {
          setAccessToken(null);
          setGoogleEvents([]);
        }
      } catch (e) {
        console.warn('Failed to load Google Calendar token', e);
        setAccessToken(null);
        setGoogleEvents([]);
        if (userTokenKey) {
          await SecureStore.deleteItemAsync(userTokenKey).catch(() => {});
        }
      }
    }
    loadToken();
  }, [userTokenKey]);

  // Handle auth response
  useEffect(() => {
    async function handleResponse() {
      if (response?.type === 'success') {
        let token = response.authentication?.accessToken;

        if (response.params?.code) {
          try {
            const tokenResult = await AuthSession.exchangeCodeAsync(
              {
                clientId: GOOGLE_CLIENT_ID,
                code: response.params.code,
                redirectUri,
                extraParams: {
                  code_verifier: request?.codeVerifier || '',
                },
              },
              discovery
            );
            token = tokenResult.accessToken;
          } catch (e) {
            console.warn('Failed to exchange Google Calendar OAuth code:', e);
          }
        }

        if (token) {
          setAccessToken(token);
          if (userTokenKey) {
            SecureStore.setItemAsync(userTokenKey, token).catch(console.warn);
          }
        }
      }
    }
    handleResponse();
  }, [response, request, redirectUri, userTokenKey]);

  // Auto-fetch events when we have a token
  useEffect(() => {
    if (accessToken) {
      fetchEvents(accessToken);
    }
  }, [accessToken]);

  const fetchEvents = useCallback(async (token: string) => {
    setIsLoading(true);
    try {
      const { timeMin, timeMax } = getTodayBounds();
      const url = `https://www.googleapis.com/calendar/v3/calendars/primary/events?timeMin=${encodeURIComponent(timeMin)}&timeMax=${encodeURIComponent(timeMax)}&singleEvents=true&orderBy=startTime`;
      
      const res = await fetch(url, {
        headers: { Authorization: `Bearer ${token}` },
      });

      if (res.status === 401) {
        console.log('Google Calendar token expired, clearing...');
        setAccessToken(null);
        if (userTokenKey) {
          await SecureStore.deleteItemAsync(userTokenKey).catch(() => {});
        }
        setGoogleEvents([]);
        return;
      }

      if (!res.ok) {
        console.warn('Google Calendar API error:', res.status);
        return;
      }

      const data = await res.json();
      const events = parseGoogleEvents(data.items);
      setGoogleEvents(events);
    } catch (e) {
      console.warn('Failed to fetch Google Calendar events', e);
    } finally {
      setIsLoading(false);
    }
  }, [userTokenKey]);

  const signIn = useCallback(async () => {
    if (!request) return;
    try {
      await promptAsync();
    } catch (e) {
      console.warn('Google sign-in failed', e);
    }
  }, [request, promptAsync]);

  const signOut = useCallback(async () => {
    try {
      if (accessToken) {
        await AuthSession.revokeAsync(
          { token: accessToken },
          discovery,
        );
      }
    } catch (e) {
      console.warn('Token revocation failed', e);
    }
    setAccessToken(null);
    setGoogleEvents([]);
    if (userTokenKey) {
      await SecureStore.deleteItemAsync(userTokenKey).catch(console.warn);
    }
  }, [accessToken, userTokenKey]);

  const createEvent = useCallback(async (title: string, startTime: string, endTime: string): Promise<boolean> => {
    if (!accessToken) return false;
    try {
      const res = await fetch(`https://www.googleapis.com/calendar/v3/calendars/primary/events`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${accessToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          summary: title,
          start: {
            dateTime: startTime,
            timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC',
          },
          end: {
            dateTime: endTime,
            timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC',
          },
        }),
      });

      if (res.ok) {
        console.log('✅ Google Calendar event created successfully!');
        await fetchEvents(accessToken); // refresh events list!
        return true;
      } else {
        console.warn('❌ Failed to create Google Calendar event:', await res.text());
        return false;
      }
    } catch (e) {
      console.warn('⚠️ Error creating Google Calendar event:', e);
      return false;
    }
  }, [accessToken, fetchEvents]);

  const refreshEvents = useCallback(async () => {
    if (accessToken) {
      await fetchEvents(accessToken);
    }
  }, [accessToken, fetchEvents]);

  return (
    <GoogleCalendarContext.Provider
      value={{
        googleEvents,
        isSignedIn: !!accessToken,
        isLoading,
        signIn,
        signOut,
        refreshEvents,
        createEvent,
      }}>
      {children}
    </GoogleCalendarContext.Provider>
  );
}

export function useGoogleCalendar() {
  const context = useContext(GoogleCalendarContext);
  if (!context) {
    throw new Error('useGoogleCalendar must be used within a GoogleCalendarProvider');
  }
  return context;
}
