/* ─────────────────────────────────────────────────────────────────────────
   lib/doc-match.js — locate a provision's verbatim text inside the raw
   agreement source, and carve out a bounded "window" around it.

   FB3 (in-place document pop-under, Surface 2) needs to render a ~300-500k
   char agreement without mounting the whole string in one DOM node. This
   module is the offset-finding half of that: given the (marker-stripped)
   plain document text and a quote/needle, find where it starts/ends, then
   hand back a small slice (+/- N chars, expandable) instead of the full
   document.

   The matching cascade mirrors components/review/FullDocumentView.js's
   per-provision matcher (exact ci -> whitespace-normalized -> first-200-char
   signature -> first-60-char signature -> "SECTION X.XX" header) so a quote
   that highlights correctly in the full-page Document tab also resolves here.
   It is intentionally NOT imported from FullDocumentView (that file is
   mid-refactor by other work) — kept as a small, pure, independently testable
   sibling instead of a shared import, deliberately duplicating the algorithm
   shape rather than the DOM-walking mechanics (this module never touches
   the DOM; FullDocumentView's TreeWalker highlight is a separate concern).
   ───────────────────────────────────────────────────────────────────────── */

/** Collapse all whitespace runs to a single space and lowercase. */
function normalize(s) {
  return String(s || '').replace(/\s+/g, ' ').trim().toLowerCase();
}

/**
 * Find `needle` inside `plainText`, trying progressively looser strategies.
 * Returns { start, end, strategy } (offsets into plainText) or null.
 */
export function locateQuoteInText(plainText, needle) {
  if (typeof plainText !== 'string' || !plainText) return null;
  const target = String(needle || '').trim();
  if (!target) return null;

  const lowerSource = plainText.toLowerCase();

  // 1. Exact case-insensitive.
  const exactIdx = lowerSource.indexOf(target.toLowerCase());
  if (exactIdx >= 0) {
    return { start: exactIdx, end: exactIdx + target.length, strategy: 'exact' };
  }

  // Build a normalized source + offset map once, used by strategies 2-4.
  const normMap = [];
  let normalizedSource = '';
  {
    let prevSpace = false;
    for (let i = 0; i < plainText.length; i++) {
      const ch = plainText[i];
      if (/\s/.test(ch)) {
        if (!prevSpace) { normalizedSource += ' '; normMap.push(i); prevSpace = true; }
      } else {
        normalizedSource += ch.toLowerCase();
        normMap.push(i);
        prevSpace = false;
      }
    }
    normMap.push(plainText.length);
  }
  const findNormalized = (needleStr) => {
    const n = normalize(needleStr);
    if (!n) return null;
    const idx = normalizedSource.indexOf(n);
    if (idx < 0) return null;
    const start = normMap[idx];
    const end = normMap[Math.min(idx + n.length, normMap.length - 1)];
    if (!Number.isFinite(start) || !Number.isFinite(end) || end <= start) return null;
    return [start, end];
  };

  // 2. Whitespace-normalized full text.
  const normHit = findNormalized(target);
  if (normHit) return { start: normHit[0], end: normHit[1], strategy: 'normalized' };

  // 3. First 200-char signature (covers to the full needle length once found).
  if (target.length > 200) {
    const sig = target.substring(0, 200);
    const sigHit = findNormalized(sig);
    if (sigHit) {
      const end = Math.min(sigHit[0] + target.length, plainText.length);
      return { start: sigHit[0], end, strategy: 'signature-200' };
    }
  }

  // 4. First 60-char signature for shorter quotes.
  if (target.length > 60) {
    const sig = target.substring(0, 60);
    const sigHit = findNormalized(sig);
    if (sigHit) {
      const end = Math.min(sigHit[0] + target.length, plainText.length);
      return { start: sigHit[0], end, strategy: 'signature-60' };
    }
  }

  // 5. "SECTION X.XX" header, when the quote begins with a section cite.
  const sectionMatch = target.match(/^(SECTION\s+\d+\.\d+|Section\s+\d+\.\d+|ARTICLE\s+[IVXLCDM]+|Article\s+[IVXLCDM]+)/);
  if (sectionMatch) {
    const header = sectionMatch[0];
    let hIdx = plainText.indexOf(header);
    if (hIdx < 0) hIdx = lowerSource.indexOf(header.toLowerCase());
    if (hIdx >= 0) {
      const end = Math.min(hIdx + target.length, plainText.length);
      return { start: hIdx, end, strategy: 'section-header' };
    }
  }

  return null;
}

/** Default window padding (chars) around a match, and the increment used by
 *  "show more" expansion in the pop-under UI. */
export const DEFAULT_WINDOW_PAD = 6000;
export const WINDOW_EXPAND_STEP = 6000;

/**
 * Carve a bounded slice of `plainText` around [start, end), expanded outward
 * by `before`/`after` chars (clamped to paragraph boundaries when possible so
 * the excerpt doesn't begin/end mid-sentence). Returns:
 *   { windowStart, windowEnd, text, matchStart, matchEnd, canExpandBefore, canExpandAfter }
 * matchStart/matchEnd are offsets INTO `text` (i.e. window-relative), so the
 * caller can slice `text` into before/match/after for highlighting without
 * re-searching the whole document.
 */
export function buildWindow(plainText, start, end, { before = DEFAULT_WINDOW_PAD, after = DEFAULT_WINDOW_PAD } = {}) {
  const len = plainText.length;
  const s = Math.max(0, Math.min(start, len));
  const e = Math.max(s, Math.min(end, len));

  let windowStart = Math.max(0, s - before);
  let windowEnd = Math.min(len, e + after);

  // Prefer to start/end on a paragraph break within a small search radius so
  // the excerpt doesn't open/close mid-word. Falls back to the raw clamp.
  const PARA_SEARCH = 300;
  if (windowStart > 0) {
    const searchFrom = Math.max(0, windowStart - PARA_SEARCH);
    const idx = plainText.lastIndexOf('\n\n', windowStart);
    if (idx >= searchFrom) windowStart = idx + 2;
  }
  if (windowEnd < len) {
    const idx = plainText.indexOf('\n\n', windowEnd);
    if (idx >= 0 && idx - windowEnd <= PARA_SEARCH) windowEnd = idx;
  }

  return {
    windowStart,
    windowEnd,
    text: plainText.slice(windowStart, windowEnd),
    matchStart: s - windowStart,
    matchEnd: e - windowStart,
    canExpandBefore: windowStart > 0,
    canExpandAfter: windowEnd < len,
  };
}
