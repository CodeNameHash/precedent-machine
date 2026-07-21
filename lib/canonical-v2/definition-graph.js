const { contentId, sha256Hex, utf8Slice } = require('./canonical-bytes');

function requireSpan(span, name) {
  if (!span || !span.semantic_span_id || !Number.isInteger(span.absolute_start)
    || !Number.isInteger(span.absolute_end) || span.absolute_end <= span.absolute_start) {
    throw new TypeError(`${name} must be a non-empty SemanticSpan`);
  }
}

function requireSourceSpan(source, span, name) {
  requireSpan(span, name);
  if (span.canonical_text_id !== source.canonical_text_id) {
    throw new Error(`${name} belongs to another canonical text`);
  }
  const exactText = utf8Slice(source.canonical_text.text, span.absolute_start, span.absolute_end);
  const payload = {
    schema_version: 'SEMANTIC_SPAN/V1',
    canonical_text_id: source.canonical_text_id,
    absolute_start: span.absolute_start,
    absolute_end: span.absolute_end,
  };
  if (span.semantic_span_id !== contentId('SEMANTIC_SPAN/V1', payload)
    || span.exact_bytes_digest !== sha256Hex(Buffer.from(exactText, 'utf8'))) {
    throw new Error(`${name} identity does not match its exact source bytes`);
  }
  return exactText;
}

function buildDefinitionCue({ source, termSpan, bodySpans, rawTerm, syntacticRole, ordinal = 0 }) {
  if (!source?.document_hash || !source?.canonical_text?.canonical_text_id) {
    throw new TypeError('source must be an ImmutableSourceDocument');
  }
  const exactTerm = requireSourceSpan(source, termSpan, 'termSpan');
  const orderedBodySpans = [...bodySpans].sort((a, b) => a.absolute_start - b.absolute_start);
  orderedBodySpans.forEach((span) => requireSourceSpan(source, span, 'bodySpan'));
  if (!rawTerm || !syntacticRole || !Number.isInteger(ordinal) || ordinal < 0) {
    throw new TypeError('rawTerm, syntacticRole and a non-negative ordinal are required');
  }
  if (exactTerm !== rawTerm) throw new Error('rawTerm must equal the exact term-span bytes');
  for (const [index, bodySpan] of orderedBodySpans.entries()) {
    if (bodySpan.absolute_start < termSpan.absolute_end
      || (index > 0 && bodySpan.absolute_start < orderedBodySpans[index - 1].absolute_end)) {
      throw new Error('definition body spans must follow the term and may not overlap');
    }
  }
  const identity = {
    document_hash: source.document_hash,
    canonical_text_id: source.canonical_text.canonical_text_id,
    source_anchor_id: termSpan.semantic_span_id,
    term_span_id: termSpan.semantic_span_id,
    body_span_ids: orderedBodySpans.map((span) => span.semantic_span_id),
    raw_term_digest: contentId('RAW_DEFINITION_TERM/V1', rawTerm),
    syntactic_role: syntacticRole,
    source_order_ordinal: ordinal,
  };
  return Object.freeze({
    schema_version: 'DEFINITION_CUE/V1',
    definition_cue_id: contentId('DEFINITION_CUE/V1', identity),
    ...identity,
    raw_term: rawTerm,
  });
}

function buildDefinitionUseCue({ source, definitionCue, useSpan, useRole = 'OPERATIVE_REFERENCE', ordinal = 0 }) {
  if (!source?.document_hash || !definitionCue?.definition_cue_id) {
    throw new TypeError('source and definitionCue are required');
  }
  requireSourceSpan(source, useSpan, 'useSpan');
  if (definitionCue.document_hash !== source.document_hash
    || definitionCue.canonical_text_id !== source.canonical_text_id) {
    throw new Error('definitionCue belongs to another immutable source');
  }
  const identity = {
    document_hash: source.document_hash,
    canonical_text_id: source.canonical_text.canonical_text_id,
    definition_cue_id: definitionCue.definition_cue_id,
    use_span_id: useSpan.semantic_span_id,
    use_role: useRole,
    source_order_ordinal: ordinal,
  };
  return Object.freeze({
    schema_version: 'DEFINITION_USE_CUE/V1',
    definition_use_cue_id: contentId('DEFINITION_USE_CUE/V1', identity),
    ...identity,
  });
}

function buildValidatedDefinitionGraph({ source, definitionCues, definitionUseCues }) {
  const cues = [...definitionCues].sort((a, b) => a.source_order_ordinal - b.source_order_ordinal);
  const uses = [...definitionUseCues].sort((a, b) => {
    if (a.source_order_ordinal !== b.source_order_ordinal) return a.source_order_ordinal - b.source_order_ordinal;
    return a.definition_use_cue_id.localeCompare(b.definition_use_cue_id);
  });
  const cueIds = new Set(cues.map((cue) => cue.definition_cue_id));
  if (cueIds.size !== cues.length) throw new Error('duplicate DefinitionCue');
  for (const cue of cues) {
    if (cue.document_hash !== source.document_hash || cue.canonical_text_id !== source.canonical_text_id) {
      throw new Error('DefinitionCue belongs to another immutable source');
    }
  }
  for (const use of uses) {
    if (!cueIds.has(use.definition_cue_id)) throw new Error('DefinitionUseCue references an unknown DefinitionCue');
    if (use.document_hash !== source.document_hash || use.canonical_text_id !== source.canonical_text_id) {
      throw new Error('DefinitionUseCue belongs to another immutable source');
    }
  }
  const payload = {
    document_hash: source.document_hash,
    canonical_text_id: source.canonical_text.canonical_text_id,
    definition_cue_ids: cues.map((cue) => cue.definition_cue_id),
    definition_use_cue_ids: uses.map((use) => use.definition_use_cue_id),
  };
  return Object.freeze({
    schema_version: 'VALIDATED_SEMANTIC_GRAPH/V1',
    validated_semantic_graph_id: contentId('VALIDATED_SEMANTIC_GRAPH/V1', payload),
    ...payload,
    definition_cues: Object.freeze(cues),
    definition_use_cues: Object.freeze(uses),
  });
}

module.exports = {
  buildDefinitionCue,
  buildDefinitionUseCue,
  buildValidatedDefinitionGraph,
};
