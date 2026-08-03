/**
 * lib/canonical-v2/native-producer/candidate-proposal-compiler.js
 *
 * Deterministic compiler from a raw producer PROPOSAL to a properly shaped
 * claim/relationship candidate. This file does not classify, normalise, or
 * judge legal content -- it hands every proposal straight to the EXISTING
 * UNMODIFIED `buildClaimRevision` / `buildRelationshipRevision` in
 * claims-relationships.js and lets that module's own residual system decide
 * whether the content is clean (VALIDATED) or quarantined. This file's own
 * job is narrower and purely mechanical:
 *
 *  1. Reject proposals the producer must never emit (ABSENT / NOT_APPLICABLE)
 *     or that lack evidence -- the whole premise of a producer proposal is
 *     that it is evidence-backed. These are producer-contract violations,
 *     not quarantinable content issues, so they are rejected before ever
 *     reaching claims-relationships.js.
 *  2. Assign each compiled candidate its OWN closure_id, content-addressed
 *     from the producer receipt, the governed scope and the compiled
 *     revision's own identity. validate-write-set.js quarantines an entire
 *     closure when ANY row in it carries a residual (see its ~line 2091
 *     `quarantinedClosureIds` pass); giving every independently-produced
 *     candidate a distinct closure_id is what stops one bad candidate from
 *     taking its valid siblings down with it.
 *  3. Attach an `extraction_provenance` OUTER envelope (extractor_id,
 *     extractor_version, prompt_digest, producer_receipt_id, proposal_kind)
 *     alongside the compiled claim/relationship -- never inside it. The
 *     claim/relationship key sets in claims-relationships.js are closed
 *     contracts (`requireExactKeys`); this module never adds a field to them.
 *  4. Refuse to compile anything that isn't bound to a genuine producer
 *     receipt (see requireProducerReceipt below) -- a hand-authored payload
 *     that merely claims to be a producer proposal does not compile.
 *
 * What this file deliberately does NOT do: decide whether an attribute or
 * taxonomy code is valid (claims-relationships.js's residual system already
 * does that -- unknown attributes and unknown codes surface as
 * UNKNOWN_ATTRIBUTE / INVALID_TAXONOMY_CODE retained residuals on the
 * compiled row, never a silent drop, never an uncaught throw), force a
 * novel proposition onto the nearest known concept, or re-validate the
 * governed scope's business meaning (that is validate-write-set.js's job,
 * untouched and out of scope here).
 */

'use strict';

const { contentId } = require('../canonical-bytes');
const { buildClaimRevision, buildRelationshipRevision } = require('../claims-relationships');
const { PRODUCER_RECEIPT_SCHEMA } = require('./provider-interface');

const EXTRACTION_PROVENANCE_SCHEMA = 'NATIVE_PRODUCER_EXTRACTION_PROVENANCE/V1';
const CANDIDATE_CLOSURE_DOMAIN = 'NATIVE_PRODUCER_CANDIDATE_CLOSURE/V1';
const GOVERNED_SCOPE_DIGEST_DOMAIN = 'NATIVE_PRODUCER_GOVERNED_SCOPE/V1';

// The producer never emits these: ABSENT is derived elsewhere from proven
// scope completeness, NOT_APPLICABLE from a proven applicability rule.
// Unproven scope is NOT_EXAMINED, which is likewise not something a
// proposal-stage producer asserts about itself.
const DISALLOWED_PROPOSAL_STATES = Object.freeze(['ABSENT', 'NOT_APPLICABLE']);
// SHARE_COUNT (P1 cap-table numeric promotions, docs/superpowers/specs/
// 2026-08-02-p1-captable-numerics-design.md section 3): a third proposal
// kind, deliberately distinct from GOVERNED and OPEN_WORLD, so the
// resolver's routing never has to infer "this claim_definition_key means
// share-count" from content -- the producer already said so structurally.
// FEE_AMOUNT / FEE_TRIGGER / FEE_TAIL_PERIOD (family-termination-fee slice,
// docs/superpowers/specs/2026-08-02-family-termination-fee-design.md
// section 3): the same discipline, three more non-OPEN_WORLD kinds so the
// resolver's dispatch on generic_claim_key never has to guess.
// NO_SHOP (family-no-shop slice, docs/superpowers/specs/2026-08-02-family-
// no-shop-design.md section 3): ONE more non-OPEN_WORLD kind, deliberately
// shared across all FIVE of this family's generic claim keys (unlike the
// fee family's three per-key kinds) -- the resolver's own dispatch keys on
// generic_claim_key, never on proposal_kind, to tell the five apart.
// MAE_DEFINITION (family-mae-definition slice, docs/superpowers/specs/
// 2026-08-02-family-mae-definition-design.md section 3): ONE more non-
// OPEN_WORLD kind, shared across all THREE of this family's generic claim
// keys -- same NO_SHOP-precedent discipline (the resolver's dispatch keys
// on generic_claim_key, never on proposal_kind).
// TERMINATION_RIGHT (family-termination-rights slice, docs/superpowers/
// specs/2026-08-02-family-termination-rights-design.md section 3): ONE
// more non-OPEN_WORLD kind, the sole generic claim key this family emits
// (TERMINATION_RIGHT_CLAIM_KEY) -- same discipline as the fee/no-shop/MAE
// families above.
const PROPOSAL_KINDS = Object.freeze([
  'GOVERNED', 'OPEN_WORLD', 'SHARE_COUNT', 'FEE_AMOUNT', 'FEE_TRIGGER', 'FEE_TAIL_PERIOD', 'NO_SHOP', 'MAE_DEFINITION',
  'TERMINATION_RIGHT', 'CLOSING_CONDITION', 'REGULATORY_EFFORTS',
  'CONSIDERATION', 'IOC_RESTRICTION', 'PROXY_MEETING_COVENANT',
  'MATERIAL_CONTRACTS',
  'NO_OTHER_REPS_FRAUD',
  'GENERAL_COVENANT',
]);

