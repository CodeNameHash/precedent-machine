/**
 * extract.js — Phase 3 of the v2 parser pipeline.
 *
 * Extracts sub-provisions from classified sections, assigns canonical rubric
 * codes, and extracts structured features.
 *
 * Strategies:
 *   A  Regex-split → AI-classify  (DEF, IOC, COND-M/B/S, TERMR types)
 *   B  AI multi-code extraction   (NOSOL, ANTI — overlapping spans)
 *   C  Section-level AI           (REP, STRUCT, CONSID, COV, TERMF, MISC)
 *   D  Definition splitting       (DEF — regex split + alias lookup + AI classify)
 *
 * CommonJS — consumed by Next.js API routes.
 */

const {
  CODES,
  FEATURES,
  PROVISION_TYPES,
  getCodesForType,
  isValidCode,
  isRetiredCode,
  getSupersededBy,
  findCodeByAlias,
  getTypeLabel,
  getFeaturesForType,
  getFeaturesForCode,
} = require('../rubric');

const {
  EXCEPTION_CODES,
  MATERIALITY_CODES,
  CONSENT_STANDARDS,
  EFFORTS_STANDARDS,
  APPLIES_TO_PARTY,
  ANTITRUST_CONTROL,
  BURDEN_COMMITMENT,
  BURDEN_BASELINE,
  LITIGATION_OBLIGATION,
  CLEAR_SKIES_FAMILY,
  CONSULTATION_TIER,
  PULL_REFILE,
  TIMING_AGREEMENT,
  ANTITRUST_APPROVAL_CODES,
  TERMINATION_PARTY,
  EQUITY_INSTRUMENTS,
  EQUITY_TREATMENT,
  VESTING_STATUS,
  COMP_STANDARDS,
  COMP_ITEMS,
  // Stage 3 dictionaries
  MERGER_FORMS,
  MAE_CARVEOUT_CODES,
  IOC_CATEGORY_CODES,
  IOC_CATEGORY_META,
  MATERIAL_CONTRACT_BUCKET_CODES,
  MATERIAL_CONTRACT_BUCKET_META,
  REMEDY_TYPES,
  KNOWLEDGE_STANDARDS,
  SEC_FILING_EXCLUSION_CODES,
  TERMF_TRIGGER_CODES,
  INTEREST_RATE_BASIS,
  GOVERNING_LAW,
  SOLICITATION_ACT,
  SUPERIOR_DETERMINER,
  FORCE_THE_VOTE,
  ASSIGNMENT_PARENT_EXCEPTION,
  formatDict,
  taxonomyForFeatureKey,
  isListTaxonomyKey,
  LIST_TAXONOMY_KEYS,
} = require('../taxonomy');
const { convertConsiderationEquityProvisions, INSTRUMENT_MENTION_RES } = require('./consideration-equity');
const { extractTransactionSteps } = require('./detectors/transaction-steps');
const { canonicalIocCategoryFromHeading, iocCategoryFromBody, iocCategoryLabel } = require('../vocab/ioc-categories');

// Provision types whose shared/section-wide features should ONLY be extracted
// on a "General / Preamble" sub-clause; per-clause sub-clauses should NOT
// re-extract these.
const SCOPED_FEATURE_TYPES = new Set(['IOC', 'REP-T', 'REP-B']);

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const { MODEL } = require('../model');
const { firstAffirmativeMention, isNegatedMention } = require('../instrument-negation');
// Span accounting spec Part 2 (docs/archive/handoffs/SPAN-ACCOUNTING-SPEC-2026-07-18.md)
// — INERT unless a caller passes opts.spanClaims === true (see strategyA/
// strategyC below). No default call site enables it; wiring exists so it can
// be turned on for a controlled rollout without touching extract.js again.
const { attachSpanClaimsToProvisions } = require('./span-claims');

// Resolves the span-claims flag for one extraction. An explicit
// `opts.spanClaims === true` from the caller always wins. PM_SPAN_CLAIMS=1
// is the operator switch for the entrypoints that do not thread a
// span-claims option of their own (scripts/ingest-local.js passes only
// { checkpoint }; lib/parser-v2/run-extract.js passes no opts at all), so
// the pass can be enabled for a controlled rollout without editing a call
// site. OFF by default: an absent variable, or any value other than '1',
// leaves the ingest path byte-identical to before.
function resolveSpanClaimsOpts(opts) {
  const base = opts || {};
  if (base.spanClaims === true) return base;
  if (process.env.PM_SPAN_CLAIMS === '1') return { ...base, spanClaims: true };
  return base;
}

// Strategy-A/C wiring point (span accounting spec Part 2). `sections` is the
// classified-sections batch the strategy just processed; `provisions` may be
// whole sections (Strategy C) or sub-clauses split out of a section
// (Strategy A) — a sub-clause provision is mapped back to its PARENT
// section by startChar containment so segmentSubClauses() sees the whole
// section text. INERT unless the resolved options say spanClaims === true.
function attachStrategySpanClaims(sections, provisions, rawOpts) {
  const opts = resolveSpanClaimsOpts(rawOpts);
  if (!opts || opts.spanClaims !== true) return;
  if (!Array.isArray(sections) || !sections.length || !Array.isArray(provisions)) return;
  const sectionTextByStartChar = new Map();
  for (const s of sections) {
    if (s && Number.isFinite(s.startChar)) sectionTextByStartChar.set(s.startChar, s.text || '');
  }
  for (const prov of provisions) {
    if (!prov || !Number.isFinite(prov.startChar)) continue;
    if (sectionTextByStartChar.has(prov.startChar)) {
      prov.sectionStartChar = prov.startChar; // whole-section provision (Strategy C)
      continue;
    }
    // Sub-clause (Strategy A) — find the containing section by range.
    for (const s of sections) {
      if (!s || !Number.isFinite(s.startChar)) continue;
      const sEnd = s.startChar + (s.text || '').length;
      if (prov.startChar >= s.startChar && prov.startChar < sEnd) {
        prov.sectionStartChar = s.startChar;
        break;
      }
    }
  }
  attachSpanClaimsToProvisions(provisions, sectionTextByStartChar, opts);
}
const { renderExtractionPromptParts } = require('../schema/prompt');
const { isLegalSentenceBoundary, extendToSentenceBoundary } = require('./invariants/sentence-integrity');
const MAX_CONCURRENT = 6;
const MAX_BOUNDARY_REPAIR_CHARS = 4000;

/** Types handled by Strategy A (regex split → AI classify). */
const STRATEGY_A_TYPES = new Set([
  'IOC', 'IOC-T', 'IOC-B',
  'COND-M', 'COND-B', 'COND-S', 'COND',
  'TERMR', 'TERMR-M', 'TERMR-B', 'TERMR-T',
]);

/** Types handled by Strategy B (multi-code, overlapping spans). */
// NOSOL-T/NOSOL-B/NOSOL-M are the party-scoped no-solicitation subtypes —
// same multi-code overlapping-span handling as the base NOSOL family (see
// classify.js DETERMINISTIC_RULES: the default target no-shop stays bare
// 'NOSOL', while explicit buyer-side / reciprocal no-shop sections are typed
// NOSOL-B / NOSOL-M).
const STRATEGY_B_TYPES = new Set(['NOSOL', 'NOSOL-T', 'NOSOL-B', 'NOSOL-M', 'ANTI', 'TERMF']);

/** Types handled by Strategy C (section-level AI). */
const STRATEGY_C_TYPES = new Set([
  'REP-T', 'REP-B', 'STRUCT', 'CONSID', 'COV', 'MISC', 'OTHER',
]);

// ---------------------------------------------------------------------------
// Concurrency helper
// ---------------------------------------------------------------------------

async function runWithConcurrency(tasks, limit) {
  const results = [];
  let idx = 0;

  async function worker() {
    while (idx < tasks.length) {
      const i = idx++;
      results[i] = await tasks[i]();
    }
  }

  const workers = [];
  for (let w = 0; w < Math.min(limit, tasks.length); w++) {
    workers.push(worker());
  }
  await Promise.all(workers);
  return results;
}

// ---------------------------------------------------------------------------
// JSON parse helper — prose-tolerant, shared with classify.js.
// Tolerates markdown fences, prose preambles/trailers, and light truncation.
// Returns null (not throw) on unrecoverable input; every call site below either
// wraps the parse in try/catch or guards with `|| {}`, so a null propagates as
// a dropped chunk exactly as a thrown parse error used to.
// ---------------------------------------------------------------------------

const { parseJSON } = require('./parse-json');

// ---------------------------------------------------------------------------
// TERMR party-side mapping — derive per-party sub-type (M/B/T) from canonical code
// ---------------------------------------------------------------------------

/**
 * Map a canonical TERMR-* code to its party-specific provision type.
 *
 * - Mutual codes → 'TERMR-M'
 * - Buyer (Parent) terminate codes → 'TERMR-B'
 * - Target (Seller) terminate codes → 'TERMR-T'
 * - Unknown / unmapped → 'TERMR'
 */
function termrPartyFromCode(code) {
  if (!code) return 'TERMR';
  const mutual = ['TERMR-MUTUAL', 'TERMR-OUTSIDE', 'TERMR-EXTENSION', 'TERMR-LEGAL', 'TERMR-VOTE'];
  const buyer = ['TERMR-BREACH-T', 'TERMR-RECOMMEND'];
  const target = ['TERMR-BREACH-B', 'TERMR-SUPERIOR'];
  if (mutual.includes(code)) return 'TERMR-M';
  if (buyer.includes(code)) return 'TERMR-B';
  if (target.includes(code)) return 'TERMR-T';
  return 'TERMR';
}

// Map a COND-* canonical code to its family type so a sub-clause routes to the
// right Mutual / Buyer / Target bucket even when the classifier put the whole
// section in a different family (e.g. tender-offer Annex I conditions are all
// classified COND-B, but the no-legal-restraint / regulatory / minimum-tender
// offer conditions carry COND-M-* codes and should render under Mutual).
function condFamilyFromCode(code) {
  if (!code || typeof code !== 'string') return null;
  if (code.startsWith('COND-M')) return 'COND-M';
  if (code.startsWith('COND-B')) return 'COND-B';
  if (code.startsWith('COND-S')) return 'COND-S';
  return null;
}

/**
 * Fallback: derive party-specific TERMR type from the partyWhoCanTerminate
 * feature value when the canonical code is missing or unmapped.
 */
function termrPartyFromFeature(features) {
  if (!features) return 'TERMR';
  const v = features.partyWhoCanTerminate;
  if (!v) return 'TERMR';
  let lc = '';
  if (typeof v === 'string') {
    lc = v.toLowerCase();
  } else if (typeof v === 'object') {
    lc = String(v.code || v.label || '').toLowerCase();
  }
  if (!lc) return 'TERMR';
  if (lc.includes('mutual') || lc === 'either' || lc.includes('both') || lc === 'party_mutual') return 'TERMR-M';
  if (lc.includes('buyer') || lc.includes('parent') || lc.includes('acquir') || lc === 'party_buyer' || lc === 'party_parent') return 'TERMR-B';
  if (lc.includes('target') || lc.includes('seller') || lc.includes('company') || lc === 'party_target' || lc === 'party_company') return 'TERMR-T';
  return 'TERMR';
}

// ---------------------------------------------------------------------------
// Feature-schema filtering — drop fields that don't belong to a code's schema
// ---------------------------------------------------------------------------

/**
 * Normalize a TERMR features object:
 *   - "partyWhoCanTerminate" — collapse "either" / "mutual" / "both" to the
 *     canonical TERMINATION_PARTY tagged object { code: 'PARTY_MUTUAL', ... }.
 *     If the AI returned a tagged object already, preserve "text" but coerce
 *     the code/label. If it returned a bare string, convert it to a tagged
 *     object using the supplied text as the verbatim excerpt.
 *   - Force the party for codes whose party is FIXED by definition (e.g.
 *     TERMR-BREACH-T is always buyer-terminate; TERMR-SUPERIOR is always
 *     target-terminate). This guarantees consistency even when the AI emits
 *     a different value.
 */
function normalizeTermrParty(features, code) {
  if (!features || typeof features !== 'object') return features;

  // Codes whose party is FIXED by definition.
  const FIXED_PARTY_BY_CODE = {
    'TERMR-MUTUAL': 'PARTY_MUTUAL',
    'TERMR-BREACH-T': 'PARTY_BUYER',
    'TERMR-BREACH-B': 'PARTY_TARGET',
    'TERMR-SUPERIOR': 'PARTY_TARGET',
    'TERMR-RECOMMEND': 'PARTY_BUYER',
  };

  const raw = features.partyWhoCanTerminate;

  // Helper to build a canonical tagged-party object.
  const toTagged = (canonicalCode, text) => ({
    code: canonicalCode,
    label: TERMINATION_PARTY[canonicalCode] || canonicalCode,
    text: text || null,
  });

  // 1. If this code has a fixed party, OVERRIDE whatever the AI said.
  if (code && FIXED_PARTY_BY_CODE[code]) {
    const text = (raw && typeof raw === 'object' && raw.text) || (typeof raw === 'string' ? raw : null);
    features.partyWhoCanTerminate = toTagged(FIXED_PARTY_BY_CODE[code], text);
    return features;
  }

  // 2. Otherwise normalize the AI's value.
  if (!raw) return features;

  let valueStr = '';
  let text = null;
  if (typeof raw === 'string') {
    valueStr = raw;
  } else if (typeof raw === 'object') {
    valueStr = String(raw.code || raw.label || '');
    text = raw.text || null;
  }
  const lc = valueStr.toLowerCase();

  if (!lc) return features;

  if (lc.includes('mutual') || lc === 'either' || lc.includes('both') || lc === 'party_mutual') {
    features.partyWhoCanTerminate = toTagged('PARTY_MUTUAL', text);
  } else if (lc.includes('buyer') || lc.includes('parent') || lc.includes('acquir') || lc === 'party_buyer' || lc === 'party_parent') {
    features.partyWhoCanTerminate = toTagged('PARTY_BUYER', text);
  } else if (lc.includes('target') || lc.includes('seller') || lc.includes('company') || lc === 'party_target' || lc === 'party_company') {
    features.partyWhoCanTerminate = toTagged('PARTY_TARGET', text);
  }
  // else leave as-is (unknown / null)

  return features;
}

/**
 * Reduce a features object to ONLY the keys present in the canonical code's
 * feature schema (with post-pass-stamped keys like `knowledgeScope` always
 * allowed, since they are stamped by post-processing rather than the
 * per-code schema).
 *
 * Used after AI classification to strip irrelevant fields from per-code
 * provisions — e.g. ensure TERMR-MUTUAL never displays an `outsideDate` cell.
 *
 * If the code has no specific schema, returns the features object unchanged
 * (so we don't accidentally wipe data we don't have a schema for).
 */
function filterFeaturesToCodeSchema(features, code) {
  if (!features || typeof features !== 'object') return features;
  const schema = getFeaturesForCode(code);
  if (!schema || schema.length === 0) return features;
  const allowed = new Set(schema.map((f) => f.key));
  // Always allow post-pass-stamped keys (linkKnowledgeScopeToReps,
  // resolveAocCovenantCitations). Gap F: linkedBringDownStandard is no
  // longer force-allowed — its post-pass producer was removed.
  allowed.add('knowledgeScope');
  allowed.add('knowledgeQualifier');
  allowed.add('aocCitedCovenantNames');
  // Section identity stamped by the extraction strategies themselves.
  allowed.add('sectionNumber');
  // Always allow inline-definition source metadata so DEF provisions keep
  // their UI breadcrumbs.
  allowed.add('sourceSection');
  allowed.add('sourceSectionType');
  allowed.add('inlineDefinition');

  const filtered = {};
  for (const [k, v] of Object.entries(features)) {
    if (allowed.has(k)) filtered[k] = v;
  }
  return filtered;
}

// ---------------------------------------------------------------------------
// Provision shape builder
// ---------------------------------------------------------------------------

function makeProvision(overrides) {
  return {
    type: null,
    code: null,
    category: null,
    text: '',
    startChar: 0,
    favorability: 'neutral',
    features: {},
    relatedDefinitions: [],
    isNewCode: false,
    proposedCode: null,
    proposedLabel: null,
    ...overrides,
  };
}

// ---------------------------------------------------------------------------
// Build feature extraction instructions for a provision type
// ---------------------------------------------------------------------------

function buildFeatureInstructions(typeKey, opts = {}) {
  // opts.scope:
  //   - 'preamble' → only emit features marked scope: 'preamble' (shared)
  //   - 'clause'   → only emit features marked scope: 'clause' (or unscoped)
  //   - undefined  → emit ALL features (legacy / Strategy B,C,D)
  const scope = opts.scope || null;
  let feats = getFeaturesForType(typeKey);
  if (!feats || feats.length === 0) return '';

  // For COV, the AI hasn't yet picked a canonical code, so it doesn't know
  // whether the section is a generic Other Covenant or a dedicated COV subcode.
  // Merge the code-specific schema fields onto the generic COV feature list so
  // the AI sees every field it might need to populate. The typeSpecific block
  // below explains when each field applies, and post-processing in strategyC
  // filters down to the actual code's schema.
  if (typeKey === 'COV') {
    const covCodeFeats = [
      ...(FEATURES['COV-EMPLOYEE'] || []),
      ...(FEATURES['COV-PROXY'] || []),
      ...(FEATURES['COV-MEETING'] || []),
    ];
    if (covCodeFeats.length > 0) {
      const seenKeys = new Set(feats.map((f) => f.key));
      const merged = feats.slice();
      for (const f of covCodeFeats) {
        if (!seenKeys.has(f.key)) {
          merged.push(f);
          seenKeys.add(f.key);
        }
      }
      feats = merged;
    }
  }

  // P5 item 5(c): merge the REP-T-PREAMBLE / REP-B-PREAMBLE sub-code schema
  // fields into the preamble-scoped feature set so the dedicated prompt
  // surfaces the new keys (secFilingsExceptionLanguage, disclosureLetterReference,
  // etc.). These code-specific schemas have no `scope` annotation, so we treat
  // them as preamble-scoped when the call is preamble-scoped on REP-T / REP-B.
  if (scope === 'preamble' && (typeKey === 'REP-T' || typeKey === 'REP-B')) {
    const preambleCode = typeKey === 'REP-T' ? 'REP-T-PREAMBLE' : 'REP-B-PREAMBLE';
    const extra = FEATURES[preambleCode] || [];
    if (extra.length > 0) {
      const seenKeys = new Set(feats.map((f) => f.key));
      const merged = feats.slice();
      for (const f of extra) {
        if (!seenKeys.has(f.key)) {
          merged.push({ ...f, scope: 'preamble' });
          seenKeys.add(f.key);
        }
      }
      feats = merged;
    }
  }

  if (scope && SCOPED_FEATURE_TYPES.has(typeKey)) {
    if (scope === 'preamble') {
      feats = feats.filter((f) => f.scope === 'preamble');
    } else if (scope === 'clause') {
      // Per-clause sub-clauses: ONLY features explicitly marked 'clause' (or
      // with no scope at all). Shared 'preamble' features are excluded.
      feats = feats.filter((f) => f.scope !== 'preamble');
    }
  }
  // Features carrying a `source` annotation ('linked-from-COND', 'post-pass')
  // are stamped deterministically by post-processing — never ask the model to
  // guess them.
  feats = feats.filter((f) => !f.source);
  if (!feats || feats.length === 0) return '';

  // Track which taxonomy dictionaries are referenced by features on this
  // provision type so we can append the codebook(s) once at the end.
  const usedTaxonomies = new Map(); // dict-name → dict object

  // Track whether any citable fields are in scope so we can add the global
  // citation rule once at the top of the prompt.
  let anyCitable = false;

  const legacyLines = feats.map((f) => {
    let desc = `- ${f.key}: `;
    const taxonomy = taxonomyForFeatureKey(f.key);
    const taxonomyIsList = isListTaxonomyKey(f.key);
    // Citable wraps bare booleans / enums / numbers in { value, quotes }.
    // Tagged values and list-tagged items already carry "text" so they are
    // never wrapped (the carry-the-quote behavior is already built into
    // their { code, label, text } shape).
    const isCitable = !!f.citable && !taxonomy;
    if (isCitable) anyCitable = true;

    if (taxonomy && taxonomyIsList) {
      // Array of tagged objects
      desc += 'array of TAGGED objects { code, label, text }, or empty array []';
    } else if (taxonomy) {
      // Single tagged object (or null)
      desc += 'TAGGED object { code, label, text }, or null';
    } else if (isCitable) {
      // Citable bare-type fields: wrap the natural type in { value, quotes }
      let inner;
      switch (f.type) {
        case 'enum':
          inner = `one of ${JSON.stringify(f.options)}`;
          break;
        case 'boolean':
          inner = 'true/false';
          break;
        case 'currency':
          inner = 'dollar amount string (e.g. "$500,000,000")';
          break;
        case 'percentage':
          inner = 'percentage string (e.g. "15%")';
          break;
        case 'duration':
          inner = 'number (e.g. 4 for 4 business days)';
          break;
        default:
          inner = 'value';
      }
      desc += `object { value: ${inner}, quotes: ["<verbatim contiguous quote from the agreement>"] }, or null`;
    } else {
      switch (f.type) {
        case 'enum':
          desc += `one of ${JSON.stringify(f.options)}, or null`;
          break;
        case 'boolean':
          desc += 'true/false';
          break;
        case 'currency':
          desc += 'dollar amount as string (e.g. "$500,000,000"), or null';
          break;
        case 'percentage':
          desc += 'percentage as string (e.g. "15%"), or null';
          break;
        case 'duration':
          desc += 'numeric value (e.g. 4 for 4 business days), or null';
          break;
        case 'list':
          desc += 'array of strings, or empty array []';
          break;
        case 'object-list':
          desc += 'array of objects, or empty array []';
          break;
        case 'text':
          desc += 'free text string, or null';
          break;
        case 'object':
          desc += 'object, or null';
          break;
        case 'tiers':
          desc += 'array of objects { reps_covered, standard, standard_label, exceptions? } — one entry per tier (use a single-element array if uniform). "standard" MUST be a code from MATERIALITY_CODES. "standard_label" is the human-readable label for that code. "exceptions" is optional free-text qualifier (e.g. "Other than de minimis inaccuracies").';
          // Tiered bring-downs reference MATERIALITY_CODES; ensure the
          // codebook is included in the prompt.
          usedTaxonomies.set('MATERIALITY_CODES', MATERIALITY_CODES);
          break;
        default:
          desc += 'value or null';
      }
    }
    desc += ` — ${f.label}`;

    if (taxonomy) {
      // Identify which dict this is and remember it for the codebook footer
      let dictName;
      if (taxonomy === EXCEPTION_CODES) dictName = 'EXCEPTION_CODES';
      else if (taxonomy === MATERIALITY_CODES) dictName = 'MATERIALITY_CODES';
      else if (taxonomy === CONSENT_STANDARDS) dictName = 'CONSENT_STANDARDS';
      else if (taxonomy === EFFORTS_STANDARDS) dictName = 'EFFORTS_STANDARDS';
      else if (taxonomy === APPLIES_TO_PARTY) dictName = 'APPLIES_TO_PARTY';
      else if (taxonomy === ANTITRUST_CONTROL) dictName = 'ANTITRUST_CONTROL';
      else if (taxonomy === BURDEN_COMMITMENT) dictName = 'BURDEN_COMMITMENT';
      else if (taxonomy === BURDEN_BASELINE) dictName = 'BURDEN_BASELINE';
      else if (taxonomy === LITIGATION_OBLIGATION) dictName = 'LITIGATION_OBLIGATION';
      else if (taxonomy === CONSULTATION_TIER) dictName = 'CONSULTATION_TIER';
      else if (taxonomy === PULL_REFILE) dictName = 'PULL_REFILE';
      else if (taxonomy === TIMING_AGREEMENT) dictName = 'TIMING_AGREEMENT';
      else if (taxonomy === TERMINATION_PARTY) dictName = 'TERMINATION_PARTY';
      else if (taxonomy === EQUITY_INSTRUMENTS) dictName = 'EQUITY_INSTRUMENTS';
      else if (taxonomy === EQUITY_TREATMENT) dictName = 'EQUITY_TREATMENT';
      else if (taxonomy === VESTING_STATUS) dictName = 'VESTING_STATUS';
      else if (taxonomy === COMP_STANDARDS) dictName = 'COMP_STANDARDS';
      else if (taxonomy === MERGER_FORMS) dictName = 'MERGER_FORMS';
      else if (taxonomy === MAE_CARVEOUT_CODES) dictName = 'MAE_CARVEOUT_CODES';
      else if (taxonomy === IOC_CATEGORY_CODES) dictName = 'IOC_CATEGORY_CODES';
      else if (taxonomy === MATERIAL_CONTRACT_BUCKET_CODES) dictName = 'MATERIAL_CONTRACT_BUCKET_CODES';
      else if (taxonomy === REMEDY_TYPES) dictName = 'REMEDY_TYPES';
      else if (taxonomy === KNOWLEDGE_STANDARDS) dictName = 'KNOWLEDGE_STANDARDS';
      else if (taxonomy === ANTITRUST_APPROVAL_CODES) dictName = 'ANTITRUST_APPROVAL_CODES';
      else if (taxonomy === INTEREST_RATE_BASIS) dictName = 'INTEREST_RATE_BASIS';
      else if (taxonomy === GOVERNING_LAW) dictName = 'GOVERNING_LAW';
      else if (taxonomy === SOLICITATION_ACT) dictName = 'SOLICITATION_ACT';
      else if (taxonomy === SUPERIOR_DETERMINER) dictName = 'SUPERIOR_DETERMINER';
      else if (taxonomy === FORCE_THE_VOTE) dictName = 'FORCE_THE_VOTE';
      else if (taxonomy === ASSIGNMENT_PARENT_EXCEPTION) dictName = 'ASSIGNMENT_PARENT_EXCEPTION';
      else dictName = 'TAXONOMY_CODES';
      usedTaxonomies.set(dictName, taxonomy);
      desc += ` [map each ${taxonomyIsList ? 'item' : 'value'} to a code from ${dictName}]`;
    }
    return desc;
  });
  const schemaPromptParts = renderExtractionPromptParts(typeKey, null, {
    features: feats,
    scope,
  });
  const lines = schemaPromptParts.lines.length > 0 ? schemaPromptParts.lines : legacyLines;
  anyCitable = anyCitable || schemaPromptParts.anyRequiredEvidence;

  // No global brevity rule — per-type instructions handle this where needed.
  // Forcing every summary into one sentence over-trims definitions, MAE concepts,
  // and tiered conditions where richer phrasing is useful.
  const globalBrevity = '';

  // Type-specific extraction guard rails
  let typeSpecific = '';
  if (typeKey === 'IOC') {
    if (scope === 'preamble') {
      typeSpecific = `
CRITICAL FEATURE EXTRACTION RULES for IOC PREAMBLE (section-wide carve-outs + positive-obligation limbs):
- These features describe rules that apply ACROSS the whole interim-operating-covenants section.
- "requiredByLawCarveout", "pandemicCarveout", "ordinaryCourseCarveout" are TRUE only if the preamble itself states a section-wide carve-out of that flavor (e.g. "Notwithstanding the foregoing, the Company may take any action required by Law...").
- "materialityQualifier" is true only if the preamble qualifies the entire section with a materiality concept (e.g. "Except as would not be material to the Company...").
- "scheduleReference" is LOW-VALUE metadata. Do not spend effort extracting the schedule cite as its own answer; the useful legal fact is the exception type and its exact text, not which schedule number is referenced.
- "permittedExceptions" — the IOC preamble almost always lists 3-5 SECTION-WIDE carve-outs in a single "Except as ... or with ..." framing. Extract EACH ONE as a tagged item { code, label, text } drawn from EXCEPTION_CODES. Look explicitly for these standard carve-outs (omit any that aren't actually present):
    * COMPANY_DISCLOSURE_LETTER — the "as disclosed" carve-out ONLY: "Except
      as/for matters set forth in Section X.YZ of the Company Disclosure
      Letter". Capture just the Disclosure-Letter half verbatim. When the
      sentence continues "or otherwise expressly required by this Agreement",
      that half is a SEPARATE item (REQUIRED_BY_AGREEMENT below) — do NOT
      merge the two into one composite item.
    * REQUIRED_BY_AGREEMENT — the "otherwise expressly required (or
      contemplated) by this Agreement" carve-out, as its OWN item even when it
      appears in the same "Except as ..." sentence as the Disclosure-Letter
      cite. A typical four-carve-out preamble (Disclosure Letter / required by
      Agreement / required by Law / Parent consent) MUST yield four items.
    * REQUIRED_BY_LAW — "required by applicable Law" / "required by Law". The
      pill is rendered as "As required by law".
    * PRIOR_WRITTEN_CONSENT — "with the prior written consent of Parent (not to
      be unreasonably withheld, conditioned, or delayed)" — CAPTURE THE FULL
      PARENTHETICAL VERBATIM (e.g. "(which consent shall not be unreasonably
      withheld, delayed or conditioned)") in the "text" field; do NOT abbreviate.
      The pill is rendered as "With Parent's consent".
    * ORDINARY_COURSE — explicit section-wide ordinary-course-of-business
      carve-out.
  These section-wide exceptions belong ONLY on the preamble (do NOT also stamp them on individual sub-clauses).

- "party_role" — OPTIONAL. Populate with the grammatical covenanting party when the text identifies it. Preferred values: COMPANY, PARENT, COLUMBUS, CABOT, MERGER_SUB, SPINCO, REMAINCO, JV. Examples: "Columbus shall ..." -> COLUMBUS; "the Cabot Parties shall ..." -> CABOT. Leave null when the text only uses a generic party label and the role is not clear from the paragraph.

- "positiveObligations" — CRITICAL. The IOC preamble bundles multiple AFFIRMATIVE duties (the "limbs") into one paragraph — these are the positive obligations Target undertakes during the interim period. Extract EACH distinct top-level limb as its OWN object. Do NOT merge them into one summary.

  Each limb is an object: { "obligation": "<short verbatim or near-verbatim phrase>", "efforts_standard": "<EFFORTS_STANDARDS code — the SOLE standard>", "appliesTo": ["<IOC_AFFIRMATIVE_SCOPE code>", ...], "includedObligations": [<optional child limb objects>] }

  CRITICAL — efforts_standard is the SOLE standard field. Do NOT ALSO emit a
  separate materialityQualifier on a limb — a limb carrying TWO
  independently-guessed standards (e.g. efforts_standard:
  COMMERCIALLY_REASONABLE_EFFORTS *and* materialityQualifier: FLAT on the
  SAME limb) is a FAILURE: it renders as two contradictory pills in the
  review UI. And NEVER echo the limb's own covenant CONTENT as if it were
  the standard — "ordinary course" and "in all material respects" describe
  WHAT the limb is about, not how hard the party must try; a limb with no
  "use ... efforts to" language is FLAT, never "ORDINARY_COURSE" or
  "MATERIAL_RESPECTS".

  Typical limbs to look for (omit any not present):
    * "Maintain business" / "conduct business in the ordinary course in all material respects"
        — efforts_standard: FLAT (no "use ... efforts to" language — this is
          a direct, unqualified duty; "in all material respects" is content,
          not a standard), appliesTo: ["BUSINESS_ORGANIZATION", "ASSETS"]
    * "Preserve business organization / retain key employees"
        — efforts_standard: REASONABLE_BEST_EFFORTS or
          COMMERCIALLY_REASONABLE_EFFORTS (whichever the text actually says),
          appliesTo: ["BUSINESS_ORGANIZATION", "OFFICERS_KEY_EMPLOYEES"]
    * "Preservation of business relationships"
        — efforts_standard: the named effort standard (e.g. "use
          commercially reasonable efforts to preserve ..." →
          COMMERCIALLY_REASONABLE_EFFORTS), appliesTo: list each relationship
          as its OWN code — e.g. ["CUSTOMERS", "SUPPLIERS", "EMPLOYEES",
          "GOVERNMENTAL_ENTITIES", "LICENSORS_LICENSEES", "COLLABORATORS"]
    * "Ordinary course obligation" / "conduct business only in the ordinary course"
        (no "use ... efforts to" qualifier anywhere in the limb)
        — efforts_standard: FLAT, appliesTo: ["BUSINESS"]

  RULES:
  1. efforts_standard MUST be picked from EFFORTS_STANDARDS: FLAT (the
     unqualified, mandatory case — no "use ... efforts to" language at all),
     BEST_EFFORTS, REASONABLE_BEST_EFFORTS, COMMERCIALLY_REASONABLE_EFFORTS,
     REASONABLE_EFFORTS, GOOD_FAITH_EFFORTS, HELL_OR_HIGH_WATER. NEVER leave
     the obligation unqualified-but-empty — emit FLAT explicitly. The UI
     renders FLAT as a canonical "Flat" pill so cross-deal comparison works.
     (A deterministic post-pass re-derives this value directly from your
     "obligation" text and will overwrite anything inconsistent, so match the
     text precisely rather than guessing.)
  2. appliesTo MUST be a LIST of canonical IOC_AFFIRMATIVE_SCOPE codes — one
     per distinct addressee. Do NOT emit one comma-joined string. The
     canonical codes (see IOC_AFFIRMATIVE_SCOPE_CODES) are: BUSINESS,
     BUSINESS_ORGANIZATION, ASSETS, PROPERTIES, OFFICERS_KEY_EMPLOYEES,
     CUSTOMERS, SUPPLIERS, EMPLOYEES, GOVERNMENTAL_ENTITIES,
     LICENSORS_LICENSEES, COLLABORATORS, OTHER_RELATIONSHIPS. So
     "Preservation of business relationships with customers, suppliers and
     governmental entities" yields ["CUSTOMERS", "SUPPLIERS",
     "GOVERNMENTAL_ENTITIES"], NOT a single string.
  3. For "obligation": copy the AFFIRMATIVE phrase as closely as possible from
     the source. Do NOT summarize the whole preamble — produce ONE limb per
     discrete duty.
  4. When the source uses "including", "including without limitation", or
     parenthetical "(including ...)" language to introduce a nested duty that
     explains the parent duty, put that child duty in includedObligations on
     the parent limb. Do NOT emit it as a peer sibling. Peer siblings are
     reserved for top-level duties joined by separate clauses, semicolon
     boundaries, or independent verb phrases.

  Return positiveObligations as an array of these limb objects, in source order. If the preamble has no affirmative obligations (rare), return [].

- VERBATIM RULE: when copying any text into the "text" field of tagged items, or into positiveObligations.obligation, copy the EXACT TEXT from the source character-for-character, including ALL parentheticals, qualifiers, and footnotes. Do NOT summarize or paraphrase. Example: capture "with the prior written consent of Parent (which consent shall not be unreasonably withheld, delayed or conditioned)" in FULL, INCLUDING the parenthetical, not as "with consent of Parent".

- Do NOT extract per-sub-clause features (mainObligation, consentStandard, dollarThreshold) here — those are extracted on the individual sub-clauses.

STAGE-1 FIELDS for IOC PREAMBLE (extract when supported by text — leave null otherwise):
- dollarThresholdsByCategory (list-tagged from IOC_CATEGORY_CODES): For EACH IOC restriction that names a dollar threshold (capex, indebtedness, settlements, contracts, etc.), emit a tagged item { code, label, text, threshold } where code is from IOC_CATEGORY_CODES and threshold is the dollar amount.
- interimSettlementCap (currency): Section-wide cap on settlements ("settlements requiring payment in excess of $X").
- interimSettlementNonPaymentExcluded (boolean): true if the cap excludes non-monetary relief / non-payment settlements.
- interimNewContractsScope (text): Verbatim scope of the restriction on entering new material contracts.
- salaryIncreaseExceptions (text): Verbatim exceptions to the salary-increase prohibition (ordinary course merit increases, etc.).
- bonusIncreaseExceptions (text): Verbatim exceptions to the bonus-increase prohibition.
- newHireExceptions (text): Verbatim exceptions to the new-hire prohibition.
- retentionBonusRestrictions (text): Verbatim restriction on entering retention-bonus arrangements.
- benefitPlanRestrictions (text): Verbatim restriction on amending benefit plans.
- equityAwardRestrictions (text): Verbatim restriction on granting equity awards.
- leadInAllowsActionAfterNoResponse (boolean): true if the preamble allows the Company to take action after Parent fails to respond within a stated period.
- leadInPeriodDays (number): The lead-in period in days for that mechanic.
- parentBuyerIocBuckets (list of strings): Categories of Parent/Buyer-side interim operating covenants (when the agreement contains them). Use short bucket labels (e.g. ["Capital structure", "Indebtedness", "Material acquisitions"]). Empty array [] if no Parent-side IOC covenant exists.
`;
    } else if (scope === 'clause') {
      typeSpecific = `
CRITICAL FEATURE EXTRACTION RULES for IOC SUB-CLAUSE (per-restriction features only):
- "mainObligation" should be a one-sentence summary of what THIS sub-clause actually restricts or requires (e.g., "Target cannot incur indebtedness in excess of $25 million without buyer consent").
- "dollarThreshold" — when THIS sub-clause's restriction itself names a dollar cap in the OPERATIVE text (NOT in an exception), capture that amount as a currency string. Example: "(viii) make or authorize aggregate capital expenditures in excess of $100,000" → dollarThreshold = "$100,000"; "(xii) incur indebtedness in excess of $5,000,000" → dollarThreshold = "$5,000,000". This is the threshold ABOVE which the restriction bites. Leave null if the restriction is absolute (no dollar figure). Do NOT confuse this with an exception threshold (those go on the permittedExceptions item — see MONETARY THRESHOLD RULE).
- "consentStandard" and "effortsStandard" are TAGGED single objects { code, label, text } drawn from CONSENT_STANDARDS / EFFORTS_STANDARDS respectively (or null if absent). For "text", copy the verbatim phrase from the agreement INCLUDING any parentheticals (e.g. "consent of Parent (which consent shall not be unreasonably withheld, delayed or conditioned)" — capture the full parenthetical, do NOT abbreviate).
- "permittedExceptions" is ONLY for text that genuinely begins with one of these markers in THIS sub-clause: "except", "other than", "provided that", "provided, however, that", or "notwithstanding". Do NOT include section-wide carve-outs from the preamble. If there are no sub-clause-specific carve-outs, return an empty array []. Each item MUST be a tagged object { code, label, text } where code is drawn from EXCEPTION_CODES (use "OTHER" if no listed code fits). For "text", copy the EXACT verbatim excerpt including parentheticals and qualifiers — do NOT summarize.
- PERMITTED-EXCEPTIONS CAUTION: exceptions can appear as provisos, parentheticals, budget baskets, dollar baskets, law/agreement carve-outs, consent carve-outs, ordinary-course carve-outs, and bespoke industry carve-outs. Preserve the shape actually used in the agreement. Do not flatten a nuanced exception into a generic summary just because the canonical tag family is imperfect.
- MONETARY THRESHOLD RULE: when a sub-clause's exception is FUNDAMENTALLY a dollar threshold (e.g. "except for capital expenditures of less than $2,000,000 individually or $2,500,000 in the aggregate", "except for settlements of legal proceedings that require payment in an amount less than $250,000 individually or $2,000,000 in the aggregate"), DO NOT tag this exception as OTHER. Tag it MONETARY_THRESHOLD and ADDITIONALLY emit a "thresholdIndividual" (currency) and "thresholdAggregate" (currency) field ON THE EXCEPTION ITEM (alongside code / label / text). Example shape: { "code": "MONETARY_THRESHOLD", "label": "Below monetary threshold", "text": "less than $250,000 individually or $2,000,000 in the aggregate", "thresholdIndividual": 250000, "thresholdAggregate": 2000000 }. Numbers are unitless USD integers — drop the dollar sign and any commas. If only one of the two is stated, populate just that one. Currency assumed USD unless the agreement specifies otherwise (add a "currency" field with the ISO code in that case).
- BUDGET EXCEPTION RULE: when a sub-clause carves out actions taken "in accordance with the [Capital Expenditure] Budget" / "consistent with the budget" / "set forth on Schedule X (Capex Budget)", tag the exception BUDGET_EXCEPTION with text capturing the verbatim phrase plus the schedule reference (if any).
- The MONETARY_THRESHOLD and BUDGET_EXCEPTION tags BOTH frequently appear together on the same sub-clause (e.g. capex sub-clause permits in-budget capex AND capex below the dollar cap). Emit BOTH exception items in that case.
- "crossReferences" should list other explicit section/article references (e.g. "Section 5.1(a)", "Schedule 4.02").
- Do NOT extract the section-wide carve-outs (requiredByLawCarveout, pandemicCarveout, ordinaryCourseCarveout, materialityQualifier, scheduleReference) on this sub-clause — those live on the preamble.

AFFIRMATIVE-CHAPEAU RULE (applies ONLY when this sub-clause is the AFFIRMATIVE-COVENANTS lead-in — typically clause "(a)" reading something like "the Company shall ... use commercially reasonable efforts to: (i) conduct its business in the ordinary course ... and (ii) preserve intact its material assets, business organization and relations with ..."):
- Set this sub-clause's code to IOC-POSITIVE-PREAMBLE (it is the affirmative chapeau, not a single negative restriction).
- Populate "party_role" when the grammatical subject is identifiable. Examples: "Columbus shall ..." -> COLUMBUS; "the Cabot Parties shall ..." -> CABOT.
- Populate a "positiveObligations" array — ONE object per distinct affirmative limb. Do NOT collapse the limbs into one. Each object has this shape (efforts_standard is the SOLE standard — do NOT also emit a materialityQualifier on the limb; see the standard IOC-preamble rules above for the FLAT-vs-named-effort-standard distinction):
    { "obligation": "<short verbatim phrase of the limb, e.g. 'conduct its business in the ordinary course of business'>", "efforts_standard": "<one of FLAT | COMMERCIALLY_REASONABLE_EFFORTS | REASONABLE_BEST_EFFORTS | BEST_EFFORTS | REASONABLE_EFFORTS | GOOD_FAITH_EFFORTS | HELL_OR_HIGH_WATER>", "appliesTo": ["<scope codes: BUSINESS, BUSINESS_ORGANIZATION, ASSETS, EMPLOYEES, CUSTOMERS, SUPPLIERS, LICENSORS_LICENSEES, GOVERNMENTAL_ENTITIES, OTHER_RELATIONSHIPS>"], "includedObligations": [<optional child limb objects with the same shape>] }
  Typical Landos-style chapeau yields TWO limbs: (i) "conduct its business in the ordinary course" — efforts_standard COMMERCIALLY_REASONABLE_EFFORTS ONLY when "use commercially reasonable efforts to" governs this limb too (as in the Landos chapeau, where it governs both (i) and (ii)); FLAT when this limb has no efforts qualifier of its own, appliesTo ["BUSINESS"]; (ii) "preserve intact its material assets, business organization and relations with employees, customers, suppliers, licensors, licensees, Governmental Bodies" — efforts_standard COMMERCIALLY_REASONABLE_EFFORTS (same shared qualifier), appliesTo ["ASSETS","BUSINESS_ORGANIZATION","EMPLOYEES","CUSTOMERS","SUPPLIERS","LICENSORS_LICENSEES","GOVERNMENTAL_ENTITIES"]. NEVER set efforts_standard to "ORDINARY_COURSE" or "MATERIAL_RESPECTS" — those are the limb's subject matter, not an effort/strength qualifier.
- If an affirmative limb says "retain all Columbus Franchises, including using commercially reasonable efforts to perform obligations under those Franchises and renew Governmental Authorizations", emit "retain all Columbus Franchises" as the parent obligation and put the perform/renew duties in includedObligations, not as peer positiveObligations.
- Capture any proviso on the chapeau (e.g. "provided that no action ... with respect to matters specifically addressed by any provision of Section 5.2(b) shall be deemed a breach ...") verbatim into a "chapeauProviso" text field.
`;
    } else {
      typeSpecific = `
CRITICAL FEATURE EXTRACTION RULES for IOC:
- "permittedExceptions" is ONLY for text that genuinely begins with one of these markers in the source: "except", "other than", "provided that", "provided, however, that", or "notwithstanding". Do NOT list every sub-clause as an exception. If there are no such carve-outs in the provision, return an empty array []. Each item MUST be a tagged object { code, label, text } where code is drawn from EXCEPTION_CODES (use "OTHER" if no listed code fits).
- PERMITTED-EXCEPTIONS CAUTION: exceptions can come in many shapes. Preserve the actual agreement structure and verbatim text; use OTHER for bespoke exceptions rather than forcing a bad code.
- "mainObligation" should be a one-sentence summary of what the sub-clause actually restricts or requires (e.g., "Target cannot incur indebtedness in excess of $25 million without buyer consent").
- "consentStandard" and "effortsStandard" are TAGGED single objects { code, label, text } drawn from CONSENT_STANDARDS / EFFORTS_STANDARDS respectively (or null if absent).
- "materialityQualifier" — if a materiality qualifier IS present, return a tagged object { code, label, text } drawn from MATERIALITY_CODES; otherwise null. (Treat the legacy boolean form as superseded.)
- "crossReferences" should list other explicit section/article references (e.g. "Section 5.1(a)", "Schedule 4.02").
`;
    }
  } else if (typeKey === 'TERMR' || typeKey === 'TERMR-M' || typeKey === 'TERMR-B' || typeKey === 'TERMR-T') {
    // Build a per-code feature-fields menu so the AI extracts only the
    // fields relevant to whichever TERMR-* code it picks for the sub-clause.
    const termrCodes = [
      'TERMR-MUTUAL', 'TERMR-OUTSIDE', 'TERMR-EXTENSION', 'TERMR-LEGAL',
      'TERMR-VOTE', 'TERMR-BREACH-T', 'TERMR-BREACH-B', 'TERMR-SUPERIOR',
      'TERMR-RECOMMEND',
    ];
    const codeMenu = termrCodes
      .map((c) => {
        const fs = getFeaturesForCode(c).map((f) => f.key).join(', ');
        return `  ${c}: { ${fs} }`;
      })
      .join('\n');
    typeSpecific = `
CRITICAL FEATURE EXTRACTION RULES for ${typeKey}:
- Each sub-clause (a)/(b)/(c)/(d)/etc. of Section 8.01 is ITS OWN termination right and gets its OWN canonical code. Do NOT bundle multiple sub-clauses under one code.
- Map by content: mutual consent → TERMR-MUTUAL; outside-date / drop-dead-date language → TERMR-OUTSIDE; legal-restraint / order / injunction → TERMR-LEGAL; failure to obtain stockholder vote → TERMR-VOTE; target breach uncured → TERMR-BREACH-T; buyer/parent breach uncured → TERMR-BREACH-B; superior-proposal termination by target → TERMR-SUPERIOR; adverse recommendation change → TERMR-RECOMMEND.
- Use TERMR-EXTENSION ONLY if the outside-date extension is a SEPARATE, STANDALONE clause distinct from the outside-date clause (rare — most agreements bundle the extension into the same sub-clause as the outside date, in which case use TERMR-OUTSIDE).

PER-CODE FEATURE FIELDS — once you choose a code for a sub-clause, ONLY extract the fields listed for that code below. Leave irrelevant fields entirely out of the features object. Do NOT include any field that is not listed for the chosen code:
${codeMenu}

Field semantics:
- "partyWhoCanTerminate" — for EVERY TERMR sub-clause, emit a TAGGED object { code, label, text } drawn from TERMINATION_PARTY (PARTY_MUTUAL / PARTY_BUYER / PARTY_TARGET). If BOTH parties can terminate, use PARTY_MUTUAL — do NOT emit "either"; "either" and "mutual" are the SAME concept and PARTY_MUTUAL is canonical. The "text" field captures the verbatim phrase identifying who can terminate. Some codes have a FIXED party that you must always emit: TERMR-MUTUAL → PARTY_MUTUAL; TERMR-BREACH-T → PARTY_BUYER (the buyer is the party who can terminate for a TARGET breach); TERMR-BREACH-B → PARTY_TARGET; TERMR-SUPERIOR → PARTY_TARGET; TERMR-RECOMMEND → PARTY_BUYER.
- "outsideDate" / "outsideDateMonths" / "outsideDateExtension" / "extensionConditions" / "outsideDateExtensionConditions" apply ONLY to TERMR-OUTSIDE. The key "outsideDateExtension" MUST NOT appear on any other TERMR code's features object. If a sub-clause is not TERMR-OUTSIDE, do NOT emit outsideDateExtension at all.
- "outsideDateISO" / "extendedOutsideDateISO" (TERMR-OUTSIDE ONLY): the SAME two dates as "outsideDate" above, but each normalized SEPARATELY to ISO YYYY-MM-DD — do NOT bundle them into one narrative string here (that's what "outsideDate" is for). "outsideDateISO" is the INITIAL outside/drop-dead date (e.g. "March 21, 2026" → "2026-03-21"). "extendedOutsideDateISO" is the date the Outside Date is automatically or electively extended TO, when the clause states one (e.g. "...shall automatically be extended to June 21, 2026" → "2026-06-21"); null when there is no stated extended date. Never invent a date that isn't written in the text.
- "outsideDateMonthsPostSigning" / "extensionMonths" (TERMR-OUTSIDE ONLY): leave these OUT of your response entirely (or null) — they are computed deterministically by a post-pass from outsideDateISO/extendedOutsideDateISO and the deal's signing date, not extracted by you.
- "extensionPeriod" / "tickingFee" apply ONLY to TERMR-EXTENSION (a standalone extension provision).
- "cureDays" / "materialityStandard" apply ONLY to TERMR-BREACH-T / TERMR-BREACH-B.
- "feeRequired" / "executionConditions" apply ONLY to TERMR-SUPERIOR.
- "triggerEvents" / "preVoteOnlyWindow" apply ONLY to TERMR-RECOMMEND.
- "restraintFinality" applies ONLY to TERMR-LEGAL.
- "voteThreshold" applies ONLY to TERMR-VOTE.
- "writtenConsentRequired" / "executionMethod" apply ONLY to TERMR-MUTUAL.
- "faultBasedExclusion" is true if THIS sub-clause contains "...the right to terminate ... shall not be available to a party whose breach caused..." style language.
- "mainConcept" is a one-sentence summary of what THIS specific sub-clause does.

STAGE-1 FIELDS (extract for the listed TERMR codes when supported by the text — leave null otherwise):
- extensionParty (enum PARENT/COMPANY/MUTUAL/NA): Who can elect to extend the outside date. Look for "Parent (only)/Company (only)/either party may extend". Emit PARENT, COMPANY, MUTUAL, or NA.
- extensionMutualOrUnilateral (enum MUTUAL/UNILATERAL_PARENT/UNILATERAL_COMPANY/NA): Whether the extension election is mutual or one-sided. "by mutual agreement" → MUTUAL; "Parent may, in its sole discretion, extend" → UNILATERAL_PARENT.
- extensionMaxExercises (number): Max number of extensions permitted ("up to two extensions of three months each" → 2).
- lawOrderTerminationPresent (boolean): true if there is a termination right tied to a law / order / injunction / legal impediment (e.g. "any Law or Order ... has the effect of permanently restraining"). Pair with lawOrderTerminationScope.
- lawOrderTerminationScope (text): Verbatim scope ("any Governmental Entity has issued a final Order permanently enjoining...").
- finalAndNonappealableRequired (boolean): true if the law/order trigger requires the order to be "final and non-appealable".
- terminationCarveoutForOwnBreach (text): Verbatim carve-out denying termination to a party whose breach caused the failure ("the right to terminate ... shall not be available to a party whose material breach...").
- lostPremiumDamagesPursuit (boolean): true if the agreement explicitly preserves the company's right to pursue damages measured by lost stockholder premium ("damages ... including loss of premium to the stockholders").
- lostPremiumDamagesConditions (text): Verbatim conditions on that right.
- marketOutHolder (enum TARGET/ACQUIRER/BOTH/NA): Which side has a market-out / walkaway right tied to a price collar.
- closingTimingProvisions (text): Verbatim closing-timing language visible on the termination page (month-end kick-out, blackout period, scheduled closing date). Leave null if no special timing language appears here.

PAIRING RULE: NEVER set lawOrderTerminationPresent=true unless lawOrderTerminationScope is also populated, and NEVER fill lawOrderTerminationScope unless lawOrderTerminationPresent=true. Same for lostPremiumDamagesPursuit + lostPremiumDamagesConditions.
`;
  } else if (typeKey === 'NOSOL') {
    typeSpecific = `
CRITICAL FEATURE EXTRACTION RULES for NOSOL:
- "mainConcept" is a one-sentence summary of the substantive concept.
- "noticePeriod" / "matchingPeriod" / "goShopWindow" are numeric durations, but
  the numeric "value" is not enough on its own — the companion quote/text
  MUST state the period's UNITS verbatim, exactly as the source phrases them
  ("four (4) business days", "forty-eight (48) hours", "four Business Days"
  with no numeral at all — capture whichever form the agreement actually
  uses, do not normalize it away). The UI derives the displayed unit from
  this quote text, so a quote that drops the unit words produces a WRONG
  rendered value even when the number itself is right.
  SANITY CHECK: an HOUR-denominated notice period for the Change-of-
  Recommendation / match-period sequence (§5.02's "noticePeriod" on
  NOSOL-MATCH / NOSOL-INTERVENING / NOSOL-REMATCH) is near-nonexistent in
  real merger agreements — the market standard there is 2-5 BUSINESS DAYS.
  Hours-denominated periods DO legitimately occur, but only on the SEPARATE
  initial "notify Parent of an inbound approach" duty (NOSOL-NOTICE /
  discussionInitiationNoticeHours), never on the final match/recommendation-
  change notice. If your first read of a match-period noticePeriod comes out
  in hours, re-read the clause — you have likely conflated it with the
  inbound-notice duty, and the real business-day figure is elsewhere in the
  same section.

THE FIVE KEY DEAL-PROTECTION TERMS (most important for cross-deal comparison):

1. "fiduciaryEngageStandard" — the verbatim phrasing the board must meet to ENGAGE with an unsolicited bid (i.e. to start providing information or negotiating). Typical phrasings vary:
   * "could reasonably be expected to lead to a Superior Proposal"
   * "is reasonably likely to lead to a Superior Proposal"
   * "constitutes or could reasonably be expected to lead to a Superior Proposal"
   Copy the EXACT phrase the board must determine. This is usually distinct from the final-determination standard.

2. "fiduciaryFinalStandard" — the verbatim phrasing for the FINAL determination that allows the board to change recommendation OR terminate to accept the proposal. Typical phrasings:
   * "constitutes a Superior Proposal"
   * "is a Superior Proposal"
   * "would result in a Superior Proposal"
   Copy the EXACT phrase. This is usually a stricter standard than fiduciaryEngageStandard.

3. "noticePeriod" — time period the company must give Parent before changing recommendation (typically 24-48 hours for receipt of a proposal, 3-5 business days before final action).

4. "noticeContent" — verbatim description of what the notice must contain (e.g. "identity of the third party, material terms and conditions, and copies of any written proposals"). Capture the full content requirement.

5. "matchingPeriod" — time period for Parent to match or amend before the company can terminate / change recommendation (typically 3-5 business days).

ADDITIONAL TWO:

6. "interveningEventTermination" — text describing whether the agreement contains an "Intervening Event" provision that lets the board change recommendation for reasons OTHER than a Superior Proposal (typically NO termination right, just recommendation change). Capture: (a) verbatim definition of Intervening Event (or note if no such provision), (b) whether it gives a termination right or only a recommendation-change right, (c) any carve-outs.

7. "forceTheVote" — boolean: true if the company MUST hold the stockholder vote even after an adverse recommendation change. "forceTheVoteDetails" captures the verbatim provision and any exceptions (e.g. termination prior to meeting).

8. "forceTheVoteType" — TAGGED object { code, label, text } coding the force-the-vote (FTV) posture. CODEBOOK (FORCE_THE_VOTE):
${formatDict(FORCE_THE_VOTE)}

   An FTV clause makes the obligation to submit this Agreement to the stockholders SURVIVE an Adverse Recommendation Change (ARC). Only the explicit vote-survives-ARC construction counts. The two phrasings to look for:
   * "Notwithstanding any Adverse Recommendation Change ... the Company shall [nonetheless/still] submit/convene/call and hold ..."
   * "a Change in the [Company] Recommendation shall not limit the Company's obligation to submit this Agreement to the stockholders ... for the purpose of obtaining the ... Stockholder Approval"
   A plain "the Company shall submit this Agreement to its stockholders for approval" covenant with NO ARC-override language is ordinary boilerplate, NOT force-the-vote → FTV_NONE.

   forceTheVoteType codes STRENGTH ONLY. The discriminator is the existence of a SELF-TERMINATION RIGHT FOR A SUPERIOR PROPOSAL held by the OBLIGATED party (a right for that party itself to terminate this Agreement pre-vote to enter an Alternative Acquisition Agreement, paying the termination fee — usually in the termination article, often cross-referenced from this section). It is NOT whether the board may change its recommendation: both hard and soft FTV permit an ARC.
   * FTV_SOFT — the vote-survives-ARC covenant coexists with such a self-termination right for the obligated party. Signals: "unless this Agreement has been validly terminated in accordance with its terms" qualifying the vote covenant; a right to terminate to accept a Superior Proposal (see companyTerminationForSuperior). If companyTerminationForSuperior is true for the obligated party, forceTheVoteType MUST NOT be FTV_HARD.
   * FTV_HARD — the vote-survives-ARC covenant exists AND the obligated party has NO self-termination right to accept a Superior Proposal anywhere in the agreement: the board may flip its recommendation, but that party can never escape the vote by terminating for a competing deal. NOTE: a termination right held by the COUNTERPARTY (the other side may walk away if this party changes its recommendation) does NOT make it soft — only a self-termination right held by the OBLIGATED party does.
   * FTV_NONE — no vote-survives-ARC covenant at all (even if a self-termination-for-Superior-Proposal right exists — an ordinary superior-proposal-out without FTV language is FTV_NONE).

   PARTY IS NOT ENCODED IN THIS CODE. Whose vote is force-locked rides the provision's party scope, surfaced via the appliesToParty tag (PARTY_COMPANY / PARTY_PARENT / PARTY_MUTUAL) on the same NOSOL row. In a normal acquisition the obligated party is the target ("the Company shall ... hold the Company Stockholders' Meeting" → appliesToParty = PARTY_COMPANY). In a reverse merger the forced meeting may be the acquirer/issuer's own (e.g. "PubCo's" stockholders → PARTY_PARENT) even though the drafting calls that entity "the Company" — follow the substance. If BOTH parties are force-voted (dual-approval / merger of equals), emit a SEPARATE force-the-vote row per party, each with its own forceTheVoteType strength and appliesToParty — do NOT try to merge two postures into one code.
   "text" = the verbatim FTV clause for FTV_HARD / FTV_SOFT; for FTV_NONE leave the whole field null rather than tagging boilerplate. Consistency: forceTheVote (boolean) true ⇔ forceTheVoteType is FTV_HARD or FTV_SOFT.

VERBATIM RULE: The "text" field on EVERY provision returned MUST be copied character-for-character from the source paragraph, including ALL parentheticals, qualifiers, and footnotes. Do NOT summarize, paraphrase, or drop parentheticals (e.g. "(which consent shall not be unreasonably withheld)"). Capture full sentences — the user wants 100% text coverage so EVERY clause of the no-solicit section MUST be represented in at least one provision's "text".

STAGE-1 FIELDS (extract when supported by the text — leave null otherwise):
- goShopPresent (boolean): true if there is an active solicitation / "Go-Shop" window after signing.
- goShopPeriodDays (number): Length of the go-shop window in calendar days ("for a period of 30 days after the date hereof" → 30).
- goShopExcludedParties (list): Named bidders excluded from the go-shop (e.g. "Excluded Parties").
- extendedNegotiatingPeriodDays (number): Extended negotiating window for Excluded Parties / Qualifying Bidders.
- standstillWaiverPermitted (boolean): true if the company may waive an existing standstill to allow a competing bid. standstillWaiverConditions = verbatim conditions.
- antiClubbingWaiverPermitted (boolean): true if anti-clubbing / no-grouping restrictions may be waived. antiClubbingWaiverConditions = verbatim conditions.
- infoRequiredBidderIdentity (boolean): true if notice to Parent must disclose the third-party bidder's identity.
- infoRequiredCommunicationsDrafts (boolean): true if notice must share copies of communications / drafts with Parent.
- infoRequiredFinancingPapers (boolean): true if notice must share financing papers / commitment letters.
- boardChangeForInterveningEvent (boolean): true if the board may change recommendation in response to an Intervening Event (not just Superior Proposal).
- interveningEventDefinition (text): Verbatim definition of "Intervening Event".
- boardChangeForSuperiorProposal (boolean): true if board may change recommendation in response to a Superior Proposal.
- boardChangeStandard (enum INCONSISTENT_FIDUCIARY/BREACH_FIDUCIARY/REASONABLY_LIKELY_BREACH): The fiduciary standard the board must meet. "inconsistent with the directors' fiduciary duties" → INCONSISTENT_FIDUCIARY; "would constitute a breach of" → BREACH_FIDUCIARY; "reasonably likely to be a breach" → REASONABLY_LIKELY_BREACH.
- companyTerminationForSuperior (boolean): true if the company may terminate to accept a Superior Proposal. companyTerminationForSuperiorConditions = verbatim conditions ("simultaneous payment of the Company Termination Fee, compliance with Section X.XX").
- representativeBreachIsCompanyBreach (boolean): true if breach by a Representative is treated as company breach. representativeBreachConditions = verbatim text.
- representativesStandard (enum CAUSE_NOT_TO/RBE_NOT_TO/INSTRUCT_NOT_TO/NA): How the company must control Representatives. "shall cause its Representatives not to" → CAUSE_NOT_TO; "use reasonable best efforts to cause" → RBE_NOT_TO; "instruct its Representatives not to" → INSTRUCT_NOT_TO.
- initialMatchPeriodDays (number): Initial Parent match window in BUSINESS days ("four (4) Business Days" → 4).
- subsequentMatchPeriodDays (number): Subsequent match window after material amendment ("three (3) Business Days" → 3).
- parentTerminationRightForNonsolicitBreach (enum ALL_BREACHES/MATERIAL_WILLFUL_ONLY/WILLFUL_ONLY/NONE): What kind of nonsolicit breach gives Parent a termination right.
- acquisitionTransactionPctThreshold (percentage): % of equity/assets in the Acquisition Proposal definition (e.g. "20% or more of the consolidated assets" → "20%").
- acquisitionTransactionDefinition (text): Verbatim "Acquisition Proposal" / "Acquisition Transaction" definition.
- acceptableConfidentialityAgreementDefinition (text): Verbatim "Acceptable Confidentiality Agreement" definition (or similarly named term) — typically lists the required terms: at least as restrictive as the existing NDA, standstill provisions, etc. Leave null if no such defined term appears.

P3 STAGE FIELDS — cease-discussions / change-of-rec framework / key definitions:
- ceaseDiscussionsProhibitedList (list): Prohibited acts during the cease-discussions period (e.g. "solicit", "initiate", "knowingly facilitate or encourage", "engage in discussions").
- ceaseDiscussionsAffiliateStandard (text): Standard applied to affiliates / representatives. Verbatim. Examples: "shall, and shall cause its Subsidiaries to" / "shall cause its Representatives not to" / "shall instruct its Representatives not to".
- ceaseDiscussionsLiability (text): Liability language for representative breach (e.g. "any breach by any Representative ... shall be deemed a breach by the Company").
- ceaseDiscussionsExceptions (list): Exceptions (e.g. "may inform third parties that this Agreement exists", "informational responses to unsolicited inquiries").
- changeOfRecommendationItems (list): What constitutes a Change of Recommendation (verbatim items from the enumeration).
- notChangeOfRecommendationItems (list): What does NOT constitute a Change of Recommendation (verbatim items from the carve-out enumeration).
- engagementStandard (text): VERBATIM standard the board must meet to engage (typically anchor phrase: "could reasonably be expected to lead to a Superior Proposal").
- changeRecStandard (text): VERBATIM standard for actually changing the recommendation (typically anchor phrase: "would be inconsistent with the directors' fiduciary duties").
- materialImprovementStandard (text): What counts as a "material" improvement that re-triggers the match period.
- interveningEventScope (enum POSITIVE_ONLY/BOTH/NA): POSITIVE_ONLY if the Intervening Event definition excludes Acquisition Proposal events (anchor: "Intervening Event shall not include any event ... arising from or related to ... Acquisition Proposal"). BOTH if it covers both positive and negative events. NA if no intervening-event provision.
- superiorProposalThresholdPct (percentage): Threshold % in the Superior Proposal definition (often differs from Acquisition Proposal threshold).
- superiorProposalTest (text): Verbatim Superior Proposal test factors (anchor: "more favorable from a financial point of view to the Company's stockholders").
- superiorProposalDeterminer (text): Who determines a Superior Proposal — e.g. "Board only", "Board after consultation with financial advisor and outside counsel".

VERBATIM ANCHOR PHRASES (NOSOL):
  * "shall, and shall cause its Subsidiaries to ... immediately cease" → ceaseDiscussionsAffiliateStandard.
  * "any breach by any Representative ... shall be deemed a breach by the Company" → ceaseDiscussionsLiability.
  * "could reasonably be expected to lead to a Superior Proposal" → engagementStandard.
  * "would be inconsistent with the directors' fiduciary duties" → changeRecStandard.
  * "more favorable from a financial point of view to the Company's stockholders" → superiorProposalTest (and capture the threshold % into superiorProposalThresholdPct).
  * "Intervening Event shall not include any event ... arising from or related to ... Acquisition Proposal" → interveningEventScope = POSITIVE_ONLY.

PAIRING RULE: Never set a *Permitted boolean true without filling its companion *Conditions text (and vice versa). Never set boardChangeForInterveningEvent=true without filling interveningEventDefinition.

P7 item 11 — DISTINGUISH ceaseDiscussionsAffiliateStandard FROM ceaseDiscussionsLiability:
These are TWO INDEPENDENT fields. A deal can have both, one, or neither — populate each separately when the matching language is present.
  * Anchors for ceaseDiscussionsLiability (the LIABILITY rule for Representative breach):
      - "any violation of the restrictions ... by any Representative ... shall be a breach ... by the Company"
      - "any breach by any Representative ... shall be deemed a breach"
  * Anchors for ceaseDiscussionsAffiliateStandard (the AFFIRMATIVE rep-control directive):
      - "shall cause its Representatives"
      - "shall use [efforts standard] to cause"
      - "shall instruct"
  These two anchors describe orthogonal duties — do NOT collapse them.

P7 item 12 — Discussion-Initiation Notice + No-Conflicting-Agreements:
  * discussionInitiationNoticePresent (boolean) + discussionInitiationNoticeHours (number) + discussionInitiationNoticeText (text): set when the section contains a separate inbound-contact notification (typically "within 24 hours" / "within 48 hours" of any third-party Acquisition Proposal contact). This is SEPARATE from the match-period notice — the latter runs BEFORE Parent has a chance to match; this is just the initial heads-up.
  * noConflictingAgreementsPresent (boolean) + noConflictingAgreementsScope (text): set when the section contains a no-conflicting-agreements duty ("shall not enter into any agreement that would conflict with or prevent the consummation of the transactions" / "shall not enter into any letter of intent, agreement in principle, or other arrangement ...").

P7 item 13 — Information-Sharing / Equal-Information obligation:
  * informationSharingObligationPresent (boolean) + informationSharingObligationScope (text) + informationSharingObligationTiming (text): set when the section requires the Company to PROMPTLY share inbound third-party information / non-public information / proposals with the existing Buyer (so Buyer has equal information). Distinct from match-period notice — this is an ongoing duty across all inbound communications.

P7 item 14 — Adverse Recommendation Change (ARC) full enumeration:
  * changeOfRecommendationItems (list) — enumerate items A-E typically found in 5.02(e): (A) withdraw/modify the Recommendation, (B) approve/recommend any Acquisition Proposal, (C) fail to include the Recommendation in the proxy, (D) fail to publicly recommend AGAINST any Acquisition Proposal within X days, (E) approve/recommend any letter of intent / acquisition agreement. Extract each as its own verbatim list item.
  * arcReaffirmDeadlineDays (number) — for the (D) sub-item: the deadline (business days) within which the board must publicly recommend AGAINST the third-party Acquisition Proposal (often 10 business days). Extract just the number.

P7 item 16 — Tender-Offer Rules Compliance / Safe-Disclosure Carve-out:
  * tenderOfferDisclosurePermitted (boolean) + tenderOfferDisclosureScope (text): set when there is an explicit carve-out permitting the Company to comply with Rule 14d-9 / 14e-2 (the "stop, look and listen" communication) without triggering an ARC.
  * legallyRequiredDisclosurePermitted (boolean) + safeDisclosureCarveoutLanguage (text): set when there's a broader "legally required disclosure" carve-out (often: "shall not be deemed to be an Adverse Recommendation Change" attached to required SEC / tender-offer / fiduciary disclosures).
  * notChangeOfRecommendationItems (list): when a general override provision says conduct is not an Adverse Recommendation Change, preserve EACH carve-out as its own verbatim item, including (1) Rule 14d-9 / Rule 14e-2 disclosure, (2) disclosure required by applicable Law, and (3) disclosure that describes receipt of a proposal / operation of the agreement while reaffirming the recommendation.
`;
  } else if (typeKey === 'ANTI') {
    // Build a per-code feature-fields menu so the AI extracts only the
    // fields relevant to whichever ANTI-* code it picks for a provision.
    const antiCodes = [
      'ANTI-FILING', 'ANTI-EFFORTS', 'ANTI-COOPERATE', 'ANTI-INFO',
      'ANTI-BURDEN', 'ANTI-NOACTION', 'ANTI-FOREIGN', 'ANTI-INTERIM',
      'ANTI-NOTIFY', 'ANTI-LITIGATION', 'ANTI-CONSULT', 'ANTI-TIMING',
    ];
    const codeMenu = antiCodes
      .map((c) => {
        const fs = getFeaturesForCode(c).map((f) => f.key).join(', ');
        return `  ${c}: { ${fs} }`;
      })
      .join('\n');
    typeSpecific = `
CRITICAL FEATURE EXTRACTION RULES for ANTI:

The efforts adjective alone does NOT determine the burden level — the cap frequently lives inside the defined efforts term ('reasonable best efforts shall include/shall not require…'); classify burdenCommitment from the substantive limitation language, wherever it sits.

Facially-HOHW language may be capped by a remote proviso — check for provisos before EXPRESS_HOHW; SILENT_NO_CAP only when no limitation language exists anywhere in the efforts/remedies provisions.

PER-CODE FEATURE FIELDS — once you pick a code for a provision, ONLY extract the fields listed for that code below. Leave irrelevant fields out of the features object:
${codeMenu}

ANTI CANONICAL CODEBOOKS:
BURDEN_COMMITMENT:
${formatDict(BURDEN_COMMITMENT)}

BURDEN_BASELINE:
${formatDict(BURDEN_BASELINE)}

LITIGATION_OBLIGATION:
${formatDict(LITIGATION_OBLIGATION)}

CLEAR_SKIES_FAMILY and scope modifiers:
${formatDict(CLEAR_SKIES_FAMILY)}

ANTITRUST_CONTROL:
${formatDict(ANTITRUST_CONTROL)}

CONSULTATION_TIER:
${formatDict(CONSULTATION_TIER)}

PULL_REFILE:
${formatDict(PULL_REFILE)}

TIMING_AGREEMENT:
${formatDict(TIMING_AGREEMENT)}

Field semantics:
- "mainConcept" is a one-sentence summary of THIS specific provision.

- "effortsStandard" — return ONLY the canonical short efforts label. Emit a TAGGED object { code, label, text } drawn from EFFORTS_STANDARDS, where:
    * "code" is the EFFORTS_STANDARDS code (e.g. REASONABLE_BEST_EFFORTS).
    * "label" is the canonical short label from the dictionary (e.g. "Reasonable best efforts").
    * "text" is JUST the quoted standard phrase from the agreement (e.g. "reasonable best efforts"), NOT the surrounding obligation language.
  Return only the canonical efforts code and the short quoted phrase, not the surrounding obligation language (do NOT include "Each of the parties shall use ... to consummate ..." framing). If no efforts standard is stated, return null.

- "burdenCommitment" — TAGGED object { code, label, text } drawn from BURDEN_COMMITMENT. Classify from substantive limitation language wherever it appears, including inside a defined efforts term or later proviso. Use:
    * ANTI_HOHW when the agreement expressly says there is no obligation to divest/remedy or litigate.
    * NO_LITIGATION_ONLY when only litigation is expressly disclaimed.
    * CAPPED_QUANTITATIVE for revenue, EBITDA, units, NPV, dollar, formula, percentage, or other numeric remedy caps.
    * BURDENSOME_CONDITION for MAE-style or "Burdensome Condition" remedy caps.
    * PRECEDENT_COMPARABILITY for precedent-deal / consent-decree comparability caps.
    * BUYER_DISCRETION for subjective buyer-discretion caps.
    * NAMED_ASSET_CARVEOUT only as a modifier when named assets are carved in/out.
    * EXPRESS_HOHW only after checking the whole efforts/remedies section for limiting provisos.
    * SILENT_NO_CAP only when no limitation language exists anywhere in the efforts/remedies provisions.
- "capDetail" — verbatim text of the cap, proviso, formula, named-asset carveout, or "no obligation" limitation. Null only when burdenCommitment is SILENT_NO_CAP and there is no cap text.
- "burdenBaseline" — TAGGED object { code, label, text } drawn from BURDEN_BASELINE when the cap measures the burden against target-only, buyer-only, combined entity, buyer-sized target, synergies, or a de minimis floor. Null if the text does not specify a baseline.

- "filingDeadline" (ANTI-FILING) — short text describing the deadline for making HSR / regulatory filings, e.g. "Within 15 business days of signing" or "Within 30 days of signing". Do NOT return the entire filing paragraph — only the deadline statement. For ANTI-FILING, "mainConcept" should ALSO be the short deadline statement (e.g. "HSR filing within 15 business days of signing"), not the whole filing obligation text.
- "hsrFilingDeadline" — object { days, unit, text } for the HSR initial filing deadline only. "days" is numeric when a count exists; "unit" is "Business Days", "days", "promptly", or the exact standard used; "text" is verbatim deadline language.
- "exHsrFilingDeadline" — object { standard, jurisdictions, text } for non-HSR filings only. "standard" is the timing standard ("as promptly as practicable", fixed day count, "identify and agree", etc.); "jurisdictions" is an array of named jurisdictions/regimes if stated; "text" is verbatim. Keep this separate from hsrFilingDeadline even when the same sentence covers both.

- "appliesToParty" (ANTI-NOACTION) — identify which party the no-inconsistent-action prohibition applies to. Return a TAGGED object { code, label, text } drawn from APPLIES_TO_PARTY:
    * PARTY_PARENT — the prohibition binds Parent / Buyer only.
    * PARTY_COMPANY — the prohibition binds the Company / Target only.
    * PARTY_MUTUAL — the prohibition is mutual (binds both parties).
  Look for textual cues: "Parent shall not", "the Company shall not", "Neither party shall", "Each party shall not", etc. The "text" field MUST be the verbatim phrase that identifies the bound party. When the provision's code is ANTI-NOACTION (or its category text contains "no inconsistent action" / "no impediment"), you MUST populate appliesToParty — identify which party this prohibition applies to: Parent/Buyer, Company/Target, or both.

- "hellOrHighWater" (ANTI-BURDEN) — true ONLY if there is NO cap on required divestitures or remedies.
- "divestitureCap" / "divestitureCapDescription" / "burdenCap" (ANTI-BURDEN) — any dollar/revenue cap, qualitative limit, or carve-out on required remedies. "burdenCap" captures qualitative limits (e.g. "not materially adverse to the business of Parent and its Subsidiaries, taken as a whole"); "divestitureCap" captures numeric caps.
- "litigationObligation" — TAGGED object { code, label, text } drawn from LITIGATION_OBLIGATION. Use MANDATORY_DEFEND for must-defend language including appeals/final judgment, RIGHT_NOT_OBLIGATION for elective offense or mandatory defense, MERITS_GATED for obligations gated by counsel/merits likelihood, TIME_BOUNDED for obligations ending at an outside date or other deadline, EXPRESS_NONE for express no-litigation obligation, and SILENT when the provision says nothing about litigating regulators.
- "litigationObligationQualification" — verbatim qualification text for merits gates, time bounds, final-judgment/appeal scope, or elective-vs-mandatory split. Null for unqualified SILENT.

- "controllingParty" (ANTI-COOPERATE) — examine the text for language like "Parent shall direct", "Parent shall control", "subject to the direction of Parent", "Company shall direct", or "jointly determine". If the agreement assigns control to Parent/Buyer, return CONTROL_PARENT with the exact text. If to Company/Target, CONTROL_COMPANY. If shared/joint, CONTROL_SHARED. If the cooperation provisions do not specify who controls strategy, return CONTROL_SILENT — this is meaningful information for cross-deal comparison. Return a TAGGED object { code, label, text } drawn from ANTITRUST_CONTROL, where "text" is the verbatim phrase that identifies the controlling party (or null when CONTROL_SILENT).
- "regulatoryStrategyControlTagged" — same concept as controllingParty, but use the expanded ANTITRUST_CONTROL dictionary when the clause fits BUYER_WITH_SETTLEMENT_GAG, BUYER_LEAD, PRINCIPAL_WITH_VETO, JURISDICTION_SPLIT, or SELLER_LED. Keep "controllingParty" populated for backward compatibility when possible.
- "consultationTier" — TAGGED object from CONSULTATION_TIER. Anchor on notice/consult, good-faith views, comment incorporation, opportunity to participate, and consent formulations.
- "clearSkies" — object with optional "company" and "parent" entries. Each party entry is { family, modifiers, text }, where "family" is RESTRAINT_IN_EFFECT or SUIT_SEEKING from CLEAR_SKIES_FAMILY, "modifiers" is an array of CLEAR_SKIES_FAMILY modifier codes (AGENCIES_NAMED, US_EU, SCHEDULED_JURISDICTIONS, ANY_AUTHORITY, THREATENED_INCLUDED, MATERIALITY_GATED, ANTI_DOUBLE_COUNT_CARVEOUT), and "text" is verbatim. Also keep legacy clearSkiesCompany/clearSkiesCompanyScope/clearSkiesParent/clearSkiesParentScope when supported.

STAGE-1 FIELDS (extract when supported by text — leave null otherwise):
- regulatoryStrategyControl (enum PARENT_CONTROL/COMPANY_CONTROL/JOINT/NA): Same concept as controllingParty in enum form — populate based on who directs strategy.
- hsrFilingDeadlineBusinessDays (number): HSR filing deadline in BUSINESS days ("within ten (10) Business Days following the date of this Agreement" → 10).
- otherRegulatoryFilingDeadlines (text): Non-HSR filing deadlines (CFIUS, EU merger control, China SAMR, etc.) — short verbatim list.
- substantialComplianceDeadlineDays (number): Days within which to certify substantial compliance with a Second Request.
- pullAndRefileCompanyConsent (boolean): true if Parent must obtain Company consent to pull-and-refile its HSR.
- pullRefile — TAGGED object from PULL_REFILE. No numeric-count field exists in the clause bank; do not invent one.
- pullRefileText — verbatim pull-and-refile gating text.
- timingAgreementsProhibited (boolean): true if the agreement bars entering timing agreements with regulators without Company consent.
- timingAgreement — TAGGED object from TIMING_AGREEMENT.
- timingAgreementText — verbatim timing-agreement / waiting-period / delay-agreement text.
- clearSkiesCompany (boolean): true if Company makes a "no significant antitrust concerns expected" / clear-skies covenant. clearSkiesCompanyScope = verbatim scope/limit text.
- clearSkiesParent (boolean): true if Parent makes the equivalent clear-skies covenant. clearSkiesParentScope = verbatim text.
- effortsStandardDiffersByRemedy (boolean): true if a different efforts standard applies depending on remedy type.
- parentLitigationObligation (boolean): true if Parent must litigate against regulators / contest Government Orders to obtain clearance.
- burdensomeConditionInTerminationTriggers (text): If "Burdensome Condition" (or similar) is a termination trigger, describe what it is — e.g. "any divestiture or behavioral remedy reasonably likely to result in material adverse effect on the combined business".
- regulatoryClosingConditions (text): Concise list of the required regulatory filings/clearances for closing (e.g. "HSR Act; UK CMA; EC merger control; FDI in France & Germany").
- springingRegulatoryConditions (text): Springing regulatory conditions only triggered if a filing is required (e.g. "UK CMA approval only if turnover thresholds met").
- regulatoryCooperationScope (text): Verbatim ≤2-sentence scope of the regulatory information / cooperation covenant.
- regulatoryCooperationCarveout (text): Carveout text saying breach of the regulatory cooperation covenant is NOT a closing condition.

COVERAGE REMINDER (CRITICAL — you will be checked on these):
Every ANTI provision should be scanned for EACH of these Paul-Weiss diligence fields. If the source clearly supports a value, you MUST populate it — skipping a clearly-supported field is an extraction error. Don't be lazy:
  * hsrFilingDeadlineBusinessDays — search for "within X Business Days" near "HSR" / "filings".
  * hsrFilingDeadline and exHsrFilingDeadline — keep HSR and non-HSR filing timing as separate fields.
  * substantialComplianceDeadlineDays — search for "substantial compliance" + day-count.
  * clearSkiesCompany + clearSkiesCompanyScope — search for "no significant antitrust", "no Burdensome Condition would reasonably be expected".
  * clearSkiesParent + clearSkiesParentScope — same on the Parent side.
  * parentLitigationObligation — search for "shall contest", "shall defend", "litigate".
  * burdensomeConditionPresent + burdensomeConditionScope — flag a "Burdensome Condition" trigger / closing condition; scope = PARENT_ONLY / MUTUAL / NA.
  * regulatoryClosingConditions — list jurisdictions (HSR, CMA, EC, CFIUS, SAMR, etc.).
  * springingRegulatoryConditions — only-if-triggered conditions.

VERBATIM ANCHOR PHRASES — if you see X, you MUST emit Y. Don't leave the field null when an anchor phrase is present:
  * "pull and refile" / "withdraw and refile" PAIRED WITH "consent of the other party" / "consent of the Company"
    → pullAndRefileCompanyConsent = TRUE and pullRefile = SELLER_CONSENT_GATED or MUTUAL_CONSENT as applicable. Example: "the parties agree not to ... pull and refile any filing made under the HSR Act ... except with the prior written consent of the other party".
  * "Parent may" / "Buyer may" pull and refile in its good faith judgment
    → pullRefile = BUYER_UNILATERAL_GF.
  * "agree not to extend ... any waiting period" / "enter into any agreement with a Governmental Entity to delay" / "agreement with a Governmental Entity ... not to consummate"
    → timingAgreementsProhibited = TRUE and timingAgreement tagged from TIMING_AGREEMENT. Example: "the parties agree not to (A) extend, directly or indirectly, any waiting period under the HSR Act ... or enter into any agreement with a Governmental Entity to delay ... or (B) pull and refile".
  * Company / Subsidiaries restricted from "acquisitions" / "mergers" / "business combinations" / "new product lines" with phrasing "prevent or materially delay" or "make materially more difficult the satisfaction of the conditions"
    → clearSkiesCompany = TRUE; clearSkiesCompanyScope = verbatim sentence.
  * Same anchor with Parent / Parent's affiliates as the bound party
    → clearSkiesParent = TRUE; clearSkiesParentScope = verbatim sentence. Example: "Parent shall not, and shall cause its affiliates not to, effect or agree to any business combination ... that would reasonably be expected to prevent or materially delay the consummation".
  * "consult in advance with, and consider in good faith the views of" / "afford the other party a reasonable opportunity to review and comment"
    → regulatoryCooperationScope = verbatim sentence.
  * "Nothing in this Section ... will apply to or restrict communications or other actions ... with respect to Governmental Entities in connection with their respective businesses in the ordinary course of business"
    → regulatoryCooperationCarveout = verbatim sentence.

PAIRING RULE: Never set clearSkies*=true without filling the companion Scope text, and vice versa.
`;
  } else if (typeKey && typeKey.startsWith('COND')) {
    typeSpecific = `
CRITICAL FEATURE EXTRACTION RULES for ${typeKey}:

SUB-CLAUSE SPLITTING (this rule supersedes any tendency to summarize the whole conditions section as one provision):

  STOP. Before extracting, COUNT the sub-clauses in the section text. A typical conditions section reads "The obligation of [Party] to effect the Closing is subject to the satisfaction or waiver of the following conditions: (a) ... ; (b) ... ; (c) ...". Each "(a)", "(b)", "(c)" is a SEPARATE closing condition. You MUST emit ONE PROVISION FOR EACH SUB-CLAUSE you find. If the section has 3 sub-clauses, the output array MUST contain 3 provisions. If it has 4, the output array MUST contain 4. Do not collapse them.

  Per-party canonical code map (use these EXACT codes — do not invent new ones):

    Mutual conditions article (e.g. Section 6.1 / 7.01 "Conditions to Obligation of Each Party"):
      sub-clause (a) stockholder vote / shareholder approval → COND-M-STOCKHOLDER
      sub-clause (b) no legal restraints / injunctions / orders / no enacted laws → COND-M-LEGAL
      sub-clause (c) regulatory approvals / HSR clearance / waiting periods expired → COND-M-REG
      additional sub-clauses for S-4 effectiveness / listing → COND-M-S4 / COND-M-LISTING

    Buyer conditions article (e.g. Section 6.3 / 7.02 "Conditions to Obligations of Parent and Merger Sub"):
      sub-clause (a) representations of the Company are true (bring-down) → COND-B-REP
      sub-clause (b) Company has performed covenants in all material respects → COND-B-COV
      sub-clause for absence of Material Adverse Effect (standalone, not folded into rep bring-down) → COND-B-MAE
      sub-clause for Company officer's closing certificate confirming (a) and (b) → COND-B-CERT
      sub-clause for dissenting-shares cap → COND-B-DISSENT

    Target / Company conditions article (e.g. Section 6.2 / 7.03 "Conditions to Obligation of the Company"):
      sub-clause (a) representations of Parent / Merger Sub are true (bring-down) → COND-S-REP
      sub-clause (b) Parent / Merger Sub has performed covenants in all material respects → COND-S-COV
      sub-clause for Parent officer's closing certificate confirming (a) and (b) → COND-S-CERT
      sub-clause for available funds → COND-S-FUNDS (only if explicitly a condition)

  TENDER-OFFER / "ANNEX I — CONDITIONS TO THE OFFER" (two-step tender-offer deals): the offer conditions do NOT follow the one-step "(a) reps (b) covenants (c) cert" pattern — they are a flat list of distinct conditions. Do NOT default them all to COND-B-REP. Classify EACH offer condition by its CONTENT using these codes AND set an accurate, content-specific category (the canonical conditions table matches on category):
    * "validly tendered (and not validly withdrawn) … at least [a majority / the minimum number of] Shares" → code COND-B-REP is WRONG; use code COND-M-STOCKHOLDER and category "Minimum Tender Condition", and set tenderOfferMinimumCondition to the verbatim mechanic (fully-diluted vs outstanding; guaranteed-delivery treatment).
    * "any applicable waiting period under the HSR Act … has expired or been terminated" / other regulatory approvals → code COND-M-REG, category "Regulatory Approvals".
    * "no order, injunction or decree … no court of competent jurisdiction … has issued / no Law makes illegal" → code COND-M-LEGAL, category "No Legal Impediment".
    * "since the date of the Agreement, there has occurred any … Material Adverse Effect" → code COND-B-MAE, category "No Target MAE".
    * "the Company has breached or failed to comply … representations/covenants" (accuracy/performance offer condition) → code COND-B-REP (accuracy) or COND-B-COV (covenant performance), category accordingly.
    * "the Company has not delivered … a certificate" (officer's certificate offer condition) → code COND-B-CERT, category "Officer's Certificate (Target)".
    * "the Agreement has [not] been terminated pursuant to its terms" → code COND-B-REP is WRONG; use category "No Termination of Agreement" (keep the COND-B family code closest in meaning, or leave code null) — do NOT mislabel it "Accuracy of Target Reps".
  Each Annex I offer condition is its OWN provision. Use the COND-M-* codes for the mutual-flavoured offer conditions (minimum tender, legal, regulatory) so they render under the Mutual section.

  COND-B-COV / COND-S-COV are the MOST COMMONLY MISSED sub-clauses. The anchor phrase is some variant of: "the Company shall have performed and complied in all material respects with all covenants, agreements, and obligations required to be performed by it on or prior to the Closing Date" — or the mirror version for Parent / Merger Sub. If you see that anchor in a sub-clause, emit it as its own COND-B-COV (or COND-S-COV) provision, separate from the rep bring-down.

  COND-B-CERT / COND-S-CERT anchor: "a certificate signed by an executive officer of the Company [or Parent] to the effect set forth in clauses (a) and (b) above". Emit as its own provision.

  Example: Section 6.3 reads "(a) Each of the representations and warranties of the Company set forth in Article III shall be true and correct ...; (b) The Company shall have performed and complied in all material respects with all covenants ...; (c) Parent shall have received a certificate signed by an executive officer of the Company ...". You MUST emit THREE provisions: COND-B-REP for (a), COND-B-COV for (b), COND-B-CERT for (c). Do NOT emit one COND-B-REP that summarises all three.
- "mainCondition" is a one-sentence summary of what must be satisfied for closing — UNIQUE TO THIS SUB-CLAUSE, not the whole conditions article.
- "bringDownTiers" is an ARRAY of tier objects. Real merger agreement bring-downs are TIERED — extract EACH tier separately.
    * Example tiers found in a typical agreement:
        - Fundamental reps (e.g. Organization, Authority, Brokers) → standard "MAT_ALL_RESPECTS" (true in all respects, no de minimis).
        - Other capitalization reps → standard "MAT_ALL_RESPECTS_DE_MINIMIS" (true except for de minimis inaccuracies).
        - No-MAE rep → standard "MAT_ALL_RESPECTS".
        - All other (general) reps → standard "MAT_MAE_QUALIFIED" (true except where failure would not have an MAE).
    * Each tier object MUST have: "reps_covered" (free text describing which reps — cite specific sections if possible), "standard" (a code from MATERIALITY_CODES), "standard_label" (the human label for that code). "exceptions" is OPTIONAL free text for any tier-specific qualifier.
    * If the bring-down is UNIFORM (no tiering), return a single-element array describing the one standard that applies to all reps.

STAGE-1 FIELDS for COND family (extract when supported by text — leave null otherwise):
- burdensomeConditionPresent (boolean): true if there is a "Burdensome Condition" closing condition allowing Parent to refuse closing when a remedy crosses the burden cap.
- burdensomeConditionScope (enum PARENT_ONLY/MUTUAL/NA): Whose obligation the burdensome condition relieves.
- mutualClosingDeadlineAfterConditionsDays (number): Days after all conditions are satisfied within which the parties must close ("the second Business Day following the satisfaction of the conditions" → 2).
- closingTimingProvisions (text): Verbatim text describing month-end kick-outs, blackout periods, or other timing mechanics.
- governmentProceedingConditionPresent (boolean): true if the absence of a pending governmental proceeding seeking to restrain the merger is a closing condition.
- absenceOfEnjoiningOrderPresent (boolean): true if there is an absence-of-enjoining-order condition. absenceOfEnjoiningOrderDetails = verbatim language ("no Order ... shall be in effect that ... enjoins ...").
- tenderOfferMinimumCondition (text): Tender-offer minimum-condition mechanics (fully-diluted vs outstanding; whether shares tendered by guaranteed delivery count).
- stockholderApprovalRequired (boolean): true if stockholder approval (Company or Parent) is an explicit closing condition (not buried in another rep).
- regulatoryApprovals (text): Concise list of required regulatory approvals at closing — agencies and jurisdictions (e.g. "HSR Act; UK CMA; EC merger control; CFIUS").
- hsrClearance (boolean): true if HSR Act clearance / expiration of waiting period is an explicit closing condition.
- continuingRequirement (boolean, COND-B-MAE / the No-MAE closing condition ONLY): true when the No-MAE condition requires the MAE to be CONTINUING at the measurement point, not merely to have occurred at some point since signing. Anchor: "there shall not have occurred any Company Material Adverse Effect that is continuing" / "... that has occurred and is continuing". This is a distinct, negotiated qualifier — plenty of No-MAE conditions do NOT have it ("there shall not have occurred any Company Material Adverse Effect" with no "continuing" language) — leave false (not null) when the condition is silent on continuation, so the field is always populated on this code.
- antitrustApprovals (list-tagged from ANTITRUST_APPROVAL_CODES, COND-M-REG / the Antitrust closing condition ONLY): the antitrust condition bundles TWO conceptually separate approvals — emit them as TWO SEPARATE tagged items (never one merged item), one per approval type actually present:
    * HSR — the HSR Act waiting-period expiration/termination limb. "text" is the verbatim HSR clause; do NOT include a Section/Schedule cite in "label" (put any cite ONLY in "text" — same discipline as TERMF trigger labels).
    * SCHEDULED_APPROVALS — any OTHER regulatory approvals/clearances the parties scheduled (typically "as set forth in Section X.XX of the Company Disclosure Letter"). "text" is the verbatim clause INCLUDING the schedule cite; "label" itself must stay a plain-English one-liner with no cite.
  Emit only the items genuinely present — if the condition is HSR-only, return a single-element array.

PAIRING RULE: Never set absenceOfEnjoiningOrderPresent=true without filling absenceOfEnjoiningOrderDetails.
`;
  } else if (typeKey === 'TERMF') {
    // TERMF is a multi-code section like NOSOL/ANTI — Section 8.02 of a typical
    // merger agreement bundles SEVERAL distinct fee provisions (company fee,
    // reverse fee, expense reimbursement, tail, effect of termination, sole
    // and exclusive remedy). The AI returns ONE provision per fee-type with
    // a STRUCTURED object capturing amount + triggers + payment deadline.
    const termfCodes = [
      'TERMF-TARGET', 'TERMF-REVERSE', 'TERMF-EXPENSE',
      'TERMF-TAIL', 'TERMF-EFFECT', 'TERMF-SOLE',
    ];
    const codeMenu = termfCodes
      .map((c) => {
        const fs = getFeaturesForCode(c).map((f) => f.key).join(', ');
        return `  ${c}: { ${fs} }`;
      })
      .join('\n');
    typeSpecific = `
CRITICAL FEATURE EXTRACTION RULES for TERMF:

Section 8.02 (or similar) of a typical merger agreement bundles SEVERAL distinct fee provisions. Treat TERMF like NOSOL/ANTI — return ONE provision per fee-type, with a STRUCTURED object capturing amount + triggers + payment deadline.

PER-CODE FEATURE FIELDS — once you choose a code, ONLY populate the fields listed for that code below:
${codeMenu}

Field semantics (use these exact JSON shapes — populate every nested key when the agreement provides the data, otherwise use null):

- "companyTerminationFee" (TERMF-TARGET) — fee payable BY the company/target:
    { "amount": "$XXX million", "percentage_of_equity": "X.X%", "triggers": [<trigger objects, see TRIGGER SHAPE below>], "payment_deadline": "within X business days of termination" }
- "reverseTerminationFee" (TERMF-REVERSE) — fee payable BY the buyer/parent:
    { "amount": "$XXX million", "percentage_of_equity": "X.X%", "triggers": [<trigger objects>], "payment_deadline": "within X business days of termination" }
- "expenseReimbursement" (TERMF-EXPENSE) — expense reimbursement cap and triggers:
    { "amount_cap": "$XX million", "triggers": [<trigger objects>] }
- "tailProvision" (TERMF-TAIL) — subsequent-transaction fee window:
    { "period_months": 12, "threshold_percentage": "20%", "triggers": [<trigger objects>] }
- "effectOfTermination" (TERMF-EFFECT) — short text describing post-termination consequences (e.g. "Agreement becomes void except for confidentiality and expense provisions").
- "soleAndExclusiveRemedy" (TERMF-SOLE) — true if the fee is the sole and exclusive remedy.
- "remedyScope" (TERMF-EFFECT and TERMF-SOLE) — "FEE_SPECIFIC" when the provision addresses remedies/effects SPECIFICALLY tied to the termination fee (e.g. "payment of the Company Termination Fee shall be the sole and exclusive remedy"); "GENERAL" when it is a general effect-of-termination or remedies provision not specific to the fee (e.g. "this Agreement shall become void and of no effect", general survival, general specific-performance rights). The fee table displays FEE_SPECIFIC rows only; GENERAL rows are cross-referenced to the boilerplate remedies — misclassifying a general remedy as fee-specific misleads readers on deals WITHOUT fees.
- "interestOnLatePayment" (TERMF-TARGET / TERMF-REVERSE) — only when explicitly stated:
    { "rate": "prime + 2%", "base": "the unpaid fee" }

TRIGGER SHAPE — every "triggers" array inside the fee objects above holds TAGGED objects, one per distinct trigger:
    { "code": "<TERMF_TRIGGER_CODES code>", "label": "<plain-English one-liner>", "text": "<verbatim trigger clause from the agreement>" }
TERMF_TRIGGER_CODES (use "OTHER" only when nothing fits):
${formatDict(TERMF_TRIGGER_CODES)}
TRIGGER RULES:
1. "label" is what a PARTNER WOULD SAY the trigger is — e.g. "Company terminates to accept a Superior Proposal", "Parent terminates after the Board changes its recommendation", "Deal voted down, and the Company signs an alternative deal within 12 months (tail)". Fold the deal's specifics (tail length, threshold) into the label when the agreement states them.
2. "label" MUST START with the plain-English action — WHO terminates and WHY — not with a section number. Put the section cite (and any parenthetical cross-references) ONLY in "text", which is copied VERBATIM (character-for-character, including the cross-references and parentheticals). A cross-reference cite is FORBIDDEN ANYWHERE in "label" — not just as the whole label, and not even trailing after the plain-English action. "Company terminates the Agreement pursuant to Section 8.01(f), its termination right associated with accepting a Superior Proposal" is WRONG (leads with the cite, and still smuggles "Section 8.01(f)" into the label) — the correct label is "Company terminates to accept a Superior Proposal". Likewise "Termination pursuant to Section 8.01(c)(ii)" is WRONG — say WHAT Section 8.01(c)(ii) is, with no section number anywhere in the label.
3. One object per distinct trigger — do NOT merge two triggers into one object, and do NOT roll up triggers across different fee types.

Common rules:
- "mainConcept" is a one-sentence summary of THAT specific fee provision.
- Do NOT bundle the company fee and the reverse fee into a single provision — emit one TERMF-TARGET and one TERMF-REVERSE.
- If a fee type is not present in the section, do NOT emit a provision for it.

STAGE-1 FIELDS for TERMF (extract on the generic TERMF schema only — leave null otherwise):
- terminationFeePercentEquityValue (percentage): Company termination fee expressed as % of equity value ("approximately 3.5% of equity value" → "3.5%").
- tailFeeTriggerEndDate (boolean): true if termination at the end / outside date triggers the tail-fee mechanic.
- tailFeeTriggerNakedNoVote (boolean): true if a "naked no-vote" (failure of stockholder vote without competing proposal) triggers the tail fee.
- tailFeeTriggerAltAnnouncedDuringPendency (boolean): true if an alternative transaction ANNOUNCED during pendency triggers the tail fee.
- tailFeeTriggerConsummatedDuringTail (boolean): true if the alternative transaction must be CONSUMMATED within the tail period to trigger the fee.
- nakedNoVoteFeePresent (boolean): true if a standalone naked-no-vote fee (lower amount, no competing bid) exists. nakedNoVoteFeeAmount = dollar amount.
- feeSoleAndExclusiveRemedy (boolean): true if the fee is stated to be the sole and exclusive remedy.
- feeSoleRemedyExceptions (list): Carve-outs from sole-and-exclusive remedy (e.g. "Willful Breach", "fraud", "specific performance under Section X.XX").
- remedyBarAfterFee (text): Verbatim "no other monetary remedies once the fee has been paid" language.

P3 TAIL-FEE MECHANICS (extract on the generic TERMF schema only):
- tailFeeWindowMonths (number): Tail period in MONTHS. Anchor: "tail period" / "tail fee" + "(N) months".
- tailFeeThresholdPct (percentage): Threshold % for the Company Takeover Proposal that must be consummated during the tail. NOTE: this is OFTEN DIFFERENT from the base Acquisition Proposal % threshold (acquisitionTransactionPctThreshold in NOSOL). Anchor: "50% of the consolidated assets" / "fifty percent" appearing specifically in the tail-fee paragraph.
- tailFeeSameProposalRequired (boolean): TRUE if the consummated deal must be with the same third party that triggered the tail. Anchor: look at clause (C) of the tail-fee mechanic — "such Company Takeover Proposal" → same proposal (TRUE); "a Company Takeover Proposal" → any proposal (FALSE).
- tailFeeRecognitionEvent (text): What counts as the triggering event in the tail window. Examples: "consummation" vs "definitive agreement that's later consummated". Anchor: "a definitive agreement to consummate the transactions ... and such transactions are subsequently consummated (whether during or after such [tail-period]-month period)".
- tailFeeActivatingClauses (list): Section references for which termination clauses activate the tail (e.g. ["§8.01(b)(i) [Outside Date]", "§8.01(d) [No-Vote]"]).
- triggers (list of objects): The Trigger Matrix — one entry per canonical trigger present. Shape: { code, name, terminationClauses (list of section refs), feeAmount, feeAmountPct }. "code" comes from TERMF_TRIGGER_CODES above; "name" is the plain-English one-liner (same discipline as TRIGGER RULES — never a bare section cross-reference).

PAIRING RULE: Never set nakedNoVoteFeePresent=true without filling nakedNoVoteFeeAmount. Never set tailFeeWindowMonths without filling at least one of tailFeeActivatingClauses or tailFeeRecognitionEvent.
`;
  } else if (typeKey === 'DEF') {
    typeSpecific = `
CRITICAL FEATURE EXTRACTION RULES for DEF:
- "canonicalTerm" is the exact quoted defined term as it appears (e.g., "Material Adverse Effect").
- "definitionText" is the core definition body (excluding enumerated carve-outs).
- For MAE-type definitions, "carveouts" (lowercase) lists each enumerated exception as a TAGGED object { code, label, text } drawn from MAE_CARVEOUT_CODES (use "OTHER" when no listed code fits). "disproportionateImpactClause" captures any "except to the extent disproportionately affected" qualifier as free text.
- "crossReferences" lists other defined terms referenced inside this definition.

KNOWLEDGE-DEFINITION RULES (apply ONLY when the defined term is "Knowledge", "Knowledge of the Company", "Company's Knowledge", "Parent's Knowledge", or similar):
- knowledgeStandard (tagged from KNOWLEDGE_STANDARDS): The standard of awareness the definition imposes. Choose ONE:
    * ACTUAL — "the actual knowledge of" with no further qualifier.
    * AFTER_INQUIRY — "after reasonable inquiry" / "after due inquiry" / "after reasonable investigation". This is the MOST common form and should be picked whenever any inquiry duty is stated.
    * CONSTRUCTIVE — "the knowledge any such Person would reasonably be expected to have" / "should know" / "imputed knowledge".
    * NA — only when there is no knowledge definition at all.
  Emit as a TAGGED object: { code, label, text } where text is the verbatim phrase from the definition that drove the classification.
- knowledgePersons (list of tagged objects): WHO the knowledge attaches to — the named officers, named individuals, or generic title list. Extract each verbatim. Emit one tagged object per item: { code, label, text } where code is a short UPPER_SNAKE slug derived from the person/title (e.g. "CEO", "CFO", "GENERAL_COUNSEL", "CHIEF_LEGAL_OFFICER", "NAMED_SCHEDULE_LIST"), label is the human-readable form ("Chief Executive Officer", "Persons listed on Schedule X.YZ"), and text is the verbatim phrase from the definition. Capture EVERY person/title called out. When the definition points to a schedule list ("the individuals listed on Section 1.01(a) of the Company Disclosure Letter"), emit ONE item with code NAMED_SCHEDULE_LIST and label "Persons listed in [the schedule reference]".


STAGE-1 FIELDS for DEF (especially MAE):
- carveouts (list-tagged from MAE_CARVEOUT_CODES): Map EACH enumerated carve-out in the MAE definition to the closest code in MAE_CARVEOUT_CODES (or OTHER) with the verbatim "text" quoted from the agreement. Real MAE definitions list 5-15 carve-outs (general economic conditions, industry conditions, war / terrorism, pandemics, changes in Law, changes in GAAP, securities-price movement, failure to meet projections, the announcement itself, etc.). Include EVERY enumerated carve-out — do not summarize the list.
- disproportionateImpactCarveouts (list-tagged): Subset of carve-outs subject to the disproportionate-impact carveback (typically economic / industry / war / pandemic / Law / GAAP carve-outs).
- nonDisproportionateImpactCarveouts (list-tagged): Carve-outs NOT subject to the carveback (typically announcement-of-transaction, stock-price drop, failure to meet projections).
- preventDelayProng (boolean): true if the MAE includes a "prevent-or-delay-Closing" prong (the second prong of a two-prong MAE).
- preventDelayRepsCovered (list): Reps covered by the prevent-or-delay prong (e.g. "Litigation", "No Conflict").
- maeLimbs (enum ONE_LIMB / TWO_LIMB): ONE_LIMB if the MAE definition contains only an effect-on-Company prong (no prevent-or-delay prong). TWO_LIMB if it contains BOTH (a) an effect on the Company / business / results / condition prong AND (b) a "prevent or materially delay or impair the consummation of the transactions" prong. If maeLimbs=TWO_LIMB you MUST also set preventDelayProng=true.

PAIRING RULE: Never set preventDelayProng=true without populating preventDelayRepsCovered.
`;
  } else if ((typeKey === 'REP-T' || typeKey === 'REP-B') && scope === 'preamble') {
    // P5 item 5(c): dedicated REP preamble extraction prompt — runs ONLY on
    // the REP-T-PREAMBLE / REP-B-PREAMBLE pseudo-provision. Anchors on the
    // SEC-filings exception block, materiality scrape, and disclosure letter.
    typeSpecific = `
CRITICAL FEATURE EXTRACTION RULES for ${typeKey} PREAMBLE:
The text below is the SECTION-WIDE preamble of the ${typeKey === 'REP-T' ? 'Company' : 'Buyer'} representations.
It typically frames the carve-outs that scope EVERY individual rep that follows.

Extract ONLY these preamble-scoped fields:
- secFilingsExceptionLanguage (text, citable): VERBATIM "Except as set forth in / Except as disclosed in ... the SEC Reports filed by the Company since ..." block, INCLUDING any parenthetical exclusions. Copy character-for-character.
- secFilingsExceptionLookback (text): The cut-off phrase EXACTLY as written. CRITICAL — copy the agreement's own framing; do NOT convert to months. It is frequently a SHORT period before signing, e.g. "at least one (1) business day prior to the date of this Agreement" or "the business day immediately preceding the date hereof", or a date "since January 1, 2023". Capture the verbatim phrase.
- secFilingsExceptionLookbackDate (text, ISO YYYY-MM-DD): ONLY if the cut-off is expressed as an absolute calendar date; normalize to ISO. If the cut-off is "X business days prior to signing" (no absolute date), leave null — do NOT invent a date.
- secFilingsExceptionCutoffStandard (enum): the cut-off NORMALIZED for cross-deal comparison. One of: "ONE_BUSINESS_DAY_PRE_SIGNING" (at least one business day / the business day immediately preceding signing), "DATE_OF_AGREEMENT" (filings up to the date of the agreement itself), "ABSOLUTE_DATE" (a stated calendar date), "OTHER". Pick the closest; never null when a cut-off exists.
- secFilingsExceptionExclusions (list-tagged from SEC_FILING_EXCLUSION_CODES): The portions of the filed SEC documents EXCLUDED from the exception. Map EACH to the closest code (RISK_FACTORS / FORWARD_LOOKING / MARKET_RISK_DISCLOSURES / EXHIBITS / OTHER) with verbatim "text". The standard parenthetical reads "(excluding any exhibits to any Filed Company SEC Documents or disclosures contained in any part ... entitled 'Risk Factors', 'Quantitative and Qualitative Disclosures about Market Risk', disclosures of risks set forth in any Forward-Looking Statements disclaimer ...)". So EXHIBITS is almost always one of them — do NOT omit it. Return [] only if there is genuinely no exclusion parenthetical.
- secFilingsExceptionCarvedOutReps (list of short rep names): Reps NOT subject to the SEC-filings exception. Look for "this exception shall not apply to" / "this exception does not apply to" / "other than [Section 4.x (Capitalization)]". One short name per carve-out (e.g. ["Capitalization", "Authority", "Brokers"]). Return [] if absent.
- disclosureLetterReference (text, citable): The SEPARATE Disclosure Letter exception — verbatim, e.g. "or as set forth in the letter, dated as of the date of this Agreement (the Company Disclosure Letter), from the Company to Parent and Merger Sub". This is a DISTINCT exception from the SEC-filings one — always capture it when the preamble says "or as set forth in the ... Disclosure Letter".
- materialityScrapePresent (boolean): true if a materiality scrape applies ("for purposes of this Section ... materiality and Material Adverse Effect qualifiers shall be disregarded").
- materialityScrapeLanguage (text, citable): VERBATIM scrape language when present.
- mainConcept (text): One-sentence summary of what this preamble does (e.g. "Scopes the Company reps with a SEC-filings exception and a materiality scrape applicable to bring-down").

VERBATIM RULE: secFilingsExceptionLanguage and materialityScrapeLanguage must be exact character-for-character excerpts from the source.

SEC_FILING_EXCLUSION_CODES (for secFilingsExceptionExclusions — map each excluded portion to one):
${formatDict(SEC_FILING_EXCLUSION_CODES)}

Do NOT extract per-rep fields (mainConcept of an individual rep, knowledgeStandard on a specific rep, etc.). Those live on the individual rep sub-clauses.
`;
  } else if (typeKey === 'REP-T' || typeKey === 'REP-B') {
    const isRepT = typeKey === 'REP-T';
    typeSpecific = `
CRITICAL FEATURE EXTRACTION RULES for ${typeKey}:
- "mainConcept" is a one-sentence summary of what is being represented.
- "materialityQualifier" — if a materiality qualifier IS present, return a TAGGED object { code, label, text } drawn from MATERIALITY_CODES; otherwise null. Distinguish by SCOPE:
    * MAT_MAE_QUALIFIED / MAT_MAE_AGGREGATE — entire rep's accuracy tested against MAE-level threshold (anchor: "Except as would not, individually or in the aggregate, reasonably be expected to have a Material Adverse Effect…", "except where the failure to be true would not have an MAE")
    * MAT_MATERIAL_TO_COMPANY — entire rep qualified by materiality-to-Company at less than MAE level (anchor: "Except as would not be material to the Company [and its Subsidiaries taken as a whole]" / "Except as would not have a materially adverse impact on the Company"). Scope is the WHOLE rep.
    * MAT_MATERIAL_INLINE — "material" is a substantive modifier WITHIN the rep's content, not an accuracy threshold (anchor: "the Company has materially complied with", "all Material Contracts have been delivered", "no material breach of"). Scope is internal — the rep itself uses "material" as a noun modifier.
    * MAT_ALL_MATERIAL — generic "in all material respects" qualifier when scope is ambiguous between whole-rep and inline.
    * MAT_NO_QUALIFIER — when no materiality qualifier present.
  Pick the most specific code that fits; only fall back to MAT_ALL_MATERIAL when you genuinely can't tell whether the qualifier is whole-rep or inline.
- "knowledgeScopeType" (enum ENTIRE_REP / PARTIAL) — ONLY when this rep contains a knowledge qualifier ("to the Knowledge of the Company", "to Parent's Knowledge", "to the actual knowledge of", "known to the Company", or similar). Classify whether the qualifier governs the WHOLE rep or only specific limbs/sentences:
    * ENTIRE_REP — the knowledge qualifier sits at the CHAPEAU of the rep, before any sub-clauses or enumerated items, so it governs everything that follows. Anchor: "To the Knowledge of the Company, the Company is not in violation of, and has not received any written notice asserting any violation of, any Law applicable to it or its business." — the qualifier opens the sentence and every clause after it is knowledge-qualified.
    * PARTIAL — the knowledge qualifier is embedded INSIDE only one limb or sentence of a rep that has OTHER, unqualified limbs. Anchor: "The Company has not received any written notice of any pending or threatened Proceeding against the Company. The Company is not, to the Knowledge of the Company, under investigation by any Governmental Entity with respect to any violation of Law." — only the second sentence is knowledge-qualified; the first sentence is a flat, unqualified statement.
  Leave null when the rep carries no knowledge qualifier at all — do NOT invent a scope.
- "materialityScopeType" (enum ENTIRE_REP / PARTIAL) — ONLY when this rep carries a materiality qualifier (i.e. you populated "materialityQualifier" above with a non-null tagged object). Classify whether the qualifier governs the WHOLE rep or only specific limbs/sentences, using the SAME ENTIRE_REP/PARTIAL distinction as knowledgeScopeType:
    * ENTIRE_REP — the materiality qualifier sits at the CHAPEAU of the rep, before any sub-clauses, so it governs everything that follows. Anchor: "Except as would not be material to the Company, the Company has complied in all respects with all Laws applicable to it." — the qualifier opens the sentence and every clause after it is materiality-qualified.
    * PARTIAL — the materiality qualifier is embedded INSIDE only one limb or sentence of a rep that has OTHER, unqualified limbs. Anchor: "The Company has delivered true and complete copies of each Material Contract. No party to any Material Contract has, in all material respects, breached or is in default thereunder." — only the second sentence carries a materiality qualifier; the first sentence is a flat, unqualified statement.
  Leave null when the rep carries no materiality qualifier at all — do NOT invent a scope. This is folded into features.materialityQualifier.scope by a deterministic post-pass; do not populate materialityQualifier.scope yourself.
- "crossReferences" should include schedule references (e.g. "Section 3.6 of the Company Disclosure Letter") and other section cross-references.

STAGE-1 FIELDS for ${typeKey} (extract when supported — leave null otherwise):
${isRepT ? `- secFilingsExceptionScope (text, preamble): Scope of the "except as disclosed in SEC filings" exception ("Except as Publicly Disclosed").
- secFilingsExceptionLookback (text, preamble): The cut-off phrase EXACTLY as written in the agreement — copy it verbatim, character-for-character, whatever the unit. It is FREQUENTLY a short period before signing, e.g. "at least one (1) business day prior to the date of this Agreement" or "the business day immediately preceding the date hereof"; it can also be a date phrase like "since January 1, 2023" or a months/years window. ALWAYS capture this verbatim phrase whenever a SEC-filings exception is present — do NOT reduce it to a number. This is the primary, source-loyal record of the cut-off. CRITICAL: this field is NOT optional whenever a SEC-filings exception exists. If you populated secFilingsExceptionScope with a sentence that contains ANY of: "prior to the date of this Agreement", "prior to the date hereof", "preceding the date", "since [DATE]" — then extract THAT cut-off sub-phrase verbatim into secFilingsExceptionLookback. Do not leave this field null if the cut-off phrase is visible in the scope sentence you captured.
- secFilingsExceptionLookbackDate (text, ISO YYYY-MM-DD, preamble): ONLY if the cut-off is expressed as an absolute calendar date ("since January 1, 2023" → "2023-01-01"); normalize to ISO. If the cut-off is a relative day/week/month period with no absolute date, leave null — do NOT invent a date.
- secFilingsLookbackMonths (number, preamble): Look-back period in months — ONLY when the agreement's framing is clearly in MONTHS or YEARS (e.g. "during the twelve (12) months prior to the date of this Agreement", "since January 1, 2024" → derive months from signing date). DO NOT populate this from a DAY-based or WEEK-based cut-off (e.g. "one (1) business day prior to the date of this Agreement", "the business day immediately preceding the date hereof") — those go in secFilingsExceptionLookback ONLY and this field stays null. Never confuse "1 business day" with "1 month".
- secFilingsExcludedSections (list, preamble): Sections excluded from the SEC-filings exception ("risk factors", "forward-looking statements", "cautionary statements").
- secFilingsCarvedOutReps (list, preamble): Reps NOT subject to the SEC-filings exception (typically Capitalization, Authority, fundamental reps).
- knowledgeStandard (tagged from KNOWLEDGE_STANDARDS, preamble): Knowledge definition — ACTUAL / CONSTRUCTIVE / AFTER_INQUIRY / NA.
- absenceOfChangesStartDate (text, clause): On Absence-of-(Certain-)Changes(-or-Events) reps, look for "Since [date]" / "From [date] through the date of this Agreement" / "between [date] and the date hereof" — extract the look-back start date verbatim (e.g. "December 31, 2024"). REQUIRED whenever the rep is the Absence-of-Changes rep.
- lookbackDateISO (text, ISO YYYY-MM-DD, clause): the same look-back start date normalized to ISO whenever an absolute date is stated. Null when no absolute date.
- lookbackAnchor (enum, clause): what the look-back is tied to — "BALANCE_SHEET_DATE" (the most recent audited balance-sheet date, the usual convention), "SIGNING_RELATIVE" (a period measured back from signing), "INCORPORATION" (since the company's inception/incorporation/formation), "ABSOLUTE_DATE" (a stated date with no evident tie), or null. Lookbacks are always RELATIVE economics — cross-deal statistics need the anchor to compare like with like.
- lookbackTiedToIncorporation (boolean, clause): true ONLY when the look-back runs "since inception" / "since its incorporation/formation" — these are excluded from cross-deal look-back statistics (they reflect company age, not negotiated risk allocation).
- absenceOfChangesType (enum SPECIFIED_IOCS/GENERAL_ORDINARY_COURSE/HYBRID, clause): On Absence-of-Changes reps, classify the rep's structure:
    * GENERAL_ORDINARY_COURSE — renders as "General operating covenant". A single ordinary-course-of-business statement ("the Company has conducted its business only in the ordinary course consistent with past practice") with no enumerated list.
    * SPECIFIED_IOCS — renders as "Specific IOCs". The rep enumerates a list of specific restricted actions / changes (look for sub-clauses (i), (ii), (iii) listing concrete prohibited or to-be-disclosed acts: amendments to charter, dividends, equity issuances, material acquisitions, etc.).
    * HYBRID — renders as "Hybrid (General operating covenant and specific IOCs cited)". Both an ordinary-course statement AND an enumerated list. Pick the MOST specific code.
- absenceOfChangesExceptions (list-tagged, clause): On Absence-of-Changes reps, extract each enumerated sub-clause (the specific changes/actions the rep calls out) as one tagged item. Examples: "any amendment to its certificate of incorporation", "any declaration, setting aside, or payment of any dividend", "any material change in accounting methods", "any incurrence of Indebtedness". Use the verbatim sub-clause text. REQUIRED when the rep type is SPECIFIED_IOCS or HYBRID. When the rep is GENERAL_ORDINARY_COURSE with no enumerated exceptions, return []. The UI will render that as canonical "None" — do NOT omit the field.

ABSENCE-OF-CHANGES "NO MAE" + ORDINARY-COURSE LIMBS (REQUIRED on the Absence-of-Changes rep, null elsewhere). The modern AoC rep has TWO distinct limbs — extract each separately, do not blend them:
- aocNoMaePresent (boolean, clause): true when the rep states that since a date there has NOT been a (Company) Material Adverse Effect (anchor: "Since December 31, 2024 ... there has not been a Company Material Adverse Effect"). This is the no-MAE limb, usually limb (a).
- aocNoMaeSinceDate (text, clause): the date the no-MAE limb runs from, VERBATIM as written (e.g. "December 31, 2024"). The UI renders the term as "No MAE since [this date]" — capture exactly the date text, nothing more. REQUIRED whenever aocNoMaePresent is true.
- aocOrdinaryCourseLimb (text, clause): the SEPARATE ordinary-course limb, usually limb (b) — VERBATIM (e.g. "From [date] through the date of this Agreement, the business of the Company has been conducted in the ordinary course in all material respects, other than actions taken in respect of Sections 5.01(a) through (r)"). Null when the rep has no ordinary-course limb. Do NOT copy the no-MAE limb here.
- aocCitedCovenantSections (list, clause): the interim-operating-covenant section numbers the ordinary-course limb cross-references, exactly as written — e.g. for "other than actions taken in respect of Sections 5.01(a) through (r)" return ["5.01(a)", "5.01(r)"] (the two range endpoints; a deterministic post-pass expands the range and resolves each cite to its covenant name). For a non-range list ("Sections 5.01(b), 5.01(d) and 5.01(f)") return every cited number. Return [] when the limb cites no sections. NEVER invent section numbers.
- undisclosedLiabilitiesExceptions (list-tagged, clause): On No-Undisclosed-Liabilities / No-Liabilities reps, extract the sub-clauses listing what IS EXCLUDED from the no-liabilities representation. Typical excluded categories (one tagged item per sub-clause, verbatim text):
    * "liabilities reflected or reserved against in the consolidated balance sheet of the Company (or the notes thereto)"
    * "liabilities incurred in the ordinary course of business since the date of the latest balance sheet"
    * "liabilities incurred in connection with this Agreement or the transactions contemplated hereby"
    * "liabilities that would not, individually or in the aggregate, reasonably be expected to be material to the Company and its Subsidiaries, taken as a whole"
  REQUIRED whenever the rep is the No-Undisclosed-Liabilities rep and the rep contains any "except for" / "other than" carve-outs.
- disclosureSchedulesRequired (list, preamble): Reps where the disclosure schedules are REQUIRED listings (must list every contract).
- disclosureSchedulesException (list, preamble): Reps where the schedules are EXCEPTION listings (need only list exceptions).
- maeQualifiedReps (list, preamble): Reps qualified by "would not reasonably be expected to have a Material Adverse Effect".
- topCustomersSuppliersRepPresent (boolean, clause): true if there is a Top Customers & Suppliers rep. topCustomersSuppliersDefinition = "top 10 by FY revenue" etc.
- materialContractsRedactionsPermitted (boolean, clause): true if redactions to material contracts in the data room are permitted.
- permittedRedactionsDefinition (text, clause): Definition of permitted-redaction text.
- materialityScrapePresent (boolean, preamble): true if there is a closing-condition-level materiality scrape (qualifiers disregarded for bring-down).
- materialityScrapeLanguage (text, preamble): Verbatim scrape language ("disregarded for purposes of determining ...").
- erisaPlansListed (boolean, clause): On the Employee Benefits / ERISA rep, true if the rep states that "Section [X] of the Company Disclosure Letter sets forth a true and complete list of each Company Benefit Plan" (or similar all-plans-listed-on-schedule anchor). false if no such listing requirement appears.
- erisaCompliance (text, clause): On the Employee Benefits / ERISA rep, extract the verbatim compliance representation — typical anchors: "each Company Benefit Plan has been established, operated and administered in compliance with its terms and applicable Laws, including ERISA and the Code" / "no Company Benefit Plan is or has been the subject of a non-exempt 'prohibited transaction'".
- erisaTitleIVPlans (boolean, clause): On the Employee Benefits / ERISA rep, true if the rep addresses Title IV / defined-benefit plans (anchor phrases: "Title IV of ERISA", "defined benefit plan", "Pension Benefit Guaranty Corporation", "Section 412 of the Code", "single-employer plan"). false if the rep affirmatively states no such plans exist or is silent.
- erisaMultiemployer (boolean, clause): On the Employee Benefits / ERISA rep, true if the rep addresses multiemployer plans (anchor phrases: "multiemployer plan" as defined in Section 3(37) or 4001(a)(3) of ERISA, "withdrawal liability"). false if the rep affirmatively states no multiemployer participation.
- erisaParachutePayments (text, clause): On the Employee Benefits / ERISA rep, extract the verbatim parachute-payments / Section 280G language. Anchor phrases: "Section 280G of the Code", "excess parachute payment", "no payment or benefit … would, individually or in combination with any other payment or benefit, constitute an 'excess parachute payment'", "Section 4999 of the Code".

MATERIAL CONTRACTS REP — exhaustive bucket extraction with per-bucket threshold (REP-T only):

- materialContractsBuckets (list-tagged, clause) — CRITICAL. The Material Contracts rep enumerates
  EVERY type of contract that counts as "material" via numbered sub-clauses
  (i), (ii), (iii)... typically 10-25 sub-clauses. Extract EVERY sub-clause as
  a SEPARATE entry — do NOT consolidate or summarize. Include obvious ones
  (Aggregate Payments, Indebtedness, JV/Partnerships, IP licenses) AND less
  common ones (Tax allocation, Government contracts, Real estate leases,
  Distribution, Supply, Collaboration, Employment of key executives,
  Settlements with future restrictions, Affiliate transactions, etc.).
  The canonical MATERIAL_CONTRACT_BUCKET_CODES family is a spine, not a closed
  universe. Some buckets are highly contract-specific, and some overlap with
  IOC-style operating restrictions. If no canonical code fits cleanly, use
  code "OTHER" with a precise label and verbatim text. Do NOT force an
  off-market or industry-specific bucket into a nearby but wrong code.

  CODE MAPPING — pick the MOST SPECIFIC canonical code. Common mappings:
    * "required to be filed ... as a material contract pursuant to Item 601(b)"
      → SEC_ITEM_601 (NOT AGGREGATE_PAYMENTS).
    * IP developed for/at the direction of the company ("Development Contract")
      → IP_DEVELOPMENT; inbound IP licenses → IP_LICENSES_IN.
    * single-source / sole-source procurement → SINGLE_SOURCE.
    * contract research organization / clinical studies → CRO.
    * supplier / contract manufacturer making product → MANUFACTURE;
      general purchase/sale/lease of goods or services → SUPPLY.
    * continuing milestone / royalty / future-payment obligations (incl.
      settlements) → MA_ONGOING_OBLIGATIONS.
    * right of first refusal / offer / negotiation → ROFR_ROFN.
    * acquisition/disposition of assets or businesses → MA_AGREEMENTS.
    * hedging / swap / collar / cap / derivative → HEDGING.
    * loans or advances to employees → EMPLOYEE_LOANS.
    * Item 404 of Reg S-K / related-party → AFFILIATE_TRANSACTIONS.
    * registration rights / voting / stockholder → VOTING_REGISTRATION_RIGHTS.

  Each entry MUST be a tagged-item object with FOUR fields:
    {
      "code":      <one of MATERIAL_CONTRACT_BUCKET_CODES; use "OTHER" only
                    when no canonical code fits>,
      "label":     <short human description of the bucket — e.g.
                    "Distribution / reseller agreements" — used when code='OTHER'
                    to disambiguate; can repeat the canonical label when
                    code is a canonical code>,
      "text":      <verbatim sub-clause text from the agreement>,
      "threshold": <just the dollar amount as a clean string when the bucket
                    has one (e.g. "\$2,000,000" or "\$25M" or "\$10,000,000 per
                    year"); null when no monetary threshold applies (e.g.
                    NONCOMPETE / IP_LICENSES typically have no dollar
                    threshold)>
    }

  RULES:
  1. EXTRACT EVERY ENUMERATED SUB-CLAUSE. Do not stop at 5 or 6. The
     Metsera-style Material Contracts rep can have 20+ sub-clauses.
  2. If multiple sub-clauses share a canonical code, that's fine — emit
     each as its own entry (the OTHER label or distinguishing text
     differentiates them).
  3. THRESHOLD MUST BE THE DOLLAR AMOUNT ALONE, not the full carve-out
     sentence. For "payments in excess of \$2,000,000 were made... in fiscal
     year 2024", emit "\$2,000,000".
  4. If the same bucket has two thresholds (e.g. "made \$X in prior year OR
     expected to involve \$Y in next year"), use the LARGER. If both same,
     use one.
  5. Buckets without monetary thresholds (NONCOMPETE, COLLABORATION,
     IP_LICENSES_*, GOVERNMENT_CONTRACTS, etc.) should have
     threshold: null — but still extract them, every one.

  EXAMPLES OF BUCKET VARIETY you should expect to see across deals — look for
  ALL of these (the list is not exhaustive; emit every enumerated sub-clause
  you encounter, even ones not listed here):
    * aggregate-payments / annual-spend threshold contracts (AGGREGATE_PAYMENTS)
    * indebtedness / credit-facility / guarantee threshold (INDEBTEDNESS)
    * capital-expenditure threshold contracts (OTHER, label "Capital expenditures")
    * supply / sole-source / requirements contracts (SUPPLY)
    * manufacturing / CMO agreements (MANUFACTURE)
    * distribution / reseller agreements (DISTRIBUTION)
    * collaboration / R&D agreements (COLLABORATION)
    * inbound IP licenses (IP_LICENSES_IN)
    * outbound IP licenses (IP_LICENSES_OUT)
    * joint ventures / partnerships (JV_PARTNERSHIPS)
    * M&A / acquisition / divestiture agreements above a value threshold (MA_AGREEMENTS)
    * non-compete / non-solicit / exclusivity restrictions (NONCOMPETE)
    * real-estate leases above an annual-rent threshold (REAL_ESTATE)
    * settlement agreements with future obligations / monetary thresholds (SETTLEMENT)
    * key-employee / executive employment / change-in-control agreements (EMPLOYMENT_KEY)
    * government contracts / GWACs / federal procurement (GOVERNMENT_CONTRACTS)
    * affiliate / related-party transactions (OTHER, label "Affiliate transactions")
    * tax-sharing or tax-allocation agreements (OTHER, label "Tax allocation")
    * standstill agreements (OTHER, label "Standstill")
    * stockholder / investor / voting / registration-rights agreements (OTHER)

  Always extract the threshold AS WRITTEN — preserve "\$" and the figure
  exactly. Do not normalize "\$5,000,000" to "5M". Look for ALL of these
  threshold patterns across the sub-clauses: aggregate-payments threshold,
  indebtedness threshold, capex threshold, supply-contract threshold,
  distribution-contract threshold, M&A asset-value threshold,
  settlement-payment threshold, real-estate annual-rent threshold,
  government-contract revenue threshold.

- materialContractsDollarThresholds — DEPRECATED. Do NOT populate. The
  threshold now lives on each bucket object's "threshold" field.` : `- sufficientFundsRepPresent (boolean, clause): true if Parent reps it has sufficient funds. sufficientFundsRepDetails = verbatim language ("at Closing, Parent will have ... sufficient cash on hand").
- solvencyRepPresent (boolean, clause): true if Parent makes a solvency rep. solvencyRepDetails = verbatim language ("Parent ... will be Solvent immediately after giving effect to the Merger").
- antiRelianceRepPresent (boolean, clause): true if there is an anti-reliance / non-reliance rep. antiRelianceRepText = verbatim text.
- parentLitigationRepPresent (boolean, clause): true if Parent reps there is no litigation that would impede the merger.
- parentOwnershipRepPresent (boolean, clause): true if Parent reps it does not own target stock that would trigger anti-takeover statutes.
- parentBrokersRepPresent (boolean, clause): true if Parent makes a brokers / finders rep.`}

NO-OTHER-REPS / NON-RELIANCE (ABRY) RULES — apply ONLY on a section titled "No Other Representations and Warranties" / "Non-Reliance" (or a rep whose text is an express disclaimer of reps beyond the agreement). On every other rep ALL five fields stay null (booleans false):
- noOtherRepsPresent (boolean, clause): true when the section disclaims representations and warranties other than those expressly set forth in the agreement.
- noOtherRepsParty (enum COMPANY/PARENT/BOTH, clause): WHOSE representations are being disclaimed — COMPANY when the disclaimer covers the Company's/target's reps, PARENT when it covers Parent/Merger Sub's reps, BOTH when the section disclaims for both sides. (Note: a no-other-reps section in the Company's article usually disclaims the COMPANY's reps even though it protects the Company.)
- nonRelianceClause (text, clause): the VERBATIM core disclaimer (e.g. "each of Parent and Merger Sub acknowledges and agrees that it has not relied upon any representation or warranty other than the representations and warranties expressly set forth in Article III"). Copy character-for-character.
- extraContractualClaimsWaived (boolean, clause): true ONLY when the section expressly disclaims RELIANCE on (or waives claims based on) extra-contractual statements — projections, estimates, data-room materials, management presentations, or any information outside the agreement's express reps. This is the Abry Partners v. F&W concern: does the agreement attempt to cut off extra-contractual claims. A bare "no other reps are made" without a reliance disclaimer is NOT a waiver — leave false.
- fraudCarveout (text, clause): the VERBATIM carve-out preserving fraud claims, ONLY if one exists (anchor: "nothing in this Section shall limit ... claims for fraud" / "except in the case of fraud"). SILENCE IS LEGALLY MEANINGFUL: when the section says nothing about fraud, return null — NEVER fabricate or infer a carve-out.

PAIRING RULE: Never set a *Present boolean true without filling the companion *Details / *Text / *Definition / *Language / *Scope field, and vice versa.
`;
  } else if (typeKey === 'STRUCT') {
    // Per fix #6: STRUCT extraction is intentionally minimal — lawyers compare
    // ONLY the merger form, closing location, and closing timing across deals.
    // Surviving entity and closing-conditions-precedent are NOT extracted.
    const structCodes = ['STRUCT-MERGER', 'STRUCT-OFFER', 'STRUCT-CLOSING'];
    const codeMenu = structCodes
      .map((c) => {
        const fs = getFeaturesForCode(c).map((f) => f.key).join(', ');
        return `  ${c}: { ${fs} }`;
      })
      .join('\n');
    typeSpecific = `
CRITICAL FEATURE EXTRACTION RULES for STRUCT:

PER-CODE FEATURE FIELDS — keep extraction MINIMAL. Only populate the fields listed for the chosen code:
${codeMenu}

Field semantics:
- "dealStructure" (STRUCT-MERGER) — REQUIRED. Identify the overall deal structure as one canonical code:
    * TWO_STEP_TENDER_OFFER — if Article I / early sections title or describe a "Tender Offer" or "Exchange Offer" followed by a back-end merger.
    * SCHEME — if "Scheme of Arrangement" appears (UK / Cayman / similar).
    * ASSET — if the agreement is an asset purchase agreement.
    * STOCK — if a stock purchase agreement.
    * ONE_STEP_MERGER — default for direct merger agreements (no tender offer, no scheme).
    * OTHER — only if none of the above fits.
  Anchor on these phrases: "the Offer", "Tender Offer", "Exchange Offer", "Scheme of Arrangement", "Asset Purchase Agreement", "Stock Purchase Agreement".
- "mergerForm" (STRUCT-MERGER) — ONE short canonical phrase, e.g. "Reverse triangular merger", "Forward triangular merger", "Double dummy", "Direct merger", "Two-step tender". Do NOT write a paragraph.
- "closingLocation" (STRUCT-CLOSING) — e.g. "WLRK offices" or "Wachtell Lipton's New York offices".
- "closingTiming" (STRUCT-CLOSING) — e.g. "Three business days after conditions satisfiable" or "On the second business day after the date all conditions are satisfied".
- "offerCommencementDeadline" / "offerPrice" / "offerConditionsReference" / "offerExpirationAndExtension" / "acceptanceAndPaymentMechanics" / "scheduleTOFiling" / "schedule14D9Filing" / "stockholderListCovenant" / "buyerBoardDesignation" / "backendMergerMechanic" (STRUCT-OFFER) — capture tender-offer mechanics only when the section title is "The Offer", "Company Actions", "Company Consent; Schedule 14D-9", "Stockholder Lists", or another offer-specific mechanics heading in a two-step tender-offer article. Do NOT use STRUCT-OFFER for ordinary one-step merger "Directors and Officers" or charter/bylaw sections.
- For other STRUCT codes (STRUCT-EFFTIME, STRUCT-EFFECTS, STRUCT-CHARTER, STRUCT-DIRECTORS, STRUCT-ACTIONS), the schema only contains "mainConcept" — extract a one-sentence summary and leave the rest blank.
- Do NOT extract survivingEntity. Do NOT extract closingConditionsPrecedent. Those fields have been removed per the simplified rubric.

P7 item 2 — single-fact extracts for the Effects-of-Merger / Effective-Time sections:
- "effectsOfMergerReference" (STRUCT-EFFECTS): Effects-of-Merger sections almost always cite a single statute (e.g. "shall have the effects set forth in [DGCL § 259]" or "as provided by Section 251 of the DGCL"). Extract JUST the citation as effectsOfMergerReference (e.g. "DGCL § 259"). Leave null if no statute is cited.
- "effectiveTimeShort" (STRUCT-EFFTIME): Effective-Time sections always reduce to one short phrase — typically "Upon filing of the Certificate of Merger with the [State] Secretary of State". Extract that one-sentence summary as effectiveTimeShort (omit the belt-and-suspenders timing language about specifying a later effective time, etc.).

STAGE-1 FIELDS for STRUCT (extract on STRUCT-MERGER when supported — leave null otherwise):
- shareholderApprovalMethodCompany (enum SPECIAL_MEETING/WRITTEN_CONSENT/SIGN_AND_CONSENT/BOARD_ONLY/NA): How Company stockholders approve the merger. "Company Stockholders' Meeting" → SPECIAL_MEETING; "written consent of stockholders holding a majority" → WRITTEN_CONSENT; "concurrently with signing" + written consent → SIGN_AND_CONSENT; no stockholder approval needed → BOARD_ONLY.
- shareholderApprovalMethodParent (enum same options): Same concept for Parent stockholders (most cash deals → BOARD_ONLY).
- adsPresent (boolean): true if the company has American Depositary Shares listed.
- adsVotingMechanics (text): Verbatim ADS voting / surrender mechanics text.

PAIRING RULE: Never set adsPresent=true without filling adsVotingMechanics.
`;
  } else if (typeKey === 'CONSID') {
    typeSpecific = `
CRITICAL FEATURE EXTRACTION RULES for CONSID:

GENERAL CONSID sections (share conversion, exchange mechanics, dissenting rights, withholding, anti-dilution):
- Populate "mainConcept", "considerationType", "perShareAmount", "exchangeRatio", "appraisalRightsAvailable", "withholdingProvision", "proration" as applicable.
- For these sections, leave the equity-award fields below as null / [] / false.

STOCK-CONSIDERATION FEATURES (populate ONLY when the deal pays stock in whole or part; null otherwise):
- exchangeRatioType (enum FIXED / FLOATING): FIXED when a set number of Parent shares per Company share; FLOATING when the ratio adjusts to deliver a fixed dollar value based on Parent's stock price over a measurement period. Capture the verbatim formula in exchangeRatioText.
- collar: { present (boolean), type (SYMMETRIC/ASYMMETRIC/null), floor (text), cap (text), text (verbatim) } — price bounds within which the ratio or value adjusts; outside a collar the consideration fixes or termination/walk-away rights arise.
- walkAwayRight: { present, party, trigger (verbatim price/decline test), fillOrKillOption (verbatim any top-up/"fix" right that defeats the walk-away), text } — price-based termination right in stock deals.
- prorationMechanics: { electionType (CASH_ELECTION/STOCK_ELECTION/MIXED_ELECTION/null), oversubscriptionTreatment (verbatim how oversubscribed elections are cut back pro rata), electionDeadline (text), text } — only for election deals.
- dividendEquivalence (text): treatment of Parent dividends/record dates relative to closing for the stock consideration.
- taxReorgIntended (boolean) + taxReorgText: whether the parties intend Section 368(a) reorganization treatment.
Every text field VERBATIM; absence stays null — a cash-only deal carries NONE of these.

EQUITY-AWARD sections (when the sectionTitle contains "Equity Award", "Stock Plan", "Stock Option", "Treatment of Company [Equity/Stock/Option/RSU/PSU/Restricted]", or similar — i.e., a CONSID-EQUITY classification):
- This is the most important extraction in the deal for equity-holders. Be EXHAUSTIVE.
- The output of this provision will be SPLIT into ONE provision per instrument by post-processing — so for each instrument type the provision addresses, the parallel arrays "outstandingInstruments" + "instrumentTreatments" must be populated such that index i in BOTH arrays corresponds to the SAME instrument. The downstream UI shows each instrument as its own row with columns: instrument type | outstanding count | treatment | vesting | cash-out formula.
- "outstandingInstruments" — for EACH instrument type the provision addresses (stock options, RSUs, PSUs, restricted stock awards, warrants, ESPP rights, SARs, phantom stock, deferred comp, convertible notes), emit ONE tagged object { code, label, text } drawn from EQUITY_INSTRUMENTS, where "text" is the verbatim excerpt naming that instrument (e.g. "Company Stock Options outstanding immediately prior to the Effective Time..."). If the provision is silent on an instrument type, do NOT include it.
- "instrumentTreatments" — for EACH instrument type listed in outstandingInstruments, emit ONE tagged object { code, label, text } drawn from EQUITY_TREATMENT describing HOW that instrument is handled (cashed out at consideration, cashed out at spread, accelerated and cashed out, assumed by buyer, cancelled, continued vesting, replaced, double-trigger, 280G-limited). "text" should be the verbatim treatment language for that instrument. The order of instrumentTreatments MUST match outstandingInstruments.
- "outstandingCount" — when the provision states the number of instruments outstanding (e.g. "12,345,678 Company Stock Options"), include it as free text on the first instrument; otherwise leave null.
- "instrumentType" — leave null here (post-processing will populate it for each split row).
- "instrumentVesting" — for EACH instrument type listed in outstandingInstruments, emit ONE tagged object { code, label, text } drawn from VESTING_STATUS describing THAT instrument's vesting treatment. The order MUST match outstandingInstruments (index i ↔ same instrument). "text" is the verbatim vesting language. Vesting OFTEN DIFFERS BY INSTRUMENT — do NOT collapse:
  * Restricted Stock Awards / RSUs that "shall be fully vested" / "shall vest in full" at the Effective Time → FULLY_ACCELERATED.
  * Stock Options that pay out at closing BUT, where an unvested option "does not vest by its terms as a result of" the closing, have the cash/CVR "subject to the same vesting schedule ... (including double-trigger vesting protection)" → ACCEL_ELSE_DOUBLE_TRIGGER (NOT plain FULLY_ACCELERATED and NOT plain DOUBLE_TRIGGER_ACCEL — it is the compound case).
  * Awards that accelerate ONLY on a qualifying termination following closing → DOUBLE_TRIGGER_ACCEL.
  * PSUs deemed achieved at target/actual then cashed out → use the closest VESTING_STATUS code and capture the performance detail in performanceTreatment.
- "vestingAcceleration" — a SINGLE tagged object { code, label, text } from VESTING_STATUS capturing the DOMINANT vesting treatment across instruments (used only for a section-level headline). The per-instrument "instrumentVesting" array is authoritative for the table; populate BOTH.
- "cutoffDate" — if the agreement distinguishes awards granted before vs. after a specific date (often the signing date or a stated date like "September 21, 2025"), capture that date as free text. Otherwise null.
- "cutoffTreatment" — describe how the cutoff date changes the treatment (e.g., "Awards granted after the Cutoff Date are cancelled without consideration"). Null if no cutoff.
- "cashOutAmount" — the formula/amount used to cash out non-option awards (e.g., "Per Share Merger Consideration" or "$X.XX per share plus one CVR"). Null if N/A.
- "optionSpread" — the formula used to cash out options (typically "Per Share Merger Consideration MINUS per-share exercise price", times shares). Note any "underwater options are cancelled for no consideration" qualifier. Null if N/A.
- "performanceTreatment" — for PSUs/performance awards, describe whether performance is deemed achieved at target / actual / maximum / prorated. Null if no PSUs.
- "espp_treatment" — for the ESPP, describe the final offering / shortened purchase period / termination / refund mechanics. Null if no ESPP.
- "parachuteCap" — true if there is explicit 280G parachute payment cap / cutback language; otherwise false.
- "doubleTrigger" — true if acceleration requires BOTH closing AND a qualifying termination of employment; otherwise false.

Be explicit and granular: lawyers compare per-instrument treatment across deals, so do NOT collapse "options + RSUs + ESPP all cashed out" into one entry — emit a separate outstandingInstruments / instrumentTreatments pair for each.
- ENUMERATION RULE: when the section enumerates instruments as sub-clauses — "(i) each Company Stock Option ... (ii) each Company Restricted Stock Award ..." — EVERY enumerated instrument MUST get its own outstandingInstruments entry. Dropping the (ii) Restricted Stock Award limb while capturing the (i) Stock Option limb is a known failure mode.

PER-INSTRUMENT TREATMENT IS MANDATORY — READ THE WHOLE SECTION, NOT JUST THE
FIRST SUB-CLAUSE. A real Treatment-of-Equity-Awards section is typically
LONG and spreads each instrument's OWN treatment across DIFFERENT lettered
sub-clauses — e.g. stock options in (a)(i), restricted stock awards in
(a)(ii), and the ESPP entirely separately in its own sub-clause (e), several
paragraphs later. Extraction stops at the FIRST instrument's treatment and
never reads on is a KNOWN, REPEATED FAILURE MODE (Metsera: Stock Options
were fully captured with their own treatment + vesting from §2.03(a)(i), but
Restricted Stock Awards — named in §2.03(a)(ii), a few sentences later — and
the Employee Stock Purchase Plan — treated entirely in §2.03(e) — were left
with an outstandingInstruments entry and NO instrumentTreatments /
instrumentVesting entry of their own; a deterministic backstop later added a
bare instrument-name stub with no real treatment data, which is NOT a
substitute for genuine extraction).

MANDATORY CHECK before you finalize your answer: for EVERY index i in
outstandingInstruments, instrumentTreatments[i] and instrumentVesting[i] MUST
be populated from THAT instrument's OWN sub-clause — never left as a
missing/blank slot, and never borrowed or copied from a DIFFERENT
instrument's treatment. Scan the ENTIRE section text, sub-clause by
sub-clause, specifically looking for each additional instrument's own
disposition sentence even after you have already found and recorded the
first instrument's treatment — do not stop reading once you have one
instrument fully captured. Emitting an instrument in outstandingInstruments
without a matching, genuinely-extracted instrumentTreatments AND
instrumentVesting entry at the same index is a FAILURE.

CVR + OPTIONS EARN-IN RULE (applies to ANY CONSID section in a deal that contemplates BOTH options AND a CVR component, not just CONSID-EQUITY):
- "optionsCvrEarnIn" (enum EARN_IN_ELIGIBLE / MUST_BE_ITM / NOT_SPECIFIED) — only populate when the deal pays a CVR AND addresses option treatment; otherwise leave null.
  * EARN_IN_ELIGIBLE — option holders receive the CVR irrespective of whether the option is in-the-money at closing. Typical language: "Each Company Stock Option, whether or not in-the-money, shall be entitled to receive the per-share Closing Amount plus one CVR." The option spread + the CVR combine to form the total consideration.
  * MUST_BE_ITM — only options whose exercise price is LESS THAN (the upfront cash consideration PLUS the maximum CVR value) receive the CVR. Typical language: "Options with an exercise price less than the sum of the Closing Amount and the Maximum CVR Amount shall receive ..."; or options are cashed out at spread relative to upfront cash only and the CVR portion is excluded.
  * NOT_SPECIFIED — the agreement is silent or ambiguous on whether options receive the CVR.
- Look for this in the section that addresses option treatment (typically CONSID-EQUITY or the Treatment of Stock Options sub-section). If the agreement does NOT contemplate a CVR at all, leave optionsCvrEarnIn null.
`;
  } else if (typeKey === 'COV') {
    // Make sure the COMP_STANDARDS and COMP_ITEMS codebooks are appended to
    // the prompt for COV sections so the AI has every code it needs when the
    // section turns out to be Employee Matters (COV-EMPLOYEE).
    usedTaxonomies.set('COMP_STANDARDS', COMP_STANDARDS);
    usedTaxonomies.set('COMP_ITEMS', COMP_ITEMS);

    typeSpecific = `
CRITICAL FEATURE EXTRACTION RULES for COV:

GENERAL COV sections (access, proxy, stockholder meeting, publicity, indemnification, financing cooperation, etc.):
- Populate "mainConcept", "accessScope", "indemnificationPeriod", "financingCooperation", "cvrIncluded" as applicable.
- For COV-ACCESS specifically: if the access covenant restricts access to a SPECIFIC PURPOSE (typical phrasings: "solely for the purposes of", "for purposes of integration planning", "to facilitate consummation of the transactions"), capture the verbatim limitation into accessPurposeLimitation. If access is general/unrestricted, leave accessPurposeLimitation null.
- For these sections, leave the employee-matters fields below null / [] / false.

D&O INDEMNIFICATION / TAIL INSURANCE sections (sectionTitle contains "Indemnification", "D&O", "Directors and Officers", or "Insurance" in the context of officer/director coverage — i.e., a COV-DO classification):
- "indemnificationPeriod" — numeric YEARS of post-closing D&O indemnification protection. Six years is by far the most common (e.g. "for a period of six (6) years from the Effective Time"). Convert any month/day phrasing to years if expressed as a whole number; otherwise leave null.
- "insuranceCap" — verbatim text of the cap on tail / run-off D&O insurance premiums. Typically expressed as either an absolute currency cap (e.g. "shall not exceed $X") OR a multiple of the last annual premium (e.g. "300% of the last annual premium paid by the Company prior to the date hereof"). Capture the FULL clause including BOTH the cap formulation AND the fallback (e.g. "if such tail policy cannot be obtained for an amount equal to or less than 300% of the current annual premium, Parent shall obtain a policy providing the maximum coverage available for 300% of the current annual premium"). If no cap is specified, leave null.
- "advancementOfExpenses" — boolean. True if the agreement requires Parent / the Surviving Corporation to advance defense expenses / attorneys' fees to indemnified directors and officers BEFORE final disposition of a claim, subject to a customary undertaking to repay if a court ultimately determines the person was not entitled to indemnification. False if expense advancement is silent or expressly excluded. Look for phrases like "advance expenses (including reasonable attorneys' fees)", "promptly advanced".
- "notificationConsequences" — short verbatim text describing what happens if the indemnified party fails to give prompt notice of a claim. Typical patterns: "the failure to provide notice shall not relieve the Indemnifying Party of its obligations except to the extent the Indemnifying Party is materially prejudiced thereby". Null if the agreement is silent on notice consequences.
- These fields are populated ONLY for D&O / indemnification sections. Leave them null for unrelated COV sections.

EMPLOYEE MATTERS / BENEFITS sections (sectionTitle contains "Employee Matters", "Employee Benefits", "Continuing Employees", "Employee Plans" — i.e., a COV-EMPLOYEE classification):
- This is one of the most heavily-negotiated post-closing covenants. Lawyers compare these deals ITEM-BY-ITEM. Be EXHAUSTIVE and granular.

- "protectionPeriod" — short text capturing how long the buyer must maintain comparable compensation/benefits AFTER closing. Examples: "12 months after Closing", "Until the 18-month anniversary of Closing", "12 months from the Closing Date or until termination, whichever is earlier". Look for phrases like "for a period of X months/years following Closing", "until the X-month anniversary of Closing", "during the Continuation Period". If absent, return null.

- "employeeBenefitPeriod" — numeric months of the protection period (e.g. 12, 18, 24). Use the same period that "protectionPeriod" describes. If the period is stated in years, convert to months (e.g. "one year" → 12).

- "protectionPeriodMonths" — number of months of FULL protection (typically 12). Same value as employeeBenefitPeriod most of the time; use this field so downstream consumers can rely on a stable, FULL-protection key. Null if absent.

- "postProtectionPeriodMonths" — number of ADDITIONAL months after the initial protection period during which a LESSER standard applies (e.g. "12 months at no-less-favorable, then 12 additional months at substantially-comparable"). Null if the agreement does not extend protection past the initial period.

- "postProtectionStandard" — short text describing the standard applied during the post-protection period (e.g. "no less favorable than employees of similar seniority", "substantially comparable in the aggregate"). Null if absent.

- For each entry in "compensationItems", include "timePeriod" as a short text field IF the agreement specifies a per-item period that differs from the headline protectionPeriod (e.g. severance keyed to a 24-month qualifying-termination window while salary tracks 12 months). Omit the field (or set null) when the per-item period matches the headline period.

- "compensationItems" — THE MOST IMPORTANT FIELD. This is an ARRAY of tagged items, ONE PER comp/benefit category the provision addresses. Each item gets its OWN standard — do NOT collapse everything under a single section-wide standard. Each tagged item has this SHAPE (note the keys differ from the generic { code, label, text }):

    {
      "item": "<CODE from COMP_ITEMS>",
      "item_label": "<human-readable label from COMP_ITEMS for that code>",
      "standard_code": "<CODE from COMP_STANDARDS>",
      "standard_label": "<human-readable label from COMP_STANDARDS for that code>",
      "text": "<verbatim excerpt from the agreement, INCLUDING any parentheticals, qualifiers, and footnotes — copy character-for-character>"
    }

  Identify the standard PER ITEM:
    * NO_LESS_FAVORABLE — strict standard, exact dollar amounts maintained or improved (e.g. "base salary at a rate no less favorable than the rate in effect immediately prior to Closing").
    * SUBSTANTIALLY_SIMILAR — looser, can offer different benefits of similar value.
    * SUBSTANTIALLY_COMPARABLE — looser still ("substantially comparable in the aggregate to the benefits provided immediately prior to Closing").
    * IN_THE_AGGREGATE — looser still, can rebalance across categories.
    * COMPARABLE_TO_BUYER_EMPLOYEES — comparable to similarly situated Parent / Buyer employees.
    * BUYER_DISCRETION — weakest standard, at the buyer's discretion.
    * TARGET_BASELINE — at target's pre-closing levels (often used for severance).

  Cover EVERY item the section addresses. Common items (only emit ones actually mentioned):
    * BASE_SALARY — base salary / wage rate
    * TARGET_BONUS — target annual bonus / cash incentive opportunity
    * ANNUAL_BONUS_PAID — earned annual bonus / pro-rata bonus for year of closing
    * LONG_TERM_INCENTIVE — LTI / annual equity grants / cash long-term-incentive opportunity
    * HEALTH_WELFARE — health, dental, vision, life, disability, welfare benefits
    * RETIREMENT — 401(k), pension, retirement benefits
    * SEVERANCE — severance / change-in-control / qualifying-termination protection
    * PTO — paid time off / vacation / sick leave
    * EQUITY_AWARDS — new equity grants / stock awards (post-closing)
    * OTHER_BENEFITS — any other benefits the provision singles out

  CRITICAL: Do NOT lump everything under one "compensation standard". If base salary is "no less favorable" but health/welfare is "substantially comparable in the aggregate", emit TWO items with different standard_codes. If the provision groups several items under one standard (e.g. "base salary AND target bonus, each no less favorable than..."), emit ONE item per category with the same standard_code but a verbatim "text" excerpt scoped to that category.

- "severanceProtection" — short text describing severance terms, including any double-trigger requirements ("qualifying termination within X months after Closing"), reference to the Disclosure Letter, or a stated dollar / weeks formula. If severance is also covered as a compensationItems row, this field still gets the prose summary.

- "continuedService" — true if prior service with the target is credited under buyer benefit plans (typical phrases: "for purposes of eligibility, vesting, and benefit accrual under the Parent Plans, Continuing Employees shall receive service credit for their service with the Company").

- "continued401k" — short text describing how the 401(k) plan is handled: terminate the company plan before closing, continue it, fold it into buyer's plan, accept rollover contributions, etc.

- "unionContracts" — short text describing how collective bargaining agreements / union contracts are handled (assumption, honoring through the CBA term, post-closing renegotiation). Null if not addressed.

- "eligibilityWaiver" — true if the buyer waives eligibility waiting periods, pre-existing condition exclusions, evidence of insurability, or actively-at-work requirements for the continuing employees.

VERBATIM RULE: copy "text" values character-for-character from the source, including parentheticals and qualifiers. Do NOT summarize or paraphrase.

STAGE-1 FIELDS for COV (extract when supported by the text — leave null otherwise):
- tsaContemplated (boolean): true if the agreement contemplates a Transition Services Agreement.
- financingCooperationPresent (boolean): true if Company must provide financing cooperation. financingCooperationScope = verbatim scope text. financingCooperationBreachIsCondition = true if breach is a stated condition to Parent's obligation to close.
- publicStatementsCarveoutParent (boolean): true if there is a carve-out from the joint-press-release rule allowing Parent to make certain public statements unilaterally.
- publicStatementsCarveoutCompany (boolean): same for the Company side.
- publicStatementsJointApproval (boolean): true if all public statements require joint approval (no unilateral carve-outs).
- covenantComplianceStandard (enum ALL_IN_MATERIAL_RESPECTS/EACH_IN_MATERIAL_RESPECTS/HYBRID): The closing-condition-level covenant compliance standard.

SEC FILING / MEETING MECHANICS (COV-PROXY / COV-MEETING sections ONLY; all fields null elsewhere):
- proxyFilingDeadline: the deadline to FILE the Proxy Statement (or S-4). Capture the verbatim sentence in "text"; parse "days"/"unit" ONLY when the agreement states a numeric deadline ("within ten (10) Business Days after the date of this Agreement" → days 10, unit BUSINESS_DAYS, trigger AGREEMENT_DATE). "as promptly as reasonably practicable" alone → days null.
- mailingDeadline: when mailing to stockholders must COMMENCE, with its trigger event (SEC clearance / expiry of the 10-day no-comment window / S-4 effectiveness). Same parsing discipline.
- meetingDeadline: when the stockholders meeting must be convened/held, with trigger (typically within N days of mailing or effectiveness).
- adjournmentRights: one entry PER PARTY that can cause adjournment/postponement. reasons drawn ONLY from the enumerated grounds in the text (absence of quorum; insufficient votes; supplemental disclosure required by Law; OTHER with verbatim). Capture numeric limits exactly: number of adjournments, days per adjournment, aggregate cap. NEVER invent numbers; a right with no stated limit keeps nulls.
- Every "text" field is VERBATIM from the source — no summarizing at this layer.

PAIRING RULE: Never set financingCooperationPresent=true without filling financingCooperationScope.
`;
  } else if (typeKey === 'MISC') {
    typeSpecific = `
CRITICAL FEATURE EXTRACTION RULES for MISC:
- "mainConcept" is a one-sentence summary of what THIS provision does.
- Focus on the negotiated knobs (governing law, jury waiver, specific performance, assignment, no-setoff). Do NOT extract entire sentences as mainConcept — give a concise one-liner.

STAGE-1 FIELDS for MISC (extract when supported by the text — leave null otherwise):
- governingLaw (text): The NAMED governing-law jurisdiction (e.g. "Delaware", "New York", "Cayman Islands", "England and Wales"). Do NOT emit a boolean and do NOT emit "Yes" / "No". If the agreement says "governed by the laws of the State of Delaware", return "Delaware". If you cannot identify the jurisdiction name, leave null.
- jurisdiction (text): The NAMED forum/courts for litigation (e.g. "Delaware Court of Chancery", "U.S. District Court for the Southern District of New York"). Distinct from governingLaw.
- forumCourts (list): EVERY named court in the forum-selection clause, verbatim, one per list item — e.g. ["the Court of Chancery of the State of Delaware", "any federal court located in the State of Delaware"]. NEVER return a bare boolean or a single merged sentence — the review UI needs the actual court name(s). Empty array [] only if the section genuinely names no court (rare — most governing-law sections do).
- forumFallback (text): the verbatim FALLBACK clause for when the primary named court lacks subject-matter jurisdiction (e.g. "or, if such court lacks subject matter jurisdiction, any federal court located within the State of Delaware"). Null when the clause names only one court with no fallback.
- jurisdictionExclusive (boolean): true if the forum-selection clause uses "exclusive" / "exclusively" / "sole" jurisdiction; false if non-exclusive or silent.
- juryWaiver (boolean): true if there is an express waiver of jury trial.
- specificPerformance (boolean): true if specific performance is available as a remedy (mutually or unilaterally — see specificPerformanceMutual / companyRightToForceClose for finer detail).
- amendmentsRequirement (text): Verbatim text of the amendment clause (e.g. "This Agreement may be amended ... only by an instrument in writing signed by ... the parties hereto"). Capture any post-stockholder-approval restriction. Null only if the section truly does not address amendments.
- waiverStandard (text): Verbatim text of the waiver clause (e.g. "No failure or delay ... shall operate as a waiver thereof"). Often paired with a "writing signed by the waiving party" requirement — capture both.
- severability (text): Verbatim text of the severability clause (e.g. "If any provision ... is held invalid ... such provision shall be ineffective only to the extent of such invalidity, without invalidating the remainder").
- counterparts (text): Verbatim text of the counterparts / electronic execution clause (e.g. "This Agreement may be executed in two or more counterparts ... including by .pdf or other electronic transmission").
- thirdPartyBeneficiaries (list of strings): Each NAMED third-party beneficiary verbatim (e.g. "the D&O Indemnified Parties", "the Continuing Employees", "the holders of Company Common Stock as of immediately prior to the Effective Time"). Empty array [] if no named beneficiary; do NOT emit a boolean.
- thirdPartyBeneficiaryExceptions (list): Carve-outs to the "no third-party beneficiaries" rule (each carve-out as a short verbatim phrase). Distinct from thirdPartyBeneficiaries (the named beneficiaries themselves).
- noticesAddress (text): The FULL notices block — party identification, street address, attention line, email, and counsel cc — for BOTH the Company-side and Parent-side notices. Capture verbatim, separated by a blank line if both sides appear. If only one side appears, capture just that side.
- willfulBreachDefinition (text): Verbatim definition of "Willful Breach" if one exists.
- willfulBreachRequiresActualKnowledge (boolean): true if Willful Breach requires actual knowledge.
- willfulBreachCoversOmissions (boolean): true if Willful Breach covers omissions (failure to act).
- willfulBreachLimitedToMaterial (boolean): true if Willful Breach is limited to material breaches.
- repsSurvivalPresent (boolean): true if the reps explicitly survive Closing. repsSurvivalDuration = duration; repsSurvivalExceptions = list of exceptions.
- parentAssignmentRight (boolean): true if Parent has an assignment right. parentAssignmentConditions = verbatim conditions (e.g. "may assign to a wholly-owned subsidiary").
- companyConsentForAssignment (boolean): true if Company consent is required for assignment.
- assignmentExceptions (list): Enumerated assignment exceptions.
- assignmentRestrictions (text): Verbatim assignment restrictions.
- noExcusePostClosingPresent (boolean): true if there is a no-excuse / no-recourse post-closing covenant.
- noSetoffPresent (boolean): true if there is an express no-setoff clause.
- specificPerformanceMutual (boolean): true if specific performance is available to BOTH parties.
- companyRightToForceClose (boolean): true if the Company can force Parent to close. companyForceCloseConditions = verbatim conditions.
- specificPerformanceLimitations (text): Verbatim limitations on specific performance (e.g. financing condition met).
- bondSecurityRequiredForSP (boolean): true if posting bond / security is a precondition to seeking specific performance.
- terminationExceptionForBadBehavior (text): Verbatim "bad-behavior" exception text for the law/order termination right (e.g. "terminating party shall not have been the principal cause of, or resulted in, the issuance of such Order").
- feeExpenseAllocation (text): Verbatim fee / expense allocation — who pays antitrust / FDI filing fees and any other fees expressly borne by one party.

MISC-EMBEDDED NO-OTHER-REPS / NON-RELIANCE (ABRY) DETECTION — many agreements
do NOT give this its own titled section; instead the language is folded into
THIS Entire Agreement / Integration section (a title like "Entire Agreement;
Third-Party Beneficiaries; No Other Representations or Warranties" is a
strong signal, but check the BODY regardless of title — some agreements omit
the "No Other Representations" phrase from the title entirely). If, and only
if, this section's body contains a party acknowledging (a) that no other
representations or warranties are made beyond a specific Article, and/or
(b) that it has not relied on / is not relying on anything beyond those
express reps, populate the SAME five fields used for a dedicated No-Other-
Reps / Non-Reliance section:
- noOtherRepsPresent (boolean): true when such language is present anywhere in this section.
- noOtherRepsParty (enum COMPANY/PARENT/BOTH): COMPANY when only the Company's/target's reps are disclaimed, PARENT when only Parent's/Merger Sub's reps are disclaimed, BOTH when the section addresses both sides (typically as two adjacent sub-paragraphs — one protecting the Company from Parent's reliance claims, one protecting Parent from the Company's).
- nonRelianceClause (text): the VERBATIM core disclaimer(s). If the section addresses BOTH sides in separate sub-paragraphs, capture BOTH verbatim excerpts, Company-side sub-paragraph first, then Parent-side, SEPARATED BY A BLANK LINE (same convention as noticesAddress above). If only one side is addressed, capture just that excerpt.
- extraContractualClaimsWaived (boolean): true ONLY when the section also expressly disclaims RELIANCE on extra-contractual materials — data rooms, management presentations, projections, forecasts, or similar information outside the express reps. A bare "no other reps are made" without this is NOT a waiver — leave false.
- fraudCarveout (text): the VERBATIM fraud carve-out(s), ONLY if one exists. If both sub-paragraphs address fraud, capture both, separated by a blank line. SILENCE IS LEGALLY MEANINGFUL: if the section says nothing about fraud, return null — never fabricate or infer a carve-out.

If this MISC section is pure boilerplate with none of this language (pure
governing-law / notices / counterparts / etc.), leave all five fields
null/false as usual.

ANCHOR EXAMPLE (Metsera/Pfizer Merger Agreement §9.07(b)-(c), for calibration
only — extract each deal's OWN language, never copy this example into
another deal's output):
  (b) "Each of Parent and Merger Sub acknowledges that, except for the
  representations and warranties contained in Article III, neither the
  Company nor any Person on behalf of the Company makes any other express or
  implied representation or warranty, and neither Parent nor Merger Sub is
  relying or has relied on any such representation or warranty, with respect
  to the Company or any of the Company Subsidiaries or with respect to any
  other information made available to Parent or Merger Sub... Except in the
  case of fraud, neither the Company nor any other Person will have or be
  subject to any liability or indemnification obligation to Parent, Merger
  Sub or any other Person resulting from... any such information, including
  any information, documents, projections, forecasts or other material made
  available to Parent or Merger Sub in certain "data rooms" or management
  presentations..."
  (c) "Without limiting the Company's remedies in the case of fraud, the
  Company acknowledges that, except for the representations and warranties
  contained in Article IV, none of Parent, Merger Sub or any other Person on
  behalf of Parent or Merger Sub makes any other express or implied
  representation or warranty with respect to Parent or Merger Sub or with
  respect to any other information made available to the Company in
  connection with the Transactions."
  → noOtherRepsPresent=true; noOtherRepsParty=BOTH; nonRelianceClause = the
  (b) sentence ("Each of Parent and Merger Sub acknowledges...") followed by
  a blank line then the (c) sentence ("...the Company acknowledges that...");
  extraContractualClaimsWaived=true (data rooms / management presentations in
  (b)); fraudCarveout = the (b) "Except in the case of fraud..." sentence
  followed by a blank line then the (c) "Without limiting the Company's
  remedies in the case of fraud" clause.

PAIRING RULE: Never set parentAssignmentRight=true without filling parentAssignmentConditions; never set companyRightToForceClose=true without filling companyForceCloseConditions; never set repsSurvivalPresent=true without filling repsSurvivalDuration. Never set noOtherRepsPresent=true without filling nonRelianceClause and noOtherRepsParty.
`;
  }

  // Build taxonomy codebook footer — only includes dictionaries actually used
  // by features on this provision type.
  let taxonomyBlock = '';
  if (usedTaxonomies.size > 0) {
    const sections = [];
    for (const [name, dict] of usedTaxonomies.entries()) {
      sections.push(`${name}:\n${formatDict(dict)}`);
    }
    taxonomyBlock = `
TAXONOMY CODEBOOKS — for fields marked "TAGGED", map each value to the closest code below.
Return an object of the form { "code": "<CODE_FROM_DICT>", "label": "<canonical label from dict>", "text": "<verbatim excerpt from the agreement>" }.
For list-typed fields (e.g. permittedExceptions, carveouts), return an ARRAY of such objects.
If no listed code fits, use code "OTHER" (for EXCEPTION_CODES) or pick the closest available code, and still include the verbatim "text".
Do NOT invent new codes — only use codes that appear in the dictionaries below.

${sections.join('\n\n')}
`;
  }

  // Global citation rule, prepended only when at least one citable bare-type
  // field is in scope. Reminds the AI that any { value, quotes } object MUST
  // carry verbatim contiguous quotes that support the value. Companion *Scope /
  // *Details / *Conditions fields remain SEPARATE — they describe the
  // obligation; "quotes" inside { value, quotes } are the EVIDENCE QUOTES.
  const citationRule = anyCitable
    ? `\nCITATION RULE: For any field whose type is described as "object { value, quotes }", ALWAYS include the verbatim quote(s) that support the value in the "quotes" array. Copy agreement text directly, contiguously, and character-for-character except for harmless whitespace. Do NOT paraphrase, compress two clauses into one quote, omit enumerated markers like "(1)" / "(2)", or stitch separated phrases together unless you use an ellipsis between separately-verbatim fragments. Each entry should be one or two sentences. Use multiple entries when distinct passages in different sentences/clauses jointly support the value. The "quotes" array inside { value, quotes } carries the EVIDENCE QUOTES that prove the value; any companion *Scope / *Details / *Conditions / *Language field describes the OBLIGATION and is separate (do not duplicate). LEGACY (still accepted): { value, text: "..." } with a single quote — prefer the multi-quote form going forward. If you cannot find a supporting verbatim quote, set the entire field to null instead of emitting an empty quotes array or a summary quote.\n`
    : '';

  // CRITICAL response-size rule: omit absent fields entirely instead of
  // emitting { value: null, text: "" } or null per key. Without this the
  // AI bloats responses with empty entries for every schema key, which
  // pushes us past max_tokens on long sections and forces a fallback to
  // one provision per section.
  const omitAbsentRule = `\nRESPONSE-SIZE RULE: OMIT any feature key whose value would be null / empty / false / not-stated entirely from the "features" object. Do NOT emit empty placeholders. Smaller responses are better — only include fields you actually populate from the source text.\n`;

  // Universal escape valve — applies to EVERY provision type. The canonical
  // schema must never cause novel/off-market mechanics to be silently crammed
  // into the nearest field or dropped: they get their own channel.
  const noveltyRule = `
NOVELTY / OFF-MARKET CHANNEL (applies to every provision):
- NEVER shoehorn. If a mechanic, exception, or formulation does not genuinely
  fit any schema field above (or any canonical code), do NOT force it into the
  closest one and do NOT drop it. Instead add it to a "flags" array on that
  provision's features object:
    "flags": [ { "concern": "<one short sentence: what this is and why it is unusual>",
                 "text": "<verbatim quote of the mechanic>" } ]
- ALSO flag things that DO fit a schema field but are unusual or off-market in
  substance (an atypical threshold, an aggressive standard, a mechanic you
  would expect a lawyer to want highlighted). Populate the schema field AND
  add a flags entry.
- Leave "flags" out entirely when there is nothing genuinely noteworthy. Do
  not flag boilerplate.
`;
  return `\nExtract these features for each provision (return them in a "features" object on each result):\n${citationRule}${omitAbsentRule}${lines.join('\n')}\n${globalBrevity}${typeSpecific}${noveltyRule}${taxonomyBlock}\n`;
}

// ---------------------------------------------------------------------------
// Build canonical codes list for a provision type
// ---------------------------------------------------------------------------

function buildCodesList(typeKey) {
  const codes = getCodesForType(typeKey);
  return codes.map(
    (c) => `  ${c.code}: "${c.label}" — ${c.description}`
  ).join('\n');
}

// ---------------------------------------------------------------------------
// Definition cross-referencing — find defined terms referenced in text
// ---------------------------------------------------------------------------

function findRelatedDefinitions(text) {
  const related = [];
  const defCodes = getCodesForType('DEF');

  for (const dc of defCodes) {
    // Check if the label or any alias appears in the text
    const terms = [dc.label, ...(dc.aliases || [])];
    for (const term of terms) {
      if (term.length < 4) continue; // skip very short aliases
      // Look for the term in quotes or as a capitalized reference
      const escaped = term.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      const pattern = new RegExp(
        `(?:[“"]${escaped}[”"]|\\b${escaped}\\b)`,
        'i'
      );
      if (pattern.test(text)) {
        if (!related.includes(dc.code)) {
          related.push(dc.code);
        }
        break; // found this code, move to next
      }
    }
  }

  return related;
}

// ---------------------------------------------------------------------------
// IOC PREAMBLE SPLITTING
//
// The "General / Preamble" paragraph of an IOC section typically contains
// several distinct obligations bundled together — e.g.:
//
//   "Except as set forth in Section 5.01 of the Company Disclosure Letter,
//    as expressly required by this Agreement or required by Law, or with
//    Parent's prior written consent (not to be unreasonably withheld), the
//    Company shall, and shall cause each of its Subsidiaries to, conduct its
//    business in the ordinary course of business consistent with past
//    practice and shall use commercially reasonable efforts to (i) preserve
//    intact its present business organization, (ii) retain the services of
//    its present officers and key employees, and (iii) preserve its
//    relationships with customers, suppliers, licensors, licensees, and
//    others. In addition, the Company shall not take any action outside the
//    ordinary course of business."
//
// That is FOUR distinct obligations — they should be FOUR provisions, not one.
// splitIocPreamble identifies the distinct obligations and returns one part
// per obligation, plus a residual "shared carve-outs" part containing only
// the section-wide "Except as / Notwithstanding" framing.
// ---------------------------------------------------------------------------

const IOC_PREAMBLE_PROVISIONS = [
  {
    key: 'IOC-EXISTENCE',
    category: 'Maintain Corporate Existence',
    label: 'Maintain corporate existence and good standing',
    re: /maintain\s+(?:its\s+)?existence\s+in\s+good\s+standing[^.;]*/i,
  },
  {
    key: 'IOC-ORDINARY',
    category: 'Ordinary Course Obligation',
    label: 'Conduct business in the ordinary course consistent with past practice',
    // Matches the "conduct its business in the ordinary course (consistent
    // with past practice)" obligation. We deliberately STOP at "and" or "."
    // so we don't gobble the adjacent "shall use ... efforts" obligation that
    // is typically joined by "and" in the same sentence.
    re: /(?:shall(?:[^.]{0,80}?)conduct\s+(?:its|their)\s+business[^.]{0,40}?ordinary\s+course(?:\s+of\s+business)?(?:\s+consistent\s+with\s+past\s+practice)?)/i,
  },
  {
    key: 'IOC-PRESERVE',
    category: 'Preservation of Relationships',
    label: 'Use commercially reasonable efforts to preserve present relationships with suppliers, licensors, licensees, Governmental Entities and others having material business dealings',
    // "use commercially reasonable / reasonable best efforts to preserve its
    // present relationships with suppliers, licensors, licensees, ..." —
    // captures ONLY the relationship-preservation limb. Stops at sentence end
    // or at the start of the next clause ("and maintain" / "; and").
    // Audit-2 item 5: second alternative admits the equally common
    // "preserve intact its current/present business organization(s) [and
    // relationships / , keep available the services of its officers ...]"
    // shape (Mr. Cooper §5.1, Cooper Tire §5.1) that the relationships-only
    // pattern missed — the whole limb through to the ";"/"." boundary.
    re: /(?:(?:use\s+(?:its\s+)?(?:commercially\s+reasonable|reasonable\s+best|reasonable|best)\s+efforts\s+to\s+)?preserve\s+(?:(?:its\s+)?(?:present\s+)?relationships[^.]{0,400}?(?=(?:\s+and\s+maintain\b|\.|;\s+and\b|$))|intact\s+its\s+(?:present|current)\s+business\s+organizations?[^.;]{0,500}))/i,
  },
  {
    key: 'IOC-MAINTAIN',
    category: 'Maintain Business Organization',
    label: 'Maintain material assets and business organization intact in all material respects',
    // "maintain its material assets and business organization intact ..."
    // Stop at ";" as well as "." so a trailing "; provided that ..." proviso
    // stays intact in the residual instead of being swallowed mid-word
    // (Metsera: "...with respect to mat|ters specifically addressed...").
    re: /(?:maintain\s+(?:its\s+)?(?:material\s+assets\s+and\s+)?business\s+organization[^.;]{0,200}?(?:intact|in\s+(?:all\s+)?material\s+respects)[^.;]{0,120})/i,
  },
  {
    key: 'IOC-NOACTION',
    category: 'General No-Action Restriction',
    label: 'General prohibition on actions outside the ordinary course',
    re: /(?:shall\s+not\s+take\s+(?:any\s+)?action[^.]{0,200}?(?:outside|other\s+than\s+in)\s+the\s+ordinary\s+course(?:\s+of\s+business)?)/i,
  },
  {
    key: 'IOC-NEWLINE',
    category: 'No New Lines of Business',
    label: 'Target cannot enter into any new line of business',
    re: /(?:(?:shall\s+not|may\s+not|will\s+not|not\s+to)\s+(?:[^.]{0,80}?)enter\s+into\s+(?:any\s+)?new\s+lines?\s+of\s+business)/i,
  },
];

function iocAffirmativeStandardForText(text) {
  return /commercially\s+reasonable\s+efforts?/i.test(text)
    ? 'COMMERCIALLY_REASONABLE_EFFORTS'
    : 'FLAT';
}

function iocPreambleSpecForText(text) {
  const t = String(text || '');
  if (/maintain\s+(?:its\s+)?existence\s+in\s+good\s+standing/i.test(t)) {
    return IOC_PREAMBLE_PROVISIONS.find((p) => p.key === 'IOC-EXISTENCE');
  }
  if (/ordinary\s+course\s+of\s+business|ordinary\s+course/i.test(t)) {
    return IOC_PREAMBLE_PROVISIONS.find((p) => p.key === 'IOC-ORDINARY');
  }
  if (/preserve\s+intact|preserve\s+(?:the\s+)?current\s+relationships|relationships\s+with/i.test(t)) {
    return IOC_PREAMBLE_PROVISIONS.find((p) => p.key === 'IOC-PRESERVE');
  }
  if (/maintain\s+(?:its\s+)?(?:material\s+)?(?:assets|business\s+organization)/i.test(t)) {
    return IOC_PREAMBLE_PROVISIONS.find((p) => p.key === 'IOC-MAINTAIN');
  }
  return null;
}

function splitIocRomanAffirmativeRun(preambleText) {
  const text = String(preambleText || '');
  const markers = [];
  const re = /\(([ivx]+)\)\s+/gi;
  let m;
  while ((m = re.exec(text)) !== null) {
    const token = m[1].toLowerCase();
    const idx = ANNEX_ROMAN_ORDER.indexOf(token);
    if (idx >= 0) markers.push({ index: m.index, token, idx });
  }
  if (markers.length < 2) return null;
  const run = [];
  for (const mk of markers) {
    if (run.length === 0) {
      if (mk.idx === 0) run.push(mk);
      continue;
    }
    const prev = run[run.length - 1];
    if (mk.idx === prev.idx + 1) run.push(mk);
  }
  if (run.length < 2) return null;

  const obligationParts = [];
  for (let i = 0; i < run.length; i++) {
    const start = run[i].index;
    const end = i + 1 < run.length ? run[i + 1].index : text.length;
    const limbText = text.slice(start, end).replace(/\s+/g, ' ').trim().replace(/\s+and\s*$/i, '').replace(/[;,.]\s*$/, '');
    if (limbText.length < 20) continue;
    const spec = iocPreambleSpecForText(limbText);
    if (!spec) return null;
    obligationParts.push({
      key: spec.key,
      category: spec.category,
      label: spec.label,
      text: limbText,
      efforts_standard: iocAffirmativeStandardForText(limbText),
      startOffset: start,
    });
  }
  if (obligationParts.length < 2) return null;

  const firstStart = run[0].index;
  const residual = text.slice(0, firstStart).replace(/\s+/g, ' ').trim();
  return buildIocPreambleSplitResult(obligationParts, null, residual, preambleText);
}

function buildIocPreambleSplitResult(obligationParts, otherText, residual, preambleText) {
  return {
    obligations: obligationParts.map((p) => ({
      key: p.key,
      category: p.category,
      label: p.label,
      text: p.text,
      efforts_standard: p.efforts_standard || iocAffirmativeStandardForText(p.text),
    })),
    other: otherText
      ? {
          key: 'IOC-OTHER-AFFIRMATIVE',
          category: 'Other Affirmative Obligations',
          label: 'Other affirmative obligations in the IOC preamble (catch-all)',
          text: otherText,
          efforts_standard: iocAffirmativeStandardForText(otherText),
        }
      : null,
    sharedCarveOuts: residual,
    consolidated: {
      affirmativeCovenants: {
        key: 'IOC-AFFIRMATIVE',
        category: 'Affirmative Covenants',
        label: 'Affirmative covenants in the IOC preamble',
        text: obligationParts.map((p) => p.text).join(' ').trim()
          + (otherText ? ' ' + otherText : ''),
        limbs: obligationParts.map((p) => ({
          obligation_code: p.key,
          obligation_label: p.label,
          text: p.text,
          efforts_standard: p.efforts_standard || iocAffirmativeStandardForText(p.text),
          materialityQualifier: 'FLAT',
        })).concat(otherText
          ? [{ obligation_code: 'IOC-OTHER-AFFIRMATIVE',
               obligation_label: 'Other affirmative obligation',
               text: otherText,
               efforts_standard: iocAffirmativeStandardForText(otherText),
               materialityQualifier: 'FLAT' }]
          : []),
      },
      generalExceptions: residual && residual.length > 30
        ? {
            key: 'IOC-GENERAL-EXCEPTIONS',
            category: 'General Exceptions',
            label: 'Section-wide carve-outs that apply to all IOC restrictions',
            text: residual,
          }
        : null,
      negativePreamble: (() => {
        const at = findNegativePreambleStart(preambleText);
        if (at < 0) return null;
        const negText = preambleText.substring(at).trim();
        if (negText.length < 30) return null;
        return {
          key: 'IOC-NEGATIVE-PREAMBLE',
          category: 'Negative Covenants Preamble',
          label: 'Lead-in to the negative covenants list',
          text: negText,
          startOffset: at,
        };
      })(),
    },
  };
}

/**
 * Detect distinct affirmative / general obligations in an IOC preamble.
 * Returns an array of {key, category, label, text} parts plus a residual
 * "shared carve-outs" part (if any) that holds the section-wide framing.
 *
 * If no obligations are detected (rare — the preamble is just a carve-outs
 * intro), returns null so the caller falls back to the original single-provision
 * preamble behaviour.
 *
 * NOTE: only the IOC preamble text is examined here. The sub-clauses (a)/(b)/...
 * have already been peeled off by splitSubClauses.
 */
// P7 item 10: detect the SECOND preamble (the lead-in to the negative
// covenants list) inside an IOC section preamble. Returns the offset at
// which the negative preamble starts, or -1 if absent.
function findNegativePreambleStart(preambleText) {
  if (!preambleText) return -1;
  // Two common anchors:
  //   1) "In addition, without limiting the generality of the foregoing"
  //   2) "shall not, and shall not permit any [Subsidiary] to, do any of the following"
  const a1 = preambleText.search(/In addition,\s+without\s+limiting\s+the\s+generality\s+of\s+the\s+foregoing/i);
  const a2 = preambleText.search(/the\s+Company\s+shall\s+not,?\s+and\s+shall\s+not\s+permit\s+any\s+(?:Company\s+)?(?:Subsidiary|Subsidiaries)\s+to,?\s+do\s+any\s+of\s+the\s+following/i);
  const candidates = [a1, a2].filter((p) => p >= 0);
  if (candidates.length === 0) return -1;
  return Math.min(...candidates);
}

function splitIocPreamble(preambleText) {
  if (!preambleText || typeof preambleText !== 'string') return null;
  const romanSplit = splitIocRomanAffirmativeRun(preambleText);
  if (romanSplit) return romanSplit;
  const obligationParts = [];
  const consumedRanges = []; // [start, end) intervals already attributed to an obligation

  for (const spec of IOC_PREAMBLE_PROVISIONS) {
    const re = new RegExp(spec.re.source, spec.re.flags.includes('g') ? spec.re.flags : spec.re.flags + 'g');
    let m;
    while ((m = re.exec(preambleText)) !== null) {
      const start = m.index;
      const end = m.index + m[0].length;
      // Skip if heavily overlaps a previously matched obligation
      const overlap = consumedRanges.some(([s, e]) => start < e && end > s);
      if (overlap) continue;
      consumedRanges.push([start, end]);
      obligationParts.push({
        key: spec.key,
        category: spec.category,
        label: spec.label,
        text: preambleText.substring(start, end).trim(),
        startOffset: start,
      });
    }
  }

  if (obligationParts.length === 0) return null;

  // Audit-2 item 5: coordinated-infinitive efforts standard. In "shall use
  // commercially reasonable efforts to conduct ... AND TO preserve intact
  // ..." (Mr. Cooper §5.1) the efforts qualifier grammatically governs BOTH
  // infinitives, but the second limb's captured text starts at "preserve"
  // and so contains no efforts phrase of its own — deriving its standard
  // from the limb text alone would emit FLAT, overstating the obligation.
  // Tight gate: the limb must be IMMEDIATELY preceded by "and to" and an
  // efforts phrase must appear in the short preceding window (the same
  // sentence), otherwise leave the limb's own text to speak for itself.
  for (const part of obligationParts) {
    if (/\befforts?\b/i.test(part.text)) continue;
    const before = preambleText.slice(Math.max(0, part.startOffset - 220), part.startOffset);
    if (/\band\s+to\s*$/i.test(before) &&
        /(?:commercially\s+reasonable|reasonable\s+best|reasonable|best)\s+efforts\s+to\b/i.test(before)) {
      part.efforts_standard = iocAffirmativeStandardForText(before);
    }
  }

  // Build the "shared carve-outs" residual by removing the consumed obligation
  // spans. We keep the leading "Except as..." framing AND any text that wasn't
  // attributed to a specific obligation.
  consumedRanges.sort((a, b) => a[0] - b[0]);
  let residual = '';
  let cursor = 0;
  for (const [s, e] of consumedRanges) {
    if (s > cursor) residual += preambleText.substring(cursor, s);
    cursor = e;
  }
  if (cursor < preambleText.length) residual += preambleText.substring(cursor);
  residual = residual.replace(/\s+/g, ' ').trim();

  // Sort obligation parts by their position in the original text so we
  // preserve the drafter's order in the UI.
  obligationParts.sort((a, b) => a.startOffset - b.startOffset);

  // Look for any catch-all "in addition" / "without limiting" obligation
  // language in the residual — if there are still verb phrases like "shall"
  // remaining, capture them as "Other Affirmative Obligations".
  //
  // Guard: only scan the portion of the residual BEFORE any enumerated
  // sub-clause marker (e.g. "(a)", "(q)", "(1)"). Text after a sub-clause
  // marker is part of the enumerated restrictions list and must not be
  // miscoded as a preamble-level affirmative obligation.
  let otherText = null;
  if (residual) {
    const subClauseMarker = residual.match(/\(([a-z]|\d+)\)/i);
    const scanText = subClauseMarker
      ? residual.substring(0, subClauseMarker.index)
      : residual;
    // Guard: "shall not be unreasonably withheld/delayed/conditioned" is the
    // consent-parenthetical boilerplate, not an affirmative obligation —
    // matching it produced a garbage IOC-OTHER-AFFIRMATIVE provision
    // (Metsera). Require the verb phrase to be a real duty.
    const dutyRe = /\b(?:shall|will|agrees? to|must)\b(?!\s+not\s+be\s+unreasonably)[^.]{20,}/i;
    if (dutyRe.test(scanText)) {
      // Extract the trailing "shall ..." clause(s)
      const otherMatch = scanText.match(/(?:shall|will|agrees? to|must)(?!\s+not\s+be\s+unreasonably)[^.]+\.?/i);
      if (otherMatch) {
        otherText = otherMatch[0].trim();
      }
    }
  }

  return buildIocPreambleSplitResult(obligationParts, otherText, residual, preambleText);
}

// ---------------------------------------------------------------------------
// FB3 item 2: deterministic IOC affirmative-limb standard normalization.
//
// The IOC preamble prompt asks the LLM for ONE positiveObligations limb per
// affirmative duty. Historically each limb carried TWO independently-guessed
// fields — "efforts_standard" (from EFFORTS_STANDARDS) AND "materialityQualifier"
// (from IOC_AFFIRMATIVE_STANDARDS, a dict that ALSO contains effort codes) —
// and nothing stopped the model from populating both with DIFFERENT values
// on the same limb (live Metsera bug: the Preservation-of-Relationships limb
// carried efforts_standard: COMMERCIALLY_REASONABLE_EFFORTS *and*
// materialityQualifier: FLAT simultaneously, rendering as two contradictory
// pills). deriveIocLimbEffortsStandard re-derives the ONE correct standard
// straight from the limb's own obligation text — deterministic, no AI call,
// so it can never disagree with itself — and normalizeIocLimbEffortsStandards
// applies it to every limb the pipeline produces, stripping the legacy
// materialityQualifier/materiality keys so they can never leak back in.
// ---------------------------------------------------------------------------

// Ordered so a more-specific phrase is tested before a phrase it is a
// substring of (e.g. "commercially reasonable efforts" contains "reasonable
// efforts"; "reasonable best efforts" contains "best efforts").
const IOC_EFFORTS_STANDARD_PATTERNS = [
  ['HELL_OR_HIGH_WATER', /hell[\s-]or[\s-]high[\s-]water/i],
  ['COMMERCIALLY_REASONABLE_EFFORTS', /commercially\s+reasonable\s+efforts?/i],
  ['REASONABLE_BEST_EFFORTS', /reasonable\s+best\s+efforts?/i],
  ['GOOD_FAITH_EFFORTS', /good\s+faith\s+efforts?/i],
  ['BEST_EFFORTS', /\bbest\s+efforts?\b/i],
  ['REASONABLE_EFFORTS', /\breasonable\s+efforts?\b/i],
];

/**
 * Derive the SOLE efforts-standard code for an IOC affirmative limb from its
 * own obligation text. Returns an EFFORTS_STANDARDS code — FLAT when the
 * limb states a direct, unqualified duty (no "use ... efforts to" language),
 * e.g. "conduct its business in the ordinary course" or "maintain its
 * material assets ... in all material respects". Never returns a
 * materiality-flavored code (MATERIAL / MATERIAL_RESPECTS / ORDINARY_COURSE)
 * — those describe the limb's SUBJECT MATTER, not its effort/strength
 * qualifier, and must never be echoed back as if they were the standard.
 */
function deriveIocLimbEffortsStandard(text) {
  const t = typeof text === 'string' ? text : '';
  for (const [code, re] of IOC_EFFORTS_STANDARD_PATTERNS) {
    if (re.test(t)) return code;
  }
  return 'FLAT';
}

/**
 * Normalize every positiveObligations limb across all provisions (both the
 * split preamble obligations — IOC-ORDINARY / IOC-PRESERVE / IOC-MAINTAIN /
 * etc. — and the single-clause IOC-POSITIVE-PREAMBLE chapeau) to carry
 * EXACTLY ONE standard field, efforts_standard, deterministically derived
 * from the limb's own text. Deletes any legacy materialityQualifier /
 * materiality key on the limb so it can never re-introduce a contradiction
 * downstream. Fully deterministic; no AI calls; idempotent.
 */
function normalizeIocLimbEffortsStandards(provisions) {
  if (!Array.isArray(provisions) || provisions.length === 0) return;
  for (const p of provisions) {
    if (!p || !p.features || typeof p.features !== 'object') continue;
    const limbs = p.features.positiveObligations;
    if (!Array.isArray(limbs) || limbs.length === 0) continue;
    for (const limb of limbs) {
      if (!limb || typeof limb !== 'object') continue;
      // Derive from the limb's own phrase FIRST, but also fall back to the
      // provision's own source text: the LLM's "obligation" phrase sometimes
      // trims the "use ... efforts to" prefix into the separate structured
      // field rather than repeating it inline (real Metsera data — the
      // stored "obligation" read "preserve its present relationships ..."
      // with NO efforts phrase, even though the provision's own text/full_text
      // carried "use commercially reasonable efforts to preserve ..."). For
      // the single shared IOC-POSITIVE-PREAMBLE chapeau (one provision, two+
      // limbs), the shared qualifier correctly applies to every limb sharing
      // that text — see the documented Landos example above.
      const source = [limb.obligation, limb.text, p.text, p.full_text]
        .filter((t) => typeof t === 'string')
        .join(' ');
      limb.efforts_standard = deriveIocLimbEffortsStandard(source);
      delete limb.effortsStandard;
      delete limb.materialityQualifier;
      delete limb.materiality;
    }
  }
}

function splitIocIncludedObligationTail(tail) {
  const cleaned = String(tail || '')
    .replace(/\bwithout\s+limitation\b/gi, '')
    .replace(/\s+/g, ' ')
    .trim();
  if (!cleaned) return [];
  return cleaned
    .replace(/\s*\((?:i|ii|iii|iv|v|vi|vii|viii|ix|x|\d+|[a-z])\)\s*/gi, '|||')
    .replace(/;\s+and\s+/gi, '|||')
    .replace(/;\s+/g, '|||')
    .replace(/\s+and\s+(?=(?:to\s+)?(?:use|using|perform|renew|preserve|retain|conduct|maintain)\b)/gi, '|||')
    .split('|||')
    .map((part) => part.replace(/^[,;\s]+|[,;\s]+$/g, '').trim())
    .filter(Boolean);
}

function normalizeIocObligationText(text) {
  return String(text || '')
    .toLowerCase()
    .replace(/\([^)]*\)/g, ' ')
    .replace(/\b(?:and\s+)?(?:to\s+)?(?:use|using)\s+(?:commercially\s+reasonable|reasonable\s+best|reasonable|best|good\s+faith)\s+efforts?\s+(?:to\s+)?/g, ' ')
    .replace(/\b(?:and\s+)?to\s+/g, ' ')
    .replace(/[^a-z0-9]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function liftIncludedObligationsFromLimbText(provisions) {
  if (!Array.isArray(provisions) || provisions.length === 0) return;
  for (const p of provisions) {
    if (!p || !p.features || typeof p.features !== 'object') continue;
    const limbs = p.features.positiveObligations;
    if (!Array.isArray(limbs) || limbs.length === 0) continue;

    const lifted = limbs.map((limb) => {
      if (!limb || typeof limb !== 'object') return limb;
      const obligation = String(limb.obligation || limb.text || '').trim();
      const match = obligation.match(/\b,?\s*including(?:\s+without\s+limitation)?\s+/i);
      const existing = Array.isArray(limb.includedObligations) ? limb.includedObligations : [];
      const parentStandard = limb.efforts_standard || deriveIocLimbEffortsStandard([obligation, p.text, p.full_text].filter(Boolean).join(' '));
      if (!match) {
        if (existing.length === 0) return limb;
        return {
          ...limb,
          includedObligations: existing.map((child) => ({
            ...child,
            efforts_standard: child.efforts_standard || child.effortsStandard || parentStandard,
          })),
        };
      }
      const head = obligation.slice(0, match.index).replace(/[,;\s]+$/g, '').trim();
      const tail = obligation.slice(match.index + match[0].length);
      const children = splitIocIncludedObligationTail(tail).map((part) => {
        const derived = deriveIocLimbEffortsStandard(part);
        return {
          obligation: part,
          efforts_standard: derived === 'FLAT' ? parentStandard : derived,
          appliesTo: limb.appliesTo || limb.applies_to || limb.scope || [],
        };
      });
      return {
        ...limb,
        obligation: head || obligation,
        efforts_standard: parentStandard,
        includedObligations: [...existing, ...children],
      };
    });

    const includedNorms = new Set();
    for (const limb of lifted) {
      for (const child of (Array.isArray(limb?.includedObligations) ? limb.includedObligations : [])) {
        const norm = normalizeIocObligationText(child?.obligation || child?.text || '');
        if (norm) includedNorms.add(norm);
      }
    }
    p.features.positiveObligations = lifted.filter((limb) => {
      const norm = normalizeIocObligationText(limb?.obligation || limb?.text || '');
      if (!norm || includedNorms.size === 0) return true;
      for (const childNorm of includedNorms) {
        if (norm === childNorm) return false;
        if (norm.length >= 24 && childNorm.includes(norm)) return false;
        if (childNorm.length >= 24 && norm.includes(childNorm)) return false;
      }
      return true;
    });
  }
}

/**
 * FB3 missed item 2: cross-deal comparability hook. Keyword-match a single
 * IOC sub-clause's OWN text against the same IOC_CATEGORY_META synonym
 * regexes already used for dollarThresholdsByCategory, and return EVERY
 * canonical category it hits (not just the first) — a bundled sub-clause
 * that bars both new indebtedness AND guaranteeing another Person's
 * indebtedness gets BOTH INDEBTEDNESS and THIRD_PARTY_OBLIGATIONS tags.
 * Deterministic; no AI calls.
 *
 * Wave-3 QA fix (false-positive pills on Heinz/Kraft + QXO dividends and
 * securities-issuance covenants): the raw synonym regexes were matched
 * against the WHOLE sub-clause, so incidental words in the exception tail
 * ("Cashless Settlements", "settlement of RSU Awards", "except for
 * acquisitions ... of Company Shares") and securities-mechanics operative
 * language ("redeem, purchase or otherwise acquire ... capital stock",
 * "Heinz Voting Debt", "sale, pledge, disposition ... of shares") stamped
 * unrelated restriction families onto the row. A wrong pill reads as a
 * confident wrong legal answer, so this tagger is precision-first:
 *   1. truncate at the first exception marker (except / other than /
 *      excluding / provided that) past a small leading-grace window, so
 *      only the operative restriction language is matched;
 *   2. mask known false-friend spans (share buy-back "redeem ... acquire"
 *      phrasing, the "Voting Debt" defined term, equity-award settlement
 *      mechanics) before matching;
 *   3. gate the two loosest categories on corroborating context —
 *      LITIGATION_SETTLEMENTS needs litigation words (claim / action /
 *      proceeding / ...), ASSET_SALES_LICENSES needs an asset-ish object
 *      (assets / properties / business / ...), so dispositions OF THE
 *      COMPANY'S OWN STOCK never tag as asset sales.
 * Under-tagging renders as "Not specified" (safe); over-tagging renders as
 * a wrong pill (harmful). IOC_CATEGORY_META itself is untouched — its
 * synonyms still serve dollarThresholdsByCategory consumers unchanged.
 */

// Exception-tail markers. Truncation only applies past a leading-grace
// window so chapeau-style "Except as set forth ..., the Company shall not"
// openings don't wipe the whole clause.
const IOC_RC_EXCEPTION_MARKER_RE = /\b(?:except|other\s+than|excluding|provided[,;]?\s+(?:that|however))\b/gi;
const IOC_RC_LEADING_GRACE_CHARS = 40;

// Spans whose words collide with restriction-family synonyms but describe
// something else entirely. Masked (replaced with spaces) before matching.
const IOC_RC_FALSE_FRIEND_MASKS = [
  // Share buy-back phrasing: "redeem, purchase or otherwise acquire ...
  // capital stock / Equity Interests" is equity mechanics, not M&A.
  /\b(?:redeem(?:s|ed|ing)?|repurchases?)\b[^.;]{0,100}?\bacquires?\b/gi,
  // "Voting Debt" is a defined term for voting debt SECURITIES in issuance
  // covenants — not an indebtedness restriction.
  /\bvoting\s+debt\b/gi,
  // Equity-award settlement mechanics, not litigation settlements.
  /\bcashless\s+settlements?\b/gi,
  /\bsettlements?\s+of\b[^.;]{0,80}?\b(?:rsus?|psus?|awards?|options?|units?|equity)\b/gi,
];

// Corroborating-context gates for the loosest synonym sets. The category is
// only tagged when the gate ALSO matches the prepared operative text.
const IOC_RC_CONTEXT_GATES = {
  LITIGATION_SETTLEMENTS: /\b(?:claims?|litigation|actions?|proceedings?|suits?|disputes?|arbitration|compromise)\b/i,
  ASSET_SALES_LICENSES: /\b(?:assets?|propert(?:y|ies)|business(?:es)?|divisions?|operations|product\s+lines?|real\s+property)\b/i,
};

// Operative-text preparation shared by the classifier: exception-tail
// truncation + false-friend masking. Exported-adjacent for tests via
// classifyIocRestrictionComponents itself.
function iocRestrictionOperativeText(text) {
  let t = String(text || '');
  IOC_RC_EXCEPTION_MARKER_RE.lastIndex = 0;
  let m;
  while ((m = IOC_RC_EXCEPTION_MARKER_RE.exec(t)) !== null) {
    if (m.index >= IOC_RC_LEADING_GRACE_CHARS) {
      t = t.slice(0, m.index);
      break;
    }
  }
  for (const mask of IOC_RC_FALSE_FRIEND_MASKS) {
    mask.lastIndex = 0;
    t = t.replace(mask, ' ');
  }
  return t;
}

function classifyIocRestrictionComponents(text) {
  const t = iocRestrictionOperativeText(text);
  if (!t.trim()) return [];
  const codes = [];
  for (const [code, meta] of Object.entries(IOC_CATEGORY_META || {})) {
    if (code === 'OTHER') continue;
    if (!(meta.synonyms || []).some((syn) => syn.test(t))) continue;
    const gate = IOC_RC_CONTEXT_GATES[code];
    if (gate && !gate.test(t)) continue;
    codes.push(code);
  }
  return codes;
}

/**
 * FB3 missed item 2: stamp `restrictionComponents` (array of
 * IOC_CATEGORY_CODES-style tags) on each IOC negative-covenant sub-clause —
 * the sections the classifier already splits out as IOC-T / IOC-B (the
 * lettered (a)/(b)/(c)... restrictions). The bare-'IOC' preamble/general-
 * exceptions/affirmative-obligation provisions are NOT sub-clauses and are
 * deliberately left untouched. Fully deterministic (keyword match against
 * the sub-clause's own text); no AI calls; idempotent — skips a provision
 * that already carries a non-empty restrictionComponents array.
 */
function stampIocRestrictionComponents(provisions) {
  if (!Array.isArray(provisions) || provisions.length === 0) return;
  for (const p of provisions) {
    if (!p || (p.type !== 'IOC-T' && p.type !== 'IOC-B')) continue;
    if (!p.features || typeof p.features !== 'object') p.features = p.features || {};
    if (Array.isArray(p.features.restrictionComponents) && p.features.restrictionComponents.length > 0) continue;
    const text = String(p.full_text || p.text || '');
    if (!text) continue;
    const codes = classifyIocRestrictionComponents(text);
    if (codes.length === 0) continue;
    p.features.restrictionComponents = codes;
  }
}

/**
 * Deterministic fallback category for IOC-T/IOC-B sub-clauses that the AI
 * classification pass (buildClassifyPrompt / the chunk-error catch) left
 * with no valid rubric code and no distinct AI-proposed category — i.e. it
 * would otherwise fall to the literal "Unclassified" bucket. Headed
 * sub-clauses like "(a) Dividends and Distributions." already get a real
 * category from `explicitIocCategory` at the section level in classify.js,
 * but un-headed continuation limbs — "(i) incur ... indebtedness", "(m)
 * settle ... any Proceeding" — are only ever split out here in extract.js
 * and never re-run through that matcher. Run the SAME canonical matcher
 * (`canonicalIocCategoryFromHeading`) against the sub-clause's own body text
 * so these limbs land in their existing canonical bucket instead of
 * Unclassified. Only applies to IOC-T / IOC-B; returns null (no-op) for
 * every other STRATEGY_A type and whenever the matcher finds no hit (e.g.
 * loans/investments limbs, before the LOANS_INVESTMENTS category existed).
 */
function iocSubClauseFallbackCategory(effectiveType, text) {
  if (effectiveType !== 'IOC-T' && effectiveType !== 'IOC-B') return null;
  // Body matcher (earliest-keyword-wins), NOT the heading matcher: sub-clause
  // bodies are multi-sentence and fixed-priority-first-match mis-fires on
  // incidental cross-references (a debt-securities limb naming an
  // "acquisition" carve-out, a loans limb later saying "accounting"). The
  // operative object that fixes the category sits near the clause start.
  const key = iocCategoryFromBody(String(text || ''));
  if (!key) return null;
  return iocCategoryLabel(key);
}

// ---------------------------------------------------------------------------
// Regex: sub-clause splitting for (a)/(b)/(c) boundaries
// ---------------------------------------------------------------------------

function splitSubClauses(sectionText, typeKey) {
  // Item 18: COND-FRUSTRATE is a single meta-rule, never split into (a)/(b)/(c).
  // Callers pass typeKey, not code — so we conservatively skip the COND-FRUSTRATE
  // split only when the section text body opens with an anti-frustration anchor.
  const isCondFrustrate = typeKey === 'COND-FRUSTRATE'
    || (typeKey === 'COND' && /(?:frustrat|no\s+party\s+may\s+rely\s+on)/i.test(sectionText));
  if (isCondFrustrate) return null;

  const romanNumerals = new Set([
    'i', 'ii', 'iii', 'iv', 'v', 'vi', 'vii', 'viii', 'ix', 'x', 'xi', 'xii',
  ]);
  const isCondType = typeKey.startsWith('COND');
  const isTermrType = typeKey.startsWith('TERMR');
  const isIocType = typeKey === 'IOC';
  const skipRoman = isCondType || isTermrType;
  const clausePattern = /(?:^|\n)\s*\(([a-z]+)\)\s*/g;
  const rawMatches = [];
  let m;

  while ((m = clausePattern.exec(sectionText)) !== null) {
    if (skipRoman && romanNumerals.has(m[1])) continue;
    // Item 13a: anchor each sub-clause at the "(" character (a CLEAN word
    // boundary) so neither prior provision swallows the leading letter of
    // the next sub-clause, nor does the next sub-clause start mid-word.
    // m[0] looks like "\n  (d) " or "(d) ". The "(" is at the m.index +
    // (m[0].indexOf('(')) position; computing that directly is safer than
    // relying on the \n offset + \s* gymnastics.
    const parenPos = m.index + m[0].indexOf('(');
    if (parenPos < 0) continue;
    rawMatches.push({ index: parenPos, letter: m[1] });
  }

  // Also catch inline sub-clauses after sentence boundaries. IOC covenants
  // commonly nest substantive roman limbs after a colon/semicolon in a single
  // paragraph: "(b) the Company shall not: (i) ...; (ii) ...".
  const inlinePattern = isIocType
    ? /[.;:]\s+\(([a-z]+)\)\s*/g
    : /\.\s+\(([a-z]+)\)\s*/g;
  while ((m = inlinePattern.exec(sectionText)) !== null) {
    if (skipRoman && romanNumerals.has(m[1])) continue;
    const pos = m.index + m[0].indexOf('(');
    if (rawMatches.some((x) => Math.abs(x.index - pos) < 5)) continue;
    rawMatches.push({ index: pos, letter: m[1] });
  }

  rawMatches.sort((a, b) => a.index - b.index);
  const matches = [];
  if (isIocType) {
    let currentAlpha = null;
    let currentAlphaIndex = null;
    let currentAlphaOpensRomanList = false;
    for (const item of rawMatches) {
      const token = String(item.letter || '').toLowerCase();
      const isRoman = romanNumerals.has(token);
      if (!isRoman) {
        currentAlpha = token;
        currentAlphaIndex = item.index;
        currentAlphaOpensRomanList = false;
        matches.push({ ...item, letter: token });
        continue;
      }
      const nestedUnderAlpha = currentAlpha && (
        currentAlphaOpensRomanList
        || isNestedIocRoman(sectionText, currentAlphaIndex, item.index)
      );
      if (!nestedUnderAlpha && token.length === 1) {
        currentAlpha = token;
        currentAlphaIndex = item.index;
        currentAlphaOpensRomanList = false;
        matches.push({ ...item, letter: token });
        continue;
      }
      if (!isSubstantiveIocRoman(sectionText, item.index)) continue;
      if (nestedUnderAlpha) currentAlphaOpensRomanList = true;
      matches.push({
        ...item,
        letter: nestedUnderAlpha ? `${currentAlpha}.${token}` : token,
      });
    }
  } else {
    matches.push(...rawMatches);
  }
  matches.sort((a, b) => a.index - b.index);

  if (matches.length < 2) return null;

  const parts = [];

  // Preamble before first sub-clause
  if (matches[0].index > 50) {
    const preamble = sectionText.substring(0, matches[0].index).trim();
    if (preamble.length > 30) {
      parts.push({ letter: '_preamble', text: preamble });
    }
  }

  // Each sub-clause
  for (let i = 0; i < matches.length; i++) {
    const start = matches[i].index;
    const end = i + 1 < matches.length ? matches[i + 1].index : sectionText.length;
    const text = sectionText.substring(start, end).trim();
    if (text.length < 20) continue;
    parts.push({ letter: matches[i].letter, text });
  }

  // COND refinement: tender-offer Annex I (and some one-step) drafting bundles
  // the covenant-performance condition and the rep-accuracy bring-down into a
  // SINGLE lettered paragraph — e.g. "(b) (i) the Company has breached or
  // failed to comply … covenants … (ii) the representations and warranties …".
  // skipRoman correctly keeps romans whole (the (x)/(y) date mechanics inside
  // the bring-down must not fragment), so without help this arrives at the
  // classifier as ONE unit that can only carry ONE code — the covenant limb is
  // structurally unclassifiable. When BOTH anchors appear in one part, split
  // once at the roman boundary between them.
  if (isCondType) {
    const refined = [];
    for (const part of parts) {
      const split = splitConflatedCondPart(part);
      if (split) refined.push(...split);
      else refined.push(part);
    }
    return refined.length > 0 ? refined : null;
  }

  // TERMR refinement: Metsera 8.01(b) bundles TWO distinct termination
  // rights — (i) the outside-date right and (ii) the Legal-Restraint-final-
  // and-non-appealable right — into ONE lettered sub-clause, because
  // skipRoman (above) deliberately keeps roman markers whole for TERMR so
  // date mechanics like "the earlier of (x) ... and (y) ..." don't fragment.
  // Left alone, that single lettered part can only carry ONE canonical code,
  // so the Legal Restraint termination right never gets its own row — the
  // page falsely shows the section as ONLY an Outside Date provision. Reuses
  // the SAME enumerated-run machinery as splitOfferConditionAnnex
  // (findEnumeratedMarkers + longestMonotonicRun over ANNEX_ROMAN_ORDER) —
  // see splitTermrSubClauseRomans below — rather than duplicating a bespoke
  // regex boundary the way splitConflatedCondPart does for COND.
  if (isTermrType) {
    const refined = [];
    for (const part of parts) {
      if (part.letter === '_preamble') { refined.push(part); continue; }
      const sub = splitTermrSubClauseRomans(part.text);
      if (sub) {
        for (const s of sub) refined.push({ letter: `${part.letter}.${s.letter}`, text: s.text });
      } else {
        refined.push(part);
      }
    }
    return refined.length > 0 ? refined : null;
  }

  return parts.length > 0 ? parts : null;
}

function isSubstantiveIocRoman(text, markerIndex) {
  const afterMarker = String(text || '').slice(markerIndex).replace(/^\([a-z]+\)\s*/i, '');
  const nextMarker = afterMarker.search(/\s\([a-z]+\)\s/);
  const head = (nextMarker >= 0 ? afterMarker.slice(0, nextMarker) : afterMarker).slice(0, 260);
  return /\b(?:shall|may|must|agree|commit|authorize|permit|solicit|enter\s+into|incur|make|acquire|dispose|sell|transfer|merge|consolidate|liquidate|declare|pay|issue|amend|waive|settle|license|lease|hire|terminate|modify|grant|create|form|invest)\b/i.test(head);
}

function isNestedIocRoman(text, alphaIndex, romanIndex) {
  if (typeof alphaIndex !== 'number' || typeof romanIndex !== 'number' || romanIndex <= alphaIndex) return false;
  const between = String(text || '').slice(alphaIndex, romanIndex);
  if (between.length > 180) return false;
  return /:\s*$/.test(between) || /\bshall\s+not\s*,?\s*$|\bshall\s+not\s*:\s*$/i.test(between);
}

function formatSectionNumberWithSubclause(baseNum, letter) {
  if (!baseNum) return baseNum;
  if (!letter || letter === '_whole') return baseNum;
  return String(letter)
    .split('.')
    .filter(Boolean)
    .reduce((acc, part) => `${acc}(${part})`, baseNum);
}

const COND_COVENANT_ANCHOR = /(?:breached\s+or\s+failed\s+to\s+comply|performed\s+(?:and|or)\s+complied|performed\s+in\s+all\s+material\s+respects|complied\s+with)[^.]{0,120}?(?:covenants|agreements|obligations)/i;
const COND_REP_ANCHOR = /representations\s+and\s+warranties/i;

/** Split one COND sub-clause containing BOTH the covenant-performance and
 *  rep-accuracy anchors at the roman-numeral boundary between them.
 *  Returns [partA, partB] or null when no clean split exists. */
function splitConflatedCondPart(part) {
  const text = part.text || '';
  const cov = text.match(COND_COVENANT_ANCHOR);
  const rep = text.match(COND_REP_ANCHOR);
  if (!cov || !rep) return null;
  const first = Math.min(cov.index, rep.index);
  const second = Math.max(cov.index, rep.index);
  if (second - first < 80) return null; // same breath, not two limbs

  // Roman markers between the two anchors — split at the LAST one before the
  // second anchor so trailing mechanics stay with their limb.
  const romanRe = /\((?:i|ii|iii|iv|v|vi|vii|viii|ix|x|xi|xii)\)\s/g;
  let boundary = -1;
  let m;
  while ((m = romanRe.exec(text)) !== null) {
    if (m.index > first && m.index <= second) boundary = m.index;
    if (m.index > second) break;
  }
  if (boundary <= 0) return null;

  const a = text.slice(0, boundary).trim();
  const b = text.slice(boundary).trim();
  if (a.length < 100 || b.length < 100) return null;
  return [
    { letter: `${part.letter}.1`, text: a },
    { letter: `${part.letter}.2`, text: b },
  ];
}

// ---------------------------------------------------------------------------
// Annex-style offer conditions (tender-offer "Annex I/A — Conditions to the
// Offer"): structural.js's annex carve-in captures the ENTIRE annex as one
// pseudo-section (see parseStructure step 5.5) on the assumption that Strategy
// A's splitSubClauses would then split its (a)/(b)/(c)… limbs the normal COND
// way. That holds when the annex enumerates with LETTERS, but real-world
// annexes (Pharmasset/Gilead among them) enumerate with ROMAN numerals —
// "(i) …; (ii) …; (iii) …" — and splitSubClauses deliberately SKIPS roman
// markers for COND types (skipRoman) because a roman inside an
// already-lettered COND sub-clause is normally a NESTED cross-reference
// mechanic (e.g. "clauses (x) and (y)"), not a new top-level condition. That
// guard is right for ordinary COND sections but wrong for an annex where
// romans ARE the only top-level structure — so the annex fell through to the
// "no sub-clauses found" branch and was emitted as ONE giant COND-B provision
// (Pharmasset: 5,199 chars, one row, COND count 5 — under the ingest-qa gate
// of 8 — even though the text enumerates 8 distinct conditions).
//
// This is a DETERMINISTIC, parse-only pre-split (no LLM) gated tightly so it
// can never fire on an ordinary short COND section:
//   - only for COND/COND-M/COND-B/COND-S sections
//   - only when the section text is at/above ANNEX_MIN_CHARS (an annex
//     bundling 4-8+ conditions runs several thousand characters; a normal
//     mutual/buyer/target conditions article that already splits correctly
//     via splitSubClauses is far shorter)
//   - only when it contains a genuinely MONOTONIC run of >= ANNEX_MIN_ITEMS
//     enumerated top-level markers, either lettered (a)/(b)/(c)… or roman
//     (i)/(ii)/(iii)…
// ---------------------------------------------------------------------------
const ANNEX_MIN_CHARS = 2000;
const ANNEX_MIN_ITEMS = 4;
const ANNEX_ROMAN_ORDER = [
  'i', 'ii', 'iii', 'iv', 'v', 'vi', 'vii', 'viii', 'ix', 'x',
  'xi', 'xii', 'xiii', 'xiv', 'xv', 'xvi', 'xvii', 'xviii', 'xix', 'xx',
];
const ANNEX_ALPHA_ORDER = 'abcdefghijklmnopqrstuvwxyz'.split('');

// Find every "(x) " top-level parenthetical marker in the text — same
// adjacency rules as splitSubClauses's clausePattern/inlinePattern (marker
// must open a line, or follow ". ") so mid-sentence cross-references like
// "Section 4.1(a), Section 4.1(b)" or "(the Minimum Tender Condition)" can
// never qualify as markers.
function findEnumeratedMarkers(sectionText) {
  const markers = [];
  const linePattern = /(?:^|\n)\s*\(([a-z]+)\)\s/g;
  let m;
  while ((m = linePattern.exec(sectionText)) !== null) {
    markers.push({ index: m.index + m[0].indexOf('('), token: m[1] });
  }
  const inlinePattern = /\.\s+\(([a-z]+)\)\s/g;
  while ((m = inlinePattern.exec(sectionText)) !== null) {
    const pos = m.index + m[0].indexOf('(');
    if (markers.some((x) => Math.abs(x.index - pos) < 5)) continue;
    markers.push({ index: pos, token: m[1] });
  }
  markers.sort((a, b) => a.index - b.index);
  return markers;
}

// Longest strictly-monotonic run of markers matching `order` (either the
// roman-numeral sequence or the alphabet), starting at order[0]. Tolerates a
// SMALL gap (a marker the regex missed) but rejects wild jumps and stray
// out-of-sequence markers (e.g. nested "(A)/(B)/(C)" rep-bringdown refs,
// which are uppercase and never reach this function anyway, or a one-off
// nested letter that doesn't continue the sequence).
function longestMonotonicRun(markers, order) {
  const MAX_GAP = 2;
  const seq = [];
  let lastIdx = -1;
  for (const mk of markers) {
    const idx = order.indexOf(mk.token);
    if (idx < 0) continue;
    if (idx === 0 && seq.length === 0) {
      seq.push(mk);
      lastIdx = 0;
      continue;
    }
    if (seq.length > 0 && idx > lastIdx && idx <= lastIdx + MAX_GAP) {
      seq.push(mk);
      lastIdx = idx;
    }
    // else: stray/out-of-sequence marker — ignore, keep scanning.
  }
  return seq;
}

// Minimum roman-numeral run inside a single already-lettered TERMR sub-clause
// for splitTermrSubClauseRomans to fire. Deliberately LOWER than
// ANNEX_MIN_ITEMS (4) — this operates on one short lettered paragraph, not a
// whole multi-thousand-character annex, and the real-world shape (Metsera
// 8.01(b): outside date + Legal Restraint) is exactly two limbs.
const TERMR_ROMAN_MIN_ITEMS = 2;

/**
 * Split a single TERMR sub-clause's roman-numbered limbs into separate parts
 * when the text bundles >= TERMR_ROMAN_MIN_ITEMS distinct roman-enumerated
 * termination triggers — e.g. Metsera 8.01(b): "(b) ... may be terminated ...
 * if (i) the Effective Time shall not have occurred by the Outside Date ... or
 * (ii) any Legal Restraint permanently preventing or prohibiting consummation
 * of the Merger shall be in effect and shall have become final and
 * non-appealable ...". Reuses the SAME enumerated-run detection as
 * splitOfferConditionAnnex (findEnumeratedMarkers + longestMonotonicRun over
 * ANNEX_ROMAN_ORDER) rather than a bespoke regex. Any lead-in text before the
 * first roman marker (the shared "may be terminated ... if" chapeau) is
 * folded into the FIRST limb rather than emitted as its own preamble part —
 * it is only a few words of shared context, not a standalone provision like
 * a full annex chapeau. Returns null when the text doesn't bundle >= 2
 * roman-enumerated limbs (the common case — most TERMR sub-clauses are a
 * single right and must pass through untouched).
 */
function splitTermrSubClauseRomans(text) {
  if (!text) return null;
  const markers = findEnumeratedMarkers(text);
  if (markers.length < TERMR_ROMAN_MIN_ITEMS) return null;
  const run = longestMonotonicRun(markers, ANNEX_ROMAN_ORDER);
  if (run.length < TERMR_ROMAN_MIN_ITEMS) return null;

  const parts = [];
  for (let i = 0; i < run.length; i++) {
    const start = i === 0 ? 0 : run[i].index;
    const end = i + 1 < run.length ? run[i + 1].index : text.length;
    const partText = text.substring(start, end).trim();
    if (partText.length < 20) continue;
    parts.push({ letter: run[i].token, text: partText });
  }
  return parts.length > 1 ? parts : null;
}

/**
 * Deterministic pre-split for annex-style offer-conditions sections. Returns
 * an array of {letter, text} parts (chapeau as letter '_preamble', one part
 * per enumerated condition) shaped exactly like splitSubClauses' return value
 * so callers can use it as a drop-in replacement, or null when the section
 * doesn't match the annex shape (short COND sections pass through untouched).
 */
function splitOfferConditionAnnex(sectionText, typeKey) {
  if (!typeKey || typeof typeKey !== 'string' || !typeKey.startsWith('COND')) return null;
  if (!sectionText || sectionText.length < ANNEX_MIN_CHARS) return null;

  const markers = findEnumeratedMarkers(sectionText);
  if (markers.length < ANNEX_MIN_ITEMS) return null;

  const romanRun = longestMonotonicRun(markers, ANNEX_ROMAN_ORDER);
  const alphaRun = longestMonotonicRun(markers, ANNEX_ALPHA_ORDER);
  const run = romanRun.length >= alphaRun.length ? romanRun : alphaRun;
  if (run.length < ANNEX_MIN_ITEMS) return null;

  const parts = [];
  const first = run[0];
  if (first.index > 50) {
    const preamble = sectionText.substring(0, first.index).trim();
    if (preamble.length > 30) parts.push({ letter: '_preamble', text: preamble });
  }
  for (let i = 0; i < run.length; i++) {
    const start = run[i].index;
    const end = i + 1 < run.length ? run[i + 1].index : sectionText.length;
    const text = sectionText.substring(start, end).trim();
    if (text.length < 20) continue;
    parts.push({ letter: run[i].token, text });
  }
  return parts.length > 0 ? parts : null;
}

// ---------------------------------------------------------------------------
// Regex: definition splitting ("TERM" means ...)
// ---------------------------------------------------------------------------

// Normalize a captured defined term: collapse internal whitespace (newlines,
// tabs, multiple spaces) into single spaces. EDGAR PDFs frequently wrap
// "Clinical Trial Milestone Payment" across two lines as "Clinical\nTrial
// Milestone Payment"; without this normalization the canonicalTerm carries
// the literal newline and breaks display + dedupe.
function normalizeTerm(s) {
  return String(s || '').replace(/\s+/g, ' ').trim();
}

function splitDefinitions(sectionText) {
  const defPattern =
    /[“"]([^”"]+)[”"][^“"\n]{0,40}?\b(?:means?|shall\s+mean|has\s+the\s+meaning|shall\s+have\s+the\s+meaning)\b/g;

  const matches = [];
  let m;
  while ((m = defPattern.exec(sectionText)) !== null) {
    // Validate: must be near start of line or after sentence punctuation
    const before = sectionText.substring(Math.max(0, m.index - 200), m.index);
    const lastNL = before.lastIndexOf('\n');
    if (lastNL !== -1) {
      const sinceLine = before.substring(lastNL + 1);
      const nonWS = sinceLine.replace(/\s/g, '').length;
      if (nonWS > 20) continue;
    } else if (m.index > 20) {
      const trimmedBefore = before.trimEnd();
      if (trimmedBefore.length > 0 && !/[.;:!?)\]]$/.test(trimmedBefore)) continue;
    }
    matches.push({ index: m.index, term: normalizeTerm(m[1]) });
  }

  // UNQUOTED Title-Case-Term "means" pattern. Newer EDGAR exhibits
  // (Pfizer/Metsera style) print defined terms in italics; once formatting is
  // stripped the term is bare Title-Case / ALL-CAPS-acronym text. This MUST
  // run ALWAYS (not only when no quoted defs were found) — a single quoted def
  // earlier in the section previously suppressed the whole pass, causing the
  // remaining unquoted terms (e.g. "FDA means ...", "ESPP Purchase Right means
  // ...") to merge into the prior definition's body.
  {
    // Term token: a Title-Case word OR an ALL-CAPS acronym (FDA, ESPP, SEC),
    // followed by up to 5 more such tokens. Separators: space / - / & / , .
    const TOKEN = '(?:[A-Z][A-Za-z]+|[A-Z]{2,})';
    const unquotedPattern = new RegExp(
      `(^|\\n|\\([a-z]\\)\\s+|\\([ivx]+\\)\\s+|\\(\\d+\\)\\s+)(${TOKEN}(?:[\\s\\-/&,]${TOKEN}){0,5})\\s+(means?|shall\\s+mean|has\\s+the\\s+meaning|shall\\s+have\\s+the\\s+meaning)\\b`,
      'g',
    );
    const seenIdx = new Set(matches.map((mm) => mm.index));
    let u;
    while ((u = unquotedPattern.exec(sectionText)) !== null) {
      const termStart = u.index + u[1].length;
      const term = normalizeTerm(u[2]);
      if (term.length < 2 || term.length > 80) continue;
      // Skip bare structural/common words when the "term" is a single token.
      if (!/\s/.test(term) && /^(?:Section|Article|Closing|Effective|This|The|Other|Person|Parent|Company|Subsidiary|Subsidiaries|Affiliate|Affiliates|Party|Parties|Stockholder|Stockholders|Each|Such|Any|No|All|Schedule|Exhibit|Annex)$/.test(term)) {
        continue;
      }
      // Dedupe against quoted-pass hits at (nearly) the same offset.
      if ([...seenIdx].some((ix) => Math.abs(ix - termStart) < 5)) continue;
      seenIdx.add(termStart);
      matches.push({ index: termStart, term });
    }
    // Sort by index since the two regex passes can interleave.
    matches.sort((a, b) => a.index - b.index);
  }

  if (matches.length === 0) return null;

  const parts = [];

  // Preamble
  if (matches[0].index > 50) {
    const preamble = sectionText.substring(0, matches[0].index).trim();
    if (preamble.length > 30) {
      parts.push({ term: '_preamble', text: preamble });
    }
  }

  for (let i = 0; i < matches.length; i++) {
    const start = matches[i].index;
    const end = i + 1 < matches.length ? matches[i + 1].index : sectionText.length;
    const text = sectionText.substring(start, end).trim();
    if (text.length < 20) continue;
    parts.push({ term: matches[i].term, text });
  }

  return parts.length > 0 ? parts : null;
}

// ---------------------------------------------------------------------------
// Inline definition detection — finds defined terms defined in the middle of
// running prose anywhere in the agreement (e.g. an "Acquisition Proposal"
// defined inside Section 5.02 (NOSOL)). Used to augment Strategy D so that
// definitions scattered through the body of the agreement are also captured.
// ---------------------------------------------------------------------------

/**
 * Scan a block of text for inline definitions. Returns an array of
 *   { term, text, startCharOffset, matchedPattern }
 *
 * Patterns matched:
 *   1. "Term" (means|shall mean|has the meaning|shall have the meaning) ...
 *   2. (the "Term") / ("Term") — parenthetical definitions
 */
function findInlineDefinitions(sectionText) {
  if (!sectionText || typeof sectionText !== 'string') return [];
  const found = [];
  const seenAtOffset = new Set();

  // P7 item 15 — Pattern 0: anchor on the «term» italic-preservation marker
  // emitted by stripHtml. When a phrase wrapped in « » is immediately
  // followed by "means" / "shall mean" / "has the meaning", capture it as a
  // definition WITHOUT the Title-Case-only constraint (italicized terms can
  // start with "the", "any", etc.).
  const markerPattern = /«\s*([^»\n]{1,120})\s*»\s*(?:\(\s*[“"]([^”"]{1,80})[”"]\s*\)\s*)?(?:means?|shall\s+mean|has\s+the\s+meaning|shall\s+have\s+the\s+meaning)\b/g;
  let mm;
  while ((mm = markerPattern.exec(sectionText)) !== null) {
    // Prefer the parenthetical quoted alias if present, else the « » phrase.
    const term = normalizeTerm(mm[2] || mm[1]);
    if (!term || term.length < 2 || term.length > 80) continue;
    if (seenAtOffset.has(mm.index)) continue;
    seenAtOffset.add(mm.index);
    const start = mm.index;
    let end = Math.min(sectionText.length, start + 1500);
    const tail = sectionText.substring(start, end);
    const minBodyLen = (mm.index + mm[0].length - start) + 80;
    const re = /[.;]\s+(?=[A-Z(])/g;
    let pm;
    while ((pm = re.exec(tail)) !== null) {
      if (pm.index > minBodyLen) {
        end = start + pm.index + 1;
        break;
      }
    }
    if (end - start > 1200) end = start + 1200;
    const text = sectionText.substring(start, end).trim();
    if (text.length < 20) continue;
    found.push({
      term,
      text,
      startCharOffset: start,
      matchedPattern: 'italic-marker',
    });
  }

  // Pattern 1: "Term" means/shall mean/has the meaning ...
  const meansPattern =
    /[“"]([^”"]{1,80})[”"][^“"\n.;]{0,40}?\b(means?|shall\s+mean|has\s+the\s+meaning|shall\s+have\s+the\s+meaning)\b/g;
  let m;
  while ((m = meansPattern.exec(sectionText)) !== null) {
    const term = normalizeTerm(m[1]);
    if (!term || term.length < 2 || term.length > 80) continue;
    if (seenAtOffset.has(m.index)) continue;
    seenAtOffset.add(m.index);

    // Take from this match forward until the next sentence boundary or
    // ~1200 chars, so we capture the body of the definition. EXCEPTION: an
    // MAE-flavoured definition enumerates 5-15 carve-outs as a long
    // semicolon-separated list AFTER the core sentence; the normal "stop at
    // the first '; '" boundary + 1200-char cap chop them off (the Landos
    // "carveouts: 0" bug). For MAE terms, skip the early boundary cut and use
    // a much larger window so the whole carve-out list is captured.
    const isMaeTerm = /material\s+adverse\s+(?:effect|change)/i.test(term);
    const start = m.index;
    let end = Math.min(sectionText.length, start + (isMaeTerm ? 8500 : 1500));
    if (!isMaeTerm) {
      const tail = sectionText.substring(start, end);
      const minBodyLen = (m.index + m[0].length - start) + 80;
      const re = /[.;]\s+(?=[A-Z(])/g;
      let pm;
      while ((pm = re.exec(tail)) !== null) {
        if (pm.index > minBodyLen) {
          end = start + pm.index + 1;
          break;
        }
      }
    }
    const hardCap = isMaeTerm ? 8000 : 1200;
    if (end - start > hardCap) end = start + hardCap;

    const text = sectionText.substring(start, end).trim();
    if (text.length < 20) continue;
    found.push({
      term,
      text,
      startCharOffset: start,
      matchedPattern: m[2].toLowerCase().includes('meaning') ? 'has-the-meaning' : 'means',
    });
  }

  // Pattern 2: parenthetical definitions — (the "Term") or ("Term")
  const parenPattern =
    /\(\s*(?:the\s+|each\s+(?:an?\s+)?|an?\s+)?[“"]([^”"\n]{1,80})[”"]\s*\)/g;
  let pm2;
  while ((pm2 = parenPattern.exec(sectionText)) !== null) {
    const term = normalizeTerm(pm2[1]);
    if (!term || term.length < 2 || term.length > 80) continue;
    if (seenAtOffset.has(pm2.index)) continue;
    if (!/^[A-Z]/.test(term)) continue;
    seenAtOffset.add(pm2.index);

    // A parenthetical LABELS a term; its definition is the ANTECEDENT clause,
    // so capture the sentence ENDING at the parenthetical (walk back to the last
    // boundary within ~300 chars) plus the parenthetical itself — NOT a long
    // trailing window, which used to drag in the following sentence.
    const lookBack = Math.max(0, pm2.index - 300);
    const back = sectionText.substring(lookBack, pm2.index);
    let sentStart = lookBack;
    const re2 = /(?:[.;:]\s+(?=[A-Z(])|\n\s*\n)/g;
    let r;
    let lastIdx = -1;
    while ((r = re2.exec(back)) !== null) lastIdx = r.index + r[0].length;
    if (lastIdx >= 0) sentStart = lookBack + lastIdx;
    const end = Math.min(sectionText.length, pm2.index + pm2[0].length + 40);
    const text = sectionText.substring(sentStart, end).trim();
    if (text.length < 20 || text.length > 600) continue;
    // Index-of-defined-terms guard: at the front-of-document term index the
    // "antecedent" is a run of "term  3.01(m)(i)" listings, not a definition.
    // Reject captures dense with section-number tokens.
    if ((text.match(/\b\d{1,2}\.\d{2}(?:\([a-z0-9]+\))*/g) || []).length >= 3) continue;

    found.push({
      term,
      text,
      startCharOffset: pm2.index,
      matchedPattern: 'parenthetical',
    });
  }

  // Pattern 3: UNQUOTED defined terms — "Title Case Term means …".
  // Many newer EDGAR exhibits (e.g. Pfizer/Metsera) print defined terms in
  // italics rather than quotes; once HTML formatting is stripped the term
  // is left as bare Title-Case text. We anchor strictly so we don't slurp
  // up every Sentence beginning with a capital word followed by "means".
  // Anchors:
  //   - Start of line / paragraph, OR after a paragraph marker like "(i)",
  //     "(a)", "(1)", OR after sentence-ending ". ", "; ", ":\n", "\n\n".
  //   - Term is 1-6 Title-Case words (each beginning with a capital letter),
  //     with optional lowercase connectors (or/and/of/the/to/in/on/for/by/with)
  //     and optional trailing acronym suffix (e.g. COVID-19).
  //   - Term length 4-80 chars total.
  //   - Term is immediately followed by " means" / " shall mean" /
  //     " has the meaning" / " shall have the meaning".
  const unquotedPattern =
    /(^|\n\s*|\.\s+|;\s+|:\s+|\([a-z]\)\s+|\([ivx]+\)\s+|\(\d+\)\s+)([A-Z][A-Za-z]+(?:-\d+)?(?:[\s\-/&,]+(?:or|and|of|the|to|in|on|for|by|with|[A-Z][A-Za-z]*(?:-\d+)?)){0,6})\s+(means?|shall\s+mean|has\s+the\s+meaning|shall\s+have\s+the\s+meaning)\b/g;
  let u;
  while ((u = unquotedPattern.exec(sectionText)) !== null) {
    const termStartOffset = u.index + u[1].length;
    if (seenAtOffset.has(termStartOffset)) continue;
    // Skip if a Pattern 1 quoted match already covered something nearby.
    let skip = false;
    for (const off of seenAtOffset) {
      if (Math.abs(off - termStartOffset) < 30) { skip = true; break; }
    }
    if (skip) continue;
    const term = normalizeTerm(u[2]);
    if (term.length < 4 || term.length > 80) continue;
    // Reject single-word "Section", "Article", "Closing", "Effective" etc.
    // that are merger-agreement boilerplate, not definitions.
    if (!/\s/.test(term) && /^(?:Section|Article|Closing|Effective|This|The|Other|Person|Parent|Company|Subsidiary|Subsidiaries|Affiliate|Affiliates|Party|Parties|Stockholder|Stockholders|Each|Such|Any|No|All|Schedule|Exhibit|Annex)$/.test(term)) {
      continue;
    }
    seenAtOffset.add(termStartOffset);
    // MAE-flavoured definitions enumerate a long ";"-separated carve-out list
    // after the core sentence — skip the early boundary cut and use a large
    // window so the whole list is captured (this `unquoted` pattern is the one
    // that catches Landos's Company "Material Adverse Effect" in Exhibit A).
    const isMaeTerm = /material\s+adverse\s+(?:effect|change)/i.test(term);
    const start = termStartOffset;
    let end = Math.min(sectionText.length, start + (isMaeTerm ? 8500 : 1500));
    if (!isMaeTerm) {
      const tail = sectionText.substring(start, end);
      const minBodyLen = (u.index + u[0].length - start) + 80;
      const re = /[.;]\s+(?=[A-Z(])/g;
      let pm;
      while ((pm = re.exec(tail)) !== null) {
        if (pm.index > minBodyLen) {
          end = start + pm.index + 1;
          break;
        }
      }
    }
    const hardCap = isMaeTerm ? 8000 : 1200;
    if (end - start > hardCap) end = start + hardCap;
    const text = sectionText.substring(start, end).trim();
    if (text.length < 20) continue;
    found.push({
      term,
      text,
      startCharOffset: start,
      matchedPattern: 'unquoted',
    });
  }

  // The initial capture windows are deliberately generous, but adjacent
  // dictionary-style definitions often begin with a quote after a blank
  // line. The sentence-boundary heuristic above did not treat that quote as
  // a boundary, so a short definition could absorb several following terms
  // before hitting its 1,200-character cap. Clamp each header-style hit to
  // the next detected header. Parenthetical aliases are excluded because
  // they can legitimately sit inside the preceding definition.
  const headers = found
    .filter((hit) => hit.matchedPattern !== 'parenthetical')
    .slice()
    .sort((a, b) => a.startCharOffset - b.startCharOffset);
  return found.map((hit) => {
    if (hit.matchedPattern === 'parenthetical') return hit;
    const next = headers.find((candidate) => candidate.startCharOffset > hit.startCharOffset);
    const capturedEnd = hit.startCharOffset + hit.text.length;
    if (!next || next.startCharOffset >= capturedEnd) return hit;
    const text = sectionText.substring(hit.startCharOffset, next.startCharOffset).trim();
    return text.length >= 20 ? { ...hit, text } : hit;
  });
}

// ---------------------------------------------------------------------------
// IOC mirrored-section party-flip detection ("merger of equals" style)
// ---------------------------------------------------------------------------
// Some IOC sections cover BOTH parties in ONE section — e.g. Starwood/
// Marriott §4.1: "(a) Conduct of Business by Starwood ... (b) Conduct of
// Business by Marriott ...". classify.js types the WHOLE section from its
// top-level header (IOC-T, since bare "Conduct of Business" defaults to
// target), so the acquirer's sub-clause — and everything nested under or
// following it — is mislabeled IOC-T. classify.js only ever sees the
// section's OWN heading, not headings buried in the body, so the fix has to
// happen here, where the section has already been split into its lettered
// (a)/(b)/(c) sub-clauses.
//
// Heuristic (same positional convention already relied on by the REP
// section-ordering fixup and the codename conduct fixup in classify.js): the
// FIRST top-level lettered clause bearing a "Conduct of Business by/of <Name>"
// heading is always the TARGET's; a LATER top-level clause naming a
// DIFFERENT entity is the PARENT/acquirer's. Returns the letter at which the
// party flips (that clause and every later clause/descendant belong to the
// other party), or null if no flip is detected (the overwhelming majority of
// single-party IOC sections).
const CONDUCT_BY_HEADING_RE = /^\(?[a-z]{1,3}\)?\s*conduct\s+of\s+(?:business\s+)?(?:by|of)\s+([A-Z][\w&'.,-]*(?:\s+[A-Z&][\w&'.,-]*){0,4})\b/i;

function detectIocPartyFlipIndex(subClauseParts) {
  if (!Array.isArray(subClauseParts)) return null;
  let firstName = null;
  for (let i = 0; i < subClauseParts.length; i++) {
    const part = subClauseParts[i];
    const letter = part && part.letter;
    if (!letter || letter === '_preamble' || letter.includes('.')) continue; // top-level clauses only
    const m = CONDUCT_BY_HEADING_RE.exec(String(part.text || '').trim());
    if (!m) continue;
    const name = m[1].trim().toLowerCase();
    if (!firstName) {
      firstName = name;
      continue;
    }
    if (name !== firstName) return i;
  }
  return null;
}

function detectIocPartyFlipLetter(subClauseParts) {
  const idx = detectIocPartyFlipIndex(subClauseParts);
  return idx == null ? null : subClauseParts[idx].letter;
}

// ---------------------------------------------------------------------------
// Strategy A: Regex-split a section into sub-clauses → batch AI-classify each.
// Routed types (STRATEGY_A_TYPES): IOC, COND, COND-M/B/S, TERMR, TERMR-M/B/T.
// REP-T/REP-B do NOT route here — they use Strategy C (one provision per rep
// section), because splitting a rep into sub-clauses would break the
// one-row-per-rep table. Enumerated reps (Material Contracts etc.) keep their
// (i)-(xxi) list whole and capture it as features in Strategy C.
// ---------------------------------------------------------------------------

async function strategyA(sections, client, opts = {}) {
  const provisions = [];

  // Group sections by type
  const byType = {};
  for (const s of sections) {
    const key = s.provision_type;
    if (!byType[key]) byType[key] = [];
    byType[key].push(s);
  }

  const tasks = Object.entries(byType).map(([typeKey, typeSections]) => async () => {
    // The party-suffixed IOC types (IOC-T / IOC-B) carry the SAME canonical
    // codes, feature schema, scoped-feature handling, and type label as the
    // base 'IOC' type — the rubric keys all of those to 'IOC', not the party
    // variants. Without this normalization, getCodesForType('IOC-T') returns
    // an EMPTY list, the AI sees no canonical codes and proposes a brand-new
    // code for every sub-clause (every IOC row rendered as "[PROPOSED] …" with
    // code=null), and SCOPED_FEATURE_TYPES.has('IOC-T') is false so the
    // clause-scoped feature prompt (dollarThreshold / permittedExceptions /
    // MONETARY_THRESHOLD tagging) never runs. lookupType drives every
    // rubric/prompt lookup; the provisions themselves keep their party type
    // (effectiveType / typeKey) so the sidebar still groups them under
    // Company / Target vs Buyer / Parent.
    const lookupType = (typeKey === 'IOC-T' || typeKey === 'IOC-B') ? 'IOC' : typeKey;
    // 1. Regex-split all sections of this type
    const allSubClauses = [];
    for (const section of typeSections) {
      // Split the section into its (a)/(b)/(i)... sub-clauses; each becomes a
      // separately-classified provision. Sections with no splittable structure
      // fall through to the '_whole' branch below.
      //
      // (Enumerated REP sections — Material Contracts, Absence-of-Changes,
      // Undisclosed Liabilities, ERISA — that must be kept WHOLE are handled in
      // Strategy C, which is where REP-T/REP-B route. Reps deliberately do NOT
      // come through Strategy A: splitting them here would fragment each rep
      // into sub-clause provisions and break the one-row-per-rep table.)
      //
      // Try the annex-shaped offer-conditions pre-split FIRST (only fires on
      // a long single-blob COND section with a monotonic run of >= 4
      // enumerated items — see splitOfferConditionAnnex). Ordinary COND
      // sections are far shorter and fall straight through to the normal
      // splitSubClauses path below.
      const parts = splitOfferConditionAnnex(section.text, lookupType)
        || splitSubClauses(section.text, lookupType);
      // "Merger of equals"-style mirrored IOC sections (Starwood/Marriott
      // §4.1) carry BOTH parties' conduct covenants under one section-level
      // heading. See detectIocPartyFlipIndex above — the flip part and every
      // part AFTER it in document order belong to the OTHER party from what
      // classify.js stamped on the whole section. The comparison must be
      // positional, not alphabetical: the splitter emits roman sub-items
      // ((i)...(xv)) as top-level letters, and e.g. 'i' >= 'b' would wrongly
      // flip the FIRST party's own sub-items.
      const flipIdx = (parts && (typeKey === 'IOC-T' || typeKey === 'IOC-B'))
        ? detectIocPartyFlipIndex(parts)
        : null;
      if (parts) {
        for (let partIdx = 0; partIdx < parts.length; partIdx++) {
          const part = parts[partIdx];
          const iocPartyFlip = flipIdx != null && partIdx >= flipIdx;
          allSubClauses.push({
            text: part.text,
            letter: part.letter,
            startChar: section.startChar,
            sectionIdx: typeSections.indexOf(section),
            ...(iocPartyFlip ? { iocPartyFlip: true } : {}),
          });
        }
      } else {
        // No sub-clauses — treat the whole section as one sub-clause
        allSubClauses.push({
          text: section.text,
          letter: '_whole',
          startChar: section.startChar,
          sectionIdx: typeSections.indexOf(section),
        });
      }
    }

    if (allSubClauses.length === 0) return;

    // 2. Build the preamble provisions
    //    For SCOPED_FEATURE_TYPES (IOC), the preamble carries the section-wide
    //    shared features (requiredByLawCarveout, pandemicCarveout, etc.). We
    //    make a dedicated AI call below to extract those features. For other
    //    types, preambles are emitted with empty features as before.
    //
    //    NEW (Fix 1): For IOC, also SPLIT the preamble into separate obligation
    //    provisions — the typical IOC preamble bundles 3-4 distinct obligations
    //    (ordinary course, preservation of business, no-action) into one
    //    paragraph. Those each get their own provision so the UI displays them
    //    as discrete obligations. The "General / Preamble" provision retains
    //    ONLY the section-wide carve-outs.
    const preambles = allSubClauses.filter((sc) => sc.letter === '_preamble');
    const preambleProvisions = [];
    for (const p of preambles) {
      // For IOC, attempt to split the preamble into the consolidated
      // "Affirmative Covenants" + "General Exceptions" shape.
      let split = null;
      if (lookupType === 'IOC') {
        try {
          split = splitIocPreamble(p.text);
        } catch {
          split = null;
        }
      }

      // For IOC: emit EACH affirmative obligation (Ordinary Course /
      // Preservation of Relationships / Maintain Business Organization /
      // No New Lines of Business / No-Action) as its own discrete provision
      // — NOT a single consolidated "Affirmative Covenants" provision.
      // Also emit "General Exceptions" as a separate provision for the
      // section-wide carve-outs. Skip the legacy "General / Preamble" so the
      // UI shows the split-out obligations and exceptions only.
      if (lookupType === 'IOC' && split && Array.isArray(split.obligations) && split.obligations.length > 0) {
        for (const obl of split.obligations) {
          const oblProv = makeProvision({
            type: 'IOC',
            code: obl.key,
            category: obl.category,
            text: obl.text,
            startChar: p.startChar,
            favorability: 'neutral',
            features: {
              effortsStandard: obl.efforts_standard === 'FLAT' ? null : obl.efforts_standard,
              materialityQualifier: obl.efforts_standard === 'FLAT' ? 'FLAT' : null,
              affirmativeLimbs: [{
                obligation_code: obl.key,
                obligation_label: obl.label,
                text: obl.text,
                efforts_standard: obl.efforts_standard === 'FLAT' ? null : obl.efforts_standard,
                materialityQualifier: 'FLAT',
              }],
            },
            relatedDefinitions: findRelatedDefinitions(obl.text),
            isNewCode: false,
            proposedCode: null,
          });
          preambleProvisions.push(oblProv);
          provisions.push(oblProv);
        }

        // Catch-all "Other Affirmative Obligations" if the residual still
        // contains a verb phrase that isn't attributable to a known limb.
        if (split.other) {
          const otherProv = makeProvision({
            type: 'IOC',
            code: split.other.key,
            category: split.other.category,
            text: split.other.text,
            startChar: p.startChar,
            favorability: 'neutral',
            features: {
              effortsStandard: split.other.efforts_standard === 'FLAT' ? null : split.other.efforts_standard,
              materialityQualifier: split.other.efforts_standard === 'FLAT' ? 'FLAT' : null,
            },
            relatedDefinitions: findRelatedDefinitions(split.other.text),
            isNewCode: false,
            proposedCode: null,
          });
          preambleProvisions.push(otherProv);
          provisions.push(otherProv);
        }

        if (split.consolidated && split.consolidated.generalExceptions) {
          const gex = split.consolidated.generalExceptions;
          const gexProv = makeProvision({
            type: 'IOC',
            code: gex.key,
            category: gex.category,
            text: gex.text,
            startChar: p.startChar,
            favorability: 'neutral',
            features: {},
            relatedDefinitions: findRelatedDefinitions(gex.text),
            isNewCode: false,
            proposedCode: null,
          });
          preambleProvisions.push(gexProv);
          provisions.push(gexProv);
        }

        // P7 item 10: when a separate "negative preamble" was detected,
        // emit it as its own IOC-NEGATIVE-PREAMBLE provision so the UI can
        // compare positive-side vs negative-side carve-outs for asymmetry.
        if (split.consolidated && split.consolidated.negativePreamble) {
          const neg = split.consolidated.negativePreamble;
          const negProv = makeProvision({
            type: 'IOC',
            code: neg.key,
            category: neg.category,
            text: neg.text,
            startChar: typeof p.startChar === 'number' && typeof neg.startOffset === 'number'
              ? p.startChar + neg.startOffset
              : p.startChar,
            favorability: 'neutral',
            features: {
              negativePreambleAffiliateStandard:
                /shall\s+not,?\s+and\s+shall\s+not\s+permit\s+any\s+(?:Company\s+)?Subsidiar(?:y|ies)\s+to/i.test(neg.text)
                  ? 'shall not, and shall not permit any Subsidiary to'
                  : null,
            },
            relatedDefinitions: findRelatedDefinitions(neg.text),
            isNewCode: false,
            proposedCode: null,
          });
          preambleProvisions.push(negProv);
          provisions.push(negProv);
        }
      } else {
        // Non-IOC, or IOC where the regex split found nothing: keep the
        // original "General / Preamble" behavior.
        const generalText = split && split.sharedCarveOuts && split.sharedCarveOuts.length > 30
          ? split.sharedCarveOuts
          : p.text;
        // P5 item 5(a): stamp REP-T-PREAMBLE / REP-B-PREAMBLE codes on REP
        // preambles so the dedicated preamble-extraction prompt can target
        // them and the UI can locate the SEC-filings exception block.
        // COND/TERMR preambles get their canonical codes too (the
        // satisfaction-or-waiver lead-in is a real term, not an uncoded
        // remainder) — codes added to the rubric alongside these.
        const preambleCode =
          typeKey === 'REP-T' ? 'REP-T-PREAMBLE'
          : typeKey === 'REP-B' ? 'REP-B-PREAMBLE'
          : typeKey === 'COND-M' ? 'COND-M-PREAMBLE'
          : typeKey === 'COND-B' ? 'COND-B-PREAMBLE'
          : typeKey === 'COND-S' ? 'COND-S-PREAMBLE'
          : (typeKey === 'TERMR' || typeKey === 'TERMR-M' || typeKey === 'TERMR-B' || typeKey === 'TERMR-T') ? 'TERMR-PREAMBLE'
          : (typeKey === 'IOC' || typeKey === 'IOC-T' || typeKey === 'IOC-B') ? 'IOC-POSITIVE-PREAMBLE'
          : null;
        const generalProv = makeProvision({
          type: typeKey,
          code: preambleCode,
          category: preambleCode ? (CODES[preambleCode] ? CODES[preambleCode].label : 'General / Preamble') : 'General / Preamble',
          text: generalText,
          startChar: p.startChar,
          favorability: 'neutral',
          features: {},
          relatedDefinitions: findRelatedDefinitions(generalText),
        });
        preambleProvisions.push(generalProv);
        provisions.push(generalProv);
      }
    }

    // 2a. Extract shared (section-wide) features from preambles for scoped
    //     types (IOC). One batched AI call covering all preambles for this type.
    if (SCOPED_FEATURE_TYPES.has(lookupType) && preambleProvisions.length > 0) {
      const preambleFeatureInstructions = buildFeatureInstructions(lookupType, { scope: 'preamble' });
      if (preambleFeatureInstructions) {
        const payload = preambleProvisions.map((p, idx) => ({
          idx,
          text: p.text.length > 3000 ? p.text.substring(0, 3000) : p.text,
        }));
        const preamblePrompt = `You are a senior M&A attorney. The texts below are the GENERAL / PREAMBLE paragraphs of ${typeKey} sections. They state the section-wide rules and carve-outs that apply to ALL of the individual restrictions/sub-clauses that follow. Extract ONLY the shared, section-wide features listed in the schema below — do NOT extract per-clause-specific features here.

CRITICAL — permittedExceptions EXACTNESS: the section-wide carve-outs are the
ones ENUMERATED in the lead-in sentence immediately before sub-clause (a) —
typically a short lettered/numbered run like "except (w) as required by
applicable Law, (x) as expressly required or contemplated by this Agreement,
(y) with the prior written consent of Parent, (z) as set forth in Section X of
the Company Disclosure Schedule". Capture EXACTLY that enumerated list — one
tagged item per enumerated carve-out, in order, nothing more. Do NOT add
carve-outs that appear only inside individual sub-clauses, in other sections,
or that you infer to be customary. If the lead-in enumerates three carve-outs,
return exactly three.
${preambleFeatureInstructions}
PREAMBLE TEXTS:
${JSON.stringify(payload, null, 2)}

Return ONLY valid JSON (no markdown, no backticks):
{
  "results": [
    { "idx": 0, "features": { /* schema fields populated */ } }
  ]
}`;
        try {
          const presp = await client.messages.create({
            model: MODEL,
            max_tokens: 10000,
            messages: [{ role: 'user', content: preamblePrompt }],
          });
          const praw = presp.content.map((c) => c.text || '').join('');
          const pparsed = parseJSON(praw);
          for (const r of (pparsed.results || [])) {
            if (r.idx >= 0 && r.idx < preambleProvisions.length) {
              preambleProvisions[r.idx].features = r.features || {};
            }
          }
        } catch {
          // Best-effort; preambles keep empty features on failure
        }
      }
    }

    // 3. Send non-preamble sub-clauses to Claude in ONE batched call
    const classifiable = allSubClauses.filter(
      (sc) => sc.letter !== '_preamble'
    );
    if (classifiable.length === 0) return;

    const codesList = buildCodesList(lookupType);
    // For SCOPED types, per-clause prompts ONLY ask for clause-scoped features
    // so the model doesn't repeat the section-wide carve-outs on every
    // sub-clause. For other types, full feature set as before.
    const clauseScopeOpts = SCOPED_FEATURE_TYPES.has(lookupType) ? { scope: 'clause' } : {};
    const featureInstructions = buildFeatureInstructions(lookupType, clauseScopeOpts);

    const subClausePayload = classifiable.map((sc, idx) => {
      const parentSection = typeSections[sc.sectionIdx] || {};
      // Per-item char cap. Normal sub-clauses are short so 3000 is plenty, but
      // KEPT-WHOLE reps (letter '_whole' — Material Contracts, Absence-of-
      // Changes, Undisclosed Liabilities, ERISA) carry the ENTIRE enumerated
      // (i)-(xxi) list in ONE item. Capping those at 3000 chars chopped off
      // everything past ~clause (vii) before the AI ever saw it — THE cause of
      // "21 sub-clauses but only ~7 extract". Give whole items a large budget.
      const cap = sc.letter === '_whole' ? 24000 : 3000;
      return {
        idx,
        sectionTitle: parentSection.title || parentSection.heading || parentSection.category || null,
        sectionNumber: parentSection.number || null,
        text: sc.text.length > cap ? sc.text.substring(0, cap) : sc.text,
      };
    });

    // Chunk the classifiable sub-clauses so no single AI call has to emit too
    // much JSON. A kept-whole rep (Material Contracts, Absence-of-Changes,
    // etc.) can ALONE emit 20+ verbatim sub-clause buckets, so it gets its own
    // single-item chunk; ordinary sub-clauses batch together. Sending EVERY
    // sub-clause in one call let a long response blow past max_tokens and
    // truncate — silently dropping trailing reps AND the tail of a kept-whole
    // rep's buckets (the "21 buckets but only ~7 extract / reps page goes
    // sparse" bug). Per-chunk calls keep each response within budget.
    const REGULAR_CHUNK_SIZE = 8;
    const chunks = [];
    {
      let batch = [];
      for (let i = 0; i < classifiable.length; i++) {
        if (classifiable[i].letter === '_whole') {
          if (batch.length) { chunks.push(batch); batch = []; }
          chunks.push([i]); // isolate the heavy kept-whole rep in its own call
        } else {
          batch.push(i);
          if (batch.length >= REGULAR_CHUNK_SIZE) { chunks.push(batch); batch = []; }
        }
      }
      if (batch.length) chunks.push(batch);
    }

    const buildClassifyPrompt = (chunkPayload) => `You are a senior M&A attorney. Classify each sub-clause below into exactly one canonical rubric code, assess favorability, and extract STRUCTURED features.

PROVISION TYPE: ${lookupType} — ${getTypeLabel(lookupType)}

VALID CANONICAL CODES for ${lookupType}:
${codesList}

SUB-CLAUSES TO CLASSIFY (each tagged with its parent sectionTitle and sectionNumber):
${JSON.stringify(chunkPayload, null, 2)}
${featureInstructions}
For each sub-clause, determine:
1. The best matching canonical code from the list above. Each sub-clause gets
   a UNIQUE code based on its sectionTitle and the actual text of the sub-clause.
   Do not default many sub-clauses to the same code.
2. Favorability from the buyer's perspective.
3. POPULATE the structured "features" object with every applicable field from
   the schema above. Use null / [] / false for fields that genuinely don't
   apply, but DO attempt every field — these features power the UI and
   downstream comparison, so a populated features object is required.

VERBATIM RULE FOR ALL FIELDS: when any field captures a "text" excerpt or a
verbatim phrase (e.g. tagged-item "text" fields, permittedExceptions text,
positiveObligations.obligation, consentStandard.text), copy the EXACT TEXT
from the source character-for-character, including ALL parentheticals,
qualifiers, and footnotes. Do NOT summarize or paraphrase. Example: capture
"consent of Parent (which consent shall not be unreasonably withheld, delayed
or conditioned)" in FULL with the parenthetical, NOT "with consent of Parent".

CLASSIFICATION DISCIPLINE: the VALID CANONICAL CODES list above is rich — almost every interim-operating-covenant sub-clause maps to one of them. Before proposing a new code, CHECK the list. Common mappings you MUST use rather than inventing a new code: capital expenditures → IOC-CAPEX; incurring / prepaying / guaranteeing indebtedness → IOC-DEBT; creating liens / encumbrances → IOC-LIEN; acquiring or disposing of assets, businesses, or entities (mergers, acquisitions, dispositions, forming subsidiaries, acquiring equity interests) → IOC-MERGE; intellectual-property licensing / disposition / abandonment → IOC-IP; entering / amending / terminating material contracts → IOC-CONTRACT; real property and leases → IOC-REALPROP; tax elections and filings → IOC-TAX; accounting-method changes → IOC-ACCOUNTING; capital contributions / advances / investments → IOC-COMMIT; privacy / cybersecurity policy changes → IOC-OTHER. Only set "isNewCode": true when the sub-clause genuinely matches NONE of the listed codes — this should be RARE. Do NOT mark a whole batch "UNCLASSIFIED".

If NO existing code fits, set "isNewCode": true and propose a code (format: "${lookupType}-NEWNAME") and label.

Return ONLY valid JSON (no markdown, no backticks). Echo back each sub-clause's
"idx" EXACTLY as given so results map to the right sub-clause. Each result MUST
include a "features" object with the schema fields populated:
{
  "results": [
    {
      "idx": 0,
      "code": "COND-M-LEGAL",
      "category": "No Legal Impediment",
      "favorability": "neutral",
      "features": { /* fields per the schema above */ },
      "isNewCode": false,
      "proposedCode": null,
      "proposedLabel": null
    }
  ]
}`;

    try {
      const resultMap = {};
      for (const chunkIdxs of chunks) {
        const chunkPayload = chunkIdxs.map((gi) => subClausePayload[gi]);
        const prompt = buildClassifyPrompt(chunkPayload);
        try {
          const resp = await client.messages.create({
            model: MODEL,
            // One kept-whole Material Contracts rep alone can emit 21 buckets
            // with verbatim text — generous per-chunk budget so the JSON never
            // truncates within a chunk.
            max_tokens: 20000,
            messages: [{ role: 'user', content: prompt }],
          });
          const raw = resp.content.map((c) => c.text || '').join('');
          const parsed = parseJSON(raw);
          for (const r of (parsed.results || [])) {
            if (r && typeof r.idx === 'number') resultMap[r.idx] = r;
          }
        } catch (chunkErr) {
          // Leave this chunk's idxs unmapped → the apply loop emits them as
          // Unclassified rather than failing the whole type.
          for (const gi of chunkIdxs) {
            if (!resultMap[gi]) resultMap[gi] = { _error: chunkErr.message };
          }
        }
      }

      for (let i = 0; i < classifiable.length; i++) {
        const sc = classifiable[i];
        const aiResult = resultMap[i] || {};
        const code = aiResult.code || null;
        const codeEntry = code ? CODES[code] : null;

        // For TERMR sub-clauses, refine the provision type to a party-specific
        // bucket (TERMR-M / TERMR-B / TERMR-T) so the sidebar can group them.
        let effectiveType = typeKey;
        if (typeKey === 'TERMR' || typeKey === 'TERMR-M' || typeKey === 'TERMR-B' || typeKey === 'TERMR-T') {
          const fromCode = termrPartyFromCode(isValidCode(code) ? code : null);
          if (fromCode !== 'TERMR') {
            effectiveType = fromCode;
          } else {
            const fromFeat = termrPartyFromFeature(aiResult.features || {});
            effectiveType = fromFeat !== 'TERMR' ? fromFeat : 'TERMR';
          }
        } else if (typeof typeKey === 'string' && typeKey.startsWith('COND')) {
          // Route by canonical COND code family (handles tender-offer Annex I
          // conditions that were all classified COND-B but carry COND-M-* codes).
          const fam = condFamilyFromCode(isValidCode(code) ? code : null);
          if (fam) effectiveType = fam;
        } else if ((typeKey === 'IOC-T' || typeKey === 'IOC-B') && sc.iocPartyFlip) {
          // Mirrored "Conduct of Business by <Parent>" sub-clause detected —
          // flip this sub-clause (and its descendants) to the OTHER party.
          effectiveType = typeKey === 'IOC-T' ? 'IOC-B' : 'IOC-T';
        }

        // Filter the features object to only the fields the code's schema
        // actually defines, so e.g. a TERMR-MUTUAL provision never carries
        // an `outsideDate` key from the AI's response.
        let features = aiResult.features || {};
        if (isValidCode(code) && code.startsWith('TERMR-')) {
          // Normalize party FIRST (collapses "either"/"mutual"/"both" and
          // forces fixed-party codes) so the canonical value flows through
          // the schema filter intact.
          features = normalizeTermrParty(features, code);
          features = filterFeaturesToCodeSchema(features, code);
          // Explicit safety: outsideDateExtension must NEVER appear on a
          // non-TERMR-OUTSIDE provision, even if the schema allows it.
          if (code !== 'TERMR-OUTSIDE' && code !== 'TERMR-EXTENSION') {
            delete features.outsideDateExtension;
            delete features.extensionConditions;
            delete features.outsideDateExtensionConditions;
          }
        }

        // Stamp the sub-clause's section identity (e.g. "5.01(a)") so
        // post-passes (AoC covenant-cite resolution) and the UI can address
        // individual covenant sub-clauses by number.
        if (!features.sectionNumber) {
          const parentSect = typeSections[sc.sectionIdx] || {};
          const baseNum = parentSect.number || parentSect.sectionNumber || null;
          if (baseNum) {
            features.sectionNumber = formatSectionNumberWithSubclause(baseNum, sc.letter);
          }
        }

        // Deterministic fallback: the AI classification pass above left this
        // sub-clause with no valid rubric code and no distinct category — it
        // would otherwise become "[PROPOSED] Unclassified" downstream. Try
        // the same canonical-heading matcher classify.js uses for headed
        // sub-clauses against this sub-clause's OWN body text before giving
        // up. Never runs when a valid code (or a real AI category) already
        // resolved — see iocSubClauseFallbackCategory doc comment.
        let category = codeEntry ? codeEntry.label : (aiResult.category || 'Unclassified');
        if (!codeEntry && /^unclassified$/i.test(String(category).trim())) {
          const fallbackCategory = iocSubClauseFallbackCategory(effectiveType, sc.text);
          if (fallbackCategory) category = fallbackCategory;
        }

        provisions.push(makeProvision({
          type: effectiveType,
          code: isValidCode(code) ? code : null,
          category,
          text: sc.text,
          startChar: sc.startChar,
          favorability: aiResult.favorability || 'neutral',
          features,
          relatedDefinitions: findRelatedDefinitions(sc.text),
          isNewCode: aiResult.isNewCode || false,
          proposedCode: aiResult.proposedCode || null,
          proposedLabel: aiResult.proposedLabel || null,
        }));
      }
    } catch (err) {
      // Fallback: emit each sub-clause as unclassified, unless the
      // deterministic IOC-T/IOC-B heading matcher can still resolve a
      // category from the sub-clause's own body text (the whole chunk's AI
      // call failed, not just this one clause's classification).
      for (const sc of classifiable) {
        const fallbackType = (typeKey === 'IOC-T' || typeKey === 'IOC-B') && sc.iocPartyFlip
          ? (typeKey === 'IOC-T' ? 'IOC-B' : 'IOC-T')
          : typeKey;
        const fallbackCategory = iocSubClauseFallbackCategory(fallbackType, sc.text);
        provisions.push(makeProvision({
          type: fallbackType,
          code: null,
          category: fallbackCategory || 'Unclassified',
          text: sc.text,
          startChar: sc.startChar,
          relatedDefinitions: findRelatedDefinitions(sc.text),
          _error: err.message,
        }));
      }
    }
  });

  await runWithConcurrency(tasks, MAX_CONCURRENT);
  attachStrategySpanClaims(sections, provisions, opts);
  return provisions;
}

// ---------------------------------------------------------------------------
// Strategy B: AI multi-code extraction (NOSOL, ANTI)
// ---------------------------------------------------------------------------

/**
 * EXT-3: locate a Strategy-B provision's real start offset in the source.
 *
 * Strategy B prompts a CHUNK of several sections at once and previously
 * stamped every provision parsed out of the chunk with the FIRST section's
 * startChar — corrupting provenance for every provision from a later
 * section (and for every decomposed sub-clause of a long section). The
 * offset feeds boundary repair (findProvisionLocalStart's hint window +
 * sectionForProvision's char-window), the coverage backfill's char-window
 * matching, quote verification's startCharHint disambiguator, and the
 * persisted ai_metadata.startChar, so each provision must carry its OWN
 * section's offset plus its position within that section.
 *
 * Matching mirrors findProvisionLocalStart: exact indexOf on the head of the
 * model's verbatim excerpt first, then a whitespace-tolerant regex (models
 * sometimes collapse whitespace runs when echoing "verbatim" text). Sections
 * are scanned in chunk order, so an ambiguous probe resolves to the earliest
 * occurrence — the same tie-break indexOf gave before. Anything unlocatable
 * falls back to the chunk's first-section offset (the legacy behavior).
 */
function locateProvisionStartChar(provisionText, chunkSections, fallbackStartChar) {
  const ptext = String(provisionText || '');
  if (!ptext.trim()) return fallbackStartChar;

  // Head probe: the start offset only depends on where the text BEGINS, and
  // a bounded probe survives tail truncation/paraphrase by the model.
  const probe = ptext.slice(0, Math.min(160, ptext.length));
  for (const s of chunkSections) {
    const stext = String((s && s.text) || '');
    if (!stext) continue;
    const idx = stext.indexOf(probe);
    if (idx >= 0) return (Number(s.startChar) || 0) + idx;
  }

  // Whitespace-tolerant fallback (same shape as findProvisionLocalStart).
  const prefix = probe.trim();
  if (prefix.length >= 40) {
    const escaped = prefix
      .replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
      .replace(/\s+/g, '\\s+');
    let re = null;
    try { re = new RegExp(escaped); } catch { /* unmatchable prefix */ }
    if (re) {
      for (const s of chunkSections) {
        const m = String((s && s.text) || '').match(re);
        if (m && typeof m.index === 'number') {
          return (Number(s.startChar) || 0) + m.index;
        }
      }
    }
  }

  return fallbackStartChar;
}

// ---------------------------------------------------------------------------
// NOSOL cross-section context (FTV fix, 2026-07-16)
// ---------------------------------------------------------------------------
// forceTheVoteType's codebook needs text the NOSOL section does not carry:
// the vote-survives-ARC covenant usually lives in the STOCKHOLDERS-MEETING
// covenant (Anadarko's no-shop has zero recommendation-change language), and
// the SOFT/HARD discriminator — a self-termination right for a Superior
// Proposal — lives in the TERMINATION article. Without them the extractor
// either omits the feature (4 of the 5 golden-pinned deals) or judges
// strength blind (TopBuild came back SOFT against a HARD pin). Feed those
// sections into the NOSOL prompt as READ-ONLY context: features may cite
// them; provisions may not be minted from them.
const NOSOL_CONTEXT_MEETING_RE = /stockholders?['’]?s?\s+meeting|special\s+meeting|company\s+meeting|stockholder\s+approval/i;
const NOSOL_CONTEXT_MEETING_CAP = 9000;
const NOSOL_CONTEXT_TERMR_CAP = 14000;

function buildNosolContextBlock(allSections, ownSections) {
  if (!Array.isArray(allSections) || allSections.length === 0) return '';
  const own = new Set(ownSections || []);
  const meeting = [];
  const termination = [];
  for (const s of allSections) {
    if (!s || own.has(s) || !s.text) continue;
    const type = String(s.provision_type || '');
    const title = String(s.title || '');
    if (/^TERMR/.test(type) || type === 'TERMINATION') {
      termination.push(s);
    } else if ((type === 'COV' || type === 'STRUCT') && NOSOL_CONTEXT_MEETING_RE.test(title)) {
      meeting.push(s);
    }
  }
  const take = (list, cap) => {
    let out = '';
    for (const s of list) {
      if (out.length >= cap) break;
      const chunk = `\n[§${s.number || ''} ${s.title || ''}]\n${s.text}`;
      out += chunk.slice(0, Math.max(0, cap - out.length));
    }
    return out;
  };
  const meetingText = take(meeting, NOSOL_CONTEXT_MEETING_CAP);
  const terminationText = take(termination, NOSOL_CONTEXT_TERMR_CAP);
  if (!meetingText && !terminationText) return '';
  return `

RELATED SECTIONS — CONTEXT ONLY (do NOT extract provisions from this text; every provision's "text" must come from the SECTION TEXT above). Use this context ONLY to resolve cross-referenced features:
- forceTheVote / forceTheVoteType: the vote-survives-ARC covenant often lives in the stockholders-meeting covenant below, not the no-shop section. When it does, still emit forceTheVoteType on the most relevant no-shop provision row (typically the Change of Recommendation provision), quoting the FTV clause verbatim from the context as the tag's "text".
- The FTV_SOFT vs FTV_HARD discriminator: check the termination article below for a SELF-termination right FOR A SUPERIOR PROPOSAL held by the obligated party. A cross-reference in the no-shop section to "the right to terminate" is NOT enough to conclude SOFT — verify in the termination article that the right is the obligated party's own superior-proposal-out. No such right anywhere → FTV_HARD (when the vote-survives-ARC covenant exists).
${meetingText ? `\n--- STOCKHOLDERS MEETING COVENANT(S) ---${meetingText}` : ''}
${terminationText ? `\n--- TERMINATION ARTICLE ---${terminationText}` : ''}
`;
}

async function strategyB(sections, client, allSections = null) {
  const provisions = [];

  // Group by type
  const byType = {};
  for (const s of sections) {
    const key = s.provision_type;
    if (!byType[key]) byType[key] = [];
    byType[key].push(s);
  }

  const tasks = Object.entries(byType).map(([typeKey, typeSections]) => async () => {
    // Party-scoped NOSOL subtypes (NOSOL-T / NOSOL-B / NOSOL-M) share the
    // SAME canonical codes / feature schema / type label as the base 'NOSOL'
    // family — the rubric's CODES map keys every NOSOL-* code to type
    // 'NOSOL', not the party variants. Same normalization strategyA already
    // does for IOC-T/IOC-B: lookupType drives every rubric/prompt lookup,
    // the provisions themselves keep their party type (typeKey) so the
    // sidebar groups them under Company/Target vs Buyer/Parent vs Mutual.
    const lookupType = (typeKey === 'NOSOL-T' || typeKey === 'NOSOL-B' || typeKey === 'NOSOL-M') ? 'NOSOL' : typeKey;
    const codesList = buildCodesList(lookupType);
    const featureInstructions = buildFeatureInstructions(lookupType);
    const nosolContext = lookupType === 'NOSOL' ? buildNosolContextBlock(allSections, typeSections) : '';

    // Chunk this type's sections so a long multi-article set (e.g. several
    // NOSOL or ANTI articles) can't overflow one response and silently drop
    // trailing provisions. Sections accumulate into a chunk until they would
    // exceed MAX_CHUNK_CHARS; an oversized single section gets a generous
    // safety cap. Most NOSOL/ANTI/TERMF sets fit in one chunk, so normal
    // behaviour is unchanged.
    const MAX_CHUNK_CHARS = 12000;
    const SINGLE_SECTION_CAP = 40000;
    const sectionChunks = [];
    {
      let batch = [];
      let len = 0;
      for (const s of typeSections) {
        const tlen = (s.text || '').length;
        if (batch.length && len + tlen > MAX_CHUNK_CHARS) {
          sectionChunks.push(batch);
          batch = [];
          len = 0;
        }
        batch.push(s);
        len += tlen;
      }
      if (batch.length) sectionChunks.push(batch);
    }

    const buildMultiCodePrompt = (combinedText) => `You are a senior M&A attorney. This is a "${getTypeLabel(typeKey)}" section of a merger agreement. A single passage can contain MULTIPLE provisions with overlapping text spans.

SECTION TEXT:
${combinedText}

ALL CANONICAL CODES for ${typeKey}:
${codesList}

For EACH canonical code listed above, determine:
1. Whether it is present in this section (true/false).
2. If present, extract the relevant text excerpt VERBATIM — copy the exact
   text from the source character-for-character, including ALL parentheticals,
   qualifiers, and footnotes. Do NOT summarize or paraphrase. The goal is
   100% text coverage: every sentence of the section should end up inside
   at least one provision's "text" field — ACROSS the full set of provisions,
   never inside a single one.

DECOMPOSITION IS MANDATORY. A long section (no-shop covenants especially)
bundles MANY of the codes above. Each provision's "text" must be the MINIMAL
span for ITS code — typically one paragraph or sub-clause, rarely more than
~4,000 characters. NEVER assign the entire section (or most of it) to one
code while other codes are present in the text: that is a failure, not
coverage. If sub-clauses (a), (b), (c)… each address different codes, emit
one provision per code with just its sub-clause(s).
3. Assess favorability from the buyer's perspective.
4. POPULATE the structured "features" object with every applicable field from
   the schema below. Each identified passage gets its OWN features object.
   Same verbatim rule applies to any "text" field inside features (e.g.
   tagged items, permittedExceptions text).
${featureInstructions}
If you identify a concept not covered by any existing code, include it with "isNewCode": true and propose a code and label.

Return ONLY valid JSON (no markdown, no backticks). Each provision MUST include
its own "features" object populated per the schema:
{
  "provisions": [
    {
      "code": "NOSOL-PROHIBIT",
      "category": "Solicitation Prohibition",
      "present": true,
      "favorability": "neutral",
      "features": { /* schema fields populated */ },
      "text": "exact verbatim excerpt...",
      "isNewCode": false,
      "proposedCode": null,
      "proposedLabel": null
    }
  ]
}

Only include provisions that are actually present. Do NOT include provisions where present=false.${nosolContext}`;

    for (const chunkSections of sectionChunks) {
    const combined0 = chunkSections.map((s) => s.text).join('\n\n---\n\n');
    const combinedText = combined0.length > SINGLE_SECTION_CAP ? combined0.substring(0, SINGLE_SECTION_CAP) : combined0;
    // EXT-3: last-resort offset only — each provision gets its OWN offset
    // via locateProvisionStartChar below.
    const chunkFallbackStartChar = chunkSections[0].startChar;
    const prompt = buildMultiCodePrompt(combinedText);
    try {
      const resp = await client.messages.create({
        model: MODEL,
        // 32k: a long NOSOL section echoed verbatim across its decomposed
        // provisions plus features exceeds 16k output and truncates — which
        // is exactly how Metsera's no-shop became one 20k blob with no
        // features (the salvage parser kept only the first provision).
        max_tokens: 32000,
        messages: [{ role: 'user', content: prompt }],
      });

      const raw = resp.content.map((c) => c.text || '').join('');
      const parsed = parseJSON(raw);

      // Blob guard: a single provision spanning (nearly) the whole section is
      // the exact failure the prompt forbids — Metsera's ANTI came back as one
      // 14k ANTI-EFFORTS blob covering all of Section 6.03. Retry ONCE with a
      // reinforced decomposition instruction; keep whichever attempt yields
      // more provisions.
      let provList = parsed.provisions || [];
      const blobbed =
        provList.length === 1 &&
        (provList[0].text || '').length > 8000 &&
        combinedText.length > 8000;
      if (blobbed) {
        try {
          const retryResp = await client.messages.create({
            model: MODEL,
            max_tokens: 32000,
            messages: [{
              role: 'user',
              content: prompt +
                '\n\nPREVIOUS ATTEMPT FAILED: it returned ONE provision spanning the entire section — the exact failure described under "DECOMPOSITION IS MANDATORY". Decompose the section into one provision per canonical code actually present (a full regulatory-efforts or no-shop section typically yields 6-12 provisions, each with the MINIMAL span for its code). Return the full JSON again.',
            }],
          });
          const retryRaw = retryResp.content.map((c) => c.text || '').join('');
          const retryParsed = parseJSON(retryRaw);
          if ((retryParsed.provisions || []).length > provList.length) {
            provList = retryParsed.provisions;
          }
        } catch {
          // keep the original single-provision result
        }
      }

      for (const p of provList) {
        if (!p.present && p.present !== undefined) continue;
        if (!p.text || p.text.length < 10) continue;

        const code = p.code || null;
        const codeEntry = code ? CODES[code] : null;

        // Filter features to the code's specific schema so e.g. an
        // ANTI-FILING provision never carries irrelevant generic ANTI fields
        // and ANTI-NOACTION keeps appliesToParty but drops divestiture caps.
        // Same for TERMF: TERMF-TARGET keeps companyTerminationFee but drops
        // reverseTerminationFee/expenseReimbursement keys.
        let features = p.features || {};
        if (isValidCode(code) && (code.startsWith('ANTI-') || code.startsWith('TERMF-'))) {
          features = filterFeaturesToCodeSchema(features, code);
        }

        provisions.push(makeProvision({
          type: typeKey,
          code: isValidCode(code) ? code : null,
          category: codeEntry ? codeEntry.label : (p.category || 'Unclassified'),
          text: p.text,
          startChar: locateProvisionStartChar(p.text, chunkSections, chunkFallbackStartChar),
          favorability: p.favorability || 'neutral',
          features,
          relatedDefinitions: findRelatedDefinitions(p.text),
          isNewCode: p.isNewCode || false,
          proposedCode: p.proposedCode || null,
          proposedLabel: p.proposedLabel || null,
        }));
      }
    } catch (err) {
      // Fallback: keep as single provision per section in this chunk
      for (const s of chunkSections) {
        provisions.push(makeProvision({
          type: typeKey,
          code: null,
          category: getTypeLabel(typeKey) || typeKey,
          text: s.text,
          startChar: s.startChar,
          relatedDefinitions: findRelatedDefinitions(s.text),
          _error: err.message,
        }));
      }
    }
    } // end section-chunk loop
  });

  await runWithConcurrency(tasks, MAX_CONCURRENT);
  return provisions;
}

// ---------------------------------------------------------------------------
// Umbrella-section decomposition (structure-aware segmentation pre-pass).
// ---------------------------------------------------------------------------
// Modern deals number each rep as its own section (Section 3.08 Absence of
// Changes, 3.09 Taxes, …), so Strategy C's one-provision-per-section rule
// yields one row per rep for free. But a whole template family — the older /
// large-cap Wachtell-style skeleton (e.g. 2018 IBM/Red Hat) — bundles EVERY
// company rep under a single section with TITLED lettered sub-clauses:
//   "SECTION 3.01. Representations and Warranties of the Company. Except …
//      (a) Organization, Standing and Corporate Power. The Company …
//      (b) Subsidiaries. …  (c) Capital Structure. …  … (v) No Other …"
// Strategy C then captured the entire reps article as ONE 75k-char blob (2 rep
// rows instead of ~30). This pre-pass detects that shape and expands the
// umbrella into one pseudo-section per titled rep, preserving the pre-(a) text
// as a General / Preamble section, so the existing strategy operates at the
// right granularity.
//
// The discriminator is deliberately tight so it never fragments a genuine
// ENUMERATED single rep (Material Contracts "(i) …, (ii) …" — lowercase,
// untitled roman items) or a per-section rep that happens to have a couple of
// lettered sub-parts:
//   • only REP-T / REP-B sections,
//   • a long section (> UMBRELLA_MIN_CHARS),
//   • a MONOTONIC a,b,c,… run of ≥ UMBRELLA_MIN_SUBCLAUSES sub-clauses,
//   • each opening with a Title-Case heading + period ("(a) Organization…. ").
const UMBRELLA_MIN_CHARS = 5000;
const UMBRELLA_MIN_SUBCLAUSES = 5;
// "(a) Title Case Heading. " — letter, a capitalized heading, terminating period.
const TITLED_SUBCLAUSE_RE = /\(([a-z])\)\s*([A-Z][A-Za-z0-9',;:&()\-\/ ]{3,80}?)\.\s/g;

function extractTitledSubclauses(text) {
  const marks = [];
  const re = new RegExp(TITLED_SUBCLAUSE_RE.source, 'g');
  let m;
  while ((m = re.exec(text)) !== null) {
    marks.push({ letter: m[1], title: m[2].trim(), start: m.index });
  }
  // Keep a strictly-INCREASING run of top-level sub-clause letters, tolerating
  // small gaps but rejecting wild jumps. A strict "exactly the next letter"
  // rule is too brittle: a single letter that fails to match the titled regex
  // (e.g. "(i) Permits", whose "(i)" reads as a roman numeral elsewhere) would
  // truncate the ENTIRE tail (j,k,l,…) and yield 8 reps instead of ~22. The gap
  // tolerance skips over such a hole; the jump ceiling still rejects a stray
  // titled "(z) Inktank Storage, Inc." from a nested list mid-section.
  const MAX_LETTER_GAP = 4;
  const seq = [];
  let lastCode = 'a'.charCodeAt(0) - 1;
  for (const mk of marks) {
    const c = mk.letter.charCodeAt(0);
    if (c > lastCode && c <= lastCode + MAX_LETTER_GAP) { seq.push(mk); lastCode = c; }
  }
  const parts = [];
  for (let i = 0; i < seq.length; i++) {
    const start = seq[i].start;
    const end = i + 1 < seq.length ? seq[i + 1].start : text.length;
    parts.push({ letter: seq[i].letter, title: seq[i].title, start, text: text.slice(start, end).trim() });
  }
  return parts;
}

function compactSentence(text) {
  return String(text || '').replace(/\s+/g, ' ').trim();
}

function firstSentenceMatching(text, pattern, maxChars = 900) {
  const source = compactSentence(text);
  if (!source) return null;
  const sentences = source.match(/[^.!?]+[.!?]+(?=\s|$)|[^.!?]+$/g) || [source];
  const found = sentences.find((s) => pattern.test(s));
  if (!found) return null;
  const trimmed = compactSentence(found);
  return trimmed.length > maxChars ? `${trimmed.slice(0, maxChars - 3).trim()}...` : trimmed;
}

function extractTenderOfferMechanicsFeatures(section) {
  const title = String(section && (section.title || section.heading || section.category || '') || '');
  const text = String(section && section.text || '');
  const joined = compactSentence(`${title}. ${text}`);
  const features = {
    canonicalCode: 'STRUCT-OFFER',
    mainConcept: /directors?/i.test(title)
      ? 'Buyer board-designation mechanics after offer acceptance.'
      : /schedule\s+14d-9|company\s+(?:actions?|consent)/i.test(title)
        ? 'Company tender-offer recommendation and Schedule 14D-9 mechanics.'
        : /stockholder\s+lists?/i.test(title)
          ? 'Stockholder-list delivery and offer-holder communications support.'
          : 'Tender offer mechanics for a two-step acquisition.',
    dealStructure: 'TWO_STEP_TENDER_OFFER',
    mergerForm: {
      code: 'TWO_STEP_TENDER_OFFER',
      label: 'Two-step tender offer',
      text: firstSentenceMatching(joined, /\btender\s+offer\b|\bthe\s+Offer\b/i) || 'Tender offer followed by back-end merger.',
    },
  };

  const commencement = firstSentenceMatching(text, /\bcommence\b.*\bOffer\b|\bOffer\b.*\bcommence\b/i);
  if (commencement) features.offerCommencementDeadline = commencement;

  const price = firstSentenceMatching(text, /\bprice\s+per\s+Share\b|\bOffer\s+Price\b|\bPer\s+Share\s+Amount\b/i);
  if (price) {
    features.offerPrice = price;
    features.offerConsideration = /\bcash\b/i.test(price) ? 'Cash' : price;
  }

  const conditions = firstSentenceMatching(text, /\bOffer\s+Conditions?\b|Annex\s+[A-ZI]+\b|Minimum\s+Tender\s+Condition|Minimum\s+Condition/i);
  if (conditions) features.offerConditionsReference = conditions;

  const extension = firstSentenceMatching(text, /\bextend(?:ed|s|ing)?\b|\bExpiration\s+(?:Date|Time)\b/i);
  if (extension) features.offerExpirationAndExtension = extension;

  const acceptance = firstSentenceMatching(text, /accept\s+for\s+payment|pay\s+for.*Shares|payment\s+for.*Shares|Acceptance\s+Time/i);
  if (acceptance) features.acceptanceAndPaymentMechanics = acceptance;

  const scheduleTo = firstSentenceMatching(text, /Schedule\s+TO|Offer\s+Documents|Rule\s+14d-2/i);
  if (scheduleTo) features.scheduleTOFiling = scheduleTo;

  const schedule14d9 = firstSentenceMatching(text, /Schedule\s+14D-9|Solicitation\/Recommendation|Rule\s+14d-9/i);
  if (schedule14d9) features.schedule14D9Filing = schedule14d9;

  const list = firstSentenceMatching(text, /stockholder\s+list|mailing\s+labels|security\s+position\s+listing|holders?\s+of\s+Shares/i);
  if (list) features.stockholderListCovenant = list;

  const directors = firstSentenceMatching(text, /designate|designee|Company\s+Board|directors?/i);
  if (/directors?/i.test(title) && directors) features.buyerBoardDesignation = directors;

  if (/Section\s+251\(h\)|\b251\(h\)\b/i.test(text)) {
    features.section251h = true;
    const backend = firstSentenceMatching(text, /Section\s+251\(h\)|\b251\(h\)\b|without\s+(?:a\s+)?(?:vote|meeting)/i);
    if (backend) features.backendMergerMechanic = backend;
  }

  const shortForm = firstSentenceMatching(text, /short[\s-]*form|90%|ninety\s+percent|without\s+a\s+vote/i);
  if (shortForm) features.shortFormMergerMechanic = shortForm;

  return features;
}

// Expand any REP umbrella section into [preamble, rep-per-subclause]; pass
// every other section through untouched.
function splitUmbrellaRepSections(sections) {
  // Sibling gate (Skechers REP-T=53): this pre-pass exists for the
  // UNDER-segmented case — one giant section carrying an entire reps article
  // (old Wachtell-style drafting). When the deal already has many distinct
  // REP sections of the same type (modern per-topic drafting, 3.1–3.2x), a
  // long individual rep (IP, Taxes, Benefits) that internally uses titled
  // lettered sub-clauses is NOT an umbrella — splitting it shreds one rep
  // into a row per letter. Skip the split for any type that is already
  // well-segmented.
  const WELL_SEGMENTED_SIBLINGS = 10;
  const repTypeCounts = {};
  for (const s of sections) {
    const t = s.provision_type;
    if (t === 'REP-T' || t === 'REP-B') repTypeCounts[t] = (repTypeCounts[t] || 0) + 1;
  }

  const out = [];
  for (const s of sections) {
    const type = s.provision_type;
    const text = s.text || '';
    if (
      (type !== 'REP-T' && type !== 'REP-B') ||
      text.length < UMBRELLA_MIN_CHARS ||
      (repTypeCounts[type] || 0) >= WELL_SEGMENTED_SIBLINGS
    ) {
      out.push(s);
      continue;
    }
    const parts = extractTitledSubclauses(text);
    if (parts.length < UMBRELLA_MIN_SUBCLAUSES) {
      out.push(s);
      continue;
    }
    const baseNum = s.number || s.sectionNumber || null;
    // Preamble = text before the first sub-clause (the SEC-filings exception /
    // materiality-scrape chapeau). Keep it as its own section.
    const preText = text.slice(0, parts[0].start).trim();
    if (preText.length > 40) {
      out.push({ ...s, text: preText, _umbrellaPreamble: true });
    }
    for (const p of parts) {
      out.push({
        ...s,
        number: baseNum ? `${baseNum}(${p.letter})` : `(${p.letter})`,
        sectionNumber: baseNum ? `${baseNum}(${p.letter})` : `(${p.letter})`,
        title: p.title,
        heading: p.title,
        category: p.title,
        text: p.text,
        startChar: typeof s.startChar === 'number' ? s.startChar + p.start : s.startChar,
        _umbrellaChild: true,
      });
    }
  }
  return out;
}

// ---------------------------------------------------------------------------
// Strategy C: Section-level AI — one provision per section, classified +
// feature-extracted in chunked batches.
// Routed types (STRATEGY_C_TYPES): REP-T, REP-B, STRUCT, CONSID, COV, MISC,
// OTHER (and any unknown type). NOT TERMR (→ Strategy A) or TERMF (→ B).
// ---------------------------------------------------------------------------

async function strategyC(sections, client, opts = {}) {
  const provisions = [];

  // Structure-aware pre-pass: split umbrella rep sections (all reps under one
  // section number with titled (a)-(v) sub-clauses) into one section per rep,
  // so the one-provision-per-section logic below yields one row per rep.
  sections = splitUmbrellaRepSections(sections);

  // Group by type — one AI call per type
  const byType = {};
  for (const s of sections) {
    const key = s.provision_type;
    if (!byType[key]) byType[key] = [];
    byType[key].push(s);
  }

  const tasks = Object.entries(byType).map(([typeKey, typeSections]) => async () => {
    const codesList = buildCodesList(typeKey);
    const featureInstructions = buildFeatureInstructions(typeKey);

    // Per-section input cap. Most reps are short, but ENUMERATED reps —
    // Material Contracts (the (i)-(xxi) bucket list), Absence-of-Changes,
    // Undisclosed Liabilities, ERISA — carry their whole enumerated list in
    // ONE section. Capping those at 4000 chars chopped everything past
    // ~clause (vii) before the model ever saw it (the "only 7 of 21 buckets"
    // bug). Give such sections a large cap; keep a modest cap for the rest.
    const isEnumeratedRep = (s) => {
      const title = String(s.title || s.heading || s.category || '');
      const body = String(s.text || '');
      return (
        /material\s+contracts?\b/i.test(title) ||
        /absence\s+of\s+(?:certain\s+)?changes/i.test(title) ||
        /undisclosed\s+liabilities|no\s+(?:undisclosed\s+)?liabilities/i.test(title) ||
        /employee\s+benefit|\berisa\b/i.test(title) ||
        // body signature: references material contracts AND enumerates (i)/(ii)
        (/material\s+contract/i.test(body) && /\(\s*[ivx]+\s*\)/i.test(body))
      );
    };
    const sectionCap = (s) => (isEnumeratedRep(s) || s.text.length > 4000 ? 30000 : 6000);

    // Chunk sections so no single call truncates its JSON output. Heavy
    // sections (long or enumerated) are isolated into their own call so their
    // verbatim output owns the full token budget; the rest batch together.
    // Sending every section in one call let a long REP-T response overflow
    // max_tokens and drop trailing reps + the tail of a bucket list.
    const REGULAR_CHUNK_SIZE = 6;
    const chunks = [];
    {
      let batch = [];
      for (let i = 0; i < typeSections.length; i++) {
        const s = typeSections[i];
        if (isEnumeratedRep(s) || s.text.length > 6000) {
          if (batch.length) { chunks.push(batch); batch = []; }
          chunks.push([i]); // isolate the heavy section in its own call
        } else {
          batch.push(i);
          if (batch.length >= REGULAR_CHUNK_SIZE) { chunks.push(batch); batch = []; }
        }
      }
      if (batch.length) chunks.push(batch);
    }

    const buildSectionPrompt = (sectionPayload) => `You are a senior M&A attorney. Classify each section below into exactly one canonical rubric code, assess favorability, and extract features.

PROVISION TYPE: ${typeKey} — ${getTypeLabel(typeKey)}

VALID CANONICAL CODES for ${typeKey}:
${codesList}

SECTIONS TO CLASSIFY (each has a sectionNumber, sectionTitle, articleTitle, and text):
${JSON.stringify(sectionPayload, null, 2)}
${featureInstructions}
CRITICAL CLASSIFICATION RULES:
1. Each section gets a UNIQUE canonical code based on its sectionTitle and content.
   Do NOT default multiple sections to the same code just because they are
   the same provision type. Different sections cover different topics.
2. The sectionTitle is your strongest signal — e.g. a section titled
   "The Merger" should map to a STRUCT code about the merger structure,
   "Closing" to a closing-mechanics code, "Effective Time" to an effective-time
   code, etc. Use the title FIRST, then confirm with the text.
3. Articles group related sections (e.g. Article III = company reps).
   Use articleTitle as supporting context but the sectionTitle is the primary signal.
4. If two sections truly cover the exact same concept, both can share a code,
   but this should be rare. Prefer distinct codes when titles differ.

For each section:
1. Pick the single best matching canonical code (driven by sectionTitle + content).
2. Provide the human-readable category label.
3. Assess favorability from the buyer's perspective.
4. POPULATE the structured "features" object with EVERY applicable field from the schema above. The features object powers the UI's structured display, so do not skip it.

VERBATIM RULE: any "text" field in features (tagged items, excerpts, etc.) MUST be copied character-for-character from the source, including ALL parentheticals, qualifiers, and footnotes. Do NOT summarize or paraphrase.

If NO existing code fits a section, set "isNewCode": true and propose a code (format: "${typeKey}-NEWNAME") and label derived from the sectionTitle.

Return ONLY valid JSON (no markdown, no backticks). Echo back each section's
"idx" EXACTLY as given so results map to the right section. Each result MUST
include a populated "features" object:
{
  "results": [
    {
      "idx": 0,
      "code": "${typeKey}-EXAMPLE",
      "category": "Example Label",
      "favorability": "neutral",
      "features": { /* schema fields populated */ },
      "isNewCode": false,
      "proposedCode": null,
      "proposedLabel": null
    }
  ]
}`;

    try {
      const resultMap = {};
      for (const chunkIdxs of chunks) {
        const sectionPayload = chunkIdxs.map((gi) => {
          const s = typeSections[gi];
          const cap = sectionCap(s);
          return {
            idx: gi,
            sectionNumber: s.number || null,
            sectionTitle: s.title || s.heading || s.category || null,
            articleNumber: s.articleNumber || null,
            articleTitle: s.articleTitle || null,
            text: s.text.length > cap ? s.text.substring(0, cap) : s.text,
          };
        });
        const prompt = buildSectionPrompt(sectionPayload);
        try {
          const resp = await client.messages.create({
            model: MODEL,
            max_tokens: 16000,
            messages: [{ role: 'user', content: prompt }],
          });
          const raw = resp.content.map((c) => c.text || '').join('');
          const parsed = parseJSON(raw);
          for (const r of (parsed.results || [])) {
            if (r && typeof r.idx === 'number') resultMap[r.idx] = r;
          }
        } catch (chunkErr) {
          for (const gi of chunkIdxs) {
            if (!resultMap[gi]) resultMap[gi] = { _error: chunkErr.message };
          }
        }
      }

      for (let i = 0; i < typeSections.length; i++) {
        const section = typeSections[i];
        const aiResult = resultMap[i] || {};
        const stampedCode = section.provisionCode && isValidCode(section.provisionCode)
          ? section.provisionCode
          : null;
        // A reviewed v1 OPEN_WORLD section is an explicit abstention. Its
        // extraction may retain evidence, but cannot mint an AI code.
        const isOpenWorld = section.v1Disposition === 'OPEN_WORLD';
        const code = isOpenWorld ? null : (stampedCode || aiResult.code || null);
        const codeEntry = code ? CODES[code] : null;

        // Carry the source section number into features so downstream
        // consumers (render-time bring-down derivation, COND cite
        // resolution) can match REP provisions to tiers cited by section
        // number.
        let features = aiResult.features || {};
        if (isOpenWorld) features = { ...features, v1Disposition: 'OPEN_WORLD' };
        if (code === 'STRUCT-OFFER') {
          features = {
            ...features,
            ...extractTenderOfferMechanicsFeatures(section),
          };
        }
        const sectionNumber = section.number || section.sectionNumber || null;
        if (sectionNumber && !features.sectionNumber) {
          features.sectionNumber = sectionNumber;
        }
        if (section.categoryCanonical && !features.categoryCanonical) {
          features.categoryCanonical = section.categoryCanonical;
        }
        // For STRUCT, OTHER, CONSID-EQUITY, and dedicated COV subcodes filter
        // to the code's specific schema so we don't carry irrelevant fields.
        if (isValidCode(code) && (
          code.startsWith('STRUCT-') ||
          code === 'CONSID-EQUITY' ||
          code === 'COV-EMPLOYEE' ||
          code === 'COV-PROXY' ||
          code === 'COV-MEETING'
        )) {
          features = filterFeaturesToCodeSchema(features, code);
        }
        // For non-matching COV codes, strip code-specific fields that may
        // have been speculatively emitted by the AI in the merged prompt.
        if (typeKey === 'COV' && isValidCode(code) && code !== 'COV-EMPLOYEE') {
          const empOnly = new Set([
            'protectionPeriod',
            'protectionPeriodMonths',
            'postProtectionPeriodMonths',
            'postProtectionStandard',
            'compensationItems',
            'severanceProtection',
            'continuedService',
            'continued401k',
            'unionContracts',
            'eligibilityWaiver',
          ]);
          for (const k of empOnly) {
            if (k in features) delete features[k];
          }
        }
        if (typeKey === 'COV' && isValidCode(code) && code !== 'COV-PROXY' && code !== 'COV-MEETING') {
          const secMeetingOnly = new Set([
            'proxyFilingDeadline',
            'mailingDeadline',
            'meetingDeadline',
            'adjournmentRights',
            'meetingControlNotes',
          ]);
          for (const k of secMeetingOnly) {
            if (k in features) delete features[k];
          }
        }
        // For OTHER provisions, stamp section metadata into features so the
        // 100%-coverage backfill has section number / title regardless of
        // what the AI emitted.
        if (typeKey === 'OTHER') {
          if (!features.sectionNumber && sectionNumber) features.sectionNumber = sectionNumber;
          if (!features.sectionTitle) {
            features.sectionTitle = section.title || section.heading || section.category || null;
          }
        }

        provisions.push(makeProvision({
          type: typeKey,
          code: isValidCode(code) ? code : null,
          category: codeEntry
            ? codeEntry.label
            : (aiResult.category || section.category || 'Unclassified'),
          text: section.text,
          startChar: section.startChar,
          endChar: section.endChar,
          regionId: section.regionId || section.region_id || null,
          region_id: section.regionId || section.region_id || null,
          regionKey: section.regionKey || null,
          regionType: section.regionType || null,
          categoryCanonical: section.categoryCanonical || features.categoryCanonical || null,
          favorability: aiResult.favorability || 'neutral',
          features,
          relatedDefinitions: findRelatedDefinitions(section.text),
          isNewCode: aiResult.isNewCode || false,
          proposedCode: aiResult.proposedCode || null,
          proposedLabel: aiResult.proposedLabel || null,
        }));
      }
    } catch (err) {
      // Fallback
      for (const s of typeSections) {
        provisions.push(makeProvision({
          type: typeKey,
          code: null,
          category: s.category || 'Unclassified',
          text: s.text,
          startChar: s.startChar,
          endChar: s.endChar,
          regionId: s.regionId || s.region_id || null,
          region_id: s.regionId || s.region_id || null,
          regionKey: s.regionKey || null,
          regionType: s.regionType || null,
          categoryCanonical: s.categoryCanonical || null,
          relatedDefinitions: findRelatedDefinitions(s.text),
          _error: err.message,
        }));
      }
    }
  });

  await runWithConcurrency(tasks, MAX_CONCURRENT);
  attachStrategySpanClaims(sections, provisions, opts);
  return provisions;
}

// ---------------------------------------------------------------------------
// Strategy D: Definition splitting (DEF)
// ---------------------------------------------------------------------------

async function strategyD(sections, client) {
  const provisions = [];

  // 1. Regex-split all DEF sections into individual definitions
  const allDefs = [];
  for (const section of sections) {
    const parts = splitDefinitions(section.text);
    if (parts) {
      for (const part of parts) {
        // Check alias lookup first
        const aliasCode = part.term !== '_preamble'
          ? findCodeByAlias(part.term)
          : null;

        allDefs.push({
          term: part.term,
          text: part.text,
          startChar: section.startChar,
          aliasCode,
        });
      }
    } else {
      // Couldn't split — treat the whole section as a single def
      allDefs.push({
        term: section.category || 'Definitions',
        text: section.text,
        startChar: section.startChar,
        aliasCode: null,
      });
    }
  }

  if (allDefs.length === 0) return provisions;

  // 2. Handle preambles immediately (no AI needed)
  const preambles = allDefs.filter((d) => d.term === '_preamble');
  for (const p of preambles) {
    provisions.push(makeProvision({
      type: 'DEF',
      code: 'DEF-GENERAL',
      category: 'General / Preamble',
      text: p.text,
      startChar: p.startChar,
      relatedDefinitions: [],
    }));
  }

  // 3. For defs with alias matches, we already know the code
  const needsAI = [];
  const aliasMatched = [];
  for (const d of allDefs) {
    if (d.term === '_preamble') continue;
    if (d.aliasCode) {
      aliasMatched.push(d);
    } else {
      needsAI.push(d);
    }
  }

  // Emit alias-matched definitions
  for (const d of aliasMatched) {
    provisions.push(makeProvision({
      type: 'DEF',
      code: d.aliasCode,
      // Name by the actual defined term, not the canonical code label.
      category: d.term || (CODES[d.aliasCode] ? CODES[d.aliasCode].label : 'Definition'),
      text: d.text,
      startChar: d.startChar,
      features: { canonicalTerm: d.term },
      relatedDefinitions: findRelatedDefinitions(d.text),
    }));
  }

  // 4. Send remaining definitions to Claude for classification + feature extraction
  if (needsAI.length > 0) {
    const codesList = buildCodesList('DEF');
    const featureInstructions = buildFeatureInstructions('DEF');

    const defPayload = needsAI.map((d, idx) => {
      // MAE-style definitions carry a long enumerated carve-out list ((A)-(J))
      // plus a disproportionate-effect clause — a 2000-char cap chopped off the
      // back half (the missing carve-outs the user reported). Give carve-out-
      // heavy definitions a much larger budget; keep the tight cap for the long
      // tail of short definitions so the batch stays within token limits.
      const isCarveoutHeavy = /material\s+adverse\s+effect/i.test(d.term || '')
        || /\bmeans\b[\s\S]*\([A-J]\)[\s\S]*\([A-J]\)/.test(d.text || '');
      const cap = isCarveoutHeavy ? 9000 : 2000;
      return {
        idx,
        term: d.term,
        text: d.text.length > cap ? d.text.substring(0, cap) : d.text,
      };
    });

    const prompt = `You are a senior M&A attorney. Classify each defined term below into the best matching canonical rubric code, and extract STRUCTURED features.

VALID DEF CODES:
${codesList}

DEFINITIONS TO CLASSIFY:
${JSON.stringify(defPayload, null, 2)}
${featureInstructions}
For each definition:
1. Pick the best matching canonical code.
2. Assess favorability from the buyer's perspective.
3. POPULATE the "features" object with every applicable schema field — including "canonicalTerm", "definitionText", "crossReferences", and (for MAE) "carveouts" (lowercase) and "disproportionateImpactClause".
4. Identify related provision codes — e.g., "Superior Proposal" relates to NOSOL provisions, "MAE" relates to COND-B-MAE.

If no existing code fits, set "isNewCode": true and propose a code (format: "DEF-NEWNAME") and label.

Return ONLY valid JSON (no markdown, no backticks). Each result MUST include a populated "features" object:
{
  "results": [
    {
      "idx": 0,
      "code": "DEF-MAE",
      "category": "Material Adverse Effect",
      "favorability": "neutral",
      "features": { /* schema fields populated */ },
      "relatedProvisionTypes": ["COND-B-MAE"],
      "isNewCode": false,
      "proposedCode": null,
      "proposedLabel": null
    }
  ]
}`;

    try {
      const resp = await client.messages.create({
        model: MODEL,
        max_tokens: 12000,
        messages: [{ role: 'user', content: prompt }],
      });

      const raw = resp.content.map((c) => c.text || '').join('');
      const parsed = parseJSON(raw);
      const resultMap = {};
      for (const r of (parsed.results || [])) {
        resultMap[r.idx] = r;
      }

      for (let i = 0; i < needsAI.length; i++) {
        const d = needsAI[i];
        const aiResult = resultMap[i] || {};
        const code = aiResult.code || null;
        const codeEntry = code ? CODES[code] : null;

        // Merge AI-suggested related provision types into relatedDefinitions
        const related = findRelatedDefinitions(d.text);
        if (aiResult.relatedProvisionTypes) {
          for (const rp of aiResult.relatedProvisionTypes) {
            if (!related.includes(rp)) related.push(rp);
          }
        }

        // Always pin the verbatim defined term to features.canonicalTerm
        // so the UI shows the AGREEMENT's wording (e.g. "Company Material
        // Adverse Effect") rather than the generic code label.
        //
        // Item 24: ALWAYS overwrite with the regex-captured term. The AI has
        // been observed shortening "Clinical Trial Milestone Payment Amount"
        // to just "Clinical" via its `canonicalTerm` field. The AI's job is
        // to assign a DEF-* code — naming the term is regex's job.
        const features = aiResult.features || {};
        features.canonicalTerm = d.term;
        provisions.push(makeProvision({
          type: 'DEF',
          code: isValidCode(code) ? code : null,
          // Name the provision by its ACTUAL defined term (d.term), NOT the
          // canonical code label. A definition's identity is the term the
          // agreement defines ("ESPP Purchase Right", "FDA") — the canonical
          // DEF-* code is a classification, not a rename. Using codeEntry.label
          // here caused distinct defined terms to all show as the generic
          // bucket label (e.g. "Company Equity Awards") in the sidebar.
          category: d.term || aiResult.category || (codeEntry ? codeEntry.label : 'Definition'),
          text: d.text,
          startChar: d.startChar,
          favorability: aiResult.favorability || 'neutral',
          features,
          relatedDefinitions: related,
          isNewCode: aiResult.isNewCode || false,
          proposedCode: aiResult.proposedCode || null,
          proposedLabel: aiResult.proposedLabel || null,
        }));
      }
    } catch (err) {
      // Fallback: emit each definition unclassified
      for (const d of needsAI) {
        provisions.push(makeProvision({
          type: 'DEF',
          code: null,
          category: d.term,
          text: d.text,
          startChar: d.startChar,
          features: { canonicalTerm: d.term },
          relatedDefinitions: findRelatedDefinitions(d.text),
          _error: err.message,
        }));
      }
    }
  }

  // 5. Feature extraction for alias-matched defs (batch call)
  //
  // EXT-1: alias-matched definitions are emitted above with
  // `features: { canonicalTerm }` — never an EMPTY bag — so the old
  // `Object.keys(p.features).length === 0` filter matched nothing and this
  // pass was dead code (alias-matched MAEs shipped with no carve-outs).
  // A definition "needs features" when it carries nothing beyond the
  // bookkeeping `canonicalTerm` key. AI-classified defs that came back with
  // substantive features are untouched; error-fallback defs are excluded by
  // the `p.code` check (their code is null), as before.
  const defNeedsFeatureExtraction = (p) =>
    Object.keys(p.features || {}).every((k) => k === 'canonicalTerm');
  const aliasProvisions = provisions.filter(
    (p) => p.type === 'DEF' && p.code && defNeedsFeatureExtraction(p)
      && p.category !== 'General / Preamble'
  );

  if (aliasProvisions.length > 0) {
    const featureInstructions = buildFeatureInstructions('DEF');
    if (featureInstructions) {
      const featurePayload = aliasProvisions.map((p, idx) => {
        // Same carve-out-heavy budget as the classification pass above: a
        // 2000-char cap chops the enumerated (A)-(J) carve-outs off the back
        // of an MAE definition — the exact data this pass exists to recover.
        const term = (p.features && p.features.canonicalTerm) || p.category || '';
        const isCarveoutHeavy = p.code === 'DEF-MAE'
          || /material\s+adverse\s+(?:effect|change)/i.test(term)
          || /\bmeans\b[\s\S]*\([A-J]\)[\s\S]*\([A-J]\)/.test(p.text || '');
        const cap = isCarveoutHeavy ? 9000 : 2000;
        return {
          idx,
          code: p.code,
          term: term || undefined,
          text: p.text.length > cap ? p.text.substring(0, cap) : p.text,
        };
      });

      const featurePrompt = `Extract features from each definition below.
${featureInstructions}
DEFINITIONS:
${JSON.stringify(featurePayload, null, 2)}

Return ONLY valid JSON (no markdown, no backticks):
{
  "results": [
    {
      "idx": 0,
      "features": {},
      "favorability": "neutral"
    }
  ]
}`;

      try {
        const resp = await client.messages.create({
          model: MODEL,
          max_tokens: 10000,
          messages: [{ role: 'user', content: featurePrompt }],
        });

        const raw = resp.content.map((c) => c.text || '').join('');
        const parsed = parseJSON(raw);
        for (const r of (parsed.results || [])) {
          if (r.idx >= 0 && r.idx < aliasProvisions.length) {
            const target = aliasProvisions[r.idx];
            // Merge, re-pinning canonicalTerm: the regex-captured term is
            // authoritative (see step 4's Item 24 note) and must survive a
            // model response that omits or rewrites it.
            const pinnedTerm = target.features && target.features.canonicalTerm;
            target.features = { ...(r.features || {}) };
            if (pinnedTerm) target.features.canonicalTerm = pinnedTerm;
            if (r.favorability) {
              target.favorability = r.favorability;
            }
          }
        }
      } catch {
        // Features are best-effort; continue without them
      }
    }
  }

  return provisions;
}

// ---------------------------------------------------------------------------
// Main entry point
// ---------------------------------------------------------------------------

/**
 * Extract provisions from classified sections.
 *
 * @param {Array<Object>} classifiedSections — output from Phase 2 (classify)
 *   Each has: { provision_type, text, startChar, category?, number?, ... }
 * @param {Object} client — Anthropic SDK client instance
 * @returns {Promise<Array<Object>>} provisions with canonical codes and features
 */
/**
 * Expand a "type group" to the set of provision_type values that should be
 * fanned in together. E.g. when the caller asks for 'IOC', also include
 * sections classified as 'IOC-T' / 'IOC-B'. Used by both the per-type extract
 * and the per-type store so deletion + re-insertion stay symmetric.
 */
function expandTypeGroup(type) {
  if (!type) return [];
  if (type === 'IOC') return ['IOC', 'IOC-T', 'IOC-B'];
  if (type === 'TERMR') return ['TERMR', 'TERMR-M', 'TERMR-B', 'TERMR-T'];
  if (type === 'COND') return ['COND', 'COND-M', 'COND-B', 'COND-S'];
  if (type === 'NOSOL') return ['NOSOL', 'NOSOL-T', 'NOSOL-B', 'NOSOL-M'];
  return [type];
}

/**
 * Extract provisions for a SINGLE provision type from a pre-classified set of
 * sections. Filters sections to the requested type (with sub-type expansion),
 * dispatches to the appropriate strategy (A/B/C/D), and returns the extracted
 * provisions. Does NOT run inline-definition discovery unless the caller is
 * extracting DEF.
 *
 * @param {Array} classifiedSections — sections with provision_type set
 * @param {string} type — canonical type key (e.g. 'REP-T', 'IOC', 'DEF')
 * @param {Object} client — Anthropic client
 * @param {string} fullCleanedText — full cleaned agreement text (for inline-def DEF only)
 */
// `opts` is optional and additive: today only `spanClaims` is read, threaded
// into the Strategy A/C span hook exactly as extractProvisions does. Callers
// that pass nothing (lib/parser-v2/run-extract.js) keep the previous
// behaviour unchanged.
async function extractProvisionsForType(classifiedSections, type, client, fullCleanedText, dealMeta = {}, opts = {}) {
  if (!type) return [];

  const wanted = new Set(expandTypeGroup(type));
  const filtered = classifiedSections.filter(
    (s) => s.provision_type && wanted.has(s.provision_type),
  );

  let provisions = [];

  if (type === 'DEF') {
    provisions = filtered.length > 0 ? await strategyD(filtered, client) : [];
    // Inline-definitions augmentation pass — only run during DEF extraction
    // so the standalone DEF call surfaces inline definitions discovered
    // elsewhere in the agreement.
    try {
      const inlineDefProvisions = await extractInlineDefinitionsFromSections(
        classifiedSections,
        provisions,
        client,
        fullCleanedText,
      );
      provisions = provisions.concat(inlineDefProvisions);
    } catch (err) {
      console.warn('[extract] inline-def discovery failed:', err.message);
    }
    sortDefinitionsAlphabetically(provisions);
  } else if (STRATEGY_A_TYPES.has(type)) {
    provisions = filtered.length > 0 ? await strategyA(filtered, client, opts) : [];
  } else if (STRATEGY_B_TYPES.has(type)) {
    provisions = filtered.length > 0 ? await strategyB(filtered, client, classifiedSections) : [];
  } else if (STRATEGY_C_TYPES.has(type)) {
    provisions = filtered.length > 0 ? await strategyC(filtered, client, opts) : [];
  } else {
    // Unknown type — fall back to Strategy C
    provisions = filtered.length > 0 ? await strategyC(filtered, client, opts) : [];
  }

  // For CONSID, run the same deterministic backfills the full pipeline runs
  // (extractProvisions) BEFORE expanding equity instruments per row, so a
  // standalone/reprocess CONSID extract returns the same shape AND the same
  // repaired data as the all-types path — otherwise every CONSID reprocess
  // silently clobbers the instrument-mention and CVR-exhibit backfills
  // (audit-2 item 1: this happened twice in production before this fix).
  // Order mirrors extractProvisions(): mentions backstop -> per-instrument
  // expansion -> CVR exhibit sum (which reads the post-expansion CVR row).
  if (type === 'CONSID') {
    backfillMissingInstrumentMentions(provisions);
    convertConsiderationEquityProvisions(provisions);
    expandConsidEquityByInstrument(provisions);
    backfillCvrMaxFromExhibit(provisions, fullCleanedText);
  }

  // P7 item 23: when a REP-T Financial Statements provision embeds a
  // "no undisclosed liabilities" sub-clause, split that out as its own
  // REP-T-NOLIAB provision so the row appears separately in the rep table.
  if (type === 'REP-T') {
    splitUndisclosedLiabilitiesFromFinStmt(provisions);
  }

  if (type === 'REP-T' && fullCleanedText) {
    stampMaterialContractsBucketsFromDefinitions(
      provisionsWithMaterialContractsDefinitionFromText(provisions, fullCleanedText),
    );
  }

  applyPerTypeLocalPostPasses(type, provisions, dealMeta);
  provisions._boundaryRepairReport = repairProvisionTextBoundariesFromSections(filtered, provisions);
  normalizeAntitrustRegulatoryFeatures(provisions);

  // Clean up internal-only fields
  for (const p of provisions) {
    delete p._error;
  }

  return provisions;
}

function filterProvisionsToTypeGroup(type, provisions) {
  if (!Array.isArray(provisions)) return [];
  const wanted = new Set(expandTypeGroup(type));
  if (wanted.size === 0) return [];
  return provisions.filter((p) => p && wanted.has(p.type));
}

function applyPerTypeLocalPostPasses(type, provisions, dealMeta = {}) {
  if (!Array.isArray(provisions) || provisions.length === 0) return provisions;
  if (type === 'REP-T' || type === 'REP-B') {
    linkMaterialityScopeToReps(provisions);
  }
  if (type === 'IOC') {
    normalizeIocLimbEffortsStandards(provisions);
    liftIncludedObligationsFromLimbText(provisions);
    stampIocRestrictionComponents(provisions);
  }
  if (type === 'TERMR') {
    computeOutsideDateMonths(provisions, dealMeta);
  }
  return provisions;
}

function provisionBoundaryText(provision) {
  if (!provision || typeof provision !== 'object') return '';
  return String(
    typeof provision.text === 'string'
      ? provision.text
      : typeof provision.full_text === 'string'
        ? provision.full_text
        : '',
  );
}

function setProvisionBoundaryText(provision, text) {
  if (!provision || typeof provision !== 'object') return;
  if (typeof provision.text === 'string') provision.text = text;
  if (typeof provision.full_text === 'string') provision.full_text = text;
  if (typeof provision.text !== 'string' && typeof provision.full_text !== 'string') {
    provision.text = text;
  }
}

function findProvisionLocalStart(provision, sectionText, sectionStart) {
  const ptext = provisionBoundaryText(provision);
  if (!ptext || ptext.length < 20) return -1;

  const hinted = typeof provision.startChar === 'number'
    ? provision.startChar - sectionStart
    : -1;
  if (hinted >= 0 && hinted < sectionText.length) {
    const windowStart = Math.max(0, hinted - 50);
    const windowEnd = Math.min(sectionText.length, hinted + 50);
    const near = sectionText.indexOf(ptext, windowStart);
    if (near >= 0 && near <= windowEnd) return near;
  }

  const exact = sectionText.indexOf(ptext);
  if (exact >= 0) return exact;

  const prefix = ptext.slice(0, Math.min(180, ptext.length)).trim();
  if (prefix.length >= 40) {
    const escaped = prefix
      .replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
      .replace(/\s+/g, '\\s+');
    const m = String(sectionText || '').match(new RegExp(escaped));
    if (m && typeof m.index === 'number') return m.index;
  }

  return -1;
}

function sectionForProvision(provision, sections) {
  const start = typeof provision.startChar === 'number' ? provision.startChar : null;
  const text = provisionBoundaryText(provision);
  for (const section of sections) {
    if (!section || !section.text) continue;
    const sectionStart = Number(section.startChar) || 0;
    const sectionEnd = sectionStart + String(section.text).length;
    if (start != null && start >= sectionStart && start < sectionEnd) return section;
  }
  if (!text || text.length < 40) return null;
  const probe = text.slice(0, Math.min(120, text.length));
  return sections.find((section) => section && section.text && String(section.text).includes(probe)) || null;
}

function nextProvisionLocalStart(provision, provisions, sectionText, sectionStart, currentEnd) {
  let next = sectionText.length;
  for (const candidate of provisions) {
    if (!candidate || candidate === provision) continue;
    if (candidate.type === 'SECTION-LEFTOVER') continue;
    const candidateText = provisionBoundaryText(candidate);
    if (!candidateText || candidateText.length < 20) continue;
    const local = findProvisionLocalStart(candidate, sectionText, sectionStart);
    if (local > currentEnd && local < next) next = local;
  }
  return next;
}

function shouldRepairProvisionBoundary(provision, sectionText, localStart, localEnd) {
  if (!provision || provision.type === 'DEF' || provision.type === 'OTHER' || provision.type === 'SECTION-LEFTOVER') {
    return false;
  }
  const prev = sectionText.slice(localStart, localEnd);
  const next = sectionText.slice(localEnd, Math.min(sectionText.length, localEnd + 240));
  return !isLegalSentenceBoundary(prev, next);
}

function extendToLastLegalBoundaryBefore(text, startOffset, hardEnd) {
  const source = String(text || '');
  const limit = Math.max(0, Math.min(source.length, Number(hardEnd) || 0));
  let cursor = Math.max(0, Math.min(limit, Number(startOffset) || 0));
  let best = -1;

  while (cursor < limit) {
    const rel = source.slice(cursor, limit).search(/[.?!;:]["')\]]?(?=\s|$)/);
    if (rel < 0) break;
    const end = cursor + rel + 1;
    const prev = source.slice(0, end);
    const next = source.slice(end, Math.min(source.length, end + 240));
    if (isLegalSentenceBoundary(prev, next)) best = end;
    cursor = end + 1;
  }

  return best > startOffset ? best : extendToSentenceBoundary(source, startOffset, limit);
}

function repairProvisionTextBoundariesFromSections(classifiedSections, provisions) {
  const report = { repaired: 0, extended_chars_total: 0, examples: [] };
  if (!Array.isArray(classifiedSections) || !Array.isArray(provisions)) return report;
  const sections = classifiedSections.filter((section) => section && section.text);
  if (sections.length === 0 || provisions.length === 0) return report;

  for (const provision of provisions) {
    const ptext = provisionBoundaryText(provision);
    if (!ptext || ptext.length < 20) continue;
    const section = sectionForProvision(provision, sections);
    if (!section) continue;
    const sectionText = String(section.text || '');
    const sectionStart = Number(section.startChar) || 0;
    const localStart = findProvisionLocalStart(provision, sectionText, sectionStart);
    if (localStart < 0) continue;
    const localEnd = localStart + ptext.length;
    if (localEnd >= sectionText.length) continue;
    if (!shouldRepairProvisionBoundary(provision, sectionText, localStart, localEnd)) continue;

    const nextStart = nextProvisionLocalStart(provision, provisions, sectionText, sectionStart, localEnd);
    const hardEnd = Math.min(sectionText.length, nextStart, localEnd + MAX_BOUNDARY_REPAIR_CHARS);
    if (hardEnd <= localEnd) continue;
    const hasNextProvision = nextStart < sectionText.length;
    const repairedEnd = hasNextProvision
      ? extendToLastLegalBoundaryBefore(sectionText, localEnd, hardEnd)
      : extendToSentenceBoundary(sectionText, localEnd, hardEnd);
    if (repairedEnd <= localEnd) continue;

    const repairedText = sectionText.slice(localStart, repairedEnd).trim();
    if (repairedText.length <= ptext.trim().length) continue;
    const added = repairedText.length - ptext.trim().length;
    setProvisionBoundaryText(provision, repairedText);
    report.repaired += 1;
    report.extended_chars_total += added;
    if (report.examples.length < 5) {
      report.examples.push({
        type: provision.type || null,
        code: provision.code || null,
        category: provision.category || null,
        sectionNumber: section.number || section.sectionNumber || null,
        added,
      });
    }
  }

  return report;
}

function compactSpaces(text) {
  return String(text || '').replace(/\s+/g, ' ').trim();
}

function featureTexts(value, out = []) {
  if (value === null || value === undefined) return out;
  if (typeof value === 'string') {
    if (value.trim()) out.push(value.trim());
    return out;
  }
  if (Array.isArray(value)) {
    for (const item of value) featureTexts(item, out);
    return out;
  }
  if (typeof value === 'object') {
    if (typeof value.text === 'string' && value.text.trim()) out.push(value.text.trim());
    if (typeof value.value === 'string' && value.value.trim()) out.push(value.value.trim());
    if (Array.isArray(value.quotes)) {
      for (const q of value.quotes) {
        if (typeof q === 'string' && q.trim()) out.push(q.trim());
      }
    }
    if (value.value && typeof value.value === 'object' && value.value !== value) {
      featureTexts(value.value, out);
    }
  }
  return out;
}

function firstAntitrustSentenceMatching(text, predicate) {
  const source = String(text || '');
  if (!source.trim()) return null;
  const re = /[^.!?]+[.!?](?=\s|$)|[^.!?]+$/g;
  let match;
  while ((match = re.exec(source)) !== null) {
    const sentence = compactSpaces(match[0]);
    if (sentence && predicate(sentence)) return sentence;
  }
  return null;
}

function textIncludesAny(text, patterns) {
  const s = String(text || '');
  return patterns.some((pattern) => pattern.test(s));
}

function tagged(code, family, text) {
  return { code, label: family[code] || code, text: text || null };
}

function findHsrTimingSentence(text) {
  return firstAntitrustSentenceMatching(text, (sentence) => (
    /\b(?:HSR|Hart[\s-]*Scott|Foreign\s+Merger\s+Control|Antitrust)\b/i.test(sentence)
    && /\b(?:pull\s+and\s+refile|withdraw\s+and\s+refile|extend[^.]{0,120}waiting\s+period|delay\s+or\s+not\s+to\s+consummate|timing\s+agreement)\b/i.test(sentence)
  ));
}

function ensureFullTimingSentence(provision) {
  const features = provision.features || {};
  const source = provisionBoundaryText(provision);
  const sentence = findHsrTimingSentence(source);
  if (!sentence) return;

  if (/\b(?:pull\s+and\s+refile|withdraw\s+and\s+refile)\b/i.test(sentence)) {
    const buyerUnilateral = /\b(?:Parent|Buyer)\s+may\b[^.]{0,240}\b(?:pull\s+and\s+refile|withdraw\s+and\s+refile)\b/i.test(sentence);
    const consentGated = /\bconsent\b/i.test(sentence);
    features.pullRefile = tagged(
      buyerUnilateral ? 'BUYER_UNILATERAL_GF' : (consentGated ? 'MUTUAL_CONSENT' : 'SILENT'),
      PULL_REFILE,
      sentence,
    );
    features.pullRefileText = sentence;
    if (consentGated) features.pullAndRefileCompanyConsent = true;
  }

  if (/\b(?:extend[^.]{0,120}waiting\s+period|agreement\s+with\s+a\s+Governmental\s+Entity\s+to\s+delay|timing\s+agreement|delay\s+or\s+not\s+to\s+consummate)\b/i.test(sentence)) {
    features.timingAgreementsProhibited = true;
    features.timingAgreement = tagged('BARRED_MUTUAL_CONSENT', TIMING_AGREEMENT, sentence);
    features.timingAgreementText = sentence;
  }
}

function extractClearSkiesClause(text, partyName) {
  const source = String(text || '');
  if (!source.trim()) return null;
  const partyRe = partyName === 'parent'
    ? /\bParent\b/i
    : /\b(?:Company|Company\s+Subsidiaries|Subsidiaries)\b/i;
  const starts = [];
  const startRe = /\b(?:Parent|Company)\s+shall\s+not\b|\b(?:Parent|Company)\s+and\s+(?:its|the)\s+Subsidiaries\s+shall\s+not\b/gi;
  let m;
  while ((m = startRe.exec(source)) !== null) starts.push(m.index);
  if (starts.length === 0) {
    const sentence = firstAntitrustSentenceMatching(source, (s) => partyRe.test(s)
      && /reasonably\s+be\s+expected\s+to/i.test(s)
      && /prevent\s+or\s+materially\s+delay|make\s+materially\s+(?:more\s+)?difficult|make\s+materially\s+conditions\s+more\s+difficult/i.test(s));
    return sentence;
  }

  for (let i = 0; i < starts.length; i += 1) {
    const start = starts[i];
    const end = i + 1 < starts.length ? starts[i + 1] : source.length;
    const slice = compactSpaces(source.slice(start, end).replace(/^[;,\s]+/, '').replace(/[;,\s]+$/, ''));
    if (
      slice
      && partyRe.test(slice)
      && /reasonably\s+be\s+expected\s+to/i.test(slice)
      && /prevent\s+or\s+materially\s+delay|make\s+materially\s+(?:more\s+)?difficult|make\s+materially\s+conditions\s+more\s+difficult/i.test(slice)
    ) {
      return slice;
    }
  }
  return null;
}

function normalizeClearSkies(provision) {
  const text = provisionBoundaryText(provision);
  if (!/reasonably\s+be\s+expected\s+to/i.test(text)) return;
  if (!/prevent\s+or\s+materially\s+delay|make\s+materially\s+(?:more\s+)?difficult|make\s+materially\s+conditions\s+more\s+difficult/i.test(text)) return;
  const features = provision.features || {};
  const parent = extractClearSkiesClause(text, 'parent');
  const company = extractClearSkiesClause(text, 'company');

  if (parent) {
    features.clearSkiesParent = true;
    features.clearSkiesParentScope = parent;
  }
  if (company) {
    features.clearSkiesCompany = true;
    features.clearSkiesCompanyScope = company;
  }
  if (parent || company) {
    features.clearSkies = {
      ...(features.clearSkies && typeof features.clearSkies === 'object' ? features.clearSkies : {}),
      ...(company ? { company: { modifiers: ['MATERIALITY_GATED'], text: company } } : {}),
      ...(parent ? { parent: { modifiers: ['MATERIALITY_GATED'], text: parent } } : {}),
    };
  }
}

function normalizeAntiHohwCapDetail(provision) {
  const features = provision.features || {};
  const raw = features.burdenCommitment;
  const inner = raw && typeof raw === 'object' && raw.value ? raw.value : raw;
  const code = inner && typeof inner === 'object' ? inner.code : null;
  if (code !== 'ANTI_HOHW') return;

  const capDetail = compactSpaces(features.capDetail);
  if (!capDetail) return;
  const useful = /\b(?:Burdensome\s+Condition|material\s+adverse|revenue|EBITDA|assets?|business(?:es)?|product|territor|jurisdiction|dollar|\$|%|percent|except|provided|carve)\b/i.test(capDetail);
  if (!useful) delete features.capDetail;
}

function splitAntitrustApprovalText(text) {
  const source = compactSpaces(text);
  const hsrMatch = source.match(/(?:any\s+applicable\s+)?waiting\s+period[^.;]*?\bHSR\s+Act[^.;]*(?:expired|terminated)[^.;]*/i)
    || source.match(/\bHSR\s+Act[^.;]*(?:expired|terminated)[^.;]*/i);
  const scheduledMatch = source.match(/(?:approvals?|clearances?)[^.;]*?(?:Scheduled\s+Approvals|Company\s+Disclosure\s+Letter|Section\s+7\.01\(a\))[^.;]*/i)
    || source.match(/(?:Scheduled\s+Approvals|Company\s+Disclosure\s+Letter|Section\s+7\.01\(a\))[^.;]*/i);
  return {
    hsr: hsrMatch ? hsrMatch[0].trim() : null,
    scheduled: scheduledMatch ? scheduledMatch[0].trim() : null,
  };
}

function normalizeAntitrustClosingCondition(provision) {
  if (!provision || provision.code !== 'COND-M-REG') return;
  const text = provisionBoundaryText(provision);
  if (!/\bHSR\b|\bHart[\s-]*Scott\b/i.test(text)) return;
  const hasScheduled = /\bScheduled\s+Approvals\b|Company\s+Disclosure\s+Letter|Section\s+7\.01\(a\)/i.test(text);
  const features = provision.features || {};
  features.hsrClearance = true;
  if (hasScheduled) {
    const parts = splitAntitrustApprovalText(text);
    features.antitrustApprovals = [
      { code: 'HSR', label: ANTITRUST_APPROVAL_CODES.HSR, text: parts.hsr || 'HSR Act waiting period expired or terminated' },
      { code: 'SCHEDULED_APPROVALS', label: ANTITRUST_APPROVAL_CODES.SCHEDULED_APPROVALS, text: parts.scheduled || 'Scheduled Approvals obtained' },
    ];
    const current = compactSpaces(features.mainCondition);
    if (!/Scheduled\s+Approvals|scheduled\s+regulatory\s+approvals|Company\s+Disclosure\s+Letter/i.test(current)) {
      features.mainCondition = 'The HSR Act waiting period must have expired or been terminated, and the Scheduled Approvals must have been obtained.';
    }
  }
}

function antitrustOutsideDateExtensionSummary(provisions) {
  for (const p of provisions || []) {
    if (!p || p.code !== 'TERMR-OUTSIDE' || !p.features || typeof p.features !== 'object') continue;
    const texts = [
      ...featureTexts(p.features.extensionConditions),
      ...featureTexts(p.features.outsideDateExtensionConditions),
      ...featureTexts(p.features.outsideDateExtension),
      ...featureTexts(p.features.extensionTrigger),
      ...featureTexts(p.features.mainConcept),
    ];
    const joined = compactSpaces(texts.join(' '));
    if (!textIncludesAny(joined, [/\bHSR\b/i, /antitrust/i, /regulatory/i, /Foreign\s+Merger\s+Control/i, /Section\s+7\.01\(a\)/i])) continue;
    const summary = featureTexts(p.features.extensionConditions)[0] || joined;
    return compactSpaces(`Outside Date extension: ${summary}`);
  }
  return null;
}

function stampAntitrustOutsideDateExtension(provisions) {
  const summary = antitrustOutsideDateExtensionSummary(provisions);
  if (!summary) return;
  const antiTiming = (provisions || []).find((p) => p && p.type === 'ANTI' && (
    p.code === 'ANTI-TIMING'
    || /\b(?:timing|waiting\s+period|pull\s+and\s+refile|withdraw\s+and\s+refile)\b/i.test(provisionBoundaryText(p))
  ));
  if (!antiTiming) return;
  if (!antiTiming.features || typeof antiTiming.features !== 'object') antiTiming.features = {};
  const existing = compactSpaces(antiTiming.features.timingAgreementText);
  if (!existing) {
    antiTiming.features.timingAgreementText = summary;
  } else if (!existing.includes(summary)) {
    antiTiming.features.timingAgreementText = `${existing}\n\n${summary}`;
  }
}

function normalizeAntitrustRegulatoryFeatures(provisions) {
  if (!Array.isArray(provisions)) return provisions;
  for (const p of provisions) {
    if (!p || !p.features || typeof p.features !== 'object') continue;
    if (p.type === 'ANTI') {
      ensureFullTimingSentence(p);
      normalizeClearSkies(p);
      normalizeAntiHohwCapDetail(p);
    }
    normalizeAntitrustClosingCondition(p);
  }
  stampAntitrustOutsideDateExtension(provisions);
  return provisions;
}

// P7 item 23: split a separate "No Undisclosed Liabilities" provision out of
// a REP-T-FINSTMT provision when the body contains the classic anchor. The
// No-Liab clause is typically clause (e) of the SEC Documents; Financial
// Statements rep — so we leave the original FinStmt provision intact AND emit
// a sibling REP-T-NOLIAB provision pointing back at the parent. Each carries
// a `partOfRep` / `alsoSurfacedAs` cross-reference so the rep table can show
// "Also appears in <other rep>" on both rows. Mutates `provisions` in place.
function splitUndisclosedLiabilitiesFromFinStmt(provisions) {
  if (!Array.isArray(provisions)) return;
  const anchor = /(?:no\s+undisclosed\s+liabilit|there\s+are\s+no\s+Liabilit)/i;
  const added = [];
  for (const p of provisions) {
    if (p.type !== 'REP-T') continue;
    if (p.code === 'REP-T-NOLIAB') continue; // already split
    if (!p.text || !anchor.test(p.text)) continue;
    // Only split when the parent provision is Financial Statements (or
    // unclassified) — we don't want to fragment unrelated reps.
    if (p.code && p.code !== 'REP-T-FINSTMT' && p.code !== 'REP-T-NOLIAB') continue;

    // Locate the sub-clause containing the anchor. Pull a window of ±400
    // chars around the match so the new provision text is meaningful.
    const m = p.text.match(anchor);
    if (!m) continue;
    const idx = m.index;
    // Walk backwards to the previous sentence boundary, forward to the next.
    const start = Math.max(0, p.text.lastIndexOf('. ', idx) + 1);
    let end = p.text.indexOf('. ', idx + 10);
    if (end === -1) end = Math.min(p.text.length, idx + 800);
    else end += 1;
    const splitText = p.text.substring(start, end).trim();
    if (splitText.length < 30) continue;

    const parentCategory = p.category || 'SEC Documents; Financial Statements';
    const newProv = makeProvision({
      type: 'REP-T',
      code: 'REP-T-NOLIAB',
      category: 'No Undisclosed Liabilities',
      text: splitText,
      startChar: typeof p.startChar === 'number' ? p.startChar + start : null,
      favorability: p.favorability || 'neutral',
      features: {
        mainConcept: splitText.substring(0, 200),
        // Back-pointer so the rep table can render "Also appears in
        // SEC Documents; Financial Statements" on this synthetic row.
        partOfRep: parentCategory,
        // carry over any explicit exceptions list the parent may have captured
        ...(p.features && p.features.undisclosedLiabilitiesExceptions
          ? { undisclosedLiabilitiesExceptions: p.features.undisclosedLiabilitiesExceptions }
          : {}),
      },
      relatedDefinitions: findRelatedDefinitions(splitText),
    });
    added.push(newProv);

    // Forward-pointer on the parent — surfaces the No-Liab row as a known
    // sub-clause of the FinStmt rep so the user sees it lives in both places.
    if (!p.features) p.features = {};
    if (!Array.isArray(p.features.alsoSurfacedAs)) p.features.alsoSurfacedAs = [];
    if (!p.features.alsoSurfacedAs.includes('No Undisclosed Liabilities')) {
      p.features.alsoSurfacedAs.push('No Undisclosed Liabilities');
    }
  }
  for (const np of added) provisions.push(np);
}

// ---------------------------------------------------------------------------
// v1 reclassification (2026-08-02, R3 — RELOCATED per audit A-C1): the
// anti-reliance FAMILY element scan.
//
// classify.js cannot emit multiple cards from one section (its snapshot
// schema carries exactly one code slot), so it keeps stamping ONE
// family-level (now-retired) code per section — REP-B-ANTIRELIANCE,
// REP-B-NOREP, or REP-T-NOREP — via the existing SUBCODE_REFINEMENT_RULES
// title match. This deterministic post-pass is where the ELEMENT SPLIT
// actually happens: it scans the body of every whole-section provision
// classify routed to one of those three family codes for FOUR
// corpus-evidenced phrase classes —
//   NOOTHERREPS      no-other-reps disclaimer
//   NONRELIANCE      non-reliance acknowledgment
//   INDEPINVEST      independent-investigation acknowledgment
//   FRAUDCARVEOUT    express fraud carve-out
// — and stamps ONE CARD PER ELEMENT PRESENT with element-scoped text spans
// (never the whole section — the card model's instance-id hashes over
// (deal, sectionPath, text), so two elements sharing the whole-section span
// would collide). A section with three elements yields three provisions.
//
// Party mirroring: output codes take the SAME party prefix as the
// originating family code (REP-B-* stays REP-B-*; REP-T-NOREP produces
// REP-T-* element codes) — store-cards.js's partyScopeFromCode derives
// party scope from the code prefix, so this preserves party attribution.
// REP-B-NOREP is explicitly folded (per the ruling) — it is scanned exactly
// like REP-B-ANTIRELIANCE, not special-cased, so a REP-B-NOREP section that
// truly is pure no-other-reps naturally comes out coded REP-B-NOOTHERREPS
// and nothing else.
//
// Boundary detection is deliberately conservative: it looks for
// heading-style lettered sub-clauses (`(a) No Other Representations...`,
// `(c) No Reliance...`) — the drafting convention the corpus evidence is
// built on — and groups each MAXIMAL RUN of consecutive sub-clauses that
// match exactly ONE element type into that element's span. A sub-clause
// matching more than one element pattern, or a section with no lettered
// heading structure to bound on, is UNBOUNDABLE: per the pinned fail-toward-
// review design, the whole section stays a single provision under the
// original (retired) family code with `needs_review: true`, UNLESS the
// no-other-reps phrase class matched somewhere in the unboundable text — in
// which case (and ONLY then) it is coded NOOTHERREPS with needs_review still
// set, never a specific element the scan did not establish.
// ---------------------------------------------------------------------------

const ANTI_RELIANCE_FAMILY_CODES = new Set(['REP-B-ANTIRELIANCE', 'REP-B-NOREP', 'REP-T-NOREP']);

// Phrase classes are drawn from the 2026-08-02 investigation's quoted
// corpus text (FAMILY-MAPPING-RULINGS-2026-08-02.md): ce061fd0 §4.12 /
// df393645 §4.15 (no-other-reps + non-reliance), 0d38cc1f §4.12
// (independent-investigation), 885edae5 §9.07 (fraud carve-out).
const ANTI_RELIANCE_ELEMENT_PATTERNS = {
  // Deliberately EXCLUDES the "except for the representations ... expressly
  // set forth" scoping preamble — that phrase is shared boilerplate that
  // introduces BOTH the no-other-reps clause and the separate non-reliance
  // clause (Skechers §3.28(a) and (c) both open with it), so it can't
  // itself distinguish the elements.
  NOOTHERREPS: /no\s+other\s+representations?(?:\s*(?:,|\s+or)\s+warrant(?:y|ies))?|disclaims?\s+any\s+other\s+(?:express\s+or\s+implied\s+)?representations?\s+or\s+warrant|makes?,?\s+or\s+has\s+made,?\s+any\s+representation\s+or\s+warranty|(?:no\s+Person\s+has\s+been\s+authorized|is\s+in\s+lieu\s+of\s+and\s+(?:is|are)\s+exclusive\s+of\s+all\s+other\s+representations)/i,
  NONRELIANCE: /non[\s-]*reliance\b|no\s+reliance\b|has\s+not\s+relied|does\s+not\s+rely|is\s+not\s+relying|not\s+(?:be\s+)?relying\s+on|not\s+acting[\s\S]{0,120}?\bin\s+reliance\s+on/i,
  INDEPINVEST: /\bindependent\s+investigation\b|\bown\s+(?:independent\s+)?investigation(?:,?\s+review\s+and\s+analysis)?\b|\bown\s+(?:due\s+)?diligence\b|independently\s+(?:investigated|verified|evaluated)/i,
  FRAUDCARVEOUT: /(?:except|other\s+than|notwithstanding|nothing\s+in\s+this\s+(?:Section|Agreement))[\s\S]{0,100}?\bfraud\b|\bfraud\b[\s\S]{0,100}?(?:is\s+not\s+(?:waived|released|limited)|shall\s+(?:survive|not\s+be\s+(?:waived|limited)))/i,
};

// Heading-style lettered sub-clause: `(a) Title Case Phrase.` — the
// drafting convention that marks the start of a new legal concept, as
// opposed to a bare `(b)`/`(i)`/`(ii)` continuation clause with no title.
const SUBCLAUSE_HEADING_RE = /\(([a-z])\)\s+([A-Z][A-Za-z ,;'\-]{2,70}?)\.\s+/g;

function elementCodePrefix(familyCode) {
  return familyCode.startsWith('REP-B-') ? 'REP-B-' : 'REP-T-';
}

/**
 * Splits provision text into heading-bounded sub-clause blocks. Returns
 * [{ start, end, text }] (offsets relative to `text`). If no heading
 * structure is found, returns a single block spanning the whole text.
 */
function splitIntoSubclauseBlocks(text) {
  const heads = [];
  SUBCLAUSE_HEADING_RE.lastIndex = 0;
  let m;
  while ((m = SUBCLAUSE_HEADING_RE.exec(text))) {
    heads.push(m.index);
  }
  if (heads.length === 0) {
    return [{ start: 0, end: text.length, text }];
  }
  const blocks = [];
  // Leading text before the first heading (if any) attaches to the first block.
  const firstStart = 0;
  for (let i = 0; i < heads.length; i++) {
    const start = i === 0 ? firstStart : heads[i];
    const end = i + 1 < heads.length ? heads[i + 1] : text.length;
    blocks.push({ start, end, text: text.slice(start, end) });
  }
  return blocks;
}

/**
 * Which element patterns match inside `blockText`. Returns an array of
 * element keys (0, 1, or >1 — >1 means the block itself is ambiguous).
 */
function matchedElements(blockText) {
  const out = [];
  for (const [key, re] of Object.entries(ANTI_RELIANCE_ELEMENT_PATTERNS)) {
    if (re.test(blockText)) out.push(key);
  }
  return out;
}

/**
 * Deterministic multi-provision emitter for the anti-reliance family
 * (Strategy-B precedent: one section body, many code-distinct provisions
 * with disjoint spans — see module header above). Mutates `provisions` in
 * place: whole-section provisions coded under one of the three
 * ANTI_RELIANCE_FAMILY_CODES are REPLACED by their element-scoped children
 * when the scan can cleanly bound at least one element; an unboundable
 * section is left as the original single provision with `needs_review`
 * set (and recoded to NOOTHERREPS only if that phrase class alone matched).
 */
function expandAntiRelianceElements(provisions) {
  if (!Array.isArray(provisions)) return provisions;
  const out = [];
  for (const p of provisions) {
    if (!p || !ANTI_RELIANCE_FAMILY_CODES.has(p.code)) {
      out.push(p);
      continue;
    }
    const text = String(p.text || '');
    if (!text.trim()) {
      out.push(p);
      continue;
    }

    const blocks = splitIntoSubclauseBlocks(text);
    const prefix = elementCodePrefix(p.code);

    // Group maximal consecutive runs of blocks that each match EXACTLY one
    // (the same) element type.
    const runs = []; // { element, blocks: [...] }
    let ambiguous = false;
    let anyNooOtherRepsSignal = false;
    let cur = null;
    for (const block of blocks) {
      const els = matchedElements(block.text);
      if (els.includes('NOOTHERREPS')) anyNooOtherRepsSignal = true;
      if (els.length !== 1) {
        ambiguous = true;
        if (cur) { runs.push(cur); cur = null; }
        continue;
      }
      const [el] = els;
      if (cur && cur.element === el) {
        cur.blocks.push(block);
      } else {
        if (cur) runs.push(cur);
        cur = { element: el, blocks: [block] };
      }
    }
    if (cur) runs.push(cur);

    // No heading structure at all (single whole-text block spanning 0..len)
    // is only usable when it matched exactly one element with no ambiguity
    // — otherwise it is unboundable by construction (a single block
    // spanning the whole section can never carry disjoint spans for
    // multiple elements).
    const cleanRuns = runs.filter((r) => r.blocks.length > 0);
    const unboundable = ambiguous || cleanRuns.length === 0;

    if (unboundable) {
      // Fail toward review, never toward a plausible-but-unproven element.
      // The pin is explicit: NOOTHERREPS ONLY when that phrase class itself
      // matched despite unboundable spans; otherwise keep the family-level
      // legacy code (still flagged for review).
      p.needs_review = true;
      if (anyNooOtherRepsSignal) {
        p.code = `${prefix}NOOTHERREPS`;
        const entry = CODES[p.code];
        if (entry && entry.label) p.category = entry.label;
      }
      out.push(p);
      continue;
    }

    // Cleanly boundable — replace the whole-section provision with one
    // element-scoped provision per run.
    for (const run of cleanRuns) {
      const code = `${prefix}${run.element}`;
      const entry = CODES[code];
      const first = run.blocks[0];
      const last = run.blocks[run.blocks.length - 1];
      const elText = text.slice(first.start, last.end).trim();
      if (!elText) continue;
      const elStartChar = typeof p.startChar === 'number' ? p.startChar + first.start : p.startChar;
      const newProv = makeProvision({
        type: p.type,
        code,
        category: (entry && entry.label) || p.category,
        text: elText,
        startChar: elStartChar,
        favorability: p.favorability || 'neutral',
        features: {
          ...(p.features || {}),
          mainConcept: elText.substring(0, 200),
          language: elText,
        },
        relatedDefinitions: p.relatedDefinitions || [],
      });
      out.push(newProv);
    }
  }
  return out;
}

// dealMeta: optional deal-level context threaded in by the caller (NOT
// derived by extract.js itself — it has no DB/network access). Currently
// only `signingDate` (ISO YYYY-MM-DD or any Date-parseable string, sourced
// from deals.announce_date / the agreement's own "dated as of" date) is
// read, by computeOutsideDateMonths (FB3 item 5). Absent/partial dealMeta is
// always safe — every consumer of it degrades to leaving its fields null.
async function extractProvisions(classifiedSections, client, fullCleanedText, dealMeta = {}, opts = {}) {
  // Optional stage checkpointing (lib/parser-v2/extraction-checkpoint.js):
  // each LLM-heavy stage's raw output is saved as it completes, and — when
  // the caller opted into resume — reloaded instead of re-calling the LLM.
  // Post-processing failures then cost a seconds-long rerun, not a full
  // re-extract. Stages run inside Promise.all, so a completed strategy's
  // output is persisted even when a sibling strategy fails the run.
  const checkpoint = opts.checkpoint || null;
  const stage = async (name, thunk) => {
    if (checkpoint) {
      const hit = checkpoint.load(name);
      if (hit !== null && hit !== undefined) return hit;
    }
    const result = await thunk();
    if (checkpoint) checkpoint.save(name, result);
    return result;
  };

  const transactionStepModel = extractTransactionSteps(classifiedSections, { fullCleanedText, dealMeta });

  // Route sections to the appropriate strategy
  const stratABucket = [];  // IOC, COND-*
  const stratBBucket = [];  // NOSOL, ANTI
  const stratCBucket = [];  // REP-*, STRUCT, CONSID, COV, TERMR, TERMF, MISC
  const stratDBucket = [];  // DEF

  for (const section of classifiedSections) {
    const type = section.provision_type;
    if (!type) continue;

    if (type === 'DEF') {
      stratDBucket.push(section);
    } else if (STRATEGY_A_TYPES.has(type)) {
      stratABucket.push(section);
    } else if (STRATEGY_B_TYPES.has(type)) {
      stratBBucket.push(section);
    } else if (STRATEGY_C_TYPES.has(type)) {
      stratCBucket.push(section);
    } else {
      // Unknown type — treat as Strategy C
      stratCBucket.push(section);
    }
  }

  // Run all strategies concurrently
  const [resultsA, resultsB, resultsC, resultsD] = await Promise.all([
    // `opts` is threaded into A and C because that is where the span-claims
    // hook lives (attachStrategySpanClaims). Without it the hook's own
    // `opts.spanClaims === true` gate was unreachable from ANY caller — the
    // option was accepted here and then dropped one frame later.
    stage('strategy-a', () => (stratABucket.length > 0 ? strategyA(stratABucket, client, opts) : [])),
    stage('strategy-b', () => (stratBBucket.length > 0 ? strategyB(stratBBucket, client, classifiedSections) : [])),
    stage('strategy-c', () => (stratCBucket.length > 0 ? strategyC(stratCBucket, client, opts) : [])),
    stage('strategy-d', () => (stratDBucket.length > 0 ? strategyD(stratDBucket, client) : [])),
  ]);

  const allProvisions = [
    ...resultsA,
    ...resultsB,
    ...resultsC,
    ...resultsD,
  ];

  // Inline-definitions pass: scan ALL classified sections (not just DEF) for
  // defined terms introduced in the middle of running prose. Adds new DEF
  // provisions for any terms not already captured by Strategy D.
  const inlineDefProvisions = await stage('inline-defs', () => extractInlineDefinitionsFromSections(
    classifiedSections,
    allProvisions,
    client,
    fullCleanedText,
  ));
  allProvisions.push(...inlineDefProvisions);

  // v1 reclassification (2026-08-02, R3 — relocated per audit A-C1): the
  // anti-reliance family element scan. Must run AFTER all strategies have
  // emitted their whole-section provisions (it operates on strategyC's
  // REP-B-ANTIRELIANCE / REP-B-NOREP / REP-T-NOREP output) and BEFORE
  // enforceCanonicalCodes (its retired-code remap must never see these
  // sections — the scan either replaces them with current-vocabulary
  // element codes or explicitly keeps the family code with needs_review).
  const expandedProvisions = await stage('anti-reliance-elements', () => expandAntiRelianceElements(allProvisions));
  allProvisions.length = 0;
  allProvisions.push(...expandedProvisions);

  // Post-processing: link definitions to provisions that reference them
  linkDefinitionCrossReferences(allProvisions);

  // Gap F: the per-rep `features.linkedBringDownStandard` stamp (formerly
  // written here by a linkBringDownToReps post-pass) is intentionally NOT
  // produced anymore. Its implicit MAT_MAE_QUALIFIED catch-all uniformly
  // mis-stamped reps (Metsera: 35/37 identical), while the AUTHORITATIVE
  // per-rep standard is the closing-condition bringDownTiers on
  // COND-B-REP / COND-S-REP — which the render already derives from
  // (buildRepBringDownMap in conditions.config.js and
  // computeBringDownStandardForRep in pages/review/[id].js). One source of
  // truth: the tiers. The feature key stays declared in lib/rubric.js
  // (MODEL_READONLY, so it never reaches prompts) because existing corpus
  // rows and the render-time derivation still carry/read it.

  // Post-processing: stamp the deal's "Knowledge" definition core onto
  // knowledge-qualified reps (deterministic; no AI calls).
  linkKnowledgeScopeToReps(allProvisions);

  // Post-processing (FB3 item 1): fold the LLM's clause-level
  // materialityScopeType onto features.materialityQualifier.scope.
  linkMaterialityScopeToReps(allProvisions);

  // Post-processing (FB3 item 2): normalize each IOC affirmative limb to a
  // SINGLE efforts_standard, deterministically derived from the limb's own
  // text — never trusting two independently-derived LLM fields to agree.
  normalizeIocLimbEffortsStandards(allProvisions);
  liftIncludedObligationsFromLimbText(allProvisions);

  // Post-processing (FB3 missed item 2): stamp restrictionComponents on
  // every IOC-T/IOC-B sub-clause by keyword-matching its own text — the
  // cross-deal comparability hook. Deterministic; no AI calls.
  stampIocRestrictionComponents(allProvisions);

  // Post-processing (FB3 item 6a): stamp the deal's "Willful Breach"
  // definition core onto the MISC provision(s) that reference it.
  linkWillfulBreachDefinition(allProvisions);

  // Post-processing (FB3 item 4c): stamp the deal's "Company Stockholder
  // Approval" definition core onto the stockholder-approval COND.
  linkStockholderApprovalDefinition(allProvisions);

  // Post-processing (FB3 item 4b): resolve bring-down rep cites / consents
  // cross-refs on COND provisions to provision names.
  resolveCondCitedProvisionNames(allProvisions);

  // Post-processing (FB3 item 5): pure date-math outside-date months, off
  // the deal's signing date (when supplied by the caller).
  computeOutsideDateMonths(allProvisions, dealMeta);

  // Post-processing: deterministic backstop for instruments the AI dropped
  // (Metsera RSAs) — every instrument NAMED in a CONSID-EQUITY section gets
  // an outstandingInstruments entry before the per-instrument expansion.
  backfillMissingInstrumentMentions(allProvisions);
  convertConsiderationEquityProvisions(allProvisions);

  // Post-processing: expand each CONSID-EQUITY provision with multiple
  // outstanding instruments into one row per instrument so the UI can
  // display Stock Options / RSUs / ESPP as separate provisions.
  expandConsidEquityByInstrument(allProvisions);

  // Post-processing: pull the CVR maximum payment from the attached Form of
  // CVR Agreement exhibit when the consideration section only references it.
  backfillCvrMaxFromExhibit(allProvisions, fullCleanedText);

  // Post-processing: if the Material Contracts rep only points to the
  // defined term, source the enumerated buckets from the DEF "Material
  // Contract(s)" provision.
  stampMaterialContractsBucketsFromDefinitions(allProvisions);

  // Post-processing: boundary-integrity repair. If the model stops a provision
  // inside a sentence/list item, extend it to the next legal boundary in the
  // same classified section before gap/leftover generation.
  allProvisions._boundaryRepairReport = repairProvisionTextBoundariesFromSections(classifiedSections, allProvisions);
  normalizeAntitrustRegulatoryFeatures(allProvisions);

  // Post-processing: 100% TEXT COVERAGE backfill. For each classified section,
  // compute the union of text covered by provisions extracted from it (we use
  // verbatim substring matching since char-offset tracking is approximate).
  // If significant text (>50 chars after whitespace normalization) is NOT
  // covered by any provision, emit a "SECTION-LEFTOVER" provision capturing
  // the uncovered slice so cross-deal matching never loses language.
  const leftoverReport = backfillSectionLeftovers(classifiedSections, allProvisions);
  allProvisions._coverageBackfillReport = leftoverReport;

  // Post-processing: sort DEF provisions alphabetically by their canonical
  // term (or category fallback) so the natural display order is alphabetical.
  sortDefinitionsAlphabetically(allProvisions);

  // Post-processing: enforce canonical codes — every provision should have
  // either a valid rubric code (with the canonical category label) or be
  // marked isNewCode with a proposed code. This is the cross-deal matching
  // foundation: equivalent provisions across deals must share the same code
  // and category string.
  const enforcementReport = await enforceCanonicalCodes(allProvisions, client);

  // Post-processing: auto-merge AI-proposed new codes against semantically
  // similar existing canonical codes for the same type. Codes that don't
  // semantically match anything remain as proposed new codes pending user
  // approval.
  const mergeReport = await consolidateProposedCodes(allProvisions, client);

  // Post-processing: resolve the Absence-of-Changes rep's cited covenant
  // sections to covenant NAMES using the deal's own IOC sub-clause provisions.
  // Runs AFTER canonical-code enforcement so categories are canonical labels.
  resolveAocCovenantCitations(allProvisions);

  // Stash the reports on the array (consumed by validate.js / API response).
  allProvisions._codeEnforcementReport = enforcementReport;
  allProvisions._codeMergeReport = mergeReport;
  allProvisions._transactionStepModel = transactionStepModel;

  // Clean up internal-only fields
  for (const p of allProvisions) {
    delete p._error;
  }

  return allProvisions;
}

// ---------------------------------------------------------------------------
// Canonical-code enforcement (Fix 1) and proposed-code consolidation (Fix 2)
// ---------------------------------------------------------------------------

/**
 * Normalize a string for loose-equality comparison: lowercase, collapse
 * whitespace, strip punctuation, strip common boilerplate suffixes ("clause",
 * "provision", "new", "additional").
 */
function normalizeForCodeMatch(s) {
  if (!s || typeof s !== 'string') return '';
  return s
    .toLowerCase()
    .replace(/[“”"’'`()\[\]{}.,;:!?\/\\&]/g, ' ')
    .replace(/\b(clause|provision|new|additional|other|misc|miscellaneous)\b/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * Stub for the future alias-growth system. When the parser auto-merges a
 * proposed code into an existing canonical code, we want to record the
 * proposed label as a learned alias for that canonical code so subsequent
 * ingests skip the AI consultation step. For now this just logs — wire it
 * up to real persistence (DB / rubric memory) later.
 */
function recordAliasFromAutoMerge(canonicalCode, alias) {
  if (!canonicalCode || !alias) return;
  console.log(
    `[recordAliasFromAutoMerge] alias-growth (stub): "${alias}" -> ${canonicalCode}. ` +
      'TODO: persist to rubric memory so future ingests auto-match without AI.',
  );
}

/**
 * Strict canonical-code enforcement pass.
 *
 * After all extraction strategies have produced provisions, walk the full
 * provisions array and guarantee invariants:
 *
 *   1. Every provision missing a `code` is either resolved via the alias index
 *      (findCodeByAlias on the AI's free-text category) or — if no match — sent
 *      to a small batched AI call that maps (type, category, text-preview) onto
 *      a canonical code from the type's code list (or proposes a new one).
 *   2. Every provision WITH a code has the code validated against rubric.CODES.
 *      Invalid codes are re-assigned via the same batched AI call.
 *   3. For every provision now bearing a valid code, the displayed category is
 *      REPLACED with the canonical rubric label (CODES[code].label). The
 *      original AI-extracted category is preserved as `sourceCategory` for
 *      traceability.
 *   4. Provisions that genuinely have no matching code remain `isNewCode: true`
 *      with a `proposedCode` and `proposedLabel`. Their displayed category
 *      becomes "[PROPOSED] " + proposed label so the UI immediately surfaces
 *      that they need human approval.
 *
 * Returns a small report consumed by validate.js / the API response.
 *
 * Skips OTHER provisions (backfilled orphans) and DEF preambles since those
 * are intentionally code-less.
 */
async function enforceCanonicalCodes(provisions, client) {
  const report = {
    enforcerAssigned: 0,
    aliasMatched: 0,
    aiAssigned: 0,
    invalidReassigned: 0,
    categoriesRewritten: 0,
    uncodedRemaining: 0,
    newCodesProposed: 0,
    // v1 reclassification (2026-08-02, retired-code enforcement — audit
    // A-C2): a retired code is a TYPED remap to its superseded_by target
    // when unambiguous (exactly one successor), else a TYPED rejection to
    // review (routed through the same AI-reassignment path as any other
    // invalid code — never silent acceptance of the retired code).
    retiredRemapped: 0,
    retiredAmbiguousToReview: 0,
    failures: [],
  };

  if (!Array.isArray(provisions) || provisions.length === 0) return report;

  // Helper: skip provisions for which a missing code is acceptable.
  const isExempt = (p) => {
    if (!p) return true;
    if (p.type === 'OTHER') return true; // backfilled orphan — no canonical code expected
    if (p.backfilled) return true;
    const cat = (p.category || '').toLowerCase();
    if (cat === 'general / preamble' || cat === 'preamble') return true;
    return false;
  };

  // 1) First pass: alias lookup + canonical category rewrite for existing
  //    valid codes. Collect the survivors that still need AI help.
  const needsAi = [];

  for (let idx = 0; idx < provisions.length; idx++) {
    const prov = provisions[idx];
    if (!prov) continue;

    if (isExempt(prov)) continue;

    // Deterministic guard: DEF-MAE-CLINICAL is ONLY for a clinical/FDA carve-out
    // clause inside the Material Adverse Effect definition. The classifier
    // over-applies it to standalone CVR/milestone defined terms (Initiate,
    // Clinical Trial Milestone, Combination FDA Approval, CVR Product, …) whose
    // names mention clinical/FDA concepts. If the text doesn't reference an MAE,
    // demote to DEF-GENERAL so these stop polluting the MAE Clinical bucket.
    if (prov.code === 'DEF-MAE-CLINICAL') {
      const txt = String(prov.full_text || prov.text || '');
      if (!/material\s+adverse\s+(effect|change)|\bMAE\b/i.test(txt)) {
        prov.code = 'DEF-GENERAL';
        const ge = CODES['DEF-GENERAL'];
        if (ge && ge.label) {
          prov.sourceCategory = prov.category;
          prov.category = ge.label;
        }
      }
    }

    const hasCode = prov.code && typeof prov.code === 'string' && prov.code.length > 0;

    // Retired-code enforcement (audit A-C2): a synthetic/legacy code that is
    // retired must never pass through unchanged. Checked BEFORE the general
    // isValidCode branch below — isValidCode is true for retired codes too
    // (they stay registered), so without this guard a retired code would
    // silently fall through the "already valid" fast path.
    // The anti-reliance element scan (expandAntiRelianceElements, run
    // earlier in extractProvisions) already made a typed, deliberate
    // decision for any section it left unboundable: keep the family-level
    // (retired) code with needs_review set, or recode to NOOTHERREPS. That
    // decision must not be re-litigated here as a generic "ambiguous
    // retired code" case — the element scan already IS the review routing.
    if (hasCode && isRetiredCode(prov.code) && ANTI_RELIANCE_FAMILY_CODES.has(prov.code) && prov.needs_review) {
      continue;
    }

    if (hasCode && isRetiredCode(prov.code)) {
      const successors = getSupersededBy(prov.code) || [];
      if (successors.length === 1) {
        const [target] = successors;
        prov.sourceCategory = prov.category || prov.sourceCategory;
        prov.retiredCodeRemappedFrom = prov.code;
        prov.code = target;
        const codeEntry = CODES[target];
        if (codeEntry && codeEntry.label) prov.category = codeEntry.label;
        report.retiredRemapped++;
        continue;
      }
      // Ambiguous (0 or >1 successors) — typed rejection to review, never
      // silent acceptance of the retired code. Route through the same AI
      // reassignment path as any other invalid code; buildCodesList already
      // excludes retired codes from the vocabulary it sees.
      prov.retiredCodeFlag = prov.code;
      prov.code = null;
      report.retiredAmbiguousToReview++;
      needsAi.push({ idx, prov, reason: 'retired-code-ambiguous' });
      continue;
    }

    if (hasCode) {
      if (isValidCode(prov.code)) {
        const codeEntry = CODES[prov.code];
        if (codeEntry && codeEntry.label) {
          if (prov.category && prov.category !== codeEntry.label) {
            prov.sourceCategory = prov.category;
            prov.category = codeEntry.label;
            report.categoriesRewritten++;
          } else if (!prov.category) {
            prov.category = codeEntry.label;
          }
        }
        continue;
      }

      // Invalid code — needs reassignment.
      needsAi.push({ idx, prov, reason: 'invalid-code' });
      continue;
    }

    // No code. If the AI marked it as a new code with a proposed code, leave
    // it for consolidateProposedCodes to handle.
    if (prov.isNewCode && prov.proposedCode) {
      const proposedLabel = prov.proposedLabel || prov.category || prov.proposedCode;
      if (!prov.sourceCategory && prov.category) prov.sourceCategory = prov.category;
      prov.category = `[PROPOSED] ${proposedLabel}`;
      report.newCodesProposed++;
      continue;
    }

    // Try alias lookup against the AI's free-text category first.
    if (prov.category) {
      const matched = findCodeByAlias(prov.category);
      if (matched && isValidCode(matched)) {
        const codeEntry = CODES[matched];
        prov.code = matched;
        prov.sourceCategory = prov.category;
        prov.category = codeEntry.label;
        prov.codeAssignedBy = 'enforcer';
        report.aliasMatched++;
        report.enforcerAssigned++;
        report.categoriesRewritten++;
        continue;
      }
    }

    // No alias match — send to AI for canonical assignment.
    needsAi.push({ idx, prov, reason: 'missing-code' });
  }

  // 2) Batched AI call(s) for the survivors. Group by type so we can give
  //    the model only the relevant code list per call.
  if (needsAi.length > 0 && client) {
    const byType = new Map();
    for (const item of needsAi) {
      const tk = item.prov.type || 'OTHER';
      if (!byType.has(tk)) byType.set(tk, []);
      byType.get(tk).push(item);
    }

    const tasks = [];
    for (const [typeKey, items] of byType.entries()) {
      tasks.push(async () => {
        let codesList;
        try {
          codesList = buildCodesList(typeKey);
        } catch {
          codesList = '';
        }
        if (!codesList) {
          for (const { prov } of items) {
            const proposedLabel = prov.category || 'Uncategorized Provision';
            const proposedCode = `${typeKey || 'OTHER'}-${normalizeForCodeMatch(proposedLabel)
              .toUpperCase()
              .replace(/\s+/g, '-')
              .replace(/[^A-Z0-9-]/g, '')
              .substring(0, 32) || 'NEW'}`;
            prov.isNewCode = true;
            prov.proposedCode = proposedCode;
            prov.proposedLabel = proposedLabel;
            if (!prov.sourceCategory && prov.category) prov.sourceCategory = prov.category;
            prov.category = `[PROPOSED] ${proposedLabel}`;
            prov.codeAssignedBy = 'enforcer';
            report.newCodesProposed++;
          }
          return;
        }

        const payload = items.map(({ prov }, i) => ({
          idx: i,
          type: prov.type || typeKey,
          category: prov.category || null,
          sourceCategory: prov.sourceCategory || null,
          invalidCode: prov.code || null,
          textPreview: (prov.text || '').substring(0, 600),
        }));

        const prompt = `You are a senior M&A attorney maintaining a canonical rubric of merger-agreement provisions. The provisions below are missing a canonical rubric code (or have an invalid one). For EACH one, return the single best matching canonical code from the list below, OR mark it as a genuinely new code with a proposed code/label.

PROVISION TYPE: ${typeKey} — ${getTypeLabel(typeKey) || typeKey}

VALID CANONICAL CODES for ${typeKey}:
${codesList}

PROVISIONS TO MAP:
${JSON.stringify(payload, null, 2)}

Rules:
- Prefer an existing canonical code whenever a match is reasonable. Look at category text, source category, and textPreview together.
- Only set "isNewCode": true if NO existing code is a reasonable semantic match.
- proposedCode format: "${typeKey}-NEWNAME" (uppercase, dash-separated). proposedLabel is a short human-readable name.

Return ONLY valid JSON (no markdown, no backticks):
{
  "results": [
    {
      "idx": 0,
      "code": "${typeKey}-EXAMPLE",
      "isNewCode": false,
      "proposedCode": null,
      "proposedLabel": null
    }
  ]
}`;

        try {
          const resp = await client.messages.create({
            model: MODEL,
            max_tokens: 10000,
            messages: [{ role: 'user', content: prompt }],
          });
          const raw = resp.content.map((c) => c.text || '').join('');
          const parsed = parseJSON(raw);
          const resultMap = {};
          for (const r of (parsed.results || [])) resultMap[r.idx] = r;

          for (let i = 0; i < items.length; i++) {
            const { prov, reason } = items[i];
            const r = resultMap[i] || {};
            const wasInvalid = reason === 'invalid-code';

            if (r.code && isValidCode(r.code)) {
              const codeEntry = CODES[r.code];
              if (wasInvalid) report.invalidReassigned++;
              if (!prov.sourceCategory && prov.category) prov.sourceCategory = prov.category;
              prov.code = r.code;
              prov.category = codeEntry.label;
              prov.isNewCode = false;
              prov.proposedCode = null;
              prov.proposedLabel = null;
              prov.codeAssignedBy = 'enforcer';
              report.aiAssigned++;
              report.enforcerAssigned++;
              report.categoriesRewritten++;
            } else if (r.isNewCode && r.proposedCode) {
              const proposedLabel = r.proposedLabel || prov.category || r.proposedCode;
              if (!prov.sourceCategory && prov.category) prov.sourceCategory = prov.category;
              prov.code = null;
              prov.isNewCode = true;
              prov.proposedCode = r.proposedCode;
              prov.proposedLabel = proposedLabel;
              prov.category = `[PROPOSED] ${proposedLabel}`;
              prov.codeAssignedBy = 'enforcer';
              report.newCodesProposed++;
            } else {
              report.failures.push({
                type: prov.type,
                category: prov.category,
                reason: 'ai-returned-no-mapping',
              });
            }
          }
        } catch (err) {
          report.failures.push({
            type: typeKey,
            reason: `ai-call-failed: ${err.message}`,
            count: items.length,
          });
        }
      });
    }

    await runWithConcurrency(tasks, MAX_CONCURRENT);
  }

  // 3) Final tally — count anything still uncoded (and not a proposed new code).
  for (const prov of provisions) {
    if (!prov || isExempt(prov)) continue;
    const hasValidCode = prov.code && isValidCode(prov.code);
    const isProposed = prov.isNewCode && prov.proposedCode;
    if (!hasValidCode && !isProposed) report.uncodedRemaining++;
  }

  return report;
}

/**
 * Auto-merge AI-proposed new codes against semantically similar existing
 * canonical codes for the same type, so the rubric doesn't grow with
 * near-duplicate codes like "IOC-DEBT-NEW" sitting alongside "IOC-DEBT".
 */
async function consolidateProposedCodes(provisions, client) {
  const report = {
    autoMerged: [],
    pendingNew: [],
    failures: [],
  };

  if (!Array.isArray(provisions) || provisions.length === 0) return report;

  // 1. Group proposed-new provisions by (type, proposedCode).
  const groups = new Map();
  for (const prov of provisions) {
    if (!prov || !prov.isNewCode || !prov.proposedCode) continue;
    const type = prov.type || 'OTHER';
    const key = `${type}::${prov.proposedCode}`;
    if (!groups.has(key)) {
      groups.set(key, {
        type,
        proposedCode: prov.proposedCode,
        proposedLabel: prov.proposedLabel || prov.category || prov.proposedCode,
        items: [],
      });
    }
    groups.get(key).items.push(prov);
  }

  if (groups.size === 0) return report;

  const canonicalIndexByType = new Map();
  const getIndex = (typeKey) => {
    if (canonicalIndexByType.has(typeKey)) return canonicalIndexByType.get(typeKey);
    const idx = new Map();
    let typeCodes = [];
    try {
      typeCodes = getCodesForType(typeKey);
    } catch {
      typeCodes = [];
    }
    for (const c of typeCodes) {
      const labelNorm = normalizeForCodeMatch(c.label || '');
      if (labelNorm) idx.set(labelNorm, c.code);
      for (const alias of (c.aliases || [])) {
        const aNorm = normalizeForCodeMatch(alias);
        if (aNorm) idx.set(aNorm, c.code);
      }
      const codeNorm = normalizeForCodeMatch(c.code);
      if (codeNorm) idx.set(codeNorm, c.code);
    }
    canonicalIndexByType.set(typeKey, idx);
    return idx;
  };

  const applyMerge = (group, canonicalCode) => {
    const codeEntry = CODES[canonicalCode];
    if (!codeEntry) return false;
    for (const prov of group.items) {
      if (!prov.sourceCategory && prov.category) prov.sourceCategory = prov.category;
      prov.autoMergedFrom = group.proposedCode;
      prov.code = canonicalCode;
      prov.category = codeEntry.label;
      prov.isNewCode = false;
      prov.proposedCode = null;
      prov.proposedLabel = null;
    }
    recordAliasFromAutoMerge(canonicalCode, group.proposedLabel);
    report.autoMerged.push({
      proposedCode: group.proposedCode,
      proposedLabel: group.proposedLabel,
      canonicalCode,
      canonicalLabel: codeEntry.label,
      count: group.items.length,
    });
    return true;
  };

  const survivors = [];
  for (const group of groups.values()) {
    const idx = getIndex(group.type);
    if (idx.size === 0) {
      survivors.push(group);
      continue;
    }

    const candidates = [
      normalizeForCodeMatch(group.proposedCode),
      normalizeForCodeMatch(group.proposedLabel),
    ].filter(Boolean);

    let merged = false;
    for (const cand of candidates) {
      if (idx.has(cand)) {
        merged = applyMerge(group, idx.get(cand));
        if (merged) break;
      }
    }

    if (!merged) {
      const strippedCode = group.proposedCode
        .replace(/-NEW(-?\d*)$/i, '')
        .replace(/-NEW-?/i, '-');
      if (strippedCode && strippedCode !== group.proposedCode && isValidCode(strippedCode)) {
        const candidateEntry = CODES[strippedCode];
        if (candidateEntry && candidateEntry.type === group.type) {
          merged = applyMerge(group, strippedCode);
        }
      }
    }

    if (!merged) survivors.push(group);
  }

  // 3. AI call for the survivors. One call per type.
  if (survivors.length > 0 && client) {
    const byType = new Map();
    for (const g of survivors) {
      if (!byType.has(g.type)) byType.set(g.type, []);
      byType.get(g.type).push(g);
    }

    const tasks = [];
    for (const [typeKey, groupsForType] of byType.entries()) {
      tasks.push(async () => {
        let typeCodes;
        try {
          typeCodes = getCodesForType(typeKey);
        } catch {
          typeCodes = [];
        }

        if (!typeCodes || typeCodes.length === 0) {
          for (const g of groupsForType) {
            report.pendingNew.push({
              proposedCode: g.proposedCode,
              proposedLabel: g.proposedLabel,
              count: g.items.length,
            });
          }
          return;
        }

        const candidateList = typeCodes
          .map((c) => `  ${c.code}: "${c.label}" — ${c.description || ''}`)
          .join('\n');

        const proposalsPayload = groupsForType.map((g, i) => {
          const sample = g.items[0] || {};
          const mainConcept = (sample.features && sample.features.mainConcept) || null;
          return {
            idx: i,
            proposedCode: g.proposedCode,
            proposedLabel: g.proposedLabel,
            mainConcept,
            textPreview: (sample.text || '').substring(0, 500),
          };
        });

        const prompt = `You are a senior M&A attorney curating a canonical rubric of merger-agreement provisions. For each proposed NEW code below, decide whether an existing canonical code in the SAME provision type semantically covers the same concept. If yes, return the existing canonical code. If the proposed code is genuinely new, return null for "matchedCode".

PROVISION TYPE: ${typeKey} — ${getTypeLabel(typeKey) || typeKey}

EXISTING CANONICAL CODES for ${typeKey}:
${candidateList}

PROPOSED NEW CODES TO REVIEW:
${JSON.stringify(proposalsPayload, null, 2)}

Rules:
- Prefer merging into an existing canonical code whenever it semantically covers the same concept (read the proposed label, mainConcept, and textPreview together).
- Only return null (genuinely new) when no existing code is a reasonable match.

Return ONLY valid JSON (no markdown, no backticks):
{
  "results": [
    { "idx": 0, "matchedCode": "IOC-DEBT" }
  ]
}`;

        try {
          const resp = await client.messages.create({
            model: MODEL,
            max_tokens: 8000,
            messages: [{ role: 'user', content: prompt }],
          });
          const raw = resp.content.map((c) => c.text || '').join('');
          const parsed = parseJSON(raw);
          const resultMap = {};
          for (const r of (parsed.results || [])) resultMap[r.idx] = r;

          for (let i = 0; i < groupsForType.length; i++) {
            const g = groupsForType[i];
            const r = resultMap[i] || {};
            const matched = r.matchedCode && isValidCode(r.matchedCode) ? r.matchedCode : null;
            if (matched) {
              const matchedEntry = CODES[matched];
              if (matchedEntry && matchedEntry.type === g.type) {
                applyMerge(g, matched);
                continue;
              }
            }
            report.pendingNew.push({
              proposedCode: g.proposedCode,
              proposedLabel: g.proposedLabel,
              count: g.items.length,
            });
          }
        } catch (err) {
          report.failures.push({
            type: typeKey,
            reason: `ai-call-failed: ${err.message}`,
            count: groupsForType.length,
          });
          for (const g of groupsForType) {
            report.pendingNew.push({
              proposedCode: g.proposedCode,
              proposedLabel: g.proposedLabel,
              count: g.items.length,
            });
          }
        }
      });
    }

    await runWithConcurrency(tasks, MAX_CONCURRENT);
  } else {
    for (const g of survivors) {
      report.pendingNew.push({
        proposedCode: g.proposedCode,
        proposedLabel: g.proposedLabel,
        count: g.items.length,
      });
    }
  }

  return report;
}

// ---------------------------------------------------------------------------
// Inline definitions pass — augment Strategy D
// ---------------------------------------------------------------------------

/**
 * Scan every classified section's text for inline definitions, dedupe against
 * the DEF provisions Strategy D already produced, and AI-classify the
 * survivors into new DEF provisions.
 *
 * Deduplication: if a term (case-insensitive, normalized) is already covered
 * by an existing DEF provision — either by canonical code, by features.canonicalTerm,
 * or by appearing inside the existing DEF provision's text — the inline hit is
 * SKIPPED. (The user wants both kept in principle, but in practice when the
 * Definitions section already contains the term, the inline mention is the
 * SAME definition restated — we don't want noisy duplicates. Cross-references
 * are still linked via the alias system in rubric.js.)
 */
async function extractInlineDefinitionsFromSections(classifiedSections, existingProvisions, client, fullCleanedText) {
  // Build a set of already-known defined terms (lowercased).
  const knownTerms = new Set();
  for (const p of existingProvisions) {
    if (p.type !== 'DEF') continue;
    const ct = p.features && p.features.canonicalTerm;
    if (ct && typeof ct === 'string') knownTerms.add(ct.trim().toLowerCase());
    if (p.category && p.category !== 'General / Preamble') {
      knownTerms.add(p.category.trim().toLowerCase());
    }
    if (p.code) {
      const entry = CODES[p.code];
      if (entry && entry.label) knownTerms.add(entry.label.toLowerCase());
      if (entry && entry.aliases) {
        for (const a of entry.aliases) knownTerms.add(a.toLowerCase());
      }
    }
  }

  // Collect inline-definition hits from every NON-DEF classified section
  // (DEF sections are already handled by Strategy D).
  const hits = [];
  // Also build a joined "full body" view so anchors that straddle section
  // boundaries (e.g. a "For purposes of this Agreement:" header in one
  // section followed by definitions in the next) are picked up. We track
  // section ranges so each full-body hit can be attributed to the right
  // source section without losing startChar fidelity for the per-section
  // hits.
  let fullBody = '';
  const sectionRanges = []; // [{start, end, section}]
  for (const section of classifiedSections) {
    if (!section || !section.text) continue;
    if (section.provision_type === 'DEF') continue;
    const start = fullBody.length;
    fullBody += section.text + '\n\n';
    sectionRanges.push({ start, end: fullBody.length, section });

    const inlineHits = findInlineDefinitions(section.text);
    for (const h of inlineHits) {
      const termLc = h.term.toLowerCase();
      if (knownTerms.has(termLc)) continue;
      // Also skip generic noise (party labels, single common words)
      if (/^(parent|company|buyer|seller|merger sub|target|purchaser)$/i.test(h.term)) {
        // Party labels — capture them lightly, but most agreements already
        // catalog these via Strategy D preamble. Skip to keep noise low.
        continue;
      }
      hits.push({
        term: h.term,
        text: h.text,
        startChar: (section.startChar || 0) + h.startCharOffset,
        sourceSection: section.title || section.heading || section.category || section.number || null,
        sourceSectionNumber: section.number || null,
        sourceProvisionType: section.provision_type || null,
        matchedPattern: h.matchedPattern,
      });
      knownTerms.add(termLc); // dedupe within this pass
    }
  }

  // Second pass: run findInlineDefinitions on the joined body so we pick up
  // anchors that the per-section pass missed (definitions whose anchor is in
  // a preceding section's tail, or terms whose Title-Case prefix is split
  // across section boundaries by cleanText). For each full-body hit, find
  // which section it actually came from via the sectionRanges map.
  if (fullBody.length > 0) {
    const fullHits = findInlineDefinitions(fullBody);
    for (const h of fullHits) {
      const termLc = h.term.toLowerCase();
      if (knownTerms.has(termLc)) continue;
      if (/^(parent|company|buyer|seller|merger sub|target|purchaser)$/i.test(h.term)) continue;
      // Resolve source section by startCharOffset against sectionRanges.
      const range = sectionRanges.find((r) => h.startCharOffset >= r.start && h.startCharOffset < r.end);
      const sec = range ? range.section : null;
      const localOffset = range ? h.startCharOffset - range.start : 0;
      hits.push({
        term: h.term,
        text: h.text,
        startChar: sec ? (sec.startChar || 0) + localOffset : h.startCharOffset,
        sourceSection: sec ? (sec.title || sec.heading || sec.category || sec.number || null) : null,
        sourceSectionNumber: sec ? sec.number : null,
        sourceProvisionType: sec ? sec.provision_type : null,
        matchedPattern: h.matchedPattern,
      });
      knownTerms.add(termLc);
    }
  }

  // Third pass: scan the FULL cleaned text (preamble, exhibits, signature
  // blocks, CVR Agreement attachments, etc.) for definitions that live
  // OUTSIDE any classified section. Newer EDGAR exhibits often append a CVR
  // Agreement or similar attachment with its own definitions section that
  // the structural parser doesn't capture as a body section. Without this
  // pass, those defs are lost entirely.
  if (typeof fullCleanedText === 'string' && fullCleanedText.length > 0) {
    const extraHits = findInlineDefinitions(fullCleanedText);
    for (const h of extraHits) {
      const termLc = h.term.toLowerCase();
      if (knownTerms.has(termLc)) continue;
      if (/^(parent|company|buyer|seller|merger sub|target|purchaser)$/i.test(h.term)) continue;
      hits.push({
        term: h.term,
        text: h.text,
        startChar: h.startCharOffset,
        sourceSection: 'Attachment / Exhibit',
        sourceSectionNumber: null,
        sourceProvisionType: null,
        matchedPattern: h.matchedPattern,
      });
      knownTerms.add(termLc);
    }
  }

  if (hits.length === 0) return [];

  // AI-classify the inline definitions in batches via the same DEF prompt.
  const codesList = buildCodesList('DEF');
  const featureInstructions = buildFeatureInstructions('DEF');

  const defPayload = hits.map((h, idx) => {
    // MAE-flavoured definitions enumerate 5-15 carve-outs AFTER the core
    // definition, so a 2000-char cap chops them off entirely (the Landos
    // "carveouts: 0" bug — its MAE definition lives in Exhibit A and came
    // through this inline pass). Give those a much larger budget so the
    // carve-out list reaches the model.
    const isMae = /material\s+adverse\s+(?:effect|change)/i.test(h.term || '');
    const cap = isMae ? 12000 : 2000;
    return {
      idx,
      term: h.term,
      sourceSection: h.sourceSection,
      text: h.text.length > cap ? h.text.substring(0, cap) : h.text,
    };
  });

  const prompt = `You are a senior M&A attorney. The defined terms below were extracted from the BODY of a merger agreement (not the Definitions section) — they are defined inline in the middle of other provisions. Classify each into the best matching canonical DEF code and extract STRUCTURED features.

VALID DEF CODES:
${codesList}

INLINE DEFINITIONS TO CLASSIFY:
${JSON.stringify(defPayload, null, 2)}
${featureInstructions}
For each definition:
1. Pick the best matching canonical DEF code (or set "isNewCode": true and propose one in the format "DEF-NEWNAME").
2. POPULATE the "features" object — including "canonicalTerm" (the quoted defined term) and "definitionText".
3. Assess favorability from the buyer's perspective.

CRITICAL — "Material Adverse Effect" / "Company Material Adverse Effect" definitions (code DEF-MAE): you MUST populate the "carveouts" array (lowercase) with EVERY enumerated exception in the definition — the clauses introduced by "shall not include / does not include / other than / except" and listed as (a), (b), (c), (i), (ii) … (general economic / market / industry conditions, changes in Law or GAAP, war / terrorism, pandemics, the announcement itself, failure to meet projections, changes in stock price, acts taken at Parent's request, etc.). Each carve-out is a tagged object { code, label, text } drawn from MAE_CARVEOUT_CODES (use "OTHER" when no listed code fits), with "text" the verbatim clause. Real MAE definitions list 5-15 carve-outs — returning an EMPTY carveouts array for an MAE definition is an ERROR. Also set "disproportionateImpactCarveouts" (the subset subject to the "except to the extent disproportionately affected" carveback).

Return ONLY valid JSON (no markdown, no backticks):
{
  "results": [
    {
      "idx": 0,
      "code": "DEF-ACQPROPOSAL",
      "category": "Acquisition Proposal",
      "favorability": "neutral",
      "features": { /* schema fields populated */ },
      "isNewCode": false,
      "proposedCode": null,
      "proposedLabel": null
    }
  ]
}`;

  let resultMap = {};
  try {
    const resp = await client.messages.create({
      model: MODEL,
      max_tokens: 8000,
      messages: [{ role: 'user', content: prompt }],
    });
    const raw = resp.content.map((c) => c.text || '').join('');
    const parsed = parseJSON(raw);
    for (const r of (parsed.results || [])) {
      resultMap[r.idx] = r;
    }
  } catch {
    // Fallback below — best-effort
  }

  const provisions = [];
  for (let i = 0; i < hits.length; i++) {
    const h = hits[i];
    const aiResult = resultMap[i] || {};
    const code = aiResult.code || null;
    const codeEntry = code ? CODES[code] : null;

    // Attach source-section info into features so downstream UI can show
    // where the inline definition came from.
    const features = aiResult.features || {};
    features.sourceSection = h.sourceSection;
    features.sourceSectionType = h.sourceProvisionType;
    features.inlineDefinition = true;
    // Item 24: always pin the regex-captured term — never let the AI rename.
    features.canonicalTerm = h.term;

    provisions.push(makeProvision({
      type: 'DEF',
      code: isValidCode(code) ? code : null,
      category: codeEntry ? codeEntry.label : (aiResult.category || h.term),
      text: h.text,
      startChar: h.startChar,
      favorability: aiResult.favorability || 'neutral',
      features,
      relatedDefinitions: findRelatedDefinitions(h.text),
      isNewCode: aiResult.isNewCode || false,
      proposedCode: aiResult.proposedCode || null,
      proposedLabel: aiResult.proposedLabel || null,
    }));
  }

  // DEDICATED MAE CARVE-OUT PASS. The bulk classify call above stays terse with
  // 100+ definitions and routinely returns an empty carveouts[] for the MAE
  // definition even when instructed. For any DEF-MAE provision whose carveouts
  // didn't populate, run a focused single-definition extraction (one AI call
  // per MAE definition) so the carve-out list / disproportionate-impact set are
  // structured — matching what strategyD produces for classified DEF sections.
  const maeProvs = provisions.filter((p) => {
    const f = (p && p.features) || {};
    // Match by code OR by the regex-pinned canonicalTerm: at this point in the
    // pipeline the inline classifier may not have emitted DEF-MAE yet (codes
    // are only finalized later by enforceCanonicalCodes), but canonicalTerm is
    // always pinned to the captured term, so an MAE definition is detectable by
    // its term even when its code is still null. Parent-MAE (no enumerated list)
    // is matched too — the focused call simply returns an empty list for it.
    const term = String(f.canonicalTerm || '').toLowerCase();
    const isMae =
      p.code === 'DEF-MAE' ||
      /material adverse (effect|change)/.test(term);
    if (!isMae) return false;
    const cv = f.carveouts;
    return !(Array.isArray(cv) && cv.length > 0);
  });
  console.warn(`[extract] MAE carve-out pass: ${maeProvs.length} MAE def(s) need carveouts`);
  const maeCarveoutCodeList = Object.entries(MAE_CARVEOUT_CODES)
    .map(([code, entry]) => `  - ${code}: ${typeof entry === 'string' ? entry : (entry && entry.label) || code}`)
    .join('\n');
  for (const mp of maeProvs) {
    try {
      const maePrompt = `You are a senior M&A attorney. Below is a "Material Adverse Effect" definition from a merger agreement. Extract its STRUCTURED carve-outs.

The definition has a carve-out list — clauses introduced by "provided that no Effect arising out of or resulting from any of the following" and enumerated (a), (b), (c) … (or (i), (ii) …). List EVERY enumerated clause as its own carve-out. A "Parent Material Adverse Effect" framed only as the ability to consummate the transaction (no enumerated list) legitimately has zero carve-outs — return an empty array in that case only.

Each carve-out is a tagged object { "code": "<CODE>", "label": "<short human label>", "text": "<verbatim clause text>" } where <CODE> is the closest match from this list (use "OTHER" if none fits):
${maeCarveoutCodeList}

"disproportionateImpactCarveouts" lists the CODES of the subset of carve-outs that are subject to a "except to the extent it disproportionately affects the Company relative to others in the industry" carve-back.

MAE DEFINITION:
${mp.text}

Return ONLY valid JSON (no markdown), exactly this shape:
{ "features": { "carveouts": [ { "code": "ECONOMY_GENERAL", "label": "General economic conditions", "text": "general changes ... in the economy generally" } ], "disproportionateImpactCarveouts": ["ECONOMY_GENERAL"] } }`;
      const r = await client.messages.create({ model: MODEL, max_tokens: 6000, messages: [{ role: 'user', content: maePrompt }] });
      const parsed = parseJSON(r.content.map((c) => c.text || '').join('')) || {};
      // Be robust to response shape: the model sometimes returns the arrays at
      // the top level instead of nested under "features".
      const feats = (parsed.features && typeof parsed.features === 'object') ? parsed.features : parsed;
      const cv = feats.carveouts;
      const dp = feats.disproportionateImpactCarveouts;
      console.warn(`[extract] MAE pass "${(mp.features && mp.features.canonicalTerm) || mp.category}": textLen=${(mp.text||'').length} → carveouts=${Array.isArray(cv) ? cv.length : 'none'}`);
      if (Array.isArray(cv) && cv.length > 0) {
        mp.features = { ...mp.features, carveouts: cv };
        if (Array.isArray(dp)) {
          mp.features.disproportionateImpactCarveouts = dp;
        }
      }
    } catch (err) {
      console.warn('[extract] MAE carve-out pass failed:', err.message);
    }
  }

  return provisions;
}

// ---------------------------------------------------------------------------
// Post-processing: definition cross-reference linking
// ---------------------------------------------------------------------------

/**
 * For each non-DEF provision, find defined terms it references and add
 * them to relatedDefinitions. For DEF provisions, identify which provision
 * types they relate to (e.g., DEF-SUPERIOR → NOSOL provisions).
 */
function linkDefinitionCrossReferences(provisions) {
  // Build a lookup of DEF provisions by code
  const defByCode = {};
  for (const p of provisions) {
    if (p.type === 'DEF' && p.code) {
      defByCode[p.code] = p;
    }
  }

  // Known relationships: certain DEF codes relate to specific provision types
  const DEF_RELATED_TYPES = {
    'DEF-MAE': ['COND-B-MAE'],
    'DEF-MAE-CARVEOUT': ['COND-B-MAE', 'DEF-MAE'],
    'DEF-MAE-DISPROP': ['COND-B-MAE', 'DEF-MAE', 'DEF-MAE-CARVEOUT'],
    'DEF-SUPERIOR': ['NOSOL-SUPERIOR', 'NOSOL-EXCEPT', 'TERMR-SUPERIOR'],
    'DEF-ACQPROPOSAL': ['NOSOL-ACQPROPOSAL', 'NOSOL-PROHIBIT'],
    'DEF-INTERVENING': ['NOSOL-INTERVENING'],
    'DEF-KNOWLEDGE': ['REP-T-NOCHANGE', 'REP-T-LIT', 'REP-T-COMPLY'],
    'DEF-ORDINARY': ['IOC-ORDINARY'],
    'DEF-BURDENSOME': ['ANTI-BURDEN'],
    'DEF-WILLFUL': ['TERMF-SOLE', 'TERMF-EFFECT'],
  };

  // Enrich DEF provisions with known related codes
  for (const p of provisions) {
    if (p.type === 'DEF' && p.code && DEF_RELATED_TYPES[p.code]) {
      for (const rc of DEF_RELATED_TYPES[p.code]) {
        if (!p.relatedDefinitions.includes(rc)) {
          p.relatedDefinitions.push(rc);
        }
      }
    }
  }

  // For non-DEF provisions, look for defined terms in their text
  const defLabels = {};
  for (const [code, entry] of Object.entries(CODES)) {
    if (entry.type === 'DEF') {
      defLabels[entry.label.toLowerCase()] = code;
      for (const alias of (entry.aliases || [])) {
        defLabels[alias.toLowerCase()] = code;
      }
    }
  }

  for (const p of provisions) {
    if (p.type === 'DEF') continue;
    const textLower = p.text.toLowerCase();

    // Check for quoted defined terms
    const quotedPattern = /[“"]([^”"]+)[”"]/g;
    let qm;
    while ((qm = quotedPattern.exec(p.text)) !== null) {
      const term = normalizeTerm(qm[1]).toLowerCase();
      const matchedCode = defLabels[term];
      if (matchedCode && !p.relatedDefinitions.includes(matchedCode)) {
        p.relatedDefinitions.push(matchedCode);
      }
    }

    // Check for well-known term references (capitalized, even without quotes)
    const wellKnownTerms = [
      'Material Adverse Effect', 'Material Adverse Change',
      'Superior Proposal', 'Acquisition Proposal',
      'Intervening Event', 'Willful Breach',
      'Burdensome Condition', 'Company Adverse Recommendation Change',
    ];
    for (const term of wellKnownTerms) {
      if (p.text.includes(term)) {
        const matchedCode = defLabels[term.toLowerCase()];
        if (matchedCode && !p.relatedDefinitions.includes(matchedCode)) {
          p.relatedDefinitions.push(matchedCode);
        }
      }
    }
  }
}

// ---------------------------------------------------------------------------
// Post-processing: Absence-of-Changes covenant-cite resolution (deterministic)
// ---------------------------------------------------------------------------

/**
 * Normalize a section cite ("Section 5.01(a)", "5.1(A)") to a canonical key
 * ("5.1(a)") so cites match across zero-padding / case variants.
 */
function normalizeSectionCite(raw) {
  if (!raw || typeof raw !== 'string') return null;
  const m = raw.match(/(\d+)\.(\d+)\s*((?:\(\s*[A-Za-z0-9]+\s*\))*)/);
  if (!m) return null;
  const major = parseInt(m[1], 10);
  const minor = parseInt(m[2], 10);
  if (Number.isNaN(major) || Number.isNaN(minor)) return null;
  const subs = (m[3].match(/\(\s*([A-Za-z0-9]+)\s*\)/g) || [])
    .map((s) => `(${s.replace(/[()\s]/g, '').toLowerCase()})`)
    .join('');
  return `${major}.${minor}${subs}`;
}

/**
 * The AoC rep's ordinary-course limb typically carves out "actions taken in
 * respect of Sections 5.01(a) through (r)". The extractor records the cited
 * section numbers verbatim (aocCitedCovenantSections); this pass resolves
 * each cite — expanding "(a) through (r)" ranges — against the deal's OWN
 * already-classified covenant sub-clause provisions (IOC sub-clauses carry
 * features.sectionNumber like "5.01(a)" and a canonical category like
 * "Dispositions of Assets"). A lawyer reading the reps table must see the
 * covenant NAMES, not bare cites.
 *
 * Writes features.aocCitedCovenantNames = [{ section, name }]. `name` is null
 * when the cite can't be resolved — the number alone is kept; a name is NEVER
 * invented. Fully deterministic; no AI calls.
 */
const SECTION_CITE_LETTERS = 'abcdefghijklmnopqrstuvwxyz';

/**
 * Cite → { name, isPreferred } lookup built from every provision that
 * carries a section number (features.sectionNumber) and a canonical
 * category. Shared by resolveAocCovenantCitations (IOC-preferred) and
 * resolveCondCitedProvisionNames (REP-preferred) — FB3 item 4(b) reuses this
 * exact index-building rather than duplicating it.
 *
 * `preferTypePrefix` — when two provisions claim the same cite, the one
 * whose `type` starts with this prefix wins (mirrors the original
 * IOC-sub-clauses-win-over-other-types rule in resolveAocCovenantCitations).
 */
function buildSectionCiteIndex(provisions, preferTypePrefix) {
  const nameByCite = new Map();
  if (!Array.isArray(provisions)) return nameByCite;
  for (const p of provisions) {
    if (!p || !p.features || !p.features.sectionNumber) continue;
    const key = normalizeSectionCite(String(p.features.sectionNumber));
    if (!key) continue;
    const name = p.category && p.category !== 'Unclassified' ? p.category : null;
    if (!name) continue;
    const isPreferred = !!preferTypePrefix
      && typeof p.type === 'string'
      && p.type.startsWith(preferTypePrefix);
    const existing = nameByCite.get(key);
    if (!existing || (isPreferred && !existing.isPreferred)) {
      nameByCite.set(key, { name, isPreferred });
    }
  }
  return nameByCite;
}

/**
 * Expand every "5.01(a) through (r)" / "3.02(b) through Section 3.02(e)"
 * style range found in `text` into its individual lettered cites (e.g.
 * ["5.01(a)", "5.01(b)", ..., "5.01(r)"]). Only single-letter ranges on the
 * SAME base section number expand; everything else is ignored (the caller's
 * own bare-cite parsing picks up non-range mentions separately).
 */
function expandSectionRanges(text) {
  const out = [];
  if (typeof text !== 'string' || !text) return out;
  const rangeRe = /(\d+\.\d+)\s*\(\s*([a-z])\s*\)\s*(?:through|thru|to|[–—-])\s*(?:(?:Section\s+)?\1\s*)?\(\s*([a-z])\s*\)/gi;
  let rm;
  while ((rm = rangeRe.exec(text)) !== null) {
    const base = rm[1];
    const from = SECTION_CITE_LETTERS.indexOf(rm[2].toLowerCase());
    const to = SECTION_CITE_LETTERS.indexOf(rm[3].toLowerCase());
    if (from === -1 || to === -1 || to <= from) continue;
    for (let i = from; i <= to; i++) out.push(`${base}(${SECTION_CITE_LETTERS[i]})`);
  }
  return out;
}

/** Natural section-cite order (5.1 before 5.2; (a) before (b)). */
function sectionCiteSortKey(key) {
  const km = key.match(/^(\d+)\.(\d+)(.*)$/);
  return km
    ? [parseInt(km[1], 10), parseInt(km[2], 10), km[3]]
    : [Number.MAX_SAFE_INTEGER, 0, key];
}

function compareSectionCiteKeys(a, b) {
  const ka = sectionCiteSortKey(a);
  const kb = sectionCiteSortKey(b);
  if (ka[0] !== kb[0]) return ka[0] - kb[0];
  if (ka[1] !== kb[1]) return ka[1] - kb[1];
  return ka[2] < kb[2] ? -1 : ka[2] > kb[2] ? 1 : 0;
}

function resolveAocCovenantCitations(provisions) {
  if (!Array.isArray(provisions) || provisions.length === 0) return;

  // IOC sub-clauses win over other types when both claim the same number.
  const nameByCite = buildSectionCiteIndex(provisions, 'IOC');

  for (const rep of provisions) {
    if (!rep || rep.type !== 'REP-T' || !rep.features) continue;
    const cites = rep.features.aocCitedCovenantSections;
    if (!Array.isArray(cites) || cites.length === 0) continue;

    const ordered = [];
    const seen = new Set();
    const pushCite = (display) => {
      const key = normalizeSectionCite(display);
      if (!key || seen.has(key)) return;
      seen.add(key);
      ordered.push({ display, key });
    };
    for (const c of cites) {
      if (typeof c === 'string' && c.trim()) pushCite(c.trim());
    }
    if (ordered.length === 0) continue;

    // Range expansion: when the limb (or the cite list itself) reads
    // "Sections 5.01(a) through (r)", expand into every lettered sub-clause
    // between the endpoints. The scan is deliberately limited to the
    // recorded limb + cite list — never the whole rep text, which may
    // cross-reference unrelated section ranges.
    const rangeSource = [rep.features.aocOrdinaryCourseLimb, cites.join('; ')]
      .filter((t) => typeof t === 'string')
      .join(' ');
    for (const expanded of expandSectionRanges(rangeSource)) pushCite(expanded);

    ordered.sort((a, b) => compareSectionCiteKeys(a.key, b.key));

    rep.features.aocCitedCovenantNames = ordered.map(({ display, key }) => {
      const hit = nameByCite.get(key);
      return { section: display, name: hit ? hit.name : null };
    });
  }
}

/**
 * Resolve a (possibly sub-clause-granular) section-cite key against
 * nameByCite, progressively stripping trailing "(x)" parenthetical groups
 * until a match is found — REP-T/REP-B provisions record only their BARE
 * section number ("3.02"), so a bring-down tier citing "Section 3.02(b)
 * through Section 3.02(e)" must still resolve to the "3.02" rep's name.
 */
function resolveCiteName(nameByCite, key) {
  let k = key;
  while (k) {
    const hit = nameByCite.get(k);
    if (hit) return hit.name;
    const stripped = k.replace(/\([a-z0-9]+\)$/i, '');
    if (stripped === k) break;
    k = stripped;
  }
  return null;
}

/** Every cite-bearing free-text string on a COND provision worth scanning:
 *  bring-down tier "reps_covered" (COND-B-REP / COND-S-REP) and
 *  crossReferences (consents cross-refs on any COND code). */
function condCiteCandidateTexts(provision) {
  const out = [];
  const f = (provision && provision.features) || {};
  if (Array.isArray(f.bringDownTiers)) {
    for (const tier of f.bringDownTiers) {
      if (!tier || typeof tier !== 'object') continue;
      const rc = tier.reps_covered || tier.repsCovered;
      if (typeof rc === 'string' && rc.trim()) out.push(rc);
    }
  }
  if (Array.isArray(f.crossReferences)) {
    for (const x of f.crossReferences) {
      if (typeof x === 'string' && x.trim()) out.push(x);
      else if (x && typeof x === 'object') {
        if (typeof x.text === 'string' && x.text.trim()) out.push(x.text);
        if (typeof x.label === 'string' && x.label.trim()) out.push(x.label);
      }
    }
  }
  return out;
}

/**
 * FB3 item 4(b): extend the resolveAocCovenantCitations pattern to COND
 * provisions — bring-down rep cites (e.g. "Section 3.02(b) through Section
 * 3.02(e)") and consents cross-refs, resolved to the cited provision's own
 * name and stamped as features.citedProvisionNames = [{ section, name }].
 * REUSES buildSectionCiteIndex / expandSectionRanges / compareSectionCiteKeys
 * — no duplicated cite-parsing logic. Fully deterministic; no AI calls.
 */
function resolveCondCitedProvisionNames(provisions) {
  if (!Array.isArray(provisions) || provisions.length === 0) return;

  // Bring-down tiers and consents cross-refs on COND provisions almost
  // always cite REP sections — prefer REP-T/REP-B provisions on a tie.
  const nameByCite = buildSectionCiteIndex(provisions, 'REP');

  for (const p of provisions) {
    if (!p || typeof p.type !== 'string' || !p.type.startsWith('COND')) continue;
    const texts = condCiteCandidateTexts(p);
    if (texts.length === 0) continue;

    const ordered = [];
    const seen = new Set();
    const pushCite = (display) => {
      const key = normalizeSectionCite(display);
      if (!key || seen.has(key)) return;
      seen.add(key);
      ordered.push({ display, key });
    };

    for (const text of texts) {
      for (const num of parseSectionNumbersFromRepsCovered(text)) pushCite(num);
      for (const expanded of expandSectionRanges(text)) pushCite(expanded);
    }
    if (ordered.length === 0) continue;

    ordered.sort((a, b) => compareSectionCiteKeys(a.key, b.key));

    if (!p.features || typeof p.features !== 'object') p.features = {};
    p.features.citedProvisionNames = ordered.map(({ display, key }) => ({
      section: display,
      name: resolveCiteName(nameByCite, key),
    }));
  }
}

// ---------------------------------------------------------------------------
// Post-processing: Material Contracts rep buckets from defined term
// ---------------------------------------------------------------------------

function isMaterialContractsDefinition(p) {
  if (!p || p.type !== 'DEF') return false;
  const f = p.features || {};
  const term = String(f.canonicalTerm || f.term || p.category || '').replace(/^["“”'‘’\s]+|["“”'‘’\s]+$/g, '');
  const code = String(p.code || '').toUpperCase();
  return /^material\s+contracts?$/i.test(term) || code === 'DEF-MATERIAL-CONTRACTS' || code === 'DEF-MATERIAL-CONTRACT';
}

function isMaterialContractsRep(p) {
  if (!p || p.type !== 'REP-T') return false;
  const code = String(p.code || '').toUpperCase();
  if (code === 'REP-T-MATERIAL-CONTRACTS') return true;
  const cat = String(p.category || '');
  if (/material\s+contracts?/i.test(cat)) return true;
  const text = String(p.full_text || p.text || '');
  return /material\s+contracts?/i.test(text) && /section\s+\d|\bdisclosure\s+letter\b/i.test(text);
}

function textForMaterialContractsDefinition(p) {
  const f = p && p.features ? p.features : {};
  return [
    typeof f.definitionText === 'string' ? f.definitionText : '',
    typeof p.full_text === 'string' ? p.full_text : '',
    typeof p.text === 'string' ? p.text : '',
  ].filter(Boolean).join('\n');
}

// Sequence-validate a set of {index, idx} markers into the longest run that
// starts at idx===0 and increments by exactly 1 — shared by both the
// lettered and roman-numeral scans below so a stray mid-sentence
// parenthetical (which never continues the sequence) can't derail the split.
function longestSequentialRun(markers) {
  const run = [];
  for (const mk of markers) {
    if (run.length === 0) {
      if (mk.idx === 0) run.push(mk);
      continue;
    }
    const prev = run[run.length - 1];
    if (mk.idx === prev.idx + 1) run.push(mk);
  }
  return run;
}

function materialContractBucketMarkerRun(text) {
  const s = String(text || '');
  const letterMarkers = [];
  const letterRe = /\(([a-z])\)\s+/g;
  let m;
  while ((m = letterRe.exec(s)) !== null) {
    const token = m[1].toLowerCase();
    const idx = token.charCodeAt(0) - 97;
    if (idx < 0 || idx > 25) continue;
    letterMarkers.push({ index: m.index, token, idx });
  }
  let run = longestSequentialRun(letterMarkers);

  // Audit-2 item 3 (Skechers MCON 0/29): Material Contract(s) definitions
  // also routinely enumerate with ROMAN NUMERALS instead of letters
  // (Skechers: a 13-item "(i) ... (ii) ... (xiii)" list). The lettered-only
  // scan above returned ZERO buckets for that shape — a multi-char roman
  // token like "ii"/"iii" never matches the single-letter regex, and the
  // handful of romans that ARE also single letters (i, v, x) never start the
  // required idx===0 run. Fall back to a roman-numeral scan, sequence-
  // validated the same way, whenever the lettered scan comes up short.
  if (run.length < 2) {
    const romanMarkers = [];
    const romanRe = /\(([ivx]+)\)\s+/gi;
    let rm;
    while ((rm = romanRe.exec(s)) !== null) {
      const token = rm[1].toLowerCase();
      const idx = ANNEX_ROMAN_ORDER.indexOf(token);
      if (idx < 0) continue;
      romanMarkers.push({ index: rm.index, token, idx });
    }
    run = longestSequentialRun(romanMarkers);
  }
  return run;
}

function splitLetteredDefinitionBuckets(text) {
  const s = String(text || '');
  const run = materialContractBucketMarkerRun(s);

  if (run.length < 2) return [];

  const out = [];
  for (let i = 0; i < run.length; i++) {
    const start = run[i].index;
    const end = i + 1 < run.length ? run[i + 1].index : s.length;
    const item = s.slice(start, end).replace(/\s+/g, ' ').trim().replace(/[;,]\s*$/, '');
    if (item.length >= 20) out.push(item);
  }
  return out;
}

function materialContractsDefinitionFromFullText(fullText) {
  const s = String(fullText || '');
  if (!s) return null;

  const anchorRe = /[“"]Material\s+Contracts?[”"][^“"\n.;]{0,80}?\b(?:means?|shall\s+mean|has\s+the\s+meaning|shall\s+have\s+the\s+meaning)\b/gi;
  let match;
  while ((match = anchorRe.exec(s)) !== null) {
    const start = match.index;
    const windowText = s.slice(start, Math.min(s.length, start + 10000));
    const run = materialContractBucketMarkerRun(windowText);
    if (run.length < 2) continue;

    let end = windowText.length;
    const afterLastMarkerStart = run[run.length - 1].index + 1;
    const afterLastMarker = windowText.slice(afterLastMarkerStart);
    const nextDefinition = afterLastMarker.search(
      /\n\s*[“"][^”"\n]{1,80}[”"]\s+(?:means?|shall\s+mean|has\s+the\s+meaning|shall\s+have\s+the\s+meaning)\b/i,
    );
    if (nextDefinition >= 0) {
      end = afterLastMarkerStart + nextDefinition;
    }

    const text = windowText.slice(0, end).trim();
    if (splitLetteredDefinitionBuckets(text).length < 2) continue;
    return {
      id: 'full-text-def-material-contracts',
      type: 'DEF',
      code: 'DEF-MATERIAL-CONTRACTS',
      category: 'Material Contracts',
      text,
      full_text: text,
      features: {
        canonicalTerm: match[0].includes('Contracts') ? 'Material Contracts' : 'Material Contract',
        definitionText: text,
      },
      relatedDefinitions: findRelatedDefinitions(text),
      isNewCode: false,
    };
  }

  return null;
}

function provisionsWithMaterialContractsDefinitionFromText(provisions, fullText) {
  if (!Array.isArray(provisions) || provisions.length === 0) return provisions;
  if (provisions.some(isMaterialContractsDefinition)) return provisions;
  const def = materialContractsDefinitionFromFullText(fullText);
  if (!def) return provisions;
  return provisions.concat(def);
}

function largestDollarThreshold(text) {
  const hits = [...String(text || '').matchAll(/\$\s?[\d,]+(?:\.\d+)?\s*(?:million|billion|thousand|m|bn|b|k)?/gi)];
  if (hits.length === 0) return null;
  const scored = hits.map((m) => {
    const raw = m[0].replace(/\s+/g, ' ').trim();
    const num = Number((raw.match(/[\d,]+(?:\.\d+)?/) || [''])[0].replace(/,/g, ''));
    const lc = raw.toLowerCase();
    const mult = /billion|\bbn\b|\bb\b/.test(lc) ? 1e9
      : /million|\bm\b/.test(lc) ? 1e6
      : /thousand|\bk\b/.test(lc) ? 1e3
      : 1;
    return { raw, value: Number.isFinite(num) ? num * mult : 0 };
  });
  scored.sort((a, b) => b.value - a.value);
  return scored[0].raw;
}

function classifyMaterialContractBucket(text) {
  const t = String(text || '');
  for (const [code, meta] of Object.entries(MATERIAL_CONTRACT_BUCKET_META || {})) {
    if (code === 'OTHER') continue;
    for (const syn of (meta.synonyms || [])) {
      if (syn.test(t)) return code;
    }
  }
  return 'OTHER';
}

function labelForMaterialBucket(code, text) {
  if (code && code !== 'OTHER') return MATERIAL_CONTRACT_BUCKET_CODES[code] || code;
  const cleaned = String(text || '')
    .replace(/^\([a-z]\)\s*/i, '')
    .replace(/^any\s+/i, '')
    .split(/[,;]/)[0]
    .replace(/\s+/g, ' ')
    .trim();
  return cleaned.length > 80 ? `${cleaned.slice(0, 77)}...` : (cleaned || MATERIAL_CONTRACT_BUCKET_CODES.OTHER || 'Other material contracts');
}

function materialContractBucketsFromDefinition(def) {
  const items = splitLetteredDefinitionBuckets(textForMaterialContractsDefinition(def));
  return items.map((item) => {
    const code = classifyMaterialContractBucket(item);
    return {
      code,
      label: labelForMaterialBucket(code, item),
      text: item,
      threshold: largestDollarThreshold(item),
    };
  });
}

function stampMaterialContractsBucketsFromDefinitions(provisions) {
  if (!Array.isArray(provisions) || provisions.length === 0) return;
  const def = provisions.find(isMaterialContractsDefinition);
  if (!def) return;
  const buckets = materialContractBucketsFromDefinition(def);
  if (buckets.length === 0) return;
  for (const rep of provisions) {
    if (!isMaterialContractsRep(rep)) continue;
    if (!rep.features) rep.features = {};
    const existing = rep.features.materialContractsBuckets;
    if (Array.isArray(existing) && existing.length > 0) continue;
    const repText = String(rep.full_text || rep.text || '');
    if (!/material\s+contracts?/i.test(repText) && !/material\s+contracts?/i.test(String(rep.category || ''))) continue;
    rep.features.materialContractsBuckets = buckets;
    rep.features.materialContractsBucketsSource = {
      source: 'definition',
      definitionTerm: (def.features && (def.features.canonicalTerm || def.features.term)) || def.category || 'Material Contracts',
    };
  }
}

// ---------------------------------------------------------------------------
// Post-processing: Knowledge-definition scope → knowledge-qualified reps
// ---------------------------------------------------------------------------

// Phrasings that make a rep knowledge-qualified: "to the Knowledge of the
// Company", "to Parent's Knowledge", "to the actual knowledge of", "to its
// Knowledge", "known to the Company".
const KNOWLEDGE_QUALIFIER_RE = /\bto\s+the\s+(?:actual\s+)?knowledge\s+of\b|\bto\s+(?:the\s+)?(?:company|parent|buyer|seller|target)(?:['’]s)?\s+knowledge\b|\bto\s+its\s+knowledge\b|\bknown\s+to\s+the\s+(?:company|parent)\b/i;

/**
 * Find the deal's DEF "Knowledge" provisions among already-extracted
 * definitions. Returns { company, parent, generic } — each a DEF provision or
 * null. Matching is deterministic: the DEF-KNOWLEDGE canonical code, or a
 * canonicalTerm/category that IS a knowledge-qualifier term ("Knowledge",
 * "Knowledge of the Company", "Parent's Knowledge") — not merely a term that
 * contains the word (e.g. "Knowledge Base IP" does not match).
 */
function findKnowledgeDefinitions(provisions) {
  const out = { company: null, parent: null, generic: null };
  if (!Array.isArray(provisions)) return out;
  const TERM_RE = /^(?:the\s+)?(?:(company|parent|buyer|seller|target|merger\s+sub)(?:['’]s)?\s+)?knowledge(?:\s+of\s+(?:the\s+)?(company|parent|buyer|seller|target|merger\s+sub))?$/i;
  for (const p of provisions) {
    if (!p || p.type !== 'DEF') continue;
    const rawTerm = String((p.features && p.features.canonicalTerm) || p.category || '')
      .replace(/^["“”'‘’\s]+|["“”'‘’\s]+$/g, '');
    const tm = rawTerm.match(TERM_RE);
    if (!tm && p.code !== 'DEF-KNOWLEDGE') continue;
    const party = ((tm && (tm[1] || tm[2])) || '').toLowerCase();
    let slot = 'generic';
    if (/company|seller|target/.test(party)) slot = 'company';
    else if (/parent|buyer|merger/.test(party)) slot = 'parent';
    if (!out[slot]) out[slot] = p;
  }
  return out;
}

// Map the LLM-extracted per-clause knowledgeScopeType (ENTIRE_REP / PARTIAL)
// onto the string values knowledgeQualifierDisplay (components/review/
// table-logic.js) already accepts on the knowledgeQualifier feature's
// "scope" key. The values are the same strings on both sides deliberately —
// this is an identity map kept explicit so a future rename on either side
// fails loudly instead of silently drifting apart.
function mapKnowledgeScopeTypeToDisplayScope(knowledgeScopeType) {
  if (knowledgeScopeType === 'ENTIRE_REP' || knowledgeScopeType === 'PARTIAL') {
    return knowledgeScopeType;
  }
  return null;
}

/**
 * Two things, both deterministic (no AI calls) and both gated on the SAME
 * regex match against the rep's OWN text:
 *
 * 1. features.knowledgeScope — the verbatim core of the deal's "Knowledge"
 *    definition (named individuals / "actual knowledge of the persons listed
 *    on Schedule X"). REP-T reps get the Company-side definition, REP-B reps
 *    the Parent-side one; a single generic "Knowledge" definition serves
 *    both.
 * 2. features.knowledgeQualifier — the TAGGED { code, label, text, scope }
 *    object the review table's per-rep Knowledge Qualifier cell renders
 *    (KnowledgeQualifierCell / knowledgeQualifierDisplay in
 *    components/review/table-logic.js). This is the field the UI actually
 *    reads; it used to be an LLM-authored article-wide boolean that could
 *    only ever land on the shared preamble row, so the per-rep cell was
 *    always empty. "scope" is folded in from the LLM's clause-level
 *    knowledgeScopeType (ENTIRE_REP / PARTIAL) when the model populated it —
 *    never invented when it didn't.
 *
 * A rep with no knowledge qualifier is left untouched for both (absence is
 * meaningful — the UI renders a plain dash, not a false negative pill).
 */
function linkKnowledgeScopeToReps(provisions) {
  if (!Array.isArray(provisions) || provisions.length === 0) return;
  const defs = findKnowledgeDefinitions(provisions);
  const coreOf = (d) => {
    if (!d) return null;
    const f = d.features || {};
    const core = typeof f.definitionText === 'string' && f.definitionText.trim()
      ? f.definitionText.trim()
      : String(d.text || '').trim();
    return core || null;
  };
  const companyScope = coreOf(defs.company) || coreOf(defs.generic);
  const parentScope = coreOf(defs.parent) || coreOf(defs.generic);

  for (const p of provisions) {
    if (!p || !p.text) continue;
    if (p.type !== 'REP-T' && p.type !== 'REP-B') continue;
    const match = p.text.match(KNOWLEDGE_QUALIFIER_RE);
    if (!match) continue;
    if (!p.features) p.features = {};

    if (!p.features.knowledgeScope) {
      const scope = p.type === 'REP-T' ? companyScope : parentScope;
      if (scope) p.features.knowledgeScope = scope;
    }

    if (!p.features.knowledgeQualifier) {
      const displayScope = mapKnowledgeScopeTypeToDisplayScope(p.features.knowledgeScopeType);
      p.features.knowledgeQualifier = {
        code: 'KNOWLEDGE_QUALIFIED',
        label: 'Knowledge-qualified',
        text: match[0],
        ...(displayScope ? { scope: displayScope } : {}),
      };
    }
  }
}

// ---------------------------------------------------------------------------
// Post-processing: materiality-qualifier scope → materiality-qualified reps
// (FB3 item 1 — mirrors linkKnowledgeScopeToReps exactly, adapted for the
// one real structural difference: materialityQualifier is ALREADY an
// LLM-authored tagged object {code,label,text} — unlike knowledgeQualifier,
// which linkKnowledgeScopeToReps synthesizes from scratch off a regex match
// — so this pass only needs to fold the LLM's own clause-level
// materialityScopeType (ENTIRE_REP / PARTIAL) onto the existing object's
// "scope" key. Never invents a scope the model didn't populate.
// ---------------------------------------------------------------------------

function linkMaterialityScopeToReps(provisions) {
  if (!Array.isArray(provisions) || provisions.length === 0) return;
  for (const p of provisions) {
    if (!p || (p.type !== 'REP-T' && p.type !== 'REP-B')) continue;
    if (!p.features || typeof p.features !== 'object') continue;
    let mq = p.features.materialityQualifier;
    if (!mq || typeof mq !== 'object' || Array.isArray(mq)) continue;
    // materialityQualifier may arrive either as the bare tagged object
    // { code, label, text } or wrapped in the citable-quote shape
    // { value: { code, label, text }, quotes: [...] } — the LLM's own
    // compliance with the "object { value, quotes }" citation framing is
    // inconsistent field-to-field. Mutate whichever is the ACTUAL tagged
    // object in place so the scope lands where the UI's existing tagged-item
    // readers (which already unwrap `.value`) will find it.
    if (mq.value && typeof mq.value === 'object' && !Array.isArray(mq.value)) {
      mq = mq.value;
    }
    if ('scope' in mq) continue; // never overwrite an already-set scope
    const scopeType = p.features.materialityScopeType;
    if (scopeType === 'ENTIRE_REP' || scopeType === 'PARTIAL') {
      mq.scope = scopeType;
    }
  }
}

// ---------------------------------------------------------------------------
// Post-processing (FB3 items 4c/6a): definition-lookup pattern shared by
// willful-breach and stockholder-approval linking — REUSES the
// findKnowledgeDefinitions matching idea (match a DEF provision's own
// canonicalTerm/category against a term regex; never invent a definition
// that doesn't exist).
// ---------------------------------------------------------------------------

/**
 * Find the first DEF provision whose canonicalTerm/category matches
 * termRegex. Returns the DEF provision or null. Deterministic; no AI calls.
 */
function findDefinitionByTerm(provisions, termRegex) {
  if (!Array.isArray(provisions)) return null;
  for (const p of provisions) {
    if (!p || p.type !== 'DEF') continue;
    const term = String((p.features && p.features.canonicalTerm) || p.category || '')
      .replace(/^["“”'‘’\s]+|["“”'‘’\s]+$/g, '');
    if (termRegex.test(term)) return p;
  }
  return null;
}

/** Verbatim definition core: features.definitionText, else the raw text. */
function definitionCoreOf(defProvision) {
  if (!defProvision) return null;
  const f = defProvision.features || {};
  const core = typeof f.definitionText === 'string' && f.definitionText.trim()
    ? f.definitionText.trim()
    : String(defProvision.text || '').trim();
  return core || null;
}

const WILLFUL_BREACH_TERM_RE = /willful(?:\s+(?:and|or)\s+material)?\s+breach/i;

/**
 * FB3 item 6(a): stamp the deal's own "Willful Breach" DEF core onto every
 * MISC provision that already carries the willfulBreachDefinition field but
 * where the LLM left it null (the concept is DEFINED elsewhere in the
 * agreement — typically Article I/IX defined terms — not restated inline on
 * the remedies/termination-mechanics section that cross-refers to it).
 * Absent a "Willful Breach" definition anywhere in the deal, the field stays
 * null — never fabricated.
 */
function linkWillfulBreachDefinition(provisions) {
  if (!Array.isArray(provisions) || provisions.length === 0) return;
  const def = findDefinitionByTerm(provisions, WILLFUL_BREACH_TERM_RE);
  const core = definitionCoreOf(def);
  if (!core) return;
  for (const p of provisions) {
    if (!p || p.type !== 'MISC') continue;
    if (!p.features || typeof p.features !== 'object') continue;
    if (!('willfulBreachDefinition' in p.features)) continue;
    if (p.features.willfulBreachDefinition) continue; // never override an LLM-populated value
    p.features.willfulBreachDefinition = core;
  }
}

const STOCKHOLDER_APPROVAL_TERM_RE = /(?:company\s+)?stockholder\s+approval/i;

/**
 * FB3 item 4(c): stamp the deal's own "Company Stockholder Approval" DEF
 * core onto the stockholder-approval closing condition (COND-M-STOCKHOLDER).
 * Absent a matching definition, the field stays null.
 */
function linkStockholderApprovalDefinition(provisions) {
  if (!Array.isArray(provisions) || provisions.length === 0) return;
  const def = findDefinitionByTerm(provisions, STOCKHOLDER_APPROVAL_TERM_RE);
  const core = definitionCoreOf(def);
  if (!core) return;
  for (const p of provisions) {
    if (!p || p.code !== 'COND-M-STOCKHOLDER') continue;
    if (!p.features || typeof p.features !== 'object') p.features = {};
    if (p.features.approvalDefinition) continue;
    p.features.approvalDefinition = core;
  }
}

// ---------------------------------------------------------------------------
// Section-cite parsing (shared by resolveCondCitedProvisionNames)
// ---------------------------------------------------------------------------

/**
 * Extract a section number (e.g. "3.01", "3.05(a)") from a free-text rep
 * descriptor like "Section 3.01 (Organization), 3.04 (Authority)" or
 * "Section 3.05(a) (No MAE)". Returns an array of normalized section keys.
 */
function parseSectionNumbersFromRepsCovered(text) {
  if (!text || typeof text !== 'string') return [];
  const out = [];
  const seen = new Set();
  const re = /(?:Section\s+)?(\d+\.\d{1,2}(?:\([a-z\d]+\))?)/gi;
  let m;
  while ((m = re.exec(text)) !== null) {
    const num = m[1];
    if (!num) continue;
    if (seen.has(num)) continue;
    seen.add(num);
    out.push(num);
  }
  return out;
}

// ---------------------------------------------------------------------------
// Post-processing: CVR maximum payment from the attached CVR agreement
// ---------------------------------------------------------------------------

/**
 * MetsFB2 §1: the merger agreement's consideration section says only "the
 * right to receive the Milestone Payments as set forth in the CVR Agreement"
 * — the actual amounts live in the Form of CVR Agreement attached as an
 * exhibit to the same filing (outside any classified section). Scan the
 * exhibit for `"… Milestone Payment" means $X.XX` definitions, sum them, and
 * stamp features.maxPayment (rendered by the consideration table as
 * "1 CVR (up to $X)") plus the per-milestone breakdown onto the CVR-bearing
 * CONSID provision. Deterministic — no LLM call. ALWAYS runs, even when the
 * LLM already populated maxPayment: an LLM that only noticed one of several
 * milestone definitions understates the deal's real CVR ceiling, so a
 * multi-milestone exhibit sum that exceeds the stored value OVERRIDES it
 * (see the override guard below) rather than being silently discarded.
 */
function backfillCvrMaxFromExhibit(provisions, fullText) {
  if (!Array.isArray(provisions) || !fullText) return;
  const cvrRe = /contingent\s+value\s+right|\bCVRs?\b/i;
  const consids = provisions.filter(
    (p) => p.type === 'CONSID' && cvrRe.test(p.text || '')
  );
  if (consids.length === 0) return;
  // Metsera: the LLM captured only ONE milestone definition it happened to
  // notice in the exhibit (the Mono FDA milestone, $7.00) and stamped that as
  // maxPayment — the review page then showed "up to $7.00" when the CVR
  // Agreement actually defines THREE milestone payments ($5.00 + $10.50 +
  // $7.00 = $22.50). An unconditional no-op here (the old behavior) let that
  // undercount stand. So: ALWAYS run the deterministic exhibit scan below,
  // then only override the LLM's stored value when the scan finds >= 2
  // milestone definitions AND their sum exceeds the stored value — a
  // single-milestone match equal to (or exceeded by) the LLM's own value
  // leaves it alone (see the two no-op tests in cvr-max-exhibit.test.js).
  const existingMaxRaw = consids.reduce((acc, p) => {
    if (acc != null) return acc;
    const v = p.features && (p.features.maxPayment || p.features.cvrMaxPayment);
    return v != null ? v : acc;
  }, null);
  const existingMax = existingMaxRaw != null
    ? parseFloat(String(existingMaxRaw).replace(/[^0-9.]/g, ''))
    : null;

  const exhibitAt = fullText.search(
    /FORM\s+OF\s+CONTINGENT\s+VALUE\s+RIGHTS\s+AGREEMENT|CONTINGENT\s+VALUE\s+RIGHTS\s+AGREEMENT/i
  );
  if (exhibitAt < 0) return;
  const body = fullText.slice(exhibitAt);

  // `"[First ]Milestone Payment[ Amount]" means [an amount in cash equal to] $X.XX`
  // The stored text may carry [[DEFINED]]…[[/DEFINED]] markers around the term,
  // and EDGAR line-wraps can split the quoted term itself across lines
  // ("Clinical\nTrial Milestone Payment") — the term charclass must admit
  // newlines or the scan silently misses milestones (Metsera's fresh fetch
  // hid 2 of 3 from the \n-excluding version; labels are whitespace-collapsed
  // below).
  const defRe = /["“]([^"“”]{0,60}Milestone[^"“”]{0,40}Payment(?:\s+Amount)?)["”]\s*(?:\[\[\/DEFINED\]\])?\s*means\s*(?:an\s+amount(?:\s+in\s+cash)?\s+equal\s+to\s*)?\$\s?([\d,]+(?:\.\d+)?)/gi;
  const seen = new Map();
  let m;
  while ((m = defRe.exec(body)) !== null) {
    const label = m[1].trim().replace(/\s+/g, ' ');
    const amount = parseFloat(m[2].replace(/,/g, ''));
    // Per-CVR milestone amounts are single/double-digit dollars; anything
    // large is an aggregate cap or an unrelated figure — skip it.
    if (!Number.isFinite(amount) || amount <= 0 || amount > 500) continue;
    if (!seen.has(label)) {
      seen.set(label, {
        label,
        amount,
        text: m[0].replace(/\[\[\/?DEFINED\]\]/g, '').replace(/\s+/g, ' ').trim(),
      });
    }
  }
  if (seen.size === 0) return;

  const items = [...seen.values()];
  const total = items.reduce((s, i) => s + i.amount, 0);

  // Only override a stored LLM value when the exhibit scan finds a GENUINE
  // undercount: >= 2 milestone definitions whose sum exceeds what's already
  // stored. A single-milestone match (the exhibit scan agreeing with, or
  // undershooting, an LLM value that already covers every milestone) is left
  // alone — the LLM value wins ties and larger values.
  if (existingMax != null) {
    const isUndercount = items.length >= 2 && total > existingMax;
    if (!isUndercount) return;
  }

  const target = consids.find((p) => p.code === 'CONSID-CVR') || consids[0];
  target.features = {
    ...(target.features || {}),
    maxPayment: `$${total.toFixed(2)}`,
    cvrMilestonePayments: items.map((i) => ({
      code: 'CVR_MILESTONE',
      label: i.label,
      text: i.text,
    })),
  };
}

// ---------------------------------------------------------------------------
// Post-processing: backstop for instruments the AI dropped (MetsFB2 §1: RSAs)
// ---------------------------------------------------------------------------

// Instrument-name detectors, keyed by EQUITY_INSTRUMENTS code. Deliberately
// tight — "warrants" alone would false-positive on "represents and warrants".
// INSTRUMENT_MENTION_RES now lives in ./consideration-equity (imported above)
// so its misclassified-carrier guard and this file's mention backfill share
// one definition of "the text names an instrument".

const ROMAN_MARKERS = new Set(['i', 'ii', 'iii', 'iv', 'v', 'vi', 'vii', 'viii', 'ix', 'x']);
const TREATMENT_VERB_RE = /\b(?:shall|will|is|are|be|become|vest|vested|cancelled|canceled|converted|assumed|continue|continued|terminate|terminated|exercise|exercised|purchase|refund|refunded)\b/i;

function priorClauseMarker(text, index) {
  const prefix = text.slice(Math.max(0, index - 180), index);
  const matches = [...prefix.matchAll(/\(([a-z]{1,5})\)/gi)];
  if (matches.length === 0) return null;
  const marker = matches[matches.length - 1][1].toLowerCase();
  return { marker, kind: ROMAN_MARKERS.has(marker) ? 'roman' : 'letter' };
}

function nextClauseBoundary(text, from, kind) {
  const tail = text.slice(from);
  const re = kind === 'letter'
    ? /\s\([a-z]\)\s+(?=[A-Z])/g
    : /\s\((?:i{1,3}|iv|v|vi{0,3}|ix|x|[a-z])\)\s+/gi;
  const m = re.exec(tail);
  if (m) return from + m.index;
  const period = text.indexOf('. ', from);
  if (period !== -1) return period + 1;
  return Math.min(text.length, from + 700);
}

function instrumentTreatmentCode(instrumentCode, span) {
  const s = String(span || '').toLowerCase();
  if (/\bwithout\s+(?:any\s+)?consideration\b/.test(s)) return 'CANCELLED_NO_CONSIDERATION';
  if (/\b(?:assumed|converted)\b.{0,120}\b(?:parent|buyer|acquir)/.test(s)) return 'ASSUMED_BY_BUYER';
  if (/\bcontinue\b|\bcontinued\b|\bremain\s+outstanding\b/.test(s)) return 'CONTINUED_VESTING';
  if (/\bdouble[-\s]?trigger\b/.test(s)) return 'DOUBLE_TRIGGER';
  if (/\b(?:terminate|terminated|cancelled|canceled)\b/.test(s) && /\b(?:without|no)\s+(?:any\s+)?consideration\b/.test(s)) {
    return 'CANCELLED_NO_CONSIDERATION';
  }
  if (instrumentCode === 'STOCK_OPTIONS' && /\b(?:excess|spread|exercise\s+price)\b/.test(s)) {
    return 'CASHED_OUT_SPREAD';
  }
  if (/\bvest(?:ed)?\s+in\s+full\b|\bfully\s+vest(?:ed)?\b/.test(s)) return 'ACCELERATED_VESTING';
  if (/\b(?:cancelled|canceled|converted|exchange|right\s+to\s+receive|merger\s+consideration|cash\s+payment|purchase\s+price|per\s+share)\b/.test(s)) {
    return 'CASHED_OUT_AT_CONSIDERATION';
  }
  if (instrumentCode === 'ESPP' && /\b(?:terminate|terminated|final\s+offering|purchase\s+period|refund|refunded)\b/.test(s)) {
    return 'CANCELLED_NO_CONSIDERATION';
  }
  return null;
}

function findInstrumentTreatment(text, instrumentCode, mentionRe) {
  const matches = [...String(text || '').matchAll(new RegExp(mentionRe.source, mentionRe.flags.includes('g') ? mentionRe.flags : `${mentionRe.flags}g`))];
  const candidates = matches
    .filter((m) => !isNegatedMention(text, m.index))
    .map((m) => {
      const marker = priorClauseMarker(text, m.index);
      const fallbackStart = text.lastIndexOf('. ', m.index) + 1;
      const markerStart = marker
        ? text.lastIndexOf(`(${marker.marker})`, m.index)
        : -1;
      const start = markerStart >= 0 && m.index - markerStart <= 180 ? markerStart : fallbackStart;
      const end = nextClauseBoundary(text, m.index + m[0].length, marker && marker.kind);
      const span = text.slice(start, end).trim();
      const postMention = text.slice(m.index, Math.min(text.length, m.index + 500));
      const ownLimb = markerStart >= 0 && m.index - markerStart <= 80;
      return { span, score: (TREATMENT_VERB_RE.test(postMention) ? 2 : 0) + (ownLimb ? 1 : 0) };
    })
    .sort((a, b) => b.score - a.score || b.span.length - a.span.length);
  for (const c of candidates) {
    const code = instrumentTreatmentCode(instrumentCode, c.span);
    if (!code) continue;
    return {
      code,
      label: EQUITY_TREATMENT[code] || code,
      text: c.span,
      instrumentCode,
    };
  }
  return null;
}

/**
 * MetsFB2 §1: Metsera's Section 2.03 enumerates "(i) each Company Stock
 * Option ... (ii) each Company Restricted Stock Award ..." but the AI only
 * emitted the Stock Options instrument — the RSAs vanished from the equity
 * table. Deterministic backstop: any instrument NAMED in a CONSID-EQUITY
 * provision's text but missing from outstandingInstruments gets a verbatim
 * entry. When that instrument's own clause states a treatment, pair it too.
 *
 * Fix batch item 2: merger agreements also routinely name an instrument only
 * to say it DOESN'T exist ("no ... stock appreciation rights ... issued or
 * outstanding" is standard capitalization-rep boilerplate). A bare name hit
 * is not evidence of an outstanding instrument — skip a mention whose
 * containing sentence negates existence (lib/instrument-negation.js), and
 * only add the instrument if a NON-negated mention exists somewhere in the
 * text.
 */
function backfillMissingInstrumentMentions(provisions) {
  if (!Array.isArray(provisions)) return;
  const equityLabels = EQUITY_INSTRUMENTS || {};
  for (const p of provisions) {
    if (p.type !== 'CONSID') continue;
    const isEquity = p.code === 'CONSID-EQUITY' ||
      /equity\s+award|stock\s+plan|treatment\s+of\s+(?:company\s+)?(?:equity|stock|option)/i.test(p.category || '');
    if (!isEquity) continue;
    const text = p.text || '';
    if (!text) continue;
    const feats = p.features || {};
    const existing = Array.isArray(feats.outstandingInstruments) ? feats.outstandingInstruments : [];
    const existingCodes = new Set(existing.map((i) => i && (i.code || i)).filter(Boolean));
    const added = [];
    const addedTreatments = [];
    for (const [code, re] of Object.entries(INSTRUMENT_MENTION_RES)) {
      if (existingCodes.has(code)) continue;
      const m = firstAffirmativeMention(re, text);
      if (!m) continue;
      // Verbatim sentence containing the first (non-negated) mention (capped).
      const sentStart = text.lastIndexOf('. ', m.index) + 1;
      const sentEndIdx = text.indexOf('. ', m.index);
      const sentEnd = sentEndIdx === -1 ? Math.min(text.length, m.index + 300) : Math.min(sentEndIdx + 1, sentStart + 400);
      added.push({
        code,
        label: equityLabels[code] || code,
        text: text.slice(sentStart, sentEnd).trim(),
      });
      const treatment = findInstrumentTreatment(text, code, re);
      if (treatment) addedTreatments.push(treatment);
    }
    if (added.length === 0) continue;
    p.features = {
      ...feats,
      outstandingInstruments: [...existing, ...added],
      instrumentTreatments: [
        ...(Array.isArray(feats.instrumentTreatments) ? feats.instrumentTreatments : []),
        ...addedTreatments,
      ],
    };
  }
}

// ---------------------------------------------------------------------------
// Post-processing: expand CONSID-EQUITY into one provision per instrument
// ---------------------------------------------------------------------------

/**
 * The AI emits ONE CONSID-EQUITY provision per section, with
 * outstandingInstruments / instrumentTreatments as parallel arrays. The UI
 * wants ONE provision per instrument so each instrument is its own row in
 * the table (instrument type | outstanding count | treatment | vesting |
 * cash-out formula).
 *
 * For each CONSID-EQUITY provision with >1 outstanding instrument, we emit a
 * sibling provision for each additional instrument and trim the original
 * to its first instrument. instrumentType (drawn from EQUITY_INSTRUMENTS)
 * distinguishes the rows.
 *
 * If there is only one (or zero) instruments listed, we just stamp
 * features.instrumentType for the single row so the UI has the marker.
 */
function expandConsidEquityByInstrument(provisions) {
  if (!Array.isArray(provisions) || provisions.length === 0) return;

  // Pair an outstanding-instrument tagged item with the corresponding
  // treatment tagged item. The AI prompt instructs that index i of both
  // arrays describe the SAME instrument, but in practice the model
  // sometimes reorders treatments or omits/duplicates entries. We
  // normalize here so each per-instrument row carries an unambiguous
  // treatment value.
  //
  // Strategy:
  //   1. Build a treatment map keyed by treatment.instrument or
  //      treatment.instrumentCode if the AI tagged it.
  //   2. Fall back to a positional pair when the codes don't line up.
  //   3. As a last resort, leave treatment null and log a warning so
  //      the UI can render "—" instead of the wrong treatment.
  const pairInstrumentWithTreatment = (insts, treatments, prov) => {
    const result = new Array(insts.length).fill(null);
    if (!Array.isArray(insts) || insts.length === 0) return result;
    const tList = Array.isArray(treatments) ? treatments.slice() : [];

    // Pass 1: explicit cross-tag — treatment may include its instrument code
    // under `instrument` / `instrumentCode` / `for` (defensive).
    const usedT = new Set();
    insts.forEach((inst, i) => {
      const instCode = inst && (inst.code || inst.instrument);
      if (!instCode) return;
      const upper = String(instCode).toUpperCase();
      for (let ti = 0; ti < tList.length; ti++) {
        if (usedT.has(ti)) continue;
        const t = tList[ti];
        if (!t || typeof t !== 'object') continue;
        const tCode = String(t.instrument || t.instrumentCode || t.for || '').toUpperCase();
        if (tCode && tCode === upper) {
          result[i] = t;
          usedT.add(ti);
          break;
        }
      }
    });

    // Pass 2: positional fallback — for any unfilled slot, take the next
    // unused treatment in the original parallel order.
    let cursor = 0;
    for (let i = 0; i < insts.length; i++) {
      if (result[i] !== null) continue;
      while (cursor < tList.length && usedT.has(cursor)) cursor++;
      if (cursor < tList.length) {
        result[i] = tList[cursor];
        usedT.add(cursor);
        cursor++;
      }
    }

    // Sanity check: if any instrument is still missing a treatment AND
    // the AI returned a non-empty treatments array, log a warning. The
    // UI can render "—" and still display both arrays so a reviewer can
    // re-tag manually.
    if (process.env.NODE_ENV !== 'production' && tList.length > 0) {
      const unmatched = result.filter((r) => r === null).length;
      if (unmatched > 0) {
        console.warn(
          `[expandConsidEquityByInstrument] ${unmatched}/${insts.length} instruments lack a paired treatment ` +
            `(prov id=${prov && prov.id ? prov.id : '?'}; instruments=${insts.length}, treatments=${tList.length})`,
        );
      }
    }

    return result;
  };

  const expanded = [];
  // Iterate in reverse so we can splice safely.
  for (let idx = provisions.length - 1; idx >= 0; idx--) {
    const p = provisions[idx];
    if (!p || p.code !== 'CONSID-EQUITY') continue;

    const f = p.features || {};
    if (f.considerationEquity && Array.isArray(f.considerationTreatments)) continue;
    const insts = Array.isArray(f.outstandingInstruments) ? f.outstandingInstruments : [];
    const treatments = Array.isArray(f.instrumentTreatments) ? f.instrumentTreatments : [];
    const vestings = Array.isArray(f.instrumentVesting) ? f.instrumentVesting : [];

    if (insts.length <= 1) {
      // No expansion needed — but still stamp instrumentType if we can.
      if (insts.length === 1 && !f.instrumentType) {
        f.instrumentType = insts[0]; // already a tagged { code, label, text } object
      }
      // Also stamp a singular equityAwardTreatment from the (paired) treatment
      // so the UI has one unambiguous value to render.
      if (insts.length === 1 && !f.equityAwardTreatment) {
        const paired = pairInstrumentWithTreatment(insts, treatments, p);
        if (paired[0]) f.equityAwardTreatment = paired[0];
      }
      // Stamp a singular per-row vestingAcceleration from the paired vesting so
      // the single-instrument provision renders its own vesting (not a
      // section-wide one).
      if (insts.length === 1 && vestings.length > 0) {
        const pairedV = pairInstrumentWithTreatment(insts, vestings, p);
        if (pairedV[0]) f.vestingAcceleration = pairedV[0];
      }
      continue;
    }

    // Pair each instrument with its treatment AND its vesting by code/key.
    const pairedTreatments = pairInstrumentWithTreatment(insts, treatments, p);
    const pairedVestings = pairInstrumentWithTreatment(insts, vestings, p);

    // Build one row per instrument.
    const rows = insts.map((inst, i) => {
      const treatment = pairedTreatments[i] || null;
      const vesting = pairedVestings[i] || null;
      const rowFeatures = {
        ...f,
        instrumentType: inst, // tagged { code, label, text } from EQUITY_INSTRUMENTS
        outstandingInstruments: [inst],
        instrumentTreatments: treatment ? [treatment] : [],
        instrumentVesting: vesting ? [vesting] : [],
        // Singular per-row treatment — guaranteed to correspond to THIS row's
        // instrument now that we've paired by code instead of by index.
        // Fix batch item 2: this branch only runs when insts.length > 1 (the
        // single-instrument case is handled above, where the section-wide
        // field genuinely IS this one instrument's). With >1 instruments the
        // section-wide equityAwardTreatment/vestingAcceleration describes
        // only ONE of them (usually the first/primary instrument) — falling
        // back to it for every OTHER instrument lacking its own paired entry
        // handed e.g. ESPP the options' own double-trigger vesting language
        // verbatim. No fallback here: render null ("—") when this instrument
        // genuinely has no paired treatment/vesting of its own.
        equityAwardTreatment: treatment || null,
        vestingAcceleration: vesting || null,
      };
      return makeProvision({
        type: p.type,
        code: p.code,
        category: inst && inst.label ? inst.label : (p.category || 'Treatment of Equity Awards'),
        text: p.text,
        startChar: p.startChar,
        favorability: p.favorability || 'neutral',
        features: rowFeatures,
        relatedDefinitions: [...(p.relatedDefinitions || [])],
        isNewCode: false,
        proposedCode: null,
        proposedLabel: null,
      });
    });

    // Replace original provision with the first row, then queue the rest
    // to insert after it.
    provisions[idx] = rows[0];
    for (let r = 1; r < rows.length; r++) {
      expanded.push({ afterIndex: idx, prov: rows[r] });
    }
  }

  // Splice extra rows into the array immediately after their source.
  // Sort descending by afterIndex so splice indices remain valid.
  expanded.sort((a, b) => b.afterIndex - a.afterIndex);
  for (const { afterIndex, prov } of expanded) {
    provisions.splice(afterIndex + 1, 0, prov);
  }
}

// ---------------------------------------------------------------------------
// Post-processing: 100% text coverage backfill (section leftovers)
// ---------------------------------------------------------------------------

/**
 * Normalize whitespace for coverage comparison. We don't want a missing space
 * between "Section" and "5.01" to count as uncovered text.
 */
function normalizeForCoverage(s) {
  return (s || '').replace(/\s+/g, ' ').trim();
}

/**
 * For each classified section, compute the cumulative coverage of its text by
 * the provisions extracted from it. If a substantial run of text (>50 chars
 * normalized) is NOT covered by any provision, emit a "SECTION-LEFTOVER"
 * provision capturing the uncovered slice so we maintain 100% text coverage.
 *
 * Provisions are matched to their parent section by char-offset window first
 * (parent_start <= prov_start < parent_end) and, as a fallback, by verbatim
 * substring containment (provision text appears within the section text).
 *
 * Returns a report:
 *   {
 *     sections_checked: number,
 *     leftovers_emitted: number,
 *     uncovered_chars_total: number,
 *     low_coverage_sections: [ { sectionNumber, sectionTitle, coverage_pct } ]
 *   }
 */
function backfillSectionLeftovers(classifiedSections, provisions) {
  const report = {
    sections_checked: 0,
    leftovers_emitted: 0,
    uncovered_chars_total: 0,
    low_coverage_sections: [],
  };
  if (!Array.isArray(classifiedSections) || classifiedSections.length === 0) return report;
  if (!Array.isArray(provisions)) return report;

  for (const sect of classifiedSections) {
    if (!sect || !sect.text || sect.text.length < 80) continue;
    // Skip DEF sections entirely — definitions are an alphabetized list and
    // partial coverage is expected/acceptable there.
    if (sect.provision_type === 'DEF' || sect.provisionType === 'DEF') continue;
    report.sections_checked++;

    const sectText = sect.text;
    const sectStart = sect.startChar || 0;
    const sectEnd = sectStart + sectText.length;
    const sectRegionId = sect.regionId || sect.region_id || null;

    // 1. Identify provisions belonging to this section by char-window OR by
    //    verbatim substring containment in the section's text.
    const belonging = [];
    for (const prov of provisions) {
      if (!prov || !prov.text) continue;
      // Skip leftovers, OTHER backfills, inline-def DEF provisions
      if (prov.type === 'SECTION-LEFTOVER') continue;
      if (prov.type === 'OTHER') continue;
      if (prov.type === 'DEF' && prov.features && prov.features.inlineDefinition) {
        continue;
      }
      const provRegionId = prov.regionId || prov.region_id || (prov.features && (prov.features.regionId || prov.features.region_id)) || null;
      const sameRegion = sectRegionId && provRegionId && String(sectRegionId) === String(provRegionId);
      if (sectRegionId && provRegionId && !sameRegion) continue;
      const pStart = prov.startChar || 0;
      const pEnd = pStart + (prov.text || '').length;
      const inWindow = pStart >= sectStart && pStart < sectEnd;
      // Cheaper fallback containment check: does a prefix of the provision
      // appear in the section text? We use the first 80 chars of the provision
      // (normalized) as a search key.
      let contained = false;
      if (!inWindow) {
        const probe = normalizeForCoverage(prov.text).substring(0, 80);
        if (probe.length >= 30 && normalizeForCoverage(sectText).includes(probe)) {
          contained = true;
        }
      }
      if (sameRegion || inWindow || contained) belonging.push(prov);
    }

    if (belonging.length === 0) {
      // No provisions for this section — already handled by validate.js's
      // backfillOrphanSections, which will emit a full-section OTHER provision.
      continue;
    }

    // 2. Build coverage intervals over the SECTION text. For each belonging
    //    provision, find its earliest occurrence in the section text (via
    //    normalized substring search) and mark that span as covered.
    const sectNorm = sectText;
    const covered = []; // array of [start, end)
    for (const prov of belonging) {
      const ptext = prov.text || '';
      if (ptext.length < 20) continue;

      // Try exact match first; fall back to first-80-chars probe.
      let idx = sectNorm.indexOf(ptext);
      let matchLen = ptext.length;
      if (idx === -1) {
        const probe = ptext.substring(0, Math.min(80, ptext.length));
        idx = sectNorm.indexOf(probe);
        matchLen = probe.length;
        if (idx === -1) continue;
        // Approximate the actual covered length by extending to the lesser of
        // the probe-anchored span or the provision length.
        matchLen = Math.min(ptext.length, sectNorm.length - idx);
      }
      covered.push([idx, idx + matchLen]);
    }

    if (covered.length === 0) continue;

    // 3. Merge overlapping intervals.
    covered.sort((a, b) => a[0] - b[0]);
    const merged = [];
    for (const iv of covered) {
      if (merged.length === 0 || iv[0] > merged[merged.length - 1][1]) {
        merged.push([iv[0], iv[1]]);
      } else {
        merged[merged.length - 1][1] = Math.max(merged[merged.length - 1][1], iv[1]);
      }
    }

    // 4. Compute uncovered runs (gaps between merged intervals, plus the
    //    leading and trailing tails).
    const uncovered = [];
    let cursor = 0;
    for (const [s, e] of merged) {
      if (s > cursor) uncovered.push([cursor, s]);
      cursor = e;
    }
    if (cursor < sectText.length) uncovered.push([cursor, sectText.length]);

    // 5. For each uncovered run with >50 chars (normalized), emit a leftover.
    const sectionTitle = sect.title || sect.heading || sect.category || null;
    const sectionNumber = sect.number || sect.sectionNumber || null;
    const parentType = sect.provision_type || sect.provisionType || null;

    let runIndex = 0;
    let coveredChars = 0;
    for (const [s, e] of merged) coveredChars += (e - s);
    const coveragePct = sectText.length > 0 ? (coveredChars / sectText.length) : 1;

    for (const [s, e] of uncovered) {
      const slice = sectText.substring(s, e);
      const norm = normalizeForCoverage(slice);
      if (norm.length <= 50) continue;
      runIndex++;
      report.uncovered_chars_total += norm.length;
      provisions.push({
        type: 'SECTION-LEFTOVER',
        code: null,
        category: sectionTitle
          ? `Uncovered text — ${sectionTitle}${runIndex > 1 ? ` (#${runIndex})` : ''}`
          : `Uncovered text${runIndex > 1 ? ` (#${runIndex})` : ''}`,
        text: slice.trim(),
        startChar: sectStart + s,
        endChar: sectStart + e,
        regionId: sectRegionId || null,
        region_id: sectRegionId || null,
        regionKey: sect.regionKey || null,
        regionType: sect.regionType || null,
        favorability: 'neutral',
        features: {
          mainConcept: '(Section leftover — text not captured by any provision; backfilled for 100% coverage.)',
          sectionNumber,
          sectionTitle,
          parentProvisionType: parentType,
          ...(sectRegionId ? { regionId: sectRegionId } : {}),
        },
        relatedDefinitions: [],
        isNewCode: false,
        proposedCode: null,
        proposedLabel: null,
        backfilled: true,
      });
      report.leftovers_emitted++;
    }

    if (coveragePct < 0.5) {
      report.low_coverage_sections.push({
        sectionNumber,
        sectionTitle,
        coverage_pct: Math.round(coveragePct * 100),
      });
    }
  }

  return report;
}

// ---------------------------------------------------------------------------
// Post-processing: alphabetical sort of DEF provisions
// ---------------------------------------------------------------------------

/**
 * Sort DEF provisions alphabetically by canonical term (defined-term name).
 * The "General / Preamble" DEF provision (if any) is pinned to the top.
 * Non-DEF provisions are left in place — we splice the sorted DEF run back
 * in at the same positions the originals occupied.
 */
function sortDefinitionsAlphabetically(provisions) {
  if (!Array.isArray(provisions) || provisions.length === 0) return;

  // Collect DEF provisions and their original positions.
  const defIndices = [];
  const defs = [];
  for (let i = 0; i < provisions.length; i++) {
    if (provisions[i] && provisions[i].type === 'DEF') {
      defIndices.push(i);
      defs.push(provisions[i]);
    }
  }
  if (defs.length <= 1) return;

  const termFor = (p) => {
    const f = p.features || {};
    if (f.canonicalTerm && typeof f.canonicalTerm === 'string') return f.canonicalTerm.trim();
    if (p.category && typeof p.category === 'string') return p.category.trim();
    return '';
  };

  defs.sort((a, b) => {
    // Pin preamble to top.
    const ca = (a.category || '').toLowerCase();
    const cb = (b.category || '').toLowerCase();
    const isPreA = ca === 'general / preamble' || ca === 'preamble';
    const isPreB = cb === 'general / preamble' || cb === 'preamble';
    if (isPreA && !isPreB) return -1;
    if (isPreB && !isPreA) return 1;
    return termFor(a).localeCompare(termFor(b), 'en', { sensitivity: 'base' });
  });

  // Stamp sort_order on each DEF in the sorted sequence so downstream
  // store/UI can rely on it.
  defs.forEach((d, i) => {
    if (!d.features) d.features = {};
    d.features.sort_order = i;
  });

  // Splice the sorted defs back into the original DEF positions.
  for (let k = 0; k < defIndices.length; k++) {
    provisions[defIndices[k]] = defs[k];
  }
}

// ---------------------------------------------------------------------------
// Exports
// ---------------------------------------------------------------------------

// ---------------------------------------------------------------------------
// Post-processing (FB3 item 5): TERMR outside-date months, pure date math
// ---------------------------------------------------------------------------

/**
 * Round the number of months between two dates to the nearest whole month
 * (30.4375-day average month — good enough for a "~N months" cross-deal
 * stat; exact day-of-month drift is not the point). Returns null if either
 * date fails to parse, or if the result would be negative (dates reversed).
 */
function monthsBetweenRounded(fromISO, toISO) {
  if (!fromISO || !toISO) return null;
  const from = new Date(fromISO);
  const to = new Date(toISO);
  if (Number.isNaN(from.getTime()) || Number.isNaN(to.getTime())) return null;
  const days = (to.getTime() - from.getTime()) / 86400000;
  if (days < 0) return null;
  return Math.round(days / 30.4375);
}

/**
 * FB3 item 5: stamp outsideDateMonthsPostSigning + extensionMonths on the
 * TERMR-OUTSIDE provision — pure date math, no LLM call. Reads
 * features.outsideDateISO / extendedOutsideDateISO (clean, LLM-normalized
 * calendar dates — distinct from the narrative "outsideDate" text, which
 * often bundles both dates into one prose string) and dealMeta.signingDate
 * (threaded in by the caller from deals.announce_date / the agreement's own
 * "dated as of" date — extract.js has no DB access of its own). Null
 * whenever either date is missing; never invented.
 */
function computeOutsideDateMonths(provisions, dealMeta) {
  if (!Array.isArray(provisions) || provisions.length === 0) return;
  const signingDate = dealMeta && dealMeta.signingDate;
  for (const p of provisions) {
    if (!p || p.code !== 'TERMR-OUTSIDE') continue;
    if (!p.features || typeof p.features !== 'object') continue;
    const outside = p.features.outsideDateISO;
    const extended = p.features.extendedOutsideDateISO;
    p.features.outsideDateMonthsPostSigning = monthsBetweenRounded(signingDate, outside);
    p.features.extensionMonths = monthsBetweenRounded(outside, extended);
  }
}

module.exports = {
  extractProvisions,
  extractProvisionsForType,
  // Exposed so read-only, out-of-pipeline consumers (e.g.
  // scripts/span-residual-baseline.js) can scope themselves to exactly the
  // section types Strategy A/C handle, without redeclaring the list.
  STRATEGY_A_TYPES,
  STRATEGY_C_TYPES,
  expandTypeGroup,
  filterProvisionsToTypeGroup,
  applyPerTypeLocalPostPasses,
  expandConsidEquityByInstrument,
  sortDefinitionsAlphabetically,
  // Exposed for testing
  splitSubClauses,
  detectIocPartyFlipLetter,
  detectIocPartyFlipIndex,
  splitOfferConditionAnnex,
  splitTermrSubClauseRomans,
  splitUmbrellaRepSections,
  extractTitledSubclauses,
  extractTenderOfferMechanicsFeatures,
  splitDefinitions,
  splitIocPreamble,
  backfillCvrMaxFromExhibit,
  backfillMissingInstrumentMentions,
  findInlineDefinitions,
  findRelatedDefinitions,
  buildFeatureInstructions,
  buildCodesList,
  normalizeSectionCite,
  resolveAocCovenantCitations,
  materialContractBucketsFromDefinition,
  stampMaterialContractsBucketsFromDefinitions,
  findKnowledgeDefinitions,
  linkKnowledgeScopeToReps,
  parseSectionNumbersFromRepsCovered,
  filterFeaturesToCodeSchema,
  enforceCanonicalCodes,
  consolidateProposedCodes,
  // v1 reclassification (2026-08-02, R3) — exposed for testing.
  expandAntiRelianceElements,
  ANTI_RELIANCE_ELEMENT_PATTERNS,
  ANTI_RELIANCE_FAMILY_CODES,
  splitIntoSubclauseBlocks,
  recordAliasFromAutoMerge,
  normalizeForCodeMatch,
  // FB3 batch — exposed for testing
  linkMaterialityScopeToReps,
  deriveIocLimbEffortsStandard,
  normalizeIocLimbEffortsStandards,
  liftIncludedObligationsFromLimbText,
  findDefinitionByTerm,
  linkWillfulBreachDefinition,
  linkStockholderApprovalDefinition,
  buildSectionCiteIndex,
  expandSectionRanges,
  resolveCondCitedProvisionNames,
  repairProvisionTextBoundariesFromSections,
  normalizeAntitrustRegulatoryFeatures,
  backfillSectionLeftovers,
  monthsBetweenRounded,
  computeOutsideDateMonths,
  classifyIocRestrictionComponents,
  stampIocRestrictionComponents,
  // EXT-1 / EXT-3 — exposed for testing
  strategyB,
  strategyD,
  locateProvisionStartChar,
  // Span accounting Part 2 — exposed for testing: the Strategy A/C hook and
  // the flag resolution that decides whether it runs at all.
  attachStrategySpanClaims,
  resolveSpanClaimsOpts,
};
