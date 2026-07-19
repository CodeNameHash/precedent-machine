// Q1/Q2 (perf quick-wins): /api/review/[id]/cards.js no longer ships
// reviewDeal.sections / reviewDeal.definitions (a verbatim duplicate of
// cards[], ~45% of the wire payload) or per-card resolvedReferences /
// unresolvedReferences (also derivable from cards[].references + the
// definitions map). This module rebuilds sections/definitions client-side
// from the trimmed cards[] array — mirroring lib/queries/review-deal.js's
// groupRowsBySection logic exactly so the reconstructed shape is
// indistinguishable from the old wire payload.
//
// Used by every consumer of the cards API response: pages/review/[id].js,
// pages/review-v1/[id].js, and (defensively) ProvisionCardTable.jsx for any
// caller that hands it a raw/partial reviewDeal.
//
// PERF REGRESSION FIX (Jul 2026, post-review): reconstructReviewDeal used to
// ALSO eagerly compute resolvedReferences/unresolvedReferences for every
// card here, synchronously, before the fetch .then() resolved — i.e. before
// ANY row could paint. On Cox (626 cards / 443 definitions, definition-
// heavy deal) that eager pass measured 13.9s to DOMContentLoaded / 15.9s to
// 100+ rows on a prod build (vs ~2-3s before this package), because
// projectDefinitionReference copies each resolved definition's
// defined_value/primary_quote text, and cross-reference cards citing
// several large MAE-style definitions multiplied that copy cost across
// hundreds of cards — all on the critical path to first paint, for a field
// (resolvedReferences) that's ONLY consumed by one hover-preview component
// (components/review/ProvisionCardTable.jsx's DefinitionPreview) which
// itself only renders in review-v1's editor mode. Neither
// pages/review/[id].js (production) nor review-v1's default reviewer view
// ever reads card.resolvedReferences.
//
// Fix: reconstructReviewDeal here does ONLY the O(n) work every render
// needs (section/definition grouping, the region_full_text fallback).
// resolvedReferences is no longer attached eagerly at all — see
// buildDefinitionsIndex()/resolveCardReferences() below, which
// ProvisionCardTable.jsx now calls on demand (idle-chunked prewarm + hover-
// time fallback, see components/review/useDefinitionResolver.js) instead of
// this module computing it for every card up front.

function isPlainObject(value) {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

// Mirrors lib/queries/review-deal.js#projectReference — keep in sync. Only
// the five fields DefinitionPreview / hover-preview components read.
function projectDefinitionReference(def) {
  return {
    provision_instance_id: def.provision_instance_id,
    defined_term: def.defined_term,
    short_title: def.short_title,
    defined_value: def.defined_value,
    primary_quote: def.primary_quote,
  };
}

// Q2: region_full_text is omitted from the wire whenever it's byte-identical
// to primary_quote (the common case). Alias it back client-side so every
// consumer that reads card.region_full_text (source-span resolution,
// card-model invariants) keeps working unchanged. If the server DID include
// region_full_text (the defensive divergence path), it wins. O(1) per card
// — cheap, kept on the eager/synchronous path.
function withRegionFullTextFallback(card) {
  const region_full_text = typeof card.region_full_text === 'string'
    ? card.region_full_text
    : card.primary_quote;
  return region_full_text === card.region_full_text ? card : { ...card, region_full_text };
}

// O(n): a Map from a definition card's provision_instance_id to the card
// itself. Reference resolution against this Map is O(1) per reference — NOT
// a per-reference scan of all definitions — so resolveCardReferences() below
// is O(references-on-this-card), independent of how many definitions exist
// in the deal.
function buildDefinitionsIndex(cards) {
  const definitionsById = new Map();
  for (const card of cards) {
    if (card && card.kind === 'definition') definitionsById.set(card.provision_instance_id, card);
  }
  return definitionsById;
}

// Resolve ONE card's references against a prebuilt definitions index.
// O(references-on-this-card) — safe to call synchronously on demand (hover,
// or a single slice of an idle-chunked sweep) without touching every other
// card in the deal.
function resolveCardReferences(card, definitionsById) {
  const references = Array.isArray(card && card.references) ? card.references : [];
  const resolvedReferences = [];
  const unresolvedReferences = [];
  for (const id of references) {
    const def = definitionsById.get(id);
    if (def) resolvedReferences.push(projectDefinitionReference(def));
    else unresolvedReferences.push(id);
  }
  return { resolvedReferences, unresolvedReferences };
}

// Mirrors lib/queries/review-deal.js#groupRowsBySection. Cards arrive
// pre-sorted from the server, so this is a straight group-by-insertion-order
// (no re-sort needed, but harmless if callers pass unsorted cards — order
// within a section follows input order). O(n).
function groupCardsBySectionRef(cards) {
  const groups = new Map();
  for (const card of cards) {
    const sectionRef = card.section_ref || 'Unspecified';
    if (!groups.has(sectionRef)) {
      groups.set(sectionRef, { sectionRef, title: sectionRef, cards: [] });
    }
    groups.get(sectionRef).cards.push(card);
  }
  return [...groups.values()];
}

// Rebuild {cards, definitions, sections} from a trimmed reviewDeal payload
// ({ dealId, cardCount, cards }). O(n) total — NO per-card reference
// resolution (see the module header comment). Idempotent: if sections/
// definitions are already present (e.g. an internal caller that used
// shapeReviewDealRows directly), they're left untouched.
function reconstructReviewDeal(reviewDeal) {
  if (!reviewDeal || !Array.isArray(reviewDeal.cards)) return reviewDeal;
  if (Array.isArray(reviewDeal.sections) && Array.isArray(reviewDeal.definitions)) {
    return reviewDeal;
  }

  const cards = reviewDeal.cards.map(withRegionFullTextFallback);
  const definitions = cards.filter((card) => card.kind === 'definition');
  const sections = groupCardsBySectionRef(cards);

  return {
    ...reviewDeal,
    cards,
    definitions,
    sections,
  };
}

module.exports = {
  isPlainObject,
  projectDefinitionReference,
  withRegionFullTextFallback,
  buildDefinitionsIndex,
  resolveCardReferences,
  groupCardsBySectionRef,
  reconstructReviewDeal,
};
