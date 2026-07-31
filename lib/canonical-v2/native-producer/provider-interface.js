/**
 * lib/canonical-v2/native-producer/provider-interface.js
 *
 * The native extractor's only seam onto a model. `produceCandidateProposals`
 * takes a governed scope (what the producer is licensed to examine), the
 * definitions and contract bundle that frame the request, and an injected
 * `provider` function that actually produces proposals. Tests (and, later,
 * `--backend claude` / `--backend codex` runners) supply that function --
 * this module never calls a model itself and never decides whether a
 * proposal is any good. It is pure orchestration plus a content-addressed
 * receipt of what happened.
 *
 * Architecture note: model output is a PROPOSAL only. This file contains NO
 * identity derivation, NO claim/relationship shaping, and NO validation --
 * that all happens in candidate-proposal-compiler.js against the frozen
 * buildClaimRevision/buildRelationshipRevision contracts. This file exists
 * so a live model call and a recorded fixture are interchangeable behind
 * one signature.
 */

'use strict';

const { contentId } = require('../canonical-bytes');

const PRODUCER_RECEIPT_SCHEMA = 'NATIVE_PRODUCER_RECEIPT/V1';
const INPUT_SCOPE_DIGEST_DOMAIN = 'NATIVE_PRODUCER_INPUT_SCOPE/V1';
const PROMPT_DIGEST_DOMAIN = 'NATIVE_PRODUCER_PROMPT/V1';

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

function deepFreeze(value) {
  if (!value || typeof value !== 'object' || Object.isFrozen(value)) return value;
  if (Array.isArray(value)) {
    value.forEach(deepFreeze);
  } else {
    Object.values(value).forEach(deepFreeze);
  }
  return Object.freeze(value);
}

/**
 * @param {object} args
 * @param {object} args.governed_scope   what the producer is licensed to examine
 *                                        (e.g. admitted intervals, party scope)
 * @param {object} args.definitions      the claim/relationship definition catalogue
 *                                        the producer may reference
 * @param {object} args.contract_bundle  the compiled contract bundle framing this run
 * @param {(input: {governed_scope, definitions, contract_bundle}) =>
 *   (Promise<object>|object)} args.provider
 *   Injected producer. Must resolve to
 *   `{ provider_id, model_id, prompt?, prompt_digest?, proposals: [...] }`.
 *   A test passes a function that returns a recorded fixture; a live runner
 *   passes a function that calls a model. Either way this module never
 *   knows the difference.
 * @returns {Promise<{proposals: object[], producer_receipt: object}>}
 */
async function produceCandidateProposals({
  governed_scope,
  definitions,
  contract_bundle,
  provider,
} = {}) {
  requirePlainObject(governed_scope, 'governed_scope');
  requirePlainObject(definitions, 'definitions');
  requirePlainObject(contract_bundle, 'contract_bundle');
  if (typeof provider !== 'function') {
    throw new TypeError('provider must be a function: inject a recorded fixture in tests, a live call at runtime');
  }

  const inputScopeDigest = contentId(INPUT_SCOPE_DIGEST_DOMAIN, {
    governed_scope,
    definitions,
    contract_bundle,
  });

  const providerOutput = await provider({ governed_scope, definitions, contract_bundle });
  requirePlainObject(providerOutput, 'provider output');

  const providerId = requireNonEmptyString(providerOutput.provider_id, 'provider output.provider_id');
  const modelId = requireNonEmptyString(providerOutput.model_id, 'provider output.model_id');
  if (!Array.isArray(providerOutput.proposals)) {
    throw new TypeError('provider output.proposals must be an array');
  }

  const promptDigest = providerOutput.prompt_digest
    ? requireNonEmptyString(providerOutput.prompt_digest, 'provider output.prompt_digest')
    : contentId(PROMPT_DIGEST_DOMAIN, providerOutput.prompt ?? null);

  const proposals = providerOutput.proposals.map((proposal) => deepFreeze({ ...proposal }));

  // Evidence the provider could not verify is a FIRST-CLASS RESIDUAL, never a
  // silent omission. A quote that does not reproduce byte-identically from the
  // source cannot be compiled into a candidate -- but the fact that the model
  // asserted something we could not evidence is itself information, and losing
  // it would be an invisible false negative. Residuals are carried out
  // alongside the proposals AND their count is bound into the content-addressed
  // receipt, so a run that dropped evidence can never present as a clean run.
  const evidenceResiduals = Array.isArray(providerOutput.evidence_residuals)
    ? providerOutput.evidence_residuals.map((residual) => deepFreeze({ ...residual }))
    : [];

  const receiptBody = {
    schema_version: PRODUCER_RECEIPT_SCHEMA,
    provider_id: providerId,
    model_id: modelId,
    prompt_digest: promptDigest,
    input_scope_digest: inputScopeDigest,
    proposal_count: proposals.length,
    evidence_residual_count: evidenceResiduals.length,
  };
  const producerReceiptId = contentId(PRODUCER_RECEIPT_SCHEMA, receiptBody);

  return Object.freeze({
    proposals: Object.freeze(proposals),
    evidence_residuals: Object.freeze(evidenceResiduals),
    producer_receipt: Object.freeze({
      ...receiptBody,
      producer_receipt_id: producerReceiptId,
    }),
  });
}

module.exports = {
  PRODUCER_RECEIPT_SCHEMA,
  produceCandidateProposals,
};
