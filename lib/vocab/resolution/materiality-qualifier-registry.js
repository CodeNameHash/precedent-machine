'use strict';

const { freeze, registryFingerprint } = require('./registry-fingerprint');
const { GENERAL_COVENANT_CODES } = require('./general-covenant-registry');

const VERSION = 'RESOLUTION_MATERIALITY_QUALIFIER_REGISTRY/V1';
const QUALIFIER_KINDS = Object.freeze([
  'KNOWLEDGE',
  'TEMPORAL',
  'ACCURACY',
  'THRESHOLD',
  'DISCLOSURE_SCHEDULE_CARVEOUT',
  'PERFORMANCE_ASSUMPTION',
]);
const QUALIFIER_KIND_DISAGREEMENT = 'QUALIFIER_KIND_DISAGREEMENT';
const QUALIFIER_KIND_UNCLASSIFIED = 'QUALIFIER_KIND_UNCLASSIFIED';
const DISCLOSURE_CARVEOUT_PARTIAL = 'DISCLOSURE_CARVEOUT_PARTIAL';
const DISCLOSURE_CARVEOUT_UNCORROBORATED = 'DISCLOSURE_CARVEOUT_UNCORROBORATED';
const PERFORMANCE_ASSUMPTION_LEVEL_UNDERIVABLE = 'PERFORMANCE_ASSUMPTION_LEVEL_UNDERIVABLE';
const IDENTITY_BEARING_KINDS = Object.freeze(['ACCURACY', 'DISCLOSURE_SCHEDULE_CARVEOUT']);
const LEGACY_HINT_ABSTENTION_KINDS = Object.freeze(['KNOWLEDGE', 'TEMPORAL', 'THRESHOLD']);
const KNOWLEDGE_PATTERNS = Object.freeze([
  /\bto\s+the\s+knowledge\s+of\b/i,
  /\bknown\s+to\b/i,
  /\baware\s+of\b/i,
]);
const TEMPORAL_CALENDAR_MONTH = '(?:January|February|March|April|May|June|July|August|September|October|November|December)';
const TEMPORAL_CALENDAR_DATE_PATTERN_SOURCE = `${TEMPORAL_CALENDAR_MONTH}\\s+\\d{1,2},\\s*\\d{4}`;
const TEMPORAL_CALENDAR_DATE_PATTERN = new RegExp(`^${TEMPORAL_CALENDAR_DATE_PATTERN_SOURCE}`, 'i');
const TEMPORAL_SYMBOLIC_DATES = Object.freeze(['the date hereof', 'the date of this Agreement', 'the Closing Date', 'the Effective Time', 'the Capitalization Date']);
const AS_OF_BRIDGE_PATTERN_SOURCE = '(?:(?:the\\s+close\\s+of\\s+business\\s+on\\s+)|(?:\\d{1,2}:\\d{2}\\s*[ap]\\.m\\.,?\\s*(?:\\w+\\s+time,?\\s*)?on\\s+))?';
const TEMPORAL_PERIOD_ENDPOINT_SOURCE = `(?:${TEMPORAL_CALENDAR_DATE_PATTERN_SOURCE}|${TEMPORAL_SYMBOLIC_DATES.map((s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')).join('|')})`;
const ACCURACY_PATTERNS = Object.freeze([/\btrue\s+and\s+correct\b/i, /\bcorrect\s+and\s+complete\b/i, /\bin\s+all\s+material\s+respects\b/i, /\bin\s+all\s+respects\b/i]);
const THRESHOLD_PATTERNS = Object.freeze([/\bmaterial\s+to\b/i, /\$\s?\d[\d,]*(?:\.\d+)?/, /\b\d+(?:\.\d+)?\s?%/, /\bde\s+minimis\b/i]);

