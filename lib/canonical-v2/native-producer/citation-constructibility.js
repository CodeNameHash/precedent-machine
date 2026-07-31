/**
 * lib/canonical-v2/native-producer/citation-constructibility.js
 *
 * Checks a model-emitted section citation (e.g. "3.1(b)(i)") for
 * CONSTRUCTIBILITY against the sectionizer's own discovered tree, instead of
 * for literal string presence in the source text. See
 * docs/handoffs/F28-FIRST-LIVE-RUN.md defect 3.
 *
 * WHY CONSTRUCTIBILITY, NOT LITERAL PRESENCE
 *
 * The first version of this check tested whether the citation string
 * appeared verbatim in the document. That is the WRONG test: a citation like
 * "3.1(c)(i)" is normally CONSTRUCTED by the reader from the document's own
 * hierarchy -- the text prints "Section 3.1" as a heading, then "(c)", then
 * "(i)" as separate markers -- and the concatenated string "3.1(c)(i)" never
 * appears literally anywhere. Rejecting citations because the concatenation
 * is absent would reject most correct citations in real agreements.
 *
 * THE CORRECT RULE
 *
 *  1. This module DERIVES the canonical citation itself, by finding the
 *     deepest node in the sectionizer's discovered tree whose byte span
 *     contains the evidence in question (`deriveCitationForSpan`). That
 *     derived citation is authoritative -- it comes from structure this
 *     repo parsed independently of anything the model said.
 *  2. The model's own `section_reference` is a CROSS-CHECK, not a source.
 *     It is parsed into ordered components ("3.1(b)(i)" -> ["3.1","(b)",
 *     "(i)"]) and reassembled into the sectionizer's own concatenated
 *     reference format, then tested against the SET of reference strings
 *     the sectionizer actually discovered (`checkCitationConstructibility`).
 *     Because every discovered reference is itself built by exactly that
 *     same parent-reference-plus-own-label concatenation
 *     (deterministic-sectionizer.js's `appendMarkerNodes`), an exact match
 *     against a discovered reference IS a proof that a real path through the
 *     tree produces that citation -- there is no need to separately re-walk
 *     parent_section_id chains.
 *  3. Three outcomes, never a binary hallucination/not-hallucination call:
 *       - AGREEMENT: the model's citation resolves to a node, and that node
 *         IS the derived node. No residual.
 *       - CITATION_DISAGREEMENT: the model's citation resolves to a REAL
 *         node in the tree, but a DIFFERENT one than the derived node. This
 *         is diagnostic either way (the model may have mis-cited, or the
 *         derivation may be wrong) -- never assumed to be the model's fault.
 *       - CITATION_NOT_CONSTRUCTIBLE: the model's citation does not resolve
 *         to ANY node in the discovered tree at all -- no level of this
 *         document's actual structure could produce it.
 *
 * GENERALISED PRINCIPLE (apply this wherever a model emits a field that
 * references document structure, not just section_reference): check the
 * field for CONSTRUCTIBILITY against structure derived independently, never
 * for literal string presence, and never take it on the model's word. Where
 * the value can be derived directly, the derivation is authoritative and the
 * model's version is only ever a cross-check.
 */

'use strict';

/**
 * Finds the deepest node in `tree.nodes` whose half-open byte span
 * [start, end) fully contains [globalStart, globalEnd). Ties cannot occur in
 * practice: sibling section/marker nodes never overlap by construction
 * (deterministic-sectionizer.js), so among all containing nodes the one with
 * the greatest `depth` is unique. Returns null if no node contains the span
 * (should not happen for a span that came from this same tree's own text,
 * short of a degenerate empty tree).
 *
 * @param {object|Array} tree   a DETERMINISTIC_SECTIONIZER/V1 tree (or its
 *                              own `.nodes` array directly)
 * @param {number} globalStart  document-absolute UTF-8 byte offset (inclusive)
 * @param {number} globalEnd    document-absolute UTF-8 byte offset (exclusive)
 * @returns {object|null} the deepest containing node, or null
 */
