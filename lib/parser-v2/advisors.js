/**
 * advisors.js — Phase 1.5 helper for the v2 parser pipeline.
 *
 * Scans the preamble (first 2000 chars) and signature block (last 4000 chars)
 * of a merger agreement and produces a deduplicated list of advisor entries:
 *
 *   { firm, party, partner, role }
 *
 * Where:
 *   firm    — string, e.g. "Paul, Weiss, Rifkind, Wharton & Garrison LLP"
 *   party   — one of 'parent' | 'company' | 'special_committee' | null
 *   partner — string nullable, e.g. "Scott A. Barshay"
 *   role    — one of 'legal' | 'financial' | 'tax' | 'other'
 *
 * Conservative-by-design: only emits an entry when both the firm AND a
 * high-confidence party signal are present. Better to miss than to mislabel.
 *
 * CommonJS — consumed by Next.js API routes.
 */

// ---------------------------------------------------------------------------
// Canonical firm list (extend as needed). Each entry has:
//   { canonical, role, patterns: [regex] }
// canonical is the display name; patterns match any of the firm's common
// spellings (with or without ", LLP", with abbreviated trailing names, etc.).
// ---------------------------------------------------------------------------

const FIRMS = [
  // ── Legal (BigLaw US) ──
  { canonical: 'Paul, Weiss, Rifkind, Wharton & Garrison LLP', role: 'legal', patterns: [/paul[\s,]+weiss/i] },
  { canonical: 'Wachtell, Lipton, Rosen & Katz', role: 'legal', patterns: [/wachtell/i, /\bWLRK\b/] },
  { canonical: 'Skadden, Arps, Slate, Meagher & Flom LLP', role: 'legal', patterns: [/skadden/i] },
  { canonical: 'Sullivan & Cromwell LLP', role: 'legal', patterns: [/sullivan\s*&\s*cromwell/i] },
  { canonical: 'Cravath, Swaine & Moore LLP', role: 'legal', patterns: [/cravath/i] },
  { canonical: 'Davis Polk & Wardwell LLP', role: 'legal', patterns: [/davis\s+polk/i] },
  { canonical: 'Simpson Thacher & Bartlett LLP', role: 'legal', patterns: [/simpson\s+thacher/i] },
  { canonical: 'Latham & Watkins LLP', role: 'legal', patterns: [/latham\s*&\s*watkins/i] },
  { canonical: 'Kirkland & Ellis LLP', role: 'legal', patterns: [/kirkland\s*&\s*ellis/i] },
  { canonical: 'Cleary Gottlieb Steen & Hamilton LLP', role: 'legal', patterns: [/cleary\s+gottlieb/i] },
  { canonical: 'Weil, Gotshal & Manges LLP', role: 'legal', patterns: [/weil[\s,]+gotshal/i] },
  { canonical: 'Debevoise & Plimpton LLP', role: 'legal', patterns: [/debevoise/i] },
  { canonical: 'Gibson, Dunn & Crutcher LLP', role: 'legal', patterns: [/gibson[\s,]+dunn/i] },
  { canonical: 'Sidley Austin LLP', role: 'legal', patterns: [/sidley\s+austin/i] },
  { canonical: 'Hogan Lovells US LLP', role: 'legal', patterns: [/hogan\s+lovells/i] },
  { canonical: 'White & Case LLP', role: 'legal', patterns: [/white\s*&\s*case/i] },
  { canonical: 'Freshfields Bruckhaus Deringer LLP', role: 'legal', patterns: [/freshfields/i] },
  { canonical: 'Linklaters LLP', role: 'legal', patterns: [/linklaters/i] },
  { canonical: 'Allen & Overy LLP', role: 'legal', patterns: [/allen\s*&\s*overy/i] },
  { canonical: 'Clifford Chance US LLP', role: 'legal', patterns: [/clifford\s+chance/i] },
  { canonical: 'Slaughter and May', role: 'legal', patterns: [/slaughter\s+and\s+may/i] },
  { canonical: 'Ropes & Gray LLP', role: 'legal', patterns: [/ropes\s*&\s*gray/i] },
  { canonical: 'Cooley LLP', role: 'legal', patterns: [/\bcooley\b\s+llp/i] },
  { canonical: 'Fenwick & West LLP', role: 'legal', patterns: [/fenwick\s*&\s*west/i] },
  { canonical: 'Wilson Sonsini Goodrich & Rosati', role: 'legal', patterns: [/wilson\s+sonsini/i] },
  { canonical: 'Goodwin Procter LLP', role: 'legal', patterns: [/goodwin\s+procter/i] },
  { canonical: 'Morrison & Foerster LLP', role: 'legal', patterns: [/morrison\s*&\s*foerster/i, /\bmofo\b/i] },
  { canonical: 'Fried, Frank, Harris, Shriver & Jacobson LLP', role: 'legal', patterns: [/fried[\s,]+frank/i] },
  { canonical: 'Vinson & Elkins LLP', role: 'legal', patterns: [/vinson\s*&\s*elkins/i] },
  { canonical: 'Mayer Brown LLP', role: 'legal', patterns: [/mayer\s+brown/i] },
  { canonical: 'Sullivan & Worcester LLP', role: 'legal', patterns: [/sullivan\s*&\s*worcester/i] },
  { canonical: 'Richards, Layton & Finger, P.A.', role: 'legal', patterns: [/richards[\s,]+layton/i] },
  { canonical: 'Potter Anderson & Corroon LLP', role: 'legal', patterns: [/potter\s+anderson/i] },

  // ── Financial advisors / investment banks ──
  { canonical: 'Goldman Sachs & Co. LLC', role: 'financial', patterns: [/goldman\s+sachs/i] },
  { canonical: 'Morgan Stanley & Co. LLC', role: 'financial', patterns: [/morgan\s+stanley/i] },
  { canonical: 'J.P. Morgan Securities LLC', role: 'financial', patterns: [/j\.?\s*p\.?\s*morgan/i, /jpmorgan/i] },
  { canonical: 'BofA Securities, Inc.', role: 'financial', patterns: [/bofa\s+securities/i, /bank\s+of\s+america/i, /merrill\s+lynch/i] },
  { canonical: 'Citigroup Global Markets Inc.', role: 'financial', patterns: [/citigroup/i, /citi\s+global/i] },
  { canonical: 'Barclays Capital Inc.', role: 'financial', patterns: [/barclays/i] },
  { canonical: 'Credit Suisse Securities (USA) LLC', role: 'financial', patterns: [/credit\s+suisse/i] },
  { canonical: 'UBS Securities LLC', role: 'financial', patterns: [/\bubs\b/i] },
  { canonical: 'Deutsche Bank Securities Inc.', role: 'financial', patterns: [/deutsche\s+bank/i] },
  { canonical: 'Evercore Inc.', role: 'financial', patterns: [/evercore/i] },
  { canonical: 'Centerview Partners LLC', role: 'financial', patterns: [/centerview/i] },
  { canonical: 'Lazard Frères & Co. LLC', role: 'financial', patterns: [/lazard/i] },
  { canonical: 'Houlihan Lokey Capital, Inc.', role: 'financial', patterns: [/houlihan\s+lokey/i] },
  { canonical: 'Moelis & Company LLC', role: 'financial', patterns: [/moelis/i] },
  { canonical: 'PJT Partners LP', role: 'financial', patterns: [/\bpjt\s+partners\b/i] },
  { canonical: 'Guggenheim Securities, LLC', role: 'financial', patterns: [/guggenheim\s+securities/i] },
  { canonical: 'Qatalyst Partners LP', role: 'financial', patterns: [/qatalyst/i] },
  { canonical: 'Allen & Company LLC', role: 'financial', patterns: [/allen\s*&\s*company/i] },
  { canonical: 'Jefferies LLC', role: 'financial', patterns: [/jefferies/i] },
  { canonical: 'Perella Weinberg Partners LP', role: 'financial', patterns: [/perella\s+weinberg/i] },
];

