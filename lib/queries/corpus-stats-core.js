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
const { toRelativeMonthsForField, RELATIVE_MONTHS_UNIT, isRelativePeriodField } = require('../query/relative-periods');
// r19 (WP-A, numeric market cells): the SAME percentile-stats primitive the
// query engine's market-range executor uses (lib/query/executors/
// market-range.js) — reused here, not re-derived, so featureSummary's
// numeric entries and the query engine's baselines never compute
// min/p25/median/p75/max two different ways.
const { numericStats, quantile } = require('../query/market-baseline');
// r19: the SAME "% of deal value" computation market-range.js's percentStats
// uses — reused verbatim for featureSummary's numeric entries.
const { percentOfDealValue } = require('../percent-of-deal');

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

// r18 — rowContext scoping + deal counting ---------------------------------
//
// Counting bug (Ben, Metsera "327 … of 666 peer deals" on a 40-deal corpus):
// the r11 rowContext featureKeys fetch pulls the attribute UNSCOPED across
// every provision of every deal (materialityQualifier exists on ~27 reps per
// deal), and buildFeatureDistribution counted CLAIMS. Fixed semantics:
//   1. The comparable universe for a rep-level qualifier is THE SAME REP
//      across deals — scope claims to the clicked card's provenance code
//      (e.g. REP-T-SANCTIONS) first.
//   2. Where subtype scoping leaves too thin a pool (< MIN_SCOPED_DEALS
//      deals), fall back to the code FAMILY (all REP-T-*), and say so in the
//      response (`scopeNote`, rendered in the sidebar's count line).
//   3. Distributions count DEALS, never claims — one deal contributes ONE
//      value (its best-evidenced one), so every count and total is <= the
//      peer-set size (<= 40).

const MIN_SCOPED_DEALS = 3;

function claimProvenanceCode(claim) {
  const raw = claim && claim.provenance && typeof claim.provenance === 'object' ? claim.provenance.code : null;
  return raw ? String(raw).toUpperCase() : null;
}

// "REP-T-SANCTIONS" -> "REP-T-" (party-aware rep families), otherwise the
// first hyphen segment ("NOSOL-NOSHOP" -> "NOSOL-"). Null when the code has
// no family structure at all.
function contextFamilyPrefix(code) {
  const c = String(code || '').toUpperCase();
  const rep = /^(REP-[TB])-/.exec(c);
  if (rep) return `${rep[1]}-`;
  const seg = /^([A-Z0-9]+)-/.exec(c);
  return seg ? `${seg[1]}-` : null;
}

function scopeNoteForFamily(family) {
  if (family === 'REP-T-') return 'across all target reps';
  if (family === 'REP-B-') return 'across all parent reps';
  return `across all ${String(family).replace(/-$/, '')} provisions`;
}

// Narrows an attribute's corpus-wide claim pool to the comparable universe
// for the clicked row. Returns { claims, scope, scopeNote }:
//   scope 'subtype' — same provenance code as the clicked card (no note:
//                     that IS the expected universe, "this rep across deals")
//   scope 'family'  — same code family (REP-T-*, NOSOL-*, ...) when the
//                     subtype pool covers fewer than minDeals deals
//   scope 'corpus'  — unscoped fallback (attributes that genuinely live
//                     corpus-wide, or a family pool that is still too thin);
//                     always labelled so the number is honest.
function scopeClaimsForContext({ claims, code, minDeals = MIN_SCOPED_DEALS }) {
  const all = claims || [];
  const upper = String(code || '').trim().toUpperCase();
  const dealCount = (list) => new Set(list.map((cl) => cl.deal_id)).size;
  if (upper) {
    const subtype = all.filter((cl) => claimProvenanceCode(cl) === upper);
    if (dealCount(subtype) >= minDeals) return { claims: subtype, scope: 'subtype', scopeNote: null };
    const family = contextFamilyPrefix(upper);
    if (family) {
      const fam = all.filter((cl) => {
        const c = claimProvenanceCode(cl);
        return c && c.startsWith(family);
      });
      if (dealCount(fam) >= minDeals) return { claims: fam, scope: 'family', scopeNote: scopeNoteForFamily(family) };
    }
  }
  return { claims: all, scope: 'corpus', scopeNote: 'across all deals' };
}

