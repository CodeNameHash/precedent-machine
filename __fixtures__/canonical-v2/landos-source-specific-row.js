const fs = require('node:fs');
const path = require('node:path');

const { compileFixtureContract } = require('../../lib/canonical-v2/contract-bundle');
const { buildFixtureOpenWorldEvidenceDetailPackage } = require('../../lib/canonical-v2/exact-detail');
const {
  buildReviewedSourceSpecificSlice,
  buildReviewedSourceSpecificWriteSet,
} = require('../../lib/canonical-v2/reviewed-source-specific');

function buildLandosSourceSpecificServingFixture() {
  const contract = compileFixtureContract();
  const sourceText = fs.readFileSync(
    path.join(process.cwd(), '__fixtures__', 'demo-deal', 'landos-abbvie-agreement.txt'),
    'utf8',
  );
  const slice = buildReviewedSourceSpecificSlice({ sourceText, contractBundle: contract });
  const exactDetail = buildFixtureOpenWorldEvidenceDetailPackage({
    contract_bundle: contract,
    row: slice.row,
    source: slice.source,
    source_admission: slice.sourceAdmission,
    excerpts: Object.values(slice.excerpts),
  });
  const canonicalWriteSet = buildReviewedSourceSpecificWriteSet({ slice, row: exactDetail.row });
  return Object.freeze({
    ...slice,
    contract,
    exactDetail,
    canonicalWriteSet,
    row: exactDetail.row,
  });
}

module.exports = { buildLandosSourceSpecificServingFixture };
