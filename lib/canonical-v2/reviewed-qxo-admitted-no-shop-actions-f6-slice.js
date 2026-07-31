const {
  buildAdmittedSourceReference,
} = require('./admitted-semantic-source');
const { canonicalJson, contentId, sha256Hex } = require('./canonical-bytes');
const {
  FIXTURE_CONTRACT_FINGERPRINT_V6,
  NO_SHOP_ACTION_CODES_V2,
  validateContractBundle,
} = require('./contract-bundle');
const {
  buildClaimRevision,
  validateClaimRevisionIdentity,
} = require('./claims-relationships');
const {
  buildExcerpt,
  buildProvisionComponent,
  buildProvisionInstance,
  buildSemanticSpan,
} = require('./source-structure');

const REVIEW_VERSION = 'QXO_ADMITTED_NO_SHOP_ACTIONS_F6/V1';
const DEAL_KEY = 'deal:qxo-topbuild';
const DOCUMENT_HASH = 'abba043018410d718c207e7d7a43c9567166f6a10c4c9a6b4b0c8c7761cd6b9d';
const CANONICAL_TEXT_ID = '6a4ba385ae52f0135250abeadf0756c6a7cb79d64a3d98a7fa9d75e42e41b6ac';
const CANONICAL_TEXT_BYTE_LENGTH = 414782;
const TARGET_PARTY = Object.freeze({
  role: 'COVENANT_OBLIGOR',
  value: 'COMPANY',
  capacity: 'TARGET',
});
const GOVERNED_SOURCE_SPANS = Object.freeze({
  restriction: Object.freeze({
    start: 202400,
    end: 203664,
    sha256: 'c304ed0966b8db06fb54de3c24b5c037c3ff18848390f0037d8bd51748456186',
  }),
  exception: Object.freeze({
    start: 205454,
    end: 207783,
    sha256: 'af22a823e5af23092782d8054ff548cd6beb1d99b9f117de43778483cbe71b59',
  }),
  notice: Object.freeze({
    start: 207783,
    end: 208859,
    sha256: '3f6d824c70d4194f63bdc3581987be1965c1bb242461ba7a8735341de4c362d5',
  }),
});
const RETAINED_SOURCE_SPANS = Object.freeze({
  pre_restriction: Object.freeze({
    start: 201370,
    end: 202400,
    sha256: 'd6371497801974cbbe6bd407d948ee9d97b41b42e6a71a9ce2139be5509cde6b',
  }),
  post_restriction_a: Object.freeze({
    start: 203665,
    end: 205454,
    sha256: '75c1adeb3f8f146f30d5c14d11377de9d9ae9c79f05f995836a7259e9e886223',
  }),
  later_notice_c: Object.freeze({
    start: 208859,
    end: 210496,
    sha256: '1bb0fdbf3c24675198260b44df6f85dcbb1d077785951aef15d34e713cc02b4c',
  }),
});

