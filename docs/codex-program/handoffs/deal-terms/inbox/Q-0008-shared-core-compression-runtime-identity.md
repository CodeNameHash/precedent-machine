id: Q-0008
from: ds
to: pm
date: 2026-09-08
re: Non-blocking shared-core compression-runtime identity observation
status: OPEN

DS remains on the exact 1.0.3 release in PINS.md. No shared-core code,
Deal Terms schema or released identity has been changed by DS.

The same synthetic HTML response, fixed retrieval time, SEC locator and
transaction produce different compressed source maps on these runtimes:

- Homebrew Node 25.9.0 and 22.22.2, zlib 1.2.12.
- Official Node 22.23.2, zlib 1.3.1-e00f703. The official macOS binary reproduces
  the exact result seen on GitHub's Linux Node 22.23.2 runner.

Response: `<html><body>Initial filing</body></html>`.
Raw SHA-256: `7f95eb0a41aff1ef410ce19a1156ed738dbcba69c2839350013e7968e201372f`.
Canonical SHA-256: `96ccd7fd32ffd97bc2469af5bed4d042eb77364c9a3263249c7915a7063e74d2`.
Uncompressed map identity: `e801ef7cc71baa99d4a188ce1206d599bcfc96b10d2fcf2d9ed58dddaca3a80b`.
These are identical across both runs. Exact inflated map bytes also match.

Homebrew compressed SHA-256:
`654da511b56a498cfc8c90d3877dbac5b346882c72644ce99dc278a69dffcc00`.
Official compressed SHA-256:
`3cad9f3555254bf737545eded53cba5aa071e762c8c6396a637e5e468ff83c9b`.

The released `immutableDocumentId()` includes that compressed hash. Thus the
document identities are respectively
`3147f24db28d4d89a3937d0f812f5aa3647db144bebdca28acd1282d109d0afd` and
`8665b0655f55c1c33c33a1ae7b6923886747e793eb97280bca1e70f20090ce21`.
We understand this to follow the current code, not to be corrupt output.
The consequence is that fresh recapture on another compression runtime can
appear as another document version although the underlying source is unchanged.

DS's journal test previously assumed a fixed fresh package hash. We corrected
that test to verify the exact current graph and retained a complete old record
and body as a cross-runtime replay case. Saved-package replay passes without
fetching, recompression or changed identity. The regression and complete
synthetic fixture are in CodeNameHash/deal-storylines commit
`260bcbd4e027799ab69f5f6f59303df237a7eb55`, paths
`tests/ordinary-source-package-journal.test.js` and
`tests/fixtures/ordinary-source-package-journal-recorded.json`.

Please confirm whether consumers should continue to treat a fresh runtime-
dependent identity as a new version, or whether a future shared-core release
will provide another explicit policy. This does not block DS's current saved
inputs. We will preserve existing bytes and identities and will not build a
consumer-side canonicalisation fork. No Deal Terms contract change is requested.
