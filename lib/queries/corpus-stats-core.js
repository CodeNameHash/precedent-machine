// Shared per-code corpus-stats computation, extracted from
// pages/api/corpus-stats.js (r13, batch endpoint follow-on) so
// pages/api/corpus-stats-batch.js can reuse the EXACT SAME peer-set /
// featureSummary / peers logic instead of drifting a second copy.
//
// Split into two phases so a batch caller pays for the code-INDEPENDENT
// work (deals fetch, peer-set membership, firm resolution, filter option
// lists) exactly ONCE, then runs the code-DEPENDENT phase (dealsWithCode /
// featureSummary / peers) once per code against in-memory-partitioned
// cards/claims -- no per-code database round trip.
//
//   buildCorpusBase({ deals, cards, subjectDealId, filters })
//     -> { stagingFree, firmsByDeal, dealsById, cardIdByKey, subject,
//          peerSet, peerIds, options }
//   buildCodeStats({ code, cardsForCode, claimsForCode, subjectDealId,
//                     subject, peerSet, peerIds, firmsByDeal })
//     -> { code, peerSetSize, dealsWithCode, featureSummary, peers }
//
// pages/api/corpus-stats.js calls both (base once, code once) and keeps its
// OWN rowContext logic locally -- rowContext needs the full unscoped claims
// fetch and buildFeatureDistribution/buildInstrumentDistribution, which the
// batch endpoint never requests (useSectionMarketStats never sends
// featureKeys/itemCode/itemLabel), so those stay where they were.

const { FEATURES } = require('../schema/features');
const taxonomy = require('../taxonomy');
// r14 (Ben, "compare look-back LENGTHS, not dates"): shared converter for
// deal-relative anchor fields — see lib/query/relative-periods.js for the
// audited field registry, the rounding rule, and the never-guess contract.
const { toRelativeMonthsForField, RELATIVE_MONTHS_UNIT } = require('../query/relative-periods');

const CACHE = 's-maxage=3600, stale-while-revalidate=86400';
// Version-keyed requests (`&v=<corpus version>` from /api/corpus-version)
// are immutable: the version is part of the edge-cache key, and any corpus
// change mints a new version — so these can cache for a week with no
// staleness risk beyond corpus-version's own 60s probe window.
const VERSIONED_CACHE = 's-maxage=604800, stale-while-revalidate=604800';

function num(v) {
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
}

// "superiorProposalDeterminer" → "Superior proposal determiner";
// "BOARD_LEGAL_AND_FINANCIAL" → "Board legal and financial".
function humanizeKey(raw) {
  const spaced = String(raw || '')
    .replace(/[_-]+/g, ' ')
    .replace(/([a-z0-9])([A-Z])/g, '$1 $2')
    .toLowerCase()
    .trim();
  return spaced ? spaced.charAt(0).toUpperCase() + spaced.slice(1) : String(raw || '');
}

// Registry labels can carry long parentheticals/em-dash tails — keep the head.
function attributeLabel(attribute) {
  const entry = FEATURES[attribute];
  const label = entry && entry.label ? String(entry.label) : null;
  if (!label) return humanizeKey(attribute);
  return label.split(' — ')[0].split(' (')[0].trim() || humanizeKey(attribute);
}

function valueLabel(attribute, code) {
  try {
    const dict = taxonomy.taxonomyForFeatureKey(attribute);
    const label = dict ? taxonomy.labelForCode(String(code), dict) : null;
    if (label) return String(label).split(' — ')[0].trim();
  } catch { /* fall through */ }
  return humanizeKey(code);
}

// Normalize a firm string to its short common name ("Skadden, Arps, Slate…"
// → "Skadden"); good enough for filtering/labels across 40 deals.
function firmShort(raw) {
  const head = String(raw || '').split(',')[0].trim();
  return head.replace(/\s+LLP$|\s+LLC$|\s+L\.L\.P\.$/i, '').trim() || null;
}

function dealFirms(deal) {
  const adv = deal.metadata && deal.metadata.advisors_v2;
  if (!adv) return [];
  const firms = new Set();
  for (const key of ['buyer_firm', 'seller_firm']) {
    const short = firmShort(adv[key]);
    if (short) firms.add(short);
  }
  for (const key of ['buyer_firms', 'seller_firms']) {
    for (const f of adv[key] || []) {
      const short = firmShort(typeof f === 'string' ? f : f && f.firm_raw);
      if (short) firms.add(short);
    }
  }
  const blocks = (adv.raw && adv.raw.blocks) || [];
  for (const b of blocks) {
    for (const f of b.firms || []) {
      const short = firmShort(f && f.firm_raw);
      if (short) firms.add(short);
    }
  }
  return [...firms];
}

