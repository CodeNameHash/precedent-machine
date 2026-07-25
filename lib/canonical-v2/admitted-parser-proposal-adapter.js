const runtimeManifest = require('../parser-v2/canonical-structural-definitions.manifest.json');
const {
  canonicalJson,
  contentId,
  sha256Hex,
} = require('./canonical-bytes');
const { validateContractBundle } = require('./contract-bundle');
const {
  validateAdmittedSemanticSourceContext,
} = require('./admitted-semantic-source');
const {
  runInRestrictedContext,
} = require('./parser-runtime-sandbox');

const MANIFEST_KEYS = Object.freeze([
  'schema_version',
  'entry_module',
  'local_modules',
  'governed_limits',
  'parser_runtime_manifest_id',
]);
const LIMIT_KEYS = Object.freeze([
  'max_source_bytes',
  'max_sections',
  'max_definitions',
  'max_residuals',
  'max_total_candidates',
  'max_span_bytes',
  'max_envelope_bytes',
  'max_runtime_milliseconds',
]);
const GOVERNED_LIMITS = Object.freeze({
  max_source_bytes: 4194304,
  max_sections: 4096,
  max_definitions: 16384,
  max_residuals: 4096,
  max_total_candidates: 16384,
  max_span_bytes: 2097152,
  max_envelope_bytes: 16777216,
  max_runtime_milliseconds: 5000,
});
const DETECTION_KEYS = Object.freeze([
  'schema_version',
  'sections',
  'definitions',
  'structural_residual_regions',
  'candidate_failures',
  'diagnostics',
]);
const DETECTION_SECTION_KEYS = Object.freeze([
  'section_number',
  'section_title',
  'article_number',
  'article_title',
  'region_type',
  'atomic',
  'atomic_reason',
  'level',
  'clean_start',
  'clean_end',
]);
const DETECTION_DEFINITION_KEYS = Object.freeze([
  'neutral_defined_term',
  'parent_section_index',
  'clean_start',
  'clean_end',
]);
const DETECTION_RESIDUAL_KEYS = Object.freeze([
  'reason_code',
  'region_type',
  'clean_start',
  'clean_end',
]);
const DETECTION_FAILURE_KEYS = Object.freeze([
  'candidate_kind',
  'reason_code',
  'producer_ordinal',
  'clean_start',
  'clean_end',
]);
const DETECTION_DIAGNOSTIC_KEYS = Object.freeze([
  'body_start',
  'body_end',
  'section_count',
  'article_count',
  'delimiter',
  'numbered_section_gap_count',
  'region_coverage_complete',
  'region_coverage_gap_count',
  'region_coverage_overlap_count',
  'exact_duplicate_region_count',
  'candidate_failure_count',
]);

class AdmittedParserProposalError extends Error {
  constructor(code, message) {
    super(message);
    this.name = 'AdmittedParserProposalError';
    this.code = code;
  }
}

function fail(code, message) {
  throw new AdmittedParserProposalError(code, message);
}

function freeze(value) {
  if (!value || typeof value !== 'object' || Object.isFrozen(value)) return value;
  Object.values(value).forEach(freeze);
  return Object.freeze(value);
}

function exactKeys(value, keys) {
  return value && typeof value === 'object' && !Array.isArray(value)
    && canonicalJson(Object.keys(value).sort()) === canonicalJson([...keys].sort());
}

function validateRuntimeManifest(manifest = runtimeManifest) {
  if (!exactKeys(manifest, MANIFEST_KEYS)
    || manifest.schema_version !== 'PARSER_V2_RUNTIME_MANIFEST/V1'
    || manifest.entry_module !== 'lib/parser-v2/canonical-structural-definitions.js'
    || !Array.isArray(manifest.local_modules)
    || !exactKeys(manifest.governed_limits, LIMIT_KEYS)) {
    fail('INVALID_RUNTIME_MANIFEST', 'parser runtime manifest does not match its closed contract');
  }
  const seenPaths = new Set();
  let priorPath = '';
  for (const moduleEntry of manifest.local_modules) {
    if (!exactKeys(moduleEntry, ['path', 'sha256'])
      || typeof moduleEntry.path !== 'string'
      || !moduleEntry.path
      || (moduleEntry.path !== 'lib/edgar-cleanup.js'
        && !moduleEntry.path.startsWith('lib/parser-v2/'))
      || moduleEntry.path.includes('..')
      || moduleEntry.path <= priorPath
      || seenPaths.has(moduleEntry.path)
      || !/^[a-f0-9]{64}$/.test(moduleEntry.sha256 || '')) {
      fail('INVALID_RUNTIME_MANIFEST', 'parser runtime module closure is invalid');
    }
    seenPaths.add(moduleEntry.path);
    priorPath = moduleEntry.path;
  }
  if (!seenPaths.has(manifest.entry_module)) {
    fail('INVALID_RUNTIME_MANIFEST', 'parser runtime entry is absent from its closure');
  }
  for (const key of LIMIT_KEYS) {
    if (!Number.isInteger(manifest.governed_limits[key])
      || manifest.governed_limits[key] < 1) {
      fail('INVALID_RUNTIME_MANIFEST', `parser runtime limit ${key} is invalid`);
    }
  }
  if (canonicalJson(manifest.governed_limits) !== canonicalJson(GOVERNED_LIMITS)) {
    fail('INVALID_RUNTIME_MANIFEST', 'parser runtime limits do not match the governed boundary');
  }
  const body = { ...manifest };
  delete body.parser_runtime_manifest_id;
  if (manifest.parser_runtime_manifest_id
    !== contentId('PARSER_V2_RUNTIME_MANIFEST/V1', body)) {
    fail('INVALID_RUNTIME_MANIFEST', 'parser runtime manifest identity does not match its payload');
  }
  return true;
}

