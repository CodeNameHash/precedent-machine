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

export async function getStaticProps() {
  const { buildAuditMatrix } = await import('../../api/admin/audit/matrix');
  return { props: { matrix: buildAuditMatrix() } };
}
