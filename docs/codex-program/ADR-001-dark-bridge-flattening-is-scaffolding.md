# ADR-001: Dark-bridge flattening is scaffolding, not a serving path

Status: ACCEPTED, 2026-08-05. Decided by Ben.
Scope: Canonical V2 M3, the four dark bridges and anything that flattens V2
output into the legacy card shape.
Authority: this record decides an architectural constraint. It grants no
serving, persistence, activation or production authority.

## Context

Canonical V2's core model is normalised. `lib/canonical-v2/canonical-writer.js`
gives every entity its own identity at the right granularity:

```text
excerpts   -> excerpt_id                provisions -> provision_instance_id
claims     -> claim_revision_id         components -> provision_component_id
relationships -> relationship_revision_id
```

The legacy card shape is denormalised. A card is one row in
`public.provision_cards` carrying `id`, `provision_instance_id`, `excerpt_id`,
`primary_quote`, `features` and `ai_metadata`, with `claims` hanging off it and
bound by `excerpt_id`. It is a database contract plus a read path
(`lib/queries/review-deal.js`), not a rendering concern. The React review table
is downstream of it.

The four dark bridges flatten the first into the second. That was a deliberate
choice: it let V2 output be inspected beside legacy output without rewriting
the review renderer, and identical shapes are what make a side-by-side
equivalence diff possible at all.

Flattening does two separable jobs. One is shape conversion. The other is
verification: quote grounding against `primary_quote`, lineage binding,
identity reservation, open-item reconciliation. The verification is valuable
whatever shape the output lands in. The shape conversion is where information
is destroyed.

## The problem this record exists to prevent

Every defect found in the 2026-08-05 audit was a consequence of the flattening,
not of Canonical V2. The core model was clean throughout. Specifically:

- excerpt-only card identity in three of the four bridges;
- the cross-family merge collision that makes chaining two bridges into one
  review deal impossible;
- a bare `UNIQUE INDEX ... ON public.provision_cards(excerpt_id)` that will
  hard-block any future promotion write.

The root cause is that the same field name carries incompatible semantics on
each side. Legacy `excerpt_id` is `dealId:sectionPath:spanHash:index`, so it
embeds the provision and is 1:1 with a card by construction. Canonical V2
`excerpt_id` is `contentId(EXCERPT_DOMAIN, { quote, start, end })`, a pure
content hash with no deal, section or provision component, so two siblings
quoting one sentence correctly share it. Translation copied the name across and
silently inherited the legacy uniqueness assumption with it.

Scaffolding that works tends to become permanent. Today the only thing stopping
flattened cards from being persisted is that bare unique index, which is an
accident rather than a decision. This record replaces the accident with a
decision.

## Decision

1. **Flattening into the legacy card shape is a preview and equivalence
   scaffold. It is never a serving path and never a persistence path.**

2. **Flattened cards must not be written to `public.provision_cards`, to
   `claims`, or to any other persistent store, ever.** No promotion path, no
   import, no backfill, no migration. If a future requirement seems to need it,
   that is a signal to build native serving instead, not to relax this.

3. **Native serving must consume Canonical V2 projections directly**, not
   bridged legacy cards. This is what actually clears a parity blocker, and it
   inherits none of the flattening's identity problems.

4. **Do not extend flattening beyond the four existing areas**: Material
   Contracts, No Other Reps/Fraud, General Covenants, Representations. A fifth
   bridge requires a new decision, not an extension of this one.

5. **Bridge verification logic is worth keeping and may be reused** by a native
   path. It is the shape conversion that is scaffolding, not the guards.

## Why this is already structurally enforced, and where it is not

The parity register enforces most of this mechanically, which is the reassuring
part. A dark bridge is unreachable from any served Next.js route, so a surface
proved only by a bridge reports `NATIVE_INTEGRATED_NOT_SERVED` and can never
clear a blocker. The 27 `NOT_VISIBLE` blockers can only clear when a served
consumer imports the V2 projection and satisfies rulings 1 and 2 on adapter
proof. A bridge is therefore structurally incapable of becoming the serving
path.

What is **not** enforced mechanically is constraint 2. Nothing in code prevents
someone writing bridged cards into `public.provision_cards` except a DB index
that exists for unrelated reasons and that the excerpt-identity remediation may
legitimately want to change. That gap is the reason this record exists. Anyone
proposing to alter `provision_cards_excerpt_unique` must satisfy constraint 2
by some other explicit means first.

## Removal condition

This scaffolding is not permanent, and the condition for deleting it is
testable rather than a matter of judgement.

A bridge is removed when **every parity surface for its area reports
`NATIVE_VISIBLE` through a served consumer that imports the V2 projection
directly**, under the strict locator rule.

At that point delete the bridge module, its config integration, its fixtures
and its tests. Do not leave it dormant behind a disabled gate. A disabled
scaffold is still a maintenance liability and still a promotion temptation.

Until then each bridge stays dark, gated, read-only, and outside every product
route.

## Consequences

- The Review preview lane built under ruling 1 depends on bridged cards, so it
  is scaffold-shaped too. It must not be mistaken for the eventual native
  Review surface, and it inherits this record's removal condition.
- Work that clears blockers and work that improves the preview are different
  activities. Improving the preview will never move the blocker count. Anyone
  reading a flat blocker count should know that.
- The excerpt-identity remediation is still required even though flattening is
  scaffolding, because the live read paths in `claims-adapter.js`,
  `row-market-stats` and the corpus-stats helpers are not scaffolding. Those
  are real product code and their keying is genuinely wrong.

## Related

- `docs/codex-program/CANONICAL-V2-ACTIVATION-PACKAGE.md`, preconditions for
  native activation.
- `docs/handoffs/CODEX-TO-CLAUDE-HANDOFF-2026-08-04.md` section 46, the
  excerpt-identity audit; section 47, the strict locator rule; section 45, the
  pre-production activation authority.
