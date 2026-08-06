# Implementation spec: termination-trigger vocabulary amendment + QXO fixture

Ben approved the seven trigger codes and condition codes on 2026-07-23
(PROPOSAL-TERMF-TRIGGER-VOCABULARY-2026-07-23.md — read it first; its
design rule and code list are binding). Full review lane; staged only;
flags unchanged; no corpus writes from CI.

## STEP 0 — fingerprint determination (STOP condition)

Determine whether adding the new trigger_code / trigger_condition /
payment_timing values changes `compileFixtureContract().fingerprint`
(i.e., whether the vocabulary is bound into `FIXTURE_CONTRACT_INPUT` via
relationship effect schemas or anywhere else). Test empirically: make the
vocabulary addition, compile, compare against
`56da82bee06331793ba2ed8b78ef4186361407e60733595091e5951853e7d41d`.

- If the fingerprint is UNCHANGED: proceed with the full packet below.
- If it MOVES: STOP after Step 1's vocabulary analysis and report. A
  moved fingerprint breaks serving of the currently-ACTIVE staging
  release (server-compiled fingerprint vs rows built under the old one ⇒
  INVALID_RESPONSE on the live path verified today). That case needs a
  contract-versioning design decision (new candidate release under the
  new contract + Ben-gated activation), which is NOT authorized in this
  packet. Do not ship a serving-breaking change under any circumstances.

## Step 1 — vocabulary additions

New trigger_code values (exact strings, Ben-approved):
`INTERVENING_EVENT_RECOMMENDATION_CHANGE_TERMINATION`,
`NO_SOLICIT_BREACH_TERMINATION`,
`STOCKHOLDER_APPROVAL_FAILURE_TERMINATION`,
`COUNTERPARTY_COVENANT_BREACH_TERMINATION`, `OUTSIDE_DATE_TERMINATION`,
`ANTITRUST_FAILURE_TERMINATION`, `FINANCING_FAILURE_TERMINATION`.
New trigger_condition values: `COMPETING_PROPOSAL_PUBLICLY_PENDING`,
`NO_COMPETING_PROPOSAL_PENDING`, `STOCKHOLDER_APPROVAL_NOT_YET_OBTAINED`.
New payment_timing value (flag in the PR as an addition within the
amendment's scope): `UPON_EARLIER_OF_SIGNING_OR_CONSUMMATION`.
Existing codes are never renamed or removed. Locate every place the
vocabulary is enforced/enumerated (reviewed-termination-fee-slice.js
constants, any validator, VALUE_LABELS in query-result.js for display)
and extend consistently. Labels are plain legal English.

## Step 2 — QXO termination fixture (company fee only)

`__fixtures__/canonical-v2/qxo-termination-fee-row.js`, built with the
WP-EXP-01 harness (`lib/canonical-v2/reviewed-slice-harness.js`) — this
is the harness's first from-scratch consumer. Source text: fetch the
filed agreement (EDGAR accession 0001104659-26-045111, Ex 2.1,
https://www.sec.gov/Archives/edgar/data/1236275/000110465926045111/tm2612209d1_ex2-1.htm)
and quote §6.5(b) + the referenced §§6.2/6.4 grounds VERBATIM into the
reviewed source (same pattern as the QXO no-shop excerpts file). Deal
dimensions copied from `reviewed-qxo-no-shop-slice.js` (same deal).

Legal encoding (Fable-authored, binding — from the verified clause text,
NOT the legacy card, whose reconstruction cites nonexistent sections):

- Fee: Company Termination Fee $600,000,000; metric
  SELLER_TERMINATION_FEE_PERCENT_OF_DEAL_VALUE; party
  FEE_PAYER/COMPANY/TARGET; payee PARENT/BUYER.
- Immediate-pay triggers (payment_timing
  `TWO_BUSINESS_DAYS_AFTER_TERMINATION`):
  1. `CHANGE_IN_RECOMMENDATION_TERMINATION` (existing code; §6.5(b)(i)
     via §6.4(a)(i)(A) — adverse recommendation change);
  2. `NO_SOLICIT_BREACH_TERMINATION` (§6.5(b)(i) via §6.4(a)(ii) —
     material breach of §4.3).
- Tail triggers (each with conditions
  `COMPETING_PROPOSAL_PUBLICLY_PENDING` +
  `DEFINITIVE_AGREEMENT_OR_CONSUMMATION_WITHIN_TWELVE_MONTHS` +
  `FIFTY_PERCENT_ACQUISITION_THRESHOLD`, payment_timing
  `UPON_EARLIER_OF_SIGNING_OR_CONSUMMATION`):
  3. `STOCKHOLDER_APPROVAL_FAILURE_TERMINATION` (§6.5(b)(iii)(A)/(B) —
     also carries `STOCKHOLDER_APPROVAL_NOT_YET_OBTAINED` where the text
     requires it; note vote-failure is TAIL-ONLY in this deal);
  4. `NO_SOLICIT_BREACH_TERMINATION` via the general-breach gateway
     (§6.5(b)(iii)(C)(1)) — same ground code as #2, different pathway
     expressed by its conditions/timing, per the grounds-as-codes rule;
  5. `COUNTERPARTY_COVENANT_BREACH_TERMINATION` (§6.5(b)(iii)(C)(2));
  6. `INTERVENING_EVENT_RECOMMENDATION_CHANGE_TERMINATION`
     (§6.5(b)(iii)(D)).
- NOTHING for the fixture's unsourced 18-month row; no
  reverse/Parent-fee rows (separate later packet).

## Step 3 — staging script pair + tests

`scripts/canonical-v2-staging-qxo-termination-fee.mjs` modeled on the
existing qxo-* staging scripts (dry-run first, Ben-run). Candidate-seed
entry ONLY if the existing qxo-material-candidate-identity pattern
requires it — do not activate anything. Tests: vocabulary round-trip
through the real compiler; fixture replay via the harness; composition
tests proving every new code appears with its exact conditions/timing;
existing suites untouched and green.

## Battery + review gates

Post-commit full battery (expect fingerprint test outcome per Step 0);
Fable review checks: codes exactly as approved, fixture quotes verbatim
against the EDGAR text, no legacy-card artifacts (no 8.02 citations, no
18-month tail), tail-only vote-failure preserved, serving of the active
release provably unbroken (live retest).
