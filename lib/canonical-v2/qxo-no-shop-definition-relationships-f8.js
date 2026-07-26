const {
  canonicalJson,
  contentId,
  sha256Hex,
} = require('./canonical-bytes');
const {
  FIXTURE_CONTRACT_FINGERPRINT_V8,
  validateContractBundle,
} = require('./contract-bundle');
const {
  validateQxoNoShopNoticeReviewMaterialisationF7CarrierIdentity,
} = require('./qxo-no-shop-notice-review-materialisation-f7');
const {
  validateQxoNoShopNoticeSourceBindingF6CarrierIdentity,
} = require('./qxo-no-shop-notice-source-binding-f6');
const {
  validateQxoNoShopReviewedDefinitionGraphF6CarrierIdentity,
} = require('./qxo-no-shop-reviewed-definition-graph-f6');

const AUTHORITY_SCOPE =
  'OFFLINE_REVIEWED_QXO_NO_SHOP_DEFINITION_RELATIONSHIPS_F8_ONLY';
const DOCUMENT_HASH =
  'abba043018410d718c207e7d7a43c9567166f6a10c4c9a6b4b0c8c7761cd6b9d';
const NOTICE_PROVISION_ID =
  '8a04ee23c9906b70bdb6fc5b5f3b8202992a91ff079a87b8bb69c00b0ec62512';
const F8_NOTICE_SCHEMA_ID =
  'dc5a18df6d7e858bab742c9e7d7b04bb80429f1901e7a0a0144b8f689e56ec9b';
const F8_NOTICE_SCHEMA_DIGEST =
  'eb2f08d4a7437a2e6f0ea63c0b84bc3799da76ed5843e774566c63e33f6b27f0';
const F8_DEFINITION_EFFECT_DIGEST =
  '90eeb8ca9899b1b7713627710867da447ce629d7c90807cc0eafaebed2d8e3de';
const F7_NOTICE_ID =
  '2d934013aba6d7571559696ecc2f0e063100798b2fea256e5804111dd9d3abba';
const F7_NOTICE_DIGEST =
  '73c4f8c83a4a1656491d029caff83a762240985f4fbe819f715d0ce6e6e4849e';
const F6_SOURCE_ID =
  '3e4e1a71bf89a360b7d712f96ea28ec2d8496868b7321648f9a214d96fcef7de';
const F6_SOURCE_DIGEST =
  '018dc57ded29b913378007f34ec2d7680076af6a321f0c32daef5b8807c9091b';
const F6_GRAPH_ID =
  '5f10f1f883b623efa5e988630240cf7c7bdbf6308c261383ae86a992f3f856bc';
const F6_GRAPH_DIGEST =
  '8f60c00c44c6d34e0a0ddec9c94f170c4e0e62dc9aafdd90cc9742cd713a8b1b';
const MAX_CARRIER_BYTES = 192 * 1024;

const INPUT_KEYS = Object.freeze([
  'contract_bundle',
  'qxo_no_shop_notice_review_materialisation_f7',
  'qxo_no_shop_notice_source_binding_f6',
  'qxo_no_shop_reviewed_definition_graph_f6',
]);
const CARRIER_KEYS = Object.freeze([
  'schema_version',
  'authority_scope',
  'contract_binding',
  'source_binding',
  'upstream_bindings',
  'notice_occurrence',
  'definition_occurrences',
  'source_party_context',
  'relationship_outcomes',
  'notice_revision_materialisation',
  'status',
  'qxo_no_shop_definition_relationships_f8_id',
  'canonical_payload_digest',
]);

const TARGET_PARTY = Object.freeze({
  role: 'COVENANT_OBLIGOR',
  value: 'COMPANY',
  capacity: 'TARGET',
});