const MATERIALITY_CODES = freeze({
  MAT_ALL_RESPECTS: 'True and correct in all respects', MAT_ALL_RESPECTS_DE_MINIMIS: 'True except for de minimis inaccuracies', MAT_ALL_MATERIAL: 'In all material respects', MAT_MATERIAL_TO_COMPANY: 'Materiality to the Company (whole rep)', MAT_MATERIAL_INLINE: 'Materiality inline within the rep', MAT_MAE_QUALIFIED: 'True except where failure would not have an MAE', MAT_MAE_AGGREGATE: 'Would not, individually or in aggregate, have MAE', MAT_DE_MINIMIS: 'Except for de minimis inaccuracies', MAT_MATERIALITY_SCRAPE: 'Materiality qualifiers disregarded for bring-down', MAT_KNOWLEDGE: 'Knowledge qualifier (best knowledge / actual knowledge)', MAT_WILLFUL_BREACH: 'Willful breach standard', MAT_INTENTIONAL_BREACH: 'Intentional breach standard', MAT_NO_QUALIFIER: 'No materiality qualifier',
});
const CAPITAL_STRUCTURE_MATERIALITY_TIER = freeze({ rank: 52, label: 'CAPITAL_STRUCTURE', concept_key_prefixes: [] });
const GENERAL_COVENANT_PREFIX_TIER = freeze({ rank: 95, label: 'GENERAL_COVENANTS', concept_key_prefixes: GENERAL_COVENANT_CODES });
const MATERIALITY_TABLE = freeze([
  { rank: 10, label: 'TERMINATION_RIGHTS', concept_key_prefixes: ['TERMR-'] }, { rank: 20, label: 'FEES', concept_key_prefixes: ['TERMF-', 'DEF-WILLFUL'] }, { rank: 25, label: 'REMEDIES', concept_key_prefixes: ['REM-', 'REMEDY-'] }, { rank: 30, label: 'MAE', concept_key_prefixes: ['DEF-MAE'] }, { rank: 40, label: 'FIDUCIARY', concept_key_prefixes: ['DEF-ACQPROPOSAL', 'DEF-SUPERIOR', 'DEF-INTERVENING'] }, { rank: 50, label: 'NO_SHOP_EXCEPTIONS', concept_key_prefixes: ['NOSOL-'] }, CAPITAL_STRUCTURE_MATERIALITY_TIER, { rank: 54, label: 'MATERIAL_CONTRACTS', concept_key_prefixes: ['REP-T-CONTRACTS'] }, { rank: 55, label: 'REPRESENTATIONS', concept_key_prefixes: ['REP-T-', 'REP-B-', 'DEF-KNOWLEDGE'] }, { rank: 60, label: 'CONSIDERATION', concept_key_prefixes: ['CONS-'] }, { rank: 63, label: 'REGULATORY_EFFORTS', concept_key_prefixes: ['ANTI-'] }, { rank: 65, label: 'INTERIM_OPERATING_COVENANTS', concept_key_prefixes: ['IOC-'] }, { rank: 66, label: 'MADE_AVAILABLE_AND_ORDINARY_COURSE', concept_key_prefixes: ['DEF-MADE-AVAILABLE', 'DEF-ORDINARY-COURSE'] }, { rank: 70, label: 'CLOSING_CONDITIONS', concept_key_prefixes: ['COND-'] }, { rank: 74, label: 'GUARANTY_FINANCING_PARTY', concept_key_prefixes: ['GTY-PERF', 'GTY-DELIVERY'] }, { rank: 75, label: 'FINANCING_COVENANTS', concept_key_prefixes: ['COV-FINANCING', 'COV-PAYOFF', 'COV-MARKETING'] }, { rank: 80, label: 'PROXY_MEETING_COVENANTS', concept_key_prefixes: ['COV-PROXY', 'COV-MEETING'] }, { rank: 81, label: 'TAX_MATTERS', concept_key_prefixes: ['TAXM-TREATMENT', 'TAXM-OPINION', 'TAXM-TRANSFER', 'TAXM-FIRPTA', 'DEF-TAX', 'DEF-TAX-RETURN'] }, { rank: 82, label: 'EMPLOYEE_MATTERS', concept_key_prefixes: ['COV-EMPLOYEE'] }, { rank: 84, label: 'DIVIDENDS', concept_key_prefixes: ['DIVD-'] }, { rank: 87, label: 'MERGER_STRUCTURE', concept_key_prefixes: ['MERGER-STRUCTURE'] }, { rank: 88, label: 'APPRAISAL_DISSENTERS_RIGHTS', concept_key_prefixes: ['APPR-SETTLE', 'APPR-WITHDRAW'] }, { rank: 85, label: 'DNO_INDEMNIFICATION', concept_key_prefixes: ['DNO-'] }, { rank: 90, label: 'NOTICES_ADMINISTRATIVE', concept_key_prefixes: ['NOTICE-', 'ADMIN-', 'MISC-BOILERPLATE'] }, GENERAL_COVENANT_PREFIX_TIER,
]);
const UNCLASSIFIED_MATERIALITY = freeze({ rank: 99, label: 'UNCLASSIFIED' });
const MATERIALITY_DEFINITION_KEY_OVERRIDES = freeze({ CAPITALIZATION_SHARE_COUNT: MATERIALITY_TABLE[6], RESERVED_SHARE_POOL: MATERIALITY_TABLE[6] });
const KNOWLEDGE_STANDARD_META = freeze({
  ACTUAL: { label: 'Actual knowledge', synonyms: [/actual\s+knowledge/i] },
  CONSTRUCTIVE: { label: 'Constructive knowledge', synonyms: [/constructive\s+knowledge/i] },
  AFTER_INQUIRY: { label: 'Knowledge after reasonable inquiry', synonyms: [/after\s+(?:reasonable|due)\s+inquiry/i, /reasonable\s+inquiry/i] },
  NA: { label: 'Not applicable / silent', synonyms: [/not\s+applicable/i, /\bn\/?a\b/i] },
});
const RESOLVER_DERIVATION_PATTERNS = freeze([{ source: '\\bactual\\s+knowledge\\b', flags: 'i', standard: 'ACTUAL', near_miss_anchor: ['actual', 'knowledge'] }, { source: '\\bconstructive\\s+knowledge\\b', flags: 'i', standard: 'CONSTRUCTIVE', near_miss_anchor: ['constructive', 'knowledge'] }, { source: '\\bafter\\s+(?:due|reasonable)\\s+inquiry\\b', flags: 'i', standard: 'AFTER_INQUIRY', near_miss_anchor: ['inquiry'] }]);
const KNOWLEDGE_STANDARD_PATTERNS = freeze(RESOLVER_DERIVATION_PATTERNS.map((entry) => ({ pattern: new RegExp(entry.source, entry.flags), standard: entry.standard })));
const QUALIFIER_ACCURACY_CODES = freeze(Object.fromEntries(['MAT_ALL_RESPECTS', 'MAT_ALL_RESPECTS_DE_MINIMIS', 'MAT_ALL_MATERIAL', 'MAT_MATERIAL_TO_COMPANY', 'MAT_MAE_QUALIFIED', 'MAT_MATERIAL_INLINE'].map((key) => [key, key])));
const ACCURACY_CODES = QUALIFIER_ACCURACY_CODES;

