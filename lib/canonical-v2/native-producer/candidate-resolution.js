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
const { RUN_RECEIPT_SCHEMA } = require('./native-extraction-run');
const {
  QUALIFIER_CLAIM_KEY,
  BRING_DOWN_TIER_CLAIM_KEY,
} = require('./anthropic-provider');
const {
  EMPTY_REGISTRY,
  validateKnownDefectRegistry,
  matchesKnownDefect,
} = require('./known-defect-registry');

const RESOLUTION_RECEIPT_SCHEMA = 'NATIVE_CANDIDATE_RESOLUTION_RECEIPT/V1';
const PROVISION_CLOSURE_DOMAIN = 'CANDIDATE_RESOLUTION_PROVISION_CLOSURE/V1';
const CLAIM_CLOSURE_DOMAIN = 'CANDIDATE_RESOLUTION_CLAIM_CLOSURE/V1';
const CLAIM_EVIDENCE_DOMAIN = 'CLAIM_EVIDENCE/V1';
const CLAIM_OCCURRENCE_DOMAIN = 'CLAIM_OCCURRENCE/V1';
const CLAIM_REVISION_DOMAIN = 'CLAIM_REVISION/V1';
const RETAINED_RESIDUAL_DOMAIN = 'RETAINED_RESIDUAL/V1';
const CONTRACT_VOCABULARY_DIGEST_DOMAIN = 'CANDIDATE_RESOLUTION_CONTRACT_VOCABULARY/V1';
const GROUP_KEY_DOMAIN = 'CANDIDATE_RESOLUTION_PROVISION_GROUP/V1';

// Bump whenever GENERIC_CLAIM_KEY_RESOLUTION_TABLE changes meaning -- the
// resolution_receipt pins this so a stored resolution can always be traced
// back to the exact mapping it was produced under.
const MAPPING_TABLE_VERSION = 1;

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
 * doesn't -- and a missing entry is a decision, not an oversight:
 *
 *  - `QUALIFIER_CLAIM_KEY` (rep-level/limb-level accuracy or knowledge
 *    qualifiers) and `BRING_DOWN_TIER_CLAIM_KEY` (bring-down accuracy
 *    tiers) both carry a controlled `ACCURACY_STANDARD` code as their
 *    `canonical_value`, and the governed vocabulary's own
 *    `REPRESENTATION_ACCURACY_STANDARD` claim definition is exactly that
 *    controlled code, registered. Both map to it.
 *  - `LIMB_ASSERTION_CLAIM_KEY` (the bare text of a representation limb) is
 *    deliberately ABSENT from this table. It carries no canonical_value at
 *    all -- it is a verbatim assertion, not a controlled-code claim -- and
 *    the governed vocabulary has no registered "a limb was asserted"
 *    presence claim for this family. Mapping it onto
 *    `REPRESENTATION_ACCURACY_STANDARD` anyway would silently relabel a
 *    plain assertion as an accuracy qualifier; rule 2 forbids exactly that
 *    ("never forced to the nearest fit"). It resolves as open-world instead
 *    (`UNMAPPED_GENERIC_CLAIM_KEY`).
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
  Object.freeze({
    generic_claim_key: QUALIFIER_CLAIM_KEY,
    registered_claim_definition_key: 'REPRESENTATION_ACCURACY_STANDARD',
    concept_key: 'REP-T-CAP',
    party_field: 'party_making',
    party_role: 'REPRESENTATION_MAKER',
  }),
  Object.freeze({
    generic_claim_key: BRING_DOWN_TIER_CLAIM_KEY,
    registered_claim_definition_key: 'REPRESENTATION_ACCURACY_STANDARD',
    concept_key: 'COND-B-REP',
    party_field: 'condition_obligor',
    party_role: 'CONDITION_OBLIGOR',
  }),
]);
const GENERIC_CLAIM_KEY_RESOLUTION = new Map(
  GENERIC_CLAIM_KEY_RESOLUTION_TABLE.map((entry) => [entry.generic_claim_key, entry]),
);

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
const MATERIALITY_TABLE = Object.freeze([
  Object.freeze({ rank: 10, label: 'TERMINATION_RIGHTS', concept_key_prefixes: Object.freeze(['TERMR-']) }),
  Object.freeze({ rank: 20, label: 'FEES', concept_key_prefixes: Object.freeze(['TERMF-']) }),
  Object.freeze({ rank: 30, label: 'MAE', concept_key_prefixes: Object.freeze([]) }),
  Object.freeze({ rank: 40, label: 'FIDUCIARY', concept_key_prefixes: Object.freeze([]) }),
  Object.freeze({ rank: 50, label: 'NO_SHOP_EXCEPTIONS', concept_key_prefixes: Object.freeze(['NOSOL-']) }),
  Object.freeze({ rank: 55, label: 'REPRESENTATIONS', concept_key_prefixes: Object.freeze(['REP-T-', 'REP-B-']) }),
  Object.freeze({ rank: 60, label: 'CONSIDERATION', concept_key_prefixes: Object.freeze(['CONS-']) }),
  Object.freeze({ rank: 70, label: 'CLOSING_CONDITIONS', concept_key_prefixes: Object.freeze(['COND-']) }),
  Object.freeze({ rank: 90, label: 'NOTICES_ADMINISTRATIVE', concept_key_prefixes: Object.freeze(['NOTICE-', 'ADMIN-']) }),
]);
const UNCLASSIFIED_MATERIALITY = Object.freeze({ rank: 99, label: 'UNCLASSIFIED' });

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

