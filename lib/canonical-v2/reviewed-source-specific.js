const { contentId, utf8ByteLength } = require('./canonical-bytes');
const { validateContractBundle } = require('./contract-bundle');
const {
  buildDefinitionCue,
  buildDefinitionUseCue,
  buildValidatedDefinitionGraph,
} = require('./definition-graph');
const {
  buildReviewedSourceSpecificServingRow,
  validateSharedServingRow,
} = require('./shared-serving-row');
const {
  buildExcerpt,
  buildFixtureSourceAdmission,
  buildImmutableSource,
  buildSemanticSpan,
} = require('./source-structure');

const LANDOS_SOURCE_HASH = 'fa2c0a883c64001e792cbed7b03077cfc4fc31909ac7a1d9e63c0e67b2c233be';
const DEAL_KEY = 'deal:landos-abbvie';
const DISPLAY_LABEL = 'Corrective or preventative actions involving Major Suppliers';
const NON_COMPARABLE_REASON = 'Reviewed source-specific proposition with no governed cross-deal concept in this corpus release.';

const SELECTORS = Object.freeze({
  operative: 'The Company has not, since January 1, 2021, subjected any Major Suppliers to,',
  object: 'any corrective or preventative actions.',
  definition_start: '(i) each supplier who was one (1) of the ten (10) largest suppliers',
  definition_end: '(ii) each, a “Major Supplier”)',
});

function uniqueIndex(text, needle, label, from = 0) {
  const start = text.indexOf(needle, from);
  if (start < 0) throw new TypeError(`${label} was not found in the admitted source`);
  if (text.indexOf(needle, start + 1) >= 0) throw new TypeError(`${label} is ambiguous in the admitted source`);
  return start;
}

function exactSpan(source, startNeedle, endNeedle = startNeedle, from = 0) {
  const text = source.canonical_text.text;
  const startChar = uniqueIndex(text, startNeedle, startNeedle, from);
  const endStart = text.indexOf(endNeedle, startChar);
  if (endStart < 0) throw new TypeError(`${endNeedle} was not found after its governed start`);
  const endChar = endStart + endNeedle.length;
  return buildSemanticSpan(
    source,
    utf8ByteLength(text.slice(0, startChar)),
    utf8ByteLength(text.slice(0, endChar)),
  );
}

function exactContainedSpan(source, containerSpan, startNeedle, endNeedle = startNeedle) {
  const containerText = source.canonical_text.text;
  const exactContainerText = Buffer.from(containerText, 'utf8')
    .subarray(containerSpan.absolute_start, containerSpan.absolute_end)
    .toString('utf8');
  const startChar = uniqueIndex(exactContainerText, startNeedle, startNeedle);
  const endStart = exactContainerText.indexOf(endNeedle, startChar);
  if (endStart < 0) throw new TypeError(`${endNeedle} was not found inside its governed container`);
  const absoluteStart = containerSpan.absolute_start + utf8ByteLength(exactContainerText.slice(0, startChar));
  const absoluteEnd = containerSpan.absolute_start
    + utf8ByteLength(exactContainerText.slice(0, endStart + endNeedle.length));
  return buildSemanticSpan(source, absoluteStart, absoluteEnd);
}

function buildEvidenceReference(excerpt, evidenceRole, governedOrdinal) {
  const body = {
    evidence_role: evidenceRole,
    excerpt_id: excerpt.excerpt_id,
    semantic_span_id: excerpt.ordered_component_assignments[0].semantic_span_id,
    document_hash: excerpt.document_hash,
    absolute_start: excerpt.absolute_start,
    absolute_end: excerpt.absolute_end,
    exact_bytes_digest: excerpt.exact_bytes_digest,
    governed_ordinal: governedOrdinal,
  };
  return Object.freeze({
    evidence_reference_id: contentId('OPEN_WORLD_EVIDENCE_REFERENCE/V1', body),
    ...body,
  });
}

