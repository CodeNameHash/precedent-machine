/* ─────────────────────────────────────────────────────────────────────────
   lib/parser-v2/span-claims.js — span claims on extraction output.

   Span accounting spec (docs/archive/handoffs/SPAN-ACCOUNTING-SPEC-2026-07-18.md),
   Part 2. For an emitted provision/feature-item, derive (never model-assert)
   which of the section's Part 1 sub-clause leaves its text actually covers:

     computeSpanClaims(sectionText, items) →
       items.map(item => ({ ...item, claimedSpans, spanUnlocated, textSpan }))

   `claimedSpans` is `[{ start, end, marker, depth }]` — the Part 1 LEAF
   spans (see subclauses.js) that the item's located text overlaps, in
   SECTION-RELATIVE offsets. `textSpan` is `{ start, end }` for the item's
   OWN text in those same coordinates — where the quotation actually came
   from, as opposed to which leaves it touches. An item whose text cannot be
   located anywhere in the section at all gets `spanUnlocated: true`,
   `claimedSpans: []` and `textSpan: null` — this is the hallucination
   surface (same idea as quote verification: an emitted item whose evidence
   isn't actually IN the source is suspect).

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
 *
 * Two different things come back, and conflating them is the trap:
 *   - `textSpan`  — `{ start, end }`, WHERE THIS ITEM'S OWN TEXT SITS, in
 *     section-relative offsets. `sectionText.slice(start, end)` is the
 *     item's text as it actually appears in the source (modulo whitespace
 *     re-wrapping, and truncated to the head when only the head matched).
 *     This is the offset a downstream verifier needs to catch a quote that
 *     arrived pre-trimmed in a way that reverses its meaning: it can
 *     compare the stored span against the source instead of re-searching
 *     for the text it was handed.
 *   - `claimedSpans` — the Part 1 sub-clause LEAVES that span overlaps.
 *     Coverage accounting (span-residual.js), NOT a quote location: a leaf
 *     is routinely much wider than the quote inside it.
 * `textSpan` is null exactly when the item's text could not be located in
 * the section at all. `spanUnlocated` is the WIDER flag — it is also true
 * for an item that WAS located but whose span covers no Part 1 leaf (a
 * section with no sub-clause structure), which is why the two must not be
 * used interchangeably.
 */
function computeSpanClaims(sectionText, items) {
  const text = String(sectionText || '');
  const leaves = segmentSubClauses(text);
  const list = Array.isArray(items) ? items : [];

  return list.map((item) => {
    const itemText = item && (item.text || item.quote || item.full_text);
    const located = locateInSection(text, itemText);
    if (!located) {
      return { ...item, claimedSpans: [], spanUnlocated: true, textSpan: null };
    }
    const claimedSpans = coveringLeaves(leaves, located.start, located.end);
    return {
      ...item,
      claimedSpans,
      spanUnlocated: claimedSpans.length === 0,
      textSpan: { start: located.start, end: located.end },
    };
  });
}

/**
 * Strategy-A/C wiring point (span accounting spec §"Sequencing &
 * delegation": Part 2 is "wired for strategy A and C outputs"). INERT by
 * default — only runs when `opts.spanClaims === true` is passed explicitly,
 * so calling this from extract.js does not change ingest behavior unless a
 * caller opts in. Attaches
 * `spanClaims: { claimedSpans, spanUnlocated, textSpan, sectionStartChar }`
 * onto each provision's `features` bag (does not touch top-level provision
 * fields extract.js/validate.js already rely on).
 *
 * `sectionTextByStartChar` maps a section's startChar -> its full text, so
 * provisions that were sub-clause-split (Strategy A) can still be located
 * against their PARENT section's text (segmentSubClauses needs the whole
 * section, not the already-split sub-clause).
 *
 * COORDINATE SPACE — the whole payload is SECTION-RELATIVE, and this repo
 * already carries three different span coordinate spaces that a careless
 * consumer will mix up:
 *   1. these offsets — relative to the classified section's own text;
 *   2. provision_cards.primary_quote_start/end — relative to that card's
 *      `region_full_text` excerpt, with a {0, quote.length} fallback when
 *      even that lookup fails (store-cards.js quoteSpan), which is why
 *      resolve-source-span.js treats them as an optimistic guess only;
 *   3. resolve-source-span.js's output — relative to the MARKER-STRIPPED
 *      deal full_text that SourceOverlay renders.
 * Nothing here writes (2). `sectionStartChar` is carried in the payload
 * precisely so a consumer can lift (1) into full-cleaned-text coordinates
 * itself (add sectionStartChar) rather than assuming a space.
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
      const { claimedSpans, spanUnlocated, textSpan } = claimed[i];
      prov.features = {
        ...(prov.features || {}),
        spanClaims: {
          claimedSpans,
          spanUnlocated,
          textSpan,
          sectionStartChar: Number.isFinite(key) ? key : null,
        },
      };
    });
  }

  return provisions;
}

module.exports = {
  computeSpanClaims,
  attachSpanClaimsToProvisions,
  locateInSection,
};
