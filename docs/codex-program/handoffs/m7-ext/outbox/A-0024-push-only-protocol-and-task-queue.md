id: A-0024
from: lead
to: ext
date: 2026-09-04
re: protocol change to push-only; your task queue through Phase 2 preparation
status: STANDING (supersedes A-0018 cadence; no answer required)

# Protocol change (Ben, 2026-09-04)

The lead no longer polls this channel. From now:

1. **You signal, we wake.** When you push a `Q` (a delivery or a blocker),
   post one comment on PR #488 with the Q id and one line. That comment
   wakes the lead. A `Q` without a comment is not seen until the next
   delivery review.
2. **Lead answers arrive only at delivery review** (an `A` per `Q`), not on
   a cadence. Between deliveries, record assumptions in `status/` and keep
   moving. An assumption the review rejects costs one round; waiting costs
   more.
3. **Blockers only** go to PR #488 outside a delivery: something that stops
   all queued work, or a governance question (anything touching
   `control/`, `receipts/`, registrations, or a legal reading).
4. **PINS.md is the standing state.** Read it before each task; it names
   the current recovery-branch commit and what changed.

# Task queue (work in order; do not wait for an A between tasks)

## T1. Q-0025: PR #489 resubmission (in progress)

A-0022 items 1 to 19, rebased on `fd6f662d` (A-0023). Deliver with the
reason-code counts, the per-family breakdown, per-agreement file sizes and
the helper's boundary category. Comment on PR #488 when pushed.

## T2. Phase 2 preparation: real-text fixture packs for every approved profile

Start immediately after T1 is pushed, without waiting for its review.

- Input: the 1,382 approved profiles (the sealed profile set) and your
  delivery 10 (profile anchors to real clauses, `ext/m7-verify-finding`).
- For every profile: at least one POSITIVE fixture (a real M4 claim
  occurrence in one of the ten sealed agreements whose text the profile
  should match) and at least one NEGATIVE fixture (a real occurrence of
  the same family it must not match), each as
  `{profile_id, agreement_id, claim_occurrence_id, node_occurrence_id,
  start_byte, end_byte, text_sha256, expected: MATCH|NO_MATCH, basis}`
  with UTF-8 byte offsets over the sealed canonical text and the sha256
  of exactly those bytes. `basis` is one sentence naming the clause
  feature that decides it. No synthetic text anywhere.
- For every profile: a proposed real-text matcher replacing its marker
  tokens, expressed in the contract's `evaluateMatchTest` vocabulary
  (`SOURCE_TOKEN_*`, `INDEX_NODE_KIND`, `CONTEXT_EDGE`,
  `TYPED_FACT_EQUALS`) plus, where a family regex is the natural test,
  a reference to `lib/canonical-v2/m7-v2-family-text-matchers.js`
  (create it on your branch by copying the FAMILY_MATCHERS table from
  `lib/canonical-v2/m7-deterministic-generalisation.js` with real-text
  fixtures; never import the V1 module).
- A profile with no real occurrence in the ten agreements gets
  `expected: NO_OCCURRENCE_IN_SEALED_TEN` and no matcher; count them.
- Output: one JSON pack per family under
  `docs/codex-program/handoffs/m7-ext/ext-scratch/phase2-fixtures/<family_key>.json`
  on a new branch `ext/m7-phase2-fixtures`, plus a census (profiles,
  positives, negatives, no-occurrence, matchers proposed, per family).
  Nothing under `control/` or `receipts/`; zero model calls.
- These are drafts for Ben's session 2. Deliver per family as you go
  (a Q per batch of families is fine); do not hold the pack for the whole
  set.

## T3. Draft specs for the Work 3 and Work 4 real-text successors

After T2's first batch is out. The authority's `phases[1]` and
`phases[2]` name every path, argv and receipt; the Work 2 real-text
scripts are the pattern. Write, as one Q, a spec for each in A-0017's
form (deliverables, contract changes needed, tests, acceptance), reading
re-plan §5 Phase 1 and Phase 3 and the original Work 3 and Work 4
validators for what those Works prove. Build nothing until the lead's A;
meanwhile continue T2.

## T4. Parked

`ext/m7-w5-renderer` stays parked. Work 6 (PR #486) stays held until the
final registration exists.

# Budget note

Ben has asked both sides to stop spending tokens on polling. Batch
questions into deliveries. One comment per push on PR #488 is the only
ping you need to send.
