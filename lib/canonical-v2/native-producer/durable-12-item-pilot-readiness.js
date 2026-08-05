'use strict';

const fs = require('node:fs');
const path = require('node:path');

const { canonicalJson, contentId } = require('../canonical-bytes');
const {
  DARK_INTEGRATION_PREFLIGHT_SCHEMA,
  validateDarkIntegrationPreflightReceipt,
} = require('../dark-integration-preflight');
const { resolveDurableArtifactRoot } = require('../durable-artifact-root');
const { compileDecisionReconciliationProposal } = require('../decision-reconciliation-proposal');
const { PERMISSION_SCHEMA } = require('../../programme-gates/m1-milestone-permission');
const { PROFILES } = require('./codex-cli-provider');
const { buildUnifiedPromptBudgetPreflight } = require('./unified-prompt-budget-preflight');
const { validateUnifiedRunManifest } = require('./unified-runner-validate');
const { PILOT_WORK_ITEM_SET_ID, loadPilotWorkItems } = require('./m3-12-call-pilot-quality-gate');

const READINESS_SCHEMA = 'M3_DURABLE_12_ITEM_PILOT_READINESS/V1';
const SUCCESSOR_M1_AUTHORITY_SCHEMA = 'M3_SUCCESSOR_M1_AUTHORITY/V1';
const SUCCESSOR_M1_AUTHORITY_PATH = 'docs/acks/M3-SUCCESSOR-M1-AUTHORITY.json';
const PILOT_MANIFEST_PATH = 'tests/fixtures/canonical-v2/m3-12-call-pilot-manifest.json';
const PILOT_CONTROLS_PATH = 'tests/fixtures/canonical-v2/m3-12-call-pilot-controls.json';
const RETIRED_M1_ACKNOWLEDGEMENT_ID = '7cc9baa3412a4133062b0b19552fab4a1f461206053f901d0efe708847fa04bd';
const RETIRED_M1_REVIEWED_COMMIT = '9cef64ec626a50a78710ee90b08cdc0466b42374';
const SUCCESSOR_M1_AUTHORITY = 'NONE';
const SUCCESSOR_M1_TRUST_STATE = 'EXTERNAL_TRUSTED_CONTROLLER_AND_REGISTRY_UNAVAILABLE';
const RATIFIED_DECISION_REGISTER_FREEZE_ID = 'NONE';
const APPROVED_PILOT_DEALS = Object.freeze([
  Object.freeze({ deal_id: 'MODIV', source_id: 'modiv-full', work_item_count: 5 }),
  Object.freeze({ deal_id: 'SKECHERS', source_id: 'skechers-full', work_item_count: 2 }),
  Object.freeze({ deal_id: 'TOPBUILD', source_id: 'topbuild-full', work_item_count: 5 }),
]);
const METSERA_EXTENSION = Object.freeze({
  status: 'SEPARATE_PROPOSED_EXTENSION',
  authority: 'NOT_GRANTED',
  reason: 'Metsera has no approved work-item authority in the committed durable 12-item pilot.',
});

function isPlainObject(value) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return false;
  const prototype = Object.getPrototypeOf(value);
  return prototype === Object.prototype || prototype === null;
}

function exactKeys(value, keys) {
  return isPlainObject(value)
    && canonicalJson(Object.keys(value).sort()) === canonicalJson([...keys].sort());
}

function isDigest(value) {
  return typeof value === 'string' && /^[a-f0-9]{64}$/.test(value);
}

function blocker(code, message) {
  return Object.freeze({ code, message });
}

function resolveCommittedFile(rootDir, relativePath, label) {
  const root = path.resolve(rootDir);
  const file = path.resolve(root, relativePath);
  if (file === root || !file.startsWith(`${root}${path.sep}`) || !fs.existsSync(file)) {
    throw new Error(`${label} is unavailable.`);
  }
  return file;
}

function loadCommittedJson(rootDir, relativePath, label) {
  try {
    return JSON.parse(fs.readFileSync(resolveCommittedFile(rootDir, relativePath, label), 'utf8'));
  } catch (error) {
    throw new Error(`${label} is not valid JSON.`);
  }
}

