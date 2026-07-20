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
  dealDisplayName,
  isCommercialField,
} from '../../components/review-v2/compareData';
import { UnifiedCompareSection, UnifiedDefinitionsSection, CompareMasthead, collectOffMarketEntries } from '../../components/review-v2/CompareColumn';
import { OffMarketSection } from '../../components/review-v2/MarketColumn';

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

function SectionBlock({
  section, reviewDeal, sectionCards, onSelectCard, selectedCardId, election, onViewInAgreement,
  compare = null, marketColumn = null, onMarketRetry = null,
}) {
  // Ben (Mergertrace round 1): every section collapsible. Native <details>
  // (open by default) so the scrollspy/anchor <section> wrapper and the
  // sec-<id> ids are untouched; ProvisionNav's jump() re-opens a collapsed
  // section before scrolling.
  //
  // r14 (Ben): compare mode renders each section as ONE unified table
  // (shared label column + one answer column per deal; see
  // UnifiedCompareSection). r18 item 2 (Ben, "Definitions join the unified
  // format"): the Definitions section now goes through the same unified
  // shape too (UnifiedDefinitionsSection — union by normalized defined
  // term, see compareRowUnion.js), instead of the old side-by-side grid.
  // r18 item 5 (Ben, "deal vs market as unified table, not two sets of
  // tables"): ?market=1 also renders through this same unified path now —
  // `marketColumn` (this section's { code, stats, loading, error } from
  // useSectionMarketStats) becomes one more synthetic column inside the
  // SAME table, headed "MARKET — N deals", rather than a side column next
  // to a second copy of the table. `compare` and `marketColumn` are
  // independent — either, both, or neither can be active for a section.
  const unified = Boolean(compare) || Boolean(marketColumn);
  const primaryTables = unified ? (
    section.id === '__definitions' ? (
      <UnifiedDefinitionsSection
        primaryName={compare ? compare.primaryName : null}
        primaryReviewDeal={reviewDeal}
        comparedColumns={compare ? compare.columns : []}
        onRetry={compare ? compare.retry : null}
      />
    ) : (
      <UnifiedCompareSection
        section={section}
        primaryName={compare ? compare.primaryName : null}
        primaryReviewDeal={reviewDeal}
        comparedColumns={compare ? compare.columns : []}
        onRetry={compare ? compare.retry : null}
        election={election}
        sectionCards={sectionCards}
        onSelectCard={onSelectCard}
        selectedCardId={selectedCardId}
        marketColumn={marketColumn}
        onMarketRetry={onMarketRetry}
      />
    )
  ) : (
    <>
      {section.id === '__definitions' ? (
        <DefinitionsSection definitions={reviewDeal.definitions} />
      ) : section.id === MAE_SECTION_ID ? (
        <MaeSection config={section.config} reviewDeal={reviewDeal} onSelectCard={onSelectCard} selectedCardId={selectedCardId} />
      ) : (
        <>
          {/* r17: mechanics rows are normal table rows now — thread the same
              card-click wiring ProvisionTable's rows get so clicking a row
              opens the owning card in the ClauseSidebar. */}
          {section.id === CONSIDERATION_SECTION_ID && election ? <ElectionCard election={election} onSelectCard={onSelectCard} selectedCardId={selectedCardId} /> : null}
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
    </>
  );
  const primaryBody = (
    <>
      {primaryTables}
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
        <div className="mt-4">{primaryBody}</div>
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
  // r19 (WP-A, "off-market feed"): the unified market column's per-row
  // off-market marker (coded: differs from the corpus mode; numeric:
  // outside p25-p75 — CompareColumn.jsx's isOffMarketRow) used to mark
  // cells but never fed the "Off-market terms" top section, which only
  // ever showed the separate DEAL_TO_MARKET executor's scorecard rows.
  // Wire it: scan every section's PRIMARY-deal rows (flat + grouped) for
  // the SAME off-market flag, excluding commercial fields via
  // compareData.js's isCommercialField -- kept exactly as the DEAL_TO_
  // MARKET-driven rows already do -- and merge the result into the section
  // alongside those rows (de-duped so a field flagged by both surfaces
  // doesn't render twice).
  const marketOffMarketRows = useMemo(() => {
    if (!marketMode) return [];
    const seen = new Set();
    const out = [];
    for (const section of sections) {
      if (section.id === '__definitions') continue;
      const marketColumn = marketStats[section.id] || null;
      const entries = collectOffMarketEntries(section, reviewDealForTables, marketColumn);
      for (const entry of entries) {
        if (isCommercialField(entry)) continue;
        const key = `${entry.provision_type || ''}|${entry.field_path}|${entry.field_label}`;
        if (seen.has(key)) continue;
        seen.add(key);
        out.push(entry);
      }
    }
    return out;
  }, [marketMode, sections, reviewDealForTables, marketStats]);
  const offMarketData = useMemo(() => ({
    ...dealToMarket,
    rows: [...(dealToMarket.rows || []), ...marketOffMarketRows],
  }), [dealToMarket, marketOffMarketRows]);
  // r18 item 5 (Ben, "not this two sets of tables crap"): both compared
  // deals AND the market column now render as extra answer columns INSIDE
  // the same unified per-section table (UnifiedCompareSection /
  // UnifiedDefinitionsSection — the `compare` and `marketColumn` props
  // below), never as a second side-by-side table. `compareBundle` is
  // always the same shape regardless of whether any deals are actually
  // compared — SectionBlock decides per-section whether to render unified
  // at all (compare OR marketColumn truthy).
  const primaryDealName = useMemo(() => dealDisplayName(deal) || 'This deal', [deal]);
  const compareBundle = useMemo(() => ({
    columns: comparedDeals, retry: retryComparedDeals, primaryName: primaryDealName,
  }), [comparedDeals, retryComparedDeals, primaryDealName]);
  const wideLayout = compareIds.length > 0 || marketMode;

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

  // r18 item 3 (Ben, compare/market horizontal scroll): every unified
  // section table (compare and/or market columns push it wider than the
  // viewport) scrolls independently by default -- scrolling one loses your
  // place in every other section's table. Every such table's own
  // horizontally-scrolling wrapper carries `data-scroll-sync="unified-table"`
  // (UnifiedCompareSection / UnifiedDefinitionsSection in CompareColumn.jsx);
  // this mirrors one's scrollLeft onto all the others. Guarded with
  // `el.scrollLeft !== left` before writing so mirroring the write-back never
  // re-fires its own scroll handler (no feedback loop). Re-binds whenever
  // the section list or compare/market mode changes, since those change
  // which/how many scroll containers exist.
  useEffect(() => {
    if (typeof window === 'undefined' || !wideLayout) return undefined;
    const getEls = () => Array.from(document.querySelectorAll('[data-scroll-sync="unified-table"]'));
    const onScroll = (e) => {
      const left = e.target.scrollLeft;
      getEls().forEach((el) => {
        if (el !== e.target && el.scrollLeft !== left) el.scrollLeft = left;
      });
    };
    const els = getEls();
    els.forEach((el) => el.addEventListener('scroll', onScroll, { passive: true }));
    return () => els.forEach((el) => el.removeEventListener('scroll', onScroll));
  }, [wideLayout, sectionKey, comparedDeals.length, marketMode]);

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

      {/* r15 (Ben): in compare mode the masthead just NAMES the deals being
          compared — no metric strip (the primary deal's announced/value/
          consideration up top reads as if it described both deals). Normal
          review pages keep the full DealHeader unchanged. */}
      {compareIds.length ? (
        <CompareMasthead
          primaryName={primaryDealName}
          primaryHref={dealId ? `/review/${dealId}` : null}
          comparedColumns={comparedDeals}
          view={view}
          onToggleView={toggleView}
          hasAgreementText={hasAgreementText}
        />
      ) : (
        <DealHeader
          deal={deal}
          view={view}
          onToggleView={toggleView}
          hasAgreementText={hasAgreementText}
          extracted={extractedFacts}
        />
      )}

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

            <div className={wideLayout ? 'space-y-10' : 'space-y-10 max-w-3xl mx-auto'}>
              {marketMode ? <OffMarketSection data={offMarketData} /> : null}
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
                  compare={compareIds.length ? compareBundle : null}
                  marketColumn={marketMode && section.id !== '__definitions' ? (marketStats[section.id] || null) : null}
                  onMarketRetry={marketMode ? retryMarketStats : null}
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
          {/* r11 / r18 (Ben, "make it clearly discoverable"): mid-height
              arrow to hide/show the corpus sidebar, in both the normal
              review view and compare mode (this block sits outside the
              compareIds branch above, so it renders in either). Widened,
              darker border + a small always-visible "Corpus" label (only
              legible while collapsed, where the affordance most needs to
              be found) replace the old bare 6px chevron, which was easy to
              miss entirely.
              r18 fix: the wrapper used to be plain `relative`, so its
              `top-1/2` button centered on the height of this flex row's
              tallest sibling -- the full-length <main> provision list, often
              10-20k px tall on a real deal -- putting the button many
              screens below the fold on anything but a very short deal. The
              sidebar itself already solves this with `sticky`; the toggle
              needs the same fix so it tracks the VIEWPORT's center, not the
              document's. */}
          <div className="sticky hidden lg:block z-20" style={{ top: 'calc(50vh - 28px)', height: 0 }}>
            <button
              type="button"
              aria-label={sidebarHidden ? 'Show corpus sidebar' : 'Hide corpus sidebar'}
              onClick={() => setSidebarHidden((v) => !v)}
              className="absolute -left-4 w-8 h-14 flex flex-col items-center justify-center gap-1 border border-[#9A9A9A] bg-white text-[#6B6B6B] hover:text-[#1F1F1F] hover:border-[#1F1F1F] shadow-sm text-[13px] leading-none"
              data-testid="corpus-sidebar-toggle"
            >
              <span aria-hidden="true">{sidebarHidden ? '‹' : '›'}</span>
              {sidebarHidden ? (
                <span className="text-[7px] font-bold uppercase tracking-[0.1em]" style={{ writingMode: 'vertical-rl' }}>Corpus</span>
              ) : null}
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