// Categorical distribution counted in DEALS. Per deal, exactly one value is
// chosen — its best-evidenced one: the value backed by the most in-scope
// claims, tie-broken by having a verbatim evidence_quote, then by the most
// recent claim. `presentDealEntries` (optional Map deal_id -> {id,name,
// cardId}) lists peer deals KNOWN to carry the same provision (subtype-
// scoped provision_cards) — deals present there with no captured value are
// surfaced as an explicit neutral missing bucket rather than silently
// shrinking the denominator. valueLabelFn defaults to the taxonomy resolver.
const NONE_VALUE = '__NONE_CAPTURED__';

function buildCategoricalDealDistribution(attribute, peerClaims, subjectDealId, dealsById, cardIdByKey, { presentDealEntries = null } = {}) {
  const perDeal = new Map(); // deal_id -> Map(value -> {claims, hasQuote, latest})
  for (const cl of peerClaims || []) {
    if (cl.canonical === null || cl.canonical === undefined) continue;
    if (!perDeal.has(cl.deal_id)) perDeal.set(cl.deal_id, new Map());
    const vmap = perDeal.get(cl.deal_id);
    if (!vmap.has(cl.canonical)) vmap.set(cl.canonical, { count: 0, hasQuote: false, latest: '', claim: cl });
    const rec = vmap.get(cl.canonical);
    rec.count += 1;
    if (cl.evidence_quote) rec.hasQuote = true;
    const created = String(cl.created_at || '');
    if (created >= rec.latest) { rec.latest = created; rec.claim = cl; }
  }
  const chosenByDeal = new Map(); // deal_id -> { value, claim }
  for (const [dealId, vmap] of perDeal) {
    let best = null;
    for (const [value, rec] of vmap) {
      if (!best
        || rec.count > best.rec.count
        || (rec.count === best.rec.count && rec.hasQuote && !best.rec.hasQuote)
        || (rec.count === best.rec.count && rec.hasQuote === best.rec.hasQuote && rec.latest > best.rec.latest)) {
        best = { value, rec };
      }
    }
    if (best) chosenByDeal.set(dealId, { value: best.value, claim: best.rec.claim });
  }
  const counts = new Map(); // value -> Map(dealId -> entry)
  for (const [dealId, { value, claim }] of chosenByDeal) {
    if (!counts.has(value)) counts.set(value, new Map());
    const d = dealsById.get(dealId);
    counts.get(value).set(dealId, { id: dealId, name: d ? d.name : dealId, cardId: cardIdForClaim(claim, cardIdByKey) });
  }
  // Explicit none-bucket: deals that carry the SAME provision but no
  // captured value for this attribute. Labelled "captured" — absence of a
  // claim may be an extraction gap, not proof the qualifier is absent.
  if (presentDealEntries && presentDealEntries.size) {
    const noneDeals = new Map();
    for (const [dealId, entry] of presentDealEntries) {
      if (!chosenByDeal.has(dealId)) noneDeals.set(dealId, entry);
    }
    if (noneDeals.size) counts.set(NONE_VALUE, noneDeals);
  }
  if (!counts.size) return null;
  const thisDealChosen = subjectDealId ? chosenByDeal.get(subjectDealId) : null;
  const thisDealValue = thisDealChosen
    ? thisDealChosen.value
    : (subjectDealId && counts.has(NONE_VALUE) && counts.get(NONE_VALUE).has(subjectDealId) ? NONE_VALUE : null);
  const noneLabel = 'Not extracted';
  const values = [...counts.entries()]
    .sort((a, b) => b[1].size - a[1].size)
    .map(([value, dealsMap]) => ({
      value,
      label: value === NONE_VALUE ? noneLabel : valueLabel(attribute, value),
      count: dealsMap.size,
      isThisDeal: value === thisDealValue,
      deals: [...dealsMap.values()],
    }));
  const total = values.reduce((a, v) => a + v.count, 0);
  return {
    attribute,
    label: attributeLabel(attribute),
    kind: 'categorical',
    counting: 'deals',
    values,
    total,
    thisDealValue: thisDealValue !== null
      ? (thisDealValue === NONE_VALUE ? noneLabel : valueLabel(attribute, thisDealValue))
      : null,
  };
}

