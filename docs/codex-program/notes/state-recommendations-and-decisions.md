# Where we are, what I recommend, and what I need from you

Written 8 August 2026, after the staged structural fixes, a repo-wide asset
sweep, and REPRESENTATIONS extraction across four new deals.

---

## 0. A correction first

I told you REPRESENTATIONS had an "18.3% publish rate, 79 resolved and 353
held". That was wrong, and wrong in a way that made things look worse than
they are.

`review_queue` in `resolution.json` is not a reject pile. It is the **full set
of attempted claims**, each carrying a `has_resolution` flag and an
`auto_pass` flag. I had been reading it as an additional population alongside
`resolved` and adding the two together. The right reading is
`resolved / review_queue`.

Corrected: the fifteen REPRESENTATIONS chunks attempted 353 claims and
resolved 79 — **22.4%**. Corpus-wide across 25 families the figure is
**52.8%** (1,415 of 2,679), not the 34.6% that the wrong denominator gave.

The direction of every argument below is unchanged. The magnitudes are not.

---

## 1. The diagnosis, in one table

Resolution rate by family, all 2026-08-08 runs. Sorted worst to best.

| family | attempted | resolved | rate | open-world |
|---|---|---|---|---|
| financing-covenants | 40 | 5 | 13% | 21 |
| termination | 82 | 14 | 17% | 82 |
| consideration | 32 | 6 | 19% | 315 |
| representations | 421 | 92 | 22% | 1,319 |
| proxy-meeting | 78 | 18 | 23% | 53 |
| interim-operating | 404 | 105 | 26% | 301 |
| termination-fee | 59 | 22 | 37% | 57 |
| closing-conditions | 108 | 43 | 40% | 27 |
| antitrust-regulatory | 168 | 82 | 49% | 10 |
| dno-indemnification | 63 | 32 | 51% | 38 |
| employee-matters | 54 | 28 | 52% | 26 |
| mae-definition | 148 | 93 | 63% | 7 |
| no-shop | 439 | 326 | 74% | 64 |
| key-defined-terms | 96 | 74 | 77% | 477 |
| general-covenants | 54 | 46 | 85% | 62 |
| no-other-reps-fraud | 32 | 28 | 88% | 5 |
| material-contracts | 84 | 84 | 100% | 75 |
| merger-structure-closing | 82 | 82 | 100% | 9 |
| misc-boilerplate | 199 | 199 | 100% | 9 |
| tax-matters | 17 | 17 | 100% | 24 |
| specific-performance-remedies | 10 | 10 | 100% | 2 |
| appraisal-dissenters-rights | 6 | 6 | 100% | 23 |
| **TOTAL** | **2,679** | **1,415** | **52.8%** | **3,031** |

**Read the ordering, not the individual numbers.** The families at the bottom
— misc-boilerplate, tax-matters, material-contracts, merger-structure — are
the ones whose drafting is flat: one fact per sentence, no nesting. They
resolve at 100%.

The families at the top — financing covenants, termination, representations,
interim operating — are the ones drafted as a chapeau followed by lettered or
roman limbs, with qualifiers attaching at different levels. They resolve at
13–26%.

**Resolution rate tracks structural depth, inversely, across 25 families.**
That is your inheritance thesis, measured. It is not a prompt-quality problem
and not a model-capability problem. The resolver is being handed fragments
with no parent to inherit from, and it is correctly refusing to guess.

The open-world column says the same thing from the other side. Representations
produced 1,319 unmapped candidates against 92 governed claims — fourteen to
one. The content is being seen. It is not being placed.

---

## 2. What has already changed, and what it moved

All of this is committed, and the tree is green: `CI=true npm test` exit 0
(8,296 tests, 0 fail), `npm run build` exit 0, lint INVARIANT-4 PASS. Exit
codes captured to files, never piped.

