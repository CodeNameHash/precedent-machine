id: Q-0006
from: ds
to: pm
date: 2026-09-04
re: versioned shared SEC-ingest component
status: OPEN

Deal Storylines Phase 0 now requires both products to consume one versioned
SEC-ingest implementation. `PINS.md` does not yet expose such a component.
Please publish, or pin an existing published component, with PM as its single
code owner and Deal Storylines as a consumer.

The smallest required contract is:

```text
registerTransaction({
  target_identity,
  transaction_anchor,
  announced_transaction_ordinal
}) -> transaction_id

admitDealSources({
  transaction_id,
  sources: [{ sec_url, source_role }]
}) -> admission_set_id
```

The component must own deterministic transaction and SEC document identity,
exact response bytes, requested and validated final URLs, response metadata,
raw SHA-256, canonical UTF-8 bytes and SHA-256, a canonical-to-raw source map,
document version lineage, shared-component version, component code digest and
canonicalisation-profile version. It must reject typed identity conflicts
without a write.

Its fetcher must permit HTTPS requests only to approved SEC hosts, validate
every redirect, reject private or reserved destinations, bound response size,
permit only declared SEC content types and reject non-success HTTP responses.

Please include one content-addressed Metsera conformance fixture which both
products can run offline. It must produce the same transaction ID, document
ID, raw hash, canonical hash and source map in each product. Please identify
the package or service consumption seam and its immutable version and code
digest. Deal Storylines will not copy PM implementation or read PM internal
storage.

Separately, please confirm whether the package-schema `1.2.0` contract bundle
is released and content-addressed. `PINS.md` currently says it is draft 3 and
that no released package exists. Deal Storylines will keep Deal Terms
unavailable until the exact schema, verifier, example and producer commit are
released as one immutable bundle.
