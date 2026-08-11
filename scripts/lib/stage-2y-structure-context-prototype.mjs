import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const {
  canonicalJson,
  contentId,
  sha256Hex,
  utf8Slice,
} = require('../../lib/canonical-v2/canonical-bytes');
const { charToByteTable } = require('../../lib/canonical-v2/native-producer/governing-structure');
const { resolveQualifierAttachment } = require('../../lib/canonical-v2/native-producer/qualifier-attachment');

const FACTS_SCHEMA = 'STAGE_2Y_STRUCTURE_CONTEXT_FACTS/V1';
const FACT_SCHEMA = 'STAGE_2Y_STRUCTURE_CONTEXT_FACT/V1';
const REFERENCES_SCHEMA = 'STAGE_2Y_STRUCTURE_REFERENCE_EDGES/V1';
const REFERENCE_SCHEMA = 'STAGE_2Y_STRUCTURE_REFERENCE_EDGE/V1';
const SCOPE_SCHEMA = 'STAGE_2Y_STRUCTURE_SCOPE_EDGE/V1';

const DECISION_CASES = new Set([
  'CONCHO_6_9_A',
  'TOPBUILD_6_2',
  'REDHAT_3_01_3_02',
  'METSERA_7_04',
  'CONCHO_4_10_ANNEX_A',
]);
const FROZEN_CASE_IDS = Object.freeze([
  'CONCHO_6_9_A',
  'TOPBUILD_6_2',
  'REDHAT_3_01_3_02',
  'METSERA_7_04',
  'CONCHO_4_10_ANNEX_A',
  'TOPBUILD_6_3',
  'REDHAT_5_07',
  'METSERA_9_03',
  'CONCHO_6_11_6_16_6_20',
]);
const PROTOTYPE_INPUT_PATH =
  'evidence/canonical-v2/stage-2y-structure-migration/control/prototype-inputs.json';

function fail(message) {
  throw new Error(`STAGE_2Y_STRUCTURE_CONTEXT_PROTOTYPE: ${message}`);
}

function nodeId(node) {
  return node?.node_occurrence_id || node?.occurrence_id || node?.node_id || node?.section_id || null;
}

function parentId(node) {
  return node?.parent_node_occurrence_id
    || node?.parent_occurrence_id
    || node?.parent_node_id
    || node?.parent_section_id
    || null;
}

function normaliseSpan(value) {
  const span = value?.extent_span || value?.span || value;
  const start = span?.start_byte ?? span?.start;
  const end = span?.end_byte ?? span?.end;
  if (!Number.isSafeInteger(start) || !Number.isSafeInteger(end) || start < 0 || end <= start) return null;
  return { start, end };
}

function canonicalText(runtimeCase) {
  const value = runtimeCase?.canonical_text;
  if (typeof value === 'string') return value;
  if (typeof value?.text === 'string') return value.text;
  fail(`${runtimeCase?.case_id || 'unknown case'} has no canonical_text string`);
}

function quoteSpan(text, start, end) {
  const quote = utf8Slice(text, start, end);
  return Object.freeze({
    coordinate_system: 'UTF8_CANONICAL_TEXT_HALF_OPEN',
    start_byte: start,
    end_byte: end,
    text_sha256: sha256Hex(Buffer.from(quote, 'utf8')),
    quote,
  });
}

function nodeSpan(node) {
  return normaliseSpan(node?.extent_span || node);
}

function makeCase(runtimeCase, frozenCase) {
  const text = canonicalText(runtimeCase);
  const bytes = Buffer.from(text, 'utf8');
  if (bytes.length !== frozenCase.canonical_text_byte_length
    || sha256Hex(bytes) !== frozenCase.canonical_text_sha256) {
    fail(`${runtimeCase.case_id} canonical source binding drift`);
  }
  const nodes = Array.isArray(runtimeCase.nodes) ? runtimeCase.nodes : [];
  if (nodes.length === 0) fail(`${runtimeCase.case_id} has no source nodes`);
  const byId = new Map(nodes.map((node) => [nodeId(node), node]).filter(([id]) => id));
  return {
    case_id: runtimeCase.case_id,
    frozen: frozenCase,
    text,
    nodes,
    byId,
    facts: [],
    scopes: new Map(),
    references: [],
    diagnostics: [],
  };
}

function kind(node) {
  return String(node?.node_kind || node?.kind || '').toUpperCase();
}

function nodesOf(ctx, wanted) {
  const kinds = new Set(Array.isArray(wanted) ? wanted : [wanted]);
  return ctx.nodes.filter((node) => kinds.has(kind(node)));
}

function nodeText(ctx, node) {
  const span = nodeSpan(node);
  return span ? utf8Slice(ctx.text, span.start, span.end) : '';
}

function findLiteral(ctx, node, literal, occurrence = 0) {
  const extent = nodeSpan(node);
  if (!extent) return null;
  const text = nodeText(ctx, node);
  let from = 0;
  let index = -1;
  for (let count = 0; count <= occurrence; count += 1) {
    index = text.indexOf(literal, from);
    if (index < 0) return null;
    from = index + literal.length;
  }
  const table = charToByteTable(text);
  return quoteSpan(ctx.text, extent.start + table[index], extent.start + table[index + literal.length]);
}

