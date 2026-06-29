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
  MATERIAL_CONTRACT_BUCKET_CODES,
  REMEDY_TYPES,
  KNOWLEDGE_STANDARDS,
  SEC_FILING_EXCLUSION_CODES,
  formatDict,
  taxonomyForFeatureKey,
  isListTaxonomyKey,
  LIST_TAXONOMY_KEYS,
} = require('../taxonomy');

// Provision types whose shared/section-wide features should ONLY be extracted
// on a "General / Preamble" sub-clause; per-clause sub-clauses should NOT
// re-extract these.
const SCOPED_FEATURE_TYPES = new Set(['IOC', 'REP-T', 'REP-B']);

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const { MODEL } = require('../model');
const MAX_CONCURRENT = 6;

/** Types handled by Strategy A (regex split → AI classify). */
const STRATEGY_A_TYPES = new Set([
  'IOC', 'IOC-T', 'IOC-B',
  'COND-M', 'COND-B', 'COND-S', 'COND',
  'TERMR', 'TERMR-M', 'TERMR-B', 'TERMR-T',
]);

/** Types handled by Strategy B (multi-code, overlapping spans). */
const STRATEGY_B_TYPES = new Set(['NOSOL', 'ANTI', 'TERMF']);

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
// JSON parse helper — tolerant of markdown fences
// ---------------------------------------------------------------------------

