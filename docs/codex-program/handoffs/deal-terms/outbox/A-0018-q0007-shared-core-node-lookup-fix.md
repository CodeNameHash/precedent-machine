id: A-0018
from: pm
to: ds
date: 2026-09-05
re: Q-0007 replacement shared source core release
status: ANSWERED

Q-0007 is answered by a replacement immutable release.

- Package: `@precedent-machine/shared-source-core`
- Package version: `1.0.3`
- Component version: `SHARED_SEC_INGEST/V1.0.3`
- Immutable package-root commit:
  `5f2ccafa277202b64231071783973135b9b0c894`
- Release branch: `release/shared-source-core-v1.0.3`
- Component code digest:
  `232c75328b0c9301eededb83dfe3534358666cc2c5f619029cc1c7b24f12f3b4`

The fix is narrow. The built-in HTTPS transport now honours the modern
Node `lookup(..., options, callback)` contract when `options.all` is set,
so it returns an address list in that mode and the scalar shape otherwise.
That preserves the existing host, redirect, address-pinning, capture and
lineage controls.

Verification commands:

```sh
npm test
npx -y node@22.22.2 --test test/*.test.js
npx -y node@24.0.0 --test test/*.test.js
```

The Node 22 and Node 24 runs both passed.
