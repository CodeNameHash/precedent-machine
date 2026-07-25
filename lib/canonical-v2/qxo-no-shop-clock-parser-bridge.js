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
  normaliseDurationToDays,
  validateObservationNormalisation,
} = require('./observation-normalisers');
const {
  buildQxoAdmittedNoShopNoticeSlice,
} = require('./reviewed-qxo-admitted-no-shop-slice');

const MAX_SEED_BYTES = 16 * 1024;
const MAX_SEED_NODES = 4096;
const MAX_PARSER_RESIDUALS = 4096;
const DEAL_KEY = 'deal:qxo-topbuild';
const REVIEW_VERSION = 'QXO_NO_SHOP_CLOCK_PARSER_BRIDGE/V1';
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
  'reviewed_no_shop_slice',
]);
const SEED_KEYS = Object.freeze([
  'schema_version',
  'authority_scope',
  'contract_binding',
  'source_binding',
  'parser_binding',
  'reviewed_mapping_reference',
  'clock_outcomes',
  'status',
  'qxo_no_shop_clock_parser_bound_review_seed_id',
  'canonical_payload_digest',
]);
const CLOCK_SPECS = Object.freeze([
  Object.freeze({
    clock_key: 'NOTICE',
    excerpt_key: 'notice_clock',
    clause_excerpt_key: 'notice_clause',
    claim_definition_key: 'NO_SHOP_NOTICE_PERIOD_DAYS',
    raw_magnitude: '24',
    raw_unit: 'HOURS',
    canonical_value: '1',
    canonical_unit: 'DAYS',
    day_basis: 'ELAPSED',
    trigger: 'RECEIPT_OF_COMPETING_PROPOSAL',
  }),
  Object.freeze({
    clock_key: 'INITIAL_MATCH',
    excerpt_key: 'match_clock',
    clause_excerpt_key: 'match_clause',
    claim_definition_key: 'NO_SHOP_INITIAL_MATCH_PERIOD_DAYS',
    raw_magnitude: '4',
    raw_unit: 'DAYS',
    canonical_value: '4',
    canonical_unit: 'DAYS',
    day_basis: 'BUSINESS',
    trigger: 'SUPERIOR_PROPOSAL_NOTICE',
  }),
]);
const LOCALLY_SUPPRESSIBLE_CODES = new Set([
  'CLOCK_COMPONENT_REFERENCE_DRIFT',
  'CLOCK_EVIDENCE_REFERENCE_DRIFT',
  'CLOCK_NORMALISATION_DRIFT',
  'CLOCK_PROVISION_REFERENCE_DRIFT',
  'CLOCK_REFERENCE_MISSING_OR_AMBIGUOUS',
  'CLOCK_RESIDUAL_OVERLAP',
]);

class QxoNoShopClockParserBridgeError extends Error {
  constructor(code, message) {
    super(message);
    this.name = 'QxoNoShopClockParserBridgeError';
    this.code = code;
  }
}

