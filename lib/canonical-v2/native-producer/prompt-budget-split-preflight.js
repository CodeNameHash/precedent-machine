'use strict';

const {
  canonicalJson,
  contentId,
  sha256Hex,
  utf8ByteLength,
  utf8Slice,
} = require('../canonical-bytes');
const { getProducerPromptModule, listRegisteredSectionFamilies } = require('./producer-prompt-registry');
const { bindNativePromptToGovernedScope } = require('./native-prompt-binding');
const {
  SECTION_FAMILY_DEFINED_TERM_ANCHORED,
  SECTION_FAMILY_RULE_CLASSIFIED,
  classifyDeterministicSectionFamilies,
} = require('./section-family-classifier');

const SPLIT_PREFLIGHT_SCHEMA = 'NATIVE_PROMPT_BUDGET_SPLIT_PREFLIGHT/V1';
const SPLIT_WORK_ITEM_SCHEMA = 'NATIVE_PROMPT_BUDGET_SPLIT_WORK_ITEM/V1';
const SPLIT_PROMPT_DOMAIN = 'NATIVE_PROMPT_BUDGET_SPLIT_PROMPT/V1';
const DEFAULT_MAX_SPLIT_DEPTH = 4;
const DIGEST_RE = /^[a-f0-9]{64}$/;
const ACCEPTED_PROVENANCE = new Set([
  SECTION_FAMILY_RULE_CLASSIFIED,
  SECTION_FAMILY_DEFINED_TERM_ANCHORED,
]);

class PromptBudgetSplitPreflightError extends Error {
  constructor(code, message, details = {}) {
    super(message);
    this.name = 'PromptBudgetSplitPreflightError';
    this.code = code;
    this.details = Object.freeze({ ...details });
  }
}

function fail(code, message, details) {
  throw new PromptBudgetSplitPreflightError(code, message, details);
}

function exactKeys(value, keys) {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value)
    && canonicalJson(Object.keys(value).sort()) === canonicalJson([...keys].sort());
}

function exactNodeTree(tree) {
  if (!tree || !Array.isArray(tree.nodes)) fail('SECTION_TREE_REQUIRED', 'A section tree with nodes is required.');
  const byId = new Map();
  for (const node of tree.nodes) {
    if (!node || typeof node.section_id !== 'string' || !node.section_id
      || !Number.isSafeInteger(node.start) || node.start < 0
      || !Number.isSafeInteger(node.end) || node.end <= node.start
      || typeof node.text_sha256 !== 'string' || !DIGEST_RE.test(node.text_sha256)) {
      fail('SECTION_TREE_NODE_INVALID', 'Each section tree node must have an exact non-empty byte range.');
    }
    if (byId.has(node.section_id)) fail('SECTION_TREE_DUPLICATE_ID', 'Section tree node IDs must be unique.');
    byId.set(node.section_id, node);
  }
  return byId;
}

function validateTreeBinding({ tree, canonicalText, documentHash }) {
  const byId = exactNodeTree(tree);
  if (typeof canonicalText !== 'string') fail('CANONICAL_TEXT_REQUIRED', 'canonical_text must be a string.');
  if (typeof documentHash !== 'string' || !DIGEST_RE.test(documentHash)) {
    fail('DOCUMENT_HASH_REQUIRED', 'document_hash must be a lower-case SHA-256 digest.');
  }
  const sourceByteLength = utf8ByteLength(canonicalText);
  const sourceSha256 = sha256Hex(canonicalText);
  if (tree.document_hash !== undefined && tree.document_hash !== documentHash) {
    fail('SECTION_TREE_DOCUMENT_MISMATCH', 'The section tree document hash does not match document_hash.');
  }
  if (tree.source_byte_length !== undefined && tree.source_byte_length !== sourceByteLength) {
    fail('SECTION_TREE_SOURCE_LENGTH_MISMATCH', 'The section tree source length does not match canonical_text.');
  }
  if (tree.source_sha256 !== undefined && tree.source_sha256 !== sourceSha256) {
    fail('SECTION_TREE_SOURCE_HASH_MISMATCH', 'The section tree source hash does not match canonical_text.');
  }
  const references = new Set();
  for (const node of tree.nodes) {
    if (node.end > sourceByteLength) {
      fail('SECTION_TREE_NODE_RANGE_INVALID', 'A section tree node exceeds canonical_text.');
    }
    const sourceText = utf8Slice(canonicalText, node.start, node.end);
    if (sha256Hex(sourceText) !== node.text_sha256) {
      fail('SECTION_TREE_NODE_HASH_MISMATCH', 'A section tree node does not match its canonical source bytes.', {
        section_id: node.section_id,
        section_reference: node.reference || null,
      });
    }
    if (node.reference !== null && node.reference !== undefined) {
      if (typeof node.reference !== 'string' || !node.reference.trim() || references.has(node.reference)) {
        fail('SECTION_TREE_REFERENCE_INVALID', 'Non-root section references must be non-empty and unique.');
      }
      references.add(node.reference);
    }
    if (node.parent_section_id) {
      const parent = byId.get(node.parent_section_id);
      if (!parent) fail('SECTION_TREE_PARENT_MISSING', 'A section tree node names a missing parent.');
      if (node.start < parent.start || node.end > parent.end) {
        fail('SECTION_TREE_CHILD_OUTSIDE_PARENT', 'A child section range must be contained by its parent.');
      }
    }
    const seen = new Set([node.section_id]);
    let current = node;
    while (current.parent_section_id) {
      if (seen.has(current.parent_section_id)) fail('SECTION_TREE_PARENT_CYCLE', 'Section tree parent links must be acyclic.');
      seen.add(current.parent_section_id);
      current = byId.get(current.parent_section_id);
    }
  }
  return byId;
}

