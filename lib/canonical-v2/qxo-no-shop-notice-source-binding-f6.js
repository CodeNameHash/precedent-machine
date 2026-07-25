const {
  buildAdmittedSourceReference,
  validateAdmittedSemanticSourceContext,
} = require('./admitted-semantic-source');
const { canonicalJson, contentId, sha256Hex } = require('./canonical-bytes');
const {
  buildClaimRevision,
  validateClaimRevisionIdentity,
} = require('./claims-relationships');
const {
  FIXTURE_CONTRACT_FINGERPRINT_V6,
  validateContractBundle,
} = require('./contract-bundle');
const {
  normaliseDurationToDays,
  validateObservationNormalisation,
} = require('./observation-normalisers');
const {
  validateQxoNoShopClockParserBoundReviewSeedCarrierIdentity,
} = require('./qxo-no-shop-clock-parser-bridge');
const {
  validateQxoNoShopReviewedDefinitionGraphF6CarrierIdentity,
} = require('./qxo-no-shop-reviewed-definition-graph-f6');
const {
  buildExcerpt,
  buildSemanticSpan,
} = require('./source-structure');

const AUTHORITY_SCOPE =
  'OFFLINE_REVIEWED_QXO_NO_SHOP_NOTICE_SOURCE_BINDINGS_F6_ONLY';
const DEAL_KEY = 'deal:qxo-topbuild';
const DOCUMENT_HASH =
  'abba043018410d718c207e7d7a43c9567166f6a10c4c9a6b4b0c8c7761cd6b9d';
const CANONICAL_TEXT_ID =
  'bcc60682b1914dcd2dc81417399a74d3f2b82451b8b3119af0d6c8c7e7213ce1';
const CANONICAL_TEXT_BYTE_LENGTH = 414782;
const DEFINITION_GRAPH_ID =
  '5f10f1f883b623efa5e988630240cf7c7bdbf6308c261383ae86a992f3f856bc';
const DEFINITION_GRAPH_DIGEST =
  '8f60c00c44c6d34e0a0ddec9c94f170c4e0e62dc9aafdd90cc9742cd713a8b1b';
const CLOCK_SEED_ID =
  'bc6c5001d9e8549982edb648f8bc2dd16241716edf602cebdef3a39bd788c56f';
const CLOCK_SEED_DIGEST =
  '601595a59508796cac5ed955bd859d670775b3ba27ccf10a8264673288b43f41';
const NOTICE_PROVISION_ID =
  '8a04ee23c9906b70bdb6fc5b5f3b8202992a91ff079a87b8bb69c00b0ec62512';
const NOTICE_COMPONENT_ID =
  'acd417ab515117d918184de16c5be3030a80925c42abb13da6851a040695d632';
const FIRST_CLOCK_CLAIM_ID =
  '609e1153fd0e8fe5f75127bee4ef32480814226e7cb07b0b21448e9b11b28985';
const NOTICE_SCHEMA_ID =
  'b19d73d141900929ddeb45449249c69debde0eed5da99dd02bf4dfd1d70e9b1c';
const NOTICE_SCHEMA_DIGEST =
  '53569e2b53f8c43a906d259ac5fdba70c86bbf2ac2a6aa8c64c6ed7cf0f82b39';
const MAX_CARRIER_BYTES = 192 * 1024;

const INPUT_KEYS = Object.freeze([
  'contract_bundle',
  'immutable_source_document',
  'source_admission_manifest',
  'semantic_extraction_input_envelope',
  'conversion',
  'admitted_source_context',
  'qxo_no_shop_clock_f6_parser_bound_review_seed',
  'qxo_no_shop_reviewed_definition_graph_f6',
]);
const CARRIER_KEYS = Object.freeze([
  'schema_version',
  'authority_scope',
  'contract_binding',
  'source_binding',
  'upstream_bindings',
  'party_binding',
  'source_evidence',
  'field_source_bindings',
  'notice_timing_source_binding',
  'copy_timing_source_binding',
  'plural_definition_use_resolution',
  'definition_relationship_dependency',
  'retained_source_residuals',
  'notice_obligation_materialisation',
  'status',
  'qxo_no_shop_notice_source_binding_f6_id',
  'canonical_payload_digest',
]);

const TARGET_PARTY = Object.freeze({
  role: 'COVENANT_OBLIGOR',
  value: 'COMPANY',
  capacity: 'TARGET',
});
const BUYER_PARTY = Object.freeze({
  role: 'RIGHT_HOLDER',
  value: 'PARENT',
  capacity: 'ACQUIRER',
});

