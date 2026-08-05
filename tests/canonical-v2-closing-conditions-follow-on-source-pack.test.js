'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { sha256Hex } = require('../lib/canonical-v2/canonical-bytes');
const {
  GROUNDED_REPOSITORY_PRODUCTION_SNAPSHOT,
  APPROVED_RETIRED_OPEN_WORLD,
  STABLE_GROUNDED_SHAPE_AND_SEPARATE_APPROVAL,
  buildClosingConditionsFollowOnSourcePack,
  recommendedDissentThresholdDisposition,
  verifyClosingConditionsFollowOnSourcePack,
} = require('../lib/canonical-v2/closing-conditions-follow-on-source-pack');

const SNAPSHOT = path.join(__dirname, '..', 'docs', 'schema-shape', 'normalized-v1.json');

test('Closing Conditions follow-on source pack grounds certificate references and retires dissent thresholds to open world', () => {
  const bytes = fs.readFileSync(SNAPSHOT);
  const pack = buildClosingConditionsFollowOnSourcePack(JSON.parse(bytes.toString('utf8')));
  assert.equal(sha256Hex(bytes), 'df62de96cb844320a1d5916130095847fba8034646768c6f7d94f55e09476c68');
  assert.equal(verifyClosingConditionsFollowOnSourcePack(pack), true);
  assert.equal(pack.dispositions.CERTIFICATE_TARGET_RELATIONSHIP, GROUNDED_REPOSITORY_PRODUCTION_SNAPSHOT);
  assert.equal(pack.dispositions.DISSENT_THRESHOLD, APPROVED_RETIRED_OPEN_WORLD);
  assert.equal(recommendedDissentThresholdDisposition(pack), APPROVED_RETIRED_OPEN_WORLD);
  assert.equal(pack.dissent_threshold_reintroduction_requirement, STABLE_GROUNDED_SHAPE_AND_SEPARATE_APPROVAL);
  assert.ok(pack.certificate_target_relationship_sources.length > 0);
  for (const source of pack.certificate_target_relationship_sources) {
    assert.equal(source.provision_subtype, 'COND-B-CERT');
    assert.ok(source.certified_condition_refs.length > 0);
    assert.equal(sha256Hex(Buffer.from(source.primary_quote, 'utf8')), source.primary_quote_sha256);
  }
  assert.deepEqual(pack.dissent_threshold_sources, []);
});
