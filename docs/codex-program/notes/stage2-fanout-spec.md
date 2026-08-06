# Spec: correct the record, unblock onboarding, rebuild Stage 2 as a fan-out ladder

Status: draft for adversarial audit, not yet approved.
Scope decided: parts A, B, E, D of the six-part decomposition. Parts C
(fold in the remaining audit findings) and F (dispose of the capabilities
the audit found unused) are deliberately **not** in this spec and get their
own, after this one lands. They are deferred, not dropped.

Source evidence for everything asserted below, all produced this session
against commit `8d2d992`:

- `core-docs-audit.md` — claim-by-claim verification of COMPLETED,
  DECISIONS, CODEBASE-GUIDE, GRAVEYARD, plus a full `CI=true npm test` run.
- `plan-vs-roadmap.md` — coverage map of PLAN.md against the still-live
  ROADMAP.md, including the six items ROADMAP.md is the only home for.
- `stage2-draft-v1.md` — the drafted replacement for PLAN.md Stage 2.
- `findings-hdr-ab.md`, `coverage-matrix.md`, `aa-ad-register.md`,
  `ac-olddocs-register.md`, `classifier-questions-closed.md` — the
  underlying sweeps.

These live in the session scratchpad. Anything from them that this spec
relies on is restated here, because the scratchpad does not survive the
session and an implementer will not have it.

---

## Why this order

The four parts are sequenced because each one's output is the next one's
input, not because they are equally interesting.

D (the fan-out ladder) is what was actually asked for. It cannot be written
into PLAN.md safely first, because PLAN.md currently contains a false
statement about the exact component the new Stage 2 depends on (B), and
because Stage 2's document fan-out requires onboarding documents the
programme currently has no tracked way to onboard (E). A is first because
both B and E edit documents whose cross-reference apparatus is currently
pointing at a document that is supposed to be retired.

Doing D first would mean Sonnet implementers executing a ladder whose
step 2A rests on a capability the plan says is unusable.

---

## Part A. Consolidate ROADMAP.md into PLAN.md, then archive it

**The problem.** `CLAUDE.md` names six current documents. `ROADMAP.md` is
not one of them, but it is still on disk and is still the only current home
for real, decided, or in-flight work. Meanwhile `DECISIONS.md`'s entire
cross-reference apparatus — the "Blocks:" field that tells a reader what
each decision gates — uses ROADMAP.md's step labels (`S2`, `P2`, `P3`,
`P6`, `P7`, `D1`, `D2`, `D3`) at least 24 times. PLAN.md uses a
Stage-based scheme (`1A`, `2A` … `9E`) and contains **zero** instances of
those labels. DECISIONS.md never mentions PLAN.md by name at all.

So a reader who reads "Blocks: step P2" in the decisions document has no
way to find that step in the plan that is actually current. That is not one
stale fact; it is the connective tissue of the whole document.

**What to do.** Six moves, in this order. The first two are the load-bearing
ones.

1. **Give amendment/restatement detection a PLAN.md step.** The product can
   currently ingest an amended-and-restated agreement and silently present
   it as the original: `chooseAgreementExhibit` has no ambiguity guard and
   `lib/edgar-catalog.js` scores a restatement identically to an original.
   DECISIONS.md decides that detection plus a visible warning ships before
   go-live. It is doubly orphaned — grep for "amendment" across the current
   ROADMAP.md returns zero hits, and there is nothing in `archive/` either.
   It survives only as a decision sentence and a bug description, with no
   step, no acceptance criterion, no file path, in any current document,
   while gating launch. This is the single highest-priority item to move.
   It does not fit Stage 2–9's dependency order cleanly; a new stage is
   acceptable and probably correct.
