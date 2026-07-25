const {
  canonicalJson,
  contentId,
} = require('./canonical-bytes');
const {
  validateContractBundle,
} = require('./contract-bundle');
const {
  validateAdmittedSemanticSourceContext,
} = require('./admitted-semantic-source');
const {
  validateAdmittedParserProposalEnvelope,
} = require('./admitted-parser-proposal-adapter');
const {
  validateClaimRevisionIdentity,
} = require('./claims-relationships');
const {
  ACTION_CODES,
  SECTION_4_3_INTERVAL,
  buildQxoAdmittedNoShopActionsSlice,
} = require('./reviewed-qxo-admitted-no-shop-actions-slice');

const MAX_SEED_BYTES = 16 * 1024;
const MAX_SEED_NODES = 4096;
const MAX_PARSER_RESIDUALS = 4096;
const MAX_REVIEWED_SLICE_BYTES = 256 * 1024;
const MAX_REVIEWED_SLICE_NODES = 32768;
const MAX_REVIEWED_COLLECTION_ITEMS = 128;
const DEAL_KEY = 'deal:qxo-topbuild';
const AUTHORITY_SCOPE =
  'OFFLINE_REVIEW_ONLY_NO_CANONICAL_MARKET_OR_SERVING_AUTHORITY';
const INPUT_KEYS = Object.freeze([
  'contract_bundle',
  'immutable_source_document',
  'source_admission_manifest',
  'semantic_extraction_input_envelope',
  'conversion',
  'admitted_source_context',
  'admitted_parser_proposal_envelope',
  'reviewed_no_shop_actions_slice',
]);
const SEED_KEYS = Object.freeze([
  'schema_version',
  'authority_scope',
  'contract_binding',
  'source_binding',
  'parser_binding',
  'reviewed_mapping_reference',
  'action_outcomes',
  'exception_context_outcome',
  'status',
  'qxo_no_shop_actions_parser_bound_review_seed_id',
  'canonical_payload_digest',
]);
const ACTION_SPECS = Object.freeze([
  Object.freeze({
    action_key: 'SOLICIT_INITIATE_ENCOURAGE_FACILITATE',
    canonical_value: ACTION_CODES[0],
    component_ordinal: 1,
    claim_ordinal: 0,
    excerpt_key: 'action_a',
  }),
  Object.freeze({
    action_key: 'DISCUSS_OR_NEGOTIATE',
    canonical_value: ACTION_CODES[1],
    component_ordinal: 2,
    claim_ordinal: 0,
    excerpt_key: 'action_b',
  }),
  Object.freeze({
    action_key: 'ENTER_ALTERNATIVE_TRANSACTION_AGREEMENT',
    canonical_value: ACTION_CODES[2],
    component_ordinal: 3,
    claim_ordinal: 0,
    excerpt_key: 'action_c',
  }),
  Object.freeze({
    action_key: 'APPROVE_AUTHORISE_OR_ANNOUNCE_INTENTION',
    canonical_value: ACTION_CODES[3],
    component_ordinal: 3,
    claim_ordinal: 1,
    excerpt_key: 'action_c',
  }),
]);
const LOCALLY_SUPPRESSIBLE_ACTION_CODES = new Set([
  'ACTION_CLAIM_REFERENCE_DRIFT',
  'ACTION_COMPONENT_REFERENCE_DRIFT',
  'ACTION_EVIDENCE_REFERENCE_DRIFT',
  'ACTION_PROVISION_REFERENCE_DRIFT',
  'ACTION_REFERENCE_MISSING_OR_AMBIGUOUS',
  'ACTION_RESIDUAL_OVERLAP',
]);
class QxoNoShopActionsParserBridgeError extends Error {
  constructor(code, message) {
    super(message);
    this.name = 'QxoNoShopActionsParserBridgeError';
    this.code = code;
  }
}

function fail(code, message) {
  throw new QxoNoShopActionsParserBridgeError(code, message);
}

function freeze(value) {
  if (!value || typeof value !== 'object' || Object.isFrozen(value)) return value;
  Object.values(value).forEach(freeze);
  return Object.freeze(value);
}

