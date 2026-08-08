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
