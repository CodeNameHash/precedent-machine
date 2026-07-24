// QXO/TopBuild company termination fee — ADMITTED two-source slice
// (SPEC-QXO-TERMF-F2-CANDIDATE-OPTION-A-2026-07-24.md, rulings R3–R5).
//
// This is the admitted counterpart of the reviewed fixture
// __fixtures__/canonical-v2/qxo-termination-fee-row.js. The legal encoding
// (concept keys, trigger codes, conditions, payment timings, parties) is
// copied from that Ben-reviewed fixture VERBATIM and is binding; what this
// module changes is only the evidentiary substrate: excerpts are quoted from
// the ADMITTED agreement canonical text (TopBuild Ex 2.1,
// bld-20260418xex2d1.htm — the same merger agreement byte-stream already
// admitted to staging as source f31cad8c…) and the admitted deal-value
// source (bld-20260418xex99d1.htm, 8f34cf68…), including that text's
// typographic apostrophes, U+200E marks and the mid-sentence page-break
// artifact inside §6.5(b) (precedent: the material Contracts excerpt).
//
// Unlike the material slice (INCOMPLETE review row), this slice produces a
// COMPLETE/COMPARABLE canonical result with a market observation for
// SELLER_TERMINATION_FEE_PERCENT_OF_DEAL_VALUE ($600,000,000 /
// $17,000,000,000 = 3.52941176 %), carrying six TRIGGERED_BY relationships.
// It requires the versioned F2 contract (compileFixtureContractV2) because
// its grounds use the four Ben-approved F2-only concept keys.

const { canonicalJson, contentId, sha256Hex } = require('./canonical-bytes');
const {
  buildAdmittedClaimEvidenceDetailPackage,
} = require('./admitted-composition-exact-detail');
const { buildAdmittedSourceReference } = require('./admitted-semantic-source');
const { buildClaimRevision, buildRelationshipRevision } = require('./claims-relationships');
const { validateContractBundle } = require('./contract-bundle');
const { compileMarketCohortRequest } = require('./market-cohort-query');
const { normaliseMoneyRelativeToDealValue } = require('./observation-normalisers');
const {
  AGREEMENT_CANONICAL_TEXT_ID,
  AGREEMENT_CANONICAL_TEXT_BYTE_LENGTH,
  DEAL_ADMISSION_ID,
  DEAL_KEY,
  DEAL_VALUE_CANONICAL_TEXT_ID,
  DEAL_VALUE_CANONICAL_TEXT_BYTE_LENGTH,
  DEAL_VALUE_INTERVAL,
} = require('./qxo-material-contracts-slice');
const {
  QXO_MATERIAL_SEMANTIC_CLOSURE_ID,
} = require('./qxo-material-candidate-identity');
const { buildFixtureResultComponent, projectMarketMetricSlot } = require('./serving-projection');
const { buildCanonicalResultServingRow } = require('./shared-serving-row');
const {
  buildExcerpt,
  buildProvisionComponent,
  buildProvisionInstance,
  buildSemanticSpan,
} = require('./source-structure');

const REVIEW_VERSION = 'QXO_ADMITTED_SELLER_TERMINATION_FEE/V1';
const METRIC_KEY = 'SELLER_TERMINATION_FEE_PERCENT_OF_DEAL_VALUE';
const RESULT_KEY = 'SELLER_TERMINATION_FEE';
const AGREEMENT_DOCUMENT_HASH = 'abba043018410d718c207e7d7a43c9567166f6a10c4c9a6b4b0c8c7761cd6b9d';
const DEAL_VALUE_DOCUMENT_HASH = '343ba5da8ab34f478f274307046836af4ded762b010e08ed8d9015be2e09c827';

