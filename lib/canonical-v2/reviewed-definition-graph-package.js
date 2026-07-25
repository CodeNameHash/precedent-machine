const {
  existsSync,
  lstatSync,
  readFileSync,
  statSync,
} = require('node:fs');
const {
  dirname,
  extname,
  join,
  relative,
  resolve,
  sep,
} = require('node:path');
const {
  canonicalJson,
  contentId,
  sha256Hex,
  utf8Slice,
} = require('./canonical-bytes');
const {
  validateContractBundle,
} = require('./contract-bundle');
const {
  validateAdmittedSemanticSourceContext,
} = require('./admitted-semantic-source');
const {
  validateAdmittedParserProposalEnvelope,
} = require('./admitted-parser-proposal-adapter');
const {
  buildDefinitionCue,
  buildDefinitionUseCue,
  buildValidatedDefinitionGraph,
  validateValidatedDefinitionGraph,
} = require('./definition-graph');
const {
  buildSemanticSpan,
} = require('./source-structure');

const SHA256_RE = /^[a-f0-9]{64}$/;
const MAX_REVIEWED_CANDIDATES = 4096;
const MAX_SPANS_PER_CANDIDATE = 4096;
const MAX_AGGREGATE_NESTED_ITEMS = 16384;
const MAX_PACKAGE_BYTES = 32 * 1024 * 1024;
const MAX_PACKAGE_PREFLIGHT_NODES = 1024 * 1024;
const MAX_RAW_TERM_BYTES = 1024;
const DISPOSITIONS = new Set([
  'ACCEPTED_DEFINITION_CUE',
  'REJECTED_NOT_SYNTACTIC_DEFINITION',
  'UNRESOLVED',
]);
const UNRESOLVED_REASONS = new Set([
  'AMBIGUOUS_SOURCE_GEOMETRY',
  'PENDING_HUMAN_REVIEW',
]);
const REJECTED_REASONS = new Set([
  'REVIEWED_NOT_A_DEFINITION',
]);
const SYNTACTIC_ROLES = new Set([
  'NESTED_INLINE',
  'POSTFIX_INLINE',
]);
const USE_ROLES = new Set([
  'OPERATIVE_REFERENCE',
  'DECLARATION_REFERENCE',
]);
const TOKEN_CONTINUATION_RE = /[\p{L}\p{M}\p{N}_'’&/-]/u;
const REPOSITORY_ROOT = resolve(__dirname, '../..');
const NORMALISER_SEMANTIC_CLOSURE_ROOT_MODULE_KEY =
  'lib/canonical-v2/reviewed-definition-graph-package.js';
const LOCAL_COMMONJS_REQUIRE_RE =
  /\brequire\s*\(\s*(['"])(\.[^'"]+)\1\s*\)/g;
const TRANSCRIPT_SET_MARKER_KEYS = Object.freeze([
  'schema_version',
  'transcript_set_marker',
  'semantic_extraction_input_envelope_id',
  'semantic_extraction_input_envelope_payload_digest',
  'ordered_transcript_ids',
  'ordered_transcript_payload_digests',
  'semantic_inference_transcript_set_marker_id',
]);
const NORMALISER_IDENTITY_KEYS = Object.freeze([
  'schema_version',
  'normaliser_key',
  'normaliser_version',
  'authority_scope',
  'executable_semantic_closure',
  'executable_semantic_closure_digest',
  'configuration',
  'configuration_digest',
  'definition_graph_normaliser_id',
  'canonical_payload_digest',
]);
const NORMALISER_CONFIGURATION_KEYS = Object.freeze([
  'schema_version',
  'permitted_output_schemas',
  'use_derivation_policy',
  'maximum_reviewed_candidates',
  'maximum_spans_per_candidate',
  'maximum_aggregate_nested_items',
  'maximum_package_preflight_nodes',
  'maximum_raw_term_bytes',
]);
const REVIEWED_DEFINITION_GRAPH_PACKAGE_KEYS = Object.freeze([
  'schema_version',
  'authority_scope',
  'contract_fingerprint',
  'source_lineage',
  'parser_proposal_reference',
  'inference_transcript_set_marker',
  'normaliser_identity',
  'scoped_parser_definition_candidate_ids',
  'out_of_scope_parser_definition_candidate_ids',
  'reviewed_definition_candidate_disposition_ids',
  'reviewed_candidate_dispositions',
  'retained_parser_residual_ids',
  'aggregate_nested_item_count',
  'validated_semantic_graph',
  'review_renderable',
  'release_eligible',
  'reviewed_definition_graph_package_id',
  'canonical_payload_digest',
]);
const NORMALISER_CONFIGURATION = Object.freeze({
  schema_version: 'DEFINITION_GRAPH_NORMALISER_CONFIGURATION/V2',
  permitted_output_schemas: Object.freeze([
    'DEFINITION_CUE/V1',
    'DEFINITION_USE_CUE/V1',
    'VALIDATED_SEMANTIC_GRAPH/V1',
  ]),
  use_derivation_policy: 'EXACT_RAW_TERM_BYTES_ONLY',
  maximum_reviewed_candidates: MAX_REVIEWED_CANDIDATES,
  maximum_spans_per_candidate: MAX_SPANS_PER_CANDIDATE,
  maximum_aggregate_nested_items: MAX_AGGREGATE_NESTED_ITEMS,
  maximum_package_preflight_nodes: MAX_PACKAGE_PREFLIGHT_NODES,
  maximum_raw_term_bytes: MAX_RAW_TERM_BYTES,
});

class ReviewedDefinitionGraphPackageError extends Error {
  constructor(code, message) {
    super(message);
    this.name = 'ReviewedDefinitionGraphPackageError';
    this.code = code;
  }
}

function fail(code, message) {
  throw new ReviewedDefinitionGraphPackageError(code, message);
}

function freeze(value) {
  if (!value || typeof value !== 'object') return value;
  Object.values(value).forEach(freeze);
  return Object.isFrozen(value) ? value : Object.freeze(value);
}

function plainObject(value) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return false;
  const prototype = Object.getPrototypeOf(value);
  return prototype === Object.prototype || prototype === null;
}

function exactKeys(value, keys, label) {
  if (!plainObject(value)) {
    fail('INVALID_CONTRACT', `${label} does not match its closed contract`);
  }
  const actualKeys = Object.keys(value);
  const permittedKeys = new Set(keys);
  if (actualKeys.length !== permittedKeys.size
    || actualKeys.some((key) => !permittedKeys.has(key))) {
    fail('INVALID_CONTRACT', `${label} does not match its closed contract`);
  }
}

function repositoryModuleKey(modulePath) {
  const moduleKey = relative(REPOSITORY_ROOT, modulePath).split(sep).join('/');
  if (!moduleKey || moduleKey === '..' || moduleKey.startsWith('../')) {
    fail(
      'NORMALISER_CLOSURE_INVALID',
      'normaliser dependency escapes the repository root',
    );
  }
  return moduleKey;
}

function requireRegularRepositoryFile(modulePath, label) {
  const moduleKey = repositoryModuleKey(modulePath);
  if (!existsSync(modulePath)
    || !lstatSync(modulePath).isFile()
    || !statSync(modulePath).isFile()) {
    fail('NORMALISER_CLOSURE_INVALID', `${label} is not a regular repository file`);
  }
  return moduleKey;
}

function resolveLocalCommonJsDependency(importerPath, specifier) {
  const base = resolve(dirname(importerPath), specifier);
  const candidates = [
    base,
    `${base}.js`,
    `${base}.cjs`,
    `${base}.json`,
    join(base, 'index.js'),
    join(base, 'index.cjs'),
    join(base, 'index.json'),
  ];
  for (const candidate of candidates) {
    const moduleKey = repositoryModuleKey(candidate);
    if (existsSync(candidate)
      && lstatSync(candidate).isFile()
      && statSync(candidate).isFile()) {
      return { moduleKey, modulePath: candidate };
    }
  }
  fail(
    'NORMALISER_CLOSURE_INVALID',
    `normaliser dependency ${specifier} cannot be resolved from ${repositoryModuleKey(importerPath)}`,
  );
}

function manifestRuntimeModulePaths(modulePath, bytes) {
  if (extname(modulePath) !== '.json') return [];
  let manifest;
  try {
    manifest = JSON.parse(bytes.toString('utf8'));
  } catch (_) {
    fail('NORMALISER_CLOSURE_INVALID', 'normaliser JSON dependency is invalid');
  }
  if (manifest.schema_version !== 'PARSER_V2_RUNTIME_MANIFEST/V1') return [];
  if (!Array.isArray(manifest.local_modules)) {
    fail('NORMALISER_CLOSURE_INVALID', 'parser runtime manifest has no local module closure');
  }
  return manifest.local_modules.map((entry, index) => {
    if (!plainObject(entry)
      || typeof entry.path !== 'string'
      || entry.path.length === 0) {
      fail(
        'NORMALISER_CLOSURE_INVALID',
        `parser runtime manifest module[${index}] is invalid`,
      );
    }
    const runtimeModulePath = resolve(REPOSITORY_ROOT, entry.path);
    const moduleKey = requireRegularRepositoryFile(
      runtimeModulePath,
      `parser runtime manifest module[${index}]`,
    );
    if (moduleKey !== entry.path) {
      fail(
        'NORMALISER_CLOSURE_INVALID',
        `parser runtime manifest module[${index}] is not canonical`,
      );
    }
    return runtimeModulePath;
  });
}

function deriveNormaliserSemanticClosureModuleKeys() {
  const modulePathsByKey = new Map();
  const visit = (modulePath) => {
    const moduleKey = requireRegularRepositoryFile(
      modulePath,
      'normaliser semantic dependency',
    );
    if (modulePathsByKey.has(moduleKey)) return;
    modulePathsByKey.set(moduleKey, modulePath);
    const bytes = readFileSync(modulePath);
    const extension = extname(modulePath);
    if (extension === '.js' || extension === '.cjs') {
      const source = bytes.toString('utf8');
      if (!Buffer.from(source, 'utf8').equals(bytes)) {
        fail(
          'NORMALISER_CLOSURE_INVALID',
          `normaliser dependency ${moduleKey} is not valid UTF-8`,
        );
      }
      LOCAL_COMMONJS_REQUIRE_RE.lastIndex = 0;
      let match;
      while ((match = LOCAL_COMMONJS_REQUIRE_RE.exec(source)) !== null) {
        visit(resolveLocalCommonJsDependency(modulePath, match[2]).modulePath);
      }
    }
    manifestRuntimeModulePaths(modulePath, bytes).forEach(visit);
  };
  visit(resolve(REPOSITORY_ROOT, NORMALISER_SEMANTIC_CLOSURE_ROOT_MODULE_KEY));
  return [...modulePathsByKey.keys()].sort();
}

function addJsonStringByteLength(value, addBytes) {
  addBytes(2);
  for (let index = 0; index < value.length; index += 1) {
    const codeUnit = value.charCodeAt(index);
    if (codeUnit === 0x22
      || codeUnit === 0x5c
      || codeUnit === 0x08
      || codeUnit === 0x09
      || codeUnit === 0x0a
      || codeUnit === 0x0c
      || codeUnit === 0x0d) {
      addBytes(2);
    } else if (codeUnit <= 0x1f) {
      addBytes(6);
    } else if (codeUnit >= 0xd800 && codeUnit <= 0xdbff
      && index + 1 < value.length
      && value.charCodeAt(index + 1) >= 0xdc00
      && value.charCodeAt(index + 1) <= 0xdfff) {
      addBytes(4);
      index += 1;
    } else if (codeUnit >= 0xd800 && codeUnit <= 0xdfff) {
      addBytes(6);
    } else if (codeUnit <= 0x7f) {
      addBytes(1);
    } else if (codeUnit <= 0x7ff) {
      addBytes(2);
    } else {
      addBytes(3);
    }
  }
}

function preflightCanonicalJsonByteSize(value, maxBytes, label) {
  let byteCount = 0;
  let nodeCount = 0;
  const activeObjects = new Set();
  const addBytes = (count) => {
    byteCount += count;
    if (byteCount > maxBytes) {
      fail('PACKAGE_LIMIT_EXCEEDED', `${label} exceeds its byte limit`);
    }
  };
  const stack = [{ kind: 'VALUE', value }];
  while (stack.length > 0) {
    const task = stack.pop();
    if (task.kind === 'EXIT') {
      activeObjects.delete(task.value);
      continue;
    }
    nodeCount += 1;
    if (nodeCount > MAX_PACKAGE_PREFLIGHT_NODES) {
      fail('PACKAGE_LIMIT_EXCEEDED', `${label} exceeds its structural limit`);
    }
    const current = task.value;
    if (current === null) {
      addBytes(4);
      continue;
    }
    const type = typeof current;
    if (type === 'string') {
      addJsonStringByteLength(current, addBytes);
      continue;
    }
    if (type === 'boolean') {
      addBytes(current ? 4 : 5);
      continue;
    }
    if (type === 'number') {
      if (!Number.isFinite(current)) {
        fail('INVALID_CONTRACT', `${label} contains a non-finite number`);
      }
      addBytes(Buffer.byteLength(String(current === 0 ? 0 : current), 'utf8'));
      continue;
    }
    if (type !== 'object') {
      fail('INVALID_CONTRACT', `${label} contains an unsupported JSON value`);
    }
    if (activeObjects.has(current)) {
      fail('INVALID_CONTRACT', `${label} contains a cyclic value`);
    }
    activeObjects.add(current);
    stack.push({ kind: 'EXIT', value: current });
    if (Array.isArray(current)) {
      const keys = Object.keys(current);
      if (keys.length !== current.length
        || keys.some((key, index) => key !== String(index))) {
        fail('INVALID_CONTRACT', `${label} contains a non-canonical array`);
      }
      addBytes(2 + Math.max(0, current.length - 1));
      for (let index = current.length - 1; index >= 0; index -= 1) {
        const descriptor = Object.getOwnPropertyDescriptor(current, String(index));
        if (!descriptor || !Object.hasOwn(descriptor, 'value')) {
          fail('INVALID_CONTRACT', `${label} contains an accessor array item`);
        }
        stack.push({ kind: 'VALUE', value: descriptor.value });
      }
      continue;
    }
    if (!plainObject(current)
      || Object.getOwnPropertySymbols(current).length > 0) {
      fail('INVALID_CONTRACT', `${label} contains a non-canonical object`);
    }
    const keys = Object.keys(current);
    addBytes(2 + Math.max(0, keys.length - 1));
    for (let index = keys.length - 1; index >= 0; index -= 1) {
      const key = keys[index];
      const descriptor = Object.getOwnPropertyDescriptor(current, key);
      if (!descriptor || !Object.hasOwn(descriptor, 'value')) {
        fail('INVALID_CONTRACT', `${label} contains an accessor property`);
      }
      addJsonStringByteLength(key, addBytes);
      addBytes(1);
      stack.push({ kind: 'VALUE', value: descriptor.value });
    }
  }
  return byteCount;
}

function requireDigest(value, label) {
  if (!SHA256_RE.test(value || '')) {
    fail('INVALID_DIGEST', `${label} must be a SHA-256 digest`);
  }
  return value;
}

function requireOrdinal(value, label) {
  if (!Number.isSafeInteger(value) || value < 0) {
    fail('INVALID_ORDINAL', `${label} must be a non-negative safe integer`);
  }
  return value;
}

function requireBoundedArray(value, label, { nonEmpty = false } = {}) {
  if (!Array.isArray(value)
    || value.length > MAX_SPANS_PER_CANDIDATE
    || (nonEmpty && value.length === 0)) {
    fail('INVALID_COLLECTION', `${label} must be a bounded${nonEmpty ? ' non-empty' : ''} array`);
  }
  return value;
}

function requireCount(value, label) {
  if (!Number.isSafeInteger(value) || value < 0) {
    fail('INVALID_COUNT', `${label} must be a non-negative safe integer`);
  }
  return value;
}

function requireExactValue(value, expected, label) {
  if (value !== expected) {
    fail('INVALID_CONTRACT', `${label} is outside its closed contract`);
  }
  return value;
}

function requireRawTerm(value, label) {
  if (typeof value !== 'string'
    || value.length === 0
    || Buffer.byteLength(value, 'utf8') > MAX_RAW_TERM_BYTES) {
    fail(
      'INVALID_RAW_TERM',
      `${label} must be non-empty and no more than ${MAX_RAW_TERM_BYTES} UTF-8 bytes`,
    );
  }
  return value;
}

function preflightSemanticSpanShape(span, label) {
  exactKeys(span, [
    'schema_version',
    'canonical_text_id',
    'absolute_start',
    'absolute_end',
    'semantic_span_id',
    'exact_bytes_digest',
  ], label);
  requireExactValue(span.schema_version, 'SEMANTIC_SPAN/V1', `${label}.schema_version`);
  requireDigest(span.canonical_text_id, `${label}.canonical_text_id`);
  requireOrdinal(span.absolute_start, `${label}.absolute_start`);
  if (!Number.isSafeInteger(span.absolute_end)
    || span.absolute_end <= span.absolute_start) {
    fail('INVALID_SPAN', `${label}.absolute_end must follow its start`);
  }
  requireDigest(span.semantic_span_id, `${label}.semantic_span_id`);
  requireDigest(span.exact_bytes_digest, `${label}.exact_bytes_digest`);
  return span;
}

function preflightDispositionEnvelopeShape(disposition, index) {
  const label = `reviewed_candidate_dispositions[${index}]`;
  if (!plainObject(disposition) || !DISPOSITIONS.has(disposition.disposition_code)) {
    fail('INVALID_DISPOSITION', `${label} has an unknown disposition`);
  }
  const commonKeys = [
    'schema_version',
    'admitted_definition_candidate_id',
    'governed_ordinal',
    'disposition_code',
    'review_reason_code',
    'reviewer_identity_digest',
    'reviewed_definition_candidate_disposition_id',
  ];
  const accepted = disposition.disposition_code === 'ACCEPTED_DEFINITION_CUE';
  exactKeys(
    disposition,
    accepted
      ? [
        ...commonKeys,
        'raw_term',
        'syntactic_role',
        'term_span',
        'body_spans',
        'use_spans',
      ]
      : commonKeys,
    label,
  );
  requireExactValue(
    disposition.schema_version,
    'REVIEWED_DEFINITION_CANDIDATE_DISPOSITION/V1',
    `${label}.schema_version`,
  );
  requireDigest(
    disposition.admitted_definition_candidate_id,
    `${label}.admitted_definition_candidate_id`,
  );
  requireOrdinal(disposition.governed_ordinal, `${label}.governed_ordinal`);
  requireDigest(disposition.reviewer_identity_digest, `${label}.reviewer_identity_digest`);
  requireDigest(
    disposition.reviewed_definition_candidate_disposition_id,
    `${label}.reviewed_definition_candidate_disposition_id`,
  );
  if (accepted) {
    requireExactValue(
      disposition.review_reason_code,
      'SOURCE_BACKED_SYNTACTIC_DEFINITION',
      `${label}.review_reason_code`,
    );
    requireRawTerm(disposition.raw_term, `${label}.raw_term`);
    if (!SYNTACTIC_ROLES.has(disposition.syntactic_role)) {
      fail('INVALID_SYNTACTIC_ROLE', `${label}.syntactic_role is outside its closed enum`);
    }
    requireBoundedArray(disposition.body_spans, `${label}.body_spans`, { nonEmpty: true });
    requireBoundedArray(disposition.use_spans, `${label}.use_spans`, { nonEmpty: true });
  } else {
    const reasons = disposition.disposition_code === 'UNRESOLVED'
      ? UNRESOLVED_REASONS
      : REJECTED_REASONS;
    if (!reasons.has(disposition.review_reason_code)) {
      fail('INVALID_REVIEW_REASON', `${label}.review_reason_code is outside its closed enum`);
    }
  }
  return disposition;
}

function preflightDispositionNestedShapes(disposition, index) {
  if (disposition.disposition_code !== 'ACCEPTED_DEFINITION_CUE') return;
  const label = `reviewed_candidate_dispositions[${index}]`;
  preflightSemanticSpanShape(disposition.term_span, `${label}.term_span`);
  disposition.body_spans.forEach((span, spanIndex) => {
    preflightSemanticSpanShape(span, `${label}.body_spans[${spanIndex}]`);
  });
  disposition.use_spans.forEach((use, useIndex) => {
    const useLabel = `${label}.use_spans[${useIndex}]`;
    exactKeys(use, ['span', 'use_role', 'source_order_ordinal'], useLabel);
    if (!USE_ROLES.has(use.use_role)) {
      fail('INVALID_USE_ROLE', `${useLabel}.use_role is outside its closed enum`);
    }
    requireOrdinal(use.source_order_ordinal, `${useLabel}.source_order_ordinal`);
    preflightSemanticSpanShape(use.span, `${useLabel}.span`);
  });
}

function preflightReviewedDefinitionGraphPackageBudget({
  scoped_candidate_count: scopedCandidateCount,
  reviewed_candidate_dispositions: reviewedCandidateDispositions,
  parent_scope_count: parentScopeCount,
  out_of_scope_candidate_count: outOfScopeCandidateCount,
  retained_residual_count: retainedResidualCount,
} = {}) {
  requireBoundedArray(
    reviewedCandidateDispositions,
    'reviewed_candidate_dispositions',
  );
  let aggregateCount = requireCount(scopedCandidateCount, 'scoped_candidate_count')
    + requireCount(parentScopeCount, 'parent_scope_count')
    + requireCount(outOfScopeCandidateCount, 'out_of_scope_candidate_count')
    + requireCount(retainedResidualCount, 'retained_residual_count');
  if (aggregateCount > MAX_AGGREGATE_NESTED_ITEMS) {
    fail(
      'AGGREGATE_NESTED_ITEM_LIMIT_EXCEEDED',
      'review package nested items exceed the aggregate preflight limit',
    );
  }
  reviewedCandidateDispositions.forEach((disposition, index) => {
    preflightDispositionEnvelopeShape(disposition, index);
    const bodySpanCount = disposition.disposition_code === 'ACCEPTED_DEFINITION_CUE'
      ? disposition.body_spans.length
      : 0;
    const useSpanCount = disposition.disposition_code === 'ACCEPTED_DEFINITION_CUE'
      ? disposition.use_spans.length
      : 0;
    aggregateCount += bodySpanCount + useSpanCount;
    if (aggregateCount > MAX_AGGREGATE_NESTED_ITEMS) {
      fail(
        'AGGREGATE_NESTED_ITEM_LIMIT_EXCEEDED',
        'review package nested items exceed the aggregate preflight limit',
      );
    }
  });
  reviewedCandidateDispositions.forEach(preflightDispositionNestedShapes);
  return aggregateCount;
}

function validateSpan(source, span, label) {
  preflightSemanticSpanShape(span, label);
  let rebuilt;
  try {
    rebuilt = buildSemanticSpan(source, span.absolute_start, span.absolute_end);
  } catch (error) {
    fail('INVALID_SPAN', `${label} is outside the exact admitted source: ${error.message}`);
  }
  if (canonicalJson(span) !== canonicalJson(rebuilt)) {
    fail('INVALID_SPAN', `${label} identity does not match the exact admitted source`);
  }
  return span;
}

function spanInside(inner, outer) {
  return inner.absolute_start >= outer.absolute_start
    && inner.absolute_end <= outer.absolute_end;
}

function adjacentUtf8Character(bytes, byteOffset, direction) {
  if (direction < 0) {
    if (byteOffset === 0) return '';
    let start = byteOffset - 1;
    while (start > 0 && (bytes[start] & 0xc0) === 0x80) start -= 1;
    return bytes.subarray(start, byteOffset).toString('utf8');
  }
  if (byteOffset >= bytes.length) return '';
  const first = bytes[byteOffset];
  const length = first < 0x80 ? 1
    : first < 0xe0 ? 2
      : first < 0xf0 ? 3 : 4;
  return bytes.subarray(byteOffset, byteOffset + length).toString('utf8');
}

function requireDefinitionUseTokenBoundaries(source, span, label) {
  const bytes = Buffer.from(source.canonical_text.text, 'utf8');
  const preceding = adjacentUtf8Character(bytes, span.absolute_start, -1);
  const following = adjacentUtf8Character(bytes, span.absolute_end, 1);
  if ((preceding && TOKEN_CONTINUATION_RE.test(preceding))
    || (following && TOKEN_CONTINUATION_RE.test(following))) {
    fail(
      'INVALID_USE_TOKEN_BOUNDARY',
      `${label} must identify the complete defined-term token`,
    );
  }
}

function candidateId(candidate) {
  requireDigest(
    candidate && candidate.admitted_definition_candidate_id,
    'admitted_definition_candidate_id',
  );
  requireOrdinal(candidate.governed_ordinal, 'candidate.governed_ordinal');
  return candidate.admitted_definition_candidate_id;
}

function reviewIdentity(domain, body) {
  return {
    ...body,
    reviewed_definition_candidate_disposition_id: contentId(domain, body),
  };
}

function buildAcceptedDefinitionCandidateDisposition({
  source,
  candidate,
  term_span: termSpan,
  body_spans: bodySpans,
  use_spans: useSpans,
  syntactic_role: syntacticRole,
  reviewer_identity_digest: reviewerIdentityDigest,
} = {}) {
  const admittedCandidateId = candidateId(candidate);
  requireDigest(reviewerIdentityDigest, 'reviewer_identity_digest');
  requireRawTerm(candidate && candidate.neutral_defined_term, 'candidate.neutral_defined_term');
  if (!SYNTACTIC_ROLES.has(syntacticRole)) {
    fail('INVALID_SYNTACTIC_ROLE', 'syntactic_role is outside its closed enum');
  }
  validateSpan(source, termSpan, 'term_span');
  requireBoundedArray(bodySpans, 'body_spans', { nonEmpty: true });
  requireBoundedArray(useSpans, 'use_spans', { nonEmpty: true });
  const orderedBodies = [...bodySpans].map((span, index) => (
    validateSpan(source, span, `body_spans[${index}]`)
  )).sort((left, right) => (
    left.absolute_start - right.absolute_start
      || left.semantic_span_id.localeCompare(right.semantic_span_id)
  ));
  const cue = buildDefinitionCue({
    source,
    termSpan,
    bodySpans: orderedBodies,
    rawTerm: candidate.neutral_defined_term,
    syntacticRole,
    ordinal: candidate.governed_ordinal,
  });
  const seenUseSpanIds = new Set();
  const seenUseCueIds = new Set();
  const coordinateOrderedUses = [...useSpans].map((item, index) => {
    exactKeys(item, ['span', 'use_role', 'source_order_ordinal'], `use_spans[${index}]`);
    if (!USE_ROLES.has(item.use_role)) {
      fail('INVALID_USE_ROLE', `use_spans[${index}].use_role is outside its closed enum`);
    }
    requireOrdinal(item.source_order_ordinal, `use_spans[${index}].source_order_ordinal`);
    validateSpan(source, item.span, `use_spans[${index}].span`);
    const exactUseText = utf8Slice(
      source.canonical_text.text,
      item.span.absolute_start,
      item.span.absolute_end,
    );
    if (exactUseText !== candidate.neutral_defined_term) {
      fail(
        'USE_TERM_MISMATCH',
        'definition use bytes must equal the accepted raw term',
      );
    }
    requireDefinitionUseTokenBoundaries(source, item.span, `use_spans[${index}].span`);
    if (item.use_role !== 'DECLARATION_REFERENCE'
      && item.span.semantic_span_id === termSpan.semantic_span_id) {
      fail(
        'DECLARATION_SPAN_REUSED',
        'the declaration term span cannot also serve as an operative use',
      );
    }
    if (seenUseSpanIds.has(item.span.semantic_span_id)) {
      fail('DUPLICATE_USE_SPAN', 'definition use spans must be unique');
    }
    seenUseSpanIds.add(item.span.semantic_span_id);
    const useCue = buildDefinitionUseCue({
      source,
      definitionCue: cue,
      useSpan: item.span,
      useRole: item.use_role,
      ordinal: item.source_order_ordinal,
    });
    if (seenUseCueIds.has(useCue.definition_use_cue_id)) {
      fail('DUPLICATE_USE_IDENTITY', 'definition use cue identities must be unique');
    }
    seenUseCueIds.add(useCue.definition_use_cue_id);
    return item;
  }).sort((left, right) => (
    left.span.absolute_start - right.span.absolute_start
      || left.span.absolute_end - right.span.absolute_end
      || left.span.semantic_span_id.localeCompare(right.span.semantic_span_id)
  ));
  coordinateOrderedUses.forEach((item, index) => {
    if (item.source_order_ordinal !== index) {
      fail(
        'NON_CANONICAL_USE_ORDINAL',
        'definition use ordinals must be contiguous and derived from source coordinates',
      );
    }
  });
  const declarationUses = coordinateOrderedUses.filter(
    (item) => item.use_role === 'DECLARATION_REFERENCE',
  );
  if (declarationUses.length !== 1
    || declarationUses[0].span.semantic_span_id !== termSpan.semantic_span_id) {
    fail(
      'INVALID_DECLARATION_USE',
      'an accepted definition requires one declaration use equal to its term span',
    );
  }
  if (!spanInside(termSpan, candidate.evidence_anchor)
    || orderedBodies.some((span) => !spanInside(span, candidate.evidence_anchor))) {
    fail(
      'CANDIDATE_EVIDENCE_MISMATCH',
      'accepted definition term and body must remain inside parser candidate evidence',
    );
  }
  const body = {
    schema_version: 'REVIEWED_DEFINITION_CANDIDATE_DISPOSITION/V1',
    admitted_definition_candidate_id: admittedCandidateId,
    governed_ordinal: candidate.governed_ordinal,
    disposition_code: 'ACCEPTED_DEFINITION_CUE',
    review_reason_code: 'SOURCE_BACKED_SYNTACTIC_DEFINITION',
    reviewer_identity_digest: reviewerIdentityDigest,
    raw_term: candidate.neutral_defined_term,
    syntactic_role: syntacticRole,
    term_span: termSpan,
    body_spans: orderedBodies,
    use_spans: coordinateOrderedUses,
  };
  return freeze(reviewIdentity('REVIEWED_DEFINITION_CANDIDATE_DISPOSITION/V1', body));
}

function buildUnresolvedDefinitionCandidateDisposition({
  candidate,
  review_reason_code: reviewReasonCode,
  reviewer_identity_digest: reviewerIdentityDigest,
} = {}) {
  const admittedCandidateId = candidateId(candidate);
  requireDigest(reviewerIdentityDigest, 'reviewer_identity_digest');
  if (!UNRESOLVED_REASONS.has(reviewReasonCode)) {
    fail('INVALID_REVIEW_REASON', 'unknown unresolved definition review reason');
  }
  const body = {
    schema_version: 'REVIEWED_DEFINITION_CANDIDATE_DISPOSITION/V1',
    admitted_definition_candidate_id: admittedCandidateId,
    governed_ordinal: candidate.governed_ordinal,
    disposition_code: 'UNRESOLVED',
    review_reason_code: reviewReasonCode,
    reviewer_identity_digest: reviewerIdentityDigest,
  };
  return freeze(reviewIdentity('REVIEWED_DEFINITION_CANDIDATE_DISPOSITION/V1', body));
}

function buildRejectedDefinitionCandidateDisposition({
  candidate,
  review_reason_code: reviewReasonCode,
  reviewer_identity_digest: reviewerIdentityDigest,
} = {}) {
  const admittedCandidateId = candidateId(candidate);
  requireDigest(reviewerIdentityDigest, 'reviewer_identity_digest');
  if (!REJECTED_REASONS.has(reviewReasonCode)) {
    fail('INVALID_REVIEW_REASON', 'unknown rejected definition review reason');
  }
  const body = {
    schema_version: 'REVIEWED_DEFINITION_CANDIDATE_DISPOSITION/V1',
    admitted_definition_candidate_id: admittedCandidateId,
    governed_ordinal: candidate.governed_ordinal,
    disposition_code: 'REJECTED_NOT_SYNTACTIC_DEFINITION',
    review_reason_code: reviewReasonCode,
    reviewer_identity_digest: reviewerIdentityDigest,
  };
  return freeze(reviewIdentity('REVIEWED_DEFINITION_CANDIDATE_DISPOSITION/V1', body));
}

function buildNoModelInferenceTranscriptSetMarker({
  semantic_extraction_input_envelope: semanticExtractionInputEnvelope,
} = {}) {
  requireDigest(
    semanticExtractionInputEnvelope
      && semanticExtractionInputEnvelope.semantic_extraction_input_envelope_id,
    'semantic_extraction_input_envelope_id',
  );
  const body = {
    schema_version: 'SEMANTIC_INFERENCE_TRANSCRIPT_SET_MARKER/V1',
    transcript_set_marker: 'NO_MODEL_INFERENCE_USED',
    semantic_extraction_input_envelope_id:
      semanticExtractionInputEnvelope.semantic_extraction_input_envelope_id,
    semantic_extraction_input_envelope_payload_digest: contentId(
      'SEMANTIC_EXTRACTION_INPUT_ENVELOPE_OBJECT/V1',
      semanticExtractionInputEnvelope,
    ),
    ordered_transcript_ids: [],
    ordered_transcript_payload_digests: [],
  };
  return freeze({
    ...body,
    semantic_inference_transcript_set_marker_id: contentId(
      'SEMANTIC_INFERENCE_TRANSCRIPT_SET_MARKER/V1',
      body,
    ),
  });
}

function buildDefinitionGraphNormaliserIdentity(callerInput) {
  if (callerInput !== undefined) {
    fail(
      'CALLER_NORMALISER_IDENTITY_FORBIDDEN',
      'normaliser identity is derived from governed module bytes and closed configuration',
    );
  }
  const executableSemanticClosure = deriveNormaliserSemanticClosureModuleKeys().map(
    (moduleKey) => ({
      module_key: moduleKey,
      module_digest: sha256Hex(readFileSync(resolve(REPOSITORY_ROOT, moduleKey))),
    }),
  );
  const executableSemanticClosureDigest = contentId(
    'DEFINITION_GRAPH_NORMALISER_SEMANTIC_CLOSURE/V1',
    executableSemanticClosure,
  );
  const configurationDigest = contentId(
    'DEFINITION_GRAPH_NORMALISER_CONFIGURATION/V2',
    NORMALISER_CONFIGURATION,
  );
  const body = {
    schema_version: 'DEFINITION_GRAPH_NORMALISER_IDENTITY/V2',
    normaliser_key: 'REVIEWED_DEFINITION_GRAPH_NORMALISER',
    normaliser_version: 2,
    authority_scope: 'DEFINITION_CUE_AND_USE_ONLY',
    executable_semantic_closure: executableSemanticClosure,
    executable_semantic_closure_digest: executableSemanticClosureDigest,
    configuration: NORMALISER_CONFIGURATION,
    configuration_digest: configurationDigest,
  };
  return freeze({
    ...body,
    definition_graph_normaliser_id: contentId(
      'DEFINITION_GRAPH_NORMALISER_IDENTITY/V2',
      body,
    ),
    canonical_payload_digest: contentId(
      'DEFINITION_GRAPH_NORMALISER_IDENTITY_PAYLOAD/V2',
      body,
    ),
  });
}

function validateTranscriptSetMarker(marker, semanticExtractionInputEnvelope) {
  exactKeys(marker, TRANSCRIPT_SET_MARKER_KEYS, 'inference_transcript_set_marker');
  requireExactValue(
    marker.schema_version,
    'SEMANTIC_INFERENCE_TRANSCRIPT_SET_MARKER/V1',
    'inference_transcript_set_marker.schema_version',
  );
  requireExactValue(
    marker.transcript_set_marker,
    'NO_MODEL_INFERENCE_USED',
    'inference transcript set marker',
  );
  requireDigest(
    marker.semantic_extraction_input_envelope_id,
    'inference_transcript_set_marker.semantic_extraction_input_envelope_id',
  );
  requireDigest(
    marker.semantic_extraction_input_envelope_payload_digest,
    'inference_transcript_set_marker.semantic_extraction_input_envelope_payload_digest',
  );
  if (!Array.isArray(marker.ordered_transcript_ids)
    || marker.ordered_transcript_ids.length !== 0
    || !Array.isArray(marker.ordered_transcript_payload_digests)
    || marker.ordered_transcript_payload_digests.length !== 0) {
    fail(
      'INVALID_CONTRACT',
      'inference_transcript_set_marker must contain exact empty transcript collections',
    );
  }
  requireDigest(
    marker.semantic_inference_transcript_set_marker_id,
    'inference_transcript_set_marker.semantic_inference_transcript_set_marker_id',
  );
  preflightCanonicalJsonByteSize(
    marker,
    MAX_PACKAGE_BYTES,
    'inference transcript set marker',
  );
  const expected = buildNoModelInferenceTranscriptSetMarker({
    semantic_extraction_input_envelope: semanticExtractionInputEnvelope,
  });
  if (canonicalJson(marker) !== canonicalJson(expected)) {
    fail(
      'TRANSCRIPT_SET_MISMATCH',
      'transcript set must be the exact NO_MODEL_INFERENCE_USED marker',
    );
  }
}

function validateNormaliserIdentity(identity) {
  exactKeys(identity, NORMALISER_IDENTITY_KEYS, 'normaliser_identity');
  requireExactValue(
    identity.schema_version,
    'DEFINITION_GRAPH_NORMALISER_IDENTITY/V2',
    'normaliser_identity.schema_version',
  );
  requireExactValue(
    identity.normaliser_key,
    'REVIEWED_DEFINITION_GRAPH_NORMALISER',
    'normaliser_identity.normaliser_key',
  );
  requireExactValue(
    identity.normaliser_version,
    2,
    'normaliser_identity.normaliser_version',
  );
  requireExactValue(
    identity.authority_scope,
    'DEFINITION_CUE_AND_USE_ONLY',
    'normaliser_identity.authority_scope',
  );
  const expectedModuleKeys = deriveNormaliserSemanticClosureModuleKeys();
  if (!Array.isArray(identity.executable_semantic_closure)
    || identity.executable_semantic_closure.length
      !== expectedModuleKeys.length) {
    fail(
      'NORMALISER_IDENTITY_MISMATCH',
      'normaliser semantic closure does not match its governed module set',
    );
  }
  identity.executable_semantic_closure.forEach((entry, index) => {
    exactKeys(entry, ['module_key', 'module_digest'], `normaliser closure module[${index}]`);
    requireExactValue(
      entry.module_key,
      expectedModuleKeys[index],
      `normaliser closure module[${index}].module_key`,
    );
    requireDigest(entry.module_digest, `normaliser closure module[${index}].module_digest`);
  });
  requireDigest(
    identity.executable_semantic_closure_digest,
    'normaliser_identity.executable_semantic_closure_digest',
  );
  exactKeys(
    identity.configuration,
    NORMALISER_CONFIGURATION_KEYS,
    'normaliser_identity.configuration',
  );
  for (const key of NORMALISER_CONFIGURATION_KEYS) {
    const actual = identity.configuration[key];
    const expectedValue = NORMALISER_CONFIGURATION[key];
    if (Array.isArray(expectedValue)) {
      if (!Array.isArray(actual)
        || actual.length !== expectedValue.length
        || actual.some((value, index) => value !== expectedValue[index])) {
        fail(
          'NORMALISER_IDENTITY_MISMATCH',
          `normaliser_identity.configuration.${key} is outside its closed contract`,
        );
      }
    } else {
      requireExactValue(
        actual,
        expectedValue,
        `normaliser_identity.configuration.${key}`,
      );
    }
  }
  requireDigest(identity.configuration_digest, 'normaliser_identity.configuration_digest');
  requireDigest(
    identity.definition_graph_normaliser_id,
    'normaliser_identity.definition_graph_normaliser_id',
  );
  requireDigest(
    identity.canonical_payload_digest,
    'normaliser_identity.canonical_payload_digest',
  );
  preflightCanonicalJsonByteSize(
    identity,
    MAX_PACKAGE_BYTES,
    'normaliser identity',
  );
  const expected = buildDefinitionGraphNormaliserIdentity();
  if (canonicalJson(identity) !== canonicalJson(expected)) {
    fail('NORMALISER_IDENTITY_MISMATCH', 'normaliser identity does not match its payload');
  }
}

function sourceLineage({
  immutableSourceDocument,
  sourceAdmissionManifest,
  semanticExtractionInputEnvelope,
  conversion,
  admittedSourceContext,
}) {
  const body = {
    schema_version: 'REVIEWED_DEFINITION_SOURCE_LINEAGE/V1',
    immutable_source_document_id:
      immutableSourceDocument.immutable_source_document_id,
    immutable_source_document_payload_digest: contentId(
      'IMMUTABLE_SOURCE_DOCUMENT_OBJECT/V2',
      immutableSourceDocument,
    ),
    source_admission_manifest_id:
      sourceAdmissionManifest.source_admission_manifest_id,
    source_admission_manifest_payload_digest: contentId(
      'SOURCE_ADMISSION_MANIFEST_OBJECT/V2',
      sourceAdmissionManifest,
    ),
    semantic_extraction_input_envelope_id:
      semanticExtractionInputEnvelope.semantic_extraction_input_envelope_id,
    semantic_extraction_input_envelope_payload_digest: contentId(
      'SEMANTIC_EXTRACTION_INPUT_ENVELOPE_OBJECT/V1',
      semanticExtractionInputEnvelope,
    ),
    conversion_payload_digest: contentId(
      'SEC_HTML_CANONICAL_TEXT_CONVERSION_OBJECT/V2',
      conversion,
    ),
    admitted_semantic_source_context_id:
      admittedSourceContext.admitted_semantic_source_context_id,
    admitted_semantic_source_context_payload_digest: contentId(
      'ADMITTED_SEMANTIC_SOURCE_CONTEXT_OBJECT/V1',
      admittedSourceContext,
    ),
  };
  return freeze({
    ...body,
    reviewed_definition_source_lineage_id: contentId(
      'REVIEWED_DEFINITION_SOURCE_LINEAGE/V1',
      body,
    ),
  });
}

function parserProposalReference({
  admittedParserProposalEnvelope,
  governedParentSectionProposalIds,
}) {
  const body = {
    schema_version: 'REVIEWED_DEFINITION_PARSER_PROPOSAL_REFERENCE/V1',
    admitted_parser_proposal_envelope_id:
      admittedParserProposalEnvelope.admitted_parser_proposal_envelope_id,
    admitted_parser_proposal_envelope_payload_digest:
      admittedParserProposalEnvelope.canonical_payload_digest,
    parser_runtime_manifest_id:
      admittedParserProposalEnvelope.parser_runtime_manifest_id,
    governed_parent_section_proposal_ids: governedParentSectionProposalIds,
  };
  return freeze({
    ...body,
    reviewed_definition_parser_proposal_reference_id: contentId(
      'REVIEWED_DEFINITION_PARSER_PROPOSAL_REFERENCE/V1',
      body,
    ),
  });
}

function validateDisposition({
  disposition,
  source,
  candidate,
}) {
  if (!DISPOSITIONS.has(disposition && disposition.disposition_code)) {
    fail('INVALID_DISPOSITION', 'unknown reviewed definition candidate disposition');
  }
  let expected;
  if (disposition.disposition_code === 'ACCEPTED_DEFINITION_CUE') {
    expected = buildAcceptedDefinitionCandidateDisposition({
      source,
      candidate,
      term_span: disposition.term_span,
      body_spans: disposition.body_spans,
      use_spans: disposition.use_spans,
      syntactic_role: disposition.syntactic_role,
      reviewer_identity_digest: disposition.reviewer_identity_digest,
    });
  } else if (disposition.disposition_code === 'UNRESOLVED') {
    expected = buildUnresolvedDefinitionCandidateDisposition({
      candidate,
      review_reason_code: disposition.review_reason_code,
      reviewer_identity_digest: disposition.reviewer_identity_digest,
    });
  } else {
    expected = buildRejectedDefinitionCandidateDisposition({
      candidate,
      review_reason_code: disposition.review_reason_code,
      reviewer_identity_digest: disposition.reviewer_identity_digest,
    });
  }
  if (canonicalJson(disposition) !== canonicalJson(expected)) {
    fail(
      'DISPOSITION_IDENTITY_MISMATCH',
      'reviewed definition candidate disposition does not match exact source and candidate',
    );
  }
  return expected;
}

function buildReviewedDefinitionGraphPackage({
  contract_bundle: contractBundle,
  immutable_source_document: immutableSourceDocument,
  source_admission_manifest: sourceAdmissionManifest,
  semantic_extraction_input_envelope: semanticExtractionInputEnvelope,
  conversion,
  admitted_source_context: admittedSourceContext,
  admitted_parser_proposal_envelope: admittedParserProposalEnvelope,
  inference_transcript_set_marker: inferenceTranscriptSetMarker,
  reviewed_candidate_dispositions: reviewedCandidateDispositions,
  normaliser_identity: callerNormaliserIdentity,
  governed_parent_section_proposal_ids: governedParentSectionProposalIds,
} = {}) {
  validateContractBundle(contractBundle);
  validateAdmittedSemanticSourceContext({
    context: admittedSourceContext,
    immutable_source_document: immutableSourceDocument,
    source_admission_manifest: sourceAdmissionManifest,
    semantic_extraction_input_envelope: semanticExtractionInputEnvelope,
    conversion,
    governed_deal_key: admittedSourceContext && admittedSourceContext.governed_deal_key,
    deal_admission_id: admittedSourceContext && admittedSourceContext.deal_admission_id,
    source_ordinal: admittedSourceContext && admittedSourceContext.source_ordinal,
  });
  validateAdmittedParserProposalEnvelope({
    proposal_envelope: admittedParserProposalEnvelope,
    contract_bundle: contractBundle,
    immutable_source_document: immutableSourceDocument,
    source_admission_manifest: sourceAdmissionManifest,
    semantic_extraction_input_envelope: semanticExtractionInputEnvelope,
    conversion,
    admitted_source_context: admittedSourceContext,
  });
  validateTranscriptSetMarker(
    inferenceTranscriptSetMarker,
    semanticExtractionInputEnvelope,
  );
  if (callerNormaliserIdentity !== undefined) {
    fail(
      'CALLER_NORMALISER_IDENTITY_FORBIDDEN',
      'normaliser identity cannot be supplied by the package caller',
    );
  }
  const normaliserIdentity = buildDefinitionGraphNormaliserIdentity();
  validateNormaliserIdentity(normaliserIdentity);
  if (!Array.isArray(reviewedCandidateDispositions)
    || reviewedCandidateDispositions.length > MAX_REVIEWED_CANDIDATES) {
    fail(
      'INVALID_REVIEW_COLLECTION',
      'reviewed candidate dispositions must be a bounded array',
    );
  }

  requireBoundedArray(
    governedParentSectionProposalIds,
    'governed_parent_section_proposal_ids',
    { nonEmpty: true },
  );
  const requestedParentIds = new Set();
  governedParentSectionProposalIds.forEach((id) => {
    requireDigest(id, 'governed_parent_section_proposal_id');
    if (requestedParentIds.has(id)) {
      fail('DUPLICATE_PARENT_SCOPE', 'governed parent section scope contains a duplicate');
    }
    requestedParentIds.add(id);
  });
  const orderedParentIds = admittedParserProposalEnvelope.structural_section_proposals
    .filter((section) => requestedParentIds.has(
      section.admitted_structural_section_proposal_id,
    ))
    .map((section) => section.admitted_structural_section_proposal_id);
  if (orderedParentIds.length !== requestedParentIds.size) {
    fail('UNKNOWN_PARENT_SCOPE', 'governed parent section scope names an unknown proposal');
  }

  const allCandidates = admittedParserProposalEnvelope.definition_candidates;
  const candidates = allCandidates.filter((candidate) => requestedParentIds.has(
    candidate.parent_structural_section_proposal_id,
  ));
  const outOfScopeCandidates = allCandidates.filter((candidate) => !requestedParentIds.has(
    candidate.parent_structural_section_proposal_id,
  ));
  if (candidates.length > MAX_REVIEWED_CANDIDATES) {
    fail('CANDIDATE_LIMIT_EXCEEDED', 'parser candidates exceed the review package limit');
  }
  const aggregateNestedItemCount = preflightReviewedDefinitionGraphPackageBudget({
    scoped_candidate_count: candidates.length,
    reviewed_candidate_dispositions: reviewedCandidateDispositions,
    parent_scope_count: orderedParentIds.length,
    out_of_scope_candidate_count: outOfScopeCandidates.length,
    retained_residual_count: admittedParserProposalEnvelope.residuals.length,
  });
  const candidateById = new Map(candidates.map((candidate) => [
    candidateId(candidate),
    candidate,
  ]));
  const dispositionByCandidate = new Map();
  for (const disposition of reviewedCandidateDispositions) {
    const id = disposition && disposition.admitted_definition_candidate_id;
    if (!candidateById.has(id)) {
      fail('UNKNOWN_REVIEWED_CANDIDATE', 'review disposition names an unknown parser candidate');
    }
    if (dispositionByCandidate.has(id)) {
      fail('DUPLICATE_REVIEWED_CANDIDATE', 'parser candidate has duplicate dispositions');
    }
    dispositionByCandidate.set(id, disposition);
  }
  if (dispositionByCandidate.size !== candidates.length) {
    fail(
      'INCOMPLETE_REVIEW_COVERAGE',
      'every parser definition candidate requires one explicit disposition',
    );
  }

  const orderedDispositions = candidates.map((candidate) => {
    const disposition = dispositionByCandidate.get(candidate.admitted_definition_candidate_id);
    return validateDisposition({
      disposition,
      source: admittedSourceContext,
      candidate,
    });
  });

  const definitionCues = [];
  const definitionUseCues = [];
  for (const disposition of orderedDispositions) {
    if (disposition.disposition_code !== 'ACCEPTED_DEFINITION_CUE') continue;
    const cue = buildDefinitionCue({
      source: admittedSourceContext,
      termSpan: disposition.term_span,
      bodySpans: disposition.body_spans,
      rawTerm: disposition.raw_term,
      syntacticRole: disposition.syntactic_role,
      ordinal: disposition.governed_ordinal,
    });
    definitionCues.push(cue);
    disposition.use_spans.forEach((item) => {
      definitionUseCues.push(buildDefinitionUseCue({
        source: admittedSourceContext,
        definitionCue: cue,
        useSpan: item.span,
        useRole: item.use_role,
        ordinal: item.source_order_ordinal,
      }));
    });
  }
  const graph = buildValidatedDefinitionGraph({
    source: admittedSourceContext,
    definitionCues,
    definitionUseCues,
  });
  validateValidatedDefinitionGraph({
    source: admittedSourceContext,
    graph,
  });

  const parserDefinitionCandidateIds = candidates.map(
    (candidate) => candidate.admitted_definition_candidate_id,
  );
  const outOfScopeParserDefinitionCandidateIds = outOfScopeCandidates.map(
    (candidate) => candidate.admitted_definition_candidate_id,
  );
  const retainedParserResidualIds = admittedParserProposalEnvelope.residuals
    .map((residual) => residual.admitted_parser_residual_id)
    .sort();
  const unresolvedCount = orderedDispositions.filter(
    (disposition) => disposition.disposition_code === 'UNRESOLVED',
  ).length;
  const lineage = sourceLineage({
    immutableSourceDocument,
    sourceAdmissionManifest,
    semanticExtractionInputEnvelope,
    conversion,
    admittedSourceContext,
  });
  const proposalReference = parserProposalReference({
    admittedParserProposalEnvelope,
    governedParentSectionProposalIds: orderedParentIds,
  });
  const body = {
    schema_version: 'REVIEWED_DEFINITION_GRAPH_PACKAGE/V1',
    authority_scope: 'OFFLINE_REVIEWED_DEFINITION_GRAPH_ONLY',
    contract_fingerprint: contractBundle.fingerprint,
    source_lineage: lineage,
    parser_proposal_reference: proposalReference,
    inference_transcript_set_marker: inferenceTranscriptSetMarker,
    normaliser_identity: normaliserIdentity,
    scoped_parser_definition_candidate_ids: parserDefinitionCandidateIds,
    out_of_scope_parser_definition_candidate_ids:
      outOfScopeParserDefinitionCandidateIds,
    reviewed_definition_candidate_disposition_ids: orderedDispositions.map(
      (disposition) => disposition.reviewed_definition_candidate_disposition_id,
    ),
    reviewed_candidate_dispositions: orderedDispositions,
    retained_parser_residual_ids: retainedParserResidualIds,
    aggregate_nested_item_count: aggregateNestedItemCount,
    validated_semantic_graph: graph,
    review_renderable: graph.definition_cues.length > 0,
    release_eligible: unresolvedCount === 0 && retainedParserResidualIds.length === 0,
  };
  const packageValue = {
    ...body,
    reviewed_definition_graph_package_id: contentId(
      'REVIEWED_DEFINITION_GRAPH_PACKAGE/V1',
      body,
    ),
    canonical_payload_digest: contentId(
      'REVIEWED_DEFINITION_GRAPH_PACKAGE_PAYLOAD/V1',
      body,
    ),
  };
  if (Buffer.byteLength(canonicalJson(packageValue), 'utf8') > MAX_PACKAGE_BYTES) {
    fail('PACKAGE_LIMIT_EXCEEDED', 'reviewed definition graph package exceeds its byte limit');
  }
  return freeze(packageValue);
}

function validateReviewedDefinitionGraphPackage({
  reviewed_definition_graph_package: reviewedDefinitionGraphPackage,
  ...inputs
} = {}) {
  if (!plainObject(reviewedDefinitionGraphPackage)) {
    fail('INVALID_PACKAGE', 'reviewed_definition_graph_package is required');
  }
  exactKeys(
    reviewedDefinitionGraphPackage,
    REVIEWED_DEFINITION_GRAPH_PACKAGE_KEYS,
    'reviewed_definition_graph_package',
  );
  preflightCanonicalJsonByteSize(
    reviewedDefinitionGraphPackage,
    MAX_PACKAGE_BYTES,
    'reviewed definition graph package',
  );
  validateTranscriptSetMarker(
    reviewedDefinitionGraphPackage.inference_transcript_set_marker,
    inputs.semantic_extraction_input_envelope,
  );
  validateNormaliserIdentity(reviewedDefinitionGraphPackage.normaliser_identity);
  preflightReviewedDefinitionGraphPackageBudget({
    scoped_candidate_count: Array.isArray(
      reviewedDefinitionGraphPackage.scoped_parser_definition_candidate_ids,
    )
      ? reviewedDefinitionGraphPackage.scoped_parser_definition_candidate_ids.length
      : null,
    reviewed_candidate_dispositions:
      reviewedDefinitionGraphPackage.reviewed_candidate_dispositions,
    parent_scope_count: reviewedDefinitionGraphPackage.parser_proposal_reference
      && Array.isArray(
        reviewedDefinitionGraphPackage.parser_proposal_reference
          .governed_parent_section_proposal_ids,
      )
      ? reviewedDefinitionGraphPackage.parser_proposal_reference
        .governed_parent_section_proposal_ids.length
      : null,
    out_of_scope_candidate_count: Array.isArray(
      reviewedDefinitionGraphPackage.out_of_scope_parser_definition_candidate_ids,
    )
      ? reviewedDefinitionGraphPackage.out_of_scope_parser_definition_candidate_ids.length
      : null,
    retained_residual_count: Array.isArray(
      reviewedDefinitionGraphPackage.retained_parser_residual_ids,
    )
      ? reviewedDefinitionGraphPackage.retained_parser_residual_ids.length
      : null,
  });
  const expected = buildReviewedDefinitionGraphPackage(inputs);
  if (canonicalJson(reviewedDefinitionGraphPackage) !== canonicalJson(expected)) {
    fail(
      'PACKAGE_MISMATCH',
      'reviewed definition graph package does not match its exact inputs',
    );
  }
  return true;
}

module.exports = {
  ReviewedDefinitionGraphPackageError,
  buildAcceptedDefinitionCandidateDisposition,
  buildDefinitionGraphNormaliserIdentity,
  buildNoModelInferenceTranscriptSetMarker,
  buildRejectedDefinitionCandidateDisposition,
  buildReviewedDefinitionGraphPackage,
  buildUnresolvedDefinitionCandidateDisposition,
  preflightReviewedDefinitionGraphPackageBudget,
  validateReviewedDefinitionGraphPackage,
};
