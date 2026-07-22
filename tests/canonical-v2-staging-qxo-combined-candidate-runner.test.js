const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');

const RUNNER = 'scripts/canonical-v2-staging-qxo-combined-candidate.mjs';

test('combined QXO candidate runner reads each exact semantic closure and never activates them', () => {
  const source = fs.readFileSync(RUNNER, 'utf8');
  assert.match(source, /CAPITALISATION_CLOSURE_ID/);
  assert.match(source, /NO_SHOP_CLOSURE_ID/);
  assert.match(source, /ACTIONS_CLOSURE_ID/);
  assert.match(source, /assertFamilyParity/);
  assert.match(source, /active_pointer_unchanged: true/);
  assert.doesNotMatch(source, /activateCandidateRelease|canonical_v2_activate/);
  assert.doesNotMatch(source, /production/i);
});

test('combined QXO candidate identities and release counts are pinned', () => {
  const source = fs.readFileSync(RUNNER, 'utf8');
  assert.match(source, /fa2aa0154c5f0024b088fc5fcf7281adb56cbac12d0d48438fefa1765b83dd36/);
  assert.match(source, /620bcbba3b072f1a475989adad9e4ce708b4fce288fa59036e549dc82544b48d/);
  assert.match(source, /cb2d9e9db4e059b28d29f60012d25efec77b3eda2d33cf9911c434bcbb667b44/);
  assert.match(source, /91cdee1d2cca11fdaa7141069c3daf9d048deabdbe36573bb214cafc7cf34430/);
  assert.match(source, /db29af6e548def369bee9c2fbe2be16959078f9461746caa1854f4eeceaea43c/);
  assert.match(source, /3ab6ca118c32bad5d5e9ce662a7c3f7cc06cddda03b7c717cccd6ed9dfa10a65/);
  assert.match(source, /d9157984ee4948046c3cf7d3195cb0136502cdf739fc24dfd05d0ae7c60f1f5a/);
  assert.match(source, /a9cbb8810053d13ad76efcffc769ddf83ed22d1cb446493967f281489182d0b2/);
  assert.match(source, /efa8f7c2643448ad9380a4a16556d76f09879809c1d21e49f479e8cf070f204d/);
  assert.match(source, /capitalisationServing\.candidate_release_members/);
  assert.match(source, /noShopServing\.candidate_release_members/);
  assert.match(source, /actionsServing\?\.candidate_release_members/);
  assert.match(source, /release\.market_observations\.length/);
  assert.match(source, /release\.market_exclusions\.length/);
  assert.match(source, /release\.exact_detail_packages\.length/);
});

