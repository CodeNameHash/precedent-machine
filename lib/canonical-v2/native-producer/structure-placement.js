/**
 * lib/canonical-v2/native-producer/structure-placement.js
 *
 * Step 2X-A corpus-wide placement pass.
 *
 * Annotates resolution entries with `structure_context` — the governing
 * chapeau chain from `resolveGoverningStructure`, by containment on each
 * assertion's existing evidence byte spans. Annotation only: never mints
 * claim identity, never rewrites `claim_revision_id` / content-addressed
 * payloads, never gates model input.
 *
 * Every annotated entry carries either a RESOLVED `structure_context` or a
 * typed UNDETERMINED — zero silently absent.
 *
 * Fail closed on: span-crossing quotes, same-style chains, missing evidence.
 * Markerless sections get section-only RESOLVED context (honest floor).
 *
 * Scope intent (PLAN.md): ALL sections via sectionizer inventory, not only
 * extracted ones. This module annotates assertions that already exist; a
 * companion inventory walk (`annotateSectionInventory`) records structure
 * for sections with no claims so absence questions have a join key later
 * without minting limb identity today.
 */

'use strict';

const { utf8Slice } = require('../canonical-bytes');
const {
  buildSectionOutline,
  resolveGoverningStructure,
  UNDETERMINED_REASONS,
  GOVERNING_STRUCTURE_SCHEMA,
  SEGMENTER_VERSION,
} = require('./governing-structure');

function undeterminedContext(reason, extra = null) {
  const body = {
    status: 'UNDETERMINED',
    reason,
    schema_version: GOVERNING_STRUCTURE_SCHEMA,
    segmenter_version: SEGMENTER_VERSION,
  };
  if (extra && typeof extra === 'object') Object.assign(body, extra);
  return Object.freeze(body);
}

function evidenceSpanForEntry(entry) {
  const edges = entry?.claim?.evidence;
  if (!Array.isArray(edges) || edges.length === 0) return null;
  let start = null;
  let end = null;
  for (const edge of edges) {
    if (!Number.isInteger(edge.absolute_start) || !Number.isInteger(edge.absolute_end)) continue;
    if (edge.absolute_end < edge.absolute_start) continue;
    if (start === null || edge.absolute_start < start) start = edge.absolute_start;
    if (end === null || edge.absolute_end > end) end = edge.absolute_end;
  }
  if (start === null || end === null || end <= start) return null;
  return { absolute_start: start, absolute_end: end };
}

function sectionTextForEntry({
  entry,
  sectionsByReference,
  admittedSourceContext,
  sectionTextByReference,
}) {
  const ref = entry?.section_reference;
  if (typeof ref === 'string' && sectionTextByReference && sectionTextByReference.has(ref)) {
    // Pre-sliced section text: evidence spans are section-local.
    return { sectionText: sectionTextByReference.get(ref), sectionStart: 0, relative: true };
  }
  const section = sectionsByReference && typeof ref === 'string'
    ? sectionsByReference.get(ref)
    : null;
  if (!section || !Number.isInteger(section.start) || !Number.isInteger(section.end)) {
    return null;
  }
  const fullText = admittedSourceContext?.canonical_text?.text;
  if (typeof fullText !== 'string') return null;
  // Live resolver path: evidence absolute_* are already section-local.
  return {
    sectionText: utf8Slice(fullText, section.start, section.end),
    sectionStart: section.start,
    relative: true,
  };
}

/**
 * Annotate one resolution entry. Returns a new frozen object with
 * `structure_context` set. Does not mutate the claim.
 */
