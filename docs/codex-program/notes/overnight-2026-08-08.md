# Overnight run, 2026-08-08

What was asked: fix everything the TopBuild fan-out found, fan out, and wake to
ten deals extracted. What happened, honestly, including the part of the ask that
was not achievable and the two things I got wrong and had to correct.

---

## Ten deals was never available, and here is why

**Three merger agreements exist on disk.** `modiv`, `topbuild`, and the Skechers
raw HTML that was committed but never wired up. Step 2G says it plainly:
*"Onboarding is the constraint, not the ladder."* Each deal needs a hand-authored
`DEAL_PINS` entry with two SHA-256 digests, a hand-reviewed mapping of 25
families to that agreement's own section numbering, and 600–900KB of raw HTML
committed to git. There is no fourth agreement to extract, and no path to seven
more overnight that would not amount to inventing pins.

**So the third deal was onboarded and extracted instead.** Skechers is now a
first-class deal: digests verified, all 25 families mapped and dry-run clean, and
9 families extracted live. That is the honest maximum from what was on disk.

---

## Result

### Skechers, the third deal — 35 governed claims from 9 families

| Family | Sections | Claims | Excerpts | Open world |
|---|---|---|---|---|
| `ANTITRUST_REGULATORY` | 6.2 | 12 | 9 | 0 |
| `DNO_INDEMNIFICATION` | 6.10 | 6 | 17 | 11 |
| `EMPLOYEE_MATTERS` | 6.11 | 6 | 9 | 3 |
| `TERMINATION` | 8.1, 8.2 | 5 | 20 | 15 |
| `APPRAISAL_DISSENTERS_RIGHTS` | 2.7 | 2 | 6 | 4 |
| `GUARANTY_FINANCING_PARTY` | 4.13, 9.15 | 2 | 16 | 14 |
| `TERMINATION_FEE` | 8.3 | 2 | 11 | 9 |
| `MATERIAL_CONTRACTS` | 3.13 | 0 | 1 | 1 |
| `DIVIDENDS` | 5.2 | 0 | 0 | 0 |
| **Total** | | **35** | **89** | **57** |

`DIVIDENDS` at zero was predicted by the onboarding note before the run, for the
same structural reason as TopBuild: the dividend restriction is a covenant limb,
not a section.

**`GUARANTY_FINANCING_PARTY` is the headline.** It had never produced a governed
claim on any deal. On Skechers it produced two real ones — `GUARANTY_DELIVERED`
and `GUARANTY_IN_EFFECT`, naming **3G Fund VI, L.P.** as guarantor — plus nine
`FINANCING_PARTY_PROTECTION` mechanics including the Debt Financing Sources
third-party-beneficiary clause. Skechers is a sponsor-backed take-private, so it
is the first agreement in the corpus that actually contains a sponsor guaranty.
Both the prompt fix and the family are now exercised against real content.

### The six TopBuild breaks

| Break | Was | Now |
|---|---|---|
| 1 `REPRESENTATIONS` | no run at all | completes: 44 open-world, 17 excerpts, 20 review-queue |
| 2 `GUARANTY_FINANCING_PARTY` | three empty arrays | 4 excerpts, 4 open-world; governed claims on Skechers |
| 3 `DIVIDENDS` | three empty arrays | 2 rows TopBuild, 4 Modiv; diagnosis corrected |
| 4 `NO_SHOP` | no run at all | **67 publishable claims** |
| 5 `MAE_DEFINITION` | 38 claims written, threw on render | 38 records, 2 rollups, 2 cards |
| 6 `NO_OTHER_REPS_FRAUD` | never rendered on any run | 3 facts × 4 surfaces on all three runs |

Plus the seventh item, `closure_id` instability: fixed, and proved by replaying
one run from two directories and getting identical ids.

---

## Two things I got wrong, and how they were caught

**1. I said the output ceiling could not be raised. It can.** Four calls had
exceeded the CLI's 64,000-token output limit and been refused as malformed. The
fix was to raise `CLAUDE_CODE_MAX_OUTPUT_TOKENS`. A delegate read the installed
CLI's per-model table and found `upperLimit` capped at 64,000 on every branch; I
verified that reading myself, agreed, wrote the impossibility into `PLAN.md` and
`COMPLETED.md` as established, and briefed a re-ruling on it.