const ACTION_CONTEXT_INTERVALS = Object.freeze({
  GOVERNING_CHAPEAU: Object.freeze({ start: 201405, end: 201556 }),
  CLAUSE_II_CONNECTOR: Object.freeze({ start: 202396, end: 202400 }),
  PREAMBLE: Object.freeze({ start: 202400, end: 202580 }),
  A_OBJECT: Object.freeze({ start: 202705, end: 202861 }),
  B_RECIPIENT_AND_PURPOSE: Object.freeze({ start: 203191, end: 203335 }),
  C_AGREEMENT_OBJECT: Object.freeze({ start: 203425, end: 203563 }),
  C_AGREEMENT_LINK: Object.freeze({ start: 203563, end: 203580 }),
  C_SUPPORT_ACTION_CONNECTOR: Object.freeze({ start: 203580, end: 203603 }),
  C_PROPOSAL_OBJECT: Object.freeze({ start: 203633, end: 203663 }),
});
const RETAINED_RESIDUAL_SPECS = Object.freeze([
  Object.freeze({
    residual_code: 'NO_SHOP_EXPRESS_PERMISSION_RESERVATION_UNTYPED',
    interval: Object.freeze({ start: 201405, end: 201462 }),
  }),
  Object.freeze({
    residual_code: 'NO_SHOP_ACTOR_SCOPE_UNTYPED',
    interval: Object.freeze({ start: 201462, end: 201556 }),
  }),
  Object.freeze({
    residual_code: 'NO_SHOP_CEASE_EXISTING_PROCESS_DUTY_UNMAPPED',
    interval: Object.freeze({ start: 201566, end: 201728 }),
  }),
  Object.freeze({
    residual_code: 'NO_SHOP_RETURN_OR_DESTROY_INFORMATION_DUTY_UNMAPPED',
    interval: Object.freeze({ start: 201734, end: 202195 }),
  }),
  Object.freeze({
    residual_code: 'NO_SHOP_TERMINATE_DATA_ROOM_ACCESS_DUTY_UNMAPPED',
    interval: Object.freeze({ start: 202204, end: 202395 }),
  }),
  Object.freeze({
    residual_code: 'NO_SHOP_TEMPORAL_SCOPE_UNTYPED',
    interval: Object.freeze({ start: 202405, end: 202549 }),
  }),
  Object.freeze({
    residual_code: 'NO_SHOP_DIRECT_OR_INDIRECT_MODE_UNTYPED',
    interval: Object.freeze({ start: 202549, end: 202576 }),
  }),
  Object.freeze({
    residual_code: 'NO_SHOP_ACQUISITION_PROPOSAL_THRESHOLD_UNTYPED',
    interval: Object.freeze({ start: 202705, end: 202861 }),
  }),
  Object.freeze({
    residual_code: 'NO_SHOP_RECIPIENT_AND_PURPOSE_UNTYPED',
    interval: Object.freeze({ start: 203191, end: 203335 }),
  }),
  Object.freeze({
    residual_code: 'NO_SHOP_ALTERNATIVE_AGREEMENT_FORM_ATTRIBUTES_UNTYPED',
    interval: Object.freeze({ start: 203421, end: 203563 }),
  }),
  Object.freeze({
    residual_code: 'NO_SHOP_DGCL_203_WAIVER_METHOD_RELATIONSHIP_UNRESOLVED',
    interval: Object.freeze({ start: 202863, end: 202925 }),
  }),
  Object.freeze({
    residual_code: 'NO_SHOP_POST_RESTRICTION_A_DUTIES_UNMAPPED',
    interval: Object.freeze({ start: 203665, end: 205454 }),
  }),
  Object.freeze({
    residual_code: 'NO_SHOP_LATER_NOTICE_C_DUTIES_UNMAPPED',
    interval: Object.freeze({ start: 208859, end: 210496 }),
  }),
]);

function actionSpec(
  occurrenceKey,
  actionCode,
  sourceLimbCode,
  knowledgeQualifierCode,
  actionIntervals,
  contextIntervalKeys,
  methodOfOccurrenceKeys = [],
) {
  return Object.freeze({
    occurrence_key: occurrenceKey,
    action_code: actionCode,
    source_limb_code: sourceLimbCode,
    knowledge_qualifier_code: knowledgeQualifierCode,
    action_intervals: Object.freeze(actionIntervals.map((interval) => Object.freeze(interval))),
    context_interval_keys: Object.freeze(contextIntervalKeys),
    method_of_occurrence_keys: Object.freeze(methodOfOccurrenceKeys),
  });
}

