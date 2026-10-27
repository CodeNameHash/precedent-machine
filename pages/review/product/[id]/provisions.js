import Link from 'next/link';
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
const INTER = "'Inter Tight', 'Inter', ui-sans-serif, -apple-system, 'Segoe UI', Roboto, sans-serif";
const SERIF = "'Source Serif 4', Georgia, 'Times New Roman', serif";
const PAGE_STYLE = { '--font-sans': INTER, '--font-serif': SERIF, '--accent-rgb': '3 32 61', '--accent-soft': '#F1F4F8', fontFamily: INTER, color: '#03203D' };
// The state badge as a small rounded-[2px] chip in a soft tint, no border.
// The run's provider, in the eyebrow row beside the state chip (work package
// 3: the run page shows which account paid).
const PROVIDER_LABELS = { ANTHROPIC_API: 'Anthropic API', ANTHROPIC_CLAUDE_CLI_SUBSCRIPTION: 'Claude subscription', OPENAI_CODEX_CLI_SUBSCRIPTION: 'Codex subscription', ANTHROPIC: 'In-request API' };
function providerLabel(progress) {
  const id = progress && progress.provider;
  return id ? (PROVIDER_LABELS[id] || id) : null;
}
// The worker sandbox the run is on (plan finding (140)), beside the
// provider while the run is in progress; nothing once it has finished.
function sandboxLabel(progress) {
  const name = progress && progress.sandbox;
  return name && progress.status !== 'READY' ? `on ${name}` : null;
}
function stateBadge(progress, published) {
  if (progress && progress.status === 'FAILED') return { label: 'Run failed', className: 'bg-amber-50 text-amber-700' };
  if (progress && progress.status !== 'READY') return { label: 'In progress', className: 'bg-amber-50 text-amber-700' };
  if (published) return { label: 'Finalised review', className: 'bg-[#03203D] text-white' };
  return { label: 'Draft', className: 'bg-[#F1F4F8] text-[#0B3D71] border border-[#B9C8DA]' };
}

// Work package 27 (plan finding (237), 2026-10-23). Ben, on where a held
// fact goes when it has no home: "I think a section at the bottom of the
// page (if not section understood for the facts) or a at the bottom of the
// relevant section (e.g. termination) for those without a home". The
// section-bottom half is HeldFacts in ProvisionTables (work package 17);
// this is the page-bottom half for a held fact whose structure node is null
// or whose section did not load (Apogee 88d4032a: 9 held, none of them
// unplaced; the block stays out until one is). It is quiet, in the same
// 9.5px font-ui / #6b6b6b registry as the held line under a section, names
// the section where the structure knows it, and shows the fact's own
// summary so a lawyer can identify it. Nothing when the list is empty.
function UnplacedHeldFacts({ entries }) {
  if (!entries || entries.length === 0) return null;
  return (
    <section className="mt-[18.5px] border-t border-[#ececec] pt-[9.5px] font-ui text-[9.5px] text-[#6b6b6b]" aria-labelledby="unplaced-held-heading" data-testid="unplaced-held">
      <h2 id="unplaced-held-heading" className="font-ui text-[9.5px] font-medium uppercase tracking-[0.08em] text-[#6b6b6b]">Facts the model proposed that could not be placed in a table</h2>
      <ul className="mt-[2.5px] space-y-[1px]">
        {entries.map((entry, index) => (
          <li key={`${entry.fact_id}-${index}`} data-testid="unplaced-held-fact">
            {entry.section_reference ? <span>{`§ ${entry.section_reference} · `}</span> : null}
            <span className="text-[#1f1f1f]">{entry.summary || entry.statement || entry.components_summary || entry.fact_id}</span>
            <span data-testid="unplaced-held-reason">{` — ${entry.reason}`}</span>
          </li>
        ))}
      </ul>
    </section>
  );
}

