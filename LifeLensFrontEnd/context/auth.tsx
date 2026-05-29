import React, { createContext, useContext, useState, useEffect } from 'react';
import * as SecureStore from 'expo-secure-store';
import { api, UserResponse } from '@/services/api';
import { useRouter, useSegments } from 'expo-router';

interface AuthContextType {
  user: UserResponse | null;
  token: string | null;
  isLoading: boolean;
  login: (email: string, password: string) => Promise<void>;
  register: (username: string, email: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | null>(null);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<UserResponse | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const router = useRouter();
  const segments = useSegments();

  // Load token on mount
  useEffect(() => {
    async function loadToken() {
      try {
        const cachedToken = await SecureStore.getItemAsync('user_token');
        if (cachedToken) {
          setToken(cachedToken);
          // Verify token and fetch profile
          const profile = await api.getMe();
          setUser(profile);
        }
      } catch (e) {
        console.warn('Failed to load auth token', e);
        // Clear corrupt token
        await SecureStore.deleteItemAsync('user_token');
      } finally {
        setIsLoading(false);
      }
    }
    loadToken();
  }, []);

  // Protected route navigation guard
  useEffect(() => {
    if (isLoading) return;

    const inAuthGroup = segments[0] === '(auth)';

    if (!token && !inAuthGroup) {
      // Redirect to login
      router.replace('/(auth)/login');
    } else if (token && inAuthGroup) {
      // Redirect to home screen
      router.replace('/(tabs)');
    }
  }, [token, segments, isLoading]);

  const login = async (email: string, password: string) => {
    setIsLoading(true);
    try {
      const res = await api.login(email, password);
      await SecureStore.setItemAsync('user_token', res.access_token);
      setToken(res.access_token);
      
      const profile = await api.getMe();
      setUser(profile);
    } catch (e) {
      setIsLoading(false);
      throw e;
    } finally {
      setIsLoading(false);
    }
  };

  const register = async (username: string, email: string, password: string) => {
    setIsLoading(true);
    try {
      const res = await api.register(username, email, password);
      await SecureStore.setItemAsync('user_token', res.access_token);
      setToken(res.access_token);

      const profile = await api.getMe();
      setUser(profile);
    } catch (e) {
      setIsLoading(false);
      throw e;
    } finally {
      setIsLoading(false);
    }
  };

  const logout = async () => {
    setIsLoading(true);
    try {
      await SecureStore.deleteItemAsync('user_token');
      setToken(null);
      setUser(null);
    } catch (e) {
      console.error(e);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <AuthContext.Provider value={{ user, token, isLoading, login, register, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
