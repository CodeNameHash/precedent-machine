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
- Shared SEC-ingest core: `lib/canonical-v2/sec-source-admission.js`.
  Version `VERIFIED_SEC_SOURCE_ADMISSION_BUNDLE/V1`, code digest
  `062380b11b077d3eec4a32a004281e705d1346e12f8ed7aa3cdeef58f96c6070`.
  This is the pinned producer-owned seam Deal Storylines should consume.
  Its approved-host fetch layer is
  `lib/canonical-v2/sec-edgar-intake-capture.js`
  (`SEC_EDGAR_INTAKE_CAPTURE/V1`, digest
  `c571f0c82f20b31d95546b56423d98ba968976f7bb37f4eea9cc8722b12f3956`).
  Its canonicalisation profile is
  `lib/canonical-v2/sec-html-canonical-text.js`
  (`SEC_HTML_CANONICAL_TEXT_CONVERSION/V2`, digest
  `c6b6a93315fad0bc3e65be699c71e2fea4d98111ba701f72f19dfb96dfb5c85a`).
- Public consumer seam: `docs/codex-program/handoffs/deal-terms/contract/verify.mjs`
  and the contract files beside it under `docs/codex-program/handoffs/deal-terms/contract/`.
  In that contract, `registerTransaction(...)` is the consumer-minted
  `deal_id` derivation in `CORPUS-MANIFEST-INPUT-CONTRACT.md` and
  `deal-terms-package.schema.json`; `admitDealSources(...)` is the
  `admissionEntry` / `admissionReceipt` route in `corpus-manifest.schema.json`.
  DS should use the public contract and verifier, not PM internals.
- Offline Metsera conformance fixture:
  `evidence/canonical-v2/metsera-antitrust-regulatory-20260809-2xk-final/source-reference.json`
  plus `tests/fixtures/canonical-v2/metsera-first-live-run/metsera-raw-fetched.htm`.
  Expected identities from the recorded run: transaction ID
  `1cf52f329e480f8186f696e36c3f569ac4716c725bb3d45d830f03a9089d6d7a`,
  document identity `f783c4cdcaca4626c695d1c2c67924ccd8867eb066e16f17407ca64497ba778c`,
  raw hash `d0999e48278050a081e552d3e48d9bc3e0905ae9a6b74e59429d62b11206e4ac`,
  canonical hash `4ac7a2b193c291ca692fb1b5f082a245d02474c7db3136bfcebaf5bd7b686ca3`,
  source-map digest `9c915e8c5e6bad5d80acf6b570302964658f375270b6b70c8dbecb6367f92ebf`,
  compressed source-map digest
  `ab6a13e7f6a56f10935f68e2eb6b3b54b4091cbf3cdd7ae5a5076c90f06a85be`.
- Offline command for the shared core proof:
  `node --test tests/canonical-v2-sec-edgar-intake-capture.test.js tests/canonical-v2-sec-source-admission.test.js`
- Offline command for package verification:
  `node docs/codex-program/handoffs/deal-terms/contract/verify.mjs docs/codex-program/handoffs/deal-terms/contract/example-one-deal-package`
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
