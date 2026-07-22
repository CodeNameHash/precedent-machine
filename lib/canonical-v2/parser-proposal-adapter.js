const { canonicalJson, contentId, sha256Hex, utf8ByteLength, utf8Slice } = require('./canonical-bytes');
const { validateContractBundle } = require('./contract-bundle');
const {
  buildSemanticSpan,
  validateFixtureSourceAdmission,
  validateImmutableSource,
} = require('./source-structure');
const { splitDefinitions } = require('../parser-v2/extract');
const { parseStructure } = require('../parser-v2/structural');
const { buildLayers } = require('../parser-v2/text-layers');

const ENVELOPE_KEYS = Object.freeze([
  'schema_version',
  'proposal_envelope_id',
  'canonical_payload_digest',
  'contract_fingerprint',
  'proposal_boundary_definition_id',
  'proposal_boundary_definition_payload_digest',
  'source_admission_manifest_id',
  'source_admission_manifest_payload_digest',
  'immutable_source_document_id',
  'source_content_id',
  'source_occurrence_id',
  'canonical_text_id',
  'document_hash',
  'parser_projection',
  'diagnostics',
  'section_proposals',
  'definition_candidates',
]);

const LEGACY_PROVISION_PROPOSAL_KEYS = Object.freeze([
  'proposal_kind',
  'detector_key',
  'legacy_provision_type_hint',
  'legacy_confidence',
  'section_number',
  'section_title',
  'article_number',
  'article_title',
  'clean_start',
  'clean_end',
  'parser_clean_text_digest',
]);

function requireExactKeys(value, keys, label) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new TypeError(`${label} must be an object`);
  if (canonicalJson(Object.keys(value).sort()) !== canonicalJson([...keys].sort())) {
    throw new TypeError(`${label} fields do not match the frozen proposal boundary`);
  }
}

function byteOffset(text, charOffset) {
  if (!Number.isInteger(charOffset) || charOffset < 0 || charOffset > text.length) {
    throw new TypeError('parser proposal contains an invalid source character offset');
  }
  return utf8ByteLength(text.slice(0, charOffset));
}

function exactAnchor({ source, layers, cleanStart, cleanEnd }) {
  if (!Number.isInteger(cleanStart) || !Number.isInteger(cleanEnd)
    || cleanStart < 0 || cleanEnd <= cleanStart || cleanEnd > layers.cleanText.length) {
    throw new TypeError('parser proposal contains an invalid clean-text interval');
  }
  const rawStart = layers.mapCleanToRaw(cleanStart);
  const rawEnd = layers.mapCleanToRaw(cleanEnd);
  if (!Number.isInteger(rawStart) || !Number.isInteger(rawEnd) || rawEnd <= rawStart) {
    throw new TypeError('parser proposal could not be mapped to admitted source');
  }
  const absoluteStart = byteOffset(source.canonical_text.text, rawStart);
  const absoluteEnd = byteOffset(source.canonical_text.text, rawEnd);
  const span = buildSemanticSpan(source, absoluteStart, absoluteEnd);
  const exactText = utf8Slice(source.canonical_text.text, absoluteStart, absoluteEnd);
  return {
    semantic_span_id: span.semantic_span_id,
    canonical_text_id: span.canonical_text_id,
    absolute_start: span.absolute_start,
    absolute_end: span.absolute_end,
    exact_bytes_digest: span.exact_bytes_digest,
    exact_text: exactText,
    parser_clean_start: cleanStart,
    parser_clean_end: cleanEnd,
    parser_clean_text_digest: sha256Hex(layers.cleanText.slice(cleanStart, cleanEnd)),
  };
}

function validateProposalBoundaryInputs({
  contractBundle,
  source,
  sourceAdmission,
  governedDealKey,
  dealAdmissionId,
}) {
  validateContractBundle(contractBundle);
  validateImmutableSource(source);
  validateFixtureSourceAdmission({
    source,
    admission: sourceAdmission,
    dealKey: governedDealKey,
    dealAdmissionId,
    contractFingerprint: contractBundle.fingerprint,
  });
  const boundary = contractBundle.parser_proposal_boundary_definition;
  if (boundary.canonical_write_permission !== false
    || boundary.absence_decision_permission !== false
    || boundary.comparability_decision_permission !== false
    || boundary.semantic_identity_permission !== false
    || boundary.exact_evidence_required !== true) {
    throw new TypeError('parser proposal boundary grants forbidden canonical authority');
  }
  return boundary;
}

