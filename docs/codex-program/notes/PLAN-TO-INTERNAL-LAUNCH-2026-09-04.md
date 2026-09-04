# One plan to an internal launch

Written 2026-09-04 for Ben. He asked for one plan to go at, and for the
reasoning, to hand to an independent model for checking.

This supersedes nothing in the governed record. It is a proposal.

Figures marked VERIFIED were measured against this repository today; commands
are in the companion note
`VERIFY-THE-RESOLUTION-PLAN-2026-09-04.md` so a checker can reproduce them.

---

## Where we actually are

Three numbers, none of which was on the table this morning.

**Extraction largely works.** VERIFIED: 3,569 resolved facts, across 7 deals,
spanning 109 concept keys — no-shop prohibitions, MAE definitions, merger
structure, representation qualifiers, employee covenants and more. Produced by
the AI-assisted producer (`lib/canonical-v2/native-producer/`, 390 run
directories).

**The system can vouch for none of them.** VERIFIED: `auto_pass` is false on
3,569 of 3,569. Two conditions block every one:
`V1_V2_COMPARATOR_ABSENT` and `SOURCE_SCOPE_CERTIFICATION_ABSENT`. The
resolver's own comment concedes it — `auto_pass` "stays permanently false for
now."

**The deterministic-only extractor cannot be finished.** Neither its matcher
nor its contract grammar can *locate* a role span; both only classify. The
re-plan says so itself: "nothing locates a quote inside clause text
deterministically", with the locator scheduled and undesigned. The only
locators in the tree verify a quote something else proposed.

So: the product is far closer than the plan suggests, and blocked on something
different from what the plan is working on. The bottleneck is **trust**, not
extraction. A system holding 3,569 facts it cannot vouch for is an expensive
highlighter.

## The two things this plan separates

**An internal tool** needs traceability: from a served answer back to the
exact bytes, and to the request that produced it. That exists at byte level
today.

**An external product** needs certification: registrations, receipts, sealed
candidates, an activation packet — the M9/M10 apparatus. That is what makes
output defensible to people who did not run it.

The current plan builds the second before delivering the first. Most of the
12–14 week tail is certification ceremony, not product. **This plan delivers
the internal tool first and defers the apparatus until something goes
outside.** That is a decision for Ben, and it is the single biggest lever on
the timeline.

---

## The plan

Working days. Each step says who owns it and what it produces.

### Step 0 — Establish where the failures actually are. 1 day. Lead. No new code.

Three measurements nobody has made:

1. **Where do Ben's 31 review failures sit?** In `resolved`, in
   `review_queue`, or absent entirely (no row produced)? 13 are known to be
   "no row at all"; the rest are unclassified.
2. **What is vouchable, per family?** Zero overall is established; the
   per-family breakdown of *why* is not.
3. **Coverage.** Which of the ten agreements × 25 families produced facts, and
   where the holes are.

**This is a genuine decision point, not a formality.** If most failures are
already in `review_queue`, the system knew they were doubtful and the problem
is that nothing is ever promoted out of review — a smaller job than building a
checker. If most are in `resolved`, the trust layer is genuinely missing. If
most are absent, it is a coverage problem. Three different plans follow.

Everything below assumes the second outcome. Revisit if step 0 says otherwise.

### Step 1 — One authority. 1 day. Ben signs.

Model calls inside the governed track are fixed at zero through M9. Every
useful step below needs one. Ben signs a narrow experiment authority: scope,
provider and model version, prompt digest, cost and call ceilings, isolated
output root, results non-consumable by any governed run.

Drafted for signature, not described. This is the only thing gating the rest.

### Step 2 — One harness, two questions. 3–4 days. Lead + Sonnet.

Build a single harness over the fixed 50 that answers both open questions in
one run:

**(a) Extraction.** Does "AI proposes span, kind and one quote per required
role; deterministic code verifies each quote byte-exactly, types it with the
existing parsers, and checks the subtype's required-role list" produce the
right answers? Reuses the 25 existing family prompts, the provider seam, the
byte verifier (`checkEvidenceScope`), and the value parsers.

