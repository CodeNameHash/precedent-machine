/* ─────────────────────────────────────────────────────────────────────────
   lib/rep-materiality.js — THIN demo wrapper over lib/feature-compare.js.
   ───────────────────────────────────────────────────────────────────────────
   Rep materiality is just ONE instance of the general qualitative-comparison
   engine: the `materialityQualifier` feature (a tagged {code,label,text} value
   resolved against MATERIALITY_CODES) on the REP-T / REP-B provision types.

   This module adds nothing structural — it only pins the (type, featureKey,
   absentCode) triple so callers can ask the materiality question directly, and
   demonstrates how any other qualitative term is one call away. Everything
   dynamic (cohort filters, the n-floor guardrail, quote clickthrough) lives in
   feature-compare.js.

   CommonJS. See lib/feature-compare.js for the engine.
   ───────────────────────────────────────────────────────────────────────── */

const {
  compareFeature,
  cohortFeatureStats,
  featureOutliers,
  codeForFeature,
} = require('./feature-compare');

const FEATURE_KEY = 'materialityQualifier';
// An unqualified rep is a meaningful, comparable datapoint — absence resolves
// to MAT_NO_QUALIFIER rather than being dropped.
const NO_QUALIFIER = 'MAT_NO_QUALIFIER';

// Resolve the (party) provision family for a REP side. materialityQualifier is
// declared on both REP-T and REP-B.
function repType(side) {
  return String(side || '').toUpperCase() === 'REP-B' ? 'REP-B' : 'REP-T';
}

/**
 * repMaterialityCode(provision) → the canonical MATERIALITY_CODES code for a
 * rep's materialityQualifier (dominant code of a mixed list). Missing/unknown
 * → MAT_NO_QUALIFIER.
 */
function repMaterialityCode(provision) {
  return codeForFeature(provision, FEATURE_KEY, { absentCode: NO_QUALIFIER });
}

/**
 * compareRepMateriality(provisions, deals, { side, repCode, filters })
 *   The materiality distribution across the selected cohort. `repCode`
 *   (e.g. REP-T-IP) narrows to one canonical rep; `side` picks REP-T vs REP-B.
 *   Delegates to compareFeature with absentCode = MAT_NO_QUALIFIER.
 */
function compareRepMateriality(provisions, deals, opts = {}) {
  const { side, repCode, filters = {} } = opts;
  const inferredSide = side || (repCode && String(repCode).startsWith('REP-B') ? 'REP-B' : undefined);
  const type = repType(inferredSide);
  const mergedFilters = { ...filters };
  if (repCode) mergedFilters.code = repCode;
  return compareFeature(provisions, deals, {
    type,
    featureKey: FEATURE_KEY,
    filters: mergedFilters,
    absentCode: NO_QUALIFIER,
  });
}

/**
 * repMaterialityStats(provisions, deals, { filters }) → the cohort baseline for
 * rep materiality, scoped to REP-T + REP-B materialityQualifier only (a lean
 * slice of cohortFeatureStats for the materiality feature).
 */
function repMaterialityStats(provisions, deals, opts = {}) {
  const filters = (opts && opts.filters) || {};
  return cohortFeatureStats(provisions, deals, { filters })
    .filter((s) => s.featureKey === FEATURE_KEY);
}

/**
 * repMaterialityOutliers(dealProvisions, cohortStats, { minN }) → reps in this
 * deal whose materiality diverges from the cohort mode. `cohortStats` is
 * repMaterialityStats() (or full cohortFeatureStats()) for the same cohort.
 * The n-floor guardrail is enforced by featureOutliers.
 */
function repMaterialityOutliers(dealProvisions, cohortStats, opts = {}) {
  return featureOutliers(dealProvisions, cohortStats, opts)
    .filter((o) => o.featureKey === FEATURE_KEY);
}

module.exports = {
  repMaterialityCode,
  compareRepMateriality,
  repMaterialityStats,
  repMaterialityOutliers,
  NO_QUALIFIER,
  FEATURE_KEY,
};