function assertBoundary(contractBundle) {
  validateContractBundle(contractBundle);
  const boundary = contractBundle.parser_proposal_boundary_definition;
  if (boundary.adapter_key !== 'PARSER_V2_STRUCTURAL_DEFINITION_PROPOSAL'
    || boundary.adapter_version !== 1
    || canonicalJson(boundary.allowed_proposal_kinds)
      !== canonicalJson(['STRUCTURAL_SECTION', 'DEFINITION_CANDIDATE'])
    || boundary.canonical_write_permission !== false
    || boundary.absence_decision_permission !== false
    || boundary.comparability_decision_permission !== false
    || boundary.semantic_identity_permission !== false
    || boundary.exact_evidence_required !== true
    || boundary.coordinate_space !== 'ADMITTED_SOURCE_UTF8_BYTES'
    || boundary.source_transform !== 'PARSER_V2_TEXT_LAYERS/V1') {
    fail('FORBIDDEN_BOUNDARY_AUTHORITY', 'parser proposal boundary grants ungoverned authority');
  }
  return boundary;
}

function validateSourceChain({
  admittedSourceContext,
  immutableSourceDocument,
  sourceAdmissionManifest,
  semanticExtractionInputEnvelope,
  conversion,
}) {
  validateAdmittedSemanticSourceContext({
    context: admittedSourceContext,
    immutable_source_document: immutableSourceDocument,
    source_admission_manifest: sourceAdmissionManifest,
    semantic_extraction_input_envelope: semanticExtractionInputEnvelope,
    conversion,
    governed_deal_key: admittedSourceContext.governed_deal_key,
    deal_admission_id: admittedSourceContext.deal_admission_id,
    source_ordinal: admittedSourceContext.source_ordinal,
  });
}

function buildUtf8BoundaryTable(text) {
  const table = new Int32Array(text.length + 1);
  table.fill(-1);
  let byteOffset = 0;
  for (let index = 0; index < text.length;) {
    table[index] = byteOffset;
    const codePoint = text.codePointAt(index);
    const character = String.fromCodePoint(codePoint);
    const width = codePoint > 0xffff ? 2 : 1;
    byteOffset += Buffer.byteLength(character, 'utf8');
    index += width;
    table[index] = byteOffset;
  }
  return table;
}

function mapCleanToRaw(layers, cleanOffset) {
  if (!Number.isInteger(cleanOffset)
    || cleanOffset < 0
    || cleanOffset >= layers.cleanToRaw.length) {
    fail('INVALID_TEXT_PROJECTION', 'parser clean-text offset is outside its source map');
  }
  return layers.cleanToRaw[cleanOffset];
}

function projectionDigest(layers) {
  const count = layers.cleanText.length + 1;
  const encoded = Buffer.allocUnsafe(count * 4);
  let prior = -1;
  for (let index = 0; index < count; index += 1) {
    const rawOffset = mapCleanToRaw(layers, index);
    if (!Number.isInteger(rawOffset) || rawOffset < prior || rawOffset > 0xffffffff) {
      fail('INVALID_TEXT_PROJECTION', 'parser clean-to-source mapping is not monotone');
    }
    encoded.writeUInt32BE(rawOffset, index * 4);
    prior = rawOffset;
  }
  return {
    schema_version: 'PARSER_V2_TEXT_PROJECTION/V1',
    source_transform: 'PARSER_V2_TEXT_LAYERS/V1',
    clean_text_sha256: sha256Hex(Buffer.from(layers.cleanText, 'utf8')),
    clean_text_byte_length: Buffer.byteLength(layers.cleanText, 'utf8'),
    clean_text_character_length: layers.cleanText.length,
    mapping_count: count,
    clean_to_source_map_sha256: sha256Hex(encoded),
  };
}

