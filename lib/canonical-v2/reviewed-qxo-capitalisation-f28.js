const {
  canonicalJson,
  contentId,
} = require('./canonical-bytes');
const {
  buildRelationshipRevision,
} = require('./claims-relationships');
const {
  METRIC_DEFINITIONS,
  RESULT_DEFINITION_V3,
} = require('./qxo-capitalisation-contract-input-validator');
const {
  BUYER_GROUP_PARTY,
  CLAUSE_B_CLASS,
  CLAUSE_C_CLASS,
  COMPANY_PARTY,
  buildQxoReviewedCapitalisationF27,
  validateQxoReviewedCapitalisationF27,
} = require('./reviewed-qxo-capitalisation-f27');

const REVIEW_VERSION = 'QXO_CAPITALISATION_BRING_DOWN_F28/V1';

function clone(value) {
  return JSON.parse(canonicalJson(value));
}

function freeze(value) {
  if (!value || typeof value !== 'object' || Object.isFrozen(value)) return value;
  Object.values(value).forEach(freeze);
  return Object.freeze(value);
}

function rawEvidence(entries) {
  return entries.map((entry) => ({
    evidence_role: entry.evidence_role,
    excerpt_id: entry.excerpt_id,
    document_ordinal: entry.document_ordinal,
    absolute_start: entry.absolute_start,
    absolute_end: entry.absolute_end,
    ordinal: entry.ordinal,
  }));
}

function successorBringDown(predecessor) {
  return buildRelationshipRevision({
    source_occurrence_id: predecessor.source_occurrence_id,
    relationship_definition_key: 'BRINGS_DOWN',
    relationship_definition_version: 3,
    ordinal: predecessor.ordinal,
    state: predecessor.state,
    raw_scope: predecessor.raw_scope,
    target_occurrence_ids: predecessor.target_occurrence_ids,
    effect: {
      ...clone(predecessor.effect),
      effect_schema_version: 2,
    },
    evidence: rawEvidence(predecessor.evidence),
    scope: clone(predecessor.scope),
    resolver_version: REVIEW_VERSION,
  });
}

function successorDefinitionUse(predecessor, clauseBRelationship) {
  const occurrenceId = contentId('RELATIONSHIP_OCCURRENCE/V1', {
    source_occurrence_id: clauseBRelationship.relationship_occurrence_id,
    relationship_definition_key: 'USES_DEFINITION',
    relationship_definition_version: 4,
    ordinal: predecessor.ordinal,
  });
  const effect = clone(predecessor.effect);
  effect.affected_endpoint.endpoint_id =
    clauseBRelationship.relationship_occurrence_id;
  effect.relationship_interpretation_payload_id = contentId(
    'RELATIONSHIP_INTERPRETATION/V1',
    {
      relationship_occurrence_id: occurrenceId,
      policy_version: REVIEW_VERSION,
      clarity_state: 'CLEAR',
      primary_interpretation:
        'COMPANY_FULLY_DILUTED_EQUITY_CAPITALISATION',
      alternative_interpretations: [],
      ambiguity_dimension_codes: [],
      evidence_by_role: clone(effect.evidence_by_role),
      lawyer_note_digest: contentId(
        'LAWYER_NOTE/V1',
        'Company representation selects Company denominator',
      ),
      review_provenance: REVIEW_VERSION,
    },
  );
  return buildRelationshipRevision({
    source_occurrence_id: clauseBRelationship.relationship_occurrence_id,
    relationship_definition_key: 'USES_DEFINITION',
    relationship_definition_version: 4,
    ordinal: predecessor.ordinal,
    state: predecessor.state,
    raw_scope: predecessor.raw_scope,
    target_occurrence_ids: predecessor.target_occurrence_ids,
    effect,
    evidence: rawEvidence(predecessor.evidence),
    scope: clone(predecessor.scope),
    resolver_version: REVIEW_VERSION,
  });
}

