const test = require('node:test');
const assert = require('node:assert/strict');

const { buildLandosNoShopServingFixture } = require('../__fixtures__/canonical-v2/landos-no-shop-rows');
const { contentId } = require('../lib/canonical-v2/canonical-bytes');
const {
  buildCandidateInputHead,
  buildCorrectionDischargeMap,
  selectTrustedCandidateInputs,
} = require('../lib/canonical-v2/candidate-input-authority');
const {
  buildFixtureCandidateRelease,
  validateCandidateReleaseBundle,
} = require('../lib/canonical-v2/candidate-release');
const { compileFixtureContract } = require('../lib/canonical-v2/contract-bundle');

const contract = compileFixtureContract();
const corpusReleaseId = contentId('CORPUS_RELEASE/V1', 'authority-bound-candidate-release');
const servingNamespaceId = contentId('SERVING_NAMESPACE/V1', 'authority-bound-candidate-release');

async function emptyAuthoritySelection() {
  const map = buildCorrectionDischargeMap({
    contract_bundle: contract,
    correction_materialisations: [],
  });
  const head = buildCandidateInputHead({
    generation: 11,
    correction_discharge_map: map,
  });
  return selectTrustedCandidateInputs({
    client: { rpc: () => ({ data: {
      captured_candidate_input_head: head,
      correction_discharge_map: map,
      ordered_materialisations: [],
    }, error: null }) },
    contract_bundle: contract,
  });
}

function releaseInputs(authoritySelection) {
  const fixture = buildLandosNoShopServingFixture({
    contractBundle: contract,
    corpusReleaseId,
  });
  const excerptsById = new Map(Object.values(fixture.excerpts).map((excerpt) => [excerpt.excerpt_id, excerpt]));
  const members = fixture.rows.map((row, index) => {
    const claimRevisionId = row.canonical_result.components[0].claim_revision_id;
    const result = fixture.results.find((item) => item.claim.claim_revision_id === claimRevisionId);
    return {
      projection_output: result.projection,
      shared_row: row,
      exact_detail: {
        package: fixture.detailPackages[index],
        source: fixture.source,
        source_admission: fixture.sourceAdmission,
        excerpt: excerptsById.get(result.claim.evidence[0].excerpt_id),
        claim: result.claim,
      },
    };
  });
  return {
    contract_bundle: contract,
    serving_namespace_id: servingNamespaceId,
    corpus_release_id: corpusReleaseId,
    members,
    correction_authority_selection: authoritySelection,
    deal_directory_entries: [{
      application_deal_id: 'c34415ed-44f7-432f-8d7c-6464b0310239',
      governed_deal_key: 'deal:landos-abbvie',
    }],
  };
}

test('candidate release construction requires authority selection and emits Seal V2', async () => {
  const authoritySelection = await emptyAuthoritySelection();
  const release = buildFixtureCandidateRelease(releaseInputs(authoritySelection));

  assert.equal(validateCandidateReleaseBundle(release), true);
  assert.equal(release.candidate_correction_input_seal.schema_version, 'CANDIDATE_CORRECTION_INPUT_SEAL/V2');
  assert.equal(
    release.candidate_correction_input_seal.candidate_input_head_id,
    authoritySelection.candidate_input_head.candidate_input_head_id,
  );
  assert.equal(
    release.candidate_correction_input_seal.correction_discharge_map_id,
    authoritySelection.correction_discharge_map.correction_discharge_map_id,
  );
  assert.equal(release.manifest.counts.correction_applications, 0);
  assert.equal(release.manifest.counts.correction_discharges, 0);
});

test('naked active correction IDs and caller materialisations are rejected as authority', async () => {
  const authoritySelection = await emptyAuthoritySelection();
  const inputs = releaseInputs(authoritySelection);
  delete inputs.correction_authority_selection;
  inputs.expected_active_correction_application_ids = [];
  assert.throws(
    () => buildFixtureCandidateRelease(inputs),
    /naked correction IDs or materialisations are not authoritative/,
  );

  const mixedInputs = releaseInputs(authoritySelection);
  mixedInputs.correction_materialisations = [];
  assert.throws(
    () => buildFixtureCandidateRelease(mixedInputs),
    /naked correction IDs or materialisations are not authoritative/,
  );
});

test('candidate release validation rejects drift in every Seal V2 authority binding', async () => {
  const release = buildFixtureCandidateRelease(releaseInputs(await emptyAuthoritySelection()));
  for (const field of [
    'candidate_input_head_id',
    'candidate_input_head_payload_digest',
    'correction_discharge_map_id',
    'correction_discharge_map_payload_digest',
  ]) {
    const tampered = structuredClone(release);
    tampered.candidate_correction_input_seal[field] = 'f'.repeat(64);
    assert.throws(() => validateCandidateReleaseBundle(tampered), /Seal V2 identity|correction input seal/i);
  }
});
