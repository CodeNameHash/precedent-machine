// Review page compare/market data layer. Client-side hooks powering
// /review/[id]?compare=<dealId>[,<dealId2>] and ?market=1:
//
//   - useComparedDeals(ids)      -> per-compared-deal { name, reviewDeal }
//                                   via the SAME /api/deals?view=header +
//                                   /api/review/<id>/cards fetches the page
//                                   already uses for the primary deal.
//   - useRowMarketStats(...)     -> one typed POST covering every visible
//                                   review row.
//   - useSectionMarketStats(...) -> one GET /api/corpus-stats per section
//                                   (keyed by the section's dominant
//                                   provision_subtype), Promise-batched on
//                                   mount — the responses are edge-cached
//                                   (s-maxage=3600) so this is cheap.
//   - useDealToMarket(...)       -> the DEAL_TO_MARKET executor's existing
//                                   comparison output via /api/query/run,
//                                   filtered down to off-market/unusual
//                                   rows minus purely-commercial fields
//                                   (consideration type / price are
//                                   commercial decisions, not terms — Ben).

import { useEffect, useMemo, useState } from 'react';
import { reconstructReviewDeal } from '../../lib/queries/reconstruct-review-deal';
import { getCorpusVersion } from '../../lib/client/corpus-version.js';
import {
  mergeMarketMetricBatchResponses,
  splitMarketMetricBatchRequest,
} from '../../lib/market-metrics';

const UUID_RE = /^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$/;
const MAX_COMPARED = 3;

export function parseCompareIds(raw, primaryId) {
  if (!raw) return [];
  const seen = new Set();
  const out = [];
  for (const token of String(raw).split(',')) {
    const id = token.trim();
    if (!UUID_RE.test(id)) continue;
    if (primaryId && id.toLowerCase() === String(primaryId).toLowerCase()) continue;
    if (seen.has(id.toLowerCase())) continue;
    seen.add(id.toLowerCase());
    out.push(id);
    if (out.length >= MAX_COMPARED) break;
  }
  return out;
}

// Exported for the compare-mode unified table's primary-deal column header
// (pages/review/[id].js) — same display-name rule the compared columns use.
export function dealDisplayName(deal) {
  if (!deal) return null;
  const meta = deal.metadata || {};
  const target = meta.target_display || deal.target || null;
  const acquirer = meta.acquirer_display || deal.acquirer || null;
  if (acquirer && target) return `${acquirer} / ${target}`;
  return target || acquirer || null;
}

// C (deal-to-market/compare robustness, Supabase-degraded incident): every
// fetch in this module used to run with no timeout at all -- when the DB is
// slow/hung, the request just never resolves and the calling column sits on
// "LOADING…" forever with no way out. Mirrors ClauseSidebar.jsx's own fix
// for the same incident: bound every request with an AbortController
// timeout so a hung backend surfaces as a retryable error instead of an
// infinite spinner.
const FETCH_TIMEOUT_MS = 15000;

async function fetchJson(url, { signal, timeoutMs = FETCH_TIMEOUT_MS, ...requestInit } = {}) {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs);
  // Let an external (effect-cleanup) abort also cancel this fetch.
  const onExternalAbort = () => controller.abort();
  if (signal) {
    if (signal.aborted) controller.abort();
    else signal.addEventListener('abort', onExternalAbort);
  }
  try {
    const response = await fetch(url, { ...requestInit, signal: controller.signal });
    const payload = await response.json().catch(() => ({}));
    if (!response.ok) {
      const message = typeof payload.error === 'string'
        ? payload.error
        : payload.error?.message || payload.message || `HTTP ${response.status}`;
      throw new Error(message);
    }
    return payload;
  } catch (err) {
    if (err && err.name === 'AbortError') {
      // Distinguish "the caller (effect cleanup) cancelled this" -- which
      // should silently drop, not surface as an error -- from an actual
      // timeout, which should.
      if (signal && signal.aborted) throw err;
      throw new Error('Timed out');
    }
    throw err;
  } finally {
    clearTimeout(timeoutId);
    if (signal) signal.removeEventListener('abort', onExternalAbort);
  }
}