const RELATIONSHIP_SPECS = Object.freeze([
  Object.freeze({
    definition_key: 'COMPANY_ACQUISITION_PROPOSAL',
    raw_use_form: 'Company Acquisition Proposal',
    absolute_start: 207988,
    absolute_end: 208016,
    use_form_code: 'EXACT_DECLARED_TERM',
    legal_role_code: 'OPERATIVE_SCOPE_OR_CONTENT_QUALIFIER',
    endpoint_kind: 'NOTICE_OBLIGATION_OCCURRENCE',
    affected_field_key: 'content_requirement_codes',
    recursive_dependency_start: null,
    upstream_resolution_kind: 'REVIEWED_DEFINITION_USE_BINDING',
    upstream_use_purpose_codes: Object.freeze(['COMPLETE_NOTICE_TRIGGER']),
    upstream_review_resolution_ids: Object.freeze([
      'bdb5f4326855c26e6336d625d90d7ae27ef2f018dd5af20cd7c31c3058d0ae20',
    ]),
  }),
  Object.freeze({
    definition_key: 'COMPANY_ACQUISITION_PROPOSAL',
    raw_use_form: 'Company Acquisition Proposal',
    absolute_start: 208321,
    absolute_end: 208349,
    use_form_code: 'EXACT_DECLARED_TERM',
    legal_role_code: 'NESTED_DEFINITION_DEPENDENCY',
    endpoint_kind: 'DEFINITION_OCCURRENCE',
    affected_field_key: 'nested_definition_dependency',
    endpoint_definition_key: 'COMPANY_REQUEST',
    recursive_dependency_start: null,
    upstream_resolution_kind: 'REVIEWED_DEFINITION_USE_BINDING',
    upstream_use_purpose_codes: Object.freeze([
      'COMPLETE_NOTICE_TRIGGER',
      'NESTED_DEFINITION_DEPENDENCY',
    ]),
    upstream_dependency_resolution: Object.freeze({
      resolution_id:
        'b5d565d21ae4de7e9437e2c02971d9490785c77c233d0cac89500413ebfe3ed9',
      container_definition_key: 'COMPANY_REQUEST',
      referenced_definition_key: 'COMPANY_ACQUISITION_PROPOSAL',
    }),
    upstream_review_resolution_ids: Object.freeze([
      '84f93d9617d190f9abeea9dbc9e33d264342f6d8d20c0dc3f8ef6d2a83fba833',
      'b5d565d21ae4de7e9437e2c02971d9490785c77c233d0cac89500413ebfe3ed9',
    ]),
  }),
  Object.freeze({
    definition_key: 'COMPANY_ACQUISITION_PROPOSAL',
    raw_use_form: 'Company Acquisition Proposal',
    absolute_start: 208505,
    absolute_end: 208533,
    use_form_code: 'EXACT_DECLARED_TERM',
    legal_role_code: 'OPERATIVE_TRIGGER',
    endpoint_kind: 'NOTICE_OBLIGATION_OCCURRENCE',
    affected_field_key: 'trigger_expression',
    recursive_dependency_start: null,
    upstream_resolution_kind: 'REVIEWED_DEFINITION_USE_BINDING',
    upstream_use_purpose_codes: Object.freeze(['COMPLETE_NOTICE_TRIGGER']),
    upstream_review_resolution_ids: Object.freeze([
      '02990ce5ae877062ab0fdcc3d469abfee3bc3755da8ed2b210e73cd81c8cd594',
    ]),
  }),
  Object.freeze({
    definition_key: 'COMPANY_REQUEST',
    raw_use_form: 'Company Request',
    absolute_start: 208541,
    absolute_end: 208556,
    use_form_code: 'EXACT_DECLARED_TERM',
    legal_role_code: 'OPERATIVE_TRIGGER',
    endpoint_kind: 'NOTICE_OBLIGATION_OCCURRENCE',
    affected_field_key: 'trigger_expression',
    recursive_dependency_start: 208321,
    upstream_resolution_kind: 'REVIEWED_DEFINITION_USE_BINDING',
    upstream_use_purpose_codes: Object.freeze(['COMPLETE_NOTICE_TRIGGER']),
    upstream_review_resolution_ids: Object.freeze([
      '5974471d8337ee3d810723c5d0f47fa7d35c50484ead33f7f442ac2ac70fc73c',
    ]),
  }),
  Object.freeze({
    definition_key: 'COMPANY_REQUEST',
    raw_use_form: 'Company Requests',
    absolute_start: 208683,
    absolute_end: 208699,
    use_form_code: 'DECLARED_TERM_PLUS_ASCII_LOWERCASE_S',
    legal_role_code: 'OPERATIVE_OBLIGATION_OBJECT',
    endpoint_kind: 'NOTICE_OBLIGATION_OCCURRENCE',
    affected_field_key: 'copy_subject_codes',
    recursive_dependency_start: 208321,
    upstream_resolution_kind: 'REVIEWED_SOURCE_SPECIFIC_PLURAL_USE',
    upstream_review_resolution_ids: Object.freeze([
      '0e4bd148004aed40e21bbf1276075285f8fe1079bdea4bb75475b6e3ca49940c',
    ]),
  }),
  Object.freeze({
    definition_key: 'COMPANY_ACQUISITION_PROPOSAL',
    raw_use_form: 'Company Acquisition Proposal',
    absolute_start: 208759,
    absolute_end: 208787,
    use_form_code: 'EXACT_DECLARED_TERM',
    legal_role_code: 'OPERATIVE_SCOPE_OR_CONTENT_QUALIFIER',
    endpoint_kind: 'NOTICE_OBLIGATION_OCCURRENCE',
    affected_field_key: 'copy_subject_codes',
    recursive_dependency_start: null,
    upstream_resolution_kind: 'REVIEWED_DEFINITION_USE_BINDING',
    upstream_use_purpose_codes: Object.freeze(['COMPLETE_NOTICE_COPY_DUTY']),
    upstream_review_resolution_ids: Object.freeze([
      '7c03f00d489a9524337b8992a170935073d71c855e6136b99ca9f532b0f83218',
    ]),
  }),
  Object.freeze({
    definition_key: 'COMPANY_ACQUISITION_PROPOSAL',
    raw_use_form: 'Company Acquisition Proposal',
    absolute_start: 208830,
    absolute_end: 208858,
    use_form_code: 'EXACT_DECLARED_TERM',
    legal_role_code: 'OPERATIVE_SCOPE_OR_CONTENT_QUALIFIER',
    endpoint_kind: 'NOTICE_OBLIGATION_OCCURRENCE',
    affected_field_key: 'copy_subject_codes',
    recursive_dependency_start: null,
    upstream_resolution_kind: 'REVIEWED_DEFINITION_USE_BINDING',
    upstream_use_purpose_codes: Object.freeze(['COMPLETE_NOTICE_COPY_DUTY']),
    upstream_review_resolution_ids: Object.freeze([
      'f8e1cbccd9ec8e7ca50407cccba28b632903e25025cb290d32b62a8d4fb9856f',
    ]),
  }),
]);

const EXCERPT_DEFINITION_BODY = Object.freeze({
  schema_version: 'EXCERPT_DEFINITION/V1',
  excerpt_definition_key: 'SINGLE_OPERATIVE_SPAN',
  excerpt_definition_version: 1,
  component_slots: Object.freeze([Object.freeze({
    component_slot_key: 'PRIMARY',
    governed_slot_ordinal: 0,
    cardinality: 'EXACTLY_ONE',
  })]),
  excerpt_purpose: 'LEGAL_EVIDENCE',
  transformation_or_redaction_version: 'IDENTITY_UTF8/V1',
});
const EXCERPT_DEFINITION_PAYLOAD_DIGEST = contentId(
  'EXCERPT_DEFINITION_PAYLOAD/V1',
  EXCERPT_DEFINITION_BODY,
);
const INTERPRETATION_NOTE =
  'The exact source use is mapped to the selected source definition for Review. A complete conflict and override scan has not established that the selected definition controls, so the relationship effect is not publishable or comparable.';
const PLURAL_INTERPRETATION_NOTE =
  'The exact plural source use is resolved to the declared singular Company Request solely for this QXO use. This creates no alias authority. A complete conflict and override scan remains outstanding, so the relationship effect is not publishable or comparable.';

class QxoNoShopDefinitionRelationshipsF8Error extends Error {
  constructor(code, message) {
    super(message);
    this.name = 'QxoNoShopDefinitionRelationshipsF8Error';
    this.code = code;
  }
}

function fail(code, message) {
  throw new QxoNoShopDefinitionRelationshipsF8Error(code, message);
}

function freeze(value) {
  if (!value || typeof value !== 'object' || Object.isFrozen(value)) return value;
  Object.values(value).forEach(freeze);
  return Object.freeze(value);
}

