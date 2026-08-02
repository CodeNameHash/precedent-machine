/**
 * lib/canonical-v2/native-producer/v1v2-comparator.js
 *
 * The v1<->v2 comparator net -- auto-pass condition 1 of Ben's M3 protocol
 * (docs/superpowers/specs/2026-08-01-v1v2-comparator-net-design.md). PURE,
 * DETERMINISTIC, NO MODEL CALLS, NO NETWORK, NO DB -- exactly this module's
 * two inputs decide every outcome:
 *
 *  - `v1_snapshot`: a `V1_PROVISION_SNAPSHOT/V1` content-addressed artifact
 *    (scripts/export-v1-provision-snapshot.mjs, read-only, offline from this
 *    module's point of view -- it is handed the JSON, never the DB).
 *  - `v2_side`: the `resolveCandidates()` output (candidate-resolution.js)
 *    for the SAME deal -- `{resolved, review_queue, open_world, residuals,
 *    limb_component_trees, resolution_receipt}` -- plus, optionally,
 *    `v2_canonical_text` (the ADVISORY-ONLY quote-probe input; see below).
 *
 * TWO TIERS, EACH HONEST ABOUT WHAT IT CERTIFIES (spec "What the net
 * certifies"): Tier 1 (PRESENCE/IDENTITY) runs for every family today; Tier 2
 * (VALUE agreement) runs only where BOTH sides carry a value for the SAME
 * concept, via `VALUE_MAPPING_TABLE` below (today: none populated for real
 * data -- v1 REPRESENTATION cards carry no per-claim values at all, the
 * grounding fact the whole spec is built on -- but the table and machinery
 * are real so a TERMF/NOSOL entry can be added by a Fable+Ben table edit,
 * never a code change to this module's comparison logic).
 *
 * SECTION-STRING PINNING (spec audit M1, followed exactly): the v2 side of
 * every comparison is `citation_validation.normalized_citation` when
 * `validation_source === 'CORROBORATED_BY_DOCUMENT_TEXT'`, else
 * `derived_citation` -- NEVER the sectionizer's own tree reference
 * (`entry.section_reference`, e.g. "III-INTRO(b)"), which is an internal
 * navigation id, not the drafted section string v1's `section_ref` parses
 * into. The v1 side parses `section_ref` as the text before the first
 * `" | "` delimiter, trimmed, with an optional leading "Section " stripped,
 * case-preserved; a ref that fails to parse is `V1_CARD_UNMAPPED`.
 *
 * QUOTE FALLBACK IS ADVISORY-ONLY THIS SLICE (spec audit M2): `quote_probe`
 * records whether a v1 card's `primary_quote` is found (zero-width-tolerant)
 * inside the supplied `v2_canonical_text`, for MEASUREMENT ONLY. It never
 * rescues or overrides a section-string outcome -- see `computeQuoteProbe`,
 * whose result is never read by any outcome-deciding branch in this file.
 *
 * SIBLING-EFFECT RULE (spec audit C2): `V2_MISSING` and `V2_NOT_ATTEMPTED`
 * are RECEIPT-level findings about the run's recall, never about any other
 * claim's triage -- see candidate-resolution.js's wiring, which only ever
 * reads a claim's OWN provision's outcome out of `provision_outcomes`.
 *
 * BEN'S RULING (option A, 2026-08-02): for claims whose value v1 cannot see
 * at all (no `VALUE_MAPPING_TABLE` entry for the claim's concept+definition,
 * or Tier 1 found nothing on the v1 side to check a value against),
 * condition 1 stays UNEVALUATED -- `V1_V2_COMPARATOR_INAPPLICABLE_TO_CLAIM`
 * -- and keeps blocking auto-pass. This module never decides that wiring
 * itself (that is candidate-resolution.js's job); it only ever emits typed,
 * honest Tier 1/Tier 2 outcomes for the wiring layer to consume.
 */

'use strict';

const { contentId, canonicalJson } = require('../canonical-bytes');
const { normaliseForMatching, indexOfIgnoringZeroWidth } = require('../zero-width-normalise');

const V1_PROVISION_SNAPSHOT_SCHEMA = 'V1_PROVISION_SNAPSHOT/V1';
const V1V2_COMPARISON_RECEIPT_SCHEMA = 'V1V2_COMPARISON_RECEIPT/V1';

