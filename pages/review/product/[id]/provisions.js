import { useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/router';
import { useUser } from '../../../../lib/useUser';
import { ErrorState, SkeletonCard, EmptyState } from '../../../../components/UI';
import PublishedSummary from '../../../../components/product/PublishedSummary.jsx';
import ProvisionRail from '../../../../components/product/ProvisionRail.jsx';
import { previewFactsFromWorkspace } from '../../../../lib/product/provisions-preview';
import legalSchemaV2 from '../../../../contracts/product/legal-schema.v2.json';
import tableShapesV3 from '../../../../contracts/product/table-shapes.v3.json';

// Lawyer preview of one run: the draft's valid layered facts in the table
// layout (mockup approved by Ben 2026-09-12/13), read-only. The review page
// stays the place to decide; this page shows what a reader would see.
// Ben, 2026-09-14: "the background summary app lives on deal corpus - I
// want you to completely copy the visual style - including the page
// header." The header is the legacy deal page's header card
// (pages/deals/[id].js): a white card, the "Acquirer / Target" title in
// font-display, a small uppercase badge beside it, and one font-ui metadata
// line of "Label: value" pairs in ink-light / ink-mid, with what the run
// knows: agreement date, SEC source, generation and state.
// Compared rendered against the deal page on 2026-09-14: the deal page's
// title is "Acquirer / Target", two names and nothing else, so the title
// here is the parent's and the company's names (no role suffixes, no merger
// sub, no caption "among"); the badge then sits on the title line as it
// does there; the counts sentence is set like the metadata line; and the
// deal page has no "Published summary" heading between the header card and
// the first section, so this page shows none either.
function dealTitle(parties, fallback) {
  if (!Array.isArray(parties) || parties.length === 0) return fallback;
  const nameOf = (party) => (typeof party === 'string' ? party : (party && typeof party.name === 'string' ? party.name : ''))
    .trim().replace(/^(?:by\s+and\s+)?(?:among|between)\s+/i, '');
  const roleOf = (party) => (party && typeof party === 'object' && typeof party.role === 'string' ? party.role.toUpperCase() : '');
  const parent = parties.find((party) => ['PARENT', 'BUYER', 'ACQUIRER'].includes(roleOf(party)));
  const company = parties.find((party) => ['COMPANY', 'TARGET'].includes(roleOf(party)));
  const picked = parent && company ? [parent, company] : parties.filter((party) => roleOf(party) !== 'MERGER_SUB');
  const names = picked.map(nameOf).filter(Boolean);
  return names.length ? names.join(' / ') : fallback;
}
function formatAgreementDate(value) {
  if (!value) return null;
  const date = new Date(`${value}T00:00:00Z`);
  return Number.isNaN(date.getTime()) ? String(value) : date.toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric', timeZone: 'UTC' });
}

function stateBadge(progress, published) {
  if (progress && progress.status === 'FAILED') return { label: 'Run failed', className: 'bg-amber-50 text-amber-700 border-amber-200' };
  if (progress && progress.status !== 'READY') return { label: 'In progress', className: 'bg-amber-50 text-amber-700 border-amber-200' };
  if (published) return { label: 'Finalised review', className: 'bg-sky-50 text-sky-700 border-sky-200' };
  return { label: 'Draft', className: 'bg-gray-100 text-inkLight border-border' };
}

export function ProvisionsPreviewBody({ workspace, runId }) {
  const preview = useMemo(() => previewFactsFromWorkspace(workspace), [workspace]);
  const source = workspace.analysis.source_document || {};
  const title = dealTitle(source.display_parties || source.parties, 'Agreement analysis');
  const published = workspace.review?.state?.status && workspace.review.state.status !== 'DRAFT';
  const progress = workspace.progress || null;
  const live = !!progress && progress.status !== 'READY';
  const stateLabel = live
    ? `${progress.status === 'FAILED' ? 'run failed' : 'analysis in progress'}, ${progress.completed} of ${progress.total} sections in`
    : (published ? 'finalised review' : 'draft, not published');
  const badge = stateBadge(progress, published);
  const agreementDate = formatAgreementDate(source.agreement_date);
  const secLabel = [source.exhibit_type, source.filing_accession].filter(Boolean).join(' · ') || (source.retrieval_url ? 'SEC EDGAR' : null);
  const generation = progress && Number.isFinite(progress.generation) ? progress.generation : null;
  // Ben, 2026-09-14, on the Corpus top bar and breadcrumbs above the page:
  // "on UI - I still see this at the top and the left hand side bar is not
  // flush to the side of the page?" The page renders without the Corpus
  // shell (no header, no breadcrumbs: ProvisionsPreviewPage.noLayout); the
  // rail is the page's left edge, full height, and the content sits beside
  // it with the deal page's padding.
  return (
    <div className="flex min-h-screen bg-paper" data-testid="provisions-page">
      {preview.facts.length === 0 ? (
        <div className="p-4 md:p-8"><EmptyState icon="" title={live ? 'No sections in yet' : 'No layered facts'} description={live ? 'The first completed section appears here within a few minutes.' : 'This run has no valid layered (V2) facts to show.'} /></div>
      ) : (
        <>
          <ProvisionRail sections={tableShapesV3.sections} title={title} subtitle="Lawyer preview" />
          <div className="min-w-0 flex-1 space-y-6 p-4 md:p-8">
            {/* Deal header card, the legacy deal page's (pages/deals/[id].js). */}
            <header className="bg-white border border-border rounded-lg shadow-sm p-6" data-testid="preview-header">
              <div className="flex flex-wrap items-center gap-2">
                <h1 className="font-display text-2xl text-ink">{title}</h1>
                <span className={`inline-flex items-center text-[10px] font-ui font-medium px-2 py-1 rounded border uppercase tracking-wider ${badge.className}`} data-testid="preview-badge">{badge.label}</span>
              </div>
              <div className="flex flex-wrap gap-4 mt-3 text-sm font-ui text-inkLight" data-testid="preview-state">
                <span>Lawyer preview: <span className="text-inkMid">{stateLabel}</span></span>
                {agreementDate ? <span>Date: <span className="text-inkMid">{agreementDate}</span></span> : null}
                {secLabel ? (
                  <span>Source: {source.retrieval_url
                    ? <a href={source.retrieval_url} target="_blank" rel="noreferrer" className="text-inkMid hover:text-accent hover:underline" data-testid="preview-source-link">{secLabel}</a>
                    : <span className="text-inkMid">{secLabel}</span>}</span>
                ) : null}
                {generation !== null ? <span>Generation: <span className="text-inkMid">{generation}</span></span> : null}
              </div>
              <p className="mt-3 text-sm font-ui text-inkLight" data-testid="preview-counts">
                {preview.facts.length} layered facts across {preview.section_count} sections{preview.held_count ? ` · ${preview.held_count} held by validation, not shown` : ''}. Click a row or a pill for the words behind it.
              </p>
              {live && progress.status !== 'FAILED' ? <p className="mt-3 rounded border border-amber-200 bg-amber-50 p-2 text-xs font-ui text-amber-700" data-testid="preview-live">Filling in as sections complete. This page refreshes itself every minute.</p> : null}
            </header>
            <PublishedSummary
              groups={[{ family_key: 'ALL', collapsed: false, facts: preview.facts }]}
              view="tables"
              heading={null}
              tableShapes={tableShapesV3}
              legalSchema={legalSchemaV2}
              sectionTextByFactId={preview.sectionTextByFactId}
              reviewItemsByFactId={preview.reviewItemsByFactId}
            />
          </div>
        </>
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
ProvisionsPreviewPage.noLayout = true;
