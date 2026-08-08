# Topology Investigation

Status: COMPLETE
Branch: claude/codex-handoff-plan-status-77wn7n
Date: 2026-08-08
Scope: read-only investigation + spec. No prompt files edited. No commits made.

---

## Task 1: `lib/schema/topology-detector.js` — exact contract, read from code

File has **no header comment at all** (checked — first line is `const TOPOLOGIES = {`),
so there is no header/behaviour divergence to report for this file specifically. The
divergence, where it exists, is between what a caller *implies* the module does
(distinguishes forward vs. reverse triangular) and what the module *actually* does
(see below).

**Codes defined: 7** — `SINGLE_MERGER`, `FORWARD_TRIANGULAR`, `REVERSE_TRIANGULAR`,
`TWO_STEP_TENDER`, `DOUBLE_DUMMY`, `MULTI_STEP_REORG`, `OTHER`.

**Codes `deriveTopology()` can actually produce on its own: 5** —
`OTHER` (0 steps), `TWO_STEP_TENDER`, `DOUBLE_DUMMY`, `MULTI_STEP_REORG`, and for a
single step, whatever `opts.singleStepTopology` says, **defaulting to `SINGLE_MERGER`**.

`FORWARD_TRIANGULAR` and `REVERSE_TRIANGULAR` are **not reachable from the function's
own logic**. They exist only as possible values of `opts.singleStepTopology`, an
argument no caller in this repository ever passes (see Task 2) — every real call site
passes `opts` empty, so single-step deals always land on `SINGLE_MERGER` regardless of
whether the underlying merger is forward- or reverse-triangular. This is a real
capability gap, not a paraphrase: **2 of the 7 declared codes are structurally dead
code today.**

**Exact input contract** — `deriveTopology(steps, opts)`:
- `steps`: array of step objects, each needing (for the branches that matter):
  - `step_order` (coerced with `Number(...)`; used only for sorting and consecutiveness)
  - `step_kind` (string; matched literally against `'TENDER_OFFER'`, `'BACK_END_MERGER'`,
    `'MERGER'`, `'SUBSEQUENT_MERGER'`)
  - `surviving_entity`, `disappearing_entity`, `parent_entity` (strings; used only by
    `stepChainingWarnings`, not by `deriveTopology` itself)
- `opts`: `{ needsReview, reviewNote, singleStepTopology }`, all optional.

Falsy/missing entries in `steps` are filtered out before sorting (`.filter(Boolean)`).

**Branch logic, precisely:**
- 0 steps → `OTHER`, `topology_needs_review: true`.
- ≥3 steps → `MULTI_STEP_REORG` (no further inspection of `step_kind` at all).
- Exactly 2 steps → looks at `[kind0, kind1]`:
  - `['TENDER_OFFER','BACK_END_MERGER']` → `TWO_STEP_TENDER`
  - `['MERGER','SUBSEQUENT_MERGER']` → `DOUBLE_DUMMY`
  - anything else → `MULTI_STEP_REORG`, forced `topology_needs_review: true`
- Exactly 1 step → `opts.singleStepTopology || 'SINGLE_MERGER'`.

**Chaining invariants, precisely** (`enforceTransactionStepInvariants`):
- Throws if `steps.length === 0`.
- Throws (`assertConsecutiveSteps`) unless `step_order` values are exactly `1, 2, 3, …`
  with no gaps, after numeric sort.
- Throws if topology is `SINGLE_MERGER` but there isn't exactly 1 step.
- Throws if topology is `DOUBLE_DUMMY` but there aren't exactly 2 steps.
- Throws if topology is `TWO_STEP_TENDER` but the two `step_kind`s aren't exactly
  `TENDER_OFFER,BACK_END_MERGER` in that order.