const ACCURACY_CODE_WHITELIST = Object.freeze([
  Object.freeze({ phrase: 'true and correct in all respects', code: ACCURACY_CODES.MAT_ALL_RESPECTS }),
  Object.freeze({
    phrase: 'true and correct in all respects, except for de minimis inaccuracies',
    code: ACCURACY_CODES.MAT_ALL_RESPECTS_DE_MINIMIS,
  }),
  Object.freeze({
    phrase: 'true and correct in all respects except for de minimis inaccuracies',
    code: ACCURACY_CODES.MAT_ALL_RESPECTS_DE_MINIMIS,
  }),
  Object.freeze({ phrase: 'true and correct in all material respects', code: ACCURACY_CODES.MAT_ALL_MATERIAL }),
  Object.freeze({
    phrase: 'except as would not be material to the Company',
    code: ACCURACY_CODES.MAT_MATERIAL_TO_COMPANY,
  }),
  Object.freeze({
    // DEVIATION: exact MAE phrase not pinned by the spec text -- see note above.
    phrase:
      'true and correct in all respects, except as would not reasonably be expected to have a Material Adverse Effect',
    code: ACCURACY_CODES.MAT_MAE_QUALIFIED,
  }),
  // Stage 3 additions, lexicon version 3. Governance: Ben ruled directly
  // (docs/codex-program/notes/structural-inheritance-diagnosis.md section 9
  // question 1 / the staged-fix brief's "BEN HAS RULED" item 1) that the
  // two phrases below are DISTINCT facts carrying separate codes, never
  // aliased -- that ruling is the identity-semantics approval the module
  // header requires for a whitelist edit. Both are QUALIFIER-ONLY forms:
  // the producer contract deliberately separates host and qualifier, so
  // "in all material respects" arrives alone, without the "true and
  // correct" stem the earlier composite pairs assume travels with it.
  Object.freeze({ phrase: 'in all material respects', code: ACCURACY_CODES.MAT_ALL_MATERIAL }),
  Object.freeze({ phrase: 'in any material respect', code: ACCURACY_CODES.MAT_MATERIAL_INLINE }),
]);