function buildPrimitive({ occurrenceId, primitiveKind, governedOrdinal, rawValue, interpretedValue, evidenceReferenceIds }) {
  const body = {
    primitive_kind: primitiveKind,
    governed_ordinal: governedOrdinal,
    raw_value: rawValue,
    interpreted_value: interpretedValue,
    evidence_reference_ids: evidenceReferenceIds,
  };
  return Object.freeze({
    primitive_id: contentId('OPEN_WORLD_LEGAL_PRIMITIVE/V1', {
      open_world_candidate_occurrence_id: occurrenceId,
      ...body,
    }),
    ...body,
  });
}

function buildReviewedSourceSpecificSlice({ sourceText, contractBundle, corpusReleaseId } = {}) {
  if (typeof sourceText !== 'string' || !sourceText.length) throw new TypeError('sourceText is required');
  validateContractBundle(contractBundle);
  const source = buildImmutableSource({
    sourceBytes: sourceText,
    sourceOccurrenceKey: 'landos-abbvie-merger-agreement',
  });
  if (source.document_hash !== LANDOS_SOURCE_HASH) throw new TypeError('Landos source hash mismatch');
  const dealAdmissionId = contentId('DEAL_ADMISSION/V1', 'landos-abbvie');
  const sourceAdmission = buildFixtureSourceAdmission({
    source,
    dealKey: DEAL_KEY,
    dealAdmissionId,
    contractFingerprint: contractBundle.fingerprint,
  });
  const operativeSpan = exactSpan(source, SELECTORS.operative);
  const objectSpan = exactSpan(source, SELECTORS.object);
  const definitionSpan = exactSpan(source, SELECTORS.definition_start, SELECTORS.definition_end);
  const excerpts = Object.freeze({
    operative: buildExcerpt({ source, span: operativeSpan }),
    object: buildExcerpt({ source, span: objectSpan }),
    definition: buildExcerpt({ source, span: definitionSpan }),
  });
  const definitionCue = buildDefinitionCue({
    source,
    termSpan: exactContainedSpan(source, definitionSpan, 'Major Supplier'),
    bodySpans: [
      exactContainedSpan(
        source,
        definitionSpan,
        SELECTORS.definition_start,
        'as of the date of this Agreement',
      ),
      exactContainedSpan(
        source,
        definitionSpan,
        '(ii) each supplier materially involved',
        'as of the Effective Time',
      ),
    ],
    rawTerm: 'Major Supplier',
    syntacticRole: 'POSTFIX_INLINE',
  });
  const validatedSemanticGraph = buildValidatedDefinitionGraph({
    source,
    definitionCues: [definitionCue],
    definitionUseCues: [
      buildDefinitionUseCue({
        source,
        definitionCue,
        useSpan: exactContainedSpan(source, operativeSpan, 'Major Suppliers'),
        useRole: 'OPERATIVE_REFERENCE',
        ordinal: 0,
      }),
      buildDefinitionUseCue({
        source,
        definitionCue,
        useSpan: definitionCue.term_span,
        useRole: 'DECLARATION_REFERENCE',
        ordinal: 1,
      }),
    ],
  });
  const evidenceReferences = Object.freeze([
    buildEvidenceReference(excerpts.operative, 'OPERATIVE_PROPOSITION', 0),
    buildEvidenceReference(excerpts.object, 'OPERATIVE_PROPOSITION_CONTINUATION', 1),
    buildEvidenceReference(excerpts.definition, 'NESTED_DEFINITION_DEPENDENCY', 2),
  ]);
  const observedPartyTokens = Object.freeze(['Company']);
  const observedPartyTokenDigest = contentId('OBSERVED_PARTY_TOKEN_SET/V1', observedPartyTokens);
  const neutralPropositionDigest = contentId('NEUTRAL_LEGAL_PROPOSITION/V1', {
    subject_role: 'REPRESENTING_ENTITY',
    polarity: 'NEGATIVE',
    predicate: 'SUBJECTED_MAJOR_SUPPLIERS_TO_CORRECTIVE_OR_PREVENTATIVE_ACTIONS',
    temporal_scope: 'SINCE_2021_01_01',
  });
  const orderedPropositionEvidenceReferenceIds = evidenceReferences.slice(0, 2).map((row) => row.evidence_reference_id);
  const candidateId = contentId('NOVEL_CONCEPT_CANDIDATE/V1', {
    schema_version: 'NOVEL_CONCEPT_CANDIDATE/V1',
    candidate_kind: 'CONCEPT',
    document_hash: source.document_hash,
    ordered_proposition_evidence_reference_ids: orderedPropositionEvidenceReferenceIds,
    observed_party_token_digest: observedPartyTokenDigest,
    governed_ordinal: 0,
    neutral_proposition_digest: neutralPropositionDigest,
  });
  const openWorldCandidate = Object.freeze({
    schema_version: 'NOVEL_CONCEPT_CANDIDATE/V1',
    candidate_id: candidateId,
    candidate_kind: 'CONCEPT',
    document_hash: source.document_hash,
    ordered_proposition_evidence_reference_ids: orderedPropositionEvidenceReferenceIds,
    observed_party_token_digest: observedPartyTokenDigest,
    governed_ordinal: 0,
    neutral_proposition_digest: neutralPropositionDigest,
  });
  const candidateOccurrenceBody = {
    schema_version: 'OPEN_WORLD_CANDIDATE_OCCURRENCE/V1',
    candidate_id: candidateId,
    admission_state: 'ADMITTED_SEMANTIC',
    document_hash: source.document_hash,
    ordered_proposition_evidence_reference_ids: orderedPropositionEvidenceReferenceIds,
    observed_party_token_digest: observedPartyTokenDigest,
    governed_ordinal: 0,
    neutral_proposition_digest: neutralPropositionDigest,
  };
  const occurrenceId = contentId('OPEN_WORLD_CANDIDATE_OCCURRENCE/V1', candidateOccurrenceBody);
  const candidateOccurrence = Object.freeze({
    open_world_candidate_occurrence_id: occurrenceId,
    candidate_id: candidateId,
    candidate_kind: 'CONCEPT',
    admission_state: candidateOccurrenceBody.admission_state,
    document_hash: candidateOccurrenceBody.document_hash,
    ordered_proposition_evidence_reference_ids: candidateOccurrenceBody.ordered_proposition_evidence_reference_ids,
    observed_party_token_digest: observedPartyTokenDigest,
    governed_ordinal: candidateOccurrenceBody.governed_ordinal,
    neutral_proposition_digest: neutralPropositionDigest,
  });
  const closureId = contentId('OPEN_WORLD_SEMANTIC_CLOSURE/V1', {
    open_world_candidate_occurrence_id: occurrenceId,
    document_hash: source.document_hash,
  });
  const primitiveEvidence = evidenceReferences.map((row) => row.evidence_reference_id);
  const primitives = Object.freeze([
    buildPrimitive({
      occurrenceId,
      primitiveKind: 'PARTY_TOKEN',
      governedOrdinal: 0,
      rawValue: 'The Company',
      interpretedValue: 'Company is the observed representing entity; no canonical party key is assigned.',
      evidenceReferenceIds: [primitiveEvidence[0]],
    }),
    buildPrimitive({
      occurrenceId,
      primitiveKind: 'OPERATIVE_MODALITY',
      governedOrdinal: 1,
      rawValue: 'has not ... subjected',
      interpretedValue: 'Negative assertion',
      evidenceReferenceIds: [primitiveEvidence[0]],
    }),
    buildPrimitive({
      occurrenceId,
      primitiveKind: 'TIME',
      governedOrdinal: 2,
      rawValue: 'since January 1, 2021',
      interpretedValue: 'Look-back begins 1 January 2021',
      evidenceReferenceIds: [primitiveEvidence[0]],
    }),
    buildPrimitive({
      occurrenceId,
      primitiveKind: 'LEGAL_OBJECT',
      governedOrdinal: 3,
      rawValue: excerpts.object.exact_text,
      interpretedValue: 'Corrective or preventative actions',
      evidenceReferenceIds: [primitiveEvidence[1]],
    }),
    buildPrimitive({
      occurrenceId,
      primitiveKind: 'DEFINITION_DEPENDENCY',
      governedOrdinal: 4,
      rawValue: excerpts.definition.exact_text,
      interpretedValue: 'Major Supplier is an inline nested definition governing the operative proposition.',
      evidenceReferenceIds: [primitiveEvidence[2]],
    }),
  ]);
  const primitiveCollectionDigest = contentId('OPEN_WORLD_PRIMITIVE_COLLECTION/V1', primitives);
  const primitiveCollection = Object.freeze({
    primitive_collection_root_id: contentId('OPEN_WORLD_PRIMITIVE_COLLECTION_ROOT/V1', {
      open_world_candidate_occurrence_id: occurrenceId,
      primitive_collection_digest: primitiveCollectionDigest,
      total: primitives.length,
    }),
    primitive_collection_digest: primitiveCollectionDigest,
    total: primitives.length,
    inline_count: primitives.length,
    overflow_child_collection_key: null,
  });
  const dispositionBody = {
    schema_version: 'OPEN_WORLD_CANDIDATE_FINAL_DISPOSITION/V1',
    open_world_candidate_occurrence_id: occurrenceId,
    disposition_code: 'REVIEWED_SOURCE_SPECIFIC',
    review_state: 'FINAL',
    reviewed_display_label: DISPLAY_LABEL,
    non_comparable_reason: NON_COMPARABLE_REASON,
  };
  const finalDisposition = Object.freeze({
    final_disposition_id: contentId('OPEN_WORLD_CANDIDATE_FINAL_DISPOSITION/V1', dispositionBody),
    disposition_code: dispositionBody.disposition_code,
    review_state: dispositionBody.review_state,
    reviewed_display_label: DISPLAY_LABEL,
    non_comparable_reason: NON_COMPARABLE_REASON,
  });
  const impactBody = {
    schema_version: 'SEMANTIC_IMPACT_CLOSURE/V1',
    open_world_candidate_occurrence_id: occurrenceId,
    impact_value: 'REVIEW_ONLY_SOURCE_SPECIFIC',
    affected_canonical_result_occurrence_ids: [],
    market_authority: 'NO_MARKET_AUTHORITY',
  };
  const semanticImpactClosure = Object.freeze({
    semantic_impact_closure_id: contentId('SEMANTIC_IMPACT_CLOSURE/V1', impactBody),
    impact_value: impactBody.impact_value,
    affected_canonical_result_occurrence_ids: impactBody.affected_canonical_result_occurrence_ids,
    market_authority: impactBody.market_authority,
  });
  const releaseId = corpusReleaseId || contentId('CORPUS_RELEASE/V1', 'landos-reviewed-fixture');
  const frozenPairId = contentId('FROZEN_PAIR/V1', contractBundle.fingerprint);
  const row = buildReviewedSourceSpecificServingRow({
    contract_bundle: contractBundle,
    frozen_pair_id: frozenPairId,
    corpus_release_id: releaseId,
    governed_deal_key: DEAL_KEY,
    deal_admission_id: dealAdmissionId,
    candidate_occurrence: candidateOccurrence,
    final_disposition: finalDisposition,
    observed_party_tokens: observedPartyTokens,
    primitive_collection: primitiveCollection,
    bounded_inline_primitives: primitives,
    semantic_impact_closure: semanticImpactClosure,
    evidence_references: evidenceReferences,
  });
  validateSharedServingRow(row);
  return Object.freeze({
    source,
    sourceAdmission,
    excerpts,
    evidenceReferences,
    openWorldCandidate,
    candidateOccurrence,
    finalDisposition,
    primitiveCollection,
    primitives,
    semanticImpactClosure,
    validatedSemanticGraph,
    closureId,
    row,
  });
}

