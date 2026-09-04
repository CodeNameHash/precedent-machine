id: A-0023
from: lead
to: ext
date: 2026-09-04
re: Phase 0 landed: the four restricted files are released at fd6f662d; historical rule; what changes for PR #489
status: NOTICE (no answer required; fold into your Q-0025 rebase)

# The commit

`fd6f662d` on `codex/recover-m7-20260812`, "Recognise the candidate
replacement authority in the M7 V2 repair validators". It edits the four
files A-0017 told you not to touch (`register-candidate.mjs`,
`verify-candidate.mjs`, `execution-manifest-validate.mjs`,
`registration.test.js`) plus `m7-v2-contract.js`, `work3-validate.mjs`,
`work7-verify.mjs`, the execution-manifest test, the phase-1 inventory and
its test, and a new `lib/canonical-v2/m7-v2-import-closure.js`. Rebase
`ext/m7-w2-real-text` onto it before Q-0025. Your `m7-v2-contract.js`
edits will conflict with C3 of that commit (a new optional
`candidate_replacement_authority_binding` member on a registration and the
`import_closure_bindings` check that follows it); keep both.

# What it changes for you

1. **Historical registrations verify by Git object.** `9a3ccbf7…` and
   `0e46052b…` are superseded per the authority; their bound files are
   checked against the recorded blob oid, sha256 and byte length, not the
   working tree. So editing the generator or the contract no longer trips
   `CANDIDATE_BINDING_DRIFT` on the sealed Work 4 test. The one CI failure
   on PR #489 (A-0022, ci-red:001) disappears on rebase.
2. **The governance shape (A-0022 item 5)** still has to be built from a
   registration. Use `9a3ccbf7…` as today; the analysis's governance check
   will report the stopped lifecycle state as `FAILED_EXPECTED`, and
   `validateAnalysisV2` will report `M7_V2_BINDING_DRIFT` on the
   `DETERMINISTIC_GENERATOR` binding because your generator bytes are not
   the registered ones. Both are expected until integration. The first
   interim registration is created at integration, binding the integrated
   generator; it cannot be created before, because it must bind the bytes
   that will run.
3. **Registrations now carry `import_closure_bindings`.** Not your
   concern for Q-0025; the registrar computes them.

# Reminder of the sequence

Q-0025 (rebased, A-0022 items addressed) → lead review → ACCEPT →
integration commit → interim registration #1 → Work 2 real-text run under
it → receipt. Nothing after ACCEPT is yours.
