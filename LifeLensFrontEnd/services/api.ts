import { Platform } from 'react-native';
import * as SecureStore from 'expo-secure-store';

// Helper to determine API URL
// In Android emulator, localhost is 10.0.2.2. In iOS, it is localhost.
const getBaseUrl = () => {
  // Using the local development machine's IP address (10.0.0.142)
  // allows both simulators and physical devices on the same Wi-Fi network to connect
  return 'http://10.0.0.142:8000';
};

const BASE_URL = getBaseUrl();

export interface UserResponse {
  id: string;
  full_name: string;
  email: string;
  created_at: string;
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
};
