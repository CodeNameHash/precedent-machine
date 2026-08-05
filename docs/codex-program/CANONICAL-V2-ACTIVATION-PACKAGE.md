# Canonical V2 activation package

Snapshot basis: 2026-08-05, against the working tree described in
[`docs/handoffs/CODEX-TO-CLAUDE-HANDOFF-2026-08-04.md`](../handoffs/CODEX-TO-CLAUDE-HANDOFF-2026-08-04.md)
through its section 54, the current bytes of
[`docs/codex-program/m3-family-parity-register.json`](m3-family-parity-register.json),
and [`docs/codex-program/ADR-001-dark-bridge-flattening-is-scaffolding.md`](ADR-001-dark-bridge-flattening-is-scaffolding.md).
The tree is shared with concurrent agents and is still moving (219 changed or
untracked paths at the time of this revision). This is a revision of an
earlier draft of the same file, written earlier in the same session: a
material amount of work landed since then, most importantly the three
previously-missing dark bridges, the shared review-preview lane, the gate
widening to Vercel preview, and the excerpt-identity remediation. Every count
below was independently recomputed in this revision pass, not copied from the
prior draft: directly by loading the live register and calling its own
`listM3ProductParityBlockers` and `buildM3FamilyParityStatus`, and separately
by running the register's own test suites. Recompute again before relying on
it if time has passed.

This revision additionally folds in Ben's rulings of 2026-08-05 recorded in
handoff sections 62 and 63: the table-driven locator verifier is deferred
with a corrected premise (section 6 and section 10 below), source trust is
reframed as a human review state rather than a cryptographic one (section 11,
new), and amendment handling is recorded as a planned, unbuilt design
(section 12, new). This fold-in pass is documentation only: no code changed,
no test or build was run, and no parity-register count was recomputed. Every
count carried over from the prior revision is exactly that, carried over, not
re-verified in this pass.

## 1. Purpose and non-authority

This package activates nothing. It grants no serving authority to any
Canonical V2 surface. It is a preparation document: it records what would
have to be true before activation of native V2 serving could even be
**proposed** to Ben, for the four product areas still rendered by legacy
cards.

Production authority is `NONE` (handoff section 2). Nothing in this document
may be read as a freeze, adoption, import, cutover or deployment act. Writing
this file changes no status, closes no gate, and does not itself satisfy any
precondition it lists.

Since the prior draft, Ben has separately accepted ADR-001
(`docs/codex-program/ADR-001-dark-bridge-flattening-is-scaffolding.md`), which
governs all four dark bridges as a preview and equivalence scaffold: never a
serving path, never a persistence path, and removed outright (not left
dormant behind a disabled gate) once its area's parity surfaces all report
`NATIVE_VISIBLE` through a served consumer. This package is consistent with
ADR-001 throughout and does not restate its constraints in full.

The M3 family parity register already separates four distinct questions
(`REGISTER_SEMANTICS` in
[`lib/canonical-v2/native-producer/m3-family-parity-register.js`](../../lib/canonical-v2/native-producer/m3-family-parity-register.js),
lines 87-92):

- the approved treatment of a legal fact (`disposition`);
- whether the evidence record behind it is finished (`state`, explicitly
  documented as `EVIDENCE_RECORD_STATE_NOT_PRODUCT_SEMANTIC_COMPLETION`);
- whether a live route actually serves it (`live_product_visibility`,
  `DERIVED_BY_VALIDATOR_FROM_EXACT_SOURCE_LOCATOR_AND_PROOF_PATHS`); and
- whether legacy cards still carry it in production
  (`live_legacy_support`, recorded separately).

This package is about the third question only. It does not touch the first
or claim anything about the fourth beyond what is already recorded.

## 2. The four areas

Four product areas have V2 producer, resolver and projection work but no
served consumer: Material Contracts, No Other Reps/Fraud, General Covenants
and Representations (handoff section 5). Between them they own all 27 of the
register's `NOT_VISIBLE` blockers and nothing else does.

**All four now have a dark bridge.** At the prior draft only Material
Contracts did; the other three have since been built, and the review-UI
exposure that was previously inconsistent across areas has been unified.
`components/review/table-configs/canonical-v2-preview-lane.js` is now the
single shared mechanism: one labelled `Canonical V2 Preview` lane, read-only,
default-collapsed, rendered beside the legacy table rather than mixed into
it, gated by a server-stamped boolean (`canonical_v2_preview_enabled`) read
from the reviewDeal payload rather than a client-side environment read. This
implements Ben's ruling 1 of 2026-08-05 (handoff section 45) and replaces
four previously bespoke, inconsistent per-area implementations. Verified
directly in this revision: all four configs (`material-contracts.config.js`,
`general-covenants.config.js`, `no-other-reps-fraud.config.js`,
`representations-qualifiers.config.js`) import `isCanonicalV2PreviewEnabled`
from that shared module.

**Update, later the same day: queue item 17 has since been executed.** The
statement that no route sets `canonical_v2_preview_enabled` was true when this
section was drafted and is now superseded.
`lib/canonical-v2/review-preview-assembly.js` exports
`attachCanonicalV2Preview`, which is awaited in
`pages/api/review/[id]/cards.js` between `fetchReviewDealCards` and
`trimReviewDealForWire`, and `canonical_v2_preview_enabled` was added to that
wire allowlist so the flag survives to the client. Verified in the real
assembled path: 14 dark cards across all four families in one review deal,
every one `VALIDATED_NOT_SERVED`, with the gate off returning the identical
object reference and no added field, and a production environment with the flag
set staying off.

The preview is therefore live on local and Vercel preview, and remains
prohibited and structurally off in production. It is fed from fixtures in
`__fixtures__/canonical-v2/preview/`, not from Canonical V2 staging: see handoff
sections 49 and 50 for why real staging data waits for the trusted
source-admission boundary, which is the next step in Ben's order. Ben has
since ruled on that boundary's shape: see section 11 below.

One known defect in that activated path, recorded in handoff section 56 and not
yet fixed at the time of writing: three of the four merges replace rather than
append `canonical_v2_bridge_receipts`, so the chained four-family preview
carries 14 cards but only two receipts. Material Contracts and General
Covenants lose their provenance binding. Card content is unaffected; the audit
trail is not.

### 2.1 Material Contracts

Owner: `MATERIAL_CONTRACTS` (`owner_kind: NATIVE_FAMILY`) in the parity
register. First-slice evidence is `PASS`
(`lib/canonical-v2/reviewed-material-contracts-slice.js`,
`lib/canonical-v2/qxo-material-contracts-slice.js`,
`lib/canonical-v2/native-producer/material-contracts-producer-prompt.js`,
`tests/canonical-v2-material-contracts-family-parity.test.js`). All 8 product
surfaces are `state: OPEN`, `disposition: FOLLOW_ON_REQUIRED`, and all 8 are
the area's `NOT_VISIBLE` blockers, unchanged from the prior draft and
reconfirmed directly against the live register in this revision:

| Surface ID | Kind | Source |
| --- | --- | --- |
| `assigned-material-contracts` | RENDERED_ROW | `components/review/table-configs/material-contracts.config.js` → `materialContractsConfig` |
| `material-contracts-query-compare` | QUERY_FIELD | `lib/query/render/deal-compare-cell-fields.js` → `MATERIAL_CONTRACT` |
| `material-contracts-market-fields` | MARKET_FIELD | `lib/market-metrics/registry.js` → `manifestMaterialContractMetrics` |
| `material-contracts-serving-registry` | QUERY_FIELD | `lib/query/serving-registry-v1.json` → `/entries/395/key` |
| `material-contracts-natural-language` | QUERY_FIELD | `lib/query/natural-language.js` → `MATERIAL_CONTRACT` |
| `material-contracts-compare-field` | COMPARE_FIELD | `components/review-v2/compareRowUnion.js` → `unionRows` |
| `material-contracts-reviewed-derived` | DERIVED_VALUE | `lib/canonical-v2/reviewed-material-contracts-slice.js` → `buildReviewedMaterialContractsSlice` |
| `material-contracts-qxo-derived` | DERIVED_VALUE | `lib/canonical-v2/qxo-material-contracts-slice.js` → `buildQxoMaterialContractsSlice` |

