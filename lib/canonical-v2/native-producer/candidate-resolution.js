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

const { contentId, canonicalJson } = require('../canonical-bytes');
const { buildSemanticSpan, buildProvisionInstance } = require('../source-structure');
const { normaliseForMatching } = require('../zero-width-normalise');
const { RUN_RECEIPT_SCHEMA } = require('./native-extraction-run');
const {
  QUALIFIER_CLAIM_KEY,
  BRING_DOWN_TIER_CLAIM_KEY,
  LIMB_ASSERTION_CLAIM_KEY,
  SHARE_COUNT_CLAIM_KEY,
  SHARE_COUNT_KINDS,
  PROMPT_ID_REEXPORT,
  PROMPT_VERSION_REEXPORT,
} = require('./anthropic-provider');
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
  classifyQualifierQuote,
} = require('./qualifier-kind-lexicon');
const {
  EMPTY_RULING_CORPUS,
  validateRulingCorpus,
  applyRuling,
} = require('./ruling-corpus');
const { MEASUREMENT_DATE_PARSE_VERSION, parseMeasurementDate } = require('./measurement-date-parse');
const {
  SHARE_COUNT_PARSE_VERSION,
  ZERO_PATTERN_TABLE_VERSION,
  parseShareCount,
} = require('./share-count-parse');
const {
  computeCandidateDigest: computeLexicalCandidateDigest,
  isStructurallyValidReceipt: isStructurallyValidLexicalReceipt,
  familyOutcomeFromReceipt: lexicalFamilyOutcomeFromReceipt,
} = require('./lexical-disagreement-net');

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
const MAPPING_TABLE_VERSION = 4;

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
  Object.freeze({ rank: 20, label: 'FEES', concept_key_prefixes: Object.freeze(['TERMF-']) }),
  Object.freeze({ rank: 30, label: 'MAE', concept_key_prefixes: Object.freeze([]) }),
  Object.freeze({ rank: 40, label: 'FIDUCIARY', concept_key_prefixes: Object.freeze([]) }),
  Object.freeze({ rank: 50, label: 'NO_SHOP_EXCEPTIONS', concept_key_prefixes: Object.freeze(['NOSOL-']) }),
  CAPITAL_STRUCTURE_MATERIALITY_TIER,
  Object.freeze({ rank: 55, label: 'REPRESENTATIONS', concept_key_prefixes: Object.freeze(['REP-T-', 'REP-B-']) }),
  Object.freeze({ rank: 60, label: 'CONSIDERATION', concept_key_prefixes: Object.freeze(['CONS-']) }),
  Object.freeze({ rank: 70, label: 'CLOSING_CONDITIONS', concept_key_prefixes: Object.freeze(['COND-']) }),
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
  return false;
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

function mintProvision({
  section, conceptKey, party, ordinal, admittedSourceContext, contractVocabulary,
}) {
  const span = buildSemanticSpan(admittedSourceContext, section.start, section.end);
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
  const attributes = attributesExtra
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

  let resolved = [];
  let reviewQueue = [];
  const openWorld = [];
  const residuals = [];
  const provisionsByGroupKey = new Map();
  const claimOrdinalCounters = new Map();
  const limbTreesByProvisionId = new Map();
  const dealKey = admittedSourceContext.governed_deal_key;

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
    }));
  }

  // Review-queue items now always carry the ruling-corpus KEY fields
  // (normalised_phrase, attachment_position, concept_family -- spec section
  // 4/Task 8 integration note: the corpus and dry-run tooling need them),
  // whether or not the item ever reached a registered mapping.
  function pushReviewUnresolved({
    entry, claimRow, mapping, conceptFamily, reasons, materiality, normalisedPhrase, attachmentPosition,
  }) {
    reviewQueue.push(Object.freeze({
      section_reference: entry.section_reference,
      generic_claim_key: claimRow.claim_definition_key,
      resolved_claim_definition_key: mapping ? mapping.registered_claim_definition_key : null,
      concept_key: mapping ? mapping.concept_key : conceptFamily,
      reasons: Object.freeze(reasons),
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
    qualifierDateAttrs = null,
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
      const dateResult = parseMeasurementDate({ quote: part.text, agreement_date: agreementDate });
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
    } else if (kind === 'TEMPORAL') {
      const dateResult = parseMeasurementDate({ quote: part.text, agreement_date: agreementDate });
      if (dateResult.outcome !== 'RESOLVED') {
        pushOpenWorld({
          entry,
          claimRow: {
            ...partOriginalClaim,
            attributes: { ...partOriginalClaim.attributes, measurement_date_parse_reason: dateResult.reason },
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
        const dateResult = parseMeasurementDate({ quote: temporalPart.text, agreement_date: agreementDate });
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
  UNCLASSIFIED_MATERIALITY,
  CAPITAL_STRUCTURE_MATERIALITY_TIER,
  MATERIALITY_DEFINITION_KEY_OVERRIDES,
  SHARE_COUNT_KIND_CORROBORATION_TABLE,
  shareCountKindCorroborated,
  CandidateResolutionError,
  resolveCandidates,
  // Exported for tests that want to exercise pieces directly.
  materialityFor,
  canonicalValueAllowed,
  resolvePartyCapacity,
  lookupGenericClaimKeyMapping,
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