// Anchor phrases that name the role of the firm in the deal. We use these
// to assign a party only when we see them in close proximity to the firm
// name (within ~150 characters).
const PARTY_ANCHORS = [
  // company / target side
  { re: /counsel\s+to\s+(?:the\s+)?(?:company|target|seller)/i, party: 'company' },
  { re: /(?:represented|advised|acted)\s+(?:by|for)\s+(?:the\s+)?(?:company|target|seller)/i, party: 'company' },
  { re: /financial\s+advisor[s]?\s+to\s+(?:the\s+)?(?:company|target|seller|board)/i, party: 'company' },
  { re: /serv\w+\s+as\s+(?:exclusive\s+)?financial\s+advisor\s+to\s+(?:the\s+)?(?:company|target|seller|board)/i, party: 'company' },

  // parent / buyer side
  { re: /counsel\s+to\s+(?:the\s+)?(?:parent|buyer|acqui|investor|purchaser)/i, party: 'parent' },
  { re: /(?:represented|advised|acted)\s+(?:by|for)\s+(?:the\s+)?(?:parent|buyer|acqui)/i, party: 'parent' },
  { re: /financial\s+advisor[s]?\s+to\s+(?:the\s+)?(?:parent|buyer|acqui)/i, party: 'parent' },

  // special committee
  { re: /special\s+committee/i, party: 'special_committee' },
  { re: /counsel\s+to\s+(?:the\s+)?special\s+committee/i, party: 'special_committee' },
];