// Byte intervals into the admitted agreement canonical text (canonical_text_id
// bcc60682…), each hash-pinned. Verified offline against the hash-verified
// SEC bytes on 2026-07-24 — see the spec's span table for anchoring notes.
const SPAN_PINS = Object.freeze({
  fee_payment: Object.freeze({
    interval: Object.freeze({ start: 374493, end: 375864 }),
    sha256: 'b4d051ee911d6b612661d27124f1fa4db8dc5d0ad929dc4715317c3f620121a9',
  }),
  fee_amount: Object.freeze({
    interval: Object.freeze({ start: 375239, end: 375251 }),
    sha256: 'de628357f305cf4f1578eff464bb9b42b32e83127aabeec736ea9521877e0184',
  }),
  vote_failure: Object.freeze({
    interval: Object.freeze({ start: 365777, end: 365985 }),
    sha256: '34f5aa8a0f922eb57dcd4da6ae10f3b235b185929b04dcef477c7d54350bb041',
  }),
  rec_change: Object.freeze({
    interval: Object.freeze({ start: 368471, end: 368544 }),
    sha256: 'c96a2f4da7830e36faa4c90e9022d0477f46c5532a4667c45565e3aa479dc147',
  }),
  nosolicit_immediate: Object.freeze({
    interval: Object.freeze({ start: 368644, end: 369057 }),
    sha256: 'bcf6faba4557b689146f9e4beeab705de102e46bf76576ee93350581aab1e2bd',
  }),
  nosolicit_tail: Object.freeze({
    interval: Object.freeze({ start: 372668, end: 372884 }),
    sha256: '2e443d449d12a8cf8afbc7051de47addb2657714e5de673654e70c55893efab1',
  }),
  covenant_breach: Object.freeze({
    interval: Object.freeze({ start: 372892, end: 372953 }),
    sha256: '9d316e4b9a9b88a2823f3abd08666d997a736c13c66466b660099fe8cd0e33b4',
  }),
  intervening_tail: Object.freeze({
    interval: Object.freeze({ start: 372957, end: 373104 }),
    sha256: '8b4b1d5e1b8dc5572e9552e04d35e5b04e9222c0fa915fb62b7d4d0f6ca1fcaa',
  }),
});
const DEAL_VALUE_SHA256 = 'baa64b186700a9360b1d2820eb87f72fc37a12c0165f9a18d0d2ea4b09185eff';

const FEE_PARTY = Object.freeze({ role: 'FEE_PAYER', value: 'COMPANY', capacity: 'TARGET' });
const IMMEDIATE_PARTY = Object.freeze({ role: 'TERMINATION_RIGHT_HOLDER', value: 'PARENT', capacity: 'BUYER' });
const TAIL_PARTY = Object.freeze({ role: 'FEE_TRIGGER_BENEFICIARY', value: 'PARENT', capacity: 'BUYER' });
const TAIL_CONDITIONS = Object.freeze([
  'COMPETING_PROPOSAL_PUBLICLY_PENDING',
  'DEFINITIVE_AGREEMENT_OR_CONSUMMATION_WITHIN_TWELVE_MONTHS',
  'FIFTY_PERCENT_ACQUISITION_THRESHOLD',
]);
const TAIL_TIMING = 'UPON_EARLIER_OF_SIGNING_OR_CONSUMMATION';
const REQUIRED_CONCEPTS = Object.freeze([
  'TERMF-TARGET', 'TERMR-RECOMMEND', 'TERMR-NOSOL-BREACH', 'TERMR-NOVOTE', 'TERMR-BREACH',
]);

// Ruling R5: rich reviewed dimensions on the fee row so the Canonical Query
// UI's refinements are real on the metric they were built for.
const DEAL_DIMENSIONS = Object.freeze({
  sector: 'Building products',
  buyer: 'QXO',
  merger_form: 'Reverse triangular merger',
  adviser_firms: Object.freeze(['Paul Weiss', 'Jones Day']),
  lawyers: Object.freeze(['Scott Barshay', 'Robert Profusek']),
  announce_year: 2026,
  deal_value_usd: '17000000000',
});