const SOURCE_SPANS = Object.freeze({
  FIRST_SENTENCE: Object.freeze([207783, 208859, '3f6d824c70d4194f63bdc3581987be1965c1bb242461ba7a8735341de4c362d5']),
  COMPANY_OBLIGOR: Object.freeze([207786, 207803, '90284c0caa805904490b5eb0b12a0cde6e89748ecc14e6855ccf7b8490d1255d']),
  NOTICE_PROMPTLY: Object.freeze([207804, 207812, 'abfaf122ceb07d0564a99a95189a6a5b5cd2177e96dfa32460219ea4b0bd67a8']),
  NOTICE_CLOCK: Object.freeze([207841, 207877, '7b7b0e7e304a0e50f6ff4d25bec13408ddb4f12b60bde0c3afc796ea49def28a']),
  NOTICE_TIMING: Object.freeze([207804, 207878, '74e70e2bc9247541e9975c5000e0f747ded05fb2bd2062454eecdee1a725744e']),
  PARENT_NOTICE_RECIPIENT: Object.freeze([207879, 207892, 'd4d8bca43bfe32004c1d4d5d1ad7af25844f96389b39ae5c5f5feed766ba0d13']),
  DELIVERY_METHODS: Object.freeze([207900, 207946, '03eafd2398f8d657fe3268cf645a774cabd24c7bd40e29408089bf18157fa725']),
  ORAL: Object.freeze([207925, 207931, '81252d200ec5d03b9ae163c4cd18be7749659aed393eb2ed8a0b9d208c1f01f8']),
  WRITTEN: Object.freeze([207936, 207946, '0e40c37704ac0d05e289c0ded409eaa927ece6eda138e3c521d60668f3aa4b9d']),
  IDENTIFY_SUBMITTER_BRANCH: Object.freeze([207951, 208373, 'aaf5a331d5818ae80300b24de393ad520a8cc5cc4fcdf742e045b53e1bd6a4cb']),
  CAP_MAKER: Object.freeze([207966, 208016, 'e4ad2337669d58e3bfd48f5faf659ee42dd441aef4e12c073428a4dfa96913a0']),
  COMPANY_REQUEST_BODY: Object.freeze([208020, 208349, '465bea4a608893c5366bba01d96603c88f3313ceda3a976d184bbf5ad3a072fb']),
  COMPANY_REQUEST_DECLARATION: Object.freeze([208354, 208369, 'e4c3836d0ab6403af2b0379b2344754363ea85fd4c89d5a26e52e70f98fef26b']),
  CONTENT_REQUIREMENTS: Object.freeze([208379, 208482, '5ca0d43a90bc9a04a3589279d5537b3aa6b347afdfa5044171d060188cc5cbb9']),
  REASONABLE_DETAIL: Object.freeze([208393, 208423, '9bf5ab9205c88d98012d11b1d996954ec90d680ec7d084f526cc72156dd81897']),
  MATERIAL_TERMS: Object.freeze([208424, 208450, '5c4cd3863ca1888db023a6ac1ae56c6278e7d5a1f7717a364992c407a49490f7']),
  MODIFICATIONS: Object.freeze([208458, 208482, '9801da111756beb186452d796cf23f9cd335052ab010d9e3c64dbe3af781ea0a']),
  ALTERNATIVE_TRIGGERS: Object.freeze([208484, 208556, '109ff5f673a20c541f8222987877fdc0bc3e92001f1fee34bd8ce05497be1137']),
  CAP_TRIGGER: Object.freeze([208505, 208533, 'd559b211a0d2289a556813531d2a7ea95719aa885bc8c380a74df616e0b0db37']),
  COMPANY_REQUEST_TRIGGER: Object.freeze([208541, 208556, 'e4c3836d0ab6403af2b0379b2344754363ea85fd4c89d5a26e52e70f98fef26b']),
  COPY_DUTY: Object.freeze([208562, 208858, '274021b9a7c651ec20865bb1e38feac187df697b3b4bbfa03940eedeff6a0c1d']),
  COPY_PROMPTLY: Object.freeze([208568, 208576, 'abfaf122ceb07d0564a99a95189a6a5b5cd2177e96dfa32460219ea4b0bd67a8']),
  COPY_CLOCK: Object.freeze([208605, 208641, '7b7b0e7e304a0e50f6ff4d25bec13408ddb4f12b60bde0c3afc796ea49def28a']),
  COPY_TIMING: Object.freeze([208568, 208642, '74e70e2bc9247541e9975c5000e0f747ded05fb2bd2062454eecdee1a725744e']),
  PROVIDE_COPIES_TO_PARENT: Object.freeze([208643, 208667, '7c9b91e5f07429f6b4fee673842936f7a782d91be269b15cde4dd8d528d7176c']),
  WRITTEN_COMPANY_REQUESTS: Object.freeze([208675, 208699, '977ef1daf9d41f45d79c4350564346f45a25837502922ad153652b7a058d674b']),
  COMPANY_REQUESTS_TERM: Object.freeze([208683, 208699, '659c6aa6f6f6c504cd65ff30e00789e623f5b9a6851ce289959c703e832d3aad']),
  PROPOSALS_INDICATIONS: Object.freeze([208701, 208787, '3cfafcf72fbbb71d888994dfa1ef3e675f610cd5eabca360dc56721fd6836e2a']),
  DRAFT_AGREEMENTS: Object.freeze([208796, 208858, 'a4908af7d517da198f5504e26b717b3033b8730c842f857a637844b295c5019c']),
  ALL_COPY_SUBJECTS: Object.freeze([208675, 208858, '8b3a3b1cd3665fc3e31452a3543c9f9bca5d25045634b972e692983264f8361d']),
});

