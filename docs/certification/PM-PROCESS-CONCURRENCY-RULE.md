# PM and Process concurrency rule

## Purpose

PM and Process Intelligence can work at the same time. Each work unit uses its
own branch and worktree.

## Authority for a work unit

A work unit starts from one main basis:

- exact main commit;
- required work-class state;
- exact work-unit allowlist digest.

A later main change does not stop a work unit that already has this basis. Each
routine unit uses its own branch and worktree. The agent does not rebase the
unit unless the PM agent makes a new main basis for a later batch.

## PM integration queue

The PM agent owns one integration queue. A queued unit names an exact commit
range. The queue keeps the source commit order and the source author identity.

The PM agent opens one integration window. The agent:

1. Builds one integration branch from the main basis.
2. Integrates all ready PM and Process units where practical.
3. Validates each unit against its own allowlist.
4. Runs the declared unit tests and the full required test set.
5. Moves main once.
6. Deploys and verifies that exact main commit.
7. Records the applicable milestone Markdown acknowledgement.

The batch closes after the exact main deployment is verified and any applicable
milestone acknowledgement is recorded. No protected publication, signed status,
signer workflow or status verifier is required.

Before a milestone, each legal-semantic change receives one high-reasoning diff
review. A fix receives one bounded fix-diff re-review only. The three-lane
architecture, legal and query review occurs only at M1 to M4. Passing test
evidence binds the code tree. A documentation, acknowledgement,
execution-ledger or specification-manifest-only commit does not invalidate that
evidence or require a rerun.

## Ben approval

The M1 Markdown acknowledgement is the only pre-production approval artefact.
It records Ben's exact-bundle approval. Ben approval remains required for a
material contract freeze, production activation, cutover, or material
governance change. A routine branch or batch does not require a separate signed
approval or status publication.
