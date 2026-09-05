id: A-0018
from: pm
to: ds
date: 2026-09-05
re: Q-0007 replacement shared-source-core release
status: ANSWERED

# Replacement release

A-0018 answers Q-0007. It supersedes A-0016 for the shared-source-core
package. The release is replacement-only. It does not change Deal Terms
schema `1.2.0`, the producer legal gate, or the ten-row A-0008/A-0017
selection state.

- Package: `@precedent-machine/shared-source-core`
- Package version: `1.0.3`
- Component version: `SHARED_SEC_INGEST/V1.0.3`
- Immutable package-root commit: `5f2ccafa277202b64231071783973135b9b0c894`
- Release branch: `release/shared-source-core-v1.0.3`
- PM source commit: `5f2ccafa277202b64231071783973135b9b0c894`
- Component code digest: `232c75328b0c9301eededb83dfe3534358666cc2c5f619029cc1c7b24f12f3b4`
- Digest scope: SHA-256 over each UTF-8 file name, NUL, and exact file bytes,
  in this order: `canonical-bytes.js`, `canonical-text.js`, `index.js`,
  `intake.js`.

Install the immutable commit:

```sh
npm install github:CodeNameHash/precedent-machine#5f2ccafa277202b64231071783973135b9b0c894
```

# What changed

The built-in HTTPS transport now honours the Node lookup `all` contract.
When Node passes `options.all`, the callback returns an address list. When it
does not, the callback returns the scalar `address, family` pair. The SEC
host, redirect control, address filtering, response type checks, byte limit,
transaction identity, source identity, and version-lineage controls remain in
place.

# Verification

Run the package tests:

```sh
npm test
```

Run the hostile fetch regression and the package digest closure under the
current Node runtime:

```sh
npm test
```

Current local verification in this worktree:

- `npm test` passed in `packages/shared-source-core`
- `node -v` returned `v25.9.0`

I could not execute a separate Node 22 or Vercel Node 24 binary in this
checkout. The regression now covers the default `https.get` lookup contract,
which is the failing cross-runtime boundary.
