/**
 * resolve-source-span.js — WP-5 (M5-03): given a provision card and the
 * deal's raw `full_text` (marker-laden, from deals.metadata.full_text /
 * /api/agreement-source), work out where the card's quote sits in the
 * marker-STRIPPED text SourceOverlay renders, so it can <mark> the right
 * span.
 *
 * Why marker-stripped coordinates, not raw full_text coordinates: full_text
 * is dense with inline [[REF]]/[[DEFINED]] tags, and a clause-length quote
 * routinely has several of them inside its own span. A highlight expressed
 * as [rawStart, rawEnd) into the UNSTRIPPED string would include that tag
 * text, so full_text.slice(rawStart, rawEnd) would NOT equal
 * card.primary_quote verbatim — it would run long by the width of every
 * marker tag inside the span. Since the overlay's single pane renders the
 * stripped text (spec option (a) — do not reuse parseFormattedDocument's
 * block parse), the span that actually gets wrapped in <mark> must be
 * expressed in THAT text's coordinates. This module strips full_text once,
 * keeps a bidirectional offset map to the original raw string (for the
 * explicit-offset path below, and for any future raw-offset consumer), and
 * resolves + returns spans in stripped-text coordinates — which is exactly
 * what verbatim-equals-primary_quote means when "highlighted text" is what
 * a person actually sees on screen.
 *
 * Why this doesn't just trust card.primary_quote_start/end: store-cards.js's
 * quoteSpan() computes those offsets relative to the card's own
 * `region_full_text` excerpt (falling back to {0, quote.length} when even
 * that indexOf fails) — NOT as absolute offsets into the deal's full_text,
 * despite the M4-M5 reconciled plan's description. Verified against live
 * data (see the WP-5 gate report): raw offsets essentially never address
 * the right span. So this module treats the stored offsets as an
 * optimistic first guess, validates them against the RAW text (they claim
 * to be raw offsets), and falls through a defensive chain — never
 * rendering a highlight it can't prove is right.
 *
 * A card's `provenance.primary_quote_span_verified` (store-cards.js
 * buildProvenance, docs/codex-program/ROADMAP.md P5) records, at WRITE time,
 * whether quoteSpan() actually located the quote in region_full_text or fell
 * back to the {0, quote.length} placeholder — a cheap short-circuit a caller
 * MAY consult before even trying step 1 below (verified:false means step 1
 * cannot succeed, since the raw slice check restates the same fact this
 * module discovers independently either way). It is informational only:
 * this module's own step-1 validation is unconditional and does not read it,
 * so its behavior is unchanged by whether that flag is present.
 *
 * Resolution order (first hit wins):
 *   1. Explicit offsets, IF they validate: full_text.slice(quoteStart,
 *      quoteEnd) === primary_quote exactly (implies no markers fall inside
 *      the span, so mapping to stripped coordinates is lossless). Rare
 *      today; kept for when upstream offsets get fixed — see
 *      docs/archive/handoffs/SPAN-ACCOUNTING-SPEC-2026-07-18.md.
 *   2. Exact-string find of primary_quote against the marker-stripped text
 *      — literal first, then whitespace-normalized (source paragraphs wrap
 *      differently than the extracted quote; still the same content, never
 *      a truncated/fuzzy signature match).
 *   3. Same two passes against region_full_text (the wider clause region).
 *   4. Unresolved — overlay opens unscrolled with a "span unresolved"
 *      notice; caller should log + count these (never a silently wrong
 *      highlight).
 */

// Marker tag pattern shared with format-renderer's stripper (kept in sync
// manually — format-renderer doesn't export its regex).
const MARKER_TAG_RE = /\[\[\/?[A-Za-z0-9_ -]+\]\]/g;

/**
 * Strip [[...]] marker tags from `rawText`, returning:
 *  - strippedText: the text with every "[[...]]" tag removed (content
 *    between tags is kept verbatim).
 *  - strippedToRaw: strippedToRaw[i] is the raw-text index of
 *    strippedText[i]; strippedToRaw[strippedText.length] === rawText.length
 *    (sentinel).
 *  - rawToStripped: rawToStripped[i] is the stripped-text index of
 *    rawText[i], or -1 if rawText[i] fell inside a stripped marker tag.
 */
function stripWithOffsetMap(rawText) {
  const text = String(rawText || '');
  let strippedText = '';
  const strippedToRaw = [];
  const rawToStripped = new Array(text.length + 1).fill(-1);
  let last = 0;
  MARKER_TAG_RE.lastIndex = 0;
  let m;
  const copyChunk = (from, to) => {
    for (let i = from; i < to; i++) {
      rawToStripped[i] = strippedText.length + (i - from);
      strippedToRaw.push(i);
    }
    strippedText += text.slice(from, to);
  };
  while ((m = MARKER_TAG_RE.exec(text)) !== null) {
    if (m.index > last) copyChunk(last, m.index);
    last = m.index + m[0].length;
  }
  if (last < text.length) copyChunk(last, text.length);
  strippedToRaw.push(text.length); // sentinel
  rawToStripped[text.length] = strippedText.length; // end-of-string sentinel
  return { strippedText, strippedToRaw, rawToStripped };
}

function normalizeWhitespace(s) {
  return String(s || '').replace(/\s+/g, ' ').trim();
}

