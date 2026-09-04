# D&O item-42 ruling application — independent review

**Date:** 2026-09-01
**Reviewed commits:** `670346cb` (application), `e86e666c` (safeguards)
**Reviewer:** independent session that did not author the change, on a fresh
clone of `origin/codex/recover-m7-20260812`.
**Result:** PASS.

## What was reviewed

Application of Ben's 2026-08-25 ruling `dno-item-42-linked-duty-blocker-b`
(option `approve-child-profiles`) through a successor session, per
`docs/codex-program/notes/N1-DNO-ITEM-42-RULING-APPLICATION-RECEIPT-2026-09-01.json`.

## Findings

1. **Successor model, not mutation.** The sealed 31-profile predecessor
   package is preserved byte-identical (407,522 bytes, SHA-256
   `5fccaa14…`). The 33-profile successor lives at a new path
   (`…-item-42-successor-2026-09-01.json`, 431,970 bytes, `f66610f5…`),
   bound by a four-part successor authority chain (policy pin, Ben inventory
   session, package seal, registration).
2. **The validator was extended, not weakened.** The original item-42
   uniqueness gate remains in `m7-v2-contract.js`. The successor is accepted
   only under a registration successor authority pinned to the exact ruling
   id and option, predecessor seal digest, Work3 entry-correction authority,
   exact new profile keys, exact changed ordinals, profile count 33, and
   `stamp_clearance_permitted: false` / `production_activation_permitted:
   false`. Any deviation fails closed.
3. **Legal substance verified against source bytes.** The
   distinct-operative-units determination was checked directly against the
   canonical Metsera text: the receipt's evidence span `[202862,203131)`
   reproduces its recorded SHA-256 exactly, and the source separately
   enumerates "(ii) shall survive the Merger" at `[202825,202856)` and
   "(iv) shall not, except as may be required by Law, be amended, repealed
   or otherwise modified…" at `[203136,203421)` — two separately enumerated
   operative limbs, supporting the two new profiles.
4. **Mechanical gates, re-run on this clone:** on-disk full-set validation
   PASS with 25 packages / 1,310 profiles; fixture-proof crosscheck 5,240
   proofs, 0 failures (growth of exactly 8 = 2 profiles × 4 fixture kinds);
   override refresh `--check` exit 0; D&O family test 12/12; contract slice
   242/242 with the full-set test restored to on-disk mode; CI trigger now
   includes `codex/**`.
5. **Honest posture preserved.** DECISIONS.md item 20 and the application
   receipt both record that no LEGAL_GROUPING review stamp was cleared by
   this application. Correct: those await Ben's rulings on the family
   briefs.

## Consequence

The sole gate on on-disk full-set Work3 validation is closed. Work3 closure
now waits only on the 24+1-parked manifest amendment (Ben approval point)
and the remaining review-stamp rulings, which proceed on the brief queue.