function validCleanInterval(candidate, cleanTextLength) {
  return Number.isInteger(candidate.clean_start)
    && Number.isInteger(candidate.clean_end)
    && candidate.clean_start >= 0
    && candidate.clean_end > candidate.clean_start
    && candidate.clean_end <= cleanTextLength;
}

function isNullableString(value) {
  return value === null || typeof value === 'string';
}

function validateDetectionResult(detected, limits, cleanTextLength) {
  if (!exactKeys(detected, DETECTION_KEYS)
    || detected.schema_version !== 'PARSER_V2_STRUCTURAL_DEFINITION_DETECTION/V1'
    || !Array.isArray(detected.sections)
    || !Array.isArray(detected.definitions)
    || !Array.isArray(detected.structural_residual_regions)
    || !Array.isArray(detected.candidate_failures)
    || !exactKeys(detected.diagnostics, DETECTION_DIAGNOSTIC_KEYS)) {
    throw new TypeError('parser v2 detection result does not match its closed contract');
  }
  if (detected.sections.length > limits.max_sections
    || detected.definitions.length > limits.max_definitions
    || detected.structural_residual_regions.length
      + detected.candidate_failures.length > limits.max_residuals
    || detected.sections.length + detected.definitions.length > limits.max_total_candidates) {
    throw new RangeError('parser v2 detection result exceeds a governed collection limit');
  }
  detected.sections.forEach((candidate) => {
    if (!exactKeys(candidate, DETECTION_SECTION_KEYS)
      || !validCleanInterval(candidate, cleanTextLength)
      || !isNullableString(candidate.section_number)
      || !isNullableString(candidate.section_title)
      || !isNullableString(candidate.article_number)
      || !isNullableString(candidate.article_title)
      || !isNullableString(candidate.region_type)
      || !isNullableString(candidate.atomic_reason)
      || !isNullableString(candidate.level)
      || typeof candidate.atomic !== 'boolean') {
      throw new TypeError('parser v2 structural section contains an unknown field');
    }
  });
  detected.definitions.forEach((candidate) => {
    const parent = detected.sections[candidate.parent_section_index];
    if (!exactKeys(candidate, DETECTION_DEFINITION_KEYS)
      || !validCleanInterval(candidate, cleanTextLength)
      || typeof candidate.neutral_defined_term !== 'string'
      || !candidate.neutral_defined_term
      || !Number.isInteger(candidate.parent_section_index)
      || candidate.parent_section_index < 0
      || candidate.parent_section_index >= detected.sections.length
      || candidate.clean_start < parent.clean_start
      || candidate.clean_end > parent.clean_end) {
      throw new TypeError('parser v2 definition candidate is invalid');
    }
  });
  detected.structural_residual_regions.forEach((candidate) => {
    if (!exactKeys(candidate, DETECTION_RESIDUAL_KEYS)
      || !validCleanInterval(candidate, cleanTextLength)
      || typeof candidate.reason_code !== 'string'
      || !candidate.reason_code
      || !isNullableString(candidate.region_type)) {
      throw new TypeError('parser v2 structural residual contains an unknown field');
    }
  });
  detected.candidate_failures.forEach((candidate) => {
    if (!exactKeys(candidate, DETECTION_FAILURE_KEYS)
      || typeof candidate.candidate_kind !== 'string'
      || !candidate.candidate_kind
      || typeof candidate.reason_code !== 'string'
      || !candidate.reason_code
      || !Number.isInteger(candidate.producer_ordinal)
      || candidate.producer_ordinal < 0
      || (candidate.clean_start !== null && !Number.isInteger(candidate.clean_start))
      || (candidate.clean_end !== null && !Number.isInteger(candidate.clean_end))) {
      throw new TypeError('parser v2 candidate failure is invalid');
    }
  });
  const diagnostics = detected.diagnostics;
  for (const key of [
    'body_start',
    'body_end',
    'section_count',
    'article_count',
    'numbered_section_gap_count',
    'region_coverage_gap_count',
    'region_coverage_overlap_count',
    'exact_duplicate_region_count',
    'candidate_failure_count',
  ]) {
    if (!Number.isInteger(diagnostics[key]) || diagnostics[key] < 0) {
      throw new TypeError(`parser v2 diagnostic ${key} is invalid`);
    }
  }
  if (diagnostics.section_count !== detected.sections.length
    || diagnostics.candidate_failure_count !== detected.candidate_failures.length
    || diagnostics.body_end > cleanTextLength
    || diagnostics.body_start > diagnostics.body_end
    || typeof diagnostics.region_coverage_complete !== 'boolean'
    || (diagnostics.delimiter !== null && typeof diagnostics.delimiter !== 'string')) {
    throw new TypeError('parser v2 diagnostics do not agree with its candidates');
  }
}

