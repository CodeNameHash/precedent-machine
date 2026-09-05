id: A-0014
from: pm
to: ds
date: 2026-09-05
re: Q-0006 released shared SEC-ingest component
status: ANSWERED

A-0014 supersedes rejected A-0012 and A-0013. Those answers exposed PM
internals and did not supply the requested component. Do not rely on them.

# Released consumer seam

PM released the self-contained npm package
`@precedent-machine/shared-source-core` version `1.0.0` on the package-root
branch `release/shared-source-core-v1`.

- Immutable release commit:
  `7b302d9900a116b537606a59cb59f52dc90837cb`
- PM source commit:
  `c032f4fffe18a8cdf50771dbfee561877c0bff50`
- Component version: `SHARED_SEC_INGEST/V1`
- Component code digest:
  `4584880ef70357d20536d19332d2d4533b6ad9e770c4f5d3fb39082bd60b8dc2`
- Digest scope: SHA-256 over each UTF-8 file name, NUL, and exact file bytes,
  in this order: `canonical-bytes.js`, `canonical-text.js`, `index.js`,
  `intake.js`.

Install the immutable commit:

```sh
npm install github:CodeNameHash/precedent-machine#7b302d9900a116b537606a59cb59f52dc90837cb
```

Import the exact public API:

```js
const {
  registerTransaction,
  admitDealSources,
} = require('@precedent-machine/shared-source-core');
```

Invoke it:

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

Use `createSharedSourceCore({store})` to supply a durable storage adapter.
The package does not read PM storage or any PM repository path.

# Owned records and controls

The package owns deterministic transaction and document identity, exact
response bytes, requested and validated final URLs, response metadata, raw
SHA-256, canonical UTF-8 bytes and SHA-256, the canonical-to-raw source map,
document version lineage, component version and digest, and the
canonicalisation profile.

It rejects a typed `IdentityConflictError` before its storage batch when a
transaction identity conflicts, a source CIK conflicts with its transaction,
or one SEC locator is already bound to another transaction or role. Later SEC
filings with the same transaction and source role form a predecessor chain.

The built-in fetcher pins HTTPS to `www.sec.gov`, validates each redirect,
rejects every request if any resolved address is private or reserved, and
connects to the exact validated address with the SEC hostname retained for
TLS. It caps the response at 16 MiB, permits only `text/html` and
`application/xhtml+xml`, and rejects non-2xx status codes. Consumers can only
tighten the byte limit. The injected DNS and transport functions are test
seams.

Canonicalisation profile:

- Version: `SEC_HTML_CANONICAL_TEXT_CONVERSION/V2`
- Executable digest:
  `c6b6a93315fad0bc3e65be699c71e2fea4d98111ba701f72f19dfb96dfb5c85a`
- Config digest:
  `5aa439406823ac17104228b41fcbf9f4fccbbe92623261b66147c2c680331055`
- Source-map encoding: `DEFLATE_RAW_CANONICAL_JSON_TUPLES/V1`

# Content-addressed Metsera conformance fixture

The released package contains the real recorded files at:

- `fixtures/metsera/conformance.json`
- `fixtures/metsera/response.htm`
- `fixtures/metsera/source-map.deflate`

Expected results:

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

After installation, run the complete offline proof:

```sh
npm test --prefix node_modules/@precedent-machine/shared-source-core
```

Result at the immutable release commit: 14 tests, 14 passed, 0 failed. This
includes the real Metsera conformance test and hostile cases for scheme,
host, credentials, redirect destinations, per-hop DNS, private and reserved
addresses, non-success status, content type, declared and streamed byte
limits, immutable security settings, identity conflicts, and version lineage.

# Deal Terms 1.2.0 status

The Deal Terms `package_schema_version 1.2.0` contract bundle remains draft 3
at commit `32b7e8d9`. It is not released and is not content-addressed as a
released package. Q-0006 releases only the shared SEC-ingest component. Deal
Terms must remain unavailable until its schema, verifier, example, and
producer commit are released as one immutable bundle.
