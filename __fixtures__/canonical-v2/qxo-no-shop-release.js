const fs = require('node:fs');
const path = require('node:path');

const { buildFixtureCandidateRelease } = require('../../lib/canonical-v2/candidate-release');
const { contentId } = require('../../lib/canonical-v2/canonical-bytes');
const { compileFixtureContract } = require('../../lib/canonical-v2/contract-bundle');
const {
  buildFixtureClaimEvidenceDetailPackage,
  GENERAL_ACTION_SLOT_KEY,
} = require('../../lib/canonical-v2/exact-detail');
const {
  buildQxoNoShopNoticeSlice,
  buildQxoNoShopServingRows,
} = require('../../lib/canonical-v2/reviewed-qxo-no-shop-slice');

function buildQxoNoShopReleaseFixture() {
  const contract = compileFixtureContract();
  const sourceText = fs.readFileSync(
    path.join(process.cwd(), '__fixtures__', 'canonical-v2', 'qxo-no-shop-reviewed-excerpts.txt'),
    'utf8',
  );
  const corpusReleaseId = contentId('CORPUS_RELEASE/V1', 'qxo-reviewed-notice-fixture');
  const servingNamespaceId = contentId('SERVING_NAMESPACE/V1', 'qxo-reviewed-notice-fixture');
  const slice = buildQxoNoShopNoticeSlice({ sourceText, contractBundle: contract, corpusReleaseId });
  const baseRows = buildQxoNoShopServingRows({ slice, contractBundle: contract, servingNamespaceId });
  const detailPackages = baseRows.map((row) => {
    const item = slice.results.find((result) => (
      result.claim.claim_revision_id === row.canonical_result.components[0].claim_revision_id
    ));
    return buildFixtureClaimEvidenceDetailPackage({
      contract_bundle: contract,
      row,
      source: slice.source,
      source_admission: slice.sourceAdmission,
      excerpt: item.excerpt,
      claim: item.claim,
      action_slot_key: GENERAL_ACTION_SLOT_KEY,
      evidence_ordinal: 0,
    });
  });
  const members = slice.results.map((item, index) => ({
    projection_output: item.projection,
    shared_row: detailPackages[index].row,
    exact_detail: {
      package: detailPackages[index],
      source: slice.source,
      source_admission: slice.sourceAdmission,
      excerpt: item.excerpt,
      claim: item.claim,
    },
  }));
  const release = buildFixtureCandidateRelease({
    contract_bundle: contract,
    serving_namespace_id: servingNamespaceId,
    corpus_release_id: corpusReleaseId,
    members,
    deal_directory_entries: [{
      application_deal_id: '7dc3a05f-b170-4d59-a255-b7103cca16e1',
      governed_deal_key: 'deal:qxo-topbuild',
    }],
  });
  return Object.freeze({
    ...slice,
    contract,
    corpusReleaseId,
    servingNamespaceId,
    detailPackages: Object.freeze(detailPackages),
    rows: Object.freeze(detailPackages.map((detailPackage) => detailPackage.row)),
    members: Object.freeze(members),
    release,
  });
}

module.exports = { buildQxoNoShopReleaseFixture };
