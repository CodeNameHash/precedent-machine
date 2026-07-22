const {
  canonicalJson,
  contentId,
  sha256Hex,
  utf8Slice,
} = require('./canonical-bytes');

const SHA256_RE = /^[a-f0-9]{64}$/;
const SYNTACTIC_ROLES = new Set(['NESTED_INLINE', 'POSTFIX_INLINE']);
const USE_ROLES = new Set(['OPERATIVE_REFERENCE', 'DECLARATION_REFERENCE']);

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

function exactKeys(value, keys, name) {
  if (!value || typeof value !== 'object' || Array.isArray(value)
    || canonicalJson(Object.keys(value).sort()) !== canonicalJson([...keys].sort())) {
    throw new TypeError(`${name} fields do not match the semantic graph contract`);
  }
}

function cueIdentity(cue) {
  return {
    document_hash: cue.document_hash,
    canonical_text_id: cue.canonical_text_id,
    source_anchor_id: cue.source_anchor_id,
    term_span_id: cue.term_span_id,
    body_span_ids: cue.body_span_ids,
    raw_term_digest: cue.raw_term_digest,
    syntactic_role: cue.syntactic_role,
    source_order_ordinal: cue.source_order_ordinal,
  };
}

function useIdentity(use) {
  return {
    document_hash: use.document_hash,
    canonical_text_id: use.canonical_text_id,
    definition_cue_id: use.definition_cue_id,
    use_span_id: use.use_span_id,
    use_role: use.use_role,
    source_order_ordinal: use.source_order_ordinal,
  };
}

function validateStoredSpanIdentity(span, canonicalTextId, name) {
  exactKeys(span, [
    'schema_version', 'canonical_text_id', 'absolute_start', 'absolute_end',
    'semantic_span_id', 'exact_bytes_digest',
  ], name);
  if (span.schema_version !== 'SEMANTIC_SPAN/V1'
    || span.canonical_text_id !== canonicalTextId
    || !Number.isInteger(span.absolute_start)
    || !Number.isInteger(span.absolute_end)
    || span.absolute_end <= span.absolute_start
    || !SHA256_RE.test(span.exact_bytes_digest || '')) {
    throw new Error(`${name} is not a valid embedded SemanticSpan`);
  }
  const expectedSpanId = contentId('SEMANTIC_SPAN/V1', {
    schema_version: span.schema_version,
    canonical_text_id: span.canonical_text_id,
    absolute_start: span.absolute_start,
    absolute_end: span.absolute_end,
  });
  if (span.semantic_span_id !== expectedSpanId) throw new Error(`${name} identity mismatch`);
}

function validateDefinitionCueIdentity(cue, graph) {
  exactKeys(cue, [
    'schema_version', 'definition_cue_id', 'document_hash', 'canonical_text_id',
    'source_anchor_id', 'term_span_id', 'body_span_ids', 'raw_term_digest',
    'syntactic_role', 'source_order_ordinal', 'raw_term', 'term_span', 'body_spans',
  ], 'DefinitionCue');
  if (cue.schema_version !== 'DEFINITION_CUE/V1'
    || cue.document_hash !== graph.document_hash
    || cue.canonical_text_id !== graph.canonical_text_id
    || typeof cue.raw_term !== 'string'
    || !cue.raw_term
    || !SYNTACTIC_ROLES.has(cue.syntactic_role)
    || !Number.isInteger(cue.source_order_ordinal)
    || cue.source_order_ordinal < 0
    || !Array.isArray(cue.body_spans)
    || cue.body_spans.length === 0
    || !Array.isArray(cue.body_span_ids)) {
    throw new Error('DefinitionCue is outside the graph identity contract');
  }
  validateStoredSpanIdentity(cue.term_span, graph.canonical_text_id, 'DefinitionCue.term_span');
  cue.body_spans.forEach((span, index) => validateStoredSpanIdentity(
    span,
    graph.canonical_text_id,
    `DefinitionCue.body_spans[${index}]`,
  ));
  const orderedBodies = [...cue.body_spans].sort((left, right) => (
    left.absolute_start - right.absolute_start || left.semantic_span_id.localeCompare(right.semantic_span_id)
  ));
  for (const [index, bodySpan] of cue.body_spans.entries()) {
    const overlapsPrior = index > 0 && bodySpan.absolute_start < cue.body_spans[index - 1].absolute_end;
    const invalidPosition = cue.syntactic_role === 'POSTFIX_INLINE'
      ? bodySpan.absolute_end > cue.term_span.absolute_start
      : bodySpan.absolute_start < cue.term_span.absolute_end;
    if (overlapsPrior || invalidPosition) throw new Error('DefinitionCue embedded geometry mismatch');
  }
  if (canonicalJson(orderedBodies) !== canonicalJson(cue.body_spans)
    || canonicalJson(cue.body_span_ids) !== canonicalJson(cue.body_spans.map((span) => span.semantic_span_id))
    || cue.source_anchor_id !== cue.term_span.semantic_span_id
    || cue.term_span_id !== cue.term_span.semantic_span_id
    || cue.term_span.exact_bytes_digest !== sha256Hex(Buffer.from(cue.raw_term, 'utf8'))
    || cue.raw_term_digest !== contentId('RAW_DEFINITION_TERM/V1', cue.raw_term)
    || cue.definition_cue_id !== contentId('DEFINITION_CUE/V1', cueIdentity(cue))) {
    throw new Error('DefinitionCue embedded identity mismatch');
  }
}

