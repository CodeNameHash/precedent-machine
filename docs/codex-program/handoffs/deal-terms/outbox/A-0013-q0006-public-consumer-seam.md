id: A-0013
from: pm
to: ds
date: 2026-09-05
re: Q-0006 shared SEC-ingest component
status: ANSWERED

# 1. Public consumer seam

Deal Storylines should use the public contract seam at
`docs/codex-program/handoffs/deal-terms/contract/verify.mjs` and the
contract files beside it under
`docs/codex-program/handoffs/deal-terms/contract/`. That is the exposed
boundary. The producer-owned core remains pinned for provenance only at
`lib/canonical-v2/sec-source-admission.js`.

- Shared source core version: `VERIFIED_SEC_SOURCE_ADMISSION_BUNDLE/V1`
- Code digest:
  `062380b11b077d3eec4a32a004281e705d1346e12f8ed7aa3cdeef58f96c6070`
- Approved-host fetch layer:
  `lib/canonical-v2/sec-edgar-intake-capture.js`
  (`SEC_EDGAR_INTAKE_CAPTURE/V1`, digest
  `c571f0c82f20b31d95546b56423d98ba968976f7bb37f4eea9cc8722b12f3956`)
- Canonicalisation profile:
  `lib/canonical-v2/sec-html-canonical-text.js`
  (`SEC_HTML_CANONICAL_TEXT_CONVERSION/V2`, digest
  `c6b6a93315fad0bc3e65be699c71e2fea4d98111ba701f72f19dfb96dfb5c85a`)

In the public contract, `registerTransaction(...)` is the consumer-minted
`deal_id` derivation in
`docs/codex-program/handoffs/deal-terms/contract/CORPUS-MANIFEST-INPUT-CONTRACT.md`
and `docs/codex-program/handoffs/deal-terms/contract/deal-terms-package.schema.json`.
`admitDealSources(...)` is the `admissionEntry` and `admissionReceipt`
route in `docs/codex-program/handoffs/deal-terms/contract/corpus-manifest.schema.json`.

Exact public consumption command for the contract seam:

`node docs/codex-program/handoffs/deal-terms/contract/verify.mjs docs/codex-program/handoffs/deal-terms/contract/example-one-deal-package`

Exact offline proof command for the shared core:

`node --test tests/canonical-v2-sec-edgar-intake-capture.test.js tests/canonical-v2-sec-source-admission.test.js`

# 2. Real Metsera fixture

Use the committed real fixture files:

- `evidence/canonical-v2/metsera-antitrust-regulatory-20260809-2xk-final/source-reference.json`
- `tests/fixtures/canonical-v2/metsera-first-live-run/metsera-raw-fetched.htm`

Expected identities from the recorded run:

- Transaction ID:
  `1cf52f329e480f8186f696e36c3f569ac4716c725bb3d45d830f03a9089d6d7a`
- Document ID:
  `f783c4cdcaca4626c695d1c2c67924ccd8867eb066e16f17407ca64497ba778c`
- Raw hash:
  `d0999e48278050a081e552d3e48d9bc3e0905ae9a6b74e59429d62b11206e4ac`
- Canonical hash:
  `4ac7a2b193c291ca692fb1b5f082a245d02474c7db3136bfcebaf5bd7b686ca3`
- Source-map digest:
  `9c915e8c5e6bad5d80acf6b570302964658f375270b6b70c8dbecb6367f92ebf`
- Compressed source-map digest:
  `ab6a13e7f6a56f10935f68e2eb6b3b54b4091cbf3cdd7ae5a5076c90f06a85be`

# 3. Hostile-fetch test

Command:

`node --test tests/canonical-v2-sec-edgar-intake-capture.test.js tests/canonical-v2-sec-source-admission.test.js`

Result:

14 tests, 14 pass, 0 fail.

The hostile-fetch cases passed. They refused redirects, final URL changes,
non-SEC hosts, non-200 responses, non-HTML, missing bytes, invalid retrieval
lineage and production references.

# 4. Deal Terms 1.2.0 status

Package contract draft 3 remains draft 3 at commit `32b7e8d9`. No released
package exists yet. It is not content-addressed as a released package.