**(b) Corroboration.** Does an independent AI check catch the errors Ben
caught? Different prompt, different question — "does this stated fact follow
from this text?", never "extract the fact". One-directional: it may move a
fact from trusted to review, never the reverse. Verdict, prompt digest and
raw response recorded, not re-derived.

Same 50 items, same run, one output. Detail for (b) is in the companion note.

### Step 3 — Ben scores once. 1 session. Ben.

He marks the output. **One sitting answers both questions**, because both arms
produce rows over the same 50 items he has already ruled on.

Pre-declared bars, fixed before anyone looks:
- Extraction: at least 28 of the 38 repair items correct, 12 of 12 controls
  held.
- Corroboration: flags at least 24 of his 31 known-wrong, wrongly flags no
  more than 3 of his 19 known-right.

Also recorded per item: whether a failure was *falsity* or *incompleteness*.
That distinction decides how the corroborator is rebuilt if it misses.

### Step 4 — Ben's two rulings. 1 day. Ben.

**Ruling A — scope certification.** `SOURCE_SCOPE_CERTIFICATION_ABSENT` sits
on every claim and no engineering below opens the gate without a decision on
it. Options: build the scope-closure machinery (unscoped, uncosted); narrow it
to families where completeness of scope is legally load-bearing; or accept it
as a standing review reason for internal use and revisit before anything
external.

**Ruling B — the trust gate.** Which conditions govern "the system may vouch
for this" internally. Specifically whether `V1_V2_COMPARATOR_ABSENT` is
*replaced* by corroboration rather than satisfied — it is structurally
unreachable for representations, because it compares V2's answer to a V1
answer that was never produced for them.

Without these two rulings nothing downstream can produce a vouchable fact.

### Step 5 — Wire what passed. 1–2 weeks. Lead + Sonnet.

- Wire the corroborator as a trust condition under Ruling B.
- **Turn on the AI classifier stage that already exists and has never fired.**
  Section classification is two-stage by design — title rules, then a model
  for the residue — and in every run to date only the 111 title rules have
  run. A section headed "Certain Payments" that contains the fee is invisible
  today.
- Re-run the ten agreements end to end.
- Report the number that has never existed: **what fraction of facts can the
  system vouch for?**

### Step 6 — The internal tool. 1–2 weeks. Lead.

The review UI exists. Serve vouchable facts as answers, everything else as a
ranked review queue, each row linking to the exact bytes. Ben uses it on a
live deal and says what is wrong with it.

That is the internal launch.

### Deliberately deferred

M9 certification, M10 activation, candidate registrations, sealed receipts,
the activation packet. All of it makes output defensible to outsiders. None of
it makes the tool more correct for Ben. It is revisited before anything is
shown outside, and the evidence chain is preserved meanwhile so nothing has to
be redone — the corroborator's verdicts are recorded as evidence from day one.

---

## Timeline

- Step 0: 1 day
- Steps 1–3: about a week, ending in Ben's scoring session
- **Go / no-go at step 4, roughly two weeks in**
- Steps 5–6: three to four weeks

**Internal tool in five to seven weeks, with the decision point two weeks in.**
Against the current plan's 12–14 weeks, whose first milestone is a Phase 2
that cannot end.

## What would sink this

1. **Step 0 says the failures are elsewhere.** Then a different plan follows,
   and it costs one day to find out.
2. **The corroborator misses on incompleteness.** Ben's dominant failure class
   was roles and qualifiers inside a *correct* span never being typed. A
   checker asked "is this true?" may pass an under-specified fact. If so it
   must be rebuilt around the required-role list. One re-run.
3. **Ruling A goes the expensive way.** If scope-closure has to be built, that
   is unscoped work nobody has costed and this timeline does not hold.
4. **Extraction misses its bar.** Then the AI-proposes route is not good
   enough either, and the honest answer is review-assisted extraction — a
   human in the loop per deal — rather than either automated path.
5. **The deferral is refused.** If the certification apparatus must come
   first, the timeline reverts to the existing plan regardless of anything
   here.

## What I am least sure of

The claim that internal use needs traceability but not certification. That is
a judgement about Ben's own risk, not a technical finding, and he is the only
one who can make it. Everything else in this plan is measurement or
engineering; that one line is the load-bearing assumption, and if it is wrong
the plan collapses back into the existing one.