function validateDefinitionUseCueIdentity(use, graph, cueIds) {
  exactKeys(use, [
    'schema_version', 'definition_use_cue_id', 'document_hash', 'canonical_text_id',
    'definition_cue_id', 'use_span_id', 'use_role', 'source_order_ordinal', 'use_span',
  ], 'DefinitionUseCue');
  if (use.schema_version !== 'DEFINITION_USE_CUE/V1'
    || use.document_hash !== graph.document_hash
    || use.canonical_text_id !== graph.canonical_text_id
    || !cueIds.has(use.definition_cue_id)
    || !USE_ROLES.has(use.use_role)
    || !Number.isInteger(use.source_order_ordinal)
    || use.source_order_ordinal < 0) {
    throw new Error('DefinitionUseCue is outside the graph identity contract');
  }
  validateStoredSpanIdentity(use.use_span, graph.canonical_text_id, 'DefinitionUseCue.use_span');
  if (use.use_span_id !== use.use_span.semantic_span_id
    || use.definition_use_cue_id !== contentId('DEFINITION_USE_CUE/V1', useIdentity(use))) {
    throw new Error('DefinitionUseCue embedded identity mismatch');
  }
}

function buildDefinitionCue({ source, termSpan, bodySpans, rawTerm, syntacticRole, ordinal = 0 }) {
  if (!source?.document_hash || !source?.canonical_text?.canonical_text_id) {
    throw new TypeError('source must be an ImmutableSourceDocument');
  }
  const exactTerm = requireSourceSpan(source, termSpan, 'termSpan');
  const orderedBodySpans = [...bodySpans].sort((a, b) => a.absolute_start - b.absolute_start);
  orderedBodySpans.forEach((span) => requireSourceSpan(source, span, 'bodySpan'));
  if (!rawTerm || !SYNTACTIC_ROLES.has(syntacticRole) || !Number.isInteger(ordinal) || ordinal < 0) {
    throw new TypeError('rawTerm, syntacticRole and a non-negative ordinal are required');
  }
  if (exactTerm !== rawTerm) throw new Error('rawTerm must equal the exact term-span bytes');
  if (orderedBodySpans.length === 0) throw new TypeError('at least one definition body span is required');
  for (const [index, bodySpan] of orderedBodySpans.entries()) {
    const overlapsPrior = index > 0 && bodySpan.absolute_start < orderedBodySpans[index - 1].absolute_end;
    const invalidPosition = syntacticRole === 'POSTFIX_INLINE'
      ? bodySpan.absolute_end > termSpan.absolute_start
      : bodySpan.absolute_start < termSpan.absolute_end;
    if (invalidPosition || overlapsPrior) {
      throw new Error(syntacticRole === 'POSTFIX_INLINE'
        ? 'postfix definition body spans must precede the term and may not overlap'
        : 'definition body spans must follow the term and may not overlap');
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
    term_span: termSpan,
    body_spans: Object.freeze(orderedBodySpans),
  });
}

