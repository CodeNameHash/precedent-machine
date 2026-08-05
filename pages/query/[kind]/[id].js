import {
  Fragment, useEffect, useMemo, useRef, useState,
} from 'react';
import Head from 'next/head';
import Link from 'next/link';
import { useRouter } from 'next/router';
import MergertraceStyles from '../../../components/review-v2/MergertraceStyles';
// r14 (Ben): the results page must carry the SAME top banner/masthead
// chrome as the review page, including the "Return to Index" affordance —
// that's the site Layout's TopBar (components/chrome/TopBar.jsx, extracted
// out of components/Layout.js so both surfaces share one implementation),
// not the generic Corpus/Query/Library AppHeader this page used before.
import TopBar from '../../../components/chrome/TopBar';
import {
  DealFiltersBlock, buildDealFilterPayload, dealMatchesDealFilter,
} from '../../../components/query/QueryFilterControls';
const { toCsv, resultToCsvRows, csvFilename } = require('../../../lib/query/csv');
const { humanizeKey } = require('../../../lib/query/filter-labels');
// E5 (2026-07-19 pre-demo audit): the review page's own "same label path"
// for bare enum codes ("ALL_CASH" -> "All cash") — reused here rather than
// re-implemented so the query surface never drifts from the review page's
// mapping.
const { prettifyEnumValue } = require('../../../components/review/shared');
// R (2026-07-19 query-results overhaul): the Consideration cell used to
// route DEAL-level codes (STOCK/MIXED_ELECTION/CASH_PLUS_CVR) through
// prettifyEnumValue('considerationType', …), which is tuned for the
// PROVISION-level considerationType enum vocabulary (cash-with-cvr, etc)
// and echoes the deal-level codes back unhumanized. The deals index page
// already solved "deal-level consideration code -> label" — reuse it here
// instead of growing a second mapping.
const { considerationTypeDisplay } = require('../../../lib/deals-index-columns');
// R (2026-07-19 query-results overhaul): item 1 — human titles. Pulled out
// into a plain-Node module (lib/query/result-title.js) rather than defined
// inline, so the title logic can be unit-tested without a JSX/Next runtime.
const { resultTitle, kindLabel } = require('../../../lib/query/result-title');
const { sanitizeQueryError } = require('../../../lib/query/error-sanitize');
// r13 item 1: the market-range executor now carries a parallel percent-of-
// deal-value distribution (percentStats + per-deal-point `.percent`) for
// money fields. formatPercentValue is the single shared rounding rule (one
// decimal, two below 1%) also used by the review page's per-deal display —
// reused here rather than reinvented so the two surfaces never drift.
const { formatPercentValue } = require('../../../lib/percent-of-deal');
// r13 item 2: NOSOL field-grouping spec for PROVISION_CROSS_CUT — see
// GROUP_SPECS below.
const { groupColumnsForCrossCut } = require('../../../lib/query/cross-cut-groups');
// Canonical Query UI slice (2026-07-22): the single interception point for
// the one supported ad hoc request (see docs/archive/handoffs/
// SPEC-CANONICAL-QUERY-UI-SLICE-2026-07-22.md).
const { isCanonicalV2QueryUiEnabled } = require('../../../lib/canonical-v2/feature-flags');
const {
  runQueryRoute, mapLegacyRequestToCanonical, runCanonicalRefinementRequest,
} = require('../../../lib/canonical-v2/legacy-query-mapper');
import CanonicalMarketRange from '../../../components/query/CanonicalMarketRange';

// Duplicated (not imported) from lib/query/types.js's KIND_SLUGS/slugToKind:
// that module transitively requires lib/query/resolve.js, which needs
// Node's `fs` and cannot be bundled into this page's CLIENT build (this
// page is not getServerSideProps-only — see components/query/
// QueryFilterControls.jsx's PROVISION_TYPES for the same constraint and the
// same fix already used elsewhere on this surface). Only used to compare
// this page's URL slug against the canonical predicate's expected enum kind.
const QUERY_KIND_SLUG_TO_KIND = {
  'provision-cross-cut': 'PROVISION_CROSS_CUT',
  'market-range': 'MARKET_RANGE',
  'filter-then-list': 'FILTER_THEN_LIST',
};
function slugToQueryKind(slug) {
  const raw = String(slug || '').trim();
  return QUERY_KIND_SLUG_TO_KIND[raw] || raw.toUpperCase();
}

QueryPage.noLayout = true;

export function getServerSideProps() {
  return {
    redirect: {
      destination: '/',
      permanent: false,
    },
  };
}

// D (query error surfaces): a garbage ?payload= (hand-edited URL, a stale/
// truncated share link) used to throw a raw JSON.parse SyntaxError straight
// out of this function and into the effect below's .catch, which rendered
// the bare technical message ("Unexpected token '�', ...") as the entire
// page body. decodePayload itself stays a pure decode -- callers decide how
// to present a failure -- but it's wrapped everywhere it's called so a bad
// link can never throw uncaught.
function decodePayload(value) {
  if (!value) return null;
  const padded = String(value).replace(/-/g, '+').replace(/_/g, '/').padEnd(Math.ceil(String(value).length / 4) * 4, '=');
  return JSON.parse(atob(padded));
}

