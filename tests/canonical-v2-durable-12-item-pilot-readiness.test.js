'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');

const {
  APPROVED_PILOT_DEALS,
  METSERA_EXTENSION,
  RATIFIED_DECISION_REGISTER_FREEZE_ID,
  RETIRED_M1_ACKNOWLEDGEMENT_ID,
  SUCCESSOR_M1_AUTHORITY,
  SUCCESSOR_M1_AUTHORITY_SCHEMA,
  SUCCESSOR_M1_TRUST_STATE,
  buildDurableTwelveItemPilotReadiness,
  validateApprovedPilotManifest,
  validateSuccessorM1Authority,
} = require('../lib/canonical-v2/native-producer/durable-12-item-pilot-readiness');
const {
  compileDecisionReconciliationProposal,
} = require('../lib/canonical-v2/decision-reconciliation-proposal');
const {
  DARK_INTEGRATION_CONFIGURATION_SCHEMA,
  buildDarkIntegrationPreflight,
} = require('../lib/canonical-v2/dark-integration-preflight');
const {
  buildPromptBudgetPolicy,
} = require('../lib/canonical-v2/native-producer/unified-prompt-budget-preflight');
const {
  requireM1VerticalSliceExecutionPermission,
} = require('../lib/programme-gates/m1-milestone-permission');
const { contentId } = require('../lib/canonical-v2/canonical-bytes');

const ROOT = path.resolve(__dirname, '..');
const MANIFEST_PATH = path.join(ROOT, 'tests/fixtures/canonical-v2/m3-12-call-pilot-manifest.json');
const ACKNOWLEDGEMENT = fs.readFileSync(path.join(ROOT, 'docs/acks/M1-CONTRACT-FREEZE-2026-07-31-AMENDED.md'), 'utf8');
const BUNDLE = Object.freeze({
  bundle_id: '901d45871b90d0677dd3fdfa6b718cba1795c5393cbbe91412e05e9ea3f7bd76',
  contract_bundle_digest: '3b24070932af4ed946eb72b41fbaf9d9e77dd0eaa191af4dedbaeb7fe3f8f632',
  canonical_payload_digest: 'b8c1d79b6f8e9e7d403246804d52f10c5b6976a8928ce7bb95ae6a3687045a9d',
  substantive_member_count: 178,
  dependency_edge_count: 324,
  compile_status: 'PASS',
  cycle_status: 'PASS',
});
const DECISION_RECONCILIATION_PROPOSAL_ID = compileDecisionReconciliationProposal()
  .decision_reconciliation_proposal_id;

function decisionBindings() {
  return {
    authority: SUCCESSOR_M1_AUTHORITY,
    trust_state: SUCCESSOR_M1_TRUST_STATE,
    decision_reconciliation_proposal_id: DECISION_RECONCILIATION_PROPOSAL_ID,
    ratified_decision_register_freeze_id: RATIFIED_DECISION_REGISTER_FREEZE_ID,
  };
}

function authorityInput(overrides = {}) {
  const durableArtifactRoot = ROOT;
  return {
    root_dir: ROOT,
    durable_artifact_root: durableArtifactRoot,
    dark_integration_preflight: buildDarkIntegrationPreflight({
      configuration: {
        schema_version: DARK_INTEGRATION_CONFIGURATION_SCHEMA,
        authority: {
          production_authority: 'NONE',
          production_corpus_write_authority: 'NONE',
          production_import_authority: 'NONE',
          production_activation_authority: 'NONE',
        },
        durable_artifact_root: durableArtifactRoot,
      },
      environment: {},
    }),
    prompt_budget_policy: buildPromptBudgetPolicy({
      policy_id: 'M3_DURABLE_12_ITEM_PILOT_PROMPT_BUDGET',
      policy_version: 1,
      prompt_byte_ceiling: 64 * 1024,
    }),
    ...overrides,
  };
}

function oldM1AsPretendedSuccessor() {
  const permission = requireM1VerticalSliceExecutionPermission({
    acknowledgement_markdown: ACKNOWLEDGEMENT,
    current_bundle: BUNDLE,
  });
  const body = {
    schema_version: SUCCESSOR_M1_AUTHORITY_SCHEMA,
    ...decisionBindings(),
    prior_m1_acknowledgement_id: RETIRED_M1_ACKNOWLEDGEMENT_ID,
    successor_m1_acknowledgement_id: permission.m1_acknowledgement_id,
    successor_reviewed_commit: permission.reviewed_commit,
    successor_bundle_id: permission.bundle_id,
    successor_contract_bundle_digest: permission.contract_bundle_digest,
    successor_canonical_payload_digest: permission.canonical_payload_digest,
    successor_m1_permission: permission,
  };
  return { ...body, successor_m1_authority_id: contentId(SUCCESSOR_M1_AUTHORITY_SCHEMA, body) };
}