function exactKeys(value, keys) {
  return value && typeof value === 'object' && !Array.isArray(value)
    && canonicalJson(Object.keys(value).sort()) === canonicalJson([...keys].sort());
}

function sortedUnique(values) {
  return [...new Set(values)].sort();
}

function evidence(sourceCarrier, sourceKey) {
  const matches = sourceCarrier.source_evidence.filter(
    (entry) => entry.source_key === sourceKey,
  );
  if (matches.length !== 1) {
    fail('SOURCE_EVIDENCE_DRIFT', `${sourceKey} exact evidence is required`);
  }
  return matches[0];
}

function excerptReference(span) {
  const identity = {
    excerpt_definition_key: EXCERPT_DEFINITION_BODY.excerpt_definition_key,
    excerpt_definition_version:
      EXCERPT_DEFINITION_BODY.excerpt_definition_version,
    excerpt_definition_payload_digest: EXCERPT_DEFINITION_PAYLOAD_DIGEST,
    ordered_component_assignments: [{
      component_slot_key: 'PRIMARY',
      governed_slot_ordinal: 0,
      semantic_span_id: span.semantic_span_id,
    }],
    excerpt_purpose: EXCERPT_DEFINITION_BODY.excerpt_purpose,
    transformation_or_redaction_version:
      EXCERPT_DEFINITION_BODY.transformation_or_redaction_version,
    output_text_hash: span.exact_bytes_digest,
  };
  return freeze({
    excerpt_id: contentId('EXCERPT/V1', identity),
    semantic_span_id: span.semantic_span_id,
    absolute_start: span.absolute_start,
    absolute_end: span.absolute_end,
    exact_bytes_digest: span.exact_bytes_digest,
  });
}

function definitionCue(graph, definitionKey) {
  const disposition = graph.candidate_dispositions.find(
    (entry) => entry.definition_key === definitionKey,
  );
  const matches = graph.validated_semantic_graph.definition_cues.filter(
    (entry) => entry.definition_cue_id === disposition?.definition_cue_id,
  );
  if (matches.length !== 1) {
    fail('DEFINITION_OCCURRENCE_SOURCE_DRIFT', `${definitionKey} definition cue is required`);
  }
  return matches[0];
}

function exactUseSpan(graph, spec, sourceCarrier) {
  if (spec.use_form_code === 'DECLARED_TERM_PLUS_ASCII_LOWERCASE_S') {
    const pluralEvidence = evidence(sourceCarrier, 'COMPANY_REQUESTS_TERM');
    if (pluralEvidence.source_excerpt.exact_text !== spec.raw_use_form
      || pluralEvidence.semantic_span.absolute_start !== spec.absolute_start
      || pluralEvidence.semantic_span.absolute_end !== spec.absolute_end) {
      fail('PLURAL_USE_SOURCE_DRIFT', 'the exact Company Requests use is required');
    }
    return pluralEvidence.semantic_span;
  }
  const matches = graph.validated_semantic_graph.definition_use_cues.filter(
    (entry) => entry.use_span.absolute_start === spec.absolute_start
      && entry.use_span.absolute_end === spec.absolute_end,
  );
  if (matches.length !== 1) {
    fail('DEFINITION_USE_SOURCE_DRIFT', `${spec.absolute_start} exact use is required`);
  }
  const selectedCue = definitionCue(graph, spec.definition_key);
  if (matches[0].definition_cue_id !== selectedCue.definition_cue_id
    || matches[0].use_span.exact_bytes_digest
      !== selectedCue.term_span.exact_bytes_digest) {
    fail('DEFINITION_USE_SOURCE_DRIFT', `${spec.absolute_start} selected definition drifted`);
  }
  return matches[0].use_span;
}

function validateRelationshipSpecTopology(specs = RELATIONSHIP_SPECS) {
  const specByStart = new Map();
  for (const spec of specs) {
    if (!Number.isSafeInteger(spec.absolute_start)
      || specByStart.has(spec.absolute_start)) {
      fail(
        'RELATIONSHIP_DEPENDENCY_TOPOLOGY_INVALID',
        'relationship starts must be unique safe integers',
      );
    }
    specByStart.set(spec.absolute_start, spec);
  }
  for (const spec of specs) {
    const dependencyStart = spec.recursive_dependency_start;
    if (dependencyStart == null) continue;
    if (!Number.isSafeInteger(dependencyStart)
      || dependencyStart === spec.absolute_start
      || dependencyStart >= spec.absolute_start
      || !specByStart.has(dependencyStart)) {
      fail(
        'RELATIONSHIP_DEPENDENCY_TOPOLOGY_INVALID',
        `${spec.absolute_start} has an invalid dependency target`,
      );
    }
  }
  const visitState = new Map();
  function visit(start) {
    const state = visitState.get(start);
    if (state === 'VISITING') {
      fail(
        'RELATIONSHIP_DEPENDENCY_TOPOLOGY_INVALID',
        'the relationship dependency graph contains a cycle',
      );
    }
    if (state === 'VISITED') return;
    visitState.set(start, 'VISITING');
    const dependencyStart = specByStart.get(start).recursive_dependency_start;
    if (dependencyStart != null) visit(dependencyStart);
    visitState.set(start, 'VISITED');
  }
  for (const start of specByStart.keys()) visit(start);
  return true;
}

