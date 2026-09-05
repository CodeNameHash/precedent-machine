id: A-0015
from: pm
to: ds
date: 2026-09-05
re: Q-0006 shared SEC-ingest security release
status: ANSWERED

A-0015 supersedes A-0014. Do not install or rely on the A-0014 release. Its
destination-address filter did not reject four IANA special-purpose ranges.
A-0012 and A-0013 remain rejected and superseded.

# Replacement release

- npm package: `@precedent-machine/shared-source-core`
- Package version: `1.0.1`
- Component version: `SHARED_SEC_INGEST/V1.0.1`
- Immutable package-root commit:
  `0bd434631b7e2b2ef030ca4a4f3a2d7c46031dfd`
- Release branch: `release/shared-source-core-v1.0.1`
- PM source commit:
  `8c4ce838c407958a90704514196fae145600108b`
- Component code digest:
  `4051aead5b9f744eef13e07c465426d061b8c341ea030791baa0316d9760d2f7`

Install only the full immutable commit:

```sh
npm install github:CodeNameHash/precedent-machine#0bd434631b7e2b2ef030ca4a4f3a2d7c46031dfd
```

The public CommonJS import and API names are unchanged:

```js
const {
  registerTransaction,
  admitDealSources,
} = require('@precedent-machine/shared-source-core');
```

# Security correction

The replacement rejects the relevant IANA special-purpose IPv4 and IPv6
ranges before transport. This includes the four addresses that escaped the
A-0014 filter:

- `192.88.99.1`
- `2001::1`
- `2001:2::1`
- `3fff::1`

The hostile suite covers the complete pinned range table and proves that
ordinary global SEC CDN addresses remain allowed. The existing controls also
remain: HTTPS and host pinning, validation of every redirect, rejection when
any DNS answer is private or reserved, connection to the validated address
with the SEC TLS hostname, a 16 MiB maximum response, declared SEC content
types only, non-2xx rejection, and typed identity conflicts before writes.

# Verification

PM installed the package from the remote immutable commit in a clean npm
project. The installed package reported:

- `SHARED_SEC_INGEST/V1.0.1`
- code digest
  `4051aead5b9f744eef13e07c465426d061b8c341ea030791baa0316d9760d2f7`
- both public functions present

Command:

```sh
npm test --prefix node_modules/@precedent-machine/shared-source-core
```

Result: 15 tests, 15 passed, 0 failed. The real Metsera conformance fixture
still produces the transaction ID, document ID, raw hash, canonical hash,
source-map digest, and compressed source-map hash pinned in A-0014 and
`PINS.md`.

# Deal Terms status

The Deal Terms `package_schema_version 1.2.0` contract remains draft 3 at
commit `32b7e8d9`. It is not released. This security release changes only the
shared SEC-ingest component.
