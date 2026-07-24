const { canonicalJson, contentId, sha256Hex } = require('./canonical-bytes');
const { buildAdmittedSourceReference } = require('./admitted-semantic-source');
const { buildClaimRevision, buildRelationshipRevision } = require('./claims-relationships');
const {
  moneyDenominatorPrecisionPolicyForClaim,
  validateContractBundle,
} = require('./contract-bundle');
const { compileMarketCohortRequest } = require('./market-cohort-query');
const {
  normaliseMoneyRelativeToDealValue,
} = require('./observation-normalisers');
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
const {
  QXO_REJECTED_F3_BUYER_TERMINATION_SEMANTIC_CLOSURE_ID,
  QXO_SELLER_TERMINATION_SEMANTIC_CLOSURE_ID,
} = require('./qxo-reverse-candidate-identity');
const {
  buildQxoBuyerTerminationFeeTriggerDetailPackage,
} = require('./qxo-buyer-termination-fee-trigger-detail');
const { buildFixtureResultComponent, projectMarketMetricSlot } = require('./serving-projection');
const { buildCanonicalResultServingRow } = require('./shared-serving-row');
const {
  buildExcerpt,
  buildProvisionComponent,
  buildProvisionInstance,
  buildSemanticSpan,
} = require('./source-structure');

const EXACT_PERCENT = '3.52941176';
const AGREEMENT_DOCUMENT_HASH = 'abba043018410d718c207e7d7a43c9567166f6a10c4c9a6b4b0c8c7761cd6b9d';
const DEAL_VALUE_DOCUMENT_HASH = '343ba5da8ab34f478f274307046836af4ded762b010e08ed8d9015be2e09c827';

const DEAL_VALUE_SHA256 = 'baa64b186700a9360b1d2820eb87f72fc37a12c0165f9a18d0d2ea4b09185eff';

const REQUIRED_CONCEPTS = Object.freeze([
  'TERMF-REVERSE',
  'TERMF-TARGET',
  'TERMR-RECOMMEND',
  'TERMR-NOSOL-BREACH',
  'TERMR-NOVOTE',
  'TERMR-BREACH',
  'TERMR-OUTSIDE',
]);

const DEAL_DIMENSIONS = Object.freeze({
  sector: 'Building products',
  buyer: 'QXO',
  merger_form: 'Reverse triangular merger',
  adviser_firms: Object.freeze(['Jones Day', 'Paul Weiss']),
  lawyers: Object.freeze(['Robert Profusek', 'Scott Barshay']),
  announce_year: 2026,
  deal_value_usd: '17000000000',
});

const COMMON_SPAN_PINS = Object.freeze({
  outside_date: Object.freeze({
    interval: Object.freeze({ start: 365187, end: 365563 }),
    sha256: '0bd333dd98ad7089c12e97786474c85d7a3bba43ba375020c7220429db13b05b',
  }),
});

function fact(factKey) {
  return Object.freeze({ operator: 'FACT', fact_key: factKey });
}

function allOf(...operands) {
  return Object.freeze({ operator: 'ALL_OF', operands: Object.freeze(operands) });
}

function anyOf(...operands) {
  return Object.freeze({ operator: 'ANY_OF', operands: Object.freeze(operands) });
}

function ifThen(ifExpression, thenExpression) {
  return Object.freeze({ operator: 'IF_THEN', if: ifExpression, then: thenExpression });
}

function collectIndexedFacts(expression, triggerCode, output = []) {
  if (expression.operator === 'FACT') {
    if (expression.fact_key !== triggerCode) output.push(expression.fact_key);
  } else if (expression.operator === 'IF_THEN') {
    collectIndexedFacts(expression.if, triggerCode, output);
    collectIndexedFacts(expression.then, triggerCode, output);
  } else {
    expression.operands.forEach((operand) => collectIndexedFacts(operand, triggerCode, output));
  }
  return [...new Set(output)].sort();
}

function triggerEffect(config, {
  pathwayCode,
  triggerCode,
  terminatingParty,
  paymentTiming,
  expression,
}) {
  return Object.freeze({
    effect_mode: 'TYPED_LEGAL_EFFECT',
    legal_operation: config.legalOperation,
    trigger_path_schema_key: 'TERMINATION_FEE_TRIGGER_PATH',
    trigger_path_schema_version: 2,
    pathway_code: pathwayCode,
    trigger_code: triggerCode,
    terminating_party: terminatingParty,
    payment_timing: paymentTiming,
    indexed_facts: Object.freeze(collectIndexedFacts(expression, triggerCode)),
    condition_expression: expression,
  });
}

