/**
 * taxonomy.js — Canonical codes for exceptions and qualifiers.
 *
 * When the parser extracts free-text "permitted exceptions", "materiality
 * qualifiers", "consent standards", or "efforts standards" from a provision,
 * it ALSO maps each one to a canonical code from this taxonomy so that
 * equivalent concepts can be compared across deals (regardless of how the
 * drafters phrased them).
 *
 * Each canonical "tagged" item has the shape:
 *   { code: "WHOLLY_OWNED_SUB", label: "Transactions among wholly-owned
 *     subsidiaries", text: "<verbatim excerpt from the agreement>" }
 *
 * CommonJS so it can be required from both the parser (Node/API routes) and
 * the Next.js client bundle.
 */

// ---------------------------------------------------------------------------
// Permitted exceptions / carve-outs found inside provisions
// ---------------------------------------------------------------------------

const EXCEPTION_CODES = {
  // IOC permitted exceptions
  WHOLLY_OWNED_SUB: 'Transactions among wholly-owned subsidiaries',
  EQUITY_AWARD_MECHANICS: 'Existing equity award exercises, vesting, or settlement',
  EXISTING_FACILITIES: 'Existing credit facilities or indebtedness',
  ORDINARY_COURSE: 'Ordinary course of business',
  DISCLOSURE_SCHEDULE: 'As set forth in disclosure schedule',
  REQUIRED_BY_LAW: 'As required by law or governmental authority',
  WRITTEN_CONSENT: 'With prior written consent of counterparty',
  COVID_MEASURES: 'COVID-19 / pandemic response measures',
  EXISTING_CONTRACTS: 'Pursuant to existing contracts as of signing',
  TAX_WITHHOLDING: 'Tax withholding or similar mandated actions',
  INTERCOMPANY: 'Intercompany transactions',
  TRADE_PAYABLES: 'Trade payables in ordinary course',
  EMERGENCY_LIFE_SAFETY: 'Emergency, life, or safety reasons',

  // NOSOL exceptions
  FIDUCIARY_OUT: 'Fiduciary out for Superior Proposal',
  UNSOLICITED_PROPOSAL: 'Response to unsolicited acquisition proposal',
  ACCEPTABLE_CONFI_AGREEMENT: 'Information sharing under acceptable confidentiality agreement',

  // ANTI exceptions
  BURDENSOME_CONDITION_CAP: 'Subject to burdensome condition cap',

  // Generic
  OTHER: 'Other specific exception (see text)',
};

// ---------------------------------------------------------------------------
// Materiality / scope qualifiers (used by bring-down standards, reps, etc.)
// ---------------------------------------------------------------------------

const MATERIALITY_CODES = {
  MAT_ALL_RESPECTS: 'True and correct in all respects',
  MAT_ALL_RESPECTS_DE_MINIMIS: 'True except for de minimis inaccuracies',
  MAT_ALL_MATERIAL: 'In all material respects',
  MAT_MAE_QUALIFIED: 'True except where failure would not have an MAE',
  MAT_MAE_AGGREGATE: 'Would not, individually or in aggregate, have MAE',
  MAT_DE_MINIMIS: 'Except for de minimis inaccuracies',
  MAT_MATERIALITY_SCRAPE: 'Materiality qualifiers disregarded for bring-down',
  MAT_KNOWLEDGE: 'Knowledge qualifier (best knowledge / actual knowledge)',
  MAT_WILLFUL_BREACH: 'Willful breach standard',
  MAT_INTENTIONAL_BREACH: 'Intentional breach standard',
  MAT_NO_QUALIFIER: 'No materiality qualifier',
};

// ---------------------------------------------------------------------------
// Consent standards (who decides, and with how much friction)
// ---------------------------------------------------------------------------

const CONSENT_STANDARDS = {
  PRIOR_WRITTEN: 'Prior written consent',
  NOT_UNREASONABLY_WITHHELD: 'Consent not to be unreasonably withheld, conditioned, or delayed',
  SOLE_DISCRETION: 'In sole discretion',
  REASONABLE_CONSENT: 'Reasonable consent',
  AUTOMATIC_DEEMED: 'Deemed given after X days',
  NO_CONSENT_REQUIRED: 'No consent required',
};

// ---------------------------------------------------------------------------
// Efforts standards (the level of effort a party must apply)
// ---------------------------------------------------------------------------

const EFFORTS_STANDARDS = {
  BEST_EFFORTS: 'Best efforts',
  REASONABLE_BEST_EFFORTS: 'Reasonable best efforts',
  COMMERCIALLY_REASONABLE_EFFORTS: 'Commercially reasonable efforts',
  REASONABLE_EFFORTS: 'Reasonable efforts',
  GOOD_FAITH_EFFORTS: 'Good faith efforts',
  HELL_OR_HIGH_WATER: 'Hell or high water',
};

// ---------------------------------------------------------------------------
// Equity awards (CONSID-EQUITY) — outstanding instruments
// ---------------------------------------------------------------------------

const EQUITY_INSTRUMENTS = {
  STOCK_OPTIONS: 'Stock Options',
  RSUs: 'Restricted Stock Units (RSUs)',
  PSUs: 'Performance Stock Units (PSUs)',
  RESTRICTED_STOCK: 'Restricted Stock Awards',
  WARRANTS: 'Warrants',
  ESPP: 'Employee Stock Purchase Plan rights',
  CONVERTIBLE_NOTES: 'Convertible Notes',
  SARS: 'Stock Appreciation Rights',
  PHANTOM_STOCK: 'Phantom Stock',
  DEFERRED_COMPENSATION: 'Deferred Compensation Awards',
};

