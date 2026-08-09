'use strict';

/**
 * tests/canonical-v2-open-world-promotion-gate.test.js
 *
 * Step 2X-G: promotion gate is deal recurrence (3–4), confidence, and
 * fail-closed collision — never a percentage. Also pins the landed
 * REQUEST_RETURN ungate by replaying committed skywater no-shop evidence.
 */

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const {
  MIN_PROMOTION_DEAL_COUNT,
  PREFERRED_PROMOTION_DEAL_COUNT,
  HOLD_SCAFFOLD_MODULES,
  CONFIDENCE,
  evaluatePromotionGate,
  checkPromotionCollision,
  loadStep2xJConsumeVocabularies,
} = require('../lib/canonical-v2/open-world-promotion-gate');
const {
  noShopWaveBValueCorroborated,
  resolveCandidates,
} = require('../lib/canonical-v2/native-producer/candidate-resolution');
const { compileFixtureContractV41 } = require('../lib/canonical-v2/contract-bundle');
// expected-sets must stay free of the gate module: the review page imports it.
const expectedSets = require('../lib/expected-sets');

const EVIDENCE_ROOT = path.join(__dirname, '..', 'evidence', 'canonical-v2');

test('2X-G deal-count gate lives beside expected-sets, not inside it', () => {
  assert.equal(MIN_PROMOTION_DEAL_COUNT, 3);
  assert.equal(PREFERRED_PROMOTION_DEAL_COUNT, 4);
  assert.ok(HOLD_SCAFFOLD_MODULES.includes('lib/vocab/guaranty-assertion-legacy.js'));
  assert.ok(HOLD_SCAFFOLD_MODULES.includes('lib/vocab/tax-cooperation-legacy.js'));
  assert.ok(HOLD_SCAFFOLD_MODULES.includes('lib/vocab/general-covenant-rubric-presentation.js'));
  assert.equal(typeof expectedSets.evaluatePromotionGate, 'undefined');
  assert.equal(typeof expectedSets.CORE_THRESHOLD, 'number');
});

test('gate refuses below three deals even at 100% of a tiny corpus', () => {
  const gate = evaluatePromotionGate({
    deal_ids: ['modiv', 'topbuild'],
    quotes_by_deal: {
      modiv: ['request return or destroy'],
      topbuild: ['instruct to return or destroy'],
    },
    identity_keys: ['NO_SHOP_RUBRIC_OPEN_WORLD::REQUEST_RETURN'],
    target_governed_concept_key: 'NOSOL-CEASE',
    target_claim_definition_key: 'NO_SHOP_CEASE_ACTION',
  });
  assert.equal(gate.ok, false);
  assert.ok(gate.refusals.includes('BELOW_MIN_DEAL_RECURRENCE'));
  // Two of two is 100% — still refuse. Percentages are not the instrument.
  assert.equal(gate.deal_count, 2);
});

test('gate passes at three deals with quotes and a registered target', () => {
  const gate = evaluatePromotionGate({
    deal_ids: ['modiv', 'topbuild', 'skywater'],
    quotes_by_deal: {
      modiv: ['request return or destroy'],
      topbuild: ['instruct to return or destroy'],
      skywater: ['request each Person to return or destroy'],
    },
    identity_keys: ['NO_SHOP_RUBRIC_OPEN_WORLD::REQUEST_RETURN_OR_DESTRUCTION_OF_INFORMATION'],
    target_governed_concept_key: 'NOSOL-CEASE',
    target_claim_definition_key: 'NO_SHOP_CEASE_ACTION',
    promotion_mechanism: 'lib/canonical-v2/native-producer/candidate-resolution.js',
  });
  assert.equal(gate.ok, true);
  assert.equal(gate.confidence.level, CONFIDENCE.MEDIUM);
  assert.deepEqual(gate.refusals, []);
});

test('gate fail-closed on 2X-B HOLD scaffolds', () => {
  const collision = checkPromotionCollision({
    target_governed_concept_key: 'COV-TAKEOVER',
    promotion_mechanism: 'lib/vocab/general-covenant-rubric-presentation.js',
  });
  assert.equal(collision.ok, false);
  assert.equal(collision.reason, 'HOLD_SCAFFOLD_MECHANISM');
});

