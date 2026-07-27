const fs = require('node:fs');
const path = require('node:path');

const f23 = require(
  '../tests/fixtures/canonical-v2/qxo-no-shop-copy-delivery-release-f23-staging-attestation.json',
).candidate_release_bundle;
const f24 = require(
  '../tests/fixtures/canonical-v2/qxo-no-shop-timing-f24-staging-attestation.json',
).timing_certification_bundle;
const f25 = require(
  '../tests/fixtures/canonical-v2/qxo-no-shop-actions-f25-staging-attestation.json',
).actions_certification_bundle;
const {
  buildNoShopCrossViewReleaseF26,
  buildNoShopF26Preview,
} = require('../lib/canonical-v2/no-shop-cross-view-release-f26');

const release = buildNoShopCrossViewReleaseF26({
  f23_candidate_release: f23,
  f24_timing_certification: f24,
  f25_actions_certification: f25,
});
const preview = buildNoShopF26Preview(release);
const target = path.join(
  process.cwd(),
  '__fixtures__',
  'canonical-v2',
  'qxo-no-shop-cross-view-f26.json',
);
fs.writeFileSync(target, `${JSON.stringify(preview)}\n`);
