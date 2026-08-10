# The route from here to extraction that is actually good

Written 2026-08-10, after two runs that produced plans and no movement, and
after an adversarial review commissioned specifically to say the uncomfortable
thing rather than the encouraging one.

**Ben's instruction: "I don't mind if it takes a long route, I just want it to
be honest."** So this document leads with the finding that most damages the
existing plan.

---

## 1. The headline, first, because burying it would be a disservice

**85% placed is not reachable by fixing the defects we have diagnosed.**

The register's own arithmetic tops out at roughly **77% placed** even if every
unmeasured cohort delivers at 100% of its census upper bound. The only cohort
that has ever actually been measured delivered **22% of its planned figure**
(2Y-I: planned 463, measured 104). Weight the unmeasured cohorts by that single
calibration point and the honest central estimate is **51–59% placed**.

So the diagnosed register, fully executed, lands somewhere between **51% and
77%**, most likely near the bottom of that band.

### The arithmetic, shown

- Total rows the system sees: **5,002**. Placed in a governed claim: **1,571**.
  That is **31.4%**.
- 85% placed would be 4,252 rows — it needs **+2,681 resolved**.
- Every diagnosed recovery summed at its *upper bound*: ~195 (2Y-I + 2Y-B) +
  ~400 (qualifier remainder) + 324 (2Y-H) + ~500 (2Y-A, generously) + 130
  (2Y-J) + ~200 (2Y-C misc) + ~400 (held side) ≈ **+2,150**, which after
  duplicate removal is ~77% placed.
- The same set weighted by the one measured calibration point: **+900–1,300**,
  which is **51–59% placed**.

### What 85%+ additionally requires, stated plainly

1. **The reconciliation stage as architecture, not a patch.**
   `anthropic-provider.js` says reconciliation was "deliberately left to a later
   stage". That stage is the product's missing organ. 2Y-H builds it for
   representations; the same pattern is needed for whatever the next shaper
   mints generically.
2. **A calibrated model-deferral rung.** `corroboration-ladder.js` says it in
   its own code: rungs 3–4 are analysis-only *"because the resolver has no
   calibrated model-deferral adapter."* The deterministic-regex approach cannot
   close the last ~20% — the register proves it, with ~350 occurrences of "one
   drafter's habit, spread thin". Building that adapter is weeks of work, and it
   is precisely what the anchor and adjudicator apparatus exists to calibrate.
   **The instruments were not waste. They were sequenced wrong.**
3. **Corpus growth.** At seven deals the promotion loop has 14% granularity on
   recurrence, and the best demonstrable error bound on the largest family is
   3.2%. "Very good" is partly a function of deal count, and no honest plan
   hides that.

### The honest endpoint

**~55–70% placed at seven deals, in four to eight weeks** — and the exact number
becomes knowable after two cheap censuses in week 2, **not before**. Anyone
giving a firmer number today is doing what the last two plans did.

---

## 1a. AMENDED 2026-08-10, after a second adversarial pass tested the plan on real rendered rows

Three amendments, and one of them changes the headline metric.

### The metric is wrong, and a real row proved it

Running the actual 2Y-N preview service on a real Concho claim produced this:

```
deal: concho | section: conditions | row label: "Stockholder Approval"
cell: "Mutual conditions | Stockholder Approval | See provision |
       Stockholder approval required"
```

That is what a resolved claim is worth when the chain works. But the same run
found that **2 of Concho's 8 resolved Closing Conditions claims project to ZERO
review cards** (`CLAIM_PROJECTED_CARD_NOT_UNIQUE`), and `COND-REG` does the same
on Metsera.

**Resolved-but-invisible already exists.** The percentage and the product are
already two different numbers, today, before any new work adds a single row.

**So the headline metric becomes rendered rows a lawyer can use — not placed
percent.** Nobody has ever counted it. That count is a day of work over stored
runs and configs, and it should be the number this programme reports from now on.

### Ben's suspicion about the limb work was half right, and the other half is the finding

He asked whether the limb resolution really helps the percentages. Tested
directly:

**2Y-H alone mints a presence checkbox.** The limb claim carries only
`{section_reference, party_making, limb_path, subject}` plus the quote, with
`canonical_value: null`. For a real Metsera §3.13(a) limb it renders as:

> TERM: "Material Contracts — *Specified Contract list and copies*" |
> MATERIALITY: — | LOOKBACK: —

**He is right: 623 of those would move the percentage ~23% and the product very
little.**