function validateReviewResolutionBindings(sourceCarrier, graph) {
  const dependencyContract =
    sourceCarrier.definition_relationship_dependency;
  const expectedDirectIds = RELATIONSHIP_SPECS
    .filter((spec) => (
      spec.upstream_resolution_kind === 'REVIEWED_DEFINITION_USE_BINDING'
    ))
    .map((spec) => spec.upstream_review_resolution_ids[0])
    .sort();
  const expectedPluralIds = RELATIONSHIP_SPECS
    .filter((spec) => (
      spec.upstream_resolution_kind
        === 'REVIEWED_SOURCE_SPECIFIC_PLURAL_USE'
    ))
    .map((spec) => spec.upstream_review_resolution_ids[0]);
  const expectedDependencyIds = RELATIONSHIP_SPECS
    .flatMap((spec) => (
      spec.upstream_dependency_resolution
        ? [spec.upstream_dependency_resolution.resolution_id]
        : []
    ))
    .sort();
  if (canonicalJson(expectedDirectIds) !== canonicalJson(
    dependencyContract.reviewed_definition_use_binding_ids,
  ) || expectedPluralIds.length !== 1
    || dependencyContract.reviewed_plural_definition_use_id
      !== expectedPluralIds[0]
    || canonicalJson(expectedDependencyIds) !== canonicalJson(
      dependencyContract.reviewed_definition_dependency_edge_ids,
    )) {
    fail(
      'UPSTREAM_REVIEW_RESOLUTION_DRIFT',
      'the exact typed predecessor inventory is required',
    );
  }

  const directById = new Map(graph.reviewed_use_bindings.map((binding) => [
    binding.qxo_no_shop_reviewed_definition_use_binding_f6_id,
    binding,
  ]));
  const dependencyById = new Map(
    graph.definition_dependency_edges.map((edge) => [
      edge.qxo_no_shop_definition_dependency_edge_f6_id,
      edge,
    ]),
  );
  for (const spec of RELATIONSHIP_SPECS) {
    const expectedIds = [];
    if (spec.upstream_resolution_kind === 'REVIEWED_DEFINITION_USE_BINDING') {
      const directId = spec.upstream_review_resolution_ids[0];
      const binding = directById.get(directId);
      if (!binding
        || binding.schema_version
          !== 'QXO_NO_SHOP_REVIEWED_DEFINITION_USE_BINDING_F6/V1'
        || binding.definition_key !== spec.definition_key
        || binding.absolute_start !== spec.absolute_start
        || binding.absolute_end !== spec.absolute_end
        || binding.exact_bytes_digest !== sha256Hex(
          Buffer.from(spec.raw_use_form, 'utf8'),
        )
        || binding.observed_form_code !== 'EXACT_CANONICAL_TERM'
        || binding.inventory_scope !== 'DEPENDENCY_SCOPED'
        || canonicalJson(binding.purpose_codes)
          !== canonicalJson(spec.upstream_use_purpose_codes)) {
        fail(
          'UPSTREAM_REVIEW_RESOLUTION_DRIFT',
          `${spec.absolute_start} use predecessor semantics drifted`,
        );
      }
      expectedIds.push(directId);
      if (spec.upstream_dependency_resolution) {
        const dependencySpec = spec.upstream_dependency_resolution;
        const edge = dependencyById.get(dependencySpec.resolution_id);
        const containerCue = definitionCue(
          graph,
          dependencySpec.container_definition_key,
        );
        const referencedCue = definitionCue(
          graph,
          dependencySpec.referenced_definition_key,
        );
        if (!edge
          || edge.schema_version
            !== 'QXO_NO_SHOP_DEFINITION_DEPENDENCY_EDGE_F6/V1'
          || edge.governed_ordinal !== spec.absolute_start
          || edge.container_definition_key
            !== dependencySpec.container_definition_key
          || edge.referenced_definition_key
            !== dependencySpec.referenced_definition_key
          || edge.container_definition_cue_id
            !== containerCue.definition_cue_id
          || edge.referenced_definition_cue_id
            !== referencedCue.definition_cue_id
          || edge.referenced_definition_use_cue_id
            !== binding.definition_use_cue_id) {
          fail(
            'UPSTREAM_REVIEW_RESOLUTION_DRIFT',
            `${spec.absolute_start} dependency predecessor semantics drifted`,
          );
        }
        expectedIds.push(dependencySpec.resolution_id);
      }
    } else if (
      spec.upstream_resolution_kind
        === 'REVIEWED_SOURCE_SPECIFIC_PLURAL_USE'
    ) {
      const plural =
        sourceCarrier.plural_definition_use_resolution;
      const pluralId = spec.upstream_review_resolution_ids[0];
      const pluralEvidence = evidence(sourceCarrier, 'COMPANY_REQUESTS_TERM');
      const declarationBinding = graph.reviewed_use_bindings.find(
        (binding) => binding.definition_key === spec.definition_key
          && binding.absolute_start === 208354
          && binding.absolute_end === 208369
          && binding.observed_form_code === 'EXACT_CANONICAL_TERM'
          && canonicalJson(binding.purpose_codes)
            === canonicalJson(['DECLARATION']),
      );
      const predecessorResidual = graph.retained_use_residuals.find(
        (residual) => residual.definition_key === spec.definition_key
          && residual.evidence_span.absolute_start === spec.absolute_start
          && residual.evidence_span.absolute_end === spec.absolute_end,
      );
      if (!plural || !declarationBinding || !predecessorResidual
        || plural.schema_version
          !== 'QXO_NO_SHOP_REVIEWED_PLURAL_DEFINITION_USE_F6/V1'
        || plural.qxo_no_shop_reviewed_plural_definition_use_f6_id
          !== pluralId
        || plural.governed_ordinal !== spec.absolute_start
        || plural.definition_key !== spec.definition_key
        || plural.observed_text !== spec.raw_use_form
        || plural.transformation_code
          !== 'EXACT_DECLARED_TERM_PLUS_ASCII_LOWERCASE_S'
        || plural.transformation_scope !== 'THIS_QXO_SOURCE_USE_ONLY'
        || plural.declaration_use_binding_id
          !== declarationBinding
            .qxo_no_shop_reviewed_definition_use_binding_f6_id
        || plural.predecessor_residual_id
          !== predecessorResidual.qxo_no_shop_definition_use_residual_f6_id
        || plural.evidence_excerpt_id
          !== pluralEvidence.source_excerpt.excerpt_id
        || plural.disposition
          !== 'REVIEWED_SOURCE_SPECIFIC_USE_RESOLUTION'
        || plural.alias_authority !== 'NONE'
        || plural.taxonomy_authority !== 'NONE'
        || plural.corpus_wide_normalisation_authority !== 'NONE'
        || plural.canonical_definition_use_relationship_id !== null) {
        fail(
          'UPSTREAM_REVIEW_RESOLUTION_DRIFT',
          `${spec.absolute_start} plural predecessor semantics drifted`,
        );
      }
      expectedIds.push(pluralId);
    } else {
      fail(
        'UPSTREAM_REVIEW_RESOLUTION_DRIFT',
        `${spec.absolute_start} has an unknown predecessor kind`,
      );
    }
    if (canonicalJson(expectedIds.sort()) !== canonicalJson(
      [...spec.upstream_review_resolution_ids].sort(),
    )) {
      fail(
        'UPSTREAM_REVIEW_RESOLUTION_DRIFT',
        `${spec.absolute_start} predecessor IDs do not match their roles`,
      );
    }
  }
}

