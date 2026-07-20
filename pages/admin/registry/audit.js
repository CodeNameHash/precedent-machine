import AdminNav from '../../../components/admin/AdminNav';
import AuditMatrix from '../../../components/admin/audit/AuditMatrix';

AuditPage.noLayout = true;

const BUILD_FETCH_TIMEOUT_MS = 8000;
const EMPTY_MATRIX = Object.freeze({ columns: [], rows: [], triple_count: 0 });

function withBuildTimeout(promise) {
  let timer;
  const timeout = new Promise((resolve) => {
    timer = setTimeout(() => resolve(EMPTY_MATRIX), BUILD_FETCH_TIMEOUT_MS);
  });
  return Promise.race([promise, timeout]).finally(() => clearTimeout(timer));
}

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
  return { props: { matrix: await withBuildTimeout(buildAuditMatrix()) } };
}
