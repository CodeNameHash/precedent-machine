'use strict';

/**
 * lib/canonical-v2/deal-topology-from-claims.js
 *
 * Merges model-extracted transaction-step claims with detector-inferred steps
 * into a single deal topology row. Pure derivation — no I/O.
 *
 * Precedence (topology-investigation.md §7.5 / DECISIONS.md §14):
 * - Model-extracted steps win when present (step_source MODEL_EXTRACTED).
 * - Detector-inferred steps are the fallback (step_source DETECTOR_INFERRED),
 *   always flagged topology_needs_review.
 * - When both exist and disagree on topology, model wins but
 *   topology_needs_review is forced.
 * - Neither source → UNDETERMINED.
 */

const {
  TOPOLOGIES,
  CONCURRENCY,
  deriveTopology,
  enforceTransactionStepInvariants,
  sortedSteps,
} = require('../schema/topology-detector');

const STEP_SOURCES = Object.freeze({
  MODEL_EXTRACTED: 'MODEL_EXTRACTED',
  DETECTOR_INFERRED: 'DETECTOR_INFERRED',
  UNDETERMINED: 'UNDETERMINED',
});

const MERGER_TRANSACTION_STEP_DEFINITION = 'MERGER_TRANSACTION_STEP';
const MERGER_STRUCTURE_MECHANIC_DEFINITION = 'MERGER_STRUCTURE_MECHANIC_PRESENT';
const DEFAULT_PRIMARY_STEP_SECTION_REFERENCE = '1.1';
const DEFAULT_CONCURRENCY_SECTION_REFERENCE = '1.4';

function claimDefinitionKey(claim) {
  return claim.resolved_claim_definition_key || claim.claim_definition_key || null;
}

function claimAttributes(claim) {
  return claim.claim?.attributes || claim.attributes || {};
}

function claimRawValue(claim) {
  return claim.claim?.raw_value || claim.raw_value || '';
}

function claimSectionReference(claim) {
  return claim.section_reference || claim.source_citation || null;
}

function claimToStep(claim) {
  const attrs = claimAttributes(claim);
  return {
    step_order: Number(attrs.step_order),
    step_kind: attrs.step_kind,
    disappearing_entity: attrs.disappearing_entity || null,
    surviving_entity: attrs.surviving_entity || null,
    parent_entity: attrs.parent_entity || null,
    concurrency: attrs.concurrency || CONCURRENCY.SEQUENTIAL,
  };
}

function stepsFromModelClaims(claims) {
  const stepClaims = (claims || []).filter(
    (claim) => claimDefinitionKey(claim) === MERGER_TRANSACTION_STEP_DEFINITION,
  );
  if (stepClaims.length === 0) return null;
  return sortedSteps(stepClaims.map(claimToStep));
}

function hasRequiredStepEntities(claim) {
  const attrs = claimAttributes(claim);
  const quote = claimRawValue(claim);
  return typeof attrs.disappearing_entity === 'string'
    && attrs.disappearing_entity.length > 0
    && typeof attrs.surviving_entity === 'string'
    && attrs.surviving_entity.length > 0
    && quote.includes(attrs.disappearing_entity)
    && quote.includes(attrs.surviving_entity);
}

function citedPrimaryModelClaims(claims, { primarySectionReference } = {}) {
  const reference = primarySectionReference || DEFAULT_PRIMARY_STEP_SECTION_REFERENCE;
  const primary = (claims || []).filter((claim) => (
    claimDefinitionKey(claim) === MERGER_TRANSACTION_STEP_DEFINITION
      && claimSectionReference(claim) === reference
  ));
  if (primary.length === 0 || primary.some((claim) => !hasRequiredStepEntities(claim))) return [];
  return primary;
}