- Returns `{ warnings }` from `stepChainingWarnings`, which is **advisory, not
  enforced**: for each consecutive pair, lower-cases and trims
  `prior.surviving_entity` and `current.disappearing_entity`; if they're equal, or if
  `current.disappearing_entity` contains a shared `parent_entity` substring, no
  warning; otherwise pushes `"Step N does not clearly chain from step N-1."` **This
  never throws** — a non-chaining pair is reported, not rejected.

Net: the detector is a small, mechanical, well-tested (for what it tests — see Task 2)
piece of logic. It does no text understanding at all; every field it reads must already
be present, canonicalised, and — critically for chaining — the entity names must use
the *same string* for "the thing step 1 produced" and "the thing step 2 consumes",
which is not simply "the target's name" (see Task 4 finding on entity naming).

---

## Task 2: V1 callers and V1 evidence

**Grep summary** (`grep -rn "deriveTopology\|enforceTransactionStepInvariants" --include=*.js`,
worktree copies under `.claude/worktrees/` excluded as duplicates of the same files):

Real callers, both under `lib/parser-v2/` (V1's legacy pipeline, confirmed legacy by
`docs/core/CODEBASE-GUIDE.md` §4.1/4.2 — "V1's ingest path... legacy pipeline only"):

- `lib/parser-v2/detectors/transaction-steps.js` — `extractTransactionSteps(sections, opts)`
  is a **regex/heading-pattern detector over raw section text** (not an LLM call). It
  looks for `acceptance time`/`251(h)`/`the offer` language for tender deals, `first
  merger` + `second|subsequent merger` language for double-dummy, and falls back to a
  single `MERGER` step otherwise. It calls `deriveTopology`/`enforceTransactionStepInvariants`
  directly (`modelForSteps`). **It never passes `opts.singleStepTopology`** — so even in
  V1's real pipeline, `FORWARD_TRIANGULAR`/`REVERSE_TRIANGULAR` are never emitted; the
  single-step branch always falls through to `SINGLE_MERGER`.
- `lib/parser-v2/store.js` — `materializeTransactionSteps` calls
  `model.topology || deriveTopology(model.steps)` (again no opts) and writes to a
  `deal_topology` Postgres table + `transaction_steps` table.

A false-positive grep hit worth naming explicitly, because it looked like a second V2
caller and was not: `lib/canonical-v2/canonical-contract-bundle-generated-topology.js`
matches `topology` in its *name*, but this is an unrelated subsystem — "topology" there
means the internal assembly graph of a generated contract-bundle governance artefact
(query definition roots, applicability registries, lock plans), nothing to do with M&A
deal structure. It does not `require('../schema/topology-detector')` or anything like
it. **Confirms the background claim: nothing under `lib/canonical-v2/` references
`lib/schema/topology-detector.js`.**

Other hits are non-callers: `lib/admin/processing-flow-stages.js` only *names the file
path* in a manifest-of-files-that-exist list (line 32, a path string, not a require);
`components/review/table-configs/structure-mechanics.config.js` has a comment
mentioning "topology-detector.js" by name but does not import it.

**Test suite:** `tests/schema/transaction-steps/detector.test.js` (3 tests, exercises
`extractTransactionSteps` against hand-written synthetic agreement text for a
General-Dynamics-shaped tender deal, a double-dummy-shaped deal, and a Conoco-shaped
single merger) and `tests/schema/transaction-steps/invariants.test.js` (2 tests, direct
invariant-violation checks). Ran both:

```
CI=true node --test tests/schema/transaction-steps/detector.test.js tests/schema/transaction-steps/invariants.test.js
```
Exit code 0. `# tests 5 / # pass 5 / # fail 0`. **Passes today.**

**Is there stored evidence of it classifying real deals correctly?** No. The only
tests are against short hand-authored synthetic text fixtures, not real agreement
excerpts, and not run through the real database-backed pipeline
(`scripts/backfill-transaction-steps.js`, which needs live Supabase credentials this
investigation does not have and should not use per read-only scope). **The honest
statement is: "it exists, it is unit-tested against synthetic fixtures, and it is wired
into a real V1 write path" — there is no evidence in this repository of it having been
run against a real filed merger agreement and validated against the right answer.**
Whether `deal_topology` rows exist in the live database for real deals is uncertain
from a repo-only investigation; settling it needs a DB query this task didn't run.