const ACTION_SPECS = Object.freeze([
  actionSpec('A_SOLICIT', 'SOLICIT_ACQUISITION_INQUIRY_PROPOSAL_OR_OFFER', 'A', 'NONE',
    [{ start: 202584, end: 202591 }], ['PREAMBLE', 'A_OBJECT']),
  actionSpec('A_INITIATE', 'INITIATE_ACQUISITION_INQUIRY_PROPOSAL_OR_OFFER', 'A', 'NONE',
    [{ start: 202593, end: 202601 }], ['PREAMBLE', 'A_OBJECT']),
  actionSpec('A_FACILITATE', 'FACILITATE_ACQUISITION_INQUIRY_PROPOSAL_OR_OFFER', 'A', 'KNOWINGLY',
    [{ start: 202605, end: 202625 }], ['PREAMBLE', 'A_OBJECT']),
  actionSpec('A_ENCOURAGE', 'ENCOURAGE_ACQUISITION_INQUIRY_PROPOSAL_OR_OFFER', 'A', 'KNOWINGLY',
    [{ start: 202629, end: 202648 }], ['PREAMBLE', 'A_OBJECT']),
  actionSpec('A_FURNISH_METHOD', 'FURNISH_NONPUBLIC_INFORMATION', 'A', 'NONE',
    [{ start: 202650, end: 202703 }], ['PREAMBLE', 'A_OBJECT'],
    ['A_FACILITATE', 'A_ENCOURAGE']),
  actionSpec('A_DGCL_203_WAIVER', 'GRANT_DGCL_SECTION_203_WAIVER', 'A', 'NONE',
    [{ start: 202863, end: 202925 }], ['PREAMBLE', 'A_OBJECT']),
  actionSpec('B_ENGAGE_DISCUSSIONS', 'ENGAGE_IN_DISCUSSIONS', 'B', 'NONE',
    [{ start: 203013, end: 203022 }, { start: 203065, end: 203076 }],
    ['PREAMBLE', 'B_RECIPIENT_AND_PURPOSE']),
  actionSpec('B_ENGAGE_NEGOTIATIONS', 'ENGAGE_IN_NEGOTIATIONS', 'B', 'NONE',
    [{ start: 203013, end: 203022 }, { start: 203080, end: 203092 }],
    ['PREAMBLE', 'B_RECIPIENT_AND_PURPOSE']),
  actionSpec('B_CONTINUE_DISCUSSIONS', 'CONTINUE_DISCUSSIONS', 'B', 'NONE',
    [{ start: 203024, end: 203032 }, { start: 203065, end: 203076 }],
    ['PREAMBLE', 'B_RECIPIENT_AND_PURPOSE']),
  actionSpec('B_CONTINUE_NEGOTIATIONS', 'CONTINUE_NEGOTIATIONS', 'B', 'NONE',
    [{ start: 203024, end: 203032 }, { start: 203080, end: 203092 }],
    ['PREAMBLE', 'B_RECIPIENT_AND_PURPOSE']),
  actionSpec('B_PARTICIPATE_DISCUSSIONS', 'PARTICIPATE_IN_DISCUSSIONS', 'B', 'NONE',
    [{ start: 203036, end: 203060 }, { start: 203065, end: 203076 }],
    ['PREAMBLE', 'B_RECIPIENT_AND_PURPOSE']),
  actionSpec('B_PARTICIPATE_NEGOTIATIONS', 'PARTICIPATE_IN_NEGOTIATIONS', 'B', 'NONE',
    [{ start: 203036, end: 203060 }, { start: 203080, end: 203092 }],
    ['PREAMBLE', 'B_RECIPIENT_AND_PURPOSE']),
  actionSpec('B_FURNISH', 'FURNISH_NONPUBLIC_INFORMATION', 'B', 'NONE',
    [{ start: 203107, end: 203141 }], ['PREAMBLE', 'B_RECIPIENT_AND_PURPOSE']),
  actionSpec('B_ACCESS_PROPERTIES', 'AFFORD_ACCESS_TO_PROPERTIES', 'B', 'NONE',
    [{ start: 203145, end: 203161 }, { start: 203162, end: 203172 }],
    ['PREAMBLE', 'B_RECIPIENT_AND_PURPOSE']),
  actionSpec('B_ACCESS_BOOKS', 'AFFORD_ACCESS_TO_BOOKS', 'B', 'NONE',
    [{ start: 203145, end: 203161 }, { start: 203174, end: 203179 }],
    ['PREAMBLE', 'B_RECIPIENT_AND_PURPOSE']),
  actionSpec('B_ACCESS_RECORDS', 'AFFORD_ACCESS_TO_RECORDS', 'B', 'NONE',
    [{ start: 203145, end: 203161 }, { start: 203183, end: 203190 }],
    ['PREAMBLE', 'B_RECIPIENT_AND_PURPOSE']),
  actionSpec('C_APPROVE', 'APPROVE_ALTERNATIVE_AGREEMENT', 'C', 'NONE',
    [{ start: 203343, end: 203350 }],
    ['PREAMBLE', 'C_AGREEMENT_OBJECT', 'C_AGREEMENT_LINK', 'C_PROPOSAL_OBJECT']),
  actionSpec('C_RECOMMEND', 'RECOMMEND_ALTERNATIVE_AGREEMENT', 'C', 'NONE',
    [{ start: 203352, end: 203361 }],
    ['PREAMBLE', 'C_AGREEMENT_OBJECT', 'C_AGREEMENT_LINK', 'C_PROPOSAL_OBJECT']),
  actionSpec('C_ENTER', 'ENTER_ALTERNATIVE_AGREEMENT', 'C', 'NONE',
    [{ start: 203365, end: 203375 }],
    ['PREAMBLE', 'C_AGREEMENT_OBJECT', 'C_AGREEMENT_LINK', 'C_PROPOSAL_OBJECT']),
  actionSpec('C_PROPOSE_APPROVE', 'PROPOSE_TO_APPROVE_ALTERNATIVE_AGREEMENT', 'C', 'NONE',
    [{ start: 203380, end: 203390 }, { start: 203391, end: 203398 }],
    ['PREAMBLE', 'C_AGREEMENT_OBJECT', 'C_AGREEMENT_LINK', 'C_PROPOSAL_OBJECT']),
  actionSpec('C_PROPOSE_RECOMMEND', 'PROPOSE_TO_RECOMMEND_ALTERNATIVE_AGREEMENT', 'C', 'NONE',
    [{ start: 203380, end: 203390 }, { start: 203400, end: 203409 }],
    ['PREAMBLE', 'C_AGREEMENT_OBJECT', 'C_AGREEMENT_LINK', 'C_PROPOSAL_OBJECT']),
  actionSpec('C_PROPOSE_ENTER', 'PROPOSE_TO_ENTER_ALTERNATIVE_AGREEMENT', 'C', 'NONE',
    [{ start: 203380, end: 203390 }, { start: 203413, end: 203423 }],
    ['PREAMBLE', 'C_AGREEMENT_OBJECT', 'C_AGREEMENT_LINK', 'C_PROPOSAL_OBJECT']),
  actionSpec('C_SUPPORT', 'SUPPORT_ACQUISITION_PROPOSAL', 'C', 'NONE',
    [{ start: 203603, end: 203610 }],
    ['PREAMBLE', 'C_SUPPORT_ACTION_CONNECTOR', 'C_PROPOSAL_OBJECT']),
  actionSpec('C_FURTHER', 'FURTHER_ACQUISITION_PROPOSAL', 'C', 'NONE',
    [{ start: 203614, end: 203631 }],
    ['PREAMBLE', 'C_SUPPORT_ACTION_CONNECTOR', 'C_PROPOSAL_OBJECT']),
]);