// Likely partner-name pattern: "First [Middle] Last" with title-cased words,
// looking for a small set of explicit cue phrases ("Attention:", "Attn:",
// "Lead Counsel", "Partner — ", "with a copy to:"). We deliberately do NOT
// emit a partner name from a bare capitalized phrase in the signature
// block because false-positive risk is too high.
const PARTNER_CUE = /(?:attention|attn|lead\s+counsel|principal\s+contact|primary\s+contact)\s*:?\s*([A-Z][A-Za-z\.\-']{1,20}(?:\s+[A-Z][A-Za-z\.\-']{1,25}){1,3})/g;

// ---------------------------------------------------------------------------
// Helper: gather the regions of the agreement we scan for firm references.
// We use first 2000 chars (preamble) and last 4000 chars (signature block).
// ---------------------------------------------------------------------------

function getScanRegions(text) {
  if (typeof text !== 'string' || text.length === 0) return [];
  const head = text.slice(0, 2000);
  const tail = text.slice(Math.max(0, text.length - 4000));
  return [
    { name: 'preamble', text: head, offset: 0 },
    { name: 'signature_block', text: tail, offset: Math.max(0, text.length - 4000) },
  ];
}

// ---------------------------------------------------------------------------
// Helper: determine the closest party anchor within ±200 chars of a firm hit.
// Returns the party string or null.
// ---------------------------------------------------------------------------

function nearestParty(regionText, firmStart, firmEnd) {
  const windowStart = Math.max(0, firmStart - 200);
  const windowEnd = Math.min(regionText.length, firmEnd + 200);
  const slice = regionText.slice(windowStart, windowEnd);

  let bestParty = null;
  let bestDistance = Infinity;

  for (const anchor of PARTY_ANCHORS) {
    const localRe = new RegExp(anchor.re.source, anchor.re.flags);
    let m;
    while ((m = localRe.exec(slice)) !== null) {
      const absPos = windowStart + m.index;
      const distance = absPos < firmStart
        ? firmStart - (absPos + m[0].length)
        : absPos - firmEnd;
      const safeDist = Math.max(0, distance);
      if (safeDist < bestDistance) {
        bestDistance = safeDist;
        bestParty = anchor.party;
      }
      if (!localRe.global) break;
    }
  }

  return bestParty;
}

// ---------------------------------------------------------------------------
// Helper: pick a partner name from the region surrounding a firm hit.
// ---------------------------------------------------------------------------

function nearestPartner(regionText, firmStart, firmEnd) {
  const windowStart = Math.max(0, firmStart - 400);
  const windowEnd = Math.min(regionText.length, firmEnd + 400);
  const slice = regionText.slice(windowStart, windowEnd);

  let best = null;
  let bestDistance = Infinity;
  const reGlobal = new RegExp(PARTNER_CUE.source, 'g');
  let m;
  while ((m = reGlobal.exec(slice)) !== null) {
    const candidate = (m[1] || '').trim();
    if (!candidate || candidate.length < 4) continue;
    const absPos = windowStart + m.index;
    const distance = Math.abs(absPos - firmStart);
    if (distance < bestDistance) {
      bestDistance = distance;
      best = candidate;
    }
  }
  return best;
}

// ---------------------------------------------------------------------------
// Main export — extract advisors.
// ---------------------------------------------------------------------------

function extractAdvisors(fullText) {
  if (!fullText || typeof fullText !== 'string') return [];

  const regions = getScanRegions(fullText);
  // Dedup by (canonical, party).
  const seen = new Map();

  for (const region of regions) {
    for (const firm of FIRMS) {
      for (const pat of firm.patterns) {
        const re = new RegExp(pat.source, pat.flags.includes('g') ? pat.flags : (pat.flags + 'g'));
        let m;
        while ((m = re.exec(region.text)) !== null) {
          const firmStart = m.index;
          const firmEnd = firmStart + m[0].length;
          const party = nearestParty(region.text, firmStart, firmEnd);
          // Conservative: only emit if we have a confident party signal.
          // (Without a party, the entry isn't useful for cross-deal
          // comparison and risks polluting the deal record.)
          if (!party) continue;
          const partner = nearestPartner(region.text, firmStart, firmEnd);
          const key = `${firm.canonical}|${party}`;
          if (seen.has(key)) {
            // Prefer the entry that has a partner name; otherwise keep first.
            const existing = seen.get(key);
            if (!existing.partner && partner) {
              existing.partner = partner;
            }
            continue;
          }
          seen.set(key, {
            firm: firm.canonical,
            party,
            partner: partner || null,
            role: firm.role,
          });
        }
      }
    }
  }

  return Array.from(seen.values());
}

module.exports = {
  extractAdvisors,
  // Exposed for tests
  FIRMS,
  PARTY_ANCHORS,
};