function deriveCitationForSpan(tree, globalStart, globalEnd) {
  const nodes = Array.isArray(tree) ? tree : (tree && tree.nodes) || [];
  let best = null;
  for (const node of nodes) {
    if (node.start <= globalStart && globalEnd <= node.end) {
      if (!best || node.depth > best.depth) best = node;
    }
  }
  return best;
}

/**
 * Parses a raw citation string into its ordered components: an optional
 * leading section-number token (e.g. "3.1", or a sectionizer synthetic
 * token like "III-INTRO"), followed by zero or more parenthesized limb
 * labels in order. A leading "Section " word is stripped (case-insensitive)
 * since it is prose framing, not part of the reference itself.
 *
 * @param {string} raw
 * @returns {string[]|null} ordered components, or null if raw is not a string
 */
function parseCitationComponents(raw) {
  if (typeof raw !== 'string') return null;
  const stripped = raw.trim().replace(/^section\s+/i, '');
  const components = [];
  const leading = /^[^\s(]+/.exec(stripped);
  let rest = stripped;
  if (leading) {
    components.push(leading[0]);
    rest = stripped.slice(leading[0].length);
  }
  const labelPattern = /\(\s*([^()\s]+)\s*\)/g;
  let match = labelPattern.exec(rest);
  while (match !== null) {
    components.push(`(${match[1]})`);
    match = labelPattern.exec(rest);
  }
  return components;
}

/**
 * Reassembles parsed components into the sectionizer's own concatenated
 * reference format (no separators between components -- see
 * deterministic-sectionizer.js's `appendMarkerNodes`).
 */
function citationFromComponents(components) {
  return Array.isArray(components) ? components.join('') : null;
}

/**
 * Cross-checks a model-emitted citation against the sectionizer's discovered
 * tree. Never throws; returns null when there is nothing to check (no
 * citation supplied).
 *
 * @param {object} args
 * @param {object|Array} args.tree          the sectionizer tree (or `.nodes`)
 * @param {string} args.model_citation      the model's raw section_reference string
 * @param {object|null} [args.derived_node] the node this module (or its caller)
 *                                          independently derived for the evidence
 *                                          in question -- typically the governing
 *                                          section's own resolved node
 * @returns {{status: string, model_citation: string, normalized_citation: string,
 *   derived_citation: (string|null), resolved_section_id: (string|null),
 *   derived_section_id: (string|null)}|null}
 */
function checkCitationConstructibility({ tree, model_citation: modelCitation, derived_node: derivedNode = null }) {
  if (typeof modelCitation !== 'string' || modelCitation.trim().length === 0) return null;

  const nodes = Array.isArray(tree) ? tree : (tree && tree.nodes) || [];
  const normalized = citationFromComponents(parseCitationComponents(modelCitation));
  const derivedCitation = derivedNode ? derivedNode.reference : null;
  const derivedSectionId = derivedNode ? derivedNode.section_id : null;

  const resolvedNode = nodes.find((node) => node.reference != null && node.reference === normalized) || null;

  if (!resolvedNode) {
    return {
      status: 'CITATION_NOT_CONSTRUCTIBLE',
      model_citation: modelCitation,
      normalized_citation: normalized,
      derived_citation: derivedCitation,
      resolved_section_id: null,
      derived_section_id: derivedSectionId,
    };
  }

  if (derivedNode && resolvedNode.section_id === derivedNode.section_id) {
    return {
      status: 'AGREEMENT',
      model_citation: modelCitation,
      normalized_citation: normalized,
      derived_citation: derivedCitation,
      resolved_section_id: resolvedNode.section_id,
      derived_section_id: derivedSectionId,
    };
  }

  return {
    status: 'CITATION_DISAGREEMENT',
    model_citation: modelCitation,
    normalized_citation: normalized,
    derived_citation: derivedCitation,
    resolved_section_id: resolvedNode.section_id,
    derived_section_id: derivedSectionId,
  };
}

module.exports = {
  deriveCitationForSpan,
  parseCitationComponents,
  citationFromComponents,
  checkCitationConstructibility,
};