function validateInputs(input) {
  if (!exactKeys(input, INPUT_KEYS)) {
    fail('INPUT_CONTRACT_MISMATCH', 'the F8 relationship input is outside its contract');
  }
  const contractBundle = input.contract_bundle;
  const sourceCarrier = input.qxo_no_shop_notice_source_binding_f6;
  const graph = input.qxo_no_shop_reviewed_definition_graph_f6;
  const notice = input.qxo_no_shop_notice_review_materialisation_f7;
  validateContractBundle(contractBundle);
  validateQxoNoShopNoticeSourceBindingF6CarrierIdentity(sourceCarrier);
  validateQxoNoShopReviewedDefinitionGraphF6CarrierIdentity(graph);
  validateQxoNoShopNoticeReviewMaterialisationF7CarrierIdentity(notice);

  const noticeSchema = contractBundle.no_shop_semantic_schema_definitions.find(
    (entry) => entry.semantic_schema_key === 'NO_SHOP_NOTICE_OBLIGATION',
  );
  const effectSchemaDigest = contentId(
    'USES_DEFINITION_EFFECT_SCHEMA_PAYLOAD/V2',
    contractBundle.definition_use_effect_schema_definition,
  );
  if (contractBundle.fingerprint !== FIXTURE_CONTRACT_FINGERPRINT_V8
    || noticeSchema?.semantic_schema_definition_id !== F8_NOTICE_SCHEMA_ID
    || noticeSchema?.semantic_schema_definition_payload_digest
      !== F8_NOTICE_SCHEMA_DIGEST
    || effectSchemaDigest !== F8_DEFINITION_EFFECT_DIGEST
    || contractBundle.definition_use_effect_schema_definition
      ?.schema_version !== 'USES_DEFINITION_EFFECT/V2') {
    fail('CONTRACT_BINDING_DRIFT', 'the exact frozen F8 relationship contract is required');
  }
  if (sourceCarrier.qxo_no_shop_notice_source_binding_f6_id !== F6_SOURCE_ID
    || sourceCarrier.canonical_payload_digest !== F6_SOURCE_DIGEST
    || graph.qxo_no_shop_reviewed_definition_graph_f6_id !== F6_GRAPH_ID
    || graph.canonical_payload_digest !== F6_GRAPH_DIGEST
    || notice.qxo_no_shop_notice_review_materialisation_f7_id !== F7_NOTICE_ID
    || notice.canonical_payload_digest !== F7_NOTICE_DIGEST
    || sourceCarrier.source_binding.document_hash !== DOCUMENT_HASH
    || graph.source_binding.document_hash !== DOCUMENT_HASH
    || notice.source_binding.document_hash !== DOCUMENT_HASH
    || sourceCarrier.notice_obligation_materialisation
      .source_provision_instance_id !== NOTICE_PROVISION_ID) {
    fail('UPSTREAM_BINDING_DRIFT', 'the exact QXO review carriers are required');
  }
  if (sourceCarrier.status.publication_blocked !== true
    || graph.status.publication_blocked !== true
    || notice.status.review_renderable !== true
    || notice.status.canonical_write_authority !== 'NONE') {
    fail('UPSTREAM_AUTHORITY_DRIFT', 'an upstream carrier granted unexpected authority');
  }
  validateRelationshipSpecTopology();
  validateReviewResolutionBindings(sourceCarrier, graph);
}

function buildNoticeOccurrence(sourceCarrier) {
  const source = evidence(sourceCarrier, 'FIRST_SENTENCE');
  const identity = {
    document_hash: DOCUMENT_HASH,
    exact_source_span: source.semantic_span,
    concept_key: 'NOSOL-NOTICE',
    party: TARGET_PARTY,
    governed_ordinal: source.governed_ordinal,
    source_provision_instance_id: NOTICE_PROVISION_ID,
  };
  return freeze({
    schema_version: 'NOTICE_OBLIGATION_OCCURRENCE/V1',
    notice_obligation_occurrence_id: contentId(
      'NOTICE_OBLIGATION_OCCURRENCE/V1',
      identity,
    ),
    ...identity,
  });
}

function buildDefinitionOccurrence(cue) {
  const identity = {
    document_hash: DOCUMENT_HASH,
    exact_declaration_span: cue.term_span,
    ordered_body_spans: cue.body_spans,
    neutral_definition_key: cue.raw_term_digest,
    governed_ordinal: cue.source_order_ordinal,
  };
  return freeze({
    schema_version: 'DEFINITION_OCCURRENCE/V1',
    definition_occurrence_id: contentId('DEFINITION_OCCURRENCE/V1', identity),
    raw_term: cue.raw_term,
    predecessor_definition_cue_id: cue.definition_cue_id,
    ...identity,
  });
}

function buildUseOccurrence(spec, useSpan) {
  const identity = {
    document_hash: DOCUMENT_HASH,
    exact_use_span: useSpan,
    raw_use_form: spec.raw_use_form,
    governed_ordinal: spec.absolute_start,
  };
  return freeze({
    schema_version: 'DEFINITION_USE_OCCURRENCE/V1',
    definition_use_occurrence_id: contentId(
      'DEFINITION_USE_OCCURRENCE/V1',
      identity,
    ),
    ...identity,
  });
}

function buildSourcePartyContext(sourceCarrier) {
  const companyEvidence = evidence(sourceCarrier, 'COMPANY_OBLIGOR');
  const evidenceExcerptIds = [companyEvidence.source_excerpt.excerpt_id];
  const identity = {
    document_hash: DOCUMENT_HASH,
    source_scope_id:
      evidence(sourceCarrier, 'FIRST_SENTENCE').semantic_span.semantic_span_id,
    party: TARGET_PARTY,
    evidence_excerpt_ids: evidenceExcerptIds,
  };
  return freeze({
    schema_version: 'SOURCE_PARTY_CONTEXT/V1',
    source_party_context_id: contentId('SOURCE_PARTY_CONTEXT/V1', identity),
    ...identity,
  });
}