function childrenByParent(tree) {
  const children = new Map();
  for (const node of tree.nodes) {
    if (!node.parent_section_id) continue;
    const list = children.get(node.parent_section_id) || [];
    list.push(node);
    children.set(node.parent_section_id, list);
  }
  for (const list of children.values()) list.sort((left, right) => left.start - right.start || left.section_id.localeCompare(right.section_id));
  return children;
}

function overlappingSiblingRanges(tree) {
  exactNodeTree(tree);
  const overlaps = [];
  for (const [parentSectionId, siblings] of childrenByParent(tree)) {
    for (let index = 1; index < siblings.length; index += 1) {
      const left = siblings[index - 1];
      const right = siblings[index];
      if (right.start < left.end) {
        overlaps.push(Object.freeze({
          parent_section_id: parentSectionId,
          left_section_id: left.section_id,
          left_reference: left.reference,
          left_start: left.start,
          left_end: left.end,
          right_section_id: right.section_id,
          right_reference: right.reference,
          right_start: right.start,
          right_end: right.end,
        }));
      }
    }
  }
  return Object.freeze(overlaps.sort((left, right) => (
    left.parent_section_id.localeCompare(right.parent_section_id)
    || left.left_section_id.localeCompare(right.left_section_id)
    || left.right_section_id.localeCompare(right.right_section_id)
  )));
}

function inheritedTitle(node, byId) {
  let current = node;
  const seen = new Set();
  while (current && !seen.has(current.section_id)) {
    seen.add(current.section_id);
    if (typeof current.heading === 'string' && current.heading.trim()) return current.heading;
    current = current.parent_section_id ? byId.get(current.parent_section_id) : null;
  }
  return null;
}

const BUYER_OPERATIVE_PATTERN = /\b(?:parent|buyer|purchaser|acquiror|acquirer|merger\s+sub)\b[^.;:\n]{0,100}\bshall\b/i;
const TARGET_OPERATIVE_PATTERN = /\b(?:company|target|seller)\b[^.;:\n]{0,100}\bshall\b/i;

function inheritedCovenantSide(node, byId, canonicalText) {
  let current = node;
  const seen = new Set();
  while (current && !seen.has(current.section_id)) {
    seen.add(current.section_id);
    const childStarts = [...byId.values()]
      .filter((candidate) => candidate.parent_section_id === current.section_id)
      .map((candidate) => candidate.start)
      .filter((start) => start > current.start);
    const operativeEnd = childStarts.length > 0 ? Math.min(...childStarts) : current.end;
    const sourceText = utf8Slice(canonicalText, current.start, operativeEnd);
    const buyer = BUYER_OPERATIVE_PATTERN.test(sourceText);
    const target = TARGET_OPERATIVE_PATTERN.test(sourceText);
    if (buyer !== target) {
      return Object.freeze({
        covenant_side: buyer ? 'BUYER' : 'TARGET',
        covenant_side_source: current.section_id === node.section_id
          ? 'OPERATIVE_SECTION_TEXT'
          : 'OPERATIVE_PARENT_TEXT',
        covenant_side_source_section_id: current.section_id,
        covenant_side_evidence_start: current.start,
        covenant_side_evidence_end: operativeEnd,
        covenant_side_evidence_sha256: sha256Hex(sourceText),
      });
    }
    current = current.parent_section_id ? byId.get(current.parent_section_id) : null;
  }
  return null;
}

