# BREAKs 2 and 3 — the two false zeros, fixed and verified live

Working note, 2026-08-08. Producer-prompt scope is taxonomy work, so this was
done on the main loop rather than delegated, and sent to Fable for adversarial
review (`break-2-3-prompt-review.md`).

Step 2F recorded two families that published nothing where they should have
published something, on the TopBuild agreement:

- **BREAK 2** — `GUARANTY_FINANCING_PARTY` returned `{"guaranty_assertions":[],
  "financing_mechanics":[],"open_world_candidates":[]}` on §7.16 "Waiver of
  Claims Against Financing Sources", a textbook non-recourse clause on a
  $600,000,000 debt-financed acquisition.
- **BREAK 3** — `DIVIDENDS` returned the same three empty arrays on §4.1 and
  §4.2, which plainly contain "declare, set aside or pay any dividend".

Both are fixed. Both prompts are at `PROMPT_VERSION` 2. Both fixes are verified
by live extraction on both documents, not by reasoning.

---

## Result

| Family | Document | v1 claims / excerpts / open-world | v2 claims / excerpts / open-world |
|---|---|---|---|
| `GUARANTY_FINANCING_PARTY` | TopBuild §7.16 | 0 / 0 / 0 | 0 / **4** / **4** |
| `DIVIDENDS` | TopBuild §4.1, §4.2 | 0 / 0 / 0 | 0 / **6** / **6** |
| `DIVIDENDS` | Modiv §5.10 | 0 / 0 / 0 | 0 / **4** / **4** |
| `GUARANTY_FINANCING_PARTY` | Modiv §5.11 | 0 / 0 / 0 | 0 / 0 / 0 — **correct, see below** |

**14 rows of evidence recovered across two deals, and nothing invented on the
document where zero is the right answer.** That last row is the regression test
that mattered: Modiv is an unfinanced deal, CLAUDE.md's standing rule is that a
family returning zero can be correct, and a prompt change that pushes a model to
fill an empty list is exactly how that rule gets violated. It held.

---

## BREAK 2 — the cause was the instruction's scope, and the recording says so

The mapping was right and the resolver was right: §7.16 resolved to
`"Waiver of Claims Against Financing Sources"`, 2,287 bytes, exactly what 2E
pinned. v1's instruction opened

> "Extract quoted **positive guaranty facts only**"

which scoped the **whole response**, including `financing_mechanics`, whose
`FINANCING_PARTY_PROTECTION` surface exists precisely to carry financing-source
protections. The model followed that scope and said so verbatim in the
recording: *"it's a lender-liability waiver, a distinct mechanism"*.

v2 scopes "positive facts only" to `guaranty_assertions`, where it does real
work, and states that `FINANCING_PARTY_PROTECTION` is not conditional on a
guaranty being present. **The "never infer" list is unchanged and deliberately
so** — a guaranty family that invents a cap or a payment-versus-collection
status is worse than one that finds nothing.

Under v2 the model returned three `FINANCING_PARTY_PROTECTION` mechanics — the
blanket liability waiver, the mirror-image claims waiver, and the
specific-performance carve-out — plus an open-world row for the
Commitment-Letter carve-out.

**What is still open.** All four rows resolved to **open world, not to governed
claims**: the resolver has no governed mapping for a standalone
financing-source protection with no guaranty attached. That is arguably correct
— the open-world channel exists for content the taxonomy cannot yet express, and
the content is now captured, evidenced and visible rather than silently dropped.
Whether a lender non-recourse waiver should become a *governed* provision is a
taxonomy design question for Ben, not something to settle overnight. It is in
Fable's review brief.

## BREAK 3 — the note's diagnosis was wrong, and the real defect is narrower

Step 2F recorded BREAK 3 as: *"this family's producer simply does not find its
own content when the content is a limb rather than a section."*

**That is wrong.** v1 already said *"Consideration and IOC restrictions remain
outside this family"*, and TopBuild's dividend language **is** an
interim-operating restriction — limb (vi)(A) of a thirty-limb covenant.
`INTERIM_OPERATING` was handed the same two sections and resolved 29 claims from
them. So the empty **governed** lists were correct, and the split between the two
families worked exactly as designed.