function validateApprovedPilotManifest(manifest, { root_dir: rootDir = process.cwd() } = {}) {
  const workItems = loadPilotWorkItems({ root_dir: rootDir });
  const expectedById = new Map(workItems.map((item) => [item.work_item_id, item]));
  if (!manifest || !Array.isArray(manifest.sources) || !Array.isArray(manifest.work_items)
    || manifest.work_items.length !== 12) {
    throw new Error('Committed pilot manifest does not contain the approved twelve work items.');
  }
  const sourceIds = manifest.sources.map((source) => source?.source_id).sort();
  const expectedSourceIds = APPROVED_PILOT_DEALS.map((deal) => deal.source_id).sort();
  if (canonicalJson(sourceIds) !== canonicalJson(expectedSourceIds)) {
    throw new Error('Committed pilot manifest source scope differs from the approved three-deal pilot.');
  }
  const workItemIds = manifest.work_items.map((item) => item?.work_item_id).sort();
  if (canonicalJson(workItemIds) !== canonicalJson([...expectedById.keys()].sort())) {
    throw new Error('Committed pilot manifest work-item scope differs from the approved cohort.');
  }
  for (const item of manifest.work_items) {
    const expected = expectedById.get(item.work_item_id);
    if (!expected || item.source_id !== expected.source_id || item.family_id !== expected.family_id
      || item.disposition !== 'EXTRACT' || !item.section_pin) {
      throw new Error(`Committed pilot work item ${item?.work_item_id || 'unknown'} has drifted.`);
    }
  }
  for (const deal of APPROVED_PILOT_DEALS) {
    if (manifest.work_items.filter((item) => item.source_id === deal.source_id).length !== deal.work_item_count) {
      throw new Error(`Committed pilot ${deal.deal_id} work-item count has drifted.`);
    }
  }
  return Object.freeze(manifest);
}

function validateControls(controls, manifest) {
  if (!exactKeys(controls, ['schema_version', 'work_item_controls'])
    || controls.schema_version !== 'NATIVE_UNIFIED_RUN_WORK_ITEM_CONTROLS/V1'
    || !Array.isArray(controls.work_item_controls)) {
    throw new Error('Committed pilot controls have an invalid schema.');
  }
  const itemIds = manifest.work_items.map((item) => item.work_item_id).sort();
  const byId = new Map();
  for (const control of controls.work_item_controls) {
    if (!exactKeys(control, ['covenant_side', 'profile_id', 'work_item_id'])
      || byId.has(control.work_item_id) || !PROFILES[control.profile_id]) {
      throw new Error('Committed pilot controls have drifted.');
    }
    byId.set(control.work_item_id, control);
  }
  if (canonicalJson([...byId.keys()].sort()) !== canonicalJson(itemIds)) {
    throw new Error('Committed pilot controls do not cover the exact approved work-item scope.');
  }
  return byId;
}

function validateM1Permission(permission) {
  const keys = [
    'authority_source', 'ben_approval_reference', 'bundle_id', 'canonical_payload_digest',
    'contract_bundle_digest', 'm1_acknowledgement_id', 'production_authority',
    'reviewed_commit', 'schema_version', 'vertical_slice_execution',
  ];
  if (!exactKeys(permission, keys) || permission.schema_version !== PERMISSION_SCHEMA
    || permission.vertical_slice_execution !== 'PASS' || permission.production_authority !== 'NONE'
    || !isDigest(permission.m1_acknowledgement_id) || !isDigest(permission.bundle_id)
    || !isDigest(permission.contract_bundle_digest) || !isDigest(permission.canonical_payload_digest)
    || typeof permission.reviewed_commit !== 'string' || !/^[a-f0-9]{40}$/.test(permission.reviewed_commit)) {
    throw new Error('Successor M1 permission is not an exact non-production PASS authority.');
  }
  return Object.freeze({ ...permission });
}

