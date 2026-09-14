import { useEffect, useMemo, useState } from 'react';
import Head from 'next/head';
import { useRouter } from 'next/router';
import { useUser } from '../../../../lib/useUser';
import { ErrorState, SkeletonCard, EmptyState } from '../../../../components/UI';
import PublishedSummary from '../../../../components/product/PublishedSummary.jsx';
import ProvisionRail from '../../../../components/product/ProvisionRail.jsx';
import { previewFactsFromWorkspace } from '../../../../lib/product/provisions-preview';
import legalSchemaV2 from '../../../../contracts/product/legal-schema.v2.json';
import tableShapesV3 from '../../../../contracts/product/table-shapes.v3.json';

// Ben, 2026-09-14, on the scaled page: "sidebar width now good but font
// size not good". Every width, padding, gap, band height and the page
// title stay; each font size scaled above is raised by 1.3.
// Ben, 2026-09-14, comparing the deployed page with Deal Storylines at the
// same browser zoom ("zoom level is the same"): every dimension of ours was
// about 1.7x the reference, so "please fix relative sizes". Every px size
// below is the first reading divided by 1.73 (scaled by 0.58, to the half
// px): content paddings 37 / 37 / 56, eyebrow 8, title 30, rule 2,
// metadata and counts lines 9.
// Lawyer preview of one run: the draft's valid layered facts in the table
// layout (mockup approved by Ben 2026-09-12/13), read-only. The review page
// stays the place to decide; this page shows what a reader would see.
// Ben, 2026-09-14: "the background summary app lives on deal corpus - I
// want you to completely copy the visual style - including the page
// header." First read as the legacy deal page's header card
// (pages/deals/[id].js); the same day, comparing the result with his Deal
// Storylines app: "also font etc doesn't match the deal storylines page.
// Also their pages are 'cleaner' in style", so the header is now that
// app's page header (eyebrow, large title, one metadata line, a black
// rule; no card). What the deal page comparison settled still holds: the
// title is "Acquirer / Target", the parent's and the company's names and
// nothing else (no role suffixes, no merger sub, no caption "among"); the
// state badge sits beside the eyebrow; the counts sentence is set like the
// metadata line; and there is no "Published summary" heading between the
// header and the first section.
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

// Ben, 2026-09-14, comparing this page with Deal Storylines: "also font
// etc doesn't match the deal storylines page. Also their pages are
// 'cleaner' in style". The page adopts that app's type and surfaces: Inter
// (already self-hosted in styles/mtx-fonts.css as 'Inter', weights 400 to
// 700; the page root overrides --font-sans and --font-serif so everything
// under it, rail and sidebar included, sets in Inter without touching
// other pages), a white page with no page-level cards or shadows, and the
// Storylines blue as the one accent (--accent-rgb overridden on the root so
// the Tailwind accent tokens under the page resolve to it).
const INTER = "'Inter', ui-sans-serif, -apple-system, 'Segoe UI', Roboto, sans-serif";
const PAGE_STYLE = { '--font-sans': INTER, '--font-serif': INTER, '--accent-rgb': '47 86 184', '--accent-soft': '#e9effa', fontFamily: INTER };
// The state badge as a small rounded-[2px] chip in a soft tint, no border.
function stateBadge(progress, published) {
  if (progress && progress.status === 'FAILED') return { label: 'Run failed', className: 'bg-amber-50 text-amber-700' };
  if (progress && progress.status !== 'READY') return { label: 'In progress', className: 'bg-amber-50 text-amber-700' };
  if (published) return { label: 'Finalised review', className: 'bg-[#e9effa] text-[#2f56b8]' };
  return { label: 'Draft', className: 'bg-[#f3f3f3] text-[#555]' };
}

export function ProvisionsPreviewBody({ workspace, runId }) {
  const preview = useMemo(() => previewFactsFromWorkspace(workspace), [workspace]);
  const source = workspace.analysis.source_document || {};
  const title = dealTitle(source.display_parties || source.parties, 'Agreement analysis');
  const published = workspace.review?.state?.status && workspace.review.state.status !== 'DRAFT';
  const progress = workspace.progress || null;
  const live = !!progress && progress.status !== 'READY';
  const badge = stateBadge(progress, published);
  // Ben, 2026-09-14, on the Corpus top bar and breadcrumbs above the page:
  // "on UI - I still see this at the top and the left hand side bar is not
  // flush to the side of the page?" The page renders without the Corpus
  // shell (no header, no breadcrumbs: ProvisionsPreviewPage.noLayout); the
  // rail is the page's left edge, full height, and the content sits beside
  // it.
  // Ben, 2026-09-14: "also font etc doesn't match the deal storylines page.
  // Also their pages are 'cleaner' in style". The content column is the
  // Storylines one: white, 64px top and left padding, 96px right; an
  // uppercase letter-spaced grey eyebrow, the title at 52px semibold in
  // near-black on a tight leading, the run's facts as one grey metadata
  // line, then a 3px black rule across the content width. No header card.
  // Ben, 2026-09-14: "change the title of the page that appears in a
  // browser to Corpus - Pfizer / Metsera": "Corpus - " then the deal
  // title, the parent's and the company's names.
  return (
    <div className="flex min-h-screen bg-white text-[#1f1f1f]" style={PAGE_STYLE} data-testid="provisions-page">
      <Head><title>{`Corpus - ${title}`}</title></Head>
      {preview.facts.length === 0 ? (
        <div className="p-[9.5px] md:p-[18.5px]"><EmptyState icon="" title={live ? 'No sections in yet' : 'No layered facts'} description={live ? 'The first completed section appears here within a few minutes.' : 'This run has no valid layered (V2) facts to show.'} /></div>
      ) : (
        <>
          <ProvisionRail sections={tableShapesV3.sections} title={title} />
          <div className="min-w-0 flex-1 px-[9px] py-[18.5px] md:px-[18.5px] lg:pb-[56px] lg:pl-[37px] lg:pr-[56px] lg:pt-[37px]">
            <header className="mb-[16px]" data-testid="preview-header">
              <div className="flex flex-wrap items-center gap-[7px]">
                <p className="font-ui text-[10px] uppercase tracking-[0.12em] text-[#6b6b6b]">Lawyer preview</p>
                <span className={`inline-flex items-center rounded-full px-[6px] py-[1px] text-[9px] font-ui font-medium uppercase tracking-wide ${badge.className}`} data-testid="preview-badge">{badge.label}</span>
              </div>
              <h1 className="mt-[7px] font-sans text-[23px] font-semibold leading-[1.05] tracking-tight text-[#1f1f1f] md:text-[30px]">{title}</h1>
              {/* Ben, 2026-09-14: "please remove 'State: draft, not published /
                  Date / Source / Generation' and the facts count line". The
                  header is the eyebrow, the state badge, the title and the
                  rule. */}
              {live && progress.status !== 'FAILED' ? <p className="mt-[7px] rounded-[2px] bg-amber-50 px-[7px] py-[4.5px] text-[9.5px] font-ui text-amber-700" data-testid="preview-live">Filling in as sections complete. This page refreshes itself every minute.</p> : null}
              <div className="mt-[16px] h-[2px] w-full bg-black" data-testid="preview-rule" aria-hidden="true" />
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
  if (error) return <div className="p-[18.5px]"><ErrorState message={error} /></div>;
  if (!id || !workspace) return <div className="space-y-[9.5px] p-[18.5px]"><SkeletonCard /><SkeletonCard /></div>;
  return <ProvisionsPreviewBody workspace={workspace} runId={id} />;
}
ProvisionsPreviewPage.noLayout = true;
