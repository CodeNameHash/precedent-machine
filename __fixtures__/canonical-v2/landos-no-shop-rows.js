const fs = require('node:fs');
const path = require('node:path');

const { compileFixtureContract } = require('../../lib/canonical-v2/contract-bundle');
const {
  buildFixtureClaimEvidenceDetailPackage,
  GENERAL_ACTION_SLOT_KEY,
} = require('../../lib/canonical-v2/exact-detail');
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
  const baseRows = buildReviewedNoShopServingRows({ slice, contractBundle: contract });
  const excerptsById = new Map(Object.values(slice.excerpts).map((excerpt) => [excerpt.excerpt_id, excerpt]));
  const detailPackages = baseRows.map((row) => {
    const claimRevisionId = row.canonical_result.components[0].claim_revision_id;
    const result = slice.results.find((item) => item.claim.claim_revision_id === claimRevisionId);
    const excerpt = excerptsById.get(result?.claim.evidence[0]?.excerpt_id);
    if (!result || !excerpt) throw new TypeError('no-shop serving row has no exact claim evidence');
    return buildFixtureClaimEvidenceDetailPackage({
      contract_bundle: contract,
      row,
      source: slice.source,
      source_admission: slice.sourceAdmission,
      excerpt,
      claim: result.claim,
      action_slot_key: GENERAL_ACTION_SLOT_KEY,
      evidence_ordinal: 0,
    });
  });
  return Object.freeze({
    ...slice,
    contract,
    detailPackages: Object.freeze(detailPackages),
    rows: Object.freeze(detailPackages.map((detailPackage) => detailPackage.row)),
  });
}

module.exports = { buildLandosNoShopServingFixture };
