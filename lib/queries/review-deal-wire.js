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
  // r13 ("% of deal value" feature): the deal's equity value at
  // announcement, attached by fetchReviewDealCards (lib/queries/review-deal.js)
  // so table configs (e.g. termination-fees.config.js) can compute a % of
  // deal value next to each fee amount without a second round-trip. null
  // when the deal has no recorded value_usd — omit rather than ship an
  // explicit null key only when the source field is entirely absent, so a
  // deliberate null (no value on file) still reaches the client as null.
  if (Object.prototype.hasOwnProperty.call(reviewDeal, 'value_usd')) out.value_usd = reviewDeal.value_usd;
  // Canonical V2 dark-bridge preview (lib/canonical-v2/review-preview-
  // assembly.js): the server-stamped rendering hint components/review/
  // table-configs/canonical-v2-preview-lane.js's isCanonicalV2PreviewEnabled()
  // reads off the wire payload. Absent whenever the preview wasn't attached
  // (gate off, or no reviewDeal.canonical_v2_preview_enabled at all) — this
  // allowlist would otherwise silently drop it, leaving the gate stamped
  // server-side but invisible to the client that needs to read it.
  if (Object.prototype.hasOwnProperty.call(reviewDeal, 'canonical_v2_preview_enabled')) {
    out.canonical_v2_preview_enabled = reviewDeal.canonical_v2_preview_enabled;
  }
  // Per-family serving switch, termination fees (lib/canonical-v2/termination-
  // fee-serving-source.js): the server-stamped boolean the client-side switch
  // in components/review/table-configs/termination-fees.config.js reads, plus
  // the deal's canonical termination-fee cards. Both are absent whenever the
  // switch is off, so this allowlist keeps the payload byte-identical to a
  // build that never had the switch.
  //
  // The cards travel on their OWN field and are deliberately NOT folded into
  // cards[]: a canonical TERMF card sitting beside a legacy one is what makes
  // combineTermfFeatures() produce an order-dependent hybrid fee row. They are
  // trimmed like any other card so the wire shape stays consistent.
  if (Object.prototype.hasOwnProperty.call(reviewDeal, 'canonical_v2_termination_fee_serving_enabled')) {
    out.canonical_v2_termination_fee_serving_enabled = reviewDeal.canonical_v2_termination_fee_serving_enabled;
  }
  // Fourth mode (both sources rendered side by side). Own field, present only
  // when that mode's own env sentinel is set, so a payload without it stays
  // byte-identical to what the three single-source modes already carry.
  if (Object.prototype.hasOwnProperty.call(reviewDeal, 'canonical_v2_termination_fee_compare_enabled')) {
    out.canonical_v2_termination_fee_compare_enabled = reviewDeal.canonical_v2_termination_fee_compare_enabled;
  }
  if (Object.prototype.hasOwnProperty.call(reviewDeal, 'canonical_v2_termination_fee_cards')) {
    const canonicalCards = reviewDeal.canonical_v2_termination_fee_cards;
    out.canonical_v2_termination_fee_cards = Array.isArray(canonicalCards)
      ? canonicalCards.map(trimCardForWire)
      : canonicalCards;
  }
  // The outcome that produced canonical_v2_termination_fee_cards above (see
  // lib/canonical-v2/termination-fee-serving-source.js's TERMINATION_FEE_SOURCE_STATE):
  // NOT_REGISTERED / ATTACHED / FAILED. Without this allowlist entry the
  // server-stamped distinction between "no canonical data for this deal" and
  // "canonical data exists but could not be read or verified" would be
  // computed correctly and then silently dropped before it ever reached the
  // client that needs to render the difference -- the exact shape of bug
  // this allowlist already exists to prevent (see the
  // canonical_v2_preview_enabled comment above).
  if (Object.prototype.hasOwnProperty.call(reviewDeal, 'canonical_v2_termination_fee_source_status')) {
    out.canonical_v2_termination_fee_source_status = reviewDeal.canonical_v2_termination_fee_source_status;
  }
  return out;
}

module.exports = { trimCardForWire, trimReviewDealForWire };
