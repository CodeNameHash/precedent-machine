import { useEffect, useState } from 'react';
import Head from 'next/head';
import { useRouter } from 'next/router';
const { safeNextPath } = require('../lib/auth/safe-next-path');

// pages/login.js — the one gate in front of the whole application (see
// middleware.js). Deliberately standalone (noLayout): Layout/TopBar render
// nav to pages that are all behind this same gate, which is a confusing
// thing to show someone who isn't signed in yet.
LoginPage.noLayout = true;

export default function LoginPage() {
  const router = useRouter();
  const [username, setUsername] = useState('ben');
  const [password, setPassword] = useState('');
  const [error, setError] = useState(null);
  const [submitting, setSubmitting] = useState(false);
  const [checkingSession, setCheckingSession] = useState(true);

  const nextPath = router.isReady ? safeNextPath(router.query.next) : '/';

  // Already signed in (e.g. followed a bookmark to /login) -> skip the form.
  useEffect(() => {
    let cancelled = false;
    if (!router.isReady) return undefined;
    fetch('/api/auth/session')
      .then((r) => (r.ok ? r.json() : { authenticated: false }))
      .then((data) => {
        if (cancelled) return;
        if (data && data.authenticated) {
          router.replace(nextPath);
          return;
        }
        setCheckingSession(false);
      })
      .catch(() => {
        if (!cancelled) setCheckingSession(false);
      });
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [router.isReady]);

  async function handleSubmit(e) {
    e.preventDefault();
    setError(null);
    setSubmitting(true);
    try {
      const res = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username, password }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(data.error || 'Sign in failed');
        setSubmitting(false);
        return;
      }
      router.replace(nextPath);
    } catch {
      setError('Could not reach the server');
      setSubmitting(false);
    }
  }

  return (
    <div className="min-h-screen bg-paper flex items-center justify-center p-4">
      <Head>
        <title>Sign in — Corpus</title>
      </Head>
      <div className="w-full max-w-sm">
        <div className="text-center mb-8">
          <span className="rec-wordmark text-lg">
            <span className="mark" />
            Corpus
          </span>
        </div>
        {checkingSession ? (
          <div className="text-center text-sm text-inkFaint font-ui">Checking session…</div>
        ) : (
          <form
            onSubmit={handleSubmit}
            className="bg-surface border border-line rounded-card p-6 space-y-4"
          >
            <div>
              <label htmlFor="username" className="block text-xs font-ui text-inkLight mb-1">
                Username
              </label>
              <input
                id="username"
                name="username"
                type="text"
                autoComplete="username"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                className="w-full border border-line rounded px-3 py-2 text-sm font-ui bg-paper text-ink focus:outline-none focus:ring-1 focus:ring-accent"
              />
            </div>
            <div>
              <label htmlFor="password" className="block text-xs font-ui text-inkLight mb-1">
                Password
              </label>
              <input
                id="password"
                name="password"
                type="password"
                autoComplete="current-password"
                autoFocus
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full border border-line rounded px-3 py-2 text-sm font-ui bg-paper text-ink focus:outline-none focus:ring-1 focus:ring-accent"
              />
            </div>
            {error && (
              <div className="text-xs font-ui text-red-600" role="alert">
                {error}
              </div>
            )}
            <button
              type="submit"
              disabled={submitting || !password}
              className="w-full bg-accent text-white text-sm font-ui rounded py-2 disabled:opacity-50"
            >
              {submitting ? 'Signing in…' : 'Sign in'}
            </button>
          </form>
        )}
      </div>
    </div>
  );
}
