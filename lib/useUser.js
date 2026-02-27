import { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/router';

const UserContext = createContext(null);

export function UserProvider({ children }) {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const stored = typeof window !== 'undefined' ? localStorage.getItem('pm_user') : null;
    if (stored) {
      try { setUser(JSON.parse(stored)); } catch {}
    }
    setLoading(false);
  }, []);

  const login = useCallback((userData) => {
    setUser(userData);
    localStorage.setItem('pm_user', JSON.stringify(userData));
  }, []);

  const logout = useCallback(() => {
    setUser(null);
    localStorage.removeItem('pm_user');
  }, []);

  return (
    <UserContext.Provider value={{ user, loading, login, logout }}>
      {children}
    </UserContext.Provider>
  );
}

export function useUser(opts = {}) {
  const ctx = useContext(UserContext);
  const router = useRouter();

  useEffect(() => {
    if (ctx && !ctx.loading && !ctx.user && opts.redirectTo) {
      router.push(opts.redirectTo);
    }
  }, [ctx, opts.redirectTo, router]);

  return ctx || { user: null, loading: true, login: () => {}, logout: () => {} };
}
