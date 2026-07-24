const { canonicalJson, contentId, sha256Hex } = require('./canonical-bytes');
const { buildClaimRevision, buildRelationshipRevision } = require('./claims-relationships');
const {
  buildExcerpt,
  buildProvisionComponent,
  buildProvisionInstance,
  buildSemanticSpan,
} = require('./source-structure');

const REVIEW_VERSION = 'QXO_ADMITTED_NO_SHOP_ACTIONS/V1';
const DEAL_KEY = 'deal:qxo-topbuild';
const SECTION_4_3_INTERVAL = Object.freeze({ start: 201370, end: 226862 });
const SECTION_4_3_SHA256 = 'ffbffb81e798af99509dd998c5a5793c2127eaf3ada937ae662306e99a86c524';
const TARGET_PARTY = Object.freeze({ role: 'COVENANT_OBLIGOR', value: 'COMPANY', capacity: 'TARGET' });
const ACTION_CODES = Object.freeze([
  'SOLICIT_ASSIST_INITIATE_ENCOURAGE_OR_FACILITATE',
  'ENTER_CONTINUE_OR_PARTICIPATE_IN_DISCUSSIONS_OR_NEGOTIATIONS',
  'ENTER_ALTERNATIVE_TRANSACTION_AGREEMENT',
  'APPROVE_AUTHORISE_OR_ANNOUNCE_INTENTION',
]);
const PREREQUISITES = Object.freeze([
  Object.freeze({
    code: 'BEFORE_STOCKHOLDER_APPROVAL',
    text: 'prior to the date of the Company Stockholder Approval',
  }),
  Object.freeze({
    code: 'NO_PRIOR_BREACH',
    text: 'did not result from a breach of this Section ‎4.3 by the Company',
  }),
  Object.freeze({
    code: 'CONFIDENTIALITY_AGREEMENT_NO_LESS_FAVOURABLE',
    text: 'no less favorable in any material respect to the Company than those contained in the Confidentiality Agreement',
  }),
  Object.freeze({
    code: 'BUYER_RECEIVES_INFORMATION_CONCURRENTLY',
    text: 'has been previously provided to, or is substantially simultaneously provided to, Parent',
  }),
  Object.freeze({
    code: 'BOARD_GOOD_FAITH_DETERMINATION',
    text: 'if the Company Board determines in good faith',
  }),
  Object.freeze({
    code: 'EXPECTED_TO_LEAD_TO_SUPERIOR_PROPOSAL',
    text: 'constitutes, or could reasonably be expected to lead to, a Company Superior Proposal',
  }),
  Object.freeze({
    code: 'FIDUCIARY_DUTIES_REQUIRE_ACTION',
    text: 'the failure to take such action would reasonably be expected to be inconsistent with the Company Board’s fiduciary duties under applicable Law',
  }),
]);

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

function occurrences(buffer, needle) {
  const token = Buffer.from(needle, 'utf8');
  const starts = [];
  let cursor = 0;
  while (cursor < buffer.length) {
    const start = buffer.indexOf(token, cursor);
    if (start < 0) break;
    starts.push(start);
    cursor = start + token.length;
  }
  return { starts, byteLength: token.length };
}

function uniqueByteIndex(buffer, needle, label, from = 0, before = buffer.length) {
  const matches = occurrences(buffer.subarray(from, before), needle);
  if (matches.starts.length !== 1) throw new TypeError(`reviewed ${label} selector is missing or ambiguous`);
  return { start: from + matches.starts[0], byteLength: matches.byteLength };
}

