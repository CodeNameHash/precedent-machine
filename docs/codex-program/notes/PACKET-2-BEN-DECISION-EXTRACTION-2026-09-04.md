# Packet 2: the extraction decision, for Ben

One decision, stated as plainly as it can be. Nothing here is authority
until Ben says so.

## What is being asked

Whether to reverse **DECISIONS.md #26 Q7**, taken 2026-09-03: *"additive
three, parser-only facts, no model calls."*

Reversing it would let a model propose findings inside the governed track.
Not reversing it keeps the track deterministic, which is what it is today.

## Why the question arose

The governed track's extractor matches provisions by testing single-word
token sequences against clause text. Its first candidate failed because
**0 of its 1,399 tokens appeared in any real agreement** — 24 provision
families were stopped (`FALSE_COMPLETE_FIXTURE`, 2026-09-03).

Ben, on being shown this: *"you can get fucked just because you didn't have
precisely the right words. Isn't this something ripe for AI to run the test
on?"* And on the requirement: *"What we can't lose is the ability to go
deterministically back to what words drove the answer. So I think the answer
is a guided AI run, then deterministic after that."*

An AI-assisted extractor built on that principle already exists in this
repository (`lib/canonical-v2/native-producer/`, 126 modules, 146 evidence
directories from real runs). The question is not whether to build one. It is
whether the governed track may use one.

## What the evidence does and does not support

**Established** (independently confirmed twice):

- The governed track is built on the AI extractor's frozen output. About
  130 of its runs are bound by SHA-256 into the analysis policy, and 1,526
  of M4's 1,528 claims are its resolver claims re-based onto governed byte
  coordinates. "Model calls: zero" in the track means zero *new* calls; the
  legal meaning already came from a model, in August.
- But the code currently under repair does **not** use that legal content.
  The generator reads only an occurrence identifier and one node identifier
  from each M4 claim, and re-derives meaning itself.
- Neither lineage serves production. Production is V1; every V2 path is
  gated to preview or local.

**Not established, and this is the important part:**

- That the AI extractor would have succeeded where the governed track
  failed. Of the 31 review failures, 15 are on agreements the AI extractor
  **never ran on** — 13 produced no row at all. That is *absent comparative
  evidence*, not evidence of success. An earlier summary of mine treated it
  as exoneration; that was wrong.
- That a model proposing a span and a kind is sufficient. It is not
  obviously so: a span and a kind do not by themselves produce the typed
  actors, objects, triggers, conditions, timing and qualifications that
  DECISIONS.md #18 requires for a complete proposition.
- That the AI extractor's own classifier works as designed in practice. Its
  model stage appears in **zero** of the bound runs, and every one of its
  claims is currently blocked from automatic acceptance.

## The recommendation

**Do not reverse Q7 on the evidence available. Run the comparison first.**

Both generators over the same frozen cohort, scored by Ben, before either
architecture is adopted. That is the programme's own recorded decision path
(`PLAN.md` §13, and the adversarial review of 2026-08-14) and it exists
precisely so this call is made on evidence rather than on argument.

## What the comparison needs before it can run

It cannot run today, and it is worth being exact about why:

1. **Sealed profiles for every subtype the fixed 50 requires.** The plan is
   explicit that starting before this "would measure missing profiles rather
   than generator quality." Those profiles are Phase 2 output, and Phase 2
   has not started.
2. **A PLAN/Decision amendment** creating a narrow experiment exception. A
   work-order file cannot override the zero-model rule.
3. **A separate Ben-signed experiment authority**, freezing before any call:
   provider, model and version, prompt digest, tool policy, sampling settings
   or seed, exact input/profile/validator digests, call and cost and time
   ceilings, isolated output root, retention policy, prohibited effects.
4. **A defined experiment**, which does not currently exist. PLAN §13 records
   only "a later isolated model experiment and subsequent blind sample." The
   two arms, the frozen cohort, scoring rules, the false-complete threshold,
   who reviews, and the stop conditions all still have to be written.

So the honest position is: **the architecture question cannot be settled on
current evidence, and the mechanism for settling it is gated behind work
that has not begun.**

## Ben's options

1. **Hold.** Q7 stands. Finish Phase 1 and Phase 2 as planned, then run the
   comparison with real profiles in place. Slowest, and the only route that
   produces a decision backed by measurement.
2. **Define the experiment now, run it later.** Write the two-arm design and
   the authority text while Phase 2 proceeds, so nothing waits on drafting
   when the profiles land. Costs little; commits nothing.
3. **Reverse Q7 now** on the argument that the deterministic arm has already
   failed on real text and a second demonstration is waste. Fastest, and it
   accepts an architecture change without a controlled comparison, on a
   programme whose last uncontrolled adoption produced 31 wrong items out
   of 50.

Recommended: **2**, then **1**. It keeps the decision evidence-based without
letting the drafting sit on the critical path.

## What is being written off, either way

No line-count claim is made here. A keep / replace / retire decision at
function level has not been done for either lineage, and should precede any
adoption. Raw line counts are a poor proxy and easy to game.
