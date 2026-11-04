import Link from 'next/link';
import { useEffect, useState } from 'react';

// The Paul, Weiss top bar of the design system: 58px, navy, white Inter Tight,
// pill links with a mist hairline; the pressed link is white on navy. It is the
// same bar the market site uses (pw-site-design SKILL, section 3).
export default function PwBar({ active = 'index', admin = false, initialReviewer = null, initialReviewers = null }) {
  const [reviewers, setReviewers] = useState(Array.isArray(initialReviewers) ? initialReviewers : []);
  const [reviewer, setReviewer] = useState(initialReviewer || null);
  useEffect(() => {
    if (initialReviewer) return undefined;
    let cancelled = false;
    fetch('/api/product/reviewers', { headers: { accept: 'application/json' } })
      .then((response) => (response.ok ? response.json() : null))
      .then((body) => {
        if (cancelled || !body) return;
        setReviewers(Array.isArray(body.reviewers) ? body.reviewers : []);
        setReviewer(body.current || null);
      })
      .catch(() => {});
    return () => { cancelled = true; };
  }, [initialReviewer]);
  const chooseReviewer = (event) => {
    const id = event.target.value;
    const chosen = reviewers.find((entry) => entry.id === id) || null;
    if (!chosen) return;
    setReviewer(chosen);
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
      {reviewer ? (
        <label className="pwbar-reviewer" title="This is a preference, not a login">
          <span>Reviewing as</span>
          <select value={reviewer.id || ''} onChange={chooseReviewer} aria-label="Reviewing as" data-testid="reviewer-switcher">
            {reviewers.length === 0 ? <option value={reviewer.id || ''}>{reviewer.name}</option> : null}
            {reviewers.map((entry) => (
              <option key={entry.id} value={entry.id}>{entry.name} · {entry.level === 'PARTNER' ? 'Partner' : entry.level === 'SENIOR_ASSOCIATE' ? 'Senior associate' : entry.level === 'MID_LEVEL_ASSOCIATE' ? 'Mid-level associate' : 'Junior associate'}</option>
            ))}
          </select>
        </label>
      ) : null}
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
      <style jsx global>{`
        .pwbar { position: sticky; top: 0; z-index: 20; height: 58px; background: var(--navy, #03203d); color: #fff; display: flex; align-items: center; gap: 18px; padding: 0 max(16px, env(safe-area-inset-left, 0px)); font-family: var(--sans, 'Inter Tight', Arial, sans-serif); }
        .pwbar-brand { font-weight: 800; font-size: 17px; letter-spacing: -.03em; color: #fff; text-decoration: none; white-space: nowrap; }
        .pwbar-brand span { font-weight: 500; color: var(--mist, #b9c8da); margin-left: 8px; }
        .pwbar nav { margin-left: auto; display: flex; gap: 6px; align-items: center; overflow-x: auto; scrollbar-width: none; }
        .pwbar nav::-webkit-scrollbar { display: none; }
        .pwbar-link { flex: 0 0 auto; color: #fff; text-decoration: none; font: 600 12px var(--sans, 'Inter Tight', Arial, sans-serif); letter-spacing: .04em; padding: 8px 12px; border: 1px solid rgba(185, 200, 218, .45); border-radius: 999px; }
        @media (max-width: 680px) {
          .pwbar { height: auto; min-height: 58px; flex-wrap: wrap; gap: 7px; padding: 8px 12px; }
          .pwbar-brand { font-size: 15px; }
          .pwbar-brand span { display: none !important; }
          .pwbar-reviewer { order: 2; }
          .pwbar nav { order: 3; width: 100%; margin-left: 0; }
          .pwbar-link { padding: 6px 9px; font-size: 10.5px; }
        }
        .pwbar-link[data-active='true'] { background: #fff; color: var(--navy, #03203d); }
        .pwbar-reviewer { display: flex; align-items: center; gap: 6px; color: #B9C8DA; font: 500 10px var(--sans, 'Inter Tight', Arial, sans-serif); white-space: nowrap; }
        .pwbar-reviewer select { max-width: 190px; border: 1px solid rgba(185, 200, 218, .45); border-radius: 999px; background: transparent; color: #fff; padding: 5px 8px; font: 600 10px var(--sans, 'Inter Tight', Arial, sans-serif); }
        .pwbar-reviewer option { color: #03203d; background: #fff; }
        @media (max-width: 900px) { .pwbar-reviewer span { display: none; } .pwbar-reviewer select { max-width: 150px; } }
      `}</style>
    </header>
  );
}
