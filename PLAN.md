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
Frozen files (Phase-0-C @ `1ea062d`) stay frozen. Green, tested, mechanical work
ships to `main` on its own; corpus-scale runs, taxonomy/vocabulary design, and
irreversible or user-facing-risky changes wait for Ben's explicit go.

Design source of truth: `docs/schema-shape/provision-taxonomy-triple-model.md` (§ 8
canonical-coding model) and `docs/schema-shape/provision-processing-flow.md` (§ 7
pipeline, § 4 gaps). Process audit: canonical-coding audit, 2026-07-10.

---

## Status — what's proven (updated 2026-07-23)

**M2 parity gate: PASSED** (`reports/PARITY-GATE-2026-07-15.md` — zero unexplained drops
across all 40 deals, data-level). Corpus rollout complete: codes live corpus-wide, two
Ben-gated prune rounds executed, extraction gaps D/E verified resolved, numeric-
normalization substrate built (column migration pending, item 2 of the queue), GAP-E
plumbing shipped flag-off. **All pending decisions are consolidated in
`reports/BEN-QUEUE-2026-07-15.md`** — every item is a pure sign-off.

**Claims rematerialize: BUILT AND RUN CORPUS-WIDE** (2026-07-13,
`reports/TASK3-CORPUS-REPORT-2026-07-13.md`): `scripts/reprocess/rematerialize-claims.js`
implements the excerpt-id match ladder (5 rungs), hard-stops on ambiguity, and ran across
all 40 deals — 12,259/12,387 cards matched (98.97%), 70,161 claims materialized, third run
a strict no-op. The former §1.1–§1.4 "critical path" text described this as unbuilt; that
text is deleted per this file's own convention. Open residue is listed in §1 below.

**Canonical corpus v2 track** (separate governing programme: `docs/CODEX-PROGRAM.md`):
serving projection bound to immutable releases; bounded canonical Query endpoint live
flag-off; first canonical Query UI slice (seller termination fee % of deal value) merged
to `main` 2026-07-23 behind `NEXT_PUBLIC_CANONICAL_V2_QUERY_UI_ENABLED` (off), production
live-verified with containment intact. See `docs/handoffs/` for slice specs, the
next-slice proposal, and the field↔metric correspondence analysis (no further
legacy→canonical mappings are currently safe).

### Previously proven

The canonical-coding loop (concept → code → render) is proven end-to-end on **Metsera**:
rubric `list-tagged`/`tagged` flag → registry regen → prompt embeds codebook →
extraction assigns `{code,label,text}` → claims materialize → `labelForCode` renders
a canonical pill (transition-safe fallback to prior text). Five Section-B families are
wired: `interestRateBasis`, `SOLICITATION_ACT` (shared by `ceaseDiscussionsProhibitedList`
+ `changeOfRecommendationItems`), `superiorProposalDeterminer`, `governingLaw`,
`parentAssignmentConditions`. Taxonomy + extraction are sound. The pipeline has a
materialization gap that blocks corpus scale-up.

---

## 1. Corpus residue (was "critical path" — the path itself is done)

The rematerialize command, the corpus run, and the prune/rehome tooling
(`scripts/curation/prune-cards.js`, `rehome-correction.js`, decisions-file + mandatory
backup pattern) are all built and exercised. What remains:

**1.1 [BEN SIGN-OFF — DATA-1 in the queue] Rematerialize wiring.** `reprocess.js` still
only WARNS (`formatRematerializeWarning`) instead of running the claims rematerialize
after `--apply`. An opt-in `--rematerialize` flag is being shipped (default unchanged:
warn); flipping the default to auto-run is Ben's DATA-1 sign-off.

**1.2 Prune round 2 — DECIDED AND (per Status above) EXECUTED.** Ben's approved
per-card decisions are checked in at
`scripts/curation/decisions/2026-07-round2-approved.json` (2026-07-14: A with
A6/A7 flipped to keep+scope, B acked, C "(Parent)" convention, D go), and this
file's own Status block records "two Ben-gated prune rounds executed."
Residual verification for Ben locally: a dry-run of `prune-cards.js
--decisions .../2026-07-round2-approved.json` should report a no-op if the
apply completed. The round-2 report never enumerated cards for 17 of the 22
deals it mentions — those were either out of round-2 scope or absorbed into
the M3 card-less backlog; nothing further is pending on them here.
**Standing rule: orphaned human corrections are preserved and surfaced, never deleted.**

**1.3 [M3 BACKLOG] Card-less coded provisions.** 66 across 22 deals (flagged, not
guessed, in the TASK3 report) — handled in M3 ingest work, counted and visible now.

**1.4 Claims-aware QA gate.** `scripts/ingest-qa.js` has zero claims awareness, so no
automated acceptance gate exists for rematerialize runs beyond the command's own report.
Add an additive claims gate (per-deal claims coverage vs coded features; zero-orphan
check) without changing existing gates.

**1.5 Regex-fallback kill.** Only after Ben confirms per-deal render quality corpus-wide:
flip renders off the transition-safe regex fallbacks and delete the regexes
(`PLAN-CANONICAL-LAYER.md` carries the inventory).

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
  level (`PLAN-CLAIMS-LAYER.md` Phase 4). **Card-less provisions** (provisions with no
  card, so no claims/render today) are handled here, not in the §1.3 corpus run — known
  cases: Metsera `Standstill Waiver / Don't-Ask-Don't-Waive`, Kraft `[PROPOSED] Publicity`;
  the §1.3 report counts them per deal so the M3 backlog is sized from real data.
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