// Ground → relationship encoding, copied verbatim from the reviewed fixture
// (ordinals are the fixture's relationship ordinals 0–5).
const GROUNDS = Object.freeze([
  Object.freeze({
    key: 'rec_change',
    conceptKey: 'TERMR-RECOMMEND',
    party: IMMEDIATE_PARTY,
    provisionOrdinal: 1,
    componentOrdinal: 1,
    relationshipOrdinal: 0,
    effect: Object.freeze({
      effect_mode: 'TYPED_LEGAL_EFFECT',
      legal_operation: 'CREATES_SELLER_TERMINATION_FEE_PAYMENT_TRIGGER',
      trigger_code: 'CHANGE_IN_RECOMMENDATION_TERMINATION',
      terminating_party: 'PARENT',
      payment_timing: 'TWO_BUSINESS_DAYS_AFTER_TERMINATION',
      conditions: Object.freeze([]),
    }),
  }),
  Object.freeze({
    key: 'nosolicit_immediate',
    conceptKey: 'TERMR-NOSOL-BREACH',
    party: IMMEDIATE_PARTY,
    provisionOrdinal: 2,
    componentOrdinal: 2,
    relationshipOrdinal: 1,
    effect: Object.freeze({
      effect_mode: 'TYPED_LEGAL_EFFECT',
      legal_operation: 'CREATES_SELLER_TERMINATION_FEE_PAYMENT_TRIGGER',
      trigger_code: 'NO_SOLICIT_BREACH_TERMINATION',
      terminating_party: 'PARENT',
      payment_timing: 'TWO_BUSINESS_DAYS_AFTER_TERMINATION',
      conditions: Object.freeze([]),
    }),
  }),
  Object.freeze({
    key: 'vote_failure',
    conceptKey: 'TERMR-NOVOTE',
    party: TAIL_PARTY,
    provisionOrdinal: 1,
    componentOrdinal: 3,
    relationshipOrdinal: 2,
    effect: Object.freeze({
      effect_mode: 'TYPED_LEGAL_EFFECT',
      legal_operation: 'CREATES_SELLER_TERMINATION_FEE_PAYMENT_TRIGGER',
      trigger_code: 'STOCKHOLDER_APPROVAL_FAILURE_TERMINATION',
      terminating_party: 'EITHER_OR_PARENT_AS_SPECIFIED',
      payment_timing: TAIL_TIMING,
      conditions: Object.freeze([...TAIL_CONDITIONS, 'STOCKHOLDER_APPROVAL_NOT_YET_OBTAINED']),
    }),
  }),
  Object.freeze({
    key: 'nosolicit_tail',
    conceptKey: 'TERMR-NOSOL-BREACH',
    party: TAIL_PARTY,
    provisionOrdinal: 2,
    componentOrdinal: 4,
    relationshipOrdinal: 3,
    effect: Object.freeze({
      effect_mode: 'TYPED_LEGAL_EFFECT',
      legal_operation: 'CREATES_SELLER_TERMINATION_FEE_PAYMENT_TRIGGER',
      trigger_code: 'NO_SOLICIT_BREACH_TERMINATION',
      terminating_party: 'PARENT',
      payment_timing: TAIL_TIMING,
      conditions: TAIL_CONDITIONS,
    }),
  }),
  Object.freeze({
    key: 'covenant_breach',
    conceptKey: 'TERMR-BREACH',
    party: TAIL_PARTY,
    provisionOrdinal: 3,
    componentOrdinal: 5,
    relationshipOrdinal: 4,
    effect: Object.freeze({
      effect_mode: 'TYPED_LEGAL_EFFECT',
      legal_operation: 'CREATES_SELLER_TERMINATION_FEE_PAYMENT_TRIGGER',
      trigger_code: 'COUNTERPARTY_COVENANT_BREACH_TERMINATION',
      terminating_party: 'PARENT',
      payment_timing: TAIL_TIMING,
      conditions: TAIL_CONDITIONS,
    }),
  }),
  Object.freeze({
    key: 'intervening_tail',
    conceptKey: 'TERMR-RECOMMEND',
    party: TAIL_PARTY,
    provisionOrdinal: 4,
    componentOrdinal: 6,
    relationshipOrdinal: 5,
    effect: Object.freeze({
      effect_mode: 'TYPED_LEGAL_EFFECT',
      legal_operation: 'CREATES_SELLER_TERMINATION_FEE_PAYMENT_TRIGGER',
      trigger_code: 'INTERVENING_EVENT_RECOMMENDATION_CHANGE_TERMINATION',
      terminating_party: 'PARENT',
      payment_timing: TAIL_TIMING,
      conditions: TAIL_CONDITIONS,
    }),
  }),
]);