function fabricatedSuccessorAuthority(overrides = {}) {
  const successor = {
    acknowledgement: '1'.repeat(64),
    bundle: '2'.repeat(64),
    contract: '3'.repeat(64),
    payload: '4'.repeat(64),
    commit: '5'.repeat(40),
  };
  const permission = {
    schema_version: 'M1_VERTICAL_SLICE_EXECUTION_PERMISSION/V1',
    m1_acknowledgement_id: successor.acknowledgement,
    reviewed_commit: successor.commit,
    bundle_id: successor.bundle,
    contract_bundle_digest: successor.contract,
    canonical_payload_digest: successor.payload,
    ben_approval_reference: 'caller-written-approval-reference',
    vertical_slice_execution: 'PASS',
    authority_source: 'caller-written-authority-source',
    production_authority: 'NONE',
  };
  const body = {
    schema_version: SUCCESSOR_M1_AUTHORITY_SCHEMA,
    ...decisionBindings(),
    prior_m1_acknowledgement_id: RETIRED_M1_ACKNOWLEDGEMENT_ID,
    successor_m1_acknowledgement_id: successor.acknowledgement,
    successor_reviewed_commit: successor.commit,
    successor_bundle_id: successor.bundle,
    successor_contract_bundle_digest: successor.contract,
    successor_canonical_payload_digest: successor.payload,
    successor_m1_permission: permission,
    ...overrides,
  };
  return { ...body, successor_m1_authority_id: contentId(SUCCESSOR_M1_AUTHORITY_SCHEMA, body) };
}

function blockerCodes(receipt) {
  return receipt.blockers.map((entry) => entry.code);
}

test('binds the committed three-deal twelve-item pilot, but remains BLOCKED pending a committed successor M1 authority', () => {
  const first = buildDurableTwelveItemPilotReadiness(authorityInput());
  const second = buildDurableTwelveItemPilotReadiness(authorityInput());
  assert.equal(first.status, 'BLOCKED');
  assert.equal(first.readiness_id, second.readiness_id);
  assert.deepEqual(first.approved_pilot_scope.deals, APPROVED_PILOT_DEALS);
  assert.deepEqual(first.approved_pilot_scope.metsera_extension, METSERA_EXTENSION);
  assert.equal(first.execution_state, 'NOT_STARTED');
  assert.equal(first.provider_launch_authority, 'NOT_GRANTED');
  assert.equal(first.successor_m1_authority, SUCCESSOR_M1_AUTHORITY);
  assert.equal(first.successor_m1_authority, 'NONE');
  assert.equal(first.successor_m1_trust_state, SUCCESSOR_M1_TRUST_STATE);
  assert.ok(blockerCodes(first).includes('DURABLE_PILOT_M1_AUTHORITY_MISSING_OR_INVALID'));
  assert.deepEqual(first.work_items, []);
});

test('scope drift is rejected before a readiness result can be created', () => {
  const manifest = JSON.parse(fs.readFileSync(MANIFEST_PATH, 'utf8'));
  manifest.work_items[0].family_id = 'MAE_DEFINITION';
  assert.throws(
    () => validateApprovedPilotManifest(manifest, { root_dir: ROOT }),
    /has drifted/,
  );
});

test('the retired M1 acknowledgement cannot be presented as a successor authority', () => {
  assert.throws(
    () => validateSuccessorM1Authority(oldM1AsPretendedSuccessor()),
    /distinct reviewed acknowledgement and exact successor bundle/,
  );
});

test('fabricated and self-hashed successor permission cannot supply trusted M1 authority', () => {
  const fabricated = fabricatedSuccessorAuthority();
  assert.throws(
    () => validateSuccessorM1Authority(fabricated),
    /external trusted controller.*protected registry.*signature verification/i,
  );
  assert.throws(
    () => validateSuccessorM1Authority(fabricated, {
      ben_approval: 'APPROVED',
      signature_verified: true,
      trusted_controller: true,
    }),
    /Caller-supplied successor M1 verification is not trusted/,
  );
});

