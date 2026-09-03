id: A-0004
from: lead
to: ext
date: 2026-09-03
re: ext/m7-w7-verifier (answers Q-0003, PR #485 @ e43aaa94)
status: ANSWERED

# CHANGES (small; one more round)

All six round-1 items were verified closed by reproduction, and the verifier
now passes on the real successor tree: `--manifest <manifest of record>`
gives `PASS`, exit 0, about 20 s, candidate `9a3ccbf7…`, V2 receipt path, a
seven-hop chain, byte-identical output across two runs. No-argument gives
`SELECTION_REQUIRED`, exit 1. Test file 11/11 in about 3 s. Imports are only
`node:*` and `canonical-bytes.js`. Git seam allowlist and env scrubbing
verified (a `GIT_DIR`/`GIT_WORK_TREE`/`GIT_CONFIG_COUNT` environment that
broke round 1 now passes); `ls-tree -z` verified with a non-ASCII path with
a space.

Four items remain, none large:

1. **MAJOR. `superseded_registrations` claims a relation it does not
   establish** (`verify.mjs` around `:822`, `:855`, `:995`). It is "the
   other files in the directory". Run with `--manifest
   control/m7-v2-repair-work4-execution-manifest.json` (the superseded
   manifest) and it labels the successor `9a3ccbf7…` as superseded. Either
   rename the field to `other_registrations`, or derive "superseded"
   properly: from the selected V2 receipt's `superseded_work4_receipt_binding`,
   read the V1 receipt it names and take that receipt's
   `candidate_registration_id`. Deciding whether a manifest is the manifest
   of record stays the manifest validator's job; the verifier just must not
   assert what it has not derived.

2. **MAJOR. Manifest identity is never recomputed** (`:777-800`). A manifest
   with garbage `execution_manifest_id` and `execution_manifest_digest`
   still yields `PASS`. Recompute both with the validator's rule
   (`restampedIdentity` in
   `scripts/stage-2y-structure-m7-v2-repair-execution-manifest-validate.mjs`:
   digest is SHA-256 of the canonical JSON without the two identity fields,
   id is `contentId(schema_version, record-with-digest)`), fail on mismatch,
   and report `manifest_id` and `manifest_sha256` in the result.

3. **MINOR. The V2 receipt's `superseded_work4_receipt_binding` is not
   verified.** A bogus binding still passes. Read the bound path, check
   bytes/SHA-256/blob OID against the binding, and check that record's
   `candidate_registration_id` differs from the selected one. This also
   gives you item 1's derivation for free.

4. **MINOR.** Dead `options.registrationId` at `:831`. The Work 0 evidence
   root oracle stays unused; carry it forward as a noted limitation in the
   header, no action now.

Runtime of about 20 s per CLI run is acceptable.

Deliver as a new commit on the same branch and a `Q-0004`. On ACCEPT I
integrate by cherry-pick onto the recovery branch with the allowlist and
phase-1 inventory entries; you do not need to touch those.
