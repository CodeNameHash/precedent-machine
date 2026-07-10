# Precedent Machine — PLAN (what's TO DO)

**One page. Only open work. Done work is deleted, not archived here.**

Goal: **Demo Bar** — all 40 deals render from the schema-first path with scale-safe
canonical output (same legal language, same result on every deal), query works, a
fresh deal ingests seamlessly, UI homogenized end-to-end.

How we work: Fable (main agent) specs, audits, reviews; production runs on
Codex/Sonnet with acceptance criteria written first; mechanical changes ship to
`main` on green (`npm test` + `npm run build`); canonical-vocab and extraction
changes are Fable-authored and gated by golden eval + ingest-QA + quote
verification, reprocessed per-type (`scripts/reprocess.js`), not full re-ingest.
Frozen files (Phase-0-C @ `1ea062d`) stay frozen. Never push to `main` without Ben.

Design source of truth: `docs/schema-shape/provision-taxonomy-triple-model.md` (§ 8
canonical-coding model) and `docs/schema-shape/provision-processing-flow.md` (§ 7
pipeline, § 4 gaps). Process audit: canonical-coding audit, 2026-07-10.

---

## Status — what's proven

The canonical-coding loop (concept → code → render) is proven end-to-end on **Metsera**:
rubric `list-tagged`/`tagged` flag → registry regen → prompt embeds codebook →
extraction assigns `{code,label,text}` → claims materialize → `labelForCode` renders
a canonical pill (transition-safe fallback to prior text). Five Section-B families are
wired: `interestRateBasis`, `SOLICITATION_ACT` (shared by `ceaseDiscussionsProhibitedList`
+ `changeOfRecommendationItems`), `superiorProposalDeterminer`, `governingLaw`,
`parentAssignmentConditions`. Taxonomy + extraction are sound. The pipeline has a
materialization gap that blocks corpus scale-up.

---

## 1. CRITICAL PATH — un-block the corpus (audit GAP-A/B/C)

Do NOT run `reprocess.js --all` until step 1.1 exists and is proven on ≥3 deals.

**1.1 Build the claims-only rematerialize (GAP-A + GAP-B).** `scripts/reprocess.js`
writes PROVISIONS only (`ai_metadata.features` gets codes); it never calls the claim
writer, so `claims` (what the render reads) go stale after every reprocess. The writer
already exists: `storeClaimsForDeal` / `buildClaimRowsForCard` / `upsertClaims` in
`lib/parser-v2/store-claims.js`, and the `claims` table + `review-deal.js` reader are
live. Ship a post-reprocess step that re-runs the claim writer **claims-only** (no card
rewrite), matching cards to provisions by `short_title == category`, anchored on the
deterministic `excerpt_id` (NOT `region_id`/`region_hash`: that path fails on NOSOL with
`provision_cards_deal_region_hash_unique`, 15 vs 22 rows, NULL region_ids; GAP-B). Wire
it into `reprocess.js` or ship as a standalone command. Detail: `PLAN-CLAIMS-LAYER.md`
(the claims table is Phase 1, already built; this is the reprocess-time rematerialize the
audit found missing).

**1.2 Validate NOSOL card stability (GAP-C).** Repeated NOSOL reprocess churned the
Metsera QA nosol count (22 → 16 → 15); duplicate cards pre-exist (Change-of-Rec ×4,
Disclosure ×3). Prove card/claim counts are stable across repeated reprocess on ≥3 deals
before scaling; add NOSOL provision de-duplication if not.

**1.3 Corpus reprocess + rematerialize.** Once 1.1 is proven on ≥3 deals:
`reprocess.js --all --types NOSOL,MISC,TERMF --apply` → claims-only rematerialize across
all 40 → verify code population + spot-check quality per deal → flip renders off the regex
fallbacks and **delete the regexes** (only after codes confirmed corpus-wide).

## 2. Residual capture + feedback loop (GAP-E — PROPOSED, makes forced categorization safe)

Today the only escape hatch is the transition-safe regex fallback: a migration artifact
that silently degrades to prior text. Forced categorization needs a real residual bucket
at both altitudes, captured and flagged, not dropped.
- **Provision level:** an explicit `unclassified` / `other` outcome so a Section that is
  not a recognized concept is retained and flagged, never coerced into the nearest type.
- **Feature level:** an explicit `OTHER` / verbatim-only outcome when no codebook entry
  fits, surfaced to `/admin/schema-loss`.
- **Loop:** residual → review → Freeze Gate PR to add frozen codes. The closed vocabulary
  stays honest (misfits absorbed, no fabrication). A plausible-but-wrong code is worse than
  no code. Owner WP: `WP-RESIDUAL-CAPTURE-01`.

## 3. Comparison surface — reps, IOC, two kinds of canonical

