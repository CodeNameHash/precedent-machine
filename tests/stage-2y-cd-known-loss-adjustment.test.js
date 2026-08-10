const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { spawnSync } = require('node:child_process');
const test = require('node:test');

const ROOT = path.resolve(__dirname, '..');
const SCRIPT = path.join(ROOT, 'scripts/stage-2y-cd-known-loss-adjustment.mjs');
const ARTEFACT = path.join(ROOT, 'evidence/canonical-v2/stage-2y-cd-known-loss-adjustment.json');
const SKECHERS_FIXED_CLAIM_ID = '9d47df05490185fbf8094acfe34c8c193addc2fe5a8a788487e77424cdd341fb';
const EXPECTED_NO_SHOP_ACTION_IDS = [
  '23e9cd65e08efd1a635d4055fd29f2cb96fdc4ff12c0c166d36ca668c9a94656',
  'f7f5c28e450fe350f8d27d112ed43171767385435f4b9159bd610270502a06e5',
  'd42f7c8d0d1d10050e309939dc1fd7ef9a94a8e2c0a4b15033ed49bb63db0ee6',
  '06275a894dccf3d576d4272d39d7b342b71aa593094c6a79df24999d9a0f57ba',
  '43c2095d1a8dc373613823d65cfa5df48b8412c303aa557c4004c1ae114a4506',
  '5eaa99ef253f27df440552f60536270dfd8af6e8cf17820ca34d496180ad7cc5',
  'ccb69dbc5e2ea739029991e22b291b89b40bf0b4d9c0375e5edd5b0f29594828',
  'f3f9024c9236f0f77daf3002d0a86038a51fc11847c70d9da09a67ba34f365f0',
  '0a026b0560a99c4b3312033de4094a0d1006e6f5fd15fc89273d593c067e5f6d',
  '0e44f11e38b9aa3d6e0e06604535378e8e6af70d372c60646f30197332f7140f',
  '501dacf6ccfa3ec13c97e5166414826355f5023a4e675d14eca0094b784014c0',
  '7da53067ca2ba4f7c4332cfc4216f00a73d1057dddabdda107363dfa5e9b66b3',
  '97563bb16df136b7633270e85d831cdb107d41dbf28f630cf924a36565c66d44',
  'a75a1c486454186a3214b11e1a21091363c7bf7fc54ddf5457c74acf0e56f0e6',
  '2b781ede9d2bd2ba7787f466c80518d932897373da11b64cac2af76e54b18ba1',
  '2cee0b070ed05885a9a6e7a09ccc3d088f81586088fae70d7426dcfc0e9acf03',
  'a1b53fe22adc63177914f8f5243745530f10daa2d0a9d52f5b3a3ebc07c76aef',
  '47024cf1d5da26a92d5f106c64a52128452cd79199bbf0f35e72d3106986ba43',
  '61d1edfc768e412139ac51132ae9446b32620efe70d1bfe69e976b80dc20d0da',
  '88b60ba2683ccdc0d86a5665a290eeb4bae696cf87bef055639333f8628b16b3',
  'f0a9f5ee37c3b7b3f2a8015c503eccc5b574b10cec493972d3ac54c5a35d253c',
].sort();
const EXPECTED_OVERLAP_IDS = [
  'f7f5c28e450fe350f8d27d112ed43171767385435f4b9159bd610270502a06e5',
  '47024cf1d5da26a92d5f106c64a52128452cd79199bbf0f35e72d3106986ba43',
  '61d1edfc768e412139ac51132ae9446b32620efe70d1bfe69e976b80dc20d0da',
  '88b60ba2683ccdc0d86a5665a290eeb4bae696cf87bef055639333f8628b16b3',
  'f0a9f5ee37c3b7b3f2a8015c503eccc5b574b10cec493972d3ac54c5a35d253c',
].sort();