function governedScope({ canonicalText, documentHash, node, covenantSide }) {
  const sourceText = utf8Slice(canonicalText, node.start, node.end);
  return Object.freeze({
    schema_version: 'NATIVE_GOVERNED_SCOPE/V1',
    document_hash: documentHash,
    section_reference: node.reference,
    section_id: node.section_id,
    parent_section_id: node.parent_section_id,
    kind: node.kind,
    depth: node.depth,
    start: node.start,
    end: node.end,
    text_sha256: node.text_sha256,
    source_text: sourceText,
    ...(covenantSide ? { covenant_side: covenantSide } : {}),
  });
}

function splitWorkItemIdentityBody(value) {
  return {
    origin_work_item_id: value.origin_work_item_id || null,
    source_id: value.source_id || null,
    occurrence_id: value.occurrence_id || null,
    document_hash: value.document_hash,
    section_id: value.section_id,
    section_reference: value.section_reference,
    section_kind: value.section_kind,
    section_text_sha256: value.section_text_sha256,
    start: value.start,
    end: value.end,
    family_id: value.family_id,
    prompt_id: value.prompt_id,
    prompt_version: value.prompt_version,
    prompt_identity: value.prompt_identity,
    prompt_binding_schema: value.prompt_binding_schema,
    classifier_provenance: value.classifier_provenance,
    classifier_version: value.classifier_version,
    covenant_side: value.covenant_side || null,
    covenant_side_source: value.covenant_side_source || null,
    covenant_side_source_section_id: value.covenant_side_source_section_id || null,
    covenant_side_evidence_start: value.covenant_side_evidence_start ?? null,
    covenant_side_evidence_end: value.covenant_side_evidence_end ?? null,
    covenant_side_evidence_sha256: value.covenant_side_evidence_sha256 || null,
  };
}

function classifiedCalls({
  tree,
  canonicalText,
  documentHash,
  sourceId,
  occurrenceId,
  originWorkItemId,
  node,
  byId,
  policy,
  allowedFamilyIds = null,
}) {
  const scope = governedScope({ canonicalText, documentHash, node });
  const registered = new Set(listRegisteredSectionFamilies());
  const allowed = allowedFamilyIds ? new Set(allowedFamilyIds) : null;
  const classifications = classifyDeterministicSectionFamilies({
    title: inheritedTitle(node, byId),
    article_context: node.article_context || null,
    source_text: scope.source_text,
  }).filter((classification) => ACCEPTED_PROVENANCE.has(classification.provenance)
    && registered.has(classification.section_family)
    && (!allowed || allowed.has(classification.section_family)));
  return Object.freeze(classifications.map((classification) => {
    const promptBuilder = getProducerPromptModule(classification.section_family);
    if (!promptBuilder) fail('UNREGISTERED_FAMILY', 'A positively classified family has no registered prompt builder.', {
      family_id: classification.section_family,
      section_reference: node.reference,
    });
    const inheritedSide = classification.section_family === 'INTERIM_OPERATING'
      ? inheritedCovenantSide(node, byId, canonicalText)
      : null;
    const covenantSide = inheritedSide?.covenant_side || classification.covenant_side || null;
    const covenantSideSource = inheritedSide?.covenant_side_source
      || (classification.covenant_side ? 'TITLE_RULE' : null);
    const classifiedScope = governedScope({
      canonicalText,
      documentHash,
      node,
      covenantSide,
    });
    const rawPrompt = promptBuilder({
      source_text: classifiedScope.source_text,
      governed_scope: classifiedScope,
      known_definitions: [],
    });
    const prompt = bindNativePromptToGovernedScope({ prompt: rawPrompt, governed_scope: classifiedScope });
    const promptByteLength = utf8ByteLength(canonicalJson(prompt.messages));
    const promptIdentity = contentId(SPLIT_PROMPT_DOMAIN, prompt);
    const identityBody = splitWorkItemIdentityBody({
      origin_work_item_id: originWorkItemId,
      source_id: sourceId,
      occurrence_id: occurrenceId,
      document_hash: documentHash,
      section_id: node.section_id,
      section_reference: node.reference,
      section_kind: node.kind,
      section_text_sha256: node.text_sha256,
      start: node.start,
      end: node.end,
      family_id: classification.section_family,
      prompt_id: prompt.prompt_id,
      prompt_version: prompt.prompt_version,
      prompt_identity: promptIdentity,
      prompt_binding_schema: prompt.prompt_binding_schema,
      classifier_provenance: classification.provenance,
      classifier_version: classification.classifier_version,
      covenant_side: covenantSide,
      covenant_side_source: covenantSideSource,
      covenant_side_source_section_id: inheritedSide?.covenant_side_source_section_id || null,
      covenant_side_evidence_start: inheritedSide?.covenant_side_evidence_start ?? null,
      covenant_side_evidence_end: inheritedSide?.covenant_side_evidence_end ?? null,
      covenant_side_evidence_sha256: inheritedSide?.covenant_side_evidence_sha256 || null,
    });
    return Object.freeze({
      work_item_id: contentId(SPLIT_WORK_ITEM_SCHEMA, identityBody),
      ...identityBody,
      section_text_byte_length: utf8ByteLength(classifiedScope.source_text),
      prompt_byte_length: promptByteLength,
      prompt_byte_ceiling: policy.prompt_byte_ceiling,
    });
  }));
}