// ---------------------------------------------------------------------------
// FAMILY_MAPPING_TABLE (Tier 1) -- v1 `provision_cards.provision_subtype` ->
// v2 `concept_key`, one explicit entry per subtype, NO FUZZY MATCHING (spec
// Tier 1 "(a)"). Every entry here is IDENTITY (the v1 subtype string IS the
// concept_key) because that is the only mapping this module has grounding
// evidence for: v1's own subtype vocabulary already follows the same
// REP-T-*/REP-B-* naming convention the governed v2 vocabulary registers
// (contract-bundle.js registers `REP-T-CAP` and `REP-T-CONTRACTS` verbatim;
// candidate-resolution.js's own MATERIALITY_TABLE keys on the same
// `REP-T-`/`REP-B-` prefixes). This list is the full REPRESENTATION subtype
// vocabulary observed on the real TopBuild snapshot (2026-08-02, 41 distinct
// subtypes) -- a subtype with NO entry here (never observed, or v1 recorded
// a genuinely unrecognised value) is `V1_CARD_UNMAPPED`, not force-mapped.
// Growing this table (a new subtype, or ever replacing an identity mapping
// with a non-identity one once real evidence exists) is a Fable+Ben table
// edit, exactly like VALUE_MAPPING_TABLE below -- never silent code change.
// ---------------------------------------------------------------------------
const FAMILY_MAPPING_TABLE_VERSION = 1;
const FAMILY_MAPPING_TABLE = Object.freeze([
  'REP-B-AUTH', 'REP-B-BROKERS', 'REP-B-CAP', 'REP-B-COMPLY', 'REP-B-FAIRNESS',
  'REP-B-FUNDS', 'REP-B-LIT', 'REP-B-MERGESUB', 'REP-B-NOCHANGE', 'REP-B-NOCONFLICT',
  'REP-B-NOINTEREST', 'REP-B-NOREP', 'REP-B-ORG', 'REP-B-PREAMBLE', 'REP-B-PROXY',
  'REP-B-SEC', 'REP-B-SOLVENCY', 'REP-B-TAX',
  'REP-T-AUTH', 'REP-T-BENEFITS', 'REP-T-BROKERS', 'REP-T-CAP', 'REP-T-COMPLY',
  'REP-T-CONTRACTS', 'REP-T-ENV', 'REP-T-FAIRNESS', 'REP-T-INSURANCE', 'REP-T-IP',
  'REP-T-LABOR', 'REP-T-LIT', 'REP-T-MATERIAL-CONTRACTS', 'REP-T-NOCHANGE',
  'REP-T-NOCONFLICT', 'REP-T-NOREP', 'REP-T-ORG', 'REP-T-PREAMBLE', 'REP-T-PROPERTY',
  'REP-T-SEC', 'REP-T-TAKEOVER', 'REP-T-TAX', 'REP-T-TOP-CUSTOMERS',
  // TERMF-TARGET/TERMF-TAIL: NOT grounded against a real query the way the
  // REP-* entries above are (this slice's real snapshot query pulled
  // REPRESENTATION cards only) -- included as the same identity mapping
  // VALUE_MAPPING_TABLE's own TERMF-TARGET entry pairs with, on the same
  // "v1's subtype string already follows the v2 concept_key convention"
  // grounds (contract-bundle.js registers both `TERMF-TARGET` and
  // `TERMF-TAIL` verbatim). Exercised only by this slice's synthetic
  // fixture tests until a real TERMINATION_FEE-type snapshot query grounds
  // it the way REP-T-CAP is grounded.
  'TERMF-TARGET', 'TERMF-TAIL',
].map((subtype) => Object.freeze({ v1_provision_subtype: subtype, concept_key: subtype })));

const FAMILY_MAPPING_BY_SUBTYPE = new Map(
  FAMILY_MAPPING_TABLE.map((entry) => [entry.v1_provision_subtype, entry.concept_key]),
);

