import React, { createContext, useContext, useState, useEffect } from 'react';
import axios from 'axios';
import { API_BASE_URL } from '../constants/Config';

interface User {
  id: string;
  email: string;
  role: 'customer' | 'admin' | 'rider';
  name?: string;
}

interface AuthContextType {
  user: User | null;
  token: string | null;
  loading: boolean;
  login: (email: string, password: string) => Promise<void>;
  signup: (email: string, password: string, name: string) => Promise<void>;
  logout: () => Promise<void>;
  isAdmin: boolean;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

// Safe storage wrapper — handles Web (localStorage) and Native (AsyncStorage)
let _storage: any = null;
const getStorage = async () => {
  if (_storage) return _storage;
  
  // Try Native AsyncStorage first
  try {
    const mod = require('@react-native-async-storage/async-storage');
    _storage = mod.default || mod;
    if (_storage) return _storage;
  } catch (e) {}

  // Fallback to Web localStorage if available
  if (typeof window !== 'undefined' && window.localStorage) {
    _storage = {
      getItem: (key: string) => Promise.resolve(window.localStorage.getItem(key)),
      setItem: (key: string, value: string) => {
        window.localStorage.setItem(key, value);
        return Promise.resolve();
      },
      removeItem: (key: string) => {
        window.localStorage.removeItem(key);
        return Promise.resolve();
      },
    };
    return _storage;
  }
  
  return null;
};

const safeGet = async (key: string): Promise<string | null> => {
  try {
    const s = await getStorage();
    return s ? await s.getItem(key) : null;
  } catch {
    return null;
  }
};

const safeSet = async (key: string, value: string) => {
  try {
    const s = await getStorage();
    if (s) await s.setItem(key, value);
  } catch {}
};

const safeRemove = async (key: string) => {
  try {
    const s = await getStorage();
    if (s) await s.removeItem(key);
  } catch {}
};

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadStorageData();
  }, []);

  async function loadStorageData() {
    try {
      const storedToken = await safeGet('auth_token');
      const storedUser = await safeGet('auth_user');
      if (storedToken && storedUser) {
        setToken(storedToken);
        setUser(JSON.parse(storedUser));
      }
    } catch (e) {
      console.log('[Auth] Could not load saved session');
    } finally {
      setLoading(false);
    }
  }

  const login = async (email: string, password: string) => {
    console.log('[Auth] Logging in to:', `${API_BASE_URL}/auth/login`);
    const response = await axios.post(
      `${API_BASE_URL}/auth/login`,
      { email, password },
      { timeout: 10000 }
    );
    const { token: t, user: u } = response.data;
    setToken(t);
    setUser(u);
    await safeSet('auth_token', t);
    await safeSet('auth_user', JSON.stringify(u));
  };

  const signup = async (email: string, password: string, name: string) => {
    console.log('[Auth] Signing up to:', `${API_BASE_URL}/auth/signup`);
    const response = await axios.post(
      `${API_BASE_URL}/auth/signup`,
      { email, password, name },
      { timeout: 10000 }
    );
    const { token: t, user: u } = response.data;
    setToken(t);
    setUser(u);
    await safeSet('auth_token', t);
    await safeSet('auth_user', JSON.stringify(u));
  };

  const logout = async () => {
    setToken(null);
    setUser(null);
    await safeRemove('auth_token');
    await safeRemove('auth_user');
  };

  const isAdmin = user?.role === 'admin';

  return (
    <AuthContext.Provider value={{ user, token, loading, login, signup, logout, isAdmin }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be inside AuthProvider');
  return ctx;
};