const MAE_DEFINITION_ANCHOR_PATTERN = /["“]?\s*(?:(?:company|parent|target|business)\s+)?material\s+adverse\s+(?:effect|change)\s*["”]?\s+(?:shall\s+)?means\b/gi;

function mergeRanges(ranges) {
  const sorted = [...ranges].sort((left, right) => left.start - right.start || left.end - right.end);
  const merged = [];
  for (const range of sorted) {
    const prior = merged.at(-1);
    if (!prior || range.start > prior.end) merged.push({ start: range.start, end: range.end });
    else prior.end = Math.max(prior.end, range.end);
  }
  return merged;
}

function byteCovered(offset, ranges) {
  return ranges.some((range) => offset >= range.start && offset < range.end);
}

function coverageForFamily({ familyId, node, childWorkItems, canonicalText }) {
  const ranges = mergeRanges(childWorkItems
    .filter((item) => item.family_id === familyId)
    .map((item) => ({ start: item.start, end: item.end })));
  if (familyId === 'MAE_DEFINITION') {
    const sourceText = utf8Slice(canonicalText, node.start, node.end);
    const anchors = [];
    MAE_DEFINITION_ANCHOR_PATTERN.lastIndex = 0;
    for (const match of sourceText.matchAll(MAE_DEFINITION_ANCHOR_PATTERN)) {
      anchors.push(node.start + utf8ByteLength(sourceText.slice(0, match.index)));
    }
    const uncovered = anchors.filter((offset) => !byteCovered(offset, ranges));
    return Object.freeze({
      family_id: familyId,
      method: 'MAE_DEFINED_TERM_ANCHOR_COVERAGE',
      relevant_fact_count: anchors.length,
      covered_relevant_fact_count: anchors.length - uncovered.length,
      covered_ranges: Object.freeze(ranges.map((range) => Object.freeze(range))),
      complete: anchors.length > 0 && uncovered.length === 0,
      uncovered_relevant_offsets: Object.freeze(uncovered),
    });
  }
  const nodeText = utf8Slice(canonicalText, node.start, node.end);
  const relativeRanges = ranges.map((range) => ({
    start: Math.max(0, range.start - node.start),
    end: Math.min(node.end - node.start, range.end - node.start),
  }));
  let cursor = 0;
  const uncoveredText = [];
  for (const range of relativeRanges) {
    if (range.start > cursor) uncoveredText.push(utf8Slice(nodeText, cursor, range.start));
    cursor = Math.max(cursor, range.end);
  }
  if (cursor < utf8ByteLength(nodeText)) uncoveredText.push(utf8Slice(nodeText, cursor, utf8ByteLength(nodeText)));
  const complete = uncoveredText.join('').trim().length === 0;
  return Object.freeze({
    family_id: familyId,
    method: 'FULL_NON_WHITESPACE_BYTE_COVERAGE',
    relevant_fact_count: null,
    covered_relevant_fact_count: null,
    covered_ranges: Object.freeze(ranges.map((range) => Object.freeze(range))),
    complete,
    uncovered_relevant_offsets: Object.freeze([]),
  });
}