V2 projection: `lib/canonical-v2/material-contracts-product-projection.js`,
exporting `projectMaterialContractsProductSurfaces`.

Dark bridge: `lib/canonical-v2/legacy-card-bridge.js` exists, scoped exactly
to this area (`BRIDGE_SCHEMA = 'CANONICAL_V2_MATERIAL_CONTRACTS_LEGACY_CARD_BRIDGE/V1'`),
and is registered `PURE_PROPOSAL` in
`lib/canonical-v2/phase1-authority-boundary-inventory.js` (verified directly
against the current `PURE_PROPOSAL_SOURCES` list). Final adversarial verdict
remains `PASS` for its dark, structural-only contract (handoff section 31):
it carries `authority_state: 'VALIDATED_NOT_SERVED'` and
`source_authentication_state: 'SOURCE_UNAUTHENTICATED_EXTERNAL_BOUNDARY'` on
everything it produces, and remains unreachable from any served route.
**Unlike the three bridges built later in the same session (2.2-2.4), this
module does not itself call `lib/canonical-v2/dark-bridge-gate.js`**:
verified directly, it has no import of that module at all. Its exposure is
governed instead by the shared review-preview-lane gate above and by the
same unreachability argument section 3 makes for all four. The review UI no
longer renders its dark rows as a bespoke inline append: `material-contracts.config.js`
still builds its dark preview rows exactly as before (`isDarkV2Card()`,
`darkPreviewRows()`, each labelled `"(Canonical V2 preview)"`,
`marketState: 'DARK_REVIEW_ONLY'`, `marketSkip: true`), but those rows now
feed the shared `Canonical V2 Preview` lane rather than being appended beside
the live rows directly. The market-feed exclusion
(`authorityState: 'VALIDATED_NOT_SERVED'` or `marketState: 'DARK_REVIEW_ONLY'`)
is unchanged.

### 2.2 No Other Reps/Fraud

Owner: `NO_OTHER_REPS_FRAUD` (`NATIVE_FAMILY`). First-slice evidence is
`PASS` (`lib/canonical-v2/native-producer/no-other-reps-native-first-slice.js`,
`tests/canonical-v2-no-other-reps-native-first-slice.test.js`). All 7 product
surfaces are `OPEN` / `FOLLOW_ON_REQUIRED` and all 7 are `NOT_VISIBLE`
blockers, reconfirmed directly against the live register:

| Surface ID | Kind | Source |
| --- | --- | --- |
| `assigned-no-other-reps-fraud` | RENDERED_ROW | `components/review/table-configs/no-other-reps-fraud.config.js` → `noOtherRepsFraudConfig` |
| `no-other-reps-serving-registry` | QUERY_FIELD | `lib/query/serving-registry-v1.json` → `/entries/429/key` |
| `no-other-reps-compare-field` | COMPARE_FIELD | `components/review-v2/compareRowUnion.js` → `unionRows` |
| `no-other-reps-question-market` | MARKET_FIELD | `components/review/table-configs/no-other-reps-fraud.config.js` → `questionMarket` |
| `no-other-reps-fraud-market` | MARKET_FIELD | `lib/row-market-stats/observations.js` → `fraudCarveoutScope` |
| `no-other-reps-abry-derived` | DERIVED_VALUE | `lib/abry.js` → `deriveAbrySummary` |
| `no-other-reps-native-derived` | DERIVED_VALUE | `lib/canonical-v2/native-producer/no-other-reps-native-first-slice.js` → `buildNoOtherRepsNativeFirstSlice` |

`assigned-no-other-reps-fraud` is the surface named in handoff section 32's
first residual risk: it cites four separate `lib/canonical-v2/` adapters.
Ruling 1 (section 4 below) governs it directly, and remains unaffected: it is
still `NOT_VISIBLE`, so nothing here is mis-scored.

V2 projection: `lib/canonical-v2/no-other-reps-fraud-product-projection.js`,
exporting `projectNoOtherRepsFraudProduct`.

**Dark bridge: `lib/canonical-v2/no-other-reps-fraud-dark-bridge.js` now
exists** (it did not at the prior draft). Registered `PURE_PROPOSAL`. It
calls `assertDarkBridgeIntegrationAllowed` at every public entry point,
verified directly by reading the module, so it fails closed before any other
validation when the gate is off. Card identity is bound to
`provision_instance_id`, never `excerpt_id` (handoff section 41): a
non-reliance acknowledgment and its auto-derived extra-contractual sibling
legitimately quote the same sentence and so legitimately share one excerpt,
exactly the collision class ruling 6 exists to prevent (section 5 below).
This bridge is the programme's exemplar for that rule and was not modified
when the other three were later brought up to its standard. Wired into
`no-other-reps-fraud.config.js` through the shared `Canonical V2 Preview`
lane, same mechanism as the other three.

### 2.3 General Covenants

Owner: `GENERAL_COVENANT_ROUTER` (`owner_kind: ROUTING_UMBRELLA`).
First-slice evidence is `PASS` (`lib/canonical-v2/p0-product-surface-routing.js`,
`lib/canonical-v2/native-producer/p0-product-surface-ownership.js`,
`components/review/table-configs/general-covenants.config.js`,
`lib/canonical-v2/native-producer/general-covenants-producer-prompt.js`,
`tests/canonical-v2-general-covenants-family-parity.test.js`). All 7 product
surfaces are `OPEN` / `FOLLOW_ON_REQUIRED` and all 7 are `NOT_VISIBLE`
blockers, reconfirmed directly against the live register:

| Surface ID | Kind | Source |
| --- | --- | --- |
| `assigned-general-covenants` | RENDERED_ROW | `components/review/table-configs/general-covenants.config.js` → `generalCovenantsConfig` |
| `general-covenants-query-compare` | QUERY_FIELD | `lib/query/render/deal-compare-cell-fields.js` → `COVENANT_OTHER` |
| `general-covenants-market-fields` | MARKET_FIELD | `components/review/table-configs/general-covenants.config.js` → `generalCovenantMarket` |
| `general-covenants-serving-registry` | QUERY_FIELD | `lib/query/serving-registry-v1.json` → `/entries/498/key` |
| `general-covenants-compare-field` | COMPARE_FIELD | `components/review-v2/compareRowUnion.js` → `unionRows` |
| `general-covenants-semantic-market` | MARKET_FIELD | `lib/market-metrics/adapter.js` → `semanticRowMetrics` |
| `general-covenants-per-clause-derived` | DERIVED_VALUE | `components/review/table-configs/general-covenants.config.js` → `perClauseRows` |

V2 projection: `lib/canonical-v2/general-covenants-product-projection.js`,
exporting `projectGeneralCovenantsProductSurfaces` (alongside
`lib/canonical-v2/general-covenants-source-disposition.js`, which is not
itself named on any of the 7 surfaces).

**Dark bridge: `lib/canonical-v2/general-covenants-dark-bridge.js` now
exists.** Registered `PURE_PROPOSAL`. It calls
`assertDarkBridgeIntegrationAllowed` at every public entry point, verified
directly; an earlier version validated the reviewDeal and envelope *before*
checking the gate, which let a hand-authored envelope through with the gate
off. Found by direct probing rather than the family suite, and fixed
(handoff section 42). It widens the Material Contracts closed lineage field
set to exactly `{source, owner_id, claim_revision_ids}` and cross-validates
`owner_id` against `GENERAL_COVENANT_FOLLOW_ON_OWNERS`. Dark-card exclusion
from the live pipeline is unconditional, not dependent on the gate, so a
gate-off tree with a dark card already present cannot leak it unlabelled
through `perClauseRows()`'s generic "every uncovered card gets a link"
fallback (handoff section 40). Wired into `general-covenants.config.js`
through the shared `Canonical V2 Preview` lane.

### 2.4 Representations

Family: `REPRESENTATIONS`, design at
`docs/superpowers/specs/2026-08-03-family-representations-design.md`. All 5
Wave A checks are `PASS` (`fixture_proof`, `lexical_net`, `producer`,
`registry`, `resolver`). Of 6 product surfaces, 5 are `OPEN` /
`FOLLOW_ON_REQUIRED` and are the area's `NOT_VISIBLE` blockers; the sixth is
already `PASS` / `APPROVED_RETIRED` and correctly reports
`RETIRED_NOT_RENDERED`, so it is not a blocker. Reconfirmed directly against
the live register:

