import { useState, useEffect } from 'react';
import Link from 'next/link';
import { useDeals, useProvisions } from '../lib/useSupabaseData';
import { SkeletonCard, EmptyState } from '../components/UI';
import { useUser } from '../lib/useUser';

export default function Dashboard() {
  const { user } = useUser({ redirectTo: '/login' });
  const { deals, loading: dealsLoading } = useDeals();
  const { provisions, loading: provsLoading } = useProvisions();
  const [comparisons, setComparisons] = useState([]);
  const [compsLoading, setCompsLoading] = useState(true);

  useEffect(() => {
    fetch('/api/comparisons')
      .then(r => r.json())
      .then(d => { setComparisons(d.comparisons || []); setCompsLoading(false); })
      .catch(() => setCompsLoading(false));
  }, []);

  const loading = dealsLoading || provsLoading;

  const maeCount = provisions.filter(p => p.type === 'MAE').length;
  const iocCount = provisions.filter(p => p.type === 'IOC').length;
  const categorized = provisions.filter(p => p.category).length;
  const uncategorized = provisions.length - categorized;

  const stats = [
    { label: 'Deals', value: deals.length, href: '/deals' },
    { label: 'MAE Provisions', value: maeCount, href: '/provisions' },
    { label: 'IOC Provisions', value: iocCount, href: '/provisions' },
    { label: 'Uncategorized', value: uncategorized, href: '/provisions', accent: uncategorized > 0 },
  ];

  return (
    <div className="space-y-8">
      <div>
        <h1 className="font-display text-2xl text-ink">Dashboard</h1>
        {user && <p className="text-sm text-inkLight font-ui mt-1">Welcome back, {user.name}</p>}
      </div>

      {/* Stats Grid */}
      {loading ? (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {[1,2,3,4].map(i => <SkeletonCard key={i} />)}
        </div>
      ) : (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {stats.map(s => (
            <Link key={s.label} href={s.href} className="bg-white border border-border rounded-lg shadow-sm p-5 hover:border-accent transition-colors group">
              <div className={`font-display text-3xl ${s.accent ? 'text-seller' : 'text-ink'}`}>{s.value}</div>
              <div className="text-sm text-inkLight font-ui mt-1 group-hover:text-ink transition-colors">{s.label}</div>
            </Link>
          ))}
        </div>
      )}

      {/* Recent Deals */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="font-display text-lg text-ink">Recent Deals</h2>
          <Link href="/deals" className="text-xs text-accent font-ui hover:underline">View all →</Link>
        </div>
        {dealsLoading ? (
          <SkeletonCard />
        ) : deals.length === 0 ? (
          <EmptyState title="No deals yet" description="Add your first deal to get started." />
        ) : (
          <div className="bg-white border border-border rounded-lg shadow-sm divide-y divide-border">
            {deals.slice(0, 5).map(d => (
              <Link key={d.id} href={`/deals/${d.id}`} className="block px-5 py-3 hover:bg-bg/40 transition-colors">
                <div className="flex items-center justify-between">
                  <span className="font-ui text-sm text-ink">{d.acquirer} / {d.target}</span>
                  <span className="text-xs text-inkFaint font-ui">{d.sector || '—'}</span>
                </div>
                {d.value_usd && (
                  <span className="text-xs text-inkLight font-ui">${(d.value_usd / 1e9).toFixed(1)}B</span>
                )}
              </Link>
            ))}
          </div>
        )}
      </div>

      {/* Saved Comparisons */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="font-display text-lg text-ink">Saved Comparisons</h2>
          <Link href="/compare" className="text-xs text-accent font-ui hover:underline">New comparison →</Link>
        </div>
        {compsLoading ? (
          <SkeletonCard />
        ) : comparisons.length === 0 ? (
          <EmptyState title="No saved comparisons" description="Compare provisions across deals and save them here." />
        ) : (
          <div className="bg-white border border-border rounded-lg shadow-sm divide-y divide-border">
            {comparisons.slice(0, 5).map(c => (
              <Link
                key={c.id}
                href={`/compare?ids=${(c.deal_ids || []).join(',')}&category=${c.category || ''}`}
                className="block px-5 py-3 hover:bg-bg/40 transition-colors"
              >
                <div className="flex items-center justify-between">
                  <span className="font-ui text-sm text-ink">{c.category || 'All Categories'}</span>
                  <span className="text-xs text-inkFaint font-ui">
                    {c.deal_ids?.length || 0} deals
                    {c.verified_at && ' · ✓ verified'}
                  </span>
                </div>
                {c.summary && (
                  <p className="text-xs text-inkLight font-ui mt-1 line-clamp-1">{c.summary}</p>
                )}
              </Link>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