function buildQxoReviewedCapitalisationF28(inputs = {}) {
  const predecessor = buildQxoReviewedCapitalisationF27(inputs);
  validateQxoReviewedCapitalisationF27({
    candidate: predecessor,
    ...inputs,
  });
  const predecessorBringDown = predecessor.relationships
    .filter((entry) => entry.relationship_definition_key === 'BRINGS_DOWN')
    .sort((left, right) => left.ordinal - right.ordinal);
  const predecessorDefinitionUse = predecessor.relationships.find(
    (entry) => entry.relationship_definition_key === 'USES_DEFINITION',
  );
  if (predecessorBringDown.length !== 2 || !predecessorDefinitionUse) {
    throw new TypeError('the reviewed F27 relationship inventory is incomplete');
  }
  const bringDown = predecessorBringDown.map(successorBringDown);
  const definitionUse = successorDefinitionUse(
    predecessorDefinitionUse,
    bringDown[0],
  );
  const relationships = [
    bringDown[0],
    bringDown[1],
    definitionUse,
  ];
  const resultInputs = predecessor.result_inputs.map((entry) => {
    const value = clone(entry);
    if (value.comparison_class_key === CLAUSE_B_CLASS) {
      value.relationship_revision_ids = [
        bringDown[0].relationship_revision_id,
        definitionUse.relationship_revision_id,
      ];
    } else if (value.comparison_class_key === CLAUSE_C_CLASS) {
      value.relationship_revision_ids = [
        bringDown[1].relationship_revision_id,
      ];
    }
    return value;
  });
  const body = {
    schema_version: 'QXO_REVIEWED_CAPITALISATION_F28/V1',
    review_version: REVIEW_VERSION,
    predecessor_reviewed_graph_id:
      predecessor.qxo_reviewed_capitalisation_f27_id,
    predecessor_reviewed_graph_payload_digest:
      predecessor.canonical_payload_digest,
    parser_source_closure_id: predecessor.parser_source_closure_id,
    source_context_id: predecessor.source_context_id,
    document_hash: predecessor.document_hash,
    canonical_text_id: predecessor.canonical_text_id,
    party: clone(BUYER_GROUP_PARTY),
    representation_maker: clone(COMPANY_PARTY),
    source_party_tokens: clone(predecessor.source_party_tokens),
    provisions: clone(predecessor.provisions),
    representation_components: clone(predecessor.representation_components),
    condition_group_components: clone(
      predecessor.condition_group_components,
    ),
    claims: clone(predecessor.claims),
    relationships,
    result_contract: clone(RESULT_DEFINITION_V3),
    metric_contracts: clone(METRIC_DEFINITIONS),
    result_inputs: resultInputs,
    source_excerpts: clone(predecessor.source_excerpts),
    authority: {
      review_publication_authority: 'INACTIVE_CANDIDATE_ONLY',
      market_cohort_authority: 'NONE_PENDING_F28_CERTIFICATION',
      active_release_authority: 'NONE',
      corpus_write_authority: 'NONE',
      production_activation_authority: 'NONE',
    },
  };
  return freeze({
    ...body,
    qxo_reviewed_capitalisation_f28_id: contentId(
      'QXO_REVIEWED_CAPITALISATION_F28/V1',
      body,
    ),
    canonical_payload_digest: contentId(
      'QXO_REVIEWED_CAPITALISATION_F28_PAYLOAD/V1',
      body,
    ),
  });
}

function validateQxoReviewedCapitalisationF28({
  candidate,
  ...inputs
} = {}) {
  const expected = buildQxoReviewedCapitalisationF28(inputs);
  if (canonicalJson(candidate) !== canonicalJson(expected)) {
    throw new TypeError('the reviewed QXO F28 capitalisation graph has drifted');
  }
  return true;
}

module.exports = {
  BUYER_GROUP_PARTY,
  CLAUSE_B_CLASS,
  CLAUSE_C_CLASS,
  COMPANY_PARTY,
  REVIEW_VERSION,
  buildQxoReviewedCapitalisationF28,
  validateQxoReviewedCapitalisationF28,
};
