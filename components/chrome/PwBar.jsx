import Link from 'next/link';
import { useEffect, useState } from 'react';

// The Paul, Weiss top bar of the design system: 58px, navy, white Inter Tight,
// pill links with a mist hairline; the pressed link is white on navy. It is the
// same bar the market site uses (pw-site-design SKILL, section 3).

// The reviewer list is read once per page load and shared by every bar
// mounted after it; a failed read is not kept, so a later mount retries.
let reviewersRequest = null;
function loadReviewers() {
  if (!reviewersRequest) {
    reviewersRequest = fetch('/api/product/reviewers', { headers: { accept: 'application/json' } })
      .then((response) => (response.ok ? response.json() : null))
      .then((body) => {
        if (!body) reviewersRequest = null;
        return body;
      })
      .catch(() => { reviewersRequest = null; return null; });
  }
  return reviewersRequest;
}

const LEVEL_LABELS = {
  PARTNER: 'Partner',
  SENIOR_ASSOCIATE: 'Senior associate',
  MID_LEVEL_ASSOCIATE: 'Mid-level associate',
  JUNIOR_ASSOCIATE: 'Junior associate',
};

export default function PwBar({ active = 'index', admin = false, initialReviewer = null, initialReviewers = null }) {
  const [reviewers, setReviewers] = useState(Array.isArray(initialReviewers) ? initialReviewers : []);
  const [reviewer, setReviewer] = useState(initialReviewer || null);
  useEffect(() => {
    if (initialReviewer) return undefined;
    let cancelled = false;
    loadReviewers().then((body) => {
      if (cancelled || !body) return;
      setReviewers(Array.isArray(body.reviewers) ? body.reviewers : []);
      setReviewer(body.current || null);
    });
    return () => { cancelled = true; };
  }, [initialReviewer]);
  // With no reviewer cookie the server names a default reviewer but marks
  // it undeclared; the switcher then starts on a blank choice, so picking
  // any reviewer (the first one included) sets the cookie.
  const declared = Boolean(reviewer) && reviewer.declared !== false;
  const chooseReviewer = (event) => {
    const id = event.target.value;
    const chosen = reviewers.find((entry) => entry.id === id) || null;
    if (!chosen) return;
    const next = { ...chosen, declared: true };
    setReviewer(next);
    reviewersRequest = Promise.resolve({ reviewers, current: next });
    try { document.cookie = `pm_reviewer=${encodeURIComponent(id)}; Path=/; SameSite=Lax; Max-Age=31536000`; } catch { /* cookie unavailable */ }
  };
  const items = [
    { key: 'index', href: '/', label: 'Index' },
    { key: 'analysed', href: '/analysed', label: 'Analysed' },
    { key: 'compare', href: '/compare', label: 'Compare' },
    ...(admin ? [{ key: 'review', href: '/review', label: 'Review' }] : []),
  ];
  return (
    <header className="pwbar" data-testid="pw-bar">
      <Link href="/" className="pwbar-brand" aria-label="Corpus. Paul, Weiss.">
        Corpus <span>Precedent intelligence</span>
      </Link>
      <nav aria-label="Sections">
        {items.map((item) => (
          <Link
            key={item.key}
            href={item.href}
            className="pwbar-link"
            aria-current={active === item.key ? 'page' : undefined}
            data-active={active === item.key ? 'true' : 'false'}
          >
            {item.label}
          </Link>
        ))}
      </nav>
      {reviewer || reviewers.length ? (
        <label className="pwbar-reviewer" title="This is a preference, not a login" data-declared={declared ? 'true' : 'false'}>
          <span>{declared ? 'Reviewing as' : 'Reviewing as: —'}</span>
          <select value={declared ? reviewer.id || '' : ''} onChange={chooseReviewer} aria-label="Reviewing as" data-testid="reviewer-switcher">
            {declared ? null : <option value="">Choose reviewer</option>}
            {declared && reviewers.length === 0 ? <option value={reviewer.id || ''}>{reviewer.name}</option> : null}
            {reviewers.map((entry) => (
              <option key={entry.id} value={entry.id}>{entry.name}{LEVEL_LABELS[entry.level] ? ` · ${LEVEL_LABELS[entry.level]}` : ''}</option>
            ))}
          </select>
        </label>
      ) : null}
      {/* Scoped to this bar; the Link anchors are Next components, so their
          classes are reached through :global() under the bar's own class.
          Below 680px the bar keeps its 58px: the nav scrolls sideways on
          one line and the reviewer switcher sits at the right. */}
      <style jsx>{`
        .pwbar { position: sticky; top: 0; z-index: 20; height: 58px; background: var(--navy, #03203d); color: #fff; display: flex; align-items: center; gap: 18px; padding: 0 max(16px, env(safe-area-inset-left, 0px)); font-family: var(--sans, 'Inter Tight', Arial, sans-serif); }
        .pwbar :global(.pwbar-brand) { flex: 0 0 auto; font-weight: 800; font-size: 17px; letter-spacing: -.03em; color: #fff; text-decoration: none; white-space: nowrap; }
        .pwbar :global(.pwbar-brand) span { font-weight: 500; color: var(--mist, #b9c8da); margin-left: 8px; }
        nav { margin-left: auto; display: flex; flex-wrap: nowrap; gap: 6px; align-items: center; min-width: 0; overflow-x: auto; scrollbar-width: none; }
        nav::-webkit-scrollbar { display: none; }
        .pwbar :global(.pwbar-link) { flex: 0 0 auto; color: #fff; text-decoration: none; font: 600 12px var(--sans, 'Inter Tight', Arial, sans-serif); letter-spacing: .04em; padding: 8px 12px; border: 1px solid rgba(185, 200, 218, .45); border-radius: 999px; white-space: nowrap; }
        .pwbar :global(.pwbar-link[data-active='true']) { background: #fff; color: var(--navy, #03203d); }
        .pwbar-reviewer { flex: 0 0 auto; display: flex; align-items: center; gap: 6px; color: #B9C8DA; font: 500 10px var(--sans, 'Inter Tight', Arial, sans-serif); white-space: nowrap; }
        .pwbar-reviewer select { max-width: 190px; border: 1px solid rgba(185, 200, 218, .45); border-radius: 999px; background: transparent; color: #fff; padding: 5px 8px; font: 600 10px var(--sans, 'Inter Tight', Arial, sans-serif); }
        .pwbar-reviewer option { color: #03203d; background: #fff; }
        @media (max-width: 900px) { .pwbar-reviewer span { display: none; } .pwbar-reviewer select { max-width: 150px; } }
        @media (max-width: 680px) {
          .pwbar { gap: 8px; padding: 0 12px; }
          .pwbar :global(.pwbar-brand) { font-size: 15px; }
          .pwbar :global(.pwbar-brand) span { display: none; }
          nav { flex: 1 1 auto; margin-left: 0; gap: 5px; }
          .pwbar :global(.pwbar-link) { padding: 6px 9px; font-size: 10.5px; }
          .pwbar-reviewer { margin-left: auto; }
          .pwbar-reviewer select { max-width: 96px; padding: 5px 6px; }
        }
      `}</style>
    </header>
  );
}
