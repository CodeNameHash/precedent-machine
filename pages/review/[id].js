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
import { useDeal } from '../../lib/useSupabaseData';
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
import { MTX_FONTS_HREF } from '../../components/chrome/mtxFonts';
import { resolveCardSourceSpan } from '../../lib/parser-v2/resolve-source-span';
import {
  buildReviewV2Sections,
  deriveExtractedHeaderFacts,
  deriveElectionSummary,
  groupCardsBySection,
  EMPTY_REVIEW_DEAL,
  MAE_SECTION_ID,
} from '../../components/review-v2/sectionList';

const CONSIDERATION_SECTION_ID = 'consideration-hero';

const FONTS_HREF = MTX_FONTS_HREF;

function LoadingLine({ children }) {
  return (
    <p className="mtx-meta-label text-[10px] tracking-[0.16em] px-5 lg:px-9 py-10">{children}</p>
  );
}

function SectionBlock({ section, reviewDeal, sectionCards, onSelectCard, selectedCardId, election, onViewInAgreement }) {
  // Ben (Mergertrace round 1): every section collapsible. Native <details>
  // (open by default) so the scrollspy/anchor <section> wrapper and the
  // sec-<id> ids are untouched; ProvisionNav's jump() re-opens a collapsed
  // section before scrolling.
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
        <div className="mt-4">
        {section.id === '__definitions' ? (
          <DefinitionsSection definitions={reviewDeal.definitions} />
        ) : section.id === MAE_SECTION_ID ? (
          <MaeSection config={section.config} reviewDeal={reviewDeal} />
        ) : (
          <>
            {section.id === CONSIDERATION_SECTION_ID && election ? <ElectionCard election={election} /> : null}
            <ProvisionTable config={section.config} reviewDeal={reviewDeal} isEdit={false} />
          </>
        )}
        {section.id !== '__definitions' && sectionCards && sectionCards.length ? (
          <ProvisionIndex cards={sectionCards} sectionTitle={section.title} onSelect={onSelectCard} selectedId={selectedCardId} onViewInAgreement={onViewInAgreement} />
        ) : null}
        </div>
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

  const { deal, loading: dealLoading, error: dealError } = useDeal(dealId);

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
        return payload.reviewDeal || null;
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

  /* ── Agreement source ── */
  const [agreementSource, setAgreementSource] = useState(null);

  useEffect(() => {
    if (!dealId) return;
    fetch(`/api/agreement-source?deal_id=${dealId}`)
      .then((r) => r.json())
      .then((d) => setAgreementSource(d.agreement_source || null))
      .catch(() => setAgreementSource(null));
  }, [dealId]);

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

  /* ── View toggle ── */
  const [view, setView] = useState('summary');
  const hasAgreementText = Boolean(agreementSource && agreementSource.full_text);
  const toggleView = useCallback(() => {
    setView((v) => (v === 'summary' ? 'agreement' : 'summary'));
  }, []);
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

  /* ── Clause sidebar selection (reader mode) ── */
  const [selectedCard, setSelectedCard] = useState(null);
  const selectCard = useCallback((card) => {
    setSelectedCard((cur) => (cur && (cur.id || cur.provision_instance_id) === (card.id || card.provision_instance_id) ? null : card));
  }, []);
  useEffect(() => {
    const onKey = (e) => { if (e.key === 'Escape') setSelectedCard(null); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  /* ── Source overlay (WP-5 / M5-03) — full-doc overlay, exact span
     highlight. The overlay itself only takes {start, end}; resolution
     (offsets → exact-quote → region → unresolved, per
     lib/parser-v2/resolve-source-span.js) happens here, at the one place
     that holds both a card and the agreement's full_text. */
  const [sourceOverlay, setSourceOverlay] = useState(null); // { start, end, status, sectionRef, title } | null
  const [unresolvedCount, setUnresolvedCount] = useState(0);
  const fullText = agreementSource && agreementSource.full_text ? agreementSource.full_text : '';

  const openSourceOverlay = useCallback((card) => {
    if (!card) return;
    const resolved = resolveCardSourceSpan(card, fullText);
    if (resolved.status === 'unresolved') {
      // eslint-disable-next-line no-console
      console.warn('[SourceOverlay] unresolved span for card', card.id || card.provision_instance_id, card.section_ref);
      setUnresolvedCount((n) => n + 1);
    }
    setSourceOverlay({
      start: resolved.start,
      end: resolved.end,
      status: resolved.status,
      sectionRef: card.section_ref,
      title: card.short_title || card.defined_term || card.section_ref,
    });
  }, [fullText]);
  const closeSourceOverlay = useCallback(() => setSourceOverlay(null), []);

  /* ── Deep-link: /review/[id]?card=<card_id> opens the overlay directly. ── */
  const openedFromQueryRef = useRef(false);
  useEffect(() => {
    if (!router.isReady || openedFromQueryRef.current) return;
    const cardParam = router.query.card;
    if (!cardParam || !reviewDeal || !fullText) return;
    const target = String(cardParam);
    const match = (reviewDeal.cards || []).find(
      (c) => String(c.id || c.provision_instance_id) === target,
    );
    if (match) {
      openedFromQueryRef.current = true;
      openSourceOverlay(match);
    }
  }, [router.isReady, router.query.card, reviewDeal, fullText, openSourceOverlay]);

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

  return (
    <div className="mtx min-h-screen flex flex-col bg-white">
      <Head>
        <title>{pageTitle}</title>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link rel="stylesheet" href={FONTS_HREF} />
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
          <AgreementView agreementSource={agreementSource} />
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

            <div className="space-y-10 max-w-3xl">
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
          {selectedCard ? (
            <ClauseSidebar
              card={selectedCard}
              dealId={dealId}
              dealSector={deal ? deal.sector : null}
              onClose={() => setSelectedCard(null)}
              onViewInAgreement={hasAgreementText ? openSourceOverlay : null}
            />
          ) : null}
        </div>
      )}

      <SourceOverlay
        open={Boolean(sourceOverlay)}
        onClose={closeSourceOverlay}
        fullText={fullText}
        start={sourceOverlay ? sourceOverlay.start : null}
        end={sourceOverlay ? sourceOverlay.end : null}
        status={sourceOverlay ? sourceOverlay.status : null}
        sectionRef={sourceOverlay ? sourceOverlay.sectionRef : null}
        title={sourceOverlay ? sourceOverlay.title : null}
        agreementTitle={agreementSource ? agreementSource.title : null}
        unresolvedCount={unresolvedCount}
      />
    </div>
  );
}
