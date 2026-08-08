/* ─────────────────────────────────────────────────────────────────────────
   lib/parser-v2/subclauses.js — deterministic sub-clause segmentation.

   Span accounting spec (docs/archive/handoffs/SPAN-ACCOUNTING-SPEC-2026-07-18.md),
   Part 1. Pure functions, no LLM: `segmentSubClauses(sectionText)` walks a
   classified section's body and returns the ordered list of LEAF spans that
   partition it — `{ marker, depth, start, end, text }` — so a downstream
   residual check (Part 3) can prove nothing between the leaves was dropped.

   `marker` is a dotted path ("a", "a.ii", "a.ii.B") identifying the leaf's
   position in the outline; `marker: null` is chapeau/preamble text that
   precedes the first structural marker (or a parent's own text before its
   first child — e.g. "(a) Each of the following:" ahead of "(i)…").

   ── Why this is hard: structural markers vs. inline cross-references ──
   A classified section is full of parenthetical text that LOOKS like a
   marker but isn't one: "Section 3.1(b)(i)" is a cross-reference, not a new
   sub-clause. Three heuristics (in order of precedence) decide:

   1. SIBLING — the token continues the CURRENT open list (same style, next
      value). Allowed anywhere a bracket is "eligible" (see below), even
      mid-paragraph comma-separated ("(A) …, (B) …, (C) … and (D) …") — this
      is what recovers QXO §5.2(a)(ii)'s inline (A)-(D) bring-down tiers.
   2. CHILD-OPEN — the token is the first value of its style ("a"/"i"/"A"/
      "1") AND one of: (i) it is the very first marker in the section; (ii)
      it is immediately adjacent to the prior structural marker's closing
      paren (only whitespace between, as in "(a)\n\n(i)…"); or (iii) it is
      COLON-INTRODUCED — the nearest non-whitespace character before the
      bracket, whitespace aside, is ':' (as in Concho's "…involving,
      directly or indirectly: (a) any acquisition …"). The colon case is
      deliberately narrow: it only fires when the colon is the IMMEDIATE
      lead-up. A chapeau that is NOT punctuated with a colon right before
      the bracket — "shall include (i) …", "copies of (i) all current
      documents", "will not (i) entitle …" — still does NOT open a child;
      neither does a colon that is followed by prose before the bracket
      ("the following: clauses (A), (B) … above" — "clauses" sits between
      the colon and "(A)", so the immediate-lead-up test fails). See Redfin
      §2.10(d)/(h), whose internal (i)-(v) / (i)-(iii) runs are neither
      line-adjacent to their parent NOR colon-introduced (both are plain
      prose lead-ins, verified against the pinned fixture text) and are
      correctly left unsplit. Where CHILD-OPEN does not fire, the
      consequence is conservative, not lossy — un-split enumerations simply
      stay inside their parent leaf (still covered, just less finely
      divided).
   3. DEDENT — the token matches the SIBLING condition of an ANCESTOR frame
      (not the current one), but ONLY when it sits at start-of-line (nothing
      but whitespace since the last newline). This is what lets QXO's real
      top-level "(b)" (after "(a)"'s nested (i)/(ii)/(iii)) close back out to
      depth 1, while a back-reference like "clauses (A), (B), (C) and (D)
      above" — same style, same values, mid-paragraph — is correctly
      REJECTED (dedent requires line-start; the back-reference is inline).

   A bracket is only a MARKER CANDIDATE at all if the character immediately
   before "(" is start-of-string, whitespace, ',', ';', ':', or a ')' that
   closes an already-CONFIRMED structural marker. This alone rejects the
   overwhelming majority of cross-references ("3.1(b)" is preceded by a
   digit) without needing any semantic understanding of the text.

   Reuses the marker-locating heuristics proven in consideration-equity.js
   (priorMarkerStart / nextMarkerStart) — lifted here and re-exported so
   there is one source of truth for "what does a marker look like."
   ───────────────────────────────────────────────────────────────────────── */