function deepestNode(ctx, span, allowedKinds = null) {
  const allowed = allowedKinds ? new Set(allowedKinds) : null;
  const priority = new Map([
    ['REFERENCE_OCCURRENCE', 0], ['DEFINED_TERM', 1], ['QUALIFICATION', 2],
    ['SENTENCE', 3], ['LIMB', 4], ['CHAPEAU', 5], ['SUBSECTION', 6],
    ['CURRENT_STRUCTURE_CANDIDATE', 7], ['SECTION', 8], ['SOURCE_TEXT', 9],
  ]);
  return ctx.nodes
    .filter((node) => {
      const extent = nodeSpan(node);
      return nodeId(node) && extent && extent.start <= span.start_byte && extent.end >= span.end_byte
        && (!allowed || allowed.has(kind(node)));
    })
    .sort((left, right) => {
      const a = nodeSpan(left);
      const b = nodeSpan(right);
      return (a.end - a.start) - (b.end - b.start)
        || (priority.get(kind(left)) ?? 99) - (priority.get(kind(right)) ?? 99)
        || nodeId(left).localeCompare(nodeId(right));
    })[0] || null;
}

function ensureScope(ctx, { edgeType, sourceNode, targetNodes, support, ruleId, uncertainty = null }) {
  const payload = {
    case_id: ctx.case_id,
    edge_type: edgeType,
    source_node_id: nodeId(sourceNode),
    target_node_ids: targetNodes.map(nodeId),
    support: { start_byte: support.start_byte, end_byte: support.end_byte, text_sha256: support.text_sha256 },
    rule_id: ruleId,
    rule_version: 1,
  };
  const scope_edge_id = contentId(SCOPE_SCHEMA, payload);
  if (!ctx.scopes.has(scope_edge_id)) {
    ctx.scopes.set(scope_edge_id, Object.freeze({
      schema_version: SCOPE_SCHEMA,
      scope_edge_id,
      ...payload,
      status: uncertainty ? 'AMBIGUOUS' : 'RESOLVED',
      uncertainty: uncertainty || { status: 'NONE', reason_codes: [], alternatives: [] },
    }));
  }
  return scope_edge_id;
}

function addFact(ctx, {
  factType,
  value,
  status,
  targetNode,
  sourceNode,
  support,
  scopeEdgeId,
  ruleId,
  uncertainty = null,
}) {
  if (!targetNode || !sourceNode || !support || !scopeEdgeId) {
    fail(`${ctx.case_id} fact construction is missing a required node, span, or scope edge`);
  }
  const scopeRelation = ctx.scopes.get(scopeEdgeId)?.edge_type;
  if (!scopeRelation) fail(`${ctx.case_id} fact references an unknown scope edge`);
  const payload = {
    case_id: ctx.case_id,
    fact_type: factType,
    value,
    status,
    target_node_id: nodeId(targetNode),
    governing_source_node_id: nodeId(sourceNode),
    source_span: {
      start_byte: support.start_byte,
      end_byte: support.end_byte,
      text_sha256: support.text_sha256,
    },
    scope_edge_id: scopeEdgeId,
    rule_id: ruleId,
    rule_version: 1,
  };
  ctx.facts.push(Object.freeze({
    schema_version: FACT_SCHEMA,
    context_fact_id: contentId(FACT_SCHEMA, payload),
    ...payload,
    inheritance: status,
    source_span: support,
    quote_sha256: support.text_sha256,
    confidence: 'DETERMINISTIC_SOURCE_PROOF',
    resolution_status: uncertainty ? 'AMBIGUOUS' : 'RESOLVED',
    uncertainty: uncertainty || { status: 'NONE', reason_codes: [], alternatives: [] },
    relationship_path: [nodeId(sourceNode), scopeRelation, nodeId(targetNode)],
    rule: { rule_id: ruleId, rule_version: 1 },
  }));
}

function addDirectLiteral(ctx, node, factType, literal, value = literal, ruleId = 'EXACT_LITERAL_DIRECT/V1') {
  const support = findLiteral(ctx, node, literal);
  if (!support) fail(`${ctx.case_id} required ${factType} literal is absent: ${literal}`);
  const scopeEdgeId = ensureScope(ctx, {
    edgeType: 'DIRECT_AT', sourceNode: node, targetNodes: [node], support, ruleId,
  });
  addFact(ctx, {
    factType, value, status: 'DIRECT', targetNode: node, sourceNode: node,
    support, scopeEdgeId, ruleId,
  });
  return { support, scopeEdgeId };
}

