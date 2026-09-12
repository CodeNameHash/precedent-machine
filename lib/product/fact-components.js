'use strict';

// Validation and rendering helpers for FACT_COMPONENTS/V2, the layered fact
// model decided on 2026-09-12. Contract: contracts/product/fact-components.v2.json.
// Pure functions; no database or model access.

const contract = require('../../contracts/product/fact-components.v2.json');

const KINDS = new Set(contract.component.component_kinds);
const ORIGINS = new Set(contract.component.origins);
const VALUE_KINDS = new Set(['THRESHOLD', 'PERIOD', 'PERCENTAGE', 'DATE', 'AMOUNT']);
const FORBIDDEN_TEXT = /^(none|n\/a|not applicable|none stated)$/i;

function byteSlice(text, start, end) {
  const bytes = new TextEncoder().encode(text);
  return new TextDecoder().decode(bytes.slice(start, end));
}

// Walks the tree depth first, yielding [component, path, parent].
function* walk(components, path = [], parent = null) {
  for (let index = 0; index < (components || []).length; index += 1) {
    const component = components[index];
    const here = [...path, index];
    yield [component, here, parent];
    yield* walk(component.children, here, component);
  }
}

// Returns a list of problems; an empty list means the fact satisfies the
// contract. `sourceText` and `spans` (span_id -> {start_byte,end_byte,
// exact_text}) enable the byte checks of rule R1.
function validateFactComponents(fact, { sourceText = null, spansById = new Map() } = {}) {
  const problems = [];
  if (!fact || typeof fact !== 'object') return ['fact missing'];
  if (!fact.headline || typeof fact.headline.label !== 'string' || !fact.headline.label.trim()) {
    problems.push('headline label missing');
  }
  if (!Array.isArray(fact.components) || fact.components.length === 0) {
    problems.push('components missing');
    return problems;
  }
  const ids = new Map();
  for (const [component, path, parent] of walk(fact.components)) {
    const where = path.join('.');
    if (!component || typeof component !== 'object') { problems.push(`${where}: not an object`); continue; }
    if (!KINDS.has(component.kind)) problems.push(`${where}: unknown kind ${component.kind}`);
    if (!ORIGINS.has(component.origin)) problems.push(`${where}: unknown origin ${component.origin}`);
    if (typeof component.text !== 'string' || !component.text.trim()) problems.push(`${where}: text missing`);
    else if (FORBIDDEN_TEXT.test(component.text.trim())) problems.push(`${where}: invented text "${component.text}"`);
    else if (/\.\.\.|…/.test(component.text)) problems.push(`${where}: text contains an ellipsis`);
    if (typeof component.component_id !== 'string' || !component.component_id) problems.push(`${where}: component_id missing`);
    else if (ids.has(component.component_id)) problems.push(`${where}: duplicate component_id`);
    else ids.set(component.component_id, component);
    if (component.kind === 'LITANY') {
      if (!Array.isArray(component.members) || component.members.length < 2) problems.push(`${where}: LITANY needs members`);
      if ((component.children || []).length) problems.push(`${where}: LITANY has children`);
    } else if (component.members !== undefined) problems.push(`${where}: members only on LITANY`);
    if (component.kind === 'LIST' && !(component.children || []).some((child) => child.kind === 'LIST_ELEMENT')) {
      problems.push(`${where}: LIST without LIST_ELEMENT children`);
    }
    if (component.kind === 'LIST_ELEMENT' && !(parent && (parent.kind === 'LIST' || parent.kind === 'LIST_ELEMENT'))) {
      problems.push(`${where}: LIST_ELEMENT outside a LIST`);
    }
    if (VALUE_KINDS.has(component.kind) && (!component.value || component.value.canonical === undefined)) {
      problems.push(`${where}: ${component.kind} needs a canonical value`);
    }
    if (['CHAPEAU', 'INTRO', 'DEFINITION'].includes(component.origin) && !component.origin_structure_node_id) {
      problems.push(`${where}: inherited component needs origin_structure_node_id`);
    }
    if (component.kind === 'CROSS_REFERENCE' && !(component.resolves_to && component.resolves_to.structure_node_id)) {
      problems.push(`${where}: CROSS_REFERENCE must resolve`);
    }
    if (Number.isSafeInteger(component.start_byte) && Number.isSafeInteger(component.end_byte)) {
      if (component.end_byte <= component.start_byte) problems.push(`${where}: empty byte range`);
      else if (sourceText && byteSlice(sourceText, component.start_byte, component.end_byte) !== component.text) {
        problems.push(`${where}: text does not match canonical bytes`);
      }
      const span = spansById.get(component.source_span_id);
      if (span && (component.start_byte < span.start_byte || component.end_byte > span.end_byte)) {
        problems.push(`${where}: outside its source span`);
      }
    } else if (sourceText) problems.push(`${where}: byte range missing`);
  }
  for (const id of fact.headline?.distinguishing_component_ids || []) {
    if (!ids.has(id)) problems.push(`headline: unknown distinguishing component ${id}`);
  }
  if (!(fact.headline?.distinguishing_component_ids || []).length) problems.push('headline: no distinguishing component');
  return problems;
}

// Layer 0 text: label plus the distinguishing components' verbatim words.
function renderHeadline(fact) {
  const byId = new Map([...walk(fact.components || [])].map(([component]) => [component.component_id, component]));
  const parts = (fact.headline?.distinguishing_component_ids || []).map((id) => byId.get(id)?.text).filter(Boolean);
  return parts.length ? `${fact.headline.label}: ${parts.join(' / ')}` : fact.headline?.label || '';
}

// Flattens one layer for display: siblings in order, with [...] markers.
function renderLayer(components) {
  return (components || []).map((component) => ({
    component_id: component.component_id,
    label: component.label || null,
    kind: component.kind,
    origin: component.origin,
    inherited: component.origin !== 'OWN',
    gap_before: component.gap_before === true,
    text: component.text,
    has_children: (component.children || []).length > 0,
    members: component.kind === 'LITANY' ? component.members : undefined,
    value: component.value || undefined,
    resolves_to: component.resolves_to || undefined,
  }));
}

// Words of the fact's own operative text not covered by any OWN component
// (rule R9), as byte ranges relative to the canonical text.
function uncoveredRanges(fact, factStartByte, factEndByte) {
  const covered = [...walk(fact.components || [])]
    .map(([component]) => component)
    .filter((component) => component.origin === 'OWN' && Number.isSafeInteger(component.start_byte) && Number.isSafeInteger(component.end_byte))
    .map((component) => [component.start_byte, component.end_byte])
    .sort((left, right) => left[0] - right[0]);
  const gaps = [];
  let cursor = factStartByte;
  for (const [start, end] of covered) {
    if (start > cursor) gaps.push([cursor, start]);
    cursor = Math.max(cursor, end);
  }
  if (cursor < factEndByte) gaps.push([cursor, factEndByte]);
  return gaps;
}

module.exports = { contract, validateFactComponents, renderHeadline, renderLayer, uncoveredRanges, walk };
