const {
  canonicalJson,
  contentId,
} = require('./canonical-bytes');
const {
  assembleCanonicalContractBundleReviewedRegistries,
} = require('./canonical-contract-bundle-reviewed-registry-assembler');

const PROPOSAL_SCHEMA_VERSION =
  'CANONICAL_CONTRACT_BUNDLE_CURRENT_ROOT_PROPOSAL/V1';
const GOVERNANCE_OBJECT_KIND =
  'CANONICAL_BUNDLE_INPUT_REQUIRED_KIND_REGISTRY';

const MEMBER_KIND_BY_OBJECT_KIND = Object.freeze({
  AGREEMENT_NAVIGATION_CATALOGUE_INPUT: 'CORE_CANONICAL_CONTRACT',
  AGREEMENT_PREDICATE_CONTRACT_INPUT: 'SEMANTIC_CATALOGUE',
  AGREEMENT_QUERY_ORDERING_CONTRACT_INPUT: 'COMPARABILITY',
  CAPITALISATION_SEMANTIC_SCHEMA_INPUT: 'COMPOSITION_CATALOGUE',
  CLAIM_DEFINITION: 'SEMANTIC_CATALOGUE',
  CLAIM_INTERPRETATION_POLICY: 'CORE_CANONICAL_CONTRACT',
  CLAIM_STATE_CODEBOOK_MIGRATION_INPUT: 'CORE_CANONICAL_CONTRACT',
  COMPONENT_DEFINITION: 'COMPOSITION_CATALOGUE',
  MARKET_METRIC_DEFINITION_INPUT: 'COMPARABILITY',
  MONEY_DENOMINATOR_PRECISION_POLICY: 'COMPARABILITY',
  NO_SHOP_SEMANTIC_SCHEMA_INPUT: 'COMPOSITION_CATALOGUE',
  PARSER_PROPOSAL_BOUNDARY_DEFINITION: 'OPEN_WORLD_CONCEPT',
  PARTY_TUPLE_SHAPE_MIGRATION_INPUT: 'CORE_CANONICAL_CONTRACT',
  PROCESS_CONTROLLED_CODE_REGISTRY_INPUT: 'SEMANTIC_CATALOGUE',
  PROCESS_DOMAIN_REGISTRY_INPUT: 'SEMANTIC_CATALOGUE',
  PROCESS_EXCLUSIVITY_COMPLETENESS_CHALLENGE_CATALOGUE: 'SEMANTIC_CATALOGUE',
  PROCESS_EXPECTED_OCCURRENCE_SLOT_INPUT: 'CORE_CANONICAL_CONTRACT',
  PROCESS_FIELD_CATALOGUE_INPUT: 'RELATIONSHIP_EFFECT_FIELD_UNIVERSE',
  PROCESS_GATE_CONTRACT_INPUT: 'CORE_CANONICAL_CONTRACT',
  PROCESS_INTEGRITY_CONTRACT_INPUT: 'CORE_CANONICAL_CONTRACT',
  PROCESS_LOGICAL_TYPE_INPUT: 'CORE_CANONICAL_CONTRACT',
  PROCESS_NAVIGATION_CATALOGUE_INPUT: 'CORE_CANONICAL_CONTRACT',
  PROCESS_PREDICATE_CONTRACT_INPUT: 'SEMANTIC_CATALOGUE',
  PROCESS_QUERY_CONTRACT_INPUT: 'CORE_CANONICAL_CONTRACT',
  PROCESS_RESULT_ACTION_CONTRACT_INPUT: 'CORE_CANONICAL_CONTRACT',
  PRODUCT_QUERY_ACTION_CONTRACT_INPUT: 'CORE_CANONICAL_CONTRACT',
  PRODUCT_QUERY_CONTRACT_INPUT: 'CORE_CANONICAL_CONTRACT',
  PRODUCT_QUERY_RESULT_CONTRACT_INPUT: 'COMPOSITION_CATALOGUE',
  PRODUCT_RESULT_ACTION_CONTRACT_INPUT: 'CORE_CANONICAL_CONTRACT',
  PRODUCT_RESULT_PRESENTATION_CONTRACT_INPUT: 'CORE_CANONICAL_CONTRACT',
  PRODUCT_SOURCE_READER_CONTRACT_INPUT: 'CORE_CANONICAL_CONTRACT',
  PROVISION_CONCEPT: 'SEMANTIC_CATALOGUE',
  RELATIONSHIP_DEFINITION: 'RELATIONSHIP_EFFECT_FIELD_UNIVERSE',
  RELATIONSHIP_EFFECT_SCHEMA: 'RELATIONSHIP_EFFECT_FIELD_UNIVERSE',
  RESIDUAL_REASON_CODEBOOK_MIGRATION_INPUT: 'GOVERNED_RESIDUAL',
  RESULT_DEFINITION_INPUT: 'COMPOSITION_CATALOGUE',
  SERVING_EXACT_DETAIL_ACTION_DEFINITION: 'CORE_CANONICAL_CONTRACT',
  SERVING_METRIC_OPERATION_BINDING_INPUT: 'COMPARABILITY',
  SERVING_PROCESS_CONTRACT_INPUT: 'COMPOSITION_CATALOGUE',
  SERVING_TRIGGER_PATH_SCHEMA_INPUT: 'RELATIONSHIP_EFFECT_FIELD_UNIVERSE',
  SHARED_AUTHORITY_FIELD_CATALOGUE_INPUT: 'RELATIONSHIP_EFFECT_FIELD_UNIVERSE',
  SHARED_AUTHORITY_LOGICAL_TYPE_INPUT: 'CORE_CANONICAL_CONTRACT',
  SOURCE_ACQUISITION_CONTRACT_INPUT: 'CORE_CANONICAL_CONTRACT',
});

