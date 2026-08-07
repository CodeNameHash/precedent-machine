// Derives `family -> [section_reference]` for a document, with no model calls.
//
// PLAN.md Step 2A. Every deal after Modiv and TopBuild needs a per-family
// section list, and hand-authoring 25 of them per document does not scale to
// the 10-15 document ladder. This produces the same decision the classifier
// already makes, from the document itself.
//
// This is stage 1 only: deterministic title and heading rules plus the two
// defined-term anchors. Zero model calls, zero cost, and no
// SECTION_FAMILY_AI_UNVERIFIED flag -- that flag is raised only for stage-2
// model-assisted matches (see `sectionFamilyUnverifiedReason` in
// candidate-resolution.js).
//
// WHAT THIS IS NOT: a replacement for reading the document. Stage 1 matches
// titles and headings, so it cannot know that Modiv's appraisal-availability
// sentence sits in section 2.6, whose title gives no hint. Its output is a
// proposal to review, not a pinned list. PLAN.md Step 2A requires the
// generated output be committed alongside the human-corrected version so the
// difference stays visible.
//
// Three pieces below were copied deliberately from
// full-corpus-routing-prompt-cost-audit.js, which already does this
// composition for a fixed audit cohort. Two are load-bearing here and one is
// a retained fallback; all three fail silently rather than throwing:
//   1. Title inheritance. Measured on Modiv: 362 of 471 referenced nodes
//      carry no heading of their own (deterministic-sectionizer.js:327).
//      BUT all 101 dispatchable nodes do, because the filter in note 2 runs
//      first and selects heading-bearing nodes. So the parent walk is a
//      no-op for THIS composition -- it is load-bearing in the precedent,
//      which classifies a different node set. Retained as the fallback
//      rather than deleted: nothing guarantees another document's tree has
//      the same property, and the failure mode is silent.
//   2. The dispatchable-node filter. Heading-less children inherit an
//      ancestor's title, so classifying every node drags a matching section's
//      whole subtree into the family.
//   3. utf8Slice. This pipeline slices by UTF-8 bytes everywhere; .slice()
//      and indexOf count UTF-16 code units.
// Skip 2 and it wildly over-reports; skip 3 and it misaligns on any
// non-ASCII byte. Neither throws. Skip 1 and nothing changes on the two
// pinned deals today, which is precisely why it is kept and tested against a
// synthetic tree rather than trusted to the real one.

const { utf8Slice } = require('../canonical-bytes');
const { sectionizeAdmittedSource } = require('./deterministic-sectionizer');
const {
  classifyDeterministicSectionFamilies,
  SECTION_FAMILY_RULE_CLASSIFIED,
  SECTION_FAMILY_DEFINED_TERM_ANCHORED,
} = require('./section-family-classifier');
const { listRegisteredSectionFamilies } = require('./producer-prompt-registry');

// Stage-1 provenances only. SECTION_FAMILY_AI_CLASSIFIED is deliberately
// absent: admitting it here would import the blocking unverified flag this
// generator exists to avoid.
const ACCEPTED_PROVENANCE = Object.freeze([
  SECTION_FAMILY_RULE_CLASSIFIED,
  SECTION_FAMILY_DEFINED_TERM_ANCHORED,
]);

// Walks up parent_section_id to the nearest non-empty heading. See note 1.
function deriveSectionTitle(tree, node) {
  const byId = new Map(tree.nodes.map((candidate) => [candidate.section_id, candidate]));
  let current = node;
  const seen = new Set();
  while (current && !seen.has(current.section_id)) {
    seen.add(current.section_id);
    if (typeof current.heading === 'string' && current.heading.length > 0) return current.heading;
    current = current.parent_section_id ? byId.get(current.parent_section_id) : null;
  }
  return null;
}

// Restricts to the outer sections a run would actually route. See note 2.
function dispatchableNodes(tree) {
  const nodes = tree.nodes.filter((node) => node.reference);
  const byId = new Map(tree.nodes.map((item) => [item.section_id, item]));
  const hasSectionDescendant = (candidate) => nodes.some((node) => {
    if (node.kind !== 'SECTION' || !node.parent_section_id) return false;
    let parent = node.parent_section_id;
    const seen = new Set();
    while (parent && !seen.has(parent)) {
      if (parent === candidate.section_id) return true;
      seen.add(parent);
      parent = byId.get(parent)?.parent_section_id || null;
    }
    return false;
  });
  const primary = nodes.filter((node) => node.kind === 'SECTION'
    || (node.kind === 'ARTICLE' && !hasSectionDescendant(node)));
  if (primary.length > 0) return primary;
  return nodes.filter((node) => node.kind === 'SUBSECTION');
}

// Returns { by_family, unmatched_families, node_count, dispatchable_count }.
//
// `by_family` carries an entry for EVERY registered family, including the ones
// that matched nothing. An absent key and an empty list are different claims,
// and a family resolving to zero sections is a finding to record rather than
// a family to drop -- PLAN.md Step 2E says so explicitly, because
// GUARANTY_FINANCING_PARTY resolving to zero on a financed deal would mean
// the mapping is wrong.
function generateFamilySectionRefs({ source_text: sourceText, document_hash: documentHash } = {}) {
  if (typeof sourceText !== 'string' || sourceText.length === 0) {
    throw new Error('SOURCE_TEXT_REQUIRED: source_text must be a non-empty string');
  }
  if (typeof documentHash !== 'string' || !documentHash) {
    throw new Error('DOCUMENT_HASH_REQUIRED: document_hash must be a non-empty string');
  }

  const families = listRegisteredSectionFamilies();
  const registered = new Set(families);
  const tree = sectionizeAdmittedSource({ source_text: sourceText, document_hash: documentHash });
  const dispatchable = dispatchableNodes(tree);

  // Map rather than object: preserves first-seen order and keeps references
  // in document order, which is what a human reviewing the list expects.
  const byFamily = new Map(families.map((family) => [family, []]));

  for (const node of dispatchable) {
    const text = utf8Slice(sourceText, node.start, node.end);
    const classifications = classifyDeterministicSectionFamilies({
      title: deriveSectionTitle(tree, node),
      // Always null in every live path today -- deterministic-sectionizer
      // never sets it. Passed through rather than assumed, so this keeps
      // working if that changes.
      article_context: node.article_context || null,
      source_text: text,
    });
    for (const classification of classifications) {
      if (!ACCEPTED_PROVENANCE.includes(classification.provenance)) continue;
      if (!registered.has(classification.section_family)) continue;
      const refs = byFamily.get(classification.section_family);
      if (!refs.includes(node.reference)) refs.push(node.reference);
    }
  }

  const byFamilyObject = {};
  const unmatched = [];
  for (const family of families) {
    const refs = byFamily.get(family);
    byFamilyObject[family] = Object.freeze([...refs]);
    if (refs.length === 0) unmatched.push(family);
  }

  return Object.freeze({
    by_family: Object.freeze(byFamilyObject),
    unmatched_families: Object.freeze(unmatched),
    node_count: tree.nodes.length,
    dispatchable_count: dispatchable.length,
    registered_family_count: families.length,
  });
}

module.exports = {
  generateFamilySectionRefs,
  deriveSectionTitle,
  dispatchableNodes,
  ACCEPTED_PROVENANCE,
};