// ---------------------------------------------------------------------------
// Marker primitives — lifted from consideration-equity.js (proven heuristics
// for locating a marker near a given index). Re-exported so
// consideration-equity.js can require them from here instead of duplicating.
// ---------------------------------------------------------------------------

function priorMarkerStart(text, index) {
  const before = text.slice(Math.max(0, index - 300), index);
  const matches = [...before.matchAll(/\(([a-z]{1,5}|[ivx]{1,6})\)/gi)];
  if (!matches.length) return -1;
  const last = matches[matches.length - 1];
  return Math.max(0, index - before.length + last.index);
}

function markerAt(text, index) {
  const m = /^\(([a-z]{1,5}|[ivx]{1,6})\)/i.exec(text.slice(index, index + 16));
  return m ? index : -1;
}

function nextMarkerStart(text, from) {
  const tail = text.slice(from);
  const m = /\s\(([a-z]{1,5}|[ivx]{1,6})\)\s+(?=[A-Z])/i.exec(tail);
  return m ? from + m.index : -1;
}

// ---------------------------------------------------------------------------
// Style/value resolution for outline markers.
// ---------------------------------------------------------------------------

// Same whitelist already proven in extract.js's Strategy A splitter.
const ROMAN_NUMERALS = [
  'i', 'ii', 'iii', 'iv', 'v', 'vi', 'vii', 'viii', 'ix', 'x', 'xi', 'xii',
  'xiii', 'xiv', 'xv', 'xvi', 'xvii', 'xviii', 'xix', 'xx',
];
const ROMAN_INDEX = new Map(ROMAN_NUMERALS.map((r, i) => [r, i]));

function alphaValue(content) {
  const c = content.toLowerCase();
  if (!/^[a-z]+$/.test(c)) return null;
  if (c.length === 1) return c.charCodeAt(0) - 97; // a=0 (0-based, matches roman/digit)
  // Doubled-letter continuation past z: aa, bb, cc, ... (best-effort — not
  // exercised by the pinned fixtures; real legal outlines rarely reach it).
  if (c.length === 2 && c[0] === c[1]) return 26 + (c.charCodeAt(0) - 97);
  return null;
}

// Candidate {style, value} pairs for a bracket's content. A token can be
// ambiguous (single-letter roman numerals i/v/x/l/c/d/m double as letters);
// callers disambiguate via which style matches the ACTIVE outline frame.
function candidateStyles(content) {
  const out = [];
  if (/^[a-z]{1,2}$/.test(content)) {
    const v = alphaValue(content);
    if (v !== null) out.push({ style: 'alphaLower', value: v });
  }
  if (/^[A-Z]{1,2}$/.test(content)) {
    const v = alphaValue(content.toLowerCase());
    if (v !== null) out.push({ style: 'alphaUpper', value: v });
  }
  if (/^[ivx]+$/.test(content) && ROMAN_INDEX.has(content)) {
    out.push({ style: 'romanLower', value: ROMAN_INDEX.get(content) });
  }
  if (/^[0-9]{1,3}$/.test(content)) {
    out.push({ style: 'digit', value: parseInt(content, 10) - 1 });
  }
  return out;
}

// A "(xxx)" bracket is only a marker CANDIDATE if what precedes it looks
// like a list-item boundary, not a cross-reference glued to a section
// number ("3.1(b)") or a defined term ("Company(a)"). `structuralEnds` is
// the set of char offsets where an already-confirmed structural marker's
// closing paren sits — that's the one case a non-whitespace preceding char
// (')') is still eligible ("(ii)(A)").
function isEligiblePosition(text, tokenStart, structuralEnds) {
  if (tokenStart === 0) return true;
  const prev = text[tokenStart - 1];
  if (/\s/.test(prev)) return true;
  if (prev === ',' || prev === ';' || prev === ':') return true;
  if (prev === ')' && structuralEnds.has(tokenStart)) return true;
  return false;
}