The remaining candidate defect is the third array. §4.2(iv)(A) carves out
*"dividends required to be declared and paid pursuant to the terms of the
Convertible Perpetual Preferred Stock, Series B Preferred Stock"* — a recurring
mandated dividend, which v1's own text says *"remain open world"* — and
`open_world_candidates` came back empty anyway.

**Adversarial review corrected this too, and the correction matters.** Three
findings from `break-2-3-prompt-review.md`:

1. **Nothing was ever lost from the corpus.** `INTERIM_OPERATING`'s own
   open-world channel already carries the identical Series B / Series C carve-out
   quote (candidate `e60cad0a…`, verified in its `adapter-result.json`). The
   provision was absent from *this family*, not from the record. The earlier
   claim in this note that it "was being lost" was wrong.
2. **v1's zero was defensible, not clean non-compliance.** The carve-out is a
   proviso *inside* an IOC limb, so v1's instructions pointed both ways at once.
3. **v2's first draft broke the anti-double-extraction boundary while its own
   header claimed not to.** It told the model to emit "a dividend restriction
   appearing as a limb of a broader operating covenant" into open world — which
   is exactly INTERIM_OPERATING's text. The rerun proved the cost: **all six
   TopBuild rows duplicated content INTERIM_OPERATING had already published.**
   A note claiming a boundary was preserved, over a diff that moved it, is the
   stale-header failure this repository names as its most expensive habit — and
   it was caught by review rather than by me.

The instruction now names the boundary it must not cross: emit the dividend
provisions this family owns, and never repeat another family's restriction
because its text mentions dividends.

**Where the recovery is genuine: Modiv §5.10**, 0 → 4, a real dividends section
with no INTERIM_OPERATING overlap. On TopBuild the two families are pinned to the
same two sections, because TopBuild has no standalone dividends section at all —
so DIVIDENDS and INTERIM_OPERATING will keep meeting there. **That is a mapping
question, not a prompt one**, and it is the honest residue of BREAK 3.

---

## The measured finding underneath both: a pre-filled empty array is a default

Both v1 prompts showed `"open_world_candidates":[]` in the response shape — an
empty array with **no element schema**. Measured across TopBuild's 22 measurable family
runs, counting `open_world_candidates` in each run's `adapter-result.json`:

| Response shape shows | Families | Total open-world rows | Mean | Returned zero |
|---|---|---|---|---|
| `"open_world_candidates":[]` (pre-filled empty, no element schema) | 11 | 28 | **2.5** | **5 of 11** |
| No pre-filled empty (element schema, or field absent from the literal shape) | 11 | 232 | **21.1** | 1 of 11 |

An 8x difference in yield and five times the zero rate. The reading is that
showing a model the field's "default value" teaches it that the default is the
answer.

**This is a correlation on ONE document with n=11 per arm, and it is
confounded**: the pre-filled-empty prompts are also the terse one-line prompts,
so prompt richness is a rival explanation these data cannot separate. It is
recorded as a measurement, not as an established cause.

**Thirteen other prompts show the same pre-filled empty** (antitrust-regulatory,
appraisal, dno, employee-dno, employee-matters, financing, financing-guaranty,
key-terms-mae-follow-on, merger-structure, remedies-misc,
specific-performance-remedies, tax-dividend-appraisal, tax-matters). Changing
them would bump thirteen prompt digests and invalidate evidence across most of
the corpus, so it is **not** being done on this evidence. It is proposed to Ben
as a step, and it is in Fable's review brief with instructions to attack the
statistics.

---

## Incidental finding — Modiv's guaranty family is pointed at the wrong section

Modiv §5.11, the section pinned for `GUARANTY_FINANCING_PARTY`, resolves to
heading **"Other Transactions"** and is about Parent-requested pre-closing
restructuring — subsidiary conversions, equity and asset sales, contract
terminations, tax carve-outs. There is no guaranty content in it and no
financing-party content either, which is why v2 correctly returns nothing.

So `GUARANTY_FINANCING_PARTY` **has never been exercised against real guaranty
text on Modiv**, and its Modiv zero has always been a mapping artefact rather
than evidence about the family. This is a Step 2E-class mapping correction, not
a prompt fix, and it is not made here.

---