function inheritLiteral(ctx, sourceNode, targetNodes, factType, literal, value = literal, ruleId,
  occurrence = 0) {
  const support = findLiteral(ctx, sourceNode, literal, occurrence);
  if (!support) fail(`${ctx.case_id} required inherited ${factType} literal is absent: ${literal}`);
  if (targetNodes.length === 0) fail(`${ctx.case_id} required inherited ${factType} has no targets`);
  const scopeEdgeId = ensureScope(ctx, {
    edgeType: 'GOVERNS', sourceNode, targetNodes, support, ruleId,
  });
  addFact(ctx, {
    factType, value, status: 'DIRECT', targetNode: sourceNode, sourceNode,
    support,
    scopeEdgeId: ensureScope(ctx, {
      edgeType: 'DIRECT_AT', sourceNode, targetNodes: [sourceNode], support, ruleId: `${ruleId}_DIRECT`,
    }),
    ruleId: `${ruleId}_DIRECT`,
  });
  for (const targetNode of targetNodes) {
    addFact(ctx, {
      factType, value, status: 'INHERITED', targetNode, sourceNode,
      support, scopeEdgeId, ruleId,
    });
  }
}

function descendants(ctx, parentNode, wantedKind) {
  const result = [];
  const queue = [nodeId(parentNode)];
  while (queue.length > 0) {
    const parent = queue.shift();
    for (const node of ctx.nodes.filter((candidate) => parentId(candidate) === parent)) {
      if (!wantedKind || kind(node) === wantedKind) result.push(node);
      queue.push(nodeId(node));
    }
  }
  return result;
}

function ordered(nodes) {
  return [...nodes].sort((left, right) => {
    const a = nodeSpan(left) || { start: Number.MAX_SAFE_INTEGER, end: Number.MAX_SAFE_INTEGER };
    const b = nodeSpan(right) || { start: Number.MAX_SAFE_INTEGER, end: Number.MAX_SAFE_INTEGER };
    return a.start - b.start || a.end - b.end || String(nodeId(left)).localeCompare(String(nodeId(right)));
  });
}

function authoredSupportParts(ctx, extent) {
  const artefacts = nodesOf(ctx, 'SOURCE_ARTEFACT')
    .map(nodeSpan)
    .filter((span) => span && span.start < extent.end && span.end > extent.start)
    .sort((left, right) => left.start - right.start || left.end - right.end);
  const parts = [];
  let cursor = extent.start;
  for (const artefact of artefacts) {
    const start = Math.max(extent.start, artefact.start);
    const end = Math.min(extent.end, artefact.end);
    if (start > cursor) parts.push(quoteSpan(ctx.text, cursor, start));
    cursor = Math.max(cursor, end);
  }
  if (cursor < extent.end) parts.push(quoteSpan(ctx.text, cursor, extent.end));
  return parts.filter((part) => part.end_byte > part.start_byte);
}

function addLocalQualifications(ctx, limbs) {
  for (const qualification of ordered(nodesOf(ctx, 'QUALIFICATION'))) {
    let target = ctx.byId.get(parentId(qualification));
    if (!target || kind(target) !== 'LIMB') {
      target = limbs.filter((limb) => {
        const limbExtent = nodeSpan(limb);
        const qualifierExtent = nodeSpan(qualification);
        return limbExtent && qualifierExtent
          && limbExtent.start <= qualifierExtent.start && limbExtent.end >= qualifierExtent.end;
      }).sort((a, b) => (nodeSpan(a).end - nodeSpan(a).start) - (nodeSpan(b).end - nodeSpan(b).start))[0];
    }
    if (!target) {
      ctx.diagnostics.push({ code: 'QUALIFICATION_SCOPE_UNAVAILABLE', node_id: nodeId(qualification) });
      continue;
    }
    const extent = nodeSpan(qualification);
    const supports = authoredSupportParts(ctx, extent);
    const attachmentText = supports.map((support) => support.quote).join('');
    const attachment = resolveQualifierAttachment({
      position: 'ITEM',
      governs_path: [target.reference || target.marker || nodeId(target)],
      quote_text: attachmentText,
      sibling_limb_paths: limbs.map((limb) => [limb.reference || limb.marker || nodeId(limb)]),
    });
    if (attachment.scope_reading !== 'THIS_ITEM_ONLY') fail(`${ctx.case_id} local qualification escaped its limb`);
    const edgeType = /\bexcept(?:ion|ing)?\b/i.test(attachmentText) ? 'EXCEPTS' : 'QUALIFIES';
    const ruleId = 'PARENT_LIMB_LOCAL_QUALIFICATION/V1';
    supports.forEach((support, index) => {
      const scopeEdgeId = ensureScope(ctx, {
        edgeType, sourceNode: qualification, targetNodes: [target], support, ruleId,
      });
      addFact(ctx, {
        factType: edgeType === 'EXCEPTS' ? 'EXCEPTION_TEXT' : 'QUALIFICATION_TEXT',
        value: {
          raw_text: support.quote,
          authored_part_ordinal: index,
          authored_part_count: supports.length,
        },
        status: 'INHERITED',
        targetNode: target,
        sourceNode: qualification,
        support,
        scopeEdgeId,
        ruleId,
      });
    });
  }
}

