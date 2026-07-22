const fs = require('node:fs');
const path = require('node:path');

const { compileFixtureContract } = require('../../lib/canonical-v2/contract-bundle');
const { buildFixtureResultCompositionDetailPackage } = require('../../lib/canonical-v2/exact-detail');
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
  const compositionComponents = [
    {
      component: slice.result,
      claim: slice.accuracyClaim,
      relationships: [slice.relationship],
    },
    ...slice.contextComponents,
  ];
  const exactDetailExcerpts = Object.values(slice.excerpts).sort((left, right) => (
    left.absolute_start - right.absolute_start
      || left.absolute_end - right.absolute_end
      || left.excerpt_id.localeCompare(right.excerpt_id)
  ));
  const exactDetail = buildFixtureResultCompositionDetailPackage({
    contract_bundle: contract,
    row: serving.row,
    source: slice.source,
    source_admission: slice.sourceAdmission,
    components: compositionComponents,
    relationship_targets: slice.representationComponents,
    excerpts: exactDetailExcerpts,
  });
  return Object.freeze({
    ...slice,
    ...serving,
    contract,
    compositionComponents: Object.freeze(compositionComponents),
    exactDetail,
    exactDetailExcerpts: Object.freeze(exactDetailExcerpts),
    row: exactDetail.row,
  });
}

module.exports = { buildLandosReviewedServingFixture };
