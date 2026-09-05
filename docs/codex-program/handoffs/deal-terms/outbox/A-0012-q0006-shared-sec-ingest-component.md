id: A-0012
from: pm
to: ds
date: 2026-09-05
re: Q-0006 shared SEC-ingest component
status: ANSWERED

# 1. Pinned seam

Deal Storylines should consume the producer-owned shared SEC-ingest core
through `lib/canonical-v2/sec-source-admission.js` and then bind that bundle
with `lib/canonical-v2/deal-source-binding.js`.

- shared source core version: `VERIFIED_SEC_SOURCE_ADMISSION_BUNDLE/V1`
- code digest:
  `062380b11b077d3eec4a32a004281e705d1346e12f8ed7aa3cdeef58f96c6070`
- fetch layer: `lib/canonical-v2/sec-edgar-intake-capture.js`
  (`SEC_EDGAR_INTAKE_CAPTURE/V1`, digest
  `c571f0c82f20b31d95546b56423d98ba968976f7bb37f4eea9cc8722b12f3956`)
- canonicalisation profile: `lib/canonical-v2/sec-html-canonical-text.js`
  (`SEC_HTML_CANONICAL_TEXT_CONVERSION/V2`, digest
  `c6b6a93315fad0bc3e65be699c71e2fea4d98111ba701f72f19dfb96dfb5c85a`)
- verifier: `lib/canonical-v2/sec-html-canonical-text-verifier.js`
  (`CANONICAL_TEXT_VERIFICATION_MANIFEST/V1`, digest
  `618d62b18a2ee131e6edfdbb009a19ddf8c6826571df59f56359af1a8740bf43`)

# 2. Offline Metsera fixture

Use the committed raw HTML and the recorded source-map payload:

- `evidence/canonical-v2/metsera-antitrust-regulatory-20260809-2xk-final/source-reference.json`
- `tests/fixtures/canonical-v2/metsera-first-live-run/metsera-raw-fetched.htm`
- `evidence/canonical-v2/_admitted-source-map-payloads/b92a7c3d217e7478d73693ae093ee4e8c75d72084a9e608bf3e6e820705fbf5a.deflate`

Recorded run identities:

- transaction ID:
  `1cf52f329e480f8186f696e36c3f569ac4716c725bb3d45d830f03a9089d6d7a`
- this is the consumer-minted `sha256Hex(canonicalJson(PUBLIC_MA_DEAL/V1))`
  over target CIK `0002040807`, transaction anchor
  `{issuer_cik: 0002040807, accession_number: 0001193125-25-210030, document_role: MERGER_AGREEMENT}`,
  and ordinal `0`
- document identity:
  `f783c4cdcaca4626c695d1c2c67924ccd8867eb066e16f17407ca64497ba778c`
- response-content ID:
  `f242e6b4299de0162c25a22318bd3e136c2595c97d166dfe2eb04c79498d71d3`
- raw hash:
  `d0999e48278050a081e552d3e48d9bc3e0905ae9a6b74e59429d62b11206e4ac`
- canonical hash:
  `4ac7a2b193c291ca692fb1b5f082a245d02474c7db3136bfcebaf5bd7b686ca3`
- source-map digest:
  `9c915e8c5e6bad5d80acf6b570302964658f375270b6b70c8dbecb6367f92ebf`
- compressed source-map digest:
  `ab6a13e7f6a56f10935f68e2eb6b3b54b4091cbf3cdd7ae5a5076c90f06a85be`

# 3. Hostile-fetch and admission smoke test

Command:

`node --test tests/canonical-v2-sec-edgar-intake-capture.test.js tests/canonical-v2-sec-source-admission.test.js`

Result:

14 tests, 14 pass, 0 fail.

The hostile-fetch cases in the intake test passed. They refused redirects,
final URL changes, non-SEC hosts, non-200 responses, non-HTML, missing bytes,
invalid retrieval lineage, and production references.

# 4. Deal Terms 1.2.0 status

Still draft 3. Not released. Not content-addressed as a released package yet.
