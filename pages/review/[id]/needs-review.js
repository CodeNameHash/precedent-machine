import { useMemo } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/router';
import { useDeal, useProvisions } from '../../../lib/useSupabaseData';
import { useUser } from '../../../lib/useUser';
import { useViewMode } from '../../../components/ViewModeContext';
import { Breadcrumbs, SkeletonCard } from '../../../components/UI';
import * as schemaCoverage from '../../../lib/schema/coverage';
import { filterProvisionsForViewMode } from '../../../components/review/table-logic';

function shortId(value) {
  return value ? String(value).slice(0, 8) : '-';
}

export default function NeedsReviewPage() {
  useUser({ redirectTo: '/login' });
  const router = useRouter();
  const { isEdit } = useViewMode();
  const dealId = typeof router.query.id === 'string' ? router.query.id : null;
  const { deal, loading: dealLoading } = useDeal(dealId);
  const { provisions, loading: provisionsLoading } = useProvisions({ deal_id: dealId });
  const loading = dealLoading || provisionsLoading || !dealId;

  const rows = useMemo(() => {
    if (!Array.isArray(provisions)) return [];
    return filterProvisionsForViewMode(provisions, isEdit).flatMap((provision) => schemaCoverage.emptyFieldRowsForProvision(provision, {
      states: ['needs_review'],
    }));
  }, [provisions, isEdit]);

  return (
    <div className="space-y-6 max-w-6xl">
      <Breadcrumbs items={[
        { label: 'Dashboard', href: '/' },
        { label: 'Review', href: '/review' },
        { label: deal ? `${deal.acquirer} / ${deal.target}` : 'Deal', href: dealId ? `/review/${dealId}` : '/review' },
        { label: 'Needs Review' },
      ]} />

      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="font-display text-2xl text-ink">Needs Review</h1>
          <p className="mt-1 text-sm font-ui text-inkLight">
            {deal ? `${deal.acquirer} / ${deal.target}` : 'Loading deal'} · {rows.length} fields
          </p>
        </div>
        {dealId && (
          <Link
            href={`/review/${dealId}`}
            className="rounded border border-border px-3 py-1.5 text-sm font-ui text-inkLight hover:border-accent hover:text-ink"
          >
            Back to review
          </Link>
        )}
      </div>

      {loading ? (
        <SkeletonCard />
      ) : rows.length === 0 ? (
        <div className="rounded-lg border border-border bg-white p-8 text-center text-sm font-ui text-inkFaint shadow-sm">
          No schema fields are currently marked needs_review for this deal.
        </div>
      ) : (
        <div className="overflow-x-auto rounded-lg border border-border bg-white shadow-sm">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border bg-bg/50">
                <th className="px-4 py-3 text-left font-ui font-medium text-inkLight">Provision</th>
                <th className="px-4 py-3 text-left font-ui font-medium text-inkLight">Feature</th>
                <th className="px-4 py-3 text-left font-ui font-medium text-inkLight">State</th>
                <th className="px-4 py-3 text-right font-ui font-medium text-inkLight">Action</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => (
                <tr key={`${row.provision_id}:${row.feature_key}`} className="border-b border-border last:border-0">
                  <td className="px-4 py-3">
                    <div className="font-ui text-ink">{row.type || '-'} · {row.category || row.code || '-'}</div>
                    <div className="mt-0.5 text-[10px] font-ui text-inkFaint">
                      {row.section_number ? `§ ${row.section_number}` : shortId(row.provision_id)}
                    </div>
                  </td>
                  <td className="px-4 py-3">
                    <div className="font-ui text-ink">{row.label}</div>
                    <div className="mt-0.5 font-mono text-[10px] text-inkFaint">{row.feature_key}</div>
                  </td>
                  <td className="px-4 py-3 font-ui text-amber-700">{row.state}</td>
                  <td className="px-4 py-3 text-right">
                    <Link
                      href={isEdit ? `/review/${dealId}?mode=edit&edit=${row.provision_id}` : `/review/${dealId}/provision/${row.provision_id}`}
                      className="inline-flex rounded bg-accent px-3 py-1.5 text-xs font-ui text-white hover:bg-accent/90"
                    >
                      Open
                    </Link>
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