// r19 (WP-A, numeric market cells) — extractNumeric/isNumericAttribute
// moved here VERBATIM from pages/api/corpus-stats.js (which now imports
// them from here instead of keeping its own copy) so the single-code and
// batch endpoints' numeric percentile stats are computed from the exact
// same extraction, never a second copy drifting. See that file's history
// for why each fallback exists (canonical -> feature_value.amount/value ->
// $/,-stripped verbatim scan, guarded against scanning a JSON-shaped
// verbatim's raw text and picking up the wrong field).
function looksLikeJsonVerbatim(verbatim) {
  const trimmed = verbatim.trim();
  return trimmed.startsWith('{') && trimmed.endsWith('}');
}

function extractNumeric(claim) {
  if (claim.canonical !== null && claim.canonical !== undefined) {
    const n = Number(claim.canonical);
    if (Number.isFinite(n)) return n;
  }
  const fv = claim.provenance && typeof claim.provenance === 'object' ? claim.provenance.feature_value : null;
  const payload = fv && typeof fv === 'object' && fv.value && typeof fv.value === 'object' ? fv.value : fv;
  if (payload && typeof payload === 'object') {
    for (const key of ['amount', 'value']) {
      const raw = payload[key];
      if (typeof raw === 'number' && Number.isFinite(raw)) return raw;
      if (typeof raw === 'string') {
        const m = raw.replace(/[$,]/g, '').match(/-?\d+(\.\d+)?/);
        if (m) return Number(m[0]);
      }
    }
  }
  if (typeof claim.verbatim === 'string' && !looksLikeJsonVerbatim(claim.verbatim)) {
    const m = claim.verbatim.replace(/[$,]/g, '').match(/-?\d+(\.\d+)?/);
    if (m) return Number(m[0]);
  }
  return null;
}

// entry.valueType 'number' -> plain numeric attributes (noticePeriod,
// feeAmount, ...). entry.valueType 'object' -> rich amount-object
// attributes (companyTerminationFee, reverseTerminationFee,
// expenseReimbursement) whose canonical is always null but whose
// feature_value carries a numeric amount -- flagged numeric only when at
// least one sample claim actually resolves one (extractNumeric !== null)
// with no canonical, matching corpus-stats.js's rowContext rule exactly.
function isNumericAttribute(attribute, sampleClaims) {
  const entry = FEATURES[attribute];
  if (entry && entry.valueType === 'number') return true;
  if (entry && entry.valueType === 'object') {
    return (sampleClaims || []).some((cl) => extractNumeric(cl) !== null && !cl.canonical);
  }
  return false;
}

// The registry's `unit` field covers plain numeric attributes (usd/days/
// business_days/months/percent). Rich amount-object attributes
// (valueType 'object') carry no top-level unit in the registry -- their
// numeric value IS always a dollar amount by convention (that's the only
// shape extractNumeric resolves for them, see isNumericAttribute above) --
// so default those to 'usd' rather than leaving the cell unit-less. Never
// guesses beyond that: anything else with no registry unit stays null.
function numericAttributeUnit(attribute) {
  const entry = FEATURES[attribute];
  if (entry && entry.unit) return entry.unit;
  if (entry && entry.valueType === 'object') return 'usd';
  return null;
}