function chargeAnchorEmission(anchorState, anchor, limits) {
  const encodedBytes = Buffer.byteLength(canonicalJson(anchor), 'utf8');
  if (anchorState.emittedEvidenceBytes + encodedBytes > limits.max_envelope_bytes) {
    fail('EVIDENCE_BUDGET_EXCEEDED', 'proposal evidence exceeds its aggregate output budget');
  }
  anchorState.emittedEvidenceBytes += encodedBytes;
}

function exactAnchor({
  admittedSourceContext,
  layers,
  utf8Boundaries,
  anchorState,
  cleanStart,
  cleanEnd,
  limits,
}) {
  if (!Number.isInteger(cleanStart) || !Number.isInteger(cleanEnd)
    || cleanStart < 0 || cleanEnd <= cleanStart || cleanEnd > layers.cleanText.length) {
    fail('INVALID_CLEAN_INTERVAL', 'proposal contains an invalid parser clean-text interval');
  }
  const rawStart = mapCleanToRaw(layers, cleanStart);
  const rawEnd = mapCleanToRaw(layers, cleanEnd);
  if (!Number.isInteger(rawStart) || !Number.isInteger(rawEnd)
    || rawStart < 0 || rawEnd <= rawStart || rawEnd > admittedSourceContext.canonical_text.text.length
    || utf8Boundaries[rawStart] < 0 || utf8Boundaries[rawEnd] < 0) {
    fail('UNRESOLVED_SOURCE_MAPPING', 'proposal cannot be mapped to UTF-8 source boundaries');
  }
  const absoluteStart = utf8Boundaries[rawStart];
  const absoluteEnd = utf8Boundaries[rawEnd];
  const cacheKey = `${cleanStart}:${cleanEnd}`;
  if (anchorState.cache.has(cacheKey)) {
    const cached = anchorState.cache.get(cacheKey);
    chargeAnchorEmission(anchorState, cached, limits);
    return cached;
  }
  if (absoluteEnd - absoluteStart > limits.max_span_bytes) {
    fail('SPAN_LIMIT_EXCEEDED', 'proposal evidence span exceeds its governed limit');
  }
  if (anchorState.mappedEvidenceBytes + absoluteEnd - absoluteStart
    > limits.max_envelope_bytes) {
    fail('EVIDENCE_BUDGET_EXCEEDED', 'proposal evidence exceeds its aggregate processing budget');
  }
  if (layers.invalidRoundtripIntervals.has(`${cleanStart}:${cleanEnd}`)) {
    fail('TEXT_PROJECTION_MISMATCH', 'proposal interval fails clean-to-source round-trip proof');
  }
  const selectedBytes = anchorState.sourceBytes.subarray(absoluteStart, absoluteEnd);
  const exactText = selectedBytes.toString('utf8');
  if (!Buffer.from(exactText, 'utf8').equals(selectedBytes)) {
    fail('EXACT_EVIDENCE_MISMATCH', 'proposal evidence does not end on UTF-8 boundaries');
  }
  const spanBody = {
    schema_version: 'SEMANTIC_SPAN/V1',
    canonical_text_id: admittedSourceContext.canonical_text_id,
    absolute_start: absoluteStart,
    absolute_end: absoluteEnd,
  };
  const span = {
    ...spanBody,
    semantic_span_id: contentId('SEMANTIC_SPAN/V1', spanBody),
    exact_bytes_digest: sha256Hex(selectedBytes),
  };
  if (sha256Hex(Buffer.from(exactText, 'utf8')) !== span.exact_bytes_digest) {
    fail('EXACT_EVIDENCE_MISMATCH', 'proposal evidence digest does not match admitted source');
  }
  const anchor = freeze({
    schema_version: 'ADMITTED_PARSER_EVIDENCE_ANCHOR/V1',
    semantic_span_id: span.semantic_span_id,
    canonical_text_id: span.canonical_text_id,
    absolute_start: span.absolute_start,
    absolute_end: span.absolute_end,
    exact_bytes_digest: span.exact_bytes_digest,
    exact_text: exactText,
    parser_clean_start: cleanStart,
    parser_clean_end: cleanEnd,
    parser_clean_text_digest: sha256Hex(
      Buffer.from(layers.cleanText.slice(cleanStart, cleanEnd), 'utf8'),
    ),
  });
  anchorState.mappedEvidenceBytes += absoluteEnd - absoluteStart;
  anchorState.cache.set(cacheKey, anchor);
  chargeAnchorEmission(anchorState, anchor, limits);
  return anchor;
}