## ADJUDICATION 2026-08-08: the three-family probe

Ruling by Fable, on Ben's explicit deferral, after independently verifying the
probe rather than trusting its report. Verified: `git show bf8f323f` confirms
the only substantive change in each of the three prompt files is the
`open_world_candidates` element schema in `RESPONSE_SHAPE` plus the version
bump; instructions byte-identical; both antitrust arms dispatched the same
section (§4.6, single recorded call each); the raw recorded responses in all
six evidence directories were read and re-parsed directly, not taken from the
summary tables.

### The finding that reframes the experiment

The probe was designed to test yield suppression. What the raw responses show
is that the baseline "zeros" were **two defects compounded**, and the shape
change cures both:

1. **Form-driven silent loss.** In two of three baselines the model DID emit
   open-world content — antitrust emitted 3 candidates, specific-performance
   emitted 5 — but as **bare strings**, because the pre-filled `[]` gave it no
   element format to copy. `shapeOpenWorldCandidate` in
   `lib/canonical-v2/native-producer/anthropic-provider.js` (line 906) returns
   null for any non-object candidate **without recording a drop reason** — the
   one exit from that function that the drop counter does not see. Eight rows
   of emitted evidence were destroyed with no trace in any receipt. This is
   the same silent-loss failure mode as BREAKs 2 and 3, live in the baseline
   arms of this very experiment.
2. **Yield suppression proper.** MISC_BOILERPLATE's baseline emitted zero raw
   open-world entries across all 11 sections; with the element schema it
   emitted 9. Antitrust's raw count went 3 → 10. So the pre-filled empty
   suppresses emission as well as corrupting the form of what is emitted.

Under the new shape, every open-world row in all three probe runs is a
well-formed object, and the baseline's lost content reappears: on
specific-performance, two of the five dropped strings (the non-oppose grant
and the bond-security waiver) came back not as open-world rows but as
**resolved governed `SPECIFIC_PERFORMANCE_REMEDY_PRESENT` claims** — the
1 → 3 governed gain is recovered real content, verified against the resolved
quotes in both `resolution.json` files.

### (a) Does the control arm settle the confound? YES — and less rests on n=1 than the design assumed.

Two separate grounds:

- The original confound was **cross-family**: pre-filled prompts were also the
  terse ones. The probe is a within-family A/B — instructions byte-identical,
  same document, same dispatched sections — so each family is its own control.
  Three of three families moved 0 → positive recorded rows. ANTITRUST, the
  pre-filled-but-long crossover, moving 0 → 10 eliminates terseness as a
  necessary condition.
- The **mechanism is now observed, not inferred**, and it is a shape mechanism
  by construction: a model shown `[]` with no element schema emits strings
  (antitrust, specific-performance baselines, 8 rows); the adapter
  deterministically drops strings. Prompt length cannot explain why a model
  emits strings instead of objects. The form channel alone forces the shape
  change regardless of what one believes about the yield channel.

Residual caveat, recorded honestly: each arm is a single sampled run, so the
*sizes* of the yield movements (3 → 10, 0 → 9, 5 → 2) are point estimates with
sampling noise. The direction is three-for-three and mechanistically grounded;
the magnitudes are not to be quoted as measured effects.

### (b) The antitrust 10 → 9: a real routing cost, identified, bounded, and recoverable — not silent loss, and not sampling noise.

The lost claim is **`REGULATORY_CONSULTATION_RIGHT`, canonical value
`INCORPORATE_COMMENTS`**, obligor "Parent and the Company", from §4.6(a)'s
assist-and-cooperate umbrella. In the baseline the model carried the entire
umbrella passage — leaves (A) through (D) inside one very long quote that does
contain the obligor phrase — as a governed CONSULTATION_RIGHT assertion, and
it resolved. In the probe the model emitted the umbrella once (as
COOPERATION_OBLIGATION, which still resolved) and routed the four enumerated
leaves to open world, each with the stated reason that the leaf's own
contiguous text omits the governing obligor phrase. The claim was not dropped;
the model named its own diversion — probe OW[7]:

> "enumerated leaf (D) omits the governing obligor phrase; would otherwise be
> a CONSULTATION_RIGHT (INCORPORATE_COMMENTS)"

