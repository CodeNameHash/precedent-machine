const fs = require('node:fs');
const path = require('node:path');

const { compileFixtureContract } = require('../../lib/canonical-v2/contract-bundle');
const {
  buildReviewedIocCapexServingRow,
  buildReviewedIocCapexSlice,
} = require('../../lib/canonical-v2/reviewed-ioc-capex-slice');

function buildLandosIocCapexServingFixture() {
  const contract = compileFixtureContract();
  const agreementText = fs.readFileSync(
    path.join(process.cwd(), '__fixtures__', 'demo-deal', 'landos-abbvie-agreement.txt'),
    'utf8',
  );
  const dealValueSourceText = fs.readFileSync(
    path.join(process.cwd(), '__fixtures__', 'canonical-v2', 'landos-deal-value-sec-excerpt.txt'),
    'utf8',
  );
  const slice = buildReviewedIocCapexSlice({ agreementText, dealValueSourceText, contractBundle: contract });
  const row = buildReviewedIocCapexServingRow({ slice, contractBundle: contract });
  return Object.freeze({ ...slice, contract, row });
}

module.exports = { buildLandosIocCapexServingFixture };
