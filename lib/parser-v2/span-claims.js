/* ─────────────────────────────────────────────────────────────────────────
   lib/parser-v2/span-claims.js — span claims on extraction output.

   Span accounting spec (docs/handoffs/SPAN-ACCOUNTING-SPEC-2026-07-18.md),
   Part 2. For an emitted provision/feature-item, derive (never model-assert)
   which of the section's Part 1 sub-clause leaves its text actually covers:

     computeSpanClaims(sectionText, items) →
       items.map(item => ({ ...item, claimedSpans, spanUnlocated }))

   `claimedSpans` is `[{ start, end, marker, depth }]` — the Part 1 LEAF
   spans (see subclauses.js) that the item's located text overlaps, in
   SECTION-RELATIVE offsets. An item whose text cannot be located anywhere
   in the section at all gets `spanUnlocated: true` and `claimedSpans: []` —
   this is the hallucination surface (same idea as quote verification: an
   emitted item whose evidence isn't actually IN the source is suspect).

   Deterministic, no LLM, no prompt changes — this runs strictly AFTER
   extraction, against text the model already produced.

   Locating an item's text inside sectionText is harder than a straight
   `indexOf`: models normalize whitespace, occasionally close up a hyphen-
   wrapped word, and sometimes emit only a fragment of a longer clause. Three
   passes, cheapest first:
     1. Exact substring (`indexOf`) — the common case.
     2. A whitespace-tolerant regex built from the item text (handles re-
        wrapped whitespace without needing a normalized-offset mapping back
        to the raw section, which loose-normalization would require).
     3. Same regex, but against only the item text's head (first ~160 chars)
        — recovers a truncated/elided model quote the way
        lib/verification.js's locateProvisionInSource does for full
        provisions.
   ───────────────────────────────────────────────────────────────────────── */

const { segmentSubClauses } = require('./subclauses');

const MIN_ITEM_CHARS = 12; // mirrors lib/verification.js's MIN_QUOTE_CHARS
const HEAD_CHARS = 160;

function escapeRegExp(s) {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

// Build a regex that tolerates whitespace-run differences (a run of
// whitespace in the needle matches any run of whitespace in the haystack)
// without touching non-whitespace chars — deliberately narrower than
// normalizeForMatch so located offsets stay valid against the RAW section
// text (no normalized <-> raw offset mapping needed).
function fuzzyPattern(needle) {
  const parts = needle.split(/\s+/).filter(Boolean).map(escapeRegExp);
  if (!parts.length) return null;
  return new RegExp(parts.join('\\s+'));
}

function locateInSection(sectionText, itemText) {
  const text = String(itemText || '').trim();
  if (text.length < MIN_ITEM_CHARS) return null;

  const exact = sectionText.indexOf(text);
  if (exact >= 0) return { start: exact, end: exact + text.length };

  const fullPattern = fuzzyPattern(text);
  if (fullPattern) {
    const m = fullPattern.exec(sectionText);
    if (m) return { start: m.index, end: m.index + m[0].length };
  }

  if (text.length > HEAD_CHARS) {
    const head = text.slice(0, HEAD_CHARS);
    const headPattern = fuzzyPattern(head);
    if (headPattern) {
      const m = headPattern.exec(sectionText);
      if (m) return { start: m.index, end: m.index + m[0].length };
    }
  }

  return null;
}

// Leaves overlapping [start, end) — an item can straddle more than one leaf
// (e.g. a bring-down feature quoting across a marker boundary).
function coveringLeaves(leaves, start, end) {
  return leaves
    .filter((leaf) => leaf.start < end && leaf.end > start)
    .map((leaf) => ({ start: leaf.start, end: leaf.end, marker: leaf.marker, depth: leaf.depth }));
}

/**
 * computeSpanClaims(sectionText, items) — items: [{ text, ...anything }].
 * `text` is whatever verbatim quote/text represents the item's evidence
 * (a feature's citable quote, a provision's full_text, etc — callers pick
 * the field). Returns a NEW array; does not mutate `items`.
 */
function computeSpanClaims(sectionText, items) {
  const text = String(sectionText || '');
  const leaves = segmentSubClauses(text);
  const list = Array.isArray(items) ? items : [];

  return list.map((item) => {
    const itemText = item && (item.text || item.quote || item.full_text);
    const located = locateInSection(text, itemText);
    if (!located) {
      return { ...item, claimedSpans: [], spanUnlocated: true };
    }
    const claimedSpans = coveringLeaves(leaves, located.start, located.end);
    return {
      ...item,
      claimedSpans,
      spanUnlocated: claimedSpans.length === 0,
    };
  });
}

/**
 * Strategy-A/C wiring point (span accounting spec §"Sequencing &
 * delegation": Part 2 is "wired for strategy A and C outputs"). INERT by
 * default — only runs when `opts.spanClaims === true` is passed explicitly,
 * so calling this from extract.js does not change ingest behavior unless a
 * caller opts in. Attaches `spanClaims: { claimedSpans, spanUnlocated }`
 * onto each provision's `features` bag (does not touch top-level provision
 * fields extract.js/validate.js already rely on).
 *
 * `sectionTextByStartChar` maps a section's startChar -> its full text, so
 * provisions that were sub-clause-split (Strategy A) can still be located
 * against their PARENT section's text (segmentSubClauses needs the whole
 * section, not the already-split sub-clause).
 */
function attachSpanClaimsToProvisions(provisions, sectionTextByStartChar, opts = {}) {
  if (!opts || opts.spanClaims !== true) return provisions; // inert by default
  if (!Array.isArray(provisions) || !(sectionTextByStartChar instanceof Map)) return provisions;

  // Group provisions by the section they came from so segmentSubClauses runs
  // once per section, not once per provision.
  const bySection = new Map();
  for (const prov of provisions) {
    const key = (prov && (prov.sectionStartChar ?? prov.parentStartChar ?? prov.startChar)) ?? null;
    if (key === null || !sectionTextByStartChar.has(key)) continue;
    if (!bySection.has(key)) bySection.set(key, []);
    bySection.get(key).push(prov);
  }

  for (const [key, provs] of bySection.entries()) {
    const sectionText = sectionTextByStartChar.get(key);
    const claimed = computeSpanClaims(sectionText, provs.map((p) => ({ text: p.text || p.full_text })));
    provs.forEach((prov, i) => {
      const { claimedSpans, spanUnlocated } = claimed[i];
      prov.features = { ...(prov.features || {}), spanClaims: { claimedSpans, spanUnlocated } };
    });
  }

  return provisions;
}

module.exports = {
  computeSpanClaims,
  attachSpanClaimsToProvisions,
  locateInSection,
};