2. **Give corpus-wide certification a PLAN.md step** (ROADMAP P6's second
   half): all 25 families across all 40 deals, checked against the ingest-QA
   gates, quote verification at zero flags, and the golden evaluation
   harness. Record the stale 18/40-deals-clean baseline as the
   before-picture, marked stale with its date (13 July). Without this,
   PLAN.md's implicit scope stops at "prove the mechanism twice" and never
   says when the whole corpus gets re-run. Note the interaction with Part D:
   D's document ladder is the *route* to corpus scale, this step is the
   *certification* at the end of it. Do not merge them.
3. **Add Risk 8 (no monitoring) to PLAN.md**, even if only as a named,
   unscheduled risk, the way ROADMAP carries it. Silence is worse than an
   open item.
4. **Give the P2 remainder a PLAN.md step** — payment-timing extraction and
   the grounds-naming field — or explicitly defer it with a reason.
   DECISIONS.md items 4–6 all say "Cross-ref step P2" and that destination
   stops existing when ROADMAP.md goes.
5. **Record D1's residual merge state** (branch again ahead of
   `origin/main`) as a PLAN.md line or a COMPLETED.md addendum to Step 0J,
   so it is not rediscovered as a surprise.
6. **Fix the two unanchored OPERATING-RULES.md cross-references** — "the
   roadmap's step 10" and "the roadmap's amendment-detection step" — by
   editing OPERATING-RULES.md's own prose. Both already point at content
   that does not exist in the current ROADMAP.md, so archiving does not
   make them more broken; they need either restoring from git history or
   rewriting to stand alone. The other six OPERATING-RULES references
   resolve cleanly to a PLAN.md or GRAVEYARD.md step and are safe to
   redirect once the prose names the new document and step.

Then, and only then, move ROADMAP.md to `archive/` with a one-line
"superseded by PLAN.md" note, matching the treatment the other superseded
documents got in the same commit.