function relationshipEvidence(
  selectedDefinitionOccurrence,
  useOccurrence,
  sourceCarrier,
) {
  const declaration = excerptReference(
    selectedDefinitionOccurrence.exact_declaration_span,
  );
  if (selectedDefinitionOccurrence.ordered_body_spans.length !== 1) {
    fail('DEFINITION_BODY_CARDINALITY_UNSUPPORTED', 'one exact definition body span is required');
  }
  const body = excerptReference(
    selectedDefinitionOccurrence.ordered_body_spans[0],
  );
  const exactUse = excerptReference(useOccurrence.exact_use_span);
  const evidenceByRole = {
    EXACT_USE: exactUse.excerpt_id,
    DEFINITION_DECLARATION: declaration.excerpt_id,
    DEFINITION_BODY: body.excerpt_id,
  };
  if (useOccurrence.raw_use_form === 'Company Requests') {
    evidenceByRole.PLURAL_RESOLUTION = sourceCarrier
      .plural_definition_use_resolution.evidence_excerpt_id;
  }
  return freeze({
    evidence_by_role: evidenceByRole,
    evidence_excerpt_ids: sortedUnique(Object.values(evidenceByRole)),
    evidence_references: {
      EXACT_USE: exactUse,
      DEFINITION_DECLARATION: declaration,
      DEFINITION_BODY: body,
    },
  });
}

function buildRelationship(
  spec,
  context,
  recursiveDependencyRelationshipIds,
) {
  const useSpan = exactUseSpan(context.graph, spec, context.sourceCarrier);
  const useOccurrence = buildUseOccurrence(spec, useSpan);
  const selectedDefinitionOccurrence =
    context.definitionOccurrenceByKey.get(spec.definition_key);
  const affectedEndpointId = spec.endpoint_kind === 'NOTICE_OBLIGATION_OCCURRENCE'
    ? context.noticeOccurrence.notice_obligation_occurrence_id
    : context.definitionOccurrenceByKey.get(spec.endpoint_definition_key)
      .definition_occurrence_id;
  const affectedEndpoint = {
    endpoint_kind: spec.endpoint_kind,
    endpoint_id: affectedEndpointId,
    affected_field_key: spec.affected_field_key,
  };
  const occurrenceIdentity = {
    document_hash: DOCUMENT_HASH,
    relationship_key: 'USES_DEFINITION',
    exact_use_occurrence_id: useOccurrence.definition_use_occurrence_id,
    legal_role_code: spec.legal_role_code,
    affected_endpoint: affectedEndpoint,
    governed_ordinal: spec.absolute_start,
  };
  const relationshipOccurrenceId = contentId(
    'QXO_NO_SHOP_USES_DEFINITION_REVIEW_OCCURRENCE_F8/V1',
    occurrenceIdentity,
  );
  const evidenceBinding = relationshipEvidence(
    selectedDefinitionOccurrence,
    useOccurrence,
    context.sourceCarrier,
  );
  const lawyerNote = spec.use_form_code
    === 'DECLARED_TERM_PLUS_ASCII_LOWERCASE_S'
    ? PLURAL_INTERPRETATION_NOTE
    : INTERPRETATION_NOTE;
  const interpretationIdentity = {
    relationship_occurrence_id: relationshipOccurrenceId,
    policy_version: 'CLAIM_INTERPRETATION_POLICY/V1',
    clarity_state: 'REASONABLE_BUT_AMBIGUOUS',
    primary_interpretation: {
      code: 'APPLY_SELECTED_DEFINITION_TO_EXACT_USE',
      selected_definition_occurrence_id:
        selectedDefinitionOccurrence.definition_occurrence_id,
    },
    alternative_interpretations: [{
      code:
        'CONTROLLING_DEFINITION_MAY_DIFFER_AFTER_CONFLICT_OR_OVERRIDE_REVIEW',
    }],
    ambiguity_dimension_codes: ['DEFINITION_PRECEDENCE'],
    evidence_by_role: evidenceBinding.evidence_by_role,
    lawyer_note_digest: sha256Hex(Buffer.from(lawyerNote, 'utf8')),
    review_provenance: {
      review_authority: 'BEN_APPROVED_F8_REVIEW_MATERIALISATION',
      source_review_scope: 'EXACT_QXO_FIRST_NOTICE_SENTENCE',
      publication_authority: 'NONE',
    },
  };
  const interpretation = freeze({
    schema_version: 'RELATIONSHIP_INTERPRETATION/V1',
    ...interpretationIdentity,
    relationship_interpretation_payload_id: contentId(
      'RELATIONSHIP_INTERPRETATION/V1',
      interpretationIdentity,
    ),
    lawyer_review_note: lawyerNote,
  });
  const effectIdentity = {
    legal_operation: 'APPLY_SELECTED_DEFINITION_TO_EXACT_USE',
    effect_schema_version: 2,
    exact_use_occurrence_id: useOccurrence.definition_use_occurrence_id,
    exact_use_span: useOccurrence.exact_use_span,
    raw_use_form: useOccurrence.raw_use_form,
    selected_definition_occurrence_id:
      selectedDefinitionOccurrence.definition_occurrence_id,
    use_form_code: spec.use_form_code,
    legal_role_code: spec.legal_role_code,
    affected_endpoint: affectedEndpoint,
    party_scope: {
      source_party_context_id:
        context.sourcePartyContext.source_party_context_id,
      affected_endpoint_party_context: TARGET_PARTY,
      definition_party_context: {
        applicability_state: 'NOT_APPLICABLE',
      },
    },
    evidence_excerpt_ids: evidenceBinding.evidence_excerpt_ids,
    evidence_by_role: evidenceBinding.evidence_by_role,
    scope_closure_id: null,
    relationship_interpretation_payload_id:
      interpretation.relationship_interpretation_payload_id,
    definition_precedence_review:
      'BLOCKING_CONFLICT_OR_OVERRIDE_UNRESOLVED',
    recursive_dependency_relationship_ids:
      sortedUnique(recursiveDependencyRelationshipIds),
  };
  return freeze({
    schema_version: 'QXO_NO_SHOP_USES_DEFINITION_RELATIONSHIP_F8/V1',
    relationship_occurrence: {
      schema_version:
        'QXO_NO_SHOP_USES_DEFINITION_REVIEW_OCCURRENCE_F8/V1',
      relationship_occurrence_id: relationshipOccurrenceId,
      identity_authority: 'REVIEW_ONLY',
      ...occurrenceIdentity,
    },
    relationship_effect: {
      schema_version: 'USES_DEFINITION_EFFECT/V2',
      relationship_effect_revision_id: contentId(
        'USES_DEFINITION_EFFECT/V2',
        effectIdentity,
      ),
      ...effectIdentity,
      propagation: 'EXACT_NAMED_TARGET_ONLY',
      party_transfer: 'NONE',
      alias_authority: 'NONE',
    },
    relationship_interpretation: interpretation,
    source_predecessor_review_resolution_ids:
      [...spec.upstream_review_resolution_ids].sort(),
    evidence_references: evidenceBinding.evidence_references,
    comparison_state: 'BLOCKED_DEFINITION_PRECEDENCE_UNRESOLVED',
    publication_state: 'REVIEW_ONLY_NOT_PUBLISHABLE',
  });
}