test('stale, substituted and replayed successor carriers fail closed', () => {
  const stale = oldM1AsPretendedSuccessor();
  assert.throws(() => validateSuccessorM1Authority(stale), /distinct reviewed acknowledgement/);

  const substituted = fabricatedSuccessorAuthority({ successor_bundle_id: '6'.repeat(64) });
  assert.throws(() => validateSuccessorM1Authority(substituted), /distinct reviewed acknowledgement and exact successor bundle/);

  const replay = fabricatedSuccessorAuthority();
  for (let attempt = 0; attempt < 2; attempt += 1) {
    assert.throws(
      () => validateSuccessorM1Authority(replay),
      /Self-hashed caller content is not authority/,
    );
  }
});

test('missing, swapped, stale and self-rehashed decision-freeze bindings fail closed', () => {
  const missing = fabricatedSuccessorAuthority();
  delete missing.ratified_decision_register_freeze_id;
  assert.throws(() => validateSuccessorM1Authority(missing), /invalid schema/);

  const swapped = fabricatedSuccessorAuthority({
    decision_reconciliation_proposal_id: RATIFIED_DECISION_REGISTER_FREEZE_ID,
    ratified_decision_register_freeze_id: DECISION_RECONCILIATION_PROPOSAL_ID,
  });
  assert.throws(() => validateSuccessorM1Authority(swapped), /current decision reconciliation proposal/);

  const stale = fabricatedSuccessorAuthority({
    decision_reconciliation_proposal_id: '6'.repeat(64),
  });
  assert.throws(() => validateSuccessorM1Authority(stale), /current decision reconciliation proposal/);

  const selfRehashedFreeze = fabricatedSuccessorAuthority({
    ratified_decision_register_freeze_id: '7'.repeat(64),
  });
  assert.throws(() => validateSuccessorM1Authority(selfRehashedFreeze), /self-hashed decision-register freeze is not trusted/i);
});

test('blocks deleted temporary roots and missing successor M1 or policy authority', () => {
  const temporary = buildDurableTwelveItemPilotReadiness(authorityInput({
    durable_artifact_root: '/tmp/deleted-canonical-v2-pilot',
  }));
  assert.equal(temporary.status, 'BLOCKED');
  assert.ok(blockerCodes(temporary).some((code) => code.startsWith('DURABLE_ARTIFACT_ROOT_')));

  const missingM1 = buildDurableTwelveItemPilotReadiness(authorityInput());
  assert.equal(missingM1.status, 'BLOCKED');
  assert.ok(blockerCodes(missingM1).includes('DURABLE_PILOT_M1_AUTHORITY_MISSING_OR_INVALID'));

  const missingPolicy = buildDurableTwelveItemPilotReadiness(authorityInput({ prompt_budget_policy: undefined }));
  assert.equal(missingPolicy.status, 'BLOCKED');
  assert.ok(blockerCodes(missingPolicy).includes('DURABLE_PILOT_POLICY_MISSING_OR_INVALID'));
});

test('blocks a dark-integration receipt with an enabled Canonical V2 flag', () => {
  const input = authorityInput();
  input.dark_integration_preflight = buildDarkIntegrationPreflight({
    configuration: {
      schema_version: DARK_INTEGRATION_CONFIGURATION_SCHEMA,
      authority: {
        production_authority: 'NONE',
        production_corpus_write_authority: 'NONE',
        production_import_authority: 'NONE',
        production_activation_authority: 'NONE',
      },
      durable_artifact_root: ROOT,
    },
    environment: { CANONICAL_V2_QUERY_ENABLED: 'true' },
  });
  const receipt = buildDurableTwelveItemPilotReadiness(input);
  assert.equal(receipt.status, 'BLOCKED');
  assert.ok(blockerCodes(receipt).includes('DURABLE_PILOT_DARK_INTEGRATION_NOT_CLOSED'));
});

test('readiness contains no provider, network, database, or execution launch path', () => {
  const source = fs.readFileSync(path.join(ROOT,
    'lib/canonical-v2/native-producer/durable-12-item-pilot-readiness.js'), 'utf8');
  assert.doesNotMatch(source, /createCodexCliProvider|provider_factory|executeUnifiedRun|anthropic-provider|node:https|node:http|\bfetch\s*\(|supabase|INSERT\s+INTO|activate_candidate_release/i);
  assert.match(source, /buildUnifiedPromptBudgetPreflight/);
});
