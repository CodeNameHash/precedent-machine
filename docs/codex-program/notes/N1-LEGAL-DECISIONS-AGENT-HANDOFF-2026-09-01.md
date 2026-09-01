# Handoff — N1 legal decisions / bucket taxonomy (2026-09-01)

**Status:** Prior agent failed Ben’s usability bar for “legal grouping review.” Ben is restarting with a new agent. Do **not** treat the 2026-09-01 receipt as approvals to clear stamps.

**Branch:** `codex/recover-m7-20260812`  
**Authority:** `docs/core/OPERATING-RULES.md`, `docs/core/PLAN.md`, `docs/core/DECISIONS.md`  
**Programme status:** `docs/codex-program/notes/PROGRAMME-N1-STATUS-2026-08-24.md`

---

## Paste this prompt to a new agent

```text
You are taking over Precedent Machine N1 Work3 legal-decision work from a failed prior attempt.

## Goal (what Ben actually needs)

Ben is a M&A lawyer. For each sealed family that still carries LEGAL_GROUPING_REVIEW_REQUIRED (or similar), he needs to decide the **comparison taxonomy**: how extracted lines should be grouped so precedent search compares like with like.

He does NOT want:
- programme jargon (M5, M7, Work3, stamps, profile keys, packet IDs)
- dump of hundreds of claim rows
- vague “approve the proposed split / one bucket” questions when the proposed split is fake or empty

He DOES want, for each family, a short brief in this shape only:
1. Buckets we already had — names only
2. Buckets you want to add — each with ONE example of the actual agreement words that drive that bucket, plus how many deals have it
3. A clear lawyer question about whether that cut is right (or how to revise it)

Critical: if the current inventory has only ONE populated bucket (e.g. Interim Operating = 113× RESTRICTIVE_COVENANT; Guaranty = 5× PERFORMANCE_GUARANTY; General Covenants = 54× TOPIC_CLASSIFICATION), do NOT ask him to “approve a split.” Either say “there is no real topic split yet” and propose a lawyer-sensible topic map first, or ask whether one bucket is enough.

Ben’s mental model for Interim Operating (example of what he expects): topic subtypes such as Indebtedness, M&A, issuing shares, etc., plus positive covenant and its subparts — not one dump called “Restrictive Covenant.”

Rules for talking to Ben: `.cursor/rules/ben-escalation-only-legal.mdc` and `.cursor/rules/plain-english-questions.mdc`. Only escalate true lawyer judgment. Decide technical/process yourself. Short messages; no phase jargon.

## What the prior agent tried (and why it failed)

1. Built an inventory of ~27 open legal decisions from sealed family packages / dispositions.
2. Built a Cursor canvas UI (`n1-legal-decisions.canvas.tsx`) for Ben to rule and emit a receipt JSON.
3. Split “blocking” vs “review-stamp” decisions; Ben wanted blocking answers in chat and the board for non-blocking only.
4. Iterated presentation: thin cards → jargon briefs → “plain English” → bucket_presentation with line maps → capped samples → V5 “buckets had / buckets to add with operative clause text.”
5. Pulled operative clause text from M4 evidence edges + M2 canonical_text (UTF-8 byte spans). That part is useful for examples.
6. Ben submitted an 8-ruling receipt on 2026-09-01 with notes showing he still did not understand the approach (see below). Prior agent correctly did NOT apply stamp clears.

Failure modes Ben hit:
- “Per share cash consideration” shown as if it were a bucket (it is a claim name under Cash Component).
- Cards dumped huge maps / empty sample clauses initially.
- Families with no real topic split still asked “approve the proposed subtype split.”
- Interim Operating never proposed Indebtedness / M&A / share issuance / positive covenant.
- General Covenants showed nonsense “Topic Classification”; Ben said they are Access.
- Guaranty: all the same — asking “split?” was wrong.
- No-shop: real multi-bucket map exists but question was opaque.
- Canvas “Send to chat” opens a NEW composer chat (API limitation) — use copy/paste into the intended thread.

## Programme facts (do not rediscover from scratch)

- Repo: precedent-machine, branch `codex/recover-m7-20260812`.
- 24/25 families have Milestone A packages on disk. CAPITALISATION (#25) blocked (0 comparator claims) — see `docs/codex-program/notes/CAPITALISATION-COMPARATOR-BLOCKAGE-2026-08-25.md`.
- Blocking legal decisions (separate from review-stamp UI) include: Metsera D&O linked duties; Termination Fee ↔ Specific Performance sole-remedy owner; buyer-side vs target-side fees; Closing Conditions orphan buckets; Metsera frustration branch. Some earlier blocking rulings are recorded in `N1-BEN-LEGAL-RULINGS-RECEIPT-2026-08-25.json` but mechanical sealed-disposition mutations were largely deferred.
- Review-stamp families still need a lawyer-usable taxonomy conversation — that is the main restart task.

## Key files (all under the repo; commit on this branch)

Inventory / board:
- `docs/codex-program/notes/N1-OPEN-LEGAL-DECISIONS-INVENTORY-2026-08-25.json`
- `docs/codex-program/notes/N1-OPEN-LEGAL-DECISIONS-RICH-PACKETS-2026-08-25.json`
- `docs/codex-program/notes/N1-OPEN-LEGAL-DECISIONS-BOARD-DATA-2026-08-25.json` (schema V5_SIMPLE_BUCKETS)
- `docs/codex-program/notes/N1-LEGAL-DECISIONS-BOARD-README-2026-08-25.md`
- `docs/codex-program/notes/N1-LEGAL-DECISIONS-AGENT-HANDOFF-2026-09-01.md` (this file)

Receipts:
- `docs/codex-program/notes/N1-BEN-LEGAL-RULINGS-RECEIPT-2026-08-25.json` (earlier blocking rulings; partial apply)
- `docs/codex-program/notes/N1-BEN-LEGAL-RULINGS-RECEIPT-2026-09-01.json` (8 review-stamp attempts; NOT applied)
- `docs/codex-program/notes/N1-BEN-LEGAL-RULINGS-RECEIPT-TEMPLATE-2026-08-25.json`

Builder:
- `scripts/codex-program/build-legal-board-bucket-presentation.js` (rebuilds bucket_presentation + syncs canvas)

Canvas (local Cursor path, not in git):
- `/Users/bengoodchild/.cursor/projects/Users-bengoodchild-precedent-machine-restored-20260812/canvases/n1-legal-decisions.canvas.tsx`

Programme:
- `docs/codex-program/notes/PROGRAMME-N1-STATUS-2026-08-24.md`
- `docs/codex-program/notes/N1-NEXT-FAMILY-2026-08-24.md`
- Per-family run plans / Work3 prep notes under `docs/codex-program/notes/*-2026-08-24.md`
- Evidence packages under `evidence/canonical-v2/stage-2y-structure-migration/control/m7-v2-repair-family-work3-profile-package-*.json`
- Review packets: `.../m7-v2-repair-*-profile-inventory-review-packet-draft.json`

## Ben’s 2026-09-01 notes (interpret; do not stamp-clear)

| decision_id | selected option | Ben note | Prior agent read |
|---|---|---|---|
| antitrust-regulatory-legal-grouping | approve-proposed-split | Generally agree but RedHat is just efforts; want efforts-cap bucket too | Directional; needs Efforts Cap + Red Hat placement |
| appraisal-dissenters-rights-legal-grouping | approve-proposed-split | One bucket | Contradicts split → one bucket |
| dividends-legal-grouping | approve-proposed-split | (empty) | Only clean approve |
| financing-covenants-legal-grouping | approve-proposed-split | Can’t see all referenced | Hold; re-confirm |
| general-covenants-item-44-access-scope | revise-split | these are all access | Re-bucket as Access |
| guaranty-legal-grouping | approve-proposed-split | these all seem the same? | Correct; bad question |
| interim-operating-legal-grouping | revise-split | confused; wants Indebtedness / M&A / shares; where is positive covenant? | Rebuild topic taxonomy |
| no-shop-legal-grouping | approve-proposed-split | don’t understand the question | Reframe with real buckets + clauses |

## Your workplan (restart correctly)

1. Read OPERATING-RULES + PROGRAMME-N1-STATUS + this handoff + the 2026-09-01 receipt.
2. Do NOT clear LEGAL_GROUPING stamps from the 2026-09-01 receipt except after Ben clearly re-confirms on a usable brief.
3. Redesign the Ben-facing artifact (canvas or markdown briefs — Ben’s preference; keep it short). For each family:
   - Inspect review packet / disposition: real populated buckets and claim keys.
   - If there is no lawyer-sensible topic split, draft one from deal language (Interim Operating is the test case) BEFORE asking Ben.
   - Present only: had names; add buckets with one real clause + deal count; one clear question.
4. For Interim Operating specifically: propose a topic taxonomy Ben sketched (Indebtedness; M&A; issuing shares; etc.; positive covenant + subparts) with annotated examples; get his ruling; then implement mechanical re-bucketing.
5. For No-shop: reframe as Restriction / Standstill / Recommendation change / Engagement permission / Safe disclosure / Representative control (or fewer if Ben prefers) with one clause each.
6. Antitrust: keep multi-bucket direction; add Efforts Cap; put Red Hat in Efforts where appropriate.
7. Appraisal: collapse to one bucket if Ben confirms.
8. General covenants: Access.
9. Guaranty: confirm one Performance Guaranty bucket is enough (or Ben’s alternative).
10. Financing: show Payoff / Obtain Financing / No Financing Condition with clauses; re-ask once.
11. Only then write/apply a new receipt and mechanical stamp clears. Never invent legal judgments.

## Mechanical traps in this repo

- Never pipe `npm test` into `tail`/`head`. Use `CI=true`.
- UTF-8 byte offsets for agreement slices, not JS string indices.
- A family returning zero claims can be correct.
- Sealed disposition/package files are often hash-pinned; tracking-file edits ≠ mutating sealed Work3 artefacts without a proper successor session.

Confirm with Ben in one short message that you have this handoff and will rebuild Interim Operating first as the template for all other review-stamp families.
```

---

## Ben’s open answers (from chat, not yet formal receipt)

Prior agent asked Ben:

1. Appraisal → one bucket? (Ben already wrote “One bucket” in receipt.)
2. Antitrust → Red Hat to Efforts + add Efforts Cap?
3. Interim → Positive vs Negative first, or topic-first?
4. No-shop → six-bucket cut vs fewer?

Ben had not answered those four follow-ups when this handoff was written; he asked for a restart prompt instead.

## Cloud save

Commit the N1 legal-decision notes + builder on `codex/recover-m7-20260812` and push to `origin`. Canvas file lives under `~/.cursor/projects/.../canvases/` and is not in git — regenerate via `node scripts/codex-program/build-legal-board-bucket-presentation.js` after board JSON updates.