const FIELD_SPECS = Object.freeze([
  Object.freeze({ field: 'TRIGGER_CODE', code: 'RECEIPT_OF_COMPANY_ACQUISITION_PROPOSAL', source_keys: ['ALTERNATIVE_TRIGGERS', 'CAP_TRIGGER'], definition_use: ['COMPANY_ACQUISITION_PROPOSAL', 208505, 208533] }),
  Object.freeze({ field: 'TRIGGER_CODE', code: 'RECEIPT_OF_COMPANY_REQUEST', source_keys: ['ALTERNATIVE_TRIGGERS', 'COMPANY_REQUEST_TRIGGER'], definition_use: ['COMPANY_REQUEST', 208541, 208556] }),
  Object.freeze({ field: 'DELIVERY_METHOD_CODE', code: 'ORAL', source_keys: ['DELIVERY_METHODS', 'ORAL'] }),
  Object.freeze({ field: 'DELIVERY_METHOD_CODE', code: 'WRITTEN', source_keys: ['DELIVERY_METHODS', 'WRITTEN'] }),
  Object.freeze({ field: 'CONTENT_REQUIREMENT_CODE', code: 'IDENTIFY_SUBMITTING_PERSON', source_keys: ['IDENTIFY_SUBMITTER_BRANCH', 'CAP_MAKER'] }),
  Object.freeze({ field: 'CONTENT_REQUIREMENT_CODE', code: 'MATERIAL_TERMS_IN_REASONABLE_DETAIL', source_keys: ['CONTENT_REQUIREMENTS', 'REASONABLE_DETAIL', 'MATERIAL_TERMS'] }),
  Object.freeze({ field: 'CONTENT_REQUIREMENT_CODE', code: 'MODIFICATIONS_IN_REASONABLE_DETAIL', source_keys: ['CONTENT_REQUIREMENTS', 'REASONABLE_DETAIL', 'MODIFICATIONS'] }),
  Object.freeze({ field: 'COPY_SUBJECT_CODE', code: 'WRITTEN_COMPANY_REQUESTS', source_keys: ['WRITTEN_COMPANY_REQUESTS'] }),
  Object.freeze({ field: 'COPY_SUBJECT_CODE', code: 'PROPOSALS_OR_INDICATIONS_OF_INTEREST', source_keys: ['PROPOSALS_INDICATIONS'], definition_use: ['COMPANY_ACQUISITION_PROPOSAL', 208759, 208787] }),
  Object.freeze({ field: 'COPY_SUBJECT_CODE', code: 'DRAFT_AGREEMENTS', source_keys: ['DRAFT_AGREEMENTS'], definition_use: ['COMPANY_ACQUISITION_PROPOSAL', 208830, 208858] }),
]);

class QxoNoShopNoticeSourceBindingF6Error extends Error {
  constructor(code, message) {
    super(message);
    this.name = 'QxoNoShopNoticeSourceBindingF6Error';
    this.code = code;
  }
}

