import fs from 'fs';
import AdminNav from '../../../components/admin/AdminNav';
import AuditMatrix from '../../../components/admin/audit/AuditMatrix';

AuditPage.noLayout = true;

export default function AuditPage({ matrix }) {
  return (
    <div className="min-h-screen bg-bg p-6">
      <AdminNav className="mb-6" />
      <header className="mb-6">
        <h1 className="font-display text-2xl text-ink">Audit</h1>
      </header>
      <AuditMatrix matrix={matrix} />
    </div>
  );
}

export function getStaticProps() {
  const normalized = JSON.parse(fs.readFileSync('docs/schema-shape/normalized-v1.json', 'utf8'));
  const columns = (normalized.entries || []).slice(0, 6).map((entry) => ({ key: entry.key, label: entry.displayName || entry.key }));
  const rows = [{
    deal_id: 'corpus-baseline',
    deal_name: 'Corpus baseline',
    cells: Object.fromEntries(columns.map((column) => [column.key, { status: 'green', canonicalKey: column.key, sourceProvisionId: null }])),
  }];
  return { props: { matrix: { columns, rows } } };
}
