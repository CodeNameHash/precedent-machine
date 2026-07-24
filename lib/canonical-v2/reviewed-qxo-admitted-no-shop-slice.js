const { canonicalJson, contentId, sha256Hex } = require('./canonical-bytes');
const { buildClaimRevision } = require('./claims-relationships');
const { normaliseDurationToDays } = require('./observation-normalisers');
const {
  buildExcerpt,
  buildProvisionComponent,
  buildProvisionInstance,
  buildSemanticSpan,
} = require('./source-structure');

const REVIEW_VERSION = 'QXO_ADMITTED_NO_SHOP_NOTICE/V1';
const DEAL_KEY = 'deal:qxo-topbuild';
const SECTION_4_3_INTERVAL = Object.freeze({ start: 201370, end: 226862 });
const NOTICE_INTERVAL = Object.freeze({ start: 207783, end: 210495 });
const MATCH_INTERVAL = Object.freeze({ start: 217116, end: 220702 });
const SECTION_4_3_SHA256 = 'ffbffb81e798af99509dd998c5a5793c2127eaf3ada937ae662306e99a86c524';
const NOTICE_SHA256 = '286c30dc17cee03d4884fa1904e7df6fabec46d6cb84444dd0ca5117d515e6cb';
const MATCH_SHA256 = '8ee599c10ae1b13060dc5fee7afeb8934fbb8c25cf892e30ded4a3a14aec3593';
const NOTICE_CLOCK_TEXT = 'twenty-four (24) hours after receipt';
const MATCH_CLOCK_TEXT = 'four (4) business days’ prior written notice';
const TARGET_PARTY = Object.freeze({ role: 'COVENANT_OBLIGOR', value: 'COMPANY', capacity: 'TARGET' });
const BUYER_PARTY = Object.freeze({ role: 'RIGHT_HOLDER', value: 'PARENT', capacity: 'ACQUIRER' });

function requireDigest(value, label) {
  if (!/^[a-f0-9]{64}$/.test(value || '')) throw new TypeError(`${label} must be a SHA-256 digest`);
}

function validateSourceContext(source) {
  if (!source || source.schema_version !== 'ADMITTED_SEMANTIC_SOURCE_CONTEXT/V1'
    || source.governed_deal_key !== DEAL_KEY
    || source.source_kind !== 'ORIGINAL_BYTES'
    || typeof source.canonical_text?.text !== 'string'
    || source.canonical_text.canonical_text_id !== source.canonical_text_id) {
    throw new TypeError('an admitted QXO semantic source context is required');
  }
  for (const key of [
    'deal_admission_id', 'immutable_source_document_id', 'source_admission_manifest_id',
    'semantic_extraction_input_envelope_id', 'source_content_id', 'source_occurrence_id',
    'document_hash', 'canonical_text_id', 'canonical_text_sha256',
  ]) requireDigest(source[key], `source.${key}`);
  const bytes = Buffer.from(source.canonical_text.text, 'utf8');
  if (bytes.length !== source.canonical_text_byte_length
    || sha256Hex(bytes) !== source.canonical_text_sha256
    || bytes.length < SECTION_4_3_INTERVAL.end) {
    throw new TypeError('admitted QXO canonical text geometry has drifted');
  }
}

function intervalBytes(source, interval) {
  return Buffer.from(source.canonical_text.text, 'utf8').subarray(interval.start, interval.end);
}

function governedByteIndex(buffer, needle, ordinal, expectedCount, label) {
  const token = Buffer.from(needle, 'utf8');
  const starts = [];
  let cursor = 0;
  while (cursor < buffer.length) {
    const start = buffer.indexOf(token, cursor);
    if (start < 0) break;
    starts.push(start);
    cursor = start + token.length;
  }
  if (starts.length !== expectedCount || !Number.isInteger(starts[ordinal])) {
    throw new TypeError(`reviewed ${label} selector occurrence set has drifted`);
  }
  return { start: starts[ordinal], byteLength: token.length };
}

function exactSpan(source, parent, relativeStart, relativeEnd) {
  return buildSemanticSpan(source, parent.start + relativeStart, parent.start + relativeEnd);
}

function evidence(excerpt, evidenceRole, documentOrdinal) {
  return {
    evidence_role: evidenceRole,
    excerpt_id: excerpt.excerpt_id,
    document_ordinal: documentOrdinal,
    absolute_start: excerpt.absolute_start,
    absolute_end: excerpt.absolute_end,
  };
}

function completeScope(label, excerpts) {
  const intervalIds = excerpts.map((item) => item.excerpt_id).sort();
  return {
    scope_closure_id: contentId('CLAIM_SCOPE_CLOSURE/V1', {
      review_version: REVIEW_VERSION,
      label,
      interval_ids: intervalIds,
    }),
    coverage_status: 'COMPLETE',
    required_interval_ids: intervalIds,
    examined_interval_ids: intervalIds,
  };
}