function annotateEntryStructureContext(entry, {
  sectionsByReference = null,
  admittedSourceContext = null,
  sectionTextByReference = null,
  outlineByReference = null,
} = {}) {
  if (!entry || typeof entry !== 'object') {
    return entry;
  }

  const span = evidenceSpanForEntry(entry);
  if (!span) {
    return Object.freeze({
      ...entry,
      structure_context: undeterminedContext(UNDETERMINED_REASONS.NO_EVIDENCE_SPAN),
    });
  }

  const located = sectionTextForEntry({
    entry,
    sectionsByReference,
    admittedSourceContext,
    sectionTextByReference,
  });
  if (!located) {
    return Object.freeze({
      ...entry,
      structure_context: undeterminedContext(UNDETERMINED_REASONS.SPAN_OUTSIDE_TEXT, {
        detail: 'section_unavailable',
      }),
    });
  }

  const { sectionText, sectionStart } = located;
  const ref = entry.section_reference;
  let outline = outlineByReference && outlineByReference.get(ref);
  if (!outline) {
    outline = buildSectionOutline(sectionText);
    if (outlineByReference) outlineByReference.set(ref, outline);
  }

  // Claim evidence absolute_start/absolute_end are section-local byte
  // offsets (despite the name) — confirmed against live resolution rows
  // where section.start + evidence.absolute_start lands on the quote.
  // sectionStart is retained for callers that pass document-absolute spans
  // via sectionTextByReference with relative:false and document offsets;
  // the default path uses section-local spans as-is.
  const startByte = located.relative
    ? span.absolute_start
    : span.absolute_start - sectionStart;
  const endByte = located.relative
    ? span.absolute_end
    : span.absolute_end - sectionStart;

  const governing = resolveGoverningStructure({
    sectionText,
    startByte,
    endByte,
    outline,
  });

  const structureContext = governing.status === 'RESOLVED'
    ? Object.freeze({
      status: 'RESOLVED',
      schema_version: GOVERNING_STRUCTURE_SCHEMA,
      segmenter_version: SEGMENTER_VERSION,
      leaf: governing.leaf,
      chain: governing.chain,
      markerless: governing.markerless,
      marker_tier: governing.marker_tier,
      // Annotation provenance — never an identity payload.
      annotation_only: true,
    })
    : Object.freeze({
      status: 'UNDETERMINED',
      reason: governing.reason,
      schema_version: GOVERNING_STRUCTURE_SCHEMA,
      segmenter_version: SEGMENTER_VERSION,
      path: governing.path || null,
      annotation_only: true,
      ...(governing.same_style_paths
        ? { same_style_paths: governing.same_style_paths }
        : {}),
    });

  return Object.freeze({
    ...entry,
    structure_context: structureContext,
  });
}

/**
 * Annotate arrays of resolution entries. Preserves claim identity fields.
 * Returns new arrays; input arrays are not mutated.
 */
function annotateResolutionStructureContexts({
  resolved = [],
  review_queue: reviewQueue = [],
  open_world: openWorld = [],
  sectionsByReference = null,
  admittedSourceContext = null,
  sectionTextByReference = null,
} = {}) {
  const outlineByReference = new Map();
  const opts = {
    sectionsByReference,
    admittedSourceContext,
    sectionTextByReference,
    outlineByReference,
  };

  const annotateList = (list) => Object.freeze(
    (Array.isArray(list) ? list : []).map((entry) => annotateEntryStructureContext(entry, opts)),
  );

  return Object.freeze({
    resolved: annotateList(resolved),
    review_queue: annotateList(reviewQueue),
    open_world: annotateList(openWorld),
  });
}

/**
 * Section-inventory half: for every section reference supplied (from the
 * sectionizer tree), record outline metadata even when no assertion was
 * extracted. Does not mint limb identity — only annotation records.
 */
function annotateSectionInventory({
  sectionTextByReference,
} = {}) {
  if (!sectionTextByReference || typeof sectionTextByReference.entries !== 'function') {
    return Object.freeze([]);
  }
  const records = [];
  for (const [reference, sectionText] of sectionTextByReference.entries()) {
    const outline = buildSectionOutline(sectionText);
    records.push(Object.freeze({
      section_reference: reference,
      schema_version: GOVERNING_STRUCTURE_SCHEMA,
      segmenter_version: SEGMENTER_VERSION,
      markerless: outline.markerless,
      same_style_paths: outline.same_style_paths,
      leaf_count: outline.leaves.length,
      marker_tier_counts: Object.freeze(outline.marker_tiers.reduce((acc, tier) => {
        acc[tier.tier] = (acc[tier.tier] || 0) + 1;
        return acc;
      }, {})),
      annotation_only: true,
      // Section-only floor when markerless; otherwise outline available for joins.
      structure_context: outline.markerless
        ? Object.freeze({
          status: 'RESOLVED',
          reason: UNDETERMINED_REASONS.MARKERLESS_SECTION_ONLY,
          markerless: true,
          segmenter_version: SEGMENTER_VERSION,
          schema_version: GOVERNING_STRUCTURE_SCHEMA,
          leaf: outline.leaves[0]
            ? Object.freeze({
              path: null,
              depth: 0,
              start_byte: outline.leaves[0].start_byte,
              end_byte: outline.leaves[0].end_byte,
            })
            : null,
          chain: outline.leaves[0]
            ? Object.freeze([Object.freeze({
              path: null,
              start_byte: outline.leaves[0].start_byte,
              end_byte: outline.leaves[0].end_byte,
              text: outline.leaves[0].text,
            })])
            : Object.freeze([]),
          annotation_only: true,
        })
        : Object.freeze({
          status: 'RESOLVED',
          markerless: false,
          segmenter_version: SEGMENTER_VERSION,
          schema_version: GOVERNING_STRUCTURE_SCHEMA,
          same_style_paths: outline.same_style_paths,
          annotation_only: true,
        }),
    }));
  }
  return Object.freeze(records);
}

module.exports = {
  annotateEntryStructureContext,
  annotateResolutionStructureContexts,
  annotateSectionInventory,
  evidenceSpanForEntry,
  UNDETERMINED_REASONS,
};
