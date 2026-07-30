const {
  canonicalJson,
  contentId,
  sha256Hex,
} = require('./canonical-bytes');
const {
  compareCanonicalSourceIntervalSets,
  validateProcessNarrationOccurrence,
} = require('./process-narration-occurrence');
const {
  validateProcessPhrasebookResultIdentity,
} = require('./process-phrasebook-result');
const resultContract = require(
  '../../contracts/canonical-v2/successor/process/results/process-phrasebook-passage-result.v1.json',
);

const PROCESS_PASSAGE_ORDERING_FACT_SCHEMA =
  'PROCESS_PASSAGE_ORDERING_FACT/V1';
const PROCESS_PASSAGE_ORDERING_PROJECTION_SCHEMA =
  'PROCESS_PASSAGE_ORDERING_PROJECTION/V1';
const SHA256_RE = /^[a-f0-9]{64}$/;
const MAX_CANDIDATES = 512;
const MIN_PAGE_SIZE = 8;
const MAX_PAGE_SIZE = 12;
const NARRATION_TREATMENTS = Object.freeze([
  'SOURCE_LOCAL_PRIMARY_NARRATION',
  'LATER_RETELLING',
]);
const AUTHORITY_LIMITS = Object.freeze({
  execution: 'NONE',
  ordering_fact_validation: 'NONE',
  result_materialisation: 'NONE',
  query: 'NONE',
  source_read: 'NONE',
  serving: 'NONE',
  writer: 'NONE',
  release: 'NONE',
  canonical_write: 'NONE',
  database: 'NONE',
  import: 'NONE',
  activation: 'NONE',
});

class ProcessPassageOrderError extends Error {
  constructor(code, message, details = {}) {
    super(message);
    this.name = 'ProcessPassageOrderError';
    this.code = code;
    this.details = details;
  }
}

function fail(code, message, details = {}) {
  throw new ProcessPassageOrderError(code, message, details);
}

function requireObject(
  value,
  label,
  code = 'INVALID_PROCESS_PASSAGE_ORDER_INPUT',
) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    fail(code, `${label} must be an object.`);
  }
}

function requireExactKeys(
  value,
  expected,
  label,
  code = 'INVALID_PROCESS_PASSAGE_ORDER_INPUT',
) {
  requireObject(value, label, code);
  const actual = Object.keys(value).sort();
  const required = [...expected].sort();
  if (canonicalJson(actual) !== canonicalJson(required)) {
    fail(code, `${label} fields do not match the governed contract.`, {
      actual,
      expected: required,
    });
  }
}

function requireDigest(
  value,
  label,
  code = 'INVALID_PROCESS_PASSAGE_ORDER_INPUT',
) {
  if (!SHA256_RE.test(value || '')) {
    fail(code, `${label} must be a full SHA-256 digest.`);
  }
  return value;
}

function clone(value) {
  try {
    return JSON.parse(canonicalJson(value));
  } catch (error) {
    fail(
      'INVALID_PROCESS_PASSAGE_ORDER_INPUT',
      'The Process passage-order input is not canonical JSON.',
      { cause: error.message },
    );
  }
}

function deepFreeze(value) {
  if (!value || typeof value !== 'object' || Object.isFrozen(value)) {
    return value;
  }
  Object.values(value).forEach(deepFreeze);
  return Object.freeze(value);
}

function validateContractBinding() {
  const code = 'INVALID_PROCESS_PASSAGE_ORDER_CONTRACT_BINDING';
  const ordering = resultContract.definition?.ordering_contract;
  if (
    resultContract.object_kind !== 'SERVING_PROCESS_CONTRACT_INPUT'
    || resultContract.stable_id !== 'PROCESS_PHRASEBOOK_PASSAGE_RESULT'
    || resultContract.schema_version !== 'SERVING_PROCESS_CONTRACT_INPUT/V1'
  ) {
    fail(code, 'The Process phrasebook result contract identity changed.');
  }
  requireExactKeys(ordering, [
    'total_comparator',
    'diversification_applies_after_total_comparator',
    'diversification_keys',
    'application_memory_can_recreate_ranking_authority',
  ], 'Process passage ordering contract', code);
  if (
    canonicalJson(ordering.total_comparator) !== canonicalJson([
      'DIRECT_PREDICATE_WITNESS_BEFORE_CONTEXTUAL_OR_RETOLD_EVIDENCE',
      'SOURCE_LOCAL_PRIMARY_NARRATION_BEFORE_LATER_RETELLING',
      'GOVERNED_SOURCE_ORDER',
    ])
    || ordering.diversification_applies_after_total_comparator !== true
    || canonicalJson(ordering.diversification_keys) !== canonicalJson([
      'governed_deal_admission_id',
      'bidder_track_id',
    ])
    || ordering.application_memory_can_recreate_ranking_authority !== false
  ) {
    fail(code, 'The Process passage ordering contract changed.');
  }
}