function buildGrounds(config) {
  const immediateLatent = anyOf(
    fact('FEE_PAYEE_COULD_TERMINATE_FOR_CHANGE_IN_RECOMMENDATION'),
    fact('FEE_PAYEE_COULD_TERMINATE_FOR_DIRECT_NO_SOLICIT_BREACH'),
  );
  const commonPublicTail = [
    fact('DEFINITIVE_AGREEMENT_OR_CONSUMMATION_WITHIN_TWELVE_MONTHS'),
    fact('FIFTY_PERCENT_ACQUISITION_THRESHOLD'),
  ];
  const noVotePublicTail = [
    fact('COMPETING_PROPOSAL_PUBLICLY_ANNOUNCED_ON_OR_AFTER_SIGNING_BEFORE_STOCKHOLDER_MEETING_AND_NOT_WITHDRAWN'),
    ...commonPublicTail,
  ];
  const beforeTerminationPublicTail = [
    fact('COMPETING_PROPOSAL_PUBLICLY_ANNOUNCED_ON_OR_AFTER_SIGNING_BEFORE_TERMINATION_AND_NOT_WITHDRAWN'),
    ...commonPublicTail,
  ];
  const outsidePartyDependency = ifThen(
    fact('TERMINATING_PARTY_IS_FEE_PAYER'),
    anyOf(
      fact('FEE_PAYEE_COULD_TERMINATE_ON_OUTSIDE_DATE'),
      fact('FEE_PAYEE_COULD_TERMINATE_FOR_GENERAL_BREACH_IN_RESPECT_OF_NO_SOLICIT'),
      fact('FEE_PAYEE_COULD_TERMINATE_FOR_OTHER_COVENANT_BREACH'),
    ),
  );
  const immediate = 'TWO_BUSINESS_DAYS_AFTER_TERMINATION';
  const tail = 'UPON_EARLIER_OF_SIGNING_OR_CONSUMMATION';
  const entries = [
    ['rec_change', 'IMMEDIATE_RECOMMENDATION_CHANGE', 'CHANGE_IN_RECOMMENDATION_TERMINATION',
      config.payee.value, immediate, allOf(fact('CHANGE_IN_RECOMMENDATION_TERMINATION')),
      ['rec_change']],
    ['nosolicit', 'IMMEDIATE_NO_SOLICIT_BREACH', 'NO_SOLICIT_BREACH_TERMINATION',
      config.payee.value, immediate, allOf(fact('NO_SOLICIT_BREACH_TERMINATION')),
      ['nosolicit']],
    ['vote_failure', 'IMMEDIATE_NO_VOTE_WITH_LATENT_RIGHT', 'STOCKHOLDER_APPROVAL_FAILURE_TERMINATION',
      'EITHER_PARTY', immediate, allOf(
        fact('STOCKHOLDER_APPROVAL_FAILURE_TERMINATION'),
        immediateLatent,
      ), ['vote_failure', 'rec_change', 'nosolicit']],
    ['outside_date', 'IMMEDIATE_OUTSIDE_DATE_WITH_LATENT_RIGHT', 'OUTSIDE_DATE_TERMINATION',
      'EITHER_PARTY', immediate, allOf(fact('OUTSIDE_DATE_TERMINATION'), immediateLatent),
      ['outside_date', 'rec_change', 'nosolicit']],
    ['vote_failure', 'TAIL_NO_VOTE', 'STOCKHOLDER_APPROVAL_FAILURE_TERMINATION',
      'EITHER_PARTY', tail, allOf(
        fact('STOCKHOLDER_APPROVAL_FAILURE_TERMINATION'),
        fact('IMMEDIATE_FEE_GATEWAY_DOES_NOT_APPLY'),
        ...noVotePublicTail,
      ), ['vote_failure', 'y_preamble', 'y_a_timing', 'y_public']],
    ['outside_date', 'TAIL_OUTSIDE_DATE', 'OUTSIDE_DATE_TERMINATION',
      'EITHER_PARTY', tail, allOf(
        fact('OUTSIDE_DATE_TERMINATION'),
        fact('STOCKHOLDER_APPROVAL_NOT_YET_OBTAINED'),
        outsidePartyDependency,
        ...beforeTerminationPublicTail,
      ), [
        'outside_date',
        'nosolicit',
        'covenant_breach',
        'tail_dependency',
        'y_preamble',
        'y_bc_timing',
        'y_public',
      ]],
    ['covenant_breach', 'TAIL_NO_SOLICIT_BREACH', 'NO_SOLICIT_BREACH_TERMINATION',
      config.payee.value, tail, allOf(
        fact('NO_SOLICIT_BREACH_TERMINATION'),
        fact('STOCKHOLDER_APPROVAL_NOT_YET_OBTAINED'),
        ...beforeTerminationPublicTail,
      ), ['covenant_breach', 'y_preamble', 'y_bc_timing', 'y_public']],
    ['covenant_breach', 'TAIL_OTHER_COVENANT_BREACH', 'COUNTERPARTY_COVENANT_BREACH_TERMINATION',
      config.payee.value, tail, allOf(
        fact('COUNTERPARTY_COVENANT_BREACH_TERMINATION'),
        ...(config.otherCovenantNeedsApproval
          ? [fact('STOCKHOLDER_APPROVAL_NOT_YET_OBTAINED')]
          : []),
        ...beforeTerminationPublicTail,
      ), ['covenant_breach', 'y_preamble', 'y_bc_timing', 'y_public']],
    ['intervening', 'TAIL_INTERVENING_EVENT_RECOMMENDATION_CHANGE',
      'INTERVENING_EVENT_RECOMMENDATION_CHANGE_TERMINATION',
      config.payee.value, tail, allOf(
        fact('INTERVENING_EVENT_RECOMMENDATION_CHANGE_TERMINATION'),
        fact('STOCKHOLDER_APPROVAL_NOT_YET_OBTAINED'),
        fact('DEFINITIVE_AGREEMENT_OR_CONSUMMATION_WITHIN_TWELVE_MONTHS'),
        fact('FIFTY_PERCENT_ACQUISITION_THRESHOLD'),
      ), ['intervening']],
  ];
  return Object.freeze(entries.map(([
    targetKey,
    pathwayCode,
    triggerCode,
    terminatingParty,
    paymentTiming,
    expression,
    evidenceKeys,
  ], relationshipOrdinal) => Object.freeze({
    targetKey,
    relationshipOrdinal,
    evidenceKeys: Object.freeze(evidenceKeys),
    effect: triggerEffect(config, {
      pathwayCode,
      triggerCode,
      terminatingParty,
      paymentTiming,
      expression,
    }),
  })));
}