| change | effect |
|---|---|
| Termination limb grammars + party-scope derivation | `TERMINATING_PARTY_REF_NOT_IN_QUOTE` 60 → ~3 corpus-wide |
| IOC categories consumed from V1 vocabulary | `CATEGORY_UNCORROBORATED` 105 → 33; Concho IOC 20 → 34 |
| MAE carve-out scoping to the definition record | SkyWater 18 → 28, Modiv 10 → 24 |
| Qualifier host-composition + lexicon v3 | Red Hat 13 → 32, Metsera 6 → 13, TopBuild 0 → 7 |
| Open-world silent-drop fix | String candidates now recorded, not destroyed |
| Replay identity fix | Recorded runs can no longer replay under a wrong model id |

**Blind re-score of the 96-card sample: 21 now resolve.** The number that
matters is not the 21 — it is that all movement sits in the four staged reason
codes (7/8, 6/8, 4/8, 4/8) and **every one of the eight untouched strata is
0/8**. Nothing moved by accident. I re-derived this myself by joining the
re-score to the blind key on card id rather than accepting the reported table.

Also: four deals onboarded from EDGAR with verified preambles, and
REPRESENTATIONS completed across Concho, Metsera, Skechers and SkyWater in
fifteen chunks after three whole-run deaths.

---

## 3. Recommendations

### Do now — resolver-side, no prompt change, no digest invalidation

1. **Adopt `segmentSubClauses` as the single structure service.** It already
   returns the limb tree: leaf spans partitioning a section, dotted outline
   paths, explicit chapeau nodes. 60 passing tests. Adopt it behind a byte
   conversion (`canonical-bytes.js` → `utf8ByteLength` / `utf8Slice`); do not
   port it to bytes.
2. **Generalise its inline-enumeration case** so colon-introduced runs split.
   *In flight now* — this unblocks 12 held Metsera and Concho MAE rows.
3. **Port the `bring-down-tiers` whole-clause pattern** as the general shape
   for every qualifier-bearing family: keep the whole clause, split provisos
   off the operative text, derive the code lexically, derive scope from the
   prefix, retain the full clause as the quote.
4. **Fix the 11 unsafe absence wordings** by copying
   `termination-fees.config.js`, which already distinguishes "not yet
   extracted" from "established absent". Same directory — a mechanism port,
   not new design.
5. **Adopt the 33 rules the test suite already asserts** as the acceptance
   criteria rather than writing new ones.

### Do next — blocked on your decisions in §4

6. Generalise `EXCEPTED_BY` off its single-deal, offline-only scope.
7. Build the open-world promotion path, gated on corpus frequency using the
   mechanism already in `expected-sets.js`.
8. Converge the five separate structure mechanisms onto one structure-context
   service (see §5).

### Batch into one prompt bump, not several

9. Limb-assertion emission for REPRESENTATIONS and MAE; the IOC producer's
   11-category enum widened toward V1's 25; `transaction_steps` fields; the
   2F2 open-world shape fix. One digest invalidation, not four.

### Do not do

- **Do not wire the topology detector.** 4/7 on real text. Its two false
  negatives are silent — they return `SINGLE_MERGER`, which looks like a
  normal answer — and its one false positive is labelled HIGH confidence. A
  fallback earns its place when absence is worse than a guess. Here absence is
  honest and the guess is not.
- **Do not run the 2F2 sweep standalone.** Fold it into item 9.
- **Do not populate your three empty vocab scaffolds.** They are yours.

---

## 4. What I need from you

Ordered by how much they block. Each says what I would do by default if you
say nothing, so silence is a decision rather than a stall.

**1. Ruling 2 — a mutual right becomes two rows, one per party. Not
implemented anywhere.** Mutual rights still mint a single row with
`EITHER_PRINCIPAL_PARTY` capacity. No stage ordered the change; making it
re-mints Modiv's committed claim identities and rewrites three pinned test
files plus the termination product projection. It was correctly flagged rather
than folded in silently — but your ruling is still outstanding.
*Default if you say nothing: hold, and fold it into the prompt bump in item 9.*

**2. Ruling 3 — narrow, then limb, then clause. Is that display or storage?**
I cannot tell from what you said whether the expansion is a UI behaviour over
one stored span, or requires three stored spans per fact. The difference is
large: the second changes the write path and the identity model.
`bring-down-tiers` stores fact-plus-whole-clause — two levels, not three.
*Default: two levels, expansion is display.*