| Surface ID | Kind | Source | Status |
| --- | --- | --- | --- |
| `target-representations-rendered-rows` | RENDERED_ROW | `components/review/table-configs/representations-qualifiers.config.js` → `representationsQualifiersConfig` | blocker |
| `parent-representations-rendered-rows` | RENDERED_ROW | `components/review/table-configs/representations-qualifiers.config.js` → `parentRepresentationsConfig` | blocker |
| `representations-market-fields` | MARKET_FIELD | `components/review/table-configs/representations-qualifiers.config.js` → `repMarketSubterms` | blocker |
| `representations-query-fields` | QUERY_FIELD | `lib/query/field-meta.js` → `fieldsForProvisionType` | blocker |
| `representations-compare-side-table` | SIDE_TABLE | `pages/compare.js` → `RepsCompare` | blocker |
| `representations-browser-derived-lookback` | DERIVED_VALUE | `components/review/table-configs/representations-qualifiers.config.js` → `resolveDateLookback` | retired, not a blocker |

V2 projection: `lib/canonical-v2/representations-product-projection.js`,
exporting `projectRepresentationClaims`. Handoff section 6 records an open
implementation gap here: the live prompt/resolver path emits a unified
`REPRESENTATION_QUALIFIER_STANDARD` claim, while this projection still
expects the older distinct `REPRESENTATION_ACCURACY_STANDARD` and
`KNOWLEDGE_QUALIFIER` claims. Handoff section 6 also records that Ben has not
ruled on a closed representation-subject catalogue, and that none should be
invented; still true, see section 10 below.

**Dark bridge: `lib/canonical-v2/representations-dark-bridge.js` now
exists.** Registered `PURE_PROPOSAL`. It calls
`assertDarkBridgeIntegrationAllowed` at every public entry point (the same
gate-ordering defect as General Covenants was independently found and fixed
here too, handoff section 44: two independent implementations produced the
same defect, which the handoff records as a pattern rather than an
accident). The projection is record-shaped, not card-shaped: cards are
formed by grouping governed records on `provision_instance_id`, one card per
provision carrying multiple bound claims, mirroring the legacy card/claim
split. A first implementation emitted one card per record, fabricating two
cards for a single real provision, and was rejected by the bridge's own
`ID_COLLISION` guard before this corrected design shipped.

`selectRepCards()`'s exclusion of dark cards from the ordinary card-selection
path is still in force, verified directly in this revision: it still filters
out any card where `card.authority_state === 'VALIDATED_NOT_SERVED'` or
`card.provenance?.canonical_v2_authority_state === 'VALIDATED_NOT_SERVED'`
(`representations-qualifiers.config.js` lines 70-73), with an explicit
comment at lines 80-82 stating the exclusion is deliberate and unchanged. A
dark Representations claim still never reaches the *legacy* table. What has
changed since the prior draft: the bridge now also feeds a separate,
explicitly gated function into the shared `Canonical V2 Preview` lane, so a
dark Representations row can now be seen in the lane even though it remains
excluded from the ordinary table. The prior draft's line, "a dark
Representations claim would never reach the table, labelled or not," needs
this correction: it still never reaches the legacy table; it can now reach
the preview lane.

### 2.5 The cross-family merge blocker, cleared

All four bridges compose card identity from `id` plus `provision_instance_id`;
`excerpt_id` is retained only as citation/cross-check data, never as an
identity, in all four (handoff section 53). Verified directly in this
revision: three pairwise cross-family regressions exist, one in each of the
three later bridges' test files, each merging No Other Reps/Fraud's output
into a review deal first (whose own non-reliance/extra-contractual pair
legitimately shares one `excerpt_id`), then merging the named bridge's output
into the *same* deal, and asserting no `ID_COLLISION`:

```text
node --test tests/canonical-v2-general-covenants-dark-bridge.test.js \
  tests/canonical-v2-legacy-card-bridge.test.js \
  tests/canonical-v2-representations-dark-bridge.test.js \
  tests/canonical-v2-no-other-reps-fraud-dark-bridge.test.js

35 passed, 0 failed
```

This is what makes "Review preview for all four areas together" (Ben's
activation-order ruling 3, section 10 below) mechanically possible. It does
not itself activate anything: no route currently performs this merge (see
the opening paragraph of section 2).

## 3. Why a dark bridge alone cannot clear a blocker

`liveProductVisibility(surface)`
(`lib/canonical-v2/native-producer/m3-family-parity-register.js:672-691`)
only returns `NATIVE_VISIBLE` (or `DERIVED_VISIBLE`) when three things are
all true: the surface's `disposition` is a terminal one (`NATIVE_COMPLETE` or
`APPROVED_DERIVED`), `provingProductConsumers(surface)` finds a real,
statically-resolved consumer for every required adapter, and every one of
those consumers is a member of `servedModules()`. If a consumer exists but
is not served, the function returns `NATIVE_INTEGRATED_NOT_SERVED` (or
`DERIVED_INTEGRATED_NOT_SERVED`) instead of a visible state.

`servedModules()` (same file, lines 594-618) starts only from files under
`pages/` that are **not** one of the seven files in
`QUERY_CONTAINED_ROUTE_FILES`
(imported from [`lib/query-containment.js`](../../lib/query-containment.js),
not duplicated), then walks static `require`/`import` specifiers
transitively. Every one of the seven contained route files
(`/api/query/run`, `/api/query/interpret`, `/api/query/field-options`,
`/api/query/demo-set`, `/api/query/kinds`, `/api/saved-queries`,
`/api/canonical-v2/query`) exports nothing but `queryContainedHandler`, a
three-line handler that returns HTTP 503 `ROUTE_CONTAINED`
(`lib/query-containment.js:38-41`). Code reachable only through one of those
seven files is integrated, not served.

Since the prior draft, `servedModules()`'s reachability walk was also
hardened to exclude pages behind `lib/design/route-guard.js` (which answers
`notFound` in production) from seeding the served set, and the locator proof
now requires an intra-module call-graph reachability closure, not just a
module-level import (section 6 below). Neither change altered the count.

Every dark bridge marks everything it produces `authority_state:
'VALIDATED_NOT_SERVED'` and `source_authentication_state:
'SOURCE_UNAUTHENTICATED_EXTERNAL_BOUNDARY'` at the schema level, and each is
independently confirmed unreachable from any served Next.js route (handoff
sections 31-32, 40-44). Their only live callers are the dark-preview code in
their respective configs, the shared preview lane, and their own test files,
none a `pages/` route.

Consequence: a surface whose only cited consumer is a bridge, or is
downstream of one, computes `NATIVE_INTEGRATED_NOT_SERVED`.
`isNativeSemanticCompletion` (lines 698-702) whitelists only
`NATIVE_VISIBLE`, `DERIVED_VISIBLE` and `RETIRED_NOT_RENDERED`, so the
surface remains a blocker under `isNativeSemanticBlocker` (lines 704-706).

Measured, not asserted, in this revision: zero parity surfaces in
`docs/codex-program/m3-family-parity-register.json` cite any of the four dark
bridges (`legacy-card-bridge.js`, `general-covenants-dark-bridge.js`,
`no-other-reps-fraud-dark-bridge.js`, `representations-dark-bridge.js`) or
`lib/query/dark-authority-fence.js` as `source_path` or anywhere in
`evidence_paths`. Confirmed by a direct scan of the register JSON's raw text
for all five filenames: zero matches. The 27 `NOT_VISIBLE` blockers are
exactly the four areas in section 2: Material Contracts 8, No Other
Reps/Fraud 7, General Covenant Router 7, Representations 5. Recomputed
directly in this revision via `listM3ProductParityBlockers` against the live
register, filtered to `live_product_visibility === 'NOT_VISIBLE'` and grouped
by owner: 8 / 7 / 7 / 5, summing to 27 exactly.

**Building or extending a dark bridge, by itself, clears zero blockers.** It
is a precondition for serving, never evidence of it. This held in practice,
not just in theory: all three of the previously-missing bridges landed since
the prior draft, and the `NOT_VISIBLE` count did not move. This is the rule
working as intended, not a gap to close.

