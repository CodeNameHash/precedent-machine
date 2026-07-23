# Option A runbook — QXO termination candidate under F2 (Ben-run, iPad)

Owner-approved runbook adaptation of the programme's "Ben-run local" rule
(HANDOFF-SESSION-2026-07-23-EOD.md; recorded in
docs/certification/programme-gate-status.json). Everything below runs in the
**staging** Supabase SQL Editor, project `sjumbznveyyiizhwvixj`
(deal-corpus-canonical-v2-staging). Governing spec:
`docs/handoffs/SPEC-QXO-TERMF-F2-CANDIDATE-OPTION-A-2026-07-24.md`.

Nothing here touches production, and nothing here ACTIVATES anything —
the import is inactive; activation stays a separate Ben decision.

## Order of operations

1. **Step-1 widening (independent, do first or any time):** paste
   `step1-active-query-page-release-declared-fingerprint.sql`. It replaces
   `public.canonical_v2_active_query_page` with the release-declared-
   fingerprint body (idempotent, additive; F1 serving unaffected). The
   trailing SELECT must return three `true` values.
2. **F2 authority genesis:** paste `01-f2-authority-genesis-dry-run.sql`
   (must succeed, rolls back), then `01-f2-authority-genesis-apply.sql`.
   This seeds the deterministic empty generation-1 candidate-input head for
   the F2 contract (`614bb1f8…`) — the head chain is per-contract-
   fingerprint and F2 has none yet. It touches nothing else.
3. **Block 00:** paste `00-read-lineage.sql` (read-only). Copy the single
   JSON value it returns and paste it back to the Claude session.
4. **Claude session** runs
   `node scripts/canonical-v2-staging-qxo-termination-optionA.mjs <paste.json>`,
   which verifies every pinned identity, prints the digest attestation, and
   writes `sql/optionA/generated/01…07`. The attestation's digests get
   committed; compare what you see on screen against the committed values.
5. **generated/01-verify-before.sql** (read-only): all values must match —
   active pointer generation 8 / release `c9c19dc1…`, `f1_head_unmoved` and
   `f2_head_seeded` true, `new_release_absent` and
   `termination_write_absent` true.
6. **generated/02-termination-deal-scope-dry-run.sql**: the semantic write
   inside BEGIN…ROLLBACK. Must succeed; nothing persists.
7. **generated/03-termination-deal-scope-apply.sql**: same statement, COMMIT.
8. **generated/04-import-dry-run.sql**: F2 head recheck + the guarded import
   RPC inside BEGIN…ROLLBACK. If the head moved, the recheck aborts the
   transaction — stop and report back.
9. **generated/05-import-apply.sql**: same, COMMIT. Import is INACTIVE.
10. **generated/06-verify-after.sql** (read-only): every count must equal
    the expected values in the file's trailing comment; the active pointer
    must be UNCHANGED.
11. **generated/07-rollback-rehearsal.sql** is OPTIONAL and destructive to
    the inactive candidate only; re-run 04/05 to re-import afterwards.

If any step disagrees with its expectation, stop and paste the output back
to the session — do not improvise in the editor.
