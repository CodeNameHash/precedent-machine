# Spec: QXO termination candidate under F2 + Option A import artifacts

Session 2026-07-24 (continuation of HANDOFF-SESSION-2026-07-23-EOD.md).
Fable-authored, binding. Supersedes the prior producer's admission-gap
note (see Finding 1). Governing programme: docs/CODEX-PROGRAM.md.

## Findings (all verified empirically this session, offline)

1. **No new source admission is needed.** The handoff's step-3 note ("no
   admitted termination-fee source exists in staging") is superseded. The
   admitted agreement source `f31cad8c…` is TopBuild's filing of the SAME
   merger agreement — `https://www.sec.gov/Archives/edgar/data/1633931/
   000110465926045245/bld-20260418xex2d1.htm` (958,459 bytes, sha256
   `abba0430…`, byte-fetched and hash-verified this session). Its
   canonical text (byte length 414,782 — matches the pinned
   `AGREEMENT_CANONICAL_TEXT_BYTE_LENGTH`) contains §§6.2, 6.4 and 6.5(b)
   in full. The spec-referenced QXO-accession Ex 2.1
   (`tm2612209d1_ex2-1.htm`, 732,686 bytes) is a DIFFERENT byte-stream of
   the same agreement and stays unused. The admitted deal-value source
   `8f34cf68…` (`bld-20260418xex99d1.htm`, sha256 `343ba5da…`) supplies
   the $17bn denominator, exactly as the material slice already does.
2. **Offline reconstruction is byte-exact.** Local conversion of the
   fetched bytes reproduces the pinned live intervals:
   `CONTRACTS_INTERVAL` sha `247c2a87…` and `DEAL_VALUE_INTERVAL` sha
   `baa64b18…` both match `lib/canonical-v2/qxo-material-contracts-slice.js`.
3. **Semantic identities are contract-version-independent.** With
   `deal_admission_id` held fixed, `buildQxoAdmittedNoShopNoticeSlice`
   produces IDENTICAL write-sets and `reviewed_mapping_id` under
   `compileFixtureContract()` (F1) and `compileFixtureContractV2()` (F2).
   Therefore the staged F1 semantic graphs (five closures) remain the
   valid backing of an F2 candidate; nothing is re-staged.
4. **Identity derivations are timestamp-independent** (spans/excerpts
   hash canonical_text_id + offsets + text), so every release identity is
   computable offline now. Only the full serving payloads (exact-detail
   source contexts) embed the staging-only `immutable_source_document_id`
   / `semantic_extraction_input_envelope_id` / intake receipt lineage,
   which is why Option A needs ONE read round-trip (Block 00 below).

## Rulings (Fable, binding for this packet)

- **R1 — Release composition.** The F2 candidate is the material combined
  release plus one new member: same five families rebuilt under the V2
  bundle (F2 rows, same `deal_admission_id` `62b8b828…`, same closure
  ids), plus the termination-fee member. Minimal diff from the
  live-verified F1 material release: fingerprint F2 + one row + one
  market observation + detail packages.