So: a governed fact was diverted into open world. That is the regression
pattern the adjudication brief flagged, and it is real. Three things bound it:

1. The fact survives, evidenced, in the reviewable open-world path, with its
   nearest governed interpretation stated — versus the baseline, where three
   open-world facts on the same section were destroyed without trace.
2. The diversion is a *stricter* reading of the prompt's own quote-discipline
   rule (quote must carry the obligor phrase), not disobedience. The baseline
   captured the claim by stretching one quote across four sub-clauses.
3. Net across the probe, resolved governed claims moved +2 (antitrust −1,
   misc-boilerplate +1, specific-performance +2), and the two
   specific-performance gains are higher-value than the consultation-right
   loss.

The mitigation — an instruction telling the model that an enumerated leaf may
quote from the umbrella obligor phrase through the leaf — is an
**instruction** change and therefore does not belong in the shape sweep. It is
a candidate follow-on, on its own evidence, per family, only if the sweep
shows leaf-diversion recurring.

### (c) Sweep the remaining ten: YES, shape-only, exactly as the probe was run.

Instructions must not change in the same commit — the probe's evidentiary
value came entirely from byte-identical instructions, and the sweep inherits
that only if it preserves the discipline. Per family: element schema
`[{"observed_quote":"<verbatim>","why_unmapped":"<brief>","nearest_concept":null}]`
replacing the pre-filled `[]`, version bump, version-pin test updates with the
reason inline, nothing else.

**Acceptance evidence, per family and in aggregate:**

1. `git diff` on each of the ten prompt files shows RESPONSE_SHAPE + version
   changes only; instructions byte-identical by diff.
2. `CI=true npm test` redirected to a file with `$?` echoed (never piped),
   `npm run build`, `bash scripts/lint/forbidden-patterns.sh` all green.
3. TopBuild re-run per family into fresh evidence dirs, recording four numbers
   against the frozen baselines: resolved governed before/after, recorded
   open-world before/after — **plus a count of string-typed open-world entries
   in each baseline's raw response**, so the corpus-wide silent loss this
   shape has been causing is quantified once, on the record.
4. **Accounting gate:** every resolved governed claim present in a baseline
   and absent in the re-run must be findable in the re-run's open-world rows
   with a `why_unmapped` naming it (the antitrust pattern). An unexplained
   governed disappearance stops the sweep for that family and escalates.
5. **Fabrication gate:** at least one family re-run on a document where its
   correct answer is zero (Modiv guaranty stays the reference case) must still
   return zero governed and invent nothing — the standing rule that a zero can
   be correct is exactly what a "fill the array" nudge would violate.
6. Baseline evidence dirs are kept, never overwritten.

**What the sweep does NOT fix, stated so nobody later claims it did:** the
blind-classification finding (58/96 held-back candidates real, failure
concentrated in quotes too narrow to carry their corroboration) is a
**different defect at a different stage**. Shape suppression operates at
emission — candidates never produced, or produced malformed and destroyed.
Span narrowness operates at review — candidates produced, held, and clipped
too tight to survive. The sweep raises the volume flowing into the second
problem and does nothing to solve it. Span discipline is its own step, on its
own evidence, and folding it into this sweep would destroy the
attributability of both.

**Separate small fix, not part of the sweep:** `shapeOpenWorldCandidate`
should record a drop reason for non-object candidates instead of returning
null silently — one line plus a test. The sweep makes string emission
unlikely; it does not make silent destruction of malformed output acceptable.

### What would falsify this ruling

- Re-running any probed family three times under the OLD shape and getting
  well-formed object rows at comparable yield — shape was not the cause.
- Sweep re-runs showing governed claims scattering to open world beyond the
  single-diversion antitrust pattern — more than one or two per family, or any
  high-materiality diversion (a burden commitment, an HSR deadline) — the
  routing cost exceeds the recovery, revert the sweep.
- Any swept family inventing open-world rows on a document whose correct
  answer is zero — the shape nudges fabrication, revert.
- A re-run of the antitrust probe arm reproducing the INCORPORATE_COMMENTS
  governed claim — the 10 → 9 was sampling after all, and the (b) ruling's
  "systematic routing cost" characterisation should be softened to "possible
  routing cost" in DECISIONS.md.
