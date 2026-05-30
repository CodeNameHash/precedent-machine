/**
 * section-ref.js — Cross-reference resolver for section references.
 *
 * Parses "Section 8.01(b)(i)" / "§8.01(c)" / "Article VIII" style references
 * and resolves them against a list of provisions. Returns a clickable label
 * + provision pair when a match is found.
 *
 * Pure JS (no React) so it can be consumed from both the rubric/render layer
 * and unit tests.
 */

// Matches: "§8.01", "Section 8.01", "Section 8.01(b)", "Section 8.01(b)(i)",
// "Article VIII", "Article 8". The CAPTURE GROUPS are:
//   1: bare number (e.g. "8.01") OR roman/number for article
//   2: subclause chain (e.g. "(b)(i)") — optional
const SECTION_REF_RE = /(?:§\s?|Section\s+|Sections?\s+)(\d+(?:\.\d+)*[A-Za-z]?)((?:\([A-Za-z0-9]+\))*)/i;
const ARTICLE_REF_RE = /Article\s+([IVXLCDM]+|\d+)/i;

/**
 * Parse a section-reference string into structured parts.
 *
 * @param {string} ref — input like "Section 8.01(b)(i)" or "§8.01"
 * @returns {{ kind: 'section'|'article'|null, sectionNumber: string|null, subclauses: string[], raw: string } | null}
 */
function parseSectionReference(ref) {
  if (!ref || typeof ref !== 'string') return null;
  const trimmed = ref.trim();
  if (!trimmed) return null;

  const sectionMatch = SECTION_REF_RE.exec(trimmed);
  if (sectionMatch) {
    const sectionNumber = sectionMatch[1] || null;
    const subclauseChain = sectionMatch[2] || '';
    const subclauses = subclauseChain
      ? Array.from(subclauseChain.matchAll(/\(([A-Za-z0-9]+)\)/g)).map((m) => m[1])
      : [];
    return { kind: 'section', sectionNumber, subclauses, raw: trimmed };
  }

  const articleMatch = ARTICLE_REF_RE.exec(trimmed);
  if (articleMatch) {
    return {
      kind: 'article',
      sectionNumber: articleMatch[1] || null,
      subclauses: [],
      raw: trimmed,
    };
  }

  return null;
}

/**
 * Pull a normalized section number off a provision. Tries several common
 * field names that the parser / structural layer use.
 */
function provisionSectionNumber(p) {
  if (!p) return null;
  const cand = p.section_number
    || p.sectionNumber
    || (p.features && (p.features.sectionNumber || p.features.section_number))
    || null;
  if (cand) return String(cand).trim();
  // Fall back to extracting from the category string (e.g. "Section 8.01 — Termination").
  const cat = String(p.category || '');
  const m = SECTION_REF_RE.exec(cat);
  if (m) return m[1];
  return null;
}

/**
 * Resolve a section reference against a provisions array. Returns the
 * matched provision + a friendly label (e.g. "§8.01(b)(i) [Outside Date]")
 * when found, or null when no provision matches.
 *
 * @param {string} sectionRef — input like "Section 8.01(b)(i)"
 * @param {Array<Object>} allProvisions — list of provisions to search
 * @returns {{ provision: Object|null, label: string, parsed: Object|null }}
 */
function resolveSectionReference(sectionRef, allProvisions) {
  const parsed = parseSectionReference(sectionRef);
  if (!parsed) return { provision: null, label: sectionRef || '', parsed: null };

  if (!Array.isArray(allProvisions) || allProvisions.length === 0) {
    return { provision: null, label: sectionRef, parsed };
  }

  // Try exact section-number match.
  let match = null;
  if (parsed.sectionNumber) {
    match = allProvisions.find((p) => {
      const s = provisionSectionNumber(p);
      return s && s === parsed.sectionNumber;
    });
    // Bare-number variant: rep section "3.05(a)" should match tier "3.05".
    if (!match) {
      match = allProvisions.find((p) => {
        const s = provisionSectionNumber(p);
        if (!s) return false;
        const bare = s.replace(/\([A-Za-z0-9]+\)$/i, '');
        return bare === parsed.sectionNumber;
      });
    }
  }

  // Build a friendly label: "§N.NN [category]" — category truncated.
  let label = '';
  if (parsed.kind === 'section') {
    const subclauseChain = (parsed.subclauses || []).map((s) => `(${s})`).join('');
    label = `§${parsed.sectionNumber || '?'}${subclauseChain}`;
  } else if (parsed.kind === 'article') {
    label = `Article ${parsed.sectionNumber || '?'}`;
  } else {
    label = parsed.raw;
  }

  if (match) {
    const cat = String(match.category || '').trim();
    if (cat) {
      const short = cat.length > 60 ? cat.slice(0, 57) + '…' : cat;
      label = `${label} [${short}]`;
    }
  }

  return { provision: match || null, label, parsed };
}

module.exports = {
  parseSectionReference,
  resolveSectionReference,
  provisionSectionNumber,
};
