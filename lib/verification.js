/* ─────────────────────────────────────────────────────────────────────────
   lib/verification.js — the trust layer: quote verification + coverage.
   ───────────────────────────────────────────────────────────────────────────
   Two questions a legal-precedent tool must be able to answer about itself:

   1. QUOTE VERIFICATION — every citable feature stores model-emitted "verbatim"
      quotes ({ value, quotes: [...] }, legacy { value, text }, tagged
      { code, label, text }). Nothing has ever checked that those strings
      actually appear in the agreement. verifyDealQuotes() walks every
      provision's feature bag, extracts each quote, and fuzzy-matches it
      against the deal's source text (and the provision's own full_text).
      Unverified quotes are the hallucination surface — they get flagged, not
      trusted.

   2. COVERAGE — what fraction of the agreement's text is captured by SOME
      provision? computeCoverage() locates each provision's full_text inside
      the normalized source, merges the matched intervals, and reports the
      covered percentage plus the largest UNCOVERED gaps (with previews) so
      "what did we miss?" is a glance, not an audit.

   Matching is done in NORMALIZED space on both sides: strip the [[SECTION]]/
   [[REF]]/[[CENTER]]/«» pipeline markers, normalize smart quotes/dashes,
   collapse whitespace, lowercase. The model never reproduces markers and
   frequently normalizes punctuation, so raw indexOf would false-negative.

   CommonJS on purpose (same pattern as lib/search.js / lib/rubric.js) so both
   API routes and node --test can require it.
   ───────────────────────────────────────────────────────────────────────── */