function orderingFactIdentityPayload(value) {
  const payload = clone(value);
  delete payload.ordering_fact_id;
  return payload;
}

function evidenceRank(resultIdentity) {
  return resultIdentity.exact_evidence_role_slot_key
    === 'DIRECT_PREDICATE_WITNESS'
    ? 0
    : 1;
}

function narrationRank(fact) {
  return NARRATION_TREATMENTS.indexOf(fact.narration_treatment);
}

function validateOrderingFact(value, releaseBinding) {
  const code = 'INVALID_PROCESS_PASSAGE_ORDERING_FACT';
  requireExactKeys(value, [
    'schema_version',
    'ordering_fact_id',
    'result_identity',
    'selected_narration_occurrence',
    'bidder_track_id',
    'narration_treatment',
    'candidate_release_manifest_id',
    'candidate_release_manifest_payload_digest',
    'external_validation_receipt_id',
    'validation_state',
    'authority_state',
  ], 'Process passage ordering fact', code);
  if (
    value.schema_version !== PROCESS_PASSAGE_ORDERING_FACT_SCHEMA
    || !NARRATION_TREATMENTS.includes(value.narration_treatment)
    || value.validation_state !== 'EXTERNALLY_VALIDATED'
    || value.authority_state !== 'NOT_GRANTED'
  ) {
    fail(code, 'The Process passage ordering fact state is invalid.');
  }
  [
    'ordering_fact_id',
    'candidate_release_manifest_id',
    'candidate_release_manifest_payload_digest',
    'external_validation_receipt_id',
  ].forEach((key) => requireDigest(value[key], `Ordering fact ${key}`, code));
  if (value.bidder_track_id !== null) {
    requireDigest(value.bidder_track_id, 'Ordering fact bidder track ID', code);
  }
  try {
    validateProcessPhrasebookResultIdentity(value.result_identity);
    validateProcessNarrationOccurrence(
      value.selected_narration_occurrence,
    );
  } catch (error) {
    fail(code, 'The Process passage ordering fact identity is invalid.', {
      cause: error.code || error.message,
    });
  }
  if (
    value.result_identity.precomputed_process_narration_occurrence_id
      !== value.selected_narration_occurrence
        .process_narration_occurrence_id
    || value.result_identity.governed_deal_admission_id
      !== value.selected_narration_occurrence
        .governed_deal_admission_id
    || value.result_identity.frozen_contract_pair_digest
      !== value.selected_narration_occurrence
        .frozen_contract_pair_digest
  ) {
    fail(
      code,
      'The selected narration occurrence does not bind the result identity.',
    );
  }
  if (
    value.candidate_release_manifest_id
      !== releaseBinding.candidate_release_manifest_id
    || value.candidate_release_manifest_payload_digest
      !== releaseBinding.candidate_release_manifest_payload_digest
  ) {
    fail(code, 'The ordering fact does not bind the selected release.');
  }
  if (
    value.ordering_fact_id !== contentId(
      PROCESS_PASSAGE_ORDERING_FACT_SCHEMA,
      orderingFactIdentityPayload(value),
    )
  ) {
    fail(code, 'The ordering fact identity does not match its contents.');
  }
  return true;
}

function compareText(left, right) {
  if (left < right) return -1;
  if (left > right) return 1;
  return 0;
}