function encodePayload(value) {
  return btoa(JSON.stringify(value)).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

// Thin wrapper: any decode failure (bad base64, truncated JSON, garbage
// bytes) becomes the same friendly "invalid link" message the API route
// (pages/api/query/run.js) now also returns for the same failure mode.
function decodePayloadSafe(value) {
  try {
    return decodePayload(value);
  } catch {
    const err = new Error('This query link is invalid.');
    err.isInvalidLink = true;
    throw err;
  }
}

// r14 (Ben): the title header band must read in SENTENCE CASE ("Deals with
// force the vote"). resultTitle() already sentence-cases the FILTER_THEN_LIST/
// MARKET_RANGE/DEAL_TO_MARKET phrasing it builds, but PROVISION_CROSS_CUT
// borrows provisionTypeLabel()'s legal-English overrides (e.g. "No
// Solicitation"), which are deliberately Title Case for use as a standalone
// term (dropdowns, filter chips) — wrong once that term leads a full
// sentence ("No Solicitation across deals"). Fixed here at render, not in
// lib/query/result-title.js, so the lib's own tests (which pin the Title
// Case provisionTypeLabel output) stay green and every other caller of that
// label keeps its Title Case. DEAL_COMPARE/DEAL_TO_MARKET, whose titles
// carried verbatim deal names (proper nouns) that must not be touched, are
// retired kinds — kept here as an empty set (not deleted outright) so a
// future kind with the same proper-noun-title concern has an obvious place
// to opt back in.
const NO_SENTENCE_CASE_KINDS = new Set([]);
function sentenceCaseTitle(kind, title) {
  if (!title || NO_SENTENCE_CASE_KINDS.has(kind)) return title;
  // Protect quoted spans (free-text filter values, e.g. `contains "Metsera"`)
  // from being lowercased — those are verbatim user/deal text, not phrasing.
  const parts = String(title).split(/("[^"]*")/);
  let seenFirstWord = false;
  return parts.map((part, i) => {
    if (i % 2 === 1) return part; // quoted span, leave untouched
    return part.replace(/[A-Za-z]+/g, (word) => {
      // All-caps acronyms (CVR, SEC, ...) stay as-is.
      if (word.length > 1 && word === word.toUpperCase()) return word;
      if (!seenFirstWord) {
        seenFirstWord = true;
        return word.charAt(0).toUpperCase() + word.slice(1).toLowerCase();
      }
      return word.toLowerCase();
    });
  }).join('');
}

function downloadCsv(result) {
  const rows = resultToCsvRows(result);
  if (!rows.length) return;
  const blob = new Blob([toCsv(rows)], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = csvFilename(result.kind);
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

export default function QueryPage() {
  const router = useRouter();
  const { kind, id, payload } = router.query;
  const [result, setResult] = useState(null);
  const [savedQuery, setSavedQuery] = useState(null);
  const [currentPayload, setCurrentPayload] = useState(null);
  const [error, setError] = useState(null);
  const [active, setActive] = useState(null);
  const [saving, setSaving] = useState(false);
  const [refinementDeals, setRefinementDeals] = useState([]);
  // Canonical Query UI slice: populated ONLY when the exact supported ad hoc
  // request is intercepted (flag on) — see the fetch effect below. Kept
  // separate from `result`/`error` (the legacy result contract) rather than
  // overloading them, since a CANONICAL_QUERY_RESULT_VIEW/V2 is a different
  // shape and must never be reshaped into the legacy one (spec: "Render from
  // CANONICAL_QUERY_RESULT_VIEW/V2 only").
  const [canonicalView, setCanonicalView] = useState(null);
  const [canonicalError, setCanonicalError] = useState(null);
  // Slice 2 (2026-07-23): the current canonical request body — the Slice 1
  // mapper's output at first render, a refined/cleared body after an Apply/
  // Clear/chip removal, or the same body with cursor: next_cursor after a
  // Show more. `canonicalPendingRef` is the single-in-flight guard: a ref
  // (not just the `canonicalPending` state) so a second click arriving
  // before the next render can still see "already pending" synchronously.
  const [canonicalBody, setCanonicalBody] = useState(null);
  const [canonicalPending, setCanonicalPending] = useState(false);
  const canonicalPendingRef = useRef(false);
  // Route-change guard (Fable review, Slice 2): each run of the fetch effect
  // bumps this generation; a refinement/show-more outcome that resolves
  // AFTER the user navigated to a different query must be discarded, or the
  // stale canonical view would render on top of (and, by render priority,
  // hide) the new query's result.
  const canonicalGenerationRef = useRef(0);

  // Shared by the first canonical request (below) and every Slice 2
  // refinement/show-more request (`onRequest`, further down) — one POST
  // wrapper, one place its shape can ever drift.
  const fetchCanonicalBody = async (body) => {
    const res = await fetch('/api/canonical-v2/query', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
    const json = await res.json().catch(() => null);
    return { status: res.status, json };
  };

  useEffect(() => {
    fetch('/api/deals').then((response) => response.json()).then((json) => setRefinementDeals(json.deals || [])).catch(() => setRefinementDeals([]));
  }, []);

  useEffect(() => {
    // Automatically optimised dynamic pages can expose all route parameters
    // while `isReady` remains false on a query-string URL. The parameters are
    // the real fetch gate: ad hoc queries need their encoded payload, while a
    // saved query only needs its id.
    if (!kind || !id || (id === 'adhoc' && !payload)) return;
    setResult(null);
    setSavedQuery(null);
    setCurrentPayload(null);
    setError(null);
    setCanonicalView(null);
    setCanonicalError(null);
    setCanonicalBody(null);
    setCanonicalPending(false);
    canonicalPendingRef.current = false;
    canonicalGenerationRef.current += 1;
    const generation = canonicalGenerationRef.current;

    // Canonical Query UI slice (2026-07-22): the legacy fetch, UNCHANGED from
    // before this slice, just extracted into a function so it can be handed
    // to runQueryRoute as the "legacy" branch. Its own error handling
    // (sanitizeQueryError -> setError) is identical to the prior inline
    // chain — this never throws out of runQueryRoute.
    const fetchLegacy = async () => {
      const params = new URLSearchParams({ kind: String(kind) });
      if (id && id !== 'adhoc') params.set('id', String(id));
      if (payload) params.set('payload', String(payload));
      try {
        const res = await fetch(`/api/query/run?${params.toString()}`);
        // D (query error surfaces): a degraded Supabase can make the API
        // route itself unreachable at the platform edge (e.g. a Cloudflare
        // 522), in which case the response body is an HTML error page, not
        // JSON — res.json() throwing here used to surface as a raw
        // SyntaxError with a chunk of that HTML markup pasted into the
        // message. Read as text first and parse ourselves so a non-JSON
        // body gets the friendly sanitizer treatment below instead.
        const text = await res.text();
        let json;
        try {
          json = JSON.parse(text);
        } catch {
          const err = new Error(text);
          err.isNonJsonBody = true;
          throw err;
        }
        if (json.error) throw new Error(json.error);
        if (generation !== canonicalGenerationRef.current) return;
        setResult(json.result);
        setSavedQuery(json.saved_query || null);
        setCurrentPayload(json.saved_query?.query_payload || (payload ? decodePayloadSafe(payload) : null));
      } catch (err) {
        if (generation !== canonicalGenerationRef.current) return;
        setError(sanitizeQueryError(err.message));
      }
    };

    // Only an ad hoc request carries a client-decodable payload at all — a
    // saved query's payload only becomes known after fetchLegacy resolves it
    // server-side, so it can never be the exact supported canonical shape at
    // this point and isSupportedCanonicalQuery's savedQueryId check rejects
    // it regardless (see lib/canonical-v2/legacy-query-mapper.js). A
    // corrupt/undecodable payload is treated as "not decodable yet" here —
    // it falls through to fetchLegacy, which independently fails with the
    // same friendly "invalid link" message as before this slice.
    let decodedPayload = null;
    if (id === 'adhoc' && payload) {
      try {
        decodedPayload = decodePayloadSafe(payload);
      } catch {
        decodedPayload = null;
      }
    }
    const flagEnabled = isCanonicalV2QueryUiEnabled({
      NEXT_PUBLIC_CANONICAL_V2_QUERY_UI_ENABLED: process.env.NEXT_PUBLIC_CANONICAL_V2_QUERY_UI_ENABLED,
    });

    runQueryRoute({
      kind: slugToQueryKind(kind),
      payload: decodedPayload,
      savedQueryId: id,
      flagEnabled,
      fetchCanonical: fetchCanonicalBody,
      fetchLegacy,
    }).then((outcome) => {
      if (generation !== canonicalGenerationRef.current) return;
      if (outcome.mode !== 'canonical') return; // fetchLegacy already applied its own state.
      if (outcome.ok) {
        setCanonicalView(outcome.view);
        // Slice 2: seed the refinement baseline with the exact body this
        // request was built from (mapLegacyRequestToCanonical is pure and
        // deterministic on the same payload, so recomputing it here — rather
        // than threading it back out of runQueryRoute — never drifts from
        // what was actually sent).
        setCanonicalBody(mapLegacyRequestToCanonical(decodedPayload));
      } else {
        setCanonicalError(outcome.error);
      }
    });
  }, [kind, id, payload]);

  // Slice 2 (2026-07-23): one bounded POST per explicit Apply/Clear/chip-
  // removal/Show more action from CanonicalMarketRange. `body.cursor` is
  // non-null only for a Show more request (see the component) — that one
  // signal is enough to tell runCanonicalRefinementRequest/
  // resolveCanonicalQueryPageUpdate whether to append or replace, with no
  // extra flag to thread through.
  const onCanonicalRequest = async (body) => {
    if (canonicalPendingRef.current) return; // single-in-flight: a second explicit action is a no-op, never queued
    canonicalPendingRef.current = true;
    setCanonicalPending(true);
    const generation = canonicalGenerationRef.current;
    const outcome = await runCanonicalRefinementRequest({
      fetchCanonical: fetchCanonicalBody,
      body,
      isShowMore: !!body.cursor,
      existingView: canonicalView,
    });
    if (generation !== canonicalGenerationRef.current) return; // user navigated away mid-flight: discard, state was already reset
    canonicalPendingRef.current = false;
    setCanonicalPending(false);
    if (outcome.ok) {
      setCanonicalBody(body);
      setCanonicalView(outcome.view);
      setCanonicalError(null);
    } else {
      // Spec: a refinement error preserves the prior view/controls —
      // canonicalView/canonicalBody are deliberately left untouched here so
      // the user can correct and retry.
      setCanonicalError(outcome.error);
    }
  };

  const title = useMemo(() => savedQuery?.title || (result ? resultTitle(result) : kindLabel(kind)), [savedQuery, result, kind]);
  const canPersist = !!(result && currentPayload);
  const saveQuery = async (duplicate = false) => {
    if (!canPersist) return;
    setSaving(true);
    setError(null);
    try {
      const res = await fetch('/api/saved-queries', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          query_kind: result.kind,
          title: duplicate && savedQuery ? `${savedQuery.title} copy` : title,
          description: savedQuery?.description || null,
          query_payload: currentPayload,
        }),
      });
      const json = await res.json();
      if (json.error) throw new Error(json.error);
      router.replace(`/query/${String(kind)}/${json.saved_query.id}`);
    } catch (err) {
      setError(err.message || 'Save failed');
    } finally {
      setSaving(false);
    }
  };

  return (
    <>
      <Head>
        <title>{`${title} · Corpus`}</title>
      </Head>
      <MergertraceStyles />
      {/* r14 item 1: same top banner/masthead chrome as the review page,
          "Return to Index" affordance included — see TopBar.jsx. This page
          stays noLayout (it needs to control its own body width), so it
          renders the site's shared banner directly rather than a second
          bespoke header. */}
      <TopBar />
      <div className="mtx qp">
        {/* r14 item 2: a header band styled like the review page's section
            headers (SectionBlock's bold title over a 2px black rule) —
            title in sentence case, with the Share/Export/Save/Duplicate
            toolbar right-aligned INSIDE this band rather than a separate
            strip above it. */}
        <div className="titleBand">
          <div className="titleBandInner">
            <div className="titleText">
              <h1>{sentenceCaseTitle(result?.kind, title)}</h1>
              <p className="mtx-meta-label titleMeta">{id === 'adhoc' ? 'Ad hoc query — not saved yet.' : 'Saved query.'}</p>
            </div>
            <div className="titleActions">
              <button type="button" className="mtx-btn" onClick={() => navigator.clipboard?.writeText(window.location.href)}>Share</button>
              <button type="button" className="mtx-btn" disabled={!result} onClick={() => downloadCsv(result)}>Export CSV</button>
              <button type="button" className="mtx-btn" disabled={!canPersist || saving || id !== 'adhoc'} onClick={() => saveQuery(false)}>{saving ? 'Saving…' : 'Save'}</button>
              <button type="button" className="mtx-btn mtx-btn-primary" disabled={!canPersist || saving} onClick={() => saveQuery(true)}>Duplicate</button>
            </div>
          </div>
        </div>
        <div className="body">
          <div className="wrap">
            {error ? <div className="empty">{error}</div>
              : (canonicalView || canonicalError) ? <>
                {/* Slice 2: a refinement/show-more error renders the safe
                    panel ABOVE the previous (stale) view — the prior rows
                    and refinement controls stay on screen so the user can
                    correct and retry, rather than the error replacing them. */}
                {canonicalError && <CanonicalErrorPanel error={canonicalError} />}
                {canonicalView && (
                  <CanonicalMarketRange
                    view={canonicalView}
                    body={canonicalBody}
                    onRequest={onCanonicalRequest}
                    pending={canonicalPending}
                  />
                )}
              </>
              : !result ? <div className="empty">Loading query…</div> : <>
              {currentPayload && <ResultRefinements key={JSON.stringify(currentPayload)} result={result} payload={currentPayload} deals={refinementDeals} />}
              <ResultView result={result} onOpen={setActive} />
            </>}
          </div>
        </div>
        {active && <Drilldown item={active} onClose={() => setActive(null)} />}
      </div>
      <style jsx>{`
        .qp { min-height: 100vh; background: var(--paper); color: var(--ink); font-family: var(--mtx-sans); }
        /* r14 item 2: a review-page SECTION header band (SectionBlock's
           2px black rule under a bold title — components/review-v2/
           sectionList.js's rendering in pages/review/[id].js), not a
           standalone strip: title left, Share/Export/Save/Duplicate
           right-aligned in the same band. */
        .titleBand { border-bottom: 2px solid #000; background: var(--paper); }
        .titleBandInner { max-width: 1280px; margin: 0 auto; padding: 16px 34px 12px; display: flex; align-items: flex-end; justify-content: space-between; flex-wrap: wrap; gap: 12px 20px; }
        .titleText h1 { margin: 0; font-size: 18px; font-family: var(--mtx-sans); font-weight: 700; letter-spacing: -0.01em; color: var(--ink); }
        .titleMeta { margin: 4px 0 0; font-size: 9px; letter-spacing: 0.14em; }
        .titleActions { display: flex; flex-direction: row; align-items: center; gap: 10px; padding-bottom: 2px; }
        .titleActions .mtx-btn { flex: 0 0 auto; width: auto; }
        .body { padding: 0; }
        .wrap { max-width: 1280px; margin: 0 auto; padding: 32px 34px; display: flex; flex-direction: column; gap: 4px; }
        .empty { border: 1px solid var(--line); background: var(--paper); padding: 24px; color: var(--ink-light); font-family: var(--mtx-sans); }
        @media (max-width: 900px) {
          .titleBandInner { padding: 12px 16px 10px; }
          .wrap { padding: 16px; }
        }
      `}</style>
    </>
  );
}

function valuesFromDealFilter(filter = {}) {
  const first = (value) => (Array.isArray(value) ? (value[0] ?? '') : (value ?? ''));
  return {
    search: first(filter.search),
    buyer: first(filter.buyer),
    sector: first(filter.sector),
    signing_year: first(filter.signing_year),
    merger_form: first(filter.merger_form),
    law_firm: first(filter.law_firm),
    lawyer: first(filter.lawyer),
  };
}

function ResultRefinements({ result, payload, deals }) {
  const router = useRouter();
  const sourceFilter = payload.deal_filter || payload.comparison_set_filter || {};
  const [values, setValues] = useState(() => valuesFromDealFilter(sourceFilter));
  const currentSide = /reverse/i.test(payload.field_path || '') ? 'reverse' : 'company';
  const [feeSide, setFeeSide] = useState(currentSide);
  const apply = () => {
    const dealFilter = buildDealFilterPayload(values);
    const next = { ...payload };
    if (result.kind === 'MARKET_RANGE' || result.kind === 'FILTER_THEN_LIST') next.deal_filter = dealFilter;
    if (result.kind === 'PROVISION_CROSS_CUT') {
      const existing = new Set(payload.deal_ids || []);
      next.deal_ids = deals.filter((deal) => (!existing.size || existing.has(deal.id)) && dealMatchesDealFilter(deal, dealFilter)).map((deal) => deal.id);
    }
    if (result.kind === 'MARKET_RANGE' && result.provision_type === 'TERMINATION_FEE') {
      next.field_path = feeSide === 'reverse' ? 'reverseFeePctOfDealValue' : 'feePctOfDealValue';
      next.chart_kind = 'HISTOGRAM';
    }
    const slug = result.kind.toLowerCase().replace(/_/g, '-');
    router.push(`/query/${slug}/adhoc?payload=${encodePayload(next)}`);
  };
  return (
    <div className="refinements">
      <DealFiltersBlock
        deals={deals}
        values={values}
        onChange={setValues}
        facetKeys={['buyer', 'sector', 'signing_year', 'merger_form', 'law_firm', 'lawyer']}
        showSearch
        expandAll
      />
      <div className="refinementActions">
        {result.kind === 'MARKET_RANGE' && result.provision_type === 'TERMINATION_FEE' && (
          <label><span>Fee side</span><select className="mtx-select" value={feeSide} onChange={(event) => setFeeSide(event.target.value)}><option value="company">Company / target fee</option><option value="reverse">Reverse / buyer fee</option></select></label>
        )}
        <button type="button" className="mtx-btn" onClick={apply}>Apply refinements</button>
      </div>
      <style jsx>{`
        .refinements { margin-bottom: 16px; border: 1px solid var(--line); background: #fff; padding: 12px 14px; display: flex; align-items: flex-end; justify-content: space-between; gap: 14px; }
        .refinements :global(.dfb) { flex: 1; }
        .refinementActions { display: flex; align-items: flex-end; gap: 8px; }
        .refinementActions label { display: flex; flex-direction: column; gap: 2px; font: 8px var(--mtx-sans); text-transform: uppercase; letter-spacing: .08em; color: var(--ink-faint); }
        .refinementActions :global(.mtx-select) { height: 28px; min-height: 28px; font-size: 11px; }
        @media (max-width: 900px) { .refinements { align-items: stretch; flex-direction: column; } .refinementActions { justify-content: flex-end; } }
      `}</style>
    </div>
  );
}

// WP-3 (M4-02) normalizer badges: a small hover/click marker on any
// value-bearing query-result cell, showing the registry's canonical key,
// the raw alias actually matched on the provision, the registry version,
// and the extractor version + run id (pages/api/query/run.js attaches
// these server-side — see lib/query/prov.js). Renders nothing when the
// cell carries no `_prov` (empty cells, or results predating WP-3).
function ProvBadge({ prov }) {
  const [open, setOpen] = useState(false);
  if (!prov) return null;
  const showsAlias = prov.matched_key && prov.matched_key !== prov.canonical_key;
  return (
    <span className="mtx-prov-cell" onMouseEnter={() => setOpen(true)} onMouseLeave={() => setOpen(false)}>
      <button
        type="button"
        className="mtx-prov-trigger"
        aria-expanded={open}
        aria-label="Normalizer provenance"
        onClick={(e) => { e.stopPropagation(); setOpen((v) => !v); }}
      >i</button>
      {open && (
        <span className="mtx-prov-popover" onClick={(e) => e.stopPropagation()}>
          <dl>
            <dt>Key</dt>
            <dd>
              {prov.canonical_key || '—'}
              {showsAlias && <><span className="mtx-prov-arrow">&larr;</span>{prov.matched_key}</>}
            </dd>
            <dt>Registry version</dt>
            <dd>{prov.registry_version || '—'}</dd>
            <dt>Extractor</dt>
            <dd>{prov.extraction_version || '—'}{prov.extraction_run_id ? ` · run ${prov.extraction_run_id}` : ''}</dd>
          </dl>
        </span>
      )}
    </span>
  );
}

// Canonical Query UI slice (2026-07-22): a non-200 from /api/canonical-v2/
// query renders this instead of a result — the governed error code plus a
// fixed, neutral message. Never the response body/message itself (no
// request internals, nothing to render as HTML): `error.message` here is
// always the fixed string runQueryRoute sets, never anything echoed off the
// network response. No retry action in this slice, and no automatic "run on
// legacy instead" — the user can always change the fee side or run a
// different query to reach the legacy path themselves.
function CanonicalErrorPanel({ error }) {
  return (
    <div className="empty">
      <p className="mtx-meta-label">{error?.code || 'DATA_SOURCE_ERROR'}</p>
      <p>{error?.message || 'This query could not be run on Canonical Query right now.'}</p>
    </div>
  );
}

function ResultView({ result, onOpen }) {
  if (result.kind === 'PROVISION_CROSS_CUT') return <CrossCut result={result} onOpen={onOpen} />;
  if (result.kind === 'MARKET_RANGE') return <MarketRange result={result} onOpen={onOpen} />;
  if (result.kind === 'FILTER_THEN_LIST') return <FilterList result={result} />;
  return <pre>{JSON.stringify(result, null, 2)}</pre>;
}

// r13 item 2 (Ben: "all intervening event matters together"): for the
// no-solicitation family, split the single wide field-per-column table into
// several, one per ordered Ben-facing group heading (lib/query/
// cross-cut-groups.js's GROUP_SPECS) — same per-field cell rendering, just
// bucketed instead of one flat wall of columns. Any provision type without a
// group spec gets back groupColumnsForCrossCut's single `heading: null`
// group, i.e. exactly today's flat rendering (title unchanged).
function CrossCut({ result, onOpen }) {
  const groups = useMemo(
    () => groupColumnsForCrossCut(result.provision_type, result.columns),
    [result.provision_type, result.columns],
  );
  const columnIndex = useMemo(
    () => new Map((result.columns || []).map((col, i) => [col.field, i])),
    [result.columns],
  );
  const grouped = groups.length > 0 && groups[0].heading !== null;
  return (
    <>
      {grouped && <p className="mtx-meta-label crossCutMeta">{pluralize(result.rows.length, 'deal')}</p>}
      {groups.map((group, gi) => (
        <Panel key={group.heading || gi} title={group.heading || `Provision cross-cut — ${pluralize(result.rows.length, 'deal')}`}>
          <div className="scroll">
            <table className="mtx-table">
              <thead><tr><th>Deal</th><th>Signing</th>{group.columns.map((col) => <th key={col.field}>{col.label}</th>)}</tr></thead>
              <tbody>{result.rows.map((row) => <tr key={row.deal_id}>
                <td>{row.deal_name}</td><td>{row.signing_date || '-'}</td>
                {group.columns.map((col) => {
                  const i = columnIndex.get(col.field);
                  const cell = row.cells[i] || {};
                  return (
                    <td key={col.field} className="mtx-prov-cell" title={cell.verbatim_quote || ''} onClick={() => onOpen({ ...cell, card_id: cell.card_id || row.card_id, deal_id: row.deal_id })}>
                      {formatValue(cell.value, col.field)}{cell._prov && <ProvBadge prov={cell._prov} />}
                    </td>
                  );
                })}
              </tr>)}</tbody>
            </table>
          </div>
        </Panel>
      ))}
    </>
  );
}

// R (2026-07-19 query-results overhaul): item 2 — the min/median/max stat
// strip now reads as review-page fact tiles (DealHeader's metric-column
// voice: 9px uppercase label over a bold value, divided by a 1px rule)
// instead of the old bordered pill-per-stat row. r14 item 4: DealHeader's
// own metric values (deal value, per share, ...) render in the site's plain
// sans (no mono) — this tile carried a stray mtx-mono that made it drift
// from the component it's explicitly modeled on. Dropped.
function FactTile({ label, value }) {
  return (
    <div className="factTile">
      <p className="factLabel">{label}</p>
      <p className="factValue">{value}</p>
    </div>
  );
}

// B (market-range QA): the stat tiles ("MEDIAN 288500000", "P25
// 51573958.07") and the histogram bucket titles used to print the raw
// numeric stat with no formatting at all, even though the deal rows right
// below already humanize the same field via formatValue()/formatMoney().
// `result.field_kind` is the registry's field type ('usd', 'percent',
// 'number', ...) -- reuse it to pick the right unit instead of assuming
// every numeric stat is money. Also rounds float dust (51573958.07 -> a
// clean money figure) the same way row values already do.
function formatStat(value, fieldKind) {
  const n = Number(value);
  if (!Number.isFinite(n)) return '-';
  if (fieldKind === 'usd') return formatMoney(n);
  if (fieldKind === 'percent' || fieldKind === 'percentage') return `${round(n)}%`;
  return round(n);
}

// r13 item 1 (Ben, "% of deal value" — "is how we compare across deals"):
// percentStats carries the SAME stat shape as result.stats (n/min/p25/
// median/p75/max/mean/stddev) but on a percent-of-deal-value basis, plus
// excludedCount (deals with no usable value_usd). formatPercentValue is the
// one shared rounding rule (lib/percent-of-deal.js) — no second rounding
// rule invented here.
function formatPercentStat(value) {
  const n = Number(value);
  if (!Number.isFinite(n)) return '-';
  return formatPercentValue(n) || '-';
}

function dealValueBasisLabel(value) {
  if (value === 'equity_value') return 'equity value';
  if (value === 'enterprise_value') return 'enterprise value';
  if (value === 'headline_transaction_value') return 'headline transaction value';
  if (value === 'mixed') return 'mixed recorded value bases';
  return 'recorded deal value, basis not identified';
}

function MarketRange({ result, onOpen }) {
  const percentagePrimary = result.primary_basis === 'percent_of_deal_value';
  const distribution = (percentagePrimary && result.percentDistribution) || result.distribution || [];
  const primaryStats = (percentagePrimary && result.percentStats) || result.stats;
  const primaryKind = percentagePrimary ? 'percentage' : result.field_kind;
  const counts = distribution.map((x) => x.count);
  const max = Math.max(1, ...counts);
  const fieldKind = primaryKind;
  return (
    <>
      <Panel title="Distribution">
        <div className="panelPad">
          {percentagePrimary && <p className="percentCaption">Percentage of each deal&apos;s {dealValueBasisLabel(result.deal_value_basis)}</p>}
          <div className="chart">
            {distribution.map((bucket, i) => {
              // Min bar height only applies to buckets that actually have
              // deals in them -- a genuinely empty bucket (count 0) used to
              // get the same 12px floor as a 1-count bucket, reading as a
              // real (if small) result. Give it a hairline instead so
              // "empty" and "small" are visually distinguishable.
              const height = bucket.count > 0 ? Math.max(12, (bucket.count / max) * 170) : 2;
              const rangeLabel = bucket.value
                || (bucket.bucket_min !== undefined && bucket.bucket_max !== undefined
                  ? `${formatStat(bucket.bucket_min, fieldKind)}–${formatStat(bucket.bucket_max, fieldKind)}`
                  : '');
              return (
                <div key={i} className="chartBar">
                  <button type="button" style={{ height: `${height}px` }} title={rangeLabel}>
                    <span>{bucket.count}</span>
                  </button>
                  <p className="chartBarLabel" title={rangeLabel}>{rangeLabel}</p>
                </div>
              );
            })}
          </div>
          <div className="factTiles">
            <FactTile label="N" value={primaryStats?.n ?? result.n} />
            {primaryStats && <>
              <FactTile label="Median" value={formatStat(primaryStats.median, fieldKind)} />
              <FactTile label="P25" value={formatStat(primaryStats.p25, fieldKind)} />
              <FactTile label="P75" value={formatStat(primaryStats.p75, fieldKind)} />
              <FactTile label="Range" value={`${formatStat(primaryStats.min, fieldKind)}–${formatStat(primaryStats.max, fieldKind)}`} />
            </>}
          </div>
          {/* r13 item 1: the percent-of-deal-value basis "is how we compare
              across deals" (Ben) — render as a peer stat-tile row right
              below the dollar tiles, not a footnote. Only present at all
              for money fields (percentStats is null for everything else,
              e.g. day-counts, percent-typed fields already a ratio). */}
          {result.percentStats && (
            <div className="percentBand">
              <p className="percentCaption">
                USD amounts, secondary to the comparable percentage
                {result.percentStats.excludedCount > 0 && (
                  <span className="percentExcluded">
                    {` (${result.percentStats.n} of ${result.n} deals; ${result.percentStats.excludedCount} excluded — no deal value)`}
                  </span>
                )}
              </p>
              <div className="factTiles">
                <FactTile label="N" value={result.stats?.n || 0} />
                <FactTile label="Median" value={formatStat(result.stats?.median, result.field_kind)} />
                <FactTile label="P25" value={formatStat(result.stats?.p25, result.field_kind)} />
                <FactTile label="P75" value={formatStat(result.stats?.p75, result.field_kind)} />
                <FactTile label="Range" value={`${formatStat(result.stats?.min, result.field_kind)}–${formatStat(result.stats?.max, result.field_kind)}`} />
              </div>
            </div>
          )}
        </div>
      </Panel>
      {/* B: "Underlying deals — 29" used to be a collapsed <details> with no
          visual hint that it was a disclosure at all -- it read as a
          missing deal list, not a control. Expanded by default now (Ben's
          bar: don't hide detail without a clear affordance); still a real
          <details> so it CAN be collapsed once seen. */}
      <details className="subPanel" open>
        <summary className="subPanelTitleBar">{`Underlying deals — ${result.deal_points.length}`}</summary>
        <div className="subPanelBody">
          <table className="mtx-table">
            <thead><tr>
              <th>Deal</th>
              {percentagePrimary && <th>% of deal value</th>}
              <th>{percentagePrimary ? 'USD amount' : 'Value'}</th>
              {result.fee_context && <th>Fee source</th>}
              {result.fee_context && <th>Triggers</th>}
              <th>Section</th>
            </tr></thead>
            <tbody>
              {result.deal_points.map((point) => {
                const pct = point.percent_of_deal_value ?? (result.field_kind === 'percentage' ? point.value : null);
                const amount = point.amount_usd ?? (result.percentStats ? point.value : null);
                return (
                  <tr key={`${point.deal_id}-${point.card_id}`} onClick={() => onOpen(point)}>
                    <td>{point.deal_name}</td>
                    {percentagePrimary && <td title={`Basis: ${dealValueBasisLabel(point.deal_value_basis)}`}>{pct == null ? '—' : formatPercentStat(Number(pct))}</td>}
                    <td className="mtx-prov-cell">{percentagePrimary ? (amount == null ? '—' : formatMoney(amount)) : formatValue(point.value, result.field_path)}{point._prov && <ProvBadge prov={point._prov} />}</td>
                    {result.fee_context && <td>{point.fee_source || result.fee_context.label}</td>}
                    {result.fee_context && <td title={(point.triggers || []).map((trigger) => trigger.text).join('\n')}>{(point.triggers || []).map((trigger) => trigger.label).join('; ') || '—'}</td>}
                    <td className="mtx-mono">{point.quote_section_ref || '-'}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </details>
    </>
  );
}

// R (2026-07-19 query-results overhaul): item 6 — the always-visible base
// columns plus whatever feature columns the payload asked for (row.columns'
// keys — the result row shape is { deal_id, deal_name, signing_date,
// total_deal_value, columns:{...} }, distinct from the deals-index row
// shape, so this deliberately does NOT reuse lib/deals-index-columns'
// accessors). 'consideration_type' is a base column even though it lives
// inside row.columns (the query builder always requests it for display).
// r14 item 4: Signing/Value used to force mtx-mono (IBM Plex Mono) — the
// review page only reserves that face for citation-style codes (section
// refs), never for ordinary deal-table cells; its own metric values (e.g.
// DealHeader's date/deal-value columns) render in the standard sans. No
// `mono` flag here anymore so these cells fall through to the table's
// default sans.
const FILTER_LIST_BASE_COLUMNS = [
  { key: 'deal_name', label: 'Deal', locked: true },
  { key: 'signing_date', label: 'Signing' },
  { key: 'total_deal_value', label: 'Value' },
  { key: 'consideration_type', label: 'Consideration' },
];
const FILTER_LIST_BASE_KEYS = new Set(FILTER_LIST_BASE_COLUMNS.map((col) => col.key));

function filterListColumnValue(row, key) {
  if (key === 'deal_name') return row.deal_name;
  if (key === 'signing_date') return row.signing_date;
  if (key === 'total_deal_value') return row.total_deal_value;
  return row.columns ? row.columns[key] : undefined;
}

function filterListColumnDisplay(row, key) {
  const value = filterListColumnValue(row, key);
  if (key === 'consideration_type') return value ? (considerationTypeDisplay(value) || humanizeKey(value)) : '-';
  if (key === 'signing_date') return value || '-';
  return formatValue(value, key);
}

function availableFilterListColumns(result) {
  const extra = new Set();
  for (const row of result.rows || []) {
    for (const key of Object.keys(row.columns || {})) {
      if (!FILTER_LIST_BASE_KEYS.has(key)) extra.add(key);
    }
  }
  return [...FILTER_LIST_BASE_COLUMNS, ...[...extra].map((key) => ({ key, label: humanizeKey(key) }))];
}

// R (2026-07-19 query-results overhaul): item 3 — "N matched hits" told Ben
// nothing; each hit now carries its own citable quote (filter-then-list.js
// executor change) and expands, collapsed by default, into the actual
// provision span(s) that made the deal match: field label, humanized value,
// the quote text, and its section reference — same clause-block treatment
// as the review page (serif, left-bordered).
function FilterList({ result }) {
  const allColumns = useMemo(() => availableFilterListColumns(result), [result]);
  const [visible, setVisible] = useState(() => new Set(allColumns.map((col) => col.key)));
  const [columnsOpen, setColumnsOpen] = useState(false);
  const [sort, setSort] = useState(null);
  const [expanded, setExpanded] = useState(() => new Set());

  const toggleColumn = (key) => setVisible((prev) => {
    const next = new Set(prev);
    if (next.has(key)) next.delete(key); else next.add(key);
    return next;
  });

  const toggleSort = (key) => setSort((prev) => {
    if (!prev || prev.key !== key) return { key, dir: 'asc' };
    if (prev.dir === 'asc') return { key, dir: 'desc' };
    return null;
  });

  const toggleExpanded = (dealId) => setExpanded((prev) => {
    const next = new Set(prev);
    if (next.has(dealId)) next.delete(dealId); else next.add(dealId);
    return next;
  });

  const rows = useMemo(() => {
    const base = result.rows || [];
    if (!sort) return base;
    const sorted = [...base].sort((a, b) => {
      const av = filterListColumnValue(a, sort.key);
      const bv = filterListColumnValue(b, sort.key);
      if (av == null && bv == null) return 0;
      if (av == null) return 1;
      if (bv == null) return -1;
      if (typeof av === 'number' && typeof bv === 'number') return av - bv;
      return String(av).localeCompare(String(bv));
    });
    if (sort.dir === 'desc') sorted.reverse();
    return sorted;
  }, [result.rows, sort]);

  const visibleColumns = allColumns.filter((col) => visible.has(col.key));

  return (
    <Panel title={`Matching deals — ${result.rows.length}`}>
      <div className="listHead">
        <div className="colPicker">
          <button type="button" className="mtx-btn" onClick={() => setColumnsOpen((v) => !v)}>Columns</button>
          {columnsOpen && (
            <div className="colPopover" onMouseLeave={() => setColumnsOpen(false)}>
              {allColumns.map((col) => (
                <label key={col.key}>
                  <input type="checkbox" checked={visible.has(col.key)} disabled={col.locked} onChange={() => toggleColumn(col.key)} />
                  {col.label}
                </label>
              ))}
            </div>
          )}
        </div>
      </div>
      <table className="mtx-table">
        <thead>
          <tr>
            <th className="expandCol" />
            {visibleColumns.map((col) => (
              <th key={col.key} className="sortable" onClick={() => toggleSort(col.key)}>
                {col.label}{sort && sort.key === col.key ? (sort.dir === 'asc' ? ' ▲' : ' ▼') : ''}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => {
            const hits = row.matched_provision_hits || [];
            const isOpen = expanded.has(row.deal_id);
            return (
              <Fragment key={row.deal_id}>
                <tr>
                  <td className="expandCol">
                    {hits.length > 0 && (
                      <button type="button" className="term-cell-seetext" onClick={() => toggleExpanded(row.deal_id)}>
                        {isOpen ? '▾ hide' : '▸ show'} provision{hits.length === 1 ? '' : 's'}
                      </button>
                    )}
                  </td>
                  {visibleColumns.map((col) => (
                    <td
                      key={col.key}
                      className={col.mono ? 'mtx-mono' : ''}
                      onClick={col.key === 'deal_name' ? () => { window.location.href = `/review/${row.deal_id}`; } : undefined}
                    >
                      {filterListColumnDisplay(row, col.key)}
                    </td>
                  ))}
                </tr>
                {isOpen && hits.length > 0 && (
                  <tr className="hitsRow">
                    <td colSpan={visibleColumns.length + 1}>
                      {hits.map((hit, i) => {
                        // r15 item 5: show-all hits (mode:'all' — see
                        // showAllHit() in lib/query/executors/filter-then-list.js)
                        // carry a `has` flag instead of always being a match.
                        // State reads in legal English ("Force the vote: Yes —
                        // Hard"), never a machine code: valueLabel/gradeLabel
                        // arrive pre-humanized off the executor's taxonomy
                        // lookup, so this only falls back to formatValue() when
                        // no taxonomy label exists (e.g. a plain boolean with no
                        // graded sibling).
                        const isShowAll = Object.prototype.hasOwnProperty.call(hit, 'has');
                        const stateLabel = isShowAll
                          ? (hit.has ? (hit.valueLabel || formatValue(hit.value, hit.field)) : 'None found')
                          : formatValue(hit.value, hit.field);
                        const gradeSuffix = isShowAll && hit.has && hit.gradeLabel ? ` — ${hit.gradeLabel}` : '';
                        return (
                          <div key={i} className="hitBlock">
                            <div className="hitLabel"><b>{humanizeKey(hit.field)}</b><span>{stateLabel}{gradeSuffix}</span></div>
                            {/* r10c: the standard is a property of an obligation —
                                say what it attaches to, never just that the words
                                occur somewhere in the family. */}
                            {hit.attaches_to && <div className="hitAttach">Attaches to: {hit.attaches_to}</div>}
                            {hit.quote?.text && <blockquote>{hit.quote.text}</blockquote>}
                            {hit.quote?.section_ref && <div className="hitSection mtx-mono">{hit.quote.section_ref}</div>}
                          </div>
                        );
                      })}
                    </td>
                  </tr>
                )}
              </Fragment>
            );
          })}
        </tbody>
      </table>
    </Panel>
  );
}

// R (2026-07-19 render-parity pass): every result section now reads as a
// review-page SECTION card — a grey uppercase title bar (same voice as the
// reused ProvisionTable's own `[data-testid^='provision-table-'] > div:
// first-child:has(> p)` title-bar rule in MergertraceStyles) over a white
// body, all colors/sizes pulled from the .mtx custom properties rather than
// restated as one-off hex. `title` is optional so callers that render a
// bare status panel keep their existing untitled/padded card look.
function Panel({ title, children }) {
  return (
    <div className={`panel${title ? ' panelTitled' : ''}`}>
      {title && <div className="panelTitleBar"><p>{title}</p></div>}
      {title ? <div className="panelBody">{children}</div> : children}
      <style jsx global>{`
    .mtx.qp .panel { border: 1px solid var(--line); background: var(--paper); overflow: hidden; }
    .mtx.qp .panel:not(.panelTitled) { padding: 18px; }
    .mtx.qp .panelTitleBar { background: var(--paper-2); border-bottom: 1px solid var(--line); padding: 8px 12px; }
    .mtx.qp .panelTitleBar p { margin: 0; font-family: var(--mtx-sans); font-size: 9px; font-weight: 700; letter-spacing: 0.14em; text-transform: uppercase; color: var(--ink-light); }
    .mtx.qp .panelBody .mtx-table { border: 0; }
    .mtx.qp .panelPad { padding: 18px; }
    .mtx.qp .scroll { overflow-x: auto; }
    .mtx.qp .mtx-table th small { display: block; margin-top: 4px; color: var(--ink-light); text-transform: none; letter-spacing: 0; }
    .mtx.qp .mtx-table td { cursor: pointer; padding: 8px 12px; font-size: 13px; }
    .mtx.qp .mtx-table th { padding: 8px 12px; }
    .mtx.qp .mtx-table td div { display: flex; justify-content: space-between; gap: 12px; margin-bottom: 4px; }
    .mtx.qp .mtx-table td small { color: var(--ink-light); display: block; margin-top: 8px; line-height: 1.35; }
    .mtx.qp .major, .mtx.qp .unusual { background: rgba(177, 78, 99, 0.08); }
    .mtx.qp .minor, .mtx.qp .off_market { background: rgba(168, 122, 46, 0.08); }
    .mtx.qp .trivial, .mtx.qp .market { background: var(--paper); }
    .mtx.qp .missing { background: rgba(31, 31, 31, 0.05); }
    /* B (market-range QA): the bars used to be direct flex children with no
       room for a range label underneath -- each bar is now wrapped in
       .chartBar (bar + label stacked), and the chart's own height grew a
       little to fit the label row without shrinking the bars themselves. */
    .mtx.qp .chart { height: 240px; display: flex; align-items: flex-end; gap: 8px; border-bottom: 1px solid var(--line); padding: 12px 0 0; }
    .mtx.qp .chartBar { flex: 1; min-width: 20px; display: flex; flex-direction: column; align-items: stretch; justify-content: flex-end; height: 100%; }
    .mtx.qp .chartBar button { border: 0; background: var(--ink); color: var(--paper); border-radius: 0; cursor: pointer; width: 100%; }
    .mtx.qp .chartBarLabel { margin: 4px 0 0; font-size: 8.5px; line-height: 1.3; color: var(--ink-light); text-align: center; white-space: nowrap; overflow: hidden; text-overflow: clip; }
    .mtx.qp .chips { display: flex; flex-wrap: wrap; gap: 8px; margin: 14px 0; }
    .mtx.qp h2 { font-size: 13px; margin: 22px 0 8px; font-family: var(--mtx-sans); text-transform: uppercase; letter-spacing: 0.08em; color: var(--ink-light); }
    /* item 2 — grouped cross-cut: the deal count used to live in the single
       panel's title ("Provision cross-cut — 29 deals"); once that title is
       replaced by per-group headings, surface the count once above the
       group panels instead of dropping it. */
    .mtx.qp .crossCutMeta { margin: 0 0 8px; }

    /* item 2 — market-range stat strip as review-page fact tiles: 9px
       uppercase label over a bold value, DealHeader's metric-column voice. */
    .mtx.qp .factTiles { display: flex; flex-wrap: wrap; margin-top: 14px; }
    .mtx.qp .factTile { padding: 0 16px; }
    .mtx.qp .factTile:first-child { padding-left: 0; }
    .mtx.qp .factTile + .factTile { border-left: 1px solid var(--line); }
    .mtx.qp .factLabel { margin: 0; font-family: var(--mtx-sans); font-size: 9px; font-weight: 700; letter-spacing: 0.14em; text-transform: uppercase; color: var(--ink-light); }
    .mtx.qp .factValue { margin: 4px 0 0; font-size: 15px; font-weight: 700; color: var(--ink); }

    /* r13 item 1 — percent-of-deal-value stat row: a peer of the dollar
       tiles (Ben: "is how we compare across deals"), not a footnote, so it
       gets the same factTiles treatment one row down, under a small caption
       that names the basis and (only when relevant) the exclusion count. */
    .mtx.qp .percentBand { margin-top: 18px; padding-top: 14px; border-top: 1px solid var(--line); }
    .mtx.qp .percentCaption { margin: 0; font-family: var(--mtx-sans); font-size: 11px; color: var(--ink-light); }
    .mtx.qp .percentExcluded { color: var(--ink-light); }

    /* Underlying-deals disclosure — same grey title-bar voice as a Panel,
       via native <details>/<summary> so it stays collapsed by default. */
    .mtx.qp .subPanel { border: 1px solid var(--line); background: var(--paper); margin-top: 18px; }
    .mtx.qp .subPanelTitleBar { display: block; background: var(--paper-2); border-bottom: 1px solid var(--line); padding: 8px 12px; font-family: var(--mtx-sans); font-size: 9px; font-weight: 700; letter-spacing: 0.14em; text-transform: uppercase; color: var(--ink-light); cursor: pointer; list-style: none; }
    .mtx.qp .subPanelTitleBar::-webkit-details-marker { display: none; }
    .mtx.qp .subPanelBody .mtx-table { border: 0; }

    /* item 6 — Columns popover + client sort (FILTER_THEN_LIST only). */
    .mtx.qp .listHead { display: flex; align-items: center; justify-content: flex-end; padding: 10px 12px; border-bottom: 1px solid var(--line); }
    .mtx.qp .colPicker { position: relative; }
    .mtx.qp .colPopover { position: absolute; right: 0; top: calc(100% + 4px); z-index: 6; background: var(--paper); border: 1px solid var(--line); padding: 8px 10px; min-width: 180px; box-shadow: 0 4px 14px rgba(0,0,0,0.08); }
    .mtx.qp .colPopover label { display: flex; align-items: center; gap: 8px; font-family: var(--mtx-sans); font-size: 12px; color: var(--ink); padding: 4px 0; cursor: pointer; }
    .mtx.qp .mtx-table th.sortable { cursor: pointer; user-select: none; }
    .mtx.qp .mtx-table th.expandCol, .mtx.qp .mtx-table td.expandCol { width: 1%; white-space: nowrap; }

    /* item 3 — expandable provision spans, collapsed by default. Same
       "see text" affordance the review page uses (.term-cell-seetext), and
       the quote itself now takes the review page's exact clause-block
       treatment (ClauseSidebar.jsx: border-l-2 border-[#1F1F1F]
       bg-[#F6F6F6] px-2.5 py-2) rather than a one-off tint. r14 item 4:
       ClauseSidebar's own clause block carries no font-serif override — it
       renders in the page's default sans — so this quote block dropped its
       var(--mtx-serif) override to match instead of reading in Tinos. */
    .mtx.qp .mtx-table td.expandCol { cursor: default; }
    .mtx.qp .hitsRow td { cursor: default; padding: 0; background: var(--paper); }
    .mtx.qp .hitBlock { padding: 12px 18px; border-top: 1px solid var(--line); }
    .mtx.qp .hitBlock:first-child { border-top: none; }
    .mtx.qp .hitLabel { display: flex; justify-content: space-between; gap: 12px; font-family: var(--mtx-sans); font-size: 12px; color: var(--ink); margin-bottom: 6px; }
    .mtx.qp .hitAttach { font-family: var(--mtx-sans); font-size: 11px; color: var(--ink-light); margin: -2px 0 6px; }
    .mtx.qp .hitBlock blockquote { margin: 0 0 6px; padding: 8px 10px; border-left: 2px solid var(--ink); background: var(--paper-2); font-family: var(--mtx-sans); font-size: 13px; line-height: 1.5; color: var(--ink); }
    .mtx.qp .hitSection { font-size: 11px; color: var(--ink-light); }
  `}</style>
    </div>
  );
}

function Drilldown({ item, onClose }) {
  return (
    <>
      <div className="mtx-drawer-backdrop" onClick={onClose} />
      <aside className="mtx-drawer">
        <button type="button" className="mtx-btn" onClick={onClose}>Close</button>
        <h2>Provision card</h2>
        {item.card_id && item.deal_id && <Link href={`/review/${item.deal_id}`} className="mtx-btn">Open deal review</Link>}
        <pre>{item.primary_quote?.text || item.verbatim_quote || JSON.stringify(item, null, 2)}</pre>
        <style jsx>{`
          h2 { margin: 14px 0 14px; font-size: 15px; font-family: var(--mtx-sans); }
          /* r14 item 4: same fix as the hitBlock quote below — no serif
             override, inherit the page's default sans. */
          pre { white-space: pre-wrap; line-height: 1.5; color: var(--ink); margin-top: 12px; font-family: var(--mtx-sans); }
        `}</style>
      </aside>
    </>
  );
}

// E1/B3 (2026-07-19 pre-demo audit): a raw feature/deal-meta value can be a
// bare USD amount (companyTerminationFee's amount, deals.value_usd) with no
// type tag telling this generic renderer "this one's money" — every query
// tile (DEAL_COMPARE cells, FILTER_THEN_LIST's Value column, MARKET_RANGE,
// DEAL_TO_MARKET) hits the same formatValue() with just a bare number, so a
// $65.5M fee or an $11.5B deal value rendered as "65533735"/"11500000000".
// Percentages/day-counts/etc. never realistically reach 7 figures, so
// >= 1e6 is a safe, field-agnostic money signal — same threshold/shape as
// components/review-v2/DealHeader.jsx's formatDealValue(), reused here
// rather than reinvented (that component isn't importable into this page's
// bundle cleanly, so the small pure function is duplicated, not re-derived).
function trimOneDecimal(x) {
  const s = x.toFixed(1);
  return s.endsWith('.0') ? s.slice(0, -2) : s;
}

function formatMoney(n) {
  const sign = n < 0 ? '-' : '';
  const abs = Math.abs(n);
  if (abs >= 1e9) {
    const b = abs / 1e9;
    return `${sign}$${b >= 100 ? Math.round(b) : trimOneDecimal(b)}B`;
  }
  const m = abs / 1e6;
  return `${sign}$${m >= 100 ? Math.round(m) : trimOneDecimal(m)}M`;
}

// UPPER_SNAKE (or PascalCase-ish ALL-CAPS) is never a legitimate display
// string on this page — it's always a raw enum/code that slipped through.
const RAW_CODE_RE = /^[A-Z][A-Z0-9]*(?:_[A-Z0-9]+)*$/;

// `fieldPath` is optional — pass the requesting field/column key (e.g.
// 'considerationType', 'goShopPresent') so bare enum codes route through
// the same label path the review page uses (prettifyEnumValue) instead of
// rendering the raw extraction code. Callers with no field context (or a
// field prettifyEnumValue doesn't recognize) get the value back unchanged.
//
// R (2026-07-19 query-results overhaul): item 4 — prettifyEnumValue's own
// per-field taxonomy branches (e.g. considerationType) can still echo an
// UPPER_SNAKE code back unchanged when a value falls outside that branch's
// own vocabulary (deal-level codes like STOCK/MIXED_ELECTION hitting the
// provision-level considerationType dictionary). Never let a raw code reach
// the page across ANY query kind — humanize it as a last resort.
function formatValue(value, fieldPath) {
  if (value === null || value === undefined || value === '') return '-';
  if (typeof value === 'boolean') return value ? 'Yes' : 'No';
  if (typeof value === 'number') {
    if (Math.abs(value) >= 1e6) return formatMoney(value);
    return round(value);
  }
  const pretty = prettifyEnumValue(fieldPath || '', String(value));
  if (typeof pretty === 'string' && RAW_CODE_RE.test(pretty)) return humanizeKey(pretty);
  return pretty;
}

function round(value) {
  const n = Number(value);
  if (!Number.isFinite(n)) return '-';
  return n.toFixed(2).replace(/\.00$/, '').replace(/(\.\d)0$/, '$1');
}

function pluralize(n, singular, plural) {
  return `${n} ${n === 1 ? singular : (plural || `${singular}s`)}`;
}

function baseline(stats) {
  if (!stats) return '-';
  if (stats.p25 != null || stats.p75 != null) return `${round(stats.p25)}-${round(stats.p75)}`;
  if (Array.isArray(stats.distribution) && stats.distribution[0]) return stats.distribution[0].value;
  return '-';
}
