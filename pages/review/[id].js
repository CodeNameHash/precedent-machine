// Review — "Mergertrace" design for the deal review page (promoted from
// review-v2 to the production /review/[id] route). Same data as
// pages/review-v1/[id].js (deal row, /api/review/<id>/cards,
// /api/agreement-source), same table configs rendered through the same
// ProvisionTable — only the shell, chrome and skin differ. The old UI is
// kept, unchanged, at /review-v1/[id] as a fallback; /review-v2/[id]
// redirects here.

import { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import { useRouter } from 'next/router';
import Head from 'next/head';
import Link from 'next/link';
import { useDeal } from '../../lib/useSupabaseData';
import { reconstructReviewDeal } from '../../lib/queries/reconstruct-review-deal';
import { useLazyAgreementSource } from '../../lib/useLazyAgreementSource';
import { useUser } from '../../lib/useUser';
import ProvisionTable from '../../components/review/ProvisionTable';
import DealHeader from '../../components/review-v2/DealHeader';
import ProvisionNav from '../../components/review-v2/ProvisionNav';
import AgreementView from '../../components/review-v2/AgreementView';
import MergertraceStyles from '../../components/review-v2/MergertraceStyles';
import MaeSection from '../../components/review-v2/MaeSection';
import ElectionCard from '../../components/review-v2/ElectionCard';
import ProvisionIndex, { DefinitionsSection } from '../../components/review-v2/ProvisionIndex';
import ClauseSidebar from '../../components/review-v2/ClauseSidebar';
import SourceOverlay from '../../components/review-v2/SourceOverlay';
import { resolveCardSourceSpan } from '../../lib/parser-v2/resolve-source-span';
import {
  buildReviewV2Sections,
  deriveExtractedHeaderFacts,
  deriveElectionSummary,
  groupCardsBySection,
  EMPTY_REVIEW_DEAL,
  MAE_SECTION_ID,
} from '../../components/review-v2/sectionList';
// Compare/market modes (?compare=<dealId>[,<dealId2>] / ?market=1) — the
// deal-compare and deal-to-market query kinds render HERE now, as extra
// columns on the normal review page (Ben: "they should look EXACTLY like
// the main review page in terms of the main body").
import {
  parseCompareIds,
  useComparedDeals,
  useSectionMarketStats,
  useDealToMarket,
  dominantSectionCode,
} from '../../components/review-v2/compareData';
import CompareSectionColumn, { ColumnHeaderBand } from '../../components/review-v2/CompareColumn';
import { MarketSectionColumn, OffMarketSection } from '../../components/review-v2/MarketColumn';

const CONSIDERATION_SECTION_ID = 'consideration-hero';

// Q7 (perf quick-wins): Tinos/Inter/IBM Plex Mono are self-hosted (see
// styles/mtx-fonts.css, imported globally in pages/_app.js) — no external
// fonts.googleapis.com <link> needed here anymore. components/chrome/
// mtxFonts.js's MtxFontLinks/MTX_FONTS_HREF (added on main after this page
// already self-hosted) is superseded by the same global stylesheet — see
// the merge-resolution commit for the rest of that cleanup.

function LoadingLine({ children }) {
  return (
    <p className="mtx-meta-label text-[10px] tracking-[0.16em] px-5 lg:px-9 py-10">{children}</p>
  );
}

function SectionBlock({ section, reviewDeal, sectionCards, onSelectCard, selectedCardId, election, onViewInAgreement, extraColumns = null }) {
  // Ben (Mergertrace round 1): every section collapsible. Native <details>
  // (open by default) so the scrollspy/anchor <section> wrapper and the
  // sec-<id> ids are untouched; ProvisionNav's jump() re-opens a collapsed
  // section before scrolling.
  //
  // Compare/market modes: `extraColumns` ([{ key, header, body }]) renders
  // a per-section CSS grid — the primary deal's body exactly as today in a
  // wide first track, one narrow (340px) track per compared-deal/Market
  // column beside it, horizontal scroll when the tracks overflow. Section
  // alignment is per-section: each grid row IS one section, so the primary
  // and compared columns always sit side by side for the same section.
  const primaryBody = (
    <>
      {section.id === '__definitions' ? (
        <DefinitionsSection definitions={reviewDeal.definitions} />
      ) : section.id === MAE_SECTION_ID ? (
        <MaeSection config={section.config} reviewDeal={reviewDeal} onSelectCard={onSelectCard} selectedCardId={selectedCardId} />
      ) : (
        <>
          {section.id === CONSIDERATION_SECTION_ID && election ? <ElectionCard election={election} /> : null}
          <ProvisionTable
            config={section.config}
            reviewDeal={reviewDeal}
            isEdit={false}
            sectionCards={sectionCards}
            onSelectCard={onSelectCard}
            selectedCardId={selectedCardId}
          />
        </>
      )}
      {section.id !== '__definitions' && sectionCards && sectionCards.length ? (
        <ProvisionIndex cards={sectionCards} sectionTitle={section.title} onSelect={onSelectCard} selectedId={selectedCardId} onViewInAgreement={onViewInAgreement} />
      ) : null}
    </>
  );
  return (
    <section id={`sec-${section.id}`} className="scroll-mt-28">
      <details open className="mtx-section">
        <summary
          className="flex items-center gap-2.5 pb-2 border-b-2 border-black cursor-pointer select-none"
          style={{ listStyle: 'none' }}
        >
          <span className="w-2.5 h-2.5" style={{ background: section.dot, borderRadius: '9999px' }} />
          <h2 className="text-base font-bold tracking-tight text-[#1F1F1F]">{section.title}</h2>
          <span aria-hidden="true" className="mtx-section-caret ml-auto text-[10px] text-[#6B6B6B]">▾</span>
        </summary>
        {extraColumns && extraColumns.length ? (
          <div className="mt-4 overflow-x-auto">
            <div
              className="grid gap-6 items-start"
              style={{ gridTemplateColumns: `minmax(420px, 1fr) repeat(${extraColumns.length}, 340px)` }}
              data-testid={`compare-grid-${section.id}`}
            >
              <div className="min-w-0">{primaryBody}</div>
              {extraColumns.map((col) => (
                <div key={col.key} className="min-w-0">
                  {col.header}
                  {col.body}
                </div>
              ))}
            </div>
          </div>
        ) : (
          <div className="mt-4">{primaryBody}</div>
        )}
      </details>
    </section>
  );
}

export default function ReviewPage() {
  const router = useRouter();
  // Tolerate stray punctuation glued onto the id (e.g. a trailing "." from a
  // link in prose) — extract the first UUID-shaped token.
  const dealId = useMemo(() => {
    if (!router.isReady || !router.query.id) return null;
    const raw = String(router.query.id);
    const m = raw.match(/[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}/);
    return m ? m[0] : raw;
  }, [router.isReady, router.query.id]);
  useUser({ redirectTo: '/login' });

  // With junk after the uuid in the path (e.g. a trailing "."), Next's router
  // never hydrates the query (isReady stays false) and the page hangs on
  // Loading — normalise the URL itself on mount.
  useEffect(() => {
    if (typeof window === 'undefined') return;
    const m = window.location.pathname.match(
      /^\/review\/([0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12})(.+)$/,
    );
    if (m) router.replace(`/review/${m[1]}`);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Q3 (perf quick-wins): this page's DealHeader/sectionList only read
  // scalars + deal_facts/advisors_v2/merger_form/topology — use the slim
  // ?view=header response instead of the full deal row (which ships
  // metadata.full_text/classified_sections/extraction_runs, 735KB-1.5MB raw).
  const { deal, loading: dealLoading, error: dealError } = useDeal(dealId, { view: 'header' });

  // E4 (2026-07-19 pre-demo audit): an unknown/garbage deal id used to
  // render the masthead + nav chrome forever with no deal data and no
  // explicit message — useFetch() (lib/useSupabaseData.js) resolved a 404
  // as a "successful" fetch (data = { error }, so `deal` fell through to
  // null with `loading: false` and `error: null`), which this page never
  // distinguished from a normal empty/loading state. Now that useFetch
  // surfaces non-2xx as a real error, `notFound` covers both a genuine 404
  // (dealError set) and the same "resolved, but nothing came back" shape.
  const notFound = router.isReady && Boolean(dealId) && !dealLoading && (Boolean(dealError) || !deal);

  /* ── Cards payload (same fetch/normalisation as v1) ── */
  const [reviewDeal, setReviewDeal] = useState(null);
  const [cardsLoading, setCardsLoading] = useState(false);
  const [cardsError, setCardsError] = useState(null);

  useEffect(() => {
    if (!router.isReady || !dealId) {
      setReviewDeal(null);
      setCardsLoading(false);
      setCardsError(null);
      return undefined;
    }
    let cancelled = false;
    setCardsLoading(true);
    setCardsError(null);
    fetch(`/api/review/${encodeURIComponent(dealId)}/cards`)
      .then(async (response) => {
        const payload = await response.json().catch(() => ({}));
        if (!response.ok) throw new Error(payload.error || `HTTP ${response.status}`);
        // Q1/Q2: the API no longer ships sections[]/definitions[] (verbatim
        // duplicates of cards[]) or per-card resolvedReferences/
        // region_full_text — rebuild them client-side.
        return payload.reviewDeal ? reconstructReviewDeal(payload.reviewDeal) : null;
      })
      .then((next) => {
        if (!cancelled) setReviewDeal(next);
      })
      .catch((error) => {
        if (!cancelled) {
          setReviewDeal(null);
          setCardsError(error.message || String(error));
        }
      })
      .finally(() => {
        if (!cancelled) setCardsLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [router.isReady, dealId]);

  /* ── Agreement source (Q4, perf quick-wins) ── deferred to
     requestIdleCallback after the tables above have rendered; ensureLoaded()
     fetches immediately on-demand if the overlay/agreement view is opened
     before idle fires. */
  const {
    agreementSource,
    loading: sourceLoading,
    attempted: sourceAttempted,
    ensureLoaded: ensureAgreementSourceLoaded,
  } = useLazyAgreementSource(dealId);

  /* ── Sections ── */
  const reviewDealForTables = useMemo(() => reviewDeal || EMPTY_REVIEW_DEAL, [reviewDeal]);
  const sections = useMemo(() => {
    const base = buildReviewV2Sections(reviewDealForTables, deal);
    // Defined terms — same payload, own section at the end (v1 exposes
    // these through its sidebar Definitions group; without this they were
    // unreachable from v2 entirely).
    if ((reviewDealForTables.definitions || []).length > 0) {
      base.push({ id: '__definitions', title: 'Definitions', config: null, dot: '#8A8782' });
    }
    return base;
  }, [reviewDealForTables, deal]);
  const cardsBySection = useMemo(() => groupCardsBySection(reviewDealForTables), [reviewDealForTables]);
  const extractedFacts = useMemo(() => deriveExtractedHeaderFacts(reviewDealForTables), [reviewDealForTables]);
  const election = useMemo(() => deriveElectionSummary(reviewDealForTables), [reviewDealForTables]);

  /* ── Compare / market modes ──
     ?compare=<dealId>[,<dealId2>]: one narrow column per compared deal
     beside each section (same configs, same components, read-only).
     ?market=1: a "Market" column per section (corpus-stats for the
     section's dominant subtype) + an "Off-market terms" section on top
     (DEAL_TO_MARKET executor output, commercial fields excluded). The
     provisions nav, scrollspy and corpus sidebar all keep operating on the
     PRIMARY deal only. */
  const compareIds = useMemo(
    () => (router.isReady ? parseCompareIds(router.query.compare, dealId) : []),
    [router.isReady, router.query.compare, dealId],
  );
  const marketMode = router.isReady && ['1', 'true'].includes(String(router.query.market || ''));
  // C (deal-to-market/compare robustness): each hook now returns its data
  // alongside a retry() -- see compareData.js's fetchJson timeout/retry
  // fix -- so a hung/degraded corpus-stats or compared-deal fetch surfaces
  // a real error state with a working retry instead of spinning forever.
  const { columns: comparedDeals, retry: retryComparedDeals } = useComparedDeals(compareIds);
  const sectionCodes = useMemo(() => {
    if (!marketMode) return [];
    return sections
      .filter((s) => s.id !== '__definitions')
      .map((s) => ({ sectionId: s.id, code: dominantSectionCode(cardsBySection.get(s.id)) }));
  }, [marketMode, sections, cardsBySection]);
  const { bySection: marketStats, retry: retryMarketStats } = useSectionMarketStats(marketMode, dealId, sectionCodes);
  const dealToMarket = useDealToMarket(marketMode, dealId);
  const extraColumnCount = comparedDeals.length + (marketMode ? 1 : 0);
  const buildExtraColumns = useCallback((section) => {
    if (!extraColumnCount) return null;
    const cols = comparedDeals.map((col, i) => ({
      key: `cmp-${col.id}`,
      header: <ColumnHeaderBand label={col.name || `Compared deal ${i + 1}`} href={`/review/${col.id}`} />,
      body: <CompareSectionColumn section={section} column={col} onRetry={retryComparedDeals} />,
    }));
    if (marketMode) {
      cols.push({
        key: 'market',
        header: <ColumnHeaderBand label="Market" uppercase />,
        body: <MarketSectionColumn entry={marketStats[section.id]} onRetry={retryMarketStats} />,
      });
    }
    return cols;
  }, [extraColumnCount, comparedDeals, marketMode, marketStats, retryComparedDeals, retryMarketStats]);

  /* ── View toggle ── */
  const [view, setView] = useState('summary');
  // Q4: before the lazy fetch has resolved, assume optimistically that
  // source text exists (most deals have it) so the "Full Merger Agreement"
  // affordance and view-in-agreement links stay clickable pre-idle; once the
  // fetch resolves, reflect reality (a deal that genuinely has no source
  // text reverts to the disabled state).
  const hasAgreementText = sourceAttempted
    ? Boolean(agreementSource && agreementSource.full_text)
    : true;
  const toggleView = useCallback(() => {
    setView((v) => {
      const next = v === 'summary' ? 'agreement' : 'summary';
      if (next === 'agreement') ensureAgreementSourceLoaded();
      return next;
    });
  }, [ensureAgreementSourceLoaded]);
  useEffect(() => {
    if (typeof window !== 'undefined') window.scrollTo(0, 0);
  }, [view]);

  /* ── Scrollspy ── */
  const [activeId, setActiveId] = useState(null);
  const sectionKey = sections.map((s) => s.id).join(',');

  useEffect(() => {
    if (view !== 'summary' || sections.length === 0) return undefined;
    if (!activeId || !sections.some((s) => s.id === activeId)) setActiveId(sections[0].id);
    const obs = new IntersectionObserver(
      (entries) => {
        entries.forEach((e) => {
          if (e.isIntersecting) setActiveId(e.target.id.replace('sec-', ''));
        });
      },
      { rootMargin: '-30% 0px -60% 0px' },
    );
    sections.forEach((s) => {
      const el = document.getElementById(`sec-${s.id}`);
      if (el) obs.observe(el);
    });
    return () => obs.disconnect();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sectionKey, view]);

  // Masthead is auto-height now (metrics wrap at narrow widths) — publish
  // its live height as a CSS var so the sticky nav offset tracks it.
  useEffect(() => {
    if (typeof window === 'undefined') return undefined;
    const el = document.querySelector('header.mtx-masthead');
    if (!el || typeof ResizeObserver === 'undefined') return undefined;
    const apply = () => document.documentElement.style.setProperty('--mtx-head-h', `${el.offsetHeight}px`);
    apply();
    const ro = new ResizeObserver(apply);
    ro.observe(el);
    return () => ro.disconnect();
  }, [view]);

  /* ── Clause sidebar selection (reader mode) ──
     Sidebar feedback package (Ben, r5), item 1: selection now carries an
     optional rowFocus alongside the card (the row's label/featureKeys/
     itemCode/quote -- see resolveRowFocus in provisionIndexHelpers.js) so
     ClauseSidebar can scope its content to the clicked row rather than the
     whole parent card. Item 3: the panel itself is now always mounted (see
     the unconditional <ClauseSidebar> below) -- clearing selection swaps
     back to the sidebar's own empty state instead of unmounting, so there's
     no layout jump. */
  const [selection, setSelection] = useState({ card: null, rowFocus: null });
  // r11: corpus sidebar can be tucked away via the mid-height arrow.
  const [sidebarHidden, setSidebarHidden] = useState(false);
  const selectedCard = selection.card;
  const selectedRowFocus = selection.rowFocus;
  const selectCard = useCallback((card, rowFocus = null) => {
    setSelection((cur) => {
      const curKey = cur.card ? (cur.card.id || cur.card.provision_instance_id) : null;
      const nextKey = card ? (card.id || card.provision_instance_id) : null;
      const sameRow = curKey && curKey === nextKey && (cur.rowFocus || null)?.label === (rowFocus || null)?.label
        && (cur.rowFocus || null)?.itemCode === (rowFocus || null)?.itemCode;
      if (sameRow) return { card: null, rowFocus: null };
      return { card, rowFocus: rowFocus || null };
    });
  }, []);
  const clearSelection = useCallback(() => {
    setSelection({ card: null, rowFocus: null });
  }, []);
  useEffect(() => {
    const onKey = (e) => { if (e.key === 'Escape') clearSelection(); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [clearSelection]);

  /* ── Source overlay (WP-5 / M5-03) — full-doc overlay, exact span
     highlight. The overlay itself only takes {start, end}; resolution
     (offsets → exact-quote → region → unresolved, per
     lib/parser-v2/resolve-source-span.js) happens here, at the one place
     that holds both a card and the agreement's full_text.

     Q4 (perf quick-wins): fullText may not have arrived yet (lazy fetch) —
     openSourceOverlay stores the raw card immediately (so the overlay opens
     with a loading state) and kicks off ensureAgreementSourceLoaded(); span
     resolution is a useMemo that re-runs once fullText lands. */
  const [overlayCard, setOverlayCard] = useState(null);
  const [unresolvedCount, setUnresolvedCount] = useState(0);
  const warnedCardIdsRef = useRef(new Set());
  const fullText = agreementSource && agreementSource.full_text ? agreementSource.full_text : '';

  const openSourceOverlay = useCallback((card) => {
    if (!card) return;
    setOverlayCard(card);
    ensureAgreementSourceLoaded();
  }, [ensureAgreementSourceLoaded]);
  const closeSourceOverlay = useCallback(() => setOverlayCard(null), []);

  const resolvedOverlay = useMemo(() => {
    if (!overlayCard || !fullText) return null;
    return resolveCardSourceSpan(overlayCard, fullText);
  }, [overlayCard, fullText]);

  useEffect(() => {
    if (!overlayCard || !resolvedOverlay) return;
    const cardId = overlayCard.id || overlayCard.provision_instance_id;
    if (resolvedOverlay.status === 'unresolved' && !warnedCardIdsRef.current.has(cardId)) {
      warnedCardIdsRef.current.add(cardId);
      // eslint-disable-next-line no-console
      console.warn('[SourceOverlay] unresolved span for card', cardId, overlayCard.section_ref);
      setUnresolvedCount((n) => n + 1);
    }
  }, [overlayCard, resolvedOverlay]);

  const sourceOverlayLoading = Boolean(overlayCard) && !fullText && (sourceLoading || !sourceAttempted);

  /* ── Deep-link: /review/[id]?card=<card_id> opens the overlay directly
     (fetches the agreement source on-demand — deep links are explicit
     intent, don't wait on idle/fullText to arrive first). ── */
  const openedFromQueryRef = useRef(false);
  useEffect(() => {
    if (!router.isReady || openedFromQueryRef.current) return;
    const cardParam = router.query.card;
    if (!cardParam || !reviewDeal) return;
    const target = String(cardParam);
    const match = (reviewDeal.cards || []).find(
      (c) => String(c.id || c.provision_instance_id) === target,
    );
    if (match) {
      openedFromQueryRef.current = true;
      openSourceOverlay(match);
    }
  }, [router.isReady, router.query.card, reviewDeal, openSourceOverlay]);

  const setAllSections = useCallback((open) => {
    document.querySelectorAll('details.mtx-section').forEach((d) => { d.open = open; });
  }, []);

  const jump = useCallback((id) => {
    const el = document.getElementById(`sec-${id}`);
    if (!el) return;
    const det = el.querySelector('details.mtx-section');
    if (det && !det.open) det.open = true;
    el.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }, []);

  const pageTitle = deal
    ? `${deal.metadata?.target_display || deal.target} — Review`
    : 'Deal Review';

  // E4: clean not-found state instead of the masthead/nav chrome rendering
  // around an empty deal indefinitely. All hooks above run unconditionally
  // on every render regardless of this branch, so it's safe here.
  if (notFound) {
    return (
      <div className="mtx min-h-screen flex flex-col items-center justify-center bg-white gap-3">
        <Head>
          <title>Deal not found</title>
        </Head>
        <MergertraceStyles />
        <p className="mtx-meta-label text-[11px] tracking-[0.18em]">DEAL NOT FOUND</p>
        <p className="font-ui text-sm text-inkMid">This deal doesn&rsquo;t exist, or the link is broken.</p>
        <Link href="/review" className="mtx-btn">Back to deals</Link>
      </div>
    );
  }

  return (
    <div className="mtx min-h-screen flex flex-col bg-white">
      <Head>
        <title>{pageTitle}</title>
      </Head>
      <MergertraceStyles />

      <DealHeader
        deal={deal}
        view={view}
        onToggleView={toggleView}
        hasAgreementText={hasAgreementText}
        extracted={extractedFacts}
      />

      {dealError ? (
        <LoadingLine>Failed to load deal: {String(dealError)}</LoadingLine>
      ) : dealLoading && !deal ? (
        <LoadingLine>Loading deal…</LoadingLine>
      ) : view === 'agreement' ? (
        <div className="flex flex-1 min-h-0">
          <AgreementView agreementSource={agreementSource} loading={sourceLoading || !sourceAttempted} />
        </div>
      ) : (
        <div className="flex flex-1 min-h-0">
          <ProvisionNav sections={sections} activeId={activeId} onJump={jump} />
          <main className="relative flex-1 min-w-0 px-5 lg:px-9 pt-6 pb-7">
            {/* Collapse/expand all — absolutely positioned top-right so the
                main content doesn't move down (Ben round 2). */}
            <div className="absolute right-5 lg:right-9 top-1.5 flex items-center gap-2 z-10">
              <button type="button" onClick={() => setAllSections(false)} className="mtx-meta-label text-[9px] tracking-[0.12em] hover:text-[#1F1F1F]">COLLAPSE ALL</button>
              <span className="text-[9px] text-[#E0E0E0]">|</span>
              <button type="button" onClick={() => setAllSections(true)} className="mtx-meta-label text-[9px] tracking-[0.12em] hover:text-[#1F1F1F]">EXPAND ALL</button>
            </div>
            {cardsError ? (
              <p className="mtx-meta-label text-[10px] tracking-[0.16em] py-4">
                Provision cards unavailable: {cardsError}
              </p>
            ) : null}
            {cardsLoading ? (
              <p className="mtx-meta-label text-[10px] tracking-[0.16em] py-4">Loading provisions…</p>
            ) : null}
            {!cardsLoading && !cardsError && sections.length === 0 ? (
              <p className="mtx-meta-label text-[10px] tracking-[0.16em] py-4">
                No extracted provisions for this deal.
              </p>
            ) : null}

            <div className={extraColumnCount ? 'space-y-10' : 'space-y-10 max-w-3xl mx-auto'}>
              {marketMode ? <OffMarketSection data={dealToMarket} /> : null}
              {sections.map((section) => (
                <SectionBlock
                  key={section.id}
                  section={section}
                  reviewDeal={reviewDealForTables}
                  sectionCards={cardsBySection.get(section.id) || null}
                  onSelectCard={selectCard}
                  selectedCardId={selectedCard ? (selectedCard.id || selectedCard.provision_instance_id) : null}
                  election={section.id === CONSIDERATION_SECTION_ID ? election : null}
                  onViewInAgreement={hasAgreementText ? openSourceOverlay : null}
                  extraColumns={buildExtraColumns(section)}
                />
              ))}
            </div>

            <footer className="mt-12 pt-4 border-t border-[#E0E0E0] flex items-center justify-between">
              <p className="mtx-meta-label text-[9px] tracking-wider">
                Corpus · For internal review · Privileged &amp; confidential
              </p>
              <p className="text-[9px] text-[#6B6B6B]">
                Updated {new Date().toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
              </p>
            </footer>
          </main>
          {/* r11: mid-height arrow to hide/show the corpus sidebar. */}
          <div className="relative hidden lg:block">
            <button
              type="button"
              aria-label={sidebarHidden ? 'Show corpus sidebar' : 'Hide corpus sidebar'}
              onClick={() => setSidebarHidden((v) => !v)}
              className="absolute top-1/2 -translate-y-1/2 -left-3 z-20 w-6 h-10 border border-[#E0E0E0] bg-white text-[#6B6B6B] hover:text-[#1F1F1F] text-[11px] leading-none"
              data-testid="corpus-sidebar-toggle"
            >
              {sidebarHidden ? '‹' : '›'}
            </button>
          </div>
          {!sidebarHidden && (
            <ClauseSidebar
              card={selectedCard}
              rowFocus={selectedRowFocus}
              dealId={dealId}
              dealSector={deal ? deal.sector : null}
              onClose={clearSelection}
              onViewInAgreement={hasAgreementText ? openSourceOverlay : null}
            />
          )}
        </div>
      )}

      <SourceOverlay
        open={Boolean(overlayCard)}
        onClose={closeSourceOverlay}
        fullText={fullText}
        start={resolvedOverlay ? resolvedOverlay.start : null}
        end={resolvedOverlay ? resolvedOverlay.end : null}
        status={resolvedOverlay ? resolvedOverlay.status : null}
        sectionRef={overlayCard ? overlayCard.section_ref : null}
        title={overlayCard ? (overlayCard.short_title || overlayCard.defined_term || overlayCard.section_ref) : null}
        agreementTitle={agreementSource ? agreementSource.title : null}
        unresolvedCount={unresolvedCount}
        loading={sourceOverlayLoading}
      />
    </div>
  );
}
