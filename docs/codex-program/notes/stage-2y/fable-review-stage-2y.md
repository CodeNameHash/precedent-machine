# Fable adversarial review — Stage 2Y, 9 August 2026

Read-only review by an auditor that did not write Stage 2Y and shared no context
with the session that did. Commissioned because `CLAUDE.md` requires adversarial
review before work reaches Ben, and because Ben asked one question specifically:
**given these changes, are any other fundamental changes to the overall structure
of the system required or desirable?**

This note records what it found and what was done about each item. Every
amendment below is already in `docs/core/PLAN.md`.

---

## The structural answer

**No rebuild of the identity model or the producer/resolver split is needed.**
Three structural conclusions the stage's own evidence forced but which it had not
drawn:

**1. There is no unattended publication path, and the stage was named after
having one.** `auto_pass` is not merely false in a sample — it is **permanently
false by construction**: `candidate-resolution.js:5821-5833` unconditionally adds
`SOURCE_SCOPE_CERTIFICATION_ABSENT`, `V1_V2_COMPARATOR_ABSENT` and
`LEXICAL_DISAGREEMENT_NET_ABSENT` to every claim, with a comment saying so. Every
claim Stage 2Y recovers still routes to the queue the plan itself calls unread.
**Action: Step 2Y-0A added** — close or retire the three absent-certification
reasons, define what publishes unattended, and tier the remainder by risk. This
is the direct answer to Ben's question.

**2. The stage's own logic retires the per-kind regex corroboration layer, and
the plan would not say so.** Standing rule 1, ladder 2's top rungs and the 82/82
zero-conflict measurement all point one way: the deterministic layer's real jobs
are byte-verification, structure attachment, schema validation and *generic*
contradiction detection — not ~100 per-kind literal tables re-deriving legal
semantics. If the sweep picks rung 3/4 broadly, the tables 2Y-C migrates go
vestigial the day after migration and the rung-selectable scaffolding was built
for a retired layer. **Action: reordering added to 2Y-0** — sweep ladder 2 on two
or three families *first*, and let its answer size the rest.

**3. Structure should become first-class context once, not per-step.** The
sectionizer tree is computed every run and never consulted in
`candidate-resolution.js`. Hierarchy is now demanded in at least four places —
chapeau chains, head+limb composition, IOC attachment hosts, cross-provision
defined terms. 2Y-A wires it into one call site; each of the other three would
rewire separately. **Recorded; 2Y-A's scope not widened, but the convergence is
named.**

**What needs no change, stated plainly:** the claim identity model. See F2.

---

## Load-bearing facts: what held

| claim | verdict |
|---|---|
| `sourceParagraphForCandidate` slices a single `\n`-bounded line; `<p>` emits a hard newline | **CONFIRMED** — function at :5615-5625 on this branch, `p` in `line_break_tags` at `sec-html-canonical-text.js:18-23`. 2Y-A's premise holds |
| 4,241 = 762 + 2,692 + 787, 155 rows, 106 codes | **CONFIRMED** — recomputed independently, sums match exactly, including the 3,479 conflation correction |
| KNOWLEDGE 91 — resolver discards a correct model answer on a missing literal | **CONFIRMED** as a mechanism. Bonus finding: the header at :2190-2193 claims "a miss here never blocks resolution", which is false — another stale header |
| `anthropic-provider.js` deferred a reconciliation stage never built; 707/713 minted identically | **CONFIRMED by code**, not only by the comment |
| `auto_pass` false on every sampled row | **CONFIRMED and stronger** — false by construction, see above |

Mechanism-2 instances spot-checked in code and all confirmed, including
`MAE_QUALIFIER_IDIOM_PATTERN` tested live (simple form true, compound false,
exactly as claimed), `PRIMARILY_CAUSED` absent from the four-key dict, the
`OFFICER_CERTIFICATE` conjunction, the discarded spelled numeral, and
`matchFamily` flipping a family on one unmatched hit. Also: `taxonomy.js`'s
`KNOWLEDGE_STANDARD_META` is **richer** than the enum the resolver reinvented —
it carries a `/reasonable inquiry/i` synonym the resolver lacks.

---

## Findings, and what was done

