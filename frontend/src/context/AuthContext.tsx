'use client';

import { createContext, useContext, useEffect, useState, ReactNode, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { authApi } from '@/lib/api';
import { auth } from '@/lib/auth';
import type { User, AuthResponse } from '@/types';

interface AuthContextType {
  user: User | null;
  token: string | null;
  loading: boolean;
  isAuthenticated: boolean;
  isManager: boolean;
  login: (email: string) => Promise<void>;
  signup: (data: { email: string; name: string; phone?: string }) => Promise<void>;
  logout: () => Promise<void>;
  refreshUser: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const router = useRouter();
  const [user, setUser]       = useState<User | null>(null);
  const [token, setToken]     = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  // Rehydrate from storage on mount
  useEffect(() => {
    const storedToken = auth.getToken();
    const storedUser  = auth.getUser();
    if (storedToken && storedUser) {
      setToken(storedToken);
      setUser(storedUser);
    }
    setLoading(false);
  }, []);

  const login = useCallback(async (email: string) => {
    const { data } = await authApi.login({ email }) as { data: AuthResponse };
    // Clear any previous user's cached orders before setting new session
    if (typeof window !== 'undefined') {
      localStorage.removeItem('olly_recent_orders');
      localStorage.removeItem('olly_guest_cart');
    }
    auth.setToken(data.token);
    auth.setUser(data.user);
    setToken(data.token);
    setUser(data.user);

    const dest = ['manager', 'admin', 'staff'].includes(data.user.role)
      ? '/dashboard/admin'
      : '/shop';
    router.push(dest);
  }, [router]);

  const signup = useCallback(async (payload: { email: string; name: string; phone?: string }) => {
    const { data } = await authApi.signup(payload) as { data: AuthResponse };
    // Clear any previous user's cached orders on new account creation
    if (typeof window !== 'undefined') {
      localStorage.removeItem('olly_recent_orders');
    }
    auth.setToken(data.token);
    auth.setUser(data.user);
    setToken(data.token);
    setUser(data.user);
    router.push('/shop');
  }, [router]);

  const logout = useCallback(async () => {
    try { await authApi.logout(); } catch { /* stateless JWT — noop is fine */ }
    auth.clear();
    setToken(null);
    setUser(null);
    router.push('/login');
  }, [router]);

  const refreshUser = useCallback(async () => {
    try {
      const { data } = await authApi.me() as { data: User };
      auth.setUser(data);
      setUser(data);
    } catch {
      logout();
    }
  }, [logout]);

  const isManager = ['manager', 'admin', 'staff'].includes(user?.role ?? '');

  return (
    <AuthContext.Provider
      value={{ user, token, loading, isAuthenticated: !!token, isManager, login, signup, logout, refreshUser }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth(): AuthContextType {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used inside <AuthProvider>');
  return ctx;
}