function freeze(value) {
  if (!value || typeof value !== 'object' || Object.isFrozen(value)) return value;
  Object.values(value).forEach(freeze);
  return Object.freeze(value);
}

function exactBytes(source, interval) {
  return Buffer.from(source.canonical_text.text, 'utf8').subarray(interval.start, interval.end);
}

function exactSpan(source, interval, expectedSha256, label) {
  const bytes = exactBytes(source, interval);
  if (bytes.length !== interval.end - interval.start
    || sha256Hex(bytes) !== expectedSha256) {
    throw new TypeError(`reviewed QXO ${label} source bytes have drifted`);
  }
  return buildSemanticSpan(source, interval.start, interval.end);
}

function uniqueByteOffset(parentBytes, selector, label) {
  const token = Buffer.from(selector, 'utf8');
  const first = parentBytes.indexOf(token);
  if (first < 0 || parentBytes.indexOf(token, first + token.length) >= 0) {
    throw new TypeError(`reviewed QXO ${label} byte selector is missing or ambiguous`);
  }
  return first;
}

function validateSourceContext(source, contractBundle) {
  buildAdmittedSourceReference(source);
  if (source.governed_deal_key !== DEAL_KEY
    || source.document_hash !== DOCUMENT_HASH
    || source.canonical_text_id !== CANONICAL_TEXT_ID
    || source.canonical_text_byte_length !== CANONICAL_TEXT_BYTE_LENGTH
    || source.canonical_text?.canonical_text_id !== CANONICAL_TEXT_ID
    || source.canonical_text_byte_length !== Buffer.byteLength(
      source.canonical_text.text,
      'utf8',
    )) {
    throw new TypeError('admitted QXO source lineage has drifted');
  }
  const expectedDealAdmissionId = contentId('DEAL_ADMISSION/V2', {
    governed_deal_key: DEAL_KEY,
    source_admission_manifest_id: source.source_admission_manifest_id,
    contract_fingerprint: contractBundle.fingerprint,
  });
  if (source.deal_admission_id !== expectedDealAdmissionId) {
    throw new TypeError('QXO deal admission is not bound to the F6 contract');
  }
}

