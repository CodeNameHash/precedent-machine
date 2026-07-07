import Link from 'next/link';
import { useDeals } from '../../lib/useSupabaseData';
import { useUser } from '../../lib/useUser';
import { Breadcrumbs, SkeletonCard, EmptyState } from '../../components/UI';

export default function ReviewIndex() {
  const { user } = useUser({ redirectTo: '/login' });
  const { deals, loading: dealsLoading } = useDeals();

  if (dealsLoading) {
    return (
      <div className="space-y-4 max-w-4xl">
        <SkeletonCard />
        <SkeletonCard />
        <SkeletonCard />
      </div>
    );
  }

  const dealsWithProvs = deals.filter(d => d.provision_count == null || Number(d.provision_count) > 0);

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
                    {deal.provision_count == null
                      ? 'Provision count pending'
                      : `${Number(deal.provision_count) || 0} provision${Number(deal.provision_count) !== 1 ? 's' : ''}`}
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
