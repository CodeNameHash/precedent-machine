import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useUser } from '../../lib/useUser';
import { Breadcrumbs, EmptyState, SkeletonCard } from '../../components/UI';
import ProductIntakePanel from '../../components/product/ProductIntakePanel';

// The product's run list (work package 53, plan finding (288)): the page a
// reviewer lands on. It lists the runs this actor may open — newest first —
// with the two places a run is read: the review workspace and the lawyer
// preview. The V1 corpus list that used to be here read the `deals` table,
// which the V2 database does not have.
const STATUS_LABEL = {
  QUEUED: 'Queued',
  RUNNING: 'Running',
  READY: 'Ready',
  PARTIAL: 'Partly analysed',
  FAILED: 'Failed',
};

function formatDate(value) {
  if (!value) return '';
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? '' : date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

export default function ReviewIndex() {
  const { user } = useUser({ redirectTo: '/login' });
  const [runs, setRuns] = useState(null);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (!user) return undefined;
    let cancelled = false;
    fetch('/api/product/runs', { headers: { accept: 'application/json' } })
      .then((response) => (response.ok ? response.json() : Promise.reject(new Error(String(response.status)))))
      .then((body) => { if (!cancelled) setRuns(body.runs || []); })
      .catch((failure) => { if (!cancelled) { setRuns([]); setError(failure.message); } });
    return () => { cancelled = true; };
  }, [user]);

  return (
    <div className="space-y-6 max-w-4xl">
      <Breadcrumbs items={[{ label: 'Dashboard', href: '/' }, { label: 'Review' }]} />
      <div>
        <h1 className="font-display text-2xl text-ink">Review agreements</h1>
        <p className="text-sm text-inkLight font-ui mt-1">
          Start a run from an SEC exhibit, then read its facts, provisions and coverage in the review workspace, or read it as a lawyer would on the preview page.
        </p>
      </div>

      <ProductIntakePanel />

      <div className="flex items-center justify-between border-b border-border pb-2">
        <h2 className="font-display text-lg text-ink">Runs</h2>
        <Link href="/query/provisions" className="text-sm font-ui text-accent hover:underline">Query published provisions</Link>
      </div>

      {runs === null ? <SkeletonCard /> : null}
      {error ? <p className="text-sm font-ui text-red-700">The run list could not be read ({error}).</p> : null}
      {runs && runs.length === 0 ? (
        <EmptyState
          icon="+"
          title="No runs yet"
          description="Submit an agreement above; it will appear here when the intake has created it."
        />
      ) : null}
      {runs && runs.length > 0 ? (
        <div className="space-y-2">
          {runs.map((run) => (
            <div key={run.run_id} className="bg-white border border-border rounded-lg shadow-sm p-4">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div>
                  <h3 className="font-display text-base text-ink">{STATUS_LABEL[run.status] || run.status || 'Run'} <span className="font-ui text-xs text-inkLight">{String(run.run_id).slice(0, 8)}</span></h3>
                  <div className="flex flex-wrap gap-3 mt-1 text-xs font-ui text-inkLight">
                    <span>{formatDate(run.created_at)}</span>
                    {run.stage ? <span>{run.stage}</span> : null}
                    {run.source_generation ? <span>generation {run.source_generation}</span> : null}
                    {run.model_config?.provider_id ? <span>{run.model_config.provider_id}</span> : null}
                  </div>
                </div>
                <div className="flex items-center gap-3 text-sm font-ui">
                  <Link href={`/review/product/${run.run_id}`} className="text-accent hover:underline">Review</Link>
                  <Link href={`/review/product/${run.run_id}/provisions`} className="text-accent hover:underline">Provisions</Link>
                </div>
              </div>
            </div>
          ))}
        </div>
      ) : null}
    </div>
  );
}