function materialityFor({ conceptKey, canonicalValue }) {
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

  const overrides = {
    claim_occurrence_id: claimOccurrenceId,
    subject_occurrence_id: newSubjectOccurrenceId,
    claim_definition_key: newClaimDefinitionKey,
    ordinal: newOrdinal,
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
    canonical_value: originalClaim.canonical_value,
    unit: originalClaim.unit,
    day_basis: originalClaim.day_basis,
    denominator: originalClaim.denominator,
    scope: originalClaim.scope,
    applicability: originalClaim.applicability,
    not_examined: originalClaim.not_examined,
    failure: originalClaim.failure,
    evidence_ids: evidenceIds,
    attributes: originalClaim.attributes,
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
 * @returns {{
 *   resolved: object[],
 *   review_queue: object[],
 *   open_world: object[],
 *   residuals: object[],
 *   resolution_receipt: object,
 * }}
 */
function resolveCandidates({
  run_receipt: runReceipt,
  contract_vocabulary: contractVocabulary,
  admitted_source_context: admittedSourceContext,
  known_defect_registry: knownDefectRegistryInput,
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

  const sectionsByReference = new Map(
    runReceipt.resolved_sections.map((section) => [section.section_reference, section]),
  );

  const resolved = [];
  const reviewQueue = [];
  const openWorld = [];
  const residuals = [];
  const provisionsByGroupKey = new Map();
  const claimOrdinalCounters = new Map();
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
    }));
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
    const mapping = GENERIC_CLAIM_KEY_RESOLUTION.get(genericKey);
    if (!mapping) {
      pushOpenWorld({ entry, claimRow: claim, reason: 'UNMAPPED_GENERIC_CLAIM_KEY' });
      continue;
    }

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

    const materiality = materialityFor({ conceptKey: mapping.concept_key, canonicalValue: claim.canonical_value });
    const party = resolveParty({ attributes: claim.attributes, mapping });

    if (!party) {
      reviewQueue.push(Object.freeze({
        section_reference: entry.section_reference,
        generic_claim_key: genericKey,
        resolved_claim_definition_key: mapping.registered_claim_definition_key,
        concept_key: mapping.concept_key,
        reasons: Object.freeze(['PARTY_UNRESOLVED']),
        materiality_rank: materiality.rank,
        materiality_label: materiality.label,
        auto_pass: false,
        has_resolution: false,
        raw_value: claim.raw_value,
        canonical_value: claim.canonical_value,
        original_claim_occurrence_id: claim.claim_occurrence_id,
        closure_id: claim.closure_id,
      }));
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
    });

    const canonicalValueOk = rebuiltClaim.state !== 'PRESENT'
      || canonicalValueAllowed(claimDefinition, rebuiltClaim.canonical_value);
    const multiSpan = rebuiltClaim.evidence.length > 1;
    const nestedOrCrossReferenced = rebuiltClaim.evidence.some((edge) => edge.evidence_role !== 'OPERATIVE_TEXT');
    const unresolvedResidual = rebuiltClaim.publication_state === 'QUARANTINED';
    const failedOrUncertain = rebuiltClaim.state !== 'PRESENT';

    const reasons = [];
    if (!canonicalValueOk) reasons.push('UNREGISTERED_CANONICAL_VALUE');
    if (multiSpan) reasons.push('MULTI_SPAN_COMPOSED');
    if (nestedOrCrossReferenced) reasons.push('NESTED_OR_CROSS_REFERENCED_EVIDENCE');
    if (unresolvedResidual) reasons.push('UNRESOLVED_RESIDUAL');
    if (failedOrUncertain) reasons.push('FAILED_OR_UNCERTAIN_EXTRACTION');
    if (defectMatch) reasons.push('KNOWN_DEFECT_MATCH');
    const autoPass = reasons.length === 0;

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
        candidate: Object.freeze({ kind: 'claim', claim: rebuiltClaim, extraction_provenance: provenance }),
      }),
      triage: Object.freeze({
        auto_pass: autoPass,
        reasons: Object.freeze(reasons),
        materiality_rank: materiality.rank,
        materiality_label: materiality.label,
        known_defect: defectMatch ? Object.freeze({ ...defectMatch }) : null,
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
      }));
    }
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

  const contractVocabularyDigest = contentId(CONTRACT_VOCABULARY_DIGEST_DOMAIN, {
    concepts: contractVocabulary.concepts,
    claim_definitions: contractVocabulary.claim_definitions,
  });
  const receiptBody = {
    schema_version: RESOLUTION_RECEIPT_SCHEMA,
    run_receipt_id: runReceipt.run_receipt_id,
    document_hash: runReceipt.document_hash,
    mapping_table_version: MAPPING_TABLE_VERSION,
    known_defect_registry_id: knownDefectRegistry.known_defect_registry_id,
    contract_vocabulary_digest: contractVocabularyDigest,
    counts: {
      compiled_candidates: runReceipt.compiled_candidates.length,
      resolved: resolved.length,
      auto_pass: resolved.filter((item) => item.triage.auto_pass).length,
      review_queue: reviewQueue.length,
      open_world: openWorld.length,
      residuals: residuals.length,
      provisions: provisionsByGroupKey.size,
    },
  };
  const resolutionReceiptId = contentId(RESOLUTION_RECEIPT_SCHEMA, receiptBody);
  const resolutionReceipt = Object.freeze({ ...receiptBody, resolution_receipt_id: resolutionReceiptId });

  return Object.freeze({
    resolved: Object.freeze(resolved),
    review_queue: Object.freeze(reviewQueue),
    open_world: Object.freeze(openWorld),
    residuals: Object.freeze(residuals),
    resolution_receipt: resolutionReceipt,
  });
}

module.exports = {
  RESOLUTION_RECEIPT_SCHEMA,
  MAPPING_TABLE_VERSION,
  GENERIC_CLAIM_KEY_RESOLUTION_TABLE,
  PARTY_CAPACITY_LEXICON,
  MATERIALITY_TABLE,
  UNCLASSIFIED_MATERIALITY,
  CandidateResolutionError,
  resolveCandidates,
  // Exported for tests that want to exercise pieces directly.
  materialityFor,
  canonicalValueAllowed,
  resolvePartyCapacity,
};
