const { canonicalJson, contentId, sha256Hex } = require('./canonical-bytes');
const { buildClaimRevision } = require('./claims-relationships');
const { normaliseDurationToDays } = require('./observation-normalisers');
const {
  buildExcerpt,
  buildProvisionComponent,
  buildProvisionInstance,
  buildSemanticSpan,
} = require('./source-structure');

const REVIEW_VERSION = 'QXO_ADMITTED_NO_SHOP_REMATCH/V1';
const DEAL_KEY = 'deal:qxo-topbuild';
const SECTION_4_3_INTERVAL = Object.freeze({ start: 201370, end: 226862 });
const SECTION_4_3_SHA256 = 'ffbffb81e798af99509dd998c5a5793c2127eaf3ada937ae662306e99a86c524';
const CLAUSE_START = '(4) in the event of each and every change to any of the financial terms (including the form, amount and timing of payment of consideration) or any other material terms of such Company Superior Proposal';
const CLAUSE_END = '; and provided, further, that the Company and its Affiliates';
const NEXT_LIMB = '(ii)Notwithstanding anything to the contrary set forth in this Agreement, prior to the Company Stockholder Approval';
const CLOCK_TEXT = 'a new four (4) business day notice period';
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
    || bytes.length < SECTION_4_3_INTERVAL.end
    || sha256Hex(bytes.subarray(SECTION_4_3_INTERVAL.start, SECTION_4_3_INTERVAL.end)) !== SECTION_4_3_SHA256) {
    throw new TypeError('admitted QXO Section 4.3 source has drifted');
  }
}