- **R2 — Deal admission unchanged.** `62b8b828…` everywhere. Minting an
  F2 deal admission would rewrite the shared `deals` row and orphan the
  staged graphs. The row-level contract binding lives in
  `provenance.contract_fingerprint` (F2), which serving validates via the
  release-declared fingerprint (PR #333).
- **R3 — Termination slice shape.** New module
  `lib/canonical-v2/qxo-termination-fee-admitted-slice.js`, modeled on
  `qxo-material-contracts-slice.js` (the two-source admitted precedent):
  agreement source ordinal 0, deal-value source ordinal 1. Unlike
  material it produces a COMPLETE/COMPARABLE canonical result with a
  market observation (not an incomplete-review exclusion): metric
  `SELLER_TERMINATION_FEE_PERCENT_OF_DEAL_VALUE`, value 600000000/17000000000
  = 3.52941176 %, six TRIGGERED_BY relationships whose typed effects are
  BYTE-IDENTICAL to `__fixtures__/canonical-v2/qxo-termination-fee-row.js`
  (the Ben-reviewed binding legal encoding): codes, conditions, timings,
  terminating parties, concept keys (TERMR-RECOMMEND, TERMR-NOSOL-BREACH
  ×2 pathways, TERMR-NOVOTE, TERMR-BREACH; fee TERMF-TARGET), parties
  (FEE_PAYER/COMPANY/TARGET; TERMINATION_RIGHT_HOLDER/PARENT/BUYER for
  immediate; FEE_TRIGGER_BENEFICIARY/PARENT/BUYER for tail). Vote-failure
  is tail-only. No Parent/reverse fee (separate packet; §6.5(c) exists in
  the admitted text and is deliberately untouched). No 18-month tail, no
  §8.02 citations.
- **R4 — Excerpts quote the ADMITTED canonical text verbatim**, including
  its typographic apostrophes/quotes, U+200E marks, and the mid-sentence
  page-break artifact inside the §6.5(b) payment span (precedent: the
  material Contracts excerpt embeds the page-32 artifact). The reviewed
  excerpts file remains the fixture's source; the admitted slice pins the
  admitted-text intervals in the span table below.
- **R5 — Deal dimensions.** The termination serving row carries the
  reviewed fixture's rich dimensions (sector 'Building products', buyer
  'QXO', merger_form 'Reverse triangular merger', adviser_firms
  ['Paul Weiss','Jones Day'], lawyers ['Scott Barshay','Robert Profusek'],
  announce_year 2026, deal_value_usd '17000000000') so the Canonical
  Query UI refinements are real on the metric they were built for.
  Sibling QXO rows keep their existing sparse dimensions — flagged to Ben
  as a known inconsistency, resolvable in a later dimension-backfill
  packet.
- **R6 — Import is INACTIVE only**; activation remains Ben's serialisable
  release-state decision. The apply SQL performs the candidate-input-head
  recheck (`canonical_v2_recheck_candidate_input_head`) IN the import
  transaction against the pinned generation-1 head
  (`47e58bdc…`/`6235cfd8…`, docs/certification/evidence/
  P1-VERTICAL-SLICE-ATTESTATION.json), so any drift aborts the paste.
- **R8 — Exact detail is claim-evidence, not composition.** The full
  six-relationship composition response measures 25,687 bytes (21,882
  after evidence reduction) against the frozen 16,384-byte
  RESULT_COMPOSITION_EVIDENCE bound, and the bound lives inside the
  frozen contract (changing it moves the fingerprint to F3 — not
  authorized). The row therefore ships the claim's operative evidence
  (the $600,000,000 quote) through the frozen
  RESULT_COMPONENT_CLAIM_EVIDENCE action — the same surface the live
  Landos termination-fee row serves — via a new
  `buildAdmittedClaimEvidenceDetailPackage` in
  `admitted-composition-exact-detail.js` (admitted counterpart of the
  reviewed builder; same action, same response schema, admitted lineage)
  plus an additive dispatch branch in `validateFixtureExactDetailPackage`.
  The row's canonical_result still carries all six typed trigger effects;
  relationship evidence keeps the fixture's two-edge shape. A future
  contract version can widen the composition bound if Ben wants the full
  trigger composition in the detail drawer.
- **R9 — Identity pinning is two-phase.** Provision identities embed the
  source occurrence id, which derives from the intake receipt's
  `retrieved_at` (staging-only). The termination reviewed_mapping_id,
  row key, closure id and F2 corpus_release_id therefore become final
  only when the Block 00 paste-back arrives; the generator computes,
  verifies and prints them, and the follow-up session commits the pins.
- **R7 — Routing.** Deviation from the handoff's "producer-built" lane:
  the slice module is canonical-provision encoding, which CLAUDE.md
  routes Fable-end-to-end; a producer-grade spec here would equal the
  implementation. Logged for Ben.

## Span table (byte intervals into the admitted agreement canonical text,
canonical_text_id `bcc60682…`, verified sha256 per span this session)