// ─── Stage 3 front door: the whole-quote MAE-qualifier idiom ───
//
// The recurring chapeau/limb qualifier "(Except for matters that) would not
// reasonably be expected to have(, individually or in the aggregate,) a
// (Company/Parent) Material Adverse Effect" carries no marker in the four
// legacy tables (confirmed live: Red Hat's 48-row review queue, card 03 of
// the blind set), so a quote consisting of exactly this idiom could never
// classify. Deliberately a FRONT DOOR on classifyQualifierQuote -- the same
// shape as the P2 disclosure-carve-out door, and for the same reason:
// appending it to ACCURACY_PATTERNS would feed containsMarkerOrConnective
// and silently change bound-clause boundaries on legacy quotes.
//
// NEGATIVE FORM ONLY, whole-quote anchored, fail closed: "would not ...
// have a MAE" is an accuracy tolerance (failures below MAE level are
// tolerated); the affirmative "would reasonably be expected to have a MAE"
// is a different assertion and deliberately does NOT classify here.
// The optional "individually or in the aggregate" group still MATCHES so
// those quotes classify here, but both forms resolve to MAT_MAE_QUALIFIED
// -- Ben's 2026-08-08 reversal (DECISIONS.md entry 14 / Step 2X-D)
// supersedes the Stage 3 never-alias split for this pair. MAE is
// inherently an aggregate concept; the phrase is a drafting variant.
const MAE_QUALIFIER_IDIOM_PATTERN = new RegExp(
  '^(?:except\\s+(?:for\\s+|as\\s+|to\\s+the\\s+extent\\s+)?(?:matters?\\s+|those\\s+|any\\s+such\\s+\\w+\\s+|any\\s+\\w+\\s+)?)?'
  + '(?:that\\s+|which\\s+|as\\s+)?'
  + 'would\\s+not\\s+(?:reasonably\\s+be\\s+expected\\s+to\\s+)?(?:have|result\\s+in)\\s*,?\\s*'
  + '(?:individually\\s+or\\s+in\\s+the\\s+aggregate\\s*,?\\s*)?'
  + '(?:an?\\s+)?(?:Company\\s+|Parent\\s+)?Material\\s+Adverse\\s+Effect[\\s.,;)]*$',
  'i',
);

