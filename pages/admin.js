import { useState, useEffect } from 'react';
import { useUser } from '../lib/useUser';
import { useUsers, useDeals, useProvisions } from '../lib/useSupabaseData';
import { Breadcrumbs, SkeletonCard } from '../components/UI';

export default function Admin() {
  const { user } = useUser({ redirectTo: '/login' });
  const { users, loading: usersLoading, refetch: refetchUsers } = useUsers();
  const { deals } = useDeals();
  const { provisions } = useProvisions();
  const [newUserName, setNewUserName] = useState('');
  const [adding, setAdding] = useState(false);

  const addUser = async () => {
    if (!newUserName.trim()) return;
    setAdding(true);
    await fetch('/api/users', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: newUserName }),
    });
    setNewUserName('');
    setAdding(false);
    refetchUsers();
  };

  return (
    <div className="space-y-6 max-w-3xl">
      <Breadcrumbs items={[{ label: 'Dashboard', href: '/' }, { label: 'Admin' }]} />
      <h1 className="font-display text-2xl text-ink">Admin</h1>

      {/* Stats */}
      <div className="grid grid-cols-3 gap-4">
        <div className="bg-white border border-border rounded-lg p-4">
          <div className="font-display text-2xl text-ink">{users.length}</div>
          <div className="text-xs text-inkLight font-ui">Users</div>
        </div>
        <div className="bg-white border border-border rounded-lg p-4">
          <div className="font-display text-2xl text-ink">{deals.length}</div>
          <div className="text-xs text-inkLight font-ui">Deals</div>
        </div>
        <div className="bg-white border border-border rounded-lg p-4">
          <div className="font-display text-2xl text-ink">{provisions.length}</div>
          <div className="text-xs text-inkLight font-ui">Provisions</div>
        </div>
      </div>

      {/* Users */}
      <div className="bg-white border border-border rounded-lg shadow-sm p-5 space-y-4">
        <h2 className="font-display text-lg text-ink">Users</h2>
        {usersLoading ? (
          <SkeletonCard />
        ) : (
          <div className="space-y-2">
            {users.map(u => (
              <div key={u.id} className="flex items-center justify-between px-3 py-2 rounded bg-bg/50">
                <span className="font-ui text-sm text-ink">{u.name}</span>
                <span className="text-[10px] font-ui text-inkFaint">
                  {u.is_admin ? 'Admin' : 'User'} · {u.id.slice(0, 8)}
                </span>
              </div>
            ))}
          </div>
        )}

        <div className="flex gap-2 pt-2 border-t border-border">
          <input
            value={newUserName}
            onChange={e => setNewUserName(e.target.value)}
            placeholder="New user name"
            className="flex-1 border border-border rounded px-3 py-2 text-sm font-ui focus:outline-none focus:ring-1 focus:ring-accent"
            onKeyDown={e => e.key === 'Enter' && addUser()}
          />
          <button onClick={addUser} disabled={adding || !newUserName.trim()}
            className="px-4 py-2 text-sm font-ui bg-accent text-white rounded hover:bg-accent/90 disabled:opacity-40">
            {adding ? 'Adding…' : 'Add'}
          </button>
        </div>
      </div>
    </div>
  );
}