// ---------------------------------------------------------------------------
// VALUE_MAPPING_TABLE (Tier 2) -- v1 value field -> v2 claim definition, only
// where BOTH sides genuinely carry a value for the same concept (spec:
// "initially the TERMF/NOSOL families where v2 reviewed slices exist").
// EMPTY OF REAL ENTRIES TODAY (one synthetic-only entry below): no v2
// reviewed slice for TERMF/NOSOL exists in this repo yet (the native
// producer currently emits REP-T-CAP only -- F28-THIRD-LIVE-RUN.md), and
// the real TopBuild snapshot this slice pins is REPRESENTATION cards,
// which the grounding facts state carry NO per-claim values at all.
// A `{concept_key, claim_definition_key, v1_value_field}` entry is added
// here ONLY by a Fable+Ben table edit once a real reviewed pair exists --
// see the spec's own governance note. `v1_snapshot` cards MAY carry an
// optional `values` object (keyed by `v1_value_field`) for families this
// table eventually covers; REPRESENTATION cards from the real export never
// populate it (see scripts/export-v1-provision-snapshot.mjs).
// ---------------------------------------------------------------------------
const VALUE_MAPPING_TABLE_VERSION = 1;
const VALUE_MAPPING_TABLE = Object.freeze([
  // Exercised only by this slice's synthetic fixture tests (spec Acceptance:
  // "value mismatch on a TERMF fixture blocks and reports both values") --
  // no real reviewed TERMF/NOSOL pair exists in the repo yet to pin as the
  // first real entry, so this one stays a documented placeholder shape a
  // test constructs its own v1 `values.TERMF_TARGET_PERCENT_OF_DEAL_VALUE`
  // against.
  Object.freeze({
    concept_key: 'TERMF-TARGET',
    // The real registered claim definition key for this concept
    // (contract-bundle.js's fixture contract, `SELLER_TERMINATION_FEE_
    // PERCENT_OF_DEAL_VALUE` -- no native-producer pipeline emits it yet,
    // so this entry is exercised only by this slice's synthetic fixture
    // tests, per the spec's own Acceptance wording).
    claim_definition_key: 'SELLER_TERMINATION_FEE_PERCENT_OF_DEAL_VALUE',
    v1_value_field: 'TERMF_TARGET_PERCENT_OF_DEAL_VALUE',
  }),
]);

// ---------------------------------------------------------------------------
// Typed reason/outcome codes.
// ---------------------------------------------------------------------------

const TIER1_OUTCOMES = Object.freeze([
  'V1V2_PRESENCE_AGREEMENT', 'V1_MISSING', 'V2_NOT_ATTEMPTED', 'V2_MISSING',
  'SECTION_MISMATCH', 'V1_CARD_UNMAPPED',
]);
const TIER2_OUTCOMES = Object.freeze(['V1V2_VALUE_AGREEMENT', 'VALUE_MISMATCH', 'V1_VALUE_ABSENT']);

class V1V2ComparatorError extends Error {
  constructor(code, message, details = {}) {
    super(message);
    this.name = 'V1V2ComparatorError';
    this.code = code;
    this.details = details;
  }
}

function fail(code, message, details) {
  throw new V1V2ComparatorError(code, message, details);
}

function requirePlainObject(value, label) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) fail('INVALID_INPUT', `${label} must be a plain object`);
  return value;
}

function requireArray(value, label) {
  if (!Array.isArray(value)) fail('INVALID_INPUT', `${label} must be an array`);
  return value;
}

function requireNonEmptyString(value, label) {
  if (typeof value !== 'string' || value.length === 0) fail('INVALID_INPUT', `${label} must be a non-empty string`);
  return value;
}

// ---------------------------------------------------------------------------
// v1 section_ref parsing (spec's pinned rule, verbatim): text before the
// first " | " delimiter, trimmed, optional leading "Section " stripped,
// case-preserved otherwise. Returns null when the ref does not parse (empty
// after trimming, or not a string) -> caller routes to V1_CARD_UNMAPPED.
// ---------------------------------------------------------------------------
const LEADING_SECTION_WORD = /^Section\s+/;

function parseV1SectionRef(sectionRef) {
  if (typeof sectionRef !== 'string') return null;
  const beforeDelimiter = sectionRef.split(' | ')[0];
  const trimmed = beforeDelimiter.trim();
  if (trimmed.length === 0) return null;
  return trimmed.replace(LEADING_SECTION_WORD, '');
}