function normaliseLegacyProvisionProposal(proposal) {
  requireExactKeys(proposal, LEGACY_PROVISION_PROPOSAL_KEYS, 'legacy provision proposal');
  if (proposal.proposal_kind !== 'LEGACY_DETERMINISTIC_PROVISION_HINT') {
    throw new TypeError('legacy provision proposal kind is not permitted');
  }
  for (const key of ['detector_key', 'legacy_provision_type_hint']) {
    if (typeof proposal[key] !== 'string' || !proposal[key]) {
      throw new TypeError(`legacy provision proposal ${key} is required`);
    }
  }
  if (!['high', 'medium', 'low'].includes(proposal.legacy_confidence)) {
    throw new TypeError('legacy provision proposal confidence is invalid');
  }
  for (const key of ['section_number', 'section_title', 'article_number', 'article_title']) {
    if (proposal[key] !== null && typeof proposal[key] !== 'string') {
      throw new TypeError(`legacy provision proposal ${key} must be a string or null`);
    }
  }
  if (!Number.isInteger(proposal.clean_start) || !Number.isInteger(proposal.clean_end)) {
    throw new TypeError('legacy provision proposal coordinates must be integers');
  }
  if (!/^[a-f0-9]{64}$/.test(proposal.parser_clean_text_digest || '')) {
    throw new TypeError('legacy provision proposal clean-text digest is invalid');
  }
  return Object.freeze({
    proposal_kind: proposal.proposal_kind,
    detector_key: proposal.detector_key,
    legacy_provision_type_hint: proposal.legacy_provision_type_hint,
    legacy_confidence: proposal.legacy_confidence,
    section_number: proposal.section_number,
    section_title: proposal.section_title,
    article_number: proposal.article_number,
    article_title: proposal.article_title,
    clean_start: proposal.clean_start,
    clean_end: proposal.clean_end,
    parser_clean_text_digest: proposal.parser_clean_text_digest,
  });
}

function compareLegacyProvisionProposals(left, right) {
  const coordinateOrder = left.clean_start - right.clean_start || left.clean_end - right.clean_end;
  if (coordinateOrder !== 0) return coordinateOrder;
  const leftJson = canonicalJson(left);
  const rightJson = canonicalJson(right);
  if (leftJson === rightJson) return 0;
  return leftJson < rightJson ? -1 : 1;
}

function neutralProvisionDigest(proposal) {
  return contentId('LEGACY_PROVISION_HINT_NEUTRAL_PROPOSITION/V1', {
    detector_key: proposal.detector_key,
    legacy_provision_type_hint: proposal.legacy_provision_type_hint,
    legacy_confidence: proposal.legacy_confidence,
    section_number: proposal.section_number,
    section_title: proposal.section_title,
    article_number: proposal.article_number,
    article_title: proposal.article_title,
    clean_start: proposal.clean_start,
    clean_end: proposal.clean_end,
    parser_clean_text_digest: proposal.parser_clean_text_digest,
  });
}

