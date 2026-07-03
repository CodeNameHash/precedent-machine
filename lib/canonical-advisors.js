/* ───────────────────────────────────────────────────────────────────────────
   lib/canonical-advisors.js — READ-TIME canonicalization of law-firm and
   lawyer names extracted from notices provisions.

   The backfill (scripts/backfill-advisors.js) stores RAW verbatim capture on
   deals.metadata.advisors_v2. This module maps those raw strings to canonical
   display forms at read time, so improving the canon map later requires no
   re-backfill:

     canonicalFirm('Paul, Weiss, Rifkind, Wharton & Garrison LLP')
       → { canonical: 'Paul, Weiss', matched: true }
     canonicalLawyer('BENJAMIN  GOODCHILD, Esq.') → 'Benjamin Goodchild'
     canonicalLawyerKey('Benjamin M. Goodchild')  → 'benjamin|goodchild'
       (dedupe key — middle initials ignored so name variants collapse)

   Canonical firm display = the market colloquial short name ('Paul, Weiss',
   'Wachtell', 'Skadden'), NOT the full legal name. Unmatched firms fall back
   to a cleaned version of the raw string (LLP/LLC suffix stripped, whitespace
   collapsed) so new firms still render sanely.

   CommonJS — consumed by pages (import interop), scripts and tests (require).
   ─────────────────────────────────────────────────────────────────────── */

// ── Firm canon: market short name ← alias regexes ──────────────────────────
// Each regex is tested against the raw captured firm string. Patterns accept
// full legal names, partial names, missing/extra commas, and LLP suffixes.
const FIRM_CANON = [
  { canonical: 'Paul, Weiss', re: /paul,?\s*weiss(?:,?\s*rifkind(?:,?\s*wharton)?(?:\s*&\s*garrison)?)?(?:,?\s*llp)?/i },
  { canonical: 'Wachtell', re: /wachtell(?:,?\s*lipton(?:,?\s*rosen)?(?:\s*&\s*katz)?)?|\bwlrk\b/i },
  { canonical: 'Skadden', re: /skadden(?:,?\s*arps(?:,?\s*slate)?(?:,?\s*meagher)?(?:\s*&\s*flom)?)?/i },
  { canonical: 'Sullivan & Cromwell', re: /sullivan\s*(?:&|and)\s*cromwell/i },
  { canonical: 'Cravath', re: /cravath(?:,?\s*swaine(?:\s*&\s*moore)?)?/i },
  { canonical: 'Davis Polk', re: /davis\s*polk(?:\s*&\s*wardwell)?/i },
  { canonical: 'Simpson Thacher', re: /simpson\s*thacher(?:\s*&\s*bartlett)?/i },
  { canonical: 'Latham & Watkins', re: /latham(?:\s*(?:&|and)\s*watkins)?/i },
  { canonical: 'Kirkland & Ellis', re: /kirkland(?:\s*(?:&|and)\s*ellis)?/i },
  { canonical: 'Cleary Gottlieb', re: /cleary(?:\s*gottlieb(?:\s*steen)?(?:\s*&\s*hamilton)?)?/i },
  { canonical: 'Debevoise', re: /debevoise(?:\s*&\s*plimpton)?/i },
  { canonical: 'Weil', re: /weil,?\s*gotshal(?:\s*&\s*manges)?|^\s*weil\b/i },
  { canonical: 'Freshfields', re: /freshfields(?:\s*bruckhaus(?:\s*deringer)?)?/i },
  { canonical: 'Gibson Dunn', re: /gibson,?\s*dunn(?:\s*&\s*crutcher)?/i },
  { canonical: 'Covington', re: /covington(?:\s*&\s*burling)?/i },
  { canonical: 'Ropes & Gray', re: /ropes\s*(?:&|and)\s*gray/i },
  { canonical: 'Sidley', re: /sidley(?:\s*austin)?/i },
  { canonical: 'White & Case', re: /white\s*(?:&|and)\s*case/i },
  { canonical: 'Cooley', re: /\bcooley\b/i },
  { canonical: 'Goodwin', re: /goodwin(?:\s*procter)?/i },
  { canonical: 'Fenwick', re: /fenwick(?:\s*&\s*west)?/i },
  { canonical: 'Baker McKenzie', re: /baker\s*(?:&\s*)?mckenzie/i },
  { canonical: 'WilmerHale', re: /wilmer\s*hale|wilmer,?\s*cutler/i },
  { canonical: 'Morgan Lewis', re: /morgan,?\s*lewis(?:\s*&\s*bockius)?/i },
  { canonical: 'Fried Frank', re: /fried,?\s*frank(?:,?\s*harris)?(?:,?\s*shriver)?(?:\s*&\s*jacobson)?/i },
  { canonical: 'Willkie', re: /willkie(?:\s*farr)?(?:\s*&\s*gallagher)?/i },
  { canonical: 'Hogan Lovells', re: /hogan\s*lovells/i },
  { canonical: 'Milbank', re: /milbank/i },
  { canonical: 'A&O Shearman', re: /a\s*&\s*o\s*shearman|shearman\s*(?:&|and)\s*sterling|allen\s*(?:&|and)\s*overy/i },
  // Additional firms observed in the corpus / common in the market.
  { canonical: 'Wilson Sonsini', re: /wilson\s*sonsini(?:\s*goodrich)?(?:\s*&\s*rosati)?/i },
  { canonical: 'Jones Day', re: /jones\s*day/i },
  { canonical: 'Jenner & Block', re: /jenner(?:\s*&\s*block)?/i },
  { canonical: 'Vinson & Elkins', re: /vinson\s*(?:&|and)\s*elkins/i },
  { canonical: 'Morrison Foerster', re: /morrison\s*(?:&|and)\s*foerster|\bmofo\b/i },
  { canonical: 'Paul Hastings', re: /paul\s*hastings/i },
  { canonical: 'Dechert', re: /dechert/i },
  { canonical: 'Linklaters', re: /linklaters/i },
  { canonical: 'Clifford Chance', re: /clifford\s*chance/i },
  { canonical: 'Slaughter and May', re: /slaughter\s*and\s*may/i },
  { canonical: 'Mayer Brown', re: /mayer\s*brown/i },
];

