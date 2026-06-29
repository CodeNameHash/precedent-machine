/* ─────────────────────────────────────────────────────────────────────────
   lib/search.js — shared helpers for the cross-deal provision search backend.
   ───────────────────────────────────────────────────────────────────────────
   The search endpoints (pages/api/search/*) let a user query the WHOLE corpus
   — every provision across every deal — by free text, provision type/family,
   canonical code, category, favorability, and feature-key presence. These
   helpers normalize request params and translate them into PostgREST filters.

   Provision "type" is stored per-party (REP-T / REP-B, TERMR-M / TERMR-B /
   TERMR-T, COND-M / COND-B / COND-S, IOC-T / IOC-B …). A search for a FAMILY
   ("TERMR") should match the base type and every party variant, so we expand a
   base type to the PostgREST OR-clause `type.eq.TERMR,type.like.TERMR-*`.
   Pure / framework-free so both the API routes and any future surface reuse it.
   ───────────────────────────────────────────────────────────────────────── */

const MAX_LIMIT = 200;
const DEFAULT_LIMIT = 50;

// The stored ai_favorability column uses ~10 spellings for 3 concepts. Map each
// canonical bucket to every stored synonym so a single "buyer-favorable" filter
// chip matches buyer_friendly / pro-buyer etc., and so a result's raw value can
// be collapsed back to its bucket for consistent coloring.
const FAVORABILITY_GROUPS = {
  neutral: ['neutral'],
  'buyer-favorable': ['buyer-favorable', 'buyer_friendly', 'pro-buyer'],
  'seller-favorable': [
    'seller-favorable', 'pro-seller', 'target-favorable',
    'company-favorable', 'seller_friendly', 'buyer-unfavorable',
  ],
};

// Expand a canonical favorability bucket to its stored synonyms (for IN filters).
// An unknown value passes through unchanged so a raw stored value still works.
function expandFavorability(v) {
  if (!v) return [];
  return FAVORABILITY_GROUPS[v] || [v];
}

// Collapse any stored favorability spelling back to its canonical bucket.
function canonicalFavorability(v) {
  if (!v) return null;
  for (const [bucket, syns] of Object.entries(FAVORABILITY_GROUPS)) {
    if (syns.includes(v)) return bucket;
  }
  return v;
}

// Split a comma/whitespace separated list param into a clean array.
function toList(v) {
  if (v == null) return [];
  if (Array.isArray(v)) return v.flatMap(toList);
  return String(v)
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean);
}

// Clamp + default an integer param.
function toInt(v, dflt, { min = 0, max = Infinity } = {}) {
  const n = parseInt(v, 10);
  if (Number.isNaN(n)) return dflt;
  return Math.max(min, Math.min(max, n));
}

// Escape a value for use inside a PostgREST `or=(…)` filter. Commas and
// parentheses are the structural delimiters; wrap risky values in double quotes.
function pgrstQuote(v) {
  const s = String(v);
  if (/[(),"]/.test(s)) return `"${s.replace(/"/g, '\\"')}"`;
  return s;
}

// Expand a list of base/variant types into the set of PostgREST OR conditions
// that match the family. e.g. ['TERMR','COND-M'] →
//   ['type.eq.TERMR', 'type.like.TERMR-*', 'type.eq.COND-M']
// A type that already names a party variant (contains a hyphen) is matched
// exactly; a bare base type also matches its `BASE-*` party variants.
function typeFamilyOrConditions(types) {
  const conds = [];
  for (const t of types) {
    const safe = pgrstQuote(t);
    conds.push(`type.eq.${safe}`);
    if (!t.includes('-')) {
      conds.push(`type.like.${pgrstQuote(`${t}-*`)}`);
    }
  }
  return conds;
}

// Build the highlighted snippet: a window of clause text around the first
// case-insensitive match of the query, else the head of the clause.
function buildSnippet(fullText, q, width = 240) {
  const text = (fullText || '').replace(/\s+/g, ' ').trim();
  if (!text) return '';
  if (!q) return text.length > width ? `${text.slice(0, width)}…` : text;
  const idx = text.toLowerCase().indexOf(String(q).toLowerCase());
  if (idx < 0) return text.length > width ? `${text.slice(0, width)}…` : text;
  const start = Math.max(0, idx - Math.floor(width / 3));
  const end = Math.min(text.length, start + width);
  return `${start > 0 ? '…' : ''}${text.slice(start, end)}${end < text.length ? '…' : ''}`;
}

// Normalize all supported search params from a GET query or POST body into a
// single canonical filter object the endpoints consume.
function parseSearchParams(src) {
  const s = src || {};
  return {
    q: (s.q || s.query || '').toString().trim(),
    types: toList(s.type || s.types),
    codes: toList(s.code || s.codes),
    categories: toList(s.category || s.categories),
    dealIds: toList(s.deal_id || s.deal_ids || s.deals),
    favorability: (s.favorability || s.fav || '').toString().trim() || null,
    featureKey: (s.feature || s.feature_key || '').toString().trim() || null,
    limit: toInt(s.limit, DEFAULT_LIMIT, { min: 1, max: MAX_LIMIT }),
    offset: toInt(s.offset, 0, { min: 0 }),
    sort: (s.sort || 'relevance').toString(),
  };
}

module.exports = {
  MAX_LIMIT,
  DEFAULT_LIMIT,
  FAVORABILITY_GROUPS,
  expandFavorability,
  canonicalFavorability,
  toList,
  toInt,
  pgrstQuote,
  typeFamilyOrConditions,
  buildSnippet,
  parseSearchParams,
};