function freeze(value) {
  if (!value || typeof value !== 'object' || Object.isFrozen(value)) return value;
  Object.values(value).forEach(freeze);
  return Object.freeze(value);
}

function requireDigest(value, label) {
  if (!/^[a-f0-9]{64}$/.test(value || '')) throw new TypeError(`${label} must be a SHA-256 digest`);
}

function validateSourceContext(source, { label, sourceOrdinal, documentHash, canonicalTextId, canonicalTextByteLength }) {
  if (!source || source.schema_version !== 'ADMITTED_SEMANTIC_SOURCE_CONTEXT/V1'
    || source.governed_deal_key !== DEAL_KEY
    || source.deal_admission_id !== DEAL_ADMISSION_ID
    || source.source_ordinal !== sourceOrdinal
    || source.source_kind !== 'ORIGINAL_BYTES'
    || source.document_hash !== documentHash
    || source.canonical_text_id !== canonicalTextId
    || typeof source.canonical_text?.text !== 'string'
    || source.canonical_text.canonical_text_id !== source.canonical_text_id) {
    throw new TypeError(`an admitted QXO ${label} semantic source context is required`);
  }
  for (const key of [
    'immutable_source_document_id', 'source_admission_manifest_id',
    'semantic_extraction_input_envelope_id', 'source_content_id', 'source_occurrence_id',
    'canonical_text_sha256',
  ]) requireDigest(source[key], `${label} source.${key}`);
  const bytes = Buffer.from(source.canonical_text.text, 'utf8');
  if (bytes.length !== canonicalTextByteLength
    || bytes.length !== source.canonical_text_byte_length
    || sha256Hex(bytes) !== source.canonical_text_sha256) {
    throw new TypeError(`admitted QXO ${label} canonical text geometry has drifted`);
  }
}

function exactBytes(source, interval) {
  return Buffer.from(source.canonical_text.text, 'utf8').subarray(interval.start, interval.end);
}

function claimEvidence(excerpt, evidenceRole, documentOrdinal) {
  return {
    evidence_role: evidenceRole,
    excerpt_id: excerpt.excerpt_id,
    document_ordinal: documentOrdinal,
    absolute_start: excerpt.absolute_start,
    absolute_end: excerpt.absolute_end,
  };
}

function relationshipScope(label, sourceExcerpts, targetExcerpt) {
  const required = [...sourceExcerpts, targetExcerpt].map((excerpt) => excerpt.excerpt_id).sort();
  return {
    scope_closure_id: contentId('RELATIONSHIP_SCOPE_CLOSURE/V1', {
      review_version: REVIEW_VERSION,
      label,
      required_interval_ids: required,
    }),
    coverage_status: 'COMPLETE',
    required_interval_ids: required,
    examined_interval_ids: required,
    target_interval_ids: [targetExcerpt.excerpt_id],
  };
}