function exactKeys(value, expectedKeys) {
  return value
    && typeof value === 'object'
    && !Array.isArray(value)
    && canonicalJson(Object.keys(value).sort())
      === canonicalJson([...expectedKeys].sort());
}

function onlyKeys(value, permittedKeys) {
  return value
    && typeof value === 'object'
    && !Array.isArray(value)
    && Object.keys(value).every((key) => permittedKeys.includes(key));
}

function contains(container, child) {
  return container.absolute_start <= child.absolute_start
    && container.absolute_end >= child.absolute_end;
}

function overlaps(left, right) {
  return left.absolute_start < right.absolute_end
    && right.absolute_start < left.absolute_end;
}

function requireExact(value, expected, code, message) {
  let equal = false;
  try {
    equal = canonicalJson(value) === canonicalJson(expected);
  } catch (_) {
    equal = false;
  }
  if (!equal) fail(code, message);
}

function requireInput(input) {
  if (!exactKeys(input, INPUT_KEYS)) {
    fail(
      'BRIDGE_INPUT_CONTRACT_MISMATCH',
      'the QXO no-shop actions bridge input is outside its closed contract',
    );
  }
}

function preflightParserResiduals(parserEnvelope) {
  if (!parserEnvelope
    || !Array.isArray(parserEnvelope.residuals)
    || parserEnvelope.residuals.length > MAX_PARSER_RESIDUALS) {
    fail(
      'PARSER_RESIDUAL_LIMIT_EXCEEDED',
      'the admitted parser residual collection exceeds its governed limit',
    );
  }
}

function preflightSeed(seed) {
  if (!exactKeys(seed, SEED_KEYS)) {
    fail(
      'SEED_CONTRACT_MISMATCH',
      'the QXO no-shop actions review seed is outside its closed contract',
    );
  }
  const stack = [seed];
  let nodes = 0;
  let stringBytes = 0;
  while (stack.length > 0) {
    const value = stack.pop();
    nodes += 1;
    if (nodes > MAX_SEED_NODES) {
      fail('SEED_LIMIT_EXCEEDED', 'the QXO no-shop actions review seed exceeds its node limit');
    }
    if (typeof value === 'string') {
      stringBytes += Buffer.byteLength(value, 'utf8');
      if (stringBytes > MAX_SEED_BYTES) {
        fail('SEED_LIMIT_EXCEEDED', 'the QXO no-shop actions review seed exceeds 16 KiB');
      }
      continue;
    }
    if (!value || typeof value !== 'object') continue;
    if (Array.isArray(value)) {
      if (value.length > MAX_SEED_NODES) {
        fail('SEED_LIMIT_EXCEEDED', 'the QXO no-shop actions review seed array exceeds its item limit');
      }
      for (let index = value.length - 1; index >= 0; index -= 1) {
        stack.push(value[index]);
      }
      continue;
    }
    const keys = Object.keys(value);
    if (keys.length > MAX_SEED_NODES) {
      fail('SEED_LIMIT_EXCEEDED', 'the QXO no-shop actions review seed object exceeds its field limit');
    }
    for (let index = keys.length - 1; index >= 0; index -= 1) {
      stringBytes += Buffer.byteLength(keys[index], 'utf8');
      if (stringBytes > MAX_SEED_BYTES) {
        fail('SEED_LIMIT_EXCEEDED', 'the QXO no-shop actions review seed exceeds 16 KiB');
      }
      stack.push(value[keys[index]]);
    }
  }
  if (Buffer.byteLength(canonicalJson(seed), 'utf8') > MAX_SEED_BYTES) {
    fail('SEED_LIMIT_EXCEEDED', 'the QXO no-shop actions review seed exceeds 16 KiB');
  }
}

