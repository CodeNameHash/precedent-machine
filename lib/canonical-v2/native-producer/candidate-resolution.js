/**
 * lib/canonical-v2/native-producer/candidate-resolution.js
 *
 * The missing stage between the native producer and the canonical writer.
 *
 * `runNativeExtraction` (native-extraction-run.js) produces a run receipt
 * whose `compiled_candidates` carry GENERIC, ungoverned identity:
 * `anthropic-provider.js` mints claim rows keyed on fixed
 * `*_CANDIDATE`/`OPEN_WORLD_PROPOSITION` claim_definition_keys that no
 * contract vocabulary registers, and each claim's `subject_occurrence_id`
 * is a `mintSubjectId(...)` content hash the producer invented from
 * proposal-local fields (section_reference, party_making, quotes) -- NOT a
 * real `PROVISION_INSTANCE/V1` identity per source-structure.js. The writer
 * (native-write-set-adapter.js) says so explicitly in its own file header:
 * it "passes [subject_occurrence_id] through verbatim" and "gives this
 * module no way to construct the PROVISION_INSTANCE ... row [it] would need
 * to resolve against". That is by design -- the model proposes, it never
 * assigns canonical identity. This module is where identity gets assigned:
 * deterministically, mechanically, and reviewably.
 *
 * WHAT THIS MODULE DOES, IN ORDER, PER COMPILED CANDIDATE:
 *
 *  1. PROVISION RESOLUTION. Proposals are grouped by (governing section,
 *     resolved concept family, resolved party) and ONE PROVISION_INSTANCE
 *     is minted per group, spanning the group's whole governing section
 *     (the only span this stage has evidence is real -- see "why the
 *     provision span is the section" below). A proposal whose party cannot
 *     be mechanically determined is never guessed: it goes to
 *     `review_queue` with reason `PARTY_UNRESOLVED` and gets no provision.
 *
 *  2. CONCEPT RESOLUTION. `GENERIC_CLAIM_KEY_RESOLUTION_TABLE` below is the
 *     one explicit, data-driven map from a producer's generic key to a
 *     registered `claim_definition_key` + governing `concept_key` in the
 *     supplied `contract_vocabulary`. A generic key with no table entry, or
 *     whose `canonical_value` is not one of the registered claim
 *     definition's own allowed values, is never forced onto the nearest
 *     registered key -- see the table's own comments for exactly which
 *     generic keys resolve and why the others don't.
 *
 *  3. TRIAGE against the M3 review protocol (docs/codex-program/
 *     EXECUTION-LEDGER.md, "M3 review protocol"), narrowed to the subset
 *     this deterministic stage can actually decide (no v1/v2 comparator, no
 *     lexical-disagreement net, no sampling -- those live elsewhere in the
 *     full protocol). AUTO-PASS here requires: a registered concept AND
 *     claim definition, a registered canonical_value, a resolved party, no
 *     known-defect match, exactly one evidence span with role
 *     OPERATIVE_TEXT (the mechanical proxies for "not multi-span/composed"
 *     and "not a nested or cross-referenced definition"), and no residual
 *     already retained by claims-relationships.js's own attribute/taxonomy
 *     check. Everything else lands in `review_queue`, ranked by
 *     `MATERIALITY_TABLE` (below), which encodes the ledger's ordering.
 *
 *  4. The producer's own contract (candidate-proposal-compiler.js) already
 *     rejects ABSENT/NOT_APPLICABLE proposals as typed compiler failures,
 *     never as a "resolution" of any kind; those rejections flow straight
 *     into this module's `residuals` bucket, unchanged, alongside the two
 *     failure modes this module adds of its own (an unsupported proposal
 *     kind, or a generic key that maps to a claim definition the supplied
 *     vocabulary does not actually contain).
 *
 *  5. CITATION VALIDATION NEVER SILENTLY VANISHES (docs/handoffs/
 *     F28-SECOND-LIVE-RUN.md). native-extraction-run.js compiles every
 *     proposal regardless of citation outcome and attaches a
 *     `citation_validation` object (`{status, accepted, validation_source}`)
 *     to each compiled candidate. A candidate whose citation was not
 *     `accepted` (neither constructed from the sectionizer's tree nor
 *     corroborated by the document's own cross-reference text) is never
 *     force-passed here: this module adds `CITATION_NOT_VALIDATED` to its
 *     `reasons`, which blocks auto-pass and routes it into `review_queue`
 *     exactly like any other structural gate failure. It is carried forward
 *     into `open_world` too (for proposals whose generic key has no
 *     registered mapping at all) so the fact is visible wherever the
 *     candidate ultimately lands -- never dropped, never silently accepted.
 *
 * WHY THE PROVISION SPAN IS THE WHOLE GOVERNING SECTION. A provision
 * instance's `absolute_start`/`absolute_end` must be a real, document-
 * absolute `SEMANTIC_SPAN/V1` (source-structure.js). At this stage -- before
 * `buildNativeWriteSet` -- the only span this module can independently prove
 * belongs to one governed extraction is the section itself:
 * `run_receipt.resolved_sections[i].start/end` are already document-absolute
 * (native-extraction-run.js sectionizes the whole document up front), while
 * every candidate's OWN evidence offsets are still section-local (the
 * "OPEN INTEGRATION HAZARD" native-write-set-adapter.js's header describes)
 * and only become document-absolute once THAT module shifts them. Using the
 * section as the provision's span is therefore the honest choice: it is
 * real, provable, and exactly what "the governing section" already means
 * for every proposal grouped under it -- not a placeholder pretending to be
 * a tighter span this stage cannot yet prove.
 *
 * NO MODEL CALLS, EVER. Every decision in this file is a pure function of
 * its inputs: table lookups, string-pattern matching against a fixed party
 * lexicon, and content-addressed identity recomputation using the exact
 * public formulas claims-relationships.js and native-write-set-adapter.js
 * already use elsewhere in this pipeline (reimplemented here against the
 * same public `contentId` primitive, in the same "three independent sites
 * compute the identical hash" style the adapter's own header documents --
 * claims-relationships.js is frozen and its formula helpers are not
 * exported, so recomputation is the established pattern here, not a new
 * one).
 */

'use strict';

const { contentId, canonicalJson, utf8Slice } = require('../canonical-bytes');
const { MATERIAL_CONTRACT_BUCKET_META } = require('../../taxonomy');
const { CODES } = require('../../rubric');
const { GENERAL_COVENANT_FOLLOW_ON_OWNERS } = require('../p0-product-surface-routing');
const {
  buildSemanticSpan,
  buildProvisionInstance,
  buildStructuralProvisionInstance,
  buildProvisionComponent,
} = require('../source-structure');
const { normaliseForMatching } = require('../zero-width-normalise');
const { RUN_RECEIPT_SCHEMA } = require('./native-extraction-run');
const {
  QUALIFIER_CLAIM_KEY,
  BRING_DOWN_TIER_CLAIM_KEY,
  LIMB_ASSERTION_CLAIM_KEY,
  SHARE_COUNT_CLAIM_KEY,
  SHARE_COUNT_KINDS,
  FEE_AMOUNT_CLAIM_KEY,
  FEE_TRIGGER_CLAIM_KEY,
  FEE_TAIL_PERIOD_CLAIM_KEY,
  FEE_TRIGGER_CODES,
  FEE_SIDES,
  NO_SHOP_ACTION_CLAIM_KEY,
  NO_SHOP_EXCEPTION_PREREQUISITE_CLAIM_KEY,
  NO_SHOP_NOTICE_PERIOD_CLAIM_KEY,
  NO_SHOP_MATCH_PERIOD_CLAIM_KEY,
  NO_SHOP_REMATCH_PERIOD_CLAIM_KEY,
  NO_SHOP_WAVE_B_CLAIM_KEY,
  NO_SHOP_ACTION_CODES,
  NO_SHOP_EXCEPTION_PREREQUISITE_CODES,
  NO_SHOP_WAVE_B_ASSERTION_KINDS,
  MAE_CARVEOUT_CLAIM_KEY,
  MAE_DEFINITION_PRONG_CLAIM_KEY,
  MAE_DISPROPORTIONALITY_CLAIM_KEY,
  MAE_CARVEOUT_CODES,
  MAE_DEFINITION_PRONG_CODES,
  TERMINATION_RIGHT_CLAIM_KEY,
  TERMINATION_TRIGGER_KINDS,
  TERMINATION_PARTY_SCOPES,
  TERMINATION_ASSERTION_KINDS,
  MATERIAL_CONTRACT_BUCKET_CLAIM_KEY,
  MATERIAL_CONTRACT_THRESHOLD_CLAIM_KEY,
  MATERIAL_CONTRACT_BUCKET_KINDS,
  MATERIAL_CONTRACT_THRESHOLD_KINDS,
  MATERIAL_CONTRACT_CADENCE_KINDS,
  GENERAL_COVENANT_CLAIM_KEYS,
  GENERAL_COVENANT_CODES,
  FINANCING_COVENANT_CLAIM_KEY,
  GUARANTY_CLAIM_KEY,
  TERMINATION_DAY_KINDS,
  TERMINATION_PERIOD_KINDS,
  CLOSING_CONDITION_CLAIM_KEY,
  CLOSING_CONDITION_ASSERTION_KINDS,
  REGULATORY_EFFORTS_CLAIM_KEY,
  REGULATORY_ASSERTION_KINDS,
  REGULATORY_OBLIGOR_SCOPES,
  REGULATORY_DAY_KINDS,
  CONSIDERATION_CLAIM_KEY,
  CONSIDERATION_ASSERTION_KINDS,
  APPRAISAL_STATUS_VALUES,
  IOC_RESTRICTION_CLAIM_KEY,
  IOC_ASSERTION_KINDS,
  PROXY_MEETING_COVENANT_CLAIM_KEY,
  PROXY_MEETING_ASSERTION_KINDS,
  PROMPT_ID_REEXPORT,
  PROMPT_VERSION_REEXPORT,
} = require('./anthropic-provider');
const { parseFinancingDayCount } = require('./financing-day-count-parse');
const { corroborateGuarantyKind } = require('./guaranty-corroboration');
const { ANTITRUST_REGULATORY_PARSE_VERSION, parseDivestitureCapAmount, parseFilingDeadlineDays } = require('./antitrust-regulatory-parse');
const {
  EMPTY_REGISTRY,
  validateKnownDefectRegistry,
  matchesKnownDefect,
} = require('./known-defect-registry');
const {
  mintLimbComponentTree,
  resolveQualifierAttachment: resolveLimbQualifierAttachment,
} = require('./limb-components');
const {
  QUALIFIER_KIND_LEXICON_VERSION,
  PERFORMANCE_ASSUMPTION_LEVEL_UNDERIVABLE,
  PERFORMANCE_ASSUMPTION_PATTERN,
  classifyQualifierQuote,
} = require('./qualifier-kind-lexicon');
const {
  SCHEDULE_REFERENCE_PARSE_VERSION,
  parseScheduleReference,
} = require('./schedule-reference-parse');
const {
  EMPTY_RULING_CORPUS,
  validateRulingCorpus,
  applyRuling,
} = require('./ruling-corpus');
const {
  MEASUREMENT_DATE_PARSE_VERSION,
  parseMeasurementDate,
  parseMeasurementPeriod,
} = require('./measurement-date-parse');
const {
  SHARE_COUNT_PARSE_VERSION,
  ZERO_PATTERN_TABLE_VERSION,
  parseShareCount,
} = require('./share-count-parse');
const {
  TERMINATION_FEE_PARSE_VERSION,
  parseFeeAmount,
  parseTailPeriodMonths,
} = require('./termination-fee-parse');
const {
  NO_SHOP_PERIOD_PARSE_VERSION,
  parseNoShopPeriod,
} = require('./no-shop-period-parse');
const {
  TERMINATION_DEADLINE_PARSE_VERSION,
  parseTerminationDeadline,
} = require('./termination-deadline-parse');
const {
  CURE_PERIOD_PARSE_VERSION,
  parseCurePeriod,
} = require('./cure-period-parse');
const {
  PROXY_MEETING_PARSE_VERSION,
  parseDayCount: parseProxyMeetingDayCount,
  parseAdjournmentCount,
} = require('./proxy-meeting-count-parse');
const {
  PER_SHARE_CASH_PARSE_VERSION,
  parsePerShareCash,
} = require('./per-share-cash-parse');
const {
  EXCHANGE_RATIO_PARSE_VERSION,
  parseExchangeRatio,
} = require('./exchange-ratio-parse');
const { RESTRICTION_CATEGORY_TO_CONCEPT, corroborateRestrictionCategory } = require('./ioc-corroboration');
const {
  computeCandidateDigest: computeLexicalCandidateDigest,
  isStructurallyValidReceipt: isStructurallyValidLexicalReceipt,
  familyOutcomeFromReceipt: lexicalFamilyOutcomeFromReceipt,
} = require('./lexical-disagreement-net');
const {
  SECTION_FAMILY_AI_CLASSIFIED,
  SECTION_FAMILY_AI_UNVERIFIED,
} = require('./section-family-classifier');

const RESOLUTION_RECEIPT_SCHEMA = 'NATIVE_CANDIDATE_RESOLUTION_RECEIPT/V1';
const PROVISION_CLOSURE_DOMAIN = 'CANDIDATE_RESOLUTION_PROVISION_CLOSURE/V1';
const CLAIM_CLOSURE_DOMAIN = 'CANDIDATE_RESOLUTION_CLAIM_CLOSURE/V1';
const CLAIM_EVIDENCE_DOMAIN = 'CLAIM_EVIDENCE/V1';
const CLAIM_OCCURRENCE_DOMAIN = 'CLAIM_OCCURRENCE/V1';
const CLAIM_REVISION_DOMAIN = 'CLAIM_REVISION/V1';
const RETAINED_RESIDUAL_DOMAIN = 'RETAINED_RESIDUAL/V1';
const CONTRACT_VOCABULARY_DIGEST_DOMAIN = 'CANDIDATE_RESOLUTION_CONTRACT_VOCABULARY/V1';
const GROUP_KEY_DOMAIN = 'CANDIDATE_RESOLUTION_PROVISION_GROUP/V1';
const SUPERSESSION_LINK_DOMAIN = 'CANDIDATE_RESOLUTION_SUPERSESSION_LINK/V1';

// The v1<->v2 comparator net's own receipt schema (lib/canonical-v2/native-
// producer/v1v2-comparator.js). This module NEVER imports that one -- it
// only consumes an already-built receipt handed in as `v1v2_comparison`, the
// exact decoupling the design spec's wiring section describes ("accepts an
// optional v1v2_comparison input (the comparator's receipt)"). Duplicated
// here as a literal, not re-exported from there, so this module's own input
// contract is self-describing without adding a require-time coupling
// between two otherwise-independent pure modules.
const V1V2_COMPARISON_RECEIPT_SCHEMA = 'V1V2_COMPARISON_RECEIPT/V1';

// The lexical-disagreement net's own receipt schema (lib/canonical-v2/
// native-producer/lexical-disagreement-net.js). Duplicated here as a
// literal for the same self-describing-input-contract reason
// V1V2_COMPARISON_RECEIPT_SCHEMA is duplicated above -- this module DOES
// import lexical-disagreement-net.js's pure helper functions (computeCandidateDigest,
// isStructurallyValidReceipt, familyOutcomeFromReceipt), because those are
// exactly the shared formulas the spec requires this wiring to recompute
// identically to however a receipt was built (spec section 5, "receipt
// binding enforced in the wiring") -- unlike the schema-only string check.
const LEXICAL_DISAGREEMENT_RECEIPT_SCHEMA = 'LEXICAL_DISAGREEMENT_RECEIPT/V1';

// Bump whenever GENERIC_CLAIM_KEY_RESOLUTION_TABLE changes meaning -- the
// resolution_receipt pins this so a stored resolution can always be traced
// back to the exact mapping it was produced under.
//
// V3 (this file, Task 3 of docs/superpowers/plans/2026-08-01-claim-identity-
// provenance-plan.md): rekeyed on (generic_claim_key, DETERMINISTIC kind,
// attachment position) instead of (generic_claim_key, model-supplied kind).
// The deterministic kind comes from qualifier-kind-lexicon.js's
// classifyQualifierQuote -- never from the producer's own `kind` field,
// which is now only a hint the classifier may use to route doubt. See
// docs/superpowers/specs/2026-08-01-claim-identity-provenance-design.md,
// sections 2 and 3.
//
// V4 (P1 cap-table numeric promotions, docs/superpowers/specs/2026-08-02-
// p1-captable-numerics-design.md section 4): one new unconditional entry,
// `NATIVE_CAPITALISATION_SHARE_COUNT_CANDIDATE -> REP-T-CAP`, resolved by
// its own dedicated handler (handleShareCountCandidate) rather than through
// the qualifier-kind machinery above -- the definition split
// (CAPITALIZATION_SHARE_COUNT vs RESERVED_SHARE_POOL) happens inside that
// handler on `attributes.count_kind`, not in this table (a table entry per
// count_kind would let two entries collide on the same generic key, since
// RESOLUTION_UNCONDITIONAL is keyed on generic_claim_key alone -- audit M-2).
// V5 (family-termination-fee slice, docs/superpowers/specs/2026-08-02-
// family-termination-fee-design.md section 4): THREE new unconditional
// entries, one per generic key (FEE_AMOUNT_CLAIM_KEY, FEE_TRIGGER_CLAIM_KEY,
// FEE_TAIL_PERIOD_CLAIM_KEY), each resolved by its own dedicated handler
// (handleFeeAmountCandidate / handleFeeTriggerCandidate /
// handleTailPeriodCandidate) -- mirroring the SHARE_COUNT precedent's
// "table entry present for structural completeness/duplicate-detection
// only" shape: the main dispatch loop intercepts these three generic keys
// BEFORE ever calling lookupGenericClaimKeyMapping, exactly like QUALIFIER_
// CLAIM_KEY and SHARE_COUNT_CLAIM_KEY above. The amount/trigger entries
// carry their single registered_claim_definition_key directly (no
// definition split exists in this family); what splits is the CONCEPT
// (TERMF-TARGET vs TERMF-REVERSE, on fee_side), decided inside the
// handlers, so their table `concept_key` is null. The tail entry's concept
// is fixed TERMF-TAIL (the tail is a condition on the company-side fee
// only, per spec section 1).
// V6 (family-no-shop slice, docs/superpowers/specs/2026-08-02-family-no-
// shop-design.md section 4, AUDIT-AMENDED): FIVE new unconditional entries,
// one per generic key (NO_SHOP_ACTION_CLAIM_KEY / NO_SHOP_EXCEPTION_
// PREREQUISITE_CLAIM_KEY / the three period keys), each resolved by its own
// dedicated handler (handleNoShopActionCandidate /
// handleNoShopExceptionPrerequisiteCandidate / handleNoShopPeriodCandidate)
// -- the SHARE_COUNT/fee-family "table entry present for structural
// completeness/duplicate-detection only" shape. Unlike the fee family, this
// family's registered claim definitions and concepts ALREADY EXIST (spec
// section 1: "no new fixture-contract version, no concept edits, no
// definition edits, contract_vocabulary_digest unchanged") -- every one of
// the five table rows below carries a concrete, already-registered
// concept_key, never null, because there is no fee_side-style corroborated
// split deciding which concept a resolved claim belongs to: NOSOL-PROHIBIT
// / NOSOL-EXCEPT / NOSOL-NOTICE / NOSOL-MATCH / NOSOL-REMATCH are each
// reached by exactly one generic key. `party_field: 'covenant_obligor'`,
// `party_role: 'COVENANT_OBLIGOR'` on ALL FIVE rows (audit m-2): each
// resolution-table entry structurally requires concrete party_field/
// party_role, so "same as the host obligation" is not expressible as a
// table constant -- the period obligations' obligor IS the covenant
// obligor in every corpus form.
// V7 (family-mae-definition slice, docs/superpowers/specs/2026-08-02-
// family-mae-definition-design.md section 4, AUDIT-AMENDED): THREE new
// unconditional entries, one per generic key (MAE_CARVEOUT_CLAIM_KEY /
// MAE_DEFINITION_PRONG_CLAIM_KEY / MAE_DISPROPORTIONALITY_CLAIM_KEY), each
// resolved by its own dedicated handler (handleMaeCarveoutCandidate /
// handleMaeDefinitionProngCandidate / handleMaeDisproportionalityCandidate)
// -- the SHARE_COUNT/fee/no-shop "table entry present for structural
// completeness/duplicate-detection only" shape. All three rows carry
// `concept_key: 'DEF-MAE'` (unlike the fee family, there is no
// corroborated-split concept decision here -- spec section 1: "the carve-
// out / prong / carveback distinctions live at claim-definition level
// under the one concept"). `party_field: 'definition_subject'`,
// `party_role: 'DEFINITION_SUBJECT'` on all three rows (spec section 4).
// V8 (family-termination-rights slice, docs/superpowers/specs/2026-08-02-
// family-termination-rights-design.md section 4, AUDIT-AMENDED): ONE new
// unconditional entry, `TERMINATION_RIGHT_CLAIM_KEY`, resolved by its own
// dedicated handler (handleTerminationRightCandidate) -- the SHARE_COUNT/
// fee/no-shop/MAE "table entry present for structural completeness/
// duplicate-detection only" shape (P1 audit M-2: RESOLUTION_UNCONDITIONAL
// is a Map keyed on generic_claim_key alone; two entries would silently
// last-win). `registered_claim_definition_key: null` and `concept_key:
// null` (the SHARE_COUNT precedent -- the handler makes BOTH the
// definition split, on `assertion_kind`, AND the concept split, on
// `attributes.trigger_kind`, via a frozen map (TERMINATION_TRIGGER_KIND_
// TO_CONCEPT below) -- the table row itself is never read for concept_key
// by the handler. `party_field: 'terminating_party'`, `party_role:
// 'TERMINATION_RIGHT_HOLDER'` (spec section 4, row shape pinned against
// the SHARE_COUNT row per audit m-3).
const MAPPING_TABLE_VERSION = 18;
const IOC_PARENT_PARTY_ROLE = 'IOC_COVENANT_OBLIGOR';
const IOC_RESTRICTION_COMPONENT_KEY = 'RESTRICTED_ACTION';
const IOC_RESTRICTION_COMPONENT_CLOSURE_DOMAIN = 'IOC_RESTRICTION_COMPONENT_CLOSURE/V1';

// The only concept family the native producer currently emits for qualifier
// claims (see limb-components.js's own header and this module's V2-era
// comments above): every QUALIFIER_CLAIM_KEY proposal belongs to a
// capitalisation representation, concept REP-T-CAP. Used both as the
// GENERIC_CLAIM_KEY_RESOLUTION_TABLE's concept_key for qualifier entries and
// as the ruling-corpus/review-queue "concept family" for qualifier items
// that never reach a mapping at all (spec section 4, round-2 finding 8:
// "an unmapped or open-world item carries the concept family of its
// governing section-level provision in the ruling key").
const QUALIFIER_CONCEPT_KEY = 'REP-T-CAP';
const P2_QUALIFIER_REGISTRY_CLAIM_KEYS = new Set([
  'DISCLOSURE_SCHEDULE_CARVEOUT',
  'PERFORMANCE_VESTING_ASSUMPTION',
]);

// Pre-concept review routing token (family-termination-fee slice, spec
// section 4, audit M-3): review items minted BEFORE a termination-fee
// candidate's concept is assigned (fee_side not yet corroborated) carry
// this as their `conceptFamily`, NEVER a bare null and NEVER a registered
// concept. `materialityFor`'s prefix match already covers it -- any
// `TERMF-*` token prefix-matches the existing FEES tier's `TERMF-` prefix
// (rank 20) -- so `TRIGGER_UNCORROBORATED` / `FEE_SIDE_UNCORROBORATED` /
// `AMBIGUOUS_FEE_SIDE` / `AMBIGUOUS_TRIGGER_CORROBORATION` / `FEE_TERM_*`
// review items rank correctly in the M3 queue instead of falling to
// UNCLASSIFIED (99). This is a ROUTING TOKEN ONLY -- never a registered
// concept, never published on a resolved claim.
const TERMF_PENDING_CONCEPT_FAMILY = 'TERMF-PENDING';
const ANTI_PENDING_CONCEPT_FAMILY = 'ANTI-PENDING';

const CONSIDERATION_RESOLUTION_MAP = Object.freeze({
  PER_SHARE_CASH: Object.freeze({
    concept_key: 'CONS-PERSHARE',
    claim_definition_key: 'PER_SHARE_CASH_CONSIDERATION',
  }),
  EXCHANGE_RATIO: Object.freeze({
    concept_key: 'CONS-RATIO',
    claim_definition_key: 'EXCHANGE_RATIO_VALUE',
  }),
  APPRAISAL_STATUS: Object.freeze({
    concept_key: 'CONS-DISSENT',
    claim_definition_key: 'APPRAISAL_RIGHTS_STATUS',
  }),
});

const PER_SHARE_CONTEXT_PATTERNS = Object.freeze({
  right_to_receive: /\bright to receive\b/i,
  cash: /\bin cash\b|\breceive cash\b/i,
});
const EXCHANGE_RATIO_SHARES_PATTERN = /\bshares? of\b/i;
const APPRAISAL_NOT_AVAILABLE_PATTERN = /\bno (?:dissenters['’]? or )?appraisal rights\b/i;
const APPRAISAL_AVAILABLE_WORD_PATTERN = /\bavailable\b/i;
const APPRAISAL_STATUTE_SECTION_PATTERN = /\b(?:Sections?|§)\s*\d/i;
const APPRAISAL_STATUTE_LAW_PATTERN = /\b(?:DGCL|MGCL|TBOC|Companies Act|Corporation Law|Business Organizations Code)\b/i;

function perShareContextCorroborated(quote) {
  return typeof quote === 'string'
    && PER_SHARE_CONTEXT_PATTERNS.right_to_receive.test(quote)
    && PER_SHARE_CONTEXT_PATTERNS.cash.test(quote);
}

function exchangeRatioContextCorroborated(quote, issuerStockRef) {
  return typeof quote === 'string'
    && typeof issuerStockRef === 'string'
    && issuerStockRef.length > 0
    && EXCHANGE_RATIO_SHARES_PATTERN.test(quote)
    && quote.includes(issuerStockRef);
}

function appraisalStatusCorroboration(quote, status, statuteRef = null) {
  const notAvailable = typeof quote === 'string'
    && APPRAISAL_NOT_AVAILABLE_PATTERN.test(quote)
    && APPRAISAL_AVAILABLE_WORD_PATTERN.test(quote);
  if (status === 'NOT_AVAILABLE') {
    return notAvailable
      ? Object.freeze({ corroborated: true, reason: null })
      : Object.freeze({ corroborated: false, reason: 'APPRAISAL_STATUS_UNCORROBORATED' });
  }
  if (status === 'AVAILABLE' && notAvailable) {
    return Object.freeze({ corroborated: false, reason: 'APPRAISAL_STATUS_CONTRADICTED' });
  }
  if (status === 'AVAILABLE' && (
    typeof statuteRef !== 'string'
    || statuteRef.length === 0
    || !quote.includes(statuteRef)
    || !APPRAISAL_STATUTE_SECTION_PATTERN.test(statuteRef)
    || !APPRAISAL_STATUTE_LAW_PATTERN.test(statuteRef)
  )) {
    return Object.freeze({
      corroborated: false,
      reason: 'APPRAISAL_STATUTE_REQUIRED_FOR_NECESSARY_IMPLICATION',
    });
  }
  return Object.freeze({ corroborated: true, reason: null });
}

// The exact field list claims-relationships.js's buildClaimRevision hashes
// into CLAIM_REVISION/V1 (mirrored from native-write-set-adapter.js's own
// CLAIM_REVISION_PAYLOAD_FIELDS -- see this file's header for why
// reimplementing the public formula, rather than re-calling the frozen
// builder, is the established pattern for a rekeying stage like this one).
const CLAIM_REVISION_PAYLOAD_FIELDS = Object.freeze([
  'claim_occurrence_id', 'subject_occurrence_id', 'claim_definition_key', 'claim_definition_version',
  'ordinal', 'state', 'raw_value', 'canonical_value', 'unit', 'day_basis', 'denominator',
  'scope', 'applicability', 'not_examined', 'failure', 'attributes', 'taxonomy_codes',
  'extraction_version', 'normalisation_version', 'derivation_version',
]);

/**
 * THE ONE CONCEPT-RESOLUTION TABLE. Every generic claim_definition_key the
 * native producer can emit either has an entry here (naming the registered
 * claim_definition_key/concept_key/party attribute it resolves into) or it
 * doesn't -- and a missing entry is a decision, not an oversight.
 *
 * KEYED ON (generic_claim_key, qualifier_kind) -- NOT ON generic_claim_key
 * ALONE (docs/handoffs/F28-FIRST-LIVE-RUN.md defect 4). The first version of
 * this table routed EVERY `QUALIFIER_CLAIM_KEY` proposal to
 * `REPRESENTATION_ACCURACY_STANDARD` regardless of the model's own `kind`
 * field (ACCURACY / KNOWLEDGE / THRESHOLD / TEMPORAL). That claim
 * definition's `canonical_value` is a controlled `ACCURACY_STANDARD` code,
 * so a THRESHOLD or TEMPORAL qualifier -- which correctly carries
 * `canonical_value: null` per the producer's own "never invent a code"
 * instruction -- would resolve, then fail `canonicalValueAllowed`, then
 * quarantine as `INVALID_CANONICAL_VALUE`: a real extraction, permanently
 * unpublishable, for a reason that has nothing to do with extraction
 * quality. On the F28 live run this quarantined all 15 of 15 resolvable
 * claims, because TEMPORAL/THRESHOLD qualifiers ("as of [date]", "except as
 * set forth above") are two of the most common qualifier shapes in a real
 * capitalisation rep.
 *
 *  - `(QUALIFIER_CLAIM_KEY, 'ACCURACY')` maps to `REPRESENTATION_ACCURACY_
 *    STANDARD`: the one case where the model's own controlled code IS an
 *    `ACCURACY_STANDARD` code, matching that claim definition's allowed
 *    values.
 *  - `(QUALIFIER_CLAIM_KEY, 'KNOWLEDGE')`, `'THRESHOLD'`, `'TEMPORAL'`, and
 *    any qualifier whose `kind` is missing/unrecognised are deliberately
 *    ABSENT. The governed vocabulary registers no claim definition for any
 *    of them today. Forcing them onto `REPRESENTATION_ACCURACY_STANDARD`
 *    anyway would be exactly the "nearest fit" forcing rule 2 forbids; they
 *    resolve as open-world instead (`UNMAPPED_GENERIC_CLAIM_KEY`), which is
 *    the *correct* outcome, not a defect -- see the commonality report,
 *    which is where a real recurring TEMPORAL/THRESHOLD shape is meant to
 *    surface as a candidate for a NEW registered claim definition, not get
 *    silently misrouted into an existing, unrelated one.
 *  - `BRING_DOWN_TIER_CLAIM_KEY` (bring-down accuracy tiers) has no `kind`
 *    concept at all -- every tier carries a controlled `ACCURACY_STANDARD`
 *    code by construction (RESPONSE_SHAPE's `tiers[].accuracy_standard`) --
 *    so its entry is unconditional (`qualifier_kind: null`, meaning "matches
 *    regardless of kind").
 *  - `LIMB_ASSERTION_CLAIM_KEY` (the bare text of a representation limb) is
 *    deliberately ABSENT from this table. It carries no canonical_value at
 *    all -- it is a verbatim assertion, not a controlled-code claim -- and
 *    the governed vocabulary has no registered "a limb was asserted"
 *    presence claim for this family. It resolves as open-world instead.
 *  - `OPEN_WORLD_CLAIM_KEY` never reaches this table: every compiled
 *    candidate whose `extraction_provenance.proposal_kind === 'OPEN_WORLD'`
 *    is routed to the open-world bucket before concept resolution is
 *    attempted at all (the model already flagged it as novel).
 *
 * `party_field` names the attribute on the compiled claim's own `attributes`
 * object that carries the proposal's stated party (see anthropic-provider.js
 * `shapeRepresentationInstance`/`shapeBringDownCondition`); `party_role`
 * is the governed `party.role` this stage mints once a party is resolved
 * (see `resolveParty`).
 */
const GENERIC_CLAIM_KEY_RESOLUTION_TABLE = Object.freeze([
  // (QUALIFIER, ACCURACY, CHAPEAU) -- the only qualifier shape that may
  // resolve to REPRESENTATION_ACCURACY_STANDARD (spec section 3, section 2
  // rule 6). ITEM/TRAILING ACCURACY deliberately have NO entry here: they
  // route to review instead (see resolveQualifierCandidate), never forced
  // onto this same registered key -- narrowing the key, not widening it, is
  // the whole point of the V2->V3 rekey.
  Object.freeze({
    generic_claim_key: QUALIFIER_CLAIM_KEY,
    deterministic_kind: 'ACCURACY',
    attachment_position: 'CHAPEAU',
    registered_claim_definition_key: 'REPRESENTATION_ACCURACY_STANDARD',
    concept_key: QUALIFIER_CONCEPT_KEY,
    party_field: 'party_making',
    party_role: 'REPRESENTATION_MAKER',
  }),
  // (QUALIFIER, TEMPORAL, *) -- attachment-position-agnostic (spec section
  // 3's "*"): a measurement date is equally meaningful whether it dates the
  // whole representation or one limb. Reaching this registered key ALSO
  // requires the lexicon's own measurementDateEligible flag AND a resolved
  // ISO value from measurement-date-parse.js -- both gated in
  // resolveQualifierCandidate, never by this table alone.
  Object.freeze({
    generic_claim_key: QUALIFIER_CLAIM_KEY,
    deterministic_kind: 'TEMPORAL',
    attachment_position: null,
    registered_claim_definition_key: 'REPRESENTATION_MEASUREMENT_DATE',
    concept_key: QUALIFIER_CONCEPT_KEY,
    party_field: 'party_making',
    party_role: 'REPRESENTATION_MAKER',
  }),
  // (QUALIFIER, KNOWLEDGE, *) -- also attachment-position-agnostic. Fires
  // whenever the lexicon's KNOWLEDGE family matches; canonical_value is
  // always `true` per KNOWLEDGE_QUALIFIER's registered contract.
  Object.freeze({
    generic_claim_key: QUALIFIER_CLAIM_KEY,
    deterministic_kind: 'KNOWLEDGE',
    attachment_position: null,
    registered_claim_definition_key: 'KNOWLEDGE_QUALIFIER',
    concept_key: QUALIFIER_CONCEPT_KEY,
    party_field: 'party_making',
    party_role: 'REPRESENTATION_MAKER',
  }),
  Object.freeze({
    generic_claim_key: QUALIFIER_CLAIM_KEY,
    deterministic_kind: 'DISCLOSURE_SCHEDULE_CARVEOUT',
    attachment_position: 'CHAPEAU',
    registered_claim_definition_key: 'DISCLOSURE_SCHEDULE_CARVEOUT',
    concept_key: QUALIFIER_CONCEPT_KEY,
    party_field: 'party_making',
    party_role: 'REPRESENTATION_MAKER',
  }),
  Object.freeze({
    generic_claim_key: QUALIFIER_CLAIM_KEY,
    deterministic_kind: 'DISCLOSURE_SCHEDULE_CARVEOUT',
    attachment_position: 'ITEM',
    registered_claim_definition_key: 'DISCLOSURE_SCHEDULE_CARVEOUT',
    concept_key: QUALIFIER_CONCEPT_KEY,
    party_field: 'party_making',
    party_role: 'REPRESENTATION_MAKER',
  }),
  Object.freeze({
    generic_claim_key: QUALIFIER_CLAIM_KEY,
    deterministic_kind: 'PERFORMANCE_ASSUMPTION',
    attachment_position: 'ITEM',
    registered_claim_definition_key: 'PERFORMANCE_VESTING_ASSUMPTION',
    concept_key: QUALIFIER_CONCEPT_KEY,
    party_field: 'party_making',
    party_role: 'REPRESENTATION_MAKER',
  }),
  // Bring-down accuracy tiers carry no `kind`/attachment concept at all --
  // every tier already carries a controlled ACCURACY_STANDARD code by
  // construction (RESPONSE_SHAPE's tiers[].accuracy_standard) -- so this
  // entry is unconditional on both new key dimensions, exactly as it was
  // unconditional on qualifier_kind under V2.
  Object.freeze({
    generic_claim_key: BRING_DOWN_TIER_CLAIM_KEY,
    deterministic_kind: null,
    attachment_position: null,
    registered_claim_definition_key: 'REPRESENTATION_ACCURACY_STANDARD',
    concept_key: 'COND-B-REP',
    party_field: 'condition_obligor',
    party_role: 'CONDITION_OBLIGOR',
  }),
  // THRESHOLD, and every other (kind, attachment_position) pair not listed
  // above, are deliberately ABSENT -- open world, unchanged (spec section 3:
  // "THRESHOLD stays open world, feeding the commonality report").
  //
  // SHARE_COUNT (P1 cap-table numerics, MAPPING_TABLE_VERSION 4): ONE
  // unconditional entry (audit M-2 -- two entries keyed on the same generic
  // key would silently last-win in RESOLUTION_UNCONDITIONAL, a Map). Both
  // registered claim definitions live under REP-T-CAP; the definition split
  // is made inside handleShareCountCandidate on attributes.count_kind, not
  // here. `registered_claim_definition_key` is intentionally null -- there
  // is no single answer for this table shape, and the handler never reads
  // this field (it looks the mapping up only to confirm SHARE_COUNT has a
  // table entry at all, distinguishing "route to the dedicated handler"
  // from "no entry, open world").
  Object.freeze({
    generic_claim_key: SHARE_COUNT_CLAIM_KEY,
    deterministic_kind: null,
    attachment_position: null,
    registered_claim_definition_key: null,
    concept_key: QUALIFIER_CONCEPT_KEY,
    party_field: 'party_making',
    party_role: 'REPRESENTATION_MAKER',
  }),
  // TERMINATION_FEE_AMOUNT / TERMINATION_FEE_TRIGGER / TERMINATION_FEE_
  // TAIL_PERIOD_MONTHS (family-termination-fee slice, MAPPING_TABLE_VERSION
  // 5): three unconditional entries, resolved by their own dedicated
  // handlers (see the MAPPING_TABLE_VERSION comment above). The amount and
  // trigger entries carry concept_key: null -- the concept split (TERMF-
  // TARGET vs TERMF-REVERSE) is made inside the handler on the corroborated
  // fee_side, never here.
  Object.freeze({
    generic_claim_key: FEE_AMOUNT_CLAIM_KEY,
    deterministic_kind: null,
    attachment_position: null,
    registered_claim_definition_key: 'TERMINATION_FEE_AMOUNT',
    concept_key: null,
    party_field: 'payer_party',
    party_role: 'FEE_PAYER',
  }),
  Object.freeze({
    generic_claim_key: FEE_TRIGGER_CLAIM_KEY,
    deterministic_kind: null,
    attachment_position: null,
    registered_claim_definition_key: 'TERMINATION_FEE_TRIGGER',
    concept_key: null,
    party_field: null,
    party_role: 'FEE_PAYER',
  }),
  Object.freeze({
    generic_claim_key: FEE_TAIL_PERIOD_CLAIM_KEY,
    deterministic_kind: null,
    attachment_position: null,
    registered_claim_definition_key: 'TERMINATION_FEE_TAIL_PERIOD_MONTHS',
    concept_key: 'TERMF-TAIL',
    party_field: null,
    party_role: 'FEE_PAYER',
  }),
  // NO_SHOP_PROHIBITED_ACTION / NO_SHOP_EXCEPTION_PREREQUISITE /
  // NO_SHOP_NOTICE_PERIOD_DAYS / NO_SHOP_INITIAL_MATCH_PERIOD_DAYS /
  // NO_SHOP_SUBSEQUENT_MATCH_PERIOD_DAYS (family-no-shop slice,
  // MAPPING_TABLE_VERSION 6, spec section 4): five unconditional entries,
  // resolved by their own dedicated handlers (see the MAPPING_TABLE_VERSION
  // comment above). `party_field`/`party_role` are the shared table
  // constants on all five rows (audit m-2).
  Object.freeze({
    generic_claim_key: NO_SHOP_ACTION_CLAIM_KEY,
    deterministic_kind: null,
    attachment_position: null,
    registered_claim_definition_key: 'NO_SHOP_PROHIBITED_ACTION',
    concept_key: 'NOSOL-PROHIBIT',
    party_field: 'covenant_obligor',
    party_role: 'COVENANT_OBLIGOR',
  }),
  Object.freeze({
    generic_claim_key: NO_SHOP_EXCEPTION_PREREQUISITE_CLAIM_KEY,
    deterministic_kind: null,
    attachment_position: null,
    registered_claim_definition_key: 'NO_SHOP_EXCEPTION_PREREQUISITE',
    concept_key: 'NOSOL-EXCEPT',
    party_field: 'covenant_obligor',
    party_role: 'COVENANT_OBLIGOR',
  }),
  Object.freeze({
    generic_claim_key: NO_SHOP_NOTICE_PERIOD_CLAIM_KEY,
    deterministic_kind: null,
    attachment_position: null,
    registered_claim_definition_key: 'NO_SHOP_NOTICE_PERIOD_DAYS',
    concept_key: 'NOSOL-NOTICE',
    party_field: 'covenant_obligor',
    party_role: 'COVENANT_OBLIGOR',
  }),
  Object.freeze({
    generic_claim_key: NO_SHOP_MATCH_PERIOD_CLAIM_KEY,
    deterministic_kind: null,
    attachment_position: null,
    registered_claim_definition_key: 'NO_SHOP_INITIAL_MATCH_PERIOD_DAYS',
    concept_key: 'NOSOL-MATCH',
    party_field: 'covenant_obligor',
    party_role: 'COVENANT_OBLIGOR',
  }),
  Object.freeze({
    generic_claim_key: NO_SHOP_REMATCH_PERIOD_CLAIM_KEY,
    deterministic_kind: null,
    attachment_position: null,
    registered_claim_definition_key: 'NO_SHOP_SUBSEQUENT_MATCH_PERIOD_DAYS',
    concept_key: 'NOSOL-REMATCH',
    party_field: 'covenant_obligor',
    party_role: 'COVENANT_OBLIGOR',
  }),
  Object.freeze({
    generic_claim_key: NO_SHOP_WAVE_B_CLAIM_KEY,
    deterministic_kind: null,
    attachment_position: null,
    registered_claim_definition_key: null,
    concept_key: null,
    party_field: 'covenant_obligor',
    party_role: 'COVENANT_OBLIGOR',
  }),
  // MAE_CARVEOUT / MAE_DEFINITION_PRONG / MAE_DISPROPORTIONALITY_CARVEBACK
  // (family-mae-definition slice, MAPPING_TABLE_VERSION 7, spec section 4):
  // three unconditional entries, resolved by their own dedicated handlers
  // (see the MAPPING_TABLE_VERSION comment above). All three share
  // `concept_key: 'DEF-MAE'` -- there is no corroborated concept split in
  // this family (unlike TERMF-TARGET/TERMF-REVERSE).
  Object.freeze({
    generic_claim_key: MAE_CARVEOUT_CLAIM_KEY,
    deterministic_kind: null,
    attachment_position: null,
    registered_claim_definition_key: 'MAE_CARVEOUT',
    concept_key: 'DEF-MAE',
    party_field: 'definition_subject',
    party_role: 'DEFINITION_SUBJECT',
  }),
  Object.freeze({
    generic_claim_key: MAE_DEFINITION_PRONG_CLAIM_KEY,
    deterministic_kind: null,
    attachment_position: null,
    registered_claim_definition_key: 'MAE_DEFINITION_PRONG',
    concept_key: 'DEF-MAE',
    party_field: 'definition_subject',
    party_role: 'DEFINITION_SUBJECT',
  }),
  Object.freeze({
    generic_claim_key: MAE_DISPROPORTIONALITY_CLAIM_KEY,
    deterministic_kind: null,
    attachment_position: null,
    registered_claim_definition_key: 'MAE_DISPROPORTIONALITY_CARVEBACK',
    concept_key: 'DEF-MAE',
    party_field: 'definition_subject',
    party_role: 'DEFINITION_SUBJECT',
  }),
  // TERMINATION_RIGHT (family-termination-rights slice, MAPPING_TABLE_
  // VERSION 8, spec section 4): ONE unconditional entry, resolved by its
  // own dedicated handler (handleTerminationRightCandidate). Both
  // `registered_claim_definition_key` and `concept_key` are null -- the
  // handler makes BOTH splits (definition on assertion_kind, concept on
  // trigger_kind); this row exists only so the generic key is present in
  // the table for structural completeness/duplicate-detection (the
  // SHARE_COUNT precedent).
  Object.freeze({
    generic_claim_key: TERMINATION_RIGHT_CLAIM_KEY,
    deterministic_kind: null,
    attachment_position: null,
    registered_claim_definition_key: null,
    concept_key: null,
    party_field: 'terminating_party',
    party_role: 'TERMINATION_RIGHT_HOLDER',
  }),
  Object.freeze({
    generic_claim_key: PROXY_MEETING_COVENANT_CLAIM_KEY,
    deterministic_kind: null,
    attachment_position: null,
    registered_claim_definition_key: null,
    concept_key: null,
    party_field: 'control_party',
    party_role: 'MEETING_ADJOURNMENT_CONTROLLER',
  }),
  Object.freeze({
    generic_claim_key: IOC_RESTRICTION_CLAIM_KEY,
    deterministic_kind: null,
    attachment_position: null,
    registered_claim_definition_key: null,
    concept_key: null,
    party_field: null,
    party_role: null,
  }),
  Object.freeze({
    generic_claim_key: CLOSING_CONDITION_CLAIM_KEY,
    deterministic_kind: null,
    attachment_position: null,
    registered_claim_definition_key: null,
    concept_key: null,
    party_field: 'condition_obligor',
    party_role: 'CONDITION_OBLIGOR',
  }),
  Object.freeze({
    generic_claim_key: REGULATORY_EFFORTS_CLAIM_KEY,
    deterministic_kind: null,
    attachment_position: null,
    registered_claim_definition_key: null,
    concept_key: null,
    party_field: 'obligor_party',
    party_role: 'REGULATORY_COVENANT_OBLIGOR',
  }),
  // CONSIDERATION (Wave A): the handler makes both the concept and claim-
  // definition split from assertion_kind. Consideration has no semantic
  // party, so both party fields are null in the table.
  Object.freeze({
    generic_claim_key: CONSIDERATION_CLAIM_KEY,
    deterministic_kind: null,
    attachment_position: null,
    registered_claim_definition_key: null,
    concept_key: null,
    party_field: null,
    party_role: null,
  }),
  Object.freeze({
    generic_claim_key: MATERIAL_CONTRACT_BUCKET_CLAIM_KEY,
    deterministic_kind: null,
    attachment_position: null,
    registered_claim_definition_key: 'MATERIAL_CONTRACT_BUCKET_PRESENT',
    concept_key: 'REP-T-CONTRACTS',
    party_field: 'party_making',
    party_role: 'REPRESENTATION_MAKER',
  }),
  Object.freeze({
    generic_claim_key: MATERIAL_CONTRACT_THRESHOLD_CLAIM_KEY,
    deterministic_kind: null,
    attachment_position: null,
    registered_claim_definition_key: 'MATERIAL_CONTRACT_THRESHOLD_STRUCTURE',
    concept_key: 'REP-T-CONTRACTS',
    party_field: 'party_making',
    party_role: 'REPRESENTATION_MAKER',
  }),
  Object.freeze({
    generic_claim_key: FINANCING_COVENANT_CLAIM_KEY,
    deterministic_kind: null,
    attachment_position: null,
    registered_claim_definition_key: null,
    concept_key: null,
    party_field: 'obligor',
    party_role: 'FINANCING_COVENANT_OBLIGOR',
  }),
  Object.freeze({
    generic_claim_key: GUARANTY_CLAIM_KEY,
    deterministic_kind: null,
    attachment_position: null,
    registered_claim_definition_key: null,
    concept_key: null,
    party_field: null,
    party_role: null,
  }),
  ...GENERAL_COVENANT_CODES.map((code) => Object.freeze({
    generic_claim_key: GENERAL_COVENANT_CLAIM_KEYS[code],
    deterministic_kind: null,
    attachment_position: null,
    registered_claim_definition_key: 'GENERAL_COVENANT_PRESENT',
    concept_key: code,
    party_field: 'covenant_obligor',
    party_role: 'COVENANT_OBLIGOR',
  })),
]);

// Lookup tries the fully-keyed (kind, attachment_position) entry first, then
// the kind-with-any-attachment ("*") entry, then the fully-unconditional
// entry (BRING_DOWN_TIER_CLAIM_KEY) -- never the reverse, so a kind-specific
// gap (e.g. QUALIFIER_CLAIM_KEY + ACCURACY + ITEM) can never fall through to
// an entry meant for a different kind or a different generic_claim_key.
const RESOLUTION_BY_KIND_AND_POSITION = new Map(
  GENERIC_CLAIM_KEY_RESOLUTION_TABLE
    .filter((entry) => entry.deterministic_kind != null && entry.attachment_position != null)
    .map((entry) => [`${entry.generic_claim_key}::${entry.deterministic_kind}::${entry.attachment_position}`, entry]),
);
const RESOLUTION_BY_KIND_ANY_POSITION = new Map(
  GENERIC_CLAIM_KEY_RESOLUTION_TABLE
    .filter((entry) => entry.deterministic_kind != null && entry.attachment_position == null)
    .map((entry) => [`${entry.generic_claim_key}::${entry.deterministic_kind}`, entry]),
);
const RESOLUTION_UNCONDITIONAL = new Map(
  GENERIC_CLAIM_KEY_RESOLUTION_TABLE
    .filter((entry) => entry.deterministic_kind == null)
    .map((entry) => [entry.generic_claim_key, entry]),
);

function lookupGenericClaimKeyMapping(genericClaimKey, deterministicKind, attachmentPosition) {
  if (typeof deterministicKind === 'string' && deterministicKind.length > 0) {
    if (typeof attachmentPosition === 'string' && attachmentPosition.length > 0) {
      const keyed = RESOLUTION_BY_KIND_AND_POSITION.get(`${genericClaimKey}::${deterministicKind}::${attachmentPosition}`);
      if (keyed) return keyed;
    }
    const anyPosition = RESOLUTION_BY_KIND_ANY_POSITION.get(`${genericClaimKey}::${deterministicKind}`);
    if (anyPosition) return anyPosition;
  }
  return RESOLUTION_UNCONDITIONAL.get(genericClaimKey) || null;
}

/**
 * A fixed, deal-agnostic lexicon of standard M&A defined-term roles. This is
 * the ONLY mechanism this module uses to turn a proposal's stated party
 * string (e.g. "the Company", verbatim from the agreement) into a governed
 * `party.capacity`. A party string that matches nothing here does not get a
 * guessed capacity -- see `resolveParty`, which returns `null` (never a
 * default) when no pattern matches, sending the proposal to `review_queue`
 * with reason `PARTY_UNRESOLVED` rather than inventing one.
 */
const PARTY_CAPACITY_LEXICON = Object.freeze([
  Object.freeze({ pattern: /\bcompany\b/i, capacity: 'TARGET' }),
  Object.freeze({ pattern: /\btarget\b/i, capacity: 'TARGET' }),
  Object.freeze({ pattern: /\bparent\b/i, capacity: 'BUYER' }),
  Object.freeze({ pattern: /\bpurchaser\b/i, capacity: 'BUYER' }),
  Object.freeze({ pattern: /\bbuyer\b/i, capacity: 'BUYER' }),
  Object.freeze({ pattern: /\bpubco\b/i, capacity: 'BUYER' }),
  Object.freeze({ pattern: /merger\s*sub/i, capacity: 'BUYER_AFFILIATE' }),
  Object.freeze({ pattern: /\bseller\b/i, capacity: 'SELLER' }),
]);

/**
 * Legal-materiality ranking, data-driven, lower rank = more material = sorts
 * first in `review_queue`. The first six tiers are the ledger's own list
 * verbatim (docs/codex-program/EXECUTION-LEDGER.md, "M3 review protocol":
 * "termination rights, fees, MAE, fiduciary provisions, no-shop exceptions,
 * consideration and closing conditions ahead of notices and administrative
 * clauses"). `REPRESENTATIONS` is NOT in that list -- it is this module's
 * own addition, needed because `REP-T-CAP` (the only family this producer
 * currently emits) has no other home. Positioned between no-shop exceptions
 * and consideration on the judgment that a false representation is a
 * closing/indemnity trigger of comparable weight to a no-shop breach; this
 * is a legal-materiality call this module is making, not one the ledger
 * already made, and it is flagged as such in the build report for Ben/legal
 * review, not silently presented as settled.
 */
// CAPITAL_STRUCTURE, rank 52 (P1 cap-table numerics, spec section 4, audit
// minor): sits between NO_SHOP_EXCEPTIONS (50) and REPRESENTATIONS (55) --
// deliberately NOT 50 or 55, since 50 collides with NO_SHOP_EXCEPTIONS and
// 55's own REP-T-/REP-B- prefix match would otherwise already catch these
// two claim definitions (they both live under REP-T-CAP). Reached ONLY via
// the definition-key override map below, never via a concept_key prefix --
// a resolved share-count/reserved-pool claim's materiality is a property of
// WHAT it is (a cap-table number), not of which representation concept
// happens to house it this slice. Flagged for Ben/legal review in the PR
// body, exactly like the pre-existing REPRESENTATIONS tier's own flag.
const CAPITAL_STRUCTURE_MATERIALITY_TIER = Object.freeze({
  rank: 52, label: 'CAPITAL_STRUCTURE', concept_key_prefixes: Object.freeze([]),
});

const MATERIALITY_TABLE = Object.freeze([
  Object.freeze({ rank: 10, label: 'TERMINATION_RIGHTS', concept_key_prefixes: Object.freeze(['TERMR-']) }),
  Object.freeze({ rank: 20, label: 'FEES', concept_key_prefixes: Object.freeze(['TERMF-', 'DEF-WILLFUL']) }),
  // rank 30 MAE tier, prefix wired (family-mae-definition slice, spec
  // section 4): the ledger's own ranking ("termination rights, fees, MAE,
  // ..."), no new legal call -- flagged in the PR body per the spec's own
  // "the one-line diff is still flagged in the PR" pin.
  Object.freeze({ rank: 30, label: 'MAE', concept_key_prefixes: Object.freeze(['DEF-MAE']) }),
  Object.freeze({
    rank: 40,
    label: 'FIDUCIARY',
    concept_key_prefixes: Object.freeze(['DEF-ACQPROPOSAL', 'DEF-SUPERIOR', 'DEF-INTERVENING']),
  }),
  Object.freeze({ rank: 50, label: 'NO_SHOP_EXCEPTIONS', concept_key_prefixes: Object.freeze(['NOSOL-']) }),
  CAPITAL_STRUCTURE_MATERIALITY_TIER,
  Object.freeze({
    rank: 55,
    label: 'REPRESENTATIONS',
    concept_key_prefixes: Object.freeze(['REP-T-', 'REP-B-', 'DEF-KNOWLEDGE']),
  }),
  Object.freeze({ rank: 60, label: 'CONSIDERATION', concept_key_prefixes: Object.freeze(['CONS-']) }),
  Object.freeze({ rank: 63, label: 'REGULATORY_EFFORTS', concept_key_prefixes: Object.freeze(['ANTI-']) }),
  Object.freeze({ rank: 65, label: 'INTERIM_OPERATING_COVENANTS', concept_key_prefixes: Object.freeze(['IOC-']) }),
  Object.freeze({ rank: 70, label: 'CLOSING_CONDITIONS', concept_key_prefixes: Object.freeze(['COND-']) }),
  Object.freeze({ rank: 74, label: 'GUARANTY_FINANCING_PARTY', concept_key_prefixes: Object.freeze(['GTY-PERF', 'GTY-DELIVERY']) }),
  Object.freeze({ rank: 75, label: 'FINANCING_COVENANTS', concept_key_prefixes: Object.freeze(['COV-FINANCING', 'COV-PAYOFF', 'COV-MARKETING']) }),
  Object.freeze({ rank: 80, label: 'PROXY_MEETING_COVENANTS', concept_key_prefixes: Object.freeze(['COV-PROXY', 'COV-MEETING']) }),
  Object.freeze({ rank: 84, label: 'DIVIDENDS', concept_key_prefixes: Object.freeze(['DIVD-']) }),
  Object.freeze({ rank: 85, label: 'DNO_INDEMNIFICATION', concept_key_prefixes: Object.freeze(['DNO-']) }),
  Object.freeze({ rank: 90, label: 'NOTICES_ADMINISTRATIVE', concept_key_prefixes: Object.freeze(['NOTICE-', 'ADMIN-']) }),
]);
const UNCLASSIFIED_MATERIALITY = Object.freeze({ rank: 99, label: 'UNCLASSIFIED' });

// Definition-key override map (spec section 4): consulted BEFORE the
// concept-key prefix match, so the two P1 claim definitions always resolve
// to CAPITAL_STRUCTURE regardless of which concept houses them. Only the
// two RESOLVED-path materialityFor call sites (the qualifier path and the
// generic/bring-down-tier path) have a claim definition key in scope to
// pass here -- the five mapping-null call sites are pinned to stay
// concept-based (spec section 4: "so an implementer doesn't refactor them").
const MATERIALITY_DEFINITION_KEY_OVERRIDES = Object.freeze({
  CAPITALIZATION_SHARE_COUNT: CAPITAL_STRUCTURE_MATERIALITY_TIER,
  RESERVED_SHARE_POOL: CAPITAL_STRUCTURE_MATERIALITY_TIER,
});

class CandidateResolutionError extends Error {
  constructor(code, message, details = {}) {
    super(message);
    this.name = 'CandidateResolutionError';
    this.code = code;
    this.details = details;
  }
}

function fail(code, message, details) {
  throw new CandidateResolutionError(code, message, details);
}

function requirePlainObject(value, label) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    fail('INVALID_INPUT', `${label} must be a plain object`);
  }
  return value;
}

function requireNonEmptyString(value, label) {
  if (typeof value !== 'string' || value.length === 0) {
    fail('INVALID_INPUT', `${label} must be a non-empty string`);
  }
  return value;
}

function requireArray(value, label) {
  if (!Array.isArray(value)) fail('INVALID_INPUT', `${label} must be an array`);
  return value;
}

// ---------------------------------------------------------------------------
// Materiality.
// ---------------------------------------------------------------------------

function materialityFor({ conceptKey, canonicalValue, claimDefinitionKey } = {}) {
  if (typeof claimDefinitionKey === 'string'
    && Object.hasOwn(MATERIALITY_DEFINITION_KEY_OVERRIDES, claimDefinitionKey)) {
    return MATERIALITY_DEFINITION_KEY_OVERRIDES[claimDefinitionKey];
  }
  if (typeof canonicalValue === 'string' && canonicalValue.includes('MAE')) {
    const mae = MATERIALITY_TABLE.find((tier) => tier.label === 'MAE');
    if (mae) return mae;
  }
  if (typeof conceptKey === 'string') {
    const tier = MATERIALITY_TABLE.find(
      (candidate) => candidate.concept_key_prefixes.some((prefix) => conceptKey.startsWith(prefix)),
    );
    if (tier) return tier;
  }
  return UNCLASSIFIED_MATERIALITY;
}

// ---------------------------------------------------------------------------
// Canonical-value registration (mirrors validate-write-set.js's own
// `canonicalValueAllowed`, reimplemented for the same "compute the check
// before the real validator has to" reason documented in the file header).
// ---------------------------------------------------------------------------

function canonicalValueAllowed(definition, value) {
  if (!definition) return false;
  if (Array.isArray(definition.allowed_canonical_values)) {
    return definition.allowed_canonical_values.some(
      (allowed) => canonicalJson(allowed) === canonicalJson(value),
    );
  }
  if (definition.canonical_value_type === 'NON_NEGATIVE_DECIMAL_STRING') {
    return typeof value === 'string' && /^(0|[1-9]\d*)(\.\d+)?$/.test(value);
  }
  if (definition.canonical_value_type === 'ISO_8601_DATE_STRING') {
    return typeof value === 'string'
      && /^\d{4}-\d{2}-\d{2}$/.test(value)
      && Number.isFinite(Date.parse(`${value}T00:00:00.000Z`));
  }
  if (definition.canonical_value_type === 'SCHEDULE_REFERENCE_STRING') {
    // P2 section 3: three-place lockstep, byte-identical regex at all three
    // sites (this copy, validate-write-set.js, and
    // schedule-reference-parse.js's own re-validation).
    return typeof value === 'string' && /^\d+\.\d+(\([0-9A-Za-z]+\))*@DISCLOSURE_LETTER$/.test(value);
  }
  return false;
}

function derivePerformanceAssumptionLevel(quote) {
  if (typeof quote !== 'string') return null;
  const levels = new Set();
  const pattern = new RegExp(PERFORMANCE_ASSUMPTION_PATTERN.source, 'gi');
  let match = pattern.exec(quote);
  while (match) {
    levels.add(match[1].toUpperCase());
    match = pattern.exec(quote);
  }
  return levels.size === 1 ? [...levels][0] : null;
}

// ---------------------------------------------------------------------------
// Party resolution.
// ---------------------------------------------------------------------------

function resolvePartyCapacity(rawValue) {
  if (typeof rawValue !== 'string') return null;
  const trimmed = rawValue.trim();
  if (!trimmed) return null;
  const match = PARTY_CAPACITY_LEXICON.find((entry) => entry.pattern.test(trimmed));
  return match ? match.capacity : null;
}

function resolveParty({ attributes, mapping }) {
  const raw = attributes && attributes[mapping.party_field];
  if (typeof raw !== 'string' || raw.trim().length === 0) return null;
  const capacity = resolvePartyCapacity(raw);
  if (!capacity) return null;
  return Object.freeze({ role: mapping.party_role, value: raw.trim(), capacity });
}

// ---------------------------------------------------------------------------
// Provision minting.
// ---------------------------------------------------------------------------

function groupKeyFor({ sectionReference, conceptKey, party }) {
  return contentId(GROUP_KEY_DOMAIN, { section_reference: sectionReference, concept_key: conceptKey, party });
}

function structuralGroupKeyFor({ sectionReference, conceptKey }) {
  return contentId(GROUP_KEY_DOMAIN, { section_reference: sectionReference, concept_key: conceptKey });
}

function mintProvision({
  section, conceptKey, party, ordinal, admittedSourceContext, contractVocabulary, span: explicitSpan = null,
}) {
  const span = explicitSpan || buildSemanticSpan(admittedSourceContext, section.start, section.end);
  const provision = buildProvisionInstance({
    source: admittedSourceContext,
    span,
    conceptKey,
    party,
    ordinal,
    contractBundle: contractVocabulary,
  });
  const closureId = contentId(PROVISION_CLOSURE_DOMAIN, { provision_instance_id: provision.provision_instance_id });
  return Object.freeze({ ...provision, closure_id: closureId });
}

function byteOffset(text, characterOffset) {
  return Buffer.byteLength(text.slice(0, characterOffset), 'utf8');
}

function findIocChapeau({ section, admittedSourceContext, beforeAbsoluteStart }) {
  const sectionText = utf8Slice(admittedSourceContext.canonical_text.text, section.start, section.end);
  const pattern = /\b((?:the\s+)?(?:company|parent|purchaser|buyer|seller|target))\b(?:\s+and\s+(?:its|their)\s+(?:subsidiaries|affiliates))?\s+shall\s+not\b/gi;
  let nearest = null;
  let match = pattern.exec(sectionText);
  while (match) {
    const start = section.start + byteOffset(sectionText, match.index);
    const end = start + Buffer.byteLength(match[0], 'utf8');
    if (end <= beforeAbsoluteStart) {
      const party = resolveParty({
        attributes: { ioc_chapeau_party: match[1] },
        mapping: { party_field: 'ioc_chapeau_party', party_role: IOC_PARENT_PARTY_ROLE },
      });
      if (party) nearest = Object.freeze({ party, span: buildSemanticSpan(admittedSourceContext, start, end) });
    }
    match = pattern.exec(sectionText);
  }
  return nearest;
}

function findUniqueIocRestrictionSpan({ section, quote, admittedSourceContext }) {
  const sectionText = utf8Slice(admittedSourceContext.canonical_text.text, section.start, section.end);
  const first = sectionText.indexOf(quote);
  if (first < 0 || sectionText.indexOf(quote, first + quote.length) >= 0) return null;
  const start = section.start + byteOffset(sectionText, first);
  return buildSemanticSpan(admittedSourceContext, start, start + Buffer.byteLength(quote, 'utf8'));
}

function mintStructuralProvision({
  section, conceptKey, ordinal, admittedSourceContext, contractVocabulary,
}) {
  const span = buildSemanticSpan(admittedSourceContext, section.start, section.end);
  const provision = buildStructuralProvisionInstance({
    source: admittedSourceContext,
    span,
    conceptKey,
    ordinal,
    contractBundle: contractVocabulary,
  });
  const closureId = contentId(PROVISION_CLOSURE_DOMAIN, { provision_instance_id: provision.provision_instance_id });
  return Object.freeze({ ...provision, closure_id: closureId });
}

// ---------------------------------------------------------------------------
// Claim rekeying: same subject-matter claim, new (real) subject_occurrence_id
// and (registered) claim_definition_key. Every identity formula below is the
// exact public formula claims-relationships.js/native-write-set-adapter.js
// already use -- see the file header for why this is reimplemented rather
// than re-invoked.
// ---------------------------------------------------------------------------

function rebuildEvidenceForClaim({ edges, occurrenceId }) {
  // Edge order is not re-derived: it was already fixed in canonical source
  // order by claims-relationships.js's own normalizeEvidence at first
  // compile, and none of document_ordinal/absolute_start/absolute_end/
  // evidence_role change here -- only the occurrence identity they are
  // scoped under does, so only claim_evidence_id needs recomputing.
  return edges.map((edge, ordinal) => {
    const id = contentId(CLAIM_EVIDENCE_DOMAIN, {
      occurrence_id: occurrenceId,
      evidence_role: edge.evidence_role,
      excerpt_id: edge.excerpt_id,
      ordinal,
    });
    return Object.freeze({
      schema_version: CLAIM_EVIDENCE_DOMAIN,
      claim_evidence_id: id,
      evidence_role: edge.evidence_role,
      excerpt_id: edge.excerpt_id,
      document_ordinal: edge.document_ordinal,
      absolute_start: edge.absolute_start,
      absolute_end: edge.absolute_end,
      ordinal,
    });
  });
}

function rebuildRetainedResidualsForClaim({ oldResiduals, newRevisionId }) {
  return oldResiduals.map((entry, ordinal) => {
    const {
      schema_version: _schemaVersion,
      retained_residual_id: _oldId,
      affected_object_type: _oldType,
      affected_object_id: _oldObjectId,
      ...residual
    } = entry;
    return Object.freeze({
      schema_version: 'RETAINED_RESIDUAL/V1',
      retained_residual_id: contentId(RETAINED_RESIDUAL_DOMAIN, {
        objectType: 'ClaimRevision', stableId: newRevisionId, ordinal, residual,
      }),
      affected_object_type: 'ClaimRevision',
      affected_object_id: newRevisionId,
      ...residual,
    });
  });
}

function rebuildClaim({
  originalClaim, newSubjectOccurrenceId, newClaimDefinitionKey, newOrdinal,
  // OPTIONAL Task 3 additions. newCanonicalValue overrides originalClaim's
  // canonical_value -- required whenever the registered claim definition's
  // value must come from THIS module's own mechanical derivation (the
  // lexicon's ACCURACY whitelist code, a parsed measurement date, or the
  // fixed KNOWLEDGE_QUALIFIER `true`) rather than whatever the producer
  // happened to send (spec section 2 rule 7: "code from the lexicon's
  // whitelist derivation only"). attributesExtra merges additional,
  // non-destructive keys onto originalClaim.attributes (e.g. the
  // unenriched-date mark, a best-effort knowledge standard, or the
  // deterministic kind itself for audit) -- never removes or overwrites an
  // existing key the producer supplied.
  newCanonicalValue = undefined,
  attributesExtra = null,
  attributesReplace = null,
}) {
  const claimDefinitionVersion = originalClaim.claim_definition_version;
  const claimOccurrenceId = contentId(CLAIM_OCCURRENCE_DOMAIN, {
    subject_occurrence_id: newSubjectOccurrenceId,
    claim_definition_key: newClaimDefinitionKey,
    claim_definition_version: claimDefinitionVersion,
    ordinal: newOrdinal,
  });
  const evidence = rebuildEvidenceForClaim({ edges: originalClaim.evidence, occurrenceId: claimOccurrenceId });
  const evidenceIds = evidence.map((edge) => edge.claim_evidence_id);

  const canonicalValue = newCanonicalValue === undefined ? originalClaim.canonical_value : newCanonicalValue;
  const attributes = attributesReplace
    ? Object.freeze({ ...attributesReplace })
    : attributesExtra
    ? Object.freeze({ ...originalClaim.attributes, ...attributesExtra })
    : originalClaim.attributes;

  const overrides = {
    claim_occurrence_id: claimOccurrenceId,
    subject_occurrence_id: newSubjectOccurrenceId,
    claim_definition_key: newClaimDefinitionKey,
    ordinal: newOrdinal,
    canonical_value: canonicalValue,
    attributes,
  };
  const payload = {};
  for (const field of CLAIM_REVISION_PAYLOAD_FIELDS) {
    payload[field] = Object.hasOwn(overrides, field) ? overrides[field] : originalClaim[field];
  }
  payload.evidence_ids = evidenceIds;
  const claimRevisionId = contentId(CLAIM_REVISION_DOMAIN, payload);

  const oldResiduals = Array.isArray(originalClaim.retained_residuals) ? originalClaim.retained_residuals : [];
  const retainedResiduals = rebuildRetainedResidualsForClaim({ oldResiduals, newRevisionId: claimRevisionId });
  const quarantined = retainedResiduals.length > 0;
  const closureId = contentId(CLAIM_CLOSURE_DOMAIN, {
    original_closure_id: originalClaim.closure_id,
    claim_revision_id: claimRevisionId,
  });

  return Object.freeze({
    schema_version: 'CLAIM_REVISION/V1',
    claim_revision_id: claimRevisionId,
    claim_occurrence_id: claimOccurrenceId,
    subject_occurrence_id: newSubjectOccurrenceId,
    claim_definition_key: newClaimDefinitionKey,
    claim_definition_version: claimDefinitionVersion,
    ordinal: newOrdinal,
    state: originalClaim.state,
    raw_value: originalClaim.raw_value,
    canonical_value: canonicalValue,
    unit: originalClaim.unit,
    day_basis: originalClaim.day_basis,
    denominator: originalClaim.denominator,
    scope: originalClaim.scope,
    applicability: originalClaim.applicability,
    not_examined: originalClaim.not_examined,
    failure: originalClaim.failure,
    evidence_ids: evidenceIds,
    attributes,
    taxonomy_codes: originalClaim.taxonomy_codes,
    extraction_version: originalClaim.extraction_version,
    normalisation_version: originalClaim.normalisation_version,
    derivation_version: originalClaim.derivation_version,
    evidence,
    publication_state: quarantined ? 'QUARANTINED' : 'VALIDATED',
    retained_residuals: retainedResiduals,
    quarantine: quarantined ? Object.freeze({
      affected_object_type: 'ClaimRevision',
      affected_object_id: claimRevisionId,
      reason_codes: Object.freeze([...new Set(retainedResiduals.map((item) => item.reason))]),
    }) : null,
    closure_id: closureId,
  });
}

// ---------------------------------------------------------------------------
// Qualifier-kind classification: ruling corpus (exact match) BEFORE the
// lexicon, per spec section 4 ("Application order: corpus exact match runs
// BEFORE the lexicon, BUT every application also runs the current lexicon").
// ---------------------------------------------------------------------------

// The classifyKind(normalisedQuote) function ruling-corpus.js's applyRuling
// requires, injected rather than imported (see ruling-corpus.js's own file
// header on why it must not depend on qualifier-kind-lexicon.js). Only a
// SINGLE, UNAMBIGUOUS lexicon verdict counts for the conflict check -- a
// SPLIT/REVIEW/OPEN_WORLD lexicon outcome is treated as abstention
// (kind: null) for this purpose, never as an affirmative disagreement, since
// none of those outcomes is itself a single settled kind to disagree with.
function lexiconKindForRulingConflictCheck(normalisedQuote) {
  const result = classifyQualifierQuote({ quote: normalisedQuote, modelKind: null });
  if (result.outcome === 'CLASSIFIED') return { kind: result.kind, code: result.code };
  return { kind: null, code: null };
}

// UTF-16 string index -> UTF-8 byte offset, needed because
// qualifier-kind-lexicon.js's SPLIT parts carry `start`/`end` as JS string
// (UTF-16 code unit) indices into the quote, while every evidence span in
// this codebase is a UTF-8 BYTE offset (UTF8_CANONICAL_TEXT_HALF_OPEN, see
// source-structure.js). Any curly quote, em dash or U+200E mark inside a
// split quote would silently corrupt the sub-span without this conversion.
function utf16OffsetToByteOffset(text, utf16Index) {
  return Buffer.byteLength(text.slice(0, utf16Index), 'utf8');
}

// Best-effort, deterministic knowledge-standard extraction from the quote's
// own text -- preserved in attributes per spec section 3 ("the knowledge
// standard ... is preserved in the claim's attributes so nothing is lost").
// Promoting this into the registered definition is future, evidence-backed
// work per the spec; a miss here never blocks resolution, it just leaves the
// attribute null.
const KNOWLEDGE_STANDARD_PATTERNS = Object.freeze([
  Object.freeze({ pattern: /\bactual\s+knowledge\b/i, standard: 'ACTUAL' }),
  Object.freeze({ pattern: /\bconstructive\s+knowledge\b/i, standard: 'CONSTRUCTIVE' }),
  Object.freeze({ pattern: /\bafter\s+(?:due|reasonable)\s+inquiry\b/i, standard: 'AFTER_INQUIRY' }),
]);

function deriveKnowledgeStandard(quote) {
  const match = KNOWLEDGE_STANDARD_PATTERNS.find((entry) => entry.pattern.test(quote));
  return match ? match.standard : null;
}

// count_kind corroboration table (P1 cap-table numerics, spec section 1,
// audit C-4): a frozen resolver constant binding label to text -- the
// registry's fixture-shape validator rejects extra definition fields, so
// this enum/corroboration machinery cannot live there. The byte-verified
// quote must match the kind's own pattern or the claim never resolves under
// that kind, no matter how well-formed the rest of the candidate is.
//
// OUTSTANDING_AWARDS is split into two independently-tested patterns (re-
// audit finding 2): `/RSU/i` matches the substring "rsu" inside "puRSUant"
// case-insensitively, which would silently corroborate an unrelated
// procedural clause and void the whole veto. The acronym alternatives are
// therefore WORD-BOUNDED AND CASE-SENSITIVE (no `i` flag) -- only a real,
// capitalised "RSU"/"RSUs"/"PSU"/"PSUs" token corroborates; the non-acronym
// words in the same kind ("issuable", "option", "award") stay
// case-insensitive, since they carry no such collision risk.
const OUTSTANDING_AWARDS_WORD_PATTERN = /issuable|option|award/i;
const OUTSTANDING_AWARDS_ACRONYM_PATTERN = /\bRSUs?\b|\bPSUs?\b/;

const SHARE_COUNT_KIND_CORROBORATION_TABLE = Object.freeze({
  AUTHORIZED: /authorized|consists of|classified as/i,
  ISSUED_OUTSTANDING: /outstanding|issued/i,
  RESERVED: /reserv/i,
  TREASURY: /treasury/i,
  OUTSTANDING_AWARDS: null, // handled specially below -- two patterns, mixed case-sensitivity.
});

function shareCountKindCorroborated(countKind, quote) {
  if (countKind === 'OUTSTANDING_AWARDS') {
    return OUTSTANDING_AWARDS_WORD_PATTERN.test(quote) || OUTSTANDING_AWARDS_ACRONYM_PATTERN.test(quote);
  }
  const pattern = SHARE_COUNT_KIND_CORROBORATION_TABLE[countKind];
  return pattern ? pattern.test(quote) : false;
}

// ---------------------------------------------------------------------------
// Termination-fee family (family-termination-fee slice, spec section 1):
// frozen resolver constants -- fee_side <-> payment-direction text (NEVER
// termination-direction text), and TERMINATION_FEE_TRIGGER code <-> quote
// text, every pattern word-bounded (audit C-3). Both tables bind LABEL to
// TEXT: a wrong-but-in-enum label must never publish under the wrong side
// or the wrong trigger code.
// ---------------------------------------------------------------------------

// SELLER = the Company pays (TERMF-TARGET); BUYER = Parent pays (TERMF-
// REVERSE). Keyed on pay-verbs, never terminate-verbs -- "the Company
// terminates ... Parent shall pay the Company" is a BUYER fee whose quote
// contains "the Company" twice; keying on "shall pay" is what makes
// Covance/EWC resolve correctly. DROPPED limbs (audit C-1/C-2): "payable
// by the Company"/"payable by Parent"/"fails to pay" are NOT patterns here
// -- none of those strings appears in any committed fixture quote, so
// under this slice's own grounding rule they may not ship; re-adding any
// of them requires a corpus query receipt attached to the PR.
const FEE_SIDE_CORROBORATION_TABLE = Object.freeze({
  SELLER: Object.freeze([
    /\bCompany (?:shall|will) pay\b/i,
    /payment required to be made by the Company/i,
    /Company Termination Fee/,
  ]),
  BUYER: Object.freeze([
    /\bParent (?:shall|will) pay\b/i,
    /payment required to be made by Parent/i,
    /Parent Termination Fee/,
    /Parent Termination Payment/,
  ]),
});

/**
 * @returns {string[]} the FEE_SIDES whose corroboration patterns match
 *   `quote` -- may be empty (FEE_SIDE_UNCORROBORATED), length 1 (a single
 *   corroborated side), or length 2 (AMBIGUOUS_FEE_SIDE, e.g. Concho's
 *   two-sided §8.3(e)/(f) region, which contains both "the Company shall
 *   pay Parent the Company Termination Fee" and "Parent shall pay the
 *   Company the Parent Termination Fee").
 */
function feeSideCorroboratedSides(quote) {
  return FEE_SIDES.filter(
    (side) => FEE_SIDE_CORROBORATION_TABLE[side].some((pattern) => pattern.test(quote)),
  );
}

// TERMINATION_FEE_TRIGGER code <-> quote text (spec section 1, audit C-3:
// every pattern word-bounded -- the earlier draft's boundary-free, hair-
// trigger limbs like bare /solicit/ and /end date/ fired on
// "solicited"/"breaches its obligations" tail prose and inside "Dividend
// Date"). The bare /solicit/ limb is deliberately dropped for the same
// reason.
const FEE_TRIGGER_CORROBORATION_TABLE = Object.freeze({
  CHANGE_IN_RECOMMENDATION_TERMINATION: /\bchange (?:in|of) recommendation\b|\badverse recommendation\b/i,
  NO_SOLICIT_BREACH_TERMINATION: /\bno[- ]solicitation\b/i,
  STOCKHOLDER_APPROVAL_FAILURE_TERMINATION: /\b(?:stockholder|shareholder) approval\b|\bstockholders?.? meeting\b/i,
  OUTSIDE_DATE_TERMINATION: /\boutside date\b|\bend date\b/i,
  COUNTERPARTY_COVENANT_BREACH_TERMINATION: /\bbreach(?:es|ed)?\b|\bcomply with its obligations\b|\bfail(?:s|ed)? to perform\b/i,
  INTERVENING_EVENT_RECOMMENDATION_CHANGE_TERMINATION: /\bintervening event\b/i,
  SUPERIOR_PROPOSAL_TERMINATION: /\bsuperior proposal\b/i,
});

/**
 * Runs the FULL trigger-corroboration table over `quote` (spec section 1,
 * audit C-3's trigger-ambiguity rule: "the handler runs the FULL pattern
 * table over the quote" -- never just the asserted code's own pattern,
 * because this family's quotes are multi-trigger as the NORM).
 * @returns {string[]} every TERMINATION_FEE_TRIGGER code whose pattern
 *   matches `quote`, in FEE_TRIGGER_CODES enum order.
 */
function feeTriggerCorroboratedCodes(quote) {
  return FEE_TRIGGER_CODES.filter((code) => {
    const pattern = FEE_TRIGGER_CORROBORATION_TABLE[code];
    return pattern ? pattern.test(quote) : false;
  });
}

// A termination-fee claim's party is always FEE_PAYER role; its capacity
// and verbatim value are DERIVED from the corroborated fee_side for the
// trigger and tail-period claims (which carry no payer_party phrase of
// their own -- only the amount claim does, resolved through the ordinary
// resolveParty/PARTY_CAPACITY_LEXICON path per spec section 1). SELLER ->
// the Company (TARGET); BUYER -> Parent (BUYER capacity, matching the
// existing PARTY_CAPACITY_LEXICON's own "parent" -> BUYER mapping).
function feePayerPartyForSide(feeSide) {
  if (feeSide === 'SELLER') {
    return Object.freeze({ role: 'FEE_PAYER', value: 'the Company', capacity: 'TARGET' });
  }
  if (feeSide === 'BUYER') {
    return Object.freeze({ role: 'FEE_PAYER', value: 'Parent', capacity: 'BUYER' });
  }
  return null;
}

// TERMF-TAIL is inherently company-side (spec section 1: "the tail is a
// condition on the company-side fee") -- its party is always the SELLER-
// side FEE_PAYER, never resolved from a per-claim attribute.
const TERMF_TAIL_PAYER_PARTY = feePayerPartyForSide('SELLER');

// ---------------------------------------------------------------------------
// Termination-RIGHTS family (family-termination-rights slice, docs/
// superpowers/specs/2026-08-02-family-termination-rights-design.md
// section 4, AUDIT-AMENDED). Frozen resolver constants: trigger_kind <->
// concept, trigger_kind <-> quote-corroboration pattern, party-scope
// corroboration.
// ---------------------------------------------------------------------------

// trigger_kind -> concept_key (spec section 4): the frozen map the handler
// uses to make the concept split (never the resolution table itself --
// see the MAPPING_TABLE_VERSION 8 comment above). Every one of the eight
// registered-concept triggers is present; an out-of-enum trigger_kind
// never reaches this map (the handler pushes it to open world first).
const TERMINATION_TRIGGER_KIND_TO_CONCEPT = Object.freeze({
  MUTUAL_CONSENT: 'TERMR-MUTUAL',
  OUTSIDE_DATE: 'TERMR-OUTSIDE',
  VOTE_FAILURE: 'TERMR-NOVOTE',
  BREACH: 'TERMR-BREACH',
  LEGAL_RESTRAINT: 'TERMR-LEGAL',
  SUPERIOR_PROPOSAL: 'TERMR-SUPERIOR',
  RECOMMENDATION_CHANGE: 'TERMR-RECOMMEND',
  NO_SOLICITATION_BREACH: 'TERMR-NOSOL-BREACH',
});

// trigger_kind <-> quote-corroboration pattern (spec section 4, frozen;
// labels could mislabel -- the corpus's own TERMR-VOTE/extension defect is
// the proof). NO_SOLICITATION_BREACH deliberately has NO pattern -- always
// review (audit M-3): the family has ZERO grounded corpus text, so the
// resolver is symmetric with the lexicon (LEXICON_FAMILY_UNCOVERED) --
// this trigger_kind queues unconditionally until grounded text exists and
// a corroboration pattern is authored in a reviewed diff. `restrain` and
// `prohibit` are deliberately UN-word-bounded on their right edge (audit
// m-6, prefix stems) so they still catch the corpus noun forms "restraint
// or prohibition"; every other pattern is word-bounded throughout.
const TERMINATION_TRIGGER_KIND_CORROBORATION_TABLE = Object.freeze({
  MUTUAL_CONSENT: /\bmutual written (?:consent|agreement)\b/i,
  OUTSIDE_DATE: /\bOutside Date\b|\bEnd Date\b|\bTermination Date\b|\bnot (?:been )?(?:consummated|occurred) on or (?:before|prior to)\b/i,
  VOTE_FAILURE: /\b(?:stock|share)holder approval\b/i,
  BREACH: /\bbreached\b|\bfailed to perform\b|\bbreach of\b|\bbreach by\b/i,
  LEGAL_RESTRAINT: /\binjunction\b|\brestrain|\bprohibit|\bpreventing the consummation\b/i,
  SUPERIOR_PROPOSAL: /\bSuperior Proposal\b/i,
  RECOMMENDATION_CHANGE: /\bAdverse Recommendation\b|\bChange of Recommendation\b|\bChange in Recommendation\b|\bCompany Board Recommendation\b/i,
  NO_SOLICITATION_BREACH: null,
});

// VOTE_FAILURE's own AND-paired second condition (spec section 4): the
// Approval-term pattern above must ALSO co-occur with a failure phrase --
// tested as a SEPARATE pattern (never folded into the single-pattern table
// above, which the other seven trigger_kinds use unconditionally) so the
// two-condition AND semantics stay explicit and reviewable.
const TERMINATION_VOTE_FAILURE_PHRASE_PATTERN =
  /\bnot (?:have )?been obtained\b|\bshall not have been obtained\b|\bnot obtained\b/i;

function terminationTriggerKindCorroborated(triggerKind, quote) {
  const pattern = TERMINATION_TRIGGER_KIND_CORROBORATION_TABLE[triggerKind];
  if (!pattern) return false;
  if (!pattern.test(quote)) return false;
  if (triggerKind === 'VOTE_FAILURE') return TERMINATION_VOTE_FAILURE_PHRASE_PATTERN.test(quote);
  return true;
}

// Party-scope corroboration (spec section 4): party attribution is legal
// substance -- a mutual right recorded as one-sided corrupts the market
// statistic this family feeds.
const TERMINATION_EITHER_PARTY_PATTERN = /\bby either\b|\bmutual written (?:consent|agreement)\b/i;

function escapeRegExpLiteral(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

// Positional gate (spec section 4, audit C-2): the byte-verified quote
// must match `by <ref>` or `<ref> may terminate`, word-bounded, anchored
// on the verbatim `terminating_party_ref` -- both grammatical forms
// verified in corpus ("(e) by the Company, if...", "Columbus may
// terminate"). This is what stops a producer that SWAPS terminator and
// breaching party: every breach quote names BOTH parties by construction,
// so the verbatim-substring gate and resolveParty alone would pass a
// swapped read -- the positional gate makes the swap fail, because the
// breaching party's phrase does not sit in either position.
function terminatingPartyPositionCorroborated(quote, partyRef) {
  const escaped = escapeRegExpLiteral(partyRef.trim());
  const byPattern = new RegExp(`\\bby\\s+${escaped}\\b`, 'i');
  const mayTerminatePattern = new RegExp(`\\b${escaped}\\s+may terminate\\b`, 'i');
  return byPattern.test(quote) || mayTerminatePattern.test(quote);
}

const PROXY_MEETING_ASSERTION_MAP = Object.freeze({
  FILING_DEADLINE: Object.freeze({ concept_key: 'COV-PROXY', claim_definition_key: 'PROXY_FILING_DEADLINE_DAYS' }),
  MEETING_DEADLINE: Object.freeze({ concept_key: 'COV-MEETING', claim_definition_key: 'MEETING_DEADLINE_DAYS' }),
  ADJOURNMENT_COUNT_CAP: Object.freeze({ concept_key: 'COV-MEETING', claim_definition_key: 'MEETING_ADJOURNMENT_MAX_COUNT' }),
  ADJOURNMENT_DURATION_CAP: Object.freeze({ concept_key: 'COV-MEETING', claim_definition_key: 'MEETING_ADJOURNMENT_MAX_DAYS' }),
  RECOMMENDATION_INCLUSION: Object.freeze({ concept_key: 'COV-PROXY', claim_definition_key: 'BOARD_RECOMMENDATION_INCLUSION' }),
  CONVENE_OBLIGATION: Object.freeze({ concept_key: 'COV-MEETING', claim_definition_key: 'MEETING_CONVENE_OBLIGATION' }),
  RECORD_DATE_ESTABLISHMENT: Object.freeze({ concept_key: 'COV-MEETING', claim_definition_key: 'RECORD_DATE_ESTABLISHMENT_PRESENT' }),
  BROKER_SEARCH_OBLIGATION: Object.freeze({ concept_key: 'COV-MEETING', claim_definition_key: 'BROKER_SEARCH_OBLIGATION_PRESENT' }),
  ADJOURNMENT_REASON: Object.freeze({ concept_key: 'COV-MEETING', claim_definition_key: 'MEETING_ADJOURNMENT_REASON' }),
  PARENT_APPROVAL: Object.freeze({ concept_key: 'COV-PROXY-PARENT-APPROVAL', claim_definition_key: 'PARENT_APPROVAL_OBLIGATION' }),
  MERGER_SUB_APPROVAL: Object.freeze({ concept_key: 'COV-PROXY-MERGERSUB-APPROVAL', claim_definition_key: 'MERGER_SUB_APPROVAL_OBLIGATION' }),
});

const PROXY_MEETING_KIND_CORROBORATION = Object.freeze({
  FILING_DEADLINE: /\b(?:prepare\s+and\s+file|file\s+with\s+the\s+SEC|prepare\s+and\s+cause(?:d)?\s+to\s+be\s+filed)\b/i,
  MEETING_DEADLINE: /\b(?:meeting|stockholders?|shareholders?)\b[\s\S]{0,180}\b(?:held|hold|convene|schedule)\b|\b(?:held|hold|convene|schedule)\b[\s\S]{0,180}\b(?:meeting|stockholders?|shareholders?)\b/i,
  ADJOURNMENT_COUNT_CAP: /\b(?:adjourn|postpon)\w*\b[\s\S]{0,140}\b(?:no\s+more\s+than|total\s+of)\b[\s\S]{0,80}\b(?:times?|adjournments?|postponements?)\b|\b(?:no\s+more\s+than|total\s+of)\b[\s\S]{0,80}\b(?:times?|adjournments?|postponements?)\b[\s\S]{0,140}\b(?:adjourn|postpon)\w*\b/i,
  ADJOURNMENT_DURATION_CAP: /\b(?:adjourn|postpon)\w*\b[\s\S]{0,180}\b(?:business\s+|calendar\s+)?days?\b|\b(?:business\s+|calendar\s+)?days?\b[\s\S]{0,180}\b(?:adjourn|postpon)\w*\b/i,
  RECOMMENDATION_INCLUSION: /\binclude\w*\b[\s\S]{0,120}\b(?:Company\s+)?Board Recommendation\b/i,
  CONVENE_OBLIGATION: /\bduly\s+call\b|\bconvene\s+and\s+hold\b|\bschedule\s+(?:a|the)\s+(?:special\s+)?(?:stockholders?\s+|shareholders?\s+)?meeting\b/i,
  RECORD_DATE_ESTABLISHMENT: /\b(?:establish|set|fix|select)(?:es|ed|ing)?\b[\s\S]{0,120}\brecord date\b|\brecord date\b[\s\S]{0,120}\b(?:establish|set|fix|select)(?:es|ed|ing)?\b/i,
  BROKER_SEARCH_OBLIGATION: /\b(?:complet\w*|conduct\w*|perform\w*|commenc\w*|initiat\w*|undertak\w*)\b[\s\S]{0,100}\bbroker search\b|\bbroker search\b[\s\S]{0,100}\b(?:complet\w*|conduct\w*|perform\w*|commenc\w*|initiat\w*|undertak\w*)\b/i,
  ADJOURNMENT_REASON: /\b(?:quorum|insufficient\s+(?:affirmative\s+)?votes?|supplemental\s+disclosure|supplement\w*\s+(?:the\s+)?proxy|required\s+by\s+(?:applicable\s+)?law|legal\s+requirement)\b/i,
  PARENT_APPROVAL: /\bParent\b[\s\S]{0,160}\b(?:stockholders?|shareholders?)\b[\s\S]{0,120}\b(?:approve|adopt|vote|consent)\w*\b/i,
  MERGER_SUB_APPROVAL: /\bMerger Sub\b[\s\S]{0,180}\b(?:sole\s+stockholder|sole\s+member|written\s+consent|approve|adopt)\w*\b/i,
});

const ADJOURNMENT_REASON_PATTERNS = Object.freeze({
  QUORUM_ABSENT: /\b(?:lack|absence|absent|without|obtain)\w*\b[\s\S]{0,60}\bquorum\b|\bquorum\b[\s\S]{0,60}\b(?:lack|absence|absent|not\s+present|not\s+obtain)\w*\b/i,
  INSUFFICIENT_VOTES: /\binsufficient\s+(?:affirmative\s+)?votes?\b|\bnot\s+(?:been\s+)?obtained\b[\s\S]{0,80}\b(?:votes?|approval)\b/i,
  SUPPLEMENTAL_DISCLOSURE: /\bsupplemental\s+disclosure\b|\bsupplement\w*\b[\s\S]{0,60}\b(?:proxy|disclosure)\b/i,
  LEGAL_REQUIREMENT: /\brequired\s+by\s+(?:applicable\s+)?law\b|\blegal\s+requirement\b/i,
});

const APPROVAL_MECHANISM_PATTERNS = Object.freeze({
  SHAREHOLDER_VOTE: /\b(?:stockholders?|shareholders?)\b[\s\S]{0,100}\b(?:meeting|vote|approval)\b/i,
  SOLE_HOLDER_WRITTEN_CONSENT: /\bsole\s+holder\b[\s\S]{0,80}\bwritten\s+consent\b/i,
  ALL_RECORD_HOLDERS_WRITTEN_CONSENT: /\ball\s+(?:of\s+the\s+)?record\s+holders\b[\s\S]{0,80}\bwritten\s+consent\b/i,
  SOLE_STOCKHOLDER_ADOPTION: /\bsole\s+(?:stockholder|member)\b[\s\S]{0,100}\b(?:adopt|approve|consent)\w*\b/i,
  WRITTEN_CONSENT: /\bwritten\s+consent\b/i,
});

function proxyMeetingCorroboratedKinds(quote) {
  return Object.entries(PROXY_MEETING_KIND_CORROBORATION)
    .filter(([, pattern]) => pattern.test(quote))
    .map(([kind]) => kind);
}

function proxyMeetingControlPartyPositionCorroborated(quote, partyRef) {
  const escaped = escapeRegExpLiteral(partyRef.trim());
  return new RegExp(`\\b${escaped}\\b[\\s\\S]{0,80}\\b(?:may|shall|will)\\s+(?:adjourn|postpone)`, 'i').test(quote)
    || new RegExp(`\\b(?:adjournment|postponement)\\b[\\s\\S]{0,80}\\bby\\s+${escaped}\\b`, 'i').test(quote);
}

// TERMINATION_RIGHT_HOLDER role reused verbatim from the pre-existing v1
// reviewed-slice convention (lib/canonical-v2/reviewed-termination-fee-
// slice.js, qxo-termination-fee-admitted-slice.js) -- never a new role.
const TERMINATION_RIGHT_HOLDER_ROLE = 'TERMINATION_RIGHT_HOLDER';

// EITHER_PRINCIPAL_PARTY (spec section 4, audit C-1): a NEW governed
// capacity value, strictly additive, FLAGGED FOR BEN in the PR body (same
// convention as the REPRESENTATIONS materiality-tier flag) -- inventing a
// capacity is a vocabulary call this module is making, not one already
// made. Minted directly (never through resolveParty, which resolves ONE
// party; a mutual right has two) -- all three keys required by
// validate-write-set.js's closed party contract (~793-801): `{capacity,
// role, value}`, each a non-empty string.
const EITHER_PRINCIPAL_PARTY_CAPACITY = 'EITHER_PRINCIPAL_PARTY';

function mintEitherPrincipalParty(terminatingPartyRef) {
  return Object.freeze({
    role: TERMINATION_RIGHT_HOLDER_ROLE,
    value: terminatingPartyRef.trim(),
    capacity: EITHER_PRINCIPAL_PARTY_CAPACITY,
  });
}

const REGULATORY_COVENANT_OBLIGOR_ROLE = 'REGULATORY_COVENANT_OBLIGOR';
const REGULATORY_MUTUAL_OBLIGOR_PATTERN = /\beach of (?:Parent and the Company|the parties)\b|\beach of the parties hereto\b|\b(?:Parent and (?:the )?Company|the parties) (?:hereto )?(?:shall|agree)\b|\bneither (?:Parent|the Company|[A-Z][a-zA-Z]+) nor\b/i;
function mintRegulatoryMutualParty(ref) {
  return Object.freeze({ role: REGULATORY_COVENANT_OBLIGOR_ROLE, value: ref.trim(), capacity: EITHER_PRINCIPAL_PARTY_CAPACITY });
}
function regulatoryObligorPositionCorroborated(quote, ref) {
  const escaped = escapeRegExpLiteral(ref.trim());
  return new RegExp(`\\b${escaped}\\s+(?:shall|will|agrees)\\b`, 'i').test(quote);
}

const REGULATORY_ASSERTION_MAP = Object.freeze({
  EFFORTS_STANDARD: Object.freeze({ concept_key: 'ANTI-EFFORTS', definition_key: 'REGULATORY_EFFORTS_STANDARD' }),
  BURDEN_COMMITMENT: Object.freeze({ concept_key: 'ANTI-BURDEN', definition_key: 'REGULATORY_BURDEN_COMMITMENT' }),
  DIVESTITURE_CAP_AMOUNT: Object.freeze({ concept_key: 'ANTI-BURDEN', definition_key: 'REGULATORY_DIVESTITURE_CAP_AMOUNT' }),
  LITIGATION_OBLIGATION: Object.freeze({ concept_key: 'ANTI-LITIGATION', definition_key: 'REGULATORY_LITIGATION_OBLIGATION' }),
  TIMING_RESTRICTION: Object.freeze({ concept_key: 'ANTI-AGREEMENTS', definition_key: 'REGULATORY_TIMING_AGREEMENT_RESTRICTION' }),
  TIMING_AGREEMENT_RESTRICTION: Object.freeze({ concept_key: 'ANTI-AGREEMENTS', definition_key: 'REGULATORY_TIMING_AGREEMENT_RESTRICTION' }),
  WITHDRAWAL_REFILING_RESTRICTION: Object.freeze({ concept_key: 'ANTI-AGREEMENTS', definition_key: 'REGULATORY_WITHDRAWAL_REFILING_RESTRICTION' }),
  HSR_FILING_DEADLINE: Object.freeze({ concept_key: 'ANTI-FILING', definition_key: 'HSR_FILING_DEADLINE_DAYS' }),
  REGULATORY_FILING_OBLIGATION: Object.freeze({ concept_key: 'ANTI-FILING', definition_key: 'REGULATORY_FILING_OBLIGATION' }),
  REGULATORY_FILING_DEADLINE: Object.freeze({ concept_key: 'ANTI-FILING', definition_key: 'REGULATORY_FILING_DEADLINE_DAYS' }),
  STRATEGY_CONTROL: Object.freeze({ concept_key: 'ANTI-STRATEGY', definition_key: 'REGULATORY_STRATEGY_CONTROL' }),
  CONSULTATION_RIGHT: Object.freeze({ concept_key: 'ANTI-CONSULT', definition_key: 'REGULATORY_CONSULTATION_RIGHT' }),
  NON_IMPEDIMENT_COVENANT: Object.freeze({ concept_key: 'ANTI-NOACTION', definition_key: 'REGULATORY_NON_IMPEDIMENT_COVENANT' }),
});
const REGULATORY_EFFORTS_PATTERNS = Object.freeze({
  REASONABLE_BEST_EFFORTS: /reasonable best efforts/i,
  COMMERCIALLY_REASONABLE_EFFORTS: /commercially reasonable efforts/i,
  BEST_EFFORTS: /best efforts/i,
  REASONABLE_EFFORTS: /reasonable efforts/i,
  FLAT_OBLIGATION: /take,?(?: or cause to be taken,)? all .{0,40}(?:actions?|steps|things)|all things necessary,? proper,? or advisable|all things necessary to consummate/i,
});
function regulatoryValueCorroborated(kind, value, quote, attrs) {
  if (kind === 'EFFORTS_STANDARD') {
    if (value === 'BEST_EFFORTS') return /best efforts/i.test(quote) && !/reasonable best efforts/i.test(quote);
    if (value === 'REASONABLE_EFFORTS') return /reasonable efforts/i.test(quote) && !/reasonable best efforts|commercially reasonable efforts/i.test(quote);
    if (value === 'FLAT_OBLIGATION') return !/efforts/i.test(quote) && REGULATORY_EFFORTS_PATTERNS.FLAT_OBLIGATION.test(quote);
    return Boolean(REGULATORY_EFFORTS_PATTERNS[value] && REGULATORY_EFFORTS_PATTERNS[value].test(quote));
  }
  if (kind === 'BURDEN_COMMITMENT') {
    if (value === 'ANTI_HOHW') return /(shall|will) not be required to|neither .{0,120}(shall|will) be required|in no event (shall|will).{0,160}be required/i.test(quote);
    if (value === 'BURDENSOME_CONDITION') return typeof attrs.burden_term_ref === 'string' && attrs.burden_term_ref.length > 0 && quote.includes(attrs.burden_term_ref) && (/\bBurdensome Condition\b/.test(attrs.burden_term_ref) || /\bDetriment\b/.test(attrs.burden_term_ref));
    if (value === 'CAPPED_QUANTITATIVE') return /[$€£]\s*\d/.test(quote);
    if (value === 'EXPRESS_HOHW') return /take any and all (?:steps|actions?).{0,60}(?:necessary )?to avoid or eliminate each and every impediment/i.test(quote);
    if (value === 'NO_LITIGATION_ONLY') return /(?:not|no party shall) be required to.{0,200}(?:defend|litigate|contest)/i.test(quote);
    return false;
  }
  if (kind === 'LITIGATION_OBLIGATION') {
    const mandatory = /vigorously (?:contest|oppose|pursu)|oppose fully and vigorously|defend(?:ing)? through litigation|contest, resist and litigate|avenues of administrative and judicial appeal/i.test(quote);
    const expressNone = /(?:not|no party shall|shall not) be required to.{0,200}(?:defend|litigate|contest)/i.test(quote);
    if (mandatory && expressNone) return false;
    if (value === 'MANDATORY_DEFEND') return mandatory;
    if (value === 'TIME_BOUNDED') return mandatory && /(?:on or )?(?:before|prior to) the (?:Outside|End) Date/i.test(quote);
    return value === 'EXPRESS_NONE' && expressNone;
  }
  if (kind === 'TIMING_RESTRICTION' || kind === 'TIMING_AGREEMENT_RESTRICTION') {
    const restriction = /shall not|neither .{0,120}shall|no party shall|agree(?:s)? not to|without the prior written consent|except with the prior written consent/i.test(quote);
    if (!restriction || !/(?:stay|toll|extend).{0,100}(?:waiting period|review period)|(?:waiting period|review period).{0,100}(?:stay|toll|extend)|timing agreement/i.test(quote)) return false;
    if (value === 'BARRED_MUTUAL_CONSENT') return /consent of the other/i.test(quote) && !/unreasonably withheld/i.test(quote);
    if (value === 'NOT_UNREASONABLY_WITHHELD') return /unreasonably withheld/i.test(quote);
    if (value === 'BUYER_ONLY_RESTRICTED') return /consent of Parent/i.test(quote) && !/consent of the other/i.test(quote);
    return false;
  }
  if (kind === 'WITHDRAWAL_REFILING_RESTRICTION') {
    if (!/\b(?:withdraw|withdrawal|pull)\b.{0,100}\brefil(?:e|ing)\b|\brefil(?:e|ing)\b.{0,100}\b(?:withdraw|withdrawal|pull)\b/i.test(quote)) return false;
    if (value === 'MUTUAL_CONSENT') return /consent of the other/i.test(quote);
    if (value === 'SELLER_CONSENT_GATED') return /consent of (?:the )?Company/i.test(quote);
    return value === 'BUYER_UNILATERAL_GF' && /(?:Parent|Buyer).{0,80}(?:withdraw|pull).{0,100}refil(?:e|ing).{0,100}good faith/i.test(quote);
  }
  if (kind === 'STRATEGY_CONTROL') {
    if (value === 'PARENT_CONTROL') return /\bParent\b.{0,80}\b(?:control|direct)\b|\bParent\b.{0,80}\bprimary responsibility\b/i.test(quote);
    if (value === 'COMPANY_CONTROL' || value === 'SELLER_LED') return /\bCompany\b.{0,80}\b(?:control|direct|lead)\b|\bCompany\b.{0,80}\bprimary responsibility\b/i.test(quote);
    if (value === 'SHARED_CONTROL') return /\b(?:jointly|together)\b.{0,80}\b(?:determine|devise|control|direct|implement)\b/i.test(quote);
    if (value === 'BUYER_LEAD') return /\bParent\b.{0,80}\b(?:lead|primary responsibility)\b/i.test(quote);
    if (value === 'BUYER_WITH_SETTLEMENT_GAG') return /\bParent\b.{0,80}\b(?:settle|settlement)\b.{0,100}\b(?:consent|approval)\b/i.test(quote);
    if (value === 'PRINCIPAL_WITH_VETO') return /\b(?:Parent|Company)\b.{0,80}\b(?:control|direct)\b.{0,100}\b(?:consent|veto)\b/i.test(quote);
    return value === 'JURISDICTION_SPLIT' && /\b(?:United States|U\.S\.|foreign|non-U\.S\.)\b.{0,100}\b(?:Parent|Company)\b/i.test(quote);
  }
  if (kind === 'CONSULTATION_RIGHT') {
    if (value === 'NOTICE_CONSULT') return /\bconsult with\b/i.test(quote);
    if (value === 'GOOD_FAITH_VIEWS') return /\bconsider in good faith (?:the )?(?:views|comments)\b/i.test(quote);
    if (value === 'INCORPORATE_COMMENTS') return /\bincorporate\b.{0,80}\bcomments?\b/i.test(quote);
    if (value === 'PARTICIPATE') return /\b(?:right|opportunity) to participate\b/i.test(quote);
    if (value === 'CONSENT_NOT_UNREASONABLE') return /\bconsent\b.{0,80}\bnot to be unreasonably withheld\b/i.test(quote);
    return value === 'CONSENT_SOLE' && /\bsole (?:and absolute )?discretion\b/i.test(quote);
  }
  if (kind === 'REGULATORY_FILING_OBLIGATION') return value === true && /\b(?:shall|will)\b.{0,100}\b(?:prepare and )?file\b/i.test(quote);
  if (kind === 'NON_IMPEDIMENT_COVENANT') return value === true && /\b(?:shall not|neither .{0,120} shall|no party shall)\b.{0,240}\b(?:prevent|delay|impede)\b.{0,120}\b(?:consummation|closing|transactions?)\b/i.test(quote);
  return true;
}

function regulatoryFilingRegimeCorroborated(ref, quote) {
  if (typeof ref !== 'string' || ref.length === 0 || !quote.includes(ref)) return false;
  if (/[,;]/.test(ref) || /\b(?:and|or)\b/i.test(ref)) return false;
  return /\b(?:Act|Law|Regulation|Rules?|Code|CMA|CFIUS|FCC|FTC|DOJ|SAMR|Commission)\b/.test(ref);
}

// ---------------------------------------------------------------------------
// No-shop family (family-no-shop slice, docs/superpowers/specs/2026-08-02-
// family-no-shop-design.md section 4, AUDIT-AMENDED): frozen resolver
// constants -- action_code/prerequisite_code/period_role <-> quote text.
// Every pattern word-bounded (audit C-2's convention, restated here for
// this family's own tables): a wrong-but-in-enum label must never publish
// under the wrong code. UNLIKE the termination-fee trigger table, this
// family's corroboration is a VETO ON THE PROPOSED LABEL, never a
// classifier over the full table (spec section 4: "corroboration is a veto
// on the proposed label, not a classifier") -- only the ASSERTED code's own
// pattern is tested; a quote that would ALSO satisfy some other code's
// pattern is irrelevant to whether the asserted code corroborates.
//
// Multi-condition entries (spec's "AND" pairs) are expressed as
// `{ all: [pattern, pattern] }` -- every pattern in the array must match.
// ---------------------------------------------------------------------------

function allPatterns(...patterns) {
  return Object.freeze({ all: Object.freeze(patterns) });
}

function corroborationPatternMatches(entry, quote) {
  if (!entry) return false;
  if (entry.all) return entry.all.every((pattern) => pattern.test(quote));
  return entry.test(quote);
}

const NO_SHOP_ACTION_CORROBORATION_TABLE_VERSION = 1;

// Action codes (spec section 4, grounded verbatim in production NOSOL-
// PROHIBIT cards -- "(1) solicit", "(i) initiate, solicit, propose,
// knowingly encourage, or knowingly facilitate"). Every stem is LEFT-
// BOUNDED with an explicit `\b` -- this module adds no bounding of its own,
// so an unbounded stem here would be the audit-M-2 gate-widener
// ("unsolicited" must never corroborate SOLICIT_*; "furtherance"/
// "Furthermore" must never corroborate FURTHER_*). One pattern per code
// (audit M-3): a shared multi-code pattern would let a quote saying only
// "recommend" corroborate ENTER_ALTERNATIVE_AGREEMENT, the wrong-but-in-
// enum publish this table exists to stop.
const NO_SHOP_ACTION_CORROBORATION_TABLE = Object.freeze({
  SOLICIT_ACQUISITION_INQUIRY_PROPOSAL_OR_OFFER: /\bsolicit/i,
  INITIATE_ACQUISITION_INQUIRY_PROPOSAL_OR_OFFER: /\binitiat/i,
  FACILITATE_ACQUISITION_INQUIRY_PROPOSAL_OR_OFFER: /\bfacilitat/i,
  ENCOURAGE_ACQUISITION_INQUIRY_PROPOSAL_OR_OFFER: /\bencourag/i,
  FURNISH_NONPUBLIC_INFORMATION: allPatterns(/\bfurnish|\bprovide|\bafford/i, /\binformation/i),
  GRANT_DGCL_SECTION_203_WAIVER: /\bSection 203\b|\bDGCL\b|business combination statute/i,
  ENGAGE_IN_DISCUSSIONS: /\bdiscussion/i,
  CONTINUE_DISCUSSIONS: /\bdiscussion/i,
  PARTICIPATE_IN_DISCUSSIONS: /\bdiscussion/i,
  ENGAGE_IN_NEGOTIATIONS: /\bnegotiat/i,
  CONTINUE_NEGOTIATIONS: /\bnegotiat/i,
  PARTICIPATE_IN_NEGOTIATIONS: /\bnegotiat/i,
  AFFORD_ACCESS_TO_PROPERTIES: allPatterns(/\baccess\b/i, /\bpropert/i),
  AFFORD_ACCESS_TO_BOOKS: allPatterns(/\baccess\b/i, /\bbooks\b/i),
  AFFORD_ACCESS_TO_RECORDS: allPatterns(/\baccess\b/i, /\brecords\b/i),
  APPROVE_ALTERNATIVE_AGREEMENT: /\bapprov/i,
  RECOMMEND_ALTERNATIVE_AGREEMENT: /\brecommend|\bdeclared? advisable/i,
  ENTER_ALTERNATIVE_AGREEMENT: /\benter/i,
  PROPOSE_TO_APPROVE_ALTERNATIVE_AGREEMENT: allPatterns(/\bpropos/i, /\bapprov/i),
  PROPOSE_TO_RECOMMEND_ALTERNATIVE_AGREEMENT: allPatterns(/\bpropos/i, /\brecommend|\bdeclared? advisable/i),
  PROPOSE_TO_ENTER_ALTERNATIVE_AGREEMENT: allPatterns(/\bpropos/i, /\benter/i),
  SUPPORT_ACQUISITION_PROPOSAL: /\bsupport/i,
  FURTHER_ACQUISITION_PROPOSAL: /\bfurther\b/i,
});

function noShopActionCorroborated(actionCode, quote) {
  return corroborationPatternMatches(NO_SHOP_ACTION_CORROBORATION_TABLE[actionCode], quote);
}

const NO_SHOP_PREREQUISITE_CORROBORATION_TABLE_VERSION = 1;

// Prerequisite codes (spec section 4, grounded verbatim in production
// NOSOL-EXCEPT cards -- "prior to ... receipt of the Company Stockholder
// Approval", "bona fide", "did not result from a material breach",
// "determines in good faith after consultation with", "constitutes, or
// could reasonably be expected to lead to, a Superior Proposal").
// SUBJECT_TO_INITIAL_PROPOSAL_NOTICE is strengthened per audit m-4: bare
// /notice|notif/i alone was a near-vacuous veto (essentially every
// no-shop exception paragraph contains "notice"), so it requires the
// "subject to"/"compliance with" anchor too.
const NO_SHOP_PREREQUISITE_CORROBORATION_TABLE = Object.freeze({
  WINDOW_SIGNING_TO_STOCKHOLDER_APPROVAL: allPatterns(/\bprior to\b/i, /\b(?:approval|vote)\b/i),
  BONA_FIDE_UNSOLICITED_WRITTEN_PROPOSAL_RECEIVED: /\bbona fide\b/i,
  PROPOSAL_NOT_RESULTING_FROM_COVENANT_OBLIGOR_NO_SHOP_BREACH:
    /did not result from|not solicited in violation|not resulting from/i,
  BOARD_GOOD_FAITH_SUPERIOR_PROPOSAL_PATH_DETERMINATION: allPatterns(/\bgood faith\b/i, /Superior Proposal/),
  BOARD_GOOD_FAITH_FIDUCIARY_DUTY_DETERMINATION: allPatterns(/\bgood faith\b/i, /\bfiduciar/i),
  OUTSIDE_FINANCIAL_ADVISER_AND_LEGAL_COUNSEL_CONSULTATION:
    allPatterns(/financial advisor|financial adviser/i, /legal counsel/i),
  OUTSIDE_LEGAL_COUNSEL_FIDUCIARY_CONSULTATION: allPatterns(/legal counsel/i, /\bfiduciar/i),
  SUBJECT_TO_INITIAL_PROPOSAL_NOTICE: allPatterns(/\bsubject to\b|\bcompliance with\b/i, /\bnotice\b|\bnotif/i),
  ACCEPTABLE_CONFIDENTIALITY_AGREEMENT_REQUIRED: /confidentiality agreement/i,
  NONPUBLIC_INFORMATION_PREVIOUSLY_OR_SUBSTANTIALLY_SIMULTANEOUSLY_PROVIDED_TO_PROTECTED_PARTY:
    /\bpreviously\b|\bprior to\b|substantially (?:concurrent|simultaneous)|\bsimultaneously\b/i,
});

function noShopPrerequisiteCorroborated(prerequisiteCode, quote) {
  return corroborationPatternMatches(NO_SHOP_PREREQUISITE_CORROBORATION_TABLE[prerequisiteCode], quote);
}

// Period roles -- the mislabel this family is most exposed to (spec section
// 4): agreements name the matching window "the 'Notice Period'" while the
// true notice obligation is hour-denominated. NOTICE requires a
// receipt-trigger MANDATORY anchor (audit M-1: an earlier `/(after|upon|of
// the)?\s*receipt/i` had a fully optional prefix group and degenerated to
// bare /receipt/i, which match-window text routinely contains too).
const NO_SHOP_PERIOD_ROLE_CORROBORATION_TABLE = Object.freeze({
  NOTICE(quote) {
    const trigger = /(?:after|upon|following)\s+(?:the\s+)?receipt of (?:any|an|such) (?:Acquisition|Takeover|Company Acquisition) Proposal/i.test(quote)
      || /receives (?:any|an) (?:Acquisition|Takeover) Proposal/i.test(quote);
    return trigger && /\bnotif|\bnotice\b|\badvise/i.test(quote);
  },
  INITIAL_MATCH(quote) {
    return /\bin advance\b|\bprior (?:written )?notice\b|\bbefore taking\b/i.test(quote)
      && /\brecommendation\b|\bterminat|\bnegotiat|\bmatch/i.test(quote);
  },
  SUBSEQUENT_MATCH(quote) {
    return /\bamend|\bmodif|\brevis|change to the terms|new written notice/i.test(quote);
  },
});

function noShopPeriodRoleCorroborated(periodRole, quote) {
  const test = NO_SHOP_PERIOD_ROLE_CORROBORATION_TABLE[periodRole];
  return typeof test === 'function' ? test(quote) : false;
}

const NO_SHOP_WAVE_B_RESOLUTION_MAP = Object.freeze({
  CEASE_ACTION: Object.freeze({
    concept_key: 'NOSOL-CEASE',
    claim_definition_key: 'NO_SHOP_CEASE_ACTION',
    values: Object.freeze([
      'CEASE_EXISTING_DISCUSSIONS_OR_NEGOTIATIONS',
      'CEASE_FURNISHING_INFORMATION',
      'TERMINATE_DATA_ROOM_ACCESS',
      'REQUEST_RETURN_OR_DESTRUCTION_OF_INFORMATION',
    ]),
  }),
  REPRESENTATIVE_CONTROL_STANDARD: Object.freeze({
    concept_key: 'NOSOL-CEASE',
    claim_definition_key: 'NO_SHOP_REPRESENTATIVE_CONTROL_STANDARD',
    values: Object.freeze(['CAUSE_NOT_TO', 'REASONABLE_BEST_EFFORTS', 'INSTRUCT_NOT_TO']),
  }),
  REPRESENTATIVE_BREACH_ATTRIBUTION: Object.freeze({
    concept_key: 'NOSOL-CEASE',
    claim_definition_key: 'NO_SHOP_REPRESENTATIVE_BREACH_ATTRIBUTION',
    values: Object.freeze([true]),
  }),
  STANDSTILL_ACTION: Object.freeze({
    concept_key: null,
    claim_definition_key: 'NO_SHOP_STANDSTILL_ACTION',
    values: Object.freeze([
      'ENFORCE',
      'NO_WAIVER_RELEASE_OR_MODIFICATION',
      'PERMIT_WAIVER_FOR_CONFIDENTIAL_PROPOSAL',
      'PERMIT_WAIVER_FIDUCIARY_DUTY_GATED',
    ]),
  }),
  FIDUCIARY_ENGAGEMENT_STANDARD: Object.freeze({
    concept_key: 'NOSOL-EXCEPT',
    claim_definition_key: 'NO_SHOP_FIDUCIARY_ENGAGEMENT_STANDARD',
    values: Object.freeze([
      'CONSTITUTES_OR_COULD_REASONABLY_BE_EXPECTED_TO_LEAD',
      'COULD_REASONABLY_BE_EXPECTED_TO_LEAD',
      'REASONABLY_LIKELY_TO_LEAD',
      'CONSTITUTES_SUPERIOR_PROPOSAL',
    ]),
  }),
  RECOMMENDATION_CHANGE_FIDUCIARY_STANDARD: Object.freeze({
    concept_key: 'NOSOL-RECOMMEND',
    claim_definition_key: 'NO_SHOP_RECOMMENDATION_CHANGE_FIDUCIARY_STANDARD',
    values: Object.freeze([
      'INCONSISTENT_WITH_FIDUCIARY_DUTIES',
      'BREACH_OF_FIDUCIARY_DUTIES',
      'REASONABLY_LIKELY_BREACH',
    ]),
  }),
  RECOMMENDATION_CHANGE_ACTION: Object.freeze({
    concept_key: 'NOSOL-RECOMMEND',
    claim_definition_key: 'NO_SHOP_RECOMMENDATION_CHANGE_ACTION',
    values: Object.freeze([
      'WITHDRAW_QUALIFY_OR_MODIFY_RECOMMENDATION',
      'APPROVE_ENDORSE_OR_RECOMMEND_ACQUISITION_PROPOSAL',
      'FAIL_TO_INCLUDE_RECOMMENDATION',
      'FAIL_TO_REAFFIRM_RECOMMENDATION',
      'TENDER_OFFER_NO_REJECTION',
      'ENTER_ALTERNATIVE_AGREEMENT',
      'RESOLVE_OR_AGREE_TO_FOREGOING',
    ]),
  }),
  RECOMMENDATION_CHANGE_TRIGGER: Object.freeze({
    concept_key: 'NOSOL-RECOMMEND',
    claim_definition_key: 'NO_SHOP_RECOMMENDATION_CHANGE_TRIGGER',
    values: Object.freeze(['SUPERIOR_PROPOSAL', 'INTERVENING_EVENT']),
  }),
  RECOMMENDATION_SAFE_DISCLOSURE: Object.freeze({
    concept_key: 'NOSOL-RECOMMEND',
    claim_definition_key: 'NO_SHOP_RECOMMENDATION_SAFE_DISCLOSURE',
    values: Object.freeze([
      'STOP_LOOK_AND_LISTEN',
      'RULE_14D9_OR_14E2_DISCLOSURE',
      'FACTUAL_DISCLOSURE_REAFFIRMING_RECOMMENDATION',
      'DISCLOSURE_REQUIRED_BY_LAW',
    ]),
  }),
});

const NO_SHOP_WAVE_B_CORROBORATION_TABLE = Object.freeze({
  CEASE_ACTION: Object.freeze({
    CEASE_EXISTING_DISCUSSIONS_OR_NEGOTIATIONS: allPatterns(/\b(?:cease|terminate|discontinue)\b/i, /\b(?:discussion|negotiation)s?\b/i),
    CEASE_FURNISHING_INFORMATION: allPatterns(/\b(?:cease|stop|discontinue)\b/i, /\b(?:furnish|provid|information)\w*\b/i),
    TERMINATE_DATA_ROOM_ACCESS: allPatterns(/\b(?:terminate|revoke|cut off|disable)\b/i, /\b(?:data room|access)\b/i),
    REQUEST_RETURN_OR_DESTRUCTION_OF_INFORMATION: allPatterns(/\brequest\w*\b/i, /\b(?:return|destruction|destroy)\w*\b/i),
  }),
  REPRESENTATIVE_CONTROL_STANDARD: Object.freeze({
    CAUSE_NOT_TO: allPatterns(/\bcause\b/i, /\bRepresentative/i),
    REASONABLE_BEST_EFFORTS: allPatterns(/\b(?:reasonable best|commercially reasonable) efforts\b/i, /\bcause\b/i),
    INSTRUCT_NOT_TO: allPatterns(/\b(?:instruct|direct)\w*\b/i, /\bRepresentative/i),
  }),
  REPRESENTATIVE_BREACH_ATTRIBUTION: Object.freeze({
    true: allPatterns(/\b(?:violation|breach)\b/i, /\bRepresentative/i, /\b(?:deemed|constitute|treated as)\b/i),
  }),
  STANDSTILL_ACTION: Object.freeze({
    ENFORCE: /\bshall enforce\b|\benforce the provisions\b/i,
    NO_WAIVER_RELEASE_OR_MODIFICATION: allPatterns(/\bshall not\b|\bnot to\b/i, /\b(?:waive|release|modify|amend|terminate)\w*\b/i),
    PERMIT_WAIVER_FOR_CONFIDENTIAL_PROPOSAL: allPatterns(/\b(?:may|permitted to)\b/i, /\bwaiv\w*\b/i, /\bconfidential\w* (?:proposal|offer)\b/i),
    PERMIT_WAIVER_FIDUCIARY_DUTY_GATED: allPatterns(/\b(?:may|permitted to)\b/i, /\bwaiv\w*\b/i, /\bfiduciar\w* dut/i),
  }),
  FIDUCIARY_ENGAGEMENT_STANDARD: Object.freeze({
    CONSTITUTES_OR_COULD_REASONABLY_BE_EXPECTED_TO_LEAD: /constitutes?,? or could reasonably be expected to (?:lead to|result in).*Superior Proposal/i,
    COULD_REASONABLY_BE_EXPECTED_TO_LEAD: /could reasonably be expected to (?:lead to|result in).*Superior Proposal/i,
    REASONABLY_LIKELY_TO_LEAD: /reasonably likely to (?:lead to|result in).*Superior Proposal/i,
    CONSTITUTES_SUPERIOR_PROPOSAL: /constitutes? (?:a )?Superior Proposal/i,
  }),
  RECOMMENDATION_CHANGE_FIDUCIARY_STANDARD: Object.freeze({
    INCONSISTENT_WITH_FIDUCIARY_DUTIES: /inconsistent with.*fiduciar\w* dut/i,
    BREACH_OF_FIDUCIARY_DUTIES: /breach of.*fiduciar\w* dut/i,
    REASONABLY_LIKELY_BREACH: /reasonably likely.*breach.*fiduciar\w* dut/i,
  }),
  RECOMMENDATION_CHANGE_ACTION: Object.freeze({
    WITHDRAW_QUALIFY_OR_MODIFY_RECOMMENDATION: /\b(?:withdraw|withhold|qualify|modify|amend)\w*.*\brecommendation\b/i,
    APPROVE_ENDORSE_OR_RECOMMEND_ACQUISITION_PROPOSAL: /\b(?:approve|endorse|recommend)\w*.*\b(?:Acquisition|Takeover) Proposal\b/i,
    FAIL_TO_INCLUDE_RECOMMENDATION: /\bfail\w* to include.*\brecommendation\b/i,
    FAIL_TO_REAFFIRM_RECOMMENDATION: /\bfail\w* to (?:reaffirm|reconfirm|reiterate).*\brecommendation\b/i,
    TENDER_OFFER_NO_REJECTION: allPatterns(/\b(?:tender|exchange) offer\b/i, /\b(?:recommend against|reject)\b/i),
    ENTER_ALTERNATIVE_AGREEMENT: /\benter\w* into.*\b(?:Alternative|Acquisition) Agreement\b/i,
    RESOLVE_OR_AGREE_TO_FOREGOING: /\b(?:resolve|agree|propose)\w* to (?:take|do|effect).*foregoing\b/i,
  }),
  RECOMMENDATION_CHANGE_TRIGGER: Object.freeze({
    SUPERIOR_PROPOSAL: allPatterns(/\bSuperior Proposal\b/i, /\brecommendation|\bwithdraw|\bmodify|\bchange/i),
    INTERVENING_EVENT: allPatterns(/\bIntervening Event\b/i, /\brecommendation|\bwithdraw|\bmodify|\bchange/i),
  }),
  RECOMMENDATION_SAFE_DISCLOSURE: Object.freeze({
    STOP_LOOK_AND_LISTEN: /\bstop,? look and listen\b|Rule 14d-9\(f\)/i,
    RULE_14D9_OR_14E2_DISCLOSURE: /Rule 14d-9|Rule 14e-2/i,
    FACTUAL_DISCLOSURE_REAFFIRMING_RECOMMENDATION: allPatterns(/\bfactual\b|\bfact\b/i, /\breaffirm\w*.*\brecommendation\b/i),
    DISCLOSURE_REQUIRED_BY_LAW: /\b(?:disclosure|required to disclose)\b.*\b(?:applicable )?law\b|\brequired by (?:applicable )?law\b/i,
  }),
});

function noShopWaveBValueCorroborated(assertionKind, canonicalValue, quote) {
  const kindTable = NO_SHOP_WAVE_B_CORROBORATION_TABLE[assertionKind];
  if (!kindTable) return false;
  return corroborationPatternMatches(kindTable[String(canonicalValue)], quote);
}

// Fixed covenant-obligor party for the exception-prerequisite and period
// claims (spec section 4, audit m-2): none of the three carry a
// covenant_obligor phrase of their own in the response shape (only the
// action assertions do -- see no-shop-producer-prompt.js's RESPONSE_SHAPE),
// and "the period obligations' obligor IS the covenant obligor in every
// corpus form" -- always the Company/TARGET, mirroring TERMF_TAIL_PAYER_
// PARTY's own fixed-party precedent above.
const NO_SHOP_COVENANT_OBLIGOR_PARTY = Object.freeze({
  role: 'COVENANT_OBLIGOR', value: 'the Company', capacity: 'TARGET',
});

// ---------------------------------------------------------------------------
// MAE-definition family (family-mae-definition slice, docs/superpowers/
// specs/2026-08-02-family-mae-definition-design.md section 4, AUDIT-
// AMENDED): frozen resolver constants -- carveout_code/prong_code <-> quote
// text, and the disproportionality veto. SAME "corroboration is a veto on
// the proposed label, not a classifier" discipline as the no-shop tables
// above (spec section 4, restated verbatim for this family): only the
// ASSERTED code's own pattern is tested. All patterns word-bounded per the
// lexicon rules; acronyms (MFN, GAAP, FDA) are case-sensitive, separate
// patterns -- the `/RSU/`-in-"puRSUant" trap class this repo's own
// SHARE_COUNT table already documents.
// ---------------------------------------------------------------------------

const MAE_CORROBORATION_TABLE_VERSION = 1;

// PARENT_ACTIONS_OR_INACTION carries an explicit NEGATIVE guard (spec
// section 4): it REJECTS quotes matching the request/consent stem, which
// ACTIONS_REQUESTED_BY_PARENT owns. The residual "a both-stem quote
// proposed as ACTIONS_REQUESTED_BY_PARENT still resolves" is the disclosed,
// one-directional veto-not-classifier cost (spec's "Known costs").
const MAE_PARENT_REQUEST_CONSENT_STEM = /request|consent/i;

const MAE_CARVEOUT_CORROBORATION_TABLE = Object.freeze({
  ECONOMY_GENERAL: /general economic conditions|econom(?:y|ic conditions)/i,
  INDUSTRY_GENERAL: allPatterns(/industr/i, /conditions|changes|developments|affecting/i),
  FINANCIAL_MARKETS: /(?:financial|credit|capital|securities|currency) markets/i,
  ACTS_OF_WAR_TERRORISM: /acts? of war|terroris|hostilit|military action|sabotage/i,
  NATURAL_DISASTERS: /natural disaster|earthquake|hurricane|tsunami|tornado|flood|mudslide|wild ?fire|acts? of god|force majeure/i,
  PANDEMIC: /pandemic|epidemic|disease outbreak|COVID|public health/i,
  ANNOUNCEMENT_OR_PENDENCY: /announcement|pendency/i,
  COMPLIANCE_WITH_AGREEMENT: /compliance with|(?:expressly )?required by this Agreement/i,
  ACTIONS_REQUESTED_BY_PARENT: /request of Parent|Parent'?s? (?:written )?request|written consent of Parent|Parent'?s? (?:written )?consent/i,
  CHANGE_IN_LAW: /changes? in (?:applicable )?Law|regulatory, legislative or political/i,
  CHANGE_IN_GAAP: {
    test(quote) { return /GAAP/.test(quote) || /accounting (?:principles|standards|requirements)/i.test(quote); },
  },
  STOCK_PRICE_CHANGES: /(?:trading|market) price|trading volume/i,
  FAILURE_TO_MEET_PROJECTIONS: allPatterns(/fail(?:ure)? .{0,30}to meet/i, /projections|forecasts|estimates|guidance|budgets|expectations/i),
  PRICING_MFN: {
    test(quote) { return /MFN/.test(quote) || /most[- ]favou?red[- ]nation/i.test(quote); },
  },
  EXECUTIVE_ACTION: {
    test(quote) { return /executive order/i.test(quote) || /sanction/i.test(quote); },
  },
  TARIFFS: /tariff|trade restriction|trade polic|trade barrier|trade war|import dut/i,
  GOVERNMENT_SHUTDOWNS: /government shutdown|civil unrest|political instability/i,
  CLINICAL_RESULTS: allPatterns(/clinical/i, /(?:trial|stud(?:y|ies)|data|results?|hold|endpoint)/i),
  FDA_DISCUSSIONS: allPatterns({ test: (q) => /FDA/.test(q) }, /discussion|correspondence|interaction|meeting|communicat/i),
  FDA_APPROVALS_COMPETITOR_ENTRY: {
    test(quote) {
      return (/competit/i.test(quote) && /(?:entry|entrant|product|approval|launch)/i.test(quote))
        || (/FDA/.test(quote) && /approval/i.test(quote));
    },
  },
  SUPPLY_CHAIN: /supply chain|raw material/i,
  PRICING_REIMBURSEMENT: /reimbursement|price control|payor/i,
  MEDICAL_ORGS_STATEMENTS: allPatterns(/medical|scientific/i, /(?:society|organization|statement)/i),
  PATENTS_EXCLUSIVITY: /patent|loss of exclusivity/i,
  PARENT_ACTIONS_OR_INACTION: {
    test(quote) {
      if (MAE_PARENT_REQUEST_CONSENT_STEM.test(quote)) return false;
      return /act(?:s|ion)? (?:or omission[s]? )?of Parent|taken by Parent|Parent'?s? (?:acts|inaction|omission)/i.test(quote);
    },
  },
  EMPLOYEE_DEPARTURES: allPatterns(/employee|officer|executive/i, /departure|attrition|loss|resignation/i),
});

function maeCarveoutCorroborated(carveoutCode, quote) {
  return corroborationPatternMatches(MAE_CARVEOUT_CORROBORATION_TABLE[carveoutCode], quote);
}

const MAE_DEFINITION_PRONG_CORROBORATION_TABLE = Object.freeze({
  BUSINESS_EFFECTS: allPatterns(
    /material adverse effect/i,
    /business|financial condition|condition \(financial|results of operations?|assets/i,
    /taken as a whole/i,
  ),
  CONSUMMATION_PREVENTION: allPatterns(/prevent|delay|impair/i, /consummat/i),
});

function maeDefinitionProngCorroborated(prongCode, quote) {
  return corroborationPatternMatches(MAE_DEFINITION_PRONG_CORROBORATION_TABLE[prongCode], quote);
}

const MAE_DISPROPORTIONALITY_CORROBORATION_PATTERN = /disproportionate(?:ly)?/i;

function maeDisproportionalityCorroborated(quote) {
  return MAE_DISPROPORTIONALITY_CORROBORATION_PATTERN.test(quote);
}

// ---------------------------------------------------------------------------
// Provenance tags (spec section 5, plan Task 5): every resolved claim and
// open-world entry this module emits carries exactly one `answer_provenance`
// tag. It lives at `attributes.answer_provenance` for resolved claims (the
// only room the frozen CLAIM_REVISION/V1 identity contract -- claims-
// relationships.js's CLAIM_REVISION_KEYS -- leaves for a non-identity extra;
// see native-write-set-adapter.js's own file header on why identity fields
// cannot be added to that row) and as a top-level field on open-world
// entries (which never reach that frozen contract at all -- see
// pushOpenWorld). The resolver mints MECHANICAL and AI only; it never mints
// VERIFIED -- that is a human review-flow action -- but
// `buildVerifiedAnswerProvenance` is exported so review flows and this
// slice's own tests can construct a validated VERIFIED shape.
// ---------------------------------------------------------------------------

const ANSWER_PROVENANCE_TAGS = Object.freeze(['MECHANICAL', 'AI', 'VERIFIED']);

// Every resolver decision this module makes is pinned to the mapping table
// and qualifier-kind lexicon versions in force (mirrors resolution_receipt's
// own pins, spec section 5 work item 1: "pins = {mapping_table_version,
// qualifier_kind_lexicon_version, ruling_corpus_id/version where a ruling
// applied}"). `rulingProvenance` is the `provenance` object ruling-corpus.js's
// own `applyRuling` already builds on an APPLIED outcome (`{tag: 'MECHANICAL',
// pins: {ruling_corpus_id, ruling_corpus_version, originating_ruling_id}}`)
// -- reused verbatim rather than re-derived, so there is exactly one place
// that decides what a ruling application pins.
function buildMechanicalAnswerProvenance({ rulingProvenance = null, extraPins = null } = {}) {
  const pins = {
    mapping_table_version: MAPPING_TABLE_VERSION,
    qualifier_kind_lexicon_version: QUALIFIER_KIND_LEXICON_VERSION,
    ...(rulingProvenance && rulingProvenance.pins ? rulingProvenance.pins : {}),
    // Approval item 2 (M2): callers whose MECHANICAL tag rests on a gate
    // rather than a written resolver rule (the bring-down tier's
    // allowed-values-membership check) name that gate explicitly here, e.g.
    // `{ gate: 'ALLOWED_VALUES_MEMBERSHIP' }`. Qualifier-path callers never
    // pass this, so their pins are unchanged.
    ...(extraPins || {}),
  };
  return Object.freeze({ tag: 'MECHANICAL', pins: Object.freeze(pins) });
}

// Producer-originated raw values carried into open world are AI-tagged
// (spec section 5 work item 2: "pinning model, PROMPT_ID, PROMPT_VERSION").
// `extraction_provenance` is candidate-proposal-compiler.js's own outer
// envelope (`{extractor_id, extractor_version, prompt_digest, ...}`) --
// there is no separate per-candidate "model" field, so `extractor_id` is the
// best-effort `model_id` pin the spec's "if available" wording anticipates;
// `prompt_id`/`prompt_version` come from anthropic-provider.js's own
// re-exported constants, the same PROMPT_ID/PROMPT_VERSION every compiled
// candidate in a run was actually produced under.
function buildAiAnswerProvenance({ extractionProvenance } = {}) {
  const pins = {
    model_id: extractionProvenance && typeof extractionProvenance.extractor_id === 'string'
      ? extractionProvenance.extractor_id
      : null,
    prompt_id: PROMPT_ID_REEXPORT,
    prompt_version: PROMPT_VERSION_REEXPORT,
  };
  return Object.freeze({ tag: 'AI', pins: Object.freeze(pins) });
}

// Human-confirmed provenance (spec section 5: "Pins reviewer, time, AND the
// source it was verified against: the canonical_text hash and the evidence
// excerpt id"). The resolver never calls this -- only a review flow (e.g.
// scripts/confirm-kind-ruling.mjs's future analogue for answer verification)
// would -- but it is exported so callers mint a shape verified-pin-sweep.js
// and validate-write-set.js both recognise, rather than each inventing one.
function buildVerifiedAnswerProvenance({
  reviewer, verified_at: verifiedAt, canonical_text_hash: canonicalTextHash, evidence_excerpt_id: evidenceExcerptId,
} = {}) {
  requireNonEmptyString(reviewer, 'reviewer');
  requireNonEmptyString(verifiedAt, 'verified_at');
  requireNonEmptyString(canonicalTextHash, 'canonical_text_hash');
  requireNonEmptyString(evidenceExcerptId, 'evidence_excerpt_id');
  return Object.freeze({
    tag: 'VERIFIED',
    pins: Object.freeze({
      reviewer,
      verified_at: verifiedAt,
      canonical_text_hash: canonicalTextHash,
      evidence_excerpt_id: evidenceExcerptId,
    }),
  });
}

// Supersession scaffolding (spec section 5 work item 4 / plan Task 5 work
// item 4): the minimal link shape a rule-version bump needs to mint a
// superseding revision linked to the one it supersedes. Content-derived, so
// two independent callers linking the same (superseded, superseding) pair
// mint the identical link -- the established convention throughout this
// module (see the file header on `contentId` reuse). This module does not
// itself decide WHEN a rule-version bump requires re-derivation (that is
// unchanged resolver behaviour: a new run under a new MAPPING_TABLE_VERSION
// simply resolves fresh claim_revision_ids) -- it supplies the link a caller
// wiring two such revisions together needs, exercised in this task's own
// provenance test.
function mintSupersessionLink({ supersededRevisionId, supersedingRevisionId }) {
  requireNonEmptyString(supersededRevisionId, 'supersededRevisionId');
  requireNonEmptyString(supersedingRevisionId, 'supersedingRevisionId');
  const linkId = contentId(SUPERSESSION_LINK_DOMAIN, {
    superseded_revision_id: supersededRevisionId,
    superseding_revision_id: supersedingRevisionId,
  });
  return Object.freeze({
    schema_version: SUPERSESSION_LINK_DOMAIN,
    supersession_link_id: linkId,
    supersedes: supersededRevisionId,
    superseded_by: supersedingRevisionId,
  });
}

// ---------------------------------------------------------------------------
// Vocabulary indexing. `contract_vocabulary` is a compiled contract bundle
// exactly as lib/canonical-v2/contract-bundle.js produces (the SAME object a
// caller subsequently hands to validate-write-set.js) -- this module does
// not invent a parallel vocabulary shape, so there is only ever one source
// of truth for "what is registered".
// ---------------------------------------------------------------------------

function vocabularyIndex(contractVocabulary) {
  requirePlainObject(contractVocabulary, 'contract_vocabulary');
  requireArray(contractVocabulary.concepts, 'contract_vocabulary.concepts');
  requireArray(contractVocabulary.claim_definitions, 'contract_vocabulary.claim_definitions');
  return {
    concepts: new Set(contractVocabulary.concepts.map((entry) => entry.concept_key)),
    claimDefinitions: new Map(
      contractVocabulary.claim_definitions.map((entry) => [entry.claim_definition_key, entry]),
    ),
  };
}

// ---------------------------------------------------------------------------
// v1<->v2 comparator wiring (docs/superpowers/specs/2026-08-01-v1v2-
// comparator-net-design.md, "Wiring"). STRICTLY ADDITIVE: called only when
// the caller supplied `v1v2_comparison`; every code path above this point in
// the file, and everything in this function's own absence, is byte-
// identical to before this slice landed.
//
// For a claim whose provision has a Tier 1 result in the comparison
// receipt: `V1_V2_COMPARATOR_ABSENT` is removed from `unevaluated_
// conditions`. A `SECTION_MISMATCH` Tier 1 result pushes `V1V2_SECTION_
// MISMATCH` into the claim's structural `reasons` (the same gate-failure
// flow MULTI_SPAN_COMPOSED etc. already use) and never reaches Tier 2 --
// "the dangerous one; always review" (spec). Otherwise (PRESENCE_AGREEMENT
// or V1_MISSING) Tier 2 is consulted for this claim's own concept+
// definition: an AGREEMENT clears the condition outright (nothing added); a
// MISMATCH pushes `V1V2_VALUE_MISMATCH` into `reasons` (both values already
// live on the comparison receipt's `value_outcomes`, not duplicated here);
// no Tier 2 mapping, or a mapping that applies but finds no v1 value
// (`V1_VALUE_ABSENT`), means condition 1 stays unevaluated for THIS claim --
// Ben's ruled option (A): `V1_V2_COMPARATOR_INAPPLICABLE_TO_CLAIM` is added
// to `unevaluated_conditions`, still blocking auto-pass.
//
// RECEIPT-LEVEL RECALL OUTCOMES NEVER TOUCH CLAIM TRIAGE (spec audit C2):
// `V2_MISSING`/`V2_NOT_ATTEMPTED` never appear in `provision_outcomes`
// keyed to a REAL v2 provision (they describe the ABSENCE of one -- see
// v1v2-comparator.js's own Tier 1 pass), so they can never match a
// `resolved[]` entry's `provision_instance_id` here; only `V1V2_PRESENCE_
// AGREEMENT`/`SECTION_MISMATCH`/`V1_MISSING` ever do.
//
// OPEN-WORLD AND PROVISIONLESS QUEUE ITEMS KEEP ABSENT (spec): neither
// `open_world[]` entries nor `has_resolution: false` review-queue items
// carry a `provision_instance_id` at all, so this function's lookup simply
// never touches them -- no special-casing needed, they are structurally
// excluded from the loop below.
function applyV1V2Wiring({ resolved, reviewQueue, comparison }) {
  requirePlainObject(comparison, 'v1v2_comparison');
  if (comparison.schema_version !== V1V2_COMPARISON_RECEIPT_SCHEMA) {
    fail('INVALID_V1V2_COMPARISON', `v1v2_comparison.schema_version must be ${V1V2_COMPARISON_RECEIPT_SCHEMA}`, {
      schema_version: comparison.schema_version,
    });
  }
  requireArray(comparison.provision_outcomes, 'v1v2_comparison.provision_outcomes');
  requireArray(comparison.value_outcomes, 'v1v2_comparison.value_outcomes');
  requireNonEmptyString(comparison.v1v2_comparison_receipt_id, 'v1v2_comparison.v1v2_comparison_receipt_id');

  // Severity preference, not first-outcome-wins: when multiple Tier-1
  // outcomes reference the SAME v2_provision_instance_id (e.g. two v1 cards
  // in one family both mapping to a single v2 provision), a SECTION_MISMATCH
  // overrides any other outcome -- "the dangerous one; always review" (spec)
  // must win regardless of array order, never be silently shadowed by
  // whichever outcome the comparison receipt happened to list first.
  const tier1ByProvisionId = new Map();
  for (const outcome of comparison.provision_outcomes) {
    if (!outcome || !outcome.v2_provision_instance_id) continue;
    const existing = tier1ByProvisionId.get(outcome.v2_provision_instance_id);
    if (!existing || (outcome.outcome === 'SECTION_MISMATCH' && existing.outcome !== 'SECTION_MISMATCH')) {
      tier1ByProvisionId.set(outcome.v2_provision_instance_id, outcome);
    }
  }
  const tier2ByProvisionAndDefinition = new Map();
  for (const outcome of comparison.value_outcomes) {
    if (!outcome || !outcome.v2_provision_instance_id) continue;
    tier2ByProvisionAndDefinition.set(`${outcome.v2_provision_instance_id}::${outcome.claim_definition_key}`, outcome);
  }
  const reviewQueueIndexByClaimRevisionId = new Map(
    reviewQueue
      .map((item, index) => [item.claim_revision_id, index])
      .filter(([claimRevisionId]) => claimRevisionId != null),
  );

  const newResolved = [];
  const newReviewQueue = [...reviewQueue];
  let reviewQueueChanged = false;

  for (const entry of resolved) {
    const provisionId = entry.provision_instance && entry.provision_instance.provision_instance_id;
    const tier1 = provisionId ? tier1ByProvisionId.get(provisionId) : null;
    if (!tier1) {
      newResolved.push(entry);
      continue;
    }

    const oldReasons = entry.triage.reasons;
    let newReasons = oldReasons;
    let newUnevaluated = entry.triage.unevaluated_conditions.filter((condition) => condition !== 'V1_V2_COMPARATOR_ABSENT');

    if (tier1.outcome === 'SECTION_MISMATCH') {
      newReasons = Object.freeze([...oldReasons, 'V1V2_SECTION_MISMATCH']);
    } else {
      const tier2 = tier2ByProvisionAndDefinition.get(`${provisionId}::${entry.resolved_claim_definition_key}`);
      if (!tier2 || tier2.outcome === 'V1_VALUE_ABSENT') {
        newUnevaluated.push('V1_V2_COMPARATOR_INAPPLICABLE_TO_CLAIM');
      } else if (tier2.outcome === 'VALUE_MISMATCH') {
        newReasons = Object.freeze([...oldReasons, 'V1V2_VALUE_MISMATCH']);
      }
      // V1V2_VALUE_AGREEMENT: condition 1 satisfied for this claim -- no
      // addition to either reasons or unevaluated_conditions.
    }
    newUnevaluated = Object.freeze(newUnevaluated);

    const gateFailureReasons = newReasons.filter((reason) => reason !== 'CITATION_CORROBORATED_ONLY');
    const deterministicGatesPassed = gateFailureReasons.length === 0;
    const citationCorroboratedOnly = oldReasons.includes('CITATION_CORROBORATED_ONLY');
    const newAutoPass = deterministicGatesPassed && newUnevaluated.length === 0 && !citationCorroboratedOnly;

    const newEntry = Object.freeze({
      ...entry,
      triage: Object.freeze({
        ...entry.triage,
        reasons: newReasons,
        unevaluated_conditions: newUnevaluated,
        deterministic_gates_passed: deterministicGatesPassed,
        auto_pass: newAutoPass,
      }),
    });
    newResolved.push(newEntry);

    const claimRevisionId = entry.claim.claim_revision_id;
    const reviewQueueIndex = claimRevisionId != null ? reviewQueueIndexByClaimRevisionId.get(claimRevisionId) : undefined;
    if (reviewQueueIndex !== undefined) {
      newReviewQueue[reviewQueueIndex] = Object.freeze({
        ...newReviewQueue[reviewQueueIndex], reasons: newReasons, auto_pass: newAutoPass,
      });
      reviewQueueChanged = true;
    }
  }

  return {
    resolved: newResolved,
    reviewQueue: reviewQueueChanged ? newReviewQueue : reviewQueue,
  };
}

// ---------------------------------------------------------------------------
// Lexical-disagreement net wiring (docs/superpowers/specs/2026-08-02-
// lexical-disagreement-net-design.md, "Wiring"). STRICTLY ADDITIVE: called
// only when the caller supplies `lexical_disagreement`; absent, this
// function's own body never runs, and every code path above it is
// byte-identical to before this slice landed.
//
// RECEIPT BINDING ENFORCED IN THE WIRING (spec audit C2), NOT schema-only
// validation -- this receipt gates a condition immediately, unlike the
// v1v2 comparator's receipt id, which is merely pinned for traceability.
// For each claim, BEFORE consuming any outcome, the wiring verifies: (1) a
// receipt exists for the claim's own governing section reference; (2) the
// receipt's `text_sha256` equals that section's hash in the run receipt's
// `resolved_sections`; (3) the receipt's `candidate_digest` equals the
// digest the wiring itself recomputes from THIS RUN's own resolved
// candidates for that section (via `computeLexicalCandidateDigest`, the
// exact same formula the receipt's own builder uses); and (4) the receipt
// validates structurally. ANY failure means the receipt satisfies NOTHING
// for that claim: the claim's own triage is left completely untouched (not
// even `LEXICAL_DISAGREEMENT_NET_ABSENT` is touched -- it REMAINS), fail-
// closed in every branch. The failure is still typed and counted, but only
// at the run-level (`resolution_receipt.counts.lexical_disagreement_*`
// below), never smuggled onto a claim whose own binding never verified.
function computeSectionCandidatesForLexicalDigest(resolved, sectionReference) {
  return resolved
    .filter((entry) => entry.section_reference === sectionReference)
    .map((entry) => ({
      closure_id: entry.claim.closure_id,
      section_reference: entry.section_reference,
      family: entry.concept_key,
      evidence: entry.claim.evidence.map((edge) => ({ start: edge.absolute_start, end: edge.absolute_end })),
    }));
}

function applyLexicalDisagreementWiring({ resolved, reviewQueue, runReceipt, lexicalDisagreement }) {
  requirePlainObject(lexicalDisagreement, 'lexical_disagreement');
  const sectionsByReference = new Map(
    runReceipt.resolved_sections.map((section) => [section.section_reference, section]),
  );
  const reviewQueueIndexByClaimRevisionId = new Map(
    reviewQueue
      .map((item, index) => [item.claim_revision_id, index])
      .filter(([claimRevisionId]) => claimRevisionId != null),
  );

  // Candidate digest is a per-SECTION quantity (spec: "one receipt covers
  // one section") -- computed once per section, from THIS run's own
  // `resolved[]` (pre-lexical-wiring; v1v2 wiring, if it already ran, never
  // touches closure_id/concept_key/evidence, only triage), never per claim.
  const candidateDigestBySection = new Map();
  function candidateDigestForSection(sectionReference) {
    if (!candidateDigestBySection.has(sectionReference)) {
      candidateDigestBySection.set(
        sectionReference,
        computeLexicalCandidateDigest(computeSectionCandidatesForLexicalDigest(resolved, sectionReference)),
      );
    }
    return candidateDigestBySection.get(sectionReference);
  }

  const newResolved = [];
  const newReviewQueue = [...reviewQueue];
  let reviewQueueChanged = false;
  let boundCleanCount = 0;
  let staleSectionCount = 0;
  let malformedSectionCount = 0;
  const staleSections = new Set();
  const malformedSections = new Set();

  for (const entry of resolved) {
    const sectionReference = entry.section_reference;
    const receipt = lexicalDisagreement[sectionReference];

    // No receipt at all for this claim's section: LEXICAL_DISAGREEMENT_NET_
    // ABSENT stays, untouched -- "a claim in a section with no receipt
    // keeps ABSENT" (spec).
    if (!receipt) {
      newResolved.push(entry);
      continue;
    }

    if (!isStructurallyValidLexicalReceipt(receipt)) {
      if (!malformedSections.has(sectionReference)) {
        malformedSections.add(sectionReference);
        malformedSectionCount += 1;
      }
      newResolved.push(entry);
      continue;
    }

    const section = sectionsByReference.get(sectionReference);
    const expectedDigest = candidateDigestForSection(sectionReference);
    // Defense in depth beyond the map lookup itself: the receipt's OWN
    // `section_ref` field must also equal the claim's governing section
    // reference, so a receipt stored under the wrong map key (or a map
    // built by mistake) can never bind by key alone.
    const bound = !!section
      && receipt.section_ref === sectionReference
      && receipt.text_sha256 === section.text_sha256
      && receipt.candidate_digest === expectedDigest;
    if (!bound) {
      if (!staleSections.has(sectionReference)) {
        staleSections.add(sectionReference);
        staleSectionCount += 1;
      }
      newResolved.push(entry);
      continue;
    }

    // Bound and fresh: consult the claim's own family outcome. A family
    // MISSING from the receipt's own outcome domain reads as
    // LEXICON_FAMILY_UNCOVERED by construction (spec audit C1) --
    // `lexicalFamilyOutcomeFromReceipt` already implements that fallback.
    const familyOutcome = lexicalFamilyOutcomeFromReceipt(receipt, entry.concept_key);
    let newReasons = entry.triage.reasons;
    let newUnevaluated = entry.triage.unevaluated_conditions.filter((condition) => condition !== 'LEXICAL_DISAGREEMENT_NET_ABSENT');
    let lexicalClean = false;

    if (familyOutcome.outcome === 'LEXICAL_ALL_SIGNALS_MATCHED') {
      lexicalClean = true;
      // Condition 2 evaluated-and-passed: nothing added to either reasons
      // or unevaluated_conditions, exactly like V1V2_VALUE_AGREEMENT above.
    } else if (familyOutcome.outcome === 'LEXICAL_UNMATCHED_SIGNALS') {
      newReasons = Object.freeze([...newReasons, 'LEXICAL_UNMATCHED_SIGNAL_IN_SCOPE']);
    } else {
      // LEXICON_FAMILY_UNCOVERED: evaluated-but-unevaluable != passed.
      newUnevaluated = [...newUnevaluated, 'LEXICAL_LEXICON_UNCOVERED_FAMILY'];
    }
    newUnevaluated = Object.freeze(newUnevaluated);

    const gateFailureReasons = newReasons.filter((reason) => reason !== 'CITATION_CORROBORATED_ONLY');
    const deterministicGatesPassed = gateFailureReasons.length === 0;
    const citationCorroboratedOnly = entry.triage.reasons.includes('CITATION_CORROBORATED_ONLY');
    const newAutoPass = deterministicGatesPassed && newUnevaluated.length === 0 && !citationCorroboratedOnly;

    // `both_nets_clean` instrumentation marker (spec "Auto-pass
    // arithmetic"): DATA ONLY, computed true only when condition 1 (the
    // v1v2 comparator, if wired) AND condition 2 (this net) BOTH evaluated
    // clean for THIS claim. Never read by any routing decision -- `auto_
    // pass` above is computed exactly as it always was, still permanently
    // blocked by `SOURCE_SCOPE_CERTIFICATION_ABSENT`. Present ONLY when
    // true (an instrumentation marker, not a universally-stamped field) so
    // a run that never wires the v1v2 comparator, or a claim where it never
    // resolved clean, carries no field at all here.
    const v1v2Clean = !entry.triage.unevaluated_conditions.includes('V1_V2_COMPARATOR_ABSENT')
      && !entry.triage.unevaluated_conditions.includes('V1_V2_COMPARATOR_INAPPLICABLE_TO_CLAIM')
      && !entry.triage.reasons.includes('V1V2_SECTION_MISMATCH')
      && !entry.triage.reasons.includes('V1V2_VALUE_MISMATCH');
    const bothNetsClean = v1v2Clean && lexicalClean;
    if (bothNetsClean) boundCleanCount += 1;

    const newTriage = {
      ...entry.triage,
      reasons: newReasons,
      unevaluated_conditions: newUnevaluated,
      deterministic_gates_passed: deterministicGatesPassed,
      auto_pass: newAutoPass,
    };
    if (bothNetsClean) newTriage.both_nets_clean = true;

    const newEntry = Object.freeze({ ...entry, triage: Object.freeze(newTriage) });
    newResolved.push(newEntry);

    const claimRevisionId = entry.claim.claim_revision_id;
    const reviewQueueIndex = claimRevisionId != null ? reviewQueueIndexByClaimRevisionId.get(claimRevisionId) : undefined;
    if (reviewQueueIndex !== undefined) {
      const newQueueItem = {
        ...newReviewQueue[reviewQueueIndex], reasons: newReasons, auto_pass: newAutoPass,
      };
      if (bothNetsClean) newQueueItem.both_nets_clean = true;
      // Disagreement excerpts travel on the queue item (spec: "disagreement
      // excerpts travel on the queue item") -- only when this claim's own
      // family actually carries unmatched signals.
      if (familyOutcome.outcome === 'LEXICAL_UNMATCHED_SIGNALS') {
        newQueueItem.lexical_disagreement_excerpts = Object.freeze([...familyOutcome.disagreement_set]);
      }
      newReviewQueue[reviewQueueIndex] = Object.freeze(newQueueItem);
      reviewQueueChanged = true;
    }
  }

  return {
    resolved: newResolved,
    reviewQueue: reviewQueueChanged ? newReviewQueue : reviewQueue,
    // Key names match the spec's own typed vocabulary for these two
    // binding-failure outcomes (LEXICAL_RECEIPT_STALE / LEXICAL_RECEIPT_
    // MALFORMED) so the receipt-level count a consumer reads is named after
    // exactly the condition it counts, not a generic "stale"/"malformed".
    counts: {
      both_nets_clean: boundCleanCount,
      lexical_receipt_stale_sections: staleSectionCount,
      lexical_receipt_malformed_sections: malformedSectionCount,
    },
  };
}

// ---------------------------------------------------------------------------
// Public entry point.
// ---------------------------------------------------------------------------

/**
 * @param {object} args
 * @param {object} args.run_receipt              a frozen NATIVE_EXTRACTION_RUN_RECEIPT/V1
 *   (native-extraction-run.js) -- section-local evidence, generic claim keys.
 * @param {object} args.contract_vocabulary       a compiled contract bundle (the same
 *   shape lib/canonical-v2/contract-bundle.js's compileFixtureContract() produces, and the
 *   same object subsequently passed to validate-write-set.js's validateResolvedCanonicalWriteSet).
 * @param {object} args.admitted_source_context   an ADMITTED_SEMANTIC_SOURCE_CONTEXT/V1
 *   (admitted-semantic-source.js) whose document_hash matches run_receipt.document_hash.
 * @param {object} [args.known_defect_registry]   a NATIVE_PRODUCER_KNOWN_DEFECT_REGISTRY/V1
 *   (known-defect-registry.js); defaults to the empty registry.
 * @param {object} [args.ruling_corpus]           a RULING_CORPUS/V1 (ruling-corpus.js);
 *   defaults to EMPTY_RULING_CORPUS. Exact-key rulings apply BEFORE the lexicon.
 * @param {string} [args.agreement_date]          an ISO-8601 `YYYY-MM-DD` governed
 *   agreement date, injected by the caller from the admitted source context's deal
 *   record when it carries one -- see the spec's "Agreement date injection" pinned
 *   decision. Absent -> symbolic-date TEMPORAL qualifiers ("as of the date hereof")
 *   abstain and route open-world instead of resolving.
 * @param {object} [args.v1v2_comparison]         a V1V2_COMPARISON_RECEIPT/V1
 *   (v1v2-comparator.js), OPTIONAL and STRICTLY ADDITIVE -- absent, this function's
 *   behavior is byte-identical to before this parameter existed. When supplied, see
 *   `applyV1V2Wiring`'s own header for exactly how it changes `resolved[].triage` and
 *   matching `review_queue[]` entries; `resolution_receipt.v1v2_comparison_receipt_id`
 *   pins the input's own id when supplied; the field is omitted entirely
 *   when no comparison input is given, keeping no-input hashes stable.
 * @param {object} [args.lexical_disagreement]    a MAP of `LEXICAL_DISAGREEMENT_
 *   RECEIPT/V1` (lexical-disagreement-net.js) keyed by `section_ref`, OPTIONAL and
 *   STRICTLY ADDITIVE -- absent, this function's behavior is byte-identical to
 *   before this parameter existed. When supplied, see `applyLexicalDisagreementWiring`'s
 *   own header for exactly how it changes `resolved[].triage` and matching
 *   `review_queue[]` entries; `resolution_receipt.lexical_disagreement_counts` is
 *   populated only when supplied, keeping no-input hashes stable.
 * @returns {{
 *   resolved: object[],
 *   review_queue: object[],
 *   open_world: object[],
 *   residuals: object[],
 *   limb_component_trees: object[],
 *   resolution_receipt: object,
 * }}
 */
function resolveCandidates({
  run_receipt: runReceipt,
  contract_vocabulary: contractVocabulary,
  admitted_source_context: admittedSourceContext,
  known_defect_registry: knownDefectRegistryInput,
  ruling_corpus: rulingCorpusInput,
  agreement_date: agreementDate = null,
  v1v2_comparison: v1v2ComparisonInput = null,
  lexical_disagreement: lexicalDisagreementInput = null,
} = {}) {
  requirePlainObject(runReceipt, 'run_receipt');
  if (runReceipt.schema_version !== RUN_RECEIPT_SCHEMA) {
    fail('INVALID_RUN_RECEIPT', `run_receipt.schema_version must be ${RUN_RECEIPT_SCHEMA}`, {
      schema_version: runReceipt.schema_version,
    });
  }
  requireArray(runReceipt.resolved_sections, 'run_receipt.resolved_sections');
  requireArray(runReceipt.compiled_candidates, 'run_receipt.compiled_candidates');
  const vocabulary = vocabularyIndex(contractVocabulary);
  requirePlainObject(admittedSourceContext, 'admitted_source_context');
  requireNonEmptyString(admittedSourceContext.document_hash, 'admitted_source_context.document_hash');
  requireNonEmptyString(admittedSourceContext.governed_deal_key, 'admitted_source_context.governed_deal_key');
  if (admittedSourceContext.document_hash !== runReceipt.document_hash) {
    fail('DOCUMENT_HASH_MISMATCH', 'admitted_source_context.document_hash does not match run_receipt.document_hash', {
      expected: runReceipt.document_hash, actual: admittedSourceContext.document_hash,
    });
  }
  const knownDefectRegistry = knownDefectRegistryInput
    ? validateKnownDefectRegistry(knownDefectRegistryInput)
    : EMPTY_REGISTRY;
  const rulingCorpus = rulingCorpusInput
    ? validateRulingCorpus(rulingCorpusInput)
    : EMPTY_RULING_CORPUS;

  const sectionsByReference = new Map(
    runReceipt.resolved_sections.map((section) => [section.section_reference, section]),
  );

  // SECTION_FAMILY_AI_UNVERIFIED (docs/superpowers/specs/2026-08-02-family-
  // termination-rights-design.md section 3, BEN RULING 2026-08-02): a
  // section whose family was classified by stage 2 (AI-assisted, provenance
  // `SECTION_FAMILY_AI_CLASSIFIED` -- see section-family-classifier.js) can
  // never auto-pass while that classification is unverified. This reads the
  // provenance native-extraction-run.js already threads onto every resolved
  // section and returns the typed blocking reason for it, or `null` for
  // every other section (in particular every CAPITALISATION section under
  // the pre-registry default, which carries no classifier provenance at
  // all -- see native-extraction-run.js's DEFAULT_SECTION_FAMILY note).
  function sectionFamilyUnverifiedReason(sectionReference) {
    const section = sectionsByReference.get(sectionReference);
    if (!section || section.section_family_provenance !== SECTION_FAMILY_AI_CLASSIFIED) return null;
    return SECTION_FAMILY_AI_UNVERIFIED;
  }

  let resolved = [];
  let reviewQueue = [];
  const openWorld = [];
  const residuals = [];
  const provisionsByGroupKey = new Map();
  const claimOrdinalCounters = new Map();
  const limbTreesByProvisionId = new Map();
  const iocRestrictionComponents = [];
  const iocRestrictionComponentsByKey = new Map();
  const dealKey = admittedSourceContext.governed_deal_key;

  const definedDates = Object.create(null);
  const conflictedDefinedDates = new Set();
  function materialContractGroundingFailure(claim) {
    const quote = String(claim?.raw_value || '');
    const attributes = claim?.attributes || {};
    const bucketCode = attributes.bucket_code;
    if (!MATERIAL_CONTRACT_BUCKET_KINDS.includes(bucketCode)) return 'MATERIAL_CONTRACT_BUCKET_UNSUPPORTED';
    const meta = MATERIAL_CONTRACT_BUCKET_META[bucketCode];
    if (!meta || !(meta.synonyms || []).some((pattern) => pattern.test(quote))) {
      return 'MATERIAL_CONTRACT_BUCKET_UNCORROBORATED';
    }
    if (Array.isArray(attributes.definition_cross_references)
      && attributes.definition_cross_references.length) {
      return 'MATERIAL_CONTRACT_DEFINITION_REFERENCE_UNRESOLVED';
    }
    if (claim.claim_definition_key === MATERIAL_CONTRACT_BUCKET_CLAIM_KEY) {
      return claim.canonical_value === bucketCode ? null : 'MATERIAL_CONTRACT_BUCKET_VALUE_MISMATCH';
    }
    const thresholdKind = attributes.threshold_kind;
    const thresholdValue = String(attributes.threshold_value || '');
    if (!MATERIAL_CONTRACT_THRESHOLD_KINDS.includes(thresholdKind)
      || claim.canonical_value !== thresholdKind) {
      return 'MATERIAL_CONTRACT_THRESHOLD_KIND_UNSUPPORTED';
    }
    if (attributes.cadence_kind != null
      && !MATERIAL_CONTRACT_CADENCE_KINDS.includes(attributes.cadence_kind)) {
      return 'MATERIAL_CONTRACT_CADENCE_UNSUPPORTED';
    }
    if (thresholdKind === 'USD' && !/^\$[\d,]+(?:\.\d+)?$/.test(thresholdValue)) {
      return 'MATERIAL_CONTRACT_THRESHOLD_UNCORROBORATED';
    }
    if (thresholdKind === 'PERCENT' && !/^\d{1,3}(?:\.\d+)?\s?%$/.test(thresholdValue)) {
      return 'MATERIAL_CONTRACT_THRESHOLD_UNCORROBORATED';
    }
    if (thresholdKind === 'TOP_N' && !/^top\s+\d+$/i.test(thresholdValue)) {
      return 'MATERIAL_CONTRACT_THRESHOLD_UNCORROBORATED';
    }
    if (thresholdKind === 'ANY'
      && (!/^any$/i.test(thresholdValue) || !/\bany\b[\s\S]{0,80}\bcontracts?\b/i.test(quote))) {
      return 'MATERIAL_CONTRACT_THRESHOLD_UNCORROBORATED';
    }
    if (thresholdKind !== 'ANY' && !quote.includes(thresholdValue)) {
      return 'MATERIAL_CONTRACT_THRESHOLD_VALUE_NOT_IN_QUOTE';
    }
    return null;
  }

  function generalCovenantGroundingFailure(claim) {
    const quote = String(claim?.raw_value || '');
    const attributes = claim?.attributes || {};
    const code = attributes.covenant_code;
    if (!GENERAL_COVENANT_CODES.includes(code)) return 'GENERAL_COVENANT_CODE_UNSUPPORTED';
    if (attributes.owner_id !== GENERAL_COVENANT_FOLLOW_ON_OWNERS[code]) {
      return 'GENERAL_COVENANT_OWNER_MISMATCH';
    }
    if (claim.canonical_value !== code) return 'GENERAL_COVENANT_CODE_VALUE_MISMATCH';
    if (Array.isArray(attributes.definition_cross_references)
      && attributes.definition_cross_references.length) {
      return 'GENERAL_COVENANT_DEFINITION_REFERENCE_UNRESOLVED';
    }
    if (!/\b(?:shall|will|must|agrees?|covenants?|required)\b/i.test(quote)) {
      return 'GENERAL_COVENANT_OPERATIVE_TEXT_UNCORROBORATED';
    }
    const phrases = [CODES[code]?.label, ...(CODES[code]?.aliases || [])]
      .filter(Boolean)
      .map((phrase) => String(phrase).toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim())
      .filter((phrase) => phrase.length >= 3);
    const normalisedQuote = quote.toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();
    if (!phrases.some((phrase) => normalisedQuote.includes(phrase))) {
      return 'GENERAL_COVENANT_CODE_UNCORROBORATED';
    }
    return null;
  }

  function handleClosingConditionCandidate(entry) {
    const { candidate } = entry;
    const provenance = candidate.extraction_provenance;
    const claim = candidate.claim;
    const attrs = claim.attributes || {};
    const quote = claim.raw_value || '';
    const kind = attrs.assertion_kind;
    const normalisedPhrase = normaliseForMatching(quote);
    const review = (reason) => pushReviewUnresolved({
      entry, claimRow: claim, mapping: null, conceptFamily: 'COND-PENDING', reasons: [reason],
      materiality: materialityFor({ conceptKey: 'COND-PENDING', canonicalValue: null }), normalisedPhrase, attachmentPosition: null,
    });

    if (!CLOSING_CONDITION_ASSERTION_KINDS.includes(kind)) {
      pushOpenWorld({ entry, claimRow: claim, reason: 'CONDITION_ASSERTION_KIND_OUT_OF_ENUM' });
      return;
    }

    const waveBDefinitionByKind = Object.freeze({
      STOCKHOLDER_APPROVAL: 'STOCKHOLDER_APPROVAL_CONDITION',
      LEGAL_RESTRAINT: 'LEGAL_RESTRAINT_CONDITION',
      GOVERNMENT_PROCEEDING: 'GOVERNMENT_PROCEEDING_CONDITION',
      S4_COMPONENT: 'S4_CONDITION_COMPONENT',
      LISTING: 'LISTING_CONDITION',
      FUNDS: 'FUNDS_AVAILABILITY_CONDITION',
      OFFICER_CERTIFICATE: 'OFFICER_CERTIFICATE_REQUIRED',
      FRUSTRATION_CAUSATION: 'FRUSTRATION_CAUSATION_STANDARD',
      FRUSTRATION_BREACH: 'FRUSTRATION_BREACH_STANDARD',
      DOLLAR_THRESHOLD: 'CONDITION_DOLLAR_THRESHOLD',
      BURDENSOME_CONDITION: 'BURDENSOME_CONDITION',
    });

    if (Object.hasOwn(waveBDefinitionByKind, kind)) {
      const definition = waveBDefinitionByKind[kind];
      let concept = null;
      let canonicalValue = true;
      let party = null;
      let partyRole = 'CONDITION_OBLIGOR';
      let corroborated = false;

      if (kind === 'STOCKHOLDER_APPROVAL') {
        corroborated = /stockholder approval|requisite (?:affirmative )?vote|approval of the stockholders/i.test(quote);
        concept = 'COND-M-STOCKHOLDER';
        if (attrs.approval_definition_ref != null && !quote.includes(attrs.approval_definition_ref)) {
          review('APPROVAL_DEFINITION_REF_NOT_IN_QUOTE'); return;
        }
      } else if (kind === 'LEGAL_RESTRAINT') {
        corroborated = /(?:order|injunction|law|legal restraint)/i.test(quote)
          && /prohibit|enjoin|restrain|illegal|prevent/i.test(quote);
        concept = 'COND-M-LEGAL';
      } else if (kind === 'GOVERNMENT_PROCEEDING') {
        corroborated = /(?:governmental|regulatory).{0,60}proceeding|proceeding.{0,60}(?:governmental|regulatory)/i.test(quote);
        concept = 'COND-M-LEGAL';
      } else if (kind === 'S4_COMPONENT') {
        const componentPatterns = Object.freeze({
          FORM_EFFECTIVE: /Form S-4.{0,100}(?:declared )?effective/i,
          NO_STOP_ORDER: /stop order.{0,80}(?:not|no |neither|without)|no stop order/i,
          NO_PENDING_OR_THREATENED_PROCEEDING: /proceedings?.{0,80}(?:pending|threatened)|(?:pending|threatened).{0,80}proceedings?/i,
        });
        canonicalValue = attrs.s4_component;
        corroborated = Object.hasOwn(componentPatterns, canonicalValue)
          && componentPatterns[canonicalValue].test(quote) && /Form S-4/i.test(quote);
        concept = 'COND-M-S4';
      } else if (kind === 'LISTING') {
        corroborated = /authori[sz]ed for listing|approved for listing|listed on/i.test(quote);
        concept = 'COND-M-LISTING';
        if (attrs.listing_venue_ref != null && !quote.includes(attrs.listing_venue_ref)) {
          review('LISTING_VENUE_REF_NOT_IN_QUOTE'); return;
        }
      } else if (kind === 'FUNDS') {
        corroborated = /(?:cash|funds).{0,80}(?:equal to|greater than|available)|Equity Investment|financing.{0,50}(?:funded|available)/i.test(quote);
        concept = 'COND-S-FUNDS';
      } else if (kind === 'OFFICER_CERTIFICATE') {
        corroborated = /certificate/i.test(quote) && /certif(?:y|ying|ied)/i.test(quote);
        if (!['TARGET_CERTIFICATE', 'BUYER_CERTIFICATE'].includes(attrs.certificate_side)) {
          review('CERTIFICATE_SIDE_UNCORROBORATED'); return;
        }
        const targetCertificate = /(?:Company|Target).{0,120}certificate|certificate.{0,120}(?:Company|Target)/i.test(quote);
        const buyerCertificate = /(?:Parent|Buyer|PubCo).{0,120}certificate|certificate.{0,120}(?:Parent|Buyer|PubCo)/i.test(quote);
        if ((attrs.certificate_side === 'TARGET_CERTIFICATE' && !targetCertificate)
          || (attrs.certificate_side === 'BUYER_CERTIFICATE' && !buyerCertificate)) {
          review('CERTIFICATE_SIDE_UNCORROBORATED'); return;
        }
        if (!attrs.certifying_party_ref || !quote.includes(attrs.certifying_party_ref)) {
          review('CERTIFYING_PARTY_REF_NOT_IN_QUOTE'); return;
        }
        if (!Array.isArray(attrs.certified_condition_refs)
          || attrs.certified_condition_refs.some((ref) => typeof ref !== 'string' || !quote.includes(ref))) {
          review('CERTIFIED_CONDITION_REF_NOT_IN_QUOTE'); return;
        }
        party = resolveParty({
          attributes: { certifying_party_ref: attrs.certifying_party_ref },
          mapping: { party_field: 'certifying_party_ref', party_role: 'CERTIFYING_PARTY' },
        });
        if (!party) { review('PARTY_UNRESOLVED'); return; }
        partyRole = 'CERTIFYING_PARTY';
        concept = attrs.certificate_side === 'TARGET_CERTIFICATE' ? 'COND-B-CERT' : 'COND-S-CERT';
      } else if (kind === 'FRUSTRATION_CAUSATION') {
        const patterns = Object.freeze({
          CAUSED_BY_BREACH: /caused by.{0,80}breach/i,
          PROXIMATELY_CAUSED: /proximately caused/i,
          PRINCIPALLY_CAUSED: /principally caused/i,
          PRIMARILY_RESULTED: /primarily resulted/i,
        });
        canonicalValue = attrs.causation_standard;
        corroborated = /(?:may|shall) not rely|(?:no|none of the) (?:party|parties).{0,20}may rely|not be entitled to (?:rely|assert)/i.test(quote)
          && Object.hasOwn(patterns, canonicalValue) && patterns[canonicalValue].test(quote);
        concept = 'COND-FRUSTRATE';
      } else if (kind === 'FRUSTRATION_BREACH') {
        const patterns = Object.freeze({
          BREACH: /\bbreach\b/i,
          MATERIAL_BREACH: /material breach/i,
          FAILURE_TO_PERFORM: /failure to (?:perform|comply)/i,
        });
        canonicalValue = attrs.breach_standard;
        corroborated = /(?:may|shall) not rely|(?:no|none of the) (?:party|parties).{0,20}may rely|not be entitled to (?:rely|assert)/i.test(quote)
          && Object.hasOwn(patterns, canonicalValue) && patterns[canonicalValue].test(quote);
        concept = 'COND-FRUSTRATE';
      } else if (kind === 'DOLLAR_THRESHOLD') {
        if (!['FUNDS_MINIMUM', 'REP_INACCURACY_CAP'].includes(attrs.threshold_role)) {
          pushOpenWorld({ entry, claimRow: claim, reason: 'CONDITION_THRESHOLD_ROLE_UNCORROBORATED' }); return;
        }
        const parseResult = parseFeeAmount(quote);
        if (parseResult.outcome !== 'RESOLVED') { review(parseResult.reason); return; }
        canonicalValue = parseResult.canonical_value;
        concept = attrs.threshold_role === 'FUNDS_MINIMUM' ? 'COND-S-FUNDS' : 'COND-B-REP';
        corroborated = attrs.threshold_role === 'FUNDS_MINIMUM'
          ? /(?:cash|funds).{0,80}(?:equal to|greater than|at least)/i.test(quote)
          : /(?:representations|warranties|inaccurac|breach).{0,180}\$/i.test(quote);
      } else {
        corroborated = /burdensome condition/i.test(quote);
        concept = 'COND-M-LEGAL';
        if (attrs.burdensome_scope != null
          && (attrs.burdensome_scope !== 'PARENT_ONLY' || !/Parent/i.test(quote))) {
          review('BURDENSOME_SCOPE_UNCORROBORATED'); return;
        }
      }

      if (!corroborated) { review('CONDITION_KIND_UNCORROBORATED'); return; }
      const mutualConcepts = new Set([
        'COND-M-STOCKHOLDER', 'COND-M-LEGAL', 'COND-M-S4', 'COND-M-LISTING', 'COND-FRUSTRATE',
      ]);
      if (!party && mutualConcepts.has(concept) && kind !== 'BURDENSOME_CONDITION') {
        partyRole = 'CONDITION_BENEFICIARY';
        party = Object.freeze({
          role: partyRole,
          value: 'Either Principal Party',
          capacity: EITHER_PRINCIPAL_PARTY_CAPACITY,
        });
      }
      if (!party && (concept === 'COND-S-FUNDS' || kind === 'BURDENSOME_CONDITION'
        || kind === 'DOLLAR_THRESHOLD')) {
        party = resolveParty({
          attributes: attrs,
          mapping: { party_field: 'condition_obligor', party_role: 'CONDITION_OBLIGOR' },
        });
        if (!party || !quote.includes(attrs.condition_obligor)) { review('PARTY_UNRESOLVED'); return; }
      }
      const claimDefinition = vocabulary.claimDefinitions.get(definition);
      if (!canonicalValueAllowed(claimDefinition, canonicalValue)) {
        pushOpenWorld({ entry, claimRow: claim, reason: 'CONDITION_VALUE_OUT_OF_VOCABULARY' }); return;
      }
      finalizeTerminationClaim({
        entry, claim, provenance, genericKey: CLOSING_CONDITION_CLAIM_KEY,
        registeredClaimDefinitionKey: definition, conceptKey: concept, party, canonicalValue,
        partyRole,
        extraAttributes: {
          assertion_kind: kind, ...attrs,
          answer_provenance: buildMechanicalAnswerProvenance({ extraPins: { gate: 'CORPUS_SHAPE_CORROBORATION' } }),
        },
      });
      return;
    }

    const matchedKinds = new Set();
    if (/representations and warranties/i.test(quote) && /true and correct/i.test(quote)) matchedKinds.add('BRING_DOWN_TIER');
    if (/shall not have occurred/i.test(quote) && /\bMaterial Adverse Effect\b/.test(quote)) matchedKinds.add('NO_MAE_CONDITION');
    if (matchedKinds.has('NO_MAE_CONDITION') && /is continuing/i.test(quote)) matchedKinds.add('MAE_CONTINUING');
    if (/performed( or complied)?/i.test(quote) && /in all material respects/i.test(quote)) matchedKinds.add('COVENANT_COMPLIANCE');
    if (/\bHSR Act\b|waiting period|jurisdictions set forth in/i.test(quote)) matchedKinds.add('REGULATORY_APPROVAL');
    const onlyPermittedSubsumption = kind === 'MAE_CONTINUING'
      && matchedKinds.size === 2 && matchedKinds.has('NO_MAE_CONDITION');
    if (!matchedKinds.has(kind)) { review('CONDITION_KIND_UNCORROBORATED'); return; }
    if (matchedKinds.size > 1 && !onlyPermittedSubsumption) { review('AMBIGUOUS_CONDITION_KIND'); return; }

    const definitionByKind = Object.freeze({
      BRING_DOWN_TIER: 'REPRESENTATION_ACCURACY_STANDARD',
      NO_MAE_CONDITION: 'NO_MAE_CONDITION',
      MAE_CONTINUING: 'NO_MAE_CONDITION_CONTINUING',
      COVENANT_COMPLIANCE: 'COVENANT_COMPLIANCE_STANDARD',
      REGULATORY_APPROVAL: 'REGULATORY_APPROVAL_CONDITION',
    });
    const definition = definitionByKind[kind];
    let concept;
    let party = null;

    if (kind === 'BRING_DOWN_TIER') {
      const target = /of the Company(?!\s+Merger\s+Sub)( Entities)?\b/.test(quote);
      const buyer = /representations and warranties (made by|of) Parent\b/.test(quote);
      if ((attrs.rep_side !== 'TARGET_REPS' && attrs.rep_side !== 'BUYER_REPS') || (target === buyer)) {
        review(target && buyer ? 'AMBIGUOUS_REP_SIDE' : 'REP_SIDE_UNCORROBORATED'); return;
      }
      if ((attrs.rep_side === 'TARGET_REPS') !== target) { review('REP_SIDE_UNCORROBORATED'); return; }
      if (!attrs.covered_scope_ref || !quote.includes(attrs.covered_scope_ref)) { review('COVERED_SCOPE_REF_NOT_IN_QUOTE'); return; }
      if (attrs.scrape_quote != null && !quote.includes(attrs.scrape_quote)) { review('SCRAPE_QUOTE_NOT_IN_QUOTE'); return; }
      party = resolveParty({ attributes: attrs, mapping: { party_field: 'condition_obligor', party_role: 'CONDITION_OBLIGOR' } });
      if (!party) { review('PARTY_UNRESOLVED'); return; }
      concept = attrs.rep_side === 'TARGET_REPS' ? 'COND-B-REP' : 'COND-S-REP';
    } else if (kind === 'NO_MAE_CONDITION' || kind === 'MAE_CONTINUING') {
      if (!attrs.mae_term_ref || !quote.includes(attrs.mae_term_ref)) { review('MAE_TERM_REF_NOT_IN_QUOTE'); return; }
      if (attrs.mae_party === 'BUYER') { review('MAE_PARTY_UNCORROBORATED'); return; }
      if (attrs.mae_party !== 'TARGET' || !/\bCompany Material Adverse Effect\b/.test(quote)) { review('MAE_PARTY_UNCORROBORATED'); return; }
      concept = 'COND-MAE';
    } else if (kind === 'COVENANT_COMPLIANCE') {
      if (!attrs.obligor_ref || !quote.includes(attrs.obligor_ref)) { review('OBLIGOR_REF_UNCORROBORATED'); return; }
      const escaped = attrs.obligor_ref.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      if (!(new RegExp(`\\b(?:each of )?${escaped} shall have performed`, 'i')).test(quote)) { review('OBLIGOR_REF_UNCORROBORATED'); return; }
      party = resolveParty({ attributes: { condition_obligor: attrs.obligor_ref }, mapping: { party_field: 'condition_obligor', party_role: 'CONDITION_OBLIGOR' } });
      if (!party) { review('PARTY_UNRESOLVED'); return; }
      concept = 'COND-COV';
    } else {
      const hsr = /\bHSR Act\b/.test(quote);
      const scheduled = /jurisdictions set forth in Section/.test(quote);
      if ((hsr && scheduled) || !attrs.approval_kind || (attrs.approval_kind === 'HSR' && !hsr) || (attrs.approval_kind === 'SCHEDULED_APPROVALS' && !scheduled)) {
        review(hsr && scheduled ? 'AMBIGUOUS_APPROVAL_KIND' : 'APPROVAL_KIND_UNCORROBORATED'); return;
      }
      if (!['HSR', 'SCHEDULED_APPROVALS'].includes(attrs.approval_kind)) { pushOpenWorld({ entry, claimRow: claim, reason: 'APPROVAL_KIND_UNCORROBORATED' }); return; }
      concept = 'COND-REG';
    }

    if (!party && concept === 'COND-MAE' && /\bCompany\b/.test(quote)) {
      party = Object.freeze({ role: 'CONDITION_OBLIGOR', value: 'Company', capacity: 'TARGET' });
    }
    if (!party && concept === 'COND-REG') {
      party = Object.freeze({
        role: 'CONDITION_BENEFICIARY', value: 'Either Principal Party',
        capacity: EITHER_PRINCIPAL_PARTY_CAPACITY,
      });
    }
    if (!party) { review('PARTY_UNRESOLVED'); return; }

    const canonicalValue = kind === 'BRING_DOWN_TIER' ? attrs.accuracy_standard
      : kind === 'COVENANT_COMPLIANCE' ? attrs.standard : true;
    const claimDefinition = vocabulary.claimDefinitions.get(definition);
    if (!canonicalValueAllowed(claimDefinition, canonicalValue)) {
      pushOpenWorld({ entry, claimRow: claim, reason: kind === 'COVENANT_COMPLIANCE' ? 'COVENANT_STANDARD_OUT_OF_VOCABULARY' : 'ACCURACY_STANDARD_OUT_OF_VOCABULARY' });
      return;
    }
    finalizeTerminationClaim({
      entry, claim, provenance, genericKey: CLOSING_CONDITION_CLAIM_KEY,
      registeredClaimDefinitionKey: definition, conceptKey: concept, party, canonicalValue,
      partyRole: 'CONDITION_OBLIGOR',
      extraAttributes: { assertion_kind: kind, ...attrs, answer_provenance: buildMechanicalAnswerProvenance({ extraPins: { gate: 'ALLOWED_VALUES_MEMBERSHIP' } }) },
    });
  }


  function handleIocRestrictionCandidate(entry) {
    const { candidate } = entry;
    const claim = candidate.claim;
    const attrs = claim.attributes || {};
    const category = attrs.restriction_category;
    const kind = attrs.assertion_kind;
    if (!IOC_ASSERTION_KINDS.includes(kind)) {
      pushOpenWorld({ entry, claimRow: claim, reason: 'IOC_ASSERTION_KIND_UNADJUDICATED' });
      return;
    }
    if (!Object.hasOwn(RESTRICTION_CATEGORY_TO_CONCEPT, category)) {
      pushOpenWorld({ entry, claimRow: claim, reason: 'RESTRICTION_CATEGORY_OUT_OF_ENUM' });
      return;
    }
    const categoryResult = corroborateRestrictionCategory({ quote: claim.raw_value, asserted_category: category });
    if (categoryResult.outcome !== 'RESOLVED') {
      pushReviewUnresolved({ entry, claimRow: claim, mapping: null, conceptFamily: 'IOC-PENDING', reasons: [categoryResult.reason], materiality: materialityFor({ conceptKey: 'IOC-' }), normalisedPhrase: normaliseForMatching(claim.raw_value), attachmentPosition: null });
      return;
    }
    const registeredClaimDefinitionKey = 'IOC_RESTRICTION_PRESENT';
    const claimDefinition = vocabulary.claimDefinitions.get(registeredClaimDefinitionKey);
    if (!claimDefinition) {
      residuals.push(Object.freeze({
        residual_type: 'VOCABULARY_MISSING_MAPPED_CLAIM_DEFINITION',
        section_reference: entry.section_reference,
        generic_claim_key: IOC_RESTRICTION_CLAIM_KEY,
        mapped_claim_definition_key: registeredClaimDefinitionKey,
      }));
      return;
    }
    if (!vocabulary.concepts.has(categoryResult.concept_key)) {
      residuals.push(Object.freeze({
        residual_type: 'VOCABULARY_MISSING_MAPPED_CONCEPT',
        section_reference: entry.section_reference,
        generic_claim_key: IOC_RESTRICTION_CLAIM_KEY,
        concept_key: categoryResult.concept_key,
      }));
      return;
    }
    const section = sectionsByReference.get(entry.section_reference);
    if (!section) {
      residuals.push(Object.freeze({ residual_type: 'SECTION_REFERENCE_UNRESOLVED_IN_RECEIPT', section_reference: entry.section_reference }));
      return;
    }
    const materiality = materialityFor({ conceptKey: categoryResult.concept_key, claimDefinitionKey: registeredClaimDefinitionKey });
    const restrictionSpan = findUniqueIocRestrictionSpan({ section, quote: claim.raw_value, admittedSourceContext });
    if (!restrictionSpan) {
      pushReviewUnresolved({ entry, claimRow: claim, mapping: null, conceptFamily: categoryResult.concept_key, reasons: ['IOC_RESTRICTION_COMPONENT_SPAN_AMBIGUOUS'], materiality, normalisedPhrase: normaliseForMatching(claim.raw_value), attachmentPosition: null });
      return;
    }
    const chapeau = findIocChapeau({ section, admittedSourceContext, beforeAbsoluteStart: restrictionSpan.absolute_start });
    if (!chapeau) {
      pushReviewUnresolved({ entry, claimRow: claim, mapping: null, conceptFamily: categoryResult.concept_key, reasons: ['IOC_PARENT_CHAPEAU_PARTY_UNRESOLVED'], materiality, normalisedPhrase: normaliseForMatching(claim.raw_value), attachmentPosition: null });
      return;
    }
    const groupKey = groupKeyFor({ sectionReference: entry.section_reference, conceptKey: categoryResult.concept_key, party: chapeau.party });
    let provision = provisionsByGroupKey.get(groupKey);
    if (!provision) {
      provision = mintProvision({ section, conceptKey: categoryResult.concept_key, party: chapeau.party, ordinal: provisionsByGroupKey.size + 1, admittedSourceContext, contractVocabulary });
      provisionsByGroupKey.set(groupKey, provision);
    }
    const componentKey = `${provision.provision_instance_id}:${restrictionSpan.absolute_start}:${restrictionSpan.absolute_end}`;
    let component = iocRestrictionComponentsByKey.get(componentKey);
    if (!component) {
      const orderedSpans = runReceipt.compiled_candidates
        .filter((candidateEntry) => candidateEntry?.ok === true
          && candidateEntry.section_reference === entry.section_reference
          && candidateEntry.candidate?.kind === 'claim'
          && candidateEntry.candidate.claim.claim_definition_key === IOC_RESTRICTION_CLAIM_KEY
          && candidateEntry.candidate.claim.attributes?.restriction_category === category)
        .map((candidateEntry) => findUniqueIocRestrictionSpan({ section, quote: candidateEntry.candidate.claim.raw_value, admittedSourceContext }))
        .filter(Boolean)
        .sort((left, right) => left.absolute_start - right.absolute_start || left.absolute_end - right.absolute_end);
      const componentOrdinal = orderedSpans.findIndex((span) => span.absolute_start === restrictionSpan.absolute_start && span.absolute_end === restrictionSpan.absolute_end) + 1;
      if (componentOrdinal === 0) {
        pushReviewUnresolved({ entry, claimRow: claim, mapping: null, conceptFamily: categoryResult.concept_key, reasons: ['IOC_RESTRICTION_COMPONENT_ORDINAL_UNRESOLVED'], materiality, normalisedPhrase: normaliseForMatching(claim.raw_value), attachmentPosition: null });
        return;
      }
      const builtComponent = buildProvisionComponent({ source: admittedSourceContext, parentProvision: provision, span: restrictionSpan, componentKey: IOC_RESTRICTION_COMPONENT_KEY, ordinal: componentOrdinal, contractBundle: contractVocabulary });
      component = Object.freeze({ ...builtComponent, closure_id: contentId(IOC_RESTRICTION_COMPONENT_CLOSURE_DOMAIN, { provision_component_id: builtComponent.provision_component_id }) });
      iocRestrictionComponentsByKey.set(componentKey, component);
      iocRestrictionComponents.push(component);
    }
    const mapping = Object.freeze({
      generic_claim_key: IOC_RESTRICTION_CLAIM_KEY,
      deterministic_kind: kind,
      attachment_position: null,
      registered_claim_definition_key: registeredClaimDefinitionKey,
      concept_key: categoryResult.concept_key,
      party_field: null,
      party_role: IOC_PARENT_PARTY_ROLE,
    });
    const claimGroupKey = `${component.provision_component_id}::${registeredClaimDefinitionKey}`;
    const claimOrdinal = claimOrdinalCounters.get(claimGroupKey) || 0;
    claimOrdinalCounters.set(claimGroupKey, claimOrdinal + 1);
    const rebuiltClaim = rebuildClaim({
      originalClaim: claim,
      newSubjectOccurrenceId: component.provision_component_id,
      newClaimDefinitionKey: registeredClaimDefinitionKey,
      newOrdinal: claimOrdinal,
      newCanonicalValue: true,
      attributesExtra: { inherited_party_from_provision_instance_id: provision.provision_instance_id, answer_provenance: buildMechanicalAnswerProvenance({}) },
    });
    const defectScope = Object.freeze({ deal: dealKey, family: categoryResult.concept_key, attribute: registeredClaimDefinitionKey, extraction_mechanism: candidate.extraction_provenance.extractor_id });
    finalizeResolvedCandidate({
      entry,
      provenance: candidate.extraction_provenance,
      genericKey: IOC_RESTRICTION_CLAIM_KEY,
      mapping,
      party: chapeau.party,
      provision,
      rebuiltClaim,
      claimDefinition,
      defectMatch: matchesKnownDefect(knownDefectRegistry, defectScope),
      materiality,
      partySourceSpan: chapeau.span,
    });
  }

  function pushProxyMeetingReview({ entry, claim, reason, conceptFamily = 'COV-MEETING' }) {
    pushReviewUnresolved({
      entry,
      claimRow: claim,
      mapping: null,
      conceptFamily,
      reasons: [reason],
      materiality: materialityFor({ conceptKey: conceptFamily }),
      normalisedPhrase: normaliseForMatching(claim.raw_value),
      attachmentPosition: null,
    });
  }

  function finalizeProxyMeetingClaim({
    entry, claim, provenance, assertionKind, mapping, party, canonicalValue, extraAttributes,
    partyField = 'control_party', partyRole = 'MEETING_ADJOURNMENT_CONTROLLER',
  }) {
    const claimDefinition = vocabulary.claimDefinitions.get(mapping.claim_definition_key);
    if (!claimDefinition) {
      residuals.push(Object.freeze({
        residual_type: 'VOCABULARY_MISSING_MAPPED_CLAIM_DEFINITION',
        section_reference: entry.section_reference,
        generic_claim_key: PROXY_MEETING_COVENANT_CLAIM_KEY,
        mapped_claim_definition_key: mapping.claim_definition_key,
      }));
      return;
    }
    if (!vocabulary.concepts.has(mapping.concept_key)) {
      residuals.push(Object.freeze({
        residual_type: 'VOCABULARY_MISSING_MAPPED_CONCEPT',
        section_reference: entry.section_reference,
        generic_claim_key: PROXY_MEETING_COVENANT_CLAIM_KEY,
        concept_key: mapping.concept_key,
      }));
      return;
    }
    const section = sectionsByReference.get(entry.section_reference);
    if (!section) {
      residuals.push(Object.freeze({
        residual_type: 'SECTION_REFERENCE_UNRESOLVED_IN_RECEIPT',
        section_reference: entry.section_reference,
      }));
      return;
    }
    const groupKey = party
      ? groupKeyFor({ sectionReference: entry.section_reference, conceptKey: mapping.concept_key, party })
      : structuralGroupKeyFor({ sectionReference: entry.section_reference, conceptKey: mapping.concept_key });
    let provision = provisionsByGroupKey.get(groupKey);
    if (!provision) {
      provision = party
        ? mintProvision({
          section,
          conceptKey: mapping.concept_key,
          party,
          ordinal: provisionsByGroupKey.size + 1,
          admittedSourceContext,
          contractVocabulary,
        })
        : mintStructuralProvision({
          section,
          conceptKey: mapping.concept_key,
          ordinal: 1,
          admittedSourceContext,
          contractVocabulary,
        });
      provisionsByGroupKey.set(groupKey, provision);
    }
    const claimGroupKey = `${provision.provision_instance_id}::${mapping.claim_definition_key}`;
    const claimOrdinal = claimOrdinalCounters.get(claimGroupKey) || 0;
    claimOrdinalCounters.set(claimGroupKey, claimOrdinal + 1);
    const rebuiltClaim = rebuildClaim({
      originalClaim: claim,
      newSubjectOccurrenceId: provision.provision_instance_id,
      newClaimDefinitionKey: mapping.claim_definition_key,
      newOrdinal: claimOrdinal,
      newCanonicalValue: canonicalValue,
      attributesExtra: {
        ...extraAttributes,
        assertion_kind: assertionKind,
        proxy_meeting_parse_version: PROXY_MEETING_PARSE_VERSION,
        answer_provenance: buildMechanicalAnswerProvenance({}),
      },
    });
    const resolverMapping = Object.freeze({
      generic_claim_key: PROXY_MEETING_COVENANT_CLAIM_KEY,
      deterministic_kind: assertionKind,
      attachment_position: null,
      registered_claim_definition_key: mapping.claim_definition_key,
      concept_key: mapping.concept_key,
      party_field: partyField,
      party_role: partyRole,
    });
    const materiality = materialityFor({
      conceptKey: mapping.concept_key,
      canonicalValue,
      claimDefinitionKey: mapping.claim_definition_key,
    });
    const defectMatch = matchesKnownDefect(knownDefectRegistry, Object.freeze({
      deal: dealKey,
      family: mapping.concept_key,
      attribute: mapping.claim_definition_key,
      extraction_mechanism: provenance.extractor_id,
    }));
    finalizeResolvedCandidate({
      entry,
      provenance,
      genericKey: PROXY_MEETING_COVENANT_CLAIM_KEY,
      mapping: resolverMapping,
      party,
      provision,
      rebuiltClaim,
      claimDefinition,
      defectMatch,
      materiality,
    });
  }

  function handleProxyMeetingCandidate(entry) {
    const { candidate } = entry;
    const claim = candidate.claim;
    const provenance = candidate.extraction_provenance;
    const attrs = claim.attributes || {};
    const quote = typeof claim.raw_value === 'string' ? claim.raw_value : '';
    const assertionKind = typeof attrs.assertion_kind === 'string' ? attrs.assertion_kind : null;

    if (!assertionKind || !PROXY_MEETING_ASSERTION_KINDS.includes(assertionKind)) {
      pushOpenWorld({ entry, claimRow: claim, reason: 'ASSERTION_KIND_OUT_OF_ENUM' });
      return;
    }
    const mapping = PROXY_MEETING_ASSERTION_MAP[assertionKind];
    if (!mapping) {
      pushOpenWorld({ entry, claimRow: claim, reason: 'PROXY_MEETING_ASSERTION_KIND_NOT_GOVERNED' });
      return;
    }

    const corroboratedKinds = proxyMeetingCorroboratedKinds(quote);
    const compatibleSet = (
      corroboratedKinds.every((kind) => ['MEETING_DEADLINE', 'CONVENE_OBLIGATION'].includes(kind))
      || corroboratedKinds.every((kind) => ['RECORD_DATE_ESTABLISHMENT', 'BROKER_SEARCH_OBLIGATION'].includes(kind))
      || corroboratedKinds.every((kind) => [
        'ADJOURNMENT_COUNT_CAP', 'ADJOURNMENT_DURATION_CAP', 'ADJOURNMENT_REASON',
      ].includes(kind))
    );
    if (!corroboratedKinds.includes(assertionKind)) {
      pushProxyMeetingReview({ entry, claim, reason: 'PROXY_MEETING_KIND_UNCORROBORATED', conceptFamily: mapping.concept_key });
      return;
    }
    if (corroboratedKinds.length > 1 && !compatibleSet) {
      pushProxyMeetingReview({ entry, claim, reason: 'AMBIGUOUS_PROXY_MEETING_KIND', conceptFamily: mapping.concept_key });
      return;
    }

    const approvalKind = assertionKind === 'PARENT_APPROVAL' || assertionKind === 'MERGER_SUB_APPROVAL';
    const refField = approvalKind
      ? null
      : assertionKind === 'FILING_DEADLINE' || assertionKind === 'RECOMMENDATION_INCLUSION'
        ? 'document_ref'
        : 'meeting_ref';
    const refValue = refField && typeof attrs[refField] === 'string' && attrs[refField].length > 0
      ? attrs[refField]
      : null;
    if (refField && (!refValue || !quote.includes(refValue))) {
      pushProxyMeetingReview({
        entry,
        claim,
        reason: `${refField.toUpperCase()}_NOT_IN_QUOTE`,
        conceptFamily: mapping.concept_key,
      });
      return;
    }

    let party = null;
    if (assertionKind === 'ADJOURNMENT_COUNT_CAP' || assertionKind === 'ADJOURNMENT_DURATION_CAP') {
      const controlParty = typeof attrs.control_party === 'string' && attrs.control_party.length > 0 ? attrs.control_party : null;
      if (!controlParty || !quote.includes(controlParty)) {
        pushProxyMeetingReview({ entry, claim, reason: 'CONTROL_PARTY_REF_NOT_IN_QUOTE', conceptFamily: mapping.concept_key });
        return;
      }
      party = resolveParty({
        attributes: attrs,
        mapping: {
          party_field: 'control_party',
          party_role: 'MEETING_ADJOURNMENT_CONTROLLER',
        },
      });
      if (!party) {
        pushProxyMeetingReview({ entry, claim, reason: 'PARTY_UNRESOLVED', conceptFamily: mapping.concept_key });
        return;
      }
      if (!proxyMeetingControlPartyPositionCorroborated(quote, controlParty)) {
        pushProxyMeetingReview({ entry, claim, reason: 'CONTROL_PARTY_REF_UNCORROBORATED', conceptFamily: mapping.concept_key });
        return;
      }
    }

    if (approvalKind) {
      const obligatedParty = typeof attrs.obligated_party === 'string' && attrs.obligated_party.length > 0
        ? attrs.obligated_party
        : null;
      if (!obligatedParty || !quote.includes(obligatedParty)) {
        pushProxyMeetingReview({ entry, claim, reason: 'OBLIGATED_PARTY_REF_NOT_IN_QUOTE', conceptFamily: mapping.concept_key });
        return;
      }
      party = resolveParty({
        attributes: attrs,
        mapping: { party_field: 'obligated_party', party_role: 'APPROVAL_OBLIGOR' },
      });
      if (!party) {
        pushProxyMeetingReview({ entry, claim, reason: 'PARTY_UNRESOLVED', conceptFamily: mapping.concept_key });
        return;
      }
      const mechanism = attrs.adoption_mechanism;
      if (!Object.hasOwn(APPROVAL_MECHANISM_PATTERNS, mechanism)
        || !APPROVAL_MECHANISM_PATTERNS[mechanism].test(quote)) {
        pushProxyMeetingReview({ entry, claim, reason: 'APPROVAL_MECHANISM_UNCORROBORATED', conceptFamily: mapping.concept_key });
        return;
      }
      const timing = typeof attrs.adoption_timing === 'string' && attrs.adoption_timing.length > 0
        ? attrs.adoption_timing
        : null;
      if (timing && !quote.includes(timing)) {
        pushProxyMeetingReview({ entry, claim, reason: 'APPROVAL_TIMING_NOT_IN_QUOTE', conceptFamily: mapping.concept_key });
        return;
      }
      finalizeProxyMeetingClaim({
        entry,
        claim,
        provenance,
        assertionKind,
        mapping,
        party,
        canonicalValue: true,
        partyField: 'obligated_party',
        partyRole: 'APPROVAL_OBLIGOR',
        extraAttributes: {
          approval_mechanism: mechanism,
          approval_timing: timing,
          obligated_party_ref: obligatedParty,
        },
      });
      return;
    }

    if (assertionKind === 'RECORD_DATE_ESTABLISHMENT' || assertionKind === 'BROKER_SEARCH_OBLIGATION') {
      finalizeProxyMeetingClaim({
        entry,
        claim,
        provenance,
        assertionKind,
        mapping,
        party,
        canonicalValue: true,
        extraAttributes: { meeting_ref: refValue },
      });
      return;
    }

    if (assertionKind === 'ADJOURNMENT_REASON') {
      const reasonKind = attrs.reason_kind;
      if (!Object.hasOwn(ADJOURNMENT_REASON_PATTERNS, reasonKind)
        || !ADJOURNMENT_REASON_PATTERNS[reasonKind].test(quote)) {
        pushProxyMeetingReview({
          entry,
          claim,
          reason: 'ADJOURNMENT_REASON_NOT_DIRECTLY_GROUNDED',
          conceptFamily: mapping.concept_key,
        });
        return;
      }
      finalizeProxyMeetingClaim({
        entry,
        claim,
        provenance,
        assertionKind,
        mapping,
        party,
        canonicalValue: reasonKind,
        extraAttributes: { meeting_ref: refValue, reason_kind: reasonKind },
      });
      return;
    }

    if (assertionKind === 'RECOMMENDATION_INCLUSION' || assertionKind === 'CONVENE_OBLIGATION') {
      finalizeProxyMeetingClaim({
        entry,
        claim,
        provenance,
        assertionKind,
        mapping,
        party,
        canonicalValue: true,
        extraAttributes: { [refField]: refValue },
      });
      return;
    }

    const parser = assertionKind === 'ADJOURNMENT_COUNT_CAP' ? parseAdjournmentCount : parseProxyMeetingDayCount;
    const parsed = parser(quote);
    if (parsed.outcome !== 'RESOLVED') {
      pushProxyMeetingReview({ entry, claim, reason: parsed.reason, conceptFamily: mapping.concept_key });
      return;
    }

    const extraAttributes = { [refField]: refValue };
    if (assertionKind !== 'ADJOURNMENT_COUNT_CAP') {
      const dayKind = attrs.day_kind;
      const hasBusinessDays = /business\s+days?/i.test(parsed.matched_text);
      if (!['BUSINESS', 'CALENDAR'].includes(dayKind)
        || (dayKind === 'BUSINESS' && !hasBusinessDays)
        || (dayKind === 'CALENDAR' && hasBusinessDays)) {
        pushProxyMeetingReview({ entry, claim, reason: 'DAY_KIND_UNCORROBORATED', conceptFamily: mapping.concept_key });
        return;
      }
      extraAttributes.day_kind = dayKind;
    }
    if (assertionKind === 'FILING_DEADLINE' || assertionKind === 'MEETING_DEADLINE') {
      const allowedAnchors = assertionKind === 'FILING_DEADLINE' ? ['AGREEMENT_DATE'] : ['MAILING', 'SEC_CLEARANCE'];
      const anchorKind = attrs.anchor_kind;
      if (!allowedAnchors.includes(anchorKind)) {
        pushOpenWorld({ entry, claimRow: claim, reason: 'ANCHOR_KIND_OUT_OF_GOVERNED_ENUM' });
        return;
      }
      const anchorCorroborated = anchorKind === 'AGREEMENT_DATE'
        ? /\b(?:date of this Agreement|Agreement Date|execution of this Agreement|signing)\b/i.test(quote)
        : anchorKind === 'MAILING'
          ? /\b(?:initial\s+)?mailing\b/i.test(quote)
          : /\bSEC\b[\s\S]{0,100}\b(?:no\s+further\s+comments?|clearance|cleared)\b/i.test(quote);
      if (!anchorCorroborated) {
        pushProxyMeetingReview({ entry, claim, reason: 'ANCHOR_KIND_UNCORROBORATED', conceptFamily: mapping.concept_key });
        return;
      }
      extraAttributes.anchor_kind = anchorKind;
    }
    if (assertionKind === 'ADJOURNMENT_DURATION_CAP') {
      const limitBasis = attrs.limit_basis;
      const aggregate = /\b(?:aggregate|in\s+total|total\s+of)\b/i.test(quote);
      const perOccasion = /\b(?:each\s+(?:such\s+)?occasion|per\s+(?:occasion|adjournment)|each\s+adjournment)\b/i.test(quote);
      if (!['AGGREGATE', 'PER_OCCASION'].includes(limitBasis)
        || (limitBasis === 'AGGREGATE' && !aggregate)
        || (limitBasis === 'PER_OCCASION' && !perOccasion)) {
        pushProxyMeetingReview({ entry, claim, reason: 'LIMIT_BASIS_UNCORROBORATED', conceptFamily: mapping.concept_key });
        return;
      }
      extraAttributes.limit_basis = limitBasis;
      extraAttributes.control_party_ref = attrs.control_party;
    }
    if (assertionKind === 'ADJOURNMENT_COUNT_CAP') {
      extraAttributes.control_party_ref = attrs.control_party;
    }
    finalizeProxyMeetingClaim({
      entry,
      claim,
      provenance,
      assertionKind,
      mapping,
      party,
      canonicalValue: parsed.canonical_value,
      extraAttributes,
    });
  }

  for (const entry of runReceipt.compiled_candidates) {
    if (!entry || entry.ok !== true || entry.candidate?.kind !== 'claim') continue;
    if (entry.candidate.extraction_provenance?.proposal_kind === 'OPEN_WORLD') continue;
    const claim = entry.candidate.claim;
    if (claim?.claim_definition_key !== QUALIFIER_CLAIM_KEY || typeof claim.raw_value !== 'string' || claim.raw_value.length === 0) continue;
    const detected = parseMeasurementDate({ quote: claim.raw_value, agreement_date: agreementDate });
    if (detected.outcome !== 'RESOLVED' || !detected.defined_term) continue;
    if (conflictedDefinedDates.has(detected.defined_term)) continue;
    const prior = definedDates[detected.defined_term];
    if (prior === undefined) {
      definedDates[detected.defined_term] = detected.iso_date;
    } else if (prior !== detected.iso_date) {
      delete definedDates[detected.defined_term];
      conflictedDefinedDates.add(detected.defined_term);
    }
  }

  function parseDefinedMeasurementDate(quote) {
    if (conflictedDefinedDates.has('Capitalization Date') && /\bthe\s+Capitalization\s+Date\b/i.test(quote)) {
      return Object.freeze({ outcome: 'ABSTAIN', reason: 'DEFINED_DATE_CONFLICT' });
    }
    return parseMeasurementDate({ quote, agreement_date: agreementDate, defined_dates: definedDates });
  }

  function pushOpenWorld({ entry, claimRow, reason }) {
    openWorld.push(Object.freeze({
      section_reference: entry.section_reference,
      reason,
      claim_definition_key: claimRow.claim_definition_key,
      raw_value: claimRow.raw_value,
      canonical_value: claimRow.canonical_value,
      attributes: claimRow.attributes,
      evidence: claimRow.evidence,
      closure_id: claimRow.closure_id,
      extraction_provenance: entry.candidate.extraction_provenance,
      // Never dropped: an open-world candidate whose citation was not
      // validated stays visibly flagged here too, not just for the
      // (rarer) proposals that reach a registered claim definition below.
      citation_validation: entry.citation_validation || null,
      // Spec section 5 work item 2: a producer-originated raw value carried
      // into open world (this is every open-world entry -- no model call
      // this module makes ever mints one of these) is AI-tagged, never
      // MECHANICAL -- code did not decide this value, the model proposed it
      // and no registered mapping accepted it.
      answer_provenance: buildAiAnswerProvenance({ extractionProvenance: entry.candidate.extraction_provenance }),
      // Section-family classification provenance, carried through the same
      // way citation_validation is -- null for every section that was not
      // AI-classified (see sectionFamilyUnverifiedReason above).
      section_family_ai_unverified: sectionFamilyUnverifiedReason(entry.section_reference),
    }));
  }

  // Review-queue items now always carry the ruling-corpus KEY fields
  // (normalised_phrase, attachment_position, concept_family -- spec section
  // 4/Task 8 integration note: the corpus and dry-run tooling need them),
  // whether or not the item ever reached a registered mapping.
  function pushReviewUnresolved({
    entry, claimRow, mapping, conceptFamily, reasons, materiality, normalisedPhrase, attachmentPosition,
  }) {
    // Section-family provenance travels into the review-queue item's own
    // `reasons`, same as every other typed blocking condition here -- see
    // sectionFamilyUnverifiedReason above.
    const sectionFamilyReason = sectionFamilyUnverifiedReason(entry.section_reference);
    const augmentedReasons = sectionFamilyReason && !reasons.includes(sectionFamilyReason)
      ? [...reasons, sectionFamilyReason]
      : reasons;
    reviewQueue.push(Object.freeze({
      section_reference: entry.section_reference,
      generic_claim_key: claimRow.claim_definition_key,
      resolved_claim_definition_key: mapping ? mapping.registered_claim_definition_key : null,
      concept_key: mapping ? mapping.concept_key : conceptFamily,
      reasons: Object.freeze(augmentedReasons),
      materiality_rank: materiality.rank,
      materiality_label: materiality.label,
      auto_pass: false,
      has_resolution: false,
      raw_value: claimRow.raw_value,
      canonical_value: claimRow.canonical_value,
      original_claim_occurrence_id: claimRow.claim_occurrence_id,
      closure_id: claimRow.closure_id,
      normalised_phrase: normalisedPhrase,
      attachment_position: attachmentPosition,
      concept_family: conceptFamily,
    }));
  }

  // Shared by both the bring-down-tier path (unconditional mapping,
  // unaffected by the Task 3 rekey) and every resolved qualifier part: the
  // M3-subset deterministic gates, auto-pass computation (still
  // unconditionally blocked pending the v1/v2 comparator and lexical net --
  // see the block comment inside), and the resolved/review-queue push.
  function finalizeResolvedCandidate({
    entry, provenance, genericKey, mapping, party, provision, rebuiltClaim, claimDefinition, defectMatch, materiality,
    subjectReasons = [],
    partySourceSpan = null,
    // MAE_DEFINITION_SELF_CONTAINMENT_UNPROVEN (family-mae-definition
    // slice, spec Deliverable's "family-defining honesty pin" -- the M3
    // review protocol never auto-passes a nested/cross-referenced
    // definition, and detection of nesting is legal judgment, not
    // mechanics). Every DEF-MAE claim carries this PERMANENT entry
    // alongside the three pre-existing ones -- mechanism identical to
    // SOURCE_SCOPE_CERTIFICATION_ABSENT above, reused exactly. Only the
    // three MAE handlers below ever pass a non-empty array here.
    extraUnevaluatedConditions = [],
  }) {
    const canonicalValueOk = rebuiltClaim.state !== 'PRESENT'
      || canonicalValueAllowed(claimDefinition, rebuiltClaim.canonical_value);
    const multiSpan = rebuiltClaim.evidence.length > 1;
    const nestedOrCrossReferenced = rebuiltClaim.evidence.some((edge) => edge.evidence_role !== 'OPERATIVE_TEXT');
    const unresolvedResidual = rebuiltClaim.publication_state === 'QUARANTINED';
    const failedOrUncertain = rebuiltClaim.state !== 'PRESENT';
    const citationValidation = entry.citation_validation || null;
    const citationNotValidated = citationValidation != null && citationValidation.accepted !== true;
    // Citation guard (spec's "Citation guard" section, audit amendment 5):
    // a citation accepted ONLY by document-text corroboration (no tree
    // construction) is never confused with a genuinely absent/failed
    // citation -- it compiles, resolves and publishes with the fact
    // visible, but must never auto-pass. It is deliberately excluded from
    // `gateFailureReasons`/`deterministicGatesPassed` below: it is not a
    // structural defect the way MULTI_SPAN_COMPOSED etc. are, so it must
    // not, by itself, force review-queue routing the way those do -- see
    // the module's Task 3 integration note in the file header.
    const citationCorroboratedOnly = citationValidation != null
      && citationValidation.accepted === true
      && citationValidation.validation_source === 'CORROBORATED_BY_DOCUMENT_TEXT';

    const reasons = [];
    if (!canonicalValueOk) reasons.push('UNREGISTERED_CANONICAL_VALUE');
    if (multiSpan) reasons.push('MULTI_SPAN_COMPOSED');
    if (nestedOrCrossReferenced) reasons.push('NESTED_OR_CROSS_REFERENCED_EVIDENCE');
    if (unresolvedResidual) reasons.push('UNRESOLVED_RESIDUAL');
    if (failedOrUncertain) reasons.push('FAILED_OR_UNCERTAIN_EXTRACTION');
    if (defectMatch) reasons.push('KNOWN_DEFECT_MATCH');
    if (citationNotValidated) reasons.push('CITATION_NOT_VALIDATED');
    if (citationCorroboratedOnly) reasons.push('CITATION_CORROBORATED_ONLY');
    // SECTION_FAMILY_AI_UNVERIFIED (spec section 3, BEN RULING 2026-08-02):
    // an AI-classified section's claims can never auto-pass while the
    // classification itself is unverified. Participates in
    // gateFailureReasons like CITATION_NOT_VALIDATED (never filtered out
    // the way CITATION_CORROBORATED_ONLY is) -- it is a genuine block, not
    // an informational flag.
    const sectionFamilyAiUnverified = sectionFamilyUnverifiedReason(entry.section_reference);
    if (sectionFamilyAiUnverified) reasons.push(sectionFamilyAiUnverified);
    // Subject-assignment findings (ASSERTION_SCOPE_AMBIGUOUS,
    // LIMB_PATH_NOT_IN_TREE) participate in the auto-pass computation like
    // any other structural gate -- final-audit finding M5: merging them
    // into the queue item AFTER triage.auto_pass was computed left a latent
    // hole that would open the moment the two absent nets land.
    for (const reason of subjectReasons) reasons.push(reason);

    const gateFailureReasons = reasons.filter((reason) => reason !== 'CITATION_CORROBORATED_ONLY');
    const deterministicGatesPassed = gateFailureReasons.length === 0;

    // Ben's M3 auto-pass protocol has six conditions. This deterministic stage
    // can evaluate four of them. Two CANNOT be evaluated yet because the
    // machinery does not exist: v1/v2 agreement under a governed comparator
    // (no differential net) and "the lexical disagreement set contains no
    // unmatched signal" (no Agreement-family lexical net). A check that was
    // never run must never look like a check that passed -- so auto-pass
    // eligibility is BLOCKED while either is absent, and the reason travels
    // in the data rather than only in a comment. `applyV1V2Wiring` and
    // `applyLexicalDisagreementWiring` below remove the corresponding entry
    // per claim once a caller supplies a bound, fresh, clean receipt.
    //
    // A THIRD entry, PERMANENT for this slice (docs/superpowers/specs/
    // 2026-08-02-lexical-disagreement-net-design.md, "Auto-pass arithmetic",
    // audit M4): two of Ben's six M3 conditions are still STRUCTURALLY
    // UNREPRESENTED even after both nets land -- certified-complete source
    // scope (the scope-closure machinery does not exist) and mandatory-
    // review selection of high-risk propositions. `SOURCE_SCOPE_
    // CERTIFICATION_ABSENT` is added unconditionally, on every claim,
    // regardless of whether either net's optional input is supplied --
    // removed only when the scope-closure slice actually lands. This keeps
    // the invariant "empty array = every protocol condition mechanically
    // evaluated" TRUE: a check that was never run must never look passed,
    // and since this entry can never be removed by EITHER net's wiring,
    // `auto_pass` stays permanently false for now -- which is exactly the
    // "routing unchanged, nothing skips the queue" guarantee the spec's
    // `both_nets_clean` instrumentation marker (see `applyLexicalDisagreement
    // Wiring`) depends on: computing that marker can never, by itself, open
    // auto-pass.
    const unevaluatedConditions = Object.freeze([
      'V1_V2_COMPARATOR_ABSENT',
      'LEXICAL_DISAGREEMENT_NET_ABSENT',
      'SOURCE_SCOPE_CERTIFICATION_ABSENT',
      ...((mapping.registered_claim_definition_key === 'REPRESENTATION_ACCURACY_STANDARD'
        && (genericKey === BRING_DOWN_TIER_CLAIM_KEY || genericKey === CLOSING_CONDITION_CLAIM_KEY))
        ? ['BRING_DOWN_TIER_PROVENANCE_REVISIT_PENDING'] : []),
      ...extraUnevaluatedConditions,
    ]);
    // CITATION_CORROBORATED_ONLY blocks auto-pass on its own terms too (spec:
    // "it can never auto-pass"), independent of -- and future-proof against
    // -- the two nets above eventually landing.
    const autoPass = deterministicGatesPassed && unevaluatedConditions.length === 0 && !citationCorroboratedOnly;

    const resolvedEntry = Object.freeze({
      section_reference: entry.section_reference,
      generic_claim_key: genericKey,
      resolved_claim_definition_key: mapping.registered_claim_definition_key,
      concept_key: mapping.concept_key,
      party,
      party_source_span: partySourceSpan,
      provision_instance: provision,
      claim: rebuiltClaim,
      compiled_candidate: Object.freeze({
        section_reference: entry.section_reference,
        ok: true,
        citation_validation: citationValidation,
        candidate: Object.freeze({ kind: 'claim', claim: rebuiltClaim, extraction_provenance: provenance }),
      }),
      triage: Object.freeze({
        auto_pass: autoPass,
        deterministic_gates_passed: deterministicGatesPassed,
        unevaluated_conditions: unevaluatedConditions,
        reasons: Object.freeze(reasons),
        materiality_rank: materiality.rank,
        materiality_label: materiality.label,
        known_defect: defectMatch ? Object.freeze({ ...defectMatch }) : null,
        citation_validation: citationValidation,
      }),
    });
    resolved.push(resolvedEntry);

    if (!autoPass) {
      reviewQueue.push(Object.freeze({
        section_reference: entry.section_reference,
        generic_claim_key: genericKey,
        resolved_claim_definition_key: mapping.registered_claim_definition_key,
        concept_key: mapping.concept_key,
        reasons: Object.freeze(reasons),
        materiality_rank: materiality.rank,
        materiality_label: materiality.label,
        auto_pass: false,
        has_resolution: true,
        claim_revision_id: rebuiltClaim.claim_revision_id,
        closure_id: rebuiltClaim.closure_id,
        normalised_phrase: normaliseForMatching(rebuiltClaim.raw_value),
        attachment_position: (rebuiltClaim.attributes && rebuiltClaim.attributes.attachment
          && rebuiltClaim.attributes.attachment.position) || null,
        concept_family: mapping.concept_key,
      }));
    }
    return resolvedEntry;
  }

  // ---------------------------------------------------------------------
  // PRE-PASS: mint one REP-T-CAP provision + limb component tree PER
  // GOVERNED REPRESENTATION (grouped by the producer's own original
  // subject_occurrence_id, shared by every LIMB_ASSERTION and QUALIFIER
  // claim under the same representation instance -- see anthropic-
  // provider.js's shapeRepresentationInstance). This MUST happen before any
  // individual qualifier's own kind/mapping is known: the tree has to exist
  // even when every qualifier in the group ends up THRESHOLD/open-world
  // (spec section 1's "LIMB_ASSERTION proposals: still open-world as
  // claims, but the tree's path/assertion nodes are included in the
  // resolution result" -- plan Task 3 work item 6), and an ITEM-attached
  // qualifier's assertion-node SUBJECT can only be resolved once the tree
  // for its representation already exists.
  // ---------------------------------------------------------------------
  const representationGroups = new Map();
  for (const entry of runReceipt.compiled_candidates) {
    if (!entry || entry.ok !== true) continue;
    const { candidate } = entry;
    if (candidate.kind !== 'claim') continue;
    const provenance = candidate.extraction_provenance;
    if (provenance.proposal_kind === 'OPEN_WORLD') continue;
    const claim = candidate.claim;
    const genericKey = claim.claim_definition_key;
    if (genericKey !== LIMB_ASSERTION_CLAIM_KEY && genericKey !== QUALIFIER_CLAIM_KEY) continue;
    const subjectId = claim.subject_occurrence_id;
    let group = representationGroups.get(subjectId);
    if (!group) {
      group = {
        members: [],
        sectionReference: entry.section_reference,
        partyMaking: claim.attributes && claim.attributes.party_making,
      };
      representationGroups.set(subjectId, group);
    }
    group.members.push(entry);
  }

  for (const group of representationGroups.values()) {
    const section = sectionsByReference.get(group.sectionReference);
    // A missing section or unresolvable party is reported per-candidate
    // below (SECTION_REFERENCE_UNRESOLVED_IN_RECEIPT / PARTY_UNRESOLVED),
    // exactly as before the rekey -- this pre-pass simply cannot mint a
    // provision (and therefore no tree) for such a group, and leaves both
    // absent rather than guessing.
    if (!section) continue;
    const party = resolveParty({
      attributes: { party_making: group.partyMaking },
      mapping: { party_field: 'party_making', party_role: 'REPRESENTATION_MAKER' },
    });
    if (!party) continue;
    const groupKey = groupKeyFor({ sectionReference: group.sectionReference, conceptKey: QUALIFIER_CONCEPT_KEY, party });
    let provision = provisionsByGroupKey.get(groupKey);
    if (!provision) {
      provision = mintProvision({
        section,
        conceptKey: QUALIFIER_CONCEPT_KEY,
        party,
        ordinal: provisionsByGroupKey.size + 1,
        admittedSourceContext,
        contractVocabulary,
      });
      provisionsByGroupKey.set(groupKey, provision);
    }
    if (!limbTreesByProvisionId.has(provision.provision_instance_id)) {
      const tree = mintLimbComponentTree({
        compiled_candidates: group.members,
        provision_instance_id: provision.provision_instance_id,
      });
      limbTreesByProvisionId.set(provision.provision_instance_id, tree);
    }
  }

  // ---------------------------------------------------------------------
  // Qualifier subject assignment (work item 6): CHAPEAU-attached qualifiers
  // take the provision itself; ITEM-attached (and TRAILING-with-a-resolved
  // governs_path) qualifiers take the assertion-node subject per
  // limb-components.js's own resolveQualifierAttachment, which also
  // reports the typed ASSERTION_SCOPE_AMBIGUOUS reason and blocks auto-pass
  // when more than one assertion sits under the same path node.
  // ---------------------------------------------------------------------
  function resolveQualifierSubject({ attachmentPosition, governsPath, provision }) {
    if (attachmentPosition === 'CHAPEAU') {
      return { subjectId: provision.provision_instance_id, reasons: [], autoPassBlocked: false };
    }
    if ((attachmentPosition === 'ITEM' || attachmentPosition === 'TRAILING') && Array.isArray(governsPath) && governsPath.length > 0) {
      const tree = limbTreesByProvisionId.get(provision.provision_instance_id);
      if (!tree) {
        return { subjectId: provision.provision_instance_id, reasons: ['LIMB_PATH_NOT_IN_TREE'], autoPassBlocked: true };
      }
      const attachment = resolveLimbQualifierAttachment(tree, { governs_path: governsPath });
      return {
        subjectId: attachment.subject_component_id,
        reasons: [...attachment.reasons],
        autoPassBlocked: attachment.auto_pass_blocked,
      };
    }
    // TRAILING with no resolved governs_path reads as "governs the whole
    // node" (no single limb named) -- provision subject, same as CHAPEAU.
    return { subjectId: provision.provision_instance_id, reasons: [], autoPassBlocked: false };
  }

  // ---------------------------------------------------------------------
  // One qualifier PART (the whole quote for a CLASSIFIED/ruling-applied
  // outcome, or one byte-verified sub-quote for a SPLIT outcome) all the
  // way through: kind-to-mapping resolution, measurement-date parsing,
  // party/provision/subject resolution, and the shared gate/finalize path.
  // `partOriginalClaim` already carries the PART's own raw_value/evidence
  // (see buildPartOriginalClaim below); `part` carries the classifier's own
  // kind/code/measurementDateEligible verdict for this part.
  // ---------------------------------------------------------------------
  function resolveQualifierPart({
    entry, provenance, partOriginalClaim, part, attachmentPosition, governsPath, rulingApplied = null,
    qualifierDateAttrs = null, dateRoleAttrs = null,
  }) {
    const genericKey = QUALIFIER_CLAIM_KEY;
    const normalisedPhrase = normaliseForMatching(partOriginalClaim.raw_value);
    const kind = part.kind;

    // ACCURACY with no derivable whitelist code can never mint
    // REPRESENTATION_ACCURACY_STANDARD, split part or not (spec section 2
    // rule 7 + this module's own V2-era comment on why "nearest fit" is
    // forbidden) -- routes to review regardless of attachment position.
    if (kind === 'ACCURACY' && part.code === null) {
      pushReviewUnresolved({
        entry,
        claimRow: partOriginalClaim,
        mapping: null,
        conceptFamily: QUALIFIER_CONCEPT_KEY,
        reasons: ['QUALIFIER_KIND_UNCLASSIFIED'],
        materiality: materialityFor({ conceptKey: QUALIFIER_CONCEPT_KEY, canonicalValue: null }),
        normalisedPhrase,
        attachmentPosition,
      });
      return;
    }

    // Measurement-date reachability, stated positively (spec section 2
    // round-2 finding 2): a TEMPORAL result may reach the measurement-date
    // mapping ONLY when the lexicon marked it eligible (whole-quote fire
    // alone, or split from an ACCURACY host). An ineligible TEMPORAL dates
    // the QUALIFIER, never the representation -- it never mints
    // REPRESENTATION_MEASUREMENT_DATE and routes open-world with a typed
    // reason distinct from a plain "unmapped" generic key. It DOES attempt a
    // parse (M6a/M6b) so that, when the date resolves, the QUALIFIER's own
    // open-world entry carries it in `attributes` -- the same
    // qualifier_dated_as_of/qualifier_date_raw shape preserved on a
    // KNOWLEDGE/THRESHOLD split host below -- rather than the date being
    // reachable only via the raw quote text.
    if (kind === 'TEMPORAL' && part.measurementDateEligible !== true) {
      const dateResult = parseDefinedMeasurementDate(part.text);
      const selfDateAttrs = dateResult.outcome === 'RESOLVED'
        ? { qualifier_dated_as_of: dateResult.iso_date, qualifier_date_raw: part.text }
        : null;
      pushOpenWorld({
        entry,
        claimRow: selfDateAttrs
          ? { ...partOriginalClaim, attributes: { ...partOriginalClaim.attributes, ...selfDateAttrs } }
          : partOriginalClaim,
        reason: 'TEMPORAL_MEASUREMENT_DATE_INELIGIBLE',
      });
      return;
    }

    const mapping = lookupGenericClaimKeyMapping(genericKey, kind, attachmentPosition);
    if (
      mapping
      && P2_QUALIFIER_REGISTRY_CLAIM_KEYS.has(mapping.registered_claim_definition_key)
      && !vocabulary.claimDefinitions.has(mapping.registered_claim_definition_key)
    ) {
      pushOpenWorld({
        entry,
        claimRow: partOriginalClaim,
        reason: 'UNMAPPED_GENERIC_CLAIM_KEY',
      });
      return;
    }
    if (!mapping) {
      if (kind === 'ACCURACY') {
        // A valid whitelist code exists, but the attachment position is not
        // CHAPEAU -- spec section 2 rule 6: "An ITEM-attached (limb-level)
        // ACCURACY qualifier goes to review -- never minted as a rep-level
        // claim." Doubt at the ACCURACY boundary always routes to review,
        // per the lexicon's own asymmetric doubt rule.
        pushReviewUnresolved({
          entry,
          claimRow: partOriginalClaim,
          mapping: null,
          conceptFamily: QUALIFIER_CONCEPT_KEY,
          reasons: ['ACCURACY_ITEM_ATTACHED_NOT_REP_LEVEL'],
          materiality: materialityFor({ conceptKey: QUALIFIER_CONCEPT_KEY, canonicalValue: null }),
          normalisedPhrase,
          attachmentPosition,
        });
        return;
      }
      if (kind === 'DISCLOSURE_SCHEDULE_CARVEOUT') {
        pushReviewUnresolved({
          entry,
          claimRow: partOriginalClaim,
          mapping: null,
          conceptFamily: QUALIFIER_CONCEPT_KEY,
          reasons: ['CARVEOUT_POSITION_UNMAPPED'],
          materiality: materialityFor({ conceptKey: QUALIFIER_CONCEPT_KEY, canonicalValue: null }),
          normalisedPhrase,
          attachmentPosition,
        });
        return;
      }
      // THRESHOLD, and everything else unmapped: open world, unchanged --
      // except that a THRESHOLD host of a split-off ineligible TEMPORAL part
      // (spec section 2 rule 3, M6a) carries the preserved date forward onto
      // its own open-world entry, so the published knowledge/threshold
      // observation carries its own date instead of the date silently
      // living only on the (also open-world) TEMPORAL part.
      pushOpenWorld({
        entry,
        claimRow: (kind === 'THRESHOLD' && qualifierDateAttrs)
          ? { ...partOriginalClaim, attributes: { ...partOriginalClaim.attributes, ...qualifierDateAttrs } }
          : partOriginalClaim,
        reason: 'UNMAPPED_GENERIC_CLAIM_KEY',
      });
      return;
    }

    let resolvedCanonicalValue;
    const attributesExtra = {
      deterministic_kind: kind,
      answer_provenance: buildMechanicalAnswerProvenance({
        rulingProvenance: rulingApplied ? rulingApplied.provenance : null,
      }),
    };
    if (kind === 'ACCURACY') {
      resolvedCanonicalValue = part.code;
    } else if (kind === 'DISCLOSURE_SCHEDULE_CARVEOUT') {
      const reference = parseScheduleReference({ quote: part.text });
      if (reference.outcome !== 'RESOLVED') {
        pushReviewUnresolved({
          entry,
          claimRow: partOriginalClaim,
          mapping,
          conceptFamily: mapping.concept_key,
          reasons: [reference.reason],
          materiality: materialityFor({ conceptKey: mapping.concept_key, canonicalValue: null }),
          normalisedPhrase,
          attachmentPosition,
        });
        return;
      }
      resolvedCanonicalValue = reference.canonical_value;
      attributesExtra.answer_provenance = buildMechanicalAnswerProvenance({
        rulingProvenance: rulingApplied ? rulingApplied.provenance : null,
        extraPins: { schedule_reference_parse_version: SCHEDULE_REFERENCE_PARSE_VERSION },
      });
    } else if (kind === 'PERFORMANCE_ASSUMPTION') {
      const level = derivePerformanceAssumptionLevel(part.text);
      if (level === null) {
        pushOpenWorld({
          entry,
          claimRow: partOriginalClaim,
          reason: PERFORMANCE_ASSUMPTION_LEVEL_UNDERIVABLE,
        });
        return;
      }
      resolvedCanonicalValue = level;
    } else if (kind === 'TEMPORAL') {
      const dateResult = parseDefinedMeasurementDate(part.text);
      if (dateResult.outcome === 'PERIOD_DETECTED') {
        const period = parseMeasurementPeriod({
          quote: part.text,
          agreement_date: agreementDate,
          defined_dates: definedDates,
        });
        if (period.outcome !== 'RESOLVED_PERIOD') {
          pushOpenWorld({
            entry,
            claimRow: {
              ...partOriginalClaim,
              attributes: { ...partOriginalClaim.attributes, measurement_date_parse_reason: period.reason },
            },
            reason: 'TEMPORAL_MEASUREMENT_DATE_UNRESOLVED',
          });
          return;
        }
        for (const [periodRole, endpoint] of [['PERIOD_START', period.start], ['PERIOD_END', period.end]]) {
          const endpointPart = {
            ...part,
            text: endpoint.matched_text,
            start: endpoint.start,
            end: endpoint.end,
            isWholeQuote: false,
          };
          const endpointClaim = buildPartOriginalClaim(partOriginalClaim, endpointPart);
          resolveQualifierPart({
            entry,
            provenance,
            partOriginalClaim: endpointClaim,
            part: endpointPart,
            attachmentPosition,
            governsPath,
            rulingApplied,
            qualifierDateAttrs,
            dateRoleAttrs: {
              date_role: 'DATE_REFERENCE',
              period_role: periodRole,
              ...(endpoint.defined_term ? { defined_term: endpoint.defined_term } : {}),
            },
          });
        }
        return;
      }
      if (dateResult.outcome !== 'RESOLVED') {
        pushOpenWorld({
          entry,
          claimRow: {
            ...partOriginalClaim,
            // P2 phase 1 (Fable build review 2026-08-03, F-1): the V2
            // parser's PERIOD_DETECTED signal carries no `reason` field --
            // an undefined here poisoned canonical-JSON hashing downstream
            // (lexical digest over open-world rows). The outcome IS the
            // typed reason until the phase-2 resolver wiring routes periods
            // to parseMeasurementPeriod.
            attributes: {
              ...partOriginalClaim.attributes,
              measurement_date_parse_reason: dateResult.reason || dateResult.outcome,
            },
          },
          reason: 'TEMPORAL_MEASUREMENT_DATE_UNRESOLVED',
        });
        return;
      }
      resolvedCanonicalValue = dateResult.iso_date;
      // Unenriched-date mark (spec section 3): every claim minted this way
      // is not comparable across deals until the (separate, existing)
      // enrichment pass mints an enriched revision.
      attributesExtra.enrichment_state = 'UNENRICHED';
      attributesExtra.comparability = 'NOT_COMPARABLE';
      attributesExtra.measurement_date_resolution = dateResult.resolution;
      if (dateRoleAttrs) {
        Object.assign(attributesExtra, dateRoleAttrs);
      } else if (dateResult.defined_term) {
        Object.assign(attributesExtra, {
          date_role: dateResult.resolution === 'CALENDAR' ? 'DATE_DEFINITION' : 'DATE_REFERENCE',
          defined_term: dateResult.defined_term,
        });
      }
    } else if (kind === 'KNOWLEDGE') {
      resolvedCanonicalValue = true;
      const standard = deriveKnowledgeStandard(part.text);
      if (standard) attributesExtra.knowledge_standard = standard;
      // Spec section 2 rule 3 / M6a: a TEMPORAL split off this KNOWLEDGE
      // host, ineligible for the measurement-date mapping, dates the
      // qualifier, not the representation -- preserved here so the
      // resolved KNOWLEDGE_QUALIFIER claim carries its own date.
      if (qualifierDateAttrs) Object.assign(attributesExtra, qualifierDateAttrs);
    } else {
      // THRESHOLD (or any future kind with a table entry this module does
      // not yet know how to mint a canonical value for) is unreachable here
      // -- the table has no THRESHOLD entry -- but fail closed rather than
      // mint a claim with an unset canonical_value if that ever changes.
      residuals.push(Object.freeze({
        residual_type: 'UNSUPPORTED_QUALIFIER_KIND_MAPPING',
        section_reference: entry.section_reference,
        deterministic_kind: kind,
      }));
      return;
    }

    const claimDefinition = vocabulary.claimDefinitions.get(mapping.registered_claim_definition_key);
    if (!claimDefinition) {
      residuals.push(Object.freeze({
        residual_type: 'VOCABULARY_MISSING_MAPPED_CLAIM_DEFINITION',
        section_reference: entry.section_reference,
        generic_claim_key: genericKey,
        mapped_claim_definition_key: mapping.registered_claim_definition_key,
      }));
      return;
    }
    if (!vocabulary.concepts.has(mapping.concept_key)) {
      residuals.push(Object.freeze({
        residual_type: 'VOCABULARY_MISSING_MAPPED_CONCEPT',
        section_reference: entry.section_reference,
        generic_claim_key: genericKey,
        concept_key: mapping.concept_key,
      }));
      return;
    }

    const section = sectionsByReference.get(entry.section_reference);
    if (!section) {
      residuals.push(Object.freeze({
        residual_type: 'SECTION_REFERENCE_UNRESOLVED_IN_RECEIPT',
        section_reference: entry.section_reference,
      }));
      return;
    }

    const materiality = materialityFor({
      conceptKey: mapping.concept_key,
      canonicalValue: resolvedCanonicalValue,
      claimDefinitionKey: mapping.registered_claim_definition_key,
    });
    const party = resolveParty({ attributes: partOriginalClaim.attributes, mapping });
    if (!party) {
      pushReviewUnresolved({
        entry,
        claimRow: partOriginalClaim,
        mapping,
        conceptFamily: mapping.concept_key,
        reasons: ['PARTY_UNRESOLVED'],
        materiality,
        normalisedPhrase,
        attachmentPosition,
      });
      return;
    }

    const groupKey = groupKeyFor({ sectionReference: entry.section_reference, conceptKey: mapping.concept_key, party });
    let provision = provisionsByGroupKey.get(groupKey);
    if (!provision) {
      // Should already exist from the PRE-PASS above for every real
      // governed representation; minted defensively here too so a directly
      // hand-built test fixture (bypassing the pre-pass's LIMB_ASSERTION/
      // QUALIFIER grouping, e.g. a manually constructed compiled_candidates
      // list) still resolves rather than silently failing to find one.
      provision = mintProvision({
        section, conceptKey: mapping.concept_key, party, ordinal: provisionsByGroupKey.size + 1,
        admittedSourceContext, contractVocabulary,
      });
      provisionsByGroupKey.set(groupKey, provision);
    }

    const subjectAssignment = resolveQualifierSubject({ attachmentPosition, governsPath, provision });

    const defectScope = Object.freeze({
      deal: dealKey,
      family: mapping.concept_key,
      attribute: mapping.registered_claim_definition_key,
      extraction_mechanism: provenance.extractor_id,
    });
    const defectMatch = matchesKnownDefect(knownDefectRegistry, defectScope);

    const claimGroupKey = `${subjectAssignment.subjectId}::${mapping.registered_claim_definition_key}`;
    const claimOrdinal = claimOrdinalCounters.get(claimGroupKey) || 0;
    claimOrdinalCounters.set(claimGroupKey, claimOrdinal + 1);

    const rebuiltClaim = rebuildClaim({
      originalClaim: partOriginalClaim,
      newSubjectOccurrenceId: subjectAssignment.subjectId,
      newClaimDefinitionKey: mapping.registered_claim_definition_key,
      newOrdinal: claimOrdinal,
      newCanonicalValue: resolvedCanonicalValue,
      attributesExtra,
    });

    // Subject-assignment reasons flow INTO finalizeResolvedCandidate so they
    // participate in triage.auto_pass itself (final-audit finding M5) --
    // the normal !auto_pass queue push then carries them; no post-hoc
    // merge, no closure_id-collision hazard for split parts.
    finalizeResolvedCandidate({
      entry, provenance, genericKey, mapping, party, provision, rebuiltClaim, claimDefinition, defectMatch, materiality,
      subjectReasons: subjectAssignment.reasons,
    });
  }

  function operativeEvidenceEdge(claim) {
    if (!Array.isArray(claim.evidence) || claim.evidence.length === 0) return null;
    return claim.evidence.find((edge) => edge.evidence_role === 'OPERATIVE_TEXT') || claim.evidence[0];
  }

  // Builds a PART-scoped stand-in for the original claim: same shape, but
  // raw_value/evidence narrowed to exactly this split part's own
  // byte-verified sub-span (section-local offsets, matching the original
  // evidence's coordinate frame -- native-write-set-adapter.js shifts these
  // to document-absolute later, unchanged in kind). UTF-16 string offsets
  // (the lexicon's own coordinate space) are converted to UTF-8 BYTE
  // offsets against the ORIGINAL quote before being added to the original
  // edge's absolute_start -- see utf16OffsetToByteOffset's own comment.
  function buildPartOriginalClaim(claim, part) {
    if (part.isWholeQuote) return claim;
    const originalEdge = operativeEvidenceEdge(claim);
    const startByte = utf16OffsetToByteOffset(claim.raw_value, part.start);
    const endByte = utf16OffsetToByteOffset(claim.raw_value, part.end);
    const newEdge = {
      ...originalEdge,
      absolute_start: originalEdge.absolute_start + startByte,
      absolute_end: originalEdge.absolute_start + endByte,
    };
    return { ...claim, raw_value: part.text, evidence: [newEdge] };
  }

  // ---------------------------------------------------------------------
  // The classification+mapping pipeline for one whole QUALIFIER_CLAIM_KEY
  // compiled candidate (ruling corpus exact match BEFORE the lexicon, then
  // the lexicon's CLASSIFIED/SPLIT/REVIEW/OPEN_WORLD outcome), dispatching
  // to resolveQualifierPart per part.
  // ---------------------------------------------------------------------
  function handleQualifierCandidate(entry) {
    const { candidate } = entry;
    const provenance = candidate.extraction_provenance;
    const claim = candidate.claim;
    const attachment = claim.attributes && claim.attributes.attachment;
    const attachmentPosition = attachment && typeof attachment.position === 'string' ? attachment.position : null;
    const governsPath = attachment && Array.isArray(attachment.governs_path) ? attachment.governs_path : null;
    const normalisedPhrase = normaliseForMatching(claim.raw_value);
    const modelKindHint = typeof (claim.attributes && claim.attributes.qualifier_kind) === 'string'
      ? claim.attributes.qualifier_kind
      : null;

    // Ruling corpus: exact-key application runs BEFORE the lexicon (spec
    // section 4). Every application also re-runs the CURRENT lexicon;
    // only an affirmative, different-kind fire is a conflict.
    let rulingApplied = null;
    if (attachmentPosition === 'CHAPEAU' || attachmentPosition === 'ITEM' || attachmentPosition === 'TRAILING') {
      const rulingResult = applyRuling(rulingCorpus, {
        normalised_phrase: normalisedPhrase,
        attachment_position: attachmentPosition,
        concept_family: QUALIFIER_CONCEPT_KEY,
        classifyKind: lexiconKindForRulingConflictCheck,
      });
      if (rulingResult.outcome === 'RULING_LEXICON_CONFLICT') {
        pushReviewUnresolved({
          entry,
          claimRow: claim,
          mapping: null,
          conceptFamily: QUALIFIER_CONCEPT_KEY,
          reasons: ['RULING_LEXICON_CONFLICT'],
          materiality: materialityFor({ conceptKey: QUALIFIER_CONCEPT_KEY, canonicalValue: null }),
          normalisedPhrase,
          attachmentPosition,
        });
        return;
      }
      if (rulingResult.outcome === 'APPLIED') rulingApplied = rulingResult;
    }

    let parts;
    if (rulingApplied) {
      // A VERIFIED ruling settles the WHOLE clause's KIND (and code, where
      // applicable) as one unit -- rulings carry no split concept of their
      // own. But a ruling settles KIND, not measurement-date REACHABILITY
      // (M6b / spec finding-2 reachability): reachability is ALWAYS computed
      // by the lexicon rule (whole-quote TEMPORAL alone, or split-from-
      // ACCURACY-host), never inherited from the ruling. Run the current
      // lexicon on the same quote purely to read its eligibility signal --
      // this is independent of (and does not repeat) the lexicon-conflict
      // check already run above by applyRuling.
      const eligibilityCheck = rulingApplied.kind === 'TEMPORAL'
        ? classifyQualifierQuote({ quote: claim.raw_value, modelKind: null })
        : null;
      const measurementDateEligible = rulingApplied.kind === 'TEMPORAL'
        ? (eligibilityCheck.outcome === 'CLASSIFIED'
          && eligibilityCheck.kind === 'TEMPORAL'
          && eligibilityCheck.measurementDateEligible === true)
        : null;
      parts = [{
        kind: rulingApplied.kind,
        code: rulingApplied.code,
        measurementDateEligible,
        text: claim.raw_value,
        start: 0,
        end: claim.raw_value.length,
        isWholeQuote: true,
      }];
    } else {
      const classification = classifyQualifierQuote({ quote: claim.raw_value, modelKind: modelKindHint });
      if (classification.outcome === 'REVIEW') {
        pushReviewUnresolved({
          entry,
          claimRow: claim,
          mapping: null,
          conceptFamily: QUALIFIER_CONCEPT_KEY,
          reasons: [classification.reason],
          materiality: materialityFor({ conceptKey: QUALIFIER_CONCEPT_KEY, canonicalValue: null }),
          normalisedPhrase,
          attachmentPosition,
        });
        return;
      }
      if (classification.outcome === 'OPEN_WORLD') {
        pushOpenWorld({ entry, claimRow: claim, reason: 'UNMAPPED_GENERIC_CLAIM_KEY' });
        return;
      }
      if (classification.outcome === 'CLASSIFIED') {
        parts = [{
          kind: classification.kind,
          code: classification.code,
          measurementDateEligible: classification.measurementDateEligible,
          text: claim.raw_value,
          start: 0,
          end: claim.raw_value.length,
          isWholeQuote: true,
        }];
      } else {
        // SPLIT: every part re-verifies byte-exact against the ORIGINAL
        // claim's own quote (plan work item 9) -- an independent check on
        // top of the lexicon's own internal verification, in the same
        // "three independent sites compute the identical thing" style this
        // module already uses elsewhere. Any part failing voids the WHOLE
        // split -> doubt routing (asymmetric: ACCURACY-touching -> review,
        // otherwise open world), never a partial/best-effort split.
        const builtParts = [];
        let allVerified = true;
        for (const part of classification.parts) {
          if (claim.raw_value.slice(part.start, part.end) !== part.text) {
            allVerified = false;
            break;
          }
          builtParts.push({
            kind: part.kind, code: part.code, measurementDateEligible: part.measurementDateEligible,
            text: part.text, start: part.start, end: part.end, isWholeQuote: false,
          });
        }
        if (!allVerified) {
          const families = classification.parts.map((part) => part.kind);
          const touchesAccuracy = families.includes('ACCURACY') || modelKindHint === 'ACCURACY';
          if (touchesAccuracy) {
            pushReviewUnresolved({
              entry,
              claimRow: claim,
              mapping: null,
              conceptFamily: QUALIFIER_CONCEPT_KEY,
              reasons: ['QUALIFIER_KIND_UNCLASSIFIED'],
              materiality: materialityFor({ conceptKey: QUALIFIER_CONCEPT_KEY, canonicalValue: null }),
              normalisedPhrase,
              attachmentPosition,
            });
          } else {
            pushOpenWorld({ entry, claimRow: claim, reason: 'UNMAPPED_GENERIC_CLAIM_KEY' });
          }
          return;
        }
        parts = builtParts;
      }
    }

    // Spec section 2 rule 3 / M6a: a SPLIT that produces a TEMPORAL part
    // ineligible for the measurement-date mapping (host is KNOWLEDGE or
    // THRESHOLD, never ACCURACY -- an ACCURACY-host split TEMPORAL is
    // eligible and takes the ordinary measurement-date path) dates the
    // QUALIFIER, not the representation: parse the ineligible part here so
    // the resolved date can be preserved on the HOST part(s) below, instead
    // of living only on the (also open-world) TEMPORAL part. A single-part
    // (non-SPLIT) outcome can never have an ineligible TEMPORAL co-occurring
    // with another kind, so this is a no-op outside the SPLIT branch above.
    let qualifierDateAttrs = null;
    if (parts.length > 1) {
      const ineligibleTemporalParts = parts.filter(
        (candidatePart) => candidatePart.kind === 'TEMPORAL' && candidatePart.measurementDateEligible !== true,
      );
      for (const temporalPart of ineligibleTemporalParts) {
        const dateResult = parseDefinedMeasurementDate(temporalPart.text);
        if (dateResult.outcome === 'RESOLVED') {
          qualifierDateAttrs = {
            qualifier_dated_as_of: dateResult.iso_date,
            qualifier_date_raw: temporalPart.text,
          };
          break;
        }
      }
    }

    for (const part of parts) {
      const partOriginalClaim = buildPartOriginalClaim(claim, part);
      resolveQualifierPart({
        entry, provenance, partOriginalClaim, part, attachmentPosition, governsPath, rulingApplied,
        qualifierDateAttrs,
      });
    }
  }

  // ---------------------------------------------------------------------
  // SHARE_COUNT (P1 cap-table numerics, spec section 4): the TEMPORAL/
  // measurement-date pattern, reused -- corroboration check (C-4) ->
  // attribute verbatim checks (M-3) -> share-count-parse.js -> definition
  // split on count_kind -> gates. Out-of-enum count_kind is an EXPLICIT
  // pushOpenWorld (the main loop's proposal_kind routing keys only on
  // OPEN_WORLD and will not catch SHARE_COUNT).
  // ---------------------------------------------------------------------
  function handleShareCountCandidate(entry) {
    const { candidate } = entry;
    const provenance = candidate.extraction_provenance;
    const claim = candidate.claim;
    const attrs = claim.attributes || {};
    const countKind = typeof attrs.count_kind === 'string' ? attrs.count_kind : null;
    const normalisedPhrase = normaliseForMatching(claim.raw_value);

    // Out-of-enum count_kind: the enum is a gate, not a suggestion (spec
    // section 1). Anything the model proposes outside the five recognised
    // kinds is open world, via an explicit typed reason.
    if (!countKind || !SHARE_COUNT_KINDS.includes(countKind)) {
      pushOpenWorld({ entry, claimRow: claim, reason: 'SHARE_COUNT_KIND_OUT_OF_ENUM' });
      return;
    }

    // Corroboration (audit C-4): a wrong-but-in-enum label must never
    // publish a number under the wrong kind.
    if (!shareCountKindCorroborated(countKind, claim.raw_value)) {
      pushReviewUnresolved({
        entry,
        claimRow: claim,
        mapping: null,
        conceptFamily: QUALIFIER_CONCEPT_KEY,
        reasons: ['COUNT_KIND_UNCORROBORATED'],
        materiality: materialityFor({
          conceptKey: QUALIFIER_CONCEPT_KEY,
          canonicalValue: null,
          claimDefinitionKey: countKind === 'RESERVED' ? 'RESERVED_SHARE_POOL' : 'CAPITALIZATION_SHARE_COUNT',
        }),
        normalisedPhrase,
        attachmentPosition: null,
      });
      return;
    }

    // Attribute verbatim-ness (audit M-3): share_class_ref must be a real
    // substring of the byte-verified quote before it can ever reach the
    // parser's own exclusion-class-1 logic.
    const shareClassRef = typeof attrs.share_class_ref === 'string' ? attrs.share_class_ref : null;
    const registeredClaimDefinitionKey = countKind === 'RESERVED' ? 'RESERVED_SHARE_POOL' : 'CAPITALIZATION_SHARE_COUNT';
    if (!shareClassRef || !claim.raw_value.includes(shareClassRef)) {
      pushReviewUnresolved({
        entry,
        claimRow: claim,
        mapping: null,
        conceptFamily: QUALIFIER_CONCEPT_KEY,
        reasons: ['SHARE_CLASS_REF_NOT_IN_QUOTE'],
        materiality: materialityFor({
          conceptKey: QUALIFIER_CONCEPT_KEY, canonicalValue: null, claimDefinitionKey: registeredClaimDefinitionKey,
        }),
        normalisedPhrase,
        attachmentPosition: null,
      });
      return;
    }

    // RESERVED_SHARE_POOL additionally requires plan_ref, verbatim in the
    // quote (spec section 1): a reserved-pool claim with no identifiable
    // plan routes to review, typed RESERVED_POOL_PLAN_UNIDENTIFIED, never
    // resolves with an empty ref.
    let planRef = null;
    if (countKind === 'RESERVED') {
      planRef = typeof attrs.plan_ref === 'string' ? attrs.plan_ref : null;
      if (!planRef || !claim.raw_value.includes(planRef)) {
        pushReviewUnresolved({
          entry,
          claimRow: claim,
          mapping: null,
          conceptFamily: QUALIFIER_CONCEPT_KEY,
          reasons: ['RESERVED_POOL_PLAN_UNIDENTIFIED'],
          materiality: materialityFor({
            conceptKey: QUALIFIER_CONCEPT_KEY, canonicalValue: null, claimDefinitionKey: registeredClaimDefinitionKey,
          }),
          normalisedPhrase,
          attachmentPosition: null,
        });
        return;
      }
    }

    const parseResult = parseShareCount({
      quote: claim.raw_value, count_kind: countKind, share_class_ref: shareClassRef, plan_ref: planRef,
    });
    if (parseResult.outcome !== 'RESOLVED') {
      // ABSTAIN outcomes route to REVIEW with the parser's own typed reason
      // (spec sections 2, 4 and 5, pinned three times -- Fable review
      // finding F-1: this is NOT open-world, it is a review-queue routing,
      // exactly like COUNT_KIND_UNCORROBORATED and SHARE_CLASS_REF_NOT_IN_
      // QUOTE above). A quote that reached the parser already carries a
      // corroborated kind and a verbatim class/plan ref -- the parser
      // simply could not extract a single clean number from it, which is
      // doubt about THIS specific candidate, not "no concept for this at
      // all" (open-world's own meaning).
      pushReviewUnresolved({
        entry,
        claimRow: claim,
        mapping: null,
        conceptFamily: QUALIFIER_CONCEPT_KEY,
        reasons: [parseResult.reason],
        materiality: materialityFor({
          conceptKey: QUALIFIER_CONCEPT_KEY,
          canonicalValue: null,
          claimDefinitionKey: registeredClaimDefinitionKey,
        }),
        normalisedPhrase,
        attachmentPosition: null,
      });
      return;
    }

    const claimDefinition = vocabulary.claimDefinitions.get(registeredClaimDefinitionKey);
    if (!claimDefinition) {
      residuals.push(Object.freeze({
        residual_type: 'VOCABULARY_MISSING_MAPPED_CLAIM_DEFINITION',
        section_reference: entry.section_reference,
        generic_claim_key: SHARE_COUNT_CLAIM_KEY,
        mapped_claim_definition_key: registeredClaimDefinitionKey,
      }));
      return;
    }
    if (!vocabulary.concepts.has(QUALIFIER_CONCEPT_KEY)) {
      residuals.push(Object.freeze({
        residual_type: 'VOCABULARY_MISSING_MAPPED_CONCEPT',
        section_reference: entry.section_reference,
        generic_claim_key: SHARE_COUNT_CLAIM_KEY,
        concept_key: QUALIFIER_CONCEPT_KEY,
      }));
      return;
    }

    const section = sectionsByReference.get(entry.section_reference);
    if (!section) {
      residuals.push(Object.freeze({
        residual_type: 'SECTION_REFERENCE_UNRESOLVED_IN_RECEIPT',
        section_reference: entry.section_reference,
      }));
      return;
    }

    // A locally-built mapping, not a GENERIC_CLAIM_KEY_RESOLUTION_TABLE
    // lookup result: the table's own SHARE_COUNT entry carries
    // registered_claim_definition_key: null (audit M-2 -- see the table's
    // own comment) because the real answer depends on count_kind, decided
    // here, not in the table.
    const mapping = Object.freeze({
      generic_claim_key: SHARE_COUNT_CLAIM_KEY,
      deterministic_kind: countKind,
      attachment_position: null,
      registered_claim_definition_key: registeredClaimDefinitionKey,
      concept_key: QUALIFIER_CONCEPT_KEY,
      party_field: 'party_making',
      party_role: 'REPRESENTATION_MAKER',
    });

    const materiality = materialityFor({
      conceptKey: mapping.concept_key,
      canonicalValue: parseResult.canonical_value,
      claimDefinitionKey: registeredClaimDefinitionKey,
    });
    const party = resolveParty({ attributes: claim.attributes, mapping });
    if (!party) {
      pushReviewUnresolved({
        entry,
        claimRow: claim,
        mapping,
        conceptFamily: mapping.concept_key,
        reasons: ['PARTY_UNRESOLVED'],
        materiality,
        normalisedPhrase,
        attachmentPosition: null,
      });
      return;
    }

    const defectScope = Object.freeze({
      deal: dealKey,
      family: mapping.concept_key,
      attribute: mapping.registered_claim_definition_key,
      extraction_mechanism: provenance.extractor_id,
    });
    const defectMatch = matchesKnownDefect(knownDefectRegistry, defectScope);

    const groupKey = groupKeyFor({ sectionReference: entry.section_reference, conceptKey: mapping.concept_key, party });
    let provision = provisionsByGroupKey.get(groupKey);
    if (!provision) {
      provision = mintProvision({
        section,
        conceptKey: mapping.concept_key,
        party,
        ordinal: provisionsByGroupKey.size + 1,
        admittedSourceContext,
        contractVocabulary,
      });
      provisionsByGroupKey.set(groupKey, provision);
    }

    const claimGroupKey = `${provision.provision_instance_id}::${registeredClaimDefinitionKey}`;
    const claimOrdinal = claimOrdinalCounters.get(claimGroupKey) || 0;
    claimOrdinalCounters.set(claimGroupKey, claimOrdinal + 1);

    // Attribute identity pin (spec section 1, audit minor): share_class_ref,
    // count_kind and plan_ref participate in claim identity/closure via
    // `attributes`, which rebuildClaim already folds into
    // CLAIM_REVISION_PAYLOAD_FIELDS -- so two same-section counts differing
    // only in share_class_ref/count_kind mint distinct, stable identities
    // without any extra wiring here.
    const rebuiltClaim = rebuildClaim({
      originalClaim: claim,
      newSubjectOccurrenceId: provision.provision_instance_id,
      newClaimDefinitionKey: registeredClaimDefinitionKey,
      newOrdinal: claimOrdinal,
      newCanonicalValue: parseResult.canonical_value,
      attributesExtra: {
        count_kind: countKind,
        share_class_ref: shareClassRef,
        ...(planRef ? { plan_ref: planRef } : {}),
        answer_provenance: buildMechanicalAnswerProvenance({}),
      },
    });

    finalizeResolvedCandidate({
      entry,
      provenance,
      genericKey: SHARE_COUNT_CLAIM_KEY,
      mapping,
      party,
      provision,
      rebuiltClaim,
      claimDefinition,
      defectMatch,
      materiality,
    });
  }

  // ---------------------------------------------------------------------
  // Termination-fee family (family-termination-fee slice, spec section 4):
  // dedicated handlers, the TEMPORAL/share-count pattern -- corroboration
  // checks -> attribute verbatim checks (fee_term_ref) ->
  // termination-fee-parse.js (amount/tail) or enum + corroboration only
  // (trigger; no parse -- the canonical value IS the enum code) -> concept
  // assignment -> gates. Every ABSTAIN routes to review with the parser's
  // typed reason; RESOLVED values still pass canonicalValueAllowed (a
  // parser bug must not bypass the gate); out-of-enum trigger/fee_side ->
  // explicit pushOpenWorld, typed.
  // ---------------------------------------------------------------------

  // Shared tail: vocabulary/section lookups, provision minting, claim
  // rebuild and finalizeResolvedCandidate, common to all three termination-
  // fee generic keys once their own gates have all passed.
  function finalizeTerminationFeeClaim({
    entry, claim, provenance, genericKey, registeredClaimDefinitionKey, conceptKey, party,
    canonicalValue, extraAttributes,
  }) {
    const claimDefinition = vocabulary.claimDefinitions.get(registeredClaimDefinitionKey);
    if (!claimDefinition) {
      residuals.push(Object.freeze({
        residual_type: 'VOCABULARY_MISSING_MAPPED_CLAIM_DEFINITION',
        section_reference: entry.section_reference,
        generic_claim_key: genericKey,
        mapped_claim_definition_key: registeredClaimDefinitionKey,
      }));
      return;
    }
    if (!vocabulary.concepts.has(conceptKey)) {
      residuals.push(Object.freeze({
        residual_type: 'VOCABULARY_MISSING_MAPPED_CONCEPT',
        section_reference: entry.section_reference,
        generic_claim_key: genericKey,
        concept_key: conceptKey,
      }));
      return;
    }
    const section = sectionsByReference.get(entry.section_reference);
    if (!section) {
      residuals.push(Object.freeze({
        residual_type: 'SECTION_REFERENCE_UNRESOLVED_IN_RECEIPT',
        section_reference: entry.section_reference,
      }));
      return;
    }

    const materiality = materialityFor({
      conceptKey, canonicalValue, claimDefinitionKey: registeredClaimDefinitionKey,
    });

    const defectScope = Object.freeze({
      deal: dealKey,
      family: conceptKey,
      attribute: registeredClaimDefinitionKey,
      extraction_mechanism: provenance.extractor_id,
    });
    const defectMatch = matchesKnownDefect(knownDefectRegistry, defectScope);

    const groupKey = groupKeyFor({ sectionReference: entry.section_reference, conceptKey, party });
    let provision = provisionsByGroupKey.get(groupKey);
    if (!provision) {
      provision = mintProvision({
        section, conceptKey, party, ordinal: provisionsByGroupKey.size + 1, admittedSourceContext, contractVocabulary,
      });
      provisionsByGroupKey.set(groupKey, provision);
    }

    const claimGroupKey = `${provision.provision_instance_id}::${registeredClaimDefinitionKey}`;
    const claimOrdinal = claimOrdinalCounters.get(claimGroupKey) || 0;
    claimOrdinalCounters.set(claimGroupKey, claimOrdinal + 1);

    // Identity pin (spec section 4): fee_side, fee_term_ref and the trigger
    // code all participate in claim identity/closure via `attributes`
    // (rebuildClaim folds attributes into CLAIM_REVISION_PAYLOAD_FIELDS) --
    // so a section granting both a Company fee and a Parent fee mints
    // distinct, stable, non-deduping claims without any extra wiring here.
    const rebuiltClaim = rebuildClaim({
      originalClaim: claim,
      newSubjectOccurrenceId: provision.provision_instance_id,
      newClaimDefinitionKey: registeredClaimDefinitionKey,
      newOrdinal: claimOrdinal,
      newCanonicalValue: canonicalValue,
      attributesExtra: {
        ...extraAttributes,
        answer_provenance: buildMechanicalAnswerProvenance({}),
      },
    });

    const mapping = Object.freeze({
      generic_claim_key: genericKey,
      deterministic_kind: null,
      attachment_position: null,
      registered_claim_definition_key: registeredClaimDefinitionKey,
      concept_key: conceptKey,
      party_field: null,
      party_role: 'FEE_PAYER',
    });

    finalizeResolvedCandidate({
      entry, provenance, genericKey, mapping, party, provision, rebuiltClaim, claimDefinition, defectMatch, materiality,
    });
  }

  function handleFeeAmountCandidate(entry) {
    const { candidate } = entry;
    const provenance = candidate.extraction_provenance;
    const claim = candidate.claim;
    const attrs = claim.attributes || {};
    const feeSide = typeof attrs.fee_side === 'string' ? attrs.fee_side : null;
    const normalisedPhrase = normaliseForMatching(claim.raw_value);

    // Out-of-enum fee_side: the enum is a gate, not a suggestion.
    if (!feeSide || !FEE_SIDES.includes(feeSide)) {
      pushOpenWorld({ entry, claimRow: claim, reason: 'FEE_SIDE_OUT_OF_ENUM' });
      return;
    }

    const corroboratedSides = feeSideCorroboratedSides(claim.raw_value);
    if (corroboratedSides.length >= 2) {
      pushReviewUnresolved({
        entry, claimRow: claim, mapping: null, conceptFamily: TERMF_PENDING_CONCEPT_FAMILY,
        reasons: ['AMBIGUOUS_FEE_SIDE'],
        materiality: materialityFor({
          conceptKey: TERMF_PENDING_CONCEPT_FAMILY, canonicalValue: null, claimDefinitionKey: 'TERMINATION_FEE_AMOUNT',
        }),
        normalisedPhrase, attachmentPosition: null,
      });
      return;
    }
    if (corroboratedSides.length === 0 || !corroboratedSides.includes(feeSide)) {
      pushReviewUnresolved({
        entry, claimRow: claim, mapping: null, conceptFamily: TERMF_PENDING_CONCEPT_FAMILY,
        reasons: ['FEE_SIDE_UNCORROBORATED'],
        materiality: materialityFor({
          conceptKey: TERMF_PENDING_CONCEPT_FAMILY, canonicalValue: null, claimDefinitionKey: 'TERMINATION_FEE_AMOUNT',
        }),
        normalisedPhrase, attachmentPosition: null,
      });
      return;
    }

    // Concept assignment ONLY AFTER fee_side corroboration passes (spec
    // section 4).
    const conceptKey = feeSide === 'SELLER' ? 'TERMF-TARGET' : 'TERMF-REVERSE';

    // fee_term_ref: REQUIRED, verbatim substring of the quote (spec section
    // 1). Missing -> FEE_TERM_UNIDENTIFIED; present but not verbatim ->
    // FEE_TERM_NOT_IN_QUOTE.
    const feeTermRef = typeof attrs.fee_term_ref === 'string' && attrs.fee_term_ref.length > 0 ? attrs.fee_term_ref : null;
    if (!feeTermRef) {
      pushReviewUnresolved({
        entry, claimRow: claim, mapping: null, conceptFamily: conceptKey,
        reasons: ['FEE_TERM_UNIDENTIFIED'],
        materiality: materialityFor({ conceptKey, canonicalValue: null, claimDefinitionKey: 'TERMINATION_FEE_AMOUNT' }),
        normalisedPhrase, attachmentPosition: null,
      });
      return;
    }
    if (!claim.raw_value.includes(feeTermRef)) {
      pushReviewUnresolved({
        entry, claimRow: claim, mapping: null, conceptFamily: conceptKey,
        reasons: ['FEE_TERM_NOT_IN_QUOTE'],
        materiality: materialityFor({ conceptKey, canonicalValue: null, claimDefinitionKey: 'TERMINATION_FEE_AMOUNT' }),
        normalisedPhrase, attachmentPosition: null,
      });
      return;
    }

    const parseResult = parseFeeAmount(claim.raw_value);
    if (parseResult.outcome !== 'RESOLVED') {
      pushReviewUnresolved({
        entry, claimRow: claim, mapping: null, conceptFamily: conceptKey,
        reasons: [parseResult.reason],
        materiality: materialityFor({ conceptKey, canonicalValue: null, claimDefinitionKey: 'TERMINATION_FEE_AMOUNT' }),
        normalisedPhrase, attachmentPosition: null,
      });
      return;
    }

    // payer_party: feeds the ordinary resolveParty/PARTY_CAPACITY_LEXICON
    // path (spec section 1) -- unlike trigger/tail, the amount claim
    // carries its own payer_party phrase from the producer.
    const partyMapping = Object.freeze({
      generic_claim_key: FEE_AMOUNT_CLAIM_KEY, deterministic_kind: null, attachment_position: null,
      registered_claim_definition_key: 'TERMINATION_FEE_AMOUNT', concept_key: conceptKey,
      party_field: 'payer_party', party_role: 'FEE_PAYER',
    });
    const party = resolveParty({ attributes: claim.attributes, mapping: partyMapping });
    if (!party) {
      pushReviewUnresolved({
        entry, claimRow: claim, mapping: partyMapping, conceptFamily: conceptKey,
        reasons: ['PARTY_UNRESOLVED'],
        materiality: materialityFor({
          conceptKey, canonicalValue: parseResult.canonical_value, claimDefinitionKey: 'TERMINATION_FEE_AMOUNT',
        }),
        normalisedPhrase, attachmentPosition: null,
      });
      return;
    }

    finalizeTerminationFeeClaim({
      entry, claim, provenance, genericKey: FEE_AMOUNT_CLAIM_KEY,
      registeredClaimDefinitionKey: 'TERMINATION_FEE_AMOUNT', conceptKey, party,
      canonicalValue: parseResult.canonical_value,
      extraAttributes: { fee_side: feeSide, fee_term_ref: feeTermRef },
    });
  }

  function handleFeeTriggerCandidate(entry) {
    const { candidate } = entry;
    const provenance = candidate.extraction_provenance;
    const claim = candidate.claim;
    const attrs = claim.attributes || {};
    const feeSide = typeof attrs.fee_side === 'string' ? attrs.fee_side : null;
    const triggerCode = typeof attrs.trigger_code === 'string' && attrs.trigger_code.length > 0 ? attrs.trigger_code : null;
    const normalisedPhrase = normaliseForMatching(claim.raw_value);

    if (!feeSide || !FEE_SIDES.includes(feeSide)) {
      pushOpenWorld({ entry, claimRow: claim, reason: 'FEE_SIDE_OUT_OF_ENUM' });
      return;
    }
    // Out-of-enum trigger_code (a code the model proposed that is not one
    // of the seven registered codes) is open world too -- the enum is a
    // gate, not a suggestion. A null trigger_code (the model could not
    // identify the ground, e.g. a bare section-cite quote) is NOT
    // out-of-enum -- it proceeds to corroboration below, which will
    // typically find zero matches and route to TRIGGER_UNCORROBORATED.
    if (triggerCode && !FEE_TRIGGER_CODES.includes(triggerCode)) {
      pushOpenWorld({ entry, claimRow: claim, reason: 'TRIGGER_CODE_OUT_OF_ENUM' });
      return;
    }

    const corroboratedSides = feeSideCorroboratedSides(claim.raw_value);
    if (corroboratedSides.length >= 2) {
      pushReviewUnresolved({
        entry, claimRow: claim, mapping: null, conceptFamily: TERMF_PENDING_CONCEPT_FAMILY,
        reasons: ['AMBIGUOUS_FEE_SIDE'],
        materiality: materialityFor({
          conceptKey: TERMF_PENDING_CONCEPT_FAMILY, canonicalValue: null, claimDefinitionKey: 'TERMINATION_FEE_TRIGGER',
        }),
        normalisedPhrase, attachmentPosition: null,
      });
      return;
    }
    if (corroboratedSides.length === 0 || !corroboratedSides.includes(feeSide)) {
      pushReviewUnresolved({
        entry, claimRow: claim, mapping: null, conceptFamily: TERMF_PENDING_CONCEPT_FAMILY,
        reasons: ['FEE_SIDE_UNCORROBORATED'],
        materiality: materialityFor({
          conceptKey: TERMF_PENDING_CONCEPT_FAMILY, canonicalValue: null, claimDefinitionKey: 'TERMINATION_FEE_TRIGGER',
        }),
        normalisedPhrase, attachmentPosition: null,
      });
      return;
    }

    const conceptKey = feeSide === 'SELLER' ? 'TERMF-TARGET' : 'TERMF-REVERSE';

    // Trigger-ambiguity rule (spec section 1, audit C-3): the FULL pattern
    // table runs over the quote -- matching only the asserted code's own
    // pattern cannot bind label to text, since this family's quotes are
    // multi-trigger as the NORM. Zero matches -> TRIGGER_UNCORROBORATED
    // (the honest outcome for a bare section-cite quote); two or more
    // distinct codes match -> AMBIGUOUS_TRIGGER_CORROBORATION, UNLESS the
    // producer already narrowed its own quote to a sub-span in which
    // exactly one code's patterns match (that narrowing happens at the
    // PRODUCER layer -- by the time a quote reaches this handler, "exactly
    // one code matches" IS the narrowed-quote case).
    const matchedCodes = feeTriggerCorroboratedCodes(claim.raw_value);
    if (matchedCodes.length === 0) {
      pushReviewUnresolved({
        entry, claimRow: claim, mapping: null, conceptFamily: conceptKey,
        reasons: ['TRIGGER_UNCORROBORATED'],
        materiality: materialityFor({ conceptKey, canonicalValue: null, claimDefinitionKey: 'TERMINATION_FEE_TRIGGER' }),
        normalisedPhrase, attachmentPosition: null,
      });
      return;
    }
    if (matchedCodes.length >= 2) {
      pushReviewUnresolved({
        entry, claimRow: claim, mapping: null, conceptFamily: conceptKey,
        reasons: ['AMBIGUOUS_TRIGGER_CORROBORATION'],
        materiality: materialityFor({ conceptKey, canonicalValue: null, claimDefinitionKey: 'TERMINATION_FEE_TRIGGER' }),
        normalisedPhrase, attachmentPosition: null,
      });
      return;
    }

    const resolvedTriggerCode = matchedCodes[0];
    const party = feePayerPartyForSide(feeSide);

    finalizeTerminationFeeClaim({
      entry, claim, provenance, genericKey: FEE_TRIGGER_CLAIM_KEY,
      registeredClaimDefinitionKey: 'TERMINATION_FEE_TRIGGER', conceptKey, party,
      canonicalValue: resolvedTriggerCode,
      extraAttributes: { fee_side: feeSide, trigger_code: resolvedTriggerCode },
    });
  }

  function handleTailPeriodCandidate(entry) {
    const { candidate } = entry;
    const provenance = candidate.extraction_provenance;
    const claim = candidate.claim;
    const normalisedPhrase = normaliseForMatching(claim.raw_value);
    const conceptKey = 'TERMF-TAIL';

    // Side-bearing-tail detection (spec section 1, audit m-4): the BUYER
    // fee_side corroboration patterns run over the tail quote; any BUYER-
    // side match -> review, typed TAIL_SIDE_BEARING, never resolve. TERMF-
    // TAIL is inherently company-side, so a tail quote that itself reads as
    // describing a Parent-paid fee is describing something else entirely.
    const buyerSideMatch = FEE_SIDE_CORROBORATION_TABLE.BUYER.some((pattern) => pattern.test(claim.raw_value));
    if (buyerSideMatch) {
      pushReviewUnresolved({
        entry, claimRow: claim, mapping: null, conceptFamily: conceptKey,
        reasons: ['TAIL_SIDE_BEARING'],
        materiality: materialityFor({
          conceptKey, canonicalValue: null, claimDefinitionKey: 'TERMINATION_FEE_TAIL_PERIOD_MONTHS',
        }),
        normalisedPhrase, attachmentPosition: null,
      });
      return;
    }

    const parseResult = parseTailPeriodMonths(claim.raw_value);
    if (parseResult.outcome !== 'RESOLVED') {
      pushReviewUnresolved({
        entry, claimRow: claim, mapping: null, conceptFamily: conceptKey,
        reasons: [parseResult.reason],
        materiality: materialityFor({
          conceptKey, canonicalValue: null, claimDefinitionKey: 'TERMINATION_FEE_TAIL_PERIOD_MONTHS',
        }),
        normalisedPhrase, attachmentPosition: null,
      });
      return;
    }

    finalizeTerminationFeeClaim({
      entry, claim, provenance, genericKey: FEE_TAIL_PERIOD_CLAIM_KEY,
      registeredClaimDefinitionKey: 'TERMINATION_FEE_TAIL_PERIOD_MONTHS', conceptKey, party: TERMF_TAIL_PAYER_PARTY,
      canonicalValue: parseResult.canonical_value,
      extraAttributes: {},
    });
  }

  // ---------------------------------------------------------------------
  // No-shop family (family-no-shop slice, spec section 4): dedicated
  // handlers, corroboration -> attribute verbatim checks (period claims
  // only, defensive -- unit_phrase is derived FROM the byte-verified quote
  // by no-shop-period-parse.js, so the check can never actually fail, but
  // it is asserted anyway per the shared M-3 discipline) -> parser (period
  // claims only) -> concept assignment (fixed per generic key -- UNLIKE the
  // fee family, no corroborated split decides the concept here) -> gates.
  // Every ABSTAIN routes to review with the typed reason; out-of-enum
  // action_code/prerequisite_code -> explicit pushOpenWorld, typed (spec
  // section 4).
  // ---------------------------------------------------------------------

  // Shared tail: vocabulary/section lookups, provision minting, claim
  // rebuild and finalizeResolvedCandidate -- the termination-fee family's
  // own finalizeTerminationFeeClaim precedent, generalised (this family
  // needs no pre-concept TERMF-PENDING-style routing token: concept
  // assignment never depends on a corroboration outcome the way fee_side
  // does, so `conceptKey` is always already known here).
  function finalizeNoShopClaim({
    entry, claim, provenance, genericKey, registeredClaimDefinitionKey, conceptKey, party,
    canonicalValue, extraAttributes,
  }) {
    const claimDefinition = vocabulary.claimDefinitions.get(registeredClaimDefinitionKey);
    if (!claimDefinition) {
      residuals.push(Object.freeze({
        residual_type: 'VOCABULARY_MISSING_MAPPED_CLAIM_DEFINITION',
        section_reference: entry.section_reference,
        generic_claim_key: genericKey,
        mapped_claim_definition_key: registeredClaimDefinitionKey,
      }));
      return;
    }
    if (!vocabulary.concepts.has(conceptKey)) {
      residuals.push(Object.freeze({
        residual_type: 'VOCABULARY_MISSING_MAPPED_CONCEPT',
        section_reference: entry.section_reference,
        generic_claim_key: genericKey,
        concept_key: conceptKey,
      }));
      return;
    }
    const section = sectionsByReference.get(entry.section_reference);
    if (!section) {
      residuals.push(Object.freeze({
        residual_type: 'SECTION_REFERENCE_UNRESOLVED_IN_RECEIPT',
        section_reference: entry.section_reference,
      }));
      return;
    }

    const materiality = materialityFor({
      conceptKey, canonicalValue, claimDefinitionKey: registeredClaimDefinitionKey,
    });

    const defectScope = Object.freeze({
      deal: dealKey,
      family: conceptKey,
      attribute: registeredClaimDefinitionKey,
      extraction_mechanism: provenance.extractor_id,
    });
    const defectMatch = matchesKnownDefect(knownDefectRegistry, defectScope);

    const groupKey = groupKeyFor({ sectionReference: entry.section_reference, conceptKey, party });
    let provision = provisionsByGroupKey.get(groupKey);
    if (!provision) {
      provision = mintProvision({
        section, conceptKey, party, ordinal: provisionsByGroupKey.size + 1, admittedSourceContext, contractVocabulary,
      });
      provisionsByGroupKey.set(groupKey, provision);
    }

    const claimGroupKey = `${provision.provision_instance_id}::${registeredClaimDefinitionKey}`;
    const claimOrdinal = claimOrdinalCounters.get(claimGroupKey) || 0;
    claimOrdinalCounters.set(claimGroupKey, claimOrdinal + 1);

    // Attribute identity pin (spec section 1): day_kind, action_code,
    // prerequisite_code all participate in claim identity/closure via
    // `attributes` (rebuildClaim folds attributes into
    // CLAIM_REVISION_PAYLOAD_FIELDS) -- so two same-section claims (the
    // load-bearing case: two prerequisite codes asserted on ONE exception)
    // never collide or dedupe.
    const rebuiltClaim = rebuildClaim({
      originalClaim: claim,
      newSubjectOccurrenceId: provision.provision_instance_id,
      newClaimDefinitionKey: registeredClaimDefinitionKey,
      newOrdinal: claimOrdinal,
      newCanonicalValue: canonicalValue,
      attributesExtra: {
        ...extraAttributes,
        answer_provenance: buildMechanicalAnswerProvenance({}),
      },
    });

    const mapping = Object.freeze({
      generic_claim_key: genericKey,
      deterministic_kind: null,
      attachment_position: null,
      registered_claim_definition_key: registeredClaimDefinitionKey,
      concept_key: conceptKey,
      party_field: 'covenant_obligor',
      party_role: 'COVENANT_OBLIGOR',
    });

    finalizeResolvedCandidate({
      entry, provenance, genericKey, mapping, party, provision, rebuiltClaim, claimDefinition, defectMatch, materiality,
    });
  }

  function pushNoShopReview({
    entry, claim, conceptKey, registeredClaimDefinitionKey, reason, normalisedPhrase,
  }) {
    pushReviewUnresolved({
      entry,
      claimRow: claim,
      mapping: null,
      conceptFamily: conceptKey,
      reasons: [reason],
      materiality: materialityFor({ conceptKey, canonicalValue: null, claimDefinitionKey: registeredClaimDefinitionKey }),
      normalisedPhrase,
      attachmentPosition: null,
    });
  }

  function handleNoShopActionCandidate(entry) {
    const { candidate } = entry;
    const provenance = candidate.extraction_provenance;
    const claim = candidate.claim;
    const attrs = claim.attributes || {};
    const actionCode = typeof attrs.action_code === 'string' && attrs.action_code.length > 0 ? attrs.action_code : null;
    const normalisedPhrase = normaliseForMatching(claim.raw_value);
    const conceptKey = 'NOSOL-PROHIBIT';

    // Out-of-enum action_code: the enum is a gate, not a suggestion. A null
    // action_code (the model could not identify a fitting code) is NOT
    // out-of-enum -- it proceeds to corroboration below, which finds no
    // pattern to test and routes to review (mirrors the fee trigger's own
    // null-code precedent).
    if (actionCode && !NO_SHOP_ACTION_CODES.includes(actionCode)) {
      pushOpenWorld({ entry, claimRow: claim, reason: 'ACTION_CODE_OUT_OF_ENUM' });
      return;
    }

    const corroborated = actionCode ? noShopActionCorroborated(actionCode, claim.raw_value) : false;
    if (!corroborated) {
      pushNoShopReview({
        entry, claim, conceptKey, registeredClaimDefinitionKey: 'NO_SHOP_PROHIBITED_ACTION',
        reason: 'NO_SHOP_ACTION_UNCORROBORATED', normalisedPhrase,
      });
      return;
    }

    const partyMapping = Object.freeze({
      generic_claim_key: NO_SHOP_ACTION_CLAIM_KEY, deterministic_kind: null, attachment_position: null,
      registered_claim_definition_key: 'NO_SHOP_PROHIBITED_ACTION', concept_key: conceptKey,
      party_field: 'covenant_obligor', party_role: 'COVENANT_OBLIGOR',
    });
    const party = resolveParty({ attributes: claim.attributes, mapping: partyMapping });
    if (!party) {
      pushNoShopReview({
        entry, claim, conceptKey, registeredClaimDefinitionKey: 'NO_SHOP_PROHIBITED_ACTION',
        reason: 'PARTY_UNRESOLVED', normalisedPhrase,
      });
      return;
    }

    finalizeNoShopClaim({
      entry, claim, provenance, genericKey: NO_SHOP_ACTION_CLAIM_KEY,
      registeredClaimDefinitionKey: 'NO_SHOP_PROHIBITED_ACTION', conceptKey, party,
      canonicalValue: actionCode,
      extraAttributes: { action_code: actionCode },
    });
  }

  function handleNoShopExceptionPrerequisiteCandidate(entry) {
    const { candidate } = entry;
    const provenance = candidate.extraction_provenance;
    const claim = candidate.claim;
    const attrs = claim.attributes || {};
    const prerequisiteCode = typeof attrs.prerequisite_code === 'string' && attrs.prerequisite_code.length > 0
      ? attrs.prerequisite_code
      : null;
    const normalisedPhrase = normaliseForMatching(claim.raw_value);
    const conceptKey = 'NOSOL-EXCEPT';

    if (prerequisiteCode && !NO_SHOP_EXCEPTION_PREREQUISITE_CODES.includes(prerequisiteCode)) {
      pushOpenWorld({ entry, claimRow: claim, reason: 'PREREQUISITE_CODE_OUT_OF_ENUM' });
      return;
    }

    const corroborated = prerequisiteCode ? noShopPrerequisiteCorroborated(prerequisiteCode, claim.raw_value) : false;
    if (!corroborated) {
      pushNoShopReview({
        entry, claim, conceptKey, registeredClaimDefinitionKey: 'NO_SHOP_EXCEPTION_PREREQUISITE',
        reason: 'NO_SHOP_PREREQUISITE_UNCORROBORATED', normalisedPhrase,
      });
      return;
    }

    finalizeNoShopClaim({
      entry, claim, provenance, genericKey: NO_SHOP_EXCEPTION_PREREQUISITE_CLAIM_KEY,
      registeredClaimDefinitionKey: 'NO_SHOP_EXCEPTION_PREREQUISITE', conceptKey, party: NO_SHOP_COVENANT_OBLIGOR_PARTY,
      canonicalValue: prerequisiteCode,
      extraAttributes: { prerequisite_code: prerequisiteCode },
    });
  }

  // Shared by all three period generic keys (spec section 3: three keys
  // because the three roles resolve to three DIFFERENT concepts). The
  // genericKey/registeredClaimDefinitionKey/conceptKey are fixed by WHICH
  // key dispatched here -- period_role is read from the claim's own
  // attribute only to run the role-corroboration veto (spec section 4), it
  // never re-derives which key/concept this candidate belongs to (that was
  // already decided, mechanically, by anthropic-provider.js's shaping
  // layer).
  function handleNoShopPeriodCandidate(entry, { genericKey, registeredClaimDefinitionKey, conceptKey, periodRole }) {
    const { candidate } = entry;
    const provenance = candidate.extraction_provenance;
    const claim = candidate.claim;
    const normalisedPhrase = normaliseForMatching(claim.raw_value);

    // Period-role corroboration (spec section 4): a veto on the proposed
    // label, never a classifier -- only the role this candidate was
    // dispatched under is tested.
    if (!noShopPeriodRoleCorroborated(periodRole, claim.raw_value)) {
      pushNoShopReview({
        entry, claim, conceptKey, registeredClaimDefinitionKey,
        reason: 'NO_SHOP_PERIOD_ROLE_UNCORROBORATED', normalisedPhrase,
      });
      return;
    }

    const parseResult = parseNoShopPeriod(claim.raw_value);
    if (parseResult.outcome !== 'RESOLVED') {
      pushNoShopReview({
        entry, claim, conceptKey, registeredClaimDefinitionKey, reason: parseResult.reason, normalisedPhrase,
      });
      return;
    }

    // Attribute-verbatim defensive check (spec section 1's shared M-3
    // discipline): unit_phrase is derived directly FROM the byte-verified
    // quote by no-shop-period-parse.js, so this can never actually fail --
    // asserted anyway, typed, rather than assumed.
    if (!claim.raw_value.includes(parseResult.unit_phrase)) {
      pushNoShopReview({
        entry, claim, conceptKey, registeredClaimDefinitionKey,
        reason: 'PERIOD_UNIT_PHRASE_NOT_IN_QUOTE', normalisedPhrase,
      });
      return;
    }

    finalizeNoShopClaim({
      entry, claim, provenance, genericKey, registeredClaimDefinitionKey, conceptKey,
      party: NO_SHOP_COVENANT_OBLIGOR_PARTY,
      canonicalValue: parseResult.canonical_value,
      extraAttributes: {
        period_role: periodRole,
        day_kind: parseResult.day_kind,
        unit_phrase: parseResult.unit_phrase,
      },
    });
  }

  function handleNoShopWaveBCandidate(entry) {
    const { candidate } = entry;
    const provenance = candidate.extraction_provenance;
    const claim = candidate.claim;
    const attrs = claim.attributes || {};
    const assertionKind = attrs.assertion_kind;
    const canonicalValue = attrs.proposed_canonical_value;
    const normalisedPhrase = normaliseForMatching(claim.raw_value);

    if (!NO_SHOP_WAVE_B_ASSERTION_KINDS.includes(assertionKind)) {
      pushOpenWorld({ entry, claimRow: claim, reason: 'ASSERTION_KIND_OUT_OF_ENUM' });
      return;
    }
    const resolution = NO_SHOP_WAVE_B_RESOLUTION_MAP[assertionKind];
    if (!resolution.values.includes(canonicalValue)) {
      pushOpenWorld({ entry, claimRow: claim, reason: 'CANONICAL_VALUE_OUT_OF_ENUM' });
      return;
    }

    const conceptKey = assertionKind === 'STANDSTILL_ACTION'
      ? (canonicalValue === 'ENFORCE' || canonicalValue === 'NO_WAIVER_RELEASE_OR_MODIFICATION'
        ? 'NOSOL-ENFORCE'
        : 'NOSOL-WAIVER')
      : resolution.concept_key;
    const registeredClaimDefinitionKey = resolution.claim_definition_key;

    if (!noShopWaveBValueCorroborated(assertionKind, canonicalValue, claim.raw_value)) {
      pushNoShopReview({
        entry, claim, conceptKey, registeredClaimDefinitionKey,
        reason: `${assertionKind}_UNCORROBORATED`, normalisedPhrase,
      });
      return;
    }

    const covenantObligor = attrs.covenant_obligor;
    if (typeof covenantObligor !== 'string' || !claim.raw_value.includes(covenantObligor)) {
      pushNoShopReview({
        entry, claim, conceptKey, registeredClaimDefinitionKey,
        reason: 'COVENANT_OBLIGOR_NOT_IN_QUOTE', normalisedPhrase,
      });
      return;
    }
    const partyMapping = Object.freeze({
      generic_claim_key: NO_SHOP_WAVE_B_CLAIM_KEY,
      party_field: 'covenant_obligor',
      party_role: 'COVENANT_OBLIGOR',
    });
    const party = resolveParty({ attributes: attrs, mapping: partyMapping });
    if (!party) {
      pushNoShopReview({
        entry, claim, conceptKey, registeredClaimDefinitionKey,
        reason: 'PARTY_UNRESOLVED', normalisedPhrase,
      });
      return;
    }

    finalizeNoShopClaim({
      entry,
      claim,
      provenance,
      genericKey: NO_SHOP_WAVE_B_CLAIM_KEY,
      registeredClaimDefinitionKey,
      conceptKey,
      party,
      canonicalValue,
      extraAttributes: { assertion_kind: assertionKind },
    });
  }

  // -------------------------------------------------------------------
  // MAE-definition family (family-mae-definition slice, spec section 4,
  // AUDIT-AMENDED). Attribute-verbatim gates (M-3 discipline, spec
  // section 1's "typed DEFINED_TERM_REF_NOT_IN_QUOTE/CLAUSE_LABEL_NOT_IN_
  // QUOTE/CARVEBACK_CLAUSE_LABELS_NOT_IN_QUOTE"): defined_term_ref /
  // clause_label / each applies_to_clause_labels element / comparison_
  // baseline_phrase / incremental_impact_phrase (when present) must each
  // be a substring of the claim's own byte-verified quote. Ordering pin
  // (audit M-2): enum-membership is checked FIRST, before corroboration --
  // an out-of-enum code has no corroboration row.
  // -------------------------------------------------------------------

  function pushMaeReview({ entry, claim, reason, normalisedPhrase }) {
    pushReviewUnresolved({
      entry,
      claimRow: claim,
      mapping: null,
      conceptFamily: 'DEF-MAE',
      reasons: [reason],
      materiality: materialityFor({ conceptKey: 'DEF-MAE', canonicalValue: null, claimDefinitionKey: null }),
      normalisedPhrase,
      attachmentPosition: null,
    });
  }

  // Shared tail: vocabulary/section lookups, provision minting, claim
  // rebuild and finalizeResolvedCandidate -- mirrors finalizeNoShopClaim's
  // own precedent, plus the family-defining
  // MAE_DEFINITION_SELF_CONTAINMENT_UNPROVEN stamp on every resolved claim
  // (spec Deliverable).
  function finalizeMaeClaim({
    entry, claim, provenance, genericKey, registeredClaimDefinitionKey, canonicalValue, extraAttributes,
  }) {
    const conceptKey = 'DEF-MAE';
    const claimDefinition = vocabulary.claimDefinitions.get(registeredClaimDefinitionKey);
    if (!claimDefinition) {
      residuals.push(Object.freeze({
        residual_type: 'VOCABULARY_MISSING_MAPPED_CLAIM_DEFINITION',
        section_reference: entry.section_reference,
        generic_claim_key: genericKey,
        mapped_claim_definition_key: registeredClaimDefinitionKey,
      }));
      return;
    }
    if (!vocabulary.concepts.has(conceptKey)) {
      residuals.push(Object.freeze({
        residual_type: 'VOCABULARY_MISSING_MAPPED_CONCEPT',
        section_reference: entry.section_reference,
        generic_claim_key: genericKey,
        concept_key: conceptKey,
      }));
      return;
    }

    const attrs = claim.attributes || {};
    const definedTermRef = typeof attrs.defined_term_ref === 'string' ? attrs.defined_term_ref : null;
    const normalisedPhrase = normaliseForMatching(claim.raw_value);
    if (!definedTermRef) {
      // REQUIRED per spec section 1 ("REQUIRED, verbatim-substring-of-quote
      // enforced"); a missing defined_term_ref is not a corroboration
      // failure of a specific code, it is a structural absence -- typed the
      // same way for triage visibility.
      pushMaeReview({ entry, claim, reason: 'DEFINED_TERM_REF_NOT_IN_QUOTE', normalisedPhrase });
      return;
    }

    const section = sectionsByReference.get(entry.section_reference);
    if (!section) {
      residuals.push(Object.freeze({
        residual_type: 'SECTION_REFERENCE_UNRESOLVED_IN_RECEIPT',
        section_reference: entry.section_reference,
      }));
      return;
    }

    // defined_term_ref substring check runs against the GOVERNING SECTION's
    // own text, never the individual assertion's own narrow quote (unlike
    // clause_label/applies_to_clause_labels/comparison_baseline_phrase,
    // which ARE substrings of their own claim's quote). A prong or
    // disproportionality assertion's narrow text legitimately never repeats
    // the defined term -- the spec's own worked prong example (Metsera
    // "(i) has had ... taken as a whole") never contains "Company Material
    // Adverse Effect" -- so the P1 M-3 attribute-verbatim discipline is
    // honoured here against the section that actually states/defines the
    // term, which is the real evidentiary claim `defined_term_ref` makes.
    const sectionText = utf8Slice(admittedSourceContext.canonical_text.text, section.start, section.end);
    if (!sectionText.includes(definedTermRef)) {
      pushMaeReview({ entry, claim, reason: 'DEFINED_TERM_REF_NOT_IN_QUOTE', normalisedPhrase });
      return;
    }

    const partyMapping = Object.freeze({
      generic_claim_key: genericKey, deterministic_kind: null, attachment_position: null,
      registered_claim_definition_key: registeredClaimDefinitionKey, concept_key: conceptKey,
      party_field: 'definition_subject', party_role: 'DEFINITION_SUBJECT',
    });
    const party = resolveParty({ attributes: claim.attributes, mapping: partyMapping });
    if (!party) {
      // Party-neutral subjects ("any Party", the Concho Annex-A form) queue
      // PARTY_UNRESOLVED -- correct, not a defect (spec section 4: "a
      // bilateral definition genuinely binds both parties and which
      // statistics row it feeds is a Ben call, not a lexicon default").
      pushMaeReview({ entry, claim, reason: 'PARTY_UNRESOLVED', normalisedPhrase });
      return;
    }

    const materiality = materialityFor({
      conceptKey, canonicalValue, claimDefinitionKey: registeredClaimDefinitionKey,
    });
    const defectScope = Object.freeze({
      deal: dealKey,
      family: conceptKey,
      attribute: registeredClaimDefinitionKey,
      extraction_mechanism: provenance.extractor_id,
    });
    const defectMatch = matchesKnownDefect(knownDefectRegistry, defectScope);

    const groupKey = groupKeyFor({ sectionReference: entry.section_reference, conceptKey, party });
    let provision = provisionsByGroupKey.get(groupKey);
    if (!provision) {
      provision = mintProvision({
        section, conceptKey, party, ordinal: provisionsByGroupKey.size + 1, admittedSourceContext, contractVocabulary,
      });
      provisionsByGroupKey.set(groupKey, provision);
    }

    const claimGroupKey = `${provision.provision_instance_id}::${registeredClaimDefinitionKey}`;
    const claimOrdinal = claimOrdinalCounters.get(claimGroupKey) || 0;
    claimOrdinalCounters.set(claimGroupKey, claimOrdinal + 1);

    // Identity pin (spec section 4): defined_term_ref/clause_label/
    // carveout_code all participate in claim identity via `attributes`
    // (rebuildClaim folds attributes into CLAIM_REVISION_PAYLOAD_FIELDS) --
    // so two same-section claims differing only in defined_term_ref (Company
    // vs Parent MAE), or the same clause under two codes, never collide or
    // dedupe.
    const rebuiltClaim = rebuildClaim({
      originalClaim: claim,
      newSubjectOccurrenceId: provision.provision_instance_id,
      newClaimDefinitionKey: registeredClaimDefinitionKey,
      newOrdinal: claimOrdinal,
      newCanonicalValue: canonicalValue,
      attributesExtra: {
        ...extraAttributes,
        answer_provenance: buildMechanicalAnswerProvenance({}),
      },
    });

    const mapping = Object.freeze({
      generic_claim_key: genericKey,
      deterministic_kind: null,
      attachment_position: null,
      registered_claim_definition_key: registeredClaimDefinitionKey,
      concept_key: conceptKey,
      party_field: 'definition_subject',
      party_role: 'DEFINITION_SUBJECT',
    });

    finalizeResolvedCandidate({
      entry, provenance, genericKey, mapping, party, provision, rebuiltClaim, claimDefinition, defectMatch, materiality,
      extraUnevaluatedConditions: ['MAE_DEFINITION_SELF_CONTAINMENT_UNPROVEN'],
    });
  }

  function handleMaeCarveoutCandidate(entry) {
    const { candidate } = entry;
    const provenance = candidate.extraction_provenance;
    const claim = candidate.claim;
    const attrs = claim.attributes || {};
    const carveoutCode = typeof attrs.carveout_code === 'string' && attrs.carveout_code.length > 0
      ? attrs.carveout_code
      : null;
    const clauseLabel = typeof attrs.clause_label === 'string' ? attrs.clause_label : null;
    const normalisedPhrase = normaliseForMatching(claim.raw_value);

    // Out-of-enum carveout_code: explicit pushOpenWorld with a typed
    // reason (spec section 4 -- "the cyber-carve-out path ... is load-
    // bearing"), checked BEFORE corroboration (audit M-2 ordering pin).
    if (carveoutCode && !MAE_CARVEOUT_CODES.includes(carveoutCode)) {
      pushOpenWorld({ entry, claimRow: claim, reason: 'MAE_CARVEOUT_CODE_UNREGISTERED' });
      return;
    }

    if (clauseLabel && !claim.raw_value.includes(clauseLabel)) {
      pushMaeReview({ entry, claim, reason: 'CLAUSE_LABEL_NOT_IN_QUOTE', normalisedPhrase });
      return;
    }
    if (!clauseLabel) {
      pushMaeReview({ entry, claim, reason: 'CLAUSE_LABEL_NOT_IN_QUOTE', normalisedPhrase });
      return;
    }

    const corroborated = carveoutCode ? maeCarveoutCorroborated(carveoutCode, claim.raw_value) : false;
    if (!corroborated) {
      pushMaeReview({ entry, claim, reason: 'MAE_CARVEOUT_UNCORROBORATED', normalisedPhrase });
      return;
    }

    finalizeMaeClaim({
      entry, claim, provenance, genericKey: MAE_CARVEOUT_CLAIM_KEY,
      registeredClaimDefinitionKey: 'MAE_CARVEOUT',
      canonicalValue: carveoutCode,
      extraAttributes: {
        carveout_code: carveoutCode,
        clause_label: clauseLabel,
        limb_path: Array.isArray(attrs.limb_path) ? attrs.limb_path : [],
      },
    });
  }

  function handleMaeDefinitionProngCandidate(entry) {
    const { candidate } = entry;
    const provenance = candidate.extraction_provenance;
    const claim = candidate.claim;
    const attrs = claim.attributes || {};
    const prongCode = typeof attrs.prong_code === 'string' && attrs.prong_code.length > 0 ? attrs.prong_code : null;
    const prongLabel = typeof attrs.prong_label === 'string' ? attrs.prong_label : null;
    const normalisedPhrase = normaliseForMatching(claim.raw_value);

    if (!prongCode || !MAE_DEFINITION_PRONG_CODES.includes(prongCode)) {
      // prong_code has no null in the producer contract (mae-definition-
      // producer-prompt.js's own "no null" pin) -- an unrecognised value
      // reaching here is a provider-shaping bug, not a legitimate
      // out-of-enum signal the way carveout_code's OTHER-adjacent codes
      // are; route to review rather than open world, typed distinctly.
      pushMaeReview({ entry, claim, reason: 'MAE_PRONG_CODE_UNREGISTERED', normalisedPhrase });
      return;
    }
    // prong_label is OPTIONAL (spec section 1: "optional -- one-prong
    // definitions have no label"), substring-of-quote only when present.
    if (prongLabel && !claim.raw_value.includes(prongLabel)) {
      pushMaeReview({ entry, claim, reason: 'PRONG_LABEL_NOT_IN_QUOTE', normalisedPhrase });
      return;
    }

    const corroborated = maeDefinitionProngCorroborated(prongCode, claim.raw_value);
    if (!corroborated) {
      // Recurring prong-queue cost (spec "Known costs", audit m-4): a
      // BUSINESS_EFFECTS prong drafted without "taken as a whole" queues
      // here, by design.
      pushMaeReview({ entry, claim, reason: 'MAE_PRONG_UNCORROBORATED', normalisedPhrase });
      return;
    }

    finalizeMaeClaim({
      entry, claim, provenance, genericKey: MAE_DEFINITION_PRONG_CLAIM_KEY,
      registeredClaimDefinitionKey: 'MAE_DEFINITION_PRONG',
      canonicalValue: prongCode,
      extraAttributes: {
        prong_code: prongCode,
        prong_label: prongLabel,
        limb_path: Array.isArray(attrs.limb_path) ? attrs.limb_path : [],
      },
    });
  }

  function handleMaeDisproportionalityCandidate(entry) {
    const { candidate } = entry;
    const provenance = candidate.extraction_provenance;
    const claim = candidate.claim;
    const attrs = claim.attributes || {};
    const appliesToClauseLabels = Array.isArray(attrs.applies_to_clause_labels) ? attrs.applies_to_clause_labels : [];
    const comparisonBaselinePhrase = typeof attrs.comparison_baseline_phrase === 'string'
      ? attrs.comparison_baseline_phrase
      : null;
    const incrementalImpactPhrase = typeof attrs.incremental_impact_phrase === 'string'
      ? attrs.incremental_impact_phrase
      : null;
    const normalisedPhrase = normaliseForMatching(claim.raw_value);

    // Each applies_to_clause_labels element must individually be a
    // substring of the byte-verified quote (spec section 1).
    const badLabel = appliesToClauseLabels.find((label) => typeof label !== 'string' || !claim.raw_value.includes(label));
    if (badLabel !== undefined) {
      pushMaeReview({ entry, claim, reason: 'CARVEBACK_CLAUSE_LABELS_NOT_IN_QUOTE', normalisedPhrase });
      return;
    }
    // An empty array is NOT an error by itself (spec section 1: "a
    // carveback drafted without clause enumeration ... is a real form") --
    // but it routes to review typed CARVEBACK_SCOPE_UNENUMERATED, never
    // resolves silently as "applies to everything".
    if (appliesToClauseLabels.length === 0) {
      pushMaeReview({ entry, claim, reason: 'CARVEBACK_SCOPE_UNENUMERATED', normalisedPhrase });
      return;
    }
    if (!comparisonBaselinePhrase || !claim.raw_value.includes(comparisonBaselinePhrase)) {
      pushMaeReview({ entry, claim, reason: 'COMPARISON_BASELINE_PHRASE_NOT_IN_QUOTE', normalisedPhrase });
      return;
    }
    if (incrementalImpactPhrase && !claim.raw_value.includes(incrementalImpactPhrase)) {
      pushMaeReview({ entry, claim, reason: 'INCREMENTAL_IMPACT_PHRASE_NOT_IN_QUOTE', normalisedPhrase });
      return;
    }

    const corroborated = maeDisproportionalityCorroborated(claim.raw_value);
    if (!corroborated) {
      pushMaeReview({ entry, claim, reason: 'MAE_CARVEBACK_UNCORROBORATED', normalisedPhrase });
      return;
    }

    finalizeMaeClaim({
      entry, claim, provenance, genericKey: MAE_DISPROPORTIONALITY_CLAIM_KEY,
      registeredClaimDefinitionKey: 'MAE_DISPROPORTIONALITY_CARVEBACK',
      canonicalValue: true,
      extraAttributes: {
        applies_to_clause_labels: appliesToClauseLabels,
        comparison_baseline_phrase: comparisonBaselinePhrase,
        incremental_impact_phrase: incrementalImpactPhrase,
      },
    });
  }

  function pushRegulatoryReview({ entry, claim, reason, conceptFamily = ANTI_PENDING_CONCEPT_FAMILY }) {
    pushReviewUnresolved({ entry, claimRow: claim, mapping: null, conceptFamily, reasons: [reason], materiality: materialityFor({ conceptKey: conceptFamily }), normalisedPhrase: normaliseForMatching(claim.raw_value), attachmentPosition: null });
  }

  function finalizeRegulatoryClaim({ entry, claim, provenance, kindMap, party, canonicalValue, extraAttributes }) {
    const claimDefinition = vocabulary.claimDefinitions.get(kindMap.definition_key);
    if (!claimDefinition || !vocabulary.concepts.has(kindMap.concept_key)) {
      residuals.push(Object.freeze({ residual_type: 'VOCABULARY_MISSING_MAPPED_CLAIM_DEFINITION', section_reference: entry.section_reference, generic_claim_key: REGULATORY_EFFORTS_CLAIM_KEY, mapped_claim_definition_key: kindMap.definition_key }));
      return;
    }
    const section = sectionsByReference.get(entry.section_reference);
    if (!section) { residuals.push(Object.freeze({ residual_type: 'SECTION_REFERENCE_UNRESOLVED_IN_RECEIPT', section_reference: entry.section_reference })); return; }
    const groupKey = groupKeyFor({ sectionReference: entry.section_reference, conceptKey: kindMap.concept_key, party });
    let provision = provisionsByGroupKey.get(groupKey);
    if (!provision) { provision = mintProvision({ section, conceptKey: kindMap.concept_key, party, ordinal: provisionsByGroupKey.size + 1, admittedSourceContext, contractVocabulary }); provisionsByGroupKey.set(groupKey, provision); }
    const claimGroupKey = `${provision.provision_instance_id}::${kindMap.definition_key}`;
    const ordinal = claimOrdinalCounters.get(claimGroupKey) || 0;
    claimOrdinalCounters.set(claimGroupKey, ordinal + 1);
    const rebuiltClaim = rebuildClaim({ originalClaim: claim, newSubjectOccurrenceId: provision.provision_instance_id, newClaimDefinitionKey: kindMap.definition_key, newOrdinal: ordinal, newCanonicalValue: canonicalValue, attributesExtra: { ...extraAttributes, antitrust_regulatory_parse_version: ANTITRUST_REGULATORY_PARSE_VERSION, answer_provenance: buildMechanicalAnswerProvenance({}) } });
    const mapping = Object.freeze({ generic_claim_key: REGULATORY_EFFORTS_CLAIM_KEY, deterministic_kind: null, attachment_position: null, registered_claim_definition_key: kindMap.definition_key, concept_key: kindMap.concept_key, party_field: 'obligor_party', party_role: REGULATORY_COVENANT_OBLIGOR_ROLE });
    const defectMatch = matchesKnownDefect(knownDefectRegistry, Object.freeze({ deal: dealKey, family: kindMap.concept_key, attribute: kindMap.definition_key, extraction_mechanism: provenance.extractor_id }));
    finalizeResolvedCandidate({ entry, provenance, genericKey: REGULATORY_EFFORTS_CLAIM_KEY, mapping, party, provision, rebuiltClaim, claimDefinition, defectMatch, materiality: materialityFor({ conceptKey: kindMap.concept_key, canonicalValue, claimDefinitionKey: kindMap.definition_key }) });
  }

  function handleRegulatoryEffortsCandidate(entry) {
    const claim = entry.candidate.claim;
    const attrs = claim.attributes || {};
    const kind = typeof attrs.assertion_kind === 'string' ? attrs.assertion_kind : null;
    const kindMap = REGULATORY_ASSERTION_MAP[kind];
    if (!kindMap) { pushOpenWorld({ entry, claimRow: claim, reason: 'ASSERTION_KIND_OUT_OF_ENUM' }); return; }
    const quote = claim.raw_value;
    const proposedValue = attrs.proposed_canonical_value;
    const scope = attrs.obligor_party_scope;
    const ref = attrs.obligor_party;
    if (!ref || !quote.includes(ref)) { pushRegulatoryReview({ entry, claim, reason: 'OBLIGOR_REF_NOT_IN_QUOTE', conceptFamily: kindMap.concept_key }); return; }
    let party;
    if (scope === 'MUTUAL') {
      if (!REGULATORY_MUTUAL_OBLIGOR_PATTERN.test(quote)) { pushRegulatoryReview({ entry, claim, reason: 'OBLIGOR_SCOPE_UNCORROBORATED', conceptFamily: kindMap.concept_key }); return; }
      party = mintRegulatoryMutualParty(ref);
    } else if (scope === 'ONE_PARTY') {
      if (REGULATORY_MUTUAL_OBLIGOR_PATTERN.test(quote)) { pushRegulatoryReview({ entry, claim, reason: 'OBLIGOR_SCOPE_UNCORROBORATED', conceptFamily: kindMap.concept_key }); return; }
      party = resolveParty({ attributes: { obligor_party: ref }, mapping: { party_field: 'obligor_party', party_role: REGULATORY_COVENANT_OBLIGOR_ROLE } });
      if (!party) { pushRegulatoryReview({ entry, claim, reason: 'PARTY_UNRESOLVED', conceptFamily: kindMap.concept_key }); return; }
      if (!regulatoryObligorPositionCorroborated(quote, ref)) { pushRegulatoryReview({ entry, claim, reason: 'OBLIGOR_REF_UNCORROBORATED', conceptFamily: kindMap.concept_key }); return; }
    } else { pushOpenWorld({ entry, claimRow: claim, reason: 'OBLIGOR_SCOPE_OUT_OF_ENUM' }); return; }
    if (kind === 'HSR_FILING_DEADLINE' || kind === 'REGULATORY_FILING_DEADLINE') {
      if (!attrs.filing_regime_ref || !quote.includes(attrs.filing_regime_ref)) { pushRegulatoryReview({ entry, claim, reason: 'FILING_REGIME_REF_NOT_IN_QUOTE', conceptFamily: kindMap.concept_key }); return; }
      if (kind === 'HSR_FILING_DEADLINE' && attrs.filing_regime_ref !== 'HSR Act') { pushRegulatoryReview({ entry, claim, reason: 'NON_HSR_FILING_REGIME', conceptFamily: kindMap.concept_key }); return; }
      if (kind === 'REGULATORY_FILING_DEADLINE' && !regulatoryFilingRegimeCorroborated(attrs.filing_regime_ref, quote)) { pushRegulatoryReview({ entry, claim, reason: 'FILING_REGIME_NOT_SINGLE_NAMED_REGIME', conceptFamily: kindMap.concept_key }); return; }
      const parsed = parseFilingDeadlineDays(quote);
      if (parsed.outcome !== 'RESOLVED') { pushRegulatoryReview({ entry, claim, reason: parsed.reason, conceptFamily: kindMap.concept_key }); return; }
      const business = /business\s+days?/i.test(parsed.matched_text);
      if (!REGULATORY_DAY_KINDS.includes(attrs.day_kind) || (attrs.day_kind === 'BUSINESS' && !business) || (attrs.day_kind === 'CALENDAR' && business)) { pushRegulatoryReview({ entry, claim, reason: 'DAY_KIND_UNCORROBORATED', conceptFamily: kindMap.concept_key }); return; }
      finalizeRegulatoryClaim({ entry, claim, provenance: entry.candidate.extraction_provenance, kindMap, party, canonicalValue: parsed.canonical_value, extraAttributes: { obligor_party_scope: scope, obligor_party_ref: ref, day_kind: attrs.day_kind, filing_regime_ref: attrs.filing_regime_ref } }); return;
    }
    if (kind === 'REGULATORY_FILING_OBLIGATION') {
      if (!regulatoryFilingRegimeCorroborated(attrs.filing_regime_ref, quote)) { pushRegulatoryReview({ entry, claim, reason: 'FILING_REGIME_NOT_SINGLE_NAMED_REGIME', conceptFamily: kindMap.concept_key }); return; }
      const definition = vocabulary.claimDefinitions.get(kindMap.definition_key);
      if (!definition || !canonicalValueAllowed(definition, proposedValue) || !regulatoryValueCorroborated(kind, proposedValue, quote, attrs)) { pushRegulatoryReview({ entry, claim, reason: 'FILING_OBLIGATION_UNCORROBORATED', conceptFamily: kindMap.concept_key }); return; }
      finalizeRegulatoryClaim({ entry, claim, provenance: entry.candidate.extraction_provenance, kindMap, party, canonicalValue: proposedValue, extraAttributes: { obligor_party_scope: scope, obligor_party_ref: ref, filing_regime_ref: attrs.filing_regime_ref } }); return;
    }
    if (kind === 'DIVESTITURE_CAP_AMOUNT') {
      const parsed = parseDivestitureCapAmount(quote);
      if (parsed.outcome !== 'RESOLVED') { pushRegulatoryReview({ entry, claim, reason: parsed.reason, conceptFamily: kindMap.concept_key }); return; }
      finalizeRegulatoryClaim({ entry, claim, provenance: entry.candidate.extraction_provenance, kindMap, party, canonicalValue: parsed.canonical_value, extraAttributes: { obligor_party_scope: scope, obligor_party_ref: ref, currency: parsed.currency } }); return;
    }
    const definition = vocabulary.claimDefinitions.get(kindMap.definition_key);
    if (!definition || !canonicalValueAllowed(definition, proposedValue)) { pushOpenWorld({ entry, claimRow: claim, reason: 'CANONICAL_VALUE_OUT_OF_ENUM' }); return; }
    if (!regulatoryValueCorroborated(kind, proposedValue, quote, attrs)) { pushRegulatoryReview({ entry, claim, reason: `${kind}_UNCORROBORATED`, conceptFamily: kindMap.concept_key }); return; }
    if (kind === 'BURDEN_COMMITMENT' && proposedValue === 'BURDENSOME_CONDITION' && !attrs.burden_term_ref) { pushRegulatoryReview({ entry, claim, reason: 'BURDEN_TERM_REF_MISSING', conceptFamily: kindMap.concept_key }); return; }
    if (kind === 'BURDEN_COMMITMENT' && attrs.burden_term_ref && !quote.includes(attrs.burden_term_ref)) { pushRegulatoryReview({ entry, claim, reason: 'BURDEN_TERM_REF_NOT_IN_QUOTE', conceptFamily: kindMap.concept_key }); return; }
    if (kind === 'BURDEN_COMMITMENT' && attrs.burden_baseline && attrs.burden_baseline !== 'SIZE_NORMALIZED') { pushRegulatoryReview({ entry, claim, reason: 'BURDEN_BASELINE_UNCORROBORATED', conceptFamily: kindMap.concept_key }); return; }
    if (kind === 'BURDEN_COMMITMENT' && attrs.burden_baseline === 'SIZE_NORMALIZED' && !/business the size of|notionally/i.test(quote)) { pushRegulatoryReview({ entry, claim, reason: 'BURDEN_BASELINE_UNCORROBORATED', conceptFamily: kindMap.concept_key }); return; }
    finalizeRegulatoryClaim({ entry, claim, provenance: entry.candidate.extraction_provenance, kindMap, party, canonicalValue: proposedValue, extraAttributes: { obligor_party_scope: scope, obligor_party_ref: ref, ...(attrs.burden_term_ref ? { burden_term_ref: attrs.burden_term_ref } : {}), ...(attrs.burden_baseline ? { burden_baseline: attrs.burden_baseline } : {}) } });
  }

  // -------------------------------------------------------------------
  // Financing and guaranty. The two families share a narrow finaliser, but
  // never share concepts, value rules, or ungoverned attributes.
  function finalizeFinancingGuarantyClaim({ entry, claim, genericKey, conceptKey, definitionKey, canonicalValue, party, attributes }) {
    const claimDefinition = vocabulary.claimDefinitions.get(definitionKey);
    if (!claimDefinition || !vocabulary.concepts.has(conceptKey)) {
      residuals.push(Object.freeze({ residual_type: 'VOCABULARY_MISSING_MAPPED_CLAIM_DEFINITION', section_reference: entry.section_reference, generic_claim_key: genericKey, mapped_claim_definition_key: definitionKey }));
      return;
    }
    const section = sectionsByReference.get(entry.section_reference);
    if (!section) {
      residuals.push(Object.freeze({ residual_type: 'SECTION_REFERENCE_UNRESOLVED_IN_RECEIPT', section_reference: entry.section_reference }));
      return;
    }
    const groupKey = party
      ? groupKeyFor({ sectionReference: entry.section_reference, conceptKey, party })
      : structuralGroupKeyFor({ sectionReference: entry.section_reference, conceptKey });
    let provision = provisionsByGroupKey.get(groupKey);
    if (!provision) {
      provision = party
        ? mintProvision({ section, conceptKey, party, ordinal: provisionsByGroupKey.size + 1, admittedSourceContext, contractVocabulary })
        : mintStructuralProvision({ section, conceptKey, ordinal: provisionsByGroupKey.size + 1, admittedSourceContext, contractVocabulary });
      provisionsByGroupKey.set(groupKey, provision);
    }
    const claimGroupKey = `${provision.provision_instance_id}::${definitionKey}`;
    const claimOrdinal = claimOrdinalCounters.get(claimGroupKey) || 0;
    claimOrdinalCounters.set(claimGroupKey, claimOrdinal + 1);
    const rebuiltClaim = rebuildClaim({
      originalClaim: claim,
      newSubjectOccurrenceId: provision.provision_instance_id,
      newClaimDefinitionKey: definitionKey,
      newOrdinal: claimOrdinal,
      newCanonicalValue: canonicalValue,
      attributesReplace: Object.freeze({ ...attributes, answer_provenance: buildMechanicalAnswerProvenance({ extraPins: { gate: 'ALLOWED_VALUES_MEMBERSHIP' } }) }),
    });
    const mapping = Object.freeze({ generic_claim_key: genericKey, deterministic_kind: null, attachment_position: null, registered_claim_definition_key: definitionKey, concept_key: conceptKey, party_field: party ? 'obligor' : null, party_role: party ? 'FINANCING_COVENANT_OBLIGOR' : null });
    const materiality = materialityFor({ conceptKey, canonicalValue, claimDefinitionKey: definitionKey });
    const defectMatch = matchesKnownDefect(knownDefectRegistry, Object.freeze({ deal: dealKey, family: conceptKey, attribute: definitionKey, extraction_mechanism: entry.candidate.extraction_provenance.extractor_id }));
    finalizeResolvedCandidate({ entry, provenance: entry.candidate.extraction_provenance, genericKey, mapping, party, provision, rebuiltClaim, claimDefinition, defectMatch, materiality });
  }

  function reviewFinancingGuaranty({ entry, claim, reason, conceptKey, definitionKey }) {
    pushReviewUnresolved({
      entry, claimRow: claim,
      mapping: definitionKey ? Object.freeze({ registered_claim_definition_key: definitionKey, concept_key: conceptKey }) : null,
      conceptFamily: conceptKey,
      reasons: [reason],
      materiality: materialityFor({ conceptKey, canonicalValue: null, claimDefinitionKey: definitionKey }),
      normalisedPhrase: normaliseForMatching(claim.raw_value), attachmentPosition: null,
    });
  }

  function financingKindCorroborated(kind, quote) {
    const debt = /\bDebt (?:Financing|Commitment Letter)\b/.test(quote);
    const equity = /\b(?:Preferred )?Equity (?:Financing|Commitment Letter)\b/.test(quote);
    return (kind === 'DEBT' && debt && !equity)
      || (kind === 'EQUITY' && equity && !debt)
      || (kind === 'DEBT_AND_EQUITY' && debt && equity)
      || (kind === 'UNSPECIFIED' && /\bFinancing\b/.test(quote) && !debt && !equity);
  }

  function handleFinancingCandidate(entry) {
    const claim = entry.candidate.claim; const attrs = claim.attributes || {}; const quote = claim.raw_value;
    const map = Object.freeze({
      OBTAIN_EFFORTS: Object.freeze({ conceptKey: 'COV-FINANCING', definitionKey: 'FINANCING_OBTAIN_EFFORTS_STANDARD' }),
      COOPERATION_GRANT: Object.freeze({ conceptKey: 'COV-FINANCING', definitionKey: 'FINANCING_COOPERATION_PRESENT' }),
      NO_FINANCING_CONDITION_ACK: Object.freeze({ conceptKey: 'COV-FINANCING', definitionKey: 'NO_FINANCING_CONDITION_ACKNOWLEDGMENT' }),
      PAYOFF_LEAD_TIME: Object.freeze({ conceptKey: 'COV-PAYOFF', definitionKey: 'PAYOFF_DELIVERY_LEAD_TIME_DAYS' }),
      MARKETING_PERIOD_LENGTH: Object.freeze({ conceptKey: 'COV-MARKETING', definitionKey: 'MARKETING_PERIOD_LENGTH_DAYS' }),
    });
    const assertionKind = attrs.assertion_kind;
    if (!Object.hasOwn(map, assertionKind)) { pushOpenWorld({ entry, claimRow: claim, reason: 'FINANCING_ASSERTION_KIND_OUT_OF_VOCABULARY' }); return; }
    const target = map[assertionKind];
    const patterns = {
      OBTAIN_EFFORTS: /efforts/i.test(quote) && /\bobtain\b/i.test(quote),
      COOPERATION_GRANT: /cooperation/i.test(quote),
      NO_FINANCING_CONDITION_ACK: /is not a condition to/i.test(quote),
      PAYOFF_LEAD_TIME: /payoff/i.test(quote),
      MARKETING_PERIOD_LENGTH: /\bMarketing\s{1,3}Period\b/.test(quote) && /\bconsecutive\b/i.test(quote) && /first period of/i.test(quote),
    };
    if (!patterns[assertionKind]) { reviewFinancingGuaranty({ entry, claim, reason: 'ASSERTION_KIND_UNCORROBORATED', ...target }); return; }
    const financingKinds = ['DEBT', 'EQUITY', 'DEBT_AND_EQUITY', 'UNSPECIFIED'];
    const needsFinancingKind = ['OBTAIN_EFFORTS', 'COOPERATION_GRANT', 'NO_FINANCING_CONDITION_ACK'].includes(assertionKind);
    if (needsFinancingKind && !financingKinds.includes(attrs.financing_kind)) { pushOpenWorld({ entry, claimRow: claim, reason: 'FINANCING_SCOPE_OUT_OF_VOCABULARY' }); return; }
    if (needsFinancingKind && !financingKindCorroborated(attrs.financing_kind, quote)) { reviewFinancingGuaranty({ entry, claim, reason: 'FINANCING_SCOPE_UNCORROBORATED', ...target }); return; }
    let party = null; let canonicalValue; let cleanAttributes;
    if (assertionKind === 'OBTAIN_EFFORTS' || assertionKind === 'COOPERATION_GRANT') {
      if (typeof attrs.obligor !== 'string' || !quote.includes(attrs.obligor) || !new RegExp(`${attrs.obligor.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}[, ]+shall`, 'i').test(quote)) { reviewFinancingGuaranty({ entry, claim, reason: 'OBLIGOR_REF_UNCORROBORATED', ...target }); return; }
      party = resolveParty({ attributes: attrs, mapping: { party_field: 'obligor', party_role: 'FINANCING_COVENANT_OBLIGOR' } });
      if (!party) { reviewFinancingGuaranty({ entry, claim, reason: 'PARTY_UNRESOLVED', ...target }); return; }
    }
    if (assertionKind === 'OBTAIN_EFFORTS') {
      if (!['REASONABLE_BEST_EFFORTS', 'COMMERCIALLY_REASONABLE_EFFORTS'].includes(attrs.standard_code)) { pushOpenWorld({ entry, claimRow: claim, reason: 'EFFORTS_STANDARD_OUT_OF_VOCABULARY' }); return; }
      const rbe = /reasonable best efforts/i.test(quote); const cre = /commercially reasonable efforts/i.test(quote);
      if ((rbe && cre) || !(attrs.standard_code === 'REASONABLE_BEST_EFFORTS' ? rbe : cre)) { reviewFinancingGuaranty({ entry, claim, reason: rbe && cre ? 'AMBIGUOUS_EFFORTS_STANDARD' : 'EFFORTS_STANDARD_UNCORROBORATED', ...target }); return; }
      canonicalValue = attrs.standard_code; cleanAttributes = { financing_kind: attrs.financing_kind, obligor_ref: attrs.obligor, standard_code: attrs.standard_code };
    } else if (assertionKind === 'COOPERATION_GRANT') { canonicalValue = true; cleanAttributes = { financing_kind: attrs.financing_kind, obligor_ref: attrs.obligor }; }
    else if (assertionKind === 'NO_FINANCING_CONDITION_ACK') { canonicalValue = true; cleanAttributes = { financing_kind: attrs.financing_kind }; }
    else {
      const parsed = parseFinancingDayCount(quote);
      if (parsed.outcome !== 'RESOLVED') { reviewFinancingGuaranty({ entry, claim, reason: parsed.reason, ...target }); return; }
      const business = /business days?/i.test(parsed.matched_text);
      if (!['BUSINESS', 'CALENDAR'].includes(attrs.day_kind) || (attrs.day_kind === 'BUSINESS') !== business) { reviewFinancingGuaranty({ entry, claim, reason: 'DAY_KIND_UNCORROBORATED', ...target }); return; }
      if (assertionKind === 'PAYOFF_LEAD_TIME') {
        if (!['FINAL', 'DRAFT'].includes(attrs.delivery_stage) || typeof attrs.deliverable_term !== 'string' || !parsed.matched_text.includes(attrs.deliverable_term) || ((attrs.delivery_stage === 'DRAFT') !== /draft/i.test(parsed.matched_text))) { reviewFinancingGuaranty({ entry, claim, reason: 'DELIVERY_STAGE_UNCORROBORATED', ...target }); return; }
        cleanAttributes = { day_kind: attrs.day_kind, delivery_stage: attrs.delivery_stage, deliverable_term_ref: attrs.deliverable_term };
      } else {
        if (attrs.day_kind !== 'BUSINESS' || typeof attrs.marketing_term !== 'string' || !quote.includes(attrs.marketing_term)) { reviewFinancingGuaranty({ entry, claim, reason: 'MARKETING_TERM_UNCORROBORATED', ...target }); return; }
        cleanAttributes = { day_kind: attrs.day_kind, marketing_term_ref: attrs.marketing_term };
      }
      canonicalValue = parsed.canonical_value;
    }
    finalizeFinancingGuarantyClaim({ entry, claim, genericKey: FINANCING_COVENANT_CLAIM_KEY, ...target, canonicalValue, party, attributes: cleanAttributes });
  }

  function handleGuarantyCandidate(entry) {
    const claim = entry.candidate.claim; const attrs = claim.attributes || {}; const quote = claim.raw_value;
    const kindMap = Object.freeze({ PERFORMANCE_GUARANTY: Object.freeze({ conceptKey: 'GTY-PERF', definitionKey: 'PARENT_PERFORMANCE_GUARANTY' }), GUARANTY_DELIVERED: Object.freeze({ conceptKey: 'GTY-DELIVERY', definitionKey: 'LIMITED_GUARANTY_DELIVERED' }), GUARANTY_IN_EFFECT: Object.freeze({ conceptKey: 'GTY-DELIVERY', definitionKey: 'LIMITED_GUARANTY_IN_EFFECT' }) });
    const assertionKind = attrs.assertion_kind;
    if (!Object.hasOwn(kindMap, assertionKind)) { pushOpenWorld({ entry, claimRow: claim, reason: 'GTY_ASSERTION_KIND_OUT_OF_VOCABULARY' }); return; }
    const target = kindMap[assertionKind]; const corroboration = corroborateGuarantyKind({ quote, asserted_kind: assertionKind });
    if (corroboration.outcome === 'OPEN_WORLD') { pushOpenWorld({ entry, claimRow: claim, reason: corroboration.reason }); return; }
    if (corroboration.outcome !== 'RESOLVED') { reviewFinancingGuaranty({ entry, claim, reason: corroboration.reason, ...target }); return; }
    if (typeof attrs.guarantor_ref !== 'string' || !quote.includes(attrs.guarantor_ref)) { reviewFinancingGuaranty({ entry, claim, reason: 'GUARANTOR_REF_NOT_IN_QUOTE', ...target }); return; }
    if (assertionKind !== 'PERFORMANCE_GUARANTY' && attrs.obligor_ref != null) { reviewFinancingGuaranty({ entry, claim, reason: 'OBLIGOR_REF_NOT_PERMITTED', ...target }); return; }
    if (assertionKind === 'PERFORMANCE_GUARANTY' && attrs.obligor_ref != null && (typeof attrs.obligor_ref !== 'string' || !quote.includes(attrs.obligor_ref))) { reviewFinancingGuaranty({ entry, claim, reason: 'OBLIGOR_REF_NOT_IN_QUOTE', ...target }); return; }
    finalizeFinancingGuarantyClaim({ entry, claim, genericKey: GUARANTY_CLAIM_KEY, ...target, canonicalValue: true, party: null, attributes: { guarantor_ref: attrs.guarantor_ref, ...(assertionKind === 'PERFORMANCE_GUARANTY' && attrs.obligor_ref ? { obligor_ref: attrs.obligor_ref } : {}) } });
  }

  // -------------------------------------------------------------------
  // Termination-RIGHTS family (family-termination-rights slice, spec
  // section 4, AUDIT-AMENDED). Handler order (the SHARE_COUNT/TEMPORAL
  // pattern): party-ref verbatim check -> trigger_kind corroboration ->
  // party-scope corroboration -> attribute verbatim checks -> assertion/
  // trigger coherence -> per-assertion_kind branch.
  // -------------------------------------------------------------------

  function pushTerminationReview({
    entry, claim, reason, normalisedPhrase, conceptFamily = 'TERMR-PENDING',
  }) {
    pushReviewUnresolved({
      entry,
      claimRow: claim,
      mapping: null,
      conceptFamily,
      reasons: [reason],
      materiality: materialityFor({ conceptKey: 'TERMR-', canonicalValue: null, claimDefinitionKey: null }),
      normalisedPhrase,
      attachmentPosition: null,
    });
  }

  // Shared tail: vocabulary/section lookups, provision minting, claim
  // rebuild and finalizeResolvedCandidate -- mirrors finalizeMaeClaim's own
  // precedent. `party` is ALWAYS supplied fully resolved by the caller
  // (either via resolveParty for ONE_PARTY, or minted directly via
  // mintEitherPrincipalParty for EITHER_PARTY) -- this tail never resolves
  // a party itself.
  function finalizeTerminationClaim({
    entry, claim, provenance, genericKey, registeredClaimDefinitionKey, conceptKey, party, canonicalValue, extraAttributes,
  }) {
    const claimDefinition = vocabulary.claimDefinitions.get(registeredClaimDefinitionKey);
    if (!claimDefinition) {
      residuals.push(Object.freeze({
        residual_type: 'VOCABULARY_MISSING_MAPPED_CLAIM_DEFINITION',
        section_reference: entry.section_reference,
        generic_claim_key: genericKey,
        mapped_claim_definition_key: registeredClaimDefinitionKey,
      }));
      return;
    }
    if (!vocabulary.concepts.has(conceptKey)) {
      residuals.push(Object.freeze({
        residual_type: 'VOCABULARY_MISSING_MAPPED_CONCEPT',
        section_reference: entry.section_reference,
        generic_claim_key: genericKey,
        concept_key: conceptKey,
      }));
      return;
    }
    const section = sectionsByReference.get(entry.section_reference);
    if (!section) {
      residuals.push(Object.freeze({
        residual_type: 'SECTION_REFERENCE_UNRESOLVED_IN_RECEIPT',
        section_reference: entry.section_reference,
      }));
      return;
    }

    const materiality = materialityFor({
      conceptKey, canonicalValue, claimDefinitionKey: registeredClaimDefinitionKey,
    });
    const defectScope = Object.freeze({
      deal: dealKey,
      family: conceptKey,
      attribute: registeredClaimDefinitionKey,
      extraction_mechanism: provenance.extractor_id,
    });
    const defectMatch = matchesKnownDefect(knownDefectRegistry, defectScope);

    const groupKey = groupKeyFor({ sectionReference: entry.section_reference, conceptKey, party });
    let provision = provisionsByGroupKey.get(groupKey);
    if (!provision) {
      provision = mintProvision({
        section, conceptKey, party, ordinal: provisionsByGroupKey.size + 1, admittedSourceContext, contractVocabulary,
      });
      provisionsByGroupKey.set(groupKey, provision);
    }

    const claimGroupKey = `${provision.provision_instance_id}::${registeredClaimDefinitionKey}`;
    const claimOrdinal = claimOrdinalCounters.get(claimGroupKey) || 0;
    claimOrdinalCounters.set(claimGroupKey, claimOrdinal + 1);

    // Identity pin (spec section 5's "Identity" acceptance test): trigger_
    // kind, terminating_party_scope and (for CURE_PERIOD) period_kind all
    // participate in claim identity via `attributes` (rebuildClaim folds
    // attributes into CLAIM_REVISION_PAYLOAD_FIELDS) -- so two same-
    // section rights differing only in trigger_kind or scope, buyer-breach
    // vs target-breach cure claims, and a CURE claim vs a NOTICE claim in
    // the same section, never collide or dedupe.
    const rebuiltClaim = rebuildClaim({
      originalClaim: claim,
      newSubjectOccurrenceId: provision.provision_instance_id,
      newClaimDefinitionKey: registeredClaimDefinitionKey,
      newOrdinal: claimOrdinal,
      newCanonicalValue: canonicalValue,
      attributesExtra: {
        ...extraAttributes,
        answer_provenance: buildMechanicalAnswerProvenance({}),
      },
    });

    const mapping = Object.freeze({
      generic_claim_key: genericKey,
      deterministic_kind: null,
      attachment_position: null,
      registered_claim_definition_key: registeredClaimDefinitionKey,
      concept_key: conceptKey,
      party_field: 'terminating_party',
      party_role: TERMINATION_RIGHT_HOLDER_ROLE,
    });

    finalizeResolvedCandidate({
      entry, provenance, genericKey, mapping, party, provision, rebuiltClaim, claimDefinition, defectMatch, materiality,
    });
  }

  function handleTerminationRightCandidate(entry) {
    const { candidate } = entry;
    const provenance = candidate.extraction_provenance;
    const claim = candidate.claim;
    const attrs = claim.attributes || {};
    const quote = claim.raw_value;
    const normalisedPhrase = normaliseForMatching(quote);

    const assertionKind = typeof attrs.assertion_kind === 'string' ? attrs.assertion_kind : null;
    const triggerKind = typeof attrs.trigger_kind === 'string' && attrs.trigger_kind.length > 0 ? attrs.trigger_kind : null;
    const partyScope = typeof attrs.terminating_party_scope === 'string' ? attrs.terminating_party_scope : null;
    const terminatingPartyRef = typeof attrs.terminating_party === 'string' && attrs.terminating_party.length > 0
      ? attrs.terminating_party
      : null;
    const deadlineTermRef = typeof attrs.deadline_term === 'string' && attrs.deadline_term.length > 0 ? attrs.deadline_term : null;
    const dayKind = typeof attrs.day_kind === 'string' ? attrs.day_kind : null;
    const periodKind = typeof attrs.period_kind === 'string' ? attrs.period_kind : null;

    // The enum is a gate, not a suggestion (spec section 3/4).
    if (!assertionKind || !TERMINATION_ASSERTION_KINDS.includes(assertionKind)) {
      pushOpenWorld({ entry, claimRow: claim, reason: 'ASSERTION_KIND_OUT_OF_ENUM' });
      return;
    }
    if (triggerKind && !TERMINATION_TRIGGER_KINDS.includes(triggerKind)) {
      pushOpenWorld({ entry, claimRow: claim, reason: 'TRIGGER_KIND_OUT_OF_ENUM' });
      return;
    }

    // terminating_party (verbatim ref) is REQUIRED for both RIGHT_GRANT and
    // CURE_PERIOD (spec section 3: "REQUIRED for both ... CURE_PERIOD
    // inherits the same terminating party"); missing or not a verbatim
    // substring of the byte-verified quote -> review, typed
    // TERMINATING_PARTY_REF_NOT_IN_QUOTE (spec section 1).
    if (!terminatingPartyRef || !quote.includes(terminatingPartyRef)) {
      pushTerminationReview({ entry, claim, reason: 'TERMINATING_PARTY_REF_NOT_IN_QUOTE', normalisedPhrase });
      return;
    }

    // Trigger-kind corroboration (spec section 4): a NULL trigger_kind (the
    // model could not identify the ground) and an in-enum-but-uncorroborated
    // trigger_kind both fall through the same corroboration check, which
    // fails for null (no pattern to test) exactly as it should.
    if (!terminationTriggerKindCorroborated(triggerKind, quote)) {
      pushTerminationReview({ entry, claim, reason: 'TRIGGER_KIND_UNCORROBORATED', normalisedPhrase });
      return;
    }
    const conceptKey = TERMINATION_TRIGGER_KIND_TO_CONCEPT[triggerKind];

    // Party-scope corroboration (spec section 4). Ordering pin: the
    // either-check runs FIRST -- "by either Parent or the Company" contains
    // both one-sided party words, and first-match party resolution would
    // silently mint a one-sided right from a mutual quote.
    const eitherMatch = TERMINATION_EITHER_PARTY_PATTERN.test(quote);
    let party;
    if (partyScope === 'EITHER_PARTY') {
      if (!eitherMatch) {
        pushTerminationReview({ entry, claim, reason: 'PARTY_SCOPE_UNCORROBORATED', normalisedPhrase, conceptFamily: conceptKey });
        return;
      }
      // EITHER_PARTY claims do not call resolveParty (spec section 4: "it
      // resolves one party; a mutual right has two").
      party = mintEitherPrincipalParty(terminatingPartyRef);
    } else if (partyScope === 'ONE_PARTY') {
      if (eitherMatch) {
        pushTerminationReview({ entry, claim, reason: 'PARTY_SCOPE_UNCORROBORATED', normalisedPhrase, conceptFamily: conceptKey });
        return;
      }
      const partyMapping = Object.freeze({
        generic_claim_key: TERMINATION_RIGHT_CLAIM_KEY, deterministic_kind: null, attachment_position: null,
        registered_claim_definition_key: null, concept_key: conceptKey,
        party_field: 'terminating_party', party_role: TERMINATION_RIGHT_HOLDER_ROLE,
      });
      const resolvedParty = resolveParty({ attributes: { terminating_party: terminatingPartyRef }, mapping: partyMapping });
      if (!resolvedParty) {
        pushTerminationReview({ entry, claim, reason: 'PARTY_UNRESOLVED', normalisedPhrase, conceptFamily: conceptKey });
        return;
      }
      // The positional gate (audit C-2): stops the -T/-B inversion trap --
      // see terminatingPartyPositionCorroborated's own header note.
      if (!terminatingPartyPositionCorroborated(quote, terminatingPartyRef)) {
        pushTerminationReview({ entry, claim, reason: 'TERMINATING_PARTY_REF_UNCORROBORATED', normalisedPhrase, conceptFamily: conceptKey });
        return;
      }
      party = resolvedParty;
    } else {
      pushOpenWorld({ entry, claimRow: claim, reason: 'PARTY_SCOPE_OUT_OF_ENUM' });
      return;
    }

    // Attribute verbatim checks (spec section 1): deadline_term_ref is
    // REQUIRED for OUTSIDE_DATE assertions, verbatim-substring-enforced.
    if (assertionKind === 'OUTSIDE_DATE') {
      if (!deadlineTermRef || !quote.includes(deadlineTermRef)) {
        pushTerminationReview({ entry, claim, reason: 'DEADLINE_TERM_REF_NOT_IN_QUOTE', normalisedPhrase, conceptFamily: conceptKey });
        return;
      }
    }

    // Assertion/trigger coherence (spec section 4): OUTSIDE_DATE assertions
    // with trigger_kind != OUTSIDE_DATE, and CURE_PERIOD assertions with
    // trigger_kind not in {BREACH, NO_SOLICITATION_BREACH} -> review, typed
    // ASSERTION_TRIGGER_INCOHERENT (a cure period hanging off a mutual-
    // consent right is a label error, not a resolvable claim).
    if (assertionKind === 'OUTSIDE_DATE' && triggerKind !== 'OUTSIDE_DATE') {
      pushTerminationReview({ entry, claim, reason: 'ASSERTION_TRIGGER_INCOHERENT', normalisedPhrase, conceptFamily: conceptKey });
      return;
    }
    if (assertionKind === 'CURE_PERIOD' && triggerKind !== 'BREACH' && triggerKind !== 'NO_SOLICITATION_BREACH') {
      pushTerminationReview({ entry, claim, reason: 'ASSERTION_TRIGGER_INCOHERENT', normalisedPhrase, conceptFamily: conceptKey });
      return;
    }

    // Per-assertion_kind branch (spec section 4).
    if (assertionKind === 'RIGHT_GRANT') {
      finalizeTerminationClaim({
        entry, claim, provenance, genericKey: TERMINATION_RIGHT_CLAIM_KEY,
        registeredClaimDefinitionKey: 'TERMINATION_RIGHT_GRANT', conceptKey, party,
        canonicalValue: true,
        extraAttributes: {
          trigger_kind: triggerKind,
          terminating_party_scope: partyScope,
          terminating_party_ref: terminatingPartyRef,
        },
      });
      return;
    }

    if (assertionKind === 'OUTSIDE_DATE') {
      const parseResult = parseTerminationDeadline(quote);
      if (parseResult.outcome !== 'RESOLVED') {
        pushTerminationReview({ entry, claim, reason: parseResult.reason, normalisedPhrase, conceptFamily: conceptKey });
        return;
      }
      finalizeTerminationClaim({
        entry, claim, provenance, genericKey: TERMINATION_RIGHT_CLAIM_KEY,
        registeredClaimDefinitionKey: 'TERMINATION_OUTSIDE_DATE', conceptKey, party,
        canonicalValue: parseResult.iso_date,
        extraAttributes: {
          trigger_kind: triggerKind,
          terminating_party_scope: partyScope,
          terminating_party_ref: terminatingPartyRef,
          deadline_term_ref: deadlineTermRef,
          termination_deadline_parse_version: TERMINATION_DEADLINE_PARSE_VERSION,
        },
      });
      return;
    }

    // CURE_PERIOD.
    const parseResult = parseCurePeriod(quote);
    if (parseResult.outcome !== 'RESOLVED') {
      pushTerminationReview({ entry, claim, reason: parseResult.reason, normalisedPhrase, conceptFamily: conceptKey });
      return;
    }

    // day_kind corroboration (spec section 4): BUSINESS requires
    // /business day/i inside the parser's matched_text; CALENDAR requires
    // its absence.
    const businessDayPresent = /business\s+days?/i.test(parseResult.matched_text);
    if (!dayKind || !TERMINATION_DAY_KINDS.includes(dayKind)
      || (dayKind === 'BUSINESS' && !businessDayPresent)
      || (dayKind === 'CALENDAR' && businessDayPresent)) {
      pushTerminationReview({ entry, claim, reason: 'DAY_KIND_UNCORROBORATED', normalisedPhrase, conceptFamily: conceptKey });
      return;
    }

    // period_kind corroboration (spec section 4, audit M-1): CURE requires
    // a cure verb governing the count; NOTICE requires the notice-delivery
    // shape with NO cure verb governing the count.
    const cureVerbPresent = /\bcured?\s+within\b|\bcure\b/i.test(parseResult.matched_text);
    const noticeShapePresent = /\bnotice\b[\s\S]{0,120}?\bprior to\b/i.test(parseResult.matched_text);
    const cureCorroborated = cureVerbPresent;
    const noticeCorroborated = noticeShapePresent && !cureVerbPresent;
    if (!periodKind || !TERMINATION_PERIOD_KINDS.includes(periodKind)
      || (periodKind === 'CURE' && !cureCorroborated)
      || (periodKind === 'NOTICE' && !noticeCorroborated)) {
      pushTerminationReview({ entry, claim, reason: 'PERIOD_KIND_UNCORROBORATED', normalisedPhrase, conceptFamily: conceptKey });
      return;
    }

    finalizeTerminationClaim({
      entry, claim, provenance, genericKey: TERMINATION_RIGHT_CLAIM_KEY,
      registeredClaimDefinitionKey: 'TERMINATION_CURE_PERIOD_DAYS', conceptKey, party,
      canonicalValue: parseResult.canonical_value,
      extraAttributes: {
        trigger_kind: triggerKind,
        terminating_party_scope: partyScope,
        terminating_party_ref: terminatingPartyRef,
        day_kind: dayKind,
        period_kind: periodKind,
        cure_period_parse_version: CURE_PERIOD_PARSE_VERSION,
      },
    });
  }

  function pushConsiderationReview({
    entry, claim, reason, conceptKey, claimDefinitionKey, canonicalValue = null, attributesExtra = {},
  }) {
    const reviewedClaim = Object.freeze({
      ...claim,
      canonical_value: canonicalValue,
      attributes: Object.freeze({ ...(claim.attributes || {}), ...attributesExtra }),
    });
    pushReviewUnresolved({
      entry,
      claimRow: reviewedClaim,
      mapping: Object.freeze({
        registered_claim_definition_key: claimDefinitionKey,
        concept_key: conceptKey,
      }),
      conceptFamily: conceptKey,
      reasons: [reason],
      materiality: materialityFor({
        conceptKey,
        canonicalValue,
        claimDefinitionKey,
      }),
      normalisedPhrase: normaliseForMatching(claim.raw_value),
      attachmentPosition: null,
    });
  }

  function finalizeConsiderationClaim({
    entry, claim, provenance, registeredClaimDefinitionKey, conceptKey, canonicalValue, extraAttributes,
  }) {
    const claimDefinition = vocabulary.claimDefinitions.get(registeredClaimDefinitionKey);
    if (!claimDefinition) {
      residuals.push(Object.freeze({
        residual_type: 'VOCABULARY_MISSING_MAPPED_CLAIM_DEFINITION',
        section_reference: entry.section_reference,
        generic_claim_key: CONSIDERATION_CLAIM_KEY,
        mapped_claim_definition_key: registeredClaimDefinitionKey,
      }));
      return;
    }
    if (!vocabulary.concepts.has(conceptKey)) {
      residuals.push(Object.freeze({
        residual_type: 'VOCABULARY_MISSING_MAPPED_CONCEPT',
        section_reference: entry.section_reference,
        generic_claim_key: CONSIDERATION_CLAIM_KEY,
        concept_key: conceptKey,
      }));
      return;
    }
    const section = sectionsByReference.get(entry.section_reference);
    if (!section) {
      residuals.push(Object.freeze({
        residual_type: 'SECTION_REFERENCE_UNRESOLVED_IN_RECEIPT',
        section_reference: entry.section_reference,
      }));
      return;
    }

    const materiality = materialityFor({
      conceptKey,
      canonicalValue,
      claimDefinitionKey: registeredClaimDefinitionKey,
    });
    const defectMatch = matchesKnownDefect(knownDefectRegistry, Object.freeze({
      deal: dealKey,
      family: conceptKey,
      attribute: registeredClaimDefinitionKey,
      extraction_mechanism: provenance.extractor_id,
    }));
    const groupKey = structuralGroupKeyFor({ sectionReference: entry.section_reference, conceptKey });
    let provision = provisionsByGroupKey.get(groupKey);
    if (!provision) {
      provision = mintStructuralProvision({
        section,
        conceptKey,
        ordinal: 1,
        admittedSourceContext,
        contractVocabulary,
      });
      provisionsByGroupKey.set(groupKey, provision);
    }

    const claimGroupKey = `${provision.provision_instance_id}::${registeredClaimDefinitionKey}`;
    const claimOrdinal = claimOrdinalCounters.get(claimGroupKey) || 0;
    claimOrdinalCounters.set(claimGroupKey, claimOrdinal + 1);
    const rebuiltClaim = rebuildClaim({
      originalClaim: claim,
      newSubjectOccurrenceId: provision.provision_instance_id,
      newClaimDefinitionKey: registeredClaimDefinitionKey,
      newOrdinal: claimOrdinal,
      newCanonicalValue: canonicalValue,
      attributesExtra: {
        ...extraAttributes,
        answer_provenance: buildMechanicalAnswerProvenance({}),
      },
    });
    const mapping = Object.freeze({
      generic_claim_key: CONSIDERATION_CLAIM_KEY,
      deterministic_kind: null,
      attachment_position: null,
      registered_claim_definition_key: registeredClaimDefinitionKey,
      concept_key: conceptKey,
      party_field: null,
      party_role: null,
    });
    finalizeResolvedCandidate({
      entry,
      provenance,
      genericKey: CONSIDERATION_CLAIM_KEY,
      mapping,
      party: null,
      provision,
      rebuiltClaim,
      claimDefinition,
      defectMatch,
      materiality,
    });
  }

  function handleConsiderationCandidate(entry) {
    const { candidate } = entry;
    const provenance = candidate.extraction_provenance;
    const claim = candidate.claim;
    const attrs = claim.attributes || {};
    const quote = claim.raw_value;
    const assertionKind = typeof attrs.assertion_kind === 'string' ? attrs.assertion_kind : null;

    if (!assertionKind || !CONSIDERATION_ASSERTION_KINDS.includes(assertionKind)) {
      pushOpenWorld({ entry, claimRow: claim, reason: 'ASSERTION_KIND_OUT_OF_ENUM' });
      return;
    }
    const resolution = CONSIDERATION_RESOLUTION_MAP[assertionKind];
    const conceptKey = resolution.concept_key;
    const claimDefinitionKey = resolution.claim_definition_key;
    const review = (reason) => pushConsiderationReview({
      entry, claim, reason, conceptKey, claimDefinitionKey,
    });

    if (assertionKind === 'PER_SHARE_CASH') {
      if (!perShareContextCorroborated(quote)) {
        review('PER_SHARE_CONTEXT_UNCORROBORATED');
        return;
      }
      const considerationTermRef = typeof attrs.consideration_term_ref === 'string'
        && attrs.consideration_term_ref.length > 0 ? attrs.consideration_term_ref : null;
      if (!considerationTermRef) {
        review('CONSIDERATION_TERM_UNIDENTIFIED');
        return;
      }
      if (!quote.includes(considerationTermRef)) {
        review('CONSIDERATION_TERM_NOT_IN_QUOTE');
        return;
      }
      const parsed = parsePerShareCash(quote);
      if (parsed.outcome !== 'RESOLVED') {
        review(parsed.reason);
        return;
      }
      finalizeConsiderationClaim({
        entry,
        claim,
        provenance,
        registeredClaimDefinitionKey: claimDefinitionKey,
        conceptKey,
        canonicalValue: parsed.canonical_value,
        extraAttributes: {
          consideration_term_ref: considerationTermRef,
          currency: parsed.currency,
          per_share_cash_parse_version: PER_SHARE_CASH_PARSE_VERSION,
        },
      });
      return;
    }

    if (assertionKind === 'EXCHANGE_RATIO') {
      const ratioTermRef = typeof attrs.ratio_term_ref === 'string' && attrs.ratio_term_ref.length > 0
        ? attrs.ratio_term_ref : null;
      if (!ratioTermRef) {
        review('RATIO_TERM_UNIDENTIFIED');
        return;
      }
      if (!quote.includes(ratioTermRef)) {
        review('RATIO_TERM_NOT_IN_QUOTE');
        return;
      }
      const issuerStockRef = typeof attrs.issuer_stock_ref === 'string' && attrs.issuer_stock_ref.length > 0
        ? attrs.issuer_stock_ref : null;
      if (!issuerStockRef || !quote.includes(issuerStockRef)) {
        review('ISSUER_STOCK_REF_NOT_IN_QUOTE');
        return;
      }
      if (!exchangeRatioContextCorroborated(quote, issuerStockRef)) {
        review('RATIO_CONTEXT_UNCORROBORATED');
        return;
      }
      const parsed = parseExchangeRatio(quote);
      if (parsed.outcome !== 'RESOLVED') {
        review(parsed.reason);
        return;
      }
      finalizeConsiderationClaim({
        entry,
        claim,
        provenance,
        registeredClaimDefinitionKey: claimDefinitionKey,
        conceptKey,
        canonicalValue: parsed.canonical_value,
        extraAttributes: {
          ratio_term_ref: ratioTermRef,
          issuer_stock_ref: issuerStockRef,
          exchange_ratio_parse_version: EXCHANGE_RATIO_PARSE_VERSION,
        },
      });
      return;
    }

    const appraisalStatus = typeof attrs.appraisal_status === 'string' ? attrs.appraisal_status : null;
    if (!appraisalStatus || !APPRAISAL_STATUS_VALUES.includes(appraisalStatus)) {
      pushOpenWorld({ entry, claimRow: claim, reason: 'APPRAISAL_STATUS_OUT_OF_ENUM' });
      return;
    }
    const statuteRef = typeof attrs.statute_ref === 'string' && attrs.statute_ref.length > 0
      ? attrs.statute_ref : null;
    if (statuteRef && !quote.includes(statuteRef)) {
      review('STATUTE_REF_NOT_IN_QUOTE');
      return;
    }
    const corroboration = appraisalStatusCorroboration(quote, appraisalStatus, statuteRef);
    if (!corroboration.corroborated) {
      review(corroboration.reason);
      return;
    }
    finalizeConsiderationClaim({
      entry,
      claim,
      provenance,
      registeredClaimDefinitionKey: claimDefinitionKey,
      conceptKey,
      canonicalValue: appraisalStatus,
      extraAttributes: { statute_ref: statuteRef },
    });
  }

  for (const entry of runReceipt.compiled_candidates) {
    if (!entry || entry.ok !== true) {
      residuals.push(Object.freeze({
        residual_type: 'PRODUCER_CONTRACT_VIOLATION',
        section_reference: entry && entry.section_reference != null ? entry.section_reference : null,
        reason_code: entry && entry.reason_code != null ? entry.reason_code : 'UNKNOWN_COMPILER_REJECTION',
        message: entry && entry.message != null ? entry.message : null,
        proposal_kind: entry && entry.proposal ? entry.proposal.proposal_kind || null : null,
        claim_definition_key: entry && entry.proposal ? entry.proposal.claim_definition_key || null : null,
      }));
      continue;
    }

    const { candidate } = entry;
    const provenance = candidate.extraction_provenance;

    if (provenance.proposal_kind === 'OPEN_WORLD') {
      if (candidate.kind === 'claim') {
        pushOpenWorld({ entry, claimRow: candidate.claim, reason: 'NATIVE_OPEN_WORLD_PROPOSAL' });
      } else {
        residuals.push(Object.freeze({
          residual_type: 'UNSUPPORTED_PROPOSAL_KIND',
          section_reference: entry.section_reference,
          kind: candidate.kind,
          reason_code: 'RELATIONSHIP_RESOLUTION_NOT_IMPLEMENTED',
        }));
      }
      continue;
    }

    if (candidate.kind !== 'claim') {
      // Relationship proposals are out of scope for this resolver: the
      // native producer does not currently emit any (anthropic-provider.js
      // shapes claims only), and resolving a relationship's
      // source/target_occurrence_ids requires the very provisions this
      // module mints from claim proposals in the same pass -- ordering that
      // needs its own design, not a guess bolted on here. Typed and
      // reported, never silently dropped or force-resolved.
      residuals.push(Object.freeze({
        residual_type: 'UNSUPPORTED_PROPOSAL_KIND',
        section_reference: entry.section_reference,
        kind: candidate.kind,
        reason_code: 'RELATIONSHIP_RESOLUTION_NOT_IMPLEMENTED',
      }));
      continue;
    }

    const claim = candidate.claim;
    const genericKey = claim.claim_definition_key;

    if (genericKey === QUALIFIER_CLAIM_KEY) {
      handleQualifierCandidate(entry);
      continue;
    }

    if (genericKey === SHARE_COUNT_CLAIM_KEY) {
      handleShareCountCandidate(entry);
      continue;
    }

    if (genericKey === FEE_AMOUNT_CLAIM_KEY) {
      handleFeeAmountCandidate(entry);
      continue;
    }
    if (genericKey === FEE_TRIGGER_CLAIM_KEY) {
      handleFeeTriggerCandidate(entry);
      continue;
    }
    if (genericKey === FEE_TAIL_PERIOD_CLAIM_KEY) {
      handleTailPeriodCandidate(entry);
      continue;
    }

    if (genericKey === NO_SHOP_ACTION_CLAIM_KEY) {
      handleNoShopActionCandidate(entry);
      continue;
    }
    if (genericKey === NO_SHOP_EXCEPTION_PREREQUISITE_CLAIM_KEY) {
      handleNoShopExceptionPrerequisiteCandidate(entry);
      continue;
    }
    if (genericKey === NO_SHOP_NOTICE_PERIOD_CLAIM_KEY) {
      handleNoShopPeriodCandidate(entry, {
        genericKey, registeredClaimDefinitionKey: 'NO_SHOP_NOTICE_PERIOD_DAYS', conceptKey: 'NOSOL-NOTICE', periodRole: 'NOTICE',
      });
      continue;
    }
    if (genericKey === NO_SHOP_MATCH_PERIOD_CLAIM_KEY) {
      handleNoShopPeriodCandidate(entry, {
        genericKey, registeredClaimDefinitionKey: 'NO_SHOP_INITIAL_MATCH_PERIOD_DAYS', conceptKey: 'NOSOL-MATCH', periodRole: 'INITIAL_MATCH',
      });
      continue;
    }
    if (genericKey === NO_SHOP_REMATCH_PERIOD_CLAIM_KEY) {
      handleNoShopPeriodCandidate(entry, {
        genericKey, registeredClaimDefinitionKey: 'NO_SHOP_SUBSEQUENT_MATCH_PERIOD_DAYS', conceptKey: 'NOSOL-REMATCH', periodRole: 'SUBSEQUENT_MATCH',
      });
      continue;
    }
    if (genericKey === NO_SHOP_WAVE_B_CLAIM_KEY) {
      handleNoShopWaveBCandidate(entry);
      continue;
    }

    if (genericKey === MAE_CARVEOUT_CLAIM_KEY) {
      handleMaeCarveoutCandidate(entry);
      continue;
    }
    if (genericKey === MAE_DEFINITION_PRONG_CLAIM_KEY) {
      handleMaeDefinitionProngCandidate(entry);
      continue;
    }
    if (genericKey === MAE_DISPROPORTIONALITY_CLAIM_KEY) {
      handleMaeDisproportionalityCandidate(entry);
      continue;
    }

    if (genericKey === TERMINATION_RIGHT_CLAIM_KEY) {
      handleTerminationRightCandidate(entry);
      continue;
    }
    if (genericKey === PROXY_MEETING_COVENANT_CLAIM_KEY) {
      handleProxyMeetingCandidate(entry);
      continue;
    }
    if (genericKey === IOC_RESTRICTION_CLAIM_KEY) {
      handleIocRestrictionCandidate(entry);
      continue;
    }

    if (genericKey === CLOSING_CONDITION_CLAIM_KEY) {
      handleClosingConditionCandidate(entry);
      continue;
    }

    if (genericKey === REGULATORY_EFFORTS_CLAIM_KEY) {
      handleRegulatoryEffortsCandidate(entry);
      continue;
    }

    if (genericKey === CONSIDERATION_CLAIM_KEY) {
      handleConsiderationCandidate(entry);
      continue;
    }

    if (genericKey === FINANCING_COVENANT_CLAIM_KEY) {
      handleFinancingCandidate(entry);
      continue;
    }
    if (genericKey === GUARANTY_CLAIM_KEY) {
      handleGuarantyCandidate(entry);
      continue;
    }

    if (genericKey === MATERIAL_CONTRACT_BUCKET_CLAIM_KEY
      || genericKey === MATERIAL_CONTRACT_THRESHOLD_CLAIM_KEY) {
      const failure = materialContractGroundingFailure(claim);
      if (failure) {
        pushOpenWorld({ entry, claimRow: claim, reason: failure });
        continue;
      }
    }

    if (genericKey.startsWith('NATIVE_GENERAL_COVENANT_')) {
      const failure = generalCovenantGroundingFailure(claim);
      if (failure) {
        pushOpenWorld({ entry, claimRow: claim, reason: failure });
        continue;
      }
    }

    // LIMB_ASSERTION_CLAIM_KEY (and any other generic key with no table
    // entry at all): open world, unchanged from V2 -- see the table's own
    // comments for why a bare limb assertion never resolves here.
    const mapping = lookupGenericClaimKeyMapping(genericKey, null, null);
    if (!mapping) {
      pushOpenWorld({ entry, claimRow: claim, reason: 'UNMAPPED_GENERIC_CLAIM_KEY' });
      continue;
    }

    // From here down: BRING_DOWN_TIER_CLAIM_KEY only (the sole remaining,
    // unconditional table entry) -- structurally identical to the V2
    // resolver, now routed through the shared finalizeResolvedCandidate.
    const claimDefinition = vocabulary.claimDefinitions.get(mapping.registered_claim_definition_key);
    if (!claimDefinition) {
      residuals.push(Object.freeze({
        residual_type: 'VOCABULARY_MISSING_MAPPED_CLAIM_DEFINITION',
        section_reference: entry.section_reference,
        generic_claim_key: genericKey,
        mapped_claim_definition_key: mapping.registered_claim_definition_key,
      }));
      continue;
    }
    if (!vocabulary.concepts.has(mapping.concept_key)) {
      residuals.push(Object.freeze({
        residual_type: 'VOCABULARY_MISSING_MAPPED_CONCEPT',
        section_reference: entry.section_reference,
        generic_claim_key: genericKey,
        concept_key: mapping.concept_key,
      }));
      continue;
    }

    const section = sectionsByReference.get(entry.section_reference);
    if (!section) {
      residuals.push(Object.freeze({
        residual_type: 'SECTION_REFERENCE_UNRESOLVED_IN_RECEIPT',
        section_reference: entry.section_reference,
      }));
      continue;
    }

    const materiality = materialityFor({
      conceptKey: mapping.concept_key,
      canonicalValue: claim.canonical_value,
      claimDefinitionKey: mapping.registered_claim_definition_key,
    });
    const party = resolveParty({ attributes: claim.attributes, mapping });

    if (!party) {
      pushReviewUnresolved({
        entry,
        claimRow: claim,
        mapping,
        conceptFamily: mapping.concept_key,
        reasons: ['PARTY_UNRESOLVED'],
        materiality,
        normalisedPhrase: normaliseForMatching(claim.raw_value),
        attachmentPosition: null,
      });
      continue;
    }

    const defectScope = Object.freeze({
      deal: dealKey,
      family: mapping.concept_key,
      attribute: mapping.registered_claim_definition_key,
      extraction_mechanism: provenance.extractor_id,
    });
    const defectMatch = matchesKnownDefect(knownDefectRegistry, defectScope);

    const groupKey = groupKeyFor({ sectionReference: entry.section_reference, conceptKey: mapping.concept_key, party });
    let provision = provisionsByGroupKey.get(groupKey);
    if (!provision) {
      provision = mintProvision({
        section,
        conceptKey: mapping.concept_key,
        party,
        ordinal: provisionsByGroupKey.size + 1,
        admittedSourceContext,
        contractVocabulary,
      });
      provisionsByGroupKey.set(groupKey, provision);
    }

    const claimGroupKey = `${provision.provision_instance_id}::${mapping.registered_claim_definition_key}`;
    const claimOrdinal = claimOrdinalCounters.get(claimGroupKey) || 0;
    claimOrdinalCounters.set(claimGroupKey, claimOrdinal + 1);

    const rebuiltClaim = rebuildClaim({
      originalClaim: claim,
      newSubjectOccurrenceId: provision.provision_instance_id,
      newClaimDefinitionKey: mapping.registered_claim_definition_key,
      newOrdinal: claimOrdinal,
      // Approval item 2 (M2): the bring-down tier's canonical_value is the
      // producer's own controlled code, gated only by allowed-values
      // membership -- not derived by a written resolver rule the way the
      // qualifier paths' kind/code decisions are. Keep the MECHANICAL tag
      // (option (b), approved) but name the gate explicitly in the pins so
      // the tag never overstates how the value was produced.
      attributesExtra: {
        answer_provenance: buildMechanicalAnswerProvenance({
          extraPins: { gate: 'ALLOWED_VALUES_MEMBERSHIP' },
        }),
      },
    });

    finalizeResolvedCandidate({
      entry, provenance, genericKey, mapping, party, provision, rebuiltClaim, claimDefinition, defectMatch, materiality,
    });
  }

  // Ranked by legal materiality (lower rank = more material = first), tie-
  // broken on stable, content-derived fields so the ordering -- and hence
  // the whole resolution_receipt -- is byte-identical for identical inputs.
  reviewQueue.sort((left, right) => (
    left.materiality_rank - right.materiality_rank
    || left.section_reference.localeCompare(right.section_reference)
    || left.generic_claim_key.localeCompare(right.generic_claim_key)
    || String(left.closure_id || '').localeCompare(String(right.closure_id || ''))
  ));

  // Strictly additive (spec "Wiring"): only reached when a caller supplies
  // v1v2_comparison. Runs AFTER the review-queue sort above (its own key
  // fields -- materiality_rank/section_reference/generic_claim_key/
  // closure_id -- are unaffected by the wiring's `reasons` rewrite) so
  // ordering stays byte-identical to the pre-wiring pass either way.
  if (v1v2ComparisonInput) {
    const rewired = applyV1V2Wiring({ resolved, reviewQueue, comparison: v1v2ComparisonInput });
    resolved = rewired.resolved;
    reviewQueue = rewired.reviewQueue;
  }

  // Strictly additive (spec "Wiring"): only reached when a caller supplies
  // lexical_disagreement. Runs AFTER the v1v2 wiring above (so the
  // both_nets_clean marker reads the FINAL v1v2 state) and after the
  // review-queue sort (its own key fields are unaffected by this wiring's
  // reasons rewrite), so ordering stays byte-identical to the pre-wiring
  // pass either way.
  let lexicalDisagreementCounts = null;
  if (lexicalDisagreementInput) {
    const rewired = applyLexicalDisagreementWiring({
      resolved, reviewQueue, runReceipt, lexicalDisagreement: lexicalDisagreementInput,
    });
    resolved = rewired.resolved;
    reviewQueue = rewired.reviewQueue;
    lexicalDisagreementCounts = rewired.counts;
  }

  const contractVocabularyDigest = contentId(CONTRACT_VOCABULARY_DIGEST_DOMAIN, {
    concepts: contractVocabulary.concepts,
    claim_definitions: contractVocabulary.claim_definitions,
  });
  const limbComponentTrees = [...limbTreesByProvisionId.values()];
  const receiptBody = {
    schema_version: RESOLUTION_RECEIPT_SCHEMA,
    run_receipt_id: runReceipt.run_receipt_id,
    document_hash: runReceipt.document_hash,
    mapping_table_version: MAPPING_TABLE_VERSION,
    qualifier_kind_lexicon_version: QUALIFIER_KIND_LEXICON_VERSION,
    measurement_date_parse_version: MEASUREMENT_DATE_PARSE_VERSION,
    schedule_reference_parse_version: SCHEDULE_REFERENCE_PARSE_VERSION,
    // P1 cap-table numerics (spec section 4, audit M-6): unconditionally
    // present, exactly like measurement_date_parse_version above -- these
    // pin the parser and zero-table versions this run resolved SHARE_COUNT
    // candidates under, whether or not any were present in this receipt.
    // This is the honestly-restated additivity pin (audit M-1): a run with
    // no share-count input is byte-identical to pre-slice code EXCEPT
    // mapping_table_version, contract_vocabulary_digest (V14), these two
    // new fields, and the recomputed resolution_receipt_id -- never
    // silently kept old to preserve a stale byte-identity pin.
    share_count_parse_version: SHARE_COUNT_PARSE_VERSION,
    zero_pattern_table_version: ZERO_PATTERN_TABLE_VERSION,
    // family-termination-fee slice (spec section 4): unconditionally
    // present, same convention as share_count_parse_version above -- pins
    // the parser version this run resolved FEE_AMOUNT/FEE_TAIL_PERIOD
    // candidates under, whether or not any were present in this receipt.
    // Part of the honestly-restated additivity pin (spec section 4): a run
    // with no termination-fee input is byte-identical to pre-slice code
    // EXCEPT mapping_table_version, contract_vocabulary_digest (V15), this
    // new field, and the recomputed resolution_receipt_id.
    termination_fee_parse_version: TERMINATION_FEE_PARSE_VERSION,
    // family-no-shop slice (spec section 4): unconditionally present, same
    // convention as termination_fee_parse_version above -- pins the parser
    // and corroboration-table versions this run resolved NO_SHOP_* period/
    // action/prerequisite candidates under, whether or not any were present
    // in this receipt. Part of the honestly-restated additivity pin: a run
    // with no no-shop input is byte-identical to pre-slice code EXCEPT
    // mapping_table_version, contract_vocabulary_digest (unchanged, V15 --
    // this slice adds zero registry vocabulary, spec section 1), these
    // three new fields, and the recomputed resolution_receipt_id.
    no_shop_period_parse_version: NO_SHOP_PERIOD_PARSE_VERSION,
    no_shop_action_corroboration_table_version: NO_SHOP_ACTION_CORROBORATION_TABLE_VERSION,
    no_shop_prerequisite_corroboration_table_version: NO_SHOP_PREREQUISITE_CORROBORATION_TABLE_VERSION,
    // family-mae-definition slice (spec section 4, "Resolution receipt":
    // "the carve-out corroboration-table version ... threads into
    // receiptBody alongside the bumped mapping_table_version and the new
    // contract_vocabulary_digest"). Unconditionally present, same
    // convention as the no-shop fields above -- part of the honestly-
    // restated additivity pin: a run with no MAE input is byte-identical to
    // pre-slice code EXCEPT mapping_table_version, contract_vocabulary_
    // digest (V16), this new field, and the recomputed resolution_receipt_id.
    mae_corroboration_table_version: MAE_CORROBORATION_TABLE_VERSION,
    // family-termination-rights slice (spec section 4, "Receipt"):
    // unconditionally present, same convention as mae_corroboration_table_
    // version above -- part of the honestly-restated additivity pin: a run
    // with no termination-rights input is byte-identical to pre-slice code
    // EXCEPT mapping_table_version, contract_vocabulary_digest (V17), these
    // two new fields, and the recomputed resolution_receipt_id (documented
    // in the PR with a field-level diff).
    termination_deadline_parse_version: TERMINATION_DEADLINE_PARSE_VERSION,
    cure_period_parse_version: CURE_PERIOD_PARSE_VERSION,
    proxy_meeting_parse_version: PROXY_MEETING_PARSE_VERSION,
    antitrust_regulatory_parse_version: ANTITRUST_REGULATORY_PARSE_VERSION,
    per_share_cash_parse_version: PER_SHARE_CASH_PARSE_VERSION,
    exchange_ratio_parse_version: EXCHANGE_RATIO_PARSE_VERSION,
    ruling_corpus_version: rulingCorpus.version,
    ruling_corpus_id: rulingCorpus.ruling_corpus_id,
    known_defect_registry_id: knownDefectRegistry.known_defect_registry_id,
    contract_vocabulary_digest: contractVocabularyDigest,
    // Strictly additive: OMITTED entirely (not present-as-null) when no
    // v1v2_comparison was supplied, so resolution_receipt_id hashes stay
    // byte-identical to pre-slice code for every no-input run.
    ...(v1v2ComparisonInput ? { v1v2_comparison_receipt_id: v1v2ComparisonInput.v1v2_comparison_receipt_id } : {}),
    // Same convention: OMITTED entirely when no lexical_disagreement was
    // supplied, so resolution_receipt_id hashes stay byte-identical to
    // pre-slice code for every no-input run. When supplied, aggregates
    // (a) how many claims got a both_nets_clean:true marker and (b) how
    // many DISTINCT sections had a stale/malformed receipt binding failure
    // (spec section 5, "the receipt satisfies nothing for that claim" --
    // typed and counted, never silently dropped, but never attached to a
    // claim whose own binding never verified).
    ...(lexicalDisagreementCounts ? { lexical_disagreement_counts: lexicalDisagreementCounts } : {}),
    counts: {
      compiled_candidates: runReceipt.compiled_candidates.length,
      resolved: resolved.length,
      auto_pass: resolved.filter((item) => item.triage.auto_pass).length,
      review_queue: reviewQueue.length,
      open_world: openWorld.length,
      residuals: residuals.length,
      provisions: provisionsByGroupKey.size,
      limb_component_trees: limbComponentTrees.length,
      ioc_restriction_components: iocRestrictionComponents.length,
    },
  };
  const resolutionReceiptId = contentId(RESOLUTION_RECEIPT_SCHEMA, receiptBody);
  const resolutionReceipt = Object.freeze({ ...receiptBody, resolution_receipt_id: resolutionReceiptId });

  return Object.freeze({
    resolved: Object.freeze(resolved),
    review_queue: Object.freeze(reviewQueue),
    open_world: Object.freeze(openWorld),
    residuals: Object.freeze(residuals),
    limb_component_trees: Object.freeze(limbComponentTrees),
    ioc_restriction_components: Object.freeze(iocRestrictionComponents),
    resolution_receipt: resolutionReceipt,
  });
}

module.exports = {
  RESOLUTION_RECEIPT_SCHEMA,
  MAPPING_TABLE_VERSION,
  QUALIFIER_CONCEPT_KEY,
  GENERIC_CLAIM_KEY_RESOLUTION_TABLE,
  PARTY_CAPACITY_LEXICON,
  MATERIALITY_TABLE,
  ANTITRUST_REGULATORY_PARSE_VERSION,
  UNCLASSIFIED_MATERIALITY,
  CAPITAL_STRUCTURE_MATERIALITY_TIER,
  MATERIALITY_DEFINITION_KEY_OVERRIDES,
  SHARE_COUNT_KIND_CORROBORATION_TABLE,
  shareCountKindCorroborated,
  TERMF_PENDING_CONCEPT_FAMILY,
  FEE_SIDE_CORROBORATION_TABLE,
  feeSideCorroboratedSides,
  FEE_TRIGGER_CORROBORATION_TABLE,
  feeTriggerCorroboratedCodes,
  feePayerPartyForSide,
  NO_SHOP_ACTION_CORROBORATION_TABLE,
  NO_SHOP_ACTION_CORROBORATION_TABLE_VERSION,
  noShopActionCorroborated,
  NO_SHOP_PREREQUISITE_CORROBORATION_TABLE,
  NO_SHOP_PREREQUISITE_CORROBORATION_TABLE_VERSION,
  noShopPrerequisiteCorroborated,
  NO_SHOP_PERIOD_ROLE_CORROBORATION_TABLE,
  noShopPeriodRoleCorroborated,
  NO_SHOP_WAVE_B_RESOLUTION_MAP,
  NO_SHOP_WAVE_B_CORROBORATION_TABLE,
  noShopWaveBValueCorroborated,
  NO_SHOP_COVENANT_OBLIGOR_PARTY,
  MAE_CORROBORATION_TABLE_VERSION,
  MAE_CARVEOUT_CORROBORATION_TABLE,
  maeCarveoutCorroborated,
  MAE_DEFINITION_PRONG_CORROBORATION_TABLE,
  maeDefinitionProngCorroborated,
  MAE_DISPROPORTIONALITY_CORROBORATION_PATTERN,
  maeDisproportionalityCorroborated,
  TERMINATION_TRIGGER_KIND_TO_CONCEPT,
  TERMINATION_TRIGGER_KIND_CORROBORATION_TABLE,
  TERMINATION_VOTE_FAILURE_PHRASE_PATTERN,
  terminationTriggerKindCorroborated,
  TERMINATION_EITHER_PARTY_PATTERN,
  terminatingPartyPositionCorroborated,
  TERMINATION_RIGHT_HOLDER_ROLE,
  EITHER_PRINCIPAL_PARTY_CAPACITY,
  mintEitherPrincipalParty,
  PROXY_MEETING_ASSERTION_MAP,
  PROXY_MEETING_KIND_CORROBORATION,
  proxyMeetingCorroboratedKinds,
  proxyMeetingControlPartyPositionCorroborated,
  CONSIDERATION_RESOLUTION_MAP,
  perShareContextCorroborated,
  exchangeRatioContextCorroborated,
  appraisalStatusCorroboration,
  CandidateResolutionError,
  resolveCandidates,
  // Exported for tests that want to exercise pieces directly.
  materialityFor,
  canonicalValueAllowed,
  regulatoryValueCorroborated,
  regulatoryFilingRegimeCorroborated,
  resolvePartyCapacity,
  lookupGenericClaimKeyMapping,
  derivePerformanceAssumptionLevel,
  // Provenance tags (spec section 5, plan Task 5).
  ANSWER_PROVENANCE_TAGS,
  buildMechanicalAnswerProvenance,
  buildAiAnswerProvenance,
  buildVerifiedAnswerProvenance,
  mintSupersessionLink,
  // Lexical-disagreement net wiring (spec section 5) -- exported so tests
  // (and any future receipt-building caller) can recompute the exact same
  // candidate_digest formula this wiring itself verifies against.
  LEXICAL_DISAGREEMENT_RECEIPT_SCHEMA,
  computeSectionCandidatesForLexicalDigest,
};
