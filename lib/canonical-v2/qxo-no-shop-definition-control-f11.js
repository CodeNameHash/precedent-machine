const {
  canonicalJson,
  contentId,
  sha256Hex,
} = require('./canonical-bytes');
const {
  FIXTURE_CONTRACT_FINGERPRINT_V9,
  validateContractBundle,
} = require('./contract-bundle');
const {
  validateQxoNoShopDefinitionRelationshipsF8CarrierIdentity,
} = require('./qxo-no-shop-definition-relationships-f8');
const {
  validateQxoNoShopNoticeReceiptF10CarrierIdentity,
} = require('./qxo-no-shop-notice-receipt-f10');

const AUTHORITY_SCOPE =
  'OFFLINE_REVIEWED_QXO_NO_SHOP_DEFINITION_CONTROL_F11_ONLY';
const DOCUMENT_HASH =
  'abba043018410d718c207e7d7a43c9567166f6a10c4c9a6b4b0c8c7761cd6b9d';
const CANONICAL_TEXT_ID =
  'bcc60682b1914dcd2dc81417399a74d3f2b82451b8b3119af0d6c8c7e7213ce1';
const CANONICAL_TEXT_SHA256 =
  'a87a18e5eede1c30d319ebf1b541f44ab98e34d52c4604dfd0e4b47268a442f8';
const CANONICAL_TEXT_BYTE_LENGTH = 414782;
const ADMITTED_SOURCE_CONTEXT_ID =
  '1b20b897f7e3c33570e4b07fc68f2b2e3b641b187eb617de4847c3a1400ecad8';
const F8_RELATIONSHIPS_ID =
  'bdff2e031cd831d158614965ce1eceed30a6dafc9f9e302338318927b96f3027';
const F8_RELATIONSHIPS_DIGEST =
  '9de3339e9299c2daaf79de33996f1a04e3a6d0dcacd2bbf48fa7b2a5f67d5f2a';
const F10_NOTICE_ID =
  '91cad5c903659fb3a27e3f555e47e705449264233476f11cedef8277940d03af';
const F10_NOTICE_DIGEST =
  'a7b25e321961707391a6369049e03c7f128f54dc0635652ceaddbf60f8c91c89';
const MAX_CARRIER_BYTES = 256 * 1024;

const INPUT_KEYS = Object.freeze([
  'admitted_source_context',
  'contract_bundle',
  'qxo_no_shop_definition_relationships_f8',
  'qxo_no_shop_notice_receipt_f10',
]);
const CARRIER_KEYS = Object.freeze([
  'schema_version',
  'authority_scope',
  'contract_binding',
  'source_binding',
  'upstream_bindings',
  'scan_policy',
  'definition_control_scans',
  'relationship_outcomes',
  'notice_revision_materialisation',
  'status',
  'qxo_no_shop_definition_control_f11_id',
  'canonical_payload_digest',
]);

const SCAN_SPECS = Object.freeze([
  Object.freeze({
    definition_key: 'COMPANY_REQUEST',
    term_needle: 'Company Request',
    expected_term_occurrence_count: 8,
    declaration_needle:
      'Company Acquisition Proposal (“Company Request”)',
    agreement_wide_declaration_needles: Object.freeze([
      '“Company Request” means',
      '"Company Request" means',
      'Company Request shall mean',
    ]),
    index_needle: 'Company Request\n​\n‎4.3(c)',
    override_needle: null,
    selected_scope_code: 'INLINE_SECTION_4_3_C_DEFINITION',
    interpretation_note:
      'The inline Section 4.3(c) Company Request definition controls the exact notice uses. No competing declaration or override was found. The exact Company Requests plural is only a source-local inflection of that singular definition and creates no alias authority.',
  }),
  Object.freeze({
    definition_key: 'COMPANY_ACQUISITION_PROPOSAL',
    term_needle: 'Company Acquisition Proposal',
    expected_term_occurrence_count: 50,
    declaration_needle:
      'For purposes of this Agreement, “Company Acquisition Proposal” means',
    agreement_wide_declaration_needles: Object.freeze([
      '“Company Acquisition Proposal” means',
      '"Company Acquisition Proposal" means',
      'Company Acquisition Proposal shall mean',
    ]),
    index_needle:
      'Company Acquisition Proposal\n​\n‎4.3(e)',
    override_needle:
      'provided that solely for purposes of this clause, “50%” shall be substituted for “20%” in the definition of Company Acquisition Proposal',
    selected_scope_code: 'AGREEMENT_WIDE_SECTION_4_3_E_DEFINITION',
    interpretation_note:
      'The agreement-wide Section 4.3(e) Company Acquisition Proposal definition controls the Section 4.3(c) notice uses. The only observed adjustment substitutes 50% for 20% solely for the identified termination-fee clause, so it does not govern the notice.',
  }),
]);