function preflightReviewedSlice(slice) {
  const stack = [{ value: slice, exiting: false }];
  const active = new Set();
  let nodes = 0;
  let stringBytes = 0;
  while (stack.length > 0) {
    const task = stack.pop();
    const value = task.value;
    if (task.exiting) {
      active.delete(value);
      continue;
    }
    nodes += 1;
    if (nodes > MAX_REVIEWED_SLICE_NODES) {
      fail(
        'REVIEWED_SLICE_LIMIT_EXCEEDED',
        'the QXO no-shop actions reviewed slice exceeds its node limit',
      );
    }
    if (typeof value === 'string') {
      stringBytes += Buffer.byteLength(value, 'utf8');
      if (stringBytes > MAX_REVIEWED_SLICE_BYTES) {
        fail(
          'REVIEWED_SLICE_LIMIT_EXCEEDED',
          'the QXO no-shop actions reviewed slice exceeds 256 KiB',
        );
      }
      continue;
    }
    if (!value || typeof value !== 'object') continue;
    if (active.has(value)) {
      fail(
        'REVIEWED_MAPPING_REFERENCE_DRIFT',
        'the QXO no-shop actions reviewed slice is cyclic',
      );
    }
    active.add(value);
    stack.push({ value, exiting: true });
    if (Array.isArray(value)) {
      if (value.length > MAX_REVIEWED_COLLECTION_ITEMS) {
        fail(
          'REVIEWED_SLICE_LIMIT_EXCEEDED',
          'the QXO no-shop actions reviewed slice collection exceeds its item limit',
        );
      }
      for (let index = value.length - 1; index >= 0; index -= 1) {
        stack.push({ value: value[index], exiting: false });
      }
      continue;
    }
    const keys = Object.keys(value);
    if (keys.length > MAX_REVIEWED_COLLECTION_ITEMS) {
      fail(
        'REVIEWED_SLICE_LIMIT_EXCEEDED',
        'the QXO no-shop actions reviewed slice object exceeds its field limit',
      );
    }
    for (let index = keys.length - 1; index >= 0; index -= 1) {
      const key = keys[index];
      const descriptor = Object.getOwnPropertyDescriptor(value, key);
      if (!descriptor || !Object.hasOwn(descriptor, 'value')) {
        fail(
          'REVIEWED_MAPPING_REFERENCE_DRIFT',
          'the QXO no-shop actions reviewed slice contains an accessor',
        );
      }
      stringBytes += Buffer.byteLength(key, 'utf8');
      if (stringBytes > MAX_REVIEWED_SLICE_BYTES) {
        fail(
          'REVIEWED_SLICE_LIMIT_EXCEEDED',
          'the QXO no-shop actions reviewed slice exceeds 256 KiB',
        );
      }
      stack.push({ value: descriptor.value, exiting: false });
    }
  }
}

function validateQxoNoShopActionsParserBoundReviewSeedCarrierIdentity(seed) {
  preflightSeed(seed);
  const {
    qxo_no_shop_actions_parser_bound_review_seed_id: seedId,
    canonical_payload_digest: payloadDigest,
    ...body
  } = seed;
  if (seedId !== contentId(
    'QXO_NO_SHOP_ACTIONS_PARSER_BOUND_REVIEW_SEED/V1',
    body,
  ) || payloadDigest !== contentId(
    'QXO_NO_SHOP_ACTIONS_PARSER_BOUND_REVIEW_SEED_PAYLOAD/V1',
    body,
  )) {
    fail(
      'SEED_IDENTITY_MISMATCH',
      'the QXO no-shop actions review seed identity has drifted',
    );
  }
  return true;
}

function requireSectionParent(parserEnvelope, expectedSlice) {
  const governedSpans = [
    expectedSlice.spans.restriction,
    expectedSlice.spans.action_a,
    expectedSlice.spans.action_b,
    expectedSlice.spans.action_c,
    expectedSlice.spans.exception,
  ];
  const matches = parserEnvelope.structural_section_proposals.filter((proposal) => (
    proposal.section_number === '4.3'
      && proposal.section_title === 'No Solicitation by the Company'
      && governedSpans.every((span) => contains(proposal.evidence_anchor, span))
  ));
  if (matches.length !== 1) {
    fail(
      'PARSER_PARENT_NOT_UNIQUE',
      'one exact admitted Section 4.3 parser parent must contain the reviewed QXO no-shop actions',
    );
  }
  const [parent] = matches;
  if (parent.evidence_anchor.absolute_start !== SECTION_4_3_INTERVAL.start
    || parent.evidence_anchor.absolute_end !== SECTION_4_3_INTERVAL.end
    || parent.evidence_anchor.exact_bytes_digest
      !== 'ffbffb81e798af99509dd998c5a5793c2127eaf3ada937ae662306e99a86c524') {
    fail(
      'PARSER_PARENT_SOURCE_DRIFT',
      'the admitted Section 4.3 parser parent no longer matches the reviewed exact source',
    );
  }
  return parent;
}