## 4. The exact preconditions for activation, as a checklist

Clearing any one of the 27 `NOT_VISIBLE` blockers requires two independent
things, both real, for that surface (handoff section 32):

**(a) The evidence record reaches `state: PASS` with a terminal
disposition.** The four terminal dispositions are `NATIVE_COMPLETE`,
`APPROVED_DERIVED`, `EVIDENCE_ONLY` and `APPROVED_RETIRED`
(`TERMINAL_DISPOSITIONS`, register lines 68-73); the open default is
`FOLLOW_ON_REQUIRED` (`OPEN_DISPOSITION`, line 67). Currently, all 27
`NOT_VISIBLE` surfaces across the four areas are `state: OPEN`,
`disposition: FOLLOW_ON_REQUIRED`. None has reached (a) yet.

**(b) A consumer that a live, non-contained route actually reaches,
importing the exact V2 projection.** Concretely, `provingProductConsumers`
must find a real import/require of the adapter's exact exported symbol,
referenced beyond the import line, and that consumer file must be a member
of `servedModules()` as defined in section 3, and, since the prior draft, the
locator itself must be reachable in the intra-module call graph from that
import (section 6 below).

Both are gated by Ben's two rulings of 2026-08-05 (handoff section 35),
which a reviewer should apply as acceptance criteria:

**Ruling 1: multiple adapters are all required.**
> If a surface names multiple required adapters, consuming only one is
> insufficient. Each required adapter must have exact consumer proof. Fail
> closed unless the register expressly marks the adapters as alternatives.

Applied: unless a surface's register entry sets `adapter_set: 'ALTERNATIVES'`
(the only accepted value; any other value fails register validation with
`INVALID_PARITY_REGISTER`), every `lib/canonical-v2/` adapter named on that
surface needs its own real, served consumer. None of the 27 `NOT_VISIBLE`
surfaces currently uses the `ALTERNATIVES` marking. `assigned-no-other-reps-fraud`
(section 2.2) is the concrete case this closes: it names four adapters, and
under ruling 1 all four need independent proof before it can pass.

**Ruling 2: proof must resolve the exact path and executed export.**
> Consumer proof must resolve the complete import specifier to the exact
> repository path and exported function or adapter that is executed.
> Basename-only matching is not acceptable. Ambiguous imports, dynamic
> imports, unresolved re-exports and test-only paths must fail closed.

Applied, a reviewer confirms all of: (i) the consumer's `require`/`import`
specifier resolves, by real relative-path resolution against the actual file
tree, to the exact adapter file, not a same-named file elsewhere; (ii) the
bound local name is one of the adapter's statically-readable exports; (iii)
that local name is referenced somewhere beyond its own import line; (iv) a
namespace or default binding counts only via real member access
(`ns.thing`) or destructuring off it (`const { thing } = ns`); (v) dynamic
`import()` of the adapter, `tests/`/`docs/` consumers, and unreadable export
shapes are all rejected.

A reviewer can mechanically re-run this checklist:

```text
node --test tests/programme-gates/m3-family-parity-register.spec.js \
  tests/canonical-v2-m3-certification-control.test.js \
  tests/canonical-v2-m3-certification-control-v2.test.js
```

Rerun directly in this revision: 34 passed, 0 failed (grown from the 32
recorded at ruling implementation time, handoff section 35, as further
hostile cases were added; no failure).

and by calling `listM3ProductParityBlockers(CURRENT_M3_FAMILY_PARITY_REGISTER)`
directly against the current register, as this revision did to produce every
count in this package.

## 5. The excerpt-identity migration: a fixed three-way order

This section is new in this revision and is the single most important
addition. It is the working-out of Ben's ruling 6 of 2026-08-05 (handoff
section 45): "`excerpt_id` is not a unique card identity, programme-wide.
Card identity must bind the deal, the provision or component, the exact
source span, the occurrence and the source revision. Audit every existing
and future bridge for excerpt-only identity." Three defects are coupled
(handoff sections 46 and 52), and the order in which they may be touched is
now fixed. Getting the order wrong converts a currently-latent defect into
live data loss.

### The three defects, in the order they must be handled

**1. Live read-path keying on `deal_id` + `provision_instance_id` +
`excerpt_id`: COMPLETE.** Canonical V2's `excerpt_id` is
`contentId(EXCERPT_DOMAIN, { quote, start, end })`, a pure content hash with
no deal, section or provision component, so two siblings quoting one
sentence correctly share it. Legacy `excerpt_id` is
`dealId:sectionPath:spanHash:index`, embeds the provision, and is 1:1 with a
card by construction. The live read path, `groupClaimsByExcerpt` in
`lib/queries/claims-adapter.js`, keyed purely on the bare `excerpt_id`, which
silently inherited the legacy 1:1 assumption. Verified directly in this
revision: `groupClaimsByExcerpt` itself is unchanged (two existing tests
assert its return value keyed by a bare excerpt id), but a new
`claimsForCard(claimsByExcerpt, card)` (`claims-adapter.js:108`) now narrows
its bucket to the claims whose own `provision_instance_id` agrees with the
card's, keeping a claim with no `provision_instance_id` rather than dropping
it. `lib/queries/review-deal.js` calls `claimsForCard` inside
`normalizeCard`, and its `CLAIMS_SELECT` now includes `provision_instance_id`
(confirmed at line 274). The same fix reached
`lib/row-market-stats/source.js`'s `PROVISION_CARD_COLUMNS` and claims
select, though that route is presently unreachable in any case
(`/api/market-stats` is an unconditional 503).

**2. `lib/parser-v2/store-claims.js:158` claim-id composition: NOT YET
FIXED.** Verified directly by reading the current file:

```js
function claimId(excerptId, attribute, index) {
  return crypto.createHash('sha256').update(`${excerptId}|${attribute}|${index}`).digest('hex').slice(0, 24);
}
```

No provision component. The writer upserts with `{ onConflict: 'id' }`
(`store-claims.js:269`, also verified directly). If two sibling cards ever
share an `excerpt_id`, a same-attribute, same-index claim on one collides in
`id` with the other, and the upsert **silently overwrites one with the other
at write time**. Data loss before any read path is even reached, so none of
item 1's read-side fixes can compensate for it. This is a live write path, in
ingestion. Fixing it is not a local edit: adding a provision component to the
hash re-mints every existing claim id, so the next ingest would insert new
rows rather than upsert existing ones and produce duplicates. It needs a data
migration alongside the code change, not a code change alone.

**3. Only then, replace the bare unique index.**
`supabase/schema-04-provision-card-canonical.sql:125-126`, verified directly,
still present, unchanged:

```sql
CREATE UNIQUE INDEX IF NOT EXISTS provision_cards_excerpt_unique
  ON public.provision_cards(excerpt_id);
```

The remediation, when authorised, is to drop it in favour of the existing
`provision_cards_provision_instance_unique` (same file, line 122, also
verified present) or to make it composite as
`UNIQUE(deal_id, provision_instance_id, excerpt_id)`.

### Why the order is fixed, not a preference

The index is currently the only thing preventing both item 1's pre-fix
failure mode and item 2 from firing: legacy `excerpt_id` happens to be 1:1
with a card today, so no two cards in any deal actually share one, so
neither collision condition is ever reached. **The index is holding two
paths shut, not one.** It must not be dropped until both the read-side
keying (item 1, done) and the `store-claims.js` claim-id composition (item
2, not done) are corrected.

Doing step 3 before step 2 converts a latent write-path defect into silent
live data loss: the moment the index stops enforcing 1:1, a real deal with
two sibling cards sharing an excerpt will hit `store-claims.js`'s collision
on the next ingest that touches it, and the upsert will destroy a claim with
no error, no log and no test failure, because nothing today exercises that
write path with the index removed.

### Where this sits in the current authority boundary

None of this is authorised to execute now. The index is production schema;
changing it is a production data change and stays outside current authority
(handoff section 2). This belongs in the eventual production activation
package as a rehearsed migration, sequenced as steps 2 then 3 above, not as
work to start from this document.

