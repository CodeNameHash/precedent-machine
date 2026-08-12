'use strict';

const assert = require('node:assert/strict');
const { readFileSync, readdirSync } = require('node:fs');
const { resolve } = require('node:path');
const test = require('node:test');

const { canonicalJson, contentId, sha256Hex } = require('../lib/canonical-v2/canonical-bytes');
const { consolidateAnalysis } = require('../lib/canonical-v2/agreement-analysis-consolidation');

const ROOT = resolve(__dirname, '..');
const MIGRATION = resolve(ROOT, 'evidence/canonical-v2/stage-2y-structure-migration');

function json(path) {
  return JSON.parse(readFileSync(path));
}

function familyOrder() {
  return json(resolve(MIGRATION, 'receipts/stage-2y-structure-m5-preparation.json'))
    .family_order.map((entry) => entry.family_key);
}

function packetsFor(base, families) {
  return families.map((familyKey) => {
    const approved_role_schema = json(resolve(MIGRATION, 'control/family-role-schemas', `${familyKey}.json`));
    const shadow = json(resolve(MIGRATION, 'shadow/m5', familyKey, 'shadow.json'));
    const results = shadow.adapter_results.filter((entry) => entry.agreement_id === base.agreement_id);
    assert.ok(results.length <= 1);
    return { family_key: familyKey, approved_role_schema, adapter_result: results[0] || null };
  });
}

test('all 25 family receipts bind nine outputs and pass the M5 stop rules', () => {
  const families = familyOrder();
  assert.equal(families.length, 25);
  let claims = 0;
  let complete = 0;
  let missing = 0;
  for (const familyKey of families) {
    const receipt = json(resolve(MIGRATION, 'receipts', `stage-2y-structure-m5-${familyKey}.json`));
    assert.equal(receipt.family_key, familyKey);
    assert.equal(receipt.status, 'PASS');
    assert.equal(receipt.output_bindings.length, 9);
    assert.equal(receipt.metrics.unexpected_resolved_change_count, 0);
    assert.equal(receipt.metrics.open_world_delta, 0);
    assert.equal(receipt.effects.m6_outputs, 0);
    assert.equal(sha256Hex(canonicalJson(receipt.output_bindings)), receipt.output_set_digest);
    for (const binding of receipt.output_bindings) {
      const raw = readFileSync(resolve(ROOT, binding.path));
      assert.equal(raw.length, binding.byte_length);
      assert.equal(sha256Hex(raw), binding.sha256);
    }
    claims += receipt.metrics.current_claim_count;
    complete += receipt.metrics.complete_count;
    missing += receipt.metrics.missing_required_role_count;
  }
  assert.equal(claims, 1528);
  assert.equal(complete, 2);
  assert.equal(missing, 1526);
});

test('consolidation accounts for every claim once and preserves immutable M4 meaning', () => {
  const families = familyOrder();
  const basePaths = readdirSync(resolve(MIGRATION, 'shadow/m4'))
    .filter((name) => name.endsWith('.agreement-analysis.json'))
    .sort();
  let claims = 0;
  let complete = 0;
  let missing = 0;
  for (const name of basePaths) {
    const base = json(resolve(MIGRATION, 'shadow/m4', name));
    const consolidated = consolidateAnalysis(base, packetsFor(base, families));
    assert.equal(consolidated.schema_version, 'AGREEMENT_ANALYSIS/V1');
    assert.equal(consolidated.agreement_id, base.agreement_id);
    assert.equal(consolidated.m5_consolidation.base_analysis_id, base.agreement_analysis_id);
    assert.equal(consolidated.m5_consolidation.applied_family_results.length, 25);
    assert.equal(consolidated.m5_consolidation.current_product_effects, 0);
    assert.equal(consolidated.m5_consolidation.m6_started, false);
    assert.equal(Object.isFrozen(consolidated), true);
    assert.equal(consolidated.agreement_analysis_id, contentId('AGREEMENT_ANALYSIS/V1',
      Object.fromEntries(Object.entries(consolidated).filter(([key]) => key !== 'agreement_analysis_id'))));
    assert.equal(consolidated.claims.length, base.claims.length);
    const byId = new Map(consolidated.claims.map((claim) => [claim.analysis_claim_id, claim]));
    assert.equal(byId.size, base.claims.length);
    for (const before of base.claims) {
      const after = byId.get(before.analysis_claim_id);
      assert.ok(after);
      assert.equal(after.family, before.family);
      assert.equal(after.claim_definition_key, before.claim_definition_key);
      assert.equal(after.claim_occurrence_id, before.claim_occurrence_id);
      assert.equal(after.legacy_resolution_state, before.legacy_resolution_state);
      assert.equal(canonicalJson(after.legacy_claim_revision), canonicalJson(before.legacy_claim_revision));
      assert.equal(canonicalJson(after.stage_claim_revision_ids), canonicalJson(before.stage_claim_revision_ids));
      assert.equal(canonicalJson(after.evidence_edge_ids), canonicalJson(before.evidence_edge_ids));
      assert.equal(canonicalJson(after.dependency_edge_ids), canonicalJson(before.dependency_edge_ids));
      assert.equal(canonicalJson(after.source_node_occurrence_ids), canonicalJson(before.source_node_occurrence_ids));
      assert.ok(['COMPLETE', 'MISSING_REQUIRED_ROLE'].includes(after.proposition_validation_state));
      assert.equal(after.projection_eligibility, 'BLOCKED');
      assert.ok(after.required_role_schema_id);
    }
    for (const role of consolidated.roles) {
      assert.ok(byId.has(role.analysis_claim_id));
      assert.ok(role.provenance_ids.length > 0);
      assert.equal(role.validation_state, 'SATISFIED');
    }
    const provenanceIds = new Set(consolidated.role_provenance.map((entry) => entry.role_provenance_id));
    for (const role of consolidated.roles) {
      for (const id of role.provenance_ids) assert.ok(provenanceIds.has(id));
    }
    claims += consolidated.claims.length;
    complete += consolidated.counts.complete_claim_count;
    missing += consolidated.counts.missing_required_role_claim_count;
  }
  assert.equal(claims, 1528);
  assert.equal(complete, 2);
  assert.equal(missing, 1526);
});

test('Capitalisation stays parked and M6 outputs do not exist', () => {
  const capitalisation = json(resolve(MIGRATION, 'shadow/m5/CAPITALISATION/selector-state.json'));
  assert.equal(capitalisation.capitalisation_parked, true);
  assert.equal(capitalisation.product_import_authorised, false);
  assert.equal(capitalisation.serving_authorised, false);
  assert.equal(capitalisation.publication_authorised, false);
  assert.throws(() => readFileSync(resolve(MIGRATION, 'receipts/stage-2y-structure-m6-agreement-projection.json')));
});
