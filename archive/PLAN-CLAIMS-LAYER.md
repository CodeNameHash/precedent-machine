# PLAN — Claims Layer Realization

**One page. This is the fix for the gutted review page AND the query/compare substrate. It implements the Claim node from `docs/schema-shape/provision-taxonomy-triple-model.md` that was designed all along and deferred to Phase 0.5.**

---

## Diagnosis (what happened)

Fable's design is a **Claim model**: `Deal → Section → Provision → Excerpt → Claim`, where a Claim = `(Attribute, Verbatim, Canonical, Provenance)`. The Claim is the atomic, queryable fact. The design is sound; Ben endorses it.

The claims exist. Extraction + normalisation + reconciliation ran and produced **71,576 claim triples**, persisted to `docs/schema-shape/normalized-v1.json` (Stage 7 of the processing flow) and denormalised into `provisions.ai_metadata.features`.

**The mistake:** when M2 built the schema-first render table (`provision_cards`), it materialised `Section → Provision → Excerpt` in Postgres and **stopped one level short of the Claim.** The card writer (`store-cards.js:66`) reads the feature bag only to derive a title/party/section, then discards it. `provision_cards` has no `features` column and there is no `claims` table. The render (`review-deal.js`) reads only `provision_cards`, so it renders Provisions and Excerpts with their Claims stripped off → empty tables, vanished sections (MAE etc.), missing intervening-event days.

**This is not a new schema change — it is finally persisting the Claim node the taxonomy always specified** (gaps G1/G2/G4/G11 in `provision-processing-flow.md` are the known-deferred pieces).

---

## Source of truth for the backfill

- **Use `normalized-v1.json` triples.** 71,576 triples, reconciled (`recoded_from`/`recoded_at`), generated 2026-07-07.
- **Do NOT use `provisions.ai_metadata.features`** — raw, pre-reconciliation (created 2026-07-06); backfilling from it drops the reconciliation.
- **Preflight (Phase 0):** confirm `normalized-v1.json` is the freshest reconciled snapshot. `provisions` max `created_at` = 2026-07-06 and no reprocessing has written claims since 2026-07-07T10:35, so it is current — but regenerate via `snapshot.js` from the live DB if any reprocess ran after that, and confirm all 40 deals are covered.

## Faithful materialisation — NOT forcing data into the schema

The backfill must not undercut the model. Principles:

1. **Preserve Verbatim exactly** — copy `raw_value` / `evidence_quote` byte-for-byte. No normalisation at backfill time.
2. **Canonical is nullable; never fabricate it.** Where `canonicalKey` is null (unresolved by the normaliser), write null. Do not invent a canonical to fill the column — that would corrupt the closed vocabulary. Unresolved claims are surfaced to the existing `/admin/schema-loss` audit, not silently coerced.
3. **Registry-gate the Attribute.** Only materialise claims whose `field_key` is a known Attribute (in `normalized-v1.json` `entries` / `lib/schema/features.js`, 695 entries). Route unknown attributes to the reconciliation/schema-loss queue — do not coerce them into the table.
4. **Preserve Provenance and reconciliation history** — carry `extractor_id`, `extracted_at`, provision `code`, `recoded_from`/`recoded_at` into a `provenance` JSONB.
5. **Idempotent** — upsert keyed on the triple `id`, so re-runs are safe.

This is materialising claims that already exist into the table the design intended — not reshaping or inventing.

---

## Identity anchoring — claims must attach to the STABLE key (load-bearing)

`provisions.id` is `gen_random_uuid()` and the ingest write path is **delete-then-reinsert per deal** (`store.js`), so every re-ingest mints new UUIDs for the same clauses. It was never designed to be stable — it's a v1 surrogate-key default from when the table was just an extraction dump. That's the exact liability G1/G2 named, and it's why `provision_cards` added a **deterministic** `provision_instance_id` = hash(deal, section, text) plus `excerpt_id`.

Consequence for this plan: the triples reference `source_provision_id` = the **unstable** `provisions.id`. If claims anchor to that, a single re-ingest orphans every claim. **Claims must anchor to the stable card identity** (`excerpt_id` / `provision_instance_id`), not the raw UUID.