// True if only whitespace separates two offsets (used for the CHILD-OPEN
// adjacency test and for start-of-line detection).
function onlyWhitespaceBetween(text, from, to) {
  if (to <= from) return true;
  return /^\s*$/.test(text.slice(from, to));
}

function isStartOfLine(text, tokenStart) {
  const lastNewline = text.lastIndexOf('\n', tokenStart - 1);
  const from = lastNewline === -1 ? 0 : lastNewline + 1;
  return onlyWhitespaceBetween(text, from, tokenStart);
}

// True if the nearest non-whitespace character before tokenStart is ':' —
// i.e. the candidate marker is the first item of a colon-introduced inline
// enumeration ("involving, directly or indirectly: (a) any acquisition …").
// Any word between the colon and the bracket (e.g. "the following: clauses
// (A), (B) … above") fails this — it only fires when the colon is the
// IMMEDIATE lead-up, whitespace aside, which is what makes it safe against
// back-references that merely follow a colon somewhere earlier in the
// sentence.
function isColonIntroduced(text, tokenStart) {
  let i = tokenStart - 1;
  while (i >= 0 && /\s/.test(text[i])) i--;
  return i >= 0 && text[i] === ':';
}

const MAX_DEPTH = 3;
const MARKER_TOKEN_RE = /\(([a-zA-Z]{1,3}|[0-9]{1,3})\)/g;

/**
 * Pass 1: find the ordered list of STRUCTURAL markers in `text`, resolving
 * each to a depth (1-based) and a dotted path ("a", "a.ii", "a.ii.B") via
 * the SIBLING / CHILD-OPEN / DEDENT rules described above.
 *
 * Returns [{ path, depth, tokenStart, tokenEnd, label }...].
 */
function findStructuralMarkers(text) {
  const structuralEnds = new Set(); // char offset just past a confirmed marker's ")"
  const stack = []; // [{ style, value, path, depth }]
  const markers = [];

  MARKER_TOKEN_RE.lastIndex = 0;
  let m;
  while ((m = MARKER_TOKEN_RE.exec(text)) !== null) {
    const content = m[1];
    const tokenStart = m.index;
    const tokenEnd = m.index + m[0].length;
    if (!isEligiblePosition(text, tokenStart, structuralEnds)) continue;

    const candidates = candidateStyles(content);
    if (!candidates.length) continue;

    const top = stack[stack.length - 1] || null;

    // Single-char tokens that double as BOTH a letter and a roman numeral
    // ("i", "v", "x") are ambiguous — candidateStyles returns >1 style. A
    // SIBLING match for an ambiguous token is only trusted at a STRONG
    // position (start-of-line, or immediately adjacent to a confirmed
    // marker) — otherwise a stray "(i)" opening an unrelated inline
    // enumeration ("will not (i) entitle …") gets misread as the next item
    // of an unrelated active alpha list. Unambiguous tokens ("ii", "B", "3")
    // keep the ordinary (weaker) eligibility test.
    const ambiguous = candidates.length > 1;
    const strongPosition = tokenStart === 0
      || isStartOfLine(text, tokenStart)
      || structuralEnds.has(tokenStart);

    // 1. SIBLING at current top frame.
    let matched = null;
    if (top && !(ambiguous && !strongPosition)) {
      const hit = candidates.find((c) => c.style === top.style && c.value === top.value + 1);
      if (hit) {
        top.value = hit.value;
        matched = top;
      }
    }

    // 2. CHILD-OPEN — first value of its style, adjacent to the prior
    //    structural marker (or the very first marker overall).
    if (!matched && stack.length < MAX_DEPTH) {
      const firstHit = candidates.find((c) => c.value === 0);
      if (firstHit) {
        const isFirstMarkerOverall = markers.length === 0;
        const prevEnd = markers.length ? markers[markers.length - 1].tokenEnd : -1;
        const adjacentToPrior = prevEnd >= 0 && onlyWhitespaceBetween(text, prevEnd, tokenStart);
        const colonIntroduced = isColonIntroduced(text, tokenStart);
        if (isFirstMarkerOverall || adjacentToPrior || colonIntroduced) {
          const frame = {
            style: firstHit.style,
            value: 0,
            depth: stack.length + 1,
            path: top ? `${top.path}.${content}` : content,
          };
          stack.push(frame);
          matched = frame;
        }
      }
    }

    // 3. DEDENT — matches an ANCESTOR frame's sibling condition, but only
    //    at start-of-line (rejects mid-paragraph back-references).
    if (!matched && stack.length > 1 && isStartOfLine(text, tokenStart)) {
      for (let depth = stack.length - 2; depth >= 0; depth--) {
        const frame = stack[depth];
        const hit = candidates.find((c) => c.style === frame.style && c.value === frame.value + 1);
        if (hit) {
          frame.value = hit.value;
          stack.length = depth + 1; // pop deeper frames
          matched = frame;
          break;
        }
      }
    }

    if (!matched) continue;

    // Rebuild the matched frame's path if it's a sibling continuation (the
    // path's last segment needs to reflect the NEW content, not the first
    // occurrence of that style).
    const parentPath = stack.length > 1 ? stack[stack.length - 2].path : null;
    matched.path = parentPath ? `${parentPath}.${content}` : content;

    structuralEnds.add(tokenEnd);
    markers.push({
      path: matched.path,
      depth: matched.depth,
      tokenStart,
      tokenEnd,
      label: content,
    });
  }

  return markers;
}