The decision to leave the index untouched for now was deliberately delegated
to the engineering lane rather than escalated to Ben, and was resolved that
way (handoff section 50): removing it before the write-path fix would pull
support out from under a live path for no present benefit, since nothing
today can reach either collision. That remains the correct resting state.

This also intersects ADR-001. The index is not only a data-integrity
guardrail; it is also, incidentally, the only thing currently preventing a
flattened dark card from ever being persisted into `public.provision_cards`
(ADR-001 constraint 2). Anyone proposing to alter
`provision_cards_excerpt_unique`, for any reason, must first satisfy that
constraint by some other explicit means, not merely by having fixed the
claim-id collision.

## 6. The 19 unprovable locators, and a Compare-rendering finding beyond them

Section 4's checklist can read as though any `NATIVE_UNVERIFIED` row is one
served consumer away from clearing. That is false for a specific, computed
subset, found since the prior draft (handoff sections 47 and 51).

### The 19

Of the 73 `NATIVE_UNVERIFIED` rows, 19 have a `source_locator` that is
neither a module-level binding nor evaluated inside any function body of its
own source file, computed programmatically against the register's own
`analyseModuleSource` helper, not eyeballed:

- **17** string entries in the top-level `KEY_FIELDS` literal in
  `lib/query/render/deal-compare-cell-fields.js`, verified present at lines
  1-123 of that file in this revision;
- **1** row-spec string, `specificPerformance`, inside the `ROWS_BOTTOM`
  tuple array in `components/review/table-configs/misc-boilerplate.config.js`;
- **1** further row, `appraisal-governed-review`, locator
  `APPRAISAL_SETTLEMENT_CONSENT`, in
  `lib/canonical-v2/tax-dividends-appraisal-product-projection.js`, missed by
  the first pass and found on a second.

A 20th row, `remedies-query-registry`, matches the same shape but is a false
positive: `.json` source paths are exempted from the locator-execution check
by design and receive `JSON_POINTER_LOCATOR` unconditionally. It remains
`NATIVE_UNVERIFIED` for the ordinary no-proving-consumer reason, not this
one.

**Zero of the 19 can be fixed by re-pointing a locator.** The serving chain
for the 17 `KEY_FIELDS` entries was traced three files deep,
`deal-compare-cell-fields.js` → `lib/query/executors/deal-compare.js` →
`lib/query/types.js`. Verified directly in this revision:
`fieldsForCompareCell` (`deal-compare-cell-fields.js:125-130`) treats
`KEY_FIELDS[provisionType]` as an opaque array, returning it, or a slice of
it, without ever inspecting, comparing against or branching on a member. At
no point does any field-name string appear as a literal comparison inside a
function body. This is a deliberately table-driven architecture, not a
wiring gap, and the current literal-token proof rule cannot certify it at
field granularity by design.

The 19 need one of three things, and the choice is an owner decision, not an
engineering one (repeated in section 10 below):

1. **Code restructuring** to create a genuine per-field evaluation site, for
   example explicit dispatch in place of a computed table lookup plus a
   generic map and slice. Real engineering, and arguably worse code: the
   table-driven design exists specifically to avoid a many-branch switch.
2. **For `appraisal-governed-review` only**, promotion off
   `VALIDATED_NOT_SERVED` plus a real consumer. A larger lift than the other
   18: unlike its siblings, it has no candidate evaluation site anywhere,
   even in principle, without adding one, and its only non-test consumer
   cites its path as a governance string without ever requiring it.
3. **A different verification instrument for this class of claim**, for
   example, proof that a field is a member of a data structure that is
   itself reachable and consumed, and that it falls within the slice the
   served callers actually request. This is a rigorous, checkable proof; it
   is simply a different instrument from call-graph reachability, and
   deserves real consideration rather than default rejection. It would also
   need to correctly demote fields that exist in the table but fall outside
   what is actually requested (see below), or it becomes exactly the kind of
   definition-loosening Ben's honest-state ruling forbids (handoff section
   45: "Do not change parity definitions merely to reduce the blocker
   count").

### A separate, independent Compare-rendering finding

Verified directly in this revision, not merely carried over from the
handoff. `fieldsForCompareCell` applies
`keys.slice(0, groups.includes('mechanics') ? 4 : 3)`
(`deal-compare-cell-fields.js:129`). Every current non-test caller passes
`included_field_groups: ['primary', 'qualifiers']`, confirmed by direct grep
at `pages/index.js:376`, `pages/query/index.js:286`,
`lib/query/natural-language.js:914` and
`components/query/QueryLaunchBox.jsx:130`, so in production the slice is
always `keys.slice(0, 3)`. `'all'` and `'mechanics'` appear only in test
fixtures.

Checked against the live `KEY_FIELDS` arrays: `appraisalFact` sits at index 4
of `CONSIDERATION` and index 11 of `COVENANT_OTHER`; `dollarThreshold` sits
at index 8 of `CLOSING_CONDITION` and index 3 of
`COVENANT_INTERIM_OPERATING`; `dividendFact` sits at index 10 of
`COVENANT_OTHER`; `parentApprovalMechanism` sits at index 9 of
`SEC_FILING_MEETING`. All four sit beyond index 2 in every array in which
they appear. They are therefore not merely unprovable under the current
locator rule; they are plausibly **never shipped in a live `DEAL_COMPARE`
response at all**, regardless of parity status. This is a product finding,
independent of the register question, and worth its own investigation.

Separately, and not a blocker either way: `dno-query-compare-fields` and
`employee-query-compare-fields` carry a byte-identical
`(source_path, source_locator)` pair, both naming `COVENANT_OTHER`, a
13-field bucket rather than a family-specific field. Two different families
currently assert an identical, non-distinguishing fact. Worth correcting for
honesty; correcting it does not clear either row.

### Ben's ruling on this choice, 2026-08-05

Ben deferred the decision above and corrected a premise it rested on (handoff
section 62, Decision 1). `fieldsForCompareCell`'s three-field limit sits in
the Query product's `DEAL_COMPARE` cross-deal comparison grid, where each
cell summarises a few key fields per deal per provision. It is not the review
page and not a full document view. Ben's actual intent for Compare is
different: pull the full agreement and show agreements side by side. If
Compare becomes that, the three-field limit is irrelevant to it, because it
governs a compact summary cell in a surface Compare would no longer be.

**Consequence for the 17 rows above.** They are registered against
`deal-compare-cell-fields.js`, the comparison-grid code. If the comparison
product moves to a full side-by-side agreement view, that surface is being
superseded, and these rows may need re-registering against whatever replaces
it, rather than being made provable against the grid as it stands. Do not
build the verifier, in any of the three shapes above, until the target
surface is settled: this is a bigger question than the verifier itself.

Also recorded: `fieldsForCompareCell` already has an `'all'` branch
(`deal-compare-cell-fields.js:128`, `if (groups.includes('all')) return
keys;`, verified directly in this revision) that returns every field with no
slice. No live caller passes it (confirmed above). If the grid is retained
as-is and simply needs to show everything, that is a one-argument change at
call sites, not new verification machinery.

## 7. The gate

`lib/canonical-v2/dark-bridge-gate.js` exists (untracked in git, same as at
the prior draft). It is imported and asserted at the entry point of three of
the four bridges: `general-covenants-dark-bridge.js`,
`no-other-reps-fraud-dark-bridge.js` and `representations-dark-bridge.js`,
each confirmed by direct read of the module to `require('./dark-bridge-gate')`
and call `assertDarkBridgeIntegrationAllowed` before any other validation.
The fourth, `legacy-card-bridge.js` (Material Contracts), does not import it
at all, verified directly; its exposure is governed instead by the shared
review-preview-lane gate (section 2 above) and by remaining structurally
unreachable from any served route (section 3).

- Env key: `CANONICAL_V2_DARK_BRIDGE`.
- Enabled value: the exact string `ENABLED_LOCAL_PREPRODUCTION`. Matching is
  case-sensitive and exact; near misses (lowercase, padded whitespace,
  boolean `true`, numeric `1`) all leave the gate disabled.
