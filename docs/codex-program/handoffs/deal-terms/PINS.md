# Pins for the Deal Terms producer channel

Verify each against the repository before relying on it.

## State of the producer (2026-09-05)

- Precedent Machine's V2 rule engine is being replaced. The registered
  candidate was proven only on synthetic text and cannot compile a real
  agreement. Record:
  `docs/codex-program/notes/WORK5-BLOCKED-CANDIDATE-NOT-EXECUTABLE-ON-REAL-TEXT-2026-09-03.md`.
- The re-plan, revision 2, adversarially reviewed, awaiting Ben's decisions:
  `docs/codex-program/notes/M7-V2-REPLAN-TO-PUBLICATION-2026-09-03.md` at
  commit `7b0df9b7` on `codex/recover-m7-20260812`. Its section 10 is the
  dependency graph to publication; nothing after node 4 has a date.
- Zero model calls in governed work. Ben's legal rulings are non-delegable.
- No released Deal Terms package exists. No package may present V1 rows as
  accepted Deal Terms: Ben's legal review found 31 of 50 sampled V1 items
  incorrect.
- Package contract draft 3 (`package_schema_version 1.2.0`) is at commit
  `32b7e8d9` on this branch, under `contract/`, with the corpus manifest
  input contract beside it. Later drafts are announced by an `A`.
- Public shared SEC-ingest component: npm package
  `@precedent-machine/shared-source-core` version `1.0.2`, released as the
  package-root Git commit
  `7f32174a36460e86ea60503c271f41a0a571f45b` on
  `release/shared-source-core-v1.0.2`. Install it with
  `npm install github:CodeNameHash/precedent-machine#7f32174a36460e86ea60503c271f41a0a571f45b`.
  This is the only Shared Source Core seam Deal Storylines should consume.
  It exports `registerTransaction`, `admitDealSources`, and
  `createSharedSourceCore`. Component version: `SHARED_SEC_INGEST/V1.0.2`.
  Component code digest:
  `2a6e4b681c4cd8a8a1d2379374ac4a743ee5150e92aad93adb5b01b6715c7bd6`.
  Canonicalisation profile: `SEC_HTML_CANONICAL_TEXT_CONVERSION/V2`, digest
  `c6b6a93315fad0bc3e65be699c71e2fea4d98111ba701f72f19dfb96dfb5c85a`,
  config digest
  `5aa439406823ac17104228b41fcbf9f4fccbbe92623261b66147c2c680331055`.
- Offline Metsera conformance fixture is inside the released package at
  `fixtures/metsera/conformance.json`, `fixtures/metsera/response.htm`, and
  `fixtures/metsera/source-map.deflate`.
  Expected identities from the recorded run: transaction ID
  `1cf52f329e480f8186f696e36c3f569ac4716c725bb3d45d830f03a9089d6d7a`,
  document identity `f783c4cdcaca4626c695d1c2c67924ccd8867eb066e16f17407ca64497ba778c`,
  raw hash `d0999e48278050a081e552d3e48d9bc3e0905ae9a6b74e59429d62b11206e4ac`,
  canonical hash `4ac7a2b193c291ca692fb1b5f082a245d02474c7db3136bfcebaf5bd7b686ca3`,
  source-map digest `9c915e8c5e6bad5d80acf6b570302964658f375270b6b70c8dbecb6367f92ebf`,
  compressed source-map digest
  `ab6a13e7f6a56f10935f68e2eb6b3b54b4091cbf3cdd7ae5a5076c90f06a85be`.
- Offline command for the installed shared core proof:
  `npm test --prefix node_modules/@precedent-machine/shared-source-core`
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
