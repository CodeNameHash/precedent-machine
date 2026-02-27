import { useState } from 'react';
import Link from 'next/link';
import { useDeals, useProvisions } from '../../lib/useSupabaseData';

const TYPE_OPTIONS = ['All', 'MAE', 'IOC'];

const FAVORABILITY_COLORS = {
  buyer: 'bg-buyer/10 text-buyer',
  seller: 'bg-seller/10 text-seller',
  neutral: 'bg-gray-100 text-inkLight',
};

export default function Provisions() {
  const [dealFilter, setDealFilter] = useState('');
  const [typeFilter, setTypeFilter] = useState('All');

  const { deals } = useDeals();
  const { provisions, loading } = useProvisions({
    deal_id: dealFilter || undefined,
    type: typeFilter === 'All' ? undefined : typeFilter,
  });

  return (
    <div className="space-y-6">
      <h1 className="font-display text-2xl text-ink">Provisions</h1>

      {/* Filter Bar */}
      <div className="bg-white border border-border rounded-lg shadow-sm p-4 flex flex-wrap items-center gap-4">
        <div className="flex items-center gap-2">
          <label className="text-sm font-ui text-inkLight">Deal</label>
          <select
            value={dealFilter}
            onChange={(e) => setDealFilter(e.target.value)}
            className="border border-border rounded px-3 py-1.5 text-sm font-ui text-ink bg-white focus:outline-none focus:ring-1 focus:ring-accent"
          >
            <option value="">All Deals</option>
            {deals.map((d) => (
              <option key={d.id} value={d.id}>
                {d.acquirer} / {d.target}
              </option>
            ))}
          </select>
        </div>

        <div className="flex items-center gap-1 bg-bg rounded-lg p-0.5">
          {TYPE_OPTIONS.map((opt) => (
            <button
              key={opt}
              onClick={() => setTypeFilter(opt)}
              className={`px-3 py-1 text-sm font-ui rounded transition-colors ${
                typeFilter === opt
                  ? 'bg-white text-ink shadow-sm'
                  : 'text-inkLight hover:text-ink'
              }`}
            >
              {opt}
            </button>
          ))}
        </div>

        <span className="text-xs text-inkFaint font-ui ml-auto">
          {provisions.length} provision{provisions.length !== 1 ? 's' : ''}
        </span>
      </div>

      {/* Table */}
      <div className="bg-white border border-border rounded-lg shadow-sm overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-border bg-bg/50">
              <th className="text-left px-4 py-3 font-ui font-medium text-inkLight">Deal</th>
              <th className="text-left px-4 py-3 font-ui font-medium text-inkLight">Type</th>
              <th className="text-left px-4 py-3 font-ui font-medium text-inkLight">Category</th>
              <th className="text-left px-4 py-3 font-ui font-medium text-inkLight">Favorability</th>
              <th className="text-left px-4 py-3 font-ui font-medium text-inkLight">Date</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr>
                <td colSpan={5} className="px-4 py-8 text-center text-inkFaint font-ui">
                  Loading…
                </td>
              </tr>
            ) : provisions.length === 0 ? (
              <tr>
                <td colSpan={5} className="px-4 py-8 text-center text-inkFaint font-ui">
                  No provisions found.
                </td>
              </tr>
            ) : (
              provisions.map((p) => {
                const fav = (p.ai_favorability || '').toLowerCase();
                return (
                  <Link key={p.id} href={`/provisions/${p.id}`} legacyBehavior>
                    <tr className="border-b border-border last:border-0 hover:bg-bg/40 cursor-pointer transition-colors">
                      <td className="px-4 py-3 font-ui text-ink">
                        {p.deal?.acquirer || p.acquirer || '—'} / {p.deal?.target || p.target || '—'}
                      </td>
                      <td className="px-4 py-3">
                        <span className="inline-block px-2 py-0.5 rounded text-xs font-ui font-medium bg-bg text-inkMid">
                          {p.type}
                        </span>
                      </td>
                      <td className="px-4 py-3 font-ui text-inkMid">{p.category || '—'}</td>
                      <td className="px-4 py-3">
                        {fav ? (
                          <span
                            className={`inline-block px-2 py-0.5 rounded text-xs font-ui font-medium capitalize ${
                              FAVORABILITY_COLORS[fav] || FAVORABILITY_COLORS.neutral
                            }`}
                          >
                            {fav}
                          </span>
                        ) : (
                          <span className="text-inkFaint text-xs font-ui">—</span>
                        )}
                      </td>
                      <td className="px-4 py-3 font-ui text-inkLight text-xs">
                        {p.created_at ? new Date(p.created_at).toLocaleDateString() : '—'}
                      </td>
                    </tr>
                  </Link>
                );
              })
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