| # | finding | action |
|---|---|---|
| **F1** | 2Y-I's headline arithmetic is false on its face: 306 + 157 = **463**, not 485, and `diag-qualifier-proxy.md` says so at its own line 38. "100% accounted for" was stated against the wrong denominator, twice | **Fixed** in mechanism 5 and in 2Y-I. The 22-row gap is now named as undiagnosed |
| **F2** | Ruling 4 overstates what is open. `finalizeResolvedCandidate` already computes `multiSpan`, evidence edges already carry roles, and two-span claims **already publish and persist**. Also, the bare cross-reference to "Ruling 3" pointed at nothing in `PLAN.md` and collided with the section's own ruling 3 | **Fixed** — ruling 4 reframed to the real question, and the dangling reference replaced with the actual location in `HANDOFF-2026-08-08.md` |
| **F3** | The committed register still stamps **90 rows / 732 occurrences UNDIAGNOSED**, contradicting the stage's headline claim. The `diag-gap-*` notes closed them; nobody wrote back | **Fixed two ways** — `_meta.undiagnosed_rows_are_stale` added to the register, and the per-row re-stamp assigned to 2Y-0's Change block |
| **F4** | Occurrences diagnosed but owned by no step: 66 material-contract buckets, 24 general-covenant codes, the 762 open-world fragments with no acceptance line, ~133 sub-threshold concepts, 152 blocked on ruling 4 | **Fixed** — ownership table added to the preamble; a second acceptance line added to 2Y-A specifically for fragment reattachment, which is a different operation from widening a window |
| **F5** | Internal inconsistencies: "four rulings open" while ruling 2 is answered; the handoff claiming all four carry defaults when ruling 4 does not; 2Y-H's rung 0 mislabelled as "exact match only" when today there is no classifier; standing rule 1 pre-committing the outcome the sweep exists to choose | **All fixed.** Standing rule 1 is now explicitly a hypothesis under test |
| **F6** | Every line number in the stage is from `origin/cursor/step-2x-free-phase-b641`, unlabelled, 100-200 lines ahead of `main` | **Fixed** — branch pinned in the preamble with verified equivalents. Substance survived at every site checked |

---

## Step 2Y-0, attacked specifically

Judged directionally right and better than the rule it replaced. Five real
problems, plus two smaller ones — **all seven now written into 2Y-0**:

1. **The anchor set could not validate what the gate depends on.** 60-100 claims
   across ~20 families × 5 error classes gives cells of 0-2, and zero-tolerance
   rests on detecting party and code errors that are near-absent from an honest
   draw. → the anchor set is now **seeded with known-wrong claims**, and
   detection rate on the seeds is the score.
2. **"Zero errors at any count" + imperfect adjudicators = every large rung
   fails.** A 1% false-alarm rate manufactures ~6 party-errors on a 623-claim
   census, and the plan never said whose verdict counted. → 3/3 unanimity **and**
   human confirmation.
3. **The knee rule was under-defined.** "The floor" undefined; criteria 1 and 4
   can disagree; marginal sets under 20 claims move five points on one verdict. →
   floor defined as rung-0 precision, criterion 4 wins, intervals required.
4. **The largest bill was missing.** Measuring rung-0 precision means adjudicating
   the *existing published* population — bigger than any marginal set. → honest
   order of magnitude now in the plan: **5,000-20,000 adjudication calls**.
5. **The joint run could reject but not attribute.** → leave-one-out replays at
   the joint point, six replays, free on the resolver side.
6. **Recall floors from `category-summary-features.js`** are V1 expected *shapes*,
   not per-deal truth, and a flat floor collides with "a family returning zero can
   be correct". → floors must be conditional on deal features.
7. **"Census below ~150" never stated its denominator** — the same sloppiness the
   step preaches against. → per (family, mechanism, rung).

---

## One substantive design caveat, accepted

**"Defer to the model" is the wrong primary mechanism for the knowledge
standard.** M&A agreements routinely *define* "Knowledge", often as actual
knowledge **after due inquiry** of named officers. The 82/82 zero-conflict
measurement compared the model against the **quote**, never against the
agreement's own definition — so it could not have detected this. Deferring
publishes `ACTUAL` on deals whose definition makes `AFTER_INQUIRY` correct: a
materiality-code error, which is 2Y-0's own zero-tolerance class.

**Action: 2Y-B rerouted.** The primary mechanism is 2Y-D's — resolve against the
agreement's own defined term — with model-deferral as the fallback where the
agreement defines nothing.

---

## Where the plan was sound, said so

- The register arithmetic is exactly right, and the 3,479 → 2,692 + 787
  correction is real and creditable.
- 2Y-E and 2Y-G are well-scoped and low-risk as written, and the Concho-25
  quarantine inside 2Y-G is exactly the right discipline.
- 2Y-M's stratified re-score matches the committed blind-sample README precisely.
- The identity model needs no fundamental change — the flagged risk resolves in
  the plan's favour, more strongly than the plan itself claimed.

## What Fable could not verify

The corpus measurements themselves — 78/91, the 82-row zero-conflict, the 66.4%
fragment share, 21 concepts / 146 occurrences — are internally consistent and
their extraction methods are stated, but re-deriving them means re-parsing
`corpus-review-20260809.html` on the b641 branch, which was not done. The 2.7M
token figure has provenance but was not re-derived. `taxonomy.js`'s "429 codes,
54 vocabularies" counts differently under a different convention (68 exports /
576 entries); **"four consumed" was confirmed exactly**, which is the part that
matters.
