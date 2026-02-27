import { useState } from 'react';
import Link from 'next/link';
import { useDeals } from '../../lib/useSupabaseData';
import { SkeletonTable, EmptyState, ErrorState, Breadcrumbs } from '../../components/UI';
import { useUser } from '../../lib/useUser';

export default function Deals() {
  const { user } = useUser({ redirectTo: '/login' });
  const { deals, loading, error, refetch } = useDeals();
  const [sectorFilter, setSectorFilter] = useState('');
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({ acquirer: '', target: '', value_usd: '', announce_date: '', sector: '' });
  const [submitting, setSubmitting] = useState(false);

  const sectors = [...new Set(deals.map(d => d.sector).filter(Boolean))].sort();
  const filtered = sectorFilter ? deals.filter(d => d.sector === sectorFilter) : deals;

  const handleSubmit = async () => {
    if (!form.acquirer || !form.target) return;
    setSubmitting(true);
    await fetch('/api/deals', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        ...form,
        value_usd: form.value_usd ? parseFloat(form.value_usd) : null,
        created_by: user?.id,
      }),
    });
    setForm({ acquirer: '', target: '', value_usd: '', announce_date: '', sector: '' });
    setShowForm(false);
    setSubmitting(false);
    refetch();
  };

  return (
    <div className="space-y-6">
      <Breadcrumbs items={[{ label: 'Dashboard', href: '/' }, { label: 'Deals' }]} />
      <div className="flex items-center justify-between">
        <h1 className="font-display text-2xl text-ink">Deals</h1>
        <button
          onClick={() => setShowForm(!showForm)}
          className="px-4 py-2 text-sm font-ui bg-accent text-white rounded hover:bg-accent/90 transition-colors"
        >
          {showForm ? 'Cancel' : '+ Add Deal'}
        </button>
      </div>

      {/* Add Deal Form */}
      {showForm && (
        <div className="bg-white border border-border rounded-lg shadow-sm p-5 space-y-3">
          <h3 className="font-ui text-sm font-medium text-inkMid">New Deal</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <input placeholder="Acquirer *" value={form.acquirer} onChange={e => setForm(f => ({...f, acquirer: e.target.value}))}
              className="border border-border rounded px-3 py-2 text-sm font-ui focus:outline-none focus:ring-1 focus:ring-accent" />
            <input placeholder="Target *" value={form.target} onChange={e => setForm(f => ({...f, target: e.target.value}))}
              className="border border-border rounded px-3 py-2 text-sm font-ui focus:outline-none focus:ring-1 focus:ring-accent" />
            <input placeholder="Value (USD)" type="number" value={form.value_usd} onChange={e => setForm(f => ({...f, value_usd: e.target.value}))}
              className="border border-border rounded px-3 py-2 text-sm font-ui focus:outline-none focus:ring-1 focus:ring-accent" />
            <input placeholder="Announce Date" type="date" value={form.announce_date} onChange={e => setForm(f => ({...f, announce_date: e.target.value}))}
              className="border border-border rounded px-3 py-2 text-sm font-ui focus:outline-none focus:ring-1 focus:ring-accent" />
            <input placeholder="Sector" value={form.sector} onChange={e => setForm(f => ({...f, sector: e.target.value}))}
              className="border border-border rounded px-3 py-2 text-sm font-ui focus:outline-none focus:ring-1 focus:ring-accent" />
          </div>
          <button onClick={handleSubmit} disabled={submitting || !form.acquirer || !form.target}
            className="px-4 py-2 text-sm font-ui bg-accent text-white rounded hover:bg-accent/90 disabled:opacity-40 transition-colors">
            {submitting ? 'Saving…' : 'Save Deal'}
          </button>
        </div>
      )}

      {/* Filter */}
      {sectors.length > 0 && (
        <div className="flex items-center gap-2">
          <label className="text-sm font-ui text-inkLight">Sector</label>
          <select value={sectorFilter} onChange={e => setSectorFilter(e.target.value)}
            className="border border-border rounded px-3 py-1.5 text-sm font-ui focus:outline-none focus:ring-1 focus:ring-accent bg-white">
            <option value="">All</option>
            {sectors.map(s => <option key={s} value={s}>{s}</option>)}
          </select>
        </div>
      )}

      {/* Table */}
      {error ? (
        <ErrorState message={error.message} onRetry={refetch} />
      ) : loading ? (
        <SkeletonTable rows={5} cols={5} />
      ) : filtered.length === 0 ? (
        <EmptyState title="No deals found" description="Add your first deal to start building precedents." />
      ) : (
        <div className="bg-white border border-border rounded-lg shadow-sm overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border bg-bg/50">
                <th className="text-left px-4 py-3 font-ui font-medium text-inkLight">Acquirer / Target</th>
                <th className="text-left px-4 py-3 font-ui font-medium text-inkLight hidden md:table-cell">Sector</th>
                <th className="text-left px-4 py-3 font-ui font-medium text-inkLight hidden md:table-cell">Value</th>
                <th className="text-left px-4 py-3 font-ui font-medium text-inkLight hidden sm:table-cell">Date</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map(d => (
                <tr key={d.id} className="border-b border-border last:border-0 hover:bg-bg/40 cursor-pointer transition-colors"
                  onClick={() => window.location.href = `/deals/${d.id}`}>
                  <td className="px-4 py-3 font-ui text-ink">{d.acquirer} / {d.target}</td>
                  <td className="px-4 py-3 font-ui text-inkMid hidden md:table-cell">{d.sector || '—'}</td>
                  <td className="px-4 py-3 font-ui text-inkMid hidden md:table-cell">
                    {d.value_usd ? `$${(d.value_usd / 1e9).toFixed(1)}B` : '—'}
                  </td>
                  <td className="px-4 py-3 font-ui text-inkLight text-xs hidden sm:table-cell">
                    {d.announce_date ? new Date(d.announce_date).toLocaleDateString() : '—'}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