// One numeric attribute's corpus-wide percentile summary for featureSummary
// (r19, WP-A): one value per deal (extractNumeric, same rule rowContext's
// numeric distribution uses), min/p25/median/p75/max via the shared
// numericStats primitive, excludedCount for deals that carried a claim for
// this attribute but whose value never parsed to a number. For dollar-
// denominated attributes (unit 'usd'), ALSO computes a parallel percent-of-
// deal-value distribution (percentOfDeal) using peerSet's own value_usd --
// same computation lib/query/executors/market-range.js's percentStats uses,
// reused verbatim. Deals with no positive/finite value_usd are excluded from
// percentOfDeal (percentOfDeal.excludedCount), never guessed at. Returns
// null when no deal in the peer set has a resolvable numeric value.
function buildNumericAttributeSummary(attribute, claimsForAttribute, peerIds, peerSet) {
  const byDeal = new Map();
  const attemptedDeals = new Set();
  for (const cl of claimsForAttribute || []) {
    if (!peerIds.has(cl.deal_id)) continue;
    attemptedDeals.add(cl.deal_id);
    if (byDeal.has(cl.deal_id)) continue; // one value per deal
    const n = extractNumeric(cl);
    if (n !== null) byDeal.set(cl.deal_id, n);
  }
  const nums = [...byDeal.values()];
  if (!nums.length) return null;
  const excludedCount = attemptedDeals.size - byDeal.size;
  const stats = numericStats(nums);
  const unit = numericAttributeUnit(attribute);
  let percentOfDeal = null;
  if (unit === 'usd') {
    const dealValueById = new Map((peerSet || []).map((d) => [d.id, num(d.value_usd)]));
    let percentExcludedCount = 0;
    const percentValues = [];
    for (const [dealId, value] of byDeal) {
      const pct = percentOfDealValue(value, dealValueById.get(dealId));
      if (pct === null) percentExcludedCount += 1;
      else percentValues.push(pct);
    }
    if (percentValues.length) {
      const pStats = numericStats(percentValues);
      percentOfDeal = {
        min: pStats.min, p25: pStats.p25, median: pStats.median, mean: pStats.mean, p75: pStats.p75, max: pStats.max,
        excludedCount: percentExcludedCount,
      };
    }
  }
  return {
    attribute,
    label: attributeLabel(attribute),
    kind: 'numeric',
    unit,
    count: stats.n,
    excludedCount,
    min: stats.min,
    p25: stats.p25,
    median: stats.median,
    mean: stats.mean,
    p75: stats.p75,
    max: stats.max,
    percentOfDeal,
  };
}

// r14/r19 — deal-relative look-back distributions --------------------------

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
    // r19 (WP-A, numeric market cells): additive percentiles alongside the
    // existing min/median/max -- rowContext's sidebar distribution now
    // carries the same p25/p75 the featureSummary numeric entries below do,
    // via the shared quantile() primitive (never re-derived).
    p25: quantile(nums, 0.25),
    median: medianOfSorted(nums),
    mean: nums.reduce((sum, value) => sum + value, 0) / nums.length,
    p75: quantile(nums, 0.75),
    max: nums[nums.length - 1],
    count: nums.length,
    excludedCount,
    thisDealValue,
    thisDealRank: rank,
    values,
  };
}