function requireReviewedReferenceShape(actualSlice, expectedSlice) {
  const exactPayloadSubset = (actual, expected, identityKey) => {
    if (!Array.isArray(actual) || actual.length > expected.length) return false;
    const identities = actual.map((item) => item?.[identityKey]);
    if (new Set(identities).size !== identities.length) return false;
    return actual.every((item) => expected.some(
      (expectedItem) => expectedItem[identityKey] === item[identityKey]
        && canonicalJson(expectedItem) === canonicalJson(item),
    ));
  };
  const exactObjectSubset = (actual, expected) => (
    onlyKeys(actual, Object.keys(expected))
    && Object.entries(actual).every(
      ([key, value]) => canonicalJson(value) === canonicalJson(expected[key]),
    )
  );
  if (!actualSlice || typeof actualSlice !== 'object' || Array.isArray(actualSlice)
    || !onlyKeys(actualSlice, Object.keys(expectedSlice))
    || actualSlice.source_context_id !== expectedSlice.source_context_id
    || actualSlice.corpus_release_id !== null
    || !exactObjectSubset(actualSlice.spans, expectedSlice.spans)
    || !exactObjectSubset(actualSlice.excerpts, expectedSlice.excerpts)
    || !exactPayloadSubset(
      actualSlice.provisions,
      expectedSlice.provisions,
      'provision_instance_id',
    )
    || !exactPayloadSubset(
      actualSlice.components,
      expectedSlice.components,
      'provision_component_id',
    )
    || !exactPayloadSubset(
      actualSlice.claims,
      expectedSlice.claims,
      'claim_revision_id',
    )
    || !exactPayloadSubset(
      actualSlice.relationships,
      expectedSlice.relationships,
      'relationship_revision_id',
    )
    || !exactPayloadSubset(
      actualSlice.actionComponents,
      expectedSlice.actionComponents,
      'provision_component_id',
    )
    || !exactPayloadSubset(
      actualSlice.actionClaims,
      expectedSlice.actionClaims,
      'claim_revision_id',
    )
    || !exactPayloadSubset(
      actualSlice.prerequisiteClaims,
      expectedSlice.prerequisiteClaims,
      'claim_revision_id',
    )
    || (actualSlice.exceptionComponent !== undefined
      && canonicalJson(actualSlice.exceptionComponent)
        !== canonicalJson(expectedSlice.exceptionComponent))
    || canonicalJson(actualSlice.reviewed_mapping)
      !== canonicalJson(expectedSlice.reviewed_mapping)) {
    fail(
      'REVIEWED_MAPPING_REFERENCE_DRIFT',
      'the reviewed QXO no-shop actions slice is not a release-independent source reference',
    );
  }
  requireExact(
    actualSlice.spans.restriction,
    expectedSlice.spans.restriction,
    'REVIEWED_MAPPING_REFERENCE_DRIFT',
    'the reviewed QXO no-shop restriction span has drifted',
  );
}

function findOne(rows, predicate, code, message) {
  const matches = Array.isArray(rows) ? rows.filter(predicate) : [];
  if (matches.length !== 1) fail(code, message);
  return matches[0];
}

function requireNoResidualOverlap(parserEnvelope, governedSpans, code, message) {
  if (parserEnvelope.residuals.some(
    (residual) => residual.evidence_anchor
      && governedSpans.some((span) => overlaps(residual.evidence_anchor, span)),
  )) {
    fail(code, message);
  }
}

function spanReference(excerpt) {
  return {
    canonical_text_id: excerpt.canonical_text_id,
    absolute_start: excerpt.absolute_start,
    absolute_end: excerpt.absolute_end,
    exact_bytes_digest: excerpt.exact_bytes_digest,
  };
}