---

## Task 3: What V2 actually has — MERGER_STRUCTURE_CLOSING claim inventory

Evidence root: `evidence/canonical-v2/<deal>-<family>-<date>-<tag>/adapter-result.json`,
`.write_set.claims[]`. Found runs for **7 deals**, not 6 — `modiv` uses an older tag
(`modiv-merger-structure-20260807-replay`, family folder name predates the
`-closing` suffix used by the other six) and would be missed by a naive
`grep merger-structure-closing`.

| deal | folder | claims | claim_kind(s) | attribute keys (union) | assertion_kind values present |
|---|---|---|---|---|---|
| concho | concho-merger-structure-closing-20260808-r1 | 12 | MERGER_STRUCTURE_MECHANIC_PRESENT | answer_provenance, assertion_kind | ACTIONS, BOARD_DESIGNATION, CLOSING_LOCATION, CLOSING_TIMING, DIRECTORS, EFFECTIVE_TIME, EFFECTS |
| metsera | metsera-merger-structure-closing-20260808-r1 | 10 | MERGER_STRUCTURE_MECHANIC_PRESENT | answer_provenance, assertion_kind | ACTIONS, CLOSING_LOCATION, CLOSING_TIMING, DIRECTORS, EFFECTIVE_TIME, EFFECTS |
| redhat | redhat-merger-structure-closing-20260808-r1 | 10 | MERGER_STRUCTURE_MECHANIC_PRESENT | answer_provenance, assertion_kind | ACTIONS, CLOSING_LOCATION, CLOSING_TIMING, DIRECTORS, EFFECTIVE_TIME, EFFECTS |
| skechers | skechers-merger-structure-closing-20260808-rung3 | 12 | MERGER_STRUCTURE_MECHANIC_PRESENT | answer_provenance, assertion_kind | ACTIONS, CLOSING_LOCATION, CLOSING_TIMING, DIRECTORS, EFFECTIVE_TIME, EFFECTS |
| skywater | skywater-merger-structure-closing-20260808-r1 | 17 | MERGER_STRUCTURE_MECHANIC_PRESENT | answer_provenance, assertion_kind | ACTIONS, CLOSING_LOCATION, CLOSING_TIMING, DIRECTORS, EFFECTIVE_TIME, EFFECTS |
| topbuild | topbuild-merger-structure-closing-20260808-rung4 | 21 | MERGER_STRUCTURE_MECHANIC_PRESENT | answer_provenance, assertion_kind | ACTIONS, CLOSING_LOCATION, CLOSING_TIMING, DIRECTORS, EFFECTIVE_TIME, EFFECTS |
| modiv | modiv-merger-structure-20260807-replay | 20 | MERGER_STRUCTURE_MECHANIC_PRESENT | answer_provenance, assertion_kind | ACTIONS, CLOSING_LOCATION, CLOSING_TIMING, EFFECTIVE_TIME, EFFECTS |

**Correction to the background brief:** `assertion_kind` is not limited to
`ACTIONS`/`EFFECTS`. The full enum, read from the prompt's `RESPONSE_SHAPE` literal
(`lib/canonical-v2/native-producer/merger-structure-producer-prompt.js`, read-only —
not edited) is: `DIRECTORS | EFFECTS | ACTIONS | CLOSING_LOCATION | CLOSING_TIMING |
EFFECTIVE_TIME | SHORT_FORM_251H | TOP_UP | SUBSEQUENT_OFFERING | SCHEDULE_TO_14D9 |
STOCKHOLDER_LIST | BOARD_DESIGNATION` — 12 values (the same list appears as
`STRUCTURE_SURFACES` in `lib/canonical-v2/native-producer/anthropic-provider.js:263`).
Every claim's attribute object is exactly `{ assertion_kind, answer_provenance }` — no
richer fields, for any deal, any assertion_kind. This is enforced mechanically, not
just by prompt convention: `lib/canonical-v2/native-producer/candidate-resolution.js`
line ~10194 routes every `MERGER_STRUCTURE_CLAIM_KEY` candidate through
`handlePresenceCarrier(...)`, whose body (line ~9010) hard-codes
`attributes: { assertion_kind: kind }` and discards everything else on the candidate.
**So the "no step_kind/entities" gap is enforced in two independent places: the prompt
never asks the model for them, and the resolver would strip them even if it did.**