**But the qualifiers are not missing. They are one join away.** Verified on the
Metsera representations run: **86 of 86 limb claims share a
`subject_occurrence_id` with qualifier claims — 107 of them** — and those
qualifier claims carry exactly the cells the row needs:
`MAT_MAE_QUALIFIED`, `MAT_ALL_MATERIAL`, accuracy standards, temporal qualifiers
for the LOOKBACK column, each with an `attachment` naming its `limb_path`.

**Those qualifier claims are the 2Y-I cohort** — the 485 open-world
`QUALIFIER_KIND_NOT_GOVERNED` rows. Joined, §3.13 becomes:

> TERM: "Material Contracts (§3.13, Company)" | MATERIALITY: MAE-qualified |
> LOOKBACK: as of the Agreement date — with the operative text attached.

**That is a row a lawyer uses. The value is in the join, the join key already
exists in the data model, and nobody has specced the joined projection.**

Consequences:

1. **2Y-H's spec changes.** Not a standalone "topic present" claim family —
   **topic as the routing key that projects the instance cluster** (limbs plus
   attached qualifiers) into the reps table. The classifier is the cheap part;
   the joined projection is the real work and the real value.
2. **2Y-H and 2Y-I ship together for REPRESENTATIONS.** Either alone produces
   thin rows: topics without qualifiers, or qualifiers with no rep to hang on.
3. **A 2Y-N route for REPRESENTATIONS is built before the classifier bakes
   topics in**, so Ben judges the joined row rather than the code.
4. **Value-honest restatement:** of the 623, ~324 classify (measured), and they
   upgrade to full rows only via the join; the 299 unclassifiable stay
   open-world. So "623 recovered" is really **~300 valuable rows and ~300
   unmoved** — the percentage flatters by roughly **2×** on this cohort.

**Same test on 2Y-A's bound fragments.** IOC (129), CONSIDERATION (89),
TERMINATION (19), DNO (27) and MATERIAL_CONTRACTS (15) attach into row shapes
that already render their payload — an IOC row is party band → covenant label →
restriction and exception pills, and a bound fragment fills a pill. **Those ~280
convert placed → useful immediately.** The 281 REPRESENTATIONS fragments are
gated on the same 2Y-H join; the 88 KEY_DEFINED_TERMS land in the definitions
sidebar, modestly. **Roughly half of 2Y-A converts to value directly.**

### The route the evidence most supports is more AI, and the plan already contains it — parked

Ben proposed "more AI in extraction" as a fifth route. Tested against the
corpus, **it is the strongest of the five**, and the architecture already has the
seam: `corroboration-ladder.js` states in its own header that rungs 3–4 are
analysis-only *"because the resolver has no calibrated model-deferral adapter."*

The evidence that the deterministic layer is the wrong tool: 91 of 91 knowledge
derivations returned null with **zero genuine conflicts**; ~350 occurrences of
one-drafter's-habit regexes; the dead ternary; the qualifier dispatch gap. **The
deterministic layer's failures are overwhelmingly "I have nothing to say" scored
as "the model is wrong."**

Two honest qualifications:

- **Rung 3 — defer only where derivation is empty — is intrinsically bounded**
  (it can never override a contradiction) and **could activate resolve-only,
  corpus-wide, now**, as 2Y-B generalised.
- **Rung 4, and publication on model placement, need exactly the calibration
  apparatus that has been the source of frustration.** The false-placement rate
  of model placement **has never been measured.**

**The reframe that matters: the anchor and adjudicator work is not bureaucracy
delaying the fix. It is the enabling instrument of the fastest structural
route.** It was sequenced wrong — placed in front of recovery instead of
alongside it — not wrongly conceived.

**And there is a cheap test that settles its priority with a number instead of an
argument:** sweep the model rungs over the 2,692 open-world rows **analysis-only**
and measure the per-family upper bound on what model placement recovers. Same
species of census as the one that produced 2Y-I's measured 104. That artefact
should be produced this week.

---

## 2. What is measured, and what is a guess

This table is the reason the ceiling is uncertain. Plan against the middle
column only where it says MEASURED.