function dealPassesFilters(deal, f, firmsByDeal) {
  if (f.sector && String(deal.sector || '') !== f.sector) return false;
  const year = deal.announce_date ? Number(String(deal.announce_date).slice(0, 4)) : null;
  if (f.yearFrom && (!year || year < f.yearFrom)) return false;
  if (f.yearTo && (!year || year > f.yearTo)) return false;
  const value = num(deal.value_usd);
  if (f.minValue && (!value || value < f.minValue)) return false;
  if (f.maxValue && (!value || value > f.maxValue)) return false;
  if (f.buyer && String(deal.acquirer || '') !== f.buyer) return false;
  if (f.form && String((deal.metadata && deal.metadata.merger_form) || '') !== f.form) return false;
  if (f.lawFirm && !(firmsByDeal.get(deal.id) || []).includes(f.lawFirm)) return false;
  return true;
}

// Similarity rank for the comparable-deal list: same sector first, then
// size proximity (within 3x), then recency. Not a guess dressed as science —
// just a stable, explainable ordering.
function similarity(deal, subject) {
  let score = 0;
  if (subject && deal.sector && deal.sector === subject.sector) score += 4;
  const a = num(deal.value_usd); const b = subject && num(subject.value_usd);
  if (a && b) {
    const ratio = a > b ? a / b : b / a;
    if (ratio <= 3) score += 2;
    else if (ratio <= 10) score += 1;
  }
  return score;
}

// "<acquirer_display||acquirer> / <target_display||target>" — same flat
// metadata fields pages/api/deals.js and lib/home-data.js already read.
function dealLabel(deal) {
  const meta = (deal && deal.metadata) || {};
  const acquirer = meta.acquirer_display || deal.acquirer;
  const target = meta.target_display || deal.target;
  return [acquirer, target].filter(Boolean).join(' / ') || deal.id;
}

function buildDealsById(deals) {
  const map = new Map();
  for (const d of deals) map.set(d.id, { id: d.id, name: dealLabel(d) });
  return map;
}

// provision_cards.id (the id `?card=` deep-links expect) is NOT what claims
// carry directly -- claims reference provision_cards.excerpt_id, keyed here
// `${deal_id}|${excerpt_id}` -> card id.
function cardIdForClaim(claim, cardIdByKey) {
  if (!claim || !claim.excerpt_id) return null;
  return cardIdByKey.get(`${claim.deal_id}|${claim.excerpt_id}`) || null;
}

// r14 — deal-relative look-back distributions -----------------------------

function medianOfSorted(sortedNums) {
  if (!sortedNums.length) return null;
  const mid = Math.floor(sortedNums.length / 2);
  return sortedNums.length % 2 ? sortedNums[mid] : (sortedNums[mid - 1] + sortedNums[mid]) / 2;
}

// Candidate raw values a claim might store a look-back anchor under, in
// trust order — canonical (coded/ISO form) first, then the rich
// provenance.feature_value, then the raw verbatim text. Each candidate runs
// through the registry-gated converter (lib/query/relative-periods.js);
// first one that yields months wins. A claim none of whose candidates
// convert contributes to excludedCount, never a guessed value.
function relativeMonthsForClaim(attribute, claim, deal) {
  const fv = claim.provenance && typeof claim.provenance === 'object' ? claim.provenance.feature_value : null;
  const fvInner = fv && typeof fv === 'object' && !Array.isArray(fv) ? fv.value : fv;
  const candidates = [claim.canonical, fvInner, claim.verbatim];
  for (const candidate of candidates) {
    if (candidate === null || candidate === undefined || candidate === '') continue;
    if (typeof candidate === 'object') continue;
    const months = toRelativeMonthsForField(attribute, candidate, deal);
    if (months !== null) return months;
  }
  return null;
}