function buildSourceBackedProvisionProposalBatch({
  contract_bundle: contractBundle,
  source,
  source_admission: sourceAdmission,
  governed_deal_key: governedDealKey,
  deal_admission_id: dealAdmissionId,
  legacy_proposals: legacyProposals,
} = {}) {
  const boundary = validateProposalBoundaryInputs({
    contractBundle,
    source,
    sourceAdmission,
    governedDealKey,
    dealAdmissionId,
  });
  if (!Array.isArray(legacyProposals)) throw new TypeError('legacy_proposals must be an array');

  const layers = buildLayers(source.canonical_text.text);
  const ordered = legacyProposals
    .map(normaliseLegacyProvisionProposal)
    .sort(compareLegacyProvisionProposals);
  const proposals = [];
  const quarantinedProposals = [];

  ordered.forEach((proposal, governedOrdinal) => {
    const neutralPropositionDigest = neutralProvisionDigest(proposal);
    let anchor;
    try {
      anchor = exactAnchor({
        source,
        layers,
        cleanStart: proposal.clean_start,
        cleanEnd: proposal.clean_end,
      });
      if (anchor.parser_clean_text_digest !== proposal.parser_clean_text_digest) {
        throw new TypeError('legacy provision proposal clean-text digest does not resolve');
      }
    } catch (error) {
      const quarantineIdentity = {
        source_admission_manifest_id: sourceAdmission.source_admission_manifest_id,
        proposal_kind: proposal.proposal_kind,
        neutral_proposition_digest: neutralPropositionDigest,
        governed_ordinal: governedOrdinal,
        reason_code: 'EXACT_EVIDENCE_UNRESOLVED',
      };
      quarantinedProposals.push(Object.freeze({
        schema_version: 'QUARANTINED_PARSER_PROPOSAL/V1',
        quarantined_parser_proposal_id: contentId('QUARANTINED_PARSER_PROPOSAL/V1', quarantineIdentity),
        ...quarantineIdentity,
        detector_key: proposal.detector_key,
        legacy_provision_type_hint: proposal.legacy_provision_type_hint,
        legacy_confidence: proposal.legacy_confidence,
        section_number: proposal.section_number,
        section_title: proposal.section_title,
        article_number: proposal.article_number,
        article_title: proposal.article_title,
        clean_start: proposal.clean_start,
        clean_end: proposal.clean_end,
        parser_clean_text_digest: proposal.parser_clean_text_digest,
      }));
      return;
    }

    const identity = {
      source_admission_manifest_id: sourceAdmission.source_admission_manifest_id,
      semantic_span_id: anchor.semantic_span_id,
      proposal_kind: proposal.proposal_kind,
      neutral_proposition_digest: neutralPropositionDigest,
      governed_ordinal: governedOrdinal,
    };
    proposals.push(Object.freeze({
      schema_version: 'SOURCE_BACKED_PROVISION_PROPOSAL/V1',
      source_backed_provision_proposal_id: contentId('SOURCE_BACKED_PROVISION_PROPOSAL/V1', identity),
      ...identity,
      detector_key: proposal.detector_key,
      legacy_provision_type_hint: proposal.legacy_provision_type_hint,
      legacy_confidence: proposal.legacy_confidence,
      section_number: proposal.section_number,
      section_title: proposal.section_title,
      article_number: proposal.article_number,
      article_title: proposal.article_title,
      evidence_anchor: anchor,
    }));
  });

  const body = {
    schema_version: 'SOURCE_BACKED_PROVISION_PROPOSAL_BATCH/V1',
    contract_fingerprint: contractBundle.fingerprint,
    proposal_boundary_definition_id: boundary.proposal_boundary_definition_id,
    proposal_boundary_definition_payload_digest: boundary.proposal_boundary_definition_payload_digest,
    source_admission_manifest_id: sourceAdmission.source_admission_manifest_id,
    source_admission_manifest_payload_digest: sourceAdmission.canonical_payload_digest,
    immutable_source_document_id: source.immutable_source_document_id,
    source_content_id: source.source_content_id,
    source_occurrence_id: source.source_occurrence_id,
    canonical_text_id: source.canonical_text_id,
    document_hash: source.document_hash,
    proposals,
    quarantined_proposals: quarantinedProposals,
    diagnostics: {
      legacy_proposal_count: ordered.length,
      source_backed_proposal_count: proposals.length,
      quarantined_proposal_count: quarantinedProposals.length,
      publication_blocked: quarantinedProposals.length > 0,
    },
  };
  return Object.freeze({
    ...body,
    proposal_batch_id: contentId('SOURCE_BACKED_PROVISION_PROPOSAL_BATCH/V1', body),
    canonical_payload_digest: contentId('SOURCE_BACKED_PROVISION_PROPOSAL_BATCH_PAYLOAD/V1', body),
  });
}