// ---------------------------------------------------------------------------
// Equity awards — treatment at closing (per instrument)
// ---------------------------------------------------------------------------

const EQUITY_TREATMENT = {
  CASHED_OUT_AT_CONSIDERATION: 'Cashed out at Merger Consideration',
  CASHED_OUT_SPREAD: 'Cashed out at spread (Merger Consideration minus strike)',
  ACCELERATED_VESTING: 'Vesting accelerated and cashed out',
  PARTIAL_ACCELERATION: 'Partial vesting acceleration',
  ASSUMED_BY_BUYER: 'Assumed and converted to buyer equity',
  CANCELLED_NO_CONSIDERATION: 'Cancelled without consideration',
  CONTINUED_VESTING: 'Continues vesting on original schedule (no change)',
  REPLACEMENT_AWARDS: 'Cancelled and replaced with retention awards',
  DOUBLE_TRIGGER: 'Double-trigger acceleration (closing + qualifying termination)',
  PARACHUTE_LIMITED: 'Subject to 280G parachute payment limits',
};

// ---------------------------------------------------------------------------
// Equity awards — vesting status at/after closing
// ---------------------------------------------------------------------------

const VESTING_STATUS = {
  FULLY_ACCELERATED: 'Fully accelerated at closing',
  PARTIALLY_ACCELERATED: 'Partially accelerated at closing',
  DOUBLE_TRIGGER_ACCEL: 'Acceleration on double trigger (closing + termination)',
  NO_ACCELERATION: 'No acceleration; continues vesting',
  TIME_BASED_VESTING: 'Time-based vesting per original schedule',
  PERFORMANCE_DEEMED_ACHIEVED: 'Performance conditions deemed achieved',
  PERFORMANCE_PRORATED: 'Performance conditions prorated',
};

// ---------------------------------------------------------------------------
// Helpers — used by extract.js to embed compact dictionaries into prompts
// ---------------------------------------------------------------------------

/**
 * Format a code dictionary as a compact "CODE: description" list suitable
 * for inclusion in an AI prompt.
 *
 * @param {Object<string,string>} dict
 * @returns {string}
 */
function formatDict(dict) {
  return Object.entries(dict)
    .map(([code, label]) => `  ${code}: ${label}`)
    .join('\n');
}

/**
 * Returns true if the supplied code exists in the given dictionary.
 *
 * @param {string} code
 * @param {Object<string,string>} dict
 */
function isValidTaxonomyCode(code, dict) {
  if (!code || typeof code !== 'string') return false;
  return Object.prototype.hasOwnProperty.call(dict, code);
}

/**
 * Look up the canonical label for a taxonomy code, or null if unknown.
 *
 * @param {string} code
 * @param {Object<string,string>} dict
 */
function labelForCode(code, dict) {
  if (!isValidTaxonomyCode(code, dict)) return null;
  return dict[code];
}

/**
 * Which taxonomy dictionary applies to a given feature key. Used by both the
 * parser (to embed the right codebook in prompts) and the UI (to look up the
 * canonical label for a given code).
 *
 * Returns the dictionary, or null if the feature key has no taxonomy.
 */
function taxonomyForFeatureKey(featureKey) {
  switch (featureKey) {
    case 'permittedExceptions':
    case 'carveOuts':
    case 'carveOutsList':
      return EXCEPTION_CODES;
    case 'materialityQualifier':
    case 'materialityQualifiers':
    case 'bringDownStandard':
    case 'materialityScrape':
    case 'linkedBringDownStandard':
      return MATERIALITY_CODES;
    case 'consentStandard':
      return CONSENT_STANDARDS;
    case 'effortsStandard':
      return EFFORTS_STANDARDS;
    case 'outstandingInstruments':
      return EQUITY_INSTRUMENTS;
    case 'instrumentTreatments':
      return EQUITY_TREATMENT;
    case 'vestingAcceleration':
    case 'vestingStatus':
      return VESTING_STATUS;
    default:
      return null;
  }
}

/**
 * Feature keys whose values are LISTS of tagged items (each item is a
 * {code,label,text} object). Other taxonomy-tagged keys hold a single tagged
 * item (or just an enum-like string for backward compatibility).
 */
const LIST_TAXONOMY_KEYS = new Set([
  'permittedExceptions',
  'carveOuts',
  'carveOutsList',
  'materialityQualifiers',
  'outstandingInstruments',
  'instrumentTreatments',
]);

function isListTaxonomyKey(featureKey) {
  return LIST_TAXONOMY_KEYS.has(featureKey);
}

module.exports = {
  EXCEPTION_CODES,
  MATERIALITY_CODES,
  CONSENT_STANDARDS,
  EFFORTS_STANDARDS,
  EQUITY_INSTRUMENTS,
  EQUITY_TREATMENT,
  VESTING_STATUS,
  formatDict,
  isValidTaxonomyCode,
  labelForCode,
  taxonomyForFeatureKey,
  isListTaxonomyKey,
  LIST_TAXONOMY_KEYS,
};
