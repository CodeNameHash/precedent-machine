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
} = require('../rubric');

const {
  EXCEPTION_CODES,
  MATERIALITY_CODES,
  CONSENT_STANDARDS,
  EFFORTS_STANDARDS,
  EQUITY_INSTRUMENTS,
  EQUITY_TREATMENT,
  VESTING_STATUS,
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

const MODEL = 'claude-sonnet-4-20250514';
const MAX_CONCURRENT = 6;

/** Types handled by Strategy A (regex split → AI classify). */
const STRATEGY_A_TYPES = new Set([
  'IOC', 'COND-M', 'COND-B', 'COND-S', 'COND',
  'TERMR', 'TERMR-M', 'TERMR-B', 'TERMR-T',
]);

/** Types handled by Strategy B (multi-code, overlapping spans). */
const STRATEGY_B_TYPES = new Set(['NOSOL', 'ANTI']);

/** Types handled by Strategy C (section-level AI). */
const STRATEGY_C_TYPES = new Set([
  'REP-T', 'REP-B', 'STRUCT', 'CONSID', 'COV', 'TERMF', 'MISC',
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
  return JSON.parse(clean);
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

/**
 * Fallback: derive party-specific TERMR type from the partyWhoCanTerminate
 * feature value when the canonical code is missing or unmapped.
 */
function termrPartyFromFeature(features) {
  if (!features) return 'TERMR';
  const v = features.partyWhoCanTerminate;
  if (!v || typeof v !== 'string') return 'TERMR';
  const lc = v.toLowerCase();
  if (lc.includes('mutual') || lc === 'either' || lc.includes('both')) return 'TERMR-M';
  if (lc.includes('buyer') || lc.includes('parent') || lc.includes('acquir')) return 'TERMR-B';
  if (lc.includes('target') || lc.includes('seller') || lc.includes('company')) return 'TERMR-T';
  return 'TERMR';
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

  const lines = feats.map((f) => {
    let desc = `- ${f.key}: `;
    const taxonomy = taxonomyForFeatureKey(f.key);
    const taxonomyIsList = isListTaxonomyKey(f.key);

    if (taxonomy && taxonomyIsList) {
      // Array of tagged objects
      desc += 'array of TAGGED objects { code, label, text }, or empty array []';
    } else if (taxonomy) {
      // Single tagged object (or null)
      desc += 'TAGGED object { code, label, text }, or null';
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
      else if (taxonomy === EQUITY_INSTRUMENTS) dictName = 'EQUITY_INSTRUMENTS';
      else if (taxonomy === EQUITY_TREATMENT) dictName = 'EQUITY_TREATMENT';
      else if (taxonomy === VESTING_STATUS) dictName = 'VESTING_STATUS';
      else dictName = 'TAXONOMY_CODES';
      usedTaxonomies.set(dictName, taxonomy);
      desc += ` [map each ${taxonomyIsList ? 'item' : 'value'} to a code from ${dictName}]`;
    }
    return desc;
  });

  // Type-specific extraction guard rails
  let warnings = '';
  if (typeKey === 'IOC') {
    if (scope === 'preamble') {
      warnings = `
CRITICAL FEATURE EXTRACTION RULES for IOC PREAMBLE (section-wide carve-outs only):
- These features describe rules that apply ACROSS the whole interim-operating-covenants section.
- "requiredByLawCarveout", "pandemicCarveout", "ordinaryCourseCarveout" are TRUE only if the preamble itself states a section-wide carve-out of that flavor (e.g. "Notwithstanding the foregoing, the Company may take any action required by Law...").
- "materialityQualifier" is true only if the preamble qualifies the entire section with a materiality concept (e.g. "Except as would not be material to the Company...").
- "scheduleReference" captures any section-wide disclosure-schedule cite (e.g. "Except as set forth in Section 4.1 of the Company Disclosure Letter").
- Do NOT extract per-sub-clause features (mainObligation, consentStandard, dollarThreshold, permittedExceptions) here — those are extracted on the individual sub-clauses.
`;
    } else if (scope === 'clause') {
      warnings = `
CRITICAL FEATURE EXTRACTION RULES for IOC SUB-CLAUSE (per-restriction features only):
- "mainObligation" should be a one-sentence summary of what THIS sub-clause actually restricts or requires (e.g., "Target cannot incur indebtedness in excess of $25 million without buyer consent").
- "consentStandard" and "effortsStandard" are TAGGED single objects { code, label, text } drawn from CONSENT_STANDARDS / EFFORTS_STANDARDS respectively (or null if absent).
- "permittedExceptions" is ONLY for text that genuinely begins with one of these markers in THIS sub-clause: "except", "other than", "provided that", "provided, however, that", or "notwithstanding". Do NOT include section-wide carve-outs from the preamble. If there are no sub-clause-specific carve-outs, return an empty array []. Each item MUST be a tagged object { code, label, text } where code is drawn from EXCEPTION_CODES (use "OTHER" if no listed code fits).
- "crossReferences" should list other explicit section/article references (e.g. "Section 5.1(a)", "Schedule 4.02").
- Do NOT extract the section-wide carve-outs (requiredByLawCarveout, pandemicCarveout, ordinaryCourseCarveout, materialityQualifier, scheduleReference) on this sub-clause — those live on the preamble.
`;
    } else {
      warnings = `
CRITICAL FEATURE EXTRACTION RULES for IOC:
- "permittedExceptions" is ONLY for text that genuinely begins with one of these markers in the source: "except", "other than", "provided that", "provided, however, that", or "notwithstanding". Do NOT list every sub-clause as an exception. If there are no such carve-outs in the provision, return an empty array []. Each item MUST be a tagged object { code, label, text } where code is drawn from EXCEPTION_CODES (use "OTHER" if no listed code fits).
- "mainObligation" should be a one-sentence summary of what the sub-clause actually restricts or requires (e.g., "Target cannot incur indebtedness in excess of $25 million without buyer consent").
- "consentStandard" and "effortsStandard" are TAGGED single objects { code, label, text } drawn from CONSENT_STANDARDS / EFFORTS_STANDARDS respectively (or null if absent).
- "materialityQualifier" — if a materiality qualifier IS present, return a tagged object { code, label, text } drawn from MATERIALITY_CODES; otherwise null. (Treat the legacy boolean form as superseded.)
- "crossReferences" should list other explicit section/article references (e.g. "Section 5.1(a)", "Schedule 4.02").
`;
    }
  } else if (typeKey === 'TERMR' || typeKey === 'TERMR-M' || typeKey === 'TERMR-B' || typeKey === 'TERMR-T') {
    warnings = `
CRITICAL FEATURE EXTRACTION RULES for ${typeKey}:
- Each sub-clause (a)/(b)/(c)/(d)/etc. of Section 8.01 is ITS OWN termination right and gets its OWN canonical code. Do NOT bundle multiple sub-clauses under one code.
- Map by content: mutual consent → TERMR-MUTUAL; outside-date / drop-dead-date language → TERMR-OUTSIDE; legal-restraint / order / injunction → TERMR-LEGAL; failure to obtain stockholder vote → TERMR-VOTE; target breach uncured → TERMR-BREACH-T; buyer/parent breach uncured → TERMR-BREACH-B; superior-proposal termination by target → TERMR-SUPERIOR; adverse recommendation change → TERMR-RECOMMEND.
- "partyWhoCanTerminate" identifies who can invoke THIS specific termination right (buyer / target / either / mutual).
- "terminationTriggers" for a SINGLE sub-clause is a SHORT list (often one item) describing the specific trigger condition for that sub-clause (e.g., ["outside date passed without closing"], ["target material breach uncured for 30 days"]). Do NOT roll up triggers from other sub-clauses.
- "faultBasedExclusion" is true if THIS sub-clause contains "...the right to terminate ... shall not be available to a party whose breach caused..." style language.
- "curePeriod" — for breach-based termination, the number of days the breaching party has to cure (extract as a number).
- "outsideDate" / "outsideDateMonths" / "extensionAvailable" / "extensionPeriod" / "extensionTrigger" apply to TERMR-OUTSIDE sub-clauses.
- "superiorProposalTermination" is true only for the TERMR-SUPERIOR sub-clause.
- "mainConcept" is a one-sentence summary of what THIS specific sub-clause does.
`;
  } else if (typeKey === 'NOSOL') {
    warnings = `
CRITICAL FEATURE EXTRACTION RULES for NOSOL:
- "mainConcept" is a one-sentence summary of the substantive concept.
- "noticePeriod" / "matchingPeriod" / "goShopWindow" are numeric durations.
- "fiduciaryCarveoutThreshold" describes the standard the board must meet to engage with an unsolicited bid.
`;
  } else if (typeKey === 'ANTI') {
    warnings = `
CRITICAL FEATURE EXTRACTION RULES for ANTI:
- "hellOrHighWater" is true ONLY if there is no cap on required divestitures.
- "divestitureCap" captures any dollar/revenue cap on remedies (if present).
- "litigationObligation" describes whether the parties must litigate against regulators.
- "effortsStandard" is a TAGGED single object { code, label, text } drawn from EFFORTS_STANDARDS (or null if absent).
`;
  } else if (typeKey && typeKey.startsWith('COND')) {
    warnings = `
CRITICAL FEATURE EXTRACTION RULES for ${typeKey}:
- "mainCondition" is a one-sentence summary of what must be satisfied for closing.
- "bringDownTiers" is an ARRAY of tier objects. Real merger agreement bring-downs are TIERED — extract EACH tier separately.
    * Example tiers found in a typical agreement:
        - Fundamental reps (e.g. Organization, Authority, Brokers) → standard "MAT_ALL_RESPECTS" (true in all respects, no de minimis).
        - Other capitalization reps → standard "MAT_ALL_RESPECTS_DE_MINIMIS" (true except for de minimis inaccuracies).
        - No-MAE rep → standard "MAT_ALL_RESPECTS".
        - All other (general) reps → standard "MAT_MAE_QUALIFIED" (true except where failure would not have an MAE).
    * Each tier object MUST have: "reps_covered" (free text describing which reps — cite specific sections if possible), "standard" (a code from MATERIALITY_CODES), "standard_label" (the human label for that code). "exceptions" is OPTIONAL free text for any tier-specific qualifier.
    * If the bring-down is UNIFORM (no tiering), return a single-element array describing the one standard that applies to all reps.
`;
  } else if (typeKey === 'TERMF') {
    warnings = `
CRITICAL FEATURE EXTRACTION RULES for TERMF:
- "triggerEvents" lists the specific events that cause the fee to be payable.
- "soleRemedy" is true only if there is explicit "sole and exclusive remedy" language.
`;
  } else if (typeKey === 'DEF') {
    warnings = `
CRITICAL FEATURE EXTRACTION RULES for DEF:
- "canonicalTerm" is the exact quoted defined term as it appears (e.g., "Material Adverse Effect").
- "definitionText" is the core definition body (excluding enumerated carve-outs).
- For MAE-type definitions, "carveOuts" lists each enumerated exception as a TAGGED object { code, label, text } drawn from EXCEPTION_CODES (use "OTHER" when no listed code fits). "disproportionateImpactClause" captures any "except to the extent disproportionately affected" qualifier as free text.
- "crossReferences" lists other defined terms referenced inside this definition.
`;
  } else if (typeKey === 'REP-T' || typeKey === 'REP-B') {
    warnings = `
CRITICAL FEATURE EXTRACTION RULES for ${typeKey}:
- "mainConcept" is a one-sentence summary of what is being represented.
- "materialityQualifier" — if a materiality qualifier IS present, return a TAGGED object { code, label, text } drawn from MATERIALITY_CODES; otherwise null. (Treat the legacy boolean form as superseded.)
- "crossReferences" should include schedule references (e.g. "Section 3.6 of the Company Disclosure Letter") and other section cross-references.
`;
  } else if (typeKey === 'CONSID') {
    warnings = `
CRITICAL FEATURE EXTRACTION RULES for CONSID:

GENERAL CONSID sections (share conversion, exchange mechanics, dissenting rights, withholding, anti-dilution):
- Populate "mainConcept", "considerationType", "perShareAmount", "exchangeRatio", "appraisalRightsAvailable", "withholdingProvision", "proration" as applicable.
- For these sections, leave the equity-award fields below as null / [] / false.

EQUITY-AWARD sections (when the sectionTitle contains "Equity Award", "Stock Plan", "Stock Option", "Treatment of Company [Equity/Stock/Option/RSU/PSU/Restricted]", or similar — i.e., a CONSID-EQUITY classification):
- This is the most important extraction in the deal for equity-holders. Be EXHAUSTIVE.
- "outstandingInstruments" — for EACH instrument type the provision addresses (stock options, RSUs, PSUs, restricted stock awards, warrants, ESPP rights, SARs, phantom stock, deferred comp, convertible notes), emit ONE tagged object { code, label, text } drawn from EQUITY_INSTRUMENTS, where "text" is the verbatim excerpt naming that instrument (e.g. "Company Stock Options outstanding immediately prior to the Effective Time..."). If the provision is silent on an instrument type, do NOT include it.
- "instrumentTreatments" — for EACH instrument type listed in outstandingInstruments, emit ONE tagged object { code, label, text } drawn from EQUITY_TREATMENT describing HOW that instrument is handled (cashed out at consideration, cashed out at spread, accelerated and cashed out, assumed by buyer, cancelled, continued vesting, replaced, double-trigger, 280G-limited). "text" should be the verbatim treatment language for that instrument. The order of instrumentTreatments SHOULD match outstandingInstruments.
- "vestingAcceleration" — a SINGLE tagged object { code, label, text } drawn from VESTING_STATUS that captures the dominant vesting treatment (fully accelerated, partially accelerated, double-trigger, no acceleration, performance deemed achieved, performance prorated). If treatments differ by instrument, pick the broadest applicable.
- "cutoffDate" — if the agreement distinguishes awards granted before vs. after a specific date (often the signing date or a stated date like "September 21, 2025"), capture that date as free text. Otherwise null.
- "cutoffTreatment" — describe how the cutoff date changes the treatment (e.g., "Awards granted after the Cutoff Date are cancelled without consideration"). Null if no cutoff.
- "cashOutAmount" — the formula/amount used to cash out non-option awards (e.g., "Per Share Merger Consideration" or "$X.XX per share plus one CVR"). Null if N/A.
- "optionSpread" — the formula used to cash out options (typically "Per Share Merger Consideration MINUS per-share exercise price", times shares). Note any "underwater options are cancelled for no consideration" qualifier. Null if N/A.
- "performanceTreatment" — for PSUs/performance awards, describe whether performance is deemed achieved at target / actual / maximum / prorated. Null if no PSUs.
- "espp_treatment" — for the ESPP, describe the final offering / shortened purchase period / termination / refund mechanics. Null if no ESPP.
- "parachuteCap" — true if there is explicit 280G parachute payment cap / cutback language; otherwise false.
- "doubleTrigger" — true if acceleration requires BOTH closing AND a qualifying termination of employment; otherwise false.

Be explicit and granular: lawyers compare per-instrument treatment across deals, so do NOT collapse "options + RSUs + ESPP all cashed out" into one entry — emit a separate outstandingInstruments / instrumentTreatments pair for each.
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
For list-typed fields (e.g. permittedExceptions, carveOuts), return an ARRAY of such objects.
If no listed code fits, use code "OTHER" (for EXCEPTION_CODES) or pick the closest available code, and still include the verbatim "text".
Do NOT invent new codes — only use codes that appear in the dictionaries below.

${sections.join('\n\n')}
`;
  }

  return `\nExtract these features for each provision (return them in a "features" object on each result):\n${lines.join('\n')}\n${warnings}${taxonomyBlock}\n`;
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
    // matches the affirmative "conduct ... in the ordinary course" obligation
    re: /(?:shall(?:[^.]*?)conduct\s+(?:its|their)\s+business[^.]*?ordinary\s+course[^.]*?(?:past\s+practice|consistent\s+with[^.]*?))(?:\.|;|$)/i,
  },
  {
    key: 'IOC-PRESERVE',
    category: 'Preservation of Business / Use of Efforts',
    label: 'Use commercially reasonable / reasonable best efforts to preserve business organization, retain employees, and maintain customer/supplier relationships',
    re: /(?:shall\s+use\s+(?:its\s+)?(?:commercially\s+reasonable|reasonable\s+best|reasonable|best)\s+efforts\s+to[^.]*?(?:preserv|retain|maintain|keep)[^.]*?)(?:\.|;|$)/i,
  },
  {
    key: 'IOC-NOACTION',
    category: 'General No-Action Restriction',
    label: 'General prohibition on actions outside the ordinary course',
    re: /(?:shall\s+not\s+take[^.]*?(?:outside|other\s+than\s+in)\s+the\s+ordinary\s+course[^.]*?)(?:\.|;|$)/i,
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
  let otherText = null;
  if (residual && /\b(?:shall|will|agrees? to|must)\b[^.]{20,}/i.test(residual)) {
    // Extract the trailing "shall ..." clause(s)
    const otherMatch = residual.match(/(?:shall|will|agrees? to|must)[^.]+\.?/i);
    if (otherMatch) {
      otherText = otherMatch[0].trim();
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
  };
}

// ---------------------------------------------------------------------------
// Regex: sub-clause splitting for (a)/(b)/(c) boundaries
// ---------------------------------------------------------------------------

function splitSubClauses(sectionText, typeKey) {
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
    const offset = sectionText[m.index] === '\n' ? 1 : 0;
    matches.push({ index: m.index + offset, letter: m[1] });
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
    matches.push({ index: m.index, term: m[1].trim() });
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

  // Pattern 1: "Term" means/shall mean/has the meaning ...
  const meansPattern =
    /[“"]([^”"\n]{1,80})[”"][^“"\n.;]{0,40}?\b(means?|shall\s+mean|has\s+the\s+meaning|shall\s+have\s+the\s+meaning)\b/g;
  let m;
  while ((m = meansPattern.exec(sectionText)) !== null) {
    const term = m[1].trim();
    if (!term || term.length < 2 || term.length > 80) continue;
    if (seenAtOffset.has(m.index)) continue;
    seenAtOffset.add(m.index);

    // Take from this match forward until the next sentence boundary or
    // ~1200 chars, so we capture the body of the definition.
    const start = m.index;
    let end = Math.min(sectionText.length, start + 1500);
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
    if (end - start > 1200) end = start + 1200;

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
    const term = pm2[1].trim();
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

  return found;
}

// ---------------------------------------------------------------------------
// Strategy A: Regex-split → AI-classify (IOC, COND types)
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
    // 1. Regex-split all sections of this type
    const allSubClauses = [];
    for (const section of typeSections) {
      const parts = splitSubClauses(section.text, typeKey);
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
      // For IOC, attempt to split the preamble into obligation provisions.
      let split = null;
      if (typeKey === 'IOC') {
        try {
          split = splitIocPreamble(p.text);
        } catch {
          split = null;
        }
      }

      // The "General / Preamble" provision — gets the SHARED carve-outs only
      // when we successfully split, or the full preamble otherwise.
      const generalText = split && split.sharedCarveOuts && split.sharedCarveOuts.length > 30
        ? split.sharedCarveOuts
        : p.text;
      const generalProv = makeProvision({
        type: typeKey,
        code: null,
        category: 'General / Preamble',
        text: generalText,
        startChar: p.startChar,
        favorability: 'neutral',
        features: {},
        relatedDefinitions: findRelatedDefinitions(generalText),
      });
      preambleProvisions.push(generalProv);
      provisions.push(generalProv);

      // For IOC, also emit each detected affirmative obligation as its own
      // provision with the appropriate canonical code.
      if (split && typeKey === 'IOC') {
        const extras = [...(split.obligations || [])];
        if (split.other) extras.push(split.other);
        for (const extra of extras) {
          const codeEntry = isValidCode(extra.key) ? CODES[extra.key] : null;
          provisions.push(makeProvision({
            type: 'IOC',
            code: codeEntry ? extra.key : null,
            category: extra.category,
            text: extra.text,
            startChar: p.startChar,
            favorability: 'neutral',
            features: { mainObligation: extra.label },
            relatedDefinitions: findRelatedDefinitions(extra.text),
            isNewCode: !codeEntry,
            proposedCode: codeEntry ? null : extra.key,
            proposedLabel: codeEntry ? null : extra.category,
          }));
        }
      }
    }

    // 2a. Extract shared (section-wide) features from preambles for scoped
    //     types (IOC). One batched AI call covering all preambles for this type.
    if (SCOPED_FEATURE_TYPES.has(typeKey) && preambleProvisions.length > 0) {
      const preambleFeatureInstructions = buildFeatureInstructions(typeKey, { scope: 'preamble' });
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
            max_tokens: 4000,
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

    const codesList = buildCodesList(typeKey);
    // For SCOPED types, per-clause prompts ONLY ask for clause-scoped features
    // so the model doesn't repeat the section-wide carve-outs on every
    // sub-clause. For other types, full feature set as before.
    const clauseScopeOpts = SCOPED_FEATURE_TYPES.has(typeKey) ? { scope: 'clause' } : {};
    const featureInstructions = buildFeatureInstructions(typeKey, clauseScopeOpts);

    const subClausePayload = classifiable.map((sc, idx) => {
      const parentSection = typeSections[sc.sectionIdx] || {};
      return {
        idx,
        sectionTitle: parentSection.title || parentSection.heading || parentSection.category || null,
        sectionNumber: parentSection.number || null,
        text: sc.text.length > 3000 ? sc.text.substring(0, 3000) : sc.text,
      };
    });

    const prompt = `You are a senior M&A attorney. Classify each sub-clause below into exactly one canonical rubric code, assess favorability, and extract STRUCTURED features.

PROVISION TYPE: ${typeKey} — ${getTypeLabel(typeKey)}

VALID CANONICAL CODES for ${typeKey}:
${codesList}

SUB-CLAUSES TO CLASSIFY (each tagged with its parent sectionTitle and sectionNumber):
${JSON.stringify(subClausePayload, null, 2)}
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

If NO existing code fits, set "isNewCode": true and propose a code (format: "${typeKey}-NEWNAME") and label.

Return ONLY valid JSON (no markdown, no backticks). Each result MUST include a
"features" object with the schema fields populated:
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
      const resp = await client.messages.create({
        model: MODEL,
        max_tokens: 8000,
        messages: [{ role: 'user', content: prompt }],
      });

      const raw = resp.content.map((c) => c.text || '').join('');
      const parsed = parseJSON(raw);
      const resultMap = {};
      for (const r of (parsed.results || [])) {
        resultMap[r.idx] = r;
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
        }

        provisions.push(makeProvision({
          type: effectiveType,
          code: isValidCode(code) ? code : null,
          category: codeEntry ? codeEntry.label : (aiResult.category || 'Unclassified'),
          text: sc.text,
          startChar: sc.startChar,
          favorability: aiResult.favorability || 'neutral',
          features: aiResult.features || {},
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
    // Concatenate all section texts for this type (they may span multiple
    // sections, e.g. multiple NOSOL articles)
    const combinedText = typeSections.map((s) => s.text).join('\n\n---\n\n');
    const startChar = typeSections[0].startChar;

    const codesList = buildCodesList(typeKey);
    const featureInstructions = buildFeatureInstructions(typeKey);

    const prompt = `You are a senior M&A attorney. This is a "${getTypeLabel(typeKey)}" section of a merger agreement. A single passage can contain MULTIPLE provisions with overlapping text spans.

SECTION TEXT:
${combinedText.length > 15000 ? combinedText.substring(0, 15000) : combinedText}

ALL CANONICAL CODES for ${typeKey}:
${codesList}

For EACH canonical code listed above, determine:
1. Whether it is present in this section (true/false).
2. If present, extract the most relevant text excerpt (verbatim).
3. Assess favorability from the buyer's perspective.
4. POPULATE the structured "features" object with every applicable field from
   the schema below. Each identified passage gets its OWN features object.
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

    try {
      const resp = await client.messages.create({
        model: MODEL,
        max_tokens: 12000,
        messages: [{ role: 'user', content: prompt }],
      });

      const raw = resp.content.map((c) => c.text || '').join('');
      const parsed = parseJSON(raw);

      for (const p of (parsed.provisions || [])) {
        if (!p.present && p.present !== undefined) continue;
        if (!p.text || p.text.length < 10) continue;

        const code = p.code || null;
        const codeEntry = code ? CODES[code] : null;

        provisions.push(makeProvision({
          type: typeKey,
          code: isValidCode(code) ? code : null,
          category: codeEntry ? codeEntry.label : (p.category || 'Unclassified'),
          text: p.text,
          startChar,
          favorability: p.favorability || 'neutral',
          features: p.features || {},
          relatedDefinitions: findRelatedDefinitions(p.text),
          isNewCode: p.isNewCode || false,
          proposedCode: p.proposedCode || null,
          proposedLabel: p.proposedLabel || null,
        }));
      }
    } catch (err) {
      // Fallback: keep as single provision per section
      for (const s of typeSections) {
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
  });

  await runWithConcurrency(tasks, MAX_CONCURRENT);
  return provisions;
}

// ---------------------------------------------------------------------------
// Strategy C: Section-level AI (REP, STRUCT, CONSID, COV, TERMR, TERMF, MISC)
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

    const sectionPayload = typeSections.map((s, idx) => ({
      idx,
      sectionNumber: s.number || null,
      sectionTitle: s.title || s.heading || s.category || null,
      articleNumber: s.articleNumber || null,
      articleTitle: s.articleTitle || null,
      text: s.text.length > 4000 ? s.text.substring(0, 4000) : s.text,
    }));

    const prompt = `You are a senior M&A attorney. Classify each section below into exactly one canonical rubric code, assess favorability, and extract features.

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

If NO existing code fits a section, set "isNewCode": true and propose a code (format: "${typeKey}-NEWNAME") and label derived from the sectionTitle.

Return ONLY valid JSON (no markdown, no backticks). Each result MUST include a populated "features" object:
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
      const resp = await client.messages.create({
        model: MODEL,
        max_tokens: 10000,
        messages: [{ role: 'user', content: prompt }],
      });

      const raw = resp.content.map((c) => c.text || '').join('');
      const parsed = parseJSON(raw);
      const resultMap = {};
      for (const r of (parsed.results || [])) {
        resultMap[r.idx] = r;
      }

      for (let i = 0; i < typeSections.length; i++) {
        const section = typeSections[i];
        const aiResult = resultMap[i] || {};
        const code = aiResult.code || null;
        const codeEntry = code ? CODES[code] : null;

        provisions.push(makeProvision({
          type: typeKey,
          code: isValidCode(code) ? code : null,
          category: codeEntry
            ? codeEntry.label
            : (aiResult.category || section.category || 'Unclassified'),
          text: section.text,
          startChar: section.startChar,
          favorability: aiResult.favorability || 'neutral',
          features: aiResult.features || {},
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
    const codeEntry = CODES[d.aliasCode];
    provisions.push(makeProvision({
      type: 'DEF',
      code: d.aliasCode,
      category: codeEntry ? codeEntry.label : d.term,
      text: d.text,
      startChar: d.startChar,
      relatedDefinitions: findRelatedDefinitions(d.text),
    }));
  }

  // 4. Send remaining definitions to Claude for classification + feature extraction
  if (needsAI.length > 0) {
    const codesList = buildCodesList('DEF');
    const featureInstructions = buildFeatureInstructions('DEF');

    const defPayload = needsAI.map((d, idx) => ({
      idx,
      term: d.term,
      text: d.text.length > 2000 ? d.text.substring(0, 2000) : d.text,
    }));

    const prompt = `You are a senior M&A attorney. Classify each defined term below into the best matching canonical rubric code, and extract STRUCTURED features.

VALID DEF CODES:
${codesList}

DEFINITIONS TO CLASSIFY:
${JSON.stringify(defPayload, null, 2)}
${featureInstructions}
For each definition:
1. Pick the best matching canonical code.
2. Assess favorability from the buyer's perspective.
3. POPULATE the "features" object with every applicable schema field — including "canonicalTerm", "definitionText", "crossReferences", and (for MAE) "carveOuts" and "disproportionateImpactClause".
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
        max_tokens: 8000,
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

        provisions.push(makeProvision({
          type: 'DEF',
          code: isValidCode(code) ? code : null,
          category: codeEntry ? codeEntry.label : (aiResult.category || d.term),
          text: d.text,
          startChar: d.startChar,
          favorability: aiResult.favorability || 'neutral',
          features: aiResult.features || {},
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
          max_tokens: 6000,
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
async function extractProvisions(classifiedSections, client) {
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
  );
  allProvisions.push(...inlineDefProvisions);

  // Post-processing: link definitions to provisions that reference them
  linkDefinitionCrossReferences(allProvisions);

  // Post-processing: write per-rep bring-down standard back onto REP provisions
  // based on the tier definitions captured on COND-B-REP / COND-S-REP.
  linkBringDownToReps(allProvisions);

  // Clean up internal-only fields
  for (const p of allProvisions) {
    delete p._error;
  }

  return allProvisions;
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
async function extractInlineDefinitionsFromSections(classifiedSections, existingProvisions, client) {
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
  for (const section of classifiedSections) {
    if (!section || !section.text) continue;
    if (section.provision_type === 'DEF') continue;
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

  if (hits.length === 0) return [];

  // AI-classify the inline definitions in batches via the same DEF prompt.
  const codesList = buildCodesList('DEF');
  const featureInstructions = buildFeatureInstructions('DEF');

  const defPayload = hits.map((h, idx) => ({
    idx,
    term: h.term,
    sourceSection: h.sourceSection,
    text: h.text.length > 2000 ? h.text.substring(0, 2000) : h.text,
  }));

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
    if (!features.canonicalTerm) features.canonicalTerm = h.term;

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
      const term = qm[1].trim().toLowerCase();
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
 * Detect catch-all tiers (e.g. "All other representations", "All other reps",
 * "Remaining representations").
 */
function isCatchAllRepsCovered(text) {
  if (!text || typeof text !== 'string') return false;
  return /\b(all\s+other|remaining|any\s+other|all\s+remaining)\b.*\b(rep(resentation)?s?|warranties)\b/i
    .test(text);
}

/**
 * Pull a section number out of a REP provision. Looks first at
 * features.crossReferences (array of strings or tagged items), then at the
 * leading "SECTION X.XX" pattern in the provision text. Returns the first
 * normalized section key found (e.g. "3.01", "3.05(a)"), or null.
 */
function extractRepSectionNumber(provision) {
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

  // 2. Leading "SECTION X.XX" in provision text. Pull the first few hundred
  //    chars so we don't accidentally grab a later cross-reference.
  if (provision && typeof provision.text === 'string') {
    const head = provision.text.substring(0, 400);
    candidates.push(head);
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

  for (const { condCode, repType } of condMappings) {
    // Gather all COND provisions for this code with bringDownTiers.
    const condProvs = provisions.filter(
      (p) => p && p.code === condCode
        && p.features
        && Array.isArray(p.features.bringDownTiers)
        && p.features.bringDownTiers.length > 0,
    );
    if (condProvs.length === 0) continue;

    // Build a single section-number → tier map across all COND provisions of
    // this code (in practice there is usually only one). Also capture the
    // catch-all tier as a fallback.
    const sectionMap = new Map(); // section-num → { code, label, tier_index }
    let catchAll = null;

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

    if (sectionMap.size === 0 && !catchAll) continue;

    // Stamp each REP provision of the matching type.
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

      if (!stamp && catchAll) stamp = catchAll;
      if (!stamp) continue;

      rep.features.linkedBringDownStandard = {
        code: stamp.code,
        label: stamp.label,
        tier_index: stamp.tier_index,
      };
    }
  }
}

// ---------------------------------------------------------------------------
// Exports
// ---------------------------------------------------------------------------

module.exports = {
  extractProvisions,
  // Exposed for testing
  splitSubClauses,
  splitDefinitions,
  findInlineDefinitions,
  findRelatedDefinitions,
  buildFeatureInstructions,
  buildCodesList,
  linkBringDownToReps,
  parseSectionNumbersFromRepsCovered,
  extractRepSectionNumber,
};
