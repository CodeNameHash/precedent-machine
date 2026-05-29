import Link from 'next/link';
import { useUser } from '../lib/useUser';

/**
 * Layout — the minimal shell used by any page that doesn't set `.noLayout`.
 *
 * Post-refresh: the navigable surface is just the home page (/) and the
 * comparison view (/compare), both of which opt out of this Layout entirely
 * and render their own top bars (so they can support full-bleed sidebars).
 * Legacy pages (deals, provisions, ingest, admin, frankenstein, login,
 * review/index) still use this shell. We keep the Recital wordmark + user
 * info so they remain visually consistent, but the side nav is gone — the
 * legacy surfaces are no longer first-class.
 */
export default function Layout({ children }) {
  const { user, logout } = useUser();

  return (
    <div className="min-h-screen bg-paper">
      <header
        className="sticky top-0 z-50 bg-surface border-b border-line flex items-center justify-between"
        style={{ height: 56, padding: '0 22px' }}
      >
        <Link href="/" className="rec-wordmark">
          <span className="mark" />
          Recital
          <span className="tag">Precedent</span>
        </Link>
        <div className="flex items-center gap-4">
          {user && (
            <>
              <span className="text-sm text-inkLight hidden sm:inline">{user.name}</span>
              <span
                style={{
                  width: 26,
                  height: 26,
                  borderRadius: '50%',
                  background: 'var(--accent-soft)',
                  color: 'var(--accent-deep)',
                  display: 'grid',
                  placeItems: 'center',
                  fontSize: 11,
                  fontWeight: 700,
                  letterSpacing: '.02em',
                }}
              >
                {(user.name || 'U').split(/\s+/).map((s) => s[0]).slice(0, 2).join('').toUpperCase()}
              </span>
              <button
                onClick={logout}
                className="text-xs text-inkFaint hover:text-ink transition-colors"
              >
                Sign out
              </button>
            </>
          )}
        </div>
      </header>

      <main className="p-4 md:p-8">{children}</main>
    </div>
  );
}