test('combined QXO rematch candidate extends the action release without mutating it', () => {
  const source = fs.readFileSync(RUNNER, 'utf8');
  assert.match(source, /--rematch-dry-run/);
  assert.match(source, /--rematch-import/);
  assert.match(source, /--rematch-verify/);
  assert.match(source, /--rematch-rehearse-rollback/);
  assert.match(source, /assertFamilyParity\(\{ graph: graph\.rematch/);
  assert.match(source, /buildQxoNoShopRematchServingSlice/);
  assert.match(source, /rematchServing\?\.candidate_release_members/);
});

test('combined QXO material candidate closes over both admitted sources and the exact incomplete semantic graph', () => {
  const source = fs.readFileSync(RUNNER, 'utf8');
  assert.match(source, /QXO_MATERIAL_SOURCE_ADMISSION_MANIFEST_IDS/);
  assert.match(source, /DEAL_VALUE_SOURCE_ADMISSION_ID/);
  assert.match(source, /deal_value_source/);
  assert.match(source, /source_ordinal: 1/);
  assert.match(source, /MATERIAL_CLOSURE_ID/);
  assert.match(source, /assertMaterialParity/);
  assert.match(source, /open_world_candidate_occurrences/);
  assert.match(source, /open_world_candidate_dispositions/);
  assert.match(source, /semantic_impact_closures/);
  assert.match(source, /incomplete_canonical_result_rows/);
  assert.match(source, /QXO_MATERIAL_CONTRACTS_DEAL_SCOPE_V1/);
});

test('combined QXO material mode imports the governed seed and keeps its incomplete result out of market query authority', () => {
  const source = fs.readFileSync(RUNNER, 'utf8');
  assert.match(source, /buildQxoMaterialCombinedCandidateSeedV2/);
  assert.match(source, /qxoMaterialCombinedCandidateReleaseId/);
  assert.match(source, /PROVISIONAL_CORPUS_RELEASE_ID/);
  assert.match(source, /QXO_MATERIAL_CORPUS_RELEASE_SEED_DIGEST_V2/);
  assert.match(source, /QXO_MATERIAL_CORPUS_RELEASE_ID_V2/);
  assert.match(source, /65d5afe597f48fa095176e941803fabeafc71922195b120a3d05bfc50f9276f1/);
  assert.match(source, /bd6715c4a8f0a75194b568fef10ee118fb63612e82b2ad90da0d0e0ef985bb9b/);
  assert.match(source, /437f3b439417ded9691c061880f7325dff3a7e85d2b71870f12cd7d7aadbcb34/);
  assert.match(source, /serving_projection_binding/);
  assert.match(source, /SERVING_PROJECTION_VERSION_V2/);
  assert.match(source, /QUERY_PROJECTION_CONTRACT_DIGEST_V2/);
  assert.match(source, /legacy_material_release_records/);
  assert.match(source, /materialSlice\.candidate_release_member/);
  assert.match(source, /release\.market_observations\.length !== 8/);
  assert.match(source, /release\.market_exclusions\.length !== 2/);
  assert.match(source, /release\.shared_rows\.length !== 9/);
  assert.match(source, /release\.incomplete_canonical_rows\?\.length !== 1/);
  assert.match(source, /release\.query_records\.length !== 8/);
  assert.match(source, /release\.exact_detail_packages\.length !== 9/);
  assert.match(source, /material_market_observations/);
  assert.match(source, /material_market_exclusions/);
  assert.match(source, /material_query_records/);
  assert.match(source, /selected_deal_shared_rows/);
  assert.doesNotMatch(source, /MATERIAL_INCOMPLETE_ROW_SERVING_KEY = null/);
});

test('combined QXO material mode supports rollback-first inactive release lifecycle without activation', () => {
  const source = fs.readFileSync(RUNNER, 'utf8');
  assert.match(source, /--material-dry-run/);
  assert.match(source, /--material-import/);
  assert.match(source, /--material-verify/);
  assert.match(source, /--material-rehearse-rollback/);
  assert.match(source, /QXO_MATERIAL_COMBINED_CANDIDATE_STAGING_ATTESTATION\/V1/);
  assert.match(source, /The combined candidate identities must be pinned before staging mutation/);
  assert.match(source, /active_pointer_unchanged: true/);
  assert.doesNotMatch(source, /activateCandidateRelease|canonical_v2_activate/);
});

test('combined QXO action candidate is an explicit inactive mode with pinned graph parity', () => {
  const source = fs.readFileSync(RUNNER, 'utf8');
  assert.match(source, /--actions-dry-run/);
  assert.match(source, /--actions-import/);
  assert.match(source, /--actions-verify/);
  assert.match(source, /--actions-rehearse-rollback/);
  assert.match(source, /assertFamilyParity\(\{ graph: graph\.actions/);
  assert.match(source, /buildQxoNoShopActionsServingSlice/);
});

test('combined QXO candidate import is rollback-first and has exact inactive rollback', () => {
  const source = fs.readFileSync(RUNNER, 'utf8');
  assert.match(source, /RECHECK_AUTHORITY_FOR_ROLLBACK/);
  assert.match(source, /ROLLBACK_IMPORT/);
  assert.match(source, /Rollback-first QXO combined candidate import changed staging state/);
  assert.match(source, /canonical_v2_rollback_inactive_candidate_release/);
  assert.match(source, /ROLLED_BACK_AND_REIMPORTED/);
  assert.doesNotMatch(source, /UPDATE canonical_v2_staging|DELETE FROM canonical_v2_staging/);
});