function compareCandidate(left, right) {
  const coordinateOrder = left.clean_start - right.clean_start
    || left.clean_end - right.clean_end;
  if (coordinateOrder !== 0) return coordinateOrder;
  const leftJson = canonicalJson(left);
  const rightJson = canonicalJson(right);
  if (leftJson === rightJson) return 0;
  return leftJson < rightJson ? -1 : 1;
}

function partitionCandidates(candidates) {
  const ordered = [...candidates].sort(compareCandidate);
  const accepted = [];
  const conflicts = [];
  let duplicateCount = 0;
  for (let index = 0; index < ordered.length;) {
    const coordinateGroup = [];
    const start = ordered[index].clean_start;
    const end = ordered[index].clean_end;
    while (index < ordered.length
      && ordered[index].clean_start === start
      && ordered[index].clean_end === end) {
      coordinateGroup.push(ordered[index]);
      index += 1;
    }
    const unique = [];
    const seen = new Set();
    for (const candidate of coordinateGroup) {
      const key = canonicalJson(candidate);
      if (seen.has(key)) {
        duplicateCount += 1;
      } else {
        seen.add(key);
        unique.push(candidate);
      }
    }
    if (unique.length === 1) accepted.push(unique[0]);
    else conflicts.push(...unique);
  }
  return { accepted, conflicts, duplicateCount };
}

function residual({
  admittedSourceContext,
  layers,
  utf8Boundaries,
  anchorState,
  limits,
  reasonCode,
  candidateKind,
  candidate,
}) {
  let anchor = null;
  try {
    anchor = exactAnchor({
      admittedSourceContext,
      layers,
      utf8Boundaries,
      anchorState,
      cleanStart: candidate.clean_start,
      cleanEnd: candidate.clean_end,
      limits,
    });
  } catch (_) {
    anchor = null;
  }
  const producerPayloadDigest = contentId('PARSER_V2_RESIDUAL_INPUT/V1', candidate);
  const body = {
    schema_version: 'ADMITTED_PARSER_RESIDUAL/V1',
    admitted_semantic_source_context_id:
      admittedSourceContext.admitted_semantic_source_context_id,
    source_admission_manifest_id: admittedSourceContext.source_admission_manifest_id,
    candidate_kind: candidateKind,
    reason_code: reasonCode,
    producer_payload_digest: producerPayloadDigest,
    clean_start: Number.isInteger(candidate.clean_start) ? candidate.clean_start : null,
    clean_end: Number.isInteger(candidate.clean_end) ? candidate.clean_end : null,
    evidence_anchor: anchor,
    source_backing: anchor ? 'EXACT_SOURCE_ANCHORED' : 'CLEAN_PROJECTION_UNRESOLVED',
  };
  return freeze({
    ...body,
    admitted_parser_residual_id: contentId('ADMITTED_PARSER_RESIDUAL/V1', body),
  });
}

