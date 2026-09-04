# Pins for the Deal Terms producer channel

Verify each against the repository before relying on it.

## State of the producer (2026-09-03)

- Precedent Machine's V2 rule engine is being replaced. The registered
  candidate was proven only on synthetic text and cannot compile a real
  agreement. Record:
  `docs/codex-program/notes/WORK5-BLOCKED-CANDIDATE-NOT-EXECUTABLE-ON-REAL-TEXT-2026-09-03.md`.
- The re-plan, revision 2, adversarially reviewed, awaiting Ben's decisions:
  `docs/codex-program/notes/M7-V2-REPLAN-TO-PUBLICATION-2026-09-03.md` at
  commit `7b0df9b7` on `codex/recover-m7-20260812`. Its section 10 is the
  dependency graph to publication; nothing after node 4 has a date.
- Zero model calls in governed work. Ben's legal rulings are non-delegable.
- No released package exists. No package may present V1 rows as accepted
  Deal Terms: Ben's legal review found 31 of 50 sampled V1 items incorrect.
- Package contract draft 3 (`package_schema_version 1.2.0`) is at commit
  `32b7e8d9` on this branch, under `contract/`, with the corpus manifest
  input contract beside it. Later drafts are announced by an `A`.
- The 40-agreement corpus is a target, not a cohort (PLAN Product Stage 6
  step 1). The only fixed producer set is ten agreements = ten unique
  transactions (A-0007); their selection input is A-0008.

## Identities that already exist and will not change

- Agreement identity inside Precedent Machine: a 64-hex `agreement_id`
  (canonical-text content ID). Ten agreements are bound by the sealed sets
  `evidence/canonical-v2/stage-2y-structure-migration/control/m7-v2-repair-work3-agreement-{analysis,index}-set.json`.
- Occurrence identity: M4 `claim_occurrence_id` (64-hex) and M2
  `node_occurrence_id` (64-hex), with UTF-8 half-open byte spans over the
  canonical text and SHA-256 of the span text.
- Revision identity: content-addressed record IDs (`contentId(schema,
  record)`), so a changed answer is a new ID and the old one stays.
- SEC identity (CIK, accession number, document role) is carried in the
  admitted-source receipts under `evidence/canonical-v2/`; the package
  contract will expose it, not the internal paths.

## Vocabulary collision

"Fixed 50" inside Precedent Machine means 50 lawyer-review items across
nine agreements, bound by a sealed identity manifest. It never means a
50-deal corpus. In this channel, the DS corpus is the **shared 50-deal
proof corpus**, and the current certification corpus is the **40-agreement
corpus** (Product Stage 6 of `docs/core/PLAN.md`).
