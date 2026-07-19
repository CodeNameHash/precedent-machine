// Q1/Q2 (perf quick-wins): /api/review/[id]/cards.js no longer ships
// reviewDeal.sections / reviewDeal.definitions (a verbatim duplicate of
// cards[], ~45% of the wire payload) or per-card resolvedReferences /
// unresolvedReferences (also derivable from cards[].references + the
// definitions map). This module rebuilds all four, client-side, from the
// trimmed cards[] array — mirroring lib/queries/review-deal.js's
// groupRowsBySection / normalizeCard logic exactly so the reconstructed
// shape is indistinguishable from the old wire payload.
//
// Used by every consumer of the cards API response: pages/review/[id].js,
// pages/review-v1/[id].js, and (defensively) ProvisionCardTable.jsx for any
// caller that hands it a raw/partial reviewDeal.

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
// region_full_text (the defensive divergence path), it wins.
function enrichCard(card, definitionsById) {
  const references = Array.isArray(card.references) ? card.references : [];
  const resolvedReferences = references
    .map((id) => definitionsById.get(id))
    .filter(Boolean)
    .map(projectDefinitionReference);
  const unresolvedReferences = references.filter((id) => !definitionsById.has(id));
  const region_full_text = typeof card.region_full_text === 'string'
    ? card.region_full_text
    : card.primary_quote;
  return {
    ...card,
    region_full_text,
    resolvedReferences,
    unresolvedReferences,
  };
}

// Mirrors lib/queries/review-deal.js#groupRowsBySection. Cards arrive
// pre-sorted from the server, so this is a straight group-by-insertion-order
// (no re-sort needed, but harmless if callers pass unsorted cards — order
// within a section follows input order).
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
// ({ dealId, cardCount, cards }). Idempotent: if sections/definitions are
// already present (e.g. an internal caller that used shapeReviewDealRows
// directly), they're left untouched.
function reconstructReviewDeal(reviewDeal) {
  if (!reviewDeal || !Array.isArray(reviewDeal.cards)) return reviewDeal;
  if (Array.isArray(reviewDeal.sections) && Array.isArray(reviewDeal.definitions)) {
    return reviewDeal;
  }

  const definitionsById = new Map(
    reviewDeal.cards
      .filter((card) => card && card.kind === 'definition')
      .map((card) => [card.provision_instance_id, card]),
  );
  const cards = reviewDeal.cards.map((card) => enrichCard(card, definitionsById));
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
  enrichCard,
  groupCardsBySectionRef,
  reconstructReviewDeal,
};