const CLAIM_PROPOSAL_FIELDS = Object.freeze([
  'subject_occurrence_id', 'claim_definition_key', 'claim_definition_version', 'ordinal',
  'state', 'raw_value', 'canonical_value', 'unit', 'day_basis', 'denominator',
  'scope', 'applicability', 'not_examined', 'failure', 'evidence',
  'attributes', 'allowed_attributes', 'taxonomy_codes', 'codebooks',
  'extraction_version', 'normalisation_version', 'derivation_version',
]);
const RELATIONSHIP_PROPOSAL_FIELDS = Object.freeze([
  'source_occurrence_id', 'relationship_definition_key', 'relationship_definition_version', 'ordinal',
  'state', 'raw_scope', 'target_occurrence_ids', 'effect',
  'scope', 'applicability', 'not_examined', 'failure', 'evidence',
  'attributes', 'allowed_attributes', 'taxonomy_codes', 'codebooks',
  'resolver_version',
]);

class CandidateProposalRejectedError extends Error {
  constructor(reasonCode, message, details = {}) {
    super(message);
    this.name = 'CandidateProposalRejectedError';
    this.reason_code = reasonCode;
    this.details = details;
  }
}

function pick(source, fields) {
  const out = {};
  for (const field of fields) {
    if (Object.hasOwn(source, field)) out[field] = source[field];
  }
  return out;
}

function requirePlainObject(value, label) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    throw new TypeError(`${label} must be a plain object`);
  }
  return value;
}

function requireNonEmptyString(value, label) {
  if (typeof value !== 'string' || value.length === 0) {
    throw new TypeError(`${label} must be a non-empty string`);
  }
  return value;
}

// Only genuine provider output compiles. A hand-authored payload that
// merely fabricates a `producer_receipt`-shaped object is rejected because
// its declared id will not match the content it claims to summarise --
// the receipt is content-addressed, so it cannot be forged without also
// reproducing the exact provider/model/prompt/scope facts it attests to.
function requireProducerReceipt(receipt) {
  if (!receipt || typeof receipt !== 'object' || Array.isArray(receipt)) {
    throw new CandidateProposalRejectedError(
      'MISSING_PRODUCER_RECEIPT',
      'a candidate proposal requires a producer receipt binding and none was supplied',
    );
  }
  if (receipt.schema_version !== PRODUCER_RECEIPT_SCHEMA
    || typeof receipt.producer_receipt_id !== 'string') {
    throw new CandidateProposalRejectedError(
      'INVALID_PRODUCER_RECEIPT',
      'the supplied producer receipt is not a recognised NATIVE_PRODUCER_RECEIPT/V1 payload',
    );
  }
  const { producer_receipt_id: receiptId, ...body } = receipt;
  const expectedId = contentId(PRODUCER_RECEIPT_SCHEMA, body);
  if (receiptId !== expectedId) {
    throw new CandidateProposalRejectedError(
      'INVALID_PRODUCER_RECEIPT',
      'the producer receipt identity does not match its own content: only genuine provider output compiles',
    );
  }
  return receipt;
}

