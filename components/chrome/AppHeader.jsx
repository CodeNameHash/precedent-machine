// Shared masthead — ported out of pages/index.js so every top-level .mtx
// page (the corpus index, the query surface) shares one banner instead of
// each page hand-rolling its own header. Same 64px sticky grid, same brand
// mark, same nav voice; pages plug in their own center content (search box,
// page title) via `center`, and the active section is highlighted via `active`.
//
// Pages/index.js is unaffected in BEHAVIOR — this only extracts markup/CSS
// that used to live inline there. It stays inside .mtx (MergertraceStyles
// must be imported by the page) since every rule here reads .mtx tokens.

import Link from 'next/link';

const NAV_ITEMS = [
  { key: 'corpus', href: '/', label: 'Corpus' },
  { key: 'query', href: '/query', label: 'Query' },
  { key: 'library', href: '/library', label: 'Library' },
];

export default function AppHeader({ active, center, onBrandClick }) {
  return (
    <header className="top">
      <Link href="/" className="brand" onClick={onBrandClick}><span />Corpus</Link>
      <div className="center">{center}</div>
      <nav className="navGroup">
        {NAV_ITEMS.map((item) => (
          <Link key={item.key} href={item.href} className={`nav${active === item.key ? ' navActive' : ''}`}>
            {item.label}
          </Link>
        ))}
      </nav>
      <span className="login">Login</span>
      <style jsx>{`
        .top { height: 64px; display: grid; grid-template-columns: 180px minmax(260px, 1fr) auto auto; gap: 18px; align-items: center; padding: 0 28px; border-bottom: 1px solid var(--line); background: var(--surface); position: sticky; top: 0; z-index: 20; }
        .brand { color: var(--ink); text-decoration: none; font-size: 20px; font-weight: 650; display: inline-flex; align-items: center; gap: 9px; font-family: var(--mtx-sans); }
        .brand span { width: 8px; height: 8px; border-radius: 0; background: var(--accent); display: inline-block; }
        .center { min-width: 0; }
        .navGroup { display: flex; align-items: center; gap: 18px; }
        .nav, .login { color: var(--accent-deep); font-size: 13px; font-weight: 600; text-decoration: none; font-family: var(--mtx-sans); }
        .nav:hover { text-decoration: underline; }
        .navActive { color: var(--ink); border-bottom: 2px solid var(--accent); padding-bottom: 2px; }
        .login { color: var(--ink-light); }
        @media (max-width: 820px) {
          .top { grid-template-columns: 1fr; height: auto; padding: 14px; row-gap: 10px; }
        }
      `}</style>
    </header>
  );
}
