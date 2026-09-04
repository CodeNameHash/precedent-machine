'use strict';

const assert = require('node:assert/strict');
const { readFileSync } = require('node:fs');
const { test } = require('node:test');

const {
  canonicalJson,
  contentId,
  sha256Hex,
} = require('../lib/canonical-v2/canonical-bytes');
const {
  PROJECTION_EXECUTION_LANES,
  dispatchAgreementProjection,
  viewPolicyForLegacyV1,
} = require('../lib/canonical-v2/agreement-projection');

function legacyAnalysis() {
  return {
    schema_version: 'AGREEMENT_ANALYSIS/V1',
    agreement_analysis_id: 'legacy-analysis',
    agreement_id: 'legacy-agreement',
    m5_correction: {
      semantic_projection_collection: 'compound_propositions',
    },
    compound_propositions: [],
  };
}

function legacyViewPolicy() {
  return viewPolicyForLegacyV1(Array.from({ length: 25 }, (_, index) => ({
    family_key: `FAMILY_${String(index + 1).padStart(2, '0')}`,
    ordinal: index + 1,
  })));
}

function v2RouteFixture() {
  const schemaVersion = 'STAGE_2Y_M7_V2_VIEW_POLICY/V1';
  const unsigned = {
    labels: [],
    layouts: [],
    formatters: [],
    grouping_policy: {
      allowed: false,
      requires_exact_equivalence_signature: true,
    },
  };
  const viewPolicy = {
    schema_version: schemaVersion,
    view_policy_id: contentId(schemaVersion, unsigned),
    ...unsigned,
  };
  const bytes = Buffer.from(`${canonicalJson(viewPolicy)}\n`, 'utf8');
  const viewPolicyBinding = {
    path: 'evidence/canonical-v2/stage-2y-structure-migration/m7-v2-repair/policies/view-policy.json',
    schema_version: schemaVersion,
    record_id_field: 'view_policy_id',
    record_id: viewPolicy.view_policy_id,
    byte_length: bytes.length,
    sha256: sha256Hex(bytes),
    git_blob_oid: '0'.repeat(40),
  };
  return {
    analysis: {
      schema_version: 'AGREEMENT_ANALYSIS/V2',
      governance: { view_policy_binding: structuredClone(viewPolicyBinding) },
    },
    candidateRegistration: {
      schema_version: 'STAGE_2Y_M7_V2_CANDIDATE_REGISTRATION/V1',
      stage: 'M7_V2_REPAIR',
      lifecycle_state: 'CANDIDATE_PENDING_REVIEW',
      view_policy_binding: viewPolicyBinding,
    },
    viewPolicy,
  };
}

function dispatch({ analysis, candidateRegistration, executionLane, viewPolicy }) {
  return dispatchAgreementProjection({
    analysis,
    candidateRegistration,
    executionLane,
    viewPolicy,
  });
}

test('historical M6 and M7 V1 replay stays behind two exact dispatch lanes', () => {
  for (const executionLane of [
    PROJECTION_EXECUTION_LANES.M6_V1_HISTORICAL_REPLAY,
    PROJECTION_EXECUTION_LANES.M7_V1_HISTORICAL_REPLAY,
  ]) {
    const projection = dispatch({
      analysis: legacyAnalysis(),
      candidateRegistration: null,
      executionLane,
      viewPolicy: legacyViewPolicy(),
    });
    assert.equal(projection.schema_version, 'AGREEMENT_PROJECTION/V1');
  }
});

test('registered M7 V2 repair dispatch reaches only the V2 projector', () => {
  const fixture = v2RouteFixture();
  assert.throws(
    () => dispatch({
      ...fixture,
      executionLane: PROJECTION_EXECUTION_LANES.M7_V2_REPAIR_REGISTERED_CANDIDATE,
    }),
    (error) => {
      assert.match(error.code, /^M7_V2_/u);
      assert.doesNotMatch(error.message, /AGREEMENT_PROJECTION_ANALYSIS/u);
      return true;
    },
  );
});

test('projection dispatch fails closed for unknown lanes, cross-schema calls and unbound V2 policy', () => {
  const v2 = v2RouteFixture();
  const cases = [
    {
      analysis: legacyAnalysis(),
      candidateRegistration: null,
      executionLane: 'M7_V2_REPAIR',
      viewPolicy: legacyViewPolicy(),
    },
    {
      analysis: v2.analysis,
      candidateRegistration: null,
      executionLane: PROJECTION_EXECUTION_LANES.M7_V1_HISTORICAL_REPLAY,
      viewPolicy: v2.viewPolicy,
    },
    {
      analysis: legacyAnalysis(),
      candidateRegistration: v2.candidateRegistration,
      executionLane: PROJECTION_EXECUTION_LANES.M7_V2_REPAIR_REGISTERED_CANDIDATE,
      viewPolicy: legacyViewPolicy(),
    },
    {
      ...v2,
      candidateRegistration: {
        ...v2.candidateRegistration,
        view_policy_binding: {
          ...v2.candidateRegistration.view_policy_binding,
          sha256: 'f'.repeat(64),
        },
      },
      executionLane: PROJECTION_EXECUTION_LANES.M7_V2_REPAIR_REGISTERED_CANDIDATE,
    },
  ];
  for (const value of cases) {
    assert.throws(() => dispatch(value), (error) => {
      assert.match(error.code, /^PROJECTION_DISPATCH_/u);
      return true;
    });
  }
});

test('historical runners delegate projection and contain no direct legacy call', () => {
  for (const path of [
    'scripts/stage-2y-structure-m6-project.mjs',
    'scripts/stage-2y-structure-generalisation-shadow.mjs',
  ]) {
    const source = readFileSync(path, 'utf8');
    assert.match(source, /dispatchAgreementProjection/u, path);
    assert.match(source, /PROJECTION_EXECUTION_LANES/u, path);
    assert.doesNotMatch(source, /projectLegacyAgreementV1\s*\(/u, path);
  }
});