function fail(code, message) {
  throw new QxoNoShopClockParserBridgeError(code, message);
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
      'the QXO no-shop clock bridge input is outside its closed contract',
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
      'the QXO no-shop clock review seed is outside its closed contract',
    );
  }
  const stack = [seed];
  let nodes = 0;
  let stringBytes = 0;
  while (stack.length > 0) {
    const value = stack.pop();
    nodes += 1;
    if (nodes > MAX_SEED_NODES) {
      fail('SEED_LIMIT_EXCEEDED', 'the QXO no-shop clock review seed exceeds its node limit');
    }
    if (typeof value === 'string') {
      stringBytes += Buffer.byteLength(value, 'utf8');
      if (stringBytes > MAX_SEED_BYTES) {
        fail('SEED_LIMIT_EXCEEDED', 'the QXO no-shop clock review seed exceeds 16 KiB');
      }
      continue;
    }
    if (!value || typeof value !== 'object') continue;
    if (Array.isArray(value)) {
      if (value.length > MAX_SEED_NODES) {
        fail('SEED_LIMIT_EXCEEDED', 'the QXO no-shop clock review seed array exceeds its item limit');
      }
      for (let index = value.length - 1; index >= 0; index -= 1) {
        stack.push(value[index]);
      }
      continue;
    }
    const keys = Object.keys(value);
    if (keys.length > MAX_SEED_NODES) {
      fail('SEED_LIMIT_EXCEEDED', 'the QXO no-shop clock review seed object exceeds its field limit');
    }
    for (let index = keys.length - 1; index >= 0; index -= 1) {
      stringBytes += Buffer.byteLength(keys[index], 'utf8');
      if (stringBytes > MAX_SEED_BYTES) {
        fail('SEED_LIMIT_EXCEEDED', 'the QXO no-shop clock review seed exceeds 16 KiB');
      }
      stack.push(value[keys[index]]);
    }
  }
  if (Buffer.byteLength(canonicalJson(seed), 'utf8') > MAX_SEED_BYTES) {
    fail('SEED_LIMIT_EXCEEDED', 'the QXO no-shop clock review seed exceeds 16 KiB');
  }
}

function validateQxoNoShopClockParserBoundReviewSeedCarrierIdentity(seed) {
  preflightSeed(seed);
  const {
    qxo_no_shop_clock_parser_bound_review_seed_id: seedId,
    canonical_payload_digest: payloadDigest,
    ...body
  } = seed;
  if (seedId !== contentId(
    'QXO_NO_SHOP_CLOCK_PARSER_BOUND_REVIEW_SEED/V1',
    body,
  ) || payloadDigest !== contentId(
    'QXO_NO_SHOP_CLOCK_PARSER_BOUND_REVIEW_SEED_PAYLOAD/V1',
    body,
  )) {
    fail(
      'SEED_IDENTITY_MISMATCH',
      'the QXO no-shop clock review seed identity has drifted',
    );
  }
  return true;
}

function requireSectionParent(parserEnvelope, expectedSlice) {
  const governedSpans = [
    expectedSlice.spans.no_shop_section,
    expectedSlice.spans.notice_clause,
    expectedSlice.spans.match_clause,
    expectedSlice.spans.notice_clock,
    expectedSlice.spans.match_clock,
  ];
  const matches = parserEnvelope.structural_section_proposals.filter((proposal) => (
    proposal.section_number === '4.3'
      && proposal.section_title === 'No Solicitation by the Company'
      && governedSpans.every((span) => contains(proposal.evidence_anchor, span))
  ));
  if (matches.length !== 1) {
    fail(
      'PARSER_PARENT_NOT_UNIQUE',
      'one exact admitted Section 4.3 parser parent must contain both reviewed QXO clocks',
    );
  }
  const [parent] = matches;
  const expectedSectionSpan = expectedSlice.spans.no_shop_section;
  if (parent.evidence_anchor.absolute_start !== expectedSectionSpan.absolute_start
    || parent.evidence_anchor.absolute_end !== expectedSectionSpan.absolute_end
    || parent.evidence_anchor.canonical_text_id !== expectedSectionSpan.canonical_text_id
    || parent.evidence_anchor.exact_bytes_digest
      !== expectedSectionSpan.exact_bytes_digest) {
    fail(
      'PARSER_PARENT_SOURCE_DRIFT',
      'the admitted Section 4.3 parser parent no longer matches the reviewed exact source',
    );
  }
  return parent;
}