// One typed batch for every visible review row. `request` is produced by
// buildMarketMetricBatchRequest() and contains the row contract, not display
// data, so the server can apply one denominator and unit policy consistently.
export function useRowMarketStats(enabled, request) {
  const requestKey = enabled && request?.specs?.length ? JSON.stringify(request) : '';
  const [state, setState] = useState({ byRow: {}, rowOrder: [], cohort: null, loading: false, error: null });
  const [retryNonce, setRetryNonce] = useState(0);

  useEffect(() => {
    if (!requestKey) {
      setState({ byRow: {}, rowOrder: [], cohort: null, loading: false, error: null });
      return undefined;
    }
    let cancelled = false;
    const controller = new AbortController();
    setState({ byRow: {}, rowOrder: [], cohort: null, loading: true, error: null });
    const fullRequest = JSON.parse(requestKey);
    const requests = splitMarketMetricBatchRequest(fullRequest);
    Promise.all(requests.map((batch) => fetchJson('/api/market-stats', {
      signal: controller.signal,
      timeoutMs: 30000,
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(batch),
    })))
      .then((payloads) => {
        if (cancelled) return;
        const payload = mergeMarketMetricBatchResponses(payloads, fullRequest);
        setState({
          byRow: payload?.byRow || {},
          rowOrder: Array.isArray(payload?.rowOrder) ? payload.rowOrder : [],
          cohort: payload?.cohort || null,
          loading: false,
          error: null,
        });
      })
      .catch((error) => {
        if (cancelled || error?.name === 'AbortError') return;
        setState({ byRow: {}, rowOrder: [], cohort: null, loading: false, error: error.message || String(error) });
      });
    return () => {
      cancelled = true;
      controller.abort();
    };
  }, [requestKey, retryNonce]);

  return { ...state, retry: () => setRetryNonce((n) => n + 1) };
}

// One column per compared deal: { id, name, reviewDeal, loading, error }.
// Both fetches per deal run in parallel; a header failure alone doesn't
// sink the column (name just falls back), a cards failure does.
export function useComparedDeals(ids) {
  const key = (ids || []).join(',');
  const [columns, setColumns] = useState([]);
  // C: bumped by retry() below to force a re-fetch of every compared column
  // after a failure -- same "explicit retry, bypass nothing cached" pattern
  // ClauseSidebar.jsx uses for /api/corpus-stats.
  const [retryNonce, setRetryNonce] = useState(0);
  useEffect(() => {
    if (!key) {
      setColumns([]);
      return undefined;
    }
    const list = key.split(',');
    let cancelled = false;
    const controller = new AbortController();
    setColumns(list.map((id) => ({ id, name: null, reviewDeal: null, loading: true, error: null })));
    list.forEach((id, index) => {
      Promise.all([
        fetchJson(`/api/deals?id=${encodeURIComponent(id)}&view=header`, { signal: controller.signal }).catch(() => null),
        fetchJson(`/api/review/${encodeURIComponent(id)}/cards`, { signal: controller.signal }),
      ])
        .then(([dealPayload, cardsPayload]) => {
          if (cancelled) return;
          const reviewDeal = cardsPayload && cardsPayload.reviewDeal
            ? reconstructReviewDeal(cardsPayload.reviewDeal)
            : null;
          const name = dealDisplayName(dealPayload && dealPayload.deal);
          setColumns((cur) => cur.map((col, i) => (i === index
            ? { ...col, name, reviewDeal, loading: false, error: null }
            : col)));
        })
        .catch((error) => {
          if (cancelled) return;
          setColumns((cur) => cur.map((col, i) => (i === index
            ? { ...col, loading: false, error: error.message || String(error) }
            : col)));
        });
    });
    return () => {
      cancelled = true;
      controller.abort();
    };
  }, [key, retryNonce]);
  return { columns, retry: () => setRetryNonce((n) => n + 1) };
}