- Default is disabled. A missing or empty env resolves to `false`.
- **Widened since the prior draft, under Ben's ruling 2 (handoff section 45)
  and only after full acceptance passed (handoff section 54).** The gate no
  longer hard-codes a bare `VERCEL` check; it now delegates the runtime
  question to `isPermittedCanonicalV2Runtime`
  (`lib/canonical-v2/feature-flags.js`), the same positive allowlist used by
  four of the five other Canonical V2 feature flags, verified directly by
  reading both files. One allowlist, not two copies that could drift apart.
- Verified behaviour of `isPermittedCanonicalV2Runtime`, read directly from
  `feature-flags.js:25-31`: permitted when `VERCEL_ENV === 'preview'`, or
  when neither `VERCEL` nor `VERCEL_ENV` is present at all (genuinely local)
  and `NODE_ENV !== 'production'`. Denied in every other case, including
  `VERCEL_ENV === 'production'`, `NODE_ENV === 'production'`, and `VERCEL=1`
  present with no `VERCEL_ENV`: an unknown Vercel runtime is not assumed
  local.
- The dark-bridge gate then separately denies a truthy `CI`
  (`'1'`/`'true'`, case-insensitive) even under an otherwise-permitted
  runtime, retained deliberately as a second belt after the runtime check,
  not removed when the allowlist was unified.
- The env lookup uses `Object.prototype.hasOwnProperty`, so a value present
  only via prototype pollution does not enable it.
- `assertDarkBridgeIntegrationAllowed(env)` throws `DarkBridgeGateError`
  (`code: DARK_BRIDGE_INTEGRATION_NOT_PERMITTED`) when the gate is closed;
  it is a call-site assertion, not a silent no-op.

Rerun directly in this revision: `node --test tests/canonical-v2-dark-bridge-gate.test.js`
gives 8 passed, 0 failed.

**Correction to the prior draft:** it stated the gate could never evaluate
`true` on any Vercel preview or production deployment, only in a bare local
shell. That is now wrong for preview, by Ben's deliberate ruling.
**Production remains hard-off on both `VERCEL_ENV` and `NODE_ENV`, and an
unknown Vercel runtime is denied, not treated as local**; that part of the
prior draft's claim still holds, on both signals independently. The gate can
now evaluate `true` on a genuine Vercel preview deployment.

Activation is still not "set `CANONICAL_V2_DARK_BRIDGE=ENABLED_LOCAL_PREPRODUCTION`
in production": that remains impossible by construction regardless of the
preview widening. Activation still means **replacing** the dark bridges with
real serving that satisfies section 4's checklist. At that point the dark
bridges and this gate stop being the serving path at all: ADR-001's removal
condition applies, and the widening does not change that.

### Feature-flag hardening, and one duplicate that remains

`lib/canonical-v2/feature-flags.js` defines five Canonical V2 flags. Four of
them, `CANONICAL_V2_REVIEW_ENABLED` (REVIEW_API),
`NEXT_PUBLIC_CANONICAL_V2_REVIEW_ENABLED` (REVIEW_UI),
`CANONICAL_V2_QUERY_ENABLED` (QUERY_API) and
`NEXT_PUBLIC_CANONICAL_V2_QUERY_UI_ENABLED` (QUERY_UI), were bare truthy
checks with no environment binding until this session; the fifth,
`CANONICAL_V2_PROCESS_PILOT_UI_ENABLED`, already carried its own stricter,
deliberately separate check and an explicit comment that a truthy value
alone must never enable it in production. `pages/api/canonical-v2/review-context.js`
and `exact-detail.js` are real executable routes, not 503 stubs, gated only
by `isCanonicalV2ReviewEnabled`, with a serving path that stamps nothing
about authenticity, so a single env var set in production would previously
have served V2 data with no honesty label. All four are now bound through
`isPermittedCanonicalV2Runtime`, verified directly by reading
`feature-flags.js:33-51`.

**One duplicate was recorded, not fixed.** `components/review-v2/CanonicalReviewSection.jsx`
does not import `lib/canonical-v2/feature-flags.js` at all, verified
directly. At lines 23-26 it reimplements its own inline check on the same
`NEXT_PUBLIC_CANONICAL_V2_REVIEW_ENABLED` env var that
`isCanonicalV2ReviewClientEnabled` already governs, with no call to
`isPermittedCanonicalV2Runtime`:

```js
const ENABLED = ['1', 'true', 'on', 'yes'].includes(
  String(process.env.NEXT_PUBLIC_CANONICAL_V2_REVIEW_ENABLED || '').toLowerCase(),
);
export const CANONICAL_REVIEW_ENABLED = ENABLED;
```

This is display-only, and the real data path is server-gated elsewhere, so
it is not a live gap today. It is exactly the kind of duplication that
produced the original pre-hardening asymmetry, and it will drift the same
way if left. Recorded here so it is not lost; see also section 10, item 6.

Combined receipt, rerun directly in this revision:

```text
node --test tests/canonical-v2-feature-flag-environment-binding.test.js \
  tests/canonical-v2-legacy-card-bridge.test.js \
  tests/canonical-v2-query-ui-routing.test.js \
  tests/canonical-v2-dark-bridge-gate.test.js

41 passed, 0 failed
```

## 8. Open gates that must be closed first

All 25 preproduction gates in
[`docs/codex-program/programme-gates.yaml`](programme-gates.yaml) are
currently `OPEN`, reconfirmed directly against the current file in this
revision. None has closed:

`P1_CONTRACT_BUNDLE_COMPLETE`, `P1_VERTICAL_SLICE_PASS`, `P9_SCOPE_EXACT`,
`P9_REGISTRY_DISPOSITIONS`, `P9_MKT_WORK`, `P9_BEN_RUNBOOK`, `P9_NUMERIC`,
`P9_RENDER_PARITY`, `P9_STRUCTURED_CLAIMS`, `P9_PARTY_LINT`,
`P9_SHADOW_REEXTRACTION`, `P9_IDENTITY_AND_DRIFT`,
`P9_BROWSER_A11Y_PERFORMANCE`, `P9_STAGING_SMOKE_AND_ROLLBACK`,
`P9_DATABASE_SOAK`, `P9_BACKUP_RESTORE`, `P9_PREIMPORT_TRACEABILITY`,
`P9_SECURITY_AUTH`, `P9_DEPLOYMENT_PARITY`, `P9_IMPORT_PARITY`,
`P9_PROMOTION_ELIGIBILITY`, `P9_CUTOVER_AUTHORISATION`,
`P9_POSTCUTOVER_SMOKE`, `P9_TRACEABILITY`,
`P9_PROGRAMME_COMPLETION_ATTESTATION`.

Most directly load-bearing for a native-serving activation question
specifically:

- `P9_RENDER_PARITY`, `P9_STRUCTURED_CLAIMS`: whether a native surface
  actually reproduces what the legacy card shows.
- `P9_IDENTITY_AND_DRIFT`: whether the served claim's identity is stable.
  Section 5 above is directly relevant preparatory work for this gate, not a
  substitute for it.
- `P9_SECURITY_AUTH`: its `acceptance` list is
  `SECURITY_REVIEW_PASS`, `ZERO_UNRESOLVED_CRITICAL_OR_HIGH_FINDINGS`,
  `PRODUCTION_ACCESS_PRECONDITION_VERIFIED`, and it is an explicit
  `prerequisite_for` `CANONICAL_V2_PRODUCTION_CREDENTIAL_ISSUANCE_OR_USE`,
  `INACTIVE_PRODUCTION_IMPORT` and `PRODUCTION_ACTIVATION`.
- `P9_DEPLOYMENT_PARITY`, `P9_IMPORT_PARITY`, `P9_PROMOTION_ELIGIBILITY`,
  `P9_CUTOVER_AUTHORISATION`: the cutover chain itself.
- `P9_TRACEABILITY`, `P9_PROGRAMME_COMPLETION_ATTESTATION`: the latter is
  `terminal: true`, `bundle_frozen: true`, and requires
  `P9_TRACEABILITY_PASS` plus `TERMINAL_COMPLETION_PAIR_PASS`.

