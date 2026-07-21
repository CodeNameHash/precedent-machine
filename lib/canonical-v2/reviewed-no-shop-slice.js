const { contentId, utf8ByteLength } = require('./canonical-bytes');
const { buildClaimRevision, buildRelationshipRevision } = require('./claims-relationships');
const { compileMarketCohortRequest } = require('./market-cohort-query');
const { normaliseDurationToDays } = require('./observation-normalisers');
const { buildParserProposalEnvelope } = require('./parser-proposal-adapter');
const { buildFixtureResultComponent, projectMarketMetricSlot } = require('./serving-projection');
const { buildCanonicalResultServingRow } = require('./shared-serving-row');
const {
  buildExcerpt,
  buildFixtureSourceAdmission,
  buildImmutableSource,
  buildProvisionComponent,
  buildProvisionInstance,
  buildSemanticSpan,
} = require('./source-structure');

const REVIEWED_SOURCE_HASH = 'fa2c0a883c64001e792cbed7b03077cfc4fc31909ac7a1d9e63c0e67b2c233be';
const REVIEW_VERSION = 'LANDOS_NO_SHOP/V1';
const DEAL_KEY = 'deal:landos-abbvie';
const TARGET_PARTY = Object.freeze({ role: 'COVENANT_OBLIGOR', value: 'COMPANY', capacity: 'TARGET' });
const BUYER_PARTY = Object.freeze({ role: 'RIGHT_HOLDER', value: 'PARENT', capacity: 'ACQUIRER' });
const REVIEWED_SECTION = Object.freeze({
  number: '5.3',
  title: 'No Solicitation; Change in Recommendation',
  proposal_id: 'c34b176b12d7732c943f96b4ab0b422b95346ccbf4a5bb5f6cd55485451fd78c',
});

const ACTIONS = Object.freeze([
  Object.freeze({
    start: '1. solicit, knowingly assist, initiate, knowingly encourage, or otherwise knowingly facilitate',
    stop_before: '2. enter into, continue, or otherwise initiate',
    canonical: 'SOLICIT_ASSIST_INITIATE_ENCOURAGE_OR_FACILITATE',
    exception_operation: 'PERMITS_LIMITED_INFORMATION_SHARING',
    permitted_action: 'PROVIDE_INFORMATION',
  }),
  Object.freeze({
    start: '2. enter into, continue, or otherwise initiate, solicit, knowingly',
    stop_before: '3. make a Change in Recommendation;',
    canonical: 'ENTER_CONTINUE_OR_PARTICIPATE_IN_DISCUSSIONS_OR_NEGOTIATIONS',
    exception_operation: 'PERMITS_DISCUSSIONS_OR_NEGOTIATIONS',
    permitted_action: 'DISCUSS_OR_NEGOTIATE',
  }),
  Object.freeze({
    start: '3. make a Change in Recommendation;',
    stop_before: '4. enter into, or publicly propose to enter into',
    canonical: 'CHANGE_RECOMMENDATION',
  }),
  Object.freeze({
    start: '4. enter into, or publicly propose to enter into',
    stop_before: '5. approve, authorize or publicly announce any intention',
    canonical: 'ENTER_ALTERNATIVE_TRANSACTION_AGREEMENT',
    exception_operation: 'PERMITS_CONFIDENTIALITY_AGREEMENT',
    permitted_action: 'ENTER_CONFIDENTIALITY_AGREEMENT',
  }),
  Object.freeze({
    start: '5. approve, authorize or publicly announce any intention to do any of the foregoing.',
    stop_before: '(ii) The Company shall, and shall cause the Company’s Subsidiaries',
    canonical: 'APPROVE_AUTHORISE_OR_ANNOUNCE_INTENTION',
  }),
]);

