# Re-validation ladder — sequencing decision

Ben's call, 8 August 2026, superseding the earlier "run it against all seven
deals, then expand" plan. Folds into Step 2X. Recorded here so it is not lost
before the plan is written.

## The sequence

After the plan is implemented, re-do the ladder rather than re-running
everything at once:

1. **Modiv, a few families**
2. **Modiv, more families**
3. **TopBuild**
4. **More deals**

## Why this is right

It is the ladder discipline the programme already runs on — 1 → 4 → 12 → 25
families, checking after each rung — applied to validation rather than to
build-out.

The changes in Step 2X are broad and simultaneous: a shared structure service,
vocabulary consumption across several families, absence discipline, the
corroboration fallback, the ambiguity guard, and a prompt bump. Run all seven
deals across 25 families at once and a regression is unattributable — you know
something moved, not which change moved it. Each rung isolates a smaller set
of causes.

Modiv is the correct first rung on the evidence, not by preference:

- **62 evidence directories**, the deepest baseline in the corpus (TopBuild is
  next at 33). More committed baseline means more that a diff can be checked
  against.
- It was already the **explicit regression pin** in the Stage 1 termination
  work, held at 12 → 12 unchanged as a control while six other deals moved.
  Reusing an established control is worth more than picking a fresh deal.

TopBuild is the correct second rung for two reasons: the next-deepest baseline,
and it is a genuine **sequential two-step chain**, so it exercises the topology
work that the four single-step deals cannot.

## The consequence that changes planning

**Acceptance evidence becomes per-rung, not one re-score at the end.** Each
rung needs its own pass/fail before the next is funded. The blind 96-card
re-score stays, but as the final rung's gate rather than the only gate.

## The cost caveat that decides where the prompt bump sits

Replaying a recorded run costs **zero model calls**. So every rung before the
prompt bump is effectively free, and can be run as often as we like.

The prompt bump invalidates prompt digests. Everything after it is a **live
run** at full token cost — and REPRESENTATIONS alone burned 2,734,334 output
tokens across 172 calls for four deals.

Therefore: push as much validation as possible **ahead** of the prompt bump,
and place the bump deliberately in the ladder rather than letting it fall
wherever the implementation order happens to put it. Resolver-side changes
(structure service, corroboration fallback, ambiguity guard, absence
discipline) are all replay-validatable. Only the producer-side changes (limb
assertion emission, IOC enum widening, transaction_steps, the 2F2 shape fix)
force live runs.

That argues for two distinct phases: a replay-validated resolver phase run up
the ladder at no cost, then one prompt bump, then a live-run phase up the same
ladder.
