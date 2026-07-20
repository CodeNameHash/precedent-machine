// r17b (Ben): QXO's proration See-provision expansion showed a CUT-OFF
// quote — the stored prorationMechanics.oversubscriptionTreatment excerpt
// contains a literal mid-string " ... " where the extractor elided the
// middle, and what's elided is exactly the operative payment formulas
// ("(1) cash × Cash Proration Fraction (2) Parent Shares × (one minus the
// Cash Proration Fraction)"). The formulas ARE the substance; the See
// expansion must show the COMPLETE clause.
//
// unelideQuote(quote, fullText) reconstructs the complete span from the
// provision's full_text when — and only when — both edges of the elided
// quote anchor there verbatim (whitespace-insensitively). It NEVER guesses
// or stitches: any anchor miss, out-of-order match, or implausibly long
// span returns null and the caller keeps the original quote.
//
// How the anchoring works:
//  - a quote qualifies only when it carries a MID-string elision ("...",
//    ". . .", or "…") with real text on both sides; leading/trailing
//    ellipses alone do not qualify (nothing elided in the middle);
//  - head anchor = the first ~80 normalized chars of the segment BEFORE the
//    first elision; tail anchor = the last ~80 normalized chars of the
//    segment AFTER the last elision (multi-elision quotes resolve as ONE
//    span: first head, last tail);
//  - fullText is whitespace-normalized with an index map back into the
//    original string; the head anchor must match first, then the tail
//    anchor must match AT/AFTER the head match (in order);
//  - on success the return value is the ORIGINAL fullText slice from
//    head-start to tail-end — the provision's own whitespace/formatting
//    (paragraph breaks around "(1)…(2)…" formula lists) is preserved.

// Literal elision the extractor writes mid-quote. Requires surrounding
// whitespace or string edge so a legitimate "etc...." sentence never
// splits words apart (the split segments would then fail to anchor anyway).
const ELISION_SPLIT_RE = /\s*(?:\.\s?\.\s?\.+|…)\s*/;

const DEFAULT_ANCHOR_CHARS = 80;
// An anchor this short matches too promiscuously to trust.
const MIN_ANCHOR_CHARS = 20;
const DEFAULT_MAX_SPAN_CHARS = 8000;

function foldChar(ch) {
  const code = ch.charCodeAt(0);
  if (code === 0x2018 || code === 0x2019) return "'";
  if (code === 0x201c || code === 0x201d) return '"';
  if (code === 0x00a0) return ' ';
  return ch;
}

// Collapse whitespace runs to single spaces, folding curly quotes / nbsp,
// and keep a map from each normalized index back to the source index so a
// normalized match can be sliced out of the ORIGINAL text.
function normalizeWithMap(text) {
  const chars = [];
  const map = [];
  let pendingSpace = false;
  for (let i = 0; i < text.length; i += 1) {
    const ch = foldChar(text[i]);
    if (/\s/.test(ch)) {
      pendingSpace = chars.length > 0;
      continue;
    }
    if (pendingSpace) {
      chars.push(' ');
      map.push(i); // the space "sits" just before this source char
      pendingSpace = false;
    }
    chars.push(ch);
    map.push(i);
  }
  return { norm: chars.join(''), map };
}

function normalizeFlat(text) {
  return normalizeWithMap(String(text)).norm;
}

// True when `quote` contains at least one mid-string elision (text on both
// sides). Exported so callers can cheaply pre-filter before fetching
// full_text.
function hasMidElision(quote) {
  if (typeof quote !== 'string' || !quote) return false;
  const parts = quote.split(ELISION_SPLIT_RE).map((p) => p.trim()).filter(Boolean);
  return parts.length >= 2;
}

function unelideQuote(quote, fullText, options = {}) {
  if (typeof quote !== 'string' || typeof fullText !== 'string') return null;
  if (!quote.trim() || !fullText.trim()) return null;

  const anchorChars = options.anchorChars || DEFAULT_ANCHOR_CHARS;
  const maxSpanChars = options.maxSpanChars || DEFAULT_MAX_SPAN_CHARS;

  // Segments between elisions; drop empties so leading/trailing ellipses
  // don't produce phantom segments. <2 segments => no MID elision => null
  // (caller keeps the original quote untouched).
  const segments = quote.split(ELISION_SPLIT_RE).map((p) => p.trim()).filter(Boolean);
  if (segments.length < 2) return null;

  const headNorm = normalizeFlat(segments[0]);
  const tailNorm = normalizeFlat(segments[segments.length - 1]);
  const headAnchor = headNorm.slice(0, anchorChars);
  const tailAnchor = tailNorm.slice(-anchorChars);
  if (headAnchor.length < MIN_ANCHOR_CHARS || tailAnchor.length < MIN_ANCHOR_CHARS) return null;

  const { norm, map } = normalizeWithMap(fullText);

  // Head anchors the START of the span: first occurrence in the full text.
  const headAt = norm.indexOf(headAnchor);
  if (headAt === -1) return null;

  // Tail must resolve IN ORDER — at/after the head match. Searching from
  // the end of the head anchor also lets head and tail legitimately touch.
  const tailAt = norm.indexOf(tailAnchor, headAt + headAnchor.length);
  if (tailAt === -1) return null;

  const startSource = map[headAt];
  const endSource = map[tailAt + tailAnchor.length - 1] + 1;
  if (!(endSource > startSource)) return null;
  if (endSource - startSource > maxSpanChars) return null;

  return fullText.slice(startSource, endSource);
}

module.exports = { hasMidElision, unelideQuote };