function sectionSpan(source, start, end) {
  return buildSemanticSpan(source, SECTION_4_3_INTERVAL.start + start, SECTION_4_3_INTERVAL.start + end);
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
  const ids = excerpts.map((excerpt) => excerpt.excerpt_id).sort();
  return {
    scope_closure_id: contentId('CLAIM_SCOPE_CLOSURE/V1', {
      review_version: REVIEW_VERSION,
      label,
      interval_ids: ids,
    }),
    coverage_status: 'COMPLETE',
    required_interval_ids: ids,
    examined_interval_ids: ids,
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

function buildQxoAdmittedNoShopActionsSlice({ sourceContext, contractBundle, corpusReleaseId } = {}) {
  validateSourceContext(sourceContext);
  if (!contractBundle?.fingerprint) throw new TypeError('contractBundle is required');
  const conceptKeys = new Set(contractBundle.concepts.map((item) => item.concept_key));
  if (!conceptKeys.has('NOSOL-PROHIBIT') || !conceptKeys.has('NOSOL-EXCEPT')) {
    throw new TypeError('the frozen no-shop prohibition and exception concepts are required');
  }
  const section = Buffer.from(sourceContext.canonical_text.text, 'utf8')
    .subarray(SECTION_4_3_INTERVAL.start, SECTION_4_3_INTERVAL.end);
  if (sha256Hex(section) !== SECTION_4_3_SHA256) {
    throw new TypeError('reviewed QXO Section 4.3 source has drifted');
  }

  const restrictionStart = uniqueByteIndex(
    section,
    '(ii) from the date hereof until the Titanium Merger Effective Time or, if earlier, the termination of this Agreement in accordance with Article ‎VI, not, directly or indirectly,',
    'no-shop restriction start',
  ).start;
  const restrictionEndSelector = uniqueByteIndex(
    section,
    '. Except to the extent necessary to take any actions',
    'no-shop restriction end',
    restrictionStart,
  );
  const restrictionEnd = restrictionEndSelector.start + 1;
  const actionA = uniqueByteIndex(section, '(A) solicit, initiate or knowingly facilitate or knowingly encourage', 'action A', restrictionStart, restrictionEnd);
  const actionB = uniqueByteIndex(section, '(B) other than informing Persons of the provisions contained in this Section', 'action B', actionA.start, restrictionEnd);
  const actionC = uniqueByteIndex(section, '(C) approve, recommend or enter into, or propose to approve, recommend or enter into', 'action C', actionB.start, restrictionEnd);
  const exceptionStart = uniqueByteIndex(section, '(b)Notwithstanding anything to the contrary contained in Section', 'exception start', restrictionEnd).start;
  const exceptionEnd = uniqueByteIndex(section, '(c)The Company shall promptly', 'exception end', exceptionStart).start;
  const spans = Object.freeze({
    restriction: sectionSpan(sourceContext, restrictionStart, restrictionEnd),
    action_a: sectionSpan(sourceContext, actionA.start, actionB.start),
    action_b: sectionSpan(sourceContext, actionB.start, actionC.start),
    action_c: sectionSpan(sourceContext, actionC.start, restrictionEnd),
    exception: sectionSpan(sourceContext, exceptionStart, exceptionEnd),
    ...Object.fromEntries(PREREQUISITES.map((item, index) => {
      const selector = uniqueByteIndex(section, item.text, `exception prerequisite ${index + 1}`, exceptionStart, exceptionEnd);
      return [`prerequisite_${index + 1}`, sectionSpan(
        sourceContext,
        selector.start,
        selector.start + selector.byteLength,
      )];
    })),
  });
  const excerpts = Object.freeze(Object.fromEntries(
    Object.entries(spans).map(([key, span]) => [key, buildExcerpt({ source: sourceContext, span })]),
  ));
  const prohibitionProvision = buildProvisionInstance({
    source: sourceContext,
    span: spans.restriction,
    conceptKey: 'NOSOL-PROHIBIT',
    party: TARGET_PARTY,
    ordinal: 1,
    contractBundle,
  });
  const exceptionProvision = buildProvisionInstance({
    source: sourceContext,
    span: spans.exception,
    conceptKey: 'NOSOL-EXCEPT',
    party: TARGET_PARTY,
    ordinal: 1,
    contractBundle,
  });
  const actionComponents = ['action_a', 'action_b', 'action_c'].map((key, index) => buildProvisionComponent({
    source: sourceContext,
    parentProvision: prohibitionProvision,
    span: spans[key],
    componentKey: 'RESTRICTED_ACTION',
    ordinal: index + 1,
    contractBundle,
  }));
  const exceptionComponent = buildProvisionComponent({
    source: sourceContext,
    parentProvision: exceptionProvision,
    span: spans.exception,
    componentKey: 'EXCEPTION_LIMB',
    ordinal: 1,
    contractBundle,
  });
  const claimSpecs = [
    { component: actionComponents[0], excerpt: excerpts.action_a, code: ACTION_CODES[0], ordinal: 0 },
    { component: actionComponents[1], excerpt: excerpts.action_b, code: ACTION_CODES[1], ordinal: 0 },
    { component: actionComponents[2], excerpt: excerpts.action_c, code: ACTION_CODES[2], ordinal: 0 },
    { component: actionComponents[2], excerpt: excerpts.action_c, code: ACTION_CODES[3], ordinal: 1 },
  ];
  const actionClaims = Object.freeze(claimSpecs.map((spec) => buildClaimRevision({
    subject_occurrence_id: spec.component.provision_component_id,
    claim_definition_key: 'NO_SHOP_PROHIBITED_ACTION',
    ordinal: spec.ordinal,
    state: 'PRESENT',
    raw_value: spec.excerpt.exact_text,
    canonical_value: spec.code,
    taxonomy_codes: { prohibited_action: spec.code },
    codebooks: { prohibited_action: ACTION_CODES },
    evidence: [
      evidence(excerpts.restriction, 'OPERATIVE_TEXT', sourceContext.source_ordinal),
      evidence(spec.excerpt, 'DERIVATION_INPUT', sourceContext.source_ordinal),
    ],
    scope: completeScope(spec.code, [excerpts.restriction, spec.excerpt]),
    extraction_version: REVIEW_VERSION,
    normalisation_version: REVIEW_VERSION,
    derivation_version: REVIEW_VERSION,
  })));
  const prerequisiteCodes = PREREQUISITES.map((item) => item.code);
  const prerequisiteClaims = Object.freeze(PREREQUISITES.map((item, index) => {
    const excerpt = excerpts[`prerequisite_${index + 1}`];
    return buildClaimRevision({
      subject_occurrence_id: exceptionComponent.provision_component_id,
      claim_definition_key: 'NO_SHOP_EXCEPTION_PREREQUISITE',
      ordinal: index,
      state: 'PRESENT',
      raw_value: excerpt.exact_text,
      canonical_value: item.code,
      taxonomy_codes: { exception_prerequisite: item.code },
      codebooks: { exception_prerequisite: prerequisiteCodes },
      evidence: [evidence(excerpt, 'EXCEPTION', sourceContext.source_ordinal)],
      scope: completeScope(item.code, [excerpt]),
      extraction_version: REVIEW_VERSION,
      normalisation_version: REVIEW_VERSION,
      derivation_version: REVIEW_VERSION,
    });
  }));
  const relationshipSpecs = [
    {
      component: actionComponents[0],
      actionExcerpt: excerpts.action_a,
      legalOperation: 'PERMITS_LIMITED_INFORMATION_SHARING',
      permittedAction: 'PROVIDE_INFORMATION',
    },
    {
      component: actionComponents[1],
      actionExcerpt: excerpts.action_b,
      legalOperation: 'PERMITS_DISCUSSIONS_OR_NEGOTIATIONS',
      permittedAction: 'DISCUSS_OR_NEGOTIATE',
    },
  ];
  const relationships = Object.freeze(relationshipSpecs.map((spec) => buildRelationshipRevision({
    source_occurrence_id: spec.component.provision_component_id,
    relationship_definition_key: 'EXCEPTED_BY',
    state: 'PRESENT',
    raw_scope: excerpts.exception.exact_text,
    target_occurrence_ids: [exceptionComponent.provision_component_id],
    effect: {
      effect_mode: 'TYPED_LEGAL_EFFECT',
      legal_operation: spec.legalOperation,
      permitted_action: spec.permittedAction,
      prerequisites: prerequisiteCodes,
    },
    evidence: [
      evidence(spec.actionExcerpt, 'DERIVATION_INPUT', sourceContext.source_ordinal),
      evidence(excerpts.exception, 'EXCEPTION', sourceContext.source_ordinal),
    ],
    scope: relationshipScope(spec.legalOperation, [spec.actionExcerpt], excerpts.exception),
    resolver_version: REVIEW_VERSION,
  })));
  const relationshipByComponent = new Map(relationships.map((relationship) => [
    relationship.source_occurrence_id,
    relationship,
  ]));
  const resultInputs = Object.freeze(actionClaims.map((claim, index) => {
    const component = claimSpecs[index].component;
    const relationshipsForClaim = relationshipByComponent.has(component.provision_component_id)
      ? [relationshipByComponent.get(component.provision_component_id)]
      : [];
    return {
      deal_admission_id: sourceContext.deal_admission_id,
      result_key: 'TARGET_NO_SHOP_RESTRICTIONS',
      result_version: 1,
      concept_key: 'NOSOL-PROHIBIT',
      metric_key: 'NO_SHOP_PROHIBITED_ACTION',
      party: TARGET_PARTY,
      value_slot_key: 'PROHIBITED_ACTION',
      ordinal: index,
      claim,
      relationships: relationshipsForClaim,
      composition_scope_closure_id: contentId('COMPOSITION_SCOPE_CLOSURE/V1', {
        claim_revision_id: claim.claim_revision_id,
        relationship_revision_ids: relationshipsForClaim.map((relationship) => relationship.relationship_revision_id),
      }),
      completeness: 'COMPLETE',
      comparability: 'COMPARABLE',
    };
  }));
  const provisions = Object.freeze([prohibitionProvision, exceptionProvision]);
  const components = Object.freeze([...actionComponents, exceptionComponent]);
  const claims = Object.freeze([...actionClaims, ...prerequisiteClaims]);
  const reviewedMappingBody = {
    schema_version: 'REVIEWED_CANONICAL_MAPPING/V1',
    review_version: REVIEW_VERSION,
    document_hash: sourceContext.document_hash,
    canonical_text_id: sourceContext.canonical_text_id,
    governed_parent_intervals: [SECTION_4_3_INTERVAL],
    governed_evidence_excerpt_ids: Object.values(excerpts).map((excerpt) => excerpt.excerpt_id).sort(),
    canonical_object_ids: [
      ...provisions.map((item) => item.provision_instance_id),
      ...components.map((item) => item.provision_component_id),
      ...claims.map((item) => item.claim_revision_id),
      ...relationships.map((item) => item.relationship_revision_id),
    ].sort(),
  };
  return Object.freeze({
    source_context_id: sourceContext.admitted_semantic_source_context_id,
    corpus_release_id: corpusReleaseId || null,
    spans,
    excerpts,
    provisions,
    components,
    actionComponents: Object.freeze(actionComponents),
    exceptionComponent,
    claims,
    actionClaims,
    prerequisiteClaims,
    relationships,
    resultInputs,
    reviewed_mapping: Object.freeze({
      ...reviewedMappingBody,
      reviewed_mapping_id: contentId('REVIEWED_CANONICAL_MAPPING/V1', reviewedMappingBody),
      canonical_payload_digest: contentId('REVIEWED_CANONICAL_MAPPING_PAYLOAD/V1', reviewedMappingBody),
    }),
  });
}

function validateQxoAdmittedNoShopActionsSlice({ sourceContext, contractBundle, slice } = {}) {
  const expected = buildQxoAdmittedNoShopActionsSlice({
    sourceContext,
    contractBundle,
    corpusReleaseId: slice?.corpus_release_id,
  });
  if (canonicalJson(slice) !== canonicalJson(expected)) {
    throw new TypeError('reviewed QXO no-shop action mapping identity or source binding has drifted');
  }
  return true;
}

module.exports = {
  ACTION_CODES,
  DEAL_KEY,
  REVIEW_VERSION,
  SECTION_4_3_INTERVAL,
  buildQxoAdmittedNoShopActionsSlice,
  validateQxoAdmittedNoShopActionsSlice,
};