The relevant `work_classes` are also `OPEN`: `production_import`
(`opens_when: ALL_PREIMPORT_GATES_INCLUDING_P9_SECURITY_AUTH_PASS`),
`production_cutover`
(`opens_when: M4_PRE_CUTOVER_PASS_AND_ONE_USE_BEN_AUTHORISATION`), and
`security_hardening`
(`opens_when: BEFORE_ANY_CANONICAL_V2_PRODUCTION_CREDENTIAL_INACTIVE_IMPORT_OR_ACTIVATION`).
Tier A pre-cutover controls (`tier_a_pre_cutover.state: ACTIVE`) remain in
force throughout, including
`NO_EXTRACTION_REPLAY_BACKFILL_OR_LOAD_TEST_AGAINST_PRODUCTION` and
`NO_SERVICE_CREDENTIAL_IN_BROWSER_CODE`.

## 9. Risks and explicit non-goals

- **Dark data must never be promoted.** `lib/query/dark-authority-fence.js`
  provides `assertNoDarkAuthorityRecords`, `assertRowIsServable`,
  `filterDarkAuthorityRecords` and `hasDarkAuthority`, rejecting any record
  whose `authority_state` (or `provenance.canonical_v2_authority_state`) is
  `VALIDATED_NOT_SERVED`, or whose `source_authentication_state` (or
  `provenance.source_authentication_state`) is
  `SOURCE_UNAUTHENTICATED_EXTERNAL_BOUNDARY`. This now covers all four
  bridges' output, not just Material Contracts'. Any future served consumer
  for the four areas must call these guards, not reimplement the check.
  ADR-001 makes the same point at the architectural level: flattened cards
  must never be written to `public.provision_cards`, `claims`, or any other
  persistent store, for any of the four areas, ever.
- **`SOURCE_UNAUTHENTICATED_EXTERNAL_BOUNDARY` and `VALIDATED_NOT_SERVED`
  records must never enter Query, Compare or market.** Handoff section 22
  records the posture precisely: "Query and market safeguards reject dark
  objects when `authority_state` is present on supplied in-memory records.
  The current live query and market database selectors do not select that
  field. Therefore this is defensive local containment, not end-to-end
  product enforcement." The real backstop today is that live selectors never
  fetch dark rows at all, because no bridge is in the query/database path.
  That is a property of today's isolation, not a guarantee that survives
  activation work automatically. Every new served path must wire the fence
  in explicitly. Handoff section 39 records a family-agnostic regression
  (`tests/canonical-v2-dark-bridge-product-rejection.test.js`) proving all
  four dark markers are rejected at seven hard fence call sites; not
  independently rerun in this revision.
- **The legacy rendering must not be retired before the native path proves
  equivalent** (handoff section 5, item 4: "Only after the bridge works may
  the corresponding parity rows become natively visible").
- **The shared `Canonical V2 Preview` lane is itself scaffold-shaped, and
  this is no longer an open inconsistency.** At the prior draft, the four
  areas disagreed with each other on whether a dark preview should be
  visible at all; that inconsistency is resolved (section 2 above, Ben's
  ruling 1). What replaces it as the live risk: ADR-001 records that "the
  Review preview lane built under ruling 1 depends on bridged cards, so it
  is scaffold-shaped too. It must not be mistaken for the eventual native
  Review surface, and it inherits this record's removal condition." The lane
  is also, as of this revision, not wired into any served or Vercel-preview
  route (section 2 above), so today the risk is latent, not live, but it
  will become live the moment queue item 17 executes, and the same
  discipline (fence-wiring, no persistence, no mistaking it for native
  serving) must travel with that activation.
- **The seven-route 503 containment (`lib/query-containment.js`) must not be
  quietly narrowed to make a blocker count improve.** Any change to which
  routes count as contained is a decision in its own right, not a
  side-effect of activation work.
- **A gate is not a precondition.** Toggling `dark-bridge-gate.js`'s env var
  in any environment, including the now-permitted Vercel preview, must never
  be treated as substituting for the two real preconditions in section 4.
  The gate stops dark integration leaking into production; it says nothing
  about whether a surface is genuinely served.
- **`NATIVE_UNVERIFIED` is not "closer to done."** The register also carries
  73 `NATIVE_UNVERIFIED` surfaces, outside this package's four areas. They
  are a different bucket (disposition already claims
  `NATIVE_COMPLETE`/`APPROVED_DERIVED` but proof is missing) but face the
  same two preconditions in section 4, and 19 of them face the additional
  locator problem in section 6. Nothing here should be read as ranking them.
- **A bare pass count is a claim, not evidence.** Handoff section 37 records
  that of eight historical receipts checked for reproducibility, only the
  two recorded together with their exact command reproduced; the six
  recorded as bare numbers did not, despite nothing having regressed. Every
  receipt in this revision is stated with the exact command that produced
  it, for the same reason.

## 10. Decisions required from Ben, consolidated

This supersedes the decisions list in the prior draft of this package.
Several items on that list have since been ruled on directly by Ben (handoff
section 45) or resolved by delegation back to the engineering lane (handoff
sections 49-50). They are not repeated below as open items, but are listed
here once for continuity:

- Whether a dark preview lane should exist at all: **ruled**, one consistent
  `Canonical V2 Preview` lane for all four areas (ruling 1), now built
  (section 2 above).
- Activation order: **ruled**, Review preview for all four together, then
  the trusted source-admission boundary, then Compare, then Query, then
  Market, then a production activation package for Ben's later approval
  (ruling 3).
- Whether to extend the preview pattern to all four areas or deliberately
  decouple it as policy: **ruled and implemented**, same lane for all four
  (ruling 1).
- Local-shell-only sufficiency for the dark-bridge gate: **ruled**, widened
  to Vercel preview under a shared allowlist, production still hard-off on
  both `VERCEL_ENV` and `NODE_ENV` (ruling 2, implemented, section 7 above).
- `termination-fee-query-derived-values`'s resting state: **ruled**, stays
  `DERIVED_INTEGRATED_NOT_SERVED` until the Query route is actually active
  in preview (ruling 4); a standing constraint on that future work, not a
  live open question.
- The H1 strict-locator question, module-level proof versus the exact named
  export: **ruled**, build transitive call analysis (ruling 5), now
  implemented (section 6 above).
- The `provision_cards_excerpt_unique` index, and the item-17 preview data
  source (fixtures, not Canonical V2 staging): both **delegated to
  engineering and resolved there** (section 5 above; handoff sections
  49-50). Not open Ben decisions.
- The table-driven locator verifier (section 6 above): **ruled, deferred**,
  with a corrected premise. `fieldsForCompareCell`'s three-field limit
  belongs to the Query product's `DEAL_COMPARE` cross-deal comparison grid,
  not the review page or a full document view (handoff section 62). Ben's
  actual intent for Compare is a full side-by-side agreement view, for
  which the limit is irrelevant. Do not build the verifier until the target
  Compare surface is settled; the 17 affected rows may need re-registering
  if that surface is superseded.
- Source trust for corpus-level admission: **ruled**, a human review state,
  not the proposal-stage cryptographic controller and key registry (handoff
  section 62; section 11 below). The activation-order ruling above keeps
  its place for the trusted source-admission boundary; only its shape
  changes.

The items below remain genuinely open.

1. **Rank 99 remains on Made Available, Ordinary Course, Material Contracts
   and General Covenants.** No exact rank has ever been approved for any of
   the four. Carried over unchanged from every prior draft.
2. **A closed representation-subject catalogue for Representations.**
   Handoff section 6 flags this as open and unruled, and section 43
   confirms none has been invented in the meantime, reconfirmed directly in
   this revision (section 2.4 above). Still open.
3. **The Compare-slice finding (section 6 above).** Not a request for a
   ruling on register mechanics, but Ben should know that `appraisalFact`,
   `dollarThreshold`, `dividendFact` and `parentApprovalMechanism` are
   plausibly never shown in a live `DEAL_COMPARE` response today,
   independent of parity status, and decide whether that is worth its own
   investigation now or later.
4. **The `dno-query-compare-fields` / `employee-query-compare-fields`
   duplicate locator (section 6 above).** Both currently assert an
   identical, non-distinguishing `COVENANT_OTHER` fact. Worth correcting for
   register honesty; does not clear either row either way. Low priority,
   included for completeness rather than urgency.
5. **The `CanonicalReviewSection.jsx` duplicate flag logic (section 7
   above).** Not a live gap today, but a second, un-hardened copy of exactly
   the pattern that produced the original production-exposure risk this
   package's predecessor closed. A small fix, not a judgement call; flagged
   here so it is not lost before it drifts.
6. **The name of the positive, document-scoped source-verification state
   (section 11 below).** Ben ruled the model: a human review state, not a
   cryptographic one. The name itself is still open. It is embedded in a
   versioned, hash-bound record format, so it is expensive to change once
   chosen, and it must denote document-level verification specifically, not
   corpus completeness, so that corpus completeness can later become a
   second, independent human-owned state rather than silently redefining
   the first.
7. **Amendment handling's market-comparison basis, as-signed or as-amended
   (section 12 below).** Planned, not built, so not urgent, but flagged
   here so it is not lost: when a term is amended, market statistics need a
   deliberate, labelled choice of which value is "the" value for comparison
   purposes.

## 11. Source trust is a human review state, not a cryptographic one

This section records Ben's ruling of 2026-08-05 (handoff section 62,
Decision 2) on the trusted source-admission boundary referenced in section 2
above and in the activation-order ruling in section 10 above. It fixes a
design direction. It does not build anything: the boundary itself remains
outstanding, and this ruling does not itself close any gate in section 8
above.