function claimReference(claim) {
  validateClaimRevisionIdentity(claim);
  return {
    claim_occurrence_id: claim.claim_occurrence_id,
    claim_revision_id: claim.claim_revision_id,
    claim_definition_key: claim.claim_definition_key,
    ordinal: claim.ordinal,
    state: claim.state,
    canonical_value: claim.canonical_value,
    claim_scope_closure_id: claim.scope.scope_closure_id,
    evidence_excerpt_ids: claim.evidence.map((item) => item.excerpt_id),
  };
}

function buildActionReference({
  actualSlice,
  expectedSlice,
  parserEnvelope,
  sectionParent,
  spec,
}) {
  const expectedClaim = findOne(
    expectedSlice.actionClaims,
    (claim) => claim.canonical_value === spec.canonical_value
      && claim.ordinal === spec.claim_ordinal,
    'ACTION_REFERENCE_MISSING_OR_AMBIGUOUS',
    `the expected QXO ${spec.action_key} claim is missing or ambiguous`,
  );
  const actualClaim = findOne(
    actualSlice.claims,
    (claim) => claim.claim_definition_key === expectedClaim.claim_definition_key
      && claim.subject_occurrence_id === expectedClaim.subject_occurrence_id
      && claim.ordinal === spec.claim_ordinal,
    'ACTION_REFERENCE_MISSING_OR_AMBIGUOUS',
    `the reviewed QXO ${spec.action_key} claim is missing or ambiguous`,
  );
  requireExact(
    actualClaim,
    expectedClaim,
    'ACTION_CLAIM_REFERENCE_DRIFT',
    `the reviewed QXO ${spec.action_key} claim or evidence has drifted`,
  );
  const expectedComponent = findOne(
    expectedSlice.actionComponents,
    (component) => component.ordinal === spec.component_ordinal,
    'ACTION_REFERENCE_MISSING_OR_AMBIGUOUS',
    `the expected QXO ${spec.action_key} component is missing or ambiguous`,
  );
  const actualComponent = findOne(
    actualSlice.components,
    (component) => component.provision_component_id
      === expectedComponent.provision_component_id,
    'ACTION_REFERENCE_MISSING_OR_AMBIGUOUS',
    `the reviewed QXO ${spec.action_key} component is missing or ambiguous`,
  );
  requireExact(
    actualComponent,
    expectedComponent,
    'ACTION_COMPONENT_REFERENCE_DRIFT',
    `the reviewed QXO ${spec.action_key} component has drifted`,
  );
  if (actualClaim.subject_occurrence_id !== actualComponent.provision_component_id) {
    fail(
      'ACTION_COMPONENT_REFERENCE_DRIFT',
      `the reviewed QXO ${spec.action_key} claim is attached to the wrong component`,
    );
  }
  const expectedProvision = findOne(
    expectedSlice.provisions,
    (provision) => provision.provision_instance_id
      === expectedComponent.parent_provision_instance_id,
    'ACTION_REFERENCE_MISSING_OR_AMBIGUOUS',
    `the expected QXO ${spec.action_key} provision is missing or ambiguous`,
  );
  const actualProvision = findOne(
    actualSlice.provisions,
    (provision) => provision.provision_instance_id
      === expectedProvision.provision_instance_id,
    'ACTION_REFERENCE_MISSING_OR_AMBIGUOUS',
    `the reviewed QXO ${spec.action_key} provision is missing or ambiguous`,
  );
  requireExact(
    actualProvision,
    expectedProvision,
    'ACTION_PROVISION_REFERENCE_DRIFT',
    `the reviewed QXO ${spec.action_key} provision has drifted`,
  );
  const expectedExcerpt = expectedSlice.excerpts[spec.excerpt_key];
  const actualExcerpt = actualSlice.excerpts?.[spec.excerpt_key];
  requireExact(
    actualSlice.spans?.[spec.excerpt_key],
    expectedSlice.spans[spec.excerpt_key],
    'ACTION_EVIDENCE_REFERENCE_DRIFT',
    `the reviewed QXO ${spec.action_key} span has drifted`,
  );
  requireExact(
    actualExcerpt,
    expectedExcerpt,
    'ACTION_EVIDENCE_REFERENCE_DRIFT',
    `the reviewed QXO ${spec.action_key} excerpt has drifted`,
  );
  if (!contains(sectionParent.evidence_anchor, actualExcerpt)
    || !actualClaim.evidence.some((item) => item.excerpt_id === actualExcerpt.excerpt_id)) {
    fail(
      'ACTION_EVIDENCE_REFERENCE_DRIFT',
      `the reviewed QXO ${spec.action_key} is not bound to its exact parser parent and evidence`,
    );
  }
  requireNoResidualOverlap(
    parserEnvelope,
    [actualExcerpt],
    'ACTION_RESIDUAL_OVERLAP',
    `a retained parser residual intersects the reviewed QXO ${spec.action_key} evidence`,
  );
  return freeze({
    schema_version: 'QXO_NO_SHOP_ACTION_REVIEW_REFERENCE/V1',
    action_key: spec.action_key,
    parser_section_proposal_id:
      sectionParent.admitted_structural_section_proposal_id,
    provision_instance_id: actualProvision.provision_instance_id,
    provision_component_id: actualComponent.provision_component_id,
    claim: claimReference(actualClaim),
    evidence_excerpt_id: actualExcerpt.excerpt_id,
    evidence_span: spanReference(actualExcerpt),
    semantic_classification_source:
      'EXISTING_REVIEWED_MAPPING_REFERENCE_ONLY',
    parser_semantic_classification_authority: 'NONE',
  });
}