// ---------------------------------------------------------------------------
// v2 comparison-string pinning (spec audit M1, verbatim): candidate-level
// `citation_validation.normalized_citation` when corroborated by document
// text, else `derived_citation`. Per-provision aggregation is the MAJORITY
// string across the provision's candidates; a tie routes to SECTION_MISMATCH
// review (returns null, which the caller treats as "no settled string").
// ---------------------------------------------------------------------------
function candidateComparisonString(citationValidation) {
  if (!citationValidation || typeof citationValidation !== 'object') return null;
  if (citationValidation.validation_source === 'CORROBORATED_BY_DOCUMENT_TEXT'
    && typeof citationValidation.normalized_citation === 'string') {
    return citationValidation.normalized_citation;
  }
  if (typeof citationValidation.derived_citation === 'string') return citationValidation.derived_citation;
  return null;
}

function majorityString(strings) {
  const counts = new Map();
  for (const value of strings) {
    if (value == null) continue;
    counts.set(value, (counts.get(value) || 0) + 1);
  }
  if (counts.size === 0) return null;
  let best = null;
  let bestCount = -1;
  let tie = false;
  for (const [value, count] of counts) {
    if (count > bestCount) {
      best = value;
      bestCount = count;
      tie = false;
    } else if (count === bestCount) {
      tie = true;
    }
  }
  return tie ? null : best;
}

// ---------------------------------------------------------------------------
// Build the v2 side: one record per provision instance actually present in
// `resolved[]` (the only entries carrying a real `provision_instance` +
// `concept_key` -- open_world/review_queue entries are never provisions of
// their own, see this module's header).
// ---------------------------------------------------------------------------
function buildV2Provisions(v2Side) {
  const byProvisionId = new Map();
  for (const entry of v2Side.resolved) {
    const provisionId = entry.provision_instance && entry.provision_instance.provision_instance_id;
    if (!provisionId) continue;
    let record = byProvisionId.get(provisionId);
    if (!record) {
      record = {
        provision_instance_id: provisionId,
        concept_key: entry.concept_key,
        party: entry.party,
        comparisonStrings: [],
      };
      byProvisionId.set(provisionId, record);
    }
    const citationValidation = entry.compiled_candidate && entry.compiled_candidate.citation_validation;
    record.comparisonStrings.push(candidateComparisonString(citationValidation));
  }
  const provisions = [...byProvisionId.values()].map((record) => Object.freeze({
    provision_instance_id: record.provision_instance_id,
    concept_key: record.concept_key,
    party: record.party,
    comparison_section: majorityString(record.comparisonStrings),
  }));
  return provisions;
}

// ---------------------------------------------------------------------------
// observed_section_strings -- DIAGNOSTIC ONLY (spec fix: the V2_MISSING/
// V2_NOT_ATTEMPTED split must use the caller-declared `attempted_section_
// scope`, not this derived set -- see `validateAttemptedSectionScope` and
// its use in `computeTier1`). Derived from EVERY candidate this run
// actually produced a citation_validation for, `resolved` and `open_world`
// alike, since both prove the run reached and processed that section; kept
// on the receipt purely for operator visibility into what the derived set
// would have said, never read by any outcome-deciding branch.
// ---------------------------------------------------------------------------
function buildObservedSectionStrings(v2Side) {
  const scope = new Set();
  for (const entry of v2Side.resolved) {
    const citationValidation = entry.compiled_candidate && entry.compiled_candidate.citation_validation;
    const value = candidateComparisonString(citationValidation);
    if (value != null) scope.add(value);
  }
  for (const entry of v2Side.open_world) {
    const value = candidateComparisonString(entry.citation_validation);
    if (value != null) scope.add(value);
  }
  return [...scope].sort();
}

