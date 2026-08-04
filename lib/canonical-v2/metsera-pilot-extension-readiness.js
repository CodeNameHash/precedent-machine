'use strict';

const { canonicalJson, contentId } = require('./canonical-bytes');
const { resolveDurableArtifactRoot } = require('./durable-artifact-root');
const { validateDarkIntegrationPreflightReceipt } = require('./dark-integration-preflight');
const { validateSuccessorM1Authority } = require('./native-producer/durable-12-item-pilot-readiness');
const {
  validateMetseraComprehensiveSelectionReview,
} = require('./metsera-comprehensive-selection-review');
const { POLICY_SCHEMA } = require('./native-producer/unified-prompt-budget-preflight');

const READINESS_SCHEMA = 'M3_METSERA_PILOT_EXTENSION_READINESS/V1';
const DIGEST_RE = /^[a-f0-9]{64}$/;

function exactKeys(value, keys) {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value)
    && canonicalJson(Object.keys(value).sort()) === canonicalJson([...keys].sort());
}

function blocker(code, message) {
  return Object.freeze({ code, message });
}

function validatePromptBudgetPolicy(policy) {
  if (!exactKeys(policy, ['schema_version', 'policy_id', 'policy_version', 'prompt_byte_ceiling', 'policy_digest'])
    || policy.schema_version !== POLICY_SCHEMA
    || typeof policy.policy_id !== 'string' || !policy.policy_id.trim() || policy.policy_id.trim() !== policy.policy_id
    || !Number.isSafeInteger(policy.policy_version) || policy.policy_version < 1
    || !Number.isSafeInteger(policy.prompt_byte_ceiling) || policy.prompt_byte_ceiling < 1
    || typeof policy.policy_digest !== 'string' || !DIGEST_RE.test(policy.policy_digest)) {
    throw new TypeError('Prompt-budget policy must be an exact content-addressed policy.');
  }
  const body = {
    schema_version: policy.schema_version,
    policy_id: policy.policy_id,
    policy_version: policy.policy_version,
    prompt_byte_ceiling: policy.prompt_byte_ceiling,
  };
  if (policy.policy_digest !== contentId(POLICY_SCHEMA, body)) {
    throw new TypeError('Prompt-budget policy does not match its content identity.');
  }
  return Object.freeze({ ...policy });
}

function buildMetseraPilotExtensionReadiness({
  comprehensive_selection_review: comprehensiveSelectionReview,
  durable_artifact_root: durableArtifactRootInput,
  dark_integration_preflight: darkIntegrationPreflight,
  prompt_budget_policy: promptBudgetPolicy,
  successor_m1_authority: successorM1Authority,
} = {}) {
  const blockers = [];
  let review = null;
  let durableArtifactRoot = null;
  let darkPreflight = null;
  let policy = null;
  let successorM1 = null;
  try { review = validateMetseraComprehensiveSelectionReview(comprehensiveSelectionReview); } catch (error) {
    blockers.push(blocker('METSERA_COMPREHENSIVE_SELECTION_REVIEW_INVALID', error.message));
  }
  try {
    durableArtifactRoot = resolveDurableArtifactRoot({ root: durableArtifactRootInput, certificationMode: true, requireExisting: true });
  } catch (error) {
    blockers.push(blocker(error?.code || 'METSERA_DURABLE_ARTIFACT_ROOT_INVALID', error?.message || 'Durable output root is invalid.'));
  }
  try {
    if (!durableArtifactRoot) throw new Error('A safe durable output root is required before dark-preflight validation.');
    darkPreflight = validateDarkIntegrationPreflightReceipt(darkIntegrationPreflight);
    if (darkPreflight.status !== 'PASS' || darkPreflight.durable_artifact_root !== durableArtifactRoot) {
      throw new Error('Dark-integration preflight must pass for this exact durable output root.');
    }
  } catch (error) {
    blockers.push(blocker('METSERA_DARK_INTEGRATION_NOT_CLOSED', error.message));
  }
  try { policy = validatePromptBudgetPolicy(promptBudgetPolicy); } catch (error) {
    blockers.push(blocker('METSERA_PROMPT_BUDGET_POLICY_INVALID', error.message));
  }
  try { successorM1 = validateSuccessorM1Authority(successorM1Authority); } catch (error) {
    blockers.push(blocker('METSERA_SUCCESSOR_M1_AUTHORITY_NOT_PROVED', error.message));
  }
  if (review) {
    if (review.rendered_surface_evidence_state === 'STATIC_EVIDENCE_INCOMPLETE') {
      blockers.push(blocker(
        'V1_RENDERED_SURFACE_CAPTURE_REQUIRED',
        'Static V1 files are not rendered-surface evidence. Read-only capture, replay and ledger validation are required before any corroboration review.',
      ));
    }
    blockers.push(blocker(
      'METSERA_COMPREHENSIVE_SELECTION_REVIEW_NOT_ISSUED',
      'The complete Metsera selection review remains review-required and grants no executable work item.',
    ));
  }
  blockers.push(blocker(
    'BLOCKED_ROUTING_CLASSIFIER_SEMANTICS',
    'Metsera routing remains blocked until deterministic classifier semantic false routes are remediated.',
  ));
  const sortedBlockers = Object.freeze([...blockers].sort((left, right) => (
    left.code.localeCompare(right.code) || left.message.localeCompare(right.message)
  )));
  const body = {
    schema_version: READINESS_SCHEMA,
    status: 'BLOCKED',
    comprehensive_selection_review_id: review?.review_id || null,
    separate_from_pilot_work_item_set: 'M3_12_CALL_PILOT',
    durable_artifact_root: durableArtifactRoot,
    dark_integration_preflight_id: darkPreflight?.preflight_id || null,
    prompt_budget_policy_id: policy?.policy_id || null,
    prompt_budget_policy_digest: policy?.policy_digest || null,
    successor_m1_authority_id: successorM1?.successor_m1_authority_id || null,
    execution_state: 'NOT_STARTED',
    provider_launch_authority: 'NOT_GRANTED',
    source_admission_authority: 'NOT_ADMISSION_AUTHORITY',
    execution_sources: Object.freeze([]),
    work_items: Object.freeze([]),
    blockers: sortedBlockers,
  };
  return Object.freeze({ ...body, readiness_id: contentId(READINESS_SCHEMA, body) });
}

module.exports = {
  READINESS_SCHEMA,
  buildMetseraPilotExtensionReadiness,
  validatePromptBudgetPolicy,
};