function conchoEmployeeContext(ctx) {
  const chapeau = ordered(nodesOf(ctx, 'CHAPEAU'))[0];
  const limbs = ordered(nodesOf(ctx, 'LIMB')).slice(0, 4);
  if (!chapeau || limbs.length !== 4) fail('CONCHO_6_9_A requires one chapeau and four limbs');
  if (nodesOf(ctx, 'QUALIFICATION').length !== 2) fail('CONCHO_6_9_A requires two local qualifications');
  const rule = 'CHAPEAU_TO_DIRECT_LIMB/V1';
  inheritLiteral(ctx, chapeau, limbs, 'TIME_SCOPE',
    'Until December 31 of the calendar year in which the Effective Time occurs',
    'UNTIL_DECEMBER_31_OF_EFFECTIVE_TIME_YEAR', rule);
  inheritLiteral(ctx, chapeau, limbs, 'ACTOR', 'Parent', 'Parent', rule);
  inheritLiteral(ctx, chapeau, limbs, 'MODAL', 'shall', 'SHALL', rule);
  inheritLiteral(ctx, chapeau, limbs, 'GOVERNING_PREDICATE', 'cause', 'CAUSE', rule);
  inheritLiteral(ctx, chapeau, limbs, 'PREDICATE_COMPLEMENT', 'to be provided with',
    'TO_BE_PROVIDED_WITH', rule);
  inheritLiteral(ctx, chapeau, limbs, 'OBJECT', 'each individual who is employed as of the Closing Date',
    'COMPANY_EMPLOYEE_BENEFICIARY', rule);
  addLocalQualifications(ctx, limbs);
}

function topbuildTerminationContext(ctx) {
  const chapeau = ordered(nodesOf(ctx, 'CHAPEAU'))[0];
  const limbs = ordered(nodesOf(ctx, 'LIMB')).slice(0, 4);
  if (!chapeau || limbs.length !== 4) fail('TOPBUILD_6_2 requires one chapeau and four limbs');
  if (nodesOf(ctx, 'QUALIFICATION').length !== 2) fail('TOPBUILD_6_2 requires two local qualifications');
  const rule = 'TERMINATION_CHAPEAU_TO_DIRECT_LIMB/V1';
  inheritLiteral(ctx, chapeau, limbs, 'OBJECT', 'This Agreement', 'THIS_AGREEMENT', rule);
  inheritLiteral(ctx, chapeau, limbs, 'MODAL', 'may', 'MAY', rule);
  inheritLiteral(ctx, chapeau, limbs, 'GOVERNING_PREDICATE', 'be terminated', 'BE_TERMINATED', rule);
  inheritLiteral(ctx, chapeau, limbs, 'TIME_SCOPE',
    'at any time prior to the Titanium Merger Effective Time',
    'PRIOR_TO_TITANIUM_MERGER_EFFECTIVE_TIME', rule);
  inheritLiteral(ctx, chapeau, limbs, 'RIGHT_HOLDER', 'either Parent or the Company',
    ['Parent', 'Company'], rule);
  inheritLiteral(ctx, chapeau, limbs, 'LIST_CONNECTIVE', 'if:', 'IF', rule);
  addLocalQualifications(ctx, limbs);
}

function topbuildCompanyTerminationContext(ctx) {
  const chapeau = ordered(nodesOf(ctx, 'CHAPEAU'))[0];
  const limbs = ordered(nodesOf(ctx, 'LIMB')).slice(0, 2);
  if (!chapeau || limbs.length !== 2) fail('TOPBUILD_6_3 requires one chapeau and two limbs');
  if (nodesOf(ctx, 'QUALIFICATION').length !== 1) {
    fail('TOPBUILD_6_3 requires one local qualification');
  }
  const rule = 'COMPANY_TERMINATION_CHAPEAU_TO_DIRECT_LIMB/V1';
  inheritLiteral(ctx, chapeau, limbs, 'OBJECT', 'This Agreement', 'THIS_AGREEMENT', rule);
  inheritLiteral(ctx, chapeau, limbs, 'MODAL', 'may', 'MAY', rule, 0);
  inheritLiteral(ctx, chapeau, limbs, 'GOVERNING_PREDICATE', 'be terminated',
    'BE_TERMINATED', rule);
  inheritLiteral(ctx, chapeau, limbs, 'OBJECT', 'the Mergers', 'MERGERS', rule);
  inheritLiteral(ctx, chapeau, limbs, 'MODAL', 'may', 'MAY', rule, 1);
  inheritLiteral(ctx, chapeau, limbs, 'GOVERNING_PREDICATE', 'be abandoned',
    'BE_ABANDONED', rule);
  inheritLiteral(ctx, chapeau, limbs, 'TIME_SCOPE',
    'at any time prior to the Titanium Merger Effective Time',
    'PRIOR_TO_TITANIUM_MERGER_EFFECTIVE_TIME', rule);
  inheritLiteral(ctx, chapeau, limbs, 'RIGHT_HOLDER', 'the Company', 'Company', rule);
  inheritLiteral(ctx, chapeau, limbs, 'LIST_CONNECTIVE', 'if:', 'IF', rule);
  addStatementFacts(ctx, [chapeau, ...limbs], 'CONFIRMATION_AUTHORED_BLOCK_DIRECT/V1');
  addDirectLiteral(ctx, limbs[0], 'CURE_CONDITION',
    'such breach is not curable or, if curable is not cured prior to the earlier of (A) the fifth business day after written notice thereof is given by the Company to Parent and (B) the date that is three business days prior to the Outside Date');
  addDirectLiteral(ctx, limbs[1], 'CURE_CONDITION',
    'such breach or inaccuracy or failure to be true is not curable by the Outside Date or, if capable of being cured by the Outside Date, shall not have been cured prior to the earlier of (x) thirty (30) days after written notice thereof is given by the Company to Parent or (y) the Outside Date');
  addLocalQualifications(ctx, limbs);
}