function validateF6Contract(contractBundle) {
  validateContractBundle(contractBundle);
  if (contractBundle.fingerprint !== FIXTURE_CONTRACT_FINGERPRINT_V6) {
    throw new TypeError('the exact frozen F6 contract is required');
  }
  const actionDefinition = contractBundle.claim_definitions.find(
    (entry) => entry.claim_definition_key === 'NO_SHOP_PROHIBITED_ACTION',
  );
  const occurrenceSchema = contractBundle.no_shop_semantic_schema_definitions.find(
    (entry) => entry.semantic_schema_key === 'NO_SHOP_ACTION_OCCURRENCE',
  );
  if (actionDefinition?.version !== 2
    || canonicalJson(actionDefinition.allowed_canonical_values)
      !== canonicalJson(NO_SHOP_ACTION_CODES_V2)
    || occurrenceSchema?.record_schema !== 'NO_SHOP_ACTION_OCCURRENCE/V1') {
    throw new TypeError('the F6 atomic no-shop action contract is incomplete');
  }
  const mappedCodes = [...new Set(ACTION_SPECS.map((entry) => entry.action_code))].sort();
  if (canonicalJson(mappedCodes) !== canonicalJson([...NO_SHOP_ACTION_CODES_V2].sort())) {
    throw new TypeError('the reviewed QXO action map does not cover the F6 action codebook');
  }
}

function evidence(excerpt, role, documentOrdinal) {
  return {
    evidence_role: role,
    excerpt_id: excerpt.excerpt_id,
    document_ordinal: documentOrdinal,
    absolute_start: excerpt.absolute_start,
    absolute_end: excerpt.absolute_end,
  };
}

function orderedUniqueExcerpts(excerpts) {
  return [...new Map(excerpts.map((excerpt) => [excerpt.excerpt_id, excerpt])).values()]
    .sort((a, b) => a.absolute_start - b.absolute_start
      || a.absolute_end - b.absolute_end
      || a.excerpt_id.localeCompare(b.excerpt_id));
}

function scopeForOccurrence(occurrenceKey, excerpts) {
  const intervalIds = excerpts.map((excerpt) => excerpt.excerpt_id);
  return {
    scope_closure_id: contentId('QXO_NO_SHOP_ACTION_SCOPE_CLOSURE/V1', {
      review_version: REVIEW_VERSION,
      occurrence_key: occurrenceKey,
      ordered_evidence_excerpt_ids: intervalIds,
    }),
    coverage_status: 'COMPLETE',
    required_interval_ids: intervalIds,
    examined_interval_ids: intervalIds,
  };
}