function compareFacts(left, right) {
  const first = evidenceRank(left.result_identity)
    - evidenceRank(right.result_identity);
  if (first !== 0) return first;
  const second = narrationRank(left) - narrationRank(right);
  if (second !== 0) return second;
  const third = compareCanonicalSourceIntervalSets(
    left.selected_narration_occurrence.canonical_source_interval_set,
    right.selected_narration_occurrence.canonical_source_interval_set,
  );
  if (third !== 0) return third;
  return compareText(
    left.result_identity.process_phrasebook_passage_result_id,
    right.result_identity.process_phrasebook_passage_result_id,
  );
}

function diversificationKey(fact) {
  return [
    fact.result_identity.governed_deal_admission_id,
    fact.bidder_track_id || 'NO_BIDDER_TRACK',
  ].join(':');
}

function priorityKey(fact) {
  return `${evidenceRank(fact)}:${narrationRank(fact)}`;
}

function diversifyWithinPriorityTiers(sortedFacts) {
  const tiers = [];
  for (const fact of sortedFacts) {
    const key = priorityKey(fact);
    let tier = tiers[tiers.length - 1];
    if (!tier || tier.key !== key) {
      tier = {
        key,
        buckets: [],
        byKey: new Map(),
      };
      tiers.push(tier);
    }
    const bucketKey = diversificationKey(fact);
    let bucket = tier.byKey.get(bucketKey);
    if (!bucket) {
      bucket = [];
      tier.byKey.set(bucketKey, bucket);
      tier.buckets.push(bucket);
    }
    bucket.push(fact);
  }
  const ordered = [];
  for (const tier of tiers) {
    let remaining = true;
    for (let index = 0; remaining; index += 1) {
      remaining = false;
      for (const bucket of tier.buckets) {
        if (index < bucket.length) {
          ordered.push(bucket[index]);
          remaining = true;
        }
      }
    }
  }
  return ordered;
}

function projectionIdentityPayload(value) {
  const payload = clone(value);
  delete payload.ordering_projection_id;
  delete payload.canonical_payload_digest;
  return payload;
}

function buildProcessPassageOrder({
  product_query_definition_id: productQueryDefinitionId,
  candidate_release_manifest_id: candidateReleaseManifestId,
  candidate_release_manifest_payload_digest:
    candidateReleaseManifestPayloadDigest,
  page_size: pageSize,
  ordering_facts: orderingFacts,
}, validateOutput) {
  validateContractBinding();
  const releaseBinding = {
    candidate_release_manifest_id: requireDigest(
      candidateReleaseManifestId,
      'Candidate release manifest ID',
    ),
    candidate_release_manifest_payload_digest: requireDigest(
      candidateReleaseManifestPayloadDigest,
      'Candidate release manifest payload digest',
    ),
  };
  requireDigest(productQueryDefinitionId, 'Product query definition ID');
  if (
    !Number.isSafeInteger(pageSize)
    || pageSize < MIN_PAGE_SIZE
    || pageSize > MAX_PAGE_SIZE
  ) {
    fail(
      'INVALID_PROCESS_PASSAGE_PAGE_SIZE',
      'The Process passage page size must be between 8 and 12.',
    );
  }
  if (
    !Array.isArray(orderingFacts)
    || orderingFacts.length > MAX_CANDIDATES
  ) {
    fail(
      'INVALID_PROCESS_PASSAGE_ORDERING_FACT_SET',
      'The Process passage ordering fact set is invalid or too large.',
    );
  }
  orderingFacts.forEach((fact) => validateOrderingFact(fact, releaseBinding));
  const resultIds = orderingFacts.map(
    (fact) => fact.result_identity
      .process_phrasebook_passage_result_id,
  );
  if (new Set(resultIds).size !== resultIds.length) {
    fail(
      'DUPLICATE_PROCESS_PASSAGE_RESULT',
      'A Process phrasebook result appears more than once.',
    );
  }
  const canonicalFacts = [...orderingFacts].sort(
    (left, right) => compareText(
      left.ordering_fact_id,
      right.ordering_fact_id,
    ),
  );
  const sorted = [...canonicalFacts].sort(compareFacts);
  const diversified = diversifyWithinPriorityTiers(sorted);
  const orderedResultIds = diversified.map(
    (fact) => fact.result_identity
      .process_phrasebook_passage_result_id,
  );
  const body = {
    schema_version: PROCESS_PASSAGE_ORDERING_PROJECTION_SCHEMA,
    product_query_definition_id: productQueryDefinitionId,
    ...releaseBinding,
    ordering_contract_definition_digest: sha256Hex(
      Buffer.from(canonicalJson(
        resultContract.definition.ordering_contract,
      ), 'utf8'),
    ),
    ordering_fact_set_digest: sha256Hex(
      Buffer.from(canonicalJson(canonicalFacts), 'utf8'),
    ),
    validated_ordering_facts: clone(canonicalFacts),
    candidate_count: orderingFacts.length,
    page_size: pageSize,
    ordered_result_ids: orderedResultIds,
    first_page_result_ids: orderedResultIds.slice(0, pageSize),
    comparator_state: 'GOVERNED_TOTAL_COMPARATOR_APPLIED',
    diversification_state: 'DEAL_AND_BIDDER_TRACK_APPLIED',
    no_padding_or_repetition: true,
    projection_state: 'ORDERING_ONLY',
    serving_state: 'NOT_SERVED',
    authority_limits: clone(AUTHORITY_LIMITS),
  };
  const identityPayload = projectionIdentityPayload(body);
  const projection = {
    ...body,
    ordering_projection_id: contentId(
      PROCESS_PASSAGE_ORDERING_PROJECTION_SCHEMA,
      identityPayload,
    ),
    canonical_payload_digest: sha256Hex(
      Buffer.from(canonicalJson(identityPayload), 'utf8'),
    ),
  };
  if (validateOutput) {
    validateProcessPassageOrderProjection(projection);
  }
  return deepFreeze(clone(projection));
}

