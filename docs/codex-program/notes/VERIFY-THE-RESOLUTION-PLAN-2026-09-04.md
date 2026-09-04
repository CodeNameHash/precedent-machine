# Verifying the resolution layer: the finding, the idea, and the plan

Written 2026-09-04 for Ben, in answer to his question: *"what about
verifying the resolution section too? as a check?"* He asked for the plan
and the reasoning behind it, to hand to an independent model for checking.

Everything below marked VERIFIED was run against this repository today. The
commands are given so the checker can reproduce them rather than trust me.

---

## Part 1 — The thinking

### What I expected to find

The system extracts facts in two halves. An AI proposes "these words are the
answer"; deterministic code then verifies those words really are at those
bytes, parses the value, and resolves it into a governed fact. Ben's question
noticed an asymmetry: **we verify the AI's half and trust the code's half.**
Resolution is not clerical — it decides which party owes, which registered
concept a fact belongs to, and whether the fact is trustworthy. Nothing checks
it.

That was a good question and I expected the answer to be "you're right,
nobody built that check, here's how we'd add one."

### What I actually found

The check was designed. It has named slots. They are empty, and because they
are empty **the system has never trusted a single fact it produced.**

VERIFIED, across every resolution output in the evidence tree:

```
resolved claims: 3,569
auto_pass: false on 3,569 of 3,569
```

Blocking conditions present on all 3,569:

```
V1_V2_COMPARATOR_ABSENT             3569
SOURCE_SCOPE_CERTIFICATION_ABSENT   3569
```

plus family-specific ones on subsets (`LEXICAL_LEXICON_UNCOVERED_FAMILY` 597,
`MAE_DEFINITION_SELF_CONTAINMENT_UNPROVEN` 264, and others).

Reproduce:

```
python3 -c "
import json,glob,collections
c=collections.Counter(); cond=collections.Counter(); n=0
for p in glob.glob('evidence/canonical-v2/*/resolution.json'):
    d=json.load(open(p))
    for r in (d.get('resolved') or []):
        t=r.get('triage') or {}; n+=1; c[t.get('auto_pass')]+=1
        for u in (t.get('unevaluated_conditions') or []): cond[u]+=1
print(n, dict(c)); print(cond.most_common(8))"
```

The rule is in `lib/canonical-v2/native-producer/candidate-resolution.js`
(around :6186): `autoPass = deterministicGatesPassed &&
unevaluatedConditions.length === 0 && !citationCorroboratedOnly`. The
invariant the code states for itself is exactly right — *"a check that was
never run must never look passed"* — and its own comment concedes the
consequence: `auto_pass` "stays permanently false for now".

### Why this is the bottleneck, and extraction is not

The system can already extract. It has produced 3,569 resolved claims across
390 run directories. What it cannot do is say **"this one is safe"** about any
of them. Every fact it has ever produced requires a human to read it.

That is the thing standing between here and an internal launch. A tool that
extracts 3,569 facts and can vouch for none of them is not a tool a lawyer can
use; it is a very expensive highlighter.

### Why the designed check cannot be finished as designed

The first blocking condition wants a V1-to-V2 comparator. That module exists
(`native-producer/v1v2-comparator.js`, 36 KB) and the resolver references it,
but its output is an optional input nobody supplies at runtime — hence
`ABSENT` rather than a result.

Wiring it will not open the gate, for a structural reason the codebase already
records. `scripts/nets-eligibility-report.mjs` carries an "HONESTY PIN":
`both_nets_clean` is zero on every claim in all three committed runs **by
construction** — every resolved claim is REP-family, REP cards carry no Tier 2
values, so the comparator condition stays
`V1_V2_COMPARATOR_INAPPLICABLE_TO_CLAIM`.

In plain terms: **the comparator compares V2's answer to V1's answer, and for
representations V1 never produced a comparable answer.** A trust gate that
depends on it can never open for the largest family group, no matter how well
it is wired.

And running that report today (VERIFIED, read-only, offline, exit 0) returns
BLOCKED for all three deals — the V1 snapshots lack verified issued identity
bindings. So the gate is currently not merely shut; its own eligibility is
unmeasurable.

### The idea

**Replace the unreachable trust condition with one that can actually be
evaluated: an independent AI corroboration of the resolved fact, calibrated
against Ben's own 50-item review.**

Three things make this the right shape rather than a new invention:

1. **The architecture already exists and names what is missing.**
   `native-producer/corroboration-ladder.js` defines five rungs —
   `EXACT_LITERAL`, `NORMALISED_FORM`, `ANCHOR_STEM`, `MODEL_IF_EMPTY`,
   `MODEL_UNLESS_POSITIVELY_CONTRADICTED` — and caps runtime at rung 2. Its
   own header says the model rungs "remain analysis only because the resolver
   has no calibrated model-deferral adapter." The missing piece is named. This
   plan builds it.
2. **It is not subject to the comparator's structural limit.** A model reading
   the clause and the resolved statement can corroborate a representation as
   readily as a fee. There is no family for which it is inapplicable by
   construction.
3. **The calibration set exists and is the right one.** Ben's fixed-50 review
   (19 correct, 31 incorrect) is precisely a labelled set of resolved facts
   with a lawyer's verdict attached. "Calibrated" needs labels; these are the
   only labels the programme has.

The check must be **independent and one-directional**:

- *Independent*: a different prompt, asked a different question. Not "extract
  the fee" but "does this stated fact follow from this text?" It must not see
  the extraction's reasoning, or it will agree with itself.
- *One-directional*: it may move a fact from trusted to review. It may never
  move one from review to trusted. Disagreement costs a review item;
  agreement never manufactures confidence on its own. This keeps the
  fail-closed property the whole design rests on.
