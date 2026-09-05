# Prompt for Deal Storylines

You are taking over Deal Storylines. Start from the product outcome and inspect
the repository before accepting its current architecture or rules.

The reusable lesson from Precedent Machine is not "make everything
deterministic" or "let AI do everything". It is this division of labour:

- Use AI where the task requires meaning, judgement, narrative synthesis,
  unusual drafting recognition or relationships across passages.
- Use deterministic code where the task requires source identity, exact text,
  locations, data shape, arithmetic, stable states, storage and rendering.
- Do not ask deterministic token rules to discover meaning they cannot locate.
- Do not treat an AI citation as proof. Code must verify that the quoted words
  exist in the preserved source. A human or a measured evaluation must verify
  that the words support the stated meaning.
- Keep the AI proposal, exact supporting spans and every later edit linked.
  The final storyline must be traceable back to the words and to the proposal
  that produced it.
- Show enough context to understand a citation. A clicked phrase should open
  the full sentence or paragraph, governing context, linked references and the
  wider source on demand.
- Separate positive facts from coverage. A well-supported positive fact can be
  accepted even when full-document coverage is unresolved. Absence claims need
  an explicit coverage state. `NOT_RUN` must never appear as `NOT_PRESENT`.
- Use one state per item. Do not place the same output in both a resolved store
  and a review queue.
- At first release, let AI create the draft and let the user confirm the final
  meaning. Earn narrower automation later from held-out results.
- Require individual review of proposed facts and exceptions, then one
  source-set-level coverage confirmation. Do not require a click on every
  passage. Let the user reopen a published storyline, edit it and publish a new
  reviewed revision while retaining the prior release.

Your first task is to propose the smallest deep interface that turns source
deal material into a reviewable storyline and then into an accepted storyline.
A useful starting shape is:

```text
analyseDeal(sourceSet, storylineSchema, model) -> draftStoryline
publishReviewedStoryline(draftStoryline, reviewDecisions) -> verifiedStoryline
```

Do not copy that interface if the repository proves a better seam. Do not
create a new architecture merely because the current one is untidy. Reuse
working source ingestion, evidence, review, storage and rendering modules.
Replace machinery that exists only to certify itself.

Run the build with a Sol Manager Loop. Follow Matt Shumer's pattern closely:

1. Start one GPT-5.6 Sol task as the manager. Put it in `/goal` mode with the
   full Deal Storylines outcome. It owns one large checklist split into phases.
2. The manager starts a separate GPT-5.6 Sol task as the implementer and puts
   it in `/goal` mode for Phase 0. Its instruction begins: `/goal Complete
   Phase 0 completely, extremely well.`
3. When the implementer finishes, it messages the manager. The manager checks
   the actual output and sends Phase 1. Repeat until every phase is complete.
4. Keep the same implementer across phases, as in the post. Replace it with a
   fresh Sol implementer only if its growing context causes visible drift.
5. Let the implementer propose plan corrections when repository evidence shows
   the written plan is wrong. The manager accepts or rejects the correction.
6. Use another independent Sol task to attack legal meaning, factual support and
   the final diff. The reviewer must not write the work it reviews.
7. Run bounded parallel tasks only when their files and outputs do not overlap.
8. Track progress in one checklist. Do not create duplicate dashboards,
   receipts, authority files or status ledgers.
9. If work stalls in detail without closing a checklist item, record the
   blocker in one sentence and move to the next safe task.
10. Run focused tests during implementation, the active product suite once per
   pull request, held-out evaluations when meaning changes, and live checks at
   cutover. Do not repeat an unchanged passing check.
11. Continue until a user can take real source material through the complete
   product without a developer or manual fixture. A passing test or completed
   phase is not the goal.

Before implementation, audit only rules and checks that block or protect the
touched product path. Keep one only if you can name the concrete product, data,
security or legal failure it prevents. Historical evidence can remain in Git
without controlling current delivery.

Record these in the single checklist, then immediately start Phase 0:

1. the proposed interface;
2. the end-to-end flow, with AI and deterministic steps labelled;
3. what existing code is reused, changed and retired;
4. one phased checklist with observable exit conditions;
5. the lean test and cutover policy; and
6. the exact first implementer prompt.

Do not ask for approval of technical choices. Ask only if two plausible source
readings would produce materially different legal output, or before an
authorised production cutover.

Start the manager with:

```text
/goal Own Deal Storylines through complete internal release. Create one large
checklist, split it into phases, and update it in place. Immediately start a
separate GPT-5.6 Sol implementer in /goal mode. Send it Phase 0 with: "Complete
Phase 0 completely, extremely well." When it finishes, verify the actual
output and send Phase 1. Continue until the real source-to-reviewed-storyline
product works without a developer.
```