// Plan finding (246), work package 33: the silent absence. A section that
// returned no facts used to leave no trace on the page, so its absence read
// as "this agreement has no such provision". Ben's bar: a section that
// returns no facts must never read that way. The page names every
// substantive section that produced no fact at all, in section order, with
// the reason and one sentence that says what the absence does and does not
// mean. Quiet, in the same 9.5px registry as the drift and out-of-scope
// lines. Nothing when every section produced a fact.
const NO_FACTS_REASONS = {
  READ_AS_IMMATERIAL: 'the analysis read this section as having no provision of the catalogued families',
  RETURNED_NOTHING: 'the families routed to this section produced no fact',
  UNCLASSIFIED_PROVISION: 'the analysis flagged words here it could not classify',
  NOT_RECORDED: 'the stored analysis does not say which families this section was read for',
  NOT_ANALYSED: 'the run did not reach this section',
};

function SectionsWithoutFacts({ entries }) {
  if (!entries || entries.length === 0) return null;
  return (
    <section className="mt-[7px]" aria-labelledby="no-facts-heading" data-testid="sections-without-facts">
      <h2 id="no-facts-heading" className="text-[9.5px] font-ui font-medium uppercase tracking-[0.08em] text-[#6b6b6b]">Sections with no facts extracted</h2>
      <ul className="mt-[2.5px] space-y-[2px]">
        {entries.map((entry) => (
          <li key={entry.structure_node_id || entry.section_reference} className="text-[9.5px] font-ui text-[#6b6b6b]" data-testid="section-without-facts">
            <span className="text-[#1f1f1f]">{`§ ${entry.section_reference}${entry.heading ? ` ${entry.heading}` : ''}`}</span>
            {` — no facts were extracted: ${NO_FACTS_REASONS[entry.reason] || NO_FACTS_REASONS.NOT_RECORDED}. This is not a finding that the agreement has no such provision.`}
          </li>
        ))}
      </ul>
    </section>
  );
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
    <div className="pw-provisions flex min-h-screen bg-white text-[#03203D]" style={PAGE_STYLE} data-testid="provisions-page">
      <Head><title>{`Corpus - ${title}`}</title></Head>
      {preview.facts.length === 0 ? (
        <div className="p-[9.5px] md:p-[18.5px]">
          <EmptyState icon="" title={live ? 'No sections in yet' : 'No layered facts'} description={live ? 'The first completed section appears here within a few minutes.' : 'This run has no valid layered (V2) facts to show.'} />
          {/* Work package 39 (the review of 2026-10-25, finding 10): a run
              whose every section returned nothing is exactly the silent
              absence this block exists for, so it renders here too. */}
          <SectionsWithoutFacts entries={preview.sections_without_facts} />
          <UnplacedHeldFacts entries={preview.unplaced_held} />
        </div>
      ) : (
        <>
          <ProvisionRail sections={tableShapesV3.sections} title={title} />
          <div className="min-w-0 flex-1 px-[9px] py-[18.5px] md:px-[18.5px] lg:pb-[56px] lg:pl-[37px] lg:pr-[56px] lg:pt-[37px]">
            <header className="mb-[16px]" data-testid="preview-header">
              <div className="flex flex-wrap items-center gap-[7px]">
                <p className="font-ui text-[9.5px] uppercase tracking-[0.14em] text-[#6B7785]">Lawyer preview</p>
                <span className={`inline-flex items-center rounded-full px-[6px] py-[1px] text-[9px] font-ui font-medium uppercase tracking-wide ${badge.className}`} data-testid="preview-badge">{badge.label}</span>
                {providerLabel(progress) ? <span className="font-ui text-[9px] uppercase tracking-[0.12em] text-[#6b6b6b]" data-testid="preview-provider">{providerLabel(progress)}</span> : null}
                {sandboxLabel(progress) ? <span className="font-ui text-[9px] tracking-[0.08em] text-[#6b6b6b]" data-testid="preview-sandbox">{sandboxLabel(progress)}</span> : null}
              </div>
              <h1 className="mt-[8px] font-sans text-[30px] font-bold leading-[.98] tracking-[-.05em] text-[#03203D] md:text-[38px]">{title}</h1>
              {/* Ben, 2026-09-14: "please remove 'State: draft, not published /
                  Date / Source / Generation' and the facts count line". The
                  header is the eyebrow, the state badge, the title and the
                  rule. */}
              {/* Draft-level schema drift (plan finding (38), 2026-09-14): a
                  fact type the schema gained after a section was extracted.
                  One line per entry, set like the metadata line was, only
                  when the draft recorded any; the tables below are unchanged.
                  Ben: "look at all of the output yourself and analyze if you
                  think it is right or wrong and if not, iterate to improve
                  it": the reader sees which sections this generation did not
                  ask about a fact type, instead of reading their silence as
                  coverage. */}
              {/* Work package 18 (e) as revised (2026-10-18): an exhibit that
                  is a separate agreement is out of this product's scope and
                  was not extracted; one quiet line names it. Ben: "For CVRs -
                  I want to build a separate product for that os I'd leave
                  those". */}
              {(preview.out_of_scope || []).length > 0 ? (
                <div className="mt-[7px] space-y-[2px]" data-testid="preview-out-of-scope">
                  {preview.out_of_scope.map((entry) => (
                    <p key={entry.issue_id} className="text-[9.5px] font-ui text-[#6b6b6b]" data-testid="preview-out-of-scope-line">
                      {`Out of scope: ${entry.section_reference.replace(/-/g, ' ')}${entry.title ? `, ${entry.title}` : ''}, a separate agreement; not extracted in this product.`}
                    </p>
                  ))}
                </div>
              ) : null}
              {preview.schema_drift.length > 0 ? (
                <div className="mt-[7px] space-y-[2px]" data-testid="preview-schema-drift">
                  {preview.schema_drift.map((entry) => (
                    <p key={entry.issue_id} className="text-[9.5px] font-ui text-[#6b6b6b]" data-testid="preview-schema-drift-line">
                      {`Section ${entry.section_reference}: ${entry.fact_type}${entry.family_key ? ` (${entry.family_key})` : ''} joined the schema after this section was extracted; not covered in this generation.`}
                    </p>
                  ))}
                </div>
              ) : null}
              <SectionsWithoutFacts entries={preview.sections_without_facts} />
              {live && progress.status !== 'FAILED' ? <p className="mt-[7px] rounded-[2px] bg-amber-50 px-[7px] py-[4.5px] text-[9.5px] font-ui text-amber-700" data-testid="preview-live">Filling in as sections complete. This page refreshes itself every minute.</p> : null}
              <div className="mt-[16px] h-[10px] w-full bg-[#B9C8DA]" data-testid="preview-rule" aria-hidden="true" />
            </header>
            <PublishedSummary
              groups={[{ family_key: 'ALL', collapsed: false, facts: preview.facts }]}
              view="tables"
              heading={null}
              tableShapes={tableShapesV3}
              legalSchema={legalSchemaV2}
              sectionTextByFactId={preview.sectionTextByFactId}
              reviewItemsByFactId={preview.reviewItemsByFactId}
              heldFacts={preview.held_facts || []}
              initialShowCodes
            />
            <UnplacedHeldFacts entries={preview.unplaced_held} />
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
    // The server decides freshness: `no-store` while the run is analysing,
    // a minute of private cache once it is READY or FAILED (preview-handler),
    // so a reload of a finished page does not pay the 16-second read again.
    const load = () => fetch(`/api/product/analysis/${id}/preview`)
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
  return (
    <>
      {/* The page renders without the shell, so it carries its own way back
          (work package 53, finding (296)). */}
      <div className="p-[18.5px] pb-0">
        <Link href={`/review/product/${id}`} className="text-sm font-ui text-accent hover:underline">← Back to the review</Link>
      </div>
      <ProvisionsPreviewBody workspace={workspace} runId={id} />
    </>
  );
}
ProvisionsPreviewPage.noLayout = true;
