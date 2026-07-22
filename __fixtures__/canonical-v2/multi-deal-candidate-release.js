const { buildLandosCandidateReleaseFixture } = require('./landos-candidate-release');
const { buildQxoNoShopReleaseFixture } = require('./qxo-no-shop-release');
const { contentId } = require('../../lib/canonical-v2/canonical-bytes');
const { buildFixtureCandidateRelease } = require('../../lib/canonical-v2/candidate-release');
const { compileFixtureContract } = require('../../lib/canonical-v2/contract-bundle');

const APPLICATION_DEALS = Object.freeze({
  LANDOS: 'c34415ed-44f7-432f-8d7c-6464b0310239',
  QXO: '7dc3a05f-b170-4d59-a255-b7103cca16e1',
});

function buildMultiDealCandidateReleaseFixture() {
  const contract = compileFixtureContract();
  const corpusReleaseId = contentId('CORPUS_RELEASE/V1', 'qxo-landos-shared-fixture-candidate-contract-v2');
  const servingNamespaceId = contentId('SERVING_NAMESPACE/V1', 'qxo-landos-shared-fixture');
  const fixtureOptions = { contractBundle: contract, corpusReleaseId, servingNamespaceId };
  const landos = buildLandosCandidateReleaseFixture(fixtureOptions);
  const qxo = buildQxoNoShopReleaseFixture(fixtureOptions);
  const members = Object.freeze([...landos.members, ...qxo.members]);
  const sourceSpecificMembers = Object.freeze([
    ...landos.sourceSpecificMembers,
    ...qxo.sourceSpecificMembers,
  ]);
  const dealDirectoryEntries = Object.freeze([
    ...landos.dealDirectoryEntries,
    ...qxo.dealDirectoryEntries,
  ]);
  const validatedSemanticGraphs = Object.freeze([
    ...landos.validatedSemanticGraphs,
  ]);

  if (members.length !== 14 || sourceSpecificMembers.length !== 1 || dealDirectoryEntries.length !== 2) {
    throw new TypeError('multi-deal fixture inventory has drifted outside its bounded contract');
  }

  const release = buildFixtureCandidateRelease({
    contract_bundle: contract,
    serving_namespace_id: servingNamespaceId,
    corpus_release_id: corpusReleaseId,
    members,
    source_specific_members: sourceSpecificMembers,
    validated_semantic_graphs: validatedSemanticGraphs,
    deal_directory_entries: dealDirectoryEntries,
  });

  return Object.freeze({
    contract,
    corpusReleaseId,
    servingNamespaceId,
    landos,
    qxo,
    members,
    sourceSpecificMembers,
    validatedSemanticGraphs,
    dealDirectoryEntries,
    release,
  });
}

module.exports = {
  APPLICATION_DEALS,
  buildMultiDealCandidateReleaseFixture,
};