// ── Firm cleaning (fallback for unmatched firms) ────────────────────────────
function cleanFirm(raw) {
  let s = String(raw || '').replace(/\s+/g, ' ').trim();
  // Strip trailing entity suffixes (possibly repeated: "X LLP." / "X, P.C.").
  let prev;
  do {
    prev = s;
    s = s
      .replace(/[,\s]*(?:LLP|L\.L\.P\.?|LLC|L\.L\.C\.?|PLLC|P\.?\s?C\.?|P\.A\.?|S\.C\.?)\s*$/i, '')
      .replace(/[,.\s]+$/, '')
      .trim();
  } while (s !== prev && s.length > 0);
  return s;
}

/**
 * canonicalFirm(raw) → { canonical, matched }
 * matched=true when the raw string hits a canon alias; otherwise `canonical`
 * is a cleaned version of the raw so unknown firms still render sanely.
 */
function canonicalFirm(raw) {
  const s = String(raw || '').trim();
  if (!s) return { canonical: null, matched: false };
  for (const f of FIRM_CANON) {
    if (f.re.test(s)) return { canonical: f.canonical, matched: true };
  }
  return { canonical: cleanFirm(s), matched: false };
}

// ── Lawyer names ────────────────────────────────────────────────────────────
const NAME_SUFFIXES = /^(?:jr\.?|sr\.?|ii|iii|iv|esq\.?|p\.?c\.?)$/i;
// Lowercase particles that legitimately appear uncapitalized inside names.
const NAME_PARTICLES = new Set(['van', 'von', 'de', 'der', 'da', 'di', 'la', 'le', 'del']);