- **The anchor is `provision_cards.excerpt_id`** (the deterministic Excerpt identity), NOT `region_id`. Phase 0-1 investigation found `provisions.region_id` is NULL on 98.7% of rows, so the region_id chain is dead; `region_id` is demoted to a nullable convenience pointer (byte-offset joins only), never an identity. Keep `source_provision_id` on the claim row as lineage only, never as the anchor.
- Backfill resolves `excerpt_id` via the validated fallback: `triple.source_provision_id → provisions.full_text (trimmed) → provision_cards.region_full_text (exact, deal-scoped) → excerpt_id` — 98.74% resolution, zero ambiguity across all 40 deals. The ~1.26% orphans (recital/DEF fragments never carded) route to `/admin/schema-loss`, not silently dropped.
- **`evidence_quote` is a first-class column** on `claims` (not buried in provenance): the render (`lib/citable.js`, `ProvisionTablePrimitives.jsx`) reads it on every claim for the hover citation + document highlighter; present on 100% of triples. `verbatim` = `raw_value` (the atomic value); `evidence_quote` = the supporting source span. Distinct, both load-bearing.
- This is also *why* claims route through cards rather than reading `provisions` directly: cards carry the only durable anchor (`excerpt_id`).

## The plan (phases; each delegatable, main-agent reviews)

### Phase 0 — Confirm source (verify)
- Confirm `normalized-v1.json` freshness + 40-deal coverage; regenerate the snapshot from live DB if any post-2026-07-07 reprocess touched claims.
- Report: triples per deal, % with non-null `canonicalKey`, count of unresolved (feeds Phase 2 flagging).

### Phase 1 — `claims` table (implements the designed Claim node)
- New table `claims`: `id` (triple id / deterministic hash), `deal_id`, `provision_id` (= triple `source_provision_id` → `provisions.id`), `region_id` (join key to cards; both `provisions` and `provision_cards` carry `region_id`), `attribute` (`field_key`), `verbatim`, `canonical` (nullable), `provenance` JSONB, `created_at`.
- Indexes: `(deal_id)`, `(attribute)`, `(attribute, canonical)`, `(provision_id)`, `(region_id)` — the cross-deal query indexes.
- Establish the **claim↔card join key**: `region_id` is the cleanest (present on both). Confirm 1:1/1:N maps hold; document any mismatches.
- Additive migration; no change to existing tables.

### Phase 2 — Backfill `claims` from `normalized-v1.json`
- Script maps 71,576 triples → claim rows under the faithful-materialisation principles above.
- Report: rows written, canonical-resolved %, unresolved list (to schema-loss), registry-unknown attributes (to reconciliation queue), per-deal coverage.

### Phase 3 — Wire the render to read claims
- Extend `lib/queries/review-deal.js` to join `claims` onto each card **by `excerpt_id`** (NOT region_id) and attach them in the shape the configs expect (`card.features` / a claims array).
- Adapter rebuilds the citable shape `{ value: canonical ?? verbatim, quotes: [evidence_quote] }` from the claim columns, so `lib/citable.js` / `ProvisionTablePrimitives.jsx` / the table-configs light up **without rewrites**.
- `compensationItems` (object-valued, 1 field) is special-cased by the adapter; full object preserved in `provenance.feature_value`.
- Verify live on localhost against Chevron: MAE section returns, intervening-event `noticePeriod`/match-period rows return, signal pills populate. Diff row counts vs the old (pre-schema) render — target parity or better.

### Phase 4 — Wire the ingest/store path to write claims (M3 alignment)
- The claim writer that Phase 2 uses becomes part of `store.js` / the ingest persist stage, so **every new ingest populates `claims`** — fresh deals render identically, not just the backfilled 40. This is what makes M3's "fresh ingest renders identically" true at the Claim level.

### Phase 5 — Reingest / structural-validation pass (extends M3 `WP-M3-05`)
- Run the end-to-end ingest smoke (Metsera golden fixture) → assert it produces `claims`, renders identically, and the ingest QA harness checks claim population (fail on regression).
- Cross-deal query sanity: run a sample benchmark query (e.g. `effortsStandard` canonical distribution across 40 deals) directly against `claims` — proves the query/compare substrate works.

