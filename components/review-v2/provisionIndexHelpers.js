// Plain-JS helpers for ProvisionIndex.jsx / DefinitionsSection (Item 16,
// round 3) -- split out of the .jsx file so they're directly unit-testable
// under node:test (this repo's test runner has no JSX loader; .jsx files
// can only be asserted against via source-text regex, see
// tests/review/provision-table-primitives.spec.js's convention).

// Item 16.1: fragment defined terms are ingestion junk -- mid-sentence/
// mid-phrase captures ("from", "to the extent", "made available", "under
// common control with", a lowercase "knowledge", Ben's reported stray
// "wise" (a fragment of "otherwise"/"likewise")) that render in the
// Definitions section/index as if they were real defined terms. Filtered
// defensively at render time (never deleted here -- see the dry-run
// scripts/cleanup-fragment-definitions.js for the data-side cleanup):
//   - defined_term starts lowercase (real defined terms are Capitalized or
//     ALL-CAPS by drafting convention), OR
//   - defined_term is (case-insensitively) a bare stopword/connector
//     phrase, OR
//   - defined_term is shorter than 3 characters.
// No allowlist for genuinely-lowercase terms of art yet -- add one here if
// Ben flags a real lowercase defined term this filter wrongly drops.
export const FRAGMENT_TERM_BLOCKLIST = new Set([
  'from', 'to the extent', 'made available', 'under common control with',
  'wise', 'likewise', 'otherwise',
]);

export function isFragmentDefinedTerm(term) {
  const t = String(term || '').trim();
  if (t.length < 3) return true;
  if (FRAGMENT_TERM_BLOCKLIST.has(t.toLowerCase())) return true;
  if (/^[a-z]/.test(t)) return true;
  return false;
}

// Item 16.2: dedupe the per-section provision index by (section_ref
// number, short_title) -- ingestion sometimes stores TWO cards for the
// same provision (Theravance: two 6.1 "Information to Regulators" cards).
// Keep the card with the LONGER captured text; a render-time dedupe over
// stored duplicate rows, not a data delete.
export function sectionRefNumber(ref) {
  return String(ref || '').split('|')[0].trim();
}

export function dedupeBySectionAndTitle(cards) {
  const byKey = new Map();
  for (const card of cards || []) {
    const title = String(card?.short_title || '').trim().toLowerCase();
    // No short_title (e.g. a defined-term-only entry) -- key on the card's
    // own id so it's never merged with an unrelated sibling that also has
    // no title.
    const key = title ? `${sectionRefNumber(card.section_ref)}|${title}` : `id|${card?.id || card?.provision_instance_id}`;
    const existing = byKey.get(key);
    if (!existing) {
      byKey.set(key, card);
      continue;
    }
    const existingLen = (existing.region_full_text || existing.primary_quote || '').length;
    const candidateLen = (card.region_full_text || card.primary_quote || '').length;
    if (candidateLen > existingLen) byKey.set(key, card);
  }
  return [...byKey.values()];
}