Resolved design questions (identity axes + numeric normalization; see taxonomy § 8.6/8.7):
- **Two kinds of canonical.** (a) Enum codes for categorical attributes (Section-B
  families, materiality scrape, bring-down standard, `knowledgeScopeType` /
  `materialityScopeType`). (b) **Numeric normalization** for thresholds / baskets /
  lookbacks / survival: normalize to number + unit (`"$5,000,000"` → `5000000`,
  `"twenty-four (24) months"` → `24`), NOT bucketed, so they keep ordering/range queries.
  Numbers stay numbers. Build the numeric-normalization path; enum coding already exists.
- **Cross-deal identity.** The real persisted key is the pair
  `(provisions.type, provisions.category)`. There is NO `concept_key` column. Reps explode
  to the individual rep (`splitUmbrellaRep` in `lib/parser-v2/extract.js`; concept rows
  `REP-T-ORG` etc.); scope (`party` on the provision type) is orthogonal to concept
  identity. Decide whether to promote a stable single-field `concept_key` (aspirational
  today) so cross-deal joins do not depend on `category`-label consistency.
- **Reps / IOC feature coding (legal judgment — Fable-authored, deliberate).** Declare the
  genuinely closed, recurring features `list-tagged`/`tagged` and author codebooks: IOC
  consent-required action list (shared vocab like `SOLICITATION_ACT`), efforts standard,
  rep materiality scrape + bring-down. Do NOT edit the reps rubric mechanically.

## 4. Extraction gaps — `PLAN-EXTRACTION-GAPS.md` (feeds M2/M3)

Material-Contracts per-bucket TRIGGER + correct §3.13 sub-clause quote; IOC "in all
material respects" standard + classify all of 5.01(i)–(o) (currently `[PROPOSED]
Unclassified`); third-party-beneficiary mapping bug (0 rows corpus-wide);
`effectiveTimeShort` "surviving corporation" corruption; per-rep `linkedBringDownStandard`
uniform-MAE mis-stamp.

---

## Testing plan (gate everything; no exceptions, including our own work)

- **Mechanical:** `npm test` (node:test) + `npm run build` green before any merge.
- **Claims rematerialize (§1.1):** on the 3-deal pilot assert (a) card↔provision match
  covers 100% of coded features, zero ambiguity; (b) `claims.canonical` populates for the
  5 wired families; (c) idempotent — a second rematerialize is a no-op, row counts stable;
  (d) NOSOL card counts stable across repeated reprocess (§1.2).
- **Ingestion:** `scripts/ingest-qa.js` gates (0 unverified quotes, 0 duplicate provisions
  of same kind on same range) for anything touching ingest.
- **Extraction-prompt changes:** golden eval (`scripts/eval.js`) + quote verification stays
  at ZERO flags. Reps/IOC codebook work is golden-eval-gated.
- **Numeric normalization (§3):** round-trip fixtures ("$5,000,000"→5000000,
  "twenty-four (24) months"→24, spelled/comma/paren variants) + a cross-deal range query
  returns ordered numeric values, not strings.
- **Residual capture (§2):** a misfit clause lands in `unclassified` / `OTHER`, appears in
  `/admin/schema-loss`, is NOT force-mapped, and Verbatim is byte-preserved.
- **Live verification:** deployed page, not just the build. Deal-by-deal parity vs the
  pre-schema reference (`:3010`) as canonical output lands beyond Metsera; the Metsera
  parity gate is the acceptance bar (`PLAN-CLAIMS-LAYER.md` Phase 7).

## Milestones remaining (ship core product first; query last)

- **M2 — schema deployed corpus-wide.** All 39 non-Metsera deals render from the
  schema-first path with canonical output; legacy fallback dead; parity audit green. §1 is
  the critical path.
- **M3 — ingest seamless.** Fresh deal ingests end-to-end and renders identical; two-pass
  definitions extraction; ingest path writes `claims` so fresh deals render at the Claim
  level (`PLAN-CLAIMS-LAYER.md` Phase 4).
- **M5 — UI homogenized + demo-ready.** Review-page polish to all deals; admin pages
  consistent; full-doc overlay; landing grid; reports UI.
- **M4 — query surface (AFTER M5).** `/query` cross-cutting queries on schema-first data,
  built on the `claims` substrate. Deferred behind the core review product.

## Independent tracks / pointers

- `PLAN-CLAIMS-LAYER.md` — claims table + adapter + reingest safety (the §1 detail).
- `PLAN-CANONICAL-LAYER.md` — full canonical-code inventory + the regex-kill program.
- `PLAN-TAXONOMY-GAPS.md` — G1–G11; `processing-flow-gaps.json` also carries GAP-A/B/C/E.
- Handoff for a fresh session: `HANDOFF-CANONICAL-CORPUS.md`.
- Freeze gates persist for frozen shapes; new gates only when a milestone requires one.