const SOURCE_SPECIFIC_PATH_FRAGMENTS = Object.freeze([
  'agreement/navigation/qxo-capitalisation-',
  'agreement/predicates/qxo-capitalisation-',
  'product/query/qxo-capitalisation-',
]);

const OPEN_WORLD_STABLE_IDS = Object.freeze(new Set([
  'PARSER_V2_STRUCTURAL_DEFINITION_PROPOSAL',
  'REVIEWED_SOURCE_SPECIFIC_OPEN_WORLD_EVIDENCE',
]));

const RELATIONSHIP_STABLE_IDS = Object.freeze(new Set([
  'DEAL_PARTICIPANT_RELATIONSHIP',
  'LAWYER_FIRM_AFFILIATION_RELATIONSHIP',
  'PROCESS_RELATIONSHIP',
  'PROFESSIONAL_ASSIGNMENT_RELATIONSHIP',
]));

const REMOVED_REFERENCE_EDGES = Object.freeze(new Set([
  'agreement/result-definitions/target-capitalisation-bring-down.v3.json\u0000agreement/market-metric-definitions/dated-representation-treatment.v1.json',
  'agreement/result-definitions/target-capitalisation-bring-down.v3.json\u0000agreement/market-metric-definitions/general-materiality-qualifier-state.v1.json',
  'agreement/result-definitions/target-capitalisation-bring-down.v3.json\u0000agreement/market-metric-definitions/knowledge-qualifier-state.v1.json',
  'agreement/result-definitions/target-capitalisation-bring-down.v3.json\u0000agreement/market-metric-definitions/representation-accuracy-exception-denominator.v1.json',
  'agreement/result-definitions/target-capitalisation-bring-down.v3.json\u0000agreement/market-metric-definitions/representation-accuracy-exception.v1.json',
  'agreement/result-definitions/target-capitalisation-bring-down.v3.json\u0000agreement/market-metric-definitions/representation-accuracy-standard.v3.json',
  'agreement/result-definitions/target-capitalisation-bring-down.v3.json\u0000agreement/market-metric-definitions/representation-materiality-scrape.v1.json',
  'agreement/result-definitions/target-capitalisation-bring-down.v3.json\u0000agreement/market-metric-definitions/representation-measurement-date-signing-offset.v1.json',
  'agreement/result-definitions/target-capitalisation-bring-down.v3.json\u0000agreement/market-metric-definitions/retrospective-lookback-state.v1.json',
  'process/occurrence-slots/process-event.v1.json\u0000process/events/process-event.v1.json',
  'process/occurrence-slots/process-event.v1.json\u0000process/participants/process-participant.v1.json',
  'process/occurrence-slots/process-narration.v1.json\u0000process/narration/process-narration-occurrence.v1.json',
  'process/serving/bounded-inline-passage-preview.v1.json\u0000process/results/process-phrasebook-passage-result.v1.json',
  'shared/temporal/temporal-expression.v1.json\u0000process/events/process-event.v1.json',
]));

