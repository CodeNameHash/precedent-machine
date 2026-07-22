const fs = require('node:fs');
const path = require('node:path');

const { compileFixtureContract } = require('../../lib/canonical-v2/contract-bundle');
const { buildFixtureClaimEvidenceDetailPackage } = require('../../lib/canonical-v2/exact-detail');
const {
  buildReviewedCapitalisationServingRow,
  buildReviewedCapitalisationSlice,
} = require('../../lib/canonical-v2/reviewed-capitalisation-slice');

function buildLandosReviewedServingFixture({
  contractBundle = compileFixtureContract(),
  corpusReleaseId,
} = {}) {
  const contract = contractBundle;
  const sourceText = fs.readFileSync(
    path.join(process.cwd(), '__fixtures__', 'demo-deal', 'landos-abbvie-agreement.txt'),
    'utf8',
  );
  const slice = buildReviewedCapitalisationSlice({
    sourceText,
    contractBundle: contract,
    corpusReleaseId,
  });
  const serving = buildReviewedCapitalisationServingRow({ slice, contractBundle: contract });
  const exactDetail = buildFixtureClaimEvidenceDetailPackage({
    contract_bundle: contract,
    row: serving.row,
    source: slice.source,
    source_admission: slice.sourceAdmission,
    excerpt: slice.excerpts.accuracy_standard,
    claim: slice.accuracyClaim,
  });
  return Object.freeze({
    ...slice,
    ...serving,
    contract,
    exactDetail,
    row: exactDetail.row,
  });
}

module.exports = { buildLandosReviewedServingFixture };
