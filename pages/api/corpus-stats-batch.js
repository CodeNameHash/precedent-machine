// GET /api/corpus-stats-batch — corpus-wide context for multiple provision
// codes in one request. The endpoint fetches the code-independent peer set
// once, then partitions cards/claims in memory and builds one result per code.
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
  valueLabel,
} = require('../../lib/queries/corpus-stats-core');

export const config = { maxDuration: 60 };

const MAX_CODES = 60;
// Increment whenever the response semantics change without a corpus mutation.
// Clients include this in their own cache identity and can reject stale shapes.
export const MARKET_STATS_SCHEMA_VERSION = 2;

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

function canonicalKey(value) {
  if (value === null || value === undefined) return null;
  if (typeof value === 'object') {
    const code = value.code ?? value.value ?? value.label;
    return code === null || code === undefined ? null : String(code);
  }
  return String(value);
}

function canonicalValues(value) {
  const list = Array.isArray(value) ? value : [value];
  return list.map(canonicalKey).filter(Boolean);
}

// buildCodeStats historically counted categorical CLAIMS. That produced values
// in the hundreds on a 40-deal corpus, especially for repeated rep/IOC claims.
// The compare page's unit is a deal: each deal contributes at most once to a
// particular categorical value. List-valued features may legitimately place a
// deal in several value buckets, but no individual bucket can exceed the peer
// set and `total` is the number of distinct deals with any captured value.
function normalizeCategoricalDealCounts(stats, claimsForCode, peerIds) {
  if (!stats || !Array.isArray(stats.featureSummary)) return stats;
  const claimsByAttribute = new Map();
  for (const claim of claimsForCode || []) {
    if (!peerIds.has(claim.deal_id)) continue;
    if (!claimsByAttribute.has(claim.attribute)) claimsByAttribute.set(claim.attribute, []);
    claimsByAttribute.get(claim.attribute).push(claim);
  }

  const featureSummary = stats.featureSummary.map((summary) => {
    if (!summary || summary.kind === 'numeric') return summary;
    const byValue = new Map();
    const dealsWithValue = new Set();
    for (const claim of claimsByAttribute.get(summary.attribute) || []) {
      for (const value of canonicalValues(claim.canonical)) {
        dealsWithValue.add(claim.deal_id);
        if (!byValue.has(value)) byValue.set(value, new Set());
        byValue.get(value).add(claim.deal_id);
      }
    }
    if (!byValue.size) return summary;
    return {
      ...summary,
      values: [...byValue.entries()]
        .map(([value, dealIds]) => ({
          value,
          label: valueLabel(summary.attribute, value),
          count: dealIds.size,
          denominator: dealsWithValue.size,
        }))
        .sort((a, b) => b.count - a.count || a.label.localeCompare(b.label))
        .slice(0, 20),
      total: dealsWithValue.size,
      countUnit: 'deals',
    };
  });
  return { ...stats, featureSummary };
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
        for (const code of cardChunks[i].codes) truncatedCodes.add(code);
      }
      cards.push(...rows);
    });

    const base = buildCorpusBase({ deals: dealsResult.data, cards, subjectDealId, filters });
    const {
      peerSet, peerIds, subject, firmsByDeal, options,
    } = base;

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
        for (const code of claimChunks[i].codes) truncatedCodes.add(code);
      }
      claims.push(...rows);
    });

    const cardsByCode = partitionByCode(cards, codes, codeOfCard);
    const claimsByCode = partitionByCode(claims, codes, codeOfClaim);

    const byCode = {};
    for (const code of codes) {
      const codeClaims = claimsByCode.get(code) || [];
      const rawStats = buildCodeStats({
        code,
        cardsForCode: cardsByCode.get(code) || [],
        claimsForCode: codeClaims,
        subjectDealId,
        subject,
        peerSet,
        peerIds,
        firmsByDeal,
      });
      const stats = normalizeCategoricalDealCounts(rawStats, codeClaims, peerIds);
      byCode[code] = {
        ...stats,
        options,
        rowContext: null,
        schemaVersion: MARKET_STATS_SCHEMA_VERSION,
        ...(truncatedCodes.has(code) ? { truncated: true } : {}),
      };
    }

    res.setHeader('Cache-Control', req.query.v ? VERSIONED_CACHE : CACHE);
    return res.status(200).json({ schemaVersion: MARKET_STATS_SCHEMA_VERSION, byCode });
  } catch (error) {
    return res.status(500).json({ error: error.message || String(error) });
  }
}
