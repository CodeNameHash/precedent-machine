import Link from 'next/link';
import AdminNav from '../../components/admin/AdminNav';
import navRegistry from '../../docs/admin/nav-registry.json';

const GROUP_LABELS = {
  schema: 'Schema',
  ingest: 'Ingest',
  search: 'Search',
  system: 'System',
};

const GROUP_ORDER = ['schema', 'ingest', 'search', 'system'];

function groupedEntries() {
  return GROUP_ORDER
    .map((group) => ({
      group,
      entries: navRegistry
        .filter((entry) => entry.group === group)
        .sort((a, b) => a.order - b.order || a.label.localeCompare(b.label)),
    }))
    .filter((section) => section.entries.length);
}

AdminIndexPage.noLayout = true;

export default function AdminIndexPage() {
  return (
    <div className="min-h-screen bg-bg p-6">
      <AdminNav className="mb-6" />
      <header className="mb-6">
        <h1 className="font-display text-2xl text-ink">Admin</h1>
      </header>
      <div className="space-y-8">
        {groupedEntries().map((section) => (
          <section key={section.group}>
            <h2 className="mb-3 font-display text-lg text-ink">{GROUP_LABELS[section.group] || section.group}</h2>
            <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
              {section.entries.map((entry) => (
                <Link
                  key={entry.id}
                  href={entry.href}
                  className="rounded border border-border bg-white p-4 transition-colors hover:border-accent"
                  data-testid="admin-hub-card"
                >
                  <h3 className="font-ui text-sm text-ink">{entry.label}</h3>
                  <p className="mt-2 text-sm leading-6 text-inkLight">{entry.description}</p>
                </Link>
              ))}
            </div>
          </section>
        ))}
      </div>
    </div>
  );
}
