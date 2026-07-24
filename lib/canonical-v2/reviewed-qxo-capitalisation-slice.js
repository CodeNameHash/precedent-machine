const { canonicalJson, contentId, sha256Hex } = require('./canonical-bytes');
const { buildClaimRevision, buildRelationshipRevision } = require('./claims-relationships');
const {
  buildExcerpt,
  buildProvisionComponent,
  buildProvisionInstance,
  buildSemanticSpan,
} = require('./source-structure');

const REVIEW_VERSION = 'QXO_CAPITALISATION_BRING_DOWN/V1';
const DEAL_KEY = 'deal:qxo-topbuild';
const CAPITAL_STRUCTURE_INTERVAL = Object.freeze({ start: 58044, end: 62729 });
const SECTION_5_2_INTERVAL = Object.freeze({ start: 358040, end: 361259 });
const CAPITAL_STRUCTURE_SHA256 = '51a79c16700b236f71fee89b12b863185564d4dd40703f07648ae2904f56528b';
const SECTION_5_2_SEMANTIC_SHA256 = '67f3125386f1ba2502a1d264aacac17b88e073ccf5d54bc770657b86552769eb';
const COMPANY_PARTY = Object.freeze({ role: 'REPRESENTATION_MAKER', value: 'COMPANY', capacity: 'TARGET' });
const BUYER_PARTY = Object.freeze({ role: 'CONDITION_BENEFICIARY', value: 'PARENT', capacity: 'ACQUIRER' });

const LIMB_STARTS = Object.freeze([
  '(i)The authorized capital stock of the Company consists of',
  '(ii)As of April 17, 2026,',
  '(iii)Except for any obligations pursuant to this Agreement,',
  '(iv)Upon any issuance of any Company Shares in accordance with the terms of the A&R 2015 Plan,',
  '(v)There are no voting trusts or other agreements or understandings',
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
    || bytes.length < SECTION_5_2_INTERVAL.end) {
    throw new TypeError('admitted QXO canonical text geometry has drifted');
  }
}

function sectionBytes(source, interval) {
  return Buffer.from(source.canonical_text.text, 'utf8').subarray(interval.start, interval.end);
}

function semanticComparable(text) {
  return text
    .replace(/[\u200b\u200e]/g, '')
    .replace(/\n\s*95\s*\n/g, '\n')
    .replace(/[“”]/g, '"')
    .replace(/\s+/g, ' ')
    .trim();
}

function uniqueByteIndex(buffer, needle, label, from = 0, before = buffer.length) {
  const token = Buffer.from(needle, 'utf8');
  const start = buffer.indexOf(token, from);
  if (start < from || start >= before) throw new TypeError(`reviewed ${label} selector was not found`);
  const duplicate = buffer.indexOf(token, start + token.length);
  if (duplicate >= 0 && duplicate < before) throw new TypeError(`reviewed ${label} selector is ambiguous`);
  return start;
}

function exactSpan(source, parent, relativeStart, relativeEnd) {
  return buildSemanticSpan(source, parent.start + relativeStart, parent.start + relativeEnd);
}

function excerpt(source, span) {
  return buildExcerpt({ source, span });
}

