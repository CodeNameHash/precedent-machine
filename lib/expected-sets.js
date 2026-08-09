/* ─────────────────────────────────────────────────────────────────────────
   lib/expected-sets.js — systematic "expected canonical set" per section type.
   ───────────────────────────────────────────────────────────────────────────
   Today the "here is the standard set; which are present / missing?" checklist
   exists only for reps (the old EXPECTED_REPS map hardcoded in the review
   page). Every other section (IOC, COND, TERMR, NOSOL, …) has canonical codes
   but no expected-set view, so we can say "the Solvency rep is missing" but not
   "the No-New-Lines-of-Business covenant is missing." This module makes the
   expected-set a first-class, UNIFORM concept for every provision type.

   How the expected set is decided (the whole point — it develops as the corpus
   grows, and stays human-gated):

     importance(code) is derived FROM THE CORPUS — the fraction of deals whose
     provisions carry that canonical code:
        ≥ CORE_THRESHOLD of deals   → 'core'   (absence is notable)
        ≥ COMMON_THRESHOLD          → 'common'
        otherwise (but seen)        → 'rare'
     A hand-authored CURATION layer overrides this for codes we KNOW are core
     even before the corpus is large (so a 3-deal corpus still gives sensible
     expectations). As deals accumulate, the corpus signal dominates and the
     curation layer shrinks. Every override is a human decision.

   And the growth hook (the link to corpus-driven taxonomy refinement): any
   provision whose category/code is NOT a canonical rubric code is an "extra" —
   these are the candidates a human reviews to promote into the taxonomy.

   Open-world promotion (PLAN.md Step 2X-G / DECISIONS.md §14): the V1
   expected-set fractions above answer "is absence notable". They are NOT the
   promotion gate. Open-world → governed promotion uses absolute deal
   recurrence (three or four deals), confidence, and collision checks in
   lib/canonical-v2/open-world-promotion-gate.js — re-exported below so the
   growth hook and the promotion gate stay discoverable from one module.

   CommonJS: consumed by the report script, API, review page, and tests.
   ───────────────────────────────────────────────────────────────────────── */

const { PROVISION_TYPES, CODES, getCodesForType } = require('./rubric');
const {
  MIN_PROMOTION_DEAL_COUNT,
  PREFERRED_PROMOTION_DEAL_COUNT,
  HOLD_SCAFFOLD_MODULES,
  CONFIDENCE: OPEN_WORLD_PROMOTION_CONFIDENCE,
  loadStep2xJConsumeVocabularies,
  assessPromotionConfidence,
  checkPromotionCollision,
  evaluatePromotionGate,
} = require('./canonical-v2/open-world-promotion-gate');

// Corpus-frequency thresholds for importance (fraction of deals).
// NOTE: these fractions are for expected-set importance only. Do not reuse
// them as an open-world promotion threshold (DECISIONS.md §14).
const CORE_THRESHOLD = 0.66;
const COMMON_THRESHOLD = 0.33;

// Collapse party-suffixed types to their taxonomy family (rubric keys codes to
// the family, e.g. IOC not IOC-T; COND-B keeps its own codes though).
function familyType(type) {
  const t = String(type || '');
  if (t === 'IOC-T' || t === 'IOC-B') return 'IOC';
  if (t === 'TERMR-M' || t === 'TERMR-B' || t === 'TERMR-T') return 'TERMR';
  if (t === 'NOSOL-T' || t === 'NOSOL-B' || t === 'NOSOL-M') return 'NOSOL';
  return t;
}

function provisionCode(p) {
  const feats = (p.ai_metadata && p.ai_metadata.features) || {};
  return feats.canonicalCode || (p.ai_metadata && p.ai_metadata.code) || null;
}

function isCanonicalCode(code) {
  return !!code && !String(code).startsWith('[PROPOSED') && Object.prototype.hasOwnProperty.call(CODES, code);
}

/* ── Curation overrides ─────────────────────────────────────────────────────
   Codes we assert are 'core' regardless of (small) corpus signal. Hand-authored
   legal judgment; shrinks as the corpus grows. Keyed by canonical code. */
const CURATED_CORE = new Set([
  // Reps every merger agreement carries.
  'REP-T-ORG', 'REP-T-CAP', 'REP-T-AUTH', 'REP-T-NOCONFLICT', 'REP-T-NOCHANGE',
  'REP-T-LIT', 'REP-T-COMPLY', 'REP-T-BENEFITS', 'REP-T-TAX', 'REP-T-BROKERS',
  'REP-B-ORG', 'REP-B-AUTH', 'REP-B-NOCONFLICT',
  // Interim operating covenants nearly always present.
  'IOC-ORDINARY', 'IOC-MERGE', 'IOC-CHARTER',
  // Conditions.
  'COND-M-LEGAL', 'COND-M-STOCKHOLDER', 'COND-B-REP', 'COND-B-COV', 'COND-B-MAE', 'COND-B-CERT',
  // Termination rights.
  'TERMR-MUTUAL', 'TERMR-OUTSIDE', 'TERMR-LEGAL', 'TERMR-BREACH-T', 'TERMR-BREACH-B',
  // No-shop core mechanics.
  'NOSOL-PROHIBIT', 'NOSOL-CEASE', 'NOSOL-EXCEPT', 'NOSOL-SUPERIOR', 'NOSOL-ACQPROPOSAL',
  'NOSOL-NOTICE', 'NOSOL-MATCH', 'NOSOL-RECOMMEND',
  // Termination-fee spine.
  'TERMF-TARGET', 'TERMF-EFFECT', 'TERMF-SOLE',
]);