function resolveNode({
  tree,
  canonicalText,
  documentHash,
  sourceId,
  occurrenceId,
  originWorkItemId,
  node,
  policy,
  byId,
  childIndex,
  allowedFamilyIds = null,
  recursionDepth = 0,
  maxSplitDepth = DEFAULT_MAX_SPLIT_DEPTH,
}) {
  const calls = classifiedCalls({
    tree, canonicalText, documentHash, sourceId, occurrenceId, originWorkItemId,
    node, byId, policy, allowedFamilyIds,
  });
  const withinCalls = calls.filter((call) => call.prompt_byte_length <= policy.prompt_byte_ceiling);
  const overCalls = calls.filter((call) => call.prompt_byte_length > policy.prompt_byte_ceiling);
  if (overCalls.length === 0) {
    return Object.freeze({
      status: 'WITHIN_POLICY',
      node: node.reference,
      recursion_depth: recursionDepth,
      work_items: Object.freeze(withinCalls),
      blockers: Object.freeze([]),
      coverage: Object.freeze([]),
    });
  }
  const overCeilingFamilies = [...new Set(overCalls.map((call) => call.family_id))].sort();
  const children = childIndex.get(node.section_id) || [];
  if (recursionDepth >= maxSplitDepth || children.length === 0) {
    return Object.freeze({
      status: 'BLOCKED_IRREDUCIBLE',
      node: node.reference,
      recursion_depth: recursionDepth,
      work_items: Object.freeze([]),
      blockers: Object.freeze([Object.freeze({
        code: 'BLOCKED_IRREDUCIBLE',
        section_reference: node.reference,
        section_id: node.section_id,
        family_ids: Object.freeze(overCeilingFamilies),
        reason: recursionDepth >= maxSplitDepth ? 'MAX_SPLIT_DEPTH_REACHED' : 'NO_COMPLETE_CHILD_NODES',
      })]),
      coverage: Object.freeze([]),
    });
  }
  const childResults = children.map((child) => resolveNode({
    tree, canonicalText, documentHash, sourceId, occurrenceId, originWorkItemId,
    node: child, policy, byId, childIndex, allowedFamilyIds: overCeilingFamilies,
    recursionDepth: recursionDepth + 1, maxSplitDepth,
  }));
  const blockers = childResults.flatMap((result) => result.blockers);
  const childWorkItems = childResults.flatMap((result) => result.work_items);
  const familyCoverage = new Set(childWorkItems.map((item) => item.family_id));
  for (const familyId of overCeilingFamilies) {
    if (!familyCoverage.has(familyId)) {
      blockers.push(Object.freeze({
        code: 'BLOCKED_CHILD_RECLASSIFICATION_LOSS',
        section_reference: node.reference,
        section_id: node.section_id,
        family_ids: Object.freeze([familyId]),
        reason: 'NO_COMPLETE_CHILD_RECLASSIFIED_FOR_PARENT_FAMILY',
      }));
    }
  }
  const coverage = overCeilingFamilies.map((familyId) => coverageForFamily({
    familyId,
    node,
    childWorkItems,
    canonicalText,
  }));
  for (const result of coverage) {
    if (!result.complete) {
      blockers.push(Object.freeze({
        code: 'BLOCKED_CHILD_RELEVANT_COVERAGE_LOSS',
        section_reference: node.reference,
        section_id: node.section_id,
        family_ids: Object.freeze([result.family_id]),
        reason: result.method === 'MAE_DEFINED_TERM_ANCHOR_COVERAGE'
          ? 'UNCOVERED_RELEVANT_FAMILY_FACT'
          : 'COMPLETE_RELEVANT_BYTE_ACCOUNTING_UNAVAILABLE',
        relevant_fact_count: result.relevant_fact_count,
        covered_relevant_fact_count: result.covered_relevant_fact_count,
      }));
    }
  }
  if (blockers.length > 0) {
    return Object.freeze({
      status: 'BLOCKED_IRREDUCIBLE',
      node: node.reference,
      recursion_depth: recursionDepth,
      work_items: Object.freeze([]),
      blockers: Object.freeze(blockers),
      coverage: Object.freeze(coverage),
    });
  }
  return Object.freeze({
    status: 'SPLIT',
    node: node.reference,
    recursion_depth: recursionDepth,
    work_items: Object.freeze([...withinCalls, ...childWorkItems]),
    blockers: Object.freeze([]),
    coverage: Object.freeze(coverage),
  });
}

function validateInputs({ tree, canonical_text: canonicalText, document_hash: documentHash, prompt_budget_policy: policy, max_split_depth: maxSplitDepth }) {
  const byId = validateTreeBinding({ tree, canonicalText, documentHash });
  if (!policy || !Number.isSafeInteger(policy.prompt_byte_ceiling) || policy.prompt_byte_ceiling < 1) {
    fail('PROMPT_BUDGET_POLICY_REQUIRED', 'prompt_budget_policy must contain a positive prompt_byte_ceiling.');
  }
  if (!Number.isSafeInteger(maxSplitDepth) || maxSplitDepth < 0) fail('INVALID_MAX_SPLIT_DEPTH', 'max_split_depth must be a non-negative safe integer.');
  return byId;
}