- *Recorded, not re-derived*: its verdict, prompt digest and raw response are
  stored, so a later reader sees what was asked and answered rather than
  re-running a non-deterministic call.

### Where I might be wrong

Stated plainly, because the point of this document is to be checked:

1. **I have not established where Ben's 31 failures actually sit.** If most
   are already in `review_queue`, the system "knew" they were doubtful and the
   problem is presentation, not trust — a much smaller job. If most are in
   `resolved`, the trust layer is genuinely missing. **These are different
   worlds and I have not measured which one we are in.** That is step 1 below
   and it should happen before anything is built.
2. **An AI corroborator may not catch what Ben caught.** The dominant failure
   class in his review was roles and qualifiers inside a correct span never
   being typed. A corroborator asked "does this fact follow?" may say yes to
   an under-specified fact that is not *wrong*, only incomplete. If so the
   check needs to be about completeness against the required-role list, not
   about truth. Step 3 measures this and it is the most likely place for the
   idea to fail.
3. **`SOURCE_SCOPE_CERTIFICATION_ABSENT` is not addressed here at all.** It is
   the second universal blocker, it wants proof that the source scope examined
   was complete, and it is a different problem from corroborating a fact. Even
   a perfect corroborator leaves this condition standing, so `auto_pass`
   stays false until it is separately resolved or Ben rules it out of the
   trust gate. **A checker should press hard on whether this makes the whole
   plan moot.**
4. **I have not verified that the 3,569 claims are current.** They come from
   runs dated August. If the resolver has changed since, the counts hold but
   the conclusions about specific claims may not.

---

## Part 2 — The plan

Days are working days. Nothing here needs a governed authority except where
stated, because every step reads existing evidence or writes to an isolated
scratch root.

### Step 1 — Locate Ben's 31 failures in the output. Half a day. No new code.

Cross-reference the fixed-50 review against the resolution outputs. For each
of the 50: which bucket is it in (`resolved` / `review_queue` / `open_world` /
absent entirely), and what conditions are on it.

Produce one table: Ben's verdict against the system's own confidence.

**This is the decision point.** Four outcomes, three of which change the plan:

- Most failures already in `review_queue` → the trust layer works better than
  believed; the problem is that nothing is ever promoted out of review. Build
  the promotion path, not a new check.
- Most failures in `resolved` → the trust layer is genuinely absent. Continue
  to step 2.
- Most failures absent entirely (no row at all) → this is a coverage problem,
  not a trust problem. 13 of the 31 are known to be "no row at all", so this
  is already partly true and the split matters.
- Failures spread evenly → the system has no signal at all, and the check has
  to be built from scratch rather than calibrated.

Do not skip this step. It is cheap and it determines which of four different
problems is being solved.

### Step 2 — Build the corroborator. 2–3 days.

A module taking `(resolved fact, its source closure bytes, its subtype's
required-role list)` and returning a structured verdict:
`CORROBORATED` / `CONTRADICTED` / `INCOMPLETE` / `ABSTAIN`, with a reason and
the spans it relied on.

Reuse rather than rebuild: the provider seam and record/replay
(`native-producer/provider-interface.js`, `provider-record-replay.js`), the
byte verifier (`checkEvidenceScope`), the existing family prompts as a
starting point for wording.

It asks about a fact that already exists. It never proposes one.

### Step 3 — Calibrate against the 50. 1 day, plus one Ben session.

Run the corroborator over all 50 items. Compare with Ben's verdicts.

Measure: of the 31 he marked wrong, how many does it flag? Of the 19 he marked
right, how many does it wrongly flag?

Pre-declare the bar before looking: **it must flag at least 24 of the 31 and
wrongly flag no more than 3 of the 19.** A checker that flags everything is
worthless; a checker that flags nothing is worse.

Also record, per item, whether the failure was falsity or incompleteness —
this settles open question 2 above.

### Step 4 — Decide, with Ben. Half a day.

If it clears the bar: adopt it as the model-deferral adapter the corroboration
ladder has been waiting for, raise `MAX_RUNTIME_CORROBORATION_RUNG`, and put
`V1_V2_COMPARATOR_ABSENT` to Ben as a condition to *replace* rather than
satisfy, on the recorded ground that it is structurally unreachable for
representations.

If it misses the bar on incompleteness rather than falsity: rebuild the check
around the required-role list instead of truth, and re-run step 3 once.

If it misses on both: stop. The trust layer needs a different idea, and three
days have been spent instead of a quarter.

### Step 5 — The remaining blocker. Ben's ruling, not an engineering step.

`SOURCE_SCOPE_CERTIFICATION_ABSENT` still stands on every claim. Ben decides
one of: build the scope-closure machinery (unscoped, and nobody has costed
it); narrow the trust gate so this condition governs only families where
completeness of scope is legally load-bearing; or accept it as a permanent
review reason for internal launch and revisit before anything external.

**No amount of engineering opens the gate without this ruling.** It should be
put to him with the same care as the misfiling question, and it is the single
most likely reason this plan does not deliver a usable internal tool.

### Step 6 — Measure the number that matters. Half a day.

With the corroborator wired and Ben's step-5 ruling applied, re-run the
resolution outputs and report: **what fraction of facts can the system now
vouch for?**

That percentage is the internal launch readiness number. It has never existed.
Today it is exactly zero, and nobody has said so out loud.

### What this does not do

It does not settle which extractor to finish. That question is separate and
does not block this work: the corroborator checks a resolved fact regardless
of which pipeline produced it, and it will be needed either way. If anything,
building it first makes the extraction comparison easier to judge, because
"how many facts can we vouch for" is a better score than "how many did a
lawyer mark correct".

### Cost

Roughly 5 days of build, one Ben scoring session, one Ben ruling. Against a
current state of zero trustable facts.