function requireProposalShape(proposal) {
  if (!proposal || typeof proposal !== 'object' || Array.isArray(proposal)) {
    throw new CandidateProposalRejectedError('INVALID_PROPOSAL', 'a candidate proposal must be an object');
  }
  if (proposal.kind !== 'claim' && proposal.kind !== 'relationship') {
    throw new CandidateProposalRejectedError(
      'UNKNOWN_PROPOSAL_KIND',
      `a candidate proposal must be kind "claim" or "relationship", got: ${proposal.kind}`,
    );
  }
  if (proposal.proposal_kind !== undefined && !PROPOSAL_KINDS.includes(proposal.proposal_kind)) {
    throw new CandidateProposalRejectedError(
      'UNKNOWN_PROPOSAL_KIND',
      `proposal_kind must be one of ${PROPOSAL_KINDS.join(', ')}, got: ${proposal.proposal_kind}`,
    );
  }
  if (DISALLOWED_PROPOSAL_STATES.includes(proposal.state)) {
    throw new CandidateProposalRejectedError(
      'DISALLOWED_PROPOSAL_STATE',
      `the producer must never emit ${proposal.state} -- ABSENT/NOT_APPLICABLE are derived elsewhere, never proposed`,
      { state: proposal.state },
    );
  }
  if (!Array.isArray(proposal.evidence) || proposal.evidence.length === 0) {
    throw new CandidateProposalRejectedError(
      'MISSING_EVIDENCE',
      'the producer only emits evidence-backed candidates: this proposal carries no evidence spans',
    );
  }
}

/**
 * Compiles exactly one raw proposal into a candidate with its own
 * closure_id and an outer extraction_provenance envelope.
 *
 * @param {object} args
 * @param {object} args.proposal          raw producer proposal (kind: 'claim'|'relationship', ...)
 * @param {object} args.governed_scope    the scope contract this proposal was produced under
 * @param {object} args.producer_receipt  receipt from produceCandidateProposals
 * @param {string} args.extractor_id
 * @param {string} args.extractor_version
 * @returns {{kind: 'claim'|'relationship', claim?: object, relationship?: object, extraction_provenance: object}}
 */
function compileCandidateProposal({
  proposal,
  governed_scope,
  producer_receipt,
  extractor_id,
  extractor_version,
} = {}) {
  const receipt = requireProducerReceipt(producer_receipt);
  requirePlainObject(governed_scope, 'governed_scope');
  requireNonEmptyString(extractor_id, 'extractor_id');
  requireNonEmptyString(extractor_version, 'extractor_version');
  requireProposalShape(proposal);

  const kind = proposal.kind;
  const built = kind === 'claim'
    ? buildClaimRevision(pick(proposal, CLAIM_PROPOSAL_FIELDS))
    : buildRelationshipRevision(pick(proposal, RELATIONSHIP_PROPOSAL_FIELDS));

  const revisionId = kind === 'claim' ? built.claim_revision_id : built.relationship_revision_id;
  const governedScopeDigest = contentId(GOVERNED_SCOPE_DIGEST_DOMAIN, governed_scope);

  // Content-addressed from the receipt, the scope and this one compiled
  // revision's own identity: no two independently-produced candidates can
  // collide here unless they are, in fact, the same candidate.
  const closureId = contentId(CANDIDATE_CLOSURE_DOMAIN, {
    producer_receipt_id: receipt.producer_receipt_id,
    governed_scope_digest: governedScopeDigest,
    kind,
    revision_id: revisionId,
  });

  const provenanceBody = {
    schema_version: EXTRACTION_PROVENANCE_SCHEMA,
    extractor_id,
    extractor_version,
    proposal_kind: proposal.proposal_kind || 'GOVERNED',
    prompt_digest: receipt.prompt_digest,
    producer_receipt_id: receipt.producer_receipt_id,
    governed_scope_digest: governedScopeDigest,
  };
  const extractionProvenanceId = contentId(EXTRACTION_PROVENANCE_SCHEMA, provenanceBody);

  return Object.freeze({
    kind,
    [kind]: Object.freeze({ ...built, closure_id: closureId }),
    extraction_provenance: Object.freeze({
      ...provenanceBody,
      extraction_provenance_id: extractionProvenanceId,
    }),
  });
}

/**
 * Compiles a batch of proposals. Never throws for a single bad proposal --
 * each proposal either compiles (`{ ok: true, candidate }`) or is rejected
 * with a typed reason (`{ ok: false, proposal, reason_code, message }`).
 * Compiled-but-quarantined candidates (unknown attribute/taxonomy code)
 * come back as `ok: true` with `publication_state: 'QUARANTINED'` on the
 * inner claim/relationship -- that is claims-relationships.js's residual
 * system working as designed, not a compiler rejection.
 */
function compileCandidateProposals({
  proposals,
  governed_scope,
  producer_receipt,
  extractor_id,
  extractor_version,
} = {}) {
  if (!Array.isArray(proposals)) throw new TypeError('proposals must be an array');
  return proposals.map((proposal) => {
    try {
      return {
        ok: true,
        candidate: compileCandidateProposal({
          proposal, governed_scope, producer_receipt, extractor_id, extractor_version,
        }),
      };
    } catch (error) {
      if (error instanceof CandidateProposalRejectedError) {
        return {
          ok: false,
          proposal,
          reason_code: error.reason_code,
          message: error.message,
        };
      }
      throw error;
    }
  });
}

module.exports = {
  CandidateProposalRejectedError,
  compileCandidateProposal,
  compileCandidateProposals,
};