function resolvePromptBudgetSplitWorkItems({
  tree,
  canonical_text: canonicalText,
  document_hash: documentHash,
  source_id: sourceId = null,
  occurrence_id: occurrenceId = null,
  origin_work_item_id: originWorkItemId = null,
  family_id: familyId = null,
  node,
  prompt_budget_policy: policy,
  max_split_depth: maxSplitDepth = DEFAULT_MAX_SPLIT_DEPTH,
} = {}) {
  const byId = validateInputs({ tree, canonical_text: canonicalText, document_hash: documentHash, prompt_budget_policy: policy, max_split_depth: maxSplitDepth });
  const selectedInput = typeof node === 'string' ? tree.nodes.find((item) => item.reference === node) : node;
  if (!selectedInput || !byId.has(selectedInput.section_id)) fail('SECTION_NODE_REQUIRED', 'node must be a section-tree node or exact section reference.');
  const selected = byId.get(selectedInput.section_id);
  if (typeof node !== 'string' && canonicalJson(selectedInput) !== canonicalJson(selected)) {
    fail('SECTION_NODE_SUBSTITUTION', 'The selected node must be the exact node from the validated section tree.');
  }
  if (originWorkItemId !== null && (typeof originWorkItemId !== 'string' || !originWorkItemId.trim())) {
    fail('ORIGIN_WORK_ITEM_INVALID', 'origin_work_item_id must be null or a non-empty string.');
  }
  if (familyId !== null && (typeof familyId !== 'string' || !listRegisteredSectionFamilies().includes(familyId))) {
    fail('FAMILY_FILTER_INVALID', 'family_id must be null or a registered family.');
  }
  return resolveNode({
    tree,
    canonicalText,
    documentHash,
    sourceId,
    occurrenceId,
    originWorkItemId,
    node: selected,
    policy,
    byId,
    childIndex: childrenByParent(tree),
    allowedFamilyIds: familyId ? [familyId] : null,
    maxSplitDepth,
  });
}