class CanonicalContractBundleCurrentRootError extends Error {
  constructor(code, message, details = {}) {
    super(message);
    this.name = 'CanonicalContractBundleCurrentRootError';
    this.code = code;
    this.details = details;
  }
}

function fail(code, message, details = {}) {
  throw new CanonicalContractBundleCurrentRootError(code, message, details);
}

function clone(value) {
  return JSON.parse(canonicalJson(value));
}

function deepFreeze(value) {
  if (!value || typeof value !== 'object' || Object.isFrozen(value)) return value;
  Object.values(value).forEach(deepFreeze);
  return Object.freeze(value);
}

function identityOf(member) {
  return {
    relative_path: member.relative_path,
    object_kind: member.object_kind,
    stable_id: member.stable_id,
    schema_version: member.schema_version,
    canonical_bytes_digest: member.canonical_bytes_digest,
  };
}

function identityKey(value) {
  return canonicalJson(value);
}

function collectStringLeaves(value, currentPath = '', output = []) {
  if (typeof value === 'string') {
    output.push([currentPath, value]);
  } else if (Array.isArray(value)) {
    value.forEach((entry, index) => {
      collectStringLeaves(entry, `${currentPath}[${index}]`, output);
    });
  } else if (value && typeof value === 'object') {
    Object.entries(value).forEach(([key, entry]) => {
      if (
        currentPath === ''
        && ['object_kind', 'schema_version', 'stable_id'].includes(key)
      ) {
        return;
      }
      collectStringLeaves(
        entry,
        currentPath === '' ? key : `${currentPath}.${key}`,
        output,
      );
    });
  }
  return output;
}

function memberKind(member) {
  if (
    SOURCE_SPECIFIC_PATH_FRAGMENTS.some(
      (fragment) => member.relative_path.includes(fragment),
    )
  ) {
    return 'SOURCE_SPECIFIC_PUBLICATION';
  }
  if (OPEN_WORLD_STABLE_IDS.has(member.stable_id)) {
    return 'OPEN_WORLD_CONCEPT';
  }
  if (RELATIONSHIP_STABLE_IDS.has(member.stable_id)) {
    return 'RELATIONSHIP_EFFECT_FIELD_UNIVERSE';
  }
  const selected = MEMBER_KIND_BY_OBJECT_KIND[member.object_kind];
  if (!selected) {
    fail(
      'UNCLASSIFIED_CANONICAL_CONTRACT_INPUT',
      'Every authored input requires one explicit bundle classification.',
      {
        object_kind: member.object_kind,
        relative_path: member.relative_path,
        stable_id: member.stable_id,
      },
    );
  }
  return selected;
}

function referencedMembers(member, membersByStableId) {
  const dependencies = new Map();
  for (const [valuePath, stableId] of collectStringLeaves(member.canonical_value)) {
    let candidates = membersByStableId.get(stableId) || [];
    if (candidates.length > 1) {
      if (/metric/i.test(valuePath)) {
        candidates = candidates.filter(
          (candidate) => candidate.object_kind === 'MARKET_METRIC_DEFINITION_INPUT',
        );
      } else if (/claim/i.test(valuePath)) {
        candidates = candidates.filter(
          (candidate) => candidate.object_kind === 'CLAIM_DEFINITION',
        );
      } else {
        fail(
          'AMBIGUOUS_CANONICAL_CONTRACT_REFERENCE',
          'A stable-ID reference does not select one authored contract.',
          {
            relative_path: member.relative_path,
            value_path: valuePath,
            stable_id: stableId,
            candidate_paths: candidates.map((candidate) => candidate.relative_path),
          },
        );
      }
    }
    for (const candidate of candidates) {
      if (candidate.relative_path === member.relative_path) continue;
      const edgeKey = `${member.relative_path}\u0000${candidate.relative_path}`;
      if (REMOVED_REFERENCE_EDGES.has(edgeKey)) continue;
      dependencies.set(identityKey(identityOf(candidate)), identityOf(candidate));
    }
  }
  return [...dependencies.values()].sort(
    (left, right) => identityKey(left).localeCompare(identityKey(right)),
  );
}