// Strip pipeline markup + normalize typography + collapse whitespace.
function normalizeForMatch(s) {
  if (typeof s !== 'string') return '';
  return s
    .replace(/\[\[\/?[A-Z_]+\]\]/g, ' ') // [[SECTION]] / [[/REF]] / [[CENTER]] …
    .replace(/[«»]/g, ' ')
    .replace(/[‘’‛]/g, "'")
    .replace(/[“”„]/g, '"')
    .replace(/[–—]/g, '-')
    .replace(/ /g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .toLowerCase();
}

// A quote "verifies" when its normalized form appears in the normalized
// source. Very short quotes (< 12 chars) are too ambiguous to prove anything
// either way — skip them rather than award false confidence. Long quotes that
// fail whole-string matching get one more chance on their first ~80 chars
// (models often truncate the tail with an ellipsis).
const MIN_QUOTE_CHARS = 12;

function quoteAppearsIn(normQuote, normSource) {
  if (!normQuote || normQuote.length < MIN_QUOTE_CHARS) return null; // unjudgeable
  if (normSource.includes(normQuote)) return true;
  const head = normQuote.replace(/\s*(\.\.\.|…)\s*$/, '').slice(0, 80);
  if (head.length >= MIN_QUOTE_CHARS && normSource.includes(head)) return true;
  return false;
}

// Recursively collect every quote-bearing string from a feature bag.
// Quote-bearing fields, by convention across the codebase:
//   • `quotes: [ "…" ]` arrays inside citable wrappers
//   • legacy citable `{ value, text }` → text
//   • tagged items `{ code, label, text }` → text (meant to be verbatim)
// Plain string VALUES are not quotes (they're often labels/summaries) and are
// not collected.
function collectQuotes(node, path = '', out = []) {
  if (node === null || node === undefined) return out;
  if (Array.isArray(node)) {
    node.forEach((v, i) => collectQuotes(v, `${path}[${i}]`, out));
    return out;
  }
  if (typeof node !== 'object') return out;

  if (Array.isArray(node.quotes)) {
    for (const q of node.quotes) {
      if (typeof q === 'string' && q.trim()) out.push({ path: `${path}.quotes`, quote: q.trim() });
    }
  }
  // {value, text} citable OR {code,label,text} tagged — text is verbatim-intent.
  if (typeof node.text === 'string' && node.text.trim() && ('value' in node || 'code' in node)) {
    out.push({ path: `${path}.text`, quote: node.text.trim() });
  }
  for (const [k, v] of Object.entries(node)) {
    if (k === 'quotes' || k === 'text') continue;
    if (v && typeof v === 'object') collectQuotes(v, path ? `${path}.${k}` : k, out);
  }
  return out;
}

/**
 * Verify every quote across a deal's provisions against the source text.
 * @param {Array} provisions — rows with { id, type, category, full_text, ai_metadata }
 * @param {string} sourceText — the deal's full agreement text
 * @returns {{ total, verified, unverified, skipped, failures: [...] }}
 */
function verifyDealQuotes(provisions, sourceText) {
  const normSource = normalizeForMatch(sourceText || '');
  let total = 0;
  let verified = 0;
  let skipped = 0;
  const failures = [];

  for (const p of provisions || []) {
    const meta = p && p.ai_metadata && typeof p.ai_metadata === 'object' ? p.ai_metadata : {};
    const feats = meta.features && typeof meta.features === 'object' ? meta.features : {};
    const quotes = collectQuotes(feats);
    if (quotes.length === 0) continue;
    const normProvText = normalizeForMatch(p.full_text || '');

    for (const { path, quote } of quotes) {
      total += 1;
      const nq = normalizeForMatch(quote);
      const inSource = quoteAppearsIn(nq, normSource);
      if (inSource === null) { skipped += 1; continue; }
      if (inSource) { verified += 1; continue; }
      failures.push({
        provision_id: p.id,
        type: p.type,
        category: p.category,
        feature_path: path,
        quote: quote.length > 220 ? `${quote.slice(0, 219)}…` : quote,
        // Weaker signal recorded for triage: does it at least appear in the
        // provision's own captured text? (If yes, the SOURCE text is likely
        // stale/differently-normalized rather than the quote invented.)
        in_provision_text: quoteAppearsIn(nq, normProvText) === true,
      });
    }
  }

  return { total, verified, unverified: failures.length, skipped, failures };
}

/**
 * Coverage: locate each provision's full_text in the normalized source, merge
 * intervals, report covered % + the largest uncovered gaps.
 *
 * Provisions were substringed from the cleaned source, so a normalized prefix
 * match is reliable. Overlaps (preamble vs. sub-clauses, DEF entries inside
 * section text) are handled by interval merging.
 */
function computeCoverage(provisions, sourceText, opts = {}) {
  const minGapChars = opts.minGapChars || 400;
  const maxGaps = opts.maxGaps || 10;
  const normSource = normalizeForMatch(sourceText || '');
  const srcLen = normSource.length;
  if (!srcLen) return { sourceChars: 0, coveredChars: 0, pct: 0, located: 0, unlocated: 0, gaps: [] };

  const intervals = [];
  let located = 0;
  let unlocated = 0;

  for (const p of provisions || []) {
    const norm = normalizeForMatch(p && p.full_text ? p.full_text : '');
    if (norm.length < 30) continue; // too short to place meaningfully
    // Anchor on a prefix long enough to be unique, then extend by the text's
    // own normalized length (the body may diverge slightly near the cut tail).
    const needle = norm.slice(0, Math.min(160, norm.length));
    const idx = normSource.indexOf(needle);
    if (idx === -1) { unlocated += 1; continue; }
    located += 1;
    intervals.push([idx, Math.min(srcLen, idx + norm.length)]);
  }

  intervals.sort((a, b) => a[0] - b[0]);
  const merged = [];
  for (const [s, e] of intervals) {
    if (merged.length && s <= merged[merged.length - 1][1]) {
      merged[merged.length - 1][1] = Math.max(merged[merged.length - 1][1], e);
    } else {
      merged.push([s, e]);
    }
  }

  let covered = 0;
  for (const [s, e] of merged) covered += e - s;

  // Uncovered gaps (with previews) — the "what did we miss" list.
  const gaps = [];
  let cursor = 0;
  for (const [s, e] of merged) {
    if (s - cursor >= minGapChars) {
      gaps.push({ start: cursor, length: s - cursor, preview: `${normSource.slice(cursor, cursor + 240).trim()}…` });
    }
    cursor = Math.max(cursor, e);
  }
  if (srcLen - cursor >= minGapChars) {
    gaps.push({ start: cursor, length: srcLen - cursor, preview: `${normSource.slice(cursor, cursor + 240).trim()}…` });
  }
  gaps.sort((a, b) => b.length - a.length);

  return {
    sourceChars: srcLen,
    coveredChars: covered,
    pct: Math.round((covered / srcLen) * 1000) / 10,
    located,
    unlocated,
    gaps: gaps.slice(0, maxGaps),
  };
}

module.exports = {
  normalizeForMatch,
  quoteAppearsIn,
  collectQuotes,
  verifyDealQuotes,
  computeCoverage,
  MIN_QUOTE_CHARS,
};