function prepareSectionProposals({
  candidates,
  admittedSourceContext,
  layers,
  utf8Boundaries,
  anchorState,
  limits,
}) {
  const partitioned = partitionCandidates(candidates);
  const residuals = partitioned.conflicts.map((candidate) => residual({
    admittedSourceContext,
    layers,
    utf8Boundaries,
    anchorState,
    limits,
    reasonCode: 'CONFLICTING_SAME_INTERVAL_CANDIDATE',
    candidateKind: 'STRUCTURAL_SECTION',
    candidate,
  }));
  const anchored = [];
  for (const candidate of partitioned.accepted) {
    try {
      anchored.push({
        candidate,
        anchor: exactAnchor({
          admittedSourceContext,
          layers,
          utf8Boundaries,
          anchorState,
          cleanStart: candidate.clean_start,
          cleanEnd: candidate.clean_end,
          limits,
        }),
      });
    } catch (_) {
      residuals.push(residual({
        admittedSourceContext,
        layers,
        utf8Boundaries,
        anchorState,
        limits,
        reasonCode: 'EXACT_EVIDENCE_UNRESOLVED',
        candidateKind: 'STRUCTURAL_SECTION',
        candidate,
      }));
    }
  }
  anchored.sort((left, right) => compareCandidate(left.candidate, right.candidate));
  const proposals = anchored.map(({ candidate, anchor }, governedOrdinal) => {
    const neutralPropositionDigest = contentId(
      'STRUCTURAL_SECTION_NEUTRAL_PROPOSITION/V1',
      candidate,
    );
    const body = {
      schema_version: 'ADMITTED_STRUCTURAL_SECTION_PROPOSAL/V1',
      proposal_kind: 'STRUCTURAL_SECTION',
      admitted_semantic_source_context_id:
        admittedSourceContext.admitted_semantic_source_context_id,
      source_admission_manifest_id: admittedSourceContext.source_admission_manifest_id,
      governed_ordinal: governedOrdinal,
      neutral_proposition_digest: neutralPropositionDigest,
      section_number: candidate.section_number,
      section_title: candidate.section_title,
      article_number: candidate.article_number,
      article_title: candidate.article_title,
      region_type: candidate.region_type,
      atomic: candidate.atomic,
      atomic_reason: candidate.atomic_reason,
      level: candidate.level,
      evidence_anchor: anchor,
    };
    return freeze({
      ...body,
      admitted_structural_section_proposal_id:
        contentId('ADMITTED_STRUCTURAL_SECTION_PROPOSAL/V1', body),
    });
  });
  const proposalByCandidateKey = new Map();
  anchored.forEach(({ candidate }, index) => {
    proposalByCandidateKey.set(canonicalJson(candidate), proposals[index]);
  });
  return {
    proposals,
    proposalByCandidateKey,
    residuals,
    duplicateCount: partitioned.duplicateCount,
  };
}

function prepareDefinitionCandidates({
  candidates,
  sectionCandidates,
  sectionProposalByCandidateKey,
  admittedSourceContext,
  layers,
  utf8Boundaries,
  anchorState,
  limits,
}) {
  const partitioned = partitionCandidates(candidates);
  const residuals = partitioned.conflicts.map((candidate) => residual({
    admittedSourceContext,
    layers,
    utf8Boundaries,
    anchorState,
    limits,
    reasonCode: 'CONFLICTING_SAME_INTERVAL_CANDIDATE',
    candidateKind: 'DEFINITION_CANDIDATE',
    candidate,
  }));
  const anchored = [];
  for (const candidate of partitioned.accepted) {
    const parentCandidate = sectionCandidates[candidate.parent_section_index];
    const parent = parentCandidate
      ? sectionProposalByCandidateKey.get(canonicalJson(parentCandidate))
      : null;
    if (!parent) {
      residuals.push(residual({
        admittedSourceContext,
        layers,
        utf8Boundaries,
        anchorState,
        limits,
        reasonCode: 'PARENT_SECTION_UNRESOLVED',
        candidateKind: 'DEFINITION_CANDIDATE',
        candidate,
      }));
      continue;
    }
    try {
      anchored.push({
        candidate,
        parent,
        anchor: exactAnchor({
          admittedSourceContext,
          layers,
          utf8Boundaries,
          anchorState,
          cleanStart: candidate.clean_start,
          cleanEnd: candidate.clean_end,
          limits,
        }),
      });
    } catch (_) {
      residuals.push(residual({
        admittedSourceContext,
        layers,
        utf8Boundaries,
        anchorState,
        limits,
        reasonCode: 'EXACT_EVIDENCE_UNRESOLVED',
        candidateKind: 'DEFINITION_CANDIDATE',
        candidate,
      }));
    }
  }
  anchored.sort((left, right) => compareCandidate(left.candidate, right.candidate));
  const definitions = anchored.map(({ candidate, parent, anchor }, governedOrdinal) => {
    const neutralPropositionDigest = contentId(
      'DEFINITION_CANDIDATE_NEUTRAL_PROPOSITION/V1',
      {
        neutral_defined_term: candidate.neutral_defined_term,
        evidence_anchor: anchor.semantic_span_id,
      },
    );
    const body = {
      schema_version: 'ADMITTED_DEFINITION_CANDIDATE/V1',
      proposal_kind: 'DEFINITION_CANDIDATE',
      admitted_semantic_source_context_id:
        admittedSourceContext.admitted_semantic_source_context_id,
      source_admission_manifest_id: admittedSourceContext.source_admission_manifest_id,
      governed_ordinal: governedOrdinal,
      neutral_proposition_digest: neutralPropositionDigest,
      neutral_defined_term: candidate.neutral_defined_term,
      parent_structural_section_proposal_id:
        parent.admitted_structural_section_proposal_id,
      evidence_anchor: anchor,
    };
    return freeze({
      ...body,
      admitted_definition_candidate_id: contentId('ADMITTED_DEFINITION_CANDIDATE/V1', body),
    });
  });
  return { definitions, residuals, duplicateCount: partitioned.duplicateCount };
}