/**
 * Group provisions by deal_id → the set of canonical codes present in that deal.
 * Used to compute per-code appearance frequency across the corpus.
 */
function codesByDeal(provisions) {
  const map = new Map();
  for (const p of provisions || []) {
    const code = provisionCode(p);
    if (!isCanonicalCode(code)) continue;
    const deal = p.deal_id || '_';
    if (!map.has(deal)) map.set(deal, new Set());
    map.get(deal).add(code);
  }
  return map;
}

/**
 * Build the expected-set registry for every provision type from the corpus.
 * @param {Array} provisions — corpus provisions (need deal_id, type, ai_metadata)
 * @returns {Object} type → { code, label, importance, dealFraction, curated }[]
 */
function computeExpectedSets(provisions) {
  const perDeal = codesByDeal(provisions);
  const dealCount = perDeal.size || 1;

  // Appearance count per code across deals.
  const dealsWithCode = {};
  for (const codes of perDeal.values()) {
    for (const code of codes) dealsWithCode[code] = (dealsWithCode[code] || 0) + 1;
  }

  const importanceFor = (code) => {
    if (CURATED_CORE.has(code)) return 'core';
    const frac = (dealsWithCode[code] || 0) / dealCount;
    if (frac >= CORE_THRESHOLD) return 'core';
    if (frac >= COMMON_THRESHOLD) return 'common';
    return 'rare';
  };

  const registry = {};
  const types = (PROVISION_TYPES || []).map((t) => (typeof t === 'string' ? t : t.key || t.code || t.type)).filter(Boolean);
  for (const type of types) {
    let codes = [];
    try { codes = getCodesForType(type) || []; } catch { codes = []; }
    if (!codes.length) continue;
    registry[type] = codes.map((c) => ({
      code: c.code,
      label: c.label || c.code,
      importance: importanceFor(c.code),
      dealFraction: Math.round(((dealsWithCode[c.code] || 0) / dealCount) * 100) / 100,
      curated: CURATED_CORE.has(c.code),
    })).sort((a, b) => {
      const rank = { core: 0, common: 1, rare: 2 };
      return rank[a.importance] - rank[b.importance] || b.dealFraction - a.dealFraction;
    });
  }
  return registry;
}

/**
 * For a SINGLE deal, report expected-set coverage per type:
 *   present  — expected codes that appear in the deal
 *   missing  — 'core'/'common' expected codes NOT in the deal (the checklist gap)
 *   extra    — provisions whose code is NOT a canonical rubric code
 *              (proposed / freeform) → taxonomy-growth review queue
 * @param {Array} dealProvisions — one deal's provisions
 * @param {Object} registry — from computeExpectedSets (corpus-wide)
 */
function analyzeDealCoverage(dealProvisions, registry) {
  const presentCodes = new Set();
  const extra = [];
  for (const p of dealProvisions || []) {
    const code = provisionCode(p);
    if (isCanonicalCode(code)) presentCodes.add(code);
    else {
      extra.push({
        type: familyType(p.type),
        category: p.category || null,
        proposed: String(p.category || '').startsWith('[PROPOSED') || String(code || '').startsWith('[PROPOSED'),
      });
    }
  }

  const byType = {};
  for (const [type, expectedList] of Object.entries(registry)) {
    const present = [];
    const missing = [];
    for (const item of expectedList) {
      if (presentCodes.has(item.code)) present.push(item);
      else if (item.importance === 'core' || item.importance === 'common') missing.push(item);
    }
    if (present.length || missing.length) byType[type] = { present, missing };
  }
  return { byType, extra };
}

/**
 * Corpus-level taxonomy report: for each type, expected-set + how uniformly it
 * is applied, and the aggregated "extra" categories (candidates to promote into
 * the canonical taxonomy — the human-gated growth queue).
 */
function analyzeCorpusTaxonomy(provisions, registry) {
  const reg = registry || computeExpectedSets(provisions);
  // Aggregate extra (non-canonical) categories by (type, category) frequency.
  const extraFreq = {};
  for (const p of provisions || []) {
    const code = provisionCode(p);
    if (isCanonicalCode(code)) continue;
    const key = `${familyType(p.type)}::${p.category || '?'}`;
    extraFreq[key] = (extraFreq[key] || 0) + 1;
  }
  const promotionCandidates = Object.entries(extraFreq)
    .map(([k, count]) => { const [type, category] = k.split('::'); return { type, category, count }; })
    .sort((a, b) => b.count - a.count);

  const perType = {};
  for (const [type, list] of Object.entries(reg)) {
    perType[type] = {
      core: list.filter((x) => x.importance === 'core').length,
      common: list.filter((x) => x.importance === 'common').length,
      rare: list.filter((x) => x.importance === 'rare').length,
      total: list.length,
    };
  }
  return { perType, promotionCandidates };
}

module.exports = {
  computeExpectedSets,
  analyzeDealCoverage,
  analyzeCorpusTaxonomy,
  familyType,
  provisionCode,
  isCanonicalCode,
  CURATED_CORE,
  CORE_THRESHOLD,
  COMMON_THRESHOLD,
  // Step 2X-G open-world promotion gate (deal counts, not fractions).
  MIN_PROMOTION_DEAL_COUNT,
  PREFERRED_PROMOTION_DEAL_COUNT,
  HOLD_SCAFFOLD_MODULES,
  OPEN_WORLD_PROMOTION_CONFIDENCE,
  loadStep2xJConsumeVocabularies,
  assessPromotionConfidence,
  checkPromotionCollision,
  evaluatePromotionGate,
};