// r14 (Ben, "compare look-back LENGTHS, not dates"): for registry fields
// whose stored form is an absolute anchor date ("December 31, 2023"), the
// comparable quantity across deals is months-before-signing — so the
// sidebar distribution is numeric over the CONVERTED durations (unit
// labeled "months before signing"), this deal's own position computed the
// same way, and deals whose value can't convert (defined-term anchor like
// "the Balance Sheet Date", missing signing date) excluded-and-counted —
// like percentStats.excludedCount — rather than silently mixed in as raw
// dates. `dealMetaById` maps deal_id -> the deals-table row (announce_date
// is the signing date the converter uses).
function buildRelativePeriodDistribution(attribute, peerClaims, subjectDealId, dealsById, cardIdByKey, dealMetaById) {
  const byDeal = new Map();
  const claimByDeal = new Map();
  const sawUnconvertible = new Set();
  for (const cl of peerClaims || []) {
    if (byDeal.has(cl.deal_id)) continue; // one value per deal
    const deal = dealMetaById ? dealMetaById.get(cl.deal_id) : null;
    const months = relativeMonthsForClaim(attribute, cl, deal || {});
    if (months !== null) {
      byDeal.set(cl.deal_id, months);
      claimByDeal.set(cl.deal_id, cl);
    } else {
      sawUnconvertible.add(cl.deal_id);
    }
  }
  let excludedCount = 0;
  for (const dealId of sawUnconvertible) if (!byDeal.has(dealId)) excludedCount += 1;
  const nums = [...byDeal.values()].sort((a, b) => a - b);
  if (!nums.length) return null;
  const thisDealValue = subjectDealId && byDeal.has(subjectDealId) ? byDeal.get(subjectDealId) : null;
  const rank = thisDealValue !== null ? nums.filter((n) => n <= thisDealValue).length : null;
  const values = [...byDeal.entries()]
    .map(([dealId, value]) => {
      const d = dealsById.get(dealId);
      return { value, dealId, dealName: d ? d.name : dealId, cardId: cardIdForClaim(claimByDeal.get(dealId), cardIdByKey) };
    })
    .sort((a, b) => a.value - b.value)
    .slice(0, 40);
  return {
    attribute,
    label: attributeLabel(attribute),
    kind: 'numeric',
    unit: RELATIVE_MONTHS_UNIT,
    basis: 'months-before-signing',
    min: nums[0],
    median: medianOfSorted(nums),
    max: nums[nums.length - 1],
    count: nums.length,
    excludedCount,
    thisDealValue,
    thisDealRank: rank,
    values,
  };
}

// Phase 1: everything that does NOT depend on which code(s) are being asked
// about -- the deals fetch, staging filter, firm resolution, peer-set
// membership, and the filter option lists (always corpus-wide, never
// filtered). cardIdByKey is built from WHATEVER cards were fetched (single-
// code .eq() from corpus-stats.js, multi-code .in() from the batch
// endpoint) -- safe either way since it's keyed by deal_id+excerpt_id, which
// is unique per card regardless of how many codes' cards got fetched
// together.
function buildCorpusBase({ deals, cards, subjectDealId, filters }) {
  const stagingFree = (deals || []).filter((d) => !(d.metadata && d.metadata.ingest_status === 'staging'));
  const firmsByDeal = new Map(stagingFree.map((d) => [d.id, dealFirms(d)]));
  const subject = subjectDealId ? stagingFree.find((d) => d.id === subjectDealId) : null;
  const dealsById = buildDealsById(stagingFree);
  const cardIdByKey = new Map();
  for (const c of cards || []) {
    if (c.excerpt_id) cardIdByKey.set(`${c.deal_id}|${c.excerpt_id}`, c.id);
  }

  const peerSet = stagingFree.filter((d) => dealPassesFilters(d, filters, firmsByDeal));
  const peerIds = new Set(peerSet.map((d) => d.id));

  const options = {
    sectors: [...new Set(stagingFree.map((d) => d.sector).filter(Boolean))].sort(),
    buyers: [...new Set(stagingFree.map((d) => d.acquirer).filter(Boolean))].sort(),
    lawFirms: [...new Set([...firmsByDeal.values()].flat())].sort(),
    forms: [...new Set(stagingFree.map((d) => d.metadata && d.metadata.merger_form).filter(Boolean))].sort()
      .map((f) => ({ value: f, label: humanizeKey(f) })),
    lawFirmCoverage: [...firmsByDeal.values()].filter((f) => f.length).length,
  };

  return { stagingFree, firmsByDeal, dealsById, cardIdByKey, subject, peerSet, peerIds, options };
}

