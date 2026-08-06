# Option A runbook — QXO termination candidate under F2 (Ben-run, iPad)

Owner-approved runbook adaptation of the programme's "Ben-run local" rule
(HANDOFF-SESSION-2026-07-23-EOD.md; recorded in
docs/certification/programme-gate-status.json). Everything below runs in the
**staging** Supabase SQL Editor, project `sjumbznveyyiizhwvixj`
(deal-corpus-canonical-v2-staging). Governing spec:
`docs/archive/handoffs/SPEC-QXO-TERMF-F2-CANDIDATE-OPTION-A-2026-07-24.md`.

Nothing here touches production, and nothing here ACTIVATES anything —
the import is inactive; activation stays a separate Ben decision.

## Order of operations

1. **Step-0 authority partition (required first):** paste
   `step0a-candidate-input-heads-by-contract.sql`, then `step0b` through
   `step0d`, then `step0e-verify-authority-partition.sql`. These blocks
   change the staging authority pointer from one global current head to one
   current head per frozen contract, replace the writer/import/activation
   functions with deterministic extracts of the governed SQL, and abort
   unless the F1 head and all contract predicates remain exact.
2. **Step-1 widening:** paste
   `step1-active-query-page-release-declared-fingerprint.sql`. It replaces
   `public.canonical_v2_active_query_page` with the release-declared-
   fingerprint body (idempotent, additive; F1 serving unaffected). It aborts
   before commit unless the replacement contains the governed predicates.
3. **F2 authority genesis:** paste `01-f2-authority-genesis-dry-run.sql`
   (must succeed, rolls back), then `01-f2-authority-genesis-apply.sql`.
   This seeds the deterministic empty generation-1 candidate-input head for
   the F2 contract (`614bb1f8…`) — the head chain is per-contract-
   fingerprint and F2 has none yet. It touches nothing else.
4. **Block 00:** paste `00-read-lineage.sql` (read-only). Copy the single
   JSON value it returns and paste it back to the Claude session.
   `00b-read-admission-payloads.sql` is a read-only diagnostic fallback only
   if the generator reports an admission-chain identity mismatch.
5. **Claude session** runs
   `node scripts/canonical-v2-staging-qxo-termination-optionA.mjs <paste.json>`,
   which verifies every pinned identity, prints the digest attestation, and
   writes `sql/optionA/generated/01…07` plus `ATTESTATION.json`. Generation
   aborts unless every final identity equals the committed attestation.
6. **generated/01-verify-before.sql** (read-only): it aborts unless the
   complete active pointer, both authority heads, prior semantic closures and
   absence preconditions match exactly.
7. **generated/02-termination-deal-scope-dry-run.sql**: the semantic write
   and exact receipt/closure assertions inside BEGIN…ROLLBACK.
8. **generated/03-termination-deal-scope-apply.sql**: same statement, COMMIT.
9. **generated/04-import-dry-run.sql**: requires the exact committed semantic
   receipt, rechecks the F2 head, then runs the guarded import inside
   BEGIN…ROLLBACK.
10. **generated/05-import-apply.sql**: same, COMMIT. Import is INACTIVE.
11. **generated/06-verify-after.sql** (read-only): it aborts unless every
    certified count is exact and the complete active pointer is unchanged.
12. **generated/07-rollback-rehearsal.sql** is OPTIONAL and destructive to
    the inactive candidate only; re-run 04/05 to re-import afterwards.

If any step disagrees with its expectation, stop and paste the output back
to the session — do not improvise in the editor.