function validateSuccessorM1Authority(authority, callerVerification) {
  const keys = [
    'authority', 'decision_reconciliation_proposal_id', 'prior_m1_acknowledgement_id',
    'ratified_decision_register_freeze_id', 'schema_version', 'successor_bundle_id',
    'successor_canonical_payload_digest', 'successor_contract_bundle_digest',
    'successor_m1_acknowledgement_id', 'successor_m1_authority_id',
    'successor_m1_permission', 'successor_reviewed_commit', 'trust_state',
  ];
  if (!exactKeys(authority, keys) || authority.schema_version !== SUCCESSOR_M1_AUTHORITY_SCHEMA) {
    throw new Error('Successor M1 authority has an invalid schema.');
  }
  if (authority.authority !== SUCCESSOR_M1_AUTHORITY
    || authority.trust_state !== SUCCESSOR_M1_TRUST_STATE) {
    throw new Error('Successor M1 diagnostic must retain authority NONE while external verification is unavailable.');
  }
  if (callerVerification !== undefined) {
    throw new Error('Caller-supplied successor M1 verification is not trusted.');
  }
  const { successor_m1_authority_id: authorityId, ...body } = authority;
  if (!isDigest(authorityId) || authorityId !== contentId(SUCCESSOR_M1_AUTHORITY_SCHEMA, body)) {
    throw new Error('Successor M1 authority does not match its content identity.');
  }
  const currentDecisionReconciliationProposalId = compileDecisionReconciliationProposal()
    .decision_reconciliation_proposal_id;
  if (authority.decision_reconciliation_proposal_id !== currentDecisionReconciliationProposalId) {
    throw new Error('Successor M1 diagnostic does not bind the current decision reconciliation proposal.');
  }
  if (authority.ratified_decision_register_freeze_id !== RATIFIED_DECISION_REGISTER_FREEZE_ID) {
    throw new Error('A caller-supplied or self-hashed decision-register freeze is not trusted. The ratified freeze remains unavailable.');
  }
  const permission = validateM1Permission(authority.successor_m1_permission);
  const successorIds = [
    authority.successor_m1_acknowledgement_id,
    authority.successor_bundle_id,
    authority.successor_contract_bundle_digest,
    authority.successor_canonical_payload_digest,
  ];
  if (authority.prior_m1_acknowledgement_id !== RETIRED_M1_ACKNOWLEDGEMENT_ID
    || successorIds.some((value) => !isDigest(value))
    || typeof authority.successor_reviewed_commit !== 'string'
    || !/^[a-f0-9]{40}$/.test(authority.successor_reviewed_commit)
    || authority.successor_m1_acknowledgement_id === RETIRED_M1_ACKNOWLEDGEMENT_ID
    || authority.successor_reviewed_commit === RETIRED_M1_REVIEWED_COMMIT
    || permission.m1_acknowledgement_id !== authority.successor_m1_acknowledgement_id
    || permission.reviewed_commit !== authority.successor_reviewed_commit
    || permission.bundle_id !== authority.successor_bundle_id
    || permission.contract_bundle_digest !== authority.successor_contract_bundle_digest
    || permission.canonical_payload_digest !== authority.successor_canonical_payload_digest) {
    throw new Error('Successor M1 authority must bind a distinct reviewed acknowledgement and exact successor bundle.');
  }
  throw new Error('Successor M1 authority requires an external trusted controller, protected registry, current acknowledgement verification, approval verification and signature verification. Self-hashed caller content is not authority.');
}

function validateDarkPreflight(preflight, durableArtifactRoot) {
  const receipt = validateDarkIntegrationPreflightReceipt(preflight);
  if (receipt.schema_version !== DARK_INTEGRATION_PREFLIGHT_SCHEMA || receipt.status !== 'PASS'
    || receipt.durable_artifact_root !== durableArtifactRoot) {
    throw new Error('Dark-integration preflight is not a passing receipt for this durable output root.');
  }
  return receipt;
}

function readyWorkItems(validation, promptPreflight, controlsById) {
  const callsById = new Map(promptPreflight.calls.map((call) => [call.work_item_id, call]));
  const sourceById = new Map(validation.semantic_manifest.sources.map((source) => [source.source_id, source]));
  return Object.freeze([...validation.semantic_manifest.work_items]
    .sort((left, right) => left.work_item_id.localeCompare(right.work_item_id))
    .map((item) => {
      const call = callsById.get(item.work_item_id);
      const control = controlsById.get(item.work_item_id);
      const profile = PROFILES[control.profile_id];
      return Object.freeze({
        work_item_id: item.work_item_id,
        source_id: item.source_id,
        source_context_id: sourceById.get(item.source_id).admitted_semantic_source_context_id,
        family_id: item.family_id,
        section_reference: item.section_reference,
        section_id: item.section_id,
        section_kind: item.section_kind,
        section_text_sha256: item.section_text_sha256,
        prompt_id: call.prompt_id,
        prompt_version: call.prompt_version,
        prompt_byte_length: call.prompt_byte_length,
        profile_id: profile.profile_id,
        model: profile.model,
        reasoning_effort: profile.reasoning_effort,
        covenant_side: control.covenant_side,
      });
    }));
}