Then I ran the experiment. **69,576 output tokens, and NO_SHOP extracted 67
claims.** Adversarial review found why the two disagreed: the file we both read
is a **stale shadowed npm install**, v2.1.42 from March. The binary that actually
runs is `/opt/claude-code/bin/claude`, v2.1.224, built yesterday. We had both
read a program that does not execute.

One cheap experiment beat two confident static readings. Everything is corrected
in place, with the wrong version left visible.

**2. My dividends prompt broke a boundary while its own header said it didn't.**
The v2 draft told the model to emit "a dividend restriction appearing as a limb
of a broader operating covenant" into open world — which is precisely
`INTERIM_OPERATING`'s text — two lines below a header claiming the
anti-double-extraction boundary was untouched. Fable caught it. The rerun proved
the cost: all six TopBuild rows duplicated what `INTERIM_OPERATING` had already
published, **including the Series B carve-out I had called "lost", which was
never lost at all** — it was in IOC's open world the whole time (candidate
`e60cad0a`). Corrected: TopBuild 6 rows → 2, and the two that remain are dividend
carve-outs rather than IOC's restriction limbs.

This is the stale-header failure CLAUDE.md names as this project's most expensive
habit, committed by me, in a header written specifically to warn about it.

---

## The guard problem, which keeps recurring

**Seven guards were found this week that could not fire. Two more tonight.**

- The overflow check reads `response.provider_usage ?? response.usage`. The
  runner's CLI client returned content with **no `usage` at all**, recording it
  to telemetry only — so on every real run the check read `null` and said
  nothing, including on the 69,576-token call it exists for. Its 11 tests all
  inject usage the production path never supplied. Now wired.
- `replay-invalidation-planner.js` defines `prompt_identity_digest` and a
  `REEXTRACT_REQUIRED` action for the exact case where a replay attributes an old
  response to a new prompt. **The only reference to it anywhere is a path string
  in an inventory file.** It bit immediately: two prompts moved to v2 while 28
  evidence directories were being regenerated, and those two had to be held back
  by hand. Recorded as Step 2F4, not yet fixed.

**And one guard I could not prove.** The overflow wiring is made and readable in
the diff, but the end-to-end proof — lower the ceiling, watch a real extraction
refuse — does not work: at 1,200 and 8,000 the CLI exits before generating.
Until someone watches it fire on a live call it is *a guard believed to work*,
which is the category this programme keeps discovering was wrong. It is recorded
as open rather than closed.

---

## Needs Ben

1. **Step 2F2 — thirteen prompts showing the model an empty answer.** Prompts
   whose response shape shows `"open_world_candidates":[]` averaged **2.5**
   open-world rows with 5 of 11 returning zero; those not showing a pre-filled
   empty averaged **21.1** with 1 of 11. Fixing the two broken families recovered
   14 rows immediately. But it is n=11 per arm on one document and confounded —
   the pre-filled prompts are also the terse ones. Fable recommends a
   **three-family schema-only probe** (ANTITRUST_REGULATORY, MISC_BOILERPLATE,
   SPECIFIC_PERFORMANCE_REMEDIES), changing only the shape line, rather than a
   13-family sweep that invalidates most of the corpus.
2. **Step 2F3 — Modiv's guaranty family is pinned to the wrong section.** §5.11
   is headed "Other Transactions" and is about pre-closing restructuring. The
   family has never been exercised against guaranty text on that deal, and a
   previous commit reasoned from its zero.
3. **The taxonomy has no governed home for a standalone financing-source
   protection.** TopBuild's four rows all landed in open world. Whether a lender
   non-recourse waiver should be a governed provision is a design call.

---

## Verification

`CI=true npm test` — 8,280 tests, 8,234 pass, 45 skipped, **1 fail**, which was a
stale generated inventory, regenerated and green. `npm run build` exit 0.
`forbidden-patterns.sh` exit 0. All work is on
`claude/codex-handoff-plan-status-77wn7n` and pushed.