// ---------------------------------------------------------------------------
// attempted_section_scope -- REQUIRED caller input (spec fix): the caller
// (the run orchestrator, which actually knows what it asked v2 to attempt)
// declares which drafted sections this run attempted, and Tier 1's
// V2_MISSING/V2_NOT_ATTEMPTED split is decided against THIS declared scope,
// never the derived `observed_section_strings` set -- a section with zero
// v2 candidates because extraction totally failed there is still "attempted"
// on the declared scope, so it correctly routes V2_MISSING rather than the
// derived set's V2_NOT_ATTEMPTED (which would wrongly read a total-failure
// section as never having been reached at all).
// ---------------------------------------------------------------------------
function validateAttemptedSectionScope(attemptedSectionScope) {
  requireArray(attemptedSectionScope, 'attempted_section_scope');
  for (const value of attemptedSectionScope) {
    requireNonEmptyString(value, 'attempted_section_scope[]');
  }
  return attemptedSectionScope;
}

// ---------------------------------------------------------------------------
// Tier 1.
// ---------------------------------------------------------------------------
function computeTier1({ v1Cards, v2Provisions, attemptedSectionScope }) {
  const scopeSet = new Set(attemptedSectionScope);
  const provisionsByFamily = new Map();
  for (const provision of v2Provisions) {
    const list = provisionsByFamily.get(provision.concept_key) || [];
    list.push(provision);
    provisionsByFamily.set(provision.concept_key, list);
  }

  const outcomes = [];
  const referencedProvisionIds = new Set();

  // Forward pass: one outcome per v1 card.
  for (const card of v1Cards) {
    const subtype = card.provision_subtype;
    const conceptKey = typeof subtype === 'string' ? FAMILY_MAPPING_BY_SUBTYPE.get(subtype) : undefined;
    const v1Section = parseV1SectionRef(card.section_ref);
    if (v1Section === null) {
      outcomes.push(Object.freeze({
        outcome: 'V1_CARD_UNMAPPED', reason: 'SECTION_REF_NOT_PARSEABLE', concept_key: conceptKey || null,
        v1_card_id: card.id, v1_section: null, v2_provision_instance_id: null, v2_section: null,
      }));
      continue;
    }
    if (!conceptKey) {
      outcomes.push(Object.freeze({
        outcome: 'V1_CARD_UNMAPPED', reason: 'SUBTYPE_UNMAPPED', concept_key: null,
        v1_card_id: card.id, v1_section: v1Section, v2_provision_instance_id: null, v2_section: null,
      }));
      continue;
    }
    const candidates = provisionsByFamily.get(conceptKey) || [];
    if (candidates.length === 0) {
      const outcome = scopeSet.has(v1Section) ? 'V2_MISSING' : 'V2_NOT_ATTEMPTED';
      outcomes.push(Object.freeze({
        outcome, reason: null, concept_key: conceptKey, v1_card_id: card.id,
        v1_section: v1Section, v2_provision_instance_id: null, v2_section: null,
      }));
      continue;
    }
    const agreeing = candidates.find((provision) => provision.comparison_section === v1Section);
    if (agreeing) {
      referencedProvisionIds.add(agreeing.provision_instance_id);
      outcomes.push(Object.freeze({
        outcome: 'V1V2_PRESENCE_AGREEMENT', reason: null, concept_key: conceptKey, v1_card_id: card.id,
        v1_section: v1Section, v2_provision_instance_id: agreeing.provision_instance_id,
        v2_section: agreeing.comparison_section,
      }));
      continue;
    }
    const mismatched = candidates[0];
    referencedProvisionIds.add(mismatched.provision_instance_id);
    outcomes.push(Object.freeze({
      outcome: 'SECTION_MISMATCH', reason: null, concept_key: conceptKey, v1_card_id: card.id,
      v1_section: v1Section, v2_provision_instance_id: mismatched.provision_instance_id,
      v2_section: mismatched.comparison_section,
    }));
  }

  // Reverse pass: any v2 provision whose family has NO v1 card at all
  // ("v2 found what v1 lacks") that the forward pass never referenced.
  const familiesWithV1Cards = new Set(
    v1Cards
      .map((card) => (typeof card.provision_subtype === 'string' ? FAMILY_MAPPING_BY_SUBTYPE.get(card.provision_subtype) : undefined))
      .filter((key) => key != null),
  );
  for (const provision of v2Provisions) {
    if (referencedProvisionIds.has(provision.provision_instance_id)) continue;
    if (familiesWithV1Cards.has(provision.concept_key)) continue;
    outcomes.push(Object.freeze({
      outcome: 'V1_MISSING', reason: null, concept_key: provision.concept_key, v1_card_id: null,
      v1_section: null, v2_provision_instance_id: provision.provision_instance_id,
      v2_section: provision.comparison_section,
    }));
  }

  return outcomes;
}