function buildDurableTwelveItemPilotReadiness({
  root_dir: rootDir = process.cwd(),
  durable_artifact_root: durableArtifactRootInput,
  dark_integration_preflight: darkIntegrationPreflight,
  prompt_budget_policy: promptBudgetPolicy,
} = {}) {
  const blockers = [];
  let durableArtifactRoot = null;
  let manifest = null;
  let controlsById = null;
  let validation = null;
  let promptPreflight = null;
  let successorM1 = null;
  let darkPreflight = null;
  try {
    durableArtifactRoot = resolveDurableArtifactRoot({ root: durableArtifactRootInput, certificationMode: true, requireExisting: true });
  } catch (error) {
    blockers.push(blocker(error?.code || 'DURABLE_ARTIFACT_ROOT_INVALID', error?.message || 'Durable output root is invalid.'));
  }
  try {
    successorM1 = validateSuccessorM1Authority(loadCommittedJson(
      rootDir,
      SUCCESSOR_M1_AUTHORITY_PATH,
      'Committed successor M1 authority',
    ));
  } catch (error) {
    blockers.push(blocker('DURABLE_PILOT_M1_AUTHORITY_MISSING_OR_INVALID', error.message));
  }
  try {
    if (!durableArtifactRoot) throw new Error('A safe durable output root is required before dark-preflight validation.');
    darkPreflight = validateDarkPreflight(darkIntegrationPreflight, durableArtifactRoot);
  } catch (error) {
    blockers.push(blocker('DURABLE_PILOT_DARK_INTEGRATION_NOT_CLOSED', error.message));
  }
  if (promptBudgetPolicy === undefined || promptBudgetPolicy === null) {
    blockers.push(blocker('DURABLE_PILOT_POLICY_MISSING_OR_INVALID', 'A prompt-budget policy is required for the approved pilot scope.'));
  }
  if (blockers.length === 0) {
    try {
      manifest = validateApprovedPilotManifest(loadCommittedJson(rootDir, PILOT_MANIFEST_PATH, 'Committed pilot manifest'), { root_dir: rootDir });
      controlsById = validateControls(loadCommittedJson(rootDir, PILOT_CONTROLS_PATH, 'Committed pilot controls'), manifest);
      validation = validateUnifiedRunManifest({ manifest, root_dir: rootDir });
      if (validation.execution_plan.zero_retry_provider_call_count !== 12
        || validation.receipt.work_item_count !== 12) {
        throw new Error('Committed pilot validation does not bind exactly twelve zero-retry calls.');
      }
      promptPreflight = buildUnifiedPromptBudgetPreflight({
        manifest,
        prompt_budget_policy: promptBudgetPolicy,
        root_dir: rootDir,
      });
      if (promptPreflight.status !== 'PASS' || promptPreflight.calls.length !== 12) {
        throw new Error('Prompt-budget preflight did not produce the exact twelve-call plan.');
      }
    } catch (error) {
      blockers.push(blocker(
        error?.code === 'INVALID_PROMPT_BUDGET_POLICY' || error?.code === 'PROMPT_BUDGET_POLICY_DIGEST_MISMATCH'
          ? 'DURABLE_PILOT_POLICY_MISSING_OR_INVALID'
          : 'DURABLE_PILOT_SCOPE_DRIFT',
        error.message,
      ));
    }
  }
  const sortedBlockers = Object.freeze([...blockers].sort((left, right) => (
    left.code.localeCompare(right.code) || left.message.localeCompare(right.message)
  )));
  const workItems = sortedBlockers.length === 0 && validation && promptPreflight && controlsById
    ? readyWorkItems(validation, promptPreflight, controlsById)
    : Object.freeze([]);
  const body = {
    schema_version: READINESS_SCHEMA,
    status: sortedBlockers.length === 0 ? 'READY' : 'BLOCKED',
    approved_pilot_scope: Object.freeze({
      pilot_work_item_set_id: PILOT_WORK_ITEM_SET_ID,
      deals: APPROVED_PILOT_DEALS,
      metsera_extension: METSERA_EXTENSION,
    }),
    durable_artifact_root: durableArtifactRoot,
    successor_m1_authority_id: successorM1?.successor_m1_authority_id || null,
    successor_m1_acknowledgement_id: successorM1?.successor_m1_acknowledgement_id || null,
    prompt_budget_policy_id: promptPreflight?.prompt_budget_policy?.policy_id || null,
    prompt_budget_policy_digest: promptPreflight?.prompt_budget_policy?.policy_digest || null,
    dark_integration_preflight_id: darkPreflight?.preflight_id || null,
    execution_state: 'NOT_STARTED',
    provider_launch_authority: 'NOT_GRANTED',
    successor_m1_authority: SUCCESSOR_M1_AUTHORITY,
    successor_m1_trust_state: SUCCESSOR_M1_TRUST_STATE,
    work_items: workItems,
    blockers: sortedBlockers,
  };
  return Object.freeze({
    ...body,
    readiness_id: contentId(READINESS_SCHEMA, body),
  });
}

module.exports = {
  APPROVED_PILOT_DEALS,
  METSERA_EXTENSION,
  READINESS_SCHEMA,
  RATIFIED_DECISION_REGISTER_FREEZE_ID,
  RETIRED_M1_ACKNOWLEDGEMENT_ID,
  SUCCESSOR_M1_AUTHORITY,
  SUCCESSOR_M1_AUTHORITY_SCHEMA,
  SUCCESSOR_M1_AUTHORITY_PATH,
  SUCCESSOR_M1_TRUST_STATE,
  buildDurableTwelveItemPilotReadiness,
  validateApprovedPilotManifest,
  validateSuccessorM1Authority,
};
