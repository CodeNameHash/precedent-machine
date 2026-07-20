// GET /api/corpus-stats-batch — the SAME corpus-wide context /api/corpus-
// stats.js computes, for MULTIPLE provision codes in one request (r13, deal-
// to-market perf follow-on: components/review-v2/compareData.js's
// useSectionMarketStats used to fire one /api/corpus-stats call per distinct
// section code on the page -- a review page with a dozen-plus sections meant
// a dozen-plus round trips for what's fundamentally the same corpus query
// repeated with a different `code` filter).
//
// Params: codes=CSV (required), deal_id, sector, yearFrom, yearTo, minValue,
// maxValue, buyer, form, lawFirm (same deal-fact filter vocabulary as
// corpus-stats.js), v (corpus-version cache token, same VERSIONED_CACHE
// contract as corpus-stats.js -- see pages/api/corpus-version.js).
//
// Response: { byCode: { CODE: <same shape as a single corpus-stats response,
// minus rowContext -- this endpoint never takes featureKeys/itemCode/
// itemLabel since useSectionMarketStats never sends them> } }.
//
// Efficiency: deals is fetched ONCE for the whole batch (not once per code --
// see lib/queries/corpus-stats-core.js's buildCorpusBase, which is the
// code-INDEPENDENT half of corpus-stats.js's own computation, extracted so
// both endpoints run the identical logic). cards/claims are each fetched
// with `.in()` over ALL requested codes, chunked into a handful of queries
// (chunkCodesForQuery) so no single query risks a silent PostgREST page-size
// truncation as codes.length grows, then partitioned by code IN MEMORY
// (partitionByCode) -- N codes costs a small constant number of queries, not
// N queries and not N full claims-table scans.
//
// Truncation guard: claims is the table this matters for (~70k rows,
// filtered by an unindexed `provenance->>code` expression) -- if a chunk's
// query comes back at exactly its row cap, every code in that chunk is
// flagged `truncated: true` in its response entry (we can't tell WHICH code
// inside the chunk got cut off, so every code in it gets the honest flag
// rather than one silently under-counting). Same treatment for cards, whose
// per-code counts are normally tiny but get the same guard for symmetry.
//
// Same 15s abort/retry contract as the client already has for corpus-stats
// (components/review-v2/compareData.js) -- this endpoint changes nothing
// about that, only how many round trips it takes.
import { getServiceSupabase } from '../../lib/supabase';

const {
  CACHE,
  VERSIONED_CACHE,
  buildCorpusBase,
  buildCodeStats,
  chunkCodesForQuery,
  partitionByCode,
  DEFAULT_PER_CODE_CLAIMS_LIMIT,
  DEFAULT_PER_CODE_CARDS_LIMIT,
} = require('../../lib/queries/corpus-stats-core');

// Same DB-degraded-incident rationale as corpus-stats.js's maxDuration: fail
// fast instead of holding a Postgres connection for 300s.
export const config = { maxDuration: 60 };

// A review page has, in practice, a few dozen distinct section codes at
// most -- this bounds the batch endpoint's own worst case (and the number of
// chunked queries it fires) rather than trusting an arbitrary client-sent
// CSV.
const MAX_CODES = 60;

function num(v) {
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
}

function codeOfClaim(claim) {
  const code = claim && claim.provenance && claim.provenance.code;
  return code ? String(code).toUpperCase() : null;
}

function codeOfCard(card) {
  return card && card.provision_subtype ? String(card.provision_subtype).toUpperCase() : null;
}