// ---------------------------------------------------------------------------
// Tier 2 -- only for provision outcomes that found a real v2 provision
// (PRESENCE_AGREEMENT, SECTION_MISMATCH is excluded per spec: "the dangerous
// one; always review" never reaches value comparison; V1_MISSING has no v1
// card to pull a value from -> V1_VALUE_ABSENT if a mapping exists, nothing
// otherwise). Exact canonical-JSON equality, no tolerance bands (spec).
// ---------------------------------------------------------------------------
function computeTier2({ tier1Outcomes, v1CardsById, v2Side }) {
  const claimsByProvisionAndDefinition = new Map();
  for (const entry of v2Side.resolved) {
    const provisionId = entry.provision_instance && entry.provision_instance.provision_instance_id;
    if (!provisionId) continue;
    const key = `${provisionId}::${entry.resolved_claim_definition_key}`;
    const list = claimsByProvisionAndDefinition.get(key) || [];
    list.push(entry);
    claimsByProvisionAndDefinition.set(key, list);
  }

  const results = [];
  for (const tier1 of tier1Outcomes) {
    if (tier1.outcome !== 'V1V2_PRESENCE_AGREEMENT' && tier1.outcome !== 'V1_MISSING') continue;
    if (!tier1.v2_provision_instance_id) continue;
    // Iterate every value-mapping entry whose concept_key matches this
    // provision's family -- a family may map more than one claim definition
    // (e.g. a fee amount AND a trigger-period value) once the table grows.
    for (const entry of VALUE_MAPPING_TABLE) {
      if (entry.concept_key !== tier1.concept_key) continue;
      const claimKey = `${tier1.v2_provision_instance_id}::${entry.claim_definition_key}`;
      const claims = claimsByProvisionAndDefinition.get(claimKey) || [];
      if (claims.length === 0) continue;
      const v1Card = tier1.v1_card_id != null ? v1CardsById.get(tier1.v1_card_id) : null;
      const v1Value = v1Card && v1Card.values ? v1Card.values[entry.v1_value_field] : undefined;
      for (const claim of claims) {
        const v2Value = claim.claim.canonical_value;
        if (v1Value === undefined || v1Value === null) {
          results.push(Object.freeze({
            outcome: 'V1_VALUE_ABSENT', concept_key: entry.concept_key, claim_definition_key: entry.claim_definition_key,
            v2_provision_instance_id: tier1.v2_provision_instance_id, v1_value: null, v2_value: v2Value,
          }));
          continue;
        }
        const agrees = canonicalJson(v1Value) === canonicalJson(v2Value);
        results.push(Object.freeze({
          outcome: agrees ? 'V1V2_VALUE_AGREEMENT' : 'VALUE_MISMATCH',
          concept_key: entry.concept_key, claim_definition_key: entry.claim_definition_key,
          v2_provision_instance_id: tier1.v2_provision_instance_id, v1_value: v1Value, v2_value: v2Value,
        }));
      }
    }
  }
  return results;
}

// ---------------------------------------------------------------------------
// quote_probe -- ADVISORY-ONLY (spec audit M2). Never read by any outcome
// branch above. `v2CanonicalText` is optional; absent -> every probe is
// NOT_ATTEMPTED, never treated as a negative signal.
// ---------------------------------------------------------------------------
function computeQuoteProbe({ tier1Outcomes, v1CardsById, v2CanonicalText }) {
  return tier1Outcomes
    .filter((entry) => entry.v1_card_id != null)
    .map((entry) => {
      const card = v1CardsById.get(entry.v1_card_id);
      const quote = card && typeof card.primary_quote === 'string' ? card.primary_quote : null;
      if (typeof v2CanonicalText !== 'string' || quote == null) {
        return Object.freeze({ v1_card_id: entry.v1_card_id, result: 'NOT_ATTEMPTED' });
      }
      const found = indexOfIgnoringZeroWidth(v2CanonicalText, quote) !== -1;
      return Object.freeze({ v1_card_id: entry.v1_card_id, result: found ? 'MATCHED' : 'NOT_MATCHED' });
    });
}