**Also in Part A:** rewrite DECISIONS.md's header and every "Blocks:" field
to cite PLAN.md stages. The mapping is established in `plan-vs-roadmap.md`
(e.g. P9 → Stage 5 / Steps 5A–5E; the restructure preserves P9's substance
including the 49+12 wiring bucket and the register-can-be-fooled finding
that is Step 5C's stated reason for existing). Where a label has no PLAN.md
destination, that is items 1–4 above; a "Blocks:" field must not be left
pointing at an archived document.

**Proves it is done.** `grep -rn "ROADMAP" docs/core/` returns nothing
except an explicit historical mention in GRAVEYARD.md or COMPLETED.md.
No `Blocks:` field in DECISIONS.md names a label absent from PLAN.md — a
test or a lint script asserting this is cheap and worth having, since this
class of rot is exactly what recurs here.

---

## Part B. Re-verify PLAN.md's own claims, starting with the false one

**The problem.** `docs/core/PLAN.md:145` states, of
`lib/canonical-v2/native-producer/section-family-classifier.js`:

> Exists, deliberately not wired in: anything it classifies carries a
> blocking unverified flag.

Both halves are false. Verified directly this session:

- It **is** wired in, as the opt-in `section_family_classifier` parameter
  to `runNativeExtraction`
  (`lib/canonical-v2/native-producer/native-extraction-run.js:576`),
  exercised by dozens of tests.
- The blocking `SECTION_FAMILY_AI_UNVERIFIED` flag fires **only** for
  stage-2, model-assisted matches (`SECTION_FAMILY_AI_CLASSIFIED`
  provenance). Stage-1 deterministic title-rule matches
  (`SECTION_FAMILY_RULE_CLASSIFIED`) and defined-term-anchored matches
  carry no blocking flag — confirmed by reading
  `sectionFamilyUnverifiedReason` in `candidate-resolution.js` (~3894–3908).
- Stage 1 costs zero model calls: 26 family labels across 27 rules, 25 of
  which have a registered producer.

This is the programme's signature failure mode, caught in the act, in the
governing document, about the exact component the new Stage 2 needs. It is
also the reason the old Step 2A proposed mining 25 historical run manifests
by hand: the plan believed the automatic route was unavailable.

**What to do.**

1. Correct line 145 to state what is actually true: wired in as an opt-in
   parameter; stage 1 deterministic and unflagged and free; stage 2
   model-assisted and blocking-flagged. Update the module's own header
   comment in the same change if it makes a similar claim — a stale header
   is how this one survived.
2. Sweep the rest of PLAN.md's capability table and step preambles the same
   way `core-docs-audit.md` swept the other four documents: every claim
   naming a file, function, line number, count or command, checked against
   the tree, recorded VERIFIED-TRUE / VERIFIED-FALSE. PLAN.md was the one
   core document that audit did not cover.
3. For every VERIFIED-FALSE found, apply the same treatment as (1): correct
   the claim, and check whether any step's *method* was chosen because of
   the false claim. That second check is the point of this part. Step 2A is
   the known instance; the sweep exists to find the others.

**Proves it is done.** A committed claim-by-claim register for PLAN.md in
the same format as `core-docs-audit.md`, plus, for each VERIFIED-FALSE, a
one-line statement of whether any step's method depended on it.

**A caution for whoever runs the suite as part of this.** Do not pipe
`npm test` into `tail` or `head`; redirect to a file, echo `$?`, grep the
file. Use `CI=true`. And note that this session's full run reported
7724 tests, 1 failure —
`tests/safety-check-reclass-rules.test.js`, which shells out to
`git show 1ce030c^:lib/parser-v2/classify.js`. That fails here because the
sandbox clone is shallow and `1ce030c` is not in its history. It is an
environment artefact, not a regression. Do not "fix" it. Do also not repeat
COMPLETED.md's "7,718 tests, 0 failures" as if it reproduces exactly today.

---

## Part E. Unblock deal onboarding

**The problem.** Part D's document fan-out requires onboarding roughly
10–20 more agreements. Two things currently prevent that from being routine
work, and both must be fixed before D's later rounds, not during them.

1. **Section references are hand-pinned per deal.**
   `scripts/canonical-v2-live-extraction-run.mjs` requires a caller-supplied
   `DEAL_PINS.<deal>.default_section_refs_by_family` (pins at line 226) and
   does not call the classifier live — confirmed by grepping the file for
   `section-family-classifier` and `section_family_classifier`: zero hits.
   So every new document costs a manual 25-family mapping. At 2 documents
   that is tolerable; at 20 it is the whole cost of the stage.
2. **An amended-and-restated agreement is ingested silently as the
   original** — Part A item 1. Onboarding more documents without this guard
   means onboarding documents that may be the wrong text, and then treating
   their extraction output as evidence about generalisation. That
   contaminates D's entire result, which is the reason this sits in the
   same spec rather than waiting for its own.

**What to do.**

1. Build `scripts/canonical-v2-generate-family-section-refs.mjs`, specified
   in full in Part D Step 2A below. This is the fix for (1) and it is the
   same artefact D needs, which is why it is specified once, there.
2. Implement the ambiguity guard from Part A item 1 — detection plus a
   visible warning — before any document beyond Modiv and TopBuild is
   onboarded. Full amendment *parsing* stays deferred per DECISIONS.md;
   this is detection only.
3. Write down the onboarding procedure itself, as a numbered runbook in
   `docs/core/CODEBASE-GUIDE.md`: fetch the exhibit, run the ambiguity
   guard, generate the section refs, human-review them, commit the pins,
   run the family ladder. Right now this knowledge exists only as whatever
   the last person who did it remembers.

**Proves it is done.** A third document is onboarded end to end using only
the runbook, by someone who did not write the runbook, with no manual
section mapping and no undetected restatement. That third document is
Part D's Doc round B, so this proof and that round are the same event.

---

## Part D. Rebuild Stage 2 as a fan-out ladder

Replaces PLAN.md Stage 2 (2A–2E) with 2A–2E as below. The changes are: 2A
changes method, 2B and 2D each become explicit fan-out ladders, 2C adopts
2A's method, 2E gains a confidence column. Everything else is kept — 2E's
table, the falsifiable `GUARANTY_FINANCING_PARTY` prediction, and the
"incomplete must be 0 / no family's resolved count falls" gates — just
re-anchored to the new rounds.

The standing objection this answers: 2B and 2D each dispatched all 25
families against a whole document in one batch with no intermediate
checkpoint. If family 14 of 25 has a wiring bug, that is not discovered
until all 25 have run and someone reads 25 output directories. And 2D
repeated the same shape on a second, differently drafted document, so a
family that worked on Modiv and breaks on TopBuild was caught only by
manual comparison after the fact. Nothing enforced "still works on what
came before" as a standing check.

### Step 2A. Generate the per-family section lists, don't mine them from manifests

**What it is.** A script,
`scripts/canonical-v2-generate-family-section-refs.mjs`, that sectionizes a
pinned deal's admitted source with `sectionizeAdmittedSource`, runs every
resulting node's `{title, article_context, source_text}` through
`classifyDeterministicSectionFamilies`
(`section-family-classifier.js:410`, stage 1 only, no provider, no model
call, no cost), and inverts the per-node result into
`family -> [section_references]`. Run it for Modiv.

**Why this composes.** `runNativeExtraction` does not enumerate a
document's sections itself — the caller passes `section_references`, and
the classifier only labels sections it is handed. But
`sectionizeAdmittedSource` (used by both `native-extraction-run.js` and the
CLI runner at `scripts/canonical-v2-live-extraction-run.mjs:522`) already
returns a full tree of every section node with no family filtering, and
`classifyDeterministicSectionFamilies` already takes one section and
returns its family label(s) — it is used exactly this way by
`lib/canonical-v2/native-producer/prompt-budget-split-preflight.js`.
Sectionize once, classify each node, invert. That is mechanically the same
output the old 2A assembled by hand from 25 manifest files, produced from
the document itself, for any deal, including deals no historical sweep ever
touched.

**What this is not.** Not a claim the classifier is correct, and not a
reason to skip the review. Stage 1 is title and heading pattern matching.
It cannot know that Modiv's appraisal-availability sentence sits in
section 2.6, whose title gives no hint, or that section 8.12, titled for
something else, holds Modiv's defined terms. Both of those errors were
found by a human reading the document. The generated list gets read the
same way, family by family, before it is trusted.

**Change.** Write the script. Run it for Modiv. Diff its output against the
current `DEAL_PINS.modiv.default_section_refs_by_family`. For every family
where they disagree, read both candidate section sets against the actual
document text and record which is right — this is where the
CONSIDERATION/2.6 and KEY_DEFINED_TERMS/8.12 corrections belong, plus any
new disagreement the generation surfaces. Write the corrected,
human-reviewed result back into `default_section_refs_by_family` for all 25
families.

**Proves it is done.** A test asserting every registered family has a
pinned section list for Modiv (unchanged from the old 2A). Plus: the script
and its raw, pre-correction output both committed, the latter as
`docs/codex-program/notes/family-section-refs-modiv-<date>-generated.json`,
so a reader can see what the classifier proposed against what a human
corrected, and why — rather than a pinned list with no audit trail.

### Step 2B. Fan out families against Modiv, checking every earlier family at each round

Four rounds, each strictly larger than the last, each re-checking every
family proven in an earlier round. Same runner
(`scripts/canonical-v2-live-extraction-run.mjs --deal modiv --family <NAME>`),
same evidence-directory convention as today.

- **Round 1 — one family.** `TERMINATION_FEE`: it already has a real
  baseline and a known-correct section list. Diff against
  `all-families-baseline-20260806.json`'s `TERMINATION_FEE` entry. Must
  match or the round does not proceed.
- **Round 2 — four families.** Add `CONSIDERATION` and `KEY_DEFINED_TERMS`
  (both corrected in 2A — this is the correction's first real test) and
  `APPRAISAL` (whose zero output was reclassified as correct-by-design;
  confirm it is still zero for the *same* reason, not zero because it
  silently broke). Re-run `TERMINATION_FEE` alongside them, not instead.
- **Round 3 — twelve families.** Add eight, chosen to cover the families
  the plan names elsewhere as having known issues to watch (Step 3's
  references: `TERMINATION`, `SPECIFIC_PERFORMANCE_AND_REMEDIES`,
  `MATERIAL_CONTRACTS`, `GENERAL_COVENANTS`, `REPRESENTATIONS`,
  `TAX_MATTERS`, `CLOSING_CONDITIONS`, `INTERIM_OPERATING`). Re-run all
  four of Round 2's alongside.
- **Round 4 — all 25.** Add the remaining 13, including `MAE_DEFINITION`
  (never run against Modiv — this creates its first baseline, it is not a
  regression check) and `CAPITALISATION` (needs the raised
  `--call-timeout-ms`). Re-run all twelve of Round 3's alongside.

"Re-run" means actually dispatching the runner again for that family, not
re-reading the earlier round's output. A family can only regress between
rounds if it is actually re-executed.

**Proves it is done.** Two conditions, checked after **every** round, not
only the last: `incomplete` is 0 among the families run so far, and no
family's `resolved` count has fallen against its own most recent prior
round. A round that fails either gate is a stop, not a note to fix at the
end — the cause is found and fixed before the next round adds families, or
the next round repeats the same defect 8–13 more times for nothing. Final
output is the regenerated `all-families-baseline-<date>.json` the old 2B
specified, diffed against `all-families-baseline-20260806.json`.

### Step 2C. Map the 25 families to TopBuild's sections, same method as 2A

Unchanged in intent — work out TopBuild's section list without calling a
model — but by 2A's generate-then-review method. TopBuild has no historical
manifest to mine at all, so the old 2C already required hand-mapping from
scratch; generation is a strict improvement here with no method to compare
against.

**Change.** Run the generator with `--deal topbuild`. Human-review every
family's proposed list against the actual TopBuild text — this step cannot
skip the review, since TopBuild's article numbering does not match Modiv's
(the plan's own note: Modiv's termination sits at 7.1, TopBuild's
boilerplate runs to 7.16). Then confirm per family with `--dry-run` as the
old step specified: `DRY RUN complete: projected_model_call_count=N`, zero
model calls made.

**Proves it is done.** Unchanged: a committed mapping file, 25 entries,
resolved section references and projected call counts, zero model calls.
Any family resolving to zero sections is a finding to record — and
specifically, `GUARANTY_FINANCING_PARTY` resolving to zero here, given
TopBuild's two dedicated financing sections, would be evidence the *mapping*
is wrong, before 2D ever runs. Check for that by name: 2D's falsifiable
prediction depends on the mapping being right, not only on the extraction.

### Step 2D. Fan out across families on TopBuild, then across documents

Two nested fan-outs, in order.

*Family fan-out on TopBuild:* the same four-round ladder as 2B — Round 1
`TERMINATION_FEE`, Round 2 +3, Round 3 +8, Round 4 all 25 — each round
re-running every family proven earlier, gated identically (`incomplete` 0,
no `resolved` count falling, checked after every round). Confirm the
`GUARANTY_FINANCING_PARTY` prediction — non-zero expected, given two
dedicated financing sections — at whichever round includes that family.

*Document fan-out, once TopBuild is at 25/25 clean:*

- **Doc round A — the base pair.** Modiv and TopBuild, all 25 families,
  both already proven. This is the baseline later rounds diff against, not
  new work.
- **Doc round B — one more document.** A third agreement: a different
  drafter from both, and ideally a deal shape neither covers — a financed
  non-REIT deal, or one with a go-shop. All 25 families against it alone
  first; only once it is clean, re-run Modiv and TopBuild's full 25
  alongside it. A regression there would mean a fix made for document 3
  changed behaviour on documents 1–2, which should be structurally
  impossible and must therefore be checked rather than assumed. This round
  is also Part E's proof.
- **Doc round C — five to ten more.** All 25 families against each new
  document individually first, to catch a document-specific crash before it
  is buried in an eight-document batch. Then the full family set against
  every document proven so far, all together, as the regression check.
  Record every issue, fix or explicitly defer each one — no "needs more
  analysis", same discipline as Step 3H — then move on.
- **Doc round D — five to ten more again.** Same shape as C. Repeat this
  round's shape until the document set reaches whatever corpus size the
  programme has decided is enough. That number is not decided by this step:
  pull it from `docs/core/DECISIONS.md`, or flag it as an open decision if
  it is not recorded. Part A item 2's corpus-certification step is where
  the full 40 gets certified; this ladder is how the corpus gets there.

On both axes, at every round, "re-run" means real re-execution, and the
gate must pass — or be understood and explicitly fixed or recorded — before
the next round starts. No round proceeds past a red gate to keep momentum.
That is exactly the shortcut that lets one defect repeat across every
subsequent round instead of being caught once.

**Proves it is done.** Run receipts under
`evidence/canonical-v2/<deal>-<family>-<date>` for every deal × family pair
actually executed — every round's receipts kept, not just the final one, so
the ladder itself is auditable after the fact. Plus the
`GUARANTY_FINANCING_PARTY` prediction resolved in writing. Plus a
regression table per round: which families, which documents, incomplete
count, resolved-count deltas against the previous round for that
family/document pair.

### Step 2E. Say which fixes generalised and which were document-specific

Unchanged in shape — one table, a row per fix, evidence-cited — but it now
spans however many documents 2D actually reached, not just Modiv against
TopBuild.

**Change.** `docs/codex-program/notes/generalisation-<date>.md`, with a
column for which document round first exercised each fix and which later
rounds re-confirmed it, so a fix proven on 2 documents against one proven
on 15 is visibly different confidence rather than flattened to pass/fail.

**Proves it is done.** Unchanged: every row cites an evidence directory and
a reason-code count, not a recollection. Undetermined is recorded as
undetermined, not as a pass.

---

## Known open questions

These are not rhetorical. Each one is a place this spec could be wrong.

1. **Is the generation approach in 2A/2C actually sound**, or does it
   quietly assume something untrue about
   `classifyDeterministicSectionFamilies` — for instance that a naive
   per-node loop supplies the article context the same way the real callers
   do? This design comes from reading function signatures, not from
   executing the script. Nobody has written or run it. If it is wrong, 2A
   falls back to the old manifest-mining method for Modiv and 2C to
   hand-mapping, and Part E's onboarding cost argument weakens
   substantially.
2. **Is the ladder concrete enough for a Sonnet implementer** without more
   design decisions? Round 3's twelve families are named. Doc round B's
   "different drafter" criterion is not operationalised, and the specific
   third document is not chosen.
3. **Is there a cheaper fan-out shape with the same regression guarantee?**
   Re-running every prior family against every prior document at each round
   is not free in real model-call cost, and the cost grows quadratically as
   the document ladder extends. A sampling scheme might buy most of the
   guarantee for much less — or might reintroduce exactly the blind spot
   the ladder exists to close.
4. **Does this silently drop or weaken anything in the original 2A–2E?**
   Checked against the original text once, by the author of the draft. That
   is the weakest kind of check, and it is the check most likely to be
   wrong in the direction of self-flattery.
5. **Part A item 2 and Part D's doc ladder overlap** at the top end. The
   boundary drawn here — ladder gets the corpus there, certification step
   proves it — is a judgement call, not a decision recorded anywhere.

## What this spec does not cover

- **Part C:** folding the remaining ~110 audit findings into the core
  documents. Deferred to its own spec so this one stays reviewable.
- **Part F:** deciding what to do with the capabilities the sweep found
  built and unused. Deferred for the same reason, and because GRAVEYARD.md
  is the right venue and it needs its own pass.

Neither is abandoned. If this spec lands and those do not follow, the
record is worse off than before, because this spec's corrections will make
the untouched findings look reviewed.