function buildCohort({ contractBundle, servingNamespaceId, corpusReleaseId, deal, observation }) {
  const request = {
    serving_namespace_id: servingNamespaceId,
    corpus_release_id: corpusReleaseId,
    contract_fingerprint: contractBundle.fingerprint,
    metric_key: METRIC_KEY,
    metric_version: 1,
    concept_key: 'TERMF-TARGET',
    party: FEE_PARTY,
    subject_deal_key: deal.deal_key,
    filters: {},
  };
  const compiled = compileMarketCohortRequest(request);
  return {
    request,
    result: {
      schema_version: 'MARKET_COHORT_RESULT/V1',
      serving_namespace_id: compiled.serving_namespace_id,
      corpus_release_id: compiled.corpus_release_id,
      contract_fingerprint: compiled.contract_fingerprint,
      cohort_digest: compiled.cohort_digest,
      metric_key: compiled.metric_key,
      metric_version: compiled.metric_version,
      concept_key: compiled.concept_key,
      subject_deal_key: compiled.subject_deal_key,
      counts: {
        eligible_deals: 1,
        applicable_deals: 1,
        examined_deals: 1,
        present_deals: 1,
        comparable_deals: 1,
        distribution_deals: 1,
        excluded_deals: 0,
        observation_slots: 1,
        excluded_slots: 0,
      },
      distribution: [{
        canonical_value: observation.canonical_value,
        subject_count: 1,
        deal_count: 1,
      }],
      exclusions: [],
    },
  };
}