| cohort | size | recovery estimate | status |
|---|---|---|---|
| 2Y-I qualifier dispatch | 485 | **104** | **MEASURED.** Planned 463 → measured 104. The one calibration point we have: **22% of plan** |
| 2Y-H rep topic reconciliation | 623 | **324 classify / 299 do not** | classification rate MEASURED; **precision unadjudicated** |
| 2Y-A fragment reattachment | 756 | ≤575 "host context available" | **NOT MEASURED.** The census says `candidate_host_binding_performed: false` in terms. Availability ≠ binding ≠ classification ≠ resolution |
| 2Y-B knowledge standard | 91 | ≤91 | mechanism confirmed; must follow the corrected definition-first spec |
| 2Y-G duplicate suppression | 59 + 107 | denominator removal, **zero resolved gain** | measured |
| 2Y-F lexical roots | 57 | clears flags on **already-resolved** claims, **zero resolved gain** | measured |
| 2Y-J promotions | 130 | ≤130, needs Ben's adjudication | recurrence measured, cards unadjudicated |
| 2Y-C vocabulary | ~150–200 | unknown | not measured |
| designed residue | ~450+ | **not recoverable** — ~133 one-deal concepts whose designed home is open-world, 299 unclassifiable reps, ~25 correct abstentions | n/a |

### The coupling nobody had stated

Of 2Y-A's 575 "available" fragments, **209 are REPRESENTATIONS and 71 are
KEY_DEFINED_TERMS**. A representations fragment successfully bound to its
chapeau becomes a limb-assertion candidate — which lands **straight back in
open-world** under `UNMAPPED_GENERIC_CLAIM_KEY` unless 2Y-H exists.

**So roughly 280 of the 575 face a second gate after binding. 2Y-A without 2Y-H
moves rows between open-world reason codes for over a third of its claimed
population.** That changes the ordering: 2Y-H is not a side quest to be deferred
for taxonomy design, it is a precondition for a third of 2Y-A's value.

---

## 3. Three confirmed defects that would have sunk the overnight run

Found by running the suite, not by reading it. **`CI=true npm test` on
`b7d84c1d` fails in three independent places.**

1. **A deadlock I wrote into the brief myself.** Seven tests in
   `tests/canonical-v2-human-anchor-review.test.js` demand
   `evidence/blind-review/2026-08-10/stage-2y-0-human-anchor-machine-packet.json`,
   which is not in git — while the brief's NOT-THIS-RUN section **forbids
   writing the regenerated packet**. The first push gate deadlocks: the agent
   must either violate the brief or weaken tests. *Fix: commit the
   deterministically-generated machine packet — it needs no human, the sitting
   is what waits — or revert the test change in `1401d7a3`.*
2. **A stale pin.** `canonical-v2-20260808-blind-current-rescore.test.js` pins
   the regressed CATEGORY stratum at 1; the WIP fixes produce 5. **The fix
   works; the pin is stale.**
3. **A broken receipt pin, and this one needs a person.**
   `canonical-v2-f28-live-run-pins.test.js` — the WIP resolver changes broke a
   **byte-for-byte receipt pin on a committed live run**. That is proof the
   "regression root-causes" changed existing resolution output. Left unattended,
   an agent regenerates the pin and masks whatever moved. **That diff must be
   reviewed by a human before the pin is regenerated.**

---

## 4. The unit error in my own brief

**"220–311 recoverable" was unit soup, and it would have fired my own stop
condition spuriously.**

- 2Y-F's **57** is *roots* whose effect is clearing flags on **already-resolved**
  claims. Resolved delta: **zero**.
- 2Y-G's **59** removes open-world rows. Resolved delta: **zero**.
- Real resolved yield of that item: **104 measured + ≤91 conditional ≈ 195
  maximum.**

So resolved would have risen ~104 against a stated 220, the stop condition "a
cohort comes in far under its estimate" fires, and the run halts on an artefact
of my arithmetic rather than a real finding. **Every cohort is reported in its
own column, in the state it actually moves.**

---

## 5. The route

### Week 1 — machine only, no human, mostly already built

- **Fix the three red tests first.** Nothing else is measurable on a red tree.
- **Re-run the 46-call regression batch first**, so every later measurement has
  a clean baseline. The current order measures resolver changes on top of a
  producer regression.
- Activate **2Y-I** (+104 resolved, measured), **2Y-G** (−166 rows of noise,
  reported in the open-world column), **2Y-F** (clears ~220 review flags,
  reported in the review column, **not** as recovery).
- **2Y-B only per its corrected spec** — KDT-definition-first, model fallback
  only where the agreement defines nothing. The 18 missing KDT records
  (SkyWater 13, TopBuild 5) need one contained live recording first.
- **Finish 2Y-N and ship the rendered-rows artefact.** This is what Ben actually
  asked for and it costs nothing.

**Expected outcome: placed 31.4% → ~36–37%.** Small. Every point real and
attributable.

### Weeks 2–3 — convert the biggest unknown into a number