// The section's dominant provision_subtype — the same `code` ClauseSidebar
// sends to /api/corpus-stats for a selected card, here picked as the modal
// subtype across the section's cards.
export function dominantSectionCode(cards) {
  const counts = new Map();
  for (const card of cards || []) {
    const code = String(card && card.provision_subtype ? card.provision_subtype : '').toUpperCase();
    if (!code) continue;
    counts.set(code, (counts.get(code) || 0) + 1);
  }
  let best = null;
  let bestCount = 0;
  for (const [code, count] of counts) {
    if (count > bestCount) {
      best = code;
      bestCount = count;
    }
  }
  return best;
}

// Per-code fallback path (pre-batch behavior, r13): one /api/corpus-stats
// call per distinct code. Used when /api/corpus-stats-batch errors (a stale
// deploy without the new route, or any other batch failure) so a rollout
// hiccup on the batch endpoint degrades to the old N-request behavior
// instead of breaking the deal-to-market section entirely.
function fetchPerCodeStats(codes, dealId, version, signal, onCode) {
  const v = version ? `&v=${encodeURIComponent(version)}` : '';
  codes.forEach((code) => {
    fetchJson(`/api/corpus-stats?code=${encodeURIComponent(code)}&deal_id=${encodeURIComponent(dealId)}${v}`, { signal })
      .then((stats) => onCode(code, { stats, loading: false, error: null }))
      .catch((error) => onCode(code, { stats: null, loading: false, error: error.message || String(error) }));
  });
}

