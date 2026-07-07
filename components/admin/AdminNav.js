import Link from 'next/link';
import { useRouter } from 'next/router';
import navRegistry from '../../docs/admin/nav-registry.json';

const GROUP_LABELS = {
  schema: 'Schema',
  ingest: 'Ingest',
  search: 'Search',
  system: 'System',
};

const GROUP_ORDER = ['schema', 'ingest', 'search', 'system'];

export const ADMIN_NAV_LINKS = [...navRegistry].sort((a, b) => {
  const groupRank = GROUP_ORDER.indexOf(a.group) - GROUP_ORDER.indexOf(b.group);
  return groupRank || a.order - b.order || a.label.localeCompare(b.label);
});

export function groupedAdminNavLinks(links = ADMIN_NAV_LINKS) {
  return GROUP_ORDER
    .map((group) => ({ group, links: links.filter((link) => link.group === group).sort((a, b) => a.order - b.order) }))
    .filter((section) => section.links.length);
}

function isActivePath(pathname, href) {
  if (href === '/') return pathname === '/';
  return pathname === href || pathname.startsWith(`${href}/`);
}

export default function AdminNav({ className = '' }) {
  const router = useRouter();
  const pathname = router.pathname || '';

  return (
    <nav className={`flex flex-wrap gap-3 ${className}`} aria-label="Admin navigation">
      {groupedAdminNavLinks().map((section) => (
        <div key={section.group} className="flex flex-wrap items-center gap-2">
          <span className="font-ui text-[11px] uppercase tracking-wide text-inkFaint">
            {GROUP_LABELS[section.group] || section.group}
          </span>
          {section.links.map((link) => {
            const active = isActivePath(pathname, link.href);
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
        </div>
      ))}
    </nav>
  );
}
