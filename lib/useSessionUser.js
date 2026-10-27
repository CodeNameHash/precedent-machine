import { useEffect, useState } from 'react';

// The signed-in identity and whether it is the product's owner (work package
// 53, plan finding (290)). Pages that are for everyone (the index, a deal, a
// comparison) render without it; the navigation uses `admin` to decide whether
// the operations surfaces — the review queue, publishing and release — are
// offered at all.
export function useSessionUser() {
  const [session, setSession] = useState({ loading: true, authenticated: false, sub: null, admin: false });
  useEffect(() => {
    let cancelled = false;
    fetch('/api/auth/session', { headers: { accept: 'application/json' } })
      .then((response) => (response.ok ? response.json() : { authenticated: false, admin: false }))
      .then((body) => {
        if (!cancelled) setSession({ loading: false, authenticated: Boolean(body.authenticated), sub: body.sub || null, admin: body.admin === true });
      })
      .catch(() => { if (!cancelled) setSession({ loading: false, authenticated: false, sub: null, admin: false }); });
    return () => { cancelled = true; };
  }, []);
  return session;
}