**3. `MAT_MAE_AGGREGATE` split from `MAT_MAE_QUALIFIED`.** Both codes
pre-existed in the taxonomy; splitting them was an extension of your
never-alias principle, made without asking. Confirm or revert.
*Default: keep the split.*

**4. Parallel mergers are unrepresentable.** Modiv's Company Merger and OpCo
Merger are explicitly simultaneous. `step_order` is an enforced total order
and nothing in the contract carries a concurrency concept, so Modiv lands in
the same bucket as a malformed deal no matter how well we extract. Needs a
schema decision — a `concurrency` field, a sibling-step-group, or something
else. No default: I will not invent deal taxonomy.

**5. `DOUBLE_DUMMY` looks like a misnomer** for SkyWater and TopBuild. There
is no HoldCo; it is reverse-triangular-then-LLC-conversion. Rename, retire, or
keep. No default.

**6. `assertion_kind` is tagged inconsistently across deals** — `ACTIONS`
versus `EFFECTS` for the same class of fact. Needs a rule, not a patch. No
default.

**7. IOC: nine V1 categories are unreachable.** V1 has 25 categories; the V2
producer enum has 11. Nine categories that hit in the corpus cannot be emitted
at all, so no resolver work can recover them. Widening the enum is a prompt
change. Do you want all 25, or a chosen subset?
*Default: widen to the nine that hit in the corpus, no more.*

**8. Open-world promotion threshold.** If we build the promotion path, what
corpus frequency justifies promoting a shape into the taxonomy?
`expected-sets.js` uses 0.66 core / 0.33 common, but that answers "is absence
notable", not "is this real enough to govern". At seven deals, one recurrence
is 14%. No default — this is a precision/recall trade and it is yours.

**9. The 36 IOC codes in `rubric.js` — accept or prune.** They already answer
your hiring-versus-compensation question (`IOC-HIRE` and `IOC-COMP` are
separate) and cover the ground you did not want to reconstruct from memory.

---

## 5. What stays open after all of this

You asked directly. The answer is yes, substantially — and the largest item is
untouched by everything done so far.

**1. The limb tree cannot mint, and that is a producer problem, not a resolver
problem.** Two independent causes. The tree pre-pass keys on
capitalisation-specific candidate names that REPRESENTATIONS never emits. More
fundamentally, **the REPRESENTATIONS producer emits zero limb-assertion
candidates at all** — Red Hat's receipt shows 68 qualifiers, 12 open-world, no
limbs. The raw material is absent from the run. Rekeying the pre-pass would
mint empty trees.

This is the big one. Every resolver-side fix in §3 works around the gap rather
than closing it. Until the producer emits limbs, representations and interim
operating — the two largest families by volume, 825 attempted claims between
them — stay in the 20s. **Nothing on the "do now" list changes that.**

**2. Open-world promotion does not exist.** Not partially built: absent. One
hand-authored pin, marked `NOT_YET_GOVERNED`. 3,031 candidates corpus-wide
with nowhere to go, and the same shape re-opens on every new deal forever.
This is the structural answer to your question about supplying more approved
phrases: more phrases help, but without promotion you are hand-feeding it
indefinitely.

**3. Five separate structure mechanisms, none aware of the others** — the
termination limb finder, `findIocChapeau`, `qualifier-attachment.js`,
`limb-components.js`, and now `segmentSubClauses`. The recommended convergence
is one structure-context service answering "given a section and a span, return
its governing chapeau chain", with the rest becoming adapters over it. Not
built. Until it is, each family's inheritance is fixed separately and drifts
separately.

**4. Parallel deal topology** — unrepresentable, schema-level, §4 item 4.

**5. Nine IOC categories** unreachable until the producer enum widens.

**6. Twelve Metsera and Concho MAE rows** — in flight, should close today.

**7. Eleven unsafe absence wordings** still tell a reviewer the agreement
lacks something when all we know is that extraction found nothing.

### The honest summary

The work done today raises resolution on the families it touched and proves
the mechanism by which it did so. It does not fix the top of the table. The
families at 13–26% are there because their structure is never built, and
structure is built in the producer, which nothing here has changed.

**The next real move is the prompt bump in item 9, and it should be one
change, not four.** Everything on the "do now" list is worth doing and none of
it substitutes for that.
