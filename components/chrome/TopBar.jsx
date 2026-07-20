// Site-wide top banner — extracted out of components/Layout.js (r14: Ben
// wants the query-results page to carry the SAME top chrome as the review
// page, including the "Return to Index" affordance). Layout.js renders this
// for every non-noLayout page (deals, provisions, review); pages/query/
// [kind]/[id].js — which sets noLayout so it can control its own body width
// — renders it directly for the same reason, so the two surfaces share one
// implementation instead of two hand-copies drifting apart.
import Link from 'next/link';
import { useUser } from '../../lib/useUser';
import { ViewModeToggle } from '../ViewModeContext';

export default function TopBar() {
  const { user, logout } = useUser();

  return (
    <header
      className="sticky top-0 z-50 bg-surface border-b border-line flex items-center justify-between"
      style={{ height: 56, padding: '0 22px' }}
    >
      <div className="flex items-center gap-4">
        <Link href="/" className="rec-wordmark">
          <span className="mark" />
          Corpus
        </Link>
        <Link
          href="/"
          className="text-xs font-ui text-inkLight hover:text-ink"
          style={{ letterSpacing: '.04em' }}
        >
          Return to Index
        </Link>
      </div>
      <div className="flex items-center gap-4">
        <ViewModeToggle />
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
  );
}