**Does the quote text carry enough for a human to name the topology?** Yes, for the
`ACTIONS`/`EFFECTS`-tagged claims specifically, in all 7 deals. Example raw `ACTIONS`
quotes pulled directly from the recorded evidence (verbatim, byte-anchored to admitted
source text — this stands in for reading the underlying SEC filing directly, since
these are exact excerpts of it with a recorded evidence chain):

- concho: *"Merger Sub will be merged with and into the Company in accordance with the
  provisions of the General Corporation Law of the State of Delaware"* — one merge
  action, single-step.
- skywater: *"Merger Subsidiary 1 shall be merged with and into the Company..."* **and**
  *"the First Surviving Corporation shall be merged with and into Merger Subsidiary
  2..."* — two merge actions, second one consuming the first one's product.
- topbuild: *"Titanium Merger Sub shall be merged with and into the Company..."* **and**
  (tagged `EFFECTS`, not `ACTIONS` — see note below) *"the Titanium Surviving
  Corporation shall be merged with and into Forward Merger Sub..."* — same two-step
  chain shape as skywater.
- modiv: *"the Company shall be merged with and into Company Merger Sub"* **and**
  *"OpCo Merger Sub shall be merged with and into the Partnership"*, plus an explicit
  simultaneity clause: *"the parties shall cause the Company Merger Effective Time and
  the OpCo Merger Effective Time to occur on the Closing Date, with the OpCo Merger
  Effective Time occurring contemporaneously with or immediately after the Company
  Merger Effective Time."* — two merge actions, but **not chained**: `Company Merger
  Sub` (the step-1 survivor per `"Parent shall be the sole member and manager of the
  Surviving Company"`) is not the entity that disappears in step 2 (`OpCo Merger Sub`).
  This is a REIT/UPREIT-style **parallel dual merger** (the public REIT entity and its
  operating partnership merge separately, at essentially the same moment), structurally
  different from skywater/topbuild's sequential chain.

