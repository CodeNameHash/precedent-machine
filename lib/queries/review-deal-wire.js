// Q1/Q2 (perf quick-wins, Jul 2026): the shaping logic that trims a
// shapeReviewDealRows() result down to what /api/review/[id]/cards.js
// actually ships over the wire. Split out of the API route so it's
// require()-able from plain node:test (route files use ESM `import`, which
// plain `node --test` can't load directly) and so the trimming logic has
// exactly one implementation shared by the route and its tests.
//
// See lib/queries/reconstruct-review-deal.js for the client-side inverse.

// reviewDeal.sections[] and .definitions[] are a verbatim regrouping of
// reviewDeal.cards[] (~45% of the wire payload on Metsera/Cox-scale deals).
// The client rebuilds both from cards[] — never ship them over this route.
//
// Per-card trims (all verified redundant-or-derivable):
//   - region_full_text is byte-identical to primary_quote on every card
//     checked. Omit it UNLESS a given card actually diverges (defensive
//     check) — divergence, if it ever happens, still ships correctly
//     instead of silently corrupting the source-overlay span resolution.
//   - resolvedReferences/unresolvedReferences are rebuilt client-side from
//     references[] + the definitions map (also reconstructed client-side).
//   - provenance is trimmed to the two fields the client actually reads
//     off the wire (source-span offsets); the rest (extractor metadata,
//     prompt hashes, run ids) is admin/debug-only and never rendered here.
function trimCardForWire(card) {
  const {
    region_full_text,
    resolvedReferences,
    unresolvedReferences,
    provenance,
    ...rest
  } = card;

  const diverges = typeof region_full_text === 'string'
    && typeof card.primary_quote === 'string'
    && region_full_text !== card.primary_quote;

  const trimmedProvenance = provenance && typeof provenance === 'object'
    ? {
      source_doc_offset_start: provenance.source_doc_offset_start,
      source_doc_offset_end: provenance.source_doc_offset_end,
    }
    : provenance;

  const out = { ...rest, provenance: trimmedProvenance };
  if (diverges) out.region_full_text = region_full_text;
  return out;
}

function trimReviewDealForWire(reviewDeal) {
  if (!reviewDeal) return reviewDeal;
  const cards = Array.isArray(reviewDeal.cards) ? reviewDeal.cards.map(trimCardForWire) : reviewDeal.cards;
  const out = {
    dealId: reviewDeal.dealId,
    cardCount: reviewDeal.cardCount,
    cards,
  };
  // FIX 9 (merged from origin/main after this trimming was written):
  // fetchReviewDealCards also returns reviewDeal.transactionSteps (one row
  // per merger-topology step) — components/review/table-configs/
  // structure-mechanics.config.js reads it to render multi-step mergers
  // (e.g. SkyWater/IonQ's two-step reverse-triangular-then-forward
  // structure) that a single mergerForm claim can't fully describe. This
  // trimming function's allowlist would otherwise silently drop it off the
  // wire — pass it through unchanged (it's small, one row per step, not a
  // payload-size concern).
  if (Array.isArray(reviewDeal.transactionSteps)) out.transactionSteps = reviewDeal.transactionSteps;
  return out;
}

module.exports = { trimCardForWire, trimReviewDealForWire };
