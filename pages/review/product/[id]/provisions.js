import { useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/router';
import { useUser } from '../../../../lib/useUser';
import { Breadcrumbs, ErrorState, SkeletonCard, EmptyState } from '../../../../components/UI';
import PublishedSummary from '../../../../components/product/PublishedSummary.jsx';
import ProvisionRail from '../../../../components/product/ProvisionRail.jsx';
import { displayIdentityParties } from '../../../../lib/product/identity-display';
import { previewFactsFromWorkspace } from '../../../../lib/product/provisions-preview';
import legalSchemaV2 from '../../../../contracts/product/legal-schema.v2.json';
import tableShapesV3 from '../../../../contracts/product/table-shapes.v3.json';

// Lawyer preview of one run: the draft's valid layered facts in the table
// layout (mockup approved by Ben 2026-09-12/13), read-only. The review page
// stays the place to decide; this page shows what a reader would see.
export function ProvisionsPreviewBody({ workspace, runId }) {
  const preview = useMemo(() => previewFactsFromWorkspace(workspace), [workspace]);
  const source = workspace.analysis.source_document || {};
  const title = displayIdentityParties(source.display_parties || source.parties, 'Agreement analysis');
  const published = workspace.review?.state?.status && workspace.review.state.status !== 'DRAFT';
  const progress = workspace.progress || null;
  const live = !!progress && progress.status !== 'READY';
  const stateLabel = live
    ? `${progress.status === 'FAILED' ? 'run failed' : 'analysis in progress'}, ${progress.completed} of ${progress.total} sections in`
    : (published ? 'finalised review' : 'draft, not published');
  return (
    <div className="space-y-6">
      <Breadcrumbs items={[
        { label: 'Dashboard', href: '/' },
        { label: 'Review', href: '/review' },
        { label: 'Agreement review', href: `/review/product/${runId}` },
        { label: 'Lawyer preview' },
      ]} />
      {preview.facts.length === 0 ? (
        <EmptyState icon="" title={live ? 'No sections in yet' : 'No layered facts'} description={live ? 'The first completed section appears here within a few minutes.' : 'This run has no valid layered (V2) facts to show.'} />
      ) : (
        <div className="flex gap-8">
          <ProvisionRail sections={tableShapesV3.sections} title={title} subtitle="Agreement review" />
          <div className="min-w-0 flex-1">
            {/* Page header in the Deal Storylines style: eyebrow, title, rule. */}
            <header className="mb-6" data-testid="preview-header">
              <p className="font-mono text-[11px] uppercase tracking-[0.14em] text-inkLight" data-testid="preview-state">Lawyer preview · {stateLabel}</p>
              <h1 className="mt-2 font-sans text-4xl font-bold tracking-tight text-ink">Provisions</h1>
              <p className="mt-2 text-sm text-inkLight" data-testid="preview-counts">
                {preview.facts.length} layered facts across {preview.section_count} sections{preview.held_count ? ` · ${preview.held_count} held by validation, not shown` : ''}. Click a row or a pill for the words behind it.
              </p>
              <div className="mt-4 h-[2px] w-full bg-ink" />
              {live && progress.status !== 'FAILED' ? <p className="mt-3 rounded border border-amber-300 bg-amber-50 p-2 text-xs text-amber-950" data-testid="preview-live">Filling in as sections complete. This page refreshes itself every minute.</p> : null}
            </header>
            <PublishedSummary
              groups={[{ family_key: 'ALL', collapsed: false, facts: preview.facts }]}
              view="tables"
              tableShapes={tableShapesV3}
              legalSchema={legalSchemaV2}
              sectionTextByFactId={preview.sectionTextByFactId}
              reviewItemsByFactId={preview.reviewItemsByFactId}
            />
          </div>
        </div>
      )}
    </div>
  );
}

export default function ProvisionsPreviewPage() {
  useUser({ redirectTo: '/login' });
  const router = useRouter();
  const id = Array.isArray(router.query.id) ? router.query.id[0] : router.query.id;
  const [workspace, setWorkspace] = useState(null);
  const [error, setError] = useState('');
  // The preview read returns every completed section whether or not the run
  // has finalised; while the run is still analysing, poll it once a minute.
  useEffect(() => {
    if (!id) return undefined;
    let cancelled = false;
    let timer = null;
    const load = () => fetch(`/api/product/analysis/${id}/preview`, { cache: 'no-store' })
      .then(async (response) => {
        const value = await response.json();
        if (!response.ok) throw new Error(value.error || 'Preview could not load');
        return value;
      })
      .then((value) => {
        if (cancelled) return;
        setError('');
        setWorkspace(value);
        if (value.progress && !['READY', 'FAILED'].includes(value.progress.status)) timer = setTimeout(load, 60000);
      })
      .catch((failure) => { if (!cancelled) setError(failure.message); });
    load();
    return () => { cancelled = true; if (timer) clearTimeout(timer); };
  }, [id]);
  if (error) return <div className="p-8"><ErrorState message={error} /></div>;
  if (!id || !workspace) return <div className="space-y-4 p-8"><SkeletonCard /><SkeletonCard /></div>;
  return <ProvisionsPreviewBody workspace={workspace} runId={id} />;
}