function buildAdmittedParserProposalEnvelope({
  contract_bundle: contractBundle,
  immutable_source_document: immutableSourceDocument,
  source_admission_manifest: sourceAdmissionManifest,
  semantic_extraction_input_envelope: semanticExtractionInputEnvelope,
  conversion,
  admitted_source_context: admittedSourceContext,
} = {}) {
  validateRuntimeManifest();
  const boundary = assertBoundary(contractBundle);
  validateSourceChain({
    admittedSourceContext,
    immutableSourceDocument,
    sourceAdmissionManifest,
    semanticExtractionInputEnvelope,
    conversion,
  });
  const limits = runtimeManifest.governed_limits;
  const sourceText = admittedSourceContext.canonical_text.text;
  if (admittedSourceContext.canonical_text_byte_length < 1) {
    fail('EMPTY_ADMITTED_SOURCE', 'parser proposals require non-empty admitted canonical text');
  }
  if (admittedSourceContext.canonical_text_byte_length > limits.max_source_bytes) {
    fail('SOURCE_LIMIT_EXCEEDED', 'admitted canonical text exceeds its governed parser limit');
  }

  const runtimeOutput = runInRestrictedContext({
    manifest: runtimeManifest,
    sourceText,
    limits,
  });
  const layers = {
    cleanText: runtimeOutput.clean_text,
    cleanToRaw: runtimeOutput.clean_to_raw,
    invalidRoundtripIntervals: new Set(runtimeOutput.invalid_roundtrip_intervals),
  };
  const utf8Boundaries = buildUtf8BoundaryTable(sourceText);
  const anchorState = {
    sourceBytes: Buffer.from(sourceText, 'utf8'),
    cache: new Map(),
    mappedEvidenceBytes: 0,
    emittedEvidenceBytes: 0,
  };
  const projection = freeze(projectionDigest(layers));
  let detected = runtimeOutput.detected;
  let executionResidual = null;
  try {
    if (runtimeOutput.detector_error || !detected) {
      throw new TypeError('parser runtime returned no detection result');
    }
    validateDetectionResult(detected, limits, layers.cleanText.length);
  } catch (error) {
    if (error instanceof RangeError) throw error;
    detected = {
      schema_version: 'PARSER_V2_STRUCTURAL_DEFINITION_DETECTION/V1',
      sections: [],
      definitions: [],
      structural_residual_regions: [],
      candidate_failures: [],
      diagnostics: {
        body_start: 0,
        body_end: layers.cleanText.length,
        section_count: 0,
        article_count: 0,
        delimiter: null,
        numbered_section_gap_count: 0,
        region_coverage_complete: false,
        region_coverage_gap_count: 1,
        region_coverage_overlap_count: 0,
        exact_duplicate_region_count: 0,
        candidate_failure_count: 0,
      },
    };
    executionResidual = residual({
      admittedSourceContext,
      layers,
      utf8Boundaries,
      anchorState,
      limits,
      reasonCode: 'PARSER_EXECUTION_FAILED',
      candidateKind: 'SOURCE',
      candidate: {
        clean_start: 0,
        clean_end: layers.cleanText.length,
      },
    });
  }

  const sectionResult = prepareSectionProposals({
    candidates: detected.sections,
    admittedSourceContext,
    layers,
    utf8Boundaries,
    anchorState,
    limits,
  });
  const definitionResult = prepareDefinitionCandidates({
    candidates: detected.definitions,
    sectionCandidates: detected.sections,
    sectionProposalByCandidateKey: sectionResult.proposalByCandidateKey,
    admittedSourceContext,
    layers,
    utf8Boundaries,
    anchorState,
    limits,
  });
  const structuralResiduals = detected.structural_residual_regions.map((candidate) => residual({
    admittedSourceContext,
    layers,
    utf8Boundaries,
    anchorState,
    limits,
    reasonCode: candidate.reason_code,
    candidateKind: 'STRUCTURAL_REGION',
    candidate,
  }));
  const candidateFailureResiduals = detected.candidate_failures.map((candidate) => residual({
    admittedSourceContext,
    layers,
    utf8Boundaries,
    anchorState,
    limits,
    reasonCode: candidate.reason_code,
    candidateKind: candidate.candidate_kind,
    candidate,
  }));
  const residuals = [
    ...(executionResidual ? [executionResidual] : []),
    ...sectionResult.residuals,
    ...definitionResult.residuals,
    ...structuralResiduals,
    ...candidateFailureResiduals,
  ].sort((left, right) => left.admitted_parser_residual_id
    .localeCompare(right.admitted_parser_residual_id));
  if (residuals.length > limits.max_residuals) {
    fail('RESIDUAL_LIMIT_EXCEEDED', 'admitted parser residual count exceeds its governed limit');
  }

  const manifestBody = { ...runtimeManifest };
  delete manifestBody.parser_runtime_manifest_id;
  const envelopeBody = {
    schema_version: 'ADMITTED_PARSER_PROPOSAL_ENVELOPE/V1',
    authority_scope: 'OFFLINE_NONCANONICAL_PROPOSAL_ONLY',
    publication_blocked: residuals.length > 0,
    contract_fingerprint: contractBundle.fingerprint,
    proposal_boundary_definition_id: boundary.proposal_boundary_definition_id,
    proposal_boundary_definition_payload_digest:
      boundary.proposal_boundary_definition_payload_digest,
    parser_runtime_manifest_id: runtimeManifest.parser_runtime_manifest_id,
    parser_runtime_manifest_payload_digest:
      contentId('PARSER_V2_RUNTIME_MANIFEST_PAYLOAD/V1', manifestBody),
    immutable_source_document_id: admittedSourceContext.immutable_source_document_id,
    source_admission_manifest_id: admittedSourceContext.source_admission_manifest_id,
    semantic_extraction_input_envelope_id:
      admittedSourceContext.semantic_extraction_input_envelope_id,
    semantic_extraction_input_envelope_payload_digest:
      contentId(
        'SEMANTIC_EXTRACTION_INPUT_ENVELOPE_OBJECT/V1',
        semanticExtractionInputEnvelope,
      ),
    admitted_semantic_source_context_id:
      admittedSourceContext.admitted_semantic_source_context_id,
    admitted_semantic_source_context_payload_digest:
      contentId('ADMITTED_SEMANTIC_SOURCE_CONTEXT_OBJECT/V1', admittedSourceContext),
    source_content_id: admittedSourceContext.source_content_id,
    source_occurrence_id: admittedSourceContext.source_occurrence_id,
    canonical_text_id: admittedSourceContext.canonical_text_id,
    document_hash: admittedSourceContext.document_hash,
    parser_projection: projection,
    diagnostics: {
      schema_version: 'ADMITTED_PARSER_DIAGNOSTICS/V1',
      examined: true,
      structural_section_proposal_count: sectionResult.proposals.length,
      definition_candidate_count: definitionResult.definitions.length,
      residual_count: residuals.length,
      exact_duplicate_candidate_count:
        sectionResult.duplicateCount + definitionResult.duplicateCount,
      unique_evidence_anchor_count: anchorState.cache.size,
      mapped_evidence_byte_count: anchorState.mappedEvidenceBytes,
      emitted_evidence_byte_count: anchorState.emittedEvidenceBytes,
      producer_diagnostics: detected.diagnostics,
    },
    structural_section_proposals: sectionResult.proposals,
    definition_candidates: definitionResult.definitions,
    residuals,
  };
  const envelope = freeze({
    ...envelopeBody,
    admitted_parser_proposal_envelope_id:
      contentId('ADMITTED_PARSER_PROPOSAL_ENVELOPE/V1', envelopeBody),
    canonical_payload_digest:
      contentId('ADMITTED_PARSER_PROPOSAL_ENVELOPE_PAYLOAD/V1', envelopeBody),
  });
  if (Buffer.byteLength(canonicalJson(envelope), 'utf8') > limits.max_envelope_bytes) {
    fail('ENVELOPE_LIMIT_EXCEEDED', 'admitted parser proposal envelope exceeds its governed limit');
  }
  return envelope;
}

function validateAdmittedParserProposalEnvelope({
  proposal_envelope: proposalEnvelope,
  ...inputs
} = {}) {
  if (!proposalEnvelope || typeof proposalEnvelope !== 'object') {
    fail('INVALID_PROPOSAL_ENVELOPE', 'proposal_envelope is required');
  }
  const expected = buildAdmittedParserProposalEnvelope(inputs);
  if (canonicalJson(proposalEnvelope) !== canonicalJson(expected)) {
    fail('PROPOSAL_ENVELOPE_MISMATCH', 'parser proposal envelope does not match admitted inputs');
  }
  return true;
}

module.exports = {
  AdmittedParserProposalError,
  buildAdmittedParserProposalEnvelope,
  validateAdmittedParserProposalEnvelope,
  validateRuntimeManifest,
};
