import React, { createContext, useContext, useEffect, useState, useCallback } from 'react';
import { login as doLogin, logout as doLogout, verifySession } from '@/lib/auth.js';
import { ipc } from '@/lib/ipc.js';

const Ctx = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [configError, setConfigError] = useState(false);

  const refresh = useCallback(async () => {
    setLoading(true);
    try {
      const res = await verifySession();
      setUser(res.ok ? res.user : null);
    } catch (e) {
      setUser(null);
      if (String(e?.message).includes('Failed to fetch')) setConfigError(true);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { refresh(); }, [refresh]);

  // タスクトレイからログアウト要求
  useEffect(() => {
    const off = ipc.on('request-logout', async () => {
      await doLogout();
      setUser(null);
    });
    return off;
  }, []);

  const value = {
    user, loading, configError,
    isAdmin: user?.role === 'admin',
    login: async (id, pw) => {
      const r = await doLogin(id, pw);
      if (r.ok) setUser(r.user);
      return r;
    },
    logout: async () => { await doLogout(); setUser(null); },
    refresh,
    setUser
  };
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export const useAuth = () => useContext(Ctx);
