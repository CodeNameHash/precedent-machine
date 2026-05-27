import Link from 'next/link';
import { useDeals, useProvisions } from '../../lib/useSupabaseData';
import { useUser } from '../../lib/useUser';
import { Breadcrumbs, SkeletonCard, EmptyState } from '../../components/UI';

export default function ReviewIndex() {
  const { user } = useUser({ redirectTo: '/login' });
  const { deals, loading: dealsLoading } = useDeals();
  const { provisions, loading: provsLoading } = useProvisions();

  if (dealsLoading || provsLoading) {
    return (
      <div className="space-y-4 max-w-4xl">
        <SkeletonCard />
        <SkeletonCard />
        <SkeletonCard />
      </div>
    );
  }

  // Count provisions per deal
  const provCountByDeal = {};
  provisions.forEach(p => {
    if (p.deal_id) {
      provCountByDeal[p.deal_id] = (provCountByDeal[p.deal_id] || 0) + 1;
    }
  });

  // Filter to deals that have provisions
  const dealsWithProvs = deals.filter(d => provCountByDeal[d.id] > 0);

  return (
    <div className="space-y-6 max-w-4xl">
      <Breadcrumbs items={[
        { label: 'Dashboard', href: '/' },
        { label: 'Review' },
      ]} />

      <div>
        <h1 className="font-display text-2xl text-ink">Review Agreements</h1>
        <p className="text-sm text-inkLight font-ui mt-1">
          Select a deal to review and annotate its parsed agreement provisions.
        </p>
      </div>

      {dealsWithProvs.length === 0 ? (
        <EmptyState
          icon="+"
          title="No deals to review"
          description="Ingest an agreement first, then come back here to review the parsed provisions."
          action={
            <Link href="/ingest" className="inline-block px-4 py-2 text-sm font-ui bg-accent text-white rounded hover:bg-accent/90 transition-colors">
              Go to Ingest
            </Link>
          }
        />
      ) : (
        <div className="space-y-2">
          {dealsWithProvs.map(deal => (
            <Link
              key={deal.id}
              href={`/review/${deal.id}`}
              className="block bg-white border border-border rounded-lg shadow-sm p-4 hover:border-accent transition-colors"
            >
              <div className="flex items-center justify-between">
                <div>
                  <h2 className="font-display text-base text-ink">
                    {deal.acquirer} / {deal.target}
                  </h2>
                  <div className="flex gap-3 mt-1 text-xs font-ui text-inkLight">
                    {deal.sector && <span>{deal.sector}</span>}
                    {deal.announce_date && <span>{new Date(deal.announce_date).toLocaleDateString()}</span>}
                  </div>
                </div>
                <div className="text-right">
                  <span className="text-sm font-ui text-inkMid font-medium">
                    {provCountByDeal[deal.id]} provision{provCountByDeal[deal.id] !== 1 ? 's' : ''}
                  </span>
                  <p className="text-[10px] font-ui text-accent mt-0.5">Review &rarr;</p>
                </div>
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
