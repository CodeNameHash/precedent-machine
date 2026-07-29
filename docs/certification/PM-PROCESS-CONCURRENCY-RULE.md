# PM and Process concurrency rule

## Purpose

PM and Process Intelligence can work at the same time. Each work unit uses its
own branch and worktree.

## Authority for a work unit

A work unit starts from one verified tuple:

- exact main commit;
- exact protected publication commit;
- exact signed status ID;
- required work-class state;
- exact work-unit allowlist digest.

A later main change does not stop a work unit that already has this tuple. The
agent must not rebase the unit or start a new unit until the next status is
verified.

## PM integration queue

The PM agent owns one integration queue. A queued unit names an exact commit
range. The queue keeps the source commit order and the source author identity.

The PM agent opens one integration window. The agent:

1. Builds one integration branch from the verified main commit.
2. Integrates all ready PM and Process units where practical.
3. Validates each unit against its own allowlist.
4. Runs the declared unit tests and the full required test set.
5. Moves main once.
6. Deploys and verifies that exact main commit.
7. Revalidates all evidence for that commit.
8. Publishes one signed successor by compare-and-swap.
9. Runs `node scripts/verify-programme-status-publication.mjs`.

The window closes only when the verifier returns `PASS`. A publication failure
sets the window to `RECOVERY_REQUIRED`. No second main move is permitted. The
only permitted next action is an exact fix-forward publication, or an exact
revert followed by a new signed publication.

## Ben approval

The current signed contract binds Ben's approval to an exact specification root
and code commit. A routine successor cannot preserve `canonical_work_start`
without a new Ben signature.

For this contract version, the PM agent keeps main fixed while branch work
continues. The agent batches ready units until the next approval point that the
contract reserves for Ben. The protected successor workflow obtains the exact
signature and publishes the successor during that integration window.

Ben must approve a material contract freeze, production activation, cutover, or
material governance change. The controller must not treat an earlier approval
or an earlier `PASS` as evidence for a later commit.

## Protected publication

`.github/workflows/programme-gate-sign-successor.yml` is the successor
publisher. It requires:

- the exact current main commit;
- the exact current protected publication commit;
- the exact cold-review basis;
- fresh evidence for all supported gates;
- both protected signatures;
- the exact two-file publication tree;
- one compare-and-swap update.

The genesis nonce is not valid for a successor.