function requireReviewedClockReferenceShape(actualSlice, expectedSlice) {
  if (!actualSlice || typeof actualSlice !== 'object' || Array.isArray(actualSlice)
    || !onlyKeys(actualSlice, Object.keys(expectedSlice))
    || actualSlice.source_context_id !== expectedSlice.source_context_id
    || actualSlice.corpus_release_id !== null
    || !onlyKeys(actualSlice.spans, Object.keys(expectedSlice.spans))
    || !onlyKeys(actualSlice.excerpts, Object.keys(expectedSlice.excerpts))
    || !Array.isArray(actualSlice.provisions)
    || actualSlice.provisions.some((provision) => (
      !expectedSlice.provisions.some(
        (expected) => expected.concept_key === provision.concept_key,
      )
    ))
    || !Array.isArray(actualSlice.components)
    || actualSlice.components.some((component) => (
      !expectedSlice.components.some(
        (expected) => expected.component_key === component.component_key,
      )
    ))
    || !Array.isArray(actualSlice.claims)
    || actualSlice.claims.some((claim) => (
      !expectedSlice.claims.some(
        (expected) => (
          expected.claim_definition_key === claim.claim_definition_key
        ),
      )
    ))
    || !Array.isArray(actualSlice.relationships)
    || actualSlice.relationships.length !== 0) {
    fail(
      'REVIEWED_MAPPING_REFERENCE_DRIFT',
      'the reviewed QXO no-shop slice is not a release-independent reference to this source',
    );
  }
  requireExact(
    actualSlice.spans.no_shop_section,
    expectedSlice.spans.no_shop_section,
    'REVIEWED_MAPPING_REFERENCE_DRIFT',
    'the reviewed QXO Section 4.3 span has drifted',
  );
}

function findOne(rows, predicate, code, message) {
  const matches = Array.isArray(rows) ? rows.filter(predicate) : [];
  if (matches.length !== 1) fail(code, message);
  return matches[0];
}

function validateNormalisation(claim, spec) {
  const normalisation = normaliseDurationToDays({
    rawMagnitude: spec.raw_magnitude,
    rawUnit: spec.raw_unit,
    dayBasis: spec.day_basis,
    trigger: spec.trigger,
    derivationVersion: REVIEW_VERSION,
  });
  validateObservationNormalisation(normalisation);
  if (claim.canonical_value !== spec.canonical_value
    || claim.unit !== spec.canonical_unit
    || claim.day_basis !== spec.day_basis
    || claim.attributes?.raw_magnitude !== spec.raw_magnitude
    || claim.attributes?.raw_unit !== spec.raw_unit
    || claim.attributes?.trigger !== spec.trigger
    || normalisation.canonical_value !== spec.canonical_value
    || normalisation.canonical_unit !== spec.canonical_unit
    || normalisation.day_basis !== spec.day_basis
    || normalisation.trigger !== spec.trigger) {
    fail(
      'CLOCK_NORMALISATION_DRIFT',
      `the reviewed QXO ${spec.clock_key} clock no longer has its governed day conversion`,
    );
  }
  const claimNormalisation = normaliseDurationToDays({
    rawMagnitude: claim.attributes.raw_magnitude,
    rawUnit: claim.attributes.raw_unit,
    dayBasis: claim.day_basis,
    trigger: claim.attributes.trigger,
    derivationVersion: claim.derivation_version,
  });
  validateObservationNormalisation(claimNormalisation);
  if (claim.attributes.normalisation_payload_digest
      !== claimNormalisation.normalisation_payload_digest
    || claimNormalisation.canonical_value !== claim.canonical_value
    || claimNormalisation.canonical_unit !== claim.unit) {
    fail(
      'CLOCK_NORMALISATION_DRIFT',
      `the reviewed QXO ${spec.clock_key} claim is not reproducible from its raw duration`,
    );
  }
  return claimNormalisation;
}

function requireNoResidualOverlap(parserEnvelope, governedSpans, clockKey) {
  if (parserEnvelope.residuals.some(
    (residual) => residual.evidence_anchor
      && governedSpans.some((span) => overlaps(residual.evidence_anchor, span)),
  )) {
    fail(
      'CLOCK_RESIDUAL_OVERLAP',
      `a retained parser residual intersects the reviewed QXO ${clockKey} clock`,
    );
  }
}