function buildPromptBudgetSplitPreflight({
  tree,
  canonical_text: canonicalText,
  document_hash: documentHash,
  source_id: sourceId = null,
  occurrence_id: occurrenceId = null,
  origin_work_item_id: originWorkItemId = null,
  family_id: familyId = null,
  nodes,
  prompt_budget_policy: policy,
  max_split_depth: maxSplitDepth = DEFAULT_MAX_SPLIT_DEPTH,
} = {}) {
  const byId = validateInputs({ tree, canonical_text: canonicalText, document_hash: documentHash, prompt_budget_policy: policy, max_split_depth: maxSplitDepth });
  if (originWorkItemId !== null && (typeof originWorkItemId !== 'string' || !originWorkItemId.trim())) {
    fail('ORIGIN_WORK_ITEM_INVALID', 'origin_work_item_id must be null or a non-empty string.');
  }
  if (familyId !== null && (typeof familyId !== 'string' || !listRegisteredSectionFamilies().includes(familyId))) {
    fail('FAMILY_FILTER_INVALID', 'family_id must be null or a registered family.');
  }
  const selectedInputs = Array.isArray(nodes) ? nodes : tree.nodes.filter((node) => node.reference);
  const selectedNodes = selectedInputs.map((node) => {
    const selected = byId.get(node?.section_id);
    if (!selected || canonicalJson(selected) !== canonicalJson(node)) {
      fail('SECTION_NODE_SUBSTITUTION', 'Every selected preflight node must be the exact node from the validated section tree.');
    }
    return selected;
  });
  if (new Set(selectedNodes.map((node) => node.section_id)).size !== selectedNodes.length) {
    fail('SECTION_NODE_DUPLICATE_SELECTION', 'Selected preflight nodes must be unique.');
  }
  const childIndex = childrenByParent(tree);
  const selectedClosure = new Set();
  function addDescendants(node) {
    if (selectedClosure.has(node.section_id)) return;
    selectedClosure.add(node.section_id);
    for (const child of childIndex.get(node.section_id) || []) addDescendants(child);
  }
  selectedNodes.forEach(addDescendants);
  const overlaps = overlappingSiblingRanges(tree);
  const scopedBlockers = overlaps.filter((overlap) => {
    const leftSelected = selectedClosure.has(overlap.left_section_id);
    const rightSelected = selectedClosure.has(overlap.right_section_id);
    if (leftSelected && rightSelected) return true;
    if (leftSelected === rightSelected) return false;
    const left = byId.get(overlap.left_section_id);
    const right = byId.get(overlap.right_section_id);
    const containment = (left.start <= right.start && left.end >= right.end)
      || (right.start <= left.start && right.end >= left.end);
    return !containment;
  });
  const overlapObservations = overlaps.filter((overlap) => {
    const leftSelected = selectedClosure.has(overlap.left_section_id);
    const rightSelected = selectedClosure.has(overlap.right_section_id);
    if (leftSelected === rightSelected) return false;
    const left = byId.get(overlap.left_section_id);
    const right = byId.get(overlap.right_section_id);
    return (left.start <= right.start && left.end >= right.end)
      || (right.start <= left.start && right.end >= left.end);
  }).map((overlap) => Object.freeze({
    code: 'ALTERNATE_OVERLAPPING_REPRESENTATION_EXCLUDED',
    ...overlap,
  }));
  if (scopedBlockers.length > 0) {
    const body = {
      schema_version: SPLIT_PREFLIGHT_SCHEMA,
      status: 'BLOCKED_TREE_INTEGRITY',
      document_hash: documentHash,
      source_id: sourceId,
      occurrence_id: occurrenceId,
      origin_work_item_id: originWorkItemId,
      family_id: familyId,
      prompt_byte_ceiling: policy.prompt_byte_ceiling,
      max_split_depth: maxSplitDepth,
      resolutions: Object.freeze([]),
      work_items: Object.freeze([]),
      tree_integrity_blockers: Object.freeze(scopedBlockers),
      tree_integrity_observations: Object.freeze(overlapObservations),
    };
    return Object.freeze({ ...body, preflight_id: contentId(SPLIT_PREFLIGHT_SCHEMA, body) });
  }
  const resolutions = selectedNodes.map((node) => resolvePromptBudgetSplitWorkItems({
    tree, canonical_text: canonicalText, document_hash: documentHash, source_id: sourceId,
    occurrence_id: occurrenceId, origin_work_item_id: originWorkItemId, family_id: familyId,
    node, prompt_budget_policy: policy, max_split_depth: maxSplitDepth,
  }));
  const blocked = resolutions.some((resolution) => resolution.status === 'BLOCKED_IRREDUCIBLE');
  const workItems = blocked ? Object.freeze([]) : Object.freeze(resolutions.flatMap((resolution) => resolution.work_items));
  const body = {
    schema_version: SPLIT_PREFLIGHT_SCHEMA,
    status: blocked ? 'BLOCKED_IRREDUCIBLE' : 'PASS',
    document_hash: documentHash,
    source_id: sourceId,
    occurrence_id: occurrenceId,
    origin_work_item_id: originWorkItemId,
    family_id: familyId,
    prompt_byte_ceiling: policy.prompt_byte_ceiling,
    max_split_depth: maxSplitDepth,
    resolutions: Object.freeze(resolutions),
    work_items: workItems,
    tree_integrity_blockers: Object.freeze([]),
    tree_integrity_observations: Object.freeze(overlapObservations),
  };
  return Object.freeze({ ...body, preflight_id: contentId(SPLIT_PREFLIGHT_SCHEMA, body) });
}

