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
  return (
    <div className="space-y-6">
      <Breadcrumbs items={[
        { label: 'Dashboard', href: '/' },
        { label: 'Review', href: '/review' },
        { label: 'Agreement review', href: `/review/product/${runId}` },
        { label: 'Lawyer preview' },
      ]} />
      <div>
        <p className="text-xs uppercase tracking-wide text-inkLight">Lawyer preview · {published ? 'finalised review' : 'draft, not published'}</p>
        <h1 className="font-display text-2xl text-ink">{title}</h1>
        <p className="mt-1 text-sm text-inkLight" data-testid="preview-counts">
          {preview.facts.length} layered facts across {preview.section_count} sections{preview.held_count ? ` · ${preview.held_count} held by validation, not shown` : ''}. Click a pill to see the words behind it.
        </p>
      </div>
      {preview.facts.length === 0 ? (
        <EmptyState icon="" title="No layered facts" description="This run has no valid layered (V2) facts to show." />
      ) : (
        <div className="flex gap-8">
          <ProvisionRail sections={tableShapesV3.sections} />
          <div className="min-w-0 flex-1">
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
  useEffect(() => {
    if (!id) return undefined;
    let cancelled = false;
    setError('');
    fetch(`/api/product/review/${id}`, { cache: 'no-store' })
      .then(async (response) => {
        const value = await response.json();
        if (!response.ok) throw new Error(value.error || 'Review could not load');
        return value;
      })
      .then((value) => { if (!cancelled) setWorkspace(value); })
      .catch((failure) => { if (!cancelled) setError(failure.message); });
    return () => { cancelled = true; };
  }, [id]);
  if (error) return <div className="p-8"><ErrorState message={error} /></div>;
  if (!id || !workspace) return <div className="space-y-4 p-8"><SkeletonCard /><SkeletonCard /></div>;
  return <ProvisionsPreviewBody workspace={workspace} runId={id} />;
}