const BUYER_CONFIG = Object.freeze({
  reviewVersion: 'QXO_ADMITTED_BUYER_TERMINATION_FEE_F4/V1',
  metricKey: 'BUYER_TERMINATION_FEE_PERCENT_OF_DEAL_VALUE',
  resultKey: 'BUYER_TERMINATION_FEE',
  feeConcept: 'TERMF-REVERSE',
  feeSide: 'BUYER',
  legalOperation: 'CREATES_BUYER_TERMINATION_FEE_PAYMENT_TRIGGER',
  payer: Object.freeze({ role: 'FEE_PAYER', value: 'PARENT', capacity: 'BUYER' }),
  payee: Object.freeze({ role: 'FEE_PAYEE', value: 'COMPANY', capacity: 'TARGET' }),
  otherCovenantNeedsApproval: true,
  predecessorSemanticClosureId: QXO_REJECTED_F3_BUYER_TERMINATION_SEMANTIC_CLOSURE_ID,
  closureDomain: 'QXO_BUYER_TERMINATION_FEE_F4_SEMANTIC_CLOSURE/V1',
  schemaVersion: 'QXO_BUYER_TERMINATION_FEE_F4_ADMITTED_SLICE/V1',
  spanPins: Object.freeze({
    ...COMMON_SPAN_PINS,
    gateway: Object.freeze({
      interval: Object.freeze({ start: 375865, end: 378634 }),
      sha256: '25769300409a6309a5398c01971392080af180aa978732b82f64b82456a117fc',
    }),
    fee_payment: Object.freeze({
      interval: Object.freeze({ start: 378634, end: 380001 }),
      sha256: '9a35c4831b3e121d8661396fb7ee9d595061b8d95d41e066d206c92413c867d9',
    }),
    fee_amount: Object.freeze({
      interval: Object.freeze({ start: 379357, end: 379369 }),
      sha256: 'de628357f305cf4f1578eff464bb9b42b32e83127aabeec736ea9521877e0184',
    }),
    vote_failure: Object.freeze({
      interval: Object.freeze({ start: 365563, end: 365774 }),
      sha256: 'a2ac9d57445645282c29a6964e32ce9dd682ee520b4e6dcabb73d45d62b6ad19',
    }),
    rec_change: Object.freeze({
      interval: Object.freeze({ start: 366664, end: 366739 }),
      sha256: 'e11cfaae498ed017d31e310200b919803c8f0d74810e8be096324ccc4b59d365',
    }),
    nosolicit: Object.freeze({
      interval: Object.freeze({ start: 366832, end: 367256 }),
      sha256: 'b7b40f320972d7ab50c1462a5468d5736db440838c5a86476ed50f44b578beaf',
    }),
    covenant_breach: Object.freeze({
      interval: Object.freeze({ start: 367256, end: 368228 }),
      sha256: 'd296f897e48080a1d5294526deee94e1e487b7b8e09338fe3f2ab43580e3aa0b',
    }),
    tail_dependency: Object.freeze({
      interval: Object.freeze({ start: 377313, end: 377802 }),
      sha256: '3bcb447581b66ac938d1fdd33743983fe016538819c39baeda843f1b1d3ce1a0',
    }),
    y_preamble: Object.freeze({
      interval: Object.freeze({ start: 377802, end: 377925 }),
      sha256: 'd315f2e63ed5d91007c25c64ef274144f7ec27cd9dec30d9bb0343338b20e404',
    }),
    y_a_timing: Object.freeze({
      interval: Object.freeze({ start: 377925, end: 378020 }),
      sha256: '791284ecd5abf46d7730fd98b3842eb0a91c576406a3fb64947103a530426f50',
    }),
    y_bc_timing: Object.freeze({
      interval: Object.freeze({ start: 378021, end: 378103 }),
      sha256: '086ca36f6f2578128c6e491e3297256f66c8d2c765058623c2efc8d22989228d',
    }),
    y_public: Object.freeze({
      interval: Object.freeze({ start: 378104, end: 378197 }),
      sha256: '94803de1e50b0f33243634629a12f7b86840d6b0de5743db95cd1c3654329ec4',
    }),
    intervening: Object.freeze({
      interval: Object.freeze({ start: 366743, end: 366828 }),
      sha256: '1959719c793372079861fa8ab2c71fcdf82b500d59174be13c3fe87a9bdf7470',
    }),
  }),
});

