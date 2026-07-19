// Review page compare/market data layer (Ben: "deal compare / deal to
// market should look EXACTLY like the main review page"). Client-side hooks
// powering /review/[id]?compare=<dealId>[,<dealId2>] and ?market=1:
//
//   - useComparedDeals(ids)      -> per-compared-deal { name, reviewDeal }
//                                   via the SAME /api/deals?view=header +
//                                   /api/review/<id>/cards fetches the page
//                                   already uses for the primary deal.
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

function dealDisplayName(deal) {
  if (!deal) return null;
  const meta = deal.metadata || {};
  const target = meta.target_display || deal.target || null;
  const acquirer = meta.acquirer_display || deal.acquirer || null;
  if (acquirer && target) return `${acquirer} / ${target}`;
  return target || acquirer || null;
}

async function fetchJson(url) {
  const response = await fetch(url);
  const payload = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(payload.error || `HTTP ${response.status}`);
  return payload;
}

// One column per compared deal: { id, name, reviewDeal, loading, error }.
// Both fetches per deal run in parallel; a header failure alone doesn't
// sink the column (name just falls back), a cards failure does.
export function useComparedDeals(ids) {
  const key = (ids || []).join(',');
  const [columns, setColumns] = useState([]);
  useEffect(() => {
    if (!key) {
      setColumns([]);
      return undefined;
    }
    const list = key.split(',');
    let cancelled = false;
    setColumns(list.map((id) => ({ id, name: null, reviewDeal: null, loading: true, error: null })));
    list.forEach((id, index) => {
      Promise.all([
        fetchJson(`/api/deals?id=${encodeURIComponent(id)}&view=header`).catch(() => null),
        fetchJson(`/api/review/${encodeURIComponent(id)}/cards`),
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
    };
  }, [key]);
  return columns;
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

// { [sectionId]: { code, stats, loading, error } }. One corpus-stats fetch
// per DISTINCT code (sections sharing a code share the response), batched.
export function useSectionMarketStats(enabled, dealId, sectionCodes) {
  const key = enabled && dealId && sectionCodes.length
    ? `${dealId}|${sectionCodes.map((s) => `${s.sectionId}:${s.code || ''}`).join(',')}`
    : '';
  const [byCode, setByCode] = useState({});
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
    const codes = codesKey.split(',');
    setByCode(Object.fromEntries(codes.map((code) => [code, { stats: null, loading: true, error: null }])));
    codes.forEach((code) => {
      fetchJson(`/api/corpus-stats?code=${encodeURIComponent(code)}&deal_id=${encodeURIComponent(dealId)}`)
        .then((stats) => {
          if (cancelled) return;
          setByCode((cur) => ({ ...cur, [code]: { stats, loading: false, error: null } }));
        })
        .catch((error) => {
          if (cancelled) return;
          setByCode((cur) => ({ ...cur, [code]: { stats: null, loading: false, error: error.message || String(error) } }));
        });
    });
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key, codesKey, dealId]);
  return useMemo(() => {
    const out = {};
    for (const { sectionId, code } of sectionCodes) {
      out[sectionId] = code
        ? { code, ...(byCode[code] || { stats: null, loading: true, error: null }) }
        : { code: null, stats: null, loading: false, error: null };
    }
    return out;
  }, [sectionCodes, byCode]);
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
  useEffect(() => {
    if (!enabled || !dealId) {
      setState({ rows: [], loading: false, error: null });
      return undefined;
    }
    let cancelled = false;
    setState({ rows: [], loading: true, error: null });
    const payload = encodePayload({ deal_id: dealId, comparison_set_filter: {}, provision_types: null });
    fetchJson(`/api/query/run?kind=DEAL_TO_MARKET&payload=${payload}`)
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
    };
  }, [enabled, dealId]);
  return state;
}
