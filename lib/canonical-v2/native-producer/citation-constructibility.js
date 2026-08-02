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
 *
 * CORROBORATION: A SECOND, WEAKER SOURCE (docs/handoffs/F28-SECOND-LIVE-
 * RUN.md defect 3). The rule above is a completeness claim disguised as a
 * soundness claim: it assumes every real citation is DISCOVERABLE by the
 * sectionizer's heading-only walk. A real filing can draft a numbered
 * cross-reference scheme ("Section 3.1(b)(i)") in its own prose while never
 * once spelling that number out as a HEADING the sectionizer's marker-tree
 * walk would capture (e.g. bare lettered subsections `(a)`-`(s)` directly
 * under a Roman-numeral ARTICLE, with no "Section 3.1" heading anywhere) --
 * confirmed on the real QXO/TopBuild filing, where 29 in-scope occurrences of
 * "Section 3.1(b)(i)"-shaped prose exist despite the tree never discovering
 * "3.1" as any node's own reference. Rejecting that citation outright is
 * false-negative, not caution: the document itself, not just the model,
 * attests to the citation being real. `checkCitationCorroboration` is the
 * second, independent source this module accepts: a citation the tree
 * cannot construct is still ACCEPTED, with `validation_source:
 * CORROBORATED_BY_DOCUMENT_TEXT`, when the document's own admitted text uses
 * that exact citation (zero-width/bidi tolerant, per zero-width-normalise.js
 * -- these cross-references routinely carry a real U+200E LRM between
 * "Section" and the number) immediately after the word "Section"/"Sections",
 * i.e. in a genuine cross-reference context, not a coincidental numeric
 * substring match. Corroboration is DELIBERATELY WEAKER evidence than tree
 * construction -- it proves the citation string is used consistently
 * somewhere in the document, not that this module independently derived the
 * SAME node the model is citing -- so callers must carry `validation_source`
 * through, never collapse it into a bare accepted/rejected boolean.
 *
 * QUOTE-OCCURRENCE RESOLUTION: NEVER A GLOBAL FIRST-MATCH (2026-08-02 Modiv
 * triage, defect: derived_citation picked "3.2(f)" over the model's correct
 * "3.2(g)" for the quote "as of the Capitalization Date" at document offset
 * 63512/idx 64 -- three earlier, textually identical occurrences of that
 * same phrase sit inside "3.2(f)"; whatever assigned this proposal's
 * evidence span picked the FIRST occurrence of the quote, not the one the
 * evidence actually cites, and this module then faithfully (and wrongly)
 * derived "3.2(f)" from that span). This module does not control -- and
 * this fix does not touch -- how a proposal's evidence span is assigned
 * upstream; it controls whether a resulting CITATION_DISAGREEMENT is really
 * a disagreement, or an artifact of the wrong OCCURRENCE of a repeated
 * quote being cited from.
 *
 * `resolveQuoteOccurrence` is the position-aware repair: given the model's
 * own raw quote text and the document it came from, it finds EVERY
 * occurrence of that quote (zero-width/bidi tolerant), derives a citation
 * for each one via `deriveCitationForSpan`, and asks whether EXACTLY ONE
 * occurrence's derived citation agrees with the model's own cited section.
 * If so, that occurrence -- not global position, not the first match -- is
 * the one the evidence actually cites, and `checkCitationConstructibility`
 * upgrades what would have been a CITATION_DISAGREEMENT to AGREEMENT
 * (`validation_source: CONSTRUCTED_FROM_TREE_QUOTE_POSITION`). This is
 * self-consistency, not credulity: the model's own citation is only ever
 * used to pick AMONG occurrences that are independently, structurally real
 * (each one still has to construct via the tree); it is never trusted to
 * invent a citation the tree cannot build.
 *
 * When the quote occurs more than once and NO single occurrence's derived
 * citation agrees with the model (zero matches, or -- a repeated quote
 * cited under the SAME section more than once, as this corpus's "as of the
 * Capitalization Date" is under "3.2(f)" -- more than one match), there is
 * no honest way to pick one: the checker emits a typed
 * `AMBIGUOUS_CITATION_OCCURRENCE` (accepted: false, so it counts as a
 * disagreement routed to review) rather than silently keeping whatever
 * occurrence the caller's evidence span happened to name first. Never a
 * guess, either direction.
 */

'use strict';

const { indexOfIgnoringZeroWidth, normaliseForMatching } = require('../zero-width-normalise');

// How many characters immediately before a candidate match are inspected
// for a "Section"/"Sections" marker. Generous enough to survive "&nbsp;"'s
// decoded U+00A0 and a real U+200E LRM sitting in between, never so wide
// that an unrelated earlier sentence's "Section" could satisfy it.
const CROSS_REFERENCE_LOOKBEHIND_CHARS = 15;

/**
 * True when `documentText[matchIndex]` is immediately preceded (allowing
 * ordinary/non-breaking whitespace) by the word "Section" or "Sections" --
 * i.e. the match sits in a genuine cross-reference context ("Section
 * 3.1(b)(i)", "Sections 3.1(b)(i) and 3.1(b)(ii)") rather than being a
 * coincidental numeric substring match elsewhere in the document.
 */
function isCrossReferenceContext(documentText, matchIndex) {
  const start = Math.max(0, matchIndex - CROSS_REFERENCE_LOOKBEHIND_CHARS);
  // Zero-width/bidi marks (a real U+200E LRM routinely sits right between
  // "Section" and the number in EDGAR filings -- see zero-width-normalise.js)
  // are stripped before the lookbehind test so they never defeat the
  // trailing-whitespace match; this never mutates the caller's own text.
  const window = normaliseForMatching(documentText.slice(start, matchIndex));
  return /\bsections?\b\s*$/i.test(window);
}

/**
 * Checks whether the document's OWN admitted text corroborates a citation
 * the sectionizer's tree could not construct -- see this file's header,
 * "CORROBORATION: A SECOND, WEAKER SOURCE". Never throws; returns false for
 * anything it cannot check.
 *
 * @param {object} args
 * @param {string} args.document_text   the full admitted text to search
 *                                       (never a literal-presence shortcut:
 *                                       still requires a genuine "Section(s)
 *                                       <citation>" cross-reference context)
 * @param {string} args.model_citation  the model's raw section_reference string
 * @returns {boolean}
 */
function checkCitationCorroboration({ document_text: documentText, model_citation: modelCitation }) {
  if (typeof documentText !== 'string' || documentText.length === 0) return false;
  if (typeof modelCitation !== 'string' || modelCitation.trim().length === 0) return false;
  const normalized = citationFromComponents(parseCitationComponents(modelCitation));
  if (!normalized) return false;

  let searchFrom = 0;
  while (searchFrom < documentText.length) {
    const relativeIdx = indexOfIgnoringZeroWidth(documentText.slice(searchFrom), normalized);
    if (relativeIdx === -1) return false;
    const absoluteIdx = searchFrom + relativeIdx;
    if (isCrossReferenceContext(documentText, absoluteIdx)) return true;
    searchFrom = absoluteIdx + 1;
  }
  return false;
}

// A node is part of a "decimal SECTION lineage" when its own `reference`
// starts with the `N.M` shape parseStructure's real "Section 3.7"-style
// headings AND the inline-decimal-headings pass both mint (see
// deterministic-sectionizer.js's `articlesWithRealDecimalSections` /
// `appendInlineDecimalHeadingSections`) -- this covers both the SECTION
// node itself ("3.7") and every lettered SUBSECTION marker-tree node nested
// under it ("3.7(b)", "3.7(b)(i)", ...), since `appendMarkerNodes` builds a
// child's reference by concatenating its parent's reference verbatim.
const DECIMAL_SECTION_REFERENCE_RE = /^\d+\.\d+/;

function isDecimalSectionLineage(node) {
  return typeof node.reference === 'string' && DECIMAL_SECTION_REFERENCE_RE.test(node.reference);
}

// True when `descendant` is nested under `ancestorSectionId` via the tree's
// own `parent_section_id` chain (walked, not assumed -- an arbitrary number
// of levels apart). Used by `checkCitationConstructibility`'s AGREEMENT rule
// (see that function's header) to recognise a model citation that correctly
// names the GOVERNING node for a proposal's evidence, even though per-
// proposal derivation (native-extraction-run.js) found a more specific
// descendant node -- a real, common shape: one representation_instance/
// bring_down_condition carries ONE section_reference for its WHOLE governing
// paragraph, while its individual limb/qualifier evidence quotes sit inside
// that paragraph's own lettered sub-markers (observed on the real QXO
// fixture: model cites "3.1(b)", but the "(i)"/"(iii)" assertion quotes each
// resolve to a deeper "3.1(b)(i)"/"3.1(b)(iii)" node). Never throws; returns
// false for a malformed/cyclic chain rather than looping forever.
function isDescendantOf(nodes, descendant, ancestorSectionId) {
  if (!descendant || ancestorSectionId == null) return false;
  const byId = new Map(nodes.map((node) => [node.section_id, node]));
  const seen = new Set();
  let current = descendant;
  while (current && current.parent_section_id != null && !seen.has(current.section_id)) {
    seen.add(current.section_id);
    if (current.parent_section_id === ancestorSectionId) return true;
    current = byId.get(current.parent_section_id) || null;
  }
  return false;
}

/**
 * Finds the deepest node in `tree.nodes` whose half-open byte span
 * [start, end) fully contains [globalStart, globalEnd).
 *
 * TIE-BREAK RULE (Skechers-first-live-run defect -- see native-extraction-
 * run.js's "PER-PROPOSAL DERIVATION" comment for the other half of this
 * fix). Depth alone is not a safe tie-break: a legacy, non-decimal node can
 * be BOTH a containing node AND deeper than the correct decimal-rooted one
 * for the same span, if it happens to straddle a wide byte range (observed
 * on Skechers -- an article-intro "III-INTRO" node's lettered-subsection
 * walk straddles the ENTIRE article body, including a minted decimal
 * SECTION "3.7" nested well inside it; "III-INTRO(d)" outranked "3.7" on
 * depth alone even though "3.7" is the node that actually corresponds to
 * the document's real numbered structure). The rule applied here:
 *
 *   1. Partition the containing nodes into two classes: nodes in a DECIMAL
 *      SECTION LINEAGE (`isDecimalSectionLineage`, above -- a SECTION node
 *      whose reference matches the decimal N.M shape, or any SUBSECTION
 *      nested under one) vs everything else (a bare ARTICLE/ROOT, or a
 *      SUBSECTION/lettered node hung off a non-decimal container such as
 *      "III-INTRO").
 *   2. If ANY containing node is in the decimal-lineage class, the answer
 *      comes from that class ONLY -- a decimal-lineage node outranks a
 *      non-decimal one REGARDLESS OF DEPTH. Only when NO containing node is
 *      in the decimal-lineage class (e.g. QXO, which has no decimal
 *      sections in its tree at all -- see canonical-v2-citation-
 *      constructibility.test.js's explicit assertion that this class
 *      preference never fires there) does the non-decimal class supply the
 *      answer.
 *   3. WITHIN each class, the existing depth tie-break applies unchanged:
 *      the deepest containing node in that class wins (sibling section/
 *      marker nodes never overlap by construction -- deterministic-
 *      sectionizer.js -- so within one class the deepest containing node is
 *      unique).
 *
 * Returns null if no node contains the span (should not happen for a span
 * that came from this same tree's own text, short of a degenerate empty
 * tree).
 *
 * @param {object|Array} tree   a DETERMINISTIC_SECTIONIZER/V1 tree (or its
 *                              own `.nodes` array directly)
 * @param {number} globalStart  document-absolute UTF-8 byte offset (inclusive)
 * @param {number} globalEnd    document-absolute UTF-8 byte offset (exclusive)
 * @returns {object|null} the winning containing node, or null
 */
function deriveCitationForSpan(tree, globalStart, globalEnd) {
  const nodes = Array.isArray(tree) ? tree : (tree && tree.nodes) || [];
  let bestDecimal = null;
  let bestOther = null;
  for (const node of nodes) {
    if (node.start <= globalStart && globalEnd <= node.end) {
      if (isDecimalSectionLineage(node)) {
        if (!bestDecimal || node.depth > bestDecimal.depth) bestDecimal = node;
      } else if (!bestOther || node.depth > bestOther.depth) {
        bestOther = node;
      }
    }
  }
  return bestDecimal || bestOther;
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

// Zero-width/bidi marks tolerated when locating quote occurrences -- same
// character class zero-width-normalise.js strips for comparison, kept local
// to this module rather than importing that module's own pattern (this file
// already imports `normaliseForMatching`/`indexOfIgnoringZeroWidth`, which
// is all its other zero-width tolerance needs).
const ZERO_WIDTH_CHAR_RE = /[​‌‍‎‏﻿­]/;

/**
 * Finds every occurrence of `needle` in `haystack`, tolerant of zero-width/
 * bidi marks on both sides (never mutates or reports on stripped text --
 * offsets returned are into the ORIGINAL `haystack`). Returns an array of
 * `{start, end}` char-index spans (end exclusive), document order.
 */
function findAllQuoteOccurrences(haystack, needle) {
  if (typeof haystack !== 'string' || typeof needle !== 'string') return [];
  const normalisedNeedle = normaliseForMatching(needle);
  if (normalisedNeedle === '') return [];

  const originalIndexByNormalised = [];
  let normalised = '';
  for (let i = 0; i < haystack.length; i += 1) {
    const ch = haystack[i];
    if (!ZERO_WIDTH_CHAR_RE.test(ch)) {
      originalIndexByNormalised.push(i);
      normalised += ch;
    }
  }

  const occurrences = [];
  let searchFrom = 0;
  while (searchFrom <= normalised.length) {
    const hit = normalised.indexOf(normalisedNeedle, searchFrom);
    if (hit === -1) break;
    const start = originalIndexByNormalised[hit];
    const end = originalIndexByNormalised[hit + normalisedNeedle.length - 1] + 1;
    occurrences.push({ start, end });
    searchFrom = hit + 1;
  }
  return occurrences;
}

/**
 * Position-aware resolution of WHICH occurrence of a repeated quote the
 * evidence actually cites -- see this file's header, "QUOTE-OCCURRENCE
 * RESOLUTION: NEVER A GLOBAL FIRST-MATCH". Never throws; returns `null`
 * when there is nothing to resolve from (no quote, no document text, or the
 * quote appears nowhere).
 *
 * @param {object} args
 * @param {object|Array} args.tree           the sectionizer tree (or `.nodes`)
 * @param {string} args.document_text        the full admitted document text
 * @param {string} args.quote                the model's raw evidence quote
 * @param {string|null} [args.model_citation] the model's raw section_reference
 *                                            string, used ONLY to pick among
 *                                            multiple real occurrences -- never
 *                                            to invent one the tree can't build
 * @returns {{resolved: boolean, ambiguous: boolean,
 *   occurrence: ({char_start:number, char_end:number, byte_start:number,
 *     byte_end:number, derived_citation:(string|null), resolved_section_id:(string|null)}|null),
 *   occurrence_count: number, candidate_citations: (string[]|undefined)}|null}
 */
function resolveQuoteOccurrence({
  tree, document_text: documentText, quote, model_citation: modelCitation = null,
}) {
  if (typeof documentText !== 'string' || documentText.length === 0) return null;
  if (typeof quote !== 'string' || quote.trim().length === 0) return null;

  const occurrences = findAllQuoteOccurrences(documentText, quote);
  if (occurrences.length === 0) return null;

  const candidates = occurrences.map((occ) => {
    const byteStart = Buffer.byteLength(documentText.slice(0, occ.start), 'utf8');
    const byteEnd = byteStart + Buffer.byteLength(documentText.slice(occ.start, occ.end), 'utf8');
    const node = deriveCitationForSpan(tree, byteStart, byteEnd);
    return {
      char_start: occ.start,
      char_end: occ.end,
      byte_start: byteStart,
      byte_end: byteEnd,
      derived_citation: node ? node.reference : null,
      resolved_section_id: node ? node.section_id : null,
    };
  });

  const normalizedModel = typeof modelCitation === 'string' && modelCitation.trim().length > 0
    ? citationFromComponents(parseCitationComponents(modelCitation))
    : null;

  if (occurrences.length === 1) {
    const only = candidates[0];
    if (normalizedModel !== null && only.derived_citation === normalizedModel) {
      return {
        resolved: true, ambiguous: false, occurrence: only, occurrence_count: 1,
      };
    }
    return {
      resolved: false, ambiguous: false, occurrence: null, occurrence_count: 1,
    };
  }

  const matches = normalizedModel === null ? [] : candidates.filter((c) => c.derived_citation === normalizedModel);
  if (matches.length === 1) {
    return {
      resolved: true, ambiguous: false, occurrence: matches[0], occurrence_count: occurrences.length,
    };
  }
  return {
    resolved: false,
    ambiguous: true,
    occurrence: null,
    occurrence_count: occurrences.length,
    candidate_citations: Array.from(new Set(candidates.map((c) => c.derived_citation))),
  };
}

/**
 * Cross-checks a model-emitted citation against the sectionizer's discovered
 * tree, and -- when the tree alone cannot construct it -- against the
 * document's own corroborating cross-reference prose (see this file's
 * header, "CORROBORATION: A SECOND, WEAKER SOURCE"). Never throws; returns
 * null when there is nothing to check (no citation supplied).
 *
 * Every returned result carries `accepted` (whether this citation should be
 * treated as validated at all) and `validation_source` (which of the two
 * independent sources validated it, or null when neither did):
 *   - AGREEMENT                  -> accepted: true,  validation_source: 'CONSTRUCTED_FROM_TREE'
 *     (the model's citation resolves to the SAME node this module derived,
 *     OR to a real ANCESTOR of it -- `isDescendantOf`, above. A model
 *     routinely cites one section_reference for a whole governing paragraph
 *     (a representation_instance/bring_down_condition's OWN reference) while
 *     its individual limb/qualifier evidence quotes sit inside that
 *     paragraph's own lettered sub-markers; per-proposal derivation then
 *     finds the more specific descendant node for THAT evidence, not the
 *     paragraph itself. Citing the correct governing ancestor is TRUE, not
 *     merely close -- only a citation resolving to a node OUTSIDE the
 *     derived node's own ancestor chain (a sibling, an unrelated branch) is
 *     disagreement; a citation resolving to a node inside the derived node's
 *     own DESCENDANTS -- i.e. claiming MORE precision than the evidence
 *     itself narrows to -- is still disagreement, the asymmetry is
 *     deliberate.)
 *   - CITATION_NOT_CONSTRUCTIBLE,
 *     corroborated by document text -> accepted: true,  validation_source: 'CORROBORATED_BY_DOCUMENT_TEXT'
 *   - CITATION_NOT_CONSTRUCTIBLE,
 *     not corroborated either    -> accepted: false, validation_source: null
 *   - CITATION_DISAGREEMENT      -> accepted: false, validation_source: null
 *     (the citation IS real, just not the derived node or one of its real
 *     ancestors -- a genuine disagreement worth surfacing, not something
 *     corroboration papers over)
 *
 * `accepted: false` is never a silent drop by itself -- see native-
 * extraction-run.js, which compiles the proposal regardless and carries this
 * whole result forward as `citation_validation` for the caller to route.
 *
 * @param {object} args
 * @param {object|Array} args.tree          the sectionizer tree (or `.nodes`)
 * @param {string} args.model_citation      the model's raw section_reference string
 * @param {object|null} [args.derived_node] the node this module (or its caller)
 *                                          independently derived for the evidence
 *                                          in question -- typically the governing
 *                                          section's own resolved node
 * @param {string|null} [args.document_text] the full admitted document text to
 *                                          search for corroboration when tree
 *                                          construction fails, and for quote-
 *                                          occurrence resolution (below);
 *                                          omit/null to skip both
 * @param {string|null} [args.quote]        the proposal's own raw evidence
 *                                          quote text -- when supplied (with
 *                                          `document_text`), a would-be
 *                                          CITATION_DISAGREEMENT is re-checked
 *                                          via `resolveQuoteOccurrence` before
 *                                          being returned (see this file's
 *                                          header, "QUOTE-OCCURRENCE
 *                                          RESOLUTION"); omit to skip entirely
 * @returns {{status: string, accepted: boolean, validation_source: (string|null),
 *   model_citation: string, normalized_citation: string,
 *   derived_citation: (string|null), resolved_section_id: (string|null),
 *   derived_section_id: (string|null), occurrence_count: (number|undefined),
 *   candidate_citations: (string[]|undefined)}|null}
 */
function checkCitationConstructibility({
  tree, model_citation: modelCitation, derived_node: derivedNode = null, document_text: documentText = null,
  quote = null,
}) {
  if (typeof modelCitation !== 'string' || modelCitation.trim().length === 0) return null;

  const nodes = Array.isArray(tree) ? tree : (tree && tree.nodes) || [];
  const normalized = citationFromComponents(parseCitationComponents(modelCitation));
  const derivedCitation = derivedNode ? derivedNode.reference : null;
  const derivedSectionId = derivedNode ? derivedNode.section_id : null;

  const resolvedNode = nodes.find((node) => node.reference != null && node.reference === normalized) || null;

  if (!resolvedNode) {
    const corroborated = checkCitationCorroboration({ document_text: documentText, model_citation: modelCitation });
    return {
      status: 'CITATION_NOT_CONSTRUCTIBLE',
      accepted: corroborated,
      validation_source: corroborated ? 'CORROBORATED_BY_DOCUMENT_TEXT' : null,
      model_citation: modelCitation,
      normalized_citation: normalized,
      derived_citation: derivedCitation,
      resolved_section_id: null,
      derived_section_id: derivedSectionId,
    };
  }

  const isExactMatch = derivedNode && resolvedNode.section_id === derivedNode.section_id;
  const isGoverningAncestor = derivedNode && !isExactMatch
    && isDescendantOf(nodes, derivedNode, resolvedNode.section_id);
  if (isExactMatch || isGoverningAncestor) {
    return {
      status: 'AGREEMENT',
      accepted: true,
      validation_source: 'CONSTRUCTED_FROM_TREE',
      model_citation: modelCitation,
      normalized_citation: normalized,
      derived_citation: derivedCitation,
      resolved_section_id: resolvedNode.section_id,
      derived_section_id: derivedSectionId,
    };
  }

  // Before accepting a plain CITATION_DISAGREEMENT: the model's citation
  // DOES resolve to a real node, it just does not match whatever span
  // `derivedNode` was built from -- possibly because that span itself came
  // from a global-first-match on a repeated quote, not the evidence's own
  // occurrence (see this file's header, "QUOTE-OCCURRENCE RESOLUTION").
  // Only attempted when the caller supplies the proposal's own quote text.
  if (typeof quote === 'string' && quote.trim().length > 0 && typeof documentText === 'string') {
    const occurrenceResolution = resolveQuoteOccurrence({
      tree, document_text: documentText, quote, model_citation: modelCitation,
    });
    if (occurrenceResolution && occurrenceResolution.resolved && !occurrenceResolution.ambiguous) {
      return {
        status: 'AGREEMENT',
        accepted: true,
        validation_source: 'CONSTRUCTED_FROM_TREE_QUOTE_POSITION',
        model_citation: modelCitation,
        normalized_citation: normalized,
        derived_citation: occurrenceResolution.occurrence.derived_citation,
        resolved_section_id: resolvedNode.section_id,
        derived_section_id: occurrenceResolution.occurrence.resolved_section_id,
      };
    }
    if (occurrenceResolution && occurrenceResolution.ambiguous) {
      return {
        status: 'AMBIGUOUS_CITATION_OCCURRENCE',
        accepted: false,
        validation_source: null,
        model_citation: modelCitation,
        normalized_citation: normalized,
        derived_citation: derivedCitation,
        resolved_section_id: resolvedNode.section_id,
        derived_section_id: derivedSectionId,
        occurrence_count: occurrenceResolution.occurrence_count,
        candidate_citations: occurrenceResolution.candidate_citations,
      };
    }
  }

  return {
    status: 'CITATION_DISAGREEMENT',
    accepted: false,
    validation_source: null,
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
  checkCitationCorroboration,
  resolveQuoteOccurrence,
  checkCitationConstructibility,
};