function buildReviewedSourceSpecificWriteSet({ slice, row = slice?.row } = {}) {
  if (!slice || !row) throw new TypeError('source-specific slice and row are required');
  validateSharedServingRow(row);
  const occurrenceId = slice.candidateOccurrence.open_world_candidate_occurrence_id;
  if (row.row_kind !== 'REVIEWED_SOURCE_SPECIFIC'
    || row.reviewed_source_specific.candidate_occurrence.open_world_candidate_occurrence_id !== occurrenceId) {
    throw new TypeError('source-specific serving row is outside its semantic closure');
  }
  const closureId = slice.closureId;
  return Object.freeze({
    source: slice.source,
    source_admission: slice.sourceAdmission,
    deal: Object.freeze({
      deal_key: DEAL_KEY,
      deal_admission_id: slice.sourceAdmission.deal_admission_id,
      document_hash: slice.source.document_hash,
      dimensions: Object.freeze({
        sector: 'Biopharma',
        buyer: 'AbbVie',
        merger_form: 'Reverse triangular merger',
        adviser_firms: Object.freeze([]),
        lawyers: Object.freeze([]),
        announce_year: 2024,
        deal_value_usd: null,
      }),
    }),
    excerpts: Object.freeze(Object.values(slice.excerpts).map((excerpt) => Object.freeze({ ...excerpt, closure_id: closureId }))),
    provisions: Object.freeze([]),
    components: Object.freeze([]),
    claims: Object.freeze([]),
    relationships: Object.freeze([]),
    validated_semantic_graphs: Object.freeze([Object.freeze({
      ...slice.validatedSemanticGraph,
      closure_id: closureId,
    })]),
    open_world_candidates: Object.freeze([Object.freeze({ ...slice.openWorldCandidate, closure_id: closureId })]),
    open_world_candidate_occurrences: Object.freeze([Object.freeze({
      schema_version: 'OPEN_WORLD_CANDIDATE_OCCURRENCE/V1',
      ...slice.candidateOccurrence,
      closure_id: closureId,
    })]),
    open_world_evidence_references: Object.freeze(slice.evidenceReferences.map((reference) => Object.freeze({
      ...reference,
      open_world_candidate_occurrence_id: occurrenceId,
      canonical_text_id: slice.source.canonical_text_id,
      closure_id: closureId,
    }))),
    open_world_candidate_dispositions: Object.freeze([Object.freeze({
      schema_version: 'OPEN_WORLD_CANDIDATE_FINAL_DISPOSITION/V1',
      open_world_candidate_occurrence_id: occurrenceId,
      ...slice.finalDisposition,
      closure_id: closureId,
    })]),
    open_world_primitives: Object.freeze(slice.primitives.map((primitive) => Object.freeze({
      open_world_candidate_occurrence_id: occurrenceId,
      ...primitive,
      closure_id: closureId,
    }))),
    semantic_impact_closures: Object.freeze([Object.freeze({
      schema_version: 'SEMANTIC_IMPACT_CLOSURE/V1',
      open_world_candidate_occurrence_id: occurrenceId,
      ...slice.semanticImpactClosure,
      closure_id: closureId,
    })]),
    reviewed_source_specific_rows: Object.freeze([Object.freeze({
      reviewed_source_specific_row_serving_key: row.row_serving_key,
      shared_serving_row: row,
      closure_id: closureId,
    })]),
    incomplete_canonical_result_rows: Object.freeze([]),
  });
}

module.exports = {
  DISPLAY_LABEL,
  NON_COMPARABLE_REASON,
  buildReviewedSourceSpecificSlice,
  buildReviewedSourceSpecificWriteSet,
};