test('the committed artefact recomputes the exact known-loss intersection', async () => {
  const { recompute } = await import(SCRIPT);
  const actual = recompute();
  const committed = JSON.parse(fs.readFileSync(ARTEFACT, 'utf8'));

  assert.deepEqual(committed, actual);
  assert.equal(actual.label, 'KNOWN_LOSS_ADJUSTED_NOT_HUMAN_ACCEPTED');
  assert.equal(actual.authority.human_acceptance, false);
  assert.equal(actual.authority.human_accepted_rows, null);
  assert.equal(actual.summary.human_acceptance_status, 'NOT_MEASURED');
  assert.deepEqual(actual.rule_counts, {
    identified: {
      DNO: 25,
      NO_SHOP: 75,
      NO_OTHER_REPS_FRAUD: 36,
      MAE_DEFINITION: 108,
    },
    rendered_deductions: {
      DNO: 25,
      NO_SHOP: 75,
      NO_OTHER_REPS_FRAUD: 36,
      MAE_DEFINITION: 8,
    },
  });
  assert.deepEqual(actual.reason_counts, {
    DNO_SPECIFIC_MECHANIC_NOT_RENDERED: 25,
    NO_SHOP_ACTION_CODE_ABSENT_FROM_COMPOSITE_LABEL: 21,
    NO_SHOP_BUYER_PARTY_NOT_RENDERED: 59,
    NO_OTHER_REPS_FRAUD_PARTY_NOT_RENDERED: 36,
    MAE_DEFINITION_PARTY_NOT_RENDERED: 108,
  });
  assert.deepEqual(actual.summary, {
    mechanical_content_rows: 1241,
    identified_known_loss_claims: 244,
    rendered_known_loss_deduction_rows: 144,
    known_loss_claims_already_not_rendered: 100,
    known_loss_adjusted_rows: 1097,
    resolved_claim_denominator: 1526,
    known_loss_adjusted_rate: 1097 / 1526,
    known_loss_adjusted_percent_1dp: 71.9,
    human_acceptance_status: 'NOT_MEASURED',
  });
  assert.equal(actual.affected_claim_count, 244);
  assert.equal(actual.rendered_deduction_claim_count, 144);
  assert.equal(actual.not_rendered_known_loss_claim_count, 100);
  assert.equal(new Set(actual.rendered_deduction_claim_revision_ids).size, 144);
  assert.equal(new Set(actual.not_rendered_known_loss_claim_revision_ids).size, 100);
  assert.equal(actual.rendered_deduction_claim_revision_ids
    .some((claimId) => actual.not_rendered_known_loss_claim_revision_ids.includes(claimId)), false);
  assert.equal(new Set(actual.affected_claims.map((claim) => claim.claim_revision_id)).size, 244);
  assert.ok(actual.affected_claims.every((claim) => claim.reason_codes.length > 0));
  assert.equal(actual.affected_claims.some((claim) => claim.claim_revision_id === SKECHERS_FIXED_CLAIM_ID), false);
  assert.equal(actual.non_deduction_checks[0].claim_revision_id, SKECHERS_FIXED_CLAIM_ID);
});

test('the No Shop action selector preserves the exact historical 21 claims and five-row overlap', async () => {
  const { recompute } = await import(SCRIPT);
  const actual = recompute();
  const actionIds = actual.supporting_group_evidence.no_shop_collapsed_action_claims
    .map((claim) => claim.claim_revision_id)
    .sort();
  assert.deepEqual(actionIds, EXPECTED_NO_SHOP_ACTION_IDS);
  assert.deepEqual(actual.overlaps.no_shop_action_and_buyer_party, {
    count: 5,
    claim_revision_ids: EXPECTED_OVERLAP_IDS,
  });
});

test('check mode fails when a saved artefact does not match current measurement inputs', () => {
  const temporaryDirectory = fs.mkdtempSync(path.join(os.tmpdir(), 'stage-2y-cd-known-loss-'));
  const stalePath = path.join(temporaryDirectory, 'stale.json');
  const stale = JSON.parse(fs.readFileSync(ARTEFACT, 'utf8'));
  stale.summary.known_loss_adjusted_rows -= 1;
  fs.writeFileSync(stalePath, `${JSON.stringify(stale)}\n`);
  try {
    const result = spawnSync(process.execPath, [SCRIPT, '--check', stalePath], {
      cwd: ROOT,
      encoding: 'utf8',
    });
    assert.notEqual(result.status, 0);
    assert.match(result.stderr, /STALE_KNOWN_LOSS_ADJUSTMENT/);
  } finally {
    fs.rmSync(temporaryDirectory, { recursive: true });
  }
});
