'use strict';

// Rebuilds a FACT_COMPONENTS/V2 tree from a lawyer's component-level edits on
// the focused review page (plan 5B.4). Pure; no DOM or network access, so it
// is exercised directly by tests instead of through simulated clicks.
//
// Untouched components keep every field, including origin and byte range.
// A component whose text was edited, or a newly added top-level component,
// is verbatim-only: its text must appear exactly once in the section's full
// text, and it becomes origin OWN, grounded in the section's own span, with
// byte offsets computed the way `byteRangesToParts` reads them -- the UTF-8
// byte length of the text before it, never a string index.

const { parseComponentValue, VALUE_KINDS } = require('./fact-components');

function locateUniqueText(sectionText, text) {
  if (typeof text !== 'string' || text.trim() === '') return null;
  const first = sectionText.indexOf(text);
  if (first === -1 || sectionText.indexOf(text, first + 1) !== -1) return null;
  return first;
}

function byteOffsetsForText(sectionText, sectionStartByte, text) {
  const index = locateUniqueText(sectionText, text);
  if (index === null) return null;
  const prefixBytes = new TextEncoder().encode(sectionText.slice(0, index)).length;
  const textBytes = new TextEncoder().encode(text).length;
  return { start_byte: sectionStartByte + prefixBytes, end_byte: sectionStartByte + prefixBytes + textBytes };
}

// `edits` is a Map of component_id -> new text. `removed` is a Set of
// component_id. `additions` is an array of { id, kind, text } appended as
// top-level siblings. Returns { components, problems }; a non-empty
// `problems` list (one entry per component whose text is missing or not
// unique in the section) means the tree must not be saved.
function buildEditedComponents({ components, edits, removed, additions, sectionText, sectionStartByte, sectionSpanId }) {
  const problems = [];
  function rebuildList(list) {
    return (list || [])
      .filter((component) => !removed.has(component.component_id))
      .map(rebuildOne);
  }
  function rebuildOne(component) {
    const children = rebuildList(component.children);
    if (!edits.has(component.component_id)) return { ...component, children };
    const text = edits.get(component.component_id);
    const offsets = byteOffsetsForText(sectionText, sectionStartByte, text);
    if (!offsets) {
      problems.push({ component_id: component.component_id, text });
      return { ...component, text, children };
    }
    const { origin_structure_node_id, ...rest } = component;
    return {
      ...rest,
      text,
      origin: 'OWN',
      source_span_id: sectionSpanId,
      start_byte: offsets.start_byte,
      end_byte: offsets.end_byte,
      ...(VALUE_KINDS.has(component.kind) ? { value: parseComponentValue(component.kind, text) } : {}),
      children,
    };
  }
  const rebuilt = rebuildList(components);
  const added = (additions || []).map((addition) => {
    const offsets = byteOffsetsForText(sectionText, sectionStartByte, addition.text);
    if (!offsets) problems.push({ component_id: addition.id, text: addition.text });
    return {
      component_id: addition.id,
      kind: addition.kind,
      label: null,
      text: addition.text,
      source_span_id: sectionSpanId,
      start_byte: offsets ? offsets.start_byte : null,
      end_byte: offsets ? offsets.end_byte : null,
      origin: 'OWN',
      gap_before: false,
      ...(VALUE_KINDS.has(addition.kind) ? { value: parseComponentValue(addition.kind, addition.text) } : {}),
      children: [],
    };
  });
  return { components: [...rebuilt, ...added], problems };
}

module.exports = { buildEditedComponents, byteOffsetsForText, locateUniqueText };