function isUnambiguousConcurrencyClaim(claim, { concurrencySectionReference } = {}) {
  const reference = concurrencySectionReference || DEFAULT_CONCURRENCY_SECTION_REFERENCE;
  if (claimDefinitionKey(claim) !== MERGER_STRUCTURE_MECHANIC_DEFINITION
    || claimSectionReference(claim) !== reference
    || claimAttributes(claim).assertion_kind !== 'CLOSING_TIMING') return false;
  const quote = claimRawValue(claim);
  if (!/\b(?:contemporaneously|simultaneously)\b/i.test(quote)
    || !/\bEffective Time\b[\s\S]*\bEffective Time\b/i.test(quote)) return false;
  return !/\b(?:or|and\/or)\b[\s\S]{0,80}\b(?:after|following|later|sequentially)\b/i.test(quote);
}

function mergeDealTopologyAcrossCitedSections({
  modelClaims = [],
  detectorSteps = [],
  primarySectionReference = DEFAULT_PRIMARY_STEP_SECTION_REFERENCE,
  concurrencySectionReference = DEFAULT_CONCURRENCY_SECTION_REFERENCE,
} = {}) {
  const primaryClaims = citedPrimaryModelClaims(modelClaims, { primarySectionReference });
  const hasConcurrentTiming = (modelClaims || []).some((claim) => isUnambiguousConcurrencyClaim(claim, {
    concurrencySectionReference,
  }));
  const mergedClaims = hasConcurrentTiming
    ? primaryClaims.map((claim) => (claim.claim
      ? { ...claim, claim: { ...claim.claim, attributes: { ...claim.claim.attributes, concurrency: CONCURRENCY.PARALLEL } } }
      : { ...claim, attributes: { ...claim.attributes, concurrency: CONCURRENCY.PARALLEL } }))
    : primaryClaims;
  return mergeDealTopology({ modelClaims: mergedClaims, detectorSteps });
}

function topologyForSteps(steps, needsReview) {
  return deriveTopology(steps, { needsReview }).topology;
}

function sourcesDisagree(modelSteps, detectorSteps) {
  if (!modelSteps || !detectorSteps) return false;
  return topologyForSteps(modelSteps, false) !== topologyForSteps(detectorSteps, true);
}

function mergeDealTopology({
  modelClaims = [],
  detectorSteps = [],
} = {}) {
  const modelSteps = stepsFromModelClaims(modelClaims);
  const hasModel = Boolean(modelSteps && modelSteps.length > 0);
  const hasDetector = Array.isArray(detectorSteps) && detectorSteps.length > 0;

  if (!hasModel && !hasDetector) {
    return {
      topology: TOPOLOGIES.UNDETERMINED,
      step_count: 0,
      primary_step_order: null,
      topology_needs_review: true,
      review_note: 'No transaction steps from model or detector.',
      step_source: STEP_SOURCES.UNDETERMINED,
      transaction_steps: [],
      warnings: [],
      detector_topology: null,
    };
  }

  const chosenSteps = hasModel ? modelSteps : sortedSteps(detectorSteps);
  const stepSource = hasModel ? STEP_SOURCES.MODEL_EXTRACTED : STEP_SOURCES.DETECTOR_INFERRED;
  const disagree = hasModel && hasDetector && sourcesDisagree(modelSteps, detectorSteps);
  const needsReview = stepSource === STEP_SOURCES.DETECTOR_INFERRED || disagree;

  const topologyRow = deriveTopology(chosenSteps, {
    needsReview,
    reviewNote: disagree ? 'Model and detector topology disagree.' : null,
  });
  const { warnings } = enforceTransactionStepInvariants(chosenSteps, topologyRow);

  return {
    ...topologyRow,
    topology_needs_review: needsReview || Boolean(topologyRow.topology_needs_review),
    step_source: stepSource,
    transaction_steps: chosenSteps,
    warnings,
    detector_topology: disagree ? topologyForSteps(detectorSteps, true) : null,
  };
}

module.exports = {
  STEP_SOURCES,
  MERGER_TRANSACTION_STEP_DEFINITION,
  claimDefinitionKey,
  claimAttributes,
  claimRawValue,
  claimSectionReference,
  claimToStep,
  stepsFromModelClaims,
  hasRequiredStepEntities,
  citedPrimaryModelClaims,
  isUnambiguousConcurrencyClaim,
  mergeDealTopology,
  mergeDealTopologyAcrossCitedSections,
};