// ---------------------------------------------------------------------------
// Snapshot validation.
// ---------------------------------------------------------------------------
function validateV1Snapshot(snapshot) {
  requirePlainObject(snapshot, 'v1_snapshot');
  if (snapshot.schema_version !== V1_PROVISION_SNAPSHOT_SCHEMA) {
    fail('INVALID_SNAPSHOT', `v1_snapshot.schema_version must be ${V1_PROVISION_SNAPSHOT_SCHEMA}`, {
      schema_version: snapshot.schema_version,
    });
  }
  requireNonEmptyString(snapshot.snapshot_id, 'v1_snapshot.snapshot_id');
  requirePlainObject(snapshot.deal_identity_bridge, 'v1_snapshot.deal_identity_bridge');
  requireNonEmptyString(snapshot.deal_identity_bridge.production_deal_id, 'v1_snapshot.deal_identity_bridge.production_deal_id');
  requireNonEmptyString(snapshot.deal_identity_bridge.governed_deal_key, 'v1_snapshot.deal_identity_bridge.governed_deal_key');
  requireNonEmptyString(snapshot.deal_max_extraction_version, 'v1_snapshot.deal_max_extraction_version');
  requireArray(snapshot.cards, 'v1_snapshot.cards');
  for (const card of snapshot.cards) {
    requirePlainObject(card, 'v1_snapshot.cards[]');
    requireNonEmptyString(card.id, 'v1_snapshot.cards[].id');
    requireNonEmptyString(card.provision_type, 'v1_snapshot.cards[].provision_type');
    requireNonEmptyString(card.section_ref, 'v1_snapshot.cards[].section_ref');
    requireNonEmptyString(card.primary_quote, 'v1_snapshot.cards[].primary_quote');
    requireNonEmptyString(card.region_hash, 'v1_snapshot.cards[].region_hash');
    requireNonEmptyString(card.extraction_version, 'v1_snapshot.cards[].extraction_version');
  }
  return snapshot;
}

function validateV2Side(v2Side) {
  requirePlainObject(v2Side, 'v2_side');
  requireArray(v2Side.resolved, 'v2_side.resolved');
  requireArray(v2Side.open_world, 'v2_side.open_world');
  return v2Side;
}

// ---------------------------------------------------------------------------
// Staleness rule (spec audit M4, verbatim): a comparison receipt is valid
// for gating ONLY while the deal's CURRENT maximum v1 extraction_version
// EQUALS the value pinned in its snapshot at export time. `extraction_version`
// is an opaque, non-orderable label in this schema (e.g.
// "m2-00-corpus-backfill-v1"), so "equals" -- not a numeric/lexical ">" --
// is the literal, correct comparator; any reprocess that changes the label
// at all invalidates the receipt (spec: "A v1 reprocess invalidates the
// receipt ... never left standing silently").
// ---------------------------------------------------------------------------
function isComparisonReceiptStale({ snapshot, current_deal_max_extraction_version: currentMax }) {
  requirePlainObject(snapshot, 'snapshot');
  requireNonEmptyString(snapshot.deal_max_extraction_version, 'snapshot.deal_max_extraction_version');
  requireNonEmptyString(currentMax, 'current_deal_max_extraction_version');
  return currentMax !== snapshot.deal_max_extraction_version;
}

// ---------------------------------------------------------------------------
// Public entry point.
// ---------------------------------------------------------------------------

/**
 * @param {object} args
 * @param {object} args.v1_snapshot   a V1_PROVISION_SNAPSHOT/V1 (see
 *   scripts/export-v1-provision-snapshot.mjs).
 * @param {object} args.v2_side       the resolveCandidates() output for the
 *   same deal ({resolved, review_queue, open_world, residuals,
 *   limb_component_trees, resolution_receipt}).
 * @param {string[]} args.attempted_section_scope   REQUIRED: the drafted
 *   sections this run's caller declares it attempted (non-empty strings) --
 *   the Tier 1 V2_MISSING/V2_NOT_ATTEMPTED split is decided against THIS
 *   declared scope, not the citation set v2 happened to produce (spec fix:
 *   a section with zero v2 candidates at all is a total extraction
 *   failure -- V2_MISSING -- only detectable via the caller's own
 *   declaration of what it meant to attempt).
 * @param {string} [args.v2_canonical_text]  ADVISORY-ONLY quote-probe input
 *   (spec audit M2); omit to leave every probe NOT_ATTEMPTED.
 * @returns {object} a frozen V1V2_COMPARISON_RECEIPT/V1.
 */
