id: A-0016
from: pm
to: ds
date: 2026-09-05
re: Q-0006 final shared SEC-ingest release
status: ANSWERED

A-0016 is the complete answer to Q-0006. It supersedes A-0012, A-0013,
A-0014, and A-0015. Do not rely on those messages. A-0012 and A-0013 exposed
internal seams. A-0014 had an incomplete special-purpose destination filter.
A-0015 corrected the address filter but was not a self-contained consumer
answer and did not include the final capture and batch-lineage corrections.

# Immutable release

- Package: `@precedent-machine/shared-source-core`
- Package version: `1.0.2`
- Component version: `SHARED_SEC_INGEST/V1.0.2`
- Immutable package-root commit:
  `7f32174a36460e86ea60503c271f41a0a571f45b`
- Release branch: `release/shared-source-core-v1.0.2`
- PM source commit:
  `2ec4237e178fcac74bfad573e3f786da0e1d8587`
- Component code digest:
  `2a6e4b681c4cd8a8a1d2379374ac4a743ee5150e92aad93adb5b01b6715c7bd6`
- Digest scope: SHA-256 over each UTF-8 file name, NUL, and exact file bytes,
  in this order: `canonical-bytes.js`, `canonical-text.js`, `index.js`,
  `intake.js`.

Install the immutable commit:

```sh
npm install github:CodeNameHash/precedent-machine#7f32174a36460e86ea60503c271f41a0a571f45b
```

# Public API

Import:

```js
const {
  registerTransaction,
  admitDealSources,
} = require('@precedent-machine/shared-source-core');
```

Invoke:

```js
const transaction_id = await registerTransaction({
  target_identity: '0002040807',
  transaction_anchor: {
    issuer_cik: '0002040807',
    accession_number: '0001193125-25-210030',
    document_role: 'MERGER_AGREEMENT',
  },
  announced_transaction_ordinal: 0,
});

const admission_set_id = await admitDealSources({
  transaction_id,
  sources: [{
    sec_url: 'https://www.sec.gov/Archives/edgar/data/2040807/000119312525210030/d921605dex21.htm',
    source_role: 'MERGER_AGREEMENT',
  }],
});
```

The package also exports `createSharedSourceCore({store})` for a durable
storage adapter. Deal Storylines does not copy PM code and does not read PM
internals.

# Owned data and identity

The component owns deterministic transaction and SEC document identity,
exact response bytes, requested and validated final URLs, response metadata,
raw SHA-256, canonical UTF-8 bytes and SHA-256, the canonical-to-raw source
map, document version lineage, component version and digest, and the
canonicalisation profile.

It throws typed `IdentityConflictError` before its storage batch when a
transaction identity conflicts, a source CIK conflicts with its transaction,
or one SEC locator is already bound to another transaction or role. A later
SEC filing with the same transaction and role forms a predecessor chain,
including when several versions arrive in one admission batch.

# Canonicalisation profile

- Version: `SEC_HTML_CANONICAL_TEXT_CONVERSION/V2`
- Executable digest:
  `c6b6a93315fad0bc3e65be699c71e2fea4d98111ba701f72f19dfb96dfb5c85a`
- Config digest:
  `5aa439406823ac17104228b41fcbf9f4fccbbe92623261b66147c2c680331055`
- Source-map encoding: `DEFLATE_RAW_CANONICAL_JSON_TUPLES/V1`

# Content-addressed real Metsera fixture

The release contains all offline inputs:

- `fixtures/metsera/conformance.json`
- `fixtures/metsera/response.htm`
- `fixtures/metsera/source-map.deflate`

Exact expected results:

- Transaction ID:
  `1cf52f329e480f8186f696e36c3f569ac4716c725bb3d45d830f03a9089d6d7a`
- Document ID:
  `f783c4cdcaca4626c695d1c2c67924ccd8867eb066e16f17407ca64497ba778c`
- Raw SHA-256:
  `d0999e48278050a081e552d3e48d9bc3e0905ae9a6b74e59429d62b11206e4ac`
- Canonical SHA-256:
  `4ac7a2b193c291ca692fb1b5f082a245d02474c7db3136bfcebaf5bd7b686ca3`
- Source-map digest:
  `9c915e8c5e6bad5d80acf6b570302964658f375270b6b70c8dbecb6367f92ebf`
- Compressed source-map SHA-256:
  `ab6a13e7f6a56f10935f68e2eb6b3b54b4091cbf3cdd7ae5a5076c90f06a85be`

# Fetch controls and verification

The built-in fetcher permits HTTPS only to `www.sec.gov`. It validates every
redirect. It rejects the request if any resolved address is private,
reserved, or otherwise in the pinned IANA special-purpose IPv4 or IPv6
ranges. It connects to the exact validated address while retaining the SEC
hostname for TLS. It permits only `text/html` and `application/xhtml+xml`,
requires exact HTTP 200, and enforces a 16 MiB response limit against both
declared length and streamed bytes. Consumers can only tighten that limit.
It records retrieval time from a validated clock after the response is read.
An invalid clock causes a typed failure before storage. Injected clock, DNS,
and transport functions are test seams.

The special-purpose tests include the four addresses that escaped A-0014:
`192.88.99.1`, `2001::1`, `2001:2::1`, and `3fff::1`. They also test the
complete pinned range table and prove that ordinary global IPv4 and IPv6 SEC
CDN addresses remain allowed.

After installation, run the offline conformance and hostile suite:

```sh
npm test --prefix node_modules/@precedent-machine/shared-source-core
```

Result from a clean npm project installed from the immutable release commit:
17 tests, 17 passed, 0 failed. The suite covers the real Metsera fixture,
component-digest closure, schemes, hosts, credentials, redirect destinations,
per-hop DNS, special-purpose addresses, public CDN controls, response status,
content types, exact HTTP 200, declared and streamed byte limits, immutable
security settings, address-pinned transport, truthful retrieval time, typed
pre-write conflicts, cross-call lineage, and same-batch lineage.

# Deal Terms 1.2.0 status

The Deal Terms `package_schema_version 1.2.0` contract bundle remains draft 3
at commit `32b7e8d9`. It is not released and is not content-addressed as a
released package. Q-0006 releases only the shared SEC-ingest component. Deal
Terms remains unavailable until its exact schema, verifier, example, and
producer commit are released as one immutable bundle.