/**
 * segmentSubClauses(sectionText) → ordered list of LEAF spans that partition
 * the section's text: { marker, depth, start, end, text }.
 *
 * `marker` is the dotted outline path ("a", "a.ii", "a.ii.B") or `null` for
 * chapeau text (before the first marker, or a parent's own text before its
 * first child). Every char of `sectionText` belongs to exactly one returned
 * span — leaves partition the section.
 */
function segmentSubClauses(sectionText) {
  const text = String(sectionText || '');
  const markers = findStructuralMarkers(text);
  const leaves = [];

  const pushLeaf = (marker, depth, start, end) => {
    if (end <= start) return;
    const span = text.slice(start, end);
    if (!span.trim()) return; // pure whitespace — nothing to account for
    leaves.push({ marker, depth, start, end, text: span });
  };

  if (!markers.length) {
    pushLeaf(null, 0, 0, text.length);
    return leaves;
  }

  // Chapeau before the first marker.
  pushLeaf(null, 0, 0, markers[0].tokenStart);

  for (let i = 0; i < markers.length; i++) {
    const cur = markers[i];
    const next = markers[i + 1] || null;
    const isParent = next && next.depth === cur.depth + 1;

    // END = start of the next marker (in full sequence order) whose depth
    // is <= cur.depth (next sibling-or-shallower), or text end.
    let end = text.length;
    for (let j = i + 1; j < markers.length; j++) {
      if (markers[j].depth <= cur.depth) { end = markers[j].tokenStart; break; }
    }

    if (isParent) {
      // Own chapeau text before the first child (often empty, as in QXO's
      // bare "(a)" immediately followed by "(i)").
      pushLeaf(cur.path, cur.depth, cur.tokenEnd, next.tokenStart);
      // Children are handled by their own loop iterations.
    } else {
      pushLeaf(cur.path, cur.depth, cur.tokenEnd, end);
    }
  }

  leaves.sort((a, b) => a.start - b.start);
  return leaves;
}

module.exports = {
  segmentSubClauses,
  findStructuralMarkers,
  priorMarkerStart,
  markerAt,
  nextMarkerStart,
};