function durationClaim({ component, clauseExcerpt, clockExcerpt, definitionKey, rawMagnitude, rawUnit, dayBasis, trigger, documentOrdinal }) {
  const normalised = normaliseDurationToDays({
    rawMagnitude,
    rawUnit,
    dayBasis,
    trigger,
    derivationVersion: REVIEW_VERSION,
  });
  return buildClaimRevision({
    subject_occurrence_id: component.provision_component_id,
    claim_definition_key: definitionKey,
    state: 'PRESENT',
    raw_value: clockExcerpt.exact_text,
    canonical_value: normalised.canonical_value,
    unit: normalised.canonical_unit,
    day_basis: normalised.day_basis,
    attributes: {
      basis_key: normalised.basis_key,
      trigger: normalised.trigger,
      raw_magnitude: normalised.raw_value.magnitude,
      raw_unit: normalised.raw_value.unit,
      normalisation_payload_digest: normalised.normalisation_payload_digest,
    },
    allowed_attributes: ['basis_key', 'trigger', 'raw_magnitude', 'raw_unit', 'normalisation_payload_digest'],
    evidence: [
      evidence(clauseExcerpt, 'OPERATIVE_TEXT', documentOrdinal),
      evidence(clockExcerpt, 'DERIVATION_INPUT', documentOrdinal),
    ],
    scope: completeScope(definitionKey, [clauseExcerpt, clockExcerpt]),
    extraction_version: REVIEW_VERSION,
    normalisation_version: REVIEW_VERSION,
    derivation_version: REVIEW_VERSION,
  });
}