function buildOutcome(spec, context, outcomeByStart, forcedFailureStart) {
  const dependency = spec.recursive_dependency_start == null
    ? null
    : outcomeByStart.get(spec.recursive_dependency_start);
  if (spec.recursive_dependency_start != null && !dependency) {
    fail(
      'RELATIONSHIP_DEPENDENCY_TOPOLOGY_INVALID',
      `${spec.absolute_start} dependency was not materialised exactly once`,
    );
  }
  if (dependency?.suppressed) {
    return freeze({
      schema_version: 'QXO_NO_SHOP_DEFINITION_RELATIONSHIP_OUTCOME_F8/V1',
      governed_ordinal: spec.absolute_start,
      suppressed: true,
      failure_code: 'DEPENDENT_DEFINITION_RELATIONSHIP_UNRESOLVED',
      relationship: null,
    });
  }
  try {
    if (forcedFailureStart === spec.absolute_start) {
      fail(
        'ATTESTED_DEFINITION_RELATIONSHIP_FAILURE',
        `${spec.absolute_start} attested relationship failure`,
      );
    }
    const recursiveDependencyIds = dependency
      ? [dependency.relationship.relationship_effect
        .relationship_effect_revision_id]
      : [];
    const relationship = buildRelationship(
      spec,
      context,
      recursiveDependencyIds,
    );
    return freeze({
      schema_version: 'QXO_NO_SHOP_DEFINITION_RELATIONSHIP_OUTCOME_F8/V1',
      governed_ordinal: spec.absolute_start,
      suppressed: false,
      failure_code: null,
      relationship,
    });
  } catch (error) {
    const isolatedCodes = new Set([
      'ATTESTED_DEFINITION_RELATIONSHIP_FAILURE',
      'SOURCE_EVIDENCE_DRIFT',
      'DEFINITION_OCCURRENCE_SOURCE_DRIFT',
      'DEFINITION_USE_SOURCE_DRIFT',
      'PLURAL_USE_SOURCE_DRIFT',
      'DEFINITION_BODY_CARDINALITY_UNSUPPORTED',
    ]);
    if (!(error instanceof QxoNoShopDefinitionRelationshipsF8Error)
      || !isolatedCodes.has(error.code)) {
      throw error;
    }
    return freeze({
      schema_version: 'QXO_NO_SHOP_DEFINITION_RELATIONSHIP_OUTCOME_F8/V1',
      governed_ordinal: spec.absolute_start,
      suppressed: true,
      failure_code: error.code,
      relationship: null,
    });
  }
}

function validateCarrierIdentity(carrier) {
  if (!exactKeys(carrier, CARRIER_KEYS)
    || carrier.schema_version
      !== 'QXO_NO_SHOP_DEFINITION_RELATIONSHIPS_F8/V1') {
    fail('CARRIER_CONTRACT_MISMATCH', 'the F8 relationship carrier is invalid');
  }
  if (Buffer.byteLength(canonicalJson(carrier), 'utf8') > MAX_CARRIER_BYTES) {
    fail('CARRIER_LIMIT_EXCEEDED', 'the F8 relationship carrier exceeds its byte limit');
  }
  const body = { ...carrier };
  delete body.qxo_no_shop_definition_relationships_f8_id;
  delete body.canonical_payload_digest;
  if (carrier.qxo_no_shop_definition_relationships_f8_id !== contentId(
    'QXO_NO_SHOP_DEFINITION_RELATIONSHIPS_F8/V1',
    body,
  ) || carrier.canonical_payload_digest !== contentId(
    'QXO_NO_SHOP_DEFINITION_RELATIONSHIPS_F8_PAYLOAD/V1',
    body,
  )) {
    fail('CARRIER_IDENTITY_MISMATCH', 'the F8 relationship carrier identity has drifted');
  }
  return true;
}