// r19 (WP-A, numeric market cells): the featureSummary-scoped counterpart to
// buildRelativePeriodDistribution above -- same relativeMonthsForClaim
// conversion, but a lean aggregate (no per-deal `values` list, no
// thisDeal*) sized for the corpus-stats-batch payload, which never needs
// deal-level drill-down for featureSummary (that's rowContext's job). Only
// needs peerSet (for each deal's announce_date/signing date) and peerIds,
// not the full dealsById/cardIdByKey rowContext threads.
function buildRelativePeriodAttributeSummary(attribute, claimsForAttribute, peerIds, peerSet) {
  const dealMetaById = new Map((peerSet || []).map((d) => [d.id, d]));
  const byDeal = new Map();
  const attemptedDeals = new Set();
  for (const cl of claimsForAttribute || []) {
    if (!peerIds.has(cl.deal_id)) continue;
    attemptedDeals.add(cl.deal_id);
    if (byDeal.has(cl.deal_id)) continue; // one value per deal
    const months = relativeMonthsForClaim(attribute, cl, dealMetaById.get(cl.deal_id) || {});
    if (months !== null) byDeal.set(cl.deal_id, months);
  }
  const nums = [...byDeal.values()];
  if (!nums.length) return null;
  const excludedCount = attemptedDeals.size - byDeal.size;
  const stats = numericStats(nums);
  return {
    attribute,
    label: attributeLabel(attribute),
    kind: 'numeric',
    unit: RELATIVE_MONTHS_UNIT,
    basis: 'months-before-signing',
    count: stats.n,
    excludedCount,
    min: stats.min,
    p25: stats.p25,
    median: stats.median,
    mean: stats.mean,
    p75: stats.p75,
    max: stats.max,
    percentOfDeal: null,
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

  // r19 (WP-A, numeric market cells): group ALL peer-scoped claims by
  // attribute first (not just canonical-non-null ones -- rich amount-object
  // attributes like companyTerminationFee carry canonical: null with their
  // numeric value living in feature_value instead, so the old canonical-only
  // filter silently dropped them from featureSummary entirely, which is
  // exactly why the unified market column had "No market data" for every
  // numeric row). Each attribute then routes to the numeric/relative-period
  // percentile summary or the categorical value tally, never both -- a
  // coded tally of raw dollar figures (every value its own bucket) is
  // meaningless.
  const byAttribute = new Map();
  for (const cl of claimsForCode || []) {
    if (!peerIds.has(cl.deal_id)) continue;
    if (!byAttribute.has(cl.attribute)) byAttribute.set(cl.attribute, []);
    byAttribute.get(cl.attribute).push(cl);
  }
  const featureEntries = [];
  for (const [attribute, claimsForAttribute] of byAttribute) {
    if (isRelativePeriodField(attribute)) {
      const summary = buildRelativePeriodAttributeSummary(attribute, claimsForAttribute, peerIds, peerSet);
      if (summary) { featureEntries.push(summary); continue; }
    }
    if (isNumericAttribute(attribute, claimsForAttribute)) {
      const summary = buildNumericAttributeSummary(attribute, claimsForAttribute, peerIds, peerSet);
      if (summary) { featureEntries.push(summary); continue; }
    }
    const values = new Map();
    for (const cl of claimsForAttribute) {
      if (cl.canonical === null || cl.canonical === undefined) continue;
      values.set(cl.canonical, (values.get(cl.canonical) || 0) + 1);
    }
    if (!values.size) continue;
    featureEntries.push({
      attribute,
      label: attributeLabel(attribute),
      kind: 'categorical',
      values: [...values.entries()]
        .sort((a, b) => b[1] - a[1])
        .slice(0, 6)
        .map(([value, count]) => ({ value, label: valueLabel(attribute, value), count })),
      total: [...values.values()].reduce((a, b) => a + b, 0),
    });
  }
  const featureSummary = featureEntries
    .sort((a, b) => (b.total ?? b.count ?? 0) - (a.total ?? a.count ?? 0))
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
  // r18: rowContext scoping + deal counting
  MIN_SCOPED_DEALS,
  NONE_VALUE,
  claimProvenanceCode,
  contextFamilyPrefix,
  scopeClaimsForContext,
  buildCategoricalDealDistribution,
  relativeMonthsForClaim,
  buildRelativePeriodDistribution,
  // r19 (WP-A, numeric market cells)
  extractNumeric,
  isNumericAttribute,
  numericAttributeUnit,
  buildNumericAttributeSummary,
  buildRelativePeriodAttributeSummary,
  DEFAULT_PER_CODE_CLAIMS_LIMIT,
  DEFAULT_PER_CODE_CARDS_LIMIT,
  SAFE_QUERY_LIMIT_CEILING,
  chunkCodesForQuery,
  partitionByCode,
};
