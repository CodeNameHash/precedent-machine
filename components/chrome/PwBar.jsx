import Link from 'next/link';

// The Paul, Weiss top bar of the design system: 58px, navy, white Inter Tight,
// pill links with a mist hairline; the pressed link is white on navy. It is the
// same bar the market site uses (pw-site-design SKILL, section 3).
export default function PwBar({ active = 'index', admin = false }) {
  const items = [
    { key: 'index', href: '/', label: 'Index' },
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
      <style jsx>{`
        .pwbar { position: sticky; top: 0; z-index: 20; height: 58px; background: var(--navy, #03203d); color: #fff; display: flex; align-items: center; gap: 18px; padding: 0 max(16px, env(safe-area-inset-left, 0px)); font-family: var(--sans, 'Inter Tight', Arial, sans-serif); }
        .pwbar-brand { font-weight: 800; font-size: 17px; letter-spacing: -.03em; color: #fff; text-decoration: none; white-space: nowrap; }
        .pwbar-brand span { font-weight: 500; color: var(--mist, #b9c8da); margin-left: 8px; }
        .pwbar nav { margin-left: auto; display: flex; gap: 6px; align-items: center; }
        .pwbar-link { color: #fff; text-decoration: none; font: 600 12px var(--sans, 'Inter Tight', Arial, sans-serif); letter-spacing: .04em; padding: 8px 12px; border: 1px solid rgba(185, 200, 218, .45); border-radius: 999px; }
        .pwbar-link[data-active='true'] { background: #fff; color: var(--navy, #03203d); }
      `}</style>
    </header>
  );
}