test('gate fail-closed when a new vocabulary name collides with 2X-J CONSUME', () => {
  const loaded = loadStep2xJConsumeVocabularies();
  assert.equal(loaded.ok, true);
  assert.ok(loaded.consume.has('TERMF_TRIGGER_META'));
  const collision = checkPromotionCollision({
    proposed_vocabulary_name: 'TERMF_TRIGGER_META',
    // No target — this would be minting a duplicate vocabulary.
    consume_vocabularies: loaded.consume,
  });
  assert.equal(collision.ok, false);
  assert.equal(collision.reason, 'COLLIDES_WITH_2X_J_CONSUME');
});

test('REQUEST_RETURN corroboration accepts request, instruct, and bare return/destroy', () => {
  assert.equal(
    noShopWaveBValueCorroborated(
      'CEASE_ACTION',
      'REQUEST_RETURN_OR_DESTRUCTION_OF_INFORMATION',
      'request each Person to promptly return or destroy all non-public information',
    ),
    true,
  );
  assert.equal(
    noShopWaveBValueCorroborated(
      'CEASE_ACTION',
      'REQUEST_RETURN_OR_DESTRUCTION_OF_INFORMATION',
      'instruct any Person to return or destroy all such information',
    ),
    true,
  );
  assert.equal(
    noShopWaveBValueCorroborated(
      'CEASE_ACTION',
      'REQUEST_RETURN_OR_DESTRUCTION_OF_INFORMATION',
      'return (or destroy, to the extent permitted) all confidential information furnished',
    ),
    true,
  );
  assert.equal(
    noShopWaveBValueCorroborated(
      'CEASE_ACTION',
      'REQUEST_RETURN_OR_DESTRUCTION_OF_INFORMATION',
      'instruct the Representatives to cease discussions',
    ),
    false,
  );
});

test('skywater no-shop replay: REQUEST_RETURN leaves open_world and resolves under NOSOL-CEASE', () => {
  const dir = path.join(EVIDENCE_ROOT, 'skywater-no-shop-20260808-r1');
  const before = JSON.parse(fs.readFileSync(path.join(dir, 'resolution.json'), 'utf8'));
  const runReceipt = JSON.parse(fs.readFileSync(path.join(dir, 'run-receipt.json'), 'utf8'));
  const adapter = JSON.parse(fs.readFileSync(path.join(dir, 'adapter-result.json'), 'utf8'));

  const beforeRubric = before.open_world.filter((e) => e.reason === 'NO_SHOP_RUBRIC_OPEN_WORLD');
  assert.equal(beforeRubric.length, 1, 'committed evidence still pins one REQUEST_RETURN open-world row');

  const after = resolveCandidates({
    run_receipt: runReceipt,
    contract_vocabulary: compileFixtureContractV41(),
    admitted_source_context: adapter.admitted_source_contexts[0],
  });

  const afterRubric = after.open_world.filter((e) => e.reason === 'NO_SHOP_RUBRIC_OPEN_WORLD');
  assert.equal(afterRubric.length, 0, 'promoted shape must not remain NO_SHOP_RUBRIC_OPEN_WORLD');
  assert.equal(
    after.open_world.length,
    before.open_world.length - 1,
    `open_world ${before.open_world.length} -> ${before.open_world.length - 1}`,
  );

  const resolvedReturn = after.resolved.filter(
    (e) => e.claim?.canonical_value === 'REQUEST_RETURN_OR_DESTRUCTION_OF_INFORMATION',
  );
  assert.equal(resolvedReturn.length, 1);
  assert.equal(resolvedReturn[0].resolved_claim_definition_key, 'NO_SHOP_CEASE_ACTION');
  assert.equal(resolvedReturn[0].concept_key, 'NOSOL-CEASE');
  assert.match(resolvedReturn[0].claim.raw_value, /return/i);
  assert.match(resolvedReturn[0].claim.raw_value, /destroy/i);
});