function parseJSON(raw) {
  const clean = raw.replace(/```json\s*/g, '').replace(/```/g, '').trim();
  try {
    return JSON.parse(clean);
  } catch (err) {
    // Diagnostic: log raw length + first/last chars so truncation is visible
    // in Vercel logs without leaking the whole response.
    const tail = clean.slice(-200);
    console.warn(
      `[parser-v2/extract] JSON parse failed (raw length=${clean.length}, last 200 chars: ${JSON.stringify(tail)})`
    );
    throw err;
  }
}

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
 * feature schema (with `linkedBringDownStandard` always allowed, since it is
 * stamped by post-processing rather than the per-code schema).
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
  // Always allow linkedBringDownStandard (set by linkBringDownToReps post-pass)
  allowed.add('linkedBringDownStandard');
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
  // whether the section is a generic Other Covenant or the heavily-negotiated
  // COV-EMPLOYEE (Employee Matters). Merge the COV-EMPLOYEE schema fields onto
  // the generic COV feature list so the AI sees every field it might need to
  // populate. The typeSpecific block below explains when each field applies,
  // and post-processing in strategyC filters down to the actual code's schema.
  if (typeKey === 'COV') {
    const empFeats = FEATURES['COV-EMPLOYEE'] || [];
    if (empFeats.length > 0) {
      const seenKeys = new Set(feats.map((f) => f.key));
      const merged = feats.slice();
      for (const f of empFeats) {
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
  if (!feats || feats.length === 0) return '';

  // Track which taxonomy dictionaries are referenced by features on this
  // provision type so we can append the codebook(s) once at the end.
  const usedTaxonomies = new Map(); // dict-name → dict object

  // Track whether any citable fields are in scope so we can add the global
  // citation rule once at the top of the prompt.
  let anyCitable = false;

  const lines = feats.map((f) => {
    let desc = `- ${f.key}: `;
    const taxonomy = taxonomyForFeatureKey(f.key);
    const taxonomyIsList = isListTaxonomyKey(f.key);
    // Citable wraps bare booleans / enums / numbers in { value, text }.
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
      // Citable bare-type fields: wrap the natural type in { value, text }
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
      desc += `object { value: ${inner}, text: "<verbatim 1-2 sentence quote from the agreement>" }, or null`;
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
        case 'text':
          desc += 'free text string, or null';
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
      else dictName = 'TAXONOMY_CODES';
      usedTaxonomies.set(dictName, taxonomy);
      desc += ` [map each ${taxonomyIsList ? 'item' : 'value'} to a code from ${dictName}]`;
    }
    return desc;
  });

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
- "scheduleReference" captures any section-wide disclosure-schedule cite (e.g. "Except as set forth in Section 4.1 of the Company Disclosure Letter").
- "permittedExceptions" — the IOC preamble almost always lists 3-5 SECTION-WIDE carve-outs in a single "Except as ... or with ..." framing. Extract EACH ONE as a tagged item { code, label, text } drawn from EXCEPTION_CODES. Look explicitly for these standard carve-outs (omit any that aren't actually present):
    * COMPANY_DISCLOSURE_LETTER — the "as disclosed" carve-out. Captures the
      COMPOSITE phrase "Except as set forth in Section X.YZ of the Company
      Disclosure Letter OR otherwise expressly required by this Agreement" as
      a SINGLE item. CRITICAL: when the agreement uses this composite phrasing
      (Disclosure-Letter half AND Agreement-required half joined by "or
      otherwise" / "or as required by"), emit ONE item with code
      COMPANY_DISCLOSURE_LETTER and "text" covering BOTH halves verbatim.
      DO NOT split into two separate items in that case.
    * REQUIRED_BY_AGREEMENT — emit this ONLY when the "expressly required (or
      contemplated) by this Agreement" carve-out appears WITHOUT the
      Disclosure-Letter framing (rare). When it appears together with the
      Disclosure-Letter cite, use COMPANY_DISCLOSURE_LETTER (above) instead.
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

- "positiveObligations" — CRITICAL. The IOC preamble bundles multiple AFFIRMATIVE duties (the "limbs") into one paragraph — these are the positive obligations Target undertakes during the interim period. Extract EACH distinct limb as its OWN object. Do NOT merge them into one summary.

  Each limb is an object: { "obligation": "<short verbatim or near-verbatim phrase>", "materialityQualifier": "<IOC_AFFIRMATIVE_STANDARDS code>", "efforts_standard": "<EFFORTS_STANDARDS code, or null>", "appliesTo": ["<IOC_AFFIRMATIVE_SCOPE code>", ...] }

  Typical limbs to look for (omit any not present):
    * "Maintain business" / "conduct business in the ordinary course in all material respects"
        — materialityQualifier: MATERIAL_RESPECTS, efforts_standard: null,
          appliesTo: ["BUSINESS_ORGANIZATION", "ASSETS"]
    * "Preserve business organization / retain key employees"
        — materialityQualifier: FLAT (no qualifier),
          efforts_standard: REASONABLE_BEST_EFFORTS or COMMERCIALLY_REASONABLE_EFFORTS,
          appliesTo: ["BUSINESS_ORGANIZATION", "OFFICERS_KEY_EMPLOYEES"]
    * "Preservation of business relationships"
        — materialityQualifier: FLAT, efforts_standard: as written,
          appliesTo: list each relationship as its OWN code — e.g.
          ["CUSTOMERS", "SUPPLIERS", "EMPLOYEES", "GOVERNMENTAL_ENTITIES",
           "LICENSORS_LICENSEES", "COLLABORATORS"]
    * "Ordinary course obligation" / "conduct business only in the ordinary course"
        — materialityQualifier: ORDINARY_COURSE (the canonical "Flat ordinary
          course" reading), efforts_standard: null, appliesTo: ["BUSINESS"]

  RULES:
  1. materialityQualifier MUST be picked from IOC_AFFIRMATIVE_STANDARDS:
     FLAT (no qualifier), MATERIAL ("in any material way"), MATERIAL_RESPECTS
     ("in all material respects"), REASONABLE_BEST_EFFORTS,
     COMMERCIALLY_REASONABLE_EFFORTS, BEST_EFFORTS, ORDINARY_COURSE. NEVER
     leave the obligation unqualified-but-empty — emit FLAT explicitly. The UI
     renders FLAT as a canonical "Flat" pill so cross-deal comparison works.
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
- MONETARY THRESHOLD RULE: when a sub-clause's exception is FUNDAMENTALLY a dollar threshold (e.g. "except for capital expenditures of less than $2,000,000 individually or $2,500,000 in the aggregate", "except for settlements of legal proceedings that require payment in an amount less than $250,000 individually or $2,000,000 in the aggregate"), DO NOT tag this exception as OTHER. Tag it MONETARY_THRESHOLD and ADDITIONALLY emit a "thresholdIndividual" (currency) and "thresholdAggregate" (currency) field ON THE EXCEPTION ITEM (alongside code / label / text). Example shape: { "code": "MONETARY_THRESHOLD", "label": "Below monetary threshold", "text": "less than $250,000 individually or $2,000,000 in the aggregate", "thresholdIndividual": 250000, "thresholdAggregate": 2000000 }. Numbers are unitless USD integers — drop the dollar sign and any commas. If only one of the two is stated, populate just that one. Currency assumed USD unless the agreement specifies otherwise (add a "currency" field with the ISO code in that case).
- BUDGET EXCEPTION RULE: when a sub-clause carves out actions taken "in accordance with the [Capital Expenditure] Budget" / "consistent with the budget" / "set forth on Schedule X (Capex Budget)", tag the exception BUDGET_EXCEPTION with text capturing the verbatim phrase plus the schedule reference (if any).
- The MONETARY_THRESHOLD and BUDGET_EXCEPTION tags BOTH frequently appear together on the same sub-clause (e.g. capex sub-clause permits in-budget capex AND capex below the dollar cap). Emit BOTH exception items in that case.
- "crossReferences" should list other explicit section/article references (e.g. "Section 5.1(a)", "Schedule 4.02").
- Do NOT extract the section-wide carve-outs (requiredByLawCarveout, pandemicCarveout, ordinaryCourseCarveout, materialityQualifier, scheduleReference) on this sub-clause — those live on the preamble.

AFFIRMATIVE-CHAPEAU RULE (applies ONLY when this sub-clause is the AFFIRMATIVE-COVENANTS lead-in — typically clause "(a)" reading something like "the Company shall ... use commercially reasonable efforts to: (i) conduct its business in the ordinary course ... and (ii) preserve intact its material assets, business organization and relations with ..."):
- Set this sub-clause's code to IOC-POSITIVE-PREAMBLE (it is the affirmative chapeau, not a single negative restriction).
- Populate a "positiveObligations" array — ONE object per distinct affirmative limb. Do NOT collapse the limbs into one. Each object has this shape:
    { "obligation": "<short verbatim phrase of the limb, e.g. 'conduct its business in the ordinary course of business'>", "materialityQualifier": "<one of FLAT | MATERIAL | MATERIAL_RESPECTS | ORDINARY_COURSE>", "efforts_standard": "<one of COMMERCIALLY_REASONABLE_EFFORTS | REASONABLE_BEST_EFFORTS | BEST_EFFORTS | null>", "appliesTo": ["<scope codes: BUSINESS, BUSINESS_ORGANIZATION, ASSETS, EMPLOYEES, CUSTOMERS, SUPPLIERS, LICENSORS_LICENSEES, GOVERNMENTAL_ENTITIES, OTHER_RELATIONSHIPS>"] }
  Typical Landos-style chapeau yields TWO limbs: (i) "conduct its business in the ordinary course" (efforts_standard COMMERCIALLY_REASONABLE_EFFORTS, materialityQualifier ORDINARY_COURSE, appliesTo ["BUSINESS"]); (ii) "preserve intact its material assets, business organization and relations with employees, customers, suppliers, licensors, licensees, Governmental Bodies" (efforts_standard COMMERCIALLY_REASONABLE_EFFORTS, materialityQualifier MATERIAL_RESPECTS, appliesTo ["ASSETS","BUSINESS_ORGANIZATION","EMPLOYEES","CUSTOMERS","SUPPLIERS","LICENSORS_LICENSEES","GOVERNMENTAL_ENTITIES"]).
- Capture any proviso on the chapeau (e.g. "provided that no action ... with respect to matters specifically addressed by any provision of Section 5.2(b) shall be deemed a breach ...") verbatim into a "chapeauProviso" text field.
`;
    } else {
      typeSpecific = `
CRITICAL FEATURE EXTRACTION RULES for IOC:
- "permittedExceptions" is ONLY for text that genuinely begins with one of these markers in the source: "except", "other than", "provided that", "provided, however, that", or "notwithstanding". Do NOT list every sub-clause as an exception. If there are no such carve-outs in the provision, return an empty array []. Each item MUST be a tagged object { code, label, text } where code is drawn from EXCEPTION_CODES (use "OTHER" if no listed code fits).
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
- "noticePeriod" / "matchingPeriod" / "goShopWindow" are numeric durations.

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

PER-CODE FEATURE FIELDS — once you pick a code for a provision, ONLY extract the fields listed for that code below. Leave irrelevant fields out of the features object:
${codeMenu}

Field semantics:
- "mainConcept" is a one-sentence summary of THIS specific provision.

- "effortsStandard" — return ONLY the canonical short efforts label. Emit a TAGGED object { code, label, text } drawn from EFFORTS_STANDARDS, where:
    * "code" is the EFFORTS_STANDARDS code (e.g. REASONABLE_BEST_EFFORTS).
    * "label" is the canonical short label from the dictionary (e.g. "Reasonable best efforts").
    * "text" is JUST the quoted standard phrase from the agreement (e.g. "reasonable best efforts"), NOT the surrounding obligation language.
  Return only the canonical efforts code and the short quoted phrase, not the surrounding obligation language (do NOT include "Each of the parties shall use ... to consummate ..." framing). If no efforts standard is stated, return null.

- "filingDeadline" (ANTI-FILING) — short text describing the deadline for making HSR / regulatory filings, e.g. "Within 15 business days of signing" or "Within 30 days of signing". Do NOT return the entire filing paragraph — only the deadline statement. For ANTI-FILING, "mainConcept" should ALSO be the short deadline statement (e.g. "HSR filing within 15 business days of signing"), not the whole filing obligation text.

- "appliesToParty" (ANTI-NOACTION) — identify which party the no-inconsistent-action prohibition applies to. Return a TAGGED object { code, label, text } drawn from APPLIES_TO_PARTY:
    * PARTY_PARENT — the prohibition binds Parent / Buyer only.
    * PARTY_COMPANY — the prohibition binds the Company / Target only.
    * PARTY_MUTUAL — the prohibition is mutual (binds both parties).
  Look for textual cues: "Parent shall not", "the Company shall not", "Neither party shall", "Each party shall not", etc. The "text" field MUST be the verbatim phrase that identifies the bound party. When the provision's code is ANTI-NOACTION (or its category text contains "no inconsistent action" / "no impediment"), you MUST populate appliesToParty — identify which party this prohibition applies to: Parent/Buyer, Company/Target, or both.

- "hellOrHighWater" (ANTI-BURDEN) — true ONLY if there is NO cap on required divestitures or remedies.
- "divestitureCap" / "divestitureCapDescription" / "burdenCap" (ANTI-BURDEN) — any dollar/revenue cap, qualitative limit, or carve-out on required remedies. "burdenCap" captures qualitative limits (e.g. "not materially adverse to the business of Parent and its Subsidiaries, taken as a whole"); "divestitureCap" captures numeric caps.
- "litigationObligation" — whether the parties must / may / may not / are silent on litigating against regulators.

- "controllingParty" (ANTI-COOPERATE) — examine the text for language like "Parent shall direct", "Parent shall control", "subject to the direction of Parent", "Company shall direct", or "jointly determine". If the agreement assigns control to Parent/Buyer, return CONTROL_PARENT with the exact text. If to Company/Target, CONTROL_COMPANY. If shared/joint, CONTROL_SHARED. If the cooperation provisions do not specify who controls strategy, return CONTROL_SILENT — this is meaningful information for cross-deal comparison. Return a TAGGED object { code, label, text } drawn from ANTITRUST_CONTROL, where "text" is the verbatim phrase that identifies the controlling party (or null when CONTROL_SILENT).

STAGE-1 FIELDS (extract when supported by text — leave null otherwise):
- regulatoryStrategyControl (enum PARENT_CONTROL/COMPANY_CONTROL/JOINT/NA): Same concept as controllingParty in enum form — populate based on who directs strategy.
- hsrFilingDeadlineBusinessDays (number): HSR filing deadline in BUSINESS days ("within ten (10) Business Days following the date of this Agreement" → 10).
- otherRegulatoryFilingDeadlines (text): Non-HSR filing deadlines (CFIUS, EU merger control, China SAMR, etc.) — short verbatim list.
- substantialComplianceDeadlineDays (number): Days within which to certify substantial compliance with a Second Request.
- pullAndRefileCompanyConsent (boolean): true if Parent must obtain Company consent to pull-and-refile its HSR.
- refileCapWithoutConsent (number): Maximum number of refilings Parent may make without Company consent.
- timingAgreementsProhibited (boolean): true if the agreement bars entering timing agreements with regulators without Company consent.
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
  * substantialComplianceDeadlineDays — search for "substantial compliance" + day-count.
  * clearSkiesCompany + clearSkiesCompanyScope — search for "no significant antitrust", "no Burdensome Condition would reasonably be expected".
  * clearSkiesParent + clearSkiesParentScope — same on the Parent side.
  * parentLitigationObligation — search for "shall contest", "shall defend", "litigate".
  * burdensomeConditionPresent + burdensomeConditionScope — flag a "Burdensome Condition" trigger / closing condition; scope = PARENT_ONLY / MUTUAL / NA.
  * regulatoryClosingConditions — list jurisdictions (HSR, CMA, EC, CFIUS, SAMR, etc.).
  * springingRegulatoryConditions — only-if-triggered conditions.

VERBATIM ANCHOR PHRASES — if you see X, you MUST emit Y. Don't leave the field null when an anchor phrase is present:
  * "pull and refile" / "withdraw and refile" PAIRED WITH "consent of the other party" / "consent of the Company"
    → pullAndRefileCompanyConsent = TRUE. Example: "the parties agree not to ... pull and refile any filing made under the HSR Act ... except with the prior written consent of the other party".
  * "agree not to extend ... any waiting period" / "enter into any agreement with a Governmental Entity to delay" / "agreement with a Governmental Entity ... not to consummate"
    → timingAgreementsProhibited = TRUE. Example: "the parties agree not to (A) extend, directly or indirectly, any waiting period under the HSR Act ... or enter into any agreement with a Governmental Entity to delay ... or (B) pull and refile".
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
    { "amount": "$XXX million", "percentage_of_equity": "X.X%", "triggers": ["specific trigger 1", "specific trigger 2"], "payment_deadline": "within X business days of termination" }
- "reverseTerminationFee" (TERMF-REVERSE) — fee payable BY the buyer/parent:
    { "amount": "$XXX million", "percentage_of_equity": "X.X%", "triggers": ["specific trigger 1"], "payment_deadline": "within X business days of termination" }
- "expenseReimbursement" (TERMF-EXPENSE) — expense reimbursement cap and triggers:
    { "amount_cap": "$XX million", "triggers": ["specific trigger 1"] }
- "tailProvision" (TERMF-TAIL) — subsequent-transaction fee window:
    { "period_months": 12, "threshold_percentage": "20%", "triggers": ["acquisition proposal received during tail period"] }
- "effectOfTermination" (TERMF-EFFECT) — short text describing post-termination consequences (e.g. "Agreement becomes void except for confidentiality and expense provisions").
- "soleAndExclusiveRemedy" (TERMF-SOLE) — true if the fee is the sole and exclusive remedy.
- "interestOnLatePayment" (TERMF-TARGET / TERMF-REVERSE) — only when explicitly stated:
    { "rate": "prime + 2%", "base": "the unpaid fee" }

Common rules:
- "mainConcept" is a one-sentence summary of THAT specific fee provision.
- "triggers" inside each object MUST be a list of plain-English trigger phrases (e.g. "Target enters definitive agreement with third party", "Stockholders fail to approve and competing proposal pending"). Do NOT roll up triggers across different fee types.
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
- triggers (list of objects): The Trigger Matrix — one entry per canonical trigger present. Shape: { name, terminationClauses (list of section refs), feeAmount, feeAmountPct }. Canonical triggers: "Naked No-Vote", "Recommendation Change (Parent terminates)", "Company Termination for Superior Proposal", "Tail Fee", "Antitrust RTF".

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
- absenceOfChangesType (enum SPECIFIED_IOCS/GENERAL_ORDINARY_COURSE/HYBRID, clause): On Absence-of-Changes reps, classify the rep's structure:
    * GENERAL_ORDINARY_COURSE — renders as "General operating covenant". A single ordinary-course-of-business statement ("the Company has conducted its business only in the ordinary course consistent with past practice") with no enumerated list.
    * SPECIFIED_IOCS — renders as "Specific IOCs". The rep enumerates a list of specific restricted actions / changes (look for sub-clauses (i), (ii), (iii) listing concrete prohibited or to-be-disclosed acts: amendments to charter, dividends, equity issuances, material acquisitions, etc.).
    * HYBRID — renders as "Hybrid (General operating covenant and specific IOCs cited)". Both an ordinary-course statement AND an enumerated list. Pick the MOST specific code.
- absenceOfChangesExceptions (list-tagged, clause): On Absence-of-Changes reps, extract each enumerated sub-clause (the specific changes/actions the rep calls out) as one tagged item. Examples: "any amendment to its certificate of incorporation", "any declaration, setting aside, or payment of any dividend", "any material change in accounting methods", "any incurrence of Indebtedness". Use the verbatim sub-clause text. REQUIRED when the rep type is SPECIFIED_IOCS or HYBRID. When the rep is GENERAL_ORDINARY_COURSE with no enumerated exceptions, return []. The UI will render that as canonical "None" — do NOT omit the field.
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

PAIRING RULE: Never set a *Present boolean true without filling the companion *Details / *Text / *Definition / *Language / *Scope field, and vice versa.
`;
  } else if (typeKey === 'STRUCT') {
    // Per fix #6: STRUCT extraction is intentionally minimal — lawyers compare
    // ONLY the merger form, closing location, and closing timing across deals.
    // Surviving entity and closing-conditions-precedent are NOT extracted.
    const structCodes = ['STRUCT-MERGER', 'STRUCT-CLOSING'];
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

PAIRING RULE: Never set parentAssignmentRight=true without filling parentAssignmentConditions; never set companyRightToForceClose=true without filling companyForceCloseConditions; never set repsSurvivalPresent=true without filling repsSurvivalDuration.
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
  // field is in scope. Reminds the AI that any { value, text } object MUST
  // carry the verbatim quote that supports the value. Companion *Scope /
  // *Details / *Conditions fields remain SEPARATE — they describe the
  // obligation; "text" inside { value, text } is the EVIDENCE QUOTE.
  const citationRule = anyCitable
    ? `\nCITATION RULE: For any field whose type is described as "object { value, quotes }", ALWAYS include the verbatim quote(s) that support the value in the "quotes" array. Copy the agreement text directly — do NOT paraphrase. Each entry should be one or two sentences. Use multiple entries when distinct passages (in different sentences/clauses) jointly support the value. The "quotes" array inside { value, quotes } carries the EVIDENCE QUOTES that prove the value; any companion *Scope / *Details / *Conditions / *Language field describes the OBLIGATION and is separate (do not duplicate). LEGACY (still accepted): { value, text: "..." } with a single quote — prefer the multi-quote form going forward. If you cannot find a supporting quote, set the entire field to null instead of emitting an empty quotes array.\n`
    : '';

  // CRITICAL response-size rule: omit absent fields entirely instead of
  // emitting { value: null, text: "" } or null per key. Without this the
  // AI bloats responses with empty entries for every schema key, which
  // pushes us past max_tokens on long sections and forces a fallback to
  // one provision per section.
  const omitAbsentRule = `\nRESPONSE-SIZE RULE: OMIT any feature key whose value would be null / empty / false / not-stated entirely from the "features" object. Do NOT emit empty placeholders. Smaller responses are better — only include fields you actually populate from the source text.\n`;

  return `\nExtract these features for each provision (return them in a "features" object on each result):\n${citationRule}${omitAbsentRule}${lines.join('\n')}\n${globalBrevity}${typeSpecific}${taxonomyBlock}\n`;
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
    re: /(?:(?:use\s+(?:its\s+)?(?:commercially\s+reasonable|reasonable\s+best|reasonable|best)\s+efforts\s+to\s+)?preserve\s+(?:its\s+)?(?:present\s+)?relationships[^.]{0,400}?(?=(?:\s+and\s+maintain\b|\.|;\s+and\b|$)))/i,
  },
  {
    key: 'IOC-MAINTAIN',
    category: 'Maintain Business Organization',
    label: 'Maintain material assets and business organization intact in all material respects',
    // "maintain its material assets and business organization intact ..."
    re: /(?:maintain\s+(?:its\s+)?(?:material\s+assets\s+and\s+)?business\s+organization[^.]{0,200}?(?:intact|in\s+(?:all\s+)?material\s+respects)[^.]{0,120})/i,
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
    if (/\b(?:shall|will|agrees? to|must)\b[^.]{20,}/i.test(scanText)) {
      // Extract the trailing "shall ..." clause(s)
      const otherMatch = scanText.match(/(?:shall|will|agrees? to|must)[^.]+\.?/i);
      if (otherMatch) {
        otherText = otherMatch[0].trim();
      }
    }
  }

  return {
    obligations: obligationParts.map((p) => ({
      key: p.key,
      category: p.category,
      label: p.label,
      text: p.text,
    })),
    other: otherText
      ? {
          key: 'IOC-OTHER-AFFIRMATIVE',
          category: 'Other Affirmative Obligations',
          label: 'Other affirmative obligations in the IOC preamble (catch-all)',
          text: otherText,
        }
      : null,
    sharedCarveOuts: residual,
    // Consolidated view: one "Affirmative Covenants" object holding all the
    // limbs as structured features, and one "General Exceptions" object
    // holding the section-wide carve-outs. The legacy `obligations` array
    // above is preserved for backward compat but the caller should prefer
    // this consolidated shape.
    consolidated: {
      affirmativeCovenants: {
        key: 'IOC-AFFIRMATIVE',
        category: 'Affirmative Covenants',
        label: 'Affirmative covenants in the IOC preamble',
        // The full text of the preamble's affirmative section
        text: obligationParts.map((p) => p.text).join(' ').trim()
          + (otherText ? ' ' + otherText : ''),
        // Each limb separately for the structured features panel
        limbs: obligationParts.map((p) => ({
          obligation_code: p.key,
          obligation_label: p.label,
          text: p.text,
        })).concat(otherText
          ? [{ obligation_code: 'IOC-OTHER-AFFIRMATIVE',
               obligation_label: 'Other affirmative obligation',
               text: otherText }]
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
      // P7 item 10: surface the negative-preamble bucket so the caller can
      // emit it as its OWN provision (IOC-NEGATIVE-PREAMBLE). The split
      // boundary is detected via findNegativePreambleStart.
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
  const skipRoman = isCondType || isTermrType;
  const clausePattern = /(?:^|\n)\s*\(([a-z]+)\)\s/g;
  const matches = [];
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
    matches.push({ index: parenPos, letter: m[1] });
  }

  // Also catch inline sub-clauses after sentence boundaries
  const inlinePattern = /\.\s+\(([a-z]+)\)\s/g;
  while ((m = inlinePattern.exec(sectionText)) !== null) {
    if (skipRoman && romanNumerals.has(m[1])) continue;
    const pos = m.index + m[0].indexOf('(');
    if (matches.some((x) => Math.abs(x.index - pos) < 5)) continue;
    matches.push({ index: pos, letter: m[1] });
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
    /[“"]([^”"\n]{1,80})[”"][^“"\n.;]{0,40}?\b(means?|shall\s+mean|has\s+the\s+meaning|shall\s+have\s+the\s+meaning)\b/g;
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

    // Capture the sentence ENDING at the parenthetical plus a little after.
    const lookBack = Math.max(0, pm2.index - 600);
    const back = sectionText.substring(lookBack, pm2.index);
    let sentStart = lookBack;
    const re2 = /[.;]\s+(?=[A-Z(])/g;
    let r;
    let lastIdx = -1;
    while ((r = re2.exec(back)) !== null) lastIdx = r.index + r[0].length;
    if (lastIdx >= 0) sentStart = lookBack + lastIdx;
    const end = Math.min(sectionText.length, pm2.index + 400);
    const text = sectionText.substring(sentStart, end).trim();
    if (text.length < 20) continue;

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

  return found;
}

// ---------------------------------------------------------------------------
// Strategy A: Regex-split a section into sub-clauses → batch AI-classify each.
// Routed types (STRATEGY_A_TYPES): IOC, COND, COND-M/B/S, TERMR, TERMR-M/B/T.
// REP-T/REP-B do NOT route here — they use Strategy C (one provision per rep
// section), because splitting a rep into sub-clauses would break the
// one-row-per-rep table. Enumerated reps (Material Contracts etc.) keep their
// (i)-(xxi) list whole and capture it as features in Strategy C.
// ---------------------------------------------------------------------------

async function strategyA(sections, client) {
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
      const parts = splitSubClauses(section.text, lookupType);
      if (parts) {
        for (const part of parts) {
          allSubClauses.push({
            text: part.text,
            letter: part.letter,
            startChar: section.startChar,
            sectionIdx: typeSections.indexOf(section),
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
            features: {},
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
            features: {},
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
        const preambleCode =
          typeKey === 'REP-T' ? 'REP-T-PREAMBLE'
          : typeKey === 'REP-B' ? 'REP-B-PREAMBLE'
          : null;
        const generalProv = makeProvision({
          type: typeKey,
          code: preambleCode,
          category: 'General / Preamble',
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

        provisions.push(makeProvision({
          type: effectiveType,
          code: isValidCode(code) ? code : null,
          category: codeEntry ? codeEntry.label : (aiResult.category || 'Unclassified'),
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
      // Fallback: emit each sub-clause as unclassified
      for (const sc of classifiable) {
        provisions.push(makeProvision({
          type: typeKey,
          code: null,
          category: 'Unclassified',
          text: sc.text,
          startChar: sc.startChar,
          relatedDefinitions: findRelatedDefinitions(sc.text),
          _error: err.message,
        }));
      }
    }
  });

  await runWithConcurrency(tasks, MAX_CONCURRENT);
  return provisions;
}

// ---------------------------------------------------------------------------
// Strategy B: AI multi-code extraction (NOSOL, ANTI)
// ---------------------------------------------------------------------------

async function strategyB(sections, client) {
  const provisions = [];

  // Group by type
  const byType = {};
  for (const s of sections) {
    const key = s.provision_type;
    if (!byType[key]) byType[key] = [];
    byType[key].push(s);
  }

  const tasks = Object.entries(byType).map(([typeKey, typeSections]) => async () => {
    const codesList = buildCodesList(typeKey);
    const featureInstructions = buildFeatureInstructions(typeKey);

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
   at least one provision's "text" field.
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
      "text": "exact verbatim excerpt...",
      "favorability": "neutral",
      "features": { /* schema fields populated */ },
      "isNewCode": false,
      "proposedCode": null,
      "proposedLabel": null
    }
  ]
}

Only include provisions that are actually present. Do NOT include provisions where present=false.`;

    for (const chunkSections of sectionChunks) {
    const combined0 = chunkSections.map((s) => s.text).join('\n\n---\n\n');
    const combinedText = combined0.length > SINGLE_SECTION_CAP ? combined0.substring(0, SINGLE_SECTION_CAP) : combined0;
    const startChar = chunkSections[0].startChar;
    const prompt = buildMultiCodePrompt(combinedText);
    try {
      const resp = await client.messages.create({
        model: MODEL,
        max_tokens: 16000,
        messages: [{ role: 'user', content: prompt }],
      });

      const raw = resp.content.map((c) => c.text || '').join('');
      const parsed = parseJSON(raw);

      for (const p of (parsed.provisions || [])) {
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
          startChar,
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
// Strategy C: Section-level AI — one provision per section, classified +
// feature-extracted in chunked batches.
// Routed types (STRATEGY_C_TYPES): REP-T, REP-B, STRUCT, CONSID, COV, MISC,
// OTHER (and any unknown type). NOT TERMR (→ Strategy A) or TERMF (→ B).
// ---------------------------------------------------------------------------

async function strategyC(sections, client) {
  const provisions = [];

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
        const code = aiResult.code || null;
        const codeEntry = code ? CODES[code] : null;

        // Carry the source section number into features so downstream
        // post-processing (linkBringDownToReps) can match REP provisions
        // to bring-down tiers cited by section number.
        let features = aiResult.features || {};
        const sectionNumber = section.number || section.sectionNumber || null;
        if (sectionNumber && !features.sectionNumber) {
          features.sectionNumber = sectionNumber;
        }
        // For STRUCT, OTHER, CONSID-EQUITY, COV-EMPLOYEE filter to the code's
        // specific schema so we don't carry irrelevant fields.
        if (isValidCode(code) && (code.startsWith('STRUCT-') || code === 'CONSID-EQUITY' || code === 'COV-EMPLOYEE')) {
          features = filterFeaturesToCodeSchema(features, code);
        }
        // For non-EMPLOYEE COV codes, strip the EMPLOYEE-only fields that may
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
          relatedDefinitions: findRelatedDefinitions(s.text),
          _error: err.message,
        }));
      }
    }
  });

  await runWithConcurrency(tasks, MAX_CONCURRENT);
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
  const aliasProvisions = provisions.filter(
    (p) => p.type === 'DEF' && p.code && Object.keys(p.features).length === 0
      && p.category !== 'General / Preamble'
  );

  if (aliasProvisions.length > 0) {
    const featureInstructions = buildFeatureInstructions('DEF');
    if (featureInstructions) {
      const featurePayload = aliasProvisions.map((p, idx) => ({
        idx,
        code: p.code,
        text: p.text.length > 2000 ? p.text.substring(0, 2000) : p.text,
      }));

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
            aliasProvisions[r.idx].features = r.features || {};
            if (r.favorability) {
              aliasProvisions[r.idx].favorability = r.favorability;
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
async function extractProvisionsForType(classifiedSections, type, client, fullCleanedText) {
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
    provisions = filtered.length > 0 ? await strategyA(filtered, client) : [];
  } else if (STRATEGY_B_TYPES.has(type)) {
    provisions = filtered.length > 0 ? await strategyB(filtered, client) : [];
  } else if (STRATEGY_C_TYPES.has(type)) {
    provisions = filtered.length > 0 ? await strategyC(filtered, client) : [];
  } else {
    // Unknown type — fall back to Strategy C
    provisions = filtered.length > 0 ? await strategyC(filtered, client) : [];
  }

  // For CONSID, expand equity instruments per row so the per-type call
  // returns the same shape as the all-types path.
  if (type === 'CONSID') {
    expandConsidEquityByInstrument(provisions);
  }

  // P7 item 23: when a REP-T Financial Statements provision embeds a
  // "no undisclosed liabilities" sub-clause, split that out as its own
  // REP-T-NOLIAB provision so the row appears separately in the rep table.
  if (type === 'REP-T') {
    splitUndisclosedLiabilitiesFromFinStmt(provisions);
  }

  // Clean up internal-only fields
  for (const p of provisions) {
    delete p._error;
  }

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

async function extractProvisions(classifiedSections, client, fullCleanedText) {
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
    stratABucket.length > 0 ? strategyA(stratABucket, client) : [],
    stratBBucket.length > 0 ? strategyB(stratBBucket, client) : [],
    stratCBucket.length > 0 ? strategyC(stratCBucket, client) : [],
    stratDBucket.length > 0 ? strategyD(stratDBucket, client) : [],
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
  const inlineDefProvisions = await extractInlineDefinitionsFromSections(
    classifiedSections,
    allProvisions,
    client,
    fullCleanedText,
  );
  allProvisions.push(...inlineDefProvisions);

  // Post-processing: link definitions to provisions that reference them
  linkDefinitionCrossReferences(allProvisions);

  // Post-processing: write per-rep bring-down standard back onto REP provisions
  // based on the tier definitions captured on COND-B-REP / COND-S-REP.
  linkBringDownToReps(allProvisions);

  // Post-processing: expand each CONSID-EQUITY provision with multiple
  // outstanding instruments into one row per instrument so the UI can
  // display Stock Options / RSUs / ESPP as separate provisions.
  expandConsidEquityByInstrument(allProvisions);

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

  // Stash the reports on the array (consumed by validate.js / API response).
  allProvisions._codeEnforcementReport = enforcementReport;
  allProvisions._codeMergeReport = mergeReport;

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

    const hasCode = prov.code && typeof prov.code === 'string' && prov.code.length > 0;

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
    if (p.code !== 'DEF-MAE') return false;
    const cv = p.features && p.features.carveouts;
    return !(Array.isArray(cv) && cv.length > 0);
  });
  console.warn(`[extract] MAE carve-out pass: ${maeProvs.length} DEF-MAE prov(s) need carveouts`);
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
// Post-processing: bring-down writeback (COND-*-REP tiers → REP provisions)
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

/**
 * Detect catch-all tiers covering the "general" or "remaining" reps.
 * Common phrasings:
 *   - "All other representations" / "All other reps"
 *   - "Remaining representations"
 *   - "General representations" / "General reps"
 *   - "Other representations (other than [list])" — the EXCLUSION pattern
 *     where specific sections are carved out and everything else is the
 *     residual MAE-qualified tier.
 */
function isCatchAllRepsCovered(text) {
  if (!text || typeof text !== 'string') return false;
  // Pattern A: explicit "all other" / "remaining" / "any other" phrasing
  if (/\b(all\s+other|remaining|any\s+other|all\s+remaining)\b.*\b(rep(resentation)?s?|warranties)\b/i.test(text)) {
    return true;
  }
  // Pattern B: "general representations" / "general reps"
  if (/\bgeneral\s+rep(resentation)?s?\b/i.test(text)) {
    return true;
  }
  // Pattern C: exclusion pattern — "Sections X (other than Y)" indicates
  // a residual tier carving specific sections out.
  if (/\(other\s+than\b/i.test(text) && /\b(rep|representation|section)/i.test(text)) {
    return true;
  }
  return false;
}

/**
 * Pull a section number out of a REP provision. Looks first at
 * features.crossReferences (array of strings or tagged items), then at the
 * leading "SECTION X.XX" pattern in the provision text. Returns the first
 * normalized section key found (e.g. "3.01", "3.05(a)"), or null.
 */
function extractRepSectionNumber(provision) {
  // 0. Highest priority: features.sectionNumber, populated from the parsed
  //    section's metadata when the provision was extracted. This is the
  //    most reliable source.
  if (provision && provision.features && provision.features.sectionNumber) {
    const sn = String(provision.features.sectionNumber).trim();
    const m0 = /^(?:Section\s+)?(\d+\.\d{1,2}(?:\([a-z\d]+\))?)/i.exec(sn);
    if (m0 && m0[1]) return m0[1];
    // Sometimes sectionNumber comes through as just digits ("3" / "III") —
    // skip that since it isn't granular enough to match a tier.
  }

  const candidates = [];

  // 1. features.crossReferences may contain strings like "Section 3.6 of the
  //    Company Disclosure Letter" or tagged items.
  const xrefs = provision && provision.features && provision.features.crossReferences;
  if (Array.isArray(xrefs)) {
    for (const x of xrefs) {
      if (typeof x === 'string') candidates.push(x);
      else if (x && typeof x === 'object') {
        if (typeof x.text === 'string') candidates.push(x.text);
        if (typeof x.label === 'string') candidates.push(x.label);
      }
    }
  }

  // 2. features.scheduleReference often quotes "Section 3.06 of the Company
  //    Disclosure Letter" — same section number as the rep itself.
  if (provision && provision.features && typeof provision.features.scheduleReference === 'string') {
    candidates.push(provision.features.scheduleReference);
  }

  // 3. Leading "SECTION X.XX" in provision text. Pull the first few hundred
  //    chars so we don't accidentally grab a later cross-reference.
  if (provision && typeof provision.text === 'string') {
    const head = provision.text.substring(0, 400);
    candidates.push(head);
  }

  // 4. The provision's category / title / heading frequently begins with
  //    "Section 3.05" or "3.05 Authority", so check those too.
  if (provision && provision.features) {
    if (typeof provision.features.sectionTitle === 'string') {
      candidates.push(provision.features.sectionTitle);
    }
  }
  for (const k of ['category', 'title', 'heading']) {
    if (provision && typeof provision[k] === 'string') {
      candidates.push(provision[k]);
    }
  }

  const re = /(?:Section\s+)?(\d+\.\d{1,2}(?:\([a-z\d]+\))?)/i;
  for (const c of candidates) {
    const m = re.exec(c);
    if (m && m[1]) return m[1];
  }
  return null;
}

/**
 * For each COND-B-REP / COND-S-REP provision with `bringDownTiers`, walk each
 * tier, parse `reps_covered` into section numbers (or a catch-all marker), and
 * build a lookup map. Then iterate REP-T (for COND-B-REP) / REP-B (for
 * COND-S-REP) provisions and stamp `features.linkedBringDownStandard` onto
 * each one based on its section number.
 *
 * The COND provisions themselves are NOT mutated.
 */
function linkBringDownToReps(provisions) {
  if (!Array.isArray(provisions) || provisions.length === 0) return;

  // Find COND provisions with bringDownTiers, grouped by which REP family
  // they govern.
  // COND-B-REP → target (REP-T) reps
  // COND-S-REP → buyer  (REP-B) reps
  const condMappings = [
    { condCode: 'COND-B-REP', repType: 'REP-T' },
    { condCode: 'COND-S-REP', repType: 'REP-B' },
  ];

  // Special stamp used when the agreement has NO bring-down condition at all
  // for this REP family.
  const NO_BRING_DOWN_STAMP = {
    code: 'NO_BRING_DOWN',
    label: 'No bring-down condition in agreement',
    tier_index: null,
  };

  // Debug log: how many COND provisions exist for each mapping
  // (helps diagnose why linkedBringDownStandard isn't populated downstream).
  for (const { condCode } of condMappings) {
    const all = provisions.filter((p) => p && p.code === condCode);
    const withTiers = all.filter(
      (p) => p.features && Array.isArray(p.features.bringDownTiers) && p.features.bringDownTiers.length > 0,
    );
    console.log(
      `[linkBringDownToReps] ${condCode}: found ${all.length} provision(s), ${withTiers.length} with bringDownTiers`,
    );
  }

  for (const { condCode, repType } of condMappings) {
    // Gather all COND provisions for this code with bringDownTiers.
    const condProvs = provisions.filter(
      (p) => p && p.code === condCode
        && p.features
        && Array.isArray(p.features.bringDownTiers)
        && p.features.bringDownTiers.length > 0,
    );

    // Build a single section-number → tier map across all COND provisions of
    // this code (in practice there is usually only one). Also capture the
    // catch-all tier as a fallback.
    const sectionMap = new Map(); // section-num → { code, label, tier_index }
    let catchAll = null;
    // Track the LAST tier as a fallback for catch-all — many agreements list
    // the "all other reps" tier last without explicitly saying "all other".
    let lastTier = null;

    for (const cond of condProvs) {
      const tiers = cond.features.bringDownTiers || [];
      tiers.forEach((tier, tierIndex) => {
        if (!tier || typeof tier !== 'object') return;
        const reps = tier.reps_covered || tier.repsCovered || '';
        const stdCode = tier.standard || tier.standardCode || null;
        const stdLabel = tier.standard_label
          || tier.standardLabel
          || (stdCode && MATERIALITY_CODES[stdCode])
          || stdCode
          || null;
        if (!stdCode) return;

        const stamp = { code: stdCode, label: stdLabel, tier_index: tierIndex };
        lastTier = stamp;

        // Catch-all: "All other representations" / "All other reps" /
        // "Remaining representations".
        if (isCatchAllRepsCovered(reps)) {
          if (catchAll === null) catchAll = stamp;
          return;
        }

        // Specific section numbers cited in this tier.
        const sectionNums = parseSectionNumbersFromRepsCovered(reps);
        for (const sn of sectionNums) {
          if (!sectionMap.has(sn)) sectionMap.set(sn, stamp);
        }
      });
    }

    // If no explicit catch-all was found, fall back to MAT_MAE_QUALIFIED as
    // the catch-all — this is the standard for "all other reps" in nearly
    // every M&A bring-down condition. Do NOT use the last tier as catch-all
    // because the last tier might be a highly specific one (e.g. de minimis
    // for capitalization sub-clauses) that should not apply to general reps.
    if (!catchAll) {
      catchAll = {
        code: 'MAT_MAE_QUALIFIED',
        label: MATERIALITY_CODES['MAT_MAE_QUALIFIED'] || 'True except where failure would not have an MAE',
        tier_index: -1, // -1 indicates implicit catch-all, not from a tier
      };
    }

    // Debug log: dump the tiers and catch-all that were built.
    console.log(
      `[linkBringDownToReps] ${condCode} tiers: ${condProvs.reduce(
        (n, c) => n + (c.features.bringDownTiers || []).length,
        0,
      )}, sectionMap size=${sectionMap.size}, catchAll=${catchAll ? catchAll.code : 'none'}`,
    );
    if (sectionMap.size > 0) {
      const preview = Array.from(sectionMap.entries())
        .slice(0, 10)
        .map(([k, v]) => `${k}→${v.code}`)
        .join(', ');
      console.log(`[linkBringDownToReps]   sectionMap entries: ${preview}`);
    }

    // Determine the stamp every unmatched rep should receive. When the deal
    // genuinely has no bring-down condition for this REP family at all,
    // stamp NO_BRING_DOWN so the UI can render an unambiguous indicator
    // rather than leaving the cell empty.
    const fallbackStamp = catchAll || NO_BRING_DOWN_STAMP;

    // Stamp each REP provision of the matching type.
    let stampedCount = 0;
    let catchAllCount = 0;
    let noBringDownCount = 0;
    for (const rep of provisions) {
      if (!rep || rep.type !== repType) continue;
      // Skip preamble / "General" REP entries — they carry shared features only.
      const cat = (rep.category || '').toLowerCase();
      if (cat === 'general / preamble' || cat === 'preamble') continue;
      if (!rep.features || typeof rep.features !== 'object') rep.features = {};

      const repSection = extractRepSectionNumber(rep);
      let stamp = null;

      if (repSection) {
        // Try exact match first (e.g. "3.05(a)"), then bare-number match
        // (e.g. "3.05"), so a tier citing "3.05" still covers "3.05(b)" reps.
        if (sectionMap.has(repSection)) {
          stamp = sectionMap.get(repSection);
        } else {
          const bare = repSection.replace(/\([a-z\d]+\)$/i, '');
          if (bare !== repSection && sectionMap.has(bare)) {
            stamp = sectionMap.get(bare);
          } else {
            // Also try matching this rep's bare section against any tier-cited
            // sub-clause (e.g. tier says "3.05(a)" and rep is "3.05").
            for (const [key, val] of sectionMap.entries()) {
              if (key.replace(/\([a-z\d]+\)$/i, '') === bare) {
                stamp = val;
                break;
              }
            }
          }
        }
      }

      // ALWAYS apply a fallback so every rep gets linkedBringDownStandard.
      if (!stamp) {
        stamp = fallbackStamp;
        if (fallbackStamp === NO_BRING_DOWN_STAMP) noBringDownCount++;
        else catchAllCount++;
        console.log(
          `[linkBringDownToReps]   REP "${rep.category || ''}" — section="${repSection || '(none)'}" → ${stamp.code} (fallback)`,
        );
      } else {
        console.log(
          `[linkBringDownToReps]   REP "${rep.category || ''}" — section="${repSection || '(none)'}" → ${stamp.code} (tier ${stamp.tier_index})`,
        );
      }

      rep.features.linkedBringDownStandard = {
        code: stamp.code,
        label: stamp.label,
        tier_index: stamp.tier_index,
      };
      stampedCount++;
    }

    console.log(
      `[linkBringDownToReps] ${condCode} → ${repType}: stamped ${stampedCount} reps (specific + ${catchAllCount} via catch-all, ${noBringDownCount} via NO_BRING_DOWN)`,
    );
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
        equityAwardTreatment: treatment || f.equityAwardTreatment || null,
        // Per-row vesting overrides the section-wide value so each instrument
        // shows ITS OWN vesting (RSAs fully accelerated vs options conditional).
        vestingAcceleration: vesting || f.vestingAcceleration || null,
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
      if (inWindow || contained) belonging.push(prov);
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
        favorability: 'neutral',
        features: {
          mainConcept: '(Section leftover — text not captured by any provision; backfilled for 100% coverage.)',
          sectionNumber,
          sectionTitle,
          parentProvisionType: parentType,
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

module.exports = {
  extractProvisions,
  extractProvisionsForType,
  expandTypeGroup,
  expandConsidEquityByInstrument,
  sortDefinitionsAlphabetically,
  // Exposed for testing
  splitSubClauses,
  splitDefinitions,
  splitIocPreamble,
  findInlineDefinitions,
  findRelatedDefinitions,
  buildFeatureInstructions,
  buildCodesList,
  linkBringDownToReps,
  parseSectionNumbersFromRepsCovered,
  extractRepSectionNumber,
  filterFeaturesToCodeSchema,
  enforceCanonicalCodes,
  consolidateProposedCodes,
  recordAliasFromAutoMerge,
  normalizeForCodeMatch,
};