**Finding that changes the crux:** the same underlying fact ("X shall be merged with
and into Y") is **inconsistently tagged** across deals — `ACTIONS` in concho/metsera/
redhat/skywater/topbuild(step 1)/modiv, but `EFFECTS` in skechers (all three of its
merger-consequence sentences, including the merge action itself) and in topbuild's
second step. Any consumer that filters on `assertion_kind === 'ACTIONS'` to find "the
merge events" will silently miss real merge actions in at least 2 of 7 deals. This is
a governed-taxonomy/rubric issue in the existing prompt, independent of the new fields
this investigation is scoping — worth flagging to whoever owns the merger-structure
prompt, not something to silently work around in the detector.

**Crux verdict:** the quotes carry the information; the attributes do not. The gap is
squarely in the producer prompt (never asks for `step_kind`/entities) and the resolver
(`handlePresenceCarrier` strips anything beyond `assertion_kind` even if the model
supplied it). The detector itself needs no code change to consume correctly-shaped
input — see Task 4.

---

## Task 4: Dry-run attempt

Script (read-only, scratchpad-only, not committed):
`/tmp/claude-0/-home-user-precedent-machine/3942dbbb-1014-51f3-a689-d0286bab5211/scratchpad/topology-dryrun.js`

**Part A — feed the real V2 claim shape as-is, no invented fields.** For every deal,
`claim.attributes` (`{ assertion_kind, answer_provenance }`) was passed directly as the
`steps` array with no modification. Result: `deriveTopology` did not throw (nothing in
it actually validates required keys), but the output is **meaningless**: every entry
lacks `step_order` (so `Number(undefined) = NaN`, sort is a no-op) and lacks
`step_kind` (so no 2-step branch can ever match). Every deal landed on
`MULTI_STEP_REORG` with `step_count` equal to its raw claim count (12, 10, 10, 12, 17,
21, 20) purely because `steps.length >= 3` — an artefact of "how many claims does this
family emit," not a real topology signal. **This is the honest, unmodified-input
answer: the detector cannot be usefully wired to today's V2 output. It doesn't error
loudly, which is itself worth flagging — a caller who wires this up carelessly gets a
silently wrong `MULTI_STEP_REORG` on every deal, not a helpful crash.**

**Part B — proxy regex extractor over the already-extracted quote text (explicitly
not a proposed implementation).** A narrow regex (`X shall be merged with and into Y`)
was run over each deal's `ACTIONS`-tagged raw_value quotes only, to test whether the
underlying text supports real step/entity extraction. Findings:

- concho, skechers, modiv: **0 matches** — not because the deals lack the language
  (skechers/modiv's merge language exists, see Task 3), but because the regex only
  scanned `ACTIONS` claims and, per the tagging-inconsistency finding above, those
  three deals have their merge-action sentence tagged `EFFECTS` or use "will be merged"
  phrasing my narrow pattern didn't cover. This is exactly the kind of proxy failure
  that would manufacture a false "single-step" or "no signal" result if trusted
  uncritically — flagged, not smoothed over.
- metsera, redhat: 1 match each, correctly `SINGLE_MERGER`, no warnings.
- skywater: 2 matches, correctly ordered `MERGER` → `SUBSEQUENT_MERGER`, topology
  `DOUBLE_DUMMY`, but the chaining check **fired a warning**: `"Step 2 does not
  clearly chain from step 1"`, because step 1's regex-captured `surviving_entity` was
  the literal string `"the Company"` while step 2's `disappearing_entity` was `"the
  First Surviving Corporation"` — textually different, even though they refer to the
  same legal entity (the agreement's own `EFFECTS` clause says *"the Company shall
  continue as the surviving corporation in the First Merger"*, i.e. it becomes the
  First Surviving Corporation). **This is the single most important implementation
  finding**: `surviving_entity` must be captured as the entity's *post-merger defined
  name* (the term the agreement itself assigns, e.g. "First Surviving Corporation"),
  not the pre-merger participant name, or the chaining invariant will spuriously flag
  every real double-dummy/sequential structure as non-chaining.
- topbuild: 1 match only (its second merge sentence is tagged `EFFECTS`, out of scope
  for this narrow probe) — again a proxy artefact, not evidence the deal is
  single-step. Manually confirmed from the Task 3 quotes it is a real two-step chain
  structurally identical in shape to skywater's.

**Conclusion, stated plainly per the instruction not to fabricate a green result:** the
detector cannot be fed from existing V2 data without inventing fields. A regex proxy
over the model's own quotes shows the *information* needed is present in the text (this
supports "the gap is the prompt, not the detector"), but the proxy itself is too crude
to trust as an interim substitute — the `ACTIONS`/`EFFECTS` tagging inconsistency alone
would produce wrong answers for 3 of 7 deals if anyone shipped it. This should not be
built as a stopgap; the fields belong in the prompt/resolver, done once, correctly.

---

## Task 5: Implementation spec

### 5.1 Real-answer inventory (verified against extracted agreement quotes, not asserted)

| deal | steps | shape |
|---|---|---|
| concho | 1 | single reverse-triangular merger |
| metsera | 1 | single reverse-triangular merger |
| redhat | 1 | single reverse-triangular merger |
| skechers | 1 | single reverse-triangular merger |
| skywater | 2 | sequential chain: Merger Sub 1 → Company (First Surviving Corp), then First Surviving Corp → Merger Sub 2 (an LLC) |
| topbuild | 2 | sequential chain: Titanium Merger Sub → Company (Titanium Surviving Corp), then Titanium Surviving Corp → Forward Merger Sub (an LLC) |
| modiv | 2 | **parallel**, not sequential: Company → Company Merger Sub, and (separately, contemporaneously) OpCo Merger Sub → Partnership |

**Challenge to the proposed acceptance test.** The task frame states "SkyWater
classifies as a two-step chain... the other six deals come out single-step." That is
**not what the evidence shows**: 3 of 7 deals (skywater, topbuild, modiv) are
multi-step, not 1 of 7, and they are not all the same shape. Recommend replacing the
7-deals/1-multi-step test with:

- concho, metsera, redhat, skechers → `SINGLE_MERGER`, 1 step, no warnings.
- skywater, topbuild → 2 steps, `step_kind` sequence `MERGER, SUBSEQUENT_MERGER`,
  topology `DOUBLE_DUMMY`, **zero** chaining warnings (this is the real bar: it
  requires `surviving_entity`/`disappearing_entity` to be captured as matching defined
  terms across steps, per the Task 4 finding — a naive extraction will fail this).
- modiv → 2 steps, but `step_kind` sequence does **not** match either 2-step branch in
  `deriveTopology` (it isn't `TENDER_OFFER,BACK_END_MERGER` and it isn't
  `MERGER,SUBSEQUENT_MERGER` — see 5.4 on why it shouldn't be forced into either) →
  `MULTI_STEP_REORG`, `topology_needs_review: true`, **and** a chaining warning (since
  step 1's survivor genuinely is not step 2's disappearing entity — this is a *correct*
  warning, not a defect to suppress).

Also worth an explicit secondary check: **also confirm no false positive** — verify
concho/metsera/redhat/skechers do NOT contain a second, unnoticed merger step
elsewhere in the agreement outside the extracted MERGER_STRUCTURE_CLOSING sections
(out of scope for this investigation; flag for whoever builds the acceptance test that
"came out single-step" needs to mean "and we checked there wasn't a second merger step
we simply didn't extract," not just "the extractor emitted one step").

**On the `DOUBLE_DUMMY` label itself:** worth flagging to whoever owns the taxonomy,
not blocking this spec. Neither skywater nor topbuild is a "double dummy" in the
standard M&A sense (a new HoldCo, with *both* original companies becoming its
subsidiaries). Both are a reverse-triangular merger immediately followed by a
downstream conversion into an LLC merger sub — a distinct, common tax-driven structure,
but the *acquirer* (Parent) doesn't change, and there's no new HoldCo. The existing
detector will still label this `DOUBLE_DUMMY` because its rule is purely
`step_kind` sequence (`MERGER` → `SUBSEQUENT_MERGER`), not structural verification of a
HoldCo. This is either an acceptable simplification worth documenting explicitly in
`labelForTopology`'s docstring/label text, or a real naming defect — flagged for a
human decision, not resolved here.

### 5.2 Prompt field additions needed

File: `lib/canonical-v2/native-producer/merger-structure-producer-prompt.js` (11
lines — **not edited by this investigation**, per the task's explicit instruction; the
concurrent agent may already be touching it). The `RESPONSE_SHAPE` and `INSTRUCTIONS`
literals need a new top-level array, distinct from `structure_assertions` and
`structure_mechanics` (both of which are `assertion_kind`-tagged quotes with no
structured payload today), something like:

```
"transaction_steps":[{
  "step_order": <integer, 1-based, consecutive>,
  "step_kind": "MERGER | SUBSEQUENT_MERGER | TENDER_OFFER | BACK_END_MERGER",
  "disappearing_entity": "<the agreement's own defined term for the entity that ceases to exist in this step>",
  "surviving_entity": "<the agreement's own defined term for the entity that continues/survives this step — must be the SAME string used as the disappearing_entity of the next step, if there is one>",
  "parent_entity": "<defined term for the ultimate parent/acquirer, if named, else null>",
  "quote": "<verbatim source text supporting step_kind and the two entity names>"
}]
```

Note the explicit instruction to the model, mirroring the Task 4 finding: surviving/
disappearing entity names must be the entity's *post-merger defined term*, not the
pre-merger participant name, specifically so two-step chains verify under
`stepChainingWarnings`.

The prompt currently contains this line: *"transaction_steps is a distinct source and
must not be inferred or overwritten from agreement text."* This reads as a **deliberate
scope boundary already placed by whoever wrote this prompt** — either reserving the
name for a future dedicated producer, or explicitly keeping V1's `transaction_steps`
Postgres table out of V2's write path. Confirmed by registry search
(`lib/canonical-v2/native-producer/producer-prompt-registry.js`) that **no
`TRANSACTION_STEPS` or `TOPOLOGY` family is registered anywhere in V2** — this is not
an existing V2 producer being duplicated, it's genuinely unbuilt. Whoever adds these
fields needs to either (a) repurpose/relax this instruction as part of the same change,
since it directly forbids what this spec proposes, or (b) build the new fields as a
genuinely separate governed claim/family rather than as an addition to
`structure_assertions`/`structure_mechanics`. This is a decision for whoever owns the
prompt taxonomy (per `CLAUDE.md`'s model-routing guidance, this smells like "canonical
provision design," i.e. Opus-level, not a mechanical addition) — flagged, not decided,
here.

**Any change to this file changes `PROMPT_VERSION` and invalidates the prompt digest**
for every recorded evidence run under `evidence/canonical-v2/*-merger-structure*` —
this is the reason the task explicitly barred editing it in this investigation.

### 5.3 Resolver/adapter code that must carry the new fields through

File: `lib/canonical-v2/native-producer/candidate-resolution.js` (very large; the
relevant span is the merger-structure branch around line 10177-10194 and the
`handlePresenceCarrier` function around line 9010). Today `handlePresenceCarrier`
unconditionally writes `attributes: { assertion_kind: kind }` for every
`MERGER_STRUCTURE_CLAIM_KEY` candidate, discarding anything else the candidate might
carry. Carrying `transaction_steps` through requires either:
- a new, separate candidate-resolution branch (not `handlePresenceCarrier`, which is
  shared by other `assertion_kind`-only families and shouldn't grow a special case), or
- a new claim_definition_key entirely (e.g. `MERGER_TRANSACTION_STEP`) with its own
  finalizer that carries `step_order`/`step_kind`/`surviving_entity`/
  `disappearing_entity`/`parent_entity` as attributes, one claim per step, distinct
  from the existing one-claim-per-fact `MERGER_STRUCTURE_MECHANIC_PRESENT` claims.

This file is very likely the "resolver-side code" the concurrent agent was warned to be
touching — this spec deliberately stops at naming the location and the shape of the
change, not proposing a diff, to avoid collision.

### 5.4 Where `topology-detector.js` gets called from V2

New, small integration point — does **not** require touching `topology-detector.js`
itself (Task 1/4 showed its logic is already correct for well-shaped input; the gap is
entirely upstream). Proposed: a new module, e.g.
`lib/canonical-v2/deal-topology-from-claims.js`, that:
1. Reads the new per-step claims (from 5.3) for a deal's `MERGER_STRUCTURE_CLOSING`
   run, sorted by `step_order`.
2. Maps them to the exact shape `deriveTopology`/`enforceTransactionStepInvariants`
   expect (Task 1's contract) — this should be closer to pass-through than
   transformation, since the prompt fields in 5.2 are named to match already.
3. Calls `deriveTopology` then `enforceTransactionStepInvariants`, surfaces the
   `warnings` array without swallowing them.
4. Does **not** attempt to force modiv-shaped parallel structures into
   `TWO_STEP_TENDER`/`DOUBLE_DUMMY` — let them fall through to `MULTI_STEP_REORG` +
   `topology_needs_review: true` as today's logic already does correctly. Do not add a
   `PARALLEL_DUAL_MERGER` code speculatively for one deal's benefit without checking
   how common the shape is across the broader corpus first — that's a taxonomy
   decision, not a mechanical one.

### 5.5 Acceptance test

Revise the task's proposed test per 5.1's real-answer table. Concretely:
`node --test tests/canonical-v2-deal-topology-from-claims.test.js` (new file) asserting,
against the 7 recorded evidence directories (fixture-driven — zero model cost, no live
network, consistent with `docs/core/OPERATING-RULES.md`'s prohibition on
unreviewed live fetches):
- concho/metsera/redhat/skechers → `SINGLE_MERGER`, `step_count: 1`, no warnings.
- skywater/topbuild → `DOUBLE_DUMMY`, `step_count: 2`, **zero** chaining warnings (the
  real bar — proves entity-name canonicalisation worked).
- modiv → `MULTI_STEP_REORG`, `step_count: 2`, `topology_needs_review: true`, and a
  non-empty chaining-warnings array (proves the invariant correctly refuses to treat a
  parallel structure as a chain).

This is a stronger, more honest test than "SkyWater is the interesting one, the rest
are boring" — it requires 3 distinct correct answers (single, chained-double, and
correctly-flagged-non-chaining-double), not 2.

---

## Task 6: Sequencing note

**Can be done now, without touching any prompt, safe in parallel with the concurrent
resolver work:**
- Nothing, really, that produces a working end-to-end result — every path to a real
  topology classification on V2 data passes through the new prompt fields (5.2) and
  the resolver carry-through (5.3), both explicitly off-limits right now.
- What *is* safe and useful to build now, in isolation, because it only touches
  `lib/schema/topology-detector.js`'s own surface and files nothing else references:
  - Fix the dead-code gap from Task 1: either remove `FORWARD_TRIANGULAR`/
    `REVERSE_TRIANGULAR` from `TOPOLOGIES` until something can actually produce them,
    or leave them and add a code comment explaining they require an explicit
    `opts.singleStepTopology` no current caller supplies — small, low-risk, no
    dependency on prompts.
  - Write `lib/canonical-v2/deal-topology-from-claims.js` (5.4) against a **hand-built
    fixture** shaped like the future prompt output (clearly marked as a fixture, not
    real extracted data) so its own logic and tests are ready the moment 5.2/5.3 land.
    This is genuinely parallel-safe: it takes a `transaction_steps`-shaped input and
    calls the existing, unit-tested detector — no dependency on what the prompt or
    resolver end up looking like beyond the field names already sketched in 5.2.
  - The acceptance test file structure from 5.5 can be written now against the
    hand-built fixture, then re-pointed at real evidence once 5.2/5.3 land and a new
    recorded run exists.

**Must wait for a prompt-digest bump (i.e., must wait for the concurrent agent, or a
follow-up session, to actually change the prompt and re-run extraction):**
- Any change to `merger-structure-producer-prompt.js` itself (5.2).
- Any change to `candidate-resolution.js`'s merger-structure branch (5.3) — this is
  resolver-side code and was explicitly named as under concurrent edit; even though a
  new claim_definition_key path is additive in principle, editing this file now risks
  exactly the collision the task warned about.
- Re-running the 7 deals' `MERGER_STRUCTURE_CLOSING` extraction to get real
  `transaction_steps` data (any real acceptance run, as opposed to the fixture-based
  one above).
- Deciding the `DOUBLE_DUMMY`-label question (5.1) and the "reserved name" question in
  the prompt's existing `transaction_steps` scope-boundary sentence (5.2) — both are
  taxonomy/prompt-ownership decisions, Opus-level per `CLAUDE.md`'s routing guidance,
  not mechanical follow-ons.
