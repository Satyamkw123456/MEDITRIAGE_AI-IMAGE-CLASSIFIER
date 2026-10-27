'use client';

import React, { createContext, useContext, useEffect, useState } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import { apiClient, User, LoginPayload, RegisterPayload, getCsrfToken } from '@/lib/api/client';

interface AuthContextType {
  user: User | null;
  token: string | null;
  isLoading: boolean;
  isAuthenticated: boolean;
  login: (payload: LoginPayload) => Promise<void>;
  register: (payload: RegisterPayload) => Promise<void>;
  logout: () => Promise<void> | void;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const router = useRouter();
  const pathname = usePathname();

  // Extract locale from pathname (e.g. /en/login -> en)
  const getLocalePrefix = () => {
    const segments = pathname.split('/');
    const locale = segments[1];
    if (['en', 'hi', 'mr'].includes(locale)) {
      return `/${locale}`;
    }
    return '/en';
  };

  useEffect(() => {
    const initAuth = async () => {
      const storedToken = localStorage.getItem('meditriage_token');
      if (storedToken) {
        setToken(storedToken);
        try {
          const currentUser = await apiClient.fetch('/api/v1/auth/me', 'get');
          setUser(currentUser);
        } catch (err) {
          console.warn('Session expired or invalid token:', err);
          localStorage.removeItem('meditriage_token');
          setToken(null);
          setUser(null);
        }
      }
      setIsLoading(false);
    };

    initAuth();
  }, []);

  const login = async (payload: LoginPayload) => {
    setIsLoading(true);
    try {
      const res = await apiClient.fetch('/api/v1/auth/login', 'post', { body: payload });
      localStorage.setItem('meditriage_token', res.access_token);
      setToken(res.access_token);
      setUser(res.user);

      const localePrefix = getLocalePrefix();
      // Route by role
      if (res.user.role === 'clinician') {
        router.push(`${localePrefix}/dashboard/clinician`);
      } else if (res.user.role === 'admin') {
        router.push(`${localePrefix}/dashboard/admin`);
      } else {
        router.push(`${localePrefix}/dashboard/patient`);
      }
    } finally {
      setIsLoading(false);
    }
  };

  const register = async (payload: RegisterPayload) => {
    setIsLoading(true);
    try {
      const res = await apiClient.fetch('/api/v1/auth/register', 'post', { body: payload });
      localStorage.setItem('meditriage_token', res.access_token);
      setToken(res.access_token);
      setUser(res.user);

      const localePrefix = getLocalePrefix();
      if (res.user.role === 'clinician') {
        router.push(`${localePrefix}/dashboard/clinician`);
      } else if (res.user.role === 'admin') {
        router.push(`${localePrefix}/dashboard/admin`);
      } else {
        router.push(`${localePrefix}/dashboard/patient`);
      }
    } finally {
      setIsLoading(false);
    }
  };

  const logout = async () => {
    try {
      const csrfToken = getCsrfToken();
      const headers: Record<string, string> = {
        'Content-Type': 'application/json',
      };
      if (csrfToken) {
        headers['X-CSRF-Token'] = csrfToken;
      }
      const currentToken = localStorage.getItem('meditriage_token') || token;
      if (currentToken) {
        headers['Authorization'] = `Bearer ${currentToken}`;
      }

      await fetch('/api/v1/auth/logout', {
        method: 'POST',
        headers,
        credentials: 'include',
      });
    } catch {
      // Ignore network errors
    } finally {
      localStorage.removeItem('meditriage_token');
      setToken(null);
      setUser(null);
      const localePrefix = getLocalePrefix();
      router.push(`${localePrefix}/login`);
    }
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        token,
        isLoading,
        isAuthenticated: !!user,
        login,
        register,
        logout,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};

