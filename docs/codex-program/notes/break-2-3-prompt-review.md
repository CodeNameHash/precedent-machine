# Adversarial review: BREAK 2/3 prompt v2 changes and the open-world schema correlation

Reviewed 2026-08-08, against the uncommitted working tree. Scope: the three
claims in the handoff, the two v2 prompt files, v1 via `git show HEAD:`, the
Step 2F note (BREAK 2 at line 453, BREAK 3 at line 507), and the recorded
runs under `evidence/canonical-v2/topbuild-*`. All counts below were
recomputed from the artefacts, not taken from the handoff or the headers.

Files under review:

- `lib/canonical-v2/native-producer/guaranty-producer-prompt.js` (v2, uncommitted)
- `lib/canonical-v2/native-producer/dividends-producer-prompt.js` (v2, uncommitted)

---

## CLAIM 1 — BREAK 2's cause. Verdict: **UPHELD**

The causal story is directly evidenced and the remit question resolves in
v2's favour on four independent design artefacts, not just the new header's
say-so.

**The mechanism is in the recording, verbatim.**
`evidence/canonical-v2/topbuild-guaranty-financing-party-20260808-rung4/native-producer-recorded-response-7.16.json`
has the model saying: *"None of the language constitutes guaranty delivery, a
guaranty core term, or a financing-party protection **tied to a guaranty**
(it's a lender-liability waiver, a distinct mechanism), so
`financing_mechanics` is empty too rather than stretched to fit."* The model
read `FINANCING_PARTY_PROTECTION` as guaranty-conditional. v1's instruction
(HEAD) opens "Extract quoted positive guaranty facts only" and nothing in it
un-scopes `financing_mechanics` from that framing; the model's reading was
fair. The v2 rerun
(`evidence/canonical-v2/topbuild-guaranty-financing-party-20260808-v2/native-producer-recorded-response-7.16.json`)
confirms it was scoping, not blindness: same section text, three
`FINANCING_PARTY_PROTECTION` rows with verbatim quotes of the three waiver
limbs, plus one open-world row. 0 rows became 4 written rows
(`adapter-result.json` counts: `open_world_candidates_written: 4`).

**Is a lender non-recourse waiver inside this family's remit?** Yes, and this
is not v2 widening scope to paper over a mapping error:

1. The classifier routes it here **by design**.
   `lib/canonical-v2/native-producer/section-family-classifier.js:196`
   explicitly excludes any title matching `financing\s+sources?|non[- ]recourse|no\s+recourse`
   from `FINANCING_COVENANTS` — the exclusion exists to push those sections
   to this family (recorded as design in
   `docs/codex-program/notes/step-2e-topbuild-mapping.md:83` and 115–125).
2. `docs/core/PLAN.md:1619–1624` states the prediction in remit terms: Modiv's
   zero was correct because "an unfinanced REIT merger has no
   **financing-party protections** to find". The programme's own record
   treats financing-source protection, not guaranties, as what this family
   must not miss.
3. The unregistered predecessor prompt
   `lib/canonical-v2/native-producer/financing-guaranty-producer-prompt.js:5`
   instructs "Capture … financing-party protections" with no guaranty
   conditioning. The guaranty-conditional framing was introduced when the
   family was split, i.e. it is the v1 wording that drifted from the design,
   not v2 that drifts from it.
4. §7.16 was pinned to this family by 2E with exactly this reasoning
   (`step-2e-topbuild-mapping.md:127–158`), reviewed and recorded before
   BREAK 2 existed.

**Double-extraction with FINANCING_COVENANTS: low, checked, not zero.**
`financing-producer-prompt.js:3–4` claims no non-recourse content — its
surfaces are `ALTERNATIVE_FINANCING | LENDER_ARRANGEMENT | MARKET_FLEX |
MARKETING_PERIOD | REIMBURSEMENT_OR_INDEMNITY`, no
`FINANCING_PARTY_PROTECTION`, and its instruction sends nothing lender-
protective anywhere. The TopBuild run confirms zero overlap:
`topbuild-financing-covenants-20260808-rung4/adapter-result.json` has 1 claim
(efforts standard) and 6 open-world rows, all cooperation/alt-financing/
market-flex/reimbursement — no non-recourse text. The classifier's line-196
exclusion prevents the same section reaching both families under the title
rules. Residual exposure: a section titled to match both `\bfinancing\b` and
a guaranty word (e.g. "Financing; Parent Guaranty") dual-routes under the
set-returning detector, and a non-recourse **paragraph embedded inside** a
"Financing"-titled section reaches only FINANCING_COVENANTS, whose prompt
would push it to open world. Both are pre-existing routing properties; v2
changes neither.

**Two caveats, neither refuting:**

- The v2 yield is entirely ungoverned. The adapter turns `financing_mechanics`
  rows into open-world evidence rows ("surface label routes evidence only"),
  so even fixed, this family publishes **zero governed claims** on TopBuild
  (`candidates_written: 0`). PLAN's "must produce non-zero output" is
  satisfied, but nobody should read BREAK 2 as fixed into governed coverage.
- The new anti-empty sentence (`guaranty-producer-prompt.js:40`: "returning
  all three lists empty asserts the section is about none of these
  subjects") is untested against the standing correct-zero. Modiv's run was
  §5.11 "Other Transactions" → 0 rows, and PLAN.md:888 calls that zero the
  standing example. No Modiv v2 rerun exists in `evidence/`. **Gate the
  commit on a Modiv guaranty v2 rerun staying at zero** (or at worst emitting
  rows that are genuinely about financing sources). If v2 pads Modiv, the
  sentence at line 40 is the cause and should be softened.

---

## CLAIM 2 — BREAK 3's cause, correcting the note. Verdict: **UPHELD WITH CORRECTION**

The correction of the note is right and I verified it independently; but the
handoff's "the only genuine defect is the empty open_world_candidates"
overstates, and the v2 file contradicts its own header.

**Verified, not taken on faith:**

- `topbuild-interim-operating-20260808-rung3/run-manifest.json`: sections
  `['4.1','4.2']` — the exact two sections DIVIDENDS received. 29 claims
  written, 29 components, 49 open-world rows.
- Among the 29: two `IOC_RESTRICTION_PRESENT` claims with
  `restriction_category: "DIVIDEND"` quoting the limbs verbatim —
  §4.1: "declare, set aside or pay any dividend or other distribution …"
  and §4.2: the Parent mirror. The dividend content is governed, under
  INTERIM_OPERATING, as designed.
- v1's instruction (HEAD) does say "Consideration and IOC restrictions remain
  outside this family", and TopBuild's dividend text is limb (vi)(A)/(iv)(A)
  of the IOC covenant. Empty governed lists were the instructed answer.
- The decisive artefact is the **v2 rerun**:
  `topbuild-dividends-20260808-v2/native-producer-recorded-response-4.1.json`
  and `-4.2.json` show the model quoting the limb text fluently — and
  **still returning empty governed lists**. The note's diagnosis ("does not
  find its own content when the content is a limb rather than a section",
  step-2f note line 531) is thereby refuted twice over: the family finds the
  content fine; it classifies it out of governed, by instruction, in both
  versions.

**The preferred-stock carve-out is what the handoff says it is.** "dividends
required to be declared and paid pursuant to the terms of the Convertible
Perpetual Preferred Stock, Series B Preferred Stock and Series C Preferred
Stock" — required by the security's terms, periodic: a recurring mandated
dividend, squarely the category v1 said "remain open world". (Note it is
Parent-side — QXO's own preferred — so it speaks to acquirer interim
obligations, not target dividend treatment.)

**Corrections to the handoff's framing:**

1. **"The only genuine defect" is too strong on causation.** The carve-out is
   a proviso *inside* an IOC limb, and v1 gave two applicable instructions
   pointing opposite ways: "recurring mandated dividends remain open world"
   vs "IOC restrictions remain outside this family". The model's zero was
   defensible under the second reading, not clean non-compliance with the
   first. Ambiguous instruction, not (only) ignored instruction. This
   matters because it makes CLAIM 3's suppression mechanism *less* necessary
   to explain this particular zero.
2. **Nothing was actually lost on this deal.** INTERIM_OPERATING's own
   open-world output already contains the identical carve-out quote
   (candidate `e60cad0a…`, §4.2, "other than for dividends required to be
   declared and paid pursuant to the terms of the Convertible Perpetual
   Preferred Stock…") plus both pro-rata provisos. The BREAK 3 open-world
   defect cost redundancy, not content. And because §4.2-style Parent
   covenants route to INTERIM_OPERATING on essentially every deal
   (classifier lines 214–215), this redundancy is structural, not a TopBuild
   accident.
3. **Reviewer sufficiency: yes at the data layer, unverified at the product
   layer.** The governed dividend restriction exists only as
   INTERIM_OPERATING claims with `restriction_category: "DIVIDEND"`. Whether
   a reviewer who opens a DIVIDENDS-family view (and sees nothing) is routed
   to it depends on the review UI surfacing that category — a product
   question this review did not verify live. Empty-by-design families need
   the UI to say *where the content went*, or the empty card reads as BREAK 3
   did.

**The v2 file contradicts its own header — this is the real finding here.**
Header lines 36–38 say: "NOT CHANGED, DELIBERATELY: the exclusion of
consideration and IOC restrictions … prevents the same covenant being
extracted twice by two families." But instruction 6 (line 50) orders the
model to emit into open world "a dividend restriction appearing as a limb of
a broader operating covenant" — the IOC limb itself. The v2 rerun shows the
effect: 6 open-world rows, of which effectively **all six** duplicate
INTERIM_OPERATING output on the same run of the same document (rows 1 and 4
reproduce the two governed IOC claim quotes; rows 2, 5, 6 reproduce IOC's
own open-world carve-out rows near-verbatim; row 3, "dividend equivalents
thereon, if applicable", is a fragment contained in IOC's first open-world
row). The boundary was preserved for governed lists and removed for open
world, and the header asserts the opposite of what the instruction does.
Given this repo's stated costliest failure mode is authoritative-looking
wrong comments, fix one or the other before commit: either the header states
that open-world duplication with INTERIM_OPERATING is accepted on purpose
(and why), or instruction 6 drops the "limb of a broader operating covenant"
clause and keeps only recurring-mandated/preferred-stock dividends, which is
all BREAK 3 actually needed.

---

## CLAIM 3 — the schema-default correlation. Verdict: **UPHELD WITH CORRECTION** (correlation real and reproduced; causal claim not established; do not sweep on this evidence)

**Reproduction.** From `run-manifest.json` (prompt id/version) +
`adapter-result.json` (`counts.open_world_candidates_total`) across the
TopBuild rung runs, excluding the two `-v2` reruns and the superseded MAE
dirs. 22 runs have adapter results (REPRESENTATIONS and NO_SHOP produced
none — "24 family runs" in the headers should say 22 measurable):

- **Pre-filled empty** (`"open_world_candidates":[]` in the shape), n=11:
  ANTITRUST 0, APPRAISAL 3, DIVIDENDS 0, DNO 5, EMPLOYEE_MATTERS 9,
  FINANCING_COVENANTS 6, GUARANTY 0, MERGER_STRUCTURE 1, MISC_BOILERPLATE 0,
  SPECIFIC_PERFORMANCE 0, TAX_MATTERS 4. Mean **2.5**, zeros **5 of 11**.
  Matches the handoff exactly.
- **Element schema shown**, n=11: CLOSING_CONDITIONS 10, CONSIDERATION 44,
  GENERAL_COVENANTS 4, INTERIM_OPERATING 49, KEY_DEFINED_TERMS 75,
  MAE_DEFINITION 2, MATERIAL_CONTRACTS 19, NO_OTHER_REPS 0, PROXY_MEETING 13,
  TERMINATION 8, TERMINATION_FEE 8. Mean **21.1, not 20.1** (sum 232/11),
  zeros **1 of 11**. The 20.1 in both v2 headers does not reproduce from the
  adapter counts; direction and magnitude are unaffected, but a measured
  number committed into two header comments should be the right number or
  name its count basis. Fix before commit.

**Grouping is sound.** I checked every prompt module at HEAD: the split is
genuinely binary. All 11 "non-prefilled" prompts show an element schema
(whitespace variants `":[{`, `": [{`, `": [\n{` — a literal-`[{` grep
misses several; mine normalised for whitespace and the membership matches
the handoff's). The "absent" bucket is empty. No prompt shows anything in
between.

**The confound is worse than the handoff admits — near-total collinearity.**
Measured prompt overhead (built message minus source text, via each family's
real builder at the run's prompt version): every pre-filled-empty prompt is
under 1,700 chars **except ANTITRUST_REGULATORY at 6,478**; every
element-schema prompt is 2,521+. One crossover point in 22. You cannot
control for prompt length in this data; the two variables are the same
variable, once. Three observations, for and against:

- *For the schema hypothesis:* the single crossover, ANTITRUST (rich prompt,
  pre-filled empty), returned open-world **0**. If richness alone drove
  volume, the richest pre-filled prompt should not sit at zero. But n=1, and
  ANTITRUST's zero may be a true zero (25 candidates compiled, 10 resolved,
  all content potentially governed) — unadjudicated.
- *Also for:* within each group there is no length→volume gradient at all
  (pre-filled: the longest prompt has 0; element: the two longest,
  TERMINATION 11k and TERMINATION_FEE 13.6k, have 8 and 8; MAE at 9.3k has
  2). If richness were the dose, you'd expect a within-group slope.
- *Against, and the handoff missed this one:* families were not randomised
  to conditions. The element-schema group is also the group that was handed
  the document's content-heavy sections (KEY_DEFINED_TERMS 75 rows,
  INTERIM_OPERATING 49 — the two biggest section bundles), while several
  pre-filled zeros sit on plausibly-empty content (MISC_BOILERPLATE: 11
  boilerplate sections, 31/31 governed, 0 open world is credible;
  SPECIFIC_PERFORMANCE similar). Section-content volume is a third
  explanation the 2.5-vs-21 magnitude cannot exclude. The zero-*rate*
  difference (5/11 vs 1/11) is the more robust statistic, but two of the
  five zeros are the very cases that motivated the hypothesis — partial
  circularity — and the remaining three are candidates for true zeros.
- The v2 reruns do **not** de-confound: both changed the schema *and* added
  rich open-world instructions in the same edit. 0→4 and 0→6 confirm the
  zeros were suppressions, not that the schema line specifically was the
  suppressor.

**Is there a reading where showing the element schema increases fabrication
risk? Yes, bounded.** The demand characteristic cuts both ways: a shape that
displays a row template leans the model toward emitting ≥1 row. Observed in
the v2 reruns as padding, not invention: "dividend equivalents thereon, if
applicable" — a six-word fragment from an equity-award carve-out, verbatim
but marginal. Hard fabrication is structurally blocked from the store: the
adapter byte-verifies every quote against the admitted source and drops
non-verifying rows into the residual channel with a reason code
(`native-write-set-adapter.js:78–84`, counters at ~1227–1233), so an
invented quote cannot be written. What is *not* verified is the free-text
`why_unmapped`/`detail` prose, which is interpretive and enters the review
surface unchecked; and padding erodes exactly the property the programme
leans on — that a zero means something. Net: the schema change trades a
false-zero risk for a padding risk, and the padding risk is the cheaper one
to carry because verify-or-drop bounds it.

---

## Ways v2 could make extraction worse

1. **Structural open-world duplication, DIVIDENDS vs INTERIM_OPERATING, on
   every deal with a dividend limb in the IOC covenant — i.e. essentially
   every deal.** Demonstrated in `topbuild-dividends-20260808-v2` (all six
   rows duplicate IOC output). Ungoverned channel only, so no fact
   corruption, but published open-world row counts inflate and the review
   queue reads the same text twice under two families. The header claims
   this cannot happen (lines 36–38); instruction 6 makes it happen.
2. **Anti-empty pressure vs the standing correct zero.** `guaranty` v2 line
   40 pressures against three-empty-lists responses. Modiv §5.11 ("Other
   Transactions") is the programme's canonical correct zero (PLAN.md:888,
   1369) and has not been rerun under v2. Untested regression risk on the
   exact property the header claims to preserve.
3. **Wrong measured numbers committed into two header comments** (20.1 that
   reproduces as 21.1; "24 families" that is 22 measurable runs). This
   repo's documented costliest failure mode is exactly this artefact class.
4. **Boundary removal check:** the guaranty-conditionality that v2 removed
   was not load-bearing — four design artefacts (classifier exclusion,
   PLAN's own wording, the predecessor prompt, the 2E pin) show it was
   drift, not design. The dividends IOC-exclusion boundary *was*
   load-bearing and survives for governed lists, but was silently removed
   for open world (item 1).
5. Invented facts: bounded by verify-or-drop (see Claim 3); the residual
   exposure is unverified `why_unmapped`/`detail` prose and padding noise.

Mechanical state: `CI=true node --test tests/canonical-v2-guaranty.test.js
tests/canonical-v2-follow-on-family-prompt-contract.test.js` exits 0 (6
pass) against the v2 files. Full-suite and build gates not run here.

## The cross-family question: fix the other ~13 pre-filled-empty prompts?

**Propose it to Ben, but as a three-family controlled probe, not a sweep.**
The current evidence does not clear the bar for invalidating recorded
evidence across 13 families in one move: the correlation is confounded twice
(prompt richness, section-content volume), the two clean-looking reruns
changed two variables at once, and several of the group's zeros are
plausibly true zeros. But doing nothing is also wrong: the mechanism is
plausible, the reruns prove at least two zeros were suppressions, and the
channel being suppressed is the safety net — a systematic suppressor there
silently converts "correct zero" into "unfalsifiable zero" for every family
carrying the pre-filled shape, which is the epistemology PLAN.md's
falsifiable-prediction discipline depends on.

The probe that actually settles it: change **only** the `RESPONSE_SHAPE`
line — `[]` to the element schema — in three pre-filled families, leaving
instructions byte-identical, and rerun on TopBuild (and Modiv where mapped):

- `ANTITRUST_REGULATORY` — the crossover point. Rich prompt already; if the
  schema-only edit moves its 0, prompt richness is dead as the rival
  explanation. If it stays 0, the correlation was mostly confound and the
  13-prompt sweep dies for the price of three runs.
- `MISC_BOILERPLATE` and `SPECIFIC_PERFORMANCE_REMEDIES` — the other
  suspicious zeros with terse prompts.

Version-bump only those three, which invalidates three families' replays,
not thirteen. Sweep the remainder only if the probe separates the variables
in the schema's favour.

## Before these two files are committed

1. Rerun Modiv `GUARANTY_FINANCING_PARTY` under v2; require the zero to hold.
2. Resolve the dividends header/instruction contradiction (accept the IOC
   duplication explicitly, or narrow instruction 6).
3. Correct the header numbers (21.1 per adapter counts, or name the count
   basis; 22 measurable runs).