- **The 2Y-A binding census.** Report-only: attempt binding, record per family
  how many fragments bind and of those how many classify. **This is the single
  most valuable artefact the programme can produce this week**, because it
  converts the largest unknown in the plan into a measurement. Zero model calls.
- **The qualifier-lexicon coverage census.** Same shape.
- **2Y-H design** (Opus-level, days, against corpus evidence) → **Ben gate 1** →
  free replay wiring, +324 at the measured classification rate.
- **2Y-A activated behind the two-stage guard in §6**, planned against whatever
  the binding census measured — **not against 575**.

### Weeks 3–6 — the unglamorous majority

- **2Y-C vocabulary grind**, ~200 rows, replay-validated, boring, real.
- **Per-family prompt batches** using the Closing Conditions playbook: one
  family per batch, four-state gate, **per-family prompt versioning**. Never a
  shared prompt artefact across families.
- **Held-side evidence re-plumbing.** The census shows `STORED_EVIDENCE_MISSING`
  on essentially all targeted held rows. **Nothing held recovers until spans are
  preserved**, and that is pipeline work, roughly a week, with no headline.

### In parallel, weeks 2–6 — the publication path

Anchor packet regeneration (machine), Ben's one re-sit, adjudicator scoring, the
release-receipt adapter. **It gates only the flip and blocks nothing above.**

---

## 6. 2Y-A is not safe unattended as written. This is the guard.

> Item 3 runs in **two committed stages**. **Stage 1:** extend the census to
> attempt binding *report-only* — record per family how many fragments bind, and
> of those how many classify; commit the artefact; touch no disposition.
> **Stage 2** activates only through the existing `context_rung` /
> `context_ladder_mode` seam in `resolveCandidates`, converts UTF-16 boundaries
> via `canonical-bytes.js`, hands no corroborator concatenated whole-section
> text, and commits a per-deal resolution-set diff proving **zero
> previously-resolved claims changed value or state**. If stage 1's
> bind-and-classify count is under half the stage-2 yield you expected, **stop
> after stage 1 and report the census** — that artefact alone is the night well
> spent.

---

## 7. Prompt work versus resolver work

The evidence supports **neither** as "the" lever.

Closing Conditions' prompt change: **+37 resolved, −23 open-world** on one
family, the largest single measured gain anywhere. The same batch: **+35
open-world** across Financing and Proxy, and **three claims vanished from
producer output entirely**. Meanwhile the biggest register row — 623
representation limbs — is **not prompt-addressable at all**: the producer output
is fine, the reconciliation stage is missing.

**The rule: diagnose per family which side is binding.** Closing Conditions was
producer-bound. REPRESENTATIONS is resolver- and architecture-bound. Prompt
batches are cheap (46 calls) but non-deterministic and per-family risky — so one
family per batch, four-state gate, and never a shared prompt artefact.

---

## 8. Ben's gates — three, and one is a merge

1. **Rendered rows.** The 2Y-N artefact, 30–50 real claims: excerpt → governing
   chapeau → the row a lawyer would see. **30–60 minutes, repeatable.** This is
   the product's definition of correct and it is the most valuable hour Ben can
   spend.
2. **The taxonomy sitting** — 2Y-H's topic list **and** 2Y-J's 15 promotion
   cards, in one session, **~90 minutes**. Both are irreversible taxonomy
   decisions; batching them halves the interruptions.
3. **The anchor re-sit**, before the publication flip. **1–2 hours, weeks away.**

Nothing else. Cohort activations, the gate split, suppression and the censuses
are all machine work.

---

## 9. The guard that stops this failing a third time

One reporting rule, enforced:

> **Recovery is the resolved-column delta, per family, snapshotted after every
> item. Nothing else counts.**

Both prior runs failed the same way: they reported a number — a rate, a cohort
sum — that moved while the product did not. The four-state artefact format
already exists (`stage-2y-phase-0-2-per-family-diff.json`). The missing
discipline is **per-item snapshots**, so attribution survives an overnight run.

---

## 10. What could not be checked, and by whom

- Whether the 46-call re-run reproduces the quote-pinned regression fixes. The
  `LEGACY_RESTRICTION_CATEGORY_QUOTE_ALIASES` compat entries match `source_quote`
  **byte-identically**, so fresh model output that rephrases a quote silently
  un-fixes SETTLE and CHARTER. **Nobody can know until the batch runs.**
- The true bind rate of the 575. **Nobody can, until the stage-1 census runs.**
- 2Y-H's classification precision. **324 classified says nothing about correctly
  classified** — that is exactly what Ben's taxonomy sitting is for.