### Phase 7 — Metsera parity gate (ACCEPTANCE — do not call this done without it)

The finalized review page must render **at least everything the pre-schema (legacy) page did**, and ideally more (the claims layer + schema augmentations should make it richer, not just equal). Reference deal: **Metsera** (Ben's golden fixture).

- Pull the pre-schema legacy render of Metsera (an old production deployment before WP-M2-00, same technique used for the Chevron old/new comparison) and the finalized new page side by side.
- Field-by-field, per family: confirm nothing the legacy page showed is missing from the new page. Any gap → fix (render or backfill) before sign-off.
- Enumerate the *additions* the new page brings (canonical pills, thresholds, coverage, hover-source, cross-deal-comparable claims) so the "better, not just equal" claim is evidenced, not asserted.
- Extend the same check to 2-3 other deals to catch family-specific gaps Metsera doesn't exercise.
- Output a parity report: legacy signal → new-page location (or "intentionally dropped, why"), plus the additions list. Zero unexplained drops = gate passes.

### Phase 6 — Query surface (M4 payoff)
- `/query` and market-distance analysis now have their substrate: the normalised, canonical, indexed `claims` table. M4 builds on this.

---

## Sequencing vs current work

- Phases 1–3 are the critical path to **un-gut the review page**. They supersede the interim "features JSONB on cards" shortcut — do not build that; go straight to the claims table (same transform, right end state).
- Phase A shell-restore branch (`wp/review-shell-restore`) stays — it fixes the accordion/nav/hero shell and is orthogonal to the data layer. Merge after Phase 3 so the restored shell renders full claims.
- Phase 4–5 fold into M3. Phase 6 is M4.

## Post-review additions (2026-07-08, main-agent adversarial review)

Four findings from reviewing the Phase 0–2 output. First three are corrections/gaps; fourth is an opportunity. All fanned out to agents.

1. **Phase 3 is a re-aggregation, not a flat join (the crux).** Claims are one-row-per-triple, but **56 attributes are list-valued** and heavily multi-triple (`carveouts` ~651 rows, `bringDownTiers` 236, `changeOfRecommendationItems` 129). A naive `features[attr] = oneClaim.value` collapses every list family (MAE carve-outs, material-contract buckets, bring-down tiers) to one item. The Phase 3 adapter MUST group claims by `(excerpt_id, attribute)` and rebuild each value **per the registry `valueType`** (scalar/enum/list/object), emitting the tagged `{code, value, text, quotes}` shape the configs' `readableValue()` already consumes. Verify per-family on localhost; MAE carve-outs is the list acceptance test. → `wp/claims-render-adapter`.

2. **Re-ingest silently destroys claims (correctness bug).** `store-cards.js:255` does `delete().eq('deal_id')` then upsert; with `claims.excerpt_id … ON DELETE CASCADE`, every re-ingest cascade-wipes that deal's claims before rebuilding cards. Fix: `store-cards` must **upsert-then-delete-orphans** (survivors keep their `provision_instance_id` row → no cascade), and the ingest path must (re)write claims atomically. Must land before M3 re-ingests anything. → `wp/claims-reingest-safety`.

3. **System-of-record decision (made): the `claims` table is the SoR.** `normalized-v1.json` retires to a one-time seed + archive. Reconciliation, `/admin/schema-loss`, `/admin/taxonomy`, and the persist stage migrate to read/write the table, or they drift — the same dual-write bug we're fixing. Scoping WP maps the consumers. → SoR scoping agent.

4. **Canonical enrichment opportunity.** Only ~14% of claims carry any canonical, but many null-`canonicalKey` rows have an extraction enum in `feature_value.value` that a normaliser pass could promote to `canonical` where it matches a closed vocab (never fabricate; free-text stays null). This is the cheapest lever for the cross-deal query/compare goal. → normalizer-lift investigation.

## Open items for the spec
- Confirm `region_id` is a clean claim↔card join key across all 40 deals (Phase 1); fall back to `source_provision_id → provisions → card` mapping if not.
- Decide canonical column semantics where `canonicalKey` is null but `ai_metadata.feature_value.value` holds an extraction-time code — preserve both (canonical = reconciled `canonicalKey`; keep the extraction value in provenance), never merge.
