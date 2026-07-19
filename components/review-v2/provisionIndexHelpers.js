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

// Item 17 (r4): wires ProvisionTable summary rows to the same ClauseSidebar
// ProvisionIndex rows already open -- see components/review/ProvisionTable.jsx
// and pages/review/[id].js. Summary rows carry their source card under one of
// a few shapes depending on which table-configs helper built the row:
// card-utils.js's makeRows()/buildSectionSubjectResolver() set `sourceCard`
// (singular, an object), the nosol-*.config.js allFeatures()-based builders
// set `sourceCards` (plural array -- first element is the row's primary
// source), and GroupedSubRows children set `card` directly once threaded
// through by their owning config (see nosol-section.config.js's buildGroups).
export function cardKey(card) {
  return card ? String(card.id || card.provision_instance_id || '') : '';
}

// Index a section's own card list by id/provision_instance_id -- so a
// resolved row hands back the SAME object reference (or at least the same
// section's copy) ProvisionIndex/onSelectCard already operate on. Selection
// equality (`cur.id === card.id`) and the sidebar's own props don't require
// referential identity, but keying off the section's card list (rather than
// trusting whatever the row closed over) keeps resolution consistent with
// what's actually listed in "Provisions in this section".
export function buildCardIndex(cards) {
  const byId = new Map();
  for (const card of cards || []) {
    const key = cardKey(card);
    if (key) byId.set(key, card);
  }
  return byId;
}

// Resolves a ProvisionTable row to the card its ClauseSidebar should open
// for, or null when the row carries no identifiable source card (rows built
// purely from cross-card rollups/computed values with no single owning
// card must NOT become clickable -- see ProvisionTable.jsx's dead-cursor
// guard). cardsById is typically the section's own sectionCards, built via
// buildCardIndex() above.
export function resolveRowCard(row, cardsById) {
  if (!row) return null;
  const candidate = row.card || row.sourceCard || (Array.isArray(row.sourceCards) ? row.sourceCards[0] : null);
  if (!candidate) return null;
  const key = cardKey(candidate);
  if (!key) return null;
  if (cardsById && cardsById.has(key)) return cardsById.get(key);
  // Not indexed under this section's card list (shouldn't normally happen --
  // the row's source card comes from the same reviewDeal.cards the section
  // was grouped from) -- fall back to the candidate itself rather than
  // silently dropping the click affordance.
  return candidate;
}

// Sidebar feedback package (Ben, r5): row-scoped sidebar content. A row's
// own label/feature-key(s)/item-code/verbatim, when it carries any of them,
// so ClauseSidebar can render a focused "this row" section instead of
// showing every claim on the parent card. Row shapes vary a lot across
// table-configs (see resolveRowCard's doc comment above) -- this reads the
// handful of field names configs already use for a row's own display label
// and evidence text rather than requiring every config to adopt one shape:
//   - label: row.label (most configs) or row.instrument (equity-awards) or
//     row.term (legacy column contract)
//   - featureKeys: row.featureKeys (array) or row.featureKey (singular,
//     mae-definitions/antitrust/representations-qualifiers row shape)
//   - itemCode: row.itemCode, row.code, or row.instrumentCode
//   - quote: row.evidence when it's a non-empty string (already the
//     row-specific verbatim text convention -- see ProvisionTable.jsx's
//     fallbackEvidenceText) -- NOT row.value, which is often a coded label,
//     not clause prose.
//   - items: row.items, else row.acts (nosol-noshop prohibited acts), else
//     row.exceptionItems (nosol-noshop exceptions), normalized to
//     { label, itemCode, quote } -- sidebar redesign item 4 (progressive
//     drill-down): list-type row values carry their own children so
//     ClauseSidebar can render each as a clickable "drill in" item without
//     every table-config having to wire its own click handler per pill.
//     Plain-string items (legacy exceptionItems shape) get no itemCode/quote.
// Returns null when the row carries none of the above, so ClauseSidebar
// falls back to showing only the parent card (unchanged behaviour).
function normalizeRowItems(row) {
  const raw = row.items || row.acts || row.exceptionItems;
  if (!Array.isArray(raw) || !raw.length) return null;
  return raw
    .map((item) => {
      if (typeof item === 'string') return { label: item, itemCode: null, quote: null };
      if (!item || typeof item !== 'object') return null;
      const label = item.label || null;
      if (!label) return null;
      return {
        label,
        itemCode: item.code || item.itemCode || null,
        quote: (typeof item.evidence === 'string' && item.evidence.trim()) ? item.evidence.trim() : null,
      };
    })
    .filter(Boolean);
}

export function resolveRowFocus(row) {
  if (!row) return null;
  const label = row.label || row.instrument || row.term || null;
  const featureKeys = Array.isArray(row.featureKeys) && row.featureKeys.length
    ? row.featureKeys
    : (row.featureKey ? [row.featureKey] : null);
  const itemCode = row.itemCode || row.code || row.instrumentCode || null;
  const quote = (typeof row.evidence === 'string' && row.evidence.trim()) ? row.evidence.trim() : null;
  const items = normalizeRowItems(row);
  if (!label && !featureKeys && !itemCode && !quote && !items) return null;
  return { label, featureKeys, itemCode, quote, items };
}

// Pulls the row-specific verbatim quote(s) for a set of featureKeys off a
// card's claims-adapter-built `features` map (lib/queries/claims-adapter.js
// buildFeaturesForCard) -- tagged/object feature values carry a `.quotes`
// array (one evidence_quote per backing claim; see buildTaggedValue/
// buildObjectItemValue). List-valued features are arrays of such objects.
// Returns the first non-empty quote found across the given keys, or null.
export function cardFeatureQuote(card, featureKeys) {
  if (!card || !Array.isArray(featureKeys) || !featureKeys.length) return null;
  const features = (card.features && typeof card.features === 'object') ? card.features : {};
  for (const key of featureKeys) {
    const value = features[key];
    if (!value) continue;
    const items = Array.isArray(value) ? value : [value];
    for (const item of items) {
      const quotes = item && typeof item === 'object' && Array.isArray(item.quotes) ? item.quotes : null;
      const hit = quotes && quotes.find((q) => typeof q === 'string' && q.trim());
      if (hit) return hit.trim();
    }
  }
  return null;
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