const EXCEPTION_PREREQUISITES = Object.freeze([
  Object.freeze({
    canonical: 'BEFORE_STOCKHOLDER_APPROVAL',
    text: 'Required Company Stockholder Vote',
  }),
  Object.freeze({
    canonical: 'NO_PRIOR_BREACH',
    text: 'any other provision of this Agreement or the Confidentiality Agreement',
  }),
  Object.freeze({
    canonical: 'CONFIDENTIALITY_AGREEMENT_NO_LESS_FAVOURABLE',
    text: 'Company than those contained in the Confidentiality Agreement',
  }),
  Object.freeze({
    canonical: 'BUYER_RECEIVES_INFORMATION_CONCURRENTLY',
    text: 'already been (or simultaneously be) provided to Parent',
  }),
  Object.freeze({
    canonical: 'BOARD_GOOD_FAITH_DETERMINATION',
    text: 'the Company Board first determines in good faith',
  }),
  Object.freeze({
    canonical: 'EXPECTED_TO_LEAD_TO_SUPERIOR_PROPOSAL',
    text: 'would reasonably be expected to constitute or lead to a Superior Proposal',
  }),
  Object.freeze({
    canonical: 'FIDUCIARY_DUTIES_REQUIRE_ACTION',
    text: 'the failure to take such actions would be inconsistent with its fiduciary duties under applicable Law',
  }),
]);

function uniqueIndex(text, needle, label, from = 0, to = text.length) {
  const start = text.indexOf(needle, from);
  if (start < from || start >= to) throw new TypeError(`reviewed ${label} was not found`);
  const duplicate = text.indexOf(needle, start + 1);
  if (duplicate >= 0 && duplicate < to) throw new TypeError(`reviewed ${label} is ambiguous`);
  return start;
}

function spanFromRange(source, section, startChar, endChar) {
  const text = section.evidence_anchor.exact_text;
  const absoluteStart = section.evidence_anchor.absolute_start + utf8ByteLength(text.slice(0, startChar));
  const absoluteEnd = section.evidence_anchor.absolute_start + utf8ByteLength(text.slice(0, endChar));
  return buildSemanticSpan(source, absoluteStart, absoluteEnd);
}

function selectRegion(source, section, selector, label) {
  const text = section.evidence_anchor.exact_text;
  const start = uniqueIndex(text, selector.start, `${label} start`);
  const stop = uniqueIndex(text, selector.stop_before, `${label} stop`, start + selector.start.length);
  let end = stop;
  while (end > start && /\s/.test(text[end - 1])) end -= 1;
  return spanFromRange(source, section, start, end);
}

function selectChild(source, section, parentSpan, needle, label) {
  const sectionText = section.evidence_anchor.exact_text;
  const parentText = Buffer.from(source.canonical_text.text, 'utf8')
    .subarray(parentSpan.absolute_start, parentSpan.absolute_end)
    .toString('utf8');
  const relativeStart = uniqueIndex(parentText, needle, label);
  const sectionBytePrefix = parentSpan.absolute_start - section.evidence_anchor.absolute_start;
  const sectionCharStart = (() => {
    let chars = 0;
    let bytes = 0;
    for (const character of sectionText) {
      if (bytes === sectionBytePrefix) return chars;
      bytes += Buffer.byteLength(character, 'utf8');
      chars += character.length;
    }
    if (bytes === sectionBytePrefix) return chars;
    throw new TypeError(`reviewed ${label} parent boundary is invalid`);
  })();
  return spanFromRange(
    source,
    section,
    sectionCharStart + relativeStart,
    sectionCharStart + relativeStart + needle.length,
  );
}

function evidence(excerpt, evidenceRole = 'OPERATIVE_TEXT') {
  return {
    evidence_role: evidenceRole,
    excerpt_id: excerpt.excerpt_id,
    document_ordinal: 0,
    absolute_start: excerpt.absolute_start,
    absolute_end: excerpt.absolute_end,
  };
}

function completeScope(excerpt, domain, subject) {
  return {
    scope_closure_id: contentId(`${domain}/V1`, { subject, excerpt_id: excerpt.excerpt_id }),
    coverage_status: 'COMPLETE',
    required_interval_ids: [excerpt.excerpt_id],
    examined_interval_ids: [excerpt.excerpt_id],
  };
}