function buildQxoTerminationFeeAdmittedSlice({
  agreementSourceContext,
  agreementSourceAdmission,
  dealValueSourceContext,
  dealValueSourceAdmission,
  contractBundle,
  corpusReleaseId,
  servingNamespaceId,
} = {}) {
  validateContractBundle(contractBundle);
  requireDigest(corpusReleaseId, 'corpusReleaseId');
  requireDigest(servingNamespaceId, 'servingNamespaceId');
  if (agreementSourceAdmission?.source_admission_manifest_id
      !== agreementSourceContext?.source_admission_manifest_id
    || dealValueSourceAdmission?.source_admission_manifest_id
      !== dealValueSourceContext?.source_admission_manifest_id) {
    throw new TypeError('admitted QXO termination-fee source admissions do not match their contexts');
  }
  const conceptKeys = new Set(contractBundle.concepts.map((item) => item.concept_key));
  for (const key of REQUIRED_CONCEPTS) {
    if (!conceptKeys.has(key)) {
      throw new TypeError(`the versioned (F2) contract concept ${key} is required for this slice`);
    }
  }
  validateSourceContext(agreementSourceContext, {
    label: 'agreement',
    sourceOrdinal: 0,
    documentHash: AGREEMENT_DOCUMENT_HASH,
    canonicalTextId: AGREEMENT_CANONICAL_TEXT_ID,
    canonicalTextByteLength: AGREEMENT_CANONICAL_TEXT_BYTE_LENGTH,
  });
  validateSourceContext(dealValueSourceContext, {
    label: 'deal-value',
    sourceOrdinal: 1,
    documentHash: DEAL_VALUE_DOCUMENT_HASH,
    canonicalTextId: DEAL_VALUE_CANONICAL_TEXT_ID,
    canonicalTextByteLength: DEAL_VALUE_CANONICAL_TEXT_BYTE_LENGTH,
  });
  for (const [key, pin] of Object.entries(SPAN_PINS)) {
    if (sha256Hex(exactBytes(agreementSourceContext, pin.interval)) !== pin.sha256) {
      throw new TypeError(`reviewed QXO termination ${key} span has drifted`);
    }
  }
  if (SPAN_PINS.fee_amount.interval.start < SPAN_PINS.fee_payment.interval.start
    || SPAN_PINS.fee_amount.interval.end > SPAN_PINS.fee_payment.interval.end) {
    throw new TypeError('the fee amount span must sit inside the fee payment span');
  }
  if (sha256Hex(exactBytes(dealValueSourceContext, DEAL_VALUE_INTERVAL)) !== DEAL_VALUE_SHA256) {
    throw new TypeError('reviewed QXO deal-value denominator has drifted');
  }

  const spans = freeze({
    ...Object.fromEntries(Object.entries(SPAN_PINS).map(([key, pin]) => [
      key,
      buildSemanticSpan(agreementSourceContext, pin.interval.start, pin.interval.end),
    ])),
    deal_value: buildSemanticSpan(dealValueSourceContext, DEAL_VALUE_INTERVAL.start, DEAL_VALUE_INTERVAL.end),
  });
  const excerpts = freeze(Object.fromEntries(Object.entries(spans).map(([key, span]) => [
    key,
    buildExcerpt({
      source: key === 'deal_value' ? dealValueSourceContext : agreementSourceContext,
      span,
    }),
  ])));

  const feeProvision = buildProvisionInstance({
    source: agreementSourceContext,
    span: spans.fee_payment,
    conceptKey: 'TERMF-TARGET',
    party: FEE_PARTY,
    ordinal: 1,
  });
  const feeComponent = buildProvisionComponent({
    source: agreementSourceContext,
    parentProvision: feeProvision,
    span: spans.fee_payment,
    componentKey: 'FEE_AMOUNT_LIMB',
    ordinal: 1,
  });
  const groundProvisions = GROUNDS.map((ground) => buildProvisionInstance({
    source: agreementSourceContext,
    span: spans[ground.key],
    conceptKey: ground.conceptKey,
    party: ground.party,
    ordinal: ground.provisionOrdinal,
  }));
  const groundComponents = GROUNDS.map((ground, index) => buildProvisionComponent({
    source: agreementSourceContext,
    parentProvision: groundProvisions[index],
    span: spans[ground.key],
    componentKey: 'TERMINATION_TRIGGER_LIMB',
    ordinal: ground.componentOrdinal,
  }));

  const normalised = normaliseMoneyRelativeToDealValue({
    rawAmount: '600000000',
    currency: 'USD',
    denominator: {
      value: '17000000000',
      currency: 'USD',
      basis: 'HEADLINE_TRANSACTION_VALUE',
      source_lineage_ids: [excerpts.deal_value.excerpt_id],
    },
    derivationVersion: REVIEW_VERSION,
  });
  const claimScopeIds = [excerpts.fee_amount.excerpt_id, excerpts.deal_value.excerpt_id].sort();
  const claim = buildClaimRevision({
    subject_occurrence_id: feeComponent.provision_component_id,
    claim_definition_key: METRIC_KEY,
    state: 'PRESENT',
    raw_value: excerpts.fee_amount.exact_text,
    canonical_value: normalised.canonical_value,
    unit: normalised.canonical_unit,
    denominator: normalised.denominator,
    attributes: {
      basis_key: normalised.basis_key,
      raw_amount: normalised.raw_value.amount,
      raw_currency: normalised.raw_value.currency,
      fee_side: 'SELLER',
      payee_value: 'PARENT',
      payee_capacity: 'BUYER',
      normalisation_payload_digest: normalised.normalisation_payload_digest,
    },
    allowed_attributes: [
      'basis_key', 'raw_amount', 'raw_currency',
      'fee_side', 'payee_value', 'payee_capacity',
      'normalisation_payload_digest',
    ],
    evidence: [
      claimEvidence(excerpts.fee_amount, 'OPERATIVE_TEXT', agreementSourceContext.source_ordinal),
      claimEvidence(excerpts.deal_value, 'DERIVATION_INPUT', dealValueSourceContext.source_ordinal),
    ],
    scope: {
      scope_closure_id: contentId('CLAIM_SCOPE_CLOSURE/V1', {
        review_version: REVIEW_VERSION,
        interval_ids: claimScopeIds,
      }),
      coverage_status: 'COMPLETE',
      required_interval_ids: claimScopeIds,
      examined_interval_ids: claimScopeIds,
    },
    extraction_version: REVIEW_VERSION,
    normalisation_version: REVIEW_VERSION,
    derivation_version: REVIEW_VERSION,
  });

  const relationships = freeze(GROUNDS.map((ground, index) => buildRelationshipRevision({
    source_occurrence_id: feeComponent.provision_component_id,
    relationship_definition_key: 'TRIGGERED_BY',
    ordinal: ground.relationshipOrdinal,
    state: 'PRESENT',
    raw_scope: excerpts[ground.key].exact_text,
    target_occurrence_ids: [groundComponents[index].provision_component_id],
    effect: ground.effect,
    evidence: [
      claimEvidence(excerpts.fee_payment, 'DERIVATION_INPUT', agreementSourceContext.source_ordinal),
      claimEvidence(excerpts[ground.key], 'CROSS_REFERENCE', agreementSourceContext.source_ordinal),
    ],
    scope: relationshipScope(ground.effect.trigger_code + ':' + ground.relationshipOrdinal, [excerpts.fee_payment], excerpts[ground.key]),
    resolver_version: REVIEW_VERSION,
  })));

  const compositionScopeClosureId = contentId('COMPOSITION_SCOPE_CLOSURE/V1', {
    claim_revision_id: claim.claim_revision_id,
    relationship_revision_ids: relationships.map((item) => item.relationship_revision_id),
  });
  const result = buildFixtureResultComponent({
    deal_admission_id: DEAL_ADMISSION_ID,
    result_key: RESULT_KEY,
    result_version: 1,
    concept_key: 'TERMF-TARGET',
    party: FEE_PARTY,
    value_slot_key: 'FEE_AMOUNT',
    ordinal: 0,
    claim,
    relationships,
    composition_scope_closure_id: compositionScopeClosureId,
    completeness: 'COMPLETE',
    comparability: 'COMPARABLE',
  });
  const semanticDeal = freeze({
    deal_key: DEAL_KEY,
    deal_admission_id: DEAL_ADMISSION_ID,
    document_hash: AGREEMENT_DOCUMENT_HASH,
  });
  const servingDeal = freeze({
    ...semanticDeal,
    dimensions: DEAL_DIMENSIONS,
  });
  const projection = projectMarketMetricSlot({
    contract_bundle: contractBundle,
    release_state: 'CANDIDATE_CERTIFIED',
    corpus_release_id: corpusReleaseId,
    deal: servingDeal,
    concept_key: 'TERMF-TARGET',
    metric_key: METRIC_KEY,
    party: FEE_PARTY,
    result,
    claim,
    relationships,
    value_slot_key: 'FEE_AMOUNT',
    ordinal: 0,
  });
  if (!projection.observation || projection.exclusion) {
    throw new TypeError('the QXO termination fee did not produce one comparable observation');
  }
  if (projection.observation.canonical_value !== '3.52941176') {
    throw new TypeError('the QXO termination fee percent normalisation has drifted');
  }

  const cohort = buildCohort({
    contractBundle,
    servingNamespaceId,
    corpusReleaseId,
    deal: servingDeal,
    observation: projection.observation,
  });
  const provisions = freeze([feeProvision, ...groundProvisions]);
  const components = freeze([feeComponent, ...groundComponents]);
  const reviewedMappingBody = {
    schema_version: 'REVIEWED_CANONICAL_MAPPING/V1',
    review_version: REVIEW_VERSION,
    document_hash: AGREEMENT_DOCUMENT_HASH,
    canonical_text_ids: [AGREEMENT_CANONICAL_TEXT_ID, DEAL_VALUE_CANONICAL_TEXT_ID],
    governed_parent_intervals: [
      SPAN_PINS.fee_payment.interval,
      ...GROUNDS.map((ground) => SPAN_PINS[ground.key].interval),
      DEAL_VALUE_INTERVAL,
    ],
    governed_evidence_excerpt_ids: Object.values(excerpts).map((item) => item.excerpt_id).sort(),
    canonical_object_ids: [
      ...provisions.map((item) => item.provision_instance_id),
      ...components.map((item) => item.provision_component_id),
      claim.claim_revision_id,
      ...relationships.map((item) => item.relationship_revision_id),
    ].sort(),
  };
  const reviewedMapping = freeze({
    ...reviewedMappingBody,
    reviewed_mapping_id: contentId('REVIEWED_CANONICAL_MAPPING/V1', reviewedMappingBody),
    canonical_payload_digest: contentId('REVIEWED_CANONICAL_MAPPING_PAYLOAD/V1', reviewedMappingBody),
  });
  const row = buildCanonicalResultServingRow({
    contract_bundle: contractBundle,
    frozen_pair_id: contentId('FROZEN_PAIR/V1', {
      reviewed_mapping_id: reviewedMapping.reviewed_mapping_id,
      corpus_release_id: corpusReleaseId,
      metric_slot_key: projection.metric_slot_key,
    }),
    projection_output: projection,
    cohort_request: cohort.request,
    cohort_result: cohort.result,
    result_ordinal: 0,
  });

  // Exact detail serves the claim's operative evidence (the fee amount quote)
  // via the frozen RESULT_COMPONENT_CLAIM_EVIDENCE action — the same surface
  // the live Landos termination-fee row uses. The full six-relationship
  // composition response measures ~25.7KB and cannot fit the frozen 16,384-
  // byte RESULT_COMPOSITION_EVIDENCE bound (changing the bound would move the
  // contract fingerprint), so composition detail is deliberately out of scope
  // here; the row itself still carries all six typed trigger effects.
  const exactDetailPackage = buildAdmittedClaimEvidenceDetailPackage({
    contract_bundle: contractBundle,
    row,
    source: agreementSourceContext,
    source_admission: agreementSourceAdmission,
    excerpt: excerpts.fee_amount,
    claim,
    evidence_ordinal: 0,
  });
  const publishedRow = exactDetailPackage.row;

  const closureId = contentId('QXO_TERMINATION_FEE_SEMANTIC_CLOSURE/V1', {
    deal_admission_id: DEAL_ADMISSION_ID,
    reviewed_mapping_id: reviewedMapping.reviewed_mapping_id,
    row_serving_key: publishedRow.row_serving_key,
  });
  const close = (rows) => rows.map((item) => freeze({ ...item, closure_id: closureId }));
  const semanticExcerpts = Object.entries(excerpts).map(([key, item]) => freeze({
    ...item,
    closure_id: key === 'deal_value' ? QXO_MATERIAL_SEMANTIC_CLOSURE_ID : closureId,
  }));
  const semanticWriteSet = freeze({
    source_references: [
      buildAdmittedSourceReference(agreementSourceContext),
      buildAdmittedSourceReference(dealValueSourceContext),
    ],
    deal: semanticDeal,
    excerpts: semanticExcerpts,
    validated_semantic_graphs: [],
    provisions: close([...provisions]),
    components: close([...components]),
    claims: close([claim]),
    relationships: close([...relationships]),
    open_world_candidates: [],
    open_world_candidate_occurrences: [],
    open_world_evidence_references: [],
    open_world_candidate_dispositions: [],
    open_world_primitives: [],
    semantic_impact_closures: [],
    reviewed_source_specific_rows: [],
    incomplete_canonical_result_rows: [],
  });

  return freeze({
    schema_version: 'QXO_TERMINATION_FEE_ADMITTED_SLICE/V1',
    corpus_release_id: corpusReleaseId,
    serving_namespace_id: servingNamespaceId,
    reviewed_mapping: reviewedMapping,
    semantic_closure_id: closureId,
    spans,
    excerpts,
    provisions,
    components,
    claim,
    relationships,
    normalised,
    result,
    deal: servingDeal,
    projection,
    shared_row: publishedRow,
    exact_detail_package: exactDetailPackage,
    semantic_write_set: semanticWriteSet,
    candidate_release_member: {
      projection_output: projection,
      shared_row: publishedRow,
      exact_detail: {
        package: exactDetailPackage,
        source: agreementSourceContext,
        source_admission: agreementSourceAdmission,
        excerpt: excerpts.fee_amount,
        claim,
      },
    },
  });
}

function validateQxoTerminationFeeAdmittedSlice({ candidate, ...inputs } = {}) {
  const expected = buildQxoTerminationFeeAdmittedSlice(inputs);
  if (canonicalJson(candidate) !== canonicalJson(expected)) {
    throw new TypeError('QXO termination-fee admitted slice identity or source binding has drifted');
  }
  return true;
}

module.exports = {
  DEAL_DIMENSIONS,
  GROUNDS,
  METRIC_KEY,
  RESULT_KEY,
  REVIEW_VERSION,
  SPAN_PINS,
  buildQxoTerminationFeeAdmittedSlice,
  validateQxoTerminationFeeAdmittedSlice,
};