function assembleCanonicalContractBundleCurrentRootProposal({
  canonical_contract_input_compilation: compilation,
} = {}) {
  if (
    !compilation
    || !Array.isArray(compilation.authored_members)
    || compilation.authored_universe_assessment?.status
      !== 'COMPLETE_AGAINST_GOVERNED_REQUIRED_KIND_REGISTRY'
    || compilation.disposition?.status
      !== 'AUTHORED_UNIVERSE_MECHANICALLY_COMPLETE'
  ) {
    fail(
      'INCOMPLETE_CANONICAL_CONTRACT_INPUT_COMPILATION',
      'The current-root proposal requires one mechanically complete authored universe.',
    );
  }
  const members = compilation.authored_members.filter(
    (member) => member.object_kind !== GOVERNANCE_OBJECT_KIND,
  );
  const membersByStableId = new Map();
  for (const member of members) {
    const values = membersByStableId.get(member.stable_id) || [];
    values.push(member);
    membersByStableId.set(member.stable_id, values);
  }
  const proposedDispositions = members.map((member) => ({
    authored_identity: identityOf(member),
    member_kind: memberKind(member),
    ordered_dependency_identities: referencedMembers(member, membersByStableId),
  })).sort(
    (left, right) => identityKey(left.authored_identity)
      .localeCompare(identityKey(right.authored_identity)),
  );
  const registryAssembly = assembleCanonicalContractBundleReviewedRegistries({
    canonical_contract_input_compilation: compilation,
    reviewed_dispositions: proposedDispositions,
    registry_version: 1,
    predecessor_classification_registry: null,
    predecessor_dependency_registry: null,
  });
  const classificationCounts = {};
  for (const disposition of proposedDispositions) {
    classificationCounts[disposition.member_kind] =
      (classificationCounts[disposition.member_kind] || 0) + 1;
  }
  const payload = {
    canonical_bundle_input_identity_id:
      compilation.canonical_bundle_input_identity
        .canonical_bundle_input_identity_id,
    proposed_dispositions: proposedDispositions,
    classification_counts: Object.fromEntries(
      Object.entries(classificationCounts).sort(([left], [right]) => (
        left.localeCompare(right)
      )),
    ),
    dependency_edge_count: proposedDispositions.reduce(
      (count, disposition) => (
        count + disposition.ordered_dependency_identities.length
      ),
      0,
    ),
    registry_assembly: registryAssembly,
    disposition: {
      state: 'PROPOSED_FOR_EXACT_ROOT_REVIEW',
      caller_disposition_authenticity: 'NOT_ESTABLISHED',
      stage_4_review: 'NOT_SUPPLIED',
      ben_approval: 'NOT_SUPPLIED',
      freeze_authority: 'NONE',
      writer_authority: 'NONE',
      serving_authority: 'NONE',
      release_authority: 'NONE',
      activation_authority: 'NONE',
      production_authority: 'NONE',
    },
  };
  return deepFreeze({
    schema_version: PROPOSAL_SCHEMA_VERSION,
    ...clone(payload),
    proposal_payload_digest: contentId(
      'CANONICAL_CONTRACT_BUNDLE_CURRENT_ROOT_PROPOSAL_PAYLOAD/V1',
      payload,
    ),
  });
}

module.exports = {
  PROPOSAL_SCHEMA_VERSION,
  MEMBER_KIND_BY_OBJECT_KIND,
  SOURCE_SPECIFIC_PATH_FRAGMENTS,
  OPEN_WORLD_STABLE_IDS,
  RELATIONSHIP_STABLE_IDS,
  REMOVED_REFERENCE_EDGES,
  CanonicalContractBundleCurrentRootError,
  assembleCanonicalContractBundleCurrentRootProposal,
};