// Corpus-exact tolerance variants retain a concrete governed failure before
// the negative MAE tail.  They are not a nearest-fit rule: the start is
// closed, the failure text is bounded, and an affirmative MAE proposition
// never matches.  All map to the existing aggregate MAE tolerance code.
const MAE_TOLERANCE_FAILURE_IDIOM_PATTERN = new RegExp(
  '^(?:other than where the failure to [\\s\\S]{1,240}?'
  + '|except for such [\\s\\S]{1,240}?(?:the )?(?:absence|failure) of which[\\s\\S]{0,120}?'
  + '|such other [\\s\\S]{1,240}?the failure of which[\\s\\S]{0,120}?'
  + '|except for such failures to [\\s\\S]{1,240}?)\\b'
  + 'would\\s+not\\s+(?:reasonably\\s+be\\s+expected\\s+to\\s*,?\\s*)?'
  + '(?:individually\\s+or\\s+in\\s+the\\s+aggregate\\s*,?\\s*)?(?:have|result\\s+in)\\s*,?\\s*'
  + '(?:individually\\s+or\\s+in\\s+the\\s+aggregate\\s*,?\\s*)?'
  + '(?:an?\\s+)?(?:Company\\s+|Parent\\s+)?Material\\s+Adverse\\s+Effect[\\s.,;)]*$',
  'i',
);

// ─── P2 front-door patterns (section 1a, 1b) ───
//
// Deliberately NOT appended to the four-family marker tables above: those
// tables feed containsMarkerOrConnective, which drives the comma-close
// rule, and adding a new family there would silently change bound-clause
// boundaries on legacy quotes. Instead these are FRONT DOORS on
// classifyQualifierQuote (section 2), leaving applyExceptionConnectiveBinding
// byte-for-byte untouched.

const DISCLOSURE_CARVEOUT_VERB = '(?:set\\s+forth|provided|disclosed|described|listed)';
const DISCLOSURE_CARVEOUT_CITATION_TOKEN = '\\d+\\.\\d+(?:\\([^()\\s]+\\))*';
const DISCLOSURE_CARVEOUT_ANCHOR =
  'of\\s+the\\s+(?:\\w+\\s+){0,2}Disclosure\\s+(?:Letter|Schedule)s?';
const DISCLOSURE_CARVEOUT_CONNECTIVE = '(?:except|except as|except for|other than|excluding)';

// The CLASSIFY grammar -- full match only, anchored start/end.
const DISCLOSURE_CARVEOUT_CLAUSE_PATTERN = new RegExp(
  `^${DISCLOSURE_CARVEOUT_CONNECTIVE}\\s+(?:as\\s+)?${DISCLOSURE_CARVEOUT_VERB}\\s+(?:in|on)\\s+` +
    `Section\\s+(${DISCLOSURE_CARVEOUT_CITATION_TOKEN})\\s+${DISCLOSURE_CARVEOUT_ANCHOR}[\\s,;.]*$`,
  'i'
);

// The DOUBT tripwire -- anywhere, plural "Sections?", bounded bridge.
const DISCLOSURE_CARVEOUT_SIGNAL_PATTERN = new RegExp(
  `${DISCLOSURE_CARVEOUT_VERB}\\s+(?:in|on)\\s+Sections?\\s+${DISCLOSURE_CARVEOUT_CITATION_TOKEN}` +
    `(?:[^;]{0,80}?)${DISCLOSURE_CARVEOUT_ANCHOR}`,
  'gi'
);

// The Modiv coverage map also contains one enumerated exception clause.
// Its final, singular disclosure-letter limb is separated from the opening
// "Except" by four Roman-numeral limbs. This is intentionally a separate,
// closed tripwire: it does not extend the ordinary 40-character connector
// window, and it refuses whole-letter and multi-citation forms.
const ENUMERATED_EXCEPT_DISCLOSURE_CARVEOUT_SIGNAL_PATTERN = new RegExp(
  `^\\s*except\\b(?=[^;]*\\(i\\)[^;]*\\(ii\\)[^;]*\\(iii\\)[^;]*\\(iv\\))[^;]*?` +
    `as\\s+set\\s+forth\\s+in\\s+Section\\s+${DISCLOSURE_CARVEOUT_CITATION_TOKEN}` +
    `(?!\\s*(?:,|and)\\s*(?:Sections?|\\d+\\.\\d+))\\s+${DISCLOSURE_CARVEOUT_ANCHOR}`,
  'i'
);