const SELLER_CONFIG = Object.freeze({
  reviewVersion: 'QXO_ADMITTED_SELLER_TERMINATION_FEE_F4/V1',
  metricKey: 'SELLER_TERMINATION_FEE_PERCENT_OF_DEAL_VALUE',
  resultKey: 'SELLER_TERMINATION_FEE',
  feeConcept: 'TERMF-TARGET',
  feeSide: 'SELLER',
  legalOperation: 'CREATES_SELLER_TERMINATION_FEE_PAYMENT_TRIGGER',
  payer: Object.freeze({ role: 'FEE_PAYER', value: 'COMPANY', capacity: 'TARGET' }),
  payee: Object.freeze({ role: 'FEE_PAYEE', value: 'PARENT', capacity: 'BUYER' }),
  otherCovenantNeedsApproval: false,
  predecessorSemanticClosureId: QXO_SELLER_TERMINATION_SEMANTIC_CLOSURE_ID,
  closureDomain: 'QXO_SELLER_TERMINATION_FEE_F4_SEMANTIC_CLOSURE/V1',
  schemaVersion: 'QXO_SELLER_TERMINATION_FEE_F4_ADMITTED_SLICE/V1',
  spanPins: Object.freeze({
    ...COMMON_SPAN_PINS,
    gateway: Object.freeze({
      interval: Object.freeze({ start: 371766, end: 374493 }),
      sha256: '5dcf771b5b6b37eed7d96c3187875f66645a830c976b3d8f638dc5807d82c596',
    }),
    fee_payment: Object.freeze({
      interval: Object.freeze({ start: 374493, end: 375864 }),
      sha256: 'b4d051ee911d6b612661d27124f1fa4db8dc5d0ad929dc4715317c3f620121a9',
    }),
    fee_amount: Object.freeze({
      interval: Object.freeze({ start: 375239, end: 375251 }),
      sha256: 'de628357f305cf4f1578eff464bb9b42b32e83127aabeec736ea9521877e0184',
    }),
    vote_failure: Object.freeze({
      interval: Object.freeze({ start: 365774, end: 365990 }),
      sha256: 'a2fd8daaa9c4fb6d1d78f119a1e3a3ebca8d96afb193a3c9d88e762525fd4c33',
    }),
    rec_change: Object.freeze({
      interval: Object.freeze({ start: 368467, end: 368544 }),
      sha256: '87ab455d09bbdae9a53b1a10212b82dce6d9781dbc096e301ce8444a7e0b11ea',
    }),
    nosolicit: Object.freeze({
      interval: Object.freeze({ start: 368639, end: 369062 }),
      sha256: 'a65d55d5e988263f3f3436c6c164483f159db2440249d394e6221ef3b87f7676',
    }),
    covenant_breach: Object.freeze({
      interval: Object.freeze({ start: 369062, end: 370053 }),
      sha256: '932338e7cb7130867d48e2462bd833a32d3e3723f7c7d726f93e7855a00c0047',
    }),
    tail_dependency: Object.freeze({
      interval: Object.freeze({ start: 373144, end: 373651 }),
      sha256: 'ad10ff6fcc02f1ef54bf22e320c7f40d6af4341fbc8a0238f6832cc065800abb',
    }),
    y_preamble: Object.freeze({
      interval: Object.freeze({ start: 373651, end: 373774 }),
      sha256: 'd315f2e63ed5d91007c25c64ef274144f7ec27cd9dec30d9bb0343338b20e404',
    }),
    y_a_timing: Object.freeze({
      interval: Object.freeze({ start: 373774, end: 373870 }),
      sha256: 'afad0165ee32cf5d9c0829f5875a68aff74a437da3b4565a3dd5c6827e3a648a',
    }),
    y_bc_timing: Object.freeze({
      interval: Object.freeze({ start: 373871, end: 373953 }),
      sha256: '086ca36f6f2578128c6e491e3297256f66c8d2c765058623c2efc8d22989228d',
    }),
    y_public: Object.freeze({
      interval: Object.freeze({ start: 373954, end: 374048 }),
      sha256: '57fe463ddb9a42494f71902b99cbc0e1712c7319ea3f741b118f2d498bdab3cc',
    }),
    intervening: Object.freeze({
      interval: Object.freeze({ start: 368548, end: 368635 }),
      sha256: 'd4201448c4c705e6a1ebdaf55d0310b40882d6454d0903fc6cd1e2a716669deb',
    }),
  }),
});