function buildQxoAdmittedNoShopNoticeSlice({ sourceContext, contractBundle, corpusReleaseId } = {}) {
  validateSourceContext(sourceContext);
  if (!contractBundle?.fingerprint) throw new TypeError('contractBundle is required');
  const conceptKeys = new Set(contractBundle.concepts.map((item) => item.concept_key));
  if (!conceptKeys.has('NOSOL-NOTICE') || !conceptKeys.has('NOSOL-MATCH')) {
    throw new TypeError('the frozen no-shop notice and matching concepts are required');
  }

  const sectionBytes = intervalBytes(sourceContext, SECTION_4_3_INTERVAL);
  const noticeBytes = intervalBytes(sourceContext, NOTICE_INTERVAL);
  const matchBytes = intervalBytes(sourceContext, MATCH_INTERVAL);
  if (sha256Hex(sectionBytes) !== SECTION_4_3_SHA256
    || sha256Hex(noticeBytes) !== NOTICE_SHA256
    || sha256Hex(matchBytes) !== MATCH_SHA256) {
    throw new TypeError('reviewed QXO Section 4.3 source has drifted');
  }

  const noticeClock = governedByteIndex(noticeBytes, NOTICE_CLOCK_TEXT, 0, 2, 'proposal notice clock');
  const matchClock = governedByteIndex(matchBytes, MATCH_CLOCK_TEXT, 0, 1, 'initial match clock');
  const spans = Object.freeze({
    no_shop_section: buildSemanticSpan(sourceContext, SECTION_4_3_INTERVAL.start, SECTION_4_3_INTERVAL.end),
    notice_clause: buildSemanticSpan(sourceContext, NOTICE_INTERVAL.start, NOTICE_INTERVAL.end),
    match_clause: buildSemanticSpan(sourceContext, MATCH_INTERVAL.start, MATCH_INTERVAL.end),
    notice_clock: exactSpan(
      sourceContext,
      NOTICE_INTERVAL,
      noticeClock.start,
      noticeClock.start + noticeClock.byteLength,
    ),
    match_clock: exactSpan(
      sourceContext,
      MATCH_INTERVAL,
      matchClock.start,
      matchClock.start + matchClock.byteLength,
    ),
  });
  const excerpts = Object.freeze(Object.fromEntries(
    Object.entries(spans).map(([key, value]) => [key, buildExcerpt({ source: sourceContext, span: value })]),
  ));

  const noticeProvision = buildProvisionInstance({
    source: sourceContext,
    span: spans.notice_clause,
    conceptKey: 'NOSOL-NOTICE',
    party: TARGET_PARTY,
    ordinal: 1,
    contractBundle,
  });
  const matchProvision = buildProvisionInstance({
    source: sourceContext,
    span: spans.match_clause,
    conceptKey: 'NOSOL-MATCH',
    party: BUYER_PARTY,
    ordinal: 1,
    contractBundle,
  });
  const noticeComponent = buildProvisionComponent({
    source: sourceContext,
    parentProvision: noticeProvision,
    span: spans.notice_clause,
    componentKey: 'NOTICE_LIMB',
    ordinal: 1,
    contractBundle,
  });
  const matchComponent = buildProvisionComponent({
    source: sourceContext,
    parentProvision: matchProvision,
    span: spans.match_clause,
    componentKey: 'MATCH_PERIOD_LIMB',
    ordinal: 1,
    contractBundle,
  });
  const noticeClaim = durationClaim({
    component: noticeComponent,
    clauseExcerpt: excerpts.notice_clause,
    clockExcerpt: excerpts.notice_clock,
    definitionKey: 'NO_SHOP_NOTICE_PERIOD_DAYS',
    rawMagnitude: '24',
    rawUnit: 'HOURS',
    dayBasis: 'ELAPSED',
    trigger: 'RECEIPT_OF_COMPETING_PROPOSAL',
    documentOrdinal: sourceContext.source_ordinal,
  });
  const matchClaim = durationClaim({
    component: matchComponent,
    clauseExcerpt: excerpts.match_clause,
    clockExcerpt: excerpts.match_clock,
    definitionKey: 'NO_SHOP_INITIAL_MATCH_PERIOD_DAYS',
    rawMagnitude: '4',
    rawUnit: 'DAYS',
    dayBasis: 'BUSINESS',
    trigger: 'SUPERIOR_PROPOSAL_NOTICE',
    documentOrdinal: sourceContext.source_ordinal,
  });
  const provisions = Object.freeze([noticeProvision, matchProvision]);
  const components = Object.freeze([noticeComponent, matchComponent]);
  const claims = Object.freeze([noticeClaim, matchClaim]);
  const resultInputs = Object.freeze([
    {
      deal_admission_id: sourceContext.deal_admission_id,
      result_key: 'TARGET_NO_SHOP_NOTICE',
      result_version: 1,
      concept_key: 'NOSOL-NOTICE',
      metric_key: 'NO_SHOP_NOTICE_PERIOD_DAYS',
      party: TARGET_PARTY,
      value_slot_key: 'NOTICE_PERIOD',
      ordinal: 0,
      claim: noticeClaim,
      relationships: [],
      composition_scope_closure_id: noticeClaim.scope.scope_closure_id,
      completeness: 'COMPLETE',
      comparability: 'COMPARABLE',
    },
    {
      deal_admission_id: sourceContext.deal_admission_id,
      result_key: 'BUYER_INITIAL_MATCH_RIGHT',
      result_version: 1,
      concept_key: 'NOSOL-MATCH',
      metric_key: 'NO_SHOP_INITIAL_MATCH_PERIOD_DAYS',
      party: BUYER_PARTY,
      value_slot_key: 'INITIAL_MATCH_PERIOD',
      ordinal: 0,
      claim: matchClaim,
      relationships: [],
      composition_scope_closure_id: matchClaim.scope.scope_closure_id,
      completeness: 'COMPLETE',
      comparability: 'COMPARABLE',
    },
  ]);
  const reviewedMappingBody = {
    schema_version: 'REVIEWED_CANONICAL_MAPPING/V1',
    review_version: REVIEW_VERSION,
    document_hash: sourceContext.document_hash,
    canonical_text_id: sourceContext.canonical_text_id,
    governed_parent_intervals: [SECTION_4_3_INTERVAL, NOTICE_INTERVAL, MATCH_INTERVAL],
    governed_evidence_excerpt_ids: Object.values(excerpts).map((item) => item.excerpt_id).sort(),
    canonical_object_ids: [
      ...provisions.map((item) => item.provision_instance_id),
      ...components.map((item) => item.provision_component_id),
      ...claims.map((item) => item.claim_revision_id),
    ].sort(),
  };
  return Object.freeze({
    source_context_id: sourceContext.admitted_semantic_source_context_id,
    corpus_release_id: corpusReleaseId || null,
    spans,
    excerpts,
    provisions,
    components,
    claims,
    relationships: Object.freeze([]),
    resultInputs,
    reviewed_mapping: Object.freeze({
      ...reviewedMappingBody,
      reviewed_mapping_id: contentId('REVIEWED_CANONICAL_MAPPING/V1', reviewedMappingBody),
      canonical_payload_digest: contentId('REVIEWED_CANONICAL_MAPPING_PAYLOAD/V1', reviewedMappingBody),
    }),
  });
}

function validateQxoAdmittedNoShopNoticeSlice({ sourceContext, contractBundle, slice } = {}) {
  const expected = buildQxoAdmittedNoShopNoticeSlice({
    sourceContext,
    contractBundle,
    corpusReleaseId: slice?.corpus_release_id,
  });
  if (canonicalJson(slice) !== canonicalJson(expected)) {
    throw new TypeError('reviewed QXO no-shop mapping identity or source binding has drifted');
  }
  return true;
}

module.exports = {
  DEAL_KEY,
  MATCH_INTERVAL,
  NOTICE_INTERVAL,
  REVIEW_VERSION,
  SECTION_4_3_INTERVAL,
  buildQxoAdmittedNoShopNoticeSlice,
  validateQxoAdmittedNoShopNoticeSlice,
};