export default async function handler(req, res) {
  if (req.method !== 'GET') {
    res.setHeader('Allow', 'GET');
    return res.status(405).json({ error: 'GET only' });
  }
  const codes = [...new Set(
    String(req.query.codes || '')
      .split(',')
      .map((s) => s.trim().toUpperCase())
      .filter(Boolean),
  )].slice(0, MAX_CODES);
  if (!codes.length) return res.status(400).json({ error: 'codes is required' });

  const subjectDealId = req.query.deal_id ? String(req.query.deal_id) : null;
  const filters = {
    sector: req.query.sector ? String(req.query.sector) : null,
    yearFrom: num(req.query.yearFrom),
    yearTo: num(req.query.yearTo),
    minValue: num(req.query.minValue),
    maxValue: num(req.query.maxValue),
    buyer: req.query.buyer ? String(req.query.buyer) : null,
    form: req.query.form ? String(req.query.form) : null,
    lawFirm: req.query.lawFirm ? String(req.query.lawFirm) : null,
  };

  const sb = getServiceSupabase();
  if (!sb) return res.status(500).json({ error: 'Supabase not configured' });

  try {
    // Cards: chunked `.in('provision_subtype', ...)` -- same truncation
    // guard as claims below, sized for cards' much smaller per-code counts.
    const cardChunks = chunkCodesForQuery(codes, DEFAULT_PER_CODE_CARDS_LIMIT);
    const truncatedCodes = new Set();

    const [dealsResult, ...cardChunkResults] = await Promise.all([
      sb.from('deals').select('id, acquirer, target, sector, value_usd, announce_date, metadata'),
      ...cardChunks.map((chunk) => sb
        .from('provision_cards')
        .select('deal_id, provision_subtype, id, excerpt_id')
        .in('provision_subtype', chunk.codes)
        .limit(chunk.limit)),
    ]);
    if (dealsResult.error) throw new Error(dealsResult.error.message);
    const cards = [];
    cardChunkResults.forEach((result, i) => {
      if (result.error) throw new Error(result.error.message);
      const rows = result.data || [];
      if (rows.length >= cardChunks[i].limit) {
        for (const c of cardChunks[i].codes) truncatedCodes.add(c);
      }
      cards.push(...rows);
    });

    const base = buildCorpusBase({ deals: dealsResult.data, cards, subjectDealId, filters });
    const {
      peerSet, peerIds, subject, firmsByDeal, options,
    } = base;

    // Claims: same chunked-`.in()` pattern, sized for claims' much larger
    // per-code counts (see DEFAULT_PER_CODE_CLAIMS_LIMIT).
    const claimChunks = chunkCodesForQuery(codes, DEFAULT_PER_CODE_CLAIMS_LIMIT);
    const claimChunkResults = await Promise.all(claimChunks.map((chunk) => sb
      .from('claims')
      .select('deal_id, attribute, canonical, verbatim, evidence_quote, provenance, id, created_at, excerpt_id')
      .in('provenance->>code', chunk.codes)
      .limit(chunk.limit)));
    const claims = [];
    claimChunkResults.forEach((result, i) => {
      if (result.error) throw new Error(result.error.message);
      const rows = result.data || [];
      if (rows.length >= claimChunks[i].limit) {
        for (const c of claimChunks[i].codes) truncatedCodes.add(c);
      }
      claims.push(...rows);
    });

    const cardsByCode = partitionByCode(cards, codes, codeOfCard);
    const claimsByCode = partitionByCode(claims, codes, codeOfClaim);

    const byCode = {};
    for (const code of codes) {
      const stats = buildCodeStats({
        code,
        cardsForCode: cardsByCode.get(code) || [],
        claimsForCode: claimsByCode.get(code) || [],
        subjectDealId,
        subject,
        peerSet,
        peerIds,
        firmsByDeal,
      });
      byCode[code] = {
        ...stats,
        options,
        // Never populated -- this endpoint doesn't take featureKeys/
        // itemCode/itemLabel (useSectionMarketStats, the sole caller, never
        // sends them). Kept for response-shape parity with corpus-stats.js.
        rowContext: null,
        ...(truncatedCodes.has(code) ? { truncated: true } : {}),
      };
    }

    res.setHeader('Cache-Control', req.query.v ? VERSIONED_CACHE : CACHE);
    return res.status(200).json({ byCode });
  } catch (error) {
    return res.status(500).json({ error: error.message || String(error) });
  }
}
