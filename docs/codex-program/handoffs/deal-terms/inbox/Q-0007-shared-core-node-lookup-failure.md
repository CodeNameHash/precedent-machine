id: Q-0007
from: ds
to: pm
date: 2026-09-05
re: shared source core default transport fails on supported Node runtimes
status: OPEN

A-0016 and `PINS.md` release `@precedent-machine/shared-source-core` 1.0.2
at immutable commit `7f32174a36460e86ea60503c271f41a0a571f45b`.
Deal Storylines verified the immutable package's offline suite: 17 tests,
17 passed, 0 failed.

The released built-in transport cannot make a real SEC request on Node
22.22.2 or Node 25.9.0. The real call fails before HTTP with:

```text
TypeError [ERR_INVALID_IP_ADDRESS]: Invalid IP address: undefined
    at lookup (.../index.js:202:9)
```

Reproduction:

```js
const { createSharedSourceCore } = require('@precedent-machine/shared-source-core');

const core = createSharedSourceCore({
  userAgent: 'Deal Storylines internal research bengoodchild@gmail.com'
});

const transaction_id = await core.registerTransaction({
  target_identity: '0002040807',
  transaction_anchor: {
    issuer_cik: '0002040807',
    accession_number: '0001193125-25-210030',
    document_role: 'MERGER_AGREEMENT'
  },
  announced_transaction_ordinal: 0
});

await core.admitDealSources({
  transaction_id,
  sources: [{
    sec_url: 'https://www.sec.gov/Archives/edgar/data/2040807/000119312525242494/d53787ddefm14a.htm',
    source_role: 'MERGER_PROXY_DEFINITIVE'
  }]
});
```

The cause is the custom `https.get` lookup callback in `pinnedHttpsTransport`.
Modern Node requests `options.all`. The callback supplies the scalar callback
shape in all cases, so Node reads an undefined address.

This diagnostic correction makes the real call work while retaining the
previously validated address:

```js
lookup(hostname, options, callback) {
  if (options && options.all) callback(null, [{ address, family }]);
  else callback(null, address, family);
}
```

With that correction only, Node 22 admitted the real definitive Metsera proxy
through the released component and produced:

```text
transaction_id  1cf52f329e480f8186f696e36c3f569ac4716c725bb3d45d830f03a9089d6d7a
admission_set_id 4d8ded7aa202eb93189238505c05c16a94645b1dc114652df3ee3ec5875eff35
document_id      43414b92d1051bb320b98da2cf28d49e992623da12eaffcbb82c6faca6445b7c
raw_sha256       55c9aff7d3dcedd17f8e2871409d4ef9bc9d9d1da669fe899d2c7c6e370af5a8
canonical_sha256 4bddd84985d9c946a72d1b0f15327a13b9b349c5813652650d2fab2241da81f5
source_map_digest feb2c721b772dded60c25d58227838896a78f2f29fe7f470d1cde5199c0ee294
```

Please release a replacement immutable package. Add a regression test that
exercises the default `https.get` transport lookup contract on the supported
Node runtime, not only an injected transport. Verify Node 22 and the Vercel
Node 24 runtime. Preserve all A-0016 identity, capture, lineage and hostile
fetch controls. Do not require Deal Storylines to inject or copy a replacement
transport because the shared component owns secure fetching.

Please update `PINS.md` and answer Q-0007 with the replacement package
version, immutable commit, component version, code digest and verification
commands. This does not change the Deal Terms 1.2.0 contract or release state.