function validatePromptBudgetSplitPreflight(preflight) {
  const topLevelKeys = [
    'document_hash', 'family_id', 'max_split_depth', 'occurrence_id', 'origin_work_item_id',
    'preflight_id', 'prompt_byte_ceiling', 'resolutions', 'schema_version', 'source_id', 'status',
    'tree_integrity_blockers', 'tree_integrity_observations', 'work_items',
  ];
  if (!exactKeys(preflight, topLevelKeys) || preflight.schema_version !== SPLIT_PREFLIGHT_SCHEMA
    || !['PASS', 'BLOCKED_TREE_INTEGRITY', 'BLOCKED_IRREDUCIBLE'].includes(preflight.status)
    || typeof preflight.preflight_id !== 'string' || !DIGEST_RE.test(preflight.preflight_id)
    || typeof preflight.document_hash !== 'string' || !DIGEST_RE.test(preflight.document_hash)
    || !Number.isSafeInteger(preflight.prompt_byte_ceiling) || preflight.prompt_byte_ceiling < 1
    || !Number.isSafeInteger(preflight.max_split_depth) || preflight.max_split_depth < 0
    || !Array.isArray(preflight.resolutions) || !Array.isArray(preflight.work_items)
    || !Array.isArray(preflight.tree_integrity_blockers)
    || !Array.isArray(preflight.tree_integrity_observations)) {
    fail('SPLIT_PREFLIGHT_INVALID', 'The prompt-budget split preflight has an invalid closed state.');
  }
  if ((preflight.source_id !== null && (typeof preflight.source_id !== 'string' || !preflight.source_id.trim()))
    || (preflight.occurrence_id !== null && (typeof preflight.occurrence_id !== 'string' || !preflight.occurrence_id.trim()))
    || (preflight.origin_work_item_id !== null
      && (typeof preflight.origin_work_item_id !== 'string' || !preflight.origin_work_item_id.trim()))
    || (preflight.family_id !== null && !listRegisteredSectionFamilies().includes(preflight.family_id))) {
    fail('SPLIT_PREFLIGHT_BINDING_INVALID', 'The split preflight source, occurrence, origin and family bindings are invalid.');
  }
  const { preflight_id: preflightId, ...body } = preflight;
  if (preflightId !== contentId(SPLIT_PREFLIGHT_SCHEMA, body)) {
    fail('SPLIT_PREFLIGHT_IDENTITY_INVALID', 'The prompt-budget split preflight identity does not match its content.');
  }
  if (preflight.status !== 'PASS' && preflight.work_items.length !== 0) {
    fail('SPLIT_PREFLIGHT_BLOCKED_WORK_ITEMS', 'A blocked split preflight cannot issue work items.');
  }
  if (preflight.status === 'PASS' && preflight.tree_integrity_blockers.length > 0) {
    fail('SPLIT_PREFLIGHT_TREE_BLOCKER_CONFLICT', 'A passing split preflight cannot carry tree-integrity blockers.');
  }
  const workItemIds = new Set();
  const workItemKeys = [
    ...Object.keys(splitWorkItemIdentityBody({})),
    'work_item_id', 'section_text_byte_length', 'prompt_byte_length', 'prompt_byte_ceiling',
  ];
  for (const item of preflight.work_items) {
    const operativePartyEvidence = ['OPERATIVE_SECTION_TEXT', 'OPERATIVE_PARENT_TEXT']
      .includes(item?.covenant_side_source);
    const partyEvidenceValid = operativePartyEvidence
      ? (['BUYER', 'TARGET'].includes(item.covenant_side)
        && typeof item.covenant_side_source_section_id === 'string'
        && Number.isSafeInteger(item.covenant_side_evidence_start)
        && Number.isSafeInteger(item.covenant_side_evidence_end)
        && item.covenant_side_evidence_end > item.covenant_side_evidence_start
        && typeof item.covenant_side_evidence_sha256 === 'string'
        && DIGEST_RE.test(item.covenant_side_evidence_sha256))
      : (item?.covenant_side_evidence_start === null
        && item?.covenant_side_evidence_end === null
        && item?.covenant_side_evidence_sha256 === null);
    if (!exactKeys(item, workItemKeys)
      || item.work_item_id !== contentId(SPLIT_WORK_ITEM_SCHEMA, splitWorkItemIdentityBody(item))
      || typeof item.prompt_identity !== 'string' || !DIGEST_RE.test(item.prompt_identity)
      || typeof item.section_text_sha256 !== 'string' || !DIGEST_RE.test(item.section_text_sha256)
      || item.document_hash !== preflight.document_hash
      || item.source_id !== preflight.source_id
      || (preflight.family_id !== null && item.family_id !== preflight.family_id)
      || item.origin_work_item_id !== preflight.origin_work_item_id
      || item.prompt_byte_ceiling !== preflight.prompt_byte_ceiling
      || !Number.isSafeInteger(item.prompt_byte_length) || item.prompt_byte_length < 1
      || !Number.isSafeInteger(item.section_text_byte_length) || item.section_text_byte_length < 1
      || item.prompt_byte_length > item.prompt_byte_ceiling
      || !partyEvidenceValid
      || workItemIds.has(item.work_item_id)) {
      fail('SPLIT_PREFLIGHT_WORK_ITEM_INVALID', 'A split preflight work item is stale, duplicated, over ceiling or outside its bound scope.');
    }
    workItemIds.add(item.work_item_id);
  }
  return preflight;
}

module.exports = {
  DEFAULT_MAX_SPLIT_DEPTH,
  PromptBudgetSplitPreflightError,
  SPLIT_PREFLIGHT_SCHEMA,
  SPLIT_WORK_ITEM_SCHEMA,
  SPLIT_PROMPT_DOMAIN,
  buildPromptBudgetSplitPreflight,
  overlappingSiblingRanges,
  resolvePromptBudgetSplitWorkItems,
  validatePromptBudgetSplitPreflight,
};