function fail(code, message) {
  throw new QxoNoShopNoticeSourceBindingF6Error(code, message);
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

function exactEvidence(source, sourceKey, pin) {
  const [start, end, digest] = pin;
  const bytes = Buffer.from(source.canonical_text.text, 'utf8').subarray(start, end);
  if (bytes.length !== end - start || sha256Hex(bytes) !== digest) {
    fail('SOURCE_SPAN_DRIFT', `${sourceKey} exact source bytes have drifted`);
  }
  const semanticSpan = buildSemanticSpan(source, start, end);
  return freeze({
    source_key: sourceKey,
    governed_ordinal: start,
    semantic_span: semanticSpan,
    source_excerpt: buildExcerpt({ source, span: semanticSpan }),
  });
}

function definitionUse(graph, definitionKey, start, end) {
  const matches = graph.reviewed_use_bindings.filter((binding) => (
    binding.definition_key === definitionKey
    && binding.absolute_start === start
    && binding.absolute_end === end
  ));
  return matches.length === 1 ? matches[0] : null;
}

function validateContract(contractBundle) {
  validateContractBundle(contractBundle);
  if (contractBundle.fingerprint !== FIXTURE_CONTRACT_FINGERPRINT_V6) {
    fail('WRONG_CONTRACT', 'the exact frozen F6 contract is required');
  }
  const schema = contractBundle.no_shop_semantic_schema_definitions.find(
    (entry) => entry.semantic_schema_key === 'NO_SHOP_NOTICE_OBLIGATION',
  );
  if (!schema
    || schema.semantic_schema_definition_id !== NOTICE_SCHEMA_ID
    || schema.semantic_schema_definition_payload_digest !== NOTICE_SCHEMA_DIGEST
    || canonicalJson(schema.required_trigger_codes) !== canonicalJson([
      'RECEIPT_OF_COMPANY_ACQUISITION_PROPOSAL',
      'RECEIPT_OF_COMPANY_REQUEST',
    ])
    || canonicalJson(schema.required_delivery_method_codes)
      !== canonicalJson(['ORAL', 'WRITTEN'])
    || canonicalJson(schema.required_content_requirement_codes)
      !== canonicalJson([
        'IDENTIFY_SUBMITTING_PERSON',
        'MATERIAL_TERMS_IN_REASONABLE_DETAIL',
        'MODIFICATIONS_IN_REASONABLE_DETAIL',
      ])
    || canonicalJson(schema.required_copy_subject_codes)
      !== canonicalJson([
        'WRITTEN_COMPANY_REQUESTS',
        'PROPOSALS_OR_INDICATIONS_OF_INTEREST',
        'DRAFT_AGREEMENTS',
      ])) {
    fail('NOTICE_SCHEMA_DRIFT', 'the frozen F6 notice schema has drifted');
  }
  return schema;
}

function validateSource(input, clockSeed, graph) {
  const source = input.admitted_source_context;
  buildAdmittedSourceReference(source);
  validateAdmittedSemanticSourceContext({
    context: source,
    immutable_source_document: input.immutable_source_document,
    source_admission_manifest: input.source_admission_manifest,
    semantic_extraction_input_envelope:
      input.semantic_extraction_input_envelope,
    conversion: input.conversion,
    governed_deal_key: DEAL_KEY,
    deal_admission_id: source.deal_admission_id,
    source_ordinal: source.source_ordinal,
  });
  if (source.governed_deal_key !== DEAL_KEY
    || source.document_hash !== DOCUMENT_HASH
    || source.canonical_text_id !== CANONICAL_TEXT_ID
    || source.canonical_text_byte_length !== CANONICAL_TEXT_BYTE_LENGTH
    || Buffer.byteLength(source.canonical_text.text, 'utf8')
      !== CANONICAL_TEXT_BYTE_LENGTH) {
    fail('SOURCE_LINEAGE_DRIFT', 'the exact admitted QXO source is required');
  }
  for (const binding of [clockSeed.source_binding, graph.source_binding]) {
    if (binding.governed_deal_key !== DEAL_KEY
      || binding.deal_admission_id !== source.deal_admission_id
      || binding.document_hash !== DOCUMENT_HASH
      || binding.canonical_text_id !== CANONICAL_TEXT_ID
      || binding.admitted_semantic_source_context_id
        !== source.admitted_semantic_source_context_id) {
      fail('UPSTREAM_SOURCE_BINDING_DRIFT', 'the upstream F6 source bindings disagree');
    }
  }
}

function buildCarrier(input, forcedFailure = null) {
  if (!exactKeys(input, INPUT_KEYS)) {
    fail('INPUT_CONTRACT_MISMATCH', 'the F6 notice input is outside its contract');
  }
  const {
    contract_bundle: contractBundle,
    admitted_source_context: source,
    qxo_no_shop_clock_f6_parser_bound_review_seed: clockSeed,
    qxo_no_shop_reviewed_definition_graph_f6: graph,
  } = input;
  const noticeSchema = validateContract(contractBundle);
  validateQxoNoShopClockParserBoundReviewSeedCarrierIdentity(clockSeed);
  validateQxoNoShopReviewedDefinitionGraphF6CarrierIdentity(graph);
  if (clockSeed.contract_binding.contract_fingerprint !== contractBundle.fingerprint
    || graph.contract_binding.contract_fingerprint !== contractBundle.fingerprint
    || clockSeed.qxo_no_shop_clock_parser_bound_review_seed_id !== CLOCK_SEED_ID
    || clockSeed.canonical_payload_digest !== CLOCK_SEED_DIGEST
    || graph.qxo_no_shop_reviewed_definition_graph_f6_id !== DEFINITION_GRAPH_ID
    || graph.canonical_payload_digest !== DEFINITION_GRAPH_DIGEST) {
    fail('UPSTREAM_BINDING_DRIFT', 'the exact F6 clock and definition carriers are required');
  }
  validateSource(input, clockSeed, graph);

  const sourceEvidence = Object.entries(SOURCE_SPANS).map(
    ([key, pin]) => exactEvidence(source, key, pin),
  ).sort((left, right) => left.governed_ordinal - right.governed_ordinal
    || left.source_key.localeCompare(right.source_key));
  const evidenceByKey = new Map(
    sourceEvidence.map((entry) => [entry.source_key, entry]),
  );
  const fieldSourceBindings = FIELD_SPECS.map((spec) => {
    const use = spec.definition_use
      ? definitionUse(graph, ...spec.definition_use)
      : null;
    if (spec.definition_use && !use) {
      fail('DEFINITION_USE_MISSING', `${spec.code} lost its reviewed definition use`);
    }
    const body = {
      schema_version: 'QXO_NO_SHOP_NOTICE_FIELD_SOURCE_BINDING_F6/V1',
      field: spec.field,
      code: spec.code,
      evidence_excerpt_ids: spec.source_keys.map(
        (key) => evidenceByKey.get(key).source_excerpt.excerpt_id,
      ),
      reviewed_definition_use_binding_ids: use
        ? [use.qxo_no_shop_reviewed_definition_use_binding_f6_id]
        : [],
      source_binding_authority: 'EXACT_SOURCE_ONLY',
    };
    return freeze({
      ...body,
      qxo_no_shop_notice_field_source_binding_f6_id: contentId(
        'QXO_NO_SHOP_NOTICE_FIELD_SOURCE_BINDING_F6/V1',
        body,
      ),
    });
  });

  const noticeClockOutcome = clockSeed.clock_outcomes.find(
    (outcome) => outcome.clock_key === 'NOTICE',
  );
  if (!noticeClockOutcome || noticeClockOutcome.suppressed
    || !noticeClockOutcome.reference
    || noticeClockOutcome.reference.provision_instance_id !== NOTICE_PROVISION_ID
    || noticeClockOutcome.reference.provision_component_id !== NOTICE_COMPONENT_ID
    || noticeClockOutcome.reference.claim_revision_id !== FIRST_CLOCK_CLAIM_ID
    || noticeClockOutcome.reference.clock_span.absolute_start !== 207841
    || noticeClockOutcome.reference.clock_span.absolute_end !== 207877) {
    fail('NOTICE_CLOCK_REFERENCE_DRIFT', 'the exact first F6 notice clock is required');
  }
  const noticeTimingSourceBinding = freeze({
    schema_version: 'QXO_NO_SHOP_NOTICE_TIMING_SOURCE_BINDING_F6/V1',
    timing_role: 'INITIAL_NOTICE',
    qualifier_codes: ['PROMPTLY', 'NO_LATER_THAN_24_ELAPSED_HOURS'],
    evidence_excerpt_ids: [
      evidenceByKey.get('NOTICE_TIMING').source_excerpt.excerpt_id,
      evidenceByKey.get('NOTICE_CLOCK').source_excerpt.excerpt_id,
    ],
    existing_review_claim_revision_id:
      noticeClockOutcome.reference.claim_revision_id,
    raw_duration: noticeClockOutcome.reference.raw_duration,
    canonical_duration: noticeClockOutcome.reference.canonical_duration,
    temporal_operator: 'CEILING',
    trigger_scope_complete: false,
    metric_authority: 'NONE',
  });

  const copyNormalisation = normaliseDurationToDays({
    rawMagnitude: '24',
    rawUnit: 'HOURS',
    dayBasis: 'ELAPSED',
    trigger: 'SOURCE_REFERENT_UNGOVERNED',
    derivationVersion: 'QXO_NO_SHOP_NOTICE_COPY_CLOCK_F6/V1',
  });
  validateObservationNormalisation(copyNormalisation);
  const copyDutyExcerpt = evidenceByKey.get('COPY_DUTY').source_excerpt;
  const copyClockExcerpt = evidenceByKey.get('COPY_CLOCK').source_excerpt;
  const copyScopeIds = [
    copyDutyExcerpt.excerpt_id,
    copyClockExcerpt.excerpt_id,
  ].sort();
  const copyClockClaim = buildClaimRevision({
    subject_occurrence_id: NOTICE_COMPONENT_ID,
    claim_definition_key: noticeSchema.timing_claim_definition_key,
    ordinal: 1,
    state: 'PRESENT',
    raw_value: copyClockExcerpt.exact_text,
    canonical_value: copyNormalisation.canonical_value,
    unit: copyNormalisation.canonical_unit,
    day_basis: copyNormalisation.day_basis,
    attributes: {
      basis_key: copyNormalisation.basis_key,
      trigger: 'SOURCE_REFERENT_UNGOVERNED',
      raw_magnitude: copyNormalisation.raw_value.magnitude,
      raw_unit: copyNormalisation.raw_value.unit,
      normalisation_payload_digest:
        copyNormalisation.normalisation_payload_digest,
    },
    allowed_attributes: [
      'basis_key',
      'trigger',
      'raw_magnitude',
      'raw_unit',
      'normalisation_payload_digest',
    ],
    evidence: [
      {
        evidence_role: 'OPERATIVE_TEXT',
        excerpt_id: copyDutyExcerpt.excerpt_id,
        document_ordinal: source.source_ordinal,
        absolute_start: copyDutyExcerpt.absolute_start,
        absolute_end: copyDutyExcerpt.absolute_end,
      },
      {
        evidence_role: 'DERIVATION_INPUT',
        excerpt_id: copyClockExcerpt.excerpt_id,
        document_ordinal: source.source_ordinal,
        absolute_start: copyClockExcerpt.absolute_start,
        absolute_end: copyClockExcerpt.absolute_end,
      },
    ],
    scope: {
      scope_closure_id: contentId('CLAIM_SCOPE_CLOSURE/V1', {
        review_version: 'QXO_NO_SHOP_NOTICE_COPY_CLOCK_F6/V1',
        label: 'NO_SHOP_COPY_NOTICE_PERIOD_DAYS',
        interval_ids: copyScopeIds,
      }),
      coverage_status: 'COMPLETE',
      required_interval_ids: copyScopeIds,
      examined_interval_ids: copyScopeIds,
    },
    extraction_version: 'QXO_NO_SHOP_NOTICE_COPY_CLOCK_F6/V1',
    normalisation_version: 'QXO_NO_SHOP_NOTICE_COPY_CLOCK_F6/V1',
    derivation_version: 'QXO_NO_SHOP_NOTICE_COPY_CLOCK_F6/V1',
  });
  validateClaimRevisionIdentity(copyClockClaim);
  if (copyClockClaim.publication_state !== 'VALIDATED'
    || copyClockClaim.retained_residuals.length !== 0) {
    fail(
      'COPY_CLOCK_REVIEW_CLAIM_INVALID',
      `the second copy clock claim is invalid: ${JSON.stringify(copyClockClaim.retained_residuals)}`,
    );
  }
  const copyTimingSourceBinding = freeze({
    schema_version: 'QXO_NO_SHOP_COPY_TIMING_SOURCE_BINDING_F6/V1',
    timing_role: 'COPY_DUTY',
    qualifier_codes: ['PROMPTLY', 'NO_LATER_THAN_24_ELAPSED_HOURS'],
    evidence_excerpt_ids: [
      evidenceByKey.get('COPY_DUTY').source_excerpt.excerpt_id,
      evidenceByKey.get('COPY_TIMING').source_excerpt.excerpt_id,
      evidenceByKey.get('COPY_CLOCK').source_excerpt.excerpt_id,
    ],
    raw_duration: { magnitude: '24', unit: 'HOURS' },
    canonical_duration: {
      magnitude: copyNormalisation.canonical_value,
      unit: copyNormalisation.canonical_unit,
      day_basis: copyNormalisation.day_basis,
    },
    normalisation_payload_digest:
      copyNormalisation.normalisation_payload_digest,
    temporal_operator: 'CEILING',
    trigger_referent: 'SOURCE_REFERENT_UNGOVERNED',
    review_claim: copyClockClaim,
    claim_revision_id: copyClockClaim.claim_revision_id,
    metric_authority: 'NONE',
  });

  const predecessorResidual = graph.retained_use_residuals.find(
    (residual) => residual.definition_key === 'COMPANY_REQUEST'
      && residual.evidence_span.absolute_start === 208683
      && residual.evidence_span.absolute_end === 208699,
  );
  const declaration = definitionUse(
    graph,
    'COMPANY_REQUEST',
    208354,
    208369,
  );
  const pluralText = evidenceByKey.get('COMPANY_REQUESTS_TERM')
    .source_excerpt.exact_text;
  const declarationText = evidenceByKey.get('COMPANY_REQUEST_DECLARATION')
    .source_excerpt.exact_text;
  if (!predecessorResidual || !declaration
    || pluralText !== `${declarationText}s`) {
    fail('PLURAL_USE_REVIEW_RESOLUTION_DRIFT', 'the exact Company Requests use cannot be resolved');
  }
  const pluralResolutionBody = {
    schema_version: 'QXO_NO_SHOP_REVIEWED_PLURAL_DEFINITION_USE_F6/V1',
    governed_ordinal: 208683,
    definition_key: 'COMPANY_REQUEST',
    observed_text: pluralText,
    declared_term_text: declarationText,
    transformation_code: 'EXACT_DECLARED_TERM_PLUS_ASCII_LOWERCASE_S',
    transformation_scope: 'THIS_QXO_SOURCE_USE_ONLY',
    declaration_use_binding_id:
      declaration.qxo_no_shop_reviewed_definition_use_binding_f6_id,
    predecessor_residual_id:
      predecessorResidual.qxo_no_shop_definition_use_residual_f6_id,
    evidence_excerpt_id:
      evidenceByKey.get('COMPANY_REQUESTS_TERM').source_excerpt.excerpt_id,
    disposition: 'REVIEWED_SOURCE_SPECIFIC_USE_RESOLUTION',
    alias_authority: 'NONE',
    taxonomy_authority: 'NONE',
    corpus_wide_normalisation_authority: 'NONE',
    canonical_definition_use_relationship_id: null,
  };
  const pluralDefinitionUseResolution = freeze({
    ...pluralResolutionBody,
    qxo_no_shop_reviewed_plural_definition_use_f6_id: contentId(
      'QXO_NO_SHOP_REVIEWED_PLURAL_DEFINITION_USE_F6/V1',
      pluralResolutionBody,
    ),
  });

  const noticeUseCoordinates = [
    ['COMPANY_ACQUISITION_PROPOSAL', 207988, 208016],
    ['COMPANY_ACQUISITION_PROPOSAL', 208321, 208349],
    ['COMPANY_ACQUISITION_PROPOSAL', 208505, 208533],
    ['COMPANY_REQUEST', 208541, 208556],
    ['COMPANY_ACQUISITION_PROPOSAL', 208759, 208787],
    ['COMPANY_ACQUISITION_PROPOSAL', 208830, 208858],
  ];
  const reviewedUses = noticeUseCoordinates.map(
    (coordinates) => definitionUse(graph, ...coordinates),
  );
  const requestDependency = graph.definition_dependency_edges.find(
    (edge) => edge.container_definition_key === 'COMPANY_REQUEST'
      && edge.referenced_definition_key === 'COMPANY_ACQUISITION_PROPOSAL'
      && edge.governed_ordinal === 208321,
  );
  if (reviewedUses.some((use) => !use) || !requestDependency) {
    fail('NOTICE_DEFINITION_CLOSURE_DRIFT', 'the reviewed notice definition closure is incomplete');
  }
  const definitionRelationshipDependency = freeze({
    schema_version: 'QXO_NO_SHOP_NOTICE_DEFINITION_RELATIONSHIP_DEPENDENCY_F6/V1',
    reviewed_definition_use_binding_ids: reviewedUses.map(
      (use) => use.qxo_no_shop_reviewed_definition_use_binding_f6_id,
    ).sort(),
    reviewed_plural_definition_use_id:
      pluralDefinitionUseResolution.qxo_no_shop_reviewed_plural_definition_use_f6_id,
    reviewed_definition_dependency_edge_ids: [
      requestDependency.qxo_no_shop_definition_dependency_edge_f6_id,
    ],
    canonical_definition_use_relationship_ids: [],
    dependency_state: 'REVIEW_BINDINGS_ONLY_RELATIONSHIPS_UNMATERIALISED',
    relationship_authority: 'NONE',
  });

  const residualSpecs = [
    ['NOTICE_ALTERNATIVE_TRIGGER_OPERATOR_UNGOVERNED', 'ALTERNATIVE_TRIGGERS'],
    ['NOTICE_FIRST_CLOCK_TRIGGER_SCOPE_INCOMPLETE', 'NOTICE_TIMING'],
    ['NOTICE_COPY_CLOCK_TRIGGER_REFERENT_UNGOVERNED', 'COPY_TIMING'],
    ['NOTICE_DEFINITION_SCOPE_INCOMPLETE', 'FIRST_SENTENCE'],
  ];
  const retainedSourceResiduals = freeze(residualSpecs.map(([code, key]) => {
    const evidence = evidenceByKey.get(key);
    const body = {
      schema_version: 'QXO_NO_SHOP_NOTICE_SOURCE_RESIDUAL_F6/V1',
      residual_code: code,
      governed_ordinal: evidence.governed_ordinal,
      evidence_excerpt_id: evidence.source_excerpt.excerpt_id,
      state: 'PENDING_GOVERNED_DISPOSITION',
      publication_effect: 'BLOCK_DEPENDENT_NOTICE_MATERIALISATION',
      absence_authority: 'NONE',
      comparability_authority: 'NONE',
    };
    return freeze({
      ...body,
      qxo_no_shop_notice_source_residual_f6_id: contentId(
        'QXO_NO_SHOP_NOTICE_SOURCE_RESIDUAL_F6/V1',
        body,
      ),
    });
  }).sort((left, right) => left.governed_ordinal - right.governed_ordinal
    || left.residual_code.localeCompare(right.residual_code)));

  if (forcedFailure !== null && forcedFailure !== 'PLURAL_USE') {
    fail('UNKNOWN_FORCED_FAILURE', 'the notice failure attestation key is unknown');
  }
  const pluralSuppressed = forcedFailure === 'PLURAL_USE';
  const body = {
    schema_version: 'QXO_NO_SHOP_NOTICE_SOURCE_BINDING_F6/V1',
    authority_scope: AUTHORITY_SCOPE,
    contract_binding: {
      contract_key: contractBundle.contract_key,
      contract_fingerprint: contractBundle.fingerprint,
      notice_schema_definition_id:
        noticeSchema.semantic_schema_definition_id,
      notice_schema_definition_payload_digest:
        noticeSchema.semantic_schema_definition_payload_digest,
    },
    source_binding: {
      governed_deal_key: DEAL_KEY,
      deal_admission_id: source.deal_admission_id,
      immutable_source_document_id: source.immutable_source_document_id,
      source_admission_manifest_id: source.source_admission_manifest_id,
      semantic_extraction_input_envelope_id:
        source.semantic_extraction_input_envelope_id,
      admitted_semantic_source_context_id:
        source.admitted_semantic_source_context_id,
      document_hash: DOCUMENT_HASH,
      canonical_text_id: CANONICAL_TEXT_ID,
      source_ordinal: source.source_ordinal,
    },
    upstream_bindings: {
      qxo_no_shop_clock_f6_parser_bound_review_seed_id:
        clockSeed.qxo_no_shop_clock_parser_bound_review_seed_id,
      qxo_no_shop_clock_f6_parser_bound_review_seed_payload_digest:
        clockSeed.canonical_payload_digest,
      qxo_no_shop_reviewed_definition_graph_f6_id:
        graph.qxo_no_shop_reviewed_definition_graph_f6_id,
      qxo_no_shop_reviewed_definition_graph_f6_payload_digest:
        graph.canonical_payload_digest,
    },
    party_binding: {
      obligated_party: TARGET_PARTY,
      protected_party: BUYER_PARTY,
      party_classification_authority: 'EXISTING_REVIEWED_QXO_PARTY_TOKENS_ONLY',
    },
    source_evidence: sourceEvidence,
    field_source_bindings: fieldSourceBindings,
    notice_timing_source_binding: noticeTimingSourceBinding,
    copy_timing_source_binding: copyTimingSourceBinding,
    plural_definition_use_resolution: pluralSuppressed
      ? null
      : pluralDefinitionUseResolution,
    definition_relationship_dependency:
      pluralSuppressed ? null : definitionRelationshipDependency,
    retained_source_residuals: retainedSourceResiduals,
    notice_obligation_materialisation: {
      record_schema: noticeSchema.record_schema,
      source_provision_instance_id:
        noticeClockOutcome.reference.provision_instance_id,
      notice_obligation_occurrence_id: null,
      notice_obligation_revision_id: null,
      canonical_definition_use_relationship_ids: [],
      completeness: 'INCOMPLETE',
      materialisation_authority: 'NONE',
    },
    status: {
      review_source_mapping_complete: !pluralSuppressed,
      notice_schema_completeness: 'INCOMPLETE',
      alternative_trigger_operator_complete: false,
      first_clock_trigger_scope_complete: false,
      copy_clock_trigger_referent_complete: false,
      definition_relationship_materialisation_complete: false,
      review_renderable: true,
      publication_blocked: true,
      absence_authority: 'NONE',
      canonical_write_authority: 'NONE',
      notice_obligation_authority: 'NONE',
      result_authority: 'NONE',
      metric_authority: 'NONE',
      comparability_authority: 'NONE',
      query_authority: 'NONE',
      serving_authority: 'NONE',
      release_authority: 'NONE',
      release_eligible: false,
      failure_isolation: 'SUPPRESS_AFFECTED_NOTICE_DEPENDENCY_ONLY',
      blocker_codes: [
        ...pluralSuppressed ? ['NOTICE_PLURAL_USE_REVIEW_RESOLUTION_FAILED'] : [],
        'NOTICE_ALTERNATIVE_TRIGGER_OPERATOR_UNGOVERNED',
        'NOTICE_FIRST_CLOCK_TRIGGER_SCOPE_INCOMPLETE',
        'NOTICE_COPY_CLOCK_TRIGGER_REFERENT_UNGOVERNED',
        'NOTICE_DEFINITION_RELATIONSHIPS_UNMATERIALISED',
        'NOTICE_DEFINITION_SCOPE_INCOMPLETE',
        'NOTICE_OBLIGATION_MATERIALISATION_DEFERRED',
        'UPSTREAM_RETAINED_RESIDUALS',
      ].sort(),
    },
  };
  const carrier = freeze({
    ...body,
    qxo_no_shop_notice_source_binding_f6_id: contentId(
      'QXO_NO_SHOP_NOTICE_SOURCE_BINDING_F6/V1',
      body,
    ),
    canonical_payload_digest: contentId(
      'QXO_NO_SHOP_NOTICE_SOURCE_BINDING_F6_PAYLOAD/V1',
      body,
    ),
  });
  if (Buffer.byteLength(canonicalJson(carrier), 'utf8') > MAX_CARRIER_BYTES) {
    fail('CARRIER_LIMIT_EXCEEDED', 'the F6 notice carrier exceeds its byte limit');
  }
  validateCarrierIdentity(carrier);
  return carrier;
}

function validateCarrierIdentity(carrier) {
  if (!exactKeys(carrier, CARRIER_KEYS)
    || carrier.schema_version !== 'QXO_NO_SHOP_NOTICE_SOURCE_BINDING_F6/V1') {
    fail('CARRIER_CONTRACT_MISMATCH', 'the F6 notice carrier is invalid');
  }
  if (Buffer.byteLength(canonicalJson(carrier), 'utf8') > MAX_CARRIER_BYTES) {
    fail('CARRIER_LIMIT_EXCEEDED', 'the F6 notice carrier exceeds its byte limit');
  }
  const body = { ...carrier };
  delete body.qxo_no_shop_notice_source_binding_f6_id;
  delete body.canonical_payload_digest;
  if (carrier.qxo_no_shop_notice_source_binding_f6_id !== contentId(
    'QXO_NO_SHOP_NOTICE_SOURCE_BINDING_F6/V1',
    body,
  ) || carrier.canonical_payload_digest !== contentId(
    'QXO_NO_SHOP_NOTICE_SOURCE_BINDING_F6_PAYLOAD/V1',
    body,
  )) {
    fail('CARRIER_IDENTITY_MISMATCH', 'the F6 notice carrier identity has drifted');
  }
  return true;
}

function buildQxoNoShopNoticeSourceBindingF6(input = {}) {
  return buildCarrier(input, null);
}

function buildQxoNoShopNoticeSourceBindingF6FailureIsolationAttestation(
  input = {},
) {
  return buildCarrier(input, 'PLURAL_USE');
}

function validateQxoNoShopNoticeSourceBindingF6({
  qxo_no_shop_notice_source_binding_f6: carrier,
  ...input
} = {}) {
  validateCarrierIdentity(carrier);
  if (canonicalJson(carrier)
    !== canonicalJson(buildQxoNoShopNoticeSourceBindingF6(input))) {
    fail('CARRIER_IDENTITY_MISMATCH', 'the F6 notice carrier has drifted');
  }
  return true;
}

module.exports = {
  AUTHORITY_SCOPE,
  FIELD_SPECS,
  MAX_CARRIER_BYTES,
  QxoNoShopNoticeSourceBindingF6Error,
  SOURCE_SPANS,
  buildQxoNoShopNoticeSourceBindingF6,
  buildQxoNoShopNoticeSourceBindingF6FailureIsolationAttestation,
  validateQxoNoShopNoticeSourceBindingF6,
  validateQxoNoShopNoticeSourceBindingF6CarrierIdentity:
    validateCarrierIdentity,
};