const BUYER_GROUNDS = buildGrounds(BUYER_CONFIG);
const SELLER_GROUNDS = buildGrounds(SELLER_CONFIG);

function freeze(value) {
  if (!value || typeof value !== 'object' || Object.isFrozen(value)) return value;
  Object.values(value).forEach(freeze);
  return Object.freeze(value);
}

function requireDigest(value, label) {
  if (!/^[a-f0-9]{64}$/.test(value || '')) throw new TypeError(`${label} must be a SHA-256 digest`);
}

function validateSourceContext(source, {
  label,
  sourceOrdinal,
  documentHash,
  canonicalTextId,
  canonicalTextByteLength,
}) {
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
    'immutable_source_document_id',
    'source_admission_manifest_id',
    'semantic_extraction_input_envelope_id',
    'source_content_id',
    'source_occurrence_id',
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

function relationshipEvidence(excerpts, sourceOrdinal) {
  return excerpts.map((excerpt, index) => claimEvidence(
    excerpt,
    index === 0 ? 'DERIVATION_INPUT' : 'CROSS_REFERENCE',
    sourceOrdinal,
  ));
}

function relationshipScope(reviewVersion, label, evidenceExcerpts, targetExcerpt) {
  const required = [...new Set(evidenceExcerpts.map((excerpt) => excerpt.excerpt_id))].sort();
  return {
    scope_closure_id: contentId('RELATIONSHIP_SCOPE_CLOSURE/V1', {
      review_version: reviewVersion,
      label,
      required_interval_ids: required,
    }),
    coverage_status: 'COMPLETE',
    required_interval_ids: required,
    examined_interval_ids: required,
    target_interval_ids: [targetExcerpt.excerpt_id],
  };
}

function exactNormalisation(excerptId, reviewVersion, denominatorPrecisionPolicy) {
  return normaliseMoneyRelativeToDealValue({
    rawAmount: '600000000',
    currency: 'USD',
    denominator: {
      value: '17000000000',
      currency: 'USD',
      basis: 'HEADLINE_TRANSACTION_VALUE',
      source_lineage_ids: [excerptId],
      ...(denominatorPrecisionPolicy ? { precision: 'APPROXIMATE' } : {}),
    },
    derivationVersion: reviewVersion,
  });
}

function buildCohort({
  config,
  contractBundle,
  servingNamespaceId,
  corpusReleaseId,
  deal,
  observation,
}) {
  const request = {
    serving_namespace_id: servingNamespaceId,
    corpus_release_id: corpusReleaseId,
    contract_fingerprint: contractBundle.fingerprint,
    metric_key: config.metricKey,
    metric_version: 1,
    concept_key: config.feeConcept,
    party: config.payer,
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

function triggerDefinitions(config) {
  const holder = Object.freeze({
    role: 'TERMINATION_RIGHT_HOLDER',
    value: config.payee.value,
    capacity: config.payee.capacity,
  });
  const mutual = Object.freeze({
    role: 'TERMINATION_RIGHT_HOLDER',
    value: 'EITHER_PARTY',
    capacity: 'MUTUAL',
  });
  return Object.freeze([
    Object.freeze({ key: 'rec_change', conceptKey: 'TERMR-RECOMMEND', party: holder, ordinal: 1 }),
    Object.freeze({ key: 'intervening', conceptKey: 'TERMR-RECOMMEND', party: holder, ordinal: 2 }),
    Object.freeze({ key: 'nosolicit', conceptKey: 'TERMR-NOSOL-BREACH', party: holder, ordinal: 1 }),
    Object.freeze({ key: 'vote_failure', conceptKey: 'TERMR-NOVOTE', party: mutual, ordinal: 1 }),
    Object.freeze({ key: 'outside_date', conceptKey: 'TERMR-OUTSIDE', party: mutual, ordinal: 1 }),
    Object.freeze({ key: 'covenant_breach', conceptKey: 'TERMR-BREACH', party: holder, ordinal: 1 }),
  ]);
}

function buildQxoTerminationFeeF4Side(config, {
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
    throw new TypeError(`admitted QXO ${config.feeSide.toLowerCase()}-fee source admissions do not match their contexts`);
  }
  const conceptKeys = new Set(contractBundle.concepts.map((item) => item.concept_key));
  for (const key of REQUIRED_CONCEPTS) {
    if (!conceptKeys.has(key)) {
      throw new TypeError(`the versioned F4 contract concept ${key} is required for this slice`);
    }
  }
  if (!contractBundle.claim_definitions.some(
    (item) => item.claim_definition_key === config.metricKey,
  )) {
    throw new TypeError(`the versioned F4 contract claim ${config.metricKey} is required for this slice`);
  }
  const binding = contractBundle.serving_metric_operation_bindings?.find(
    (item) => item.metric_key === config.metricKey
      && item.legal_operation === config.legalOperation
      && item.trigger_path_schema_key === 'TERMINATION_FEE_TRIGGER_PATH'
      && item.trigger_path_schema_version === 2,
  );
  if (!binding || canonicalJson(binding.payer) !== canonicalJson(config.payer)
    || canonicalJson(binding.payee) !== canonicalJson(config.payee)) {
    throw new TypeError(`the versioned F4 ${config.feeSide.toLowerCase()}-fee binding is required`);
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
  for (const [key, pin] of Object.entries(config.spanPins)) {
    if (sha256Hex(exactBytes(agreementSourceContext, pin.interval)) !== pin.sha256) {
      throw new TypeError(`reviewed QXO ${config.feeSide.toLowerCase()} termination ${key} span has drifted`);
    }
  }
  if (config.spanPins.fee_amount.interval.start < config.spanPins.fee_payment.interval.start
    || config.spanPins.fee_amount.interval.end > config.spanPins.fee_payment.interval.end) {
    throw new TypeError('the fee amount span must sit inside the fee payment span');
  }
  if (sha256Hex(exactBytes(dealValueSourceContext, DEAL_VALUE_INTERVAL)) !== DEAL_VALUE_SHA256) {
    throw new TypeError('reviewed QXO deal-value denominator has drifted');
  }

  const allPins = config.spanPins;
  const spans = freeze({
    ...Object.fromEntries(Object.entries(allPins).map(([key, pin]) => [
      key,
      buildSemanticSpan(agreementSourceContext, pin.interval.start, pin.interval.end),
    ])),
    deal_value: buildSemanticSpan(
      dealValueSourceContext,
      DEAL_VALUE_INTERVAL.start,
      DEAL_VALUE_INTERVAL.end,
    ),
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
    conceptKey: config.feeConcept,
    party: config.payer,
    ordinal: 1,
    contractBundle,
  });
  const feeComponent = buildProvisionComponent({
    source: agreementSourceContext,
    parentProvision: feeProvision,
    span: spans.fee_payment,
    componentKey: 'FEE_AMOUNT_LIMB',
    ordinal: 1,
    contractBundle,
  });
  const triggerDefinitionsByKey = new Map(triggerDefinitions(config).map((definition) => [
    definition.key,
    definition,
  ]));
  const groundProvisions = [...triggerDefinitionsByKey.values()].map((definition) => buildProvisionInstance({
    source: agreementSourceContext,
    span: spans[definition.key],
    conceptKey: definition.conceptKey,
    party: definition.party,
    ordinal: definition.ordinal,
    contractBundle,
  }));
  const groundComponents = [...triggerDefinitionsByKey.values()].map((definition, index) => buildProvisionComponent({
    source: agreementSourceContext,
    parentProvision: groundProvisions[index],
    span: spans[definition.key],
    componentKey: 'TERMINATION_TRIGGER_LIMB',
    ordinal: index + 1,
    contractBundle,
  }));
  const componentsByTargetKey = new Map(
    [...triggerDefinitionsByKey.keys()].map((key, index) => [key, groundComponents[index]]),
  );

  const denominatorPrecisionPolicy = moneyDenominatorPrecisionPolicyForClaim(
    contractBundle,
    config.metricKey,
  );
  const normalised = exactNormalisation(
    excerpts.deal_value.excerpt_id,
    config.reviewVersion,
    denominatorPrecisionPolicy,
  );
  const claimScopeIds = [excerpts.fee_amount.excerpt_id, excerpts.deal_value.excerpt_id].sort();
  const claim = buildClaimRevision({
    subject_occurrence_id: feeComponent.provision_component_id,
    claim_definition_key: config.metricKey,
    state: 'PRESENT',
    raw_value: excerpts.fee_amount.exact_text,
    canonical_value: normalised.canonical_value,
    unit: normalised.canonical_unit,
    denominator: normalised.denominator,
    attributes: {
      basis_key: normalised.basis_key,
      raw_amount: normalised.raw_value.amount,
      raw_currency: normalised.raw_value.currency,
      fee_side: config.feeSide,
      payee_value: config.payee.value,
      payee_capacity: config.payee.capacity,
      denominator_precision: 'APPROXIMATE',
      normalisation_payload_digest: normalised.normalisation_payload_digest,
    },
    allowed_attributes: [
      'basis_key',
      'raw_amount',
      'raw_currency',
      'fee_side',
      'payee_value',
      'payee_capacity',
      'denominator_precision',
      'normalisation_payload_digest',
    ],
    evidence: [
      claimEvidence(
        excerpts.fee_amount,
        'OPERATIVE_TEXT',
        agreementSourceContext.source_ordinal,
      ),
      claimEvidence(
        excerpts.deal_value,
        'DERIVATION_INPUT',
        dealValueSourceContext.source_ordinal,
      ),
    ],
    scope: {
      scope_closure_id: contentId('CLAIM_SCOPE_CLOSURE/V1', {
        review_version: config.reviewVersion,
        interval_ids: claimScopeIds,
      }),
      coverage_status: 'COMPLETE',
      required_interval_ids: claimScopeIds,
      examined_interval_ids: claimScopeIds,
    },
    extraction_version: config.reviewVersion,
    normalisation_version: config.reviewVersion,
    derivation_version: config.reviewVersion,
  });

  const grounds = config.feeSide === 'BUYER' ? BUYER_GROUNDS : SELLER_GROUNDS;
  const relationshipExcerptSets = grounds.map((ground) => [
    excerpts.gateway,
    excerpts.fee_payment,
    ...ground.evidenceKeys.map((key) => excerpts[key]),
  ]);
  const relationships = freeze(grounds.map((ground, index) => buildRelationshipRevision({
    source_occurrence_id: feeComponent.provision_component_id,
    relationship_definition_key: 'TRIGGERED_BY',
    ordinal: ground.relationshipOrdinal,
    state: 'PRESENT',
    raw_scope: excerpts[ground.targetKey].exact_text,
    target_occurrence_ids: [componentsByTargetKey.get(ground.targetKey).provision_component_id],
    effect: ground.effect,
    evidence: relationshipEvidence(
      relationshipExcerptSets[index],
      agreementSourceContext.source_ordinal,
    ),
    scope: relationshipScope(
      config.reviewVersion,
      ground.effect.trigger_code + ':' + ground.relationshipOrdinal,
      relationshipExcerptSets[index],
      excerpts[ground.targetKey],
    ),
    resolver_version: config.reviewVersion,
  })));

  const compositionScopeClosureId = contentId('COMPOSITION_SCOPE_CLOSURE/V1', {
    claim_revision_id: claim.claim_revision_id,
    relationship_revision_ids: relationships.map((item) => item.relationship_revision_id),
  });
  const result = buildFixtureResultComponent({
    deal_admission_id: DEAL_ADMISSION_ID,
    result_key: config.resultKey,
    result_version: 1,
    concept_key: config.feeConcept,
    party: config.payer,
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
    concept_key: config.feeConcept,
    metric_key: config.metricKey,
    party: config.payer,
    result,
    claim,
    relationships,
    value_slot_key: 'FEE_AMOUNT',
    ordinal: 0,
  });
  if (!projection.observation
    || projection.exclusion
    || projection.observation.canonical_value !== EXACT_PERCENT) {
    throw new TypeError('the QXO buyer termination fee did not produce its exact comparable observation');
  }

  const cohort = buildCohort({
    config,
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
    review_version: config.reviewVersion,
    document_hash: AGREEMENT_DOCUMENT_HASH,
    canonical_text_ids: [AGREEMENT_CANONICAL_TEXT_ID, DEAL_VALUE_CANONICAL_TEXT_ID],
    governed_parent_intervals: [
      ...Object.values(config.spanPins).map((pin) => pin.interval),
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

  const triggerEvidenceExcerpts = [...new Map(relationshipExcerptSets.flat().map(
    (excerpt) => [excerpt.excerpt_id, excerpt],
  )).values()];
  const exactDetailPackage = buildQxoBuyerTerminationFeeTriggerDetailPackage({
    contract_bundle: contractBundle,
    row,
    source: agreementSourceContext,
    source_admission: agreementSourceAdmission,
    relationships,
    excerpts: triggerEvidenceExcerpts,
  });
  const publishedRow = exactDetailPackage.row;
  const closureId = contentId(config.closureDomain, {
    deal_admission_id: DEAL_ADMISSION_ID,
    reviewed_mapping_id: reviewedMapping.reviewed_mapping_id,
    row_serving_key: publishedRow.row_serving_key,
  });
  const close = (rows) => rows.map((item) => freeze({ ...item, closure_id: closureId }));
  const retainPredecessorEvidence = (item) => freeze({
    ...item,
    closure_id: config.predecessorSemanticClosureId,
  });
  const semanticExcerpts = Object.entries(excerpts).map(([key, item]) => freeze({
    ...item,
    closure_id: key === 'deal_value'
      ? QXO_MATERIAL_SEMANTIC_CLOSURE_ID
      : ['fee_payment', 'fee_amount'].includes(key)
        ? config.predecessorSemanticClosureId
        : closureId,
  }));
  const semanticWriteSet = freeze({
    source_references: [
      buildAdmittedSourceReference(agreementSourceContext),
      buildAdmittedSourceReference(dealValueSourceContext),
    ],
    deal: semanticDeal,
    excerpts: semanticExcerpts,
    validated_semantic_graphs: [],
    provisions: [retainPredecessorEvidence(feeProvision), ...close(groundProvisions)],
    components: [retainPredecessorEvidence(feeComponent), ...close(groundComponents)],
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
    schema_version: config.schemaVersion,
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
        relationships,
        excerpts: triggerEvidenceExcerpts,
      },
    },
  });
}

function buildQxoBuyerTerminationFeeAdmittedSlice(inputs = {}) {
  return buildQxoTerminationFeeF4Side(BUYER_CONFIG, inputs);
}

function buildQxoSellerTerminationFeeF4AdmittedSlice(inputs = {}) {
  return buildQxoTerminationFeeF4Side(SELLER_CONFIG, inputs);
}

function validateQxoBuyerTerminationFeeAdmittedSlice({ candidate, ...inputs } = {}) {
  const expected = buildQxoBuyerTerminationFeeAdmittedSlice(inputs);
  if (canonicalJson(candidate) !== canonicalJson(expected)) {
    throw new TypeError('QXO buyer termination-fee admitted slice identity or source binding has drifted');
  }
  return true;
}

function validateQxoSellerTerminationFeeF4AdmittedSlice({ candidate, ...inputs } = {}) {
  const expected = buildQxoSellerTerminationFeeF4AdmittedSlice(inputs);
  if (canonicalJson(candidate) !== canonicalJson(expected)) {
    throw new TypeError('QXO seller termination-fee F4 admitted slice identity or source binding has drifted');
  }
  return true;
}

module.exports = {
  BUYER_CONFIG,
  BUYER_GROUNDS,
  DEAL_DIMENSIONS,
  EXACT_PERCENT,
  SELLER_CONFIG,
  SELLER_GROUNDS,
  buildQxoBuyerTerminationFeeAdmittedSlice,
  buildQxoSellerTerminationFeeF4AdmittedSlice,
  validateQxoBuyerTerminationFeeAdmittedSlice,
  validateQxoSellerTerminationFeeF4AdmittedSlice,
};