function titleCaseToken(tok) {
  // Roman-numeral suffixes stay fully capitalized.
  if (/^(?:ii|iii|iv)$/i.test(tok)) return tok.toUpperCase();
  if (NAME_PARTICLES.has(tok.toLowerCase()) && tok === tok.toLowerCase()) return tok;
  // Preserve internal capitalization (McMillian, DiNapoli) — only normalize
  // tokens that are ALL-CAPS or all-lowercase.
  if (tok === tok.toUpperCase() || tok === tok.toLowerCase()) {
    return tok
      .toLowerCase()
      .replace(/(^|[-'’])([a-z])/g, (m, sep, c) => sep + c.toUpperCase());
  }
  return tok;
}

/**
 * canonicalLawyer(raw) → normalized display name.
 * Collapses whitespace, Title Cases ALL-CAPS/lowercase tokens, normalizes
 * middle initials to "M." form, strips "Esq."/"P.C." and trailing commas.
 */
function canonicalLawyer(raw) {
  let s = String(raw || '').replace(/\s+/g, ' ').trim();
  if (!s) return '';
  // Strip trailing credentials, repeatedly: "Jane Doe, Esq.", "John Roe, P.C.,".
  let prev;
  do {
    prev = s;
    s = s
      .replace(/[,;\s]*(?:esq\.?|p\.?\s?c\.?)\s*$/i, '')
      .replace(/[,;\s]+$/, '')
      .trim();
  } while (s !== prev && s.length > 0);
  // ", III" → " III" (keep generational suffix, drop the comma).
  s = s.replace(/,\s+(jr\.?|sr\.?|ii|iii|iv)$/i, ' $1');
  const tokens = s.split(' ').filter(Boolean).map((tok) => {
    // Single-letter initial (with or without dot) → "M." form.
    const bare = tok.replace(/\.+$/, '');
    if (/^[A-Za-z]$/.test(bare)) return bare.toUpperCase() + '.';
    return titleCaseToken(tok);
  });
  return tokens.join(' ');
}

/**
 * canonicalLawyerKey(name) → 'first|last' lowercased, ignoring middle
 * initials/names and suffixes. Used to DEDUPE spelling variants:
 * 'Benjamin M. Goodchild' / 'Benjamin Goodchild' / 'BENJAMIN GOODCHILD'
 * all key to 'benjamin|goodchild'.
 */
function canonicalLawyerKey(name) {
  const s = canonicalLawyer(name);
  if (!s) return '';
  const tokens = s
    .split(' ')
    .filter(Boolean)
    .filter((t) => !NAME_SUFFIXES.test(t))
    .filter((t) => !/^[A-Za-z]\.$/.test(t)); // drop initials
  if (tokens.length === 0) return s.toLowerCase();
  if (tokens.length === 1) return tokens[0].toLowerCase();
  return `${tokens[0].toLowerCase()}|${tokens[tokens.length - 1].toLowerCase()}`;
}

/**
 * dedupeLawyers(names) → canonicalized, deduped list. When variants collide
 * on the key, the LONGEST canonical form wins (most complete — keeps the
 * middle initial).
 */
function dedupeLawyers(names) {
  const byKey = new Map();
  for (const raw of Array.isArray(names) ? names : []) {
    const canon = canonicalLawyer(raw);
    if (!canon) continue;
    const key = canonicalLawyerKey(canon);
    if (!key) continue;
    const existing = byKey.get(key);
    if (!existing || canon.length > existing.length) byKey.set(key, canon);
  }
  return [...byKey.values()];
}

/**
 * dedupeFirms(raws) → canonical display names, deduped (two raw variants of
 * the same firm collapse to one canonical entry, order preserved).
 */
function dedupeFirms(raws) {
  const seen = new Set();
  const out = [];
  for (const raw of Array.isArray(raws) ? raws : []) {
    const { canonical } = canonicalFirm(raw);
    if (!canonical) continue;
    const key = canonical.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(canonical);
  }
  return out;
}

/**
 * getDisplayAdvisors(metadata) — read-time helper for the UI. Takes a deal's
 * metadata object (or null) and returns canonicalized, deduped advisor fields
 * from metadata.advisors_v2. All fields default to empty ([] / null).
 */
function getDisplayAdvisors(metadata) {
  const v2 = metadata && typeof metadata === 'object' ? metadata.advisors_v2 : null;
  const empty = { buyerFirm: null, buyerFirms: [], buyerLawyers: [], sellerFirm: null, sellerFirms: [], sellerLawyers: [] };
  if (!v2 || typeof v2 !== 'object') return empty;
  const firmList = (v) => (Array.isArray(v) ? v : v ? [v] : []);
  const buyerFirms = dedupeFirms(firmList(v2.buyer_firms).length ? v2.buyer_firms : firmList(v2.buyer_firm));
  const sellerFirms = dedupeFirms(firmList(v2.seller_firms).length ? v2.seller_firms : firmList(v2.seller_firm));
  return {
    buyerFirm: buyerFirms[0] || null,
    buyerFirms,
    buyerLawyers: dedupeLawyers(v2.buyer_lawyers),
    sellerFirm: sellerFirms[0] || null,
    sellerFirms,
    sellerLawyers: dedupeLawyers(v2.seller_lawyers),
  };
}

module.exports = {
  FIRM_CANON,
  canonicalFirm,
  cleanFirm,
  canonicalLawyer,
  canonicalLawyerKey,
  dedupeLawyers,
  dedupeFirms,
  getDisplayAdvisors,
};