// Section 2 rule 3: DISCLOSURE_CARVEOUT_SIGNAL_PATTERN requires an
// except-family connective within 40 normalised chars BEFORE the verb --
// an affirmative reference has none and flows to the legacy pipeline.
const EXCEPT_FAMILY_CONNECTIVE_PATTERN = new RegExp(`\\b${DISCLOSURE_CARVEOUT_CONNECTIVE}\\b`, 'i');
const CARVEOUT_SIGNAL_CONNECTIVE_WINDOW = 40;

const FINGERPRINT_INPUT_V1 = freeze({ version: VERSION, materiality_codes: MATERIALITY_CODES, materiality_table: MATERIALITY_TABLE, general_covenant_prefix_tier: GENERAL_COVENANT_PREFIX_TIER, unclassified_materiality: UNCLASSIFIED_MATERIALITY, materiality_definition_key_overrides: Object.keys(MATERIALITY_DEFINITION_KEY_OVERRIDES), taxonomy_meta: KNOWLEDGE_STANDARD_META, resolver_derivation_patterns: RESOLVER_DERIVATION_PATTERNS, qualifier_accuracy_codes: QUALIFIER_ACCURACY_CODES });
const DIGEST = registryFingerprint(FINGERPRINT_INPUT_V1);
module.exports = freeze({ VERSION, MATERIALITY_CODES, CAPITAL_STRUCTURE_MATERIALITY_TIER, MATERIALITY_TABLE, GENERAL_COVENANT_PREFIX_TIER, UNCLASSIFIED_MATERIALITY, MATERIALITY_DEFINITION_KEY_OVERRIDES, KNOWLEDGE_STANDARD_META, RESOLVER_DERIVATION_PATTERNS, QUALIFIER_ACCURACY_CODES, KNOWLEDGE_STANDARD_PATTERNS, QUALIFIER_KINDS, QUALIFIER_KIND_DISAGREEMENT, QUALIFIER_KIND_UNCLASSIFIED, DISCLOSURE_CARVEOUT_PARTIAL, DISCLOSURE_CARVEOUT_UNCORROBORATED, PERFORMANCE_ASSUMPTION_LEVEL_UNDERIVABLE, IDENTITY_BEARING_KINDS, LEGACY_HINT_ABSTENTION_KINDS, KNOWLEDGE_PATTERNS, TEMPORAL_CALENDAR_MONTH, TEMPORAL_CALENDAR_DATE_PATTERN_SOURCE, TEMPORAL_CALENDAR_DATE_PATTERN, TEMPORAL_SYMBOLIC_DATES, AS_OF_BRIDGE_PATTERN_SOURCE, TEMPORAL_PERIOD_ENDPOINT_SOURCE, ACCURACY_PATTERNS, THRESHOLD_PATTERNS, ACCURACY_CODE_WHITELIST, MAE_QUALIFIER_IDIOM_PATTERN, MAE_TOLERANCE_FAILURE_IDIOM_PATTERN, DISCLOSURE_CARVEOUT_VERB, DISCLOSURE_CARVEOUT_CITATION_TOKEN, DISCLOSURE_CARVEOUT_ANCHOR, DISCLOSURE_CARVEOUT_CONNECTIVE, DISCLOSURE_CARVEOUT_CLAUSE_PATTERN, DISCLOSURE_CARVEOUT_SIGNAL_PATTERN, ENUMERATED_EXCEPT_DISCLOSURE_CARVEOUT_SIGNAL_PATTERN, EXCEPT_FAMILY_CONNECTIVE_PATTERN, CARVEOUT_SIGNAL_CONNECTIVE_WINDOW, FINGERPRINT_INPUT_V1, DIGEST });