| key | interval | sha256 | anchoring |
|---|---|---|---|
| fee_payment | 374493–375864 | `b4d051ee…` | unique ("then, in the case of each of (i), (ii) and (iii), the Company shall pay Parent…" → "…more than one occasion."); contains the page-99 artifact |
| fee_amount | 375239–375251 | `de628357…` | anchored in unique "“Company Termination Fee” shall mean a cash amount equal to $600,000,000" (the $600,000,000 literal also appears in §6.5(c)) |
| vote_failure | 365777–365985 | `34f5aa8a…` | unique (§6.2(c)) |
| rec_change | 368471–368544 | `c96a2f4d…` | unique (§6.4(a)(i)(A)) |
| nosolicit_immediate | 368644–369057 | `bcf6faba…` | unique (§6.4(a)(ii); contains "Section ‎‎4.3" with two U+200E) |
| nosolicit_tail | 372668–372884 | `2e443d44…` | unique (§6.5(b)(iii)(C)(1) prefix "by Parent pursuant to the provisions of Section ‎6.4(b)…" — the (x)-gloss repetition lacks this prefix) |
| covenant_breach | 372892–372953 | `9d316e4b…` | anchored in unique "or (2) a breach of any other covenant or agreement of this Agreement or (D) by Parent pursuant to the provisions of Section ‎6.4(a)(i)(B)" |
| intervening_tail | 372957–373104 | `8b4b1d5e…` | unique (§6.5(b)(iii)(D)) |
| deal_value | 533–653 (deal-value source `d7c3caff…`) | `baa64b18…` | reuse of the material slice's pinned interval/text |

## Candidate seed (new identity)

`QXO_TERMINATION_COMBINED_CANDIDATE_SEED/V1` in
`lib/canonical-v2/qxo-material-candidate-identity.js` (additive):
governed_deal_key, deal_admission_id `62b8b828…`, contract_fingerprint F2
`46553f1a…`, source_admission_manifest_ids [`f31cad8c…`, `8f34cf68…`],
prior_semantic_closure_ids = the four existing + material closure
`a08b15c0…` (five, sorted), material_reviewed_mapping_id `df48098d…`,
termination_reviewed_mapping_id (pinned once computed),
serving_projection_version V2, query_projection_contract_digest
`048394ed…`, release_purpose 'INCOMPLETE_CANONICAL_RESULT_CANDIDATE_ONLY'
(unchanged wording: the release still carries the material incomplete
row; the termination observation joins the market partition).

## Option A protocol (Ben, staging SQL Editor, project sjumbznveyyiizhwvixj)

1. **Block 00 (read-only, committed now):** returns (a) the two intake
   captures' canonical_payloads MINUS `response_bytes_base64`, (b) the
   conversion rows MINUS `canonical_text`/`source_map_payload_base64`,
   (c) admission manifests, envelopes, immutable-source rows, (d) current
   candidate-input head + active pointer + absence check for the new
   corpus_release_id. Ben pastes the JSON output back to the next
   session.
2. **Generator (committed this session):**
   `scripts/canonical-v2-staging-qxo-termination-optionA.mjs` consumes
   the pasted JSON, re-fetch-verifies SEC bytes (hash pins), splices the
   locally recomputed text/source-map into the conversion payloads,
   verifies every contentId chain against the pinned identities
   (fabrication-proof: any mismatch aborts), rebuilds all six family
   slices under V2, builds the release + import plan, and emits the
   ordered paste files: 01-verify-before, 02-import-dry-run (rolled
   back), 03-import-apply (recheck + guarded RPC, COMMIT), 04-verify-
   after, 05-rollback-rehearsal, each ≤ SQL-Editor-friendly size, plus a
   printed digest attestation for comparison against the committed pins.
3. **Step-1 widening:** `sql/optionA/step1-active-query-page-release-
   declared-fingerprint.sql` — the `canonical_v2_active_query_page`
   function body extracted verbatim from `supabase/canonical-v2-serving.sql`
   (digest `a50721d5…` enforced by the extractor), BEGIN/COMMIT-wrapped
   with post-apply verification SELECTs. Idempotent; F1 serving
   unaffected.
4. Activation: NOT in this packet.

## Mechanical gates

Slice pin test (all span shas + mapping/closure/release ids), vocabulary
round-trip already merged, full `npm test` + `npm run build`, Fable
adversarial review before Ben sees the runbook.