function buildV1V2ComparisonReceipt({
  v1_snapshot: v1Snapshot, v2_side: v2Side, attempted_section_scope: attemptedSectionScopeInput,
  v2_canonical_text: v2CanonicalText,
} = {}) {
  validateV1Snapshot(v1Snapshot);
  validateV2Side(v2Side);
  const attemptedSectionScope = validateAttemptedSectionScope(attemptedSectionScopeInput);

  const v1CardsById = new Map(v1Snapshot.cards.map((card) => [card.id, card]));
  const v2Provisions = buildV2Provisions(v2Side);
  const observedSectionStrings = buildObservedSectionStrings(v2Side);
  const tier1Outcomes = computeTier1({ v1Cards: v1Snapshot.cards, v2Provisions, attemptedSectionScope });
  const tier2Outcomes = computeTier2({ tier1Outcomes, v1CardsById, v2Side });
  const quoteProbe = computeQuoteProbe({ tier1Outcomes, v1CardsById, v2CanonicalText });

  const counts = {
    v1_cards: v1Snapshot.cards.length,
    provision_outcomes: tier1Outcomes.length,
    value_outcomes: tier2Outcomes.length,
    by_tier1_outcome: Object.fromEntries(
      TIER1_OUTCOMES.map((outcome) => [outcome, tier1Outcomes.filter((entry) => entry.outcome === outcome).length]),
    ),
    by_tier2_outcome: Object.fromEntries(
      TIER2_OUTCOMES.map((outcome) => [outcome, tier2Outcomes.filter((entry) => entry.outcome === outcome).length]),
    ),
  };

  const receiptBody = {
    schema_version: V1V2_COMPARISON_RECEIPT_SCHEMA,
    v1_snapshot_id: v1Snapshot.snapshot_id,
    deal_identity_bridge: Object.freeze({ ...v1Snapshot.deal_identity_bridge }),
    family_mapping_table_version: FAMILY_MAPPING_TABLE_VERSION,
    value_mapping_table_version: VALUE_MAPPING_TABLE_VERSION,
    attempted_section_scope: attemptedSectionScope,
    observed_section_strings: observedSectionStrings,
    provision_outcomes: tier1Outcomes,
    value_outcomes: tier2Outcomes,
    quote_probe: quoteProbe,
    counts,
  };
  const comparisonReceiptId = contentId(V1V2_COMPARISON_RECEIPT_SCHEMA, receiptBody);

  return Object.freeze({
    ...receiptBody,
    attempted_section_scope: Object.freeze([...attemptedSectionScope]),
    observed_section_strings: Object.freeze(observedSectionStrings),
    provision_outcomes: Object.freeze(tier1Outcomes),
    value_outcomes: Object.freeze(tier2Outcomes),
    quote_probe: Object.freeze(quoteProbe),
    counts: Object.freeze({
      ...counts,
      by_tier1_outcome: Object.freeze(counts.by_tier1_outcome),
      by_tier2_outcome: Object.freeze(counts.by_tier2_outcome),
    }),
    v1v2_comparison_receipt_id: comparisonReceiptId,
  });
}

module.exports = {
  V1_PROVISION_SNAPSHOT_SCHEMA,
  V1V2_COMPARISON_RECEIPT_SCHEMA,
  FAMILY_MAPPING_TABLE_VERSION,
  FAMILY_MAPPING_TABLE,
  VALUE_MAPPING_TABLE_VERSION,
  VALUE_MAPPING_TABLE,
  TIER1_OUTCOMES,
  TIER2_OUTCOMES,
  V1V2ComparatorError,
  parseV1SectionRef,
  candidateComparisonString,
  buildV1V2ComparisonReceipt,
  isComparisonReceiptStale,
  // Exported for tests that want to exercise pieces directly.
  buildV2Provisions,
  buildObservedSectionStrings,
  validateAttemptedSectionScope,
};