function locateDefinitionParts(section, layers) {
  const parts = (splitDefinitions(section.text) || []).filter((part) => part.term !== '_preamble');
  const located = [];
  let cursor = section.startChar;
  for (const part of parts) {
    const start = layers.cleanText.indexOf(part.text, cursor);
    const end = start < 0 ? -1 : start + part.text.length;
    if (start < section.startChar || end > section.endChar) {
      throw new TypeError(`legacy parser definition proposal could not be resolved exactly: ${part.term}`);
    }
    located.push({ ...part, start, end });
    cursor = end;
  }
  return located;
}

function buildSectionProposal({ source, sourceAdmission, section, layers, governedOrdinal }) {
  const anchor = exactAnchor({
    source,
    layers,
    cleanStart: section.startChar,
    cleanEnd: section.endChar,
  });
  const neutralDigest = contentId('STRUCTURAL_SECTION_NEUTRAL_PROPOSAL/V1', {
    section_number: section.number || null,
    section_title: section.title || section.heading || null,
    article_number: section.articleNumber || null,
    article_title: section.articleTitle || null,
    region_type: section.regionType || null,
    parser_clean_text_digest: anchor.parser_clean_text_digest,
  });
  const identity = {
    source_admission_manifest_id: sourceAdmission.source_admission_manifest_id,
    semantic_span_id: anchor.semantic_span_id,
    proposal_kind: 'STRUCTURAL_SECTION',
    neutral_proposal_digest: neutralDigest,
    governed_ordinal: governedOrdinal,
  };
  return {
    schema_version: 'STRUCTURAL_SECTION_PROPOSAL/V1',
    structural_section_proposal_id: contentId('STRUCTURAL_SECTION_PROPOSAL/V1', identity),
    proposal_kind: 'STRUCTURAL_SECTION',
    neutral_proposal_digest: neutralDigest,
    governed_ordinal: governedOrdinal,
    section_number: section.number || null,
    section_title: section.title || section.heading || null,
    article_number: section.articleNumber || null,
    article_title: section.articleTitle || null,
    region_type: section.regionType || null,
    atomic: section.atomic === true,
    evidence_anchor: anchor,
  };
}

function buildDefinitionCandidate({
  source,
  sourceAdmission,
  sectionProposal,
  part,
  layers,
  governedOrdinal,
}) {
  const anchor = exactAnchor({ source, layers, cleanStart: part.start, cleanEnd: part.end });
  const neutralDigest = contentId('DEFINITION_CANDIDATE_NEUTRAL_PROPOSITION/V1', {
    neutral_defined_term: part.term,
    parser_clean_text_digest: anchor.parser_clean_text_digest,
  });
  const identity = {
    source_admission_manifest_id: sourceAdmission.source_admission_manifest_id,
    parent_structural_section_proposal_id: sectionProposal.structural_section_proposal_id,
    semantic_span_id: anchor.semantic_span_id,
    proposal_kind: 'DEFINITION_CANDIDATE',
    neutral_proposition_digest: neutralDigest,
    governed_ordinal: governedOrdinal,
  };
  return {
    schema_version: 'DEFINITION_CANDIDATE_PROPOSAL/V1',
    definition_candidate_proposal_id: contentId('DEFINITION_CANDIDATE_PROPOSAL/V1', identity),
    proposal_kind: 'DEFINITION_CANDIDATE',
    neutral_proposition_digest: neutralDigest,
    parent_structural_section_proposal_id: sectionProposal.structural_section_proposal_id,
    governed_ordinal: governedOrdinal,
    neutral_defined_term: part.term,
    evidence_anchor: anchor,
  };
}

