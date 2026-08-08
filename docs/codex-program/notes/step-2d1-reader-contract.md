# Step 2D1 defect 5. The reader's reconstructed shape, closed by a contract test

**Scope.** `lib/canonical-v2/local-staging-deal-reader.js` and its tests.
Written incrementally as the investigation and fix landed.

## The defect, restated

Five independent discoveries in one Step 2D ladder run, all tracing to one
file: `CONSIDERATION`'s `party` never reconstructed (blocked rendering
outright), `REPRESENTATIONS`'s open-world fields missing the shape its
projection needs, `NO_OTHER_REPS_FRAUD` throwing `canonical JSON does not
support undefined`, `MAE_DEFINITION`'s MAE path unrenderable, and
`INTERIM_OPERATING`'s entire `ioc_restriction_components` collection never
surfaced. Step 2B3 had already fixed one instance of this shape class
(claims whose subject is a component); this is the same class, found again.

## Method

Per the brief: write a contract test comparing a committed run's
`resolution.json` to the same deal read back through
`readDealFromLocalCanonicalV2Staging`, field by field, through
`canonicalJson` — never `JSON.stringify`. Name every field that does not
match. Fix what the test finds; allowlist, with a reason, only what is
genuinely never going to round-trip.

Wrote `scripts/canonical-v2-reader-resolution-contract-check.js`. It is a
script, not a `tests/*.test.js` file, deliberately: it needs a live
container holding real committed data, and this codebase's own convention
(`scripts/canonical-v2-local-staging-read-proof.js` and siblings) keeps
live-DB proofs out of `npm test`'s glob so CI never depends on a database
that doesn't exist there. The hermetic regression coverage lives in
`tests/canonical-v2-local-staging-deal-reader.test.js`, extended with 7 new
tests (20 → 27) that prove the same logic against a fake client, so `npm
test`/CI still protects it.

### A false start worth recording

The first run of the contract-check script, against `pm-pg3` (the container
Step 2D used), reported every single resolved claim for all five families as
"not found in the read-back deal at all" — a 100% failure that looked like
either a catastrophic bug or, more likely, that another agent's concurrent
work on `pm-pg3` (defects 1/2, timeout + excerpt-identity-guard fixes) had
rewritten it since Step 2D's notes were captured, matching the ground
rule's warning that another agent may be writing there. Confirmed directly:
`pm-pg3`'s current `EXCHANGE_RATIO_VALUE` claim's `claim_revision_id` does
not match `modiv-consideration-fullpin-20260807-replay/resolution.json`'s,
and does not match *any* committed `resolution.json` in the repository
either — so this was not staleness in my fixture choice, it was a live
container whose state I should not treat as a stable comparison target.