function buildDefinitionUseCue({ source, definitionCue, useSpan, useRole = 'OPERATIVE_REFERENCE', ordinal = 0 }) {
  if (!source?.document_hash || !definitionCue?.definition_cue_id) {
    throw new TypeError('source and definitionCue are required');
  }
  requireSourceSpan(source, useSpan, 'useSpan');
  if (!USE_ROLES.has(useRole) || !Number.isInteger(ordinal) || ordinal < 0) {
    throw new TypeError('useRole and a non-negative ordinal are required');
  }
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
    use_span: useSpan,
  });
}

function validateDefinitionCue({ source, cue }) {
  exactKeys(cue, [
    'schema_version', 'definition_cue_id', 'document_hash', 'canonical_text_id',
    'source_anchor_id', 'term_span_id', 'body_span_ids', 'raw_term_digest',
    'syntactic_role', 'source_order_ordinal', 'raw_term', 'term_span', 'body_spans',
  ], 'DefinitionCue');
  if (cue.schema_version !== 'DEFINITION_CUE/V1') throw new Error('unknown DefinitionCue schema');
  const rebuilt = buildDefinitionCue({
    source,
    termSpan: cue.term_span,
    bodySpans: cue.body_spans,
    rawTerm: cue.raw_term,
    syntacticRole: cue.syntactic_role,
    ordinal: cue.source_order_ordinal,
  });
  if (canonicalJson(rebuilt) !== canonicalJson(cue)
    || cue.definition_cue_id !== contentId('DEFINITION_CUE/V1', cueIdentity(cue))) {
    throw new Error('DefinitionCue identity does not match its admitted source');
  }
  return true;
}

function validateDefinitionUseCue({ source, definitionCue, use }) {
  exactKeys(use, [
    'schema_version', 'definition_use_cue_id', 'document_hash', 'canonical_text_id',
    'definition_cue_id', 'use_span_id', 'use_role', 'source_order_ordinal', 'use_span',
  ], 'DefinitionUseCue');
  if (use.schema_version !== 'DEFINITION_USE_CUE/V1') throw new Error('unknown DefinitionUseCue schema');
  const rebuilt = buildDefinitionUseCue({
    source,
    definitionCue,
    useSpan: use.use_span,
    useRole: use.use_role,
    ordinal: use.source_order_ordinal,
  });
  if (canonicalJson(rebuilt) !== canonicalJson(use)
    || use.definition_use_cue_id !== contentId('DEFINITION_USE_CUE/V1', useIdentity(use))) {
    throw new Error('DefinitionUseCue identity does not match its admitted source');
  }
  return true;
}