function uniqueByteIndex(buffer, needle, label, from = 0, before = buffer.length) {
  const token = Buffer.from(needle, 'utf8');
  const starts = [];
  let cursor = from;
  while (cursor < before) {
    const start = buffer.indexOf(token, cursor);
    if (start < 0 || start + token.length > before) break;
    starts.push(start);
    cursor = start + token.length;
  }
  if (starts.length !== 1) throw new TypeError(`reviewed ${label} selector is missing or ambiguous`);
  return { start: starts[0], byteLength: token.length };
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

function completeScope(excerpts) {
  const intervalIds = excerpts.map((excerpt) => excerpt.excerpt_id).sort();
  return {
    scope_closure_id: contentId('CLAIM_SCOPE_CLOSURE/V1', {
      review_version: REVIEW_VERSION,
      label: 'NO_SHOP_SUBSEQUENT_MATCH_PERIOD_DAYS',
      interval_ids: intervalIds,
    }),
    coverage_status: 'COMPLETE',
    required_interval_ids: intervalIds,
    examined_interval_ids: intervalIds,
  };
}

function buildQxoAdmittedNoShopRematchSlice({ sourceContext, contractBundle, corpusReleaseId } = {}) {
  validateSourceContext(sourceContext);
  if (!contractBundle?.fingerprint
    || !contractBundle.concepts.some((concept) => concept.concept_key === 'NOSOL-REMATCH')) {
    throw new TypeError('the frozen subsequent matching concept is required');
  }
  const section = Buffer.from(sourceContext.canonical_text.text, 'utf8')
    .subarray(SECTION_4_3_INTERVAL.start, SECTION_4_3_INTERVAL.end);
  const clauseStart = uniqueByteIndex(section, CLAUSE_START, 'subsequent match clause start').start;
  const nextLimb = uniqueByteIndex(section, NEXT_LIMB, 'subsequent match next limb', clauseStart).start;
  const clauseEndSelector = uniqueByteIndex(
    section,
    CLAUSE_END,
    'subsequent match clause end',
    clauseStart,
    nextLimb,
  );
  const clauseEnd = clauseEndSelector.start + 1;
  const clock = uniqueByteIndex(section, CLOCK_TEXT, 'subsequent match clock', clauseStart, clauseEnd);
  const spans = Object.freeze({
    rematch_clause: buildSemanticSpan(
      sourceContext,
      SECTION_4_3_INTERVAL.start + clauseStart,
      SECTION_4_3_INTERVAL.start + clauseEnd,
    ),
    rematch_clock: buildSemanticSpan(
      sourceContext,
      SECTION_4_3_INTERVAL.start + clock.start,
      SECTION_4_3_INTERVAL.start + clock.start + clock.byteLength,
    ),
  });
  const excerpts = Object.freeze(Object.fromEntries(Object.entries(spans).map(
    ([key, span]) => [key, buildExcerpt({ source: sourceContext, span })],
  )));
  const provision = buildProvisionInstance({
    source: sourceContext,
    span: spans.rematch_clause,
    conceptKey: 'NOSOL-REMATCH',
    party: BUYER_PARTY,
    ordinal: 1,
    contractBundle,
  });
  const component = buildProvisionComponent({
    source: sourceContext,
    parentProvision: provision,
    span: spans.rematch_clause,
    componentKey: 'MATCH_PERIOD_LIMB',
    ordinal: 1,
    contractBundle,
  });
  const normalised = normaliseDurationToDays({
    rawMagnitude: '4',
    rawUnit: 'DAYS',
    dayBasis: 'BUSINESS',
    trigger: 'MATERIAL_AMENDMENT_TO_SUPERIOR_PROPOSAL',
    derivationVersion: REVIEW_VERSION,
  });
  const claim = buildClaimRevision({
    subject_occurrence_id: component.provision_component_id,
    claim_definition_key: 'NO_SHOP_SUBSEQUENT_MATCH_PERIOD_DAYS',
    state: 'PRESENT',
    raw_value: excerpts.rematch_clock.exact_text,
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
      evidence(excerpts.rematch_clause, 'OPERATIVE_TEXT', sourceContext.source_ordinal),
      evidence(excerpts.rematch_clock, 'DERIVATION_INPUT', sourceContext.source_ordinal),
    ],
    scope: completeScope([excerpts.rematch_clause, excerpts.rematch_clock]),
    extraction_version: REVIEW_VERSION,
    normalisation_version: REVIEW_VERSION,
    derivation_version: REVIEW_VERSION,
  });
  const resultInputs = Object.freeze([{
    deal_admission_id: sourceContext.deal_admission_id,
    result_key: 'BUYER_SUBSEQUENT_MATCH_RIGHT',
    result_version: 1,
    concept_key: 'NOSOL-REMATCH',
    metric_key: 'NO_SHOP_SUBSEQUENT_MATCH_PERIOD_DAYS',
    party: BUYER_PARTY,
    value_slot_key: 'SUBSEQUENT_MATCH_PERIOD',
    ordinal: 0,
    claim,
    relationships: [],
    composition_scope_closure_id: claim.scope.scope_closure_id,
    completeness: 'COMPLETE',
    comparability: 'COMPARABLE',
  }]);
  const reviewedMappingBody = {
    schema_version: 'REVIEWED_CANONICAL_MAPPING/V1',
    review_version: REVIEW_VERSION,
    document_hash: sourceContext.document_hash,
    canonical_text_id: sourceContext.canonical_text_id,
    governed_parent_intervals: [SECTION_4_3_INTERVAL, {
      start: spans.rematch_clause.absolute_start,
      end: spans.rematch_clause.absolute_end,
    }],
    governed_evidence_excerpt_ids: Object.values(excerpts).map((excerpt) => excerpt.excerpt_id).sort(),
    canonical_object_ids: [
      provision.provision_instance_id,
      component.provision_component_id,
      claim.claim_revision_id,
    ].sort(),
  };
  return Object.freeze({
    source_context_id: sourceContext.admitted_semantic_source_context_id,
    corpus_release_id: corpusReleaseId || null,
    spans,
    excerpts,
    provisions: Object.freeze([provision]),
    components: Object.freeze([component]),
    claims: Object.freeze([claim]),
    relationships: Object.freeze([]),
    resultInputs,
    reviewed_mapping: Object.freeze({
      ...reviewedMappingBody,
      reviewed_mapping_id: contentId('REVIEWED_CANONICAL_MAPPING/V1', reviewedMappingBody),
      canonical_payload_digest: contentId('REVIEWED_CANONICAL_MAPPING_PAYLOAD/V1', reviewedMappingBody),
    }),
  });
}

function validateQxoAdmittedNoShopRematchSlice({ sourceContext, contractBundle, slice } = {}) {
  const expected = buildQxoAdmittedNoShopRematchSlice({
    sourceContext,
    contractBundle,
    corpusReleaseId: slice?.corpus_release_id,
  });
  if (canonicalJson(slice) !== canonicalJson(expected)) {
    throw new TypeError('reviewed QXO subsequent match mapping identity or source binding has drifted');
  }
  return true;
}

module.exports = {
  DEAL_KEY,
  REVIEW_VERSION,
  SECTION_4_3_INTERVAL,
  buildQxoAdmittedNoShopRematchSlice,
  validateQxoAdmittedNoShopRematchSlice,
};