function buildQxoAdmittedNoShopActionsF6Slice({
  sourceContext,
  contractBundle,
} = {}) {
  validateF6Contract(contractBundle);
  validateSourceContext(sourceContext, contractBundle);

  const governedSpans = Object.fromEntries(Object.entries(GOVERNED_SOURCE_SPANS).map(
    ([key, pin]) => [key, exactSpan(
      sourceContext,
      { start: pin.start, end: pin.end },
      pin.sha256,
      key,
    )],
  ));
  const retainedSourceSpans = Object.fromEntries(Object.entries(RETAINED_SOURCE_SPANS).map(
    ([key, pin]) => [key, exactSpan(
      sourceContext,
      { start: pin.start, end: pin.end },
      pin.sha256,
      key,
    )],
  ));
  const restrictionBytes = exactBytes(sourceContext, GOVERNED_SOURCE_SPANS.restriction);
  const aStart = uniqueByteOffset(restrictionBytes, '(A)', 'limb A');
  const bStart = uniqueByteOffset(restrictionBytes, '(B)', 'limb B');
  const cStart = uniqueByteOffset(restrictionBytes, '(C)', 'limb C');
  if (aStart < 0 || bStart <= aStart || cStart <= bStart) {
    throw new TypeError('reviewed QXO action limbs have drifted');
  }
  const limbSpans = {
    A: buildSemanticSpan(
      sourceContext,
      GOVERNED_SOURCE_SPANS.restriction.start + aStart,
      GOVERNED_SOURCE_SPANS.restriction.start + bStart,
    ),
    B: buildSemanticSpan(
      sourceContext,
      GOVERNED_SOURCE_SPANS.restriction.start + bStart,
      GOVERNED_SOURCE_SPANS.restriction.start + cStart,
    ),
    C: buildSemanticSpan(
      sourceContext,
      GOVERNED_SOURCE_SPANS.restriction.start + cStart,
      GOVERNED_SOURCE_SPANS.restriction.end,
    ),
  };
  const governedExcerpts = Object.fromEntries(Object.entries(governedSpans).map(
    ([key, span]) => [key, buildExcerpt({ source: sourceContext, span })],
  ));
  const limbExcerpts = Object.fromEntries(Object.entries(limbSpans).map(
    ([key, span]) => [key, buildExcerpt({ source: sourceContext, span })],
  ));
  const retainedResiduals = RETAINED_RESIDUAL_SPECS.map((spec) => {
    const sourceSpan = buildSemanticSpan(
      sourceContext,
      spec.interval.start,
      spec.interval.end,
    );
    const isContained = [
      ...Object.values(retainedSourceSpans),
      governedSpans.restriction,
    ].some((parent) => (
      parent.absolute_start <= sourceSpan.absolute_start
      && parent.absolute_end >= sourceSpan.absolute_end
    ));
    if (!isContained) {
      throw new TypeError(`reviewed QXO ${spec.residual_code} escapes its source parent`);
    }
    const sourceExcerpt = buildExcerpt({ source: sourceContext, span: sourceSpan });
    return freeze({
      schema_version: 'QXO_NO_SHOP_ACTION_RESIDUAL/V1',
      residual_code: spec.residual_code,
      state: 'PENDING_REVIEWED_DISPOSITION',
      publication_effect: 'BLOCK',
      evidence_excerpt_id: sourceExcerpt.excerpt_id,
      absolute_start: sourceExcerpt.absolute_start,
      absolute_end: sourceExcerpt.absolute_end,
      exact_bytes_digest: sourceExcerpt.exact_bytes_digest,
      source_span: sourceSpan,
      source_excerpt: sourceExcerpt,
    });
  });

  const prohibitionProvision = buildProvisionInstance({
    source: sourceContext,
    span: governedSpans.restriction,
    conceptKey: 'NOSOL-PROHIBIT',
    party: TARGET_PARTY,
    ordinal: 1,
    contractBundle,
  });

  const descriptors = ACTION_SPECS.map((spec, governedOrdinal) => {
    const actionSpans = spec.action_intervals.map((interval) => {
      if (interval.start < limbSpans[spec.source_limb_code].absolute_start
        || interval.end > limbSpans[spec.source_limb_code].absolute_end) {
        throw new TypeError(`reviewed QXO ${spec.occurrence_key} action escapes its limb`);
      }
      return buildSemanticSpan(sourceContext, interval.start, interval.end);
    });
    const actionExcerpts = actionSpans.map(
      (span) => buildExcerpt({ source: sourceContext, span }),
    );
    const contextExcerpts = [
      'GOVERNING_CHAPEAU',
      'CLAUSE_II_CONNECTOR',
      ...spec.context_interval_keys,
    ].map((key) => {
      const interval = ACTION_CONTEXT_INTERVALS[key];
      if (!interval) throw new TypeError(`unknown QXO action context interval: ${key}`);
      return buildExcerpt({
        source: sourceContext,
        span: buildSemanticSpan(sourceContext, interval.start, interval.end),
      });
    });
    const sourceExcerpts = orderedUniqueExcerpts([
      ...actionExcerpts,
      ...contextExcerpts,
    ]);
    const component = buildProvisionComponent({
      source: sourceContext,
      parentProvision: prohibitionProvision,
      span: actionSpans[0],
      componentKey: 'RESTRICTED_ACTION',
      ordinal: governedOrdinal + 1,
      contractBundle,
    });
    const occurrenceIdentity = {
      document_hash: sourceContext.document_hash,
      canonical_text_id: sourceContext.canonical_text_id,
      exact_ordered_evidence_spans: sourceExcerpts.map((excerpt) => ({
        absolute_start: excerpt.absolute_start,
        absolute_end: excerpt.absolute_end,
        exact_bytes_digest: excerpt.exact_bytes_digest,
      })),
      concept_key: 'NOSOL-PROHIBIT',
      party: TARGET_PARTY,
      source_limb_code: spec.source_limb_code,
      governed_ordinal: governedOrdinal,
    };
    return {
      spec,
      governedOrdinal,
      actionExcerpts,
      sourceExcerpts,
      component,
      actionOccurrenceId: contentId('NO_SHOP_ACTION_OCCURRENCE/V1', occurrenceIdentity),
    };
  });

  const occurrenceIdByKey = new Map(descriptors.map(
    (descriptor) => [descriptor.spec.occurrence_key, descriptor.actionOccurrenceId],
  ));
  const actionOccurrences = descriptors.map((descriptor) => {
    const methodIds = (descriptor.spec.method_of_occurrence_keys || []).map((key) => {
      const targetId = occurrenceIdByKey.get(key);
      if (!targetId || targetId === descriptor.actionOccurrenceId) {
        throw new TypeError('QXO method-of-action reference is unresolved or cyclic');
      }
      return targetId;
    }).sort();
    if (methodIds.length > 4 || new Set(methodIds).size !== methodIds.length) {
      throw new TypeError('QXO method-of-action references are unbounded or duplicated');
    }
    const scope = scopeForOccurrence(
      descriptor.spec.occurrence_key,
      descriptor.sourceExcerpts,
    );
    const claim = buildClaimRevision({
      subject_occurrence_id: descriptor.actionOccurrenceId,
      claim_definition_key: 'NO_SHOP_PROHIBITED_ACTION',
      claim_definition_version: 2,
      ordinal: 0,
      state: 'PRESENT',
      raw_value: descriptor.actionExcerpts.map((excerpt) => excerpt.exact_text),
      canonical_value: descriptor.spec.action_code,
      attributes: {
        source_limb_code: descriptor.spec.source_limb_code,
        governed_ordinal: descriptor.governedOrdinal,
        knowledge_qualifier_code: descriptor.spec.knowledge_qualifier_code,
        method_of_action_occurrence_ids: methodIds,
      },
      allowed_attributes: [
        'source_limb_code',
        'governed_ordinal',
        'knowledge_qualifier_code',
        'method_of_action_occurrence_ids',
      ],
      taxonomy_codes: { prohibited_action: descriptor.spec.action_code },
      codebooks: { prohibited_action: NO_SHOP_ACTION_CODES_V2 },
      evidence: descriptor.sourceExcerpts.map((excerpt) => evidence(
        excerpt,
        descriptor.actionExcerpts.some(
          (actionExcerpt) => actionExcerpt.excerpt_id === excerpt.excerpt_id,
        ) ? 'DERIVATION_INPUT' : 'OPERATIVE_TEXT',
        sourceContext.source_ordinal,
      )),
      scope,
      extraction_version: REVIEW_VERSION,
      normalisation_version: REVIEW_VERSION,
      derivation_version: REVIEW_VERSION,
    });
    validateClaimRevisionIdentity(claim);
    const revisionBody = {
      action_occurrence_id: descriptor.actionOccurrenceId,
      contract_fingerprint: contractBundle.fingerprint,
      provision_component_id: descriptor.component.provision_component_id,
      claim_revision_id: claim.claim_revision_id,
      action_code: descriptor.spec.action_code,
      party: TARGET_PARTY,
      source_limb_code: descriptor.spec.source_limb_code,
      governed_ordinal: descriptor.governedOrdinal,
      knowledge_qualifier_code: descriptor.spec.knowledge_qualifier_code,
      evidence_excerpt_ids: descriptor.sourceExcerpts.map((excerpt) => excerpt.excerpt_id),
      scope_closure_id: scope.scope_closure_id,
      method_of_action_occurrence_ids: methodIds,
    };
    return freeze({
      schema_version: 'NO_SHOP_ACTION_OCCURRENCE_REVIEW/V1',
      ...revisionBody,
      action_occurrence_revision_id: contentId(
        'NO_SHOP_ACTION_OCCURRENCE_REVIEW/V1',
        revisionBody,
      ),
      occurrence_key: descriptor.spec.occurrence_key,
      claim,
    });
  });
  const inlinePermissionExcerpt = buildExcerpt({
    source: sourceContext,
    span: buildSemanticSpan(sourceContext, 202932, 203013),
  });

  const mappingBody = {
    schema_version: 'QXO_NO_SHOP_ACTIONS_F6_REVIEWED_MAPPING/V1',
    review_version: REVIEW_VERSION,
    authority_scope: 'REVIEWED_QXO_ATOMIC_ACTION_SOURCE_REFERENCES_ONLY',
    contract_fingerprint: contractBundle.fingerprint,
    governed_deal_key: DEAL_KEY,
    deal_admission_id: sourceContext.deal_admission_id,
    source_admission_manifest_id: sourceContext.source_admission_manifest_id,
    document_hash: sourceContext.document_hash,
    canonical_text_id: sourceContext.canonical_text_id,
    governed_source_spans: Object.entries(GOVERNED_SOURCE_SPANS).map(([key, pin]) => ({
      source_span_key: key,
      absolute_start: pin.start,
      absolute_end: pin.end,
      exact_bytes_digest: pin.sha256,
    })),
    ordered_action_occurrence_revision_ids: actionOccurrences.map(
      (occurrence) => occurrence.action_occurrence_revision_id,
    ),
    retained_residuals: retainedResiduals.map((residual) => ({
      schema_version: residual.schema_version,
      residual_code: residual.residual_code,
      state: residual.state,
      publication_effect: residual.publication_effect,
      evidence_excerpt_id: residual.evidence_excerpt_id,
      absolute_start: residual.absolute_start,
      absolute_end: residual.absolute_end,
      exact_bytes_digest: residual.exact_bytes_digest,
    })),
    deferred_semantic_families: [
      {
        family_key: 'NO_SHOP_ACTION_COMPARISON_ROLLUP',
        state: 'NOT_YET_MAPPED',
        blocker_code: 'F6_ROLLUP_SOURCE_BINDING_DEFERRED',
        source_dependency_kind: 'ACTION_OCCURRENCE_REVISION',
        ordered_source_dependency_ids: actionOccurrences.map(
          (occurrence) => occurrence.action_occurrence_revision_id,
        ),
      },
      {
        family_key: 'NO_SHOP_INLINE_PERMISSION_EFFECT',
        state: 'NOT_YET_MAPPED',
        blocker_code: 'F6_INLINE_PERMISSION_SOURCE_BINDING_DEFERRED',
        source_dependency_kind: 'EXCERPT',
        ordered_source_dependency_ids: [inlinePermissionExcerpt.excerpt_id],
      },
      {
        family_key: 'NO_SHOP_EXCEPTION_EFFECT',
        state: 'NOT_YET_MAPPED',
        blocker_code: 'F6_EXCEPTION_SOURCE_BINDING_DEFERRED',
        source_dependency_kind: 'EXCERPT',
        ordered_source_dependency_ids: [governedExcerpts.exception.excerpt_id],
      },
      {
        family_key: 'NO_SHOP_NOTICE_OBLIGATION',
        state: 'NOT_YET_MAPPED',
        blocker_code: 'F6_COMPLETE_NOTICE_SOURCE_BINDING_DEFERRED',
        source_dependency_kind: 'EXCERPT',
        ordered_source_dependency_ids: [governedExcerpts.notice.excerpt_id],
      },
    ],
    status: {
      f6_atomic_action_reference_set_complete: true,
      section_4_3_scope_complete: false,
      publication_blocked: true,
      canonical_write_authority: 'NONE',
      rollup_authority: 'NONE',
      relationship_effect_authority: 'NONE',
      notice_obligation_authority: 'NONE',
      result_authority: 'NONE',
      metric_authority: 'NONE',
      comparability_authority: 'NONE',
      query_authority: 'NONE',
      serving_authority: 'NONE',
      release_authority: 'NONE',
      release_eligible: false,
    },
  };
  const reviewedMapping = freeze({
    ...mappingBody,
    reviewed_mapping_id: contentId(
      'QXO_NO_SHOP_ACTIONS_F6_REVIEWED_MAPPING/V1',
      mappingBody,
    ),
    canonical_payload_digest: contentId(
      'QXO_NO_SHOP_ACTIONS_F6_REVIEWED_MAPPING_PAYLOAD/V1',
      mappingBody,
    ),
  });

  return freeze({
    schema_version: 'QXO_ADMITTED_NO_SHOP_ACTIONS_F6_SLICE/V1',
    source_context_id: sourceContext.admitted_semantic_source_context_id,
    contract_fingerprint: contractBundle.fingerprint,
    governed_spans: governedSpans,
    governed_excerpts: governedExcerpts,
    retained_source_spans: retainedSourceSpans,
    retained_residuals: retainedResiduals,
    deferred_source_excerpts: {
      inline_permission: inlinePermissionExcerpt,
    },
    limb_spans: limbSpans,
    limb_excerpts: limbExcerpts,
    prohibition_provision: prohibitionProvision,
    action_components: descriptors.map((descriptor) => descriptor.component),
    action_occurrences: actionOccurrences,
    reviewed_mapping: reviewedMapping,
  });
}

function validateQxoAdmittedNoShopActionsF6Slice({
  sourceContext,
  contractBundle,
  slice,
} = {}) {
  const expected = buildQxoAdmittedNoShopActionsF6Slice({
    sourceContext,
    contractBundle,
  });
  if (canonicalJson(slice) !== canonicalJson(expected)) {
    throw new TypeError('reviewed QXO F6 action mapping identity or source binding has drifted');
  }
  return true;
}

module.exports = {
  ACTION_SPECS,
  CANONICAL_TEXT_BYTE_LENGTH,
  CANONICAL_TEXT_ID,
  DEAL_KEY,
  DOCUMENT_HASH,
  GOVERNED_SOURCE_SPANS,
  RETAINED_RESIDUAL_SPECS,
  RETAINED_SOURCE_SPANS,
  REVIEW_VERSION,
  TARGET_PARTY,
  buildQxoAdmittedNoShopActionsF6Slice,
  validateQxoAdmittedNoShopActionsF6Slice,
};
