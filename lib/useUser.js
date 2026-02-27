import { useState, useEffect } from 'react';
import { useRouter } from 'next/router';

export function useUser({ redirectTo = '/login' } = {}) {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const router = useRouter();

  useEffect(() => {
    const stored = localStorage.getItem('pm_user');
    if (stored) {
      try {
        setUser(JSON.parse(stored));
      } catch {
        localStorage.removeItem('pm_user');
      }
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    if (!loading && !user && redirectTo && router.pathname !== '/login') {
      router.push(redirectTo);
    }
  }, [user, loading, redirectTo, router]);

  const login = (userData) => {
    localStorage.setItem('pm_user', JSON.stringify(userData));
    setUser(userData);
  };

  const logout = () => {
    localStorage.removeItem('pm_user');
    setUser(null);
    router.push('/login');
  };

  return { user, loading, login, logout };
}