function buildReviewedNoShopSlice({ sourceText, contractBundle, corpusReleaseId } = {}) {
  if (typeof sourceText !== 'string' || !sourceText.length) throw new TypeError('sourceText is required');
  if (!contractBundle || !contractBundle.fingerprint) throw new TypeError('contractBundle is required');
  const dealAdmissionId = contentId('DEAL_ADMISSION/V1', 'landos-abbvie');
  const source = buildImmutableSource({
    sourceBytes: sourceText,
    sourceOccurrenceKey: 'landos-abbvie-merger-agreement',
  });
  if (source.document_hash !== REVIEWED_SOURCE_HASH) throw new TypeError('Landos reviewed source hash mismatch');
  const sourceAdmission = buildFixtureSourceAdmission({
    source,
    dealKey: DEAL_KEY,
    dealAdmissionId,
    contractFingerprint: contractBundle.fingerprint,
  });
  const proposalEnvelope = buildParserProposalEnvelope({
    contract_bundle: contractBundle,
    source,
    source_admission: sourceAdmission,
    governed_deal_key: DEAL_KEY,
    deal_admission_id: dealAdmissionId,
  });
  const sectionMatches = proposalEnvelope.section_proposals.filter(
    (row) => row.section_number === REVIEWED_SECTION.number,
  );
  if (sectionMatches.length !== 1) throw new TypeError('reviewed Section 5.3 is missing or ambiguous');
  const section = sectionMatches[0];
  if (section.section_title !== REVIEWED_SECTION.title
    || section.structural_section_proposal_id !== REVIEWED_SECTION.proposal_id) {
    throw new TypeError('reviewed Section 5.3 proposal has drifted');
  }

  const prohibitionSpan = selectRegion(source, section, {
    start: '(a) No Solicitation.',
    stop_before: '(b) Notification of Proposals.',
  }, 'prohibition');
  const actionSpans = ACTIONS.map((action, index) => selectRegion(source, section, action, `action ${index + 1}`));
  const noticeSpan = selectRegion(source, section, {
    start: '(b) Notification of Proposals.',
    stop_before: '(c) Responding to Proposals.',
  }, 'notice');
  const exceptionSpan = selectRegion(source, section, {
    start: '(c) Responding to Proposals.',
    stop_before: '(d) Change in Recommendation; Right to Match.',
  }, 'exception');
  const initialMatchSpan = selectRegion(source, section, {
    start: '4. at least four (4) business days',
    stop_before: '5.\nduring any Matching Period',
  }, 'initial matching period');
  const subsequentMatchSpan = selectRegion(source, section, {
    start: '(iv) Each successive',
    stop_before: '(v) The Company Board shall',
  }, 'subsequent matching period');
  const noticeClockSpan = selectChild(
    source, section, noticeSpan, 'within twenty-four (24) hours', 'notice clock',
  );
  const initialClockSpan = selectChild(
    source, section, initialMatchSpan, 'at least four (4) business days', 'initial match clock',
  );
  const subsequentClockSpan = selectChild(
    source, section, subsequentMatchSpan, 'two (2) business day Matching Period', 'subsequent match clock',
  );
  const prerequisiteSpans = EXCEPTION_PREREQUISITES.map((item, index) => selectChild(
    source, section, exceptionSpan, item.text, `exception prerequisite ${index + 1}`,
  ));

  const allSpans = {
    prohibition: prohibitionSpan,
    notice: noticeSpan,
    exception: exceptionSpan,
    initial_match: initialMatchSpan,
    subsequent_match: subsequentMatchSpan,
    notice_clock: noticeClockSpan,
    initial_match_clock: initialClockSpan,
    subsequent_match_clock: subsequentClockSpan,
  };
  actionSpans.forEach((span, index) => { allSpans[`action_${index + 1}`] = span; });
  prerequisiteSpans.forEach((span, index) => { allSpans[`prerequisite_${index + 1}`] = span; });
  const excerpts = Object.fromEntries(Object.entries(allSpans).map(([key, span]) => [
    key,
    buildExcerpt({ source, span }),
  ]));

  const prohibitionProvision = buildProvisionInstance({
    source, span: prohibitionSpan, conceptKey: 'NOSOL-PROHIBIT', party: TARGET_PARTY, ordinal: 1,
  });
  const exceptionProvision = buildProvisionInstance({
    source, span: exceptionSpan, conceptKey: 'NOSOL-EXCEPT', party: TARGET_PARTY, ordinal: 1,
  });
  const noticeProvision = buildProvisionInstance({
    source, span: noticeSpan, conceptKey: 'NOSOL-NOTICE', party: TARGET_PARTY, ordinal: 1,
  });
  const matchProvision = buildProvisionInstance({
    source, span: initialMatchSpan, conceptKey: 'NOSOL-MATCH', party: BUYER_PARTY, ordinal: 1,
  });
  const rematchProvision = buildProvisionInstance({
    source, span: subsequentMatchSpan, conceptKey: 'NOSOL-REMATCH', party: BUYER_PARTY, ordinal: 1,
  });
  const actionComponents = actionSpans.map((span, index) => buildProvisionComponent({
    source,
    parentProvision: prohibitionProvision,
    span,
    componentKey: 'RESTRICTED_ACTION',
    ordinal: index + 1,
  }));
  const exceptionComponent = buildProvisionComponent({
    source, parentProvision: exceptionProvision, span: exceptionSpan, componentKey: 'EXCEPTION_LIMB', ordinal: 1,
  });
  const noticeComponent = buildProvisionComponent({
    source, parentProvision: noticeProvision, span: noticeSpan, componentKey: 'NOTICE_LIMB', ordinal: 1,
  });
  const matchComponent = buildProvisionComponent({
    source, parentProvision: matchProvision, span: initialMatchSpan, componentKey: 'MATCH_PERIOD_LIMB', ordinal: 1,
  });
  const rematchComponent = buildProvisionComponent({
    source, parentProvision: rematchProvision, span: subsequentMatchSpan, componentKey: 'MATCH_PERIOD_LIMB', ordinal: 1,
  });

  const actionClaims = actionComponents.map((component, index) => {
    const excerpt = excerpts[`action_${index + 1}`];
    return buildClaimRevision({
      subject_occurrence_id: component.provision_component_id,
      claim_definition_key: 'NO_SHOP_PROHIBITED_ACTION',
      state: 'PRESENT',
      raw_value: excerpt.exact_text,
      canonical_value: ACTIONS[index].canonical,
      taxonomy_codes: { prohibited_action: ACTIONS[index].canonical },
      codebooks: { prohibited_action: ACTIONS.map((item) => item.canonical) },
      evidence: [evidence(excerpt)],
      scope: completeScope(excerpt, 'CLAIM_SCOPE_CLOSURE', component.provision_component_id),
      extraction_version: REVIEW_VERSION,
      normalisation_version: REVIEW_VERSION,
      derivation_version: REVIEW_VERSION,
    });
  });
  const prerequisiteClaims = EXCEPTION_PREREQUISITES.map((item, index) => {
    const excerpt = excerpts[`prerequisite_${index + 1}`];
    return buildClaimRevision({
      subject_occurrence_id: exceptionComponent.provision_component_id,
      claim_definition_key: 'NO_SHOP_EXCEPTION_PREREQUISITE',
      ordinal: index,
      state: 'PRESENT',
      raw_value: excerpt.exact_text,
      canonical_value: item.canonical,
      taxonomy_codes: { exception_prerequisite: item.canonical },
      codebooks: { exception_prerequisite: EXCEPTION_PREREQUISITES.map((row) => row.canonical) },
      evidence: [evidence(excerpt, 'EXCEPTION')],
      scope: completeScope(excerpt, 'CLAIM_SCOPE_CLOSURE', `${exceptionComponent.provision_component_id}:${index}`),
      extraction_version: REVIEW_VERSION,
      normalisation_version: REVIEW_VERSION,
      derivation_version: REVIEW_VERSION,
    });
  });

  function durationClaim({ component, claimKey, excerpt, rawMagnitude, rawUnit, dayBasis, trigger }) {
    const normalised = normaliseDurationToDays({
      rawMagnitude, rawUnit, dayBasis, trigger, derivationVersion: REVIEW_VERSION,
    });
    return buildClaimRevision({
      subject_occurrence_id: component.provision_component_id,
      claim_definition_key: claimKey,
      state: 'PRESENT',
      raw_value: excerpt.exact_text,
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
      evidence: [evidence(excerpt)],
      scope: completeScope(excerpt, 'CLAIM_SCOPE_CLOSURE', component.provision_component_id),
      extraction_version: REVIEW_VERSION,
      normalisation_version: REVIEW_VERSION,
      derivation_version: REVIEW_VERSION,
    });
  }

  const durationClaims = {
    notice: durationClaim({
      component: noticeComponent,
      claimKey: 'NO_SHOP_NOTICE_PERIOD_DAYS',
      excerpt: excerpts.notice_clock,
      rawMagnitude: '24',
      rawUnit: 'HOURS',
      dayBasis: 'ELAPSED',
      trigger: 'RECEIPT_OF_COMPETING_PROPOSAL',
    }),
    initial_match: durationClaim({
      component: matchComponent,
      claimKey: 'NO_SHOP_INITIAL_MATCH_PERIOD_DAYS',
      excerpt: excerpts.initial_match_clock,
      rawMagnitude: '4',
      rawUnit: 'DAYS',
      dayBasis: 'BUSINESS',
      trigger: 'SUPERIOR_PROPOSAL_NOTICE',
    }),
    subsequent_match: durationClaim({
      component: rematchComponent,
      claimKey: 'NO_SHOP_SUBSEQUENT_MATCH_PERIOD_DAYS',
      excerpt: excerpts.subsequent_match_clock,
      rawMagnitude: '2',
      rawUnit: 'DAYS',
      dayBasis: 'BUSINESS',
      trigger: 'MATERIAL_AMENDMENT_TO_SUPERIOR_PROPOSAL',
    }),
  };

  const prerequisiteCodes = EXCEPTION_PREREQUISITES.map((item) => item.canonical);
  const actionRelationships = ACTIONS.map((action, index) => {
    if (!action.exception_operation) return null;
    const actionExcerpt = excerpts[`action_${index + 1}`];
    const requiredIds = [actionExcerpt.excerpt_id, excerpts.exception.excerpt_id].sort();
    return buildRelationshipRevision({
      source_occurrence_id: actionComponents[index].provision_component_id,
      relationship_definition_key: 'EXCEPTED_BY',
      state: 'PRESENT',
      raw_scope: excerpts.exception.exact_text,
      target_occurrence_ids: [exceptionComponent.provision_component_id],
      effect: {
        effect_mode: 'TYPED_LEGAL_EFFECT',
        legal_operation: action.exception_operation,
        permitted_action: action.permitted_action,
        prerequisites: prerequisiteCodes,
      },
      evidence: [evidence(actionExcerpt, 'DERIVATION_INPUT'), evidence(excerpts.exception, 'EXCEPTION')],
      scope: {
        scope_closure_id: contentId('RELATIONSHIP_SCOPE_CLOSURE/V1', requiredIds),
        coverage_status: 'COMPLETE',
        required_interval_ids: requiredIds,
        examined_interval_ids: requiredIds,
        target_interval_ids: [excerpts.exception.excerpt_id],
      },
      resolver_version: REVIEW_VERSION,
    });
  }).filter(Boolean);
  const relationshipBySource = new Map(actionRelationships.map((row) => [row.source_occurrence_id, row]));

  const provisions = [prohibitionProvision, exceptionProvision, noticeProvision, matchProvision, rematchProvision];
  const components = [
    ...actionComponents,
    exceptionComponent,
    noticeComponent,
    matchComponent,
    rematchComponent,
  ];
  const claims = [...actionClaims, ...prerequisiteClaims, ...Object.values(durationClaims)];
  const semanticClosureId = contentId('SEMANTIC_CLOSURE/V1', {
    review_version: REVIEW_VERSION,
    source_admission_manifest_id: sourceAdmission.source_admission_manifest_id,
    provision_instance_ids: provisions.map((row) => row.provision_instance_id).sort(),
    provision_component_ids: components.map((row) => row.provision_component_id).sort(),
  });
  const deal = {
    deal_key: DEAL_KEY,
    deal_admission_id: dealAdmissionId,
    document_hash: source.document_hash,
    dimensions: {
      sector: 'Biopharma',
      buyer: 'AbbVie',
      merger_form: 'Reverse triangular merger',
      adviser_firms: [],
      lawyers: [],
      announce_year: 2024,
      deal_value_usd: null,
    },
  };
  const canonicalWriteSet = {
    source,
    source_admission: sourceAdmission,
    deal,
    excerpts: Object.values(excerpts).map((row) => ({ ...row, closure_id: semanticClosureId })),
    provisions: provisions.map((row) => ({ ...row, closure_id: semanticClosureId })),
    components: components.map((row) => ({ ...row, closure_id: semanticClosureId })),
    claims: claims.map((row) => ({ ...row, closure_id: semanticClosureId })),
    relationships: actionRelationships.map((row) => ({ ...row, closure_id: semanticClosureId })),
  };

  const resultSpecs = [
    ...actionClaims.map((claim, index) => ({
      claim,
      relationships: relationshipBySource.has(claim.subject_occurrence_id)
        ? [relationshipBySource.get(claim.subject_occurrence_id)]
        : [],
      result_key: 'TARGET_NO_SHOP_RESTRICTIONS',
      concept_key: 'NOSOL-PROHIBIT',
      metric_key: 'NO_SHOP_PROHIBITED_ACTION',
      party: TARGET_PARTY,
      value_slot_key: 'PROHIBITED_ACTION',
      ordinal: index,
    })),
    {
      claim: durationClaims.notice,
      relationships: [],
      result_key: 'TARGET_NO_SHOP_NOTICE',
      concept_key: 'NOSOL-NOTICE',
      metric_key: 'NO_SHOP_NOTICE_PERIOD_DAYS',
      party: TARGET_PARTY,
      value_slot_key: 'NOTICE_PERIOD',
      ordinal: 0,
    },
    {
      claim: durationClaims.initial_match,
      relationships: [],
      result_key: 'BUYER_INITIAL_MATCH_RIGHT',
      concept_key: 'NOSOL-MATCH',
      metric_key: 'NO_SHOP_INITIAL_MATCH_PERIOD_DAYS',
      party: BUYER_PARTY,
      value_slot_key: 'INITIAL_MATCH_PERIOD',
      ordinal: 0,
    },
    {
      claim: durationClaims.subsequent_match,
      relationships: [],
      result_key: 'BUYER_SUBSEQUENT_MATCH_RIGHT',
      concept_key: 'NOSOL-REMATCH',
      metric_key: 'NO_SHOP_SUBSEQUENT_MATCH_PERIOD_DAYS',
      party: BUYER_PARTY,
      value_slot_key: 'SUBSEQUENT_MATCH_PERIOD',
      ordinal: 0,
    },
  ];
  const releaseId = corpusReleaseId || contentId('CORPUS_RELEASE/V1', 'landos-reviewed-fixture');
  const results = resultSpecs.map((spec) => {
    const compositionScopeClosureId = contentId('COMPOSITION_SCOPE_CLOSURE/V1', {
      claim_revision_id: spec.claim.claim_revision_id,
      relationship_revision_ids: spec.relationships.map((row) => row.relationship_revision_id).sort(),
    });
    const result = buildFixtureResultComponent({
      deal_admission_id: dealAdmissionId,
      result_key: spec.result_key,
      result_version: 1,
      concept_key: spec.concept_key,
      party: spec.party,
      value_slot_key: spec.value_slot_key,
      ordinal: spec.ordinal,
      claim: spec.claim,
      relationships: spec.relationships,
      composition_scope_closure_id: compositionScopeClosureId,
      completeness: 'COMPLETE',
      comparability: 'COMPARABLE',
    });
    const projection = projectMarketMetricSlot({
      contract_bundle: contractBundle,
      release_state: 'CANDIDATE_CERTIFIED',
      corpus_release_id: releaseId,
      deal,
      concept_key: spec.concept_key,
      metric_key: spec.metric_key,
      party: spec.party,
      result,
      claim: spec.claim,
      relationships: spec.relationships,
      value_slot_key: spec.value_slot_key,
      ordinal: spec.ordinal,
    });
    return Object.freeze({ ...spec, result, projection });
  });

  const reviewedMapping = {
    schema_version: 'REVIEWED_CANONICAL_MAPPING/V1',
    review_version: REVIEW_VERSION,
    document_hash: source.document_hash,
    structural_section_proposal_ids: [section.structural_section_proposal_id],
    governed_evidence_excerpt_ids: Object.values(excerpts).map((row) => row.excerpt_id).sort(),
    canonical_object_ids: [
      ...provisions.map((row) => row.provision_instance_id),
      ...components.map((row) => row.provision_component_id),
      ...claims.map((row) => row.claim_revision_id),
      ...actionRelationships.map((row) => row.relationship_revision_id),
    ].sort(),
  };
  return Object.freeze({
    reviewed_mapping: Object.freeze({
      ...reviewedMapping,
      reviewed_mapping_id: contentId('REVIEWED_CANONICAL_MAPPING/V1', reviewedMapping),
      canonical_payload_digest: contentId('REVIEWED_CANONICAL_MAPPING_PAYLOAD/V1', reviewedMapping),
    }),
    source,
    sourceAdmission,
    proposalEnvelope,
    section,
    spans: Object.freeze(allSpans),
    excerpts: Object.freeze(excerpts),
    provisions: Object.freeze(provisions),
    components: Object.freeze(components),
    actionComponents: Object.freeze(actionComponents),
    exceptionComponent,
    actionClaims: Object.freeze(actionClaims),
    prerequisiteClaims: Object.freeze(prerequisiteClaims),
    durationClaims: Object.freeze(durationClaims),
    actionRelationships: Object.freeze(actionRelationships),
    canonicalWriteSet,
    results: Object.freeze(results),
  });
}