// Phase 2: the code-scoped computation -- dealsWithCode / featureSummary /
// peers -- run against cards/claims ALREADY FILTERED to this one code
// (corpus-stats.js passes its .eq()-scoped fetch results straight through;
// the batch endpoint partitions its .in()-scoped fetch in memory first).
function buildCodeStats({ code, cardsForCode, claimsForCode, subjectDealId, subject, peerSet, peerIds, firmsByDeal }) {
  const dealsWithCode = new Set((cardsForCode || []).map((c) => c.deal_id).filter((id) => peerIds.has(id)));

  const byAttribute = new Map();
  for (const cl of claimsForCode || []) {
    if (!peerIds.has(cl.deal_id)) continue;
    if (cl.canonical === null || cl.canonical === undefined) continue;
    if (!byAttribute.has(cl.attribute)) byAttribute.set(cl.attribute, new Map());
    const values = byAttribute.get(cl.attribute);
    values.set(cl.canonical, (values.get(cl.canonical) || 0) + 1);
  }
  const featureSummary = [...byAttribute.entries()]
    .map(([attribute, values]) => ({
      attribute,
      label: attributeLabel(attribute),
      values: [...values.entries()]
        .sort((a, b) => b[1] - a[1])
        .slice(0, 6)
        .map(([value, count]) => ({ value, label: valueLabel(attribute, value), count })),
      total: [...values.values()].reduce((a, b) => a + b, 0),
    }))
    .sort((a, b) => b.total - a.total)
    .slice(0, 8);

  const peers = peerSet
    .filter((d) => dealsWithCode.has(d.id) && d.id !== subjectDealId)
    .sort((a, b) => (similarity(b, subject) - similarity(a, subject))
      || String(b.announce_date || '').localeCompare(String(a.announce_date || '')))
    .slice(0, 8)
    .map((d) => ({
      deal_id: d.id,
      acquirer: d.acquirer,
      target: d.target,
      sector: d.sector,
      value_usd: d.value_usd,
      announce_date: d.announce_date,
      law_firms: firmsByDeal.get(d.id) || [],
    }));

  return {
    code,
    peerSetSize: peerSet.length,
    dealsWithCode: dealsWithCode.size,
    featureSummary,
    peers,
  };
}

// Batch endpoint support (pages/api/corpus-stats-batch.js) --------------

// Matches corpus-stats.js's proven-safe single-code claims `.limit(4000)`.
const DEFAULT_PER_CODE_CLAIMS_LIMIT = 4000;
// provision_cards per code is normally tens, not thousands -- generous
// headroom vs. real counts while still bounding worst case.
const DEFAULT_PER_CODE_CARDS_LIMIT = 1000;
// Conservative ceiling on any SINGLE query's row cap, comfortably under
// typical PostgREST/Supabase `db.max_rows` configurations -- chunking keeps
// every individual `.in()` query under this regardless of how many codes
// the caller asked for in total.
const SAFE_QUERY_LIMIT_CEILING = 20000;

// Groups `codes` into chunks sized so each chunk's `.in()` query -- capped
// at `perCodeLimit * chunk.length` -- never asks Postgres for more than
// `ceiling` rows in one call. The batch endpoint runs one query PER CHUNK
// (a handful of small queries for a page's worth of codes), not one huge
// unbounded query (risking a silent PostgREST page-size truncation) and not
// one query per code (the N-round-trips problem batching exists to avoid).
function chunkCodesForQuery(codes, perCodeLimit, ceiling = SAFE_QUERY_LIMIT_CEILING) {
  const maxCodesPerChunk = Math.max(1, Math.floor(ceiling / perCodeLimit));
  const chunks = [];
  for (let i = 0; i < codes.length; i += maxCodesPerChunk) {
    const chunkCodes = codes.slice(i, i + maxCodesPerChunk);
    chunks.push({ codes: chunkCodes, limit: perCodeLimit * chunkCodes.length });
  }
  return chunks;
}

// Partitions `rows` by `codeOf(row)` into `Map(code -> row[])`, seeded with
// an empty array for every requested code so a code with zero matches still
// gets an (empty) bucket rather than being silently absent from the map --
// buildCodeStats needs a real (possibly empty) array per code, not a hole.
function partitionByCode(rows, codes, codeOf) {
  const byCode = new Map(codes.map((c) => [c, []]));
  for (const row of rows || []) {
    const code = codeOf(row);
    if (code && byCode.has(code)) byCode.get(code).push(row);
  }
  return byCode;
}

module.exports = {
  CACHE,
  VERSIONED_CACHE,
  num,
  humanizeKey,
  attributeLabel,
  valueLabel,
  firmShort,
  dealFirms,
  dealPassesFilters,
  similarity,
  dealLabel,
  buildDealsById,
  cardIdForClaim,
  buildCorpusBase,
  buildCodeStats,
  relativeMonthsForClaim,
  buildRelativePeriodDistribution,
  DEFAULT_PER_CODE_CLAIMS_LIMIT,
  DEFAULT_PER_CODE_CARDS_LIMIT,
  SAFE_QUERY_LIMIT_CEILING,
  chunkCodesForQuery,
  partitionByCode,
};