function buildValidatedDefinitionGraph({ source, definitionCues, definitionUseCues }) {
  if (!source?.document_hash || !source?.canonical_text?.canonical_text_id
    || !Array.isArray(definitionCues) || !Array.isArray(definitionUseCues)) {
    throw new TypeError('source, definitionCues and definitionUseCues are required');
  }
  const cues = [...definitionCues].sort((a, b) => (
    a.source_order_ordinal - b.source_order_ordinal
      || a.definition_cue_id.localeCompare(b.definition_cue_id)
  ));
  const uses = [...definitionUseCues].sort((a, b) => {
    if (a.source_order_ordinal !== b.source_order_ordinal) return a.source_order_ordinal - b.source_order_ordinal;
    return a.definition_use_cue_id.localeCompare(b.definition_use_cue_id);
  });
  const cueIds = new Set(cues.map((cue) => cue.definition_cue_id));
  if (cueIds.size !== cues.length) throw new Error('duplicate DefinitionCue');
  const useIds = new Set(uses.map((use) => use.definition_use_cue_id));
  if (useIds.size !== uses.length) throw new Error('duplicate DefinitionUseCue');
  for (const cue of cues) {
    validateDefinitionCue({ source, cue });
  }
  for (const use of uses) {
    const cue = cues.find((entry) => entry.definition_cue_id === use.definition_cue_id);
    if (!cue) throw new Error('DefinitionUseCue references an unknown DefinitionCue');
    validateDefinitionUseCue({ source, definitionCue: cue, use });
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

function validateValidatedDefinitionGraph({ source, graph }) {
  validateValidatedDefinitionGraphIdentity({ graph });
  const { closure_id: ignoredClosureId, ...graphBody } = graph || {};
  const rebuilt = buildValidatedDefinitionGraph({
    source,
    definitionCues: graphBody.definition_cues,
    definitionUseCues: graphBody.definition_use_cues,
  });
  if (canonicalJson(rebuilt) !== canonicalJson(graphBody)) {
    throw new Error('ValidatedSemanticGraph identity does not match its embedded cues and admitted source');
  }
  return true;
}

function validateValidatedDefinitionGraphIdentity({ graph }) {
  const { closure_id: ignoredClosureId, ...graphBody } = graph || {};
  exactKeys(graphBody, [
    'schema_version', 'validated_semantic_graph_id', 'document_hash', 'canonical_text_id',
    'definition_cue_ids', 'definition_use_cue_ids', 'definition_cues', 'definition_use_cues',
  ], 'ValidatedSemanticGraph');
  if (graphBody.schema_version !== 'VALIDATED_SEMANTIC_GRAPH/V1'
    || !SHA256_RE.test(graphBody.document_hash || '')
    || !SHA256_RE.test(graphBody.canonical_text_id || '')
    || !Array.isArray(graphBody.definition_cue_ids)
    || !Array.isArray(graphBody.definition_use_cue_ids)
    || !Array.isArray(graphBody.definition_cues)
    || !Array.isArray(graphBody.definition_use_cues)) {
    throw new Error('unknown or invalid ValidatedSemanticGraph schema');
  }
  const cueIds = new Set(graphBody.definition_cue_ids);
  const useIds = new Set(graphBody.definition_use_cue_ids);
  if (cueIds.size !== graphBody.definition_cue_ids.length
    || useIds.size !== graphBody.definition_use_cue_ids.length
    || graphBody.definition_cues.length !== graphBody.definition_cue_ids.length
    || graphBody.definition_use_cues.length !== graphBody.definition_use_cue_ids.length) {
    throw new Error('ValidatedSemanticGraph contains duplicate or incomplete children');
  }
  graphBody.definition_cues.forEach((cue) => validateDefinitionCueIdentity(cue, graphBody));
  graphBody.definition_use_cues.forEach((use) => validateDefinitionUseCueIdentity(use, graphBody, cueIds));
  const orderedCues = [...graphBody.definition_cues].sort((left, right) => (
    left.source_order_ordinal - right.source_order_ordinal
      || left.definition_cue_id.localeCompare(right.definition_cue_id)
  ));
  const orderedUses = [...graphBody.definition_use_cues].sort((left, right) => (
    left.source_order_ordinal - right.source_order_ordinal
      || left.definition_use_cue_id.localeCompare(right.definition_use_cue_id)
  ));
  const identityPayload = {
    document_hash: graphBody.document_hash,
    canonical_text_id: graphBody.canonical_text_id,
    definition_cue_ids: graphBody.definition_cue_ids,
    definition_use_cue_ids: graphBody.definition_use_cue_ids,
  };
  if (canonicalJson(graphBody.definition_cues) !== canonicalJson(orderedCues)
    || canonicalJson(graphBody.definition_use_cues) !== canonicalJson(orderedUses)
    || canonicalJson(graphBody.definition_cue_ids)
      !== canonicalJson(graphBody.definition_cues.map((cue) => cue.definition_cue_id))
    || canonicalJson(graphBody.definition_use_cue_ids)
      !== canonicalJson(graphBody.definition_use_cues.map((use) => use.definition_use_cue_id))
    || graphBody.validated_semantic_graph_id
      !== contentId('VALIDATED_SEMANTIC_GRAPH/V1', identityPayload)) {
    throw new Error('ValidatedSemanticGraph identity or deterministic child order mismatch');
  }
  return true;
}

module.exports = {
  buildDefinitionCue,
  buildDefinitionUseCue,
  buildValidatedDefinitionGraph,
  validateValidatedDefinitionGraph,
  validateValidatedDefinitionGraphIdentity,
};