function actionOutcome(input) {
  try {
    return freeze({
      schema_version: 'QXO_NO_SHOP_ACTION_REVIEW_OUTCOME/V1',
      action_key: input.spec.action_key,
      suppressed: false,
      failure_code: null,
      reference: buildActionReference(input),
    });
  } catch (error) {
    if (!(error instanceof QxoNoShopActionsParserBridgeError)
      || !LOCALLY_SUPPRESSIBLE_ACTION_CODES.has(error.code)) {
      throw error;
    }
    return freeze({
      schema_version: 'QXO_NO_SHOP_ACTION_REVIEW_OUTCOME/V1',
      action_key: input.spec.action_key,
      suppressed: true,
      failure_code: error.code,
      reference: null,
    });
  }
}

function exceptionContextOutcome() {
  return freeze({
    schema_version: 'QXO_NO_SHOP_EXCEPTION_CONTEXT_REVIEW_OUTCOME/V1',
    suppressed: true,
    failure_code: 'EXCEPTION_SOURCE_MAPPING_REQUIRES_CORRECTION',
    reference: null,
  });
}

function buildQxoNoShopActionsParserBoundReviewSeed(input = {}) {
  requireInput(input);
  const {
    contract_bundle: contractBundle,
    immutable_source_document: immutableSourceDocument,
    source_admission_manifest: sourceAdmissionManifest,
    semantic_extraction_input_envelope: semanticExtractionInputEnvelope,
    conversion,
    admitted_source_context: admittedSourceContext,
    admitted_parser_proposal_envelope: admittedParserProposalEnvelope,
    reviewed_no_shop_actions_slice: reviewedNoShopActionsSlice,
  } = input;
  preflightParserResiduals(admittedParserProposalEnvelope);
  validateContractBundle(contractBundle);
  validateAdmittedSemanticSourceContext({
    context: admittedSourceContext,
    immutable_source_document: immutableSourceDocument,
    source_admission_manifest: sourceAdmissionManifest,
    semantic_extraction_input_envelope: semanticExtractionInputEnvelope,
    conversion,
    governed_deal_key: DEAL_KEY,
    deal_admission_id: admittedSourceContext?.deal_admission_id,
    source_ordinal: admittedSourceContext?.source_ordinal,
  });
  if (admittedSourceContext.governed_deal_key !== DEAL_KEY) {
    fail(
      'WRONG_GOVERNED_DEAL',
      'the QXO no-shop actions bridge requires the governed QXO deal',
    );
  }
  validateAdmittedParserProposalEnvelope({
    proposal_envelope: admittedParserProposalEnvelope,
    contract_bundle: contractBundle,
    immutable_source_document: immutableSourceDocument,
    source_admission_manifest: sourceAdmissionManifest,
    semantic_extraction_input_envelope: semanticExtractionInputEnvelope,
    conversion,
    admitted_source_context: admittedSourceContext,
  });
  const expectedSlice = buildQxoAdmittedNoShopActionsSlice({
    sourceContext: admittedSourceContext,
    contractBundle,
  });
  preflightReviewedSlice(reviewedNoShopActionsSlice);
  requireReviewedReferenceShape(reviewedNoShopActionsSlice, expectedSlice);
  const sectionParent = requireSectionParent(
    admittedParserProposalEnvelope,
    expectedSlice,
  );
  const actionOutcomes = ACTION_SPECS.map((spec) => actionOutcome({
    actualSlice: reviewedNoShopActionsSlice,
    expectedSlice,
    parserEnvelope: admittedParserProposalEnvelope,
    sectionParent,
    spec,
  }));
  const exceptionOutcome = exceptionContextOutcome();
  const parserResidualCount = admittedParserProposalEnvelope.residuals.length;
  const blockerCodes = [
    'ACTION_SOURCE_MAPPING_REQUIRES_ATOMIC_SPLIT',
    'COMPOSITION_SCOPE_CLOSURE_NOT_FROZEN',
    'EXCEPTED_BY_EFFECT_CONTRACT_NOT_FROZEN',
    'EXCEPTION_PREREQUISITE_CODEBOOK_AMENDMENT_REQUIRED',
    'EXCEPTION_SOURCE_MAPPING_REQUIRES_CORRECTION',
    'EXISTING_TAXONOMY_REFERENCE_ONLY',
    'EXPECTED_LINEAGE_SLOTS_NOT_FROZEN',
    'NO_PARSER_SEMANTIC_CLASSIFICATION_AUTHORITY',
    'QUERY_METRIC_CONTRACT_REQUIRED',
    'RESULT_DEFINITION_NOT_FROZEN',
    ...(parserResidualCount > 0 ? ['PARSER_RESIDUAL_RETAINED'] : []),
    ...(actionOutcomes.some((outcome) => outcome.suppressed)
      ? ['ACTION_REFERENCE_REVIEW_INCOMPLETE']
      : []),
    'EXCEPTION_CONTEXT_REVIEW_INCOMPLETE',
  ].sort();
  const actionReferenceSetBody = {
    review_version: expectedSlice.reviewed_mapping.review_version,
    document_hash: expectedSlice.reviewed_mapping.document_hash,
    canonical_text_id: expectedSlice.reviewed_mapping.canonical_text_id,
    parser_section_proposal_id:
      sectionParent.admitted_structural_section_proposal_id,
    ordered_action_claim_revision_ids: actionOutcomes
      .filter((outcome) => !outcome.suppressed)
      .map((outcome) => outcome.reference.claim.claim_revision_id),
  };
  const body = {
    schema_version: 'QXO_NO_SHOP_ACTIONS_PARSER_BOUND_REVIEW_SEED/V1',
    authority_scope: AUTHORITY_SCOPE,
    contract_binding: {
      schema_version: contractBundle.schema_version,
      contract_key: contractBundle.contract_key,
      contract_fingerprint: contractBundle.fingerprint,
    },
    source_binding: {
      governed_deal_key: DEAL_KEY,
      deal_admission_id: admittedSourceContext.deal_admission_id,
      immutable_source_document_id:
        admittedSourceContext.immutable_source_document_id,
      source_admission_manifest_id:
        admittedSourceContext.source_admission_manifest_id,
      semantic_extraction_input_envelope_id:
        admittedSourceContext.semantic_extraction_input_envelope_id,
      admitted_semantic_source_context_id:
        admittedSourceContext.admitted_semantic_source_context_id,
      document_hash: admittedSourceContext.document_hash,
      canonical_text_id: admittedSourceContext.canonical_text_id,
    },
    parser_binding: {
      admitted_parser_proposal_envelope_id:
        admittedParserProposalEnvelope.admitted_parser_proposal_envelope_id,
      admitted_parser_proposal_envelope_payload_digest:
        admittedParserProposalEnvelope.canonical_payload_digest,
      parser_runtime_manifest_id:
        admittedParserProposalEnvelope.parser_runtime_manifest_id,
      section_4_3_proposal_id:
        sectionParent.admitted_structural_section_proposal_id,
      structural_parent_detection_authority:
        'EXACT_SECTION_PARENT_ONLY',
      semantic_action_detection_authority: 'NONE',
      semantic_exception_detection_authority: 'NONE',
      retained_parser_residual_summary: {
        count: parserResidualCount,
        source_envelope_binding_digest: contentId(
          'QXO_NO_SHOP_ACTIONS_RETAINED_PARSER_RESIDUAL_BINDING/V1',
          {
            admitted_parser_proposal_envelope_id:
              admittedParserProposalEnvelope.admitted_parser_proposal_envelope_id,
            admitted_parser_proposal_envelope_payload_digest:
              admittedParserProposalEnvelope.canonical_payload_digest,
            residual_count: parserResidualCount,
          },
        ),
        release_blocked: parserResidualCount > 0,
      },
    },
    reviewed_mapping_reference: {
      ...actionReferenceSetBody,
      action_reference_set_id: contentId(
        'QXO_NO_SHOP_ACTION_REFERENCE_SET/V1',
        actionReferenceSetBody,
      ),
      source_reviewed_mapping_id:
        expectedSlice.reviewed_mapping.reviewed_mapping_id,
      source_reviewed_mapping_state:
        'REJECTED_FOR_EXCEPTION_SEMANTIC_DEFECTS',
      authority: 'EXISTING_REVIEWED_ACTION_REFERENCES_ONLY',
    },
    action_outcomes: actionOutcomes,
    exception_context_outcome: exceptionOutcome,
    status: {
      action_reference_complete: false,
      exception_context_state:
        'REJECTED_REQUIRES_REVIEWED_REPLACEMENT',
      review_reference_complete:
        actionOutcomes.every((outcome) => !outcome.suppressed)
        && !exceptionOutcome.suppressed,
      canonical_write_authority: 'NONE',
      taxonomy_authority: 'NONE',
      relationship_effect_authority: 'NONE',
      result_authority: 'NONE',
      metric_authority: 'NONE',
      comparability_authority: 'NONE',
      query_authority: 'NONE',
      serving_authority: 'NONE',
      release_authority: 'NONE',
      release_eligible: false,
      failure_isolation:
        'SUPPRESS_AFFECTED_ACTION_OR_SHARED_EXCEPTION_CONTEXT_ONLY',
      blocker_codes: blockerCodes,
    },
  };
  const seed = freeze({
    ...body,
    qxo_no_shop_actions_parser_bound_review_seed_id: contentId(
      'QXO_NO_SHOP_ACTIONS_PARSER_BOUND_REVIEW_SEED/V1',
      body,
    ),
    canonical_payload_digest: contentId(
      'QXO_NO_SHOP_ACTIONS_PARSER_BOUND_REVIEW_SEED_PAYLOAD/V1',
      body,
    ),
  });
  preflightSeed(seed);
  return seed;
}

function validateQxoNoShopActionsParserBoundReviewSeed({
  qxo_no_shop_actions_parser_bound_review_seed: seed,
  ...inputs
} = {}) {
  validateQxoNoShopActionsParserBoundReviewSeedCarrierIdentity(seed);
  const expected = buildQxoNoShopActionsParserBoundReviewSeed(inputs);
  if (canonicalJson(seed) !== canonicalJson(expected)) {
    fail(
      'SEED_IDENTITY_MISMATCH',
      'the QXO no-shop actions parser-bound review seed has drifted',
    );
  }
  return true;
}

module.exports = {
  AUTHORITY_SCOPE,
  MAX_SEED_BYTES,
  QxoNoShopActionsParserBridgeError,
  buildQxoNoShopActionsParserBoundReviewSeed,
  validateQxoNoShopActionsParserBoundReviewSeedCarrierIdentity,
  validateQxoNoShopActionsParserBoundReviewSeed,
};