const DEFINITION_EFFECT_SCHEMA_PAYLOAD_DIGEST =
  '90eeb8ca9899b1b7713627710867da447ce629d7c90807cc0eafaebed2d8e3de';

class QxoNoShopDefinitionControlF11Error extends Error {
  constructor(code, message) {
    super(message);
    this.name = 'QxoNoShopDefinitionControlF11Error';
    this.code = code;
  }
}

function fail(code, message) {
  throw new QxoNoShopDefinitionControlF11Error(code, message);
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

function semanticSpan(start, end) {
  const identity = {
    schema_version: 'SEMANTIC_SPAN/V1',
    canonical_text_id: CANONICAL_TEXT_ID,
    absolute_start: start,
    absolute_end: end,
  };
  return freeze({
    ...identity,
    semantic_span_id: contentId('SEMANTIC_SPAN/V1', identity),
  });
}

function exactSpan(text, start, end) {
  const bytes = Buffer.from(text, 'utf8');
  const span = semanticSpan(start, end);
  return freeze({
    ...span,
    exact_bytes_digest: sha256Hex(bytes.subarray(start, end)),
  });
}

function findOccurrences(text, needle) {
  const haystack = Buffer.from(text, 'utf8');
  const search = Buffer.from(needle, 'utf8');
  const offsets = [];
  let offset = 0;
  while (offset <= haystack.length - search.length) {
    const found = haystack.indexOf(search, offset);
    if (found < 0) break;
    offsets.push(found);
    offset = found + search.length;
  }
  return offsets;
}

function requireOccurrences(text, needle, expectedCount, code) {
  const offsets = findOccurrences(text, needle);
  if (offsets.length !== expectedCount) {
    fail(code, `${needle} must occur exactly ${expectedCount} time(s)`);
  }
  return offsets.map((start) => exactSpan(
    text,
    start,
    start + Buffer.byteLength(needle, 'utf8'),
  ));
}

function spanContains(outer, inner) {
  return outer.absolute_start <= inner.absolute_start
    && outer.absolute_end >= inner.absolute_end;
}

function validateSourceContext(context) {
  const text = context?.canonical_text?.text;
  if (context?.schema_version !== 'ADMITTED_SEMANTIC_SOURCE_CONTEXT/V1'
    || context.admitted_semantic_source_context_id
      !== ADMITTED_SOURCE_CONTEXT_ID
    || context.governed_deal_key !== 'deal:qxo-topbuild'
    || context.document_hash !== DOCUMENT_HASH
    || context.canonical_text_id !== CANONICAL_TEXT_ID
    || context.canonical_text_sha256 !== CANONICAL_TEXT_SHA256
    || context.canonical_text_byte_length !== CANONICAL_TEXT_BYTE_LENGTH
    || context.canonical_text?.canonical_text_id !== CANONICAL_TEXT_ID
    || typeof text !== 'string'
    || Buffer.byteLength(text, 'utf8') !== CANONICAL_TEXT_BYTE_LENGTH
    || sha256Hex(Buffer.from(text, 'utf8')) !== CANONICAL_TEXT_SHA256) {
    fail('SOURCE_CONTEXT_DRIFT', 'the exact admitted QXO canonical text is required');
  }
  return text;
}

function validateInputs(input) {
  if (!exactKeys(input, INPUT_KEYS)) {
    fail('INPUT_CONTRACT_MISMATCH', 'the F11 input is outside its closed contract');
  }
  const {
    contract_bundle: contractBundle,
    qxo_no_shop_definition_relationships_f8: relationships,
    qxo_no_shop_notice_receipt_f10: notice,
  } = input;
  validateContractBundle(contractBundle);
  validateQxoNoShopDefinitionRelationshipsF8CarrierIdentity(relationships);
  validateQxoNoShopNoticeReceiptF10CarrierIdentity(notice);
  const effectDigest = contentId(
    'USES_DEFINITION_EFFECT_SCHEMA_PAYLOAD/V2',
    contractBundle.definition_use_effect_schema_definition,
  );
  if (contractBundle.fingerprint !== FIXTURE_CONTRACT_FINGERPRINT_V9
    || contractBundle.definition_use_effect_schema_definition
      ?.schema_version !== 'USES_DEFINITION_EFFECT/V2'
    || effectDigest !== DEFINITION_EFFECT_SCHEMA_PAYLOAD_DIGEST) {
    fail('CONTRACT_BINDING_DRIFT', 'the exact frozen F9 definition contract is required');
  }
  if (relationships.qxo_no_shop_definition_relationships_f8_id
      !== F8_RELATIONSHIPS_ID
    || relationships.canonical_payload_digest !== F8_RELATIONSHIPS_DIGEST
    || notice.qxo_no_shop_notice_receipt_f10_id !== F10_NOTICE_ID
    || notice.canonical_payload_digest !== F10_NOTICE_DIGEST) {
    fail('UPSTREAM_BINDING_DRIFT', 'the exact F8 and F10 reviewed carriers are required');
  }
  if (relationships.relationship_outcomes.some((outcome) => outcome.suppressed)
    || relationships.status.definition_precedence_state
      !== 'BLOCKING_CONFLICT_OR_OVERRIDE_UNRESOLVED'
    || notice.status.publication_blocked !== true
    || notice.status.canonical_write_authority !== 'NONE') {
    fail('UPSTREAM_AUTHORITY_DRIFT', 'the required blocked review predecessors are required');
  }
  return validateSourceContext(input.admitted_source_context);
}

function selectedDefinitionOccurrence(relationships, definitionKey) {
  const matches = relationships.definition_occurrences.filter(
    (entry) => entry.definition_key === definitionKey,
  );
  if (matches.length !== 1) {
    fail('SELECTED_DEFINITION_DRIFT', `${definitionKey} selected definition is required`);
  }
  return matches[0].occurrence;
}

function buildScanPolicy() {
  const identity = {
    schema_version: 'DEFINITION_CONTROL_SCAN_POLICY/V1',
    coordinate_space: 'ADMITTED_SOURCE_UTF8_BYTES',
    scan_scope: 'COMPLETE_CANONICAL_TEXT',
    declaration_matching: 'EXACT_CASE_SENSITIVE_UTF8',
    override_matching: 'EXACT_CASE_SENSITIVE_UTF8',
    plural_rule:
      'EXACT_DECLARED_TERM_PLUS_ASCII_LOWERCASE_S_THIS_SOURCE_USE_ONLY',
    automatic_alias_authority: 'NONE',
    required_conclusions: [
      'SELECTED_DEFINITION_CONTROLS_EXACT_USE',
      'LOCAL_OVERRIDE_SCOPE_CLASSIFIED',
      'NO_COMPETING_DECLARATION',
    ],
  };
  return freeze({
    ...identity,
    scan_policy_digest: contentId(
      'DEFINITION_CONTROL_SCAN_POLICY/V1',
      identity,
    ),
  });
}

function buildDefinitionControlScan(
  text,
  relationships,
  scanPolicy,
  spec,
) {
  const fullDocumentSpan = exactSpan(text, 0, CANONICAL_TEXT_BYTE_LENGTH);
  const selected = selectedDefinitionOccurrence(
    relationships,
    spec.definition_key,
  );
  const termSpans = requireOccurrences(
    text,
    spec.term_needle,
    spec.expected_term_occurrence_count,
    'TERM_INVENTORY_DRIFT',
  );
  const declarationSpans = requireOccurrences(
    text,
    spec.declaration_needle,
    1,
    'DECLARATION_INVENTORY_DRIFT',
  );
  const agreementWideCandidateCounts =
    spec.agreement_wide_declaration_needles.map((needle) => ({
      needle_digest: sha256Hex(Buffer.from(needle, 'utf8')),
      occurrence_count: findOccurrences(text, needle).length,
    }));
  const expectedAgreementWideCounts =
    spec.definition_key === 'COMPANY_ACQUISITION_PROPOSAL'
      ? [1, 0, 0]
      : [0, 0, 0];
  if (canonicalJson(agreementWideCandidateCounts.map(
    (entry) => entry.occurrence_count,
  )) !== canonicalJson(expectedAgreementWideCounts)) {
    fail('COMPETING_DECLARATION_FOUND', `${spec.definition_key} declaration inventory drifted`);
  }
  const overrideSpans = spec.override_needle == null
    ? []
    : requireOccurrences(
      text,
      spec.override_needle,
      1,
      'LOCAL_OVERRIDE_INVENTORY_DRIFT',
    );
  const indexSpans = requireOccurrences(
    text,
    spec.index_needle,
    1,
    'DEFINITION_INDEX_INVENTORY_DRIFT',
  );
  const pluralDeclarationCounts = spec.definition_key === 'COMPANY_REQUEST'
    ? [
      '“Company Requests” means',
      '"Company Requests" means',
      'Company Requests shall mean',
    ].map((needle) => findOccurrences(text, needle).length)
    : [];
  if (pluralDeclarationCounts.some((count) => count !== 0)) {
    fail('SEPARATE_PLURAL_DEFINITION_FOUND', 'Company Requests has a competing declaration');
  }
  const classifiedTermOccurrences = termSpans.map((span) => {
    let classificationCode = 'OPERATIVE_REFERENCE';
    if (declarationSpans.some((candidate) => spanContains(candidate, span))) {
      classificationCode = 'SELECTED_DECLARATION';
    } else if (overrideSpans.some((candidate) => spanContains(candidate, span))) {
      classificationCode = 'LOCAL_SCOPE_OVERRIDE_REFERENCE';
    } else if (indexSpans.some((candidate) => spanContains(candidate, span))) {
      classificationCode = 'DEFINITION_INDEX_REFERENCE';
    }
    const followingByte = Buffer.from(text, 'utf8').subarray(
      span.absolute_end,
      span.absolute_end + 1,
    ).toString('utf8');
    return {
      semantic_span_id: span.semantic_span_id,
      absolute_start: span.absolute_start,
      absolute_end: span.absolute_end,
      exact_bytes_digest: span.exact_bytes_digest,
      classification_code: classificationCode,
      use_form_code:
        spec.definition_key === 'COMPANY_REQUEST' && followingByte === 's'
          ? 'DECLARED_TERM_PLUS_ASCII_LOWERCASE_S'
          : 'EXACT_DECLARED_TERM',
    };
  });
  const classificationCodes = [
    'SELECTED_DECLARATION',
    'LOCAL_SCOPE_OVERRIDE_REFERENCE',
    'DEFINITION_INDEX_REFERENCE',
    'OPERATIVE_REFERENCE',
  ];
  const occurrenceClassificationCounts = classificationCodes.map(
    (classificationCode) => ({
      classification_code: classificationCode,
      occurrence_count: classifiedTermOccurrences.filter(
        (occurrence) => (
          occurrence.classification_code === classificationCode
        ),
      ).length,
    }),
  );
  const expectedClassificationCounts =
    spec.definition_key === 'COMPANY_ACQUISITION_PROPOSAL'
      ? [1, 1, 1, 47]
      : [1, 0, 1, 6];
  if (canonicalJson(occurrenceClassificationCounts.map(
    (entry) => entry.occurrence_count,
  )) !== canonicalJson(expectedClassificationCounts)) {
    fail(
      'TERM_OCCURRENCE_CLASSIFICATION_DRIFT',
      `${spec.definition_key} complete occurrence classification drifted`,
    );
  }
  const pluralTermOccurrenceCount = classifiedTermOccurrences.filter(
    (occurrence) => (
      occurrence.use_form_code
        === 'DECLARED_TERM_PLUS_ASCII_LOWERCASE_S'
    ),
  ).length;
  if (spec.definition_key === 'COMPANY_REQUEST'
    ? pluralTermOccurrenceCount !== 2
    : pluralTermOccurrenceCount !== 0) {
    fail('PLURAL_TERM_INVENTORY_DRIFT', 'the exact plural occurrence inventory drifted');
  }
  const termOccurrenceInventoryDigest = contentId(
    'QXO_DEFINITION_TERM_OCCURRENCE_INVENTORY_F11/V1',
    classifiedTermOccurrences,
  );
  const scopeIdentity = {
    document_hash: DOCUMENT_HASH,
    selected_definition_occurrence_id: selected.definition_occurrence_id,
    full_document_span: fullDocumentSpan,
    scan_policy_digest: scanPolicy.scan_policy_digest,
    declaration_evidence_spans: declarationSpans,
    local_override_evidence_spans: overrideSpans,
    definition_index_evidence_spans: indexSpans,
    term_occurrence_inventory_digest: termOccurrenceInventoryDigest,
    occurrence_classification_counts: occurrenceClassificationCounts,
    declaration_candidate_counts: agreementWideCandidateCounts,
    conclusion_code: 'CONTROLLING_DEFINITION_CONFIRMED',
    selected_scope_code: spec.selected_scope_code,
  };
  return freeze({
    schema_version: 'QXO_DEFINITION_CONTROL_SCAN_F11/V1',
    definition_key: spec.definition_key,
    selected_definition_occurrence_id: selected.definition_occurrence_id,
    term_occurrence_count: termSpans.length,
    declaration_candidate_count: 1,
    competing_declaration_count: 0,
    local_override_count: overrideSpans.length,
    local_override_scope:
      overrideSpans.length === 0
        ? 'NONE'
        : 'SECTION_6_5_B_TERMINATION_FEE_CLAUSE_ONLY',
    separately_defined_plural_count:
      pluralDeclarationCounts.reduce((sum, count) => sum + count, 0),
    selected_scope_code: spec.selected_scope_code,
    full_document_span: fullDocumentSpan,
    declaration_evidence_spans: declarationSpans,
    local_override_evidence_spans: overrideSpans,
    definition_index_evidence_spans: indexSpans,
    term_occurrence_inventory_digest: termOccurrenceInventoryDigest,
    occurrence_classification_counts: occurrenceClassificationCounts,
    plural_term_occurrence_count: pluralTermOccurrenceCount,
    conclusion_code: 'CONTROLLING_DEFINITION_CONFIRMED',
    scope_closure_id: contentId(
      'DEFINITION_CONTROL_SCOPE_CLOSURE_F11/V1',
      scopeIdentity,
    ),
    interpretation_note: spec.interpretation_note,
  });
}

function buildClearInterpretation(predecessor, scan) {
  const prior = predecessor.relationship_interpretation;
  const note = scan.interpretation_note;
  const identity = {
    relationship_occurrence_id:
      predecessor.relationship_occurrence.relationship_occurrence_id,
    policy_version: 'CLAIM_INTERPRETATION_POLICY/V1',
    clarity_state: 'CLEAR',
    primary_interpretation: {
      code: 'APPLY_SELECTED_DEFINITION_TO_EXACT_USE',
      selected_definition_occurrence_id:
        predecessor.relationship_effect.selected_definition_occurrence_id,
      definition_control_scope_closure_id: scan.scope_closure_id,
    },
    alternative_interpretations: [],
    ambiguity_dimension_codes: [],
    evidence_by_role: predecessor.relationship_effect.evidence_by_role,
    lawyer_note_digest: sha256Hex(Buffer.from(note, 'utf8')),
    review_provenance: {
      source_review_scope: 'COMPLETE_ADMITTED_QXO_CANONICAL_TEXT',
      scan_policy_version: 'DEFINITION_CONTROL_SCAN_POLICY/V1',
      predecessor_interpretation_payload_id:
        prior.relationship_interpretation_payload_id,
      publication_authority: 'NONE',
    },
  };
  return freeze({
    schema_version: 'RELATIONSHIP_INTERPRETATION/V1',
    ...identity,
    relationship_interpretation_payload_id: contentId(
      'RELATIONSHIP_INTERPRETATION/V1',
      identity,
    ),
    lawyer_review_note: note,
  });
}

function buildControlledRelationship(
  predecessor,
  scan,
  recursiveDependencyRelationshipIds,
) {
  const priorEffect = predecessor.relationship_effect;
  const interpretation = buildClearInterpretation(predecessor, scan);
  const effectIdentity = {
    legal_operation: priorEffect.legal_operation,
    effect_schema_version: priorEffect.effect_schema_version,
    exact_use_occurrence_id: priorEffect.exact_use_occurrence_id,
    exact_use_span: priorEffect.exact_use_span,
    raw_use_form: priorEffect.raw_use_form,
    selected_definition_occurrence_id:
      priorEffect.selected_definition_occurrence_id,
    use_form_code: priorEffect.use_form_code,
    legal_role_code: priorEffect.legal_role_code,
    affected_endpoint: priorEffect.affected_endpoint,
    party_scope: priorEffect.party_scope,
    evidence_excerpt_ids: priorEffect.evidence_excerpt_ids,
    evidence_by_role: priorEffect.evidence_by_role,
    scope_closure_id: scan.scope_closure_id,
    relationship_interpretation_payload_id:
      interpretation.relationship_interpretation_payload_id,
    definition_precedence_review: 'CONTROLLING_DEFINITION_CONFIRMED',
    recursive_dependency_relationship_ids:
      recursiveDependencyRelationshipIds,
  };
  return freeze({
    schema_version: 'QXO_NO_SHOP_USES_DEFINITION_CONTROLLED_F11/V1',
    relationship_occurrence: predecessor.relationship_occurrence,
    predecessor_relationship_effect_revision_id:
      priorEffect.relationship_effect_revision_id,
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
      predecessor.source_predecessor_review_resolution_ids,
    evidence_references: predecessor.evidence_references,
    comparison_state: 'ALLOWED_IF_DEPENDENT_NOTICE_COMPLETE',
    publication_state: 'REVIEWED_CONTROL_CONFIRMED_NOT_WRITTEN',
  });
}

function validateCarrierIdentity(carrier) {
  if (!exactKeys(carrier, CARRIER_KEYS)
    || carrier.schema_version !== 'QXO_NO_SHOP_DEFINITION_CONTROL_F11/V1') {
    fail('CARRIER_CONTRACT_MISMATCH', 'the F11 carrier is invalid');
  }
  if (Buffer.byteLength(canonicalJson(carrier), 'utf8') > MAX_CARRIER_BYTES) {
    fail('CARRIER_LIMIT_EXCEEDED', 'the F11 carrier exceeds its byte limit');
  }
  const body = { ...carrier };
  delete body.qxo_no_shop_definition_control_f11_id;
  delete body.canonical_payload_digest;
  if (carrier.qxo_no_shop_definition_control_f11_id !== contentId(
    'QXO_NO_SHOP_DEFINITION_CONTROL_F11/V1',
    body,
  ) || carrier.canonical_payload_digest !== contentId(
    'QXO_NO_SHOP_DEFINITION_CONTROL_F11_PAYLOAD/V1',
    body,
  )) {
    fail('CARRIER_IDENTITY_MISMATCH', 'the F11 carrier identity has drifted');
  }
  return true;
}

function buildCarrier(input) {
  const text = validateInputs(input);
  const relationships = input.qxo_no_shop_definition_relationships_f8;
  const scanPolicy = buildScanPolicy();
  const scans = SCAN_SPECS.map((spec) => buildDefinitionControlScan(
    text,
    relationships,
    scanPolicy,
    spec,
  ));
  const scanByDefinitionKey = new Map(scans.map(
    (scan) => [scan.definition_key, scan],
  ));
  const successorByPredecessorId = new Map();
  const relationshipOutcomes = relationships.relationship_outcomes.map(
    (outcome) => {
      const selectedId = outcome.relationship.relationship_effect
        .selected_definition_occurrence_id;
      const definitionEntry = relationships.definition_occurrences.find(
        (entry) => entry.occurrence.definition_occurrence_id === selectedId,
      );
      const scan = scanByDefinitionKey.get(definitionEntry?.definition_key);
      if (!scan) {
        fail('RELATIONSHIP_SCAN_MISSING', 'every F8 relationship requires one control scan');
      }
      const predecessor = outcome.relationship.relationship_effect;
      const recursiveDependencyRelationshipIds =
        predecessor.recursive_dependency_relationship_ids.map((id) => {
          const successorId = successorByPredecessorId.get(id);
          if (!successorId) {
            fail(
              'RELATIONSHIP_DEPENDENCY_TOPOLOGY_INVALID',
              'a controlled relationship dependency must be materialised first',
            );
          }
          return successorId;
        });
      const controlled = buildControlledRelationship(
        outcome.relationship,
        scan,
        recursiveDependencyRelationshipIds,
      );
      successorByPredecessorId.set(
        predecessor.relationship_effect_revision_id,
        controlled.relationship_effect.relationship_effect_revision_id,
      );
      return controlled;
    },
  );
  const successorRelationshipIds = relationshipOutcomes.map(
    (entry) => entry.relationship_effect.relationship_effect_revision_id,
  ).sort();
  const body = {
    schema_version: 'QXO_NO_SHOP_DEFINITION_CONTROL_F11/V1',
    authority_scope: AUTHORITY_SCOPE,
    contract_binding: {
      contract_key: input.contract_bundle.contract_key,
      contract_fingerprint: input.contract_bundle.fingerprint,
      definition_effect_schema: 'USES_DEFINITION_EFFECT/V2',
      definition_effect_schema_payload_digest:
        DEFINITION_EFFECT_SCHEMA_PAYLOAD_DIGEST,
    },
    source_binding: input.qxo_no_shop_notice_receipt_f10.source_binding,
    upstream_bindings: {
      admitted_semantic_source_context_id: ADMITTED_SOURCE_CONTEXT_ID,
      qxo_no_shop_definition_relationships_f8_id: F8_RELATIONSHIPS_ID,
      qxo_no_shop_definition_relationships_f8_payload_digest:
        F8_RELATIONSHIPS_DIGEST,
      qxo_no_shop_notice_receipt_f10_id: F10_NOTICE_ID,
      qxo_no_shop_notice_receipt_f10_payload_digest:
        F10_NOTICE_DIGEST,
    },
    scan_policy: scanPolicy,
    definition_control_scans: scans,
    relationship_outcomes: relationshipOutcomes,
    notice_revision_materialisation: {
      notice_obligation_revision_id: null,
      predecessor_notice_obligation_revision_id:
        input.qxo_no_shop_notice_receipt_f10.notice_revision
          .notice_obligation_revision_id,
      successor_definition_use_relationship_ids:
        successorRelationshipIds,
      materialisation_authority: 'NONE',
      blocker_codes: [
        'COPY_CLOCK_ITEM_OR_BATCH_CARDINALITY_UNRESOLVED',
        'NOTICE_COMPLETE_DEFINITION_SCOPE_UNRESOLVED',
        'NOTICE_REVISION_MATERIALISATION_DEFERRED',
      ],
    },
    status: {
      review_renderable: true,
      full_document_scan_complete: true,
      definition_precedence_state: 'CONTROLLING_DEFINITION_CONFIRMED',
      examined_definition_count: scans.length,
      controlled_relationship_count: relationshipOutcomes.length,
      plural_resolution_scope: 'THIS_QXO_SOURCE_USE_ONLY',
      publication_blocked: true,
      comparison_blocked: true,
      absence_authority: 'NONE',
      canonical_write_authority: 'NONE',
      relationship_authority: 'REVIEW_IDENTITY_ONLY',
      result_authority: 'NONE',
      metric_authority: 'NONE',
      comparability_authority: 'NONE',
      query_authority: 'NONE',
      serving_authority: 'NONE',
      release_authority: 'NONE',
      release_eligible: false,
      blocker_codes: [
        'COPY_CLOCK_ITEM_OR_BATCH_CARDINALITY_UNRESOLVED',
        'NOTICE_COMPLETE_DEFINITION_SCOPE_UNRESOLVED',
        'NOTICE_REVISION_MATERIALISATION_DEFERRED',
      ],
    },
  };
  const carrier = freeze({
    ...body,
    qxo_no_shop_definition_control_f11_id: contentId(
      'QXO_NO_SHOP_DEFINITION_CONTROL_F11/V1',
      body,
    ),
    canonical_payload_digest: contentId(
      'QXO_NO_SHOP_DEFINITION_CONTROL_F11_PAYLOAD/V1',
      body,
    ),
  });
  validateCarrierIdentity(carrier);
  return carrier;
}

function validateQxoNoShopDefinitionControlF11({
  qxo_no_shop_definition_control_f11: carrier,
  ...input
} = {}) {
  validateCarrierIdentity(carrier);
  if (canonicalJson(carrier) !== canonicalJson(buildCarrier(input))) {
    fail('CARRIER_DRIFT', 'the QXO F11 definition control carrier has drifted');
  }
  return true;
}

module.exports = {
  AUTHORITY_SCOPE,
  MAX_CARRIER_BYTES,
  SCAN_SPECS,
  QxoNoShopDefinitionControlF11Error,
  buildQxoNoShopDefinitionControlF11: buildCarrier,
  validateQxoNoShopDefinitionControlF11,
  validateQxoNoShopDefinitionControlF11CarrierIdentity:
    validateCarrierIdentity,
};