function addStatementFacts(ctx, nodes, ruleId) {
  for (const node of ordered(nodes)) {
    const extent = nodeSpan(node);
    if (!extent) continue;
    const supports = authoredSupportParts(ctx, extent);
    supports.forEach((support, index) => {
      const scopeEdgeId = ensureScope(ctx, {
        edgeType: 'DIRECT_AT', sourceNode: node, targetNodes: [node], support, ruleId,
      });
      addFact(ctx, {
        factType: 'SOURCE_STATEMENT',
        value: {
          raw_text: support.quote,
          authored_part_ordinal: index,
          authored_part_count: supports.length,
        },
        status: 'DIRECT',
        targetNode: node,
        sourceNode: node,
        support,
        scopeEdgeId,
        ruleId,
      });
    });
  }
}

function redhatContext(ctx) {
  const sentences = ordered(nodesOf(ctx, 'SENTENCE'));
  if (sentences.length !== 3) fail(`REDHAT_3_01_3_02 requires three independent sentence nodes, got ${sentences.length}`);
  addStatementFacts(ctx, sentences, 'INDEPENDENT_SENTENCE_DIRECT/V1');
  ctx.diagnostics.push({
    code: 'NO_HEADING_OR_SIBLING_GRAMMAR_INHERITANCE',
    status: 'ENFORCED',
    sentence_count: sentences.length,
  });
}

function metseraContext(ctx) {
  const sentences = ordered(nodesOf(ctx, 'SENTENCE')).slice(0, 2);
  if (sentences.length !== 2) fail('METSERA_7_04 requires two independent sentence nodes');
  const literals = [
    ['ACTOR', 'Neither Parent nor Merger Sub', ['Parent', 'Merger Sub']],
    ['ACTOR', 'The Company', 'Company'],
  ];
  for (let index = 0; index < sentences.length; index += 1) {
    const sentence = sentences[index];
    addDirectLiteral(ctx, sentence, literals[index][0], literals[index][1], literals[index][2]);
    addDirectLiteral(ctx, sentence, 'MODAL', 'may', 'MAY');
    addDirectLiteral(ctx, sentence, 'NEGATION',
      index === 0 ? 'Neither Parent nor Merger Sub' : 'not', true);
    addDirectLiteral(ctx, sentence, 'GOVERNING_PREDICATE', 'rely on', 'RELY_ON');
    addDirectLiteral(ctx, sentence, 'CAUSATION_STANDARD', 'primarily caused', 'PRIMARILY_CAUSED');
    addDirectLiteral(ctx, sentence, 'BREACH_STANDARD', 'material breach', 'MATERIAL_BREACH');
  }
}

