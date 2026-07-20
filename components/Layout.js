import TopBar from './chrome/TopBar';

/**
 * Layout — the minimal shell used by any page that doesn't set `.noLayout`.
 *
 * Post-refresh: the navigable surface is just the home page (/) and the
 * comparison view (/compare), both of which opt out of this Layout entirely
 * and render their own top bars (so they can support full-bleed sidebars).
 * Legacy pages (deals, provisions, ingest, admin, frankenstein, login,
 * review/index) still use this shell. We keep the Corpus wordmark + user
 * info so they remain visually consistent, but the side nav is gone — the
 * legacy surfaces are no longer first-class.
 *
 * The header bar itself lives in components/chrome/TopBar.jsx (extracted
 * r14) so pages/query/[kind]/[id].js — which stays noLayout to control its
 * own body width — can render the identical banner instead of a hand-copy.
 */
export default function Layout({ children }) {
  return (
    <div className="min-h-screen bg-paper">
      <TopBar />
      <main className="p-4 md:p-8">{children}</main>
    </div>
  );
}
