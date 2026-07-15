import React, { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react';
import * as authApi from './authApi';
import type { UserOut } from './authApi';
import { setAccessToken, setRefreshHandler } from '../lib/httpClient';

// Set only on successful login/signup, cleared on logout. Its sole purpose
// is to gate the one-time silent-refresh check below: a user who has never
// logged in (or explicitly logged out) must never trigger a single /api
// call — local mode has to stay fully offline for that population. Without
// this flag, checking "is there a valid session" on every boot would itself
// be a network call for every anonymous visitor.
const AUTH_FLAG_KEY = 'wallProjectorAuth.v1';

interface AuthState {
  user: UserOut | null;
  ready: boolean;
  login: (email: string, password: string) => Promise<void>;
  signup: (email: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
}

const AuthContext = createContext<AuthState | null>(null);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<UserOut | null>(null);
  const [ready, setReady] = useState(false);
  const initedRef = useRef(false);

  const applyToken = useCallback(async (token: string) => {
    setAccessToken(token);
    const u = await authApi.me();
    setUser(u);
    localStorage.setItem(AUTH_FLAG_KEY, '1');
  }, []);

  useEffect(() => {
    setRefreshHandler(async () => {
      try {
        const res = await authApi.refresh();
        setAccessToken(res.access_token);
        return res.access_token;
      } catch {
        setAccessToken(null);
        setUser(null);
        localStorage.removeItem(AUTH_FLAG_KEY);
        return null;
      }
    });
    return () => setRefreshHandler(null);
  }, []);

  useEffect(() => {
    if (initedRef.current) return;
    initedRef.current = true;
    if (localStorage.getItem(AUTH_FLAG_KEY) !== '1') {
      // Never logged in (or explicitly logged out) on this browser — skip
      // the silent-refresh check entirely so local mode makes zero /api calls.
      setReady(true);
      return;
    }
    (async () => {
      try {
        const res = await authApi.refresh();
        await applyToken(res.access_token);
      } catch {
        localStorage.removeItem(AUTH_FLAG_KEY);
      } finally {
        setReady(true);
      }
    })();
  }, [applyToken]);

  const login = useCallback(
    async (email: string, password: string) => {
      const res = await authApi.login(email, password);
      await applyToken(res.access_token);
    },
    [applyToken],
  );

  const signup = useCallback(
    async (email: string, password: string) => {
      const res = await authApi.signup(email, password);
      await applyToken(res.access_token);
    },
    [applyToken],
  );

  const logout = useCallback(async () => {
    await authApi.logout().catch(() => {});
    setAccessToken(null);
    setUser(null);
    localStorage.removeItem(AUTH_FLAG_KEY);
  }, []);

  return <AuthContext.Provider value={{ user, ready, login, signup, logout }}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthState {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}
