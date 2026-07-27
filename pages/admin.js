import { useUser } from '../lib/useUser';
import { useDeals, useProvisions } from '../lib/useSupabaseData';
import { Breadcrumbs } from '../components/UI';
import AdminNav from '../components/admin/AdminNav';

export default function Admin() {
  const { user } = useUser({ redirectTo: '/login' });
  const { deals } = useDeals();
  const { provisions } = useProvisions();
  void user;

  return (
    <div className="space-y-6 max-w-3xl">
      <Breadcrumbs items={[{ label: 'Dashboard', href: '/' }, { label: 'Admin' }]} />
      <h1 className="font-display text-2xl text-ink">Admin</h1>
      <AdminNav />

      {/* Stats */}
      <div className="grid grid-cols-2 gap-4">
        <div className="bg-white border border-border rounded-lg p-4">
          <div className="font-display text-2xl text-ink">{deals.length}</div>
          <div className="text-xs text-inkLight font-ui">Deals</div>
        </div>
        <div className="bg-white border border-border rounded-lg p-4">
          <div className="font-display text-2xl text-ink">{provisions.length}</div>
          <div className="text-xs text-inkLight font-ui">Provisions</div>
        </div>
      </div>

      <div className="bg-white border border-border rounded-lg shadow-sm p-5 space-y-4">
        <h2 className="font-display text-lg text-ink">Users</h2>
        <p className="text-sm text-inkLight font-ui">
          User administration is unavailable until action-level authentication is installed.
        </p>
      </div>
    </div>
  );
}