// Whitespace-normalized indexOf that still returns an offset into the
// UN-normalized haystack. Returns [start, end] (exclusive) or null. Only
// collapses runs of whitespace to a single space — never truncates or
// substitutes content, so a hit is still the same text, just re-wrapped.
function findNormalized(haystack, needle) {
  const normNeedle = normalizeWhitespace(needle);
  if (!normNeedle) return null;

  const normMap = []; // normHaystack index -> haystack index
  let normHaystack = '';
  let prevWasSpace = false;
  for (let i = 0; i < haystack.length; i++) {
    const ch = haystack[i];
    if (/\s/.test(ch)) {
      if (!prevWasSpace) {
        normHaystack += ' ';
        normMap.push(i);
        prevWasSpace = true;
      }
    } else {
      normHaystack += ch;
      normMap.push(i);
      prevWasSpace = false;
    }
  }
  normMap.push(haystack.length);

  const idx = normHaystack.indexOf(normNeedle);
  if (idx < 0) return null;
  const start = normMap[idx];
  const endNormIdx = idx + normNeedle.length;
  const end = normMap[Math.min(endNormIdx, normMap.length - 1)];
  if (!Number.isFinite(start) || !Number.isFinite(end) || end <= start) return null;
  return [start, end];
}

// Find `needle` verbatim in `strippedText`; try literal first, then
// whitespace-normalized. Returns { start, end, exact } in strippedText
// coordinates, or null.
function findInStripped(strippedText, needle) {
  const target = String(needle || '').trim();
  if (!target) return null;
  const literalIdx = strippedText.indexOf(target);
  if (literalIdx >= 0) {
    return { start: literalIdx, end: literalIdx + target.length, exact: true };
  }
  const normHit = findNormalized(strippedText, target);
  if (normHit) {
    return { start: normHit[0], end: normHit[1], exact: false };
  }
  return null;
}

/**
 * @param {object} args
 * @param {string} args.fullText — deal.metadata.full_text (marker-laden)
 * @param {number} [args.quoteStart] — card.primary_quote_start
 * @param {number} [args.quoteEnd] — card.primary_quote_end
 * @param {string} [args.primaryQuote] — card.primary_quote
 * @param {string} [args.regionFullText] — card.region_full_text
 * @returns {{
 *   strippedText: string,
 *   status: 'offset' | 'exact-quote' | 'exact-region' | 'unresolved',
 *   start: number|null, end: number|null,   // stripped-text coordinates —
 *                                            // what SourceOverlay renders/marks
 *   verbatim: boolean,                      // literal match, not whitespace-normalized
 *   matchedText: string|null,               // strippedText.slice(start, end)
 * }}
 */
function resolveSourceSpan({ fullText, quoteStart, quoteEnd, primaryQuote, regionFullText }) {
  const text = String(fullText || '');
  const { strippedText, rawToStripped } = stripWithOffsetMap(text);

  if (!text) {
    return { strippedText, status: 'unresolved', start: null, end: null, verbatim: false, matchedText: null };
  }

  // 1. Explicit offsets, validated directly against the RAW full_text (the
  //    plan's stated contract). If they check out, no marker can fall
  //    inside the span (else the raw slice couldn't equal the
  //    marker-free primary_quote), so the raw->stripped mapping is exact.
  if (
    Number.isInteger(quoteStart) &&
    Number.isInteger(quoteEnd) &&
    quoteStart >= 0 &&
    quoteEnd > quoteStart &&
    quoteEnd <= text.length &&
    primaryQuote
  ) {
    const rawSlice = text.slice(quoteStart, quoteEnd);
    if (rawSlice === primaryQuote) {
      const start = rawToStripped[quoteStart];
      const end = rawToStripped[quoteEnd];
      if (start >= 0 && end >= 0 && end > start) {
        return {
          strippedText,
          status: 'offset',
          start,
          end,
          verbatim: true,
          matchedText: strippedText.slice(start, end),
        };
      }
    }
  }

  // 2. Exact-string find of primary_quote against stripped text.
  if (primaryQuote) {
    const hit = findInStripped(strippedText, primaryQuote);
    if (hit) {
      return {
        strippedText,
        status: 'exact-quote',
        start: hit.start,
        end: hit.end,
        verbatim: hit.exact,
        matchedText: strippedText.slice(hit.start, hit.end),
      };
    }
  }

  // 3. Fall back to region_full_text (wider clause context).
  if (regionFullText) {
    const hit = findInStripped(strippedText, regionFullText);
    if (hit) {
      return {
        strippedText,
        status: 'exact-region',
        start: hit.start,
        end: hit.end,
        verbatim: hit.exact,
        matchedText: strippedText.slice(hit.start, hit.end),
      };
    }
  }

  // 4. Nothing matched — never guess.
  return { strippedText, status: 'unresolved', start: null, end: null, verbatim: false, matchedText: null };
}

/**
 * Convenience wrapper: pulls the relevant fields off a provision card
 * (primary_quote_start/end, primary_quote, region_full_text) and resolves
 * its span. Callers that hold a card (ClauseSidebar's "View in agreement",
 * ProvisionIndex rows, the ?card= deep-link) use this to compute the
 * `{start, end}` they then pass into SourceOverlay — SourceOverlay itself
 * never sees the card (see its header comment / the WP-5 seam).
 */
function resolveCardSourceSpan(card, fullText) {
  if (!card) return resolveSourceSpan({ fullText, primaryQuote: null, regionFullText: null });
  return resolveSourceSpan({
    fullText,
    quoteStart: card.primary_quote_start,
    quoteEnd: card.primary_quote_end,
    primaryQuote: card.primary_quote,
    regionFullText: card.region_full_text,
  });
}

module.exports = {
  resolveSourceSpan,
  resolveCardSourceSpan,
  stripWithOffsetMap,
  findInStripped,
  normalizeWhitespace,
};