**What Ben ruled against.** A corpus-level trusted controller and key
registry, run as the route to proving a deal's document set is complete and
authentic. This is not hypothetical: it is the live shape of five contract
modules named in `REQUIRED_AUTHORITY_BOUNDARY_CONTRACT_SOURCES`
(`lib/canonical-v2/phase1-authority-boundary-inventory.js:95-101`), verified
directly in this revision: `lib/canonical-v2/governed-identity-trust-contracts.js`,
`lib/canonical-v2/deal-identity-trusted-key-registry-proposal.js`,
`lib/canonical-v2/source-intake-readiness.js`,
`lib/canonical-v2/dark-integration-preflight.js` and
`lib/canonical-v2/native-producer/durable-12-item-pilot-readiness.js`. All
five are registered `PURE_PROPOSAL` in the same inventory file, confirmed
directly against the current `PURE_PROPOSAL_SOURCES` list, and the handoff
describes them as hardwired to throw rather than execute. Ben's ruling means
this layer is not the route to corpus-level trust. It does not retire these
modules, and no gate or register status changes because of this ruling: that
would be a separate, unauthorised act (section 1 above).

**Ben's design instead.**

- Track source status as **not human verified** by default. A deal's
  document set is legitimately open: amendments and further documents can
  always appear (see section 12 below for exactly this case).
- Provide a control for a human to verify the source set.
- Allow a human to instruct an AI about further documents, rather than
  requiring a signed authority to assert completeness.

**Why this is the better fit, in Ben's own framing.** It converts an
authority-proof problem, which needs key custody, an external controller and
signature verification that do not exist today, into a review-state problem,
which this codebase already models well elsewhere. It is also a materially
smaller build. It matches the real-world fact pattern more honestly: corpus
completeness is a judgement someone makes and can revise, not a fact that
can be cryptographically proven.

**The naming consequence, and why it is now an open decision rather than a
closed one.** The positive state this design needs (a document has been
human-verified) has no name anywhere in the codebase today. Only the
negative half of a related axis exists: every one of the four dark bridges
already stamps `source_authentication_state:
'SOURCE_UNAUTHENTICATED_EXTERNAL_BOUNDARY'` on everything it produces
(section 9 above), but nothing marks the positive case. Whatever name is
chosen is embedded in a versioned, hash-bound record format and is expensive
to change once live records exist under it. It must denote **document-level
verification specifically**. If it is named loosely enough to also mean
"this deal's document set is complete", a later, independent
corpus-completeness review state cannot be added without either colliding
with it or silently redefining what the first name meant. Ben's ruling is
explicit on this: two axes, not one scale. Carried into section 10 above as
an open naming decision; not resolved by this section.

### The two live-infrastructure checks: deprioritised, not answered

Ben has deprioritised two checks that need someone with Supabase access and
cannot be done from the repository: how the staging verified-filing records
(`source_admission_manifests`) were populated, and what the
`canonical_v2_preview` pooler role is actually granted. They remain open
(handoff section 62, following on from the scoping in handoff section 45).
Deprioritised is not the same as answered: do not treat either question as
closed, and do not infer an answer from its absence elsewhere in this
package.

## 12. PLANNED, NOT BUILT: amendment handling

**Status: PLANNED, NOT BUILT.** Ben's instruction: think it through, add it
to the plan, do not build it (handoff section 63). Nothing in this section
exists in code. It does not change the status of any of the four areas, any
parity row, or any gate in section 8 above.

### The problem

A deal's SEC filings are not one document. A later filing may be a full
amended and restated agreement, or an amendment that modifies specific
sections of an existing one. These need different treatment, and the
classification is not always obvious from the filing type alone.

### Ben's stated shape

1. If it is a **full agreement**, store it as a separate agreement.
2. If it is an **amendment**, parse what it changed against the existing
   agreement and show that in the review tab.

### Design thinking, for a later build

**Classification must fail closed.** Signals include the title ("AMENDED
AND RESTATED AGREEMENT AND PLAN OF MERGER" versus "AMENDMENT NO. 1 TO..."),
whether a full article structure is present, document length, and operative
language such as "is hereby amended to read as follows". Getting this wrong
is expensive in both directions: treating a restatement as an amendment
loses the document's structure, and treating an amendment as a full
agreement creates a phantom agreement with almost no provisions. Ambiguous
cases must go to human review, not be guessed.

**Full restatement path.** Store as its own agreement, linked to the
predecessor by an explicit relationship and an effective date. Extraction
runs normally. The review surface must make clear which version is being
read and offer the predecessor.

**Amendment path, the harder one.** An amendment expresses operations, not
prose. At minimum: restate a section in its entirety; delete specified words
and substitute others; insert a new subsection; delete a subsection; amend a
defined term; amend a schedule or exhibit. Parsing must capture the target
reference, the operation, and the new text, and must fail closed when the
target cannot be resolved to an existing provision unambiguously.

**Two representations will be needed, and they answer different
questions.** The delta view Ben asked for answers "what changed". A
materialised effective text answers "what does the agreement say now",
which is what extraction and cross-deal comparison need. Storing only the
delta means every downstream consumer has to recompute the effective text;
storing only the effective text loses the "as amended" trace. Expect to
need both, with the delta as the display artefact and the effective text as
the extraction input.

**The legal-judgment question this forces, which is Ben's to answer.** When
a term is amended, which value is "the" value for market comparison: as
signed, or as amended? A termination fee that changed between signing and
closing has two true answers. Market statistics must pick one deliberately
and label it, or the comparison silently mixes bases. This is the same
class of decision as the derived-comparison FX and period rules, and should
be recorded as a ruling when the feature is built. Tracked as an open
decision in section 10 above.

**Interaction with work already done.** Ruling 6 already requires card
identity to bind the source revision (section 5 above). That anticipated
exactly this: an amendment introduces a second source document for the same
deal, so provisions from the base and the amendment must be distinguishable
by revision, not merely by deal and provision. The offset-based quote
verification designed in handoff section 61 also becomes more important,
because a quote must be attributed to the correct document, and "this text
appears in the source" is meaningless when there are two sources.

**Failure mode to design against.** Silently overwriting base-agreement
provisions with amended ones. Supersession must be explicit and additive so
the original remains readable and citable.

**Test case.** Metsera is the only deal currently known to carry an
amendment, so it is the natural first fixture.

---

Confirmed before finishing this revision:
`docs/codex-program/specification-manifest.json` was not modified. Checked
directly, its `files` array still lists exactly six members
(`docs/CODEX-PROGRAM.md`, `docs/codex-program/EXECUTION-LEDGER.md`,
`docs/codex-program/programme-gates.yaml`,
`docs/codex-program/m3-family-parity-register.json`,
`docs/codex-program/canonical-contracts.md`,
`docs/codex-program/adversarial-tests.md`). This file,
`docs/codex-program/CANONICAL-V2-ACTIVATION-PACKAGE.md`, is not one of them,
confirmed directly against that array. Nothing in this revision froze,
adopted, activated, imported or deployed anything; production authority
remains `NONE`.