function conchoDefinitionContext(ctx) {
  const useSection = nodesOf(ctx, 'REFERENCE_OCCURRENCE')
    .find((node) => String(node.reference || '').toLowerCase() === 'knowledge')
    || ctx.nodes.find((node) => String(node.reference || '') === '4.10')
    || deepestNode(ctx, quoteSpan(ctx.text, 62777, 62808), ['SECTION', 'SUBSECTION', 'CURRENT_STRUCTURE_CANDIDATE']);
  const definition = nodesOf(ctx, 'DEFINED_TERM').find((node) => /[“\"]knowledge[”\"]\s+means/i.test(nodeText(ctx, node)))
    || ctx.nodes.find((node) => String(node.reference || '').toLowerCase() === 'knowledge');
  if (!useSection || !definition) fail('CONCHO_4_10_ANNEX_A requires use and definition nodes');
  addDirectLiteral(ctx, useSection, 'DEFINED_TERM_USE', 'to the knowledge of the Company', 'knowledge');
  const operative = descendants(ctx, definition, 'CHAPEAU')
    .find((node) => nodeText(ctx, node).includes('the actual knowledge of')) || definition;
  addDirectLiteral(ctx, operative, 'DEFINITION_STANDARD', 'the actual knowledge of', 'ACTUAL_KNOWLEDGE');
}

function referenceAliases(ctx) {
  const aliases = new Map();
  const add = (key, node) => {
    const normal = String(key || '').replace(/^Section\s+/i, '').replace(/\s+/g, '');
    if (!normal) return;
    if (!aliases.has(normal)) aliases.set(normal, []);
    if (!aliases.get(normal).includes(node)) aliases.get(normal).push(node);
  };
  for (const node of ctx.nodes) {
    if (!['SECTION', 'SUBSECTION', 'LIMB', 'DEFINED_TERM'].includes(kind(node))) continue;
    add(node.reference, node);
    const section = (() => {
      let current = node;
      while (current) {
        if (kind(current) === 'SECTION') return current;
        current = ctx.byId.get(parentId(current));
      }
      return null;
    })();
    if (kind(node) === 'LIMB' && section) {
      const marker = String(node.reference || node.marker || '')
        .match(/^\(?([A-Za-z0-9]+)\)?$/)?.[1];
      if (marker) add(`${section.reference}(${marker})`, node);
    }
  }
  return aliases;
}

function referenceFromRawOccurrence(rawText) {
  const withoutPrefix = rawText.replace(
    /^Sections?[\t \u200e\u200f\u202a-\u202e\u2066-\u2069]+/,
    '',
  );
  return withoutPrefix.replace(/[\s\u200e\u200f\u202a-\u202e\u2066-\u2069]+/g, '');
}

function scanSectionReferences(ctx) {
  const aliases = referenceAliases(ctx);
  const occurrenceNodes = ordered(nodesOf(ctx, 'REFERENCE_OCCURRENCE'))
    .filter((node) => (node.roles || []).includes('CROSS_REFERENCE'));
  for (const sourceNode of occurrenceNodes) {
    const extent = nodeSpan(sourceNode);
    if (!extent) fail(`${ctx.case_id} reference occurrence has no exact span`);
    const occurrence = quoteSpan(ctx.text, extent.start, extent.end);
    const reference = String(sourceNode.reference || '')
      .replace(/[\s\u200e\u200f\u202a-\u202e\u2066-\u2069]+/g, '');
    if (!reference) fail(`${ctx.case_id} reference occurrence has no normalised reference`);
    const referenceFromBytes = referenceFromRawOccurrence(occurrence.quote);
    if (referenceFromBytes !== reference) {
      fail(`${ctx.case_id} source reference metadata does not match its canonical bytes`);
    }
    const candidates = aliases.get(reference) || [];
    const status = candidates.length === 1 ? 'RESOLVED' : candidates.length > 1 ? 'AMBIGUOUS' : 'UNRESOLVED';
    const payload = {
      case_id: ctx.case_id,
      edge_type: 'SECTION_REFERENCE',
      source_node_id: nodeId(sourceNode),
      source_occurrence: {
        coordinate_system: occurrence.coordinate_system,
        start_byte: occurrence.start_byte,
        end_byte: occurrence.end_byte,
        text_sha256: occurrence.text_sha256,
        quote_sha256: occurrence.text_sha256,
        raw_text: occurrence.quote,
        normalised_reference: reference,
      },
      resolution_status: status,
      target_node_ids: candidates.map(nodeId),
    };
    ctx.references.push(Object.freeze({
      schema_version: REFERENCE_SCHEMA,
      reference_edge_id: contentId(REFERENCE_SCHEMA, payload),
      ...payload,
      selected_target_node_id: candidates.length === 1 ? nodeId(candidates[0]) : null,
      confidence: candidates.length === 1 ? 'DETERMINISTIC_INDEX_MATCH' : 'NO_DETERMINISTIC_TARGET',
      uncertainty: status === 'RESOLVED'
        ? { status: 'NONE', reason_codes: [], alternatives: [] }
        : {
          status,
          reason_codes: [status === 'AMBIGUOUS' ? 'MULTIPLE_INDEX_TARGETS' : 'TARGET_OUTSIDE_FROZEN_INDEX'],
          alternatives: candidates.map(nodeId),
        },
      rule: { rule_id: 'SOURCE_INDEX_REFERENCE_OCCURRENCE/V1', rule_version: 1 },
    }));
  }
}

function addDefinitionEdge(ctx) {
  if (ctx.case_id !== 'CONCHO_4_10_ANNEX_A') return;
  const useNode = nodesOf(ctx, 'REFERENCE_OCCURRENCE').find((node) =>
    (node.roles || []).includes('DEFINED_TERM_USE')
      && String(node.reference || '').toLowerCase() === 'knowledge');
  const definition = nodesOf(ctx, 'DEFINED_TERM').find((node) => /[“\"]knowledge[”\"]\s+means/i.test(nodeText(ctx, node)));
  if (!useNode || !definition) fail('Concho definition link nodes unavailable');
  const extent = nodeSpan(useNode);
  if (!extent) fail('Concho definition-use occurrence has no exact span');
  const occurrence = quoteSpan(ctx.text, extent.start, extent.end);
  if (occurrence.quote !== 'to the knowledge of the Company') {
    fail('Concho definition-use source node does not contain the frozen occurrence');
  }
  const payload = {
    case_id: ctx.case_id,
    edge_type: 'USES_DEFINITION',
    source_node_id: nodeId(useNode),
    source_occurrence: {
      coordinate_system: occurrence.coordinate_system,
      start_byte: occurrence.start_byte,
      end_byte: occurrence.end_byte,
      text_sha256: occurrence.text_sha256,
      quote_sha256: occurrence.text_sha256,
      raw_text: occurrence.quote,
      normalised_reference: 'knowledge',
    },
    resolution_status: 'RESOLVED',
    target_node_ids: [nodeId(definition)],
  };
  ctx.references.push(Object.freeze({
    schema_version: REFERENCE_SCHEMA,
    reference_edge_id: contentId(REFERENCE_SCHEMA, payload),
    ...payload,
    selected_target_node_id: nodeId(definition),
    confidence: 'DETERMINISTIC_EXACT_TERM_AND_DEFINITION_MATCH',
    uncertainty: { status: 'NONE', reason_codes: [], alternatives: [] },
    rule: { rule_id: 'EXACT_DEFINED_TERM_USE_TO_DEFINITION/V1', rule_version: 1 },
  }));
}

function compileCase(ctx) {
  if (ctx.case_id === 'CONCHO_6_9_A') conchoEmployeeContext(ctx);
  else if (ctx.case_id === 'TOPBUILD_6_2') topbuildTerminationContext(ctx);
  else if (ctx.case_id === 'REDHAT_3_01_3_02') redhatContext(ctx);
  else if (ctx.case_id === 'METSERA_7_04') metseraContext(ctx);
  else if (ctx.case_id === 'CONCHO_4_10_ANNEX_A') conchoDefinitionContext(ctx);
  else if (ctx.case_id === 'TOPBUILD_6_3') topbuildCompanyTerminationContext(ctx);
  else addStatementFacts(ctx, nodesOf(ctx, 'SENTENCE'), 'CONFIRMATION_SENTENCE_DIRECT/V1');
  scanSectionReferences(ctx);
  addDefinitionEdge(ctx);
}

function assertControlInputs(control, inputs) {
  if (control?.schema_version !== 'STAGE_2Y_STRUCTURE_MIGRATION_CONTROL/V1') {
    fail('control schema drift');
  }
  const authority = control.authority || {};
  if (!authority.authorised_stages?.includes('M1')) fail('M1 authority is absent');
  for (const field of [
    'model_calls', 'phase_b_route_calls', 'product_writes', 'pin_changes',
    'baseline_changes', 'saved_control_mutations', 'release_receipts_created',
    'current_selector_changes', 'serving_changes',
  ]) {
    if (authority[field] !== 0) fail(`authority ${field} must remain zero`);
  }
  if (authority.database_target !== 'NONE'
    || authority.publication_authorisation !== 'NONE'
    || authority.internal_cutover_authorisation !== 'NONE'
    || authority.phase_b_status !== 'DEFERRED_LOCKED') {
    fail('M0 authority locks drifted');
  }
  if (inputs?.schema_version !== 'STAGE_2Y_STRUCTURE_PROTOTYPE_INPUTS/V1'
    || inputs.input_rule !== 'FROZEN_SECTIONIZER_UTF8_BYTE_SPANS'
    || inputs.rediscovery_permitted !== false) {
    fail('input schema or frozen-input rule drift');
  }
  const caseIds = (inputs.cases || []).map((entry) => entry.case_id);
  if (caseIds.length !== FROZEN_CASE_IDS.length
    || caseIds.some((caseId, index) => caseId !== FROZEN_CASE_IDS[index])) {
    fail('prototype input case set drift');
  }
  const binding = control.control_bindings?.['prototype-inputs.json'];
  const bytes = Buffer.from(`${canonicalJson(inputs)}\n`, 'utf8');
  if (binding?.path !== PROTOTYPE_INPUT_PATH
    || binding.byte_length !== bytes.length
    || binding.sha256 !== sha256Hex(bytes)) {
    fail('prototype inputs do not match the M0 binding');
  }
}

export async function buildContextPrototype({ repoRoot, control, inputs, sourcePrototype } = {}) {
  void repoRoot;
  assertControlInputs(control, inputs);
  if (!Array.isArray(sourcePrototype?.runtime_cases)) fail('sourcePrototype.runtime_cases is required');
  const frozenById = new Map((inputs.cases || []).map((entry) => [entry.case_id, entry]));
  const runtimeCases = sourcePrototype.runtime_cases.map((runtimeCase) => {
    const frozen = frozenById.get(runtimeCase.case_id);
    if (!frozen) fail(`runtime case is not frozen: ${runtimeCase.case_id}`);
    return makeCase(runtimeCase, frozen);
  });
  const expectedCaseIds = (inputs.cases || []).map((entry) => entry.case_id);
  const runtimeCaseIds = runtimeCases.map((entry) => entry.case_id);
  if (new Set(runtimeCaseIds).size !== runtimeCaseIds.length
    || runtimeCaseIds.length !== expectedCaseIds.length
    || runtimeCaseIds.some((caseId, index) => caseId !== expectedCaseIds[index])) {
    fail('runtime cases do not equal the frozen nine-case input set');
  }
  for (const caseId of DECISION_CASES) {
    if (!runtimeCases.some((entry) => entry.case_id === caseId)) fail(`missing decision case ${caseId}`);
  }
  runtimeCases.forEach(compileCase);

  const facts = runtimeCases.flatMap((entry) => entry.facts).sort((left, right) =>
    left.case_id.localeCompare(right.case_id)
      || left.source_span.start_byte - right.source_span.start_byte
      || left.target_node_id.localeCompare(right.target_node_id)
      || left.fact_type.localeCompare(right.fact_type));
  const scopeEdges = runtimeCases.flatMap((entry) => [...entry.scopes.values()]).sort((left, right) =>
    left.case_id.localeCompare(right.case_id)
      || left.support.start_byte - right.support.start_byte
      || left.scope_edge_id.localeCompare(right.scope_edge_id));
  const referenceEdges = runtimeCases.flatMap((entry) => entry.references).sort((left, right) =>
    left.case_id.localeCompare(right.case_id)
      || left.source_occurrence.start_byte - right.source_occurrence.start_byte
      || left.reference_edge_id.localeCompare(right.reference_edge_id));
  for (const runtimeCase of runtimeCases) {
    const sourceReferenceCount = runtimeCase.nodes.filter((node) =>
      kind(node) === 'REFERENCE_OCCURRENCE'
        && (node.roles || []).includes('CROSS_REFERENCE')).length;
    const edgeCount = referenceEdges.filter((edge) =>
      edge.case_id === runtimeCase.case_id && edge.edge_type === 'SECTION_REFERENCE').length;
    if (edgeCount !== sourceReferenceCount) {
      fail(`${runtimeCase.case_id} reference-edge inventory does not equal the source index`);
    }
  }
  const metseraReferences = referenceEdges.filter((edge) =>
    edge.case_id === 'METSERA_7_04' && edge.edge_type === 'SECTION_REFERENCE');
  if (metseraReferences.length !== 4) fail(`METSERA_7_04 requires four reference occurrences, got ${metseraReferences.length}`);
  const topbuildConfirmationReferences = referenceEdges.filter((edge) =>
    edge.case_id === 'TOPBUILD_6_3' && edge.edge_type === 'SECTION_REFERENCE');
  if (topbuildConfirmationReferences.length !== 4) {
    fail(`TOPBUILD_6_3 requires four reference occurrences, got ${topbuildConfirmationReferences.length}`);
  }
  const metseraConfirmationReferences = referenceEdges.filter((edge) =>
    edge.case_id === 'METSERA_9_03' && edge.edge_type === 'SECTION_REFERENCE');
  if (metseraConfirmationReferences.length !== 2) {
    fail(`METSERA_9_03 requires two reference occurrences, got ${metseraConfirmationReferences.length}`);
  }
  const definitionLinks = referenceEdges.filter((edge) =>
    edge.case_id === 'CONCHO_4_10_ANNEX_A' && edge.edge_type === 'USES_DEFINITION');
  if (definitionLinks.length !== 1 || definitionLinks[0].resolution_status !== 'RESOLVED') {
    fail('Concho 4.10 to Annex A definition link is not uniquely resolved');
  }
  const diagnostics = runtimeCases.flatMap((entry) =>
    entry.diagnostics.map((diagnostic) => ({ case_id: entry.case_id, ...diagnostic })));

  return Object.freeze({
    contextFacts: Object.freeze({
      schema_version: FACTS_SCHEMA,
      fact_count: facts.length,
      inherited_fact_count: facts.filter((fact) => fact.status === 'INHERITED').length,
      scope_edge_count: scopeEdges.length,
      facts: Object.freeze(facts),
      scope_edges: Object.freeze(scopeEdges),
      cases: Object.freeze(runtimeCases.map((entry) => Object.freeze({
        case_id: entry.case_id,
        set: entry.frozen.set,
        fact_ids: Object.freeze(entry.facts.map((fact) => fact.context_fact_id).sort()),
        scope_edge_ids: Object.freeze([...entry.scopes.keys()].sort()),
      }))),
      diagnostics: Object.freeze(diagnostics),
      authority: Object.freeze({ model_calls: 0, product_writes: 0, publication_authorisation: 'NONE' }),
    }),
    referenceEdges: Object.freeze({
      schema_version: REFERENCES_SCHEMA,
      edge_count: referenceEdges.length,
      edges: Object.freeze(referenceEdges),
      cases: Object.freeze(runtimeCases.map((entry) => Object.freeze({
        case_id: entry.case_id,
        set: entry.frozen.set,
        reference_edge_ids: Object.freeze(entry.references.map((edge) => edge.reference_edge_id).sort()),
      }))),
      diagnostics: Object.freeze(diagnostics.filter((entry) => /REFERENCE|DEFINITION/.test(entry.code || ''))),
      authority: Object.freeze({ model_calls: 0, product_writes: 0, publication_authorisation: 'NONE' }),
    }),
  });
}
