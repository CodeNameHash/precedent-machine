# Contract amendment path: new termination-right concepts (Ben ruled "A")

Ben ruled 2026-07-23: mint proper concept keys rather than accept
placeholder reuse. This spec defines the versioning path. Nothing here is
built until Ben approves the concept names below; everything downstream
of the build still ends at his activation.

## Proposed new concept keys (taxonomy values — Ben's yes/no)

Following the frozen naming style (TERMR-SUPERIOR, TERMR-RECOMMEND,
TERMF-TAIL):

- `TERMR-NOSOL-BREACH` — termination right for material breach of the
  no-solicitation covenant (QXO §6.4(a)(ii) class).
- `TERMR-BREACH` — general termination right for counterparty
  covenant/representation breach, bring-down/MAE-gated (§6.4(b) class).
- `TERMR-NOVOTE` — termination right for failure of the stockholder
  vote (§6.2(c) class).
- `TERMR-OUTSIDE` — outside-date termination right (§6.2(a) class).

Note: QXO's intervening-event recommendation change needs NO new
concept — §6.4(a)(i) is one recommendation-change provision family and
`TERMR-RECOMMEND` describes it accurately; the two COR variants are
distinguished at the trigger-code level (already approved).

## The serving-transition design (the actual hard problem)

Adding concepts moves `FIXTURE_CONTRACT_FINGERPRINT` (F1 → F2). Today the
ACTIVE query flow compiles F2 and would reject the active release's
F1-built rows — breaking the live preview path until an F2 release is
activated. Two designs considered:

1. **Release-declared fingerprint (RECOMMENDED).** The ACTIVE flow stops
   pinning the compiled fingerprint into the request; instead it accepts
   the fingerprint the active release pointer itself declares, validates
   rows against THAT, and returns it in the view (provenance unchanged —
   every row still names its contract). The compiled contract governs
   candidate BUILDING only. Serving stays correct across amendments by
   construction; activation remains the only way exposure changes,
   preserving the release-state authority. Small diff in
   `compileCanonicalActiveQueryRequest`/`resolveActiveQueryPage`;
   adversarially reviewed as a frozen-contract-adjacent change.
2. Dual-fingerprint acceptance (compile F1+F2, accept either) — rejected:
   hardcodes a transition pair, decays into a list, weakens the
   row-contract binding.

## Sequence (each step gated as noted)

1. Ben approves the four concept names (this doc).
2. Build under full review lane: option-1 serving change + its tests
   FIRST (proves the active F1 release still serves live before anything
   moves); then the concept additions (F2), fingerprint-pin test updates,
   QXO fixture re-keyed to the proper concepts, vocabulary packet
   (currently branch-held at 95718fb) rebased onto it. Merge keeps the
   live path green at every commit — verified against the preview after
   each merge, not just curled.
3. New QXO candidate release built under F2 via the staging scripts —
   dry-run artifacts prepared here; the import is Ben-run local per the
   programme.
4. Ben activates (serialisable release-state CAS) when certified. Until
   then the active release keeps serving under F1 and nothing user-facing
   changes anywhere.

## Status artifact

On merge of step 2, status generation 3 records the amendment (F2 value,
this spec as evidence, Ben's name approvals). The vocabulary packet's
branch-hold note is superseded.