function buildCarrier(input, forcedFailureStart = null) {
  validateInputs(input);
  if (forcedFailureStart !== null
    && !RELATIONSHIP_SPECS.some(
      (spec) => spec.absolute_start === forcedFailureStart,
    )) {
    fail('UNKNOWN_FORCED_FAILURE', 'the F8 relationship failure key is unknown');
  }
  const sourceCarrier = input.qxo_no_shop_notice_source_binding_f6;
  const graph = input.qxo_no_shop_reviewed_definition_graph_f6;
  const noticeOccurrence = buildNoticeOccurrence(sourceCarrier);
  const definitionOccurrenceByKey = new Map(
    ['COMPANY_REQUEST', 'COMPANY_ACQUISITION_PROPOSAL'].map((key) => [
      key,
      buildDefinitionOccurrence(definitionCue(graph, key)),
    ]),
  );
  const sourcePartyContext = buildSourcePartyContext(sourceCarrier);
  const context = {
    sourceCarrier,
    graph,
    noticeOccurrence,
    definitionOccurrenceByKey,
    sourcePartyContext,
  };
  const outcomeByStart = new Map();
  const specByStart = new Map(
    RELATIONSHIP_SPECS.map((spec) => [spec.absolute_start, spec]),
  );
  function materialiseOutcome(spec) {
    if (outcomeByStart.has(spec.absolute_start)) return;
    if (spec.recursive_dependency_start != null) {
      const dependencySpec = specByStart.get(spec.recursive_dependency_start);
      if (!dependencySpec) {
        fail(
          'RELATIONSHIP_DEPENDENCY_TOPOLOGY_INVALID',
          `${spec.absolute_start} dependency target is missing`,
        );
      }
      materialiseOutcome(dependencySpec);
    }
    outcomeByStart.set(
      spec.absolute_start,
      buildOutcome(spec, context, outcomeByStart, forcedFailureStart),
    );
  }
  for (const spec of RELATIONSHIP_SPECS) materialiseOutcome(spec);
  const relationshipOutcomes = RELATIONSHIP_SPECS.map(
    (spec) => outcomeByStart.get(spec.absolute_start),
  );
  const successfulRelationshipIds = relationshipOutcomes
    .filter((outcome) => !outcome.suppressed)
    .map((outcome) => outcome.relationship.relationship_effect
      .relationship_effect_revision_id)
    .sort();
  const anySuppressed = relationshipOutcomes.some(
    (outcome) => outcome.suppressed,
  );
  const body = {
    schema_version: 'QXO_NO_SHOP_DEFINITION_RELATIONSHIPS_F8/V1',
    authority_scope: AUTHORITY_SCOPE,
    contract_binding: {
      contract_key: input.contract_bundle.contract_key,
      contract_fingerprint: input.contract_bundle.fingerprint,
      notice_schema_definition_id: F8_NOTICE_SCHEMA_ID,
      notice_schema_definition_payload_digest: F8_NOTICE_SCHEMA_DIGEST,
      definition_effect_schema: 'USES_DEFINITION_EFFECT/V2',
      definition_effect_schema_payload_digest:
        F8_DEFINITION_EFFECT_DIGEST,
    },
    source_binding: sourceCarrier.source_binding,
    upstream_bindings: {
      qxo_no_shop_notice_source_binding_f6_id: F6_SOURCE_ID,
      qxo_no_shop_notice_source_binding_f6_payload_digest: F6_SOURCE_DIGEST,
      qxo_no_shop_reviewed_definition_graph_f6_id: F6_GRAPH_ID,
      qxo_no_shop_reviewed_definition_graph_f6_payload_digest:
        F6_GRAPH_DIGEST,
      qxo_no_shop_notice_review_materialisation_f7_id: F7_NOTICE_ID,
      qxo_no_shop_notice_review_materialisation_f7_payload_digest:
        F7_NOTICE_DIGEST,
    },
    notice_occurrence: noticeOccurrence,
    definition_occurrences: [...definitionOccurrenceByKey.entries()]
      .map(([definitionKey, occurrence]) => ({
        definition_key: definitionKey,
        occurrence,
      }))
      .sort((a, b) => a.occurrence.governed_ordinal
        - b.occurrence.governed_ordinal),
    source_party_context: sourcePartyContext,
    relationship_outcomes: relationshipOutcomes,
    notice_revision_materialisation: {
      notice_obligation_revision_id: null,
      definition_use_relationship_ids: successfulRelationshipIds,
      materialisation_authority: 'NONE',
      blocker_codes: [
        'DEFINITION_PRECEDENCE_CONFLICT_AND_OVERRIDE_SCAN_UNRESOLVED',
        'NOTICE_COMPLETE_DEFINITION_SCOPE_UNRESOLVED',
        'COPY_CLOCK_ITEM_OR_BATCH_CARDINALITY_UNRESOLVED',
        'NOTICE_REVISION_MATERIALISATION_DEFERRED',
      ],
    },
    status: {
      review_renderable: true,
      expected_relationship_count: RELATIONSHIP_SPECS.length,
      materialised_relationship_count: successfulRelationshipIds.length,
      independent_failure_isolated: anySuppressed,
      definition_precedence_state:
        'BLOCKING_CONFLICT_OR_OVERRIDE_UNRESOLVED',
      plural_resolution_scope: 'THIS_QXO_SOURCE_USE_ONLY',
      publication_blocked: true,
      comparison_blocked: true,
      absence_authority: 'NONE',
      canonical_write_authority: 'NONE',
      relationship_authority: 'NONE',
      result_authority: 'NONE',
      metric_authority: 'NONE',
      comparability_authority: 'NONE',
      query_authority: 'NONE',
      serving_authority: 'NONE',
      release_authority: 'NONE',
      release_eligible: false,
      blocker_codes: [
        'DEFINITION_PRECEDENCE_CONFLICT_AND_OVERRIDE_SCAN_UNRESOLVED',
        'NOTICE_COMPLETE_DEFINITION_SCOPE_UNRESOLVED',
        'COPY_CLOCK_ITEM_OR_BATCH_CARDINALITY_UNRESOLVED',
        'NOTICE_REVISION_MATERIALISATION_DEFERRED',
        ...anySuppressed ? ['ATTESTED_RELATIONSHIP_FAILURE'] : [],
      ].sort(),
    },
  };
  const carrier = freeze({
    ...body,
    qxo_no_shop_definition_relationships_f8_id: contentId(
      'QXO_NO_SHOP_DEFINITION_RELATIONSHIPS_F8/V1',
      body,
    ),
    canonical_payload_digest: contentId(
      'QXO_NO_SHOP_DEFINITION_RELATIONSHIPS_F8_PAYLOAD/V1',
      body,
    ),
  });
  validateCarrierIdentity(carrier);
  return carrier;
}

function buildQxoNoShopDefinitionRelationshipsF8(input = {}) {
  return buildCarrier(input);
}

function buildQxoNoShopDefinitionRelationshipsF8FailureIsolationAttestation(
  input = {},
  forcedFailureStart,
) {
  return buildCarrier(input, forcedFailureStart);
}

function validateQxoNoShopDefinitionRelationshipsF8({
  qxo_no_shop_definition_relationships_f8: carrier,
  ...input
} = {}) {
  validateCarrierIdentity(carrier);
  if (canonicalJson(carrier) !== canonicalJson(
    buildQxoNoShopDefinitionRelationshipsF8(input),
  )) {
    fail('CARRIER_IDENTITY_MISMATCH', 'the F8 relationship carrier has drifted');
  }
  return true;
}

module.exports = {
  AUTHORITY_SCOPE,
  MAX_CARRIER_BYTES,
  QxoNoShopDefinitionRelationshipsF8Error,
  RELATIONSHIP_SPECS,
  buildQxoNoShopDefinitionRelationshipsF8,
  buildQxoNoShopDefinitionRelationshipsF8FailureIsolationAttestation,
  validateQxoNoShopDefinitionRelationshipsF8,
  validateQxoNoShopDefinitionRelationshipsF8CarrierIdentity:
    validateCarrierIdentity,
  validateRelationshipSpecTopology,
};
