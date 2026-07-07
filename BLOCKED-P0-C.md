# BLOCKED-P0-C

Date: 2026-07-07

## What was attempted

After Phase 0-B-tail landed on `main`, rebased `phase-0-C/audit-and-reconcile` onto current `origin/main` and checked the Phase 0-C prerequisites in `pm-master-straitjacket.codex.md`.

Confirmed present:

- `docs/schema-shape/canonical-registry-v1.md`
- `docs/schema-shape/normalized-v1.json`

## What failed

Phase 0-C cannot start because required Phase 0-B / reviewer-owned prerequisites are still missing:

- `.github/phase-allowlists/phase-0-C.json`
- `docs/vocab/FROZEN-triggerCode-v1.json`
- `docs/vocab/FROZEN-party_role-v1.json`

## What is missing

Phase 0-C step 1 requires canonical definitions to cover the FROZEN vocabularies, specifically including `FROZEN-triggerCode-v1.json` and `FROZEN-party_role-v1.json`. Those files are not present on `main`.

The Phase 0-C runbook also says files touched must match `.github/phase-allowlists/phase-0-C.json`, but that allowlist file is not present. `.github/phase-allowlists/*` is reviewer-owned and forbidden to edit in Phase 0-C.

## Blocking rule

This blocks proceeding under:

- Phase 0-C non-negotiable prerequisite: Phase 0-B canonical shape output and frozen supporting artifacts must exist before audit/reconciliation work starts.
- Phase 0-C step 1: canonical definitions must be seeded from the FROZEN vocab files.
- Phase 0-C allowlist discipline: do not touch files outside the active phase allowlist, and do not edit `.github/phase-allowlists/*` from inside Phase 0-C.

## Current state

No Phase 0-C implementation files were created.

The working branch is:

```text
phase-0-C/audit-and-reconcile
```

This branch already contains the pre-existing straitjacket/ACK pin commit:

```text
a4445b1 chore(ack): pin straitjacket to Phase 0-C hash
```
