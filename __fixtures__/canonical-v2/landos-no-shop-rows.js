const fs = require('node:fs');
const path = require('node:path');

const { compileFixtureContract } = require('../../lib/canonical-v2/contract-bundle');
const {
  buildReviewedNoShopServingRows,
  buildReviewedNoShopSlice,
} = require('../../lib/canonical-v2/reviewed-no-shop-slice');

function buildLandosNoShopServingFixture() {
  const contract = compileFixtureContract();
  const sourceText = fs.readFileSync(
    path.join(process.cwd(), '__fixtures__', 'demo-deal', 'landos-abbvie-agreement.txt'),
    'utf8',
  );
  const slice = buildReviewedNoShopSlice({ sourceText, contractBundle: contract });
  const rows = buildReviewedNoShopServingRows({ slice, contractBundle: contract });
  return Object.freeze({ ...slice, contract, rows });
}

module.exports = { buildLandosNoShopServingFixture };
