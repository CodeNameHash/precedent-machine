const { buildLandosIocCapexServingFixture } = require('./landos-ioc-capex-row');
const { buildLandosMaterialContractsServingFixture } = require('./landos-material-contracts-row');
const { buildLandosNoShopServingFixture } = require('./landos-no-shop-rows');
const { buildLandosReviewedServingFixture } = require('./landos-reviewed-row');
const { buildLandosTerminationFeeServingFixture } = require('./landos-termination-fee-row');
const { buildLandosSourceSpecificServingFixture } = require('./landos-source-specific-row');
const { contentId } = require('../../lib/canonical-v2/canonical-bytes');
const { buildFixtureCandidateRelease } = require('../../lib/canonical-v2/candidate-release');
const { compileFixtureContract } = require('../../lib/canonical-v2/contract-bundle');

function buildLandosCandidateReleaseFixture({
  contractBundle = compileFixtureContract(),
  corpusReleaseId = contentId('CORPUS_RELEASE/V1', 'landos-reviewed-fixture-candidate-contract-v6-exact-detail-package-binding'),
  servingNamespaceId = contentId('SERVING_NAMESPACE/V1', 'landos-reviewed-fixture'),
} = {}) {
  const fixtureOptions = { contractBundle, corpusReleaseId };
  const ioc = buildLandosIocCapexServingFixture(fixtureOptions);
  const materialContracts = buildLandosMaterialContractsServingFixture(fixtureOptions);
  const noShop = buildLandosNoShopServingFixture(fixtureOptions);
  const reviewed = buildLandosReviewedServingFixture(fixtureOptions);
  const terminationFee = buildLandosTerminationFeeServingFixture(fixtureOptions);
  const sourceSpecific = buildLandosSourceSpecificServingFixture(fixtureOptions);
  const validatedSemanticGraphs = Object.freeze([sourceSpecific.validatedSemanticGraph]);
  const contract = contractBundle;
  const expectedActiveCorrectionApplicationIds = Object.freeze([]);
  const correctionMaterialisations = Object.freeze([]);
  const members = [
    {
      projection_output: reviewed.projection,
      shared_row: reviewed.row,
      exact_detail: {
        package: reviewed.exactDetail,
        source: reviewed.source,
        source_admission: reviewed.sourceAdmission,
        components: reviewed.compositionComponents,
        relationship_targets: reviewed.representationComponents,
        excerpts: reviewed.exactDetailExcerpts,
      },
    },
    {
      projection_output: ioc.projection,
      shared_row: ioc.row,
      exact_detail: {
        package: ioc.detailPackage,
        source: ioc.agreementSource,
        source_admission: ioc.agreementAdmission,
        excerpt: ioc.excerpts.threshold,
        claim: ioc.thresholdClaim,
      },
    },
    {
      projection_output: materialContracts.projection,
      shared_row: materialContracts.row,
      exact_detail: {
        package: materialContracts.detailPackage,
        source: materialContracts.agreementSource,
        source_admission: materialContracts.agreementAdmission,
        excerpt: materialContracts.excerpts.criterion,
        claim: materialContracts.thresholdClaim,
      },
    },
    {
      projection_output: terminationFee.projection,
      shared_row: terminationFee.row,
      exact_detail: {
        package: terminationFee.detailPackage,
        source: terminationFee.agreementSource,
        source_admission: terminationFee.agreementAdmission,
        excerpt: terminationFee.excerpts.fee_amount,
        claim: terminationFee.feeClaim,
      },
    },
    ...noShop.rows.map((row, index) => {
      const claimRevisionId = row.canonical_result.components[0].claim_revision_id;
      const result = noShop.results.find((item) => item.claim.claim_revision_id === claimRevisionId);
      const excerpt = Object.values(noShop.excerpts).find(
        (item) => item.excerpt_id === result?.claim.evidence[0]?.excerpt_id,
      );
      if (!result || !excerpt) throw new TypeError('no-shop release member has no exact claim evidence');
      return {
        projection_output: result.projection,
        shared_row: row,
        exact_detail: {
          package: noShop.detailPackages[index],
          source: noShop.source,
          source_admission: noShop.sourceAdmission,
          excerpt,
          claim: result.claim,
        },
      };
    }),
  ];
  const release = buildFixtureCandidateRelease({
    contract_bundle: contract,
    serving_namespace_id: servingNamespaceId,
    corpus_release_id: corpusReleaseId,
    members,
    source_specific_members: [{
      shared_row: sourceSpecific.row,
      exact_detail: {
        package: sourceSpecific.exactDetail,
        source: sourceSpecific.source,
        source_admission: sourceSpecific.sourceAdmission,
        excerpts: Object.values(sourceSpecific.excerpts),
      },
    }],
    validated_semantic_graphs: validatedSemanticGraphs,
    expected_active_correction_application_ids: expectedActiveCorrectionApplicationIds,
    correction_materialisations: correctionMaterialisations,
    deal_directory_entries: [{
      application_deal_id: 'c34415ed-44f7-432f-8d7c-6464b0310239',
      governed_deal_key: 'deal:landos-abbvie',
    }],
  });
  return Object.freeze({
    contract,
    corpusReleaseId,
    servingNamespaceId,
    ioc,
    materialContracts,
    noShop,
    reviewed,
    terminationFee,
    sourceSpecific,
    members,
    sourceSpecificMembers: Object.freeze([{
      shared_row: sourceSpecific.row,
      exact_detail: {
        package: sourceSpecific.exactDetail,
        source: sourceSpecific.source,
        source_admission: sourceSpecific.sourceAdmission,
        excerpts: Object.values(sourceSpecific.excerpts),
      },
    }]),
    validatedSemanticGraphs,
    expectedActiveCorrectionApplicationIds,
    correctionMaterialisations,
    dealDirectoryEntries: Object.freeze([{
      application_deal_id: 'c34415ed-44f7-432f-8d7c-6464b0310239',
      governed_deal_key: 'deal:landos-abbvie',
    }]),
    release,
  });
}

module.exports = { buildLandosCandidateReleaseFixture };