function buildClockReference({
  actualSlice,
  expectedSlice,
  parserEnvelope,
  sectionParent,
  spec,
}) {
  const expectedClaim = findOne(
    expectedSlice.claims,
    (claim) => claim.claim_definition_key === spec.claim_definition_key,
    'CLOCK_REFERENCE_MISSING_OR_AMBIGUOUS',
    `the expected QXO ${spec.clock_key} claim is missing or ambiguous`,
  );
  const actualClaim = findOne(
    actualSlice.claims,
    (claim) => claim.claim_definition_key === spec.claim_definition_key,
    'CLOCK_REFERENCE_MISSING_OR_AMBIGUOUS',
    `the reviewed QXO ${spec.clock_key} claim is missing or ambiguous`,
  );
  requireExact(
    actualClaim,
    expectedClaim,
    'CLOCK_EVIDENCE_REFERENCE_DRIFT',
    `the reviewed QXO ${spec.clock_key} claim or evidence has drifted`,
  );
  const expectedComponent = findOne(
    expectedSlice.components,
    (component) => component.provision_component_id
      === expectedClaim.subject_occurrence_id,
    'CLOCK_REFERENCE_MISSING_OR_AMBIGUOUS',
    `the expected QXO ${spec.clock_key} component is missing or ambiguous`,
  );
  const actualComponent = findOne(
    actualSlice.components,
    (component) => component.component_key === expectedComponent.component_key,
    'CLOCK_REFERENCE_MISSING_OR_AMBIGUOUS',
    `the reviewed QXO ${spec.clock_key} component is missing or ambiguous`,
  );
  requireExact(
    actualComponent,
    expectedComponent,
    'CLOCK_COMPONENT_REFERENCE_DRIFT',
    `the reviewed QXO ${spec.clock_key} component has drifted`,
  );
  const expectedProvision = findOne(
    expectedSlice.provisions,
    (provision) => provision.provision_instance_id
      === expectedComponent.parent_provision_instance_id,
    'CLOCK_REFERENCE_MISSING_OR_AMBIGUOUS',
    `the expected QXO ${spec.clock_key} provision is missing or ambiguous`,
  );
  const actualProvision = findOne(
    actualSlice.provisions,
    (provision) => provision.concept_key === expectedProvision.concept_key,
    'CLOCK_REFERENCE_MISSING_OR_AMBIGUOUS',
    `the reviewed QXO ${spec.clock_key} provision is missing or ambiguous`,
  );
  requireExact(
    actualProvision,
    expectedProvision,
    'CLOCK_PROVISION_REFERENCE_DRIFT',
    `the reviewed QXO ${spec.clock_key} provision has drifted`,
  );
  const expectedClockExcerpt = expectedSlice.excerpts[spec.excerpt_key];
  const actualClockExcerpt = actualSlice.excerpts?.[spec.excerpt_key];
  const expectedClauseExcerpt = expectedSlice.excerpts[spec.clause_excerpt_key];
  const actualClauseExcerpt = actualSlice.excerpts?.[spec.clause_excerpt_key];
  requireExact(
    actualSlice.spans?.[spec.excerpt_key],
    expectedSlice.spans[spec.excerpt_key],
    'CLOCK_EVIDENCE_REFERENCE_DRIFT',
    `the reviewed QXO ${spec.clock_key} clock span has drifted`,
  );
  requireExact(
    actualSlice.spans?.[spec.clause_excerpt_key],
    expectedSlice.spans[spec.clause_excerpt_key],
    'CLOCK_EVIDENCE_REFERENCE_DRIFT',
    `the reviewed QXO ${spec.clock_key} clause span has drifted`,
  );
  requireExact(
    actualClockExcerpt,
    expectedClockExcerpt,
    'CLOCK_EVIDENCE_REFERENCE_DRIFT',
    `the reviewed QXO ${spec.clock_key} clock excerpt has drifted`,
  );
  requireExact(
    actualClauseExcerpt,
    expectedClauseExcerpt,
    'CLOCK_EVIDENCE_REFERENCE_DRIFT',
    `the reviewed QXO ${spec.clock_key} clause excerpt has drifted`,
  );
  if (!contains(sectionParent.evidence_anchor, actualClauseExcerpt)
    || !contains(actualClauseExcerpt, actualClockExcerpt)
    || !actualClaim.evidence.some((item) => item.excerpt_id === actualClockExcerpt.excerpt_id)
    || !actualClaim.evidence.some((item) => item.excerpt_id === actualClauseExcerpt.excerpt_id)) {
    fail(
      'CLOCK_EVIDENCE_REFERENCE_DRIFT',
      `the reviewed QXO ${spec.clock_key} clock is not bound to its exact parser parent and clause`,
    );
  }
  requireNoResidualOverlap(
    parserEnvelope,
    [actualClauseExcerpt, actualClockExcerpt],
    spec.clock_key,
  );
  const normalisation = validateNormalisation(actualClaim, spec);
  return freeze({
    schema_version: 'QXO_NO_SHOP_CLOCK_REVIEW_REFERENCE/V1',
    clock_key: spec.clock_key,
    parser_section_proposal_id:
      sectionParent.admitted_structural_section_proposal_id,
    reviewed_mapping_id: expectedSlice.reviewed_mapping.reviewed_mapping_id,
    provision_instance_id: actualProvision.provision_instance_id,
    provision_component_id: actualComponent.provision_component_id,
    claim_occurrence_id: actualClaim.claim_occurrence_id,
    claim_revision_id: actualClaim.claim_revision_id,
    claim_scope_closure_id: actualClaim.scope.scope_closure_id,
    clause_excerpt_id: actualClauseExcerpt.excerpt_id,
    clock_excerpt_id: actualClockExcerpt.excerpt_id,
    clock_span: {
      semantic_span_id:
        actualClockExcerpt.ordered_component_assignments[0].semantic_span_id,
      canonical_text_id: actualClockExcerpt.canonical_text_id,
      absolute_start: actualClockExcerpt.absolute_start,
      absolute_end: actualClockExcerpt.absolute_end,
      exact_bytes_digest: actualClockExcerpt.exact_bytes_digest,
    },
    raw_duration: {
      magnitude: spec.raw_magnitude,
      unit: spec.raw_unit,
    },
    canonical_duration: {
      magnitude: spec.canonical_value,
      unit: spec.canonical_unit,
      day_basis: spec.day_basis,
      trigger: spec.trigger,
    },
    normalisation_payload_digest:
      normalisation.normalisation_payload_digest,
    semantic_classification_source:
      'EXISTING_REVIEWED_MAPPING_REFERENCE_ONLY',
    parser_semantic_classification_authority: 'NONE',
  });
}

