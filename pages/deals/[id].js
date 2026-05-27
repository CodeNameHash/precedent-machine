import { useRouter } from 'next/router';
import Link from 'next/link';
import { useDeal, useProvisions } from '../../lib/useSupabaseData';
import { SkeletonCard, EmptyState, Breadcrumbs } from '../../components/UI';

export default function DealDetail() {
  const router = useRouter();
  const { id } = router.query;
  const { deal, loading: dealLoading } = useDeal(id);
  const { provisions, loading: provsLoading } = useProvisions({ deal_id: id });

  if (dealLoading) return <div className="space-y-4"><SkeletonCard /><SkeletonCard /></div>;
  if (!deal) return (
    <div className="text-center py-12">
      <p className="text-inkFaint font-ui">Deal not found.</p>
      <Link href="/deals" className="text-accent text-sm font-ui hover:underline">← Back to Deals</Link>
    </div>
  );

  const provsByType = {};
  provisions.forEach(p => {
    const t = p.type || 'Other';
    if (!provsByType[t]) provsByType[t] = [];
    provsByType[t].push(p);
  });

  const TYPE_LABELS = {
    'MAE-T': 'Material Adverse Effect (Target)', 'MAE-B': 'Material Adverse Effect (Buyer)',
    'MAE': 'Material Adverse Effect',
    'IOC-T': 'Interim Operating Covenants (Target)', 'IOC-B': 'Interim Operating Covenants (Buyer)',
    'COND-M': 'Conditions to Closing (Mutual)', 'COND-B': 'Conditions to Closing (Buyer)', 'COND-S': 'Conditions to Closing (Seller)',
    'NOSOL': 'No-Solicitation / No-Shop', 'ANTI': 'Antitrust / Regulatory',
    'TERMR-M': 'Termination Rights (Mutual)', 'TERMR-B': 'Termination Rights (Buyer)', 'TERMR-T': 'Termination Rights (Target)',
    'TERMF': 'Termination Fees', 'REP-T': 'Representations (Target)', 'REP-B': 'Representations (Buyer)',
    'COV': 'Other Covenants', 'DEF': 'Definitions', 'STRUCT': 'Structure & Mechanics', 'CONSID': 'Consideration',
  };

  return (
    <div className="space-y-6 max-w-4xl">
      <Breadcrumbs items={[
        { label: 'Dashboard', href: '/' },
        { label: 'Deals', href: '/deals' },
        { label: `${deal.acquirer} / ${deal.target}` },
      ]} />

      {/* Deal Header */}
      <div className="bg-white border border-border rounded-lg shadow-sm p-6">
        <h1 className="font-display text-2xl text-ink">{deal.acquirer} / {deal.target}</h1>
        <div className="flex flex-wrap gap-4 mt-3 text-sm font-ui text-inkLight">
          {deal.sector && <span>Sector: <span className="text-inkMid">{deal.sector}</span></span>}
          {deal.value_usd && <span>Value: <span className="text-inkMid">${(deal.value_usd / 1e9).toFixed(1)}B</span></span>}
          {deal.announce_date && <span>Date: <span className="text-inkMid">{new Date(deal.announce_date).toLocaleDateString()}</span></span>}
        </div>
      </div>

      {/* Provisions */}
      {provsLoading ? (
        <SkeletonCard />
      ) : provisions.length === 0 ? (
        <EmptyState title="No provisions" description="No provisions have been added to this deal yet." />
      ) : (
        <>
          {Object.entries(provsByType).map(([type, provs]) => (
            <div key={type} className="space-y-3">
              <h2 className="font-display text-lg text-ink">{TYPE_LABELS[type] || type}</h2>
              <div className="space-y-2">
                {provs.map(p => (
                  <Link key={p.id} href={`/provisions/${p.id}`}
                    className="block bg-white border border-border rounded-lg shadow-sm p-4 hover:border-accent transition-colors">
                    <div className="flex items-center gap-2 mb-2">
                      <span className="text-xs font-ui text-inkLight">{p.category || 'Uncategorized'}</span>
                      {p.ai_favorability && (
                        <span className={`text-[10px] font-ui px-1.5 py-0.5 rounded capitalize ${
                          p.ai_favorability.toLowerCase() === 'buyer' ? 'bg-buyer/10 text-buyer'
                          : p.ai_favorability.toLowerCase() === 'seller' ? 'bg-seller/10 text-seller'
                          : 'bg-gray-100 text-inkLight'
                        }`}>{p.ai_favorability}</span>
                      )}
                    </div>
                    <p className="font-body text-sm text-ink leading-relaxed line-clamp-3">
                      {p.full_text || '—'}
                    </p>
                  </Link>
                ))}
              </div>
            </div>
          ))}
        </>
      )}
    </div>
  );
}