// { [sectionId]: { code, stats, loading, error } }. ONE /api/corpus-stats-
// batch call for every distinct code on the page (r13, deal-to-market perf
// follow-on -- this used to be one /api/corpus-stats call PER distinct code,
// which meant a dozen-plus round trips for a review page with that many
// distinct sections). Falls back to the old per-code path if the batch call
// itself errors, so a stale deploy without the new route can't break the
// section.
export function useSectionMarketStats(enabled, dealId, sectionCodes) {
  const key = enabled && dealId && sectionCodes.length
    ? `${dealId}|${sectionCodes.map((s) => `${s.sectionId}:${s.code || ''}`).join(',')}`
    : '';
  const [byCode, setByCode] = useState({});
  // C: see useComparedDeals' retryNonce -- same manual-retry pattern.
  const [retryNonce, setRetryNonce] = useState(0);
  const codesKey = useMemo(() => {
    const distinct = [...new Set(sectionCodes.map((s) => s.code).filter(Boolean))];
    return distinct.join(',');
  }, [sectionCodes]);
  useEffect(() => {
    if (!key || !codesKey) {
      setByCode({});
      return undefined;
    }
    let cancelled = false;
    const controller = new AbortController();
    const codes = codesKey.split(',');
    setByCode(Object.fromEntries(codes.map((code) => [code, { stats: null, loading: true, error: null }])));
    const setCode = (code, entry) => {
      if (cancelled) return;
      setByCode((cur) => ({ ...cur, [code]: entry }));
    };
    // r13 (corpus-version cache token): never block on the version probe --
    // getCorpusVersion() always resolves within its own ~2s cap (null on
    // failure/timeout), same pattern as ClauseSidebar.jsx.
    getCorpusVersion().then((version) => {
      if (cancelled) return;
      const v = version ? `&v=${encodeURIComponent(version)}` : '';
      fetchJson(`/api/corpus-stats-batch?codes=${encodeURIComponent(codes.join(','))}&deal_id=${encodeURIComponent(dealId)}${v}`, { signal: controller.signal })
        .then((payload) => {
          if (cancelled) return;
          const byCodeResult = (payload && payload.byCode) || {};
          codes.forEach((code) => {
            const entry = byCodeResult[code];
            setCode(code, entry ? { stats: entry, loading: false, error: null } : { stats: null, loading: false, error: 'No corpus stats returned for this code' });
          });
        })
        .catch(() => {
          // Batch endpoint failed outright (network error, 404 on a stale
          // deploy, 500, etc.) -- fall back to the per-code path rather than
          // leaving every section stuck on "loading".
          if (cancelled) return;
          fetchPerCodeStats(codes, dealId, version, controller.signal, setCode);
        });
    });
    return () => {
      cancelled = true;
      controller.abort();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key, codesKey, dealId, retryNonce]);
  const byCodeWithSections = useMemo(() => {
    const out = {};
    for (const { sectionId, code } of sectionCodes) {
      out[sectionId] = code
        ? { code, ...(byCode[code] || { stats: null, loading: true, error: null }) }
        : { code: null, stats: null, loading: false, error: null };
    }
    return out;
  }, [sectionCodes, byCode]);
  return { bySection: byCodeWithSections, retry: () => setRetryNonce((n) => n + 1) };
}

// base64url without Buffer (browser) — mirrors lib/query/fixtures.js's
// encodePayload for the /api/query/run `payload` param.
function encodePayload(payload) {
  const utf8 = typeof TextEncoder !== 'undefined'
    ? String.fromCharCode(...new TextEncoder().encode(JSON.stringify(payload)))
    : JSON.stringify(payload);
  return btoa(utf8).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

// Purely-commercial fields are excluded from "Off-market terms" — Ben:
// "that shouldn't include things like consideration type or price, those
// are just commercial decisions." NB deliberately NOT a bare /value/i match:
// that would falsely swallow terminationFeePercentEquityValue (a legal term
// denominated against equity value, not a commercial price field).
const COMMERCIAL_FIELD_RE = /consideration|price|perShare|exchangeRatio/i;
const COMMERCIAL_EXACT = new Set(['value', 'dealvalue', 'totaldealvalue', 'value_usd']);

export function isCommercialField(row) {
  const field = String((row && (row.field_path || row.field)) || '');
  if (COMMERCIAL_FIELD_RE.test(field)) return true;
  if (COMMERCIAL_EXACT.has(field.toLowerCase())) return true;
  if (String(row && row.provision_type) === 'CONSIDERATION') return true;
  return false;
}

export function offMarketRows(scorecard) {
  return (scorecard || [])
    .filter((row) => row.status === 'OFF_MARKET' || row.status === 'UNUSUAL')
    .filter((row) => !isCommercialField(row));
}

// { rows, loading, error } — rows already filtered to off-market/unusual,
// commercial fields excluded. rows === [] with loading false => hide the
// section entirely (per spec).
export function useDealToMarket(enabled, dealId) {
  const [state, setState] = useState({ rows: [], loading: false, error: null });
  // C: see useComparedDeals' retryNonce -- same manual-retry pattern.
  const [retryNonce, setRetryNonce] = useState(0);
  useEffect(() => {
    if (!enabled || !dealId) {
      setState({ rows: [], loading: false, error: null });
      return undefined;
    }
    let cancelled = false;
    const controller = new AbortController();
    setState({ rows: [], loading: true, error: null });
    const payload = encodePayload({ deal_id: dealId, comparison_set_filter: {}, provision_types: null });
    fetchJson(`/api/query/run?kind=DEAL_TO_MARKET&payload=${payload}`, { signal: controller.signal })
      .then((json) => {
        if (cancelled) return;
        const scorecard = json && json.result ? json.result.scorecard : null;
        setState({ rows: offMarketRows(scorecard), loading: false, error: null });
      })
      .catch((error) => {
        if (cancelled) return;
        setState({ rows: [], loading: false, error: error.message || String(error) });
      });
    return () => {
      cancelled = true;
      controller.abort();
    };
  }, [enabled, dealId, retryNonce]);
  return { ...state, retry: () => setRetryNonce((n) => n + 1) };
}