function buildParserProposalEnvelope({
  contract_bundle: contractBundle,
  source,
  source_admission: sourceAdmission,
  governed_deal_key: governedDealKey,
  deal_admission_id: dealAdmissionId,
} = {}) {
  const boundary = validateProposalBoundaryInputs({
    contractBundle,
    source,
    sourceAdmission,
    governedDealKey,
    dealAdmissionId,
  });

  const layers = buildLayers(source.canonical_text.text);
  const parsed = parseStructure(layers.cleanText);
  const parserProjection = {
    source_transform: boundary.source_transform,
    coordinate_space: boundary.coordinate_space,
    raw_utf8_byte_length: source.source_byte_length,
    clean_utf8_byte_length: utf8ByteLength(layers.cleanText),
    clean_text_digest: sha256Hex(layers.cleanText),
    parser_projection_id: contentId('PARSER_V2_TEXT_PROJECTION/V1', {
      source_content_id: source.source_content_id,
      source_occurrence_id: source.source_occurrence_id,
      canonical_text_id: source.canonical_text_id,
      source_transform: boundary.source_transform,
      clean_text_digest: sha256Hex(layers.cleanText),
      clean_utf8_byte_length: utf8ByteLength(layers.cleanText),
    }),
  };

  const orderedSections = [...parsed.sections].sort((left, right) => (
    left.startChar - right.startChar || left.endChar - right.endChar
  ));
  const sectionProposals = orderedSections.map((section, governedOrdinal) => buildSectionProposal({
    source,
    sourceAdmission,
    section,
    layers,
    governedOrdinal,
  }));
  const definitionCandidates = [];
  orderedSections.forEach((section, sectionOrdinal) => {
    const sectionProposal = sectionProposals[sectionOrdinal];
    if (section.regionType !== 'body.section.definition' && section.atomicReason !== 'definitions') return;
    for (const part of locateDefinitionParts(section, layers)) {
      definitionCandidates.push(buildDefinitionCandidate({
        source,
        sourceAdmission,
        sectionProposal,
        part,
        layers,
        governedOrdinal: definitionCandidates.length,
      }));
    }
  });
  const diagnostics = {
    parser_section_count: sectionProposals.length,
    definition_candidate_count: definitionCandidates.length,
    structural_gap_count: Array.isArray(parsed.diagnostics.gaps) ? parsed.diagnostics.gaps.length : 0,
    region_coverage_complete: parsed.diagnostics.regionCoverageComplete === true,
  };
  const envelopeBody = {
    schema_version: 'PARSER_PROPOSAL_ENVELOPE/V1',
    contract_fingerprint: contractBundle.fingerprint,
    proposal_boundary_definition_id: boundary.proposal_boundary_definition_id,
    proposal_boundary_definition_payload_digest: boundary.proposal_boundary_definition_payload_digest,
    source_admission_manifest_id: sourceAdmission.source_admission_manifest_id,
    source_admission_manifest_payload_digest: sourceAdmission.canonical_payload_digest,
    immutable_source_document_id: source.immutable_source_document_id,
    source_content_id: source.source_content_id,
    source_occurrence_id: source.source_occurrence_id,
    canonical_text_id: source.canonical_text_id,
    document_hash: source.document_hash,
    parser_projection: parserProjection,
    diagnostics,
    section_proposals: sectionProposals,
    definition_candidates: definitionCandidates,
  };
  return Object.freeze({
    ...envelopeBody,
    proposal_envelope_id: contentId('PARSER_PROPOSAL_ENVELOPE/V1', envelopeBody),
    canonical_payload_digest: contentId('PARSER_PROPOSAL_ENVELOPE_PAYLOAD/V1', envelopeBody),
  });
}

function validateParserProposalEnvelope({
  envelope,
  contract_bundle: contractBundle,
  source,
  source_admission: sourceAdmission,
  governed_deal_key: governedDealKey,
  deal_admission_id: dealAdmissionId,
} = {}) {
  requireExactKeys(envelope, ENVELOPE_KEYS, 'parser proposal envelope');
  const expected = buildParserProposalEnvelope({
    contract_bundle: contractBundle,
    source,
    source_admission: sourceAdmission,
    governed_deal_key: governedDealKey,
    deal_admission_id: dealAdmissionId,
  });
  if (canonicalJson(envelope) !== canonicalJson(expected)) {
    throw new TypeError('parser proposal envelope identity or exact source mapping mismatch');
  }
  return true;
}

module.exports = {
  buildParserProposalEnvelope,
  buildSourceBackedProvisionProposalBatch,
  validateParserProposalEnvelope,
};
