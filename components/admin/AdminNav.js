import Link from 'next/link';
import { useRouter } from 'next/router';

export const ADMIN_NAV_LINKS = [
  { href: '/admin', label: 'Admin hub' },
  { href: '/admin/registry', label: 'Registry' },
  { href: '/admin/registry/audit', label: 'Audit' },
  { href: '/admin/registry/reconcile', label: 'Reconcile' },
  { href: '/admin/gaps', label: 'Gap review' },
  { href: '/admin/ingest-runs', label: 'Ingest runs' },
  { href: '/admin/candidates', label: 'Deal candidates' },
  { href: '/admin/agreements', label: 'Upload agreements' },
  { href: '/ingest', label: 'Legacy ingest' },
  { href: '/', label: 'Search / Review' },
];

export default function AdminNav({ className = '' }) {
  const router = useRouter();
  const pathname = router.pathname || '';

  return (
    <nav className={`flex flex-wrap gap-2 ${className}`} aria-label="Admin navigation">
      {ADMIN_NAV_LINKS.map((link) => {
        const active = pathname === link.href || (link.href !== '/admin' && pathname.startsWith(`${link.href}/`));
        return (
          <Link
            key={link.href}
            href={link.href}
            className={`inline-flex items-center rounded border px-3 py-1.5 text-xs font-ui transition-colors ${
              active
                ? 'border-accent bg-accent text-white'
                : 'border-border bg-white text-inkLight hover:border-accent hover:text-ink'
            }`}
          >
            {link.label}
          </Link>
        );
      })}
    </nav>
  );
}