function cohortResultFor(results, compiled) {
  const observations = results.map((row) => row.projection.observation);
  const distribution = [...new Set(observations.map((row) => row.canonical_value))]
    .sort()
    .map((canonicalValue) => ({
      canonical_value: canonicalValue,
      subject_count: observations.filter((row) => row.canonical_value === canonicalValue).length,
      deal_count: 1,
    }));
  return {
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
      observation_slots: observations.length,
      excluded_slots: 0,
    },
    distribution,
    exclusions: [],
  };
}

function buildReviewedNoShopServingRows({ slice, contractBundle } = {}) {
  if (!slice || !Array.isArray(slice.results)) throw new TypeError('a reviewed no-shop slice is required');
  const byMetric = new Map();
  for (const row of slice.results) {
    if (!row.projection.observation) throw new TypeError('reviewed no-shop results must be comparable');
    const existing = byMetric.get(row.metric_key) || [];
    existing.push(row);
    byMetric.set(row.metric_key, existing);
  }
  const servingNamespaceId = contentId('SERVING_NAMESPACE/V1', 'landos-reviewed-fixture');
  const frozenPairId = contentId('FROZEN_PAIR/V1', {
    reviewed_mapping_id: slice.reviewed_mapping.reviewed_mapping_id,
    contract_fingerprint: contractBundle.fingerprint,
  });
  const rows = [];
  for (const metricResults of byMetric.values()) {
    const observation = metricResults[0].projection.observation;
    const request = {
      serving_namespace_id: servingNamespaceId,
      corpus_release_id: observation.corpus_release_id,
      contract_fingerprint: contractBundle.fingerprint,
      metric_key: observation.metric_key,
      metric_version: observation.metric_version,
      concept_key: observation.concept_key,
      party: observation.party,
      subject_deal_key: observation.deal_key,
      filters: {},
    };
    const compiled = compileMarketCohortRequest(request);
    const cohortResult = cohortResultFor(metricResults, compiled);
    for (const item of metricResults) {
      rows.push(buildCanonicalResultServingRow({
        contract_bundle: contractBundle,
        frozen_pair_id: frozenPairId,
        projection_output: item.projection,
        cohort_request: request,
        cohort_result: cohortResult,
        result_ordinal: item.ordinal,
      }));
    }
  }
  return Object.freeze(rows);
}

module.exports = {
  buildReviewedNoShopServingRows,
  buildReviewedNoShopSlice,
};