function clockOutcome(input) {
  try {
    return freeze({
      schema_version: 'QXO_NO_SHOP_CLOCK_REVIEW_OUTCOME/V1',
      clock_key: input.spec.clock_key,
      suppressed: false,
      failure_code: null,
      reference: buildClockReference(input),
    });
  } catch (error) {
    if (!(error instanceof QxoNoShopClockParserBridgeError)
      || !LOCALLY_SUPPRESSIBLE_CODES.has(error.code)) {
      throw error;
    }
    return freeze({
      schema_version: 'QXO_NO_SHOP_CLOCK_REVIEW_OUTCOME/V1',
      clock_key: input.spec.clock_key,
      suppressed: true,
      failure_code: error.code,
      reference: null,
    });
  }
}

function buildQxoNoShopClockParserBoundReviewSeed(input = {}) {
  requireInput(input);
  const {
    contract_bundle: contractBundle,
    immutable_source_document: immutableSourceDocument,
    source_admission_manifest: sourceAdmissionManifest,
    semantic_extraction_input_envelope: semanticExtractionInputEnvelope,
    conversion,
    admitted_source_context: admittedSourceContext,
    admitted_parser_proposal_envelope: admittedParserProposalEnvelope,
    reviewed_no_shop_slice: reviewedNoShopSlice,
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
      'the QXO no-shop clock bridge requires the governed QXO deal',
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
  const expectedSlice = buildQxoAdmittedNoShopNoticeSlice({
    sourceContext: admittedSourceContext,
    contractBundle,
  });
  requireReviewedClockReferenceShape(reviewedNoShopSlice, expectedSlice);
  const sectionParent = requireSectionParent(
    admittedParserProposalEnvelope,
    expectedSlice,
  );
  const outcomes = CLOCK_SPECS.map((spec) => clockOutcome({
    actualSlice: reviewedNoShopSlice,
    expectedSlice,
    parserEnvelope: admittedParserProposalEnvelope,
    sectionParent,
    spec,
  }));
  const parserResidualCount = admittedParserProposalEnvelope.residuals.length;
  const blockerCodes = [
    'EXISTING_TAXONOMY_REFERENCE_ONLY',
    'NO_PARSER_SEMANTIC_CLASSIFICATION_AUTHORITY',
    'QUERY_METRIC_CONTRACT_REQUIRED',
    'RESULT_INPUT_LINEAGE_CONTRACT_REQUIRED',
    ...(parserResidualCount > 0 ? ['PARSER_RESIDUAL_RETAINED'] : []),
    ...(outcomes.some((outcome) => outcome.suppressed)
      ? ['CLOCK_REFERENCE_REVIEW_INCOMPLETE']
      : []),
  ].sort();
  const body = {
    schema_version: 'QXO_NO_SHOP_CLOCK_PARSER_BOUND_REVIEW_SEED/V1',
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
      semantic_clock_detection_authority: 'NONE',
      retained_parser_residual_summary: {
        count: parserResidualCount,
        source_envelope_binding_digest: contentId(
          'QXO_NO_SHOP_CLOCK_RETAINED_PARSER_RESIDUAL_BINDING/V1',
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
      review_version: expectedSlice.reviewed_mapping.review_version,
      reviewed_mapping_id:
        expectedSlice.reviewed_mapping.reviewed_mapping_id,
      canonical_payload_digest:
        expectedSlice.reviewed_mapping.canonical_payload_digest,
      authority: 'EXISTING_REVIEWED_REFERENCE_ONLY',
    },
    clock_outcomes: outcomes,
    status: {
      review_reference_complete:
        outcomes.every((outcome) => !outcome.suppressed),
      canonical_write_authority: 'NONE',
      taxonomy_authority: 'NONE',
      result_authority: 'NONE',
      metric_authority: 'NONE',
      comparability_authority: 'NONE',
      query_authority: 'NONE',
      serving_authority: 'NONE',
      release_authority: 'NONE',
      release_eligible: false,
      failure_isolation: 'SUPPRESS_AFFECTED_CLOCK_ONLY',
      blocker_codes: blockerCodes,
    },
  };
  const seed = freeze({
    ...body,
    qxo_no_shop_clock_parser_bound_review_seed_id: contentId(
      'QXO_NO_SHOP_CLOCK_PARSER_BOUND_REVIEW_SEED/V1',
      body,
    ),
    canonical_payload_digest: contentId(
      'QXO_NO_SHOP_CLOCK_PARSER_BOUND_REVIEW_SEED_PAYLOAD/V1',
      body,
    ),
  });
  preflightSeed(seed);
  return seed;
}

function validateQxoNoShopClockParserBoundReviewSeed({
  qxo_no_shop_clock_parser_bound_review_seed: seed,
  ...inputs
} = {}) {
  validateQxoNoShopClockParserBoundReviewSeedCarrierIdentity(seed);
  const expected = buildQxoNoShopClockParserBoundReviewSeed(inputs);
  if (canonicalJson(seed) !== canonicalJson(expected)) {
    fail(
      'SEED_IDENTITY_MISMATCH',
      'the QXO no-shop clock parser-bound review seed has drifted',
    );
  }
  return true;
}

module.exports = {
  AUTHORITY_SCOPE,
  MAX_SEED_BYTES,
  QxoNoShopClockParserBridgeError,
  buildQxoNoShopClockParserBoundReviewSeed,
  validateQxoNoShopClockParserBoundReviewSeedCarrierIdentity,
  validateQxoNoShopClockParserBoundReviewSeed,
};
