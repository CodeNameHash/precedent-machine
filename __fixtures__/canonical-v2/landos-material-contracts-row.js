const fs = require('node:fs');
const path = require('node:path');

const { compileFixtureContract } = require('../../lib/canonical-v2/contract-bundle');
const {
  buildFixtureClaimEvidenceDetailPackage,
  GENERAL_ACTION_SLOT_KEY,
} = require('../../lib/canonical-v2/exact-detail');
const {
  buildReviewedMaterialContractsServingRow,
  buildReviewedMaterialContractsSlice,
} = require('../../lib/canonical-v2/reviewed-material-contracts-slice');

function buildLandosMaterialContractsServingFixture() {
  const contract = compileFixtureContract();
  const agreementText = fs.readFileSync(
    path.join(process.cwd(), '__fixtures__', 'demo-deal', 'landos-abbvie-agreement.txt'),
    'utf8',
  );
  const dealValueSourceText = fs.readFileSync(
    path.join(process.cwd(), '__fixtures__', 'canonical-v2', 'landos-deal-value-sec-excerpt.txt'),
    'utf8',
  );
  const slice = buildReviewedMaterialContractsSlice({ agreementText, dealValueSourceText, contractBundle: contract });
  const serving = buildReviewedMaterialContractsServingRow({ slice, contractBundle: contract });
  const detailPackage = buildFixtureClaimEvidenceDetailPackage({
    contract_bundle: contract,
    row: serving,
    source: slice.agreementSource,
    source_admission: slice.agreementAdmission,
    excerpt: slice.excerpts.criterion,
    claim: slice.thresholdClaim,
    action_slot_key: GENERAL_ACTION_SLOT_KEY,
    evidence_ordinal: 0,
  });
  return Object.freeze({ ...slice, contract, detailPackage, row: detailPackage.row });
}

module.exports = { buildLandosMaterialContractsServingFixture };