function compileProcessPassageOrder(input) {
  return buildProcessPassageOrder(input, true);
}

function validateProcessPassageOrderProjection(value) {
  const code = 'INVALID_PROCESS_PASSAGE_ORDERING_PROJECTION';
  requireExactKeys(value, [
    'schema_version',
    'ordering_projection_id',
    'canonical_payload_digest',
    'product_query_definition_id',
    'candidate_release_manifest_id',
    'candidate_release_manifest_payload_digest',
    'ordering_contract_definition_digest',
    'ordering_fact_set_digest',
    'validated_ordering_facts',
    'candidate_count',
    'page_size',
    'ordered_result_ids',
    'first_page_result_ids',
    'comparator_state',
    'diversification_state',
    'no_padding_or_repetition',
    'projection_state',
    'serving_state',
    'authority_limits',
  ], 'Process passage ordering projection', code);
  if (
    value.schema_version !== PROCESS_PASSAGE_ORDERING_PROJECTION_SCHEMA
    || value.comparator_state
      !== 'GOVERNED_TOTAL_COMPARATOR_APPLIED'
    || value.diversification_state
      !== 'DEAL_AND_BIDDER_TRACK_APPLIED'
    || value.no_padding_or_repetition !== true
    || value.projection_state !== 'ORDERING_ONLY'
    || value.serving_state !== 'NOT_SERVED'
    || canonicalJson(value.authority_limits)
      !== canonicalJson(AUTHORITY_LIMITS)
  ) {
    fail(code, 'The Process passage ordering projection state is invalid.');
  }
  const rebuilt = buildProcessPassageOrder({
    product_query_definition_id: value.product_query_definition_id,
    candidate_release_manifest_id:
      value.candidate_release_manifest_id,
    candidate_release_manifest_payload_digest:
      value.candidate_release_manifest_payload_digest,
    page_size: value.page_size,
    ordering_facts: value.validated_ordering_facts,
  }, false);
  if (canonicalJson(rebuilt) !== canonicalJson(value)) {
    fail(code, 'The Process passage ordering projection was changed.');
  }
  return true;
}

module.exports = {
  AUTHORITY_LIMITS,
  MAX_CANDIDATES,
  MAX_PAGE_SIZE,
  MIN_PAGE_SIZE,
  NARRATION_TREATMENTS,
  PROCESS_PASSAGE_ORDERING_FACT_SCHEMA,
  PROCESS_PASSAGE_ORDERING_PROJECTION_SCHEMA,
  ProcessPassageOrderError,
  compileProcessPassageOrder,
  validateOrderingFact,
  validateProcessPassageOrderProjection,
};