Rather than fight a moving target, built a **fresh, throwaway container**
(`scripts/lib/canonical-v2-local-setup.sql` +
`supabase/canonical-v2-foundation.sql`, per the reproduction steps
`docs/codex-program/notes/step-4a-durable-write.md` already documents) and
wrote the five families' exact committed evidence directories into it with
`scripts/canonical-v2-local-durable-write.js` — the same path Step 2D used.
Two of the five write receipts (`NO_OTHER_REPS_FRAUD`:
`b3332c4d...5717baf`, `MAE_DEFINITION`: `bca1d999...4546f158`) reproduced
the *exact* receipt ids Step 2D's and Step 4A's own notes already cite,
confirming the writer is deterministic and this container now holds exactly
what the committed fixtures describe. Reproduction steps are in the
script's own header. Discarded afterward (`docker rm -f
pm-pg-reader-contract`) — genuinely throwaway, no shared state touched.

### A second false start, also worth recording

Even against this known-clean container, matching resolution.json's
resolved entries to the database by `claim.claim_revision_id` still failed
100% of the time. Root cause: **`resolution.json`'s
`claim.claim_revision_id` is not what gets written.**
`native-write-set-adapter.js`'s own header explains why
("WHY IDENTITY MUST BE RE-DERIVED, NOT JUST SHIFTED") — evidence gets
shifted from the producer's section-local coordinates to the document's
absolute ones, and the excerpt (then the evidence-edge id, then
`claim_revision_id`) is rebuilt from that shifted evidence, not merely
offset. This is correct, intentional, pre-existing pipeline behaviour, and
has nothing to do with this reader — but it means `claim_revision_id`
cannot be the join key between a `resolution.json` fixture and its written
row. `claim_occurrence_id` is: the same header documents it as **not**
re-derived (except for a component-subject rekey case that does not apply
to any of the five families' own claim kinds here), and checking it
directly against the whole corpus for all four families with any resolved
claims confirmed zero exceptions. Switched the match key; the contract
script's `CLAIM_SUBFIELD_WRITE_TIME_REDERIVED_GAPS` documents the three
claim subfields (`claim_revision_id`, `evidence`, `evidence_ids`) that
legitimately differ for this reason, kept separate from the reader's own
`RESOLVED_ENTRY_ALLOWLISTED_GAPS` because they are a different phenomenon
(a write-time property, not something this reader drops).

## What the test found, and what was fixed vs allowlisted

### Fixed

1. **`party`** (the `CONSIDERATION` instance). `readGovernedClaimsForDeal`
   never set it at all. Checked against the whole committed Modiv corpus
   (349 resolved entries, every family): `entry.party` is, without
   exception, byte-identical to `entry.provision_instance.party` — `null`
   for a partyless `STRUCTURAL_PROVISION_INSTANCE/V1`, the real
   `{role, value, capacity}` object for a party-bearing
   `PROVISION_INSTANCE/V1`. Fixed by reconstructing it from the provision
   instance (`Object.hasOwn`, not `?.`).
2. **`section_reference`** (the `MAE_DEFINITION` instance, and a correction
   to a prior claim). The module's own header previously said this field
   "does not round-trip, by construction" — checked against
   `CLAIM_REVISION_PAYLOAD_FIELDS`'s top-level key list, which is true, but
   incomplete: `attributes` **is** one of those fields, and for 218 of 263
   resolved entries in the committed corpus, `claim.attributes
   .section_reference` carries the identical value, with zero mismatches.
   This was the prior investigation testing a claim without testing whether
   the field was nested one level deeper — CLAUDE.md's "test a claim, don't
   record it as fact" failure, concretely. It is also *why*
   `MAE_DEFINITION` could never render:
   `key-terms-mae-product-projection.js`'s `validMaeBinding` requires
   `attributes.section_reference === entry.section_reference` verbatim, and
   every MAE claim kind's attribute schema requires `section_reference` to
   be present (`validateMaeAttributes`) — so an always-`null`
   `entry.section_reference` could never equal it. Fixed by reconstructing
   from `claim.attributes.section_reference` when present. Nine claim kinds
   genuinely never carry it in `attributes` at all (confirmed empty, not
   unchecked — see `CLAIM_DEFINITION_KEYS_WITHOUT_ATTRIBUTES_SECTION_REFERENCE`
   in the reader module); those correctly stay `null`.
3. **`ioc_restriction_components`** (the `INTERIM_OPERATING` instance).
   Added `readIocRestrictionComponentsForDeal`, exposed on
   `readDealFromLocalCanonicalV2Staging`'s return under the same field name
   `resolution.json` uses. Re-queries provisions + components (the same
   two-query shape `readGovernedClaimsForDeal`/`readRelationshipsForDeal`
   already each independently issue), filtered to `component_key ===
   'RESTRICTED_ACTION'` so a future component kind sharing the table (e.g.
   `REPRESENTATION_LIMB`) cannot leak in.
4. **Flat open-world entries** (the `REPRESENTATIONS` instance). Every
   `*-product-projection.js` module that reads open-world data at all
   (`representations-product-projection.js`'s and
   `key-terms-mae-product-projection.js`'s `open_world_entries` param,
   every `{resolution, deal_id}`-shaped module's `resolution.open_world`)
   wants `resolution.json`'s own flat `open_world[]` shape —
   `entry.attributes`, `entry.reason`, `entry.section_reference` at the top
   level — never the `{candidate, occurrence, evidenceReferences}` bundle
   shape `readOpenWorldEvidenceForDeal` already returns for
   `open-world-evidence-serving.js`. Added
   `readFlatOpenWorldEntriesForDeal` (no extra query — reshapes the same
   bundles) and exposed it as `open_world_entries`, additive alongside the
   existing `open_world`, so no existing caller's shape changes.

### Allowlisted, each with a reason, verified rather than assumed

`RESOLVED_ENTRY_ALLOWLISTED_GAPS` (exported from the reader module):
`party_source_span`, `citation_context`, `governing_context_quote`,
`generic_claim_key`, `compiled_candidate`, `triage`, top-level
`source_citation` — all confirmed absent from `CLAIM_REVISION_PAYLOAD_FIELDS`
and both provision-instance payload shapes, zero consumers outside the
native-producer pipeline itself. `OPEN_WORLD_ENTRY_ALLOWLISTED_GAPS`:
`source_citation`, `extraction_provenance`, `citation_validation`,
`answer_provenance`, `section_family_ai_unverified` — confirmed absent from
`buildOpenWorldWriteRows`'s `candidateBody`/`occurrenceBody`. Both lists are
exported constants, not comments, so the contract-check script (and any
future caller) reads them rather than re-deriving or re-typing them.

### Found, but not this reader's to fix

**`NO_OTHER_REPS_FRAUD` does not round-trip through the reader in any sense
that matters, because the module that would render it —
`no-other-reps-fraud-product-projection.js`'s
`projectNoOtherRepsFraudProduct` — reads `item.resolution_id`,
`claim.owner_family` and `item.evidence_only`. None of those three fields
exist anywhere in this family's own committed `resolution.json`, checked
directly against the whole corpus, every family, every run: zero
occurrences of `resolution_id` or `evidence_only` anywhere, and
`owner_family` only ever appears on the unrelated sole-remedy claims
(`SOLE_REMEDY_CARVEOUT_KIND`/`SOLE_REMEDY_LEGAL_EFFECT_PRESENT`, a different
resolver path). Traced the actual source: `tests/canonical-v2-no-other-reps-
fraud-dark-bridge.test.js` builds its fixture data through
`no-other-reps-fraud-resolution.js`'s `resolveNoOtherRepsFraudProposals` —
a separate, older, hand-rolled resolver, exercised only by that family's own
dark-bridge tests — not through `candidate-resolution.js`, the pipeline that
actually produces `resolution.json` and writes `canonical_v2_staging`. The
projection module was written against the old resolver's output shape and
was never updated when the family moved to the native-producer pipeline.
**No field this reader could add would satisfy that contract, because
`resolution.json` itself never carries it.** This is a projection-layer
contract mismatch — the same class of defect as Step 2D1's own defects 3
and 4 (a projection matching neither family it claims to cover; four
projections checking a schema version that no longer exists) — not a reader
round-trip gap, and outside `local-staging-deal-reader.js`'s file
boundary and this task's ownership. Reported to the contract-check script's
own output rather than silently worked around or quietly left unmentioned.

## Result

`node scripts/canonical-v2-reader-resolution-contract-check.js
'postgres://postgres:pm@localhost:55436/pm'` (fresh, known-matching
container — see above): **all five families' resolved claims round-trip
(2/2, 0/0, 3/3, 10/10, 10/10 — `REPRESENTATIONS` correctly has zero
governed claims, open-world only), all open-world entries round-trip
(20/20, 18/18, 4/4, 46/46 across the four families that have any), all 10
`INTERIM_OPERATING` `ioc_restriction_components` round-trip byte-identical,
zero unexpected mismatches anywhere.** `CONSIDERATION` renders through the
real `projectConsiderationWaveAClaims` (2 → 2 records). `MAE_DEFINITION`
renders through the real `projectKeyTermsMaeClaims` (10 → 8 MAE records —
2 fewer is the disproportionality-rollup's own ambiguous-relationship
quarantine, unrelated to this fix). `INTERIM_OPERATING` renders through the
real `projectIocWaveAClaims` (10 → 10 records). Exit code 0.

Hermetic regression: `node --test
tests/canonical-v2-local-staging-deal-reader.test.js` — 27/27 pass (20
pre-existing + 7 new), exit code 0. Also re-ran, unmodified, to prove no
regression: `tests/canonical-v2-staging-deal-reader-hosted-interface.test.js`
(14/14), the six termination-fee-serving test files that depend on this
reader (148/148), and the two open-world-serving-boundary/SQL-drift test
files (17/17) — all exit 0.

`bash scripts/lint/forbidden-patterns.sh` — `INVARIANT-4: PASS`, exit 0.

## Files touched

- `lib/canonical-v2/local-staging-deal-reader.js` — the fix. Header
  rewritten to describe the checked gap list instead of asserting one
  field "does not round-trip, by construction"; `party` and
  `section_reference` reconstruction; `readIocRestrictionComponentsForDeal`
  and `readFlatOpenWorldEntriesForDeal` added; both exposed on
  `readDealFromLocalCanonicalV2Staging`'s return; `RESOLVED_ENTRY_
  ALLOWLISTED_GAPS`, `OPEN_WORLD_ENTRY_ALLOWLISTED_GAPS` and
  `CLAIM_DEFINITION_KEYS_WITHOUT_ATTRIBUTES_SECTION_REFERENCE` exported.
- `tests/canonical-v2-local-staging-deal-reader.test.js` — 7 new hermetic
  tests; one existing test's comment corrected to describe the conditional
  (not blanket) `section_reference` gap.
- `scripts/canonical-v2-reader-resolution-contract-check.js` — new, the
  contract test itself. Not part of `npm test`'s glob (needs a live
  container); run manually per its own header.