function evidence(item, evidenceRole) {
  return {
    evidence_role: evidenceRole,
    excerpt_id: item.excerpt_id,
    document_ordinal: 0,
    absolute_start: item.absolute_start,
    absolute_end: item.absolute_end,
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

function relationshipScope(label, conditionExcerpts, targetExcerpts) {
  const required = [...conditionExcerpts, ...targetExcerpts].map((item) => item.excerpt_id).sort();
  return {
    scope_closure_id: contentId('RELATIONSHIP_SCOPE_CLOSURE/V1', {
      review_version: REVIEW_VERSION,
      label,
      required_interval_ids: required,
    }),
    coverage_status: 'COMPLETE',
    required_interval_ids: required,
    examined_interval_ids: required,
    target_interval_ids: targetExcerpts.map((item) => item.excerpt_id).sort(),
  };
}

function buildQxoReviewedCapitalisationSlice({ sourceContext, contractBundle, corpusReleaseId } = {}) {
  validateSourceContext(sourceContext);
  if (!contractBundle?.fingerprint) throw new TypeError('contractBundle is required');
  const conceptKeys = new Set(contractBundle.concepts.map((item) => item.concept_key));
  if (!conceptKeys.has('REP-T-CAP') || !conceptKeys.has('COND-B-REP')) {
    throw new TypeError('the frozen capitalisation and buyer bring-down concepts are required');
  }

  const capitalBytes = sectionBytes(sourceContext, CAPITAL_STRUCTURE_INTERVAL);
  if (sha256Hex(capitalBytes) !== CAPITAL_STRUCTURE_SHA256) {
    throw new TypeError('reviewed QXO Section 3.1(b) source has drifted');
  }
  const conditionBytes = sectionBytes(sourceContext, SECTION_5_2_INTERVAL);
  const conditionText = conditionBytes.toString('utf8');
  if (sha256Hex(semanticComparable(conditionText)) !== SECTION_5_2_SEMANTIC_SHA256) {
    throw new TypeError('reviewed QXO Section 5.2 source has drifted');
  }

  const capitalStarts = LIMB_STARTS.map((start, index) => uniqueByteIndex(
    capitalBytes,
    start,
    `Section 3.1(b)(${index + 1})`,
  ));
  const capitalSpans = capitalStarts.map((start, index) => exactSpan(
    sourceContext,
    CAPITAL_STRUCTURE_INTERVAL,
    start,
    index + 1 < capitalStarts.length ? capitalStarts[index + 1] : capitalBytes.length,
  ));

  const subsectionStart = uniqueByteIndex(conditionBytes, '(ii)(A) the representations and warranties', 'Section 5.2(a)(ii)');
  const subsectionEnd = uniqueByteIndex(conditionBytes, '(iii)No Company Material Adverse Effect', 'Section 5.2(a)(iii)');
  const tierBStart = uniqueByteIndex(conditionBytes, '(B) the representations and warranties', 'capitalisation tier B', subsectionStart, subsectionEnd);
  const tierBEnd = uniqueByteIndex(conditionBytes, ', (C) the representations and warranties', 'capitalisation tier C boundary', tierBStart, subsectionEnd);
  const tierCStart = tierBEnd + Buffer.byteLength(', ', 'utf8');
  const tierCEnd = uniqueByteIndex(conditionBytes, ' and (D) any of the other representations', 'other-representations boundary', tierCStart, subsectionEnd);
  const earlierStart = uniqueByteIndex(conditionBytes, 'provided, however, that, with respect to clauses (A), (B), (C) and (D) above,', 'earlier-date proviso', tierCEnd, subsectionEnd);
  const earlierEndText = 'only as of such date or period.';
  const earlierEnd = uniqueByteIndex(conditionBytes, earlierEndText, 'earlier-date ending', earlierStart, subsectionEnd)
    + Buffer.byteLength(earlierEndText, 'utf8');
  const definitionStart = uniqueByteIndex(conditionBytes, 'For purposes of this Agreement, ', 'de minimis definition', earlierEnd, subsectionEnd);
  const definitionEndText = 'as the case may be;';
  const definitionEnd = uniqueByteIndex(conditionBytes, definitionEndText, 'de minimis definition ending', definitionStart, subsectionEnd)
    + Buffer.byteLength(definitionEndText, 'utf8');
  const scrapeStartText = 'disregarding all qualifications or limitations as to ';
  const scrapeEndText = 'Company Material Adverse Effect';
  const scrapeStart = uniqueByteIndex(conditionBytes, scrapeStartText, 'capitalisation materiality scrape', tierCStart, tierCEnd);
  const scrapeEnd = uniqueByteIndex(conditionBytes, scrapeEndText, 'capitalisation materiality scrape ending', scrapeStart, tierCEnd)
    + Buffer.byteLength(scrapeEndText, 'utf8');

  const spans = Object.freeze({
    capital_structure: buildSemanticSpan(sourceContext, CAPITAL_STRUCTURE_INTERVAL.start, CAPITAL_STRUCTURE_INTERVAL.end),
    limb_i: capitalSpans[0],
    limb_ii: capitalSpans[1],
    limb_iii: capitalSpans[2],
    limb_iv: capitalSpans[3],
    limb_v: capitalSpans[4],
    condition: exactSpan(sourceContext, SECTION_5_2_INTERVAL, subsectionStart, subsectionEnd),
    tier_b: exactSpan(sourceContext, SECTION_5_2_INTERVAL, tierBStart, tierBEnd),
    tier_c: exactSpan(sourceContext, SECTION_5_2_INTERVAL, tierCStart, tierCEnd),
    earlier_date: exactSpan(sourceContext, SECTION_5_2_INTERVAL, earlierStart, earlierEnd),
    de_minimis_definition: exactSpan(sourceContext, SECTION_5_2_INTERVAL, definitionStart, definitionEnd),
    materiality_scrape: exactSpan(sourceContext, SECTION_5_2_INTERVAL, scrapeStart, scrapeEnd),
  });
  const excerpts = Object.freeze(Object.fromEntries(Object.entries(spans).map(([key, value]) => [key, excerpt(sourceContext, value)])));

  const representationProvision = buildProvisionInstance({
    source: sourceContext,
    span: spans.capital_structure,
    conceptKey: 'REP-T-CAP',
    party: COMPANY_PARTY,
    ordinal: 1,
    contractBundle,
  });
  const conditionProvision = buildProvisionInstance({
    source: sourceContext,
    span: spans.condition,
    conceptKey: 'COND-B-REP',
    party: BUYER_PARTY,
    ordinal: 1,
    contractBundle,
  });
  const limbKeys = ['limb_i', 'limb_ii', 'limb_iii', 'limb_iv', 'limb_v'];
  const representationComponents = limbKeys.map((key, index) => buildProvisionComponent({
    source: sourceContext,
    parentProvision: representationProvision,
    span: spans[key],
    componentKey: 'REPRESENTATION_LIMB',
    ordinal: index + 1,
    contractBundle,
  }));

  const knowledgeClaims = representationComponents.map((component, index) => buildClaimRevision({
    subject_occurrence_id: component.provision_component_id,
    claim_definition_key: 'KNOWLEDGE_QUALIFIER',
    state: 'ABSENT',
    scope: completeScope(`knowledge-3.1(b)(${index + 1})`, [excerpts[limbKeys[index]]]),
    extraction_version: REVIEW_VERSION,
    normalisation_version: REVIEW_VERSION,
    derivation_version: REVIEW_VERSION,
  }));

  const tierBAccuracyClaim = buildClaimRevision({
    subject_occurrence_id: conditionProvision.provision_instance_id,
    claim_definition_key: 'REPRESENTATION_ACCURACY_STANDARD',
    ordinal: 0,
    state: 'PRESENT',
    raw_value: excerpts.tier_b.exact_text,
    canonical_value: 'MAT_ALL_RESPECTS_DE_MINIMIS',
    taxonomy_codes: { accuracy_standard: 'MAT_ALL_RESPECTS_DE_MINIMIS' },
    codebooks: { accuracy_standard: ['MAT_ALL_RESPECTS_DE_MINIMIS'] },
    evidence: [evidence(excerpts.tier_b, 'OPERATIVE_TEXT')],
    scope: completeScope('capitalisation-tier-b', [excerpts.tier_b, excerpts.earlier_date]),
    extraction_version: REVIEW_VERSION,
    normalisation_version: REVIEW_VERSION,
    derivation_version: REVIEW_VERSION,
  });
  const tierCAccuracyClaim = buildClaimRevision({
    subject_occurrence_id: conditionProvision.provision_instance_id,
    claim_definition_key: 'REPRESENTATION_ACCURACY_STANDARD',
    ordinal: 1,
    state: 'PRESENT',
    raw_value: excerpts.tier_c.exact_text,
    canonical_value: 'MAT_ALL_MATERIAL',
    taxonomy_codes: { accuracy_standard: 'MAT_ALL_MATERIAL' },
    codebooks: { accuracy_standard: ['MAT_ALL_MATERIAL'] },
    evidence: [
      evidence(excerpts.tier_c, 'OPERATIVE_TEXT'),
      evidence(excerpts.materiality_scrape, 'DERIVATION_INPUT'),
    ],
    scope: completeScope('capitalisation-tier-c', [excerpts.tier_c, excerpts.earlier_date]),
    extraction_version: REVIEW_VERSION,
    normalisation_version: REVIEW_VERSION,
    derivation_version: REVIEW_VERSION,
  });
  const exceptionClaim = buildClaimRevision({
    subject_occurrence_id: conditionProvision.provision_instance_id,
    claim_definition_key: 'REPRESENTATION_ACCURACY_EXCEPTION',
    state: 'PRESENT',
    raw_value: excerpts.de_minimis_definition.exact_text,
    canonical_value: 'DE_MINIMIS_INACCURACIES',
    taxonomy_codes: { accuracy_exception: 'DE_MINIMIS_INACCURACIES' },
    codebooks: { accuracy_exception: ['DE_MINIMIS_INACCURACIES'] },
    evidence: [
      evidence(excerpts.tier_b, 'EXCEPTION'),
      evidence(excerpts.de_minimis_definition, 'DEFINITION'),
    ],
    extraction_version: REVIEW_VERSION,
    normalisation_version: REVIEW_VERSION,
    derivation_version: REVIEW_VERSION,
  });

  const tierBTargets = [representationComponents[0], representationComponents[2]];
  const tierBTargetExcerpts = [excerpts.limb_i, excerpts.limb_iii];
  const tierCTargets = [representationComponents[1], representationComponents[3], representationComponents[4]];
  const tierCTargetExcerpts = [excerpts.limb_ii, excerpts.limb_iv, excerpts.limb_v];
  const tierBRelationship = buildRelationshipRevision({
    source_occurrence_id: conditionProvision.provision_instance_id,
    relationship_definition_key: 'BRINGS_DOWN',
    ordinal: 0,
    state: 'PRESENT',
    raw_scope: excerpts.tier_b.exact_text,
    target_occurrence_ids: tierBTargets.map((item) => item.provision_component_id),
    effect: {
      effect_mode: 'TYPED_LEGAL_EFFECT',
      legal_operation: 'TEST_ACCURACY_AT_SIGNING_AND_CLOSING',
      accuracy_standard: 'MAT_ALL_RESPECTS_DE_MINIMIS',
      exception: 'DE_MINIMIS_INACCURACIES',
      time_points: ['SIGNING', 'CLOSING', 'EXPRESS_EARLIER_DATE_IF_APPLICABLE'],
    },
    evidence: [
      ...tierBTargetExcerpts.map((item) => evidence(item, 'DERIVATION_INPUT')),
      evidence(excerpts.tier_b, 'CROSS_REFERENCE'),
      evidence(excerpts.earlier_date, 'EXCEPTION'),
      evidence(excerpts.de_minimis_definition, 'DEFINITION'),
    ],
    scope: relationshipScope('capitalisation-tier-b', [excerpts.tier_b, excerpts.earlier_date, excerpts.de_minimis_definition], tierBTargetExcerpts),
    resolver_version: REVIEW_VERSION,
  });
  const tierCRelationship = buildRelationshipRevision({
    source_occurrence_id: conditionProvision.provision_instance_id,
    relationship_definition_key: 'BRINGS_DOWN',
    ordinal: 1,
    state: 'PRESENT',
    raw_scope: excerpts.tier_c.exact_text,
    target_occurrence_ids: tierCTargets.map((item) => item.provision_component_id),
    effect: {
      effect_mode: 'TYPED_LEGAL_EFFECT',
      legal_operation: 'TEST_ACCURACY_AT_SIGNING_AND_CLOSING',
      accuracy_standard: 'MAT_ALL_MATERIAL',
      exception: null,
      time_points: ['SIGNING', 'CLOSING', 'EXPRESS_EARLIER_DATE_IF_APPLICABLE'],
      materiality_scrape: {
        applied: true,
        disregarded_qualifiers: ['MATERIAL', 'MATERIALITY', 'COMPANY_MATERIAL_ADVERSE_EFFECT'],
      },
    },
    evidence: [
      ...tierCTargetExcerpts.map((item) => evidence(item, 'DERIVATION_INPUT')),
      evidence(excerpts.tier_c, 'CROSS_REFERENCE'),
      evidence(excerpts.materiality_scrape, 'DERIVATION_INPUT'),
      evidence(excerpts.earlier_date, 'EXCEPTION'),
    ],
    scope: relationshipScope('capitalisation-tier-c', [excerpts.tier_c, excerpts.materiality_scrape, excerpts.earlier_date], tierCTargetExcerpts),
    resolver_version: REVIEW_VERSION,
  });

  const relationships = Object.freeze([tierBRelationship, tierCRelationship]);
  const claims = Object.freeze([tierBAccuracyClaim, tierCAccuracyClaim, exceptionClaim, ...knowledgeClaims]);
  const materialityQualifierDefinition = contractBundle.claim_definitions.find(
    (item) => item.claim_definition_key === 'MATERIALITY_QUALIFIER',
  );
  const materialityClaims = Object.freeze([]);
  if (materialityQualifierDefinition) {
    throw new TypeError('MATERIALITY_QUALIFIER is governed but this reviewed slice has no frozen value codebook');
  }

  const resultInputs = Object.freeze([
    {
      deal_admission_id: sourceContext.deal_admission_id,
      result_key: 'TARGET_CAPITALISATION_BRING_DOWN',
      result_version: 1,
      concept_key: 'COND-B-REP',
      party: BUYER_PARTY,
      value_slot_key: 'CAPITALISATION_LIMBS_I_AND_III',
      ordinal: 0,
      claim: tierBAccuracyClaim,
      relationships: [tierBRelationship],
      composition_scope_closure_id: tierBRelationship.scope.scope_closure_id,
      completeness: 'COMPLETE',
      comparability: 'COMPARABLE',
    },
    {
      deal_admission_id: sourceContext.deal_admission_id,
      result_key: 'TARGET_CAPITALISATION_BRING_DOWN',
      result_version: 1,
      concept_key: 'COND-B-REP',
      party: BUYER_PARTY,
      value_slot_key: 'CAPITALISATION_OTHER_LIMBS',
      ordinal: 1,
      claim: tierCAccuracyClaim,
      relationships: [tierCRelationship],
      composition_scope_closure_id: tierCRelationship.scope.scope_closure_id,
      completeness: 'COMPLETE',
      comparability: 'COMPARABLE',
    },
  ]);
  const reviewedMappingBody = {
    schema_version: 'REVIEWED_CANONICAL_MAPPING/V1',
    review_version: REVIEW_VERSION,
    document_hash: sourceContext.document_hash,
    canonical_text_id: sourceContext.canonical_text_id,
    governed_parent_intervals: [CAPITAL_STRUCTURE_INTERVAL, SECTION_5_2_INTERVAL],
    governed_evidence_excerpt_ids: Object.values(excerpts).map((item) => item.excerpt_id).sort(),
    canonical_object_ids: [
      representationProvision.provision_instance_id,
      conditionProvision.provision_instance_id,
      ...representationComponents.map((item) => item.provision_component_id),
      ...claims.map((item) => item.claim_revision_id),
      ...relationships.map((item) => item.relationship_revision_id),
    ].sort(),
  };
  return Object.freeze({
    source_context_id: sourceContext.admitted_semantic_source_context_id,
    corpus_release_id: corpusReleaseId || null,
    spans,
    excerpts,
    provisions: Object.freeze([representationProvision, conditionProvision]),
    components: Object.freeze(representationComponents),
    claims,
    knowledgeClaims: Object.freeze(knowledgeClaims),
    materialityClaims,
    accuracyClaims: Object.freeze([tierBAccuracyClaim, tierCAccuracyClaim]),
    exceptionClaim,
    relationships,
    resultInputs,
    reviewed_mapping: Object.freeze({
      ...reviewedMappingBody,
      reviewed_mapping_id: contentId('REVIEWED_CANONICAL_MAPPING/V1', reviewedMappingBody),
      canonical_payload_digest: contentId('REVIEWED_CANONICAL_MAPPING_PAYLOAD/V1', reviewedMappingBody),
    }),
  });
}

function validateQxoReviewedCapitalisationSlice({ sourceContext, contractBundle, slice } = {}) {
  const expected = buildQxoReviewedCapitalisationSlice({
    sourceContext,
    contractBundle,
    corpusReleaseId: slice?.corpus_release_id,
  });
  if (canonicalJson(slice) !== canonicalJson(expected)) {
    throw new TypeError('reviewed QXO capitalisation mapping identity or source binding has drifted');
  }
  return true;
}

module.exports = {
  CAPITAL_STRUCTURE_INTERVAL,
  DEAL_KEY,
  REVIEW_VERSION,
  SECTION_5_2_INTERVAL,
  buildQxoReviewedCapitalisationSlice,
  validateQxoReviewedCapitalisationSlice,
};
